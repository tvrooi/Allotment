---
phase: 01-settings-split-and-good-moments
plan: 08
subsystem: release
tags: [screenshots, release-version, push, pr-body, ci]
status: complete

requires:
  - phase: 01-settings-split-and-good-moments (plan 07)
    provides: "wave-f at 575c3ea with the full gate green on Node v24.10.0, and the facts for the PR body"
provides:
  - "32 screenshots under /Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/ (git-ignored, not committed)"
  - "origin/wave-f = 575c3ea, pushed fast-forward from 1627cae"
  - "PR #273 retitled 'feat(ui): Wave F: settings split and good moments (#244, #241)' with a rewritten body"
  - "CI green on 575c3ea (every check pass; publish and release skipped as on any PR)"
affects: [pr-273, owner-merge]

actuals:
  tokens: 6500
  tasks: 2
  commits: 0
plan_head_before: 575c3ea48bd32f791a1417762140a1a7bd482c0a
plan_head_after: 575c3ea48bd32f791a1417762140a1a7bd482c0a

tech-stack:
  added: []
  patterns:
    - "Evidence capture through temporary Playwright specs (demo project for full-budget pages, desktop project with the api fixture for $0 states), deleted before the task ends"

key-files:
  created: []
  modified: []

key-decisions:
  - "Version stays 0.2.0-up.174: origin/redesign is still at 0.2.0-up.173 and no v0.2.0-up.174 tag exists locally or on the remote; package.json, both package-lock.json places, homeassistant/config.yaml and the top CHANGELOG heading agree"
  - "No source fix after the visual review: every screen met the UI-SPEC, so wave-f gained no commit in this plan"
  - "The orange group borders on /budget/categories come from CategoryManager.tsx, which is unchanged from redesign; out of scope"

requirements-completed: [WAVF-01, WAVF-02, WAVF-03, WAVF-04, WAVF-05]

duration: 17min
completed: 2026-11-15
---

# Phase 1 Plan 08: Evidence, version check and PR #273 Summary

**32 light and dark screenshots at 1280 and 390 px were taken from the demo budget and disposable e2e budgets, and nothing on them needed fixing. Version 0.2.0-up.174 was confirmed free. `wave-f` was pushed as a plain fast-forward to `575c3ea`, and PR #273 has a new title and a body recording the design, tests and Node 24 checks. CI is green on every check. Nothing was merged, tagged or published.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-11-15T05:01:58Z
- **Completed:** 2026-11-15T05:18:13Z
- **Tasks:** 2 of 2
- **Files modified:** 0 tracked files (screenshots are git-ignored)

## Accomplishments

- **Evidence (Task 1):** two temporary specs, `e2e/tests/demo/zz-evidence.spec.ts` and `e2e/tests/zz-evidence.spec.ts`, were run one project at a time on Node 24 (demo: 5 passed; desktop: 3 passed) and then deleted. The theme was switched with `emulateMedia({ colorScheme })`, which works because the preference defaults to `system` and `applyTheme` listens to the media query. Before each shot the specs waited for fonts and every finite animation. Every shot recorded 0 px of sideways overflow.
- **What was checked against the UI-SPEC:**
  - **Plant stages:** at 4× zoom in dark, seed, seedling, bud and flower are clearly different shapes. The seed is a muted pebble on its ground line, as designed. Light mode reads too.
  - **$0 clean:** the figure is in the normal text colour, the hero stays green, and "Every dollar has a job" sits with the seedling.
  - **$0 caveat:** "All assigned, but envelopes are overspent" sits beside a one-line $0 at 390 px, and the todo line keeps its Review link.
  - **Accounts header at 390 px:** two tidy lines (the title with the sync pill, then Connected banks with Add account).
  - **The new pages and Settings:** Connected banks shows its breadcrumb and subtitle, Categories shows its breadcrumb, and Settings opens on Accounts with the tab row scrolling.
- **Version (Task 2, step 1):** `git fetch origin`; `origin/redesign` (`0426504`) is an ancestor of HEAD, so nothing was merged. The version is `0.2.0-up.174` everywhere, and the highest remote tag is `v0.2.0-up.153`. No version change and no commit.
- **Pre-push guards:**
  - `git status` shows only `.omc/`.
  - `git ls-files .planning .ui-evidence .omc` gives 0.
  - The server diff against redesign is exactly the two D-09 files.
  - `origin/wave-f..HEAD` holds the 17 phase commits (`65804d8` … `575c3ea`), and the 66-file diff stat has no stray file.
  - No dependency line changed.
- **Push:** `git push origin wave-f` updated `1627cae..575c3ea` as a fast-forward. `merge-base --is-ancestor 1627cae origin/wave-f` passes.
- **PR #273:** the title is "feat(ui): Wave F: settings split and good moments (#244, #241)". The body has these sections:
  - what this is;
  - #244, D-08 (resolves the Codex P1 on `UpSyncBadge.tsx`) and #241;
  - choices the owner can overrule (provider default, `budget.manage-categories`, no praise while loading, Accounts guide v2);
  - Kept (WAVES.md, D-10);
  - Tests: the added tests and every changed expectation with its reason;
  - Checks run on Node 24, v24.10.0, from plan 07;
  - Evidence.

  The body was scanned before posting: no hostname, token or account detail.

## Task Commits

None. Task 1 changed only git-ignored files, and Task 2 needed no version change. `wave-f` HEAD stays `575c3ea` (plan 07's last commit), now pushed.

## CI on 575c3ea (PR #273)

| Check | State |
|---|---|
| CI passed | pass |
| client | pass (44s) |
| server | pass (3m31s) |
| lint | pass (1m9s) |
| electron | pass (26s) |
| e2e (1/4) | pass (5m34s) |
| e2e (2/4) | pass (7m23s) |
| e2e (3/4) | pass (6m27s) |
| e2e (4/4) | pass (7m41s) |
| test | pass (1m7s) |
| verify | pass (6s) |
| homeassistant | pass (2m17s) |
| build (linux) | pass (2m25s) |
| build (macos) | pass (3m14s) |
| build (windows) | pass (1m55s) |
| Vercel | pass |
| Vercel Preview Comments | pass |
| publish | skipping (PR run; nothing published) |
| release | skipping (PR run; nothing released) |

**Codex:** as of 05:18Z, about 14 minutes after the push, Codex had posted no review of `575c3ea`. Its only review is still the one on `1627cae`, with the P1 on `UpSyncBadge.tsx`. That P1 is fixed in code (plan 02) but its thread is still open, because review threads are not resolved here. There is no new finding.

## Screenshots (32, in /Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/)

Each screen at 1280 and 390, in light and dark (`<screen>-<width>-<theme>.png`):
- `goals-new-laptop` (demo)
- `goals-stages` (a disposable budget with four goals at 20/40/75/100%)
- `budget-zero-clean` (disposable)
- `budget-zero-caveat` (disposable: plan 06's $500 income, $500 to Groceries, $600 spent)
- `accounts-header` (demo)
- `accounts-connections` (demo)
- `budget-categories` (demo)
- `settings` (demo)

`git check-ignore` confirms they are ignored, and `git status --short -- e2e client .ui-evidence` is empty.

## Acceptance gates

- The version is the same in all four places, and there is no `v0.2.0-up.174` tag, locally or on the remote.
- `git ls-files .planning .ui-evidence .omc | wc -l` gives 0.
- `HEAD == origin/wave-f`, and `1627cae` is an ancestor (history not rewritten).
- PR #273 shows `OPEN redesign wave-f true` (the body names Node 24).
- Issues #244 and #241 are both OPEN.
- `docs/ui/WAVES.md` is kept, and the live app and HA were not touched.

## Decisions Made

- The version stays `0.2.0-up.174` (see key-decisions).
- The screenshots use 1× scale at both widths, so the 20 px plant is judged at its real size.

## Deviations from Plan

### Auto-fixed Issues

None. Notes:

**1. [Process] The hover colour was not captured.** The plan asks that the plant reads "on the row and its hover colour". The screenshots show rows at rest only. In dark mode the plant also reads on the card surface, which is close to the hover tint. Hovering a row is left to the owner's look.

**2. [Process] The capture used `setViewportSize` for 390 px**, as the existing #241 browser tests do, rather than the phone project's mobile emulation. The phone project's own sweeps already cover touch layout.

**Total deviations:** 0 auto-fixed, 2 process notes. **Impact:** none.

## Issues Encountered

- macOS has no `timeout` command, so the first two `timeout 590 gh pr checks --watch` calls returned at once. The checks were then watched without it, and every check completed green.

## Known Stubs

None.

## Threat Flags

None. T-01-21: the screenshots come only from the demo and disposable budgets, are ignored and are uncommitted, and the PR body was scanned. T-01-22: the pre-push guards passed and the push was a plain fast-forward. T-01-23: nothing was merged, tagged, published or closed. T-01-SC: no install.

## Left for the owner

- Look at the 32 screenshots and drag them into a PR #273 comment (the evidence rule: attach, never commit).
- Wait for or request Codex's review of `575c3ea`, then resolve the old P1 thread on `UpSyncBadge.tsx`, which plan 02 fixed.
- Merge PR #273 into `redesign`, then close #244 and #241 by hand. Tagging or publishing `0.2.0-up.174` stays the owner's decision.

## Self-Check: PASSED

- FOUND: 32 PNG files under /Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/
- FOUND: origin/wave-f = 575c3ea48bd32f791a1417762140a1a7bd482c0a, `1627cae` an ancestor
- Commits in this plan: 0 (no code change, which is legitimate here)

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*
