'use client'

import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  /** Action row pinned to the bottom — usually `<Button>`s. */
  footer?: ReactNode
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const id = useId()
  const contentRef = useRef<HTMLDivElement>(null)

  // Escape closes, and the page behind must not scroll while the dialog is up.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  // Move focus into the dialog so keyboard and screen-reader users land inside.
  useEffect(() => {
    if (open) contentRef.current?.focus()
  }, [open])

  if (!open) return null

  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />

      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[90%] max-w-md rounded-2xl p-6',
          'bg-surface-container-highest text-foreground shadow-elevation-3',
          'focus:outline-none',
          className,
        )}
      >
        <h2 id={titleId} className="text-title-lg">
          {title}
        </h2>

        {description && (
          <p id={descriptionId} className="mt-1.5 text-body-md text-muted-foreground">
            {description}
          </p>
        )}

        {children && <div className="mt-4">{children}</div>}

        {footer && <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </>
  )
}
