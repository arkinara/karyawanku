import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { randomUUID } from 'node:crypto'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

describe('POST /api/auth/sign-up', () => {
  it('membuat bisnis + user owner dan mengembalikan token', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: 'Budi', email: 'baru@demo.com', password: 'rahasia123', namaBisnis: 'Kafe Baru' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.role).toBe('owner')
    expect(body.user.email).toBe('baru@demo.com')
    expect(body.user.password_hash).toBeUndefined()
  })

  it('email yang sama di bisnis berbeda diperbolehkan (unik per bisnis)', async () => {
    ctx = await setupTest()
    // sign-up selalu membuat bisnis baru → email boleh sama di bisnis lain (scoped uniqueness)
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: 'Dup', email: 'owner@demo.com', password: 'rahasia123', namaBisnis: 'Bisnis Lain' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.business_id).not.toBe(ctx.businessId)
  })

  it('menolak payload tidak valid → 400', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: '', email: 'bukan-email', password: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/sign-in', () => {
  it('mengembalikan token untuk kredensial benar', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'owner@demo.com', password: 'owner123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.role).toBe('owner')
  })

  it('kredensial salah → 401 tanpa token', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'owner@demo.com', password: 'salah' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().token).toBeUndefined()
  })

  it('user dinonaktifkan tidak bisa masuk → 401', async () => {
    ctx = await setupTest()
    const { db } = ctx.db
    const { users } = await import('../src/db/schema.js')
    const { eq } = await import('drizzle-orm')
    db.update(users).set({ status: 'nonaktif' }).where(eq(users.email, 'owner@demo.com')).run()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'owner@demo.com', password: 'owner123' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/sign-out', () => {
  it('mengembalikan { ok: true }', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})

describe('GET /api/auth/me', () => {
  it('mengembalikan user dari token Bearer', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${ctx.ownerToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe('owner@demo.com')
    expect(res.json().user.business_id).toBe(ctx.businessId)
    expect(res.json().user.password_hash).toBeUndefined()
  })

  it('tanpa token → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('token kedaluwarsa → 401', async () => {
    ctx = await setupTest()
    const jwt = (await import('jsonwebtoken')).default
    const expired = jwt.sign(
      { sub: randomUUID(), businessId: ctx.businessId, role: 'owner', email: 'x@x.com' },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1s', algorithm: 'HS256' },
    )
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${expired}` },
    })
    expect(res.statusCode).toBe(401)
  })
})
