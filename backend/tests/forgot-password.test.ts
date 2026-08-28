import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { passwordResets } from '../src/db/schema.js'

let ctx: TestCtx
let logSpy: ReturnType<typeof vi.spyOn>

afterEach(() => {
  logSpy?.mockRestore()
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function uniqueEmail(): string {
  return `reset-${randomUUID().slice(0, 8)}@demo.com`
}

async function createUser(email: string) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/users',
    headers: auth(ctx.ownerToken),
    payload: { email, password: 'rahasia123', nama: 'User Reset' },
  })
  expect(res.statusCode).toBe(200)
  return res.json().user
}

async function forgotPassword(email: string) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email } })
}

function extractTokenFromLog(): string {
  const logged = logSpy.mock.calls.flat().join('\n')
  const m = logged.match(/[?&]token=([0-9a-f]+)/)
  expect(m).toBeTruthy()
  return m![1]
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('POST /api/auth/forgot-password', () => {
  it('email terdaftar → membuat token reset + mencatat tautan ke log (placeholder email)', async () => {
    ctx = await setupTest()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const email = uniqueEmail()
    await createUser(email)

    const res = await forgotPassword(email)
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const token = extractTokenFromLog()
    const { db } = ctx.db
    const record = db.select().from(passwordResets).all().find((r) => r.token_hash === hashToken(token))
    expect(record).toBeTruthy()
    expect(record!.used_at).toBeNull()
  })

  it('email tak dikenal → respons generik sama, tidak membocorkan keberadaan akun', async () => {
    ctx = await setupTest()
    const email = uniqueEmail()
    const res = await forgotPassword(email)
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.json().message).toContain('Jika email terdaftar')
  })

  it('rate limit: maks 3 permintaan per email per jam → yang ke-4 ditolak 429', async () => {
    ctx = await setupTest()
    const email = uniqueEmail()
    for (let i = 0; i < 3; i++) {
      const res = await forgotPassword(email)
      expect(res.statusCode).toBe(200)
    }
    const fourth = await forgotPassword(email)
    expect(fourth.statusCode).toBe(429)
  })
})

describe('POST /api/auth/reset-password', () => {
  it('token valid → password berubah, sesi lama dicabut, bisa masuk dengan password baru', async () => {
    ctx = await setupTest()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const email = uniqueEmail()
    const user = await createUser(email)

    const signedIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email, password: 'rahasia123' },
    })
    expect(signedIn.statusCode).toBe(200)

    await forgotPassword(email)
    const token = extractTokenFromLog()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'kataSandiBaru' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    const meOld = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: auth(signedIn.json().token),
    })
    expect(meOld.statusCode).toBe(401)

    const oldPw = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email, password: 'rahasia123' },
    })
    expect(oldPw.statusCode).toBe(401)
    const newPw = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email, password: 'kataSandiBaru' },
    })
    expect(newPw.statusCode).toBe(200)
  })

  it('token sudah dipakai → 400 dan tidak mengubah password', async () => {
    ctx = await setupTest()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const email = uniqueEmail()
    await createUser(email)

    await forgotPassword(email)
    const token = extractTokenFromLog()

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'kataSandiBaru' },
    })
    expect(first.statusCode).toBe(200)

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'kataSandiLagi' },
    })
    expect(second.statusCode).toBe(400)

    const signIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email, password: 'kataSandiBaru' },
    })
    expect(signIn.statusCode).toBe(200)
  })

  it('token kedaluwarsa → 400', async () => {
    ctx = await setupTest()
    const email = uniqueEmail()
    const user = await createUser(email)

    const token = 'expired-token-' + randomUUID()
    const { db } = ctx.db
    db.insert(passwordResets)
      .values({
        user_id: user.id,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() - 60_000),
      })
      .run()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'kataSandiBaru' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('password gagal policy → 400 tanpa mengonsumsi token', async () => {
    ctx = await setupTest()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const email = uniqueEmail()
    await createUser(email)

    await forgotPassword(email)
    const token = extractTokenFromLog()

    const weak = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: '123' },
    })
    expect(weak.statusCode).toBe(400)

    const { db } = ctx.db
    const record = db.select().from(passwordResets).all().find((r) => r.token_hash === hashToken(token))
    expect(record!.used_at).toBeNull()
  })
})