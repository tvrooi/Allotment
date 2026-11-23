---
phase: 03-screens-on-shared-controls
plan: 13
subsystem: ui
tags: [transactions, date-picker, currency-input, category-select-button, textarea, wave-g]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`), 03-04 CategorySelectButton props, 03-12 split-row pattern (newClientId keys, CurrencyInput onTextChange) and the setToggle helper'
provides:
  - 'TransactionFormRow on shared controls: DatePicker, CategorySelectButton, CurrencyInput, Input'
  - 'TransactionDetailPanel: DatePicker that saves a picked day at once, shared Textarea notes, 44 px phone payee'
  - 'e2e: pick-a-day save (failing first), payee kept after two Escapes, phone payee height'
affects: [03-15, 03-24, 04-polish]

plan_head_before: 942f1ee0
plan_head_after: 877dc902
commits: 2

actuals:
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - 'An inline editor that saves on blur saves a DatePicker change at once when focus is outside the field (a calendar or Today pick), and on leaving the field when focus is inside it (typing), so the digits of a typed year are never sent one at a time'
    - 'A visual label for a DatePicker in a compact row is an aria-hidden span; the picker names itself with hideLabel (a <label> would point at its group and count as a stray label)'

key-files:
  created: []
  modified:
    - client/src/components/transactions/TransactionFormRow.tsx
    - client/src/components/transactions/TransactionDetailPanel.tsx
    - e2e/tests/transactions.spec.ts
    - e2e/tests/phone/phone-native.spec.ts
    - e2e/tests/recover.spec.ts

key-decisions:
  - 'Outflow, inflow and split amounts use CurrencyInput with allowNegative, so every typed text saves the same cents as before (a negative outflow is still money in; a negative inflow or split part is still left out)'
  - "Category fields keep the old native list's reach: includeHidden, allowNone (Uncategorised), transfers to the other open accounts on the main category only, allowCreate false"
  - 'PayeeCombobox.tsx is unchanged: the panel passes the phone height and 16px text in its className, so the 12rem popover width and the register row stay as they were'
  - 'The second-Escape case passed on the old code, so it stays as a test (no owner finding needed)'

patterns-established:
  - "Specs pick a register-form category with `getByRole('button', { name: /^Category:/ })` (or `/^Split N category:/`) and `categoryOption(form, name, { exact: true })`"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: 'Inline transaction form row on shared controls with the same saved results'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'e2e/tests/transactions.spec.ts, accessibility.spec.ts, connection.spec.ts, rules.spec.ts, settings.spec.ts, server-mode/auth.spec.ts, phone/phone-native.spec.ts'
        status: pass
  - id: D2
    description: 'Detail panel date saves on pick; Textarea notes; 44 px phone payee; payee kept after two Escapes'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'e2e/tests/transactions.spec.ts:220, :1302; recover.spec.ts; phone/phone-native.spec.ts:65'
        status: pass

duration: ~2h
completed: 2026-11-20
---

# Phase 3 Plan 13: Transaction form row and detail panel on the shared controls

**The register's inline form and the detail panel now use only shared controls. A day picked from the panel's calendar, or Today, saves at once. The panel's payee field is 44 px on phones.**

## Performance

- **Tasks:** 2 of 2
- **Commits:** 2 task commits plus this summary
- **Files modified:** 5 (2 components, 3 specs)

## Accomplishments

- **Form row:** the date is the shared DatePicker (`sm` in the row, `md` in the phone sheet). It is named "Date" through its hidden label, and the row keeps its own small label look. The category and split categories are CategorySelectButton, named `Category: …` and `Split N category: …`, with the same choices as the old list. Outflow, inflow and split amounts are CurrencyInput. Notes and split notes are the shared Input. Split rows have stable `newClientId` keys. In split mode the Category heading is a span. An `AmountFields` provider holds Save while an amount, or a half-typed date, can't be read.
- **Detail panel:** the date is the shared DatePicker, disabled when the transaction is reconciled. A calendar or Today pick saves at once. A typed date saves when the field is left, the same as before. A ref stops the same day from being sent twice, which would also add a second undo entry. Notes are the shared Textarea (3 rows, `resize-none!`, saved on blur as before). On phones the payee field is 44 px with 16px text (it was 41 px).

## Task Commits

1. **Task 1: Inline transaction form row**: `da3321ff` (feat)
2. **Task 2: Detail panel date, notes, payee height and the second Escape**: `877dc902` (feat)

## Files Created/Modified

- `client/src/components/transactions/TransactionFormRow.tsx`: DatePicker, CategorySelectButton ×2, CurrencyInput ×3, Input ×2, AmountFields, keyed split rows
- `client/src/components/transactions/TransactionDetailPanel.tsx`: DatePicker with save-on-pick, Textarea, payee phone height
- `e2e/tests/transactions.spec.ts`, `phone/phone-native.spec.ts`, `recover.spec.ts`: selectors and new tests

## Selector changes

| Spec & line                                      | Before                                              | After                                                                            | Reason                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transactions.spec.ts:47` (`fillNewTransaction`) | `combobox 'Category'` `.selectOption({ label })`    | `button /^Category:/` click, then `categoryOption(form, label, { exact: true })` | The category is CategorySelectButton over the CategoryPicker (D-05). The button is named `Category: <shown>`                                                                                                                                                                         |
| `transactions.spec.ts:142, 146`                  | `combobox 'Split N category'` `.selectOption(...)`  | `button /^Split N category:/`, `categoryOption(form, …)`                         | Same                                                                                                                                                                                                                                                                                 |
| `phone/phone-native.spec.ts:201`                 | `combobox 'Split 1 category'` `.selectOption(...)`  | `button /^Split 1 category:/`, `categoryOption(form, …)`                         | Same. Categories open the CategoryPicker on phones too (D-05), not a native list                                                                                                                                                                                                     |
| `transactions.spec.ts:126`                       | Outflow `toHaveValue('12.34')` after Tab            | `toHaveValue('$12.34')`                                                          | CurrencyInput formats an amount once it is left (see Behaviour changes)                                                                                                                                                                                                              |
| `transactions.spec.ts:202-204`                   | `textbox 'Date'` `.fill(day)`, `.blur()`            | `fillDate(panel, 'Date', day)`, then blur the focused element                    | The panel date is the shared DatePicker (D-07), which has segments, not a textbox. Which segment keeps focus depends on the Date format's order, so the spec blurs whatever is focused                                                                                               |
| `recover.spec.ts:45, 74`                         | `textbox 'Date'` `toBeDisabled()` / `toBeEnabled()` | `button 'Choose from a calendar'` `toBeDisabled()` / `toBeEnabled()`             | Same field, now the shared DatePicker. Its calendar button follows `isDisabled` (reconciled)                                                                                                                                                                                         |
| `transactions.spec.ts:520`                       | `checkbox 'Everyday Checking'` `.check()`           | `setToggle(checkbox 'Everyday Checking')`                                        | Orchestrator request: once 03-24 moves the register filters onto the shared Checkbox, its visual box blocks Playwright's `.check()`. `setToggle` clicks the wrapping label, which today's raw checkbox also has. It passes here, and on 03-24's branch according to the orchestrator |

New tests (not selector changes):

- `transactions.spec.ts:220` "a day picked in the detail panel saves at once, without leaving the field": Today, then a day from the calendar grid by keyboard. It checks the server, the register's day heading, and that focus stays in the field.
- `transactions.spec.ts:1302` "in the detail panel, a typed payee is kept when two Escapes close the panel".
- `phone/phone-native.spec.ts:86-93`: in the detail sheet, the payee is at least 44 px tall with 16px text, and the date is at least 44 px.

## Behaviour changes

- **Amounts format when left (CurrencyInput):** `12.34` shows as `$12.34` once the field is left. The saved cents are unchanged.
  - **Failing-first RED run** (unmodified TransactionFormRow): `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts -g "tabbing past the inflow|…"` failed at `transactions.spec.ts:125` (`Expected: "$12.34"`, `Received: "12.34"`). GREEN: the same test passes now.
- **Unreadable amount line:** each CurrencyInput shows its own "That isn't an amount…" alert under itself when left. Before, one shared line sat under the amount row. The row still won't save while any amount is unreadable (`transactions.spec.ts` "never saves text that isn't an amount as 0" passes unchanged).
- **Minus signs:** with `allowNegative` on every amount, the old readings hold. A negative outflow is money in. A negative inflow saves 0, as before. A negative split part is left out of the split but counted in "remaining", as before. These are quirks of the old code, kept on purpose (D-15). See Findings.
- **Half-typed date in the form row:** a date left half-typed now shows "Enter the full date…", and Save does nothing until the date is whole. A fully cleared date still passes and sends `date: ''`, as the old native field did (review IN-02; unchanged under D-15).
- **Detail panel date, pick (D-07 fix, not a new behaviour):** a calendar or Today pick saves at once.
  - **RED run 1, old code:** the test fails at `transactions.spec.ts:249` (no "Choose from a calendar" button on the native date input; 30 s timeout).
  - **RED run 2, DatePicker with the old blur-only save (the naive port):** `Expected: "2026-11-20"`, `Received: "2026-11-19"` at `:251`. Today's pick never saved, because focus returns to the field and no blur follows (Pitfall 2).
  - **GREEN:** passes with save-on-pick.
- **Detail panel date, typed:** still saves when the field is left. A debug run checked that typing a whole date sends no request until the field is left: no intermediate years such as 0002 or 0020 reach the server.
- **Category field look:** the row's category is now a bordered 40 px button that opens the searchable CategoryPicker. Before, it was a bare native select. It shows "Uncategorised" when empty, and its choices are the same.
- **Enter to save:** the plan says "Enter still saves the row", but the row had no Enter handler before this plan. `transactions.spec.ts` asserts that Enter in the payee field saves nothing. Nothing changed here. The same was recorded in 03-12 for Add transaction.
- **Edge case:** if the inflow holds text that isn't an amount and you then type an outflow, the inflow's text stays (marked) until it is fixed or cleared. Before, it was emptied. Its value was already 0, so CurrencyInput sees no change to reset on.

## Findings for the owner

- **Second Escape (02-REVIEW-DISPOSITION residual):** verified. A payee typed in the detail panel, then left with Escape (closes the list) and Escape again (closes the panel), is saved. The new test passed on the old code and passes now.
- **Form row heights:** CategorySelectButton has no size prop. It is fixed at `fieldHeights.md` (40 px), while the row's date, notes and amounts are `sm` (32 px), and the payee stays bare as before. The row's top grid is slightly uneven on desktop. A `fieldSize` prop on CategorySelectButton (outside this plan's files) would fix it, as would the `sm` category size 03-UI-SPEC §2 asks for.
- **Kept quirks in the form row's amounts:** a negative inflow saves a 0 transaction, and a negative split part is silently left out while still counted in "remaining". Both behaved this way before. They are kept unchanged (D-15) and could be tidied later, as 03-12 did for the split dialog.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

1. **[Rule 3, blocking] `recover.spec.ts` outside the listed files:** it selected the panel date as a textbox, so it was updated (orchestrator note 2).
2. **[Orchestrator request] `transactions.spec.ts:520`:** `.check()` changed to `setToggle` for 03-24.
3. **PayeeCombobox.tsx unchanged:** the 44 px height comes from the panel's own className (`max-md:min-h-11 max-md:text-base`), which the plan allows ("or remove the class that shrinks it"). Switching the panel to `fieldClassName` would also have widened its popover.
4. **Enter to save:** no change, because the row never had it (see Behaviour changes).

## Verification Results

- Precondition: `grep -c '^Reconcile: match$' 03-01-SUMMARY.md` → `1`.
- `cd client && npx tsc --noEmit -p .` → clean. `cd e2e && npx tsc --noEmit -p .` → clean.
- `npm --prefix client test` → 943/943 (103 files).
- Raw-control gate on TransactionFormRow.tsx and TransactionDetailPanel.tsx → `0` (was 12).
- No `selectOption` on a category field in transactions.spec.ts or phone-native.spec.ts.
- `npm --prefix lint test` → 86 pass. `npm --prefix lint run lint` → 0 errors, 122 warnings (cap 128). None are in changed files.
- Desktop (plan command plus the other specs that touch the form or panel): transactions, receipts-tax, recover, accessibility, connection, rules, settings, cash, currencies, files, receipts-reader, command-palette, security, safe-mode, depreciating-assets, phase9, planning → 168 passed and 1 failed. The failure was the panel-date selector, which blurred the day segment when focus was on the month. After that fix, `--project=desktop tests/transactions.spec.ts tests/receipts-tax.spec.ts` → 50/50.
- Phone: `--project=phone tests/phone/phone-native.spec.ts tests/phone/phone.spec.ts tests/phone/amounts-phone.spec.ts tests/phone/polish-phone.spec.ts` → 40/40.
- Server mode: `--project=server-mode tests/server-mode/auth.spec.ts` → 17/17.
- Prettier check on all changed files → clean.
- No gallery specimen changed, so no baselines need regenerating. No screenshots were committed.

## Threat Flags

- T-03-20: the panel sends a date only when it is a whole day that differs from the one last sent. The date is `isDisabled` when reconciled (`recover.spec.ts:45` checks this), and the server still refuses reconciled edits. The form row only creates new transactions (TransactionTable passes no `initial`), so it can't edit a reconciled one.
- No new routes, writes or packages (T-03-SC).

## Issues Encountered

- Other worktrees' Playwright runs held the fixed ports. Each run waited for 3169 to be free and for no `playwright test` process to be running. One run hit EADDRINUSE and was rerun.

## User Setup Required

None.

## Next Phase Readiness

After 03-24 (filters, marks), Transactions uses no CategorySelect. CategorySelect.tsx stays for Payment plans (WAVG-10). 03-15 runs the whole phone project.

## Review (one round, Claude Opus; fixed by the orchestrator on redesign)

- **WR-01 fixed:** the detail panel marked a picked day as sent before the server took it, so a failed save could not be retried and the field kept showing the unsaved day. A failed save now puts the field back on the saved day and clears the mark. Failing-first e2e: "a picked day whose save failed is sent again when picked again".
- **WR-02 fixed:** the "every other open account" transfer list is one helper, `transferTargets` (`client/src/utils/addTransaction.ts`, unit-tested), used by CategorySelect, TransactionFormRow, TransactionDetailPanel and TransactionTable.
- **IN-01 (deviation):** a typed date in the panel saves when the field is left, not as soon as it is whole, because React Aria reports years 0002, 0020 and 0202 as whole days while typing. Closing the panel with Escape right after typing relies on the browser firing blur on a removed node, as the payee field already does.
- **IN-02:** recorded above under Behaviour changes. A cleared form-row date still sends `''`, as before.
- **IN-03 fixed:** recover.spec.ts now checks the date's typed parts as well as its calendar button, locked and unlocked.
- **IN-04 (for 04-polish):** clicking the visible "Date" text no longer focuses the field (an `aria-hidden` span; the accessible name is kept).
- **IN-05 (for 04-polish):** TransactionFormRow's `initial` and `onDelete` branches have no caller; remove them or add a caller and a test.

## Self-Check: PASSED

- All 5 modified files exist and match commits `da3321ff` and `877dc902` on `worktree-agent-p0313-a1`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` are untouched (`git diff 942f1ee0 --stat -- .planning` was empty before this summary).
- No `crypto.randomUUID` or `hookTestHarness` in the changed files. Raw-control gate `0`. CategorySelect.tsx is not deleted.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-20_
