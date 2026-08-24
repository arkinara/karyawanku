import { afterEach, describe, expect, it } from 'vitest'
import { eq, and } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, leaveBalances, leaveTypes } from '../src/db/schema.js'

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
  return '9988776655' + String(600000 + ktpCounter)
}

async function seedEmployee(tanggalMasuk = '2024-01-01'): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: 'Karyawan',
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: tanggalMasuk,
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function getTypeId(nama: string): Promise<string> {
  const type = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.nama_jenis_cuti, nama)).get()
  return type!.id
}

describe('POST /api/admin/leave-reset', () => {
  it('carry-over vs hangus diterapkan sesuai kebijakan per jenis', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const tahunanId = await getTypeId('Tahunan')
    const sakitId = await getTypeId('Sakit')

    ctx.db.db
      .insert(leaveBalances)
      .values({ employee_id: emp.id, leave_type_id: tahunanId, tahun: 2026, kuota_hari: 12, terpakai_hari: 5 })
      .run()
    ctx.db.db
      .insert(leaveBalances)
      .values({ employee_id: emp.id, leave_type_id: sakitId, tahun: 2026, kuota_hari: 5, terpakai_hari: 2 })
      .run()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leave-reset',
      headers: auth(ctx.ownerToken),
      payload: { tahun: 2027 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().tahun).toBe(2027)

    const tahunan = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employee_id, emp.id), eq(leaveBalances.leave_type_id, tahunanId), eq(leaveBalances.tahun, 2027)))
      .get()
    expect(tahunan?.kuota_hari).toBe(17)
    expect(tahunan?.terpakai_hari).toBe(0)

    const sakit = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employee_id, emp.id), eq(leaveBalances.leave_type_id, sakitId), eq(leaveBalances.tahun, 2027)))
      .get()
    expect(sakit?.kuota_hari).toBe(5)
  })

  it('idempoten: reset dua kali tidak menggandakan baris saldo', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const tahunanId = await getTypeId('Tahunan')
    ctx.db.db
      .insert(leaveBalances)
      .values({ employee_id: emp.id, leave_type_id: tahunanId, tahun: 2026, kuota_hari: 12, terpakai_hari: 5 })
      .run()

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leave-reset',
      headers: auth(ctx.ownerToken),
      payload: { tahun: 2027 },
    })
    expect(first.json().created).toBeGreaterThan(0)

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leave-reset',
      headers: auth(ctx.ownerToken),
      payload: { tahun: 2027 },
    })
    expect(second.json().skipped).toBeGreaterThan(0)

    const rows = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employee_id, emp.id), eq(leaveBalances.tahun, 2027)))
      .all()
    expect(rows.length).toBe(4)
  })

  it('masa kerja < 1 tahun pada reset → kuota Tahunan tidak penuh 12', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2026-06-15')
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const tahunanId = await getTypeId('Tahunan')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leave-reset',
      headers: auth(ctx.ownerToken),
      payload: { tahun: 2026 },
    })
    expect(res.statusCode).toBe(200)
    const tahunan = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employee_id, emp.id), eq(leaveBalances.leave_type_id, tahunanId), eq(leaveBalances.tahun, 2026)))
      .get()
    expect(tahunan?.kuota_hari ?? 12).toBeLessThan(12)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/leave-reset',
      headers: auth(ctx.employeeToken),
      payload: { tahun: 2027 },
    })
    expect(res.statusCode).toBe(403)
  })
})
