# KaryawanKu Mobile (Flutter)

Phase 2 native mobile app — employee self-service. Sign-in, session restore and
sign-out talk to the Fastify BE in `backend/`; attendance (ticket #63), the
shift schedule (ticket #64) and the leave screens (ticket #65) are wired to the
real endpoints. The remaining domain (payslip) still runs off fixtures in
`lib/data/mock_data.dart` until its per-domain MOB ticket lands.

Built from the Claude Design doc `KaryawanKu Mobile.dc.html`, option **1b
(Android / Material 3)** — M3 top app bars, tonal containers, pill buttons, an
80 dp navigation bar with a pill indicator. Clock-in uses **direction A
(geofence card)**, the variant shown in both 1a and 1b; directions B
(slide-to-clock) and C (map-first with live queue) are not built.

## Screens

| Route | Source | Notes |
|---|---|---|
| `MasukScreen` | 1b Masuk | Outlined fields, biometric secondary action, offline notice |
| `BerandaScreen` | 1b Beranda | Live shift hero, three tonal shortcuts, next shifts, latest payslip |
| `AbsensiScreen` | 1b Absensi / 1c | Live wall clock, status + elapsed hero, today's timeline, month stats |
| `CutiScreen` | 1a Cuti | Balances, status filter, request history with status rail |
| `AjukanCutiScreen` | 1b Cuti · ajukan | Type chips, date range, impact banner, attachment slot |
| `SlipGajiScreen` | 1b Slip Gaji | Latest payslip hero, year filter, history incl. THR |
| `SlipDetailScreen` | 1a Slip Gaji | Take-home, earnings, BPJS/PPh 21 deductions |
| `JadwalScreen` | 1a + 1b Jadwal | Week strip or month calendar, today's shift, upcoming |

`JadwalScreen` is pushed from Beranda rather than occupying a fifth navigation
destination, matching the design doc's four-tab bar.

## Auth, networking and secure token storage (ticket #62)

`lib/core/api/api_client.dart` is the single typed client over Dio. It owns the
base URL, adds `Authorization: Bearer <jwt>` to every authenticated request, and
maps BE error envelopes (`{ error: { message, details } }`) into typed
exceptions — `ApiException` (validation/business), `NetworkException`
(timeout/offline) and `UnauthorizedException` (session loss) — so screens can
tell "email atau sandi salah" apart from "device offline".

Session lifecycle lives in `lib/core/auth/auth_provider.dart` (Riverpod):

- `POST /auth/sign-in` stores the token pair + user and routes to the shell only
  on success.
- Cold start restores the stored session and verifies it with `GET /auth/me` —
  a valid session skips the sign-in screen.
- A 401 triggers exactly one `POST /auth/refresh`; a second failure signs the
  user out with a "sesi berakhir" notice and bounces to `MasukScreen`.
- `POST /auth/sign-out` revokes, and local state is cleared even when the call
  fails.

Tokens live in `lib/core/auth/secure_session_store.dart`, backed by
`flutter_secure_storage` — the iOS Keychain and Android
EncryptedSharedPreferences (Keystore-backed AES). They are never written to
plaintext SharedPreferences or files. Keys: `kk_access_token`, `kk_refresh_token`,
`kk_user`. A storage read failure (e.g. a restored backup on a new device) is
treated as signed-out, not a crash.

### Running against the local BE

```
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3001
```

A build pointed at staging needs no code change:

```
flutter run --dart-define=API_BASE_URL=https://staging.example.com
```

Notes:

- `flutter_secure_storage` requires a **real device or emulator** — it does not
  work on web (`flutter run -d chrome` will not be able to persist a session).
- Token storage deliberately differs from the web client: there is no
  `localStorage` equivalent on mobile that is safe for a JWT, so the mobile app
  uses the platform Keychain/Keystore instead of `kk-token` in localStorage.

## Attendance (ticket #63)

`AbsensiScreen` and the `BerandaScreen` shift hero are driven by
`lib/features/absensi/attendance_provider.dart` (Riverpod), which talks to the
BE through `lib/data/repositories/attendance_repository.dart`. Everything flows
through the one `ApiClient` from #62 — no screen touches HTTP.

Endpoints used (`backend/src/routes/attendance.ts`):

| Method | Path | Purpose |
|---|---|---|
| `GET /attendance/today` | today's record | Timeline + hero state |
| `POST /attendance/clock-in` | open the day | `submission_method: 'live'` |
| `POST /attendance/clock-out` | close the day | `submission_method: 'live'` |
| `GET /attendance/aggregate/:employeeId?period=YYYY-MM` | month totals | The mobile interface keeps a `year` + `month` pair and formats it to the BE's `period` string |

Behaviour contract:

- **Clock-in time is server-authoritative.** The device sends its UTC instant
  as `client_timestamp` (a drift-review claim only); the elapsed figure is
  computed from the server's `clock_in` field, never the device clock. The wall
  clock ticks from the device clock for display, but it never drives state.
- **Late and overtime are never recomputed on the client.** `late_minutes` and
  `overtime_minutes` come from the API and render verbatim.
- **Live state on mount + resume.** `AbsensiScreen` loads today + the aggregate
  on mount and again when the app returns to the foreground
  (`AppLifecycleState.resumed`), so the day rolls over correctly.
- **The primary button follows the record**: "Clock In" before any
  `clock_in`, "Clock Out" while on shift, and hidden once `clock_out` exists.
  It is disabled with a spinner while a write is in flight (double-tap proof).
- **Failures.** A load failure renders an error card with retry — never an
  empty timeline presented as "no activity". Server rejections (409 already
  clocked in, 422 no shift, 403 no linked employee) surface their Bahasa
  message verbatim as a snackbar.
- **Beranda hero** shows "Belum Clock In" + a Clock In CTA (opens the Absensi
  tab) before the first clock-in, a live elapsed figure while on shift, and the
  clock-in → clock-out total once finished. There is deliberately no progress
  bar: the shift schedule is a separate endpoint and a zero-length shift must
  never render a meaningless bar.
- **Geofence and selfie** remain static placeholders; the offline queue
  (`submission_method: 'offline_queue'`) is a separate ticket — live
  submissions only.

## Shifts (ticket #64)

`JadwalScreen` and the Beranda "Jadwal 3 hari ke depan" list are driven by
`lib/features/jadwal/shift_provider.dart` (Riverpod), which talks to the BE
through `lib/data/repositories/shift_repository.dart`. Leave-blocked days come
from real leave requests via `lib/data/repositories/leave_repository.dart`. All
of it flows through the one `ApiClient` from #62 — no screen touches HTTP, and
the signed-in employee is resolved server-side from the JWT.

Endpoints used (`backend/src/routes/shift-assignments.ts`,
`backend/src/routes/leave-requests.ts`):

| Method | Path | Purpose |
|---|---|---|
| `GET /shift-assignments?start=&end=` | roster for a visible range | Week strip + month grid |
| `GET /shift-assignments/upcoming?days=3` | next-days roster | Beranda "Jadwal 3 hari ke depan" |
| `GET /leave-requests?limit=100` | leave request dates | Amber "Cuti" marks on the calendar |

Behaviour contract:

- **Only published roster.** The BE filters `published = true` for employee
  roles on both endpoints, so a draft never leaks into the app. The mobile
  renders whatever the API returns verbatim — shift name and times come from
  the server, never inferred client-side. (The BE roster carries no role or
  branch fields, so the detail card stops at shift name + times.)
- **Calendar navigates by the device clock.** "Today" and the initial week and
  month come from `DateTime.now()` — there is no fixture date. The month view
  pages forward/back with its own arrows and fetches the range it displays.
- **Ranges are cached, not refetched.** The provider memoizes every
  `(start, end)` tuple it successfully fetches; paging back to an already-loaded
  month is a no-op. A failed fetch is *not* cached, so retry refetches, and the
  failure surfaces as a snackbar with a "Coba lagi" action — the calendar keeps
  whatever it already rendered instead of blanking.
- **Rest days and leave.** A day with no assignment renders the existing "Libur"
  state. Days covered by a pending or approved leave request are marked amber
  ("Cuti") from real leave request dates.
- **Empty states.** An employee with no published roster sees an explanatory
  empty state on both Beranda and the schedule — never a blank grid.

## Leave (ticket #65)

`CutiScreen` and `AjukanCutiScreen` are driven by
`lib/features/cuti/leave_provider.dart` (Riverpod), which talks to the BE
through `lib/data/repositories/leave_repository.dart`. All of it flows through
the one `ApiClient` from #62 — no screen touches HTTP, and the signed-in
employee is resolved server-side from the JWT, so another employee's requests
are never visible.

Endpoints used (`backend/src/routes/leave-requests.ts`,
`backend/src/routes/leave-balances.ts`, `backend/src/routes/leave-types.ts`):

| Method | Path | Purpose |
|---|---|---|
| `GET /leave-balances?tahun=` | quota rows for the current year | Balance tiles + the form's annual header + expiry |
| `GET /leave-requests?limit=100` | the employee's request history | List + status filter + schedule's leave-blocked days |
| `GET /leave-types` | the business's active leave types | The form's type chips (no fixed five-type list) |
| `POST /leave-requests` | create a pending request | Submit; on success the list refetches and the request appears as `Menunggu` |

Behaviour contract:

- **Balances, types and requests load in parallel** on CutiScreen mount.
  A failure in any one keeps whatever already loaded and shows a retry
  surface — never zero balances presented as fact.
- **Approver data comes from the server.** The request card's decision note is
  `catatan_approver` verbatim and the trailing line is the server's
  `created_at` ("Diajukan 13/09/2026") — there is no hardcoded
  "menunggu Pak Darmawan". (The BE does not yet return the approver's name,
  only `approver_user_id`, so pending requests say "Menunggu persetujuan" via
  the status pill rather than inventing a name.)
- **Status filters map to the real BE statuses** (`pending` / `disetujui` /
  `ditolak`), and the existing empty state shows when a filter has no matches.
- **Impact preview is FE-computed, server-decided.** The form's balance
  arithmetic (`newSisa = currentSisa − durationDays`, over-balance warning)
  and the shift-conflict line are computed on the device from the latest
  balances + a pre-fetched roster range so the employee gets a trustworthy
  preview before sending. The server remains the source of truth: it re-checks
  quota on `POST /leave-requests` and its rejection message surfaces verbatim
  as a snackbar with the form's input preserved.
- **Submit is in-flight-safe.** The button disables with a spinner and the
  whole form is `IgnorePointer`'d while sending (double-tap produces one
  request). On success the form pops back to the refreshed list with a
  "Pengajuan terkirim" snackbar.
- **The Cuti nav badge** shows the real pending count from the provider, not a
  fixture.

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
flutter run --dart-define=API_BASE_URL=http://localhost:3001  # against local BE
flutter analyze
flutter test                            # 226 tests
flutter test test/token_parity_test.dart # mobile palette == web globals.css
flutter test test/a11y_test.dart         # tap targets, labels, contrast x theme
flutter test test/stress_test.dart       # text scale x width x theme matrix
```

## Not yet wired

The payslip API in `backend/`, real geolocation, camera capture, push
notifications, the offline queue, and the home-screen widget. The five
mobile-only capabilities appear as UI states only. Sign-in/sign-out,
attendance (today + clock in/out + monthly aggregate), the shift schedule
(roster by range + upcoming + leave-blocked days) and leave (balances +
history + submit + types) are real; the remaining screen-by-screen data wiring
is covered by the per-domain MOB tickets.
