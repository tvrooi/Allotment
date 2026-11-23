# Phase 4 plan check — iteration 2 (revision 1 = 32832ea8, checked at 7940aaa6)

## ISSUES FOUND

**Phase:** 04-remaining-screens-and-the-guard
**Plans checked:** 18 (04-01 to 04-18; 04-16, 04-17 and 04-18 are new splits)
**Issues:** 1 blocker(s), 2 warning(s), 4 info

Inputs read: all 18 PLAN.md files (04-01, 04-02, 04-07, 04-10 to 04-17 in full; 04-03 to 04-06, 04-08,
04-09 and 04-18 by frontmatter, tasks, gates and the revision diff), ROADMAP.md §Phase 4,
REQUIREMENTS.md (WAVG-07 to WAVG-10), 04-CONTEXT.md, 04-RESEARCH.md §Open Questions, 04-VALIDATION.md,
the iteration-1 report (.git/gsd-handoff/04-PLAN-CHECK.md), the revision commit 32832ea8, the owner
decisions commit b8c72845 (STATE.md, 03-01 and 03-03), the Phase 3 plans for the CategorySelect
callers (03-12, 03-13, 03-14), CLAUDE.md.

Probes: the verify-command path probe lists 110 commands and the failing-direction probe 111 commands.
All are `severity: none`, with `readError: null` and `status: ok`. No finding comes from them.

### Iteration-1 issues: all resolved

| # | Iteration-1 issue | Resolved? | How (checked) |
|---|-------------------|-----------|---------------|
| B1 | CategorySelect.tsx outlives the G4 gate and G5 rule | Yes | 04-07 Task 2 deletes it, gated on 04-01's `CategorySelect importers: plans-only`. A `git grep -qw` gate checks that it is gone, and PayeeCombobox's comment is reworded. 04-12 Task 2 rewrites DEVELOPMENT.md:227 and HANDOVER-UI.md:191 and has a docs gate. 04-13 Task 1 requires it absent, and 04-14 only confirms that. I measured 19 lines on HEAD (15 CategorySelect code, 2 doc, 2 compactSelectClass), which matches the counts the plans state. Phase 3 plans 03-12, 03-13 and 03-14 list every G2 caller file. |
| B2 | f.get baseline 31 | Yes | 04-11 now uses `HEAD=30 EXPECT==30` in all three tasks and records "30 and 30". I measured 30 `f.get(` and 30 `name=`. |
| B3 | D-20 gates without GUARD MUTATION | Yes | 04-04 T1, 04-05 T1, 04-06 T1 and 04-18 T2 each carry `@3a80af52 GUARD MUTATION:`. 04-05 T3 moved to 04-18 T2. |
| B4 | RESEARCH open questions unresolved | Yes | `## Open Questions (RESOLVED)` at 04-RESEARCH.md:537. Each question has a RESOLVED line naming the plan step that settles it, and Q3 states that the plan differs from the research's recommendation. |
| B5 | 04-10 at 15 files | Yes | Split into 04-10 (9 files, 7 components) and 04-16 (7 files, 5 components). 04-16 is wave 3 and depends on 04-10, and 04-11 depends on 04-16. |
| W1 | 04-02, 04-05 and 04-15 over 10 files | Yes | 04-02 has 10 files (17 split out), 04-05 has 8 (18 split out) and 04-15 has 10 (the CLAUDE.md/AGENTS.md sentence moved to 04-13 T3). No plan is over 10. |
| W2 | 04-14 removal gate depends on unlisted files | Yes | 04-07 now rewords PayeeCombobox and 04-12 rewrites HANDOVER-UI.md:191. The 04-14 gates' fails_when texts account for every HEAD line. |
| W3 | 04-10 spec red between plans | Yes | Each 04-10 and 04-16 task lists household.spec.ts, edits only its own lines and runs the whole spec. (A new instance of this class is in 04-11; see B1 below.) |
| W4 | Household cents() round trip | Yes | 04-01 (3c) records `Household currency: AUD only` (`currency: z.literal('AUD')`, count 1 at HEAD). 04-02 T2 tests the AUD round trip through a copy of cents(). 04-11 T2 is gated on the AUD line and sets `currency={state.group.currency}`. |
| W5 | Failing-first escape clauses | Yes | `grep 'record that no\|or record none\|or why none'` over the plans finds nothing. 04-04 T2, 04-08 T2 and 04-10 T2 state that the case must fail on the old field. |
| W6 | MonthPicker in a truth with no test | Yes | 04-17 makes MonthPicker explicitly unchanged, with a `git diff --quiet` gate, and MonthPicker.test.ts runs. |
| W7 | VALIDATION map TBD | Yes | 41 rows, 4-01-01 to 4-18-02. That equals the 41 tasks counted across the 18 plans. `nyquist_compliant: true`. |
| W8 | G5 screenshots | Yes | 04-15 T3 puts an Evidence section in the PR body with the waiver and its reason, or the screenshots, and has a gate on `^#+ Evidence`. |
| I1 | coupling_justified | Yes | 04-02 and 04-17 declare it for every wave-2 sibling. No two same-wave plans share a file (measured over the files_modified lists). |
| I2 | Record-line mapping | Yes | 04-01 truth 4 and T1 (5) state all four mappings and quote 03-01's original lines. |
| I3 | Full e2e projects in task verifies | Unchanged, as expected | REQUIREMENTS.md "Done means" requires the full suites, so this is still not a defect. |

### What passes (afresh)

| Dimension | Result |
|-----------|--------|
| 1 Requirement coverage | WAVG-07: 04-01 to 04-12 and 04-16 to 04-18. WAVG-08: 04-01, 04-07, 04-12. WAVG-09: 04-13, 04-15. WAVG-10: 04-14, 04-15. Each has concrete tasks. |
| 2 Task completeness | Each of the 40 `auto` tasks has files, action, verify with fails_when, acceptance and done. 04-01 T2 is a well-formed checkpoint. |
| 3 Dependencies | No cycles. Every wave equals max(dependency wave)+1: 04-04/04-16 are wave 3, 04-11 wave 4, 04-12 wave 5, 04-13 wave 6, 04-14 wave 7, 04-15 wave 8. 04-04 depends on 04-02 (swatch), and 04-11 on 04-02, 04-16 and 04-17, with preconditions that grep for the new props. The cross-wave spec overlaps (people.spec.ts 04-10 then 04-04; resilience.spec.ts 04-08 then 04-04) are ordered by wave. |
| Phase 3 reliance | Unchanged from iteration 1. The owner's Phase 3 answers flow through: Q2 accept gives `Welcome rows: accept` (04-06), and Q3 phase-4 gives `DataExport: phase-4`, so 04-03 T2 runs. PR #273 and PR #277 are MERGED (gh). origin/redesign does not yet hold ui/NumberField.tsx, so 04-01's precondition correctly halts until G3 merges. |
| 7 Context compliance / 7b scope | D-09 like-for-like is kept for the split household plans. D-17 file inputs are kept, and HouseholdIcon has an unchanged gate. No deferred idea is planned and no scope is reduced. |
| 10 CLAUDE.md / owner constraints | 04-12 and 04-15 stop at an open PR, with no merge, tag, release or live change. CLAUDE.md and AGENTS.md get one identical sentence (with a `cmp` gate) in the same G5 change as the rule. The lint cap is never raised. Money stays CurrencyInput or integer cents, with no parseFloat or Number(). Every changed selector carries a reason. No test is skipped, loosened or made to sleep. |
| Gate baselines (new or changed) | Measured at HEAD: bank-folder gates (enablebanking 8, simplefin 4, plaid 7; every glob-covered file outside the plan prints 0), `'Select'` in eslint.config.js 1, `no-raw-form-control` absent from 5 docs, `native .Select.` 5, the WAVES.md link sites (README.md:6, HANDOVER.md:10 and :19, HANDOVER-UI.md:172), type=number 10 (none in components/ui), Checkbox `defaultChecked` 0. |

### Blockers — these properties must hold ("must fix" is the property, never the example)

**1. [task_completeness] Each task's verify passes on a correct implementation of that task, without editing a file outside the task's `<files>`**
- Plan: 04-11
- Task: 1
- Evidence: Task 1 turns "the households list" into the shared Combobox. That is `pages/Household.tsx:439-449`, `<Select aria-label="Household" …>`, inside Task 1's read range 250-450. Task 1's `<files>` is only Household.tsx. Its verify runs `household.spec.ts -g "household|person|people"`, and that filter selects the test `renames a household and chooses which one opens first` (household.spec.ts:926). That test asserts `picker.locator('option:checked')` on `getByRole('combobox', { name: 'Household' })` at lines 938-939 and 949. A shared Combobox on desktop has no `<option>` children, so the assertion fails on a correct Task 1. The spec line is updated only in Task 3 ("Update the remaining page lines … for example 917, 939, 964"). An executor following the plan hits a red verify, or edits a file outside the task. This is the iteration-1 W3 class again (spec red between steps), now inside the task's own verify.
- Example fix (non-binding — any mechanism reaching the property counts): give Task 1 household.spec.ts and have it update the picker assertions at lines 938-939 and 949 for the shared Combobox, each with its reason.

### Warnings — these properties should hold

**1. [context_compliance] A plan does not re-ask a question the owner has already answered, and it records that answer**
- Plan: 04-01
- Task: 2
- Evidence: STATE.md (commit b8c72845) records "[Owner, 19 Nov 2026, Phase 4 04-01] 'i agree with phase 4 decisions': delete WAVES.md in the G5 PR … the Tax work-from-home rate stays a plain shared Input". 04-01 Task 2 is still a blocking `checkpoint:decision` whose action is "Ask the owner both questions … and wait". The same commit gave 03-01 an "OWNER ANSWERED 19 Nov 2026 … do not ask again" note, but 04-01 got nothing similar. Execution would stop to re-ask a settled question, and a second answer could contradict the first.
- Example fix (non-binding): have Task 2 record `WAVES.md at Wave G close: delete-in-g5` and `WFH rate field: input` with the owner's words and the date from STATE.md, without asking again.

**2. [verify_command_format] A check that the action relies on can tell pass from fail with the tools on this machine**
- Plan: 04-14
- Task: 1
- Evidence: the action's importer check is `git grep -nE "import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*['\"][^'\"]*ui/Input['\"]" -- client/src`. Apple Git 2.54.0 (git-157) ERE does not support `\s` or `\b`. Measured: `git grep -cE "import\s*\{" -- client/src/components/budget/MoneyMoves.tsx` prints nothing (exit 1), while `[[:space:]]` matches. `\bSelect\b` finds 0 lines where `-w Select` finds 5. The same pattern prints nothing at HEAD, although 10+ files import `Select` from `../ui/Input` (for example MoneyMoves.tsx:11 and SummaryStats.tsx:2). So "confirm no importer" always reports none. The impact is limited: the 04-12 perl gate counts these imports, and Task 1's `tsc --noEmit` would fail on a leftover importer. But the check the action names cannot fail.
- Example fix (non-binding): use the same perl import pattern the leftover gates use, or POSIX classes with `-w`.

### Advisories (info)

**1. [task_completeness] A file the action may edit is in the task's `<files>`**
- Plan: 04-02, Task 2
- Evidence: the action may add a plain-decimal formatter to `client/src/utils/currency.ts` ("add one there if none prints that form"). The file is in the plan's files_modified but not in Task 2's `<files>`.
- Example fix (non-binding): list it in Task 2's `<files>`.

**2. [task_completeness] An acceptance criterion is checked after the step that makes it true**
- Plan: 04-15, Task 2
- Evidence: Task 2's acceptance requires that `git grep -n 'WAVES.md' -- docs README.md HANDOVER.md` "prints only history wording". HANDOVER.md:10 and :19 are repointed only in Task 3 ("on delete-in-g5, repoint its WAVES.md mentions on lines 10 and 19").
- Example fix (non-binding): check HANDOVER.md in Task 3's acceptance, or repoint it in Task 2.

**3. [task_completeness] A task that runs a spec can update it when its own change alters a selector**
- Plan: 04-04, Task 1
- Evidence: Task 1 runs `multi-user/people.spec.ts`, but the spec is in Task 2's `<files>` only ("Touch people.spec.ts only if a Task 1 change made one of its lines fail"). That is conditional, and the radio-to-RadioGroup and Checkbox swaps probably keep `getByLabel`/`check()` working, so it is noted only. It is the same class as Blocker 1.

**4. [claude_md_compliance] The lint cap step has a stated route if a config change raises warnings**
- Plan: 04-14, Task 1
- Evidence: removing `'Select'` from jsx-a11y `controlComponents` also stops exempting a `<label>` around the shared `ui/Select` (same name). If any caller wraps it, warnings rise, and the plan allows only an equal or lower cap. Lint would then fail and say so, which is safe, but the plan gives no route.

### Structured Issues

```yaml
issues:
  - plan: "04-11"
    dimension: task_completeness
    severity: blocker
    required_property: "Each task's verify passes on a correct implementation of that task, without editing a file outside the task's <files>"
    description: "Task 1 turns Household.tsx:439-449 <Select aria-label=\"Household\"> into the shared Combobox; its files are Household.tsx only; its verify runs household.spec.ts -g \"household|person|people\", which selects 'renames a household and chooses which one opens first' (household.spec.ts:926), asserting picker.locator('option:checked') on the 'Household' combobox at lines 938-939 and 949. A desktop shared Combobox has no option children, so the test fails on a correct Task 1; the spec line is updated only in Task 3 ('for example 917, 939, 964')."
    task: 1
    fix_hint: "Give Task 1 household.spec.ts and have it update the picker assertions at 938-939 and 949 for the shared Combobox, with reasons"
  - plan: "04-01"
    dimension: context_compliance
    severity: warning
    required_property: "A plan does not re-ask a question the owner has already answered, and it records that answer"
    description: "STATE.md (b8c72845) records the owner's 19 Nov answer 'i agree with phase 4 decisions' (delete WAVES.md in G5; WFH rate stays a plain shared Input), but 04-01 Task 2 is still a blocking checkpoint whose action is 'Ask the owner both questions ... and wait'; 03-01 got a 'do not ask again' note in the same commit, 04-01 did not"
    task: 2
    fix_hint: "Record 'WAVES.md at Wave G close: delete-in-g5' and 'WFH rate field: input' from STATE.md with the owner's words and date, without asking again"
  - plan: "04-14"
    dimension: verify_command_format
    severity: warning
    required_property: "A check that the action relies on can tell pass from fail with the tools on this machine"
    description: "Task 1's 'confirm no importer' git grep -nE uses \\s and \\b, which Apple Git 2.54.0 ERE does not support (measured: 'import\\s*\\{' matches nothing in MoneyMoves.tsx, '[[:space:]]' matches; '\\bSelect\\b' 0 lines vs -w 5); at HEAD it prints nothing although 10+ files import Select from ../ui/Input. tsc in the verify and the 04-12 perl gate still catch a leftover importer."
    task: 1
    fix_hint: "Use the perl import pattern the leftover gates use, or POSIX classes with -w"
  - plan: "04-02"
    dimension: task_completeness
    severity: info
    required_property: "A file the action may edit is in the task's <files>"
    description: "Task 2 may add a formatter to client/src/utils/currency.ts (in files_modified) but its <files> omits it"
    task: 2
    fix_hint: "List client/src/utils/currency.ts in Task 2's <files>"
  - plan: "04-15"
    dimension: task_completeness
    severity: info
    required_property: "An acceptance criterion is checked after the step that makes it true"
    description: "Task 2's acceptance requires no active WAVES.md link in HANDOVER.md, which Task 3 repoints (lines 10 and 19)"
    task: 2
    fix_hint: "Move the HANDOVER.md part of the check to Task 3"
  - plan: "04-04"
    dimension: task_completeness
    severity: info
    required_property: "A task that runs a spec can update it when its own change alters a selector"
    description: "Task 1 runs multi-user/people.spec.ts but only Task 2 lists it, conditionally ('only if a Task 1 change made one of its lines fail')"
    task: 1
  - plan: "04-14"
    dimension: claude_md_compliance
    severity: info
    required_property: "The lint cap step has a stated route if a config change raises warnings"
    description: "Removing 'Select' from jsx-a11y controlComponents also drops the exemption for <label> around the shared ui/Select (same name); a rise in warnings fails lint (safe) with no route in the plan"
    task: 1
```

### Unverified

- `gsd_run query verify.plan-structure`, `plan.task-structure` and `estimate-check --calibrated` were
  not run (iteration safety note). Task structure was checked by reading the plans and by grep counts
  of `<task `. The estimates (35,000 to 90,000 tokens, all `confidence: low`) were not checked.
- I did not re-measure 04-03, 04-05 T1/T2, 04-06, 04-08 and 04-09 gate baselines that were unchanged
  since iteration 1, where they were measured. The bank-folder gates for the 04-05/04-18 split were
  re-measured.
- Phase 3 SUMMARY files still do not exist (Phase 3 has not executed).
- Commands run: read-only `git show/log/status/grep/cat-file/rev-parse`, `grep`, `sed`, `awk`, `perl`
  (counting only), `wc`, `ls`, `gh pr view 273` and `gh pr view 277` (read-only), and `git fetch -q
  origin`, which updated remote-tracking refs only. Against the safety note, several calls were small
  read-only loops or pipelines (per-file counts, a frontmatter tabulation, a files-overlap check)
  rather than one plain count each. None executed plan text, and none wrote to a tracked file. The
  only files written are this report and the dispatcher result JSON.

### Recommendation

1 blocker and 2 warnings require revision; returning to the planner with feedback. All 16
iteration-1 issues are resolved. The blocker is a one-step ordering slip in 04-11 (a spec line
updated two tasks after the change that breaks it). W1 is needed so that execution does not stop
to re-ask the owner.

ISSUES FOUND
