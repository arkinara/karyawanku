/**
 * KaryawanKu — attendance adapter (BE snake_case → FE display shape, ticket #35).
 *
 * The BE attendance records carry ISO timestamps for clock_in/clock_out. The
 * page displays them as local `HH:mm`. Status and late_minutes come straight
 * from the server (never recomputed client-side), per ticket #35 ACs.
 */

export interface BeAttendanceRecord {
  id: string
  employee_id: string
  tanggal: string
  clock_in: string | null
  clock_out: string | null
  catatan: string | null
  status: 'hadir' | 'telat' | 'absen' | 'izin'
  late_minutes: number | null
  is_manual?: boolean
}

export interface TeamAttendanceRow {
  id: string
  employeeId: string
  nama: string
  nik: string
  tanggal: string
  clockIn: string | null
  clockOut: string | null
  status: BeAttendanceRecord['status']
  lateMinutes: number
  catatan: string
  isManual: boolean
}

/** Convert an ISO timestamp to local `HH:mm`, or null when absent. */
export function toClockTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Build a row for a single employee, using the (optional) today record. */
export function mapAttendanceRow(
  employee: { id: string; nama_lengkap: string; no_ktp: string },
  record: BeAttendanceRecord | null,
  tanggal: string,
): TeamAttendanceRow {
  return {
    id: record?.id ?? `att-${employee.id}-${tanggal}`,
    employeeId: employee.id,
    nama: employee.nama_lengkap,
    nik: employee.no_ktp,
    tanggal,
    clockIn: toClockTime(record?.clock_in ?? null),
    clockOut: toClockTime(record?.clock_out ?? null),
    status: record?.status ?? 'absen',
    lateMinutes: record?.late_minutes ?? 0,
    catatan: record?.catatan ?? '',
    isManual: record?.is_manual ?? false,
  }
}
