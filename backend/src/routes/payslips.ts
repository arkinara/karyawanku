import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { employees, payrollItems, payrollRuns, payslips } from '../db/schema.js'
import { currentUser, requireAuth } from '../lib/auth.js'
import { ApiError, ForbiddenError } from '../lib/errors.js'
import { readPayslipFile } from '../lib/payslip-store.js'

function slugifyPeriod(periode: string): string {
  const [year, month] = periode.split('-')
  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const idx = month ? Number(month) - 1 : -1
  return `${monthNames[idx] ?? month ?? ''}-${year ?? ''}`
}

function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_.]/g, '')
}

export default async function payslipsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/payslips', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { db } = getDb()

    const filters = [eq(payrollRuns.business_id, user.business_id)]
    if (user.role !== 'owner') {
      if (!user.employee_id) {
        throw new ApiError(422, 'Akun tidak terhubung ke data karyawan')
      }
      filters.push(eq(payrollItems.employee_id, user.employee_id))
    }

    const rows = db
      .select({
        payslip: payslips,
        item: payrollItems,
        run: payrollRuns,
        employee: employees,
      })
      .from(payslips)
      .innerJoin(payrollItems, eq(payslips.payroll_item_id, payrollItems.id))
      .innerJoin(payrollRuns, eq(payrollItems.payroll_run_id, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employee_id, employees.id))
      .where(and(...filters))
      .orderBy(desc(payrollRuns.periode))
      .all()

    const data = rows.map((r) => ({
      id: r.payslip.id,
      pdf_url: r.payslip.pdf_url,
      created_at: r.payslip.created_at,
      periode: r.run.periode,
      status: r.run.status,
      employee: {
        id: r.employee.id,
        nama_lengkap: r.employee.nama_lengkap,
      },
      payroll_item_id: r.item.id,
      take_home: r.item.take_home,
    }))

    return { payslips: data }
  })

  app.get('/payslips/employee/:employeeId', { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req)
    const { employeeId } = req.params as { employeeId: string }
    const { db } = getDb()

    if (user.role !== 'owner' && user.employee_id !== employeeId) {
      throw new ForbiddenError('Anda hanya dapat melihat slip gaji milik Anda sendiri.')
    }

    const rows = db
      .select({
        payslip: payslips,
        item: payrollItems,
        run: payrollRuns,
        employee: employees,
      })
      .from(payslips)
      .innerJoin(payrollItems, eq(payslips.payroll_item_id, payrollItems.id))
      .innerJoin(payrollRuns, eq(payrollItems.payroll_run_id, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employee_id, employees.id))
      .where(
        and(
          eq(payrollItems.employee_id, employeeId),
          eq(payrollRuns.business_id, user.business_id),
        ),
      )
      .orderBy(desc(payrollRuns.periode))
      .all()

    const data = rows.map((r) => ({
      id: r.payslip.id,
      pdf_url: r.payslip.pdf_url,
      created_at: r.payslip.created_at,
      periode: r.run.periode,
      status: r.run.status,
      payroll_item_id: r.item.id,
      take_home: r.item.take_home,
      employee: {
        id: r.employee.id,
        nama_lengkap: r.employee.nama_lengkap,
      },
    }))

    return { payslips: data }
  })

  app.get('/payslips/:id/download', { preHandler: requireAuth }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()

    const row = db
      .select({
        payslip: payslips,
        item: payrollItems,
        run: payrollRuns,
        employee: employees,
      })
      .from(payslips)
      .innerJoin(payrollItems, eq(payslips.payroll_item_id, payrollItems.id))
      .innerJoin(payrollRuns, eq(payrollItems.payroll_run_id, payrollRuns.id))
      .innerJoin(employees, eq(payrollItems.employee_id, employees.id))
      .where(eq(payslips.id, id))
      .get()

    if (!row || row.run.business_id !== user.business_id) {
      throw new ApiError(404, 'Slip gaji tidak ditemukan')
    }
    if (user.role !== 'owner' && user.employee_id !== row.employee.id) {
      throw new ForbiddenError('Anda hanya dapat mengunduh slip gaji milik Anda sendiri.')
    }

    const buffer = readPayslipFile(row.payslip.id)
    if (!buffer) {
      throw new ApiError(404, 'File slip gaji tidak ditemukan')
    }

    const filename = `slip-gaji-${sanitizeName(row.employee.nama_lengkap)}-${slugifyPeriod(row.run.periode)}.pdf`
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer)
  })
}
