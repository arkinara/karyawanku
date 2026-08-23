'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Keeps <html> in sync with the resolved theme post-hydration:
 * `.dark` class + `color-scheme` (the pre-paint script already covered first
 * paint; this covers toggles). The full theme hook lands in ticket #40.
 */
export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme ?? 'light'
  }, [resolvedTheme])

  return null
}