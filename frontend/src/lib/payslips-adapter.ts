/**
 * KaryawanKu — payslips adapter (BE → FE).
 *
 * The BE list endpoint returns:
 *   { payslips: [{ id, pdf_url, created_at, periode, status, employee,
 *                   payroll_item_id, take_home }] }
 *
 * The list rows carry only the take-home total; the full earnings + deductions
 * breakdown lives on the detail endpoint (`GET /api/payslips/:id`, ticket #42)
 * which returns `{ breakdown: { earnings, deductions, totals } }`. This module
 * holds the shared `Payslip` type, the display helpers, and the composers that
 * stitch BE payloads into the viewer-friendly shape. (Formerly split between
 * `payslips-mock.ts` and this file; the mock module was folded in and removed.)
 */

import { EMPLOYEES } from '@/lib/employees-mock'

export interface PayslipComponentRow {
  nama: string
  nominal: number
}

export interface Payslip {
  id: string
  employeeId: string
  /** Period `YYYY-MM`, e.g. `"2026-07"`. */
  period: string
  nama: string
  jabatan: string
  gajiPokok: number
  tunjangan: PayslipComponentRow[]
  potongan: PayslipComponentRow[]
  takeHome: number
  /** ISO datetime when the payslip was generated. */
  generatedAt: string
}

const BULAN_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

/** `"2026-07"` -> `"Juli 2026"`. */
export function formatPeriode(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return period
  return `${BULAN_NAMES[m - 1]} ${y}`
}

/** Total pendapatan: gaji pokok + seluruh tunjangan. */
export function payslipPendapatan(p: Payslip): number {
  return p.gajiPokok + p.tunjangan.reduce((sum, t) => sum + t.nominal, 0)
}

/** Total potongan: BPJS + PPh 21. */
export function payslipPotongan(p: Payslip): number {
  return p.potongan.reduce((sum, t) => sum + t.nominal, 0)
}

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

/** One line of the BE payslip breakdown (`nama_komponen` + nominal). */
export interface BeBreakdownLine {
  nama_komponen: string
  nominal: number
  formula?: string | null
}

/** `GET /api/payslips/:id` (ticket #42) — the per-line breakdown. */
export interface BePayslipDetail {
  id: string
  payroll_item_id: string
  employee: { id: string; nama: string; jabatan: string }
  periode: string
  breakdown: {
    earnings: BeBreakdownLine[]
    deductions: BeBreakdownLine[]
    totals: { total_earnings: number; total_deductions: number; take_home: number }
  }
  totals: { total_earnings: number; total_deductions: number; take_home: number }
  pdf_url: string
}

function asComponents(value: unknown): PayslipComponentRow[] {
  if (!Array.isArray(value)) return []
  const out: PayslipComponentRow[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as { nama_komponen?: unknown; nama?: unknown; nominal?: unknown }
    const nama = typeof obj.nama_komponen === 'string' ? obj.nama_komponen : obj.nama
    if (typeof nama !== 'string' || typeof obj.nominal !== 'number') continue
    out.push({ nama, nominal: obj.nominal })
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

/** Normalise a `GET /api/payslips/:id` payload into breakdown rows. */
export function breakdownOf(detail: BePayslipDetail | null): {
  earnings: PayslipComponentRow[]
  deductions: PayslipComponentRow[]
  totals: { total_earnings: number; total_deductions: number; take_home: number } | null
} {
  if (!detail || !detail.breakdown) {
    return { earnings: [], deductions: [], totals: null }
  }
  const earnings = asComponents(detail.breakdown.earnings)
  const deductions = asComponents(detail.breakdown.deductions)
  // Empty breakdown (e.g. only a take-home total) → treat as no breakdown so
  // the viewer falls back to its aggregate rows instead of showing zeroes.
  if (earnings.length === 0 && deductions.length === 0) {
    return { earnings, deductions, totals: null }
  }
  return {
    earnings,
    deductions,
    totals: detail.breakdown.totals ?? detail.totals ?? null,
  }
}