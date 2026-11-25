---
phase: 02-shared-form-controls
plan: 18
subsystem: client/ui
tags: [ui, form-controls, search-list, category-picker, e2e]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 10
    provides: "SearchList, the pure category list functions, categoryOption, the characterisation tests"
  - phase: 02-shared-form-controls
    plan: 17
    provides: "Review, payee, rules and recurring specs on categoryOption"
  - phase: 02-shared-form-controls
    plan: 20
    provides: "Import, freshness, polish, recovery and phone specs on categoryOption"
provides:
  - "client/src/components/transactions/CategoryPicker.tsx: a thin wrapper over SearchList (categoryList hands it the sections, pinned row and empty line), with its create form on shared controls and an error line"
  - "client/src/components/ui/Combobox.tsx: SearchList is non-modal with its own outside-press check, takes portalContainer, closes on Escape in its footer, marks its highlighted row data-active"
  - "e2e/tests/fixtures.ts: categoryOption locates rows as listbox options"
  - "Category picker gallery specimens (anchored, inline) and 8 gallery tests"
affects: [02-11]
actuals:
  tokens: 10806
  tasks: 3
  commits: 5
plan_head_before: 1287926d9cad2d0b1a3a5f2ed91b090d54eea69e
plan_head_after: e560ae6f6a8b8df141939fda7517a7f45396652a
commits: 5
tech-stack:
  added: []
  patterns:
    - "Inline placement without a trigger prop: a zero-height box in the caller's relative wrapper is both the popover's trigger and its portal container (UNSTABLE_portalContainer), so the list stays inside the caller's dialog, row or form"
    - "Outside press by the React tree: the Dialog's onPointerDown marks a press as inside (React events bubble through portals, so a nested Select's popover counts), and a document pointerdown listener closes the list otherwise"
key-files:
  created: []
  modified:
    - client/src/components/transactions/CategoryPicker.tsx
    - client/src/components/transactions/CategoryPicker.test.ts
    - client/src/components/ui/Combobox.tsx
    - client/src/pages/devGallery/PickerCards.tsx
    - e2e/tests/gallery/pickers.spec.ts
    - e2e/tests/fixtures.ts
    - e2e/tests/currencies.spec.ts
key-decisions:
  - "SearchList's popover is non-modal (isNonModal). A modal React Aria popover makes everything outside it inert (ariaHideOutside with shouldUseInert), so a click outside could never reach the panel heading the characterisation test clicks, and the hand-rolled picker let it through. React Aria's dismissal hooks live in react-aria, which is not a direct dependency, so SearchList closes on an outside press itself"
  - "Popover onOpenChange is not passed: with a non-modal popover React Aria would also close on blur and on page scroll, which the old picker never did. The list closes only on Escape, an outside press or a pick"
  - "The create form's group is the shared Select named 'New category group' (the old native select had no name); the budget types are shared Buttons with aria-pressed, wrapping on narrow widths"
  - "Failed create wording follows SaveReportModal's pattern: \"Couldn't create the category. Try again.\""
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "CategoryPicker is a wrapper over SearchList reading categorySections, categoryKeyboardOrder and categoryListEmpty; no portal, positioning or listener code of its own"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/transactions/CategoryPicker.test.ts#categoryList"
        status: pass
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#category picker"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inline create form: pending (disabled, 'Creating...'), failed (role=alert line, form and name kept), success (sends group, budget type, name; picks it), income group hides budget types, Enter creates, cancel clears, Escape closes only the picker"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/pickers.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every screen that picks a category still works through the shared list"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "desktop 21 specs (185 passed), phone 4 specs, demo project"
        status: pass
    human_judgment: false
duration: 120min
completed: 2026-11-18
---

# Phase 02 Plan 18: CategoryPicker on the shared searchable list Summary

**CategoryPicker is now a thin wrapper over `SearchList`. Its rows are listbox options that it
reads from plan 02-10's tested list functions, and its create form is built on the shared
Select, Input and Button, with an error line when a create fails. Specs find its rows through
`categoryOption`, whose role is now `option`. The desktop, phone and demo suites pass on it,
apart from one phone test that also fails at the base.**

## Performance

- Duration: about 2 hours (18 November 2026)
- Tasks: 3 of 3, in 5 commits
- Files: 7 modified (6 of the plan's 13, plus none outside them)

## Task 1: measured list of the last seven specs

The role experiment was applied as 02-17-PLAN.md describes: `role="option"` on the no-category
row and the section rows in the hand-rolled picker, and `categoryOption` set to `option`. Each
spec was then read at every picker site for negative checks. The experiment was reverted with
`git checkout -- client/src/components/transactions/CategoryPicker.tsx e2e/tests/fixtures.ts`,
and the guard printed `experiment-reverted`.

| File | Line | Kind | Selector before | Selector after | How found | Commit |
|------|------|------|-----------------|----------------|-----------|--------|
| `e2e/tests/currencies.spec.ts` | 86 | positive | `dialog.getByRole('button', { name: 'Transfer: US checking' })` | `categoryOption(dialog, 'Transfer: US checking')` | experiment | `0d91d2f` |

The import line in `currencies.spec.ts` gained `categoryOption`. No negative checks were found.

**Files with no site, unchanged:** `connection.spec.ts`, `switchers.spec.ts`,
`household-categories.spec.ts`, `transaction-presets.spec.ts`, `budget.spec.ts` and
`budget-inspector.spec.ts`. Three selectors look like picker sites but are not rows, so they
stay on the button role:
- `connection.spec.ts:195` is the "Default category for …" trigger.
- `currencies.spec.ts:85` is the `/^Category:/` trigger.
- `transaction-presets.spec.ts:44` is the "Uncategorised" quick-filter toggle in the "Quick
  filters" group.

Runs:
- Unchanged picker, before any change: 52 passed.
- Experiment on, before the move: `currencies.spec.ts:86` failed (1 failed, 51 passed).
- After the move: 52 passed.
- Negative case, experiment on with line 86 back on `getByRole('button', …)`: it failed at
  86:71 again.
- Experiment reverted, unchanged picker: 52 passed.

## How the wrapper places the list

- **Anchored** (`anchor` given: payee default, Review, the sorting step, the budget summary):
  - The anchor is `SearchList`'s `triggerRef`, and the popover goes to the end of the page.
  - The width is `w-[max(var(--trigger-width),16rem)]`: at least 16rem and at least the
    anchor's width. `popoverClass` caps it at the screen less 16 px.
  - React Aria puts it below and flips it above when there is little room below.
- **Inline** (no `anchor`: transaction row, detail panel, category button):
  - The wrapper renders a zero-height box at `absolute left-0` in the caller's `relative`
    wrapper: at `top-full` for `position="below"`, at `bottom-full` for `"above"`.
  - The box is `w-64`, or `max-md:w-full` with `fullWidth`.
  - That box is the trigger and also the portal container (`UNSTABLE_portalContainer`). The
    list therefore stays inside the caller's dialog or panel, so dialog-scoped specs such as
    the recurring and Add transaction ones still find it.
  - The width is `w-[var(--trigger-width)]` and the placement is `bottom start` or `top start`.
- The popover keeps the old picker's `shadow-lg` card.
- React Aria sets its max height from the room available. The footer is `shrink-0`, so
  "Create new category" stays in view.
- The wrapper has no portal, positioning or listener code of its own: `createPortal` 0,
  `addEventListener` 0.

## Behaviour differences found and fixed

1. **A click outside could not reach the page** (`transactions.spec.ts:1338`, "a click outside
   closes the picker with no change", timed out). The underlay took the click first. With the
   underlay made pass-through, the panel heading was still `inert`, because a modal React Aria
   popover makes everything outside it inert. Fix: `SearchList` is now non-modal, and closes on
   an outside `pointerdown` itself. A press counts as inside by the React tree, so pressing in
   the footer Select's own popover keeps the list open. In the footer, Escape is marked handled
   and closes only the list. Commit `3d4a846`, before the sweep.
2. **The highlighted row lost its `data-active` mark** (`polish.spec.ts:264` and `:275`, plan
   02-20's file, read `[data-active="true"]`). Fix: `SearchListBody` sets
   `data-active={id === activeId}` on each option. Commit `57b6c31`.
3. **The picker's box lost its `shadow-lg` class** (`polish-phone.spec.ts:177`, plan 02-20's
   file, finds the list's box with `ancestor::div[contains(@class,"shadow-lg")]`). Fix: the
   wrapper passes `shadow-lg!` to the popover, which is the raised card the old picker had.
   Commit `e560ae6`.

New behaviour: a failed create shows "Couldn't create the category. Try again." in a
`role="alert"` line under the name, marks the name invalid, and keeps the form and the name.
Cancel also resets the mutation.

## e2e selectors this plan changed

- `e2e/tests/currencies.spec.ts:86`: a row locator moved onto `categoryOption` (Task 1).
- `e2e/tests/fixtures.ts`, `categoryOption`: the role changed from `button` to `option`, and
  its comment was updated (rewire commit `3d4a846`). This is the rewire commit's only change
  under `e2e/tests` outside `gallery/`.
- `e2e/tests/gallery/pickers.spec.ts`: 8 new tests. One comment in an existing SearchList test
  was updated to say that a click outside closes the list, not that the underlay takes it.

No selector for "Create new category", "Cancel new category", "Create", the search field or "No
categories found" needed changing. `grep -rn "Create new category" e2e/tests` still shows the
same two button-role selectors (`recurring.spec.ts:91` and `review.spec.ts:43`).

## Task Commits

1. `0d91d2f` test(e2e): the last picker specs find category rows through one helper (#267)
2. `c2243ce` test(ui): the category picker's inline create states (#267) (RED: 5 unit and 6
   gallery tests failed on the old picker; pending and success already passed)
3. `3d4a846` refactor(ui): CategoryPicker is a wrapper over the shared searchable list (#267)
4. `57b6c31` fix(ui): mark the highlighted row data-active in the category picker wrapper (#267)
5. `e560ae6` fix(ui): keep the raised shadow in the category picker wrapper (#267)

## Verification (plan commands)

- `npm --prefix e2e test -- --project=desktop` over the seven Task 1 specs: 52 passed. The
  revert guard printed `experiment-reverted`.
- `npm --prefix client test -- src/components/transactions/CategoryPicker.test.ts src/components/ui/Combobox.test.ts`:
  46 passed. The whole client suite: 89 files, 777 tests passed.
- `npm --prefix e2e test -- --project=gallery tests/gallery/pickers.spec.ts`: 14 passed.
- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/review.spec.ts`: 51 passed.
- `grep -c 'createPortal'` in `CategoryPicker.tsx`: 0. `grep -c 'addEventListener'`: 0.
- `npm --prefix client run build`: built. `npm --prefix lint run lint`: 0 errors and 126
  warnings, against the cap of 128 and 128 before this plan.
- Task 3 desktop sweep of 21 specs: 185 passed. Its first run, before fixes 2 and 3, had 1
  failure (polish) and 184 passed.
- Phone, 4 specs: 38 passed, 1 failed. The failure is `phone.spec.ts:77`, "the welcome screen
  fits a phone screen" ("document scrolls down +297px"). It fails the same way with the base's
  client code (`git checkout 1287926 -- client`, run, restored), and that page has no picker,
  so this plan did not cause it. Reported below, not fixed.
- Demo project: 25 passed.
- `grep -rn "getByRole('textbox', { name: 'Search categories' })" e2e/tests | wc -l`: 27 (at
  least 24).
- `(cd e2e && npx tsc --noEmit)`: exit 0.
- None of the seven user files changed since the base (`1287926`). No `package.json` or
  lockfile changed. No skip, retry, timeout or wait was added under `e2e/tests`.
- The plan's `origin/redesign...HEAD` checks were run against this worktree's base, `1287926`.

## Negative case (Task 3)

- With the wrapper passing every section unfiltered (`categorySections(..., '', value)`),
  `review.spec.ts` failed in both of its variants. The failure came at line 36 ("No categories
  found" not visible), because SearchList shows its empty line only when no rows are passed.
  The mutation was reverted.
- A narrower mutation ignored the search only while the search matched something, so that the
  run could reach the absence check at line 55. `review.spec.ts` then **passed** (7 passed).
  The mutation was reverted.

## Issues Encountered

- **A vacuous negative check, `review.spec.ts:55`** (plan 02-17's file, not edited). It is
  `expect(categoryOption(page, 'Rent', { exact: true })).toHaveCount(0)`. The e2e budget's
  category is "Rent / Mortgage", so the check passes whether or not the search filters. That
  is T-02-44's risk in a different form. A follow-up in the owning plan's scope should point it
  at a category that exists, such as `'Rent / Mortgage'`. The filter is still guarded by the
  line-36 empty-line check, the unit tests and the gallery mixed-case test.
- **`phone/phone.spec.ts:77` fails at the base** (vertical overflow on the welcome screen). It
  is outside this plan's scope.
- `node_modules` were missing. `npm ci` was run in the root, `client`, `server`, `e2e` and
  `lint`, with install scripts still disabled. No lockfile changed.

## Deviations from Plan

**1. [Rule 1 - Bug] SearchList made non-modal, with its own outside-press check.** Found in
Task 2, in the characterisation test for a click outside. The plan expected React Aria's
Popover to handle dismissal. Its modal form makes the page inert, and its dismissal hooks are
not reachable without adding `react-aria` as a dependency, which the plan forbids. The fix is
in `Combobox.tsx` (`3d4a846`). The listener lives in SearchList, not in the wrapper.

**2. [Rule 1 - Bug] `data-active` and `shadow-lg` kept for plan 02-20's specs.** Found in the
Task 3 sweep. Two selectors in 02-20's specs read markup of the old picker, not a role. They
were fixed in SearchList and the wrapper, as Task 3 directs. Commits `57b6c31` and `e560ae6`.

**3. The negative case did not fail at the planned check.** See above: `review.spec.ts:55` is
vacuous. It is reported and not edited, because the spec belongs to plan 02-17.

## Self-Check: PASSED

- The modified files exist: `client/src/components/transactions/CategoryPicker.tsx`,
  `CategoryPicker.test.ts`, `client/src/components/ui/Combobox.tsx`,
  `client/src/pages/devGallery/PickerCards.tsx`, `e2e/tests/gallery/pickers.spec.ts`,
  `e2e/tests/fixtures.ts` and `e2e/tests/currencies.spec.ts`.
- Commits `0d91d2f`, `c2243ce`, `3d4a846`, `57b6c31` and `e560ae6` are ancestors of HEAD on
  `worktree-agent-p0218-a1`.
- STATE.md and ROADMAP.md are unchanged. No commit mixes a `docs/superpowers/gsd-records/` file with a repository
  file.
