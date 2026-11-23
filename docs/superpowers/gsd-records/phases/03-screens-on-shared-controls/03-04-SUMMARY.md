---
phase: 03-screens-on-shared-controls
plan: 04
subsystem: ui
tags: [combobox, select, category-picker, merchant-select, currency, wave-g]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (Reconcile: match) and binding audit classifications"
provides:
  - "MerchantSelect rebuilt as a thin wrapper over shared Combobox with confirmed payees, PayeeIcon, transaction count, blur clearing, and paused-saving footer"
  - "CategoryPicker optional extraItem (reusing SearchListPinned), hint, allowCreate, and includeHidden props, plus CreateCategoryForm gated on useCanSave()"
  - "CategorySelectButton optional label, allowNone, noneLabel, groups, extraItem, hint, allowCreate, and includeHidden props on shared fieldClasses"
  - "CurrencySelect on shared Select (Common and All currencies groups, aria-describedby forwarding, standalone w-* check, native select on phones per D-04)"
  - "CurrencyDifference category field on CategorySelectButton over CategoryPicker with gain/loss filtering, hidden categories preserved, inline creation disabled, and 'No category (net worth only)'"
affects: [03-05, 03-07, 03-08, 03-10, 03-11, 03-12, 03-17, 03-22, 03-25]

plan_head_before: dd7f34829533a4b1b092d8ad88472b207748ce22
plan_head_after: ed49bb79b480625a49b4827d536240bcaf5ea895
commits: 14

actuals:
  tokens: 27551
  tasks: 3
  commits: 14

tech-stack:
  added: []
  patterns:
    - "Confirmed-choice Combobox wrapper with blur clearing and portalContainer inside dialogs (MerchantSelect)"
    - "Single-source ListOption/ListGroup types in listItems.tsx shared by Select and Combobox"
    - "CategoryPicker extraItem, hint, allowCreate, and includeHidden pass-through via categoryButtonPickerProps"
    - "External aria-describedby forwarding merged with internal description/error ids on Select (desktop and phone)"

key-files:
  created:
    - client/src/components/transactions/MerchantSelect.test.ts
    - client/src/components/currency/CurrencySelect.test.ts
  modified:
    - client/src/components/transactions/MerchantSelect.tsx
    - client/src/components/transactions/CategoryPicker.tsx
    - client/src/components/transactions/CategoryPicker.test.ts
    - client/src/components/transactions/CategorySelectButton.tsx
    - client/src/components/currency/CurrencySelect.tsx
    - client/src/components/currency/CurrencyDifference.tsx
    - client/src/components/ui/Combobox.tsx
    - client/src/components/ui/Combobox.test.ts
    - client/src/components/ui/listItems.tsx
    - client/src/components/ui/Select.tsx
    - e2e/tests/recurring.spec.ts
    - e2e/tests/currencies.spec.ts

key-decisions:
  - "Kept MerchantSelect separate from PayeeCombobox: MerchantSelect enforces confirmed payees and clears unpicked text on blur"
  - "Added minimal optional icon/trailing (on ListOption/ListGroup in listItems.tsx) and portalContainer to Combobox so payee icons render and dialog-scoped e2e selectors ('Create new payee') stay inside Modal dialogs without altering default markup"
  - "Reused SearchListPinned for CategoryPicker extraItem when allowNone is off, and placed extraItem as a leading headingless section when both allowNone and extraItem are enabled (serving ImportCategories)"
  - "Moved CurrencySelect onto shared Select per audit D-06 classification (fixed CURRENCY_CODES list), forwarding aria-describedby and keeping native select on phones (D-04)"
  - "Restored exact D-15 parity on CurrencyDifference via includeHidden and allowCreate={false}, and gated CategoryPicker's CreateCategoryForm on useCanSave() with SavingPausedHint"
  - "Accepted React Aria Select's desktop trigger aria-labelledby ('<value> Currency') as a D-05 consequence required for screen-reader value announcement, kept aria-label='Currency' and id on the trigger/select, and scoped currencies.spec.ts's Add rate Currency locator to the rate form"

patterns-established:
  - "MerchantSelect exports pure helpers sortPayees and merchantFooterState for direct unit testing"
  - "CategorySelectButton exports categoryButtonPickerProps so both trigger display and CategoryPicker share the same resolved groups and options"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "MerchantSelect rebuilt on shared Combobox with transactionCount/name sort, PayeeIcon, blur clearing, and paused-saving footer"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "client/src/components/transactions/MerchantSelect.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/recurring.spec.ts (desktop) + e2e/tests/cash.spec.ts (desktop)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CategoryPicker extraItem, hint, allowCreate, includeHidden, and useCanSave gating; CategorySelectButton label/allowNone/noneLabel/groups forwarding"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "client/src/components/transactions/CategoryPicker.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts (desktop)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CurrencySelect on shared Select (with aria-describedby, standalone w-* check, native on phones) and CurrencyDifference on CategorySelectButton/CategoryPicker (D-15 parity)"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "client/src/components/currency/CurrencySelect.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/currencies.spec.ts (desktop, incl. 390px phone native select and CurrencyDifference CategoryPicker tests)"
        status: pass
    human_judgment: false

duration: 64 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 04: Shared Payee, Category, and Currency Adapters Summary

**Rebuilt MerchantSelect on shared Combobox, extended CategoryPicker/CategorySelectButton with extraItem, hint, allowCreate, includeHidden, label, allowNone/noneLabel, and groups props (plus paused-saving gating on CreateCategoryForm), and moved CurrencySelect to shared Select and CurrencyDifference to CategoryPicker**

## Performance

- **Duration:** 64 min (including review fixes)
- **Started:** 2026-11-19T01:54:21Z
- **Completed:** 2026-11-19T02:58:00Z
- **Tasks:** 3 (+ 6 review fixes)
- **Files modified:** 14 (2 created, 12 modified)

## Accomplishments

- Rebuilt `MerchantSelect` as a thin wrapper over the shared `Combobox` while keeping its `{ id, name }` value contract, `transactionCount` descending + `name` ascending sort (`sortPayees`), `PayeeIcon` + transaction count badge, blur clearing of unconfirmed text, Escape-closes-list-only behavior (D-12), and `Create new payee` / reconnect-when-paused footer (`merchantFooterState`), removing `selectorInputClass`.
- Added optional `extraItem` (reusing `SearchListPinned` when `allowNone` is off, and a leading headingless section when both `allowNone` and `extraItem` are enabled), `hint`, `allowCreate`, and `includeHidden` props to `CategoryPicker`, gated `CreateCategoryForm` on `useCanSave()` with `<SavingPausedHint />`, and added `label`, `allowNone`, `noneLabel`, `groups`, `extraItem`, `hint`, `allowCreate`, and `includeHidden` pass-through props to `CategorySelectButton` via `categoryButtonPickerProps` (migrated off `selectorInputClass` onto shared `fieldClasses`).
- Moved `CurrencySelect` onto the shared `Select` with `Common` and `All currencies` groups, `aria-describedby` forwarding, standalone width class handling, and native `<select>` on phones (D-04), and moved `CurrencyDifference`'s category field onto `CategorySelectButton` over `CategoryPicker` with gain/loss group filtering, `includeHidden`, `allowCreate={false}`, and `No category (net worth only)`.

## Task Commits

Each task and review fix was committed atomically:

1. **Task 1: MerchantSelect on the shared Combobox** - `192cf16d` (feat)
2. **Task 2: CategoryPicker pinned item and hint; CategorySelectButton label** - `5ade40ce` (feat)
3. **Task 3: CurrencySelect on the shared Select; CurrencyDifference on CategoryPicker** - `0aff7e67` (feat)
4. **Verification lint fix: remove unused `SelectGroup` import in `listItems.tsx`** - `a26a9792` (fix)
5. **Initial plan summary** - `a7ff8184` (docs)
6. **Review fix WR-01: forward `aria-describedby` through `Select` and `CurrencySelect`** - `23eb60c5` (fix)
7. **Review fix WR-02: match only standalone `w-*` classes in `CurrencySelect` width check** - `76264761` (fix)
8. **Review fix WR-03: use `ListOption` and `ListGroup` from `listItems` in `Combobox`** - `80e2cc5e` (fix)
9. **Review fix WR-04: restore `CurrencyDifference` hidden categories and opt out of inline creation; gate `CreateCategoryForm` on `useCanSave`** - `8fb4f62c` (fix)
10. **Review fix WR-05: test `CategorySelectButton` `groups` forwarding to `CategoryPicker`** - `849678fa` (fix)
11. **Review fix IN-04: scope rate-form `Currency` locator and verify `CurrencySelect` accessible label** - `627f031a` (fix)
12. **Record iteration-1 review report and fixes** - `e9909251` (docs)
13. **Review fix R2-WR-01: stop restating `CategoryPicker` defaults in `categoryButtonPickerProps`** - `82178fad` (fix)
14. **Review fix R2-IN-02: assert rate-form `Currency` by role and accessible name, not `aria-label` attribute** - `ed49bb79` (fix)

## Files Created/Modified

- `client/src/components/transactions/MerchantSelect.tsx` - Rebuilt on shared `Combobox`, exported `sortPayees`, `merchantFooterState`, and `PAUSED_CREATE_MESSAGE`; removed `selectorInputClass`.
- `client/src/components/transactions/MerchantSelect.test.ts` - Created unit tests for static combobox render/accessible name, `sortPayees`, and `merchantFooterState` (including paused-saving negative case).
- `client/src/components/ui/listItems.tsx` - Added optional `icon` and `trailing` slots on `ListOption` (byte-identical markup when omitted) and generic `isGroup` narrowing.
- `client/src/components/ui/Combobox.tsx` - Imported `ListOption`/`ListGroup` from `listItems.tsx`, derived `SearchListOption` from `ListOption`, and added optional `portalContainer` prop on `Combobox` `<Popover>` (no overlap with 03-03's line 13 import move).
- `client/src/components/ui/Combobox.test.ts` - Added test verifying `Combobox` uses `ListOption`/`ListGroup` from `listItems` with no duplicate option types.
- `client/src/components/ui/Select.tsx` - Added optional `aria-describedby` prop merged with internal description/error ids on desktop and phone.
- `client/src/components/transactions/CategoryPicker.tsx` - Added optional `extraItem`, `hint`, `allowCreate`, and `includeHidden` props; exported `CreateCategoryForm` gated on `useCanSave()` with `<SavingPausedHint />`.
- `client/src/components/transactions/CategoryPicker.test.ts` - Added TDD unit tests for `extraItem`, `hint`, `includeHidden`, paused `CreateCategoryForm`, and `CategorySelectButton` (`label`, `extraItem`, `allowNone`/`noneLabel`, `groups` display + `categoryButtonPickerProps` forwarding).
- `client/src/components/transactions/CategorySelectButton.tsx` - Migrated trigger classes to shared `fieldClasses`, added `label`, `allowNone`, `noneLabel`, `groups`, `extraItem`, `hint`, `allowCreate`, and `includeHidden` props, and extracted `categoryButtonPickerProps`.
- `client/src/components/currency/CurrencySelect.tsx` - Rebuilt on shared `Select` with `Common` and `All currencies` `SelectGroup`s, `aria-describedby` forwarding, and `/(^|\s)w-/` width check.
- `client/src/components/currency/CurrencySelect.test.ts` - Created unit tests for `aria-describedby` (desktop, phone, merged with description), width classes (`max-w-xs`, `min-w-0`, `w-48`, default), and `aria-label` / `id` placement.
- `client/src/components/currency/CurrencyDifference.tsx` - Replaced native `<select>` with `CategorySelectButton` filtered to income/expense groups with `allowNone`, `noneLabel="No category (net worth only)"`, `allowCreate={false}`, and `includeHidden`.
- `e2e/tests/recurring.spec.ts` - Updated three `Payee` field selectors from `textbox` to `combobox`.
- `e2e/tests/currencies.spec.ts` - Updated Currency `Select` selectors to `button` role + `chooseOption` (scoping the Add rate field to the rate form), and added phone native `CurrencySelect` (D-04) and `CurrencyDifference` filtered `CategoryPicker` (incl. hidden category & no create button) tests.

## Selector changes

Grep across `e2e/` confirmed no other spec selects `MerchantSelect` via `getByRole('textbox', { name: 'Payee' })` (`rules.spec.ts` and `transactions.spec.ts` need no follow-up selector notes).

| spec:line | before | after | reason |
| --- | --- | --- | --- |
| `e2e/tests/recurring.spec.ts:82` | `dialog.getByRole('textbox', { name: 'Payee' }).fill('Iron Temple Gym')` | `dialog.getByRole('combobox', { name: 'Payee' }).fill('Iron Temple Gym')` | `MerchantSelect` is now the shared `Combobox`, whose input has role `combobox` |
| `e2e/tests/recurring.spec.ts:84` | `dialog.getByRole('textbox', { name: 'Payee' })` | `dialog.getByRole('combobox', { name: 'Payee' })` | `MerchantSelect` is now the shared `Combobox`, whose input has role `combobox` |
| `e2e/tests/recurring.spec.ts:98` | `dialog.getByRole('textbox', { name: 'Payee' })` | `dialog.getByRole('combobox', { name: 'Payee' })` | `MerchantSelect` is now the shared `Combobox`, whose input has role `combobox` |
| `e2e/tests/currencies.spec.ts:27` (was `:18`) | `dialog.getByRole('combobox', { name: 'Currency' })` (toHaveCount 0) | `dialog.getByRole('button', { name: /\bCurrency$/ })` (toHaveCount 0) | `CurrencySelect` is now the shared `Select`, whose desktop trigger is a `button` named `"<chosen> Currency"`; absence check uses the same locator as `:50` so it proves absence under the new role |
| `e2e/tests/currencies.spec.ts:40` (was `:31`) | `page.getByRole('combobox', { name: 'Budget currency' }).selectOption('EUR')` | `chooseOption(page.getByRole('button', { name: /Budget currency/ }), 'EUR · Euro')` | `CurrencySettings` uses `CurrencySelect` (shared `Select`, desktop trigger `button` + listbox option by visible label) |
| `e2e/tests/currencies.spec.ts:50` (was `:41`) | `dialog.getByRole('combobox', { name: 'Currency' }).selectOption('JPY')` | `chooseOption(dialog.getByRole('button', { name: /\bCurrency$/ }), 'JPY · Japanese Yen')` | `AddAccountModal` uses `CurrencySelect` (shared `Select`, desktop trigger `button` + listbox option by visible label) |
| `e2e/tests/currencies.spec.ts:136-140` (was `:126`) | `page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('GBP')` | `const rateForm = page.locator('form', { has: page.getByRole('button', { name: 'Add rate' }) }); chooseOption(rateForm.getByRole('button', { name: /Currency/i }), 'GBP · British Pound')` | `CurrencySettings` Add rate form uses `CurrencySelect` (shared `Select`, desktop trigger `button`); scoped to the rate form rather than relying on letter case against `Budget currency` (IN-04) |

## Safe mode verification (T-03-06)

- Inspected `client/src/components/budget/MoneyMoves.tsx` (:196, :215), `client/src/components/goals/GoalStatusModal.tsx` (:142), and `client/src/utils/currency.ts` (:366-378, :406).
- Both old native `<option>` lists rendered amounts with `formatCurrency(c.balance)` inside `{c.name} ({formatCurrency(c.balance)} available)`. `formatCurrency` calls `formatAmount`, which checks `hidesAllAmounts()` and returns `HIDDEN_AMOUNT` when Safe mode hides all amounts.
- `CategoryPicker`'s `hint?: (categoryId: string) => string` appends the caller-formatted hint directly after `c.name`, so callers using `formatCurrency` produce the exact same Safe mode masking as the native `<option>` elements did.

## Review fixes

Addressed all findings from `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-REVIEW.md` (`WR-01`–`WR-05` and `IN-04`), each with a failing-first test recorded before the fix:

- **WR-01 (`23eb60c5`) — Forward `aria-describedby` through `Select` and `CurrencySelect`:**
  - *RED:* Added 3 tests in `CurrencySelect.test.ts` asserting `aria-describedby` on desktop trigger, phone native select, and merged with `Select`'s own `description` -> 3/3 failed (`aria-describedby` dropped).
  - *Fix:* Added optional `'aria-describedby'?: string` to `Select.tsx` (passed to `<AriaSelect>` on desktop and merged with `describedByIds` in `NativeSelect` on phone) and forwarded it from `CurrencySelect.tsx`.
  - *GREEN:* `CurrencySelect.test.ts` (3/3) and `Select.test.ts` (23/23) passed.
- **WR-02 (`76264761`) — Fix `CurrencySelect` width check so `max-w-*` / `min-w-*` keep `w-full`:**
  - *RED:* Added 2 tests in `CurrencySelect.test.ts` checking `max-w-xs` and `min-w-0` retain `w-full` while `w-48` omits `w-full` -> 1/5 failed (`max-w-xs` was missing `w-full`).
  - *Fix:* Replaced `/\bw-/` with `/(^|\s)w-/` in `CurrencySelect.tsx`.
  - *GREEN:* `CurrencySelect.test.ts` (5/5) passed.
- **WR-03 (`80e2cc5e`) — Remove duplicate `ComboboxOption`/`ComboboxGroup` and use `ListOption`/`ListGroup` from `listItems.tsx`:**
  - *RED:* Added test in `Combobox.test.ts` importing `ListOption`/`ListGroup` and asserting `Combobox.tsx` declares no `ComboboxOption`/`ComboboxGroup` -> 1/31 failed.
  - *Fix:* Deleted `ComboboxOption` and `ComboboxGroup` in `Combobox.tsx`, imported `ListOption` and `ListGroup` from `./listItems`, and defined `SearchListOption = Omit<ListOption, 'trailing'>`.
  - *GREEN:* `Combobox.test.ts` (31/31) and `client tsc --noEmit` passed.
- **WR-04 (`8fb4f62c`) — Restore `CurrencyDifference` D-15 parity (`includeHidden`, `allowCreate={false}`) and gate `CreateCategoryForm` on `useCanSave()`:**
  - *RED:* Added 3 tests in `CategoryPicker.test.ts` for `includeHidden: true` and `CreateCategoryForm` paused saving -> 3/29 failed.
  - *Fix:* Added optional `includeHidden` (default `false`) and `allowCreate` (default `true`) to `CategoryPicker` and `CategorySelectButton`; passed `includeHidden` and `allowCreate={false}` in `CurrencyDifference`; exported `CreateCategoryForm` and gated its buttons + handler on `useCanSave()` with `<SavingPausedHint />` (bypassed only when local gallery `onCreate` is provided). Extended `currencies.spec.ts` to seed a hidden expense category (`Retired FX`) and assert it is shown while `"Create new category"` has count 0.
  - *GREEN:* `CategoryPicker.test.ts` (29/29) and `currencies.spec.ts` (11/11) passed.
- **WR-05 (`849678fa`) — Replace vacuous `categoryList` test with real `CategorySelectButton` `groups`-forwarding test:**
  - *Note on Task 2 RED:* At base `dd7f3482`, `CategoryPicker.test.ts` had 18 tests; 1 of the 8 tests initially added (`limits sections to the provided groups only`) tested `categoryList` directly and passed at base (leaving 7/26 failing rather than 8/26).
  - *RED:* Replaced that test with a test on `categoryButtonPickerProps` verifying `CategorySelectButton` forwards `groups` (replacing `useCategories()`), `allowNone`/`noneLabel`, `allowCreate`, and `includeHidden` to `CategoryPicker` -> 1/29 failed (`categoryButtonPickerProps is not a function`).
  - *Fix:* Extracted and exported `categoryButtonPickerProps` in `CategorySelectButton.tsx` and used it for both trigger resolution and `<CategoryPicker {...picker} />`.
  - *GREEN:* `CategoryPicker.test.ts` (29/29) passed.
- **IN-04 (`627f031a`) — Preserve `CurrencySelect`'s `'Currency'` label and remove case-dependent rate-form locator:**
  - *D-05 note:* React Aria's `Select` desktop trigger sets `aria-labelledby="<valueId> <buttonId>"`, so the computed button name is `"<value> Currency"` (necessary so screen readers announce the selected currency on focus). This is an accepted consequence of D-05 from the Phase 2 shared `Select`. `CurrencySelect` preserves `aria-label="Currency"` (default) and forwards `id` directly onto the desktop `<button>` and phone `<select>` (exact accessible name `"Currency"` on phones).
  - *RED:* Confirmed in Playwright that `page.getByLabel('Currency', { exact: true })` fails on desktop because `aria-labelledby` includes the chosen value; page-wide case-sensitive `/\bCurrency$/` relied on casing to separate `Currency` from `Budget currency`.
  - *Fix:* Scoped `currencies.spec.ts`'s Add rate currency picker to the rate `<form>` with case-insensitive `/Currency/i`, asserted `aria-haspopup="listbox"` and `aria-label="Currency"`, and added desktop + phone `aria-label`/`id` unit tests in `CurrencySelect.test.ts`.
  - *GREEN:* `CurrencySelect.test.ts` (6/6) and `currencies.spec.ts` (11/11) passed.

Addressed all findings from `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-REVIEW-2.md` (`R2-WR-01` and `R2-IN-02`):

- **R2-WR-01 (`82178fad`) — Stop restating `CategoryPicker` defaults in `categoryButtonPickerProps`:**
  - *RED:* Added assertions in `CategoryPicker.test.ts` that `categoryButtonPickerProps({ value: null }, GROUPS)` leaves `allowNone`, `noneLabel`, `allowCreate`, `includeHidden`, and `transferAccounts` `undefined` -> 1/29 failed (`expected true to be undefined`).
  - *Fix:* Updated `categoryButtonPickerProps` to pass through caller-supplied optional props unchanged (`{ ...props, groups: props.groups ?? fetchedGroups }`), exported `DEFAULT_NONE_LABEL` from `CategoryPicker.tsx`, and had `CategorySelectButton`'s `entry` memo read `picker.allowNone` / `picker.noneLabel ?? DEFAULT_NONE_LABEL`.
  - *GREEN:* `CategoryPicker.test.ts` (29/29) and `client tsc --noEmit` passed.
- **R2-IN-02 (`ed49bb79`) — Assert rate-form `Currency` by role and accessible name, not `aria-label` attribute:**
  - *RED:* `grep -c "toHaveAttribute('aria-label'" e2e/tests/currencies.spec.ts` printed `1` (pinning an implementation detail).
  - *Fix:* Removed `toHaveAttribute('aria-label', 'Currency')` in `e2e/tests/currencies.spec.ts` and asserted visibility and `aria-haspopup="listbox"` directly on `rateForm.getByRole('button', { name: /Currency/i })`.
  - *GREEN:* `grep` count `0`; all 66 desktop Playwright tests (`cash.spec.ts`, `recurring.spec.ts`, `transactions.spec.ts`, `currencies.spec.ts`) passed.

## Decisions Made

- Preserved `MerchantSelect` as a distinct confirmed-payee wrapper over `Combobox` (never merged into `PayeeCombobox`, per Pitfall 5).
- Rendered `MerchantSelect`'s popover into its wrapper div (`portalContainer`) so `Modal`-scoped Playwright locators (`dialog.getByRole('button', { name: /Create new payee/ })` in `recurring.spec.ts`, `cash.spec.ts`, and `transactions.spec.ts`) keep working unchanged.
- Restored exact D-15 parity on `CurrencyDifference` (`includeHidden`, `allowCreate={false}`) rather than accepting unrequested behaviour changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added optional `icon`/`trailing` and `portalContainer` support to `Combobox` and `listItems`**
- **Found during:** Task 1 (`MerchantSelect` on shared `Combobox`)
- **Issue:** Shipped `Combobox`/`listItems` rendered only plain text labels (`SelectOption`) and always portaled `<Popover>` to `document.body`, which blocked rendering `<PayeeIcon>` + transaction count and broke `dialog.getByRole('button', { name: /Create new payee/ })` in `cash.spec.ts`, `transactions.spec.ts`, and `recurring.spec.ts`.
- **Fix:** Added optional `icon` and `trailing` fields on `ListOption`/`ListGroup` in `listItems.tsx` (byte-identical DOM when omitted) and optional `portalContainer` forwarded to `<Popover UNSTABLE_portalContainer={portalContainer}>` in `Combobox.tsx` (matching `SearchList` in the same file). Edits in `Combobox.tsx` stayed away from line 13 so Wave 2 sibling `03-03`'s import move merges without conflict.
- **Files modified:** `client/src/components/ui/listItems.tsx`, `client/src/components/ui/Combobox.tsx`
- **Verification:** `Combobox.test.ts` (31/31), `Select.test.ts` (23/23), `MerchantSelect.test.ts` (6/6), `recurring.spec.ts` + `cash.spec.ts` (11/11), `transactions.spec.ts` (44/44).
- **Committed in:** `192cf16d`, cleaned up in `a26a9792` and `80e2cc5e`

**2. [Rule 2 - Missing Critical / Review WR-01] Added `aria-describedby` forwarding to shared `Select`**
- **Found during:** Independent review (`WR-01`)
- **Issue:** `AddAccountModal` and `EditAccountModal` pass `aria-describedby` to `CurrencySelect` for hint text, which `Select` did not accept or forward.
- **Fix:** Added `'aria-describedby'?: string` to `Select.tsx` (desktop and phone) and forwarded it from `CurrencySelect.tsx`.
- **Files modified:** `client/src/components/ui/Select.tsx`, `client/src/components/currency/CurrencySelect.tsx`, `client/src/components/currency/CurrencySelect.test.ts`
- **Verification:** `CurrencySelect.test.ts` (6/6), `Select.test.ts` (23/23).
- **Committed in:** `23eb60c5`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 2 missing critical from review)
**Impact on plan:** Necessary for correctness, accessibility, and passing tests/lint; zero overlap with sibling Wave 2 plan `03-03`.

## Verification

- Unit tests (post-review): `MerchantSelect.test.ts` (6/6), `CategoryPicker.test.ts` (29/29), `CurrencySelect.test.ts` (6/6), `Combobox.test.ts` (31/31), `Select.test.ts` (23/23) -> 5/5 files, 95/95 tests passed.
- `(cd client && npx tsc --noEmit)` & `npm --prefix client run build`: passed with 0 errors.
- `(cd e2e && npx tsc --noEmit)`: passed with 0 errors.
- Raw-element checks (`perl` regex from plan): `MerchantSelect.tsx` -> `0`; `CurrencySelect.tsx` + `CurrencyDifference.tsx` -> `0`.
- Playwright desktop (post-review):
  - `tests/cash.spec.ts`: 4/4 passed.
  - `tests/recurring.spec.ts`: 7/7 passed.
  - `tests/transactions.spec.ts`: 44/44 passed (unchanged).
  - `tests/currencies.spec.ts`: 11/11 passed (including 390px phone native `CurrencySelect`, rate-form scoped Currency check, and `CurrencyDifference` hidden category + no-create-button check).
- `npm --prefix lint test`: 86/86 passed.
- `npm --prefix lint run lint`: 0 errors, 126 warnings (within cap of 128; 0 warnings in modified files).

## Issues Encountered

- Vitest runs in Node where `src/api/base.ts` reads `window` at import time; mocked `usePayees`/`useConnection` in `MerchantSelect.test.ts` and `useCategories`/`useConnection`/`useOffline` in `CategoryPicker.test.ts`.
- Widening `listItems` required making `isGroup` use `Extract<T, ListGroup>` so TypeScript 7 narrowed `SelectOption | SelectGroup` in `Select.tsx`.
- `client/tsconfig.json` has no `@types/node`, so `Combobox.test.ts` uses Vite's `?raw` import to inspect `Combobox.tsx`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shared payee (`MerchantSelect`), category (`CategoryPicker` + `CategorySelectButton`), and currency (`CurrencySelect`, `CurrencyDifference`) adapters are ready for Wave 3 G2 plans (`03-05` through `03-14`, `03-24`) and G3 plans (`03-17`, `03-22`, `03-25`).
- `STATE.md` and `ROADMAP.md` were left untouched for the orchestrator's post-wave merge.

## Self-Check: PASSED

- Created files exist on disk (`client/src/components/transactions/MerchantSelect.test.ts`, `client/src/components/currency/CurrencySelect.test.ts`, `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-SUMMARY.md`, `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-REVIEW.md`, `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-REVIEW-2.md`).
- Commits `192cf16d`, `5ade40ce`, `0aff7e67`, `a26a9792`, `a7ff8184`, `23eb60c5`, `76264761`, `80e2cc5e`, `8fb4f62c`, `849678fa`, `627f031a`, `e9909251`, `82178fad`, `ed49bb79` are ancestors of `HEAD` on `worktree-agent-p0304-a1`.
- `STATE.md` and `ROADMAP.md` have zero modifications.
- All plan verification commands passed after the iteration-2 review fixes (95/95 unit tests, 66/66 desktop Playwright tests, client tsc/build, e2e tsc, 86/86 lint tests, 0 lint errors).

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
