import { afterEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import { attendanceRecords, auditLogs, employees, users } from '../src/db/schema.js'
import { TIMESTAMP_TOLERANCE_MS } from '../src/routes/attendance.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '9988776655' + String(500000 + i)
}

async function seedEmployee(name = 'X', ktpIdx = 1): Promise<{ id: string }> {
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

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function auditRows() {
  return ctx.db.db.select().from(auditLogs).all()
}

async function clockIn(payload: Record<string, unknown>): Promise<{
  statusCode: number
  body: Record<string, unknown>
}> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attendance/clock-in',
    headers: auth(ctx.employeeToken),
    payload,
  })
  return { statusCode: res.statusCode, body: res.json() as Record<string, unknown> }
}

describe('ticket #59 — server-authoritative time', () => {
  it('clock_in live = jam server, client_claim_at tersimpan terpisah', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const claim = new Date().toISOString()
    const before = Date.now()
    const { statusCode, body } = await clockIn({
      employee_id: emp.id,
      client_timestamp: claim,
      submission_method: 'live',
    })
    expect(statusCode).toBe(200)

    const record = body.record as {
      clock_in: string
      client_claim_at: string | null
      time_drift_detected: boolean
      submission_method: string
    }
    expect(record.clock_in).toBeTruthy()
    const serverTs = Date.parse(record.clock_in)
    expect(serverTs).toBeGreaterThanOrEqual(before - 1000)
    expect(serverTs).toBeLessThanOrEqual(Date.now() + 1000)
    expect(record.client_claim_at).toBe(claim)
    expect(record.submission_method).toBe('live')
    expect(record.time_drift_detected).toBe(false)
  })

  it('drift > toleransi (live, masa lalu) → diterima, ditandai time_drift_detected=true + audit log', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const oldClaim = hoursAgoIso(1)
    const { statusCode, body } = await clockIn({
      employee_id: emp.id,
      client_timestamp: oldClaim,
      submission_method: 'live',
    })
    expect(statusCode).toBe(200)

    const record = body.record as {
      clock_in: string
      client_claim_at: string | null
      time_drift_detected: boolean
      submission_method: string
    }
    // Waktu otoritatif tetap jam server, bukan klaim lama.
    expect(Math.abs(Date.parse(record.clock_in) - Date.now())).toBeLessThan(10_000)
    expect(record.client_claim_at).toBe(oldClaim)
    expect(record.time_drift_detected).toBe(true)
    expect(record.submission_method).toBe('live')

    const driftLogs = auditRows().filter((l) => l.action === 'attendance.time_drift')
    expect(driftLogs).toHaveLength(1)
    expect(driftLogs[0].entity_type).toBe('attendance_record')
    expect(driftLogs[0].entity_id).toBe((record as { id: string }).id)
  })

  it('live submission dengan drift besar tetap diterima (tidak 4xx)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const oldClaim = hoursAgoIso(24)
    const { statusCode, body } = await clockIn({
      employee_id: emp.id,
      client_timestamp: oldClaim,
      submission_method: 'live',
    })
    expect(statusCode).toBe(200)
    const record = body.record as { time_drift_detected: boolean; client_claim_at: string }
    expect(record.time_drift_detected).toBe(true)
    expect(record.client_claim_at).toBe(oldClaim)
  })

  it('live submission dalam toleransi (< TIMESTAMP_TOLERANCE_MS) tidak ditandai drift', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const nearClaim = new Date(Date.now() - Math.floor(TIMESTAMP_TOLERANCE_MS / 2)).toISOString()
    const { statusCode, body } = await clockIn({
      employee_id: emp.id,
      client_timestamp: nearClaim,
      submission_method: 'live',
    })
    expect(statusCode).toBe(200)
    expect((body.record as { time_drift_detected: boolean }).time_drift_detected).toBe(false)
    expect(auditRows().filter((l) => l.action === 'attendance.time_drift')).toHaveLength(0)
  })

  it('offline_queue menerima klaim lama tanpa flag drift, clock_in = waktu aksi asli', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const oldClaim = hoursAgoIso(20) // durasi offline yang sah (jam/hari)
    const { statusCode, body } = await clockIn({
      employee_id: emp.id,
      client_timestamp: oldClaim,
      submission_method: 'offline_queue',
    })
    expect(statusCode).toBe(200)

    const record = body.record as {
      clock_in: string
      client_claim_at: string | null
      time_drift_detected: boolean
      submission_method: string
    }
    // Offline: waktu otoritatif = klaim asli (bukan jam server saat flush).
    expect(record.clock_in).toBe(oldClaim)
    expect(record.client_claim_at).toBe(oldClaim)
    expect(record.time_drift_detected).toBe(false)
    expect(record.submission_method).toBe('offline_queue')

    const driftLogs = auditRows().filter((l) => l.action === 'attendance.time_drift')
    expect(driftLogs).toHaveLength(0)
  })
})

describe('ticket #59 — self-service identity guard', () => {
  it('employee tidak bisa clock-in atas nama karyawan lain → 403 + audit log + tanpa record', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti')
    const other = await seedEmployee('Lain', 2)
    await linkEmployeeUser(emp.id)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.employeeToken),
      payload: {
        employee_id: other.id,
        client_timestamp: new Date().toISOString(),
        submission_method: 'live',
      },
    })
    expect(res.statusCode).toBe(403)

    const blocked = auditRows().filter((l) => l.action === 'attendance.impersonation.blocked')
    expect(blocked).toHaveLength(1)
    expect(blocked[0].entity_id).toBe(other.id)

    const written = ctx.db.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, other.id)))
      .all()
    expect(written).toHaveLength(0)
  })

  it('employee_id tanpa body → dicatat untuk dirinya sendiri', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee('Siti')
    await linkEmployeeUser(emp.id)

    const { statusCode, body } = await clockIn({
      client_timestamp: new Date().toISOString(),
      submission_method: 'live',
    })
    expect(statusCode).toBe(200)
    expect((body.record as { employee_id: string }).employee_id).toBe(emp.id)
  })

  it('owner bisa clock-in karyawan mana pun di bisnisnya', async () => {
    ctx = await setupTest()
    const target = await seedEmployee('Target', 5)

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/attendance/clock-in',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: target.id,
        client_timestamp: new Date().toISOString(),
        submission_method: 'live',
      },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json().record as { employee_id: string }).employee_id).toBe(target.id)
  })

  it('owner tidak bisa clock-in karyawan bisnis lain', async () => {
    ctx = await setupTest()
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
      url: '/api/attendance/clock-in',
      headers: auth(ctx.ownerToken),
      payload: {
        employee_id: outsider.id,
        client_timestamp: new Date().toISOString(),
      },
    })
    expect(res.statusCode).toBe(404)
  })
})