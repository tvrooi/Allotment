# Phase 3: Screens on shared controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-16
**Phase:** 3-Screens on shared controls
**Areas discussed:** Number fields, Unnamed screens

The owner asked for D-01 to D-11 from Phase 2 to be carried forward and to be asked only about
what they leave open. Two points were open; everything else was taken from the roadmap, #267 and
the Phase 2 decisions without a question.

---

## Number fields

Finding shown first: Phase 3 screens hold about 10 `type="number"` fields. #267 says each migration
PR checks its own; the roadmap puts WAVG-08 in Phase 4.

**When should the ones on Phase 3 screens be fixed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fix with their screen (Recommended) | Each Phase 3 PR converts its own, with a failing test first; Phase 4 does the rest and proves none remain | ✓ |
| Leave all to Phase 4 | Phase 3 keeps `type="number"` and today's behaviour; Phase 4 converts all in one PR | |

## Unnamed screens

Finding shown first: Dashboard, Payment plans, Welcome, the sign-in screens, the receipts dialogs
and the app shell have fields but are in neither phase's list.

**Where should they move onto the shared controls?**

| Option | Description | Selected |
|--------|-------------|----------|
| Parent's PR, rest in Phase 4 (Recommended) | Sub-pages and dialogs travel with the screen that opens them; screens with no parent in Phase 3 go to Phase 4 | ✓ |
| All in Phase 3 | Phase 3 also takes the screens with no parent | |
| All in Phase 4 | Phase 3 touches only the twelve named screens' files | |

## Claude's Discretion

Missing variants extend the shared set; `budget/ExpectedNote.tsx` moves with Budget if Phase 2 left
it; neighbour controls stay; how each PR is cut into plans; e2e selector changes.

## Not asked (derived)

- Two PRs, G2 then G3, each with its own version (roadmap, #267).
- Plans were written before the audit existed, so each PR starts by checking the plan against the
  audit (D-16). Recorded by the orchestrator as a consequence of the owner asking for Phases 3 and
  4 to be planned before Phase 2 is executed.

## Deferred Ideas

None.
