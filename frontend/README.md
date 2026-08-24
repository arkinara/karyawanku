# KaryawanKu — Frontend (Next.js 15)

Web frontend, App Router, TypeScript + Tailwind. Design tokens dan shell
mengikuti spesifikasi `../docs/UX-SPEC.md` (ProMax).

## Setup

```bash
npm install
```

## Environment

FE membaca backend dari `NEXT_PUBLIC_API_BASE_URL` (default
`http://localhost:3001`). Salin `.env.example` menjadi `.env.local` jika perlu
mengganti host:

```bash
cp .env.example .env.local   # opsional — default sudah menunjuk ke localhost:3001
```

## Menjalankan kedua server

Backend (Fastify) dan frontend (Next.js) dijalankan berdampingan:

```bash
# terminal 1 — backend
cd ../backend
npm install
npm run db:migrate   # sekali, siapkan database SQLite
npm run db:seed      # sekali, data contoh (owner@usaha.com / password123)
npm run dev          # → http://localhost:3001

# terminal 2 — frontend
cd ../frontend
npm run dev          # → http://localhost:3000
```

Buka `http://localhost:3000`, lalu `Masuk` sebagai `owner@usaha.com`.

Halaman demo shell:
- `/` — landing (pilih role)
- `/dashboard` — shell owner (`AppShell userRole="owner"`)
- `/beranda` — shell employee (`AppShell userRole="employee"`)

## Wiring (tickets #34–#38)

Semua halaman memakai API nyata lewat client tunggal di
`src/lib/api-client.ts` — tidak ada mock data untuk Employee Directory,
Attendance, Leave, Payroll Run, dan Dashboard.

- **API client** — `api.get/post/patch/delete/upload/download` menempel
  `Authorization: Bearer <token>` dari `localStorage['kk-token']`, base URL dari
  `NEXT_PUBLIC_API_BASE_URL`, melempar `ApiError` (status + pesan Bahasa) pada
  non-2xx, dan menyalurkan error ke event-bus global untuk toast.
- **Auth** — `src/lib/auth-context.tsx` (`useAuth`) memanggil
  `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/sign-out`, dan
  merehidrasi sesi dari `/api/auth/me` saat halaman dimuat.
- **Endpoints yang dikonsumsi per halaman**:
  | Halaman | Endpoint BE |
  |---|---|
  | Dashboard | `GET /api/dashboard` |
  | Karyawan | `GET /api/employees`, `PATCH /api/employees/:id` |
  | Absensi | `POST /api/attendance/clock-in|clock-out`, `GET /api/attendance/today`, `GET /api/attendance/employee/:id`, `POST /api/attendance/manual` |
  | Cuti | `GET /api/leave-requests`, `POST /api/leave-requests`, `PATCH /api/leave-requests/:id/approve|reject`, `GET /api/leave-balances`, `GET /api/leave-types` |
  | Payroll | `GET|POST /api/payroll-runs`, `GET /api/payroll-runs/:id`, `PATCH /api/payroll-items/:id`, `POST /api/payroll-runs/:id/approve`, `GET /api/payroll-runs/:id/export.csv` |
- **Offline** — clock in/out yang gagal karena koneksi di-queue di
  `src/lib/offline-queue.ts` (localStorage) dan auto-flush saat event `online`.
- **Toast error global** — `src/components/ui/toast.tsx` (`ToastProvider` di
  `app/layout.tsx`) memantau event-bus API client dan menampilkan pesan Bahasa
  ("Gagal memuat data", "Gagal menyimpan", "Tidak terhubung ke server"),
  auto-dismiss 4 detik.

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

## Components (ticket #41 — shared primitives)

Empat pola yang dipakai berulang di Dashboard/Payroll/Directory, dibangun satu
kali sebagai komponen reusable, semua memakai token ProMax dari
`tailwind.config.ts`.

### PriorityBanner (`src/components/ui/priority-banner.tsx`)
Banner alert prioritas dengan icon-tile kiri, konten tengah, CTA trailing.
Variant `warning`/`info`/`danger` mengganti container + border-left token.
```tsx
<PriorityBanner
  variant="warning"
  title="2 pengajuan cuti menunggu keputusan Anda"
  description="Paling lama menunggu 2 hari."
  icon={AlertTriangle}
  action={{ label: 'Tinjau', href: '/cuti' }}
/>
```

### MetricCard + MetricGrid (`src/components/dashboard/`)
Kartu angka ringkasan (value 27px tabular-nums + icon-tile + caption/delta) dan
grid 4-up-nya (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`). Delta up/down/flat
memakai `text-success`/`text-danger`/`text-onsurface-variant`.
```tsx
<MetricGrid>
  <MetricCard label="Total Karyawan" value={12} icon={Users}
    delta={{ value: '+1 bulan ini', trend: 'up' }} />
  <MetricCard label="Hadir hari ini" value={10} icon={CheckCircle2} unit="/12" />
</MetricGrid>
```

### DataTable (`src/components/ui/data-table.tsx`)
Tabel sticky-header, kolom sortable (chevron asc/desc), kolom numerik
(`numeric` → rata kanan + tabular-nums), footer totals, dan empty state.
```tsx
<DataTable
  columns={[
    { key: 'nama', label: 'Nama' },
    { key: 'gaji', label: 'Gaji', numeric: true, sortable: true },
  ]}
  rows={rows}
  rowKey={(r) => r.id}
  footer={<tr><td>Total</td><td>8000</td></tr>}
/>
```

### SegmentedControl (`src/components/ui/segmented-control.tsx`)
Filter pill-row (role tab), option aktif `bg-primary text-primary-on`, sisanya
`text-onsurface-variant hover:bg-surface-2`. Navigasi arrow key kiri/kanan,
`aria-selected` pada option aktif, count opsional sebagai chip kecil.
```tsx
<SegmentedControl
  options={[
    { value: 'today', label: 'Hari ini' },
    { value: 'week', label: '7 hari', count: 5 },
    { value: 'month', label: '30 hari' },
  ]}
  value={range}
  onChange={setRange}
/>
```