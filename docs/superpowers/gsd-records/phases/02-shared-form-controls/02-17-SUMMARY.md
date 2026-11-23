---
phase: 02-shared-form-controls
plan: 17
subsystem: e2e
tags: [e2e, category-picker, search-list, selectors]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 10
    provides: "e2e/tests/fixtures.ts: categoryOption, and the pinned row's role (option)"
provides:
  - "The Review, demo Review, payee, rules and recurring specs locate category-list rows only through categoryOption"
  - "The measured list of every category-row selector in this plan's seven spec files (below)"
affects: [02-18]
requirements-completed: [WAVG-02, WAVG-03]
actuals:
  tasks: 2
  commits: 2
plan_head_before: a6bc425
plan_head_after: 8225df5
tech-stack:
  added: []
  patterns:
    - "A temporary role experiment (rows given role option in CategoryPicker, categoryOption switched to option) finds every positive row selector a spec still holds on the button role; negative ones are found by reading"
key-files:
  created: []
  modified:
    - e2e/tests/review.spec.ts
    - e2e/tests/demo/review.spec.ts
    - e2e/tests/payees.spec.ts
    - e2e/tests/rules.spec.ts
    - e2e/tests/recurring.spec.ts
key-decisions:
  - "payees.spec.ts:154 ('No default category') is the picker's no-category row (CategoryPicker noneLabel, via DefaultCategoryButton), not a trigger, so it moves onto categoryOption; the plan's starting list did not name it, the experiment found it"
duration: ~12 min
completed: 2026-11-18
---

# Phase 02 Plan 17: Category-row selectors onto categoryOption Summary

**Every category-list row the Review, demo Review, payee, rules and recurring specs locate now goes
through `categoryOption`, measured by a reverted role experiment plus a reading for negative
checks; no client file or fixture is committed.**

## Performance

- Started: 2026-11-18T03:38:45Z
- Completed: 2026-11-18T03:50Z
- Tasks: 2, commits: 2
- Files modified: 5 spec files (2 of the 7 needed no change)

## Measured list (this plan's seven spec files)

Line numbers are those of the file before and after this plan (only same-line replacements, plus the
demo spec's added import, which shifts its site from 24 to 25).

| File | Line | Kind | Selector before | How found |
|------|------|------|-----------------|-----------|
| `e2e/tests/review.spec.ts` | 48 | positive (phone tap-target size) | `page.getByRole('button', { name: 'Groceries', exact: true })` | reading (the experiment hid it behind line 55 on desktop; on phone it fails, see negative case) |
| `e2e/tests/review.spec.ts` | 55 | positive | `page.getByRole('button', { name: 'Groceries', exact: true })` | experiment |
| `e2e/tests/review.spec.ts` | 56 | **negative** (`toHaveCount(0)`, no "Rent" row while search shows Groceries) | `page.getByRole('button', { name: 'Rent', exact: true })` | reading only (passes vacuously under the experiment, shown below) |
| `e2e/tests/review.spec.ts` | 175 | positive | `page.getByRole('button', { name: 'Groceries', exact: true })` | experiment |
| `e2e/tests/demo/review.spec.ts` | 24 (25 after) | positive | `page.getByRole('button', { name: 'Groceries', exact: true })` | reading (moved before the demo run under the experiment) |
| `e2e/tests/payees.spec.ts` | 154 | positive (no-category row, "No default category") | `page.getByRole('button', { name: 'No default category' })` | experiment |
| `e2e/tests/rules.spec.ts` | 44 | positive | `page.getByRole('button', { name: /Coffee Shops/ })` | experiment |
| `e2e/tests/recurring.spec.ts` | 234 | positive (picked with no search) | `page.getByRole('button', { name: 'Power', exact: true })` | experiment |

Each now reads `categoryOption(page, <same name>, <same exact>)`; the three without `exact` keep none.

**Files that needed no change:** `e2e/tests/review-payees.spec.ts` and `e2e/tests/review-undo.spec.ts`.
Both pick categories by filling "Search categories" and pressing Enter, so they locate no row; their
`toHaveCount(0)` checks target triggers (`Category for …`), regions and toasts, not rows.

**Kept on the button role (not rows):** triggers (`review.spec.ts:31,89-101,156,177`,
`review-payees.spec.ts:47,51,138,186,200`, `review-undo.spec.ts:21,86`, `demo/review.spec.ts:19,81`,
`payees.spec.ts:72,76,146,153`, `rules.spec.ts:42`, `recurring.spec.ts:90,94,232`), "Create new
category" (`review.spec.ts:43`, `recurring.spec.ts:91`), "Create" (`recurring.spec.ts:93`) and the
search field (textbox). `grep -rn "Create new category" e2e/tests` shows the same two button-role
selectors as before.

## How the role experiment was applied

1. `client/src/components/transactions/CategoryPicker.tsx`: `role="option"` added to the no-category
   row button and to each section row button (categories and "Transfer: …" rows share that map).
   Option for the no-category row too, as 02-10-SUMMARY records for SearchList's pinned row.
2. `e2e/tests/fixtures.ts`: `categoryOption` returned `scope.getByRole('option', …)`.
3. Ran the plan's specs (desktop; demo for the demo spec), moved each failing row site, reran.
4. Reverted with `git checkout -- client/src/components/transactions/CategoryPicker.tsx e2e/tests/fixtures.ts`
   after each task; the guard `git status --porcelain -- client e2e/tests/fixtures.ts <02-20 and 02-18 specs>`
   printed nothing (`experiment-reverted`). The specs owned by 02-20 and 02-18 were neither run nor edited.

## Runs

- Baseline, unchanged picker, before any change: 6 desktop specs, 39 passed.
- Task 1, experiment on, before moving: `review.spec.ts` 4 failed (lines 55 and 175); after moving:
  desktop Review specs 19 passed, demo Review 2 passed.
- **Negative case** (experiment on): `review.spec.ts:48` put back on `getByRole('button', …)` made
  "the review resolves items in place … on a phone" fail (1 failed, 6 passed); restored.
- **Vacuous pass shown once** (experiment on): `review.spec.ts:56` put back on the button role, the
  test at `review.spec.ts:4` still passed (2 passed), which is why negative checks are found by reading; restored.
- Task 1, unchanged picker: desktop Review specs 19 passed; demo Review 2 passed.
- Task 2, experiment on, before moving: 4 failed (`payees.spec.ts:154`, `recurring.spec.ts:234`,
  `rules.spec.ts:44` twice), 16 passed; after moving: 20 passed.
- Task 2, unchanged picker: 20 passed. `cd e2e && npx tsc --noEmit`: clean.
- Prettier check on the five changed specs: clean.

## Plan verification commands

- `npm --prefix e2e test -- --project=desktop tests/review.spec.ts tests/review-payees.spec.ts tests/review-undo.spec.ts`: 19 passed.
- `npm --prefix e2e test -- --project=demo tests/demo/review.spec.ts`: 2 passed.
- `grep -c 'categoryOption' e2e/tests/review.spec.ts`: 5 (≥ 4).
- `npm --prefix e2e test -- --project=desktop tests/payees.spec.ts tests/rules.spec.ts tests/recurring.spec.ts`: 20 passed.
- `grep -c 'categoryOption' e2e/tests/rules.spec.ts`: 2 (≥ 2).
- Revert guard: `experiment-reverted` printed after both tasks.
- `(cd e2e && npx tsc --noEmit)`: exit 0.
- `git diff a6bc425..HEAD -- client server`: empty. `git log --name-only a6bc425..HEAD` touches only
  the five changed spec files. No skip, retry, timeout or wait added.

## Task Commits

1. **Task 1: Review specs** - `53f3193` (test)
2. **Task 2: payee, rules and recurring specs** - `8225df5` (test)

## Decisions Made

- `payees.spec.ts:154` moved: it is a list row (the no-category row), found by the experiment though
  absent from the plan's starting list.

## Deviations from Plan

None - plan executed exactly as written. (The `<start>` for the file check is `a6bc425`, the
worktree's base, rather than `origin/redesign`, which is behind local `redesign`.)

## Issues Encountered

None.

## Next Phase Readiness

Plan 02-18 can switch `categoryOption`'s role to `option` in one place for these seven specs; its
mutation on the Review filter test should now fail as expected, since `review.spec.ts:56` goes
through the helper.

## Self-Check: PASSED

- `e2e/tests/review.spec.ts` contains `categoryOption` (5); `e2e/tests/demo/review.spec.ts` imports only `categoryOption` from `../fixtures`.
- Commits `53f3193` and `8225df5` exist on `worktree-agent-p0217-a1`.
- No STATE.md, ROADMAP.md, client or fixtures change.
