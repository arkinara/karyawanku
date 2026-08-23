# KaryawanKu — UX Reference Spec (ProMax variant)

**Source of truth for FE implementation:** `frontend/prototype-promax/`
**Compare UI:** `frontend/prototype/` (ProMax wins, do not copy from v1)

The ProMax prototype is the design reference. This spec captures everything Dev needs to translate the static HTML into Next.js + TypeScript + Tailwind components.

---

## 1. File layout (ProMax)

```
frontend/prototype-promax/
├── 01-onboarding-wizard.html   ← no shell, custom centered card layout
├── 02-auth-sign-in.html        ← no shell, split brand panel + card
├── 03-quick-dashboard-owner.html   ← shell="owner", nav="dashboard"
├── 04-quick-dashboard-employee.html ← shell="employee", nav="home"
├── 05-employee-directory.html  ← shell="owner", nav="employees"
├── 06-payroll-run.html         ← shell="owner", nav="payroll"
├── 07-payslip-detail.html      ← shell="employee", nav="payslip"
├── index.html                  ← prototype viewer (don't reproduce in app)
└── assets/
    ├── kk.css                  ← design tokens + component classes (READ THIS)
    ├── kk.js                   ← runtime: shell builder, theme, icons, dialogs
    └── kk-tailwind.js          ← Tailwind CDN config pointing at kk.css variables
```

---

## 2. Design tokens (from `assets/kk.css` lines 11-105)

### Color tokens — HSL components (so Tailwind `hsl(var(--token))` works)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `175 77% 26%` | `174 58% 62%` | Brand actions |
| `--primary-hover` | `175 77% 21%` | `174 58% 70%` | Hover state |
| `--primary-press` | `175 77% 16%` | `174 58% 76%` | Pressed state |
| `--on-primary` | `0 0% 100%` | `176 82% 11%` | Text on primary bg |
| `--primary-container` | `175 52% 91%` | `176 42% 22%` | Tonal backgrounds |
| `--on-primary-container` | `175 80% 13%` | `174 60% 87%` | Text on container |
| `--accent` | `32 90% 40%` | `38 88% 62%` | "Needs decision" affordances |
| `--accent-container` | `40 92% 92%` | `30 42% 20%` | Accent surfaces |
| `--surface` | `180 20% 99%` | `197 24% 8%` | Default body bg |
| `--surface-1` | `180 22% 97%` | `197 21% 11%` | App bar / rail bg |
| `--surface-2` | `180 20% 95%` | `197 19% 14%` | Subtle elevation |
| `--surface-3` | `180 18% 92%` | `197 17% 17%` | Cards on tinted bg |
| `--surface-4` | `180 16% 89%` | `197 16% 21%` | Highest elevation |
| `--on-surface` | `195 18% 12%` | `180 14% 94%` | Primary text |
| `--on-surface-variant` | `195 11% 37%` | `190 11% 73%` | Secondary text |
| `--outline` | `190 12% 55%` | `192 8% 48%` | Borders |
| `--outline-variant` | `190 14% 87%` | `196 12% 24%` | Dividers |
| `--success` | `160 84% 28%` | `158 58% 55%` | Approve, Hadir, Lunas |
| `--warning` | `33 92% 38%` | `40 88% 62%` | Pending, Telat |
| `--danger` | `347 77% 44%` | `350 80% 68%` | Reject, Absen |
| `--info` | `217 84% 46%` | `214 86% 70%` | Informational |

**Dark-mode rule (from kk.css):** elevation INVERTS — higher level = LIGHTER surface (not darker). Cards need `border` in dark mode to be visible.

### Shape (radius)

| Token | px | Use |
|---|---|---|
| `--r-xs` | 4 | Inner elements |
| `--r-sm` | 8 | Small cards, icon tiles |
| `--r-md` | 12 | Standard cards |
| `--r-lg` | 16 | **Main cards** (default) |
| `--r-xl` | 20 | Hero cards, sheets |
| `--r-full` | 999 | Pills, buttons, avatars |

### Elevation (4 levels)

| Token | Use |
|---|---|
| `--e1` | Default card shadow |
| `--e2` | Hover state, app bar |
| `--e3` | Modal backdrop |
| `--e4` | Drag preview, floating |

Shadow colors differ light vs dark — see `kk.css` lines 73-82.

### Motion

| Token | Value | Use |
|---|---|---|
| `--d-fast` | 120ms | Color/hover changes |
| `--d-base` | 200ms | Card hover, tab switch |
| `--d-slow` | 280ms | Page transition, drawer |
| `--ease-standard` | `cubic-bezier(.2, 0, 0, 1)` | Default |
| `--ease-emphasized` | `cubic-bezier(.05, .7, .1, 1)` | Snappy entrance |
| `--ease-exit` | `cubic-bezier(.3, 0, .8, .15)` | Exit animations |

**`prefers-reduced-motion` kill switch** — wrap animations in `@media (prefers-reduced-motion: no-preference)`.

### Z-index scale

| Token | Value | Use |
|---|---|---|
| `--z-raised` | 10 | Sticky app bar |
| `--z-nav` | 20 | Bottom nav, drawer |
| `--z-drawer` | 40 | Side drawer (mobile nav) |
| `--z-modal` | 50 | Dialog backdrop |
| `--z-toast` | 70 | Snackbar |

---

## 3. Layout shell (the pattern every page except 01/02 uses)

Every app page (03-07) is a thin `<main>` wrapped by a JS-generated shell. Body attributes declare role + active nav + title:

```html
<body data-kk-shell="owner|employee"
      data-kk-nav="dashboard|employees|attendance|leave|payroll|home|payslip|settings"
      data-kk-title="Selamat pagi, Pak Darmawan"
      data-kk-subtitle="Warung Kopi Nusantara · Rabu, 19 Agustus 2026">

  <main class="page" data-kk-main>
    <!-- PAGE CONTENT ONLY — shell is auto-generated -->
  </main>
</body>
```

The shell (`kk.js`) reads these attributes and builds:
- **Desktop (≥1024px)**: 240px nav rail LEFT + page content RIGHT
- **Mobile (<1024px)**: bottom nav fixed bottom + app bar top with menu drawer
- **App bar**: brand logo + title + subtitle left, theme toggle + notifications + user avatar right
- **Skip link**: keyboard accessibility for main content

**Dev implementation strategy:** Build this as `<AppShell>` component in `frontend/src/components/ui/app-shell.tsx`. Take props: `userRole: 'owner' | 'employee'`, `activeNav: NavKey`, `title: string`, `subtitle?: string`, `children`. Internally renders rail/bottom-nav/app-bar based on viewport.

### Navigation map (from `kk.js` NAV constant)

**Owner role:**
- Dashboard (Ringkasan)
- Karyawan (Employees)
- Absensi (Attendance)
- Cuti (Leave) — badge: pending count
- Payroll
- (secondary) Pengaturan (Settings)

**Employee role:**
- Beranda (Home)
- Absensi
- Cuti — badge: pending count
- Slip Gaji (Payslip)
- (secondary) Pengaturan

**Pages 01 (Onboarding) and 02 (Sign-in) use NO shell** — they are auth/standalone layouts:
- 01: centered card `max-w-2xl`, 3-step wizard with stepper
- 02: desktop split `lg:grid-cols-[1fr_520px]` — left brand panel (primary bg, decorative), right sign-in card

---

## 4. Typography roles

From `kk.css` lines 215-225:

| Class | Size | Weight | Use |
|---|---|---|---|
| `.t-display` | `clamp(28px, 4vw, 34px)` | 700 | Hero |
| `.t-h1` | `clamp(20px, 2.6vw, 25px)` | 650 | Page title |
| `.t-h2` | 17px | 640 | Section heading |
| `.t-h3` | 15px | 620 | Sub-heading |
| `.t-body` | 15px | 400 | Default |
| `.t-body-sm` | 13.5px | 400 | Secondary |
| `.t-label` | 13px | 550 | Button, label |
| `.t-caption` | 12px | 400 | Helper |
| `.t-over` | 11px | 650, uppercase | "NEEDS ACTION" etc. |

**`font-variant-numeric: tabular-nums`** — apply to all numeric values (currency, percentages, counts, dates). In ProMax this is set on `.num`, `table td/th`, `.metric-value`, `time`.

---

## 5. Component library (from `kk.css` lines 226+)

These are the CSS classes to convert to React/TSX components. Each gets a corresponding shadcn-style wrapper.

### Buttons (kk.css lines 227-310)

| Class | Style | Use |
|---|---|---|
| `.btn` | base — min-h 44px, rounded-full, transitions on bg/border/shadow/transform/color |
| `.btn-filled` | primary bg, white text, `--e1` shadow | Primary CTA |
| `.btn-tonal` | primary-container bg | Secondary action |
| `.btn-outline` | surface bg + outline border | Tertiary |
| `.btn-text` | transparent + primary text | Low emphasis |
| `.btn-danger` | surface bg + danger border + danger text | Destructive |
| `.btn-sm` | min-h 36px, 14px text | Compact |
| `.btn-lg` | min-h 52px, 16px text | Hero CTA |
| `.btn-icon` | 44x44 square | Icon-only |
| `.btn[aria-busy="true"]` | Spinner replaces label, width preserved | Async submit |

States: hover, active (scale 0.975), disabled (opacity 0.42), focus-visible (2px primary outline).

### Surfaces

| Class | Style |
|---|---|
| `.card` | border + `--r-lg` + bg surface + `--e1` |
| `.card-flat` | same minus shadow |
| `.card-pad` | padding 18px (20px @ sm+) |
| `.card-head` | flex row, padding 14px 18px, border-bottom |
| `.card-body` | padding 18px |
| `.card-foot` | border-top + surface-1 bg |
| `.card-action` | min-h 76px, hover lifts shadow to `--e2`, active scale 0.99 |
| `.divider` | 1px outline-variant |

### Chips

| Class | Pair |
|---|---|
| `.chip` | base — rounded-full, 12px text, surface-3 bg |
| `.chip-primary` / `.chip-success` / `.chip-warning` / `.chip-danger` / `.chip-info` | semantic variants using container+on-container pairs |
| `.chip-dot` | 6x6 colored circle prefix |

### Avatar

`.avatar` (40px), `.avatar-sm` (32px), `.avatar-lg` (52px), `.avatar-muted` — all rounded-full, primary-container bg, monogram text.

### Icon tile (square)

`.icon-tile` 36x36 `--r-sm`, with semantic variants `.icon-tile-primary`, `.icon-tile-success`, `.icon-tile-warning`, `.icon-tile-danger`, `.icon-tile-info`. Holds a Lucide icon.

### Inputs (forms)

Form inputs in ProMax use plain `<input>` with these classes:
```html
<input class="field" type="text" />
<textarea class="field" rows="3"></textarea>
<select class="field"></select>
```

`.field` rule (search kk.css): full-width, min-h 44px, surface-1 bg, outline border, `--r-md` radius, focus-visible border switches to primary + ring. Invalid state (`.field[aria-invalid="true"]`): danger border + danger-container bg tint.

### Table (data-dense)

`.data-table`:
- Wrapper: `overflow-x: auto`, surface bg, `--r-lg`, border
- `<thead>`: sticky top, surface-2, 12px uppercase text
- `<th>` / `<td>`: padding 12px 16px, border-bottom outline-variant, hover row surface-1
- Sticky first column option on mobile (overflow)

### Segmented control

`.segmented` (tab role) + `.seg` (button): pill row, active = primary bg, inactive = surface-2. Used for time range filters ("Hari ini / 7 hari / 30 hari").

### Modal/Dialog

`.modal-scrim` (fixed inset, scrim color 50% opacity, z-modal) + `.modal` (centered, surface-1 bg, `--r-xl`, `--e4` shadow).

### Banner

`.banner` — flex row with icon-tile + content + trailing CTA. Variants: `.banner-warning` (accent container bg), `.banner-info`, `.banner-danger`. Used for "X pengajuan cuti menunggu keputusan Anda" priority alerts.

### Toast (kk.js lines 380+)

`.toast` fixed bottom-center, `--z-toast`. Variants via tone: success/warning/danger/info.

### Progress / Spinner

CSS-only spinner `.spinner` (24px border, primary top-color, `kk-spin` animation 0.7s linear infinite). For indeterminate loaders.

---

## 6. Icons (kk.js ICON map)

Single inline SVG icon map with consistent 1.75 stroke-width. No emoji anywhere (the previous v1 prototype used 🍽️ and 💼 as structural icons — ProMax replaced these with `coffee` and `briefcase` Lucide geometry).

Available icons: dashboard, users, clock, calendar, wallet, payslip, home, settings, bell, menu, close, search, filter, check, checkCircle, alert, info, x, chevronRight, chevronLeft, chevronDown, arrowUp, arrowLeft, sun, moon, download, printer, logout, plus, play, pin, building, trend, coffee, briefcase, eye, eyeOff, inbox, undo, file, sparkle.

Usage: `<span data-icon="users"></span>` — `kk.js` scans for these and replaces with SVG on `DOMContentLoaded`. Or import the `ICON` map in React and render via a `<Icon name="users" />` component.

---

## 7. Dark mode

Implementation:

1. **Tokens**: every color/shadow has a `.dark` counterpart in `kk.css`
2. **Trigger**: `<html class="dark">` toggled by JS (prefers localStorage → system preference → light)
3. **Theme toggle**: in app bar, calls `setTheme()`, persists to localStorage, syncs across iframes via `postMessage`
4. **Tailwind**: `darkMode: 'class'` in `kk-tailwind.js` so utilities like `dark:bg-surface-1` work

For React implementation: same pattern. Use `useTheme()` hook reading from `localStorage` + `matchMedia('(prefers-color-scheme: dark)')`, expose via context, apply class to `<html>`.

---

## 8. Per-page notes (Dev must match these)

### 03-quick-dashboard-owner.html
- Greeting row: "Selamat pagi, Pak Darmawan" + date + segmented control (Hari ini / 7 hari / 30 hari) + "Unduh laporan" outline button
- **Priority banner** (`.banner-warning`): "2 pengajuan cuti menunggu keputusan Anda" with "Tinjau" tonal button — this is the ONE thing that needs a decision today
- **Metric grid** (4 cards): Total karyawan, Hadir hari ini, Cuti menunggu, Gaji bulan ini — each with icon-tile, value (`tabular-nums`), caption + delta
- 2-col grid: Attendance summary (4 mini stats Hadir/Telat/Absen/Izin with chip colors) | Pending leave list (avatars + Setujui/Tolak tonal buttons)
- Quick actions row: 3 card-action buttons (Rekap absensi, Tambah karyawan, Jalankan payroll)
- Payroll summary card (right col): Total gaji, Take-home, "Lihat detail" link

### 04-quick-dashboard-employee.html
- Shell="employee", nav="home"
- Single big check-in widget (status chip "Sedang bekerja" + circular progress 01:27 + "Clock Out" filled button)
- "Jadwal 3 Hari ke Depan" card (3 shift rows: avatar + date + shift label Pagi/Siang/Malam/Libur)
- Quick actions row (Ajukan Cuti, Lihat Slip Gaji)

### 05-employee-directory.html
- Shell="owner", nav="employees"
- Top: page title + "Tambah Karyawan" filled button (right)
- Search bar + filter chips (Semua / Aktif / Nonaktif / by contract type)
- Desktop: `.data-table` with sticky header (Nama, Jabatan, Jenis Kontrak, Status, Tanggal Masuk)
- Mobile: stacked card list per employee (table hidden via `md:hidden`)
- Pagination bottom

### 06-payroll-run.html
- Shell="owner", nav="payroll"
- App bar action: "Ekspor CSV" outline button (uses `data-kk-async` to fake progress + success toast)
- Period selector + status banner (Draft / Disetujui)
- 4 metric cards (Total karyawan, Total gaji, Total potongan, Take-home)
- Data-table breakdown per employee: Nama, Gaji Pokok, Tunjangan, Potongan, Take-home (all formatted IDR)
- Action row: "Setujui Payroll" filled + "Ekspor CSV" outline + "Batal" text

### 07-payslip-detail.html
- Shell="employee", nav="payslip"
- Employee info card top: avatar + nama + jabatan + "Periode Agustus 2026"
- 2-col: LEFT col-span-2 breakdown sections (Pendapatan green-tinted card + Potongan red-tinted card, each with itemized rows + totals), RIGHT col-span-1 sticky summary card (Total pendapatan, Total potongan, big Take-home pay primary container + "Unduh PDF" filled button)

### 01-onboarding-wizard.html (no shell)
- Centered card `max-w-2xl mx-auto`
- Stepper at top (3 dots with connector lines, current/done/pending states)
- Step content (form fields)
- "Kembali" text button + "Lanjut" filled button at bottom

### 02-auth-sign-in.html (no shell)
- Desktop split: `lg:grid-cols-[1fr_520px]`
- LEFT col: brand panel with primary bg + decorative blurred circles + logo + tagline
- RIGHT col: sign-in card (logo, "Masuk" h1, email field, password field, "Masuk" filled button, "Daftar" link)

---

## 9. Indonesian copy & formatting

- Bahasa Indonesia throughout (no English labels except reserved words: "Payroll", "Owner", "Manager", "Employee" in admin contexts)
- Status labels: HADIR, TELAT, ABSEN, IZIN, CUTI, DISETUJUI, MENUNGGU, DITOLAK, AKTIF, NONAKTIF, LUNAS, DRAFT
- IDR currency: `Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0})` → "Rp 3.500.000"
- Date: `Intl.DateTimeFormat('id-ID', {day:'2-digit', month:'2-digit', year:'numeric'})` → "19/08/2026"
- Time: 24h "07:45 WIB"
- Days: Senin-Sabtu-Minggu

---

## 10. Accessibility (non-negotiable)

- All interactive elements keyboard-accessible (tabindex follows visual order)
- Focus-visible: 2px primary outline + 2px offset (already in `.btn`)
- All touch targets ≥44px (`.btn` min-height 44px, `.btn-icon` 44x44, nav items 48px+)
- Skip link in app shell: `<a class="skip-link" href="#main">Lewati ke konten</a>`
- `aria-current="page"` on active nav item
- `aria-label` on icon-only buttons
- `prefers-reduced-motion`: wrap all animations in `@media (prefers-reduced-motion: no-preference) { … }` — `kk.css` honors this
- Color contrast: token pairs verified ≥4.5:1 in both light and dark modes
- `<time datetime="ISO">` for all dates
- Screen reader text: `.sr-only` class for "X menunggu" badge labels