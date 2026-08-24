/**
 * KaryawanKu — generator payslip records + PDF untuk seluruh item satu run (ticket #31).
 *
 * Dipanggil saat payroll_run disetujui: untuk setiap payroll_item dibuat satu
 * baris payslips (idempoten — tak menggandakan bila sudah ada), PDF di-generate,
 * ditulis ke filesystem, lalu `pdf_url` diperbarui di DB.
 */

import { randomUUID } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { businesses, employees, payrollItems, payslips, payrollRuns } from '../db/schema.js'
import { generatePayslipPDF } from './payslip-pdf.js'
import { writePayslipFile } from './payslip-store.js'

export interface GeneratedPayslip {
  id: string
  payroll_item_id: string
  pdf_url: string
}

export async function generatePayslipsForRun(runId: string): Promise<GeneratedPayslip[]> {
  const { db } = getDb()
  const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).get()
  if (!run) return []

  const business = db.select().from(businesses).where(eq(businesses.id, run.business_id)).get() ?? null
  const items = db.select().from(payrollItems).where(eq(payrollItems.payroll_run_id, runId)).all()
  const employeesById = new Map(
    db
      .select()
      .from(employees)
      .where(
        and(
          ...(items.length
            ? items.map((i) => eq(employees.id, i.employee_id))
            : [eq(employees.id, '__none__')]),
        ),
      )
      .all()
      .map((e) => [e.id, e]),
  )

  const created: GeneratedPayslip[] = []
  for (const item of items) {
    const existing = db
      .select()
      .from(payslips)
      .where(eq(payslips.payroll_item_id, item.id))
      .get()
    if (existing) {
      created.push({ id: existing.id, payroll_item_id: item.id, pdf_url: existing.pdf_url ?? '' })
      continue
    }

    const id = randomUUID()
    const buffer = await generatePayslipPDF({
      payrollItem: item,
      employee: employeesById.get(item.employee_id) ?? null,
      business,
      periode: run.periode,
    })
    const path = writePayslipFile(id, buffer)

    db.insert(payslips)
      .values({ id, payroll_item_id: item.id, pdf_url: path })
      .run()

    created.push({ id, payroll_item_id: item.id, pdf_url: path })
  }

  return created
}
