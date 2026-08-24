/**
 * KaryawanKu — attendance status derivation (ticket #10).
 *
 * Given a clock-in time and the shift schedule start, decide whether the
 * employee is "hadir" (on time) or "telat" (late), plus the late delta in
 * minutes. Comparison is time-of-day only against `scheduleStart`.
 */

export type AttendanceStatus = 'hadir' | 'telat' | 'absen' | 'izin'

export interface ComputedStatus {
  status: 'hadir' | 'telat'
  /** `max(0, clockIn - scheduleStart)` in whole minutes. */
  lateMinutes: number
}

const DEFAULT_SCHEDULE_START = '08:00'

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((n) => parseInt(n, 10))
  return {
    hour: Number.isFinite(hour) ? hour : 8,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

export function computeStatus(
  clockIn: Date,
  scheduleStart: string = DEFAULT_SCHEDULE_START,
): ComputedStatus {
  const { hour, minute } = parseTime(scheduleStart)
  const start = new Date(clockIn.getTime())
  start.setHours(hour, minute, 0, 0)

  const diffMinutes = (clockIn.getTime() - start.getTime()) / 60000
  const lateMinutes = Math.max(0, Math.round(diffMinutes))

  return { status: diffMinutes > 0 ? 'telat' : 'hadir', lateMinutes }
}