import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  auditLogs,
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  leaveRequests,
  leaveTypes,
  payrollItems,
  payrollRuns,
  salaryComponents,
  users,
} from '../src/db/schema.js'
import { recordAudit } from '../src/lib/audit.js'

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
  return '6677889900' + String(300000 + ktpCounter)
}

async function seedEmployee(name = 'Karyawan'): Promise<{ id: string }> {
  return ctx.db.db
    .insert(employees)
    .values({
      business_id: ctx.businessId,
      nama_lengkap: name,
      no_ktp: makeNoKtp(),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'P',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
      status: 'aktif',
    })
    .returning()
    .get()
}

async function seedComponent(nama: string, nominal: number): Promise<{ id: string }> {
  return ctx.db.db
    .insert(salaryComponents)
    .values({ business_id: ctx.businessId, nama_komponen: nama, tipe: 'earning', nominal })
    .returning()
    .get()
}

async function seedAttendance(employeeId: string, tanggal: string): Promise<void> {
  await ctx.db.db.insert(attendanceRecords).values({ employee_id: employeeId, tanggal, status: 'hadir' }).run()
}

function ownerId(): string {
  const owner = ctx.db.db.select().from(users).where(eq(users.email, 'owner@demo.com')).get()
  return owner!.id
}

function auditRows() {
  return ctx.db.db.select().from(auditLogs).all()
}

describe('audit log — payroll run creation', () => {
  it('mencatat payroll.create dengan actor + before/after', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti')
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await ctx.db.db
      .insert(employeeSalaryAssignments)
      .values({ employee_id: emp.id, salary_component_id: gaji.id })
      .run()
    await seedAttendance(emp.id, '2026-08-01')

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: '2026-08' },
    })
    expect(res.statusCode).toBe(201)
    const runId = res.json().run.id

    const rows = auditRows()
    expect(rows).toHaveLength(1)
    const log = rows[0]
    expect(log.action).toBe('payroll.create')
    expect(log.entity_type).toBe('payroll_run')
    expect(log.entity_id).toBe(runId)
    expect(log.business_id).toBe(ctx.businessId)
    expect(log.actor_user_id).toBe(ownerId())
    expect(log.after).toMatchObject({ periode: '2026-08', status: 'draft' })
    expect(typeof (log.after as { take_home: number }).take_home).toBe('number')
    expect(log.before).toBeNull()
  })

  it('audit row tidak dibuat saat mutasi gagal', async () => {
    ctx = await setupTest()
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode: 'bukan-periode' },
    })
    expect(res.statusCode).toBe(422)
    expect(auditRows()).toHaveLength(0)
  })
})

describe('audit log — leave approval', () => {
  function dateStr(daysFromNow: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  async function submitLeave(): Promise<string> {
    const emp = await seedEmployee('Siti')
    ctx.db.db.update(users).set({ employee_id: emp.id }).where(eq(users.email, 'siti@demo.com')).run()
    await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
    const type = ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.nama_jenis_cuti, 'Tahunan')).get()!
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/leave-requests',
      headers: auth(ctx.employeeToken),
      payload: {
        leave_type_id: type.id,
        tanggal_mulai: dateStr(30),
        tanggal_selesai: dateStr(32),
        alasan: 'Liburan',
      },
    })
    return res.json().request.id
  }

  it('approve mencatat leave.approve dengan status transisi + catatan_approver', async () => {
    ctx = await setupTest()
    const id = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
      payload: { catatan_approver: 'Disetujui, sudah sesuai aturan' },
    })
    expect(res.statusCode).toBe(200)

    const rows = auditRows()
    expect(rows).toHaveLength(1)
    const log = rows[0]
    expect(log.action).toBe('leave.approve')
    expect(log.entity_type).toBe('leave_request')
    expect(log.entity_id).toBe(id)
    expect(log.actor_user_id).toBe(ownerId())
    expect(log.before).toEqual({ status: 'pending' })
    expect(log.after).toMatchObject({ status: 'disetujui', catatan_approver: 'Disetujui, sudah sesuai aturan' })
  })

  it('reject mencatat leave.reject', async () => {
    ctx = await setupTest()
    const id = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/reject`,
      headers: auth(ctx.ownerToken),
      payload: { catatan_approver: 'Kuota penuh' },
    })
    expect(res.statusCode).toBe(200)

    const log = auditRows()[0]
    expect(log.action).toBe('leave.reject')
    expect(log.before).toEqual({ status: 'pending' })
    expect(log.after).toMatchObject({ status: 'ditolak', catatan_approver: 'Kuota penuh' })
  })
})

describe('audit log — redaksi field sensitif', () => {
  it('password hash tidak pernah tertulis ke before/after (ganti password user)', async () => {
    ctx = await setupTest()
    const target = ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()!
    const oldHash = target.password_hash

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      headers: auth(ctx.ownerToken),
      payload: { password: 'brandNew99' },
    })
    expect(res.statusCode).toBe(200)
    const newHash = ctx.db.db.select().from(users).where(eq(users.id, target.id)).get()!.password_hash
    expect(newHash).not.toBe(oldHash)

    const log = auditRows()[0]
    expect(log.action).toBe('user.update')
    const beforeRaw = JSON.stringify(log.before)
    const afterRaw = JSON.stringify(log.after)
    expect(beforeRaw).not.toContain(oldHash)
    expect(afterRaw).not.toContain(newHash)
    expect(beforeRaw).toContain('[redacted]')
    expect(afterRaw).toContain('[redacted]')
  })

  it('recordAudit menandai token/secret secara langsung', async () => {
    ctx = await setupTest()
    recordAudit({
      db: ctx.db.db,
      businessId: ctx.businessId,
      actorUserId: ownerId(),
      action: 'unit.redact',
      entityType: 'test',
      entityId: 'x',
      before: { password_hash: '$2b$10$secret', jti: 'jwt-id', refresh_token: 'rt' },
      after: { nama: 'aman', jumlah: 5 },
    })
    const log = auditRows()[0]
    expect(log.before).toEqual({ password_hash: '[redacted]', jti: '[redacted]', refresh_token: '[redacted]' })
    expect(log.after).toEqual({ nama: 'aman', jumlah: 5 })
  })
})

describe('GET /api/audit-logs', () => {
  async function seedPayrollAudit(periode = '2026-09'): Promise<string> {
    const emp = await seedEmployee('Siti')
    const gaji = await seedComponent('Gaji Pokok', 3_500_000)
    await ctx.db.db
      .insert(employeeSalaryAssignments)
      .values({ employee_id: emp.id, salary_component_id: gaji.id })
      .run()
    await seedAttendance(emp.id, '2026-09-01')
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/payroll-runs',
      headers: auth(ctx.ownerToken),
      payload: { periode },
    })
    expect(res.statusCode).toBe(201)
    return res.json().run.id
  }

  it('owner melihat log bisnis sendiri, terbaru dulu, dengan actor', async () => {
    ctx = await setupTest()
    await seedPayrollAudit('2026-09')
    await seedPayrollAudit('2026-10')

    const res = await ctx.app.inject({ method: 'GET', url: '/api/audit-logs', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(2)
    expect(body.logs).toHaveLength(2)
    expect(body.logs[0].created_at >= body.logs[1].created_at).toBe(true)
    expect(body.logs[0].actor.nama).toBe('Darmawan')
    expect(body.logs[0].actor.email).toBe('owner@demo.com')
  })

  it('filter entity_type + entity_id', async () => {
    ctx = await setupTest()
    const runId = await seedPayrollAudit()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/audit-logs?entity_type=payroll_run&entity_id=${runId}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().total).toBe(1)
    expect(res.json().logs[0].entity_id).toBe(runId)
  })

  it('filter actor_user_id', async () => {
    ctx = await setupTest()
    await seedPayrollAudit()

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/audit-logs?actor_user_id=${ownerId()}`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.json().total).toBe(1)

    const resNone = await ctx.app.inject({
      method: 'GET',
      url: '/api/audit-logs?actor_user_id=someone-else',
      headers: auth(ctx.ownerToken),
    })
    expect(resNone.json().total).toBe(0)
  })

  it('cross-business: log bisnis lain tidak terlihat', async () => {
    ctx = await setupTest()
    await seedPayrollAudit()
    recordAudit({
      db: ctx.db.db,
      businessId: ctx.otherBusinessId,
      actorUserId: ownerId(),
      action: 'payroll.create',
      entityType: 'payroll_run',
      entityId: 'other-run',
      before: null,
      after: { periode: '2026-08' },
    })

    const res = await ctx.app.inject({ method: 'GET', url: '/api/audit-logs', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json().total).toBe(1)
    expect(res.json().logs[0].entity_id).not.toBe('other-run')
  })

  it('manager & employee → 403', async () => {
    ctx = await setupTest()
    const managerRes = await ctx.app.inject({ method: 'GET', url: '/api/audit-logs', headers: auth(ctx.managerToken) })
    expect(managerRes.statusCode).toBe(403)
    const empRes = await ctx.app.inject({ method: 'GET', url: '/api/audit-logs', headers: auth(ctx.employeeToken) })
    expect(empRes.statusCode).toBe(403)
  })

  it('page size tidak terbatas — limit besar di-clamp ke 100', async () => {
    ctx = await setupTest()
    await seedPayrollAudit()
    const res = await ctx.app.inject({ method: 'GET', url: '/api/audit-logs?limit=999999', headers: auth(ctx.ownerToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json().limit).toBe(100)
  })
})

describe('audit log — absensi: before memuat jam asli', () => {
  it('PATCH /attendance/:id mencatat clock times asli pada before', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti')
    const rec = ctx.db.db
      .insert(attendanceRecords)
      .values({ employee_id: emp.id, tanggal: '2026-08-01', clock_in: '08:00:00', clock_out: null, status: 'hadir' })
      .returning()
      .get()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/attendance/${rec.id}`,
      headers: auth(ctx.ownerToken),
      payload: { clock_in: '08:30:00', status: 'telat', late_minutes: 30 },
    })
    expect(res.statusCode).toBe(200)

    const log = auditRows()[0]
    expect(log.action).toBe('attendance.correct')
    expect(log.before).toMatchObject({ clock_in: '08:00:00', clock_out: null, status: 'hadir' })
    expect(log.after).toMatchObject({ clock_in: '08:30:00', status: 'telat', late_minutes: 30 })
  })
})

describe('audit log — tidak ada rute update/delete', () => {
  it('PUT/PATCH/DELETE pada /api/audit-logs → 404', async () => {
    ctx = await setupTest()
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      const res = await ctx.app.inject({
        method,
        url: '/api/audit-logs/some-id',
        headers: auth(ctx.ownerToken),
        payload: {},
      })
      expect(res.statusCode).toBe(404)
    }
  })
})