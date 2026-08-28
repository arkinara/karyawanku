import { forwardRef } from 'react'
import type { ComponentType, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * Structural type so any Lucide icon fits without this file depending on
 * `lucide-react` at the type level.
 */
export type StatusIcon = ComponentType<{ className?: string }>

export interface StatusChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant: StatusVariant
  /** Bahasa Indonesia — use the `STATUS_LABEL` constants below. */
  label: string
  icon?: StatusIcon
}

const variants: Record<StatusVariant, string> = {
  success: 'bg-success-container text-success-on',
  warning: 'bg-warning-container text-warning-on',
  danger: 'bg-danger-container text-danger-on',
  info: 'bg-info-container text-info-on',
  neutral: 'bg-surface-3 text-onsurface',
}

/** Canonical Bahasa Indonesia status wording — never inline these strings. */
export const STATUS_LABEL = {
  HADIR: 'Hadir',
  TELAT: 'Telat',
  ABSEN: 'Absen',
  IZIN: 'Izin',
  CUTI: 'Cuti',
  DISETUJUI: 'Disetujui',
  MENUNGGU: 'Menunggu',
  DITOLAK: 'Ditolak',
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
  LUNAS: 'Lunas',
  DRAFT: 'Draft',
  DIPROSES: 'Diproses',
} as const

export type StatusKey = keyof typeof STATUS_LABEL

/** Default color role per status, so callers stay consistent across screens. */
export const STATUS_VARIANT: Record<StatusKey, StatusVariant> = {
  HADIR: 'success',
  TELAT: 'warning',
  ABSEN: 'danger',
  IZIN: 'info',
  CUTI: 'info',
  DISETUJUI: 'success',
  MENUNGGU: 'warning',
  DITOLAK: 'danger',
  AKTIF: 'success',
  NONAKTIF: 'neutral',
  LUNAS: 'success',
  DRAFT: 'neutral',
  DIPROSES: 'info',
}

export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ variant, label, icon: Icon, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  ),
)

StatusChip.displayName = 'StatusChip'
