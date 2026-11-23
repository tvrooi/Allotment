---
phase: 02-shared-form-controls
plan: 13
subsystem: ui
tags: [react, react-aria-components, checkbox, radiogroup, switch, playwright, vitest]

requires:
  - phase: 02-shared-form-controls
    provides: "Switch (02-15), FieldDescription/FieldErrorText (02-06), requiredMessage/fieldSubject (02-16), gallery conventions (02-04)"
provides:
  - "ui/Checkbox.tsx: Checkbox with five states, indeterminate, help text, error line and the default required line"
  - "ui/RadioGroup.tsx: RadioGroup and Radio with vertical/horizontal layout, help text and error line"
  - "Switch props description, errorMessage, errorLabel, isRequired"
  - "fieldMessages.ts: ToggleNames type and toggleNames() mapping a toggle's children/aria-label onto fieldSubject"
  - "Gallery Checkbox and RadioGroup cards; Switch card with Help text and Error label specimens"
affects: [02-14, 02-11]

actuals:
  tokens: 28000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Toggles on React Aria's non-deprecated Field + Button pairs (CheckboxField/CheckboxButton, RadioField/RadioButton, SwitchField/SwitchButton)"
    - "Toggle indicator edge drawn as a 1 px inset ring, so the shared toggleDisabled/toggleReadOnly/toggleInvalid classes swap it without resizing"
    - "Phone target: max-md:min-h-11 max-md:min-w-11 max-md:py-3 with items-start keeps the 20 px indicator level with a wrapping label's first line"

key-files:
  created:
    - client/src/components/ui/Checkbox.tsx
    - client/src/components/ui/Checkbox.test.ts
    - client/src/components/ui/RadioGroup.tsx
    - client/src/components/ui/RadioGroup.test.ts
    - client/src/pages/devGallery/ToggleCards.tsx
    - e2e/tests/gallery/toggles.spec.ts
  modified:
    - client/src/components/ui/Switch.tsx
    - client/src/components/ui/Switch.test.ts
    - client/src/components/ui/fieldMessages.ts
    - client/src/pages/DevControlsGallery.tsx
    - client/src/pages/devGallery/SwitchCard.tsx
    - e2e/tests/gallery/switch.spec.ts
    - e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-light.png
    - e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-dark.png

key-decisions:
  - "ToggleNames/toggleNames live in fieldMessages.ts beside fieldSubject, so Checkbox and Switch share one naming type and mapping instead of two"
  - "The field wrapper is className 'contents' when there is no help or error line, so a bare Switch keeps plan 02-15's exact markup"
  - "RadioGroup takes a string label (as Select does), so its FieldNames narrow without a cast"

patterns-established:
  - "A required toggle's default line: requiredMessage('toggle', fieldSubject(toggleNames(props))); a caller's errorMessage wins; not required and no message means no line"

requirements-completed: [WAVG-02, WAVG-03]

coverage:
  - id: D1
    description: "Checkbox: states, indeterminate, Space, focus ring, 44 px phone target, wrapping label, help text, default/required/errorLabel/aria-label/errorMessage lines"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/Checkbox.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/toggles.spec.ts (Checkbox tests, 1280/390, light/dark)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RadioGroup: span label, arrow keys in order, one Tab stop, read-only, 44 px target, horizontal layout, 'Select {subject} to continue' in both naming forms"
    requirement: WAVG-03
    verification:
      - kind: unit
        ref: "client/src/components/ui/RadioGroup.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/toggles.spec.ts (RadioGroup tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Switch help text, error line and required message; unchanged markup without the new props; Welcome switches unchanged"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/ui/Switch.test.ts#a Switch with none of the new props renders the markup it had before them"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/switch.spec.ts; e2e/tests/first-run.spec.ts; e2e/tests/accessibility.spec.ts (desktop)"
        status: pass
      - kind: automated_ui
        ref: "playwright:switch-card-light.png, switch-card-dark.png (Linux container compare)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-18
status: complete
---

# Phase 02 Plan 13: Checkbox, RadioGroup and the finished Switch Summary

**Shared Checkbox and RadioGroup on React Aria's Field/Button pairs, plus the Switch's help text and error line, all wired through FieldDescription, FieldErrorText and requiredMessage. Each shows "Turn on/Select {subject} to continue" when required and invalid.**

## Performance

- **Duration:** about 75 min
- **Completed:** 2026-11-18
- **Tasks:** 3 of 3
- **Files:** 6 created, 8 modified

## Accomplishments

- `Checkbox`: checked, indeterminate, disabled (surface-alt, no brand colour, no opacity), read-only (text-secondary fill, `aria-readonly`), and invalid (negative ring, `aria-invalid`). It is a 44 px target on phones with or without a label, and a long label wraps with the box level with its first line.
- `RadioGroup` / `Radio`: a span label (no stray `<label>`), arrow keys in listed order, one Tab stop, and read-only blocks changes. Layout is vertical (`gap-2`) or horizontal and wrapping (`gap-x-4 gap-y-2`). The default line works for both naming forms: "Select Repeat to continue" and "Select Frequency to continue".
- `Switch`: `description`, `errorMessage`, `errorLabel` and `isRequired`. A Switch without them renders byte-identical markup, proved by an inline snapshot recorded before the change. `Welcome.tsx` and `first-run.spec.ts` are untouched and pass.

### How a toggle ties its help and error lines to its input in React Aria

Each toggle renders React Aria's field component (`CheckboxField`, `SwitchField`, `RadioGroup`). That component provides a `TextContext` with a `description` slot and a `FieldErrorContext`. `FieldDescription` (`<Text slot="description">`) and `FieldErrorText` (`<FieldError>`) from `ui/Field.tsx` are rendered as children of the field, after the button. React Aria then puts their ids into the hidden input's `aria-describedby` (for RadioGroup, the radiogroup's). React Aria's `useSlotId` drops an id whose element is absent, so no line means no stale id in the browser. With neither line, the field `div` is `contents` and adds no box. `FieldError` renders only while the field is invalid, and the component renders it only when there is a message.

### How the props require `errorLabel` for a label that is not plain text

`ToggleNames` in `fieldMessages.ts` is a union. Each member allows one way of naming the toggle:

- a string `children`;
- any `children` plus an `aria-label`;
- a React-node `children` with `isRequired?: false`;
- a React-node `children` with `isRequired: true` and `errorLabel: string`.

So a required toggle named only by a node fails to compile unless it passes `errorLabel`. The `@ts-expect-error` cases `requiredNode` in `Checkbox.test.ts` and `Switch.test.ts` prove this, and `tsc -b` checks them. `toggleNames()` maps `children`/`aria-label` onto `fieldSubject`'s `FieldNames` by narrowing, with no cast.

## Task Commits

1. **Task 1: Checkbox:** `5890f90` (test), `5c3f789` (feat)
2. **Task 2: RadioGroup:** `0af4851` (test), `a0baeb3` (feat)
3. **Task 3: Switch help and error lines:** `063da5b` (test), `4a82147` (feat, includes the regenerated baselines)

## Files Created/Modified

- `client/src/components/ui/Checkbox.tsx`: the shared Checkbox
- `client/src/components/ui/RadioGroup.tsx`: `RadioGroup` and `Radio`
- `client/src/components/ui/Switch.tsx`: the four new props
- `client/src/components/ui/fieldMessages.ts`: `ToggleNames` and `toggleNames`
- `client/src/pages/devGallery/ToggleCards.tsx`: Checkbox card (9 specimens) and RadioGroup card (6 specimens)
- `client/src/pages/devGallery/SwitchCard.tsx`: required Invalid, plus Help text and Error label specimens
- `client/src/pages/DevControlsGallery.tsx`: mounts the two new cards before the Switch card
- Tests: `Checkbox.test.ts` (15), `RadioGroup.test.ts` (14), `Switch.test.ts` (15, including the markup snapshot), `e2e/tests/gallery/toggles.spec.ts` (20), `switch.spec.ts` (+3)

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

**1. [Rule 2: avoid a second copy] `fieldMessages.ts` edited (not in `files_modified`)**
- **Issue:** Checkbox and Switch both need the same naming union and the same children/aria-label mapping onto `fieldSubject`. Writing it in each file would be a duplicate (P1).
- **Fix:** I added `ToggleNames` and `toggleNames()` beside `fieldSubject`. No wording changed.
- **Committed in:** `5c3f789`

**2. Indicator edge is an inset ring rather than `border`**
- The UI spec writes `border border-text-tertiary`. I drew a 1 px inset ring instead, which looks identical. That way the shared `toggleDisabled` / `toggleReadOnly` (inset ring) and `toggleInvalid` classes replace it without a doubled edge or a size change. The unit tests assert `ring-text-tertiary`.

**3. Alignment uses `items-start`, not the spec's `items-center`**
- The plan says `items-start`, and the long-label truth needs it. Phones add `max-md:py-3`, so the 20 px box stays centred in the 44 px target and level with the first line. The browser test measures this at 1280 and 390 px.

**4. The browser spec repeats `tokenColour` and `strayLabels`**
- `toggles.spec.ts` defines its own `tokenColour` and `strayLabels`, as `switch.spec.ts`, `text-fields.spec.ts` and `dates.spec.ts` already do. Moving them into `gallery.ts` is outside this plan's files and is left as a follow-up.

**Total deviations:** 4, none changing behaviour beyond the plan.

## Issues Encountered

- **`bash e2e/gallery-baselines.sh` exits 1 in the container because of an existing Combobox failure, not this plan.** `combobox.spec.ts:134` ("without custom values the field returns to the chosen label…") failed in both `--update` runs. Running the same image on the untouched base commit `3b1a569` fails the same test, plus `combobox.spec.ts:254`. So the Combobox failure was already there before this plan. On macOS the whole Combobox spec passes 42/42 (`--repeat-each=3`).
- Because the script stops before copying when any test fails, I regenerated the Switch baselines with the script's own steps, limited to `switch.spec.ts` (same image `playwright:v1.64.0-noble`, linux/amd64, `--update-snapshots=changed`). A `CI=1` compare in the container then passed 10/10. I looked at both images before committing them.
- **Plan gate status:** the script's full `bash e2e/gallery-baselines.sh` does **not** pass, because of that Combobox failure. The orchestrator should treat this as an open item for the Combobox owner (plan 02-08/02-10 territory).

## Verification

- `npm --prefix client test -- src/components/ui/Checkbox.test.ts`: 15 passed
- `npm --prefix client test -- src/components/ui/RadioGroup.test.ts`: 14 passed
- `npm --prefix client test -- src/components/ui/Switch.test.ts`: 15 passed
- Full client unit suite: 812 passed (91 files)
- `npm --prefix e2e test -- --project=gallery tests/gallery/toggles.spec.ts`: 20 passed
- `npm --prefix e2e test -- --project=gallery tests/gallery/switch.spec.ts`: 8 passed, 2 pixel tests skipped (macOS)
- Plan-exit gate `npm --prefix e2e test -- --project=gallery`: 108 passed, 2 skipped (macOS)
- `npm --prefix e2e test -- --project=desktop tests/first-run.spec.ts tests/accessibility.spec.ts`: 21 passed
- Switch baselines compare in the Linux container: 10/10 passed. The full `bash e2e/gallery-baselines.sh` fails only on the existing Combobox test (see Issues).
- `grep -c requiredMessage`: Checkbox.tsx 2, Switch.tsx 2
- Lint: 86 tests pass; 0 errors, 126 warnings (cap 128), none in changed files
- `npm --prefix client run build`: ok (`tsc -b` checks the `@ts-expect-error` naming cases)
- `grep -rl "ui/Checkbox'"` and `"ui/RadioGroup'"` in `client/src`: only `pages/devGallery/ToggleCards.tsx`. No screen moved onto them, and Welcome.tsx is unchanged.
- No package or lockfile changed.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-11's matrix can picture the Checkbox and RadioGroup cards and needs their baselines. Plan 02-14 can use all three toggles.
- Open item: the Combobox gallery test that fails in the Linux container, which also fails on the base commit.

## Self-Check: PASSED
