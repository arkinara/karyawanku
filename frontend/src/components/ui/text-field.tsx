'use client'

import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'> {
  label: string
  /** Hint shown below the input. Replaced by `error` when the field is invalid. */
  helperText?: string
  /** Non-empty string puts the field into its error state. */
  error?: string
  required?: boolean
  id: string
  value: string
  onChange: InputHTMLAttributes<HTMLInputElement>['onChange']
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      error,
      required = false,
      id,
      type = 'text',
      value,
      onChange,
      placeholder,
      className,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error)
    const messageId = `${id}-message`
    const message = error ?? helperText

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={id}
          className={cn(
            'text-label-lg text-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            'w-full min-h-touch px-4 py-3 rounded-xl',
            'bg-surface-container-high border border-border text-foreground',
            'placeholder:text-muted-foreground outline-none transition-colors',
            'focus:border-primary focus:ring-1 focus:ring-primary',
            hasError && 'border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive',
            disabled && 'opacity-50 cursor-not-allowed bg-surface-container-low',
          )}
          {...props}
        />

        {message && (
          <p
            id={messageId}
            className={cn(
              'text-body-sm',
              hasError ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        )}
      </div>
    )
  },
)

TextField.displayName = 'TextField'
