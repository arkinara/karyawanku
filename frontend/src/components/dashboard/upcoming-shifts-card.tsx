import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { CalendarX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatJam, formatTanggal } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'

export type ShiftLabel = 'Pagi' | 'Siang' | 'Malam' | 'Libur'

export interface UpcomingShift {
  id: string
  nama: string
  avatarUrl?: string
  label: ShiftLabel
  /** Omit both times for a `Libur` row. */
  mulai?: Date | string
  selesai?: Date | string
  tanggal: Date | string
}

export interface UpcomingShiftsCardProps extends HTMLAttributes<HTMLDivElement> {
  shifts?: UpcomingShift[]
  title?: string
}

/** The card covers the next 3 days, one row per day. */
const MAX_VISIBLE = 3

const shiftTones: Record<ShiftLabel, string> = {
  Pagi: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Siang: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Malam: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Libur: 'bg-surface-container-high text-on-surface-variant',
}

const sampleShifts: UpcomingShift[] = [
  {
    id: '1',
    nama: 'Budi Santoso',
    label: 'Pagi',
    mulai: '2026-08-20T07:00:00',
    selesai: '2026-08-20T15:00:00',
    tanggal: '2026-08-20',
  },
  {
    id: '2',
    nama: 'Siti Nurhaliza',
    label: 'Siang',
    mulai: '2026-08-21T15:00:00',
    selesai: '2026-08-21T23:00:00',
    tanggal: '2026-08-21',
  },
  { id: '3', nama: 'Agus Wijaya', label: 'Libur', tanggal: '2026-08-22' },
]

export const UpcomingShiftsCard = forwardRef<HTMLDivElement, UpcomingShiftsCardProps>(
  ({ shifts = sampleShifts, title = 'Shift Mendatang', className, ...props }, ref) => {
    const visible = shifts.slice(0, MAX_VISIBLE)

    return (
      <div
        ref={ref}
        className={cn('bg-card text-card-foreground border border-border/40 rounded-2xl p-5', className)}
        {...props}
      >
        <h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>

        {visible.length === 0 ? (
          <EmptyState icon={CalendarX} title="Tidak ada shift terjadwal" className="py-8" />
        ) : (
          <ul className="mt-2 divide-y divide-border/40">
            {visible.map(({ id, nama, avatarUrl, label, mulai, selesai, tanggal }) => (
              <li key={id} className="flex items-center gap-3 py-3">
                <Avatar name={nama} src={avatarUrl} size="md" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{nama}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {mulai && selesai ? `${formatJam(mulai)} – ${formatJam(selesai)}` : 'Tanpa jam kerja'}
                    {' · '}
                    {formatTanggal(tanggal)}
                  </p>
                </div>

                <span
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                    shiftTones[label],
                  )}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  },
)

UpcomingShiftsCard.displayName = 'UpcomingShiftsCard'
