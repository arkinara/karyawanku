import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function empBase(noKtp: string, over: Record<string, unknown> = {}) {
  return {
    nama_lengkap: 'Karyawan Test',
    no_ktp: noKtp,
    tanggal_lahir: '1990-01-01',
    jenis_kelamin: 'L',
    alamat: 'Jl. Test No. 1',
    kontak_darurat: '081234567890',
    tanggal_masuk: '2024-01-01',
    jenis_kontrak: 'pkwt',
    ...over,
  }
}

function makeNoKtp(i: number): string {
  return '1234567890' + String(100000 + i)
}

async function seedEmployees(n: number): Promise<void> {
  const { employees } = await import('../src/db/schema.js')
  for (let i = 0; i < n; i++) {
    ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.businessId,
        nama_lengkap: `Karyawan ${i}`,
        no_ktp: makeNoKtp(i),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: i % 2 ? 'P' : 'L',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
      })
      .run()
  }
}

async function createEmployee(noKtp: string, over: Record<string, unknown> = {}) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/employees',
    headers: auth(ctx.ownerToken),
    payload: empBase(noKtp, over),
  })
}

describe('POST /api/employees', () => {
  it('owner membuat karyawan → 200 dengan data tersimpan', async () => {
    ctx = await setupTest()
    const res = await createEmployee(makeNoKtp(1), { custom_fields: { ukuran_seragam: 'L' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.employee.nama_lengkap).toBe('Karyawan Test')
    expect(body.employee.no_ktp).toBe(makeNoKtp(1))
    expect(body.employee.status).toBe('aktif')
    expect(body.employee.custom_fields).toEqual({ ukuran_seragam: 'L' })
    expect(body.employee.business_id).toBe(ctx.businessId)
  })

  it('no_ktp 15 digit → 422', async () => {
    ctx = await setupTest()
    const res = await createEmployee('123456789012345')
    expect(res.statusCode).toBe(422)
  })

  it('no_ktp duplikat dalam bisnis → 409', async () => {
    ctx = await setupTest()
    await createEmployee(makeNoKtp(1))
    const res = await createEmployee(makeNoKtp(1))
    expect(res.statusCode).toBe(409)
  })

  it('umur < 17 tahun → 422', async () => {
    ctx = await setupTest()
    const res = await createEmployee(makeNoKtp(2), { tanggal_lahir: '2020-01-01' })
    expect(res.statusCode).toBe(422)
  })

  it('npwp format tidak valid → 422', async () => {
    ctx = await setupTest()
    const res = await createEmployee(makeNoKtp(3), { npwp: '123' })
    expect(res.statusCode).toBe(422)
  })

  it('npwp format dengan separator diterima → 200', async () => {
    ctx = await setupTest()
    const res = await createEmployee(makeNoKtp(4), { npwp: '12.345.678.9-012.345' })
    expect(res.statusCode).toBe(200)
    expect(res.json().employee.npwp).toBe('123456789012345')
  })

  it('custom_fields bukan objek → 422', async () => {
    ctx = await setupTest()
    const res = await createEmployee(makeNoKtp(5), { custom_fields: [1, 2] })
    expect(res.statusCode).toBe(422)
  })

  it('employee mendapat 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/employees',
      headers: auth(ctx.employeeToken),
      payload: empBase(makeNoKtp(6)),
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/employees (list)', () => {
  it('owner melihat daftar + total (12 karyawan di-seed)', async () => {
    ctx = await setupTest()
    await seedEmployees(12)
    const res = await ctx.app.inject({ method: 'GET', url: '/api/employees', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.employees.length).toBe(12)
    expect(body.total).toBe(12)
  })

  it('filter jenis_kontrak & status', async () => {
    ctx = await setupTest()
    await createEmployee(makeNoKtp(1), { jenis_kontrak: 'pkwt', status: 'aktif' })
    await createEmployee(makeNoKtp(2), { jenis_kontrak: 'harian', status: 'nonaktif' })
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/employees?jenis_kontrak=harian&status=nonaktif',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.employees[0].jenis_kontrak).toBe('harian')
    expect(body.employees[0].status).toBe('nonaktif')
  })

  it('pagination limit/offset', async () => {
    ctx = await setupTest()
    await seedEmployees(5)
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/employees?limit=2&offset=2',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.employees.length).toBe(2)
    expect(body.limit).toBe(2)
    expect(body.offset).toBe(2)
  })
})

describe('GET /api/employees/:id', () => {
  it('owner melihat detail + custom_fields ter-parse', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1), { custom_fields: { nomor_sim: 'SIM-XYZ' } })
    const id = created.json().employee.id
    const res = await ctx.app.inject({ method: 'GET', url: `/api/employees/${id}`, headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json().employee.custom_fields).toEqual({ nomor_sim: 'SIM-XYZ' })
  })

  it('employee dapat melihat profil sendiri', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1))
    const empId = created.json().employee.id
    const { users } = await import('../src/db/schema.js')
    const { eq } = await import('drizzle-orm')
    ctx.db.db.update(users).set({ employee_id: empId }).where(eq(users.email, 'siti@demo.com')).run()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${empId}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().employee.id).toBe(empId)
  })

  it('employee tidak dapat melihat karyawan lain', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1))
    const empId = created.json().employee.id
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/employees/${empId}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('karyawan dari bisnis lain → 404 (tidak bocor)', async () => {
    ctx = await setupTest()
    const { employees } = await import('../src/db/schema.js')
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
      method: 'GET',
      url: `/api/employees/${outsider.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/employees/:id', () => {
  it('owner memperbarui subset field', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1))
    const id = created.json().employee.id
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/employees/${id}`,
      headers: auth(ctx.ownerToken),
      payload: { alamat: 'Jl. Baru 99', jenis_kontrak: 'pkwtt' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().employee.alamat).toBe('Jl. Baru 99')
    expect(res.json().employee.jenis_kontrak).toBe('pkwtt')
  })

  it('toggle status aktif/nonaktif', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1))
    const id = created.json().employee.id
    const off = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/employees/${id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'nonaktif' },
    })
    expect(off.json().employee.status).toBe('nonaktif')
    const on = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/employees/${id}`,
      headers: auth(ctx.ownerToken),
      payload: { status: 'aktif' },
    })
    expect(on.json().employee.status).toBe('aktif')
  })

  it('merge custom_fields', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1), { custom_fields: { ukuran_seragam: 'L' } })
    const id = created.json().employee.id
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/employees/${id}`,
      headers: auth(ctx.ownerToken),
      payload: { custom_fields: { nomor_sim: 'SIM-1' } },
    })
    expect(res.json().employee.custom_fields).toEqual({ ukuran_seragam: 'L', nomor_sim: 'SIM-1' })
  })

  it('validasi no_ktp baru yang duplikat → 409', async () => {
    ctx = await setupTest()
    const a = await createEmployee(makeNoKtp(1))
    const b = await createEmployee(makeNoKtp(2))
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/employees/${b.json().employee.id}`,
      headers: auth(ctx.ownerToken),
      payload: { no_ktp: makeNoKtp(1) },
    })
    expect(res.statusCode).toBe(409)
  })

  it('karyawan dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const { employees } = await import('../src/db/schema.js')
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
      method: 'PATCH',
      url: `/api/employees/${outsider.id}`,
      headers: auth(ctx.ownerToken),
      payload: { alamat: 'X' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/employees/:id (soft-delete)', () => {
  it('owner menonaktifkan karyawan → { ok: true } dan status nonaktif', async () => {
    ctx = await setupTest()
    const created = await createEmployee(makeNoKtp(1))
    const id = created.json().employee.id
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/employees/${id}`, headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const detail = await ctx.app.inject({ method: 'GET', url: `/api/employees/${id}`, headers: auth(ctx.ownerToken) })
    expect(detail.json().employee.status).toBe('nonaktif')
  })

  it('menghapus karyawan dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const { employees } = await import('../src/db/schema.js')
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
      method: 'DELETE',
      url: `/api/employees/${outsider.id}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })
})
