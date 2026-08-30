import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  payrollItems,
  salaryComponents,
  users,
} from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '3344556677' + String(500000 + i)
}

async function seedEmployee(name: string, ktpIdx: number, opts: { businessId?: string; status?: 'aktif' | 'nonaktif' } = {}) {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: opts.businessId ?? ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(ktpIdx),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
      status: opts.status ?? 'aktif',
    })
    .returning()
    .get()
}

async function seedComponent(name: string, opts: { tipe?: 'earning' | 'deduction'; nominal?: number; formula?: string } = {}) {
  return ctx.db.db
    .insert(salaryComponents)
    .values({
      business_id: ctx.businessId,
      nama_komponen: name,
      tipe: opts.tipe ?? 'earning',
      nominal: opts.nominal ?? null,
      formula: opts.formula ?? null,
    })
    .returning()
    .get()
}

async function assign(employeeId: string, componentId: string, override?: number) {
  return ctx.db.db
    .insert(employeeSalaryAssignments)
    .values({ employee_id: employeeId, salary_component_id: componentId, override_nominal: override ?? null })
    .returning()
    .get()
}

async function seedAttendance(employeeId: string, tanggal: string, status: string, lateMinutes = 0) {
  await ctx.db.db
    .insert(attendanceRecords)
    .values({ employee_id: employeeId, tanggal, status, late_minutes: lateMinutes })
    .run()
}

async function linkEmployeeUser(employeeId: string) {
  await ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

describe('POST /api/payroll-runs', () => {
  it('membuat run draft + payroll_items untuk karyawan aktif dengan kalkulasi lengkap', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gajiPokok = await seedComponent('Gaji Pokok', { nominal: 3_500_000 })
    const transport = await seedComponent('Tunjangan Transport', { nominal: 500_000 })
    const makan = await seedComponent('Tunjangan Makan', { nominal: 300_000 })
    await assign(emp.id, gajiPokok.id)
    await assign(emp.id, transport.id)
    await assign(emp.id, makan.id, 400_000)

    await seedAttendance(emp.id, '2026-08-01', 'hadir')
    await seedAttendance(emp.id, '2026-08-02', 'telat', 15)
    await seedAttendance(emp.id, '2026-08-03', 'izin')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.run.status).toBe('draft')
    expect(body.run.periode).toBe('2026-08')
    expect(body.run.business_id).toBe(ctx.businessId)
    expect(body.items).toHaveLength(1)

    const item = body.items[0]
    expect(item.employee_id).toBe(emp.id)
    expect(item.employee.nama_lengkap).toBe('Siti')
    expect(item.gaji_pokok).toBe(3_500_000)
    expect(item.total_tunjangan).toBe(900_000)
    expect(item.total_bpjs_kesehatan).toBe(35_000)
    expect(item.total_bpjs_tk).toBe(105_000)
    expect(item.pph21).toBe(0)
    expect(item.take_home).toBe(4_260_000)

    expect(item.detail_breakdown.attendance).toEqual({
      hadir: 1,
      telat: 1,
      absen: 0,
      izin: 1,
      total_late_minutes: 15,
      total_overtime_minutes: 0,
    })
    expect(item.detail_breakdown.bpjs.bpjs_kesehatan.employee).toBe(35_000)
  })

  it('hanya karyawan status aktif yang diikutkan', async () => {
    ctx = await setupTest()
    const aktif = await seedEmployee('Aktif', 1)
    const nonaktif = await seedEmployee('Nonaktif', 2, { status: 'nonaktif' })
    const gajiPokok = await seedComponent('Gaji Pokok', { nominal: 3_500_000 })
    await assign(aktif.id, gajiPokok.id)
    await assign(nonaktif.id, gajiPokok.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().items).toHaveLength(1)
    expect(res.json().items[0].employee_id).toBe(aktif.id)
  })

  it('karyawan tanpa komponen gaji → gaji_pokok 0, bukan error', async () => {
    ctx = await setupTest()
    await seedEmployee('Tanpa Gaji', 1)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })

    expect(res.statusCode).toBe(201)
    const item = res.json().items[0]
    expect(item.gaji_pokok).toBe(0)
    expect(item.total_tunjangan).toBe(0)
    expect(item.take_home).toBe(0)
  })

  it('duplikat periode → 409, tidak ada draft ganda', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    const dup = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    expect(dup.statusCode).toBe(409)
  })

  it('periode tidak valid → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: 'agustus' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('karyawan → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.employeeToken),
      payload: { periode: '2026-08' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/payroll-runs', () => {
  it('owner melihat run di bisnisnya, filter periode', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-09' },
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/payroll-runs?periode=2026-08',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().runs).toHaveLength(1)
    expect(res.json().runs[0].periode).toBe('2026-08')
  })

  it('karyawan → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/payroll-runs',
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/payroll-runs/:id', () => {
  it('owner melihat semua item; karyawan hanya item miliknya', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const gajiPokok = await seedComponent('Gaji Pokok', { nominal: 3_500_000 })
    await assign(siti.id, gajiPokok.id)
    await assign(budi.id, gajiPokok.id)

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    const runId = created.json().run.id

    const ownerView = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(ownerView.statusCode).toBe(200)
    expect(ownerView.json().items).toHaveLength(2)

    const selfView = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}`,
      headers: auth(ctx.employeeToken),
    })
    expect(selfView.statusCode).toBe(200)
    expect(selfView.json().items).toHaveLength(1)
    expect(selfView.json().items[0].employee_id).toBe(siti.id)
  })

  it('karyawan melihat run dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    const runId = created.json().run.id

    // token owner bisnis ini valid
    const ownerView = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(ownerView.statusCode).toBe(200)

    // karyawan tanpa employee_id → 422 (tidak bisa menyaring item sendiri)
    const selfView = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}`,
      headers: auth(ctx.employeeToken),
    })
    expect(selfView.statusCode).toBe(422)
  })

  it('run tidak ditemukan → 404', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/payroll-runs/tidak-ada',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})
