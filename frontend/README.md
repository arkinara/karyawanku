# KaryawanKu — Frontend (Next.js 15)

Web frontend, App Router, TypeScript + Tailwind. Design tokens dan shell
mengikuti spesifikasi `../docs/UX-SPEC.md` (ProMax).

## Setup

```bash
npm install
```

## Menjalankan

```bash
npm run dev        # dev server → http://localhost:3000
```

Halaman demo shell:
- `/` — landing (pilih role)
- `/dashboard` — shell owner (`AppShell userRole="owner"`)
- `/beranda` — shell employee (`AppShell userRole="employee"`)

## Build produksi

```bash
npm run build
npm run start      # serve hasil build
```

## Tes

```bash
npm test           # vitest run (jsdom + Testing Library)
npm run test:watch
```

## Typecheck

```bash
npm run typecheck  # tsc --noEmit
```

## Dark mode (ticket #40)

Tema mengikuti spektrum **URL param → localStorage → system preference**,
dengan fallback light. Diterapkan sebagai class `.dark` pada `<html>`
(`darkMode: 'class'`), bukan `<body>`.

- **Pre-paint FOUC guard** — inline `<script>` di `<head>` layout.tsx men-set
  `.dark` + `color-scheme` sebelum React hydrate, jadi tidak ada flash terang
  saat load pertama.
- **State** — `next-themes` `ThemeProvider` (`attribute="class"`,
  `storageKey="kk-theme"`) di layout.tsx. Komponen baca/set via `useTheme()`.
- **Toggle** — tombol sun/moon di `AppBar` (mode gelap → ikon sun, mode terang →
  ikon moon; `aria-label` "Ganti ke tampilan terang/gelap").
- **Sinkron** — tab: event `storage` next-themes; iframe: `ThemeSync`
  broadcast/receive `postMessage { kk-theme }` ke parent + semua child iframe.

### Cara tes

1. `npm run dev`, buka `/dashboard`.
2. Klik toggle — cek ikon + `aria-label` berubah, dan `localStorage['kk-theme']`.
3. Buka dua tab — ganti tema di satu tab, tab lain ikut (event storage).
4. Buka prototype viewer `prototype-promax/index.html` — ganti tema di app,
   viewer iframe ikut sinkron.

### Override via DevTools

- **Paksa dark/light tanpa ubah OS**: DevTools → `</>` Console →
  `localStorage.setItem('kk-theme','dark')` lalu reload, atau gunakan toggle.
- **Simulasi system preference**: DevTools → Rendering (⋯ → More tools →
  Rendering) → *Emulate CSS media feature prefers-color-scheme* → `dark`.
- **Tes FOUC**: mode dark → reload halaman; seharusnya tidak ada kilatan
  tampilan terang sebelum dark diterapkan.

## Struktur inti

- `src/components/ui/app-shell.tsx` — `<AppShell>`: rail (desktop) + bottom
  nav/drawer (mobile) + app bar, di sekitar `children`.
- `src/components/ui/theme-sync.tsx` — sinkron tema post-hydration + broadcast
  `postMessage` lintas iframe.
- `src/lib/nav-config.ts` — model navigasi (owner/employee) + metadata org/user.
- `src/app/globals.css` — ProMax tokens (light/dark) + base + typography + shell CSS.
- `tailwind.config.ts` — token bridge `hsl(var(--…))` per `kk-tailwind.js`.