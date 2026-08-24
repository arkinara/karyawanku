/**
 * KaryawanKu — payslip formatting helpers + shared types (ticket #14).
 *
 * The payslip page maps the BE `/api/payslips` rows into `Payslip` via
 * `payslips-adapter.ts`; this module holds the shared type and the pure
 * display helpers (`formatPeriode`, `payslipPendapatan`, `payslipPotongan`).
 */

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

