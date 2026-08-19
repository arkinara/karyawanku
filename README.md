# KaryawanKu

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
