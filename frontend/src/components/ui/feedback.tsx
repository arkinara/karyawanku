'use client'

import { type ReactNode } from 'react'
import { ApiError } from '@/lib/api-client'
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Lightweight inline loading skeleton (M3 surface).
 * Renders 1–3 stacked rounded rectangles with shimmer-free pulse.
 */
export function SkeletonBlock({
  className = 'h-4 w-full',
  count = 1,
}: {
  className?: string
  count?: number
}) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${className} animate-pulse rounded-md bg-surface-3`}
        />
      ))}
    </div>
  )
}

export function LoadingSurface({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface shadow-e1 p-6">
      <SkeletonBlock count={3} />
      <p className="t-caption mt-3">{label}</p>
    </div>
  )
}

export function ErrorSurface({
  error,
  onRetry,
}: {
  error: Error | ApiError
  onRetry?: () => void
}) {
  const status = error instanceof ApiError ? error.status : 0
  return (
    <div
      role="alert"
      className="rounded-2xl border border-outline-variant bg-danger-container/40 p-5 flex items-start gap-3"
    >
      <AlertTriangle className="mt-0.5 text-danger" size={20} aria-hidden />
      <div className="flex-1">
        <p className="t-body font-medium text-danger">
          {status === 401 ? 'Sesi berakhir, silakan masuk ulang.' : 'Terjadi kesalahan'}
        </p>
        <p className="t-caption mt-1 text-on-surface-variant">{error.message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw size={16} aria-hidden />
          Coba lagi
        </Button>
      )}
    </div>
  )
}

export function EmptyView({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-2 p-8 text-center flex flex-col items-center gap-2">
      <Inbox className="text-on-surface-variant" size={32} aria-hidden />
      <p className="t-h3">{title}</p>
      {description && <p className="t-caption max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}