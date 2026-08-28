import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { employeeSalaryAssignments, employees, salaryComponents } from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, ConflictError } from '../lib/errors.js'

const overrideSchema = z.union([
  z.number().positive('Override nominal harus bilangan positif'),
  z.null(),
])

const createSchema = z.object({
  salary_component_id: z.string().min(1, 'salary_component_id wajib diisi'),
  override_nominal: overrideSchema.optional(),
  aktif: z.boolean().optional(),
})

const updateSchema = z
  .object({
    override_nominal: overrideSchema.optional(),
    aktif: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Tidak ada field yang diubah' })

export default async function salaryAssignmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/employees/:employeeId/salary-assignments', { preHandler: requireAuth }, async (req) => {
    const { employeeId } = req.params as { employeeId: string }
    const q = req.query as Record<string, unknown>
    const includeInactive = q.includeInactive === 'true'
    const user = currentUser(req)
    const { db } = getDb()

    const emp = db.select().from(employees).where(eq(employees.id, employeeId)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    const isOwner = user.role === 'owner'
    const isSelf = user.role === 'employee' && user.employee_id === emp.id
    if (!isOwner && !isSelf) {
      throw new ApiError(403, 'Anda tidak berhak mengakses data ini')
    }

    const filters = [eq(employeeSalaryAssignments.employee_id, employeeId)]
    if (!includeInactive) filters.push(eq(employeeSalaryAssignments.aktif, true))

    const rows = db
      .select()
      .from(employeeSalaryAssignments)
      .where(and(...filters))
      .all()

    const assignments = rows.map((a) => {
      const component = db
        .select()
        .from(salaryComponents)
        .where(eq(salaryComponents.id, a.salary_component_id))
        .get()
      const nilaiEfektif = a.override_nominal ?? component?.nominal ?? null
      return {
        ...a,
        nilai_efektif: nilaiEfektif,
        component: component
          ? {
              id: component.id,
              nama_komponen: component.nama_komponen,
              tipe: component.tipe,
              nominal: component.nominal,
              formula: component.formula,
              aktif: component.aktif,
            }
          : null,
      }
    })

    return { assignments }
  })

  app.post('/employees/:employeeId/salary-assignments', { preHandler: requireOwner }, async (req) => {
    const { employeeId } = req.params as { employeeId: string }
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data penugasan tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const emp = db
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.business_id, user.business_id)))
      .get()
    if (!emp) {
      throw new ApiError(404, 'Karyawan tidak ditemukan')
    }

    const component = db
      .select()
      .from(salaryComponents)
      .where(and(eq(salaryComponents.id, data.salary_component_id), eq(salaryComponents.business_id, user.business_id)))
      .get()
    if (!component) {
      throw new ApiError(404, 'Komponen gaji tidak ditemukan')
    }

    const aktif = data.aktif ?? true
    if (aktif) {
      const dup = db
        .select()
        .from(employeeSalaryAssignments)
        .where(
          and(
            eq(employeeSalaryAssignments.employee_id, employeeId),
            eq(employeeSalaryAssignments.salary_component_id, data.salary_component_id),
            eq(employeeSalaryAssignments.aktif, true),
          ),
        )
        .get()
      if (dup) {
        throw new ConflictError('Komponen gaji ini sudah ditugaskan secara aktif kepada karyawan')
      }
    }

    const assignment = db.transaction((tx) => {
      const created = tx
        .insert(employeeSalaryAssignments)
        .values({
          employee_id: employeeId,
          salary_component_id: data.salary_component_id,
          override_nominal: data.override_nominal ?? null,
          aktif,
        })
        .returning()
        .get()

      recordAudit({
        db: tx,
        businessId: user.business_id,
        actorUserId: user.id,
        action: 'salary_assignment.create',
        entityType: 'salary_assignment',
        entityId: created.id,
        before: null,
        after: created,
      })

      return created
    })

    return { assignment }
  })

  app.patch('/salary-assignments/:id', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data penugasan tidak valid', parsed.error.flatten())
    }
    const data = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const target = db.select().from(employeeSalaryAssignments).where(eq(employeeSalaryAssignments.id, id)).get()
    if (!target) {
      throw new ApiError(404, 'Penugasan tidak ditemukan')
    }
    const emp = db.select().from(employees).where(eq(employees.id, target.employee_id)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Penugasan tidak ditemukan')
    }

    const newAktif = data.aktif !== undefined ? data.aktif : target.aktif
    if (newAktif) {
      const dup = db
        .select()
        .from(employeeSalaryAssignments)
        .where(
          and(
            eq(employeeSalaryAssignments.employee_id, target.employee_id),
            eq(employeeSalaryAssignments.salary_component_id, target.salary_component_id),
            eq(employeeSalaryAssignments.aktif, true),
          ),
        )
        .all()
        .find((a) => a.id !== target.id)
      if (dup) {
        throw new ConflictError('Komponen gaji ini sudah ditugaskan secara aktif kepada karyawan')
      }
    }

    const patch: Record<string, unknown> = {}
    if (data.override_nominal !== undefined) patch.override_nominal = data.override_nominal
    if (data.aktif !== undefined) patch.aktif = data.aktif

    const updated = db.transaction((tx) => {
      const changed = tx
        .update(employeeSalaryAssignments)
        .set(patch)
        .where(eq(employeeSalaryAssignments.id, id))
        .returning()
        .get()

      recordAudit({
        db: tx,
        businessId: user.business_id,
        actorUserId: user.id,
        action: 'salary_assignment.update',
        entityType: 'salary_assignment',
        entityId: id,
        before: target,
        after: changed,
      })

      return changed
    })
    return { assignment: updated }
  })

  app.delete('/salary-assignments/:id', { preHandler: requireOwner }, async (req) => {
    const { id } = req.params as { id: string }
    const user = currentUser(req)
    const { db } = getDb()

    const target = db.select().from(employeeSalaryAssignments).where(eq(employeeSalaryAssignments.id, id)).get()
    if (!target) {
      throw new ApiError(404, 'Penugasan tidak ditemukan')
    }
    const emp = db.select().from(employees).where(eq(employees.id, target.employee_id)).get()
    if (!emp || emp.business_id !== user.business_id) {
      throw new ApiError(404, 'Penugasan tidak ditemukan')
    }

    db.update(employeeSalaryAssignments).set({ aktif: false }).where(eq(employeeSalaryAssignments.id, id)).run()
    return { ok: true }
  })
}
