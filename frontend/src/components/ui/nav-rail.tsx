import { useId } from 'react'
import type { NavKey, RoleNav } from '@/lib/nav-config'
import { Icon } from '@/components/ui/icon'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'

export interface NavRailProps {
  nav: RoleNav
  activeNav: NavKey
}

/**
 * Desktop navigation rail — fixed left, 252px wide, hidden below 1024px
 * (`.rail` media query in globals.css). Brand top, grouped nav items, org
 * footer with avatar + business identity.
 */
export function NavRail({ nav, activeNav }: NavRailProps) {
  const primaryGroup = useId()
  const secondaryGroup = useId()

  return (
    <aside className="rail" aria-label="Navigasi rail">
      <a className="brand" href={nav.primary[0]?.href ?? '/'}>
        <span className="brand-mark" aria-hidden="true">
          K
        </span>
        <span className="brand-name">KaryawanKu</span>
      </a>

      <nav className="rail-nav" aria-label="Navigasi utama">
        <p className="rail-group" id={primaryGroup}>
          Operasional
        </p>
        <div role="group" aria-labelledby={primaryGroup}>
          {nav.primary.map((item) => (
            <NavLink key={item.key} item={item} active={item.key === activeNav} />
          ))}
        </div>

        {nav.secondary.length > 0 && (
          <>
            <p className="rail-group" id={secondaryGroup}>
              Akun
            </p>
            <div role="group" aria-labelledby={secondaryGroup}>
              {nav.secondary.map((item) => (
                <NavLink key={item.key} item={item} active={item.key === activeNav} />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="rail-foot">
        <button type="button" className="org">
          <Avatar name={nav.org.name} size="sm" alt="" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="t-label block truncate">{nav.org.name}</span>
            <span className="t-caption block truncate">{nav.org.meta}</span>
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
      </div>
    </aside>
  )
}

interface NavLinkProps {
  item: RoleNav['primary'][number]
  active: boolean
}

function NavLink({ item, active }: NavLinkProps) {
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('nav-item', active && 'font-semibold')}
    >
      <Icon name={item.icon} size={20} />
      <span className="label">{item.label}</span>
      {item.badge != null && (
        <span className="nav-badge" aria-label={`${item.badge} menunggu`}>
          {item.badge}
        </span>
      )}
    </a>
  )
}