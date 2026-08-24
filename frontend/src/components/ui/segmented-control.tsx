'use client'

import { forwardRef, useRef } from 'react'
import type { HTMLAttributes, KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption {
  value: string
  /** Bahasa Indonesia label shown on the segment. */
  label: string
  /** Optional count rendered as a small chip after the label. */
  count?: number
}

export interface SegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
}

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ options, value, onChange, className, ...props }, ref) => {
    const listRef = useRef<HTMLDivElement>(null)

    const focusIndex = (index: number) => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      if (!buttons || buttons.length === 0) return
      const next = (index + buttons.length) % buttons.length
      buttons[next]?.focus()
      onChange(options[next].value)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const buttons = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
      )
      const current = buttons.findIndex((b) => b === document.activeElement)
      if (current === -1) return

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          focusIndex(current + 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          focusIndex(current - 1)
          break
      }
    }

    return (
      <div
        ref={(node) => {
          listRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        role="tablist"
        aria-label="Filter"
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface p-1 shadow-e1',
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
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-fast ease-standard',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active
                  ? 'bg-primary text-primary-on'
                  : 'text-onsurface-variant hover:bg-surface-2 hover:text-onsurface',
              )}
            >
              {option.label}
              {typeof option.count === 'number' && (
                <span className="tabular-nums text-xs opacity-70">{option.count}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  },
)

SegmentedControl.displayName = 'SegmentedControl'
