/**
 * KaryawanKu — weekly shift roster helpers (ticket #12, mock retired #53).
 *
 * Pure date + shift-label helpers shared by the roster grid and the employee
 * "Jadwal Saya" view. The demo grid was previously backed by the 12-employee
 * `employees-mock` module; the grid now renders real employees fetched from
 * `GET /api/employees`, so no mock employee store lives here anymore.
 */

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