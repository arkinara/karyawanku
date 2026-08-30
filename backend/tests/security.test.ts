import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, start } from '../src/app.js'
import { boot } from '../src/index.js'
import { createDb, setDb } from '../src/db/index.js'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

describe('Boot-time JWT_SECRET validation', () => {
  it('menolak start tanpa JWT_SECRET dengan pesan jelas', async () => {
    const prev = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    try {
      await expect(start(0)).rejects.toThrow(
        'JWT_SECRET must be set and at least 32 chars; see backend/.env.example',
      )
    } finally {
      if (prev === undefined) delete process.env.JWT_SECRET
      else process.env.JWT_SECRET = prev
    }
  })

  it('menolak start ketika JWT_SECRET lebih pendek dari 32 karakter', async () => {
    const prev = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'pendek'
    try {
      await expect(start(0)).rejects.toThrow(
        'JWT_SECRET must be set and at least 32 chars; see backend/.env.example',
      )
    } finally {
      if (prev === undefined) delete process.env.JWT_SECRET
      else process.env.JWT_SECRET = prev
    }
  })
})

describe('Helmet headers', () => {
  it('menambahkan X-Frame-Options DENY dan X-Content-Type-Options', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    await app.close()
  })
})

describe('Body size limit', () => {
  it('menolak body JSON > 1 MB dengan 413', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        nama: 'X',
        email: 'oversize@demo.com',
        password: 'x' + 'a'.repeat(2 * 1024 * 1024),
      }),
    })
    expect(res.statusCode).toBe(413)
    expect(res.json().error.message).toBeTruthy()
    await app.close()
  })
})

describe('CORS allowlist', () => {
  it('origin dalam allowlist diterima dengan header CORS yang sesuai', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { origin: 'http://localhost:3000' },
    })
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    await app.close()
  })

  it('origin di luar allowlist ditolak', async () => {
    const app = buildApp()
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { origin: 'https://evil.example' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('tidak diizinkan')
    await app.close()
  })
})

describe('Rate limit /auth/sign-in', () => {
  it('mengembalikan 429 { error: rate_limited } setelah batas tercapai, lalu reset setelah window', async () => {
    process.env.RATE_LIMIT_SIGNIN_MAX = '2'
    process.env.RATE_LIMIT_SIGNIN_WINDOW_MS = '60000'
    ctx = await setupTest()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    try {
      for (let i = 0; i < 2; i++) {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/auth/sign-in',
          payload: { email: 'owner@demo.com', password: 'owner123' },
        })
        expect(res.statusCode).toBe(200)
      }
      const limited = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: { email: 'owner@demo.com', password: 'owner123' },
      })
      expect(limited.statusCode).toBe(429)
      expect(limited.json().error).toBe('rate_limited')
      expect(limited.json().message).toBeTruthy()

      spy.mockReturnValue(1_700_000_000_000 + 60_001)
      const after = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: { email: 'owner@demo.com', password: 'owner123' },
      })
      expect(after.statusCode).toBe(200)
    } finally {
      spy.mockRestore()
      delete process.env.RATE_LIMIT_SIGNIN_MAX
      delete process.env.RATE_LIMIT_SIGNIN_WINDOW_MS
    }
  })
})

describe('Migration discipline', () => {
  it('boot tanpa migrasi otomatis: server naik tapi tidak menjalankan migrasi', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-sec-nomig-'))
    const dbPath = join(dir, 'app.db')
    const instance = createDb(dbPath)
    setDb(instance)
    const prevDbUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = dbPath
    delete process.env.MIGRATE_ON_BOOT
    let app: FastifyInstance | undefined
    try {
      app = await boot(0)
      const tables = instance.sqlite
        .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .get() as { n: number }
      expect(tables.n).toBe(0)
    } finally {
      await app?.close()
      instance.sqlite.close()
      if (prevDbUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prevDbUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('boot dengan MIGRATE_ON_BOOT=1 menerapkan migrasi', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-sec-mig-'))
    const dbPath = join(dir, 'app.db')
    const instance = createDb(dbPath)
    setDb(instance)
    const prevDbUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = dbPath
    process.env.MIGRATE_ON_BOOT = '1'
    let app: FastifyInstance | undefined
    try {
      app = await boot(0)
      const users = instance.sqlite
        .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'users'")
        .get() as { n: number }
      expect(users.n).toBe(1)
    } finally {
      await app?.close()
      instance.sqlite.close()
      if (prevDbUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prevDbUrl
      delete process.env.MIGRATE_ON_BOOT
      rmSync(dir, { recursive: true, force: true })
    }
  })
})