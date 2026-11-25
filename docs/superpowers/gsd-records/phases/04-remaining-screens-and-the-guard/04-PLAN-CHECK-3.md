# Phase 4 plan check: iteration 3, final (revision 2 = 05b26b2b, checked at cf253171)

## ISSUES FOUND

**Phase:** 04-remaining-screens-and-the-guard
**Plans checked:** 18 (04-01 to 04-18). Revision 2 changed 04-01, 04-02, 04-04, 04-11, 04-14 and 04-15, plus 04-RESEARCH.md and 04-VALIDATION.md.
**Issues:** 1 blocker, 1 warning, 1 info

Inputs read: the iteration-2 report (04-PLAN-CHECK-2.md), the full revision-2 diff (05b26b2b), all of
04-11, the changed tasks of 04-01, 04-02, 04-04, 04-14 and 04-15, 04-VALIDATION.md rows 4-01-02,
4-11-01, 4-14-01 and 4-15-03, 04-RESEARCH.md Open Question 3 and Pitfall 6, 04-CONTEXT.md D-09,
04-UI-SPEC.md (strayLabels, Label elementType), REQUIREMENTS.md (WAVG-07 to WAVG-10), ROADMAP.md
§Phase 4, STATE.md Decisions line 77, ~/.claude/agents/gsd-executor.md (checkpoint protocol),
docs/superpowers/gsd-records/config.json (auto_advance), lint/eslint.config.js, and CLAUDE.md. I also searched the
Phase 3 plans for label-wrapper handling.

Probes: the verify-command path probe and the failing-direction probe cover 114 commands each.
Every command is `severity: none`, with `readError: null`. Measured: 114 `<automated>` and 114
`<fails_when>` across 41 tasks. No finding comes from the probes.

### Iteration-2 issues

| # | Iteration-2 issue | Resolved? | How (checked) |
|---|-------------------|-----------|---------------|
| B1 | 04-11 T1 verify is red on a correct T1 | Yes | T1 `<files>` now includes household.spec.ts. Its action changes the two `option:checked` reads (measured at lines 940 and 950; `grep -c` prints 2, which matches `HEAD=2`) to `toHaveValue('Beach house')` and `toHaveValue('Coast house')`. A new GUARD MUTATION gate expects 0. The shared Combobox is React Aria's ComboBox "at every width" (Combobox.tsx:100-104), so its input value is the chosen label on both desktop and phone. The phone project only matches tests/phone/, so it never runs household.spec.ts. T3 no longer claims line 939. Every other T1-region step in the spec uses `fill` on labelled text fields (lines 35-36, 929-937 and 955-959), so it still passes after T1 alone. |
| W1 | 04-01 T2 re-asks an answered question | Partly | The action now says "Do not ask the owner". It checks the STATE.md record (measured: `grep -c` prints 1, line 77) and records `delete-in-g5` and `input` with the owner's words. But the task is still `type="checkpoint:decision" gate="blocking"` in an `autonomous: false` plan, and it has no `auto_select`. See Warning 1. |
| W2 | 04-14 importer check cannot fail | Yes | The check is now perl. Measured: it prints `42` as one line (a single xargs batch). The only ui-folder importer is client/src/components/ui/Input.test.ts, as the action says. The new gate has `HEAD=42 EXPECT==0` and a GUARD MUTATION. |
| I1 | 04-02 T2 `<files>` lacks currency.ts | Yes | It is now listed. |
| I2 | 04-15 T2 acceptance checks a T3 edit | Yes | T2's acceptance excludes HANDOVER.md. T3 repoints HANDOVER.md before the PR and has a new gate (`grep -c 'WAVES\.md' HANDOVER.md`, which prints 2 at HEAD and must print 0 on delete-in-g5). The new `':!docs/ui/FORM-CONTROLS-AUDIT.md'` exclusion hides nothing today: the only remaining hits are docs/ui/README.md:6 and HANDOVER-UI.md:172, and both are in T2's search list. |
| I3 | 04-04 T1 runs people.spec.ts it may not edit | Yes | people.spec.ts moved to T1 `<files>`, with the line-and-reason rule. It is gone from T2. It stays in files_modified. The spec is also in 04-10 (wave 2), so the overlap is ordered by wave. The other wave-3 plan, 04-16, shares no file with 04-04. |
| I4 | 04-14 lint cap has no route | Route added, but the baseline it rests on is wrong | See Blocker 1. |

### What passes (afresh, on the changed plans)

| Dimension | Result |
|-----------|--------|
| 1 Requirement coverage | WAVG-07 to WAVG-10 are unchanged from iteration 2, and each is still claimed with concrete tasks. |
| 2 Task completeness / 5 Scope | 41 tasks, at most 3 per plan. Every `auto` task has files, action, verify, fails_when, acceptance and done. No plan is over 10 files. |
| 3 Dependencies | Unchanged. No cycles, and every wave is max(dependency wave)+1. |
| 7 Context compliance | Both owner answers match STATE.md:77 word for word. D-09 is kept in 04-11. No deferred idea is planned. |
| 10 CLAUDE.md / owner constraints | 04-12 and 04-15 stop at an open PR. Money stays CurrencyInput or integer cents. Every changed selector carries a reason. No test is skipped, loosened or made to sleep. The lint cap is never raised. |
| Gate baselines (new) | option:checked 2, perl Select importers 42, STATE answer 1, HANDOVER WAVES.md 2. All match the notations. |

### Blockers: these properties must hold ("must fix" is the property, never the example)

**1. [verification_derivation / numeric_claim] Success criterion 4 (WAVG-10) is reachable on the tree G2 to G4 leave: the 04-14 lint step does not end in its halt route, and its stated baseline is measured**
- Plan: 04-14, Task 1 (with 04-11 Task 1 and the G4 plans that move label-wrapped controls)
- Evidence:
  - The new route says to list label-wrapped `<Select` sites with `perl … /<label\b(?:(?!<\/label>).)*?<Select\b/s` and states "(no file on 19 Nov 2026)". At HEAD that command matches 19 files (42 sites).
  - 24 of those sites are in G4 files: Household.tsx 10, EditEntry 2, BillAmount 1, HouseholdSharing 1, QuickExpense 1, PrioritiesSettings 3, Resilience 2, Review 1, Tax 1, tax/Assets 1, CarAndHome 1.
  - Nine more are in Phase 3 files whose plans (03-04, 03-10, 03-19) do not say the wrapper goes: MoneyMoves 2, PaydayPlan 5, TargetCard 1, AccountsPanel 1.
  - No G4 plan (04-04, 04-08, 04-09, 04-10, 04-11) says to remove a wrapping `<label>`. A search for "outer label|wrapping label|label wrapper" finds 0 in each. 04-11 Task 1 says "Keep every wrapper, label text and button", and its sites are literal `<label className={field}> Paid by <Select name="payerId"` wrappers (lines 343, 879, 900, 961, 977, 991 and 1277).
  - If those wrappers survive around the shared `Select`, removing 'Select' from `controlComponents` adds `label-has-associated-control` warnings. The route then halts 04-14 before the lint commit ("Lint cap: rise"). The native Select stays, success criterion 4 and WAVG-10 are not met, and 04-15 (which depends on 04-14) cannot open G5.
  - The seven Household.tsx wrappers that become the shared Combobox, which is not in `controlComponents`, would warn even earlier, in 04-12's lint run against the cap.
  - Phase 2's shipped screens show the opposite convention. Measured: only 1 label wraps a Combobox, DatePicker, Checkbox, RadioGroup or Textarea, and no file importing ui/Select has a label-wrapped `<Select`. The Phase 3 plans that do address wrappers say "remove any outer label element that wrapped the old control (a nested label breaks jsx-a11y and the strayLabels check)".
  - Not verified: the current warning count against the cap of 128, because lint/node_modules is not installed and I did not install it.
- Example fix (non-binding: any mechanism reaching the property counts): have each plan that moves a label-wrapped field state that the wrapper's text moves to the shared control's `label` prop (same text, same place, as the Phase 3 plans and 02-UI-SPEC's `Label elementType="span"` do). Then correct 04-14's baseline note to the measured 19 files, so the candidate list is expected to be empty only after G4.

### Warnings: these properties should hold

**1. [context_compliance / task_completeness] An already-answered owner question does not stop execution or reach the owner again**
- Plan: 04-01, Task 2
- Evidence:
  - Task 2 is still `<task type="checkpoint:decision" gate="blocking">`, with `<options>` and no `auto_select`, and 04-01 has `autonomous: false`.
  - gsd-executor.md:340 says that in standard mode, on any `checkpoint:*`, the executor must "STOP immediately", return the checkpoint and present the options.
  - gsd-executor.md:336 says that in auto mode (config.json `auto_advance: true`), a decision with no `auto_select` makes the executor "STOP like `blocking-human`".
  - So the protocol stops here and returns the two questions with options to the orchestrator, whatever the new `<resume-signal>` ("do not pause for or ask the owner again") says. The task text and its type contradict each other.
- Example fix (non-binding): make the recording an `auto` task (its action, verify and acceptance already fit one), or give the checkpoint an `auto_select` naming the recorded options.

### Advisories (info)

**1. [verification_derivation] A task's filtered spec run selects what its acceptance says it does**
- Plan: 04-11, Task 1
- Evidence:
  - Playwright matches `-g` against the project name, the file name and the title. Every test in `household.spec.ts` therefore matches `-g "household|person|people"`, so Task 1 runs the whole file in desktop, not only "the household setup, edit and people tests". It still passes: I found no other test driving a control Task 1 changes. This is stricter than stated, not a failure.
  - The analogy "as data.spec.ts does for its comboboxes" reads native-select option values (`toHaveValue('date')`), not a shared Combobox's label. The values the plan gives ('Beach house', 'Coast house') are right for the shared Combobox.
- Example fix (non-binding): describe the run as the whole file, and drop the data.spec.ts comparison.

### Structured Issues

```yaml
issues:
  - plan: "04-14"
    dimension: verification_derivation
    severity: blocker
    required_property: "Success criterion 4 (WAVG-10) is reachable on the tree G2 to G4 leave: the 04-14 lint step does not end in its halt route, and its stated baseline is measured"
    description: "04-14 T1's candidate check perl '<label\\b(?:(?!<\\/label>).)*?<Select\\b' is annotated 'no file on 19 Nov 2026' but matches 19 files / 42 sites at HEAD. 24 are in G4 files (Household.tsx 10; EditEntry 2, BillAmount, HouseholdSharing, QuickExpense; PrioritiesSettings 3; Resilience 2, Review, Tax, tax/Assets, CarAndHome) and 9 in Phase 3 files whose plans (03-04, 03-10, 03-19) do not remove wrappers. No G4 plan says the wrapping label goes; 04-11 T1 says 'Keep every wrapper, label text and button' over literal '<label className={field}> Paid by <Select name=\"payerId\"' wrappers. Surviving wrappers around the shared Select make W1 > W0 when 'Select' leaves controlComponents, so 04-14 halts, the native Select stays and 04-15 cannot open G5; wrappers around the shared Combobox (not in controlComponents) warn already in 04-12's lint. Current warning headroom against the cap of 128 was not measured (lint deps not installed)."
    task: 1
    fix_hint: "Have the plans that move label-wrapped fields move the wrapper's text into the shared control's label prop (same text and place, as Phase 3 plans do), and correct 04-14's baseline note to the measured count"
  - plan: "04-01"
    dimension: context_compliance
    severity: warning
    required_property: "An already-answered owner question does not stop execution or reach the owner again"
    description: "Task 2 is still type=\"checkpoint:decision\" gate=\"blocking\" with options and no auto_select in an autonomous:false plan. gsd-executor.md:340 (standard mode: STOP immediately on any checkpoint:*) and :336 (auto mode, auto_advance true: no auto_select means STOP like blocking-human) both stop and return the two questions with options, whatever the resume-signal 'do not pause for or ask the owner again' says."
    task: 2
    fix_hint: "Make the recording an auto task, or give the checkpoint an auto_select naming delete-in-g5 and wfh-input"
  - plan: "04-11"
    dimension: verification_derivation
    severity: info
    required_property: "A task's filtered spec run selects what its acceptance says it does"
    description: "Playwright -g matches the project name, the file name and the title, so -g \"household|person|people\" selects every test in household.spec.ts (a stricter run that still passes after T1). The 'as data.spec.ts does' analogy reads native-select values, not a shared Combobox label."
    task: 1
    fix_hint: "Describe the run as the whole file, and drop the data.spec.ts comparison"
```

### Unverified

- The lint warning count and its headroom against `--max-warnings=128`: lint/node_modules/.bin/eslint does not exist, and I did not install anything. Blocker 1 is stated without that figure.
- I did not run `gsd_run query verify.plan-structure`, `plan.task-structure` or `estimate-check` (iteration safety note). Structure was checked by reading the plans and by counting `<task `, `<automated>` and `<fails_when>`.
- I did not re-measure the gate baselines of plans unchanged since iteration 2 (04-03, 04-05 to 04-10, 04-12, 04-13 and 04-16 to 04-18).
- I did not run Playwright. The `-g` scope comes from Playwright's documented grep target, not from a run.
- Commands run: read-only `cat`, `sed`, `grep` (which is ugrep on this machine), `git show/log/status/grep/ls-files`, perl counts with no plan text executed (the 04-14 importer gate typed directly, the label-wrapper counts and listings), `wc` and `ls`. Against the safety note, some calls were small read-only loops or pipelines: a per-file owner and label-mention mapping, the perl listing over `git ls-files`, and a two-plan files_modified listing. None ran plan text through `bash -c`, and none wrote a tracked file. The only files written are this report and the dispatcher result JSON.

### Recommendation

1 blocker and 1 warning remain after the final iteration, so this goes to the owner instead of another revision. Revision 2 resolves 6 of the 7 iteration-2 issues and partly resolves W1.

- **Blocker 1 is new.** It comes from revision 2's lint route, whose "no file" baseline is false: 19 files and 42 sites at HEAD. As planned, the likely outcome is that 04-14 halts and WAVG-10 / success criterion 4 is not delivered.
- **Warning 1** is the iteration-2 W1 property: the task text no longer asks, but the task type still stops execution.

ISSUES FOUND
