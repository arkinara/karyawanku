'use client'

import { forwardRef, useEffect, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string
  alt?: string
  /** Required — drives the initials fallback and the image alt text. */
  name: string
  size?: AvatarSize
  online?: boolean
}

const sizes: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
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
        className={cn('relative inline-flex shrink-0', sizes[size], className)}
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
            className="w-full h-full rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center"
          >
            {initials(name)}
          </span>
        )}

        {online && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
          />
        )}
      </span>
    )
  },
)

Avatar.displayName = 'Avatar'
