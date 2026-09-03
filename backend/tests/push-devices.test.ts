import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { pushDevices, users } from '../src/db/schema.js'
import { signToken } from '../src/lib/auth.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('POST /api/devices', () => {
  it('registers a device → 201 + device row', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android', app_version: '1.0.0' },
    })
    expect(res.statusCode).toBe(201)
    const device = res.json().device
    expect(device.id).toBeTruthy()
    expect(device.platform).toBe('android')
    expect(device.token).toBe('fcm-token-A')
    expect(device.app_version).toBe('1.0.0')

    const rows = ctx.db.db.select().from(pushDevices).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe(ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()!.id)
  })

  it('upsert pada (user_id, token): registrasi ulang tidak membuat baris ganda', async () => {
    ctx = await setupTest()
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android', app_version: '1.0.0' },
    })
    expect(first.statusCode).toBe(201)
    const id = first.json().device.id

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'ios', app_version: '1.1.0' },
    })
    expect(second.statusCode).toBe(201)
    expect(second.json().device.id).toBe(id)
    expect(second.json().device.platform).toBe('ios')

    const rows = ctx.db.db.select().from(pushDevices).all()
    expect(rows).toHaveLength(1)
  })

  it('validasi: token kosong → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: '', platform: 'android' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('validasi: platform tidak dikenal → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 't', platform: 'windows' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('tanpa auth → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      payload: { token: 't', platform: 'android' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/devices', () => {
  it('user switch: device milik employee A tidak muncul untuk user B', async () => {
    ctx = await setupTest()
    await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android' },
    })

    // User B: user employee lain dalam bisnis yang sama.
    const b = ctx.db.db
      .insert(users)
      .values({
        business_id: ctx.businessId,
        nama: 'Budi',
        email: 'budi@demo.com',
        password_hash: 'x',
        role: 'employee',
      })
      .returning()
      .get()
    const issued = await signToken({ id: b.id, business_id: b.business_id, role: b.role, email: b.email })

    const asB = await ctx.app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: auth(issued.accessToken),
    })
    expect(asB.statusCode).toBe(200)
    expect(asB.json().devices).toHaveLength(0)

    const asA = await ctx.app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
    })
    expect(asA.json().devices).toHaveLength(1)
  })
})

describe('DELETE /api/devices/:id', () => {
  it('owner-only: employee A tidak bisa menghapus device milik B', async () => {
    ctx = await setupTest()
    const b = ctx.db.db
      .insert(users)
      .values({
        business_id: ctx.businessId,
        nama: 'Budi',
        email: 'budi@demo.com',
        password_hash: 'x',
        role: 'employee',
      })
      .returning()
      .get()
    const issued = await signToken({ id: b.id, business_id: b.business_id, role: b.role, email: b.email })

    const regB = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(issued.accessToken),
      payload: { token: 'fcm-token-B', platform: 'ios' },
    })
    const idB = regB.json().device.id

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/devices/${idB}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
    expect(ctx.db.db.select().from(pushDevices).all()).toHaveLength(1)
  })

  it('pemilik menghapus device sendiri → 204 + baris hilang', async () => {
    ctx = await setupTest()
    const reg = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android' },
    })
    const id = reg.json().device.id

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/devices/${id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(204)
    expect(ctx.db.db.select().from(pushDevices).all()).toHaveLength(0)
  })
})

describe('POST /api/devices/:id/invalidate', () => {
  it('invalidasi menghapus device (FCM-UNREGISTERED callback) → 204', async () => {
    ctx = await setupTest()
    const reg = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android' },
    })
    const id = reg.json().device.id

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/devices/${id}/invalidate`,
      headers: auth(ctx.employeeToken),
      payload: { reason: 'messaging/registration-token-not-registered' },
    })
    expect(res.statusCode).toBe(204)
    expect(ctx.db.db.select().from(pushDevices).all()).toHaveLength(0)
  })

  it('employee tidak bisa invalidasi device milik user lain → 403', async () => {
    ctx = await setupTest()
    const b = ctx.db.db
      .insert(users)
      .values({
        business_id: ctx.businessId,
        nama: 'Budi',
        email: 'budi@demo.com',
        password_hash: 'x',
        role: 'employee',
      })
      .returning()
      .get()
    const issued = await signToken({ id: b.id, business_id: b.business_id, role: b.role, email: b.email })
    const reg = await ctx.app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: auth(ctx.employeeToken),
      payload: { token: 'fcm-token-A', platform: 'android' },
    })
    const id = reg.json().device.id

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/devices/${id}/invalidate`,
      headers: auth(issued.accessToken),
      payload: { reason: 'x' },
    })
    expect(res.statusCode).toBe(403)
  })
})