---
phase: 03-screens-on-shared-controls
plan: 03-04
reviewed: 2026-11-19T02:36:49Z
depth: standard
diff_base: dd7f3482
head: a7ff8184
worktree: .claude/worktrees/agent-p0304-a1
files_reviewed: 11
files_reviewed_list:
  - client/src/components/transactions/MerchantSelect.tsx
  - client/src/components/transactions/MerchantSelect.test.ts
  - client/src/components/transactions/CategoryPicker.tsx
  - client/src/components/transactions/CategoryPicker.test.ts
  - client/src/components/transactions/CategorySelectButton.tsx
  - client/src/components/currency/CurrencySelect.tsx
  - client/src/components/currency/CurrencyDifference.tsx
  - client/src/components/ui/Combobox.tsx
  - client/src/components/ui/listItems.tsx
  - e2e/tests/recurring.spec.ts
  - e2e/tests/currencies.spec.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
  necessity: 1
status: issues_found
---

# Phase 03: Code Review Report (plan 03-04)

**Reviewed:** 2026-11-19T02:36:49Z
**Depth:** standard
**Files Reviewed:** 11 (03-04-SUMMARY.md excluded as a planning artifact)
**Status:** issues_found

## Summary

I reviewed `git diff dd7f3482..HEAD` in the executor worktree (commits 192cf16d, 5ade40ce, 0aff7e67,
a26a9792, a7ff8184), read each changed function whole and their callers (AddAccountModal,
EditAccountModal, CurrencySettings, InvestmentModals, RuleEditorModal, AddTransactionModal,
RecurringFormModal), and checked the React Aria 1.22.1 sources for `Select` id and description
wiring. I re-ran the checks read-only: `vitest run` on MerchantSelect, CategoryPicker, Combobox
and Select tests (4 files, 85/85 passed) and `client: tsc --noEmit` (exit 0). The worktree is clean
(`git status --short` is empty). I did not run e2e.

**Plan must_haves and prohibitions.** These hold: MerchantSelect is a Combobox wrapper with the same
`{ id, name }` contract, a combobox role and name, a `Create new payee: "…"` button, the reconnect
text while paused, and blur clearing. It is not merged into PayeeCombobox. CategoryPicker has
`extraItem` and `hint`, and CategorySelectButton has `label`, `allowNone`, `noneLabel` and `groups`.
CurrencySelect is the shared Select with the groups Common and All currencies. CurrencyDifference
uses CategorySelectButton with gain and loss filtering. No money field is touched and no
`type="number"` is added. Saving still respects `useCanSave` and `SavingPausedHint` in
CurrencyDifference.

**Selectors.** Every changed e2e selector is in the summary's table with its reason. The absence
check (`currencies.spec.ts:27`) uses the same locator that the positive test at `:50` chooses
through, so it still proves the field is absent.

**Main concerns:**
1. CurrencySelect silently drops `aria-describedby`, which two callers rely on.
2. Its width heuristic changes the Budget currency layout.
3. The orchestrator's suspicion is confirmed: the new `ComboboxOption` / `ComboboxGroup` types
   duplicate `ListOption` / `ListGroup` and nothing imports them.
4. CurrencyDifference changes behaviour beyond the plan: hidden categories are dropped and a
   create form that ignores paused saving is added. The summary does not record this.
5. One "new" CategoryPicker test passes without the change.

## Warnings

### WR-01: CurrencySelect drops `aria-describedby`; the account currency hints lose their association

**File:** `client/src/components/currency/CurrencySelect.tsx:17` (prop still declared), `:22-30`
(no longer destructured or forwarded)
**Issue:** The old component forwarded `aria-describedby` to the `<select>`. The new one keeps
`'aria-describedby'?: string` in `Props` but never reads it, and the shared `Select` has no such prop
(`Select.tsx:22-46`; its `description` is its own line, not an external id). Two callers still pass
it:
- `AddAccountModal.tsx:127`, for "This also becomes your budget's currency" and "Can't be changed
  once the account has transactions".
- `EditAccountModal.tsx:204`, the reason the field is disabled.

Both compile and silently lose the association on desktop and phone. This breaks D-15 ("Anything
else that would change is a finding") and the CLAUDE.md client rule on accessible fields. It is a
P1 broken contract and a dead prop.
**Fix:** Forward the id through the shared Select rather than dropping it. Add
`'aria-describedby'?: string` to `Select` Props, pass it to `<AriaSelect aria-describedby=…>` (React
Aria's `useField` merges it with its own description ids). In `NativeSelect`, join it with
`describedByIds(lineId, description, error)`. Then pass it from CurrencySelect:
```tsx
<Select … aria-describedby={describedBy} />
```
Add a Select.test.ts case that renders with `aria-describedby="x"` and asserts the trigger or select
carries `x`. If the shared Select must not change in this plan, record it as a finding for the
Select owner, and do not leave the prop declared but ignored.

### WR-02: CurrencySelect width regex treats `max-w-xs` as a width, so Budget currency loses `w-full`

**File:** `client/src/components/currency/CurrencySelect.tsx:53-55`; caller
`client/src/components/settings/CurrencySettings.tsx:94`
**Issue:** `/\bw-/.test(className)` matches any `w-` after a word boundary, including `max-w-xs` and
`min-w-0` (checked: `node -e 'console.log(/\bw-/.test("max-w-xs"))'` prints `true`). Before, the
Budget currency field was `block w-full … max-w-xs`, a 20rem field in its `flex flex-wrap` row. Now
CurrencySettings passes `className="max-w-xs"` and gets no `w-full`. The `AriaSelect` box is a flex
item with no width, so it shrinks to its value's text and resizes as the chosen currency changes.
That visible layout change is not accepted by D-03 or D-15. The heuristic is also a second
width rule beside the shared Select's own "full width unless the caller gives its own"
(`Select.tsx:42-43, 74`).
**Fix:** Drop the heuristic and pass the caller's class through as the shared Select intends. Have
the caller say what it means: `className="w-full max-w-xs"` at CurrencySettings.tsx:94, with
CurrencySelect defaulting `className = 'w-full'`. If CurrencySettings is out of this plan's files,
match only real width utilities:
`/(^|\s)w-/.test(className)`.

### WR-03: `ComboboxOption` / `ComboboxGroup` duplicate `ListOption` / `ListGroup` and are never used

**File:** `client/src/components/ui/Combobox.tsx:28-31, 35`; duplicates
`client/src/components/ui/listItems.tsx:9-12`
**Issue:** The same commit adds `ComboboxOption = SelectOption & { icon?; trailing? }` and
`ComboboxGroup` in Combobox.tsx, and `ListOption` / `ListGroup` with the identical shape in
listItems.tsx. `grep -rn "ComboboxOption\|ComboboxGroup" client/src e2e` finds only their
definitions and the `items` prop union, so nothing imports them. The union
`ComboboxOption | ComboboxGroup | SelectGroup` also repeats `SelectGroup`, which `ComboboxGroup`
already covers structurally. CLAUDE.md counts this twice: "one implementation per behaviour … a
parallel version … is P1" and "unused exports" (P2). Two names for one shape will drift the first
time someone adds a field, such as `description`, to one of them. `SearchListOption`
(`Combobox.tsx:258`) is a third near-copy that predates this change.
**Fix:** Delete both Combobox types and import the listItems ones:
```ts
import { listItems, type ListGroup, type ListOption } from './listItems';
…
items: readonly (ListOption | ListGroup)[];
```
Optionally define `SearchListOption` as `Omit<ListOption, 'trailing'>`, or as `ListOption`.

### WR-04: CurrencyDifference changes behaviour beyond the plan, and the summary does not record it

**File:** `client/src/components/currency/CurrencyDifference.tsx:84-92`, via
`client/src/components/transactions/CategoryPicker.tsx:43` and `:206` (`CreateCategoryForm`)
**Issue:** D-15 allows only a change of component. Moving to CategoryPicker changes two other things:
- **Hidden categories are gone.** The old `<select>` listed every category in `choices`, hidden ones
  included. CategoryPicker filters `!c.hidden || c.id === value`, so a hidden income or expense
  category can no longer be chosen for the correction.
- **A new create path appears.** The picker's footer offers "Create new category" (limited to the
  gain or loss groups). `CreateCategoryForm` does not consult `useCanSave`
  (`grep -n canSave CategoryPicker.tsx` finds nothing). So this dialog, whose own save button pauses
  while saving is paused, now offers a server write that does not pause.

The CreateCategoryForm gap predates this change on other callers. This plan newly exposes it on one
more screen, and neither change is in the summary's "Deviations".
**Fix:** Record both changes in the summary for the owner (D-15: "a finding to raise, not a change to
make"). Either accept them explicitly, or keep parity: add an opt-out to CategoryPicker and
CategorySelectButton (for example `allowCreate?: boolean`, default true) and pass it as false here.
Separately, gate `CreateCategoryForm`'s Create button on `useCanSave()` and show
`<SavingPausedHint />`. That fix benefits every CategoryPicker caller.

### WR-05: One new CategoryPicker test passes without the change; the button's `groups` forwarding to the picker is untested

**File:** `client/src/components/transactions/CategoryPicker.test.ts:272-282` ("limits sections to
the provided groups only")
**Issue:** The test calls `categoryList({ groups: [GROUPS[1]], … })`. At dd7f3482, `categoryList`
already builds sections only from the `groups` it is given, so this test passes before the change.
The summary's RED run shows it: "7/26 failed, 19 existing passed", but only 18 tests existed at the
base (`git show dd7f3482:…CategoryPicker.test.ts | grep -c "it("` prints 18), so 8 were added and 1
of them passed while RED. The plan's acceptance criterion "The new CategoryPicker tests failed
before the props existed" is therefore false for this test. The behaviour the plan asked for,
CategorySelectButton's `groups` replacing `useCategories()` for the picker's list, has no test.
The button tests cover only the shown name, because the picker is not rendered while the button is
closed.
**Fix:** Replace the test with one that fails at the base. For example, export the button's list
inputs, or render CategorySelectButton open (an `initialOpen` test seam, or a pure helper that
returns the groups it hands to CategoryPicker). Then assert that with `groups=[Bills]` the list holds
only Bills while the mocked `useCategories()` returns all groups. Correct the summary's RED line.

## Info

### IN-01: `UNSTABLE_portalContainer` now has a second caller

**File:** `client/src/components/ui/Combobox.tsx:240-244`
**Issue:** The orchestrator flagged this. It is not new to the codebase: `SearchList` in the same file
already used it at the base (`git show dd7f3482:…/Combobox.tsx:541`), and it is a typed prop in
react-aria-components 1.22.1 (`Popover.d.ts:49`). A rename on upgrade would fail `tsc`, not
silently. The risk is upgrade churn in two places instead of one.
**Fix:** None required. Optionally note the two callers in one comment, so a React Aria upgrade
checks both.

### IN-02: Already-defended-elsewhere: `isPending` re-check inside a disabled button's click handler

**File:** `client/src/components/transactions/MerchantSelect.tsx:131-134`
**Category:** necessity
**Issue:** The button is `disabled={createPayee.isPending}`, and a disabled button fires no click.
The guard reads the same render's `isPending` from its closure, so it cannot catch a second click
before the re-render either.
**Fix:** Remove the `if (createPayee.isPending) return;` line, or keep it with a comment if a
specific path needs it.

### IN-03: `extraItem` joins the keyboard order while searching, unlike the no-category row

**File:** `client/src/components/transactions/CategoryPicker.tsx:177-182` (pinned
`inKeyboardOrder: !query || extraMatchesQuery`) and `:162-168` (extra section with `allowNone`)
**Issue:** The no-category row is deliberately kept out of the arrow-key order while searching, "so
Enter on a search never picks it" (`categoryKeyboardOrder`, T-02-24). `extraItem` is in the order
whenever its label matches the query, and SearchList highlights the first match. For the
ImportCategories sentinel `Create "Coffee" as new`, typing "co" and pressing Enter picks the create
sentinel ahead of an existing "Coffee Shops" category. It is highlighted, so it is not a hidden
pick, but it diverges from the established rule. Later plans (03-11, 03-17, 03-25) inherit it.
**Fix:** Decide deliberately. Either keep `extraItem` out of keyboard order while a query is typed,
as the none row is, or document why sentinels differ and add a test that pins the chosen behaviour.

### IN-04: CurrencySelect's accessible name changes from "Currency" to "<value> Currency"

**File:** `client/src/components/currency/CurrencySelect.tsx:58-66`; `e2e/tests/currencies.spec.ts:27, 50, 135`
**Issue:** React Aria's Select labels its trigger with `aria-labelledby="<valueId> <selfId>"`
(`react-aria/dist/private/select/useSelect.mjs:118-122`), so the name becomes, for example,
"EUR · Euro Currency". The specs therefore moved to `/\bCurrency$/`. At `:135` that regex tells
"Currency" apart from "… Budget currency" only by letter case, which is fragile if either label is
re-cased. This comes from the Phase 2 shared Select rather than this plan, but D-15 lists "accessible
names stay the same".
**Fix:** Record it as an accepted consequence of D-05 in the PR. At `:135`, scope the locator to the
rate form, for example `page.getByRole('form'…)` or the `#rate-currency` label, rather than relying
on case.

### IN-05: Pre-existing: a failed "Create new payee" is silent

**File:** `client/src/components/transactions/MerchantSelect.tsx:135-138`
**Issue:** `createPayee.mutate` has no `onError`, and `useCreatePayee` (`hooks/usePayees.ts:12-30`)
has none either. A failed create re-enables the button and shows nothing, against CLAUDE.md's "No
`catch` that silently drops a failed write". The base code had the same gap.
**Fix:** A later plan could show an error line in the footer when `createPayee.isError`.

### IN-06: The CurrencyDifference e2e covers only the loss direction

**File:** `e2e/tests/currencies.spec.ts:258-292`
**Issue:** The new test proves that a loss offers expense categories and hides Paychecks. The gain
branch (`(g.isIncome === 1) === gain`, `CurrencyDifference.tsx:43`, income groups only) is not
exercised.
**Fix:** Optionally add the mirror case: a rate that strengthens USD, where Paychecks shows and
Groceries does not.

---

### Counts by severity
- Critical: 0
- Warning: 5
  - WR-01 `client/src/components/currency/CurrencySelect.tsx:17`: `aria-describedby` declared but dropped (callers `AddAccountModal.tsx:127`, `EditAccountModal.tsx:204`)
  - WR-02 `client/src/components/currency/CurrencySelect.tsx:53`: `/\bw-/` matches `max-w-xs`, so Budget currency loses `w-full`
  - WR-03 `client/src/components/ui/Combobox.tsx:28`: unused `ComboboxOption`/`ComboboxGroup` duplicate `listItems.tsx:9-12`
  - WR-04 `client/src/components/currency/CurrencyDifference.tsx:84`: hidden categories are dropped and a create form that ignores paused saving is added, unrecorded (D-15)
  - WR-05 `client/src/components/transactions/CategoryPicker.test.ts:272`: a new test passes at the base; the button's `groups` forwarding is untested
- Info: 6 (1 necessity)

_Reviewed: 2026-11-19T02:36:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
