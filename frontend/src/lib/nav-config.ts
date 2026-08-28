import type { IconName } from '@/components/ui/icon'

export type NavKey =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'home'
  | 'payslip'
  | 'settings'
  | 'shifts'

export type UserRole = 'owner' | 'employee'

export interface NavItem {
  key: NavKey
  /** Bahasa Indonesia — e.g. "Karyawan", "Cuti". */
  label: string
  /** Icon name from the ProMax `ICON` map (see `components/ui/icon.tsx`). */
  icon: IconName
  href: string
  /** Pending-count badge shown in rail + drawer + bottom nav dot. */
  badge?: number
}

export interface OrgMeta {
  name: string
  meta: string
  mono: string
}

export interface UserMeta {
  name: string
  role: string
  mono: string
}

export interface RoleNav {
  role: UserRole
  org: OrgMeta
  user: UserMeta
  /** Main destinations; mobile bottom nav slices `primary.slice(0, 5)`. */
  primary: NavItem[]
  /** Rail "Akun" group + mobile drawer only — never in the bottom nav. */
  secondary: NavItem[]
}

/**
 * Single source of the navigation model — mirrors `kk.js` `NAV` (lines 113-138).
 * Routes are the App Router paths each page will live at.
 */
export const NAV: Record<UserRole, RoleNav> = {
  owner: {
    role: 'owner',
    org: { name: 'Warung Kopi Nusantara', meta: 'Paket Gratis · 12 karyawan', mono: 'WK' },
    user: { name: 'Pak Darmawan', role: 'Pemilik', mono: 'PD' },
    primary: [
      { key: 'dashboard', label: 'Ringkasan', icon: 'dashboard', href: '/dashboard' },
      { key: 'employees', label: 'Karyawan', icon: 'users', href: '/employees' },
      { key: 'attendance', label: 'Absensi', icon: 'clock', href: '/attendance' },
      { key: 'leave', label: 'Cuti', icon: 'calendar', href: '/leave', badge: 2 },
      { key: 'payroll', label: 'Payroll', icon: 'wallet', href: '/payroll' },
    ],
    secondary: [{ key: 'settings', label: 'Pengaturan', icon: 'settings', href: '/settings' }],
  },
  employee: {
    role: 'employee',
    org: { name: 'Warung Kopi Nusantara', meta: 'Cabang Kemang', mono: 'WK' },
    user: { name: 'Siti Nurhaliza', role: 'Kasir', mono: 'SN' },
    primary: [
      { key: 'home', label: 'Beranda', icon: 'home', href: '/dashboard' },
      { key: 'attendance', label: 'Absensi', icon: 'clock', href: '/attendance' },
      { key: 'leave', label: 'Cuti', icon: 'calendar', href: '/leave', badge: 1 },
      { key: 'payslip', label: 'Slip Gaji', icon: 'payslip', href: '/payslips' },
    ],
    secondary: [],
  },
}

/** Alias kept for callers that prefer an explicit name. */
export type NavConfig = RoleNav