'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, WifiOff, X } from 'lucide-react'
import { ApiError, errorMessage, onApiError } from '@/lib/api-client'
import { cn } from '@/lib/cn'

/**
 * KaryawanKu — global API error toast (Wiring, ticket #34).
 *
 * Listens to the `api-client` error bus and surfaces a Bahasa message at the
 * top of the viewport for any failed request, auto-dismissing after 4s.
 * Network failures (status 0) get a distinct "Tidak terhubung ke server" tone.
 */

interface ToastItem {
  id: number
  message: string
  tone: 'danger' | 'warning' | 'info'
}

const AUTO_DISMISS_MS = 4000

function toneFor(error: ApiError): ToastItem['tone'] {
  if (error.status === 0) return 'warning'
  if (error.status >= 500) return 'danger'
  return 'info'
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return onApiError((error) => {
      const id = nextId++
      const item: ToastItem = { id, message: errorMessage(error), tone: toneFor(error) }
      setToasts((prev) => [...prev.slice(-2), item])
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      timers.current.set(id, timer)
    })
  }, [])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
      timers.current.clear()
    }
  }, [])

  if (toasts.length === 0) return <>{children}</>

  return (
    <>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-toast flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-e4',
              toast.tone === 'danger' && 'border-danger/30 bg-danger-container text-danger',
              toast.tone === 'warning' && 'border-warning/30 bg-warning-container text-warning',
              toast.tone === 'info' && 'border-info/30 bg-surface-1 text-onsurface',
            )}
          >
            {toast.tone === 'warning' ? (
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : toast.tone === 'danger' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => dismiss(toast.id)}
              className="rounded-full p-1 text-current/70 transition-colors hover:bg-black/5"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
