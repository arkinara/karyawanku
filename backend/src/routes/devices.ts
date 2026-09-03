import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { pushDevices } from '../db/schema.js'
import { currentUser, requireAuth } from '../lib/auth.js'
import { ApiError, ForbiddenError } from '../lib/errors.js'

const registerSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  platform: z.enum(['android', 'ios'], { message: 'Platform harus android atau ios' }),
  app_version: z.string().max(50).optional(),
})

function serialize(row: typeof pushDevices.$inferSelect) {
  return {
    id: row.id,
    platform: row.platform,
    token: row.token,
    app_version: row.app_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export default async function devicesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Registrasi perangkat (ticket #71). Upsert pada (user_id, token): token yang
   * sudah terdaftar untuk user yang sama menimpa platform + app_version, tidak
   * membuat baris ganda. Token milik user lain → baris baru (setiap user punya
   * token FCM sendiri).
   */
  app.post('/devices', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data perangkat tidak valid', parsed.error.flatten())
    }
    const user = currentUser(req)
    const { db } = getDb()
    const now = new Date()

    const row = db
      .insert(pushDevices)
      .values({
        user_id: user.id,
        business_id: user.business_id,
        platform: parsed.data.platform,
        token: parsed.data.token,
        app_version: parsed.data.app_version ?? null,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [pushDevices.user_id, pushDevices.token],
        set: {
          platform: parsed.data.platform,
          app_version: parsed.data.app_version ?? null,
          updated_at: now,
        },
      })
      .returning()
      .get()

    return reply.code(201).send({ device: serialize(row) })
  })

  /** Daftar perangkat sendiri — dasar UI "di mana saya masuk" nanti. */
  app.get('/devices', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()
    const rows = db
      .select()
      .from(pushDevices)
      .where(eq(pushDevices.user_id, user.id))
      .all()
    return { devices: rows.map(serialize) }
  })

  /** Hapus perangkat sendiri (sign-out) — hanya pemiliknya. */
  app.delete('/devices/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const row = db.select().from(pushDevices).where(eq(pushDevices.id, id)).get()
    if (!row) throw new ApiError(404, 'Perangkat tidak ditemukan')
    if (row.user_id !== user.id) {
      throw new ForbiddenError('Anda hanya dapat menghapus perangkat Anda sendiri.')
    }
    db.delete(pushDevices).where(eq(pushDevices.id, id)).run()
    return reply.code(204).send()
  })

  /**
   * Invalidasi perangkat — endpoint admin/sistem untuk callback FCM-UNREGISTERED
   * (token ditolak provider). Pemilik boleh untuk perangkatnya sendiri; owner
   * boleh untuk perangkat bisnisnya. Idempoten: 204 walau sudah tidak ada.
   */
  app.post('/devices/:id/invalidate', { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const reason = (req.body as { reason?: unknown } | null)?.reason
    const { db } = getDb()

    const row = db.select().from(pushDevices).where(eq(pushDevices.id, id)).get()
    if (row) {
      const isOwnerOfDevice = row.user_id === user.id
      const isOwnerRole = user.role === 'owner' && row.business_id === user.business_id
      if (!isOwnerOfDevice && !isOwnerRole) {
        throw new ForbiddenError('Anda tidak memiliki izin untuk invalidasi perangkat ini.')
      }
      db.delete(pushDevices).where(eq(pushDevices.id, id)).run()
      console.log(`[push] perangkat ${id} dinvalidasi (${typeof reason === 'string' ? reason : 'FCM-UNREGISTERED'})`)
    }
    return reply.code(204).send()
  })
}