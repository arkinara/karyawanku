import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { CalendarDays, CalendarRange, Clock, LayoutDashboard, Receipt, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AppBar, NavRail, BottomNav } from '@/components/ui'
import type { NavItem } from '@/components/ui'

export type UserRole = 'owner' | 'manager' | 'employee'

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  userRole: UserRole
  /** Current route, e.g. "/absensi" — drives the active nav item and AppBar title. */
  currentPath: string
}

/** Nav items are declared without `active`; that is derived from `currentPath`. */
type NavEntry = Omit<NavItem, 'active'>

const DASHBOARD: NavEntry = { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }
const KARYAWAN: NavEntry = { label: 'Karyawan', icon: Users, href: '/karyawan' }
const ABSENSI: NavEntry = { label: 'Absensi', icon: Clock, href: '/absensi' }
const CUTI: NavEntry = { label: 'Cuti', icon: CalendarDays, href: '/cuti' }
const SHIFT: NavEntry = { label: 'Shift', icon: CalendarRange, href: '/shift' }
const PENGGAJIAN: NavEntry = { label: 'Penggajian', icon: Wallet, href: '/penggajian' }
const SLIP_GAJI: NavEntry = { label: 'Slip Gaji', icon: Receipt, href: '/slip-gaji' }

const navByRole: Record<UserRole, NavEntry[]> = {
  owner: [DASHBOARD, KARYAWAN, ABSENSI, CUTI, SHIFT, PENGGAJIAN],
  manager: [DASHBOARD, KARYAWAN, ABSENSI, CUTI, SHIFT],
  employee: [DASHBOARD, ABSENSI, CUTI, SHIFT, SLIP_GAJI],
}

/** Mobile fits about four destinations before the labels start truncating. */
const MOBILE_MAX = 4

/** "/absensi" matches "/absensi" and "/absensi/123", never "/absensi-lama". */
function isActive(href: string, currentPath: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  ({ children, userRole, currentPath, className, ...props }, ref) => {
    const items: NavItem[] = navByRole[userRole].map((item) => ({
      ...item,
      active: isActive(item.href, currentPath),
    }))

    const title = items.find((item) => item.active)?.label ?? 'KaryawanKu'

    return (
      <div ref={ref} className={cn('min-h-screen bg-background', className)} {...props}>
        <AppBar title={title} sticky />

        <div className="flex">
          {/* NavRail hides itself below md; BottomNav takes over there. */}
          <NavRail items={items} className="sticky top-16 h-[calc(100vh-4rem)] shrink-0" />

          <main className="min-w-0 flex-1 p-4 pb-20 sm:p-6 md:pb-6">{children}</main>
        </div>

        <BottomNav items={items.slice(0, MOBILE_MAX)} />
      </div>
    )
  },
)

AppShell.displayName = 'AppShell'
