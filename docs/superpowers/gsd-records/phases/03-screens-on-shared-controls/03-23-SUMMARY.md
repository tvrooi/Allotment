---
phase: 03-screens-on-shared-controls
plan: 23
subsystem: ui
tags: [wave-g, g3, pull-request, release-prep, changelog, docs, evidence, wavg-06]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'the G3 screen moves (03-17 to 03-22, 03-25), the review-round fixes (merge b22eca07) and the 03-25 fixes (e795221c, acf5263e)'
provides:
  - 'PR #279 (feat/wave-g3-screens into redesign), open, not merged'
  - 'Version 0.2.0-up.177 in package.json, package-lock.json and homeassistant/config.yaml, with its CHANGELOG entry'
  - 'G3 text in docs/ui/HANDOVER-UI.md, docs/ui/MAP.md, docs/ui/WAVES.md and HANDOVER.md'
  - '44 evidence screenshots in the main checkout .ui-evidence/2026-11-21-wave-g3/ (git-ignored)'
affects: [phase-04]
plan_head_before: e40837f13ea01811661f289c013ba8b15d3f72b0
plan_head_after: 21a99a94
commits: 3
actuals:
  tokens: 5300
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - 'Clean PR branch: temporary linked worktree at origin/redesign, git restore --source=redesign excluding .planning, plain push (as 03-15)'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-23-SUMMARY.md
  modified:
    - docs/ui/HANDOVER-UI.md
    - docs/ui/MAP.md
    - docs/ui/WAVES.md
    - HANDOVER.md
    - CHANGELOG.md
    - package.json
    - package-lock.json
    - homeassistant/config.yaml
    - e2e/tests/phone/polish-phone.spec.ts
key-decisions:
  - 'Version 0.2.0-up.177: up.176 is G2 (merged as #278), no up.17x tag exists locally or on origin, and the only other open PR (#274) carries no newer version'
  - 'origin/redesign (c283170c, the G2 squash) was already contained in local redesign, so no merge was needed before the restore'
  - 'The DatePicker late-value reset is documented as a Trap in docs/ui/HANDOVER-UI.md and listed in the PR, not on the DatePicker value prop: DatePicker.tsx is not in this plan''s files and this plan changes no source'
  - 'lint/package.json unchanged: the warning count is 122, equal to the cap, so there was nothing to lower and Task 1 had no commit'
patterns-established: []
requirements-completed: [WAVG-06]
coverage:
  - id: D1
    description: 'Whole-G3 leftover gate prints 0'
    requirement: WAVG-06
    verification:
      - kind: command
        ref: 'the perl gate in 03-23-PLAN.md Task 1'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Every suite green on Node 24 and in CI'
    requirement: WAVG-06
    verification:
      - kind: e2e
        ref: 'npm --prefix e2e test -- --project=desktop|phone|demo|server-mode|gallery'
        status: pass
      - kind: ci
        ref: 'gh pr checks 279 --repo tvrooi/Allotment'
        status: pass
    human_judgment: false
  - id: D3
    description: 'G3 PR open with behaviour changes, selector changes, stays native, scope line and findings for the owner'
    requirement: WAVG-06
    verification:
      - kind: command
        ref: 'gh pr list --repo tvrooi/Allotment --head feat/wave-g3-screens --state open'
        status: pass
    human_judgment: true
    rationale: 'The owner reviews and merges #279 (D-12) and looks at the evidence screenshots at 390 px'
duration: 35min (after the usage-limit resume)
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 23: The G3 pull request

**PR #279 is open from `feat/wave-g3-screens` into `redesign`, with every CI check green on `04ace500` after one date-dependent test was fixed. The whole-G3 gate prints 0, every local suite passes on Node 24, the version is 0.2.0-up.177 and the lint warning count is 122, the same as the cap.**

## Performance

- Duration: about 35 min after the resume (most of it the five Playwright projects, about 28 min, and CI)
- Tasks: 3
- Commits on `redesign`: 3 (plus this SUMMARY's); 3 on the PR branch

## Accomplishments

- Task 1: the whole-G3 gate prints **0** over 56 files. Lint shows 0 errors and 122 warnings. The cap is 122, so `lint/package.json` is unchanged and Task 1 has no commit. All suites passed on the first run (table below).
- Task 2: `npm run release:prepare -- 0.2.0-up.177`. The CHANGELOG entry covers the G3 screens (#267), the D-14 fields (the runway's three fields, the last year, rows above the header), the money fields moved to the shared field (the goal status amount and the runway amounts), the long-term fields on the shared number field, and the month grid fixes (IN-02, IN-03). Updated: HANDOVER-UI.md (G3 done; Phase 4 next; traps for the DatePicker late-value reset and the Combobox `menuTrigger`), MAP.md (each G3 route's shared controls), WAVES.md (G2 merged; G3 open) and HANDOVER.md State. 44 evidence screenshots were taken.
- Task 3: clean branch from origin/redesign (`0d22556a`, then `6e925a8e` for the PR number). The body of PR #279 has: What moved, Behaviour changes (a table, each row with its failing-first test), Selector changes, Stays native, a Scope line quoting the WAVG-06 export record, Findings for the owner, Checks and Evidence.

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | none | no file changed (gate 0, lint at the cap) |
| 2 | `72abcba5` | docs(03-23): Wave G3 handover, map, waves and changelog; version 0.2.0-up.177 |
| 3 | `66dad3de` | docs(03-23): record the G3 PR number (#279) |
| 3 (CI fix) | `21a99a94` | fix(03-23): the import mapping phone test no longer depends on today's date |
| PR branch | `0d22556a`, `6e925a8e`, `04ace500` | feat(ui): Wave G3: planning, reports, files and import on the shared controls (#267); docs(ui): record the Wave G3 PR number (#279); fix(e2e): the import mapping phone test no longer depends on today's date |

## Verification

| Check (Node 24.10.0) | Result |
| --- | --- |
| Whole-G3 gate (Task 1 automated 1) | `0` (56 files) |
| `npm --prefix client test` | 103 files, 950/950 |
| `npm --prefix client run build` | built |
| `npm --prefix lint test`; `npm --prefix lint run lint` | 86/86; 0 errors, **122 warnings** (cap 122) |
| `cd e2e && npx tsc --noEmit` | clean |
| `--project=desktop` | 540 passed (18.8 min) |
| `--project=phone` | 66 passed |
| `--project=demo` | 26 passed |
| `--project=server-mode` | 17 passed |
| `--project=gallery` | 159 passed, 50 skipped (pixel tests run on Linux only) |
| Prettier 3.9.10, Task 2 automated 2 | 53 files, all clean |
| Version, Task 2 automated 1 | the three files agree on `0.2.0-up.177`; the CHANGELOG heading matches; no local or remote tag (the plan's grep expects `"…"`, but release:prepare writes single quotes, as 03-15 found; a quote-aware check passes) |
| `git ls-files .ui-evidence` | empty |
| `gh pr list … --head feat/wave-g3-screens --state open` | `1` (#279) |
| `gh pr checks 279` | first run on `6e925a8e`: e2e (3/4) failed `phone/polish-phone.spec.ts:313` (Deviation 5); on `04ace500` every check passes (client, server, lint, electron, e2e 1-4/4, builds linux/macos/windows, homeassistant, verify, test, CI passed; publish and release skipped) |
| PR diff | no `.planning`, `.ui-evidence`, `.omc`, `.impeccable` or `server` path; outside `.planning`, the branch tree equals `redesign`; only the root version changed in `package.json` and `package-lock.json` |
| #267 | open; nothing merged, tagged or published |

## Evidence

44 PNGs in `/Users/tristanvanrooyen/Github/Allotment/.ui-evidence/2026-11-21-wave-g3/`, made by a temporary desktop spec on a disposable e2e budget. The spec was deleted and never committed. They show 11 views: Goals and Add goal, Investments and Add holding, the long-term forecast, the cash runway, Reports, the report builder, Files, a file's details with a long name, and the CSV mapping step. Each view is at 1280 and 390 px, light and dark. In no view did the page or `<main>` scroll sideways. I looked at four: the 390 dark import mapping (its column table scrolls inside its own box, as before), the 390 light runway, the 390 file details (a long name truncates on one line), and the 1280 dark goal form.

## Deviations from Plan

1. **[Plan check] Task 2's version grep** expects `version: "$V"` or `version: $V`. `release:prepare` writes `version: '0.2.0-up.177'`, so the plan's command prints 0, as it did for 03-15. A quote-aware check passes.
2. **[Repo rule] docs/ui/WAVES.md** is not in the plan's file list. HANDOVER-UI.md's Traps say to update it whenever a wave PR opens, as 03-15 did.
3. **DatePicker `value` documentation:** the orchestrator asked for it on the prop if it fit this plan's files. It does not (`DatePicker.tsx` is source, and this plan changes none), so it went into the HANDOVER-UI.md Traps and the PR findings instead.
4. **The evidence spec ran in the main checkout**, and the plan runs no separate worktree for it. The plan said "copied to the main checkout", but the screenshots were made there, so no copy was needed.
5. **[Rule 1, bug] CI failed `phone/polish-phone.spec.ts:313`**, a test 03-25 added. It built its CSV from `isoDay(-40)` and `isoDay(-39)`, which on CI's UTC date (20 November) were 11/10 and 12/10. Either could be the day or the month, so the import asked for the date format and the mapping never appeared. Locally it passed because the local date (21 November) gave 12/10 and 13/10. The fix starts from a day between the 13th and the 27th, as `switchers.spec.ts` does. The old test fails under `TZ=UTC`, and the whole `polish-phone.spec.ts` passes 13/13 under UTC and under local time, each on a fresh build. A run with `E2E_SKIP_BUILD=1` had failed on a stale shared build cache (a trap HANDOVER-UI.md already names); it is not counted. Commits `21a99a94` (checkout) and `04ace500` (PR branch). The PR body's Checks table records this.

## Findings for the owner

All of these are in PR #279's body:

- `YnabImportModal.tsx:212`: retrying a failed import creates the new groups and categories again.
- The DatePicker late-value reset.
- The cash runway `NameInput` probably needs two clicks to Save.
- The picker still reads "Choose a working from home".
- The MonthRangePicker To grid has a floor twin of IN-03.
- GoalFormModal and the runway Saves do not use `useCanSave`.
- CategorySelectButton has no disabled state and no size prop.
- File details labels are mixed.
- A stale comment at `accessibility.spec.ts:250`.
- The goal status RED run was not made on the old build, and the runway's emptied phone date was not run.
- 02-UAT tests 1 and 2 are still pending.
- Neither #278 nor #279 has had a human or Codex review; #279 had one Claude Opus round.

## Threat Flags

- T-03-33: the PR diff has no `.planning`, `.ui-evidence` or `.omc` path. A scan of the added lines for tokens, hostnames and personal details found nothing. The screenshots use a disposable e2e budget and are not pushed.
- T-03-34: release:prepare set all three version files. No tag was created or moved.
- T-03-SC: no dependency block or sub-project lockfile changed. The root lockfile changed only its version fields.

## User Setup Required

None. The owner reviews and merges #279 (D-12), and runs the 02-UAT manual checks.

## Next Phase Readiness

Phase 3 is complete when the owner merges #279. Phase 4 then moves Settings (with DataExport), the bank connections and the shelved pages, adds the lint rule, and removes the native `Select` and `CategorySelect`. Do not merge, tag, publish or close #267 from here.

## Self-Check: PASSED

- Commits `72abcba5`, `66dad3de` and `21a99a94` are on `redesign`; `0d22556a`, `6e925a8e` and `04ace500` are on `origin/feat/wave-g3-screens`.
- `git ls-files .ui-evidence` prints nothing; 44 PNGs are in `.ui-evidence/2026-11-21-wave-g3/`. The temporary spec and the temporary worktree are removed.
- PR #279 is open, not merged; no tag `v0.2.0-up.177` exists.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-21_
