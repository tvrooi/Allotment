---
phase: 02-shared-form-controls
reviewed: 2026-11-18T13:00:39Z
depth: standard
files_reviewed: 96
files_reviewed_list:
  - client/src/App.tsx
  - client/src/components/goals/GoalFormModal.tsx
  - client/src/components/layout/ServerStatus.tsx
  - client/src/components/rules/OptionPicker.tsx
  - client/src/components/rules/RuleEditorModal.tsx
  - client/src/components/transactions/CategoryPicker.test.ts
  - client/src/components/transactions/CategoryPicker.tsx
  - client/src/components/transactions/CategorySelect.tsx
  - client/src/components/transactions/PayeeCombobox.test.ts
  - client/src/components/transactions/PayeeCombobox.tsx
  - client/src/components/ui/Checkbox.test.ts
  - client/src/components/ui/Checkbox.tsx
  - client/src/components/ui/Combobox.test.ts
  - client/src/components/ui/Combobox.tsx
  - client/src/components/ui/ContextMenu.tsx
  - client/src/components/ui/CurrencyInput.test.ts
  - client/src/components/ui/CurrencyInput.tsx
  - client/src/components/ui/DatePicker.test.ts
  - client/src/components/ui/DatePicker.tsx
  - client/src/components/ui/Field.test.ts
  - client/src/components/ui/Field.tsx
  - client/src/components/ui/Input.test.ts
  - client/src/components/ui/Input.tsx
  - client/src/components/ui/Label.tsx
  - client/src/components/ui/MonthPicker.test.ts
  - client/src/components/ui/MonthPicker.tsx
  - client/src/components/ui/MonthRangePicker.test.ts
  - client/src/components/ui/MonthRangePicker.tsx
  - client/src/components/ui/RadioGroup.test.ts
  - client/src/components/ui/RadioGroup.tsx
  - client/src/components/ui/Select.test.ts
  - client/src/components/ui/Select.tsx
  - client/src/components/ui/Switch.test.ts
  - client/src/components/ui/Switch.tsx
  - client/src/components/ui/Textarea.test.ts
  - client/src/components/ui/Textarea.tsx
  - client/src/components/ui/dateSegments.test.ts
  - client/src/components/ui/dateSegments.ts
  - client/src/components/ui/fieldClasses.ts
  - client/src/components/ui/fieldMessages.test.ts
  - client/src/components/ui/fieldMessages.ts
  - client/src/index.css
  - client/src/pages/DevControlsGallery.stub.ts
  - client/src/pages/DevControlsGallery.tsx
  - client/src/pages/Welcome.tsx
  - client/src/pages/devGallery/ComboboxCard.tsx
  - client/src/pages/devGallery/DateCards.tsx
  - client/src/pages/devGallery/DialogCard.tsx
  - client/src/pages/devGallery/PickerCards.tsx
  - client/src/pages/devGallery/SelectCard.tsx
  - client/src/pages/devGallery/Specimen.tsx
  - client/src/pages/devGallery/SwitchCard.tsx
  - client/src/pages/devGallery/TextFieldCards.tsx
  - client/src/pages/devGallery/ToggleCards.tsx
  - client/src/utils/dateRange.test.ts
  - client/src/utils/dateRange.ts
  - client/src/utils/inertRoot.test.ts
  - client/src/utils/inertRoot.ts
  - client/vite.config.ts
  - e2e/gallery-baselines.sh
  - e2e/global-setup.ts
  - e2e/playwright.config.ts
  - e2e/ports.ts
  - e2e/tests/accessibility.spec.ts
  - e2e/tests/cash-flow.spec.ts
  - e2e/tests/connection.spec.ts
  - e2e/tests/currencies.spec.ts
  - e2e/tests/demo/review.spec.ts
  - e2e/tests/first-import.spec.ts
  - e2e/tests/first-run.spec.ts
  - e2e/tests/fixtures.ts
  - e2e/tests/gallery-absent.spec.ts
  - e2e/tests/gallery/combobox.spec.ts
  - e2e/tests/gallery/dates.spec.ts
  - e2e/tests/gallery/gallery.ts
  - e2e/tests/gallery/harness.spec.ts
  - e2e/tests/gallery/matrix.spec.ts
  - e2e/tests/gallery/month-range.spec.ts
  - e2e/tests/gallery/overlays.spec.ts
  - e2e/tests/gallery/pickers.spec.ts
  - e2e/tests/gallery/select.spec.ts
  - e2e/tests/gallery/switch.spec.ts
  - e2e/tests/gallery/text-fields.spec.ts
  - e2e/tests/gallery/toggles.spec.ts
  - e2e/tests/menus.spec.ts
  - e2e/tests/payees.spec.ts
  - e2e/tests/phone/phone-native.spec.ts
  - e2e/tests/phone/phone.spec.ts
  - e2e/tests/polish.spec.ts
  - e2e/tests/recover.spec.ts
  - e2e/tests/recurring.spec.ts
  - e2e/tests/review.spec.ts
  - e2e/tests/rules.spec.ts
  - e2e/tests/server-mode/auth.spec.ts
  - e2e/tests/settings.spec.ts
  - e2e/tests/transactions.spec.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-11-18T13:00:39Z (HEAD `e39961c`, branch `redesign`, diff base `d18b270`)
**Depth:** standard
**Files Reviewed:** 96
**Status:** issues_found

## Summary

I read every changed production source file in full: the `ui/` controls, `fieldClasses.ts`,
`fieldMessages.ts`, `dateSegments.ts`, `inertRoot.ts`, `dateRange.ts`, `CategoryPicker.tsx`,
`PayeeCombobox.tsx`, `App.tsx`, `vite.config.ts`, `Welcome.tsx` and `index.css`. For the gallery
pages and the e2e specs I read the diffs (`git diff d18b270..HEAD -- <file>`), focusing on changed
assertions, skips, retries and sleeps. The unit tests were read only where they back a claim below.
I also read the sibling code each change depends on: `Modal.tsx` (Escape and Tab handling),
`TransactionDetailPanel.tsx` (its Escape listener and payee save), `CategorySelectButton.tsx`,
`useIsPhone.ts`, `calendarDay.ts`, and React Aria's `ariaHideOutside`, `ComboBox` and `Popover`
sources in `client/node_modules`. I ran no test suites, because the repository is read-only for this
review. The only commands I ran were `node -e` calls to `Intl`.

There are no BLOCKER findings. No money path changed. `CurrencyInput` only changed its placeholder
class, the review files add no `type="number"`, `parseFloat` or amount `Number()`, and every date
value goes through `CalendarDate.toString()`, `todayIso()` or `isMonth()`, with no
`toISOString().slice`.

The main concerns:

- The `dd.MM.yyyy` preference renders the whole DatePicker in German, including the calendar heading,
  the weekday headers and the screen-reader labels (WR-01). This reaches production through
  `GoalFormModal`.
- The phone and narrow-window branches use `<input type="month">`, which some browsers do not
  implement (WR-02). This affects the rebuilt MonthRangePicker on Reports and Cash flow.
- D-12 ("Escape closes only the list") does not hold in the transaction detail panel, which plan
  02-19 listed explicitly (WR-03).
- Logic is duplicated across the new controls, which CLAUDE.md treats as P1 (WR-04 to WR-07).

**Areas checked with no finding:**

- **`inertRoot.ts` MutationObserver lifecycle.** The observer is created once per inert period. It
  is disconnected, with any pending records discarded, when the last holder releases. It only
  re-applies `inert` while `holders > 0`. React Aria's `ariaHideOutside` (`setHidden(false)` sets
  `element.inert = false`) confirms the diagnosis. The reverse order is also safe: when the dialog
  closes while a list is open, the release disconnects the observer first, and the list's cleanup
  then leaves `inert` false. A release twice counts once, and that has a test.
- **Combobox and SearchList Escape inside `Modal`.** `Modal.tsx:154-155` is a document bubble
  listener that honours `defaultPrevented`. `Combobox.tsx:219-227` records whether the list was open
  in the capture phase, before React Aria closes it, and prevents default only then. React Aria
  otherwise stops propagation itself for the cases where it reverts the text.
  `SearchListBody.onKeyDown` (`Combobox.tsx:390-395`) and the footer handler (`:524-531`) both
  prevent default and stop propagation. React Aria's ComboBox popover clears its contexts
  (`CLEAR_CONTEXTS`), so an `Input` in a Combobox footer cannot pick up the field's `InputContext`.
- **The moved `id`.** `PayeeCombobox`'s `id` still reaches the `<input>`: React Aria's ComboBox
  deletes `id` from its root's DOM props and passes it to the input, so
  `TransactionDetailPanel.tsx:522`'s `<label htmlFor>` still points at the input.
- **Tests.** The review files add no `waitForTimeout`, `.skip` beyond the documented Linux-only
  `PIXELS` guard, `.fixme`, retries or sleeps. The 300 ms retry in `global-setup.ts` is the existing
  Windows cleanup loop, moved into `removeRunDir`. The two `click({ force: true })` calls
  (`gallery/combobox.spec.ts:85`, `gallery/dates.spec.ts:173`) target read-only specimens to prove
  nothing opens, which is the right use. Each changed selector in an existing spec swaps
  `textbox`/`button` for `combobox`/`option` and keeps its assertion. The added `press('Tab')`
  lines follow the recorded 02-19 checkpoint decision.

**Already known** (cited, not counted): MonthRangePicker phone clip (`MonthRangePicker.tsx:123`);
detail-sheet payee 41 px (`TransactionDetailPanel.tsx:533`); flaky `gallery/combobox.spec.ts:134`;
T-02-10, the gallery CategoryPicker create reaching `POST /api/categories`, with the stale "fetches
nothing" claim at `DevControlsGallery.tsx:21`; T-02-44, the vacuous `'Rent'` check in
`review.spec.ts:56`; and the UI-REVIEW top fixes (payee placeholder 3.34:1, Switch label styles,
Select default "Select an item").

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The `dd.MM.yyyy` preference renders the DatePicker, calendar and screen-reader labels in German

**File:** `client/src/components/ui/dateSegments.ts:13`, applied at `client/src/components/ui/DatePicker.tsx:178`
**Issue:** `segmentLocale('dd.MM.yyyy')` returns `'de-DE'`, and `DatePicker` wraps the whole
`AriaDatePicker` in `<I18nProvider locale="de-DE">`, including its `Popover`, `Calendar` and
`Heading`. React Aria then uses its German strings and formats for everything inside, not just the
segment order:

- The segment names announced by a screen reader are German. They come from
  `react-aria/dist/private/intl/datepicker/de-DE.mjs`: "Tag", "Monat", "Jahr", "Kalender" and
  "Ausgewähltes Datum: …".
- The calendar heading uses German month names. `Intl.DateTimeFormat('de-DE', {month:'long'})`
  gives "März 2026", where `en-AU` gives "March 2026".
- The weekday header uses German short names: "Mo", "Di" and so on.
- The calendar cells' accessible names are German dates.

The rest of the app is English, and the contract only asked for the segment *order* (02-UI-SPEC
"incomplete/invalid DatePicker value" row). This is in production now: `GoalFormModal.tsx`'s
"Target date (optional)" uses the shared DatePicker on desktop. No test covers it: `DatePicker.test.ts:66`
only checks the segment order for `dd.MM.yyyy`.
**Fix:** use an English locale with the same day-first, dotted numeric order.
`Intl.DateTimeFormat('en-CH', {day:'2-digit', month:'2-digit', year:'numeric'})` gives "16.11.2026"
with English month and weekday names ("March 2026", "Mon"). React Aria falls back to its English
strings for `en-CH`.
```ts
// dateSegments.ts
'dd.MM.yyyy': 'en-CH',
// EXAMPLES
'en-CH': '16.11.2026',
```
Then add a unit or gallery assertion that the calendar heading for `dd.MM.yyyy` is English.

### WR-02: The native `type="month"` branch has no fallback for browsers that do not implement it

**File:** `client/src/components/ui/MonthRangePicker.tsx:115-158`, `client/src/components/ui/MonthPicker.tsx:265-266` with `client/src/components/ui/DatePicker.tsx:355-362`
**Issue:** Under 768 px, `useIsPhone` is true, and it also matches narrow desktop windows
(`useIsPhone.ts:14`). There, MonthRangePicker now renders two `<input type="month">`, and MonthPicker
renders `NativePicker` with `type="month"`. Firefox (desktop and Android) does not implement
`type="month"` and shows a plain text box. That is browser-support knowledge (MDN, caniuse); I could
not open Firefox in this read-only review. The effect differs between the two controls:

- **MonthRangePicker.** Before this phase, the phone got the month grid popover (the removed
  `phone-native.spec.ts` "the month picker fits the screen and is easy to tap" test). Now, in that
  browser, the person sees "2026-11" in a text box with no hint. Anything they type other than an
  exact `YYYY-MM` is silently refused by `pickRangeMonth`, so the Reports and Cash flow ranges cannot
  be changed by tapping. These are production callers: `ReportBuilderSidebar.tsx:154`,
  `DateRangeControl.tsx:56` and `CashFlow.tsx:1184`.
- **MonthPicker.** `NativePicker` passes `e.target.value` straight to `onChange`
  (`DatePicker.tsx:362`). Typed text such as "Nov 2026" reaches the caller, which breaks the
  documented contract "Both take and give a YYYY-MM string, '' for none" (`MonthPicker.tsx:229`).
  MonthPicker has no production caller yet, but Phases 3 and 4 adopt it.

**Fix:**
1. In `NativePicker`, give the caller only a well-formed value:
   `onChange(type === 'month' && !isMonth(v) ? '' : v)`.
2. Detect support once, for example
   `const el = document.createElement('input'); el.type = 'month'; el.type === 'month'`. Where it
   is missing, render the desktop MonthGrid branch, which already holds at 390 px as the old picker
   did.
3. Add a test that forces the fallback.

### WR-03: D-12 does not hold in the transaction detail panel, and a test pins the opposite

**File:** `client/src/components/transactions/TransactionDetailPanel.tsx:114-130`; test at `e2e/tests/transactions.spec.ts:1199`
**Issue:** Plan 02-19's must-have truth (02-19-PLAN.md:34) says: "pressing Escape with payee
suggestions open closes only the list, in the add-transaction row, the detail panel and the phone
sheet". The shared Combobox marks that Escape handled (`Combobox.tsx:226`). However, the panel's
document `keydown` listener calls `onClose()` without checking `e.defaultPrevented`, so the whole
panel closes. The new test at `transactions.spec.ts:1199` ("Escape with suggestions open closes the
panel") makes that the expected behaviour.

02-19-SUMMARY.md:137 records this as a deviation ("a complementary panel, not a dialog or sheet").
D-12, though, is the Combobox's rule, and `PayeeCombobox.tsx:83-84` states it without exception.

The concrete case: the person types "corner" into the panel's payee field, sees suggestions and
presses Escape to dismiss them. The panel disappears. The panel saves the payee only on blur
(`TransactionDetailPanel.tsx:184-191`, `<div onBlur>` at `:527`). I did not verify whether that
blur fires when the focused field is unmounted by the close. If it does not, the typed name is lost.
**Fix:** in the panel's handler, return early when `e.defaultPrevented`, the same contract
`Modal.tsx:155` follows. Change the test at `transactions.spec.ts:1199` to expect the panel to stay
open with the list closed, then close it with a second Escape. If the owner prefers the current
behaviour, record that as an explicit exception in D-12 and the PayeeCombobox comment instead.

### WR-04: Select and Combobox carry identical option, group and name code (02-09 noted it; still unresolved)

**File:** `client/src/components/ui/Combobox.tsx:31, 87, 108-124, 167-170, 263-276` versus `client/src/components/ui/Select.tsx:35, 62, 70-86, 114-117, 174-187`; also `client/src/components/ui/RadioGroup.tsx:9, 56-59`
**Issue:** `OptionItem` (ListBoxItem with a truncating label and a check mark), `isGroup`, the
`ListBoxSection` and `Header` group rendering, the `Names` union type and the
`props.label !== undefined ? {errorLabel, label} : {errorLabel, ariaLabel}` mapping are
character-for-character copies. Combobox already imports `SelectOption` and `SelectGroup` from
Select, so the shared module boundary exists. Under CLAUDE.md ("a parallel version of logic that
exists is P1"), the next change to option looks, for example the disabled-option style or an icon
slot like `SearchListOption`'s, has to be made in two places, and the two lists will drift.
**Fix:** export `OptionItem`, `isGroup` and a `renderListItems(items)` helper from one module (a new
`ui/listItems.tsx`, or from Select), along with `Names` and a `namesOf(props)` helper in
`fieldMessages.ts`. Then use them in Select, Combobox and RadioGroup.

### WR-05: The "is there a message" and "default required line" rules are copied five times and disagree

**File:** `client/src/components/ui/Field.tsx:22, 62-65`; `Switch.tsx:31, 59-62`; `Checkbox.tsx:26, 50-53`; `RadioGroup.tsx:34, 60-63`; versus `Select.tsx:118-119`, `Combobox.tsx:172`, `DatePicker.tsx:154-162`, `MonthPicker.tsx:255-261`
**Issue:** `present()` is defined four times. The fallback
`present(errorMessage) || !isRequired ? errorMessage : requiredMessage(...)` is written four times.
The list and picker controls use `errorMessage ?? (isRequired ? ... : undefined)` instead, so the
two families treat an empty message differently. A required, invalid `Field` given
`errorMessage=""` shows "Enter {subject} to continue". A required, invalid `Select` or `Combobox`
given the same `errorMessage=""` shows no line, and renders an empty `FieldError` element that still
takes its 4 px gap, because `'' ?? …` is `''` and `error != null`. Callers that build messages with
`cond && 'text'` (which gives `false`) hit the same split. fieldMessages.ts's header promises the
opposite: "Controls import these; none repeats the wording or the `errorLabel ?? label` fallback".
**Fix:** move `present` and a single `errorLine(errorMessage, isRequired, kind, names)` into
`fieldMessages.ts`, and call it from all eight controls.

### WR-06: The help and error lines, their describedby ids and the required mark are re-implemented in four native branches

**File:** `client/src/components/ui/Select.tsx:217-220, 267-290`; `DatePicker.tsx:339-343, 346-380`; `MonthPicker.tsx:270-273, 332-341`; `MonthRangePicker.tsx:55-78, 109-112`; required mark also at `Label.tsx:38-42`
**Issue:** Each native or hand-built branch rebuilds the same pieces: `${id}-description` and
`${id}-error` ids, a `describedBy` join, and `<p className={helpClass/errorClass + ' break-words'}>`.
NativeSelect and NativePicker also re-create Label's red `*` span instead of rendering `<Label>`.
MonthRangePicker even has its own `Lines` component that none of the others use. A future change,
for example `role="alert"` on error lines or a different required mark, will miss some of the five
places, and the phone and desktop branches of one control will then look or announce differently.
**Fix:** promote MonthRangePicker's `Lines` (plus a `describedByIds(ids, description, error)` helper)
into `Field.tsx`, and use `<Label>` with `htmlFor` in the native branches. Label already supports
`elementType` and `htmlFor`.

### WR-07: "Today" and "this month" are worked out three different ways

**File:** `client/src/components/ui/DatePicker.tsx:165` versus `:279`; `client/src/components/ui/MonthPicker.tsx:53-57`; `client/src/components/ui/MonthRangePicker.tsx:91`
**Issue:** The app already has `todayIso()` and `localDayIso()` in `utils/calendarDay.ts`. The new
controls add three more sources:

- DatePicker enables or disables its Today button with `today(getLocalTimeZone())` from
  `@internationalized/date`, but sets the value with `todayIso()`. The comment at `:164` admits the
  split.
- MonthGrid's "This month", its `data-this-month` mark and the default year use
  `today(getLocalTimeZone())`.
- MonthRangePicker's default `max` is date-fns `format(new Date(), 'yyyy-MM')`.

All three are device-local today, so they agree in practice. But the Today button is gated by one
clock and sets another. Any later change to `todayIso`, such as following a budget time-zone
setting, silently desynchronises the gate from the value, and the "This month" shortcut from the
range's `max`. CLAUDE.md lists this kind of parallel helper as P1.
**Fix:** add `thisMonthIso()` next to `todayIso()` in `utils/calendarDay.ts`. Use it in MonthGrid
and as MonthRangePicker's default `max`, and compute DatePicker's `todayAllowed` from
`toCalendarDate(todayIso())`.

## Info

### IN-01: `fieldClasses.ts` says it is the one place for the controls' classes, but the picker classes live in DatePicker.tsx and are patched by string splitting

**File:** `client/src/components/ui/fieldClasses.ts:1`; `client/src/components/ui/DatePicker.tsx:92-115`; `client/src/components/ui/MonthRangePicker.tsx:48-52`
**Issue:** `pickerIconButton`, `pickerGroupClass`, `pickerPopoverClass`, `pickerFooterClass` and
`pickerShortcutClass` are exported from `DatePicker.tsx`. Combobox imports `pickerIconButton` from
DatePicker as well. MonthRangePicker derives its group class by splitting `pickerGroupClass` and
filtering out `'w-full'`, `'h-10'`, `'pr-1'` and `'text-sm'`. If any of those tokens changes in
`pickerGroupClass` (for example `h-10` becomes `h-10 max-md:min-h-11`), the filter keeps the new
token without any warning, and the range trigger grows or conflicts.
**Fix:** move the picker strings into `fieldClasses.ts`, and build `pickerGroupClass` from named
parts (base, size, width), so MonthRangePicker can compose its parts instead of filtering a string.

### IN-02: MonthPicker hard-codes English month names that date-fns already formats

**File:** `client/src/components/ui/MonthPicker.tsx:19-33`
**Issue:** `SHORT` and `FULL` duplicate what `formatMonth` (`utils/dateRange.ts:121`, date-fns)
produces. The grid's aria-labels ("November 2026") and its visible text ("Nov") come from these
arrays, while the trigger ("Nov 2026") comes from date-fns. `e2e/tests/cash-flow.spec.ts` adds a
third copy (`MONTH_NAMES`).
**Fix:** derive the button text and labels with date-fns (`format(parseISO(`${month}-01`), 'MMM')`
and `'MMMM yyyy'`), or export one month-name list from `utils/dateRange.ts`.

### IN-03: The month grid's Next year button has no upper bound

**File:** `client/src/components/ui/MonthPicker.tsx:147-153`
**Issue:** "Previous year" stops at `floor` (`:140`), but "Next year" is never disabled, even when
`maxValue` or the range's `max` makes every later month unselectable. A keyboard user can step
into years where every month button is disabled and focus has nowhere to land.
**Fix:** pass a `maxYear` (from `maxValue` or `max`) and disable "Next year" at it, as `minYear`
already does for "Previous year".

### IN-04: The gallery's theme button writes the app's saved theme preference

**File:** `client/src/pages/DevControlsGallery.tsx:26-28`
**Issue:** `usePreferencesStore.getState().setTheme(...)` persists. On the dev server the gallery
shares an origin with the app, so trying the dark specimens switches the developer's real app theme
too. This does not affect tests, because each Playwright context starts empty.
**Fix:** toggle the `dark` class on `<html>` locally in the gallery, or restore the previous theme
when the page unmounts.

### IN-05: The new Cash flow range test depends on today's date

**File:** `e2e/tests/cash-flow.spec.ts:101-105`
**Issue:** It builds "last month" and "this month" from `new Date()`, so its behaviour changes
across a month or year boundary. The test handles January with a Previous year click. CLAUDE.md
asks for time to be injected. The file's existing test (`:11`) does the same, so this matches local
practice rather than being a regression.
**Fix:** pin the clock with `page.clock.setFixedTime(...)`, as the gallery date specs do
(`gallery/dates.spec.ts`), and derive the months from that fixed day.

---

**Counts:** 0 critical, 7 warning, 5 info (12 total; 0 necessity).
Warnings: `dateSegments.ts:13` / `DatePicker.tsx:178` (WR-01); `MonthRangePicker.tsx:115` /
`MonthPicker.tsx:266` / `DatePicker.tsx:362` (WR-02); `TransactionDetailPanel.tsx:114-130` /
`transactions.spec.ts:1199` (WR-03); `Combobox.tsx:108` vs `Select.tsx:70` (WR-04); `Field.tsx:22`,
`Switch.tsx:31`, `Checkbox.tsx:26`, `RadioGroup.tsx:34` vs `Select.tsx:118`, `Combobox.tsx:172`
(WR-05); `MonthRangePicker.tsx:55`, `Select.tsx:267`, `DatePicker.tsx:346`, `MonthPicker.tsx:332`
(WR-06); `DatePicker.tsx:165`/`:279`, `MonthPicker.tsx:54`, `MonthRangePicker.tsx:91` (WR-07).

Necessity: I read and applied the rubric (`$HOME/.claude/gsd-core/references/necessity-review.md`).
I found no provable necessity finding. The candidates I considered:

- `keepInert`'s `typeof MutationObserver === 'undefined'` guard is a test seam: the unit test runs
  without a DOM.
- `toggleNames`'s `ariaLabel ?? ''` and `fieldSubject`'s `?? ''` fallbacks are type-guaranteed
  states. Their comments already say so, and each costs one expression.
- Select's `isOpen={isReadOnly ? false : undefined}` is needed, because React Aria's Select has no
  read-only prop.

_Reviewed: 2026-11-18T13:00:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
