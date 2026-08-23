---
name: KaryawanKu — Cap & Kain
description: Attendance and payroll rendered as stamped Javanese cloth — one cap stamp per person, indigo owning whole regions, no KPI tiles.
colors:
  kain: "#edf0f5"
  kain-2: "#e2e7f0"
  kain-3: "#d6dceb"
  kapas: "#fafbfd"
  nila: "#16244c"
  nila-2: "#1e3268"
  nila-3: "#0d1732"
  nila-wash: "#dde3f2"
  nila-line: "#b9c4e0"
  nila-teks: "#2a3d74"
  nila-on: "#f6f8fd"
  nila-on-2: "#a9b6d8"
  soga: "#8a5a2b"
  soga-wash: "#efe4d4"
  soga-teks: "#6e4520"
  merah: "#b5301c"
  merah-wash: "#f8e0db"
  merah-teks: "#93250f"
  kunyit: "#c08a12"
  kunyit-wash: "#f7eccf"
  kunyit-teks: "#8a5f06"
  daun: "#1f6b45"
  daun-wash: "#ddeee3"
  daun-teks: "#175435"
  tinta: "#131a2b"
  tinta-2: "#4a5570"
  tinta-3: "#606a85"
  garis: "#c7cfdf"
  garis-2: "#dee4ef"
  kunyit-line: "#e2c785"
  kunyit-line-2: "#d8b055"
  kunyit-ink: "#241800"
  soga-line: "#d8c3a4"
  merah-line: "#e0b3a9"
  merah-field: "#fffafa"
  daun-line: "#a8cdb8"
  nila-on-press: "#e6ebf7"
  kunyit-on-nila: "#f0cf7e"
  daun-on-nila: "#9ed6b5"
  merah-on-nila: "#f3b3a6"
  soga-on-nila: "#e0b884"
typography:
  display:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.026em"
    fontVariation: "'wdth' 118"
  kain-figure:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 116"
    fontFeature: "'tnum' 1"
  money-figure:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.022em"
    fontVariation: "'wdth' 116"
    fontFeature: "'tnum' 1"
    fontSizeSteps: "1.0625rem / 1.25rem at 640 / 1.375rem at 1200"
  register-caption:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 750
    letterSpacing: "0.03em"
  date-cap-abbr:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  heading:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.09em"
    fontVariation: "'wdth' 108"
  table-head:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.09em"
  seal-word:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    letterSpacing: "0.11em"
    fontVariation: "'wdth' 100"
rounded:
  r-0: "0px"
  r-1: "2px"
  r-2: "4px"
  r-3: "6px"
spacing:
  g-1: "4px"
  g-2: "8px"
  g-3: "12px"
  g-4: "16px"
  g-5: "20px"
  g-6: "26px"
  tap: "48px"
  rail: "244px"
components:
  btn-cap:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.nila-on}"
    rounded: "{rounded.r-2}"
    padding: "0 20px"
    height: "48px"
    typography: "{typography.body}"
  btn-cap-hover:
    backgroundColor: "{colors.nila-2}"
  btn-cap-active:
    backgroundColor: "{colors.nila-3}"
  btn-garis:
    backgroundColor: "{colors.kapas}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.r-2}"
    padding: "0 20px"
    height: "48px"
  btn-garis-hover:
    backgroundColor: "{colors.kain-2}"
  btn-tolak:
    backgroundColor: "{colors.kapas}"
    textColor: "{colors.merah-teks}"
    rounded: "{rounded.r-2}"
  btn-tolak-hover:
    backgroundColor: "{colors.merah-wash}"
  btn-terang:
    backgroundColor: "{colors.nila-on}"
    textColor: "{colors.nila}"
    rounded: "{rounded.r-2}"
  btn-onnila:
    textColor: "{colors.nila-on}"
    rounded: "{rounded.r-2}"
  btn-sm:
    height: "38px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.kapas}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.r-2}"
    padding: "0 14px"
    height: "48px"
  input-error:
    backgroundColor: "#fffafa"
  input-disabled:
    backgroundColor: "{colors.kain-2}"
    textColor: "{colors.tinta-3}"
  panel:
    backgroundColor: "{colors.kapas}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.r-2}"
    padding: "16px"
  cap:
    backgroundColor: "{colors.nila-wash}"
    textColor: "{colors.nila}"
    rounded: "{rounded.r-1}"
    size: "40px"
  cap-nila:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.nila-on}"
  cap-mati:
    backgroundColor: "{colors.kain-3}"
    textColor: "{colors.tinta-3}"
  tag-nila:
    backgroundColor: "{colors.nila-wash}"
    textColor: "{colors.nila-teks}"
    rounded: "{rounded.r-1}"
    padding: "3px 8px"
    typography: "{typography.label}"
  tag-kunyit:
    backgroundColor: "{colors.kunyit-wash}"
    textColor: "{colors.kunyit-teks}"
  tag-daun:
    backgroundColor: "{colors.daun-wash}"
    textColor: "{colors.daun-teks}"
  tag-merah:
    backgroundColor: "{colors.merah-wash}"
    textColor: "{colors.merah-teks}"
  tag-soga:
    backgroundColor: "{colors.soga-wash}"
    textColor: "{colors.soga-teks}"
  tag-mati:
    backgroundColor: "{colors.kain-2}"
    textColor: "{colors.tinta-2}"
  rail-item:
    textColor: "{colors.nila-on-2}"
    rounded: "{rounded.r-2}"
    padding: "0 12px"
    height: "44px"
  rail-item-current:
    backgroundColor: "{colors.nila-on}"
    textColor: "{colors.nila}"
  table-head:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.nila-on-2}"
    padding: "10px 14px"
    typography: "{typography.table-head}"
  kain-band:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.nila-on}"
    padding: "22px 16px 20px"
---

# Design System: KaryawanKu — Cap & Kain

**Scope: this file describes the `frontend/prototype-impeccable/` surface only.** The repository holds four parallel prototypes of the same product — `frontend/prototype/`, `prototype-promax/`, `prototype-hallmark/`, `prototype-impeccable/` — each with its own visual world and its own seven screens. Nothing here applies to the other three. The whole system is one stylesheet, `assets/kk.css` (1,109 lines, 21 numbered sections), plus one behaviour file, `assets/kk.js`. No build step; every page opens from `file://`.

## Overview

**Creative North Star: "Cap & Kain"** — the Javanese batik *cap* (the copper stamp) and the *kain panjang* (the long cloth), used as structure and never as ornament. Seed key `d2443f8d`.

The product is an HRIS for Indonesian small businesses, so the interface is built out of the two things the work actually is: a repeat of people, and a length of cloth that records them. The **cap** is the repeat module — one stamp per person, appearing as the avatar (`.cap`), the nav marker, the date block (`.cap--date`), the approval seal (`.seal`), the register cell (`.reg__cell`). The **kain** is the dyed indigo band that heads every page and carries that page's figures printed directly on the cloth (`.kain` + `.figs`). Every term in the vocabulary is a mechanism, not a nickname: **tumpal** and **crown** are the triangle border bands that edge a region (`.tumpal`, `.kain__edge`, `.crown`, `.bottomnav::before`, `.shiftbar__now`); **klowong** is the un-dyed outline and means *draft* (`.panel--klowong`, `tr.klowong`); **tercap** is stamped-and-dyed and means *approved and locked* (`tr.tercap`, `.seal--tercap`); **isen** is fill density standing for magnitude (`.isen__fill`, `.bar__seg`); **selvedge** is the finished cloth edge, which is the nav rail (`.rail` and its dashed `::after` thread); **tenun** and **capfield** are the two woven and stamped surface textures (`.tenun`, `.capfield`); **register** is attendance as a strip of stamps (`.reg`).

What it refuses is specific and stated in the direction contract at the top of every page's `<body>`: the four-identical-white-KPI-tiles SaaS dashboard. Page 03's own thesis line names it — "the SaaS HRIS arrangement of four identical white KPI tiles floating on neutral grey." In its place, the day's figures are set *on the indigo* in a two-column warp-ruled grid that only goes four-across at 1200px, once each cell can hold a whole rupiah figure. The other refusals are equally literal, one per page: the blurred-gradient-blob marketing panel (02), the numbered-circle progress bar over a white form card (01), the progress-ring donut for a shift (04), the generic avatar-circle data table (05), "Approve" as a button that changes a badge (06), the green-header/red-header receipt card pair (07), the chrome-heavy device-mockup gallery (index).

**Key Characteristics:**
- Indigo `#16244c` owns whole regions — the rail, the page head band, every table head, dyed rows — rather than accenting them.
- Light, not dark: a kerokan-pale cool ground `#edf0f5`, because the use scene is a warung counter at 08:00 with an open shopfront and a mid-range Android in tropical glare.
- Square corners: 2px and 4px only. Never a pill. A stamp has edges.
- One type family, Archivo, at two widths. No monospace anywhere — tracked small caps do the micro-label work.
- Data state is carried by dye, hatch, dot density and outline, not by a chart library. There is no donut, no ring, no sparkline.
- One authored motion moment in the whole product: the payroll dyeing sweep.

## Colors

Four dyes over one undyed ground: indigo for structure and commitment, then soga, merah, kunyit and daun each owning exactly one data meaning. Every hue ships as a trio — base (the dye), `-wash` (the fill behind a state), `-teks` (the ink readable on that wash) — so a state never needs an improvised colour.

Two further ramps finish each hue, so nothing has to be improvised at the edges:
`-line` is that hue's hairline (`--kunyit-line` `#e2c785`, `--kunyit-line-2` `#d8b055` for the
register and legend keys, `--soga-line` `#d8c3a4`, `--merah-line` `#e0b3a9`, `--daun-line`
`#a8cdb8`), and `-on-nila` is that hue's secondary ink for use **on dyed cloth**, tinted from
its own hue rather than greyed (`--kunyit-on-nila` `#f0cf7e`, `--daun-on-nila` `#9ed6b5`,
`--merah-on-nila` `#f3b3a6`, `--soga-on-nila` `#e0b884`). Three singletons complete the set:
`--kunyit-ink` `#241800` (the only ink dark enough to sit on a kunyit badge),
`--merah-field` `#fffafa` (an errored input's ground) and `--nila-on-press` `#e6ebf7`
(`.btn--terang` pressed). No literal hex belongs in a page: every colour above resolves
through one of these names.

### Primary
- **Nila / Indigo** (`--nila`): the region owner. It is the whole selvedge rail, the whole page head band, every `thead` in the product, the primary button, the checked checkbox, the fully-dyed register cell, the `tercap` row. Its job is to hold a field, not to punctuate one. Deeper `--nila-2` is the primary-button hover, `--nila-3` the active press and the border of any solid indigo stamp.
- **Nila wash / line / teks** (`--nila-wash`, `--nila-line`, `--nila-teks`): the light half of the same dye. `nila-wash` fills a resting cap and a structural tag; `nila-line` is the hairline on any stamp, register cell, isen track or dashed klowong edge; `nila-teks` is the only link colour and the ink for inline actions (`.link`).
- **Nila on / on-2** (`--nila-on`, `--nila-on-2`): the two inks that work on dyed cloth. `nila-on` is the primary text on indigo and also inverts to become the *background* of the current rail item and current bottom-nav item; `nila-on-2` is the secondary on-cloth ink — page meta, figure labels, the rail's org line.

### Secondary
- **Soga / Brown** (`--soga`, `--soga-wash`, `--soga-teks`): the second dye. Second-order and issued things — the `Harian` (daily-wage) contract tag, the excused-absence dot pattern in the register and split bar, the deductions `crown` on the payslip's Potongan panel, the approved payslip seal (rendered at `#e0b884` so it reads on indigo).

### Tertiary
- **Kunyit / Turmeric** (`--kunyit`, `--kunyit-wash`, `--kunyit-teks`): *needs your decision*. Pending leave, late arrival, draft state, the rail's count badge, the pending date stamp, the un-inked draft seal, the tumpal band edging a "perlu ditindak" region, and the focus ring on dyed cloth.
- **Merah cabe / Chilli red** (`--merah`, `--merah-wash`, `--merah-teks`): deductions, negatives, destructive and error. The minus money column, the reject button's ink and border, the field error border, the notification pip, the absent register cell's dashed edge.
- **Daun / Leaf** (`--daun`, `--daun-wash`, `--daun-teks`): present, on time, done. The Aktif status tag, the earnings tag, the success notice after the payroll stamp.

### Neutral
- **Kain** (`--kain`): the page ground — the kerokan pale, cool and never cream. Also the table row hover and the panel foot.
- **Kain 2 / Kain 3** (`--kain-2`, `--kain-3`): the two pressed steps down — icon-button hover then active, table `tfoot`, disabled input, inactive stamp, the stepper's unfilled rule.
- **Kapas / Cotton** (`--kapas`): the raised surface — every panel, input, top bar, isen track, register cell ground.
- **Tinta / Ink** (`--tinta`, `--tinta-2`, `--tinta-3`): body ink, secondary ink, and placeholder/tertiary ink.
- **Garis / Rule** (`--garis`, `--garis-2`): the outer hairline of a surface, then the inner divider between its parts. Regions are separated by a rule or by dye — not by a shadow.

### Named Rules

**The Region Rule.** Indigo is applied to whole regions, never as a 4px accent stripe or a coloured word. If a new surface needs indigo, it takes all of it — background, ink, and its own tumpal edge — or it takes none.

**The One Meaning Rule.** Each of the four data dyes owns exactly one meaning across all seven screens: kunyit = needs your decision, merah = deduction or destruction, daun = done and on time, soga = second-order or issued. A new state does not get an existing hue with a new meaning; it gets its own trio or it reuses the meaning.

**The Light Ground Rule.** The ground is light and the contrast is high because of the use scene — an open shopfront in tropical glare on a mid-range Android. `color-scheme: light` is declared and there is no dark variant. Do not add one without re-deciding the scene.

### Engineered contrast pairs

Three places where the pairing was worked out deliberately rather than inherited:

- **Register caption plates.** A `.reg__cell` dyes its upper area via `::before` and prints the person's initials on a *solid plate* — `.reg__cell > span` paints the matching `-wash` with the matching `-teks` ink and its own top hairline, so 10px initials never sit on the indigo dye or the kunyit hatch. All four states re-declare the plate (`nila-wash/nila-teks`, `kunyit-wash/kunyit-teks`, `soga-wash/soga-teks`, `merah-wash/merah-teks`).
- **On-cloth secondary ink.** `--nila-on-2` (`#a9b6d8`) is the only secondary ink allowed on `#16244c`, used for `.kain__meta`, `.fig__lab`, `.fig__note` and the rail's org line. When a note stops being merely secondary and starts carrying a state it escalates to a lightened dye instead: `.fig__note--kunyit` `#f0cf7e`, `.fig__note--daun` `#9ed6b5`, and negative money on cloth at `#f3b3a6`. The base dyes are too dark to read on their own ground, which is exactly why these lightened variants exist.
- **Filter-chip counts.** `.cnt { color: inherit; opacity: 0.7 }`. The count inherits the chip's own ink rather than taking a fixed grey, because `initDirectory()` swaps the whole class between `btn--cap` (indigo ground, `nila-on` ink) and `btn--garis` (kapas ground, `tinta` ink) as the selection moves. A fixed grey would fail on one of the two.

## Typography

**Single family:** Archivo (fallbacks `Segoe UI`, `system-ui`, `-apple-system`, `sans-serif`), loaded as one variable axis pair from Google Fonts: `family=Archivo:wdth,wght@62..125,400..900`.
**Label/Mono font:** none. Deliberately.

**Character:** one grotesque doing two jobs. Widened and heavy it becomes the display voice — stamped, carved, slightly compressed in tracking. At normal width with tabular figures it becomes the data voice. The distance between them is width, not family.

### Hierarchy
- **Display** (`.disp`, weight 800, `wdth 118`, line-height 1.02, tracking −0.026em): page titles inside the kain band, the take-home figure, the sign-in promise, the elapsed-hours figure. Sized per use from the scale, most often `--t-3xl` 2.125rem stepping to `--t-4xl` 2.75rem at 640px.
- **Kain figure** (`.fig__num`, weight 800, `wdth 116`, line-height 1, tracking −0.03em, `white-space: nowrap`): the figures printed on the cloth. 1.75rem → 2.125rem at 640px → 2.75rem at 1200px. A `<small>` suffix inside it drops to 0.5em at weight 600 in `nila-on-2` for units like `/12` or ` jam`.
- **Heading** (`h1` 1.75rem/700, `h2` 1.125rem/650, `h3` 0.9375rem/650, all line-height 1.16, tracking −0.018em / −0.012em): panel heads and sub-section heads.
- **Body** (0.9375rem / 15px, weight 400, line-height 1.5): the floor for readable text. `font-variant-numeric: tabular-nums` is set on `body`, so every figure in the product aligns by default. Prose is capped at `68ch` (`.prose`); empty-state copy at `44ch`.
- **Label** (`.lab`, 0.6875rem / 11px, weight 650, tracking 0.09em, uppercase, `wdth 108`): the micro-label convention that replaces monospace. Also the exact spec of every `thead th` (there, weight 700) — so table heads and figure labels are the same voice.
- **Seal word** (`.seal__word`, 11px, weight 800, tracking 0.11em, uppercase, `wdth 100`): the word inside a seal; the arc text around it is real SVG `textPath` at 7.6px/700 with 1.05–1.15 letter-spacing.

The fixed rem scale, used as-is with no clamp() anywhere: `--t-2xs` 0.6875rem (11), `--t-xs` 0.75rem (12), `--t-sm` 0.8125rem (13), `--t-base` 0.9375rem (15, the body floor), `--t-md` 1rem (16), `--t-lg` 1.125rem (18), `--t-xl` 1.375rem (22), `--t-2xl` 1.75rem (28), `--t-3xl` 2.125rem (34), `--t-4xl` 2.75rem (44). Type steps at breakpoints by swapping which token a rule uses, never by fluid interpolation.

### Named Rules

**The No-Mono Rule.** There is no monospace family in this system and no `font-feature`-faked one. Tracked small caps (`.lab`) carry every micro-label, and tabular figures carry every number. The reason is positional: the mono micro-label is the lane `prototype-hallmark` already owns, and two prototypes must not converge.

**The Money-Is-One-Word Rule.** A rupiah figure never wraps and never breaks: `.fig__num` and `.drench__num` set `white-space: nowrap`, and `.fig__num--money` steps the *type* down instead — 1.0625rem, then 1.25rem at 640px, then 1.375rem at 1200px, against 1.75/2.125/2.75rem for a plain count. "Rp 28.500.000" broken across two lines is unreadable as a quantity; a smaller unbroken one is not. The same rule is why `.figs` stays two-across until 1200px.

**The Two-Widths Rule.** Width is the display/data distinction. Anything setting `font-variation-settings` is display or label; anything not setting it is data at normal width with `tnum`. The values actually shipped are `wdth 118` (`.disp`), `116` (`.fig__num`, `.drench__num`), `112` (`.brand__name`), `108` (`.lab`) and an explicit `100` (`.seal__word`) — five values in service of two voices. Do not introduce a sixth without a reason you can name.

## Layout

**The shell.** `.shell` is a flex row at `min-height: 100vh`. Inside it: `.rail` (the selvedge) fixed to the left edge at `--rail-w: 244px`, `z-index: 50`, indigo ground with `nila-on` ink and a dashed warp thread painted by `::after` (a 1px-on/4px-off repeating gradient, 3px wide) standing in for the woven edge; then `.main`, a flex column holding the sticky `.topbar` (60px, `kapas`, 1px `garis` bottom border, `z-index: 30`), the full-bleed `.kain` band, and the page body. `.wrap` centres content at `max-width: 1220px` with 16px gutters, rising to 24px at 640px and 32px at 1024px. `.bottomnav` is fixed to the bottom (`z-index: 40`), an equal-column grid with an *upward* tumpal painted above it by `::before` (18×7px repeat) and `padding-bottom: env(safe-area-inset-bottom)`. `.pagepad` reserves `72px + safe-area` at the foot below 1024px so the bottom nav never covers the last row.

Three pages have no rail and use `.main--solo` (`padding-left: 0 !important`): `01-onboarding-wizard.html`, `02-auth-sign-in.html`, `07-payslip-detail.html`. Sign-in is the one page with no kain band at all — it is a 1-column grid becoming 2-column at 1024px, the left half a full-height `.capfield`.

**The drawer.** Below 1024px the rail becomes a drawer: it stays `display: flex` but is pushed off-canvas with `transform: translateX(-100%)` and `visibility: hidden`, with `transition: transform 220ms var(--ease), visibility 0s linear 220ms` — the delayed visibility keeps it painted while it slides out and drops it from the tab order once gone. `body.drawer-open` slides it to 0 and locks page scroll; `.scrim` (`rgb(13 23 50 / 0.55)`, `z-index: 45`) fades in beneath it. The rail sits *above* the scrim on purpose: an open drawer is the top layer, not a dimmed one.

**Breakpoints** — six, all real, all in `assets/kk.css`:

| Breakpoint | What changes |
|---|---|
| `max-width: 767.98px` | `.md\:show` forced to `display: none` (the tables), `.kain__motif` hidden |
| `min-width: 640px` | kain padding 30/24/26px, kain title → 2.75rem, figure → 2.125rem, money figure → 1.25rem, `.figs` top margin 26px, `.wrap` gutters 24px, `.sm\:c2/c3/c4`, `.sm\:row`, `.sm\:none` |
| `min-width: 768px` | `.md\:c2`; `.md\:hide` → none, `.md\:show` → `revert !important`. **This is the table-to-stacked-rows swap** |
| `max-width: 1023.98px` | rail becomes the off-canvas drawer with `--e3`, `.only-desktop` hidden |
| `min-width: 1024px` | rail permanently visible, `.main` gains `padding-left: 244px`, bottom nav hidden, `.only-mobile` hidden, `.wrap` gutters 32px, `.lg\:main2` (1.15fr / 1fr), `.lg\:side` (2fr / 1fr), `.lg\:c2/c3`, `.lg\:sticky` (`top: 78px`) |
| `min-width: 1200px` | `.figs` goes from 2 columns to 4, figure → 2.75rem, money figure → 1.375rem |
| `min-width: 1280px` | `.drench__num` → 2.75rem |

**The table-to-stacked-rows swap.** Every tabular surface is authored twice in the HTML, not transformed by CSS. The wide view is `.tblwrap > .tbl` marked `md:show` with an explicit `min-width` on the table (760px on payroll, 880px on the directory) inside an `overflow-x: auto` wrapper. The narrow view is a `<ul class="rows md:hide">` where each person becomes one `<li>` — a cap stamp plus name, then a `<dl>` of `.kv` rows ending in `.kv--total`. The 768px boundary swaps which one is displayed. Consequence to know before editing: **each person exists twice in the file**, and `initDirectory()` relies on it (`onPage = rows.length / 2`).

**Spacing rhythm.** A 4px base expressed as six gap steps (4, 8, 12, 16, 20, 26px) and the matching `.mt-*` steps, plus one-off internal paddings declared per component (panel head 14/16, panel body 16, kain inner 22/16/20 → 30/24/26 → 36/32/30). `--tap: 48px` is the minimum interactive height for buttons, icon buttons, inputs, selects and checkbox rows; the rail item floor is 44px, a bottom-nav item 60px.

### Named Rules

**The Full-Bleed Band Rule.** The kain band always spans the viewport edge-to-edge with its own inner `max-width: 1220px`, and is always followed immediately by `<div class="kain__edge" aria-hidden="true">`. A page head that stops at the content gutter is not a kain band.

**The Two-Up Figures Rule.** `.figs` is a two-column grid until 1200px, then four. The left cell of each row zeroes its left border and padding so its figure starts flush with the page title. Do not force four columns earlier — the rupiah figure loses the argument.

## Elevation & Depth

Near-flat and tonal. Depth comes from dye, from 1px rules, and from one pressed step of the neutral ramp — not from shadow. Only three surfaces in the entire product lift, and each has a reason: a panel needs to read as cloth laid on the ground, a commit bar needs to float above what it commits, and a drawer needs to read as *over* rather than *in*.

### Shadow Vocabulary
- **`--e1`** (`0 1px 2px rgb(19 26 43 / 0.055), 0 2px 6px rgb(19 26 43 / 0.05)`): the resting lift of `.panel` and of `.btn--cap`. Barely there; it exists so a panel edge does not dissolve into `--kain`.
- **`--e2`** (`0 1px 2px rgb(19 26 43 / 0.07), 0 4px 12px rgb(19 26 43 / 0.07)`): a surface that floats over content — the onboarding wizard's sticky commit bar and the viewer's device frame.
- **`--e3`** (`0 2px 4px rgb(19 26 43 / 0.08), 0 10px 28px rgb(19 26 43 / 0.10)`): the mobile drawer only.

`.btn--cap:active` removes its shadow (a press goes down, not up). `.panel--klowong` removes it too — a draft is drawn, not laid on.

Three inset/ring shadows do structural work and are not elevation: `.choice input:checked + .choice__body` gets `inset 0 0 0 1px var(--nila)` to double the selected border without shifting layout; `.step.is-now .step__cap` gets `0 0 0 3px var(--nila-wash)` as a halo around the current stamp; `.iconbtn--dot::after` gets `0 0 0 2px var(--kapas)` as a knockout collar so the red pip reads against the icon behind it.

### Motion

`--dur: 180ms` and `--ease: cubic-bezier(0.16, 0.84, 0.28, 1)` are the whole vocabulary for state. Every hover, focus, border and background transition uses them, which puts the state-transition band at 140–220ms in practice: 180ms for rail items, icon buttons, buttons, inputs, selects, affixes, choice cards, stepper stamps, the seal's colour and the scrim's opacity; 220ms for the drawer's transform; 140ms for the checkbox box and its tick's `scale(0) → scale(1)`, the one value that sits just under the band.

**The one authored motion moment** is the payroll stamp, and it lives in `initPayroll()` in `assets/kk.js` driving two keyframe sets in section 14–15 of the stylesheet. Pressing **Cap & setujui payroll** swaps the action bar for an inline confirm (never a modal); confirming runs a 620ms loading spinner, then: each `<tr>` gets `--d: (i × 55ms)` and the `dye` animation (380ms, a `nila-wash` gradient wiping left to right through 0% → 100% → cleared), and 160ms into its own delay each row drops `.klowong` and gains `.tercap`; at 260ms the seal loses `.seal--draft`, gains `.seal--tercap .seal--press` and runs `press` (420ms: `scale(1.5) rotate(-11deg)` at 0 opacity → `scale(0.95) rotate(-6deg)` → resting `rotate(-7deg)`), its word becomes "Tercap" and its arc text becomes the approval date; at 700ms the kunyit draft notice is rewritten as an indigo locked notice and the action bar becomes a receipt that takes focus. The only other animation in the system is `spin` (620ms linear, infinite) on a loading button's 17px ring.

`@media (prefers-reduced-motion: reduce)` collapses all of it to `animation-duration: 0.001ms !important`, `animation-iteration-count: 1 !important`, `transition-duration: 0.001ms !important` on every element and pseudo-element. Note the shape of that decision: nothing is disabled, so the dye still runs, the seal still presses, the rows still land in `.tercap` — the state change is instant instead of absent.

### Named Rules

**The Flat-Unless-Floating Rule.** Surfaces are flat. A shadow is permitted only when a surface genuinely floats over other content (`--e2`, `--e3`) or is the resting cloth panel (`--e1`). Never use a shadow to separate two regions that dye or a 1px `--garis` rule can separate.

**The One Moment Rule.** The product has exactly one authored motion moment, and it belongs to the one irreversible action. Every other transition is a 180ms state change. Adding a second choreographed sequence devalues the first.

## Shapes

A stamp has edges. The radius scale is `--r-0: 0px`, `--r-1: 2px`, `--r-2: 4px`, `--r-3: 6px` — and only two of them are in use: `--r-1` for everything stamp-scale (cap, tag, tag dot, register cell, isen track and fill, legend key, rail count badge, nav pip, focus ring, inline code) and `--r-2` for everything surface-scale (panel, button, input, select, affix, rail item, icon button, choice card, empty-state cap, drench block, crown top corners). `--r-0` and `--r-3` are declared and unused.

Nothing is a pill. There is no `border-radius: 999px` anywhere in the file. Exactly two things are round, both because the object they depict is round: `.seal` at `border-radius: 50%` (a wax seal), and the 17px loading ring inside `.btn[data-loading]`.

The recurring silhouettes:
- **The carved corner.** `.cap::before` paints four 45°/135°/225°/315° gradients at 5px in `currentColor` at 0.22 opacity (0.3 on `.cap--nila`), giving every stamp the chipped corners of a copper block. It is `pointer-events: none` and inherits ink, so it works on every cap variant automatically.
- **The tumpal triangle.** One SVG path, `M0 0h22L11 9z`, at 22×9px repeating on X. It appears as `.tumpal` (with `--soga` and `--kunyit` recolours), as `.kain__edge` under every band, as the fringe half of `.crown`, inverted at 18×7px above `.bottomnav`, and shrunk to 12×7px as `.shiftbar__now`. When a region needs an edge, it gets this triangle at one of those four scales — not a border-radius, not a gradient fade.
- **The cap field.** `.capfield` is a 112×112px SVG repeat on indigo — cross-axes, a square, a 45°-rotated square, a circle and four corner ticks in white at 0.14 stroke opacity, plus nine dots at 0.2 fill. Used where a whole region is dyed: the sign-in panel and the take-home `.drench` block.
- **The weave.** `.tenun` is a 45° repeating linear gradient, 1px of white at 0.035 every 4px, laid over any dyed band. The register's dyed cell and the split bar's present segment use the same gradient at 0.08/0.14/0.16 — fill density *is* the data.
- **Klowong vs tercap.** Draft is expressed as geometry, not colour: `border-style: dashed` plus muted ink (`.panel--klowong`, `tr.klowong .cap`, `.reg__cell--absen`, `.empty__cap`, the draft seal's `stroke-dasharray: 3 3` on a 1.6 stroke). Stamping solidifies the same edge (`.seal--tercap .seal__ring` → no dash, stroke 2.8).

## Components

Inventory keyed to the real class names, with the state set each one actually ships. Where a state is missing it is named as missing.

### Buttons (`.btn`)
- **Shape:** 4px corners (`--r-2`), `min-height: 48px` (`--tap`), 20px side padding, 8px icon gap, 15px/650 label, 1px transparent border so outlined and filled variants share a box.
- **`.btn--cap`** (primary): indigo ground, `nila-on` ink, `--e1`. Hover `--nila-2`; active `--nila-3` with shadow removed.
- **`.btn--garis`** (secondary): `kapas` ground, `tinta` ink, `garis` border. Hover `kain-2` + `nila-line` border; active `kain-3`.
- **`.btn--tolak`** (destructive): `kapas` ground, `merah-teks` ink, `#e0b3a9` border. Hover `merah-wash` + `merah` border. **No `:active` state.**
- **`.btn--onnila`**, **`.btn--ghost`**, **`.btn--terang`** (on dyed cloth): translucent white 0.12 with a 0.32 border; fully transparent with the same border; and solid `nila-on` with `nila` ink for the clear primary on cloth. Only `--terang` ships an `:active` (`#e6ebf7`).
- **Sizes:** `.btn--sm` (38px / 14px padding / 13px), `.btn--block` (full width).
- **Shared states:** `:disabled` and `[aria-disabled="true"]` → 0.42 opacity, no shadow, `pointer-events: none`. `[data-loading="true"]` → label goes transparent, pointer events off, a 17px 2px ring spins in the centre at 620ms (ink forced to `nila-on`, overridden to `tinta` for `--garis`). Focus is the global ring.
- **Absent:** no icon-only `.btn` variant (that role belongs to `.iconbtn`), no toggle/segmented variant — the filter chips and viewer tabs are plain buttons whose entire class string is rewritten in JS between `btn--cap` and `btn--garis`, carrying `aria-pressed` or `aria-current`.

### Icon buttons (`.iconbtn`)
48×48px, transparent, `tinta-2` ink, 4px corners. Hover `kain-2` + `tinta` ink; active `kain-3`; `:disabled` 0.4 opacity with pointer events off (used on the pager's previous arrow). `.iconbtn--dot` adds a 7px `merah` pip at top 12/right 13 with a 2px `kapas` collar. **No loading state.** Pages override the size down to 44px inside the pager and the password reveal.

### Chips / Tags (`.tag`)
- **Style:** 3px/8px padding, 2px corners, 11px/700 uppercase at 0.045em tracking, `white-space: nowrap`, always a 1px border in its own hue. Six hues — `--nila`, `--daun`, `--kunyit`, `--merah`, `--soga`, `--mati` — each pairing its `-wash` ground with its `-teks` ink and a hand-picked hairline (`#a8cdb8`, `#e2c785`, `#e0b3a9`, `#d8c3a4`). `.tag--on-nila` is the on-cloth variant (white 0.14 on a 0.34 border). `.tag__dot` is a 6px `currentColor` square that inherits the tag's ink.
- **State:** none. A tag is a label, never a control. There is no selected, hover, or removable variant, and none should be added — filtering is done with buttons.

### Cards / Containers (`.panel`)
- **Corner style:** 4px (`--r-2`). **Background:** `kapas`. **Border:** 1px `garis`. **Shadow:** `--e1`.
- **Parts:** `.panel__head` (14/16px padding, `garis-2` bottom rule, title plus optional `.panel__sub` at 12px `tinta-2`, action on the right), `.panel__body` (16px), `.panel__foot` (12/16px, `kain` ground, bottom corners rounded, `garis-2` top rule).
- **`.panel--klowong`:** transparent ground, 1px dashed `nila-line`, no shadow. This is the draft container.
- **`.crown`:** an optional 14px band across the top of a panel — a 5px solid selvedge line plus the tumpal fringe below it, in indigo or `--soga`. Used on the sign-in panel and on the payslip's Pendapatan (indigo) and Potongan (soga) panels.
- **`.sub`:** a ruled sub-section inside a panel body (16px padding-top and margin-top over a 1px `garis` rule, zeroed on `:first-child`), with `.sub__head` for its title row. This exists so the system never nests a card in a card.

### Inputs / Fields
- **`.input` / `.select`:** full width, 48px min-height, 14px side padding, `kapas` ground, 1px `garis`, 4px corners, 15px `tinta`. Hover → `nila-line` border. Focus-visible → `nila` border *plus* a 2px `nila` outline at 1px offset. `.select` suppresses the native appearance and paints its own 18px chevron from an inline data-URI SVG at right 12px. `:disabled` → `kain-2` ground, `tinta-3` ink, not-allowed cursor.
- **Field wrapper:** `.field` with `.field__lab` (13px/600), `.field__hint` (12px `tinta-2`), and `.field__err` (12px/600 `merah-teks` with an alert icon) which is `display: none` until `.field.is-error` flips it to flex; the error class also repaints the input `merah` on a `#fffafa` ground.
- **`.affix`:** the unit-inside-the-frame pattern for Rp and %. The wrapper owns the border and the focus ring (`:focus-within`), the inner `.input` has its border and outline forcibly zeroed, and `.affix__unit` is a `kain` cell divided by a `garis-2` rule (`--after` flips the divider for a trailing unit).
- **`.check`:** a 22px stamp that inks when chosen — the native input is visually hidden, `.check__box` transitions ground and border over 140ms, and the tick (a `--i-check` mask) scales from 0 to 1 over 140ms. Ships unchecked / checked / focus-visible. **No indeterminate and no disabled state.**
- **`.choice`:** the 68px selection card (used for jenis usaha). Ships default / hover (`nila-line`) / checked (`nila` border, `nila-wash` ground, `inset 0 0 0 1px`) / focus-visible. **No disabled state.**
- **Absent across all fields:** no textarea styling, no read-only treatment, no success state, no character counter, no inline validation-on-blur (validation runs on submit, then clears per-field on input).

### Navigation
- **`.rail` (the selvedge):** indigo, 244px, `nila-on` ink, with `.rail__head` (64px, brand lockup), `.rail__nav`, and `.rail__foot` (org identity behind a 1px white-0.14 rule). `.rail-item` is 44px min-height, 4px corners, 15px/500 in `nila-on-2`; hover lifts to white-0.09 with `nila-on` ink; `[aria-current="page"]` **inverts** — `nila-on` ground, `nila` ink, weight 650. `.rail-item__count` is a kunyit badge with `#241800` ink. `.rail__sep` is a white-0.14 hairline.
- **`.topbar`:** sticky, 60px, `kapas`, `garis` bottom rule. Holds the drawer opener (mobile only), an ellipsizing `.topbar__title`, and up to two trailing controls.
- **`.bottomnav`:** mobile only, indigo, equal columns, 60px items at 11px/550 in `nila-on-2` with the icon stacked above the label; `[aria-current="page"]` inverts the same way the rail does; `.bottomnav__item--dot` carries a 7px kunyit pip.
- **`.scrim` + drawer:** see Layout. The drawer's accessibility behaviour is in Accessibility below.
- **`.link`:** the inline action — 13px/600 `nila-teks`, 4px/6px padding with negative margins so it does not disturb layout, hover fills `nila-wash`.

### Signature components

**The kain band (`.kain` + `.figs`).** The page head. Indigo ground, `.tenun` weave, `overflow: hidden`, an inner 1220px column, a 220px cap motif riding the right edge at 0.13 opacity (hidden below 768px), and always a `.kain__edge` tumpal beneath it. `.figs` is a warp-ruled grid — white-0.2 top rule, white-0.13 rules between cells — carrying `.fig__num`, `.fig__lab` (a `.lab--on-nila` label) and an optional `.fig__note`. This is the replacement for the KPI card row, and the rule is that figures sit *on* the cloth: no card, no tile, no panel inside the band.

**The register (`.reg`).** Attendance as a strip of stamps: 38×46px cells with a dyed field above a solid caption plate. Four states — `--hadir` (fully dyed indigo with the 45° weave), `--telat` (kunyit hatch at 2px-on/4px-off on `kunyit-wash`), `--izin` (soga dots on a 7px grid over `soga-wash`), `--absen` (dashed `merah` edge and nothing dyed — klowong). `.legend` mirrors all four with 15px keys built from the identical background declarations, so the legend cannot drift from the cells. Only `--hadir` and `--telat` appear in the current data.

**The isen bar (`.isen`).** Fill density as magnitude. A dotted 12px track (`nila-line` dots on a 5px grid) with a dyed fill carrying the 45° weave, plus `.isen__val` (12px/650, right-aligned, 34px min-width so the percentages align). `.isen__fill--kunyit` switches the dye when attendance falls below 90% — the threshold is stated in the panel sub-line, not just implied. `.bar` is the split-magnitude sibling: a 14px bordered strip of `--hadir` / `--telat` / `--izin` segments; absence is the un-filled remainder, so there is no absent segment.

**The woven table (`.tbl`).** `thead th` is indigo with `nila-on-2` ink in the label voice; `tbody` cells are 12/14px on `garis-2` rules with a `kain` row hover; `tfoot` is `kain-2` above a **2px** `nila` rule at weight 700. Money cells are `.money` (nowrap, tabular), `.money--minus` (`merah-teks`), `.money--total` (700). `.tbl__name` puts a cap stamp beside a two-line name/role. Row states: `.klowong` mutes every cell to `tinta-2`, dashes the stamp and prints the total in `nila-teks`; `.tercap` solidifies the stamp to full indigo, returns the ink to `tinta` and takes the total to weight 750; `.dyeing` runs the sweep. The narrow-screen equivalent is `.rows > li` + `.kv` / `.kv--total`, and it carries the same `.klowong` / `.tercap` classes.

**The seal (`.seal`).** 96px, circular, transparent — an SVG ring plus arc text plus a centred word, coloured entirely by `currentColor` so one hue value moves the whole mark. `--draft` is kunyit ink with a dashed 1.6 ring; `--tercap` is indigo ink with a solid 2.8 ring, rotated −7°. `--press` is the stamping animation. On dyed cloth it is overridden inline to a lightened dye (`#f0cf7e` draft, `#e0b884` approved).

**The status band (`.notis`).** The full-width state notice: 14/16px padding, 1px border, 4px corners, a 34px icon plate, a bold line and a 13px explanation, optionally a trailing tag. Three hues — `--kunyit` (draft, needs action), `--daun` (just succeeded), `--nila` (locked, informational). This is what the payroll stamp rewrites in place.

**The drenched block (`.drench`).** The take-home figure printed on fully dyed cloth: `.capfield` ground, 22px padding, a `.lab--on-nila` label, a display figure at 1.75 → 2.125 (640px) → 2.75rem (1280px), and an internal `<hr>` at white-0.22 above a `.kv` summary.

**The stepper (`.stepper` / `.step`).** Three 36px stamps joined by 3px rules. Default is `kapas` with `tinta-2` ink; `.is-now` inks the stamp indigo and haloes it with 3px of `nila-wash`; `.is-done` drops it to `nila-wash`/`nila-teks`, swaps the numeral for a check mask and fills the rule behind it with indigo. Labels are hidden below 768px and replaced by a "Langkah 1 dari 3 · Profil Usaha" line.

**The empty state (`.empty`).** 40/20px, centred, a 56px dashed cap holding the relevant icon, a 16px `h3`, 13px copy capped at 44ch that names the actual failed term, and two recovery actions (clear the search / add this person). Reachable for real by typing a name that is not in the roster.

**The shift band (`.shiftbar`).** A `.bar` at 22px height with a tumpal marker (`.shiftbar__now`, absolutely positioned by percentage) at the current hour and a `.shiftbar__ticks` row of five times beneath it. The whole band is `role="img"` with the elapsed time spelled out in its label.

### Absent by design
No modal or dialog component — the payroll commit is an inline confirm, and the only `role="dialog"` in the product is the mobile drawer. No toast or snackbar; feedback replaces the thing it is about (the notice is rewritten, the button becomes "Slip gaji tersimpan" for 2400ms and reverts). No tooltip. No skeleton or shimmer — the only loading affordance is the button spinner. No accordion, no tab component (the viewer's tabs are buttons swapping classes), no image avatar (initials only), no chart primitive of any kind.

## Do's and Don'ts

### Do:
- **Do** let indigo own whole regions. A new dyed surface takes the ground, the `nila-on`/`nila-on-2` ink pair, and its own tumpal edge.
- **Do** end every dyed region with a triangle band: `.kain__edge` under a band, `.crown` on top of a panel, `.tumpal` (with its hue variant) above a called-out region.
- **Do** ship a data state as a complete set: the `-wash` ground, the `-teks` ink, the hairline border, the `.tag--*` variant, the `.legend__key--*` if it appears in a register, and the screen-reader text.
- **Do** keep radii at 2px and 4px, and take spacing from the six-step gap scale.
- **Do** set `white-space: nowrap` on any rupiah figure and step the type down (`.fig__num--money`) rather than letting it break.
- **Do** use `.lab` — 11px, 650, 0.09em, uppercase — wherever a micro-label is needed, including table heads.
- **Do** transition state with `--dur` and `--ease` only.
- **Do** carry any state that a pattern encodes visually in `.sr` text or an `aria-label` as well, the way every register cell and every bar does.
- **Do** author the wide table and the narrow stacked list as two real blocks and swap them at 768px with `md:show` / `md:hide`.

### Don't:
- **Don't** use a pill radius or a circle for anything but a seal or a spinner. A stamp has edges.
- **Don't** add a monospace family, a second family, or a sixth `wdth` value without a stated reason.
- **Don't** build a row of equal white KPI cards. Figures go on the cloth, in `.figs`.
- **Don't** use a shadow to separate regions — that is what dye and a 1px `--garis` rule are for.
- **Don't** reach for a chart. Magnitude is `.isen` fill density, `.bar` segments, or a register of stamps.
- **Don't** put a modal in the way of a commit. Confirmation is inline, in place, in the flow.
- **Don't** give an existing hue a second meaning, or introduce a hue that duplicates a meaning already owned.
- **Don't** nest a panel inside a panel — use `.sub`.
- **Don't** add a dark theme or a cream ground; the light cool ground is a decision about tropical glare on a mid-range Android, not a taste.
- **Don't** use an emoji or an icon font. Icons are CSS masks.

## Icons

27 icons, all authored SVG delivered as **CSS masks**: `.ico` is a 20px inline block whose `background-color` is `currentColor` and whose `mask-image` is a `--i-*` custom property (both prefixed and unprefixed properties are set for `mask-repeat`, `-position`, `-size` and `-image`). Because the glyph is a mask, an icon always takes the ink of its context — including the on-cloth and inverted cases — with no per-context override. Sizes: `.ico--sm` 16px, default 20px, `.ico--lg` 22px.

**The stroke spec** is one canting weight: `stroke-width: 1.75` with `stroke-linecap="round"` and `stroke-linejoin="round"` on a 24×24 viewBox. Four glyphs step up to 1.9 because they are pure strokes with no enclosing shape (`check`, `x`, `left`, `right`), and `more` is the one fill-only glyph (three 1.7r circles).

**To add one:** author it at 24×24 with `fill="none" stroke="%23000" stroke-width="1.75"` and round caps and joins (the stroke colour is irrelevant — only the alpha survives the mask); URL-encode it into a single `--i-<name>` declaration in the second `:root` block at the end of section 5; add `.ico-<name> { -webkit-mask-image: var(--i-<name>); mask-image: var(--i-<name>); }` alongside its siblings in the same section; use it as `<span class="ico ico-<name>" aria-hidden="true"></span>`. Never inline an SVG for a UI icon. Real inline SVG is reserved for the three marks that carry multiple colours, opacities or text and cannot be a mask: the brand lockup, the `.kain__motif`, and the `.seal`.

## Accessibility

These are part of the system, not incidental to a page.

- **The drawer behaves as a dialog only while it is one.** `initDrawer()` adds `role="dialog"`, `aria-modal="true"` and `aria-label="Navigasi utama"` on open and **removes all three on close**, because at ≥1024px the same element is a permanent rail and must not claim to be a dialog. Opening moves focus to the rail's own close button; closing returns it to the opener. Every opener carries `aria-expanded` and `aria-controls="rail"`. `Escape` closes. `Tab` is trapped: the handler collects `a[href], button:not([disabled])` inside the rail, pulls focus in if it has escaped, and wraps at both ends (Shift+Tab from the first goes to the last). While closed the rail is `visibility: hidden`, which takes it out of the tab order without removing it from the flow — the 220ms `visibility` transition delay is what lets it stay visible during the slide-out.
- **`[hidden] { display: none !important }`** is the last display rule in the stylesheet (line 1049), and it has to be. The layout layer ships `.flex`, `.grid` and `.rows > li` display rules, and `.md\:show { display: revert !important }` — all of which out-rank a UA `[hidden]` rule on the very elements the JS toggles (`#tabelKaryawan` and `#listKaryawan` carry `md:show`/`md:hide`, the wizard's steps and the payroll's confirm/done bars are flex or panel blocks). Equal specificity plus `!important` plus last declaration is what makes `hidden` actually hide. **Any new display rule must go above that line.**
- **Screen-reader text carries what pattern alone encodes.** Each `.reg__cell` holds `<span class="sr"> — Budi Santoso, hadir, masuk 06.52</span>` behind the visible initials, so the dye/hatch/dot/dash distinction is not the only channel. `.bar` and `.shiftbar`'s bar are `role="img"` with a full sentence label ("10 hadir tepat waktu, 2 telat, 0 izin, 0 absen"). `.cap--date` marks its two visible lines `aria-hidden` and supplies the full date in `.sr`. `.sr` itself is the standard 1px clip pattern.
- **Table semantics are real.** `<caption class="sr">` on both tables, `scope="col"` on every head, the person cell as `<th scope="row">`, subtotals in `<tfoot>`, and the horizontal scroll contained by `.tblwrap` rather than the page.
- **Forms.** Every control has a label — `.sr` where the field is visually self-evident (the roster search, the payroll period select). `initSignIn()` marks failures with `aria-invalid`, adds `aria-describedby` pointing at the error **only while the field is failing** and removes it on recovery, moves focus to the first failing field, and the error text carries `role="alert"`. The form is `novalidate` so the page owns its messages, and each field clears its own error on input.
- **Live regions.** The roster's result line (`#hasil`) is `aria-live="polite"` and is rewritten with a full sentence on every keystroke and filter change. The payroll notice is `role="status"`. The post-stamp receipt has `tabindex="-1"` and takes focus, so the outcome is announced and reachable.
- **Focus is always visible and always contrasting.** Global `:focus-visible` is a 2px `--nila` outline at 2px offset with a 2px radius; inside `.kain` or `.on-nila` it switches to `--kunyit`. Inputs and the affix wrapper add a border change on top of the ring.
- **Targets.** `--tap: 48px` on buttons, icon buttons, inputs, selects and checkbox rows; 44px floors on rail items and the pager's overridden arrows; 60px bottom-nav items.
- **Print.** `@media print` drops the rail, top bar, bottom nav and anything marked `.noprint`, unsets the main's left padding and whitens the ground — a payslip prints as a document.

## Extending the system

**To add a page.** Copy an existing page's `<head>` verbatim: `charset`, viewport, `theme-color="#16244c"`, the two font preconnects, the Archivo `css2` link, then `assets/kk.css`. Put the direction-contract comment (THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM / FINISH) at the top of `<body>` — every page has one and the THESIS line must name what *this page* refuses. Then either the rail shell (`.scrim` → `.shell` → `.rail#rail` → `.main.pagepad` → `.topbar` → `.kain.tenun` + `.kain__edge` → `<main class="wrap section">`, with `.bottomnav.only-mobile` after `.shell`) or the solo shell (`.main.main--solo`, no rail, no scrim). Repeat the nav items in both the rail and the bottom nav with `aria-current="page"` on the right one in each. `assets/kk.js` goes last; it feature-detects by looking for the page's anchor element, so a new page costs nothing until it needs behaviour, and new behaviour goes in as an `initX()` guarded by a single `if (!el) return;` and registered in the `DOMContentLoaded` list.

**To add a component.** Append it to `assets/kk.css` as a new numbered section, keeping the existing order (tokens → base → batik primitives → cap → icons → shell → kain → panels → buttons → forms → tags → register → isen → table → seal → notice → drench → stepper → empty → utilities → layout layer) and keeping anything display-related above line 1049. Name it for the mechanism, in the world's vocabulary, when it is one of the world's mechanisms; otherwise use plain Indonesian (`notis`, `garis`, `kapas`, `kunyit`) the way the rest of the file does. Structure classes as `block`, `block__element`, `block--variant`. Take colour only from the tokens, radius only from `--r-1`/`--r-2`, transitions only from `--dur`/`--ease`, and ship the full state set in the same commit: hover, focus-visible, active or checked, disabled, loading, error and empty — whichever of those the component can actually be in. Then say in this file which ones it does not have.

**To add a data state.** Choose the hue by the meaning it already owns, never by appearance. If the meaning is genuinely new, add a full trio to section 1 (`--x`, `--x-wash`, `--x-teks`), pick the hairline border to match the existing pattern (a mid-tone between wash and base, as `#e2c785` is for kunyit), then add the `.tag--x` variant, the `.notis--x` variant if it can be a page-level state, the `.legend__key--x` and cell rule if it appears in a register, and the `.fig__note--x` lightened variant if it can appear on cloth. The lightened on-cloth variant is not optional — the base dyes are unreadable on indigo.

**What would break the world.** A pill radius. A circular avatar. A monospace or second family. Four equal white KPI cards. A shadow doing a job dye should do. A modal in front of the payroll commit. A donut, ring or line chart. An emoji or icon-font glyph. A dark ground or a cream one. A second choreographed animation. A colour taking a meaning another colour already owns. Any of those and the prototype stops being distinguishable from the other three in this repo, which is the one thing it exists to be.

## Known limits and open decisions

1. **Archivo is CDN-only.** Every page loads `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900` and nothing is self-hosted. Opened offline from `file://` — the exact scenario the no-build-step decision was made for — the pages fall back to Segoe UI / `system-ui`, every `font-variation-settings` declaration becomes inert, and **both widths collapse into one**: the display voice becomes the data voice and the type system loses its only axis of distinction. Self-hosting two static instances (or one variable file) in `assets/` would close this; it has not been done.
2. **Static demonstration data, no backend.** No real authentication, no persistence, no network. Every commit is a `setTimeout` of 620–800ms and every navigation is a `location.href` assignment. The names, figures and dates are carried over from `frontend/prototype/` and extended where this world needed more of them (the twelve-person register, 30-day per-person attendance, the shift band's elapsed time).
3. **One unverified commercial claim.** `02-auth-sign-in.html` line 61 reads "Lebih dari 2.000 usaha kecil". It is inherited verbatim from the original prototype rather than silently rewritten, and this build cannot check it. Confirm it or cut it.
4. **The stack deviates from PRODUCT.md deliberately.** PRODUCT.md records "Static HTML + Tailwind CDN"; this folder ships one plain stylesheet and its own small layout layer (section 21) instead. The load-bearing half of that decision is kept — no build step, opens straight from the file system — and the reason for the other half is concrete: this world depends on SVG pattern fills, tumpal bands and CSS-mask icons, and a runtime-injected Tailwind preflight can reorder itself underneath those at load time. One stylesheet gives a deterministic cascade at the same zero build cost. PRODUCT.md has not been amended.
5. **The stylesheet's own comment overstates the width axis.** Section 1 says "Archivo carries display at `wdth 125` and data at `wdth 100`". No rule in the file uses 125; the shipped values are 118, 116, 112, 108 and an explicit 100. The README's "wdth 118 for display, normal for data" is the accurate description. The comment should be corrected, not the code.
6. **Declared and unused.** `--r-0`, `--r-3` and `--t-md` are declared as tokens but referenced by no page. `.tumpal--soga` exists with no instance. `.reg__cell--izin` and `.reg__cell--absen` are fully specified and appear in the legend, but the demonstration data contains only `hadir` and `telat`, so two of the four register states have never actually been seen on screen. Either give them an instance or accept that they are untested.
7. **The double-authored roster is a real maintenance cost.** Because each person exists twice (table row plus card row), `initDirectory()` derives its counts as `rows.length / 2`. Adding a person to only one of the two lists silently halves or skews the "x dari y karyawan" line. A comment in the JS says so; nothing enforces it.
8. **Absence has no positive mark in the split bar.** `.bar` ships `--hadir`, `--telat` and `--izin` segments; absence is the un-dyed remainder. That is right on the cloth metaphor and fine while the register sits beside the bar, but if the bar is ever used alone, absence becomes indistinguishable from "no data".
9. **The drench block's focus ring is under-contrasted.** The kunyit focus ring is scoped to `.on-nila :focus-visible, .kain :focus-visible`. `.drench.capfield` is a dyed indigo region that is inside neither, so `.btn--terang` and `.btn--ghost` on the payslip and the onboarding summary receive the default 2px `--nila` ring on an indigo ground. Adding `on-nila` to those two blocks, or widening the selector to `.capfield :focus-visible`, would fix it.
10. **The seal's SVG arc uses a fixed `id="arc"`.** One seal per page is the current truth, so it works. Two seals on one page would collide on that id and both arcs would follow the first path.
