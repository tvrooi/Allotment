---
phase: 03-screens-on-shared-controls
plan: 12
subsystem: ui
tags:
  [
    transactions,
    combobox,
    date-picker,
    select,
    currency-input,
    checkbox,
    category-select-button,
    wave-g,
  ]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`), 03-04 Combobox option icon/trailing and CategorySelectButton props, 03-06 e2e `setToggle` helper'
provides:
  - 'AddTransactionModal: account list on the shared Combobox (On budget / Off budget groups, AccountIcon, balance inside Private, Cash (create) footer), DatePicker, shared Input for notes'
  - 'BulkEditModal (Select, CategorySelectButton, Input), BulkDeleteModal (Input), SplitTransactionModal (CategorySelectButton, CurrencyInput by amount, Input by percent) on shared controls'
  - 'TransferSuggestions and TransactionTable pick checkboxes on the shared Checkbox'
  - 'New e2e coverage: split dialog amount field (failing-first), full split by amount then percent, bulk edit'
affects: [03-13, 03-24, 04-polish]

plan_head_before: 6c48bb2e96aa917438c57430b57548eeb1885df8
plan_head_after: 9adf0f06aab83b0af579696b8f71812b3f83ab4e
commits: 3

actuals:
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - 'A Combobox value whose option arrives later (a just-created account) is set in an effect once the list holds it, because React Aria reads the options a commit after they render'
    - 'Split rows keyed by newClientId, amount parts in minor units through CurrencyInput (`onTextChange` keeps Left to split live), unreadable amounts held back by AmountFields/useAmountValidity'

key-files:
  created: []
  modified:
    - client/src/components/transactions/AddTransactionModal.tsx
    - client/src/components/transactions/BulkEditModal.tsx
    - client/src/components/transactions/BulkDeleteModal.tsx
    - client/src/components/transactions/SplitTransactionModal.tsx
    - client/src/components/transactions/TransferSuggestions.tsx
    - client/src/components/transactions/TransactionTable.tsx
    - e2e/tests/transactions.spec.ts
    - e2e/tests/cash.spec.ts
    - e2e/tests/currencies.spec.ts
    - e2e/tests/up-transfers.spec.ts
    - e2e/tests/household.spec.ts

key-decisions:
  - 'No new Combobox prop: 03-04 already gave ListOption `icon` and `trailing`, so the account options use them; Combobox.tsx, Combobox.test.ts, ComboboxCard.tsx and the gallery baselines are unchanged'
  - "The account field keeps the dialog's own `<label>` ('Account *', 'From account *', 'To account *') with the Combobox's aria-label, so its accessible name is the label without the mark and `getByText('From account *')` still holds"
  - "Split parts keep their accessible names 'Part N category/amount/percentage/notes' (D-15). The plan's 'Split N category' names belong to the inline form row (TransactionFormRow, 03-13), not this dialog"
  - "Bulk edit's New category and split parts keep the old list's reach: includeHidden, no inline category creation (allowCreate false). Split parts offer Uncategorised (allowNone); bulk edit's Set to does not, since Uncategorised is the mode list's own choice"
  - "TransactionTable's checkbox at :353 is the register's Pick-to-share box (the plan calls it select-all; the audit row :353 is this box). Select all is a button in SelectionSummary and is unchanged"

patterns-established:
  - "Specs open the Add transaction account list with `getByRole('combobox', { name: 'Account' }).click()` and pick `getByRole('option', { name: /…/ })`; the chosen account is read with `toHaveValue`"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: 'Add transaction on shared controls with balances inside Private and Cash (create) kept'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'e2e/tests/cash.spec.ts, transactions.spec.ts, currencies.spec.ts, safe-mode.spec.ts, accessibility.spec.ts (desktop)'
        status: pass
  - id: D2
    description: 'Bulk edit, bulk delete and split transaction on shared controls with the same saved results'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'e2e/tests/transactions.spec.ts (split amount field, split by amount then percent, bulk edit), transaction-clarity.spec.ts, cleanup.spec.ts'
        status: pass
  - id: D3
    description: 'Transfer suggestion and pick-to-share checkboxes on the shared Checkbox'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'e2e/tests/up-transfers.spec.ts, household.spec.ts, transactions.spec.ts (desktop)'
        status: pass

duration: ~2h
completed: 2026-11-20
---

# Phase 3 Plan 12: Transactions dialogs and register checkboxes on the shared controls

**Add transaction, bulk edit, bulk delete, split transaction, transfer suggestions and the register's pick boxes now use only shared controls. Balances in the account list stay inside Private.**

## Performance

- **Tasks:** 3 of 3
- **Commits:** 3 task commits plus this summary
- **Files modified:** 11 (6 components, 5 specs)

## Accomplishments

- Add transaction: the hand-rolled account dropdown and its document mousedown listener are gone. The account field is the shared Combobox with the same accounts, order and groups (open accounts, minus a transfer's other side; On budget, then Off budget; empty groups left out). Each option has its AccountIcon and its balance inside `<Private>`, red when negative unless balances are hidden. Cash (create) is the list's footer, shown under the same conditions as before. Date is the shared DatePicker (default today, required); Notes is the shared Input. Amount still takes focus on open.
- Bulk edit: the category and notes mode lists and the Reports and Review lists are the shared Select (same labels; values now strings). New category is CategorySelectButton. Payee and New notes are the shared Input.
- Bulk delete: the confirmation is the shared Input with the same aria-label and match rule (`typed.trim().toLowerCase() === 'delete'`). Delete stays disabled until it matches (T-03-19).
- Split transaction: each part's category is CategorySelectButton. Its amount is CurrencyInput by amount and the shared Input (with `readPercent`) by percent, and its notes are the shared Input. Rows have stable `newClientId` keys. Saved cents and percentages are unchanged.
- Transfer suggestions and the register's pick-to-share boxes are the shared Checkbox. They keep their aria-labels and checked/disabled states, and the wrapping labels are removed.

## Task Commits

1. **Task 1: Add transaction's account list on the shared Combobox**: `28abdc9f` (feat)
2. **Task 2: Bulk edit, bulk delete and split transaction**: `d993ad5d` (feat)
3. **Task 3: Transfer suggestions and the register's pick boxes**: `9adf0f06` (feat)

## Files Created/Modified

- `client/src/components/transactions/AddTransactionModal.tsx`: Combobox account list, DatePicker, Input notes, pending-account effect
- `client/src/components/transactions/BulkEditModal.tsx`: Select ×4, CategorySelectButton, Input ×2
- `client/src/components/transactions/BulkDeleteModal.tsx`: Input confirmation
- `client/src/components/transactions/SplitTransactionModal.tsx`: CategorySelectButton, CurrencyInput / Input, AmountFields, keyed rows
- `client/src/components/transactions/TransferSuggestions.tsx`, `TransactionTable.tsx`: Checkbox
- `e2e/tests/transactions.spec.ts`, `cash.spec.ts`, `currencies.spec.ts`, `up-transfers.spec.ts`, `household.spec.ts`: selectors and new tests

## Behaviour changes

- **Split transaction, part amount by amount (`Part N amount` → `CurrencyInput`):**
  - **Observable change:** On leaving the field, `60` formats as `$60` (it used to stay `60`). Text that isn't an amount (`abc`) stays in the field with `aria-invalid="true"` and shows the alert "That isn't an amount. Type it like 12.50 or 12,50." on blur. Before, it was marked by the border only, while typing. The split still can't be saved while any amount is unreadable.
  - **Negative or zero text:** `-5` used to be marked unreadable. CurrencyInput (no `allowNegative`) now reads it as the size `$5`, because a part's sign always follows the transaction. `0` now counts as an empty part, not an invalid one. Either way the split can't be saved until the parts add up.
  - **Failing-first RED run (unmodified SplitTransactionModal):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts` failed at `e2e/tests/transactions.spec.ts:1400` (`Expected: "$60"`, `Received: "60"`).
  - **Proving GREEN tests:** `transactions.spec.ts` "the Split transaction dialog › a part amount formats when left, and text that is not an amount is marked" and "… › splits by amount with the category buttons, then changes the parts by percent".
- **Split / bulk edit category lists:** the native list showed every category flat with optgroups. CategorySelectButton opens the searchable CategoryPicker (search, icons when shown). The reach is the same: hidden categories are included and no category can be created there.
- **Bulk edit Set to:** the old native list defaulted to "Uncategorised", which under "Set to" changed nothing. The button now shows "Choose a category…" until one is picked.
- **Add transaction account field:** it is a combobox you can type to filter, and its accessible name is the label (`Account`, `From account`, `To account`). The old button was named by the account it showed. The chosen account's icon shows in the list, not inside the field.
- **Transfer suggestions:** with the wrapping label gone, only the box toggles a pair; clicking the row's text no longer does (the plan's "remove wrapping labels"). The box grows from 16 px to the shared 20 px (44 px target on phones).
- **Enter to add (UI-SPEC D-15):** before this change Add transaction had no Enter handler and no `<form>`. Nothing changed here.

## Selector changes

| Spec & line                          | Before                                                                                                  | After                                                                                                               | Reason                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactions.spec.ts:493-494`       | `getByRole('button', { name: /Select account/ })`, `getByRole('button', { name: /Everyday Checking/ })` | `getByRole('combobox', { name: 'Account' })`, `getByRole('option', { name: /Everyday Checking/ })`                  | Account picker moved to the shared Combobox: a combobox named by its label, accounts are listbox options                                                   |
| `transactions.spec.ts:525-528`       | `button /Select account/`; `expect(button /Rainy Day Savings/).toHaveCount(1)`                          | `combobox 'From account'`; `option /Rainy Day Savings/` count 0, `option /Everyday Checking/` visible               | Same; the check that the transfer's other side isn't offered now reads the options directly (the old count of 1 matched the category button)               |
| `transactions.spec.ts:804, 830`      | `getByRole('button', { name: /Rainy Day Savings/ \| /Everyday Checking/ })` visible                     | `getByRole('combobox', { name: 'Account' })` `toHaveValue(…)`                                                       | The chosen account is the combobox's value, not a button name                                                                                              |
| `transactions.spec.ts:817-818`       | button `/Select account/`, button `/Everyday Checking/`                                                 | combobox `Account`, option `/Everyday Checking/`                                                                    | As above                                                                                                                                                   |
| `transactions.spec.ts:843`           | `button /Select account/` visible                                                                       | combobox `Account` `toHaveValue('')`                                                                                | No account chosen = an empty field showing the placeholder                                                                                                 |
| `cash.spec.ts:34, 37`                | button `/Select account/`, button `new RegExp(bank.name)`                                               | combobox `Account`, option `new RegExp(bank.name)`                                                                  | As above; `Cash (create)` stays a button (the list's footer)                                                                                               |
| `cash.spec.ts:45` (new)              | (none)                                                                                                  | combobox `Account` `toHaveValue('Cash')`                                                                            | Checks the field shows the Cash account the warning's button just made                                                                                     |
| `cash.spec.ts:65-67`                 | button `/Select account/`; button `/C Cash/` visible                                                    | combobox `Account`; `toHaveValue('Cash')`                                                                           | The old name included the icon's initial; the value is the account name                                                                                    |
| `cash.spec.ts:75-83`                 | `getByRole('button', { name: /C Cash/ }).click()`; `getByRole('button', { name: /Everyday/ }).last()`   | combobox `toHaveValue('Cash')`, `.click()`; option `/Cash/` visible; option `/Everyday/`; `toHaveValue('Everyday')` | As above                                                                                                                                                   |
| `currencies.spec.ts:92-93`           | button `/Select account/`, button `/Girokonto/`                                                         | combobox `Account`, option `/Girokonto/`                                                                            | As above                                                                                                                                                   |
| `up-transfers.spec.ts:51, 54`        | `box.uncheck()`                                                                                         | `setToggle(box, false)`                                                                                             | Shared Checkbox: its visual box covers React Aria's 1 px input, so Playwright's `uncheck()` was intercepted; `setToggle` clicks the label. Names unchanged |
| `household.spec.ts:477-478, 529-530` | `getByRole('checkbox' …).check()`, `getByLabel(/^Pick …/).check()`                                      | `setToggle(getByRole('checkbox', { name: /^Pick …/ }))`                                                             | Same reason, for the register's pick-to-share boxes                                                                                                        |

New tests (not selector changes): `transactions.spec.ts:1377` "the Split transaction dialog" (two tests) and `:1466` "bulk edit sets the category, notes, payee and report visibility on the whole list".

## Findings for the owner

- **Shared Combobox and late options:** a value set before its option arrives leaves the text blank only while the field is focused; React Aria refreshes the text for a late option otherwise (`useComboBoxState`). Only the footer's Cash (create), which keeps focus in the field, needs the effect in AddTransactionModal (corrected after review IN-01).
- **Gallery Docker run:** `bash e2e/gallery-baselines.sh` compared every baseline without a pixel difference: 205 passed and 1 failed. The failure was the interaction test `tests/gallery/combobox.spec.ts:134`, which timed out at an option click (`:141`) during a 23-minute run. This plan changes no Combobox, gallery or listItems code. The same spec passed 42/42 on the host (`--project=gallery --repeat-each=3`). I treated it as flaky, but did not prove that inside Docker.

## Review (03-12-REVIEW-opus.md), the one round

The plan merged before its review so 03-13 and 03-24 could start (owner, 20 Nov: one review round, run in parallel); the orchestrator fixed the findings on `redesign`.

- **WR-01 fixed:** after Cash (create), the dialog kept the previous account (perhaps the bank-fed one) until the account list reloaded, and a second press made a second Cash account. Add transaction and both Cash buttons are now unavailable from the create request until the list holds the new account, and a failed reload stops the wait with a line asking to choose Cash again. Test: `cash.spec.ts` 'while the new Cash account loads, nothing can be added or created twice' holds the account list's reload.
- **For the PR's behaviour changes (not code changes):**
  - IN-02: "Left to split" now fills the first part whose amount is unreadable or zero, so it can replace text like `abc`; before, it filled the first empty part.
  - IN-03 (owner acceptance needed): a split part's `-5` now reads as `$5` with no mark, and `0` counts as empty, because CurrencyInput has no `allowNegative` here. It cannot save wrong data (parts must add up to the total and follow its sign). If not accepted: pass `allowNegative` and mark a negative part unreadable.
  - IN-04: the register's pick-to-share box is now only the checkbox, not the whole left strip. The must_have "Enter still adds the transaction" was never true (no form or Enter handler at 6c48bb2e); mark it N/A or raise Enter-to-add separately.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

1. **[Rule 3 – blocking] Spec files outside the listed scope:** `currencies.spec.ts` (account picker selector), `up-transfers.spec.ts` and `household.spec.ts` (checkbox toggles) select the changed controls, so they were updated (orchestrator note 2).
2. **[Rule 1 – bug] Cash (create) left the account field blank:** found by `cash.spec.ts:66` after the Combobox move. I fixed it with the pending-account effect in AddTransactionModal (see Findings). A first fix that awaited the accounts refetch did not work, and neither did choosing during render.
3. **Labels:** Split parts keep 'Part N …' (D-15) instead of the plan's 'Split N category'. See key-decisions.
4. **No Combobox prop, test or gallery specimen:** the condition in the plan ("if Combobox cannot show…") did not hold.
5. **Added coverage:** bulk edit had no e2e test, so one was added to back the "same results" truth.

## Verification Results

- Precondition: `grep -c '^Reconcile: match$' 03-01-SUMMARY.md` → `1`.
- `npm --prefix client test -- src/components/ui/Combobox.test.ts` → 31/31; full client unit suite 933/933 (101 files).
- `cd client && npx tsc --noEmit -p .` → clean.
- Task 2 gate (Bulk edit, Bulk delete, Split) → `0`. Task 3 gate (all six files) → `0` (was 15).
- Desktop: cash, transactions, safe-mode, currencies, accessibility, cleanup → 82 passed plus the 2 expected failures (the split RED test, and the Cash blank-field bug before its fix). Then cash 4/4; transactions + transaction-clarity + cleanup 51/51; up-transfers + transactions + household + review run before the setToggle change: 76 passed, 3 failed (the `.check()`/`.uncheck()` interceptions). After it: up-transfers, household, accessibility, safe-mode, currencies, navigation, dialog-focus, command-palette, first-run, receipts-tab, cleanup, cash → 115/115.
- Phone project: `tests/phone/phone.spec.ts`, `tests/phone/phone-native.spec.ts` → 26/26.
- `npm --prefix lint test` → pass; `npm --prefix lint run lint` → 0 errors, 122 warnings (cap 128). None of the warnings are on changed lines.
- `bash e2e/gallery-baselines.sh` → no pixel differences; 205 passed, 1 failed (interaction test, see Findings). Gallery combobox spec on host 42/42.
- No gallery specimen changed, so no baselines need regenerating.

## Threat Flags

- T-03-18: account balances stay inside `<Private>` in the option's `trailing` node. safe-mode.spec passed.
- T-03-19: bulk delete keeps the same match rule; Delete is disabled until it matches. cleanup.spec passed.
- No new routes, writes or packages.

## Issues Encountered

- Another worktree's Playwright runs held the fixed ports (3169-3180), so each run waited for 20 s of free ports. One early run hit EADDRINUSE and was rerun.

## User Setup Required

None.

## Next Phase Readiness

03-13 (form row, detail panel) can follow the same selectors. After 03-13, only Payment plans use CategorySelect, and CategorySelect.tsx stays (WAVG-10).

## Self-Check: PASSED

- All 11 modified files exist and match commits `28abdc9f`, `d993ad5d` and `9adf0f06` on `worktree-agent-p0312-a1`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` are untouched.
- No `crypto.randomUUID` or `hookTestHarness` in the changed files. Raw-control gate `0`. CategorySelect.tsx is not deleted.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-20_
