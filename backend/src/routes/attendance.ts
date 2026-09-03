import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import {
  attendanceRecords,
  attendanceSubmissionMethods,
  employees,
  shiftAssignments,
  shifts,
  type AttendanceSubmissionMethod,
} from '../db/schema.js'
import { currentUser, requireAuth, requireCapability } from '../lib/auth.js'
import { hasCapability } from '../lib/capabilities.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, ConflictError, ForbiddenError } from '../lib/errors.js'
import { computeAttendanceStatus, DEFAULT_SCHEDULE_START } from '../lib/attendance-status.js'
import { findIdempotentResult, recordIdempotency } from '../lib/attendance-idem.js'
import { offsetOf, paginateResult, parsePagination } from '../lib/pagination.js'
import {
  computeOvertimeMinutes,
  DEFAULT_GRACE_MINUTES,
  DEFAULT_SCHEDULE_END,
  MAX_OVERTIME_MINUTES,
} from '../lib/overtime.js'

/**
 * Toleransi selisih antara klaim waktu klien dan jam server (5 menit).
 * Submission live yang klaimnya meleset melebihi batas ini TIDAK ditolak,
 * melainkan diterima dan ditandai `time_drift_detected = true` untuk review.
 * Klaim di masa depan melebihi batas ini tetap ditolak (422).
 */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

const clockInSchema = z.object({
  employee_id: z.string().optional(),
  catatan: z.string().optional(),
  client_timestamp: z.string().optional(),
  submission_method: z.enum(attendanceSubmissionMethods).optional(),
})

const clockOutSchema = z.object({
  employee_id: z.string().optional(),
  client_timestamp: z.string().optional(),
  submission_method: z.enum(attendanceSubmissionMethods).optional(),
})

const manualSchema = z.object({
  employee_id: z.string(),
  tanggal: z.string(),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  catatan: z.string().nullable().optional(),
  status: z.enum(['hadir', 'telat', 'absen', 'izin']).optional(),
  late_minutes: z.number().int().min(0).optional(),
  overtime_minutes: z.number().int().min(0).max(MAX_OVERTIME_MINUTES).optional(),
})

const patchSchema = z.object({
  tanggal: z.string().optional(),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  catatan: z.string().nullable().optional(),
  status: z.enum(['hadir', 'telat', 'absen', 'izin']).optional(),
  late_minutes: z.number().int().min(0).optional(),
  overtime_override_minutes: z
    .number()
    .int()
    .min(0)
    .max(MAX_OVERTIME_MINUTES)
    .nullable()
    .optional(),
})

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toIso(d: Date): string {
  return d.toISOString()
}

export interface ParsedClockTime {
  /** Klaim waktu klien (client_timestamp), atau null bila tidak dikirim. */
  clientClaim: Date | null
  /** Jam server saat request diproses. */
  serverTime: Date
  /**
   * Waktu efektif yang dicatat sebagai `clock_in`/`clock_out`:
   * jam server untuk submission `live`, klaim klien untuk `offline_queue`.
   */
  effective: Date
  /** Tanggal (YYYY-MM-DD) lokal berdasarkan waktu efektif. */
  tanggal: string
  /** true hanya untuk submission `live` yang klaimnya meleset > toleransi. */
  timeDriftDetected: boolean
}

/**
 * Mem-parse `client_timestamp` dari body. Waktu otoritatif selalu jam server:
 * untuk submission `live` (`clock_in`/`clock_out` = `Date.now()` saat request),
 * sedangkan flush antrian offline (`offline_queue`) mempertahankan waktu aksi
 * asli klien sebagai `clock_in`/`clock_out` karena itu durasi offline yang sah.
 *
 * - `client_timestamp` tidak valid → 422
 * - klaim di masa depan melebihi toleransi → 422 (tetap ditolak)
 * - submission `live` dengan klaim meleset > toleransi → diterima, ditandai
 *   `timeDriftDetected = true` (bukan ditolak)
 */
function parseClientTimestamp(
  raw: unknown,
  submissionMethod: AttendanceSubmissionMethod = 'live',
): ParsedClockTime {
  const serverTime = new Date()
  let clientClaim: Date | null = null
  if (raw !== undefined && raw !== null && raw !== '') {
    const d = new Date(String(raw))
    if (Number.isNaN(d.getTime())) throw new ApiError(422, 'client_timestamp tidak valid')
    if (d.getTime() > serverTime.getTime() + TIMESTAMP_TOLERANCE_MS) {
      throw new ApiError(422, 'client_timestamp berada di luar batas wajar (masa depan)')
    }
    clientClaim = d
  }

  const isOffline = submissionMethod === 'offline_queue'
  const effective = isOffline && clientClaim ? clientClaim : serverTime
  const timeDriftDetected =
    !isOffline && clientClaim !== null
      ? Math.abs(clientClaim.getTime() - serverTime.getTime()) > TIMESTAMP_TOLERANCE_MS
      : false

  return {
    clientClaim,
    serverTime,
    effective,
    tanggal: localDateStr(effective),
    timeDriftDetected,
  }
}

/**
 * Menentukan karyawan target dari request. Owner dan Manager (yang memegang
 * `attendance.manage`) boleh menunjuk employee_id (validasi dalam bisnis);
 * employee hanya boleh untuk dirinya sendiri.
 *
 * Guard identitas (ticket #59): employee yang mencoba clock-in/out atas nama
 * karyawan lain ditolak 403 DAN percobaannya dicatat ke audit log
 * (`attendance.impersonation.blocked`).
 */
function resolveTargetEmployee(
  req: FastifyRequest,
  employeeIdParam?: string,
): string {
  const user = currentUser(req)
  const { db } = getDb()

  if (user.role === 'owner' || hasCapability(user.role, 'attendance.manage')) {
    const id = employeeIdParam ?? user.employee_id
    if (!id) throw new ApiError(422, 'employee_id wajib diisi')
    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')
    return emp.id
  }

  const selfId = user.employee_id
  if (!selfId) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
  if (employeeIdParam && employeeIdParam !== selfId) {
    recordAudit({
      db,
      businessId: user.business_id,
      actorUserId: user.id,
      action: 'attendance.impersonation.blocked',
      entityType: 'employee',
      entityId: employeeIdParam,
      after: {
        target_employee_id: employeeIdParam,
        actor_employee_id: selfId,
        blocked: true,
      },
    })
    throw new ForbiddenError('Anda hanya dapat mengelola absensi Anda sendiri.')
  }
  const emp = db
    .select()
    .from(employees)
    .where(and(eq(employees.id, selfId), eq(employees.business_id, user.business_id)))
    .get()
  if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')
  return selfId
}

/** Jam mulai shift aktif untuk employee pada tanggal tsb, atau null bila tak ada. */
function getScheduleStart(employeeId: string, tanggal: string): string | null {
  const { db } = getDb()
  const row = db
    .select({ jamMulai: shifts.jam_mulai })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
    .where(and(eq(shiftAssignments.employee_id, employeeId), eq(shiftAssignments.tanggal, tanggal)))
    .get()
  return row?.jamMulai ?? null
}

/** Jam selesai shift aktif untuk employee pada tanggal tsb, atau null bila tak ada. */
function getScheduleEnd(
  employeeId: string,
  tanggal: string,
): { jamMulai: string; jamSelesai: string } | null {
  const { db } = getDb()
  const row = db
    .select({ jamMulai: shifts.jam_mulai, jamSelesai: shifts.jam_selesai })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
    .where(and(eq(shiftAssignments.employee_id, employeeId), eq(shiftAssignments.tanggal, tanggal)))
    .get()
  return row ?? null
}

/** Memastikan record absensi milik karyawan dalam bisnis user. */
function assertRecordInBusiness(recordId: string, businessId: string) {
  const { db } = getDb()
  const record = db.select().from(attendanceRecords).where(eq(attendanceRecords.id, recordId)).get()
  if (!record) throw new ApiError(404, 'Catatan absensi tidak ditemukan')
  const emp = db
    .select()
    .from(employees)
    .where(and(eq(employees.id, record.employee_id), eq(employees.business_id, businessId)))
    .get()
  if (!emp) throw new ApiError(404, 'Catatan absensi tidak ditemukan')
  return record
}

/** Snapshot jam + status absensi untuk payload audit before/after. */
function attendanceSnapshot(rec: {
  clock_in: string | null
  clock_out: string | null
  catatan: string | null
  status: string
  late_minutes: number
  overtime_minutes: number
  overtime_override_minutes: number | null
}) {
  return {
    clock_in: rec.clock_in,
    clock_out: rec.clock_out,
    catatan: rec.catatan,
    status: rec.status,
    late_minutes: rec.late_minutes,
    overtime_minutes: rec.overtime_minutes,
    overtime_override_minutes: rec.overtime_override_minutes,
  }
}

/**
 * Lembur hanya sah untuk hari yang benar-benar dihadiri (hadir/telat/izin
 * dengan kehadiran). Hari berstatus `absen` tidak boleh membawa nilai lembur.
 */
function assertOvertimeAllowedForStatus(status: string, overtimeMinutes: number): void {
  if (status === 'absen' && overtimeMinutes > 0) {
    throw new ApiError(422, 'Overtime tidak dapat dicatat untuk hari dengan status absen')
  }
}

/**
 * Parse header `Idempotency-Key` (ticket #70). Nilai sah: UUID v4 atau hex
 * 256-bit (64 karakter). Header tidak ada → `null` (jalur lama tanpa
 * idempotensi, tetap didukung). Header ada tapi tidak sah → 422.
 */
function parseIdempotencyKey(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const key = String(raw)
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const hex256 = /^[0-9a-f]{64}$/i
  if (!uuidV4.test(key) && !hex256.test(key)) {
    throw new ApiError(422, 'Idempotency-Key tidak valid')
  }
  return key
}

/**
 * Jalur replay idempoten (ticket #70): key sudah pernah sukses untuk karyawan
 * ini → kembalikan record asli (X-Idempotent-Replay: true) tanpa menulis ulang.
 * Menang saat request diulang karena respons hilang di tengah jalan / retry
 * antrian offline. Key kedaluwarsa dianggap tidak ada (findIdempotentResult
 * memfilter expires_at), jadi tidak pernah menahan double-write.
 */
function replayIfIdempotent(
  reply: FastifyReply,
  key: string | null,
  employeeId: string,
  endpoint: 'clock_in' | 'clock_out',
): { record: typeof attendanceRecords.$inferSelect; scheduleStart: string } | null {
  if (!key) return null
  const { db } = getDb()
  const idem = findIdempotentResult(key, employeeId, endpoint)
  if (!idem) return null
  const record = db.select().from(attendanceRecords).where(eq(attendanceRecords.id, idem.attendanceId)).get()
  // Record asli pasti ada (FK cascade menghapus baris idempotensi bersamanya);
  // defensif: bila tidak, perlakukan seperti key baru.
  if (!record) return null
  reply.header('X-Idempotent-Replay', 'true')
  return { record, scheduleStart: getScheduleStart(record.employee_id, record.tanggal) ?? DEFAULT_SCHEDULE_START }
}

export default async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/attendance/clock-in', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = clockInSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const idemKey = parseIdempotencyKey(req.headers['idempotency-key'])
    const employeeId = resolveTargetEmployee(req, body.employee_id)

    // Idempotent replay (ticket #70): sebelum cek duplicate-day, karena record
    // sudah ada untuk hari itu — replay harus mengembalikan record asli, bukan 409.
    const replayed = replayIfIdempotent(reply, idemKey, employeeId, 'clock_in')
    if (replayed) {
      return { record: replayed.record, schedule_start: replayed.scheduleStart }
    }

    const submissionMethod = body.submission_method ?? 'live'
    const clock = parseClientTimestamp(body.client_timestamp, submissionMethod)
    const tanggal = clock.tanggal

    const existing = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, employeeId), eq(attendanceRecords.tanggal, tanggal)))
      .get()
    if (existing) {
      throw new ConflictError('Anda sudah melakukan clock-in pada tanggal ini')
    }

    const scheduleStart = getScheduleStart(employeeId, tanggal) ?? DEFAULT_SCHEDULE_START
    const { status, lateMinutes } = computeAttendanceStatus(clock.effective, scheduleStart)

    const record = db.transaction((tx) => {
      const inserted = tx
        .insert(attendanceRecords)
        .values({
          employee_id: employeeId,
          tanggal,
          clock_in: toIso(clock.effective),
          client_claim_at: clock.clientClaim ? toIso(clock.clientClaim) : null,
          time_drift_detected: clock.timeDriftDetected,
          submission_method: submissionMethod,
          catatan: body.catatan ?? null,
          status,
          late_minutes: lateMinutes,
        })
        .returning()
        .get()

      // Idempotensi dicatat DI DALAM transaksi yang sama dengan write, sebelum
      // respons dikirim. Bentrok (key sudah dipakai karyawan/endpoint lain) →
      // transaksi batal + 422.
      if (idemKey) {
        try {
          recordIdempotency(tx, {
            key: idemKey,
            employeeId,
            attendanceId: inserted.id,
            endpoint: 'clock_in',
          })
        } catch {
          throw new ApiError(422, 'Idempotency-Key telah digunakan tindakan lain')
        }
      }

      if (clock.timeDriftDetected) {
        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'attendance.time_drift',
          entityType: 'attendance_record',
          entityId: inserted.id,
          after: {
            clock_in_server: toIso(clock.effective),
            client_claim_at: clock.clientClaim ? toIso(clock.clientClaim) : null,
            submission_method: submissionMethod,
            drift_ms: clock.clientClaim ? clock.clientClaim.getTime() - clock.effective.getTime() : null,
            flagged: true,
          },
        })
      }

      return inserted
    })

    // Write baru dengan key → 201 Created. Tanpa key tetap 200 (jalur lama,
    // tanpa regresi). Replay memakai 200 + X-Idempotent-Replay (lihat di atas).
    if (idemKey) reply.code(201)

    return { record, schedule_start: scheduleStart }
  })

  app.post('/attendance/clock-out', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = clockOutSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const idemKey = parseIdempotencyKey(req.headers['idempotency-key'])
    const employeeId = resolveTargetEmployee(req, body.employee_id)

    // Replay idempoten sebelum cek `existing.clock_out` — record sudah punya
    // clock_out, replay harus mengembalikan record asli, bukan 409.
    const replayed = replayIfIdempotent(reply, idemKey, employeeId, 'clock_out')
    if (replayed) {
      return { record: replayed.record }
    }

    const submissionMethod = body.submission_method ?? 'live'
    const clock = parseClientTimestamp(body.client_timestamp, submissionMethod)
    const tanggal = clock.tanggal

    const existing = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, employeeId), eq(attendanceRecords.tanggal, tanggal)))
      .get()
    if (!existing) {
      throw new ConflictError('Belum ada clock-in untuk tanggal ini')
    }
    if (existing.clock_out) {
      throw new ConflictError('Sudah melakukan clock-out pada tanggal ini')
    }

    const schedule = getScheduleEnd(employeeId, tanggal)
    const scheduleEnd = schedule?.jamSelesai ?? DEFAULT_SCHEDULE_END
    const clockInDate = new Date(existing.clock_in ?? toIso(clock.effective))
    const overtimeMinutes = computeOvertimeMinutes(
      clockInDate,
      clock.effective,
      scheduleEnd,
      DEFAULT_GRACE_MINUTES,
      existing.overtime_override_minutes,
      schedule?.jamMulai ?? null,
    )

    const record = db.transaction((tx) => {
      const updated = tx
        .update(attendanceRecords)
        .set({
          clock_out: toIso(clock.effective),
          clock_out_client_claim_at: clock.clientClaim ? toIso(clock.clientClaim) : null,
          time_drift_detected: Boolean(existing.time_drift_detected) || clock.timeDriftDetected,
          submission_method: submissionMethod,
          overtime_minutes: overtimeMinutes,
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning()
        .get()

      // Idempotensi dicatat DI DALAM transaksi yang sama dengan write, sebelum
      // respons dikirim (ticket #70).
      if (idemKey) {
        try {
          recordIdempotency(tx, {
            key: idemKey,
            employeeId,
            attendanceId: updated.id,
            endpoint: 'clock_out',
          })
        } catch {
          throw new ApiError(422, 'Idempotency-Key telah digunakan tindakan lain')
        }
      }

      if (clock.timeDriftDetected) {
        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'attendance.time_drift',
          entityType: 'attendance_record',
          entityId: updated.id,
          after: {
            clock_out_server: toIso(clock.effective),
            client_claim_at: clock.clientClaim ? toIso(clock.clientClaim) : null,
            submission_method: submissionMethod,
            drift_ms: clock.clientClaim ? clock.clientClaim.getTime() - clock.effective.getTime() : null,
            flagged: true,
          },
        })
      }

      return updated
    })

    return { record }
  })

  app.get('/attendance/today', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()
    if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')

    const tanggal = localDateStr(new Date())
    const record = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, user.employee_id), eq(attendanceRecords.tanggal, tanggal)))
      .get()

    return { record: record ?? null }
  })

  app.get('/attendance/employee/:employeeId', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { employeeId } = req.params as { employeeId: string }
    const q = req.query as Record<string, unknown>
    const { page, limit } = parsePagination(q)
    const offset = offsetOf({ page, limit })
    const { db } = getDb()

    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')

    const isOwner = user.role === 'owner' || hasCapability(user.role, 'attendance.manage')
    const isSelf = user.role === 'employee' && user.employee_id === employeeId
    if (!isOwner && !isSelf) {
      throw new ForbiddenError('Anda tidak berhak mengakses data ini.')
    }

    const filters = [eq(attendanceRecords.employee_id, employeeId)]
    if (q.start && q.end) {
      filters.push(gte(attendanceRecords.tanggal, String(q.start)), lte(attendanceRecords.tanggal, String(q.end)))
    }
    const where = and(...filters)
    const rows = db
      .select()
      .from(attendanceRecords)
      .where(where)
      .orderBy(desc(attendanceRecords.tanggal), desc(attendanceRecords.id))
      .limit(limit)
      .offset(offset)
      .all()

    const total = db.select({ c: count() }).from(attendanceRecords).where(where).get()?.c ?? 0

    return paginateResult(rows, total, { page, limit })
  })

  app.get('/attendance/aggregate/:employeeId', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { employeeId } = req.params as { employeeId: string }
    const period = String((req.query as Record<string, unknown>).period ?? '')
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new ApiError(422, 'period wajib berformat YYYY-MM')
    }
    const { db } = getDb()

    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')

    const isOwner = user.role === 'owner' || hasCapability(user.role, 'attendance.manage')
    const isSelf = user.role === 'employee' && user.employee_id === employeeId
    if (!isOwner && !isSelf) {
      throw new ForbiddenError('Anda tidak berhak mengakses data ini.')
    }

    const rows = db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employee_id, employeeId),
          sql`substr(${attendanceRecords.tanggal}, 1, 7) = ${period}`,
        ),
      )
      .all()

    let hadir = 0
    let telat = 0
    let absen = 0
    let izin = 0
    let totalLateMinutes = 0
    let totalOvertimeMinutes = 0
    for (const r of rows) {
      if (r.status === 'hadir') hadir++
      else if (r.status === 'telat') telat++
      else if (r.status === 'absen') absen++
      else if (r.status === 'izin') izin++
      totalLateMinutes += r.late_minutes ?? 0
      totalOvertimeMinutes += r.overtime_override_minutes ?? r.overtime_minutes ?? 0
    }

    return {
      hadir,
      telat,
      absen,
      izin,
      total_late_minutes: totalLateMinutes,
      total_overtime_minutes: totalOvertimeMinutes,
    }
  })

  app.post('/attendance/manual', { preHandler: requireCapability('attendance.manage') }, async (req) => {
    const parsed = manualSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data absensi tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, body.employee_id), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')

    const existing = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, body.employee_id), eq(attendanceRecords.tanggal, body.tanggal)))
      .get()

    const { record, upserted } = db.transaction((tx) => {
      if (existing) {
        const patch: Record<string, unknown> = {}
        if (body.clock_in !== undefined) patch.clock_in = body.clock_in
        if (body.clock_out !== undefined) patch.clock_out = body.clock_out
        if (body.catatan !== undefined) patch.catatan = body.catatan
        if (body.status !== undefined) patch.status = body.status
        if (body.late_minutes !== undefined) patch.late_minutes = body.late_minutes
        if (body.overtime_minutes !== undefined) patch.overtime_minutes = body.overtime_minutes

        const finalStatus = body.status ?? existing.status
        const finalOvertime = body.overtime_minutes ?? existing.overtime_minutes
        assertOvertimeAllowedForStatus(finalStatus, finalOvertime)

        const changed = tx
          .update(attendanceRecords)
          .set(patch)
          .where(eq(attendanceRecords.id, existing.id))
          .returning()
          .get()

        recordAudit({
          db: tx,
          businessId: user.business_id,
          actorUserId: user.id,
          action: 'attendance.manual.correct',
          entityType: 'attendance_record',
          entityId: changed.id,
          before: attendanceSnapshot(existing),
          after: attendanceSnapshot(changed),
        })

        return { record: changed, upserted: false }
      }

      const overtimeMinutes = body.overtime_minutes ?? 0
      const status = body.status ?? 'hadir'
      assertOvertimeAllowedForStatus(status, overtimeMinutes)

      const changed = tx
        .insert(attendanceRecords)
        .values({
          employee_id: body.employee_id,
          tanggal: body.tanggal,
          clock_in: body.clock_in ?? null,
          clock_out: body.clock_out ?? null,
          catatan: body.catatan ?? null,
          status,
          late_minutes: body.late_minutes ?? 0,
          overtime_minutes: overtimeMinutes,
        })
        .returning()
        .get()

      recordAudit({
        db: tx,
        businessId: user.business_id,
        actorUserId: user.id,
        action: 'attendance.manual.create',
        entityType: 'attendance_record',
        entityId: changed.id,
        before: null,
        after: attendanceSnapshot(changed),
      })

      return { record: changed, upserted: true }
    })

    return { record, upserted }
  })

  app.patch('/attendance/:id', { preHandler: requireCapability('attendance.manage') }, async (req) => {
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data absensi tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const before = assertRecordInBusiness(id, user.business_id)

    const patch: Record<string, unknown> = {}
    if (body.tanggal !== undefined) patch.tanggal = body.tanggal
    if (body.clock_in !== undefined) patch.clock_in = body.clock_in
    if (body.clock_out !== undefined) patch.clock_out = body.clock_out
    if (body.catatan !== undefined) patch.catatan = body.catatan
    if (body.status !== undefined) patch.status = body.status
    if (body.late_minutes !== undefined) patch.late_minutes = body.late_minutes
    if (body.overtime_override_minutes !== undefined) {
      patch.overtime_override_minutes = body.overtime_override_minutes
    }

    const finalStatus = body.status ?? before.status
    const finalOverride = body.overtime_override_minutes ?? before.overtime_override_minutes
    assertOvertimeAllowedForStatus(finalStatus, finalOverride ?? before.overtime_minutes)

    const record = db.transaction((tx) => {
      const changed = tx
        .update(attendanceRecords)
        .set(patch)
        .where(eq(attendanceRecords.id, id))
        .returning()
        .get()

      recordAudit({
        db: tx,
        businessId: user.business_id,
        actorUserId: user.id,
        action: 'attendance.correct',
        entityType: 'attendance_record',
        entityId: id,
        before: attendanceSnapshot(before),
        after: attendanceSnapshot(changed),
      })

      return changed
    })

    return { record }
  })
}
