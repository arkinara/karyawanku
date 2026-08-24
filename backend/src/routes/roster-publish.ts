import type { FastifyInstance } from 'fastify'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { employees, shiftAssignments } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib berformat YYYY-MM-DD')

function assertValidDate(str: string): void {
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new ApiError(422, 'Tanggal tidak valid')
  }
}

const byIdsSchema = z.object({
  assignment_ids: z.array(z.string().min(1)).min(1, 'assignment_ids tidak boleh kosong'),
})

const byRangeSchema = z.object({
  start: dateSchema,
  end: dateSchema,
  employee_ids: z.array(z.string().min(1)).optional(),
})

function parseTarget(body: unknown): { ids?: string[]; start?: string; end?: string; employeeIds?: string[] } {
  if (Array.isArray(body) || body === null || typeof body !== 'object') {
    throw new ApiError(422, 'Body harus berisi assignment_ids atau rentang start/end')
  }
  const obj = body as Record<string, unknown>
  if (obj.assignment_ids !== undefined) {
    const parsed = byIdsSchema.safeParse(obj)
    if (!parsed.success) throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    return { ids: parsed.data.assignment_ids }
  }
  const parsed = byRangeSchema.safeParse(obj)
  if (!parsed.success) throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
  if (parsed.data.end < parsed.data.start) {
    throw new ApiError(422, 'Tanggal end harus lebih besar atau sama dengan start')
  }
  assertValidDate(parsed.data.start)
  assertValidDate(parsed.data.end)
  return { start: parsed.data.start, end: parsed.data.end, employeeIds: parsed.data.employee_ids }
}

function buildTargets(
  db: ReturnType<typeof getDb>['db'],
  businessId: string,
  target: ReturnType<typeof parseTarget>,
): string[] {
  if (target.ids) {
    const rows = db
      .select({ assignment: shiftAssignments, employee: employees })
      .from(shiftAssignments)
      .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
      .where(inArray(shiftAssignments.id, target.ids))
      .all()

    if (rows.length !== target.ids.length) {
      throw new ApiError(404, 'Sebagian penugasan shift tidak ditemukan')
    }
    for (const row of rows) {
      if (row.employee.business_id !== businessId) {
        throw new ApiError(404, 'Penugasan shift tidak ditemukan')
      }
    }
    return rows.map((r) => r.assignment.id)
  }

  const filters = [
    eq(employees.business_id, businessId),
    gte(shiftAssignments.tanggal, target.start!),
    lte(shiftAssignments.tanggal, target.end!),
  ]
  if (target.employeeIds) {
    filters.push(inArray(shiftAssignments.employee_id, target.employeeIds))
  }

  const rows = db
    .select({ assignment: shiftAssignments })
    .from(shiftAssignments)
    .innerJoin(employees, eq(shiftAssignments.employee_id, employees.id))
    .where(and(...filters))
    .all()

  return rows.map((r) => r.assignment.id)
}

export default async function rosterPublishRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireOwner)

  app.post('/roster/publish', async (req) => {
    const user = currentUser(req)
    const { db } = getDb()

    const target = parseTarget(req.body)
    const ids = buildTargets(db, user.business_id, target)
    if (ids.length === 0) {
      return { updated: 0, published_at: null, published_by_user_id: user.id }
    }

    const now = new Date()
    const updated = db
      .update(shiftAssignments)
      .set({ published: true, published_at: now, published_by_user_id: user.id })
      .where(inArray(shiftAssignments.id, ids))
      .returning()
      .all()

    return {
      updated: updated.length,
      published_at: now,
      published_by_user_id: user.id,
    }
  })

  app.post('/roster/unpublish', async (req) => {
    const user = currentUser(req)
    const { db } = getDb()

    const target = parseTarget(req.body)
    const ids = buildTargets(db, user.business_id, target)
    if (ids.length === 0) {
      return { updated: 0 }
    }

    const updated = db
      .update(shiftAssignments)
      .set({ published: false })
      .where(inArray(shiftAssignments.id, ids))
      .returning()
      .all()

    return { updated: updated.length }
  })
}
