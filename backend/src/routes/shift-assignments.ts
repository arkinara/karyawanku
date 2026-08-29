import type { FastifyInstance } from 'fastify'
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { employees, shiftAssignments, shifts } from '../db/schema.js'
import { currentUser, requireAuth, requireCapability } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'
import { offsetOf, paginateResult, parsePagination } from '../lib/pagination.js'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib berformat YYYY-MM-DD')

function assertValidDate(str: string): void {
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new ApiError(422, 'Tanggal tidak valid')
  }
}

const createSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  shift_id: z.string().min(1, 'shift_id wajib diisi'),
  tanggal: dateSchema,
  published: z.boolean().optional(),
})

const updateSchema = z
  .object({
    employee_id: z.string().min(1).optional(),
    shift_id: z.string().min(1).optional(),
    tanggal: dateSchema.optional(),
    published: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface ShiftAssignmentRow {
  assignment: typeof shiftAssignments.$inferSelect
  employee_name: string
  shift: typeof shifts.$inferSelect | null
}

function serialize(row: ShiftAssignmentRow) {
  return {
    id: row.assignment.id,
    employee_id: row.assignment.employee_id,
    employee_name: row.employee_name,
    shift_id: row.assignment.shift_id,
    shift: row.shift
      ? {
          id: row.shift.id,
          nama_shift: row.shift.nama_shift,
          jam_mulai: row.shift.jam_mulai,
          jam_selesai: row.shift.jam_selesai,
          aktif: row.shift.aktif,
        }
      : null,
    tanggal: row.assignment.tanggal,
    published: row.assignment.published,
    published_at: row.assignment.published_at,
    published_by_user_id: row.assignment.published_by_user_id,
  }
}

export default async function shiftAssignmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/shift-assignments/upcoming', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()

    const today = localDateStr(new Date())
    const end = localDateStr(new Date(Date.now() + 2 * 86400000))

    const filters = [
      eq(employees.business_id, user.business_id),
      eq(shiftAssignments.published, true),
      gte(shiftAssignments.tanggal, today),
      lte(shiftAssignments.tanggal, end),
    ]
    if (user.role === 'employee') {
      if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
      filters.push(eq(shiftAssignments.employee_id, user.employee_id))
    }

    const rows = db
      .select({
        assignment: shiftAssignments,
        employee_name: employees.nama_lengkap,
        shift: shifts,
      })
      .from(shiftAssignments)
      .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
      .innerJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
      .where(and(...filters))
      .orderBy(asc(shiftAssignments.tanggal))
      .all()

    return { assignments: rows.map((r) => serialize(r)) }
  })

  app.get('/shift-assignments', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const { page, limit } = parsePagination(q)
    const offset = offsetOf({ page, limit })
    const { db } = getDb()

    const filters = [eq(employees.business_id, user.business_id)]
    if (user.role === 'employee') {
      if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
      filters.push(eq(shiftAssignments.employee_id, user.employee_id))
      filters.push(eq(shiftAssignments.published, true))
    } else if (q.employee_id) {
      filters.push(eq(shiftAssignments.employee_id, String(q.employee_id)))
    }

    if (q.start !== undefined) {
      const start = String(q.start)
      if (!dateSchema.safeParse(start).success) throw new ApiError(422, 'Parameter start wajib berformat YYYY-MM-DD')
      assertValidDate(start)
      filters.push(gte(shiftAssignments.tanggal, start))
    }
    if (q.end !== undefined) {
      const end = String(q.end)
      if (!dateSchema.safeParse(end).success) throw new ApiError(422, 'Parameter end wajib berformat YYYY-MM-DD')
      assertValidDate(end)
      filters.push(lte(shiftAssignments.tanggal, end))
    }
    if (q.start !== undefined && q.end !== undefined && String(q.end) < String(q.start)) {
      throw new ApiError(422, 'Tanggal end harus lebih besar atau sama dengan start')
    }
    const where = and(...filters)

    const rows = db
      .select({
        assignment: shiftAssignments,
        employee_name: employees.nama_lengkap,
        shift: shifts,
      })
      .from(shiftAssignments)
      .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
      .leftJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
      .where(where)
      .orderBy(desc(shiftAssignments.tanggal), desc(shiftAssignments.id))
      .limit(limit)
      .offset(offset)
      .all()

    const total =
      db
        .select({ c: count() })
        .from(shiftAssignments)
        .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
        .where(where)
        .get()?.c ?? 0

    return paginateResult(rows.map((r) => serialize(r)), total, { page, limit })
  })

  app.post('/shift-assignments', { preHandler: requireCapability('roster.publish') }, async (req) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data penugasan shift tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    assertValidDate(data.tanggal)

    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, data.employee_id), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    const shift = db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, data.shift_id), eq(shifts.business_id, user.business_id)))
      .get()
    if (!shift) {
      throw new ApiError(404, 'Shift tidak ditemukan')
    }

    const published = data.published ?? false

    const assignment = db
      .insert(shiftAssignments)
      .values({
        employee_id: emp.id,
        shift_id: shift.id,
        tanggal: data.tanggal,
        published,
      })
      .returning()
      .get()

    return {
      assignment: serialize({
        assignment,
        employee_name: emp.nama_lengkap,
        shift,
      }),
    }
  })

  app.patch('/shift-assignments/:id', { preHandler: requireCapability('roster.publish') }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data penugasan shift tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db.select().from(shiftAssignments).where(eq(shiftAssignments.id, id)).get()
    if (!target) {
      throw new ApiError(404, 'Penugasan shift tidak ditemukan')
    }
    const emp = db.select().from(employees).where(eq(employees.id, target.employee_id)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Penugasan shift tidak ditemukan')
    }

    const newEmployeeId = data.employee_id ?? target.employee_id
    const newShiftId = data.shift_id ?? target.shift_id

    if (data.employee_id !== undefined) {
      const newEmp = db
        .select()
        .from(employees)
        .where(and(eq(employees.id, newEmployeeId), eq(employees.business_id, user.business_id)))
        .get()
      if (!newEmp) {
        throw new ApiError(404, 'Karyawan tidak ditemukan')
      }
    }
    if (data.shift_id !== undefined) {
      const newShift = db
        .select()
        .from(shifts)
        .where(and(eq(shifts.id, newShiftId), eq(shifts.business_id, user.business_id)))
        .get()
      if (!newShift) {
        throw new ApiError(404, 'Shift tidak ditemukan')
      }
    }

    const patch: Record<string, unknown> = {}
    if (data.employee_id !== undefined) patch.employee_id = newEmployeeId
    if (data.shift_id !== undefined) patch.shift_id = newShiftId
    if (data.tanggal !== undefined) {
      assertValidDate(data.tanggal)
      patch.tanggal = data.tanggal
    }
    if (data.published !== undefined) patch.published = data.published

    const updated = db.update(shiftAssignments).set(patch).where(eq(shiftAssignments.id, id)).returning().get()

    const row = db
      .select({ assignment: shiftAssignments, employee_name: employees.nama_lengkap, shift: shifts })
      .from(shiftAssignments)
      .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
      .leftJoin(shifts, eq(shiftAssignments.shift_id, shifts.id))
      .where(eq(shiftAssignments.id, id))
      .get()

    return { assignment: serialize(row ?? { assignment: updated, employee_name: '', shift: null }) }
  })

  app.delete('/shift-assignments/:id', { preHandler: requireCapability('roster.publish') }, async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db.select().from(shiftAssignments).where(eq(shiftAssignments.id, id)).get()
    if (!target) {
      throw new ApiError(404, 'Penugasan shift tidak ditemukan')
    }
    const emp = db.select().from(employees).where(eq(employees.id, target.employee_id)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Penugasan shift tidak ditemukan')
    }

    db.delete(shiftAssignments).where(eq(shiftAssignments.id, id)).run()
    return { ok: true }
  })
}
