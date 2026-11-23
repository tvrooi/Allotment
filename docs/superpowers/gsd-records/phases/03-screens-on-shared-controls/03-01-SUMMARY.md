---
phase: 03-screens-on-shared-controls
plan: 01
subsystem: ui
tags: [audit, reconcile, owner-answers, wave-g, planning-record]

requires: [02-shared-form-controls]
provides:
  - "The D-16 reconciliation record (`Reconcile:` line) that every later G2 plan's precondition reads"
  - "The owner's answers as the record lines 03-03 (`MonthRangePicker phone:`) and 03-16 (`Export dialogs:`) read"
affects:
  [
    03-02,
    03-03,
    03-04,
    03-05,
    03-06,
    03-07,
    03-08,
    03-09,
    03-10,
    03-11,
    03-12,
    03-13,
    03-14,
    03-15,
    03-16,
    03-23,
    03-24,
  ]

plan_head_before: b8c72845e62387bfd396d87be49329bf26dedafa

key-decisions:
  - 'Reconcile: match. No Wave G decision changed after the audit beyond the recorded go-with-changes (D-11) and Phase 2 D-12'
  - "Audit classification is binding over a plan's wording (D-16): TransactionMarks.tsx:156 tag find-or-create box is a Combobox with create, not the plain Input 03-24 Task 2 names"
  - 'Owner answers 19 Nov 2026: MonthRangePicker phone: short; Welcome switch rows: accept; Export dialogs: phase-4'
  - 'Shipped DatePicker has no size prop; 03-07, 03-13 and 03-24 ask for DatePicker at sm, which needs an additive `fieldSize` on DatePicker first'

requirements-completed: []

actuals:
  tasks: 2
  commits: 2
---

# Plan 03-01 summary: D-16 reconciliation and the owner's answers

Reconcile: match

Checked on 19 November 2026. The worktree was at `b8c72845`, whose `client/`, `e2e/` and `docs/`
match `origin/redesign` `caf15032` (the squash of #277). The precondition printed `set-merged`.
Sources: `docs/ui/FORM-CONTROLS-AUDIT.md` (taken at `6520896`), `02-03-SUMMARY.md`,
`02-CONTEXT.md` D-12, the shipped `client/src/components/ui/` controls, `e2e/tests/fixtures.ts`,
and plans 03-02 to 03-15 and 03-24 (their `files_modified` and the control each one names).

`match` means what D-16 makes it mean: no Wave G decision changed after the audit apart from the
recorded go-with-changes (D-11, MonthRangePicker rebuilt in Phase 2) and Phase 2 D-12. Where a plan
and the audit differ, the audit wins on classification. Each such case is listed below as binding.
Neither of the two findings in "Binding for later plans" is a changed owner decision, so neither
halts the phase.

## Binding for later plans

1. **TransactionMarks.tsx:156 (03-24 Task 2).** The audit says this row is "part of the tag picker:
   Combobox (tags are a user-grown list), with create". 03-24 Task 2 says "New tag: the shared Input".
   The audit's classification binds (D-16): the tag picker's find-or-create box becomes the shared
   Combobox with `allowsCustomValue` and a create footer, keeping the aria-label "Find or create a
   tag", Enter-to-create and `maxLength` 60. The Reviewed and Hide-from-reports checkboxes
   (`:234`, `:248`) stay Checkbox as 03-24 says.
2. **DatePicker at sm (03-07, 03-13, 03-24; 03-21 in G3).** These plans place DatePicker at the sm
   size. The shipped `DatePicker` has no `fieldSize` prop: `pickerGroupClass` fixes `h-10`, and
   `className` reaches only the outer wrapper. 03-03 splits `pickerGroupClass` into named parts,
   including a size part, but adds no prop. No G2 plan lists `DatePicker.tsx` in `files_modified`
   for this. The plan that first needs it (03-07) must add an additive `fieldSize?: 'md' | 'sm'`
   to DatePicker first, with a gallery state. Better still, the orchestrator folds it into 03-02
   or 03-03 before 03-07 runs. This is a missing variant, not a decision change.
3. **Select's list prop is `options`, not `items`.** 03-01's API list says "Select (`items`, ...)".
   The shipped `Select` takes `options: readonly (SelectOption | SelectGroup)[]`; `Combobox` takes
   `items` with the same shapes. No G2 plan writes `items=` on a Select, so nothing breaks. Plans
   that say "the shared Select" mean `options`.
4. **Checkbox props** are `checked`, `onCheckedChange`, `isIndeterminate`, `disabled` and
   `readOnly` (not `isDisabled`). The plans name Checkbox states only in words, so this matches.

## The audit's classifications for the files plans name, recorded as binding

- `currency/CurrencySelect.tsx:45`: **Select** (a fixed list, `CURRENCY_CODES`; D-06 goes by kind,
  not length). 03-04 agrees.
- `budget/PaydayPlan.tsx:492`, the Payday list: **Select** (the paydays the plan computes; the owner
  does not grow it). 03-10 agrees.
- `transactions/ImportModal.tsx:700`, the Statement list: **Select** (the statements found in the
  file). This file is G3; 03-22 agrees.
- `receipts/ReceiptsTab.tsx:444`, the Model list: **Combobox** (grows with the models the local
  server reports). 03-14 agrees.

## G2 file reconciliation

"Target per audit" condenses the audit's Becomes column for every row in the file. "Agrees" compares
the plan's truths and actions with it.

| G2 file                                   | control kind                                   | target per audit                                                                                                                                                                                             | plan  | agrees                                                |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----------------------------------------------------- |
| `accounts/AccountTypeSelect.tsx`          | select                                         | `:21` Select (fixed groups)                                                                                                                                                                                  | 03-05 | yes                                                   |
| `accounts/AddAccountModal.tsx`            | text, money, checkbox                          | `:95` Input; `:154` CurrencyInput; `:166` Checkbox                                                                                                                                                           | 03-05 | yes                                                   |
| `accounts/EditAccountModal.tsx`           | file, text, money, checkbox                    | `:157` stays native (D-17); `:174` Input; `:221` CurrencyInput; `:232`, `:245` Checkbox                                                                                                                      | 03-05 | yes                                                   |
| `accounts/DeleteAccountModal.tsx`         | text                                           | `:84` Input                                                                                                                                                                                                  | 03-05 | yes                                                   |
| `pages/ReconcilePage.tsx`                 | money, checkbox                                | `:157` CurrencyInput; `:234`, `:281` Checkbox                                                                                                                                                                | 03-05 | yes                                                   |
| `pages/Payees.tsx`                        | radio, text, checkbox, category                | `:49` RadioGroup; `:171`, `:259`, `:358` Input; checkboxes Checkbox; `:292`, `:381` DefaultCategoryButton → CategoryPicker (already)                                                                         | 03-06 | yes                                                   |
| `pages/Rules.tsx`                         | text                                           | `:294` Input                                                                                                                                                                                                 | 03-06 | yes                                                   |
| `rules/ApplyRulesModal.tsx`               | checkbox                                       | `:132`, `:158` Checkbox                                                                                                                                                                                      | 03-06 | yes                                                   |
| `rules/OptionPicker.tsx`                  | text                                           | `:93` goes with OptionPicker, "Combobox (decide in Phase 3)"                                                                                                                                                 | 03-07 | yes: the audit leaves the form open; 03-07 decides it |
| `rules/RuleEditorModal.tsx`               | 9 selects, text, money, date, number, pickers  | fixed lists Select; `:438` tags, `:459` household Combobox; `:285` DatePicker; `:562` Input not money, 0–100 (D-14); `:412`, `:583` CategoryPicker; `:419` MerchantSelect; `:364` tag-list Input (owner row) | 03-07 | yes (DatePicker sm: see Binding 2)                    |
| `recurring/RecurringFormModal.tsx`        | selects, dates, number, pickers                | `:305`, `:443`, `:496` Select; `:325` accounts Combobox; `:349`, `:365` DatePicker; `:518` Input 0–14 (D-14); `:383` MerchantSelect; `:399` CategoryPicker; `:426` Checkbox                                  | 03-08 | yes                                                   |
| `recurring/UpcomingLengthModal.tsx`       | select, number                                 | `:57`, `:88` Select; `:81` Input, 1 or more (D-14)                                                                                                                                                           | 03-08 | yes                                                   |
| `recurring/AllTab.tsx`                    | text                                           | `:325` Input                                                                                                                                                                                                 | 03-08 | yes                                                   |
| `recurring/DiscoverSchedulesModal.tsx`    | checkbox                                       | `:99`, `:140` Checkbox                                                                                                                                                                                       | 03-08 | yes                                                   |
| `recurring/OccurrenceMatchModal.tsx`      | text                                           | `:76` Input                                                                                                                                                                                                  | 03-08 | yes                                                   |
| `pages/Budget.tsx`                        | money, checkbox, search                        | `:121` CurrencyInput (owner row); `:334` Checkbox; `:1148` Input                                                                                                                                             | 03-09 | yes                                                   |
| `pages/AnnualBudget.tsx`                  | select                                         | `:244` Select (months shown)                                                                                                                                                                                 | 03-09 | yes                                                   |
| `budget/AutoAssign.tsx`                   | radio, select                                  | `:129`, `:166` RadioGroup; `:144` Select                                                                                                                                                                     | 03-09 | yes                                                   |
| `budget/BudgetAmountSheet.tsx`            | money, checkbox                                | `:116` CurrencyInput (owner row); `:163` Checkbox                                                                                                                                                            | 03-09 | yes                                                   |
| `budget/CardPayments.tsx`                 | money                                          | `:138`, `:214` CurrencyInput (owner rows)                                                                                                                                                                    | 03-09 | yes                                                   |
| `budget/FundingRows.tsx`                  | checkbox                                       | `:35` Checkbox                                                                                                                                                                                               | 03-09 | yes                                                   |
| `budget/NoteField.tsx`                    | textarea                                       | `:55` Textarea                                                                                                                                                                                               | 03-09 | yes                                                   |
| `budget/MoneyMoves.tsx`                   | selects, money                                 | `:185`, `:203` CategoryPicker (with Ready to assign); `:222` CurrencyInput (owner row)                                                                                                                       | 03-10 | yes                                                   |
| `budget/TargetCard.tsx`                   | select, money, date, number                    | `:87` Select; `:98` CurrencyInput (owner row); `:103` DatePicker; `:114` Input 1–60 (D-14)                                                                                                                   | 03-10 | yes                                                   |
| `budget/PaydayPlan.tsx`                   | selects, money, dates, number, checkbox        | `:40` CurrencyInput (owner row); `:141`, `:204`, `:492` Select; `:189` CategoryPicker; `:856` plans Combobox; `:120`, `:234`, `:513` DatePicker; `:245` Input 0–100 (D-14); `:559`, `:874` Checkbox          | 03-10 | yes                                                   |
| `settings/CategoryManager.tsx`            | text, icon grid                                | Input; `:284` IconPickerPopover stays                                                                                                                                                                        | 03-11 | yes (audit says G4; moves in G2 by D-13, see note)    |
| `settings/EditCategoryModal.tsx`          | text, selects, radio, checkbox, icon grid      | `:136` Input; `:154` groups, `:213`, `:239` accounts Combobox; `:190` RadioGroup; `:260` Checkbox; `:128` IconPickerPopover stays                                                                            | 03-11 | yes (as above)                                        |
| `settings/DeleteCategoryModal.tsx`        | select                                         | `:60` CategoryPicker                                                                                                                                                                                         | 03-11 | yes (as above)                                        |
| `transactions/AddTransactionModal.tsx`    | money, payee, date, category, text             | CurrencyInput kept; `:299` MerchantSelect; `:315` DatePicker; `:462` CategoryPicker; `:479` Input                                                                                                            | 03-12 | yes                                                   |
| `transactions/BulkDeleteModal.tsx`        | text                                           | `:124` Input                                                                                                                                                                                                 | 03-12 | yes                                                   |
| `transactions/BulkEditModal.tsx`          | selects, category, text                        | `:141`, `:217`, `:268` Select; `:234` CategoryPicker; `:249` Input (owner row, first answer); `:288` Input                                                                                                   | 03-12 | yes                                                   |
| `transactions/SplitTransactionModal.tsx`  | category, money-or-percent, text               | `:178` CategoryPicker; `:187` CurrencyInput in amount mode, Input in percent mode (owner row); `:210` Input                                                                                                  | 03-12 | yes                                                   |
| `transactions/TransferSuggestions.tsx`    | checkbox                                       | `:246` Checkbox                                                                                                                                                                                              | 03-12 | yes                                                   |
| `transactions/TransactionTable.tsx`       | checkbox                                       | `:353` Checkbox                                                                                                                                                                                              | 03-12 | yes                                                   |
| `transactions/TransactionFormRow.tsx`     | date, payee, category, text, money             | `:251` DatePicker; `:264` PayeeCombobox; `:280`, `:390` CategoryPicker; `:295`, `:399` Input; `:312`, `:331`, `:407` CurrencyInput (owner rows)                                                              | 03-13 | yes (DatePicker sm: see Binding 2)                    |
| `transactions/TransactionDetailPanel.tsx` | date, category, payee, textarea                | `:370` DatePicker; `:483` CategoryPicker; `:528` PayeeCombobox; `:546` Textarea                                                                                                                              | 03-13 | yes (lines now 373, 486, 531, 549)                    |
| `transactions/PayeeCombobox.tsx`          | text                                           | `:66` became its Combobox input in Phase 2                                                                                                                                                                   | 03-13 | yes (rebuilt on Combobox in #277)                     |
| `receipts/ReceiptEditor.tsx`              | merchant, date, money, category, text, account | `:194` Input (owner row: merchant text stays Input); `:202` DatePicker; CurrencyInput kept; `:259` CategoryPicker; `:554` accounts Combobox                                                                  | 03-14 | yes                                                   |
| `receipts/ReceiptsTab.tsx`                | file, checkbox, selects, password, text        | `:72` stays native (D-17); `:231`, `:478` Checkbox; `:330` Select; `:364` Input password; `:399`, `:415` Input; `:444` Model Combobox                                                                        | 03-14 | yes                                                   |
| `transactions/TransactionFilters.tsx`     | search, checkbox, money, text, date            | `:178` Input (CheckList find box, owner row); checkboxes Checkbox; `:255` CurrencyInput (owner row); `:385` Input; `:453`, `:462` DatePicker                                                                 | 03-24 | yes (DatePicker sm: see Binding 2)                    |
| `transactions/TransactionMarks.tsx`       | tag find-or-create, checkbox                   | `:156` Combobox with create (tag picker); `:234`, `:248` Checkbox                                                                                                                                            | 03-24 | **no: audit binds `:156` to Combobox** (Binding 1)    |
| `transactions/MerchantSelect.tsx`         | text                                           | `:78` goes with MerchantSelect to Combobox                                                                                                                                                                   | 03-04 | yes                                                   |
| `transactions/CategoryPicker.tsx`         | text, select                                   | rebuilt in Phase 2 (`:195` Autocomplete field, `:275` groups, `:310` Input)                                                                                                                                  | 03-04 | yes (now `:223` Select, `:246` Input after #277)      |
| `transactions/CategorySelectButton.tsx`   | picker                                         | `:70` CategoryPicker                                                                                                                                                                                         | 03-04 | yes                                                   |
| `currency/CurrencySelect.tsx`             | select                                         | `:45` Select (fixed list)                                                                                                                                                                                    | 03-04 | yes                                                   |
| `currency/CurrencyDifference.tsx`         | select                                         | `:83` CategoryPicker                                                                                                                                                                                         | 03-04 | yes                                                   |

03-02, 03-03 and 03-15 touch no G2 screen file. 03-02 and 03-03 add to the shared set (NumberField,
CurrencyInput `fieldSize`/`expression`/`commitOnBlur`, the picker class parts, MonthRangePicker),
and 03-15 is the cross-screen spec, the docs and the PR.

**Moves-in notes (not mismatches).** The audit's "Moves in" column files `settings/CategoryManager`,
`EditCategoryModal` and `DeleteCategoryModal` under Phase 4 (G4), and `receipts/ReceiptEditor` and
`ReceiptsTab` under Phase 3 (G3). They move in G2 by D-13: `pages/BudgetCategories.tsx` renders
`CategoryManager` (03-11), and `pages/Transactions.tsx` opens the receipt dialogs (03-14). D-13 is
the owner's decision of 16 November 2026. It predates the audit and only changes which PR moves
these files, not what they become.

## Recount

Both recount commands from the audit's "Recount" section were re-run at `b8c72845` (last client
change `aa664cdd`). Together they print 584 places, against 518 audit rows at `6520896`. The extra
places come from the controls and gallery Phase 2 added under `components/ui/` and
`pages/devGallery/`. In the G2 files the plans name, the only element lines that moved are:

- `transactions/TransactionDetailPanel.tsx`: 370, 483, 528, 546 are now 373, 486, 531, 549 (+3).
- `transactions/PayeeCombobox.tsx` and `transactions/CategoryPicker.tsx`: rebuilt on the shared
  Combobox in #277, as the audit's "Phase 2 (set PR)" rows planned. CategoryPicker now has a shared
  `Select` (`:223`) and `Input` (`:246`), and PayeeCombobox has no raw element.

Line drift alone is not a mismatch.

## Owner decisions after the audit that bind Phase 3

- **The 36 "owner to decide" rows** (02-03-SUMMARY.md, owner gate `go-with-changes`, 17 Nov 2026)
  take the audit's recommendations. Money fields become CurrencyInput, merchant text fields stay
  Input, and money-or-percent fields use CurrencyInput in amount mode and Input in percent or
  weight mode. The other rows take the audit's first answer: the bulk-edit payee name stays Input;
  the import category mapping is CategoryPicker with the deferred "create new" kept; the CheckList
  find box is Input; the rule tag-list typing box is Input.
- **MonthRangePicker was rebuilt in Phase 2** (D-11 changed, 02-14) on MonthPicker's grid, with
  native From and To month fields on phones. Phase 3 does not rebuild it. 03-03 only applies the
  owner's display answer below.
- **Phase 2 D-12:** Escape with a combobox list open closes only the list, never the enclosing
  dialog or sheet (for PayeeCombobox an owner-approved change, 17 Nov 2026).

## Stays native in G2 (D-17)

These keep their native file inputs:

- `client/src/components/accounts/EditAccountModal.tsx` (`:157`, the account logo)
- `client/src/components/payees/PayeeIcon.tsx` (`:99`, the payee logo)
- `client/src/components/receipts/ReceiptsTab.tsx` (`:72`, the receipt photo)
- `client/src/components/tax/ReceiptsSection.tsx` (`:81`, rendered from `TransactionDetailPanel`)

ReceiptsTab and ReceiptEditor move in G2 because `pages/Transactions.tsx` opens them (D-13), even
though the audit's own heading files them under "G3: Receipts".

## Shipped APIs checked

- **Select:** `options` (flat `SelectOption` or headed `SelectGroup`), `value`, `onChange`,
  `fieldSize`, `name`, `isInvalid`, `isDisabled`, `isReadOnly`, `placeholder`, `description`,
  `errorMessage`. The list prop is `options`, not `items` (Binding 3).
- **Combobox:** `items`, `value`, `onChange`, `inputValue`, `onInputChange`, `allowsCustomValue`,
  `footer`, `emptyState`, `fieldSize`, `menuTrigger`, `filter`, `optional`. All present.
- **DatePicker:** `value`, `onChange`, `label`, `optional`, `minValue`, `maxValue`, `isDisabled`,
  `isInvalid`, `isReadOnly`, `className`. No `fieldSize` (Binding 2).
- **Input:** `fieldSize`, `isInvalid`, `forwardRef`. **Field:** `label`, `description`,
  `errorMessage`. **Checkbox:** `checked`, `onCheckedChange` (Binding 4). **RadioGroup** and
  **Radio**, **Textarea** (`forwardRef`), **CurrencyInput** (`value`, `onChange`, `currency`,
  `allowNegative`; 03-02 adds `fieldSize`, `expression`, `commitOnBlur`).
- **e2e/tests/fixtures.ts:** `chooseOption` (`:218`), `categoryOption` (`:236`), `fillDate`
  (`:280`), `fillMonth` (`:311`).

## Assumptions carried into the G2 plans (unresolved edges, WAVG-05)

- **Caps:** a value exactly at a converted field's cap is accepted, and one past it is refused:
  TargetCard 1 and 60, PaydayPlan 0 and 100, rule split 0 and 100, date flexibility 0 and 14,
  Upcoming count 1.
- **Empty:** a cleared required number field is invalid and keeps Save unavailable. A list with no
  options shows the control's empty line. A single option is never chosen automatically.
- **Ordering:** a moved list keeps the option order and groups its source gives. Two options with
  the same label are both shown, and each is chosen by its value.

## The owner's answers (Task 2)

MonthRangePicker phone: short
Welcome switch rows: accept
Export dialogs: phase-4

The owner gave these in the orchestrator session (t4x) on 19 November 2026. They are recorded in
03-01-PLAN.md above Task 2 and were not asked again here. The owner's words:

- **Q1, MonthRangePicker on phones:** "Change dates to shorthand Nov, Sep, Oct etc." This is a
  third option, added to 03-03 after the question was asked: MonthRangePicker shows short month
  names ("Nov 2026") on phones and desktop, so the phone From and To fields show the whole month at
  390 px. The fields are not stacked, and the clip is not accepted. 03-03 reads
  `MonthRangePicker phone: short`.
- **Q2, Welcome feature rows (R2-IN-01):** "accept". The shared toggle label style from Phase 2's
  Switch restyle stands (D-03 consistency). Nothing is restored when Welcome moves in Phase 4, so
  STATE.md gains no Pending Todo.
- **Q3, WAVG-06 export scope:** "leave export yes", the planner's position. No export dialog
  exists, because every export is a direct download button. `settings/DataExport.tsx` is a Settings
  tab whose two date fields the audit files under G4: Settings, so it moves with Settings in
  Phase 4. G3 moves the import dialogs only. 03-16 reads `Export dialogs: phase-4` to record
  WAVG-06's export scope as closed by this answer.

Carried to: `02-UAT.md` tests 3 and 4 are now `result: pass`, each with a `source:` line naming the
answer, the date and this file. The Summary there reads passed 3, pending 2, and `updated:` is
19 Nov 2026. `STATE.md` is unchanged, because the Q2 answer is `accept`.

## Phase 2 UAT still pending

02-UAT tests 1 (a VoiceOver pass over the controls) and 2 (the native pickers on a real iPhone) stay
pending and stay with the owner. Neither can be checked by an agent. 03-VALIDATION.md's Manual-Only
rows repeat both checks on each moved screen. 03-15 (the G2 PR) and 03-23 (the G3 PR) list them
under "Findings for the owner" in their PR bodies.

## Task record

| Task                   | Result                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| 1. D-16 reconciliation | `Reconcile: match`, with four binding notes for later plans (commit `fd737dfe`)         |
| 2. Owner answers       | Q1 short, Q2 accept, Q3 phase-4 recorded; 02-UAT tests 3 and 4 pass; STATE.md unchanged |

## Deviations from Plan

- **Q1 answer outside the original two options.** The owner chose short month names, not stack or
  accept. 03-01-PLAN.md and 03-03-PLAN.md were amended by the orchestrator (`b8c72845`) to allow
  `MonthRangePicker phone: short`. This plan records it as given.
- **Task 2 was not asked here.** The owner had already answered in the orchestrator session, and
  the orchestrator told this run to record the answers without asking again.
- **Not done by this plan:** the plan files are left as written (prohibition: no plan or source
  edits). Bindings 1 and 2 above are for the orchestrator to carry into 03-24, and into
  03-02/03-03 or 03-07, before those plans run.

## Threat Flags

None. This plan reads files and records text (T-03-01 mitigated by the `Reconcile:` gate).

## Self-Check: PASSED

- `grep -cE '^Reconcile: (match|revise)$'` on this file prints 1.
- `grep -cE '^(MonthRangePicker phone: (short|stack|accept)|Welcome switch rows: (accept|restore-in-phase-4)|Export dialogs: (phase-4|move-in-g3))$'` prints 3.
- `grep -c 'result: \[pending\]' 02-UAT.md` prints 2 (tests 1 and 2).
- The Q2 check prints 1 (`Welcome switch rows: accept`); STATE.md has no change.
- `git status --porcelain -- client e2e docs` prints nothing.
- The summary names CurrencySelect.tsx with Select, PaydayPlan.tsx Payday with Select and
  ReceiptsTab.tsx Model with Combobox, and lists the four G2 file inputs by path.
