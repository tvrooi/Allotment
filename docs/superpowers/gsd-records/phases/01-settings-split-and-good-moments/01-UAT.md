---
status: complete
phase: 01-settings-split-and-good-moments
source: [01-VERIFICATION.md]
started: 2026-11-16T07:13:20Z
updated: 2026-11-16T07:19:15.439Z
---

## Current Test

[testing complete]

## Tests

### 1. At 390 px, in light and dark, inspect the Accounts header and Connected banks screenshots in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (attach images to a PR #273 comment; never commit).
expected: The Accounts header reads as two tidy lines and the Connected banks page has the provider toggle directly under the header.
result: pass

### 2. In the screenshots of Goals (\"New laptop\") at 1280 px and 390 px, light and dark, plus live hover over a reached goal row on `/goals`.
expected: The four stages are told apart at 100% zoom, the flower reads clearly on both the row and its hover colour (`--color-hover`, not captured in `.ui-evidence`), and the plant looks like part of the brand (the logo's sprout), not an ornament.
result: pass

### 3. In the screenshots of the Budget hero at $0, clean and with a caveat, light and dark, 1280 px and 390 px.
expected: The $0 figure is the anchor in normal text colour, the clean line reads as quiet encouragement with the small seedling, and the caveat reads as a job to do, not as praise or an alarm.
result: pass

### 4. Open `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` and review the plant stages and flower, the $0 hero clean and with a caveat, the two new pages (`/accounts/connections`, `/budget/categories`), and the shorter Settings, in light and dark at both sizes (plus live browser playback of `--animate-grow-in` / `--animate-bloom` / `--animate-bloom-ring` with normal motion and OS reduced motion).
expected: All 32 screenshots satisfy the 01-VALIDATION.md manual checks, and live CSS transitions feel smooth under normal motion and render still without jitter under OS reduced motion.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
