# KaryawanKu — prototype `Cap & Kain`

A full replacement of the visual world in `frontend/prototype/`, built to be opened
side by side with it (and with `prototype-promax/` and `prototype-hallmark/`).
Same seven screens, same filenames, same product truth. Different world.

Open `index.html` in a browser. No build step, no server, no dependencies beyond
one Google Fonts request.

## The world

Javanese **batik cap** — the copper stamp — and the **kain panjang** cloth layout,
used as structure rather than ornament. Every term below is load-bearing in the code:

| Term | What it does in the interface |
|---|---|
| **cap** | The repeat module. One stamp per person: avatars, nav markers, date blocks, the approval seal. Square, carved corners, never a circle. |
| **kain** | The dyed indigo band that heads every page and carries that page's figures directly on the cloth, instead of four identical KPI cards. |
| **tumpal** | The triangle border band that edges a region. Indigo for structure, kunyit for "needs your decision", soga for deductions. |
| **klowong** | The outline drawn before dyeing = **draft**. Payroll rows start here. |
| **tercap** | Stamped and dyed = **approved and locked**. |
| **isen** | Fill density = magnitude. Attendance rate, present/late/absent state. |
| **selvedge** | The finished cloth edge = the navigation rail. |

**Palette.** Kerokan-pale cool ground `#edf0f5` (undyed cotton scraped pale over
indigo — not cream). Indigo `#16244c` owns whole regions rather than accenting them.
Soga brown `#8a5a2b`, merah cabe `#b5301c`, kunyit `#c08a12` and daun `#1f6b45`
carry data roles. Light, not dark, because the real scene is a warung counter at
08:00 with an open shopfront and a mid-range Android in tropical glare.

**Type.** Archivo only, at two widths — `wdth 118` for display, normal for data,
with real tabular figures. Deliberately **no monospace**: tracked small caps do the
label work, because mono micro-labels are the lane `prototype-hallmark` already owns.

**Corners.** 2–4px, never pills. A stamp has edges.

## Try these

| Screen | What actually works |
|---|---|
| `06-payroll-run.html` | Draft rows render as klowong outline. Press **Cap & setujui payroll** → inline confirm (no modal) → the seal presses, the rows dye left to right, the run locks and the action bar becomes a receipt. This is the one authored motion moment in the system. |
| `05-employee-directory.html` | Search and status filters really filter. Type a name that is not there to reach the real empty state. |
| `02-auth-sign-in.html` | Submit the form empty for real per-field error states with recovery copy. Password reveal toggles its own icon and label. |
| `03-quick-dashboard-owner.html` | Today's attendance is a register of twelve cap squares — fully dyed = present, kunyit hatch = late, soga dots = excused, dashed outline = absent. No donut chart. |
| `04-quick-dashboard-employee.html` | The shift is a band of cloth filled to the current hour with a tumpal marker at now. Clock out moves the whole page to its finished state. |
| `01-onboarding-wizard.html` | Three steps, stamps inking as they complete, ending on the take-home the owner just defined. |

Keyboard and pointer states, focus rings, loading, disabled, error and empty states
are all present. `prefers-reduced-motion` collapses every transition and the dyeing
sweep to an instant state change.

## Files

```
index.html                        viewer: 7 tabs, 4 viewport widths
01-onboarding-wizard.html         owner setup, 3 steps
02-auth-sign-in.html              sign in
03-quick-dashboard-owner.html     owner: register + leave decisions
04-quick-dashboard-employee.html  employee: shift band + schedule
05-employee-directory.html        roster, search, filter, empty state
06-payroll-run.html               payroll run + the stamp
07-payslip-detail.html            payslip
assets/kk.css                     tokens, batik primitives, components, layout layer
assets/kk.js                      shared behaviour, feature-detected per page
```

`assets/kk.css` is the whole design system: primitive and semantic tokens, the
batik primitives (tumpal, cap field, isen, register, seal, crown), every component
with its full state set, and a small layout layer.

## Notes on the stack

`PRODUCT.md` records "static HTML + Tailwind CDN". This folder keeps the
load-bearing part of that decision — no build step, opens straight from the file
system — but drops the Tailwind Play CDN in favour of one stylesheet. The reason is
concrete: this world needs SVG pattern fills, tumpal bands and CSS-mask icons, and
a runtime-injected preflight can reorder itself underneath those at load time. One
stylesheet gives a deterministic cascade at the same zero build cost.

Icons are authored SVG delivered as CSS masks — one canting stroke weight (1.75,
round caps) across the set. No icon font, no emoji.

## Data

All names, figures and dates are demonstration data carried over from
`frontend/prototype/`, extended where the world needed more of it (the twelve-person
register, per-person 30-day attendance, the shift band's elapsed time). There is no
backend and no real authentication.

**One item for you to verify or replace:** the sign-in panel carries
"Lebih dari 2.000 usaha kecil" from the original prototype. It is a commercial claim
this build cannot check, kept verbatim rather than silently rewritten. Confirm or cut it.

The compliance references (BPJS Kesehatan 1%, BPJS Ketenagakerjaan 2%, PPh 21
progressive on PTKP) are shown as the original prototype stated them and are
illustrative, not tax advice.
