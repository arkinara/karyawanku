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

  it('email yang dipakai bisnis lain → 409 dan tidak membuat bisnis', async () => {
    ctx = await setupTest()
    const count = () =>
      (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get() as { n: number }).n
    const before = count()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: 'Dup', email: 'owner@demo.com', password: 'rahasia123', namaBisnis: 'Bisnis Lain' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.message).toContain('Email sudah terdaftar')
    expect(count()).toBe(before)
  })

  it('email belum terpakai → tepat satu bisnis + satu user owner', async () => {
    ctx = await setupTest()
    const count = (sql: string) =>
      (ctx.db.sqlite.prepare(sql).get() as { n: number }).n
    const beforeBusiness = count('SELECT COUNT(*) AS n FROM businesses')
    const beforeUser = count('SELECT COUNT(*) AS n FROM users')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      payload: { nama: 'Friska', email: 'friska@demo.com', password: 'rahasia123', namaBisnis: 'Bisnis Baru' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.business_id).toBeTruthy()
    expect(count('SELECT COUNT(*) AS n FROM businesses')).toBe(beforeBusiness + 1)
    expect(count('SELECT COUNT(*) AS n FROM users')).toBe(beforeUser + 1)
    expect(
      count("SELECT COUNT(*) AS n FROM users WHERE email = 'friska@demo.com' AND role = 'owner'"),
    ).toBe(1)
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

  it('pesan 401 generik — tidak membocorkan apakah email terdaftar', async () => {
    ctx = await setupTest()
    const wrongPw = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'owner@demo.com', password: 'salah' },
    })
    const noEmail = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'tidak-ada@demo.com', password: 'salah' },
    })
    expect(wrongPw.statusCode).toBe(401)
    expect(noEmail.statusCode).toBe(401)
    expect(wrongPw.json().error.message).toBe(noEmail.json().error.message)
    expect(wrongPw.json().error.message).toContain('Email atau kata sandi salah')
  })

  it('token di-scope ke business_id user yang bersangkutan', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'owner@demo.com', password: 'owner123' },
    })
    expect(res.statusCode).toBe(200)
    const { verifyToken } = await import('../src/lib/auth.js')
    const payload = await verifyToken(res.json().token)
    expect(payload.businessId).toBe(ctx.businessId)
    expect(payload.sub).toBeTruthy()
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
  it('tanpa token → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out' })
    expect(res.statusCode).toBe(401)
  })

  it('mencabut sesi saat ini → token lama tidak bisa dipakai lagi', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { authorization: `Bearer ${ctx.ownerToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${ctx.ownerToken}` },
    })
    expect(me.statusCode).toBe(401)
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
