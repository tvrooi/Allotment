---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: Redesign finish
current_phase: 01
current_phase_name: Settings split and good moments
status: executing
stopped_at: Completed 01-04-PLAN.md
last_updated: "2026-11-15T04:09:03.508Z"
last_activity: 2026-11-15
last_activity_desc: Phase 01 execution started
state_head: e0a92c4273e4f3976e2338c3d5e310577190e028
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-14)

**Core value:** Every figure the owner sees is right to the cent: bank money lands once, reconciles exactly, and each dollar sits in exactly one envelope.
**Current focus:** Phase 01 — Settings split and good moments

## Current Position

Phase: 01 (Settings split and good moments) — EXECUTING
Plan: 5 of 8
Status: Ready to execute
Last activity: 2026-11-15 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

Branch: `redesign` at 0.2.0-up.173, ahead of `main`; latest tag v0.2.0-up.153; up.154 to up.173 prepared, untagged.

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 15 min | 3 tasks | 19 files |
| Phase 01 P02 | 4 min | 2 tasks | 10 files |
| Phase 01 P03 | 11 min | 3 tasks | 16 files |
| Phase 01 P04 | 6 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions (`<decisions>` block). Recent ones affecting current work:

- [Init]: Milestone v1.0 is Waves F and G only; other open work is backlog (owner, 14 Nov 2026).
- [Init]: Built PRD requirements (32 of 38) are recorded as Validated, not re-planned.
- [Wave E]: Categories always use `CategoryPicker`; short lists use the shared styled `Select`. Wave G may replace the second half on desktop, pending decision 3.
- [Release]: Do not tag, publish or update the live app from `redesign` until the owner decides.
- [Phase 01]: Connected banks opens on Up when ?provider= is absent or not allowed (Up is the supported bank, first in the toggle)
- [Phase 01]: The provider lives only in the URL (?provider=, replace: true), so a pill clicked while /accounts/connections is open still switches it
- [Phase 01]: origin/redesign was already an ancestor of wave-f at 1627cae: no merge; wave-f holds no .planning file
- [Phase 01]: CONNECTED_BANKS_LINK kept as an alias of CONNECTED_BANKS_PATH until plan 02 re-points its six importers
- [Phase 01]: bankFeedLink maps a feed label to ?provider= through a fixed Object.hasOwn map; an unknown label opens /accounts/connections plainly (Up). Closes the Codex P1 on #273
- [Phase 01]: CONNECTED_BANKS_LINK removed; a unit guard keeps /accounts/connections, tab=connections and tab=categories in utils/movedSections.ts only
- [Phase 01]: 01-03: The Budget header Categories link uses data-guide budget.manage-categories so budget.categories still marks only the envelope list that guides target
- [Phase 01]: 01-03: Phone breadcrumb links get max-md:min-w-11 so a short label like Budget is a 44 px target
- [Phase 01]: 01-03: movedSettingsTab takes the whole URLSearchParams, keeps other parameters and drops tab; Settings opens on Accounts
- [Phase 01]: Palette-only pages live in PALETTE_PAGES beside NAV_PAGES (sidebar reads only NAV_PAGES); palette recents resolve through both lists so a moved page shows its own name and icon
- [Phase 01]: D-09 landed: the bank-linked delete 409 says Unlink it first: Accounts → Connected banks → {feed}; server diff is one string and one test expectation

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 gate] The owner's five Wave G decisions in #267 (dependencies, phones, picker rule, scope, dates) are needed before the G1 spec.
- [Release] Release of `redesign` is undecided. The orchestrator recommends one release soon because #246 is a Safe mode privacy fix.
- [Ingest W-1, unresolved] Pay-later plan accounts get payment funding at creation (PAYMENT-PLANS.md, and the code today) versus CARD-PAYMENTS.md's reviewed step. Owner decision; no side taken.
- [Ingest W-2, unresolved, money correctness] There is no rule for an account that is both an own-Ready-to-Assign pool and an envelope's followed account; only a category-level refusal exists (`assignPools.ts` `earmarkError`). Owner decision; no side taken.
- [Ingest W-3 to W-6, doc drift] HOUSEHOLDS.md, FORECASTS.md, the code's `TAX_READ`, and READ-ONLY-ACCESS.md plus INVESTMENT-SALES-AND-INCOME.md match the code. PLAN-2026-11 s3-4, the Phase 7 brief, READ-ONLY-ACCESS's tax list and INVESTMENTS.md are stale. Docs not edited; see PROJECT.md Open Questions.
- [Phase 1] WAVES.md says to delete itself once Wave F merges, but Wave G is planned from it. Decide before closing Phase 1.
- [Backlog] #269 (undo overwrites newer changes) and #270 (Safe mode level of register totals) are `needs-triage` and touch data and privacy. The owner may want them inserted.
- [Tooling] e2e ports are fixed (one browser run at a time); Node 24; the lint cap of 135 is full; never `E2E_SKIP_BUILD=1`.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-15T04:09:03.480Z
Stopped at: Completed 01-04-PLAN.md
Resume file: None
