'use client'

import { forwardRef, useEffect, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string
  alt?: string
  /** Required — drives the initials fallback and the image alt text. */
  name: string
  size?: AvatarSize
  online?: boolean
}

/** Mirrors ProMax `.avatar` / `.avatar-sm` / `.avatar-lg` dimensions. */
const sizes: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-[11.5px]',
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-[52px] h-[52px] text-[17px]',
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, alt, name, size = 'md', online = false, className, ...props }, ref) => {
    const [failed, setFailed] = useState(false)

    // A new src deserves a fresh attempt, even if the previous one 404'd.
    useEffect(() => {
      setFailed(false)
    }, [src])

    const showImage = Boolean(src) && !failed

    return (
      <span
        ref={ref}
        className={cn('relative inline-flex shrink-0 rounded-full', sizes[size], className)}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name}
            onError={() => setFailed(true)}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span
            aria-label={alt ?? name}
            role="img"
            className="grid w-full h-full place-items-center rounded-full bg-primary-container text-on-primary-container font-semibold tracking-[0.01em]"
          >
            {initials(name)}
          </span>
        )}

        {online && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface"
          />
        )}
      </span>
    )
  },
)

Avatar.displayName = 'Avatar'