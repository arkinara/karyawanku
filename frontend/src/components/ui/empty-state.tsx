import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Bahasa Indonesia — e.g. "Belum ada data absensi". */
  title: string
  description?: string
  /** Usually a `<Button>`; rendered below the copy. */
  action?: ReactNode
  icon?: LucideIcon
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, action, icon: Icon, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-6 py-12 gap-3',
        className,
      )}
      {...props}
    >
      {Icon && (
        // Illustration slot: a tonal circle keeps the icon from floating alone.
        <span
          aria-hidden="true"
          className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
        >
          <Icon className="h-7 w-7" />
        </span>
      )}

      <h3 className="text-title-md text-foreground">{title}</h3>

      {description && (
        <p className="max-w-sm text-body-md text-muted-foreground">{description}</p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  ),
)

EmptyState.displayName = 'EmptyState'
