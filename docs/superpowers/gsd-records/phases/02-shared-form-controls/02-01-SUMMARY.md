---
phase: 02-shared-form-controls
plan: 01
subsystem: ui
tags: [audit, form-controls, wave-g, documentation]

requires: []
provides:
  - "docs/ui/FORM-CONTROLS-AUDIT.md: header, Summary, Every control (every raw select in client/src; every raw field and control-component use in the everyday money areas), Components today, Not a control"
affects: [02-02, phase-3-screens, phase-4-guard]

actuals:
  tokens: 44850
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Audit rows are generated from a syntax-tree scan kept outside the repository; meanings (Chooses, Becomes) are read from the code per row"

key-files:
  created:
    - docs/ui/FORM-CONTROLS-AUDIT.md
  modified: []

key-decisions:
  - "Scanner parses with TypeScript 6 from lint/node_modules: the client's TypeScript 7 has no JavaScript compiler API"
  - "Hand-parsed money text fields are 'owner to decide' (Input as today, or CurrencyInput), not silently classed"
  - "The 20 selects outside this plan's areas sit in per-folder tables marked for plan 02-02 to complete"
  - "e2e cross-reference is role-aware; names built from expressions match by static prefix and say so, and ambiguous prefixes were checked by hand"

patterns-established:
  - "Row key: `client/src/<path>.tsx:<line>` of the element's opening `<`, which the coverage gates grep"

requirements-completed: []

coverage:
  - id: D1
    description: "Every raw <select> in client/src has an audit row"
    requirement: WAVG-01
    verification:
      - kind: other
        ref: "plan 02-01 Task 1 gate: grep of '<select\\b' places vs backticked rows → missing=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every raw <select>, <textarea>, <input> in the everyday money areas has a row"
    requirement: WAVG-01
    verification:
      - kind: other
        ref: "plan 02-01 Task 2 gate → missing=0 (121 places)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every use of the sixteen control components in those areas has a row, and Components today has an entry for each"
    requirement: WAVG-01
    verification:
      - kind: other
        ref: "plan 02-01 Task 3 gate → missing=0 (63 places); source guard vs origin/redesign → clean; prettier --check → pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each list is classified Select or Combobox under D-06 (or flagged for the owner), read by the owner before the set PR"
    requirement: WAVG-01
    verification: []
    human_judgment: true
    rationale: "D-10: the owner reads the audit and says go before the set PR; classifications are judgment calls"

duration: 20min
completed: 2026-11-17
status: complete
---

# Phase 2 Plan 01: Form controls audit (everyday money areas) Summary

**`docs/ui/FORM-CONTROLS-AUDIT.md` now has 204 rows. They cover all 51 raw selects in `client/src`
and all 184 controls in the everyday money areas, each with what it chooses, today's element, its
states, its accessible name, its e2e selectors, what it becomes under D-05 and D-06, and the phase
that moves it.**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-11-17T17:33+11:00
- **Tasks:** 3
- **Files modified:** 1 (`docs/ui/FORM-CONTROLS-AUDIT.md`)

## Accomplishments

- Syntax-tree scanner (throwaway, in the session scratchpad, never committed) over 310 non-test
  `.tsx` files. It found 518 control elements, which match the grep places one for one: 233 raw and
  285 component places. No match is in a comment or string, and no line holds two controls, so
  "Not a control" is empty at this commit.
- One table per area, sorted by path and then line. Areas: Transactions, Accounts, Budget, Payees,
  Rules, Recurring, Shared ui folder, Layout, plus per-folder tables for the 20 selects outside
  this plan's areas.
- `## Components today` has one entry for each of the 16 components: what it renders, the props
  that matter, keyboard and focus behaviour, and its use counts.
- The audit was taken at `6520896`, the last `client/src` commit (`git log -1 --format=%h -- client/src`).

## Scanner element counts per kind

All of `client/src` / this plan's areas:

| Kind | All | Areas |
| --- | --: | --: |
| select | 51 | 31 |
| textarea | 5 | 2 |
| input text | 32 | 20 |
| input, no type | 32 | 20 |
| input checkbox | 64 | 28 |
| input radio | 10 | 3 |
| input date | 11 | 7 |
| input month | 1 | 0 |
| input number | 3 | 3 |
| input password | 8 | 0 |
| input search | 3 | 2 |
| input file | 10 | 4 |
| input url | 1 | 0 |
| input range | 1 | 1 |
| input email | 0 | 0 |
| input, type from an expression | 1 | 0 |
| Input | 124 | 17 |
| Select | 80 | 12 |
| CurrencyInput | 41 | 10 |
| Switch | 1 | 0 |
| DatePicker | 1 | 0 |
| MonthRangePicker | 3 | 0 |
| SegmentedControl | 3 | 0 |
| Slider | 1 | 0 |
| CategoryPicker | 7 | 5 |
| PayeeCombobox | 2 | 2 |
| CategorySelect | 7 | 4 |
| CategorySelectButton | 5 | 5 |
| MerchantSelect | 3 | 3 |
| OptionPicker | 2 | 2 |
| IconPickerPopover | 2 | 0 |
| DefaultCategoryButton | 3 | 3 |
| **Total** | 518 | 184 |

## Rows marked "owner to decide" (16)

- Hand-parsed money text fields: should they become CurrencyInput or stay Input? 11 rows:
  `TransactionFormRow.tsx:312` (Outflow), `:331` (Inflow), `:407` (split amount);
  `TransactionFilters.tsx:255` (amount bound); `BudgetAmountSheet.tsx:116`;
  `CardPayments.tsx:138`, `:214`; `MoneyMoves.tsx:222`; `PaydayPlan.tsx:40` (`MoneyInput`);
  `TargetCard.tsx:98`; `pages/Budget.tsx:121` (`AmountInput`).
- `SplitTransactionModal.tsx:187`: one field holds an amount or a percent, depending on the mode.
- `BulkEditModal.tsx:249`: bulk payee is free text today. PayeeCombobox under D-05 would change
  what can be typed.
- `ImportCategories.tsx:143`: CategoryPicker under D-05, but the list also has "none" and "create
  new" options that CategoryPicker lacks.
- `RuleEditorModal.tsx:364`: the rule tag-list input holds free-text values, not an app list.
- `settings/TagManager.tsx:53`: the colour select is a fixed list, but it sits invisibly over a
  swatch. A colour grid may fit better than a Select.

## What the code showed against 02-RESEARCH.md

- The raw and component counts agree exactly (51/5/177; Input 124, Select 80, CurrencyInput 41
  and so on). The syntax tree also confirms that none of the grep places is a comment or a string.
- Research says `CategorySelect` has "5 callers"; the code has 7 uses in 6 files. It says
  `CategorySelectButton` has "4 callers"; the code has 5 uses in 4 files. It says `MerchantSelect`
  has "2 callers"; the code has 3 uses.
- Pitfall 1 counts 5 tests using `getByRole('textbox', { name: 'Payee' })`. The specs have 11 such
  lines in 8 files. Some of them may reach MerchantSelect, which RecurringFormModal labels "Payee".
- Pitfall 2 says Enter forbids "Uncategorised" on an empty query. The code (`CategoryPicker.tsx:150`)
  picks on Enter only when a row is active (`activeIndex >= 0`). That has the same effect, but
  nothing special-cases "Uncategorised".
- The method assumed the TypeScript compiler API in `client/node_modules/typescript`. That package
  is TypeScript 7.0.2, which has no JavaScript API, so the scanner used TypeScript 6 from
  `lint/node_modules` (installed with `npm ci --ignore-scripts`; gitignored).
- Found along the way, not in the research: these controls have no accessible name.
  - `RuleEditorModal.tsx:269` and `:554`: CurrencyInput.
  - `RuleEditorModal.tsx:419`: MerchantSelect.
  - `RuleEditorModal.tsx:257`, `UpcomingLengthModal.tsx:57` and `:88`, `CategoryPicker.tsx:275`,
    `plaid/ConnectBankModal.tsx:309` and `simplefin/SimplefinConnectModal.tsx:336`: selects.
  - Several placeholder-only text fields, such as `pages/Payees.tsx:171`, `pages/Rules.tsx:294` and
    `recurring/AllTab.tsx:325`.
- Nothing in this plan's areas uses `Switch`, `DatePicker`, `MonthRangePicker`, `SegmentedControl`,
  `Slider` or `IconPickerPopover`. Their users are all in plan 02-02's areas.

## Task Commits

1. **Task 1: every raw select has its audit row** - `bcbf000` (docs)
2. **Task 2: raw fields of the everyday money screens** - `37063e8` (docs)
3. **Task 3: shared and hand-rolled controls of those screens** - `5acd0b7` (docs)

## Files Created/Modified

- `docs/ui/FORM-CONTROLS-AUDIT.md`: the G0 audit document (only file committed by the tasks)

## Decisions Made

- The ImportModal and YnabImportModal rows are filed under Transactions, where the plan's path
  pattern puts them, but they move in Phase 3 G3 (import dialog). The roadmap puts import and export
  dialogs in G3.
- Internals of components the set PR rewires (`CategoryPicker.tsx:195/275/310`,
  `PayeeCombobox.tsx:66`, `DatePicker.tsx:72`, `Input.tsx:11`) move in "Phase 2 (set PR)".
  `Input.tsx:25` (the native Select wrapper) is removed in Phase 4 under WAVG-10.
- `CurrencySelect` (about 150 currencies) is a Select: D-06 decides by the kind of list, not its
  length.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 7 has no compiler API**
- **Found during:** Task 1
- **Issue:** `client/node_modules/typescript` is 7.0.2 (a native binary), with no `createSourceFile`.
- **Fix:** Installed `lint/` from its lockfile (`npm ci --ignore-scripts`) and used its TypeScript
  6. No package or lockfile changed.
- **Verification:** The scanner's element counts match the grep places one for one.

**Total deviations:** 1 auto-fixed (blocking). **Impact on plan:** none on scope.

## Issues Encountered

- The first e2e cross-reference matched names regardless of role and gave false positives, such as
  the transaction form's `Category` combobox. Matching is now role-aware. Ambiguous prefix matches
  (`ImportCategories:143`, the Up mappings, `CurrencyDifference:83`) were checked by hand. Rows say
  when a match is by name prefix, or when the same name also exists on other screens.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02-02 can reuse the scanner approach (stage 3 covers this plan's areas). It needs to add
  rows for the remaining areas, the cross-cutting sections, the D-11 MonthRangePicker note and the
  screenshots. The 20 out-of-area selects already have rows in per-folder tables.
- The owner should read the 16 "owner to decide" rows before the set PR (D-10).

## Self-Check: PASSED

- FOUND: docs/ui/FORM-CONTROLS-AUDIT.md
- FOUND: bcbf000, 37063e8, 5acd0b7 (ancestors of HEAD)
- Gates: select missing=0; area raw missing=0; area components missing=0; source guard clean;
  Prettier check passed
- No STATE.md or ROADMAP.md change; no scanner or data file in the checkout

---
*Phase: 02-shared-form-controls*
*Completed: 2026-11-17*
