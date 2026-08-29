import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, shiftAssignments, shifts, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '3344556677' + String(400000 + i)
}

async function seedEmployee(name = 'Siti', ktpIdx = 1, businessId?: string): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: businessId ?? ctx.businessId,
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

async function seedShift(businessId?: string): Promise<{ id: string }> {
  return ctx.db.db
    .insert(shifts)
    .values({ business_id: businessId ?? ctx.businessId, nama_shift: 'Pagi', jam_mulai: '08:00', jam_selesai: '17:00' })
    .returning()
    .get()
}

async function createDraft(empId: string, shiftId: string, tanggal: string) {
  return ctx.db.db
    .insert(shiftAssignments)
    .values({ employee_id: empId, shift_id: shiftId, tanggal, published: false })
    .returning()
    .get()
}

describe('POST /api/roster/publish', () => {
  it('publish via assignment_ids: semua jadi published=true, audit terisi', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift()
    const a = await createDraft(emp.id, shift.id, '2026-08-24')
    const b = await createDraft(emp.id, shift.id, '2026-08-25')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id, b.id] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().updated).toBe(2)
    expect(res.json().published_at).toBeTruthy()
    expect(res.json().published_by_user_id).toBeTruthy()

    const rowA = ctx.db.db.select().from(shiftAssignments).where(eq(shiftAssignments.id, a.id)).get()
    expect(rowA?.published).toBe(true)
    expect(rowA?.published_at).toBeTruthy()
    expect(rowA?.published_by_user_id).toBeTruthy()
  })

  it('publish via rentang tanggal: seluruh bisnis scoped, hanya draft di rentang', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift()
    await createDraft(emp.id, shift.id, '2026-08-24')
    await createDraft(emp.id, shift.id, '2026-08-25')
    await createDraft(emp.id, shift.id, '2026-09-01')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { start: '2026-08-01', end: '2026-08-31' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().updated).toBe(2)

    const all = ctx.db.db.select().from(shiftAssignments).all()
    expect(all.filter((r) => r.published).length).toBe(2)
    expect(all.find((r) => r.tanggal === '2026-09-01')?.published).toBe(false)
  })

  it('publish via rentang + employee_ids terbatas ke karyawan tsb', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti', 1)
    const other = await seedEmployee('Budi', 2)
    const shift = await seedShift()
    await createDraft(emp.id, shift.id, '2026-08-24')
    await createDraft(other.id, shift.id, '2026-08-24')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { start: '2026-08-01', end: '2026-08-31', employee_ids: [emp.id] },
    })
    expect(res.json().updated).toBe(1)
  })

  it('assignment sudah published → no-op, bukan error', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift()
    const a = await createDraft(emp.id, shift.id, '2026-08-24')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    const again = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    expect(again.statusCode).toBe(200)
    expect(again.json().updated).toBe(1)
  })

  it('assignment dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = await seedEmployee('Orang Lain', 99, ctx.otherBusinessId)
    const oshift = await seedShift(ctx.otherBusinessId)
    const a = await createDraft(outsider.id, oshift.id, '2026-08-24')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    expect(res.statusCode).toBe(404)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.employeeToken),
      payload: { assignment_ids: ['x'] },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/roster/unpublish', () => {
  it('membalik published=true → false, audit field dipertahankan', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift()
    const a = await createDraft(emp.id, shift.id, '2026-08-24')

    await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/unpublish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().updated).toBe(1)

    const row = ctx.db.db.select().from(shiftAssignments).where(eq(shiftAssignments.id, a.id)).get()
    expect(row?.published).toBe(false)
    expect(row?.published_at).toBeTruthy()
    expect(row?.published_by_user_id).toBeTruthy()
  })
})

describe('unpublish → employee tidak lagi melihat', () => {
  it('employee melihat assignment setelah publish, hilang setelah unpublish', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift()
    const a = await createDraft(emp.id, shift.id, '2026-08-24')

    const before = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.employeeToken),
    })
    expect(before.json().items.length).toBe(0)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    const after = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.employeeToken),
    })
    expect(after.json().items.length).toBe(1)

    await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/unpublish',
      headers: auth(ctx.ownerToken),
      payload: { assignment_ids: [a.id] },
    })
    const afterUnpublish = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.employeeToken),
    })
    expect(afterUnpublish.json().items.length).toBe(0)
  })
})

describe('GET /api/shift-assignments/upcoming', () => {
  it('employee hanya melihat published miliknya 3 hari ke depan', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift()

    const today = new Date()
    const inRange = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const far = new Date(Date.now() + 10 * 86400000)
    const farStr = `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, '0')}-${String(far.getDate()).padStart(2, '0')}`

    const draft = await createDraft(emp.id, shift.id, inRange)
    const publishedFar = await createDraft(emp.id, shift.id, farStr)
    ctx.db.db.update(shiftAssignments).set({ published: true }).where(eq(shiftAssignments.id, publishedFar.id)).run()

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments/upcoming',
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignments.length).toBe(0)

    ctx.db.db.update(shiftAssignments).set({ published: true }).where(eq(shiftAssignments.id, draft.id)).run()
    const res2 = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments/upcoming',
      headers: auth(ctx.employeeToken),
    })
    expect(res2.json().assignments.length).toBe(1)
    expect(res2.json().assignments[0].employee_id).toBe(emp.id)
  })
})