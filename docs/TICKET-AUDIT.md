# KaryawanKu — Ticket Audit Report (2026-08-23)

Cross-checked `/tmp/pm-tickets.json` (38 tickets) against:
- PRD's 7 Phase-1 features (`/tmp/pm-prd-final.md`)
- ProMax's 7 static pages (`frontend/prototype-promax/01..07-*.html`)
- UX-SPEC.md §0 Locked decisions (2026-08-19): ProMax tokens, 2 roles (owner/employee, no Manager), dark mode w/ system pref + app-bar toggle

## Summary

- COVERS cleanly: **18 / 38**
- NEEDS-UPDATE (ticket exists, scope is right, but text/AC contradicts a locked decision): **20 / 38**
- Hard GAP (feature/page with no ticket at all): **3** → covered by new tickets #39–#41 below
- New tickets proposed: **3**

---

## Systemic finding #1 — Manager role leakage (affects 20/38 tickets)

UX-SPEC §0 locks the role model to **owner + employee only** ("Manager deferred — Owner covers HR admin; Employee covers everyone else. Matches ProMax NAV map."). The PRD (`/tmp/pm-prd-final.md`) still describes a 3-role model (Owner/Manager/Employee) in Overview, Requirements, User Flow, and the `users.role` enum — the PRD was not updated after the 2026-08-19 lock. As a direct consequence, 20 of the 38 tickets inherited "Manager" as an actor: manager-only endpoints, manager-scoped queries, manager approval actions, "team scope" (a 3-tier concept that only makes sense with a manager tier between owner and employee).

None of these tickets are wrong in their *feature* scope — attendance correction, leave approval, roster publishing, dashboard aggregation, CSV export gating, etc. are all real Owner-side needs — they just need the actor relabeled from "Manager"/"Owner/Manager" to "Owner", and any "team scope" language collapsed to "business scope" (single flat scope: Owner sees all employees in their business, Employee sees only self). This is a terminology/AC fix, not a redesign, so per the "don't propose rewrites" rule these are flagged here for the ticket author to patch, not rewritten by this audit.

Affected tickets (NEEDS-UPDATE — Manager reference):
- #02 FE Auth sign-in/sign-up — role list "owner/manager/employee" in AC
- #03 FE Quick Dashboard — role-based rendering built around Owner/Manager/Employee (3-way switch); ProMax only defines owner/employee dashboards (03 vs 04)
- #04 FE Employee Directory — "Owner/Manager" actor in 2 sub-features
- #05 FE Employee Detail — "Owner/Manager (dan Employee untuk profil sendiri)"
- #10 FE Attendance page — "Manager" does manual entry/correction
- #11 FE Leave page — "Manager/Owner" approval queue sub-feature
- #12 FE Shift Roster page — "Manager" grid editor + publish actor throughout
- #15 FE Settings page — "Pengguna & Role" sub-feature assigns role owner/manager/employee
- #17 BE Users CRUD + role assignment — role enum owner/manager/employee, promote/demote Manager AC
- #22 BE Attendance clock in/out — "Manager manual correction" endpoint note
- #23 BE Attendance aggregate — dedicated "Manual attendance correction (Manager)" sub-feature
- #24 BE Leave types/balances — "Manager sees team only" scoping AC
- #25 BE Leave requests + approval flow — "Manager/Owner" approval actor, "Manager team scope" throughout
- #26 BE Shifts + assignments CRUD — "Manager" write scope, "team scope" checks
- #27 BE Roster publish — "Manager" publish actor, "Manager's own team" scope
- #32 BE Payroll export CSV — "Owner/Manager" access gate
- #33 BE Dashboard aggregation — "owner/manager lihat tim" scoping
- #35 FE Wiring Attendance — "Manager" manual correction wiring
- #36 FE Wiring Leave — "Manager" approve/reject wiring
- #38 FE Wiring Dashboard — "owner/manager/employee" role branch

**Recommendation:** before Dev picks these up, do a global find/replace pass on the 20 ticket bodies: `Manager` → `Owner`, `Owner/Manager` → `Owner`, `"team scope"` → `"business scope"` (drop the manager-tier distinction), and drop any AC that specifically tests promote/demote-to-Manager (ticket #17) since that role no longer exists. This audit does not perform that rewrite (out of scope per instructions) — flagging only.

## Systemic finding #2 — ProMax prototype has no mockup for 3 of 7 PRD Phase-1 features

ProMax's `assets/kk.js` NAV map defines `attendance` and `leave` nav items for both roles, but their `href` is `'#'` — there is no `08-attendance.html`, `09-leave.html`, or `10-shift-roster.html` in `frontend/prototype-promax/`. Only Dashboard (03/04), Employee Directory (05), Payroll (06), and Payslip (07) have a built reference page. Tickets #10 (Attendance), #11 (Leave), #12 (Shift Roster) are legitimate FE tickets, but Dev has no pixel reference for them — only `kk.css` component classes (`.card`, `.data-table`, `.chip`, `.segmented`, `.field`) to compose from. Not treated as a ticket gap (tickets exist), but flagged so Dev/PM know these three pages need extra design judgment calls or a follow-up prototype page before/while building.

---

## Per-ticket status (all 38)

| # | Title | Status | Note |
|---|---|---|---|
| 1 | FE Setup Wizard/Onboarding | COVERS | Matches `01-onboarding-wizard.html` (stepper, centered card, business profile + salary defaults steps) |
| 2 | FE Auth sign-in/sign-up | NEEDS-UPDATE | "owner/manager/employee" role list in AC line 18 |
| 3 | FE Quick Dashboard | NEEDS-UPDATE | Built as 3-way Owner/Manager/Employee switch; ProMax only has owner (03) vs employee (04) dashboard. Also relies on Priority Banner / Metric Card primitives that don't exist yet as components — see ticket #41 |
| 4 | FE Employee Directory | NEEDS-UPDATE | "Owner/Manager" actor phrasing, otherwise matches `05-employee-directory.html` well (search, filter chips, data-table, mobile card list, pagination) |
| 5 | FE Employee Detail | NEEDS-UPDATE | "Owner/Manager" actor phrasing |
| 6 | FE Employee Add/Edit form | COVERS | |
| 7 | FE Employee CSV Import | COVERS | Column-mapping step explicitly present (auto-suggest + manual override sub-feature) |
| 8 | FE Salary Components builder | COVERS | |
| 9 | FE Employee Salary Assignment | COVERS | |
| 10 | FE Attendance page | NEEDS-UPDATE | "Manager" does manual entry; no ProMax mockup exists (see finding #2) |
| 11 | FE Leave page | NEEDS-UPDATE | "Manager/Owner" approval actor; no ProMax mockup exists |
| 12 | FE Shift Roster page | NEEDS-UPDATE | "Manager" grid editor actor throughout; no ProMax mockup exists |
| 13 | FE Payroll Run page | COVERS | Matches `06-payroll-run.html` (metric cards, data-table breakdown, export/approve actions) |
| 14 | FE Payslip page | COVERS | Matches `07-payslip-detail.html`; PDF viewer + download button both in scope, correctly split from BE PDF generation (#31) |
| 15 | FE Settings page | NEEDS-UPDATE | "Pengguna & Role" sub-feature assigns owner/manager/employee role; otherwise correctly scoped to owner-shell context (business profile, leave types, salary defaults) |
| 16 | BE Better Auth setup | COVERS | |
| 17 | BE Users CRUD + role assignment | NEEDS-UPDATE | Role enum + promote/demote-to-Manager AC directly contradict the 2-role lock; needs relabeling to owner/employee only, drop promote/demote-Manager AC entirely |
| 18 | BE Employees CRUD | COVERS | |
| 19 | BE Employee CSV import | COVERS | |
| 20 | BE Salary components CRUD | COVERS | |
| 21 | BE Employee salary assignment | COVERS | |
| 22 | BE Attendance clock in/out | NEEDS-UPDATE | "Manager manual correction" endpoint note |
| 23 | BE Attendance aggregate | NEEDS-UPDATE | Dedicated "Manual attendance correction (Manager)" sub-feature — actor should be Owner |
| 24 | BE Leave types/balances | NEEDS-UPDATE | "Manager sees team only" scoping AC |
| 25 | BE Leave requests + approval | NEEDS-UPDATE | "Manager/Owner" approval actor + team-scope language throughout |
| 26 | BE Shifts + assignments CRUD | NEEDS-UPDATE | "Manager" write scope + team-scope checks |
| 27 | BE Roster publish | NEEDS-UPDATE | "Manager" publish actor + team scope |
| 28 | BE Payroll run creation | COVERS | |
| 29 | BE BPJS calculation | COVERS | |
| 30 | BE PPh 21 calculation | COVERS | |
| 31 | BE Payroll approval + payslip PDF | COVERS | Correctly separate from FE payslip viewer (#14) |
| 32 | BE Payroll export CSV | NEEDS-UPDATE | "Owner/Manager" access gate |
| 33 | BE Dashboard aggregation | NEEDS-UPDATE | "owner/manager lihat tim" scoping |
| 34 | FE Wiring Employee Directory | COVERS | |
| 35 | FE Wiring Attendance | NEEDS-UPDATE | "Manager" manual correction wiring |
| 36 | FE Wiring Leave | NEEDS-UPDATE | "Manager" approve/reject wiring |
| 37 | FE Wiring Payroll Run | COVERS | |
| 38 | FE Wiring Dashboard | NEEDS-UPDATE | "owner/manager/employee" role branch in AC |

---

## Hard gaps → new tickets proposed

### Gap 1: AppShell (Nav Rail / Bottom Nav / App Bar / Drawer)

No ticket builds the shell that every page 03–07 (and by extension every FE ticket 3–15) is wrapped in. UX-SPEC §3 explicitly calls this out as its own component (`frontend/src/components/ui/app-shell.tsx`, props `userRole`, `activeNav`, `title`, `subtitle`). Ticket #1 (Onboarding) explicitly has no shell; none of the page tickets (#3–#15) include shell/rail/bottom-nav/app-bar construction in their DoD — they assume it exists. This is a blocking foundational gap.

**New ticket #39 — FE: AppShell — Nav Rail, Bottom Nav, App Bar & Drawer** (type FE, priority high)

### Gap 2: Dark mode theme system

Locked decision #3 (dark mode, system pref fallback, sun/moon toggle in app bar) has no dedicated ticket. The toggle button lives inside the AppShell visually, but the theme logic (persistence, system-preference detection, `<html class="dark">` toggling, Tailwind `darkMode:'class'` wiring, ProMax token adoption replacing v1 M3 names per locked decision #1) is a cross-cutting concern independent of any single page and deserves its own ticket with its own AC (rather than being buried as one line item inside #39).

**New ticket #40 — FE: Dark Mode Theme System (toggle, system preference, token migration)** (type FE, priority high)

### Gap 3: Shared UI primitives (Priority Banner / Metric Card / Data Table / Segmented Control)

Confirmed via `kk.css` review: `.banner-warning`, `.metric` cards, `.data-table`, and `.segmented` are used identically across Dashboard (#3), Payroll Run (#13), and Employee Directory (#4) — three separate FE tickets each currently expected to reinvent these instead of consuming a shared component contract. Dev's earlier audit flagged this as a gap. Rather than leaving each page ticket to (re)build ad-hoc banner/metric/table markup with inconsistent AC, a dedicated component-library ticket gives them one accessible, tested implementation the page tickets consume.

**New ticket #41 — FE: Shared UI Primitives (Priority Banner, Metric Card, Data Table, Segmented Control)** (type FE, priority medium)

### Explicitly NOT new tickets (checked, no gap found)

- **Onboarding → first-login journey**: covered by the combination of #1 (wizard) + #2 (auth redirect to dashboard by role) + #3 (dashboard render). No separate ticket needed.
- **Settings page owner-shell context**: #15 already scopes correctly to Owner; it depends on #39 (AppShell) existing but doesn't need its own new ticket.
- **CSV import column-mapping**: already a full sub-feature in #7 with its own AC (auto-suggest + manual override). No gap.
- **Payslip PDF**: FE download/viewer (#14) and BE generation (#31) are correctly split already; no missing ticket.

---

## New tickets appended

| Seq | Title | Type | Priority |
|---|---|---|---|
| 39 | FE: AppShell — Nav Rail, Bottom Nav, App Bar & Drawer | FE | high |
| 40 | FE: Dark Mode Theme System (toggle, system preference, token migration) | FE | high |
| 41 | FE: Shared UI Primitives (Priority Banner, Metric Card, Data Table, Segmented Control) | FE | medium |
