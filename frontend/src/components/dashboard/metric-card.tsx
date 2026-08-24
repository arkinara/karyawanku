import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type MetricTrend = 'up' | 'down' | 'flat'

export interface MetricDelta {
  /** Bahasa Indonesia — e.g. "+12%", "4 poin vs rata-rata". */
  value: string
  trend: MetricTrend
}

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Bahasa Indonesia — e.g. "Total Karyawan". */
  label: string
  value: string | number
  /** Lucide icon rendered in the trailing tile. */
  icon?: LucideIcon
  delta?: MetricDelta
  /** Small helper text under the value — e.g. "11 aktif · 1 nonaktif". */
  caption?: string
  /** Inline unit next to the value — e.g. "/12", "jt". */
  unit?: string
}

/** Trend owns the delta color only; the value stays neutral so it reads first. */
const trendColors: Record<MetricTrend, string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-onsurface-variant',
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, icon: Icon, delta, caption, unit, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-outline-variant bg-surface p-5 shadow-e1',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-onsurface-variant">{label}</p>

        {Icon && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary-oncontainer"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p className="mt-2 text-[27px] font-bold leading-[1.1] tracking-tight tabular-nums text-onsurface">
        {value}
        {unit && <span className="text-[15px] font-medium text-onsurface-variant">{unit}</span>}
      </p>

      {(caption || delta) && (
        <p className="mt-1 text-xs text-onsurface-variant">
          {caption}
          {delta && (
            <span className={cn('ml-1 font-semibold', trendColors[delta.trend])}>
              {delta.value}
            </span>
          )}
        </p>
      )}
    </div>
  ),
)

MetricCard.displayName = 'MetricCard'
