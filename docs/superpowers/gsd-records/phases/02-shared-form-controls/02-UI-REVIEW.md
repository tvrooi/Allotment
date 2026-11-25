# Phase 02 — UI Review

**Audited:** 2026-11-18 (HEAD `14631b6`, branch `redesign`)
**Baseline:** `02-UI-SPEC.md` (approved 2026-11-16; D-11 owner gate 17 Nov 2026), `02-CONTEXT.md` D-01 to D-12
**Screenshots:** captured. The client dev server ran on port 5199 (`vite --port 5199 --strictPort`), was stopped after the audit, and used no budget (the `/dev/controls` gallery fetches nothing). Captures are in `.git/gsd-handoff/ui-review-shots/02-20261118-234104/`: 5 full pages (1280 light and dark, 390 light and dark, 768 light), 10 open popovers (Select, Combobox, DatePicker, MonthPicker and MonthRangePicker at 1280, light and dark), and 48 per-card captures (`sections/sec-{d,dk,p}-NN.png`). The CategoryPicker open capture failed because my locator was wrong (the cards are not `region`s), so CategoryPicker was audited from code and from its closed triggers.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Interaction findings below come from the code unless a capture is named.
**Gitignore gate:** skipped on purpose. The orchestrator made the repository read-only, so I created no `docs/superpowers/gsd-records/ui-reviews/` folder or `.gitignore`. All captures are under `.git/`, which git never tracks. `git status` matches the start of the session.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | The contract strings are in place, but a Select given no placeholder shows React Aria's own "Select an item", and the default required lines keep the label's capitals ("Select Due on to continue") |
| 2. Visuals | 3/4 | The hierarchy is clear and the states are distinct, but Switch labels are 16 px and stay full contrast when disabled, while Checkbox and Radio labels are 14 px and go grey; read-only and disabled unchecked toggles have the same box |
| 3. Color | 3/4 | No hex values, and brand colour appears only on the declared roles. The rewired phone-sheet payee field still has a `placeholder-text-disabled` placeholder (3.34:1), below the contract's 4.5:1 minimum |
| 4. Typography | 3/4 | The set uses 3 sizes and 1 weight (`font-medium`), within the contract. The MonthRangePicker trigger value is 12 px (`text-xs`), not the 14 px the contract sets for a control value |
| 5. Spacing | 3/4 | Spacing is on the grid, with one off-grid `py-1.5` (PayeeCombobox hint). The two month-grid dialogs use different widths (200 and 224 px) and different footer spacing |
| 6. Experience Design | 3/4 | All 5 states, the empty states, the create loading state and Escape scoping are covered. A read-only Select still shows its chevron, and the month grid does not mark this month, though the calendar marks today |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **The phone-sheet payee placeholder fails the 4.5:1 contract.** `TransactionFormRow.tsx:177-178` gives `inputCls` the class `placeholder-text-disabled`. Lines 264-270 pass it to `PayeeCombobox` (and to `CategorySelect`) as `fieldClassName`, which replaces the field's whole look, so the payee placeholder in the phone add sheet is `--color-text-disabled` (3.34:1 light, 3.16:1 dark). This placeholder is the payee field's only visible prompt, and the field was rewired in this phase. WAVG-02 says placeholders "MUST use `--color-text-tertiary`". **Fix:** in `TransactionFormRow.tsx:177-178`, change `placeholder-text-disabled` to `placeholder:text-text-tertiary`. Alternatively, have `PayeeCombobox` always append `placeholder:text-text-tertiary` to a caller's `fieldClassName`, so no caller can drop it. `AddTransactionModal.tsx:33` and `MerchantSelect.tsx:8` have the same token but were not rewired; leave them for Phases 3 and 4.
2. **Switch labels do not match the other toggles.** `Switch.tsx:82` renders the label as `<span className="min-w-0">` with no size or colour, so it inherits 16 px body text, while Checkbox and Radio use `text-sm`. A disabled Switch label stays `text-text`, while disabled Checkbox and Radio labels become `text-text-disabled`. The label also has no `break-words`. In addition, `Switch.tsx:97` uses `items-center`, so for a label that wraps, the track centres on the whole block rather than lining up with the first line, as the UI Considerations `long-text` row requires. The cards `sec-d-12` and `sec-d-14` side by side show it: "Bank sync, off" is greyed beside the Checkbox but full black beside the Switch. This breaks D-03's "disabled … looks are the same everywhere". **Fix:** put `text-sm` on the button, `${disabled ? 'text-text-disabled' : 'text-text'}` on it, `break-words` on the label span, and `items-start`. To keep the 24 px track level with a 20 px line, add `py-2.5` on phones or `mt-[-2px]` on the track; that is the one off-grid value the contract would need to allow.
3. **A Select with no placeholder shows React Aria's own text.** `Select.tsx:134` passes `placeholder={placeholder}`. When it is undefined, `SelectValue` shows the library's localised default, "Select an item". The Invalid specimen in `sec-d-05` shows it; that wording is not in the Copywriting Contract and does not use the voice in `docs/BRAND.md`. Phases 3 and 4 move about 80 native selects onto this control, and every one without a placeholder would show it. **Fix:** add a default line to `fieldMessages.ts`, for example `choosePlaceholder(subject)` giving "Choose {subject}" (or a fixed "Choose one"), and use `placeholder ?? choosePlaceholder(fieldSubject(names))` in `Select.tsx`. Do the same for `Combobox.tsx`, whose Invalid, Opens on focus, Caller filters and similar specimens show an empty box (`sec-p-06`).

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

The contract strings are present and correct: "Choose from a calendar", "Select today"/"Today", "Select this month"/"This month", "Clear {subject}" (`DatePicker.tsx`, `MonthPicker.tsx`, `Combobox.tsx` through `fieldSubject`), "No matching options" with its body line (`Combobox.tsx` `NoMatches`), "No categories found", `New payee: "{query}"`, "Creating..." and "Cancel new category" (`CategoryPicker.tsx`). The range and incomplete-date lines live in one place (`fieldMessages.ts`). The gallery theme button reads "Switch to dark theme" / "Switch to light theme".

- **WARNING:** React Aria's default placeholder leaks out (`Select.tsx:134`; Top fix 3).
- **WARNING:** The default required lines read awkwardly. `fieldSubject` keeps the label's casing, which the contract chose so proper nouns keep their capitals, but common-noun labels then produce "Select Due on to continue" (`sec-d-09`), "Select Account type to continue" (`sec-d-05`), "Select Frequency to continue" (`sec-d-13`) and "Select Pay month to continue". The contract lets callers pass a lowercase `errorLabel`, but only one gallery specimen does ("Turn on Up sync to continue"). Phases 3 and 4 will copy whatever the gallery shows. Recommend that the gallery's required specimens pass `errorLabel` in lowercase, and that `docs/ui` add a one-line rule: a label without a proper noun passes a lowercase `errorLabel`.
- **WARNING:** A DatePicker you type into gets "Select {subject} to continue" (`DatePicker.tsx`, `requiredMessage('choice', …)`). That follows the contract, which counts DatePicker as a picker, but "Enter" fits a typed date better. Raise it with the contract owner; do not change it silently.
- **Minor:** In the MonthRangePicker dialog, the two grids each have a button named "Select this month" (`MonthPicker.tsx:186`, rendered once for From and once for To). The `group` labels "From" and "To" tell them apart, but a voice-control user saying "click Select this month" gets an ambiguity prompt. Consider `aria-label={label ? \`${label}: this month\` : 'Select this month'}`.
- **Minor:** The CategoryPicker create error, "Couldn't create the category. Try again." (`CategoryPicker.tsx`), is generic, but it is kept as it was, which is acceptable.

### Pillar 2: Visuals (3/4)

Each card has a clear focal point: a heading at `text-base font-medium`, then state rows with a 96 px state column (`Specimen.tsx:36`). Every icon-only button has a name ("Clear …", "Choose from a calendar", "Previous/Next month", "Previous/Next year", "Cancel new category"), and every icon is `aria-hidden`.

- **WARNING:** The Switch label differs from the Checkbox and Radio labels (Top fix 2).
- **WARNING:** Read-only and disabled unchecked toggles look the same. `toggleReadOnly` (`fieldClasses.ts:21`) and `toggleDisabled` both give `bg-surface-alt ring-1 ring-inset ring-border`. An unchecked read-only Checkbox or Radio box is therefore the same as a disabled one, and only the label colour differs (`sec-d-12` "Shared budget, off" against "Bank sync, off"; `sec-d-13` read-only Monthly/Yearly against disabled Monthly/Yearly). The contract says "Read-only controls are visually distinct from disabled controls". Checked states differ, unchecked ones do not. **Fix:** give the read-only box `bg-surface ring-text-tertiary` (the resting look) with `cursor-default`, so read-only reads as a locked value rather than an unavailable control.
- **Known, cited and not re-raised:** On phones, MonthRangePicker's From and To fields clip "November 2026" to "November 202" (`sec-p-11`).
- **Minor (gallery only):** On phones, the specimen's state name ("Default") sits directly above the control's own label ("Account") in the same style (`text-sm font-medium text-text-secondary`; `Specimen.tsx:36`; see `sec-p-06`). The two lines read as one label pair. Make the state name `text-xs text-text-tertiary uppercase`, or use another distinct meta style.
- **Minor:** The MonthRangePicker dialog stacks three separated bars (two "This month" footers, then the Cancel/Done bar; `monthrange-open-dark.png`). It works, but the double rule is busy.

### Pillar 3: Color (3/4)

I tallied classes across the 15 set files. Brand classes appear only on the enumerated roles: focus rings (`focus:`, `focus-within:`, `focus-visible:` and `group-data-[focus-visible]:` on brand-600), checked or selected fills (`bg-brand-600`, `text-brand-contrast`), the selected option (`data-[selected]:bg-brand-50 text-brand-700`), the focused date segment (`focus:bg-brand-100`), and the shortcut and create text (`text-brand-600 hover:text-brand-700`). There are no hex or `rgb()` values. Disabled controls never stack `opacity-*`. The dark captures (`*-dark.png`, `sec-dk-*`) keep every state legible.

- **WARNING:** The rewired phone-sheet payee placeholder uses `text-disabled` at 3.34:1 (Top fix 1).
- **WARNING:** The calendar's today marker is weak. `DatePicker.tsx:265` draws `data-[today]:ring-1 ring-inset ring-border`. `--color-border` (#e4e1de) against `--color-surface` (#fff) is about 1.25:1, so the marker comes mostly from `font-medium` (`date-open-light.png`, the 18). Use `ring-text-tertiary`, which is 5.63:1, as the unchecked toggles do.
- **Minor:** `CategoryPicker.tsx:310` sets `className: 'shadow-lg!'`. That is the Tailwind default shadow with `!important`, not the `shadow-card` token that every other popover in the set uses. Remove it, or change it to `shadow-card`.
- **Minor:** `CategoryPicker.tsx:192` puts `text-brand-600` on a `ghost` Button for "Create new category". The contract asks for `hover:text-brand-700`, and the ghost variant's hover colour may override the brand text. Check it on hover.

### Pillar 4: Typography (3/4)

Across the set files there are 3 sizes (`text-xs` ×14, `text-sm` ×15, `text-base` ×5, the base only for phone fields) and 1 weight (`font-medium` ×12). No `font-semibold` or `font-bold` is used. This is within the contract (4 sizes, weights 400 and 500). Phone fields reach 16 px through `max-md:text-base` and the global `index.css:283-288` rule, so iOS does not zoom on focus.

- **WARNING:** The MonthRangePicker trigger value is 12 px. `rangeGroupClass` (`MonthRangePicker.tsx:50`) swaps `text-sm` for `text-xs` and adds `font-medium text-text-secondary`, so "Jun 2026 – Nov 2026" is a Helper/Meta size used as a control value (`sec-d-11`). Its sibling MonthPicker shows "Nov 2026" at 14 px. The contract's table puts desktop control values at 14 px; a compact `sm` height does not call for smaller text (the `sm` Select keeps `text-sm`). Use `text-sm`.
- **WARNING:** The Switch label inherits 16 px (Top fix 2).

### Pillar 5: Spacing (3/4)

The set keeps to the contract scale: `gap-1`, `gap-2`, `px-3`, `py-2`, `p-1`, `p-3`, `pl-3 pr-1`, `offset={4}`, `min-h-9`, `size-8`, `size-9` and `max-h-72`. At 390 px the gallery has no sideways scroll (`scrollWidth` 390), and at 1280 none either (`scrollWidth` 1280). A probe at 768 flagged a span reaching x=786. Tracing it showed a `truncate` span 334 px wide, clipped correctly (scrollWidth 613), so it is not a defect.

- **WARNING:** `PayeeCombobox.tsx:101`, the new-payee hint, uses `px-3 py-1.5`. That is 6 px, the exact off-grid value the contract's spacing note forbids copying. Use `py-2`.
- **WARNING:** The two month-grid dialogs drift apart. MonthPicker's dialog is `w-[224px]` (in the contract). MonthRangePicker's grids are `w-[200px]` each (`MonthRangePicker.tsx:217, 226`). Its footer uses `mt-3 pt-3` (`:235`), while every other picker footer uses `pickerFooterClass` with `mt-2 pt-2`. The two pickers share `MonthGrid` so they cannot drift, yet their frames already have. Export one grid width constant, and reuse `pickerFooterClass` (or a sibling constant) for the Done bar.
- **Minor:** Section headings differ between the two list styles. The Combobox and Select `Header` use `px-3 pt-2 pb-1` on the surface (`Combobox.tsx`). The SearchList heading uses `bg-surface-alt px-3 py-1` (`Combobox.tsx:499`). CategoryPicker therefore looks different from a grouped Combobox. Choose one, or record why they differ.
- **Known, cited:** On phones the detail-sheet payee field is 41 px. Also seen: at 390 px the CurrencyInput fields "Amount" and "Opening balance" measure 326×41 (outside the set by D-03, recorded for Phase 3).

### Pillar 6: Experience Design (3/4)

State coverage matches the contract. Each of the 11 controls has Default, Focus, Disabled, Invalid and Read-only specimens, plus Required, Optional, Long text, One/No/Many options, Indeterminate and Help text where they apply (101 named specimen groups). The empty states render. CategoryPicker's create button shows a pending state ("Creating...", disabled) and an error state (`role="alert"`, typed name kept). Escape closes only the list (D-12): `Combobox` `wasOpen` guard, and `SearchListBody` `stopPropagation`. Read-only pickers stay focusable and never open. Phones get the native select, date and month inputs (`sec-p-*`). The Clear buttons appear only for optional fields with a value. A half-typed date is never a value.

- **WARNING:** A read-only Select still shows its chevron (`sec-d-05`, "Set by the bank"). The chevron suggests the list will open, but it never does (`isOpen={false}`). The read-only Combobox and DatePicker do the same with their chevron and calendar button. Hide the chevron, or give it `text-text-disabled`, while `isReadOnly` is set, so the control does not offer an action it refuses.
- **WARNING:** The month grid does not mark the current month. The calendar marks today with `data-[today]`. `MonthGrid` sets `data-this-month` but uses it only to choose initial focus (`MonthPicker.tsx`), so nothing on screen shows which cell is now (`month-open-*.png`, `monthrange-open-*.png`). Add the same inset ring as the calendar's today marker (after fixing its contrast, Pillar 3).
- **Minor (gallery consistency):** "Required" means different things in different cards. In `SelectCard` it is an invalid, required, empty field showing its error at rest (`sec-d-05`). In `DateCards` it is a required field at rest with no error, and "Missing" is the invalid one (`sec-d-09`). Name the states the same way across cards so Phases 3 and 4 copy the right one.
- **Known, cited:** the `combobox.spec.ts:134` gallery test is flaky.
- **Not verified:** keyboard focus rings after real Tab presses (interaction capture is off). The code puts the rings where the contract says. `e2e/tests/gallery/` holds the focus baselines; I did not run it.

---

## Registry Safety

Not applicable. There is no `components.json`, and the UI-SPEC registry table lists no third-party registries (D-01, D-02). Registry audit: 0 third-party blocks checked, no flags.

---

## Files Audited

- `client/src/components/ui/`: `Label.tsx`, `Field.tsx`, `fieldClasses.ts`, `fieldMessages.ts`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Combobox.tsx` (including `SearchList` and `SearchListBody`), `Checkbox.tsx`, `RadioGroup.tsx`, `Switch.tsx`, `DatePicker.tsx` (including `NativePicker`), `MonthPicker.tsx` (including `MonthGrid`), `MonthRangePicker.tsx`
- `client/src/components/transactions/`: `CategoryPicker.tsx`, `PayeeCombobox.tsx`, and the call sites `TransactionFormRow.tsx:165-290` and `TransactionDetailPanel.tsx:520-536`; callers' `fieldClassName` uses in `SplitTransactionModal.tsx` and `BulkEditModal.tsx`
- `client/src/pages/DevControlsGallery.tsx`, `client/src/pages/devGallery/Specimen.tsx`, `SelectCard.tsx`
- `client/src/index.css` (the phone font-size rule at 283-288, the `:focus-visible` layering at 365-368)
- Planning: `02-UI-SPEC.md` (in full), `02-CONTEXT.md` (in full), and the headings, one-liners and deviation lines of `02-01` to `02-20 -SUMMARY.md`. The 20 PLAN.md files (about 480 KB) were not read line by line. The audit is scored against the UI-SPEC, which they implement, and against the summaries' recorded deviations.
- Captures: `.git/gsd-handoff/ui-review-shots/02-20261118-234104/` (15 page and popover images, plus `sections/` with 48 card images and `tablet-select-long.png`)
