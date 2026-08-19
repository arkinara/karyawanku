import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type MetricTrend = 'up' | 'down' | 'flat'

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Bahasa Indonesia — e.g. "Total Karyawan". */
  label: string
  value: string | number
  /** Change versus the previous period — e.g. "+12%". */
  delta?: string
  icon?: LucideIcon
  trend?: MetricTrend
}

/** Trend owns the delta color only; the value stays neutral so it reads first. */
const trendColors: Record<MetricTrend, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-muted-foreground',
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, delta, icon: Icon, trend = 'flat', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-card text-card-foreground border border-border/40 rounded-2xl p-5', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>

        {Icon && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="mt-2 text-3xl font-bold leading-tight text-foreground">{value}</p>

      {delta && <p className={cn('mt-1 text-xs font-medium', trendColors[trend])}>{delta}</p>}
    </div>
  ),
)

MetricCard.displayName = 'MetricCard'
