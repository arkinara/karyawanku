import Link from 'next/link'
import type { NavKey, RoleNav } from '@/lib/nav-config'
import { Icon } from '@/components/ui/icon'

export interface BottomNavProps {
  nav: RoleNav
  activeNav: NavKey
}

/**
 * Mobile bottom navigation — fixed bottom, max 5 primary destinations
 * (`.bottomnav` CSS hides it at ≥1024px). Secondary items like "Pengaturan"
 * live only in the rail/drawer, never here.
 */
export function BottomNav({ nav, activeNav }: BottomNavProps) {
  return (
    <nav className="bottomnav" aria-label="Navigasi utama (mobile)">
      {nav.primary.slice(0, 5).map((item) => {
        const active = item.key === activeNav
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="bnav-item"
          >
            {active && <span className="pill" aria-hidden="true" />}
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
            {item.badge != null && (
              <>
                <span className="bnav-dot" aria-hidden="true" />
                <span className="sr-only">{item.badge} menunggu</span>
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}