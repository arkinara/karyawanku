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
import { composePayslipBreakdown } from '../src/lib/payslip-breakdown.js'
import { generatePayslipPDF } from '../src/lib/payslip-pdf.js'
import type { PayrollItem } from '../src/db/schema.js'

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

async function seedComponentFull(
  name: string,
  opts: { tipe?: 'earning' | 'deduction'; nominal?: number; formula?: string | null } = {},
) {
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

async function seedStandardEmployee() {
  const siti = await seedEmployee('Siti', 1)
  await linkEmployeeUser(siti.id)
  const gaji = await seedComponent('Gaji Pokok', 3_500_000)
  const transport = await seedComponent('Tunjangan Transport', 400_000)
  const makan = await seedComponent('Tunjangan Makan', 750_000)
  await assign(siti.id, gaji.id)
  await assign(siti.id, transport.id)
  await assign(siti.id, makan.id)
  await seedAttendance(siti.id, '2026-08-01')
  await createAndApprove()
  const slip = ctx.db.db.select().from(payslips).get()
  return { siti, slip }
}

describe('GET /api/payslips/:id', () => {
  it('mengembalikan breakdown lengkap: minimal 3 earnings + 3 deductions utk karyawan standar', async () => {
    ctx = await setupTest()
    const { slip } = await seedStandardEmployee()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${slip.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.id).toBe(slip.id)
    expect(body.payroll_item_id).toBe(slip.payroll_item_id)
    expect(body.employee.nama).toBe('Siti')
    expect(body.periode).toBe('2026-08')
    expect(body.pdf_url).toBe(`/api/payslips/${slip.id}/download`)

    const earnings = body.breakdown.earnings
    const deductions = body.breakdown.deductions
    expect(earnings.length).toBeGreaterThanOrEqual(3)
    expect(deductions.length).toBeGreaterThanOrEqual(3)

    const earningNames = earnings.map((l: { nama_komponen: string }) => l.nama_komponen)
    expect(earningNames).toContain('Gaji Pokok')
    expect(earningNames).toContain('Tunjangan Transport')
    expect(earningNames).toContain('Tunjangan Makan')

    const deductionNames = deductions.map((l: { nama_komponen: string }) => l.nama_komponen)
    expect(deductionNames).toContain('BPJS Kesehatan')
    expect(deductionNames).toContain('BPJS Ketenagakerjaan')
    expect(deductionNames).toContain('PPh 21')

    const gajiPokok = earnings.find((l: { nama_komponen: string }) => l.nama_komponen === 'Gaji Pokok')
    expect(gajiPokok.nominal).toBe(3_500_000)
    expect(gajiPokok.formula).toBeNull()
  })

  it('nilai breakdown konsisten dgn payroll_item: total_earnings - total_deductions ≈ take_home (±1 IDR)', async () => {
    ctx = await setupTest()
    const { slip } = await seedStandardEmployee()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${slip.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const item = ctx.db.db.select().from(payrollItems).where(eq(payrollItems.id, slip.payroll_item_id)).get()
    expect(item).toBeTruthy()

    expect(body.totals.take_home).toBe(item.take_home)
    const diff = Math.abs(body.totals.total_earnings - body.totals.total_deductions - item.take_home)
    expect(diff).toBeLessThanOrEqual(1)
  })

  it('karyawan tak bisa lihat payslip karyawan lain → 403', async () => {
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
    const budiSlip = ctx.db.db.select().from(payslips).where(eq(payslips.payroll_item_id, budiItem.id)).get()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${budiSlip.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('akses lintas-bisnis → 404 (bukan 200 data kosong)', async () => {
    ctx = await setupTest()
    const { slip } = await seedStandardEmployee()
    const { signToken } = await import('../src/lib/auth.js')
    const crossUser = ctx.db.db.select().from(users).where(eq(users.business_id, ctx.otherBusinessId)).get()
    expect(crossUser).toBeTruthy()
    const crossToken = signToken({
      sub: crossUser.id,
      businessId: ctx.otherBusinessId,
      role: crossUser.role,
      email: crossUser.email,
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payslips/${slip.id}`,
      headers: auth(crossToken),
    })
    expect(res.statusCode).toBe(404)
  })

  it('payslip id tidak ada → 404', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/payslips/tidak-ada-id',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PDF breakdown', () => {
  it('PDF tetap valid dan ukuran bertambah saat breakdown diisi', async () => {
    const base: PayrollItem = {
      id: 'item-1',
      payroll_run_id: 'run-1',
      employee_id: 'emp-1',
      gaji_pokok: 3_500_000,
      total_tunjangan: 1_150_000,
      total_bpjs_kesehatan: 35_000,
      total_bpjs_tk: 105_000,
      pph21: 0,
      take_home: 4_510_000,
      koreksi: 0,
      catatan_koreksi: null,
      detail_breakdown: null,
    }
    const withBreakdown: PayrollItem = {
      ...base,
      detail_breakdown: JSON.stringify({
        komponen_gaji_pokok: [
          { komponen: 'Gaji Pokok', override_nominal: null, nominal: 3_500_000, formula: null, nilai: 3_500_000 },
        ],
        komponen_tunjangan: [
          { komponen: 'Tunjangan Transport', override_nominal: null, nominal: 400_000, formula: null, nilai: 400_000 },
          { komponen: 'Tunjangan Makan', override_nominal: null, nominal: 750_000, formula: null, nilai: 750_000 },
        ],
        komponen_potongan: [],
      }),
    }
    const opts = { employee: null, business: null, periode: '2026-08' }
    const bufPlain = await generatePayslipPDF({ payrollItem: base, ...opts })
    const bufBreakdown = await generatePayslipPDF({ payrollItem: withBreakdown, ...opts })

    expect(bufPlain.slice(0, 5).toString('latin1')).toBe('%PDF-')
    expect(bufBreakdown.slice(0, 5).toString('latin1')).toBe('%PDF-')
    expect(bufBreakdown.length).toBeGreaterThan(bufPlain.length)
  })
})

describe('composePayslipBreakdown', () => {
  const base: PayrollItem = {
    id: 'item-1',
    payroll_run_id: 'run-1',
    employee_id: 'emp-1',
    gaji_pokok: 3_500_000,
    total_tunjangan: 1_150_000,
    total_bpjs_kesehatan: 35_000,
    total_bpjs_tk: 105_000,
    pph21: 0,
    take_home: 4_510_000,
    koreksi: 0,
    catatan_koreksi: null,
    detail_breakdown: null,
  }

  it('detail_breakdown null → earnings/deductions baris komponen kosong, take_home dari item', () => {
    const result = composePayslipBreakdown(base)
    expect(result.earnings).toEqual([])
    expect(result.deductions).toHaveLength(3)
    expect(result.deductions.map((l) => l.nama_komponen)).toEqual([
      'BPJS Kesehatan',
      'BPJS Ketenagakerjaan',
      'PPh 21',
    ])
    expect(result.totals.take_home).toBe(4_510_000)
    expect(result.totals.total_earnings).toBe(0)
    expect(result.totals.total_deductions).toBe(140_000)
  })

  it('array kosong → total nol tanpa crash', () => {
    const item: PayrollItem = {
      ...base,
      detail_breakdown: JSON.stringify({
        komponen_gaji_pokok: [],
        komponen_tunjangan: [],
        komponen_potongan: [],
      }),
    }
    const result = composePayslipBreakdown(item)
    expect(result.earnings).toEqual([])
    expect(result.totals.total_earnings).toBe(0)
    expect(result.totals.take_home).toBe(4_510_000)
  })

  it('menggabungkan gaji pokok + tunjangan ke earnings, menghormati formula baris', () => {
    const item: PayrollItem = {
      ...base,
      detail_breakdown: JSON.stringify({
        komponen_gaji_pokok: [
          { komponen: 'Gaji Pokok', override_nominal: null, nominal: 3_500_000, formula: null, nilai: 3_500_000 },
        ],
        komponen_tunjangan: [
          { komponen: 'Tunjangan Makan', override_nominal: null, nominal: 750_000, formula: 'hadir * 25000', nilai: 750_000 },
        ],
        komponen_potongan: [
          { komponen: 'Potongan Lain', override_nominal: null, nominal: 50_000, formula: null, nilai: 50_000 },
        ],
      }),
    }
    const result = composePayslipBreakdown(item)
    expect(result.earnings).toHaveLength(2)
    expect(result.earnings[1]).toEqual({
      nama_komponen: 'Tunjangan Makan',
      nominal: 750_000,
      formula: 'hadir * 25000',
    })
    const potongan = result.deductions.find((l) => l.nama_komponen === 'Potongan Lain')
    expect(potongan).toBeTruthy()
    expect(result.totals.total_deductions).toBe(140_000 + 50_000)
  })
})
