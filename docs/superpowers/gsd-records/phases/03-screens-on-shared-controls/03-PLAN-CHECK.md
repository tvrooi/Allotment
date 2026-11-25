## ISSUES FOUND

**Phase:** 03-screens-on-shared-controls
**Plans checked:** 23 (03-01 to 03-23)
**Issues:** 2 blocker(s), 4 warning(s), 3 info

Method: read every PLAN (frontmatter, must_haves, tasks), CONTEXT D-01 to D-17, ROADMAP §Phase 3,
REQUIREMENTS WAVG-05/06, RESEARCH (Open Questions, Validation Architecture), UI-SPEC, VALIDATION,
02-REVIEW-DISPOSITION, 02-UAT and CLAUDE.md. Ran `verify.plan-structure` on all 23 plans: all valid,
2 or 3 tasks each, no missing files/action/verify/done. Ran every read-only grep and perl count gate
against HEAD: each printed value matches its `[HEAD=…]` notation. The path probe and the
failing-direction probe each report 0 blockers and 0 warnings out of 125 commands. Requirement
frontmatter: WAVG-05 is in 03-01 to 03-15 and WAVG-06 in 03-16 to 03-23. The depends_on graph has no
cycle, every edge points to an earlier wave, and no two plans in one wave list the same file in
files_modified.

Owner constraints hold in every plan. 03-15 and 03-23 stop at an open PR and are prohibited from
merging, tagging, publishing, updating the live app or closing #267. 03-16 Task 1 halts unless the G2
PR shows as merged and NumberField.tsx is on origin/redesign. No plan changes the server or a live
budget. Money stays in CurrencyInput (type=text, inputMode=decimal). No `type="number"` is introduced:
NumberField uses inputMode only. Every changed e2e selector is recorded with its reason. No test is
skipped, loosened, retried or made to sleep: 03-13's second-Escape case is recorded as a finding
rather than loosened. Every Phase 2 item deferred to Phase 3 has a task: IN-01, IN-04, R2-IN-02 and
R2-IN-03 in 03-03; IN-02 and IN-03 in 03-20; R2-IN-01 in 03-01 Q2; the second-Escape residual in
03-13.

### Blockers — these properties must hold ("must fix" is the property, never the example)

**1. [verify_command_format] The whole-G2 leftover gate counts only G2 files, so it prints 0 once G2 is complete**
- Plan: 03-15
- Task: 1
- Evidence: The gate mixes literal paths (for example `client/src/pages/Rules.tsx`) with wildcard
  pathspecs. With literal paths in the list, git 2.54 ignores the `':(exclude,glob)…'` entries:
  `git ls-files 'client/src/components/transactions/*.tsx' client/src/pages/Rules.tsx ':(exclude,glob)**/Import*.tsx' | grep -c Import`
  prints 4, while the same command without the literal path prints 0. The gate's file list
  therefore still contains ImportModal.tsx, YnabImportModal.tsx, ImportCategories.tsx,
  ImportHistory.tsx, CategorySelect.tsx and ConnectedBanks.tsx. Counted file by file at HEAD, the
  recorded 152 includes 17 from files outside G2: ImportModal 10, YnabImportModal 4,
  ImportCategories 2 (all moved by 03-22 in G3) and CategorySelect 1 (its `<select` at line 32;
  Phase 4 by the UI-SPEC exclusions). After 03-02 to 03-14 the gate still prints at least 17, never 0.
  The action says "any non-zero count is a file a plan missed: fix it here". That points the executor
  at migrating G3's import wizard inside the G2 PR, which contradicts D-12, D-13 and 03-22's scope.
  The alternative is editing CategorySelect, which is Phase 4 work. Either way the
  `must_haves.truths[0]` "leftover gate prints 0" cannot be met as specified.
  The G3 gate in 03-23 uses the same mixed form, but its only exclusion (`*.test.tsx`) matches no
  file today, so it gives the right result for now.
- Example fix (non-binding — any mechanism reaching the property counts): list files with no
  exclude pathspecs and filter afterwards (for example `| grep -vE '/(Import[^/]*|YnabImportModal|CategorySelect|ConnectedBanks)\.tsx$|\.test\.tsx$'`), then re-measure the HEAD baseline.

**2. [research_resolution] RESEARCH.md carries no unresolved open question**
- Plan: null (03-RESEARCH.md)
- Evidence: `03-RESEARCH.md:533` is `## Open Questions` without the `(RESOLVED)` suffix, and none of
  its three questions has a resolution marker:
  (1) whether DataExport.tsx is in G3 or Phase 4;
  (2) the custom role="switch" button in Rules.tsx;
  (3) a dense or inline field size for the Budget cell and the inline renames.
  The plans do take positions. 03-16 truth and 03-22 prohibition keep DataExport in Phase 4. The
  03-06 truth leaves the role switch as it is. 03-06, 03-09 and 03-11 use Input at size sm. None of
  this is recorded against the questions. Q1 is also a scope decision on WAVG-06's wording (see
  Warning 2) that the plans make themselves; no owner or CONTEXT decision records it.
- Example fix (non-binding): mark the section `## Open Questions (RESOLVED)`. Give each question
  `RESOLVED:` with the plan that decides it, and for Q1 say who decided.

### Warnings — these properties should hold

**1. [context_compliance] Every control on a moved screen has an accessible name, including those UI-SPEC lists as missing one today**
- Plan: 03-07, 03-08
- Evidence: 03-UI-SPEC.md "Missing Accessible Names to Add During Migration" requires these names:
  RuleEditorModal "Direction", "Match value", "Notes text", "Split percentage" and "Split notes";
  UpcomingLengthModal "Upcoming length", "Custom length number" and "Custom length unit".
  `grep -l` across all 23 plans finds none of these strings, except the dialog name "Upcoming length".
  The plans say instead "same accessible names" (03-07 Task 2) and "label kept as today's accessible
  name" (03-07 Task 1). The current controls have no name at all:
  - RuleEditorModal.tsx:557-575: the split percent input has no aria-label and no label;
  - the direction `<select>` near line 257 and the text inputs near 326, 426 and 589 are unnamed;
  - UpcomingLengthModal's `<select>`, `<input>` and `<select>` in lines 57-92 carry no aria-label.
  NumberField takes a required `label` string (03-02 Task 2), so 03-07 leaves the split percent's
  label undefined. Its new e2e case has no specified name to find the field by. The CLAUDE.md
  client rule ("Interactive controls have accessible names") and the UI-SPEC are left to the
  executor to remember.
- Example fix (non-binding): give each listed control its UI-SPEC name in the 03-07 and 03-08 task
  actions and acceptance criteria.

**2. [requirement_coverage] Every clause of WAVG-06 is delivered, or a recorded decision re-scopes it**
- Plan: 03-16, 03-22
- Evidence: REQUIREMENTS.md WAVG-06 and ROADMAP Phase 3 success criterion 1 both name "the import and
  export dialogs" without condition. The plans move only the import dialogs. 03-22 says "MUST NOT
  move settings/DataExport.tsx", on the grounds that no separate export dialog exists (UI-SPEC §1)
  and the audit files DataExport's dates under G4 (FORM-CONTROLS-AUDIT.md:90 and 500). The reasoning
  is sound. However, no plan records an owner confirmation, and no plan updates the requirement or
  roadmap wording. gsd-verifier will check the phase against the literal "export dialogs" and must
  either fail it or accept it silently.
- Example fix (non-binding): have 03-16 record the owner's confirmation, or note the re-scope against
  WAVG-06 (for example "export: none exists; DataExport is a Settings tab, Phase 4").

**3. [scope_sanity] Each plan stays within the per-plan context budget**
- Plan: 03-03, 03-12, 03-13, 03-22 (also 03-09, 03-10, 03-17, 03-19, 03-20)
- Evidence: files_modified counts:
  - 03-03 and 03-12: 12 each, one entry being a screenshot directory;
  - 03-09, 03-17, 03-19 and 03-20: 10 each.
  The 10-file mark is the warning threshold. estimate-check (--calibrated, budget 100000) shows
  03-13 and 03-22 at ratio 1.00 (100000 tokens), and 03-10, 03-12 and 03-19 at 0.95. None is over
  budget, but confidence is "low" (fewer than 3 calibrated phases). 03-13 and 03-22 have no margin;
  03-22 holds the 1147-line ImportModal.tsx.
- Example fix (non-binding): split 03-13 (form row and detail panel, then filters and marks) and
  03-22 (ImportModal, then YNAB and category mapping) so each has room to spare.

**4. [nyquist_compliance] Per-task samples stay fast, and VALIDATION.md maps each task**
- Plan: 03-08, 03-09, 03-13, 03-22 (and 03-VALIDATION.md)
- Evidence: Several per-task verifies run a whole Playwright project:
  - `--project=phone` with no spec filter: 03-08 Task 2, 03-09 Task 1 and 03-13 Task 2;
  - `--project=demo` with no filter: 03-22 Task 2.
  Check 8b flags full end-to-end suites at task level. VALIDATION.md promises a 120 s per-task
  sample. 03-VALIDATION.md still has its five `3-TBD | TBD | TBD` rows, which "the planner
  replaces … with real task ids", and keeps `nyquist_compliant: false`.
- Example fix (non-binding): filter the task-level phone and demo runs to the screen's specs, leave
  the full projects to 03-15 and 03-23, and fill the per-task map.

### Advisories (info)

**1. [dependency_correctness] Ordering between same-wave plans is declared, not implied**
- Plan: wave 3 (03-03, 03-05, 03-07, 03-08, 03-09, 03-10, 03-11, 03-14) and wave 8 (03-17 to 03-22)
- Evidence: config.json sets parallelization: true and use_worktrees: true. Every plan in these waves
  runs Playwright, and the e2e servers bind fixed ports 3171 to 3180 (e2e/ports.ts). 03-CONTEXT and
  03-VALIDATION say "e2e ports are fixed, so one browser run at a time". Run in parallel worktrees,
  these plans will collide on those ports, or one plan will test another worktree's server. No plan
  declares the shared resource or sets coupling_justified.
- Example fix (non-binding): serialise the browser verifies (one executor at a time for these
  waves), or declare the coupling.

**2. [task_completeness] files_modified names every file a task writes**
- Plan: 03-05, 03-04
- Evidence: 03-05 Task 2 adds an assertion to "the existing reconcile spec". That spec is
  e2e/tests/financial-integrity.spec.ts: it has 18 reconcile references, and accounts.spec.ts has 0.
  The file is not in 03-05's files_modified or its task files. 03-04 Task 1 says "grep e2e for other
  selectors of MerchantSelect's fields … and update them" with no file listed. The scan found only
  recurring.spec.ts using `textbox` for the Payee field, so the effect today is small.

**3. [context_compliance] Owner answers reach every artifact that waits on them**
- Plan: 03-01
- Evidence: 03-01 Task 2 records the MonthRangePicker and Welcome answers only in 03-01-SUMMARY.md.
  02-UAT.md tests 3 and 4 stay `[pending]`. If the owner picks `restore-in-phase-4`, no task carries
  it into Phase 4 planning (ROADMAP or backlog). UAT 1 (VoiceOver pass) and UAT 2 (real iPhone) are
  also pending. No Phase 3 plan notes them, although every screen move builds on those controls.

### Structured Issues

```yaml
issues:
  - plan: "03-15"
    dimension: verify_command_format
    severity: blocker
    task: 1
    required_property: "The whole-G2 leftover gate counts only G2 files, so it prints 0 once G2 is complete"
    description: "Mixing literal paths with wildcard pathspecs makes git ignore every ':(exclude,glob)' entry; at HEAD 17 of the recorded 152 come from ImportModal (10), YnabImportModal (4), ImportCategories (2) and CategorySelect (1), so after G2 the gate prints at least 17 and the action points the executor at G3 or Phase 4 files"
    fix_hint: "Filter the git ls-files output with grep -v instead of exclude pathspecs, and re-measure the HEAD baseline"
  - plan: null
    dimension: research_resolution
    severity: blocker
    file: "03-RESEARCH.md"
    required_property: "RESEARCH.md carries no unresolved open question"
    description: "'## Open Questions' at 03-RESEARCH.md:533 has no (RESOLVED) suffix or per-question markers: DataExport placement, the Rules role switch, dense field size; Q1 is a WAVG-06 scope call that no recorded decision makes"
    unresolved_questions:
      - "Is DataExport.tsx in G3 or Phase 4?"
      - "Rules.tsx role=switch button: swap or keep?"
      - "Dense or inline variant for the Budget cell and inline renames?"
    fix_hint: "Mark each RESOLVED with the plan that decides it, and say who decided Q1"
  - plan: "03-07"
    dimension: context_compliance
    severity: warning
    required_property: "Every control on a moved screen has an accessible name, including those UI-SPEC lists as missing one today"
    description: "UI-SPEC requires Direction, Match value, Notes text, Split percentage, Split notes (RuleEditorModal) and Custom length number/unit (UpcomingLengthModal); no plan names them, and 03-07 says 'label kept as today's accessible name' for a percent input that has none (RuleEditorModal.tsx:557-575)"
    fix_hint: "Name each control per UI-SPEC in the 03-07 and 03-08 actions and acceptance criteria"
  - plan: "03-22"
    dimension: requirement_coverage
    severity: warning
    required_property: "Every clause of WAVG-06 is delivered, or a recorded decision re-scopes it"
    description: "WAVG-06 and ROADMAP SC1 name 'the import and export dialogs'; 03-22 prohibits moving DataExport.tsx and no plan records an owner confirmation or a wording change"
    fix_hint: "Record the owner's confirmation in 03-16, or note the re-scope against WAVG-06"
  - plan: "03-13"
    dimension: scope_sanity
    severity: warning
    required_property: "Each plan stays within the per-plan context budget"
    description: "03-13 and 03-22 estimate 100000 of 100000 tokens (ratio 1.0, low confidence); 03-10/12/19 at 0.95; 03-03 and 03-12 list 12 files, 03-09/17/19/20 list 10"
    metrics: {"03-13": {tasks: 3, files: 8, ratio: 1.0}, "03-22": {tasks: 3, files: 5, ratio: 1.0}, "03-12": {tasks: 3, files: 12, ratio: 0.95}, "03-03": {tasks: 3, files: 12, ratio: 0.75}}
    fix_hint: "Split 03-13 and 03-22 so each has room to spare"
  - plan: "03-08"
    dimension: nyquist_compliance
    severity: warning
    required_property: "Per-task samples stay fast, and VALIDATION.md maps each task"
    description: "Whole --project=phone runs in 03-08 T2, 03-09 T1 and 03-13 T2, and a whole --project=demo run in 03-22 T2, at task level; 03-VALIDATION.md still has 3-TBD rows and nyquist_compliant: false"
    fix_hint: "Filter task-level runs to the screen's specs and fill the per-task map"
  - plan: null
    dimension: dependency_correctness
    severity: info
    plans: ["03-03", "03-05", "03-07", "03-08", "03-09", "03-10", "03-11", "03-14", "03-17", "03-18", "03-19", "03-20", "03-21", "03-22"]
    required_property: "Ordering between same-wave plans is declared, not implied"
    description: "Same-wave plans all run Playwright on fixed ports 3171-3180 (e2e/ports.ts) while parallelization and use_worktrees are true; CONTEXT says one browser run at a time"
    fix_hint: "Serialise the browser verifies for these waves, or declare the coupling"
  - plan: "03-05"
    dimension: task_completeness
    severity: info
    task: 2
    required_property: "files_modified names every file a task writes"
    description: "03-05 Task 2 edits the reconcile spec (e2e/tests/financial-integrity.spec.ts), which is not in files_modified; 03-04 Task 1 updates unnamed specs found by grep"
    fix_hint: "Add financial-integrity.spec.ts to 03-05's files"
  - plan: "03-01"
    dimension: context_compliance
    severity: info
    required_property: "Owner answers reach every artifact that waits on them"
    description: "The answers are recorded only in 03-01-SUMMARY.md; 02-UAT tests 3 and 4 stay pending, 'restore-in-phase-4' has no carrier into Phase 4, and UAT 1 and 2 (VoiceOver, real iPhone) are pending with no Phase 3 note"
    fix_hint: "Have 03-01 also update 02-UAT.md and, on restore-in-phase-4, add a Phase 4 backlog line"
```

### Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| WAVG-05 | 03-01 to 03-15 | Covered (the whole-G2 gate is defective, Blocker 1) |
| WAVG-06 | 03-16 to 03-23 | Covered for Goals, Forecast, Investments, Reports, Files and the import dialogs; "export dialogs" re-scoped without a record (Warning 2) |

### Recommendation

2 blocker(s), 4 warning(s) require revision. Returning to planner with feedback.

## ISSUES FOUND
