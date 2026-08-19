'use client'

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Calendar, Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/cn'

export type QuickActionKey = 'clock' | 'cuti' | 'slip'

export interface QuickActionsProps extends HTMLAttributes<HTMLDivElement> {
  /** Flips the first tile between "Clock In" and "Clock Out". */
  checkedIn?: boolean
  onAction?: (key: QuickActionKey) => void
}

interface Action {
  key: QuickActionKey
  label: string
  icon: LucideIcon
  /** The clock tile is the primary call to action; the rest stay tonal. */
  tone: string
}

const actions: Action[] = [
  { key: 'clock', label: 'Clock In', icon: Clock, tone: 'bg-primary-container text-on-primary-container' },
  { key: 'cuti', label: 'Ajukan Cuti', icon: Calendar, tone: 'bg-surface-container text-foreground' },
  { key: 'slip', label: 'Lihat Slip Gaji', icon: FileText, tone: 'bg-surface-container text-foreground' },
]

export const QuickActions = forwardRef<HTMLDivElement, QuickActionsProps>(
  ({ checkedIn = false, onAction, className, ...props }, ref) => (
    <div ref={ref} className={cn('grid grid-cols-3 gap-3', className)} {...props}>
      {actions.map(({ key, label, icon: Icon, tone }) => (
        <button
          key={key}
          type="button"
          onClick={() => onAction?.(key)}
          className={cn(
            'flex min-h-touch flex-col items-center justify-center gap-2 rounded-2xl p-4',
            'text-sm font-medium text-center',
            'transition-all duration-m3-short ease-m3-standard',
            'hover:opacity-90 active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            tone,
          )}
        >
          <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span>{key === 'clock' && checkedIn ? 'Clock Out' : label}</span>
        </button>
      ))}
    </div>
  ),
)

QuickActions.displayName = 'QuickActions'
