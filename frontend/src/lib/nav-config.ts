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

export type UserRole = 'owner' | 'manager' | 'employee'

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
 * Single source of the navigation model — mirrors `kk.js` `NAV` (lines 113-138)
 * plus the manager entry set (ticket #50). Routes are the App Router paths each
 * page will live at.
 */
export const OWNER_NAV: RoleNav = {
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
}

/**
 * Manager: operations surfaces only. No payroll, no settings. Employees entry
 * is read-only (gated by `canEditEmployees` in the page itself).
 */
export const MANAGER_NAV: RoleNav = {
  role: 'manager',
  org: { name: 'Warung Kopi Nusantara', meta: 'Operasional · 12 karyawan', mono: 'WK' },
  user: { name: 'Manager', role: 'Manajer', mono: 'MG' },
  primary: [
    { key: 'dashboard', label: 'Ringkasan', icon: 'dashboard', href: '/dashboard' },
    { key: 'attendance', label: 'Absensi', icon: 'clock', href: '/attendance' },
    { key: 'leave', label: 'Cuti', icon: 'calendar', href: '/leave', badge: 2 },
    { key: 'shifts', label: 'Jadwal Shift', icon: 'calendar', href: '/shifts' },
    { key: 'employees', label: 'Karyawan', icon: 'users', href: '/employees' },
  ],
  secondary: [],
}

export const EMPLOYEE_NAV: RoleNav = {
  role: 'employee',
  org: { name: 'Warung Kopi Nusantara', meta: 'Cabang Kemang', mono: 'WK' },
  user: { name: 'Siti Nurhaliza', role: 'Kasir', mono: 'SN' },
  primary: [
    { key: 'home', label: 'Beranda', icon: 'home', href: '/beranda' },
    { key: 'attendance', label: 'Absensi', icon: 'clock', href: '/attendance' },
    { key: 'leave', label: 'Cuti', icon: 'calendar', href: '/leave', badge: 1 },
    { key: 'payslip', label: 'Slip Gaji', icon: 'payslip', href: '/payslips' },
  ],
  secondary: [],
}

export const NAV: Record<UserRole, RoleNav> = {
  owner: OWNER_NAV,
  manager: MANAGER_NAV,
  employee: EMPLOYEE_NAV,
}

/**
 * The nav set for a role. Unknown or future role values render the safest
 * (employee) navigation rather than crashing the shell.
 */
export function getNavForRole(role: UserRole | null | undefined): RoleNav {
  return NAV[role ?? 'employee'] ?? EMPLOYEE_NAV
}

/** Bahasa label for a role, used by the app bar / shell user chip. */
export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Pemilik',
  manager: 'Manajer',
  employee: 'Karyawan',
}

/** Alias kept for callers that prefer an explicit name. */
export type NavConfig = RoleNav

/**
 * Landing page per role, used by the route guard for role denials and by the
 * sign-in/sign-up pages when a user is already authenticated. Managers land on
 * their own dashboard, not the employee home.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  owner: '/dashboard',
  manager: '/dashboard',
  employee: '/beranda',
}

export function roleHome(role: UserRole): string {
  return ROLE_HOME[role] ?? '/beranda'
}