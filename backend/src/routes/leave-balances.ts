import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { employees, leaveBalances, leaveTypes } from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { ApiError, ForbiddenError } from '../lib/errors.js'
import { ensureLeaveTypesSeeded, ensureLeaveBalance, referenceDateForYear } from '../lib/leave-reset.js'

const yearSchema = z.coerce.number().int().min(2000, 'Tahun tidak valid').max(2100, 'Tahun tidak valid')

const patchBalanceSchema = z
  .object({
    kuota_hari: z
      .number({ message: 'Kuota harus angka' })
      .nonnegative('Kuota tidak boleh negatif')
      .optional(),
    terpakai_hari: z
      .number({ message: 'Terpakai harus angka' })
      .nonnegative('Terpakai tidak boleh negatif')
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

export default async function leaveBalancesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/leave-balances', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const { db } = getDb()

    const tahun = yearSchema.safeParse(q.tahun ?? new Date().getUTCFullYear())
    if (!tahun.success) throw new ApiError(422, 'Tahun tidak valid', tahun.error.flatten())

    let employeeId: string
    if (user.role === 'owner') {
      const raw = q.employee_id
      if (!raw) throw new ApiError(422, 'employee_id wajib diisi')
      const emp = db
        .select()
        .from(employees)
        .where(and(eq(employees.id, String(raw)), eq(employees.business_id, user.business_id)))
        .get()
      if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')
      employeeId = emp.id
    } else {
      if (!user.employee_id) throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
      if (q.employee_id && String(q.employee_id) !== user.employee_id) {
        throw new ForbiddenError('Anda hanya dapat melihat saldo cuti Anda sendiri.')
      }
      employeeId = user.employee_id
    }

    ensureLeaveTypesSeeded(user.business_id)
    const types = db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.business_id, user.business_id), eq(leaveTypes.aktif, true)))
      .all()
    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Karyawan tidak ditemukan')

    const reference = referenceDateForYear(tahun.data)
    for (const type of types) {
      ensureLeaveBalance(emp, type, tahun.data, reference)
    }

    const rows = db
      .select({
        balance: leaveBalances,
        leave_type: leaveTypes,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leave_type_id, leaveTypes.id))
      .where(
        and(
          eq(leaveBalances.employee_id, employeeId),
          eq(leaveBalances.tahun, tahun.data),
          eq(leaveTypes.business_id, user.business_id),
        ),
      )
      .orderBy(asc(leaveTypes.nama_jenis_cuti))
      .all()

    const balances = rows.map((r) => ({
      id: r.balance.id,
      employee_id: r.balance.employee_id,
      leave_type_id: r.balance.leave_type_id,
      nama_jenis_cuti: r.leave_type.nama_jenis_cuti,
      tahun: r.balance.tahun,
      kuota_hari: r.balance.kuota_hari,
      terpakai_hari: r.balance.terpakai_hari,
      sisa_hari: r.balance.kuota_hari - r.balance.terpakai_hari,
    }))

    return { employee_id: employeeId, tahun: tahun.data, balances }
  })

  app.patch('/leave-balances/:id', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = patchBalanceSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data saldo cuti tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const balance = db.select().from(leaveBalances).where(eq(leaveBalances.id, id)).get()
    if (!balance) throw new ApiError(404, 'Saldo cuti tidak ditemukan')
    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, balance.employee_id), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) throw new ApiError(404, 'Saldo cuti tidak ditemukan')

    const patch: Record<string, unknown> = {}
    if (data.kuota_hari !== undefined) patch.kuota_hari = data.kuota_hari
    if (data.terpakai_hari !== undefined) patch.terpakai_hari = data.terpakai_hari

    const updated = db.update(leaveBalances).set(patch).where(eq(leaveBalances.id, id)).returning().get()
    return { balance: updated }
  })

  app.post('/admin/leave-reset', { preHandler: requireOwner }, async (req) => {
    const user = currentUser(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const parsed = yearSchema.safeParse(body.tahun ?? new Date().getUTCFullYear())
    if (!parsed.success) throw new ApiError(422, 'Tahun tidak valid', parsed.error.flatten())

    const { runYearlyReset } = await import('../lib/leave-reset.js')
    const result = runYearlyReset(user.business_id, parsed.data)
    return result
  })
}
