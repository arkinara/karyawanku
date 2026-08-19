import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface NavItem {
  /** Bahasa Indonesia — e.g. "Absensi", "Penggajian". */
  label: string
  icon: LucideIcon
  href: string
  active?: boolean
}

export interface NavRailProps extends HTMLAttributes<HTMLElement> {
  items: NavItem[]
}

export const NavRail = forwardRef<HTMLElement, NavRailProps>(
  ({ items, className, children, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Navigasi utama"
      className={cn(
        'hidden md:flex flex-col w-60 gap-1 p-4',
        'bg-surface-container border-r border-outline-variant',
        className,
      )}
      {...props}
    >
      {items.map(({ label, icon: Icon, href, active = false }) => (
        <a
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium',
            'transition-colors duration-m3-short ease-m3-standard',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            active
              ? 'bg-secondary-container text-on-secondary-container'
              : 'text-foreground hover:bg-surface-container-high',
          )}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </a>
      ))}

      {children}
    </nav>
  ),
)

NavRail.displayName = 'NavRail'
