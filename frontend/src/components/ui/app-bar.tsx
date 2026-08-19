import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AppBarProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: string
  /** Right-side slot. Takes priority over `avatar`. */
  action?: ReactNode
  /** Right-side fallback — usually an `<Avatar>`; only shown when `action` is absent. */
  avatar?: ReactNode
  /** Supplying a handler renders the left back button. */
  back?: () => void
  sticky?: boolean
}

export const AppBar = forwardRef<HTMLElement, AppBarProps>(
  ({ title, action, avatar, back, sticky = true, className, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        'z-20 h-16 px-4 sm:px-6',
        'flex items-center justify-between gap-3',
        'bg-surface-container-high border-b border-outline-variant',
        sticky && 'sticky top-0',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <button
            type="button"
            onClick={back}
            aria-label="Kembali"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'text-foreground hover:bg-surface-container-highest',
              'transition-colors duration-m3-short ease-m3-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {title && <h1 className="truncate text-title-lg text-foreground">{title}</h1>}

        {children}
      </div>

      {(action ?? avatar) && (
        <div className="flex shrink-0 items-center gap-2">{action ?? avatar}</div>
      )}
    </header>
  ),
)

AppBar.displayName = 'AppBar'
