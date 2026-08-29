import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, shifts, shiftAssignments, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '2233445566' + String(200000 + i)
}

function at(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0).toISOString()
}

async function seedEmployee(name = 'X', ktpIdx = 1): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(ktpIdx),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function linkEmployeeUser(employeeId: string) {
  ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

async function seedShift(employeeId: string, tanggal: string, jamMulai = '08:00') {
  const shift = ctx.db.db
    .insert(shifts)
    .values({ business_id: ctx.businessId, nama_shift: 'Pagi', jam_mulai: jamMulai, jam_selesai: '17:00' })
    .returning()
    .get()
  ctx.db.db
    .insert(shiftAssignments)
    .values({ employee_id: employeeId, shift_id: shift.id, tanggal })
    .run()
  return shift
}

describe('POST /api/attendance/clock-in', () => {
  it('clock-in sebelum shift → status hadir, late_minutes 0 (offline flush, waktu aksi asli)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await seedShift(emp.id, '2026-07-15', '08:00')
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.status).toBe('hadir')
    expect(res.json().record.late_minutes).toBe(0)
    expect(res.json().record.tanggal).toBe('2026-07-15')
    expect(res.json().record.clock_in).toBe(at('2026-07-15', '07:45'))
    expect(res.json().record.submission_method).toBe('offline_queue')
  })

  it('clock-in setelah shift → status telat, late_minutes dihitung dari waktu aksi asli', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await seedShift(emp.id, '2026-07-15', '08:00')
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '08:10') },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.status).toBe('telat')
    expect(res.json().record.late_minutes).toBe(10)
    expect(res.json().record.clock_in).toBe(at('2026-07-15', '08:10'))
  })

  it('tanpa shift assignment → fallback default 08:00, tidak crash', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '08:30') },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.status).toBe('telat')
    expect(res.json().record.late_minutes).toBe(30)
    expect(res.json().schedule_start).toBe('08:00')
  })

  it('double clock-in hari sama → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const payload = { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') }
    await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload,
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { ...payload, client_timestamp: at('2026-07-15', '07:46') },
    })
    expect(res.statusCode).toBe(409)
  })

  it('employee mencoba clock-in untuk karyawan lain → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const other = await seedEmployee('Lain', 2)
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: other.id, client_timestamp: at('2026-07-15', '07:45') },
    })
    expect(res.statusCode).toBe(403)
  })

  it('client_timestamp di masa depan (di luar batas) → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { client_timestamp: future },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('POST /api/attendance/clock-out', () => {
  it('clock-out setelah clock-in → clock_out tercatat (waktu aksi asli)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:00') },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.clock_out).toBe(at('2026-07-15', '17:00'))
    expect(res.json().record.status).toBe('hadir')
    expect(res.json().record.submission_method).toBe('offline_queue')
  })

  it('clock-out tanpa clock-in sebelumnya → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:00') },
    })
    expect(res.statusCode).toBe(409)
  })

  it('double clock-out → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:00') },
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-out',
      headers: auth(ctx.employeeToken),
      payload: { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:05') },
    })
    expect(res.statusCode).toBe(409)
  })
})