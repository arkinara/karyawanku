import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { leaveTypes, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('GET /api/leave-types', () => {
  it('seed default muncul saat pertama kali dipanggil (Tahunan 12/carry-over 5, Sakit, Izin, Melahirkan)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    const names = res.json().leave_types.map((t: { nama_jenis_cuti: string }) => t.nama_jenis_cuti)
    expect(names).toEqual(expect.arrayContaining(['Tahunan', 'Sakit', 'Izin', 'Melahirkan']))
    const tahunan = res.json().leave_types.find((t: { nama_jenis_cuti: string }) => t.nama_jenis_cuti === 'Tahunan')
    expect(tahunan.default_kuota_hari).toBe(12)
    expect(tahunan.kebijakan_sisa).toBe('carry-over')
    expect(tahunan.carry_over_max_days).toBe(5)
  })

  it('seed idempoten: pemanggilan kedua tidak menggandakan jenis cuti', async () => {
    ctx = await setupTest()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const second = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    expect(second.json().leave_types.length).toBe(4)
  })

  it('isolasi bisnis: hanya jenis cuti milik bisnis sendiri', async () => {
    ctx = await setupTest()
    ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'Milik Lain', default_kuota_hari: 2 })
      .run()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const names = res.json().leave_types.map((t: { nama_jenis_cuti: string }) => t.nama_jenis_cuti)
    expect(names).not.toContain('Milik Lain')
  })

  it('employee → 200 (employee dapat membaca jenis cuti untuk kebutuhan form pengajuan)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(200)
  })

  it('user dari bisnis lain (bisnis tidak dikenal) → 404', async () => {
    ctx = await setupTest()
    const { signToken } = await import('../src/lib/auth.js')
    ctx.db.sqlite.pragma('foreign_keys = OFF')
    const phantom = ctx.db.db
      .insert(users)
      .values({
        business_id: 'biz-tidak-ada',
        nama: 'Hantu Lintas Bisnis',
        email: 'hantu@demo.com',
        password_hash: 'x',
        role: 'owner',
      })
      .returning()
      .get()
    ctx.db.sqlite.pragma('foreign_keys = ON')
    const issued = await signToken({
      id: phantom.id,
      business_id: phantom.business_id,
      role: phantom.role,
      email: phantom.email,
    })
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(issued.accessToken) })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/leave-types', () => {
  it('membuat jenis cuti baru', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-types',
      headers: auth(ctx.ownerToken),
      payload: { nama_jenis_cuti: 'Menikah', default_kuota_hari: 2, kebijakan_sisa: 'hangus' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().leave_type.nama_jenis_cuti).toBe('Menikah')
    expect(res.json().leave_type.default_kuota_hari).toBe(2)
    expect(res.json().leave_type.aktif).toBe(true)
  })

  it('default_kuota_hari negatif → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-types',
      headers: auth(ctx.ownerToken),
      payload: { nama_jenis_cuti: 'X', default_kuota_hari: -3 },
    })
    expect(res.statusCode).toBe(422)
  })

  it('default_kuota_hari non-numeric → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-types',
      headers: auth(ctx.ownerToken),
      payload: { nama_jenis_cuti: 'X', default_kuota_hari: 'abc' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-types',
      headers: auth(ctx.employeeToken),
      payload: { nama_jenis_cuti: 'X', default_kuota_hari: 1 },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('PATCH /api/leave-types/:id', () => {
  it('memperbarui subset field', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/leave-types',
        headers: auth(ctx.ownerToken),
        payload: { nama_jenis_cuti: 'Menikah', default_kuota_hari: 2 },
      })
    ).json().leave_type
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-types/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { default_kuota_hari: 3 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().leave_type.default_kuota_hari).toBe(3)
    expect(res.json().leave_type.nama_jenis_cuti).toBe('Menikah')
  })

  it('jenis cuti dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'X', default_kuota_hari: 2 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-types/${outsider.id}`,
      headers: auth(ctx.ownerToken),
      payload: { default_kuota_hari: 9 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/leave-types/:id (soft-delete)', () => {
  it('menonaktifkan jenis cuti → { ok: true }, aktif=false, baris tetap ada', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/leave-types',
        headers: auth(ctx.ownerToken),
        payload: { nama_jenis_cuti: 'Menikah', default_kuota_hari: 2 },
      })
    ).json().leave_type
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/leave-types/${created.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const row = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.id, created.id)).get()
    expect(row?.aktif).toBe(false)
  })

  it('jenis cuti nonaktif tidak muncul di list', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/leave-types',
        headers: auth(ctx.ownerToken),
        payload: { nama_jenis_cuti: 'Menikah', default_kuota_hari: 2 },
      })
    ).json().leave_type
    await ctx.app.inject({ method: 'DELETE', url: `/api/leave-types/${created.id}`, headers: auth(ctx.ownerToken) })
    const list = await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const names = list.json().leave_types.map((t: { nama_jenis_cuti: string }) => t.nama_jenis_cuti)
    expect(names).not.toContain('Menikah')
  })

  it('jenis cuti dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'X', default_kuota_hari: 2 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/leave-types/${outsider.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})
