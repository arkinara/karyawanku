import type { FastifyInstance } from 'fastify'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import {
  employees,
  employeeSalaryAssignments,
  salaryComponents,
  thrPayments,
} from '../db/schema.js'
import { currentUser, requireAuth, requireCapability } from '../lib/auth.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, ConflictError } from '../lib/errors.js'
import { computeThr, type ThrSalaryComponent } from '../lib/thr.js'

const calculateSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  periode: z.string().regex(/^\d{4}$/, 'periode wajib berformat YYYY'),
  tanggal_bayar: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal_bayar wajib berformat YYYY-MM-DD'),
  notes: z.string().trim().max(500).optional(),
})

function getThrSalaryComponents(
  db: ReturnType<typeof getDb>['db'],
  employeeId: string,
): ThrSalaryComponent[] {
  const rows = db
    .select({ assignment: employeeSalaryAssignments, component: salaryComponents })
    .from(employeeSalaryAssignments)
    .innerJoin(salaryComponents, eq(employeeSalaryAssignments.salary_component_id, salaryComponents.id))
    .where(
      and(
        eq(employeeSalaryAssignments.employee_id, employeeId),
        eq(employeeSalaryAssignments.aktif, true),
        eq(salaryComponents.aktif, true),
        eq(salaryComponents.tipe, 'earning'),
      ),
    )
    .all()

  return rows.map((r) => ({
    nama_komponen: r.component.nama_komponen,
    is_fixed: r.component.is_fixed,
    nilai: r.assignment.override_nominal ?? r.component.nominal ?? 0,
  }))
}

function assertEmployeeInBusiness(
  db: ReturnType<typeof getDb>['db'],
  employeeId: string,
  businessId: string,
) {
  const emp = db.select().from(employees).where(eq(employees.id, employeeId)).get()
  if (!emp || emp.business_id !== businessId) {
    throw new ApiError(404, 'Karyawan tidak ditemukan')
  }
  return emp
}

function serializePayment(
  db: ReturnType<typeof getDb>['db'],
  payment: (typeof thrPayments.$inferSelect) & { employee?: typeof employees.$inferSelect },
) {
  const emp: typeof employees.$inferSelect | undefined =
    payment.employee ?? db.select().from(employees).where(eq(employees.id, payment.employee_id)).get()
  return {
    ...payment,
    employee: {
      id: emp?.id ?? null,
      nama_lengkap: emp?.nama_lengkap ?? null,
      no_ktp: emp?.no_ktp ?? null,
    },
  }
}

export default async function thrRoutes(app: FastifyInstance): Promise<void> {
  app.post('/thr/calculate', { preHandler: requireAuth }, async (req) => {
    const parsed = calculateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data THR tidak valid', parsed.error.flatten())
    }
    const { employee_id, periode, tanggal_bayar } = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const emp = assertEmployeeInBusiness(db, employee_id, user.business_id)
    const components = getThrSalaryComponents(db, employee_id)
    const calculation = computeThr(
      { tanggal_masuk: emp.tanggal_masuk, salaryComponents: components },
      { referenceDate: tanggal_bayar },
    )

    return {
      employee: { id: emp.id, nama_lengkap: emp.nama_lengkap, tanggal_masuk: emp.tanggal_masuk },
      calculation,
      disbursement_preview: {
        periode,
        tanggal_bayar,
        amount: calculation.amount,
        basis: calculation.basis,
        months_of_service: calculation.monthsOfService,
        proportion: calculation.proportion,
        eligible: calculation.eligible,
      },
    }
  })

  app.post('/thr/disburse', { preHandler: requireCapability('payroll.run') }, async (req, reply) => {
    const parsed = calculateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data THR tidak valid', parsed.error.flatten())
    }
    const { employee_id, periode, tanggal_bayar, notes } = parsed.data
    const user = currentUser(req)
    const { db } = getDb()

    const emp = assertEmployeeInBusiness(db, employee_id, user.business_id)

    const existing = db
      .select()
      .from(thrPayments)
      .where(and(eq(thrPayments.employee_id, employee_id), eq(thrPayments.periode, periode)))
      .get()
    if (existing) {
      throw new ConflictError(`THR periode ${periode} sudah dicairkan untuk karyawan ini`)
    }

    const components = getThrSalaryComponents(db, employee_id)
    const calculation = computeThr(
      { tanggal_masuk: emp.tanggal_masuk, salaryComponents: components },
      { referenceDate: tanggal_bayar },
    )

    const payment = db.transaction((tx) => {
      const created = tx
        .insert(thrPayments)
        .values({
          employee_id,
          business_id: user.business_id,
          periode,
          tanggal_bayar,
          amount: calculation.amount,
          basis: calculation.basis,
          months_of_service: calculation.monthsOfService,
          proportion: calculation.proportion,
          created_by: user.id,
          notes: notes ?? null,
        })
        .returning()
        .get()

      recordAudit({
        db: tx,
        businessId: user.business_id,
        actorUserId: user.id,
        action: 'thr.disburse',
        entityType: 'thr_payment',
        entityId: created.id,
        before: null,
        after: {
          employee_id: created.employee_id,
          periode: created.periode,
          tanggal_bayar: created.tanggal_bayar,
          amount: created.amount,
          basis: created.basis,
          months_of_service: created.months_of_service,
          proportion: created.proportion,
          notes: created.notes,
        },
      })

      return created
    })

    reply.code(201)
    return { payment: serializePayment(db, payment) }
  })

  app.get('/thr/payments', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const { db } = getDb()

    const filters = [eq(thrPayments.business_id, user.business_id)]
    if (q.periode) filters.push(eq(thrPayments.periode, String(q.periode)))

    const rows = db
      .select({ payment: thrPayments, employee: employees })
      .from(thrPayments)
      .innerJoin(employees, eq(thrPayments.employee_id, employees.id))
      .where(and(...filters))
      .orderBy(asc(thrPayments.periode), asc(employees.nama_lengkap))
      .all()

    const payments = rows.map((r) => serializePayment(db, { ...r.payment, employee: r.employee }))
    return { payments }
  })

  app.get('/thr/payments/:id', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const row = db
      .select({ payment: thrPayments, employee: employees })
      .from(thrPayments)
      .innerJoin(employees, eq(thrPayments.employee_id, employees.id))
      .where(eq(thrPayments.id, id))
      .get()
    if (!row || row.payment.business_id !== user.business_id) {
      throw new ApiError(404, 'Pembayaran THR tidak ditemukan')
    }

    return { payment: serializePayment(db, { ...row.payment, employee: row.employee }) }
  })
}