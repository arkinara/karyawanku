'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tonal'
  | 'text'
  | 'danger'
  | 'icon'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * Shared across every variant: M3 pill shape, the one focus treatment, and the
 * pressed/disabled state layers. Variants only own color.
 */
const base = cn(
  'inline-flex items-center justify-center gap-2 rounded-full',
  'font-medium text-label-lg whitespace-nowrap select-none',
  'transition-all duration-m3-short ease-m3-standard',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'active:scale-[0.98]',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100',
)

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-elevation-1 hover:opacity-90 hover:shadow-elevation-2',
  secondary: 'bg-secondary text-on-secondary hover:opacity-90',
  tonal: 'bg-secondary-container text-on-secondary-container hover:bg-surface-container-high',
  text: 'bg-transparent text-primary hover:bg-primary/10',
  danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
  icon: 'bg-surface-container text-foreground hover:bg-surface-container-high',
}

/** Label buttons get horizontal padding; the icon variant stays square. */
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3',
  md: 'h-11 px-5',
  lg: 'h-14 px-6',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 p-0',
  md: 'h-11 w-11 p-0',
  lg: 'h-14 w-14 p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        variants[variant],
        variant === 'icon' ? iconSizes[size] : sizes[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
