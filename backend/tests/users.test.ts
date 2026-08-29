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

describe('GET /api/users', () => {
  it('owner melihat daftar user di bisnisnya sendiri', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.items.length).toBe(3)
    expect(body.total).toBe(3)
  })

  it('employee mendapat 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(403)
  })

  it('tanpa token mendapat 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users' })
    expect(res.statusCode).toBe(401)
  })

  it('mendukung pagination page/limit', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/users?page=2&limit=1',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.limit).toBe(1)
    expect(body.page).toBe(2)
    expect(body.items.length).toBe(1)
    expect(body.total).toBe(3)
    expect(body.has_more).toBe(true)
  })

  it('tidak pernah mengembalikan password_hash', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const body = res.json()
    for (const u of body.items) {
      expect(u.password_hash).toBeUndefined()
    }
  })
})

describe('POST /api/users', () => {
  it('owner membuat user employee baru', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.ownerToken),
      payload: { email: 'baru@demo.com', password: 'rahasia123', nama: 'Baru' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe('baru@demo.com')
    expect(res.json().user.role).toBe('employee')
    expect(res.json().user.password_hash).toBeUndefined()
  })

  it('owner membuat user dengan role owner', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.ownerToken),
      payload: { email: 'owner2@demo.com', password: 'rahasia123', nama: 'Owner 2', role: 'owner' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.role).toBe('owner')
  })

  it('duplikat email dalam bisnis yang sama → 409', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.ownerToken),
      payload: { email: 'siti@demo.com', password: 'rahasia123', nama: 'Dup' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('employee mendapat 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.employeeToken),
      payload: { email: 'x@demo.com', password: 'rahasia123', nama: 'X' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('PATCH /api/users/:id', () => {
  it('owner memperbarui role user', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'owner' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.role).toBe('owner')
  })

  it('owner tidak dapat menurunkan role dirinya sendiri → 400', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const me = list.json().items.find((u: { email: string }) => u.email === 'owner@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${me.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'employee' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('menurunkan owner terakhir → 400', async () => {
    ctx = await setupTest()
    // pastikan hanya satu owner: demote owner2 tidak ada, jadi owner saat ini adalah satu-satunya
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const me = list.json().items.find((u: { email: string }) => u.email === 'owner@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${me.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'employee' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('role tidak valid → 422', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'superadmin' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('owner menaikkan employee menjadi manager', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'manager' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.role).toBe('manager')
  })
})

describe('DELETE /api/users/:id (soft-delete)', () => {
  it('owner menonaktifkan user → { ok: true } dan status nonaktif', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    const after = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const updated = after.json().items.find((u: { id: string }) => u.id === target.id)
    expect(updated.status).toBe('nonaktif')
  })

  it('user nonaktif tidak bisa sign-in', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${target.id}`, headers: auth(ctx.ownerToken) })

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'siti@demo.com', password: 'demo123' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('tidak bisa menonaktifkan diri sendiri → 400', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const me = list.json().items.find((u: { email: string }) => u.email === 'owner@demo.com')
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${me.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('deaktivasi user mencabut sesi', () => {
  it('PATCH status nonaktif → sesi yang sudah terbit langsung ditolak', async () => {
    ctx = await setupTest()
    const signedIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'siti@demo.com', password: 'demo123' },
    })
    expect(signedIn.statusCode).toBe(200)
    const employeeToken = signedIn.json().token

    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'nonaktif' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.status).toBe('nonaktif')

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(employeeToken) })
    expect(me.statusCode).toBe(401)
  })

  it('DELETE (soft-delete) juga mencabut semua sesi user', async () => {
    ctx = await setupTest()
    const signedIn = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'siti@demo.com', password: 'demo123' },
    })
    const employeeToken = signedIn.json().token

    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${target.id}`, headers: auth(ctx.ownerToken) })

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(employeeToken) })
    expect(me.statusCode).toBe(401)
  })

  it('user nonaktif tidak bisa sign-in ulang', async () => {
    ctx = await setupTest()
    const list = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const target = list.json().items.find((u: { email: string }) => u.email === 'siti@demo.com')
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'nonaktif' },
    })

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'siti@demo.com', password: 'demo123' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('isolasi antar-bisnis', () => {
  it('owner tidak melihat user dari bisnis lain', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.ownerToken) })
    const emails = res.json().items.map((u: { email: string }) => u.email)
    expect(emails).not.toContain('oranglain@demo.com')
  })

  it('owner tidak dapat mengupdate user dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const { users } = await import('../src/db/schema.js')
    const { eq } = await import('drizzle-orm')
    const outsider = ctx.db.db.select().from(users).where(eq(users.email, 'oranglain@demo.com')).get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${outsider!.id}`,
      headers: auth(ctx.ownerToken),
      payload: { role: 'employee' },
    })
    expect(res.statusCode).toBe(404)
  })
})
