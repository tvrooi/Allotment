---
phase: 03-screens-on-shared-controls
plan: 14
subsystem: ui
tags:
  [
    react-aria,
    shared-controls,
    receipts,
    datepicker,
    combobox,
    select,
    checkbox,
    category-picker,
    wavg-05,
  ]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`) and 03-04 `CategorySelectButton` `groups`/`allowCreate`/`includeHidden` pass-through'
provides:
  - '`ReceiptEditor.tsx` on shared `DatePicker` (Date, disabled while reading), `CategorySelectButton` (`Item N category: <shown>`, `allowNone`), `Combobox` (Account), `Input` and `CurrencyInput`, with every writing button on `useCanSave` and one `SavingPausedHint`'
  - '`ReceiptsTab.tsx` receipt settings on shared `Checkbox` (four toggles), `Select` (Who reads them), `Combobox` (local Model) and `Input` (API key, cloud Model, Server address)'
affects: [03-15]

tech-stack:
  added: []
  patterns:
    - 'Line-item rows keyed by a stable key (server line item id, or `newClientId()` for a new row), stripped before saving'
    - "A Combobox whose choice is saved at once ignores `onChange('')` (emptying the text to search); an explicit 'none' choice has its own sentinel value (`NO_MODEL`), as 03-11's `NONE_ACCOUNT`"

key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-14-SUMMARY.md
    - client/src/components/receipts/ReceiptEditor.test.ts
    - client/src/components/receipts/ReceiptsTab.test.ts
  modified:
    - client/src/components/transactions/CategorySelectButton.tsx
    - client/src/components/transactions/CategoryPicker.test.ts
    - client/src/components/receipts/ReceiptEditor.tsx
    - client/src/components/receipts/ReceiptsTab.tsx
    - e2e/tests/receipts-tab.spec.ts
    - e2e/tests/receipts-reader.spec.ts

key-decisions:
  - "Merchant, notes, item descriptions and the search field stay on the shared `Input` (owner's answer: merchant text fields stay Input)"
  - 'Item categories pass `groups`, `allowNone`, `allowCreate={false}`, `includeHidden`, so the field matches the old native select: every category, shows `Uncategorised` for none, no inline create; named `Item N category: <shown>` (review WR-01; second review WR-01 removed `nameIsLabel`)'
  - 'The plan said to keep Save on `useCanSave()` and `<SavingPausedHint />`, but the file had neither. Every button that writes from the editor (Save, Read receipt, Split by items, Unmatch, Match, Create transaction, Delete receipt) now follows `useCanSave()`, with one hint above them (CLAUDE.md §Client; review WR-03). This is a behaviour change to name in the PR: with saving paused these buttons are disabled'
  - "The local Model Combobox keeps the old select's `Choose a model…` choice, which unsets the model, as an option with its own value (`NO_MODEL`), and ignores `''` (the text emptied to search) so a mid-edit clear is never saved (review WR-02 restored the old behaviour)"

requirements-completed: [WAVG-05]

plan_head_before: 6c48bb2e96aa917438c57430b57548eeb1885df8
plan_head_after: 3d5ba8f2
commits: 8

actuals:
  tasks: 2
  commits: 8

coverage:
  - id: D1
    description: 'Receipt editor on shared DatePicker, CategorySelectButton, Combobox, Input and CurrencyInput; writing buttons on useCanSave'
    requirement: 'WAVG-05'
    verification:
      - kind: e2e
        ref: 'e2e/tests/receipts-tab.spec.ts'
      - kind: unit
        ref: 'client/src/components/receipts/ReceiptEditor.test.ts'
  - id: D2
    description: 'Receipt settings on shared Checkbox, Select, Combobox and Input; photo input stays native'
    requirement: 'WAVG-05'
    verification:
      - kind: e2e
        ref: 'e2e/tests/receipts-reader.spec.ts'
      - kind: unit
        ref: 'client/src/components/receipts/ReceiptsTab.test.ts'

duration: ~40min
completed: 2026-11-20
---

# Phase 3 Plan 14: Receipt dialogs on shared controls Summary

**Receipt editor and receipt settings moved onto the shared DatePicker, CategorySelectButton, Combobox, Select, Checkbox and Input; only the scan-a-receipt photo input stays native**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-11-20
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Receipt editor: Date is the shared `DatePicker` (optional, so it can be cleared as before, and disabled with the rest of the form while a receipt is read), each item's category is `CategorySelectButton` named `Item N category: <shown>` and showing `Uncategorised` for none, the account for a new transaction is a `Combobox` over open accounts with the `Choose an account…` wording, and the item category's extra bordered wrapper is gone.
- Line-item rows now have stable keys, so removing a row never hands its draft amount or open picker to the next one.
- Every button that writes from the editor follows `useCanSave()`, with one `<SavingPausedHint />` above them.
- Receipt settings: the three receipt toggles and "Read new photos when they are added" are shared `Checkbox`es with the label and hint as children; the provider is the shared `Select` (same values); the local model is a `Combobox` over `Choose a model…` (unsets it, as before) and the models the server reports (same labels, vision models first); the API key stays a password `Input` with `autoComplete="off"` and the saved key is never put in it.

## Task Commits

1. **Task 1: Receipt editor** - `21a88c6b` (feat)
2. **Task 2: Receipt reader settings** - `eeef4901` (feat)
3. **Task 2 fix: save the local model only when one is picked** - `a605a6f5` (fix)
4. **Review CR-01: disable the receipt date while the model reads it** - `527f2f25` (fix)
5. **Review WR-01: keep `Item N category` as the name, show Uncategorised** - `3cfca295` (fix)
6. **Review WR-02: let the local model be unset again** - `ca96e6d9` (fix)
7. **Review WR-03: pause every receipt button that writes** - `4f9611db` (fix)
8. **Review WR-04: cover the item row keys** - `3d5ba8f2` (test)

## Files Created/Modified

- `client/src/components/receipts/ReceiptEditor.tsx` - DatePicker, CategorySelectButton, Combobox; stable row keys; useCanSave + SavingPausedHint
- `client/src/components/receipts/ReceiptsTab.tsx` - Checkbox, Select (ui/Select), Combobox; `Select` no longer imported from ui/Input
- `e2e/tests/receipts-tab.spec.ts` - fillDate, category picker, account Combobox, setToggle
- `e2e/tests/receipts-reader.spec.ts` - model Combobox pick, unset and re-pick, setToggle, DatePicker segment check
- `client/src/components/receipts/ReceiptEditor.test.ts`, `ReceiptsTab.test.ts`, `transactions/CategoryPicker.test.ts` - unit tests for the review fixes

## Selector changes

| Spec                              | Before                                                                                                                                  | After                                                                                                                                      | Reason                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receipts-tab.spec.ts` (4 places) | `getByLabel('Date', { exact: true }).fill(isoDay())`                                                                                    | `fillDate(dialog, 'Date', isoDay())`                                                                                                       | Date is the shared DatePicker (segments), not a native date input (D-07)                                                                                          |
| `receipts-tab.spec.ts` (2 loops)  | `getByLabel('Item N category').selectOption(id)`                                                                                        | `getByRole('button', { name: /^Item N category: / }).click()` then `categoryOption(dialog, name, { exact: true }).click()`       | Native select became CategorySelectButton (a button, not a combobox); its name is `Item N category: <shown>` (D-05 naming) and rows are listbox options |
| `receipts-tab.spec.ts`            | `getByLabel('Account').selectOption(card.id)`                                                                                           | `getByRole('combobox', { name: 'Account' }).fill('Card')` then the `Card` option                                                           | Native select became the shared Combobox (user-grown list)                                                                                                        |
| `receipts-tab.spec.ts`            | `getByLabel(/Autosplit…/).uncheck()`, `getByLabel(/Tag "Receipt"/).uncheck()`                                                           | `setToggle(…, false)`                                                                                                                      | Shared Checkbox hides React Aria's 1 px input; the wrapping label takes the click                                                                                 |
| `receipts-reader.spec.ts`         | `getByLabel('Model').selectOption('qwen3-vl:4b-instruct')` and `getByRole('option', { name: 'qwen2.5:3b (text only)' }).toBeAttached()` | `getByRole('combobox', { name: 'Model' }).fill('qwen')`, the text-only option visible in the listbox, then click `/^qwen3-vl:4b-instruct/` | Local model is the shared Combobox; its options exist only while the list is open                                                                                 |
| `receipts-reader.spec.ts`         | `reading.check()`                                                                                                                       | `setToggle(reading, true)`                                                                                                                 | Shared Checkbox (as above)                                                                                                                                        |
| `receipts-reader.spec.ts`         | (new)                                                                                                                                   | `modelBox.fill('Choose')`, pick `Choose a model…`, poll the reader's `model` to `null`, reading disabled, then re-pick                     | Covers WR-02: the model can be unset as with the old empty option                                                                                                 |
| `receipts-tab.spec.ts`            | (new)                                                                                                                                   | Add two items, categorise item 2, remove item 1; item 1 then shows `Pears`, `$8` and the category, and no list is open                     | Covers WR-04: removing an item moves the next one up with its own values                                                                                          |
| `receipts-reader.spec.ts`         | `getByLabel('Date', { exact: true }).toHaveValue(isoDay())`                                                                             | `group 'Date'` segments' `aria-valuenow` equal today's year, month and day                                                                 | DatePicker has no single input value; the segments hold the day                                                                                                   |

Accessible names are unchanged: `Date`, `Item N category` (now `Item N category: <shown>`, the D-05 naming of every moved category field; the role is a button, not a select), `Account`, `Who reads them`, `Model`, `API key`, `Server address`, and the toggles' label-plus-hint text.

## Stays native

- `client/src/components/receipts/ReceiptsTab.tsx` — the scan-a-receipt photo input (`<input type="file" accept="image/*" capture="environment">`, "Scan receipt: take a photo"), D-17: the browser's file dialog / camera. It is the only native input left in either file.

## Deleted files

None.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Save button had no useCanSave / SavingPausedHint**

- **Found during:** Task 1
- **Issue:** The plan said to keep them, but `ReceiptEditor.tsx` had neither.
- **Fix:** Added `useCanSave()` to the Save button's `disabled` and `<SavingPausedHint />` above it.
- **Commit:** `21a88c6b`

**2. [Rule 2 - Missing] Index keys on line-item rows**

- **Issue:** Rows holding CurrencyInput drafts and a picker were keyed by index (orchestrator note 3).
- **Fix:** Stable key per row (server id, or `newClientId()`), stripped before saving.
- **Commit:** `21a88c6b`

**3. [Rule 1 - Bug] Clearing the Model Combobox text saved no model**

- **Found during:** Task 2 review
- **Issue:** React Aria clears the selection when the text is emptied to search; the handler saved `model: null` at once.
- **Fix:** Ignore `''`. This first dropped the old "Choose a model…" unset choice; review WR-02 restored it (`ca96e6d9`).
- **Commit:** `a605a6f5`

### Review fixes (03-14-REVIEW-opus.md)

Each fix's unit test was checked to fail without it by putting the previous commit's source file back, running vitest, then restoring the file.

| Finding                            | Fix                                                                                                                                    | Commit     | Test, and how it fails without the fix                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01 date editable while reading  | `isDisabled={reading}` on the DatePicker (the fieldset reaches only native controls)                                                   | `527f2f25` | `ReceiptEditor.test.ts`: a pending receipt's date group has `data-disabled="true"`, an idle one has none. Without the fix: no `data-disabled` (failed)                                                                                                                                                                                                                                                                                                                              |
| WR-01 name and none label          | `CategorySelectButton` gains opt-in `nameIsLabel`; receipt items pass it and `allowNone`                                               | `3cfca295` | `ReceiptEditor.test.ts`: the trigger is `aria-label="Item 1 category"` and shows `Uncategorised`; `CategoryPicker.test.ts`: `nameIsLabel` names by label alone. Without it: both failed (name `Item 1 category: Search categories...`)                                                                                                                                                                                                                                              |
| WR-02 model could not be unset     | `Choose a model…` restored as option `NO_MODEL`, saving `model: null`; `''` still ignored. Helpers `localModelItems`, `localModelPick` | `ca96e6d9` | `ReceiptsTab.test.ts`: the list starts with `Choose a model…`, which picks `null`, and `''` picks nothing. At the previous commit the helpers do not exist (failed); the behaviour itself is covered by the new step in `receipts-reader.spec.ts`                                                                                                                                                                                                                                   |
| WR-03 only Save was gated          | Read receipt, Split by items, Unmatch, Match, Create transaction and Delete receipt follow `useCanSave()`; one hint above them         | `4f9611db` | `ReceiptEditor.test.ts`: with saving paused, Read receipt, Save, Delete receipt, Split by items and Unmatch are disabled and the hint shows once; with saving live, none are disabled. Without the fix: Read receipt was enabled (failed). Match and Create transaction appear only after a click, so the static render cannot reach them; they are gated the same way                                                                                                              |
| WR-04 untested row keys and gating | Row helpers `itemRows`, `blankItemRow`, `savedItems`                                                                                   | `3d5ba8f2` | `ReceiptEditor.test.ts`: keys follow the item through a removal, new rows get fresh keys, and saving drops keys and empty rows. At the previous commit the helpers do not exist (failed). The new step in `receipts-tab.spec.ts` checks the visible result of a removal. It probably passes with index keys too, because the fields are controlled: index keys lose only an open picker or an amount mid-typing, which a spec cannot reliably set up. Save gating is the WR-03 test |

Info items IN-01 (Account Combobox `fieldSize="sm"`) and IN-02 (an `expectDate` helper) were not asked for and are not done.

### Second review (03-14-REVIEW-opus2.md), fixed by the orchestrator

The owner capped reviews at one round on 20 Nov, so the second review's one warning was fixed and checked by the orchestrator, not reviewed again.

- **WR-01: `nameIsLabel` hid the chosen category from screen readers.** A button's `aria-label` replaces its content, so `Item 1 category` never announced Groceries or Uncategorised, where the old select exposed its value. The prop is removed. Receipt items use the default naming every other moved category field uses, `Item N category: <shown>` (the accepted D-05 naming), and the specs select by the `^Item N category: ` prefix. `ReceiptEditor.test.ts` now expects `aria-label="Item 1 category: Uncategorised"`, which fails with the label-only name. The `nameIsLabel` unit test in `CategoryPicker.test.ts` is gone with the prop.
- IN items from that review were not done.

## Verification

After the review fixes (Playwright not run: another executor holds the e2e ports; the orchestrator runs the specs):

- `cd client && npx vitest run`: 103 files, 940 tests passed
- `cd client && npx tsc --noEmit` and `tsc -b`: clean; `cd e2e && npx tsc --noEmit`: clean
- Lint: 0 errors, 124 warnings (cap 128)
- To run: `receipts-tab.spec.ts`, `receipts-reader.spec.ts` (both have changed selectors and new steps), `receipts-tax.spec.ts`, `accessibility.spec.ts`

Before the review:

- `npm --prefix e2e test -- --project=desktop tests/receipts-tab.spec.ts`: 3 passed (after Task 1)
- `npm --prefix e2e test -- --project=desktop tests/receipts-reader.spec.ts tests/receipts-tab.spec.ts tests/receipts-tax.spec.ts`: 6 passed (after the final commit)
- Plan gate (perl, both receipt files): printed `0` (HEAD was 6); `ReceiptsTab.tsx` keeps exactly one `type="file"`
- `cd e2e && npx playwright test --project=desktop tests/accessibility.spec.ts`: 13 passed
- Specs grepped for every changed name (`Date`, `Item N category`, `Account`, `Model`, `Who reads them`, the toggle labels): only the receipts specs reference them; `Search transactions` (files.spec.ts) is unchanged; no phone spec opens the receipt dialogs
- `npm test --prefix client`: 101 files, 933 tests passed; `tsc -b` clean
- Lint: 0 errors, 124 warnings (cap 128), none in the receipt files

## Threat Model Verification

- T-03-22: the API key field is still the shared `Input` with `type="password"` and `autoComplete="off"`; its value is only local typing (`key`), cleared after save; the saved key is never placed in it.
- T-03-SC: no package added.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Receipt dialogs are on the shared set; no gallery specimen added, so no baselines to regenerate.

## Self-Check: PASSED

- Files exist: ReceiptEditor.tsx, ReceiptsTab.tsx, both specs, this SUMMARY
- Commits exist: 21a88c6b, eeef4901, a605a6f5, 527f2f25, 3cfca295, ca96e6d9, 4f9611db, 3d5ba8f2
- No STATE.md or ROADMAP.md change
