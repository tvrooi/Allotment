---
phase: 03-screens-on-shared-controls
plan: 17
subsystem: ui
tags: [wave-g, g3, goals, investments, shared-controls, wavg-06]
requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-16 G3 reconcile record (G3 reconcile: match) and gate baseline 15'
provides:
  - 'GoalFormModal and GoalStatusModal on the shared controls'
  - 'IncomeModals, InvestmentModals, SaleModals and SplitModals on the shared controls'
  - 'An e2e spec for pausing a category goal and moving money through the shared pickers, and a demo spec for the goal form picker'
affects: [03-23]
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: c691056f41fbd0a3d6d6f87a5aff96b033eac8fd
commits: 2
actuals:
  tokens: 11700
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - 'A Combobox with a "none" row uses a sentinel option value (__none__), as EditCategoryModal does'
    - 'A default (menuTrigger "input") Combobox is driven in specs by typing into it, then clicking the option on the page (its popover is portalled)'
    - 'A pinned non-category choice in CategorySelectButton is extraItem with a sentinel value (__keep__), as MoneyMoves does'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-17-SUMMARY.md
  modified:
    - client/src/components/goals/GoalFormModal.tsx
    - client/src/components/goals/GoalStatusModal.tsx
    - client/src/components/investments/IncomeModals.tsx
    - client/src/components/investments/InvestmentModals.tsx
    - client/src/components/investments/SaleModals.tsx
    - client/src/components/investments/SplitModals.tsx
    - e2e/tests/category-goals.spec.ts
    - e2e/tests/demo/category-goals.spec.ts
    - e2e/tests/settings.spec.ts
    - e2e/tests/investments.spec.ts
key-decisions:
  - 'Goal pickers keep the old option sets: Progress source offers every expense category, hidden ones included (includeHidden); Move to category offers the same budget categories as before (categoryIds), and neither offers Create new category (allowCreate false)'
  - 'GoalStatusModal amount is CurrencyInput with allowNegative and onTextChange, so the status line still follows each keystroke and a typed negative still meets the positive-amount check'
  - 'Required investment dates are DatePicker isRequired with maxValue today; Add purchase now also checks for an empty date, since the date field no longer blocks the form natively'
  - 'The investments local Field helper stays (for bare Input and CurrencyInput), rebuilt on the shared Label and helpClass instead of its one-off label class'
requirements-completed: []
duration: 95min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 17: Goals and Investments on the shared controls

**The two goal dialogs and four investment dialogs now use only the shared controls. Progress source and Move to category are the category picker, account, security and replacement lists are the Combobox, the five investment dates are DatePicker, the kinds are Select, parcel choice is RadioGroup and the two boxes are Checkbox. They save the same values, and the leftover gate over the six files prints 0 (it was 15).**

## Tasks

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Goal form and goal status | `43530ada` | GoalFormModal.tsx, GoalStatusModal.tsx, category-goals.spec.ts, demo/category-goals.spec.ts, settings.spec.ts |
| 2 | Investment dialogs | `c691056f` | IncomeModals.tsx, InvestmentModals.tsx, SaleModals.tsx, SplitModals.tsx, investments.spec.ts |

Precondition: `grep -c '^G3 reconcile: match$' 03-16-SUMMARY.md` printed 1.

## What moved

- **GoalFormModal**: Name is the shared `Input` in a `Field`. Progress source is `CategorySelectButton` (label "Progress source") over the expense groups, with `allowNone` and `noneLabel="Manual tracking"`, `includeHidden` and `allowCreate={false}`; it saves the same `categoryId` (`''` becomes `null`). Linked account is the shared `Combobox` with a "None" row, offering the open accounts as before. Target and Saved so far stay `CurrencyInput`, now with the shared `Label`. The target date stays the shared `DatePicker`.
- **GoalStatusModal**: Reason is the shared `Input` in a `Field`. Replaced by is the shared `Combobox` with "No replacement". Move to category is `CategorySelectButton` (label "Move to category") with `extraItem` "Keep it in {category}" (wording as before) and `hint` "({formatCurrency(balance)} available)", the same formatter as the old options. The amount is `CurrencyInput` (owner's answer, 02-03 Q3). Saving stays on `useCanSave`.
- **Investments**: Paid on, price Date, Bought on, Sold on and Effective on are `DatePicker` with `maxValue` today and `isRequired`. Income kind and security Type are the shared `Select` (`INCOME_KINDS`, `SECURITY_KINDS`). A new holding's Account and Security are the shared `Combobox`. Parcels sold is `RadioGroup`. Reinvested and "I don't know what these units cost" are `Checkbox`. Symbol, name, units, ratio terms and notes stay the shared `Input` with their parsers (`parseUnits`, `wholeNumber`) and mark bad text through `isInvalid`. The wrapping labels, the fieldset with raw radios, and the one-off `labelClass` are gone. Saves stay on `Actions` (`useCanSave`, `SavingPausedHint`).

## Behaviour changes

1. **Goal status amount (CurrencyInput).** Text that isn't an amount (for example `12.5.0`) is now marked (`aria-invalid`, plus the shared "That isn't an amount" line) when the field is left. A readable amount is shown formatted (`$300.00`). Before, both showed nothing until Confirm gave the "Enter an amount up to …" error. Confirm still gives that error for an empty, zero, negative, too large or unreadable amount. The test was written before the component change: `category-goals.spec.ts` "pausing a category goal moves money through the shared pickers". See the note under Deviations on its RED run.
2. **Accessible names that now follow the visible label**: Linked account is "Linked account (optional)" (was "Linked account"), and the replacement list is "Replaced by (optional)" (was "Replacement goal"). Reason's Field gives "Reason (optional)". Substring selectors still match.
3. **Picker buttons** are named "Progress source: {shown}" and "Move to category: {shown}" (CategorySelectButton's `<label>: <shown>`). Their lists are grouped under group headings, not flat.
4. **Required investment dates** show the shared required mark. On phones they are native date inputs (DatePicker, D-04). Add purchase is now disabled while Bought on is empty. Before, the browser's `required` check blocked the submit.
5. **Holding Security list** is filterable by typing (Combobox). The "Add a security that isn't listed" link sits under the field as before.
6. Labels for "Total cost" (purchases) and "Price per unit" now point at their fields (each `CurrencyInput` got the `id` its label named). Before, those labels pointed at nothing.

## Selector changes

| Spec | Was | Now | Reason |
| --- | --- | --- | --- |
| `category-goals.spec.ts` (Progress source, 2 places) | `getByLabel('Progress source').selectOption(id / '')` | click button "Progress source: Manual tracking" / "Progress source: Groceries", then `categoryOption(page, name, { exact: true })` | Progress source is the category picker (a button that opens a listbox) |
| `settings.spec.ts` (Linked account) | `getByRole('combobox', …).selectOption({ label: 'Savings' })` | `fill('Sav')`, then `page.getByRole('option', { name: 'Savings', exact: true })`, then `toHaveValue('Savings')` | The shared Combobox opens its filtered list on typing (`menuTrigger` "input"). `chooseOption` clicks the field, which does not open it. The popover is portalled, so the option is found on the page |
| `investments.spec.ts` (5 dates) | `getByLabel('Date' / 'Bought on' / 'Sold on' / 'Paid on' / 'Effective on').fill(iso)` | `fillDate(dialog, name, iso)` | DatePicker segments on desktop |
| `investments.spec.ts` (parcels) | `getByLabel('Choose parcels').check()` | `setToggle(getByRole('radio', { name: 'Choose parcels' }))` | Shared RadioGroup (React Aria's 1 px input; the label takes the click) |
| `investments.spec.ts` (Security) | `getByLabel('Security')).toContainText(…)` | `getByRole('combobox', { name: 'Security' })).toHaveValue(/^MOCK · Mock index fund/)` | A Combobox shows the choice as its input's value, not as text |
| `investments.spec.ts` Tax-year `selectOption` (2) | unchanged | unchanged | Tax is Phase 4 |
| `demo/category-goals.spec.ts` | (no Progress source selector existed) | new test: the demo's goal form picks its progress source through the picker | The plan named lines 19 and 58 here, but they are in the desktop spec. The demo spec had none, so this adds demo coverage instead |
| `accessibility.spec.ts:251`, `dialog-focus.spec.ts:36,40`, `resilience.spec.ts:76` | unchanged | unchanged (outside this plan's files) | They still pass: `getByLabel('Progress source')` reaches the picker button, which keeps the field's focus ring and no outline. The comment at accessibility.spec.ts:250 ("The shared Select") is now stale (P2, for 03-23) |

## Verification

All runs use Node 24 (`/opt/homebrew/opt/node@24/bin`).

| Check | Result |
| --- | --- |
| Leftover perl gate over the six files | **0** (HEAD 15) |
| `cd client && npx tsc --noEmit` | exit 0 |
| `cd e2e && npx tsc --noEmit -p .` | exit 0 |
| `npm --prefix client test` | 103 files, **947 passed** |
| `npm --prefix lint test` | 86 pass, 0 fail |
| `npm --prefix lint run lint` | 0 errors, 122 warnings (cap 122, no "too many warnings") |
| Prettier on the 10 changed files | all unchanged |
| e2e run 1: `--project=desktop --project=demo` over category-goals, settings, investments, safe-mode, demo/category-goals, accessibility, dialog-focus, resilience | 69 passed, 2 failed (the Combobox picks, see Deviations) |
| e2e run 2: desktop category-goals + settings (after the Combobox fix) | 29 passed, 1 failed (my new test's unreadable text, see Deviations) |
| e2e run 3: desktop category-goals (final) | **11 passed** |

Investments, safe-mode, the demo goal spec, accessibility, dialog-focus and resilience passed in run 1. No code or spec they exercise changed after it. Settings passed in run 2, and category-goals passed in run 3 on the final code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Specs drove the default Combobox with `chooseOption`**
- **Found during:** Task 1 verification (e2e run 1)
- **Issue:** `chooseOption` clicks the field. A default Combobox (`menuTrigger` "input") does not open on a click, so the option never appeared (30 s timeout in the settings goal test and the new goal status test).
- **Fix:** Type part of the name, click the option on the page, assert the field's value.
- **Files:** e2e/tests/settings.spec.ts, e2e/tests/category-goals.spec.ts
- **Commit:** 43530ada

**2. [Rule 1 - Bug] The new test's unreadable amount was readable**
- **Found during:** Task 1 (e2e run 2)
- **Issue:** `12abc` reads as 12: `amountChars` drops letters. The test used `12.5.0` instead, the unreadable text the accounts and card-payments specs use.
- **Commit:** 43530ada

**3. [Rule 2 - Missing check] Add purchase with an empty date**
- **Issue:** DatePicker does not block the form natively the way `required` on a date input did, so Add purchase now checks `!date` itself (the price, payment, sale and split forms already held their save on an empty date).
- **Commit:** c691056f

**4. RED run of the goal status test not done on the old build.** The plan asks for the amount's observable change to be tested first. I wrote the test before changing the component. But the first browser run was blocked: sibling executors held the fixed e2e ports (3169/3171). `E2E_SKIP_BUILD` reuses a build cache in the shared `os.tmpdir()`, which could hold a sibling's code, so a cheap old-build run was not available either. The test fails without the change by construction. The old dialog has no "Move to category: …" button, no "Replaced by (optional)" combobox, and its amount field never sets `aria-invalid`.

**Total deviations:** 3 auto-fixed (2 spec bugs, 1 missing check), plus one verification step done differently. **Impact:** none on saved values.

## Findings left for later (out of scope)

- `GoalFormModal`'s Save does not use `useCanSave` / `SavingPausedHint`, against the CLAUDE.md client rule. This predates this plan, and the plan says to keep saves as they are, so it was not added here. It is a candidate for the G3 PR's follow-ups (03-23).
- `accessibility.spec.ts:250`'s comment calls Progress source "The shared Select". The test still passes; only its comment is stale (P2).
- `GoalFormModal` (Name) and `InvestmentModals` (Code) keep `autoFocus`, which carries a `jsx-a11y/no-autofocus` warning as before. The lint total stays at the cap.

## Known Stubs

None.

## Threat surface

No new endpoint, route or stored field. T-03-26: the available hints use `formatCurrency`, the same formatter the old options used, and safe-mode.spec.ts passed.

## Self-Check: PASSED

- FOUND: all 10 modified files; this SUMMARY
- FOUND: 43530ada, c691056f (ancestors of HEAD)
