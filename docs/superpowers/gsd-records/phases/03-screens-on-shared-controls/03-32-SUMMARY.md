---
phase: 03-screens-on-shared-controls
plan: 32
subsystem: ui
tags: [react, tailwind, date-picker, month-picker, ios, safari, uat-gap, vitest]
gap_closure: true
gap_ids: [G-03-3]

requires:
  - phase: 03-screens-on-shared-controls
    provides: NativePicker fit classes (G-03-1) and phone DatePicker/MonthPicker tests (03-26)
provides:
  - NativePicker input classes `[&::-webkit-date-and-time-value]:my-0` and `[&::-webkit-date-and-time-value]:leading-[42px]` on branch `fix/uat-03-date-centre`
  - Failing-first unit test in `DatePicker.test.ts` pinning the value-box centring classes alongside the G-03-1 classes
affects: [03-34, phone UAT re-test of test 49]

actuals:
  tokens: 723
  tasks: 1
  commits: 2

plan_head_before: b22fb6faaf8a0f80cbeaf3002a439c026f31eb0d
plan_head_after: 88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3
commits: 2

tech-stack:
  added: []
  patterns:
    - "Shared NativePicker layout tweak via plain Tailwind arbitrary pseudo-element utilities in DatePicker.tsx (D-02, D-04)"

key-files:
  created: []
  modified:
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/ui/DatePicker.test.ts

key-decisions:
  - "Used `my-0` rather than `m-0` on `::-webkit-date-and-time-value` so only vertical margin is zeroed and the left inset stays aligned with Amount and Payee"
  - "Used `leading-[42px]` (44 px `min-h-11` field minus two 1 px borders) rather than changing the outer field height or display mode, leaving desktop AriaDatePicker, Chromium, and desktop WebKit unchanged"

patterns-established: []

requirements-completed: [WAVG-05, WAVG-06]

coverage:
  - id: D1
    description: "NativePicker (shared by phone DatePicker and MonthPicker) gives `::-webkit-date-and-time-value` zero vertical margin and a 42 px line height while preserving all G-03-1 fit classes; built CSS emits both rules"
    requirement: WAVG-06
    verification:
      - kind: unit
        ref: "client/src/components/ui/DatePicker.test.ts#gives the iOS date value box no vertical margin and a 42 px line, keeping the G-03-1 classes (UAT G-03-3)"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/MonthPicker.test.ts"
        status: pass
      - kind: other
        ref: "grep -oh -- '-webkit-date-and-time-value{[^}]*}' client/dist/assets/*.css"
        status: pass
    human_judgment: true
    rationale: "No automated engine here draws iOS Safari's native date control, so the unit test and built-CSS check pin only the class strings and CSS rules; the owner's iPhone check in Safari (UAT test 49) is the blocking gate for G-03-3, which remains open until it passes."

duration: 3 min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 32: Centre the iOS date value in NativePicker (G-03-3) Summary

**Added `[&::-webkit-date-and-time-value]:my-0` and `[&::-webkit-date-and-time-value]:leading-[42px]` to `NativePicker`'s phone `<input>` in `DatePicker.tsx`, pinned by a failing-first unit test and verified in the built CSS on branch `fix/uat-03-date-centre` (`88e678c7`), awaiting the owner's iPhone check to close G-03-3.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-22T05:29:43Z
- **Completed:** 2026-11-22T05:32:10Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created isolated code worktree `$HOME/Github/Allotment-worktrees/uat03-date` on branch `fix/uat-03-date-centre` from `origin/redesign` (`b22fb6faaf8a0f80cbeaf3002a439c026f31eb0d`), symlinked `client/node_modules` from the main checkout (lockfiles identical to `origin/redesign`).
- Wrote failing-first test `"gives the iOS date value box no vertical margin and a 42 px line, keeping the G-03-1 classes (UAT G-03-3)"` in `client/src/components/ui/DatePicker.test.ts` and committed the RED test (`376546111f8a3944c0f510ee16250a77a68c3b5f`).
- Updated `NativePicker`'s `<input>` in `client/src/components/ui/DatePicker.tsx` to append `[&::-webkit-date-and-time-value]:my-0 [&::-webkit-date-and-time-value]:leading-[42px]` while keeping `fieldBase`, `fieldStates`, `w-full`, `min-w-0`, `min-h-11`, `appearance-none`, `text-base`, and `[&::-webkit-date-and-time-value]:text-left`, plus the comment explaining the G-03-3 centring fix. Desktop `AriaDatePicker`, `MonthPicker.tsx`, and all screen files are untouched.
- Verified `DatePicker.test.ts` (21 tests), `MonthPicker.test.ts` (16 tests), `tsc --noEmit -p .`, `npm --prefix client run build`, ESLint on both modified files, and built-CSS rules, then committed `88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3`.

## Code Worktree & Commits

- **Code worktree:** `$HOME/Github/Allotment-worktrees/uat03-date`
- **Branch:** `fix/uat-03-date-centre` (base `origin/redesign` at `b22fb6faaf8a0f80cbeaf3002a439c026f31eb0d`, not pushed)
- **Head commit:** `88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3`
- **Task commits on `fix/uat-03-date-centre`:**
  1. `376546111f8a3944c0f510ee16250a77a68c3b5f` (`test(03-32): pin iOS date value-box centring classes (UAT G-03-3)`)
  2. `88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3` (`fix(ui): centre the native date value on iPhone (UAT G-03-3)`)
- **GSD worktree:** `/Users/tristanvanrooyen/Github/Allotment/.claude/worktrees/agent-p0332-uat2-a1` (branch `worktree-agent-p0332-uat2-a1`, base `f1860c2e9e155a928fd2c68733b37206f54a53f2`), holding only `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-32-SUMMARY.md` committed via the metadata commit; `STATE.md` and `ROADMAP.md` untouched.

## RED Evidence (recorded before the fix)

Command: `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/DatePicker.test.ts`

- **Result:** `Test Files 1 failed (1)`, `Tests 1 failed | 20 passed (21)` (exit code 1).
- **Failing test & line:** `src/components/ui/DatePicker.test.ts:181:17` (`DatePicker on phones > gives the iOS date value box no vertical margin and a 42 px line, keeping the G-03-1 classes (UAT G-03-3)`)
- **Assertion:** `AssertionError: expected ' type="date" class="block rounded-md …' to match /class="[^"]*webkit-date-and-time-value\]:my-0[^"]*"/`

## Verification Outputs

1. **Unit tests (`DatePicker.test.ts` and `MonthPicker.test.ts`):**
   `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test -- src/components/ui/DatePicker.test.ts src/components/ui/MonthPicker.test.ts`
   ```
    ✓ src/components/ui/MonthPicker.test.ts (16 tests) 54ms
    ✓ src/components/ui/DatePicker.test.ts (21 tests) 139ms

    Test Files  2 passed (2)
         Tests  37 passed (37)
   ```

2. **Typecheck (`tsc --noEmit`):**
   `(cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit -p .)` -> exited 0 (`TSC CLEAN`, zero errors).

3. **Client build:**
   `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client run build` -> exited 0 (`✓ built in 899ms`, producing `dist/assets/index-BCN5JVtP.js` and CSS bundle).

4. **Built CSS value-box rules:**
   `grep -oh -- '-webkit-date-and-time-value{[^}]*}' client/dist/assets/*.css`
   ```css
   -webkit-date-and-time-value{min-height:1lh;text-align:inherit}
   -webkit-date-and-time-value{margin-block:0}
   -webkit-date-and-time-value{text-align:left}
   -webkit-date-and-time-value{--tw-leading:42px;line-height:42px}
   ```
   `grep -oh -- '-webkit-date-and-time-value{[^}]*}' client/dist/assets/*.css | grep -c 'line-height:42px'` -> `1`.

5. **Acceptance greps & diff checks in `$WT`:**
   - `grep -c "webkit-date-and-time-value\]:leading-\[42px\]" client/src/components/ui/DatePicker.tsx` -> `1`
   - `grep -c "webkit-date-and-time-value\]:my-0" client/src/components/ui/DatePicker.tsx` -> `1`
   - `git diff origin/redesign -- client/src/components/ui/DatePicker.test.ts` -> adds 14 lines only; existing tests unedited.
   - `git diff --name-only origin/redesign` -> `client/src/components/ui/DatePicker.test.ts`, `client/src/components/ui/DatePicker.tsx`.
   - ESLint (`./lint/node_modules/.bin/eslint -c lint/eslint.config.js client/src/components/ui/DatePicker.tsx client/src/components/ui/DatePicker.test.ts`) -> exited 0 (`ESLINT CLEAN`).

## Files Created/Modified

- `client/src/components/ui/DatePicker.tsx` (`fix/uat-03-date-centre`) - Appended `[&::-webkit-date-and-time-value]:my-0 [&::-webkit-date-and-time-value]:leading-[42px]` and extended the comment on `NativePicker`'s `<input>`.
- `client/src/components/ui/DatePicker.test.ts` (`fix/uat-03-date-centre`) - Added failing-first phone test pinning the two value-box classes alongside the G-03-1 classes.

## Decisions Made

- Used `my-0` (zero block margin only) rather than `m-0` so the horizontal inset of the date value remains aligned with Amount and Payee.
- Used `leading-[42px]` (44 px `min-h-11` minus two 1 px borders) on `::-webkit-date-and-time-value` instead of altering `fieldBase`'s `block` display or outer field height.

## Deviations from Plan

### Environment Setup Notes

**1. [Environment] `node_modules` symlinks in `$WT`**
- `$WT` had no `node_modules`; `client/node_modules` was symlinked to `$HOME/Github/Allotment/client/node_modules` (gitignored, lockfile verified identical to `origin/redesign`, `.npmrc` untouched). `lint/node_modules` was temporarily symlinked for ESLint verification and removed immediately afterwards.

**Total deviations:** 0 code deviations (plan executed as written). **Impact:** none.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. Only two Tailwind pseudo-element utility classes on `NativePicker`'s `<input>` were added; no routes, auth paths, or data schemas changed (`T-03-50`, `T-03-SC`).

## For 03-34

- **Shared layout fix (not a behaviour change):** `NativePicker` in `client/src/components/ui/DatePicker.tsx` (shared by phone `DatePicker` and `MonthPicker`) now adds `[&::-webkit-date-and-time-value]:my-0 [&::-webkit-date-and-time-value]:leading-[42px]`. Desktop `AriaDatePicker`, screen components, and all input values/`onChange` handlers are untouched.
- **No selector change:** No role, label, test id, or element structure changed; all existing selectors remain identical.
- **Gallery baselines expected unchanged:** Both new rules target `::-webkit-date-and-time-value`, which Chromium and desktop WebKit do not draw; CI's Linux gallery pixel comparison in 03-34 should see zero diff.
- **Unit test pins classes only:** `DatePicker.test.ts` ("gives the iOS date value box no vertical margin and a 42 px line, keeping the G-03-1 classes (UAT G-03-3)") and the built-CSS `grep` assert only that the class strings and compiled CSS rules exist; no test engine here renders iOS Safari's native date control.
- **Blocking gate for G-03-3 (remains OPEN):** G-03-3 stays open until the owner's iPhone Safari re-test of UAT test 49 passes (Add transaction Date text vertically centred level with Amount and Payee, field still ends inside the sheet level with Amount, and tapping still opens the iOS date wheel).

## Next Phase Readiness

- Branch `fix/uat-03-date-centre` at `88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3` is ready for 03-34 to merge into the UAT round 2 PR and run the Playwright/CI checks and owner iPhone verification.

## Self-Check: PASSED

- Code worktree files modified on `fix/uat-03-date-centre`: `client/src/components/ui/DatePicker.tsx` and `client/src/components/ui/DatePicker.test.ts` verified via `git diff --name-only origin/redesign`.
- Code commits present on `fix/uat-03-date-centre`: `376546111f8a3944c0f510ee16250a77a68c3b5f` (RED test) and `88e678c7f6e68ff7c172ae6caa65bc0ec3ea06e3` (fix).
- `SUMMARY.md` created at `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-32-SUMMARY.md` in the GSD worktree; `STATE.md` and `ROADMAP.md` untouched.
- Unit tests (37/37), `tsc --noEmit`, `vite build`, ESLint, and built-CSS `line-height:42px` checks all passed after the final code edit.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-22*

## Review (one round, Codex Sol 6.2 High)

CR-01 (blocker): Android Chromium's chooser-only date control draws the same
`::-webkit-date-and-time-value` box, so the two rules also applied on Android. The orchestrator
fixed it in `fef6d53a` on `fix/uat-03-date-centre`: both utilities now carry
`supports-[-webkit-touch-callout:none]:`, and the built CSS holds them inside
`@supports (-webkit-touch-callout:none){...}`. The test now pins the scoped classes; it fails
on the unscoped commit (1 failed, 20 passed) and passes with the fix. DatePicker and MonthPicker
37/37, client tsc clean, client build ok. Review: `.git/gsd-handoff/03-32-REVIEW-sol.md`.
