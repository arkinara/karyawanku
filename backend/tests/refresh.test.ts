import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function signIn(email: string, password: string) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    payload: { email, password },
  })
  expect(res.statusCode).toBe(200)
  return res.json()
}

describe('POST /api/auth/refresh', () => {
  it('refresh token valid → access token baru bekerja, sesi lama dicabut', async () => {
    ctx = await setupTest()
    const body = await signIn('owner@demo.com', 'owner123')

    const meBefore = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(body.token) })
    expect(meBefore.statusCode).toBe(200)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: body.refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const refreshed = res.json()
    expect(refreshed.accessToken).toBeTruthy()
    expect(refreshed.refreshToken).toBeTruthy()
    expect(refreshed.refreshToken).not.toBe(body.refreshToken)

    const meAfter = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(refreshed.accessToken) })
    expect(meAfter.statusCode).toBe(200)
    expect(meAfter.json().user.email).toBe('owner@demo.com')
  })

  it('menggunakan ulang refresh token lama (sudah dirotasi) → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('owner@demo.com', 'owner123')

    await ctx.app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refresh_token: body.refreshToken } })
    const again = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: body.refreshToken },
    })
    expect(again.statusCode).toBe(401)
  })

  it('refresh setelah sign-out → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('owner@demo.com', 'owner123')
    await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: auth(body.token) })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: body.refreshToken },
    })
    expect(res.statusCode).toBe(401)
  })

  it('access token tidak bisa dipakai sebagai refresh token → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('owner@demo.com', 'owner123')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: body.token },
    })
    expect(res.statusCode).toBe(401)
  })

  it('refresh token tidak bisa dipakai untuk /auth/me → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('owner@demo.com', 'owner123')
    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(body.refreshToken) })
    expect(me.statusCode).toBe(401)
  })

  it('token dgn secret berbeda ditolak → 401', async () => {
    ctx = await setupTest()
    const jwt = (await import('jsonwebtoken')).default
    const forged = jwt.sign(
      { sub: ctx.businessId, businessId: ctx.businessId, role: 'owner', email: 'x@x.com', jti: 'x', sid: 'x', type: 'refresh' },
      'different-secret',
      { expiresIn: '7d', algorithm: 'HS256' },
    )
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refresh_token: forged } })
    expect(res.statusCode).toBe(401)
  })
})