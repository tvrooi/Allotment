---
phase: "04"
slug: "remaining-screens-and-the-guard"
status: approved
reviewed_at: "2026-11-16"
shadcn_initialized: false
preset: none
created: "2026-11-16"
---

# Phase 04 — UI Design Contract

> Visual and interaction contract for Phase 04: Remaining screens and the guard (Wave G G4–G5). Consumes `docs/superpowers/gsd-records/phases/04-remaining-screens-and-the-guard/04-CONTEXT.md` (D-01 through D-22), `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md` (D-12 through D-17), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` (D-01 through D-11), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (inherited without change), `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-UI-SPEC.md` (mapping conventions followed), `docs/superpowers/gsd-records/phases/04-remaining-screens-and-the-guard/04-RESEARCH.md`, `docs/superpowers/gsd-records/REQUIREMENTS.md` (WAVG-07 through WAVG-10), `DESIGN.md`, `docs/BRAND.md`, `docs/ui/MAP.md`, `docs/ui/HANDOVER-UI.md`, `SECURITY.md`, `lint/eslint.config.js`, and `client/src/index.css`.
>
> **Provenance note:** Wave F (`Settings.tsx` 8 tabs, `AccountConnections.tsx`, `BudgetCategories.tsx`, `ConnectedBanks.tsx`) is already present in `client/src` on this worktree (`fc53307`) and matches `/Users/tristanvanrooyen/wt-f/client/src`. Phase 2's shared controls (`client/src/components/ui/`) and Phase 3's migrations (G2 and G3) have not shipped yet; per `D-12`, `D-16`, `D-18`, and `D-19`, G4 starts only after PR #273, Phase 2, and Phase 3 (G2 and G3) merge to `redesign`, and G5 starts only after G4 merges to `redesign`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (`components.json` absent; inherits `02-UI-SPEC.md`, D-01, D-02) |
| Preset | not applicable |
| Component library | `react-aria-components` (`1.22.1`, lockfile-verified in `client/package-lock.json`; consumed only via `client/src/components/ui/`, never imported directly by Phase 4 screens per D-01) |
| Icon library | `lucide-react` (`1.55.0`, lockfile-verified in `client/package-lock.json`) |
| Font | `Inter, ui-sans-serif, system-ui, sans-serif` (`@fontsource/inter`, weights `400` and `500` inherited from `02-UI-SPEC.md`) |

---

## Component Inventory

Enumerated by `ls client/src/components/ui/*.tsx | wc -l` — 33 components — flybudget@0.2.0-up.174 (commit `fc53307`; Phase 2 adds 8 shared controls over `react-aria-components@1.22.1`) — 2026-11-16.

> Non-exhaustive inventory inherited from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` and aligned with `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-UI-SPEC.md`. Phase 4 G4 consumes the 11 Phase 2 shared form controls, `CategoryPicker`, `PayeeCombobox`, and existing untouched shared primitives; screens do not import `react-aria-components` directly (D-01) and add zero npm packages in `client/` or `lint/` (D-02). Phase 4 G5 deletes the superseded `Select` export in `ui/Input.tsx` and legacy picker components (`WAVG-10`, D-22).

| Component | Import path | Phase 4 Usage |
|-----------|-------------|---------------|
| `Field`, `Label` | `client/src/components/ui/Field.tsx`, `Label.tsx` | Vertical `gap-1` stack (`Label`, control, help, `FieldError`); `Label elementType="span"` for non-labelable React Aria triggers (`Select`, `DatePicker`, `MonthPicker`, `RadioGroup`) so `strayLabels` stays zero |
| `Input`, `Textarea` | `client/src/components/ui/Input.tsx`, `Textarea.tsx` | All text, search, URL, email, password, OTP/token (`D-20`), numeric/decimal non-money inputs, `D-14` ex-`type="number"` (`NewPlanModal` `instalmentCount`), and multiline textareas (`md` `h-10` default, `sm` `h-8` compact); native `Select` export in `ui/Input.tsx` is deleted in **G5** |
| `Select`, `Combobox` | `client/src/components/ui/Select.tsx`, `Combobox.tsx` | Fixed lists (`Select`, with grouped `ListBoxSection` support where `<optgroup>` exists) vs user-grown lists (`Combobox`), per D-05/D-06 and `WAVG-01` audit confirmation (`D-16`); renders native `<select>` below `768px` (`useIsPhone`, D-04) |
| `Checkbox`, `RadioGroup` | `client/src/components/ui/Checkbox.tsx`, `RadioGroup.tsx` | All checkboxes (labelled, multi-line description, and inline list toggles) and radio groups (`PeopleSettings` channel, `Assets` calculation method) |
| `Switch` | `client/src/components/ui/Switch.tsx` | Already used on `Welcome.tsx` (verify outer `<label>` wrapper removal if Phase 2 did not already remove it) |
| `DatePicker`, `MonthPicker` | `client/src/components/ui/DatePicker.tsx`, `MonthPicker.tsx` | Every remaining `type="date"` field (`CurrencySettings`, `DataExport`, `UpConnectModal`, `Household`, `EditEntry`, `ReconcileBalances`, `Tax`, `Assets`, `CarAndHome`, `NewPlanModal`, `PlanCard`) and the sole `type="month"` field (`BudgetStartSettings`, D-11); native `<input type="date">` / `<input type="month">` below `768px` (`D-04`) |
| `CategoryPicker`, `PayeeCombobox` | `client/src/components/transactions/CategoryPicker.tsx`, `PayeeCombobox.tsx` | Replaces `CategorySelect` in `NewPlanModal.tsx` and `PlanCard.tsx` (and category selectors in `Housekeeping.tsx`, `CurrencyDifference.tsx` if confirmed by `D-16` / audit, per D-05) |
| `CurrencyInput`, `amountValidity` | `client/src/components/ui/CurrencyInput.tsx`, `amountValidity.tsx` | Money entry (`type="text" inputMode="decimal"`); kept untouched in `Tax.tsx`, `Assets.tsx`, `NewPlanModal.tsx`, `PlanCard.tsx` (D-15) |
| `Slider`, `MonthRangePicker` | `client/src/components/ui/Slider.tsx`, `MonthRangePicker.tsx` | Kept untouched: `QuickExpense.tsx` uses `Slider` (`<input type="range">` inside `components/ui/`, exempt from G5 rule); `CashFlow.tsx` uses only `MonthRangePicker` |

---

## Spacing Scale

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (multiples of 4 only: `4, 8, 16, 24, 32, 48, 64`, plus Phase 2 exceptions `0px`, `12px`, `20px`, `32px` `sm`, `36px` `ListBoxItem`, `40px` `md`, `44px` phone touch targets, `80px` `Textarea` default `min-h-20`).

Phase 4 screen-migration exceptions (all multiples of 4, preserving incumbent screen layout and density per D-03, D-09, D-15):
- `16px` (`h-4 w-4`) swatch dot inside `TagManager.tsx:51-65`: keep the `16×16 px` visual colour dot in each tag row (`max-md:min-h-11 max-md:min-w-11` hit area around the trigger on phones if swapped to a compact `Select` swatch trigger, or keep native if `D-17` audit classifies it so).
- `32px` (`h-8`, `size="sm"`): Compact desktop height for inline toolbar/filter/row fields (`SummaryStats.tsx` savings rate goal `compact` trigger, `CurrencySettings.tsx` `AddRate` inline row beside `size="sm"` `Add rate` button, `Household.tsx:1315-1335` activity filter bar `w-36`/`w-40` controls, `Review.tsx:500` category filter, `Housekeeping.tsx:191` saver category select, `HouseholdSharing.tsx:144`, `CombinedHousehold.tsx:80,146`, `RepaymentCategoryOffers.tsx:90`).
- `40px` (`h-10`, `size="md"`): Default desktop height for fields in Settings panels (`BudgetStartSettings`, `PeopleSettings`, `PrioritiesSettings`, `ReadOnlyAccess`, `ReminderSettings`, `ServerSettings`, `CurrencySettings` `Download` URL, `DataExport`), Bank connection forms & modals (`UpConnectModal`, `UpSettings`, `Plaid*`, `Simplefin*`, `EnableBanking*`), `AuthGate`, `NewPlanModal`, `PlanCard`, `EarlierPaymentsModal`, `Tax`, `Assets`, `CarAndHome`, `TaxClaimSection`, `Household` modals/forms, and `CurrencyDifference`.
- `44px` (`max-md:min-h-11`, `max-md:min-w-11`; `h-11` on `CommandPalette.tsx:370` search input at all widths): Mandatory minimum touch target height on phones (`< 768px`, `useIsPhone`) for every migrated control, including standalone checkboxes in `Household.tsx` (`360`, `911`, `941`, `1538`), `CustomizeHome.tsx:38`, `SortUncategorised.tsx:272`, `Assets.tsx:574`, `CarAndHome.tsx:363`, `TaxClaimSection.tsx:100`, `ConnectEnableBankingModal.tsx:759`, and `NewPlanModal.tsx:253`.

---

## Typography

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (4 sizes — `12px` Helper/Meta, `14px` Label/Desktop Control, `16px` Body/Phone Control `max-md:text-base`, `28px`/`24px` Display — and 2 weights `400` regular / `500` medium).

Screen preservation notes (D-09, D-15):
- Existing page headers, section titles, `font-mono` token/code/ID/URL inputs (`AuthGate.tsx:363`, `PeopleSettings.tsx:250,285`, `UpConnectModal.tsx:276`, `SimplefinConfigForm.tsx:61`, `SimplefinConnectModal.tsx:164`, `EnableBankingSetupForm.tsx:224`, `ConnectEnableBankingModal.tsx:536`), `uppercase` code formatting (`AuthGate.tsx:363`), and `text-center` narrow symbol inputs (`PreferencesPanel.tsx:291` `w-20`, `CurrencySettings.tsx:464` `w-20`) are preserved via `className` on shared `Input`.
- In `Household.tsx`, `Tax.tsx`, `Review.tsx`, and `CashFlow.tsx`, all existing typography, headings, helper paragraphs, and labels stay untouched (`D-09`).

---

## Color

Inherited verbatim from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` (`@theme` light / `.dark` dark tokens only: 60% `--color-page` / `--color-surface`, 30% `--color-surface-alt` / `--color-border` / `--color-border-light` / `--color-hover`, 10% `--color-brand-600` accent reserved strictly for the Phase 2 focus/selection/inline-action list, and `--color-negative` for invalid/destructive states).

One-off form-control color defects eliminated during Phase 4 G4 migration (D-03):
1. Remove `border-brand-500` / `ring-brand-500` one-offs on `CurrencySelect.tsx:52`, `CurrencyDifference.tsx:87`, and `CurrencySettings.tsx:353` (`focus:ring-brand-500`) — unify on `--color-brand-600` (`border-brand-600`, `ring-brand-600`) via shared `Select`/`Combobox`/`CategoryPicker`/`Checkbox`.
2. Remove `disabled:opacity-60` on `CurrencySelect.tsx:52` — use the Phase 2 shared disabled surface (`bg-surface-alt text-text-disabled border-border-light`).
3. Replace ad-hoc `inputClass` / `textareaClass` / `labelClass` constants in `BudgetStartSettings.tsx:12`, `CurrencySettings.tsx:31`, `PeopleSettings.tsx`, `ReadOnlyAccess.tsx`, `ReminderSettings.tsx`, `ServerSettings.tsx`, `AuthGate.tsx`, `ConnectEnableBankingModal.tsx:662`, `EnableBankingSetupForm.tsx`, `PlaidConfigForm.tsx`, `PlaidSetupModal.tsx`, `SimplefinConfigForm.tsx`, `SimplefinConnectModal.tsx`, `UpConnectModal.tsx` (`py-2` without height token), and `Household.tsx` with the shared `components/ui/` control classes.

---

## Copywriting Contract

Phase 4 makes **no user-facing wording, label, or validation-copy changes** on any migrated screen (`D-09`, `D-15`), and adds explicit lint/documentation copy for `WAVG-09` and `WAVG-10`.

| Element | Copy |
|---------|------|
| Primary CTA | Unchanged per screen (`Connect`, `Save`, `Save priorities`, `Create token`, `Start budget here`, `Add rate`, `Change password`, `Save event`, `Add bill`, `Add`, `Record difference`, `Categorise`, `Done`, etc.) — `useCanSave()` gating and `<SavingPausedHint />` remain unchanged (`D-15`). |
| Empty state heading | Unchanged per screen (`"No matching options"` in generic shared `Combobox`; `"No categories found"` in `CategoryPicker` for `NewPlanModal` and `PlanCard`). |
| Empty state body | Unchanged per screen (`"Nothing matches “{query}”."` in `CommandPalette.tsx:393`, untouched; all screen empty states preserved verbatim). |
| Error state (screen forms & validation) | All existing screen error banners, API errors, and inline hints stay verbatim (including `AuthGate.tsx`, `UpConnectModal.tsx` `"That doesn’t look like an Up token..."`, `CurrencySettings.tsx` `"Type the rate as a positive number, like 1.0812."`, `NewPlanModal.tsx` `error`, `Household.tsx` `error`, `PrioritiesSettings.tsx` `message`). For `NewPlanModal.tsx:193` (`WAVG-08` `instalmentCount` `1..60`), non-integer or out-of-range input uses `isInvalid` without changing existing submit gating (`form.instalmentCount >= Math.max(1, linked.length)` and `<= 60` server cap). |
| ESLint guard refusal message (`WAVG-09`, D-21) | Exact developer-facing error reported by `allotment/no-raw-form-control`: `"Use a shared control from client/src/components/ui/ instead of raw <{{name}}> (Wave G, WAVG-09)."` (severity: `error`). |
| Destructive confirmation | Unchanged (`TagManager` `ConfirmModal`, `DataExport` restore, `ServerSettings`, `Household` deletes, `Assets` deletes keep exact wording). |

### Documentation Copy Recorded in G5 (`WAVG-10`, D-05, D-06, D-21, D-22)

Update `DESIGN.md` (`§Components → Inputs and selects`), `docs/ui/MAP.md` (`§client/src/components/ui primitives` + refreshed `wc -l client/src/pages/*.tsx`), `docs/ui/HANDOVER-UI.md` (`§Decisions` lines 127–128 + `§Done this session`), `docs/DEVELOPMENT.md` (remove stale `CategorySelect` line 227), `docs/ui/WAVES.md` (record G4/G5 status or retire per owner note), and `CLAUDE.md`/`AGENTS.md` (identical if touched; verify `cmp -s CLAUDE.md AGENTS.md`) with these three normative contracts:
1. **Shared control set (`11` controls + money input):** `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field` in `client/src/components/ui/`, built on `react-aria-components` with `@theme` tokens (`h-10` default, `h-8` compact `sm`, `max-md:min-h-11` and `16px` text on phones `< 768px`, native `Select`/`DatePicker`/`MonthPicker` under `768px`), alongside `CurrencyInput` for money (`type="text" inputMode="decimal"`, never `type="number"`).
2. **Wave G picker rule (`D-05`, `D-06`):** Categories always use `CategoryPicker`; payees always use `PayeeCombobox`; fixed lists use shared `Select`; lists the user grows (accounts, tags, households, people, etc.) use shared `Combobox`.
3. **Raw-control lint guard (`WAVG-09`, `D-21`):** ESLint rule `allotment/no-raw-form-control` (`lint/rules/no-raw-form-control.js`) errors on any raw `<input>`, `<select>`, or `<textarea>` in `client/src/**/*.tsx` outside `client/src/components/ui/`, except `<input type="file">` and explicit `D-17` audit allowlist entries with per-entry reasons.

---

## Screen-Migration, Guard & Removal Contract (G4 and G5)

### 1. Phase 4 Delivery Split (`D-18`, `D-19`)

| PR | Requirements | Scope & Gate |
|----|--------------|--------------|
| **G4** | `WAVG-07`, `WAVG-08` | Blocked until PR #273, Phase 2, and Phase 3 (G2 + G3) are merged to `redesign` (`D-12`, `D-19`). Starts with Task 1 (`D-16` audit & Phase 3 boundary check). Migrates all remaining screens (`Settings`, `Bank connections`, `Review`, `CashFlow`, `Household`, `Tax`, `Dashboard`, `PaymentPlans`, `Welcome`, `AuthGate`, `CommandPalette`, `components/currency/*`), eliminates the final `type="number"` (`NewPlanModal.tsx:193`), and adds the Vitest source-scan test proving zero money fields use `type="number"` anywhere in `client/src`. |
| **G5** | `WAVG-09`, `WAVG-10` | Blocked until G4 is merged to `redesign` (`D-18`). Adds `lint/rules/no-raw-form-control.js` + `no-raw-form-control.test.js`, updates `controlComponents` in `lint/eslint.config.js:126`, lowers `--max-warnings` in `lint/package.json:8` (`<= 128`), deletes `Select` from `ui/Input.tsx` plus legacy pickers/classes (`D-22`), verifies zero remaining imports/references across `client/src`, `e2e/`, `client/src/demo/`, and `docs/`, and updates UI docs. |

---

### 2. G4 Screen-by-Area Mapping & Edge Cases (`WAVG-07`, `D-09`, `D-13`, `D-16`, `D-20`)

> **Audit precedence (`D-16`):** Task 1 of G4 MUST check every file, list classification (`Select` vs `Combobox` vs `CategoryPicker`), and native exception below against the shipped `WAVG-01` audit, shipped `client/src/components/ui/` props, and the merged G2/G3 PR diffs (`CategoryManager.tsx`, `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx`, `CurrencySelect.tsx`, `ShareWithHousehold.tsx`, `TaxClaimSection.tsx`, `ReceiptsSection.tsx`). Where `WAVG-01` disagrees on a list classification or native exception, `WAVG-01` wins (`D-06`, `D-17`).

| Area | Files & Incumbent Controls | Target Shared Control & Size | Critical Edge Cases & Preservation Rules |
|------|----------------------------|------------------------------|------------------------------------------|
| **Settings** (`pages/Settings.tsx` 0 fields; `AccountReorder.tsx` 0 fields) | `BudgetStartSettings.tsx:66` (`<input type="month">`); `CurrencySettings.tsx:243,255,348,396,464` (date, decimal, checkbox, url, symbol); `DataExport.tsx:141,156,235` (2 dates, 1 file); `PeopleSettings.tsx:117,250,285,412` (3 radios, OTP, notify, name); `PreferencesPanel.tsx:291` (symbol); `PrioritiesSettings.tsx:131,141,175,214,224,237,248,258` (5 old `Input`, 3 old `Select`); `ReadOnlyAccess.tsx:106,116,130` (input, 2 selects); `ReminderSettings.tsx:97,115,131` (2 checkboxes, input); `ServerSettings.tsx:134,419,436,453` (checkbox, 3 passwords); `TagManager.tsx:53` (swatch `<select>`) | `MonthPicker` (`md`, `maxValue={thisMonth}`, D-11); `DatePicker` (`sm` in `CurrencySettings` `AddRate`, `md` in `DataExport`); `Input` (`sm` `w-32` rate / `w-20 text-center` symbols, `md` otherwise); `Checkbox` (remove outer `<label>`); `RadioGroup` + `Radio` (`PeopleSettings`); `Select` (`md`, fixed lists: `ReadOnlyAccess` expiry/scope, `PrioritiesSettings` cadence/purpose/comfort); **Keep native** `<input type="file">` (`DataExport.tsx:235`, D-17) | 1. **Boundary check (`D-16`):** Verify Phase 3 G2 already migrated `CategoryManager.tsx`, `EditCategoryModal.tsx`, and `DeleteCategoryModal.tsx` (mounted by `/budget/categories`); migrate any leftover here. 2. **`TagManager.tsx:53`:** Preserve `16×16 px` (`h-4 w-4`) colour dot layout (`D-03`): use a compact swatch trigger on shared `Select` (with `max-md:min-h-11 max-md:min-w-11` hit area) OR keep native in the `D-17` lint allowlist if `WAVG-01` classifies the invisible dot overlay as native. 3. **`ReminderSettings.tsx` & `ServerSettings.tsx:134`:** Multi-line checkbox descriptions align indicator to first line (`items-start`). |
| **Bank connections** (`AccountConnections.tsx` 0, `ConnectedBanks.tsx` 0, `DeletedBankImports.tsx` 0) | `up/UpConnectModal.tsx:276,349,370,385,404` (password token, 2 selects, text, date); `up/UpSettings.tsx:110` (poll interval select); `plaid/PlaidConfigForm.tsx:57,73` & `PlaidSetupModal.tsx:90,106` (ID + secret); `plaid/PlaidEnvironmentSelect.tsx:21` (select); `plaid/ConnectBankModal.tsx:309,325` (select, text); `simplefin/SimplefinConfigForm.tsx:61` (token); `simplefin/SimplefinConnectModal.tsx:164,336,352` (token, select, text); `enablebanking/EnableBankingSetupForm.tsx:224,246` (app ID, `.pem` file); `enablebanking/ConnectEnableBankingModal.tsx:357,381,536,703,711,728,759` (country select, search, paste URL, name, type select, account select, checkbox) | `Input` (`md`); `Select` (`md`: `UpConnectModal:349` action, `UpSettings:110` interval, `PlaidEnvironmentSelect:21`, `ConnectEnableBankingModal:711` account type, `ConnectEnableBankingModal:357` Country unless `WAVG-01` sets `Combobox`); `Combobox` (`md`: user-grown link-account lists `UpConnectModal:385`, `ConnectBankModal:309`, `SimplefinConnectModal:336`, `ConnectEnableBankingModal:728`, per `D-06`/`D-16`); `DatePicker` (`md`, `UpConnectModal:404`); `Checkbox` (`ConnectEnableBankingModal:759`); **Keep native** `<input type="file">` (`EnableBankingSetupForm.tsx:246`, D-17) | 1. **`D-20` credential attributes:** Preserve `type`, `autoComplete`, `spellCheck`, `aria-describedby`, `font-mono`, and adjacent Paste button (`UpConnectModal:276`). 2. **Modal/file size:** `ConnectEnableBankingModal.tsx` (`842` lines) is swapped in place without splitting (`D-09`). 3. Remove `UpConnectModal`'s `px-2 py-2` one-off height drift in favour of `h-10` / `max-md:min-h-11`. |
| **Cash flow** (`pages/CashFlow.tsx`, 1329 lines) | Sole control: `<MonthRangePicker>` (`L1184`); **0** raw or legacy `ui/Input` fields | No change (`MonthRangePicker` stays shared) | Verify `0` raw controls and no layout/wording change (`D-09`). |
| **Review** (`pages/Review.tsx` 792 lines + `components/review/*`) | `Review.tsx:500` (`Select` budget-defined category group filter `review.groups`, with `"All groups"`); `Housekeeping.tsx:191` (`Select` non-hidden saver category `options`); `Resilience.tsx:409` (`Select` fetched deposit candidates `candidates.data`, with `"Choose a received deposit…"`), `428,441` (2 `Input`: usual amount decimal & reserve share % numeric), `455` (`Select` reserve category from `reserves = resilience.flexibility.categories`, rendered only when `reserves.length > 1`); `SortUncategorised.tsx:272` (checkbox) | `Combobox` or `Select` (`sm` on `Review:500`, `md` on `Resilience:409` — dynamic budget groups and fetched deposit candidates, NOT fixed static enums; reconcile against `WAVG-01` per `D-06`/`D-16`); `CategoryPicker` (`D-05`, subject to `D-16` / `WAVG-01` audit confirmation) on `Resilience:455` (`md`, restricted strictly to `reserves`, `allowNone={false}`, `aria-label="Reserve category"`, rendered only when `reserves.length > 1`) and `Housekeeping:191` (`sm`, non-hidden categories only, `allowNone={false}`); `Input` (`md`, `Resilience:428,441`); `Checkbox` (`SortUncategorised:272`) | Like-for-like swap only (`D-09`): preserve `w-48 max-md:w-full` (`Review:499`) and `w-52` (`Housekeeping:190`), `Resilience:452` `reserves.length > 1` gate & reserve-only category restriction (defaulting to `reserves[0].categoryId`), `"All groups"` / `"Choose a received deposit…"` empty options, `SortUncategorised` label wording, and `Resilience` layout. Confirm final `Select` vs `Combobox` vs `CategoryPicker` mappings against `WAVG-01` in Task 1 (`D-16`). |
| **Household** (`pages/Household.tsx` 1598 lines + `components/household/*`) | `Household.tsx` (35 controls: `1` `<textarea>` L335, `4` checkboxes L360/911/941/1538, `11` `Select`, `13` `Input` text/decimal, `6` `Input type="date"` L856/1154/1252/1257/1330/1334); `CombinedHousehold.tsx` (`2` `Select` L80/146, `1` `<textarea>` L413); `HouseholdBills.tsx:36` (checkbox); `RecurringBills.tsx:232,323` (2 checkboxes); `HouseholdIcon.tsx:89` (`<input type="file">`); `EditEntry.tsx`, `ReconcileBalances.tsx`, `PayAhead.tsx`, `QuickExpense.tsx`, `BillAmount.tsx`, `HouseholdSharing.tsx`, `SplitEditor.tsx`, `ShareWithHousehold.tsx`, `RepaymentCategoryOffers.tsx` | `Input`, `Textarea`, `DatePicker` (8 total dates), `Checkbox` (7 total), `Select` (fixed lists: `Event`, `Split method`, `Report scope`, `SplitEditor` mode, `PayAhead` months, `BillAmount` frequency), `Combobox` / `Select` per `WAVG-01` (`pool account`, `Paid by`, `Paid to`, `Match shared bill`, `Original expense`, `Bank payment`, `Schedule`, `Combine with`, `Add account`, `ShareWithHousehold`); `CategoryPicker` / `Select` per `WAVG-01` (`RepaymentCategoryOffers:90`, `D-05`); `sm` in `Household.tsx:1315-1335` (`w-36`, `w-40`) & `SplitEditor`, `md` in modals; **Keep native** `<input type="file">` (`HouseholdIcon.tsx:89`, D-17) | 1. **`FormData` contract (`Household.tsx`):** Task 1 (`D-16`) MUST verify that shipped `Input`, `Textarea`, `Select`, `DatePicker`, and `Checkbox` forward `name` and `defaultValue`/`defaultSelected` into React Aria hidden inputs for all 7 `new FormData(e.currentTarget)` forms (`name`, `people`, `accountId`, `description`, `date`, `amount`, `payerId`, `recipientId`, `advance`, `include-${p.id}`, `billId`, `reversesId`, `transactionId`, `dueDate`, `personalShare`, `reserved`, `scheduleId`, `isDefault`) — **never** rewrite `Household.tsx` into a file split (`D-09`). 2. Check in Task 1 whether Phase 3 already migrated `ShareWithHousehold.tsx`. 3. Keep `QuickExpense.tsx:150` `Slider` untouched. |
| **Tax** (`pages/Tax.tsx` 822 lines + `components/tax/*`) | `Tax.tsx:133,779,788` (`Select` FY, `Input` merchant, `Input type="date"` receipt date); `Assets.tsx` (`2` `Select`, `5` `Input`, `2` `Input type="date"`, `1` checkbox, `1` radio loop, `<datalist id="asset-lives">`); `CarAndHome.tsx` (`1` `Select`, `3` `Input type="date"`, `4` `Input`, `1` checkbox loop); `TaxClaimSection.tsx` (`1` checkbox, `1` `Select`, `2` `Input`); `ReceiptsSection.tsx:81` (`<input type="file">`) | `Select` (`md`, fixed lists: FY, asset category/tax label, car label, claim label); `DatePicker` (`md`, 6 total dates); `Input` (`md`, `sm` `w-20` on `TaxClaimSection:129`); `Checkbox` (`Assets:574`, `CarAndHome:363`, `TaxClaimSection:100`); `RadioGroup` + `Radio` (`Assets:599`); **Keep native** `<input type="file">` (`ReceiptsSection.tsx:81`, D-17) | 1. **Boundary check (`D-16`):** Check if Phase 3 already moved `TaxClaimSection.tsx` and `ReceiptsSection.tsx`. 2. **`Assets.tsx:522` `<datalist>`:** Verify shared `Input` forwards `list="asset-lives"` directly to DOM `<input>`. 3. Keep `Tax.tsx` `grid-cols-1 sm:grid-cols-3` (`L778`), `CurrencyInput` (`Tax.tsx:592,794`, `Assets.tsx:506,892`), and all wording verbatim (`D-09`). |
| **Dashboard, Payment plans, Welcome, Sign-in, App shell & Currency** (`D-13`, `WAVG-08`) | `AuthGate.tsx:348,363,393,409` (name, code, 2 passwords); `CommandPalette.tsx:370` (combobox search input); `CustomizeHome.tsx:38` (checkbox); `SummaryStats.tsx:211` (`Select compact`); `Welcome.tsx:256-274` (`<label><Switch /></label>`); `NewPlanModal.tsx:143-265` (`1` text, `1` `CategorySelect`, `2` dates, `1` `type="number"`, `3` `Select`, `1` checkbox); `PlanCard.tsx:212,315,322` (`2` dates, `1` `CategorySelect`); `EarlierPaymentsModal.tsx:36` (`Select`); `CurrencySelect.tsx:45` (`<select>` ~150 ISO currencies); `CurrencyDifference.tsx:83` (`<select>` filtered category) | `Input` (`md` on `AuthGate`, `NewPlanModal`, `h-11 pl-9 pr-3` on `CommandPalette` if `Input` forwards `role`/`aria-*`/`ref`/`onKeyDown` else `D-17` allowlist); `Checkbox` (`CustomizeHome`, `NewPlanModal:253`); `Select` (`sm` on `SummaryStats:211` `size="sm"`, `md` on `NewPlanModal:204` frequency & `EarlierPaymentsModal:36`); `Combobox` / `Select` per `WAVG-01` (`NewPlanModal:220,236`, `CurrencySelect:45` with `ListBoxSection`); `CategoryPicker` (`NewPlanModal:156`, `PlanCard:322`, `CurrencyDifference:83` per `D-05`/`D-16`); `DatePicker` (`md` on `NewPlanModal:179,265` & `PlanCard:315`, `sm` `w-40` on `PlanCard:212`) | 1. **`D-20` AuthGate:** Keep `id`, `autoComplete`, `spellCheck={false}`, `autoFocus`, `onPaste` (`codeFromPaste`), `aria-describedby`, `type="password"` (`L393,409`), `font-mono uppercase`. 2. **`WAVG-08` `NewPlanModal.tsx:193`:** Replace `type="number"` (`instalmentCount`) with shared `Input` (`type="text" inputMode="numeric"`) enforcing integer `1..60` (`>= Math.max(1, linked.length)`), paired with a failing-first test. 3. **`Welcome.tsx:256-274`:** Ensure outer `<label>` is `<div>` (if Phase 2 did not already change it) so React Aria `Switch`'s internal `<label>` is never nested. 4. **`CurrencySelect.tsx`:** Verify if Phase 3 G2 already moved it (`AddAccountModal` caller). |

---

### 3. `D-20` Sign-In & Credential Attribute Preservation Contract

Every field handling a password, token, API key, setup/reset code, or bank credential MUST forward these exact HTML attributes to the underlying `<input>` DOM node (verified in G4 Task 1 `D-16`):

| File & Line | Control | Non-Negotiable DOM Attributes & Behaviour |
|-------------|---------|---------------------------------------------|
| `AuthGate.tsx:348` | Name | `id="name"`, `autoComplete="username"`, `autoFocus={!isSetup}` |
| `AuthGate.tsx:363` | Setup / invite / reset code | `id="setup-code"`, `autoComplete="one-time-code"`, `spellCheck={false}`, `autoFocus={isSetup}`, `onPaste` (`codeFromPaste`), `aria-describedby`, `font-mono uppercase` |
| `AuthGate.tsx:393` | Password / New password | `id="password"`, `type="password"`, `autoComplete={choosing ? 'new-password' : 'current-password'}`, `autoFocus={!isSetup && !needsName}` |
| `AuthGate.tsx:409` | Confirm password | `id="confirm"`, `type="password"`, `autoComplete="new-password"` |
| `ServerSettings.tsx:419,436,453` | Current / New / Confirm password | `type="password"`, `autoComplete="current-password"` / `"new-password"`, `aria-label` |
| `PeopleSettings.tsx:250` | 6-digit confirmation code | `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, `font-mono` |
| `PeopleSettings.tsx:285` | Notify service / email | `type={destination === 'email' ? 'email' : 'text'}`, `autoComplete={destination === 'email' ? 'email' : 'off'}`, `spellCheck={false}`, `font-mono` |
| `ReminderSettings.tsx:115` | HA notify service | `maxLength={100}`, `autoCapitalize="none"`, `spellCheck={false}` |
| `UpConnectModal.tsx:276` | Up personal access token | `id="up-token"`, `type="password"`, `autoComplete="off"`, `spellCheck={false}`, `aria-describedby`, `font-mono`, adjacent Paste button |
| `PlaidConfigForm.tsx:57,73` & `PlaidSetupModal.tsx:90,106` | Plaid Client ID & Secret | `type="text"` (Client ID), `type="password"` (Secret — never unmasked) |
| `SimplefinConfigForm.tsx:61` & `SimplefinConnectModal.tsx:164` | SimpleFIN setup token | `type="text"`, `font-mono` |
| `EnableBankingSetupForm.tsx:224` | EB Application ID | `id="eb-app-id"`, `type="text"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono` |
| `ConnectEnableBankingModal.tsx:536` | EB pasted callback URL | `id="eb-paste"`, `type="text"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono` |

Secrets MUST NEVER be revealed where masked, logged to console/error payloads, or placed in any test fixture (`SECURITY.md`, `D-20`).

---

### 4. `WAVG-08` `type="number"` Elimination & `WAVG-09` Lint Guard Contract

1. **`WAVG-08` proof (`D-14`):**
   - `NewPlanModal.tsx:193` (`instalmentCount`, server Zod `z.number().int().min(1).max(60)` in `server/src/routes/paymentPlans.ts:94`) moves to shared `Input` (`type="text" inputMode="numeric"`) with a failing-first test checking `1..60` bounds and no `type="number"`.
   - A Vitest source-scan test (`client/src/utils/noNumberMoney.test.ts`, modeled on `movedSections.test.ts:66-85` using `import.meta.glob` with comment stripping) asserts zero `type="number"` occurrences remain across non-test `.ts`/`.tsx` files in `client/src/`.
2. **`WAVG-09` ESLint guard (`D-21`, G5):**
   - Custom rule `lint/rules/no-raw-form-control.js` registered on the single `allotment` plugin object in `lint/eslint.config.js` alongside `icon-only-control` (never a second `no-restricted-syntax` block, which would overwrite the `toISOString()` rule at line 55, and never a second `allotment` plugin declaration).
   - Severity: `'error'` over `files: ['client/src/**/*.tsx']`, `ignores: ['**/*.test.tsx', 'client/src/components/ui/**']`.
   - Allowlist: static `<input type="file" ...>` plus explicit `{ file, element, reason }` entries for any `D-17` audit/PR-confirmed native field (each entry carrying its reason on the line).
   - Unit tests in `lint/rules/no-raw-form-control.test.js` (`RuleTester` + `tseslint.parser`) covering allowed cases (shared `<Input />`, `<Select />`, `<Textarea />`, `<DatePicker />`, `<input type="file" />`, allowlisted `D-17` case) and refused cases (raw `<input />`, `<input type="text" />`, `<input type="date" />`, `<input type="password" />`, `<select>`, `<textarea>`).
   - Remove `'Select'` from `jsx-a11y/label-has-associated-control` `controlComponents` in `lint/eslint.config.js:126` once `ui/Input.tsx`'s native `Select` is deleted, recount warnings with `cd lint && npm run lint:report`, and set `--max-warnings` in `lint/package.json:8` to the exact new count (`<= 128`).
3. **`WAVG-10` removal & cross-repo search (`D-22`, G5):**
   - Delete `Select` and `compactSelectClass` from `client/src/components/ui/Input.tsx`; delete `client/src/components/transactions/CategorySelect.tsx`, `client/src/components/transactions/MerchantSelect.tsx` (+ `selectorInputClass`), `CategorySelectButton.tsx` (if unused after Phase 3), and any orphaned one-off field class constants.
   - Search `client/src/`, `e2e/`, `client/src/demo/`, and active `docs/` for every removed symbol before opening the G5 PR.

---

### 5. What Must Look the Same vs What Is Allowed to Look Different

- **Incumbent primary visual anchors (preserved without moving or redesigning, `D-09`, `D-15`):**
  - **Settings (`Settings.tsx`):** `Settings` `h1` + 8-tab `Settings sections` bar leading into the active tab's single-column (`max-w-2xl`) settings panel.
  - **Connected banks (`AccountConnections.tsx`, `ConnectedBanks.tsx`):** `Connected banks` `PageHeader` + `Bank connection provider` segmented toggle (`Up` default) and the active provider's connection/configuration card (`UpSettings` or provider setup/connect CTA).
  - **Review (`Review.tsx`):** The top `Do this next` prioritized step card (`DoThisNext`, numbered action list with step `1` highlighted in `bg-brand-600`, or `"Nothing needs you right now"` completion line; preceded only by an active `ReminderBanner` or `PaymentMatches` alert).
  - **Cash flow (`CashFlow.tsx`):** The `StatCardRow` (`variant="hero"` — `Total income`, `Total expenses`, `Total net income`, `Savings rate`) below the `Cash flow` period header, followed by the Sankey cash-flow diagram (or phone `List`/`Diagram` view).
  - **Household (`Household.tsx`):** The top `BalanceSummary` (`Who owes whom` headline + per-person balances and primary next-step CTA, or `"Share costs with your household"` `EmptyState` before setup) above the `Household view` tabs.
  - **Tax (`Tax.tsx`):** `Tax time` header + `Tax view` tabs (`Deductions` default) leading into the financial year selector and `StatCardRow` summary (`Claimed in ...`, `Work-related (D2–D5)`, `Without a receipt`) above the totals-by-label table.
  - **Dashboard (`Dashboard.tsx`, `DashboardStatus.tsx`, `SummaryStats.tsx`):** `DashboardStatus` headline + `SummaryStats` hero `Left to spend` tile (`text-3xl` + `PaceCue` bar on desktop; full-width top card on phone) leading the 2-column home card grid (with `GettingStarted` / `ReviewAttention` banner above when present).
  - **Payment plans (`PaymentPlans.tsx`):** `Pay later` header with `Add a purchase` CTA (or `"Track Afterpay purchases as what you bought"` `EmptyState` + `Set up Afterpay` CTA before setup), followed by `PaymentMatches` and the `"Still to pay"` summary above active `PlanCard`s.
  - **Welcome (`Welcome.tsx`):** Centered Allotment logo + `"Welcome to Allotment"` `h1` leading directly into the `"Connect Up — about 2 minutes"` 3-step card and `"Connect Up"` button (with other bank options collapsed below in `<details>`).
  - **Sign-in & setup (`AuthGate.tsx`, `AuthScreen.tsx`) & Command palette (`CommandPalette.tsx`):** Centered `AuthScreen` card with logo, mode heading, and credential form ending in the full-width primary submit `Button`; in `CommandPalette`, the top `h-11` search input above grouped result sections.
- **Must look the same (`D-09`, `D-15`):** Page structure, card/grid layouts, section order, button wording/placement, `useCanSave()` and `<SavingPausedHint />`, Safe mode masking (`Private`, `PrivateChart`), `CurrencyInput` styling, `Household.tsx` / `Tax.tsx` / `Review.tsx` / `CashFlow.tsx` layout and copy, `TagManager` `16×16` colour dots, `AuthGate` / bank setup password masking and Paste buttons, `CommandPalette` search listbox layout, and `e2e/tests/accessibility.spec.ts` `strayLabels === 0`.
- **Allowed to look different (`D-03`, `D-05`, `D-07`, `D-11`, `D-14`):**
  1. Unified `border-border`, `rounded-md`, `h-10`/`h-8` desktop height scale, `text-text-tertiary` placeholders (`>= 4.5:1`), `--color-brand-600` focus ring, and shared disabled/invalid/read-only treatments across Settings, banks, shelved pages, and D-13 modals.
  2. Desktop custom React Aria `Select` / `Combobox` listboxes replacing native `<select>` popups (`D-05`, `D-06`), shifting desktop e2e `Select` triggers from `role="combobox"` to `role="button"` + `role="option"` (while phone e2e keeps native `<select>`).
  3. Desktop `DatePicker` (typeable segments + calendar button + Today shortcut) and `MonthPicker` (`BudgetStartSettings`) replacing native browser date/month chrome (`D-07`, `D-08`, `D-11`).
  4. Unified `Checkbox` (`size-5 rounded-sm`) and `RadioGroup` (`size-5 rounded-full`) indicators replacing browser-default ticks/radios.
  5. `NewPlanModal.tsx:193` dropping browser number spin buttons for shared `Input` (`inputMode="numeric"`, `1..60`).

---

### 6. 390 px Phone Behaviour & Verification

- Zero page-level horizontal overflow (`scrollWidth <= 390`) on every migrated route, modal, and panel (`/settings`, `/accounts/connections`, `/review`, `/cash-flow`, `/household`, `/tax`, `/dashboard`, `/payment-plans`, `/welcome`, `/login`).
- Every migrated control meets `min-h-11` (`44px`) touch height and `16px` (`text-base`) font size under `768px` (no iOS Safari focus zoom).
- `Select`, `DatePicker`, and `MonthPicker` automatically render native `<select>`, `<input type="date">`, and `<input type="month">` below `768px` via `useIsPhone()` (`D-04`); screens do not branch on viewport themselves.
- Existing `desktop`, `phone`, `demo`, `server-mode`, and `gallery` Playwright suites pass sequentially (`e2e/ports.ts` fixed ports, Node 24, never `E2E_SKIP_BUILD=1`), with every desktop selector change (listbox `option`, `fillDate`, `fillMonth`) documented in the PR.

---

## UI Considerations

> Shape-rooted UI state coverage for the Phase 04 screen moves, from the ui-phase probe (38
> considerations over 6 surfaces). Resolved by the orchestrator on 16 Nov 2026 under the owner's
> instruction to be asked only about open gray areas; none was dismissed, and the owner has not
> reviewed these rows one by one. The control-level states (placeholder, invalid, disabled,
> read-only, open list, truncation) are fixed by `02-UI-SPEC.md` §UI Considerations and are
> referenced here, not restated. Empty-state and error-state wording lives in `## Copywriting
> Contract` above.

Applicable state considerations resolved: 6 covered, 3 backstop, 0 unresolved, 0 dismissed (rows below; each row groups the surfaces that share an answer)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| `empty` | Settings and bank forms, sign-in and credential forms, shelved-page forms, Payment plans modal, Dashboard, Welcome and command palette fields | ✅ covered | Every moved field keeps the placeholder text, default value and label it had before the move; an unfilled field shows its placeholder in the shared control's placeholder colour and no field gains or loses a default |
| `empty` | Lists moved to Select, Combobox or `CategoryPicker` | ✅ covered | A list keeps every "none" or "all" choice it had (same wording, same position, same saved value); a searchable list with no match shows the empty line from `02-UI-SPEC.md` |
| `loading` | every moved surface | ✅ covered | No loading state is added or removed: a field that was disabled while its form saved or its data loaded is disabled under the same condition after the move, and save buttons keep `useCanSave` and `<SavingPausedHint />` |
| `error` | Settings and bank forms, sign-in and credential forms, shelved-page forms, Dashboard, Welcome and command palette fields | ✅ covered | Each existing validation or server error message keeps its wording and appears at the same place; where the field is invalid the shared control shows `aria-invalid="true"` and the invalid border |
| `error` | Payment plans modal instalment count | ✅ covered | An instalment count that is not a whole number from 1 to 60 shows "Enter a whole number from 1 to 60." under the field (the same template as `03-UI-SPEC.md` uses for its number fields) and the plan cannot be saved until it is corrected |
| `partial` | every moved surface | ✅ covered | Fields that are shown only under a condition (a bank's extra fields, a household option, an advanced setting) appear and disappear under the same condition as before, and an uncontrolled `FormData` form submits the same field names and values |
| `overflow`, `long-text` | every moved surface | 🧪 backstop | At 390 px no moved screen scrolls sideways; a long chosen value or option truncates on one line inside the control and a long label wraps; proved by the phone e2e project and the page-gutter spec, with a reviewer's look at each moved screen |
| `populated`, `zero-one-many` | Lists moved to Select, Combobox or `CategoryPicker`; shelved-page forms | 🧪 backstop | A list offers the same options in the same order as before with the saved one marked; zero options shows the empty line, one option is not chosen automatically, many scroll inside the popover; proved by each screen's existing e2e specs choosing an option after the move |
| `populated` | Sign-in and credential forms | 🧪 backstop | A password, token or key stays masked exactly where it was masked, is filled by a password manager as before, and is never shown in a test fixture or log (D-20); proved by the attribute checks in the plan plus the manual password-manager check in `04-VALIDATION.md` |

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

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS (two round-1 recommendations applied in revision 1)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-11-16 (gsd-ui-checker round 1: VERIFIED, 0 blocking)
