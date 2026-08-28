'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { UserMeta } from '@/lib/nav-config'
import { Icon } from '@/components/ui/icon'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'

export interface AppBarProps {
  /** Page title, e.g. "Selamat pagi, Pak Darmawan". */
  title: string
  subtitle?: string
  /** Current user — drives the avatar button aria-label. */
  user: UserMeta
  /** Opens the mobile drawer (menu button is hidden on desktop). */
  onMenu?: () => void
  menuExpanded?: boolean
}

/**
 * Sticky top app bar — 60px tall, title + subtitle left, theme toggle +
 * notifications + user avatar right. The skip-link lives in AppShell BEFORE
 * this so it stays the first focusable element.
 */
export function AppBar({ title, subtitle, user, onMenu, menuExpanded = false }: AppBarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  const next = dark ? 'terang' : 'gelap'

  return (
    <header className="appbar">
      {onMenu && (
        <button
          type="button"
          className="appbar-action lg:hidden"
          onClick={onMenu}
          aria-label="Buka menu navigasi"
          aria-expanded={menuExpanded}
          aria-controls="kk-drawer"
        >
          <Icon name="menu" size={22} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="t-h3 truncate">{title}</p>
        {subtitle != null && <p className="t-caption truncate">{subtitle}</p>}
      </div>

      <button
        type="button"
        className="appbar-action"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={`Ganti ke tampilan ${next}`}
        title={`Tampilan ${next}`}
      >
        <Icon name={dark ? 'sun' : 'moon'} size={19} />
      </button>

      <button
        type="button"
        className="appbar-action"
        aria-label="Notifikasi, 3 belum dibaca"
        title="Notifikasi"
      >
        <Icon name="bell" size={20} />
        <span className="appbar-dot" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="appbar-action"
        aria-label={`Akun saya · ${user.name}`}
        title={`Akun saya · ${user.name}`}
      >
        <Avatar name={user.name} size="sm" alt="" aria-hidden="true" className={cn('bg-primary text-on-primary')} />
      </button>
    </header>
  )
}