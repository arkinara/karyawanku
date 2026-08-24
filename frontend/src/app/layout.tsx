import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { ThemeSync } from '@/components/ui/theme-sync'

export const metadata: Metadata = {
  title: 'KaryawanKu',
  description: 'KaryawanKu — manajemen karyawan, absensi, cuti, dan payroll.',
}

/**
 * Pre-paint FOUC guard (port of kk.js:11-17): reads the theme from the URL
 * param, then localStorage (`kk-theme`), then the system preference, and sets
 * the `.dark` class + `color-scheme` on <html> before React hydrates.
 */
const themeScript = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var m=q;if(!m){try{m=localStorage.getItem('kk-theme')}catch(e){}}if(!m)m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var dark=m==='dark';var r=document.documentElement;r.classList.toggle('dark',dark);r.style.colorScheme=m;}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased bg-surface-1 text-on-surface">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="kk-theme"
          disableTransitionOnChange
        >
          <ThemeSync />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}