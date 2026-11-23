---
phase: 03-screens-on-shared-controls
plan: 03-04
iteration: 2
reviewed: 2026-11-19T04:12:00Z
depth: standard
diff_base: a7ff8184
head: e9909251
worktree: .claude/worktrees/agent-p0304-a1
files_reviewed: 11
files_reviewed_list:
  - client/src/components/currency/CurrencyDifference.tsx
  - client/src/components/currency/CurrencySelect.tsx
  - client/src/components/currency/CurrencySelect.test.ts
  - client/src/components/transactions/CategoryPicker.tsx
  - client/src/components/transactions/CategoryPicker.test.ts
  - client/src/components/transactions/CategorySelectButton.tsx
  - client/src/components/ui/Combobox.tsx
  - client/src/components/ui/Combobox.test.ts
  - client/src/components/ui/Select.tsx
  - e2e/tests/currencies.spec.ts
  - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-04-SUMMARY.md (claims only)
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
  necessity: 0
status: issues_found
---

# Phase 03: Code Review Report (plan 03-04, iteration 2)

**Reviewed:** 2026-11-19T04:12:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found (one warning, no blocker)

## Summary

I reviewed `git diff a7ff8184..HEAD` in the executor worktree (commits 23eb60c5, 76264761, 80e2cc5e,
8fb4f62c, 849678fa, 627f031a, e9909251). Checks, all read-only:

- `vitest run` on CurrencySelect, CategoryPicker, Combobox, Select and MerchantSelect tests: 5 files, 95/95 passed.
- Full client suite (`npm test --prefix client`): 95 files, 890/890 passed. This confirms the
  `useCanSave` gate breaks no mounted gallery test. The store defaults to `connected`, and the
  gallery passes `onCreate`.
- `client: tsc --noEmit`: exit 0.

I did not run e2e. The worktree has no tracked changes. The only untracked file is another job's
hdispatch result.

**Iteration-1 findings: all six are fixed.**

| Finding | Fix | Test fails without the fix? |
|---|---|---|
| WR-01 aria-describedby dropped | `Select.tsx:47,91` passes it to `AriaSelect`. `NativeSelect` (`:176-185`) joins it with `describedByIds(...)`. `CurrencySelect.tsx:29,66` forwards it, so `AddAccountModal:127` and `EditAccountModal:204` are associated again. | Yes. All 3 tests in `CurrencySelect.test.ts:20-84` fail at the base, because neither component forwarded the prop. The merge case shows the React Aria and native branches keep their own description id. |
| WR-02 `/\bw-/` matched `max-w-xs` | `/(^|\s)w-/` (`CurrencySelect.tsx:55`). `w-48` (rate form) still drops `w-full`, and `max-w-xs` (Budget currency) keeps it. | Yes for `max-w-xs` and `min-w-0`. The `w-48` and default cases are pins, and the summary records this honestly ("1/5 failed"). |
| WR-03 duplicate Combobox option types | Deleted. `items: readonly (ListOption \| ListGroup)[]`, and `SearchListOption = Omit<ListOption,'trailing'>`. Existing `SelectGroup` callers still type-check (tsc 0). | Yes, through a source-text assertion (see IN-01). |
| WR-04 parity and unpaused create | `includeHidden` (`CategoryPicker.tsx:38,48,135,385`) and `allowCreate` (`:403`) are opt-ins, and CurrencyDifference passes `allowCreate={false} includeHidden` (`:92-93`). `CreateCategoryForm` gates both buttons and `handleCreate` on `useCanSave()` with `<SavingPausedHint />`, bypassed only for a local `onCreate` (`:233-235,250,271,277,327,333`). | Yes. The `includeHidden` test and both paused-form tests fail at the base: the form was not exported and not gated. The e2e test seeds a hidden "Retired FX" through `PUT /categories/:id {hidden:1}`. `categoryEditSchema` is `.partial()` of a schema with no `.default()`, so the PUT is safe. It asserts the row shows and that "Create new category" has count 0. |
| WR-05 vacuous groups test | The base-passing `categoryList` test is removed. `categoryButtonPickerProps` is extracted and spread into the picker (`CategorySelectButton.tsx:143`), and the new test asserts that `groups=[Bills]` wins over the fetched groups. | Yes, because the helper did not exist at the base. |
| IN-04 case-only locator | `currencies.spec.ts:135-140` scopes the locator to the `<form>` that holds "Add rate", which contains exactly one CurrencySelect (`CurrencySettings.tsx:223-272`). The reason is in the summary's selector table and in a code comment. | The e2e test is the fix. The new unit test at `CurrencySelect.test.ts:113-137` is a pin that passes at the base, which is acceptable for a locator fix. |

Must-haves and prohibitions still hold. No money field is touched and no `type="number"` is added.
The new Select prop is optional and additive. The shared CreateCategoryForm gate is correct for
every CategoryPicker caller, not only CurrencyDifference.

## Warnings

### WR-01: `categoryButtonPickerProps` restates CategoryPicker's defaults, making a third copy

**File:** `client/src/components/transactions/CategorySelectButton.tsx:38-64`, with
`CategoryPicker.tsx:380-385` (defaults) and `CategorySelectButton.tsx:103` (`entry` memo)
**Issue:** The helper bakes in `allowNone ?? true`, `noneLabel ?? 'Uncategorised'`,
`allowCreate ?? true`, `includeHidden ?? false` and `transferAccounts ?? []`. These defaults are
already owned by CategoryPicker's destructuring. The button's `entry` memo keeps a third copy
(`noneLabel ?? 'Uncategorised'`) and still reads the raw `allowNone`, not `picker.allowNone`.

Concrete consequences:
- (a) Change a default in CategoryPicker, say `noneLabel`, and the button path keeps the old one,
  because the helper always sends a defined value.
- (b) With `allowNone` omitted and `value === null`, the picker pins "Uncategorised" (the helper
  sends `true`) while the closed button shows no name (`entry` sees `undefined`).

(b) is pre-existing at the base, but the helper now computes the right value and the memo ignores
it. CLAUDE.md lists this pattern as P2 drift: constants must live in one place.
**Fix:** Have the helper resolve only what the button owns, and let undefined fall through to the
picker's defaults:
```ts
return { ...props, groups: props.groups ?? (fetchedGroups as CategoryGroup[]) };
```
Alternatively, export the defaults from CategoryPicker and use them in both places. In either case,
make `entry` read `picker.allowNone` / `picker.noneLabel` (or the shared constants), so the closed
button and the open picker cannot disagree. The WR-05 test still holds, because it asserts `groups`.

## Info

### IN-01: The WR-03 guard is a source-text grep

**File:** `client/src/components/ui/Combobox.test.ts:108-109`
**Issue:** `expect(comboboxSource).not.toMatch(/\bComboboxOption\b|\bComboboxGroup\b/)` on
`Combobox.tsx?raw` would fail if a comment merely mentions the old names, and it guards a structural
rule rather than behaviour. `?raw` has precedent in this repo (`utils/guides.test.ts`), so this is
acceptable. The type-level half (`ListOption`/`ListGroup` items render) is the durable part.
**Fix:** None required. Optionally drop the grep and rely on the typed `items` case plus lint's
unused-export check.

### IN-02: The e2e test asserts the `aria-label` attribute, not the accessible name

**File:** `e2e/tests/currencies.spec.ts:139` (`toHaveAttribute('aria-label', 'Currency')`)
**Issue:** Selection is by role within the form, which is good. The extra attribute check pins an
implementation detail: React Aria names the trigger through `aria-labelledby`, so its computed name
is "<value> Currency". The check would break if the label moved to `aria-labelledby`, even though
the person-facing name would not change.
**Fix:** Optional: drop the `aria-label` assertion. The form scope and `aria-haspopup` already
identify the field.

---

### Counts by severity
- Critical: 0
- Warning: 1
  - WR-01 `client/src/components/transactions/CategorySelectButton.tsx:38`: `categoryButtonPickerProps` restates the CategoryPicker defaults, and the `entry` memo at `:103` still reads the raw `allowNone`
- Info: 2
- Iteration-1 WR-01..WR-05 and IN-04: all fixed, each with a test that fails without the fix (IN-04 by its e2e locator).

_Reviewed: 2026-11-19T04:12:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
