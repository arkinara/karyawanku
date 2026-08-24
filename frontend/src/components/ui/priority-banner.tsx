import { forwardRef } from 'react'
import type { HTMLAttributes, MouseEventHandler } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export type BannerVariant = 'warning' | 'info' | 'danger'

export interface BannerAction {
  /** Bahasa Indonesia label — e.g. "Tinjau". */
  label: string
  href?: string
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>
}

export interface PriorityBannerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: BannerVariant
  /** Bahasa Indonesia title — e.g. "2 pengajuan cuti menunggu keputusan Anda". */
  title: string
  description?: string
  /** Lucide icon shown in the leading tile. */
  icon?: LucideIcon
  action?: BannerAction
}

/**
 * Variants own the accent border + container tint + the icon tile colour.
 * `danger-container`/`warning-container`/`info-container` are ProMax tokens.
 */
const variantStyles: Record<BannerVariant, string> = {
  warning: 'bg-warning-container text-warning-on border-l-warning',
  info: 'bg-info-container text-info-on border-l-info',
  danger: 'bg-danger-container text-danger-on border-l-danger',
}

export const PriorityBanner = forwardRef<HTMLDivElement, PriorityBannerProps>(
  ({ variant = 'warning', title, description, icon: Icon, action, className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-outline-variant border-l-4 p-4',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface/60 text-current"
        >
          <Icon className="h-5 w-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs opacity-80">{description}</p>
        )}
      </div>

      {action &&
        (action.href ? (
          <a
            href={action.href}
            onClick={action.onClick as MouseEventHandler<HTMLAnchorElement>}
            className="shrink-0 self-center"
          >
            <Button variant="tonal" size="sm">
              {action.label}
            </Button>
          </a>
        ) : (
          <Button
            variant="tonal"
            size="sm"
            className="shrink-0 self-center"
            onClick={action.onClick as MouseEventHandler<HTMLButtonElement>}
          >
            {action.label}
          </Button>
        ))}
    </div>
  ),
)

PriorityBanner.displayName = 'PriorityBanner'
