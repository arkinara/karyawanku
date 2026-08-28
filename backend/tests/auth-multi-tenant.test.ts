import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { createDb } from '../src/db/index.js'
import { businesses, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function businessCount(): number {
  return (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get() as { n: number }).n
}

function userCount(): number {
  return (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

describe('multi-tenant auth', () => {
  it('user dari POST /api/businesses tetap bisa sign-in dengan token scoped ke bisnisnya', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/businesses',
      payload: {
        nama_bisnis: 'PT Sejahtera',
        jenis_usaha: 'jasa',
        alamat: 'Jl. Melati No. 5',
        owner: { nama: 'Yoga', email: 'yoga@demo.com', password: 'rahasia123' },
      },
    })
    expect(res.statusCode).toBe(200)
    const newBusinessId = res.json().business.id

    const signIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'yoga@demo.com', password: 'rahasia123' },
    })
    expect(signIn.statusCode).toBe(200)
    const { verifyToken } = await import('../src/lib/auth.js')
    const payload = verifyToken(signIn.json().token)
    expect(payload.businessId).toBe(newBusinessId)
    expect(payload.businessId).not.toBe(ctx.businessId)
  })

  it('dua sign-up email sama bersamaan → hanya satu berhasil, yang lain 409, tanpa baris yatim', async () => {
    ctx = await setupTest()
    const beforeBusiness = businessCount()
    const beforeUser = userCount()

    const payload = {
      nama: 'Lomba',
      email: 'lomba@demo.com',
      password: 'rahasia123',
      namaBisnis: 'Bisnis Lomba',
    }
    const [a, b] = await Promise.all([
      ctx.app.inject({ method: 'POST', url: '/api/auth/sign-up', payload }),
      ctx.app.inject({ method: 'POST', url: '/api/auth/sign-up', payload }),
    ])

    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes).toEqual([200, 409])

    const loser = a.statusCode === 409 ? a : b
    expect(loser.json().error.message).toContain('Email sudah terdaftar')

    const dup = ctx.db.sqlite
      .prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'lomba@demo.com'")
      .get() as { n: number }
    expect(dup.n).toBe(1)
    expect(businessCount()).toBe(beforeBusiness + 1)
    expect(userCount()).toBe(beforeUser + 1)
  })

  it('sign-up email yang dipakai bisnis lain → 409, tidak ada bisnis yang dibuat', async () => {
    ctx = await setupTest()
    const before = businessCount()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: 'Bajak', email: 'owner@demo.com', password: 'rahasia123', namaBisnis: 'Bisnis Bajak' },
    })
    expect(res.statusCode).toBe(409)
    expect(businessCount()).toBe(before)
  })
})

describe('migrasi keunikan email global', () => {
  const migrationsFolder = resolve(__dirname, '../drizzle')

  it('pre-flight mendeteksi email duplikat dan menghentikan migrasi (skema tidak berubah)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'karyawanku-dup-'))
    const dbPath = join(dir, 'dup.db')
    const { sqlite, db } = createDb(dbPath)

    // Terapkan 0000–0006 saja (tanpa 0007) dengan folder migrasi parsial.
    const partialFolder = join(dir, 'drizzle-partial')
    cpSync(migrationsFolder, partialFolder, { recursive: true })
    const journalPath = join(partialFolder, 'meta/_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ tag: string }>
    }
    journal.entries = journal.entries.filter((e) => e.tag !== '0007_user-email-global-unique')
    writeFileSync(journalPath, JSON.stringify(journal))
    rmSync(join(partialFolder, '0007_user-email-global-unique.sql'), { force: true })
    rmSync(join(partialFolder, 'meta/0007_user-email-global-unique_snapshot.json'), { force: true })

    migrate(db, { migrationsFolder: partialFolder })

    // Email yang sama di dua bisnis sah di bawah unique (business_id, email) lama.
    const b1 = db.insert(businesses).values({ nama_bisnis: 'Bisnis A' }).returning().get()
    const b2 = db.insert(businesses).values({ nama_bisnis: 'Bisnis B' }).returning().get()
    db.insert(users).values({ business_id: b1.id, email: 'dup@demo.com', nama: 'X', password_hash: 'x' }).run()
    db.insert(users).values({ business_id: b2.id, email: 'dup@demo.com', nama: 'Y', password_hash: 'x' }).run()

    let thrown: unknown
    try {
      migrate(db, { migrationsFolder })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeTruthy()
    const cause = (thrown as { cause?: { message?: string } }).cause
    expect(cause?.message).toMatch(/dup@demo\.com/)

    const globalIdx = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='users_email_unique'")
      .get()
    expect(globalIdx).toBeUndefined()
    const oldIdx = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='users_business_email_unique'")
      .get()
    expect(oldIdx).toBeTruthy()

    sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  })
})