/**
 * KaryawanKu — mock settings data (FE-only, ticket #15).
 *
 * Backs the `/settings` page: business profile, leave types (jenis cuti),
 * the default salary-component summary, and workspace users & roles. All of
 * it is mock — nothing hits a backend.
 */

export type JenisUsaha = 'fnb' | 'jasa'

export interface BusinessProfile {
  namaBisnis: string
  jenisUsaha: JenisUsaha
  alamat: string
}

/** Seed from the onboarding wizard (01), prefill for the settings form. */
export const BUSINESS_PROFILE: BusinessProfile = {
  namaBisnis: 'Warung Kopi Nusantara',
  jenisUsaha: 'fnb',
  alamat: 'Jl. Melati No. 12, Jakarta Selatan',
}

export type CarryOverPolicy =
  | { type: 'hangus' }
  | { type: 'carry-over'; maxHari: number }

export interface LeaveTypeSetting {
  id: string
  nama: string
  defaultKuotaHari: number
  /** What happens to unused quota from the previous year. */
  kebijakanSisa: CarryOverPolicy
}

export const LEAVE_TYPE_SETTINGS: LeaveTypeSetting[] = [
  {
    id: 'lt-1',
    nama: 'Cuti Tahunan',
    defaultKuotaHari: 12,
    kebijakanSisa: { type: 'carry-over', maxHari: 5 },
  },
  {
    id: 'lt-2',
    nama: 'Cuti Sakit',
    defaultKuotaHari: 5,
    kebijakanSisa: { type: 'hangus' },
  },
  {
    id: 'lt-3',
    nama: 'Cuti Izin',
    defaultKuotaHari: 3,
    kebijakanSisa: { type: 'hangus' },
  },
  {
    id: 'lt-4',
    nama: 'Cuti Melahirkan',
    defaultKuotaHari: 90,
    kebijakanSisa: { type: 'hangus' },
  },
]

/** Label helper for the "Kebijakan Sisa" column chip. */
export function kebijakanSisaLabel(policy: CarryOverPolicy): string {
  if (policy.type === 'hangus') return 'Hangus'
  return `Carry-over max ${policy.maxHari} hari`
}

export type UserRole = 'owner' | 'employee'

export interface WorkspaceUser {
  id: string
  nama: string
  email: string
  role: UserRole
  status: 'aktif' | 'nonaktif'
  /** The connected employee id (from employees-mock), if any. */
  employeeId: string | null
}

export const WORKSPACE_USERS: WorkspaceUser[] = [
  { id: 'u-1', nama: 'Pak Darmawan', email: 'darmawan@warungkopi.id', role: 'owner', status: 'aktif', employeeId: null },
  { id: 'u-2', nama: 'Maya Sari', email: 'maya@warungkopi.id', role: 'owner', status: 'aktif', employeeId: '6' },
  { id: 'u-3', nama: 'Budi Santoso', email: 'budi@warungkopi.id', role: 'employee', status: 'aktif', employeeId: '1' },
  { id: 'u-4', nama: 'Siti Nurhaliza', email: 'siti@warungkopi.id', role: 'employee', status: 'aktif', employeeId: '2' },
  { id: 'u-5', nama: 'Ahmad Fauzi', email: 'ahmad@warungkopi.id', role: 'employee', status: 'aktif', employeeId: '3' },
  { id: 'u-6', nama: 'Rudi Hermawan', email: 'rudi@warungkopi.id', role: 'employee', status: 'nonaktif', employeeId: '5' },
]

/** Active default salary components (mirrors the Salary Components seeds). */
export const ACTIVE_SALARY_COMPONENTS = 7

export const JENIS_USAHA_OPTIONS: { value: JenisUsaha; label: string }[] = [
  { value: 'fnb', label: 'F&B' },
  { value: 'jasa', label: 'Jasa' },
]
