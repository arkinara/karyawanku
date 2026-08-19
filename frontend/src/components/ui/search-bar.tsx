'use client'

import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  /** Receives the raw query string, not the event. */
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, placeholder = 'Cari...', className, disabled, ...props }, ref) => (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />

      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full min-h-touch rounded-full py-3 pl-11 pr-11',
          'bg-surface-container-high border border-transparent text-foreground',
          'placeholder:text-muted-foreground outline-none',
          'transition-colors duration-m3-short ease-m3-standard',
          'focus:border-primary focus:bg-surface-container-highest',
          // The native search clear affordance duplicates our X button.
          '[&::-webkit-search-cancel-button]:appearance-none',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        {...props}
      />

      {value.length > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'flex h-7 w-7 items-center justify-center rounded-full',
            'text-muted-foreground hover:bg-surface-container-highest hover:text-foreground',
            'transition-colors duration-m3-short ease-m3-standard',
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  ),
)

SearchBar.displayName = 'SearchBar'
