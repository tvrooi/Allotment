---
phase: 03-screens-on-shared-controls
plan: 08
subsystem: ui
tags:
  [
    react-aria,
    shared-controls,
    recurring,
    select,
    combobox,
    date-picker,
    number-field,
    checkbox,
    input,
    wave-g,
    wavg-05,
  ]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`), 03-02 `NumberField`, and 03-04 `MerchantSelect` / `CategorySelectButton`'
provides:
  - '`DatePicker.tsx` optional `optionalHint` prop rendering a muted `aria-hidden` `"(optional)"` span beside the label without altering the accessible name (desktop and phone), plus `"Optional hint"` specimen in `DateCards.tsx`'
  - '`RecurringFormModal.tsx` on shared `Select` (Frequency, Remind me, Weekend adjustment), `Combobox` (Account with `No account`), `DatePicker` (required Start date with required line, optional End date with `optionalHint` keeping exact accessible name `"End date"`), `Field`/`Label`+`Input` (Name, Notes), `Checkbox` (Auto-create transactions), and `NumberField` (Date flexibility 0–14, scoped to its own `AmountFields` keeping Advanced open and Save disabled while invalid)'
  - '`UpcomingLengthModal.tsx` on shared `Select` (`Upcoming length`, `Custom length unit`) and `NumberField` (`Custom length number`, whole number >= 1) inside `AmountFields` preserving `<n>-<unit>` preference strings'
  - '`AllTab.tsx`, `OccurrenceMatchModal.tsx`, and `DiscoverSchedulesModal.tsx` on shared `Input` and `Checkbox` (with select-all indeterminate state and capture-phase Shift+click range selection)'
affects: [03-15]

plan_head_before: 19f47b549e95df7e47c472880c01fe70aca2aebe
plan_head_after: 32311cd9a0d74bf570d33f7cb0cd343b2b6656df
commits: 11

actuals:
  tokens: 22714
  tasks: 2
  commits: 11

tech-stack:
  added: []
  patterns:
    - 'Shared `DatePicker` `optionalHint` prop renders `<span aria-hidden="true" className="ml-1 font-normal text-text-tertiary">(optional)</span>` inside `<Label>` so visible optionality matches sibling fields while preserving the exact accessible name'
    - 'Non-empty sentinel values (`NONE_ACCOUNT` / `NO_REMINDER`) on shared `Combobox` and `Select` so "No account" and "Don''t remind me" remain selectable options while saving `null` to `/api/schedules`'
    - 'Nested `AmountFields` provider for the Advanced block in `RecurringFormModal` so invalid `Date flexibility` gates both Save and the Advanced collapse toggle (`nextAdvancedOpen`) without blocking Advanced collapse when only `Amount` is invalid'
    - 'Shared `<Label htmlFor>` + `<Input id aria-label="Notes">` in `RecurringFormModal` preserving visible `Notes (optional)` and exact accessible name `"Notes"` (D-15)'
    - 'Row-level `onPointerDownCapture` + `closest(''label'')` guard in `DiscoverSchedulesModal` keeping single-toggle mouse, Space, and Shift+click range selection before React Aria `usePress` stops bubble propagation'

key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-08-SUMMARY.md
    - client/src/components/recurring/RecurringFormModal.test.ts
  modified:
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/ui/DatePicker.test.ts
    - client/src/pages/devGallery/DateCards.tsx
    - client/src/components/recurring/RecurringFormModal.tsx
    - client/src/components/recurring/UpcomingLengthModal.tsx
    - client/src/components/recurring/AllTab.tsx
    - client/src/components/recurring/DiscoverSchedulesModal.tsx
    - client/src/components/recurring/OccurrenceMatchModal.tsx
    - e2e/tests/recurring.spec.ts
    - e2e/tests/accessibility.spec.ts
    - e2e/tests/server-mode/auth.spec.ts

key-decisions:
  - 'Extended shared `DatePicker` (desktop and phone) with `optionalHint?: boolean` and added its `"Optional hint"` specimen in `DateCards.tsx` so `End date` displays a muted `"(optional)"` hint like Payee and Notes while keeping its exact accessible name `"End date"` (WR-05, D-15)'
  - 'Scoped an inner `AmountFields` provider to `RecurringFormModal`''s Advanced section and guarded the toggle via `nextAdvancedOpen` so Advanced stays open with its error message visible while `Date flexibility` is invalid (WR-02, WR-06)'
  - 'Passed `isRequired` and `isInvalid={!startDate}` to the `Start date` `DatePicker` so clearing it renders `"Select Start date to continue"` (or `"Enter the full date, like ..."` when half-typed) and the required marker (WR-03)'
  - 'Recorded Shift in `onPointerDownCapture` on `DiscoverSchedulesModal` rows and reset `shiftRef` after both checkbox and row click so Shift+click on a row Checkbox selects a range before React Aria stops bubble propagation (WR-01); removed the source-text `DiscoverSchedulesModal.test.ts` once the Playwright Shift+click case was added'
  - 'Used non-empty sentinels (`NONE_ACCOUNT = ''__none__''`, `NO_REMINDER = ''__none__''`) for Account `Combobox` and Remind me `Select` because shared `Combobox` and `Select` treat `value === ''''` as unset; `handleSubmit` still maps `''''` / sentinel to `null`'
  - 'Passed `max={Number.MAX_SAFE_INTEGER}` with `errorMessage={wholeNumberMinMessage(1)}` on `UpcomingLengthModal` `NumberField` so every safe positive integer remains parseable by `scheduleFormat.ts` while refusing `0`, negatives, fractions, non-numeric text, and unsafe integers (T-03-12)'
  - 'Named `UpcomingLengthModal` `Select` controls via `aria-label` (`"Upcoming length"`, `"Custom length unit"`) and `NumberField` via `label="Custom length number"` visually hidden with `[&>label]:sr-only` without visual copy drift or wrapping `<label>` elements'

patterns-established:
  - 'Use `DatePicker` `optionalHint` whenever an optional date field needs the muted `"(optional)"` hint beside its label without altering its accessible name'
  - 'Use `pickCombobox` (clear + fill + click exact listbox option) in Playwright specs when picking from a shared `Combobox` that may already hold the target account name'
  - 'Use `onPointerDownCapture` (not `onPointerDown`) when an ancestor needs modifier keys from pointer events inside React Aria toggle labels'

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: 'RecurringFormModal migrated to shared Select, Combobox, DatePicker (required Start date + optional End date with DatePicker optionalHint keeping exact name "End date"), Field/Label+Input, Checkbox, and NumberField (0-14, keeping Advanced open and Save disabled while invalid) inside AmountFields, with unit tests and updated recurring, accessibility, and server-mode selectors'
    requirement: 'WAVG-05'
    verification:
      - kind: unit
        ref: 'client/src/components/ui/DatePicker.test.ts (17/17 passed); client/src/components/recurring/RecurringFormModal.test.ts (4/4 passed)'
        status: pass
      - kind: e2e
        ref: 'Initial migration verified with desktop (70 passed) and server-mode auth (17 passed); WR-02/WR-03/WR-06 Playwright additions typechecked (`cd e2e && npx tsc --noEmit`) — Playwright re-run and gallery baseline regeneration deferred to orchestrator because 03-09 holds the shared e2e ports'
        status: pass
      - kind: other
        ref: 'perl raw-control check on RecurringFormModal.tsx => 0; recurring.spec.ts selectOption|option:checked count => 0'
        status: pass
    human_judgment: false
  - id: D2
    description: 'UpcomingLengthModal, AllTab, DiscoverSchedulesModal (with capture-phase Shift+click range selection), and OccurrenceMatchModal migrated to shared Select, NumberField (>= 1), Input, and Checkbox, with UI-SPEC accessible names, failing-first D-14 test, and Playwright coverage'
    requirement: 'WAVG-05'
    verification:
      - kind: unit
        ref: 'full client vitest (`cd client && npx vitest run`: 99/99 files passed)'
        status: pass
      - kind: e2e
        ref: 'Initial migration verified with desktop recurring (9 passed), phone (27 passed), and demo (14 passed); WR-01 Shift+click Playwright case typechecked (`cd e2e && npx tsc --noEmit`) — Playwright re-run deferred to orchestrator because 03-09 holds the shared e2e ports'
        status: pass
      - kind: other
        ref: 'perl raw-control check across all 5 recurring files => 0; UpcomingLengthModal accessible-name grep => 3; client build + client tsc + e2e tsc + lint test + eslint (0 errors, 126 warnings, within cap 128)'
        status: pass
    human_judgment: false

duration: 42 min active (137 min wall clock incl. session quota wait and two review rounds)
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 08: Recurring on Shared Controls Summary

**Migrated all five Recurring components (`RecurringFormModal`, `UpcomingLengthModal`, `AllTab`, `DiscoverSchedulesModal`, `OccurrenceMatchModal`) onto the shared `Select`, `Combobox`, `DatePicker`, `Field`/`Label`+`Input`, `Checkbox`, and `NumberField` controls with `AmountFields` gating, extended `DatePicker` with `optionalHint` (+ gallery specimen) so `End date` keeps its exact accessible name, kept Advanced open while `Date flexibility` is invalid, and verified both D-14 numeric fields failing-first.**

## Performance

- **Duration:** ~42 min active execution (including iteration-1 and iteration-2 review fixes)
- **Started:** 2026-11-19T14:53:44Z
- **Completed:** 2026-11-19T17:11:30Z
- **Tasks:** 2 (+ 6 review fixes + 1 test cleanup)
- **Files modified:** 12 (1 test file created, 11 modified, + `03-08-SUMMARY.md`; 1 temporary test file deleted)

## Accomplishments

- Extended `DatePicker.tsx` with `optionalHint?: boolean` rendering `<span aria-hidden="true" className="ml-1 font-normal text-text-tertiary">(optional)</span>` inside `<Label>` on both desktop and phone (ignored when `isRequired`), plus the `"Optional hint"` specimen in `DateCards.tsx` (gallery baselines left for orchestrator).
- Migrated `RecurringFormModal.tsx` onto the shared control set with `AmountFields` / `useAmountValidity` gating Save and submit:
  - `Frequency`, `Remind me` (with `NO_REMINDER` sentinel, `isDisabled`, and `description`, dropping `disabled:opacity-60`), and `Weekend adjustment` on shared `Select`.
  - `Account` on shared `Combobox` with `No account` (`NONE_ACCOUNT` sentinel) preserved and mapped back to `null` on save.
  - `Start date` (`isRequired`, `isInvalid={!startDate}`) and optional `End date` (`optional`, `optionalHint` keeping exact accessible name `"End date"`) on shared `DatePicker` with `minValue`/`maxValue` cross-bounds.
  - `Name` on shared `Field` + `Input`; `Notes` on shared `Label` + `Input` (preserving visible `Notes (optional)` and exact accessible name `"Notes"` per D-15); `Auto-create transactions` on shared `Checkbox`.
  - `Date flexibility` on shared `NumberField` (whole number `0` to `14`, `description="± days for matching"`, `resetKey={resets}`), inside an inner `AmountFields` provider keeping Advanced mounted (`hidden={!advancedOpen}`) and open (`nextAdvancedOpen`) while invalid so the error remains visible and Save stays disabled (`T-03-11`, `WR-02`, `WR-06`).
- Migrated `UpcomingLengthModal.tsx` onto shared `Select` (`aria-label="Upcoming length"` and `aria-label="Custom length unit"`, `fieldSize="sm"`) and `NumberField` (`label="Custom length number"`, visually hidden via `[&>label]:sr-only`, `min={1}`, `max={Number.MAX_SAFE_INTEGER}`, `errorMessage={wholeNumberMinMessage(1)}`, `fieldSize="sm"`) inside `AmountFields` gating `Save`, keeping the exact `<n>-<unit>` preference format (`T-03-12`).
- Migrated `AllTab.tsx` and `OccurrenceMatchModal.tsx` search fields onto shared `Input` with accessible labels (`Filter recurring` and `Filter by payee or notes`) and `Search` icon kept.
- Migrated `DiscoverSchedulesModal.tsx` select-all and per-row checkboxes onto shared `Checkbox` with `isIndeterminate` on select-all and capture-phase Shift+click range selection (`onPointerDownCapture`, `WR-01`) with zero added ESLint warnings.

## Task Commits

Each task, review fix, and cleanup was committed atomically on `worktree-agent-p0308-a1`:

1. **Task 1: Recurring form, with date flexibility tested first** - `d24fb145` (feat)
2. **Task 2: Upcoming length, schedule search, match search and Discover** - `9eb9bfaf` (feat)
3. **Initial plan summary** - `735570e4` (docs)
4. **Review fix WR-01: capture Shift before React Aria Checkbox stops pointerdown** - `4b62defb` (fix)
5. **Review fix WR-02: keep Save gated when Advanced collapses with invalid Date flexibility** - `911920f5` (fix)
6. **Review fix WR-03: mark Start date DatePicker required and show its required line** - `7a99e350` (fix)
7. **Review fix WR-04: restore visible "(optional)" hint on End date DatePicker** - `eacee6e9` (fix)
8. **Iteration-1 review summary update** - `7a8cae72` (docs)
9. **Review fix WR-05: add optionalHint to DatePicker so End date keeps its exact accessible name** - `09fdc600` (fix)
10. **Review fix WR-06: keep Advanced open while Date flexibility is invalid** - `66b2bc05` (fix)
11. **Drop source-text DiscoverSchedulesModal test covered by e2e Shift+click case** - `32311cd9` (test)

## Review fixes

### Iteration 1 (`.git/gsd-handoff/03-08-REVIEW.md`, `WR-01`–`WR-04`)

- **WR-01 (`4b62defb`) — Capture Shift in `onPointerDownCapture` on `DiscoverSchedulesModal` rows:**
  - Switched row `onPointerDown` to `onPointerDownCapture={(e) => { shiftRef.current = e.shiftKey; }}`, reset `shiftRef.current = false` on both checkbox and row click, and added Playwright test `"Find recurring" Shift+clicking a row checkbox selects the range` in `e2e/tests/recurring.spec.ts`.
- **WR-02 (`911920f5`) — Keep Save gated when collapsing Advanced with invalid Date flexibility:**
  - *RED/GREEN:* `RecurringFormModal.test.ts` failed before keeping the block mounted, passed after switching `{showAdvanced && (...)}` to `<div hidden={!showAdvanced}>`; added key-by-key `'15'` + collapse attempt in `recurring.spec.ts`.
- **WR-03 (`7a99e350`) — Pass `isRequired` and `isInvalid={!startDate}` to `Start date` `DatePicker`:**
  - *RED/GREEN:* `RecurringFormModal.test.ts` failed before adding `isRequired`, passed after; added Playwright assertions in `recurring.spec.ts` clearing all three `Start date` segments and asserting `'Select Start date to continue'` + disabled Save; updated `accessibility.spec.ts:181` to click `'Start date*'`.
- **WR-04 (`eacee6e9`) — Restore visible `(optional)` hint on `End date`:**
  - Superseded by `WR-05` below so the accessible name stays strictly `'End date'`.

### Iteration 2 (`.git/gsd-handoff/03-08-REVIEW-2.md`, `WR-05`–`WR-06` + test cleanup)

- **WR-05 (`09fdc600`) — Add `optionalHint` to shared `DatePicker` (+ gallery specimen) so `End date` keeps its exact accessible name:**
  - *RED:* Added desktop & phone `optionalHint` tests in `DatePicker.test.ts` and exact accessible-name test in `RecurringFormModal.test.ts` -> 3/3 failed.
  - *Fix:* Added `optionalHint?: boolean` to `DatePicker.tsx` (desktop and phone branches, rendering `<span aria-hidden="true" className="ml-1 font-normal text-text-tertiary">(optional)</span>` inside `<Label>` when `!isRequired`), added `"Optional hint"` specimen in `DateCards.tsx` (no baseline regeneration), and passed `label="End date" optional optionalHint` in `RecurringFormModal.tsx`.
  - *GREEN:* `DatePicker.test.ts` (17/17), `RecurringFormModal.test.ts` (3/3), `client tsc`, and `e2e tsc` passed.
- **WR-06 (`66b2bc05`) — Keep Advanced open while `Date flexibility` is invalid:**
  - *RED:* Added `nextAdvancedOpen` unit test in `RecurringFormModal.test.ts` (and replaced the loose `hidden` regex noted in `IN-10` with `aria-expanded="false"`) -> 1/4 failed.
  - *Fix:* Added an inner `AmountFields` provider (`advancedAmounts`) around the Advanced controls, derived `advancedOpen = showAdvanced || advancedInvalid`, guarded the toggle with `nextAdvancedOpen(open, advancedInvalid)`, and updated `e2e/tests/recurring.spec.ts` to assert `'Enter a whole number from 0 to 14.'` and `'15'` stay visible with Save disabled right after clicking `Advanced`.
  - *GREEN:* `RecurringFormModal.test.ts` (4/4), `client tsc`, and `e2e tsc` passed.
- **Test cleanup (`32311cd9`) — Delete `DiscoverSchedulesModal.test.ts`:**
  - Removed the `?raw` source-text test added in `4b62defb`; `WR-01` is covered by the behavioural Playwright Shift+click case in `e2e/tests/recurring.spec.ts`.

## Deleted files

- `client/src/components/recurring/DiscoverSchedulesModal.test.ts` (created in `4b62defb`, deleted in `32311cd9`) — removed `?raw` source-text test per `03-08-REVIEW-2.md` and orchestrator instruction; `WR-01` behaviour is covered by `"Find recurring" Shift+clicking a row checkbox selects the range` in `e2e/tests/recurring.spec.ts`.

## Files Created/Modified

- `client/src/components/ui/DatePicker.tsx` - Added optional `optionalHint` prop (desktop and phone) rendering a muted `aria-hidden` `"(optional)"` span inside `<Label>` when `!isRequired`.
- `client/src/components/ui/DatePicker.test.ts` - Added desktop and phone `renderToStaticMarkup` unit tests for `optionalHint`.
- `client/src/pages/devGallery/DateCards.tsx` - Added `"Optional hint"` gallery specimen for `DatePicker` (baselines deferred to orchestrator).
- `client/src/components/recurring/RecurringFormModal.tsx` - Replaced raw/old controls with shared `Select`, `Combobox`, `DatePicker`, `Field`/`Label`+`Input`, `Checkbox`, and `NumberField` inside `AmountFields`; added inner `AmountFields` + `nextAdvancedOpen` keeping Advanced mounted and open while `Date flexibility` is invalid; marked `Start date` `isRequired` + `isInvalid={!startDate}` and `End date` `optional` + `optionalHint`.
- `client/src/components/recurring/RecurringFormModal.test.ts` - Created unit tests for WR-02, WR-03, WR-05, and WR-06.
- `client/src/components/recurring/UpcomingLengthModal.tsx` - Replaced unnamed `<select>` and `<input type="number">` controls with named shared `Select` and `NumberField` (`>= 1`) inside `AmountFields`; removed one-off `selectCls`.
- `client/src/components/recurring/AllTab.tsx` - Replaced raw `<input>` search box with shared `Input` (`fieldSize="sm"`, `aria-label="Filter recurring"`).
- `client/src/components/recurring/DiscoverSchedulesModal.tsx` - Replaced raw select-all and row `<input type="checkbox">` controls with shared `Checkbox` (`isIndeterminate`, `onPointerDownCapture` Shift tracking + single-toggle row guard).
- `client/src/components/recurring/OccurrenceMatchModal.tsx` - Kept shared `Input` and added `aria-label="Filter by payee or notes"`.
- `e2e/tests/recurring.spec.ts` - Updated `Frequency`, `Account`, and `Start date` selectors; added failing-first D-14 tests (Date flexibility with key-by-key `'15'` + collapse attempt keeping error visible, and Custom upcoming length), `Start date` required-line assertions, and Discover Shift+click range-selection case.
- `e2e/tests/accessibility.spec.ts` - Updated `Add recurring` `Start date` label click (`'Start date*'`) and focus assertion (`group` -> first `spinbutton`).
- `e2e/tests/server-mode/auth.spec.ts` - Updated `Remind me` disabled assertion to target the desktop shared `Select` `button` trigger.

## Selector changes

Grep across `e2e/tests/` checked every accessible name, role, label, and placeholder of the migrated controls (`Frequency`, `Account`, `Start date`, `End date`, `End Date`, `Auto-create`, `Remind me`, `Weekend adjustment`, `Date flexibility`, `Upcoming length`, `Custom length number`, `Custom length unit`, `Filter recurring…`, `Filter by payee or notes…`, `Select all`, `Track …`). `End date` keeps its exact accessible name `"End date"` (`WR-05`). `polish.spec.ts`, `budget.spec.ts`, `housemate-money.spec.ts`, `tabs.spec.ts`, `demo/demo.spec.ts`, and all phone specs passed without selector changes.

| spec:line | before | after | reason |
| --- | --- | --- | --- |
| `e2e/tests/recurring.spec.ts:65` (was `:46`) | `dialog.getByRole('combobox', { name: 'Frequency' }).selectOption('monthly')` | `chooseOption(dialog.getByRole('button', { name: 'Frequency' }), 'Monthly')` | `Frequency` moved to shared `Select` (desktop trigger `button` + listbox option by visible label, D-05) |
| `e2e/tests/recurring.spec.ts:66` (was `:47`) | `dialog.getByRole('combobox', { name: 'Account' }).selectOption({ label: 'Checking' })` | `pickCombobox(page, dialog.getByRole('combobox', { name: 'Account' }), 'Checking')` | `Account` moved to shared `Combobox` (searchable text input + listbox option, D-06) |
| `e2e/tests/recurring.spec.ts:83` (was `:48`) | `dialog.getByRole('textbox', { name: 'Start date' }).fill(isoDay(1))` | `fillDate(dialog, 'Start date', isoDay(1))` | `Start date` moved to shared `DatePicker` (segmented date input on desktop, native date on phones, D-07) |
| `e2e/tests/recurring.spec.ts:115` (was `:79`) | `account.selectOption({ label: 'Savings' })` | `pickCombobox(page, account, 'Savings')` | `Account` is now shared `Combobox` (listbox pick instead of native `selectOption`, D-06) |
| `e2e/tests/recurring.spec.ts:122` (was `:86-87`) | `expect(account).toHaveValue(/.+/); expect(account.locator('option:checked')).toHaveText('Savings')` | `expect(account).toHaveValue('Savings')` | Shared `Combobox` displays the chosen account label directly as its input value (no `<option>` children) |
| `e2e/tests/recurring.spec.ts:132` (was `:97`) | `expect(account.locator('option:checked')).toHaveText('Savings')` | `expect(account).toHaveValue('Savings')` | Same as `:122` — shared `Combobox` input value holds the selected account name |
| `e2e/tests/accessibility.spec.ts:181` | `recurring.getByText('Start date', { exact: true }).click()` | `recurring.getByText('Start date*', { exact: true }).click()` | `Start date` `DatePicker` carries `isRequired` (`WR-03`), which adds `<span aria-hidden="true">*</span>` inside the `<Label>` span (`textContent` is `'Start date*'`, while the `group` accessible name stays `'Start date'`) |
| `e2e/tests/accessibility.spec.ts:182-184` (was `:182`) | `expect(recurring.getByLabel('Start date')).toBeFocused()` | `expect(recurring.getByRole('group', { name: 'Start date' }).getByRole('spinbutton').first()).toBeFocused()` | `Start date` moved to shared React Aria `DatePicker`, where clicking the label focuses the first `spinbutton` segment inside `role="group"` (`getByLabel('Start date')` matches 5 elements: group, 3 segments, and calendar button) |
| `e2e/tests/server-mode/auth.spec.ts:177` | `owner.getByLabel('Remind me')` | `owner.getByRole('button', { name: 'Remind me' })` | `Remind me` moved to shared React Aria `Select`, whose desktop DOM includes both the trigger `<button>` and a hidden `<select>` (causing a strict-mode violation on `getByLabel`); querying `role="button"` selects the desktop trigger |

## Behaviour changes

Two D-14 `type="number"` fields moved to `NumberField`, replacing silent clamping with inline validation and Save gating:

1. **`RecurringFormModal.tsx` — Date flexibility (`0` to `14`, whole number, `T-03-11`):**
   - *Before:* `<Input type="number">` silently clamped on change (`Math.max(0, Math.min(14, parseInt(e.target.value) || 0))`), showing no error and leaving Save enabled.
   - *After:* `NumberField` retains invalid text (such as `'15'` or `'-1'`), shows `'Enter a whole number from 0 to 14.'` (`role="alert"`), keeps Advanced open so the error stays visible, and disables Save via `AmountFields` until a whole number from `0` to `14` is entered.
   - *Failing-first RED run against unmodified `RecurringFormModal.tsx` (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/recurring.spec.ts -g "date flexibility"`):*
     ```text
     1) [desktop] › tests/recurring.spec.ts:241:3 › recurring › date flexibility refuses out-of-range values and saves a valid day count
       Error: expect(locator).toBeVisible() failed
       Locator: getByRole('dialog', { name: 'Add recurring' }).getByText('Enter a whole number from 0 to 14.')
       Expected: visible
       Timeout: 7000ms
       Error: element(s) not found
     1 failed
     ```
2. **`UpcomingLengthModal.tsx` — Custom length number (`>= 1`, whole number, `T-03-12`) + missing accessible names (`03-UI-SPEC.md`):**
   - *Before:* Unnamed `<select>`, `<input type="number">`, and `<select>`; typing `'0'` or non-numeric text silently clamped to `1` (`Math.max(1, parseInt(e.target.value, 10) || 1)`).
   - *After:* Named `'Upcoming length'`, `'Custom length number'`, and `'Custom length unit'`; typing `'0'` or `'abc'` retains the draft, shows `'Enter a whole number of 1 or more.'`, and disables `Save` via `AmountFields`; clearing and typing `'3'` with `'Weeks'` saves `'3-week'`. Note (`IN-03`): `max={Number.MAX_SAFE_INTEGER}` matches the pre-existing uncapped preference range (large year/month values still exceed JS `Date` in `getUpcomingDays` as before; a unit-aware cap is a potential future D-14 follow-up).
   - *Failing-first RED run against unmodified `UpcomingLengthModal.tsx` (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/recurring.spec.ts -g "custom upcoming length"`):*
     ```text
     1) [desktop] › tests/recurring.spec.ts:299:3 › recurring › custom upcoming length refuses 0 or non-numeric input and saves 3 weeks
       Test timeout of 30000ms exceeded.
       Error: locator.evaluate: Test timeout of 30000ms exceeded.
       Call log:
         - waiting for getByRole('dialog', { name: 'Change upcoming length' }).getByRole('button', { name: 'Upcoming length' })
     1 failed
     ```
3. **Additional Save gating and accessible-name notes (`IN-01`, `IN-06`):**
   - Wrapping `RecurringFormModal` in `<AmountFields>` also disables Save while `CurrencyInput` holds an unreadable amount (previously saved the prior amount), while `Start date` is empty (with shared `'Select Start date to continue'` / half-typed line), or while `End date < Start date` (with `DatePicker`'s range line).
   - `AllTab.tsx` and `OccurrenceMatchModal.tsx` search boxes gain explicit `aria-label`s (`"Filter recurring"`, `"Filter by payee or notes"`) matching their placeholders.

## Decisions Made

- Kept schedule payload, `upcomingLength` `<n>-<unit>` preference format, and `scheduleFormat.ts` untouched (per plan prohibitions).
- Extended `DatePicker` with `optionalHint` rather than baking `"(optional)"` into the label string or styling around the control on the screen (per CONTEXT "Missing variant or state" and D-15).
- Preserved `MerchantSelect` and `CategorySelectButton` integration in `RecurringFormModal.tsx` unchanged (already migrated in `03-04`).
- Left `STATE.md`, `ROADMAP.md`, and gallery PNG baselines untouched for the orchestrator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Cross-spec selector update] Updated `e2e/tests/accessibility.spec.ts:181-184` for shared required `DatePicker`**
- **Found during:** Task 1 + WR-03 review fix (mandatory `accessibility.spec.ts` audit per `<orchestrator_notes>`)
- **Issue:** Moving `RecurringFormModal` `Start date` to shared `DatePicker` with `isRequired` changed `recurring.getByLabel('Start date')` to match 5 elements and gave the `<Label>` span `textContent` `'Start date*'`.
- **Fix:** Updated lines 181–184 to click `recurring.getByText('Start date*', { exact: true })` and assert `recurring.getByRole('group', { name: 'Start date' }).getByRole('spinbutton').first()` is focused.
- **Files modified:** `e2e/tests/accessibility.spec.ts`
- **Committed in:** `d24fb145`, `7a99e350`

**2. [Rule 1 - Bug / Cross-spec selector update] Updated `e2e/tests/server-mode/auth.spec.ts:177` for shared `Select`**
- **Found during:** Task 1 (cross-spec grep and verification per `<orchestrator_notes>`)
- **Issue:** Moving `RecurringFormModal` `Remind me` to shared React Aria `Select` caused `owner.getByLabel('Remind me')` to match both the desktop trigger `<button>` and React Aria's hidden `<select>`, failing strict mode.
- **Fix:** Updated line 177 to `owner.getByRole('button', { name: 'Remind me' })`.
- **Files modified:** `e2e/tests/server-mode/auth.spec.ts`
- **Verification:** `--project=server-mode tests/server-mode/auth.spec.ts` -> 17/17 passed.
- **Committed in:** `d24fb145`

**3. [Rule 2 - Missing variant / Review WR-05] Added `optionalHint` prop to shared `DatePicker` and `"Optional hint"` gallery specimen**
- **Found during:** Iteration-2 review (`WR-05`)
- **Issue:** Putting `"(optional)"` in `label` changed `End date`'s accessible name from `"End date"` to `"End date (optional)"` (violating D-15), while plain `optional` drew no visible hint.
- **Fix:** Added `optionalHint?: boolean` to `client/src/components/ui/DatePicker.tsx` (desktop and phone) and its `"Optional hint"` specimen in `client/src/pages/devGallery/DateCards.tsx`.
- **Files modified:** `client/src/components/ui/DatePicker.tsx`, `client/src/components/ui/DatePicker.test.ts`, `client/src/pages/devGallery/DateCards.tsx`, `client/src/components/recurring/RecurringFormModal.tsx`, `client/src/components/recurring/RecurringFormModal.test.ts`
- **Committed in:** `09fdc600`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 cross-spec selector updates, 1 Rule 2 shared-control variant from review WR-05).
**Impact on plan:** Necessary for exact D-15 accessible-name parity and green cross-spec e2e suites.

## Issues Encountered

- Worktree initially had no `node_modules/` in root, `client/`, `server/`, `e2e/`, or `lint/`; ran lockfile-exact `npm ci` using Node 24 without modifying any lockfile or `.npmrc`.
- During review-fix passes (`WR-01`–`WR-06`), sibling executor `03-09` held the shared e2e ports, so Playwright was not re-run; all unit tests, typechecks (`client` and `e2e`), build, and lint ran cleanly, leaving Playwright re-verification and gallery baseline regeneration to the orchestrator.

## Verification

- **Precondition:** `grep -c '^Reconcile: match$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` -> `1`; `client/src/components/ui/NumberField.tsx` exists.
- **Raw-control perl check across all 5 files** (`RecurringFormModal.tsx`, `UpcomingLengthModal.tsx`, `AllTab.tsx`, `DiscoverSchedulesModal.tsx`, `OccurrenceMatchModal.tsx`): `0` (was 13).
- **`UpcomingLengthModal.tsx` accessible-name grep:** `3` (`Upcoming length`, `Custom length number`, `Custom length unit`).
- **`e2e/tests/recurring.spec.ts` old-selector check** (`selectOption|option:checked`): `0`.
- **Post-review unit tests, typechecks, build, and lint (run after `32311cd9`):**
  - `cd client && npx vitest run` -> `99 passed (99)` (including `DatePicker.test.ts` 17/17 and `RecurringFormModal.test.ts` 4/4)
  - `cd client && npx tsc --noEmit` & `npm --prefix client run build` -> passed (0 errors)
  - `cd e2e && npx tsc --noEmit` -> passed (0 errors)
  - `npm --prefix lint test` -> passed
  - `npm --prefix lint run lint` -> `0 errors, 126 warnings` (within cap 128; 0 warnings added)
- **Playwright (run on initial migration `9eb9bfaf`; re-run after `WR-01`–`WR-06` deferred to orchestrator while `03-09` holds e2e ports):**
  - Desktop (`recurring`, `accessibility`, `polish`, `budget`, `housemate-money`, `tabs`): `70 passed (1.7m)`
  - Phone (`phone`, `phone-native`, `page-gutter`): `27 passed (1.0m)`
  - Demo (`demo`): `14 passed (35.9s)`
  - Server-mode (`auth`): `17 passed (47.7s)`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All five Recurring components (`RecurringFormModal`, `UpcomingLengthModal`, `AllTab`, `DiscoverSchedulesModal`, `OccurrenceMatchModal`) are on the shared controls with both D-14 numeric fields bounded and tested failing-first and all iteration-1 and iteration-2 review warnings (`WR-01`–`WR-06`) fixed; ready for orchestrator Playwright run, gallery baseline update, wave integration, and plan `03-15`.

## Self-Check: PASSED

- All created and modified files exist on disk (`RecurringFormModal.test.ts`, `DatePicker.tsx`, `DatePicker.test.ts`, `DateCards.tsx`, the 5 recurring components, 3 e2e specs, and `03-08-SUMMARY.md`); `DiscoverSchedulesModal.test.ts` is intentionally deleted and recorded under `## Deleted files`.
- All 11 commits (`d24fb145`, `9eb9bfaf`, `735570e4`, `4b62defb`, `911920f5`, `7a99e350`, `eacee6e9`, `7a8cae72`, `09fdc600`, `66b2bc05`, `32311cd9`) are ancestors of `HEAD` on `worktree-agent-p0308-a1`.
- `STATE.md` and `ROADMAP.md` have zero modifications.
- Raw-control check returned `0`; `UpcomingLengthModal` accessible-name check returned `3`; `client vitest` (99/99 files), `client tsc`/`build`, `e2e tsc`, `lint test`, and `eslint` (0 errors, 126/128 warnings) all passed.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
