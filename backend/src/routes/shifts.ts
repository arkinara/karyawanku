import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { shifts } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam wajib berformat HH:MM')
const namaShiftSchema = z
  .enum(['Pagi', 'Siang', 'Malam', 'Libur'], { message: 'nama_shift harus Pagi, Siang, Malam, atau Libur' })

const createSchema = z.object({
  nama_shift: namaShiftSchema,
  jam_mulai: timeSchema,
  jam_selesai: timeSchema,
  aktif: z.boolean().optional(),
})

const updateSchema = z
  .object({
    nama_shift: namaShiftSchema.optional(),
    jam_mulai: timeSchema.optional(),
    jam_selesai: timeSchema.optional(),
    aktif: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

function validateTimeRange(jamMulai: string, jamSelesai: string): void {
  if (jamSelesai < jamMulai) {
    throw new ApiError(422, 'Jam selesai harus lebih besar atau sama dengan jam mulai')
  }
}

export default async function shiftsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.get('/shifts', async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const includeInactive = q.includeInactive === 'true'
    const { db } = getDb()

    const filters = [eq(shifts.business_id, user.business_id)]
    if (!includeInactive) filters.push(eq(shifts.aktif, true))

    const rows = db
      .select()
      .from(shifts)
      .where(and(...filters))
      .orderBy(asc(shifts.nama_shift))
      .all()

    return { shifts: rows }
  })

  app.post('/shifts', async (req) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data shift tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    validateTimeRange(data.jam_mulai, data.jam_selesai)

    const shift = db
      .insert(shifts)
      .values({
        business_id: user.business_id,
        nama_shift: data.nama_shift,
        jam_mulai: data.jam_mulai,
        jam_selesai: data.jam_selesai,
        aktif: data.aktif ?? true,
      })
      .returning()
      .get()

    return { shift }
  })

  app.patch('/shifts/:id', async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data shift tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Shift tidak ditemukan')
    }

    const jamMulai = data.jam_mulai ?? target.jam_mulai
    const jamSelesai = data.jam_selesai ?? target.jam_selesai
    validateTimeRange(jamMulai, jamSelesai)

    const patch: Record<string, unknown> = {}
    if (data.nama_shift !== undefined) patch.nama_shift = data.nama_shift
    if (data.jam_mulai !== undefined) patch.jam_mulai = data.jam_mulai
    if (data.jam_selesai !== undefined) patch.jam_selesai = data.jam_selesai
    if (data.aktif !== undefined) patch.aktif = data.aktif

    const updated = db.update(shifts).set(patch).where(eq(shifts.id, id)).returning().get()
    return { shift: updated }
  })

  app.delete('/shifts/:id', async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.business_id, user.business_id)))
      .get()
    if (!target) {
      throw new ApiError(404, 'Shift tidak ditemukan')
    }

    db.update(shifts).set({ aktif: false }).where(eq(shifts.id, id)).run()
    return { ok: true }
  })
}
