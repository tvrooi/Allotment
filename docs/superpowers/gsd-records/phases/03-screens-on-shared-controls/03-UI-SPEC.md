---
phase: "03"
slug: "screens-on-shared-controls"
status: approved
reviewed_at: "2026-11-16"
shadcn_initialized: false
preset: none
created: "2026-11-16"
---

# Phase 03 — UI Design Contract

> Visual and interaction contract for Phase 03: Screens on shared controls (Wave G G2–G3). Consumes `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md` (D-01 through D-17), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` (D-01 through D-11), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (inherited without change), `docs/superpowers/gsd-records/REQUIREMENTS.md` (WAVG-05, WAVG-06, WAVG-08), `DESIGN.md`, `docs/BRAND.md`, `docs/ui/MAP.md`, and `client/src/index.css`.
>
> **Provenance note:** Phase 1 (Wave F) Accounts and Budget files live in `/Users/tristanvanrooyen/wt-f/client/src` (branch `wave-f`) until PR #273 merges to `redesign`. All other files were inspected in this worktree (`7e552a7`). Phase 3 executes after PR #273 and Phase 2's shared control set PR merge to `redesign`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (`components.json` absent; inherits `02-UI-SPEC.md`, D-01, D-02) |
| Preset | not applicable |
| Component library | `react-aria-components` (`1.22.1`, lockfile-verified in `client/package-lock.json`; consumed only via `client/src/components/ui/`, never imported directly by Phase 3 screens per D-01) |
| Icon library | `lucide-react` (`1.55.0`) |
| Font | `Inter, ui-sans-serif, system-ui, sans-serif` (`@fontsource/inter`, weights `400` and `500` inherited from `02-UI-SPEC.md`) |

---

## Component Inventory

Enumerated by `ls client/src/components/ui/*.tsx | wc -l` — 33 components — flybudget@0.2.0-up.174 (commit `7e552a7`; Phase 2 adds 8 shared controls over `react-aria-components@1.22.1`) — 2026-11-16.

> Non-exhaustive inventory inherited from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md`. Phase 3 screens consume the 11 Phase 2 shared form controls, the two rewired picker wrappers, and existing untouched shared primitives; screens do not import `react-aria-components` directly (D-01) and do not introduce any new utility/CSS package (D-02).

| Component | Import path | Phase 3 Usage |
|-----------|-------------|---------------|
| `Field`, `Label` | `client/src/components/ui/Field.tsx`, `Label.tsx` | Vertical `gap-1` field stack (`Label`, control, help, `FieldError`); `Label elementType="span"` on `Select`, `DatePicker`, `RadioGroup` so `strayLabels` stays empty |
| `Input`, `Textarea` | `client/src/components/ui/Input.tsx`, `Textarea.tsx` | All text, search, password, URL, `inputMode="decimal"`/`"numeric"` non-`CurrencyInput` inputs, D-14 ex-`type="number"` inputs, and multiline textareas (`md` `h-10` default, `sm` `h-8` compact) |
| `Select`, `Combobox` | `client/src/components/ui/Select.tsx`, `Combobox.tsx` | Fixed lists (`Select`, with grouped `ListBoxSection` support where incumbent `<select>` uses `<optgroup>`) vs user-grown lists (`Combobox`), per D-05/D-06 and WAVG-01 audit confirmation (D-16) |
| `Checkbox`, `RadioGroup` | `client/src/components/ui/Checkbox.tsx`, `RadioGroup.tsx` | All checkboxes (labelled and standalone table/list toggles) and radio choices (inline and card-style) |
| `DatePicker` | `client/src/components/ui/DatePicker.tsx` | All `type="date"` inputs across G2 and G3 (D-07, D-08); native `<input type="date">` on phones (`< 768px`, D-04) |
| `Switch`, `MonthPicker` | `client/src/components/ui/Switch.tsx`, `MonthPicker.tsx` | Available from Phase 2 if surfaced; no `type="month"` exists in G2/G3 (`BudgetStartSettings` is Phase 4) |
| `CategoryPicker`, `PayeeCombobox` | `client/src/components/transactions/CategoryPicker.tsx`, `PayeeCombobox.tsx` | Category selection (`CategoryPicker` replaces `CategorySelect` on G2/G3 screens per D-05) and free-text payee entry (`PayeeCombobox`) |
| `CurrencyInput`, `amountValidity` | `client/src/components/ui/CurrencyInput.tsx`, `amountValidity.tsx` | Money entry (`type="text" inputMode="decimal"`); kept untouched on every screen that already uses it (D-15) |
| `SegmentedControl`, `Slider`, `MonthRangePicker`, `IconPickerPopover` | `client/src/components/ui/` | Untouched neighbour controls (`03-CONTEXT.md` Claude's Discretion); `ExpectedNote.tsx` moves/aligns with Budget in G2 without behaviour change |

> **Phase 2 extension trigger (`03-CONTEXT.md` Claude's Discretion):** Where a Phase 3 screen requires a compact `sm` (`h-8`) `DatePicker` (filter bars, desktop `TransactionFormRow`, `RuleEditorModal` date rows) or grouped `Select` sections (`<optgroup>` parity for `AccountTypeSelect`, `FileDetailModal`, `ImportCategories`, `CurrencySelect`), extend the shared control in `client/src/components/ui/` (and its Phase 2 gallery specimen + screenshot) rather than styling around it on the screen. Legacy `Select` in `ui/Input.tsx` and `CategorySelect.tsx` remain exported until Phase 4 (`WAVG-10`) because Phase 4 screens still import them.

---

## Spacing Scale

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (multiples of 4 only: `4, 8, 16, 24, 32, 48, 64`, plus Phase 2 control exceptions `0px`, `12px`, `20px`, `32px` `sm`, `36px` `ListBoxItem`, `40px` `md`, `44px` phone touch targets, `80px` `Textarea` default `min-h-20`).

Phase 3 screen-migration exceptions (all multiples of 4, preserving incumbent screen density):
- `32px` (`h-8`, `size="sm"`): Compact desktop height (`>= 768px`) for fields sitting inside table rows (`TransactionFormRow` desktop, `Budget` inline planned cell, `Payees` inline rename, `CategoryManager` inline add/edit), import mapping grids (`ImportModal`, `YnabImportModal`, `ImportCategories`), rule builder rows (`RuleEditorModal`), filter bars (`TransactionFilters`, `Files`, `Rules`, `Payees`, `Budget` search), narrow sidebars (`ReportBuilderSidebar`), and desktop-only filter clear buttons (`md:h-8 md:w-8`).
- `40px` (`h-10`, `size="md"`): Default desktop height for fields inside modals, bottom-sheet editors, detail drawers (`TransactionDetailPanel`), and card/panel forms (`PaydayPlan`, `CashRunway`, `LongTermForecast`, `ReconcilePage`).
- `44px` (`max-md:min-h-11`, `max-md:min-w-11`): Mandatory minimum touch target on phones (`< 768px`) for every migrated control, including standalone table/list checkboxes (`TransactionTable`, `Payees`, `Rules`, `ReconcilePage`, `FundingRows`) and filter search clear buttons (`TransactionFilters`, `Budget` search).

---

## Typography

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (4 sizes — `12px` Helper/Meta, `14px` Label/Desktop Control, `16px` Body/Phone Control `max-md:text-base`, `28px`/`24px` Display — and 2 weights `400` / `500`).

Screen preservation notes:
- Existing page headers, section titles, table headers, and numeric summaries (`tabular-nums`) remain untouched; only form controls, field labels, help text, and field errors adopt the Phase 2 typography scale.
- Custom-formatted numeric/money `<Input>` fields (`Budget` planned cell, `BudgetAmountSheet`, `TransactionFormRow` Outflow/Inflow, `SplitTransactionModal`, `TransactionFilters` `AmountBound`, `CardPayments`, `MoneyMoves`, `TargetCard`, `PaydayPlan`, `UnitsInput`, `SaleModals`, `SplitModals`, `CashRunway`, `longterm/fields.tsx`) retain `text-right tabular-nums` via `className`.

---

## Color

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (`@theme` light / `.dark` dark tokens only: 60% `--color-page` / `--color-surface`, 30% `--color-surface-alt` / `--color-border` / `--color-border-light` / `--color-hover`, 10% `--color-brand-600` accent reserved for the Phase 2 focus/selection/inline-action list plus the two preserved screen uses listed next, and `--color-negative` for invalid/destructive states).

Phase 3 preserved screen accent uses (D-15; these exist today and are kept, not added):
1. Card-row radio selection in `EditCategoryModal` (`budgetType`) and the `Payees` merge modal (`keepId`): `border-brand-600 bg-brand-50` when selected (today `border-brand-500 bg-brand-50`).
2. The desktop `TransactionFormRow` container: `bg-brand-50 border-b border-brand-100`.

One-off color defects eliminated during Phase 3 migration (D-03):
1. Remove `ring-brand-400` (undefined in `@theme`) from `OptionPicker.tsx` (`:20`, `:98`) and `RuleEditorModal.tsx` (`:42`, `:346`) — replace with shared `Combobox` / `Input` `--color-brand-600` focus ring.
2. Remove `border-brand-500` / `ring-brand-500` one-offs on inputs/selects/card-radios (`AccountTypeSelect.tsx`, `EditAccountModal.tsx`, `AddAccountModal.tsx`, `CurrencySelect.tsx`, `EditCategoryModal.tsx`, `Payees.tsx`, `Budget.tsx` planned cell) — unify on `--color-brand-600` (`border-brand-600`, `ring-brand-600`).
3. Remove `placeholder-text-disabled` one-offs (`AddTransactionModal.tsx:33`, `MerchantSelect.tsx:8`, `TransactionFormRow.tsx:177-178`) — unify on `placeholder:text-text-tertiary` (`>= 4.5:1` contrast in light and dark).
4. Remove `opacity-60` / `read-only:opacity-60` disabled and read-only overrides (`NoteField.tsx:69`, `EditCategoryModal.tsx:161`, `RecurringFormModal.tsx:449`, `CurrencySelect.tsx:52`, `Budget.tsx:178`) — use the Phase 2 shared disabled (`bg-surface-alt text-text-disabled border-border-light`) and read-only (`bg-surface-alt/60 border-border text-text`) treatments.

---

## Copywriting Contract

Phase 3 makes **no behavioural or copy changes** (D-15) beyond fixing missing accessible names and replacing browser spin-button `type="number"` fields with Zod-bounded numeric validation per D-14.

| Element | Copy |
|---------|------|
| Primary CTA | Unchanged per screen (`Add`, `Save`, `Save rule`, `Apply`, `Preview`, `Import`, `Create`, `Merge`, etc.) — every screen keeps its existing button wording, `useCanSave()` gating, and `<SavingPausedHint />` |
| Empty state heading | Unchanged per screen (`EmptyState` copy, `"No categories found"` in `CategoryPicker`, `"No matches"` -> `"No matching options"` inside shared `Combobox` pickers) |
| Empty state body | Unchanged per screen (`"New payee: \"{query}\""` in `PayeeCombobox`; `"Create \"{query}\""` in `MerchantSelect` / `TagPicker`) |
| Error state (preserved non-D-14) | Existing server, form, and inline validation errors stay verbatim (`UNREADABLE_AMOUNT`, `NoteField` `"Saving…" / "Note saved." / "Note not saved. {error}"`, `Budget` `#planned-save-error` `"Not saved. {error}"`, `ImportModal` / `YnabImportModal` format warning banners, `RuleEditorModal` split total warning `"Percents add up to more than 100%."`). Required non-numeric migrated `Field` controls use `02-UI-SPEC.md` templates (`"Enter {subject} to continue"`, `"Select {subject} to continue"`). |
| Error state (new D-14 numeric states) | Shared actionable templates linked to the `Input` via `isInvalid` / `aria-invalid="true"` and `FieldError` / `aria-describedby` (`role="alert"`, `text-xs text-negative`), matching `longterm/fields.tsx`:<br>- **Bounded whole number** (`TargetCard` cycle `1..60`, `PaydayPlan` percent `0..100`, `RecurringFormModal` date flexibility `0..14`, `CashRunway` variable spending % `0..500` & income % `0..200`, `ImportModal` skip rows `0..max` where `max = Math.min(1000, Math.max(records.length - 1, 0))` and `max >= 1`): `"Enter a whole number from {min} to {max}."` (when `ImportModal` has `max === 0`: `"Enter 0 — this file has no rows above the header."`).<br>- **Lower-bounded whole number** (`UpcomingLengthModal` custom count `>= 1`): `"Enter a whole number of 1 or more."`<br>- **Optional whole year** (`EventEditor` `Last year`, blank saves `null`, else `1900..2300`): `"Enter a whole year between 1900 and 2300, or leave this blank."`<br>- **Decimal percentage** (`RuleEditorModal` split percent `0..100`, `CashRunway` goal growth % `-100..50`): `"Enter a percentage from {min}% to {max}%."` (e.g. `"Enter a percentage from 0% to 100%."`, `"Enter a percentage from -100% to 50%."`).<br>**Recovery & commit/save gating:** Keep the user's raw text draft while typing (never snap mid-keystroke with `Math.round` or `|| 0`), do not commit invalid drafts to state or parsed import rows, and disable/block the owning form's Save, Apply, or Preview action (`useReportAmountValidity` or form invalid guard) until the value is edited into valid bounds (or `Last year` is cleared to blank). |
| Destructive confirmation | Unchanged (`DeleteAccountModal` typed confirmation, `BulkDeleteModal` confirmation, `DeleteCategoryModal`, `ConfirmModal` dialogs keep exact wording) |

### Missing Accessible Names to Add During Migration (no visual copy change)
Controls that currently lack `<label>` or `aria-label` must receive an accessible name (`Label` or `aria-label`) matching their visible context (`CLAUDE.md` §Client):
- `UpcomingLengthModal.tsx:57,81,88`: `"Upcoming length"`, `"Custom length number"`, `"Custom length unit"`.
- `RuleEditorModal.tsx:257,326,426,562,589`: `"Direction"`, `"Match value"`, `"Notes text"`, `"Split percentage"`, `"Split notes"`.
- `ImportModal.tsx` & `YnabImportModal.tsx`: convert raw `<label><span>Label</span><select/input/></label>` wrappers to `Field` / `Label elementType="span"` so `Statement`, `Separator`, `Encoding`, `Rows above the header`, `Dates`, `Amounts`, `Word for money out`, `Date format`, and `Amount format` remain programmatically named on React Aria `Select` and `Input` without triggering `strayLabels`.

---

## Screen-Migration Contract (G2 and G3)

### 1. Phase 3 Scope & Delivery Split (D-12, D-13)

| PR | Area | Pages & Sub-pages | Component Folders & Dialogs |
|----|------|-------------------|-----------------------------|
| **G2 (WAVG-05)** | Transactions | `pages/Transactions.tsx` | `components/transactions/*` **except** `ImportModal.tsx`, `YnabImportModal.tsx`, `ImportCategories.tsx`, `ImportHistory.tsx` (G3); **includes** `AddTransactionModal.tsx`, `BulkEditModal.tsx`, `BulkDeleteModal.tsx`, `SplitTransactionModal.tsx`, `TransferSuggestions.tsx`, `TransactionFilters.tsx`, `TransactionFormRow.tsx`, `TransactionDetailPanel.tsx`, `TransactionMarks.tsx`, `TransactionTable.tsx`, `MerchantSelect.tsx`, `CategorySelectButton.tsx`; **plus** `components/receipts/ReceiptsTab.tsx`, `ReceiptEditor.tsx`; **plus** D-17 allowlist record for `components/tax/ReceiptsSection.tsx:81` (`type="file"` at `:83`, rendered by `TransactionDetailPanel.tsx:558`, while Tax's page stays in Phase 4) |
| **G2 (WAVG-05)** | Accounts | `wt-f/pages/Accounts.tsx`, `pages/AccountTransactions.tsx`, `pages/ReconcilePage.tsx` | `wt-f/components/accounts/*` **except** `ConnectedBanks.tsx` (Phase 4); `components/currency/CurrencySelect.tsx` (used by `AddAccountModal`, `EditAccountModal`, and G3 `InvestmentModals`; migrate in G2 so Accounts has zero raw `<select>`); `components/currency/CurrencyDifference.tsx` (`RecordModal` rendered by `AccountTransactions.tsx:79` per D-13) |
| **G2 (WAVG-05)** | Budget | `wt-f/pages/Budget.tsx`, `pages/AnnualBudget.tsx`, `pages/CategoryDetail.tsx`, `wt-f/pages/BudgetCategories.tsx` | `wt-f/components/budget/*` (including `ExpectedNote.tsx` trigger/popover check if needed), `wt-f/components/settings/CategoryManager.tsx`, `components/settings/EditCategoryModal.tsx`, `components/settings/DeleteCategoryModal.tsx` |
| **G2 (WAVG-05)** | Payees | `pages/Payees.tsx`, `pages/PayeeDetail.tsx` | `components/payees/*` |
| **G2 (WAVG-05)** | Rules | `pages/Rules.tsx` | `components/rules/*` (`RuleEditorModal.tsx`, `OptionPicker.tsx`, `ApplyRulesModal.tsx`) |
| **G2 (WAVG-05)** | Recurring | `pages/RecurringTransactions.tsx` | `components/recurring/*` |
| **G3 (WAVG-06)** | Goals | `pages/Goals.tsx` | `components/goals/*` |
| **G3 (WAVG-06)** | Forecast | `pages/Forecast.tsx` | `components/forecast/*`, `components/longterm/*` |
| **G3 (WAVG-06)** | Investments | `pages/Investments.tsx` | `components/investments/*` |
| **G3 (WAVG-06)** | Reports | `pages/Reports.tsx`, `pages/CustomReportBuilder.tsx`, `pages/ReportWidgetView.tsx` | `components/reports/*` (note: `MonthRangePicker` stays untouched per `03-CONTEXT.md`) |
| **G3 (WAVG-06)** | Files | `pages/Files.tsx` | `components/files/*` |
| **G3 (WAVG-06)** | Import & export dialogs | Opened from Account register, `DataExport`, `Welcome` | `components/transactions/ImportModal.tsx`, `YnabImportModal.tsx`, `ImportCategories.tsx` (no separate export dialog exists; CSV/ZIP exports are direct buttons/links, and `DataExport.tsx` is a Settings tab in Phase 4) |

> **Explicit exclusions (Phase 4):** `AccountConnections.tsx`, `ConnectedBanks.tsx`, `Settings.tsx` (`components/settings/*` other than `CategoryManager`, `EditCategoryModal`, `DeleteCategoryModal`), `Review.tsx`, `CashFlow.tsx`, `Household.tsx`, `Tax.tsx`, `PaymentPlans.tsx` (`NewPlanModal.tsx`, `PlanCard.tsx`), `Welcome.tsx`, `Dashboard.tsx`, `AuthGate.tsx`, `CommandPalette.tsx`, and removing `Select` from `ui/Input.tsx` / `CategorySelect.tsx` (`WAVG-10`).

---

### 2. Old-to-Shared Control Mapping & Sizing Matrix

> **Audit precedence (D-16):** At the start of G2 and G3, the planner/executor checks every list classification (`CategoryPicker` vs `Combobox` vs `Select`) and native allowlist entry below against the shipped WAVG-01 audit. Where the WAVG-01 audit classifies a list differently, the audit wins.

| Incumbent Control | Target Shared Control | Size | Behavioural & Edge Notes |
|-------------------|-----------------------|------|--------------------------|
| Raw `<input type="text \| search \| password \| url \| email">` and old `ui/Input` `<Input>` | Shared `ui/Input` | `md` (`h-10`) in modals/forms/panels; `sm` (`h-8`) in table rows, inline renames, rule rows, import tables, filter bars | Search inputs with left `Search` icon / right `X` clear button keep `pl-8` and `pr-8 max-md:pr-11` via `className`. `Budget` inline planned cell (`Budget.tsx:121`) uses `Input size="sm"` with `w-28 text-right tabular-nums`, preserving `Enter`/`Escape`/`ArrowUp`/`ArrowDown`/`Tab` cell movement and `onBlur` cancellation |
| Raw `<input inputMode="decimal \| numeric">` and old `<Input inputMode="...">` | Shared `ui/Input` (`type="text"` + existing `inputMode`) | `sm` in table/filter/split rows; `md` in modals/panels | Preserves custom parsers (`readAmountExpression`, `readTypedAmount`, `parseUnits`, `parseCents`) and `text-right tabular-nums` |
| `CurrencyInput` | `CurrencyInput` (unchanged) | Existing | Already upgraded in Phase 2 (`placeholder:text-text-tertiary`); remove any caller-supplied `className` overrides that duplicate `border`/`ring` (e.g. `RuleEditorModal.tsx:269`) |
| Raw `<textarea>` | Shared `ui/Textarea` | `rows` preserved per screen (`rows={3}` `resize-none` in `TransactionDetailPanel`; `rows={2}` `resize-y` in `NoteField`, `FileDetailModal`) | `NoteField` passes `isReadOnly={!canSave}` (shared read-only surface, no `opacity-60`) |
| Category pickers (`CategorySelect`, `CategorySelectButton`, and category `<select>`/`<Select>` fields): G2 `TransactionFormRow`, `SplitTransactionModal`, `BulkEditModal`, `ReceiptEditor`, `RuleEditorModal` (`set_category`, `split`), `PaydayPlan.tsx:189` (`Category`), `MoneyMoves.tsx:185,203` (`From`, `To`), `DeleteCategoryModal.tsx:60` (`Merge into`), `CurrencyDifference.tsx:83` (`Category`); G3 `GoalFormModal.tsx:156` (`Progress source`), `GoalStatusModal.tsx:134` (`Move to category`), `ImportCategories.tsx:143` (`In Allotment`), `FileDetailModal.tsx:162` (`kind === 'category'`) | `CategoryPicker` (or `CategorySelectButton` restyled to shared `Select`-trigger tokens over `CategoryPicker`, per D-05) | `sm` in `TransactionFormRow` desktop, `RuleEditorModal` split rows, `ImportCategories`; `md` in modals, `MoneyMoves`, `PaydayPlan`, `TransactionFormRow` phone sheet | Per D-05, categories always use `CategoryPicker`. Preserve each field's exact sentinel options, group filters, and labels: `"Uncategorised"` & `transferAccounts`; `CurrencyDifference` gain/loss income-vs-expense filtering & `"No category (net worth only)"`; `MoneyMoves` `"Ready to assign"` sentinel & available-balance option labels; `DeleteCategoryModal` `sourceIsIncome` filter, self-exclusion & `"Select a category..."`; `GoalFormModal.source` expense filter & `"Manual tracking"`; `GoalStatusModal` `"Keep it in {goal.categoryName ?? 'its category'}"` & available-balance labels; `ImportCategories` `"Uncategorised"` & `"Create \"{use.name}\" as new"`. Confirm in Task 1 (D-16) whether custom-sentinel category pickers extend `CategoryPicker` (`groups`/`noneLabel`/extra items) or use `Combobox` per WAVG-01. Leave `CategorySelect.tsx` on disk until Phase 4 (`NewPlanModal`, `PlanCard`) |
| `MerchantSelect` (`AddTransactionModal`, `RecurringFormModal`, `RuleEditorModal`) & single-select payee in `OptionPicker` | Shared `Combobox` (or `MerchantSelect` rewritten as a thin wrapper over `Combobox`) | `md` in `AddTransactionModal`, `RecurringFormModal`; `sm` in `RuleEditorModal` action row | Preserves `PayeeIcon`, sort-by-transaction-count, inline `"Create new payee"` (`useCreatePayee`) as a popover footer `<Button>`, offline `!canSave` wording, and clearing unconfirmed text on blur |
| User-grown entity `<select>` / `<Select>` / custom dropdowns (single-select per D-06): **Accounts / pools / loans** (`AddTransactionModal.tsx:330` on/off-budget sections + `<AccountIcon>` + `<Private>` + `"Cash (create)"` footer, `EditCategoryModal.tsx:213` `linkedAccountId` `"No account"` & `:239` `poolAccountId` `"The main Ready to assign"`, `ReceiptEditor.tsx:554` `Account`, `RecurringFormModal.tsx:325` `Account` `"No account"`, `GoalFormModal.tsx:224` `Linked account` `"None"`, `EventEditor.tsx:429` `Loan` `"Choose a loan"`, `SavingsPanel.tsx:169` `Add an account`, `InvestmentModals.tsx:360` `Account`, `YnabImportModal.tsx:386` `Allotment account` `"Create a new account"`, `FileDetailModal.tsx:178` `kind === 'account'`); **Category groups** (`EditCategoryModal.tsx:154` `groupId`, `ImportCategories.tsx:182` `Group` with existing groups + `"New group \"...\""`); **Other user-grown entities** (`RuleEditorModal.tsx:438,459` `Tag` & `Household`, `GoalStatusModal.tsx:113` `Replaced by` `"No replacement"`, `InvestmentModals.tsx:385` `Security`, `FileDetailModal.tsx:172,184` `kind === 'goal' \| 'asset'`, `LongTermForecast.tsx:505,786` `Plan` & `Compare with` `"No comparison"`, `CashRunway.tsx:1000` `Open saved scenario`, `PaydayPlan.tsx:856` `Plan`); **Provisional, classified by the WAVG-01 audit in Task 1 (D-16), because they are neither user-grown nor a fixed enum** (`PaydayPlan.tsx:492` `Payday` [dates computed from the plan], `ImportModal.tsx:700` `Statement` [taken from the file], `ReceiptsTab.tsx:444` `Model` [discovered from the local server]); **Provisional, fixed list** (`CurrencySelect.tsx:45` ~150 currencies `Common` + `All currencies`: a fixed ISO list, so D-06 makes it a `Select` unless the WAVG-01 audit records it as an exception; length alone is not a reason) | Shared `Combobox` (D-06, subject to WAVG-01 audit confirmation per D-16) | `md` in modals/drawers/panels; `sm` in `RuleEditorModal`, `ImportCategories`, `YnabImportModal` rows | Searchable filter + preserved sentinel/empty option (`"None"`, `"No account"`, `"The main Ready to assign"`, `"No comparison"`, `"No replacement"`, `"Create a new account"`, etc.) and accessible names |
| Fixed-list `<select>` & old `ui/Input` `<Select>` (bounded enum / constant list per D-06): `AccountTypeSelect.tsx:21` (`ACCOUNT_GROUPS`/`ACCOUNT_TYPES`), `BulkEditModal.tsx:141,217,268` (`mode`), `ReceiptsTab.tsx:330` (`provider`), `AnnualBudget.tsx:244` (12 months of year, phone-only `md:hidden`), `AutoAssign.tsx:144` (`AVERAGE_MONTH_CHOICES`), `PaydayPlan.tsx:141,204` (`weekendAdjust`, `Funding method`), `TargetCard.tsx:87` (`TYPES`), `RuleEditorModal.tsx:90,197,215,257,398,481,539` (`conditionsOp`, `field`, `op`, `direction`, `actionType`, `taxLabel`, `splitKind`), `RecurringFormModal.tsx:305,443,496` (`frequency`, `reminderDays`, `weekendAdjust`), `UpcomingLengthModal.tsx:57,88` (`preset`, `unit`), `CashRunway.tsx:707,717,727,740` (`horizonDays`, `lookbackDays`, `incomeSource`, `includeHousehold`), `LongTermForecast.tsx:650` (`Year` projection index), `AccountsPanel.tsx:134,231` (`STUDY_KINDS`, `CLASSES`), `EventEditor.tsx:149` (`Deposit type`), `SavingsPanel.tsx:93` (`Cap mode`), `SimulationPanel.tsx:176` (`Simulated paths`), `longterm/fields.tsx:231,275` (`When as`, `Escalation`), `IncomeModals.tsx:99` (`INCOME_KINDS`), `InvestmentModals.tsx:173` (`SECURITY_KINDS`), `ReportBuilderSidebar.tsx:105` (`Group by`), `Files.tsx:300` (`Kind`), `ImportModal.tsx:738,752,786,801,865` (`Separator`, `Encoding`, `Dates`, `Amounts`, `Column {h}` role enum), `YnabImportModal.tsx:320,336` (`Dates`, `Amounts`) | Shared `Select` (D-05, D-06) | `md` in modals/forms; `sm` in `RuleEditorModal`, `ReportBuilderSidebar`, `ImportModal`, `YnabImportModal`, filter bars | Supports grouped `<ListBoxSection>` + `<Header>` for `<optgroup>` callers (`AccountTypeSelect`). Renders native `<select>` on `< 768px` (D-04) |
| Multi-select pickers (`OptionPicker multiple` in `RuleEditorModal`, `AccountMultiSelect` & `CategoryTreePicker` in `ReportBuilderSidebar`, `TrendCategoryPicker` in `ReportDetail`, `TagPicker` in `TransactionMarks`, `FilterChecklist` in `TransactionFilters`) | Existing multi-select structure with shared `Checkbox` + shared `Input size="sm"` + shared `Popover`/button styling | `sm` internal controls | Preserve multi-select tree/checklist/popover semantics; remove `ring-brand-400` in `OptionPicker` and `bg-brand-50`/`border` drift; `OptionPicker` single-select routes to `Combobox`/`CategoryPicker` |
| Raw `<input type="checkbox">` | Shared `Checkbox` | Standard `size-5` indicator; `max-md:min-h-11 max-md:min-w-11` hit area | Standalone table/list checkboxes (`TransactionTable`, `Payees`, `Rules`, `ReconcilePage`, `FundingRows`, `DiscoverSchedulesModal`, `ApplyRulesModal`) omit visible label, keep `aria-label`, and center phone touch target. In `ReconcilePage.tsx:281`, stop click propagation on the `Checkbox` wrapper so parent `<tr onClick>` never double-toggles |
| Raw `<input type="radio">` (`AutoAssign`, `EditCategoryModal`, `Payees` merge modal, `SaleModals` parcels, `AssumptionsPanel`) | Shared `RadioGroup` + `Radio` | Standard `size-5` indicator | `EditCategoryModal` (`budgetType`) and `Payees` (`keepId`) preserve card-row radio styling (`p-3 rounded-lg border border-brand-600 bg-brand-50` when selected, `border-border hover:bg-hover` when unselected) |
| Raw `<input type="date">` & `<Input type="date">` | Shared `DatePicker` (D-07, D-08) | `sm` (`h-8`) in `TransactionFilters`, `TransactionFormRow` desktop, `Files` filter bar, `RuleEditorModal` date condition; `md` (`h-10`) in modals, `TransactionDetailPanel`, `CashRunway`, `Investments`, `PaydayPlan`, `TargetCard`, `RecurringFormModal`, `Receipts` | `minValue`/`maxValue` preserved (`TransactionFilters` `from`/`to` cross-bounds). `GoalFormModal` already uses `DatePicker` (verify `size="md"` & Today shortcut) |
| Raw `<input type="file">` (7 sites: G2 `EditAccountModal.tsx:157`, `PayeeIcon.tsx:99`, `ReceiptsTab.tsx:72`, `tax/ReceiptsSection.tsx:81` [`type="file"` at `:83`, rendered by `TransactionDetailPanel.tsx:558`]; G3 `FileParts.tsx:199`, `ImportModal.tsx:679`, `YnabImportModal.tsx:296`) | **Stay native `<input type="file" hidden>` / `<input type="file" className="hidden">`** (D-17) | Hidden behind shared `Button` / dropzone | Recorded in G2 (4 entries, including `tax/ReceiptsSection.tsx:81`) and G3 (3 entries) PRs as Phase 4 lint allowlist entries (`WAVG-09`) |

---

### 3. D-14 `type="number"` Conversion Contract (9 Phase 3 Uses)

All 9 `type="number"` uses in Phase 3 take counts, percentages, days, or years (zero money fields — money fields already use `CurrencyInput` or `type="text" inputMode="decimal"`). Every conversion replaces `type="number"` with shared `Input` (`type="text"` + `inputMode`), removing browser spin buttons, retaining raw string drafts while typing, enforcing the matching client/server Zod bounds via `isInvalid` / `aria-invalid="true"` + linked `FieldError` / `aria-describedby` (`role="alert"`) error copy + Save/Preview/Apply gating, and shipping with a failing-first test per behaviour change (D-14):

| PR | Screen / File:Line | Field | Shared Control & `inputMode` | Valid Range / Cap (Verified Source) | Invalid Error Copy & Commit/Save Gating |
|----|--------------------|-------|------------------------------|-------------------------------------|-----------------------------------------|
| G2 | Budget `TargetCard.tsx:115` | Repeats every (months) | `Input` `inputMode="numeric"` | Integer `1..60` (`server/src/services/targetConfig.ts:16`) | Error: `"Enter a whole number from 1 to 60."` Retain draft while typing; mark `isInvalid` and block `Save target` when non-integer, blank, or `< 1` / `> 60`. |
| G2 | Budget `PaydayPlan.tsx:246` | Percent | `Input` `inputMode="numeric"` | Integer `0..100` (`server/src/services/paydayConfig.ts:11`; plan rule sum `<= 100`) | Error: `"Enter a whole number from 0 to 100."` Retain draft while typing; mark `isInvalid` and block `Save payday plan` when fractional (e.g. `12.5`), blank, non-numeric, or outside `0..100`. |
| G2 | Rules `RuleEditorModal.tsx:563` | Split percent | `Input size="sm"` `inputMode="decimal"` + trailing `%` | `0..100` decimal (`server/src/routes/rules.ts:75`: `Percent must be 0–100`) | Error: `"Enter a percentage from 0% to 100%."` Preserve `pr-6` for `%` suffix and draft string while typing (no snapping empty to `0`); mark `isInvalid` and block rule save when unreadable, `< 0`, or `> 100`. |
| G2 | Recurring `RecurringFormModal.tsx:520` | Date flexibility (± days) | `Input` `inputMode="numeric"` | Integer `0..14` (`server/src/routes/schedules.ts:88`) | Error: `"Enter a whole number from 0 to 14."` Retain draft while typing (allow clearing); mark `isInvalid` and block `Save changes` / `Add recurring` when non-integer, blank, or outside `0..14`. |
| G2 | Recurring `UpcomingLengthModal.tsx:82` | Custom length count | `Input size="sm"` `inputMode="numeric"` (`w-24`) | Integer `>= 1` (client preference in `UpcomingLengthModal.tsx:83`) | Error: `"Enter a whole number of 1 or more."` Retain draft while typing; mark `isInvalid` and disable `Save` when non-integer, blank, or `< 1`. |
| G3 | Import `ImportModal.tsx:767` | Rows above the header | `Input size="sm"` `inputMode="numeric"` | Integer `0..Math.min(1000, Math.max(records.length - 1, 0))` (`server/src/utils/importSettings.ts:33` cap `1000`) | Error: `"Enter a whole number from 0 to {max}."` (or `"Enter 0 — this file has no rows above the header."` when `max === 0`). Keep `skipRowsDraft` visible while typing or blurred when invalid, preserve last valid table preview, and disable `Preview` until valid (`0..max`). Regression test MUST cover both `1000` (accepted when `records.length > 1001`) and `1001` (rejected). |
| G3 | Forecast `CashRunway.tsx:182` (×2) | Variable spending % / Income % | `Input` `inputMode="numeric"` | Integer `0..500` / `0..200` (`server/src/services/forecastConfig.ts:10,12`) | Error: `"Enter a whole number from 0 to 500."` / `"Enter a whole number from 0 to 200."` Retain draft while typing (allow empty while retyping); mark `isInvalid` when fractional, blank, or out of `0..max`. Gating: `CashRunway` has no `AmountFields` provider today (`useReportAmountValidity` does nothing without one), so G3 adds `useAmountValidity()` + `<AmountFields>` around the scenario editor and the slot bar's `Save {name}` button also requires `allValid`. Scenario edits apply live, so an invalid draft never reaches `onChange` and the forecast keeps the last valid value. |
| G3 | Forecast `CashRunway.tsx:221` | Goal growth % a year | `Input` `inputMode="decimal"` | `-100..50` decimal (`annualReturnBasisPoints` `-10000..5000`, `forecastConfig.ts:16`) | Error: `"Enter a percentage from -100% to 50%."` Allow leading `-` and decimal point in draft; mark `isInvalid` when unreadable or outside `-100..50`; convert valid input to basis points `-10000..5000`. Gating as for the row above: the added `AmountFields` provider gates `Save {name}`, and an invalid draft never reaches `onChange`. |
| G3 | Forecast `EventEditor.tsx:382` | Last year (`endYear`) | `Input` `inputMode="numeric"` | `null` (blank) or integer `1900..2300` (`server/src/services/longTermConfig.ts:173`) | Error: `"Enter a whole year between 1900 and 2300, or leave this blank."` Blank saves `null`; non-blank invalid/fractional/out-of-range (e.g. `1800`, `2301`, `2025.5`) keeps draft visible, marks `isInvalid`, and disables `Save` / `Create` (`useReportAmountValidity`). |

*(The 10th repository `type="number"` at `NewPlanModal.tsx:193` belongs to Payment plans and moves in Phase 4.)*

---

### 4. Container Placement & Layout Rules

1. **Table rows & dense grids** (`TransactionFormRow`, `TransactionRow`, `Budget` planned cell, `Payees` inline rename, `CategoryManager` inline add, `ImportModal` column headers, `ImportCategories` table, `RuleEditorModal` condition/action/split rows):
   - Use `size="sm"` (`h-8` desktop, `max-md:min-h-11` phone) so row rhythm (e.g., `Budget` `h-14` two-line rows) stays compact.
   - All React Aria `Popover` overlays (`Select`, `Combobox`, `DatePicker`, `CategoryPicker`) portal to `document.body` (`z-[60]`), preventing clipping inside `overflow-x-auto` tables and `overflow-clip` panels (`TransactionTable`, `ImportCategories`).
   - In `TransactionFormRow` desktop (`!sheet`), keep the 4-column top grid + `flex items-end gap-3` amount row inside `bg-brand-50 border-b border-brand-100`; in `splitMode`, render `<span>` instead of `<label htmlFor>` on the Category heading so `strayLabels` never reports a dangling `<label>`.
2. **Inline editors** (`TransactionDetailPanel`, `NoteField`, `FileDetailModal`, `Payees` inline rename):
   - Keep save-on-blur / save-on-change semantics, `onBlur` container boundaries (`TransactionDetailPanel.tsx:527` `PayeeCombobox`), and `isDisabled` (reconciled transactions) vs `isReadOnly` (`!canSave` in `NoteField`).
3. **Filter bars** (`TransactionFilters`, `Files`, `Rules`, `Payees`, `Budget` search):
   - Keep leading `Search` icon (`pl-8`), optional trailing `X` clear button (`13px`/`14px` icon visual size; `32×32 px` `md:h-8 md:w-8` **desktop-only** target, expanding to `44×44 px` `max-md:min-h-11 max-md:min-w-11` hit area on phones `< 768px`, paired with `pr-8 max-md:pr-11` on the input), `flex-wrap`, and `DatePicker size="sm"` (`w-auto` / `min-w-0`) for custom `From`/`To` date filters.
   - `ReportBuilderSidebar` uses `Select size="sm"` for `Group by` inside its fixed sidebar width.
4. **Modals & phone bottom sheets**:
   - Use default `size="md"` (`h-10` desktop, `max-md:min-h-11` phone) inside existing `space-y-4` / `gap-4` stacks.
   - `Escape` closes an open React Aria popover (`Select`, `Combobox`, `DatePicker`, `CategoryPicker`, `OptionPicker`) before closing the outer `Modal` (per `02-UI-SPEC.md` / `02-RESEARCH.md` Pitfall 4).
   - Phone sheets (`TransactionFormRow` `sheet`, `BudgetAmountSheet`) keep `16px` (`text-base`) input text and `44px` (`min-h-11`) touch targets.

---

### 5. What Must Look the Same vs What Is Allowed to Look Different

- **Must look the same (D-15):** Page structure, card layouts, column widths, button placement/variants/wording, Safe mode blurring (`Private`, `PrivateChart`), `CurrencyInput` styling and formatting, table row heights (`Budget` `h-14`), badge/pill styling, inline error/status text (outside D-14), focus-on-open targets (`AddTransactionModal` Amount, `Budget` planned input, `CategoryManager` inline input), and Enter-to-submit / Escape-to-cancel shortcuts.
- **Allowed to look different (D-03, D-05, D-07, D-14):**
  1. Unified 1px `border-border`, `rounded-md` corners, shared `h-10`/`h-8` desktop height scale, `text-text-tertiary` placeholders (`>= 4.5:1`), `--color-brand-600` focus ring, shared disabled (`bg-surface-alt text-text-disabled`), invalid (`border-negative`), and read-only (`bg-surface-alt/60 text-text`) visuals.
  2. Desktop custom React Aria `Select` / `Combobox` listboxes replacing OS native `<select>` popups (D-05, D-06).
  3. Desktop `DatePicker` (typeable segments + calendar button + popover with Today shortcut) replacing native `<input type="date">` browser chrome (D-07, D-08).
  4. Unified `Checkbox` (`size-5 rounded-sm`) and `RadioGroup` (`size-5 rounded-full`) indicators replacing browser-default ticks/radios.
  5. Ex-`type="number"` inputs dropping browser up/down spin buttons in favour of `Input` (`type="text" inputMode="numeric"|"decimal"`) with validated bounds and field-linked error copy (D-14).

---

### 6. 390 px Phone Behaviour & Verification

- Zero page-level horizontal overflow (`scrollWidth <= 390`) on every migrated route, panel, modal, and phone bottom sheet.
- Every field, filter clear button (`max-md:min-h-11 max-md:min-w-11`), and button meets `min-h-11` (44px) touch height and `16px` (`text-base`) text size at `< 768px` (no iOS Safari focus zoom).
- Standalone checkboxes (`TransactionTable`, `Payees`, `Rules`, `ReconcilePage`, `FundingRows`) expand to `44x44px` (`max-md:min-h-11 max-md:min-w-11 max-md:justify-center`) without distorting desktop table column widths (`md:` stays compact).
- `Select` and `DatePicker` automatically switch to native `<select>` and `<input type="date">` via `useIsPhone()` (`< 768px`, D-04); screens do not write device branches of their own.
- Existing `desktop`, `phone`, `demo`, and `server-mode` e2e suites pass without skipped or loosened assertions; every selector updated from `selectOption` / native `<input type="date">` / `spinbutton` to listbox / `fillDate` / `textbox` is explained in its PR (D-05, D-07, D-14, `WAVG-05`, `WAVG-06`).

---

## UI Considerations

> Shape-rooted UI state coverage for the Phase 03 screen moves, from the ui-phase probe (39
> considerations over 6 surfaces). Resolved by the orchestrator on 16 Nov 2026 under the owner's
> instruction to be asked only about open gray areas; none was dismissed, and the owner has not
> reviewed these rows one by one. The control-level states (placeholder, invalid, disabled,
> read-only, open list, truncation) are fixed by `02-UI-SPEC.md` §UI Considerations and are
> referenced here, not restated. Empty-state and error-state wording lives in `## Copywriting
> Contract` above.

Applicable state considerations resolved: 6 covered, 2 backstop, 0 unresolved, 0 dismissed (rows below; each row groups the surfaces that share an answer)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| `empty` | Transactions, Accounts, Budget, Payees, Rules, Recurring, Goals, Forecast, Investments, Reports, Files and import forms and inline editors | ✅ covered | Every moved field keeps the placeholder text, default value and label it had before the move; an unfilled field shows its placeholder in the shared control's placeholder colour and no field gains or loses a default |
| `empty` | Lists moved to Select, Combobox or `CategoryPicker` | ✅ covered | A list keeps every "none", "all" or "create" choice it had (same wording, same position, same saved value); a searchable list with no match shows the empty line named in `## Copywriting Contract` |
| `loading` | every moved surface | ✅ covered | No loading state is added or removed: a field that was disabled while its form saved or its data loaded is disabled under the same condition after the move, and save buttons keep `useCanSave` and `<SavingPausedHint />` |
| `error` | every moved surface, outside the nine converted number fields | ✅ covered | Each existing validation or server error message keeps its wording and appears at the same place; where the field is invalid the shared control shows `aria-invalid="true"` and the invalid border |
| `error` | The nine converted number fields (§3) | ✅ covered | A value outside the field's range, or a fraction in a whole-number field, stays visible as typed, shows that field's message from §3 under the field, and the form's save, preview or create action stays unavailable until it is corrected (for `CashRunway`, the forecast keeps the last valid value) |
| `partial` | every moved surface | ✅ covered | Fields that are shown only under a condition (a rule's action fields, a split row, a target type's fields, an import format's settings) appear and disappear under the same condition as before, and a form submits the same field names and values |
| `overflow`, `long-text` | every moved surface | 🧪 backstop | At 390 px no moved screen, modal or sheet scrolls sideways; a long chosen value or option truncates on one line inside the control and a long label wraps; proved by the phone e2e project and the page-gutter spec, with a reviewer's look at each moved screen |
| `populated`, `zero-one-many` | Lists moved to Select, Combobox or `CategoryPicker`; import column and category tables | 🧪 backstop | A list offers the same options in the same order and groups as before with the saved one marked; zero options shows the empty line, one option is not chosen automatically, many scroll inside the popover; proved by each screen's existing e2e specs choosing an option after the move |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ➖ dismissed → not applicable, reason recorded; not lifted
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None (no shadcn, no third-party registries; D-01, D-02) | none | not applicable — no registry blocks used |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (round-1 block resolved in revision 1; the round-2 recommendation on `CashRunway` gating applied)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS (round-2 recommendation applied: preserved accent uses listed)
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-11-16 (gsd-ui-checker round 2: VERIFIED, 0 blocking; its three recommendations, including list classification by kind, applied by the orchestrator afterwards and not re-checked)
