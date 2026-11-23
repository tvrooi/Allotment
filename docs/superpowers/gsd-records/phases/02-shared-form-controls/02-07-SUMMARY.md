---
phase: 02-shared-form-controls
plan: 07
subsystem: client/ui
tags: [ui, form-controls, select, listbox, react-aria, phone]
requires:
  - phase: 02-shared-form-controls
    plan: 06
    provides: "Field, FieldDescription, FieldErrorText; fieldBase/fieldHeights/fieldStates; the gallery card and spec shape"
  - phase: 02-shared-form-controls
    plan: 16
    provides: "requiredMessage('choice', …) and fieldSubject({ errorLabel, label, ariaLabel })"
provides:
  - "client/src/components/ui/Select.tsx: Select (and the SelectOption, SelectGroup types). React Aria's Select on desktop, a native select under 768 px"
  - "fieldClasses.ts: popoverClass, listClass, optionClass (for Combobox and the pickers to reuse), plus a data-[readonly] line in fieldStates"
  - "e2e/tests/fixtures.ts: chooseOption(field, name), the one way specs choose from the shared Select at any width"
  - "Gallery: the Select card (5 states plus Required, Grouped, One option, No options, Many options, Long text, Small) and e2e/tests/gallery/select.spec.ts"
affects: [02-08, 02-09, 02-10, 02-11, 02-12, 02-13, phase-03, phase-04]
actuals:
  tokens: 9900
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - "Phone/desktop split by useIsPhone() inside one component with one value contract (string, '' for none)"
    - "Read-only on a React Aria Select: isOpen={false} plus an onChange guard plus data-readonly"
key-files:
  created:
    - client/src/components/ui/Select.tsx
    - client/src/components/ui/Select.test.ts
    - client/src/pages/devGallery/SelectCard.tsx
    - e2e/tests/gallery/select.spec.ts
  modified:
    - client/src/components/ui/fieldClasses.ts
    - client/src/pages/DevControlsGallery.tsx
    - e2e/tests/fixtures.ts
key-decisions:
  - "The desktop trigger carries data-readonly but not aria-readonly: WAI-ARIA gives role button no aria-readonly, and jsx-a11y's role-supports-aria-props warning took lint to 129 against the 128 cap. The phone's native select (role combobox) does carry aria-readonly"
  - "fieldStates gains a data-[readonly] line (same look as [readonly]), because neither a button nor a select has a readonly attribute"
  - "Names are a union like Switch's: a string label, or an aria-label alone; a Select with neither does not compile (@ts-expect-error pinned in Select.test.ts)"
  - "validationBehavior='aria': required marks the field and shows the default line but never blocks a form's native submit"
  - "An unknown value shows as unset on both branches; on phones an empty disabled first option holds the placeholder, so the browser never shows the first real option as if it were chosen, and the placeholder cannot be chosen back (as on desktop)"
  - "Grouped option sections use the id group:<label>, so a group label never collides with an option value"
patterns-established:
  - "optionClass: hover and data-[focused] fill bg-hover, data-[focus-visible] adds a 2 px inset brand ring, data-[selected] brand-50 with brand-700 text and a tick"
  - "Specs choose through chooseOption(field, name); field is row.getByRole('combobox').or(row.getByRole('button'))"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "Desktop Select: button trigger with the field look, label as a span, placeholder tertiary, sm height, state attributes, no hex or opacity"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/Select.test.ts#Select on desktop"
        status: pass
    human_judgment: false
  - id: D2
    description: "Default required line names its subject in both naming forms (label 'Account type'; aria-label 'Frequency'); errorLabel and a supplied errorMessage win"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/Select.test.ts#a required, invalid Select named only by aria-label names that"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#the required, invalid Select names its subject in the default line"
        status: pass
    human_judgment: false
  - id: D3
    description: "WAI-ARIA listbox keyboard pattern: Tab order, Enter opens, ArrowDown moves, Enter chooses, Escape closes without change, focus returns, typeahead, ring on the keyboard's option"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#the keyboard opens, moves, chooses, closes and jumps by letter"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero, one and many options; options in the order given, grouped; disabled skipped by Tab; read-only focusable but never opens"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#one option is listed but never chosen; no options says so; many scroll"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#Tab skips the disabled Select; the read-only one takes focus but never opens"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#options stay in the order given, grouped under their headings"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phone Select: native select, 44 px, 16 px text, optgroups, placeholder option, read-only disables all other options; native at 767 px and the custom trigger at 768 px"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/Select.test.ts#Select on phones"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#the Select is native at 767 px and the custom trigger at 768 px"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#on a phone the Select is a native select, 44 px tall with 16 px text"
        status: pass
    human_judgment: false
  - id: D6
    description: "chooseOption picks Monthly at 1280 px and at 390 px"
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#chooseOption picks Monthly at 1280 px"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/select.spec.ts#chooseOption picks Monthly at 390 px"
        status: pass
    human_judgment: false
  - id: D7
    description: "Open-list look (chosen option marked, max-h-72) and long-text truncation in pixels: backstop for plan 02-11's named open-popover baselines"
    verification: []
    human_judgment: true
    rationale: "Pixel baselines are added for every control at once in plan 02-11; this plan checks the cap, scrolling and truncation functionally only"
duration: ~45 min
completed: 2026-11-18
status: complete
---

# Phase 02 Plan 07: The shared Select Summary

**One `Select` gives a React Aria listbox popover on desktop and the phone's own picker under
768 px. Both branches use the same value contract (the option's value string, `''` for none).
The popover and option classes now live in `fieldClasses.ts` for Combobox and the pickers to
reuse, and specs choose from it at any width through `chooseOption`.**

## Performance

- Tasks: 2 of 2, 4 commits
- Files: 4 created, 3 modified

## Accomplishments

- `fieldClasses.ts`: `popoverClass` (card surface, `data-[entering]:animate-menu-in`,
  `min-w-[var(--trigger-width)] max-w-[calc(100vw-16px)]`), `listClass` (`max-h-72
  overflow-y-auto p-1`), `optionClass` (hover/keyboard fill, inset brand ring on focus-visible,
  brand-50 chosen, text-disabled disabled, 36 px / 44 px on phones).
- `Select.tsx`, desktop: React Aria `Select` with `Label elementType="span"`, a `Button` trigger
  built from `fieldBase`, `fieldHeights` and `fieldStates` (the flex row sits in an inner span, so
  `block` and `flex` never compete), `SelectValue` with the placeholder in `text-text-tertiary`,
  a decorative chevron, `Popover offset={4}`, and a `ListBox` with sections and headers for groups.
  Options are keyed by value and shown in the given order, and each chosen option has a tick.
  `renderEmptyState` shows "No matching options". `FieldDescription` and `FieldErrorText` sit under
  the trigger. The default line is `requiredMessage('choice', fieldSubject(names))`, with no
  fallback of its own.
- `Select.tsx`, phone: a `label` wrapping the label text and a native `select` (`fieldBase`,
  `fieldStates`, `min-h-11`, `text-base`), with `optgroup` for groups and the help and error
  lines tied by `aria-describedby`.
- `chooseOption(field, name)` in `e2e/tests/fixtures.ts`.
- Gallery Select card and a spec with 11 tests.

## Read-only, on each branch (asked for by the plan's output section)

- **Desktop:** `isOpen={isReadOnly ? false : undefined}` holds the popover closed, whatever
  Enter, Space, ArrowDown or a click does. React Aria's trigger also has typeahead while it is
  closed: typing a letter on a focused trigger chooses the next match without opening. The
  `onChange` handler therefore drops changes when read-only, and because the value is
  controlled, nothing changes. The trigger is never `disabled`, so Tab still stops on it. It
  carries `data-readonly`, which the new `data-[readonly]` line in `fieldStates` styles like a
  read-only Input. It does **not** carry `aria-readonly` (see Deviations).
- **Phone:** the `select` is not disabled (so it stays focusable) and carries `aria-readonly`
  and `data-readonly`. Every option except the chosen one is `disabled`, so the phone's picker
  cannot change the value, and `onChange` is guarded as well.

## For the Combobox and picker plans (React Aria Popover / ListBox notes)

- `Select` (and `ComboBox`) put `--trigger-width` on the Popover, which `popoverClass` uses for
  its minimum width. A Popover that is not tied to a trigger (for example a `DialogTrigger` picker)
  must set its own width, or the `min-w` resolves to nothing.
- An empty collection never opens unless `allowsEmptyCollection` is set on the `Select`. Then
  `ListBox`'s `renderEmptyState` draws the empty line, and the listbox gets `data-empty`.
- React Aria moves real DOM focus onto options, so `data-[focused]` alone gives a weak
  indicator. `optionClass` adds `data-[focus-visible]` ring classes, and a computed `box-shadow`
  check proves the ring is there.
- After Escape, the closed popover's listbox briefly stays in the DOM. A spec that opens a
  second list right away hits a strict-mode clash on `getByRole('listbox')`, so wait for
  `toHaveCount(0)` before the next open (`chooseOption` does this).
- React Aria's Select renders a hidden native `select` inside an `aria-hidden` box for forms and
  autofill. Specs must find the visible control by role (`combobox` on phones, `button` on
  desktop), never by the `select` tag alone.
- RAC `Button` passes `data-*` props through but filters `aria-*` props other than the label
  ones. To add one, use the `render` prop. This plan tried that for `aria-readonly` and removed it.
- The trigger's accessible name is "value + label" (`aria-labelledby` = value id and label id),
  and its description is the help and error lines.

## Task Commits

1. Task 1 tests: `08abf2c` test(ui): the shared Select's states and keyboard pattern (#267)
2. Task 1 code: `53dd998` feat(ui): the shared Select with a listbox popover on desktop (#267)
3. Task 2 tests: `16add83` test(ui): the Select is native under 768 px (#267)
4. Task 2 code: `416aab8` feat(ui): the shared Select uses the phone's own picker, and specs get chooseOption (#267)

## Files Created/Modified

See frontmatter `key-files`.

## Decisions Made

See frontmatter `key-decisions`.

## Verification run

All on Node 24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`).

- RED, Task 1: `npm --prefix client test -- src/components/ui/Select.test.ts` failed to import (no `Select.tsx`) before the feat commit
- `npm --prefix client test -- src/components/ui/Select.test.ts` after Task 1: 10 passed
- `npm --prefix e2e test -- --project=gallery tests/gallery/select.spec.ts` after Task 1: 7 passed
- `npm --prefix client run build` after Task 1: built
- RED, Task 2: 7 phone tests failed, 10 passed, before the phone branch
- `npm --prefix client test -- src/components/ui/Select.test.ts` after Task 2: 17 passed
- `npm --prefix e2e test -- --project=gallery tests/gallery/select.spec.ts` after Task 2: 11 passed
- `grep -c 'export async function chooseOption' e2e/tests/fixtures.ts`: 1
- `(cd e2e && npx tsc --noEmit)`: no error
- Plan-exit gate: `npm --prefix e2e test -- --project=gallery`: 36 passed, 2 skipped (Linux-only pixel baselines, by design); `npm --prefix client run build`: built; `npm --prefix lint test`: 86 passed; `npm --prefix lint run lint`: 0 errors, 128 warnings (at the cap; none in this plan's files)
- `npm --prefix client test`: 83 files, 683 passed
- `grep -rl "ui/Select'" client/src`: only `pages/devGallery/SelectCard.tsx`; no screen uses the new Select
- `client/src/components/ui/Input.tsx`, package.json and lockfiles: unchanged
- Prettier: all changed files formatted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `aria-readonly` on the desktop trigger**
- **Found during:** the plan-exit lint gate
- **Issue:** The plan asks for `aria-readonly` on the trigger. WAI-ARIA does not support it on
  role `button`, so screen readers ignore it, and jsx-a11y's `role-supports-aria-props` warning
  took lint to 129 warnings against the 128 cap.
- **Fix:** Removed it from the desktop trigger. Read-only there is `data-readonly` plus the
  never-opening guard. The unit test now asserts the attribute is absent, and the gallery spec
  asserts `data-readonly`. The phone's native select keeps `aria-readonly`.
- **Files modified:** `client/src/components/ui/Select.tsx`, `Select.test.ts`, `e2e/tests/gallery/select.spec.ts`
- **Commit:** `416aab8`
- **Open for the owner or plan 02-11:** a desktop screen-reader user hears no "read-only" on
  this trigger. If that matters, the fix is a description line, or the select-only combobox role
  (which does support `aria-readonly`).

**2. [Rule 2 - Missing critical] A `data-[readonly]` line in `fieldStates`**
- **Issue:** `fieldStates` styled read-only only through `[readonly]`, which neither a button nor a
  select has, so a read-only Select would not look like a read-only Input.
- **Fix:** Added `data-[readonly]` with the same classes. Input and Textarea do not set the
  attribute, so their look is unchanged (the Textarea class test still passes).
- **Commit:** `53dd998`

**3. Gallery spec test for the trigger's look:** the plan says the trigger matches Input's look.
The spec compares height, background, border colour, radius and text colour in the Disabled,
Invalid and Read-only states, and in a chosen (non-placeholder) state. Cursor is not compared
for the default state, because a button's `pointer` is right where an Input shows a text caret.
Disabled (`not-allowed`) and read-only (`default`) cursors are asserted on their own.

**Total deviations:** 2 auto-fixed and 1 test-scope note. Impact: no screen moved onto the
Select, and no package was added.

## Issues Encountered

None beyond the deviations above.

## Threat Flags

None. Option labels render as React children and native option text (T-02-18). A single option
is never chosen automatically, as the gallery test shows (T-02-19). No package or lockfile
changed (T-02-SC).

## User Setup Required

None.

## Next Phase Readiness

- Combobox (02-09) and the pickers reuse `popoverClass`, `listClass` and `optionClass`.
- Plan 02-11 adds the named open-popover pixel baselines and the Escape-inside-Modal test for this
  Select.
- Phases 3 and 4 move screens onto `Select` and switch their specs from `selectOption` to
  `chooseOption`.

## Self-Check: PASSED

- FOUND: client/src/components/ui/Select.tsx, Select.test.ts, pages/devGallery/SelectCard.tsx, e2e/tests/gallery/select.spec.ts, this SUMMARY
- FOUND: commits 08abf2c, 53dd998, 16add83, 416aab8 on this branch
- STATE.md and ROADMAP.md unchanged
