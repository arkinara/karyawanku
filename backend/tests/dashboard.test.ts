import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  leaveRequests,
  leaveTypes,
  salaryComponents,
  shiftAssignments,
  shifts,
  users,
} from '../src/db/schema.js'

let ctx: TestCtx
let payslipTmp: string

beforeAll(() => {
  payslipTmp = mkdtempSync(join(tmpdir(), 'karyawanku-dashboard-'))
  process.env.PAYSLIP_DIR = payslipTmp
})

afterEach(() => {
  ctx?.cleanup()
})

afterAll(() => {
  rmSync(payslipTmp, { recursive: true, force: true })
  delete process.env.PAYSLIP_DIR
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '6655443322' + String(900000 + i)
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateOffset(n: number): string {
  return localDateStr(new Date(Date.now() + n * 86400000))
}

function monthOffset(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

async function seedEmployee(name: string, i: number, businessId = ctx.businessId) {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(i),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
      status: 'aktif',
    })
    .returning()
    .get()
}

async function linkEmployeeUser(employeeId: string) {
  await ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

async function seedShift(nama: string, jamMulai = '08:00', jamSelesai = '17:00') {
  return ctx.db.db
    .insert(shifts)
    .values({ business_id: ctx.businessId, nama_shift: nama, jam_mulai: jamMulai, jam_selesai: jamSelesai })
    .returning()
    .get()
}

async function seedShiftAssignment(employeeId: string, shiftId: string, tanggal: string, published = true) {
  return ctx.db.db
    .insert(shiftAssignments)
    .values({ employee_id: employeeId, shift_id: shiftId, tanggal, published })
    .returning()
    .get()
}

async function seedLeaveType(nama = 'Tahunan') {
  return ctx.db.db
    .insert(leaveTypes)
    .values({ business_id: ctx.businessId, nama_jenis_cuti: nama, default_kuota_hari: 12 })
    .returning()
    .get()
}

async function seedLeaveRequest(
  employeeId: string,
  leaveTypeId: string,
  tanggalMulai: string,
  status: 'pending' | 'disetujui' | 'ditolak' = 'pending',
  createdAt = new Date(),
) {
  return ctx.db.db
    .insert(leaveRequests)
    .values({
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalMulai,
      status,
      created_at: createdAt,
    })
    .returning()
    .get()
}

async function seedAttendance(employeeId: string, tanggal: string, status: string) {
  await ctx.db.db
    .insert(attendanceRecords)
    .values({ employee_id: employeeId, tanggal, status: status as typeof attendanceRecords.$inferSelect.status })
    .run()
}

async function seedComponent(name: string, nominal: number) {
  return ctx.db.db
    .insert(salaryComponents)
    .values({ business_id: ctx.businessId, nama_komponen: name, tipe: 'earning', nominal })
    .returning()
    .get()
}

async function assign(employeeId: string, componentId: string) {
  return ctx.db.db
    .insert(employeeSalaryAssignments)
    .values({ employee_id: employeeId, salary_component_id: componentId })
    .returning()
    .get()
}

async function createAndApprove(periode: string) {
  const created = await ctx.app.inject({
    method: 'POST',
    url: '/api/payroll-runs',
    headers: auth(ctx.ownerToken),
    payload: { periode },
  })
  expect(created.statusCode).toBe(201)
  const { run } = created.json()
  const approved = await ctx.app.inject({
    method: 'POST',
    url: `/api/payroll-runs/${run.id}/approve`,
    headers: auth(ctx.ownerToken),
  })
  expect(approved.statusCode).toBe(200)
  return run
}

describe('GET /api/dashboard — auth & scope', () => {
  it('tanpa token → 401', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/dashboard' })
    expect(res.statusCode).toBe(401)
  })

  it('owner melihat seluruh data bisnisnya', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    const shift = await seedShift('Pagi')
    await seedShiftAssignment(siti.id, shift.id, dateOffset(0))
    await seedShiftAssignment(budi.id, shift.id, dateOffset(1))
    await seedAttendance(siti.id, dateOffset(0), 'hadir')
    await seedAttendance(budi.id, dateOffset(0), 'telat')

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.today_attendance).toEqual({ hadir: 1, telat: 1, absen: 0, izin: 0 })
    expect(body.metrics.total_karyawan).toBe(2)
    expect(body.metrics.total_aktif).toBe(2)
    expect(body.upcoming_shifts).toHaveLength(2)
    expect(body.upcoming_shifts.map((s: { employee: { nama: string } }) => s.employee.nama).sort()).toEqual(['Budi', 'Siti'])
  })

  it('owner tidak melihat data bisnis lain', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const shift = await seedShift('Pagi')
    await seedShiftAssignment(siti.id, shift.id, dateOffset(0))
    await seedAttendance(siti.id, dateOffset(0), 'hadir')

    const outsider = await seedEmployee('Orang Lain', 99, ctx.otherBusinessId)
    await seedAttendance(outsider.id, dateOffset(0), 'hadir')
    const oShift = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .returning()
      .get()
    await seedShiftAssignment(outsider.id, oShift.id, dateOffset(0))

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.today_attendance).toEqual({ hadir: 1, telat: 0, absen: 0, izin: 0 })
    expect(body.upcoming_shifts).toHaveLength(1)
    expect(body.upcoming_shifts[0].employee.nama).toBe('Siti')
    expect(body.metrics.total_karyawan).toBe(1)
  })

  it('employee hanya melihat data sendiri & query param employee_id ditolak 403', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const shift = await seedShift('Pagi')
    await seedShiftAssignment(siti.id, shift.id, dateOffset(0))
    await seedShiftAssignment(budi.id, shift.id, dateOffset(1))
    await seedAttendance(siti.id, dateOffset(0), 'hadir')
    await seedAttendance(budi.id, dateOffset(0), 'telat')

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.my_today).toMatchObject({ status: 'hadir' })
    expect(body.upcoming_shifts).toHaveLength(1)

    const trick = await ctx.app.inject({
      method: 'GET',
      url: `/api/dashboard?employee_id=${budi.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(trick.statusCode).toBe(403)
  })

  it('bisnis tanpa data → payload kosong terstruktur, bukan 500', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    await linkEmployeeUser(siti.id)

    const ownerRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.ownerToken),
    })
    expect(ownerRes.statusCode).toBe(200)
    const ob = ownerRes.json()
    expect(ob.today_attendance).toEqual({ hadir: 0, telat: 0, absen: 0, izin: 0 })
    expect(ob.pending_leaves).toEqual([])
    expect(ob.upcoming_shifts).toEqual([])
    expect(ob.payroll_summary.current_month_total).toBe(0)
    expect(ob.payroll_summary.last_run_periode).toBeNull()

    const empRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.employeeToken),
    })
    expect(empRes.statusCode).toBe(200)
    const eb = empRes.json()
    expect(eb.my_today).toBeNull()
    expect(eb.upcoming_shifts).toEqual([])
    expect(eb.my_recent_payslips).toEqual([])
  })
})

describe('GET /api/dashboard — pending_leaves', () => {
  it('owner menerima 5 pengajuan pending terbaru, diputuskan tidak ikut', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const type = await seedLeaveType()
    for (let i = 0; i < 7; i++) {
      await seedLeaveRequest(siti.id, type.id, dateOffset(10 + i), 'pending', new Date(1700000000000 + i * 1000))
    }
    await seedLeaveRequest(siti.id, type.id, dateOffset(20), 'disetujui', new Date(1700000000000 + 999999))
    await seedLeaveRequest(siti.id, type.id, dateOffset(21), 'ditolak', new Date(1700000000000 + 999998))

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const leaves = res.json().pending_leaves
    expect(leaves).toHaveLength(5)
    expect(leaves.every((l: { leave_type: string }) => l.leave_type === 'Tahunan')).toBe(true)
    const createdAts = leaves.map((l: { created_at: Date }) => new Date(l.created_at).getTime())
    expect([...createdAts].sort((a, b) => b - a)).toEqual(createdAts)
  })
})

describe('GET /api/dashboard — upcoming_shifts', () => {
  it('hanya 3 hari ke depan & hanya published, untuk kedua role', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const shift = await seedShift('Pagi')
    await seedShiftAssignment(siti.id, shift.id, dateOffset(0))
    await seedShiftAssignment(siti.id, shift.id, dateOffset(1))
    await seedShiftAssignment(siti.id, shift.id, dateOffset(2))
    await seedShiftAssignment(siti.id, shift.id, dateOffset(3))
    await seedShiftAssignment(siti.id, shift.id, dateOffset(-1))
    await seedShiftAssignment(siti.id, shift.id, dateOffset(0), false)
    await seedShiftAssignment(budi.id, shift.id, dateOffset(1))

    const ownerRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.ownerToken),
    })
    const ownerShifts = ownerRes.json().upcoming_shifts
    expect(ownerShifts).toHaveLength(4)
    expect(ownerShifts.map((s: { tanggal: string }) => s.tanggal).sort()).toEqual(
      [dateOffset(0), dateOffset(1), dateOffset(1), dateOffset(2)].sort(),
    )

    const empRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.employeeToken),
    })
    const empShifts = empRes.json().upcoming_shifts
    expect(empShifts).toHaveLength(3)
    expect(empShifts.map((s: { tanggal: string }) => s.tanggal).sort()).toEqual(
      [dateOffset(0), dateOffset(1), dateOffset(2)].sort(),
    )
  })
})

describe('GET /api/dashboard — my_recent_payslips', () => {
  it('employee menerima 3 slip gaji terbaru, terbaru dulu', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    await linkEmployeeUser(siti.id)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(siti.id, gaji.id)

    for (const p of ['2025-01', '2025-02', '2025-03', '2025-04']) {
      await createAndApprove(p)
    }

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    const slips = res.json().my_recent_payslips
    expect(slips).toHaveLength(3)
    expect(slips.map((s: { periode: string }) => s.periode)).toEqual(['2025-04', '2025-03', '2025-02'])
    expect(slips.every((s: { take_home: number }) => typeof s.take_home === 'number')).toBe(true)
  })
})
