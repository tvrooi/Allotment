# Phase 4: Remaining screens and the guard - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 62 (G4: 38 `.tsx` screen/component files + 2 Vitest helpers/tests + 18 `e2e/tests/*.spec.ts` files + `e2e/tests/fixtures.ts`; G5: 4 `lint/` files + 4 removed/edited legacy control files + 7 doc targets — grouped into 14 pattern-assignment entries covering every distinct pattern)
**Analogs found:** 62 / 62 (all files have exact or partial tracked analogs in `worktree` or `wt-f`, paired with the planned Phase 2 shared-control contracts in `02-UI-SPEC.md` and `02-PATTERNS.md`)

> **Source-tree provenance:** Wave F (Phase 1) lives on branch `wave-f` in `/Users/tristanvanrooyen/wt-f` (PR #273), though `diff -rq` confirms `client/src` currently matches `worktree-agent-p04-patterns` (`f2367f1`). Per assignment instructions, all Settings files were inspected read-only under `/Users/tristanvanrooyen/wt-f/client/src` (`wt-f`); all other files (`currency`, `up`, `plaid`, `simplefin`, `enablebanking`, `auth`, `layout`, `dashboard`, `plans`, `review`, `household`, `tax`, `lint/`, `e2e/`, `docs/`) were inspected in this worktree (`worktree`). Every analog path below is verified git-tracked via `git ls-files`.
>
> **Phase 2 & Phase 3 dependency (`02-PATTERNS.md`, `D-12`, `D-16`, `D-18`, `D-19`):** Phase 2's shared controls (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`, `CategoryPicker`, `PayeeCombobox`) and `fillDate` helper are **planned, not shipped** — their internal patterns live in `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` and `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-PATTERNS.md` and are referenced rather than repeated here. G4 begins only after PR #273, Phase 2, and Phase 3 (G2 + G3) merge to `redesign`, starting with Task 1 (`D-16`) reconciling against `docs/ui/FORM-CONTROLS-AUDIT.md` and shipped `components/ui/`. G5 begins only after G4 merges (`D-18`).

---

## File Classification

### G4 Files (`WAVG-07`, `WAVG-08` — PR 1)

| New/Modified File (Tree) | Role | Data Flow | Closest Analog (Tree) | Match Quality |
|--------------------------|------|-----------|-----------------------|---------------|
| `client/src/components/settings/BudgetStartSettings.tsx` (`wt-f`) | component | CRUD | `BudgetStartSettings.tsx` (`wt-f`) + `02-PATTERNS.md` §10 (`MonthPicker`) | exact |
| `client/src/components/settings/CurrencySettings.tsx` (`wt-f`) | component | CRUD | `CurrencySettings.tsx` (`wt-f`) + `02-PATTERNS.md` §§4, 7, 9 | exact |
| `client/src/components/settings/DataExport.tsx` (`wt-f`) | component | file-I/O (keep `<input type="file">` native, D-17) | `DataExport.tsx` (`wt-f`) + `02-PATTERNS.md` §9 (`DatePicker`) | exact |
| `client/src/components/settings/PeopleSettings.tsx` (`wt-f`) | component | CRUD | `PeopleSettings.tsx` (`wt-f`) + `02-PATTERNS.md` §§4, 7 (`RadioGroup`) | exact |
| `client/src/components/settings/PreferencesPanel.tsx` (`wt-f`) | component | CRUD | `PreferencesPanel.tsx` (`wt-f`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/settings/PrioritiesSettings.tsx` (`wt-f`) | component | CRUD | `PrioritiesSettings.tsx` (`wt-f`) + `02-PATTERNS.md` §§4, 5 | exact |
| `client/src/components/settings/ReadOnlyAccess.tsx` (`wt-f`) | component | CRUD | `ReadOnlyAccess.tsx` (`wt-f`) + `02-PATTERNS.md` §§3, 4, 5 | exact |
| `client/src/components/settings/ReminderSettings.tsx` (`wt-f`) | component | CRUD | `ReminderSettings.tsx` (`wt-f`) + `02-PATTERNS.md` §§4, 7 (`Checkbox`) | exact |
| `client/src/components/settings/ServerSettings.tsx` (`wt-f`) | component | CRUD (D-20) | `ServerSettings.tsx` (`wt-f`) + `02-PATTERNS.md` §§4, 7 | exact |
| `client/src/components/settings/TagManager.tsx` (`wt-f`) | component | CRUD | `TagManager.tsx` (`wt-f`) + `02-PATTERNS.md` §5 (`Select`) or `D-17` | role-match |
| `client/src/components/currency/CurrencySelect.tsx` (`worktree`, boundary) | component | event-driven | `CurrencySelect.tsx` (`worktree`) + `02-PATTERNS.md` §§5, 6 | exact |
| `client/src/components/currency/CurrencyDifference.tsx` (`worktree`, boundary) | component | CRUD | `CurrencyDifference.tsx` (`worktree`) + `CategorySelect.tsx` (`worktree`) | exact |
| `client/src/components/up/UpConnectModal.tsx` (`worktree`) | component | CRUD (D-20) | `UpConnectModal.tsx` (`worktree`) + `02-PATTERNS.md` §§4–6, 9 | exact |
| `client/src/components/up/UpSettings.tsx` (`worktree`) | component | CRUD | `UpSettings.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) | exact |
| `client/src/components/plaid/PlaidConfigForm.tsx` (`worktree`) | component | CRUD (D-20) | `PlaidConfigForm.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/plaid/PlaidSetupModal.tsx` (`worktree`) | component | CRUD (D-20) | `PlaidConfigForm.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/plaid/PlaidEnvironmentSelect.tsx` (`worktree`) | component | event-driven | `PlaidEnvironmentSelect.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) | exact |
| `client/src/components/plaid/ConnectBankModal.tsx` (`worktree`) | component | CRUD | `ConnectBankModal.tsx` (`worktree`) + `02-PATTERNS.md` §§4–6 | exact |
| `client/src/components/simplefin/SimplefinConfigForm.tsx` (`worktree`) | component | CRUD (D-20) | `PlaidConfigForm.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/simplefin/SimplefinConnectModal.tsx` (`worktree`) | component | CRUD (D-20) | `ConnectBankModal.tsx` (`worktree`) + `02-PATTERNS.md` §§4–6 | exact |
| `client/src/components/enablebanking/EnableBankingSetupForm.tsx` (`worktree`) | component | CRUD / file-I/O (keep `.pem` file native, D-17, D-20) | `EnableBankingSetupForm.tsx` (`worktree`) + `02-PATTERNS.md` §4 | exact |
| `client/src/components/enablebanking/ConnectEnableBankingModal.tsx` (`worktree`) | component | CRUD (D-20) | `ConnectEnableBankingModal.tsx` (`worktree`) + `02-PATTERNS.md` §§4–7 | exact |
| `client/src/components/auth/AuthGate.tsx` (`worktree`) | component | request-response (D-20) | `AuthGate.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/layout/CommandPalette.tsx` (`worktree`) | component | event-driven | `CommandPalette.tsx` (`worktree`) + `02-PATTERNS.md` §4 (`Input`) | exact |
| `client/src/components/dashboard/CustomizeHome.tsx` (`worktree`) | component | event-driven | `CustomizeHome.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | exact |
| `client/src/components/dashboard/SummaryStats.tsx` (`worktree`) | component | event-driven | `SummaryStats.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select size="sm"`) | exact |
| `client/src/pages/Welcome.tsx` (`worktree`) | component | CRUD | `Welcome.tsx` (`worktree`) + `02-PATTERNS.md` §8 (`Switch` label check) | exact |
| `client/src/components/plans/NewPlanModal.tsx` (`worktree`) | component | CRUD (WAVG-08) | `NewPlanModal.tsx` (`worktree`) + `longterm/fields.tsx` (`worktree`) | exact |
| `client/src/components/plans/PlanCard.tsx` (`worktree`) | component | CRUD | `PlanCard.tsx` (`worktree`) + `02-PATTERNS.md` §§9, 12 | exact |
| `client/src/components/plans/EarlierPaymentsModal.tsx` (`worktree`) | component | event-driven | `EarlierPaymentsModal.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select`) | exact |
| `client/src/components/plans/planValidation.ts` + `.test.ts` (`worktree`, new) | utility / test | transform | `client/src/components/plans/planHelpers.ts` & `longterm/fields.tsx` (`worktree`) | role-match |
| `client/src/utils/noNumberMoney.test.ts` (`worktree`, new) | test | transform | `client/src/utils/movedSections.test.ts` (`worktree`) | exact |
| `client/src/pages/Review.tsx` (`worktree`) | component | event-driven (D-09) | `Review.tsx` (`worktree`) + `02-PATTERNS.md` §5 (`Select size="sm"`) | exact |
| `client/src/components/review/Housekeeping.tsx` (`worktree`) | component | CRUD (D-09) | `Housekeeping.tsx` (`worktree`) + `02-PATTERNS.md` §§5, 12 | exact |
| `client/src/components/review/Resilience.tsx` (`worktree`) | component | CRUD (D-09) | `Resilience.tsx` (`worktree`) + `02-PATTERNS.md` §§4, 5 | exact |
| `client/src/components/review/SortUncategorised.tsx` (`worktree`) | component | CRUD (D-09) | `SortUncategorised.tsx` (`worktree`) + `02-PATTERNS.md` §7 (`Checkbox`) | exact |
| `client/src/pages/CashFlow.tsx` (`worktree`) | component | event-driven (D-09) | `CashFlow.tsx` (`worktree`) — verify 0 raw/old fields (`MonthRangePicker` only) | exact |
| `client/src/pages/Tax.tsx` (`worktree`) | component | CRUD (D-09) | `Tax.tsx` (`worktree`) + `02-PATTERNS.md` §§4, 5, 9 | exact |
| `client/src/components/tax/Assets.tsx` (`worktree`) | component | CRUD (D-09) | `Assets.tsx` (`worktree`) + `02-PATTERNS.md` §§4, 5, 7, 9 | exact |
| `client/src/components/tax/CarAndHome.tsx` (`worktree`) | component | CRUD (D-09) | `CarAndHome.tsx` (`worktree`) + `02-PATTERNS.md` §§4, 5, 7, 9 | exact |
| `client/src/components/tax/TaxClaimSection.tsx` (`worktree`, boundary) | component | CRUD (D-09) | `TaxClaimSection.tsx` (`worktree`) + `02-PATTERNS.md` §§4, 5, 7 | exact |
| `client/src/components/tax/ReceiptsSection.tsx` (`worktree`, boundary) | component | file-I/O (keep `<input type="file">` native, D-17) | `DataExport.tsx` (`wt-f`) | exact |
| `client/src/pages/Household.tsx` (`worktree`) | component | CRUD / `FormData` (D-09) | `Household.tsx` (`worktree`) + `02-PATTERNS.md` §§4–7, 9 | exact |
| `client/src/components/household/*.tsx` (12 files, `worktree`) | component | CRUD / file-I/O (keep `HouseholdIcon.tsx:89` file native, D-09, D-17) | `CombinedHousehold.tsx`, `RepaymentCategoryOffers.tsx`, `HouseholdIcon.tsx` (`worktree`) | exact |
| `e2e/tests/fixtures.ts` (`fillMonth` helper, `worktree`) | utility | event-driven | `e2e/tests/fixtures.ts` (`typeAmount`) + `02-PATTERNS.md` §17 (`fillDate`) | partial (no `MonthPicker` helper yet) |
| `e2e/tests/*.spec.ts` (18 specs, `worktree`) | test | event-driven | `e2e/tests/dashboard.spec.ts`, `settings.spec.ts`, `household-categories.spec.ts` (`worktree`) | exact |

### G5 Files (`WAVG-09`, `WAVG-10` — PR 2, blocked until G4 merges)

| New/Modified File (Tree) | Role | Data Flow | Closest Analog (Tree) | Match Quality |
|--------------------------|------|-----------|-----------------------|---------------|
| `lint/rules/no-raw-form-control.js` (`worktree`, new) | middleware / rule | transform (AST) | `lint/rules/icon-only-control.js` (`worktree`) | partial (same plugin/visitor pattern, adds rule `schema` allowlist) |
| `lint/rules/no-raw-form-control.test.js` (`worktree`, new) | test | transform | `lint/rules/icon-only-control.test.js` (`worktree`) | exact |
| `lint/eslint.config.js` (`worktree`) | config | static | `lint/eslint.config.js` (`worktree`) | exact |
| `lint/package.json` (`worktree`) | config | static | `lint/package.json` (`worktree`) | exact |
| `client/src/components/ui/Input.tsx` (`worktree`, remove `Select`) | component | event-driven | `client/src/components/ui/Input.tsx` (`worktree`) | exact |
| `client/src/components/transactions/{CategorySelect,MerchantSelect,CategorySelectButton}.tsx` (`worktree`, delete) | component | — | `CategorySelect.tsx`, `MerchantSelect.tsx` (`worktree`) | exact |
| `DESIGN.md`, `docs/ui/MAP.md`, `docs/ui/HANDOVER-UI.md`, `docs/DEVELOPMENT.md`, `docs/ui/WAVES.md`, `CLAUDE.md`/`AGENTS.md` (`worktree`) | doc | static | Same files (`worktree`) | exact |

---

## Pattern Assignments

### 1. Settings Month, Date, Checkbox, RadioGroup & Compact Swatch (`components/settings/*.tsx`)

**Analogs:** `BudgetStartSettings.tsx`, `CurrencySettings.tsx`, `DataExport.tsx`, `PeopleSettings.tsx`, `PreferencesPanel.tsx`, `PrioritiesSettings.tsx`, `ReadOnlyAccess.tsx`, `ReminderSettings.tsx`, `ServerSettings.tsx`, `TagManager.tsx` (`wt-f`); shared control contracts in `02-PATTERNS.md` §§3–7, 9–10.

**`MonthPicker` replacement (`BudgetStartSettings.tsx` in `wt-f`, lines 64–73):**
```tsx
        <label>
          <span className="block text-xs font-medium text-text-secondary mb-1">Start month</span>
          <input
            type="month"
            value={value}
            max={thisMonth}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
          />
        </label>
```
Swap `<label>` + `<input type="month">` to shared `<MonthPicker label="Start month" value={value} maxValue={thisMonth} onChange={setDraft} />` (keeping `Save` / `Count all of ...` / `Count all history` buttons untouched), and delete local `inputClass` (lines 12–13).

**Inline `sm` row + `Checkbox` + `url` + narrow symbol `Input` (`CurrencySettings.tsx` in `wt-f`, lines 240–264, 347–356, 390–403, 464–472):**
```tsx
// AddRate row (lines 240-264):
          <label htmlFor="rate-date" className="block text-xs font-medium text-text-tertiary mb-1">
            Day
          </label>
          <input
            id="rate-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
// ...
          <input
            id="rate-value"
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="1.0812"
            aria-invalid={(rate !== '' && !rateValid) || undefined}
            className={`${inputClass} w-32`}
          />
```
```tsx
// Checkbox (lines 347-356) — remove outer <label> when moving to RAC Checkbox:
          <label className="flex items-center gap-3 cursor-pointer max-md:min-h-11">
            <input
              type="checkbox"
              checked={settings.ratesEnabled}
              onChange={(e) => setDownload.mutate({ enabled: e.target.checked })}
              disabled={!canSave || setDownload.isPending}
              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-text-secondary">Download ECB reference rates</span>
          </label>
```
Copy `ReminderSettings.tsx` (`wt-f`, lines 130–144) multi-line description pattern inside `<Checkbox>` children (never wrap RAC `<Checkbox>` in an outer `<label>`, per `02-UI-SPEC.md` §2.7), preserve `type="url"` (`CurrencySettings.tsx:398`) and `maxLength={5}` + `w-20 text-center` (`CurrencySettings.tsx:469–471`, `PreferencesPanel.tsx:296–297`), and keep `<input type="file">` native in `DataExport.tsx:235–244` (`D-17`).

**`TagManager.tsx` swatch `<select>` (`wt-f`, lines 51–65):**
```tsx
              <label className="relative h-4 w-4 shrink-0 cursor-pointer">
                <span className="sr-only">Colour for {t.name}</span>
                <select
                  value={t.color}
                  onChange={(e) => update.mutate({ id: t.id, color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {[...new Set([t.color, ...COLORS])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
              </label>
```
**Gate (`D-16`):** Check `WAVG-01` audit classification in `04-01` Task 1: either use a compact swatch trigger on shared `Select` (keeping the `h-4 w-4` dot inside a `max-md:min-h-11 max-md:min-w-11` hit target) or add `TagManager.tsx` (`select`) to the `D-17` lint allowlist if the audit keeps it native.

---

### 2. Currency Boundary Components (`CurrencySelect.tsx`, `CurrencyDifference.tsx`)

**Analogs:** `client/src/components/currency/CurrencySelect.tsx`, `client/src/components/currency/CurrencyDifference.tsx`, `client/src/components/transactions/CategorySelect.tsx` (`worktree`).

```tsx
// CurrencySelect.tsx (worktree, lines 45-68)
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={`block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 ${className}`}
    >
      <optgroup label="Common">
        {groups.top.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="All currencies"> ... </optgroup>
    </select>
```
Check in `04-01` Task 1 (`D-16`) whether Phase 3 G2 already migrated `CurrencySelect.tsx` (used by `AddAccountModal`) and `CurrencyDifference.tsx`. If still unmigrated, replace `<select>` in `CurrencySelect.tsx` with shared `Select` or `Combobox` (per `WAVG-01` audit) using grouped `ListBoxSection` (`"Common"` / `"All currencies"`), stripping the one-off `border-brand-500` / `disabled:opacity-60` classes (`D-03`); move `CurrencyDifference.tsx:83` to `CategoryPicker` (`allowNone`, `noneLabel="No category (net worth only)"`, `D-05`) or shared `Select` per `WAVG-01`.

---

### 3. Auth & Bank Credential Fields (`AuthGate.tsx`, `UpConnectModal.tsx`, `Plaid*`, `Simplefin*`, `EnableBanking*`, `PeopleSettings.tsx`, `ReminderSettings.tsx`, `ServerSettings.tsx`) — `D-20`

**Analogs:** `AuthGate.tsx`, `UpConnectModal.tsx`, `PlaidConfigForm.tsx`, `PlaidEnvironmentSelect.tsx`, `ConnectBankModal.tsx`, `SimplefinConnectModal.tsx`, `EnableBankingSetupForm.tsx`, `ConnectEnableBankingModal.tsx` (`worktree`); `PeopleSettings.tsx`, `ReminderSettings.tsx`, `ServerSettings.tsx` (`wt-f`).

**Critical `D-20` passthrough excerpt (`AuthGate.tsx` in `worktree`, lines 363–384 & 393–401):**
```tsx
            <input
              id="setup-code"
              autoComplete="one-time-code"
              spellCheck={false}
              autoFocus={isSetup}
              placeholder={
                mode === 'reset' ? '123456 or XXXX-XXXX-XXXX-XXXX' : 'XXXX-XXXX-XXXX-XXXX'
              }
              value={code}
              onChange={(e) => setCode(e.target.value)}
              // A whole line (or more) copied from the log works too: only the code is kept
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                const found = codeFromPaste(pasted, { allowShort: mode === 'reset' });
                if (found !== pasted.trim()) {
                  e.preventDefault();
                  setCode(found);
                }
              }}
              aria-describedby={isSetup ? 'setup-code-help' : undefined}
              className={`${inputClass} font-mono uppercase`}
            />
```
**Bank token + Paste button + `aria-describedby` excerpt (`UpConnectModal.tsx` in `worktree`, lines 275–287):**
```tsx
              <div className="mt-1 flex gap-2">
                <input
                  id="up-token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="up:yeah:…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  aria-describedby={tokenLooksWrong ? 'up-token-hint' : undefined}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-text font-mono"
                />
                {canPaste && ( ... )}
              </div>
```
**Bank `.pem` file input (`EnableBankingSetupForm.tsx` in `worktree`, lines 239–252):**
```tsx
        <label
          htmlFor="eb-key"
          className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-md px-3 py-2 max-md:min-h-11 bg-surface text-sm text-text-secondary hover:bg-surface-alt"
        >
          <FileKey2 size={16} className="shrink-0 text-text-tertiary" />
          <span className="truncate">{keyFile ? keyFile.name : 'Choose the .pem file…'}</span>
        </label>
        <input
          id="eb-key"
          type="file"
          accept=".pem,.key,application/x-pem-file"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
```
**Rules when migrating to shared `Input`:**
1. Verify in `04-01` Task 1 (`D-16`) that shipped `components/ui/Input.tsx` forwards `type`, `name`, `autoComplete`, `inputMode`, `spellCheck`, `autoCapitalize`, `maxLength`, `autoFocus`, `onPaste`, and `aria-describedby` directly onto the underlying `<input>` DOM node (not swallowed by a `<TextField>` wrapper).
2. Keep `type="password"` on `AuthGate:393,409`, `ServerSettings:419,436,453`, `UpConnectModal:276`, `PlaidConfigForm:73`, and `PlaidSetupModal:106` verbatim (`D-20`).
3. Keep `<input type="file">` (`EnableBankingSetupForm.tsx:246`) native (`D-17`).
4. Replace fixed lists (`UpConnectModal:349`, `UpSettings:110`, `PlaidEnvironmentSelect:21`, `ConnectEnableBankingModal:711`, and `ConnectEnableBankingModal:357` Country unless `WAVG-01` specifies `Combobox`) with shared `Select`; replace user-grown account link lists (`UpConnectModal:385`, `ConnectBankModal:309`, `SimplefinConnectModal:336`, `ConnectEnableBankingModal:728`) per `WAVG-01` / `D-06` (`Combobox` or `Select`); replace `UpConnectModal:404` (`type="date"`) with shared `DatePicker` (`D-07`).

---

### 4. App Shell, Dashboard & Welcome (`CommandPalette.tsx`, `CustomizeHome.tsx`, `SummaryStats.tsx`, `Welcome.tsx`)

**Analogs:** `CommandPalette.tsx`, `CustomizeHome.tsx`, `SummaryStats.tsx`, `Welcome.tsx` (`worktree`).

**`CommandPalette.tsx` (`worktree`, lines 370–389):**
```tsx
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={PALETTE_SEARCH_LABEL}
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search pages, accounts, payees…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="block w-full h-11 rounded-md border border-border pl-9 pr-3 text-sm max-md:text-base bg-surface text-text placeholder:text-text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
```
Notice `CommandPalette` binds `ref={inputRef}`, `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `onKeyDown`, and custom `h-11 pl-9 pr-3` (for the left `Search` icon). Either pass these through shared `<Input>` (once `04-01` confirms `forwardRef` + `role`/`aria-*` forwarding without `TextField` conflict) OR list `CommandPalette.tsx:370` in the `D-17` lint allowlist (`04-RESEARCH.md` Pitfall 5). Verify `e2e/tests/accessibility.spec.ts:266–297` passes unchanged.

**`SummaryStats.tsx` (`worktree`, lines 210–227):**
```tsx
                  <Select
                    compact
                    aria-label="Savings rate goal"
                    value={savingsGoal}
                    onChange={(e) => {
                      setSavingsGoal(Number(e.target.value));
                      setEditingGoal(false);
                    }}
                    className={`w-auto ${desktopHierarchy ? 'order-last self-start mt-2' : ''}`}
                  >
                    {GOAL_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}% goal
                      </option>
                    ))}
                  </Select>
```
Swap old `ui/Input` `<Select compact>` to shared `ui/Select` (`size="sm"`), keeping `w-auto` and `aria-label="Savings rate goal"`.

**`CustomizeHome.tsx` (`worktree`, lines 37–49) & `Welcome.tsx` (`worktree`, lines 256–274):**
- In `CustomizeHome.tsx:37–49`, replace `<label><input type="checkbox" .../><span>{label}</span></label>` with `<Checkbox isSelected={shown} onChange={...} className="flex-1 min-w-0">...</Checkbox>` (preserving `ArrowUp`/`ArrowDown` sibling reorder buttons and `max-md:min-h-11`).
- In `Welcome.tsx:256–274` (excerpted in `02-PATTERNS.md:339–353`), confirm Phase 2 already replaced the outer `<label>` wrapping `<Switch>` with `<div>`; if not, replace it in G4 (`04-04`).

---

### 5. Payment Plans & `WAVG-08` Bounded Numeric Validation (`NewPlanModal.tsx`, `PlanCard.tsx`, `EarlierPaymentsModal.tsx`, `planValidation.ts`)

**Analogs:** `NewPlanModal.tsx`, `PlanCard.tsx`, `EarlierPaymentsModal.tsx`, `planHelpers.ts`, `longterm/fields.tsx`, `server/src/routes/paymentPlans.ts` (`worktree`).

**`NewPlanModal.tsx` (`worktree`, lines 151–199):**
```tsx
          <div>
            <label className={label} htmlFor="plan-category">
              What it was for
            </label>
            <div className="rounded-md border border-border px-3 py-2.5 bg-surface">
              <CategorySelect
                value={form.categoryId}
                onChange={(id) => set('categoryId', id)}
                groups={purchaseGroups(groups)}
                label="What it was for"
              />
            </div>
          </div>
          ...
          <div>
            <label className={label} htmlFor="plan-count">
              Number of payments
            </label>
            <Input
              id="plan-count"
              type="number"
              min={Math.max(1, linked.length)}
              max={60}
              value={form.instalmentCount}
              onChange={(e) => set('instalmentCount', Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
```
**Server Zod contract (`server/src/routes/paymentPlans.ts` in `worktree`, line 94):**
```ts
  instalmentCount: z.number().int().min(1).max(60),
```
**Bounded non-money numeric field analog (`client/src/components/longterm/fields.tsx` in `worktree`, lines 79–85):**
Keep a controlled string draft alongside the numeric state so invalid or out-of-range edits (`< Math.max(1, linked.length)` or `> 60` or non-integer) mark `isInvalid` without `type="number"` spin buttons, using shared `<Input type="text" inputMode="numeric" ... />` (`D-14`). Extract a pure parser/validator helper (e.g. `parseInstalmentCount(raw, min, max = 60)`) in `client/src/components/plans/planValidation.ts` with a failing-first Vitest test covering `min` (including `linked.length > 1`), `max = 60`, non-integer, and empty inputs.

Also in `NewPlanModal.tsx` and `PlanCard.tsx`:
- Replace `CategorySelect` (`NewPlanModal.tsx:156`, `PlanCard.tsx:322`) with `CategoryPicker` (`D-05`), removing the outer `rounded-md border ...` `<select>` wrapper box so `CategoryPicker` renders its own button trigger (or match Phase 3's `CategorySelectButton` replacement pattern).
- Replace all `type="date"` inputs (`NewPlanModal:179,265`, `PlanCard:212,315`) with `DatePicker` (`D-07`).
- Replace `Select` (`NewPlanModal:204` frequency, `EarlierPaymentsModal:36` lookback -> shared `Select`; `NewPlanModal:220,236` account pickers -> `Combobox` or `Select` per `WAVG-01` audit) and `NewPlanModal:253` checkbox -> `Checkbox`.

---

### 6. `WAVG-08` Search-Based Vitest Guard (`client/src/utils/noNumberMoney.test.ts`)

**Analog:** `client/src/utils/movedSections.test.ts` (`worktree`, lines 62–85) + comment-stripping helper in `lint/terms/terms.test.js`.

```ts
// client/src/utils/movedSections.test.ts (worktree, lines 66-85)
    const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const files = Object.keys(sources).filter(
      (file) => file !== './movedSections.ts' && !/\.test\.tsx?$/.test(file),
    );
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) { ... }
```
Copy `import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })`, exclude `*.test.ts`/`*.test.tsx`, strip `/* ... */` and `// ...` comments, and assert zero matches for `/\btype\s*=\s*(?:["']number["']|\{\s*["']number["']\s*\})/` (verified against `04-RESEARCH.md` §4: all 10 current `type="number"` sites are non-money, and after Phase 3 + `NewPlanModal.tsx:193` zero remain; if `D-16` Task 1 discovers any Phase 3 non-money site intentionally kept `type="number"`, assert exact allowlist parity with zero money fields).

---

### 7. Shelved & Split-Candidate Mechanical Swap (`Review`, `CashFlow`, `Tax`, `Household` — `D-09`)

**Analogs:** `pages/Review.tsx`, `components/review/*`, `pages/CashFlow.tsx`, `pages/Tax.tsx`, `components/tax/*`, `pages/Household.tsx`, `components/household/*` (`worktree`).

**A. `CashFlow.tsx`:** Zero raw or legacy `ui/Input` fields (`MonthRangePicker` at line 1184 only). Verify untouched.

**B. `Review.tsx` + `components/review/*`:**
- `Review.tsx:497–509`: Keep `w-48 max-md:w-full` wrapper around shared `<Select size="sm">` (fixed group filter).
- `Housekeeping.tsx:190–203`: Keep `w-52` wrapper; swap `Select` (`Category for ${s.name}`) to `CategoryPicker` (`D-05`) or shared `Select` per `WAVG-01` audit (`D-16`).
- `Resilience.tsx:409,428,441,455`: Swap 2 `Select` (`sm` or `md`) and 2 `Input` (`inputMode="decimal"` and `inputMode="numeric"`), keeping `grid-cols-2 gap-3 max-md:grid-cols-1` and `reset()` handlers verbatim.
- `SortUncategorised.tsx:271–279`: Remove wrapping `<label>` and swap `<input type="checkbox">` to `<Checkbox>` (`"Also apply to future transactions"`).

**C. `Tax.tsx` + `components/tax/*`:**
- `Tax.tsx:131–144, 778–799`: Swap `Select` (`Financial year`), `Input` (`Merchant`), and `Input type="date"` (`Receipt date` -> `DatePicker`) inside `grid grid-cols-1 sm:grid-cols-3 gap-2`, leaving `CurrencyInput` (`L592`, `L794`) untouched.
- `Assets.tsx:509–549, 573–609`: Verify in `04-01` (`D-16`) that shared `Input` forwards `list="asset-lives"` (`Assets.tsx:528` `<datalist>`) directly to `<input>`. Swap `partOfSet` checkbox (`L574`) to `Checkbox` and `method` radio fieldset (`L589–610`) to `RadioGroup` + `Radio` (preserving `METHOD_NAMES[m]` cards/borders or mapping selected styling via `data-[selected]` per `D-03`/`D-09`).
- `CarAndHome.tsx:261–288, 349–375`: Swap 3 `type="date"` to `DatePicker`, 4 `Input` to shared `Input`, 1 `Select` (`L57`) to shared `Select`, and `WEEKDAYS` checkbox group (`L361–374`) to `Checkbox`.
- `TaxClaimSection.tsx:99–150` & `ReceiptsSection.tsx:81`: Reconcile in `04-01` (`D-16`) whether Phase 3 already migrated these (`TransactionDetailPanel.tsx` callers); keep `<input type="file">` (`ReceiptsSection.tsx:81`) native (`D-17`).

**D. `Household.tsx` (`1598` lines) + `components/household/*` — Uncontrolled `FormData` Preservation:**
```tsx
// pages/Household.tsx (worktree, lines 329-365 & 846-946)
      <label className={field}>
        Name
        <Input name="name" required maxLength={200} placeholder="e.g. Home" />
      </label>
      <label className={field}>
        People, one per line; put yourself first
        <textarea className={textareaClass} name="people" rows={3} required placeholder={'Me\nHousemate'} />
      </label>
      <label className={field}>
        Household pool account (AUD)
        <Select name="accountId" value={newPool} onChange={(e) => setNewPool(e.target.value)}> ... </Select>
      </label>
// ...
      <Input type="date" name="date" defaultValue={payment?.date ?? today()} required />
// ...
      <Select name="payerId" defaultValue={payment?.accountId === state.group.accountId ? '' : self?.id}> ... </Select>
// ...
      <input type="checkbox" name={`include-${p.id}`} defaultChecked className="h-4 w-4 accent-brand-600" />
```
```tsx
// pages/Household.tsx (worktree, lines 1315-1335) — compact inline toolbar widths:
                      <label className={`${field} w-36`}>
                        <span className="text-xs">Report scope</span>
                        <Select value={scope} ...> ... </Select>
                      </label>
                      <label className={`${field} w-40`}>
                        <span className="text-xs">From</span>
                        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                      </label>
```
**Critical `Household.tsx` rules (`D-09`, `D-16`):**
1. Never split `Household.tsx` (`D-09`); assign all 35 `Household.tsx` controls to a single plan (`04-05`).
2. Verify in `04-01` Task 1 that shipped `Input`, `Textarea`, `Select`, `DatePicker`, and `Checkbox` forward `name` + `defaultValue`/`defaultSelected` to React Aria's hidden form inputs so `new FormData(e.currentTarget)` receives every key (`name`, `people`, `accountId`, `description`, `date`, `amount`, `payerId`, `recipientId`, `advance`, `include-${p.id}`, `billId`, `reversesId`, `transactionId`, `dueDate`, `personalShare`, `reserved`, `scheduleId`, `isDefault`).
3. Keep `w-36` / `w-40` inline filter widths (`L1315–1335`) and `RepaymentCategoryOffers.tsx:90–102` (candidate-only `Select` showing owed amounts, unless `WAVG-01` overrides) intact; keep `<input type="file">` (`HouseholdIcon.tsx:89`) native (`D-17`); keep `QuickExpense.tsx:150` `Slider` untouched.

---

### 8. `WAVG-09` ESLint Guard & Config (`lint/rules/no-raw-form-control.js`, `no-raw-form-control.test.js`, `lint/eslint.config.js`, `lint/package.json`)

**Analogs:** `lint/rules/icon-only-control.js`, `lint/rules/icon-only-control.test.js`, `lint/eslint.config.js`, `lint/package.json` (`worktree`).

**Rule + schema pattern** (`icon-only-control.js` lines 17–19 & 60–88, plus structured `allow` option for `D-17` entries):
```js
// lint/rules/icon-only-control.js (worktree, lines 60-68, 76-85)
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unnamed:
        'An icon-only button or link needs a name: add aria-label, or visible text (audit F-15).',
    },
  },
  // ...
```
In `lint/rules/no-raw-form-control.js`:
- Match `JSXOpeningElement` where `node.name.type === 'JSXIdentifier'` and `RAW_CONTROLS.has(node.name.name)` (`'input'`, `'select'`, `'textarea'`).
- Allow `<input>` when a static `JSXAttribute` has `name.name === 'type'` and `Literal` value `'file'` (`D-17`).
- Accept `schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, element: { enum: ['input', 'select', 'textarea'] }, reason: { type: 'string' } }, required: ['file', 'element', 'reason'], additionalProperties: false } } }, additionalProperties: false }]` so any non-file `D-17` native field from `WAVG-01`/G2–G4 lives in one auditable list in `lint/eslint.config.js` with its reason on the line (`D-21`).

**Test harness pattern (`lint/rules/icon-only-control.test.js`, lines 1–19):**
```js
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './icon-only-control.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
```
In `lint/rules/no-raw-form-control.test.js`, test `valid` (`<Input />`, `<Select />`, `<Textarea />`, `<DatePicker />`, `<input type="file" />`, allowlisted `{ file, element, reason }` case via `filename`) and `invalid` (`<input />`, `<input type="text" />`, `<input type="date" />`, `<input type="password" />`, `<select />`, `<textarea />`, plus `<input type="file" />` refused if element is `select`).

**Flat-config registration & `controlComponents` update (`lint/eslint.config.js`, lines 80–84, 123–130):**
```js
// Lines 80-84 (worktree) — MUST hold both rules on one `allotment` plugin object:
  {
    files: ['client/src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { allotment: { rules: { 'icon-only-control': iconOnlyControl } } },
    rules: { 'allotment/icon-only-control': 'error' },
  },
```
Define `const allotmentPlugin = { rules: { 'icon-only-control': iconOnlyControl, 'no-raw-form-control': noRawFormControl } };` once so ESLint 9 never throws `Cannot redefine plugin "allotment"`, apply `'allotment/no-raw-form-control': ['error', { allow: [...] }]` in a block with `files: ['client/src/**/*.tsx']` and `ignores: ['**/*.test.tsx', 'client/src/components/ui/**']`, and **do not** use `no-restricted-syntax` (which already holds `toISOString()` at lines 55–63). At lines 123–130, remove `'Select'` from `controlComponents: ['Input', 'Select', 'CurrencyInput', 'MoneyInput', 'AmountInput']` once `ui/Input.tsx` removes `Select` in G5 (`04-RESEARCH.md` Pitfall 6). Run `cd lint && npm run lint:report` and lower `--max-warnings=128` in `lint/package.json:8` to the exact new warning count (`D-21`).

---

### 9. `WAVG-10` Removals & Documentation Updates (`ui/Input.tsx`, legacy pickers, `DESIGN.md`, `MAP.md`, `HANDOVER-UI.md`, `DEVELOPMENT.md`, `WAVES.md`, `CLAUDE.md`/`AGENTS.md`)

**Analogs:** `client/src/components/ui/Input.tsx` (lines 15–30), `client/src/components/transactions/CategorySelect.tsx`, `MerchantSelect.tsx` (lines 7–30), `DESIGN.md` (lines 289–292), `docs/ui/MAP.md` (lines 95–129), `docs/ui/HANDOVER-UI.md` (lines 127–128, 144–145), `docs/DEVELOPMENT.md` (line 227), `docs/ui/WAVES.md` (lines 5–36).

- **Code removals (`D-22`):** Delete `compactSelectClass` and `export const Select` (`client/src/components/ui/Input.tsx:15–30`), delete `CategorySelect.tsx`, `MerchantSelect.tsx` (+ `selectorInputClass`), `CategorySelectButton.tsx` (if unused after Phase 3), and orphaned `inputClass`/`textareaClass` constants. Search `client/src`, `e2e/`, `client/src/demo/`, and `docs/` for every removed symbol before opening G5.
- **Doc edits (`WAVG-10`):**
  - `DESIGN.md:289–292` (`### Inputs and selects`): record the 11 shared controls (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`) + `CurrencyInput`, phone native pickers `< 768px`, and the Wave G picker rule (`D-05`, `D-06`).
  - `docs/ui/MAP.md:113`: replace `Input.tsx: Input, Select` with the 11 shared controls, document `allotment/no-raw-form-control` and `noNumberMoney.test.ts`, and refresh `wc -l client/src/pages/*.tsx` line counts (`MAP.md:3`).
  - `docs/ui/HANDOVER-UI.md:127–128`: replace the Wave E `Select` rule (`"a short fixed list uses the one shared styled Select (components/ui/Input.tsx)"`) with Wave G's picker rule + lint guard; update `§Done this session`.
  - `docs/DEVELOPMENT.md:227`: remove stale `/CategorySelect` reference if `CategorySelect` is deleted.
  - `docs/ui/WAVES.md:5–36`: record Wave G completion (or follow owner guidance at merge per line 5–6).
  - `CLAUDE.md` & `AGENTS.md`: if adding the picker/lint rule, keep both files byte-identical (`cmp -s CLAUDE.md AGENTS.md`).

---

### 10. G4 E2E Helpers & Selector Updates (`e2e/tests/fixtures.ts`, `e2e/tests/*.spec.ts`)

**Analogs:** `e2e/tests/fixtures.ts` (`typeAmount`, lines 201–209), `e2e/tests/dashboard.spec.ts` (line 103), `e2e/tests/settings.spec.ts` (line 431), `e2e/tests/household-categories.spec.ts` (line 73), plus Phase 2's `fillDate` pattern in `02-PATTERNS.md` §17.

```ts
// e2e/tests/dashboard.spec.ts (worktree, line 103) — desktop role shifts combobox -> button:
    await expect(page.getByRole('combobox', { name: 'Savings rate goal' })).toBeVisible();
```
```ts
// e2e/tests/settings.spec.ts (worktree, line 431) — native month .fill() -> MonthPicker helper:
  await page.getByLabel('Start month').fill(thisMonth);
```
```ts
// e2e/tests/household-categories.spec.ts (worktree, line 73) — combobox + toHaveValue -> button + toContainText:
  await expect(offers.getByRole('combobox', { name: 'Category for Paid Sam back' })).toHaveValue(
    restaurants.id,
  );
```
- **Phone vs Desktop (`D-04`):** Keep `selectOption` / `combobox` / `.fill()` in `e2e/tests/phone/*.spec.ts` because phones `< 768px` render native `<select>`, `<input type="date">`, and `<input type="month">`. On desktop specs (`dashboard.spec.ts:103`, `currencies.spec.ts`, `resilience.spec.ts`, `server-mode/auth.spec.ts`, `up.spec.ts`, `switchers.spec.ts`, `enable-banking.spec.ts`, `review.spec.ts`, `review-undo.spec.ts`, `household.spec.ts`, `household-categories.spec.ts`, `multi-user/people.spec.ts`, `investments.spec.ts`), click the `button` trigger (`getByRole('button', { name: ... })`) and click `getByRole('option', { name: ... })`.
- **Date & Month helpers:** Use Phase 2's `fillDate` (`fixtures.ts`) for `UpConnectModal`, `Household`, `Tax`, `Assets`, `CarAndHome`, `NewPlanModal`, `PlanCard`, `CurrencySettings`, `DataExport`, and add `fillMonth(trigger, yyyyMm)` in `e2e/tests/fixtures.ts` (supporting native `<input type="month">` `.fill()` on phone and desktop `MonthPicker` `dialog` year-stepping + month button click) for `settings.spec.ts:431`.

---

## Shared Patterns

### D-16 Gate: Shipped Control & Audit Verification
**Source:** `docs/superpowers/gsd-records/phases/04-remaining-screens-and-the-guard/04-CONTEXT.md` (D-16, D-17), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-PATTERNS.md`
**Apply to:** `04-01-PLAN.md` (before any Wave 2 screen migration)
Verify against `docs/ui/FORM-CONTROLS-AUDIT.md` and shipped `client/src/components/ui/`:
1. Every list's `WAVG-01` classification (`Select` vs `Combobox` vs `CategoryPicker`), especially `CurrencySelect`, `ConnectEnableBankingModal` Country, `Housekeeping:191`, `CurrencyDifference:83`, `RepaymentCategoryOffers:90`, and `TagManager:53`.
2. Boundary files potentially already moved in Phase 3 (`CategoryManager.tsx`, `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx`, `CurrencySelect.tsx`, `CurrencyDifference.tsx`, `ShareWithHousehold.tsx`, `TaxClaimSection.tsx`, `ReceiptsSection.tsx`).
3. `Input` HTML attribute passthrough (`type`, `name`, `autoComplete`, `inputMode`, `spellCheck`, `autoCapitalize`, `maxLength`, `onPaste`, `list`, `role`, `aria-*`, `ref`) and `FormData` `name` + `defaultValue`/`defaultSelected` support across `Input`, `Textarea`, `Select`, `DatePicker`, `MonthPicker`, `Checkbox`.

### `D-20` Sign-In & Bank Credential Preservation
**Source:** `AuthGate.tsx`, `UpConnectModal.tsx`, `EnableBankingSetupForm.tsx` (`worktree`), `ServerSettings.tsx`, `PeopleSettings.tsx`, `ReminderSettings.tsx` (`wt-f`), `SECURITY.md`
**Apply to:** `AuthGate`, `ServerSettings`, `PeopleSettings`, `ReminderSettings`, `UpConnectModal`, `PlaidConfigForm`, `PlaidSetupModal`, `SimplefinConfigForm`, `SimplefinConnectModal`, `EnableBankingSetupForm`, `ConnectEnableBankingModal`
Preserve `type="password"`, `autoComplete`, `inputMode`, `spellCheck`, `autoCapitalize`, `onPaste`, `aria-describedby`, `font-mono`, and adjacent Paste buttons verbatim; never unmask secrets or place real tokens in fixtures.

### `D-09` Shelved-Page Mechanical Swap & `useCanSave`
**Source:** `Household.tsx`, `Tax.tsx`, `Review.tsx`, `CashFlow.tsx` (`worktree`), `CLAUDE.md`
**Apply to:** All G4 screen files
Replace only the field primitive (`D-03`, `D-09`, `D-15`). Preserve labels, wording, `useCanSave()`, `<SavingPausedHint />`, Safe mode (`<Private>`), layout grid/width classes (`w-36`, `w-40`, `w-48`, `w-52`, `grid-cols-1 sm:grid-cols-3`), and single-file ownership without splitting `Household.tsx`, `Tax.tsx`, `CashFlow.tsx`, or `ConnectEnableBankingModal.tsx`.

### Single `allotment` Plugin Registration (`lint/eslint.config.js`)
**Source:** `lint/eslint.config.js` (`worktree`, lines 55–85)
**Apply to:** G5 `lint/` changes
Register `icon-only-control` and `no-raw-form-control` together on one `allotment` plugin object; never add a second `allotment` plugin declaration or a second `no-restricted-syntax` block.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lint/rules/no-raw-form-control.js` (rule options `allow` schema) | middleware / rule | transform (AST) | `lint/rules/icon-only-control.js` (`worktree`) provides the exact plugin/visitor/ESLint-9 structure, but uses `schema: []` and inspects `<button>`/`<a>` children. The new rule adds an `allow` schema + `JSXOpeningElement` attribute inspection (`type="file"`) per `04-RESEARCH.md` Example 1. |
| `e2e/tests/fixtures.ts` (`fillMonth` helper) | utility | event-driven | `e2e/tests/fixtures.ts` (`worktree`) has `typeAmount` and Phase 2 adds `fillDate`, but no `MonthPicker` desktop popover helper exists yet; build it against Phase 2's shipped `MonthPicker` `Dialog` (`aria-label="Choose a month"`, year steppers, month grid buttons, `"This month"`). |

---

## Metadata

**Analog search scope:** `client/src/components/{auth,currency,dashboard,enablebanking,household,layout,longterm,plaid,plans,review,simplefin,tax,transactions,ui,up}/`, `client/src/pages/`, `client/src/utils/`, `server/src/routes/paymentPlans.ts`, `lint/`, `e2e/tests/`, `DESIGN.md`, `docs/` (`worktree-agent-p04-patterns`), plus `client/src/components/settings/` (`/Users/tristanvanrooyen/wt-f`, branch `wave-f`).
**Files verified tracked via `git ls-files`:** 72 tracked files (61 in `worktree` + 11 in `wt-f`)
**Pattern extraction date:** 2026-11-16
