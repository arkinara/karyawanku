'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/** PostMessage payload key shared with the prototype viewer (kk.js:98-101). */
const THEME_MSG = 'kk-theme'

/**
 * Keeps <html> in sync with the resolved theme post-hydration (the pre-paint
 * script already covered first paint; this covers toggles), and broadcasts the
 * change to the parent and every child iframe so the prototype viewer and any
 * same-origin frames stay in sync (kk.js setTheme, lines 94-102).
 */
export function ThemeSync() {
  const { resolvedTheme, setTheme } = useTheme()

  // Apply to <html> + broadcast to parent and child iframes.
  useEffect(() => {
    if (!resolvedTheme) return
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
    try {
      window.parent.postMessage({ [THEME_MSG]: resolvedTheme }, '*')
    } catch {
      /* parent access blocked (e.g. not embedded) — ignore */
    }
    document.querySelectorAll('iframe').forEach((f) => {
      try {
        f.contentWindow?.postMessage({ [THEME_MSG]: resolvedTheme }, '*')
      } catch {
        /* cross-origin frame — ignore */
      }
    })
  }, [resolvedTheme])

  // Receive theme messages from the parent or a peer iframe and apply.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as Record<string, unknown> | null
      if (d && (d[THEME_MSG] === 'dark' || d[THEME_MSG] === 'light')) {
        setTheme(d[THEME_MSG] as 'dark' | 'light')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setTheme])

  return null
}