# KaryawanKu — Prototype ProMax

Revamp of `frontend/prototype`. Same 7 screens, same Bahasa Indonesia copy intent, same
brand (deep teal `#0F766E`) — rebuilt on a shared design system so the two versions can be
compared side by side.

Open `index.html`. Press **c** to put v1 and ProMax next to each other in the same viewport.

```
frontend/
  prototype/          # v1 — untouched
  prototype-promax/   # this folder
    index.html        # viewer: tabs, viewport presets, v1 compare, per-page change notes
    01-onboarding-wizard.html
    02-auth-sign-in.html
    03-quick-dashboard-owner.html
    04-quick-dashboard-employee.html
    05-employee-directory.html
    06-payroll-run.html
    07-payslip-detail.html
    assets/
      kk.css          # tokens (light + dark) + component layer
      kk-tailwind.js  # Tailwind CDN config mapped onto the same tokens
      kk.js           # app shell, icons, dialogs, toasts, validation, charts
```

## Viewer shortcuts

| Key | Action |
|-----|--------|
| `1`–`7` | jump to page |
| `←` `→` | previous / next page |
| `[` `]` | shrink / grow viewport (375 → 768 → 1024 → 1440 → full) |
| `c` | toggle side-by-side compare with v1 |
| `t` | toggle light / dark |

Deep links work: `index.html#05` opens the employee directory.

## What changed architecturally

**v1:** each of the 8 files carried its own copy of the Tailwind config, the nav rail, the
app bar, the bottom nav and the icon SVGs. Eight copies of the design system, already
drifting (page 07 used a different app bar and shadow scale than 03–06).

**ProMax:** one token file, one runtime.

- `kk.css` declares every colour, radius, shadow, duration and z-index as a CSS variable,
  once, with a full dark-mode counterpart. `kk-tailwind.js` points Tailwind utilities at the
  same variables, so `bg-surface-1` in markup and `.card` in CSS cannot diverge.
- `kk.js` builds the shell from two body attributes:

  ```html
  <body data-kk-shell="owner" data-kk-nav="payroll"
        data-kk-title="Payroll" data-kk-subtitle="Periode Agustus 2026">
    <main class="page" data-kk-main> … page content only … </main>
  ```

  Rail, app bar, mobile drawer, bottom nav, skip link and theme switch are generated. Adding
  a nav item is one line in `NAV`, not eight edits.
- Icons come from one Lucide-geometry map with a single stroke width. No emoji anywhere
  (v1 used 🍽️ and 💼 as structural icons in onboarding).

## Design system

| Dimension | Decision |
|-----------|----------|
| Style | Data-dense dashboard — tight metric grid, sticky table headers, tabular figures |
| Primary | teal `hsl(175 77% 26%)` light / `hsl(174 58% 62%)` dark — kept from `frontend/tailwind.config.ts` |
| Semantic | success / warning / danger / info, each with container + on-container pairs |
| Type | Inter, 6 roles (`t-h1` … `t-caption`), 15px body, `tabular-nums` on all figures |
| Radius | 4 / 8 / 12 / 16 / 20 / full |
| Elevation | 4 depths (`--e1`…`--e4`), redefined for dark instead of reused |
| Motion | 120 / 200 / 280ms with three shared easings; one `prefers-reduced-motion` kill switch |
| Density | 7/10 — 12px card gaps, 44px controls, 12–16px table cells |

The `ui-ux-pro-max` design-system query recommended a blue/amber "Data-Dense Dashboard"
palette with Fira Sans. The **style** was adopted; the **palette and font were not** —
KaryawanKu already ships teal + Inter in `frontend/tailwind.config.ts`, and rebranding a
prototype would have made the comparison meaningless. Amber survives as `--accent`, used
only for "needs your decision" affordances.

## What changed per screen

Every screen: dark mode, working mobile drawer, skip link, `focus-visible` rings, 44px
minimum targets, live regions for async changes, and 375 / 768 / 1024 / 1440 layouts.

**01 Onboarding** — SVG icons instead of emoji; take-home pay recalculates from the inputs as
you type; draft autosaves to `localStorage`; blur-time validation with per-field errors;
meal allowance behind progressive disclosure.

**02 Sign in** — inline validation with recovery-oriented messages, `aria-busy` submit,
`aria-pressed` password reveal, correct `autocomplete`/`inputmode`, and a role switcher that
decides where sign-in lands (speeds up review).

**03 Owner dashboard** — new 14-day attendance trend chart (pure CSS/HTML, no chart library)
with a `<details>` data table and a screen-reader summary; priority banner naming the one
decision due today; leave approve/reject with confirm-on-destructive and undo toasts;
badges, metrics and banner all recount when a request is decided; payroll timeline replaces
a bare total.

**04 Employee home** — animated work-hours ring with a live ticker; clock-out confirms then
reflects the new state; new "Bulan ini" summary (hours, days, late, overtime); leave quota as
meter + number, never colour alone.

**05 Directory** — search, status filter and sort actually work; sticky sortable headers with
`aria-sort`; bulk select with export / deactivate (confirm + undo); empty state with a way
out; detail in a native `<dialog>` (Esc, focus trap, inert for free); desktop table and
mobile cards rendered from one data array.

**06 Payroll run** — all totals computed from row data, so subtotals cannot disagree with the
table; deductions made realistic (BPJS 3% + PPh 21 ≈ Rp 850.000 on Rp 29.000.000, versus
v1's implausible 15%); rows needing review are flagged and filterable; approval requires
confirmation because it is irreversible, then the page's status changes; sticky approve bar
keeps the transfer total visible down a long table; cost composition as meter + legend + text.

**07 Payslip** — period picker with three real slips (August, July, June-with-THR); every
line explains its own arithmetic ("4 jam × 1,5 × upah per jam"); 6-month take-home history
chart with a text equivalent; a `@media print` layout so the slip prints without navigation;
"Laporkan selisih ke HR" as a recovery path.

## Data consistency

The prototype now uses one consistent dataset across screens, which v1 did not:

| Figure | Value |
|--------|-------|
| Active employees paid | 11 of 12 |
| Total earnings (August 2026) | Rp 29.000.000 |
| Total deductions | Rp 850.000 |
| Total take-home | Rp 28.150.000 |
| Siti Nurhaliza — base / take-home | Rp 2.400.000 / Rp 2.828.000 |

Owner dashboard, payroll run, payslip and the sign-in hero all read from these numbers.

## Verified

- Inline JS parses (`node --check`) and every page renders under headless Chrome with no
  `undefined` / `NaN` / `[object Object]` reaching the DOM.
- Token contrast checked programmatically in **both** themes: text pairs ≥ 4.5:1, UI
  colours ≥ 3:1. Light `--outline` was darkened to `190 12% 55%` to reach 3.08:1 for input
  borders.
- Dark mode has its own colour, elevation and scrollbar values — not an inversion.

## Notes

- Tailwind still loads from the CDN, as in v1, so any page opens straight from the file
  system with no build step. `kk.css` covers all component styling; Tailwind only supplies
  layout utilities.
- No chart library: both charts are flex columns plus one SVG ring.
- `localStorage` writes are wrapped in `try/catch` — under `file://` with storage blocked the
  prototype degrades to system theme instead of throwing.
