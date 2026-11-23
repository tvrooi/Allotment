---
phase: 03-screens-on-shared-controls
plan: 25
subsystem: ui
tags: [wave-g, g3, import, ynab, category-picker, combobox, select, d-05, d-06, d-17]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'G3 reconcile: match (03-16); ImportModal on the shared controls (03-22); CategorySelectButton extraItem/allowNone pass-through (03-04)'
provides:
  - 'YnabImportModal.tsx on the shared Select, Combobox and Input; only the native file input is left'
  - 'ImportCategories.tsx on CategorySelectButton (deferred "Create … as new" item) and the shared Combobox for the group'
  - 'With 03-22, every import dialog is on the shared set apart from its native file input (three-file gate 0)'
affects: [03-23]
tech-stack:
  added: []
  patterns:
    - 'A deferred-create choice in a category picker is an extraItem with allowCreate={false}, so the picker cannot create anything early'
    - 'A table that holds CategorySelectButton has no scroll box of its own: the picker draws inside the button wrapper and a scroll box clips it'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-25-SUMMARY.md
  modified:
    - client/src/components/transactions/YnabImportModal.tsx
    - client/src/components/transactions/ImportCategories.tsx
    - e2e/tests/switchers.spec.ts
key-decisions:
  - 'Date format and Amount format are the visible labels (were Dates and Amounts), so the accessible name the UI-SPEC asks for matches the visible text'
  - 'The mapping target turns allowCreate off: CategoryPicker''s create form would make a category before the import runs'
  - 'includeHidden on the mapping target: the native select listed every category, hidden ones too, and old history may belong in a retired category'
  - 'The mapping table is two columns, with the group Combobox under its target: the shared Combobox is wider than the 12 px select and three columns ran past the lg dialog and a 390 px screen'
requirements-completed: []
plan_head_before: 24909a70e8553fc897b4d6e5883ac16a571f376c
plan_head_after: 91ad6a46
commits: 2
actuals:
  tokens: 4900
  tasks: 2
  commits: 2
duration: 70min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 25: YNAB import and category mapping on the shared controls Summary

**The YNAB import now uses the shared Select for Date format and Amount format, the shared Combobox for each account's target (Create a new account first), and the shared Input for the new account's name. The import category mapping uses CategorySelectButton for each target, with Uncategorised and a deferred "Create “…” as new" item, and the shared Combobox for a new category's group. Nothing is created before the import runs. Both bank file inputs stay native.**

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | `a17cb9d1` | feat(03-25): move the YNAB import onto the shared controls |
| 2 | `91ad6a46` | feat(03-25): move the import category mapping onto the shared controls |

`plan_head_after` is `91ad6a46`, the Task 2 commit. The SUMMARY commit comes after it.

## Behaviour changes

- **YNAB formats.** Date format and Amount format are React Aria Selects on desktop and native selects on phones (D-04).
  - The visible labels now read "Date format" and "Amount format" (were "Dates" and "Amounts"), matching the names the UI-SPEC gives them.
  - Unset, they show "Choose…" as before. The option labels and values are unchanged.
- **YNAB account target** is a Combobox (D-06). It opens on focus, as the select did. "Create a new account" is its first item, then "Add to {name}" for each open account. Clearing the text is not a choice: the target stays as it was. It is still disabled while importing and once that account is done.
- **New account name** is the shared Input, with the same name, `maxLength` 200 and disabled state.
- **Mapping target** is CategorySelectButton (D-05), named "Category for {bank label}: {shown}".
  - It offers "Uncategorised", "Create “{name}” as new" (the deferred item), then every category by group, hidden ones included as before.
  - Its create form is off (`allowCreate={false}`), so the only way to a new category is the deferred item. That item still creates the category, and a new group if one was chosen, only in `resolveCategoryChoices`, when the import runs.
- **Group for a new category** is a Combobox named "Group for {bank label}". It lists the existing groups, then the "New group “…”" choices, worded as before.
  - It now sits under its target, after a small "in", instead of in a third column.
  - The table has two columns, "In your file" (a third of the width) and "In Allotment". It no longer has its own 18 rem scroll box: the dialog scrolls instead. The category list draws inside the button's wrapper, so the old scroll box cut it off.
  - The header is no longer sticky, because nothing inside the table scrolls now.
- Import results are unchanged: same rows, stable IDs, deleted-import handling, accounts and categories. `suggestChoices`, `resolveCategoryChoices` and `runImport` were not touched. The import specs show this: the CSV mapping import, the YNAB multi-account import with its linked transfer, and the YNAB-then-Up flow all pass.

## Selector changes

| Spec line (now) | Was | Now | Reason |
| --- | --- | --- | --- |
| switchers.spec.ts:53-55 | `combobox 'Category for Food & Dining: Groceries'` `toHaveValue(groceryId)` | `button …` `toHaveText('Groceries')` | CategorySelectButton is a button; its text is the matched category's name |
| switchers.spec.ts:56-57 | `combobox 'Category for Bills: Landlord Fees'` `toHaveValue('__new')` | `button …` `toHaveText('Create “Landlord Fees” as new')` | The deferred item is now an extraItem; the trigger shows its text |
| switchers.spec.ts:58-59 | `combobox 'Group for Bills: Landlord Fees'` `toContainText('New group “Bills”')` | same role and name, `toHaveValue('New group “Bills”')` | The shared Combobox's role is its input; the chosen group is the input's value |
| switchers.spec.ts:60-69 (new) | none | picks Uncategorised (the group field goes), then Create “Landlord Fees” as new again (the group returns) | Exercises the deferred item through the picker before the no-Bills check, so choosing it is shown not to create anything |
| switchers.spec.ts:70 | kept | kept | No 'Bills' group before the import (with lines 80-90 after it, the deferred-create proof) |
| switchers.spec.ts:153-154 | `combobox 'Date format'` `toHaveValue('dmy')` | `button 'Date format'` `toHaveText('DD/MM/YYYY')` | The shared Select's desktop trigger is a button showing the chosen label |
| switchers.spec.ts:155 (new) | none | `button 'Amount format'` `toHaveText('1,234.56')` | UI-SPEC names it; the plan asks that it be found by role and name |
| switchers.spec.ts:156-159 (new) | none | `combobox 'Allotment account for Everyday'` `toHaveValue('Create a new account')` | The moved account target is found by role and name and keeps its first item |
| switchers.spec.ts:160 | kept | kept | 'Name for Everyday' is still a textbox with the same name and value |
| switchers.spec.ts:162-164 | `combobox 'Category for Transport: Fuel'` `toHaveValue(gasFuelId)` | `button …` `toHaveText('Gas / Fuel')` | CategorySelectButton is a button |

`data.spec.ts` was not edited; it passes unchanged. The bank-connection lines (Phase 4) were not touched.

## Stays native

- `client/src/components/transactions/YnabImportModal.tsx`: the YNAB register file input, `<input id="ynab-file-input" type="file">` (D-17, the browser's file dialog). The perl gate excludes it.
- `client/src/components/transactions/ImportModal.tsx`: its bank file input, unchanged from 03-22.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix e2e test -- --project=desktop tests/switchers.spec.ts tests/data.spec.ts` | 34 passed, exit 0 (after each task) |
| `npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts` | 14 passed |
| `grep -c "'combobox', { name: 'Date format' }"` switchers.spec.ts | 0 |
| `grep -c "name: 'Amount format'"` switchers.spec.ts | 1 |
| `grep -c "getByRole('combobox', { name: 'Category for"` switchers.spec.ts | 0 |
| `grep -c "toHaveValue('__new')"` switchers.spec.ts | 0 |
| `grep -cF "g.name === 'Bills')).toBe(false)"` switchers.spec.ts | 1 |
| perl raw-control gate over ImportModal, YnabImportModal, ImportCategories | 0 (was 6 at base); one `type="file"` in each of ImportModal and YnabImportModal |
| `npm --prefix lint test` / `npm --prefix lint run lint` | pass; 0 errors, 122 warnings = cap. YnabImportModal's 2 are the existing drop zone div |
| `cd client && npx tsc --noEmit` | exit 0 |
| `npm --prefix client test` | 103 files, 950 tests passed |
| client `vite build` | exit 0 |
| Prettier 3.9.10 on the changed files | formatted |
| Screens checked by Playwright screenshot | CSV mapping (lg dialog) and YNAB dialog (xl) at desktop and at 390 px, list open and closed. No sideways scroll; the category list opens whole |

Run on Node 24. node_modules are symlinks to the main checkout's installs (ignored, not committed). The client was built into a private cache (`TMPDIR=/tmp/fb0325`), and the e2e runs used `E2E_SKIP_BUILD=1` after checking that ports 3169-3180 were free.

## Deviations from Plan

1. **[Rule 1 - bug caused by the change] The mapping table's scroll box and third column were removed.** The first desktop screenshot showed the CategorySelectButton list cut off by the table's `overflow-x-auto max-h-72 overflow-y-auto` box. CategoryPicker draws inside the button's wrapper, and its `anchor` option is not exposed by CategorySelectButton, which is outside this plan's files. With the box gone, the wider shared Combobox pushed the Group column past the `lg` dialog. The group now sits under its target, in two columns. Recorded under Behaviour changes. Its accessible name, "Group for {bank label}", is unchanged.
2. **[Rule 2 - correctness] `allowCreate={false}` on the mapping target.** CategoryPicker's default create form would make a category at once, before the import runs. The prohibition forbids that.
3. **[Rule 2 - coverage] Two spec additions.** The switchers spec now finds the account Combobox, and it picks in the mapping list (Uncategorised, then back to the deferred item) before the no-Bills check. Before, no spec chose anything in either control.
4. **Visible format labels** changed from "Dates"/"Amounts" to "Date format"/"Amount format". The plan names them by the Select's label. Keeping "Dates" visible with a different accessible name would break label-in-name.
5. **CategorySelectButton stays md height** in the mapping table. The UI-SPEC lists ImportCategories among the sm fields, but CategorySelectButton has no size prop, and it is outside this plan's files. The group Combobox and the YNAB fields use sm.

## Known Stubs

None.

## Threat Flags

None. T-03-32 is mitigated. The deferred item carries the same `kind: 'new'` choice as before. `allowCreate={false}` removes the only other way to create a category from the list. Spec lines 60-70 and 80-90 show that no 'Bills' group exists after choosing the item, and that the category and its transactions exist after the import. T-03-SC: no package added.

## Self-Check: PASSED

- `client/src/components/transactions/YnabImportModal.tsx` contains `Combobox` (FOUND)
- `client/src/components/transactions/ImportCategories.tsx` contains `extraItem` (FOUND)
- Commits `a17cb9d1` and `91ad6a46` are ancestors of HEAD (FOUND)
- No STATE.md or ROADMAP.md change

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-21_
