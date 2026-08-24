/**
 * KaryawanKu — mock payroll run data (ticket #13, FE-only).
 *
 * `getPayrollRun(period)` builds a deterministic payroll run for all 12 mock
 * employees. Earnings/deductions derive from the salary component catalog
 * (`SALARY_COMPONENTS`) and each employee's base salary; per-item math is the
 * simple rule documented in the ticket:
 *
 *   take-home = (gaji_pokok + sum tunjangan) - (bpjs + pph21)
 *
 * Manual correction (koreksi lembur) is modeled as `penyesuaian`, added to
 * take-home. The mock is tuned so the run totals are:
 *   Total Gaji Rp 28.500.000 · Total Potongan Rp 4.200.000 · Take-Home Rp 24.300.000
 */

import { EMPLOYEES } from '@/lib/employees-mock'
import { getComponentById } from '@/lib/salary-assignments-mock'

export type PayrollRunStatus = 'draft' | 'approved'

export interface PayrollComponentRow {
  /** Component name from the salary catalog, e.g. "Tunjangan Transport". */
  nama: string
  nominal: number
}

export interface PayrollItem {
  employeeId: string
  nik: string
  nama: string
  jabatan: string
  gajiPokok: number
  tunjangan: PayrollComponentRow[]
  potongan: PayrollComponentRow[]
  /** Manual correction (e.g. lembur belum tercatat) — can be negative. */
  penyesuaian: number
  catatan: string
}

export interface PayrollRun {
  period: string
  status: PayrollRunStatus
  items: PayrollItem[]
  generatedAt: string
}

/** Base salary config per employee (id from the mock employee master). */
interface PayrollConfig {
  gajiPokok: number
  /** `[componentId, nominal]` — resolves names from the salary catalog. */
  tunjangan: Array<[string, number]>
  /** PPh 21 fixed for the run; BPJS lines are % of gaji pokok. */
  pph21: number
}

const COMPONENT = {
  TRANSPORT: 'sc-2',
  MAKAN: 'sc-3',
  JABATAN: 'sc-4',
  LEMBUR: 'sc-5',
  BPJS_KES: 'sc-6',
  BPJS_TK: 'sc-7',
  PPH21: 'sc-8',
} as const

const PAYROLL_CONFIG: Record<string, PayrollConfig> = {
  '1': { gajiPokok: 2600000, tunjangan: [[COMPONENT.TRANSPORT, 200000], [COMPONENT.MAKAN, 100000]], pph21: 402000 },
  '2': { gajiPokok: 2400000, tunjangan: [[COMPONENT.TRANSPORT, 150000], [COMPONENT.MAKAN, 100000]], pph21: 278000 },
  '3': { gajiPokok: 2300000, tunjangan: [[COMPONENT.MAKAN, 150000], [COMPONENT.LEMBUR, 100000]], pph21: 271000 },
  '4': { gajiPokok: 1900000, tunjangan: [[COMPONENT.TRANSPORT, 200000]], pph21: 323000 },
  '5': { gajiPokok: 2200000, tunjangan: [[COMPONENT.TRANSPORT, 100000], [COMPONENT.MAKAN, 100000]], pph21: 254000 },
  '6': { gajiPokok: 2500000, tunjangan: [[COMPONENT.JABATAN, 250000]], pph21: 295000 },
  '7': { gajiPokok: 2100000, tunjangan: [[COMPONENT.MAKAN, 100000], [COMPONENT.LEMBUR, 100000]], pph21: 247000 },
  '8': { gajiPokok: 2800000, tunjangan: [[COMPONENT.TRANSPORT, 200000], [COMPONENT.JABATAN, 100000]], pph21: 436000 },
  '9': { gajiPokok: 1800000, tunjangan: [[COMPONENT.MAKAN, 150000]], pph21: 306000 },
  '10': { gajiPokok: 2200000, tunjangan: [[COMPONENT.TRANSPORT, 100000], [COMPONENT.LEMBUR, 100000]], pph21: 254000 },
  '11': { gajiPokok: 1700000, tunjangan: [[COMPONENT.TRANSPORT, 100000]], pph21: 189000 },
  '12': { gajiPokok: 1500000, tunjangan: [[COMPONENT.MAKAN, 100000]], pph21: 165000 },
}

function componentName(componentId: string): string {
  return getComponentById(componentId)?.nama ?? componentId
}

function roundToRupiah(n: number): number {
  return Math.round(n)
}

function buildItem(employeeId: string): PayrollItem {
  const config = PAYROLL_CONFIG[employeeId]
  const employee = EMPLOYEES.find((e) => e.id === employeeId)
  const bpjsKesehatan = roundToRupiah(config.gajiPokok * 0.01)
  const bpjsTk = roundToRupiah(config.gajiPokok * 0.02)

  return {
    employeeId,
    nik: employee?.nik ?? '',
    nama: employee?.nama ?? 'Karyawan',
    jabatan: employee?.jabatan ?? '-',
    gajiPokok: config.gajiPokok,
    tunjangan: config.tunjangan.map(([id, nominal]) => ({ nama: componentName(id), nominal })),
    potongan: [
      { nama: componentName(COMPONENT.BPJS_KES), nominal: bpjsKesehatan },
      { nama: componentName(COMPONENT.BPJS_TK), nominal: bpjsTk },
      { nama: componentName(COMPONENT.PPH21), nominal: config.pph21 },
    ],
    penyesuaian: 0,
    catatan: '',
  }
}

/** Gross pendapatan: gaji pokok + seluruh tunjangan. */
export function gross(item: PayrollItem): number {
  return item.gajiPokok + item.tunjangan.reduce((sum, t) => sum + t.nominal, 0)
}

/** Total potongan: BPJS + PPh 21. */
export function potongan(item: PayrollItem): number {
  return item.potongan.reduce((sum, p) => sum + p.nominal, 0)
}

/** Take-home including any manual correction. */
export function takeHome(item: PayrollItem): number {
  return gross(item) - potongan(item) + item.penyesuaian
}

export interface PayrollSummary {
  count: number
  totalGaji: number
  totalPotongan: number
  totalTakeHome: number
}

export function summarize(run: Pick<PayrollRun, 'items'>): PayrollSummary {
  return run.items.reduce(
    (acc, item) => {
      acc.count += 1
      acc.totalGaji += gross(item)
      acc.totalPotongan += potongan(item)
      acc.totalTakeHome += takeHome(item)
      return acc
    },
    { count: 0, totalGaji: 0, totalPotongan: 0, totalTakeHome: 0 },
  )
}

/** Build the (mock) payroll run for a given period, e.g. `"2026-08"`. */
export function getPayrollRun(period: string): PayrollRun {
  return {
    period,
    status: 'draft',
    items: EMPLOYEES.map((e) => buildItem(e.id)),
    generatedAt: '2026-08-19T08:00:00',
  }
}