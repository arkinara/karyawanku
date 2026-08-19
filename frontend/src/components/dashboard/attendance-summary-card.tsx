import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { STATUS_LABEL } from '@/components/ui/status-chip'

export interface AttendanceSummaryCardProps extends HTMLAttributes<HTMLDivElement> {
  hadir?: number
  telat?: number
  absen?: number
  izin?: number
  /** Override only when the card is not showing today. */
  title?: string
}

interface Tile {
  key: 'hadir' | 'telat' | 'absen' | 'izin'
  label: string
  /** Tonal tile: same color family as the matching `StatusChip` variant. */
  tone: string
}

const tiles: Tile[] = [
  {
    key: 'hadir',
    label: STATUS_LABEL.HADIR,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    key: 'telat',
    label: STATUS_LABEL.TELAT,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    key: 'absen',
    label: STATUS_LABEL.ABSEN,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  },
  {
    key: 'izin',
    label: STATUS_LABEL.IZIN,
    tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
]

export const AttendanceSummaryCard = forwardRef<HTMLDivElement, AttendanceSummaryCardProps>(
  (
    {
      hadir = 42,
      telat = 5,
      absen = 2,
      izin = 3,
      title = 'Kehadiran Hari Ini',
      className,
      ...props
    },
    ref,
  ) => {
    const counts = { hadir, telat, absen, izin }

    return (
      <div
        ref={ref}
        className={cn('bg-card text-card-foreground border border-border/40 rounded-2xl p-5', className)}
        {...props}
      >
        <h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {tiles.map(({ key, label, tone }) => (
            <div key={key} className={cn('rounded-xl px-4 py-3', tone)}>
              <p className="text-2xl font-bold leading-tight">{counts[key]}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
)

AttendanceSummaryCard.displayName = 'AttendanceSummaryCard'
