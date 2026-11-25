---
phase: 02-shared-form-controls
plan: 09
subsystem: client/ui
tags: [ui, form-controls, combobox, react-aria, gallery, e2e]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 07
    provides: "Select's option shapes (SelectOption, SelectGroup), the popover, list and option styling, the gallery card and spec shape"
  - phase: 02-shared-form-controls
    plan: 08
    provides: "pickerIconButton (DatePicker.tsx), the Clear-button pattern (slot={null}, 'Clear {subject}')"
  - phase: 02-shared-form-controls
    plan: 16
    provides: "fieldSubject, requiredMessage"
provides:
  - "client/src/components/ui/Combobox.tsx: Combobox (items, value, onChange, inputValue, onInputChange, allowsCustomValue, menuTrigger, filter, optional, emptyState, footer, inputClassName, popoverClassName, plus label or aria-label, placeholder, description, errorMessage, errorLabel, isDisabled, isInvalid, isReadOnly, isRequired, fieldSize, className, id)"
  - "Gallery: the Combobox card (client/src/pages/devGallery/ComboboxCard.tsx, 18 specimens) and e2e/tests/gallery/combobox.spec.ts (13 tests)"
affects: [02-11, 02-19, CategoryPicker plan, phase-03, phase-04]
actuals:
  tokens: 22800
  tasks: 2
  commits: 4
plan_head_before: 41b5e32cc229355a7dbaf3ef5f6a79c13d5012d0
plan_head_after: c46e47cfcfd859da54d5044b9339ce0494242638
tech-stack:
  added: []
  patterns:
    - "A Combobox's box is a React Aria Group carrying fieldBase, fieldHeights and fieldStates, with the ring on focus-within; the input inside has no border or outline and inherits the group's cursor"
    - "Clear is a slot={null} button (out of the ComboBox's trigger slot) named 'Clear ' + fieldSubject, shown only for an optional, enabled, editable field with a value or caller-owned text"
    - "Gallery specs bring a specimen on screen (scroll, then two animation frames) before opening a Combobox list"
key-files:
  created:
    - client/src/components/ui/Combobox.tsx
    - client/src/components/ui/Combobox.test.ts
    - client/src/pages/devGallery/ComboboxCard.tsx
    - e2e/tests/gallery/combobox.spec.ts
  modified:
    - client/src/pages/DevControlsGallery.tsx
key-decisions:
  - "Combobox takes the Select's option shapes (type-only import of SelectOption and SelectGroup), so a list moving between the two needs no reshaping"
  - "Filtering is React Aria's own (defaultFilter): useFilter contains at base sensitivity by default, the caller's function, or () => true for filter={false}. React Aria then still shows every option when the list is opened from the chevron"
  - "allowsEmptyCollection is on unless emptyState is null and there is no footer: the empty lines and the footer show in an open, empty list; emptyState={null} lets an empty list close"
  - "The default empty state is two lines, 'No matching options' (text-sm text-text) and 'Type a different search term or clear the filter to see all choices.' (text-xs text-text-tertiary)"
  - "The footer sits under the ListBox inside the Popover, in a border-t border-border-light box with no padding of its own; the caller pads its content"
  - "The buttons sit 4 px from the right border by -mr-2 inside the field's px-3, so the group keeps fieldBase unchanged rather than mixing block/flex and px/pr utilities"
  - "Clear also shows for caller-owned custom text (optional + inputValue non-empty), so a free-text wrapper can be cleared; it calls onChange(''), onInputChange?.('') and refocuses the input"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "Combobox role and name (label or aria-label only), field height h-10 / sm h-8, tertiary placeholder, chosen label shown, disabled/invalid/read-only attributes, no hex or opacity, description tied by id"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/Combobox.test.ts#Combobox"
        status: pass
    human_judgment: false
  - id: D2
    description: "Keyboard: type to filter (case ignored), ArrowDown highlights, Enter chooses and closes, Escape closes, focus stays in the field; Tab skips disabled; read-only focusable, not typeable, never opens"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#typing filters, ArrowDown and Enter choose, and focus stays in the field"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#Tab skips the disabled Combobox; the read-only one takes focus but never changes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Same height, background, border width and colour, radius and focus ring as Input; disabled text colour and cursors"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#the Combobox looks like an Input in each state"
        status: pass
    human_judgment: false
  - id: D4
    description: "allowsCustomValue keeps text on blur and reports it; without it the field returns to the chosen label; menuTrigger focus; filter false; empty state, custom empty state, footer in an empty list"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#without custom values the field returns to the chosen label; with them it keeps the text"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#menuTrigger focus opens the list when the field takes focus"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#filter false shows exactly the caller’s items"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#no match shows the empty line and its help; a custom empty state replaces it"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#a footer shows below the list, even when the list is empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "Clear in both naming forms ('Clear Account', 'Clear Payee'), absent with no value, disabled or read-only; default required line 'Select {subject} to continue' in both forms; no 'undefined'"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/Combobox.test.ts#Combobox clearing and messages"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#Clear empties an optional Combobox, and is named by its subject in both forms"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero, one (never auto-chosen) and forty options (scroll inside, list at most 288 px); caller order kept; two options with one label chosen by value"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#zero options say so; one is never chosen for you; forty scroll inside"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#options keep the caller’s order, and two with one label are chosen by value"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 390 px: option rows >= 44 px, Clear and chevron >= 44x44 px, popover <= screen less 16 px, a long option and a long chosen label truncate, no sideways scroll"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/Combobox.test.ts#the Clear and chevron buttons are 44 px targets on phones"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#on a phone, rows and buttons are 44 px and nothing is wider than the screen"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#a long chosen label truncates on one line"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-11-18
---

# Phase 02 Plan 09: The shared Combobox Summary

**A shared Combobox on React Aria's ComboBox with the Input's field look, the WAI-ARIA combobox
keyboard pattern, custom values, a Clear button named through fieldSubject, an empty state and a
footer; proved in the gallery and used by no screen yet.**

## Performance

- Duration: about 20 minutes (08:45 to 09:05, 18 November 2026)
- Tasks: 2 of 2
- Files: 4 created, 1 modified (911 lines added)

## Accomplishments

- `client/src/components/ui/Combobox.tsx`: the label (a real `<label>`, as the input is
  labelable), a Group with `fieldBase`, `fieldHeights`, `fieldStates` and a focus-within ring, the
  input, an optional Clear button and the chevron, a Popover (`offset={4}`, `popoverClass`) with a
  ListBox (`listClass`) of options (`optionClass`), sections and headers for groups, the empty state
  and the footer; `FieldDescription` and `FieldErrorText` beneath.
- Unit tests (18) for roles, names, looks, states, Clear and the default lines in both naming forms.
- Gallery card with 18 specimens (the five states, custom value, opens on focus, caller filters,
  custom empty state, footer, no, one and many options, optional, named by aria-label, required,
  same label, long text) and 13 browser tests.

## Enter and Escape (for plan 02-19 to compare with the payee field)

Read from React Aria 1.22.1's `useComboBox` and checked in the gallery spec:

- **Enter, list open:** prevents the form's default submit and commits: the highlighted option is
  chosen and the list closes; with nothing highlighted it commits the text (kept with
  `allowsCustomValue`, otherwise reverted to the chosen label). Focus stays in the input.
- **Enter, list closed:** not handled; it reaches the form, so a form around the field submits.
  The old PayeeCombobox left Enter to the form always, so a form submit on a closed list is
  unchanged; on an open list Enter now chooses instead of submitting.
- **Escape, list open:** closes the list and reverts the text to the chosen label (or keeps custom
  text). Focus stays in the input.
- **Escape, propagation:** React Aria lets Escape continue to outer handlers when an option is
  chosen, the text is empty, or `allowsCustomValue` is set. Plan 02-19 must check that Escape on an
  open payee list inside `Modal.tsx` closes only the list (Modal closes unless
  `e.defaultPrevented`): for PayeeCombobox (`allowsCustomValue`) propagation continues, so the
  sheet may close too.
- **Tab, list open:** commits as Enter does and moves focus on.

## What the PayeeCombobox (02-19) and CategoryPicker plans can reuse

- PayeeCombobox: `aria-label="Payee"`, `placeholder="Payee"`, `allowsCustomValue`,
  `menuTrigger="focus"`, both `inputValue`/`onInputChange` and `value`/`onChange` owned by the
  wrapper (React Aria leaves the text to the caller when both are controlled, so the wrapper sets
  the text on a choice), `filter={false}` with the wrapper's own first-eight slicing,
  `emptyState={null}` plus `footer` for `New payee: "<query>"` (the footer shows even with no
  suggestions), `inputClassName` for the phone sheet's text size, `popoverClassName` for the 12rem
  width. The input's role is `combobox`, so the eight PayeeCombobox selectors change from
  `textbox` to `combobox` (recurring.spec.ts's three stay).
- CategoryPicker: the option, section and header markup and the empty-state pattern; the
  Autocomplete composition it needs is not built here.

## Task Commits

1. Task 1, tracer: `12ed0fd` test(ui): the shared Combobox's keyboard pattern (#267);
   `c7142c0` feat(ui): the shared Combobox (#267)
2. Task 2, TDD: `41f044d` test(ui): Combobox custom values, clearing and empty lists (#267)
   (RED: 6 unit tests failing); `c46e47c` feat(ui): the Combobox takes custom values, a clear
   button, an empty state and a footer (#267)

## Files Created/Modified

- `client/src/components/ui/Combobox.tsx`: the shared Combobox
- `client/src/components/ui/Combobox.test.ts`: 18 unit tests
- `client/src/pages/devGallery/ComboboxCard.tsx`: the gallery card
- `client/src/pages/DevControlsGallery.tsx`: mounts the card after the Select card
- `e2e/tests/gallery/combobox.spec.ts`: 13 gallery tests

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

1. **[Rule 3, test harness] Specs bring a specimen on screen before opening a list.** React
   Aria's `useCloseOnScroll` closes an open Combobox list on any page scroll that contains the
   trigger. A `focus()`, `fill()` or click on an off-screen field scrolls the page, and that
   scroll's event arrives a frame after the list has opened, so the list closed by itself (found
   by sampling the option count per frame). The spec's `onScreen` scrolls the row into view and
   waits two animation frames first. Recorded in the feat commit body. The component is not
   changed: it is React Aria's designed behaviour (see Issues).
2. **[Rule 1, test] The empty list's placeholder row.** React Aria wraps `renderEmptyState` in a
   row with the option role, so the zero-options test counts keyed options (`[data-key]`) rather
   than `option` roles.
3. **[Rule 1, test] Phone sizes are layout sizes.** Measured mid-way through the popover's
   scale-in entrance, an option's bounding box read 42.68 px; the test reads `offsetHeight` and
   `offsetWidth` instead. The long-option truncation check moved to 390 px, where the popover is
   at its widest; at 1280 px it is wide enough for the sample label.
4. **Duplication left for a follow-up.** `OptionItem` and `isGroup` (about 20 lines) repeat
   Select.tsx's, because Select.tsx is outside this plan's file list. A later plan that touches
   both (02-19 or the CategoryPicker plan) should export them once, for example from Select.tsx.

**Total deviations:** 3 test-harness fixes, 1 deferred de-duplication. **Impact:** none on scope.

## Issues Encountered

- **Risk for 02-19 (real, not only a test artefact):** with `menuTrigger="focus"`, focusing a
  Combobox that is partly off screen (Tab in a long form, or a phone keyboard scrolling the page)
  opens the list and the following scroll event closes it again. Plan 02-19 should check the
  payee field in the phone sheet and the desktop row; if it bites, the fix belongs in the
  Combobox (for example opening on focus once the scroll has settled).
- While a Combobox list is open, React Aria hides the rest of the page from assistive technology
  (`ariaHideOutside`), so `getByRole` finds nothing outside the field and its list until the list
  closes. Specs that Tab onto a focus-opening Combobox press Escape first.

## Verification

- `npm --prefix client test -- src/components/ui/Combobox.test.ts`: 18 passed
- `npm --prefix e2e test -- --project=gallery tests/gallery/combobox.spec.ts`: 13 passed (run
  twice in a row)
- `npm --prefix e2e test -- --project=gallery` (whole gallery): 70 passed, 2 skipped (the pixel
  tests, which run on Linux only)
- `npm --prefix client run build`: built
- `npm --prefix lint test`: 86 passed, 0 failed; `npm --prefix lint run lint`: 0 errors, 128
  warnings (at the cap, none in this plan's files)
- `grep -rl "ui/Combobox'" client/src`: only `client/src/pages/devGallery/ComboboxCard.tsx`
  (Combobox.test.ts imports `./Combobox`); no screen uses it
- No package or lockfile changed; no STATE.md or ROADMAP.md change

## User Setup Required

None.

## Next Phase Readiness

Plan 02-19 can make PayeeCombobox a wrapper over this Combobox without changing it, subject to
the focus-then-scroll risk and the Escape-in-Modal check above. Plan 02-11 adds the pixel
baselines and the phone measurements for this card.

## Self-Check: PASSED

- Files exist: Combobox.tsx, Combobox.test.ts, ComboboxCard.tsx, combobox.spec.ts, this SUMMARY
- Commits exist: 12ed0fd, c7142c0, 41f044d, c46e47c
- Combobox.tsx imports from react-aria-components and `fieldSubject` from `./fieldMessages`, and
  holds the exact empty-state strings
