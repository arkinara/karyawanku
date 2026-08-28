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
  return res.json()
}

function sessionCount(): number {
  return (ctx.db.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n
}

describe('sessions — lifecycle', () => {
  it('sign-in membuat baris sesi baru', async () => {
    ctx = await setupTest()
    const before = sessionCount()
    const body = await signIn('owner@demo.com', 'owner123')
    expect(body.token).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(sessionCount()).toBe(before + 1)
  })

  it('sign-out mencabut sesi saat ini, sesi perangkat lain tetap aktif', async () => {
    ctx = await setupTest()
    const first = await signIn('owner@demo.com', 'owner123')
    const second = await signIn('owner@demo.com', 'owner123')

    const out = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: auth(first.token) })
    expect(out.statusCode).toBe(200)
    expect(out.json()).toEqual({ ok: true })

    const meOld = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(first.token) })
    expect(meOld.statusCode).toBe(401)
    const meOther = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(second.token) })
    expect(meOther.statusCode).toBe(200)
  })

  it('sign-out-all mencabut semua sesi user dan melaporkan jumlahnya', async () => {
    ctx = await setupTest()
    const first = await signIn('owner@demo.com', 'owner123')
    const second = await signIn('owner@demo.com', 'owner123')
    const third = await signIn('owner@demo.com', 'owner123')

    const out = await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out-all', headers: auth(second.token) })
    expect(out.statusCode).toBe(200)
    expect(out.json().ok).toBe(true)
    expect(out.json().sessions_revoked).toBeGreaterThanOrEqual(3)

    for (const t of [first, second, third]) {
      const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(t.token) })
      expect(me.statusCode).toBe(401)
    }
  })

  it('baris sesi yang dicabut tercatat revoked_at di DB', async () => {
    ctx = await setupTest()
    const { db } = ctx.db
    const { sessions } = await import('../src/db/schema.js')
    const body = await signIn('owner@demo.com', 'owner123')

    await ctx.app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: auth(body.token) })

    const rows = db.select().from(sessions).all()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.filter((s) => s.revoked_at !== null).length).toBe(1)
  })

  it('token dari user yang dinonaktifkan setelah terbit → 401', async () => {
    ctx = await setupTest()
    const body = await signIn('siti@demo.com', 'demo123')

    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().users.find((u: { email: string }) => u.email === 'siti@demo.com')
    const deactivate = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'nonaktif' },
    })
    expect(deactivate.statusCode).toBe(200)

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(body.token) })
    expect(me.statusCode).toBe(401)
  })
})