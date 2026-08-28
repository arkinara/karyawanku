import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, leaveBalances, leaveRequests, leaveTypes, users } from '../src/db/schema.js'

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
  return '1122334455' + String(500000 + ktpCounter)
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

function dateStr(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function getTypeId(nama: string): Promise<string> {
  const type = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.nama_jenis_cuti, nama)).get()
  return type!.id
}

describe('POST /api/leave-requests', () => {
  it('submit happy path → status pending, saldo auto-created', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: {
        leave_type_id: typeId,
        tanggal_mulai: dateStr(30),
        tanggal_selesai: dateStr(32),
        alasan: 'Liburan keluarga',
      },
    })
    expect(res.statusCode).toBe(200)
    const req = res.json().request
    expect(req.status).toBe('pending')
    expect(req.tanggal_selesai).toBe(dateStr(32))
    expect(req.employee_name).toBe('Karyawan')
  })

  it('melebihi sisa kuota → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(44) },
    })
    expect(res.statusCode).toBe(422)
  })

  it('tanggal mulai di masa lalu → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(-10), tanggal_selesai: dateStr(5) },
    })
    expect(res.statusCode).toBe(422)
  })

  it('tanggal_selesai < tanggal_mulai → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(28) },
    })
    expect(res.statusCode).toBe(422)
  })

  it('leave_type dari bisnis lain → 404', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const outsiderType = ctx.db.db
      .insert(leaveTypes)
      .values({ business_id: ctx.otherBusinessId, nama_jenis_cuti: 'Tahunan', default_kuota_hari: 12 })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: outsiderType.id, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(31) },
    })
    expect(res.statusCode).toBe(404)
  })

  it('owner tanpa employee_id → 422', async () => {
    ctx = await setupTest()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.ownerToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(31) },
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('GET /api/leave-requests', () => {
  it('employee hanya melihat pengajuan sendiri', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(31) },
    })
    const other = await seedEmployee('2023-01-01')
    ctx.db.db
      .insert(leaveRequests)
      .values({
        employee_id: other.id,
        leave_type_id: typeId,
        tanggal_mulai: dateStr(40),
        tanggal_selesi: dateStr(41),
        status: 'pending',
      })
      .run()

    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-requests', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json().requests.length).toBe(1)
    expect(res.json().requests[0].employee_id).toBe(emp.id)
  })

  it('owner melihat semua pengajuan di bisnis + filter status', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')
    await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(31) },
    })

    const all = await ctx.app.inject({ method: 'GET', url: '/api/leave-requests', headers: auth(ctx.ownerToken) })
    expect(all.json().requests.length).toBe(1)
    const pending = await ctx.app.inject({
      method: 'GET',
      url: '/api/leave-requests?status=pending',
      headers: auth(ctx.ownerToken),
    })
    expect(pending.json().requests.length).toBe(1)
    const disetujui = await ctx.app.inject({
      method: 'GET',
      url: '/api/leave-requests?status=disetujui',
      headers: auth(ctx.ownerToken),
    })
    expect(disetujui.json().requests.length).toBe(0)
  })

  it('owner tidak melihat pengajuan bisnis lain', async () => {
    ctx = await setupTest()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')
    const otherEmp = ctx.db.db
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
    ctx.db.db
      .insert(leaveRequests)
      .values({
        employee_id: otherEmp.id,
        leave_type_id: typeId,
        tanggal_mulai: dateStr(40),
        tanggal_selesi: dateStr(41),
        status: 'pending',
      })
      .run()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/leave-requests', headers: auth(ctx.ownerToken) })
    expect(res.json().requests.length).toBe(0)
  })
})

describe('approve/reject', () => {
  async function submitAndGetRequest(): Promise<{ id: string; typeId: string }> {
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const typeId = await getTypeId('Tahunan')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: { leave_type_id: typeId, tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(32) },
    })
    return { id: res.json().request.id, typeId }
  }

  it('approve menaikkan terpakai_hari sebesar jumlah hari', async () => {
    ctx = await setupTest()
    const { id, typeId } = await submitAndGetRequest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
      payload: { catatan_approver: 'OK' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().request.status).toBe('disetujui')
    expect(res.json().request.catatan_approver).toBe('OK')

    const bal = ctx.db.db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.leave_type_id, typeId))
      .get()
    expect(bal?.terpakai_hari).toBe(3)
  })

  it('reject tidak mengubah saldo, status ditolak', async () => {
    ctx = await setupTest()
    const { id, typeId } = await submitAndGetRequest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/reject`,
      headers: auth(ctx.ownerToken),
      payload: { catatan_approver: 'Tidak disetujui' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().request.status).toBe('ditolak')
    const bal = ctx.db.db.select().from(leaveBalances).where(eq(leaveBalances.leave_type_id, typeId)).get()
    expect(bal?.terpakai_hari).toBe(0)
  })

  it('approve pengajuan yang sudah diputuskan → 409', async () => {
    ctx = await setupTest()
    const { id } = await submitAndGetRequest()
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(409)
  })

  it('owner bisnis lain tidak bisa approve (cross-business) → 404', async () => {
    ctx = await setupTest()
    const { id } = await submitAndGetRequest()
    const { signToken } = await import('../src/lib/auth.js')
    const otherUser = ctx.db.db
      .select()
      .from(users)
      .where(eq(users.email, 'oranglain@demo.com'))
      .get()!
    const issued = await signToken({
      id: otherUser.id,
      business_id: otherUser.business_id,
      role: otherUser.role,
      email: otherUser.email,
    })
    const otherToken = issued.accessToken
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(otherToken),
    })
    expect(res.statusCode).toBe(404)
  })

  it('employee tidak bisa approve → 403', async () => {
    ctx = await setupTest()
    const { id } = await submitAndGetRequest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.employeeToken),
    })
    expect(res.statusCode).toBe(403)
  })
})
