import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import { AppBar } from '@/components/ui/app-bar'
import { ThemeSync } from '@/components/ui/theme-sync'

const LAYOUT_PATH = join(process.cwd(), 'src/app/layout.tsx')

const THEME_KEY = 'kk-theme'

function renderAppBar() {
  return render(
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_KEY}
    >
      <AppBar
        title="Ringkasan"
        user={{ name: 'Pak Darmawan', role: 'Pemilik', mono: 'PD' }}
      />
    </ThemeProvider>,
  )
}

describe('Dark mode: layout wiring (ticket #40)', () => {
  it('ThemeProvider membungkus app di layout', () => {
    const src = readFileSync(LAYOUT_PATH, 'utf8')
    expect(src).toContain('<ThemeProvider')
    expect(src).toContain('attribute="class"')
    expect(src).toContain('defaultTheme="system"')
    expect(src).toContain('enableSystem')
    expect(src).toContain('storageKey="kk-theme"')
  })

  it('inline FOUC guard script ada di <head> layout, baca kk-theme + matchMedia + fallback light', () => {
    const src = readFileSync(LAYOUT_PATH, 'utf8')
    // The script element itself lives inside <head> so it runs before hydration.
    const head = src.slice(src.indexOf('<head>'), src.indexOf('</head>'))
    expect(head).toContain('<script')
    expect(head).toContain('__html: themeScript')
    // The pre-paint script string reads localStorage kk-theme, then matchMedia.
    expect(src).toContain("localStorage.getItem('kk-theme')")
    expect(src).toContain("matchMedia('(prefers-color-scheme: dark)')")
    // Sets .dark + color-scheme on documentElement (html), not body.
    expect(src).toContain('document.documentElement')
    expect(src).toContain("classList.toggle('dark'")
    expect(src).toContain('colorScheme')
  })
})

describe('Dark mode: AppBar theme toggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mode terang: aria-label target "gelap"', async () => {
    renderAppBar()
    const btn = await screen.findByRole('button', { name: 'Ganti ke tampilan gelap' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('title', 'Tampilan gelap')
  })

  it('klik toggle menyimpan ke localStorage dan aria-label jadi "terang"', async () => {
    renderAppBar()
    const btn = await screen.findByRole('button', { name: 'Ganti ke tampilan gelap' })
    fireEvent.click(btn)
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(await screen.findByRole('button', { name: 'Ganti ke tampilan terang' })).toBeInTheDocument()
  })

  it('mode gelap (dari localStorage): aria-label target "terang"', async () => {
    localStorage.setItem(THEME_KEY, 'dark')
    renderAppBar()
    const btn = await screen.findByRole('button', { name: 'Ganti ke tampilan terang' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('title', 'Tampilan terang')
  })
})

describe('Dark mode: ThemeSync cross-iframe broadcast', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('broadcast postMessage {kk-theme} ke parent saat tema berubah', async () => {
    localStorage.setItem(THEME_KEY, 'dark')
    const posted: unknown[] = []
    const origPost = window.parent.postMessage
    window.parent.postMessage = ((msg: unknown) => {
      posted.push(msg)
    }) as typeof window.parent.postMessage
    try {
      render(
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey={THEME_KEY}
        >
          <ThemeSync />
        </ThemeProvider>,
      )
      await new Promise((r) => setTimeout(r, 50))
      expect(
        posted.some((m) => (m as Record<string, unknown>)['kk-theme'] === 'dark'),
      ).toBe(true)
    } finally {
      window.parent.postMessage = origPost
    }
  })

  it('menerima postMessage kk-theme dan menerapkan setTheme', async () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey={THEME_KEY}
      >
        <ThemeSync />
        <AppBar
          title="Ringkasan"
          user={{ name: 'Pak Darmawan', role: 'Pemilik', mono: 'PD' }}
        />
      </ThemeProvider>,
    )
    const lightBtn = await screen.findByRole('button', { name: 'Ganti ke tampilan gelap' })
    expect(lightBtn).toBeInTheDocument()
    window.dispatchEvent(new MessageEvent('message', { data: { 'kk-theme': 'dark' } }))
    expect(await screen.findByRole('button', { name: 'Ganti ke tampilan terang' })).toBeInTheDocument()
  })
})
