import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, leaveBalances, leaveTypes, users } from '../src/db/schema.js'

let ctx: TestCtx

afterEach(() => {
  vi.useRealTimers()
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '3355998877' + String(400000 + ktpCounter)
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

async function linkEmployeeUser(employeeId: string) {
  ctx.db.db.update(users).set({ employee_id: employeeId }).where(eq(users.email, 'siti@demo.com')).run()
}

// Kuota prorata dihitung dari masa kerja terhadap "sekarang", sedangkan
// tanggal masuk pada fixture di bawah bersifat tetap (2026). Tanpa jam yang
// dibekukan, kasus "masa kerja < 1 tahun" berhenti berlaku begitu tahun
// berganti. Hanya Date yang dipalsukan; timer lain tetap nyata.
const YEAR = 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-20T09:00:00Z'))
})

describe('GET /api/leave-balances (auto-create)', () => {
  it('owner melihat saldo karyawan, auto-create semua jenis cuti, Tahunan kuota 12 (masa kerja >= 1 th)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${emp.id}&tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.employee_id).toBe(emp.id)
    const tahunan = body.balances.find((b: { nama_jenis_cuti: string }) => b.nama_jenis_cuti === 'Tahunan')
    expect(tahunan.kuota_hari).toBe(12)
    expect(tahunan.terpakai_hari).toBe(0)
    expect(body.balances.length).toBe(4)
  })

  it('auto-create idempoten: GET dua kali tidak menggandakan baris saldo', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${emp.id}&tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${emp.id}&tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    const rows = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.employee_id, emp.id))
      .all()
    expect(rows.length).toBe(4)
  })

  it('masa kerja < 1 tahun → kuota Tahunan prorata (bukan 12 penuh)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('2026-06-15')
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${emp.id}&tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    const tahunan = res.json().balances.find((b: { nama_jenis_cuti: string }) => b.nama_jenis_cuti === 'Tahunan')
    expect(tahunan.kuota_hari).toBeGreaterThan(0)
    expect(tahunan.kuota_hari).toBeLessThan(12)
  })

  it('employee hanya bisa melihat saldo sendiri (employee_id lain → 403)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const other = await seedEmployee()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${other.id}&tahun=${YEAR}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('employee melihat saldo sendiri tanpa employee_id', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?tahun=${YEAR}`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().employee_id).toBe(emp.id)
    expect(res.json().balances.length).toBe(4)
  })

  it('owner tanpa employee_id → 422', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('PATCH /api/leave-balances/:id', () => {
  it('owner menyesuaikan kuota/terpakai', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?employee_id=${emp.id}&tahun=${YEAR}`,
      headers: auth(ctx.ownerToken),
    })
    const tahunan = list.json().balances.find((b: { nama_jenis_cuti: string }) => b.nama_jenis_cuti === 'Tahunan')
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-balances/${tahunan.id}`,
      headers: auth(ctx.ownerToken),
      payload: { kuota_hari: 15 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().balance.kuota_hari).toBe(15)
  })

  it('employee → 403', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-balances?tahun=${YEAR}`,
      headers: auth(ctx.employeeToken),
    })
    const bal = list.json().balances[0]
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-balances/${bal.id}`,
      headers: auth(ctx.employeeToken),
      payload: { kuota_hari: 99 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('saldo milik bisnis lain → 404', async () => {
    ctx = await setupTest()
    const outsider = ctx.db.db
      .insert(employees)
      .values({
        business_id: ctx.otherBusinessId,
        nama_lengkap: 'Lain',
        no_ktp: makeNoKtp(),
        tanggal_lahir: '1990-01-01',
        jenis_kelamin: 'P',
        tanggal_masuk: '2024-01-01',
        jenis_kontrak: 'pkwt',
      })
      .returning()
      .get()
    const otype = ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'Tahunan', default_kuota_hari: 12 })
      .returning()
      .get()
    const bal = ctx.db.db
      .insert(leaveBalances)
      .values({ employee_id: outsider.id, leave_type_id: otype.id, tahun: YEAR, kuota_hari: 10, terpakai_hari: 0 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-balances/${bal.id}`,
      headers: auth(ctx.ownerToken),
      payload: { kuota_hari: 5 },
    })
    expect(res.statusCode).toBe(404)
  })
})
