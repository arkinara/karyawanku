'use client'

import { forwardRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatJam } from '@/lib/format'

export interface AttendanceEvent {
  /** Bahasa Indonesia — e.g. "Masuk", "Istirahat", "Pulang". */
  label: string
  /** `null` while the event has not happened yet. */
  waktu?: Date | string | null
}

export interface CheckInWidgetProps extends HTMLAttributes<HTMLDivElement> {
  /** Initial check-in time; `null` means the employee has not clocked in. */
  checkedInAt?: Date | string | null
  loading?: boolean
  timeline?: AttendanceEvent[]
  onClockIn?: (waktu: Date) => void
  onClockOut?: (waktu: Date) => void
}

const sampleTimeline: AttendanceEvent[] = [
  { label: 'Masuk', waktu: '2026-08-19T08:02:00' },
  { label: 'Istirahat', waktu: '2026-08-19T12:00:00' },
  { label: 'Kembali', waktu: '2026-08-19T13:00:00' },
  { label: 'Pulang', waktu: null },
]

export const CheckInWidget = forwardRef<HTMLDivElement, CheckInWidgetProps>(
  (
    { checkedInAt = null, loading = false, timeline = sampleTimeline, onClockIn, onClockOut, className, ...props },
    ref,
  ) => {
    // Held locally so the widget stays usable before the mutation round-trips.
    const [activeSince, setActiveSince] = useState<Date | string | null>(checkedInAt)
    const checkedIn = activeSince !== null

    function toggle() {
      const now = new Date()
      if (checkedIn) {
        setActiveSince(null)
        onClockOut?.(now)
      } else {
        setActiveSince(now)
        onClockIn?.(now)
      }
    }

    return (
      <div
        ref={ref}
        className={cn('bg-card text-card-foreground border border-border/40 rounded-2xl p-5', className)}
        {...props}
      >
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-6',
            'text-title-lg font-semibold',
            'transition-all duration-m3-short ease-m3-standard',
            'hover:opacity-90 active:scale-[0.99]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
            checkedIn
              ? 'bg-error-container text-on-error-container'
              : 'bg-primary text-on-primary shadow-elevation-2',
          )}
        >
          <Clock className="h-6 w-6 shrink-0" aria-hidden="true" />
          {checkedIn ? 'Clock Out' : 'Clock In'}
        </button>

        {checkedIn && activeSince && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Anda check-in sejak {formatJam(activeSince)}
          </p>
        )}

        <div className="mt-5 border-t border-border/40 pt-4">
          <h3 className="text-sm font-medium text-muted-foreground">Absensi Hari Ini</h3>

          {loading ? (
            <ul className="mt-3 space-y-3" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-container-highest animate-skeleton-pulse" />
                  <span className="h-3 w-24 rounded-full bg-surface-container-highest animate-skeleton-pulse" />
                  <span className="ml-auto h-3 w-10 rounded-full bg-surface-container-highest animate-skeleton-pulse" />
                </li>
              ))}
            </ul>
          ) : (
            <ol className="mt-3 space-y-3">
              {timeline.map(({ label, waktu }) => (
                <li key={label} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      waktu ? 'bg-primary' : 'bg-outline-variant',
                    )}
                  />
                  <span
                    className={cn('text-sm', waktu ? 'text-foreground' : 'text-muted-foreground')}
                  >
                    {label}
                  </span>
                  <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                    {waktu ? formatJam(waktu) : '--:--'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    )
  },
)

CheckInWidget.displayName = 'CheckInWidget'
