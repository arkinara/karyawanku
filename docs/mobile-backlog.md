# Mobile backlog — remaining work after the Flutter front end

Source for the tickets pushed to [KaryawanKu Board](https://github.com/users/arkinara/projects/15/views/1).
Format follows [#59](https://github.com/arkinara/karyawanku/issues/59).

The Flutter app in `mobile/` renders all eight employee screens off fixtures in
`lib/data/mock_data.dart`. Nothing talks to `backend/`. These tickets close that
gap and cover the five mobile-only capabilities the design doc promised
(geofence check-in, selfie verification, push, offline queue, home-screen
widget).

Order below is the suggested delivery order: **MOB-1 unblocks every other MOB
ticket.**

---
<!-- TICKET
title: MOB: Mobile API client, session handling, and secure token storage
labels: enhancement, MOB, domain:auth
-->

## Description
The Flutter app has no networking layer at all. Every screen reads `Mock`, and `MasukScreen` navigates to the shell without authenticating. This ticket builds the foundation the other mobile tickets depend on: a typed API client against the Fastify BE, a session that survives app restarts, and token storage that is not a plaintext file. The web client (`frontend/src/lib/api-client.ts`) is the contract reference — same endpoints, same snake_case envelopes, same `{ error: { message, details } }` error shape — but the storage strategy differs, because `localStorage` has no mobile equivalent that is safe for a JWT.

## Reference
- PRD: KaryawanKu Phase 2 — Mobile
- Notion PRD: https://app.notion.com/p/KaryawanKu-Product-Requirements-Document-3c18f6b0a7a581db9d05dc50388fe6b0
- `frontend/src/lib/api-client.ts` (endpoint contract, error envelope, `TOKEN_KEY`)
- `backend/src/routes/auth.ts` (`/auth/sign-in`, `/auth/refresh`, `/auth/sign-out`, `/auth/me`)
- `mobile/lib/features/auth/masuk_screen.dart` (currently navigates without auth)

## Sub-feature: Typed API client
### Goal
One place that knows the base URL, attaches the bearer token, and turns BE error envelopes into typed Dart exceptions.
### Definition of Done
- [ ] Base URL is configurable per build (`--dart-define`), defaulting to the local BE, with no hardcoded host in screen code
- [ ] `Authorization: Bearer <jwt>` is attached to every authenticated request from one interceptor
- [ ] BE error envelopes are parsed into a typed `ApiException` carrying status, message, and details
- [ ] Network failure, timeout, and non-JSON responses are distinguishable from BE validation errors
- [ ] Request models mirror the BE's snake_case contract; Dart-side models stay camelCase with explicit mapping

## Sub-feature: Session lifecycle
### Goal
Sign-in persists, expiry is handled without dumping the user on a blank screen, and sign-out actually revokes.
### Definition of Done
- [ ] `POST /auth/sign-in` stores the token and user, and routes to the shell only on success
- [ ] The app restores an existing session on cold start and skips the sign-in screen
- [ ] A 401 triggers one refresh attempt via `POST /auth/refresh`; a second failure signs the user out with a "sesi berakhir" notice, matching the web
- [ ] Sign-out calls `POST /auth/sign-out` and clears local state even if the call fails
- [ ] The signed-in employee's name, role, and business replace the hardcoded `Mock.employee` in the app bar and profile spots

## Sub-feature: Secure token storage
### Goal
The JWT is held in platform-backed secure storage, not in shared preferences.
### Definition of Done
- [ ] Token and refresh token are stored in the iOS Keychain and Android EncryptedSharedPreferences/Keystore
- [ ] No token, refresh token, or password is written to logs in any build mode
- [ ] Storage read failure (for example a restored backup on a new device) is treated as signed-out, not as a crash

## Positive Acceptance Criteria
### Typed API client
- [ ] A successful `GET /auth/me` returns a typed user and populates the app bar
- [ ] A build pointed at a staging URL via `--dart-define` reaches that host with no code change

### Session lifecycle
- [ ] Signing in, force-quitting, and reopening lands on Beranda without a second sign-in
- [ ] An expired access token is refreshed transparently and the in-flight request succeeds

### Secure token storage
- [ ] After sign-in, the token is present in Keychain/Keystore and absent from shared preferences

## Negative Acceptance Criteria
### Typed API client
- [ ] Wrong credentials surface the BE's message in Bahasa Indonesia, not a raw Fastify payload
- [ ] The device being offline shows a connection error distinct from "email atau sandi salah"

### Session lifecycle
- [ ] A refresh that also fails signs the user out once, without a redirect loop
- [ ] A revoked session cannot be resurrected from stored credentials

### Secure token storage
- [ ] Signing out leaves no token behind in secure storage
- [ ] A token from another business's user cannot be used to read this business's data (BE-enforced; asserted here)

## Tasks
- Add an HTTP client with interceptors for auth, error mapping, and timeouts
- Model the auth contract (`ApiUser`, sign-in request/response) against the BE
- Implement secure storage with a platform-appropriate backend and a signed-out fallback
- Add an auth controller exposing signed-out / restoring / signed-in states, and gate routing on it
- Replace `Mock.employee` reads with session data
- Test sign-in, restore, refresh-once-then-sign-out, sign-out, and offline paths

## Out of Scope
Biometric unlock (separate MOB ticket), device-bound sessions, sign-up and password reset on mobile, and certificate pinning. Screen-by-screen data wiring is covered by the per-domain MOB tickets.

---
<!-- TICKET
title: MOB: Wire Absensi and the Beranda shift hero to the attendance API
labels: enhancement, MOB, domain:attendance
-->

## Description
`AbsensiScreen` shows a fixed `09:41` clock, a hardcoded four-entry timeline, and month totals of 21/2/1, none of which come from anywhere. The Clock Out button does nothing. The Beranda hero shows a frozen `5j 43m`. The BE already has everything this screen needs — `/attendance/today`, `/attendance/clock-in`, `/attendance/clock-out`, and `/attendance/aggregate/:employeeId` — so this is wiring plus the live-state work a clock screen needs that a static mock hid.

## Reference
- PRD: KaryawanKu Phase 1 — Attendance
- `backend/src/routes/attendance.ts` (`/attendance/today`, `/clock-in`, `/clock-out`, `/aggregate/:employeeId`)
- `mobile/lib/features/absensi/absensi_screen.dart`, `mobile/lib/features/beranda/beranda_screen.dart`
- Depends on: MOB API client ticket

## Sub-feature: Live attendance state
### Goal
The screen reflects what the server believes about today, and updates as the shift runs.
### Definition of Done
- [ ] Today's record loads from `GET /attendance/today` and drives the timeline, not fixtures
- [ ] The wall clock ticks from device time, and the elapsed-time hero derives from the server's `clock_in`
- [ ] Month totals come from `GET /attendance/aggregate/:employeeId` for the current month
- [ ] The primary button reads Clock In or Clock Out from actual state, and is hidden or disabled once the day is closed
- [ ] Loading uses a skeleton, not a blocking spinner; failure shows an error state with retry

### Sub-feature: Clock in and out
### Goal
The button performs a real, non-duplicable write and the UI reflects the result immediately.
### Definition of Done
- [ ] Clock In posts to `/attendance/clock-in` and Clock Out to `/attendance/clock-out`, with the button disabled while in flight
- [ ] Success updates the timeline and hero without a full reload
- [ ] `submission_method` is sent as `live`, leaving `offline_queue` to the offline-queue ticket
- [ ] Server-side rejections (already clocked in, no shift today, no linked employee) render as readable Indonesian messages
- [ ] Late and overtime values shown come from the server, never recomputed on the client

### Sub-feature: Beranda hero
### Goal
The home screen's headline number is true.
### Definition of Done
- [ ] The hero shows real elapsed time, real shift label, and real clock-in and expected-out times
- [ ] Progress reflects elapsed against scheduled duration
- [ ] The not-yet-clocked-in, on-shift, and finished states each have a distinct hero treatment
- [ ] The Clock Out shortcut reflects and drives the same state as the Absensi screen

## Positive Acceptance Criteria
### Live attendance state
- [ ] An employee with an open record sees their real clock-in time and a live-ticking elapsed figure
- [ ] The month tiles match what the BE aggregate returns

### Clock in and out
- [ ] A first clock-in of the day succeeds and the timeline gains a Masuk entry with the server's time
- [ ] A clock-out closes the day and the button stops offering further writes

### Beranda hero
- [ ] Before the first clock-in the hero invites the action rather than showing a stale duration

## Negative Acceptance Criteria
### Live attendance state
- [ ] A failed load shows an error with retry, never an empty timeline presented as "no activity"
- [ ] An account with no linked employee record shows an actionable message rather than an empty screen

### Clock in and out
- [ ] Double-tapping Clock In produces exactly one record
- [ ] A second clock-in on the same day is rejected and the message explains why
- [ ] A request that fails mid-flight leaves the button re-enabled and the UI unchanged

### Beranda hero
- [ ] A day with no shift assigned does not render a progress bar against a zero-length shift

## Tasks
- Model attendance responses and add the attendance repository
- Replace the Absensi fixtures with loaded state, including skeleton, empty, and error states
- Wire Clock In / Clock Out with in-flight disabling and optimistic-then-reconciled UI
- Drive the Beranda hero and Clock Out shortcut from the same state
- Retire the attendance half of `Mock`
- Test the state matrix, double-tap, duplicate-day rejection, and load failure

## Out of Scope
Geofence, selfie capture, and the offline queue are separate tickets, as are manual attendance correction and any manager-facing attendance view.

---
<!-- TICKET
title: MOB: Wire Jadwal and the Beranda upcoming list to the shift API
labels: enhancement, MOB, domain:shifts
-->

## Description
`JadwalScreen` renders sixteen hardcoded shifts for September 2026, and its month calendar is built around that fixed month. The Beranda "Jadwal 3 hari ke depan" list is the same fixture. `GET /shift-assignments` and `/shift-assignments/upcoming` already exist and serve the web roster, so this is wiring plus making the calendar work for an arbitrary month rather than the one the mock happens to cover.

## Reference
- PRD: KaryawanKu Phase 1 — Shifts
- `backend/src/routes/shift-assignments.ts` (`/shift-assignments`, `/shift-assignments/upcoming`)
- `mobile/lib/features/jadwal/jadwal_screen.dart`, `mobile/lib/features/beranda/beranda_screen.dart`
- Depends on: MOB API client ticket

## Sub-feature: Real roster data
### Goal
The week strip, month grid, and upcoming list all come from the employee's published roster.
### Definition of Done
- [ ] The week strip and month grid load assignments for the visible range from `GET /shift-assignments`
- [ ] The Beranda upcoming list uses `/shift-assignments/upcoming`
- [ ] Only published roster entries are shown; drafts never leak to the employee app
- [ ] Shift kind, times, role, and branch come from the server rather than being inferred client-side
- [ ] A day with no assignment renders the existing rest-day state

### Sub-feature: Month navigation
### Goal
The calendar works for any month, not the one the fixture was written for.
### Definition of Done
- [ ] The month view can move forward and back, and fetches the range it displays
- [ ] The current day is derived from the device clock, not a constant
- [ ] Ranges already fetched are not refetched on every toggle
- [ ] Leave-blocked days are marked from real leave requests, not a fixture flag

## Positive Acceptance Criteria
### Real roster data
- [ ] An employee with a published roster sees their real shifts in both the strip and the grid
- [ ] Selecting a day shows that day's shift detail, and the reminder line reflects the real setting

### Month navigation
- [ ] Paging to the next month loads and renders that month's assignments
- [ ] Today is highlighted correctly regardless of the current date

## Negative Acceptance Criteria
### Real roster data
- [ ] An employee with no published roster sees an explanatory empty state, not a blank grid
- [ ] An unpublished draft roster is not visible

### Month navigation
- [ ] A failed range fetch shows an error for that range with retry, and does not blank the whole screen
- [ ] Rapid month paging does not leave a stale month's data rendered under a new month's header

## Tasks
- Model shift assignments and add the roster repository
- Load by visible range with simple caching, and wire the strip, grid, and detail card
- Drive the Beranda upcoming list from `/shift-assignments/upcoming`
- Mark leave-blocked days from real leave requests
- Retire the shift half of `Mock`
- Test empty roster, month paging, range failure, and stale-response handling

## Out of Scope
Shift swap requests, availability submission, and any roster editing — the employee app is read-only over the roster.

---
<!-- TICKET
title: MOB: Wire Cuti list and the Ajukan Cuti form to the leave API
labels: enhancement, MOB, domain:leave
-->

## Description
`CutiScreen` shows three fixture requests and three fixture balances; `AjukanCutiScreen` has a working date picker and a conflict banner whose text is assembled from constants, and its submit only shows a snackbar. The BE has `/leave-requests` and `/leave-balances`, so the list and balances are wiring. The form is more than wiring: the balance arithmetic and the shift-conflict warning currently live in the widget and must move to, or be confirmed against, the server.

## Reference
- PRD: KaryawanKu Phase 1 — Leave
- `backend/src/routes/leave-requests.ts`, `backend/src/routes/leave-balances.ts`, `backend/src/routes/leave-types.ts`
- `mobile/lib/features/cuti/cuti_screen.dart`, `mobile/lib/features/cuti/ajukan_cuti_screen.dart`
- Depends on: MOB API client ticket

## Sub-feature: Balances and request history
### Goal
What the employee sees is their real entitlement and their real request history.
### Definition of Done
- [ ] Balances load from `GET /leave-balances` for the signed-in employee, including the expiry date shown on the form
- [ ] Requests load from `GET /leave-requests`, filtered server-side or client-side to the signed-in employee
- [ ] The status filter maps to real statuses, and the existing empty state shows when a filter has no matches
- [ ] Approver name and decision note come from the server, replacing the hardcoded "menunggu Pak Darmawan"
- [ ] Leave types come from `GET /leave-types` rather than the five hardcoded chips

### Sub-feature: Submitting a request
### Goal
Submitting creates a real request, and the impact preview is trustworthy before it does.
### Definition of Done
- [ ] Submit posts to `POST /leave-requests` and shows in-flight, success, and failure states
- [ ] On success the list refreshes and the new request appears with `menunggu` status
- [ ] The remaining-balance preview is computed from the loaded balance, and the over-balance guard reflects the real entitlement
- [ ] The shift-conflict line lists the actual shifts the range overlaps, or is hidden when there are none
- [ ] Server-side validation errors map to the offending field rather than a generic toast

## Positive Acceptance Criteria
### Balances and request history
- [ ] An employee sees their real annual, sick, and personal balances and their real pending request
- [ ] Filtering to Menunggu shows only pending requests

### Submitting a request
- [ ] A valid three-day request is created and appears at the top of the list as pending
- [ ] A request overlapping two shifts names both in the impact line

## Negative Acceptance Criteria
### Balances and request history
- [ ] A load failure shows retry rather than presenting zero balances as fact
- [ ] Another employee's requests are never visible

### Submitting a request
- [ ] A request exceeding the real balance is blocked client-side and, if forced, rejected by the server
- [ ] An end date before the start date is rejected with the error on the date field
- [ ] Double-tapping Kirim Pengajuan creates exactly one request
- [ ] A network failure mid-submit leaves the form intact with its input preserved

## Tasks
- Model leave balances, types, and requests, and add the leave repository
- Wire the list, filters, and empty state; wire balances into both the list and the form
- Wire submit with in-flight state, field-level error mapping, and list refresh
- Replace the constant-driven impact banner with real balance and conflict data
- Retire the leave half of `Mock`
- Test submit success, over-balance, invalid range, duplicate submit, and load failure

## Out of Scope
Leave approval and rejection (manager-facing, and already covered by the BE capability), attachment upload (folded into the selfie/attachment storage ticket), and leave cancellation after submission.

---
<!-- TICKET
title: MOB: Wire Slip Gaji list, detail, and payslip download
labels: enhancement, MOB, domain:payroll
-->

## Description
`SlipGajiScreen` and `SlipDetailScreen` render a fixture payslip with a fixed take-home of Rp 4.235.000 and a hardcoded BPJS and PPh 21 breakdown. The download button on the detail screen does nothing. `GET /payslips`, `/payslips/:id`, and `/payslips/:id/download` already exist. Payslips are the screen employees trust most, so the compliance lines must render exactly what the server computed, with no client-side arithmetic anywhere.

## Reference
- PRD: KaryawanKu Phase 1 — Payroll
- `backend/src/routes/payslips.ts` (`/payslips`, `/payslips/employee/:employeeId`, `/payslips/:id`, `/payslips/:id/download`)
- `mobile/lib/features/slip/slip_gaji_screen.dart`, `mobile/lib/features/slip/slip_detail_screen.dart`
- Depends on: MOB API client ticket

## Sub-feature: Payslip list and detail
### Goal
Real payslips, real numbers, and no client-side recomputation.
### Definition of Done
- [ ] The list loads the signed-in employee's payslips, newest first, with the latest promoted to the hero card
- [ ] The year filter reflects the years actually present in the data instead of the fixed 2026/2025 chips
- [ ] Detail renders the server's earnings and deductions lines verbatim, including BPJS Kesehatan, JHT, JP, and PPh 21
- [ ] Take-home, earnings total, and deductions total are the server's figures, never summed on the client
- [ ] THR payslips are identified from the server's data rather than a fixture flag
- [ ] The Beranda "Slip gaji terakhir" row shows the real latest payslip

### Sub-feature: Download and share
### Goal
An employee can keep a copy of their payslip.
### Definition of Done
- [ ] The download action fetches `GET /payslips/:id/download` and saves the file to the device
- [ ] The saved file can be opened or shared through the platform share sheet
- [ ] Progress is shown while downloading and the action is disabled in flight
- [ ] Storage permission (where the platform requires it) is requested with a clear reason and handled on denial

## Positive Acceptance Criteria
### Payslip list and detail
- [ ] An employee with several payslips sees them in order with the latest as the hero
- [ ] The detail totals match the payroll run exactly, to the rupiah

### Download and share
- [ ] Downloading produces a file that opens correctly in the platform viewer

## Negative Acceptance Criteria
### Payslip list and detail
- [ ] An employee with no payslips sees the existing empty state, not a zero-rupiah card
- [ ] Another employee's payslip cannot be opened, including by direct id
- [ ] A load failure never renders partial figures as if complete

### Download and share
- [ ] A failed download shows an error with retry and leaves no truncated file behind
- [ ] Denied storage permission explains what will not work rather than failing silently

## Tasks
- Model payslips and lines, and add the payroll repository
- Wire the list, dynamic year filter, hero card, and Beranda latest-payslip row
- Wire the detail screen strictly to server-provided lines and totals
- Implement download to a device file plus share, with progress and permission handling
- Retire the payroll half of `Mock`
- Test ordering, empty state, cross-employee access, download success, and download failure

## Out of Scope
In-app PDF rendering, payslip email delivery, and any payroll run or approval action — the employee app is read-only over payroll.

---
<!-- TICKET
title: BE: Geofence — work location, radius, and coordinate capture on attendance
labels: enhancement, BE, domain:attendance
-->

## Description
[#59](https://github.com/arkinara/karyawanku/issues/59) made attendance time server-authoritative and added the self-service identity guard, but its location sub-feature did not land: `attendance_records` has no latitude, longitude, or accuracy, and `businesses` has no work location or radius. The mobile app renders a "Di dalam area · Cabang Kemang · 12 m" chip that is entirely fictional. Geofencing is the control a cafe or salon owner actually asks for, and it is the one mobile capability that cannot be built on the client alone.

## Reference
- Follows: [#59](https://github.com/arkinara/karyawanku/issues/59) (location capture, not delivered)
- PRD: KaryawanKu Phase 1 — Attendance
- `backend/src/db/schema.ts` (`attendanceRecords`, `businesses`)
- `backend/src/routes/attendance.ts` (`clockInSchema`, `clockOutSchema`)
- `mobile/lib/features/absensi/absensi_screen.dart` (the geofence chip this feeds)

## Sub-feature: Work location configuration
### Goal
A business can declare where its staff are expected to be, and how precise that expectation is.
### Definition of Done
- [ ] Drizzle migration adds optional work latitude, longitude, and radius in metres to the business
- [ ] Radius has a documented default and a validated minimum and maximum
- [ ] A business setting governs whether an out-of-radius clock-in is flagged only, or blocked outright
- [ ] Configuration is readable and writable only with the business-settings capability
- [ ] Location stays optional: a business that configures nothing behaves exactly as it does today

## Sub-feature: Coordinate capture
### Goal
Where a clock-in happened is recorded alongside when.
### Definition of Done
- [ ] Drizzle migration adds optional latitude, longitude, and accuracy to `attendance_records`, for both clock-in and clock-out
- [ ] Clock-in and clock-out accept coordinates and validate range and accuracy
- [ ] Coordinates are stored exactly as reported and are never inferred from IP
- [ ] Records with no coordinates remain valid, so the feature does not break existing clients

## Sub-feature: Radius evaluation
### Goal
The server decides whether a clock-in was on site, and the client cannot overrule it.
### Definition of Done
- [ ] Distance from the configured work location is computed server-side and stored on the record
- [ ] Out-of-radius records are flagged, and blocked when the business has enabled blocking
- [ ] Poor GPS accuracy is treated distinctly from being genuinely out of area, and does not silently pass as on-site
- [ ] The flag is exposed on the attendance list responses so it can surface for owner review

## Positive Acceptance Criteria
### Work location configuration
- [ ] An owner can set a location and radius, and the setting round-trips
- [ ] A business with no location configured is unaffected

### Coordinate capture
- [ ] A clock-in with valid coordinates stores them and returns them on the record

### Radius evaluation
- [ ] A clock-in inside the radius is accepted and marked on-site
- [ ] An out-of-radius clock-in at a flag-only business is accepted and flagged

## Negative Acceptance Criteria
### Work location configuration
- [ ] A radius outside the allowed range is rejected with a validation error
- [ ] A non-owner attempting to change the work location is rejected with 403

### Coordinate capture
- [ ] Out-of-range or malformed coordinates are rejected with a validation error
- [ ] Coordinates supplied for another employee's record are rejected along the #59 identity guard

### Radius evaluation
- [ ] An out-of-radius clock-in at a blocking business is rejected, and no record is written
- [ ] A clock-in with accuracy far wider than the radius is not counted as on-site
- [ ] Omitting coordinates entirely cannot be used to bypass a blocking business's geofence

## Tasks
- Migrate `businesses` for work location, radius, and enforcement mode
- Migrate `attendance_records` for clock-in and clock-out coordinates and accuracy
- Validate coordinates and implement distance and accuracy evaluation server-side
- Apply flag-or-block behaviour and expose the flag on list responses
- Add business-settings endpoints for the work location, behind the right capability
- Test configuration, in and out of radius, blocking mode, accuracy handling, and the omitted-coordinates bypass

## Out of Scope
Multiple work locations per business, per-employee location overrides, geofence dwell detection, and selfie verification. The mobile permission prompt and on-site UX are a separate MOB ticket.

---
<!-- TICKET
title: MOB: Device location permission and on-site clock-in experience
labels: enhancement, MOB, domain:attendance
-->

## Description
The Absensi screen shows a green "Di dalam area" chip with a hardcoded distance. There is no location plugin, no permission request, and nothing sends coordinates. This ticket makes that chip honest: request location at the right moment, show the real relationship to the work area, and send coordinates with the clock-in. The failure modes matter more than the happy path here — staff clock in in basements, in car parks, and with location services switched off, and none of those should leave them unable to record their shift.

## Reference
- PRD: KaryawanKu Phase 1 — Attendance
- Depends on: BE geofence ticket (work location, radius, coordinate capture)
- `mobile/lib/features/absensi/absensi_screen.dart` (`_ClockCard` geofence chip)
- Apple HIG location permission guidance; Android foreground-location guidance

## Sub-feature: Permission and acquisition
### Goal
Location is requested with a reason the user understands, and denial is a state rather than a dead end.
### Definition of Done
- [ ] Permission is requested at the point of use with an in-context explanation, not on app launch
- [ ] Only foreground ("when in use") location is requested; background location is never asked for
- [ ] iOS `NSLocationWhenInUseUsageDescription` and the Android manifest permissions are declared with Indonesian copy
- [ ] Denied, permanently denied, and services-disabled are distinct states with distinct guidance, including a link to settings where the platform allows it
- [ ] Acquisition has a timeout, and a slow fix shows progress rather than freezing the button

### Sub-feature: On-site feedback
### Goal
The chip tells the truth, including when it does not know.
### Definition of Done
- [ ] The chip shows real distance to the configured work location, sourced from the server's evaluation
- [ ] Inside, outside, unknown, and low-accuracy each have a distinct visual state, and none of them is conveyed by colour alone
- [ ] A business with no configured work location hides the chip entirely rather than showing a fake one
- [ ] When the business blocks out-of-radius clock-ins, the button is disabled with the reason stated
- [ ] Coordinates and accuracy are attached to clock-in and clock-out requests

## Positive Acceptance Criteria
### Permission and acquisition
- [ ] Granting permission on first Clock In acquires a fix and proceeds to the clock-in
- [ ] A business with no work location never prompts for location at all

### On-site feedback
- [ ] An on-site clock-in shows real distance and succeeds
- [ ] An off-site clock-in at a flag-only business succeeds and says it was recorded off-site

## Negative Acceptance Criteria
### Permission and acquisition
- [ ] Denying permission still allows clock-in at a flag-only business, recorded without coordinates
- [ ] Permanently denied shows how to re-enable in settings rather than re-prompting fruitlessly
- [ ] Location services switched off is reported as such, not as "outside the area"
- [ ] A timed-out fix does not block clock-in at a flag-only business

### On-site feedback
- [ ] An off-site clock-in at a blocking business is refused with a clear reason and no local "success" state
- [ ] A low-accuracy fix is not presented as confidently on-site
- [ ] The distance shown never comes from client-side arithmetic that could disagree with the server

## Tasks
- Add a location plugin and declare the platform permissions with Indonesian rationale copy
- Implement an acquisition service with timeout, and model the permission and accuracy states
- Render the four chip states, and gate the button when the business blocks
- Attach coordinates and accuracy to clock-in and clock-out
- Test every denial and failure path against both flag-only and blocking businesses

## Out of Scope
Background location, mock-location and rooted-device detection, map display of the work area, and the "map-first" clock-in direction (option 1e in the design doc).

---
<!-- TICKET
title: BE + MOB: Selfie verification for attendance
labels: enhancement, BE, MOB, domain:attendance
-->

## Description
The Absensi screen has a dashed selfie slot that does nothing, and the design doc lists selfie verification as one of the five mobile capabilities. [#59](https://github.com/arkinara/karyawanku/issues/59) explicitly deferred it. This is the highest-risk item in the mobile backlog because it introduces the first user-generated binary content in the product: photographs of employees' faces, which are personal data and need a retention answer before they are collected, not after.

## Reference
- Deferred from: [#59](https://github.com/arkinara/karyawanku/issues/59) ("Biometric and selfie verification … not in Phase 1")
- PRD: KaryawanKu Phase 1 — Attendance
- `mobile/lib/features/absensi/absensi_screen.dart` (`_SelfieSlot`)
- UU PDP (Indonesian personal data protection) — retention and consent

## Sub-feature: Capture and upload
### Goal
An employee can attach a photo to a clock-in, and it reaches the server intact.
### Definition of Done
- [ ] The selfie slot opens the front camera and previews the captured frame before submitting
- [ ] Images are downscaled and compressed on-device to a documented maximum before upload
- [ ] Upload is multipart, size-limited server-side, and content-type validated as an image
- [ ] The photo is linked to the attendance record it belongs to, and orphan uploads are cleaned up
- [ ] Camera permission is requested in context, with denial handled as a state

## Sub-feature: Storage and retention
### Goal
Face photographs are stored deliberately, with a stated lifetime.
### Definition of Done
- [ ] Files are stored outside the database, with only a reference on the attendance record
- [ ] Retrieval is authorised: an employee sees their own, and only the attendance-manage capability sees others'
- [ ] A retention period is configurable and documented, and expired images are purged by a scheduled job
- [ ] Deleting an employee or a business removes the associated images
- [ ] The consent copy shown before the first capture states what is stored and for how long

### Sub-feature: Owner review
### Goal
The photo is useful to the person it was collected for.
### Definition of Done
- [ ] The attendance list indicates whether a record has a verification photo
- [ ] An owner can view the photo alongside the record, its time, and its geofence flag
- [ ] Whether a selfie is required, optional, or disabled is a business setting

## Positive Acceptance Criteria
### Capture and upload
- [ ] A captured selfie uploads and appears attached to that clock-in

### Storage and retention
- [ ] An employee can view their own verification photo
- [ ] An image past the retention period is no longer retrievable after the purge runs

### Owner review
- [ ] An owner reviewing attendance sees the photo next to the record

## Negative Acceptance Criteria
### Capture and upload
- [ ] A non-image or oversized upload is rejected with a validation error
- [ ] Denied camera permission still allows clock-in where the selfie is optional
- [ ] A failed upload does not leave the attendance record in a half-written state

### Storage and retention
- [ ] An employee cannot retrieve another employee's photo, including by direct file reference
- [ ] A user from another business cannot retrieve any of this business's photos
- [ ] Deleting an employee leaves no retrievable images behind

### Owner review
- [ ] With the selfie disabled for the business, no capture is offered and no storage is used

## Tasks
- Decide and document the storage backend and the retention period before any collection
- Migrate `attendance_records` for a photo reference and add the business selfie-mode setting
- Add authorised upload and retrieval endpoints with size and content-type limits
- Implement the retention purge job and cascade deletion
- Build mobile capture, preview, compression, consent copy, and permission handling
- Surface the photo in the attendance list and detail for owners
- Test authorisation, cross-business access, upload validation, purge, and cascade delete

## Out of Scope
Face matching or recognition of any kind, liveness detection, and using the photo for identity verification beyond human review. This ticket stores an image for a person to look at; it does not decide anything automatically.

---
<!-- TICKET
title: BE + MOB: Offline attendance queue with idempotent submission
labels: enhancement, BE, MOB, domain:attendance
-->

## Description
The app promises this on the sign-in screen — "Absensi tetap tercatat tanpa sinyal" — and the Absensi screen shows a fixed "Offline — 1 entri menunggu kirim" banner with a bottom sheet listing a fake queued entry. None of it is real. [#59](https://github.com/arkinara/karyawanku/issues/59) added `submission_method: 'offline_queue'` and preserves the client's action time for those submissions, so the server contract is half-built. What is missing is the client queue and, critically, an idempotency key: a queue that retries without one will double-write attendance, which feeds payroll.

## Reference
- Builds on: [#59](https://github.com/arkinara/karyawanku/issues/59) (`submission_method`, client-claim time preservation)
- `backend/src/routes/attendance.ts` (`isOffline`, `attendanceSubmissionMethods`)
- `mobile/lib/features/absensi/absensi_screen.dart` (offline banner and queue sheet)
- Depends on: MOB attendance wiring ticket

## Sub-feature: Idempotent submission
### Goal
Submitting the same queued action twice produces one record, whatever the network did.
### Definition of Done
- [ ] Clock-in and clock-out accept a client-generated idempotency key
- [ ] A repeat submission with the same key returns the original result rather than writing again
- [ ] Keys are scoped so one employee's key cannot collide with another's
- [ ] Keys expire after a documented window, and expiry is not treated as permission to double-write
- [ ] Existing clients that send no key keep working, guarded by the current duplicate-day conflict

### Sub-feature: Client queue
### Goal
An action taken with no signal is recorded locally and sent later, without the employee having to think about it.
### Definition of Done
- [ ] A clock-in or clock-out attempted while offline is persisted locally with its action time and an idempotency key
- [ ] The queue survives app restart and device reboot
- [ ] Flush is attempted on reconnect and on app foreground, with backoff between failures
- [ ] Queued entries are sent with `submission_method: 'offline_queue'` so #59 preserves their action time
- [ ] A queued entry that the server permanently rejects is surfaced to the employee rather than retried forever

### Sub-feature: Queue visibility
### Goal
The banner and sheet tell the truth about what is pending.
### Definition of Done
- [ ] The offline banner reflects real connectivity and a real pending count, and disappears when the queue is empty
- [ ] The queue sheet lists actual pending entries with their action times, and per-entry retry works
- [ ] The timeline marks queued entries as awaiting sync, and clears the mark once accepted
- [ ] A successful background flush updates the UI without the employee reopening the screen

## Positive Acceptance Criteria
### Idempotent submission
- [ ] Two identical submissions with the same key yield one record and the same response

### Client queue
- [ ] A clock-in in airplane mode is queued, and flushes on reconnect with its original action time
- [ ] The queue survives a force-quit and a reboot

### Queue visibility
- [ ] With no pending entries and a live connection, no offline banner is shown

## Negative Acceptance Criteria
### Idempotent submission
- [ ] A retry after a response that was lost in transit does not create a second record
- [ ] One employee's idempotency key cannot suppress or overwrite another employee's write

### Client queue
- [ ] An entry rejected as a duplicate day is removed from the queue and explained, not retried forever
- [ ] A flush interrupted halfway does not lose or duplicate the remaining entries
- [ ] A queued entry whose action time is days old is handled per the #59 tolerance rules, not silently accepted as current

### Queue visibility
- [ ] The banner never shows a stale count after a successful flush

## Tasks
- Add an idempotency key to the clock-in and clock-out contracts, scoped per employee, with an expiry window
- Implement server-side replay returning the original result
- Build the local queue with durable storage, action time, and key generation
- Implement connectivity detection, foreground and reconnect flush, and backoff
- Wire the banner, queue sheet, per-entry retry, and timeline sync markers to real state
- Test lost-response retry, restart persistence, permanent rejection, partial flush, and cross-employee key isolation

## Out of Scope
Offline reads of roster, leave, or payslips; offline leave submission; and conflict resolution beyond the existing duplicate-day rule.

---
<!-- TICKET
title: BE + MOB: Push notifications — device registration, leave decisions, shift reminders
labels: enhancement, BE, MOB, domain:auth
-->

## Description
The design doc lists push as one of the five mobile capabilities, the Jadwal card promises "Pengingat 30 menit sebelum shift — aktif", and the Beranda bell shows a hardcoded badge of 2. There is no device registration, no sending, and no notification list. Push is the feature that makes the mobile app worth installing over the web app, and it needs the whole path: token registration, an event to send on, delivery, and a tap that lands somewhere sensible.

## Reference
- PRD: KaryawanKu Phase 2 — Mobile
- `backend/src/routes/leave-requests.ts` (`/:id/approve`, `/:id/reject` — the events to notify on)
- `mobile/lib/features/beranda/beranda_screen.dart` (notification bell and badge)
- `mobile/lib/features/jadwal/jadwal_screen.dart` (shift reminder line)

## Sub-feature: Device registration
### Goal
The server knows where to send, and stops sending to devices that no longer exist.
### Definition of Done
- [ ] A device table stores the push token, platform, and the user it belongs to
- [ ] The app registers its token after sign-in and re-registers on token rotation
- [ ] Sign-out unregisters the device, and signing in as a different user never reuses the previous registration
- [ ] Tokens rejected as invalid by the provider are pruned
- [ ] Notification permission is requested in context with a stated benefit, and denial is handled as a state

## Sub-feature: Leave decision notifications
### Goal
An employee learns their leave was approved or rejected without opening the app.
### Definition of Done
- [ ] Approving or rejecting a leave request sends a notification to the requesting employee's devices
- [ ] The payload carries enough to deep-link to that request
- [ ] Sending is asynchronous and never blocks or fails the approval transaction
- [ ] Delivery failures are logged and retried within a bounded policy
- [ ] Content is in Bahasa Indonesia and contains no salary figures

### Sub-feature: Shift reminders
### Goal
The reminder the Jadwal card already promises actually fires.
### Definition of Done
- [ ] A reminder fires a configurable interval before a published shift starts
- [ ] The employee can turn reminders on and off, and the Jadwal card reflects the real setting
- [ ] Reminders are not sent for cancelled, unpublished, or already-clocked-in shifts
- [ ] Scheduling survives a server restart and does not double-fire

### Sub-feature: In-app handling
### Goal
Tapping a notification lands on the right screen, and the badge means something.
### Definition of Done
- [ ] Deep links route to the leave request or the shift the notification is about, from cold start and from background
- [ ] The bell badge reflects a real unread count and clears when read
- [ ] Foreground notifications surface in-app rather than being silently swallowed

## Positive Acceptance Criteria
### Device registration
- [ ] Signing in registers the device, and signing out removes it

### Leave decision notifications
- [ ] An approved request notifies the requester, and tapping opens that request

### Shift reminders
- [ ] An employee with reminders on gets one before their shift; with reminders off, none

### In-app handling
- [ ] A cold-start tap lands on the right screen after authentication resolves

## Negative Acceptance Criteria
### Device registration
- [ ] A signed-out device receives nothing
- [ ] Signing in as employee B on a device previously used by employee A never delivers A's notifications to B
- [ ] Denied notification permission degrades to no push, with the rest of the app unaffected

### Leave decision notifications
- [ ] A push provider outage does not fail or roll back the approval
- [ ] No notification contains salary or payslip amounts

### Shift reminders
- [ ] A cancelled shift sends no reminder
- [ ] A server restart does not cause a duplicate reminder for the same shift

### In-app handling
- [ ] A deep link to a leave request belonging to another employee resolves to a not-found state, never to their data

## Tasks
- Choose the push provider and document the credential handling
- Add the device registration table and its endpoints, with pruning of rejected tokens
- Send on leave approve and reject, asynchronously and outside the transaction
- Schedule and dispatch shift reminders idempotently, honouring the per-employee setting
- Implement mobile registration, permission handling, deep links, foreground display, and the unread badge
- Test registration lifecycle, user switching, provider outage, cancelled shifts, restart, and cross-employee deep links

## Out of Scope
Notification preferences beyond the shift-reminder toggle, a full in-app notification centre with history, email or WhatsApp delivery, and manager-facing notifications for incoming leave requests.

---
<!-- TICKET
title: MOB: Biometric sign-in with a device-bound session
labels: enhancement, MOB, domain:auth
-->

## Description
The sign-in screen offers "Masuk dengan sidik jari" and it does nothing but navigate. Shift workers open this app several times a shift, on shared and grubby-handed devices, so typing a password each time is the difference between the app being used and being abandoned. The security question this raises is real: biometric unlock is only meaningful if it gates something stronger than a token sitting in storage anyway.

## Reference
- PRD: KaryawanKu Phase 2 — Mobile
- `mobile/lib/features/auth/masuk_screen.dart` (the biometric button, currently a no-op)
- Depends on: MOB API client and secure token storage ticket
- Apple HIG biometrics; Android BiometricPrompt guidance

## Sub-feature: Biometric unlock
### Goal
A returning employee reopens the app with a fingerprint or face instead of a password.
### Definition of Done
- [ ] Biometric enrolment is offered after a successful password sign-in, never before
- [ ] The refresh credential is stored behind the platform biometric keystore, so unlocking is what releases it
- [ ] Unlock uses the platform prompt with Indonesian copy, and falls back to device passcode where the platform offers it
- [ ] Password sign-in is always available as an alternative and is never hidden
- [ ] The button is hidden entirely on devices with no enrolled biometric, rather than failing on tap

## Sub-feature: Device-bound session
### Goal
A long-lived credential on a device is revocable and traceable.
### Definition of Done
- [ ] The refresh credential released by biometrics is bound to the device and is not portable
- [ ] The credential has a documented maximum lifetime after which a password sign-in is required again
- [ ] Existing session revocation (`/auth/sign-out-all`) invalidates it
- [ ] Changing the device's biometric enrolment invalidates the stored credential

## Positive Acceptance Criteria
### Biometric unlock
- [ ] After enrolling, reopening the app and passing the prompt reaches Beranda without a password
- [ ] Declining enrolment leaves password sign-in working exactly as before

### Device-bound session
- [ ] Signing out everywhere from another device forces a password sign-in here

## Negative Acceptance Criteria
### Biometric unlock
- [ ] A failed or cancelled prompt returns to password sign-in, and never bypasses it
- [ ] A device with no enrolled biometric is not offered the option
- [ ] Adding a new fingerprint to the device invalidates the stored credential and requires a password sign-in

### Device-bound session
- [ ] The stored credential lifted from one device is rejected on another
- [ ] An expired credential requires a password, and does not silently extend itself
- [ ] A revoked session cannot be resurrected by a biometric unlock

## Tasks
- Add the biometric plugin and the availability and enrolment checks
- Store the refresh credential behind biometric-gated keystore access, invalidated on enrolment change
- Implement device binding and a maximum credential lifetime on the BE, honouring existing revocation
- Wire enrolment prompting, unlock, cancellation, and password fallback
- Test cancellation, enrolment change, revocation, expiry, and credential portability

## Out of Scope
PIN or pattern unlock implemented in-app, biometric gating of individual actions such as approving leave, and multi-account switching on one device.

---
<!-- TICKET
title: CI: Run Flutter analyze, test, and build for the mobile package
labels: enhancement, MOB, documentation
-->

## Description
`.github/workflows/ci.yml` typechecks, tests, and lints the backend and frontend on every push and PR, and the README states a red suite is the only gate. The `mobile/` package is outside that gate entirely: its 119 tests, its analyzer, and its build can all break on `main` without anyone noticing. The mobile suite includes the token-parity test that fails when the mobile palette drifts from `frontend/src/app/globals.css`, so leaving mobile out of CI also means a web token change can silently desynchronise the two apps.

## Reference
- `.github/workflows/ci.yml` (existing backend and frontend jobs)
- `mobile/test/token_parity_test.dart` (reads the web tokens; the cross-package guard)
- `README.md` ("A red suite is visible immediately — there is no other gate")

## Sub-feature: Mobile CI job
### Goal
Mobile breaks the build like every other package.
### Definition of Done
- [ ] A mobile job runs `flutter analyze` and `flutter test` on every push to `main` and every PR
- [ ] The job pins the Flutter version rather than tracking whatever `stable` is that day
- [ ] Pub dependencies and the Flutter SDK are cached so the job does not dominate CI time
- [ ] The job runs in parallel with the existing backend and frontend jobs
- [ ] `dart format --set-exit-if-changed` enforces formatting, matching how the other packages are linted

### Sub-feature: Build verification
### Goal
The app still compiles for the platforms it ships to, not just for the test runner.
### Definition of Done
- [ ] A release build is produced for Android on every run
- [ ] An iOS build is verified without code signing, or the reason it cannot run is documented
- [ ] Build failures are reported distinctly from test failures
- [ ] The README's CI section documents the mobile job alongside the existing ones

## Positive Acceptance Criteria
### Mobile CI job
- [ ] A PR touching only `mobile/` runs the mobile job and reports its result
- [ ] A green run completes without materially lengthening total CI time

### Build verification
- [ ] The Android release build artefact is produced on a green run

## Negative Acceptance Criteria
### Mobile CI job
- [ ] A failing mobile test fails the workflow and blocks the merge
- [ ] An analyzer error fails the workflow
- [ ] A web token change that breaks `token_parity_test.dart` fails CI, even when the PR touches no mobile file

### Build verification
- [ ] A compile error that the test runner does not catch still fails the workflow

## Tasks
- Add a mobile job with a pinned Flutter version and SDK plus pub caching
- Run format, analyze, and test, then the Android release build
- Verify the iOS build without signing, or document why it is omitted
- Confirm the token-parity failure mode fires on a web-only change
- Update the README CI section

## Out of Scope
Publishing to the Play Store or App Store, code signing and provisioning, integration or golden-image tests on emulators, and per-PR distribution builds.

---
<!-- TICKET
title: MOB: Home-screen widget for shift and clock state
labels: enhancement, MOB, domain:attendance
-->

## Description
The design doc lists a home-screen widget as the fifth mobile-only capability, and it is the one that most changes daily behaviour: a cafe worker glances at their phone, sees their shift and whether they are clocked in, and clocks in without opening the app. It is also the lowest-priority item here, because it depends on everything above it being real — a widget over mock data is worse than no widget. Scheduled last deliberately.

## Reference
- PRD: KaryawanKu Phase 2 — Mobile ("home-screen widget")
- Depends on: MOB attendance wiring, MOB roster wiring, offline queue
- Apple WidgetKit guidance; Android App Widget guidance

## Sub-feature: Widget content
### Goal
A glance answers "when is my shift and am I on the clock".
### Definition of Done
- [ ] The widget shows the next or current shift with its times, and the current clock state
- [ ] It renders a signed-out state rather than stale data when there is no session
- [ ] Content updates on a schedule the platform will actually honour, and after any in-app clock action
- [ ] It renders correctly in the platform's light and dark appearance, using the same tokens as the app
- [ ] Sizes offered are the ones the platform recommends, and each is legible at its smallest

### Sub-feature: Quick clock action
### Goal
Clocking in does not require opening the app.
### Definition of Done
- [ ] The widget offers a clock-in or clock-out action appropriate to the current state
- [ ] The action reuses the same idempotent submission path as the app, including the offline queue
- [ ] Where the platform cannot complete the action in the widget, it deep-links into the app with the intent preserved
- [ ] A geofence-blocking business does not offer an action the server will refuse

## Positive Acceptance Criteria
### Widget content
- [ ] An employee on shift sees their shift and an on-the-clock state
- [ ] Clocking in inside the app updates the widget without manual refresh

### Quick clock action
- [ ] A widget clock-in creates exactly one record and updates both widget and app

## Negative Acceptance Criteria
### Widget content
- [ ] A signed-out user sees a sign-in prompt, never the previous user's shift
- [ ] A stale widget never shows a clock state contradicting the app

### Quick clock action
- [ ] A widget action while offline is queued, not lost, and is not duplicated when the app later flushes
- [ ] A widget action refused by the geofence explains itself rather than silently failing
- [ ] Repeated widget taps produce one record

## Tasks
- Set up the platform widget targets and a shared data container between app and widget
- Render shift, clock state, and signed-out state against the shared design tokens
- Implement refresh on schedule and after in-app clock actions
- Implement the quick action through the shared idempotent submission path, with deep-link fallback
- Test signed-out, stale data, offline queueing, geofence refusal, and repeated taps

## Out of Scope
Lock-screen and watch complications, leave or payslip widgets, and interactive widgets on platform versions that do not support them — those fall back to deep-linking.
