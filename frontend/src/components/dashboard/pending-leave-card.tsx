'use client'

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatTanggal } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export interface PendingLeave {
  id: string
  nama: string
  avatarUrl?: string
  /** Leave type in Bahasa — e.g. "Cuti Tahunan", "Izin Sakit". */
  jenis: string
  mulai: Date | string
  selesai: Date | string
}

export interface PendingLeaveCardProps extends HTMLAttributes<HTMLDivElement> {
  requests?: PendingLeave[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  /** Wired to "Lihat semua"; the link only appears when rows overflow. */
  onViewAll?: () => void
}

/** Rows beyond this stay behind "Lihat semua" so the card keeps its height. */
const MAX_VISIBLE = 5

const sampleRequests: PendingLeave[] = [
  { id: '1', nama: 'Budi Santoso', jenis: 'Cuti Tahunan', mulai: '2026-08-24', selesai: '2026-08-26' },
  { id: '2', nama: 'Siti Nurhaliza', jenis: 'Izin Sakit', mulai: '2026-08-20', selesai: '2026-08-20' },
  { id: '3', nama: 'Agus Wijaya', jenis: 'Cuti Melahirkan', mulai: '2026-09-01', selesai: '2026-11-24' },
  { id: '4', nama: 'Dewi Lestari', jenis: 'Cuti Tahunan', mulai: '2026-08-28', selesai: '2026-08-29' },
]

export const PendingLeaveCard = forwardRef<HTMLDivElement, PendingLeaveCardProps>(
  ({ requests = sampleRequests, onApprove, onReject, onViewAll, className, ...props }, ref) => {
    const visible = requests.slice(0, MAX_VISIBLE)
    const hasOverflow = requests.length > MAX_VISIBLE

    return (
      <div
        ref={ref}
        className={cn('bg-card text-card-foreground border border-border/40 rounded-2xl p-5', className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            Cuti Menunggu Persetujuan
          </h3>

          {hasOverflow && (
            <button
              type="button"
              onClick={onViewAll}
              className={cn(
                'shrink-0 rounded-full px-2 py-1 text-sm font-medium text-primary',
                'transition-colors duration-m3-short ease-m3-standard hover:bg-primary/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
            >
              Lihat semua
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Tidak ada cuti pending" className="py-8" />
        ) : (
          <ul className="mt-2 divide-y divide-border/40">
            {visible.map(({ id, nama, avatarUrl, jenis, mulai, selesai }) => (
              <li key={id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={nama} src={avatarUrl} size="md" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{nama}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {jenis} · {formatTanggal(mulai)} – {formatTanggal(selesai)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => onApprove?.(id)}>
                    Setujui
                  </Button>
                  <Button size="sm" variant="text" onClick={() => onReject?.(id)}>
                    Tolak
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  },
)

PendingLeaveCard.displayName = 'PendingLeaveCard'
