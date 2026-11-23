---
phase: 02-shared-form-controls
iteration: 2
reviewed: 2026-11-18T15:12:59Z
depth: standard
diff_base: c3a73ce6
head: 3be0aefb
files_reviewed: 35
files_reviewed_list:
  - client/src/components/transactions/CategoryPicker.tsx
  - client/src/components/transactions/PayeeCombobox.tsx
  - client/src/components/transactions/TransactionDetailPanel.tsx
  - client/src/components/transactions/TransactionFormRow.tsx
  - client/src/components/ui/Checkbox.tsx
  - client/src/components/ui/Combobox.test.ts
  - client/src/components/ui/Combobox.tsx
  - client/src/components/ui/DatePicker.test.ts
  - client/src/components/ui/DatePicker.tsx
  - client/src/components/ui/Field.test.ts
  - client/src/components/ui/Field.tsx
  - client/src/components/ui/MonthPicker.test.ts
  - client/src/components/ui/MonthPicker.tsx
  - client/src/components/ui/MonthRangePicker.test.ts
  - client/src/components/ui/MonthRangePicker.tsx
  - client/src/components/ui/RadioGroup.tsx
  - client/src/components/ui/Select.test.ts
  - client/src/components/ui/Select.tsx
  - client/src/components/ui/Switch.test.ts
  - client/src/components/ui/Switch.tsx
  - client/src/components/ui/dateSegments.test.ts
  - client/src/components/ui/dateSegments.ts
  - client/src/components/ui/fieldMessages.test.ts
  - client/src/components/ui/fieldMessages.ts
  - client/src/components/ui/listItems.tsx
  - client/src/components/ui/nativeInput.test.ts
  - client/src/components/ui/nativeInput.ts
  - client/src/pages/devGallery/PickerCards.tsx
  - client/src/utils/calendarDay.test.ts
  - client/src/utils/calendarDay.ts
  - e2e/tests/cash-flow.spec.ts
  - e2e/tests/gallery/pickers.spec.ts
  - e2e/tests/phone/phone-native.spec.ts
  - e2e/tests/review.spec.ts
  - e2e/tests/transactions.spec.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report (re-review, iteration 2)

**Reviewed:** 2026-11-18T15:12:59Z (HEAD `3be0aefb`, branch `redesign`, diff base `c3a73ce6`)
**Depth:** standard
**Files Reviewed:** 35 (plus the 6 baseline PNGs of commit `ec6e3530`)
**Status:** issues_found (Info only)

## Summary

I read `git diff c3a73ce6..HEAD` for every listed file. For each changed function I also read the
whole function and its callers: Select, Combobox, RadioGroup, Checkbox, Switch, Field, DatePicker
(including NativePicker), MonthPicker, MonthRangePicker, `CreateCategoryForm`, the detail panel's
Escape listener, `Label.tsx`, `useCreateCategory`, and `Welcome.tsx`, the only production Switch
caller. I also checked React Aria's `useComboBox` Escape handler in `client/node_modules`.

There are no BLOCKER or WARNING findings. Every in-scope fix is in the code. I checked each fix
that has an observable effect by mutation, against a scratch copy of the HEAD tree made with
`git archive`, with the repository's `node_modules` linked in. The repository was not touched:
`git status` matches the start of the run. On that copy:

- The full client suite passed: 93 files, 866 tests (the fixer reported the same numbers).
- `tsc --noEmit` was clean.

Lint was not re-run, because `lint/node_modules` is not installed and `npm ci` would write into
the checkout. The e2e specs were not run, for the same read-only reason. I verified them by
reading them, as described below.

### Fix verification

| Finding | In code | Test fails without the fix? (how I checked) |
| --- | --- | --- |
| WR-01 `dd.MM.yyyy` → `en-CH` | `dateSegments.ts:12,23` | **Yes.** Mutating both maps back to `de-DE` fails 3 tests: the locale case, the English heading/weekday/day-name test and the segment-names test. The tests render React Aria's Calendar and DatePicker under `segmentLocale()`. That checks the locale table the DatePicker feeds into `I18nProvider` (`DatePicker.tsx:182`), so it covers the defect. |
| WR-02 month-input fallback | `nativeInput.ts`; `MonthPicker.tsx:264`, `MonthRangePicker.tsx:83`; `nativeValue` at `DatePicker.tsx:327` | **Yes.** Reverting the gate to `if (isPhone)` fails the two "without a native month input" tests. Making `nativeValue` return its input unchanged fails its test. The e2e test (`phone-native.spec.ts:456`) overrides the `type` setter, which is what `detectMonthInput` uses. With detection broken, native month inputs would render and `toHaveCount(0)` would fail, so it is not vacuous. |
| WR-03 Escape in the detail panel | `TransactionDetailPanel.tsx:118-120` | **Yes, by reasoning (e2e not run).** `PayeeCombobox` passes `allowsCustomValue` (`:95`). React Aria's `useComboBox` Escape handler then continues propagation (`useComboBox.mjs:167`), so the panel's document listener does see the Escape. Without the guard it calls `onClose()`, and the new `expect(panel).toBeVisible()` (`transactions.spec.ts:1226`) fails. `Combobox.tsx:197` calls `preventDefault` only when the list was open, so the second Escape still closes the panel. No other control in the panel prevents default on Escape while nothing is open. |
| WR-04 one list implementation | `listItems.tsx`; `namesOf`/`LabelNames` in `fieldMessages.ts` | Refactor with no behaviour change. `namesOf` has its own test. `listItems.tsx` imports only types from `Select.tsx`, so there is no runtime import cycle. No copy of `OptionItem`, `isGroup`, `Names` or `present` is left (grep). `SearchList`'s hand-built `role="option"` row is a different mechanism and existed before. |
| WR-05 one `present`/`errorLine` | `fieldMessages.ts:53-77`, used by all 8 controls | **Yes.** Restoring Select's `errorMessage ?? …` and `error != null` fails 4 of the new cases. Doing the same to Combobox fails 2. No production caller passes `errorMessage` to these controls (grep finds none outside `ui/`, the gallery and tests), so the deliberate behaviour change on `''`/`false` reaches no live screen. |
| WR-06 `FieldLines`/`describedByIds`/`<Label>` | `Field.tsx:21-65`; Select, NativePicker, MonthPicker, MonthRangePicker | Covered by the new `Field.test.ts` cases. `<Label elementType="span">` with no React Aria context renders a plain span with `labelClass break-words` and the `*`. The native branches are not inside any React Aria field that provides a `LabelContext`. The only native Select inside a popover, the create form's group select, has no visible label. |
| WR-07 one clock | `calendarDay.ts:48`; `DatePicker.tsx:168`, `MonthPicker.tsx:105`, `MonthRangePicker.tsx:61` | The `today(getLocalTimeZone())` and `format(new Date())` copies are gone (grep). The tests pin the clock. Mutating MonthGrid back to a `new Date()` month still passes, as expected: both read the device clock, so single-sourcing has no observable effect to test. |
| IN-05 Cash flow clock | `cash-flow.spec.ts:97,103` | The clock is pinned to 15 Jan 2026, and the year-step path runs every time. `isoDay` is still used by the first test. |
| T-02-44 | `review.spec.ts:57` | `Rent / Mortgage` is a default category (`server/src/db/defaultCategories.ts:49`), and it is listed before the `gRoCeR` filter is typed, so the absence check can now fail. |
| T-02-10 | `CategoryPicker.tsx:85-96,177-182`; `PickerCards.tsx:136-175` | The gallery create no longer sends a request. The `apiRequests` listener with `toEqual([])` is a real check. The form's payload (group, budget type, name) is still asserted, through the "Created:" line. |
| UI top fix 1 | `TransactionFormRow.tsx:177-178` | `placeholder-text-disabled` no longer appears in `client/src`. The e2e test compares the computed `::placeholder` colour with `text-text-tertiary`. |
| UI top fix 2 | `Switch.tsx:80-100` | **Yes.** The new class test plus the re-recorded inline snapshot. See IN-01 for the production screen this change also restyles. |
| UI top fix 3 | `fieldMessages.ts:25`, `Select.tsx:94,193` | **Yes.** Mutating both placeholder fallbacks fails the desktop and phone tests. |

### Baselines (commit `ec6e3530`)

I extracted the old and new versions of all six PNGs and diffed them with ImageMagick.

- **`switch-card-{light,dark}`:** same size (1232×552). The only change is the label text: 14 px,
  with the disabled labels grey. Track positions are unchanged.
- **`gallery-1280-{light,dark}`:** same size. The changed rows are:
  - 3215-3226: the Invalid "Pay cycle" Select now reads "Select one" instead of "Select an item".
  - 10181-10596: the Switch card only.
- **`gallery-390-{light,dark}`:** 44 px shorter, as the commit says.
  - Compared top-aligned, the only change before the Switch card is row 4115-4127 (the Select
    placeholder).
  - Compared bottom-aligned, the only changes are inside the Switch card (13876-14317).
  - The crop shows the two disabled switches sharing one row, which accounts for the 44 px.

No other region changed in either alignment. The six remade baselines are explained by the
Switch and Select fixes and do not hide a regression.

**Not re-raised (known):** IN-01..IN-04 of iteration 1, the MonthRangePicker phone clip, the
detail-sheet payee 41 px, and the flaky `gallery/combobox.spec.ts:134`.

**Follow-ups outside the review scope (planning docs, not counted):** `02-UI-SPEC.md` still maps
`dd.MM.yyyy` to `de-DE` and does not list "Select one" in its Copywriting Contract. The fixer
recorded both.

## Narrative Findings (AI reviewer)

## Info

### IN-01: The Switch restyle also changes the Welcome screen's feature rows, which nobody inspected

**File:** `client/src/components/ui/Switch.tsx:100`; affected caller `client/src/pages/Welcome.tsx:257-271`
**Issue:** The fix report says the Switch change "intentionally changes pixels (see Baselines)",
but the baselines cover only the gallery. `Welcome.tsx` is the only production Switch caller, and
the restyle changes it in two ways:

1. **Label colour.** Welcome sets `text-text-secondary` on the row `div` so the label inherits it.
   The SwitchButton now sets `text-text`, so the feature prompts turn from secondary to primary
   text. When the switches are disabled (`!progress || !canSave`, for example offline), they turn
   `text-text-disabled`.
2. **Height of a wrapped row.** At 390 px the text column is about 310 px wide: 358 px of content,
   less the 40 px track and the 8 px gap. "Sharing costs with a partner or housemates (Household)"
   is about 54 characters at 14 px, so it wraps.
   - Before, a two-line row was the 44 px `min-h-11`, centred, inside the row's `py-3`.
   - Now it is `py-2.5` + 44 px of content = 64 px, with the track top-aligned.
   - Each wrapping row is about 20 px taller.

The 02-15 snapshot test existed to keep "Welcome.tsx's switches … unchanged". It was re-recorded
with a reason, which is legitimate, but no one looked at Welcome. This is probably the intended
consistency with Checkbox and Radio (D-03), so it is not a defect in itself.
**Fix:** Check Welcome at 390 px and at desktop width.
- If the secondary colour should stay, give the children their own class
  (`<span className="text-text-secondary">`).
- Otherwise record in HANDOVER or the UI-REVIEW notes that Welcome's prompts now use the shared
  toggle label style.

### IN-02: The gallery's offline create can give a new category an id that already exists, or an empty one

**File:** `client/src/pages/devGallery/PickerCards.tsx:140-144,166-168`
**Issue:** `slug(name)` builds the new id from the name, and the "taken" check only compares
names within the chosen group. Some names produce an id that is already in use, or no id at all:

- Creating "Rent" in Everyday gives id `rent`, which Bills' Rent already has.
- "Groceries!" in Everyday gives `groceries`.
- A name with no Latin letters or digits ("日本", "!!!") gives `''`.

SearchList then renders two options with the same DOM `id` and React key (`Combobox.tsx:376-377`),
and `picks.set(id, …)` keeps only one of them. Picking the original category can pick the copy,
or `''` reads as "none" in the readout. This is dev-gallery only, and no spec exercises it.
**Fix:** Make the id unique, for example `` `${groupId}-${slug(name) || 'category'}-${Date.now()}` ``,
or check the slug against every group's ids and refuse a collision.

### IN-03: One assertion in the new Select test can never fail

**File:** `client/src/components/ui/Select.test.ts:149`
**Issue:** `expect(html).not.toContain('FieldError')` checks for a component name, and a
component name never appears in rendered markup. The other assertion in the same test
(`slot="errorMessage"`) does fail under the old rule, which I confirmed by mutation, so the test as
a whole still guards WR-05.
**Fix:** Remove the vacuous line. To pin the "no gap" claim, assert the error element's absence by
its class instead (for example, no `text-negative` element after the trigger).

---

**Counts:** 0 critical, 0 warning, 3 info (3 total; 0 necessity). There are no
critical or warning findings to list as file:line.

Necessity: I could not re-read the rubric for this run, because the dispatch's persona path
`$HOME/.claude/gsd-core/references/necessity-review.md` was not opened in this session. I
considered two candidates and classified neither as a necessity finding:

- `supportsMonthInput`'s `typeof document === 'undefined'` branch is a test seam. Server
  rendering in the unit tests has no document.
- CategoryPicker's `onCreate` prop has only the gallery as a caller. It is the requested T-02-10
  fix, and it is not a guard against an impossible state.

**Residual risk (not counted):** Iteration 1 left one question open: whether the payee typed in
the detail panel is saved when a second Escape closes the panel, since the save happens on blur.
It is still unverified. The new WR-03 test closes the panel with "corner" typed and does not
assert whether it was saved.

_Reviewed: 2026-11-18T15:12:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
