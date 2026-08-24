/**
 * KaryawanKu — mock payslip data for the employee self-service payslip page
 * (ticket #14, FE-only).
 *
 * `getPayslips(employeeId)` returns the employee's own monthly payslips, newest
 * first. Numbers reuse the consistent payroll run config from `payroll-mock`
 * (same gaji pokok, tunjangan, BPJS, PPh 21 per employee), so earnings and
 * deductions are computed, not hardcoded. A few months add a "Tunjangan
 * Lembur" line so take-home varies across periods.
 *
 * Only the default employee (Siti Nurhaliza) has mock payslips; any other id
 * yields an empty list (drives the empty state).
 */

import { getPayrollRun } from '@/lib/payroll-mock'

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

/** Default (logged-in) employee — matches the employee nav model (Siti Nurhaliza). */
export const DEFAULT_EMPLOYEE_ID = '2'

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

/** Months that carry an extra "Tunjangan Lembur" allowance in the mock. */
const LEMBUR_PERIODS = new Set(['2026-07', '2026-04', '2026-02'])

/** `"2026-07"` -> `"Juli 2026"`. */
export function formatPeriode(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return period
  return `${BULAN_NAMES[m - 1]} ${y}`
}

/** Payslips are generated on the 5th of the month following the period. */
function nextMonthFifth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${ny}-${pad(nm)}-05T08:00:00`
}

/** Total pendapatan: gaji pokok + seluruh tunjangan. */
export function payslipPendapatan(p: Payslip): number {
  return p.gajiPokok + p.tunjangan.reduce((sum, t) => sum + t.nominal, 0)
}

/** Total potongan: BPJS + PPh 21. */
export function payslipPotongan(p: Payslip): number {
  return p.potongan.reduce((sum, t) => sum + t.nominal, 0)
}

/** Seven consecutive monthly payslips for the default employee, newest first. */
export function getPayslips(employeeId: string): Payslip[] {
  if (employeeId !== DEFAULT_EMPLOYEE_ID) return []

  const periods = [
    '2026-07',
    '2026-06',
    '2026-05',
    '2026-04',
    '2026-03',
    '2026-02',
    '2026-01',
  ]

  return periods
    .map((period) => {
      const item = getPayrollRun(period).items.find((i) => i.employeeId === employeeId)
      if (!item) return null

      const tunjangan = LEMBUR_PERIODS.has(period)
        ? [...item.tunjangan, { nama: 'Tunjangan Lembur', nominal: 100000 }]
        : [...item.tunjangan]
      const potongan = [...item.potongan]
      const takeHome =
        item.gajiPokok +
        tunjangan.reduce((sum, t) => sum + t.nominal, 0) -
        potongan.reduce((sum, t) => sum + t.nominal, 0)

      return {
        id: `${employeeId}-${period}`,
        employeeId,
        period,
        nama: item.nama,
        jabatan: item.jabatan,
        gajiPokok: item.gajiPokok,
        tunjangan,
        potongan,
        takeHome,
        generatedAt: nextMonthFifth(period),
      }
    })
    .filter((p): p is Payslip => p !== null)
}
