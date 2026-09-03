import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { reminderSettings } from '../db/schema.js'
import { currentUser, requireAuth } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'

/** Lead time yang diizinkan UI Jadwal (dropdown 15/30/60 menit). */
export const ALLOWED_LEAD_MINUTES = [15, 30, 60] as const

const patchSchema = z
  .object({
    shift_reminders_enabled: z.boolean().optional(),
    reminder_lead_minutes: z
      .number()
      .int()
      .refine((v) => (ALLOWED_LEAD_MINUTES as readonly number[]).includes(v), {
        message: 'Lead time pengingat harus 15, 30, atau 60 menit',
      })
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada preferensi yang diubah' })

function serialize(row: typeof reminderSettings.$inferSelect | undefined) {
  return {
    shift_reminders_enabled: row?.shift_reminders_enabled ?? true,
    reminder_lead_minutes: row?.reminder_lead_minutes ?? 30,
  }
}

export default async function notificationPrefsRoutes(app: FastifyInstance): Promise<void> {
  /** Preferensi notifikasi user sendiri (default: aktif, 30 menit). */
  app.get('/notification-prefs/me', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()
    const row = db.select().from(reminderSettings).where(eq(reminderSettings.user_id, user.id)).get()
    return { preferences: serialize(row) }
  })

  /** Simpan sebagian preferensi. Baris dibuat saat pertama kali disimpan. */
  app.patch('/notification-prefs/me', { preHandler: requireAuth }, async (req) => {
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data preferensi tidak valid', parsed.error.flatten())
    }
    const user = currentUser(req)
    const { db } = getDb()

    const existing = db.select().from(reminderSettings).where(eq(reminderSettings.user_id, user.id)).get()
    const enabled = parsed.data.shift_reminders_enabled ?? existing?.shift_reminders_enabled ?? true
    const lead = parsed.data.reminder_lead_minutes ?? existing?.reminder_lead_minutes ?? 30

    db.insert(reminderSettings)
      .values({
        user_id: user.id,
        shift_reminders_enabled: enabled,
        reminder_lead_minutes: lead,
      })
      .onConflictDoUpdate({
        target: reminderSettings.user_id,
        set: { shift_reminders_enabled: enabled, reminder_lead_minutes: lead },
      })
      .run()

    return { preferences: { shift_reminders_enabled: enabled, reminder_lead_minutes: lead } }
  })
}