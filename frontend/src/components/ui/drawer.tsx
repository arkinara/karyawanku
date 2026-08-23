'use client'

import { useEffect, useRef } from 'react'
import type { NavKey, RoleNav } from '@/lib/nav-config'
import { Icon } from '@/components/ui/icon'
import { Avatar } from '@/components/ui/avatar'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  nav: RoleNav
  activeNav: NavKey
}

/**
 * Mobile navigation drawer — slides in from the left above a scrim
 * (`.drawer` / `.scrim`, z-index 40 per spec). Shows the FULL nav list
 * (primary + secondary), so secondary items like "Pengaturan" that the bottom
 * nav skips are reachable here. Hidden entirely at ≥1024px.
 */
export function Drawer({ open, onClose, nav, activeNav }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <>
      <div
        className="scrim"
        data-open={open ? 'true' : undefined}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="kk-drawer"
        className="drawer"
        data-open={open ? 'true' : undefined}
        aria-label="Menu navigasi"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="drawer-head">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span className="brand-name flex-1">KaryawanKu</span>
          <button
            type="button"
            ref={closeRef}
            className="appbar-action"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="rail-nav" aria-label="Navigasi utama (mobile)">
          {nav.primary.concat(nav.secondary).map((item) => (
            <a
              key={item.key}
              href={item.href}
              aria-current={item.key === activeNav ? 'page' : undefined}
              className="nav-item"
            >
              <Icon name={item.icon} size={20} />
              <span className="label">{item.label}</span>
              {item.badge != null && (
                <span className="nav-badge" aria-label={`${item.badge} menunggu`}>
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="org" style={{ cursor: 'default' }}>
            <Avatar name={nav.user.name} size="sm" alt="" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="t-label block truncate">{nav.user.name}</span>
              <span className="t-caption block truncate">
                {nav.user.role} · {nav.org.name}
              </span>
            </span>
          </div>
          <a className="nav-item" href="/masuk" style={{ color: 'hsl(var(--danger))' }}>
            <Icon name="logout" size={20} />
            <span className="label">Keluar</span>
          </a>
        </div>
      </aside>
    </>
  )
}