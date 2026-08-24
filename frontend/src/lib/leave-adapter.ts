/**
 * KaryawanKu — leave mappers (BE snake_case → FE camelCase).
 *
 * The BE serialises leave rows with `tanggal_mulai`, `leave_type_id`, etc.;
 * the FE type (`LeaveRequest` in `leave-mock.ts`) is camelCase. We map here
 * so the page can keep using its existing types without copy/paste churn.
 */

import type { LeaveRequest, LeaveStatus } from '@/lib/leave-mock'
import { EMPLOYEES } from '@/lib/employees-mock'
import { hitungDurasi } from '@/lib/leave-mock'

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
function findLeaveTypeIdByName(name: string): import('@/lib/leave-mock').LeaveType {
  const lower = name.toLowerCase()
  if (lower.includes('tahunan')) return 'tahunan'
  if (lower.includes('sakit')) return 'sakit'
  if (lower.includes('izin')) return 'izin'
  if (lower.includes('melahirkan')) return 'melahirkan'
  if (lower.includes('penting')) return 'penting'
  return 'tahunan'
}

export function mapLeaveRequest(be: BeLeaveRequest): LeaveRequest {
  const emp = EMPLOYEES.find((e) => e.id === be.employee_id)
  return {
    id: be.id,
    employeeId: be.employee_id,
    nama: be.employee_name || emp?.nama || 'Karyawan',
    jabatan: emp?.jabatan ?? '—',
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
export function mapLeaveBalances(be: BeLeaveBalanceResponse): import('@/lib/leave-mock').LeaveBalance {
  const balance: import('@/lib/leave-mock').LeaveBalance = {
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

export function mapLeaveType(be: BeLeaveType): { id: string; name: string; jenis: import('@/lib/leave-mock').LeaveType } {
  return {
    id: be.id,
    name: be.nama_jenis_cuti,
    jenis: findLeaveTypeIdByName(be.nama_jenis_cuti),
  }
}
