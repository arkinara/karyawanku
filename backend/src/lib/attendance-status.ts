/**
 * KaryawanKu — attendance status derivation (tickets #22 + #23).
 *
 * Mirrors `frontend/src/lib/attendance-status.ts`. Given a clock-in time and the
 * shift schedule start, decide whether the employee is "hadir" (on time) or
 * "telat" (late), plus the late delta in whole minutes. Comparison is
 * time-of-day only against `scheduleStart`.
 */

export type AttendanceStatus = 'hadir' | 'telat' | 'absen' | 'izin'

export interface ComputedAttendanceStatus {
  status: 'hadir' | 'telat'
  /** `max(0, clockIn - scheduleStart)` in whole minutes. */
  lateMinutes: number
}

export const DEFAULT_SCHEDULE_START = '08:00'
/** Batas toleransi keterlambatan sebelum dianggap menyimpang (4 jam). */
export const MAX_LATE_MINUTES = 4 * 60

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((n) => parseInt(n, 10))
  return {
    hour: Number.isFinite(hour) ? hour : 8,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

export function computeAttendanceStatus(
  clockIn: Date,
  scheduleStart: string = DEFAULT_SCHEDULE_START,
): ComputedAttendanceStatus {
  const { hour, minute } = parseTime(scheduleStart)
  const start = new Date(clockIn.getTime())
  start.setHours(hour, minute, 0, 0)

  const diffMinutes = (clockIn.getTime() - start.getTime()) / 60000
  const lateMinutes = Math.max(0, Math.round(diffMinutes))

  return { status: diffMinutes > 0 ? 'telat' : 'hadir', lateMinutes }
}
