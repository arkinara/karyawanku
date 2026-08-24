import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, shiftAssignments, shifts } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('GET /api/shifts', () => {
  it('owner membuat lalu melihat shift milik bisnisnya', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shifts',
        headers: auth(ctx.ownerToken),
        payload: { nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' },
      })
    ).json().shift
    expect(created.nama_shift).toBe('Pagi')
    expect(created.aktif).toBe(true)

    const res = await ctx.app.inject({ method: 'GET', url: '/api/shifts', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    const list = res.json().shifts
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(created.id)
    expect(list[0].nama_shift).toBe('Pagi')
  })

  it('isolasi bisnis: tidak melihat shift bisnis lain', async () => {
    ctx = await setupTest()
    ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .run()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/shifts', headers: auth(ctx.ownerToken) })
    expect(res.json().shifts.length).toBe(0)
  })

  it('soft-deleted shift tidak muncul default, muncul dengan includeInactive=true', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shifts',
        headers: auth(ctx.ownerToken),
        payload: { nama_shift: 'Siang', jam_mulai: '12:00', jam_selesai: '20:00' },
      })
    ).json().shift
    await ctx.app.inject({ method: 'DELETE', url: `/api/shifts/${created.id}`, headers: auth(ctx.ownerToken) })

    const active = await ctx.app.inject({ method: 'GET', url: '/api/shifts', headers: auth(ctx.ownerToken) })
    expect(active.json().shifts.length).toBe(0)

    const all = await ctx.app.inject({ method: 'GET', url: '/api/shifts?includeInactive=true', headers: auth(ctx.ownerToken) })
    expect(all.json().shifts.length).toBe(1)
    expect(all.json().shifts[0].aktif).toBe(false)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/shifts', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/shifts', () => {
  it('menolak nama_shift di luar pagi/siang/malam/libur', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: auth(ctx.ownerToken),
      payload: { nama_shift: 'Lembur', jam_mulai: '07:00', jam_selesai: '15:00' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('menolak jam_selesai lebih awal dari jam_mulai', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: auth(ctx.ownerToken),
      payload: { nama_shift: 'Pagi', jam_mulai: '15:00', jam_selesai: '07:00' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('menolak format jam tidak valid', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: auth(ctx.ownerToken),
      payload: { nama_shift: 'Pagi', jam_mulai: '7:00', jam_selesai: '15:00' },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('PATCH /api/shifts/:id', () => {
  it('memperbarui subset field', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shifts',
        headers: auth(ctx.ownerToken),
        payload: { nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' },
      })
    ).json().shift
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/shifts/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { jam_mulai: '06:30' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().shift.jam_mulai).toBe('06:30')
    expect(res.json().shift.nama_shift).toBe('Pagi')
  })

  it('shift dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/shifts/${outsider.id}`,
      headers: auth(ctx.ownerToken),
      payload: { jam_mulai: '19:00' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/shifts/:id (soft-delete)', () => {
  it('set aktif=false, baris tetap ada, assignment tetap referensikan shift', async () => {
    ctx = await setupTest()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shifts',
        headers: auth(ctx.ownerToken),
        payload: { nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' },
      })
    ).json().shift

    const emp = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.businessId,
        nama_lengkap: 'Siti',
        no_ktp: '1234567890123',
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'P',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
      })
      .returning()
      .get()
    ctx.db.db
      .insert(shiftAssignments)
      .values({ employee_id: emp.id, shift_id: created.id, tanggal: '2026-08-25', published: false })
      .run()

    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/shifts/${created.id}`, headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    const row = ctx.db.db.select().from(shifts).where(eq(shifts.id, created.id)).get()
    expect(row?.aktif).toBe(false)

    const assignment = ctx.db.db.select().from(shiftAssignments).where(eq(shiftAssignments.shift_id, created.id)).get()
    expect(assignment?.id).toBeTruthy()
  })

  it('shift dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .returning()
      .get()
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/shifts/${outsider.id}`, headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(404)
  })
})