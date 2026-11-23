---
phase: 02-shared-form-controls
plan: 08
subsystem: client/ui
tags: [ui, form-controls, datepicker, monthpicker, react-aria, phone, e2e-helpers]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 07
    provides: "Select's phone/desktop split, data-[readonly] in fieldStates, the gallery card and spec shape"
  - phase: 02-shared-form-controls
    plan: 16
    provides: "fieldSubject, requiredMessage, incompleteDateMessage, dateRangeMessage, monthRangeMessage"
  - phase: 02-shared-form-controls
    plan: 03
    provides: "Owner gate: 'MonthPicker desktop form: grid' and 'MonthRangePicker: rebuild' (precondition checked)"
provides:
  - "client/src/components/ui/dateSegments.ts: segmentLocale(format), dateExample(format)"
  - "DatePicker props id, description, errorMessage, errorLabel, isDisabled, isInvalid, isReadOnly, isRequired, className; the Today shortcut ('Select today'); inclusive range and half-typed lines"
  - "client/src/components/ui/MonthPicker.tsx: MonthPicker and MonthGrid (value, onPick, isDisabled, label, focusOnOpen, minYear)"
  - "DatePicker.tsx exports the pickers' shared pieces: NativePicker (phone branch for type date or month), pickerGroupClass, pickerIconButton, pickerPopoverClass, pickerFooterClass, pickerShortcutClass"
  - "e2e/tests/fixtures.ts: fillDate(scope, name, iso) and fillMonth(scope, name, month)"
  - "Gallery: DatePicker and MonthPicker cards (client/src/pages/devGallery/DateCards.tsx) and e2e/tests/gallery/dates.spec.ts"
affects: [02-11, 02-14, phase-03, phase-04]
actuals:
  tokens: 20200
  tasks: 3
  commits: 6
plan_head_before: 7e33f974343b1a4c12be887642f2f1136e463e3b
plan_head_after: 83633aaa659aa8a5db3df09c86f67b8b1d17d2e2
tech-stack:
  added: []
  patterns:
    - "One phone branch for date and month pickers (NativePicker), lines tied by id as a Field ties them"
    - "Read-only grid trigger: a controlled DialogTrigger whose open state is forced shut while read-only"
    - "Half-typed date detection from the segments' data-placeholder when focus leaves the field"
key-files:
  created:
    - client/src/components/ui/dateSegments.ts
    - client/src/components/ui/dateSegments.test.ts
    - client/src/components/ui/DatePicker.test.ts
    - client/src/components/ui/MonthPicker.tsx
    - client/src/components/ui/MonthPicker.test.ts
    - client/src/pages/devGallery/DateCards.tsx
    - e2e/tests/gallery/dates.spec.ts
  modified:
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/goals/GoalFormModal.tsx
    - client/src/pages/DevControlsGallery.tsx
    - e2e/tests/fixtures.ts
key-decisions:
  - "segmentLocale maps 'd MMM yyyy' and 'dd/MM/yyyy' to en-AU, 'dd.MM.yyyy' to de-DE (no longer the browser's language), 'MM/dd/yyyy' to en-US, 'yyyy-MM-dd' to en-CA; the default preference is day first (fixes Pitfall 5)"
  - "The default required line of both pickers is the 'choice' kind ('Select {subject} to continue'), the copy contract's row for a required choice or picker"
  - "Line precedence: a caller's errorMessage, then the half-typed line (required fields only, desktop only), then the range line, then the required line; each shows only while the field is invalid"
  - "MonthGrid's focus prop is focusOnOpen, not autoFocus: jsx-a11y/no-autofocus flags any prop of that name and took lint to 129 against the 128 cap"
  - "The pickers' popover is pickerPopoverClass, not popoverClass: popoverClass's min-w-[var(--trigger-width)] would stretch the fixed 224 px month grid to the field's width"
  - "Shared picker class strings and NativePicker live in DatePicker.tsx (as Button.tsx exports filledDisabled) rather than fieldClasses.ts, which is outside this plan's file list"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "segmentLocale and dateExample for all five Date format preferences; each locale's numeric order matches its preference"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/dateSegments.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Desktop DatePicker: span label, segments in preference order, state data attributes, read-only focusable and not editable, Clear via fieldSubject, help and required mark only when they apply, no semibold/hex/opacity"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/DatePicker.test.ts#DatePicker on desktop"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#the date group looks like an Input in each state"
        status: pass
    human_judgment: false
  - id: D3
    description: "Today shortcut sets today (fixed clock), closes, returns focus; disabled when today is out of range"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#Select today sets today, closes the calendar and returns focus to the field"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#Select today is disabled when today is outside the range"
        status: pass
    human_judgment: false
  - id: D4
    description: "Inclusive bounds; range lines with formatDay bounds (between, on or after); half-typed required date shows the incomplete line and stays ''"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#both bounds are allowed; a day outside shows the range line"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#a half-typed required date is no value and asks for the full date"
        status: pass
    human_judgment: false
  - id: D5
    description: "Calendar keyboard: arrows move with a 2 px ring, Escape closes with focus kept; Tab skips disabled; read-only focusable, unchanged, never opens"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#the calendar moves by arrow keys with a ring, and Escape keeps focus in the field"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#Tab skips the disabled date; the read-only one takes focus but never changes"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phone DatePicker and MonthPicker: native inputs inside labels, min/max/disabled/readOnly/required, 44 px, 16 px text, required line described; no stray labels, no sideways scroll at 390 px"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/DatePicker.test.ts#DatePicker on phones"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/MonthPicker.test.ts#MonthPicker on phones"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#on a phone the native date keeps its range and shows the required line"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#on a phone the MonthPicker is a native month input, 44 px tall with 16 px text"
        status: pass
    human_judgment: false
  - id: D7
    description: "Desktop MonthPicker: trigger text and name, Choose a month dialog, year stepper, chosen month pressed and focused, This month, inclusive bounds, range line, Clear, read-only and disabled"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/MonthPicker.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#the month grid opens from the keyboard, steps the year and chooses a month"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#Select this month sets the current month, and is disabled out of range"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#the range bounds can be chosen, months outside are disabled"
        status: pass
    human_judgment: false
  - id: D8
    description: "fillDate and fillMonth work on desktop and at 390 px"
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#fillDate sets the Default date at 1280 px / 390 px"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/dates.spec.ts#fillMonth sets the Default month at 1280 px / 390 px"
        status: pass
    human_judgment: false
  - id: D9
    description: "Open-popover look (fixed-size calendar and grid, chosen day or month marked): backstop for plan 02-11's named baselines"
    verification: []
    human_judgment: true
    rationale: "Pixel baselines are added for every control at once in plan 02-11; this plan checks the popovers functionally"
duration: ~75 min
completed: 2026-11-18
---

# Phase 2 Plan 08: Shared DatePicker and MonthPicker Summary

**The DatePicker now types day, month and year in the Date format preference's order (day first by default), takes the shared field states, and has a Today shortcut with inclusive range and half-typed lines. A new MonthPicker uses the owner's grid form on desktop and the native month input on phones. Its MonthGrid is exported for MonthRangePicker, and specs enter dates and months through `fillDate` and `fillMonth`.**

## Performance

- Duration: about 75 min
- Tasks: 3 of 3
- Files: 11 (7 created, 4 modified)

## Accomplishments

- `dateSegments.ts`: `segmentLocale` and `dateExample` for all five preferences. The default `'d MMM yyyy'` used to fall through to month-first `en-US` and now maps to `en-AU`.
- `DatePicker.tsx`:
  - takes the shared field props;
  - its label is a span and the group takes `fieldStates`;
  - the Clear button uses `fieldSubject`;
  - the popover offset is 4 and the weights are medium;
  - calendar cells get a ring raised above their neighbours;
  - the footer has Today ("Select today");
  - it shows the range line and the half-typed line;
  - the phone branch takes disabled, readOnly, required and aria-invalid.
- `MonthPicker.tsx`:
  - desktop: a trigger named "{label} {month}" opens the "Choose a month" dialog, with a year stepper, a 3×4 grid, "This month", inclusive bounds and the range and required lines;
  - phones: the native month input.
- The goal form passes `errorLabel="target date"`, so its button still reads "Clear target date".
- The gallery has a DatePicker card (11 specimens) and a MonthPicker card (9 specimens). `dates.spec.ts` has 21 tests, all passing.

## Task Commits

1. Task 1 (tracer): `fd3c393` test(ui): date segments follow the date-format preference; `f53cabd` feat(ui): the shared DatePicker takes field states, and specs get fillDate
2. Task 2: `3d6136c` test(ui): the date field's Today shortcut, ranges and half-typed dates; `8f79991` feat(ui): a Today shortcut and range messages on the shared DatePicker
3. Task 3: `7d7a5b9` test(ui): the shared MonthPicker; `83633aa` feat(ui): a shared MonthPicker, native on phones

## How `fillDate` finds the segments

- **Native first.** `nativeField(scope, 'date', name)` takes each `input[type="date"]` in the scope and computes its name: its `aria-label`, or else its label's text with the `aria-hidden` parts removed. It fills the one whose name equals `name`. This covers the phone's DatePicker and the 47 old native fields. `getByLabel` was not usable, because it keeps a required field's `*` mark in the name. React Aria's hidden form input has no label, so it never matches.
- **Otherwise the segments.** It finds `getByRole('group', { name, exact: true })`, the React Aria date group, which is labelled by the field's label. For year, then month, then day, it clicks the segment with that `data-type`, checks that it is focused and types the digits. Because segments are found by type, not position, it works in every preference's order. The day goes last so a short month never clips it.
- **`fillMonth`.** It also tries a native `input[type="month"]` first. Otherwise it clicks the button whose name starts with "{name} " (the trigger is labelled by the label, then the shown month). It reads the grid's year from the month buttons' names ("January 2026"), presses Next year or Previous year until that is the target year, presses the "{Full month} {year}" button and waits for the dialog to close.

## What plan 02-14 needs to know about `MonthGrid`

- **Props:** `value` (YYYY-MM or ''), `onPick(month)`, `isDisabled(month)`, `label?`, `focusOnOpen?` and `minYear?`.
  - `label` is shown above the stepper as `text-xs font-medium text-text-tertiary`. With a label the root is `role="group"` named by it; without one it has no role.
  - **`focusOnOpen` replaces the plan's `autoFocus`** (see Deviations). It focuses the chosen month on mount, else this month, else the first enabled month. It does not re-run when the year is stepped.
  - The year floor is `max(2000, minYear)`, which disables Previous year. There is no ceiling: Next year is always enabled, as in MonthRangePicker today. Months past a bound are disabled through `isDisabled`.
- **Footer:** the grid always renders its own "This month" footer (`aria-label="Select this month"`), disabled when `isDisabled(thisMonth)` is true. Pressing it calls `onPick(thisMonth)`. A range picker with two grids will show two footers; decide in 02-14 whether that is wanted.
- **This month** comes from `today(getLocalTimeZone())`, the same source as the DatePicker's Today. MonthRangePicker's current default `max = format(new Date(), 'yyyy-MM')` gives the same month.
- **Size:** the grid sets no width. MonthPicker's `Dialog` sets `p-3 w-[224px]`, whereas MonthRangePicker's grids are `w-[196px]` each. Month buttons are `h-9 max-md:min-h-11`; the chosen one is `bg-brand-600 text-brand-contrast` and out-of-range ones are `text-text-disabled`. Each button's name is "{Full month} {year}" and the chosen one has `aria-pressed`.
- **Reuse:** `pickerPopoverClass`, `pickerFooterClass`, `pickerShortcutClass`, `pickerIconButton` and `NativePicker` (with `type="month"`, for the native From and To inputs on phones) are exported from `ui/DatePicker.tsx`.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `MonthGrid`'s `autoFocus` prop renamed to `focusOnOpen`**
- **Found during:** Task 3 lint
- **Issue:** `jsx-a11y/no-autofocus` warns on any JSX prop called `autoFocus`, which took lint to 129 warnings against the cap of 128.
- **Fix:** I renamed the prop instead of disabling the rule or changing the lint config. Its behaviour is the same.
- **Files modified:** client/src/components/ui/MonthPicker.tsx
- **Commit:** 83633aa

**2. [Rule 2 - Missing critical] `fillDate` finds native inputs by accessible name**
- **Found during:** Task 2 browser tests
- **Issue:** `getByLabel(name, { exact: true })` missed a required native field, because the label's text includes the `aria-hidden` `*` mark.
- **Fix:** Added the `nativeField` helper, which `fillMonth` also uses.
- **Files modified:** e2e/tests/fixtures.ts
- **Commit:** 3d6136c

**3. [Rule 1 - Bug] The pickers' popover does not use `popoverClass`**
- **Issue:** `popoverClass` sets `min-w-[var(--trigger-width)]`, which would stretch the 224 px month dialog to the field's full width.
- **Fix:** Added `pickerPopoverClass` (the card look and the 100vw-16px cap, with no minimum width). The DatePicker and the MonthPicker share it.
- **Commit:** 83633aa

**4. [Scope] Shared picker pieces exported from `DatePicker.tsx`**
- **Reason:** MonthPicker reuses DatePicker's phone branch and classes (one implementation). The natural home, `fieldClasses.ts`, is outside this plan's file list and is touched by other plans in this phase. The phone branch became the exported `NativePicker` (`type` is `date` or `month`).
- **Commit:** 83633aa

**5. [Test hygiene] Two calendars opened back to back**
- **Fix:** One test now waits for the first calendar to close before opening the next, because both dialogs are on the page during the exit animation. Nothing was loosened.
- **Commit:** 8f79991

**6. [Additions] Extra props and specimens**
- MonthGrid has a `minYear` prop for the plan's "minValue's year" floor.
- The gallery has more specimens than the plan listed (DatePicker "From a day", "Missing", "Before today"; MonthPicker "Missing", "Before this month"), so that the "on or after" line, the phone required line, the disabled This month and the month range line can each be tested.
- The Disabled and Read-only MonthPicker specimens are optional, which proves Clear is absent there.

**Note on TDD order in Task 3:** MonthPicker.tsx was drafted before its tests were written. The test commit (7d7a5b9) still lands before the code commit (83633aa), so at 7d7a5b9 the tests fail because the module is missing.

## Issues Encountered

- **Half-typed dates.** React Aria gives no API for them. The DatePicker reads the segments' `data-placeholder` when focus leaves the field (`onFocusChange(false)`). Opening the calendar also moves focus out of the group, so a required, half-typed field shows the incomplete line while its calendar is open. A complete date, or Today, clears it.
- **Unit tests and the store.** Server rendering reads a Zustand store's initial state, so `DatePicker.test.ts` mocks `preferencesStore` to test each preference's segment order.

## Verification

- `npm --prefix client test -- src/components/ui/dateSegments.test.ts src/components/ui/DatePicker.test.ts`: passed. `src/components/ui/`: 12 files and 125 tests passed. Full client suite: 86 files and 723 tests passed.
- `npm --prefix e2e test -- --project=gallery tests/gallery/dates.spec.ts`: 21 passed.
- Plan-exit gate, `npm --prefix e2e test -- --project=gallery`: 57 passed. The 2 skipped are switch.spec's pixel tests, which run on Linux only.
- `npm --prefix e2e test -- --project=desktop tests/accessibility.spec.ts tests/category-goals.spec.ts tests/planning.spec.ts`: 26 passed. This includes the goal form's `strayLabels` check.
- `npm --prefix e2e test -- --project=desktop tests/reports.spec.ts`: 8 passed.
- `(cd e2e && npx tsc --noEmit)` and `(cd client && npx tsc -b)`: exit 0. `npm --prefix client run build`: built.
- `npm --prefix lint test`: 86 passed. `npm --prefix lint run lint`: 0 errors and 128 warnings, which is at the cap; none of the warnings are in this plan's files.
- `grep -c 'export async function fillDate' e2e/tests/fixtures.ts` gives 1, and `grep -c 'Select today' client/src/components/ui/DatePicker.tsx` gives 1. DatePicker.tsx has no `font-semibold` and no `offset={6}`.
- MonthRangePicker.tsx is unchanged against `origin/redesign` (the guard printed "untouched").
- `grep -rl "ui/MonthPicker'" client/src` lists only `pages/devGallery/DateCards.tsx`.
- No package.json or lockfile changed.

## Known Stubs

None. The gallery's "Value: none" output is a specimen readout, not a stub.

## Next Phase Readiness

- Plan 02-11 can take the open-popover baselines: the calendar with Today on 2026-11-16, and the month grid with This month on 2026-11.
- Plan 02-14 can rebuild MonthRangePicker on `MonthGrid`, using `focusOnOpen` and `NativePicker`.
- Phases 3 and 4 move the native date fields onto DatePicker and switch their specs to `fillDate`.

## Self-Check: PASSED
