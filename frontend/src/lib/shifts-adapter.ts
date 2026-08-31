/**
 * KaryawanKu — shifts roster adapter (BE snake_case → FE).
 *
 * The BE roster model is:
 *   `shifts` — named shifts (Pagi/Siang/Malam/Libur) with jam_mulai/jam_selesai.
 *   `shift_assignments` — per-employee per-date rows with a `published` flag.
 *
 * The FE page keeps a single rows×7-day matrix of `ShiftCell` state in memory
 * and re-fetches the roster on week navigation, catalogue changes, and publish.
 * This module also hosts the pure date + label helpers that previously lived in
 * `shifts-mock.ts` (retired with ticket #51).
 */

import type { Employee } from '@/lib/api-client'

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

export const SHIFT_NAMES = ['Pagi', 'Siang', 'Malam', 'Libur'] as const
export type ShiftName = (typeof SHIFT_NAMES)[number]

/**
 * One weekly-grid cell: which assignment row (if any) it maps to and which
 * shift it currently holds. `shiftId === null` means "Libur" (no shift).
 */
export interface ShiftCell {
  assignmentId: string | null
  shiftId: string | null
}

export const DAYS = 7
export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The Monday (YYYY-MM-DD) of `date`'s week. */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Sunday=0 → Monday=0
  d.setDate(d.getDate() - day)
  return toIso(d)
}

/** Shift `weekStart` by `delta` weeks; returns the new Monday date. */
export function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return toIso(d)
}

/** The 7 ISO dates (Mon-Sun) of a week. */
export function weekDates(weekStart: string): string[] {
  const d = new Date(weekStart + 'T00:00:00')
  return Array.from({ length: DAYS }, (_, i) => {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + i)
    return toIso(copy)
  })
}

/** The Sunday (YYYY-MM-DD) ending `weekStart`'s week. */
export function weekEndIso(weekStartIso: string): string {
  const dates = weekDates(weekStartIso)
  return dates[DAYS - 1]
}

/** "Minggu 18-24 Agustus 2026" */
export function formatWeekLabel(weekStart: string): string {
  const dates = weekDates(weekStart)
  const start = new Date(dates[0] + 'T00:00:00')
  const end = new Date(dates[6] + 'T00:00:00')
  const month = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(start)
  return `Minggu ${start.getDate()}-${end.getDate()} ${month} ${start.getFullYear()}`
}

/** "Senin, 18 Agustus 2026" */
export function formatDayLong(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'))
}

/** Shifts that are not soft-deactivated. */
export function activeShifts(shifts: BeShift[]): BeShift[] {
  return shifts.filter((s) => s.aktif)
}

/**
 * Build a rows×7-day matrix of cell state for a week. `employees` is the roster
 * source (fetched from the API); unassigned rows stay `{ shiftId: null }`.
 */
export function buildCellMatrix(
  assignments: BeShiftAssignment[],
  weekStartIso: string,
  employees: Employee[],
): ShiftCell[][] {
  const matrix: ShiftCell[][] = employees.map(() =>
    Array.from({ length: DAYS }, () => ({ assignmentId: null, shiftId: null })),
  )
  if (!weekStartIso) return matrix
  const weekStart = new Date(`${weekStartIso}T00:00:00`)
  for (const row of assignments) {
    const empIdx = employees.findIndex((e) => e.id === row.employee_id)
    if (empIdx === -1) continue
    const rowDate = new Date(`${row.tanggal}T00:00:00`)
    const diffDays = Math.round((rowDate.getTime() - weekStart.getTime()) / 86400000)
    if (diffDays < 0 || diffDays > 6) continue
    matrix[empIdx][diffDays] = {
      assignmentId: row.id,
      shiftId: row.shift?.id ?? null,
    }
  }
  return matrix
}

/**
 * Published state of a week plus who/when it was published (from the first
 * published assignment row — publish stamps every row in the range).
 */
export function weekPublishMeta(assignments: BeShiftAssignment[]): {
  published: boolean
  publishedAt: string | null
  publishedByUserId: string | null
} {
  const publishedRow = assignments.find((a) => a.published)
  return {
    published: Boolean(publishedRow),
    publishedAt: publishedRow?.published_at ?? null,
    publishedByUserId: publishedRow?.published_by_user_id ?? null,
  }
}

/** Extract just this employee's shift records for the week, ordered Mon→Sun. */
export function getEmployeeWeekShifts(
  assignments: BeShiftAssignment[],
  employeeId: string,
  weekStartIso: string,
): (BeShift | null)[] {
  const out: (BeShift | null)[] = Array.from({ length: DAYS }, () => null)
  if (!weekStartIso || !employeeId) return out
  const weekStart = new Date(`${weekStartIso}T00:00:00`)
  for (const row of assignments) {
    if (row.employee_id !== employeeId) continue
    const rowDate = new Date(`${row.tanggal}T00:00:00`)
    const diffDays = Math.round((rowDate.getTime() - weekStart.getTime()) / 86400000)
    if (diffDays < 0 || diffDays > 6) continue
    out[diffDays] = row.shift
  }
  return out
}