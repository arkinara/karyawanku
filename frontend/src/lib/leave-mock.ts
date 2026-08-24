/**
 * KaryawanKu — mock leave data (FE-only, ticket #11).
 *
 * Covers the whole leave feature against the employee directory
 * (`employees-mock`): the owner approval queue, the employee submission +
 * history view, and the annual leave balances.
 */

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type LeaveType = 'tahunan' | 'sakit' | 'izin' | 'melahirkan' | 'penting'

export interface LeaveRequest {
  id: string
  employeeId: string
  nama: string
  jabatan: string
  jenis: LeaveType
  /** YYYY-MM-DD */
  tanggalMulai: string
  /** YYYY-MM-DD (>= tanggalMulai) */
  tanggalSelesai: string
  /** Number of calendar days covered, inclusive. */
  durasi: number
  alasan: string
  status: LeaveStatus
  /** Approver note — only set once the request is processed. */
  catatan: string
}

export interface LeaveBalanceItem {
  kuota: number
  terpakai: number
}

export interface LeaveBalance {
  tahunan: LeaveBalanceItem
  sakit: LeaveBalanceItem
  izin: LeaveBalanceItem
}

/** Bahasa Indonesia label per leave type — the only wordings used in UI. */
export const JENIS_LABEL: Record<LeaveType, string> = {
  tahunan: 'Cuti Tahunan',
  sakit: 'Cuti Sakit',
  izin: 'Cuti Izin',
  melahirkan: 'Cuti Melahirkan',
  penting: 'Cuti Penting',
}

/** The three balance-tracked types (others have no annual quota). */
export const JENIS_BALANCE: readonly LeaveType[] = ['tahunan', 'sakit', 'izin']

export const DEFAULT_EMPLOYEE_ID = '2' // Siti Nurhaliza — NAV.employee.user

/**
 * 10 requests: 2 pending, 5 approved this month (2026-08), 1 rejected this
 * month, plus 2 processed last month — so the owner metrics read exactly
 * Total 2 / Disetujui 5 / Ditolak 1 and the employee (Siti) sees a history
 * covering all three statuses.
 */
export const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'lrv-01',
    employeeId: '1',
    nama: 'Budi Santoso',
    jabatan: 'Kepala Barista',
    jenis: 'tahunan',
    tanggalMulai: '2026-08-25',
    tanggalSelesai: '2026-08-25',
    durasi: 1,
    alasan: 'Perayaan keluarga di luar kota',
    status: 'pending',
    catatan: '',
  },
  {
    id: 'lrv-02',
    employeeId: '2',
    nama: 'Siti Nurhaliza',
    jabatan: 'Kasir',
    jenis: 'tahunan',
    tanggalMulai: '2026-09-14',
    tanggalSelesai: '2026-09-18',
    durasi: 5,
    alasan: 'Liburan keluarga ke Yogyakarta',
    status: 'pending',
    catatan: '',
  },
  {
    id: 'lrv-03',
    employeeId: '3',
    nama: 'Ahmad Fauzi',
    jabatan: 'Barista',
    jenis: 'tahunan',
    tanggalMulai: '2026-08-03',
    tanggalSelesai: '2026-08-05',
    durasi: 3,
    alasan: 'Kebutuhan pribadi',
    status: 'approved',
    catatan: 'Disetujui. Pengganti shift diatur.',
  },
  {
    id: 'lrv-04',
    employeeId: '4',
    nama: 'Dewi Lestari',
    jabatan: 'Pramusaji',
    jenis: 'izin',
    tanggalMulai: '2026-08-10',
    tanggalSelesai: '2026-08-10',
    durasi: 1,
    alasan: 'Keperluan keluarga',
    status: 'approved',
    catatan: 'Disetujui.',
  },
  {
    id: 'lrv-05',
    employeeId: '5',
    nama: 'Rudi Hermawan',
    jabatan: 'Kasir',
    jenis: 'sakit',
    tanggalMulai: '2026-08-12',
    tanggalSelesai: '2026-08-14',
    durasi: 3,
    alasan: 'Demam dan butuh istirahat',
    status: 'approved',
    catatan: 'Disetujui. Surat keterangan diterima.',
  },
  {
    id: 'lrv-06',
    employeeId: '6',
    nama: 'Maya Sari',
    jabatan: 'Admin',
    jenis: 'melahirkan',
    tanggalMulai: '2026-08-17',
    tanggalSelesai: '2026-08-21',
    durasi: 5,
    alasan: 'Cuti melahirkan',
    status: 'approved',
    catatan: 'Disetujui sesuai ketentuan.',
  },
  {
    id: 'lrv-07',
    employeeId: '7',
    nama: 'Fajar Nugraha',
    jabatan: 'Barista',
    jenis: 'penting',
    tanggalMulai: '2026-08-19',
    tanggalSelesai: '2026-08-20',
    durasi: 2,
    alasan: 'Urusan penting keluarga',
    status: 'approved',
    catatan: 'Disetujui.',
  },
  {
    id: 'lrv-08',
    employeeId: '9',
    nama: 'Indra Permadi',
    jabatan: 'Pramusaji',
    jenis: 'tahunan',
    tanggalMulai: '2026-08-20',
    tanggalSelesai: '2026-08-22',
    durasi: 3,
    alasan: 'Liburan mendadak',
    status: 'rejected',
    catatan: 'Ditolak: bentrok dengan jadwal rekap bulanan.',
  },
  {
    id: 'lrv-09',
    employeeId: '2',
    nama: 'Siti Nurhaliza',
    jabatan: 'Kasir',
    jenis: 'penting',
    tanggalMulai: '2026-07-06',
    tanggalSelesai: '2026-07-07',
    durasi: 2,
    alasan: 'Acara keluarga',
    status: 'approved',
    catatan: 'Disetujui. Pengganti shift diatur oleh supervisor.',
  },
  {
    id: 'lrv-10',
    employeeId: '2',
    nama: 'Siti Nurhaliza',
    jabatan: 'Kasir',
    jenis: 'izin',
    tanggalMulai: '2026-07-02',
    tanggalSelesai: '2026-07-02',
    durasi: 1,
    alasan: 'Urusan administrasi bank',
    status: 'rejected',
    catatan: 'Ditolak: jadwal kasir tidak bisa diganti.',
  },
]

export type LeaveRole = 'owner' | 'employee'

/**
 * Owner scope returns every request; employee scope returns only the requests
 * belonging to `scope` (an employee id, defaulting to the mock signed-in user).
 */
export function getLeaveRequests(role: LeaveRole, scope?: string): LeaveRequest[] {
  if (role === 'employee') {
    const id = scope ?? DEFAULT_EMPLOYEE_ID
    return LEAVE_REQUESTS.filter((r) => r.employeeId === id)
  }
  return LEAVE_REQUESTS
}

/**
 * Mock annual balances — kuota/terpakai per tracked type. Kept static for the
 * FE ticket; a real backend derives these from the yearly reset + tenure.
 */
export function getLeaveBalance(employeeId: string): LeaveBalance {
  void employeeId
  return {
    tahunan: { kuota: 12, terpakai: 0 },
    sakit: { kuota: 5, terpakai: 0 },
    izin: { kuota: 3, terpakai: 0 },
  }
}

export function leaveBalanceSisa(balance: LeaveBalance, jenis: LeaveType): number {
  if (!JENIS_BALANCE.includes(jenis)) return Infinity
  const item = balance[jenis as keyof LeaveBalance]
  return item.kuota - item.terpakai
}

/** Inclusive calendar-day count between two YYYY-MM-DD dates. */
export function hitungDurasi(mulai: string, selesai: string): number {
  const start = new Date(`${mulai}T00:00:00`)
  const end = new Date(`${selesai}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / 86400000) + 1)
}

export interface LeaveSummary {
  pending: number
  approvedThisMonth: number
  rejectedThisMonth: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isSameMonth(date: string, month: number, year: number): boolean {
  return date.startsWith(`${year}-${pad(month + 1)}`)
}

/** Owner dashboard metrics — this-month counts only count processed requests. */
export function summarizeLeave(requests: LeaveRequest[], now: Date = new Date()): LeaveSummary {
  const month = now.getMonth()
  const year = now.getFullYear()
  const summary: LeaveSummary = { pending: 0, approvedThisMonth: 0, rejectedThisMonth: 0 }
  for (const r of requests) {
    if (r.status === 'pending') summary.pending += 1
    else if (r.status === 'approved' && isSameMonth(r.tanggalMulai, month, year)) {
      summary.approvedThisMonth += 1
    } else if (r.status === 'rejected' && isSameMonth(r.tanggalMulai, month, year)) {
      summary.rejectedThisMonth += 1
    }
  }
  return summary
}