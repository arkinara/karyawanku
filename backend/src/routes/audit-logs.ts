import type { FastifyInstance } from 'fastify'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { auditLogs, users } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'

/** Batas maksimal ukuran halaman; request yang lebih besar di-clamp ke nilai ini. */
const MAX_PAGE_SIZE = 100

const querySchema = z.object({
  entity_type: z.string().trim().max(100).optional(),
  entity_id: z.string().trim().max(200).optional(),
  actor_user_id: z.string().trim().max(200).optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

/**
 * Catatan audit (ticket #57) — READ-ONLY. Hanya Owner bisnis. Append-only:
 * tabel `audit_logs` TIDAK memiliki rute update/delete (lihat src/lib/audit.ts).
 */
export default async function auditLogsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/audit-logs', { preHandler: requireOwner }, async (req) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new ApiError(422, 'Parameter tidak valid', parsed.error.flatten())
    }
    const q = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const filters = [eq(auditLogs.business_id, user.business_id)]
    if (q.entity_type) filters.push(eq(auditLogs.entity_type, q.entity_type))
    if (q.entity_id) filters.push(eq(auditLogs.entity_id, q.entity_id))
    if (q.actor_user_id) filters.push(eq(auditLogs.actor_user_id, q.actor_user_id))
    if (q.start) filters.push(sql`date(${auditLogs.created_at}, 'unixepoch') >= ${q.start}`)
    if (q.end) filters.push(sql`date(${auditLogs.created_at}, 'unixepoch') <= ${q.end}`)

    const limit = Math.min(q.limit ?? 50, MAX_PAGE_SIZE)
    const offset = q.offset ?? 0

    const rows = db
      .select({
        log: auditLogs,
        actor: { id: users.id, nama: users.nama, email: users.email },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actor_user_id, users.id))
      .where(and(...filters))
      .orderBy(desc(auditLogs.created_at), desc(auditLogs.id))
      .limit(limit)
      .offset(offset)
      .all()

    const total =
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(...filters))
        .get()?.count ?? 0

    return {
      logs: rows.map((r) => ({
        id: r.log.id,
        actor: r.actor,
        action: r.log.action,
        entity_type: r.log.entity_type,
        entity_id: r.log.entity_id,
        before: r.log.before,
        after: r.log.after,
        created_at: r.log.created_at,
      })),
      total,
      limit,
      offset,
    }
  })
}