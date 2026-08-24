/**
 * KaryawanKu — mock weekly shift roster data (FE-only, ticket #12).
 *
 * A per-week roster holds a 12-employee × 7-day matrix of shift assignments
 * plus a `published` flag. Owner edits/publishes through the grid editor;
 * employee only ever sees their own published shifts. Module-level state keeps
 * edits + publish consistent across renders within a session.
 */

import { EMPLOYEES } from '@/lib/employees-mock'

export type ShiftKey = 'libur' | 'pagi' | 'siang' | 'malam'

export interface ShiftDef {
  key: ShiftKey
  /** Bahasa Indonesia label shown in pickers/badges. */
  label: string
  /** "HH:mm-HH:mm", or null for the libur (off) option. */
  time: string | null
}

/** The four shifts an owner can assign per cell. */
export const SHIFTS: Record<ShiftKey, ShiftDef> = {
  libur: { key: 'libur', label: '—', time: null },
  pagi: { key: 'pagi', label: 'Pagi', time: '07:00-15:00' },
  siang: { key: 'siang', label: 'Siang', time: '12:00-20:00' },
  malam: { key: 'malam', label: 'Malam', time: '16:00-00:00' },
}

/** Ordered option list for the cell `<select>` (libur first = default). */
export const SHIFT_OPTIONS: ShiftDef[] = [
  SHIFTS.libur,
  SHIFTS.pagi,
  SHIFTS.siang,
  SHIFTS.malam,
]

export const DAYS = 7
export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

/**
 * Default weekly pattern: a mix of Pagi / Siang / Malam with the rest Libur,
 * applied to any week on first access (deterministic, mock).
 */
const TEMPLATE: ShiftKey[][] = [
  ['pagi', 'pagi', 'pagi', 'siang', 'siang', 'libur', 'libur'],
  ['siang', 'siang', 'malam', 'pagi', 'pagi', 'pagi', 'libur'],
  ['malam', 'malam', 'malam', 'pagi', 'pagi', 'libur', 'libur'],
  ['pagi', 'pagi', 'siang', 'siang', 'malam', 'malam', 'libur'],
  ['libur', 'pagi', 'pagi', 'siang', 'siang', 'pagi', 'pagi'],
  ['siang', 'malam', 'pagi', 'pagi', 'pagi', 'libur', 'siang'],
  ['pagi', 'pagi', 'malam', 'malam', 'malam', 'libur', 'libur'],
  ['libur', 'libur', 'pagi', 'pagi', 'siang', 'siang', 'pagi'],
  ['siang', 'siang', 'pagi', 'pagi', 'pagi', 'libur', 'libur'],
  ['malam', 'malam', 'siang', 'pagi', 'pagi', 'pagi', 'libur'],
  ['pagi', 'pagi', 'libur', 'siang', 'siang', 'malam', 'malam'],
  ['libur', 'libur', 'siang', 'siang', 'pagi', 'pagi', 'pagi'],
]

interface WeekRoster {
  /** `employeeId-dayIndex` → shift. */
  cells: Record<string, ShiftKey>
  published: boolean
}

/** Session store, keyed by the week's Monday date (YYYY-MM-DD). */
const store = new Map<string, WeekRoster>()

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
    copy.setDate(d.getDate() + i)
    return toIso(copy)
  })
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

function ensure(weekStart: string): WeekRoster {
  let roster = store.get(weekStart)
  if (!roster) {
    const cells: Record<string, ShiftKey> = {}
    EMPLOYEES.forEach((employee, i) => {
      const row = TEMPLATE[i] ?? TEMPLATE[0]
      for (let day = 0; day < DAYS; day++) cells[`${employee.id}-${day}`] = row[day]
    })
    roster = { cells, published: false }
    store.set(weekStart, roster)
  }
  return roster
}

/** 12×7 matrix for the owner grid (draft included). */
export function getWeekShifts(weekStart: string): ShiftKey[][] {
  const roster = ensure(weekStart)
  return EMPLOYEES.map((employee) =>
    Array.from({ length: DAYS }, (_, day) => roster.cells[`${employee.id}-${day}`] ?? 'libur'),
  )
}

/** Owner assigns one shift to a specific employee/day cell. */
export function setShift(
  weekStart: string,
  employeeId: string,
  dayIndex: number,
  shift: ShiftKey,
): void {
  const roster = ensure(weekStart)
  roster.cells[`${employeeId}-${dayIndex}`] = shift
}

/** Fill every libur (empty) cell of the week with `shift`. */
export function applyPatternToWeek(weekStart: string, shift: ShiftKey): void {
  const roster = ensure(weekStart)
  for (const employee of EMPLOYEES) {
    for (let day = 0; day < DAYS; day++) {
      const key = `${employee.id}-${day}`
      if ((roster.cells[key] ?? 'libur') === 'libur') roster.cells[key] = shift
    }
  }
}

export function isWeekPublished(weekStart: string): boolean {
  return ensure(weekStart).published
}

/** Owner publishes a week — after this, employees can see their shifts. */
export function publishWeek(weekStart: string): void {
  ensure(weekStart).published = true
}

/**
 * The employee's own 7 shifts for a week. Only returned once the week is
 * published — a draft roster is invisible to employees (Phase 1 read-only).
 */
export function getEmployeeShifts(employeeId: string, weekStart: string): ShiftKey[] {
  const roster = ensure(weekStart)
  if (!roster.published) return Array.from({ length: DAYS }, () => 'libur' as ShiftKey)
  return Array.from({ length: DAYS }, (_, day) => roster.cells[`${employeeId}-${day}`] ?? 'libur')
}

/** Test hook — wipe session state so each test starts clean. */
export function __resetShiftStore(): void {
  store.clear()
}
