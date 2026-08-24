/**
 * KaryawanKu — mock attendance data (FE-only, ticket #10).
 *
 * Today's team attendance is derived from the employee directory
 * (`employees-mock`) so the table always matches the master data. Status and
 * late minutes are computed with `computeStatus` against the 08:00 schedule
 * start, not hardcoded.
 */

import { EMPLOYEES } from '@/lib/employees-mock'
import { computeStatus } from '@/lib/attendance-status'
import type { AttendanceStatus } from '@/lib/attendance-status'

export type AttendanceStatusKey = AttendanceStatus

export interface AttendanceRecord {
  id: string
  employeeId: string
  nama: string
  jabatan: string
  /** YYYY-MM-DD */
  tanggal: string
  /** HH:mm, or null when the employee has not clocked in. */
  clockIn: string | null
  /** HH:mm, or null while the employee is still on shift. */
  clockOut: string | null
  status: AttendanceStatusKey
  lateMinutes: number
  catatan: string
  isManual: boolean
}

export interface ManualEntryInput {
  employeeId: string
  tanggal: string
  clockIn: string
  clockOut: string
  catatan: string
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Resolve an `HH:mm` string to a Date on `base`'s day (local time). */
export function timeToDate(base: Date, time: string): Date {
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date(base.getTime())
  date.setHours(hour, minute, 0, 0)
  return date
}

/** Per-employee plan for "today". 10 hadir + 2 telat keeps metrics exact. */
const PLAN: Record<string, { clockIn: string | null; clockOut: string | null; catatan: string }> = {
  '1': { clockIn: '07:45', clockOut: '17:00', catatan: 'Shift pagi' },
  '2': { clockIn: '07:50', clockOut: null, catatan: '' },
  '3': { clockIn: '08:20', clockOut: null, catatan: 'Macet tol' },
  '4': { clockIn: '07:35', clockOut: '16:00', catatan: '' },
  '5': { clockIn: '07:55', clockOut: '16:30', catatan: '' },
  '6': { clockIn: '07:40', clockOut: '17:05', catatan: '' },
  '7': { clockIn: '08:30', clockOut: null, catatan: 'Antrean bank' },
  '8': { clockIn: '07:58', clockOut: '16:45', catatan: '' },
  '9': { clockIn: '07:42', clockOut: null, catatan: '' },
  '10': { clockIn: '07:47', clockOut: '17:10', catatan: '' },
  '11': { clockIn: '07:52', clockOut: '18:00', catatan: 'Rute padat' },
  '12': { clockIn: '07:33', clockOut: '16:20', catatan: '' },
}

export function getTodayAttendance(date: Date = new Date()): AttendanceRecord[] {
  const tanggal = toIsoDate(date)
  return EMPLOYEES.map((employee) => {
    const plan = PLAN[employee.id] ?? { clockIn: null, clockOut: null, catatan: '' }
    const computed = plan.clockIn ? computeStatus(timeToDate(date, plan.clockIn)) : null

    return {
      id: `att-${employee.id}-${tanggal}`,
      employeeId: employee.id,
      nama: employee.nama,
      jabatan: employee.jabatan,
      tanggal,
      clockIn: plan.clockIn,
      clockOut: plan.clockOut,
      status: computed?.status ?? 'absen',
      lateMinutes: computed?.lateMinutes ?? 0,
      catatan: plan.catatan,
      isManual: false,
    }
  })
}

export interface AttendanceSummary {
  hadir: number
  telat: number
  absen: number
  izin: number
}

export function summarizeAttendance(records: AttendanceRecord[]): AttendanceSummary {
  const summary: AttendanceSummary = { hadir: 0, telat: 0, absen: 0, izin: 0 }
  for (const record of records) summary[record.status] += 1
  return summary
}

/** Build a record from the Owner manual-entry form; status auto-derived. */
export function buildManualRecord(input: ManualEntryInput, date: Date = new Date()): AttendanceRecord {
  const employee = EMPLOYEES.find((e) => e.id === input.employeeId)
  const computed = computeStatus(timeToDate(date, input.clockIn))

  return {
    id: `att-manual-${Date.now()}`,
    employeeId: input.employeeId,
    nama: employee?.nama ?? 'Karyawan',
    jabatan: employee?.jabatan ?? '-',
    tanggal: input.tanggal,
    clockIn: input.clockIn,
    clockOut: input.clockOut || null,
    status: computed.status,
    lateMinutes: computed.lateMinutes,
    catatan: input.catatan.trim(),
    isManual: true,
  }
}