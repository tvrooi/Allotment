---
phase: 03-screens-on-shared-controls
plan: 10
subsystem: ui
tags:
  [
    shared-controls,
    budget,
    money-moves,
    targets,
    payday,
    category-picker,
    currency-input,
    number-field,
    date-picker,
    d-14,
    wave-g,
    wavg-05,
  ]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`); 03-04 `CategorySelectButton` `extraItem`/`hint`/`groups`/`allowNone`/`allowCreate`/`includeHidden`; 03-02 shared Select, Combobox, DatePicker, Checkbox, NumberField, CurrencyInput'
provides:
  - "`MoneyMoves.tsx` From/To on `CategorySelectButton` ('Move from', 'Move to') with '($X available)' hints and To's pinned 'Ready to assign' (same `ready-to-assign` value); amount on `CurrencyInput` with the forwarded ref"
  - '`TargetCard.tsx` on shared `Select`, `CurrencyInput`, `DatePicker` and a `NumberField` cycle bounded 1 to 60, Save target behind `AmountFields`'
  - '`PaydayPlan.tsx` editor, funding panel and plan list on `CurrencyInput`, `CategorySelectButton`, shared `Select`, `Combobox`, `DatePicker`, `Checkbox` and a `NumberField` percent bounded 0 to 100; `MoneyInput` removed'
  - 'Two D-14 e2e cases (target cycle, payday percent), each committed failing first'
affects: [03-15]

tech-stack:
  added: []
  patterns:
    - "A `CategorySelectButton` over a caller's own category subset: filter `useCategories()` groups to the ids the screen was given, with `includeHidden` and `allowCreate={false}`, so the picker offers exactly the old `<select>`'s options"
    - '`CurrencyInput` inside a `<form>` also passes `onTextChange` (non-null cents) so Enter submits what was just typed; it commits on blur otherwise'
    - 'A visible label beside a HelpTip: `aria-hidden` text plus `DatePicker hideLabel` with the same name'
    - "DatePicker reports a half-typed draft to an enclosing `AmountFields` (like NumberField and CurrencyInput), so a form's save waits while a date is half-typed; a panel that needs to know (the funding preview) wraps the picker in its own `AmountFields`"
    - 'Editor rows of a list the user edits use a key from `newClientId` held beside the list, never `index` and never saved'

key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-10-SUMMARY.md
  modified:
    - client/src/components/budget/MoneyMoves.tsx
    - client/src/components/budget/TargetCard.tsx
    - client/src/components/budget/PaydayPlan.tsx
    - e2e/tests/envelope-funding.spec.ts
    - e2e/tests/targets.spec.ts
    - e2e/tests/payday.spec.ts
    - e2e/tests/first-import.spec.ts
    - e2e/tests/polish.spec.ts
    - client/src/components/ui/DatePicker.tsx
    - client/src/pages/devGallery/DateCards.tsx
    - e2e/tests/gallery/dates.spec.ts
    - client/src/components/transactions/CategorySelectButton.tsx
    - client/src/components/transactions/CategoryPicker.test.ts

key-decisions:
  - "Move money's pickers offer the categories the panel is given (the `categories` prop), not every category: `useCategories()` groups filtered to those ids, hidden ones kept, inline creation off"
  - "The payday rule's category picker offers exactly `/payday/categories` (what the server funds), filtered the same way"
  - 'Dates the native inputs marked `required` now gate the save button instead (DatePicker''s `validationBehavior="aria"` never blocks a native submit): Save target waits for a due date where one is needed; Save payday plan waits for the anchor and for each ''due'' rule''s date'
  - 'Funding method keeps its accessible name `Funding method N` through `aria-label` with an `aria-hidden` visible caption, as the old wrapping label plus aria-label did (D-15)'
  - 'Plan name and Time zone stay on the shared `Input` they already used (they never imported Select); only their surroundings were reformatted'
  - "Review CR-01: the four CurrencyInputs pass `allowNegative`, so a typed negative meets the existing positive-amount checks (move, target) or the server's nonnegative schema (payday) instead of being saved as its positive"
  - "Review CR-02: no existing DatePicker path reported a half-typed date (it emits '' only when every segment is cleared, with or without isRequired), so the shared DatePicker was extended to report it to AmountFields, with a gallery state; it also keeps one CalendarDate per value, because React Aria compares by identity and a re-render otherwise restored the last whole date"
  - 'Review WR-01: `CategorySelectButton` takes `categoryIds`, resolved in `categoryButtonPickerProps`, instead of each screen filtering groups itself'

requirements-completed: [WAVG-05]

plan_head_before: 334b3207da43dce9eb8a29a273653745ebf9ae54
plan_head_after: df9663bb9ee648803ff5cc6c1aac15d948c287a4
commits: 13

actuals:
  tokens: 52000
  tasks: 3
  commits: 13

coverage:
  - id: D1
    description: "Move money From/To on CategorySelectButton with '($X available)' hints and pinned 'Ready to assign'; amount on CurrencyInput"
    requirement: 'WAVG-05'
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/envelope-funding.spec.ts tests/safe-mode.spec.ts (15/15 passed)'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Category target editor on shared Select, CurrencyInput, DatePicker and a 1-to-60 NumberField cycle (D-14)'
    requirement: 'WAVG-05'
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/targets.spec.ts (3/3 passed; cycle case failed first)'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Payday plan editor, funding panel and plan list on shared controls with a 0-to-100 NumberField percent (D-14)'
    requirement: 'WAVG-05'
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/payday.spec.ts tests/envelope-funding.spec.ts (13/13 passed; percent case failed first)'
        status: pass
      - kind: e2e
        ref: 'npx playwright test --project=desktop tests/accessibility.spec.ts tests/first-import.spec.ts tests/polish.spec.ts tests/budget.spec.ts tests/category-goals.spec.ts tests/planning.spec.ts (70/70 passed)'
        status: pass
      - kind: other
        ref: 'perl raw-control gate on MoneyMoves.tsx + TargetCard.tsx + PaydayPlan.tsx => 0 (HEAD was 11)'
        status: pass
    human_judgment: false

duration: 25 min
completed: 2026-11-20
status: complete
---

# Phase 03 Plan 10: Money Moves, Targets and Payday Plan on Shared Controls Summary

**Moved Budget's money moves, category targets and payday plan onto the shared controls (category picker, CurrencyInput, Select, Combobox, DatePicker, Checkbox, NumberField). The target cycle (1 to 60) and the payday percent (0 to 100) are now bounded NumberFields, and each was tested failing first. The three files have 0 raw controls left (11 before).**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-20
- **Tasks:** 3 (plus 1 follow-up fix found during Task 3)
- **Files modified:** 8 (3 components, 5 specs) plus this summary

## Accomplishments

- `MoneyMoves.tsx`: From and To are `CategorySelectButton` (`label` 'Move from' / 'Move to', placeholder 'Choose category') over the categories the panel receives, each with the old `({formatCurrency(balance)} available)` hint. To pins `extraItem` 'Ready to assign' with the same `ready-to-assign` value. Amount is `CurrencyInput` (`aria-label` 'Move amount'). It keeps the forwarded `amountField` ref, so a "move from" request still focuses it. Preview move waits under `AmountFields` while the text cannot be read. Visible captions use the shared `Label htmlFor`.
- `TargetCard.tsx`: Target type is the shared `Select` (same `TYPES` labels, its help as `description`). Target amount is `CurrencyInput`. Due/Next due date is the shared `DatePicker` (`isRequired`, no bounds, as before). 'Repeats every (months)' is a `NumberField` with min 1 and max 60, matching `cycleMonths` in `targetConfig.ts`. Save target sits behind `AmountFields`.
- `PaydayPlan.tsx`: expected pay and rule amounts are `CurrencyInput`, and `MoneyInput` is removed. Each rule's category is `CategorySelectButton` (`Category N`). Weekend adjustment, Funding method and Payday are the shared `Select`. The plan list is the shared `Combobox`. The anchor, due and actual dates are the shared `DatePicker`. The income and 'Show archived plans' boxes are the shared `Checkbox`. Percent is a `NumberField` with min 0 and max 100. The server's 'Percentages must total at most 100' still shows through `save.error`, unchanged.
- Payloads unchanged: moves send `{sourceId, destinationId, amount, revision}`, targets the same `TargetInput`, payday plans the same `PaydayConfig` (verified by the specs' API assertions).

## Task Commits

1. **Task 1: Move money on CategoryPicker and CurrencyInput** - `dfd816e3` (feat)
2. **Task 2 RED: target cycle D-14 case** - `829bbb9a` (test)
3. **Task 2: target editor on shared controls** - `2bf19bf3` (feat)
4. **Task 3 RED: payday percent D-14 case** - `e485f1da` (test)
5. **Task 3: payday plan editor on shared controls** - `e2a478e4` (feat)
6. **Follow-up: Enter in a target's amount saves what was just typed** - `c7ce2a70` (fix)
7. **Initial plan summary** - `17a5930e` (docs)
8. **Review CR-01: refuse a typed negative amount** - `e6dbe795` (fix)
9. **Review CR-02: a half-cleared date holds no day for saving or previewing** - `23f3c10f` (fix)
10. **Review CR-03: leaving an unchanged move amount keeps the preview** - `7a90e627` (fix)
11. **Review CR-04: each payday rule keeps its own typed text** - `afe1627c` (fix)
12. **Review CR-02 follow-up: a re-render keeps a half-typed date's segments** - `478b305b` (fix)
13. **Review WR-01: one category-subset filter on the picker path** - `df9663bb` (refactor)

## Failing-first runs

- **Move amount (observable change):** `envelope-funding.spec.ts:132` changed to `toHaveValue('$50')` against the old code. Result: `unexpected value "50.00"` (1 failed). Passes after Task 1, because unfocused CurrencyInput formats as money.
- **Target amount (observable change):** `targets.spec.ts:19` `toHaveValue('$800')` against the old code. Result: `Received: "800.00"` (1 failed). Passes after Task 2.
- **Target cycle (D-14):** `targets.spec.ts:59` against the old code failed at `expect(range).toBeVisible()`, because the number input clamped '61' to 60 and showed no message. Passes after Task 2.
- **Payday percent (D-14):** `payday.spec.ts:229` against the old code failed at `expect(range).toBeVisible()` for '12.5'. Passes after Task 3.
- **Enter in target amount:** the extended cycle case types '700' and presses Enter. Before `c7ce2a70` the target saved the previous $600. It passes after.

## Selector changes

| spec:line                                   | before                                                             | after                                                                                                                                                     | reason                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envelope-funding.spec.ts:72-73`            | `getByLabel('Move from'/'Move to').selectOption(id)`               | `pickMove(page, 'from'/'to', name)`: open the `^Move from: ` button, click `categoryOption(page, /^name/)`, assert the button's name is `Move from: name` | From/To moved from native `<select>` to `CategorySelectButton` (trigger button plus listbox options named `Name ($X available)`)                  |
| `envelope-funding.spec.ts:131`              | `getByLabel('Move to')).toHaveValue(rent.id)`                      | `moveField(page,'to')).toHaveAccessibleName('Move to: Rent / Mortgage')`                                                                                  | A button has no value; the shown category is in its name (`${label}: ${shown}`)                                                                   |
| `envelope-funding.spec.ts:132`              | `toHaveValue(/^50(\.00)?$/)`                                       | `toHaveValue('$50')`                                                                                                                                      | CurrencyInput shows the formatted amount when not focused (observable change, failing run above)                                                  |
| `envelope-funding.spec.ts:133`              | `getByLabel('Move from').selectOption(food.id)`                    | `pickMove(page, 'from', 'Groceries')`                                                                                                                     | As 72-73                                                                                                                                          |
| `envelope-funding.spec.ts:152, 159`         | `getByLabel('Move from')).toHaveValue(food.id)`                    | `moveField(page,'from')).toHaveAccessibleName('Move from: Groceries')`                                                                                    | As 131                                                                                                                                            |
| `envelope-funding.spec.ts:160`              | `getByLabel('Move to').selectOption({ label: 'Ready to assign' })` | `pickMove(page, 'to', 'Ready to assign')`                                                                                                                 | 'Ready to assign' is now the picker's pinned `extraItem` option                                                                                   |
| `targets.spec.ts:21`                        | `form.getByLabel('Target type').selectOption('refill')`            | `chooseOption(phone ? combobox 'Target type' : button /Target type$/, 'Refill to balance')`                                                               | Shared Select: a listbox trigger on desktop, a native select on a phone (D-04); picks by the option's label                                       |
| `targets.spec.ts:27`                        | `form.getByLabel('Target amount').fill('300')`                     | `typeAmount(form.getByLabel('Target amount'), '300')`                                                                                                     | `fill()` races CurrencyInput's focus swap from '$800' to '800.00' (the desktop run saved $800); `typeAmount` is the fixtures' way to type into it |
| `payday.spec.ts:40, 140`                    | `getByLabel('Anchor payday').fill(isoDay())`                       | `fillDate(page, 'Anchor payday', isoDay())`                                                                                                               | Anchor payday is the shared DatePicker (segments on desktop, native date on a phone)                                                              |
| `payday.spec.ts:41, 141`                    | `getByLabel('Expected take-home pay').fill(...)`                   | `typeAmount(...)`                                                                                                                                         | CurrencyInput (as `targets.spec.ts:27`)                                                                                                           |
| `payday.spec.ts:43-47`                      | `getByLabel('Category 1', { exact: true }).selectOption(food.id)`  | open button `/^Category 1: /`, click `categoryOption(page, 'Groceries', { exact: true })`, assert name `Category 1: Groceries`                            | Rule category moved to `CategorySelectButton`                                                                                                     |
| `payday.spec.ts:48`                         | `getByLabel('Rule amount 1').fill('400')`                          | `typeAmount(...)`                                                                                                                                         | CurrencyInput                                                                                                                                     |
| `payday.spec.ts:51, 91, 156, 162, 197, 211` | `.check()` / `.uncheck()` on the income checkboxes                 | `setToggle(box, true/false)`                                                                                                                              | Shared React Aria Checkbox hides its 1 px input; `setToggle` clicks the wrapping label and asserts the state                                      |
| `first-import.spec.ts:145-156`              | `getByLabel('Anchor payday')).toHaveValue(salary.latestDate)`      | the `Anchor payday` group's year/month/day segments have `aria-valuenow` equal to the detected date's parts                                               | The desktop DatePicker is a group of segments with no input value; `aria-valuenow` is independent of the Date format preference                   |
| `first-import.spec.ts:157`                  | `toHaveValue(/^3,?200(\.00)?$/)`                                   | `toHaveValue('$3,200')`                                                                                                                                   | CurrencyInput formats when not focused                                                                                                            |
| `polish.spec.ts:225`                        | `getByLabel('Anchor payday')).toBeVisible()`                       | `getByRole('group', { name: 'Anchor payday', exact: true })).toBeVisible()`                                                                               | `getByLabel` would also match the DatePicker's segments; the group is the field                                                                   |

No accessible name was renamed (D-15). 'Move from', 'Move to', 'Move amount', 'Target type', 'Target amount', 'Repeats every (months)', 'Anchor payday', 'Expected take-home pay', 'Category N', 'Funding method N', 'Rule amount N', 'Percent', 'Due date', 'Payday', 'Actual or adjusted payday', 'Plan' and 'Show archived plans' all keep their names. The category buttons append the shown choice (`Move from: Groceries`), which is the shared `CategorySelectButton` contract.

## Behaviour changes

- Amounts show formatted ('$50', '$800', '$3,200') when not focused, as every CurrencyInput does. In Safe mode at "All amounts", that formatter hides them, so the move amount shows no more than before.
- The cycle and the percent no longer clamp or coerce: '61', '0' and '1.5' (cycle) and '12.5' and '101' (percent) show 'Enter a whole number from 1 to 60.' or '… from 0 to 100.' and keep Save unavailable. '12' and '25' save as before.
- Unreadable amount text keeps Preview move, Save target and Save payday plan unavailable (the `AmountFields` gate), instead of a click-time error.
- Required dates gate the save button instead of the browser's native required bubble (see key decisions).
- A half-typed date (one segment cleared) also keeps the save unavailable, and in the funding panel keeps Preview funding unavailable and retires a shown preview (review CR-02).
- A typed negative amount is refused as before the move, never saved as its positive (review CR-01). Tabbing through an unchanged move amount keeps the preview (review CR-03).
- 'Ready to assign', the category hints and the moves' available figures use the same `formatCurrency` as the old `<option>` text (T-03-16). `safe-mode.spec.ts` passes.

## Review fixes

All five findings from `.git/gsd-handoff/03-10-REVIEW-sol.md` are fixed, one commit each (CR-02 has a follow-up). Each behaviour fix has a test that fails without it. To check that, I ran the new test against the pre-fix code: either the parent commit, or the fix put aside in a scratchpad copy and restored afterwards.

1. **CR-01 (`e6dbe795`): negative money.** The move amount, target amount, expected take-home pay and rule amount pass `allowNegative`. A typed '-50' now gets 'Enter a positive amount.' (move) or 'Enter a target amount above zero.' (target, by Enter and by click). On payday it reaches the server's nonnegative check, which shows its alert and saves nothing.
   - _Fails without:_ `envelope-funding.spec.ts` 'a negative move amount is refused', `targets.spec.ts` 'a negative target amount is refused', and both cases of `payday.spec.ts` 'a negative … is refused'. All four failed, because the amount was saved as its positive.
2. **CR-02 (`23f3c10f`, `478b305b`): half-cleared dates.**
   - _Finding:_ the shared DatePicker emits '' only when every segment is cleared (03-08's case). It emits nothing when one segment of a whole date is cleared, even with `isRequired` (the target's due date already had it), and no prop reported this.
   - _Fix:_ DatePicker now reports a half-typed draft to an enclosing `AmountFields` on each key-up and on blur, through the same `useReportAmountValidity` that NumberField and CurrencyInput use. Its visible line still waits for blur. The target due date and the payday anchor and due dates were already inside `AmountFields`. The funding panel wraps the actual payday in its own, keeps Preview funding unavailable while the date is half-typed, and retires an existing preview when the date becomes half-typed.
   - _Gallery:_ a new 'Half-typed in a form' specimen with a spec.
   - _Follow-up:_ React Aria compares the value by identity, and the picker made a new `CalendarDate` each render, so any re-render of the caller put the last whole date back over the typed segments. The value is now memoised per string.
   - _Fails without:_ `targets.spec.ts` 'a half-cleared due date…', `payday.spec.ts` 'a half-cleared payday date…' and the gallery half-typed case all failed without the DatePicker change. The payday case's retirement step failed without its effect. Without the memo, the payday case failed 1 in 5 and 1 in 8 runs; with it, 8 of 8 and 5 of 5 passed.
3. **CR-03 (`7a90e627`): tabbing through the move amount.** `onChange` now only stores the amount; `onTextChange` (each keystroke) still retires the preview.
   - _Fails without:_ `envelope-funding.spec.ts` 'tabbing through an unchanged move amount keeps the preview' failed at the step after Tab.
4. **CR-04 (`afe1627c`): rule row keys.** Rule rows are keyed by a `newClientId` key held in `ruleKeys` beside `config.rules`. It is swapped, removed and added with its rule, and never saved.
   - _Fails without:_ `payday.spec.ts` 'removing a rule keeps the next rule its own percent' (two rules at 10%, '101' typed in the first, first removed) failed because '101' carried over. The test also checks the saved rule's keys are only `amount, categoryId, dueDate, method, percent`.
5. **WR-01 (`df9663bb`): one filter.** `CategorySelectButton` takes `categoryIds`, resolved in `categoryButtonPickerProps` and not forwarded to `CategoryPicker`. Move money and the payday rule pass their ids and drop their own filters (and Move money's `useCategories` import).
   - _Fails without:_ three `CategoryPicker.test.ts` cases (a subset in group order, filtering a `groups` prop, an empty subset).

D-15: no accessible name changed. The new tests use the existing names ('Move amount', 'Target amount', 'Due date', 'Anchor payday', 'Actual or adjusted payday', 'Percent', 'Payday', `Category N`).

**Gallery baselines:** the new DatePicker specimen changes the gallery's full-page screenshots. Only Linux compares them, so they were skipped here (50 skipped) and need refreshing with `bash e2e/gallery-baselines.sh --update`. (The orchestrator refreshed them in `1f9e7aa7`.)

### Second review

Both findings in `.git/gsd-handoff/03-10-REVIEW-2.md` are fixed, one commit each, and the info note too. For each, I ran the new test against the code before the fix and saw it fail, then applied the fix and saw it pass.

1. **CR-01 (`d09f62b0`): picking the held day.** The memo from `478b305b` kept one `CalendarDate` per value string. So a calendar pick or Today that landed on the day the caller already held left the half-typed segments in place while the form read as complete; on blur the field then said 'Enter the full date'. The picker now holds its `CalendarDate` in state. It follows the caller's value, and a pick (calendar or Today) replaces it with a fresh one, so React Aria refills the segments even when the value string does not change. Today also clears the draft flag now. No lint suppression.
   - _Fails without:_ gallery `dates.spec.ts` 'picking the held day refills a half-typed date' (clear the day in 'Half-typed in a form', pick the selected cell, then blur) failed at the first refill check: the day segment stayed a placeholder.
2. **WR-01 (`d06dcb83`): optional half-typed dates.** 'Enter the full date, like …' now shows on blur for any half-typed desktop date, not only a required one. An optional half-typed date already held its `AmountFields` form up (Actual or adjusted payday, a recurring End date, a rule's date condition) with no line saying why.
   - _Fails without:_ `payday.spec.ts` 'a half-cleared payday date…' now leaves the half-cleared Actual or adjusted payday and expects the line; it failed with the element not found.
3. **IN-01 (`bf346db0`):** the two payday amount comments now name the server's nonnegative check, not a client check that does not exist.

**Gallery look:** neither fix changes how a gallery specimen looks at rest. The full-page screenshots show every field untouched, and the new line appears only after a field is left half-typed. No baseline refresh should be needed; I did not touch `e2e/tests/gallery/__screenshots__`.

### Third review, fixed by the orchestrator

The owner capped reviews at one round on 20 Nov, so the orchestrator fixed `.git/gsd-handoff/03-10-REVIEW-3.md`'s findings in `09ff2c13` and checked them with tests instead of another review.

1. **CR-01: a stored day that does not round-trip looped forever.** The held `CalendarDate` was matched by its own `toString()`. `0000-01-01` reads as `0001-01-01`, so the match never held, and every render set state again ("Too many re-renders"). A rule's date condition is checked for shape only (`server/src/routes/rules.ts:44`), so the owner's API, an `organise` token's proposed rule or a restored backup could store one and crash the rule editor. The held day is now keyed on the value string it was made for.
   - _Fails without:_ `DatePicker.test.ts` 'renders a stored day that does not round-trip…' throws "Too many re-renders" at `bf346db0`'s DatePicker.
   - Left for its own change: tightening `routes/rules.ts:44` to `isoDate` (a pre-existing server gap).
2. **WR-01: Clear left a stale full-date line.** `halfTyped` was cleared only by a whole date, Today or a blur. Clear unmounts its own button, so no blur follows. The `[value]` effect now re-checks the line as well as the form flag, so Clear, a reset or another payday drops it.
   - _Fails without:_ gallery `dates.spec.ts` 'Clear drops the full-date line of a half-typed optional date' (Today, clear the day, leave, Clear, leave) still found the line.
3. **IN-01:** the `partial` row of `02-UI-SPEC.md` now says the line shows on blur, required or not. IN-02 (a test for Today landing on the held day) was not done.

## Deleted files

None. (`MoneyInput` was a function inside `PaydayPlan.tsx` and is removed, since nothing else called it.)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Enter in the target amount saved the previous amount**

- **Found during:** Task 3 (applying the same pattern to the payday editor's amounts)
- **Issue:** CurrencyInput commits on blur. In TargetCard's `<form>`, pressing Enter submits without a blur, so the old amount was saved. The old text field updated on every keystroke.
- **Fix:** `onTextChange` sets the amount on every readable keystroke. The payday editor's amounts got the same from the start.
- **Files modified:** `client/src/components/budget/TargetCard.tsx`, `e2e/tests/targets.spec.ts` (the cycle case now types '700' + Enter and checks the saved cycle and amount through the API; it failed before the fix with $600)
- **Commit:** `c7ce2a70`

**2. [Rule 3 - Blocking] Two specs outside `files_modified` queried moved controls**

- **Found during:** Task 3 (orchestrator note 2: run every spec that references a changed control)
- **Issue:** `first-import.spec.ts:145-146` and `polish.spec.ts:225` read the Anchor payday and Expected take-home pay fields by their old shape.
- **Fix:** Updated per the selector table. Both specs pass.
- **Commit:** `e2a478e4`

**3. [Rule 2 - Missing critical] Native `required` on the dates**

- **Found during:** Tasks 2 and 3
- **Issue:** The shared DatePicker uses `validationBehavior="aria"`, so it does not block a native submit like the old `<input type="date" required>` did.
- **Fix:** The save buttons wait for those dates (target due date where needed; the payday anchor and each 'due' rule's date).
- **Commits:** `2bf19bf3`, `e2a478e4`

**Total deviations:** 3 auto-fixed. **Impact:** same values saved as before; no payload change.

## Verification

After the second review's fixes (HEAD `bf346db0`):

- Desktop project, every spec using dates or the budget plus `accessibility.spec.ts` (payday, targets, envelope-funding, first-import, polish and most other specs, since the `budget` grep matched them): **433 passed**
- Phone project: **65 passed**
- Gallery `dates.spec.ts` (`E2E_GALLERY_ONLY=1 --project=gallery`): **23 passed**
- `npm test --prefix client`: 101 files / 936 tests passed. Client and e2e `tsc --noEmit` passed. `git diff --check` is clean.
- Lint: 0 errors, 124/128 warnings, none in the changed files.
- Raw-control gate on the three budget files: **0**.

After the first review's fixes (HEAD `df9663bb`):

- Desktop budget, targets, payday, envelope-funding (money move), accessibility, recurring, rules, goals, first-import, polish, safe-mode, category-goals and planning specs: **121 passed**
- Phone project (`--project=phone`): **65 passed**
- Gallery (`E2E_GALLERY_ONLY=1 --project=gallery`): **157 passed, 50 skipped** (Linux-only screenshot comparisons)
- `npm test --prefix client`: 101 files / 935 tests passed. Client build passed. Client and e2e `tsc` passed. `git diff --check` is clean.
- Lint: 86/86 tests; 0 errors and 125/128 warnings, none in the changed files.
- Raw-control gate on the three budget files: **0**.

Before the review fixes:

- Preconditions: `grep -c '^Reconcile: match$' 03-01-SUMMARY.md` gives 1; `grep -c extraItem CategoryPicker.tsx` gives 16.
- `npm --prefix e2e test -- --project=desktop tests/envelope-funding.spec.ts tests/safe-mode.spec.ts`: **15 passed**
- `npm --prefix e2e test -- --project=desktop tests/targets.spec.ts`: **3 passed** (after `c7ce2a70`)
- `npm --prefix e2e test -- --project=desktop tests/payday.spec.ts tests/envelope-funding.spec.ts`: **13 passed**
- `npx playwright test --project=desktop tests/accessibility.spec.ts tests/first-import.spec.ts tests/polish.spec.ts tests/budget.spec.ts tests/category-goals.spec.ts tests/planning.spec.ts`: **70 passed** (orchestrator note 1: accessibility always run)
- Raw-control gate (`perl`, Task 3) on MoneyMoves.tsx, TargetCard.tsx and PaydayPlan.tsx: **0** (HEAD before: 11)
- `npm --prefix lint test`: 86/86 passed. `npm --prefix lint run lint`: 0 errors, 125 warnings (cap 128), none in the changed files.
- `npm test --prefix client`: 101 files / 932 tests passed. `npm run build --prefix client`: built. `tsc --noEmit` passes for client and e2e.
- Phone project: no `e2e/tests/phone/` spec queries a changed control (grep), so it was not run. The phone-viewport variants in `envelope-funding`, `targets` and `payday` (desktop project at 390 px) pass. `demo/payday.spec.ts` only opens the panel and reads text (grep), so it was not run.
- No `crypto.randomUUID`; no unit test uses `hookTestHarness`. STATE.md and ROADMAP.md were not touched.

## Self-Check: PASSED

- All 3 tasks are committed on `worktree-agent-p0310-a1`: `dfd816e3`, `829bbb9a`, `2bf19bf3`, `e485f1da`, `e2a478e4`, `c7ce2a70`.
- The modified files exist and the gate prints 0. Both D-14 cases failed first and pass now. No STATE.md or ROADMAP.md change.
- Review fixes are committed one per finding: `e6dbe795` (CR-01), `23f3c10f` and `478b305b` (CR-02), `7a90e627` (CR-03), `afe1627c` (CR-04), `df9663bb` (WR-01). Each behaviour fix has a test that failed without it (see Review fixes). No `crypto.randomUUID`.
- Second review fixes: `d09f62b0` (CR-01), `d06dcb83` (WR-01), `bf346db0` (IN-01). Each behaviour fix has a test that failed without it (see Second review). `e2e/tests/gallery/__screenshots__` was not touched.
