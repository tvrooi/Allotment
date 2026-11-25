---
phase: 03-screens-on-shared-controls
plan: 15
subsystem: ui
tags: [wave-g, g2, pull-request, release-prep, changelog, docs, evidence, lint-cap]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'the G2 screen moves (03-02 to 03-14, 03-24) and the 03-13 review fixes (49256e24)'
provides:
  - 'PR #278 (feat/wave-g2-screens into redesign), open, CI green on d6d6ca1a, not merged'
  - 'Version 0.2.0-up.176 in package.json, package-lock.json and homeassistant/config.yaml, with its CHANGELOG entry'
  - 'G2 text in docs/ui/HANDOVER-UI.md, docs/ui/MAP.md, docs/ui/WAVES.md and HANDOVER.md'
  - 'Lint warning cap 122 (was 128)'
  - '72 evidence screenshots in the main checkout .ui-evidence/2026-11-20-wave-g2/ (git-ignored)'
affects: [03-16, 03-23, phase-04]
plan_head_before: f5f1aa5f
plan_head_after: 37bb7204
commits: 6
actuals:
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - 'Clean PR branch: temporary linked worktree at origin/redesign, git restore --source=<checkout> excluding .planning, plain push'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-15-SUMMARY.md
  modified:
    - e2e/tests/investments.spec.ts
    - lint/package.json
    - client/src/components/budget/BudgetAmountSheet.tsx
    - client/src/components/ui/numberText.test.ts
    - e2e/tests/settings.spec.ts
    - docs/ui/HANDOVER-UI.md
    - docs/ui/MAP.md
    - docs/ui/WAVES.md
    - HANDOVER.md
    - CHANGELOG.md
    - package.json
    - package-lock.json
    - homeassistant/config.yaml
key-decisions:
  - 'origin/redesign was not merged into the checkout: its only commits not in local redesign are the squashes of G0 (#275), G1 (#277) and #276, which deletes .planning; `git diff origin/redesign <source>` outside .planning listed only phase files, and the restore excludes .planning (as 02-12 did)'
  - 'Local redesign (49256e24, the 03-13 review fixes) was merged into the branch on the orchestrator''s instruction before the push'
  - 'MAP.md names each G2 route''s shared controls in a list under the routes table instead of a new table column, which would re-pad every row'
patterns-established: []
requirements-completed: [WAVG-05]
coverage:
  - id: D1
    description: 'Whole-G2 leftover gate prints 0'
    requirement: WAVG-05
    verification:
      - kind: command
        ref: 'the perl gate in 03-15-PLAN.md Task 1'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Every suite green on Node 24 and in CI'
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop|phone|demo|server-mode|gallery'
        status: pass
      - kind: ci
        ref: 'gh pr checks 278 --repo tvrooi/Allotment'
        status: pass
    human_judgment: false
  - id: D3
    description: 'G2 PR open with behaviour changes, selector changes, stays native and findings for the owner'
    requirement: WAVG-05
    verification:
      - kind: command
        ref: 'gh pr list --repo tvrooi/Allotment --head feat/wave-g2-screens --state open'
        status: pass
    human_judgment: true
    rationale: 'The owner reviews and merges #278 (D-12) and looks at the evidence screenshots at 390 px'
duration: 3h
completed: 2026-11-20
status: complete
---

# Phase 3 Plan 15: The G2 pull request

**PR #278 is open from `feat/wave-g2-screens` into `redesign` with every CI check green. The whole-G2 gate prints 0, every local suite passes on Node 24, the version is 0.2.0-up.176 and the lint cap is now 122.**

## Performance

- Duration: about 3 h (most of it single-worker Playwright runs and CI)
- Tasks: 3
- Commits on the worktree branch: 6 (plus the merge of `redesign`); 2 on the PR branch

## Accomplishments

- Task 1: the accessibility.spec.ts role changes (`button 'Account type'`, the `Start date` group's segment, `radiogroup 'Budget type'`) and the transactions.spec.ts:520 `setToggle` were already made by 03-05, 03-08, 03-11 and 03-13 (orchestrator note 1). This plan checked that they pass and applied nothing twice. The gate prints 0. One G2 regression outside the plan's spec list was fixed: `investments.spec.ts:17` (below). The lint cap went down from 128 to 122.
- Task 2: `npm run release:prepare -- 0.2.0-up.176` (up.176 is free: no tag, and the only other open PR, #274, carries up.174). The CHANGELOG entry covers the screens, each D-14 field, the money fields, saving a picked date at once, the pickers and the short months on phones. HANDOVER-UI.md, MAP.md, WAVES.md and HANDOVER.md are updated. The 72 evidence screenshots were taken and copied to the main checkout.
- Task 3: the clean branch at origin/redesign (`4de31c1a`, then `d6d6ca1a` for the PR number). PR #278's body has: What moved, Behaviour changes (D-14 and money tables with their failing-first tests), Selector changes (every changed spec line with its reason), Stays native, Findings for the owner, Checks and Evidence. CI is green.

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | `18ba905e` | test(03-15): exact Name label in the Add security spec, and lower the lint cap to 122 |
| 2 | `10fe3eb0` | docs(03-15): Wave G2 handover, map, waves and changelog; version 0.2.0-up.176 |
| 3 (pre-push) | `0baca4a5` | style(03-15): Prettier on three G2 files the format check flags |
| 3 (orchestrator) | `3a50b75b` | Merge branch 'redesign' (49256e24, 03-13 review fixes) |
| 3 | `04398535` | docs(03-15): G2 keeps three native file inputs, not four |
| 3 | `37bb7204` | docs(03-15): record the G2 PR number (#278) |
| PR branch | `4de31c1a`, `d6d6ca1a` | feat(ui): Wave G2 … (#267); docs(ui): record the Wave G2 PR number (#278) |

## Files Created/Modified

See `key-files`. No `.planning`, `.ui-evidence` or `server` file is on the PR branch; no dependency block or sub-project lockfile changed (only the root version and the lint cap).

## Verification

| Check (Node 24.10.0) | Result |
| --- | --- |
| Whole-G2 gate (Task 1 automated 1) | `0`, before and after merging 49256e24 |
| `npm --prefix client test` | 944/944; 947/947 after the merge |
| `npm --prefix client run build`; client `tsc --noEmit` | built; clean |
| `npm --prefix lint test`; `npm --prefix lint run lint` | 86 passed; 0 errors, **122 warnings** (cap 122) |
| `cd e2e && npx tsc --noEmit` | clean (before and after the merge) |
| `--project=desktop` | 524 passed, 1 failed (`investments.spec.ts:17`); after the fix 4/4 in investments.spec.ts; after the merge `transactions.spec.ts` + `recover.spec.ts` 53/53 |
| `--project=phone` | 65 passed |
| `--project=demo` | 25 passed |
| `--project=server-mode` | 17 passed |
| `--project=gallery` | 159 passed, 50 skipped (pixel tests are Linux only) |
| Prettier, Task 2 automated 2 | clean after `0baca4a5`; `prettier --check .` on the PR tree clean |
| Version, Task 2 automated 1 | plan form prints `0` (see Deviation 3); the quote-aware form prints `version-ok` |
| `gh pr list … --head feat/wave-g2-screens --state open` | `1` |
| `gh pr checks 278` | all pass on `d6d6ca1a` (client, server, lint, electron, e2e 1-4/4, builds linux/macos/windows, homeassistant, verify, CI passed; publish and release skipped) |
| No `.planning`/`.ui-evidence`/`.omc`/`server` in the PR diff | 0 paths |
| #267 | OPEN; no `v0.2.0-up.176` tag locally or on origin; PR not merged |

## Evidence

72 PNGs in `/Users/tristanvanrooyen/Github/Allotment/.ui-evidence/2026-11-20-wave-g2/`, made by a temporary spec (deleted, never committed) on a disposable e2e budget. They show 18 views (each G2 screen and its main dialog) at 1280 and 390 px, light and dark. The spec checked `scrollWidth > clientWidth` on each view and found no sideways scroll. At 390 px the "details" shot is the register, because the phone rows do not open from the desktop row selector. I looked at the dark rule editor, the light new-row register and the 390 Add recurring dialog: the shared controls, the borders in both themes, and a long account value truncating on one line.

## Deviations from Plan

1. **[Rule 1, bug] investments.spec.ts:17 failed after 03-04's CurrencySelect move.** The shared Select renders React Aria's hidden native `<select>` inside a `<label>`, so the option text becomes its label. `getByLabel('Name')` is a case-insensitive substring match, so it also matched "VND · Vietnamese Dong". Users are not affected (the list is `aria-hidden`). Fix: `getByLabel('Name', { exact: true })` with a comment. Investments is a G3 screen, but the cause was a G2 change, and the desktop run has to pass. Commit `18ba905e`.
2. **[Rule 3, blocking] Three G2 files failed Prettier** (`BudgetAmountSheet.tsx`, `numberText.test.ts`, `settings.spec.ts`), so CI's `format:check` would have failed. Formatting only: `0baca4a5`.
3. **[Plan check] Task 2's version grep** looks for `version: "$V"` or `version: $V`, but `release:prepare` writes `version: '0.2.0-up.176'` (single quotes), so the plan's command prints 0. A quote-aware check (`^version: '$V'$`, package.json, both lockfile fields, the CHANGELOG heading, no local or remote tag) passes.
4. **[Repo rule] docs/ui/WAVES.md** is not in the plan's file list, but HANDOVER-UI.md's Traps say to update its Status and Open PRs whenever a wave PR opens. G1 is now marked merged (#277), G2 has a PR #278 row, and the next step is the owner merging G2.
5. **MAP.md** names each G2 route's shared controls in a list under the routes table, not inside each row's cell (see key-decisions).
6. **origin/redesign was not merged** (see key-decisions); the restore from the checkout carries everything except `.planning`.

## Issues Encountered

- Ports 3169-3180: every run waited until nothing listened on 3169. There was no EADDRINUSE.
- The Codex PR review on #278 did not run: "You have reached your Codex usage limits for code reviews". It left no findings, so nothing was resolved or dismissed.
- The first evidence run hung at 390 on the row click with no action timeout; the second run set an 8 s default timeout.

## Findings for the owner

They are in PR #278's body: 02-UAT tests 1 and 2 (VoiceOver and a real iPhone), 03-12 IN-03 (needs your acceptance), IN-02 and IN-04, 03-06 must-haves 2 and 3 superseded by D-15, the Budget amount cell kept on Input, the NoteField height, 03-24 IN-01 (CurrencyInput `bg-surface`/`max-md:text-base`), size gaps for CategorySelectButton and MerchantSelect, the form row quirks kept under D-15, the uncapped upcoming length, `server/src/routes/rules.ts:44` and `isoDate` (a separate change), and the flaky `gallery/combobox.spec.ts:134` and `:254`.

## Threat Flags

- T-03-23: the PR diff has no `.planning`, `.ui-evidence` or `.omc` path. A scan of the added lines and the PR body for hostnames, tokens and personal details found nothing. The screenshots use a disposable e2e budget.
- T-03-24: release:prepare set all three version files. No tag was created or moved.
- T-03-SC: no dependency block or sub-project lockfile changed. The root lockfile changed only its version fields.

## User Setup Required

None. The owner reviews and merges #278 (D-12) and runs the 02-UAT manual checks.

## Next Phase Readiness

G3 (03-16 to 03-23, 03-25) waits for the owner to merge #278. Do not merge, tag, publish or close #267 from here.

## Self-Check: PASSED

- Commits `18ba905e`, `10fe3eb0`, `0baca4a5`, `04398535` and `37bb7204` exist on `worktree-agent-p0315-a1`, as do `4de31c1a` and `d6d6ca1a` on `origin/feat/wave-g2-screens`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` are unchanged by this plan: `git diff f5f1aa5f HEAD -- docs/superpowers/gsd-records/STATE.md docs/superpowers/gsd-records/ROADMAP.md` is empty.
- `git ls-files .ui-evidence` prints nothing. The temporary spec and the temporary worktree are removed.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-20_
