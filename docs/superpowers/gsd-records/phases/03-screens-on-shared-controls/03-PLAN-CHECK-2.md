## ISSUES FOUND

**Phase:** 03-screens-on-shared-controls
**Plans checked:** 25 (03-01 to 03-25), checker iteration 2 against commit 245d04d4
**Issues:** 1 blocker(s), 2 warning(s), 2 info

Method: ran `verify.plan-structure` on all 25 plans; each exits 0 and is valid, with 2 or 3 tasks
and files, action, verify and done on every task. 03-02 has one tool warning (R6, bare `git diff`).
It is a false positive: the only `git diff` in it, at line 189, pins `<sha>^..<sha>`. I rebuilt the
depends_on graph. It has no cycle and no missing or forward reference, and every wave equals
max(dependency waves) + 1:

- 03-13 and 03-24 are wave 5 (both depend on 03-12, wave 4);
- 03-15 is wave 6 and now depends on 03-24;
- 03-25 is wave 9 (depends on 03-22, wave 8, and shares data.spec.ts with it);
- 03-23 is wave 10 and depends on 03-25.

No two same-wave plans share a file in files_modified. Both deterministic probes (path, 137 commands;
failing direction) report 0 blockers and 0 warnings.

Gate baselines: the orchestrator declined my first attempt, a batch `bash -c` over plan text. I then
printed the 37 `[HEAD=…]` gate commands, and every one is a plain grep, perl or `git ls-files` count.
I re-ran them one at a time as commands I typed, not by evaluating plan text. The two whole-PR gates
(03-15, 03-23) had already run earlier from extracted plan text, before the decline. All 37 print
their notation's HEAD value:

- 03-15 whole-G2 gate: 135. 03-23 whole-G3 gate: 67.
- Per-plan perl gates: 03-04 1 and 2, 03-05 7 and 2, 03-06 8 and 3, 03-07 19, 03-08 13, 03-09 13,
  03-10 11, 03-11 10, 03-12 15, 03-13 12, 03-14 6, 03-17 15, 03-18 7, 03-19 18, 03-20 5, 03-21 6,
  03-22 10, 03-24 13, 03-25 16.
- grep gates: 03-01 UAT pending 4; Q2 summary absent; the 03-07 and 03-08 name gates 0, 0 and 0;
  the type="number", setTheme, pickerGroupClass, MONTH_NAMES and spinbutton gates as noted.

Nothing was left unverified. estimate-check (--calibrated, budget 100000, confidence low) puts every
plan under budget: maximum ratio 0.95 (03-10, 03-12, 03-19), and the split plans at 03-13 0.70,
03-22 0.70, 03-24 0.45 and 03-25 0.50.

Owner constraints hold in all 25 plans:

- 03-15 and 03-23 stop at an open PR ("do not merge, tag, publish, or close #267");
- the only `git tag` use is `git tag -l` in the version check;
- 03-16 Task 1 still halts unless the G2 PR is merged and NumberField.tsx is on origin/redesign;
- no plan touches the server, a live budget or the HA app;
- no plan adds `type="number"` (gates drive it to 0 in RuleEditorModal, CashRunway and EventEditor;
  NumberField is absent at HEAD and gated to 0);
- no plan skips, retries, loosens or sleeps a test;
- money stays in CurrencyInput.

### Previous issues (iteration 1): how each is resolved

| # | Issue | Status | How verified |
|---|-------|--------|--------------|
| B1 | 03-15 whole-G2 gate ignored exclude pathspecs | **Resolved** | Lists now filtered with `grep -vE` after `git ls-files`. The gate prints 135 = `[HEAD=135]`. Per-file breakdown: all 42 counted files are in files_modified of 03-02 to 03-14 or 03-24, and none is a G3 or Phase 4 file. The G3 gate (03-23) prints 67, and all 24 counted files belong to 03-17 to 03-22 or 03-25. |
| B2 | RESEARCH Open Questions unresolved | **Resolved** | `## Open Questions (RESOLVED)`, each question with a RESOLVED line naming its plan. Q1 is honestly labelled a planner position and routed to the owner as 03-01 Q3. |
| W1 | UI-SPEC unnamed controls not named | **Resolved** | 03-07 names Direction, Match value, Notes text, Split percentage and Split notes; 03-08 names Upcoming length, Custom length number and Custom length unit. Each has source and spec name gates, all printing 0 at HEAD = notation, and hidden labels without a wrapping label element (strayLabels). |
| W2 | WAVG-06 "export dialogs" re-scoped without record | **Resolved** | 03-01 Q3 asks the owner, with no silent default. 03-16 writes the `WAVG-06 export:` line, or halts G3 on `move-in-g3` or a missing answer, and has a grep gate. 03-23 quotes it as a Scope line in the PR body. |
| W3 | Context budget | **Resolved for tokens; file counts unchanged** | 03-13 and 03-22 were split (03-24, 03-25), and all ratios are now ≤ 0.95. 03-03 and 03-12 still list 12 files and 03-09, 03-17, 03-19 and 03-20 list 10 (Info 2). |
| W4 | Task-level whole-project e2e runs; VALIDATION map | **Partly resolved** | Only 03-15 and 03-23 run whole projects (intended). The per-task map has 58 rows, matching the 58 tasks. But the frontmatter flag was not set (Warning 2). |
| I1 | Fixed e2e ports, same-wave coupling | **Resolved (declared)** | Every same-wave pair that runs Playwright declares the other in coupling_justified (waves 2, 3, 5 and 8; 03-02 runs no browser test). Applied exemption noted as Info 1. |
| I2 | files_modified gaps (03-05, 03-04) | **Resolved** | 03-05 lists e2e/tests/financial-integrity.spec.ts in frontmatter and Task 2. 03-04 writes only recurring.spec.ts and currencies.spec.ts, and routes other specs' lines to "For 03-07" or "For 03-12". |
| I3 | Owner answers not carried | **Resolved** | 03-01 Task 2 updates 02-UAT tests 3 and 4 (gate `[HEAD=4 EXPECT==2]`) and adds the Phase 4 STATE todo on restore-in-phase-4 (gate). It forbids closing UAT 1 and 2, and 03-15 and 03-23 list them under "Findings for the owner". |

### Blockers — these properties must hold ("must fix" is the property, never the example)

**1. [dependency_correctness / cross-plan contract] Every e2e spec that exercises a moved control is in the moving plan's files and verify, so the plan fails when it breaks one**
- Plan: 03-25 (introduced by the 03-22 split); also 03-22
- Task: 03-25 Tasks 1 and 2
- Evidence: 03-25 moves YnabImportModal.tsx and ImportCategories.tsx. Its only spec, in both
  files_modified and both verifies, is `e2e/tests/data.spec.ts`. But
  `grep -cE "Category for|Date format|Name for|ynab|YNAB" e2e/tests/data.spec.ts` prints 0:
  data.spec.ts exercises neither component. The selectors for both live in
  `e2e/tests/switchers.spec.ts`:
  - lines 50-55: the ImportCategories mapping (`aria-label={\`Category for ${label}\`}`,
    ImportCategories.tsx:144), as `getByRole('combobox', { name: 'Category for Food & Dining: Groceries' })`
    with `.toHaveValue(groceryId)` and `'Category for Bills: Landlord Fees'` with `.toHaveValue('__new')`;
  - line 142: the YNAB `getByRole('combobox', { name: 'Date format' })).toHaveValue('dmy')`
    (YnabImportModal.tsx:321);
  - line 143: `'Name for Everyday'` (YnabImportModal.tsx:412);
  - line 145: `'Category for Transport: Fuel'` toHaveValue.

  03-25's own truth makes the mapping target a CategorySelectButton and Date format a shared Select.
  Both are buttons, so every `toHaveValue` above fails. 03-25 neither lists nor runs switchers.spec.ts,
  so its verifies pass while the spec breaks. The first gate to see it is 03-23 Task 1's whole
  desktop run (wave 10), whose files are lint/package.json only.

  03-22 now carries the opposite error. It still lists switchers.spec.ts and its read_first points
  at "switchers.spec.ts near 46-57 and 142-145", but lines 50-57 and 142-145 belong to components
  03-22 is prohibited from editing ("MUST NOT edit YnabImportModal.tsx or ImportCategories.tsx").
  Only line 46 (`'Column Category'`) is ImportModal's.

  03-25's acceptance criteria ("data.spec.ts finds 'Date format' and 'Amount format' by role and
  name"; "data.spec.ts passes, including a mapping to a new category") also assume coverage that
  data.spec.ts does not have. The phase goal ("nothing they do changes") and ROADMAP success
  criterion 4 (every suite green, every changed selector with its reason) are then met only by
  unplanned repair in 03-23.
- Example fix (non-binding — any mechanism reaching the property counts): give 03-25 the
  switchers.spec.ts lines for the YNAB and mapping controls (files_modified, task files, verify).
  This is safe because 03-25 runs after 03-22. Narrow 03-22's switchers.spec.ts pointer to the
  ImportModal lines.

### Warnings — these properties should hold

**1. [task_completeness] Every branch a task's action permits can still pass that task's verify without breaking a prohibition**
- Plan: 03-24
- Task: 1 and 2
- Evidence: 03-24 prohibits editing `e2e/tests/transactions.spec.ts` (03-13 owns it in wave 5). Yet
  both tasks' verifies require it to pass, and so does must_haves truth 3. transactions.spec.ts
  exercises the controls Task 1 moves:
  - line 458: `getByRole('checkbox', { name: 'Everyday Checking' }).check()` on the Filters,
    Accounts tab;
  - lines 461-462: `getByLabel('At least').fill('100.01')` and `.press('Enter')` on an amount bound
    becoming CurrencyInput.

  Task 1's action gives no route if one of these selectors must change. Task 2's route (write the
  line under "For 03-15" and do not edit the spec) leaves the spec red, which its own verify then
  fails. 03-15's action anticipates only "transactions.spec.ts lines for the marks menu" from 03-24.
  The marks menu itself has no selector in transactions.spec.ts, so the contingency the plan wrote
  is the unlikely one, and the likely one (filters) has no path. If the shared Checkbox and
  CurrencyInput keep the names, the verify passes; this is unverified until execution.
- Example fix (non-binding): state that a deferred transactions.spec.ts line is the only allowed
  failure in 03-24's verify, recorded with its line. Extend the "For 03-15" route to the filter
  selectors and have 03-15 apply them.

**2. [nyquist_compliance] VALIDATION.md's frontmatter states what its sign-off claims**
- Plan: null (03-VALIDATION.md)
- Evidence: 03-VALIDATION.md line 7 is still `nyquist_compliant: false`, with `status: draft` and
  `wave_0_complete: false`. The sign-off at line 142 ticks "[x] `nyquist_compliant: true` set in
  frontmatter", and commit 245d04d4 says "nyquist_compliant true". The diff shows the revision
  changed only the comment on line 5 ("PARTIAL (validated + nyquist_compliant: true)"), not the
  field. Checks 8a-8d pass on the plans themselves:
  - every task has an `<automated>` verify with a `<fails_when>`;
  - no watch flags;
  - the map covers 58 of 58 tasks;
  - whole-project runs appear only in 03-15 and 03-23.

  The artifact is internally contradictory, though, and audit-milestone §5.5 reads the field.
- Example fix (non-binding): set the frontmatter field to match the ticked sign-off, or untick the
  sign-off line.

### Advisories (info)

**1. [dependency_correctness] Same-wave ordering is declared, not implied (applied coupling_justified exemptions)**
- Plan: waves 2 (03-04, 03-06), 3 (03-03, 03-05, 03-07, 03-08, 03-09, 03-10, 03-11, 03-14),
  5 (03-13, 03-24) and 8 (03-17 to 03-22)
- Evidence: each plan in these waves names every same-wave peer in coupling_justified. All cite the
  shared fixed e2e ports 3171-3180 and "the orchestrator runs one executor's browser run at a time".
  The exemption is applied. Note that config.json has `parallelization: true` and
  `use_worktrees: true`, and no plan carries a lock or check. Serialisation therefore depends wholly
  on the orchestrator keeping that promise.

**2. [scope_sanity] Each plan stays within the per-plan file budget**
- Plan: 03-03, 03-12 (12 files each, one entry a screenshot directory); 03-09, 03-17, 03-19, 03-20
  (10 each)
- Evidence: these counts are unchanged from iteration 1. The token estimates are all under budget,
  so this is advisory only.

### Structured Issues

```yaml
issues:
  - plan: "03-25"
    dimension: dependency_correctness
    severity: blocker
    task: 1
    required_property: "Every e2e spec that exercises a moved control is in the moving plan's files and verify, so the plan fails when it breaks one"
    description: "03-25 moves YnabImportModal and ImportCategories but lists and runs only data.spec.ts, which has 0 YNAB or category-mapping selectors. Those selectors are in switchers.spec.ts: 50-55 'Category for …' toHaveValue(groceryId)/'__new' (ImportCategories.tsx:144), 142 'Date format' toHaveValue('dmy') (YnabImportModal.tsx:321), 143 'Name for Everyday', and 145. These break when the controls become buttons, and no verify before 03-23's full run sees it. 03-22 still points at switchers.spec.ts 46-57 and 142-145, though only line 46 is ImportModal's and the rest belong to files it may not edit"
    fix_hint: "Give 03-25 the switchers.spec.ts YNAB/mapping lines (files, task, verify); narrow 03-22's pointer to the ImportModal lines"
  - plan: "03-24"
    dimension: task_completeness
    severity: warning
    task: 1
    required_property: "Every branch a task's action permits can still pass that task's verify without breaking a prohibition"
    description: "03-24 may not edit transactions.spec.ts, yet both verifies require it to pass. The spec exercises the moved filter controls (line 458 checkbox 'Everyday Checking' .check(), 461-462 getByLabel('At least').fill/press). Task 1 has no deferral route, and Task 2's 'For 03-15' route leaves its own verify red; 03-15 expects only marks-menu lines from 03-24"
    fix_hint: "Name the deferred-line case as an allowed, recorded failure and extend the 03-15 route to filter selectors"
  - plan: null
    dimension: nyquist_compliance
    severity: warning
    file: "03-VALIDATION.md"
    required_property: "VALIDATION.md's frontmatter states what its sign-off claims"
    description: "Frontmatter line 7 is still nyquist_compliant: false (status: draft, wave_0_complete: false), while sign-off line 142 ticks 'nyquist_compliant: true set in frontmatter'; the revision edited the line-5 comment, not the field"
    fix_hint: "Set the field to match the ticked sign-off, or untick the sign-off line"
  - plan: null
    dimension: dependency_correctness
    severity: info
    plans: ["03-04", "03-06", "03-03", "03-05", "03-07", "03-08", "03-09", "03-10", "03-11", "03-14", "03-13", "03-24", "03-17", "03-18", "03-19", "03-20", "03-21", "03-22"]
    required_property: "Ordering between same-wave plans is declared, not implied"
    description: "Applied coupling_justified exemption: every same-wave Playwright pair declares the shared fixed ports 3171-3180; with parallelization and use_worktrees true, serialisation rests on the orchestrator alone"
    fix_hint: "None needed; keep the orchestrator serialising browser runs"
  - plan: "03-03"
    dimension: scope_sanity
    severity: info
    required_property: "Each plan stays within the per-plan file budget"
    description: "03-03 and 03-12 list 12 files (one a screenshot dir); 03-09/17/19/20 list 10; token estimates are all <= 0.95 of budget"
    fix_hint: "Optional: split further if execution shows strain"
```

### Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| WAVG-05 | 03-01 to 03-15, 03-24 | Covered (the whole-G2 gate is fixed; 03-24's verify has a gap, Warning 1) |
| WAVG-06 | 03-01 (Q3), 03-16 to 03-23, 03-25 | Covered; the export clause is re-scoped by a recorded owner answer. The YNAB and mapping move is untested at its own plan (Blocker 1) |

### Plan Summary

| Plan | Tasks | Files | Wave | Status |
|------|-------|-------|------|--------|
| 03-01 | 2 | 3 | 1 | Valid |
| 03-02 | 3 | 8 | 2 | Valid |
| 03-03 | 3 | 12 | 3 | Valid (Info 2) |
| 03-04 | 3 | 9 | 2 | Valid |
| 03-05 | 2 | 7 | 3 | Valid |
| 03-06 | 2 | 4 | 2 | Valid |
| 03-07 | 2 | 3 | 3 | Valid |
| 03-08 | 2 | 6 | 3 | Valid |
| 03-09 | 2 | 10 | 3 | Valid |
| 03-10 | 3 | 6 | 3 | Valid |
| 03-11 | 2 | 5 | 3 | Valid |
| 03-12 | 3 | 12 | 4 | Valid (Info 2) |
| 03-13 | 2 | 5 | 5 | Valid |
| 03-14 | 2 | 4 | 3 | Valid |
| 03-15 | 3 | 10 | 6 | Valid |
| 03-16 | 2 | 1 | 7 | Valid |
| 03-17 | 2 | 10 | 8 | Valid |
| 03-18 | 2 | 2 | 8 | Valid |
| 03-19 | 3 | 10 | 8 | Valid |
| 03-20 | 2 | 10 | 8 | Valid |
| 03-21 | 2 | 4 | 8 | Valid |
| 03-22 | 2 | 3 | 8 | Stale switchers.spec.ts pointer (Blocker 1) |
| 03-23 | 3 | 8 | 10 | Valid |
| 03-24 | 2 | 3 | 5 | Warning 1 |
| 03-25 | 2 | 3 | 9 | Blocker 1 |

### Recommendation

1 blocker(s), 2 warning(s) require revision. Returning to planner with feedback.

## ISSUES FOUND
