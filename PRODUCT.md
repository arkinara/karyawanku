# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML + Tailwind CDN (confirmed by user for prototype-impeccable; matches existing prototype, no build step, open directly in browser for side-by-side comparison).

## Users

Three roles, owner and employee served equally (confirmed):

- **Owner / HR admin** — full access; manage employees, salary components, payroll, settings.
- **Manager** — operational; mark attendance, approve leave, view roster.
- **Employee** — self-service; check-in, request leave, view own payslip, view own schedule.

Situation: Indonesian small businesses — cafe/restaurant and service businesses (salon, laundry, etc.).

## Product Purpose

Employee management web app (HRIS) for Indonesian small businesses. Handles onboarding, attendance, leave, payroll, and payslips so owners stop running HR on spreadsheets and employees self-serve routine tasks.

## Positioning

Indonesian-first HRIS: built-in compliance reference (BPJS Kesehatan, BPJS Ketenagakerjaan, PPh 21 progressive PTKP-based, THR, cuti per UU Cipta Kerja) that generic international tools do not carry.

## Operating Context

- Phase 1 = web app (Next.js + TypeScript + Tailwind + shadcn/ui + M3 + Drizzle + SQLite + Better Auth).
- Phase 2 = native mobile (Flutter) — out of scope for this iteration.
- Prototype surfaces: 7 pages (onboarding wizard, sign-in, owner dashboard, employee dashboard, employee directory, payroll run, payslip detail) plus an index viewer.

## Capabilities and Constraints

- Bahasa Indonesia UI throughout.
- IDR formatting (Rp), local date format DD/MM/YYYY.
- Compliance: BPJS Kesehatan, BPJS Ketenagakerjaan, PPh 21, THR, cuti (UU Cipta Kerja).
- Prototype is static HTML; no backend, no real auth, mock data.

## Brand Commitments

- Name: KaryawanKu.
- Language: Bahasa Indonesia.

## Evidence on Hand

- Existing prototype at `frontend/prototype/` (7 static HTML pages + viewer, M3-flavored Tailwind design, teal primary).
- PRD in Notion; feature specs as Notion child pages (see README).

## Product Principles

1. Indonesian-first: language, currency, dates, and compliance are defaults, not localization.
2. Owner and employee served equally: operational power and self-service simplicity in the same system.
3. Small-business fit: simple enough for a cafe owner, complete enough for payroll compliance.
4. Prototype fidelity: static pages must feel like the real product, not wireframes.
