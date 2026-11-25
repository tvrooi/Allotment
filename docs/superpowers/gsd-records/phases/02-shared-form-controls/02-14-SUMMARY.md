---
phase: 02-shared-form-controls
plan: 14
subsystem: ui
tags: [react-aria, month-range, date-picker, phone, gallery, playwright, fast-check]
status: complete
requires:
  - phase: 02-shared-form-controls
    provides: "MonthGrid (value, onPick, isDisabled, label, focusOnOpen, minYear) from plan 02-08; the owner gate line 'MonthRangePicker: rebuild' from 02-03"
provides:
  - "MonthRangePicker rebuilt on MonthPicker's MonthGrid inside React Aria DialogTrigger, Popover and Dialog; same props"
  - "Native From and To month inputs under 768 px (D-04)"
  - "Optional label, description, errorMessage, isDisabled, isInvalid, isReadOnly, id, className"
  - "pickRangeMonth and formatMonthRange in utils/dateRange.ts; formatDateRange uses formatMonthRange"
  - "MonthGrid moves by arrow keys (also in MonthPicker)"
  - "MonthRangePicker gallery card and spec; cash flow Custom range tests on desktop and phone; reports Frozen range on phone"
affects: [02-11 pixel baselines, 02-12 CHANGELOG, phase 03 reports, phase 04 cash flow]
tech-stack:
  added: []
  patterns:
    - "Every range pick, desktop grid or phone input, goes through pickRangeMonth"
    - "A controlled native month input refuses a cleared or half-typed value by not calling onChange, so React restores the saved month"
key-files:
  created:
    - client/src/components/ui/MonthRangePicker.test.ts
    - e2e/tests/gallery/month-range.spec.ts
  modified:
    - client/src/components/ui/MonthRangePicker.tsx
    - client/src/components/ui/MonthPicker.tsx
    - client/src/utils/dateRange.ts
    - client/src/utils/dateRange.test.ts
    - client/src/pages/devGallery/DateCards.tsx
    - client/src/pages/DevControlsGallery.tsx
    - e2e/tests/cash-flow.spec.ts
    - e2e/tests/phone/phone-native.spec.ts
key-decisions:
  - "Both range grids show MonthGrid's own This month footer; the To grid's one is the plan's 'Select this month in the To grid'"
  - "The trigger is MonthPicker's group at the sm height (h-8) and text-xs, as wide as its text (w-fit), because its three users sit in toolbars beside sm buttons"
  - "aria-haspopup='dialog' is set on the trigger by hand: React Aria's DialogTrigger does not add it"
  - "Help and error lines are plain help/error paragraphs tied by aria-describedby, as MonthPicker's are; FieldDescription and FieldErrorText need a React Aria field context and would never show here"
  - "Focus goes back to the trigger on Done, Cancel and Escape (and on a press outside, unless the press focused something else), so a picker opened by defaultOpen does not hand focus back to the preset button"
requirements-completed: [WAVG-02, WAVG-03]
duration: 17 min
completed: 2026-11-18
actuals:
  tokens: 13400
  tasks: 3
  commits: 6
plan_head_before: 68e5c65148152c61031e3809dd548d34463bb887
plan_head_after: 3d6304d5d293ee7cfc322e30719ac575623c2c1b
coverage:
  - deliverable: "Desktop MonthRangePicker on MonthGrid with the same props, draft behaviour and Escape inside the Modal"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "e2e/tests/reports.spec.ts#frozen months (3 tests, file unchanged)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/cash-flow.spec.ts#Cash flow Custom range picks months, scopes the list and names the export"
        status: pass
  - deliverable: "pickRangeMonth keeps a range in order; formatMonthRange is the one range text"
    human_judgment: false
    verification:
      - kind: unit
        ref: "client/src/utils/dateRange.test.ts#a month range never ends before it starts (property-based)"
        status: pass
  - deliverable: "Phone form (native From and To month inputs) and the field states, in the gallery"
    human_judgment: false
    verification:
      - kind: unit
        ref: "client/src/components/ui/MonthRangePicker.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/month-range.spec.ts (5 tests)"
        status: pass
  - deliverable: "Cash flow Custom and reports Frozen ranges on phones"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/phone-native.spec.ts#month ranges (2 tests)"
        status: pass
  - deliverable: "The range dialog's look (brand fill, disabled months, 2 px ring) and 390 px fit"
    human_judgment: true
    rationale: "Pixel baselines belong to plan 02-11; the 390 px scroll-width checks pass in the gallery and phone specs"
---

# Phase 02 Plan 14: MonthRangePicker rebuild Summary

**MonthRangePicker now runs on MonthPicker's shared MonthGrid inside React Aria's DialogTrigger, Popover and Dialog. On phones it is two native From and To month inputs. Every pick goes through one rule, `pickRangeMonth`, so a range never ends before it starts and never passes max. Its three users keep their props and behaviour.**

## Performance

- **Duration:** 17 min (2026-11-18T05:51Z to 06:08Z)
- **Tasks:** 3 of 3
- **Files:** 10 (8 modified, 2 created)

## Accomplishments

- The cash flow Custom range test went in first and passed on the old picker (`fdf2072`), before anything else changed.
- `pickRangeMonth(range, side, month, max)` and `formatMonthRange(from, to)` are in `utils/dateRange.ts`, with fast-check properties. `formatDateRange` uses `formatMonthRange`, and the old `rangeLabel` copy is gone. Negative check: removing the line that moves To up made two properties fail, and the line was put back.
- The desktop picker is rebuilt on `MonthGrid` with the same props (`from`, `to`, `onChange`, `max`, `defaultOpen`). The hand-placed portal, `placeNear`, the listeners and the local grid are deleted (the grep guards print 0, 1 and 0).
- The phone branch (under 768 px) is a group named by `label`, or "Months" without one, holding native From and To month inputs (`min-h-11`, `text-base`). From's `max` is max; To's `min` is from and its `max` is max.
- The field states (label, description, errorMessage, isDisabled, isInvalid, isReadOnly, id, className) are optional, so none of the three users needs them.
- The gallery has a MonthRangePicker card with Default, Focus, Disabled, Invalid, Read-only and Labelled specimens, and `month-range.spec.ts` tests them.

## Task Commits

1. Task 1: `fdf2072` test(e2e): the cash flow Custom range, before the picker is rebuilt; `4bf3338` test(ui): a month range never ends before it starts; `f197f77` feat(ui): MonthRangePicker rebuilt on the shared month grid
2. Task 2: `f37083b` test(ui): the month range control's phone form and states; `3ee8fc7` feat(ui): MonthRangePicker is native on phones and takes the field states
3. Task 3: `3d6304d` test(e2e): the report and cash flow month ranges on phones. No caller changed, so there is no `fix(ui)` commit.

## For the record (asked for by the plan)

- **Callers changed:** none. `git diff --stat origin/redesign...HEAD -- client/src/components/reports client/src/pages/CashFlow.tsx` is empty, and no caller passes a new prop. The rebuilt control wraps its trigger in a `flex flex-col gap-1` box (for the label and lines). This changed no layout in the reports, cash flow, accessibility or phone specs.
- **Added to MonthGrid:** arrow-key movement. Left and Right move one month, Up and Down move three, staying within the shown year and landing only on enabled months. MonthPicker gets this too. Nothing else was needed: `label`, `focusOnOpen` and the year floor of 2000 were already there from 02-08.
- **Escape inside the widget's Modal:** React Aria's popover handles Escape and marks the event handled. The Modal's document listener ignores events that are `defaultPrevented`, so Escape closes only the picker with no extra code. "Escape closes only the picker" passes with `reports.spec.ts` unchanged.
- **Phone behaviour change, for the CHANGELOG entry plan 02-12 writes:** on phones, the report Frozen range, the report builder's Custom range and Cash flow's Custom range used to open the From/To month-grid popover. They are now two native month inputs, From and To, using the phone's own month picker. Each change applies at once. A From after To moves To up, and a To before From moves From down. A month after the latest allowed one, or a cleared input, changes nothing. `defaultOpen` has no effect on phones.

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Arrow keys in MonthGrid**
- **Found during:** Task 2
- **Issue:** the plan's keyboard behaviour ("arrow keys and Enter pick months") needs arrow movement, which MonthGrid's plain buttons did not have.
- **Fix:** added `onKeyDown` arrow movement to MonthGrid's month buttons, in the shared grid rather than in a copy. MonthPicker's unit and gallery tests still pass.
- **Files:** client/src/components/ui/MonthPicker.tsx. **Commit:** `3ee8fc7`

**2. [Rule 3 - Blocking] DevControlsGallery.tsx mounts the new card**
- **Issue:** the plan adds `MonthRangePickerCard` to `DateCards.tsx`, but the gallery page only shows cards that `pages/DevControlsGallery.tsx` renders. That file was not in the plan's list.
- **Fix:** a two-line change to import the card and render it after `MonthPickerCard`.
- **Commit:** `3ee8fc7`

**3. [Rule 1 - Changed behaviour broke an existing test] The phone month-picker fit test**
- **Issue:** `phone-native.spec.ts` "the month picker fits the screen and is easy to tap" measured the old popover on phones. D-04 and this plan's prohibition remove that popover on phones.
- **Fix:** renamed the test to "the month range fits the screen and is easy to tap". It now checks that no "Choose months" dialog opens and that the From and To inputs sit within the screen width at 44 px or taller. The plan's ban on editing existing tests covers only `reports.spec.ts` and the existing cash flow test, and both are untouched.
- **Commit:** `3d6304d`

**4. Help and error lines use MonthPicker's paragraphs, not FieldDescription and FieldErrorText**
- **Issue:** `FieldErrorText` is React Aria's `FieldError`, which renders only inside a React Aria field's validation context. This control has no such context, so the error line would never show.
- **Fix:** help and error paragraphs with `helpClass` and `errorClass`, tied by `aria-describedby`, exactly as MonthPicker and NativePicker do.

**5. aria-haspopup is set by hand.** React Aria's `DialogTrigger` does not add `aria-haspopup` to its button, and the plan's desktop unit behaviour and the old trigger both had `aria-haspopup="dialog"`.

## Issues Encountered

- `tests/phone/phone.spec.ts` "the welcome screen fits a phone screen" fails with "document scrolls down +297px". It also fails on the base commit `68e5c65`: I checked in a throwaway worktree, which is now removed. The welcome screen has no month range, so this plan did not cause it. The rest of the phone project passes: 62 of 63.
- The plan's months are computed in the e2e specs from a local `Date`, not with date-fns, because `e2e/` has no date-fns dependency and the plan adds no packages.

## Verification run

- `npm --prefix client test -- src/utils/dateRange.test.ts src/components/ui/MonthPicker.test.ts`: 30 passed. `src/components/ui/`: 196 passed. The whole client suite: 825 passed.
- `(cd client && npx tsc --noEmit)`: exit 0. `npm --prefix client run build`: ok.
- `npm --prefix e2e test -- --project=desktop tests/reports.spec.ts tests/cash-flow.spec.ts`: 10 passed, both after the rebuild and with `tests/accessibility.spec.ts` added (23 passed).
- `git diff origin/redesign...HEAD -- e2e/tests/reports.spec.ts` is empty (`reports-spec-untouched`).
- The grep guards: `createPortal|placeNear` 0; `from './MonthPicker'` 1; `function MonthGrid` 0. The `ui/MonthRangePicker'` importers number 4: the three users plus DateCards.
- `--project=gallery tests/gallery/month-range.spec.ts tests/gallery/dates.spec.ts`: 26 passed. The whole gallery project (the plan-exit gate): 113 passed and 2 skipped. The skips are the Linux-only pixel tests (`PIXELS`).
- `--project=phone tests/phone/phone-native.spec.ts`: all passed after deviation 3. The whole phone project: 62 passed and 1 failed (the welcome screen issue above, which predates this plan).
- Lint: `npm --prefix lint test` passed; `npm --prefix lint run lint` gave 0 errors and 126 warnings, under the 128 cap.
- No `package.json` or lockfile changed.

## Next Phase Readiness

Ready for plan 02-11, which adds the open range popover's pixel baselines, and plan 02-12, which writes the CHANGELOG from the phone behaviour note above.

## Self-Check: PASSED
