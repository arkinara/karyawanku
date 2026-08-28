'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import type { UserRole } from '@/lib/nav-config'
import { roleHome } from '@/lib/nav-config'

/**
 * KaryawanKu — client-side route guard (ticket #48).
 *
 * Wraps every authenticated page. Next.js middleware is deliberately NOT used:
 * it cannot read the localStorage bearer token, so auth + role checks happen
 * here, on the client, before any protected content paints:
 *
 * * `loading === true`  → full-page spinner (no redirect flash)
 * * `user === null`     → `router.replace('/signin?redirect=<path>')`
 * * role not permitted  → `router.replace(roleHome(role))` + "Akses ditolak"
 *
 * The sign-in page reads `?redirect=` and sends the user back to the original
 * destination after a successful login.
 */

/** sessionStorage flag so the "Akses ditolak" notice survives the redirect. */
export const ACCESS_DENIED_KEY = 'kk-access-denied'

/** Stable role sets — pass these, not inline arrays, to keep the effect deps stable. */
export const OWNER_ONLY: UserRole[] = ['owner']
export const EMPLOYEE_ONLY: UserRole[] = ['employee']
/** Owner + manager: management surfaces (dashboard, roster, employees). */
export const MANAGER_ROLES: UserRole[] = ['owner', 'manager']
export const ANY_ROLE: UserRole[] = ['owner', 'manager', 'employee']

export interface AuthGuardProps {
  /** Roles allowed to see `children`. */
  requiredRoles: UserRole[]
  children: ReactNode
}

function RouteGuardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat halaman"
      className="grid min-h-dvh place-items-center bg-surface-1 p-8"
    >
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-current/30 border-t-current text-primary"
      />
    </div>
  )
}

function DeniedToast() {
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-full bg-danger px-5 py-3 text-sm font-medium text-danger-on shadow-e4"
    >
      Akses ditolak
    </div>
  )
}

export function AuthGuard({ requiredRoles, children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()

  const [denied, setDenied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Surface a "Akses ditolak" notice carried over from the previous route via
  // sessionStorage — the toast survives the redirect to the role home.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ACCESS_DENIED_KEY)) {
        sessionStorage.removeItem(ACCESS_DENIED_KEY)
        setNotice('Akses ditolak')
      }
    } catch {
      // sessionStorage unavailable (SSR / privacy mode) — ignore.
    }
  }, [])

  const rolesKey = requiredRoles.join(',')

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`)
      return
    }
    if (!requiredRoles.includes(user.role)) {
      setDenied(true)
      try {
        sessionStorage.setItem(ACCESS_DENIED_KEY, '1')
      } catch {
        // best-effort — the inline toast below still fires
      }
      router.replace(roleHome(user.role))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, rolesKey, pathname])

  if (loading) return <RouteGuardSkeleton />

  if (!user || !requiredRoles.includes(user.role)) {
    // Redirect already fired; render nothing so no protected content leaks.
    return <>{denied ? <DeniedToast /> : null}</>
  }

  return (
    <>
      {notice && <DeniedToast />}
      {children}
    </>
  )
}