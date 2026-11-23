---
phase: 03-screens-on-shared-controls
plan: 16
subsystem: ui
tags: [wave-g, g3, reconcile, d-16, d-12, baseline, record]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'PR #278 (Wave G2), merged into origin/redesign as c283170c'
provides:
  - 'The G3 D-16 record: one reconcile line, the WAVG-06 export line and the owner answer it copies'
  - 'The G3 file-by-file table (audit target, plan, agreement) and the D-17 native-input list'
  - 'Leftover-gate counts for plans 03-17 to 03-22 and 03-25, measured on the tree merged with origin/redesign'
affects: [03-17, 03-18, 03-19, 03-20, 03-21, 03-22, 03-23, 03-25]
plan_head_before: 18032e439d570e876054ac650f850e01388c24c8
plan_head_after: 91bc93e96285d6a97e7361d764bbd730cd667abc
commits: 5
actuals:
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns:
    - 'Merge origin/redesign with --no-commit, then keep this checkout .planning exactly as at HEAD (origin/redesign deleted .planning in #276)'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-16-SUMMARY.md
  modified: []
key-decisions:
  - 'The merge of origin/redesign keeps .planning as at HEAD; origin/redesign has 6d4e538f, which deletes .planning'
  - 'The merge changed no source file: the tree outside .planning was already identical to origin/redesign'
  - 'longterm/fields.tsx WholeNumberField and RateField (audit: Input, inputMode kept) move to NumberField in 03-19; recorded as agreeing, with a parity condition for 03-19'
requirements-completed: []
coverage:
  - id: D1
    description: 'G2 is merged and the checkout holds it'
    requirement: WAVG-06
    verification:
      - kind: command
        ref: 'gh pr list --head feat/wave-g2-screens --state merged (1); git cat-file -e origin/redesign:client/src/components/ui/NumberField.tsx; git merge-base --is-ancestor origin/redesign HEAD'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Merged tree type-checks and client unit tests pass'
    requirement: WAVG-06
    verification:
      - kind: command
        ref: 'client tsc --noEmit; npm --prefix client test (947/947)'
        status: pass
    human_judgment: false
  - id: D3
    description: 'G3 reconcile record, WAVG-06 export line and gate baselines'
    requirement: WAVG-06
    verification:
      - kind: command
        ref: 'the two grep checks in 03-16-PLAN.md Task 2'
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-11-20
status: complete
---

# Phase 3 Plan 16: Open G3 with the D-16 check

**G2 is merged (PR #278, squash `c283170c`), the checkout holds it and builds (client tsc clean, 947/947 unit tests), and G3 can start: the audit, the owner's answers and the shipped controls agree with plans 03-17 to 03-22 and 03-25.**

## Records

G3 reconcile: match

WAVG-06 export: no export dialog exists; DataExport.tsx is a Settings tab and moves in Phase 4 (owner, 19 November 2026)

The export line is copied from `03-01-SUMMARY.md`, whose record line reads `Export dialogs: phase-4`. The owner gave that answer ("leave export yes", Q3) in the orchestrator session on 19 November 2026. The owner's reasoning, from that file: every export is a direct download button, so no export dialog exists; `settings/DataExport.tsx` is a Settings tab whose two date fields (`:141`, `:156`) the audit files under "G4: Settings"; G3 moves the import dialogs only. 03-23 quotes the line in the G3 PR and the phase verifier reads it against WAVG-06 and ROADMAP success criterion 1.

## Task 1: G2 merged, checkout up to date

- G2 PR: **#278** (`feat/wave-g2-screens` into `redesign`), state MERGED at 2026-11-20T08:09:53Z. Merge (squash) commit on origin/redesign: **`c283170c`** ("feat(ui): Wave G2: everyday money screens on the shared controls (#267) (#278)").
- Precondition re-run: `gh pr list … --state merged` printed `1`; `git cat-file -e origin/redesign:client/src/components/ui/NumberField.tsx` printed `g2-merged`.
- Checkout merge commit: **`91bc93e9`** ("chore: merge origin/redesign (Wave G2 #278) into redesign, keeping .planning"). `git merge-base --is-ancestor origin/redesign HEAD` exits 0. See Deviation 1 for how `.planning` was kept.
- The merge changed no tracked file outside `.planning` (nothing was staged): `git diff origin/redesign HEAD -- . ':!.planning'` is empty, because the local branch already carried the G2 work (03-15's branch was merged into it in `bb57f76e`/`cb3b5e21`).
- Review findings left for G3: none. #278 has no human review or comment. Its Codex review did not run ("You have reached your Codex usage limits for code reviews"), so no finding was resolved or dismissed. The owner merged with no answer to any item under 03-15's "Findings for the owner", so none of them changes a G3 plan (the items that touch shared controls G3 uses, the 03-24 IN-01 `CurrencyInput` look and the `CategorySelectButton` size gap, stay open for the owner, not a precondition).
- Verification on Node 24 (`/opt/homebrew/opt/node@24/bin`):

| Check | Result |
| --- | --- |
| `cd client && npx tsc --noEmit` | exit 0, no output |
| `npm --prefix client test` | Test Files 103 passed (103); Tests **947 passed (947)**; 0 failed |

## Task 2: reconcile and baselines (D-16)

Sources read: `docs/ui/FORM-CONTROLS-AUDIT.md` (the G3: Goals, Forecast, Long-term forecast, Investments, Reports, Files sections, the ImportModal, YnabImportModal and ImportCategories rows, Number fields, Date and month fields, Stays native, For the owner), the owner's answers (`02-03-SUMMARY.md`, `03-01-SUMMARY.md`), plans 03-17 to 03-22 and 03-25, and the shipped controls (`ui/NumberField.tsx`, `amountValidity.tsx`, `fieldMessages.ts`, `CategorySelectButton.tsx`, `CategoryPicker.tsx`, `DatePicker.tsx` with `fieldSize`, `utils/longTerm.ts` `bpsToInput`/`inputToBps`, e2e `chooseOption`, `fillDate`, `setToggle`).

Owner answers that bind G3 (02-03 Q3, all 36 "owner to decide" rows take the audit's recommendation): money fields are `CurrencyInput` (GoalStatusModal `:150`, CashRunway `:114`); merchant text fields stay `Input`; the import mapping (`ImportCategories.tsx:143`) keeps its deferred "create new" as an extra item.

### G3 file | target per audit | plan | agrees

| G3 file | Target per audit | Plan | Agrees |
| --- | --- | --- | --- |
| `goals/GoalFormModal.tsx` | Name Input; Progress source CategoryPicker with a "Manual tracking" none choice; Linked account Combobox; CurrencyInput x2 and DatePicker kept | 03-17 Task 1 | yes (CategorySelectButton is CategoryPicker's trigger; `groups`/`allowNone`/`noneLabel`/`extraItem`/`hint` are already forwarded in the tree) |
| `goals/GoalStatusModal.tsx` | reason Input; Replaced by Combobox; Move to category CategoryPicker; amount CurrencyInput (owner) | 03-17 Task 1 | yes |
| `investments/IncomeModals.tsx` | kind Select (`INCOME_KINDS`); Paid on DatePicker; franking Checkbox; Input; CurrencyInput kept | 03-17 Task 2 | yes |
| `investments/InvestmentModals.tsx` | kind Select (`SECURITY_KINDS`); two dates DatePicker; account and security Combobox; Inputs (units keep `inputMode="decimal"`); Checkbox | 03-17 Task 2 | yes |
| `investments/SaleModals.tsx` | Sold on DatePicker; parcel choice RadioGroup; Inputs (units keep `inputMode="decimal"`) | 03-17 Task 2 | yes |
| `investments/SplitModals.tsx` | Effective on DatePicker; ratio terms Input (`inputMode="numeric"`) | 03-17 Task 2 | yes |
| `forecast/CashRunway.tsx` | amounts CurrencyInput (owner); dates DatePicker x4; horizon, lookback, income source, household shares Select; scenarios Combobox; Inputs; the two percent fields are `type="number"` (0-500, 0-200, growth -100 to 50) | 03-18 Tasks 1-2 | yes (the audit's Number fields table says "Input within its Zod cap"; D-14 and plan 03-18 make that the shared NumberField with the same caps) |
| `longterm/fields.tsx` | CurrencyInput kept; `:125` and `:193` Input with `inputMode` kept; two Selects | 03-19 Task 1 | yes, with a condition (see Note 1) |
| `longterm/EventEditor.tsx`, `EventList.tsx` | Input; Select; Checkbox x4 (EventEditor) and x1 (EventList); End year `type="number"` 1900-2300 or none; loan Combobox | 03-19 Task 2 | yes (End year to NumberField, optional, per D-14) |
| `longterm/LongTermForecast.tsx`, `SavingsPanel.tsx`, `SimulationPanel.tsx`, `AccountsPanel.tsx`, `AssumptionsPanel.tsx` | Inputs; Plan and Compare with Combobox; Year, savings mode, paths, study kind, asset class Select; account Combobox; radios RadioGroup; checkboxes Checkbox | 03-19 Task 3 | yes |
| `reports/AccountMultiSelect.tsx`, `CategoryTreePicker.tsx`, `ReportDetail.tsx` | Checkbox | 03-20 Task 1 | yes |
| `reports/ReportBuilderSidebar.tsx` | Group by Select (`GROUP_BY_OPTIONS`); MonthRangePicker is Phase 2 (G1) | 03-20 Task 1 | yes |
| `reports/SaveReportModal.tsx`, `reports/dashboard/NameModal.tsx` | Input (already the shared Input) | 03-20 Task 1 (confirm, leave) | yes |
| `reports/DateRangeControl.tsx` | stays as it is (SegmentedControl, not a field) | none | yes |
| `ui/MonthPicker.tsx`, `utils/dateRange.ts` | not a G3 audit row (carried review items IN-02, IN-03 from Phase 2) | 03-20 Task 2 | n/a |
| `pages/Files.tsx` | search and limit Input; Kind Select (`KIND_LABELS`); From and To DatePicker | 03-21 Task 1 | yes |
| `files/FileDetailModal.tsx` | name, tag Input; link target CategoryPicker for categories and Combobox for the other kinds; DatePicker; Textarea | 03-21 Task 2 | yes |
| `files/FilesSection.tsx` | Input | 03-21 Task 1 (confirm) | yes |
| `files/FileParts.tsx` | `<input type="file">` stays native | 03-21 (listed, unchanged) | yes (D-17) |
| `transactions/ImportModal.tsx` | statement, separator, encoding, date format, amount format, column role Select; Rows above the header `type="number"` 0-1000; outflow word Input; preview Checkbox; file input native | 03-22 Tasks 1-2 | yes (Rows above the header to NumberField per D-14) |
| `transactions/YnabImportModal.tsx` | date and amount format Select; account mapping Combobox; new account name Input; file input native | 03-25 Task 1 | yes |
| `transactions/ImportCategories.tsx` | `:143` CategoryPicker with "none" and the deferred "create new" as an extra item (the owner took the audit's recommendation); `:182` group Combobox | 03-25 Task 2 | yes |
| `transactions/ImportHistory.tsx` | no audit row; 0 raw controls (UI-SPEC lists it in G3) | none needed | yes |
| `receipts/ReceiptEditor.tsx`, `ReceiptsTab.tsx` | audit marks them G3, but they moved in G2 by D-13 (`pages/Transactions.tsx` opens them) | G2 plans (done) | yes |
| `settings/DataExport.tsx` | not a G3 file; dates filed under G4: Settings | none (Phase 4) | yes |

Note 1 (`longterm/fields.tsx`): the audit classes `WholeNumberField` (`:193`) and `RateField` (`:125`) as `Input` with `inputMode` kept, and plan 03-19 rebuilds them on `NumberField`. They are not `type="number"`, so D-14 does not license a behaviour change; D-15 applies. The agreement holds because `NumberField` is the shared `Input`-based number field (it sets `inputMode` to `numeric` or `decimal`, as these two do), and today's two components already hand-implement what it provides: draft text, a range check, the message `Enter a whole number from {min} to {max}.` (the same text `wholeNumberRangeMessage` produces) and a validity report through `useReportAmountValidity`. 03-19 must keep the exported names, props, labels, messages, the "Assumption, default …" hint with "Use default", and the "only a valid value reaches `onChange`" behaviour; if NumberField cannot do any of that with no observable change, 03-19 stops and records `revise` there.

Note 2 (line numbers): the plans quote spec lines from before G2; the content they name still exists. Current positions: `settings.spec.ts` Linked account at `:439` (plan 03-17 says `:350`); `investments.spec.ts` dates at `:32` (price Date), `:43`, `:94`, `:170`, `:238` (plan: 30, 41, 92, 168, 236, two lines up); Tax-year `selectOption` at about `:127` and `:191` unchanged. The plans' other quoted lines match: `data.spec.ts:331,611,618`; `switchers.spec.ts:46,51,54,55,59,142,145`; `category-goals.spec.ts:19,58`; `reports.spec.ts:101,107`; `unsaved-drafts.spec.ts:66,74,82`; `long-term-forecast.spec.ts:98,139,140,166,312,320`; `demo/long-term-forecast.spec.ts:24`. The executors search by content, not line.

### D-17 list for G3 (file inputs that stay native)

| File | Line now | Audit line |
| --- | --- | --- |
| `client/src/components/files/FileParts.tsx` | 202 | 199 |
| `client/src/components/transactions/ImportModal.tsx` | 681 | 679 |
| `client/src/components/transactions/YnabImportModal.tsx` | 298 | 296 |

(The audit's fourth G3 file input, `receipts/ReceiptsTab.tsx:72`, moved with G2.)

### Leftover-gate counts on the merged tree

Each command is copied from the plan's last task and run on `91bc93e9`. All equal the HEAD value the plan carries, so there is no difference to note. Each plan's expected end value is 0 unless stated.

| Plan | Gate (file set) | Plan HEAD value | Now |
| --- | --- | --- | --- |
| 03-17 | raw-control perl gate over 2 goal and 4 investment files | 15 | **15** |
| 03-18 | `type="number"` count in CashRunway.tsx | 2 | **2** |
| 03-18 | raw-control perl gate over CashRunway.tsx | 7 | **7** |
| 03-19 | `type="number"` count in EventEditor.tsx | 1 | **1** |
| 03-19 | raw-control perl gate over 8 longterm files | 18 | **18** |
| 03-20 | select/textarea/input perl gate over 4 report files | 5 | **5** |
| 03-20 | `MONTH_NAMES` count in cash-flow.spec.ts | 3 | **3** |
| 03-21 | raw-control perl gate over Files.tsx, FileDetailModal.tsx, FilesSection.tsx | 6 | **6** |
| 03-22 | `'spinbutton', { name: 'Rows above the header'` count in data.spec.ts | 3 | **3** |
| 03-22 | raw-control perl gate over ImportModal.tsx | 10 | **10** |
| 03-25 | `'combobox', { name: 'Date format' }` count in switchers.spec.ts | 1 | **1** |
| 03-25 | `name: 'Amount format'` count in switchers.spec.ts (expects >= 1 at the end) | 0 | **0** |
| 03-25 | `getByRole('combobox', { name: 'Category for` count in switchers.spec.ts | 3 | **3** |
| 03-25 | `toHaveValue('__new')` count in switchers.spec.ts | 1 | **1** |
| 03-25 | `g.name === 'Bills')).toBe(false)` count in switchers.spec.ts (guard, expects 1 at the end) | 1 | **1** |
| 03-25 | raw-control perl gate over ImportModal.tsx, YnabImportModal.tsx, ImportCategories.tsx | 16 | **16** |

03-22's ImportModal gate (10) and 03-25's three-file gate (16) overlap on ImportModal.tsx: after 03-22 the 03-25 gate is expected to read 6 before 03-25 starts (YnabImportModal and ImportCategories), then 0.

### Boundaries and assumptions carried

- G3 moves the import dialogs (`ImportModal`, `YnabImportModal`, `ImportCategories`) and keeps their file inputs native. `settings/DataExport.tsx` stays with Settings in Phase 4.
- The plan's edge assumptions stand as written and are for the executors to test: a value at a converted field's cap is accepted and one past it refused (skipRows 0 and 1000, spending 0 and 500, income 0 and 200, growth -100 and 50, end year 1900 and 2300); a blank optional end year saves as no end year, a blank required number is invalid, and a file with no rows above its header accepts only 0; moved lists keep their order and groups, with equal labels chosen by value; the G3 plans share e2e ports 3171-3180, so browser runs go one at a time.
- WAVG-06 is not complete: this plan only opens G3. It is not marked complete in REQUIREMENTS.md.

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | `91bc93e9` | chore: merge origin/redesign (Wave G2 #278) into redesign, keeping .planning (the measured `commits: 5` counts this merge plus the 4 origin/redesign commits it brings in) |
| 2 | (this summary) | docs(03-16): open G3 with the D-16 reconcile record and gate baselines |

## Deviations from Plan

1. **[Orchestrator instruction, replaces the plan's "plain merge"] origin/redesign was merged with `.planning` kept as at HEAD.** `origin/redesign` carries `6d4e538f` ("chore: drop docs/superpowers/gsd-records/ from redesign (#276)"), so a plain merge would delete about 95 planning files from this checkout. Instead: `git fetch origin`; `git merge --no-ff --no-commit origin/redesign`; the merge reported four modify/delete conflicts, all inside `.planning` (`REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `state.json`); `git checkout HEAD -- .planning` resolved them in favour of HEAD; `git diff HEAD --stat -- .planning` was empty; nothing outside `.planning` conflicted; then the commit. The unrelated uncommitted edits to `docs/superpowers/gsd-records/state.json` (a one-line "Phase 3 of 4" reason and timestamp) were saved to the session scratchpad before the checkout and written back after the commit, so they are still uncommitted and unstaged, as is `.impeccable/config.json`.
2. **[Plan check] Task 1 says "run the client type-check and unit tests" and Task 2's `git status --porcelain -- client e2e docs` must be empty.** Both hold. No source, test or doc file changed; the merge staged no file outside `.planning`.
3. **[Scope] `requirements mark-complete` was not run for WAVG-06**, because G3 is not delivered yet (the plan's frontmatter lists the requirement, but its output is a record, not the screens).

Otherwise the plan ran as written. No auth gate occurred.

## Issues Encountered

- The first merge attempt printed modify/delete conflicts for four `.planning` files (expected given the instruction); resolved as Deviation 1 describes.
- `gh pr view 278 --comments` shows only a Vercel preview comment and Codex's "usage limit" notice.

## Known Stubs

None. This plan wrote no code.

## Threat Flags

None. T-03-25 (G3 plans vs merged tree) is mitigated by the reconcile line above; T-03-SC accepted, no package added.

## Next Phase Readiness

G3 can start. 03-17, 03-18, 03-19, 03-20, 03-21 and 03-22 are independent of each other (shared e2e ports, so one browser run at a time); 03-25 waits for 03-22 (`switchers.spec.ts` line 46 first); 03-23, the G3 PR, comes last. Every G3 plan's precondition reads `G3 reconcile: match` in this file.

## Self-Check: PASSED

- `91bc93e9` is an ancestor of HEAD, and `git merge-base --is-ancestor origin/redesign HEAD` exits 0.
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-16-SUMMARY.md` exists with one `G3 reconcile:` line and one `WAVG-06 export:` line.
- `git status --porcelain -- client e2e docs` prints nothing.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-20_
