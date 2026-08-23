# KaryawanKu — prototype (Hallmark revision)

A revamp of `frontend/prototype/`, built side by side so the two can be compared directly.
Same content, same information architecture, same rupiah figures. Different design system.

Open `index.html` — it has a screen switcher, a viewport toggle (320 / 768 / 1440 / full), and the
full index of screens underneath.

## What the design system is

**Route:** custom (tuned), Cobalt register — the cool, hairline-structured, instrument-panel school.
**Tone:** utilitarian. Dense, calm, ledger-like. Numbers are the hero.

| | |
|---|---|
| Vibe | *ledger precision, cool teal, hairline utility* |
| Paper | `oklch(98.6% 0.004 195)` — cool near-white, never `#fff` |
| Ink | `oklch(21% 0.016 210)` — cool charcoal, never `#000` |
| Accent | `oklch(45% 0.108 178)` — the existing KaryawanKu teal, re-anchored in OKLCH |
| Graphite | `oklch(24% 0.018 205)` — the one dark beat, used on the payslip take-home panel and the sign-in side |
| Display | Space Grotesk 500/600 |
| Body | IBM Plex Sans 400/500/600 |
| Mono | JetBrains Mono — every rupiah figure, every count, every table column head |
| Axes | light / grotesk-sans / chromatic-teal (~178°) |

The brand teal was **kept on purpose**. A revamp that changes the brand colour isn't comparable to the
thing it replaces — so the palette, type, and surface language moved, and the brand anchor did not.

## Files

```
tokens.css   every colour, font, space, radius, easing, duration, z-level — portable, no page rules
app.css      the whole design system: shell, ledger tables, buttons, fields, palette, dark band
app.js       the ⌘K command palette (the only shared behaviour)
index.html   viewer + screen index + change log
01–07        the seven screens
```

Page-specific behaviour (the onboarding stepper, the password toggle, the viewer) is inline in its page.
There is no build step and no CDN framework — open any file directly.

## Structure

- **Scope:** app-shell, not marketing. The seven screens are product surfaces, so no landing-page
  macrostructure applies. `index.html` is the exception — it uses **Index-First** with an **Ft2** inline
  footer.
- **Nav:** **N3 side-rail** on desktop, bottom tab bar under 1024px, and an **N13 inline ⌘K pill** in the
  top bar. The palette actually works — click it or press ⌘K / Ctrl+K, type to filter, arrows to move,
  Enter to open, Esc to close.
- **Surfaces:** hairlines, not cards. No nested card-in-card, no drop shadows except one soft lift on the
  command palette. The stat strips are 1px grid gaps over a rule-coloured background, so every divider is
  exactly one hairline with no doubling.
- **Numerals:** JetBrains Mono with `tabular-nums` on every figure. Dates and IDs inside data columns are
  mono; dates inside running prose are body type.
- **Payslip:** dotted-leader rows, the way a printed slip reads. Take-home sits in the graphite panel.

## Motion budget — three primitives, total

1. `load-reveal` — one orchestrated page entrance, 420ms, `--ease-out`
2. `press` — 1px `translateY` on button `:active`, 120ms
3. `palette-open` — fade + 8px rise on the ⌘K overlay, 220ms

`prefers-reduced-motion: reduce` collapses all of it. Focus rings never animate — they appear instantly.

## Component states

Every interactive element ships all eight: default · hover · `:focus-visible` · active · disabled ·
loading (`data-state="loading"`) · error (`data-state="error"` / `aria-invalid`) · success
(`data-state="success"`). See `app.css` §9 and §10.

## Responsive

Verified at **320 / 375 / 414 / 768 / 1440**. No horizontal scroll — `overflow-x: clip` on both `html` and
`body`, never `hidden`. Clickable text never wraps to two lines. Rupiah figures use a fluid clamp so a
nine-digit number never overruns its cell at 320px. Grid tracks that hold content use `minmax(0, 1fr)`.

## What changed from `frontend/prototype/`

| | Before | After |
|---|---|---|
| Colour model | HSL | OKLCH |
| Type | Inter for everything | Space Grotesk + IBM Plex Sans + JetBrains Mono |
| Surfaces | border + shadow + radius on every card, nested | hairlines, one containment layer |
| CSS | `cdn.tailwindcss.com` + inline config per page | token file + hand-written stylesheet |
| Motion | none | three primitives + reduced-motion |
| States | hover only | all eight, on every control |
| Navigation | rail + bottom nav | rail + bottom tabs + working ⌘K palette |
| Rupiah figures | — | **unchanged** |

### Two content corrections

1. **Invented metric removed.** The old sign-in page claimed *"Lebih dari 2.000 usaha kecil"*. There is no
   data behind that number, so the claim is gone and the panel was rebuilt without a proof slot — it now
   shows a labelled sample of the product's own payroll view instead.
2. **Job titles normalised.** The old prototype contradicted itself across screens. The employee directory
   (`05`) is treated as the source of truth:

   | Person | Directory (05) | Old payroll (06) | Old payslip (07) |
   |---|---|---|---|
   | Budi Santoso | Kepala Barista | Barista | — |
   | Siti Nurhaliza | Kasir | Kasir | Barista |
   | Ahmad Fauzi | Barista | Pramusaji | — |
   | Rudi Hermawan | Kasir (nonaktif) | Barista | — |

   No monetary value was altered.

## Known prototype limits

- Filters, search, and sort are visual only — nothing is wired to data.
- Pages 01 and 02 are standalone (no shell), which is correct for onboarding and auth.
- `Absensi`, `Shift`, and `Pengaturan` are `href="#"` — those screens don't exist in the seven.
