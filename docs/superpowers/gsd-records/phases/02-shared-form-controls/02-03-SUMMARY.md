---
phase: 02-shared-form-controls
plan: 03
subsystem: ui
tags: [audit, owner-gate, wave-g, documentation]

requires: [02-01, 02-02]
provides:
  - "PR #275 (docs/wave-g0-audit into redesign) merged: docs/ui/FORM-CONTROLS-AUDIT.md and the HANDOVER-UI.md pointer are on origin/redesign"
  - "The owner gate's answer, in the record lines below, for plans 02-04 to 02-13"
affects: [02-04, 02-06, 02-08, 02-09, 02-11, 02-12, phase-3-screens, phase-4-guard]

actuals:
  tasks: 3
  commits: 1

key-decisions:
  - "The owner accepted the audit and said go, but chose to rebuild MonthRangePicker now, so the gate is recorded as go-with-changes (D-11 changes)"
  - "All 36 'owner to decide' rows take the audit's recommended answer"
  - "The .planning format:check failure was fixed by option (a): PR #276 removed docs/superpowers/gsd-records/ from origin/redesign"

requirements-completed: [WAVG-01]
---

# Plan 02-03 summary: the owner gate

Owner gate: go-with-changes
MonthPicker desktop form: grid
MonthRangePicker: rebuild
Changed decisions: D-11
Audit PR: #275 MERGED (squash fea7122 on origin/redesign)

## The owner's answer

Given in session t60 and confirmed by the owner in the orchestrator session (t4x), verbatim:
"go, grid, rebuild now, accept recommendations, (a)".

- **Gate:** the audit is accepted (not revise-audit). Because MonthRangePicker is rebuilt now
  rather than left as planned, the plans are revised before any of 02-04 to 02-13 runs.
- **MonthPicker on desktop:** grid. A button that opens a year stepper, a twelve-month grid and
  "This month"; phones keep the native month input (D-04). Unchanged from the plan.
- **MonthRangePicker:** rebuild in this phase, on the new MonthPicker's grid, instead of waiting
  for Reports (Phase 3) and Cash flow (Phase 4). Its three users are
  `reports/DateRangeControl.tsx`, `reports/ReportBuilderSidebar.tsx` and `pages/CashFlow.tsx`.
- **The 36 "owner to decide" rows:** every recommendation in the audit's "For the owner" section
  is accepted. Money fields become CurrencyInput; merchant text fields stay Input; fields that hold
  money or a percent use CurrencyInput in amount mode and Input in percent or weight mode; the
  other rows (bulk-edit payee name, import category mapping, the CheckList find box, the rule
  tag-list input) take the first answer the audit gives for each.
- **The .planning CI failure:** (a). PR #276 removed the 95 `docs/superpowers/gsd-records/` files from
  `origin/redesign` and ran Prettier on `skills/system/run-workflow/SKILL.md`. It merged green.
  Local `redesign` keeps `docs/superpowers/gsd-records/` and is never pushed to origin.

## Plans to revise with /gsd-plan-phase 2 (D-11)

- **02-08** (DatePicker and MonthPicker): add the MonthRangePicker rebuild on the MonthPicker grid,
  and the move of its three users.
- **02-11** (the gallery's checks): add MonthRangePicker to the keyboard, Escape and state checks.
- **02-12** (docs, version, full check): the docs and changelog name the rebuilt range picker.
- **02-06, 02-09:** each mentions MonthPicker or the range picker once; check the wording still
  holds.
- **02-04:** its precondition reads `Owner gate: go`; this record says `go-with-changes`.
- **Phases 3 and 4:** their CONTEXT, RESEARCH, PATTERNS and UI-SPEC files expect MonthRangePicker
  to be left untouched there. That still holds (they need not touch it), but the reason is now
  that Phase 2 (02-14) has already rebuilt it, with native month inputs on phones. Update the
  wording when those phases are planned: 03-CONTEXT.md:108-110, 03-RESEARCH.md:46/128/137/278,
  03-UI-SPEC.md:47/126, 04-UI-SPEC.md:47/125, 04-PATTERNS.md:55/392, 04-RESEARCH.md:189/231.

Revision outcome (after this record): plan 02-14 rebuilds MonthRangePicker; scope splits added
02-15 to 02-20; the owner also decided D-12 (Escape with a combobox list open closes only the
list). See 02-CONTEXT.md and ROADMAP.md for the 20-plan order.

The 36 accepted rows sit in screens that move in Phases 3 and 4. They do not change a Phase 2 plan
unless the set needs a CurrencyInput mode those rows depend on; the re-plan checks this.

## Task record

| Task | Result |
| ---- | ------ |
| 1. Open the audit PR | #275 from `docs/wave-g0-audit`, two documentation files only. Codex's one P2 finding (CategoryPicker already has a none item) was correct and fixed in c16cd69 (78fea69 on this branch). |
| 2. Owner gate | Answered as above. |
| 3. Record and merge | #276 merged first. `docs/wave-g0-audit` was then brought up to date from origin/redesign with a plain merge; every check passed; #275 squash-merged. Nothing was tagged, versioned or published. |

The worker for this plan (job `allotment-p02-03-exec-a1`) exited while it was blocked at the gate
(terminal t5z, exit code 129). The dispatcher job was cancelled, and the orchestrator (t60) did
Task 3 itself.

## Self-Check: PASSED

- Record lines: one `Owner gate:` line and one `MonthPicker desktop form:` line, each with an
  allowed value
- `gh pr view 275 --repo tvrooi/Allotment --json state` prints MERGED;
  `git cat-file -e origin/redesign:docs/ui/FORM-CONTROLS-AUDIT.md` exits 0
- No tag; the version files are unchanged
