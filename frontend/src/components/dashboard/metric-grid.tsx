import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface MetricGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** 4-up on desktop, collapsing to 2 then 1 as the viewport narrows. */
export const MetricGrid = forwardRef<HTMLDivElement, MetricGridProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)

MetricGrid.displayName = 'MetricGrid'
