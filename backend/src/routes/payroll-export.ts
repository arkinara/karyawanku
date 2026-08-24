import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { getDb } from '../db/index.js'
import { employees, payrollItems, payrollRuns } from '../db/schema.js'
import { currentUser, requireOwner } from '../lib/auth.js'
import { ApiError } from '../lib/errors.js'

const HEADERS = [
  'Nama',
  'NIP/ID',
  'Gaji Pokok',
  'Total Tunjangan',
  'BPJS Kesehatan (employee)',
  'BPJS Ketenagakerjaan (employee)',
  'PPh 21',
  'Koreksi',
  'Take-Home',
] as const

interface Row {
  nama: string
  nip: string
  gajiPokok: number
  totalTunjangan: number
  bpjsKesehatan: number
  bpjsTk: number
  pph21: number
  koreksi: number
  takeHome: number
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function buildCsv(rows: Row[], totals: Row): string {
  const lines: string[] = []
  lines.push(HEADERS.map((h) => csvEscape(h)).join(','))
  for (const r of rows) {
    lines.push(
      [r.nama, r.nip, r.gajiPokok, r.totalTunjangan, r.bpjsKesehatan, r.bpjsTk, r.pph21, r.koreksi, r.takeHome]
        .map((v) => (typeof v === 'string' ? csvEscape(v) : String(v)))
        .join(','),
    )
  }
  lines.push(
    [
      'Total',
      '',
      totals.gajiPokok,
      totals.totalTunjangan,
      totals.bpjsKesehatan,
      totals.bpjsTk,
      totals.pph21,
      totals.koreksi,
      totals.takeHome,
    ]
      .map((v) => (typeof v === 'string' ? csvEscape(v) : String(v)))
      .join(','),
  )
  return '\uFEFF' + lines.join('\n') + '\n'
}

function computeTotals(rows: Row[]): Row {
  return {
    nama: '',
    nip: '',
    gajiPokok: rows.reduce((s, r) => s + r.gajiPokok, 0),
    totalTunjangan: rows.reduce((s, r) => s + r.totalTunjangan, 0),
    bpjsKesehatan: rows.reduce((s, r) => s + r.bpjsKesehatan, 0),
    bpjsTk: rows.reduce((s, r) => s + r.bpjsTk, 0),
    pph21: rows.reduce((s, r) => s + r.pph21, 0),
    koreksi: rows.reduce((s, r) => s + r.koreksi, 0),
    takeHome: rows.reduce((s, r) => s + r.takeHome, 0),
  }
}

async function buildXlsx(rows: Row[], totals: Row): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Payroll')
  ws.addRow([...HEADERS])
  for (const r of rows) {
    ws.addRow([r.nama, r.nip, r.gajiPokok, r.totalTunjangan, r.bpjsKesehatan, r.bpjsTk, r.pph21, r.koreksi, r.takeHome])
  }
  ws.addRow(['Total', '', totals.gajiPokok, totals.totalTunjangan, totals.bpjsKesehatan, totals.bpjsTk, totals.pph21, totals.koreksi, totals.takeHome])
  ws.getRow(1).font = { bold: true }
  ws.columns.forEach((col) => {
    if (col) col.width = 24
  })
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export default async function payrollExportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/payroll-runs/:id/export.csv', { preHandler: requireOwner }, async (req, reply) => {
    const user = currentUser(req)
    const { id } = req.params as { id: string }
    const { db } = getDb()
    const q = req.query as Record<string, unknown>
    const format = q.format === 'xlsx' ? 'xlsx' : 'csv'

    const run = db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).get()
    if (!run || run.business_id !== user.business_id) {
      throw new ApiError(404, 'Run payroll tidak ditemukan')
    }

    const items = db
      .select({ item: payrollItems, employee: employees })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employee_id, employees.id))
      .where(eq(payrollItems.payroll_run_id, run.id))
      .all()
      .sort((a, b) => a.employee.nama_lengkap.localeCompare(b.employee.nama_lengkap))

    const rows: Row[] = items.map(({ item, employee }) => ({
      nama: employee.nama_lengkap,
      nip: employee.no_ktp,
      gajiPokok: item.gaji_pokok,
      totalTunjangan: item.total_tunjangan,
      bpjsKesehatan: item.total_bpjs_kesehatan,
      bpjsTk: item.total_bpjs_tk,
      pph21: item.pph21,
      koreksi: item.koreksi,
      takeHome: item.take_home,
    }))
    const totals = computeTotals(rows)
    const filename = `payroll-${run.periode}`

    if (format === 'xlsx') {
      const buffer = await buildXlsx(rows, totals)
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
        .send(buffer)
      return
    }

    const csv = buildCsv(rows, totals)
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}.csv"`)
      .send(csv)
  })
}
