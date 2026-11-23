---
phase: 01-settings-split-and-good-moments
plan: 06
subsystem: ui
status: complete
tags: [react, budget, ready-to-assign, copy, vitest, playwright, lint-terms]

requires:
  - "01-05: wave-f at 5064d5e; components/ui/Plant.tsx (seedling stage, size, ground, pass-through attributes)"
provides:
  - "utils/fundingStatus.ts: UnresolvedCause, unresolvedCauses (the one cause list), figureInDoubt (the shared in-doubt helper), unresolvedReason built from the list, ReadyStatus, readyToAssignStatus (the hero's pure state)"
  - "BudgetSummaryWidget renders every hero label and colour from readyToAssignStatus on the phone row and the desktop block"
  - "Test id ready-glyph on the hero's 16 px seedling"
  - "lint/terms RETIRED row: the old $0 label -> 'Every dollar has a job'"
affects: [01-07, docs-ui-handover, docs-ui-map]

actuals:
  tokens: 7571
  tasks: 2
  commits: 2
plan_head_before: 5064d5edc1ba7aabf53a67857d1cf642e12c65b6
plan_head_after: 6d0bb8eb77bf95688e4b5ed5b1fd50ec17416198

tech-stack:
  added: []
  patterns:
    - "Pure view state for a hero: one exported function returns { bg, text, label, labelClass, figureClass, glyph }; the component only renders"
    - "One cause list, two consumers: unresolvedCauses feeds both the todo sentence and the $0 caveat label"

key-files:
  created: []
  modified:
    - client/src/utils/fundingStatus.ts
    - client/src/utils/fundingStatus.test.ts
    - client/src/components/budget/BudgetSummaryWidget.tsx
    - client/src/index.css
    - lint/terms/terms.test.js
    - e2e/tests/budget.spec.ts
  deleted:
    - client/src/components/budget/SproutTick.tsx
    - client/src/components/budget/readyReached.ts
    - client/src/components/budget/readyReached.test.ts

key-decisions:
  - "The in-doubt helper is named figureInDoubt(f) (account issues, or complete false); the widget's doubtful value and readyToAssignStatus share it"
  - "Deviation from the UI-SPEC's 'resolved (or absent)' wording (RESEARCH Pitfall 5): with no summary (loading or failed) the hero shows no status label and a neutral look, never 'Every dollar has a job'. Praise needs a present summary with the server's resolved true and money in the budget"
  - "The caveat browser test used the planned scenario as written: $500 income, $500 assigned to Groceries, then a $600 Groceries expense today. Ready to assign stays $0 and the label is 'All assigned, but envelopes are overspent'; no fallback scenario was needed"
  - "Both older e2e assertions (budget.spec 'income is ready to budget…' and the hold test) show the clean label, so the server reports resolved true for those scenarios; neither needed weakening"
  - "The app writes zero as '$0' (whole dollars), not '$0.00' as the plan's behaviour text assumed; the browser tests locate the figure by '$0'"
  - "The desktop figure gets no new whitespace-nowrap (the phone figure already has it, which is where E7 overflow applies); the desktop subline is the redesign sentence in every case"

patterns-established:
  - "A retired copy string is guarded twice: a RETIRED row in lint/terms (non-test code) and a unit test that builds the old string from parts so client/src never contains it"

requirements-completed: [WAVF-05]

coverage:
  - id: D1
    description: "A clean $0 says 'Every dollar has a job' with the seedling glyph and a normal-colour figure"
    requirement: "WAVF-05"
    verification:
      - kind: unit
        ref: "client/src/utils/fundingStatus.test.ts#a clean $0 says every dollar has a job, with the seedling and a normal-colour figure"
        status: pass
      - kind: e2e
        ref: "e2e/tests/budget.spec.ts#reaching $0 Ready to assign says every dollar has a job, in normal colour (#241)"
        status: pass
    human_judgment: false
  - id: D2
    description: "At $0 with a caveat the label names it, never praises; the todo line stays"
    requirement: "WAVF-05"
    verification:
      - kind: unit
        ref: "client/src/utils/fundingStatus.test.ts#at $0 and unresolved (%o) the label names the job, not praise (7 rows)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/budget.spec.ts#at $0 with an overspent envelope the label names it instead of praising (#241)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No praise while the summary is absent; empty, doubtful, negative and positive cases unchanged"
    requirement: "WAVF-05"
    verification:
      - kind: unit
        ref: "client/src/utils/fundingStatus.test.ts#praises nothing while the summary is loading or has failed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The old label is gone from client/src and guarded"
    requirement: "WAVF-05"
    verification:
      - kind: unit
        ref: "lint/terms/terms.test.js#nothing in the client or server says /Fully budgeted/"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phone 390 px: caveat label visible, figure on one line, no sideways scroll"
    requirement: "WAVF-05"
    verification:
      - kind: e2e
        ref: "e2e/tests/budget.spec.ts#at $0 with an overspent envelope… (390 x 844 section)"
        status: pass
    human_judgment: true

duration: 25min
completed: 2026-11-15
---

# Phase 01 Plan 06: $0 Ready to assign Summary

**A $0 Ready to assign now says "Every dollar has a job", with a 16 px seedling, only when the server says the budget is resolved. When something is unresolved it names the problem instead ("All assigned, but envelopes are overspent", or a count). Every hero state comes from one pure function, `readyToAssignStatus`. A $0 figure is drawn in the normal text colour, and PR #273's animated tick is gone.**

## Performance

- Duration: about 25 minutes
- Tasks: 2 of 2
- Files: 6 modified, 3 deleted (wave-f)

## Accomplishments

- `unresolvedCauses` is now the only place the four cause checks live. `unresolvedReason` builds its sentence from it through `CAUSE_WORDS`, and the two original tests pass unchanged.
- `readyToAssignStatus(toBeBudgeted, incomePlanned, funding?)` covers seven cases, first match wins: in doubt, below zero, $0 with no summary, $0 with no money, clean $0, $0 with a caveat, and above zero. At $0, `figureClass` is always `text-text`.
- `BudgetSummaryWidget` holds no label text of its own. `getHeroStyle`, the `seen`/`celebrate` state and `SproutTick` are removed, and the desktop subline is back to "Money you have that isn't in a category yet."
- The lint terms guard now fails if the old $0 label comes back in client or server code. A temporary file containing the label made it fail, and the file was removed straight after.
- The tick's two motion tokens, their keyframes and their reduced-motion lines are gone. The goal plant's three tokens are untouched (6 matches before and after).

## Task Commits (wave-f, not pushed)

1. **Task 1 (tracer): a clean $0 says every dollar has a job, in normal colour**: `4d6afa3`
2. **Task 2: caveat browser test, retired-term guard, leftover motion tokens**: `6d0bb8e`

## Verification run

- `npm --prefix client test -- src/utils/fundingStatus.test.ts`: 16 passed. RED first: 14 failed before the implementation.
- `npm --prefix client test` (full suite): 75 files, 611 tests passed
- `npx tsc --noEmit` (client): clean
- `npm --prefix e2e test -- --project=desktop tests/budget.spec.ts`: 22 passed. RED first: the new clean-$0 test failed against the pre-change widget (no `ready-glyph`).
- `npm --prefix e2e test -- --project=desktop tests/budget.spec.ts tests/category-goals.spec.ts`: 31 passed, none flaky
- `npm --prefix e2e test -- --project=phone tests/phone/budget-first-phone.spec.ts`: 2 passed
- `npm --prefix lint test`: 86 passed, 0 failed
- `npm run lint` (lint/): 0 errors, 128 warnings (at the cap, not over)
- Greps: the old label has 0 matches in client/src and e2e/tests. Tick references: 0. `getHeroStyle`: 0. `unresolvedCauses|readyToAssignStatus` in fundingStatus.ts: 4. `figureClass` in the widget: 2. "Every dollar has a job" in fundingStatus.ts: 1. SproutTick.tsx: absent. `tick-draw|leaf-in` in index.css: 0. `animate-grow-in|animate-bloom`: 6.
- `git diff origin/redesign --name-only -- server/` lists only plan 04's two D-09 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the test spec] Zero is written "$0", not "$0.00"**
- **Found during:** Task 1, the first GREEN run of the browser test
- **Issue:** The plan's behaviour text locates the figure as "$0.00". `formatCurrency` writes whole dollars, so the page shows "$0" and the locator found nothing.
- **Fix:** Both browser tests locate the figure with `getByText('$0', { exact: true })`. The assertion on its class (`text-text`) is unchanged.
- **Files modified:** e2e/tests/budget.spec.ts
- **Commit:** 4d6afa3

**2. [Rule 1 - Test isolation] The retired-label unit test builds its own cases**
- **Issue:** The first draft collected labels from earlier tests into a shared array, so it depended on test order (the project rules forbid that).
- **Fix:** The test now builds its own list of 13 argument sets. It also builds the old label from two parts, so `grep -r` over client/src stays at 0.
- **Commit:** 4d6afa3

### Recorded for plan 07's PR body

- **In-doubt helper:** `figureInDoubt` in `client/src/utils/fundingStatus.ts`.
- **Caveat scenario:** the planned one: $500 income, $500 to Groceries, a $600 Groceries expense today. Ready to assign stays $0.
- **UI-SPEC deviation:** the spec says "resolved (or absent)" gives the clean label. Now an absent summary gives no label and a neutral look (RESEARCH Pitfall 5).
- **Docs:** `docs/ui/HANDOVER-UI.md` lines 19-20 still describe `SproutTick` and `readyReached.ts`. Plan 07 rewrites that entry; this plan did not touch docs.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust-boundary surface. The labels are fixed sentences, and the only number in any of them is a count of causes (T-01-16).

## Self-Check: PASSED

- FOUND: client/src/utils/fundingStatus.ts, client/src/utils/fundingStatus.test.ts, client/src/components/budget/BudgetSummaryWidget.tsx, client/src/index.css, lint/terms/terms.test.js, e2e/tests/budget.spec.ts (wave-f)
- ABSENT as intended: client/src/components/budget/SproutTick.tsx, readyReached.ts, readyReached.test.ts
- FOUND commits on wave-f: 4d6afa3, 6d0bb8e
