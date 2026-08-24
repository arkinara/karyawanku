'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface StepItem {
  /** Bahasa Indonesia label shown next to the dot (hidden on mobile). */
  name: string
  /** Stable identifier, used as React key. */
  key: string
}

export interface StepperProps {
  steps: StepItem[]
  /** Zero-based index of the active step. */
  currentStep: number
  className?: string
}

/**
 * Horizontal step indicator — port of the ProMax onboarding wizard pattern
 * (`01-onboarding-wizard.html`): numbered dots joined by connector lines.
 * Current = primary dot with ring, done = success-container, pending = surface-3.
 * Dot 1 is `aria-current="step"`, completed dots swap their number for a check.
 */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)} aria-label="Kemajuan setup">
      {steps.map((step, index) => {
        const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'pending'
        return (
          <li
            key={step.key}
            data-state={state}
            className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
          >
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full',
                'text-[13px] font-bold transition-colors duration-base',
                state === 'current' &&
                  'bg-primary text-primary-on ring-4 ring-primary/20',
                state === 'done' && 'bg-success-container text-success-on',
                state === 'pending' && 'bg-surface-3 text-onsurface-variant',
              )}
            >
              {state === 'done' ? (
                <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                'hidden whitespace-nowrap text-[13.5px] font-medium sm:inline',
                state === 'current' || state === 'done'
                  ? 'text-onsurface'
                  : 'text-onsurface-variant',
              )}
            >
              {step.name}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 min-w-3 flex-1 rounded-full',
                  state === 'done' ? 'bg-success' : 'bg-outline-variant',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
