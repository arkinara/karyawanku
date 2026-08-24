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
  payrollRuns,
  payslips,
  salaryComponents,
  users,
} from '../src/db/schema.js'
import { getPayslipDir } from '../src/lib/payslip-store.js'

let ctx: TestCtx
let payslipTmp: string

beforeAll(() => {
  payslipTmp = mkdtempSync(join(tmpdir(), 'karyawanku-payslip-'))
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
  return '9988776655' + String(700000 + i)
}

async function seedEmployee(name: string, i: number) {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(i),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'L',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
      status: 'aktif',
    })
    .returning()
    .get()
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

async function createRun(periode = '2026-08') {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/payroll-runs',
    headers: auth(ctx.ownerToken),
    payload: { periode },
  })
  expect(res.statusCode).toBe(201)
  return res.json() as { run: { id: string; status: string }; items: Array<{ id: string; take_home: number }> }
}

describe('PATCH /api/payroll-items/:id', () => {
  it('owner menambah koreksi → take_home bertambah sesuai koreksi', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { items } = await createRun()
    const item = items[0]

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/payroll-items/${item.id}`,
      headers: auth(ctx.ownerToken),
      payload: { koreksi: 200_000, catatan_koreksi: 'Lembur minggu pertama' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.koreksi).toBe(200_000)
    expect(body.take_home).toBe(item.take_home + 200_000)
    expect(body.catatan_koreksi).toBe('Lembur minggu pertama')
  })

  it('koreksi negatif mengurangi take_home', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { items } = await createRun()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/payroll-items/${items[0].id}`,
      headers: auth(ctx.ownerToken),
      payload: { koreksi: -50_000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().take_home).toBe(items[0].take_home - 50_000)
  })

  it('edit item setelah approve → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { run, items } = await createRun()
    const approved = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(approved.statusCode).toBe(200)

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/payroll-items/${items[0].id}`,
      headers: auth(ctx.ownerToken),
      payload: { koreksi: 100_000 },
    })
    expect(res.statusCode).toBe(409)
  })

  it('karyawan (non-owner) → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    const { items } = await createRun()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/payroll-items/${items[0].id}`,
      headers: auth(ctx.employeeToken),
      payload: { koreksi: 100_000 },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/payroll-runs/:id/approve', () => {
  it('transisi draft → disetujui, set audit fields, generate payslips', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { run, items } = await createRun()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.run.status).toBe('disetujui')
    expect(body.run.approved_at).toBeTruthy()
    expect(body.run.approved_by_user_id).toBeTruthy()

    const storedRun = ctx.db.db.select().from(payrollRuns).where(eq(payrollRuns.id, run.id)).get()
    expect(storedRun?.status).toBe('disetujui')
    expect(storedRun?.approved_by_user_id).toBeTruthy()

    const slips = ctx.db.db.select().from(payslips).all()
    expect(slips).toHaveLength(1)
    expect(slips[0].payroll_item_id).toBe(items[0].id)
    expect(slips[0].pdf_url).toBeTruthy()
    expect(existsSync(slips[0].pdf_url as string)).toBe(true)
  })

  it('re-approve run yang sudah disetujui → 409 dan tidak menduplikasi payslips', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { run } = await createRun()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    const second = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(second.statusCode).toBe(409)
    expect(ctx.db.db.select().from(payslips).all()).toHaveLength(1)
  })

  it('karyawan tidak boleh approve → 403', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    const { run } = await createRun()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/payroll-runs/:id/lock', () => {
  it('kunci run yang sudah disetujui → status locked', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await assign(emp.id, gaji.id)
    await seedAttendance(emp.id, '2026-08-01')

    const { run, items } = await createRun()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    const lock = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/lock`,
      headers: auth(ctx.ownerToken),
    })
    expect(lock.statusCode).toBe(200)
    expect(lock.json().run.status).toBe('locked')

    const edit = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/payroll-items/${items[0].id}`,
      headers: auth(ctx.ownerToken),
      payload: { koreksi: 100_000 },
    })
    expect(edit.statusCode).toBe(409)

    const reapprove = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(reapprove.statusCode).toBe(409)
  })

  it('kunci run yang masih draft → 409', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    const { run } = await createRun()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/payroll-runs/${run.id}/lock`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(409)
  })
})
