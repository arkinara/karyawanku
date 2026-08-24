/**
 * KaryawanKu — shifts roster adapter (BE snake_case → FE camelCase).
 *
 * The BE roster model is:
 *   `shifts` — named shifts (Pagi/Siang/Malam/Libur) with jam_mulai/jam_selesai.
 *   `shift_assignments` — per-employee per-date rows with a `published` flag.
 *
 * The FE page keeps a single 12-row × 7-day matrix in memory and re-fetches
 * the roster on week navigation, edit, and publish.
 */

import { EMPLOYEES } from '@/lib/employees-mock'
import { DAY_LABELS, SHIFTS, type ShiftKey } from '@/lib/shifts-mock'

export interface BeShift {
  id: string
  business_id: string
  nama_shift: 'Pagi' | 'Siang' | 'Malam' | 'Libur'
  jam_mulai: string
  jam_selesai: string
  aktif: boolean
}

export interface BeShiftAssignment {
  id: string
  employee_id: string
  employee_name: string
  shift_id: string
  shift: BeShift | null
  tanggal: string
  published: boolean
  published_at: string | null
  published_by_user_id: string | null
}

const SHIFT_NAME_TO_KEY: Record<BeShift['nama_shift'], ShiftKey> = {
  Pagi: 'pagi',
  Siang: 'siang',
  Malam: 'malam',
  Libur: 'libur',
}

/** Build a 12-row × 7-day matrix of shift keys for a given week. */
export function buildMatrixFromAssignments(
  assignments: BeShiftAssignment[],
  weekStartIso: string,
): ShiftKey[][] {
  const matrix: ShiftKey[][] = EMPLOYEES.map(() => Array.from({ length: 7 }, () => 'libur' as ShiftKey))
  if (!weekStartIso) return matrix
  const weekStart = new Date(`${weekStartIso}T00:00:00`)
  for (const row of assignments) {
    const empIdx = EMPLOYEES.findIndex((e) => e.id === row.employee_id)
    if (empIdx === -1) continue
    const rowDate = new Date(`${row.tanggal}T00:00:00`)
    const diffDays = Math.round((rowDate.getTime() - weekStart.getTime()) / 86400000)
    if (diffDays < 0 || diffDays > 6) continue
    const nama = row.shift?.nama_shift ?? 'Libur'
    matrix[empIdx][diffDays] = SHIFT_NAME_TO_KEY[nama] ?? 'libur'
  }
  return matrix
}

/** Determine if any assignment in the week is published. */
export function isWeekPublishedFromAssignments(assignments: BeShiftAssignment[]): boolean {
  return assignments.some((a) => a.published)
}

/** Extract just this employee's shifts for the given week, ordered Mon→Sun. */
export function getEmployeeShiftsFromAssignments(
  assignments: BeShiftAssignment[],
  employeeId: string,
  weekStartIso: string,
): ShiftKey[] {
  const out: ShiftKey[] = Array.from({ length: 7 }, () => 'libur' as ShiftKey)
  if (!weekStartIso || !employeeId) return out
  const weekStart = new Date(`${weekStartIso}T00:00:00`)
  for (const row of assignments) {
    if (row.employee_id !== employeeId) continue
    const rowDate = new Date(`${row.tanggal}T00:00:00`)
    const diffDays = Math.round((rowDate.getTime() - weekStart.getTime()) / 86400000)
    if (diffDays < 0 || diffDays > 6) continue
    const nama = row.shift?.nama_shift ?? 'Libur'
    out[diffDays] = SHIFT_NAME_TO_KEY[nama] ?? 'libur'
  }
  return out
}

/** Map a FE ShiftKey back to the BE shift record (looks up by nama_shift). */
export function pickShiftRecord(
  shifts: BeShift[],
  key: ShiftKey,
): BeShift | undefined {
  const target = Object.entries(SHIFT_NAME_TO_KEY).find(([, k]) => k === key)?.[0]
  if (!target) return undefined
  return shifts.find((s) => s.nama_shift === target)
}

export { SHIFTS, DAY_LABELS }
export type { ShiftKey }
