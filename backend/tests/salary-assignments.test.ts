import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { eq } from 'drizzle-orm'
import { employeeSalaryAssignments, employees, salaryComponents, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '1234567890' + String(100000 + i)
}

async function seedEmployee(): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: 'Siti Karyawan',
      no_ktp: makeNoKtp(1),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function seedComponent(nama = 'Tunjangan Transport'): Promise<{ id: string; nominal: number }> {
  return ctx.db.db
    .insert(salaryComponents)
    .values({ business_id: ctx.businessId, nama_komponen: nama, tipe: 'earning', nominal: 500000 })
    .returning()
    .get()
}

describe('POST /api/employees/:employeeId/salary-assignments', () => {
  it('menugaskan komponen dengan override_nominal → tersimpan, override berlaku', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id, override_nominal: 750000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignment.override_nominal).toBe(750000)
    expect(res.json().assignment.aktif).toBe(true)
  })

  it('menugaskan tanpa override → default nominal komponen dipakai (nilai_efektif)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
    })
    const assignment = list.json().assignments[0]
    expect(assignment.override_nominal).toBeNull()
    expect(assignment.nilai_efektif).toBe(500000)
    expect(assignment.component.nominal).toBe(500000)
  })

  it('duplikat penugasan aktif komponen sama → 409', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    expect(res.statusCode).toBe(409)
  })

  it('komponen dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const outsider = ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'Lain', tipe: 'earning', nominal: 100 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: outsider.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('karyawan dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const comp = await seedComponent()
    const outsiderEmp = ctx.db.db
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
      url: `/api/employees/${outsiderEmp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('override_nominal negatif → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id, override_nominal: -10 },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('GET /api/employees/:employeeId/salary-assignments', () => {
  it('owner melihat penugasan aktif + detail komponen', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignments.length).toBe(1)
    expect(res.json().assignments[0].component.nama_komponen).toBe('Tunjangan Transport')
  })

  it('karyawan dapat melihat penugasan miliknya sendiri', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    await ctx.app.inject({
      method: 'POST',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
      payload: { salary_component_id: comp.id },
    })
    ctx.db.db.update(users).set({ employee_id: emp.id }).where(eq(users.email, 'siti@demo.com')).run()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().assignments.length).toBe(1)
  })

  it('karyawan tidak dapat melihat penugasan karyawan lain → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('karyawan dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsiderEmp = ctx.db.db
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
      method: 'GET',
      url: `/api/employees/${outsiderEmp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })

  it('?includeInactive=true ikut menampilkan penugasan nonaktif', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: `/api/employees/${emp.id}/salary-assignments`,
        headers: auth(ctx.ownerToken),
        payload: { salary_component_id: comp.id },
      })
    ).json().assignment
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { aktif: false },
    })

    const active = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments`,
      headers: auth(ctx.ownerToken),
    })
    expect(active.json().assignments.length).toBe(0)

    const all = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${emp.id}/salary-assignments?includeInactive=true`,
      headers: auth(ctx.ownerToken),
    })
    expect(all.json().assignments.length).toBe(1)
  })
})

describe('PATCH /api/salary-assignments/:id', () => {
  it('memperbarui override_nominal & toggle aktif', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: `/api/employees/${emp.id}/salary-assignments`,
        headers: auth(ctx.ownerToken),
        payload: { salary_component_id: comp.id, override_nominal: 700000 },
      })
    ).json().assignment

    const off = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { aktif: false },
    })
    expect(off.json().assignment.aktif).toBe(false)
    expect(off.json().assignment.override_nominal).toBe(700000)

    const up = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
      payload: { override_nominal: 800000, aktif: true },
    })
    expect(up.json().assignment.override_nominal).toBe(800000)
    expect(up.json().assignment.aktif).toBe(true)
  })

  it('penugasan milik karyawan bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsiderEmp = ctx.db.db
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
    const outsiderComp = ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'Lain', tipe: 'earning', nominal: 100 })
      .returning()
      .get()
    const assignment = ctx.db.db
      .insert(employeeSalaryAssignments)
      .values({ employee_id: outsiderEmp.id, salary_component_id: outsiderComp.id })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/salary-assignments/${assignment.id}`,
      headers: auth(ctx.ownerToken),
      payload: { aktif: false },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/salary-assignments/:id (soft-delete)', () => {
  it('menonaktifkan penugasan → { ok: true } dan aktif=false', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const comp = await seedComponent()
    const created = (
      await ctx.app.inject({
        method: 'POST',
        url: `/api/employees/${emp.id}/salary-assignments`,
        headers: auth(ctx.ownerToken),
        payload: { salary_component_id: comp.id },
      })
    ).json().assignment

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/salary-assignments/${created.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    const row = ctx.db.db.select().from(employeeSalaryAssignments).where(eq(employeeSalaryAssignments.id, created.id)).get()
    expect(row?.aktif).toBe(false)
    expect(row?.override_nominal).toBeNull()
  })

  it('penugasan milik karyawan bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsiderEmp = ctx.db.db
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
    const outsiderComp = ctx.db.db
      .insert(salaryComponents)
      .values({ business_id: ctx.otherBusinessId, nama_komponen: 'Lain', tipe: 'earning', nominal: 100 })
      .returning()
      .get()
    const assignment = ctx.db.db
      .insert(employeeSalaryAssignments)
      .values({ employee_id: outsiderEmp.id, salary_component_id: outsiderComp.id })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/salary-assignments/${assignment.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})
