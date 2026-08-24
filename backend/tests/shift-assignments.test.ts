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
  return '9988776655' + String(300000 + i)
}

async function seedEmployee(name = 'Siti', ktpIdx = 1): Promise<{ id: string }> {
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

async function seedShift(nama: string, jamMulai = '08:00', jamSelesai = '17:00') {
  return ctx.db.db
    .insert(shifts)
    .values({ business_id: ctx.businessId, nama_shift: nama, jam_mulai: jamMulai, jam_selesai: jamSelesai })
    .returning()
    .get()
}

describe('POST /api/shift-assignments', () => {
  it('owner membuat assignment dengan published default false', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignment.published).toBe(false)
    expect(res.json().assignment.employee_name).toBe('Siti')
    expect(res.json().assignment.shift.nama_shift).toBe('Pagi')
  })

  it('tanggal tidak valid → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-02-30' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('karyawan dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const shift = await seedShift('Pagi')
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
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: outsider.id, shift_id: shift.id, tanggal: '2026-08-25' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('shift dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const outsider = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: outsider.id, tanggal: '2026-08-25' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/shift-assignments', () => {
  it('owner melihat semua assignment di bisnisnya dalam rentang', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift('Pagi')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25', published: true },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-09-01' },
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignments.length).toBe(1)
    expect(res.json().assignments[0].tanggal).toBe('2026-08-25')
  })

  it('employee hanya melihat assignment miliknya sendiri', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const other = await seedEmployee('Budi', 2)
    const shift = await seedShift('Pagi')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25', published: true },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: other.id, shift_id: shift.id, tanggal: '2026-08-26', published: true },
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.employeeToken),
    })
    expect(res.json().assignments.length).toBe(1)
    expect(res.json().assignments[0].employee_id).toBe(emp.id)
  })

  it('employee tidak pernah melihat draft (published=false)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const shift = await seedShift('Pagi')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25', published: true },
    })
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-26' },
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/shift-assignments?start=2026-08-01&end=2026-08-31',
      headers: auth(ctx.employeeToken),
    })
    expect(res.json().assignments.length).toBe(1)
    expect(res.json().assignments[0].tanggal).toBe('2026-08-25')
  })

  it('employee tidak bisa menipu employee_id query param', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const other = await seedEmployee('Budi', 2)
    const shift = await seedShift('Pagi')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/shift-assignments',
      headers: auth(ctx.ownerToken),
      payload: { employee_id: other.id, shift_id: shift.id, tanggal: '2026-08-26', published: true },
    })

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/shift-assignments?employee_id=${other.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.json().assignments.length).toBe(0)
  })
})

describe('PATCH /api/shift-assignments/:id', () => {
  it('owner memperbarui subset field', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shift-assignments',
        headers: auth(ctx.ownerToken),
        payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25' },
      })
    ).json().assignment
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/shift-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { published: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignment.published).toBe(true)
    expect(res.json().assignment.tanggal).toBe('2026-08-25')
  })

  it('assignment dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.otherBusinessId,
        nama_lengkap: 'Orang Lain',
        no_ktp: makeNoKtp(98),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'L',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
      })
      .returning()
      .get()
    const oshift = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.otherBusinessId, nama_shift: 'Malam', jam_mulai: '18:00', jam_selesai: '02:00' })
      .returning()
      .get()
    const assignment = ctx.db.db
      .insert(shiftAssignments)
      .values({ employee_id: outsider.id, shift_id: oshift.id, tanggal: '2026-08-25' })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/shift-assignments/${assignment.id}`,
      headers: auth(ctx.ownerToken),
      payload: { published: true },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/shift-assignments/:id', () => {
  it('owner menghapus draft assignment', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shift-assignments',
        headers: auth(ctx.ownerToken),
        payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25' },
      })
    ).json().assignment
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/shift-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const row = ctx.db.db.select().from(shiftAssignments).where(eq(shiftAssignments.id, created.id)).get()
    expect(row).toBeUndefined()
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = await seedShift('Pagi')
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/shift-assignments',
        headers: auth(ctx.ownerToken),
        payload: { employee_id: emp.id, shift_id: shift.id, tanggal: '2026-08-25' },
      })
    ).json().assignment
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/shift-assignments/${created.id}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})