/**
 * KaryawanKu — payslips adapter (BE → FE).
 *
 * The BE list endpoint returns:
 *   { payslips: [{ id, pdf_url, created_at, periode, status, employee,
 *                   payroll_item_id, take_home }] }
 *
 * It does NOT include the per-component breakdown; that lives on the
 * underlying payroll item (`/api/payroll-runs/:run_id` filtered to one
 * employee). The adapter fetches both and stitches them into the FE
 * `Payslip` shape so the viewer can render earnings + deductions.
 */

import { EMPLOYEES } from '@/lib/employees-mock'
import type { Payslip, PayslipComponentRow } from '@/lib/payslips-mock'

export interface BePayslipRow {
  id: string
  pdf_url: string | null
  created_at: string
  periode: string
  status: 'draft' | 'disetujui' | 'locked'
  payroll_item_id: string
  take_home: number
  employee: { id: string; nama_lengkap: string | null }
}

interface BePayslipItemDetail {
  id: string
  payroll_run_id: string
  employee_id: string
  gaji_pokok: number
  total_tunjangan: number
  total_bpjs_kesehatan: number
  total_bpjs_tk: number
  pph21: number
  koreksi: number
  catatan_koreksi: string | null
  take_home: number
  detail_breakdown: Record<string, unknown> | null
}

function asComponents(value: unknown): PayslipComponentRow[] {
  if (!Array.isArray(value)) return []
  const out: PayslipComponentRow[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as { nama?: unknown; nominal?: unknown }
    if (typeof obj.nama !== 'string' || typeof obj.nominal !== 'number') continue
    out.push({ nama: obj.nama, nominal: obj.nominal })
  }
  return out
}

/**
 * Compose a FE `Payslip` from the BE list row plus the matching payroll item
 * (which carries the component breakdown). Falls back to aggregate rows when
 * the breakdown is missing so the viewer still renders meaningful content.
 */
export function composePayslip(row: BePayslipRow, item?: BePayslipItemDetail | null): Payslip {
  const emp = EMPLOYEES.find((e) => e.id === row.employee.id)
  const breakdown = item?.detail_breakdown ?? null
  const tunjangan = breakdown ? asComponents(breakdown.tunjangan) : []
  const potongan = breakdown ? asComponents(breakdown.potongan) : []

  // Fallbacks when BE didn't include breakdown.
  const finalTunjangan =
    tunjangan.length > 0
      ? tunjangan
      : item && item.total_tunjangan > 0
        ? [{ nama: 'Tunjangan', nominal: item.total_tunjangan }]
        : []
  const finalPotongan =
    potongan.length > 0
      ? potongan
      : item && (item.total_bpjs_kesehatan + item.total_bpjs_tk + item.pph21) > 0
        ? [
            { nama: 'BPJS Kesehatan', nominal: item.total_bpjs_kesehatan },
            { nama: 'BPJS Ketenagakerjaan', nominal: item.total_bpjs_tk },
            { nama: 'PPh 21', nominal: item.pph21 },
          ]
        : []

  const gajiPokok = item?.gaji_pokok ?? 0
  const computedTake =
    gajiPokok +
    finalTunjangan.reduce((sum, t) => sum + t.nominal, 0) -
    finalPotongan.reduce((sum, t) => sum + t.nominal, 0)

  return {
    id: row.id,
    employeeId: row.employee.id,
    period: row.periode,
    nama: row.employee.nama_lengkap ?? emp?.nama ?? 'Karyawan',
    jabatan: emp?.jabatan ?? '-',
    gajiPokok,
    tunjangan: finalTunjangan,
    potongan: finalPotongan,
    takeHome: Number.isFinite(computedTake) && computedTake !== 0 ? computedTake : row.take_home,
    generatedAt: row.created_at,
  }
}
