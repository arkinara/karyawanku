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
  return '4455667788' + String(400000 + i)
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

describe('POST /api/attendance/manual (owner upsert)', () => {
  it('membuat record baru → upserted true', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: emp.id,
        tanggal: '2026-06-05',
        clock_in: '2026-06-05T07:30:00.000Z',
        status: 'hadir',
        late_minutes: 0,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().upserted).toBe(true)
    expect(res.json().record.status).toBe('hadir')
  })

  it('upsert berdasar (employee_id, tanggal) → update record lama, upserted false', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'hadir' },
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'telat', late_minutes: 9 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().upserted).toBe(false)
    expect(res.json().record.status).toBe('telat')
    expect(res.json().record.late_minutes).toBe(9)
  })

  it('karyawan dari bisnis lain → 404', async () => {
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
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: outsider.id, tanggal: '2026-06-05', status: 'hadir' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('employee role mencoba manual → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'hadir' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('payload tidak valid (status bogus / no_ktp tak dikenali) → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'bogus' },
    })
    expect(res.statusCode).toBe(422)

    const missing = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.ownerToken),
      payload: { tanggal: '2026-06-05', status: 'hadir' },
    })
    expect(missing.statusCode).toBe(422)
  })
})

describe('GET /api/attendance/employee/:employeeId (date range)', () => {
  it('owner melihat list dengan filter ?start & ?end', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    ctx.db.db
      .insert(attendanceRecords)
      .values([
        { employee_id: emp.id, tanggal: '2026-06-01', status: 'hadir' },
        { employee_id: emp.id, tanggal: '2026-06-10', status: 'telat', late_minutes: 5 },
        { employee_id: emp.id, tanggal: '2026-07-01', status: 'hadir' },
      ])
      .run()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/employee/${emp.id}?start=2026-06-01&end=2026-06-30`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.length).toBe(2)
    expect(res.json().items.map((r: { tanggal: string }) => r.tanggal).sort()).toEqual([
      '2026-06-01',
      '2026-06-10',
    ])
  })

  it('employee melihat data sendiri, bukan data karyawan lain (403)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const other = await seedEmployee('Lain', 2)
    await linkEmployeeUser(emp.id)

    const self = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/employee/${emp.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(self.statusCode).toBe(200)

    const forbidden = await ctx.app.inject({
      method: 'GET',
      url: `/api/attendance/employee/${other.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(forbidden.statusCode).toBe(403)
  })
})

describe('PATCH /api/attendance/:id (owner correction)', () => {
  it('mengoreksi subset field record', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const created = ctx.db.db
      .insert(attendanceRecords)
      .values({ employee_id: emp.id, tanggal: '2026-06-05', status: 'hadir' })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'izin', catatan: 'sakit' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().record.status).toBe('izin')
    expect(res.json().record.catatan).toBe('sakit')
  })

  it('record milik karyawan bisnis lain → 404', async () => {
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
    const rec = ctx.db.db
      .insert(attendanceRecords)
      .values({ employee_id: outsider.id, tanggal: '2026-06-05', status: 'hadir' })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${rec.id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'telat' },
    })
    expect(res.statusCode).toBe(404)
  })
})
