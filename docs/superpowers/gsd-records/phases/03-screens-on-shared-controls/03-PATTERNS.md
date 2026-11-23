# Phase 3: Screens on shared controls - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 63 modified screen/component `.tsx` files (35 in G2, 28 in G3, plus 7 native `<input type="file">` keep-native sites), new D-14 validation helper(s)/tests, ~21 `e2e/tests/*.spec.ts` files, and 2 PR release/lint config passes
**Analogs found:** 63 / 63 screen/component files + D-14 helpers/tests + E2E specs (using existing codebase analogs alongside the planned Phase 2 shared control contract in `02-UI-SPEC.md` and `02-PATTERNS.md`)

> **Source-tree provenance:** Wave F (Phase 1) code is not merged on `worktree-agent-p03-patterns` yet and lives read-only in `/Users/tristanvanrooyen/wt-f` (branch `wave-f`). Every excerpt and analog path below states whether it came from **`worktree`** (`worktree-agent-p03-patterns`) or **`wt-f`** (`/Users/tristanvanrooyen/wt-f`). All named analog paths are git-tracked in their respective trees.
>
> **Phase 2 dependency (`02-PATTERNS.md` & `D-16`):** The shared `ui/` primitives (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`, `CategoryPicker`, `PayeeCombobox`) and `fillDate` e2e helper are **planned, not shipped** — their internal implementation patterns live in `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-PATTERNS.md` and `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` and are referenced rather than repeated here. Each PR (G2, then G3) begins with a Wave 0 gate (`D-16`) reconciling file lists, D-06 list classifications, and `forwardRef` / dense-size props against the shipped `WAVG-01` audit and `client/src/components/ui/`.
>
> **Two-PR split (`D-12`):** PR 1 ships **G2 (`WAVG-05`)**: Transactions (plus Receipts), Accounts, Budget (plus Categories), Payees, Rules, and Recurring. PR 2 ships **G3 (`WAVG-06`)**: Goals, Forecast (plus Long-Term), Investments, Reports, Files, and the Import/Export dialogs, starting only after G2 merges to `redesign`.

---

## File Classification

### G2 Files (`WAVG-05` — PR 1)

| New/Modified File (Tree) | Role | Data Flow | Closest Analog | Match Quality |
|--------------------------|------|-----------|----------------|---------------|
| `client/src/components/transactions/MerchantSelect.tsx` (`worktree`) | component | event-driven / CRUD | `MerchantSelect.tsx` (`worktree`) + `02-PATTERNS.md` §6 (`Combobox`) & §13 (`PayeeCombobox`) | exact |
| `client/src/components/currency/CurrencySelect.tsx` (`worktree`) | component | event-driven | `CurrencySelect.tsx` (`worktree`) + `02-PATTERNS.md` §6 (`Combobox` with `ListBoxSection`) | exact |
| `client/src/components/currency/CurrencyDifference.tsx` (`worktree`) | component | CRUD | `CurrencyDifference.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | exact |
| `client/src/components/transactions/CategorySelectButton.tsx` (`worktree`) | component | event-driven | `CategorySelectButton.tsx` (`worktree`) + `02-PATTERNS.md` §2 (`fieldClasses.ts`) | exact |
| `client/src/pages/ReconcilePage.tsx` (`worktree`) | component | CRUD | `ReconcilePage.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/accounts/AccountTypeSelect.tsx` (`wt-f`) | component | event-driven | `AccountTypeSelect.tsx` (`wt-f`) + `02-PATTERNS.md` §5 (`Select` with `ListBoxSection`) | exact |
| `client/src/components/accounts/AddAccountModal.tsx` (`wt-f`) | component | CRUD | `EditAccountModal.tsx` (`wt-f`) + `GoalFormModal.tsx` (`worktree`) | exact |
| `client/src/components/accounts/DeleteAccountModal.tsx` (`wt-f`) | component | CRUD | `EditAccountModal.tsx` (`wt-f`) | role-match |
| `client/src/components/accounts/EditAccountModal.tsx` (`wt-f`) | component | CRUD / file-I/O (keep `<input type="file">` native, D-17) | `EditAccountModal.tsx` (`wt-f`) | exact |
| `client/src/pages/Payees.tsx` (`worktree`) | component | CRUD | `Payees.tsx` (`worktree`) + `CategoryManager.tsx` (`wt-f`) | exact |
| `client/src/pages/Rules.tsx` (`worktree`) | component | event-driven | `Rules.tsx` (`worktree`) + `TransactionFilters.tsx` (`worktree`) | exact |
| `client/src/components/rules/ApplyRulesModal.tsx` (`worktree`) | component | CRUD | `Payees.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/rules/OptionPicker.tsx` (`worktree`) | component | event-driven | `OptionPicker.tsx` (`worktree`) + `02-UI-SPEC.md` §1 (focus ring) | exact |
| `client/src/components/rules/RuleEditorModal.tsx` (`worktree`) | component | CRUD | `RuleEditorModal.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 split `%`) | exact |
| `client/src/components/recurring/AllTab.tsx` (`worktree`) | component | event-driven | `Rules.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | role-match |
| `client/src/components/recurring/DiscoverSchedulesModal.tsx` (`worktree`) | component | CRUD | `Payees.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/recurring/OccurrenceMatchModal.tsx` (`worktree`) | component | CRUD | `FilesSection.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | role-match |
| `client/src/components/recurring/RecurringFormModal.tsx` (`worktree`) | component | CRUD | `RecurringFormModal.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 `dateFlexibility`) + `GoalFormModal.tsx` (`worktree`) | exact |
| `client/src/components/recurring/UpcomingLengthModal.tsx` (`worktree`) | component | CRUD | `UpcomingLengthModal.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 count) | exact |
| `client/src/pages/Budget.tsx` (`wt-f`) | component | CRUD / event-driven | `Budget.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input` `forwardRef`) & §7 (`Checkbox`) | exact |
| `client/src/pages/AnnualBudget.tsx` (`worktree`) | component | event-driven | `AnnualBudget.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select` phone native) | role-match |
| `client/src/components/budget/AutoAssign.tsx` (`wt-f`) | component | CRUD | `EditCategoryModal.tsx` (`wt-f`) + `02-PATTERNS.md` §5 (`Select`) & §7 (`RadioGroup`) | role-match |
| `client/src/components/budget/BudgetAmountSheet.tsx` (`wt-f`) | component | CRUD | `Budget.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input`) & §7 (`Checkbox`) | role-match |
| `client/src/components/budget/CardPayments.tsx` (`wt-f`) | component | CRUD | `Budget.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input`) | role-match |
| `client/src/components/budget/FundingRows.tsx` (`wt-f`) | component | event-driven | `Budget.tsx` (`wt-f`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/budget/MoneyMoves.tsx` (`wt-f`) | component | CRUD | `MoneyMoves.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input` `forwardRef`) | exact |
| `client/src/components/budget/NoteField.tsx` (`wt-f`) | component | CRUD | `FileDetailModal.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Textarea`) | role-match |
| `client/src/components/budget/PaydayPlan.tsx` (`wt-f`) | component | CRUD | `PaydayPlan.tsx` (`wt-f`) + `longterm/fields.tsx` (`worktree`, D-14 percent) | exact |
| `client/src/components/budget/TargetCard.tsx` (`wt-f`) | component | CRUD | `TargetCard.tsx` (`wt-f`) + `longterm/fields.tsx` (`worktree`, D-14 cycle) | exact |
| `client/src/components/settings/CategoryManager.tsx` (`wt-f`) | component | CRUD | `CategoryManager.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input` `forwardRef`) | exact |
| `client/src/components/settings/EditCategoryModal.tsx` (`wt-f`) | component | CRUD | `EditCategoryModal.tsx` (`wt-f`) + `02-PATTERNS.md` §5/§6/§7 | exact |
| `client/src/components/settings/DeleteCategoryModal.tsx` (`wt-f`) | component | CRUD | `CurrencyDifference.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | role-match |
| `client/src/components/transactions/AddTransactionModal.tsx` (`worktree`) | component | CRUD | `AddTransactionModal.tsx` (`worktree`) + `GoalFormModal.tsx` (`worktree`) | exact |
| `client/src/components/transactions/BulkDeleteModal.tsx` (`worktree`) | component | CRUD | `DeleteAccountModal.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input`) | role-match |
| `client/src/components/transactions/BulkEditModal.tsx` (`worktree`) | component | CRUD | `RuleEditorModal.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | role-match |
| `client/src/components/transactions/SplitTransactionModal.tsx` (`worktree`) | component | CRUD | `TransactionFormRow.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | role-match |
| `client/src/components/transactions/TransactionDetailPanel.tsx` (`worktree`) | component | CRUD | `TransactionDetailPanel.tsx` (`worktree`) + `FileDetailModal.tsx` (`worktree`, `onChange` date save) | exact |
| `client/src/components/transactions/TransactionFilters.tsx` (`worktree`) | component | event-driven | `TransactionFilters.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) & §9 (`DatePicker`) | exact |
| `client/src/components/transactions/TransactionFormRow.tsx` (`worktree`) | component | CRUD | `TransactionFormRow.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | exact |
| `client/src/components/transactions/TransactionMarks.tsx` (`worktree`) | component | CRUD | `TransactionFilters.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/transactions/TransactionTable.tsx` (`worktree`) | component | event-driven | `Payees.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/transactions/TransferSuggestions.tsx` (`worktree`) | component | CRUD | `Payees.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/receipts/ReceiptEditor.tsx` (`worktree`) | component | CRUD | `GoalFormModal.tsx` (`worktree`) + `CategorySelectButton.tsx` (`worktree`) | role-match |
| `client/src/components/receipts/ReceiptsTab.tsx` (`worktree`) | component | CRUD / file-I/O (keep `<input type="file">` native, D-17) | `EditAccountModal.tsx` (`wt-f`) + `02-PATTERNS.md` §5/§6/§7 | role-match |
| G2 D-14 pure validation helpers & unit tests (`client/src/components/.../*.test.ts`) | utility / test | transform | `longterm/fields.tsx` (`worktree`), `utils/longTerm.test.ts` (`worktree`), `components/recurring/scheduleFormat.test.ts` (`worktree`) | exact |
| G2 E2E specs (`e2e/tests/{accessibility,accounts,currencies,envelope-funding,payday,targets,settings,transactions,transaction-filters,rules,recurring,receipts-tab,receipts-reader,phone/phone-native}.spec.ts`) | test | event-driven | `02-PATTERNS.md` §17 + `e2e/tests/recurring.spec.ts`, `accessibility.spec.ts` (`worktree`) | exact |

### G3 Files (`WAVG-06` — PR 2, after G2 merges)

| New/Modified File (Tree) | Role | Data Flow | Closest Analog | Match Quality |
|--------------------------|------|-----------|----------------|---------------|
| `client/src/components/goals/GoalFormModal.tsx` (`worktree`) | component | CRUD | `GoalFormModal.tsx` (`worktree`) | exact |
| `client/src/components/goals/GoalStatusModal.tsx` (`worktree`) | component | CRUD | `GoalFormModal.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) & §6 (`Combobox`) | role-match |
| `client/src/components/forecast/CashRunway.tsx` (`worktree`) | component | CRUD / event-driven | `CashRunway.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 `%` & growth) | exact |
| `client/src/components/longterm/fields.tsx` (`worktree`) | component | event-driven | `longterm/fields.tsx` (`worktree`) + `02-PATTERNS.md` §3 (`Field`) & §5 (`Select`) | exact |
| `client/src/components/longterm/AccountsPanel.tsx` (`worktree`) | component | CRUD | `longterm/fields.tsx` (`worktree`) + `EditAccountModal.tsx` (`wt-f`) | role-match |
| `client/src/components/longterm/AssumptionsPanel.tsx` (`worktree`) | component | CRUD | `EditCategoryModal.tsx` (`wt-f`) + `02-PATTERNS.md` §7 (`RadioGroup`, `Checkbox`) | role-match |
| `client/src/components/longterm/EventEditor.tsx` (`worktree`) | component | CRUD | `EventEditor.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 `endYear`) | exact |
| `client/src/components/longterm/EventList.tsx` (`worktree`) | component | CRUD | `FundingRows.tsx` (`wt-f`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/longterm/LongTermForecast.tsx` (`worktree`) | component | CRUD / event-driven | `longterm/fields.tsx` (`worktree`) + `02-PATTERNS.md` §5/§6 | exact |
| `client/src/components/longterm/SavingsPanel.tsx` (`worktree`) | component | CRUD | `longterm/fields.tsx` (`worktree`) + `02-PATTERNS.md` §5/§6 | role-match |
| `client/src/components/longterm/SimulationPanel.tsx` (`worktree`) | component | event-driven | `longterm/fields.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) | role-match |
| `client/src/components/investments/IncomeModals.tsx` (`worktree`) | component | CRUD | `GoalFormModal.tsx` (`worktree`) + `InvestmentModals.tsx` (`worktree`) | role-match |
| `client/src/components/investments/InvestmentModals.tsx` (`worktree`) | component | CRUD | `InvestmentModals.tsx` (`worktree`) + `GoalFormModal.tsx` (`worktree`) | exact |
| `client/src/components/investments/SaleModals.tsx` (`worktree`) | component | CRUD | `EditCategoryModal.tsx` (`wt-f`) + `GoalFormModal.tsx` (`worktree`) | role-match |
| `client/src/components/investments/SplitModals.tsx` (`worktree`) | component | CRUD | `GoalFormModal.tsx` (`worktree`) | role-match |
| `client/src/components/reports/AccountMultiSelect.tsx` (`worktree`) | component | event-driven | `ReportDetail.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/reports/CategoryTreePicker.tsx` (`worktree`) | component | event-driven | `ReportDetail.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | role-match |
| `client/src/components/reports/ReportBuilderSidebar.tsx` (`worktree`) | component | event-driven | `ReportBuilderSidebar.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) | exact |
| `client/src/components/reports/ReportDetail.tsx` (`worktree`) | component | event-driven | `ReportDetail.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | exact |
| `client/src/components/reports/SaveReportModal.tsx` (`worktree`) | component | CRUD | `FileDetailModal.tsx` (`worktree`) + `02-PATTERNS.md` §3/§4 | role-match |
| `client/src/components/reports/dashboard/NameModal.tsx` (`worktree`) | component | CRUD | `FileDetailModal.tsx` (`worktree`) + `02-PATTERNS.md` §3/§4 | role-match |
| `client/src/pages/Files.tsx` (`worktree`) | component | CRUD / event-driven | `FileDetailModal.tsx` (`worktree`) + `TransactionFilters.tsx` (`worktree`) | role-match |
| `client/src/components/files/FileDetailModal.tsx` (`worktree`) | component | CRUD | `FileDetailModal.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Textarea`) | exact |
| `client/src/components/files/FilesSection.tsx` (`worktree`) | component | CRUD | `FileDetailModal.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | role-match |
| `client/src/components/transactions/ImportModal.tsx` (`worktree`) | component | batch / file-I/O (keep `<input type="file">` native, D-17) | `ImportModal.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`, D-14 `skipRows`) | exact |
| `client/src/components/transactions/YnabImportModal.tsx` (`worktree`) | component | batch / file-I/O (keep `<input type="file">` native, D-17) | `ImportModal.tsx` (`worktree`) | exact |
| `client/src/components/transactions/ImportCategories.tsx` (`worktree`) | component | batch | `ImportModal.tsx` (`worktree`) + `02-PATTERNS.md` §6 (`Combobox`) | role-match |
| *Boundary (verify at G3 Task 1 per D-16):* `client/src/components/settings/DataExport.tsx` (`wt-f`) | component | file-I/O (keep `<input type="file">` native, D-17) | `Files.tsx` (`worktree`) + `02-PATTERNS.md` §9 (`DatePicker`) | role-match |
| G3 D-14 pure validation helpers & unit tests (`client/src/components/.../*.test.ts`) | utility / test | transform | `longterm/fields.tsx` (`worktree`), `utils/longTerm.test.ts` (`worktree`) | exact |
| G3 E2E specs (`e2e/tests/{category-goals,demo/category-goals,settings,long-term-forecast,demo/long-term-forecast,investments,reports,unsaved-drafts,data,switchers}.spec.ts`) | test | event-driven | `e2e/tests/data.spec.ts`, `recurring.spec.ts` (`worktree`) + `02-PATTERNS.md` §17 | exact |

### Files Kept Native (`D-17`) or Deferred (`D-13` / Phase 4)

- **Keep native `<input type="file">` (list in PRs for Phase 4's lint allowlist, D-17):**
  - G2: `components/accounts/EditAccountModal.tsx:157` (`wt-f`), `components/payees/PayeeIcon.tsx:99` (`worktree`), `components/receipts/ReceiptsTab.tsx:72` (`worktree`), `components/tax/ReceiptsSection.tsx:81` (`worktree`).
  - G3: `components/files/FileParts.tsx:199` (`worktree`), `components/transactions/ImportModal.tsx:679` (`worktree`), `components/transactions/YnabImportModal.tsx:296` (`worktree`) *(plus `components/settings/DataExport.tsx:235` in `wt-f` if moved in G3)*.
- **Deferred to Phase 4 (`WAVG-07` / `WAVG-10`):**
  - `components/accounts/AccountConnections.tsx` & `ConnectedBanks.tsx` (`wt-f`, bank connection sections)
  - `components/transactions/CategorySelect.tsx` (`worktree`, still used by `plans/NewPlanModal.tsx` and `plans/PlanCard.tsx`; remove in Phase 4 `WAVG-10`)
  - `components/plans/NewPlanModal.tsx:193` (remaining `type="number"`)

---

## Pattern Assignments

### 1. Shared G2 Combobox Adapters (`MerchantSelect.tsx`, `CurrencySelect.tsx`, `CurrencyDifference.tsx`, `AddTransactionModal.tsx` account picker)

**Analogs:** `client/src/components/transactions/MerchantSelect.tsx` (`worktree`), `client/src/components/currency/CurrencySelect.tsx` (`worktree`), `client/src/components/currency/CurrencyDifference.tsx` (`worktree`), `client/src/components/transactions/AddTransactionModal.tsx` (`worktree`), `client/src/components/transactions/CategorySelectButton.tsx` (`worktree`), plus `02-PATTERNS.md` §6 (`Combobox`) & §13 (`PayeeCombobox`).

**Critical distinction between `PayeeCombobox` (Phase 2) and `MerchantSelect` (G2):**
From `MerchantSelect.tsx` (`worktree`, lines 44-74, 112-135):
```tsx
  // Sync the input when a confirmed merchant is set from outside (e.g. editing).
  // Unconfirmed typing clears value.id, so don't sync then or the input would wipe itself.
  useEffect(() => {
    if (value.id) setQuery(value.name);
  }, [value.id, value.name]);

  const sortedPayees = useMemo(
    () => [...payees].sort((a, b) => b.transactionCount - a.transactionCount),
    [payees],
  );
  const filtered = query
    ? sortedPayees.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : sortedPayees.slice(0, 8);
  const exactMatch = payees.find((p) => p.name.toLowerCase() === query.trim().toLowerCase());
```
```tsx
          {query.trim() && !exactMatch && !canSave && (
            // New merchants are made on the server, so offline only existing ones can be picked
            <p className="px-3 py-2.5 text-xs text-caution border-t border-border-light">
              New payees can be added once Allotment reconnects.
            </p>
          )}
          {query.trim() && !exactMatch && canSave && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                createPayee.mutate(
                  { name: query.trim() },
                  { onSuccess: (created) => select(created.id, created.name) },
                );
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-brand-600 font-medium flex items-center gap-1.5 hover:bg-surface-alt cursor-pointer border-t border-border-light"
            >
              <Plus size={14} />
              Create new payee: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
```
When rebuilding `MerchantSelect` on shared `Combobox` (`02-PATTERNS.md` §6):
- Preserve `sortedPayees` (`transactionCount` descending, top 8), `PayeeIcon`, `CreditCard` count badge, blur reset when `!value.id`, and the offline `!canSave` message.
- Render `"Create new payee: ..."` as a `<Button>` in `Combobox`'s popover footer slot (not an option row) so `e2e/tests/recurring.spec.ts:83` (`getByRole('button', { name: /Create new payee/ })`) stays green.
- Remove `selectorInputClass` export from `MerchantSelect.tsx:7` once `CategorySelectButton.tsx` (`worktree`, lines 7, 55) migrates to `02-PATTERNS.md` §2 (`fieldClasses.ts`) trigger styling.

**Grouped `Combobox` pattern (`CurrencySelect.tsx` & `AddTransactionModal.tsx` account picker):**
From `CurrencySelect.tsx` (`worktree`, lines 31-69):
```tsx
  const firstKey = first.join(',');
  const groups = useMemo(() => {
    const top = [...new Set([...firstKey.split(',').filter(Boolean), ...COMMON])].filter((c) =>
      CURRENCY_CODES.includes(c),
    );
    const rest = CURRENCY_CODES.filter((c) => !top.includes(c))
      .map((code) => ({ code, name: currencyName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { top: top.map((code) => ({ code, name: currencyName(code) })), rest };
  }, [firstKey]);
```
Map `Common` and `All currencies` to `Combobox` `ListBoxSection` + `Header` (`02-PATTERNS.md` §6) with `"${c.code} · ${c.name}"` searchable text.

From `AddTransactionModal.tsx` (`worktree`, lines 356-425) — **Safe mode `<Private>` + footer action invariant**:
```tsx
                          <AccountIcon name={a.name} type={a.type} logo={a.logo} />
                          <span className="truncate flex-1">{a.name}</span>
                          <span
                            className={`text-xs tabular-nums shrink-0 ${a.balance >= 0 || hideBalances ? 'text-text-tertiary' : 'text-negative'}`}
                          >
                            <Private>{formatMoney(a.balance, a.currency)}</Private>
                          </span>
```
```tsx
                  {!cashAccount && !transferToId && canSave && (
                    <button ...>
                      Cash (create)
                    </button>
                  )}
```
Rebuilding `AddTransactionModal`'s hand-rolled account dropdown on shared `Combobox` must keep `On budget` / `Off budget` `ListBoxSection`s, `<AccountIcon>`, `<Private>` around balances, and the `"Cash (create)"` footer action when `!cashAccount && !transferToId && canSave`.

**Filtered category picker pattern (`CurrencyDifference.tsx`, `DeleteCategoryModal.tsx`, `MoneyMoves.tsx`, `GoalFormModal.tsx`, `GoalStatusModal.tsx`, `ImportCategories.tsx`):**
From `CurrencyDifference.tsx` (`worktree`, lines 40-43, 83-102):
```tsx
  const { data: groups = [] } = useCategories();
  // A gain is income; a loss is spending
  const choices = groups.filter((g) => (g.isIncome === 1) === gain);
  // ...
            <option value="">No category (net worth only)</option>
            {choices.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
```
Check the WAVG-01 audit in Task 1 (`D-16`) for whether filtered/special-row category selects (`No category`, `Ready to assign`, `Manual tracking`, `Keep it in...`, balance-annotated labels) use an extended `CategoryPicker` (with `groups` / `allowNone` / `noneLabel`) or shared `Combobox` with `ListBoxSection`.

---

### 2. D-14 `type="number"` Replacements + Pure Validation Helpers & Failing-First Unit Tests

**Analogs:** `client/src/components/longterm/fields.tsx` (`worktree`, lines 59-210), `client/src/components/ui/amountValidity.tsx` (`worktree`, lines 12-41), `client/src/utils/longTerm.test.ts` (`worktree`), `client/src/components/recurring/scheduleFormat.test.ts` (`worktree`).

**Applies to (all 9 Phase 3 `type="number"` sites; none take money):**
- **G2:** `TargetCard.tsx:115` (`wt-f`, integer `1..60`), `PaydayPlan.tsx:246` (`wt-f`, integer `0..100`), `RuleEditorModal.tsx:563` (`worktree`, decimal/int `0..100`), `UpcomingLengthModal.tsx:82` (`worktree`, integer `>= 1`), `RecurringFormModal.tsx:520` (`worktree`, integer `0..14`).
- **G3:** `ImportModal.tsx:767` (`worktree`, integer `0..Math.min(1000, records.length - 1)`), `CashRunway.tsx:182` (`worktree`, integer `0..500` spending / `0..200` income), `CashRunway.tsx:221` (`worktree`, decimal `-100..50` bps), `EventEditor.tsx:382` (`worktree`, optional integer `1900..2300` or `null`).

**Core string-draft + validity-context pattern** from `longterm/fields.tsx` (`worktree`, lines 166-209):
```tsx
  // What is typed stays as typed; only a whole number in range reaches the plan, and while the
  // text is anything else the dialog or panel around it cannot be saved
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (Number(text) !== value) setText(String(value));
  }
  const n = text.trim() === '' ? NaN : Number(text);
  const valid = Number.isInteger(n) && n >= min && n <= max;
  useReportAmountValidity(valid);
  const id = useId();
  return (
    <Field
      label={label}
      className={className}
      hint={
        <>
          {!valid && (
            <span id={id} role="alert" className="text-negative">
              Enter a whole number from {min} to {max}.{' '}
            </span>
          )}
          {hint}
        </>
      }
    >
      <Input
        aria-label={label}
        aria-invalid={!valid}
        aria-describedby={valid ? undefined : id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = e.target.value.trim() === '' ? NaN : Number(e.target.value);
          if (Number.isInteger(next) && next >= min && next <= max) {
            setLast(next);
            onChange(next);
          }
        }}
      />
    </Field>
  );
```
And for decimal percentage fields (`RuleEditorModal.tsx:563`, `CashRunway.tsx:221`), copy `RateField` (`longterm/fields.tsx` lines 79-145): `inputMode="decimal"`, string draft buffer, range check (`0..100` or `-100..50`), and `useReportAmountValidity(!invalid)` + parent `<AmountFields report={report}>` (`amountValidity.tsx` lines 28-30) to block Save while any field is unreadable or out of range (instead of `Math.round(+e.target.value)` or `Number(e.target.value) || 0` snapping mid-keystroke).

**Special-case nuances verified in source:**
- `EventEditor.tsx:382` (`worktree`, lines 379-391): `endYear` is **nullable** (`''` -> `null`, otherwise whole integer `1900..2300`), matching `longTermConfig.ts:173`. Previously uncapped (`Math.trunc(Number(x.target.value))`); add explicit `1900..2300` range check and `useReportAmountValidity(valid)`.
- `ImportModal.tsx:767` (`worktree`, lines 766-782): already keeps `skipRowsDraft` string state; change `type="number"` to `inputMode="numeric"` (with `0..Math.min(1000, Math.max(records.length - 1, 0))` validation), which changes its ARIA role from `spinbutton` to `textbox` (`data.spec.ts:331`).
- `PaydayPlan.tsx:246` (`wt-f`, lines 245-253): also enforce integer `0..100` (previously `Number(e.target.value)` allowed decimals that failed server Zod `.int()`).

**Pure helper + failing-first Vitest pattern** (`client/src/utils/longTerm.test.ts`, `worktree`, lines 1-20):
Client Vitest runs in Node without `jsdom` (`client/package.json:41`). Extract pure parser/validator functions (e.g. `parseWholeNumberInRange(text, min, max)`, `parseOptionalYear(text)`, `parsePercent(text)`) alongside the components or in `utils/`, and test rejected/accepted inputs (`0`, `61`, `1.5`, `"abc"`, `""`, `1800`, `2301`, `"50.5"`) in `*.test.ts` before swapping the UI fields, plus e2e invalid-input assertions per `D-14`.

---

### 3. Date Field Migration & `onChange` Save Pattern

**Analogs:** `client/src/components/goals/GoalFormModal.tsx` (`worktree`, lines 213-218), `client/src/components/files/FileDetailModal.tsx` (`worktree`, lines 278-287), `client/src/components/transactions/TransactionDetailPanel.tsx` (`worktree`, lines 363-380), and `02-PATTERNS.md` §9 (`DatePicker`).

**Applies to:**
- **G2:** `AddTransactionModal.tsx:315`, `TransactionFilters.tsx:453,462`, `TransactionFormRow.tsx:251`, `TransactionDetailPanel.tsx:370`, `ReceiptEditor.tsx:202`, `TargetCard.tsx:103`, `PaydayPlan.tsx:234,513` (note `PaydayPlan.tsx:120` is `Anchor` date too — verify all 3 dates in `PaydayPlan`), `RuleEditorModal.tsx:285`, `RecurringFormModal.tsx:349,365`.
- **G3:** `CashRunway.tsx:283,356,362,397`, `IncomeModals.tsx:112`, `InvestmentModals.tsx:236,587`, `SaleModals.tsx:172`, `SplitModals.tsx:77`, `Files.tsx:313,320`, `FileDetailModal.tsx:280` *(plus `DataExport.tsx:141,156` in `wt-f` if moved in G3)*.

**Standard form `DatePicker` usage** from `GoalFormModal.tsx` (`worktree`, lines 213-218):
```tsx
        <DatePicker
          label="Target date (optional)"
          value={targetDate}
          onChange={setTargetDate}
          optional
        />
```
Remove outer `<label>` wrappers (`TransactionFilters.tsx`, `TransactionFormRow.tsx`, `AddTransactionModal.tsx`, `TargetCard.tsx`, `PaydayPlan.tsx`, `RecurringFormModal.tsx`, `FileDetailModal.tsx`, `CashRunway.tsx`, `ReceiptEditor.tsx`, `IncomeModals.tsx`, `InvestmentModals.tsx`, `SaleModals.tsx`, `SplitModals.tsx`, `Files.tsx`) because desktop `DatePicker` renders `<Label elementType="span">` (`02-PATTERNS.md` §3 & §9).

**Immediate auto-save `DatePicker` pattern (`TransactionDetailPanel.tsx:370` trap!):**
Contrast `FileDetailModal.tsx` (`worktree`, lines 278-287):
```tsx
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            save({ documentDate: e.target.value || null });
          }}
        />
```
with `TransactionDetailPanel.tsx` (`worktree`, lines 370-379):
```tsx
          <input
            id={`${fieldId}-date`}
            type="date"
            aria-label="Date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            onBlur={saveDate}
            disabled={isReconciled}
            className={inputCls}
          />
```
With React Aria `DatePicker`, picking a day in the calendar popover or clicking `"Today"` invokes `onChange(iso)` and returns focus to the calendar button **without** blurring the `DatePicker` group — `onBlur` will not fire until the user clicks away. Because React Aria `DatePicker` only fires `onChange(iso)` when a complete valid `YYYY-MM-DD` is typed or picked, `TransactionDetailPanel` MUST save inside `onChange(iso)` when `iso && iso !== tx.date` (while keeping `isDisabled={isReconciled}`).

---

### 4. Modal & Form Screen Swap (`Field`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Textarea`)

**Analogs:** `client/src/components/accounts/AccountTypeSelect.tsx` (`wt-f`), `EditAccountModal.tsx` (`wt-f`), `EditCategoryModal.tsx` (`wt-f`), `FileDetailModal.tsx` (`worktree`), `InvestmentModals.tsx` (`worktree`), `ReportBuilderSidebar.tsx` (`worktree`), `ReportDetail.tsx` (`worktree`), `ImportModal.tsx` (`worktree`).

1. **Grouped fixed `Select` (`AccountTypeSelect.tsx`, `wt-f`, lines 13-39):**
   Replace outer `<label>` + `<select>` + `<optgroup>` + `<p>` hint with Phase 2 `Field` + `Select` (`ListBoxSection` on desktop, `<optgroup>` on phone per `02-PATTERNS.md` §5), preserving `hint={accountTypeInfo(value).hint}`.
2. **Wrapping `<label>` around `Checkbox` / `Radio` (`EditAccountModal.tsx` `wt-f` lines 231-258; `EditCategoryModal.tsx` `wt-f` lines 180-205, 259-277; `ReportDetail.tsx` `worktree` lines 673-690):**
   ```tsx
   // EditCategoryModal.tsx (wt-f, lines 180-204)
            <div role="group" aria-labelledby={`${fieldId}-budget-type`} className="space-y-2">
              {BUDGET_TYPE_OPTIONS.map((opt) => (
                <label ...>
                  <input type="radio" name="budgetType" ... />
                  <div>
                    <div className="text-sm font-medium text-text">{opt.label}</div>
                    <div className="text-xs text-text-tertiary">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
   ```
   Replace `<div role="group">` + `<label><input type="radio" />...</label>` with shared `RadioGroup` + `Radio` (`02-PATTERNS.md` §7), and replace `<label><input type="checkbox" />...</label>` (`EditAccountModal.tsx:231,244`, `Payees.tsx:220,240`, `TransactionFilters.tsx:189,200`, `ReportDetail.tsx:673`, `ReceiptsTab.tsx:230,477`) with shared `Checkbox` directly (no outer `<label>`!). Note `EditCategoryModal` moving from `role="group"` to `role="radiogroup"` updates `e2e/tests/accessibility.spec.ts:190`.
3. **Uncontrolled `defaultValue` -> controlled `selectedKey` (`FileDetailModal.tsx`, `worktree`, lines 155-160):**
   ```tsx
        <Select
          aria-label={`Choose a ${KIND_NOUNS[kind].toLowerCase()}`}
          defaultValue=""
          onChange={(e) => add(e.target.value)}
          disabled={link.isPending}
        >
   ```
   Switch `defaultValue=""` to controlled state (`selectedKey=""` / resetting after `add(key)`) when moving to React Aria `Select` / `Combobox`.
4. **Native `<textarea>` -> shared `Textarea` (`FileDetailModal.tsx` `worktree` lines 291-300, `TransactionDetailPanel.tsx` `worktree` lines 546-555, `NoteField.tsx` `wt-f` line 55):**
   Preserve `maxLength={2000}`, `rows`, `placeholder`, `aria-label`, and `onBlur` save handlers, dropping one-off border/bg classes (`02-PATTERNS.md` §4).
5. **Fixed enum `Select` (`ReportBuilderSidebar.tsx` `worktree` lines 105-116, `ImportModal.tsx` `worktree` lines 738-812):**
   Replace `<select>` + `selectClass` + outer `<label>` with `Field` / `Select` (`label="Separator"`, etc.), deleting local `selectClass` and `optionLabelClass` constants (`D-03`).
6. **`OptionPicker.tsx` (`worktree`) & `RuleEditorModal.tsx` (`worktree`):**
   Replace undefined `ring-brand-400` (`02-UI-SPEC.md` checker item 2) with `brand-600` / shared `Input` + `Select` + `Combobox`.

---

### 5. Dense / Inline Table Editors & `forwardRef` Callers

**Analogs:** `client/src/pages/Budget.tsx` (`wt-f`, lines 95-165, 332-341), `client/src/components/budget/MoneyMoves.tsx` (`wt-f`, lines 63, 220-233), `client/src/components/settings/CategoryManager.tsx` (`wt-f`, lines 51-82), `client/src/pages/Payees.tsx` (`worktree`, lines 258-270, 357-369), `client/src/components/transactions/TransactionFormRow.tsx` (`worktree`, lines 244-345, 380-416), `client/src/components/transactions/ImportModal.tsx` (`worktree`, lines 862-878).

**`forwardRef<HTMLInputElement>` + `readOnly` + `.select()` callers (`Budget.tsx`, `MoneyMoves.tsx`, `CategoryManager.tsx`):**
From `CategoryManager.tsx` (`wt-f`, lines 52-80):
```tsx
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      ...
      className="text-sm bg-surface border border-brand-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-600 w-48"
    />
  );
```
And `Budget.tsx` (`wt-f`, lines 97-139) passes `ref={input}`, `readOnly={saving}`, `aria-busy`, `onFocus={(e) => e.target.select()}`, `onKeyDown` (`Enter`/`Escape`/`ArrowUp`/`ArrowDown`/`Tab`).
- **Wave 0 Gate (`D-16`):** Verify Phase 2 shipped `ui/Input.tsx` with `forwardRef<HTMLInputElement>` and a compact/dense variant (`size="sm"` `h-8`, or extend `ui/Input` / `ui/Select` with a `dense`/`inline` size + gallery specimen + Linux screenshot per `03-CONTEXT.md` Claude's Discretion) before converting `Budget.tsx`, `Payees.tsx` (`@259,358`), `CategoryManager.tsx` (`@61`), `TransactionFormRow.tsx` (desktop inline row vs `sheet` mode), `TransactionFilters.tsx:178`, and `ImportModal.tsx:865` column role `<select>`s inside `<th className="px-2 py-1">`.
- **Budget row checkbox spacing (`Budget.tsx` `wt-f` lines 332-341):** Current `<input type="checkbox" className="absolute left-4 top-3 h-3.5 w-3.5" />` sits inside `pl-10` (`40px`). Shared `Checkbox` has a `size-5` (`20px`) indicator (`16px + 20px = 36px`) and `max-md:min-h-11 max-md:min-w-11` on phone — verify `pl-10` / `top-*` alignment at both desktop and `390 px` so the checkbox never collides with the category name link.

---

### 6. E2E Selector Migration Patterns (`e2e/tests/`)

**Analogs:** `02-PATTERNS.md` §17 (`fillDate`, `PayeeCombobox` `textbox` -> `combobox`, `CategoryPicker` `button` -> `option`), `e2e/tests/recurring.spec.ts` (`worktree`, lines 46-49, 75-99), `e2e/tests/accessibility.spec.ts` (`worktree`, lines 158-191), `e2e/tests/data.spec.ts` (`worktree`, lines 331-335).

Concrete selector replacements when moving screens onto Phase 2 controls (document every changed selector's reason in the PR per `WAVG-05`/`WAVG-06` and `D-15`):

1. **Desktop `Select` (`.selectOption()` -> button + listbox option; `.toHaveValue()` -> `.toHaveText()`):**
   From `recurring.spec.ts` (`worktree`, lines 46-47, 86-87):
   ```ts
   // BEFORE (native <select>):
   await dialog.getByRole('combobox', { name: 'Frequency' }).selectOption('monthly');
   await expect(account).toHaveValue(/.+/);
   await expect(account.locator('option:checked')).toHaveText('Savings');

   // AFTER (desktop React Aria Select for Frequency; Combobox for Account):
   await dialog.getByRole('button', { name: 'Frequency' }).click();
   await page.getByRole('option', { name: 'Monthly', exact: true }).click();
   await expect(dialog.getByRole('button', { name: 'Frequency' })).toContainText('Monthly');
   ```
   *(Phone tests under `e2e/tests/phone/` keep `.selectOption()` on `Select`, `DatePicker`, and `MonthPicker` because `D-04` renders native controls under `768 px`.)*

2. **Desktop `Combobox` (`.selectOption()` -> `combobox` fill/click + `option` click; `.toHaveValue(label)`):**
   For `CurrencySelect`, `Account`, `Linked account`, `Plan`, `Category`/`Tag`/`Household` comboboxes (`currencies.spec.ts:41`, `recurring.spec.ts:47,79`, `settings.spec.ts:350`, `long-term-forecast.spec.ts`):
   ```ts
   await dialog.getByRole('combobox', { name: 'Account' }).click();
   await page.getByRole('option', { name: 'Savings', exact: true }).click();
   await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue('Savings');
   ```

3. **Desktop `DatePicker` (`.fill(iso)` -> `fillDate` helper from `02-PATTERNS.md` §17):**
   Replace `.fill(iso)` in `transactions.spec.ts:183`, `transaction-filters.spec.ts:81-82`, `recurring.spec.ts:48`, `receipts-tab.spec.ts`, `investments.spec.ts` with `fillDate(...)`. Where tests asserted `.toHaveValue('2026-11-01')` (`transaction-filters.spec.ts`, `receipts-reader.spec.ts:103`), assert rendered segment values / formatted text / filter state instead.

4. **`accessibility.spec.ts` (`worktree`, lines 158-190):**
   - `:158-159` (`Account type` `Select`): `getByRole('button', { name: 'Account type' })` replaces `getByRole('combobox', ...)` (desktop `Select` trigger is `<AriaButton>`).
   - `:181-182` (`Start date` `DatePicker`): desktop `<Label elementType="span">` renders with React Aria `DateInput` `spinbutton` segments (`[role="spinbutton"]`) instead of a single `<input>` matching `getByLabel('Start date')`.
   - `:190` (`Budget type` `RadioGroup`): `getByRole('radiogroup', { name: 'Budget type' })` replaces `getByRole('group', ...)`.

5. **D-14 `ImportModal` `skipRows` (`data.spec.ts` `worktree`, lines 331, 611, 618):**
   Update `getByRole('spinbutton', { name: 'Rows above the header' })` to `getByRole('textbox', { name: 'Rows above the header' })` because replacing `type="number"` with `inputMode="numeric"` changes the ARIA role from `spinbutton` to `textbox`.

---

## Shared Patterns

### ESLint `jsx-a11y/label-has-associated-control` & `strayLabels` Invariant
**Source:** `lint/eslint.config.js` (`worktree`, lines 123-130) & `e2e/tests/accessibility.spec.ts` (`worktree`, lines 105-110, excerpted in `02-PATTERNS.md` §3)
**Apply to:** Every G2 and G3 screen file
```js
      'jsx-a11y/label-has-associated-control': [
        'warn',
        {
          controlComponents: ['Input', 'Select', 'CurrencyInput', 'MoneyInput', 'AmountInput'],
          depth: 3,
        },
      ],
```
Because `Checkbox`, `Radio`, desktop `Select`, `Combobox`, `DatePicker`, and `MonthPicker` render their own `<label>` or `<Label elementType="span">`, **always unwrap outer `<label>` elements** when migrating screens; otherwise ESLint emits warnings (threatening the `128` cap in `lint/package.json:8`) and `accessibility.spec.ts` `strayLabels` fails.

### `Modal` Escape, `Popover` Portals & `overflow-clip`
**Source:** `02-PATTERNS.md` §Shared Patterns (`Modal.tsx:153-157`, `MonthRangePicker.tsx:186-191`)
**Apply to:** All G2/G3 modals and slide-over panels (`AddTransactionModal`, `BulkEditModal`, `SplitTransactionModal`, `TransactionDetailPanel`, `EditAccountModal`, `EditCategoryModal`, `RuleEditorModal`, `RecurringFormModal`, `GoalFormModal`, `InvestmentModals`, `FileDetailModal`, `ImportModal`, `YnabImportModal`)
React Aria `Popover` portals out of `overflow-x-auto` (`ImportModal`) and `overflow-clip` (`TransactionTable`), and prevents `Escape` from closing the parent `Modal` while a list or calendar is open.

### Paused Saving (`useCanSave`, `<SavingPausedHint />`) & Safe Mode (`<Private>`)
**Source:** `client/src/components/transactions/MerchantSelect.tsx` (`worktree`, lines 112-117), `AddTransactionModal.tsx` (`worktree`, lines 378, 412), `TransactionDetailPanel.tsx` (`worktree`, lines 158-162, 349, 377)
**Apply to:** All G2 and G3 forms/pickers
Preserve `disabled={!canSave}` + `<SavingPausedHint />` on all save buttons, `isDisabled={isReconciled}` in `TransactionDetailPanel`, `!canSave` offline wording in `MerchantSelect`, and `<Private>` wrappers inside `AddTransactionModal`'s account picker and `FileDetailModal`'s transaction search.

### D-17 Native `<input type="file">` Allowlist
**Source:** Verified across `worktree` and `wt-f` (`03-RESEARCH.md` §Hard Cases §5)
**Apply to:** G2 and G3 PR descriptions (feeds Phase 4's `WAVG-09` lint allowlist)
Keep all 7 file inputs native (`EditAccountModal.tsx:157`, `PayeeIcon.tsx:99`, `ReceiptsTab.tsx:72`, `ReceiptsSection.tsx:81` in G2; `FileParts.tsx:199`, `ImportModal.tsx:679`, `YnabImportModal.tsx:296` in G3 — plus `DataExport.tsx:235` in `wt-f` if moved in G3).

### Release Bump & Lint Warning Cap (`D-12`)
**Source:** `scripts/prepare-release.py` (`worktree`, lines 11-28) & `lint/package.json:8` (`--max-warnings=128`)
**Apply to:** Final task of PR 1 (G2) and PR 2 (G3)
Run `npm run release:prepare -- <next 0.2.0-up.N>` (updates `package.json`, `package-lock.json`, `homeassistant/config.yaml` together), add a `CHANGELOG.md` entry, update `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`, and `docs/ui/WAVES.md`, and lower `--max-warnings` in `lint/package.json` if a migration removes existing `jsx-a11y` warnings.

---

## No Analog Found

All Phase 3 screen migrations, D-14 number-field replacements, pure validation unit tests, and E2E selector migrations have verified codebase analogs (`longterm/fields.tsx`, `GoalFormModal.tsx`, `FileDetailModal.tsx`, `longTerm.test.ts`, `recurring.spec.ts`, plus `02-PATTERNS.md`). The only unshipped dependency is the Phase 2 shared control set itself (`WAVG-01` audit + `ui/` primitives + `fillDate` helper), which is verified and reconciled in Task 1 (`D-16`) of both PRs before any screen edits begin.

---

## Metadata

**Analog search scope:** `client/src/components/{transactions,receipts,currency,rules,recurring,goals,forecast,longterm,investments,reports,files,ui}/`, `client/src/pages/`, `client/src/utils/`, `lint/`, `scripts/`, `e2e/tests/` (`worktree-agent-p03-patterns`), plus `client/src/components/{accounts,budget,settings}/` and `client/src/pages/Budget.tsx` (`/Users/tristanvanrooyen/wt-f`, branch `wave-f`).
**Files scanned:** ~40 tracked files across both trees (building on `03-RESEARCH.md`'s 63-file inventory)
**Pattern extraction date:** 2026-11-16
