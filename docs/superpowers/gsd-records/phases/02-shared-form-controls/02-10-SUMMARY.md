---
phase: 02-shared-form-controls
plan: 10
subsystem: client/ui
tags: [ui, form-controls, search-list, category-picker, e2e]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 09
    provides: "The shared Combobox, and popoverClass, listClass and optionClass"
  - phase: 02-shared-form-controls
    plan: 19
    provides: "The characterisation-first pattern for moving a hand-rolled control"
provides:
  - "client/src/components/ui/Combobox.tsx: SearchList, the shared searchable list popover (and SearchListBody, its contents, for unit tests)"
  - "client/src/components/transactions/CategoryPicker.tsx: categorySections, categoryKeyboardOrder and categoryListEmpty, used by the hand-rolled picker"
  - "e2e/tests/fixtures.ts: categoryOption, the one way specs locate a row of the category picker's list"
  - "Characterisation tests for the category picker (e2e/tests/transactions.spec.ts, 'category picker'), a Searchable list gallery card and its spec"
affects: [02-11, 02-17, 02-18, 02-20]
actuals:
  tasks: 2
  commits: 6
plan_head_before: 199c589
plan_head_after: 775c4e1
tech-stack:
  added: []
  patterns:
    - "SearchList is a React Aria Popover and Dialog holding a plain ARIA listbox that the search field drives through aria-activedescendant. It does not use React Aria's Autocomplete (see Decisions)"
    - "The highlighted row is derived, not set from an effect: { query, index } remembers an arrow move for the search it was made under, so a new search starts on its first match, or on nothing when empty"
    - "Escape is handled on the search field itself (preventDefault and stopPropagation), so neither the popover nor Modal.tsx sees it"
    - "Clicks are handled on the listbox (one handler, rows looked up by id) and mousedown is prevented there, so focus stays in the field"
key-files:
  created:
    - client/src/components/transactions/CategoryPicker.test.ts
    - client/src/pages/devGallery/PickerCards.tsx
    - e2e/tests/gallery/pickers.spec.ts
  modified:
    - client/src/components/ui/Combobox.tsx
    - client/src/components/ui/Combobox.test.ts
    - client/src/components/transactions/CategoryPicker.tsx
    - client/src/pages/DevControlsGallery.tsx
    - e2e/tests/fixtures.ts
    - e2e/tests/transactions.spec.ts
key-decisions:
  - "The pinned row renders with role option, the first option of SearchList's listbox. It is an option whether or not the keyboard reaches it: inKeyboardOrder only decides whether the arrow keys and Enter can land on it, and a click always picks it. Plans 02-17, 02-20 and 02-18 should give the hand-rolled no-category row (and every category row) the same role, option, so categoryOption's role changes from 'button' to 'option' in one place"
  - "SearchList's list is a hand-built ARIA listbox, not React Aria's Autocomplete over a ListBox (research Pattern 2 suggested Autocomplete). In 1.22.1, Autocomplete highlights the first item only after typed input (inputType insertText). It clears the highlight after a deletion, paste or fill, and its 'focus first' would land on the pinned row while searching. Both break the picker's rules (T-02-24). The popover, dialog, placement, outside-click dismissal and focus restore are still React Aria's"
  - "SearchListBody is exported for its unit test only: React Aria's Popover renders nothing in renderToStaticMarkup, so the section markup is tested on the contents"
  - "The ArrowDown characterisation test proves where the key landed by its outcome (Enter clears the category, which only the no-category row does), not by the hand-rolled data-active mark. Plan 02-18's wrapper can then pass it unchanged"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "SearchList: focus in a textbox on open, mixed-case filtering by the caller, Enter picks the first match, Enter with nothing typed picks nothing, the pinned row first for ArrowDown from empty and skipped while searching, empty text with the pinned row shown, Escape and outside click close with no pick and focus returns to the opener, a click picks"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/pickers.spec.ts"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/Combobox.test.ts#SearchList"
        status: pass
    human_judgment: false
  - id: D2
    description: "Today's CategoryPicker pinned: Enter with nothing typed, the no-category row while searching, ArrowDown from empty then Enter, a click outside, Escape inside the Add transaction dialog"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#category picker"
        status: pass
    human_judgment: false
  - id: D3
    description: "The category list rules as pure functions: hidden categories, empty groups dropped, the Transfer section, lower-cased substring matching (E-02 encoding), the caller's order (E-02 ordering), the keyboard order, the empty line"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/transactions/CategoryPicker.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The hand-rolled picker reads its rows from the functions with no visible change, through the suites that pick categories"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "desktop: transactions, review, payees, recurring"
        status: pass
    human_judgment: false
duration: 75min
completed: 2026-11-18
---

# Phase 02 Plan 10: SearchList and the pinned category picker Summary

**The shared searchable list, `SearchList`, now sits in `ui/Combobox.tsx` beside `Combobox`. The
controls gallery proves its keyboard rules. Today's category picker is pinned by
characterisation tests, and its list rules are pure, tested functions that the unchanged
hand-rolled picker reads. Specs locate the picker's rows through one helper, `categoryOption`.**

## Performance

- Duration: about 75 minutes (18 November 2026)
- Tasks: 2 of 2, in 6 commits
- Files: 3 created, 6 modified (the 9 in the plan, no others)

## Accomplishments

- `SearchList` (`client/src/components/ui/Combobox.tsx`) takes these props:
  - `triggerRef`, `onClose`, `searchLabel`, `searchPlaceholder`, `query` and `onQueryChange`
  - `sections` (`{ id, heading?, options: (SelectOption & { icon? })[] }[]`), `value` and
    `onPick(value)`
  - `pinned` (`{ label, isSelected, onPick, inKeyboardOrder }`), `emptyText` and `footer`
  - `placement` (`'bottom start' | 'top start'`), `width` (`'trigger'` or a width class) and
    `className`

  The caller filters the sections. The search field is `<input type="text">`, so its role is
  textbox. It takes focus on open. Options use `optionClass`, the popover uses `popoverClass` and
  the scroll area uses `listClass`. Headings are `text-xs font-medium text-text-tertiary
  bg-surface-alt`. The chosen option has a tick. `emptyText` shows when no section has an option,
  even while the pinned row shows.
- The pinned row's role is **option**: it is the first `role="option"` of the listbox, whether
  or not `inKeyboardOrder` puts it in the arrow-key order.
- The three list functions in `client/src/components/transactions/CategoryPicker.tsx`:
  - `categorySections(groups: readonly CategoryGroup[], transferAccounts: readonly { id: string; name: string }[], query: string, value: string | null | undefined): SearchListSection[]`
  - `categoryKeyboardOrder(sections: readonly SearchListSection[], query: string, allowNone: boolean): (string | null)[]`,
    where `null` stands for the no-category row
  - `categoryListEmpty(sections: readonly SearchListSection[]): boolean`

  The hand-rolled render reads its sections, its keyboard order and its empty line from them.
  No second copy of the filter or the order remains in the file. Icons are looked up by
  category id at render, so the functions stay pure data. Props, export, markup and behaviour are
  unchanged. None of the seven files that render the picker changed.
- `categoryOption(scope: Page | Locator, name: string | RegExp, options?: { exact?: boolean }): Locator`
  in `e2e/tests/fixtures.ts` returns `scope.getByRole('button', { name, exact })` today. It
  does not use the `api` fixture, so the demo spec can import it.
- In `transactions.spec.ts`, five category-row selectors now go through `categoryOption`, with
  the same name and `exact`: lines 193, 495, 520, 575 and 649, previously 184, 486, 511, 566 and
  640. Five characterisation tests were added under `category picker`. Nothing else in the file
  changed.
- Gallery: a "Searchable list" card (`client/src/pages/devGallery/PickerCards.tsx`). It has a
  button that opens a `SearchList` over two sample sections, with a pinned "No envelope" row
  that joins the keys only while nothing is typed. `e2e/tests/gallery/pickers.spec.ts` has 6
  tests for it.

## Deviations from Plan

1. **[Rule 2, a test made robust] The ArrowDown characterisation test.** It was first committed
   (`3142930`) with an assertion on the hand-rolled row's `data-active` attribute. A follow-up
   commit (`4305262`) removed that assertion, before any production change. The test now proves
   where ArrowDown landed by its outcome: Enter clears the category, which only the no-category
   row can do. It no longer depends on how a picker marks its highlight, so plan 02-18's wrapper
   can pass it as it is. It still passes on the unchanged picker.
2. **[Rule 3, blocking] Lint cap.** The first `SearchList` put `autoFocus` on the field and a
   click handler on each row, which added 3 jsx-a11y warnings (131 against the cap of 128). The
   fix is commit `775c4e1`:
   - the field is focused by ref in an effect
   - the listbox takes clicks with one handler that looks rows up by id, prevents mousedown (so
     focus stays in the field) and has `tabIndex={-1}`
   - if focus ever lands on the listbox itself, it answers the same keys as the field

   Lint is back at 128 warnings, all pre-existing.
3. **The unit test mocks `../../hooks/useCategories`.** Importing `CategoryPicker.tsx` reaches
   `api/base.ts`, which reads `window` at import. The list functions need neither, and the mock
   replaces only `useCreateCategory`.
4. **The outside-click gallery test clicks a page coordinate** (`page.mouse.click(8, 8)`), not
   the heading. The popover's modal underlay intercepts pointer events, which is the "a click
   never acts on what is behind" rule doing its job.

## Issues Encountered

- `node_modules` were missing in the worktree. `npm ci` was run in `client`, `server`, `e2e`,
  `lint` and the root, with install scripts still disabled. No `package.json` or lockfile changed.

## What plans 02-17, 02-20 and 02-18 can reuse

- The row role to switch to is `option`. Change it in `categoryOption` alone.
- The picker's panel trigger shares a row's name: the detail panel's category button reads
  "Groceries" while the row "Groceries" is open. Scope `categoryOption` to the panel and use a
  name only the list has, or the locator becomes ambiguous.
- `SearchList` already handles Escape inside `Modal.tsx`: preventDefault plus stopPropagation
  on the field.
- The anchored callers' trigger elements are what `triggerRef` should point at. The wrapper
  still owns the create-category footer (`footer`) and its widths (`width="w-64"`, or
  `'trigger'`).

## Verification

- `npm --prefix e2e test -- --project=gallery tests/gallery/pickers.spec.ts`: 6 passed.
  The whole gallery project: 77 passed, 2 skipped (the Linux-only pixel tests, `PIXELS`).
- `npm --prefix client test -- src/components/ui/Combobox.test.ts`: 28 passed, 9 of them new for
  SearchList.
- `npm --prefix client test -- src/components/transactions/CategoryPicker.test.ts`: 13 passed.
  It failed with `categorySections is not a function` at `f996d17`, before the functions
  existed.
- Negative case, run once and reverted: with `!query` removed from `categoryKeyboardOrder`, 2
  unit tests fail ("leaves the no-category row out while searching…" and the empty-line test).
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts`: 44 passed, on the
  unchanged picker (after Task 1) and again after Task 2.
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/review.spec.ts tests/payees.spec.ts tests/recurring.spec.ts`:
  67 passed, after Task 2.
- `(cd e2e && npx tsc --noEmit)`: clean.
- `npm --prefix client test` (all): 89 files, 772 tests passed. `npm --prefix client run build`:
  built.
- `npm --prefix lint test` passed. `npm --prefix lint run lint`: 0 errors, 128 warnings, within
  the cap of 128.
- `grep -c 'export function categoryOption' e2e/tests/fixtures.ts`: 1.
  `grep -c 'export function categoryKeyboardOrder' client/src/components/transactions/CategoryPicker.tsx`: 1.
- `git diff 199c589 41c4d5e -- client/src/components/transactions/CategoryPicker.tsx` is empty:
  the picker was untouched through Task 1. The seven user files show no diff from `199c589`.
  The plan's `origin/redesign...HEAD` checks were run against this worktree's base, `199c589`.

## Task Commits

1. `3142930` test(e2e): pin the category picker's behaviour before it moves onto the shared list (#267)
2. `4305262` test(e2e): assert where ArrowDown lands by its outcome (#267)
3. `41c4d5e` feat(ui): SearchList, the shared searchable list popover (#267)
4. `f996d17` test(ui): the category picker's list rules (#267)
5. `99220bf` refactor(ui): the category picker's list rules as pure functions (#267)
6. `775c4e1` refactor(ui): SearchList focuses its field by ref and takes clicks on its listbox (#267)
7. this SUMMARY

## Self-Check: PASSED

- Commits `3142930`, `4305262`, `41c4d5e`, `f996d17`, `99220bf` and `775c4e1` exist on
  `worktree-agent-p0210-a1`.
- The created and modified files listed above exist, and only the plan's 9 files changed.
- STATE.md and ROADMAP.md are unchanged.
- No commit mixes a `docs/superpowers/gsd-records/` file with a repository file.
