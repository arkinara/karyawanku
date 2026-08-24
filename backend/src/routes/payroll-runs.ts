import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import {
  attendanceRecords,
  employees,
  employeeSalaryAssignments,
  payrollItems,
  payrollRuns,
  salaryComponents,
} from '../db/schema.js'
import { currentUser, requireAuth, requireOwner } from '../lib/auth.js'
import { ApiError, ConflictError } from '../lib/errors.js'
import { generatePayslipsForRun } from '../lib/payslip-generator.js'
import {
  computePayrollItem,
  type AttendanceAggregate,
  type PayrollAssignment,
} from '../lib/payroll.js'

const createRunSchema = z.object({
  periode: z.string().regex(/^\d{4}-\d{2}$/, 'periode wajib berformat YYYY-MM'),
})

const correctionSchema = z.object({
  koreksi: z.number().finite(),
  catatan_koreksi: z.string().trim().max(500).optional(),
})

function recomputeRunTotals(db: ReturnType<typeof getDb>['db'], runId: string): void {
  const items = db.select().from(payrollItems).where(eq(payrollItems.payroll_run_id, runId)).all()
  let totalGaji = 0
  let totalPotongan = 0
  let totalTakeHome = 0
  for (const it of items) {
    totalGaji += it.gaji_pokok + it.total_tunjangan
    totalPotongan += it.total_bpjs_kesehatan + it.total_bpjs_tk + it.pph21
    totalTakeHome += it.take_home
  }
  db.update(payrollRuns)
    .set({ total_gaji: totalGaji, total_potongan: totalPotongan, take_home: totalTakeHome })
    .where(eq(payrollRuns.id, runId))
    .run()
}

function baseTakeHome(item: { gaji_pokok: number; total_tunjangan: number; total_bpjs_kesehatan: number; total_bpjs_tk: number; pph21: number }): number {
  return Math.round(
    item.gaji_pokok + item.total_tunjangan - (item.total_bpjs_kesehatan + item.total_bpjs_tk + item.pph21),
  )
}

function parseDetailBreakdown(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function getActiveAssignments(db: ReturnType<typeof getDb>['db'], employeeId: string): PayrollAssignment[] {
  const rows = db
    .select({
      assignment: employeeSalaryAssignments,
      component: salaryComponents,
    })
    .from(employeeSalaryAssignments)
    .innerJoin(salaryComponents, eq(employeeSalaryAssignments.salary_component_id, salaryComponents.id))
    .where(
      and(
        eq(employeeSalaryAssignments.employee_id, employeeId),
        eq(employeeSalaryAssignments.aktif, true),
        eq(salaryComponents.aktif, true),
      ),
    )
    .all()

  return rows.map((r) => ({
    id: r.assignment.id,
    override_nominal: r.assignment.override_nominal,
    aktif: r.assignment.aktif,
    component: {
      id: r.component.id,
      nama_komponen: r.component.nama_komponen,
      tipe: r.component.tipe,
      nominal: r.component.nominal,
      formula: r.component.formula,
    },
  }))
}

function getAttendanceAggregate(db: ReturnType<typeof getDb>['db'], employeeId: string, periode: string): AttendanceAggregate {
  const rows = db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employee_id, employeeId),
        sql`substr(${attendanceRecords.tanggal}, 1, 7) = ${periode}`,
      ),
    )
    .all()

  const agg: AttendanceAggregate = { hadir: 0, telat: 0, absen: 0, izin: 0, total_late_minutes: 0 }
  for (const r of rows) {
    if (r.status === 'hadir') agg.hadir++
    else if (r.status === 'telat') agg.telat++
    else if (r.status === 'absen') agg.absen++
    else if (r.status === 'izin') agg.izin++
    agg.total_late_minutes += r.late_minutes ?? 0
  }
  return agg
}

function employeeNameMap(db: ReturnType<typeof getDb>['db'], employeeIds: string[]): Map<string, string> {
  const map = new Map<string, string>()
  if (employeeIds.length === 0) return map
  for (const id of employeeIds) {
    const emp = db.select().from(employees).where(eq(employees.id, id)).get()
    if (emp) map.set(emp.id, emp.nama_lengkap)
  }
  return map
}

function serializeItems(db: ReturnType<typeof getDb>['db'], runId: string, onlyEmployeeId?: string) {
  const rows = db
    .select()
    .from(payrollItems)
    .where(
      onlyEmployeeId
        ? and(eq(payrollItems.payroll_run_id, runId), eq(payrollItems.employee_id, onlyEmployeeId))
        : eq(payrollItems.payroll_run_id, runId),
    )
    .all()

  const nameMap = employeeNameMap(db, rows.map((r) => r.employee_id))
  return rows
    .map((item) => ({
      ...item,
      detail_breakdown: parseDetailBreakdown(item.detail_breakdown),
      employee: {
        id: item.employee_id,
        nama_lengkap: nameMap.get(item.employee_id) ?? null,
      },
    }))
    .sort((a, b) => (a.employee.nama_lengkap ?? '').localeCompare(b.employee.nama_lengkap ?? ''))
}

export default async function payrollRunsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/payroll-runs', { preHandler: requireOwner }, async (req, reply) => {
    const parsed = createRunSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data tidak valid', parsed.error.flatten())
    }
    const { periode } = parsed.data
    const user = currentUser(req)
    const { db } = getDb()
    reply.code(201)

    const existing = db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.business_id, user.business_id), eq(payrollRuns.periode, periode)))
      .get()
    if (existing) {
      throw new ConflictError(`Run payroll untuk periode ${periode} sudah ada`)
    }

    const activeEmployees = db
      .select()
      .from(employees)
      .where(and(eq(employees.business_id, user.business_id), eq(employees.status, 'aktif')))
      .orderBy(asc(employees.nama_lengkap))
      .all()

    const prepared = activeEmployees.map((emp) => ({
      employee: emp,
      assignments: getActiveAssignments(db, emp.id),
      attendance: getAttendanceAggregate(db, emp.id, periode),
    }))

    let totalGaji = 0
    let totalPotongan = 0
    let totalTakeHome = 0

    const run = db.transaction((tx) => {
      const createdRun = tx
        .insert(payrollRuns)
        .values({ business_id: user.business_id, periode, status: 'draft' })
        .returning()
        .get()

      for (const p of prepared) {
        const result = computePayrollItem({
          assignments: p.assignments,
          attendance: p.attendance,
          ptkpStatus: p.employee.ptkp_status,
        })
        tx.insert(payrollItems)
          .values({
            payroll_run_id: createdRun.id,
            employee_id: p.employee.id,
            gaji_pokok: result.gajiPokok,
            total_tunjangan: result.totalTunjangan,
            total_bpjs_kesehatan: result.totalBpjsKesehatan,
            total_bpjs_tk: result.totalBpjsTk,
            pph21: result.pph21,
            take_home: result.takeHome,
            detail_breakdown: JSON.stringify(result.detailBreakdown),
          })
          .run()

        const gross = result.gajiPokok + result.totalTunjangan
        totalGaji += gross
        totalPotongan += result.totalBpjsKesehatan + result.totalBpjsTk + result.pph21
        totalTakeHome += result.takeHome
      }

      tx.update(payrollRuns)
        .set({ total_gaji: totalGaji, total_potongan: totalPotongan, take_home: totalTakeHome })
        .where(eq(payrollRuns.id, createdRun.id))
        .run()

      return createdRun
    })

    const items = serializeItems(db, run.id)
    return { run, items }
  })

  app.get('/payroll-runs', { preHandler: requireOwner }, async (req) => {
    const user = currentUser(req)
    const q = req.query as Record<string, unknown>
    const { db } = getDb()

    const filters = [eq(payrollRuns.business_id, user.business_id)]
    if (q.periode) filters.push(eq(payrollRuns.periode, String(q.periode)))

    const rows = db
      .select()
      .from(payrollRuns)
      .where(and(...filters))
      .orderBy(desc(payrollRuns.created_at))
      .all()

    return { runs: rows }
  })

  app.get('/payroll-runs/:id', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).get()
    if (!run || run.business_id !== user.business_id) {
      throw new ApiError(404, 'Run payroll tidak ditemukan')
    }

    if (user.role === 'owner') {
      const items = serializeItems(db, run.id)
      return { run, items }
    }

    if (!user.employee_id) {
      throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
    }
    const items = serializeItems(db, run.id, user.employee_id)
    return { run, items }
  })

  app.patch('/payroll-items/:id', { preHandler: requireOwner }, async (req) => {
    const parsed = correctionSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ApiError(422, 'Data koreksi tidak valid', parsed.error.flatten())
    }
    const { koreksi, catatan_koreksi } = parsed.data
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const item = db.select().from(payrollItems).where(eq(payrollItems.id, id)).get()
    if (!item) {
      throw new ApiError(404, 'Item payroll tidak ditemukan')
    }
    const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, item.payroll_run_id)).get()
    if (!run || run.business_id !== user.business_id) {
      throw new ApiError(404, 'Item payroll tidak ditemukan')
    }
    if (run.status !== 'draft') {
      throw new ConflictError('Koreksi hanya dapat dilakukan saat run masih berstatus draft')
    }

    const newTakeHome = Math.round(baseTakeHome(item) + koreksi)
    db.update(payrollItems)
      .set({
        koreksi,
        catatan_koreksi: catatan_koreksi ?? item.catatan_koreksi ?? null,
        take_home: newTakeHome,
      })
      .where(eq(payrollItems.id, item.id))
      .run()

    recomputeRunTotals(db, run.id)
    const updated = db.select().from(payrollItems).where(eq(payrollItems.id, item.id)).get()
    const emp = db.select().from(employees).where(eq(employees.id, item.employee_id)).get()
    return {
      ...updated,
      detail_breakdown: parseDetailBreakdown(updated?.detail_breakdown ?? null),
      employee: { id: item.employee_id, nama_lengkap: emp?.nama_lengkap ?? null },
    }
  })

  app.post('/payroll-runs/:id/approve', { preHandler: requireOwner }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).get()
    if (!run || run.business_id !== user.business_id) {
      throw new ApiError(404, 'Run payroll tidak ditemukan')
    }
    if (run.status === 'disetujui') {
      throw new ConflictError('Run payroll sudah disetujui')
    }
    if (run.status === 'locked') {
      throw new ConflictError('Run payroll sudah dikunci dan tidak dapat diubah')
    }

    db.update(payrollRuns)
      .set({
        status: 'disetujui',
        approved_at: new Date(),
        approved_by_user_id: user.id,
      })
      .where(eq(payrollRuns.id, run.id))
      .run()

    await generatePayslipsForRun(run.id)

    const updatedRun = db.select().from(payrollRuns).where(eq(payrollRuns.id, run.id)).get()
    const items = serializeItems(db, run.id)
    return { run: updatedRun, items, payslips_generated: true }
  })

  app.post('/payroll-runs/:id/lock', { preHandler: requireOwner }, async (req) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).get()
    if (!run || run.business_id !== user.business_id) {
      throw new ApiError(404, 'Run payroll tidak ditemukan')
    }
    if (run.status !== 'disetujui') {
      throw new ConflictError('Run hanya dapat dikunci setelah disetujui')
    }

    db.update(payrollRuns)
      .set({ status: 'locked' })
      .where(eq(payrollRuns.id, run.id))
      .run()

    const updatedRun = db.select().from(payrollRuns).where(eq(payrollRuns.id, run.id)).get()
    return { run: updatedRun }
  })
}
