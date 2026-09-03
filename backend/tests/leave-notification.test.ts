import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { employees, leaveTypes, notificationLog, pushDevices, users } from '../src/db/schema.js'
import { resetPushProviderCache, sendNotification } from '../src/lib/push-service.js'
import { setPushProviderOverride, type PushProvider, type PushData, type PushNotification } from '../src/lib/push-provider.js'

let ctx: TestCtx

afterEach(() => {
  resetPushProviderCache()
  setPushProviderOverride(null)
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

let ktpCounter = 0
function makeNoKtp(): string {
  ktpCounter += 1
  return '1122334455' + String(900000 + ktpCounter)
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
    })
    .returning()
    .get()
}

function linkEmployeeUser(employeeId: string) {
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

async function typeId(): Promise<string> {
  return ctx.db.db.select().from(leaveTypes).where(eq(leaveTypes.nama_jenis_cuti, 'Tahunan')).get()!.id
}

const tick = () => new Promise((r) => setTimeout(r, 80))

async function registerDevice(token = 'fcm-leave-token') {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: auth(ctx.employeeToken),
    payload: { token, platform: 'android', app_version: '1.0.0' },
  })
  expect(res.statusCode).toBe(201)
}

async function submitLeave(): Promise<{ id: string }> {
  const emp = await seedEmployee()
  linkEmployeeUser(emp.id)
  await ctx.app.inject({ method: 'GET', url: '/api/leave-types', headers: auth(ctx.ownerToken) })
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/leave-requests',
    headers: auth(ctx.employeeToken),
    payload: { leave_type_id: await typeId(), tanggal_mulai: dateStr(30), tanggal_selesai: dateStr(31), alasan: 'Libur' },
  })
  expect(res.statusCode).toBe(200)
  return { id: res.json().request.id }
}

describe('ticket #71 — notifikasi keputusan cuti', () => {
  it('approve → notification_log kind=leave_decided + payload {requestId, decision}', async () => {
    ctx = await setupTest()
    await registerDevice()
    const { id } = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    await tick()

    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0].kind).toBe('leave_decided')
    const payload = JSON.parse(String(logs[0].payload_json))
    expect(payload.requestId).toBe(id)
    expect(payload.decision).toBe('approved')
    expect(payload.kind).toBe('leave')
    expect(logs[0].delivered_at).not.toBeNull()
  })

  it('reject → notification_log decision=rejected', async () => {
    ctx = await setupTest()
    await registerDevice()
    const { id } = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/reject`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    await tick()

    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    const payload = JSON.parse(String(logs[0].payload_json))
    expect(payload.decision).toBe('rejected')
  })

  it('provider=noop → approve tetap sukses + log tercatat', async () => {
    process.env.PUSH_PROVIDER = 'noop'
    ctx = await setupTest()
    await registerDevice()
    const { id } = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    await tick()
    expect(ctx.db.db.select().from(notificationLog).all()).toHaveLength(1)
    process.env.PUSH_PROVIDER = ''
  })

  it('outage provider (send melempar) → approval tetap 200, error tercatat', async () => {
    const throwing: PushProvider = {
      async send(_token: string, _n: PushNotification, _d: PushData) {
        throw new Error('FCM unreachable')
      },
    }
    setPushProviderOverride(throwing)
    ctx = await setupTest()
    await registerDevice()
    const { id } = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().request.status).toBe('disetujui')
    await tick()

    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0].last_error).toBe('provider_exception')
    // Kegagalan transien menjadwalkan retry, bukan delivered.
    expect(logs[0].delivered_at).toBeNull()
    expect(logs[0].next_retry_at).not.toBeNull()
  })

  it('tanpa device terdaftar → tidak ada log, approval tetap 200', async () => {
    ctx = await setupTest()
    const { id } = await submitLeave()

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    expect(res.statusCode).toBe(200)
    await tick()
    expect(ctx.db.db.select().from(notificationLog).all()).toHaveLength(0)
  })

  it('payload tidak pernah memuat nominal gaji/slip', async () => {
    ctx = await setupTest()
    await registerDevice()
    const { id } = await submitLeave()
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/leave-requests/${id}/approve`,
      headers: auth(ctx.ownerToken),
    })
    await tick()
    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    const raw = String(logs[0].payload_json)
    expect(raw).not.toMatch(/take.?home/i)
    expect(raw).not.toMatch(/gaji/i)
    expect(raw).not.toMatch(/\d{1,3}(\.\d{3})+/)
  })

  it('cross-employee deep link: employee B mengambil request milik A → ditolak', async () => {
    ctx = await setupTest()
    const { id } = await submitLeave()

    // Employee B (user berbeda) mencoba fetch request milik A.
    const b = ctx.db.db
      .insert(users)
      .values({
        business_id: ctx.businessId,
        nama: 'Budi',
        email: 'budi@demo.com',
        password_hash: 'x',
        role: 'employee',
      })
      .returning()
      .get()
    const empB = await seedEmployee('Budi')
    ctx.db.db.update(users).set({ employee_id: empB.id }).where(eq(users.id, b.id)).run()
    const { signToken } = await import('../src/lib/auth.js')
    const issued = await signToken({ id: b.id, business_id: b.business_id, role: b.role, email: b.email })

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/leave-requests/${id}`,
      headers: auth(issued.accessToken),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toContain('pengajuan cuti')
  })
})

describe('push-service — retry bounded', () => {
  it('sendNotification fire-and-forget + retryDue memproses ulang dalam batas percobaan', async () => {
    ctx = await setupTest()
    const employee = ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()!
    ctx.db.db
      .insert(pushDevices)
      .values({ user_id: employee.id, business_id: employee.business_id, platform: 'android', token: 'tok-retry' })
      .run()

    let calls = 0
    const flaky: PushProvider = {
      async send() {
        calls += 1
        if (calls === 1) return { ok: false, error: 'transient' }
        return { ok: true }
      },
    }
    resetPushProviderCache()
    setPushProviderOverride(flaky)

    sendNotification(employee.id, 'leave_decided', { title: 'T', body: 'B' }, { requestId: 'r-1' })
    await tick()

    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0].last_error).toBe('transient')
    expect(logs[0].next_retry_at).not.toBeNull()

    // Retry dengan next_retry_at di masa lalu → dikirim ulang, delivered.
    const row = logs[0]
    ctx.db.db.update(notificationLog).set({ next_retry_at: new Date(Date.now() - 1000) }).where(eq(notificationLog.id, row.id)).run()

    const { retryDue } = await import('../src/lib/push-service.js')
    const retried = retryDue()
    expect(retried).toBe(1)
    await tick()

    const after = ctx.db.db.select().from(notificationLog).where(eq(notificationLog.id, row.id)).get()!
    expect(after.attempts).toBe(2)
    expect(after.delivered_at).not.toBeNull()
    expect(after.next_retry_at).toBeNull()
  })

  it('token UNREGISTERED → perangkat di-prune + log delivered', async () => {
    ctx = await setupTest()
    const employee = ctx.db.db.select().from(users).where(eq(users.email, 'siti@demo.com')).get()!
    const device = ctx.db.db
      .insert(pushDevices)
      .values({ user_id: employee.id, business_id: employee.business_id, platform: 'ios', token: 'tok-dead' })
      .returning()
      .get()

    const dead: PushProvider = {
      async send() {
        return { ok: false, error: 'unregistered' }
      },
    }
    resetPushProviderCache()
    setPushProviderOverride(dead)

    sendNotification(employee.id, 'leave_decided', { title: 'T', body: 'B' }, { requestId: 'r-1' })
    await tick()

    expect(ctx.db.db.select().from(pushDevices).all()).toHaveLength(0)
    const logs = ctx.db.db.select().from(notificationLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0].last_error).toBe('unregistered')
    expect(logs[0].delivered_at).not.toBeNull()
    expect(logs[0].next_retry_at).toBeNull()
    expect(device.id).toBeTruthy()
  })
})