import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { leaveTypes, type LeavePolicy } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'
import { ensureLeaveTypesSeeded } from '../lib/leave-reset.js'

const namaSchema = z.string().min(1, 'Nama jenis cuti wajib diisi').max(100, 'Nama jenis cuti maksimal 100 karakter')
const kuotaSchema = z
  .number({ message: 'Kuota hari harus angka' })
  .int('Kuota hari harus bilangan bulat')
  .positive('Kuota hari harus lebih dari 0')
const kebijakanSchema = z.enum(['hangus', 'carry-over'], { message: 'Kebijakan sisa harus hangus atau carry-over' })
const carryOverSchema = z
  .union([
    z.number({ message: 'Batas carry-over harus angka' }).int().nonnegative('Batas carry-over tidak boleh negatif'),
    z.null(),
  ])
  .optional()

const createSchema = z.object({
  nama_jenis_cuti: namaSchema,
  default_kuota_hari: kuotaSchema,
  kebijakan_sisa: kebijakanSchema.optional(),
  carry_over_max_days: carryOverSchema,
})

const updateSchema = z
  .object({
    nama_jenis_cuti: namaSchema.optional(),
    default_kuota_hari: kuotaSchema.optional(),
    kebijakan_sisa: kebijakanSchema.optional(),
    carry_over_max_days: carryOverSchema,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

export default async function leaveTypesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.get('/leave-types', async (req) => {
    const user = currentUser(req)
    const { db } = getDb()
    ensureLeaveTypesSeeded(user.business_id)

    const rows = db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.business_id, user.business_id), eq(leaveTypes.aktif, true)))
      .orderBy(asc(leaveTypes.nama_jenis_cuti))
      .all()

    return { leave_types: rows }
  })

  app.post('/leave-types', async (req) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data jenis cuti tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const type = db
      .insert(leaveTypes)
      .values({
        business_id: user.business_id,
        nama_jenis_cuti: data.nama_jenis_cuti,
        default_kuota_hari: data.default_kuota_hari,
        kebijakan_sisa: data.kebijakan_sisa ?? 'hangus',
        carry_over_max_days: data.carry_over_max_days === undefined ? null : data.carry_over_max_days,
        aktif: true,
      })
      .returning()
      .get()

    return { leave_type: type }
  })

  app.patch('/leave-types/:id', async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data jenis cuti tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.id, id), eq(leaveTypes.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Jenis cuti tidak ditemukan')
    }

    const patch: Record<string, unknown> = {}
    if (data.nama_jenis_cuti !== undefined) patch.nama_jenis_cuti = data.nama_jenis_cuti
    if (data.default_kuota_hari !== undefined) patch.default_kuota_hari = data.default_kuota_hari
    if (data.kebijakan_sisa !== undefined) patch.kebijakan_sisa = data.kebijakan_sisa as LeavePolicy
    if (data.carry_over_max_days !== undefined) patch.carry_over_max_days = data.carry_over_max_days

    const updated = db.update(leaveTypes).set(patch).where(eq(leaveTypes.id, id)).returning().get()
    return { leave_type: updated }
  })

  app.delete('/leave-types/:id', async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.id, id), eq(leaveTypes.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Jenis cuti tidak ditemukan')
    }

    db.update(leaveTypes).set({ aktif: false }).where(eq(leaveTypes.id, id)).run()
    return { ok: true }
  })
}
