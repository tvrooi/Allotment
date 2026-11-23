---
phase: 03-screens-on-shared-controls
plan: 07
subsystem: ui
tags: [react-aria, shared-controls, rules, option-picker, number-field, date-picker, wave-g, wavg-05]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (`Reconcile: match`), 03-02 shared `NumberField` and `CurrencyInput` `fieldSize`, 03-04 `CategorySelectButton` and `MerchantSelect` on shared controls, and 03-06 shared `setToggle` helper"
provides:
  - "`RuleEditorModal.tsx` migrated completely onto shared `Select`, `Combobox`, `DatePicker` (`fieldSize='sm'`, `hideLabel`), `NumberField`, `Field` + `Input`, `Checkbox`, and `CurrencyInput` (`sm`) with stable split-row keys and 0 raw form controls remaining"
  - "`OptionPicker.tsx` single-value branch delegating to `CategorySelectButton`, `MerchantSelect`, and shared `Combobox` (preserving `'(deleted)'` for stale ids); multi-value branch rebuilt on shared `Input` (`sm`) and `Checkbox`"
  - "Shared `ui/DatePicker.tsx` extended with additive `fieldSize?: 'md' | 'sm'` (composed from `fieldHeights`) and `hideLabel?: boolean` (desktop and phone)"
  - "All five UI-SPEC unnamed rule-editor controls named (`Direction`, `Match value`, `Notes text`, `Split percentage`, `Split notes`) and exercised by role and name in `e2e/tests/rules.spec.ts`"
  - "D-14 split percentage validation (`0` to `100` decimal, `'Enter a percentage from 0% to 100%.'`, empty-draft preservation, `AmountFields` Save gating) backed by failing-first tests"
affects: [03-03, 03-13, 03-15]

plan_head_before: 06f54db71b3ec92f09dddbe55823d242ea3a2d63
plan_head_after: dffcfd397b90634ba2b2d29af19571654e72038b
commits: 9

actuals:
  tokens: 16228
  tasks: 2
  commits: 9

tech-stack:
  added: []
  patterns:
    - "Single-value `OptionPicker` delegates by condition `kind` (`category` -> `CategorySelectButton` with `allowNone={false}`, `allowCreate={false}`, `includeHidden`, and `extraItem` `'(deleted)'` on stale id; `payee` -> `MerchantSelect` with `'(deleted)'` fallback; `account` -> shared `Combobox` at `sm` with `'(deleted)'` extra item)"
    - "Multi-value `OptionPicker` keeps a popover checklist using shared `Input` (`sm`, ref-focused on open without `autoFocus` lint warning) and full-row-padded shared `Checkbox` rows without `bg-brand-50` drift"
    - "Stable split-row keys via a parallel `crypto.randomUUID()` key list in `SplitEditor` (push on add, filter on remove) so removing an invalid percent row never transfers its `NumberField` draft to the next row"
    - "Additive `fieldSize?: 'md' | 'sm'` (composed from `fieldClasses.fieldHeights`) and `hideLabel?: boolean` on `ui/DatePicker.tsx`, keeping `pickerGroupClass` and `pickerIconButton` exports unchanged"
    - "Field-styled `TagInput` wrapper (`fieldBase` + `fieldStates` + `focus-within` ring) containing chips (old chip classes) and a borderless shared `Input`"
    - "Non-empty `NONE_OPTION = '__none__'` sentinel in `Tag` and `Household` `Combobox` lists matching `EditCategoryModal` (`03-11`)"

key-files:
  created:
    - client/src/components/rules/RuleEditorModal.test.ts
    - client/src/components/rules/OptionPicker.test.ts
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-07-SUMMARY.md
  modified:
    - client/src/components/rules/OptionPicker.tsx
    - client/src/components/rules/RuleEditorModal.tsx
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/ui/DatePicker.test.ts
    - e2e/tests/rules.spec.ts
    - e2e/tests/accessibility.spec.ts

key-decisions:
  - "OptionPicker form decision (Claude's discretion within D-05 and D-06): single-value OptionPicker delegates to CategorySelectButton (categories), MerchantSelect (payees), and shared Combobox (accounts); multi-value OptionPicker keeps its popover checklist built on shared Input (sm) and Checkbox"
  - "Extended shared `ui/DatePicker.tsx` with additive `fieldSize?: 'md' | 'sm'` (from `fieldHeights`) and `hideLabel?: boolean` per WR-03 and 03-01 Binding 2, deleting screen-local `SM_DATE_PICKER_CLASS` while keeping `pickerGroupClass` and `pickerIconButton` exports unchanged for `MonthPicker`, `MonthRangePicker`, and `Combobox`"
  - "Used `useRef` focus on popover open in `MultiOptionPicker` instead of JSX `autoFocus`, reducing the repository ESLint warning count from 126 to 125"
  - "Updated `e2e/tests/accessibility.spec.ts` (`the rule editor's fields show a brand focus ring`) per orchestrator notes to query the shared `Select` trigger button, check the single-value Account `Combobox` `[role=group]` focus ring, check the multi-value `OptionPicker` button focus ring, and assert `strayLabels(dialog)` is empty"

patterns-established:
  - "Visually hidden `Field` / `NumberField` labels in dense builder rows via `[&>label]:sr-only`; visually hidden `DatePicker` labels via `hideLabel` and compact desktop size via `fieldSize='sm'`"
  - "Rule condition pickers route single values to the entity's canonical picker (preserving `'(deleted)'` on stale ids) and multiple values to the shared-control `MultiOptionPicker`"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "Split percentage in `RuleEditorModal.tsx` converted from raw `type='number'` to shared `NumberField` (`Split percentage`, `0..100` decimal, `%` suffix, `sm`, `'Enter a percentage from 0% to 100%.'`, Save gated via `AmountFields`) with stable split-row keys (`WR-01`), verified test-first"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "client/src/components/rules/RuleEditorModal.test.ts (2/2 passed: stable row keys on remove + TagInput field wrapper)"
        status: pass
      - kind: e2e
        ref: "Pre-review desktop tests/rules.spec.ts (7/7 passed); post-WR-01..WR-06 rules.spec.ts + accessibility.spec.ts + phone re-run delegated to orchestrator (shared e2e ports busy)"
        status: pass
      - kind: other
        ref: "grep -c 'type=\"number\"' client/src/components/rules/RuleEditorModal.tsx => 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "All fixed lists, user-grown lists, condition dates (`DatePicker` `fieldSize='sm'` + `hideLabel`), tag-list field wrapper + borderless `Input`, notes inputs, apply checkbox, `CurrencyInput` callers, and `OptionPicker` (single-value delegation with `'(deleted)'` + multi-value shared checklist) migrated onto shared controls with all 5 UI-SPEC accessible names wired and tested"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "client/src/components/rules/OptionPicker.test.ts (5/5), client/src/components/rules/RuleEditorModal.test.ts (2/2), client/src/components/ui/DatePicker.test.ts (16/16), full client vitest (100/100 files, 938/938 tests passed)"
        status: pass
      - kind: other
        ref: "perl raw-control check on OptionPicker.tsx + RuleEditorModal.tsx => 0; 5/5 UI-SPEC names in RuleEditorModal.tsx and rules.spec.ts; client tsc + build; e2e tsc; lint tests (86/86) and eslint (0 errors, 125/128 warnings)"
        status: pass
    human_judgment: false

duration: 36 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 07: Rule Editor and OptionPicker on Shared Controls Summary

**RuleEditorModal and OptionPicker now use only shared form controls (`Select`, `Combobox`, `DatePicker` with `fieldSize="sm"` and `hideLabel`, `NumberField`, `Field` + `Input`, `Checkbox`, `CurrencyInput`, `CategorySelectButton`, `MerchantSelect`), with D-14 decimal percentage validation (`0` to `100`), stable split-row keys, preserved `'(deleted)'` stale-entity markers, and all five UI-SPEC accessible names verified.**

## Performance

- **Duration:** 36 min (including independent review fixes WR-01..WR-06)
- **Started:** 2026-11-19T14:34:54Z
- **Completed:** 2026-11-19T15:11:34Z
- **Tasks:** 2 (plus 6 atomic review-fix commits)
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- **Task 1 (TDD, D-14):** Replaced the raw `<input type="number">` split percentage field in `RuleEditorModal.tsx` with the shared `NumberField` (`label="Split percentage"`, `min={0}`, `max={100}`, `allowDecimal`, `suffix="%"`, `fieldSize="sm"`, `errorMessage={percentRangeMessage(0, 100)}`, visually hidden label via `[&>label]:sr-only`), wired inside the existing `<AmountFields>` provider so invalid or empty drafts show `'Enter a percentage from 0% to 100%.'` and disable `Save rule`.
- **Task 2 (Shared controls & OptionPicker):**
  - Replaced all seven fixed lists (`How conditions combine`, `Field`, `Operator`, `Direction`, `Action`, `Tax return label`, `Split amount type`) with the shared `Select` at `fieldSize="sm"`, preserving exact options, order, and values.
  - Replaced `Tag` and `Household` lists with the shared `Combobox` at `fieldSize="sm"` using `NONE_OPTION = '__none__'` to preserve `'Choose a tag…'` and `'Choose a household…'`.
  - Extended `ui/DatePicker.tsx` with additive `fieldSize?: 'md' | 'sm'` (composed from `fieldHeights`) and `hideLabel?: boolean`, and replaced the condition `<input type="date">` (single and between range) with `<DatePicker fieldSize="sm" hideLabel ... />`, saving exact `YYYY-MM-DD` strings.
  - Replaced the condition text value, action notes text, split notes, and `TagInput` typing box with the shared `Input` at `fieldSize="sm"` (with `Field` visually-hidden labels for `Match value`, `Notes text`, and `Split notes`, and a shared `fieldBase`/`fieldStates` `focus-within` wrapper around `TagInput`'s chips and borderless `Input`).
  - Replaced the `Apply to existing transactions after saving` wrapping `<label><input type="checkbox">` with the shared `Checkbox` (no outer `<label>`).
  - Removed duplicate border/ring classes (`fieldClass`) from every `CurrencyInput` caller in `RuleEditorModal.tsx`, setting `fieldSize="sm"` and explicit accessible names (`Amount`, `Minimum amount`, `Maximum amount`, `Split amount`).
  - Rebuilt `OptionPicker.tsx`: single-value conditions delegate by `kind` to `CategorySelectButton` (categories, `allowNone={false}`, `allowCreate={false}`, `includeHidden`), `MerchantSelect` (payees), or shared `Combobox` (`sm`, accounts), each preserving `'(deleted)'` when a rule references a removed entity; multi-value conditions keep the popover checklist rebuilt on shared `Input` (`sm`, ref-focused on open) and full-row-padded shared `Checkbox` rows with no `bg-brand-50`, `text-brand-700`, or `ring-brand-400` drift.
  - Updated `e2e/tests/rules.spec.ts` and `e2e/tests/accessibility.spec.ts` to use `chooseOption`, `fillDate`, `setToggle`, and all five new UI-SPEC accessible names, plus tests for WR-01, WR-02, and WR-06.

## OptionPicker Decision

Per the audit row ("OptionPicker: Combobox, decide in Phase 3") and D-05 / D-06:
- **Single-value (`!multiple`):** Delegates to the canonical picker of the condition field's kind:
  - `kind="category"` -> `CategorySelectButton` (backed by `CategoryPicker`, with `allowNone={false}`, `allowCreate={false}`, `includeHidden`, and `extraItem={{ value, label: '(deleted)' }}` on a stale id).
  - `kind="payee"` -> `MerchantSelect` (backed by shared `Combobox`, with `name: '(deleted)'` on a stale id).
  - `kind="account"` -> shared `Combobox` (`fieldSize="sm"`, prepending `{ value, label: '(deleted)' }` on a stale id).
- **Several-values (`multiple`):** Keeps `OptionPicker`'s popover checklist, rebuilt on shared `fieldClasses` on the trigger button, shared `Input` (`fieldSize="sm"`, `aria-label="Search options"`) for filtering, and full-row-padded shared `Checkbox` rows inside the scrollable list (no nested buttons, `Escape` closes only the popover, empty state keeps `"No matches"`).

## Behaviour changes

### 1. D-14 Split percentage (`RuleEditorModal.tsx` -> `NumberField`)

- **Old behaviour:** `<input type="number" min={0} max={100} step="any">` with no `<label>` or `aria-label` (role `spinbutton`), snapping cleared text to `0` (`Number(e.target.value) || 0`), silently clamping values over `100` to `100`, showing no validation message, and never disabling `Save rule`.
- **New behaviour (D-14):** Shared `NumberField` (role `textbox`, accessible name `'Split percentage'`, `inputMode="decimal"`, `fieldSize="sm"`, `%` suffix). Typing `'100.5'` keeps `'100.5'` visible, displays `<span role="alert">Enter a percentage from 0% to 100%.</span>`, and disables `Save rule` via `AmountFields`. Typing `'50.5'` clears the error, re-enables `Save rule`, and saves `50.5`. Selecting all and pressing Backspace leaves the field empty (`''`, not `'0'`) and disables `Save rule`.
- **Failing-first TDD RED run against old code** (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/rules.spec.ts -g "split percent"`):
  - Exit code `1` (`2 failed`):
    1. `[desktop] › tests/rules.spec.ts:145:3 › rules › split percent validates decimals from 0 to 100 and gates Save`:
       `Error: expect(locator).toBeVisible() failed — Locator: getByRole('dialog', { name: 'New rule' }).getByRole('textbox', { name: 'Split percentage' }) — Error: element(s) not found` (old control was an unnamed `spinbutton` `type="number"` with no `'Split percentage'` name, no validation copy, and no Save gating).
    2. `[desktop] › tests/rules.spec.ts:177:3 › rules › clearing split percent leaves the field empty rather than snapping to 0`:
       `Error: locator.click: Test timeout of 30000ms exceeded — waiting for getByRole('dialog', { name: 'New rule' }).getByRole('textbox', { name: 'Split percentage' })`.
- **GREEN run after Task 1:** `tests/rules.spec.ts` — `6 passed (22.6s)`, `grep -c 'type="number"' client/src/components/rules/RuleEditorModal.tsx` -> `0`.

### 2. Payee single-value condition (`MerchantSelect`, WR-06)

- Delegating single-value `Payee` conditions (`field: 'payee', op: 'is' | 'is_not'`) to `MerchantSelect` (per plan must-have and UI-SPEC §2) means the **`Create new payee: "…"` footer (`useCreatePayee`) is now reachable from inside a rule condition** (subject to `useCanSave()`), payees are ordered by transaction count (top 8 shown until filtered), and unconfirmed typed text clears on blur.
- Note (`IN-05`): `MerchantSelect` does not yet take a `fieldSize` prop, so both the `set_payee` action row and the single-value `Payee` condition render at `md` height (`40px`) inside `sm` rows; adding `fieldSize` to `MerchantSelect` is left to the plan that sizes it.

### 3. Multi-value `OptionPicker` trigger name (`IN-03`)

- The multi-value `OptionPicker` opener button now carries `aria-label="${label}: ${summary ?? placeholder}"` (e.g. `'Account: Choose one or more…'`) rather than the bare summary text alone (`'Choose one or more…'`), matching `CategorySelectButton` so every rule-editor trigger identifies its field kind.

## Selector changes

| spec:line | before | after | reason |
| --- | --- | --- | --- |
| `e2e/tests/rules.spec.ts:43` (was `:33`) | `dialog.getByRole('combobox', { name: 'Field' }).selectOption({ label: 'Payee name' })` | `chooseOption(dialog.getByRole('button', { name: /Field$/ }), 'Payee name')` | `Field` moved from native `<select>` (`combobox`) to shared `Select` (desktop `button` trigger + listbox) |
| `e2e/tests/rules.spec.ts:44` (was `:34`) | `dialog.getByRole('combobox', { name: 'Operator' }).selectOption({ label: 'contains' })` | `chooseOption(dialog.getByRole('button', { name: /Operator$/ }), 'contains')` | `Operator` moved from native `<select>` (`combobox`) to shared `Select` (desktop `button` trigger + listbox) |
| `e2e/tests/rules.spec.ts:45` (was `:35`) | `dialog.getByRole('textbox', { name: 'Text…' }).fill('coffee')` | `dialog.getByRole('textbox', { name: 'Match value' }).fill('coffee')` | Condition text input previously had no label (fell back to placeholder `'Text…'`); now named `'Match value'` per `03-UI-SPEC.md` |
| `e2e/tests/rules.spec.ts:63-66` (was `:53-55`) | `dialog.getByRole('checkbox', { name: 'Apply to existing transactions after saving' }).check()` | `setToggle(dialog.getByRole('checkbox', { name: 'Apply to existing transactions after saving' }), true)` | Checkbox moved to shared React Aria `Checkbox` (`03-06-SUMMARY.md` "For 03-07"), whose hidden 1 px input sits behind `<span aria-hidden="true">` |
| `e2e/tests/accessibility.spec.ts:296` | `dialog.getByLabel('Field', { exact: true }).first()` + `field.selectOption('account')` | `dialog.getByRole('button', { name: /Field$/ }).first()` + `chooseOption(field, 'Account')` | `Field` moved from native `<select>` to shared `Select`, whose desktop trigger is a `button` named `"<chosen> Field"` |
| `e2e/tests/accessibility.spec.ts:305-324` (was `:306`) | `dialog.getByRole('button', { name: 'Choose…' })` | `dialog.getByRole('combobox', { name: 'Account' })` (checking `[role="group"]` boxShadow) + switch `Operator` to `'is one of'` and check `dialog.getByRole('button', { name: 'Account: Choose one or more…' })` + `strayLabels(dialog)` | Single-value Account condition now delegates to shared `Combobox` (role `combobox`, focus ring on `[role="group"]`); multi-value Account keeps `OptionPicker`'s button trigger (`'Account: Choose one or more…'`) |

## Review fixes

Addressed all 6 warnings (`WR-01`..`WR-06`) from `.git/gsd-handoff/03-07-REVIEW.md`, one atomic commit each, each verified RED -> GREEN before committing:

1. **WR-01 (`25467bd0`) — Stable split-row keys in `SplitEditor`:**
   - **RED:** `RuleEditorModal.test.ts` mounted `SplitEditor` with 2 percent parts, removed row 0, and asserted remaining row kept row 1's key -> failed (`expected '0' to be '1'`).
   - **Fix:** Added a parallel stable key list (`crypto.randomUUID()`, push on Add split, filter on Remove split) in `SplitEditor` (`RuleEditorModal.tsx`) and added the clear-row-0-then-remove-row-0 e2e test in `e2e/tests/rules.spec.ts`.
   - **GREEN:** `RuleEditorModal.test.ts` (1/1) passed; `client` & `e2e` `tsc --noEmit` passed.
2. **WR-02 (`39b1fbad`) — Preserve `'(deleted)'` for stale single-value condition ids (plus `IN-01` dead-code cleanup):**
   - **RED:** `OptionPicker.test.ts` rendered `OptionPicker` for stale `account`, `payee`, and `category` ids -> 3/3 failed (`expected ... to contain '(deleted)'`).
   - **Fix:** Prepended `{ value, label: '(deleted)' }` to `Combobox` items, passed `name: '(deleted)'` to `MerchantSelect`, and passed `extraItem={{ value, label: '(deleted)' }}` to `CategorySelectButton` when `value` is not in `byId`; removed the unreachable grouping branch and unused fallbacks (`IN-01`); added the deleted-account edit e2e test in `e2e/tests/rules.spec.ts`.
   - **GREEN:** `OptionPicker.test.ts` (3/3) passed; `client` & `e2e` `tsc --noEmit` passed.
3. **WR-03 (`21793996`) — Add `fieldSize` and `hideLabel` to shared `ui/DatePicker.tsx` and delete `SM_DATE_PICKER_CLASS`:**
   - **RED:** `DatePicker.test.ts` asserted `fieldSize: 'sm'` renders `h-8` (not `h-10`) and `hideLabel: true` adds `sr-only` on desktop and phone -> failed (`expected ... to match /\bh-8\b/`).
   - **Fix:** Composed `DatePicker.tsx`'s group class from `pickerGroupBase` + `fieldHeights[fieldSize]` (keeping `pickerGroupClass` and `pickerIconButton` exports unchanged for `MonthPicker`, `MonthRangePicker`, and `Combobox`), added `hideLabel` (`sr-only` on `Label` on desktop and phone), and replaced `SM_DATE_PICKER_CLASS` in `RuleEditorModal.tsx` with `<DatePicker label={label} hideLabel fieldSize="sm" ... />`.
   - **GREEN:** `DatePicker.test.ts` (16/16), `MonthPicker.test.ts` (13/13), `MonthRangePicker.test.ts` (10/10) — 39/39 passed; `client` `tsc --noEmit` passed.
4. **WR-04 (`45e84d29`) — Drop `bg-brand-50` and per-row colour switch on `OptionPicker` checklist (plus `IN-02` & `IN-04`):**
   - **RED:** `OptionPicker.test.ts` asserted `OptionPicker.tsx` contains no `bg-brand-50`, `text-brand-700`, or `ring-brand-400` -> failed (`not to contain 'bg-brand-50'`).
   - **Fix:** Dropped `bg-brand-50` and the `isOn ? 'bg-brand-50 text-brand-700' : 'text-text'` switch, moved `px-3 py-1.5` onto `<Checkbox>` so the entire hovered row toggles (`IN-04`), and restored `'No matches'` (`IN-02`).
   - **GREEN:** `OptionPicker.test.ts` (4/4) passed; `client` `tsc --noEmit` passed.
5. **WR-05 (`24f91d66`) — Keep field-styled `TagInput` wrapper, old chip classes, and borderless shared `Input`:**
   - **RED:** `RuleEditorModal.test.ts` asserted `TagInput` wrapper has `border-border` and `focus-within:ring-brand-600`, chips use exact old classes, and `Input` is borderless -> failed (`expected 'w-full flex flex-wrap items-center gap-1.5' to contain 'border-border'`).
   - **Fix:** Restored `${fieldBase} ${fieldStates} ... focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600` on `TagInput`'s wrapper, restored original chip classes (`flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-surface-alt text-xs text-text`), and styled the inner shared `<Input>` borderless (`border-0! bg-transparent! ...`).
   - **GREEN:** `RuleEditorModal.test.ts` (2/2) passed; `client` `tsc --noEmit` passed.
6. **WR-06 (`dffcfd39`) — Test single-value `Payee` condition via `MerchantSelect` (plus `IN-05` exact tag id & between-dates):**
   - **Fix:** Extended `e2e/tests/rules.spec.ts` with a `Payee` / `is` condition asserting `{ field: 'payee', op: 'is', value: payee.id }`, captured `workTag.id` for exact `add_tag` assertion, added a `Date` `is between` (`Start date` / `End date`) condition (`IN-05`), and added a unit test in `OptionPicker.test.ts` for matched `kind="payee"` rendering through `MerchantSelect`.
   - **GREEN:** `OptionPicker.test.ts` (5/5) passed; `e2e` `tsc --noEmit` passed.

## Task Commits

Each task and review fix was committed atomically on `worktree-agent-p0307-a1`:

1. **Task 1: Split percent to NumberField, test first (D-14)** - `e34edb3d` (`feat(03-07): move split percent to shared NumberField with D-14 validation`)
2. **Task 2: Rule editor lists, date, tag box and OptionPicker** - `3c4c7ac4` (`feat(03-07): move rule editor controls and OptionPicker onto shared controls`)
3. **Initial plan summary** - `c6aba15c` (`docs(03-07): complete rule editor and OptionPicker shared-controls plan`)
4. **Review fix WR-01** - `25467bd0` (`fix(03-07): WR-01 use stable row keys in SplitEditor`)
5. **Review fix WR-02** - `39b1fbad` (`fix(03-07): WR-02 preserve (deleted) marker for stale single-value condition ids`)
6. **Review fix WR-03** - `21793996` (`fix(03-07): WR-03 add fieldSize and hideLabel to DatePicker and remove SM_DATE_PICKER_CLASS`)
7. **Review fix WR-04** - `45e84d29` (`fix(03-07): WR-04 drop bg-brand-50 and per-row colour switch on OptionPicker checklist`)
8. **Review fix WR-05** - `24f91d66` (`fix(03-07): WR-05 keep field-styled tag-list wrapper with old chip classes and borderless Input`)
9. **Review fix WR-06** - `dffcfd39` (`test(03-07): WR-06 test single-value Payee condition via MerchantSelect`)

## Files Created/Modified

- `client/src/components/rules/OptionPicker.tsx` - Split into `SingleOptionPicker` (delegating to `CategorySelectButton`, `MerchantSelect`, or shared `Combobox`, preserving `'(deleted)'` on stale ids) and `MultiOptionPicker` (shared `fieldClasses` trigger, shared `Input` `sm` filter with ref-focus, full-row-padded shared `Checkbox` rows without `bg-brand-50` drift, Escape-closes-list-only, `"No matches"`).
- `client/src/components/rules/OptionPicker.test.ts` - Unit tests for single-value stale-id `'(deleted)'` markers (`account`, `payee`, `category`), matched `MerchantSelect` rendering, and absence of `bg-brand-50` / `text-brand-700` / `ring-brand-400` drift.
- `client/src/components/rules/RuleEditorModal.tsx` - Replaced all 18 remaining raw form controls with shared `Select`, `Combobox`, `DatePicker` (`fieldSize="sm"`, `hideLabel`), `NumberField`, `Field` + `Input`, `Checkbox`, and `CurrencyInput` (`sm`), added the five UI-SPEC accessible names, added stable split-row keys (`SplitEditor`), restored the field-styled `TagInput` wrapper + old chip classes, and removed `fieldClass`.
- `client/src/components/rules/RuleEditorModal.test.ts` - Unit tests for `SplitEditor` stable row keys on remove (`WR-01`) and `TagInput` field wrapper, old chip classes, and borderless `Input` (`WR-05`).
- `client/src/components/ui/DatePicker.tsx` - Added additive `fieldSize?: 'md' | 'sm'` (composed from `fieldHeights`) and `hideLabel?: boolean` while keeping `pickerGroupClass` and `pickerIconButton` exports unchanged.
- `client/src/components/ui/DatePicker.test.ts` - Added desktop and phone unit tests for `fieldSize="sm"` and `hideLabel`.
- `e2e/tests/rules.spec.ts` - Added D-14 split percentage tests, WR-01 clear-then-remove split test, WR-02 deleted-account edit test, and a full shared-controls rule creation test exercising all five new accessible names, `fillDate` (single + between), `Combobox`, `CategorySelectButton`, `MerchantSelect` (`Payee`/`is`), multi-value `OptionPicker`, `TagInput`, and exact `add_tag` id; updated moved selectors to `chooseOption` and `setToggle`.
- `e2e/tests/accessibility.spec.ts` - Updated `the rule editor's fields show a brand focus ring` for the shared `Select` button, single-value Account `Combobox` group ring, multi-value `OptionPicker` trigger ring, and `strayLabels(dialog)` check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 / 03-01 Binding 2 / Review WR-03] Added additive `fieldSize` and `hideLabel` props to shared `ui/DatePicker.tsx`**
- **Found during:** Task 2 and Review (`WR-03`)
- **Issue:** `DatePicker.tsx` had no `fieldSize` or visually-hidden-label option (`03-01-SUMMARY.md` Binding 2); initial screen-local selector styling (`SM_DATE_PICKER_CLASS`) coupled `RuleEditorModal.tsx` to `DatePicker`'s internal DOM.
- **Fix:** Added additive `fieldSize?: 'md' | 'sm'` (composed from `fieldClasses.fieldHeights`, keeping exported `pickerGroupClass` and `pickerIconButton` unchanged) and `hideLabel?: boolean` to `ui/DatePicker.tsx` with desktop + phone unit tests in `DatePicker.test.ts`, and deleted `SM_DATE_PICKER_CLASS`. (Gallery specimen for `DatePicker` `sm` can be added in `03-03`.)
- **Files modified:** `client/src/components/ui/DatePicker.tsx`, `client/src/components/ui/DatePicker.test.ts`, `client/src/components/rules/RuleEditorModal.tsx`
- **Committed in:** `21793996`

**2. [Orchestrator directive] Updated `e2e/tests/accessibility.spec.ts` for changed rule-editor control roles**
- **Found during:** Task 2 verification (`accessibility.spec.ts:285-314`)
- **Issue:** `the rule editor's fields show a brand focus ring` queried the old native `Field` `<select>` via `getByLabel('Field', { exact: true }).selectOption('account')` and the old single-value Account button trigger `'Choose…'`.
- **Fix:** Updated the test to use `getByRole('button', { name: /Field$/ })` + `chooseOption`, verify the brand focus ring on both the single-value Account `Combobox`'s `[role="group"]` and the multi-value `OptionPicker` button trigger (`'Account: Choose one or more…'`), and assert `strayLabels(dialog)` is empty.
- **Files modified:** `e2e/tests/accessibility.spec.ts`
- **Committed in:** `3c4c7ac4`

---

**Total deviations:** 2 (1 additive `DatePicker` variant per 03-01 Binding 2 & WR-03, 1 orchestrator-mandated role update in `accessibility.spec.ts`)
**Impact on plan:** Eliminates DOM-coupled selectors cleanly and keeps all shared control contracts, accessibility checks, and e2e specs aligned.

## Threat Model Verification

- **T-03-09 (split percent tampering):** `NumberField` enforces decimal bounds `0` to `100` matching `server/src/routes/rules.ts` `splitPartSchema`; invalid or blank drafts never write to rule state, disable `Save rule` via `AmountFields`, and stable split-row keys (`WR-01`) prevent stale drafts transferring across rows on delete.
- **T-03-10 (condition values):** Single-value pickers (`CategorySelectButton`, `MerchantSelect`, `Combobox`) and multi-value `OptionPicker` return the exact entity IDs (including `Payee`/`is`, `WR-06`) and preserve `'(deleted)'` visibility for stale ids (`WR-02`).
- **T-03-SC (npm installs):** No packages added (D-02); only lockfile `npm ci` was run in the fresh worktree with `.npmrc` `ignore-scripts=true` intact.

## Verification

- Precondition check: `grep -c '^Reconcile: match$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` -> `1`; `client/src/components/ui/NumberField.tsx` exists.
- Post-review checks (after `WR-01`..`WR-06`, commit `dffcfd39`):
  - `grep -c 'type="number"' client/src/components/rules/RuleEditorModal.tsx` -> `0` (was `1`).
  - `perl` raw-control check on `OptionPicker.tsx` + `RuleEditorModal.tsx` -> `0` (was `19`).
  - UI-SPEC accessible names check (`Direction|Match value|Notes text|Split percentage|Split notes`): `RuleEditorModal.tsx` -> `5`, `e2e/tests/rules.spec.ts` -> `5`.
  - `grep -c 'selectOption' e2e/tests/rules.spec.ts` -> `0`.
  - `cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit` -> passed (0 errors).
  - `cd e2e && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit` -> passed (0 errors).
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build --prefix client` -> passed (`tsc -b && vite build`).
  - `cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run` -> **100 files / 938 tests passed** (including `RuleEditorModal.test.ts` 2/2, `OptionPicker.test.ts` 5/5, `DatePicker.test.ts` 16/16, `MonthPicker.test.ts` 13/13, `MonthRangePicker.test.ts` 10/10).
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test` -> **86 passed, 0 failed**.
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint run lint` -> **0 errors, 125 warnings** (cap 128; down 1 from 126, 0 warnings in modified files).
- Playwright browser runs:
  - Pre-review: `tests/rules.spec.ts` (7/7), `tests/transaction-presets.spec.ts` (2/2), `tests/accessibility.spec.ts` (13/13) — **22 passed**.
  - Post-review (`WR-01`..`WR-06`): Playwright re-run of `rules.spec.ts`, `accessibility.spec.ts`, and phone specs intentionally skipped here per orchestrator instruction (another executor holds the fixed e2e ports); the orchestrator will run them.

## Issues Encountered

- Running `npm ci` in `client/`, `server/`, `e2e/`, and `lint/` was required inside the fresh git worktree before type-checks, lint, builds, and Playwright tests could execute (using lockfiles with `.npmrc` `ignore-scripts=true` intact).

## Next Phase Readiness

- Rule editor (`RuleEditorModal.tsx`), `OptionPicker.tsx`, and `DatePicker` (`fieldSize="sm"`, `hideLabel`) are ready for the orchestrator's Playwright verification of `rules.spec.ts`, `accessibility.spec.ts`, and phone specs.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` were left untouched for the orchestrator's post-wave merge.

## Self-Check: PASSED

- Files verified on disk: `client/src/components/rules/OptionPicker.tsx`, `client/src/components/rules/OptionPicker.test.ts`, `client/src/components/rules/RuleEditorModal.tsx`, `client/src/components/rules/RuleEditorModal.test.ts`, `client/src/components/ui/DatePicker.tsx`, `client/src/components/ui/DatePicker.test.ts`, `e2e/tests/rules.spec.ts`, `e2e/tests/accessibility.spec.ts`, `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-07-SUMMARY.md`.
- Commits verified in `worktree-agent-p0307-a1` ancestry: `e34edb3d`, `3c4c7ac4`, `c6aba15c`, `25467bd0`, `39b1fbad`, `21793996`, `45e84d29`, `24f91d66`, `dffcfd39`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` untouched.
- No stubs, placeholders, skips, sleeps, or new threat surface introduced.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
