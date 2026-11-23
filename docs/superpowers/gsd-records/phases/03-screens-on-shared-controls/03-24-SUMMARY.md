---
phase: 03-screens-on-shared-controls
plan: 24
subsystem: ui
tags: [transactions, filters, marks, date-picker, currency-input, checkbox, input, wave-g]

requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-01 D-16 reconciliation (`Reconcile: match`), 03-12 e2e `setToggle` route for the shared Checkbox'
provides:
  - 'TransactionFilters: search and the CheckList find box on the shared Input, the filter checkboxes (CheckList options, Not categorised yet, Hide transfers) on the shared Checkbox, the amount bounds on CurrencyInput (sm), From and To on the shared DatePicker (sm) bounding each other'
  - 'TransactionMarks: the find-or-create tag box on the shared Input, Reviewed and Hide from reports on the shared Checkbox'
affects: [03-13, 03-15]

plan_head_before: 942f1ee0
plan_head_after: 740cb794
commits: 2

actuals:
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - 'A nullable money filter bound on CurrencyInput: value `bound ?? 0`, commit `cents === 0 ? null : cents` (CurrencyInput shows 0 as empty and reads empty text as 0, as the old field did)'

key-files:
  created: []
  modified:
    - client/src/components/transactions/TransactionFilters.tsx
    - client/src/components/transactions/TransactionMarks.tsx
    - e2e/tests/transaction-filters.spec.ts
    - e2e/tests/polish.spec.ts
    - e2e/tests/phase9.spec.ts

key-decisions:
  - 'Amount bounds use CurrencyInput, not Input (the audit row TransactionFilters.tsx:255 left the choice open; the plan picked CurrencyInput)'
  - 'From and To are `optional`, so the shared DatePicker offers Clear, as the native date input let you empty them'
  - 'Reviewed and Hide from reports keep their help line inside the Checkbox label, so the accessible names are unchanged'

patterns-established: []

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: 'Register filters on the shared Input, Checkbox, CurrencyInput and DatePicker, with the same URL parameters'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/transaction-filters.spec.ts'
        status: pass
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/polish.spec.ts tests/phase9.spec.ts'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Transaction marks (new tag box, Reviewed, Hide from reports) on the shared Input and Checkbox'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop tests/phase9.spec.ts'
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-20
status: complete
---

# Phase 03 Plan 24: Register filters and marks on the shared controls Summary

**The register's filters and the transaction marks now use only shared controls (Input, Checkbox, CurrencyInput, DatePicker). The URL parameters and accessible names are unchanged, and both files print 0 on the gate.**

## Performance

- Tasks: 2/2
- Commits: 2 task commits plus this summary

## Accomplishments

- Search ("Search payee or notes", `type="text"`) is the shared Input (sm). It keeps its search icon and Clear search button, and its placeholder and aria-label are unchanged.
- The CheckList find box ("Find categories" and the others, `type="search"`, so still a searchbox) is the shared Input (sm).
- The CheckList options, "Not categorised yet" and "Hide transfers" are the shared Checkbox, without the wrapping labels. Their accessible names are unchanged, including "Name · Group" for categories.
- "At least" and "At most" are CurrencyInput (sm), labelled by a visible `<label htmlFor>`. Enter still commits by blurring the field. Unreadable text stays in the field marked `aria-invalid` and is not applied. The URL keys `min_amount`/`max_amount` and their minor-unit magnitudes are unchanged.
- From and To are the shared DatePicker (sm, `hideLabel`, `optional`). From's `maxValue` is the To day and To's `minValue` the From day. Both write the same YYYY-MM-DD `from`/`to` URL parameters. Phones get the native date input, as before.
- In TransactionMarks, "Find or create a tag" is the shared Input (sm) with its aria-label, maxLength and Enter handling. Reviewed and Hide from reports are the shared Checkbox with the same checked state, the same optimistic toggle and the same names.

## Task Commits

- `060fc03b` feat(03-24): register filters on the shared Input, Checkbox, CurrencyInput and DatePicker
- `740cb794` feat(03-24): transaction marks on the shared Input and Checkbox

## Files Created/Modified

- `client/src/components/transactions/TransactionFilters.tsx`: shared Input, Checkbox, CurrencyInput, DatePicker. The hand-parsed AmountBound field and its imports (`amountToInput`, `readTypedAmount`, `useAmountStyle`, `UNREADABLE_AMOUNT`) are gone.
- `client/src/components/transactions/TransactionMarks.tsx`: shared Input and Checkbox.
- `e2e/tests/transaction-filters.spec.ts`: the From test uses `fillDate` and asserts the URL parameter.
- `e2e/tests/polish.spec.ts`, `e2e/tests/phase9.spec.ts`: `.check()` on a filter or mark checkbox replaced by `setToggle` (deviation 1).

## Selector changes

| Spec line                           | Was                                                                                    | Now                                                                                                                                                                                         | Reason                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transaction-filters.spec.ts:79-82` | `getByLabel('From').toBeVisible()`, `.fill('2026-11-01')`, `toHaveValue('2026-11-01')` | the field found by `getByRole('group', { name })` on desktop or `getByLabel(name)` on phones; `fillDate(page, 'From', '2026-11-01')`; `expect(page).toHaveURL(/[?&]from=2026-11-01(&\|$)/)` | The desktop DatePicker is a group of typed segments with no single input to fill or read. The URL parameter is what the filter writes (T-03-21).              |
| `polish.spec.ts:50`                 | `getByRole('checkbox', { name: 'Not categorised yet' }).check()`                       | `setToggle(…)`                                                                                                                                                                              | The shared Checkbox's visual box covers React Aria's 1 px input, so Playwright's `check()` is intercepted (the same finding as 03-12). The name is unchanged. |
| `polish.spec.ts:65`                 | `getByRole('checkbox', { name: 'Groceries' }).check()`                                 | `setToggle(…)`                                                                                                                                                                              | Same                                                                                                                                                          |
| `phase9.spec.ts:41`                 | `getByRole('checkbox', { name: 'Holiday' }).check()`                                   | `setToggle(…)`                                                                                                                                                                              | Same (the Tags filter list)                                                                                                                                   |
| `phase9.spec.ts:72`                 | `getByRole('checkbox', { name: /Hide from reports/ }).check()`                         | `setToggle(…)`                                                                                                                                                                              | Same (the marks checkbox)                                                                                                                                     |

No accessible name changed; From and To are now a group of date segments on desktop (D-07), not a native date input. "At least" keeps `getByLabel('At least')`, and the find boxes keep `getByRole('searchbox', …)`.

## Behaviour changes

- **A typed 0 is still a bound (review WR-01).** The first version cleared a typed 0, so "At most 0" could not be typed. CurrencyInput now has an opt-in `nullable` mode: empty is no bound, a typed 0 is a bound of 0 and shows as `$0`, as `max_amount=0` did before. The amount bounds use it, with no placeholder, as before.
- **An unreadable amount now shows CurrencyInput's error line** (`UNREADABLE_AMOUNT`, "That isn't an amount. Type it like 12.50 or 12,50.", `role="alert"`) under the field, instead of only a tooltip and a red border. It is still kept and not applied. Checked by `transaction-filters.spec.ts` (`aria-invalid="true"` after leaving "oops").
- **From and To offer a Clear button** ("Clear From", "Clear To") on desktop when they hold a day. On desktop a From after To (or To before From) now shows the DatePicker's range line. Before, the native field only limited its own picker.
- Looks: Hide transfers is shorter on desktop (the shared Checkbox has its 44 px height on phones only). With Safe mode on, a bound shows hidden when the field is not focused, as other amounts do.
- Looks: the search box is the shared 32 px field with a rounded-md corner (it was rounded-lg), and the checkboxes are the shared 20 px box.

## Review (03-24-REVIEW-opus.md), the one round, fixed by the orchestrator

- WR-01: `nullable` CurrencyInput, above. Tests: `transaction-filters.spec.ts` 'At most 0 lists only zero-amount rows, and emptying it lifts the bound' (fails with the first version), and a CurrencyInput unit test for 0 versus empty.
- WR-02: Reviewed and Hide from reports had lost their 12 px gap, because `space-y-3` does not reach the Checkbox's `display: contents` wrapper. The wrapper is now `flex flex-col gap-3`.
- WR-03: the desktop 'empty custom date range' test now presses Clear From and checks that `from` leaves the link while Custom stays chosen.
- IN-01, for a shared-control change later (it would move every CurrencyInput's gallery look): CurrencyInput lacks `bg-surface` and `max-md:text-base`, so the filters pass them as caller classes, and other callers get 14 px text on phones.
- IN-02, IN-03: recorded above. IN-04: 03-13 is making the `transactions.spec.ts:459` change below, so 03-24 merges with or after 03-13 and 03-15 has nothing to apply.

## For 03-15

| transactions.spec.ts line                                                                              | Replacement                                                                                                                | Reason                                                                                                                                                               | Test that fails until applied                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactions.spec.ts:459`: `await page.getByRole('checkbox', { name: 'Everyday Checking' }).check();` | `await setToggle(page.getByRole('checkbox', { name: 'Everyday Checking' }));` (add `setToggle` to the `./fixtures` import) | The Accounts filter box is now the shared Checkbox. Its visual box intercepts the pointer on React Aria's 1 px input, so `check()` times out. The name is unchanged. | `[desktop] › tests/transactions.spec.ts:440:3 › account register › combines filters, summarises the selection and keeps it in the link` (error at transactions.spec.ts:459) |

Checked with a throwaway copy of transactions.spec.ts that had only this replacement. That test passed (1/1), and the copy was deleted, never committed. Lines 462-463 ("At least" fill and Enter) pass unchanged.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] polish.spec.ts and phase9.spec.ts ticked the moved checkboxes with `.check()`**

- **Found during:** Task 1 (a grep for specs selecting the changed controls, orchestrator note 2)
- **Issue:** Playwright's `check()` is intercepted by the shared Checkbox's visual box (03-12 found the same), so `polish.spec.ts:50, 65` and `phase9.spec.ts:41, 72` would fail.
- **Fix:** They now use `setToggle`, the existing helper. No plan in wave 5 owns these specs, and transactions.spec.ts was not touched.
- **Files modified:** e2e/tests/polish.spec.ts, e2e/tests/phase9.spec.ts
- **Commits:** 060fc03b (polish, phase9:41), 740cb794 (phase9:72)

## Issues Encountered

- One Playwright run was held while another plan's run had 127.0.0.1:3169; I waited for the port to free rather than stopping it.

## Verification

- `npm --prefix e2e test -- --project=desktop tests/transaction-filters.spec.ts`: 4 passed.
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts` (with transaction-filters, phase9, polish, accessibility, navigation, transaction-presets, budget and cash-flow): 123 passed, 1 failed. The failure is transactions.spec.ts:459, listed under "For 03-15".
- Phone project, the phone specs that touch search, filters or marks (polish-phone, dashboard-viewport, iphone-webapp, phone-native): 39 passed. The 390 px variants of transaction-filters.spec.ts run in the desktop project above and passed.
- The transactions.spec.ts guard: `git diff --quiet HEAD -- e2e/tests/transactions.spec.ts` exited 0, and `git rev-list --count --fixed-strings --grep='(03-24)' HEAD -- e2e/tests/transactions.spec.ts` printed 0.
- The two-file gate (perl count over TransactionFilters.tsx and TransactionMarks.tsx) printed 0 (13 at HEAD).
- `npm --prefix lint test`: 86 passed. `npm --prefix lint run lint`: 0 errors and 122 warnings (cap 128), none in the changed files.
- `cd client && npx tsc --noEmit`: clean. `npm test --prefix client`: 103 files, 943 tests passed.
- No gallery specimen covers these screens, so no baselines need regenerating.

## Threat Flags

None. T-03-21: the filter URL keys and values are unchanged (`from`/`to` as YYYY-MM-DD, `min_amount`/`max_amount` as magnitudes in minor units), and transaction-filters.spec.ts asserts the `from` parameter. T-03-SC: no package added.

## User Setup Required

None.

## Next Phase Readiness

- 03-15 needs to apply the one transactions.spec.ts line listed above.

## Self-Check: PASSED
