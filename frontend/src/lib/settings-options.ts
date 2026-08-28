/**
 * KaryawanKu — settings shared UI types + static option lists.
 *
 * The Profil Bisnis, Komponen Gaji, Jenis Cuti, and Pengguna panels are all
 * wired to the BE (`/api/businesses`, `/api/salary-components`,
 * `/api/leave-types`, `/api/users`); this module only holds the shared types
 * and the static option list used by the settings page.
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
  /** The connected employee id, if any. */
  employeeId: string | null
}

export const JENIS_USAHA_OPTIONS: { value: JenisUsaha; label: string }[] = [
  { value: 'fnb', label: 'F&B' },
  { value: 'jasa', label: 'Jasa' },
]
