---
phase: 03-screens-on-shared-controls
reviewed: "2026-11-19T02:00:00Z"
depth: standard
files_reviewed: 8
files_reviewed_list:
  - client/src/components/ui/CurrencyInput.test.ts
  - client/src/components/ui/CurrencyInput.tsx
  - client/src/components/ui/NumberField.test.ts
  - client/src/components/ui/NumberField.tsx
  - client/src/components/ui/fieldMessages.test.ts
  - client/src/components/ui/fieldMessages.ts
  - client/src/components/ui/numberText.test.ts
  - client/src/components/ui/numberText.ts
findings:
  critical: 5
  warning: 2
  info: 0
  total: 7
  necessity: 0
status: issues_found
---

# Phase 03, plan 03-02 — Code Review Report

**Reviewed:** 2026-11-19T02:00:00Z  
**Depth:** Standard  
**Files reviewed:** 8  
**Status:** issues_found

## Summary

Reviewed `80898425..c351d68d` in `agent-p0302-a1` against the plan and D-14/D-15. Five defects affect draft retention, submitted state, or validation. Two warnings cover the required live error semantics and React 19 ref cleanup.

- All eight source and test files match the plan's scope. The ninth changed file is the required implementation summary, which I read as evidence. The diff contains no screen changes, package changes, class-merging helper, or e2e selector edits.
- The 41 focused tests and all 888 client tests passed, as did the client no-emit type check, lint tests, and lint with 126 warnings under its cap of 128. The diff passes `git diff --check`. Existing test expectations remain intact, and the test diff adds no skips, retries, or waits. The summary records the failing-first runs. The base lacks the new number controls, parsers, and message exports. An isolated Chromium comparison independently confirmed that the base rejects the sum and renders about 41 px at a 390 px viewport. The new component commits `100+50` as 15000 minor units and measures 44 px in both sizes. Money remains `type="text" inputMode="decimal"` and uses the existing money and expression readers.
- A mounted Chromium check showed that the custom NumberField ID resolves to the correct input and clicking its label focuses that input. React Aria resolves the association after mounting, so the summary's static-markup caveat did not reproduce in the mounted app.
- The old Forecast fields coexist with the shared control until plan 03-19 converts them to wrappers. That conversion is required to finish consolidating the numeric draft logic, and 03-02 explicitly prohibits editing the screens. The full screen e2e suite was outside this review. Browser probes mounted the reviewed components with mock values and no budget data.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Explicit-commit CurrencyInput loses its draft when focus returns

**Severity:** BLOCKER (P1)  
**File:** `client/src/components/ui/CurrencyInput.tsx:129`  
**Issue:** With `expression` and `commitOnBlur={false}`, typing `100+50` over a $12 amount and blurring a mounted field displays $12. Refocusing replaces the draft with `12.00`, although the last live preview was 15000. This breaks the Budget editor's existing window-blur path. The caller intentionally stays mounted when `document.hasFocus()` is false at `client/src/pages/Budget.tsx:174`. The same path hides an unreadable draft such as `abc` while leaving Save disabled and the input's custom validity false. Chromium reproduced both outcomes against the new component.  
**Fix:** Keep an explicit-commit draft and its validity together across blur and refocus. Let the caller end or reset the edit on an actual cancel or successful save. Exercise both a blur that leaves the editor mounted and a click-away cancel, with valid sums and invalid text.

### CR-02: NumberField rewrites the draft when the caller rounds it

**Severity:** BLOCKER (P1)  
**File:** `client/src/components/ui/NumberField.tsx:102`  
**Issue:** The change handler records the emitted value in `last` before the caller returns its controlled value. A caller that stores percentages in whole basis points returns `3.14` for a typed `3.141`. The render-time comparison at line 72 treats that response as an external reset and overwrites the draft. Chromium reproduced `3.141` immediately becoming `3.14`. The planned Cash Runway and Forecast adapters use the existing rounding conversion in `client/src/utils/longTerm.ts:443`. The UI spec requires keeping the typed string while the caller stores the converted value.  
**Fix:** Distinguish an accepted or normalized callback result from an externally supplied reset. Keep the draft through the former. Cover a basis-point round trip and a later external reset in the same interaction test.

### CR-03: Relaxing a bound enables Save for a value the form never received

**Severity:** BLOCKER (P1)  
**File:** `client/src/components/ui/NumberField.tsx:80`  
**Issue:** The component revalidates the displayed draft when a bound changes, but it only publishes parsed values from its input change handler. In Chromium, a field with saved state 12 and max 60 kept the invalid draft `61` and disabled Save. Raising max to 100 enabled Save and left `61` visible, but submitting saved 12. The CSV header picker is planned to derive its maximum from the current records.  
**Fix:** Reconcile the draft and controlled value when the bounds change. A newly valid retained draft must reach the caller before it enables Save, or the field must restore the value the caller will submit. Test the saved value as well as the button state.

### CR-04: A read-only CurrencyInput can commit a changed amount on blur

**Severity:** BLOCKER (P1)  
**File:** `client/src/components/ui/CurrencyInput.tsx:144`  
**Issue:** The new `readOnly` prop prevents DOM edits but leaves blur commits active. In Chromium, a read-only field with value `-1250` and default options emitted `1250` after focusing and leaving it without typing. A caller that persists `onChange` can write an amount through a read-only field.  
**Fix:** Gate blur commits on editability as well as `commitOnBlur`. Continue delivering the caller's blur event. Add a focus-and-blur check that observes zero amount callbacks for a read-only field.

### CR-05: Decimal text just outside the range rounds into bounds before validation

**Severity:** BLOCKER (P1)  
**File:** `client/src/components/ui/numberText.ts:28`  
**Issue:** The parser rounds to a JavaScript number before comparing the typed decimal against the bounds. A direct Node probe returned `100` for `readDecimal('100.000000000000001', 0, 100)`. A split percentage can show that out-of-range string as valid, emit 100 and leave Save enabled. The lower bound behaves the same way, as confirmed with `-100.000000000000001` and a minimum of -100.  
**Fix:** Check the exact decimal against the permitted bounds before converting it, or enforce the supported decimal precision before conversion. Cover the nearest representable out-of-range strings on both sides of a bound.

## Warnings

### WR-01: NumberField errors lack the live alert required by the UI contract

**Severity:** WARNING (P1)  
**File:** `client/src/components/ui/NumberField.tsx:115`  
**Issue:** An invalid value sets `aria-invalid` and links the rendered range message via `aria-describedby`. The message has no `role="alert"`, as required by `03-UI-SPEC.md:100` for D-14 errors. The mounted range error had no alert role, and `client/src/components/ui/Field.tsx:17` plus the installed React Aria FieldError renderer confirm that neither supplies it. The static test checks the description linkage alone.  
**Fix:** Let NumberField opt into an alert on the shared Field error while keeping its existing description linkage. Check the alert when the draft crosses a bound.

### WR-02: Forwarded callback refs lose their React 19 cleanup

**Severity:** WARNING (P1)  
**File:** `client/src/components/ui/CurrencyInput.tsx:91`  
**Issue:** The merged callback discards the cleanup function returned by the consumer's ref. A mounted Chromium probe registered a callback ref that returned a cleanup and then unmounted CurrencyInput. The consumer received `null`, and the registered cleanup never ran. Any listener installed by that callback and cleaned up only by its return function will stay registered. The static forwardRef test cannot exercise attachment or cleanup.  
**Fix:** Preserve a callback ref's return value and clear the internal ref when it runs. Keep the null-callback behavior for callback refs without a cleanup and update object refs on detach. Test with a mounted callback ref.

---

_Reviewed 2026-11-19T02:00:00Z_  
_Reviewer Codex (gsd-code-reviewer)_  
_Depth standard_

## Findings by severity

5 critical, 2 warnings, 0 info.

- CR-01 `client/src/components/ui/CurrencyInput.tsx:129`
- CR-02 `client/src/components/ui/NumberField.tsx:102`
- CR-03 `client/src/components/ui/NumberField.tsx:80`
- CR-04 `client/src/components/ui/CurrencyInput.tsx:144`
- CR-05 `client/src/components/ui/numberText.ts:28`
- WR-01 `client/src/components/ui/NumberField.tsx:115`
- WR-02 `client/src/components/ui/CurrencyInput.tsx:91`
