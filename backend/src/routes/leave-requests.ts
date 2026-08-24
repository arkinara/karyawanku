import type { FastifyInstance } from 'fastify'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { employees, leaveBalances, leaveRequests, leaveTypes } from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { ApiError, ConflictError, ForbiddenError } from '../lib/errors.js'
import { ensureLeaveBalance, referenceDateForYear } from '../lib/leave-reset.js'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib berformat YYYY-MM-DD')

const createSchema = z.object({
  leave_type_id: z.string().min(1, 'Jenis cuti wajib diisi'),
  tanggal_mulai: dateSchema,
  tanggal_selesai: dateSchema,
  alasan: z.string().max(1000, 'Alasan maksimal 1000 karakter').optional(),
})

const catatanSchema = z.object({
  catatan_approver: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional(),
})

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function daysBetween(start: string, end: string): number {
  const a = parseDate(start).getTime()
  const b = parseDate(end).getTime()
  return Math.round((b - a) / 86400000) + 1
}

export interface LeaveRequestRow {
  request: typeof leaveRequests.$inferSelect
  employee_name: string
  leave_type_name: string
}

function serialize(row: LeaveRequestRow) {
  return {
    id: row.request.id,
    employee_id: row.request.employee_id,
    employee_name: row.employee_name,
    leave_type_id: row.request.leave_type_id,
    leave_type_name: row.leave_type_name,
    tanggal_mulai: row.request.tanggal_mulai,
    tanggal_selesai: row.request.tanggal_selesi,
    alasan: row.request.alasan,
    status: row.request.status,
    approver_user_id: row.request.approver_user_id,
    catatan_approver: row.request.catatan_approver,
    created_at: row.request.created_at,
    decided_at: row.request.decided_at,
  }
}

export default async function leaveRequestsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/leave-requests', { preHandler: requireAuth }, async (req) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data pengajuan cuti tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, user.employee_id), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')

    const type = db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.id, data.leave_type_id), eq(leaveTypes.business_id, user.business_id)))
      .get()
    if (!type || !type.aktif) throw new ApiError(404, 'Jenis cuti tidak ditemukan')

    const today = localDateStr(new Date())
    if (data.tanggal_mulai < today) {
      throw new ApiError(422, 'Tanggal mulai tidak boleh di masa lalu')
    }
    if (data.tanggal_selesai < data.tanggal_mulai) {
      throw new ApiError(422, 'Tanggal selesai harus lebih besar atau sama dengan tanggal mulai')
    }
    const requestedDays = daysBetween(data.tanggal_mulai, data.tanggal_selesai)

    if (type.default_kuota_hari > 0) {
      const tahun = Number(data.tanggal_mulai.split('-')[0])
      const balance = ensureLeaveBalance(emp, type, tahun, referenceDateForYear(tahun))
      const remaining = balance.kuota_hari - balance.terpakai_hari
      if (requestedDays > remaining) {
        throw new ApiError(422, `Sisa kuota cuti tidak mencukupi (sisa ${remaining} hari)`)
      }
    }

    const request = db
      .insert(leaveRequests)
      .values({
        employee_id: emp.id,
        leave_type_id: type.id,
        tanggal_mulai: data.tanggal_mulai,
        tanggal_selesi: data.tanggal_selesai,
        alasan: data.alasan ?? null,
        status: 'pending',
      })
      .returning()
      .get()

    return {
      request: serialize({
        request,
        employee_name: emp.nama_lengkap,
        leave_type_name: type.nama_jenis_cuti,
      }),
    }
  })

  app.get('/leave-requests', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const { db } = getDb()

    const filters = [eq(employees.business_id, user.business_id)]
    if (user.role === 'employee') {
      if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
      filters.push(eq(leaveRequests.employee_id, user.employee_id))
    } else if (q.employee_id) {
      filters.push(eq(leaveRequests.employee_id, String(q.employee_id)))
    }
    if (q.status) {
      const status = String(q.status)
      if (!['pending', 'disetujui', 'ditolak'].includes(status)) {
        throw new ApiError(422, 'Status tidak valid')
      }
      filters.push(eq(leaveRequests.status, status as typeof leaveRequests.$inferSelect.status))
    }

    const rows = db
      .select({
        request: leaveRequests,
        employee_name: employees.nama_lengkap,
        leave_type_name: leaveTypes.nama_jenis_cuti,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employee_id, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leave_type_id, leaveTypes.id))
      .where(and(...filters))
      .orderBy(desc(leaveRequests.created_at))
      .all()

    return { requests: rows.map((r) => serialize({ request: r.request, employee_name: r.employee_name, leave_type_name: r.leave_type_name })) }
  })

  app.get('/leave-requests/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const row = db
      .select({
        request: leaveRequests,
        employee_name: employees.nama_lengkap,
        leave_type_name: leaveTypes.nama_jenis_cuti,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employee_id, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leave_type_id, leaveTypes.id))
      .where(eq(leaveRequests.id, id))
      .get()

    if (!row || row.request.employee_id !== user.employee_id) {
      if (!row) throw new ApiError(404, 'Pengajuan cuti tidak ditemukan')
      const emp = db
        .select()
        .from(employees)
        .where(and(eq(employees.id, row.request.employee_id), eq(employees.business_id, user.business_id)))
        .get()
      if (user.role === 'owner' && emp) {
        return serialize({ request: row.request, employee_name: row.employee_name, leave_type_name: row.leave_type_name })
      }
      if (user.role === 'owner') throw new ApiError(404, 'Pengajuan cuti tidak ditemukan')
      throw new ForbiddenError('Anda hanya dapat melihat pengajuan cuti Anda sendiri.')
    }

    return { request: serialize({ request: row.request, employee_name: row.employee_name, leave_type_name: row.leave_type_name }) }
  })

  app.patch('/leave-requests/:id/approve', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = catatanSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const user = currentUser(req)
    const { db } = getDb()

    const row = db
      .select({ request: leaveRequests, employee: employees })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employee_id, employees.id))
      .where(eq(leaveRequests.id, id))
      .get()
    if (!row || row.employee.business_id !== user.business_id) {
      throw new ApiError(404, 'Pengajuan cuti tidak ditemukan')
    }
    if (row.request.status !== 'pending') {
      throw new ConflictError('Pengajuan cuti sudah diputuskan')
    }

    const type = db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, row.request.leave_type_id))
      .get()
    const tahun = Number(row.request.tanggal_mulai.split('-')[0])
    const requestedDays = daysBetween(row.request.tanggal_mulai, row.request.tanggal_selesi)

    if (type && type.default_kuota_hari > 0) {
      const balance = ensureLeaveBalance(row.employee, type, tahun, referenceDateForYear(tahun))
      const remaining = balance.kuota_hari - balance.terpakai_hari
      if (requestedDays > remaining) {
        throw new ConflictError('Sisa kuota cuti tidak mencukupi')
      }
      db.update(leaveBalances)
        .set({ terpakai_hari: sql`${leaveBalances.terpakai_hari} + ${requestedDays}` })
        .where(eq(leaveBalances.id, balance.id))
        .run()
    }

    const updated = db
      .update(leaveRequests)
      .set({
        status: 'disetujui',
        approver_user_id: user.id,
        catatan_approver: parsed.data.catatan_approver ?? row.request.catatan_approver,
        decided_at: new Date(),
      })
      .where(eq(leaveRequests.id, id))
      .returning()
      .get()

    return { request: serialize({ request: updated, employee_name: row.employee.nama_lengkap, leave_type_name: type?.nama_jenis_cuti ?? '' }) }
  })

  app.patch('/leave-requests/:id/reject', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = catatanSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const user = currentUser(req)
    const { db } = getDb()

    const row = db
      .select({ request: leaveRequests, employee: employees })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employee_id, employees.id))
      .where(eq(leaveRequests.id, id))
      .get()
    if (!row || row.employee.business_id !== user.business_id) {
      throw new ApiError(404, 'Pengajuan cuti tidak ditemukan')
    }
    if (row.request.status !== 'pending') {
      throw new ConflictError('Pengajuan cuti sudah diputuskan')
    }

    const type = db.select().from(leaveTypes).where(eq(leaveTypes.id, row.request.leave_type_id)).get()

    const updated = db
      .update(leaveRequests)
      .set({
        status: 'ditolak',
        approver_user_id: user.id,
        catatan_approver: parsed.data.catatan_approver ?? row.request.catatan_approver,
        decided_at: new Date(),
      })
      .where(eq(leaveRequests.id, id))
      .returning()
      .get()

    return { request: serialize({ request: updated, employee_name: row.employee.nama_lengkap, leave_type_name: type?.nama_jenis_cuti ?? '' }) }
  })
}
