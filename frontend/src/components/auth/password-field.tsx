'use client'

import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui/icon'

export interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  error?: string
  helperText?: string
  /** Optional element rendered at the right of the label row (e.g. "Lupa password?"). */
  labelAction?: ReactNode
  /** Render a weak/medium/strong strength meter below the field (sign-up only). */
  showStrength?: boolean
}

interface Strength {
  score: number
  label: string
  color: string
}

function strengthOf(pw: string): Strength {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score += 1
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score += 1
  if (pw.length >= 12) score += 1
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1
  return {
    score,
    label: score <= 1 ? 'Lemah' : score <= 3 ? 'Sedang' : 'Kuat',
    color: score <= 1 ? 'bg-danger' : score <= 3 ? 'bg-warning' : 'bg-success',
  }
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  required,
  error,
  helperText,
  labelAction,
  showStrength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const hasError = Boolean(error)
  const messageId = `${id}-message`
  const strengthId = `${id}-strength`
  const message = error ?? helperText
  const strength = showStrength ? strengthOf(value) : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="t-label text-onsurface">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={
            message ? messageId : showStrength && value !== '' ? strengthId : undefined
          }
          className={cn(
            'w-full min-h-[44px] rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 pr-12',
            'text-onsurface outline-none transition-colors',
            'placeholder:text-onsurface-variant',
            'focus:border-primary focus:ring-1 focus:ring-primary',
            hasError && 'border-danger bg-danger/5 focus:border-danger focus:ring-danger',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={`${visible ? 'Sembunyikan' : 'Tampilkan'} kata sandi`}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-onsurface-variant transition-colors hover:bg-surface-3 hover:text-onsurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>

      {showStrength && strength && value !== '' && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i < strength.score ? strength.color : 'bg-surface-3',
                )}
              />
            ))}
          </div>
          <span id={strengthId} className="t-caption w-14 text-right">
            {strength.label}
          </span>
        </div>
      )}

      {message && (
        <p
          id={messageId}
          className={cn('text-body-sm', hasError ? 'text-danger' : 'text-onsurface-variant')}
        >
          {message}
        </p>
      )}
    </div>
  )
}
