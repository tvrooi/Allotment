---
phase: 03-screens-on-shared-controls
fixed_at: 2026-11-22T07:52:04Z
review_path: /Users/tristanvanrooyen/Github/Allotment/.git/gsd-handoff/03-33-REVIEW-sol.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report (03-33)

**Fixed at:** 2026-11-22T07:52:04Z
**Source review:** `/Users/tristanvanrooyen/Github/Allotment/.git/gsd-handoff/03-33-REVIEW-sol.md`
**Code worktree:** `/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select` (`fix/uat-03-row-selection`, HEAD `159f2087`)
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (`CR-01`..`CR-05`, `WR-01`..`WR-03`)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: The selection bar covers transactions while the summary is pending

**Status:** fixed
**Files modified:** `client/src/components/transactions/TransactionTable.tsx`, `e2e/tests/phone/register-selection-phone.spec.ts`
**Commit:** `da048a87` (`da048a875e05f97507ebcc7211010cdda6a88cde`)
**Failing-first evidence:** `e2e/tests/phone/register-selection-phone.spec.ts:271` (`at 390 px the selection bar stays inside the toolbar while the summary is pending or failed`) failed before the fix with `expect(barBox.y + barBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 0.5)` — Expected: `<= 411.5`, Received: `479` (67.5 px overflow over the date header and first card).
**Applied fix:** Reserved toolbar minimum height (`min-h-24 max-md:min-h-36`) whenever `transactions.length > 0 || selected`, and changed the selection bar overlay from `inset-x-0 top-0 min-h-full` to `inset-0 overflow-y-auto` so the bar stays strictly inside the toolbar box on desktop and 390 px phone while `/api/transactions/summary` is pending or failed.

### CR-02: Select all 0 arms a whole-list selection before the filtered list loads

**Status:** fixed
**Files modified:** `client/src/components/transactions/SelectionSummary.tsx`, `client/src/components/transactions/TransactionTable.tsx`, `e2e/tests/transactions.spec.ts`
**Commit:** `0a181939` (`0a1819392fca587c64f9d2c2f398138deddb4f9a`)
**Failing-first evidence:** `e2e/tests/transactions.spec.ts:2517` (`does not offer Select all while a filtered list is loading`) failed before the fix with `expect(bar(page).getByRole('button', { name: /^Select all/ })).toHaveCount(0)` — Expected: `0`, Received: `1` (`Select all 0` was offered while the filtered `/api/transactions` request was held).
**Applied fix:** Extracted `canSelectAll(loadedCount, wholeList)` and `SELECT_ALL_TITLE` in `SelectionSummary.tsx` and reused them in both `SelectionSummary` and `TransactionTable`'s selection bar overlay so `Select all` is never offered while `transactions.length === 0`.

### CR-03: The new checkbox can announce a different transaction amount from the visible row

**Status:** fixed
**Files modified:** `client/src/components/transactions/TransactionRow.tsx`, `client/src/components/transactions/TransactionCard.tsx`, `client/src/components/transactions/TransactionTable.tsx`, `e2e/tests/transactions.spec.ts`
**Commit:** `b8744bee` (`b8744bee8b0de3e7e5902614e18606c55db48980`)
**Failing-first evidence:** `e2e/tests/transactions.spec.ts:2543` (`row checkbox name uses the account currency and folded round-up total`) failed before the fix with `getByRole('checkbox', { name: 'Select Ramen -¥1,500', exact: true })` not found (the checkbox announced `Select Ramen $15` in the AUD budget).
**Applied fix:** Added shared `selectionCheckboxLabel(payeeName, amountText)` in `TransactionRow.tsx` and removed `selectLabel` / `RowSelection.label` from `TransactionTable.tsx`. Both `TransactionRow` and `TransactionCard` pass the exact `transactionPayeeName(tx, accountNameOf)` and `formatRegisterAmount(tx, currency)` strings used for visual output into `selectionCheckboxLabel` (handling account currency, folded round-ups, transfers, and Safe mode consistently). Updated `e2e/tests/transactions.spec.ts:2154` from `/^Select Transfer: /` to `/^Select Transfer to Rainy Day Savings/` to match the visible transfer payee name.

### CR-04: Selected and unselected rows look identical in forced colors

**Status:** fixed
**Files modified:** `client/src/components/transactions/TransactionRow.tsx`, `e2e/tests/transactions.spec.ts`
**Commit:** `2dca2636` (`2dca2636d7ea6052dbddbe74d8ccaad8a3750d`)
**Failing-first evidence:** `e2e/tests/transactions.spec.ts:2577` (`selected and unselected rows are visually distinct in forced colors without affecting focus outline`) failed before the fix with `expect(selected.content).not.toBe('none')` under `page.emulateMedia({ forcedColors: 'active' })`.
**Applied fix:** Added a forced-colors `::before` marker to `SELECTED_ROW` in `TransactionRow.tsx` (`relative ... forced-colors:before:content-[""] forced-colors:before:absolute forced-colors:before:inset-y-0 forced-colors:before:left-0 forced-colors:before:border-l-[3px] forced-colors:before:border-l-[color:Highlight] forced-colors:before:pointer-events-none`), shared by both `TransactionRow` and `TransactionCard`, out of layout and independent of `:focus-visible` outline.

### CR-05: More actions shifts horizontally when the selected count grows

**Status:** fixed
**Files modified:** `client/src/components/transactions/TransactionTable.tsx`, `e2e/tests/phone/register-selection-phone.spec.ts`
**Commit:** `c18f34ed` (`c18f34ed05f65a1a36a86024a95e37cfbb1f1547`)
**Failing-first evidence:** `e2e/tests/phone/register-selection-phone.spec.ts:334` (`More actions keeps its horizontal position when the selected count crosses to two digits`) failed before the fix with `expect(atTen.x).toBeCloseTo(before.x, 0)` — Expected: `93.890625`, Received: `99.703125` (+5.81 px horizontal shift from `9 selected` to `10 selected`).
**Applied fix:** Replaced the intrinsic-width count span in `TransactionTable.tsx` with an `inline-grid tabular-nums` sizer driven by a hidden `::before` pseudo-element (`before:content-[attr(data-max)] before:invisible before:h-0`) sized to `All ${transactions.length.toLocaleString()} selected`, keeping `More actions` stationary without adding hidden text to DOM `textContent`.

### WR-01: Done drops keyboard focus when the overlay unmounts

**Status:** fixed
**Files modified:** `client/src/components/transactions/SelectionSummary.tsx`, `client/src/components/transactions/TransactionTable.tsx`, `e2e/tests/transactions.spec.ts`
**Commit:** `dd328d92` (`dd328d92a6f882308a2ad4edc7f0a384ae46d44b`)
**Failing-first evidence:** `e2e/tests/transactions.spec.ts:2615` (`keyboard Done returns focus to the trigger that started selection or a stable fallback`) failed before the fix with `expect(selectBtn).toBeFocused()` — Expected: `focused`, Received: `inactive` (focus fell to `document.body` when `Done` unmounted).
**Applied fix:** Captured the starting toolbar trigger (`Select` or `Select all N`) on `onSelect`/`onSelectAll` (or `selectTriggerRef.current` as the stable fallback when selection starts from a row via modifier click), and restored focus in `TransactionTable`'s `[selected]` `useEffect` once `Done` closes selection and the toolbar is visible and no longer `inert`.

### WR-02: The desktop regression test assumes an unspecified same-day row order

**Status:** fixed
**Files modified:** `e2e/tests/transactions.spec.ts`
**Commit:** `a65ad58b` (`a65ad58b602b945d80cc6d84a25383e226a1fb11`)
**Failing-first evidence:** Prior to the fix, `e2e/tests/transactions.spec.ts:2408` and `:2482` hardcoded `'Mock echo'` / `'-$5'` for `rows.nth(0)` assuming reverse insertion order on `isoDay()` (documented in `03-33-SUMMARY.md`, where assuming `'Mock alpha'` timed out when SQLite returned `'Mock echo'` first).
**Applied fix:** Resolved `firstPayee` and `firstAmount` once from `rows.nth(0)` after the 5 rows render and used those resolved values for layout measurements and the restored category-button assertion.

### WR-03: The shared color probe duplicates the existing gallery probe

**Status:** fixed
**Files modified:** `e2e/tests/fixtures.ts`, `e2e/tests/gallery/matrix.spec.ts`
**Commit:** `159f2087` (`159f208716a469110c4a889e65d260e6e8010a9f`)
**Failing-first evidence:** `cd e2e && npx tsc --noEmit -p .` failed before updating `fixtures.ts` with `tests/gallery/matrix.spec.ts:99:64 - error TS2554: Expected 2 arguments, but got 3` when calling `tokenColour(page, '--color-brand-600', 'color')` imported from `../fixtures`.
**Applied fix:** Added optional `property: 'backgroundColor' | 'color' = 'backgroundColor'` parameter to `tokenColour` in `e2e/tests/fixtures.ts`, removed the duplicate local `tokenColour` from `e2e/tests/gallery/matrix.spec.ts`, and imported `tokenColour` from `../fixtures`.

## Verification

All checks ran in the code worktree (`/Users/tristanvanrooyen/Github/Allotment-worktrees/uat03-select`, branch `fix/uat-03-row-selection`, HEAD `159f2087`) after the final fix commit:

- `cd client && npx tsc --noEmit`: exit `0`
- `cd e2e && npx tsc --noEmit`: exit `0`
- `npm --prefix client test -- --run`: `Test Files  104 passed (104)`, `Tests  975 passed (975)`
- `npm --prefix client run build`: exit `0` (`✓ built in 2.27s`)
- `npm --prefix lint run lint`: exit `0`, `✖ 119 problems (0 errors, 119 warnings)` (cap `121`, zero increase)
- `npx prettier --check --ignore-unknown $(git diff --name-only origin/redesign)`: exit `0`, all 9 changed files clean
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/household.spec.ts tests/phase9.spec.ts tests/menus.spec.ts tests/transaction-filters.spec.ts tests/accessibility.spec.ts`: `126 passed` (`4.9m`)
- `npm --prefix e2e test -- --project=phone`: `72 passed` (`2.9m`)
- `npm --prefix e2e test -- --project=demo`: `29 passed` (`1.1m`)
- `npm --prefix e2e test -- --project=gallery`: `159 passed, 50 skipped` (`3.4m`, Linux screenshot baselines skipped on macOS)
- `git diff --name-only origin/redesign` in `$WT`: 9 files (`client/src/components/transactions/{SelectionSummary,TransactionCard,TransactionRow,TransactionTable}.tsx`, `e2e/tests/{fixtures.ts,gallery/matrix.spec.ts,household.spec.ts,phone/register-selection-phone.spec.ts,transactions.spec.ts}`)

---

_Fixed: 2026-11-22T07:52:04Z_
_Fixer: Antigravity (gsd-code-fixer)_
_Iteration: 1_
