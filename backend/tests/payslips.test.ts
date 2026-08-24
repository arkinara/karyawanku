import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  payrollItems,
  payslips,
  salaryComponents,
  users,
} from '../src/db/schema.js'

let ctx: TestCtx
let payslipTmp: string

beforeAll(() => {
  payslipTmp = mkdtempSync(join(tmpdir(), 'karyawanku-payslips-'))
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
  return '1122334455' + String(800000 + i)
}

async function seedEmployee(name: string, i: number) {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
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

async function seedAttendance(employeeId: string, tanggal: string) {
  await ctx.db.db
    .insert(attendanceRecords)
    .values({ employee_id: employeeId, tanggal, status: 'hadir' })
    .run()
}

async function createAndApprove(periode = '2026-08') {
  const created = await ctx.app.inject({
    method: 'POST',
    url: '/api/payroll-runs',
    headers: auth(ctx.ownerToken),
    payload: { periode },
  })
  expect(created.statusCode).toBe(201)
  const { run, items } = created.json()
  const approved = await ctx.app.inject({
    method: 'POST',
    url: `/api/payroll-runs/${run.id}/approve`,
    headers: auth(ctx.ownerToken),
  })
  expect(approved.statusCode).toBe(200)
  return { run, items }
}

describe('GET /api/payslips', () => {
  it('owner melihat semua payslip di bisnis; karyawan hanya miliknya', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(siti.id, gaji.id)
    await assign(budi.id, gaji.id)
    await seedAttendance(siti.id, '2026-08-01')

    await createAndApprove()

    const ownerRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/payslips',
      headers: auth(ctx.ownerToken),
    })
    expect(ownerRes.statusCode).toBe(200)
    expect(ownerRes.json().payslips).toHaveLength(2)

    const empRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/payslips',
      headers: auth(ctx.employeeToken),
    })
    expect(empRes.statusCode).toBe(200)
    expect(empRes.json().payslips).toHaveLength(1)
    expect(empRes.json().payslips[0].employee.id).toBe(siti.id)
  })
})

describe('GET /api/payslips/employee/:employeeId', () => {
  it('owner melihat payslip karyawan lain; karyawan hanya boleh milik sendiri', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(siti.id, gaji.id)
    await assign(budi.id, gaji.id)
    await seedAttendance(siti.id, '2026-08-01')

    await createAndApprove()

    const ownerRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/employee/${budi.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(ownerRes.statusCode).toBe(200)
    expect(ownerRes.json().payslips).toHaveLength(1)
    expect(ownerRes.json().payslips[0].employee.id).toBe(budi.id)

    const empOther = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/employee/${budi.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(empOther.statusCode).toBe(403)

    const empSelf = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/employee/${siti.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(empSelf.statusCode).toBe(200)
  })
})

describe('GET /api/payslips/:id/download', () => {
  it('mengembalikan PDF valid (%PDF-), file tersimpan di disk', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    await linkEmployeeUser(siti.id)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(siti.id, gaji.id)
    await seedAttendance(siti.id, '2026-08-01')

    await createAndApprove()

    const slip = ctx.db.db.select().from(payslips).get()
    expect(slip).toBeTruthy()
    expect(existsSync(slip.pdf_url as string)).toBe(true)

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${slip.id}/download`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('.pdf')
    const buf = res.rawPayload
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('karyawan mencoba unduh payslip karyawan lain → 403', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    await linkEmployeeUser(siti.id)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(siti.id, gaji.id)
    await assign(budi.id, gaji.id)
    await seedAttendance(siti.id, '2026-08-01')

    await createAndApprove()

    const budiItem = ctx.db.db
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.employee_id, budi.id))
      .get()
    expect(budiItem).toBeTruthy()
    const slip = ctx.db.db.select().from(payslips).where(eq(payslips.payroll_item_id, budiItem.id)).get()
    expect(slip).toBeTruthy()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${slip.id}/download`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})
