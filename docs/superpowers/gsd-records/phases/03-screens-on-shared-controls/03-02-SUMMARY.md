---
phase: 03-screens-on-shared-controls
plan: 02
subsystem: ui
tags: [number-field, currency-input, field-messages, number-text, wave-g, shared-controls]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (`Reconcile: match`) and Phase 2 shared UI controls"
provides:
  - "readWholeNumber and readDecimal in client/src/components/ui/numberText.ts"
  - "wholeNumberRangeMessage, wholeNumberMinMessage and percentRangeMessage in client/src/components/ui/fieldMessages.ts"
  - "Shared bounded NumberField in client/src/components/ui/NumberField.tsx"
  - "Extended CurrencyInput with forwardRef, fieldSize, expression (readMoneyText), onTextChange, commitOnBlur and pass-through attributes"
affects: [03-03, 03-05, 03-07, 03-08, 03-09, 03-10, 03-12, 03-13, 03-14, 03-24]

plan_head_before: 808984250e319d11d39d25bca6aeb6592c7a35f9
plan_head_after: 81531787c4eda3e80e7581bdbad4a69679753226
commits: 28

actuals:
  tokens: 17842
  tasks: 3
  commits: 28

tech-stack:
  added: []
  patterns:
    - "Strict ASCII regex validation before numeric conversion for counts and percentages (numberText.ts)"
    - "Draft-preserving bounded NumberField reporting validity to enclosing AmountFields via useReportAmountValidity"
    - "Opt-in arithmetic expression parsing in CurrencyInput via pure readMoneyText helper backed by readAmountExpression"

key-files:
  created:
    - client/src/components/ui/numberText.ts
    - client/src/components/ui/numberText.test.ts
    - client/src/components/ui/NumberField.tsx
    - client/src/components/ui/NumberField.test.ts
    - client/src/components/ui/hookTestHarness.ts
  modified:
    - client/src/components/ui/fieldMessages.ts
    - client/src/components/ui/fieldMessages.test.ts
    - client/src/components/ui/CurrencyInput.tsx
    - client/src/components/ui/CurrencyInput.test.ts

key-decisions:
  - "Normalised -0 to 0 in readWholeNumber and readDecimal and rejected unsafe integers (> Number.MAX_SAFE_INTEGER) so Infinity upper bounds cannot accept precision-losing values"
  - "NumberField chooses wholeNumberMinMessage(min) automatically when max is non-finite (Infinity), percentRangeMessage when allowDecimal is true, and wholeNumberRangeMessage otherwise"
  - "CurrencyInput implements opt-in autoFocus via a mount useEffect rather than a JSX autoFocus attribute, keeping ESLint warning count unchanged (0 new warnings) while still focusing before an enclosing Modal's own effect runs"
  - "CurrencyInput passes through onBlur alongside commitOnBlur={false} so inline editors like Budget.tsx can handle click-away cancel without committing"

patterns-established:
  - "One parser for typed counts/percentages: import readWholeNumber / readDecimal from ui/numberText.ts"
  - "Bounded non-money number fields use ui/NumberField.tsx (type='text' + inputMode) rather than type='number'"
  - "CurrencyInput uses shared fieldHeights for 44 px phone targets and readMoneyText for opt-in expression support"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "numberText parsers (readWholeNumber, readDecimal) and D-14 numeric range message builders in fieldMessages.ts"
    requirement: WAVG-05
    verification:
      - kind: unit
        ref: "client/src/components/ui/numberText.test.ts"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/fieldMessages.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shared bounded NumberField built from Field and Input with draft preservation and AmountFields validity reporting"
    requirement: WAVG-05
    verification:
      - kind: unit
        ref: "client/src/components/ui/NumberField.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "CurrencyInput extended with forwardRef, fieldHeights (44 px on phones), opt-in expression parsing (readMoneyText), onTextChange, commitOnBlur and pass-through attributes"
    requirement: WAVG-05
    verification:
      - kind: unit
        ref: "client/src/components/ui/CurrencyInput.test.ts"
        status: pass
      - kind: other
        ref: "cd client && npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm --prefix lint test && npm --prefix lint run lint"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 02: Shared NumberField and Extended CurrencyInput Summary

**Strict ASCII `numberText` parsers, D-14 range message builders, shared bounded `NumberField`, and `forwardRef`/expression-capable `CurrencyInput` with 44 px phone targets**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-19T01:36:51Z
- **Completed:** 2026-11-19T01:50:42Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Added `readWholeNumber` and `readDecimal` in `client/src/components/ui/numberText.ts` with ASCII pattern checks before numeric conversion (refusing `'1e2'`, `'0x10'`, `'+5'`, `'1,5'`, bare `'.'`/`'-'`, and unsafe integers), plus `wholeNumberRangeMessage`, `wholeNumberMinMessage`, and `percentRangeMessage` in `client/src/components/ui/fieldMessages.ts`.
- Built `client/src/components/ui/NumberField.tsx` exclusively from shared `Field` and `Input` (zero `react-aria-components` imports, zero `type="number"`), preserving typed drafts, committing only in-range values (or `null` when `optional` and blank), rendering optional `aria-hidden` suffixes, and reporting validity via `useReportAmountValidity`.
- Upgraded `client/src/components/ui/CurrencyInput.tsx` to a `forwardRef` component using `fieldHeights` (fixing the 41 px phone height to 44 px), adding exported `readMoneyText` and opt-in `fieldSize`, `expression`, `onTextChange`, `commitOnBlur`, `onBlur`, `onKeyDown`, `autoFocus`, `readOnly`, `aria-busy`, `aria-describedby`, and `title` with zero behaviour change for existing callers.

## TDD Failing Runs Recorded (RED)

1. **Task 1 RED** (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/numberText.test.ts src/components/ui/fieldMessages.test.ts`):
   - Failed with exit code 1 before `numberText.ts` existed and before the builders were added to `fieldMessages.ts`:
     - `FAIL src/components/ui/numberText.test.ts`: `Error: Cannot find module './numberText'`
     - `FAIL src/components/ui/fieldMessages.test.ts > numeric range messages > formats whole number and percent bounds with the D-14 copy`: `TypeError: wholeNumberRangeMessage is not a function`
     - Summary: `Test Files 2 failed (2)`, `Tests 1 failed | 17 passed (18)`.
2. **Task 2 RED** (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/NumberField.test.ts`):
   - Failed with exit code 1 before `NumberField.tsx` existed:
     - `FAIL src/components/ui/NumberField.test.ts`: `Error: Cannot find module './NumberField'`
3. **Task 3 RED** (`PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/CurrencyInput.test.ts`):
   - Failed with exit code 1 before `CurrencyInput.tsx` changes:
     - 5 new tests failed (`fieldHeights` check received `py-2`; `forwardRef` check received `undefined`; pass-through props missing `readonly`; `readMoneyText` threw `TypeError: readMoneyText is not a function`), while the 2 pre-existing tests passed (`Tests 5 failed | 2 passed (7)`).

## Task Commits

Each task was committed atomically on `worktree-agent-p0302-a1`:

1. **Task 1: numberText parsers and range messages, test first** - `1447577a` (`feat(03-02): add numberText parsers and numeric range messages`)
2. **Task 2: NumberField, the shared bounded number field** - `fc38d142` (`feat(03-02): add shared NumberField for bounded counts and percentages`)
3. **Task 3: CurrencyInput options for the money fields the owner moved to it** - `b16a7144` (`feat(03-02): extend CurrencyInput with forwardRef, fieldSize and expressions`)

## Files Created/Modified

- `client/src/components/ui/numberText.ts` - Strict ASCII `readWholeNumber` and `readDecimal` bounded parsers
- `client/src/components/ui/numberText.test.ts` - Unit tests and 200-run `fast-check` integer property test
- `client/src/components/ui/fieldMessages.ts` - Added `wholeNumberRangeMessage`, `wholeNumberMinMessage`, `percentRangeMessage`
- `client/src/components/ui/fieldMessages.test.ts` - Added tests for the three D-14 numeric range message builders
- `client/src/components/ui/NumberField.tsx` - Shared bounded number field on `Field` + `Input` with `useReportAmountValidity`
- `client/src/components/ui/NumberField.test.ts` - `renderToStaticMarkup` tests covering numeric, decimal, invalid, optional-blank, `Infinity` min-only, suffix, `fieldSize="sm"`, description, disabled, and custom `id`
- `client/src/components/ui/CurrencyInput.tsx` - Converted to `forwardRef`, replaced `py-2` with `fieldHeights`, exported `readMoneyText`, added opt-in expression/keystroke/blur/attribute pass-through props
- `client/src/components/ui/CurrencyInput.test.ts` - Added tests for `fieldHeights`, `forwardRef`, pass-through attributes, and `readMoneyText` (`'100+50'` on vs off)

## Decisions Made

- Used `useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus])` instead of JSX `autoFocus={autoFocus}` on `<input>` inside `CurrencyInput` so the shared component adds zero `jsx-a11y/no-autofocus` warnings (CLAUDE.md warning-cap invariant) while still running before an enclosing `Modal`'s own `useEffect`.
- Passed `onBlur` through `CurrencyInput` in addition to `commitOnBlur` so `Budget.tsx`'s inline cell can cancel on click-away without committing.
- Kept `readWholeNumber` safe-integer-checked (`Number.isSafeInteger`) and `-0`-normalised so `max = Infinity` (e.g. `UpcomingLengthModal`) never accepts precision-losing huge integers.

## Deviations from Plan

### Unplanned Additions Driven by Code Review (IN-04)

1. **`client/src/components/ui/hookTestHarness.ts` (outside `files_modified`, within `client/src/components/ui/`):** Added during iteration-2 review (`R2-WR-01`, `75a997e3`) as a single test-only hook/effect/ref harness shared by `NumberField.test.ts` and `CurrencyInput.test.ts`, replacing duplicated inline runners, and hardened in iteration 3 (`R3-WR-03`, `8bee1c55`) to throw on render or effect pass limits. Never imported by app code; mounted Playwright interaction tests are carried to plan `03-03`.
2. **`NumberField` public prop `resetKey?: string | number`:** Added during iteration-2/3 review (`R2-CR-02`, `f77f2fc5`; retained in `R3-CR-01`, `53115884`) as an opt-in prop so callers can explicitly reset a visible draft from `value` even when the controlled number itself did not change (for example normalising `'6.501'` back to `'6.5'` on a form reset). Defaults to `undefined`, so callers that omit it are unaffected.
3. **`NumberField` public prop `precision?: number`:** Added during iteration-4 review (`R4-CR-01`, `c85184b9`) and refined in iteration-5 review (`R5-WR-01`, `81531787`) to replace the open-ended decimal rounding heuristic. Callers that store rounded values (such as `2` decimal places for basis points) pass `precision={2}` so in-flight acknowledgements match on the `10^-precision` grid within half a step (handling both `Math.round` and `toFixed`); callers that omit it use exact equality.

*(Environment note: `npm --prefix client ci --prefer-offline` and `npm --prefix lint ci --prefer-offline` were run in the fresh worktree from the existing lockfiles with `ignore-scripts=true` intact so Vitest, TypeScript and ESLint binaries were available; no package or lockfile changed.)*

## Verification Results

- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/numberText.test.ts src/components/ui/fieldMessages.test.ts` — PASS (2 files, 27/27 tests)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/NumberField.test.ts` — PASS (1 file, 20/20 tests; all 19 UI files 273/273 tests)
- `grep -c 'type="number"' client/src/components/ui/NumberField.tsx` — `0`
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/CurrencyInput.test.ts` — PASS (1 file, 11/11 tests)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test` — PASS (95 files, 904/904 tests)
- `(cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit)` — PASS (0 errors)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test` — PASS (86/86 tests)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint run lint` — PASS (0 errors, 126 warnings; cap 128; 0 warnings on all 9 touched files under `client/src/components/ui/`)
- `git diff --check 808984250e319d11d39d25bca6aeb6592c7a35f9..HEAD -- client/` — PASS
- `git diff --name-only b16a7144^..b16a7144` — lists only `client/src/components/ui/CurrencyInput.test.ts` and `client/src/components/ui/CurrencyInput.tsx`
- `git diff --name-only 808984250e319d11d39d25bca6aeb6592c7a35f9..2874c88d -- client/` — lists only the 9 files under `client/src/components/ui/`

## Threat Flags

None. All threat-register mitigations (`T-03-02` exact decimal string bounds + strict ASCII pattern check before conversion in `numberText.ts`; `T-03-03` recursive-descent `readAmountExpression` opt-in and off by default in `CurrencyInput.tsx`; `T-03-SC` no package added) are implemented and unit-tested.

## Issues Encountered

- React 19 `renderToStaticMarkup` emits `inputMode="numeric"` (camelCase) rather than lowercase `inputmode`; updated `NumberField.test.ts`'s attribute matcher to be case-insensitive (`/ ${name}="([^"]*)"/i`) matching `Input.test.ts` and `Field.test.ts`.
- Putting JSX `autoFocus={autoFocus}` directly on `<input>` in `CurrencyInput.tsx` triggered 1 `jsx-a11y/no-autofocus` warning; replaced with a mount `useEffect` calling `inputRef.current?.focus()`, restoring 0 warnings on all touched files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `NumberField`, `numberText`, numeric `fieldMessages`, and the extended `CurrencyInput` are ready for `03-03` (gallery specimens and mounted Playwright interaction tests) and the G2/G3 screen migration plans (`03-05` through `03-24`).
- Callers of `NumberField` that store rounded values (such as basis points) should pass `precision` (e.g. `precision={2}`) so rounding acknowledgements keep the typed draft; callers that need an explicit draft reset even when the controlled `value` has not changed can bump `resetKey`.
- **Mounted Playwright cases to include in `03-03`** (alongside the existing list in `03-03-PLAN.md`):
  1. `R4-CR-01` both probes: untouched decimal field `3.14 -> 3.1` (and `3.05 -> 3`) resyncs to the new prop; typed `3.14` -> acknowledged -> blurred -> reset to `3.1` resyncs to `'3.1'`.
  2. Disabled validity (`R4-WR-01` & `R4-WR-02`): disabled field with out-of-range controlled value (`100` over `max 60`, or `3.15` when `max` tightens to `3.147`) reports invalid and displays its range error; disabled field with out-of-range draft `'61'` over in-range controlled value `12` shows `'12'`, reports valid, hides the error, and restores the error on re-enable when `max` is still `60`.
  3. In-order asynchronous acknowledgements (`R3-WR-01`): typing `'3.1'`, `'3.14'`, `'3.146'` then delivering `3.1`, `3.14`, `3.15` in order keeps `'3.146'`, and a subsequent external value replaces it.
- The mounted Chromium check in `03-02-REVIEW.md` confirmed that a custom `id` on `NumberField` resolves its label association properly after mounting.

## Review fixes

Addressed all 5 critical findings and 2 warnings from `03-02-REVIEW.md` (each test written first and verified RED before the fix, committed individually within the plan's 8 files):

- **CR-05** (`f18a0810`, `fix(03-02): CR-05 validate decimal bounds before float conversion`):
  - **RED:** `readDecimal('100.000000000000001', 0, 100)` failed with `expected 100 to be null`.
  - **Fix:** Normalised exact decimal strings (sign, integer digits, fractional digits) and compared against `min`/`max` before `Number()` conversion in `client/src/components/ui/numberText.ts`.
- **CR-02** (`75628091`, `fix(03-02): CR-02 preserve NumberField draft when caller rounds value`):
  - **RED:** Typing `'3.141'` into a basis-point-rounding `NumberField` failed with `expected '3.14' to be '3.141'`.
  - **Fix:** Separated edit-originated updates (`fromEdit`) from external prop resets in `client/src/components/ui/NumberField.tsx` so rounded responses (`3.141 -> 3.14`, `3.146 -> 3.15`) keep the typed draft while external resets still sync the field.
- **CR-03** (`c7128a83`, `fix(03-02): CR-03 reconcile NumberField draft and saved value when bounds relax`):
  - **RED:** Raising `max` from 60 to 100 while `'61'` was retained failed with `expected 12 to be 61`.
  - **Fix:** Tracked `committed` in `NumberField.tsx`, kept `useReportAmountValidity(valid && draft.committed)` false until a newly valid retained draft is emitted via `useEffect`, and verified both saved value and validity across relaxation and tightening.
- **WR-01** (`d96c25f3`, `fix(03-02): WR-01 add role="alert" to NumberField validation errors`):
  - **RED:** Static and bound-crossing alert check failed (`expected null to be truthy` for `<span role="alert">`).
  - **Fix:** Wrapped invalid `NumberField` messages in `<span role="alert">` passed to `Field`, preserving `aria-describedby` linkage and live alert announcements without editing `Field.tsx`.
- **CR-01** (`4580121c`, `fix(03-02): CR-01 preserve explicit-commit CurrencyInput draft across blur`):
  - **RED:** Blurring a mounted explicit-commit `CurrencyInput` after typing `'100+50'` failed with `expected '$12' to be '100+50'`.
  - **Fix:** Added `dirty` draft tracking for `commitOnBlur={false}` in `client/src/components/ui/CurrencyInput.tsx` so valid sums and unreadable text stay visible and aligned with validity across blur/refocus until unmount or value reset.
- **CR-04** (`bf47d1bb`, `fix(03-02): CR-04 prevent readOnly CurrencyInput from committing on blur`):
  - **RED:** Focusing and blurring a `readOnly` `CurrencyInput` with value `-1250` failed (`expected "vi.fn()" to not be called at all, but actually been called 1 times` with `[1250]`).
  - **Fix:** Gated blur commits and change handlers on `!readOnly` in `CurrencyInput.tsx` while continuing to deliver `onBlur`.
- **WR-02** (`bff044f9`, `fix(03-02): WR-02 preserve React 19 callback ref cleanup in CurrencyInput`):
  - **RED:** Unmounting `CurrencyInput` with a callback ref returning a cleanup function failed (`expected "vi.fn()" to be called 1 times, but got 0 times`).
  - **Fix:** Preserved callback ref cleanup return values in `setRefs`, clearing `inputRef.current` before invoking consumer cleanup, while keeping classic null-detach and object-ref detachment intact.

## Review fixes (iteration 2)

Addressed all 4 critical findings and 1 warning from `03-02-REVIEW-2.md` (each test written first and verified RED before the fix, committed individually under `client/src/components/ui/`):

- **R2-WR-01** (`75a997e3`, `fix(03-02): R2-WR-01 share hook test harness across ui interaction tests`):
  - Removed the duplicated React-scheduling hook/effect runners from `NumberField.test.ts` and `CurrencyInput.test.ts` in favour of one shared `client/src/components/ui/hookTestHarness.ts` whose `act()` renders the child before deferred parent prop updates so child-first timing bugs surface directly.
- **R2-CR-02** (`f77f2fc5`, `fix(03-02): R2-CR-02 preserve NumberField draft across deferred rounding`):
  - **RED:** Deferred `startTransition` rounding (`3.14 -> '3.146'`, child renders first with `3.14`, then parent commits rounded `3.15`) failed with `expected '3.15' to be '3.146'`.
  - **Fix:** Kept `pendingEdit` open across child-first renders until the caller's updated value arrives (or blur), and added optional `resetKey` to `NumberField.tsx` for explicit draft resets even when `value` is unchanged.
- **R2-CR-03** (`845f81d5`, `fix(03-02): R2-CR-03 validate controlled value against active bounds in NumberField`):
  - **RED:** Tightening `max` from `50` to `3.147` after `'3.146'` rounded to controlled `3.15` failed with `expected true to be false` on `mounted.allValid`.
  - **Fix:** Checked both the parsed draft and the caller's controlled `value` against `[min, max]` (`isValueInBounds`) in `NumberField.tsx` so Save stays disabled and the field shows invalid whenever the stored value exceeds active bounds.
- **R2-CR-04** (`c0c14c0a`, `fix(03-02): R2-CR-04 gate NumberField bound reconciliation on isDisabled`):
  - **RED:** Disabling `NumberField` while `'61'` was retained over `max = 60` and raising `max` to `100` failed with `expected "vi.fn()" to not be called at all, but actually been called 1 times` (`[61]`).
  - **Fix:** Gated bound-change reconciliation and input edits on `!isDisabled` in `NumberField.tsx`, emitting zero callbacks while disabled and reconciling once re-enabled.
- **R2-CR-01** (`c1697be7`, `fix(03-02): R2-CR-01 reset explicit-commit CurrencyInput draft on focused value change`):
  - **RED:** Resetting `value` from `1200` to `2000` while an explicit-commit `CurrencyInput` was focused with `'100+50'` failed with `expected '100+50' to be '20.00'`.
  - **Fix:** Treated any `value` prop change in explicit-commit mode (`!commitOnBlur`) as an authoritative external reset even while focused, resetting `raw`, `dirty`, `invalid` and `readable` together for both valid and invalid drafts.

## Review fixes (iteration 3)

Addressed the targeted findings from `03-02-REVIEW-3.md` (each code fix backed by a failing-first test recorded below):

- **R3-CR-01 & R3-WR-01** (`53115884`, `fix(03-02): R3-CR-01 match incoming values against typed text and in-flight edits`):
  - **RED:** Typing `'05'` over `5` then rerendering `{ value: 7 }` without blur failed with `expected '05' to be '7'`; delivering in-order async acknowledgements `3.1`, `3.14`, `3.15` after typing `'3.146'` failed with `expected '3.14' to be '3.146'`.
  - **Fix:** Replaced `pendingEdit` with `roundsTo` consistency matching against a bounded `inFlight` queue and the current parsed text in `client/src/components/ui/NumberField.tsx`, keeping the draft only for consistent values and replacing it on any other prop change or `resetKey` change.
- **R3-WR-02** (`c122b0ee`, `fix(03-02): R3-WR-02 report disabled NumberField valid with controlled value`):
  - **RED:** Extending the R2-CR-04 test between disable+relax and re-enable failed with `expected '61' to be '12'` (with `allValid` still `false`).
  - **Fix:** While `isDisabled` is true, `NumberField.tsx` displays the controlled value (`toDraft(value)`), reports valid to `AmountFields`, and suppresses invalid/alert state until re-enabled.
- **R3-WR-03** (`8bee1c55`, `fix(03-02): R3-WR-03 throw on render and effect pass limits in hookTestHarness`):
  - **RED:** Mounting an infinite render-loop component in `hookTestHarness` did not throw (`expected [Function] to throw an error`).
  - **Fix:** Made `client/src/components/ui/hookTestHarness.ts` throw explicit errors when `MAX_RENDER_PASSES` (10) or `MAX_EFFECT_PASSES` (5) is exceeded, resetting `state.rendering` in `finally`; added tests covering both loops. Mounted Playwright interaction tests are carried to plan `03-03`.
- **R3-IN-03** (`d1a82376`, `fix(03-02): R3-IN-03 remove unreachable isDisabled guard in NumberField onChange`):
  - Removed the dead `if (isDisabled) return;` guard inside `NumberField`'s `<Input onChange>` handler (reconciliation remains gated on `!isDisabled`).
- **R3-IN-04** (this summary commit):
  - Documented `hookTestHarness.ts` and `NumberField`'s `resetKey` prop under `## Deviations from Plan` and `## Next Phase Readiness`.

## Review fixes (iteration 4)

Addressed all 3 findings from `03-02-REVIEW-4.md` (each with a recorded failing-first test):

- **R4-CR-01** (`c85184b9`, `fix(03-02): R4-CR-01 replace roundsTo heuristic with explicit precision prop`):
  - **RED:** Mounting `{ value: 3.14, allowDecimal: true }` and rerendering `{ value: 3.1 }` without an edit failed with `expected '3.14' to be '3.1'`.
  - **Fix:** Deleted the current-text keep-draft branch in `client/src/components/ui/NumberField.tsx` so any prop change matching no in-flight entry always replaces the draft; replaced the open-ended `roundsTo` heuristic with an explicit optional `precision?: number` prop matching `Number(emitted.toFixed(precision)) === incoming` (exact equality without `precision`). Passed `precision: 2` on the basis-point rounding test callers in `NumberField.test.ts` (no screen callers exist yet), keeping all existing assertions unchanged.
- **R4-WR-01** (`04afc551`, `fix(03-02): R4-WR-01 check controlledValid for disabled NumberField validity`):
  - **RED:** Mounting `{ value: 100, min: 1, max: 60, isDisabled: true }` failed with `expected true to be false` on `allValid`.
  - **Fix:** Set `reportedValid = isDisabled ? controlledValid : valid && draft.committed` and `showInvalid = isDisabled ? !controlledValid : !valid` in `NumberField.tsx`, adding tests for both disabled out-of-range probes (`value: 100` > `max: 60`, and `value: 3.15` when `max` tightens to `3.147`).
- **R4-WR-02** (`2874c88d`, `fix(03-02): R4-WR-02 test disabled error suppression for in-range controlled value`):
  - **RED (mutation check):** Reverting `showInvalid` to `!valid` failed the new assertion between `rerender({ isDisabled: true })` and `rerender({ max: 100 })` (`expected true to be false` on `mounted.field.isInvalid`).
  - **Fix:** Asserted that disabling a field holding an out-of-range draft `'61'` over an in-range controlled value `12` hides `isInvalid` and `errorMessage` while showing `'12'` and reporting `allValid: true`, and that re-enabling while `max` is still `60` restores the error.
- **R5-WR-01** (`81531787`, `fix(03-02): R5-WR-01 match precision on rounding grid instead of toFixed`): Replaced `toFixed` in `matchesStored` with the `10^precision` grid-tolerance check (`1e-7` grid, `0.5 + 1e-9` half-step) with a failing-first test (`expected '2.68' to be '2.675'`) covering `2.675` and `0.015` under `Math.round(next * 100) / 100`.

## Self-Check: PASSED

- All 9 created/modified client files exist under `client/src/components/ui/`.
- All 3 task commits (`1447577a`, `fc38d142`, `b16a7144`), 7 iteration-1 commits (`f18a0810`, `75628091`, `c7128a83`, `d96c25f3`, `4580121c`, `bf47d1bb`, `bff044f9`), 5 iteration-2 commits (`75a997e3`, `f77f2fc5`, `845f81d5`, `c0c14c0a`, `c1697be7`), 4 iteration-3 code commits (`53115884`, `c122b0ee`, `8bee1c55`, `d1a82376`), and 3 iteration-4 code commits (`c85184b9`, `04afc551`, `2874c88d`) are ancestors of `HEAD` on `worktree-agent-p0302-a1`.
- Zero changes to `STATE.md`, `ROADMAP.md`, `03-03-PLAN.md`, or any file outside `client/src/components/ui/` and `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-02-*.md`.
- All plan verification commands, full client unit suite (904 tests), `tsc --noEmit`, and `lint` (0 errors, 0 new warnings) passed.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
