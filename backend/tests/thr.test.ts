import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  auditLogs,
  employees,
  employeeSalaryAssignments,
  salaryComponents,
  thrPayments,
  users,
} from '../src/db/schema.js'
import { computeThr } from '../src/lib/thr.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '7788990011' + String(100000 + ktpCounter)
}

async function seedEmployee(tanggal_masuk = '2024-01-01', name = 'Karyawan THR') {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk,
      jenis_kontrak: 'pkwt',
      status: 'aktif',
    })
    .returning()
    .get()
}

async function seedFixedSalary(employeeId: string, nominal: number, isFixed = true) {
  const comp = ctx.db.db
    .insert(salaryComponents)
    .values({
      business_id: ctx.businessId,
      nama_komponen: 'Gaji Pokok',
      tipe: 'earning',
      nominal,
      is_fixed: isFixed,
    })
    .returning()
    .get()
  await ctx.db.db
    .insert(employeeSalaryAssignments)
    .values({ employee_id: employeeId, salary_component_id: comp.id })
    .run()
  return comp
}

describe('computeThr — engine murni (Permenaker 6/2016)', () => {
  const fixed = (nama: string, nilai: number, is_fixed = true) => ({
    nama_komponen: nama,
    is_fixed,
    nilai,
  })

  it('masa kerja 12+ bulan → 1× basis upah (hanya komponen tetap)', () => {
    const r = computeThr(
      {
        tanggal_masuk: '2025-01-15',
        salaryComponents: [
          fixed('Gaji Pokok', 3_000_000),
          fixed('Tunjangan Transport', 500_000),
          fixed('Tunjangan Kehadiran', 300_000, false),
        ],
      },
      { referenceDate: '2026-09-01' },
    )
    expect(r.monthsOfService).toBeGreaterThanOrEqual(12)
    expect(r.eligible).toBe(true)
    expect(r.proportion).toBe(1)
    expect(r.basis).toBe(3_500_000)
    expect(r.amount).toBe(3_500_000)
  })

  it('masa kerja 6 bulan → 0.5× basis upah', () => {
    const r = computeThr(
      { tanggal_masuk: '2026-03-01', salaryComponents: [fixed('Gaji Pokok', 4_000_000)] },
      { referenceDate: '2026-09-01' },
    )
    expect(r.monthsOfService).toBe(6)
    expect(r.eligible).toBe(true)
    expect(r.proportion).toBe(0.5)
    expect(r.amount).toBe(2_000_000)
  })

  it('masa kerja 11 bulan → 11/12 basis upah', () => {
    const r = computeThr(
      { tanggal_masuk: '2025-10-01', salaryComponents: [fixed('Gaji Pokok', 3_600_000)] },
      { referenceDate: '2026-09-01' },
    )
    expect(r.monthsOfService).toBe(11)
    expect(r.eligible).toBe(true)
    expect(r.proportion).toBeCloseTo(11 / 12)
    expect(r.amount).toBe(3_300_000)
  })

  it('tanggal masuk di masa depan → 0', () => {
    const r = computeThr(
      { tanggal_masuk: '2027-01-01', salaryComponents: [fixed('Gaji Pokok', 3_000_000)] },
      { referenceDate: '2026-09-01' },
    )
    expect(r.eligible).toBe(false)
    expect(r.monthsOfService).toBe(0)
    expect(r.amount).toBe(0)
  })

  it('tanggal masuk null → 0', () => {
    const r = computeThr(
      { tanggal_masuk: null, salaryComponents: [fixed('Gaji Pokok', 3_000_000)] },
      { referenceDate: '2026-09-01' },
    )
    expect(r.eligible).toBe(false)
    expect(r.amount).toBe(0)
  })

  it('tanpa komponen tetap → 0, ditandai tidak berhak (bukan nihil)', () => {
    const r = computeThr(
      { tanggal_masuk: '2024-01-01', salaryComponents: [fixed('Bonus', 500_000, false)] },
      { referenceDate: '2026-09-01' },
    )
    expect(r.eligible).toBe(false)
    expect(r.basis).toBe(0)
    expect(r.amount).toBe(0)
  })
})

describe('POST /api/thr/calculate', () => {
  it('mengembalikan perhitungan + preview pencairan', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2026-03-01')
    await seedFixedSalary(emp.id, 4_000_000)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/calculate',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, periode: '2026', tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.calculation.amount).toBe(2_000_000)
    expect(body.calculation.basis).toBe(4_000_000)
    expect(body.calculation.monthsOfService).toBe(6)
    expect(body.disbursement_preview.amount).toBe(2_000_000)
    expect(body.disbursement_preview.periode).toBe('2026')
    expect(body.employee.nama_lengkap).toBe('Karyawan THR')
  })

  it('karyawan lintas bisnis → 404', async () => {
    ctx = await setupTest()
    const emp = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.otherBusinessId,
        nama_lengkap: 'Orang Lain',
        no_ktp: makeNoKtp(),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
        status: 'aktif',
      })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/calculate',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, periode: '2026', tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/thr/disburse', () => {
  it('menulis baris pembayaran + audit log; duplikat → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)
    const payload = { employee_id: emp.id, periode: '2026', tanggal_bayar: '2026-09-01' }

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.ownerToken),
      payload,
    })
    expect(res.statusCode).toBe(201)
    const payment = res.json().payment
    expect(payment.amount).toBe(3_000_000)
    expect(payment.basis).toBe(3_000_000)
    expect(payment.proportion).toBe(1)
    expect(payment.months_of_service).toBeGreaterThanOrEqual(12)
    expect(payment.periode).toBe('2026')
    expect(payment.employee.nama_lengkap).toBe('Karyawan THR')

    expect(ctx.db.db.select().from(thrPayments).all()).toHaveLength(1)

    const audit = ctx.db.db.select().from(auditLogs).all()
    expect(audit).toHaveLength(1)
    expect(audit[0].action).toBe('thr.disburse')
    expect(audit[0].entity_type).toBe('thr_payment')
    expect(audit[0].entity_id).toBe(payment.id)
    expect(audit[0].business_id).toBe(ctx.businessId)
    expect(audit[0].before).toBeNull()
    expect(audit[0].after).toMatchObject({
      employee_id: emp.id,
      periode: '2026',
      amount: 3_000_000,
    })

    const dup = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.ownerToken),
      payload,
    })
    expect(dup.statusCode).toBe(409)
    expect(ctx.db.db.select().from(thrPayments).all()).toHaveLength(1)
    expect(ctx.db.db.select().from(auditLogs).all()).toHaveLength(1)
  })

  it('manager tidak bisa disburse → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.managerToken),
      payload: { employee_id: emp.id, periode: '2026', tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(403)
    expect(ctx.db.db.select().from(thrPayments).all()).toHaveLength(0)
  })

  it('employee tidak bisa disburse → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, periode: '2026', tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('periode tidak valid → 422 tanpa baris audit', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, periode: '2026-08', tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(422)
    expect(ctx.db.db.select().from(thrPayments).all()).toHaveLength(0)
    expect(ctx.db.db.select().from(auditLogs).all()).toHaveLength(0)
  })
})

describe('GET /api/thr/payments', () => {
  async function disburse(employeeId: string, periode: string) {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/thr/disburse',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: employeeId, periode, tanggal_bayar: '2026-09-01' },
    })
    expect(res.statusCode).toBe(201)
  }

  it('owner melihat pembayaran bisnis sendiri + filter periode', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)
    await disburse(emp.id, '2026')
    await disburse(emp.id, '2025')

    const all = await ctx.app.inject({ method: 'GET', url: '/api/thr/payments', headers: auth(ctx.ownerToken) })
    expect(all.statusCode).toBe(200)
    expect(all.json().payments).toHaveLength(2)

    const filtered = await ctx.app.inject({
      method: 'GET',
      url: '/api/thr/payments?periode=2025',
      headers: auth(ctx.ownerToken),
    })
    expect(filtered.json().payments).toHaveLength(1)
    expect(filtered.json().payments[0].periode).toBe('2025')
    expect(filtered.json().payments[0].employee.nama_lengkap).toBe('Karyawan THR')
  })

  it('tidak melihat pembayaran bisnis lain', async () => {
    ctx = await setupTest()
    const otherUser = ctx.db.db.select().from(users).where(eq(users.email, 'oranglain@demo.com')).get()!
    const otherEmp = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.otherBusinessId,
        nama_lengkap: 'Orang Lain',
        no_ktp: makeNoKtp(),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
        status: 'aktif',
      })
      .returning()
      .get()
    ctx.db.db
      .insert(thrPayments)
      .values({
        employee_id: otherEmp.id,
        business_id: ctx.otherBusinessId,
        periode: '2026',
        tanggal_bayar: '2026-09-01',
        amount: 1_000_000,
        basis: 1_000_000,
        months_of_service: 12,
        proportion: 1,
        created_by: otherUser.id,
      })
      .run()

    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)
    await disburse(emp.id, '2026')

    const res = await ctx.app.inject({ method: 'GET', url: '/api/thr/payments', headers: auth(ctx.ownerToken) })
    expect(res.json().payments).toHaveLength(1)
    expect(res.json().payments[0].employee.nama_lengkap).toBe('Karyawan THR')
  })

  it('manager & employee bisa membaca daftar (role apa pun)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)
    await disburse(emp.id, '2026')

    const managerRes = await ctx.app.inject({ method: 'GET', url: '/api/thr/payments', headers: auth(ctx.managerToken) })
    expect(managerRes.statusCode).toBe(200)
    expect(managerRes.json().payments).toHaveLength(1)

    const empRes = await ctx.app.inject({ method: 'GET', url: '/api/thr/payments', headers: auth(ctx.employeeToken) })
    expect(empRes.statusCode).toBe(200)
    expect(empRes.json().payments).toHaveLength(1)
  })

  it('GET /thr/payments/:id mengembalikan detail', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2024-01-01')
    await seedFixedSalary(emp.id, 3_000_000)
    await disburse(emp.id, '2026')

    const listed = ctx.db.db.select().from(thrPayments).all()
    expect(listed).toHaveLength(1)
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/thr/payments/${listed[0].id}`,
      headers: auth(ctx.managerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().payment.id).toBe(listed[0].id)
    expect(res.json().payment.amount).toBe(3_000_000)
  })
})