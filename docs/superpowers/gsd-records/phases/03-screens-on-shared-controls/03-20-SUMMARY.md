---
phase: 03-screens-on-shared-controls
plan: 20
subsystem: ui
tags: [wave-g, g3, reports, month-picker, select, checkbox, in-02, in-03]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'G3 reconcile: match (03-16-SUMMARY.md)'
provides:
  - 'Reports (custom report builder and trend category picker) on the shared Select and Checkbox'
  - 'monthNames() in client/src/utils/dateRange.ts: the month grid names from date-fns'
  - 'MonthGrid maxYear prop: Next year disabled at the last selectable year'
affects: [03-23]
tech-stack:
  added: []
  patterns:
    - 'A spec that must run on both widths targets the shared Select as a button on desktop and as the native combobox on a phone'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-20-SUMMARY.md
  modified:
    - client/src/components/reports/AccountMultiSelect.tsx
    - client/src/components/reports/CategoryTreePicker.tsx
    - client/src/components/reports/ReportBuilderSidebar.tsx
    - client/src/components/reports/ReportDetail.tsx
    - client/src/components/ui/MonthPicker.tsx
    - client/src/components/ui/MonthPicker.test.ts
    - client/src/components/ui/MonthRangePicker.tsx
    - client/src/utils/dateRange.ts
    - e2e/tests/reports.spec.ts
    - e2e/tests/unsaved-drafts.spec.ts
    - e2e/tests/cash-flow.spec.ts
    - e2e/tests/gallery/dates.spec.ts
    - e2e/tests/gallery/month-range.spec.ts
key-decisions:
  - 'Month names come from one helper, monthNames(m) in utils/dateRange.ts, formatted by date-fns as formatMonth is'
  - 'MonthGrid also opens no later than maxYear, so a grid whose max is before this month does not open on a year with every month disabled'
  - 'MonthRangePicker passes maxYear from max (outside files_modified, required by the plan truth "or the range max")'
requirements-completed: []
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: 66acad77d1663b037bd6a8600eb8a94274e2fa5b
commits: 3
estimate:
  tokens: 70000
  tasks: 2
actuals:
  tokens: 6060
  tasks: 2
  commits: 3
duration: 'about 3 h wall clock, most of it waiting for shared e2e ports and the 24 min gallery container run'
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 20: Reports on the shared controls, and the month grid's IN-02 and IN-03 Summary

**The report builder's Group by is the shared Select (sm). The account, category-tree and trend-category rows are the shared Checkbox. The month grid gets its names from date-fns through one `monthNames` helper, and its Next year button stops at the last selectable year (`maxYear`).**

## Task 1: Report builder and report detail controls (`c639d937`)

- `ReportBuilderSidebar.tsx`: Group by is now `<Select fieldSize="sm" aria-label="Group by">`. It uses the same `GROUP_BY_OPTIONS`, filtered by `config.mode`, and the same values (`category`, `categoryGroup`, `payee`, `account`, `month`). Saved definitions, grouping and filters are unchanged (prohibition held).
- `AccountMultiSelect.tsx`, `CategoryTreePicker.tsx` (group rows and category rows), `ReportDetail.tsx` `TrendCategoryPicker`: each row is the shared `Checkbox` with the row label as its children, and the wrapping `<label>` is gone. The trend picker keeps its `disabled={full}` state (at `MAX_TREND_CATEGORIES`). Group rows had no indeterminate state before, so none was added. The select-all logic and toggle functions are untouched.
- `SaveReportModal` and `dashboard/NameModal` already use the shared `Input`. Checked and left unchanged.
- Raw-control gate over the four report files: HEAD 5, now **0**.

## Task 2: Month grid names and bounded Next year (RED `a91155f3`, GREEN `66acad77`)

- `utils/dateRange.ts`: `monthNames(m)` returns `{ short: 'Nov', long: 'November 2026' }`, formatted by date-fns (`MMM`, `MMMM yyyy`) the same way `formatMonth` writes `Nov 2026`.
- `MonthPicker.tsx`: the `SHORT` and `FULL` arrays are gone. The grid renders 12 months through `monthNames`. New prop `maxYear`: Next year is `isDisabled={year >= ceiling}`, and the opening year is clamped to `[floor, ceiling]`. The ceiling never drops below the floor. MonthPicker passes `maxYear` from `maxValue`.
- `MonthRangePicker.tsx`: both grids get `maxYear` from `max`.
- `cash-flow.spec.ts`: `MONTH_NAMES` is gone (HEAD 3, now **0**). Names are built with `toLocaleString('en-US', { month, timeZone: 'UTC' })`, the way `fillMonth` in fixtures.ts builds them.

## Closed review items

- **02-REVIEW IN-02**: closed. The month grid's month names come from date-fns, the same source as the trigger's `Nov 2026`. The e2e suite no longer keeps its own month-name list.
- **02-REVIEW IN-03**: closed. Next year is disabled at the year of `maxValue` (MonthPicker) or `max` (MonthRangePicker), as Previous year already was at its floor. The grid also opens no later than that year.

## Selector changes

| Spec | Before | After | Reason |
| --- | --- | --- | --- |
| `reports.spec.ts` (Group by, twice) | `getByRole('combobox', { name: 'Group by' }).selectOption('category' / 'payee')` | `chooseOption(page.getByRole('button', { name: /Group by$/ }), 'Category' / 'Payee')` | The shared Select's desktop trigger is a button, named by its value and then its label |
| `unsaved-drafts.spec.ts` (Group by, three places) | `combobox … selectOption('payee')`; `toHaveValue('payee')` | `chooseOption(groupBy, 'Payee')`; on desktop `toHaveText('Payee')`, on the phone branch `toHaveValue('payee')` | The test runs at 390 px as well. There the shared Select is a native select (combobox, which has a value); on desktop it is a button, whose text shows the choice |
| `cash-flow.spec.ts` | `MONTH_NAMES` list for `shortMonth` / `longMonth` | `nameOf(ym, 'short' \| 'long')` via `toLocaleString` | IN-02: one way of building month names in the tests |
| `gallery/month-range.spec.ts:90` | clicked Next year in To at max year 2026, then expected January 2027 disabled | expects Next year disabled | IN-03: the grid no longer steps into a year past max |
| `gallery/dates.spec.ts:277` | Ranged (2026-03 to 2026-11) Next year `toBeEnabled()` | Next year and Previous year `toBeDisabled()` | IN-03: 2026 holds both bounds |

## TDD Gate Compliance (Task 2)

- RED: `cd client && npx vitest run --reporter=tap-flat src/components/ui/MonthPicker.test.ts` exited 1 with 2 failed and 14 passed. The target was `MonthGrid > stops at the last year it allows, so Next year never opens a year with no month to pick`: expected `true`, got `false`. `gsd-tools check tdd-red-evidence` returned **RED_EVIDENCE_OK** (`target_test_failed`). Semantic check: the target ran and failed on its own assertion because MonthGrid ignored `maxYear`. The second new test failed for the same missing bound (the grid opened on 2031). There was no load or fixture fault. The first record was refused as `invalid_record` because Vitest wrote malformed TAP YAML when quoting HTML. The assertions were restated on plain values (a boolean, and the shown year) and the run was captured again.
- GREEN: MonthPicker and MonthRangePicker tests 29/29.

## Verification

| Check | Result |
| --- | --- |
| Desktop e2e: `reports`, `unsaved-drafts`, `report-drill-through`, `cash-flow` specs (one run, fresh client build) | **17 passed**, 0 failed |
| `npm --prefix client test -- MonthPicker.test.ts MonthRangePicker.test.ts` | 29 passed |
| `npm --prefix client test` (full) | 103 files, **950 passed** |
| `bash e2e/gallery-baselines.sh` (Playwright 1.64.0 noble container, amd64) | **209 passed**, exit 0, no baseline remade |
| `cd client && npx tsc --noEmit` | clean |
| Lint (`lint/`, `--max-warnings=122`) | 0 errors, 122 warnings (at the cap, none in changed files) |
| Prettier 3.9.10 `--check` on every changed file | clean |
| Raw-control perl gate over the four report files | 0 (HEAD 5) |
| `grep -c MONTH_NAMES e2e/tests/cash-flow.spec.ts` | 0 (HEAD 3) |

## Deviations from Plan

1. **[Rule 3 - Blocking] `MonthRangePicker.tsx` changed though it is not in `files_modified`.** The plan's truth and action require Next year to stop at "the range's max", which only MonthRangePicker can pass. The change is three lines: an `isMonth` import, a `maxYear` constant, and the prop on both grids. Commit `66acad77`.
2. **[Rule 1 - Bug, test premise] `e2e/tests/gallery/month-range.spec.ts` and `gallery/dates.spec.ts` changed (not in `files_modified`).** Two assertions encoded the old IN-03 behaviour: stepping past max, and Next year enabled at the max year. Both now assert the disabled button. The gallery baseline check passed with no image remade. Commit `66acad77`.
3. **[Rule 2] The month grid also opens no later than `maxYear`.** Without this, a grid whose max is before this month's year would open on a year with every month disabled, which is the same IN-03 fault reached a different way. Covered by the unit test `opens on its last year when this month is later than it`.
4. **[Spec] The phone branch of `unsaved-drafts.spec.ts`.** That test sets a 390 px viewport, where the shared Select is a native select. The plan's "check the trigger's text" applies on desktop only; the phone branch keeps `toHaveValue('payee')`.
5. **[Process] Task 1 and Task 2 were verified in one combined browser run.** Sibling executors held the shared e2e ports 3169-3180, so the specs ran once, after both tasks' code was in place. Task 1's first solo run had passed 14/15 before that, and its one failure (the phone branch) was fixed as in item 4. Commits stayed separate per task.
6. **[Process] The plan ledger file was not written.** The worktree guard refuses writes under `.git/worktrees/`. `commits: 3` is measured with `git rev-list --count ec7120bd..HEAD`. The SUMMARY commit is the fourth.

## Issues Encountered

- Under heavy load (sibling e2e runs plus the gallery container), one full client run timed out `calendarLayout.test.ts > heatmapRows (property-based)`. That file is unchanged. It passed on its own, and the full suite passed 950/950 on a rerun.
- One e2e attempt with `E2E_SKIP_BUILD=1` failed everywhere with "Cannot GET /", because no client build existed in this worktree. Rerunning with a build fixed it.
- The worktree had no `node_modules`. Client, server, e2e and lint dependencies were installed with `npm ci` from their lockfiles, with install scripts disabled. Prettier 3.9.10, the root lockfile's version, was installed into the session scratchpad, not the checkout.

## Follow-up (not done, out of scope)

- MonthRangePicker's To grid can still step Previous year below `draft.from`'s year, into years where every month is disabled. This is the floor-side twin of IN-03. Bounding it needs care because `from` changes while the To grid is mounted.

## Known Stubs

None.

## Threat Flags

None. T-03-29 is mitigated: Group by keeps the same option values, and `unsaved-drafts.spec.ts` proves drafts and saves. T-03-SC is accepted: no package was added to any manifest.

## Self-Check: PASSED

- Files: all 13 modified files exist; this SUMMARY exists.
- Commits on HEAD: `c639d937`, `a91155f3`, `66acad77`.
