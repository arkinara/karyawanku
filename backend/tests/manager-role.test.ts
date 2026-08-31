import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  ROLE_CAPABILITIES,
  ROLE_CAPABILITIES_FOR_FRONTEND,
  capabilities,
  capabilitiesForRole,
  hasCapability,
  type Capability,
} from '../src/lib/capabilities.js'
import { roles, employees, leaveRequests, leaveTypes, shiftAssignments, shifts, users } from '../src/db/schema.js'

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

async function seedEmployee(businessId = ctx.businessId, nama = 'Karyawan'): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: businessId,
      nama_lengkap: nama,
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    })
    .returning()
    .get()
}

async function seedLeaveType(): Promise<string> {
  await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
  const type = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.nama_jenis_cuti, 'Tahunan')).get()
  return type!.id
}

function dateStr(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('capability matrix (ticket #49)', () => {
  it('enum roles memuat manager', () => {
    expect(roles).toContain('manager')
    expect(roles).toEqual(['owner', 'manager', 'employee'])
  })

  it('matriks per peran sesuai kontrak', () => {
    const all = [...capabilities] as Capability[]
    expect(ROLE_CAPABILITIES.owner).toEqual(all)
    expect(ROLE_CAPABILITIES.manager).toEqual([
      'attendance.manage',
      'leave.approve',
      'roster.publish',
      'employees.write',
      'users.manage',
    ])
    expect(ROLE_CAPABILITIES.employee).toEqual([])
  })

  it('hasCapability menjawab benar per peran', () => {
    expect(hasCapability('owner', 'payroll.run')).toBe(true)
    expect(hasCapability('owner', 'settings.write')).toBe(true)
    expect(hasCapability('manager', 'attendance.manage')).toBe(true)
    expect(hasCapability('manager', 'leave.approve')).toBe(true)
    expect(hasCapability('manager', 'roster.publish')).toBe(true)
    expect(hasCapability('manager', 'payroll.run')).toBe(false)
    expect(hasCapability('manager', 'payroll.approve')).toBe(false)
    expect(hasCapability('manager', 'salary.write')).toBe(false)
    expect(hasCapability('manager', 'settings.write')).toBe(false)
    expect(hasCapability('employee', 'leave.approve')).toBe(false)
    expect(hasCapability('employee', 'attendance.manage')).toBe(false)
    expect(capabilitiesForRole('manager')).toEqual(['attendance.manage', 'leave.approve', 'roster.publish', 'employees.write', 'users.manage'])
  })

  it('ROLE_CAPABILITIES_FOR_FRONTEND adalah salinan mutable yang sama isinya', () => {
    expect(ROLE_CAPABILITIES_FOR_FRONTEND.owner).toEqual([...capabilities])
    expect(ROLE_CAPABILITIES_FOR_FRONTEND.manager).toContain('users.manage')
    expect(ROLE_CAPABILITIES_FOR_FRONTEND.employee).toEqual([])
    // tidak boleh alias ke matriks internal
    ROLE_CAPABILITIES_FOR_FRONTEND.manager.push('bogus' as Capability)
    expect(ROLE_CAPABILITIES.manager).not.toContain('bogus' as Capability)
  })

  it('semua capability tercantum di matriks owner', () => {
    for (const cap of capabilities) {
      expect(hasCapability('owner', cap)).toBe(true)
    }
  })
})

describe('manager role — data model & seed', () => {
  it('owner dapat membuat user ber-role manager', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.ownerToken),
      payload: {
        email: 'managerbaru@demo.com',
        password: 'manager123',
        nama: 'Manager Baru',
        role: 'manager',
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.role).toBe('manager')
  })

  it('manager tidak dapat menetapkan role manager/owner', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(ctx.managerToken),
      payload: {
        email: 'x@demo.com',
        password: 'demo123',
        nama: 'X',
        role: 'manager',
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('manager tidak dapat mengubah role user', async () => {
    ctx = await setupTest()
    const target = ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target!.id}`,
      headers: auth(ctx.managerToken),
      payload: { role: 'manager' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('manager tidak dapat menonaktifkan akun manager lain', async () => {
    ctx = await setupTest()
    const otherManager = ctx.db.db
      .insert(users)
      .values({
        business_id: ctx.businessId,
        nama: 'Manager Lain',
        email: 'manager2@demo.com',
        password_hash: 'x',
        role: 'manager',
      })
      .returning()
      .get()
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${otherManager.id}`,
      headers: auth(ctx.managerToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('employee tidak dapat mengakses endpoint users (403)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: auth(ctx.employeeToken) })
    expect(res.statusCode).toBe(403)
  })

  it('seed membuat minimal satu user manager', async () => {
    ctx = await setupTest()
    const managers = ctx.db.db
      .select()
      .from(users)
      .where(eq(users.business_id, ctx.businessId))
      .all()
      .filter((u) => u.role === 'manager')
    expect(managers.length).toBeGreaterThanOrEqual(1)
  })
})

describe('manager — attendance.manage', () => {
  it('manager dapat entri manual absensi karyawan di bisnisnya', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.managerToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'hadir', clock_in: '2026-06-05T07:30:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().upserted).toBe(true)

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${res.json().record.id}`,
      headers: auth(ctx.managerToken),
      payload: { status: 'telat', late_minutes: 7 },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().record.status).toBe('telat')
  })

  it('manager tidak dapat mengakses payroll (403)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.managerToken),
      payload: { periode: '2026-08' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('employee tidak dapat entri manual absensi (403)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/manual',
      headers: auth(ctx.employeeToken),
      payload: { employee_id: emp.id, tanggal: '2026-06-05', status: 'hadir' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('manager — leave.approve', () => {
  async function seedPendingLeave(employeeId: string): Promise<string> {
    const typeId = await seedLeaveType()
    const req = ctx.db.db
      .insert(leaveRequests)
      .values({
        employee_id: employeeId,
        leave_type_id: typeId,
        tanggal_mulai: dateStr(15),
        tanggal_selesai: dateStr(16),
        status: 'pending',
      })
      .returning()
      .get()
    return req.id
  }

  it('manager dapat menyetujui cuti, approver = manager', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const reqId = await seedPendingLeave(emp.id)

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${reqId}/approve`,
      headers: auth(ctx.managerToken),
      payload: { catatan_approver: 'disetujui manajer' },
    })
    expect(res.statusCode).toBe(200)
    const manager = ctx.db.db.select().from(users).where(eq(users.email, 'manager@demo.com')).get()
    expect(res.json().request.status).toBe('disetujui')
    expect(res.json().request.approver_user_id).toBe(manager!.id)
    expect(res.json().request.decided_at).toBeTruthy()
  })

  it('employee mendapat 403 pada approve', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const reqId = await seedPendingLeave(emp.id)

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${reqId}/approve`,
      headers: auth(ctx.employeeToken),
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })

  it('manager tidak dapat menyetujui cutinya sendiri', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    ctx.db.db.update(users).set({ employee_id: emp.id }).where(eq(users.email, 'manager@demo.com')).run()
    const reqId = await seedPendingLeave(emp.id)

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${reqId}/approve`,
      headers: auth(ctx.managerToken),
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })

  it('manager aksi pada cuti karyawan bisnis lain → 404', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee(ctx.otherBusinessId)
    const reqId = await seedPendingLeave(emp.id)

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${reqId}/approve`,
      headers: auth(ctx.managerToken),
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('manager — roster.publish & shifts', () => {
  it('manager dapat publish roster, publisher = manager', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    const shift = ctx.db.db
      .insert(shifts)
      .values({ business_id: ctx.businessId, nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' })
      .returning()
      .get()
    const assignment = ctx.db.db
      .insert(shiftAssignments)
      .values({ employee_id: emp.id, shift_id: shift.id, tanggal: dateStr(3) })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.managerToken),
      payload: { assignment_ids: [assignment.id] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().updated).toBe(1)
    const manager = ctx.db.db.select().from(users).where(eq(users.email, 'manager@demo.com')).get()
    expect(res.json().published_by_user_id).toBe(manager!.id)
    expect(res.json().published_at).toBeTruthy()
  })

  it('manager dapat membuat shift', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: auth(ctx.managerToken),
      payload: { nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().shift.nama_shift).toBe('Pagi')
  })

  it('employee tidak dapat publish roster / membuat shift (403)', async () => {
    ctx = await setupTest()
    const publish = await ctx.app.inject({
      method: 'POST',
      url: '/api/roster/publish',
      headers: auth(ctx.employeeToken),
      payload: { start: dateStr(1), end: dateStr(2) },
    })
    expect(publish.statusCode).toBe(403)

    const shift = await ctx.app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: auth(ctx.employeeToken),
      payload: { nama_shift: 'Pagi', jam_mulai: '07:00', jam_selesai: '15:00' },
    })
    expect(shift.statusCode).toBe(403)
  })
})

describe('owner — rute pemilik tetap berfungsi (no regression)', () => {
  it('owner tetap bisa membuat komponen gaji (salary.write)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components',
      headers: auth(ctx.ownerToken),
      payload: { nama_komponen: 'Tunjangan Makan', tipe: 'earning', nominal: 500_000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().component.tipe).toBe('earning')
  })

  it('manager ditolak pada salary-components (403)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/salary-components',
      headers: auth(ctx.managerToken),
      payload: { nama_komponen: 'Tunjangan Makan', tipe: 'earning', nominal: 500_000 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('manager ditolak pada settings bisnis (403)', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/businesses/${ctx.businessId}`,
      headers: auth(ctx.managerToken),
      payload: { alamat: 'Bogor' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/auth/me — capabilities', () => {
  it('mengekspos capabilities per role + matriks frontend', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(ctx.managerToken) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.role).toBe('manager')
    expect(body.capabilities).toContain('attendance.manage')
    expect(body.capabilities).toContain('leave.approve')
    expect(body.capabilities).not.toContain('payroll.run')
    expect(body.role_capabilities.owner).toContain('settings.write')
    expect(body.role_capabilities.employee).toEqual([])
  })
})