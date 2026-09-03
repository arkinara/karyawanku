import { afterEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import type { TestCtx } from './helpers.js'
import { setupTest } from './helpers.js'
import {
  attendanceIdempotency,
  attendanceRecords,
  employees,
  users,
} from '../src/db/schema.js'
import { purgeExpired, recordIdempotency } from '../src/lib/attendance-idem.js'

let ctx: TestCtx

afterEach(() => {
  ctx?.cleanup()
})

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function makeNoKtp(i: number): string {
  return '8877665544' + String(700000 + i)
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

function at(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0).toISOString()
}

interface InjectResult {
  statusCode: number
  json: Record<string, unknown>
  headers: Record<string, string | string[] | undefined>
}

async function clockIn(
  payload: Record<string, unknown>,
  { key, token }: { key?: string; token?: string } = {},
): Promise<InjectResult> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attendance/clock-in',
    headers: {
      ...auth(token ?? ctx.employeeToken),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    payload,
  })
  return {
    statusCode: res.statusCode,
    json: res.json() as Record<string, unknown>,
    headers: res.headers as Record<string, string | string[] | undefined>,
  }
}

async function clockOut(
  payload: Record<string, unknown>,
  { key, token }: { key?: string; token?: string } = {},
): Promise<InjectResult> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/attendance/clock-out',
    headers: {
      ...auth(token ?? ctx.employeeToken),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    payload,
  })
  return {
    statusCode: res.statusCode,
    json: res.json() as Record<string, unknown>,
    headers: res.headers as Record<string, string | string[] | undefined>,
  }
}

function recordIdOf(result: InjectResult): string {
  return (result.json.record as { id: string }).id
}

function countRecords(employeeId: string): number {
  return ctx.db.db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.employee_id, employeeId))
    .all().length
}

describe('ticket #70 — idempotent attendance submission', () => {
  it('first clock-in with a key → 201 + record_id (fresh write)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
      { key: '6f9c9f72-8a2b-4c5d-9e10-111213141516' },
    )

    expect(res.statusCode).toBe(201)
    expect(recordIdOf(res)).toBeTruthy()
    expect(res.headers['x-idempotent-replay']).toBeUndefined()
    expect(countRecords(emp.id)).toBe(1)
  })

  it('same key + same employee → 200 replay, identical record_id, X-Idempotent-Replay: true', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

    const first = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
      { key },
    )
    expect(first.statusCode).toBe(201)

    // Retry dengan key yang sama (respons hilang di tengah jalan / retry queue).
    const second = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:46') },
      { key },
    )

    expect(second.statusCode).toBe(200)
    expect(second.headers['x-idempotent-replay']).toBe('true')
    expect(recordIdOf(second)).toBe(recordIdOf(first))
    expect(countRecords(emp.id)).toBe(1)
  })

  it('same key + DIFFERENT employee → 422 (key tidak dibagikan antar karyawan)', async () => {
    ctx = await setupTest()
    const empA = await seedEmployee('A')
    const empB = await seedEmployee('B', 2)
    await linkEmployeeUser(empA.id)
    const key = 'cccccccc-dddd-4eee-9fff-000000000001'

    const first = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
      { key },
    )
    expect(first.statusCode).toBe(201)

    // Owner mencoba memakai key milik empA untuk clock-in empB → ditolak.
    const cross = await clockIn(
      { employee_id: empB.id, submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '08:00') },
      { key, token: ctx.ownerToken },
    )

    expect(cross.statusCode).toBe(422)
    // Transaksi digagalkan: tidak ada record absensi empB yang tertulis.
    expect(countRecords(empB.id)).toBe(0)
  })

  it('missing key → 200 (jalur lama tanpa regresi)', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-07-15', '07:45'),
    })

    expect(res.statusCode).toBe(200)
    expect(recordIdOf(res)).toBeTruthy()
    expect(res.headers['x-idempotent-replay']).toBeUndefined()
    expect(countRecords(emp.id)).toBe(1)
  })

  it('expired key → treated as missing, fresh write succeeds', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const key = 'eeeeeeee-ffff-4aaa-8bbb-222233334444'

    // Baris idempotensi kedaluwarsa dengan key yang sama sudah ada. Butuh
    // record absensi asli karena attendance_id adalah FK (cascade).
    const stale = ctx.db.db
      .insert(attendanceRecords)
      .values({
        employee_id: emp.id,
        tanggal: '2026-07-10',
        clock_in: at('2026-07-10', '07:00'),
        status: 'hadir',
      })
      .returning()
      .get()
    ctx.db.db
      .insert(attendanceIdempotency)
      .values({
        idempotency_key: key,
        employee_id: emp.id,
        attendance_id: stale.id,
        endpoint: 'clock_in',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .run()

    const res = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
      { key },
    )

    // Key kedaluwarsa tidak menahan write: key fresh → 201, record baru dibuat.
    expect(res.statusCode).toBe(201)
    expect(recordIdOf(res)).toBeTruthy()
    expect(res.headers['x-idempotent-replay']).toBeUndefined()
    // Satu record baru untuk 2026-07-15 (selain record stale 2026-07-10).
    const written = ctx.db.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, emp.id), eq(attendanceRecords.tanggal, '2026-07-15')))
      .all()
    expect(written).toHaveLength(1)
    expect(written[0].id).toBe(recordIdOf(res))
  })

  it('clock-out with key → replay returns the same record_id', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    await clockIn({
      submission_method: 'offline_queue',
      client_timestamp: at('2026-07-15', '07:45'),
    })
    const outKey = '99999999-1111-4bbb-8ccc-444455556666'
    const first = await clockOut(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:00') },
      { key: outKey },
    )
    expect(first.statusCode).toBe(200)
    expect(recordIdOf(first)).toBeTruthy()

    // Retry clock-out dengan key yang sama → replay, bukan 409 double clock-out.
    const second = await clockOut(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '17:05') },
      { key: outKey },
    )

    expect(second.statusCode).toBe(200)
    expect(second.headers['x-idempotent-replay']).toBe('true')
    expect(recordIdOf(second)).toBe(recordIdOf(first))
    expect(countRecords(emp.id)).toBe(1)
  })

  it('purgeExpired deletes only expired rows', async () => {
    ctx = await setupTest()
    const emp = ctx.db.db.insert(employees).values({
      business_id: ctx.businessId,
      nama_lengkap: 'Purge',
      no_ktp: makeNoKtp(3),
      tanggal_lahir: '1990-01-01',
      jenis_kelamin: 'L',
      tanggal_masuk: '2024-01-01',
      jenis_kontrak: 'pkwt',
    }).returning().get()

    const expiredKey = 'expired-key-00000000000000000000000000000001'
    const futureKey = 'future-key-00000000000000000000000000000002'
    const liveKey = 'live-key-00000000000000000000000000000003'

    // attendance_id adalah FK → buat record absensi asli yang direferensikan.
    const staleRecord = ctx.db.db.insert(attendanceRecords).values({
      employee_id: emp.id,
      tanggal: '2026-07-10',
      clock_in: at('2026-07-10', '07:00'),
      status: 'hadir',
    }).returning().get()

    ctx.db.db.insert(attendanceIdempotency).values([
      {
        idempotency_key: expiredKey,
        employee_id: emp.id,
        attendance_id: staleRecord.id,
        endpoint: 'clock_in',
        expires_at: new Date(Date.now() - 60 * 1000),
      },
      {
        idempotency_key: futureKey,
        employee_id: emp.id,
        attendance_id: staleRecord.id,
        endpoint: 'clock_in',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        idempotency_key: liveKey,
        employee_id: emp.id,
        attendance_id: staleRecord.id,
        endpoint: 'clock_out',
      },
    ]).run()

    const purged = purgeExpired()

    expect(purged).toBe(1)
    const remaining = ctx.db.db.select().from(attendanceIdempotency).all()
    expect(remaining.map((r) => r.idempotency_key).sort()).toEqual([futureKey, liveKey].sort())
  })

  it('concurrent double-submit (Promise.all, same key) → exactly one record', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)
    const key = '77777777-2222-4ddd-8aaa-888899990000'

    const [a, b] = await Promise.all([
      clockIn(
        { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
        { key },
      ),
      clockIn(
        { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:46') },
        { key },
      ),
    ])

    expect([a.statusCode, b.statusCode].every((s) => s >= 200 && s < 300)).toBe(true)
    expect(recordIdOf(a)).toBe(recordIdOf(b))
    expect(countRecords(emp.id)).toBe(1)
  })

  it('invalid idempotency key format → 422', async () => {
    ctx = await setupTest()
    const emp = await seedEmployee()
    await linkEmployeeUser(emp.id)

    const res = await clockIn(
      { submission_method: 'offline_queue', client_timestamp: at('2026-07-15', '07:45') },
      { key: 'not-a-valid-key' },
    )

    expect(res.statusCode).toBe(422)
    expect(countRecords(emp.id)).toBe(0)
  })
})