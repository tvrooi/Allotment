## ISSUES FOUND

**Phase:** 03-screens-on-shared-controls
**Plans checked:** 25 (03-01 to 03-25). Checker iteration 3 (final), against HEAD b474a614. Revision 2 is d9a83918.
**Issues:** 0 blocker(s), 2 warning(s), 2 info

### Method

- **Scope of this pass.** I checked revision 2 (d9a83918: 03-15, 03-22, 03-24, 03-25, 03-VALIDATION) afresh and looked again at each iteration-2 issue.
- **Unchanged ground.** `git diff --stat 245d04d4 HEAD -- client e2e lint server` is empty, so no source changed after iteration 2. The baselines that iteration 2 measured still hold for every gate that revision 2 did not touch.
- **Structure and budget.** `verify.plan-structure` exits 0 (valid) on 03-15 (3 tasks), 03-22, 03-24 and 03-25 (2 tasks each), with no errors and no warnings. `estimate-check --calibrated` (budget 100000, confidence low) puts all four under budget: 03-15 0.90, 03-22 0.70, 03-24 0.45, 03-25 0.50.
- **Probes.** Both deterministic probes report 0 blockers and 0 warnings: path resolvability (137 commands) and failing direction (145 statements, readError null).
- **Dependencies.** 03-25 is wave 9, depends on 03-16 (wave 7) and 03-22 (wave 8), and is alone in its wave. 03-24 is wave 5 and 03-15 wave 6, with 03-15 depending on both 03-13 and 03-24. The graph is still acyclic, every wave is max(deps)+1, and no two same-wave plans share a file in files_modified.
- **Owner constraints** still hold in the revised plans:
  - 03-15 and 03-23 each say "do not merge".
  - No revised plan runs `gh pr merge`, a tag-creating `git tag`, a publish or a live-budget change. `release:prepare` is the in-PR version bump that CLAUDE.md requires, with "no tag created".
  - No test is skipped, retried, loosened or made to sleep. 03-24's allowed failures are limited to the lines it records, and 03-15 must then run that spec green (see the table below).
- **Commands I ran myself.** Each was a plain read-only command, typed and run one at a time. I did not evaluate any plan text in a batch. HEAD values:
  - `grep -c "'combobox', { name: 'Date format' }" e2e/tests/switchers.spec.ts` gives **1**, matching `[HEAD=1]`.
  - `grep -c "name: 'Amount format'" e2e/tests/switchers.spec.ts` gives **0**, matching `[HEAD=0]`.
  - `grep -c "getByRole('combobox', { name: 'Category for" e2e/tests/switchers.spec.ts` gives **3**, matching `[HEAD=3]` (lines 51, 54, 145).
  - `grep -c "toHaveValue('__new')" e2e/tests/switchers.spec.ts` gives **1**, matching `[HEAD=1]`.
  - `grep -cF "g.name === 'Bills')).toBe(false)" e2e/tests/switchers.spec.ts` gives **1**, matching `[HEAD=1 EXPECT==1]`. This is a GUARD MUTATION gate, legitimately true at HEAD.
  - `git diff --quiet HEAD -- e2e/tests/transactions.spec.ts && git rev-list --count --fixed-strings --grep='(03-24)' HEAD -- e2e/tests/transactions.spec.ts` gives **0**, matching `[HEAD=0 EXPECT==0]` (GUARD MUTATION). The executors commit as `type(NN-NN): …`, so the `(03-24)` scope is the convention.
- **Not run.** None of the e2e, npm, build or lint commands (they build and write). Their pass or fail is unverified until execution.

### Previous issues (iteration 2): how each is resolved

| # | Issue | Status | How verified |
|---|-------|--------|--------------|
| B1 | 03-25 moved YNAB and the category mapping but listed and ran only data.spec.ts; 03-22's switchers pointer was stale | **Resolved** | 03-25 now lists `e2e/tests/switchers.spec.ts` in files_modified, in both tasks' `<files>` and in both e2e verifies (`tests/switchers.spec.ts tests/data.spec.ts`). It drops data.spec.ts from files_modified and runs it unchanged. I checked its line claims against the file: 42-80 is the YNAB-style CSV test (46 'Column Category'; 51/54 'Category for …' toHaveValue; 56-58 'Group for …' toContainText; 59 no 'Bills' before the import; 70-79 created after it). 112-150 is the YNAB register test (142 'Date format', 143 'Name for Everyday', 145-147 'Category for Transport: Fuel'). 312-345 is the fresh-budget YNAB import. 229-240 and 354-361 are Up bank connections. The four new negative gates print their HEAD values (above) and fail if a native-select reading survives. The deferred-create proof (59 and 70-79) is pinned by a guard. 03-22's read_first and action now restrict it to line 46, and its MUST NOT bars 50-59 and 142-147. 03-22 (wave 8) comes before 03-25 (wave 9), so the shared spec is ordered. |
| W1 | 03-24 could not edit transactions.spec.ts yet its verifies required it green | **Resolved** | 03-24's verifies are split. transaction-filters.spec.ts must pass outright. transactions.spec.ts may fail only on a line that 03-24-SUMMARY.md lists under "For 03-15" with its replacement and reason (`<fails_when>` names the Playwright error location). A guard proves 03-24 never edits the spec (prints 0). Task 1 names lines 458 and 461-462 and makes "keep the names" the expected route. 03-15 lists transactions.spec.ts in files_modified, applies the filter and marks lines from 03-24, and must then pass them in its full desktop run. The VALIDATION rows match (3-24-01 +1, 3-24-02 +4, 3-25-01 +2, 3-25-02 +5; I counted the verifies). |
| W2 | VALIDATION frontmatter contradicted its sign-off | **Resolved** | Line 7 is `nyquist_compliant: true`, which matches the ticked line 142. `status: draft`, `wave_0_complete: false` and `**Approval:** pending` agree with the unticked Wave 0 items at lines 120-122, which are not executed yet. The map still has 58 rows. |
| I1 / I2 | coupling_justified exemption; file counts | Unchanged | Carried forward below as Info 1 and 2. |

### Blockers: none

### Warnings (these properties should hold)

**1. [key_links_planned / cross-plan data contract] Every prop a plan passes to a shared component exists at HEAD or is added by a plan it depends on, and that plan lists the file and tests the prop**
- Plans: 03-25 (Task 2, revised), and also 03-17 (Task 1) and 03-11 (Task 2)
- What I found:
  - At HEAD, `client/src/components/transactions/CategorySelectButton.tsx:10-19` accepts only `value, onChange, position, placeholder, transferAccounts, id`. It loads every group itself through `useCategories()` (line 31) and hands CategoryPicker no `allowNone` or `noneLabel`, although CategoryPicker has both (lines 82, 84).
  - The only plan that lists CategorySelectButton.tsx in files_modified is 03-04. Its Task 2 action adds `extraItem` and `hint` passed through, plus `label`, and nothing more.
  - Three plans still rely on props that no plan adds, and none of them lists the file:
    - 03-25 Task 2 uses "CategorySelectButton … with allowNone 'Uncategorised'", and its read_first cites "CategorySelectButton.tsx (extraItem, allowNone, noneLabel, label)" as if they exist.
    - 03-17:85 uses "allowNone and noneLabel 'Manual tracking'" "over expense groups".
    - 03-11:106 uses "over groups filtered to the source's income or expense kind with the source category removed", which needs a groups input.
  - Without `allowNone`, the import mapping loses today's `<option value="">Uncategorised</option>` (ImportCategories.tsx:164). A user could no longer leave a bank category unmapped, which is a behaviour change against the phase goal.
  - Each executor would therefore add props to a shared G2 component outside its declared files:
    - the wave guard cannot see the edit;
    - the prop gets no unit test (CLAUDE.md: new behaviour comes with a test);
    - 03-11 (wave 3), 03-17 (wave 8) and 03-25 (wave 9) may each write a separate version, against CLAUDE.md's rule of one implementation per behaviour.
  - The e2e verifies would probably catch a missing "Uncategorised" item only indirectly. No current switchers.spec.ts line selects it.
- Example fix (non-binding): have 03-04 Task 2 (or one early plan that the three depend on) add and test the `allowNone`, `noneLabel` and groups pass-through on CategorySelectButton, and point 03-11, 03-17 and 03-25 at it.

**2. [task_completeness] Every route a task's action names is consistent with its own verify and with the naming contract of the component it uses**
- Plan: 03-25
- Task: 2
- What I found:
  - The action says "CategorySelectButton (label as today, for example 'In Allotment')" and, in the same sentence, "its accessible name stays 'Category for {bank label}'".
  - 'In Allotment' is the column header (ImportCategories.tsx:122). Today's accessible name is `Category for ${label}` (ImportCategories.tsx:144).
  - 03-04 fixes the button's name as `${label}: ${shown}`. So:
    - Following the example gives 'In Allotment: Groceries', and the plan's own new selector, `getByRole('button', { name: 'Category for …' })`, fails.
    - Following the name statement can't be done literally. With label `Category for Food & Dining: Groceries` the name becomes 'Category for Food & Dining: Groceries: Groceries', and the switchers.spec.ts selectors pass only through Playwright's default substring name match.
  - The e2e verify does catch the wrong route, so execution can proceed. But the action names a route that its own verify rejects, and it states a name that the component cannot produce.
- Example fix (non-binding): say that the label is `Category for {bank label}`, giving the name 'Category for {bank label}: {shown}', and drop the 'In Allotment' example.

### Advisories (info)

**1. [dependency_correctness] Same-wave ordering is declared, not implied (applied coupling_justified exemptions)**
- Plans: waves 2, 3, 5 and 8 (unchanged since iteration 2)
- What I found:
  - Every same-wave Playwright pair names the other in coupling_justified, citing the shared fixed e2e ports 3171-3180 and one browser run at a time.
  - config.json has `parallelization: true` and `use_worktrees: true`, so serialisation rests on the orchestrator alone.
  - 03-24's revised fails_when also depends on this. It matches Playwright error locations against line numbers from 03-24's own worktree, while 03-13 edits the same spec in parallel. 03-15 applies the recorded lines by content after both have merged.

**2. [scope_sanity] Each plan stays within the per-plan file budget**
- Plans: 03-03 and 03-12 (12 files each); 03-09, 03-17, 03-19 and 03-20 (10 each). Unchanged.
- What I found: every token estimate is at or below 0.95 of the budget, so this is advisory only.

### Structured Issues

```yaml
issues:
  - plan: "03-25"
    dimension: key_links_planned
    severity: warning
    task: 2
    required_property: "Every prop a plan passes to a shared component exists at HEAD or is added by a plan it depends on, and that plan lists the file and tests the prop"
    description: "CategorySelectButton.tsx:10-19 has no allowNone, noneLabel or groups input (it calls useCategories() at :31); 03-04 Task 2, the only plan listing the file, adds only extraItem, hint and label. 03-25 Task 2 needs allowNone 'Uncategorised' (losing it removes today's <option value=''>Uncategorised</option>, ImportCategories.tsx:164); 03-17:85 needs allowNone/noneLabel 'Manual tracking' over expense groups; 03-11:106 needs a kind-filtered groups list. None of the three lists CategorySelectButton.tsx, so each would add an untested, undeclared prop to a shared G2 component, possibly three times across waves 3, 8 and 9"
    fix_hint: "Add and test the allowNone/noneLabel/groups pass-through once, in 03-04 or a plan all three depend on, and reference it"
  - plan: "03-25"
    dimension: task_completeness
    severity: warning
    task: 2
    required_property: "Every route a task's action names is consistent with its own verify and with the naming contract of the component it uses"
    description: "Action says 'label as today, for example 'In Allotment'' and 'its accessible name stays 'Category for {bank label}''. 'In Allotment' is the column header (ImportCategories.tsx:122), not today's name (Category for ${label}, :144). 03-04 makes the name `${label}: ${shown}`, so the example yields 'In Allotment: Groceries' and fails the plan's own getByRole('button', { name: 'Category for …' }) selectors; the stated name can't be produced exactly ('Category for X: Groceries' passes only through Playwright's substring match)"
    fix_hint: "State label = 'Category for {bank label}' (name 'Category for {bank label}: {shown}') and drop the 'In Allotment' example"
  - plan: null
    dimension: dependency_correctness
    severity: info
    plans: ["03-04", "03-06", "03-03", "03-05", "03-07", "03-08", "03-09", "03-10", "03-11", "03-14", "03-13", "03-24", "03-17", "03-18", "03-19", "03-20", "03-21", "03-22"]
    required_property: "Ordering between same-wave plans is declared, not implied"
    description: "Applied coupling_justified exemption (fixed e2e ports 3171-3180); with parallelization and use_worktrees true, serialisation rests on the orchestrator. 03-24's fails_when matches line numbers from its own worktree while 03-13 edits the same spec in parallel; 03-15 applies the lines by content after merge"
    fix_hint: "None needed; keep browser runs serialised"
  - plan: "03-03"
    dimension: scope_sanity
    severity: info
    required_property: "Each plan stays within the per-plan file budget"
    description: "03-03 and 03-12 list 12 files; 03-09/17/19/20 list 10; token estimates all <= 0.95 of budget (unchanged)"
    fix_hint: "Optional: split further if execution shows strain"
```

### Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| WAVG-05 | 03-01 to 03-15, 03-24 | Covered. 03-24's transactions.spec.ts gap is closed through the "For 03-15" route and 03-15's green desktop run. |
| WAVG-06 | 03-01 (Q3), 03-16 to 03-23, 03-25 | Covered. 03-25 now owns and runs the switchers.spec.ts YNAB and mapping lines. The CategorySelectButton prop contract is underplanned (Warnings 1 and 2). |

### Plan Summary

| Plan | Tasks | Files | Wave | Status |
|------|-------|-------|------|--------|
| 03-01 | 2 | 3 | 1 | Valid |
| 03-02 | 3 | 8 | 2 | Valid |
| 03-03 | 3 | 12 | 3 | Valid (Info 2) |
| 03-04 | 3 | 9 | 2 | Valid (its prop set is short for 03-11, 03-17 and 03-25: Warning 1) |
| 03-05 | 2 | 7 | 3 | Valid |
| 03-06 | 2 | 4 | 2 | Valid |
| 03-07 | 2 | 3 | 3 | Valid |
| 03-08 | 2 | 6 | 3 | Valid |
| 03-09 | 2 | 10 | 3 | Valid |
| 03-10 | 3 | 6 | 3 | Valid |
| 03-11 | 2 | 5 | 3 | Warning 1 (groups filter) |
| 03-12 | 3 | 12 | 4 | Valid (Info 2) |
| 03-13 | 2 | 5 | 5 | Valid |
| 03-14 | 2 | 4 | 3 | Valid |
| 03-15 | 3 | 10 | 6 | Valid (revised; applies the deferred filter lines) |
| 03-16 | 2 | 1 | 7 | Valid |
| 03-17 | 2 | 10 | 8 | Warning 1 (allowNone/noneLabel) |
| 03-18 | 2 | 2 | 8 | Valid |
| 03-19 | 3 | 10 | 8 | Valid |
| 03-20 | 2 | 10 | 8 | Valid |
| 03-21 | 2 | 4 | 8 | Valid |
| 03-22 | 2 | 3 | 8 | Valid (revised; pointer narrowed to line 46) |
| 03-23 | 3 | 8 | 10 | Valid |
| 03-24 | 2 | 3 | 5 | Valid (revised; W1 resolved) |
| 03-25 | 2 | 3 | 9 | Warnings 1 and 2 (B1 resolved) |

### Recommendation

The iteration-2 blocker and both iteration-2 warnings are resolved. There are no blockers. 2 warning(s) remain, both about CategorySelectButton's prop contract. This was the final iteration, so per the Revision Gate the orchestrator decides whether to escalate them to the owner or accept them with the risk recorded. Execution would not be unsafe, and the e2e verifies would catch the visible failures. The missing "Uncategorised" item is the one that a verify may not catch.

## ISSUES FOUND
