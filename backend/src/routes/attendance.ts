import type { FastifyInstance, FastifyRequest } from 'fastify'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { attendanceRecords, employees, shiftAssignments, shifts } from '../db/schema.js'
import { currentUser, requireAuth, requireCapability } from '../lib/auth.js'
import { hasCapability } from '../lib/capabilities.js'
import { ApiError, ConflictError, ForbiddenError } from '../lib/errors.js'
import { computeAttendanceStatus, DEFAULT_SCHEDULE_START } from '../lib/attendance-status.js'

/** Toleransi jam untuk timestamp klien agar tidak merusak request (5 menit). */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

const clockInSchema = z.object({
  employee_id: z.string().optional(),
  catatan: z.string().optional(),
  client_timestamp: z.string().optional(),
})

const clockOutSchema = z.object({
  employee_id: z.string().optional(),
  client_timestamp: z.string().optional(),
})

const manualSchema = z.object({
  employee_id: z.string(),
  tanggal: z.string(),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  catatan: z.string().nullable().optional(),
  status: z.enum(['hadir', 'telat', 'absen', 'izin']).optional(),
  late_minutes: z.number().int().min(0).optional(),
})

const patchSchema = z.object({
  tanggal: z.string().optional(),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  catatan: z.string().nullable().optional(),
  status: z.enum(['hadir', 'telat', 'absen', 'izin']).optional(),
  late_minutes: z.number().int().min(0).optional(),
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

function parseClientTimestamp(raw: unknown): Date {
  if (raw === undefined || raw === null || raw === '') return new Date()
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) throw new ApiError(422, 'client_timestamp tidak valid')
  if (d.getTime() > Date.now() + TIMESTAMP_TOLERANCE_MS) {
    throw new ApiError(422, 'client_timestamp berada di luar batas wajar (masa depan)')
  }
  return d
}

/**
 * Menentukan karyawan target dari request. Owner dan Manager (yang memegang
 * `attendance.manage`) boleh menunjuk employee_id (validasi dalam bisnis);
 * employee hanya boleh untuk dirinya sendiri.
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

export default async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/attendance/clock-in', { preHandler: requireAuth }, async (req) => {
    const parsed = clockInSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const { db } = getDb()

    const employeeId = resolveTargetEmployee(req, body.employee_id)
    const clockIn = parseClientTimestamp(body.client_timestamp)
    const tanggal = localDateStr(clockIn)

    const existing = db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employee_id, employeeId), eq(attendanceRecords.tanggal, tanggal)))
      .get()
    if (existing) {
      throw new ConflictError('Anda sudah melakukan clock-in pada tanggal ini')
    }

    const scheduleStart = getScheduleStart(employeeId, tanggal) ?? DEFAULT_SCHEDULE_START
    const { status, lateMinutes } = computeAttendanceStatus(clockIn, scheduleStart)

    const record = db
      .insert(attendanceRecords)
      .values({
        employee_id: employeeId,
        tanggal,
        clock_in: toIso(clockIn),
        catatan: body.catatan ?? null,
        status,
        late_minutes: lateMinutes,
      })
      .returning()
      .get()

    return { record, schedule_start: scheduleStart }
  })

  app.post('/attendance/clock-out', { preHandler: requireAuth }, async (req) => {
    const parsed = clockOutSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const body = parsed.data
    const { db } = getDb()

    const employeeId = resolveTargetEmployee(req, body.employee_id)
    const clockOut = parseClientTimestamp(body.client_timestamp)
    const tanggal = localDateStr(clockOut)

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

    const record = db
      .update(attendanceRecords)
      .set({ clock_out: toIso(clockOut) })
      .where(eq(attendanceRecords.id, existing.id))
      .returning()
      .get()

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
    const rows = db
      .select()
      .from(attendanceRecords)
      .where(and(...filters))
      .orderBy(asc(attendanceRecords.tanggal))
      .all()

    return { records: rows }
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
    for (const r of rows) {
      if (r.status === 'hadir') hadir++
      else if (r.status === 'telat') telat++
      else if (r.status === 'absen') absen++
      else if (r.status === 'izin') izin++
      totalLateMinutes += r.late_minutes ?? 0
    }

    return { hadir, telat, absen, izin, total_late_minutes: totalLateMinutes }
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

    if (existing) {
      const patch: Record<string, unknown> = {}
      if (body.clock_in !== undefined) patch.clock_in = body.clock_in
      if (body.clock_out !== undefined) patch.clock_out = body.clock_out
      if (body.catatan !== undefined) patch.catatan = body.catatan
      if (body.status !== undefined) patch.status = body.status
      if (body.late_minutes !== undefined) patch.late_minutes = body.late_minutes
      const record = db
        .update(attendanceRecords)
        .set(patch)
        .where(eq(attendanceRecords.id, existing.id))
        .returning()
        .get()
      return { record, upserted: false }
    }

    const record = db
      .insert(attendanceRecords)
      .values({
        employee_id: body.employee_id,
        tanggal: body.tanggal,
        clock_in: body.clock_in ?? null,
        clock_out: body.clock_out ?? null,
        catatan: body.catatan ?? null,
        status: body.status ?? 'hadir',
        late_minutes: body.late_minutes ?? 0,
      })
      .returning()
      .get()

    return { record, upserted: true }
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

    assertRecordInBusiness(id, user.business_id)

    const patch: Record<string, unknown> = {}
    if (body.tanggal !== undefined) patch.tanggal = body.tanggal
    if (body.clock_in !== undefined) patch.clock_in = body.clock_in
    if (body.clock_out !== undefined) patch.clock_out = body.clock_out
    if (body.catatan !== undefined) patch.catatan = body.catatan
    if (body.status !== undefined) patch.status = body.status
    if (body.late_minutes !== undefined) patch.late_minutes = body.late_minutes

    const record = db
      .update(attendanceRecords)
      .set(patch)
      .where(eq(attendanceRecords.id, id))
      .returning()
      .get()

    return { record }
  })
}
