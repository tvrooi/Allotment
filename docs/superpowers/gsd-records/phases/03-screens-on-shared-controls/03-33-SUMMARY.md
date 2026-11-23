---
phase: 03-screens-on-shared-controls
plan: 33
subsystem: ui
tags: [react, transactions, register, selection, accessibility, playwright, phone, uat-gap]
gap_closure: true
gap_ids: [G-03-4]

requires:
  - phase: 03-screens-on-shared-controls
    provides: register selection model, SelectionSummary, TransactionRow, TransactionCard, TransactionTable (03-27, 03-28), UAT gap G-03-4
provides:
  - RowSelection interface and SELECTED_ROW constant (bg-brand-100 + 3 px inset brand-600 bar) in TransactionRow.tsx
  - Colour-only row and phone card selection (role=checkbox, aria-checked, aria-label, no visible checkbox column)
  - Fixed-layout selection bar overlaying an invisible + inert toolbar with shared selectAllLabel, Select all N, and focus management
  - tokenColour(page, name) fixture helper in e2e/tests/fixtures.ts
affects: [03-34, 03-35]

actuals:
  tokens: 10198
  tasks: 2
  commits: 4
  plan_head_before: b22fb6faaf8a0f80cbeaf3002a439c026f31eb0d
  plan_head_after: edb3e917534d250fb46c6dcadd8a3c11ea8da4ae

tech-stack:
  added: []
  patterns:
    - "Selection is shown via SELECTED_ROW (bg-brand-100 + inset 3 px brand-600 box-shadow) rather than an added column or border width, so no row moves"
    - "The selection bar overlays an invisible, inert toolbar inside a relative wrapper so the register below keeps its exact vertical position"

key-files:
  created: []
  modified:
    - client/src/components/transactions/TransactionRow.tsx
    - client/src/components/transactions/TransactionCard.tsx
    - client/src/components/transactions/TransactionTable.tsx
    - client/src/components/transactions/SelectionSummary.tsx
    - e2e/tests/fixtures.ts
    - e2e/tests/transactions.spec.ts
    - e2e/tests/phone/register-selection-phone.spec.ts

key-decisions:
  - "Rows and phone cards act as role='checkbox' with aria-checked and aria-label='Select {payee} {amount}' while selecting; inline row controls render as plain spans of identical box classes so the checkbox contains no nested interactive elements"
  - "Plain click (desktop) and tap (phone) toggle selection while selecting instead of opening details; outside select mode plain click opens details as before"
  - "The toolbar stays in layout (invisible + inert) with SelectionSummary invariant to selection state, while the selection bar overlays it (absolute inset-x-0 top-0 min-h-full z-10 content-center) and receives focus when selecting starts from the toolbar or the bar's Select all"

patterns-established:
  - "SELECTED_ROW is defined once in TransactionRow.tsx and imported by TransactionCard.tsx"
  - "selectAllLabel(count) is exported once from SelectionSummary.tsx and shared by the toolbar and selection bar"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "At 1280 px, selecting shows no checkbox, changes selected row colour (brand-100 fill + 3 px inset brand-600 bar), keeps all row positions and inline offsets within 0.5 px, overlays the inert toolbar with the selection bar (fitting inside its box), toggles on plain click or Space, opens the selection menu on Shift+F10, and restores inline controls and toolbar on Done"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#a selected row changes colour, shows no checkbox, and nothing in it moves"
        status: pass
      - kind: unit
        ref: "npm --prefix client test -- --run (104 files, 975 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "At 390 px with a household, tapping a phone card toggles selection with the same SELECTED_ROW fill and no checkbox, the selection bar fits inside the /transactions toolbar (158 px) with no vertical or horizontal shift, all bar and card targets are >= 44 px with zero sideways overflow, and the selection menu works from More actions and card ⋯"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/register-selection-phone.spec.ts#a selected card changes colour, with no checkbox, and nothing on it moves"
        status: pass
      - kind: e2e
        ref: "e2e/tests/phone/register-selection-phone.spec.ts#on a phone cards are selected by tapping, and the one menu edits and reviews them"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 33: Colour-only register selection without moving the list (G-03-4) Summary

**Removed the register checkbox column and shifted layout: rows and phone cards expose `role="checkbox"` and highlight with `bg-brand-100` plus a 3 px inset `brand-600` bar while selecting, and the selection bar overlays an `invisible` `inert` toolbar so nothing moves at 1280 px or 390 px.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-22T05:29:47Z
- **Completed:** 2026-11-22T05:42:02Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 7 (in code worktree)

## Code Worktree & Branch

- **Worktree:** `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select`
- **Branch:** `fix/uat-03-row-selection` (branched from `origin/redesign` at `b22fb6faaf8a0f80cbeaf3002a439c026f31eb0d`)
- **Head commit:** `edb3e917534d250fb46c6dcadd8a3c11ea8da4ae`
- **Not pushed, no PR opened** (deferred to `03-34` after `03-35`)

## Accomplishments

- **Colour-only row and card selection (`TransactionRow.tsx`, `TransactionCard.tsx`):** Added `RowSelection` and `SELECTED_ROW` (`bg-brand-100 shadow-[inset_3px_0_0_var(--color-brand-600)]`). While `selection` is provided, the row/card itself exposes `role="checkbox"`, `aria-checked`, and `aria-label="Select {payee} {amount}"`, toggles on plain click/tap or Enter/Space (without opening details), and renders inline row controls (split toggle, category button, edit pencil) as non-interactive `span`s of identical dimensions while closing any open `CategoryPicker`.
- **Fixed-layout selection bar over inert toolbar (`TransactionTable.tsx`, `SelectionSummary.tsx`):** Removed the `Checkbox` column wrapper (`withSelect` → `withSelectGestures`, `tapToggle` removed). Kept `SelectionSummary`'s `Select` and `Select all N` buttons always rendered (`onSelect` required, `selectingAll` prop removed, `selectAllLabel` exported and shared) inside a `relative` wrapper that marks the toolbar `invisible` and `inert` while selecting. Overlaid the `Selected transactions` bar (`absolute inset-x-0 top-0 min-h-full z-10 content-center`, `tabIndex={-1}` focused when selecting starts from the toolbar or the bar's own `Select all N`), with phone two-row ordering (`max-md:w-full max-md:text-xs` hint, `max-md:order-last` on `Share` wrapper and `Clear`).
- **Failing-first desktop and phone tests (`e2e/tests/fixtures.ts`, `transactions.spec.ts`, `register-selection-phone.spec.ts`):** Added shared `tokenColour(page, name)` probe in `fixtures.ts`, desktop 1280 px colour/layout/a11y test, and phone 390 px `/transactions` colour/layout/44 px target test.

## Task Commits

All code and test commits live on `fix/uat-03-row-selection` in `$HOME/Github/Allotment-worktrees/uat03-select`:

1. **Task 1 (RED):** `a57aacb0` — `test(03-33): failing desktop selection test for colour and fixed layout`
2. **Task 1 (GREEN):** `e00c984d` — `feat(03-33): colour-only row selection and fixed-layout selection bar on desktop`
3. **Task 2 (RED):** `ffd7eda6` — `test(03-33): failing phone selection test for colour, touch targets, and fixed layout`
4. **Task 2 (GREEN):** `edb3e917` — `feat(03-33): colour-only card selection on phone and drop tapToggle`

## RED Results (recorded before each implementation change)

- **Task 1 (desktop, on unmodified `b22fb6fa`):** `e2e/tests/transactions.spec.ts:2422` (`same(before)` called at line `2432` in step 1):
  `Error: firstTop — expect(received).toBeCloseTo(expected, precision) — Expected: 378, Received: 427` (49 px downward shift caused by the selection bar pushing the list down).
- **Task 2 (phone, after Task 1 and before `TransactionCard.tsx` change):** `e2e/tests/phone/register-selection-phone.spec.ts:180`:
  `Error: expect(locator).toHaveCount(expected) failed — Locator: getByRole('checkbox', { name: /^Select / }) — Expected: 2, Received: 0`.
  (In the same pre-card RED run, both `same(before)` and `barBox.y + barBox.height <= firstBox.y + 0.5` already passed, confirming the phone bar fit within the toolbar.)

## Measured Toolbar & Bar Heights

Measured in Playwright against the final commit `edb3e917`:

| Viewport & Route | Inert Toolbar Height | Selection Bar Height (0 selected) | Selection Bar Height (1 selected) |
|---|---|---|---|
| Desktop `1280×800` (`/accounts/:id`, with household) | `162 px` | `162 px` | `162 px` |
| Phone `390×844` (`/transactions`, shortest toolbar, with household) | `158 px` | `158 px` | `158 px` |

## Verification

Exact results after final commit `edb3e917` in `$HOME/Github/Allotment-worktrees/uat03-select`:

- `cd client && npx tsc --noEmit -p .`: exit `0` (clean)
- `cd e2e && npx tsc --noEmit -p .`: exit `0` (clean)
- `npm --prefix client test -- --run`: `Test Files  104 passed (104)`, `Tests  975 passed (975)`
- `npm --prefix lint run lint`: `✖ 119 problems (0 errors, 119 warnings)` (down from 121 in 03-28; cap 122, zero new warnings)
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts -g "nothing in it moves"`: `1 passed (8.7s)`
- `npm --prefix e2e test -- --project=phone tests/phone/register-selection-phone.spec.ts`: `2 passed (10.7s)`
- Acceptance greps:
  - `grep -c "aria-checked" client/src/components/transactions/TransactionRow.tsx` → `1`
  - `grep -c "ui/Checkbox" client/src/components/transactions/TransactionTable.tsx` → `0`
  - `grep -c "inert=" client/src/components/transactions/TransactionTable.tsx` → `1`
  - `cat client/src/components/transactions/TransactionTable.tsx client/src/components/transactions/SelectionSummary.tsx | grep -c "selectingAll"` → `0`
  - `cat client/src/components/transactions/TransactionTable.tsx client/src/components/transactions/SelectionSummary.tsx | grep -c "selectAllLabel"` → `4`
  - `cat client/src/components/transactions/TransactionTable.tsx client/src/components/transactions/SelectionSummary.tsx | grep -c "Tick transactions"` → `0`
  - `grep -c "then use More actions or" client/src/components/transactions/TransactionTable.tsx` → `0`
  - `grep -c "SELECTED_ROW" client/src/components/transactions/TransactionCard.tsx` → `2`
  - `grep -c "tapToggle" client/src/components/transactions/TransactionTable.tsx` → `0`
  - `grep -c "rowSelection(tx)" client/src/components/transactions/TransactionTable.tsx` → `2`
  - `git diff --name-only origin/redesign -- client/src/utils client/src/hooks client/src/api server client/src/components/transactions/SelectionMenu.tsx client/src/components/household` → empty
  - `git diff --name-only origin/redesign` → exactly the 7 planned files

## Files Created/Modified

- `client/src/components/transactions/TransactionRow.tsx` — exports `RowSelection` and `SELECTED_ROW`; makes row `role="checkbox"` with `aria-checked`/`aria-label` while selecting and swaps inline buttons to matching `span`s.
- `client/src/components/transactions/TransactionCard.tsx` — accepts optional `selection?: RowSelection`, uses `SELECTED_ROW` and `role="checkbox"`/`aria-checked`/`aria-label` while selecting.
- `client/src/components/transactions/TransactionTable.tsx` — replaces `withSelect` + `Checkbox` column with `withSelectGestures`, adds `selectLabel`/`rowSelection`, drops `tapToggle`, overlays selection bar on `invisible`+`inert` toolbar with `Select all N` and bar focus effect.
- `client/src/components/transactions/SelectionSummary.tsx` — makes `onSelect` required, removes `selectingAll`, exports `selectAllLabel`, updates Select tooltip.
- `e2e/tests/fixtures.ts` — exports `tokenColour(page, name)` probe helper.
- `e2e/tests/transactions.spec.ts` — adds desktop 1280 px test `"a selected row changes colour, shows no checkbox, and nothing in it moves"`.
- `e2e/tests/phone/register-selection-phone.spec.ts` — adds phone 390 px test `"a selected card changes colour, with no checkbox, and nothing on it moves"`, updates header comment and 44 px card checkbox target.

## Decisions Made

- Kept `splitContent` gated behind `isSplitParent` in `TransactionRow.tsx` so non-split rows (where `tx.children` is undefined) never evaluate `tx.children!.length`.
- Wrapped `ShareWithHousehold` in `<span className="max-md:order-last empty:hidden">` so when no household exists (where `ShareWithHousehold` returns `null`), the empty wrapper does not occupy flex gap space or wrap onto an extra line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `fiveRows` reverse order on desktop (`Mock echo` first, not `Mock alpha`)**
- **Found during:** Task 1 RED run
- **Issue:** `fiveRows` creates five transactions on `isoDay()`, so `rows.nth(0)` renders `Mock echo` (`-$5`) rather than `Mock alpha` (`-$1`), causing `rows.nth(0).getByText('Mock alpha')` to time out before reaching step 1.
- **Fix:** Measured `Mock echo` and `-$5` on `rows.nth(0)` (and `/^Category for Mock echo/` in step 5); in Task 2's phone spec, matched `/^Mock (one|two)$/` and `/^-\$[12]$/` so layout measurement is independent of same-day tiebreak order.
- **Files modified:** `e2e/tests/transactions.spec.ts`, `e2e/tests/phone/register-selection-phone.spec.ts`
- **Commit:** `a57aacb0`, `ffd7eda6`

**Total deviations:** 1 test-locator fix. **Impact:** None on production behaviour or scope; desktop RED ran cleanly and failed at step 1 `firstTop` as planned.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## For 03-34

- **Owner decision (22 November 2026):** Asked directly whether the list may move down when selecting starts, the owner decided: **"Don't move the list"** (alongside UAT test 51 / G-03-4: no checkbox shown, selected row changes colour so content does not move).
- **Behaviour changes:**
  - Selecting shows no checkbox column on desktop or phones; a selected row or card takes `bg-brand-100` plus a 3 px inset `brand-600` bar (`SELECTED_ROW`) without changing width or border thickness.
  - While selecting, a plain click (desktop) or tap (phone) on a row/card toggles its selection instead of opening details; outside select mode, a plain click still opens details (`#243`).
  - For assistive technology, each row and card becomes `role="checkbox"` with `aria-checked` and `aria-label="Select {payee} {amount}"` while selecting; Space and Enter toggle a focused row, and Shift+F10 / Menu key continue to open `Actions for N selected transaction(s)`. Inline row controls (category picker, split toggle, edit pencil) render as plain non-interactive `span`s of identical dimensions while selecting and become active controls again on `Done`.
  - The `Selected transactions` bar overlays the register toolbar (which stays in layout, `invisible` and `inert`, so the list never shifts). The bar gains `Select all N` (until the whole list is selected), focus moves to the bar when selecting starts from the toolbar or the bar's `Select all N`, and the toolbar's `Export`, `Import CSV`, and `Add Transaction` sit behind the bar until `Done`.
- **Planner's choices within the owner's request:**
  - `role="checkbox"` on the row/card (matching the old checkbox's accessible name) rather than listbox/grid/toggle-button, preserving screen-reader and Playwright locators while avoiding grid-wide arrow-key navigation changes.
  - `bg-brand-100` + 3 px inset `--color-brand-600` box-shadow (meets >= 4.5:1 text contrast on all row text colours and >= 3:1 state indicator under WCAG 1.4.11 without taking layout space).
  - Phone hint shortened to `"Tap transactions to select them."` with `max-md:order-last` on Share and Clear so the bar fits inside the shortest `/transactions` toolbar (`158 px` at 390 px).
- **Changed selectors & expectations:**
  - `SelectionSummary`: Select tooltip changed from `"Tick transactions to change them together"` to `"Select transactions to change them together"`; `Select` and `Select all N` stay rendered in the `inert` toolbar while selecting.
  - Desktop bar hint changed from `"Tick transactions, then right-click one of them..."` to `"Click transactions to select them, then right-click one of them to change them all. Shift+click to select a range."`; phone bar hint changed from `"Tap transactions to select them, then use More actions or ⋯."` to `"Tap transactions to select them."`.
  - `e2e/tests/phone/register-selection-phone.spec.ts`: 44 px touch-target check now measures `page.getByRole('checkbox', { name: /^Select Mock one/ })` (the card itself) instead of `toggleTarget(...)`, and removes unused `toggleTarget` import.
- **Findings for the owner:**
  - Outside select mode, the open-in-details highlight (`bg-brand-50 border-l-2 border-l-brand-600`) is unchanged; toggling selection never adds or removes a border.
  - Every row/card selection colour token keeps >= 4.5:1 text contrast and >= 3:1 state indicator contrast in both light and dark themes (verified by contrast math at planning; owner visual check on demo recommended).

## For 03-35

Register specs on `fix/uat-03-row-selection` known red after `03-33` (intentionally left for `03-35` to update off `toggleTarget` / old checkbox labels and plain-click-opens-details):

- **`e2e/tests/transactions.spec.ts`:**
  - `"Select all, then the selection menu sets the category, notes, payee and report visibility on the whole list"` (line 1636-1638: checks `page.getByRole('checkbox', { name: /^Select / })` count/checked — note: checkboxes now resolve to rows, check whether `toBeChecked()` passes on rows, plus unticked tests below)
  - `"a row unticked after Select all is left out of a review, and the bar says 2 selected"` (line 1702: uses `setToggle(page.getByRole('checkbox', ...), false)` which clicks `ancestor::label[1]`, no longer present)
  - `"a row unticked after Select all is not deleted"` (line 1724: uses `setToggle`)
  - `"ticked transactions are marked reviewed from the right-click menu, the rest untouched"` (lines 1822-1823: uses `setToggle`)
  - `"ticked transactions take a new payee from the right-click menu"` (lines 1875-1876: uses `setToggle`)
  - `"ticked transactions are deleted from the right-click menu after typing delete"` (lines 1953-1954: uses `setToggle`)
  - `"a ticked reconciled transaction is kept, and the dialog says so"` (lines 1983-1984: uses `setToggle`)
  - `"Category… sets the category of the ticked rows, and Uncategorised clears it"`, `"Replace notes… and Remove notes change the notes of the ticked rows only"`, `"Add tag, Remove tag and Reports change the ticked rows only"`, `"with no tags there are no tag items, and one row reads \"1 transaction\""` (`pickTwo` at lines 2015-2016 and line 2124: use `setToggle`)
  - `"a ticked transfer keeps its category and the toast says it was left alone"` (lines 2152-2153: uses `setToggle`)
  - `"while saving is paused the selection menu offers no change, then offers them again"` (lines 2219-2220: uses `setToggle`)
  - `"Cmd or Ctrl+click and Shift+click select rows without opening details"` (line 2322: last step expects a plain click on row 4 while selecting to open `Transaction details`, which now toggles selection instead)
  - `"a search keeps the selected rows still listed and drops the rest"` (lines 2358-2359: uses `setToggle`)
  - `"with nothing selected, More actions is off and a row keeps its own menu"` (line 2387: uses `setToggle`)
- **`e2e/tests/household.spec.ts`:**
  - Lines 477-478, 522-523, 569-570: three tests use `setToggle(page.getByRole('checkbox', { name: /^Select .../ }))` which relies on a wrapping `<label>` (`ancestor::label[1]`) that no longer exists.

## Known Stubs

None.

## Threat Flags

None. No route, auth rule, bulk endpoint, or selection target calculation changed (`T-03-51`, `T-03-52`, `T-03-SC` satisfied).

## Self-Check: PASSED

- Code worktree `$HOME/Github/Allotment-worktrees/uat03-select` on branch `fix/uat-03-row-selection`: clean working tree (`git status --short` empty); all 4 commits (`a57aacb0`, `e00c984d`, `ffd7eda6`, `edb3e917`) are ancestors of `HEAD`.
- All 7 planned files present and verified (`git diff --name-only origin/redesign` matches the 7 files only).
- GSD worktree `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-33-SUMMARY.md` exists and passes self-check.
