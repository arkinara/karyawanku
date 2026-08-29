import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { DEFAULT_LIMIT, MAX_LIMIT, paginateResult, parsePagination } from '../src/lib/pagination.js'
import {
  attendanceRecords,
  employees,
  leaveRequests,
  leaveTypes,
  payslips,
  payrollItems,
  payrollRuns,
  shiftAssignments,
  shifts,
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
  return '2233445566' + String(700000 + i)
}

async function seedEmployee(i: number): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: `Karyawan ${i}`,
      no_ktp: makeNoKtp(i),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'L',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function seedNEmployees(n: number): Promise<Array<{ id: string }>> {
  const out: Array<{ id: string }> = []
  for (let i = 1; i <= n; i++) out.push(await seedEmployee(i))
  return out
}

async function seedAttendance(employeeId: string, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) {
    ctx.db.db
      .insert(attendanceRecords)
      .values({ employee_id: employeeId, tanggal: `2026-08-0${i}`, status: 'hadir' })
      .run()
  }
}

async function seedLeaveTypeId(): Promise<string> {
  await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
  const type = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.business_id, ctx.businessId)).get()
  return type!.id
}

async function seedLeaveRequests(employeeId: string, n: number): Promise<void> {
  const typeId = await seedLeaveTypeId()
  for (let i = 1; i <= n; i++) {
    ctx.db.db
      .insert(leaveRequests)
      .values({
        employee_id: employeeId,
        leave_type_id: typeId,
        tanggal_mulai: `2026-09-0${i}`,
        tanggal_selesi: `2026-09-0${i}`,
        status: 'pending',
      })
      .run()
  }
}

async function seedShiftAndAssignments(employeeId: string, n: number): Promise<void> {
  const shift = ctx.db.db
    .insert(shifts)
    .values({ business_id: ctx.businessId, nama_shift: 'Pagi', jam_mulai: '08:00', jam_selesai: '17:00' })
    .returning()
    .get()
  for (let i = 1; i <= n; i++) {
    ctx.db.db
      .insert(shiftAssignments)
      .values({ employee_id: employeeId, shift_id: shift.id, tanggal: `2026-10-0${i}` })
      .run()
  }
}

async function seedPayslips(employeeIds: Array<{ id: string }>): Promise<void> {
  const run = ctx.db.db
    .insert(payrollRuns)
    .values({ business_id: ctx.businessId, periode: '2026-08', status: 'locked' })
    .returning()
    .get()
  for (const emp of employeeIds) {
    const item = ctx.db.db
      .insert(payrollItems)
      .values({ payroll_run_id: run.id, employee_id: emp.id, take_home: 3_500_000 })
      .returning()
      .get()
    ctx.db.db
      .insert(payslips)
      .values({ payroll_item_id: item.id, pdf_url: `data/payslips/${item.id}.pdf` })
      .run()
  }
}

function assertPage(body: {
  total: number
  page: number
  limit: number
  has_more: boolean
  items: unknown[]
}, total: number, page: number, limit: number, hasMore: boolean): void {
  expect(body.total).toBe(total)
  expect(body.page).toBe(page)
  expect(body.limit).toBe(limit)
  expect(body.has_more).toBe(hasMore)
}

async function assertPaging(url: string, total: number): Promise<void> {
  const p1 = (await ctx.app.inject({ method: 'GET', url: `${url}${url.includes('?') ? '&' : '?'}page=1&limit=2`, headers: auth(ctx.ownerToken) })).json()
  assertPage(p1, total, 1, 2, total > 2)
  expect(p1.items.length).toBe(Math.min(2, total))

  const p2 = (await ctx.app.inject({ method: 'GET', url: `${url}${url.includes('?') ? '&' : '?'}page=2&limit=2`, headers: auth(ctx.ownerToken) })).json()
  assertPage(p2, total, 2, 2, total > 4)
  expect(p2.items.length).toBe(Math.max(0, Math.min(2, total - 2)))

  const p3 = (await ctx.app.inject({ method: 'GET', url: `${url}${url.includes('?') ? '&' : '?'}page=3&limit=2`, headers: auth(ctx.ownerToken) })).json()
  assertPage(p3, total, 3, 2, total > 6)
  expect(p3.items.length).toBe(Math.max(0, Math.min(2, total - 4)))
}

describe('parsePagination', () => {
  it('default values tanpa query', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination(undefined)).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('invalid page/limit → defaults', () => {
    expect(parsePagination({ page: 0 })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ page: -1 })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ page: 'abc' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ limit: 0 })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ limit: -5 })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ limit: 'abc' })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
    expect(parsePagination({ page: 1.5 })).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('limit > max → capped at MAX_LIMIT', () => {
    expect(parsePagination({ limit: 500 }).limit).toBe(MAX_LIMIT)
    expect(parsePagination({ limit: '500' }).limit).toBe(MAX_LIMIT)
    expect(parsePagination({ limit: 100 }).limit).toBe(100)
  })

  it('valid values pass through', () => {
    expect(parsePagination({ page: 2, limit: 10 })).toEqual({ page: 2, limit: 10 })
  })
})

describe('paginateResult', () => {
  it('has_more benar berdasarkan total vs halaman saat ini', () => {
    expect(paginateResult([1, 2], 5, { page: 1, limit: 2 }).has_more).toBe(true)
    expect(paginateResult([1, 2], 4, { page: 2, limit: 2 }).has_more).toBe(false)
    expect(paginateResult([1], 5, { page: 3, limit: 2 }).has_more).toBe(false)
    expect(paginateResult([], 0, { page: 1, limit: DEFAULT_LIMIT }).has_more).toBe(false)
  })

  it('total count match database count', () => {
    const res = paginateResult([1], 5, { page: 1, limit: 20 })
    expect(res.total).toBe(5)
    expect(res.items).toEqual([1])
  })
})

describe('GET /api/employees pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1, has_more benar', async () => {
    ctx = await setupTest()
    await seedNEmployees(5)
    await assertPaging('/api/employees', 5)
  })

  it('total sesuai jumlah baris di DB', async () => {
    ctx = await setupTest()
    await seedNEmployees(3)
    const res = (await ctx.app.inject({ method: 'GET', url: '/api/employees?page=1&limit=2', headers: auth(ctx.ownerToken) })).json()
    expect(res.total).toBe(3)
    const dbCount = ctx.db.db.select().from(employees).where(eq(employees.business_id, ctx.businessId)).all().length
    expect(res.total).toBe(dbCount)
  })
})

describe('GET /api/users pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1', async () => {
    ctx = await setupTest()
    for (let i = 0; i < 2; i++) {
      ctx.db.db
        .insert(users)
        .values({ business_id: ctx.businessId, email: `user-extra-${i}@demo.com`, password_hash: 'x', nama: `Ekstra ${i}` })
        .run()
    }
    await assertPaging('/api/users', 5)
  })
})

describe('GET /api/attendance/employee/:employeeId pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee(1)
    await seedAttendance(emp.id, 5)
    await assertPaging(`/api/attendance/employee/${emp.id}`, 5)
  })
})

describe('GET /api/leave-requests pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee(1)
    await seedLeaveRequests(emp.id, 5)
    await assertPaging('/api/leave-requests', 5)
  })
})

describe('GET /api/shift-assignments pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee(1)
    await seedShiftAndAssignments(emp.id, 5)
    await assertPaging('/api/shift-assignments', 5)
  })
})

describe('GET /api/payslips pagination', () => {
  it('page 1 → first 2, page 2 → next 2, page 3 → sisa 1', async () => {
    ctx = await setupTest()
    const emps = await seedNEmployees(5)
    await seedPayslips(emps)
    await assertPaging('/api/payslips', 5)
  })
})