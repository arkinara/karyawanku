/**
 * KaryawanKu — mock salary assignment data (ticket #9, FE-only).
 *
 * Components mirror ticket #8's builder fixture. Assignments exist only for
 * employees 1-3 (Budi Santoso, Siti Nurhaliza, Ahmad Fauzi), each a mix of
 * fixed and formula components. Effective nominal for formula components is
 * computed live from the employee's salary inputs (gaji pokok + attendance
 * mock) via `@/lib/formula`.
 */

import { evaluateFormulaResult } from '@/lib/formula'

export type SalaryComponentType = 'earning' | 'deduction'
export type SalaryValueMode = 'fixed' | 'formula'
export type AssignmentStatus = 'aktif' | 'nonaktif'
export type AssignmentSource = 'default' | 'override'

export interface SalaryComponent {
  id: string
  nama: string
  tipe: SalaryComponentType
  mode: SalaryValueMode
  /** Fixed nominal in IDR, or the base rate for formula components. */
  nominal: number | null
  formula?: string
  status: 'aktif' | 'nonaktif'
}

export interface SalaryInputs {
  gajiPokok: number
  tarifLembur: number
  jamKerja: number
  jamLembur: number
}

export interface EmployeeSalaryAssignment {
  id: string
  employeeId: string
  componentId: string
  /** Per-employee override; `null` means "pakai nominal default komponen". */
  overrideNominal: number | null
  status: AssignmentStatus
}

export interface AssignmentView {
  assignment: EmployeeSalaryAssignment
  component: SalaryComponent
  source: AssignmentSource
  effectiveNominal: number | null
  formulaError?: string
}

export const SALARY_COMPONENTS: SalaryComponent[] = [
  { id: 'sc-1', nama: 'Gaji Pokok', tipe: 'earning', mode: 'fixed', nominal: 3500000, status: 'aktif' },
  { id: 'sc-2', nama: 'Tunjangan Transport', tipe: 'earning', mode: 'fixed', nominal: 400000, status: 'aktif' },
  { id: 'sc-3', nama: 'Tunjangan Makan', tipe: 'earning', mode: 'fixed', nominal: 350000, status: 'aktif' },
  { id: 'sc-4', nama: 'Tunjangan Jabatan', tipe: 'earning', mode: 'fixed', nominal: 500000, status: 'aktif' },
  { id: 'sc-5', nama: 'Lembur per Jam', tipe: 'earning', mode: 'formula', nominal: 25000, formula: 'jam_kerja * tarif_lembur', status: 'aktif' },
  { id: 'sc-6', nama: 'BPJS Kesehatan', tipe: 'deduction', mode: 'formula', nominal: 35000, formula: 'gaji_pokok * 0.01', status: 'aktif' },
  { id: 'sc-7', nama: 'BPJS Ketenagakerjaan', tipe: 'deduction', mode: 'formula', nominal: 70000, formula: 'gaji_pokok * 0.02', status: 'aktif' },
  { id: 'sc-8', nama: 'PPh 21', tipe: 'deduction', mode: 'formula', nominal: 75000, formula: '(gaji_pokok * 12 - ptkp) * 0.05 / 12', status: 'nonaktif' },
]

export const EMPLOYEE_SALARY_INPUTS: Record<string, SalaryInputs> = {
  '1': { gajiPokok: 3500000, tarifLembur: 25000, jamKerja: 8, jamLembur: 5 },
  '2': { gajiPokok: 3000000, tarifLembur: 20000, jamKerja: 8, jamLembur: 3 },
  '3': { gajiPokok: 2800000, tarifLembur: 22000, jamKerja: 8, jamLembur: 2 },
}

export const EMPLOYEE_ASSIGNMENTS: EmployeeSalaryAssignment[] = [
  // Budi Santoso (1) — 4 assignment, mix nominal + formula.
  { id: 'asg-1', employeeId: '1', componentId: 'sc-1', overrideNominal: null, status: 'aktif' },
  { id: 'asg-2', employeeId: '1', componentId: 'sc-3', overrideNominal: 400000, status: 'aktif' },
  { id: 'asg-3', employeeId: '1', componentId: 'sc-5', overrideNominal: null, status: 'aktif' },
  { id: 'asg-4', employeeId: '1', componentId: 'sc-6', overrideNominal: null, status: 'aktif' },
  // Siti Nurhaliza (2) — 4 assignment, mix nominal + formula.
  { id: 'asg-5', employeeId: '2', componentId: 'sc-1', overrideNominal: null, status: 'aktif' },
  { id: 'asg-6', employeeId: '2', componentId: 'sc-2', overrideNominal: null, status: 'aktif' },
  { id: 'asg-7', employeeId: '2', componentId: 'sc-5', overrideNominal: null, status: 'aktif' },
  { id: 'asg-8', employeeId: '2', componentId: 'sc-7', overrideNominal: null, status: 'aktif' },
  // Ahmad Fauzi (3) — 3 assignment, mix nominal + formula.
  { id: 'asg-9', employeeId: '3', componentId: 'sc-1', overrideNominal: null, status: 'aktif' },
  { id: 'asg-10', employeeId: '3', componentId: 'sc-4', overrideNominal: 300000, status: 'aktif' },
  { id: 'asg-11', employeeId: '3', componentId: 'sc-6', overrideNominal: null, status: 'aktif' },
]

export function getComponentById(componentId: string | undefined): SalaryComponent | undefined {
  if (!componentId) return undefined
  return SALARY_COMPONENTS.find((c) => c.id === componentId)
}

export function getEmployeeSalaryInputs(employeeId: string | undefined): SalaryInputs | undefined {
  if (!employeeId) return undefined
  return EMPLOYEE_SALARY_INPUTS[employeeId]
}

export function getAssignmentsForEmployee(
  employeeId: string | undefined,
): EmployeeSalaryAssignment[] {
  if (!employeeId) return []
  return EMPLOYEE_ASSIGNMENTS.filter((a) => a.employeeId === employeeId)
}

/**
 * Resolve an assignment to its display view: the component, the source
 * (Default when no override) and the effective nominal. Formula components
 * are evaluated against the employee's salary inputs; evaluation failures
 * surface as `formulaError` with `effectiveNominal === null`.
 */
export function buildAssignmentView(
  assignment: EmployeeSalaryAssignment,
  inputs: SalaryInputs | undefined,
): AssignmentView {
  const component = getComponentById(assignment.componentId)
  if (!component) {
    return {
      assignment,
      component: { id: assignment.componentId, nama: 'Komponen tidak dikenal', tipe: 'earning', mode: 'fixed', nominal: null, status: 'nonaktif' },
      source: 'default',
      effectiveNominal: null,
      formulaError: 'Komponen tidak ditemukan',
    }
  }
  const source: AssignmentSource = assignment.overrideNominal != null ? 'override' : 'default'

  if (component.mode === 'fixed') {
    return {
      assignment,
      component,
      source,
      effectiveNominal: assignment.overrideNominal ?? component.nominal ?? 0,
    }
  }

  if (!inputs) {
    return {
      assignment,
      component,
      source,
      effectiveNominal: null,
      formulaError: 'Data gaji pokok karyawan tidak tersedia',
    }
  }

  const result = evaluateFormulaResult(component.formula ?? '', {
    gaji_pokok: inputs.gajiPokok,
    tarif_lembur: inputs.tarifLembur,
    jam_kerja: inputs.jamKerja,
    jam_lembur: inputs.jamLembur,
  })
  if (!result.ok) {
    return { assignment, component, source, effectiveNominal: null, formulaError: result.error }
  }
  return { assignment, component, source, effectiveNominal: result.value }
}