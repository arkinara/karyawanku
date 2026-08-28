'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { NavKey, RoleNav, UserRole } from '@/lib/nav-config'
import { NAV } from '@/lib/nav-config'
import { NavRail } from '@/components/ui/nav-rail'
import { AppBar } from '@/components/ui/app-bar'
import { BottomNav } from '@/components/ui/bottom-nav'
import { Drawer } from '@/components/ui/drawer'
import { SkeletonBlock } from '@/components/ui/feedback'
import { useAuth } from '@/lib/auth-context'

export interface AppShellProps {
  userRole: UserRole
  /** Which nav item is active (must exist in the role's nav map). */
  activeNav: NavKey
  title: string
  subtitle?: string
  children: ReactNode
  /** Optional override; defaults to `NAV[userRole]` (single source). */
  nav?: RoleNav
}

/**
 * The layout shell every app page (03-07) wraps its content in — port of the
 * ProMax `buildShell()` (kk.js). Desktop (≥1024px): fixed nav rail left.
 * Mobile (<1024px): bottom nav + drawer-driven app bar. A skip-link is always
 * the first focusable element.
 */
export function AppShell({ userRole, activeNav, title, subtitle, children, nav: navOverride }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const router = useRouter()
  const { user, loading } = useAuth()

  // Crossing to desktop makes the drawer redundant — close it (kk.js wireDrawer).
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false)
  }, [isDesktop])

  useEffect(() => {
    if (!loading && !user) router.replace('/signin')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-1 p-8">
        <SkeletonBlock className="h-4 w-48" count={3} />
      </div>
    )
  }

  const nav: RoleNav = navOverride ?? {
    ...NAV[userRole],
    user: {
      name: user.nama,
      role: user.role === 'owner' ? 'Pemilik' : 'Karyawan',
      mono: initials(user.nama),
    },
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Lompat ke konten utama
      </a>

      <NavRail nav={nav} activeNav={activeNav} />

      <div className="main-col">
        <AppBar
          title={title}
          subtitle={subtitle}
          user={nav.user}
          onMenu={() => setDrawerOpen(true)}
          menuExpanded={drawerOpen}
        />

        <main id="main" className="page">
          <div className="page-inner">{children}</div>
        </main>
      </div>

      <BottomNav nav={nav} activeNav={activeNav} />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} nav={nav} activeNav={activeNav} />
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}