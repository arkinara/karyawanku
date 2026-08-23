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

## Struktur inti

- `src/components/ui/app-shell.tsx` — `<AppShell>`: rail (desktop) + bottom
  nav/drawer (mobile) + app bar, di sekitar `children`.
- `src/lib/nav-config.ts` — model navigasi (owner/employee) + metadata org/user.
- `src/app/globals.css` — ProMax tokens (light/dark) + base + typography + shell CSS.
- `tailwind.config.ts` — token bridge `hsl(var(--…))` per `kk-tailwind.js`.