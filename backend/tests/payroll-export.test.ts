import { afterEach, describe, expect, it } from 'vitest'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  salaryComponents,
} from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '5566778899' + String(900000 + i)
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

async function createAndApprove(periode = '2026-08') {
  const created = await ctx.app.inject({
    method: 'POST',
    url: '/api/payroll-runs',
    headers: auth(ctx.ownerToken),
    payload: { periode },
  })
  expect(created.statusCode).toBe(201)
  const { run } = created.json()
  await ctx.app.inject({
    method: 'POST',
    url: `/api/payroll-runs/${run.id}/approve`,
    headers: auth(ctx.ownerToken),
  })
  return run.id
}

describe('GET /api/payroll-runs/:id/export.csv', () => {
  it('owner menerima CSV dengan header, baris per karyawan, baris total, dan BOM', async () => {
    ctx = await setupTest()
    const siti = await seedEmployee('Siti', 1)
    const budi = await seedEmployee('Budi', 2)
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    const transport = await seedComponent('Tunjangan Transport', 500_000)
    await assign(siti.id, gaji.id)
    await assign(budi.id, gaji.id)
    await assign(siti.id, transport.id)
    await seedAttendance(siti.id, '2026-08-01')

    const runId = await createAndApprove()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}/export.csv`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('payroll-2026-08.csv')

    const text = res.body
    expect(text.startsWith('\uFEFF')).toBe(true)
    const lines = text.replace(/^\uFEFF/, '').trim().split('\n')
    expect(lines[0]).toContain('Nama')
    expect(lines[0]).toContain('Gaji Pokok')
    expect(lines[0]).toContain('Take-Home')
    // 1 header + 2 baris + 1 total
    expect(lines).toHaveLength(4)

    const last = lines[3].split(',')
    expect(last[0].replace(/"/g, '')).toBe('Total')
    expect(Number(last[2])).toBe(7_000_000) // total gaji pokok
  })

  it('export run tidak ada → 404', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/payroll-runs/tidak-ada/export.csv',
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(404)
  })

  it('karyawan → 403', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    const runId = await createAndApprove()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}/export.csv`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('?format=xlsx → mengembalikan file XLSX valid', async () => {
    ctx = await setupTest()
    await seedEmployee('Siti', 1)
    const runId = await createAndApprove()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/payroll-runs/${runId}/export.csv?format=xlsx`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
    expect(res.headers['content-disposition']).toContain('.xlsx')
    const buf = res.rawPayload
    // XLSX (zip) magic bytes PK
    expect(buf.slice(0, 2).toString('latin1')).toBe('PK')
  })
})
