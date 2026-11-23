---
phase: 03-screens-on-shared-controls
plan: 09
subsystem: ui
tags: [budget, annual-budget, currency-input, checkbox, radio-group, select, textarea, wave-g]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (`Reconcile: match`), 03-02 extended CurrencyInput, 03-06 shared e2e `setToggle` helper"
provides:
  - "Budget.tsx (AmountInput, row Checkbox, search Input), AnnualBudget.tsx (Select), AutoAssign.tsx (RadioGroup, Select), BudgetAmountSheet.tsx (CurrencyInput with expression, Checkbox), CardPayments.tsx (both CurrencyInput fields), FundingRows.tsx (Checkbox), and NoteField.tsx (Field + Textarea) migrated to shared controls"
  - "Failing-first e2e tests covering blur formatting, Enter-without-blur alerts, negative-amount refusal, suggestion tap focus preservation, fixed row height during save, and Auto-assign Select/RadioGroup behaviour"
affects: [03-10, 03-15, 04-polish]

plan_head_before: 9cddd33b42af59d925ad8018ec6c455fe5ee9e48
plan_head_after: 2955c816a2514b22fd3a55b62449fe146204e140
commits: 10

actuals:
  tokens: 13590
  tasks: 2
  commits: 10

tech-stack:
  added: []
  patterns:
    - "CurrencyInput with live `onTextChange` draft tracking, `noValidate` forms, and explicit `draft === null` / `< 0` submit checks so Enter works without blurring and negatives are refused verbatim"
    - "Budget table `AmountInput` kept on shared `Input` (`fieldSize='sm'`, `isInvalid`, mount focus effect) with `readAmountExpression` + `assignmentToInput` to preserve every pinned BUD-05 rule"

key-files:
  created: []
  modified:
    - client/src/pages/Budget.tsx
    - client/src/pages/AnnualBudget.tsx
    - client/src/components/budget/AutoAssign.tsx
    - client/src/components/budget/BudgetAmountSheet.tsx
    - client/src/components/budget/CardPayments.tsx
    - client/src/components/budget/FundingRows.tsx
    - client/src/components/budget/NoteField.tsx
    - e2e/tests/budget.spec.ts
    - e2e/tests/budget-inspector.spec.ts
    - e2e/tests/card-payments.spec.ts
    - e2e/tests/phone/phone-native.spec.ts

key-decisions:
  - "Kept `Budget.tsx` `AmountInput` on shared `Input` (`fieldSize='sm'`, `readAmountExpression`, `assignmentToInput`) rather than `CurrencyInput` per plan prohibition and D-15: shipped `CurrencyInput` has no focused `isInvalid`/`aria-invalid` prop (breaking BUD-05 focused invalid marking on malformed sums `*2`/`100+`/`10/0` and refused saves) and initializes `-2000` cents to `'-20.00'` instead of `'-20'` (`budget-inspector.spec.ts:70,85`)"
  - "Passed `allowNegative` on both `CardPayments` `CurrencyInput` fields and refused `< 0` with `'Enter a nonnegative amount'` (CR-01) so `-50` is rejected as before rather than silently flipped to `+$50`"
  - "Kept submit buttons enabled on unreadable drafts with `noValidate` and explicit `draft === null` submit handlers in `BudgetAmountSheet` and `CardPayments` (WR-02) so pressing Enter without blurring shows the form alert (`UNREADABLE_AMOUNT` / `'Enter a valid amount'`), while blurring shows `CurrencyInput`'s inline alert without duplication"
  - "Autofocused `BudgetAmountSheet`'s `CurrencyInput` only on initial mount (`autoFocus={version === 0}`) so tapping a suggestion resets any invalid draft without stealing focus or opening the phone keyboard (WR-01)"
  - "Positioned `Budget.tsx`'s `Saving…` indicator out of flow (`absolute right-0 top-full`) so `h-14` rows keep their exact height during saves (WR-03)"
  - "Accepted shared `Textarea` defaults in `NoteField.tsx` (dropping dead `min-h-0 px-2 py-1.5` overrides) and recorded `Textarea`'s unconditional `min-h-20` under Findings for the owner (WR-04)"

patterns-established:
  - "Forms using `CurrencyInput` with Enter-to-submit track `draft` from `onTextChange`, use `noValidate`, keep submit enabled for unreadable drafts, and validate `draft === null` / `< 0` inside `onSubmit`"
  - "Standalone table/list row checkboxes in `Budget.tsx` and `FundingRows.tsx` use shared `Checkbox` with `aria-label` and `setToggle` in Playwright specs"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "Budget table assigned cell on shared Input keeping every BUD-05 sum, keyboard, and h-14 row-height rule intact; phone BudgetAmountSheet on CurrencyInput (expression, allowNegative, initial-mount autoFocus) and shared Checkbox; CardPayments both money fields on CurrencyInput (allowNegative, negative refusal, Enter-without-blur validation)"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/budget.spec.ts (27/27 pass)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/budget-inspector.spec.ts (5/5 pass)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/card-payments.spec.ts (7/7 pass)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/assign-block.spec.ts (2/2 pass)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/phone/phone-native.spec.ts (20/20 pass, part of 65/65 full phone project)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Budget search Input, row Checkbox (inside pl-10, h-14 preserved), AnnualBudget Select (native on phones), AutoAssign RadioGroup/Radio and Select (Months to average + How to apply covered by e2e), FundingRows Checkbox, and NoteField Field + Textarea (isReadOnly when saving paused) on shared controls with zero raw controls remaining"
    requirement: WAVG-05
    verification:
      - kind: other
        ref: "perl raw-control gate on all 7 Budget files -> 0 (down from 13)"
        status: pass
      - kind: e2e
        ref: "Desktop Playwright (budget, budget-inspector, card-payments, assign-block, envelope-funding, safe-mode, accessibility, polish, housemate-money, tabs) -> 94/94 pass"
        status: pass
      - kind: e2e
        ref: "Full Playwright phone project (--project=phone) -> 65/65 pass"
        status: pass
      - kind: other
        ref: "npm --prefix client test (100/100 files, 926/926 tests), cd client && npx tsc --noEmit (0 errors), npm --prefix lint test (86/86) && npm --prefix lint run lint (0 errors, 124 warnings <= 128 cap)"
        status: pass
    human_judgment: false

duration: 55 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 09: Budget Page and Small Budget Components on Shared Controls Summary

**Budget.tsx, AnnualBudget.tsx, AutoAssign.tsx, BudgetAmountSheet.tsx, CardPayments.tsx, FundingRows.tsx, and NoteField.tsx migrated onto shared UI controls (0 raw controls remaining), with CurrencyInput on BudgetAmountSheet and CardPayments, BUD-05 keyboard/sum/row-height rules preserved on Budget's inline cell, all 7 code-review findings (CR-01, WR-01..WR-06) fixed with RED-verified tests, and 94/94 desktop + 65/65 phone Playwright tests green**

## Performance

- **Duration:** 55 min (including review-fix pass)
- **Started:** 2026-11-19T16:48:59Z
- **Completed:** 2026-11-19T17:44:00Z
- **Tasks:** 2 (plus 7 atomic review-fix commits)
- **Files modified:** 11 (7 client source files, 4 e2e spec files)

## Accomplishments

- Migrated `BudgetAmountSheet.tsx` amount entry to `CurrencyInput` (`expression`, `allowNegative`, `autoFocus={version === 0}`, live `onTextChange` draft, Enter-without-blur alert feedback) and its 12-month repeat checkbox to shared `Checkbox`.
- Migrated both money fields in `CardPayments.tsx` (`Additional funding for ${card.name}` and `Initial card payment funding`) to `CurrencyInput` (`allowNegative`, refusing negative amounts with `'Enter a nonnegative amount'` and unreadable text on Enter with `'Enter a valid amount'`), removing hand-rolled `parseCents` / `isUnreadableAmount` parsing.
- Migrated `Budget.tsx` `AmountInput` onto shared `Input` (`fieldSize="sm"`, `isInvalid`, mount `focus()` effect, out-of-flow `Saving…` badge keeping `h-14` row height steady), row selection checkboxes onto shared `Checkbox` (fitted inside `pl-10` without crowding), and category search onto shared `Input` (`type="search"`, `fieldSize="sm"`, 44 px phone clear target).
- Migrated `AnnualBudget.tsx` jump-to-month picker to shared `Select` (native `<select>` on phones, keeping `selectOption` intact), `AutoAssign.tsx` strategy and mode radios to shared `RadioGroup` + `Radio` and months picker to shared `Select` (both exercised by e2e), `FundingRows.tsx` preview checkboxes to shared `Checkbox`, and `NoteField.tsx` to shared `Field` + `Textarea` (`isReadOnly={!canSave}`, preserving blur-save and status announcements).
- Reduced the raw-control gate count across all 7 files from 13 to `0`.

## Task Commits

Each task and review fix was committed atomically on `worktree-agent-p0309-a1`:

1. **Task 1: Budget table cell, phone sheet and card payments on CurrencyInput** - `8fcf10ac` (`feat(03-09): move budget money fields and phone sheet to shared controls`)
2. **Task 2: Search, checkboxes, Auto-assign, note and Annual budget** - `a1789318` (`feat(03-09): move Budget search, checkboxes, AutoAssign, NoteField and AnnualBudget to shared controls`)
3. **Initial SUMMARY** - `ecf3e9e0` (`docs(03-09): complete Budget page and small budget components plan`)
4. **CR-01:** `d25fa21e` (`fix(03-09): CR-01 refuse negative amounts on card payment fields`)
5. **WR-01:** `6e17ef05` (`fix(03-09): WR-01 avoid refocusing phone budget sheet amount on suggestion tap`)
6. **WR-02:** `70393d3c` (`fix(03-09): WR-02 show alert on Enter with unreadable text in BudgetAmountSheet and CardPayments`)
7. **WR-03:** `fb7563fc` (`fix(03-09): WR-03 keep Budget table row height fixed while save is in flight`)
8. **WR-04:** `737d3cdc` (`fix(03-09): WR-04 drop dead NoteField size/padding overrides in favour of shared Textarea defaults`)
9. **WR-05:** `4314634f` (`test(03-09): WR-05 cover Auto-assign Months to average Select and How to apply RadioGroup`)
10. **WR-06:** `2955c816` (`refactor(03-09): WR-06 remove redundant select() in Budget AmountInput mount effect`)

## Files Created/Modified

- `client/src/pages/Budget.tsx` - Moved `AmountInput` to shared `Input` (`fieldSize="sm"`, `isInvalid`, mount `focus()` effect, out-of-flow `Saving…`), row checkboxes to shared `Checkbox`, and category search to shared `Input` (`type="search"`, `fieldSize="sm"`).
- `client/src/pages/AnnualBudget.tsx` - Switched `Select` import from `ui/Input` to `ui/Select` and unwrapped outer `<label>`.
- `client/src/components/budget/AutoAssign.tsx` - Replaced both radio lists with shared `RadioGroup`/`Radio` and the months `<select>` with shared `Select`.
- `client/src/components/budget/BudgetAmountSheet.tsx` - Moved amount to `CurrencyInput` (`expression`, `allowNegative`, `autoFocus={version === 0}`, Enter-without-blur alert) and 12-month checkbox to shared `Checkbox`.
- `client/src/components/budget/CardPayments.tsx` - Moved both raw `<input>` amount fields to `CurrencyInput` (`allowNegative`, negative and unreadable submit validation, `noValidate` forms, `Label` associations).
- `client/src/components/budget/FundingRows.tsx` - Replaced raw preview `<input type="checkbox">` with shared `Checkbox`.
- `client/src/components/budget/NoteField.tsx` - Replaced raw `<label>` + `<textarea>` with shared `Field` + `Textarea` (`isReadOnly={!canSave}`, `isInvalid={status === 'error'}`).
- `e2e/tests/budget.spec.ts` - Added tests for `BudgetAmountSheet` blur formatting/marking, suggestion tap focus preservation, Enter-without-blur alert, `Budget` row-height stability during save, and `AutoAssign` `Months to average` Select + `How to apply` RadioGroup; updated `FundingRows` checkbox and `AutoAssign` radio toggles to `setToggle`.
- `e2e/tests/budget-inspector.spec.ts` - Updated `Budget` row checkbox toggles to `setToggle`.
- `e2e/tests/card-payments.spec.ts` - Added tests for blur formatting/marking, negative-amount refusal (`-50`) in both setup and Fund debt, and Enter-without-blur alert in both setup and Fund debt.
- `e2e/tests/phone/phone-native.spec.ts` - Updated `BudgetAmountSheet` 12-month checkbox toggle to `setToggle` and amount input typing to `typeAmount` / keyboard typing for `CurrencyInput`.

## Behaviour changes

- **`BudgetAmountSheet.tsx` (`Assigned to ${category.name}` -> `CurrencyInput` with `expression`):**
  - **Observable change:** Leaving the field (blur) after typing a sum (`20*3`) formats the value in place as `$60` (previously kept literal `20*3`); leaving the field with unreadable text (`abc`) keeps `abc`, sets `aria-invalid="true"`, and shows the `UNREADABLE_AMOUNT` (`That isn't an amount.`) alert on blur (previously only shown on clicking Save/Enter). Pressing Enter on unreadable text without blurring continues to show the `UNREADABLE_AMOUNT` alert (WR-02).
  - **Failing-first RED run (unmodified code):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/budget.spec.ts -g "formats sums on blur"` failed at `e2e/tests/budget.spec.ts:824` (`Expected: "$60"`, `Received: "20*3"`).
  - **Proving GREEN tests:** `e2e/tests/budget.spec.ts` `"phone budget sheet formats sums on blur and marks unreadable text on blur"` and `"pressing Enter on unreadable text in the phone budget sheet shows an alert without blurring"`.
- **`CardPayments.tsx` — Setup modal (`Initial card payment funding` -> `CurrencyInput` with `allowNegative`):**
  - **Observable change:** Leaving the field (blur) after typing `200` formats it as `$200` (previously kept `200`); leaving with unreadable text (`abc`) keeps `abc`, sets `aria-invalid="true"`, and shows `That isn't an amount.` on blur. Submitting unreadable text (including Enter without blurring) still shows `'Enter a valid amount'`, and negative values (`-50`) are still refused with `'Enter a nonnegative amount'` (CR-01, WR-02).
  - **Failing-first RED run (unmodified code):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/card-payments.spec.ts -g "card payment amount fields format on blur"` failed at `e2e/tests/card-payments.spec.ts:200` (`Expected: "$200"`, `Received: "200"`).
  - **Proving GREEN tests:** `e2e/tests/card-payments.spec.ts` `"card payment amount fields format and mark unreadable text on blur"`, `"negative card payment amounts are refused in setup and debt funding"`, and `"pressing Enter on unreadable card payment text shows an error without blurring"`.
- **`CardPayments.tsx` — Fund debt form (`Additional funding for ${card.name}` -> `CurrencyInput` with `allowNegative`):**
  - **Observable change:** Same as Setup modal above: leaving the field formats `50` as `$50` and marks unreadable `abc` on blur with `aria-invalid="true"` and `That isn't an amount.`; Enter without blurring shows `'Enter a valid amount'`; negative `-50` is refused with `'Enter a nonnegative amount'`.
  - **Verification note (IN-03):** The initial RED run stopped at the Setup modal assertion in the same test before reaching the Fund debt assertions; both fields were identical raw `<input>`s with plain string state, and all three GREEN tests in `e2e/tests/card-payments.spec.ts` explicitly assert the Fund debt field after migration.
- **`Budget.tsx` (`AmountInput` — desktop table assigned cell -> shared `Input`):**
  - **Observable change:** None observable (kept on shared `Input` with `readAmountExpression` and `assignmentToInput`; see "Findings for the owner" below).
  - **Proving specs:** `e2e/tests/budget-inspector.spec.ts`, `e2e/tests/budget.spec.ts`, and `e2e/tests/assign-block.spec.ts`.

## Selector changes

| Spec & line | Before | After | Reason |
| --- | --- | --- | --- |
| `e2e/tests/phone/phone-native.spec.ts:230` (was `:229`) | `sheet.getByRole('textbox', { name: 'Assigned to Groceries' }).fill('425')` | `typeAmount(sheet.getByRole('textbox', { name: 'Assigned to Groceries' }), '425')` | `BudgetAmountSheet` amount moved to `CurrencyInput`, which switches between formatted (`$500`) and plain text on focus (`fixtures.ts` `typeAmount`). Accessible name unchanged. |
| `e2e/tests/phone/phone-native.spec.ts:237-240` (was `:236`) | `sheet.getByRole('checkbox', { name: 'Use this amount for the next 12 months' }).check()` | `setToggle(sheet.getByRole('checkbox', { name: 'Use this amount for the next 12 months' }), true)` | Checkbox moved to shared React Aria `Checkbox`, whose hidden 1 px `<input>` sits behind `<span aria-hidden="true">`; `setToggle` clicks its wrapping `<label>` and asserts checked state. |
| `e2e/tests/phone/phone-native.spec.ts:242-246` (was `:238`) | `await input.fill('30');` | `await input.click(); await expect(input).toBeFocused(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('30');` | Clicking the checkbox blurred `CurrencyInput` to `$425`; `.fill('30')` raced with React's focus state update, leaving `$425` active on Enter. Clicking and typing over the focused plain value tests real Enter submission. |
| `e2e/tests/budget.spec.ts:547` (was `:533`) | `page.getByRole('checkbox', { name: 'Include Groceries' }).uncheck()` | `setToggle(page.getByRole('checkbox', { name: 'Include Groceries' }), false)` | `FundingRows` moved to shared React Aria `Checkbox`; `setToggle` clicks the wrapping `<label>`. Accessible name unchanged. |
| `e2e/tests/budget.spec.ts:564` (was `:550`) | `page.getByRole('radio', { name: /Set to zero/ }).check()` | `setToggle(page.getByRole('radio', { name: /Set to zero/ }), true)` | `AutoAssign` moved to shared React Aria `RadioGroup` / `Radio`; `setToggle` clicks the wrapping `<label>`. Accessible name unchanged. |
| `e2e/tests/budget-inspector.spec.ts:180, 187, 206, 221` | `page.getByRole('checkbox', { name: 'Select Groceries' \| 'Select Rent / Mortgage' }).check()` | `setToggle(page.getByRole('checkbox', { name: ... }), true)` | `Budget.tsx` row checkbox moved to shared React Aria `Checkbox`; `setToggle` clicks the wrapping `<label>`. Accessible names unchanged. |

## Findings for the owner

1. **`Budget.tsx` `AmountInput` kept on shared `Input` (not `CurrencyInput`) to preserve BUD-05 (D-15):**
   - `client/src/components/ui/CurrencyInput.tsx` (shipped in 03-02, outside 03-09 scope) has two gaps relative to the Budget table cell's pinned BUD-05 rules:
     1. **No focused `isInvalid` / `aria-invalid` prop:** `CurrencyInput` only sets its internal `invalid` state inside `handleBlur` and accepts no external `isInvalid`/`aria-invalid` prop. In the Budget table, pressing `Enter` or `ArrowDown`/`ArrowUp`/`Tab` on unreadable text (`*2`, `100+`, `10/0`) must keep the editor open, focused, and marked `aria-invalid="true"` (`budget-inspector.spec.ts:67-72`), and a server save refusal must keep the focused field marked invalid with negative border/ring.
     2. **Focused initial format of whole negative amounts:** `CurrencyInput` initializes focused text via `(value < 0 ? '-' : '') + amountToInput(value, style)`, which produces `'-20.00'` for `-2000` cents, whereas `assignmentToInput(-2000)` produces `'-20'` (asserted verbatim at `budget-inspector.spec.ts:85`).
   - Also note the desktop `AmountInput` only mounts while actively editing and unmounts on close/blur (the closed cell renders a `<button>` with `formatCurrency`), so `CurrencyInput`'s blur-formatting never displays there anyway.
   - Per the plan's prohibition and Task 1 fallback instruction, `AmountInput` uses the shared `Input` (`fieldSize="sm"`, `isInvalid`, `readAmountExpression`, `assignmentToInput`), passing the raw-control gate (`0`) and all BUD-05 tests without changing any pinned behaviour.
2. **`NoteField.tsx` height on shared `Textarea` (WR-04):**
   - Shared `client/src/components/ui/Textarea.tsx` (outside 03-09 scope) unconditionally applies `min-h-20 py-2` and `fieldBase`'s `px-3`, which win in CSS cascade order over caller overrides (`min-h-0 px-2 py-1.5`).
   - Dropped the dead overrides from `NoteField.tsx` and accepted the shared `Textarea` height (`80 px` minimum) while keeping `rows={2}`. If the owner wants `rows={2}` notes in the Budget inspector and phone sheet back at ~52 px, `Textarea.tsx` can be updated in a shared-control follow-up to apply `min-h-20` only when `rows >= 3`.
3. **`MoneyInput` location note:** The plan mentioned removing `MoneyInput` in `CardPayments.tsx` if unused; `CardPayments.tsx` had two raw `<input>` elements and no `MoneyInput` symbol (`MoneyInput` lives in `client/src/components/budget/PaydayPlan.tsx`, which is plan `03-10`).

## Review fixes

Addressed all 1 critical, 6 warning, and 3 info findings from `03-09-REVIEW.md`, each committed individually with failing-first tests for every behaviour fix:

- **CR-01** (`d25fa21e`, `fix(03-09): CR-01 refuse negative amounts on card payment fields`):
  - **RED:** `tests/card-payments.spec.ts -g "negative card payment amounts are refused"` failed at line 262 (`Expected: "-$50"`, `Received: "$50"`).
  - **Fix:** Added `allowNegative` on both `CardPayments` `CurrencyInput` fields and refused `< 0` with `'Enter a nonnegative amount'` in both Setup and Fund debt forms before preview/save.
  - **GREEN:** `tests/card-payments.spec.ts` 6/6 passed.
- **WR-01** (`6e17ef05`, `fix(03-09): WR-01 avoid refocusing phone budget sheet amount on suggestion tap`):
  - **RED:** `tests/budget.spec.ts -g "tapping a suggestion on the phone budget sheet"` failed at line 865 (`Expected: "$75"`, `Received: "75.00"` because remounting re-ran `autoFocus`).
  - **Fix:** Changed `autoFocus` to `autoFocus={version === 0}` on `BudgetAmountSheet` `CurrencyInput`; also dropped dead `items-center` on `Checkbox` (IN-01).
  - **GREEN:** Test passed (1/1).
- **WR-02** (`70393d3c`, `fix(03-09): WR-02 show alert on Enter with unreadable text in BudgetAmountSheet and CardPayments`):
  - **RED:** `tests/budget.spec.ts tests/card-payments.spec.ts -g "pressing Enter on unreadable"` failed (2/2 — `role="alert"` element not found on both forms when pressing Enter on `'abc'` without blurring).
  - **Fix:** Added `noValidate` to the forms, kept submit buttons enabled on unreadable drafts, showed `UNREADABLE_AMOUNT` on `BudgetAmountSheet` submit (deduplicated against `CurrencyInput`'s blur alert) and `'Enter a valid amount'` on both `CardPayments` forms, and updated test titles per IN-03.
  - **GREEN:** 4/4 blur + Enter-without-blur tests passed.
- **WR-03** (`fb7563fc`, `fix(03-09): WR-03 keep Budget table row height fixed while save is in flight`):
  - **RED:** `tests/budget.spec.ts -g "a refused amount stays in the field"` failed at line 105 (`Expected: <= 1`, `Received: 9` px row growth while `Saving…` was visible).
  - **Fix:** Positioned `Saving…` out of flow (`absolute right-0 top-full mt-0.5 whitespace-nowrap`) inside the relative assigned-cell wrapper and removed dead `px-2` on `AmountInput` (IN-01).
  - **GREEN:** Test passed (1/1).
- **WR-04** (`737d3cdc`, `fix(03-09): WR-04 drop dead NoteField size/padding overrides in favour of shared Textarea defaults`):
  - **Fix:** Removed dead `className="w-full min-h-0 px-2 py-1.5"` in `NoteField.tsx` and recorded `Textarea`'s `min-h-20` under "Findings for the owner".
- **WR-05** (`4314634f`, `test(03-09): WR-05 cover Auto-assign Months to average Select and How to apply RadioGroup`):
  - **Fix:** Added e2e test in `budget.spec.ts` exercising `Average spent`, `Months to average` shared `Select` (`chooseOption(..., '6 months')`), and `How to apply` shared `RadioGroup` (`Replace`), verifying request payload `{ strategy: 'average_spent', months: 6, mode: 'replace' }` and saved budget.
  - **GREEN:** Test passed (1/1).
- **WR-06 + IN-02** (`2955c816`, `refactor(03-09): WR-06 remove redundant select() in Budget AmountInput mount effect`):
  - **Fix:** Reduced mount effect to `input.current?.focus()` (relying on `onFocus` for `select()`) and updated comment to state the BUD-05 focus reason rather than lint warnings.

## Decisions Made

- Kept `Budget.tsx` `AmountInput` on shared `Input` (`fieldSize="sm"`) with `readAmountExpression` + `assignmentToInput` per the plan's BUD-05 prohibition and documented both concrete `CurrencyInput` gaps under "Findings for the owner".
- Kept `type="search"` on `Budget.tsx`'s shared `Input` so the ARIA role remains `searchbox` and all existing desktop and phone specs (`budget-inspector.spec.ts`, `envelope-funding.spec.ts`, `polish.spec.ts`, `phone/polish-phone.spec.ts`) pass with zero selector changes.
- Keyed `CurrencyInput` in `BudgetAmountSheet` (with `autoFocus={version === 0}`) and `CardPayments` with a session counter so reopening or picking a suggestion clears lingering unreadable drafts without refocusing on suggestion tap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Orchestrator spec check] Updated `e2e/tests/phone/phone-native.spec.ts` for migrated `BudgetAmountSheet` `Checkbox` and `CurrencyInput`**
- **Found during:** Task 1 (phone Playwright verification)
- **Issue:** `e2e/tests/phone/phone-native.spec.ts` (outside `files_modified`, but explicitly run by Task 1's `<verify>`) called `.check()` on `Use this amount for the next 12 months` (which times out on React Aria `Checkbox`'s hidden 1 px input) and `.fill('30')` on the blurred `CurrencyInput` after toggling the checkbox (which raced with `CurrencyInput`'s `onFocus` state update and submitted `$425` instead of `$30`).
- **Fix:** Updated line 230 to `typeAmount`, line 237 to `setToggle(..., true)`, and lines 242-246 to click, select-all, and keyboard-type `'30'` before pressing `Enter`.
- **Files modified:** `e2e/tests/phone/phone-native.spec.ts`
- **Verification:** `tests/phone/phone-native.spec.ts` passed 20/20 (part of 65/65 full phone project).
- **Committed in:** `8fcf10ac` (Task 1 commit)

**2. [Plan-authorized fallback] Kept `Budget.tsx` `AmountInput` on shared `Input` instead of `CurrencyInput`**
- **Found during:** Task 1 (pre-implementation inspection of `CurrencyInput.tsx` against `budget-inspector.spec.ts`)
- **Issue:** Shipped `CurrencyInput.tsx` lacks a focused `isInvalid`/`aria-invalid` prop and initializes `-2000` cents as `'-20.00'` instead of `'-20'`, which would break pinned BUD-05 rules (`budget-inspector.spec.ts:70,85`).
- **Fix:** Followed the plan's explicit prohibition/fallback clause: moved `AmountInput` onto shared `Input` (`fieldSize="sm"`, `isInvalid`, `readAmountExpression`, `assignmentToInput`) and recorded both gaps under "Findings for the owner".
- **Files modified:** `client/src/pages/Budget.tsx`
- **Verification:** Raw-control gate printed `0`; all 5 tests in `budget-inspector.spec.ts` and all 27 tests in `budget.spec.ts` passed.
- **Committed in:** `8fcf10ac` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 e2e selector alignment in Task 1's verify target) + 1 plan-authorized fallback (BUD-05 preservation on shared `Input`).
**Impact on plan:** Zero scope creep; every Budget control in the 7 files uses the shared UI set with zero raw controls remaining and all BUD-05 and D-15 rules preserved.

## Verification Results

- **Task 1 Precondition:** `grep -c '^Reconcile: match$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` -> `1`; `grep -c commitOnBlur client/src/components/ui/CurrencyInput.tsx` -> `8`.
- **Raw-control gate (final):** `perl ...` across all 7 files -> `0` (down from `HEAD=13`).
- **TypeScript (final):** `(cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit)` -> PASS (0 errors).
- **Client unit tests (final):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test` -> PASS (100/100 test files, 926/926 tests).
- **Lint (final):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test && npm --prefix lint run lint` -> PASS (`86/86` lint unit tests; `0 errors, 124 warnings`, cap `128`).
- **Desktop Playwright (final):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/budget.spec.ts tests/budget-inspector.spec.ts tests/card-payments.spec.ts tests/assign-block.spec.ts tests/envelope-funding.spec.ts tests/safe-mode.spec.ts tests/accessibility.spec.ts tests/polish.spec.ts tests/housemate-money.spec.ts tests/tabs.spec.ts` -> `94 passed (2.6m)`.
- **Full Phone Playwright project (final):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=phone` -> `65 passed (2.7m)`.

## Threat Flags

None. All threat-register mitigations hold:
- `T-03-13` (Tampering — assigned cell): `Budget.tsx` and `BudgetAmountSheet.tsx` both use `readAmountExpression` (no `eval`, exact BigInt fractions, `MAX_AMOUNT` bound); `budget.spec.ts` and `budget-inspector.spec.ts` pass.
- `T-03-14` (Information disclosure — Safe mode on Budget): `safe-mode.spec.ts` passed in full.
- `T-03-SC` (Tampering — npm installs): No package added (D-02); only lockfile `npm ci --prefer-offline` was run in the fresh worktree with `.npmrc` `ignore-scripts=true` intact.

## Issues Encountered

- Worktree started without `node_modules/` in `client/`, `server/`, `e2e/`, and `lint/`; ran lockfile-exact `npm ci --prefer-offline` with Node 24 before builds, lint, and Playwright runs (zero lockfile or `.npmrc` modifications).
- Code review (`03-09-REVIEW.md`) caught `CR-01` (negative card payment sign loss) and `WR-01..WR-06` (suggestion autofocus, Enter-without-blur feedback, `Saving…` row height jump, dead `NoteField` classes, untested `AutoAssign` Select/RadioGroup, redundant `select()`); all 7 fixed in individual commits and re-verified across desktop and full phone Playwright suites.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Budget's core table, phone sheet, card payments, auto-assign, funding rows, notes, and annual overview are all on shared controls and review-clean.
- Plan `03-10` (`MoneyMoves`, `TargetCard`, `PaydayPlan`) can proceed next without overlapping any file touched here; `MoneyInput` remains in `PaydayPlan.tsx` for `03-10` to migrate and delete.

## Self-Check: PASSED

- All modified files exist on disk and match the commit diffs (`8fcf10ac`..`2955c816`).
- All 10 commits verified as ancestors of `HEAD` on `worktree-agent-p0309-a1`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` verified untouched.
- Zero stubs, zero `crypto.randomUUID`, zero `hookTestHarness`, raw-control gate `0`, all desktop (94/94), full phone project (65/65), unit (926/926), lint (86/86 + 0 errors / 124 warnings), and typecheck verifications passed.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
