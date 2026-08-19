'use client'

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption {
  value: string
  /** Bahasa Indonesia label shown on the segment. */
  label: string
}

export interface SegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
}

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ options, value, onChange, className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-surface-container-low p-1',
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-4 py-2 text-label-lg whitespace-nowrap',
              'transition-colors duration-m3-short ease-m3-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active
                ? 'bg-primary text-on-primary'
                : 'text-muted-foreground hover:bg-surface-container',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  ),
)

SegmentedControl.displayName = 'SegmentedControl'
