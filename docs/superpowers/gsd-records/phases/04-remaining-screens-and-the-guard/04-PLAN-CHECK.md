# Phase 4 plan check — iteration 1 (plans commit 9b74aed7)

## ISSUES FOUND

**Phase:** 04-remaining-screens-and-the-guard
**Plans checked:** 15 (04-01 to 04-15)
**Issues:** 5 blocker(s), 8 warning(s), 3 info

Inputs read: all 15 PLAN.md files, ROADMAP.md §Phase 4, REQUIREMENTS.md (WAVG-07 to WAVG-10 and
"Done means, for every wave PR"), 04-CONTEXT.md and 04-RESEARCH.md (paths corrected by the
orchestrator from 03-* to 04-*), 04-UI-SPEC.md (sections the plans cite), 04-PATTERNS.md,
04-VALIDATION.md, CLAUDE.md, and the Phase 3 plans for every artifact Phase 4 consumes.

Probes: the verify-command path probe and the failing-direction probe each list 95 commands, all
`severity: none`, `readError: null`. No finding comes from them.

### What passes

| Dimension | Result |
|-----------|--------|
| 1 Requirement coverage | WAVG-07 (04-01..04-12), WAVG-08 (04-01, 04-07, 04-12), WAVG-09 (04-13, 04-15), WAVG-10 (04-14, 04-15): all claimed, each with concrete tasks. Success criteria 1-5 each map to tasks. |
| 2 Task completeness | Every `auto` task has files, action, verify (with `fails_when`), acceptance and done; 04-01 Task 2 is a well-formed `checkpoint:decision`. Checked by reading; `verify.plan-structure` not run (see Unverified). |
| 3 Dependencies | Acyclic; waves 1→7 consistent with `depends_on` (max(dep)+1). G4 gates on #273 (now MERGED), the G2 and G3 PRs and `ui/NumberField.tsx` on origin/redesign; G5 gates on the merged G4 PR. |
| Phase 3 reliance (orchestrator note) | Every Phase 3 artifact Phase 4 uses is promised by a Phase 3 plan: NumberField and `wholeNumberRangeMessage(1, 60)` = "Enter a whole number from 1 to 60." (03-02), CurrencyInput `fieldSize`/`expression`/`onTextChange`/`commitOnBlur` (03-02), CategorySelectButton `label` and none item (03-04), e2e `chooseOption`/`categoryOption`/`fillDate`/`fillMonth`/`typeAmount` (03-01, 03-09, 03-10), branches `feat/wave-g2-screens` (03-15) and `feat/wave-g3-screens` (03-23), record lines in 03-01-SUMMARY.md. `movedSections.test.ts` and `FORM-CONTROLS-AUDIT.md` already exist on redesign. |
| Raw-field coverage | Measured at HEAD: 319 hits across the whole-G4 gate. Every file with a hit is in some Phase 3 or Phase 4 plan's `files_modified` (no orphan). See B1 for the one file left to G5. |
| Gate baselines | Measured (read-only perl/grep): all 19 leftover gates, the D-20 attribute gates, the Plaid, datalist, parseFloat, `no-restricted-syntax`, `'Select'`, type=number (10), file-input (10), 04-13 (214), 04-14 (17, 19) and 04-15 (5, 5) gates print their `HEAD=` value. The one mismatch is B2. |
| 7 Context compliance | D-01..D-22 each traced to a task (D-10, D-12 informational). No deferred idea is planned. D-09 like-for-like is enforced with heading/layout diff checks; D-20 attributes are preserved verbatim with count gates; D-21 rule is an error. |
| 7b Scope reduction | None found. |
| 7c Tier compliance | Client and `lint/` only; `server/src/routes/paymentPlans.ts` is read-only (04-07 prohibition). Matches the Responsibility Map. |
| 8 Nyquist 8a/8c/8d/8f | Every task has an automated verify; Wave 0 items (D-16 reconcile, the type=number scan, the rule tests) are planned in 04-01/04-13, 04-07, 04-13. |
| 10 CLAUDE.md | Feature branches and PRs with `--repo tvrooi/Allotment`, conventional commits, release:prepare + CHANGELOG per app PR, Prettier, lint cap never raised, Node 24, no `E2E_SKIP_BUILD`, AGENTS.md/CLAUDE.md kept identical (`cmp` gate), no secret in tests. Owner constraints hold: 04-12 and 04-15 stop at an open PR; no merge, tag, release or live change. |
| Technical premise | `react-aria-components` 1.22.1 (installed) has ComboBox `formValue?: 'text' \| 'key'`, which 04-02 Task 2 relies on. |

### Blockers — these properties must hold ("must fix" is the property, never the example)

**1. [dependency_correctness] Every gate that expects zero raw fields outside `components/ui/` can reach zero on the tree it runs against**
- Plans: 04-12 (Task 1 gate and truth 1), 04-13 (Task 1 gate, Task 2 `npm --prefix lint run lint`), 04-14
- Evidence: `client/src/components/transactions/CategorySelect.tsx:32` is a raw `<select>`. It is the only raw-field file whose only editor is a G5 plan: 03-12 forbids deleting it ("Payment plans still use it until Phase 4"), no G4 plan lists it, and 04-14 (wave 6) deletes it. So after G4 the 04-12 whole-G4 gate (`# [HEAD=319 EXPECT==0]`) prints at least 1 and Task 1 tells the executor to "fix it here" in a file outside its `files_modified`. 04-13 Task 1's gate (`# [HEAD=214 EXPECT==0]`) prints at least 1, so it writes `G5 reconcile: revise` and halts G5. If it went on, 04-13 Task 2 registers `allotment/no-raw-form-control` as an error over `client/src/**/*.tsx` before 04-14 deletes the file, so `npm --prefix lint run lint` fails. Measured: the only file in `comm -23 rawfiles g4-files` is CategorySelect.tsx.
- Example fix (non-binding: any mechanism reaching the property counts): delete CategorySelect.tsx in G4 once 04-07 removes its last caller, or order the deletion before the rule is registered and exclude the file from the G4 gate with a recorded reason.

**2. [verify_command_format] Each count gate's `HEAD=` notation equals what the command prints at HEAD**
- Plan: 04-11, Tasks 1, 2 and 3 (`grep -c "f.get(" client/src/pages/Household.tsx # [HEAD=31 EXPECT==31 …]`), plus Task 1's action ("30 and 31")
- Evidence: measured 30 at HEAD, at 3a80af52 and on origin/redesign, both by line (`grep -c`) and by occurrence (`grep -o … | wc -l`). No Phase 3 plan edits Household.tsx, so the page still has 30 at G4. All three gates fail on an untouched file, and Task 1 records the wrong baseline. The `name=` count (30) is correct.
- Example fix (non-binding): use the measured 30 in the notation, the expectation and the action text.

**3. [verify_command_format] A gate that already passes at HEAD carries a `GUARD MUTATION:` naming the edit it catches (#4927 B1)**
- Plans: 04-04 Task 1 (`… # [HEAD=3 5 2 1 1 EXPECT==3 5 2 1 1]`), 04-05 Task 1 (`… # [HEAD=1 1 1 1 EXPECT==1 1 1 1]`), 04-05 Task 3 (`… # [HEAD=2 2 1 4 EXPECT==2 2 1 4]`), 04-06 Task 1 (`… # [HEAD=2 5 2 1 1 EXPECT==2 5 2 1 1]`)
- Evidence: all four D-20 attribute gates print their expected value at HEAD (measured) and have no `GUARD MUTATION:`. The sibling preservation gates in the same plans (Plaid `type="password"`, `asset-lives`, `parseFloat`, `f.get`, `no-restricted-syntax`) do carry one.
- Example fix (non-binding): add a `@3a80af52 GUARD MUTATION:` naming the dropped attribute each gate catches.

**4. [research_resolution] 04-RESEARCH.md has no unresolved open question**
- File: 04-RESEARCH.md line 537, `## Open Questions` (no `(RESOLVED)` suffix)
- Evidence: three questions, none marked RESOLVED: (1) CurrencySelect and Enable Banking Country as Select or Combobox; (2) Housekeeping and CurrencyDifference category as CategoryPicker or Select; (3) WAVES.md at G5 close. The plans settle them (04-01 Task 1 makes the audit binding; 04-01 Task 2 asks the owner Q3), but RESEARCH.md does not say so. Q3's recommendation ("Update WAVES.md … ask at G5 PR merge") also differs from the plan's recommended `delete-in-g5` asked in 04-01.
- Example fix (non-binding): mark each question RESOLVED with the plan step that settles it.

**5. [scope_sanity] Each plan stays within the per-plan file budget (blocker at 15+ files)**
- Plan: 04-10 (3 tasks, 15 `files_modified`: 12 household components and 3 specs; estimate 90,000 tokens, confidence low)
- Evidence: frontmatter count is 15, which is the blocker threshold. Three tasks edit 5 files each, and the plan includes two cross-surface specs (`transactions.spec.ts` for ShareWithHousehold in the detail panel, and the multi-user project).
- Example fix (non-binding): move Task 3 (ShareWithHousehold, bills toggles, reconcile date, household.spec.ts lines) into its own wave-2 plan that 04-11 depends on.

### Warnings — these properties should hold

**1. [scope_sanity] Plans stay at or under 10 files**
- Plans: 04-02 (14), 04-05 (13), 04-15 (11)
- Evidence: frontmatter counts. 04-02 and 04-05 are also the two largest estimates in wave 2 (85,000 and 90,000 tokens).
- Example fix (non-binding): split 04-05 by bank (Up and Plaid / SimpleFIN and Enable Banking).

**2. [task_completeness] A removal gate only depends on files its own plan may edit**
- Plan: 04-14, Task 1 gate (`git grep -qwE 'compactSelectClass|CategorySelect' -- client/src e2e`) and Task 2 gate (same plus active docs)
- Evidence: at HEAD two hits fall outside 04-14's `files_modified`: `client/src/components/transactions/PayeeCombobox.tsx:43` (comment "as CategorySelect's bare button does"; PayeeCombobox is edited by 03-04 and 03-13, which do not promise to drop it), and `docs/ui/HANDOVER-UI.md:191` ("a bare CategorySelect"; edited only by 04-12 and the later 04-15). If they survive, the gate fails or the executor edits unlisted files.
- Example fix (non-binding): list both files in 04-14 and name the two lines in its action.

**3. [task_completeness] Every task that edits a spec runs it, and no spec is allowed to be red between plans**
- Plan: 04-10, Task 3 (and Task 2)
- Evidence: Task 3 edits `e2e/tests/household.spec.ts` but its verify runs only `transactions.spec.ts` and `household-categories.spec.ts`. Its acceptance accepts that some household.spec.ts tests "go green in 04-11", which tolerates a failing spec mid-phase. pages/Household.tsx is unchanged in 04-10, so the whole spec should pass. Task 2 puts its failing-first case "in household.spec.ts or a unit test", but household.spec.ts is not in Task 2's files or verify.
- Example fix (non-binding): run household.spec.ts in Task 3's verify and require it green.

**4. [cross_plan_data_contracts] Household's submitted amount text is what `cents()` parses for every currency the page can hold**
- Plans: 04-02 Task 3 and 04-11 Tasks 2-3
- Evidence: 04-02's hidden input holds "the amount as a plain decimal in the currency's minor digits … a zero-decimal currency gives whole units". `cents()` at `client/src/pages/Household.tsx:148` accepts only `^\d+(\.\d{1,2})?$` and always multiplies by 100, and the page passes `state.group.currency` to its money components (for example lines 516, 527). 04-11 does not say which currency the new CurrencyInputs get, and 04-02's round-trip test covers only positive two-decimal values. For a household whose currency does not have two minor digits, an edit form's default would round-trip to a different stored integer.
- Example fix (non-binding): pin the round-trip contract to the page's fixed two-decimal storage (or test every allowed group currency) and state the currency prop in 04-11.

**5. [claude_md_compliance] New behaviour has a test that fails first (CLAUDE.md §Tests)**
- Plans: 04-04 Task 2, 04-08 Task 2, 04-10 Task 2
- Evidence: each moves an owner-row money field to CurrencyInput and asserts a new observable ("its formatted display when not focused"), yet each offers "or record that no observable change exists" / "or record none". The plans themselves name an observable change, so the escape lets the failing-first test be skipped. 04-07, 04-09 (currency branch) and 04-11 have no such escape.
- Example fix (non-binding): drop the escape clause in all three tasks.

**6. [verification_derivation] Every must_haves truth has a task and a test**
- Plan: 04-02
- Evidence: truth 3 says the native branches of Select, DatePicker and MonthPicker submit the same `name` and value on phones. Task 1 adds MonthPicker's props only "if it shares NativePicker's prop type", and no behaviour or test covers MonthPicker's native branch.
- Example fix (non-binding): either test MonthPicker's phone branch or drop MonthPicker from the truth.

**7. [nyquist_compliance] VALIDATION.md's per-task map names the real tasks**
- File: 04-VALIDATION.md
- Evidence: all five rows are still `4-TBD | TBD | TBD`, the sign-off boxes are unchecked and `nyquist_compliant: false`, although 15 plans now exist. The file says "The planner replaces the `4-TBD` rows with real task ids."
- Example fix (non-binding): fill the map from the plans' verify commands.

**8. [requirement_coverage] Each wave PR meets REQUIREMENTS.md "Done means, for every wave PR"**
- Plan: 04-15
- Evidence: the list requires screenshots under `.ui-evidence/<date>-<wave>/` for every wave PR. 04-12 Task 2 makes them for G4. 04-15 neither makes them nor records why G5 (removals and lint) needs none.
- Example fix (non-binding): record the waiver with its reason in the G5 PR body, or take the evidence.

### Advisories (info)

**1. [dependency_correctness] Ordering between same-wave plans is declared, not implied**
- Plans: 04-02 with 04-03, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10 (all wave 2, no `depends_on` between them)
- Evidence: 04-02 changes the prop types of DatePicker, Checkbox, Select, Combobox and CurrencyInput, which the others consume and type-check against in the same wave. All wave-2 and wave-3 browser runs share the fixed e2e ports 3171-3180. The plans state this in prose, but 04-02 (gallery project) does not, and no plan declares `coupling_justified`.
- Example fix (non-binding): declare `coupling_justified`, or move 04-02 to its own earlier wave.

**2. [context_compliance] Copied record lines state their value mapping**
- Plan: 04-01, Task 1 (5)
- Evidence: 03-01 records `Welcome switch rows: accept|restore-in-phase-4` and `Export dialogs: phase-4|move-in-g3`. 04-01 says to "copy" them as `Welcome rows: accept|restore` and `DataExport: phase-4|moved-in-g3` without giving the mapping. A verbatim copy fails the gate (safe, but stops the phase).
- Example fix (non-binding): state `restore-in-phase-4 → restore` and `move-in-g3 → moved-in-g3`.

**3. [nyquist_compliance] Per-task feedback latency (8b)**
- Plans: 04-06 Task 2 and 04-11 Task 3 (full phone project), 04-12 Task 1 and 04-15 Task 2 (every browser project)
- Evidence: these are full e2e projects inside task verifies. REQUIREMENTS.md "Done means" requires the full suites for every wave PR, so this is noted, not a defect. No reducing route is offered because it would conflict with that requirement.

### Structured Issues

```yaml
issues:
  - plan: "04-12"
    dimension: dependency_correctness
    severity: blocker
    required_property: "Every gate that expects zero raw fields outside components/ui/ can reach zero on the tree it runs against"
    description: "client/src/components/transactions/CategorySelect.tsx:32 is a raw <select>; 03-12 keeps it into Phase 4 and only 04-14 (wave 6) deletes it. The 04-12 whole-G4 gate [HEAD=319 EXPECT==0], the 04-13 Task 1 gate [HEAD=214 EXPECT==0] (G5 reconcile: revise, halt) and 04-13 Task 2's lint run with the new error rule all count it before it is gone. It is the only raw-field file edited by no G4 plan."
    plans: ["04-12", "04-13", "04-14"]
    fix_hint: "Delete CategorySelect.tsx in G4 after 04-07 removes its last caller, or order its deletion before the rule is registered and exclude it from the G4 gate with a reason"
  - plan: "04-11"
    dimension: verify_command_format
    severity: blocker
    required_property: "Each count gate's HEAD= notation equals what the command prints at HEAD"
    description: "grep -c \"f.get(\" client/src/pages/Household.tsx is annotated HEAD=31 EXPECT==31 in Tasks 1, 2 and 3, and Task 1's action records '30 and 31'; measured 30 (lines and occurrences) at HEAD, 3a80af52 and origin/redesign, and no Phase 3 plan edits the file"
    task: "1, 2, 3"
    fix_hint: "Use the measured 30 in the notation, the expectation and the action text"
  - plan: "04-04, 04-05, 04-06"
    dimension: verify_command_format
    severity: blocker
    required_property: "A gate that already passes at HEAD carries a GUARD MUTATION naming the edit it catches"
    description: "D-20 attribute gates 04-04 T1 '3 5 2 1 1', 04-05 T1 '1 1 1 1', 04-05 T3 '2 2 1 4' and 04-06 T1 '2 5 2 1 1' print their expected value at HEAD (measured) with no GUARD MUTATION; sibling preservation gates in the same plans carry one"
    fix_hint: "Add '@3a80af52 GUARD MUTATION: drop <attribute> from <field>' to each"
  - plan: null
    dimension: research_resolution
    severity: blocker
    required_property: "RESEARCH.md carries no unresolved open question"
    description: "04-RESEARCH.md:537 '## Open Questions' lacks (RESOLVED) and its three questions (CurrencySelect/Country Select vs Combobox; Housekeeping/CurrencyDifference picker; WAVES.md at G5 close) carry no RESOLVED marker; Q3's recommendation also differs from 04-01's recommended delete-in-g5"
    file: "04-RESEARCH.md"
    fix_hint: "Mark each RESOLVED with the plan step that settles it (04-01 Task 1 audit binding; 04-01 Task 2 owner answer)"
  - plan: "04-10"
    dimension: scope_sanity
    severity: blocker
    required_property: "Each plan stays within the per-plan file budget (blocker at 15+ files)"
    description: "04-10 lists 15 files_modified (12 household components and 3 specs) over 3 tasks with a 90,000-token low-confidence estimate"
    metrics: { tasks: 3, files: 15 }
    fix_hint: "Move Task 3 into its own wave-2 plan that 04-11 depends on"
  - plan: "04-02, 04-05, 04-15"
    dimension: scope_sanity
    severity: warning
    required_property: "Plans stay at or under 10 files"
    description: "files_modified counts: 04-02 = 14, 04-05 = 13, 04-15 = 11"
    fix_hint: "Split 04-05 by bank"
  - plan: "04-14"
    dimension: task_completeness
    severity: warning
    required_property: "A removal gate only depends on files its own plan may edit"
    description: "At HEAD the word-bounded CategorySelect search hits PayeeCombobox.tsx:43 (a comment; the file is edited only by 03-04 and 03-13) and docs/ui/HANDOVER-UI.md:191 (edited only by 04-12 and the later 04-15); neither is in 04-14's files_modified, so the Task 1 and Task 2 gates fail or force unlisted edits"
    task: "1, 2"
    fix_hint: "List both files in 04-14 and name the lines in its action"
  - plan: "04-10"
    dimension: task_completeness
    severity: warning
    required_property: "Every task that edits a spec runs it, and no spec is allowed to be red between plans"
    description: "Task 3 edits household.spec.ts but its verify does not run it, and its acceptance tolerates household tests going green only in 04-11; Task 2 puts its failing-first case in household.spec.ts, which is outside its files and verify"
    task: "2, 3"
    fix_hint: "Run household.spec.ts in Task 3's verify and require it green"
  - plan: "04-02, 04-11"
    dimension: cross_plan_data_contracts
    severity: warning
    required_property: "Household's submitted amount text is what cents() parses for every currency the page can hold"
    description: "04-02's hidden value uses the currency's minor digits (whole units for zero-decimal); Household.tsx:148 cents() accepts only ^\\d+(\\.\\d{1,2})?$ and multiplies by 100, the page passes state.group.currency to money components, 04-11 does not fix the CurrencyInputs' currency, and the round-trip test covers only positive two-decimal values"
    fix_hint: "Pin the round trip to the page's fixed two-decimal storage, or test every allowed group currency, and state the currency prop in 04-11"
  - plan: "04-04, 04-08, 04-10"
    dimension: claude_md_compliance
    severity: warning
    required_property: "New behaviour has a test that fails first"
    description: "04-04 T2, 04-08 T2 and 04-10 T2 move money fields to CurrencyInput and name an observable change (formatted display when not focused) but allow 'or record that no observable change exists'"
    claude_md_rule: "New behaviour and every bug fix come with a test that fails without the change."
    fix_hint: "Remove the escape clause"
  - plan: "04-02"
    dimension: verification_derivation
    severity: warning
    required_property: "Every must_haves truth has a task and a test"
    description: "Truth 3 includes MonthPicker's native branch submitting name and value; Task 1 adds MonthPicker props only conditionally and no behaviour case covers it"
    task: 1
    fix_hint: "Test MonthPicker's phone branch or drop it from the truth"
  - plan: null
    dimension: nyquist_compliance
    severity: warning
    required_property: "VALIDATION.md's per-task map names the real tasks"
    description: "04-VALIDATION.md rows are still '4-TBD | TBD | TBD', sign-off unchecked, nyquist_compliant false"
    file: "04-VALIDATION.md"
    fix_hint: "Fill the map from the plans' verify commands"
  - plan: "04-15"
    dimension: requirement_coverage
    severity: warning
    required_property: "Each wave PR meets REQUIREMENTS.md 'Done means, for every wave PR'"
    description: "Done means requires .ui-evidence/<date>-<wave>/ screenshots for every wave PR; 04-12 makes them for G4, 04-15 neither makes them for G5 nor records why none are needed"
    fix_hint: "Record the waiver with its reason in the G5 PR body"
  - plan: "04-02"
    dimension: dependency_correctness
    severity: info
    required_property: "Ordering between same-wave plans is declared, not implied"
    description: "04-02 changes DatePicker, Checkbox, Select, Combobox and CurrencyInput prop types consumed in the same wave by 04-03, 04-05..04-10 with no depends_on; all browser runs share fixed ports 3171-3180, stated in prose except in 04-02; no coupling_justified"
    plans: ["04-02", "04-03", "04-05", "04-06", "04-07", "04-08", "04-09", "04-10"]
    fix_hint: "Declare coupling_justified or move 04-02 to an earlier wave"
  - plan: "04-01"
    dimension: context_compliance
    severity: info
    required_property: "Copied record lines state their value mapping"
    description: "03-01 records 'restore-in-phase-4' and 'move-in-g3'; 04-01 copies them as 'restore' and 'moved-in-g3' without stating the mapping (the gate catches a verbatim copy)"
    task: 1
    fix_hint: "State the two mappings in the action"
  - plan: "04-06, 04-11, 04-12, 04-15"
    dimension: nyquist_compliance
    severity: info
    required_property: "Per-task feedback latency stays low (8b)"
    description: "Full e2e projects run inside task verifies; REQUIREMENTS.md Done means requires the full suites per wave PR, so no reducing route is offered"
```

### Unverified

- `gsd_run query verify.plan-structure`, `plan.task-structure` and `estimate-check --calibrated` were
  not run. The iteration's safety note limits commands to plain read-only counts. Task structure was
  checked by reading each plan. The smart-zone estimates (55,000 to 90,000 tokens per plan, all
  `confidence: low`) were not checked against the budget.
- The Phase 3 SUMMARY files 04-01 reads (03-01, 03-15, 03-23) do not exist yet, because Phase 3 has
  not executed. Their record-line vocabulary was taken from the 03-01 plan.
- Commands run: read-only `git ls-files`, `git grep`, `git show`, `git ls-tree`, `grep`, `perl`,
  `sed`, `awk`, `comm`, `wc`, `cmp`, plus `gh pr view 273 --json state` (read-only) and
  `git fetch -q origin`. The fetch updated remote-tracking refs only; no tracked file changed.
  No plan text was executed. Scratch files went to the session scratchpad.

### Recommendation

5 blocker(s), 8 warning(s) require revision. Returning to planner with feedback. B1 (CategorySelect
outlives the G4 gate and the G5 rule) and B2 (the wrong f.get baseline) would each stop execution
on a correct tree. B3 to B5 are notation, research-record and scope fixes.

ISSUES FOUND
