/**
 * KaryawanKu — komposisi breakdown slip gaji (ticket #42).
 *
 * Menyusun daftar pendapatan (earnings) dan potongan (deductions) untuk satu
 * payroll_item dari kolom JSON `detail_breakdown` (sudah dihitung saat run
 * payroll, lihat lib/payroll.ts) plus total take-home. Pure function, tanpa
 * dependensi Fastify, sehingga dipakai baik oleh endpoint JSON maupun PDF.
 *
 * Baris pada detail_breakdown sudah menyimpan nama komponen (`komponen`) dan
 * nilai hasil (`nilai`). Parameter `components` (opsional) hanya dipakai untuk
 * memperkaya nama bila baris membawa `component_id`.
 */

import type { PayrollItem, SalaryComponent } from '../db/schema.js'

export interface BreakdownLine {
  nama_komponen: string
  nominal: number
  formula: string | null
}

export interface PayslipBreakdown {
  earnings: BreakdownLine[]
  deductions: BreakdownLine[]
  totals: {
    total_earnings: number
    total_deductions: number
    take_home: number
  }
}

interface BreakdownLineRaw {
  komponen?: string
  component_id?: string
  nominal?: number | null
  formula?: string | null
  nilai?: number
}

function parseDetailBreakdown(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function asLines(value: unknown): BreakdownLineRaw[] {
  return Array.isArray(value) ? (value as BreakdownLineRaw[]) : []
}

function resolveName(line: BreakdownLineRaw, componentNames: Map<string, string>): string {
  if (line.component_id && componentNames.has(line.component_id)) {
    return componentNames.get(line.component_id) as string
  }
  return line.komponen ?? 'Komponen'
}

/**
 * Menyusun breakdown dari payroll_item. Mengembalikan array kosong bila
 * `detail_breakdown` null/kosong; take_home selalu diambil dari payroll_item.
 */
export function composePayslipBreakdown(
  payrollItem: PayrollItem,
  components?: SalaryComponent[] | ReadonlyMap<string, SalaryComponent>,
): PayslipBreakdown {
  const raw = parseDetailBreakdown(payrollItem.detail_breakdown)

  const componentNames = new Map<string, string>()
  if (components) {
    const list = Array.isArray(components) ? components : Array.from(components.values())
    for (const c of list) componentNames.set(c.id, c.nama_komponen)
  }

  const earnings: BreakdownLine[] = []
  const gajiPokokLines = raw ? asLines(raw.komponen_gaji_pokok) : []
  const tunjanganLines = raw ? asLines(raw.komponen_tunjangan) : []
  for (const line of [...gajiPokokLines, ...tunjanganLines]) {
    earnings.push({
      nama_komponen: resolveName(line, componentNames),
      nominal: Math.round(line.nilai ?? 0),
      formula: line.formula ?? null,
    })
  }

  const deductions: BreakdownLine[] = []
  const potonganLines = raw ? asLines(raw.komponen_potongan) : []
  for (const line of potonganLines) {
    deductions.push({
      nama_komponen: resolveName(line, componentNames),
      nominal: Math.round(line.nilai ?? 0),
      formula: line.formula ?? null,
    })
  }

  deductions.push({
    nama_komponen: 'BPJS Kesehatan',
    nominal: Math.round(payrollItem.total_bpjs_kesehatan),
    formula: 'gaji_pokok * 0.01',
  })
  deductions.push({
    nama_komponen: 'BPJS Ketenagakerjaan',
    nominal: Math.round(payrollItem.total_bpjs_tk),
    formula: null,
  })
  deductions.push({
    nama_komponen: 'PPh 21',
    nominal: Math.round(payrollItem.pph21),
    formula: null,
  })

  const totalEarnings = earnings.reduce((sum, line) => sum + line.nominal, 0)
  const totalDeductions = deductions.reduce((sum, line) => sum + line.nominal, 0)

  return {
    earnings,
    deductions,
    totals: {
      total_earnings: totalEarnings,
      total_deductions: totalDeductions,
      take_home: Math.round(payrollItem.take_home),
    },
  }
}