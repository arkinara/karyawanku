# KaryawanKu Mobile (Flutter)

Phase 2 native mobile app — employee self-service. Front end only: every screen
runs off fixtures in `lib/data/mock_data.dart`; nothing talks to `backend/` yet.

Built from the Claude Design doc `KaryawanKu Mobile.dc.html`, option **1b
(Android / Material 3)** — M3 top app bars, tonal containers, pill buttons, an
80 dp navigation bar with a pill indicator. Clock-in uses **direction A
(geofence card)**, the variant shown in both 1a and 1b; directions B
(slide-to-clock) and C (map-first with live queue) are not built.

## Screens

| Route | Source | Notes |
|---|---|---|
| `MasukScreen` | 1b Masuk | Outlined fields, biometric secondary action, offline notice |
| `BerandaScreen` | 1b Beranda | Shift hero, three tonal shortcuts, next shifts, latest payslip |
| `AbsensiScreen` | 1b Absensi / 1c | Wall clock, geofence chip, selfie slot, today's timeline, month stats |
| `CutiScreen` | 1a Cuti | Balances, status filter, request history with status rail |
| `AjukanCutiScreen` | 1b Cuti · ajukan | Type chips, date range, impact banner, attachment slot |
| `SlipGajiScreen` | 1b Slip Gaji | Latest payslip hero, year filter, history incl. THR |
| `SlipDetailScreen` | 1a Slip Gaji | Take-home, earnings, BPJS/PPh 21 deductions |
| `JadwalScreen` | 1a + 1b Jadwal | Week strip or month calendar, today's shift, upcoming |

`JadwalScreen` is pushed from Beranda rather than occupying a fifth navigation
destination, matching the design doc's four-tab bar.

## Design tokens and theming

The palette, shape scale, motion rhythm and elevation are **mirrored from the
web app** — source of truth `frontend/src/app/globals.css` (itself a mirror of
`prototype-promax/assets/kk.css`). `lib/theme/tokens.dart` holds the same HSL
triplets converted to sRGB, for both light and dark. The web already ships a
designed dark token set, so mobile dark is not derived or invented.

`test/token_parity_test.dart` parses `globals.css` and fails if any of the 61
mirrored values drift. Change a colour on the web, and the mobile suite tells
you to re-sync.

| Layer | Web | Mobile |
|---|---|---|
| Colour | `--primary`, `--surface-*`, `--success`… | `Palette` → `ColorScheme` + `StatusColors` |
| Shape | `--r-xs … --r-full` (4/8/12/16/20/999) | `Shape.rXs … Shape.pill` |
| Motion | `--d-fast/base/slow`, `--ease-*` | `Motion.fast/base/slow`, `Motion.standard/emphasized/exit` |
| Elevation | `--e1 … --e4` | `context.status.elevation(1..4)` |
| Type | Inter | Inter (`assets/fonts/InterVariable.ttf`) |

Two accents, same split as the web: **teal** is primary action, **amber**
(`context.accent`) is reserved for things awaiting a decision — a pending leave
request, a leave-blocked shift. `status.warning` stays for things that are
wrong, like the offline queue. They are close in hue but never mean the same
thing.

Screens read colour through `context.colors` / `context.status` / `context.accent`
and type through `context.texts` — never `Palette.*` directly, which is what
keeps both themes honest.

Type sizes are the mobile ramp, not the web's: 15 px body suits a desktop
column and is under the 16 px floor that stops iOS auto-zooming a form. Weights
(including the web's in-between 550/620/650, which the variable font preserves),
tracking, line-height and the tabular-figure rule come straight from the web.

Indonesian-first formatting lives in `lib/core/format.dart`: `Rp` with dot
thousands, `DD/MM/YYYY`, Bahasa Indonesia day and month names, and tabular
figures for every number that can change.

## Accessibility and resilience

Enforced by tests, not by convention:

- **Contrast** — every foreground/background pair reaches 4.5:1 in both themes.
  `outline` is a border token: at 2.9:1 it fails as text, so muted copy uses
  `onSurfaceVariant` (5.8:1 light, 8.9:1 dark), the web's own muted-text token.
- **Tap targets** — 48 dp minimum on every control. Chips and day cells keep
  their 32 dp look but are padded out to a full-size touch area.
- **Labels** — every icon-only button has a tooltip; cards, tiles and the shift
  hero carry a single composed semantic label instead of reading out as loose
  fragments. Decorative marks (status dots, day tokens) are excluded.
- **Card boundaries** — cards carry the web's `e1` shadow as well as the
  hairline. `outline-variant` alone is 1.3:1 against the card fill, which is
  invisible in dark mode; the shadow is what actually separates the layers.
- **Large text** — `test/stress_test.dart` renders all eight screens at 1.0×,
  1.5× and 2.0× text scale, at 320 dp and 412 dp, in both themes (96 cases).
  Rows that cannot survive the growth switch to a stacked layout past
  `context.isLargeText`.
- **Empty states** — leave filters, payslip year filters and rest days explain
  themselves rather than rendering a blank region.

## Commands

```
cd mobile
flutter pub get
flutter run              # attached device or emulator
flutter run -d chrome    # quickest way to compare against the design doc
flutter analyze
flutter test                            # 119 tests
flutter test test/token_parity_test.dart # mobile palette == web globals.css
flutter test test/a11y_test.dart         # tap targets, labels, contrast x theme
flutter test test/stress_test.dart       # text scale x width x theme matrix
```

## Not yet wired

Real auth, the shifts/attendance/leave/payroll APIs in `backend/`, geolocation,
camera capture, push notifications, the offline queue, and the home-screen
widget. The five mobile-only capabilities appear as UI states only.
