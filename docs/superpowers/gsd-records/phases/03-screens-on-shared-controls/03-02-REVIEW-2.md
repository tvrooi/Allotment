---
phase: 03-screens-on-shared-controls
reviewed: "2026-11-19T02:23:11Z"
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-02-REVIEW.md
  - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-02-SUMMARY.md
  - client/src/components/ui/CurrencyInput.test.ts
  - client/src/components/ui/CurrencyInput.tsx
  - client/src/components/ui/NumberField.test.ts
  - client/src/components/ui/NumberField.tsx
  - client/src/components/ui/numberText.test.ts
  - client/src/components/ui/numberText.ts
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
  necessity: 0
status: issues_found
---

# Phase 03, plan 03-02 — Code Review Report, iteration 2

**Reviewed:** 2026-11-19T02:23:11Z

**Depth:** Standard

**Files reviewed:** 8

**Status:** issues_found

## Summary

Reviewed only `c351d68d..2876400e` in `agent-p0302-a1`. The 48 focused Vitest tests and client `tsc --noEmit` passed. Four mounted Chromium probes used mock values and reproduced the issues below. Full e2e coverage was outside this review.

The fix range changes six control and test files plus two planning artifacts. It contains zero screen, package, class-merging or e2e selector edits. Existing assertions keep their coverage, with the range-error assertion strengthened. The changes add zero test skips, retries or sleeps. CurrencyInput keeps `type="text" inputMode="decimal"` and the shared minor-unit readers. NumberField uses shared Field and Input plus the existing range-message helpers. The planned Forecast conversion owns removal of the existing screen-specific numeric controls. The source diff passes `git diff --check`.

### Iteration 1 recheck

Failure evidence is by reasoning against the implementation before each fix, alongside the passing current tests. No source was mutated.

| Prior finding | Recheck and why its test fails without the fix |
| --- | --- |
| CR-01 | Original blur/refocus case fixed. The prior formatter displays the parent’s $12 when a valid `100+50` draft blurs, failing the raw-text assertion. The focused reset case is in CR-01 below. |
| CR-02 | Fixed for synchronous rounding. Before the fix, the previous parser-result comparison replaces `3.141` with `3.14`. The new assertion catches that. Deferred normalization still loses the draft, as in CR-02 below. |
| CR-03 | Fixed for an enabled field with an unchanged parent value. The old code updates validity when max rises to 100 but never emits the retained 61, so the saved-value assertion still reads 12. Two related regressions are below. |
| CR-04 | Fixed. Before the guard, focus and blur on the read-only −1250 field emits 1250 and fails the zero-callback assertion. |
| CR-05 | Fixed. Float-first conversion accepts `100.000000000000001` as 100 and fails the null assertion. The new exact comparison rejects both upper and lower excess tails and accepts the exact bounds. |
| WR-01 | Fixed for error markup and description linkage. The previous markup has no alert span, so both the strengthened static assertion and the bound-crossing markup assertion fail. Screen-reader announcements were not audited. |
| WR-02 | Fixed. The prior merged ref returns undefined, so the test’s detach path calls the ref with null and never calls its returned cleanup. The new assertions catch both. |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A focused reset leaves an explicit-commit CurrencyInput showing stale text

**Severity:** BLOCKER (P1)

**File:** `client/src/components/ui/CurrencyInput.tsx:115`

**Issue:** The component records a new controlled value immediately and clears the draft only if already blurred. In Chromium, typing `100+50` over $12, resetting the parent amount to $20 while the input is focused, and then blurring leaves `100+50` visible. A later render sees the new amount as already handled. The same branch can retain unreadable text and its invalid state. The previous valid draft fell back to the updated prop on blur.

**Fix:** Handle an authoritative value reset for explicit-commit drafts while focused, or defer consuming it until blur. Reset the text and validity together and cover focused resets with valid and invalid drafts.

### CR-02: Deferred rounding still overwrites the NumberField draft

**Severity:** BLOCKER (P1)

**File:** `client/src/components/ui/NumberField.tsx:79`

**Issue:** The local edit render clears `fromEdit` before a deferred parent update arrives. In Chromium, entering `3.146` with a parent that sets the rounded basis-point value in React’s `startTransition` changes the textbox to `3.15` when the transition completes. The synchronous callback in the regression test cannot exercise this remaining CR-02 path.

**Fix:** Give the component a way to distinguish a deferred edit acknowledgement from an external reset, such as an explicit reset key with a separate draft lifetime. Exercise deferred rounding and a subsequent external reset in a mounted test.

### CR-03: Tightening a bound can leave Save enabled for an out-of-range controlled value

**Severity:** BLOCKER (P1)

**File:** `client/src/components/ui/NumberField.tsx:92`

**Issue:** Validity checks the retained draft alone. In Chromium, a parent rounding to basis points stores 3.15 after the user types `3.146`. Tightening max from 50 to 3.147 keeps the draft valid and Save enabled even though the form would submit 3.15. The fix newly permits the draft and controlled value to differ.

**Fix:** Check the value the parent will submit against the active bounds when reporting validity. Add a bound-change test that asserts the rounded controlled value and the Save state.

### CR-04: Relaxing a bound commits through a disabled NumberField

**Severity:** BLOCKER (P1)

**File:** `client/src/components/ui/NumberField.tsx:98`

**Issue:** The new reconciliation effect ignores `isDisabled`. In Chromium, typing `61` with max 60 and parent value 12, disabling the field, and then raising max to 100 calls `onChange(61)` while the textbox is still disabled. A parent relying on the disabled state can receive an edit during that period.

**Fix:** Gate reconciliation on editability. Reconcile only after re-enabling or restore the controlled value when disabled. Verify zero callbacks while disabled in a bound-change test.

## Warnings

### WR-01: Two test harnesses duplicate React scheduling and hide a failing interaction

**Severity:** WARNING (P1)

**File:** `client/src/components/ui/NumberField.test.ts:126`

**Issue:** This hook/effect runner duplicates the one in `CurrencyInput.test.ts:230`. Both execute a component directly and flush local state and effects themselves. The NumberField test explicitly rerenders the child inside `onChange`, so its passing assertion gives no coverage for the child-first render sequence that Chromium reproduced in CR-02.

**Fix:** Keep the pure parser and static markup tests. Run the interaction assertions against mounted React using the repository’s Playwright setup, with shared setup for the field cases.

## Findings by severity

4 critical, 1 warning, 0 info.

- CR-01 `client/src/components/ui/CurrencyInput.tsx:115`
- CR-02 `client/src/components/ui/NumberField.tsx:79`
- CR-03 `client/src/components/ui/NumberField.tsx:92`
- CR-04 `client/src/components/ui/NumberField.tsx:98`
- WR-01 `client/src/components/ui/NumberField.test.ts:126`
