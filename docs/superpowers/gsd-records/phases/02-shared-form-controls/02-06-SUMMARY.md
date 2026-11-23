---
phase: 02-shared-form-controls
plan: 06
subsystem: ui
tags: [react-aria-components, tailwind, forms, accessibility, playwright]
requires:
  - phase: 02-shared-form-controls
    provides: "02-04/02-15 gallery (GalleryCard, Specimen, openGallery, specimen); 02-15 toggle strings in fieldClasses.ts; 02-05 layered global :focus-visible rule"
provides:
  - "fieldBase, fieldHeights, fieldStates, labelClass, helpClass, errorClass in client/src/components/ui/fieldClasses.ts"
  - "Label (ui/Label.tsx): React Aria Label, isRequired mark, elementType label|span"
  - "Field, FieldDescription, FieldErrorText (ui/Field.tsx) on React Aria TextField"
  - "Input rebuilt on React Aria Input with fieldSize and isInvalid; native Select unchanged"
  - "CurrencyInput placeholder on text-tertiary (4.5:1)"
  - "Gallery cards Label, Field, Input, Money entry; e2e/tests/gallery/text-fields.spec.ts"
affects: [02-16 Textarea and default messages, 02 Select/Combobox/DatePicker plans, phase 03 screen moves, phase 04 Select removal]
tech-stack:
  added: []
  patterns:
    - "Field = React Aria TextField: the child Input/TextArea picks up label id/for, aria-describedby, aria-invalid, required, disabled, readOnly from TextField's InputContext; the child's own value/onChange win over the context's (mergeProps), so callers stay controlled as before"
    - "State classes apply through native attributes and React Aria data attributes alike; read-only uses [&[readonly]] because :read-only also matches disabled inputs"
    - "Width stays out of fieldBase: Input's default className is w-full and a caller's width replaces only that"
key-files:
  created:
    - client/src/components/ui/Label.tsx
    - client/src/components/ui/Field.tsx
    - client/src/components/ui/Field.test.ts
    - client/src/components/ui/Input.test.ts
    - client/src/components/ui/CurrencyInput.test.ts
    - client/src/pages/devGallery/TextFieldCards.tsx
    - e2e/tests/gallery/text-fields.spec.ts
  modified:
    - client/src/components/ui/fieldClasses.ts
    - client/src/components/ui/Input.tsx
    - client/src/components/ui/CurrencyInput.tsx
    - client/src/pages/DevControlsGallery.tsx
key-decisions:
  - "fieldBase leaves out w-full: putting it there would fight callers' w-20/w-32/w-auto; the default className keeps w-full exactly as before"
  - "Field derives isInvalid from the presence of errorMessage unless isInvalid is given, and renders the error only while invalid"
  - "Field keeps React Aria's default (native) validation behaviour so isRequired puts a real `required` on the input, as the plan asks; plan 02-16 adds the default required message"
  - "Input passes aria-invalid only when isInvalid is true or the caller set it, so bare inputs render no aria-invalid attribute"
  - "The native Select keeps its old class string (inputClass, now commented as Select's) byte-for-byte; only a Phase 4 comment line was added above it"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "An invalid Input inside a Field shows aria-invalid, a negative border and ring, and an error line it is described by"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/Field.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#an invalid Input inside a Field is marked, bordered and described by its error"
        status: pass
    human_judgment: false
  - id: D2
    description: "Focus ring without outline; Tab skips disabled and stops on read-only, which cannot be edited"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#Tab reaches the focus specimen with a ring and no outline, skips disabled, stops on read-only"
        status: pass
    human_judgment: false
  - id: D3
    description: "Placeholder in Input and CurrencyInput uses text-tertiary in light and dark"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/CurrencyInput.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#the amount field's placeholder uses the tertiary text colour"
        status: pass
    human_judgment: false
  - id: D4
    description: "At 390 px each field is ≥44 px tall with 16 px text, no sideways scroll, no stray labels, long text wraps and long values scroll in the box"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#the text-field cards hold together at 390 px"
        status: pass
    human_judgment: false
  - id: D5
    description: "Existing screens using Input still work"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "desktop: accounts, settings, transactions, accessibility, dialog-focus, confirm-and-save (92 passed); phone: targets-phone, phone-native (21 passed)"
        status: pass
    human_judgment: false
actuals:
  tokens: 8900
  tasks: 2
  commits: 4
commits: 4
plan_head_before: 03b4712d3bfed568b7624b5f8ba4a47cedc47982
plan_head_after: cfc995b354750281e9f94d35a7b7a43f193bac50
duration: 40min
completed: 2026-11-18
status: complete
---

# Phase 2 Plan 06: Text field foundation Summary

**Label, Field and Input on one set of token-only field classes over React Aria's TextField/Input, with every Input caller unchanged and CurrencyInput's placeholder lifted to the 4.5:1 tertiary token.**

## Performance

- Duration: about 40 minutes
- Tasks: 2/2
- Files: 11 (7 created, 4 modified)

## Accomplishments

- `fieldClasses.ts` gains `fieldBase`, `fieldHeights` (md `h-10`, sm `h-8`, both `max-md:min-h-11`),
  `fieldStates` (disabled, read-only, invalid via native and data attributes), `labelClass`,
  `helpClass`, `errorClass`; no hex colour, no `opacity-`.
- `Label` wraps React Aria's Label, adds an `aria-hidden` `*` (`ml-1 text-negative`) for
  `isRequired`, and renders as a `span` for non-labelable groups.
- `Field` (`flex flex-col gap-1`) composes Label, the control, `FieldDescription` and
  `FieldErrorText`; absent help or error renders nothing.
- `Input` keeps `forwardRef<HTMLInputElement, InputHTMLAttributes>` plus `fieldSize` and
  `isInvalid`; the 124 callers compile unchanged (`npm --prefix client run build`).
- Phone text in Input is now 16 px (`max-md:text-base`), as the contract asks; before it was 14 px.

## How Field ties a control to its label, help and error (for 02-16 and later plans)

`Field` renders React Aria's `TextField` with `isRequired`, `isInvalid`, `isDisabled`,
`isReadOnly` and `className`. TextField runs `useTextField` and publishes the results through
contexts: `LabelContext` (the label's `id` and `htmlFor`), `InputContext` and `TextAreaContext`
(the input's `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `required`, `disabled`,
`readOnly`, `value`, `onChange`), `TextContext` with `description` and `errorMessage` slots, and
`FieldErrorContext` (the validation state). Our `Label` is React Aria's Label, so it consumes
`LabelContext`; our `Input` is React Aria's Input, so it consumes `InputContext`;
`FieldDescription` is `<Text slot="description">` and `FieldErrorText` is `<FieldError>`, which
renders only while the field is invalid. React Aria merges context props under the child's own
props, so a child's `value` and `onChange` win (TextField's own onChange is chained and harmless).
A Textarea built on React Aria's `TextArea` gets the same wiring from `TextAreaContext` with no
change to Field. Other controls (Select, Checkbox, DatePicker) reuse `FieldDescription` and
`FieldErrorText` inside their own React Aria field components, which provide the same slot and
error contexts. Inside a Field the child should not pass `defaultValue` (TextField supplies a
`value`); pass `value` and `onChange`, as every gallery specimen does.

## Low-contrast placeholder left for Phase 3

These still use `placeholder-text-disabled` and move with the Transactions screens in Phase 3:

- `client/src/components/transactions/AddTransactionModal.tsx`
- `client/src/components/transactions/MerchantSelect.tsx`
- `client/src/components/transactions/TransactionFormRow.tsx`

## Task Commits

1. Task 1 tests: `1cced94` test(ui): shared Field and Input states (#267)
2. Task 1 code: `722b526` feat(ui): shared Label, Field and Input on one set of field classes (#267)
3. Task 2 tests: `611eb14` test(ui): amount placeholders must meet 4.5:1 (#267)
4. Task 2 fix: `cfc995b` fix(ui): CurrencyInput's placeholder uses the tertiary text colour (#267)

## Files Created/Modified

See frontmatter `key-files`.

## Decisions Made

See frontmatter `key-decisions`.

## Verification run

- `npm --prefix client test -- src/components/ui/Field.test.ts src/components/ui/Input.test.ts`: 16 passed
- `npm --prefix client test -- src/components/ui/`: 6 files, 46 passed
- `npm --prefix client run build`: built, no type error
- `npm --prefix e2e test -- --project=gallery tests/gallery/text-fields.spec.ts`: 12 passed
- `npm --prefix e2e test -- --project=gallery`: 21 passed, 2 skipped (Linux-only pixel baselines, by design)
- Desktop `accounts, settings, transactions, accessibility, dialog-focus, confirm-and-save`: 92 passed
- Phone `targets-phone, phone-native`: 21 passed
- `npm --prefix lint test`: 86 passed (includes `lint/tokens/contrast.test.js`); `npm --prefix lint run lint`: 0 errors, 128 warnings (at the cap; none in this plan's files)
- `grep -c 'export const Select' client/src/components/ui/Input.tsx`: 1
- `grep -c 'placeholder-text-disabled' client/src/components/ui/CurrencyInput.tsx`: 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `w-full` kept out of `fieldBase`**
- **Found during:** Task 1
- **Issue:** The plan lists full width in `fieldBase`, but callers pass their own widths (`w-20`, `w-32`, `w-auto`) that would then compete with `w-full` in the stylesheet order.
- **Fix:** `fieldBase` is `block` only; Input's default `className = 'w-full'` keeps today's behaviour.
- **Files modified:** client/src/components/ui/fieldClasses.ts
- **Commit:** 722b526

**2. [Rule 1 - Bug] Two assertions in the RED tests were too loose or too strict**
- **Found during:** Task 1
- **Issue:** `renderToStaticMarkup` prints React Aria's `readOnly` with its React casing, and the class name `aria-invalid:border-negative` contains the text `aria-invalid`.
- **Fix:** match `readonly` case-insensitively and match `aria-invalid=` as an attribute. No expectation was weakened.
- **Files modified:** client/src/components/ui/Field.test.ts, client/src/components/ui/Input.test.ts
- **Commit:** 722b526

**3. [Scope addition] An "Input, Small" specimen and extra spec cases**
- The Input card shows `fieldSize="sm"`, and the spec also checks the invalid focus ring, disabled colours without opacity, wrapping of long text, a long value scrolling in its box, and that clearing leaves `''` (E-02). All within the listed files.

## Threat Flags

None. No raw HTML insertion, no new network or storage surface; Input passes `type` and
`autoComplete` through unchanged (unit test pins a password field).

## Self-Check: PASSED

- FOUND: client/src/components/ui/Label.tsx, Field.tsx, Field.test.ts, Input.test.ts, CurrencyInput.test.ts
- FOUND: client/src/pages/devGallery/TextFieldCards.tsx, e2e/tests/gallery/text-fields.spec.ts
- FOUND commits: 1cced94, 722b526, 611eb14, cfc995b (ancestors of HEAD)
- STATE.md and ROADMAP.md untouched
