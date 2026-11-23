---
phase: 03-screens-on-shared-controls
plan: 35
subsystem: testing
tags: [playwright, e2e, transactions, household, register, selection, uat-gap]

requires:
  - phase: 03-screens-on-shared-controls
    provides: Colour-only register row and card selection with role="checkbox" and inert covered toolbar (03-33, G-03-4)
provides:
  - Register desktop and household specs selecting rows via Playwright check()/uncheck() instead of label-clicking setToggle
  - Updated plain-click selection expectation and date-range row-count check matching 03-33 behaviour
  - Full green verification across desktop register specs, phone project, demo project, lint, and Prettier on fix/uat-03-row-selection
affects: [03-34]

actuals:
  tokens: 41173
  tasks: 2
  commits: 1
plan_head_before: edb3e917534d250fb46c6dcadd8a3c11ea8da4ae
plan_head_after: 4eb8b2ec8119bdeb1ba7f8205871166f5265a238

tech-stack:
  added: []
  patterns:
    - "Select register rows via Playwright .check() / .uncheck() on role='checkbox' rows (no wrapping <label>)"

key-files:
  created: []
  modified:
    - e2e/tests/transactions.spec.ts
    - e2e/tests/household.spec.ts

key-decisions:
  - "Replaced getByText('2 transactions') in 'changing the date range ends a whole-list selection' with getByTestId('transaction-row') toHaveCount(2), because SelectionSummary sits inside the invisible inert toolbar covered by the Selected transactions bar while selecting (03-33)"

patterns-established: []

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "All 26 register row selection calls in transactions.spec.ts (20) and household.spec.ts (6) use .check()/.uncheck(), the plain-click expectation in 'Cmd or Ctrl+click and Shift+click select rows without opening details' expects 5 selected with details closed, and the date-range test waits on rendered rows rather than the covered SelectionSummary"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/household.spec.ts (95 passed)"
        status: pass
      - kind: automated_ui
        ref: "cd e2e && npx tsc --noEmit (exit 0) + specs-ok grep gate (0 row setToggle calls)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Register desktop specs, full phone project, full demo project, ESLint (within 121-warning cap), and Prettier pass on fix/uat-03-row-selection"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/household.spec.ts tests/phase9.spec.ts tests/menus.spec.ts tests/transaction-filters.spec.ts tests/cleanup.spec.ts (112 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=phone (70 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=demo (29 passed)"
        status: pass
      - kind: other
        ref: "npm --prefix lint run lint (0 errors, 119 warnings <= 121) & prettier --check on 8 changed files (clean)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 35: Register Specs on Colour-Only Row Selection Summary

**Moved all 26 register row selections in `transactions.spec.ts` and `household.spec.ts` onto `.check()` / `.uncheck()`, updated the reversed plain-click and covered-toolbar expectations for 03-33, and verified green desktop register (112/112), phone (70/70), and demo (29/29) runs on `fix/uat-03-row-selection`.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-11-22T05:54:27Z
- **Completed:** 2026-11-22T06:11:27Z
- **Tasks:** 2
- **Files modified:** 2 (in code worktree `$HOME/Github/Allotment-worktrees/uat03-select`)

## Code Worktree & Branch

- **Code worktree:** `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select`
- **Branch:** `fix/uat-03-row-selection` (not pushed, no PR opened; `03-34` handles merge/PR)
- **Head commit before plan:** `edb3e917534d250fb46c6dcadd8a3c11ea8da4ae` (end of 03-33)
- **Head commit after plan:** `4eb8b2ec8119bdeb1ba7f8205871166f5265a238`
- **GSD worktree base (`agent-p0335-uat2-a1`):** `54cca003392c250922d35c0c001c583377b7615d` (holds `docs/superpowers/gsd-records/`, `SUMMARY.md` committed here; `STATE.md` and `ROADMAP.md` untouched)

## Accomplishments

- Converted all 20 register-row `setToggle(page.getByRole('checkbox', { name: /^Select .../ }))` calls in `e2e/tests/transactions.spec.ts` to `.check()` (17 calls) and `.uncheck()` (3 calls), while preserving `setToggle` for the non-row `'Everyday Checking'` checkbox.
- Converted all 6 register-row `setToggle(...)` calls in `e2e/tests/household.spec.ts` to `.check()` and removed the unused `setToggle` import.
- Updated `"Cmd or Ctrl+click and Shift+click select rows without opening details"` so a plain click on the fifth row while selecting expects `'5 selected'` and `'Transaction details'` closed (`toHaveCount(0)`).
- Updated `"changing the date range ends a whole-list selection"` to assert `getByTestId('transaction-row')` count `2` rather than `getByText('2 transactions')` inside the `invisible` inert toolbar covered by the `Selected transactions` bar.
- Confirmed all 17 previously failing desktop selection specs from 03-33 now pass, along with the full register desktop suite, full `phone` project, full `demo` project, ESLint, and Prettier.

## Task Commits

Committed on `fix/uat-03-row-selection` in `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select`:

1. **Task 1: Select rows with check() and uncheck(), and the plain-click expectation** - `4eb8b2ec8119bdeb1ba7f8205871166f5265a238` (`test(03-35): select register rows via check/uncheck and update plain-click expectation`)
2. **Task 2: The register's suites, lint and format on the branch** - verification-only pass (no additional files changed)

**Plan metadata:** `docs(03-35)` commit adding this `03-35-SUMMARY.md` in the GSD worktree.

## Files Created/Modified

- `e2e/tests/transactions.spec.ts` - 20 row `setToggle` calls converted to `.check()`/`.uncheck()`, plain-click expectation updated (`5 selected`, details closed), date-range assertion updated (`transaction-row` count 2).
- `e2e/tests/household.spec.ts` - 6 row `setToggle` calls converted to `.check()`, unused `setToggle` import removed.

## Verification

Exact results run in `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select` after final commit `4eb8b2ec8119bdeb1ba7f8205871166f5265a238`:

- **Specs gate & TypeScript:**
  - `grep -cF "setToggle(page.getByRole('checkbox', { name: /^Select "` across `transactions.spec.ts` and `household.spec.ts`: `0` (`specs-ok`)
  - `cd e2e && npx tsc --noEmit`: exit `0`
  - Diff guard (`test.skip|test.fixme|retries|waitForTimeout` added): `0`
- **Desktop (`transactions.spec.ts` + `household.spec.ts`):** `95 passed` (0 failed, 3.1m) — all 17 selection specs that failed after 03-33 now pass:
  1. `Select all makes the whole list the selection › a row unticked after Select all is left out of a review, and the bar says 2 selected`
  2. `Select all makes the whole list the selection › a row unticked after Select all is not deleted`
  3. `Select all makes the whole list the selection › changing the date range ends a whole-list selection`
  4. `ticked transactions are marked reviewed from the right-click menu, the rest untouched`
  5. `ticked transactions take a new payee from the right-click menu`
  6. `deleting ticked transactions from the selection menu › ticked transactions are deleted from the right-click menu after typing delete`
  7. `deleting ticked transactions from the selection menu › a ticked reconciled transaction is kept, and the dialog says so`
  8. `the selection menu makes the changes the Edit dialog did › Category… sets the category of the ticked rows, and Uncategorised clears it`
  9. `the selection menu makes the changes the Edit dialog did › Replace notes… and Remove notes change the notes of the ticked rows only`
  10. `the selection menu makes the changes the Edit dialog did › Add tag, Remove tag and Reports change the ticked rows only`
  11. `the selection menu makes the changes the Edit dialog did › with no tags there are no tag items, and one row reads "1 transaction"`
  12. `the selection menu makes the changes the Edit dialog did › a ticked transfer keeps its category and the toast says it was left alone`
  13. `the selection menu makes the changes the Edit dialog did › a ticked row removed before the edit applies is refused, and the selection catches up`
  14. `while saving is paused the selection menu offers no change, then offers them again`
  15. `selecting transactions in the register › Cmd or Ctrl+click and Shift+click select rows without opening details`
  16. `selecting transactions in the register › a search keeps the selected rows still listed and drops the rest`
  17. `selecting transactions in the register › with nothing selected, More actions is off and a row keeps its own menu`
  (Plus the 3 household register selection tests in `household.spec.ts`.)
- **Desktop register suite (`transactions`, `household`, `phase9`, `menus`, `transaction-filters`, `cleanup`):** `112 passed` (0 failed, 3.4m)
- **Phone project (`--project=phone`):** `70 passed` (0 failed, 2.7m)
- **Demo project (`--project=demo`):** `29 passed` (0 failed, 1.1m)
- **Lint (`npm --prefix lint run lint`):** exit `0`, `✖ 119 problems (0 errors, 119 warnings)` (cap `121`, zero new warnings)
- **Prettier (`prettier --check --ignore-unknown` on all 8 files changed vs `origin/redesign`):** exit `0`, all 8 matched files clean
- **Branch diff scope (`git diff --name-only origin/redesign`):** exactly 8 files (03-33's 7 files + `e2e/tests/household.spec.ts`)

## Decisions Made

- Left `setToggle` on `'Everyday Checking'` in `e2e/tests/transactions.spec.ts:564` untouched because it is a filter checkbox rendered with the shared `Checkbox` component, not a register row.
- Kept all test titles (`ticked`, `unticked`) and locators (`getByRole('checkbox', { name: /^Select .../ })`) unchanged per plan instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / 03-33 Covered Toolbar Expectation] `changing the date range ends a whole-list selection` asserted visibility of covered `SelectionSummary`**
- **Found during:** Task 1 verification (`desktop tests/transactions.spec.ts`)
- **Issue:** Line 1759 asserted `await expect(page.getByText('2 transactions')).toBeVisible()` after switching to `All time` while selecting remains active (`0 selected`). Because 03-33 marks the underlying toolbar `invisible` and `inert` behind the overlaid `Selected transactions` bar while selecting, `SelectionSummary`'s `'2 transactions'` span is hidden.
- **Fix:** Updated `e2e/tests/transactions.spec.ts:1759` to assert `await expect(page.getByTestId('transaction-row')).toHaveCount(2)` so the test still waits for both rows to render after the filter refetch without expecting the covered toolbar text to be visible.
- **Files modified:** `e2e/tests/transactions.spec.ts`
- **Verification:** `changing the date range ends a whole-list selection` passed in both the 95-test and 112-test desktop runs.
- **Committed in:** `4eb8b2ec8119bdeb1ba7f8205871166f5265a238` (Task 1 commit)

**Total deviations:** 1 spec expectation updated for 03-33 behaviour (documented in `For 03-34`). **Impact:** None on production code or branch file scope.

## For 03-34

Every changed selector and expectation on `fix/uat-03-row-selection` from 03-35, with its reason for the PR:

| File & Lines | Old | New | Reason |
|---|---|---|---|
| `e2e/tests/transactions.spec.ts` (17 lines: 1822-1823, 1875-1876, 1953-1954, 1983-1984, 2015-2016, 2152-2153, 2219-2220, 2358-2359, 2387) | `setToggle(page.getByRole('checkbox', { name: /^Select .../ }))` | `page.getByRole('checkbox', { name: /^Select .../ }).check()` | 03-33 removed the checkbox column and its wrapping `<label>` (`ancestor::label[1]`); each row is now its own `role="checkbox"` toggled via `.check()`. |
| `e2e/tests/transactions.spec.ts` (3 lines: 1702, 1724, 2124) | `setToggle(page.getByRole('checkbox', { name: /^Select Mock two/ }), false)` | `page.getByRole('checkbox', { name: /^Select Mock two/ }).uncheck()` | Same removal of wrapping `<label>`; Playwright `.uncheck()` unticks the `role="checkbox"` row directly. |
| `e2e/tests/transactions.spec.ts` (lines 2321-2325, `"Cmd or Ctrl+click and Shift+click select rows without opening details"`) | Plain click on `rows.nth(4)` asserted `Transaction details` `complementary` visible and `'4 selected'` | Plain click on `rows.nth(4)` asserts `Transaction details` `toHaveCount(0)` and `'5 selected'` | Owner UAT G-03-4 (03-33): while selecting is active, a plain click toggles row selection instead of opening the details panel. |
| `e2e/tests/transactions.spec.ts` (line 1759, `"changing the date range ends a whole-list selection"`) | `await expect(page.getByText('2 transactions')).toBeVisible()` | `await expect(page.getByTestId('transaction-row')).toHaveCount(2)` | 03-33 overlays the `Selected transactions` bar over an `invisible` `inert` toolbar while selecting (`0 selected`), so `SelectionSummary` (`'2 transactions'`) is intentionally hidden behind the bar; counting rendered rows still proves both transactions loaded. |
| `e2e/tests/household.spec.ts` (line 2 & 6 lines: 477-478, 522-523, 569-570) | Imported `setToggle` and called `setToggle(page.getByRole('checkbox', { name: /^Select .../ }))` | Removed `setToggle` import; used `.check()` on each `getByRole('checkbox', { name: /^Select .../ })` locator | Same 03-33 removal of the checkbox column and wrapping `<label>`; `household.spec.ts` had no other `setToggle` calls. |

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. Only e2e test selectors and expectations changed; no application source, route, auth path, or dependency changed (`T-03-55`, `T-03-SC` satisfied).

## Next Phase Readiness

- `fix/uat-03-row-selection` in `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select` is at `4eb8b2ec8119bdeb1ba7f8205871166f5265a238` with all desktop register, phone, demo, lint, and Prettier checks passing, ready for `03-34` to merge into the UAT 03 round PR.

## Self-Check: PASSED

- `e2e/tests/transactions.spec.ts` and `e2e/tests/household.spec.ts` modified and committed in `$HOME/Github/Allotment-worktrees/uat03-select` (`4eb8b2ec8119bdeb1ba7f8205871166f5265a238`), ancestor of `HEAD` on `fix/uat-03-row-selection`.
- `git diff --name-only origin/redesign` lists only 03-33's 7 files plus `e2e/tests/household.spec.ts` (8 files total).
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-35-SUMMARY.md` created in GSD worktree (`agent-p0335-uat2-a1`) without modifying `STATE.md` or `ROADMAP.md`.
