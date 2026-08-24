import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { attendanceRecords, employees, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '3344556677' + String(300000 + i)
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

function insert(employeeId: string, tanggal: string, status: 'hadir' | 'telat' | 'absen' | 'izin', late = 0) {
  ctx.db.db
    .insert(attendanceRecords)
    .values({ employee_id: employeeId, tanggal, status, late_minutes: late, clock_in: `${tanggal}T07:00:00.000Z` })
    .run()
}

describe('GET /api/attendance/aggregate/:employeeId', () => {
  it('monthly counts benar (20 hadir, 2 telat, 1 absen + total late)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    for (let i = 1; i <= 20; i++) insert(emp.id, `2026-06-${String(i).padStart(2, '0')}`, 'hadir')
    insert(emp.id, '2026-06-21', 'telat', 5)
    insert(emp.id, '2026-06-22', 'telat', 10)
    insert(emp.id, '2026-06-23', 'absen')

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-06`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hadir: 20, telat: 2, absen: 1, izin: 0, total_late_minutes: 15 })
  })

  it('periode tanpa record → zeroed, bukan error', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-03`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hadir: 0, telat: 0, absen: 0, izin: 0, total_late_minutes: 0 })
  })

  it('manual correction (status) tercermin di aggregate berikutnya', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    insert(emp.id, '2026-06-01', 'hadir')
    insert(emp.id, '2026-06-02', 'hadir')

    const before = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-06`,
      headers: auth(ctx.ownerToken),
    })
    expect(before.json().hadir).toBe(2)

    const manual = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-02', status: 'telat', late_minutes: 7 },
    })
    expect(manual.statusCode).toBe(200)

    const after = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-06`,
      headers: auth(ctx.ownerToken),
    })
    expect(after.json().hadir).toBe(1)
    expect(after.json().telat).toBe(1)
    expect(after.json().total_late_minutes).toBe(7)
  })

  it('employee hanya melihat data sendiri → akses karyawan lain 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const other = await seedEmployee('Lain', 2)
    await linkEmployeeUser(emp.id)
    insert(emp.id, '2026-06-01', 'hadir')
    insert(other.id, '2026-06-02', 'hadir')

    const self = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026-06`,
      headers: auth(ctx.employeeToken),
    })
    expect(self.statusCode).toBe(200)
    expect(self.json().hadir).toBe(1)

    const forbidden = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${other.id}?period=2026-06`,
      headers: auth(ctx.employeeToken),
    })
    expect(forbidden.statusCode).toBe(403)
  })

  it('scoped ke bisnis → karyawan bisnis lain 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.otherBusinessId,
        nama_lengkap: 'Orang Lain',
        no_ktp: makeNoKtp(99),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
      })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${outsider.id}?period=2026-06`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })

  it('period tidak valid → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/aggregate/${emp.id}?period=2026`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(422)
  })
})
