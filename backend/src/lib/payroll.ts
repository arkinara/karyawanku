/**
 * KaryawanKu — engine komputasi payroll per karyawan (ticket #28 + #29 + #30).
 *
 * Menghitung gaji pokok, tunjangan, BPJS, PPh 21, dan take-home untuk satu
 * karyawan aktif dalam satu periode, lalu menghasilkan detail_breakdown JSON.
 *
 * Rumus (sesuai spesifikasi):
 * - gaji_pokok  = jumlah komponen earning bernama "Gaji Pokok"
 * - total_tunjangan = jumlah komponen earning lain (override/formula)
 * - total_bpjs_kesehatan = BPJS Kesehatan bagian karyawan (1% gaji pokok)
 * - total_bpjs_tk = JHT karyawan (2%) + JP karyawan (1%)
 * - pph21 = PPh21 progresif bulanan dari gross tahunan
 * - take_home = gaji_pokok + total_tunjangan - (bpjs_kesehatan + bpjs_tk + pph21)
 */

import { calculateBPJS } from './bpjs.js'
import { calculatePPh21, isPtkpCategory } from './pph21.js'
import { evaluate } from './formula.js'
import { ApiError } from './errors.js'

const GAJI_POKOK_NAME = 'gaji pokok'

export interface PayrollComponent {
  id: string
  nama_komponen: string
  tipe: 'earning' | 'deduction'
  nominal: number | null
  formula: string | null
}

export interface PayrollAssignment {
  id: string
  override_nominal: number | null
  aktif: boolean
  component: PayrollComponent
}

export interface AttendanceAggregate {
  hadir: number
  telat: number
  absen: number
  izin: number
  total_late_minutes: number
}

export interface ComputePayrollInput {
  assignments: PayrollAssignment[]
  attendance: AttendanceAggregate
  ptkpStatus: string | null
}

export interface ComputePayrollResult {
  gajiPokok: number
  totalTunjangan: number
  totalBpjsKesehatan: number
  totalBpjsTk: number
  pph21: number
  takeHome: number
  detailBreakdown: Record<string, unknown>
}

function roundRupiah(value: number): number {
  return Math.round(value)
}

function isGajiPokok(name: string): boolean {
  return name.trim().toLowerCase() === GAJI_POKOK_NAME
}

/**
 * Menyelesaikan nilai efektif sebuah penugasan. Prioritaskan override_nominal,
 * lalu formula, lalu nominal. Formula yang tak dapat dievaluasi (sintaks salah
 * atau variabel tak dikenal) melempar error agar run gagal dengan pesan jelas.
 */
function resolveAssignmentValue(
  assignment: PayrollAssignment,
  variables: Record<string, number>,
): number {
  const { component, override_nominal } = assignment
  if (override_nominal != null) return roundRupiah(override_nominal)

  if (component.formula) {
    const res = evaluate(component.formula, variables)
    if (res.error) {
      throw new ApiError(
        422,
        `Komponen "${component.nama_komponen}" gagal dihitung: ${res.error}`,
      )
    }
    return roundRupiah(res.result ?? 0)
  }

  return roundRupiah(component.nominal ?? 0)
}

export function computePayrollItem(input: ComputePayrollInput): ComputePayrollResult {
  const activeAssignments = input.assignments.filter((a) => a.aktif)

  const gajiPokokAssignments = activeAssignments.filter((a) => isGajiPokok(a.component.nama_komponen))
  const earningAssignments = activeAssignments.filter(
    (a) => a.component.tipe === 'earning' && !isGajiPokok(a.component.nama_komponen),
  )
  const deductionAssignments = activeAssignments.filter((a) => a.component.tipe === 'deduction')

  const attendanceVars: Record<string, number> = {
    hadir: input.attendance.hadir,
    telat: input.attendance.telat,
    absen: input.attendance.absen,
    izin: input.attendance.izin,
  }

  let gajiPokok = 0
  const gajiPokokLines: unknown[] = []
  for (const a of gajiPokokAssignments) {
    const nilai = resolveAssignmentValue(a, attendanceVars)
    gajiPokok += nilai
    gajiPokokLines.push({
      komponen: a.component.nama_komponen,
      override_nominal: a.override_nominal ?? null,
      nominal: a.component.nominal ?? null,
      formula: a.component.formula ?? null,
      nilai,
    })
  }

  let totalTunjangan = 0
  const tunjanganLines: unknown[] = []
  for (const a of earningAssignments) {
    const nilai = resolveAssignmentValue(a, attendanceVars)
    totalTunjangan += nilai
    tunjanganLines.push({
      komponen: a.component.nama_komponen,
      override_nominal: a.override_nominal ?? null,
      nominal: a.component.nominal ?? null,
      formula: a.component.formula ?? null,
      nilai,
    })
  }

  const potonganLainLines: unknown[] = []
  for (const a of deductionAssignments) {
    const nilai = resolveAssignmentValue(a, attendanceVars)
    potonganLainLines.push({
      komponen: a.component.nama_komponen,
      override_nominal: a.override_nominal ?? null,
      nominal: a.component.nominal ?? null,
      formula: a.component.formula ?? null,
      nilai,
    })
  }

  const bpjs = calculateBPJS(gajiPokok)
  const totalBpjsKesehatan = bpjs.bpjsKesehatan.employee
  const totalBpjsTk = bpjs.bpjsKetenagakerjaan.jht.employee + bpjs.bpjsKetenagakerjaan.jp.employee

  const monthlyGross = gajiPokok + totalTunjangan
  const annualizedGross = monthlyGross * 12
  const ptkpStatus = isPtkpCategory(input.ptkpStatus) ? input.ptkpStatus : undefined
  const pph = calculatePPh21(annualizedGross, ptkpStatus)

  const takeHome = roundRupiah(
    monthlyGross - (totalBpjsKesehatan + totalBpjsTk + pph.monthlyPPh21),
  )

  const totalPotongan = roundRupiah(totalBpjsKesehatan + totalBpjsTk + pph.monthlyPPh21)

  const detailBreakdown: Record<string, unknown> = {
    gaji_pokok: gajiPokok,
    komponen_gaji_pokok: gajiPokokLines,
    total_tunjangan: totalTunjangan,
    komponen_tunjangan: tunjanganLines,
    komponen_potongan: potonganLainLines,
    total_pendapatan: monthlyGross,
    bpjs: {
      bpjs_kesehatan: bpjs.bpjsKesehatan,
      bpjs_ketenagakerjaan: bpjs.bpjsKetenagakerjaan,
      total_bpjs_kesehatan: totalBpjsKesehatan,
      total_bpjs_tk: totalBpjsTk,
    },
    pph21: pph.breakdown,
    attendance: input.attendance,
    total_potongan: totalPotongan,
    take_home: takeHome,
  }

  return {
    gajiPokok,
    totalTunjangan,
    totalBpjsKesehatan,
    totalBpjsTk,
    pph21: pph.monthlyPPh21,
    takeHome,
    detailBreakdown,
  }
}
