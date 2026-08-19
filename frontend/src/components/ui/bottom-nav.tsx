import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import type { NavItem } from '@/components/ui/nav-rail'

export interface BottomNavProps extends HTMLAttributes<HTMLElement> {
  items: NavItem[]
}

export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(
  ({ items, className, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Navigasi utama"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 md:hidden',
        'flex justify-around px-2 py-2',
        'bg-surface-container-high border-t border-outline-variant',
        // Keeps the row clear of the iOS home indicator.
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
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
            'flex flex-col items-center gap-1 px-3 py-1.5 rounded-full text-xs',
            'transition-colors duration-m3-short ease-m3-standard',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            active ? 'text-primary bg-primary/10' : 'text-muted-foreground',
          )}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </a>
      ))}
    </nav>
  ),
)

BottomNav.displayName = 'BottomNav'
