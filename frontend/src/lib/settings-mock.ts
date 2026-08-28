/**
 * KaryawanKu — settings types + constant options (ticket #44).
 *
 * The Profil Bisnis and Komponen Gaji tabs are wired to the BE (`/api/businesses`
 * and `/api/businesses/:id/default-salary-components`); this module only keeps
 * the shared UI types and the static option list used by the settings page.
 */

export type JenisUsaha = 'fnb' | 'jasa'

export interface BusinessProfile {
  namaBisnis: string
  jenisUsaha: JenisUsaha
  alamat: string
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

export type UserRole = 'owner' | 'manager' | 'employee'

export interface WorkspaceUser {
  id: string
  nama: string
  email: string
  role: UserRole
  status: 'aktif' | 'nonaktif'
  /** The connected employee id (from employees-mock), if any. */
  employeeId: string | null
}

export const JENIS_USAHA_OPTIONS: { value: JenisUsaha; label: string }[] = [
  { value: 'fnb', label: 'F&B' },
  { value: 'jasa', label: 'Jasa' },
]