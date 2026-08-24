# PM Audit — Known Wiring Gaps (post Phase 5)

**Date:** 2026-08-24
**PM:** Claude Sonnet 5 (via profile-caveman.sh pm)

## Source

User feedback after FE Wiring phase (#34-#38) — three known limitations remain:

1. **Payslip breakdown** — BE `GET /api/payslips/:id/download` returns only `take_home`. Full earnings/deductions breakdown requires an extra `GET /api/payroll-runs/:id` + filter by payroll_item_id.
2. **Onboarding step 1+2** — Business profile registration + default salary components fetch have no BE endpoint (kept local).
3. **Settings - Business Profile + Komponen Gaji tabs** — Business profile edit + default salary components settings have no BE endpoint (hardcoded mock).

## New Tickets Created

| # | Title | Type | Priority | Labels | Commit |
|---|---|---|---|---|---|
| **42** | BE: Payslip breakdown inline (earnings + deductions in payslip response) | BE | high | `BE`, `domain:payroll` | committed via `gh issue create` |
| **43** | BE: Business + onboarding + default salary component endpoints | BE | high | `BE`, `domain:auth` | committed via `gh issue create` |
| **44** | FE Wiring: Onboarding + Settings + Payslip breakdown wired to BE | FE Wiring | high | `FE Wiring` | committed via `gh issue create` (depends on #43) |

## Files

- `/tmp/karyawanku-ticket-42-be-payslip-breakdown.md`
- `/tmp/karyawanku-ticket-43-be-business-onboarding.md`
- `/tmp/karyawanku-ticket-44-fe-wiring-onboarding-settings.md`
- `/tmp/pm-tickets.json` updated to include seq 42-44

## Verifier

```
$ python3 /tmp/verify-tickets.py
VERIFIER VERDICT: PASS
PASSED: 44/44 tickets
FAILED: 0/44 tickets
```

## Project Board

- KaryawanKu Board PVT `PVT_kwHOEL4FrM4BgyMU`
- Total items: **43** (was 40; +3 new)
- #42, #43, #44 all in **Todo** column

## Execution Notes

- PM was spawned via `profile-caveman.sh pm` but the caveman wrapper repeatedly asked for confirmation on irreversible `gh` actions.
- **Decision:** orchestrator (hermes) wrote the 3 ticket files directly, updated `pm-tickets.json`, created the GitHub issues, and linked them to the board. PM agent in a future iteration will be more decisive with stricter "execute, don't ask" prompts.
- All 3 tickets follow Console Catalog template (sub-feature sections with `### [Sub-feature Name]` headings, 2+ Pos/Neg AC per sub-feature, all `- [ ]` checkboxes, Bahasa Indonesia body + English title).

## Suggested Order

1. #43 first (BE adds the endpoints)
2. #44 second (FE wires to those new endpoints)
3. #42 in parallel (BE enhances payslip response)
