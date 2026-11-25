---
phase: 02-shared-form-controls
plan: 16
subsystem: client/ui
tags: [ui, form-controls, field, textarea, copywriting]
requires:
  - phase: 02-shared-form-controls
    plan: 06
    provides: "Field, FieldDescription, FieldErrorText; fieldBase/fieldStates; TextFieldCards; text-fields.spec.ts"
provides:
  - "client/src/components/ui/fieldMessages.ts: requiredMessage, incompleteDateMessage, dateRangeMessage, monthRangeMessage, fieldSubject (and the FieldNames, RequiredKind types)"
  - "Field: errorLabel and the default required line"
  - "client/src/components/ui/Textarea.tsx: Textarea"
  - "Gallery: 'Field, Required' specimen and the Textarea card"
affects: [02-07, 02-08, 02-09, 02-13, 02-11]
key-files:
  created:
    - client/src/components/ui/fieldMessages.ts
    - client/src/components/ui/fieldMessages.test.ts
    - client/src/components/ui/Textarea.tsx
    - client/src/components/ui/Textarea.test.ts
  modified:
    - client/src/components/ui/Field.tsx
    - client/src/components/ui/Field.test.ts
    - client/src/pages/devGallery/TextFieldCards.tsx
    - e2e/tests/gallery/text-fields.spec.ts
key-decisions:
  - "fieldSubject takes a union of three object shapes (FieldNames), so a call with no string name does not compile"
  - "Field's props are a union too: a string label, or a React node label with a required errorLabel"
  - "dateRangeMessage/monthRangeMessage take a tuple union of bounds, so a call with neither bound does not compile"
  - "Textarea is full width by default (className = 'w-full'), like Input"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - deliverable: "Default messages and fieldSubject"
    kind: unit
    ref: "client/src/components/ui/fieldMessages.test.ts"
  - deliverable: "Field default required line"
    kind: e2e
    ref: "e2e/tests/gallery/text-fields.spec.ts#a required, empty Field shows the default line in the negative colour"
  - deliverable: "Textarea states match Input"
    kind: e2e
    ref: "e2e/tests/gallery/text-fields.spec.ts#the Textarea is at least 80 px tall and looks like Input in every state"
  - deliverable: "Textarea long text on a phone"
    kind: e2e
    ref: "e2e/tests/gallery/text-fields.spec.ts#a long Textarea value wraps and scrolls inside its box on a phone"
  - deliverable: "Textarea empty value (E-02)"
    kind: e2e
    ref: "e2e/tests/gallery/text-fields.spec.ts#clearing a Textarea leaves an empty string, never null"
duration: ~35 min
completed: 2026-11-18
---

# Phase 02 Plan 16: Default field messages, the subject rule, and Textarea Summary

**The contract's default error wording and the one rule that names a control (`fieldSubject`)
now live once in `ui/fieldMessages.ts`; Field shows "Enter {subject} to continue" when it is
required, invalid and given no message; and the shared Textarea matches Input in every state.**

## Performance

- Tasks: 2 of 2, 5 commits
- Files: 4 created, 4 modified

## Accomplishments

- `fieldMessages.ts`: `requiredMessage(kind, subject)` for text, choice and toggle;
  `incompleteDateMessage(example)`; `dateRangeMessage` and `monthRangeMessage`, bounds formatted
  through `formatDay` and `formatMonth` (no date arithmetic or slicing); `fieldSubject`.
- Field: optional `errorLabel`; a required, invalid Field with no `errorMessage` shows the
  default line through `FieldErrorText`, so the input is described by it; a supplied message
  wins; an invalid, not-required Field shows no default line.
- Textarea on React Aria's TextArea: `fieldBase` + `fieldStates`, `rows` 3, `min-h-20`, `py-2`,
  `resize-y`, vertical scroll, optional `isInvalid`; works bare and inside a Field.
- Gallery: "Field, Required" specimen; Textarea card with Default (in a Field), Focus,
  Disabled, Invalid, Read-only and Long text specimens. The Textarea card joins the shared card
  loop (stray labels, tertiary placeholder, 44 px / 16 px at 390 px, both themes) and the
  disabled-look test.

## The `fieldSubject` signature (later plans map their props onto it)

```ts
export type FieldNames =
  | { errorLabel: string; label?: ReactNode; ariaLabel?: string }
  | { errorLabel?: string; label: string; ariaLabel?: string }
  | { errorLabel?: string; label?: ReactNode; ariaLabel: string };

export function fieldSubject({ errorLabel, label, ariaLabel }: FieldNames): string;
```

Each shape makes one of the three names a `string`, so `fieldSubject({})` and
`fieldSubject({ label: <node> })` do not compile (both are pinned with `@ts-expect-error` in
`fieldMessages.test.ts`, checked by `tsc`). At run time it returns the first non-empty string of
`errorLabel`, the label when it is a string, then `ariaLabel`; an empty string falls through. The
return type is `string`; the only way to get `''` is a caller passing empty strings for every
name. Controls map `aria-label` to `ariaLabel` and a toggle's `children` to `label`.

`Field` uses it with `fieldSubject(props)`: its props are
`{ label: string; errorLabel?: string } | { label: ReactNode; errorLabel: string }` plus the
rest, which is assignable to `FieldNames`.

## Task Commits

1. Task 1 tests: `9038186` test(ui): the contract's default field messages and their subject (#267)
2. Task 1 code: `735bec6` feat(ui): one rule for a control's subject, and Field's default required message (#267)
3. Task 2 tests: `1e12742` test(ui): the shared Textarea's states (#267)
4. Task 2 code: `08f0916` feat(ui): the shared Textarea (#267)
5. Follow-up: `9cb4bc5` docs(ui): Field's comment points at fieldMessages.ts for the default line (#267)

## Files Created/Modified

See frontmatter `key-files`.

## Decisions Made

See frontmatter `key-decisions`.

## Verification run

All on Node 24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`).

- `npm --prefix client test -- src/components/ui/fieldMessages.test.ts src/components/ui/Field.test.ts`: 2 files, 25 passed (RED first: Field's 2 new cases failed, fieldMessages.test.ts failed to import)
- `npm --prefix e2e test -- --project=gallery tests/gallery/text-fields.spec.ts` (after Task 1): 13 passed
- `grep -c 'export function fieldSubject' client/src/components/ui/fieldMessages.ts`: 1
- `grep -c toISOString client/src/components/ui/fieldMessages.ts`: 0
- `(cd client && npx tsc --noEmit)`: no error (after each task)
- Mutation, run once and reverted: removing `ariaLabel` from `fieldSubject`'s names made 4 tests fail, including "uses the aria-label when there is no visible label"
- `npm --prefix client test -- src/components/ui/Textarea.test.ts src/components/ui/`: 8 files, 68 passed
- `npm --prefix e2e test -- --project=gallery`: 25 passed, 2 skipped (Linux-only pixel baselines, by design)
- `npm --prefix client run build`: built
- `npm --prefix lint test`: 86 passed; `npm --prefix lint run lint`: 0 errors, 128 warnings (at the cap, none in this plan's files)
- `grep -rl "ui/Textarea'" client/src`: only `pages/devGallery/TextFieldCards.tsx` (the unit test imports `./Textarea`); no screen uses it
- `grep -rl "to continue" client/src/components/ui --include='*.tsx' --include='*.ts' | grep -v test`: only `fieldMessages.ts`
- Prettier: all changed files formatted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Field's props require `errorLabel` for a non-string label**
- **Found during:** Task 1
- **Issue:** The plan makes `errorLabel` optional on a Field whose `label` is any React node, but `fieldSubject` must not receive a node label with no string name.
- **Fix:** Field's props are a union: a string `label` (with optional `errorLabel`), or a node `label` with a required `errorLabel`. No screen uses Field yet; every gallery Field has a string label.
- **Files modified:** client/src/components/ui/Field.tsx
- **Commit:** 735bec6

**2. [Rule 2 - Missing critical] Range messages refuse a call with neither bound**
- **Found during:** Task 1
- **Issue:** `dateRangeMessage(undefined, undefined)` would have no wording in the contract.
- **Fix:** both functions take a tuple union `[min: string, max?] | [min: undefined, max: string]`.
- **Files modified:** client/src/components/ui/fieldMessages.ts
- **Commit:** 735bec6

**3. [Rule 1 - Bug] Field's comment repeated the default wording**
- **Found during:** plan verification (the "to continue" grep listed Field.tsx)
- **Fix:** the comment now points at fieldMessages.ts instead of quoting the line.
- **Commit:** 9cb4bc5

**4. [Rule 3 - Blocking] Textarea test's Field call failed `tsc`**
- `createElement(Field, props, child)` does not match the union props overload; the test passes `children` in the props object instead. Fixed in 08f0916.

**Empty-value check (E-02):** a Node test with no DOM cannot fire a change event, so the unit test checks that Textarea hands the caller's `onChange` and `''` value to the element unchanged, and the browser test fills then clears the gallery Textarea and reads `''`.

## Threat Flags

None. All text renders as React children (T-02-40); T-02-39 is mitigated by the `FieldNames`
type and the "never undefined" unit test. No package or lockfile changed (T-02-SC).

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None.

## Next Phase Readiness

Plans 02-07, 02-08, 02-09 and 02-13 import `fieldSubject` and `requiredMessage` from
`ui/fieldMessages.ts` (choice: `'choice'`, toggle: `'toggle'`); DatePicker and MonthPicker use
`incompleteDateMessage`, `dateRangeMessage` and `monthRangeMessage`. Plan 02-11 adds pixel
baselines for the new specimens.

## Self-Check: PASSED

- FOUND: client/src/components/ui/fieldMessages.ts, fieldMessages.test.ts, Textarea.tsx, Textarea.test.ts
- FOUND: client/src/components/ui/Field.tsx, Field.test.ts, client/src/pages/devGallery/TextFieldCards.tsx, e2e/tests/gallery/text-fields.spec.ts
- FOUND commits: 9038186, 735bec6, 1e12742, 08f0916, 9cb4bc5 (ancestors of HEAD)
- STATE.md and ROADMAP.md untouched
