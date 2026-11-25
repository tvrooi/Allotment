---
phase: 02-shared-form-controls
fixed_at: 2026-11-18T14:02:55Z
review_path: docs/superpowers/gsd-records/phases/02-shared-form-controls/02-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-11-18T14:02:55Z
**Source review:** docs/superpowers/gsd-records/phases/02-shared-form-controls/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 13. These are the 7 warnings (WR-01 to WR-07) and IN-05 from 02-REVIEW.md,
  plus five open items from Phase 2 verification: T-02-44, T-02-10 and the three UI-REVIEW top
  fixes.
- Fixed: 13
- Skipped: 0
- Out of scope, as the dispatch said, and left alone: IN-01 to IN-04, the MonthRangePicker phone
  From/To clipping, and the detail-sheet payee height (Phase 3).

Each fix is its own commit on `worktree-agent-p02fix-a1`. Each one that adds behaviour has a test
that fails without it. I checked that by applying the reverse mutation and seeing the test fail,
as listed per finding.

## Fixed Issues

### WR-01: The `dd.MM.yyyy` preference rendered the DatePicker in German

**Files modified:** `client/src/components/ui/dateSegments.ts`, `client/src/components/ui/dateSegments.test.ts`
**Commit:** 65b2eda9
**Applied fix:** `dd.MM.yyyy` now maps to `en-CH` (and its example to `en-CH`). I checked with
`node -e Intl` and with a React Aria render: en-CH gives "16.11.2026", "March 2026", "Mon" and
segment labels "day/month/year". For every preference, new tests render the Calendar and the
segments under the segment locale. They assert an English heading, English weekday and day names,
no German words, and English segment names. With `de-DE` restored, 4 tests fail.
**Follow-up for the owner:** 02-UI-SPEC.md still says `'dd.MM.yyyy' -> 'de-DE'` (lines 135 and
171). That file is a planning doc outside this fixer's scope.

### WR-02: The native `type="month"` branch had no fallback

**Files modified:** `client/src/components/ui/nativeInput.ts` (new), `nativeInput.test.ts` (new), `DatePicker.tsx`, `MonthPicker.tsx`, `MonthRangePicker.tsx`, their tests, `e2e/tests/phone/phone-native.spec.ts`
**Commit:** 445039c3
**Applied fix:**

- `supportsMonthInput()` checks once whether an input keeps `type="month"`.
- On a phone without that support, MonthPicker and MonthRangePicker keep the month grid. The
  range's two grids are stacked, the popover scrolls on phones, and the year steppers are 44 px.
- `NativePicker` passes only a real `YYYY-MM` or `YYYY-MM-DD` to `onChange` (`nativeValue`), else
  `''`.
- Unit tests cover the detection (with fake documents), the fallback in both pickers and the
  value guard.
- A new phone e2e test makes `type="month"` fall back to text, as Firefox does. On Reports it
  checks that the grids open, fit the 390 px screen, have 44 px targets, and save the chosen From
  month. With the fallback removed, the unit tests and the e2e test fail.

### WR-03: D-12 did not hold in the transaction detail panel

**Files modified:** `client/src/components/transactions/TransactionDetailPanel.tsx`, `PayeeCombobox.tsx` (comment), `e2e/tests/transactions.spec.ts`
**Commit:** a1c7d181
**Applied fix:**

- The panel's document Escape listener now returns when `e.defaultPrevented`, the same contract
  as `Modal.tsx`.
- The test at transactions.spec.ts:1199 now follows D-12. The first Escape closes only the list,
  and the panel stays open with focus and the typed text. A second Escape closes the panel.
- The test clicks the field before typing, as the phone-sheet test does. Typing during the
  panel's slide-in closed the list on its own about 100 ms later (traced: `aria-expanded`
  dropped to false), so the old test never had the list open when it pressed Escape.
- Without the guard, the new test fails. It passed 3 of 3 repeats.

**Status:** fixed (the logic was checked by test and mutation).

### WR-04: Select and Combobox carried identical option, group and name code

**Files modified:** `client/src/components/ui/listItems.tsx` (new), `Select.tsx`, `Combobox.tsx`, `RadioGroup.tsx`, `fieldMessages.ts`, `fieldMessages.test.ts`
**Commit:** 40318792
**Applied fix:** `listItems.tsx` holds `isGroup`, `OptionItem` and `listItems(items)`, the
ListBoxSection and Header rendering. `fieldMessages.ts` holds `LabelNames` and `namesOf(props)`.
Select, Combobox and RadioGroup use them. Behaviour is unchanged: the gallery select, combobox,
toggle and picker specs passed 59 of 59, and `namesOf` has its own test.

### WR-05: The "is there a message" and "default required line" rules disagreed

**Files modified:** `fieldMessages.ts`, `Field.tsx`, `Switch.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Select.tsx`, `Combobox.tsx`, `DatePicker.tsx`, `MonthPicker.tsx`, tests
**Commit:** 4b6363f3
**Applied fix:** There is now one `present()` and one `errorLine(errorMessage, { isRequired,
kind, names, own })`. The order is: the caller's message, then the control's own line (a date's
half-typed or range line), then the required line. All eight controls use it. The error and help
lines render only when `present`.

This is an intended behaviour change for the list and picker family. An `errorMessage` of `''` or
`false` on a required control now shows the default line instead of an empty FieldError.
Select's new tests fail under the old rule. Combobox and the helper have their own tests.

**Status:** fixed (requires human verification). This is a logic change to which line shows.

### WR-06: Help and error lines, describedby ids and the required mark were re-implemented

**Files modified:** `Field.tsx`, `Select.tsx`, `DatePicker.tsx`, `MonthPicker.tsx`, `MonthRangePicker.tsx`, `Field.test.ts`
**Commit:** c751eb60
**Applied fix:**

- MonthRangePicker's `Lines` moved to `Field.tsx` as `FieldLines`, with a new
  `describedByIds(id, description, error)`. NativeSelect, NativePicker, MonthPicker and
  MonthRangePicker use them.
- The native branches render `<Label elementType="span" isRequired>` instead of copying the red
  `*`. I kept the wrapping `<label>`, so the native control keeps its implicit label.
- I compared the server-rendered markup before and after. It is identical except for a trailing
  space in a class list and `break-words` on the one-word From/To labels.
- New tests cover `FieldLines` and `describedByIds`, including absent lines.

### WR-07: "Today" and "this month" were worked out three different ways

**Files modified:** `client/src/utils/calendarDay.ts`, `calendarDay.test.ts`, `DatePicker.tsx`, `MonthPicker.tsx`, `MonthRangePicker.tsx`, tests
**Commit:** 9da7412c
**Applied fix:**

- `thisMonthIso()` (the month of `todayIso()`) sits next to `todayIso()`.
- DatePicker gates Today on `toCalendarDate(todayIso())`.
- MonthGrid's This month uses `thisMonthIso()`.
- MonthRangePicker's default `max` is `thisMonthIso()`.
- The `today(getLocalTimeZone())` and `format(new Date(), 'yyyy-MM')` copies in these controls
  are gone.
- Tests with a pinned clock cover `thisMonthIso` (including 23:59 on the last day of a month),
  the grid's this-month mark and the range's default max.

### IN-05: The Cash flow Custom range test depended on today's date

**Files modified:** `e2e/tests/cash-flow.spec.ts`
**Commit:** b6c77d13
**Applied fix:**

- The test pins the browser clock (`page.clock.setFixedTime`) to 15 January 2026 and dates its
  transactions from that day.
- It always takes the Previous year step, so the January year-boundary path now runs on every
  run. The Cancel check steps Next year back.
- 4 of 4 passed (2 repeats).

### T-02-44: The `'Rent'` absence check in review.spec.ts could not fail

**Files modified:** `e2e/tests/review.spec.ts`
**Commit:** 7d0d18f0
**Applied fix:** The check now names `'Rent / Mortgage'`, a category the e2e budget has.

Proof, with 02-18-SUMMARY's narrower mutation (CategoryPicker ignores the search whenever it
matches something):

- With the new check, both review variants fail at this line (`toHaveCount` failed).
- With the old `'Rent'`, the same mutation passed 7 of 7.
- With the mutation reverted, 7 of 7 pass.

### T-02-10: The gallery's CategoryPicker create sent POST /api/categories

**Files modified:** `client/src/components/transactions/CategoryPicker.tsx`, `client/src/pages/devGallery/PickerCards.tsx`, `e2e/tests/gallery/pickers.spec.ts`
**Commit:** c34654fb
**Applied fix:** CategoryPicker takes an optional `onCreate`. The app's create stays the default,
and both run through one mutation, so the pending and error states stay the same. The gallery
specimen creates offline: it waits 500 ms, then adds the category to its own groups, or refuses a
name its group already has. A "Created: …" line appears only after a create.

The gallery specs no longer route `/api/categories`:

- The pending test holds the timers with `page.clock`.
- The failure test uses a taken name.
- The success test checks the created line and the new option, and asserts that the gallery made
  no `/api/` request.

`DevControlsGallery.tsx:21` ("It fetches nothing") is true again. With `onCreate` removed, the
success test fails. The app's create is still covered by the desktop review and recurring specs
(14 of 14).

### UI-REVIEW top fix 1: The phone-sheet payee placeholder was below 4.5:1

**Files modified:** `client/src/components/transactions/TransactionFormRow.tsx`, `e2e/tests/phone/phone-native.spec.ts`
**Commit:** e2f8a3fa
**Applied fix:** `placeholder-text-disabled` became `placeholder:text-text-tertiary` in both
`inputCls` branches (lines 177-178, as cited). The phone test now compares the payee's
`::placeholder` colour with `text-text-tertiary`. It fails with the old class (rgb(143,140,138)
against rgb(105,103,101)). No gallery baseline covers this screen.

### UI-REVIEW top fix 2: The Switch label did not match Checkbox and Radio

**Files modified:** `client/src/components/ui/Switch.tsx`, `client/src/components/ui/Switch.test.ts`
**Commit:** df96fab6
**Applied fix:**

- The label is now `text-sm`, `text-text-disabled` when disabled, with `break-words` and
  `items-start`.
- `py-2.5` on the 44 px target keeps a one-line switch where it was. `py-0.5` on the label puts
  its 20 px first line level with the 24 px track. Both are 2 px-grid values, so no
  `mt-[-2px]` was needed.
- The 02-15 markup snapshot was updated for this deliberate change, with the reason added to its
  comment. A new test pins the label styles.
- This intentionally changes pixels (see Baselines).

### UI-REVIEW top fix 3: A Select with no placeholder showed React Aria's "Select an item"

**Files modified:** `client/src/components/ui/fieldMessages.ts`, `Select.tsx`, `Select.test.ts`
**Commit:** aa664cdd
**Applied fix:**

- `SELECT_PLACEHOLDER = 'Select one'` is now in `fieldMessages.ts`. It is fixed wording, so a
  label's capitals never land mid-sentence, and it uses the same verb as MonthPicker's "Select
  month".
- Select uses it on desktop, and in the phone branch's empty first option.
- Tests cover both branches.
- Combobox was not changed: the dispatch named only Select.

**Follow-up for the owner:** "Select one" is not yet in 02-UI-SPEC's Copywriting Contract
(planning doc, outside this fixer's scope).

## Baselines

Commit `ec6e3530`. The baselines were remade in Playwright's Linux image (`linux/amd64`, the
image `e2e/gallery-baselines.sh` uses) with `--update-snapshots=changed`, and I inspected each
changed image against its old version.

First, a compare run against the old baselines failed on exactly these images. After the update,
190 tests passed.

| Baseline                                             | Why it changed                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `switch.spec.ts/switch-card-light.png`, `-dark.png`  | UI-REVIEW fix 2: Switch labels are 14 px and disabled labels are grey; card height unchanged                               |
| `matrix.spec.ts/gallery-1280-light.png`, `-dark.png` | The same Switch card, and the Invalid Select specimen ("Pay cycle") reads "Select one" instead of "Select an item" (fix 3) |
| `matrix.spec.ts/gallery-390-light.png`, `-dark.png`  | The same two changes. At 390 px the two disabled switches now share a row, so the page is 44 px shorter                    |

No other baseline changed. That includes the overlays, focus shots and the open Select. The WR-01
to WR-07 refactors and the WR-02 phone-only grid classes left every other image identical.

`gallery/combobox.spec.ts:134` ("without custom values the field returns…") fails in the Linux
image with a click timeout. It also fails at the base commit `c3a73ce` (2 of 2 runs), so it is the
flaky test 02-REVIEW already cites, not something these fixes caused. Because the script copies
images only when every test passes, I ran its update step by hand with that one test left out. On
macOS the test passes.

## Verification

Every check ran in the isolated worktree `.claude/worktrees/agent-p02fix-a1`, with dependencies
installed by `npm ci` in client, e2e, lint and server. Install scripts stayed disabled by `.npmrc`,
and no lockfile changed. The pixel comparison ran in Playwright's Linux image through
`e2e/gallery-baselines.sh`.

| Check                                                                                            | Result                                                                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm test --prefix client`                                                                       | 93 files, 866 tests passed                                                                          |
| `npm run build --prefix client`                                                                  | built (exit 0)                                                                                      |
| `cd client && npx tsc --noEmit`                                                                  | exit 0                                                                                              |
| `cd e2e && npx tsc --noEmit`                                                                     | exit 0                                                                                              |
| `cd lint && npm test && npm run lint`                                                            | 86 pass, 0 fail; 0 errors, 126 warnings (cap 128; 126 before these fixes, so no rise)               |
| Prettier on every changed file                                                                   | clean                                                                                               |
| Playwright desktop: transactions, review, cash-flow, reports, rules, accessibility, dialog-focus | 86 passed                                                                                           |
| Playwright phone: phone, phone-native                                                            | 26 passed                                                                                           |
| Playwright gallery (macOS)                                                                       | 145 passed, 46 skipped (pixel tests skip off Linux)                                                 |
| Gallery project in Linux Docker (pixels)                                                         | after the update, 190 passed (`combobox.spec.ts:134` left out: it fails at base too; see Baselines) |

No STATE.md or ROADMAP.md change.

---

_Fixed: 2026-11-18T14:02:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
