---
phase: 02-shared-form-controls
plan: 12
subsystem: ui
tags: [docs, release, changelog, pull-request, ci, gallery, evidence]
status: complete
requires:
  - phase: 02-shared-form-controls
    provides: "the shared control set, gallery, screenshot test and picker rewiring (02-04 to 02-11, 02-13 to 02-20)"
provides:
  - "docs/ui HANDOVER-UI, MAP, WAVES, README and FORM-CONTROLS-AUDIT describe the G1 set, the gallery, its baselines and the picker rule"
  - "0.2.0-up.175 in package.json, package-lock.json (two places) and homeassistant/config.yaml, with its CHANGELOG entry"
  - "PR #277 (feat/wave-g1-controls into redesign), open, CI green on aefe89a"
  - "32 evidence screenshots in the main checkout's .ui-evidence/2026-11-18-wave-g1/ (not committed)"
affects: [phase-03, phase-04, the HIGH-tier review and merge of #277]
tech-stack:
  added: []
  patterns:
    - "The PR branch is built from origin/redesign by restoring the executor checkout minus .planning, one commit per sync"
key-files:
  created:
    - docs/superpowers/gsd-records/phases/02-shared-form-controls/02-12-SUMMARY.md
  modified:
    - docs/ui/HANDOVER-UI.md
    - docs/ui/MAP.md
    - docs/ui/WAVES.md
    - docs/ui/README.md
    - docs/ui/FORM-CONTROLS-AUDIT.md
    - CHANGELOG.md
    - package.json
    - package-lock.json
    - homeassistant/config.yaml
    - skills/system/run-workflow/SKILL.md
    - client/src/components/ui/Switch.tsx
    - client/src/components/ui/Checkbox.tsx
    - client/src/components/ui/RadioGroup.tsx
    - client/src/components/ui/Switch.test.ts
    - client/src/components/ui/Checkbox.test.ts
    - client/src/components/ui/RadioGroup.test.ts
    - client/src/components/transactions/PayeeCombobox.tsx
    - client/src/components/transactions/PayeeCombobox.test.ts
    - e2e/tests/gallery/overlays.spec.ts
    - e2e/tests/gallery/__screenshots__/overlays.spec.ts/open-payeecombobox-light.png
    - e2e/tests/gallery/__screenshots__/overlays.spec.ts/open-payeecombobox-dark.png
key-decisions:
  - "origin/redesign gained #275 (G0 audit, identical to the checkout's docs) and #276 (drops .planning, formats skills/system/run-workflow/SKILL.md). Merging #276 would delete the executor's .planning, so only SKILL.md was taken from origin (b99499a); the PR restore excludes .planning anyway"
  - "Toggle labels (Switch, Checkbox, Radio) are now relative: React Aria's absolutely placed hidden input made the phone welcome screen scroll as a whole (+297 px). Earlier SUMMARYs (02-14, 02-18, 02-19) called this failure pre-existing; it came from 02-15's Switch rebuild, and CI's Linux fonts hid it"
  - "Codex's P1 on #277 was verified and fixed: the desktop payee field lost its only focus mark when the global outline moved to @layer base; bareField now has a brand-600 focus-visible ring like CategorySelect"
  - "overlays.spec 'Tab stays inside the dialog' raced the payee list's fade-out (1 in 4 local runs); the test now asserts no listbox is open before the second open, a stronger precondition, not a looser locator"
  - "open-payeecombobox-{light,dark} baselines replaced by CI's own actual images after looking at them: the focus ring is the only difference"
requirements-completed: [WAVG-02, WAVG-03, WAVG-04]
duration: 2 h 57 min
completed: 2026-11-18
actuals:
  tasks: 3
  commits: 9
plan_head_before: 03313e8d7ecee7bbc95a9b638079deabc2dc8382
plan_head_after: 50e90ca
coverage:
  - deliverable: "UI docs, changelog and version for the set PR"
    human_judgment: false
    verification:
      - kind: command
        ref: "version-ok 0.2.0-up.175; no-package-change; MAP Select.tsx 1; README gallery-baselines 1; HANDOVER MonthRangePicker 1; CHANGELOG month range 1; audit 'kept in the set PR' 0; prettier --check"
        status: pass
  - deliverable: "Full suite on Node 24"
    human_judgment: false
    verification:
      - kind: command
        ref: "client 830, build, lint 86 + 126 warnings, e2e tsc, desktop 489, phone 63, demo 25, server-mode 17, multi-user 8, gallery 145 (+46 Linux-only skipped)"
        status: pass
  - deliverable: "Evidence screenshots"
    human_judgment: true
    rationale: "Owner looks at the 32 images in .ui-evidence/2026-11-18-wave-g1/ against 02-UI-SPEC.md (D-03, #264)"
  - deliverable: "PR #277 open with CI green, gallery pixel test included"
    human_judgment: false
    verification:
      - kind: ci
        ref: "https://github.com/tvrooi/Allotment/pull/277 run 44294987939 on aefe89a: CI passed, e2e 203 + 203 + 191 + 199 = 796 passed"
        status: pass
---

# Phase 2 Plan 12: The set PR (docs, 0.2.0-up.175, full check, PR #277) Summary

**The UI docs now describe the shared control set, the gallery and the picker rule. The version is 0.2.0-up.175, with its changelog entry. The whole suite passed on Node 24 after three fixes, and PR #277 (`feat/wave-g1-controls` into `redesign`) is open with CI green on aefe89a, the gallery's pixel tests included.**

## Performance

- Start 2026-11-18T08:44Z, end 2026-11-18T11:41Z (2 h 57 min); 3 tasks; 9 commits in the checkout, 3 on the PR branch.

## Accomplishments

- **Docs.** `HANDOVER-UI.md`:
  - The G1 entry: the eleven controls, `fieldClasses.ts` and `fieldMessages.ts`, the `/dev/controls` gallery and the stub, the `gallery` project, `gallery-baselines.sh` and `--update`, and the e2e helpers.
  - The rebuilt `MonthRangePicker` and its three users.
  - What has not moved yet.
  - The new picker rule in Decisions, three traps, and #264's state.

  `MAP.md`: one line per new shared file, `MonthRangePicker` on `MonthGrid`, and a paragraph on the picker rule, the gallery and its specs. `WAVES.md`: F merged; G0 (#275) and G1 (#277) rows; the new desktop picker rule; Open PRs and next steps. `README.md`: the baselines are fixtures, not evidence. `FORM-CONTROLS-AUDIT.md`: the three range rows now say "rebuilt … (D-11, owner gate 17 Nov 2026)", with phase "Phase 2 (G1)", and both prose places record the owner's answer.
- **Version.** `npm run release:prepare -- 0.2.0-up.175`, plus a CHANGELOG entry: the set, #264, placeholders, one focus mark, Today, the pickers (arrow keys, Escape, create error), and the month range. No tag `v0.2.0-up.175` exists locally or on origin.
- **Full check** (table below), with three fixes made and committed along the way.
- **PR #277** opened from a clean branch at `origin/redesign` with no `.planning`, `.ui-evidence`, `.omc` or `server` path. Its body lists every changed selector with its reason, Node 24 results, the evidence and the owner's choices.

## Checks (Node 24.10.0, macOS, one project at a time, E2E_SKIP_BUILD never set)

| Command | Result |
|---|---|
| `npm --prefix client test` | 826 passed, then 829 after the toggle fix, then 830 after the payee ring |
| `npm --prefix client run build` | passed (each time) |
| `npm --prefix lint test` / `run lint` | 86 passed / 0 errors, 126 warnings (cap 128, unchanged) |
| `cd e2e && npx tsc --noEmit` | passed |
| `npx prettier --check .` (root) | fails only on `docs/superpowers/gsd-records/*` (dropped from redesign by #276, not in the PR) and the untracked dispatcher task file; Prettier on all 153 tracked files this phase changed: passed |
| e2e `desktop` | 489 passed (16.6 min) |
| e2e `phone` | 62 passed, 1 failed (welcome screen +297 px) → fixed → 63 passed |
| e2e `demo` | 25 passed (again after the toggle fix: 25) |
| e2e `server-mode` | 17 passed |
| e2e `multi-user` | 8 passed |
| e2e `gallery` | 144 passed, 1 failed, 46 skipped → after the fixes: 145 passed, 46 skipped (pixel tests are Linux only) |
| desktop subsets after fixes | first-run, settings, accessibility: 39 passed; transactions, accessibility, rules: 61 passed |
| `bash e2e/gallery-baselines.sh` (amd64 emulated) | 190 passed, 1 failed: every pixel test matched; `combobox.spec.ts:134` timed out at 30 s (an option detached while the emulated browser re-rendered). It passed in every native run and in CI |
| `--update` after the payee ring | 189 passed, 2 failed (`combobox.spec.ts:134` and `:254`, the same emulation timeouts), so the script copied nothing; CI's images were used instead |
| CI on #277 | b65466f: all green, 796 e2e passed. fa7a551: e2e 4/4 failed the two open-payeecombobox baselines (expected, ring). aefe89a: all green, 203 + 203 + 191 + 199 = 796 passed, 0 flaky |

## Evidence

32 PNGs in `/Users/tristanvanrooyen/Github/Allotment/.ui-evidence/2026-11-18-wave-g1/` (copied from the worktree, git-ignored there, none tracked; the temporary specs were deleted):

- `gallery-{1280,390}-{light,dark}.png`: the gallery's full page.
- `desktop-add-transaction-payee-*`, `desktop-category-picker-row-*` (the details sheet on a phone), `desktop-category-picker-review-*`, `desktop-goal-date-*` (calendar open at 1280; native at 390) and `desktop-report-month-range-*` (dialog at 1280; From and To month inputs at 390). Each is at 1280 and 390, light and dark, on disposable e2e budgets.
- `demo-category-picker-review-*` and `demo-report-month-range-*`: on the demo budget, at 1280 and 390, light and dark.

I looked at a sample against 02-UI-SPEC.md: the payee suggestions with the "New payee" footer, the dark range dialog with its From and To grids, the native month and date fields on a phone, the phone category picker, and the calendar with Today.

## PR

- #277 https://github.com/tvrooi/Allotment/pull/277, base `redesign`, OPEN, not merged.
- Pushed commits: b65466f (the set), fa7a551 (payee ring and overlays wait), aefe89a (CI baselines). All plain pushes.
- CI: green on aefe89a (run 44294987939).
- **Baselines from CI:** `open-payeecombobox-light.png` and `open-payeecombobox-dark.png`. Each was taken from CI's actual image (both attempts byte-identical) and looked at beside the old baseline: the payee field's new focus ring is the only difference. No other baseline changed.
- **Codex:** one P1 on b65466f (`client/src/index.css:370`): the desktop payee field had no focus mark after the global outline moved to `@layer base`. I verified it in the code, fixed it in 4a35f41/fa7a551 with a test, and left the thread unresolved.
- #267 and #264: OPEN. No tag for 0.2.0-up.175. Nothing published, and the live app was not touched. The temporary worktree is removed; the branch stays.

## Deviations from Plan

1. **[Rule 3, blocking] origin/redesign was not merged into the checkout.** #276 drops `docs/superpowers/gsd-records/`, and merging it would delete the executor's planning files. Its only other change, `skills/system/run-workflow/SKILL.md`, was taken alone (b99499a), and #275's docs were already identical. `git diff origin/redesign <source>` outside `.planning` lists only this phase's files.
2. **[Rule 1, bug] Phone welcome screen scrolled as a whole** (`phone.spec.ts:77`, +297 px). A probe found React Aria's absolutely placed hidden input inside the Switch's unpositioned label stretching the document. The Switch, Checkbox and Radio labels are now `relative` (a40f72f). The three new unit tests fail without the change. The Switch's markup snapshot gains the one class, with the reason in its comment. Phone, demo, the desktop switch specs, the client suite and the gallery were rerun.
3. **[Rule 1, bug, from review] Payee field focus mark** (4a35f41): see Codex above.
4. **[Rule 1, test race] `overlays.spec.ts` "Tab stays inside the dialog while the Select is open"** failed in 1 of 4 local runs. A probe showed the Tab pass crossing the payee field (its list opens on focus) and the list still fading out when the Select opened, so the unscoped `getByRole('listbox')` found two. The test now asserts no listbox is open before the second open (447332f): stronger, not looser. Afterwards: 42 of 42 repeats and 4 of 4 combined runs passed.
5. **[Rule 3] Gallery baselines from CI**, as Step 4 allows: two images (above).
6. The plan's WAVES.md G1 row needed the PR number before it existed. I wrote #277 (the next number on the repo) and confirmed it when the PR was created.

## Issues Encountered

- The amd64-emulated container takes about 20 min and times out one or two functional Combobox tests at random. They passed natively and in CI. Neither test was changed.
- `gsd_run` was not used for commits; commits went through git with hooks, on `worktree-agent-p0212-a1`.

## Left for the owner

- The HIGH-tier review of #277 that #267 asks for shared components, then merging it.
- Attaching the screenshots in `.ui-evidence/2026-11-18-wave-g1/` to the PR.
- Closing #264 after the merge, and #267 when Wave G ends.
- Resolving the Codex thread on #277 if satisfied with fa7a551.

## Self-Check: PASSED

- SUMMARY file exists at `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-12-SUMMARY.md`.
- Commits b99499a, f30f275, 0ab3fd6, 21a7e69, a40f72f, 33fdb0b, 4a35f41, 447332f and 50e90ca exist on `worktree-agent-p0212-a1`.
- PR #277 is OPEN against `redesign`, its body names Node 24, and CI is green on aefe89a. #267 and #264 are OPEN, and no tag v0.2.0-up.175 exists.
- STATE.md and ROADMAP.md are unchanged by this plan.

Phase complete, ready for verification (the HIGH-tier review and the merge follow).
