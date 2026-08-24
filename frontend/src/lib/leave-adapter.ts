/**
 * KaryawanKu — leave domain types, helpers + BE mappers (snake_case → camelCase).
 *
 * The FE leave page consumes the Fastify BE (`/api/leave-requests`,
 * `/api/leave-balances`, `/api/leave-types`) and maps every row to a shared
 * camelCase `LeaveRequest` shape. Domain constants (`JENIS_LABEL`,
 * `JENIS_BALANCE`) and pure helpers (`hitungDurasi`, `leaveBalanceSisa`,
 * `summarizeLeave`) live here too so no mock module is needed.
 */

/* ------------------------------------------------------------------ *
 * Leave domain (FE types + constants + helpers)
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * BE wire types + mappers
 * ------------------------------------------------------------------ */

export interface BeLeaveRequest {
  id: string
  employee_id: string
  employee_name: string
  leave_type_id: string
  leave_type_name: string
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string | null
  status: 'pending' | 'disetujui' | 'ditolak'
  approver_user_id: string | null
  catatan_approver: string | null
  created_at: string
  decided_at: string | null
}

const STATUS_MAP: Record<BeLeaveRequest['status'], LeaveStatus> = {
  pending: 'pending',
  disetujui: 'approved',
  ditolak: 'rejected',
}

/**
 * Map a leave type name (`nama_jenis_cuti`) from the BE back to the FE
 * `LeaveType` enum used by the existing UI. Falls back to the slugged form
 * when the BE name doesn't match a known label (e.g. admin-renamed types).
 */
export function findLeaveTypeIdByName(name: string): LeaveType {
  const lower = name.toLowerCase()
  if (lower.includes('tahunan')) return 'tahunan'
  if (lower.includes('sakit')) return 'sakit'
  if (lower.includes('izin')) return 'izin'
  if (lower.includes('melahirkan')) return 'melahirkan'
  if (lower.includes('penting')) return 'penting'
  return 'tahunan'
}

export function mapLeaveRequest(be: BeLeaveRequest): LeaveRequest {
  return {
    id: be.id,
    employeeId: be.employee_id,
    nama: be.employee_name || 'Karyawan',
    jabatan: '—',
    jenis: findLeaveTypeIdByName(be.leave_type_name),
    tanggalMulai: be.tanggal_mulai,
    tanggalSelesai: be.tanggal_selesai,
    durasi: hitungDurasi(be.tanggal_mulai, be.tanggal_selesai),
    alasan: be.alasan ?? '',
    status: STATUS_MAP[be.status],
    catatan: be.catatan_approver ?? '',
  }
}

export function mapLeaveRequests(beRows: BeLeaveRequest[]): LeaveRequest[] {
  return beRows.map(mapLeaveRequest)
}

export interface BeLeaveBalance {
  id: string
  employee_id: string
  leave_type_id: string
  nama_jenis_cuti: string
  tahun: number
  kuota_hari: number
  terpakai_hari: number
  sisa_hari: number
}

export interface BeLeaveBalanceResponse {
  employee_id: string
  tahun: number
  balances: BeLeaveBalance[]
}

/** Convert BE `leave-balances` response into the FE `LeaveBalance` shape. */
export function mapLeaveBalances(be: BeLeaveBalanceResponse): LeaveBalance {
  const balance: LeaveBalance = {
    tahunan: { kuota: 0, terpakai: 0 },
    sakit: { kuota: 0, terpakai: 0 },
    izin: { kuota: 0, terpakai: 0 },
  }
  for (const row of be.balances) {
    const lower = row.nama_jenis_cuti.toLowerCase()
    if (lower.includes('tahunan')) balance.tahunan = { kuota: row.kuota_hari, terpakai: row.terpakai_hari }
    else if (lower.includes('sakit')) balance.sakit = { kuota: row.kuota_hari, terpakai: row.terpakai_hari }
    else if (lower.includes('izin')) balance.izin = { kuota: row.kuota_hari, terpakai: row.terpakai_hari }
  }
  return balance
}

export interface BeLeaveType {
  id: string
  nama_jenis_cuti: string
  default_kuota_hari: number
  kebijakan_sisa: 'hangus' | 'carry-over'
  carry_over_max_days: number | null
  aktif: boolean
}

export interface BeLeaveTypeListResponse {
  leave_types: BeLeaveType[]
}

export function mapLeaveType(be: BeLeaveType): { id: string; name: string; jenis: LeaveType } {
  return {
    id: be.id,
    name: be.nama_jenis_cuti,
    jenis: findLeaveTypeIdByName(be.nama_jenis_cuti),
  }
}
