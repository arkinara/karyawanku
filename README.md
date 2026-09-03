# KaryawanKu

[![CI](https://github.com/arkinara/karyawanku/actions/workflows/ci.yml/badge.svg)](https://github.com/arkinara/karyawanku/actions/workflows/ci.yml)

Employee management web app for Indonesian small businesses — cafe/restaurant + service (salon, laundry, etc.).

Phase 1 = web app (Next.js + TypeScript + Tailwind + shadcn/ui + M3 + Drizzle + SQLite + Better Auth).
Phase 2 = native mobile (Flutter) — out of scope for this iteration.

## Indonesian-first

- Bahasa Indonesia UI
- IDR formatting (Rp)
- Local date (DD/MM/YYYY)
- Built-in compliance reference: BPJS Kesehatan, BPJS Ketenagakerjaan, PPh 21 progressive (PTKP-based), THR, cuti (UU Cipta Kerja)

## Three roles

- **Owner / HR admin** — full access; manage employees, salary components, payroll, settings
- **Manager** — operational; mark attendance, approve leave, view roster
- **Employee** — self-service; check-in, request leave, view own payslip, view own schedule

## Source of truth

| Surface | URL |
|---|---|
| PRD (Notion) | https://app.notion.com/p/KaryawanKu-Product-Requirements-Document-3c18f6b0a7a581db9d05dc50388fe6b0 |
| Feature specs (Notion child pages) | see `/tmp/pm-specs-notion.json` or Notion sidebar |
| GitHub repo | https://github.com/arkinara/karyawanku |
| Kanban board (KaryawanKu Board) | https://github.com/users/arkinara/projects/15 |

## Workflow

This repo uses the `product-ux-dev-qa-workflow` skill:
1. PM creates PRD + tickets (done)
2. UX builds prototype (Claude Opus 5)
3. Dev builds per-ticket (OpenCode + GLM 5.2 primary, MiniMax-M3 failover)
4. QA per-ticket (OpenCode + MiniMax-M3 primary, Sonnet 5 failover)
5. Push directly to `main` — no feature branches

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every PR to `main`: backend,
frontend, and mobile run in parallel. A red suite is visible immediately — there is no other gate.

### Mobile

Pinned to the Flutter SDK in `mobile/.flutter-version` (3.47.0) via `subosito/flutter-action@v2`
(`channel: 3.47.0`, never `stable`), with `~/.pub-cache` cached off `mobile/pubspec.lock`:

- `dart format --set-exit-if-changed lib test`
- `flutter analyze`
- `flutter test --reporter=expanded`
- `flutter build apk --release`

The Android release APK is uploaded as a CI artifact (14-day retention). The iOS release build is
omitted from CI — it needs a provisioning profile + signing identity that GitHub-hosted runners do
not have, so the build matrix for the mobile app focuses on Android.

## Linting & formatting

- **Backend** — `cd backend && npm run lint` (`eslint . --ext .ts`, typescript-eslint recommended).
- **Frontend** — `cd frontend && npm run lint` (`next lint`, `next/core-web-vitals` + typescript-eslint).
- **No-mock-in-app rule** — ESLint forbids importing `*-mock` modules from `frontend/src/app/**`:
  `Do not import mock data from app/ — wire to real API instead`. This enforces the mock-retirement
  work (ticket #60); mock helpers may still be imported from `tests/` or `src/lib/`.

## Lane semantics

| Status | Set when |
|--------|----------|
| Todo | Issue created, not yet picked up |
| In Progress | Dev actively coding |
| In QA | Code on `main`, QA testing |
| Done | Code pushed to `main` |

## Helpers

- `scripts/add-in-qa-lane.py` — add `In QA` lane to the Status field of a 3-lane GitHub Project
- `scripts/move-board.py` (from the workflow skill) — move issues between Status lanes

## Backend wiring

Phase-1 screens hit the Fastify BE at `http://localhost:3001` (set `NEXT_PUBLIC_API_BASE_URL`
to override). The following features are wired end-to-end (ticket #44):

- **Onboarding** — step 1 collects the business profile + owner account, "Selesaikan Setup"
  calls `POST /api/businesses` (adopts the returned JWT/user session, redirects to `/dashboard`);
  step 2 fetches defaults via `GET /api/salary-components?defaults=true` (falls back to local
  defaults when the visitor has no session yet); step 3 marks the toggled subset as defaults via
  `PUT /api/businesses/:id/default-salary-components`.
- **Settings → Profil Bisnis** — form prefills from `GET /api/businesses/:id`, "Simpan Perubahan"
  calls `PATCH /api/businesses/:id`.
- **Settings → Komponen Gaji** — lists defaults from
  `GET /api/businesses/:id/default-salary-components` with add/edit/delete against
  `/api/salary-components` (new rows are added to the default set).
- **Slip Gaji viewer** — the detail dialog renders every earnings/deduction line from
  `GET /api/payslips/:id` (breakdown), degrading to a "Rincian tidak tersedia" placeholder when
  the breakdown is empty.
