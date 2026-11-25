---
phase: 03-screens-on-shared-controls
plan: 21
subsystem: ui
tags: [wave-g, g3, files, wavg-06, shared-controls]
requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-16 G3 reconcile record (G3 reconcile: match) and the 03-21 gate baseline (6)'
provides:
  - 'Files page filters on the shared Input, Select and DatePicker'
  - 'File details dialog on the shared controls, with a kind-switched link picker (CategorySelectButton for categories, Combobox for accounts, goals and assets)'
affects: [03-23]
tech-stack:
  added: []
  patterns:
    - 'A DatePicker whose value comes from the URL keeps the day in page state too, so the picker gets its value back in the same render it reports it'
    - 'A shared Select "any" choice uses its own value (any), mapped to no URL parameter, since the Select holds no empty option'
key-files:
  created: []
  modified:
    - client/src/pages/Files.tsx
    - client/src/components/files/FileDetailModal.tsx
    - e2e/tests/files.spec.ts
key-decisions:
  - 'The category link uses CategorySelectButton with categoryIds leaving out categories already linked (the old select disabled them), allowCreate off, includeHidden on (the old list showed hidden categories)'
  - 'The Combobox for accounts, goals and assets is controlled: value is the target being linked, back to none in finally, so a failed link leaves the picker empty to try again'
  - 'Files From and To are held in page state as well as the URL: read straight from the URL, typing a day of two figures lost the second one (found by the new spec)'
requirements-completed: [WAVG-06]
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: a19a7b5512ea7dbeefbb4b085dda9540c0d2c6e8
commits: 2
actuals:
  tokens: 5100
  tasks: 2
  commits: 2
duration: 95min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 21: Files on the shared controls Summary

**The Files page filters and the file details dialog now use only shared controls. Search is the shared Input with a clear button. Kind is the shared Select with "Any kind" first. From and To are the shared DatePicker and bound each other. In the dialog, date is a DatePicker and description a Textarea. The link picker is switched by kind: CategorySelectButton for a category, the shared Combobox for an account, goal or asset. The drop zone's file input stays native (D-17).**

## Tasks

| Task | Commit | What changed |
| --- | --- | --- |
| 1: Files page filters and the attach search | `c0a92703` | `Files.tsx`: search on Input `sm` with the Search icon and a "Clear file search" button (`pl-8 pr-8 max-md:pr-11`, 32 px / 44 px target). Kind on the shared Select `sm` (`KIND_LABELS`, "Any kind" first). From and To on DatePicker `sm` (hidden label, optional, From's max is the To day and To's min the From day). The storage limit was already the shared Input (`inputMode="numeric"` kept), so it is unchanged. `FilesSection.tsx`: the attach search was already the shared Input, so it is unchanged. |
| 2: File details dialog | `a19a7b55` | `FileDetailModal.tsx`: the link target is `CategorySelectButton` when the link kind is category, otherwise the shared `Combobox` over that kind's accounts, goals or assets. It is controlled, with no `defaultValue`, and calls the same `link.mutateAsync`. Date is DatePicker (optional, saves in onChange as before). Description is Textarea (rows 2, resizes vertically), its label tied by `useId`. Name and New label stay the shared Input. |

## Verification

| Check | Result |
| --- | --- |
| Precondition `grep -c '^G3 reconcile: match$' 03-16-SUMMARY.md` | 1 |
| `npm --prefix e2e test -- --project=desktop tests/files.spec.ts` (Task 1) | 5 passed |
| `npm --prefix e2e test -- --project=desktop tests/files.spec.ts tests/receipts-tax.spec.ts` (Task 2) | 7 passed |
| Leftover-control perl gate over the three Files files | **0** (HEAD value 6) |
| `FileParts.tsx` `type="file"` count | 1 (unchanged) |
| `npm --prefix lint test` / `npm --prefix lint run lint` | 86/86; 0 errors, 122 warnings (cap 122, not raised) |
| `cd client && npx tsc --noEmit`; `npm --prefix client test` | exit 0; 947/947 |

## Selector changes

No existing selector changed. `files.spec.ts` only used names that are still the same: "Search files" (still a `textbox`, since the Input has no `type="search"`), "New label", "Search transactions", "Add files: choose files". These are the new selectors, each with its reason:

- `getByRole('button', { name: 'Clear file search' })`: the new clear button on the search field.
- `chooseOption(page.getByRole('button', { name: /Kind of file/ }), …)`: Kind is now the shared Select. Its desktop trigger is a button named by its value and label, so D-05 uses `chooseOption`, not `selectOption`.
- `fillDate(page, 'From' | 'To', …)` and `getByRole('button', { name: 'Clear From' | 'Clear To' })`: From and To are now DatePickers (D-07). The days are fixed two-figure days (25) so the test types both figures.
- `fillDate(dialog, 'Date', …)`: the details date is now a DatePicker (D-07).
- `getByRole('textbox', { name: 'Description' })`: the Textarea, named by its tied label.
- `getByRole('button', { name: 'Category: Choose a category…' })` and `categoryOption(page, …)`: the category link is now CategorySelectButton, whose accessible name is `${label}: ${shown}`, and its rows are CategoryPicker options.
- `getByRole('combobox', { name: 'Choose a account' })`: the account link is now the shared Combobox. It keeps the old select's aria-label, `Choose a ${noun}`, word for word.

## Stays native

- `client/src/components/files/FileParts.tsx:202`: `<input type="file">`, the drop zone's hidden file picker (D-17). It is unchanged and the gate excludes it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] From and To lost the second figure of a typed day**
- **Found during:** Task 1, the first run of the new filter spec. Typing "21" into From left "02".
- **Issue:** The DatePicker holds the day it reports and needs the caller's value to match in the same render. Files read From and To straight from the URL, and the URL catches up a render later. The picker's next render saw the stale value and reset itself, so the second figure was lost.
- **Fix:** From and To are held in page state, set in onChange together with the URL write. This is the pattern the search box already uses. The filter still reads the URL.
- **Files modified:** `client/src/pages/Files.tsx`
- **Commit:** `c0a92703`
- **Test:** the filter spec types day 25 into From and To. It failed before the fix (the same spec with day 21) and passes after it.

**2. [Rule 3 - Blocking] The description label's lint warning**
- **Issue:** A label wrapping `Textarea` is a new `jsx-a11y/label-has-associated-control` warning, because the lint config lists `Input` but not `Textarea` as a control component. That took lint to 123 warnings, over the cap of 122.
- **Fix:** The label is tied to the Textarea by `htmlFor`/`id` (`useId`), as `TransactionDetailPanel` does. `lint/eslint.config.js` is outside this plan's files, so it was not changed.
- **Commit:** `a19a7b55`

## Notes for the owner and the G3 PR

- The non-category link picker keeps the old accessible name `Choose a ${noun}`. That reads "Choose a account", "Choose a asset" and "Choose a working from home". It was left as it was because the plan says to keep labels as today. It is a one-line fix if wanted.
- The "Working from home" link kind has no entities in this picker, the same as the old select (its Combobox shows "No matching options").
- CategorySelectButton has no disabled state, so a category can be picked again while a link is still saving. The Combobox is disabled while one saves, as the select was.
- The DatePicker's stale-value reset (Deviation 1) can affect any caller that feeds it a value updated a render later, such as other URL-driven pickers. `TransactionFilters` keeps its state in React state, and its spec types day "01", whose first figure does not complete a day. Worth a check in 03-23.
- The details dialog's Date label uses the shared Label style. Name and Description keep the smaller `text-xs` secondary labels they had. The plan did not ask to restyle them.

## Self-Check: PASSED

- FOUND: client/src/pages/Files.tsx, client/src/components/files/FileDetailModal.tsx, e2e/tests/files.spec.ts
- FOUND: c0a92703, a19a7b55 (both ancestors of HEAD)
