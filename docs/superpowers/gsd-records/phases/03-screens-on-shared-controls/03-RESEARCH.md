# Phase 3: Screens on shared controls - Research

**Researched:** 2026-11-16
**Domain:** Client screen migration onto shared `react-aria-components` form controls (Wave G G2 and G3, #267), `type="number"` replacement (D-14), list classification (D-05/D-06), Playwright e2e selector migration, and two-PR release planning (D-12)
**Confidence:** HIGH (all file inventories, line numbers, Zod schemas, `wt-f` Wave F diffs, and e2e selectors verified directly from repository files in this worktree and read-only `/Users/tristanvanrooyen/wt-f/client/src`; Phase 2 shared control APIs are **planned, not shipped**, sourced from `02-UI-SPEC.md`, `02-RESEARCH.md`, and `02-PATTERNS.md`)

> **Source-tree provenance:** Wave F (Phase 1) code is not merged onto `redesign` / `worktree-agent-p03-researcher` yet and lives read-only in `/Users/tristanvanrooyen/wt-f` (branch `wave-f`). Every Accounts, Budget, and Category-management (`settings/CategoryManager.tsx`, `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx`, `UnusedCategories.tsx`, `settings/DataExport.tsx`) finding below was verified from `/Users/tristanvanrooyen/wt-f/client/src` (tagged **`wt-f`**) and cross-checked against this worktree (`worktree`); all other files were read in `worktree`. Zero form-control diffs exist between `worktree` and `wt-f` for shared files today (`03-CONTEXT.md:190` confirmed).
>
> **Phase 2 status:** Phase 2 is planned (`02-UI-SPEC.md` approved, `02-RESEARCH.md`, `02-PATTERNS.md`, `02-VALIDATION.md`), not executed (`02-*-PLAN.md` do not exist yet, and neither the `WAVG-01` audit nor the `ui/` controls exist on disk). Every statement about the Phase 2 shared controls' exports, props, and e2e helpers is **planned, not shipped** and must be re-verified against the shipped audit and `client/src/components/ui/` in each PR's opening task (D-16).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward from Phase 2 (locked for all of Wave G)

- **D-01:** The shared controls are built on `react-aria-components`. Screens use the shared controls; a screen does not import React Aria directly to build its own field.
- **D-02:** No new package. No `cn()` helper, `clsx`, `tailwind-merge` or `class-variance-authority` arrives with a screen move.
- **D-03:** Today's field look, made consistent. A screen move deletes one-off field classes; it does not restyle the screen.
- **D-04:** One component API on every device. Under 768 px (`useIsPhone`) Select, DatePicker and MonthPicker render the native control. Screens do not branch on device themselves.
- **D-05:** On desktop the shared custom Select replaces the styled native Select. Picker rule: categories use `CategoryPicker`, payees use `PayeeCombobox`, every other list uses the shared Select or Combobox per D-06. Desktop e2e tests that used `selectOption` on a moved list change to the listbox pattern.
- **D-06:** Lists the user grows (accounts, tags, households, people and the like) are a searchable Combobox. Fixed lists (frequency, type, sort order and the like) are a plain Select. The audit's classification of each list is followed.
- **D-07:** Every `type="date"` field on a Phase 3 screen moves to the shared DatePicker with its screen. e2e tests fill dates through the shared helper Phase 2 adds.
- **D-08:** A date can be typed or picked on desktop; values stay `YYYY-MM-DD` strings (`isoDate`); displayed dates go through `client/src/utils/dates.ts`.
- **D-09:** [informational] Shelved pages and split candidates get a like-for-like swap only. This binds Phase 4; no Phase 3 screen is shelved.
- **D-10:** [informational] Phase 2's two-PR delivery and its owner checkpoint after the audit. Phase 3 does not start until Phase 2's set PR is merged to `redesign`.
- **D-11:** A `type="month"` field on a Phase 3 screen moves to the shared MonthPicker.

#### Delivery
- **D-12:** Phase 3 ships as two PRs to `redesign`, G2 then G3, as #267 and the roadmap say. Each is an app change with its own next `0.2.0-up.N` (`npm run release:prepare`) and CHANGELOG entry. G3 does not start until G2 is merged.
- **D-13:** A sub-page or dialog moves in the PR of the screen that opens it (owner, 16 Nov 2026). Reconcile and an account's transactions go with Accounts; the annual budget, budget categories and category detail go with Budget; payee detail goes with Payees; the receipts dialogs go with the screen that opens them (Transactions in G2, Files in G3); the long-term forecast goes with Forecast; the custom report builder and widget view go with Reports. A screen with no parent in the Phase 3 lists (Dashboard, Payment plans, Welcome, the sign-in screens, the app shell) is not touched here; it moves in Phase 4 with the remaining screens.

#### Number fields
- **D-14:** A `type="number"` field on a Phase 3 screen is fixed in that screen's PR (owner, 16 Nov 2026): `CurrencyInput` (`type="text" inputMode="decimal"`) when it takes money, otherwise a shared field within the matching Zod cap. Each one that changes what can be typed gets a test that fails before the change. This is the one allowed behaviour change in Phase 3 and each is named in the PR. WAVG-08 stays a Phase 4 requirement: Phase 4 fixes the uses left on its own screens and proves none remain anywhere.
  — **Reversibility:** reversible — each field is a local change with its own test.

#### What "nothing changes" means
- **D-15:** Apart from D-14, a screen move changes only which component draws the field. The same values are saved, the same validation and error text apply, the same field is focused first, the same keyboard submit works, accessible names stay the same, save buttons keep `useCanSave` and `<SavingPausedHint />`, and Safe mode still hides amounts. The visible differences are the ones D-03, D-05 and D-07 already accept: a consistent field look, a custom list instead of the native one on desktop, and the shared date control. Anything else that would change is a finding to raise, not a change to make.
- **D-16:** The plans were written before the WAVG-01 audit and the shared controls existed. Each PR therefore starts with a task that reads the audit and the shipped controls and checks the plan's file list, list classifications (D-06) and "must stay native" entries against them. Where the audit disagrees with a plan, the audit wins for classification. If the owner changed a Wave G decision after reading the audit (D-10 allows it), execution stops and the plan is revised first.
- **D-17:** A field that the audit says must stay native (a file input, for example) stays native and is listed in the PR, so Phase 4's lint allowlist can be built from those lists.

### Claude's Discretion
- **Missing variant or state.** If a screen needs something the shared set lacks (a dense size for a table filter, an inline-edit look), extend the shared control, with its gallery state and screenshot, rather than styling around it on the screen. The planner decides whether that is a task inside the screen's PR or a small PR to the set first.
- **`budget/ExpectedNote.tsx`.** If Phase 2 left it alone, it moves with Budget in G2.
- **Neighbour controls** (`SegmentedControl`, `Slider`, `IconPickerPopover`, `MonthRangePicker`, `CurrencyInput`): they are shared components already and are not replaced here, unless the audit or Phase 2 says otherwise.
- **How each PR is cut into plans** (per screen, per control type), and the order of screens inside a PR.
- **e2e changes.** Select by role or label, use the shared helpers from Phase 2, and give each changed selector its reason in the PR. No test is skipped, loosened or made to wait.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Dashboard, Payment plans, Welcome, the sign-in screens and the app shell are Phase 4 work by D-13, not a new idea.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVG-05 | On desktop, Transactions, Accounts, Budget, Payees, Rules and Recurring use only the shared controls, with no behaviour change and every changed e2e selector explained in the PR (G2). | Exact per-file inventory across `pages/` and `components/{transactions,receipts,accounts,currency,budget,settings(categories),payees,rules,recurring}`, D-05/D-06 list mapping (`MerchantSelect` & `CategorySelect` migration), 5 `type="number"` fields mapped to Zod caps, and exact G2 desktop/phone e2e selector updates. |
| WAVG-06 | On desktop, Goals, Forecast, Investments, Reports, Files and the import and export dialogs use only the shared controls, with no behaviour change and every changed e2e selector explained in the PR (G3). | Exact per-file inventory across `pages/` and `components/{goals,forecast,longterm,investments,reports,files}` plus import dialogs (`ImportModal`, `YnabImportModal`, `ImportCategories`) and `DataExport` boundary note, 4 `type="number"` fields mapped to Zod caps, and exact G3 desktop/phone/demo e2e selector updates. |
| WAVG-08 (D-14 scope) | No screen takes a money amount through `type="number"`. Phase 3 fixes the 9 `type="number"` fields on G2/G3 screens with failing-first tests (D-14), leaving only `NewPlanModal.tsx:193` for Phase 4. | All 9 Phase 3 `type="number"` uses verified (none take money; all are counts, percentages, or years); server Zod bounds verified for 8 of 9 (9th is client-only `preferencesStore.upcomingLength`); fix pattern matches `longterm/fields.tsx` (`WholeNumberField` / `RateField`). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` (byte-identical to `AGENTS.md` in `worktree`):
- **Client-only, no server changes:** Wave G makes zero changes to `server/`, read-only access token allowlists (`server/src/auth/accessTokens.ts`), `/api/assistant/do` (`server/src/auth/assistantPolicy.ts`), or MCP (`server/src/routes/mcp.ts`) `[VERIFIED: docs/superpowers/gsd-records/REQUIREMENTS.md:9-10]`.
- **Tokens only from `@theme`:** `client/src/index.css` `@theme` is the sole token source `[VERIFIED: docs/ui/README.md:16]`. No inline hex/rgb colours.
- **Money and dates invariants:**
  - Money is integer minor units; money inputs use `CurrencyInput` (`type="text" inputMode="decimal"`), never `type="number"` `[VERIFIED: CLAUDE.md §Review guidelines]`.
  - Dates are real `YYYY-MM-DD` (`isoDate`, `isoMonth`); displayed dates go through `client/src/utils/dates.ts`; never slice `toISOString()` (`lint/eslint.config.js:55-63` errors on it) `[VERIFIED: lint/eslint.config.js:48-64]`.
- **Dependencies:** No new packages (`D-02`). `.npmrc` keeps install scripts disabled `[VERIFIED: CLAUDE.md §Verification]`.
- **Lint warning cap & accessibility:** `lint/package.json:8` caps warnings at `--max-warnings=128` (`eslint -c lint/eslint.config.js --max-warnings=128 client/src server/src`) `[VERIFIED: lint/package.json:8]`. Warnings must never go up; if a migration fixes existing `jsx-a11y` warnings, lower `--max-warnings` in `lint/package.json` in the same PR `[VERIFIED: lint/README.md:21-24]`. `allotment/icon-only-control` errors on icon-only buttons/links without `aria-label` `[VERIFIED: lint/eslint.config.js:83]`.
- **Client UI checks:** Interactive controls have accessible names; layouts hold at `390 px` with no sideways scroll in light and dark; Safe mode (`Private`, `PrivateSection`, `SafeModeNotice`), demo (`IS_DEMO`), offline (`retryingImport`), and server mode keep working; save buttons keep `useCanSave` and `<SavingPausedHint />` `[VERIFIED: CLAUDE.md §Review guidelines]`.
- **Tests:** Every D-14 number-field behaviour change and every fix gets a test that fails before the change `[VERIFIED: 03-CONTEXT.md:80; CLAUDE.md §Tests]`. No skipped, loosened, retried, or sleeping e2e tests `[VERIFIED: CLAUDE.md §Tests]`.
- **Tooling & e2e rules:** Node 24 required (`PATH="/opt/homebrew/opt/node@24/bin:$PATH"`; `.github/workflows/ci.yml:32`); never set `E2E_SKIP_BUILD=1`; run one e2e browser project at a time (`e2e/ports.ts` ports are fixed); run `npx tsc --noEmit` in `e2e/` and `client/`; run `npm run format:check` `[VERIFIED: docs/ui/HANDOVER-UI.md:160; docs/ui/WAVES.md:146-153,198-199]`.
- **Two-PR release rule (D-12):** G2 PR first, merged to `redesign` (`--repo tvrooi/Allotment`), then G3 PR. Each runs `npm run release:prepare -- <next 0.2.0-up.N>` (updating `package.json`, `package-lock.json`, and `homeassistant/config.yaml` together `[VERIFIED: scripts/prepare-release.py:15-26]`), adds a `CHANGELOG.md` entry, updates `docs/ui/HANDOVER-UI.md` and `docs/ui/MAP.md`, and attaches screenshots under git-ignored `.ui-evidence/<date>-<wave>/` `[VERIFIED: docs/superpowers/gsd-records/REQUIREMENTS.md:48-56; docs/ui/README.md:28-30]`.

## Summary

Phase 3 executes Wave G steps G2 (`WAVG-05`) and G3 (`WAVG-06`) as two sequential PRs to `redesign`, after PR #273 (Wave F) and Phase 2 (WAVG-01 audit + shared `ui/` controls) have merged (`D-10`, `D-12`). Across both PRs, approximately **312 control occurrences** (raw `<select>`, `<input>`, `<textarea>`, plus old `ui/Input` `<Input>` and `<Select>` calls) across **63 screen and component `.tsx` files** migrate onto Phase 2's planned shared controls (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `DatePicker`, `Label`, `Field`) and the rewired pickers (`CategoryPicker`, `PayeeCombobox`), with zero server or business-logic changes other than replacing **9 `type="number"` fields** under `D-14`.

Deep inspection of the codebase surfaced five planner-critical facts that are non-obvious from counts alone:
1. **No `type="number"` field in Phase 3 takes money.** All 9 Phase 3 `type="number"` fields (`TargetCard`, `PaydayPlan`, `RuleEditorModal`, `RecurringFormModal`, `UpcomingLengthModal`, `ImportModal`, `CashRunway` ×2 fields from 1 helper, `EventEditor`) take integers, percentages, or years. Eight have explicit server Zod schemas (`1..60`, `0..100`, `0..14`, `0..1000`, `0..500`, `0..200`, `-10000..5000` bps, `1900..2300` or `null`), and the ninth (`UpcomingLengthModal`) writes to client-side `preferencesStore.upcomingLength`. `longterm/fields.tsx` (`WholeNumberField`, `RateField`) already models the exact `inputMode="numeric"` / `inputMode="decimal"` + `useReportAmountValidity` pattern.
2. **Wrapper consolidation in G2 (`MerchantSelect` & `CategorySelect`) and boundary splits (`ImportModal`, `DataExport`, `CategoryManager`, `AccountConnections`).** `MerchantSelect` (3 callers, all in G2) must be rebuilt on shared `Combobox` while preserving `PayeeIcon`, transaction-count sorting, `"Create new payee"`, and offline `!canSave` messaging. `CategorySelect` has 4 callers in G2 and 2 in Phase 4 (`plans/`), so G2 switches its 4 callers to `CategorySelectButton` / `CategoryPicker` (D-05) while leaving `CategorySelect.tsx` alive until Phase 4 (`WAVG-10`). `BudgetCategories` (`/budget/categories`) renders `settings/CategoryManager.tsx`, `EditCategoryModal.tsx`, and `DeleteCategoryModal.tsx`, so those move in G2 Budget per `D-13`; `AccountConnections.tsx` / `ConnectedBanks.tsx` stays in Phase 4 ("the bank connection sections"). `ImportModal.tsx` (1147 lines), `YnabImportModal.tsx`, and `ImportCategories.tsx` live in `components/transactions/`, while `WAVG-06` and `03-CONTEXT.md` explicitly assign "the import and export dialogs" to G3 (while `settings/DataExport.tsx` is a Settings tab, not a modal — see Open Question 1).
3. **`jsx-a11y/label-has-associated-control` and `strayLabels` trap.** `lint/eslint.config.js:126` only exempts `['Input', 'Select', 'CurrencyInput', 'MoneyInput', 'AmountInput']`. Wrapping React Aria `Checkbox`, `Radio`, desktop `Select` (`<Label elementType="span">`), `DatePicker`, or `Combobox` in an outer `<label>` triggers both ESLint warnings (threatening the full `128` cap in `lint/package.json:8`) and `strayLabels` failures in `e2e/tests/accessibility.spec.ts`.
4. **`TransactionDetailPanel.tsx:375-376` save-on-calendar-pick trap.** Today `Date` saves in `onBlur={saveDate}`. Moving to React Aria `DatePicker` means picking a day or clicking `"Today"` in the popover updates `onChange(iso)` without blurring the trigger button — `TransactionDetailPanel` must save complete dates in `onChange` (which React Aria only fires once a valid date is complete or picked), not only `onBlur`.
5. **E2E selector shifts beyond `selectOption`.** Desktop `Select` changes from `<select>` (`combobox`) to `<AriaButton aria-haspopup="listbox">` (`button`), breaking `toHaveValue(...)` assertions (`data.spec.ts`, `unsaved-drafts.spec.ts`, `envelope-funding.spec.ts`, `recurring.spec.ts`) and `accessibility.spec.ts:158-159` (`Account type`). Desktop `DatePicker` uses `<Label elementType="span">` + `DateSegment` `spinbutton`s, breaking `.fill(iso)` (`transaction-filters.spec.ts`, `receipts-tab.spec.ts`, `receipts-reader.spec.ts`, `transactions.spec.ts`, `recurring.spec.ts`, `investments.spec.ts`) and `accessibility.spec.ts:181-182` (`Start date` label click + `toBeFocused`). `ImportModal`'s `skipRows` changing from `type="number"` to `inputMode="numeric"` changes `getByRole('spinbutton')` to `getByRole('textbox')` (`data.spec.ts:331,611,618`).

**Primary recommendation:** Start both G2 and G3 with a short Wave 0 reconciliation task (`D-16`) against the shipped WAVG-01 audit and Phase 2 `ui/` controls; execute G2 in 4 parallelizable waves grouped by isolated screen folders (Wave 1: shared G2 adapters `MerchantSelect` + `CurrencySelect` + `CurrencyDifference` + missing `ui/` dense/inline variants; Wave 2: Accounts + Payees + Rules + Recurring in parallel; Wave 3: Budget + Transactions/Receipts in parallel; Wave 4: e2e selector pass + full verification + release prep), then execute G3 in 3 parallelizable waves after G2 merges (Wave 1: Goals + Forecast/LongTerm + Investments + Reports + Files in parallel; Wave 2: Import/Export dialogs; Wave 3: e2e selector pass + full verification + release prep).

## Architectural Responsibility Map

Phase 3 is client-only (`REQUIREMENTS.md:9-10`). No server endpoints, database tables, or Zod schemas change.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Screen & dialog field migration (G2, G3) | Browser / Client (`client/src/pages/`, `client/src/components/`) | — | Replaces raw `<select>`, `<input>`, `<textarea>`, legacy `Select`, and one-off classes with Phase 2 shared controls (`ui/`). |
| Dense/inline shared control extensions (if needed per Claude's Discretion) | Browser / Client (`client/src/components/ui/`, `DevControlsGallery.tsx`) | — | Extends shared controls + gallery states rather than adding one-off classes on screens (`D-03`, Claude's Discretion). |
| D-14 `type="number"` client enforcement | Browser / Client (`client/src/components/`) | API / Backend (existing Zod caps, read-only reference) | Client inputs enforce matching server Zod caps (or `preferencesStore` bounds) via `inputMode="numeric"` / `inputMode="decimal"` and `useReportAmountValidity` / field errors without altering server schemas. |
| E2E selector migration & regression verification | CI / E2E Harness (`e2e/tests/`) | Browser / Client | Updates desktop `selectOption`, `toHaveValue`, `fill` on date inputs, and `spinbutton` selectors to React Aria listbox / `fillDate` / `textbox` patterns; keeps phone native tests (`D-04`). |

## Standard Stack

No external packages are installed (`D-02`, `.npmrc` `ignore-scripts=true`). All controls come from the **planned, not shipped** Phase 2 shared set in `client/src/components/ui/`, built on the repository's existing stack `[VERIFIED: client/package.json:17,22,25,38,41]`:

### Core (Planned Phase 2 Set — Not Shipped Yet)
> **Status:** All APIs below are **planned, not shipped**, sourced from `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md`, `02-RESEARCH.md`, and `02-PATTERNS.md`. Verify exact prop names and exports in Task 1 of G2 and G3 (`D-16`).

| Component / Helper | Planned Path | Planned Basis & Purpose |
|--------------------|--------------|-------------------------|
| `Input` (updated) | `client/src/components/ui/Input.tsx` | Planned: React Aria `TextField` / `Input` (`h-10` md / `h-8` sm / `max-md:min-h-11`), `placeholder:text-text-tertiary`. Legacy `Select` stays exported here until Phase 4 (`WAVG-10`). |
| `Textarea` | `client/src/components/ui/Textarea.tsx` | Planned: React Aria `TextArea` (`min-h-20`, `rows={3}`, unified 5 states). |
| `Select` (new) | `client/src/components/ui/Select.tsx` | Planned: React Aria `Select` + `Popover` + `ListBox` on desktop (`>=768px`); native `<select>` on phone (`useIsPhone`, `D-04`). Supports grouped sections (`ListBoxSection` / `<optgroup>`). |
| `Combobox` | `client/src/components/ui/Combobox.tsx` | Planned: React Aria `ComboBox` + `Popover` + `ListBox` (`D-06` user-grown searchable lists; optional clear button & footer). |
| `Checkbox` | `client/src/components/ui/Checkbox.tsx` | Planned: React Aria `Checkbox` (renders `<label>` + hidden `<input>`; `max-md:min-h-11 max-md:min-w-11` phone target). |
| `RadioGroup` + `Radio` | `client/src/components/ui/RadioGroup.tsx` | Planned: React Aria `RadioGroup` (`<Label elementType="span">`) + `Radio`. |
| `Switch` (updated) | `client/src/components/ui/Switch.tsx` | Planned: React Aria `Switch` with `filledDisabled` look (`#264`). |
| `DatePicker` (updated) | `client/src/components/ui/DatePicker.tsx` | Planned: React Aria `DatePicker` + `I18nProvider` (fixed `localeFor`) + `"Today"` shortcut on desktop; `<input type="date">` on phone (`D-04`, `D-07`, `D-08`). |
| `MonthPicker` | `client/src/components/ui/MonthPicker.tsx` | Planned (`D-11`): `DialogTrigger` + `Popover` + 12-month `MonthGrid` on desktop; `<input type="month">` on phone. |
| `Label`, `Field` | `client/src/components/ui/Label.tsx`, `Field.tsx` | Planned: Unified `Label` (supports `elementType="span"`), `Field` vertical stack (`gap-1`, help text, `FieldError`, required `*`, `errorLabel`). |
| `CategoryPicker` (rewired) | `client/src/components/transactions/CategoryPicker.tsx` | Planned: Thin wrapper over React Aria `Popover` + `Dialog` + `Autocomplete` + `TextField` + `ListBox` + inline create footer. |
| `PayeeCombobox` (rewired) | `client/src/components/transactions/PayeeCombobox.tsx` | Planned: Thin wrapper over shared `Combobox` (`allowsCustomValue`, `menuTrigger="focus"`). |
| `fillDate` (planned e2e helper) | `e2e/tests/fixtures.ts` | Planned (`02-PATTERNS.md:635-646`): Fills `[data-type="year"\|"month"\|"day"]` segments on desktop, `.fill(iso)` on phone (`useIsPhone`). |

### Existing Neighbour Shared Controls (Kept Unchanged per Claude's Discretion)
- `CurrencyInput` (`client/src/components/ui/CurrencyInput.tsx`) & `amountValidity.tsx` — remains the sole money input (`CLAUDE.md`, `D-14`).
- `SegmentedControl` (`client/src/components/ui/SegmentedControl.tsx`), `Slider` (`client/src/components/ui/Slider.tsx`), `IconPickerPopover` (`client/src/components/ui/IconPickerPopover.tsx`), `MonthRangePicker` (`client/src/components/ui/MonthRangePicker.tsx`).

**Package Legitimacy Audit:** Skipped — zero external packages are added in Phase 3 (`D-02`).

## Screen-by-Screen Inventory (G2 and G3)

Counts below were scanned across all non-test `.tsx` files on `worktree` (`redesign`) and read-only `/Users/tristanvanrooyen/wt-f/client/src` (`wave-f`) on `2026-11-16`. In the tables:
- **Raw**: `<select>`, `<input>`, `<textarea>` (parentheses show `type` breakdown: `d`=date, `n`=number, `c`=checkbox, `r`=radio, `f`=file, `s`=search, `t`=text/default).
- **Old `ui/Input`**: `<Input>` and legacy `<Select>` imported from `components/ui/Input` (parentheses show `d`=date, `n`=number).
- **Keep**: Existing `CurrencyInput`, `DatePicker`, `MonthRangePicker`, `CategoryPicker`, `PayeeCombobox` (already shared or Phase 2-rewired).

### G2 Inventory (`WAVG-05`: Transactions, Accounts, Budget, Payees, Rules, Recurring)

#### 1. Transactions (`pages/Transactions.tsx` + `components/transactions/` + `components/receipts/`)
*D-13 assignment: `Transactions.tsx` (142L, 0 fields), `components/transactions/*` (excluding import modals if deferred to G3 — shown separately below for clarity), and `components/receipts/*` (opened only by `Transactions.tsx:128`). `TransactionDetailPanel.tsx:558` renders `tax/ReceiptsSection.tsx` (native `<input type="file">`, D-17) and `:560` renders `files/FilesSection.tsx` (G3).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/transactions/AddTransactionModal.tsx` (`worktree`) | 507 | 0 | 2 (`1d, 1t`) | 0 | 0 | 0 | `2 CurrencyInput`, `1 MerchantSelect` | Date `@315`, Account btn `@330`, Note `@479`, `MerchantSelect` `@299` |
| `components/transactions/BulkDeleteModal.tsx` (`worktree`) | 158 | 0 | 1 (`1t`) | 0 | 0 | 0 | — | Confirmation phrase `@124` |
| `components/transactions/BulkEditModal.tsx` (`worktree`) | 376 | 3 | 2 (`2t`) | 0 | 0 | 0 | `1 CategorySelect` | Payee mode `@141`, Cat mode `@217`, `CategorySelect` `@234`, Payee `@249`, Notes mode `@268`, Notes `@288` |
| `components/transactions/CategorySelectButton.tsx` (`worktree`) | 85 | 0 | 0 | 0 | 0 | 0 | `1 CategoryPicker` | Trigger btn `@49` uses `selectorInputClass` from `MerchantSelect` |
| `components/transactions/MerchantSelect.tsx` (`worktree`) | 138 | 0 | 1 (`1t`) | 0 | 0 | 0 | **Rebuild on `Combobox`** | Search `@78` (exports `selectorInputClass` `@7`) |
| `components/transactions/SplitTransactionModal.tsx` (`worktree`) | 293 | 0 | 2 (`2t`) | 0 | 0 | 0 | `2 CategorySelect` | Split notes `@187` (actually `inputMode="decimal"` amount `@189`? No: `@187` amount, `@210` notes — verified in scan) |
| `components/transactions/TransactionDetailPanel.tsx` (`worktree`) | 687 | 0 | 1 (`1d`) | 1 | 0 | 0 | `CategoryPicker`, `PayeeCombobox` | Date `@370` (onBlur save trap!), Notes `@546` |
| `components/transactions/TransactionFilters.tsx` (`worktree`) | 771 | 0 | 8 (`1s, 3c, 2t, 2d`) | 0 | 0 | 0 | — | Search `@178`, `Find ...` `@178`, Checkboxes `@190,204,612`, Amount min/max `@255,385`, Dates `@453,462` |
| `components/transactions/TransactionFormRow.tsx` (`worktree`) | 455 | 0 | 6 (`1d, 5t`) | 0 | 0 | 0 | `PayeeCombobox`, `2 CategorySelect` | Date `@251`, Notes `@295`, Outflow/Inflow `@312,331`, Split notes/amount `@399,407` |
| `components/transactions/TransactionMarks.tsx` (`worktree`) | 269 | 0 | 3 (`1t, 2c`) | 0 | 0 | 0 | — | New tag `@156`, Tag checkboxes `@234,248` |
| `components/transactions/TransactionTable.tsx` (`worktree`) | 756 | 0 | 1 (`1c`) | 0 | 0 | 0 | — | Select-all checkbox `@353` |
| `components/transactions/TransferSuggestions.tsx` (`worktree`) | 271 | 0 | 1 (`1c`) | 0 | 0 | 0 | — | Pair checkbox `@246` |
| `components/receipts/ReceiptEditor.tsx` (`worktree`) | 587 | 0 | 0 | 0 | 6 (`1d, 5t`) | 1 | `5 CurrencyInput`, `1 CategorySelect` | Merchant `@194`, Date `@202`, Note `@241`, Item desc `@294`, New item `@503`, Account `@554`, `CategorySelect` `@259` |
| `components/receipts/ReceiptsTab.tsx` (`worktree`) | 545 | 0 | 3 (`1f, 2c`) | 0 | 3 (`1p, 2t`) | 2 | `1f` stays native (D-17) | Scan file `@72`, Settings checkboxes `@231,478`, Provider `@330`, API key `@364`, Model `@399`, Server URL `@415`, Local model `@444` |
| `components/tax/ReceiptsSection.tsx` (`worktree`) | 149 | 0 | 1 (`1f`) | 0 | 0 | 0 | `1f` stays native (D-17) | File upload `@81` (shared with Tax Phase 4) |

*Note:* `CategorySelect.tsx` (`worktree`, 63L) has 1 raw `<select>` at line 32; switching `BulkEditModal`, `SplitTransactionModal`, `TransactionFormRow`, and `ReceiptEditor` onto `CategorySelectButton` / `CategoryPicker` (D-05) leaves only Phase 4's `plans/` (`NewPlanModal`, `PlanCard`) on `CategorySelect.tsx` until Phase 4 (`WAVG-10`). `CategoryPicker.tsx` (358L, raw `<select>` `@275`, raw `<input>` `@195,310`) and `PayeeCombobox.tsx` (105L, raw `<input>` `@66`) are rewired in Phase 2 (`WAVG-02`).

#### 2. Accounts (`pages/Accounts.tsx`, `AccountTransactions.tsx`, `ReconcilePage.tsx` + `components/accounts/` + `components/currency/`)
*D-13 assignment: `Accounts.tsx` (`wt-f`, 0 fields), `AccountTransactions.tsx` (`worktree`, 0 fields), `ReconcilePage.tsx` (`worktree`, 375L), `components/accounts/*` (`wt-f`), `components/currency/CurrencyDifference.tsx` (`worktree`, opened only by `AccountTransactions.tsx`), `components/currency/CurrencySelect.tsx` (`worktree`, used by `AddAccountModal`/`EditAccountModal` in G2, `InvestmentModals` in G3, `CurrencySettings` in Phase 4). **Excluded from Phase 3:** `AccountConnections.tsx` & `ConnectedBanks.tsx` (`wt-f`) belong to Phase 4 ("the bank connection sections", `WAVG-07`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `pages/ReconcilePage.tsx` (`worktree`) | 375 | 0 | 2 (`2c`) | 0 | 0 | 0 | `1 CurrencyInput` | Select-all `@234`, Row cleared checkbox `@281` |
| `components/accounts/AccountTypeSelect.tsx` (`wt-f`) | 41 | 1 | 0 | 0 | 0 | 0 | — | `<select>` `@21` (optgroup `ACCOUNT_GROUPS`) |
| `components/accounts/AddAccountModal.tsx` (`wt-f`) | 202 | 0 | 2 (`1t, 1c`) | 0 | 0 | 0 | `1 CurrencyInput`, `1 CurrencySelect` | Name `@95`, Off-budget `@166` |
| `components/accounts/DeleteAccountModal.tsx` (`wt-f`) | 115 | 0 | 1 (`1t`) | 0 | 0 | 0 | — | Confirm name `@84` |
| `components/accounts/EditAccountModal.tsx` (`wt-f`) | 338 | 0 | 4 (`1f, 1t, 2c`) | 0 | 0 | 0 | `1 CurrencyInput`, `1 CurrencySelect`, `1f` native (D-17) | Logo file `@157`, Name `@174`, Off-budget `@232`, Assign pool `@245` |
| `components/accounts/UpdateValueModal.tsx` (`wt-f`) | 105 | 0 | 0 | 0 | 0 | 0 | `1 CurrencyInput` | Amount only (`@61`) — no controls to replace |
| `components/currency/CurrencySelect.tsx` (`worktree`) | 70 | 1 | 0 | 0 | 0 | 0 | **Move to `Combobox` in G2** | `<select>` `@45` (~150 currencies, 2 optgroups) |
| `components/currency/CurrencyDifference.tsx` (`worktree`) | 121 | 1 | 0 | 0 | 0 | 0 | **Category picker/Combobox** | `<select>` `@83` (filtered income/expense categories + `No category`) |

#### 3. Budget (`pages/Budget.tsx`, `AnnualBudget.tsx`, `BudgetCategories.tsx`, `CategoryDetail.tsx` + `components/budget/` + `components/settings/Category*`)
*D-13 assignment: `Budget.tsx` (`wt-f`, 1484L), `AnnualBudget.tsx` (`worktree`, 440L), `BudgetCategories.tsx` (`wt-f`, 27L -> renders `components/settings/CategoryManager.tsx`), `CategoryDetail.tsx` (`worktree`, 370L, 0 form fields itself, renders `TransactionTable`, `TargetCard`, `FilesSection`), `components/budget/*` (`wt-f`), and `components/settings/{CategoryManager,EditCategoryModal,DeleteCategoryModal}.tsx` (`wt-f`). (`ExpectedNote.tsx` in `wt-f` has 0 form fields — only React Aria `DialogTrigger`/`Popover`/`ProgressBar` + `FundingButton`, `02-RESEARCH.md:240`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `pages/Budget.tsx` (`wt-f`) | 1484 | 0 | 3 (`1t, 1c, 1s`) | 0 | 0 | 0 | — | Inline `AmountInput` `@121` (`inputMode="decimal"`, `useRef`), Row select `@334`, Search `@1148` |
| `pages/AnnualBudget.tsx` (`worktree`) | 440 | 0 | 0 | 0 | 0 | 1 | Phone-only (`md:hidden`) | Jump to month `@244` |
| `components/budget/AutoAssign.tsx` (`wt-f`) | 235 | 1 | 2 (`2r`) | 0 | 0 | 0 | — | Strategy radios `@129,166`, Average months `@144` |
| `components/budget/BudgetAmountSheet.tsx` (`wt-f`) | 210 | 0 | 2 (`1t, 1c`) | 0 | 0 | 0 | — | Phone sheet amount `@116`, Repeat 12m `@163` |
| `components/budget/CardPayments.tsx` (`wt-f`) | 253 | 0 | 2 (`2t`) | 0 | 0 | 0 | — | Card payment `MoneyInput`s `@138,214` (`inputMode="decimal"`) |
| `components/budget/FundingRows.tsx` (`wt-f`) | 57 | 0 | 1 (`1c`) | 0 | 0 | 0 | — | Preview row checkbox `@35` |
| `components/budget/MoneyMoves.tsx` (`wt-f`) | 309 | 0 | 0 | 0 | 1 | 2 | — | From `@185`, To `@203`, Amount `@222` (`useRef`!) |
| `components/budget/NoteField.tsx` (`wt-f`) | 79 | 0 | 0 | 1 | 0 | 0 | — | Inline note textarea `@55` |
| `components/budget/PaydayPlan.tsx` (`wt-f`) | 903 | 0 | 2 (`2c`) | 0 | 6 (`2t, 3d, 1n`) | 5 | **1 `type="number"` `@246`** | `MoneyInput` `@40`, Name `@105`, Anchor `@120`, Weekend `@141`, Timezone `@158`, Cat `@189`, Method `@204`, Due `@234`, Percent `@245`, Payday `@492`, Actual date `@513`, Income check `@559`, Plan picker `@856`, Unarchive `@874` |
| `components/budget/TargetCard.tsx` (`wt-f`) | 150 | 0 | 0 | 0 | 3 (`1t, 1d, 1n`) | 1 | **1 `type="number"` `@115`** | Target type `@87`, Amount `@98`, Due `@103`, Cycle months `@114` |
| `components/settings/CategoryManager.tsx` (`wt-f`) | 739 | 0 | 3 (`3t`) | 0 | 0 | 0 | — | Inline rename `@61`, New group `@292`, Add category `@440` |
| `components/settings/EditCategoryModal.tsx` (`wt-f`) | 309 | 3 | 3 (`1t, 1r, 1c`) | 0 | 0 | 0 | — | Name `@136`, Group `@154`, Budget type radios `@190` (in `.map()`), Linked acct `@213`, Pool acct `@239`, Keep overspending `@260` |
| `components/settings/DeleteCategoryModal.tsx` (`wt-f`) | 92 | 1 | 0 | 0 | 0 | 0 | — | Merge into `@60` |

#### 4. Payees (`pages/Payees.tsx`, `PayeeDetail.tsx` + `components/payees/`)
*D-13 assignment: `Payees.tsx` (`worktree`, 436L), `PayeeDetail.tsx` (`worktree`, 263L — 0 own inputs, renders `DefaultCategoryButton`, `TransactionTable`), `components/payees/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `pages/Payees.tsx` (`worktree`) | 436 | 0 | 9 (`1r, 4c, 4t`) | 0 | 0 | 0 | — | Merge radio `@49`, Search `@171`, Phone select-all `@221`, Phone row check `@241`, Phone inline rename `@259`, Desktop select-all `@302`, Desktop row check `@338`, Desktop inline rename `@358`, Desktop default-cat / Add? (`@259`/`@358` + let's verify line count: 8 `<input>` in scan: `@49,171,221,241,259,302,338,358` = 8 `<input>`!) |
| `components/payees/PayeeIcon.tsx` (`worktree`) | 102 | 0 | 1 (`1f`) | 0 | 0 | 0 | `1f` stays native (D-17) | Logo upload `@99` |
| `components/payees/DefaultCategoryButton.tsx` (`worktree`) | 62 | 0 | 0 | 0 | 0 | 0 | `1 CategoryPicker` | Trigger btn `@28` |

*(Correction verified: `Payees.tsx` has **8** raw `<input>` occurrences: 1 radio `@49`, 4 checkboxes `@221,241,302,338`, 3 text `@171,259,358`.)*

#### 5. Rules (`pages/Rules.tsx` + `components/rules/`)
*D-13 assignment: `Rules.tsx` (`worktree`, 449L), `components/rules/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `pages/Rules.tsx` (`worktree`) | 449 | 0 | 1 (`1t`) | 0 | 0 | 0 | `Disable rule` `<button role="switch">` `@92` | Search `@294` |
| `components/rules/ApplyRulesModal.tsx` (`worktree`) | 245 | 0 | 2 (`2c`) | 0 | 0 | 0 | — | Select all `@132`, Row check `@158` |
| `components/rules/OptionPicker.tsx` (`worktree`) | 137 | 0 | 1 (`1t`) | 0 | 0 | 0 | — | Search `@93` (`ring-brand-400` in Phase 2 checker!) |
| `components/rules/RuleEditorModal.tsx` (`worktree`) | 683 | 9 | 7 (`1c, 1d, 4t, 1n`) | 0 | 0 | 0 | `2 CurrencyInput`, `1 MerchantSelect`, **1 `type="number"` `@562`** | Combiner `@90`, Apply existing `@152`, Cond field/op/dir `@197,215,257`, Cond date `@285`, Cond text `@326,364`, Action type `@398`, Set notes `@426`, Tag `@438`, Household `@459`, Tax `@481`, Split kind `@539`, Split % `@562`, Split notes `@589` |

#### 6. Recurring (`pages/RecurringTransactions.tsx` + `components/recurring/`)
*D-13 assignment: `RecurringTransactions.tsx` (`worktree`, 224L — 0 own inputs), `components/recurring/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/recurring/AllTab.tsx` (`worktree`) | 406 | 0 | 1 (`1t`) | 0 | 0 | 0 | — | Search schedules `@325` |
| `components/recurring/DiscoverSchedulesModal.tsx` (`worktree`) | 242 | 0 | 2 (`2c`) | 0 | 0 | 0 | — | Select all `@99`, Row check `@140` |
| `components/recurring/OccurrenceMatchModal.tsx` (`worktree`) | 118 | 0 | 0 | 0 | 1 | 0 | — | Search tx `@76` |
| `components/recurring/RecurringFormModal.tsx` (`worktree`) | 554 | 1 | 1 (`1c`) | 0 | 5 (`2t, 2d, 1n`) | 4 | `1 CurrencyInput`, `1 MerchantSelect`, **1 `type="number"` `@520`** | Name `@204`, Freq `@305`, Acct `@325`, Start/End `@349,365`, Notes `@414`, Auto-create `@426`, Reminder `@443`, Weekend `@496`, Date flex `@518` |
| `components/recurring/UpcomingLengthModal.tsx` (`worktree`) | 128 | 2 | 1 (`1n`) | 0 | 0 | 0 | **1 `type="number"` `@82`** | Preset `@57`, Custom count `@81`, Unit `@88` |

---

### G3 Inventory (`WAVG-06`: Goals, Forecast, Investments, Reports, Files, Import & Export Dialogs)

#### 1. Goals (`pages/Goals.tsx` + `components/goals/`)
*D-13 assignment: `Goals.tsx` (`wt-f`, 565L — 0 own inputs), `components/goals/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/goals/GoalFormModal.tsx` (`worktree`) | 301 | 1 | 1 (`1t`) | 0 | 0 | 1 | `2 CurrencyInput`, `1 DatePicker` | Name `@141`, Progress source `@156`, Linked account `@224` |
| `components/goals/GoalStatusModal.tsx` (`worktree`) | 184 | 0 | 0 | 0 | 2 | 2 | — | Reason `@103`, Replacement `@113`, Move to cat `@134`, Amount `@150` |

#### 2. Forecast (`pages/Forecast.tsx` + `components/forecast/` + `components/longterm/`)
*D-13 assignment: `Forecast.tsx` (`worktree`, 72L — 0 own inputs), `components/forecast/*` (`worktree`), `components/longterm/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/forecast/CashRunway.tsx` (`worktree`) | 1056 | 0 | 0 | 0 | 10 (`4t, 4d, 2n`) | 5 | **2 `type="number"` `@182,221`** (3 UI fields) | Name `@114`, `AmountInput` `@150`, Percent `@181`, Growth `@220`, OneOff desc/date `@278,283`, Pause from/to `@356,362`, Cost desc/from `@392,397`, Controls `@707,717,727,740,1000` |
| `components/longterm/AccountsPanel.tsx` (`worktree`) | 307 | 0 | 1 (`1c`) | 0 | 0 | 2 | — | Study kind `@134`, Exclude check `@222`, Asset class `@231` |
| `components/longterm/AssumptionsPanel.tsx` (`worktree`) | 413 | 0 | 6 (`2r, 4c`) | 0 | 0 | 0 | — | Volatility/seed radios `@32,36`, Checkboxes `@232,272,313,336` |
| `components/longterm/EventEditor.tsx` (`worktree`) | 494 | 0 | 3 (`3c`) | 0 | 2 (`1t, 1n`) | 2 | **1 `type="number"` `@382`** | Name `@129`, Deposit type `@149`, Checkboxes `@236,353,459`, End year `@380`, Loan `@429` |
| `components/longterm/EventList.tsx` (`worktree`) | 132 | 0 | 1 (`1c`) | 0 | 0 | 0 | — | Enable/include check `@89` |
| `components/longterm/LongTermForecast.tsx` (`worktree`) | 910 | 0 | 0 | 0 | 2 | 3 | — | New plan name `@105`, Plan `@505`, Year `@650`, Compare `@786`, Rename/dup `@848` |
| `components/longterm/SavingsPanel.tsx` (`worktree`) | 300 | 0 | 0 | 0 | 0 | 2 | — | Mode `@93`, Add account `@169` |
| `components/longterm/SimulationPanel.tsx` (`worktree`) | 272 | 0 | 0 | 0 | 0 | 1 | — | Simulated paths `@176` |
| `components/longterm/fields.tsx` (`worktree`) | 300 | 0 | 0 | 0 | 2 | 2 | `CurrencyInput` | `RateField` `@125`, `WholeNumberField` `@193`, `WhenField` `@231`, `EscalationField` `@275` |

#### 3. Investments (`pages/Investments.tsx` + `components/investments/`)
*D-13 assignment: `Investments.tsx` (`worktree`, 786L — 0 own inputs), `components/investments/*` (`worktree`). (`UpdateValueModal` already moved in G2).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/investments/IncomeModals.tsx` (`worktree`) | 325 | 0 | 1 (`1c`) | 0 | 2 (`1d, 1t`) | 1 | `6 CurrencyInput` | Kind `@99`, Paid on `@112`, Franking check `@186`, Notes `@214` |
| `components/investments/InvestmentModals.tsx` (`worktree`) | 630 | 0 | 1 (`1c`) | 0 | 7 (`2d, 5t`) | 3 | `2 CurrencyInput`, `CurrencySelect` (moved in G2) | Symbol/Name/Kind `@150,160,173`, Price date `@236`, Units `@298`, Account/Security/Notes `@360,385,408`, Bought on `@587`, Reinvest check `@613` |
| `components/investments/SaleModals.tsx` (`worktree`) | 399 | 0 | 2 (`2r`) | 0 | 3 (`1d, 2t`) | 0 | `2 CurrencyInput` | Sold on `@172`, Parcel radios `@216,220`, Units `@237`, Notes `@284` |
| `components/investments/SplitModals.tsx` (`worktree`) | 183 | 0 | 0 | 0 | 3 (`1d, 2t`) | 0 | — | Effective on `@77`, New/From units `@88,98` |

#### 4. Reports (`pages/Reports.tsx`, `CustomReportBuilder.tsx`, `ReportWidgetView.tsx` + `components/reports/`)
*D-13 assignment: `Reports.tsx` (`worktree`, 252L — 0 own inputs), `CustomReportBuilder.tsx` (`worktree`, 193L — 0 own inputs), `ReportWidgetView.tsx` (`worktree`, 187L — 0 own inputs), `components/reports/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/reports/AccountMultiSelect.tsx` (`worktree`) | 50 | 0 | 1 (`1c`) | 0 | 0 | 0 | — | Checkbox `@38` |
| `components/reports/CategoryTreePicker.tsx` (`worktree`) | 131 | 0 | 2 (`2c`) | 0 | 0 | 0 | — | Group check `@100`, Cat check `@113` |
| `components/reports/ReportBuilderSidebar.tsx` (`worktree`) | 202 | 1 | 0 | 0 | 0 | 0 | `MonthRangePicker` `@154` | Group by `@105` |
| `components/reports/ReportDetail.tsx` (`worktree`) | 1069 | 0 | 1 (`1c`) | 0 | 0 | 0 | `SegmentedControl` | `TrendCategoryPicker` checkbox `@681` |
| `components/reports/SaveReportModal.tsx` (`worktree`) | 89 | 0 | 0 | 0 | 1 | 0 | — | Report name `@64` |
| `components/reports/dashboard/NameModal.tsx` (`worktree`) | 65 | 0 | 0 | 0 | 1 | 0 | — | Dashboard/widget name `@45` |

*(Note: `DateRangeControl.tsx` only uses `MonthRangePicker` `@56`, kept per Claude's Discretion.)*

#### 5. Files (`pages/Files.tsx` + `components/files/`)
*D-13 assignment: `Files.tsx` (`worktree`, 454L), `components/files/*` (`worktree`).*

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `pages/Files.tsx` (`worktree`) | 454 | 0 | 0 | 0 | 4 (`2t, 2d`) | 1 | — | Limit modal `@95`, Search `@289`, Kind `@300`, From/To `@313,320` |
| `components/files/FileDetailModal.tsx` (`worktree`) | 496 | 0 | 0 | 1 | 4 (`3t, 1d`) | 1 | — | Tag `@119`, Link target `@155`, Name `@240,271`, Date `@280`, Description `@291` |
| `components/files/FileParts.tsx` (`worktree`) | 214 | 0 | 1 (`1f`) | 0 | 0 | 0 | `1f` stays native (D-17) | `FileDrop` upload `@199` |
| `components/files/FilesSection.tsx` (`worktree`) | 182 | 0 | 0 | 0 | 1 | 0 | — | `AttachExisting` search `@36` |

#### 6. Import and Export Dialogs (`components/transactions/Import*`, `YnabImportModal.tsx`, and boundary note on `settings/DataExport.tsx`)
*Scope note:* `WAVG-06` and `03-CONTEXT.md:15-16` assign "the import and export dialogs" to G3, and `03-CONTEXT.md:192` notes `ImportModal.tsx (1147 lines)` as a large file on the path. However, `ImportModal.tsx` is opened by `TransactionTable.tsx:713` (G2) and `DataExport.tsx` is a Settings tab (`Settings.tsx:118`, Phase 4) rather than a `<Modal>` (see Open Question 1). Assigning `ImportModal.tsx`, `YnabImportModal.tsx`, and `ImportCategories.tsx` to **G3** matches `WAVG-06` and balances PR sizes. (`ImportHistory.tsx` has 0 form controls.)

| File (Tree) | Lines | Raw `<select>` | Raw `<input>` | Raw `<textarea>` | Old `Input` | Old `Select` | Keep / Special | Key Lines |
|-------------|-------|----------------|---------------|------------------|-------------|--------------|----------------|-----------|
| `components/transactions/ImportModal.tsx` (`worktree`) | 1147 | 6 | 4 (`1f, 1n, 1t, 1c`) | 0 | 0 | 0 | `1f` native (D-17), **1 `type="number"` `@766`** | File `@679`, Statement `@700`, Delim `@738`, Encoding `@752`, SkipRows `@766`, DateFmt `@786`, NumFmt `@801`, OutWord `@817`, Col roles `@865` (mapped!), Preview check `@1012` |
| `components/transactions/YnabImportModal.tsx` (`worktree`) | 506 | 3 | 2 (`1f, 1t`) | 0 | 0 | 0 | `1f` native (D-17) | File `@296`, DateFmt `@320`, NumFmt `@336`, Account map `@386` (mapped!), New acct name `@411` |
| `components/transactions/ImportCategories.tsx` (`worktree`) | 214 | 2 | 0 | 0 | 0 | 0 | — | Category map `@143`, New group `@182` |
| *Boundary:* `components/settings/DataExport.tsx` (`wt-f`) | 275 | 0 | 3 (`2d, 1f`) | 0 | 0 | 0 | `1f` native (D-17) | CSV From/To `@141,156`, Backup file `@235` (Settings tab `'data'` -> Phase 4 unless pulled into G3) |

## Number Fields Audit (D-14)

Every `type="number"` field across the entire `client/src/` codebase (10 occurrences total; verified via `rg -n 'type="number"' client/src/`) was checked against `server/src/` Zod schemas. **Nine live on Phase 3 screens** (5 in G2, 4 in G3); the 10th (`components/plans/NewPlanModal.tsx:193`) lives in Phase 4. **None take money amounts** — all take integer counts, percentages, or years.

| PR | File:Line | Label / Purpose | Money? | Server Zod Schema & Cap | Planned Shared Fix (D-14) | Failing-First Test |
|----|-----------|-----------------|--------|-------------------------|-------------------------|--------------------|
| G2 | `components/budget/TargetCard.tsx:115` (`wt-f`) | `Repeats every (months)` (`cycle`) | No (integer months) | `server/src/services/targetConfig.ts:16`: `cycleMonths: z.number().int().min(1).max(60)` | Replace `<Input type="number">` with `Field` + `Input` (`inputMode="numeric"`), keeping local text state while typing and validating whole integers `1..60` (invalid state blocks save / shows range error instead of coercing `Math.round(+e.target.value)` mid-keystroke). | Unit/component or e2e test: reject `0`, `61`, `1.5`, `"abc"` instead of silently clamping to `1`/`60` or `NaN`; accept `"12"`. |
| G2 | `components/budget/PaydayPlan.tsx:246` (`wt-f`) | `Percent` (`rule.percent`) | No (integer %) | `server/src/services/paydayConfig.ts:11,43`: `percent: z.number().int().min(0).max(100).default(0)`, sum of percentage rules `<= 100` | Replace `<Input type="number">` with `Input` (`inputMode="numeric"`), whole integers `0..100` (`useReportAmountValidity` or error state blocking Save when invalid/non-integer/out of `0..100`). | Unit/e2e test: non-integer (`12.5`) or `>100` marks field invalid and blocks saving instead of `Number("12.5")` failing server Zod `.int()`. |
| G2 | `components/rules/RuleEditorModal.tsx:563` (`worktree`) | Split percentage (`p.value` when `p.kind === 'percent'`) | No (decimal/int %) | `server/src/routes/rules.ts:70-75`: `value: z.number().min(0).max(1_000_000_000_00)` + `.refine((p) => p.kind !== 'percent' \|\| p.value <= 100, 'Percent must be 0–100')` | Replace `<input type="number" step="any">` with `Input` (`inputMode="decimal"`), allowing decimals `0..100` (e.g. `33.33`) and flagging invalid outside `0..100` instead of `Number(e.target.value) \|\| 0` snapping empty input to `0`. | Unit/e2e test: typing `"50.5"` works; clearing input lets user retype without snapping to `0`; `>100` or invalid text shows error / blocks save. |
| G2 | `components/recurring/UpcomingLengthModal.tsx:82` (`worktree`) | Custom upcoming count (`num`) | No (integer count) | None (client-only Zustand store `preferencesStore.ts:46,161,187`: string `"<n>-<unit>"`, parsed in `scheduleFormat.ts:118` via `Math.max(1, parseInt(num, 10) \|\| 1)`) | Replace `<input type="number">` with `Input` (`inputMode="numeric"`), whole integers `>= 1` (e.g. `1..3650` or `>= 1`), letting user clear while typing and disabling Save if `< 1` or non-numeric. | Unit/e2e test: clearing and typing `"3"` produces `"3-week"`; `0` or `"abc"` blocks Save. |
| G2 | `components/recurring/RecurringFormModal.tsx:520` (`worktree`) | `Date flexibility` (`± days for matching`) | No (integer days) | `server/src/routes/schedules.ts:88`: `dateFlexibility: z.number().int().min(0).max(14)` | Replace `<Input type="number">` with `Input` (`inputMode="numeric"`), whole integers `0..14` with inline invalid message outside `0..14` (preserving `aria-label="Date flexibility"`). | Unit/e2e test: `"15"` or `"-1"` marks invalid / blocks save instead of silently clamping on every keystroke; `"5"` saves `5`. |
| G3 | `components/transactions/ImportModal.tsx:767` (`worktree`) | `Rows above the header` (`skipRows`) | No (integer row count) | `server/src/utils/importSettings.ts:33`: `skipRows: z.number().int().min(0).max(1000)` | Replace `<input type="number">` with `Input` (`inputMode="numeric"`), preserving `skipRowsDraft` and capping at `Math.min(1000, Math.max(records.length - 1, 0))` (note: changes ARIA role from `spinbutton` to `textbox`, updating `e2e/tests/data.spec.ts:331,611,618`). | `data.spec.ts` + unit test: `skipRows` accepts `"1"` (`textbox`), rejects `>1000` or `>= records.length` / negative without losing table preview while typing. |
| G3 | `components/forecast/CashRunway.tsx:182` (`worktree`) | `Variable spending %` & `Income %` (1 helper, 2 fields) | No (integer %) | `server/src/services/forecastConfig.ts:10,12`: `spendingPercent: z.number().int().min(0).max(500)`, `incomePercent: z.number().int().min(0).max(200)` | Replace `<Input type="number">` with `Input` (`inputMode="numeric"`), whole integers `0..500` (spending) and `0..200` (income) using `WholeNumberField`-style text buffer + `useReportAmountValidity` / error state. | Unit/e2e test: `"120"` updates scenario; `"501"` (spending) or `"201"` (income) or `"12.5"` marks invalid. |
| G3 | `components/forecast/CashRunway.tsx:221` (`worktree`) | `Goal growth % a year` (`annualReturnBasisPoints / 100`) | No (rate %) | `server/src/services/forecastConfig.ts:16`: `annualReturnBasisPoints: z.number().int().min(-10000).max(5000)` (`-100%` to `50%`) | Replace `<Input type="number" step="0.1">` with `Input` (`inputMode="decimal"`), mirroring `longterm/fields.tsx` `RateField` (`inputToBps`, `-100%..50%`). | Unit/e2e test: `"5.5"` -> `550` bps; `"-101"` or `"51"` marks invalid. |
| G3 | `components/longterm/EventEditor.tsx:382` (`worktree`) | `Last year` (`endYear`, optional) | No (optional year) | `server/src/services/longTermConfig.ts:173`: `endYear: z.number().int().min(1900).max(2300).nullable()` | Replace `<Input type="number">` with `Input` (`inputMode="numeric"`, `placeholder="No end"`), accepting `""` (`null`) or whole integers `1900..2300` (using `useReportAmountValidity` so out-of-range years like `1800` or `2400` block saving before hitting the server). | Unit/e2e test: empty string clears to `null`; `"2045"` saves; `"1800"` or `"2301"` marks invalid and disables save (previously uncapped in UI!). |

*(Phase 4 remainder for completeness: `components/plans/NewPlanModal.tsx:193` `instalmentCount`, `min={Math.max(1, linked.length)} max={60}`, stays untouched until Phase 4.)*

## Provisional List Classification (D-05, D-06)

> **Provisional status (`D-16`):** Where the WAVG-01 audit (Phase 2 PR 1) classifies a list differently when it ships, **the audit wins**. This table covers all ~79 `<select>` / `<Select>` occurrences on G2 and G3 screens plus custom button pickers.

### Picker Rule Shortcuts (`D-05`)
- **Categories -> `CategoryPicker` (or `CategorySelectButton`)**:
  - G2 replacements of raw `<select>` / `<Select>`: `BulkEditModal` (`CategorySelect` -> `CategorySelectButton`), `SplitTransactionModal` (`CategorySelect` -> `CategorySelectButton`), `TransactionFormRow` (`CategorySelect` -> `CategorySelectButton`), `ReceiptEditor` (`CategorySelect` -> `CategorySelectButton`), `PaydayPlan.tsx:189` (`Select` -> `CategoryPicker`/`CategorySelectButton`), `MoneyMoves.tsx:185,203` (`Select` -> `CategoryPicker` or `Combobox`! *Note:* `MoneyMoves` `"Move to"` includes `READY_TO_ASSIGN` alongside balance-annotated categories `{c.name} ($X available)`, and `GoalStatusModal.tsx:134` includes `"Keep it in ..."` + balance-annotated categories; `CurrencyDifference.tsx:83` filters to income-only or expense-only + `"No category"`; `DeleteCategoryModal.tsx:60` excludes `categoryId` + filters by `sourceIsIncome`; `GoalFormModal.tsx:156` shows expense categories + `"Manual tracking"`; `ImportCategories.tsx:143` offers `"New category"` / `"Skip"` + categories. Any category picker needing extra non-category options or custom balance annotations can either pass `noneLabel` / filter props to `CategoryPicker` or use shared `Combobox` if the audit prefers — confirm against WAVG-01 audit in Task 1!).
- **Payees -> `PayeeCombobox` / `MerchantSelect` (rebuilt on `Combobox`)**:
  - `AddTransactionModal.tsx:299`, `RuleEditorModal.tsx:419`, `RecurringFormModal.tsx:383`: `MerchantSelect` rebuilt on shared `Combobox`.

### User-Grown Lists -> Shared `Combobox` (`D-06`)
*User-grown = options come from the user's budget data (accounts, categories/groups, tags, households, goals, scenarios, forecast plans, currencies, saved/discovered models):*

| Screen / PR | File:Line | List Content | Why `Combobox` |
|-------------|-----------|--------------|----------------|
| G2 Accounts | `components/currency/CurrencySelect.tsx:45` | ~150 ISO currencies (`Common` + `All currencies`) | Searchable long list; used by `AddAccountModal`, `EditAccountModal`, `InvestmentModals` (G3), `CurrencySettings` (P4) |
| G2 Accounts | `components/currency/CurrencyDifference.tsx:83` | Filtered categories + `No category` | User-grown categories (or `CategoryPicker`) |
| G2 Budget | `components/budget/MoneyMoves.tsx:185,203` | Categories (+ `Ready to assign` on To) | User-grown categories (or `CategoryPicker`) |
| G2 Budget | `components/budget/PaydayPlan.tsx:189,492,856` | Categories (`@189`), Upcoming paydays (`@492`), Payday plans (`@856`) | User-grown categories & plans (`@492` has ~few upcoming paydays; if fixed horizon, check audit — plans `@856` is user-grown) |
| G2 Budget | `components/settings/EditCategoryModal.tsx:154,213,239` (`wt-f`) | Category groups (`@154`), Linked account (`@213`), Pool account (`@239`) | User-grown groups and accounts |
| G2 Budget | `components/settings/DeleteCategoryModal.tsx:60` (`wt-f`) | Merge-into categories | User-grown categories (or `CategoryPicker`) |
| G2 Transactions | `components/transactions/AddTransactionModal.tsx:330` | Account picker button (currently hand-rolled dropdown!) | User-grown accounts (`On budget` / `Off budget` sections!) |
| G2 Transactions | `components/receipts/ReceiptEditor.tsx:554` | Open accounts | User-grown accounts |
| G2 Transactions | `components/receipts/ReceiptsTab.tsx:444` | Local vision models (`found`) | External model list discovered from Ollama server |
| G2 Rules | `components/rules/RuleEditorModal.tsx:438,459` | Tags (`@438`), Households (`@459`) | User-grown tags and households |
| G2 Recurring | `components/recurring/RecurringFormModal.tsx:325` | Accounts (`No account` + accounts) | User-grown accounts |
| G3 Goals | `components/goals/GoalFormModal.tsx:156,224` | Progress source categories (`@156`), Linked account (`@224`) | User-grown categories & accounts |
| G3 Goals | `components/goals/GoalStatusModal.tsx:113,134` | Replacement goals (`@113`), Move-to category (`@134`) | User-grown goals & categories |
| G3 Forecast | `components/forecast/CashRunway.tsx:1000` | Open saved scenario | User-grown saved scenarios |
| G3 Forecast | `components/longterm/LongTermForecast.tsx:505,786` | Plan (`@505`), Compare with (`@786`) | User-grown forecast plans |
| G3 Forecast | `components/longterm/EventEditor.tsx:429` | Loan accounts (`@429`) | User-grown accounts |
| G3 Forecast | `components/longterm/SavingsPanel.tsx:169` | Add account to savings order | User-grown accounts |
| G3 Investments | `components/investments/InvestmentModals.tsx:360,385` | Investment accounts (`@360`), Securities (`@385`) | User-grown accounts & securities |
| G3 Files | `components/files/FileDetailModal.tsx:155` | Link target (categories/accounts/goals/transactions) | User-grown entities |
| G3 Import | `components/transactions/ImportModal.tsx:700` | Multi-account OFX/QIF statement selector | File-derived account statements |
| G3 Import | `components/transactions/YnabImportModal.tsx:386` | Allotment account per YNAB account | User-grown accounts + `Create a new account` |
| G3 Import | `components/transactions/ImportCategories.tsx:143,182` | Target category (`@143`), New category group (`@182`) | User-grown categories and groups |

### Fixed Lists -> Shared `Select` (`D-06`)
*Fixed = bounded enum, constant array, or date/period presets independent of budget growth:*

| Screen / PR | File:Line | List Content |
|-------------|-----------|--------------|
| G2 Accounts | `components/accounts/AccountTypeSelect.tsx:21` (`wt-f`) | `ACCOUNT_GROUPS` / `ACCOUNT_TYPES` (grouped fixed enum) |
| G2 Transactions | `components/transactions/BulkEditModal.tsx:141,217,268` | Action mode (`No change` / `Set to` / `Clear` / `Uncategorised` / `Prepend` / `Append`) |
| G2 Transactions | `components/receipts/ReceiptsTab.tsx:330` | Reader provider (`local`, `anthropic`, `openai`) |
| G2 Budget | `pages/AnnualBudget.tsx:244` | 12 months of selected year (`md:hidden` — note on phones `< 768px` shared `Select` renders native `<select>` per D-04!) |
| G2 Budget | `components/budget/AutoAssign.tsx:144` (`wt-f`) | `AVERAGE_MONTH_CHOICES` (`3`, `6`, `12` months) |
| G2 Budget | `components/budget/PaydayPlan.tsx:141,204` (`wt-f`) | `weekendAdjust` (`@141`), Funding method (`@204`) |
| G2 Budget | `components/budget/TargetCard.tsx:87` (`wt-f`) | `TYPES` (`monthly`, `by-date`, `recurring`, `refill`) |
| G2 Rules | `components/rules/RuleEditorModal.tsx:90,197,215,257,398,481,539` | `all`/`any`, `CONDITION_FIELDS`, `Operator`, `inflow`/`outflow`, `ACTION_TYPES`, ATO labels (`D1..D10, D15`), Split kind (`Amount`/`Percent`/`Remainder`) |
| G2 Recurring | `components/recurring/RecurringFormModal.tsx:305,443,496` | `RECURRENCE_TYPE_LABELS`, `REMINDER_LEADS`, `WEEKEND_ADJUST_OPTIONS` |
| G2 Recurring | `components/recurring/UpcomingLengthModal.tsx:57,88` | `UPCOMING_PRESETS`, `UNITS` (`Days`/`Weeks`/`Months`/`Years`) |
| G3 Forecast | `components/forecast/CashRunway.tsx:707,717,727,740` | Horizon (`30..730`), Lookback (`28..365`), Income source (3 fixed), Household shares (3 fixed) |
| G3 Forecast | `components/longterm/LongTermForecast.tsx:650` | Projection year (`1..N` years of plan) — *or `Combobox` if 60+ years feels long; fixed span per plan, check WAVG-01 audit* |
| G3 Forecast | `components/longterm/AccountsPanel.tsx:134,231` | `STUDY_KINDS`, `CLASSES` (asset classes) |
| G3 Forecast | `components/longterm/EventEditor.tsx:149` | Deposit type (`Percent of price` / `Dollar amount`) |
| G3 Forecast | `components/longterm/SavingsPanel.tsx:93` | Cap mode (`all` / `percent`) |
| G3 Forecast | `components/longterm/SimulationPanel.tsx:176` | `PATHS` simulation count |
| G3 Forecast | `components/longterm/fields.tsx:231,275` | `A year`/`An age`, Escalation (`inflation`/`rate`/`none`) |
| G3 Investments | `components/investments/IncomeModals.tsx:99` | `INCOME_KINDS` |
| G3 Investments | `components/investments/InvestmentModals.tsx:173` | `SECURITY_KINDS` |
| G3 Reports | `components/reports/ReportBuilderSidebar.tsx:105` | `Group by` (`month`/`category`/`payee`/`tag`) |
| G3 Files | `pages/Files.tsx:300` | `KIND_LABELS` (`Any kind` + file kinds) |
| G3 Import | `components/transactions/ImportModal.tsx:738,752,786,801,865` | `DELIMITERS`, `CSV_ENCODINGS`, `DATE_FORMAT_LABELS`, `NUMBER_FORMAT_LABELS`, `roleOptions` (`Column ${h}`) |
| G3 Import | `components/transactions/YnabImportModal.tsx:320,336` | `DATE_LABELS`, `NUMBER_LABELS` |

## Hard Cases & Architectural Invariants

### 1. Table Rows, Inline Editors, and Compact/Dense Controls (Claude's Discretion)
Several G2 and G3 screens place controls inside dense table cells, register rows, or inline rename editors using smaller heights/padding than the default `h-10` (`40px`) or `sm` (`h-8`, `32px`) fields (`02-UI-SPEC.md` §2.3):
- **`Budget.tsx` (`wt-f`, lines 121-160) inline `AmountInput`**: Inside a `h-14` table cell, uses `autoFocus`, `ref={input}`, `readOnly={saving}`, `onFocus={(e) => e.target.select()}`, `onKeyDown` (`Enter`/`Escape`/`ArrowUp`/`ArrowDown`/`Tab`), `readAmountExpression` (`"100+50"`).
- **`Budget.tsx:334` (`wt-f`) row checkbox**: `absolute left-4 top-3 h-3.5 w-3.5` inside `pl-10` `<td>`. Switching to Phase 2 `Checkbox` (`size-5` = `20px`, `max-md:min-h-11 max-md:min-w-11` on phone) requires checking cell spacing (`16px + 20px = 36px` inside `40px` `pl-10`) so the indicator doesn't crowd the category name.
- **`Payees.tsx:259,358` & `CategoryManager.tsx:61` (`wt-f`) inline rename `<input>`**: Uses `px-2 py-0.5 text-sm` (`Payees.tsx:368`, `CategoryManager.tsx:79`), `autoFocus`, `useRef` + `.select()` (`CategoryManager.tsx:57`), `Enter`/`Escape`/`onBlur`.
- **`TransactionFormRow.tsx` (`worktree`, lines 251-416)**: Desktop inline register editor uses compact `py-1 text-sm` (`inputCls`), while phone bottom-sheet mode (`sheet === true`) uses full-size inputs (`max-md:min-h-11 text-base`).
- **`ImportModal.tsx:865` (`worktree`)**: Column role `<select>`s inside `<th className="px-2 py-1">` inside an `overflow-x-auto` table (`ImportModal.tsx:858`).
- **`Budget.tsx:1148` (`wt-f`), `TransactionFilters.tsx:178`, `Payees.tsx:171`, `Rules.tsx:294`, `Files.tsx:289` search inputs**: Pair `<Search size={14} />` inside a `relative` wrapper (`pl-8` + optional clear button `pr-8`).
- **Recommendation (Claude's Discretion):** Per `03-CONTEXT.md` Claude's Discretion ("extend the shared control, with its gallery state and screenshot, rather than styling around it on the screen"), verify in G2 Task 1 whether Phase 2 shipped a `size="sm"` / `dense` / `inline` variant and `startIcon` / `className` pass-through on `Input` and `Select`. If missing, extend `ui/Input.tsx` / `ui/Select.tsx` cleanly (with gallery specimen + Linux screenshot update) instead of keeping one-off `py-0.5` classes on screens.

### 2. Modals, Animated/Scrolling Panels, Portals & `overflow-clip`
- **Portals inside `overflow-x-auto` / `overflow-y-auto` / `Modal`:** React Aria `Select`, `Combobox`, `DatePicker`, and `MonthPicker` portal their `Popover` to `document.body` (`02-RESEARCH.md:146-152`). This fixes clipping inside `ImportModal`'s `overflow-x-auto` header table (`ImportModal.tsx:858`), `TransactionTable`'s `overflow-clip` detail drawer (`TransactionTable.tsx:662`), and scrollable `Modal` bodies.
- **`Modal.tsx` Escape trap:** `Modal.tsx:153-156` closes on `Escape` unless `e.defaultPrevented`. Phase 2's `02-RESEARCH.md` Pitfall 4 flags verifying that `Escape` on an open `Select`/`Combobox`/`DatePicker` popover inside `Modal` closes only the popover. G2/G3 modals (`RuleEditorModal`, `RecurringFormModal`, `GoalFormModal`, `ImportModal`, `EditCategoryModal`, `InvestmentModals`) must keep this invariant intact.
- **`TransactionDetailPanel.tsx:375-376` (`DatePicker` save trigger trap):** Today `TransactionDetailPanel` updates `localDate` in `onChange` and commits `updateTx.mutate` in `onBlur={saveDate}`. With React Aria `DatePicker`, choosing a date in the calendar popover or clicking `"Today"` invokes `onChange(iso)` and returns focus to the calendar button **without** blurring the `DatePicker` group — `onBlur` will not fire until the user clicks away! Conversely, React Aria `DatePicker` only calls `onChange(iso)` when all 3 date segments form a complete valid date (never mid-segment). Therefore `TransactionDetailPanel` MUST commit `updateTx.mutate({ id: tx.id, data: { date: iso } })` inside `onChange` when `iso && iso !== tx.date` (mirroring `FileDetailModal.tsx:283-286`), while keeping `isDisabled={isReconciled}` (`TransactionDetailPanel.tsx:377`) so reconciled transactions remain uneditable (`CLAUDE.md` invariant).
- **Custom checkbox/multi-select popovers (`ReportDetail.tsx:607` `TrendCategoryPicker`, `AccountMultiSelect.tsx`, `CategoryTreePicker.tsx`, `ImportModal` preview table):** When replacing raw `<input type="checkbox">` inside `TrendCategoryPicker` (`ReportDetail.tsx:681`) and `AccountMultiSelect` / `CategoryTreePicker`, **remove the wrapping `<label>`** (`ReportDetail.tsx:673`, `Payees.tsx:220,240`, `EditAccountModal.tsx:231,244`, `AddAccountModal.tsx:165`, `ReceiptsTab.tsx:230,477`, `TransactionMarks.tsx`, `TransactionFilters.tsx`) because React Aria `Checkbox` renders its own `<label>` around its hidden `<input>`. Nesting `<label><Checkbox /></label>` produces invalid HTML and triggers `jsx-a11y/label-has-associated-control` warnings.
- **Same rule for `<label>` wrapping `Select`, `DatePicker`, `Combobox`, `RadioGroup`:** In `EditCategoryModal.tsx:182-197`, `Payees.tsx:45-65`, `AutoAssign.tsx:129,166`, `GoalFormModal.tsx`, `GoalStatusModal.tsx`, `CashRunway.tsx`, `PaydayPlan.tsx`, `TargetCard.tsx`, `ImportModal.tsx`, `YnabImportModal.tsx`, `ReceiptsTab.tsx`, `FileDetailModal.tsx`, remove `<label>` wrappers and pass `label="..."` to `Field` or the control directly! Remember `lint/eslint.config.js:126` only exempts `['Input', 'Select', 'CurrencyInput', 'MoneyInput', 'AmountInput']` for `jsx-a11y/label-has-associated-control` — wrapping React Aria `Select` (which renders `<AriaButton>` on desktop) in a `<label>` will emit an ESLint warning AND fail `strayLabels` in `e2e/tests/accessibility.spec.ts`!

### 3. Controlled vs `react-hook-form` / Uncontrolled Usage & `forwardRef` Needs
- **`react-hook-form`:** Not used anywhere in `client/src/` (`rg -n react-hook-form` = 0 matches; not in `client/package.json`).
- **Uncontrolled `FormData` / `defaultValue`:** Used in `pages/Household.tsx` (Phase 4 only) and **one place in G3**: `components/files/FileDetailModal.tsx:157` (`<Select defaultValue="" onChange={...}>` for linking an entity). When migrating `FileDetailModal.tsx:155` to `Combobox` / `Select`, switch `defaultValue=""` to controlled `selectedKey={linkTarget}` (`""` reset after selection).
- **`forwardRef` requirements:** Verified in `client/src/`:
  - `pages/Budget.tsx:97` (`AmountInput`: `const input = useRef<HTMLInputElement>(null);` for `.focus()`, `.select()` on error)
  - `components/budget/MoneyMoves.tsx:63` (`const amountField = useRef<HTMLInputElement>(null);`)
  - `components/settings/CategoryManager.tsx:53` (`wt-f`: `const inputRef = useRef<HTMLInputElement>(null);` for `inputRef.current?.select()`)
  - `components/ui/CurrencyInput.tsx:45` (internal `inputRef`)
  - `components/files/FileParts.tsx:147`, `components/receipts/ReceiptsTab.tsx:59`, `components/tax/ReceiptsSection.tsx:47`, `components/payees/PayeeIcon.tsx:38`, `components/accounts/EditAccountModal.tsx:40` (all `<input type="file">` — stay native per D-17).
  - **Contract check in G2 Task 1 (`D-16`):** Ensure Phase 2's shipped `ui/Input.tsx` uses `forwardRef<HTMLInputElement, ...>` (just as legacy `Input.tsx:9` does) so `Budget.tsx`, `MoneyMoves.tsx`, and `CategoryManager.tsx` refs keep working without type errors or lost focus-on-error!

### 4. Large Files (`ImportModal.tsx`, `LongTermForecast.tsx`, `Budget.tsx`, `CashRunway.tsx`, `ReportDetail.tsx`, `PaydayPlan.tsx`)
- **`ImportModal.tsx` (1147 lines, `worktree`)**: Multi-step wizard (`upload` -> `statement` -> `map` -> `categories` -> `preview` -> `done`). Controls are concentrated in `steps` (`679..1019`): 1 native `<input type="file">` (`@679`, keep native), 6 `<select>` (`@700, 738, 752, 786, 801, 865`), 1 `<input type="number">` (`@766`, `skipRows` with `skipRowsDraft`), 1 `<input type="text">` (`@817`, `outWord`), 1 `<input type="checkbox">` (`@1012` inside preview `<tbody>`). Because all JSX is in one component with shared `step` state, migrate `ImportModal.tsx` as **one dedicated task** (not split across workers) and run `data.spec.ts` + `switchers.spec.ts` + `demo.spec.ts` immediately.
- **`LongTermForecast.tsx` (910 lines, `worktree`)**: Controls are already mostly wrapped in `longterm/fields.tsx` (`Field`, `Input`, `Select`). Its 5 occurrences (`@105, 505, 650, 786, 848`) are clean swaps (`Input` / `Select` / `Combobox`), independent of `AccountsPanel`, `AssumptionsPanel`, `EventEditor`, `EventList`, `SavingsPanel`, `SimulationPanel`, and `fields.tsx` — making `components/longterm/` easy to update cleanly by updating `fields.tsx` first and the panel files in parallel!
- **`Budget.tsx` (1484 lines, `wt-f`)**: Only 3 raw `<input>` lines (`@121` `AmountInput`, `@334` row checkbox, `@1148` search box) — concentrated and low-risk once `Input` `forwardRef` and dense sizing are confirmed.

### 5. Native Allowlist (D-17 — Must Stay Native)
All 7 `<input type="file">` controls in Phase 3 stay native `<input type="file">` and must be listed in the G2/G3 PR descriptions for Phase 4's lint allowlist (`WAVG-09`):
- **G2 (4 file inputs):** `components/accounts/EditAccountModal.tsx:157` (`wt-f`, account logo), `components/payees/PayeeIcon.tsx:99` (payee logo), `components/receipts/ReceiptsTab.tsx:72` (scan receipt photo, `capture="environment"`), `components/tax/ReceiptsSection.tsx:81` (receipt drop/upload).
- **G3 (3 file inputs):** `components/files/FileParts.tsx:199` (`FileDrop` upload), `components/transactions/ImportModal.tsx:679` (`#csv-file-input`), `components/transactions/YnabImportModal.tsx:296` (`#ynab-file-input`).
- *(Neighbour native controls in `components/ui/`: `Slider.tsx` `<input type="range">` stays inside `components/ui/` and is untouched in Phase 3.)*

### 6. Safe Mode, Paused Saving (`useCanSave`), Demo Worker, and Offline Start
- **Safe mode (`Private`, `PrivateSection`, `SafeModeNotice`):** `Accounts`, `AccountTransactions`, `ReconcilePage`, `PayeeDetail`, `Goals`, `CashRunway`, `LongTermForecast`, `Investments`, `BuiltinReport`, `ReportDetail` wrap figures/charts in `<Private>` / `<PrivateSection>` / `<SafeModeNotice>`. Swapping form controls around them does not leak amounts; note `AddTransactionModal.tsx:378` renders `<Private>` inside account picker options — rebuilding that account picker onto shared `Combobox` MUST preserve `<Private>` inside option rendering!
- **Paused saving (`useCanSave`, `<SavingPausedHint />`):** Preserved on every save CTA (`EditCategoryModal`, `AddAccountModal`, `EditAccountModal`, `PaydayPlan`, `TargetCard`, `MoneyMoves`, `HoldMoney`, `NoteField`, `BudgetAmountSheet`, `AutoAssign`, `RuleEditorModal`, `RecurringFormModal`, `GoalFormModal`, `GoalStatusModal`, `LongTermForecast`, `InvestmentModals`, `ImportModal`, `YnabImportModal`, `Files`, `FileDetailModal`, `CurrencyDifference`). **Crucial offline/paused-saving case:** `MerchantSelect.tsx:112-117` shows `"New payees can be added once Allotment reconnects."` when `!canSave` instead of `"Create new payee"` — must be preserved when rebuilding `MerchantSelect` on `Combobox`! Also `TransactionDetailPanel.tsx:158-162` hides `transferAccounts` when `!canSave` and disables fields when `isReconciled`.
- **Demo worker (`IS_DEMO`) & Offline start (`retryingImport`):**
  - `Budget.tsx` and `Transactions.tsx` are in the main bundle (`App.tsx:6-8`); all other Phase 3 pages are `lazy()` in `App.tsx:17-39`.
  - `ImportModal.tsx:674` shows the demo note (`IS_DEMO`) and `demo/demo.spec.ts:255` tests CSV import via `#csv-file-input` in demo mode; `demo/long-term-forecast.spec.ts` and `demo/category-goals.spec.ts` test G3 screens in the demo worker.
  - Because `ui/` shared controls are plain local modules bundled directly (no external runtime imports or network calls), demo mode and offline start continue working identically — verified by running `--project=demo` and `offline` checks in `e2e`.

## E2E Test Impact

Every desktop `<select>` -> React Aria `Select` (`button` + `ListBox` `option`) or `Combobox` (`combobox` + `ListBox` `option`), every `<input type="date">` -> `DatePicker`, every `<input type="number">` -> `Input` (`inputMode="numeric"|"decimal"`), and every `CategorySelect` -> `CategorySelectButton`/`CategoryPicker` change affects Playwright selectors. **Phone specs (`e2e/tests/phone/`) keep `selectOption` on `Select`, `DatePicker`, and `MonthPicker` because `D-04` renders native controls under `768 px`** — EXCEPT `CategorySelect` in `TransactionFormRow` if migrated to `CategorySelectButton` (`CategoryPicker`) on all widths (`phone-native.spec.ts:182-183`).

### G2 E2E Selector Impact
| Spec File (`e2e/tests/`) | Line(s) | Current Selector / Action | Why It Breaks | Replacement Pattern |
|--------------------------|---------|---------------------------|---------------|---------------------|
| `accessibility.spec.ts` | `158-159` | `add.getByText('Account type').click(); expect(add.getByRole('combobox', { name: 'Account type' })).toBeFocused()` | Desktop React Aria `Select` trigger is `role="button"`, not `combobox`, and `<Label elementType="span">` doesn't focus `<button>` on click unless wired. | Check `getByRole('button', { name: 'Account type' })` (and verify label-click or Tab focus per Phase 2). |
| `accessibility.spec.ts` | `181-182` | `recurring.getByText('Start date').click(); expect(recurring.getByLabel('Start date')).toBeFocused()` | `DatePicker` renders `<Label elementType="span">` + `DateInput` (`role="group"`) with inner `spinbutton` segments (`02-RESEARCH.md`). | Focus/verify inner segment or `DatePicker` group `[role="spinbutton"]` focus. |
| `accessibility.spec.ts` | `190` | `category.getByRole('group', { name: 'Budget type' })` | `EditCategoryModal` moves from `div[role="group"]` to React Aria `RadioGroup` (`role="radiogroup"`). | Update to `getByRole('radiogroup', { name: 'Budget type' })`. |
| `accounts.spec.ts` | `11, 61` | `dialog.getByRole('combobox', { name: 'Account type' }).selectOption(...)` | Desktop `Select` is button + listbox options. | Click trigger `getByRole('button', { name: 'Account type' })` -> click `getByRole('option', { name: ... })`. |
| `currencies.spec.ts` | `41` | `dialog.getByRole('combobox', { name: 'Currency' }).selectOption('JPY')` | `CurrencySelect` moves to `Combobox`. *(Lines `31, 126` are Settings = Phase 4.)* | Type/open `getByRole('combobox', { name: 'Currency' })` -> click `getByRole('option', { name: /JPY/ })`. |
| `envelope-funding.spec.ts` | `58-59, 117, 119, 138, 145-146` | `.selectOption(...)` and `.toHaveValue(rent.id)` on `Move from` / `Move to` | `MoneyMoves` moves from native `<Select>` to `CategoryPicker` / `Combobox`. | Open picker / combobox -> select option; assert `.toHaveText(...)` / `.toHaveValue(label)` instead of `id`. |
| `payday.spec.ts` | `33` | `getByLabel('Category 1', { exact: true }).selectOption(food.id)` | `PaydayPlan` Category moves to `CategoryPicker` / `Combobox`. | Open picker / combobox -> pick category option. |
| `targets.spec.ts` | `18` | `form.getByLabel('Target type').selectOption('refill')` | `TargetCard` moves to `Select`. | Click trigger `getByRole('button', { name: 'Target type' })` -> click `getByRole('option', { name: ... })`. |
| `settings.spec.ts` | `184` | `dialog.getByRole('combobox', { name: 'Merge into' }).selectOption(transit.id)` | `DeleteCategoryModal` (opened from `/budget/categories` in G2) moves to `CategoryPicker` / `Combobox`. | Open picker / combobox -> select `Transit` option. |
| `transactions.spec.ts` | `29, 123-124, 128-129` | `getByRole('combobox', { name: 'Category' \| 'Split 1 category' \| 'Split 2 category' }).selectOption(...)` | `TransactionFormRow` moves from `CategorySelect` to `CategorySelectButton` (`CategoryPicker`). | Click category button -> search/click `getByRole('option', { name: ... })`. |
| `transactions.spec.ts` | `183-184` | `panel.getByRole('textbox', { name: 'Date' }).fill(otherDayThisMonth())` | `TransactionDetailPanel` `Date` moves to `DatePicker`. | Use Phase 2's planned `fillDate(panel.getByLabel('Date'), otherDayThisMonth())`. |
| `transaction-filters.spec.ts` | `81-82` | `getByLabel('From').fill('2026-11-01'); expect(...).toHaveValue('2026-11-01')` | `TransactionFilters` `From`/`To` move to `DatePicker`. | Use `fillDate(...)`; assert segment text / filter pill / URL param instead of `toHaveValue('2026-11-01')`. |
| `rules.spec.ts` | `33, 34` | `getByRole('combobox', { name: 'Field' \| 'Operator' }).selectOption(...)` | `RuleEditorModal` moves to `Select`. | Click `getByRole('button', { name: ... })` -> click `getByRole('option', { name: ... })`. |
| `recurring.spec.ts` | `46, 47, 79, 86-87, 97` | `Frequency`/`Account` `.selectOption(...)`, `toHaveValue(/.+/)`, `locator('option:checked')` | `Frequency` -> `Select`, `Account` -> `Combobox` (no `<option:checked>`). | Listbox pattern for `Frequency`; `Combobox` pick + `toHaveValue('Savings')` for `Account`. |
| `recurring.spec.ts` | `48` | `dialog.getByRole('textbox', { name: 'Start date' }).fill(isoDay(1))` | `RecurringFormModal` `Start date` moves to `DatePicker`. | Use `fillDate(dialog.getByLabel('Start date'), isoDay(1))`. |
| `recurring.spec.ts` | `82, 84, 98` | `dialog.getByRole('textbox', { name: 'Payee' })` | `MerchantSelect` rebuilt on `Combobox` gives `<Input>` `role="combobox"`. *(Keep `"Create new payee"` as a `<Button>` in footer so `:83` stays `getByRole('button')`!)* | Update to `getByRole('combobox', { name: 'Payee' })`. |
| `receipts-tab.spec.ts` | `43, 77, 98, 147` & `57, 102, 158` | `Date` `.fill(isoDay())`; `Item N category` & `Account` `.selectOption(...)` | `ReceiptEditor` `Date` -> `DatePicker`; `CategorySelect` -> `CategoryPicker`; `Account` -> `Combobox`. | Use `fillDate(...)`, `CategoryPicker`, and `Combobox` option click. |
| `receipts-reader.spec.ts` | `83, 103` | `settings.getByLabel('Model').selectOption(...)`; `Date` `.toHaveValue(isoDay())` | `ReceiptsTab` `Model` -> `Combobox`/`Select`; `ReceiptEditor` `Date` -> `DatePicker`. | Listbox option click for `Model`; assert date segments / formatted day for `Date`. |
| `phone/phone-native.spec.ts` | `182-183` | `getByRole('combobox', { name: 'Split 1 category' }).selectOption(...)` | If `TransactionFormRow` moves from `CategorySelect` to `CategorySelectButton` (`CategoryPicker`), phone uses `CategoryPicker` too (D-05). | Click `Category` button -> fill `Search categories` -> click `option` (or keep native `<select>` on phone inside `CategorySelectButton`? D-05 says categories use `CategoryPicker`!). |

*(Note: `phone/annual-budget-phone.spec.ts:58-87` stays `selectOption` on phone per D-04 because `AnnualBudget`'s jump-to-month `Select` renders native `<select>` under `768px`.)*

### G3 E2E Selector Impact
| Spec File (`e2e/tests/`) | Line(s) | Current Selector / Action | Why It Breaks | Replacement Pattern |
|--------------------------|---------|---------------------------|---------------|---------------------|
| `category-goals.spec.ts` + `demo/category-goals.spec.ts` | `19, 58` | `dialog.getByLabel('Progress source').selectOption(...)` | `GoalFormModal` moves to `CategoryPicker` / `Combobox`. | Click / fill & pick `getByRole('option', { name: ... })` (check `demo/category-goals.spec.ts` too!). |
| `settings.spec.ts` | `350` | `dialog.getByRole('combobox', { name: 'Linked account' }).selectOption({ label: 'Savings' })` | `GoalFormModal` `Linked account` moves to `Combobox`. | Fill/open `getByRole('combobox', { name: 'Linked account' })` -> click `getByRole('option', { name: 'Savings' })`. |
| `long-term-forecast.spec.ts` + `demo/long-term-forecast.spec.ts` | `98,139,140,166,312,320` / `24` | `.selectOption(...)` on `Year`, `Add an account to the savings order`, `Compare with`, `Plan` | `LongTermForecast` & `SavingsPanel` move to `Select` / `Combobox`. *(`phone/long-term-forecast.spec.ts:119,127` stays `selectOption` per D-04!)* | Desktop listbox / combobox option click pattern. |
| `investments.spec.ts` | `30, 41, 92, 168, 236` | `.fill(...)` on `Date`, `Bought on`, `Sold on`, `Paid on`, `Effective on` | `InvestmentModals`, `SaleModals`, `IncomeModals`, `SplitModals` move `type="date"` to `DatePicker`. *(`:127,191` are `/tax` = Phase 4.)* | Use `fillDate(...)` on all 5 date fields. |
| `reports.spec.ts` & `unsaved-drafts.spec.ts` | `101, 107` & `66, 74, 82` | `getByRole('combobox', { name: 'Group by' }).selectOption(...)` & `.toHaveValue('payee')` | `ReportBuilderSidebar` `Group by` moves to desktop `Select` (`button` + `option`). | Click `getByRole('button', { name: 'Group by' })` -> click `option`; `.toHaveText(/By payee/)` instead of `.toHaveValue('payee')`. |
| `data.spec.ts` & `switchers.spec.ts` | `data.spec.ts:43-46, 203-210, 241-245, 270-289, 302-304, 331, 335, 357-360, 379, 503-523, 611-621, 637-638, 667`; `switchers.spec.ts:46, 51-57, 142, 145` | `.selectOption(...)`, `.toHaveValue(...)` on `ImportModal` / `YnabImportModal` / `ImportCategories` selects, and `getByRole('spinbutton', { name: 'Rows above the header' })` | `ImportModal`/`YnabImportModal`/`ImportCategories` lists move to `Select`/`Combobox` (no `.toHaveValue()` on `Select` trigger button); `skipRows` moves from `type="number"` (`spinbutton`) to `inputMode="numeric"` (`textbox`). | Listbox / combobox option clicks; `toHaveText(...)` on `Select` buttons; `getByRole('textbox', { name: 'Rows above the header' })` for `skipRows`. *(Note `switchers.spec.ts:229-240, 356-359` are bank connection modals = Phase 4.)* |

## PR Splitting, Wave Execution & Release Plan

### Recommended Plan & Wave Decomposition

#### PR 1: G2 (`WAVG-05` — Transactions, Accounts, Budget, Payees, Rules, Recurring)
1. **Wave 0 (Plan 03-01 — Blocking Gate per `D-16`):** Read the shipped WAVG-01 audit and Phase 2 `client/src/components/ui/` implementations. Confirm/reconcile file list, D-06 classifications, any needed dense/inline `ui/Input` / `ui/Select` variant + `forwardRef` support (extend `ui/` + `DevControlsGallery` if needed).
2. **Wave 1 (Plan 03-02 — Shared G2 Adapters):** Rebuild `MerchantSelect.tsx` on shared `Combobox` (preserving `PayeeIcon`, counts, `"Create new payee"`, `!canSave` message) and `CurrencySelect.tsx` on shared `Combobox`; update `CurrencyDifference.tsx` (`CategoryPicker` / `Combobox`).
3. **Wave 2 (Parallel Screen Plans — non-overlapping folders):**
   - **Plan 03-03 (Accounts):** `pages/ReconcilePage.tsx`, `components/accounts/{AccountTypeSelect,AddAccountModal,DeleteAccountModal,EditAccountModal}.tsx`.
   - **Plan 03-04 (Payees & Rules):** `pages/Payees.tsx`, `pages/Rules.tsx`, `components/rules/{ApplyRulesModal,OptionPicker,RuleEditorModal}.tsx` (includes D-14 split `%` fix + test).
   - **Plan 03-05 (Recurring):** `components/recurring/{AllTab,DiscoverSchedulesModal,OccurrenceMatchModal,RecurringFormModal,UpcomingLengthModal}.tsx` (includes D-14 `dateFlexibility` & `UpcomingLengthModal` fixes + tests).
4. **Wave 3 (Parallel Screen Plans — remaining G2 folders):**
   - **Plan 03-06 (Budget & Categories):** `pages/Budget.tsx`, `pages/AnnualBudget.tsx`, `components/budget/{AutoAssign,BudgetAmountSheet,CardPayments,FundingRows,MoneyMoves,NoteField,PaydayPlan,TargetCard}.tsx`, `components/settings/{CategoryManager,EditCategoryModal,DeleteCategoryModal}.tsx` (includes D-14 `TargetCard` cycle & `PaydayPlan` percent fixes + tests).
   - **Plan 03-07 (Transactions & Receipts):** `components/transactions/{AddTransactionModal,BulkDeleteModal,BulkEditModal,SplitTransactionModal,TransactionDetailPanel,TransactionFilters,TransactionFormRow,TransactionMarks,TransactionTable,TransferSuggestions}.tsx`, `components/receipts/{ReceiptEditor,ReceiptsTab}.tsx` (switches 4 G2 `CategorySelect` callers to `CategorySelectButton`; fixes `TransactionDetailPanel` `DatePicker` `onChange` save).
5. **Wave 4 (Plan 03-08 — G2 E2E, Lint Cap, Docs & Release Prep):** Update G2 e2e selectors (with rationale in PR), run full `client` + `lint` + `format:check` + `e2e` (`desktop`, `phone`, `demo`, `server-mode`, `gallery`), capture `.ui-evidence/<date>-wave-g2/`, lower `lint/package.json` `--max-warnings` if warnings dropped, run `npm run release:prepare -- 0.2.0-up.<next>`, update `CHANGELOG.md`, `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`, `docs/ui/WAVES.md`, list D-17 native file inputs in PR, merge to `redesign` before starting G3 (`D-12`).

#### PR 2: G3 (`WAVG-06` — Goals, Forecast, Investments, Reports, Files, Import & Export Dialogs)
*Starts only after G2 is merged to `redesign` (`D-12`).*
1. **Wave 0 (Plan 03-09 — Gate per `D-16`):** Re-check G3 files against WAVG-01 audit and shipped `ui/` controls (especially `DataExport.tsx` placement — Open Question 1).
2. **Wave 1 (Parallel Screen Plans — non-overlapping folders):**
   - **Plan 03-10 (Goals & Investments):** `components/goals/{GoalFormModal,GoalStatusModal}.tsx`, `components/investments/{IncomeModals,InvestmentModals,SaleModals,SplitModals}.tsx`.
   - **Plan 03-11 (Forecast & Long-Term):** `components/forecast/CashRunway.tsx` (D-14 spending %, income %, goal growth % + tests), `components/longterm/{AccountsPanel,AssumptionsPanel,EventEditor,EventList,LongTermForecast,SavingsPanel,SimulationPanel,fields}.tsx` (D-14 `endYear` + test).
   - **Plan 03-12 (Reports & Files):** `components/reports/{AccountMultiSelect,CategoryTreePicker,ReportBuilderSidebar,ReportDetail,SaveReportModal,dashboard/NameModal}.tsx`, `pages/Files.tsx`, `components/files/{FileDetailModal,FilesSection}.tsx`.
3. **Wave 2 (Plan 03-13 — Import & Export Dialogs):** `components/transactions/{ImportModal,YnabImportModal,ImportCategories}.tsx` (includes D-14 `skipRows` fix + test; plus `settings/DataExport.tsx` if included per Open Question 1).
4. **Wave 3 (Plan 03-14 — G3 E2E, Lint Cap, Docs & Release Prep):** Update G3 e2e selectors (`data.spec.ts`, `switchers.spec.ts`, `investments.spec.ts`, `long-term-forecast.spec.ts`, `category-goals.spec.ts`, `reports.spec.ts`, `unsaved-drafts.spec.ts`, `settings.spec.ts`), run full checks (`desktop`, `phone`, `demo`, `server-mode`, `gallery`), capture `.ui-evidence/<date>-wave-g3/`, update `--max-warnings` if reduced, run `npm run release:prepare -- 0.2.0-up.<next>`, update `CHANGELOG.md`, `HANDOVER-UI.md`, `MAP.md`, `WAVES.md`, list D-17 native inputs in PR.

### Lint Warning Cap & Release Steps
- **Lint warning cap (`lint/package.json:8`):** Currently `--max-warnings=128` `[VERIFIED: lint/package.json:8]` (note `REQUIREMENTS.md:56` and `STATE.md:118` still cite `135`, the pre-Wave-F cap). New `jsx-a11y` warnings (e.g., `<label>` wrapping React Aria `Select`/`Checkbox`/`DatePicker`/`Combobox`, or `<input>` without label) will fail CI. Whenever G2 or G3 removes existing warnings, lower `--max-warnings` in `lint/package.json` in that same PR (`lint/README.md:23-24`).
- **Release steps (`scripts/prepare-release.py`):** Each PR runs `npm run release:prepare -- <next 0.2.0-up.N>` (sets `package.json`, `package-lock.json`, `homeassistant/config.yaml` together) and prepends a `CHANGELOG.md` entry `[VERIFIED: scripts/prepare-release.py:11-28]`. (`0.2.0-up.174` is PR #273 Wave F; Phase 2 PR 2 will claim `up.175`, so G2 and G3 will take the next free `0.2.0-up.N` at execution time — never hard-code the number in plans.)

## Common Pitfalls

### Pitfall 1: Outer `<label>` Around React Aria Controls Breaks Both ESLint and `accessibility.spec.ts`
- **What goes wrong:** Over 25 sites in G2/G3 wrap `<select>`, `<Input>`, `<input type="checkbox">`, or `<input type="radio">` inside `<label>...</label>` (e.g. `MoneyMoves.tsx:183`, `TargetCard.tsx:101,112`, `PaydayPlan.tsx:187`, `Payees.tsx:45,220,240`, `EditCategoryModal.tsx:182`, `ImportModal.tsx:698-815`, `ReportDetail.tsx:673`, `ReceiptsTab.tsx:230,477`).
- **How to avoid:** Unwrap the outer `<label>` everywhere a React Aria control (`Checkbox`, `Radio`, desktop `Select`, `DatePicker`, `Combobox`, `Field`) is placed; pass label text as children (`Checkbox`/`Radio`) or `label={...}` (`Field`/control).

### Pitfall 2: `TransactionDetailPanel` Date Saving on Popover Selection (`onBlur` vs `onChange`)
- **What goes wrong:** `TransactionDetailPanel.tsx:375-376` saves date changes in `onBlur={saveDate}`. Selecting a date from React Aria `DatePicker`'s `Calendar` or `"Today"` button fires `onChange(iso)` and returns focus to the trigger button without blurring the `DatePicker`.
- **How to avoid:** Call `updateTx.mutate` directly inside `onChange` when `iso && iso !== tx.date` (mirroring `FileDetailModal.tsx:283-286`), keeping `isDisabled={isReconciled}`.

### Pitfall 3: `type="number"` Replacements Breaking Mid-Keystroke Typing
- **What goes wrong:** Today's `onChange` handlers in `TargetCard.tsx:119`, `CashRunway.tsx:187,228`, `RecurringFormModal.tsx:524`, `RuleEditorModal.tsx:569`, and `UpcomingLengthModal.tsx:85` run `Math.round(+e.target.value)` or `|| 0` directly on `e.target.value`. With a text `Input` (`inputMode="numeric"` / `"decimal"`), backspacing to `""` or typing `"-"` / `"1."` snaps to `0` or `1` mid-keystroke!
- **How to avoid:** Use a string draft buffer + `useReportAmountValidity` / field-level validation (exact `longterm/fields.tsx` `WholeNumberField` / `RateField` pattern `[VERIFIED: client/src/components/longterm/fields.tsx:79-209]`), committing numeric state only when valid and disabling Save while invalid.

### Pitfall 4: React Aria `Select` `toHaveValue()` & `<option:checked>` E2E Failures
- **What goes wrong:** Desktop React Aria `Select` renders `<button aria-haspopup="listbox">` (not `<select>`), so Playwright `.toHaveValue(...)` and `.locator('option:checked')` fail (`data.spec.ts`, `unsaved-drafts.spec.ts`, `envelope-funding.spec.ts`, `recurring.spec.ts`).
- **How to avoid:** Assert button text (`.toHaveText(...)` / `.toContainText(...)`) on `Select` triggers, and `.toHaveValue(label)` on `Combobox` `<input role="combobox">`. Keep `selectOption` in `e2e/tests/phone/` specs where `useIsPhone()` keeps native `<select>` (`D-04`).

### Pitfall 5: `MerchantSelect` Offline / Unconfirmed-Text Regression
- **What goes wrong:** `PayeeCombobox` allows unconfirmed free text `{ id: null, name }`, whereas `MerchantSelect` (`AddTransactionModal`, `RuleEditorModal`, `RecurringFormModal`) requires selecting or creating a payee (`useCreatePayee`), clears unconfirmed text on blur, sorts by `transactionCount`, and shows `"New payees can be added once Allotment reconnects."` when `!canSave` (`MerchantSelect.tsx:46-133`).
- **How to avoid:** Rebuild `MerchantSelect.tsx` on shared `Combobox` as a confirmed-payee wrapper distinct from `PayeeCombobox`, rendering `"Create new payee: ..."` as a `<Button>` in the `Popover` footer (keeping `recurring.spec.ts:83` `getByRole('button', { name: /Create new payee/ })` green).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 2 ships `Input` with `forwardRef<HTMLInputElement>` and a compact/dense `sm` size (`h-8`) plus `fillDate` in `e2e/tests/fixtures.ts`. | Standard Stack, Hard Cases §1 & §3 | G2 Task 1 (`D-16`) must extend `ui/Input.tsx` / `ui/Select.tsx` (+ gallery baseline) before migrating `Budget.tsx` `AmountInput`, `MoneyMoves`, `CategoryManager`, or dense table-row filters. |
| A2 | `ImportModal.tsx`, `YnabImportModal.tsx`, and `ImportCategories.tsx` move in G3 (`WAVG-06`) rather than G2 (`TransactionTable.tsx` caller under `D-13`). | Screen Inventory, Open Questions | If the owner/planner applies `D-13` strictly, `ImportModal` moves in G2 instead — trivial to swap between Plan 03-07 and Plan 03-13 before execution. |
| A3 | `MoneyMoves` (`To` includes `Ready to assign`), `GoalFormModal` (`Manual tracking`), `GoalStatusModal`, `CurrencyDifference` (`No category`), `DeleteCategoryModal`, and `PaydayPlan` category selects either use `CategoryPicker` (with `noneLabel`/filtering) or shared `Combobox` as decided by the WAVG-01 audit. | Provisional List Classification | Resolved at G2/G3 Task 1 when reading the shipped WAVG-01 audit (`D-16`). |

## Open Questions (RESOLVED)

1. **Boundary of "import and export dialogs" in G3 (`WAVG-06` vs `D-13`):**
   - What we know: `WAVG-06` and `03-CONTEXT.md:15-16` place "the import and export dialogs" in G3, and `03-CONTEXT.md:192` notes `ImportModal.tsx (1147 lines)` on the Phase 3 path. However, `ImportModal.tsx` is opened by `TransactionTable.tsx:713` (G2), `YnabImportModal.tsx` is opened by `ImportModal`, `Welcome` (Phase 4), and `DataExport` (Settings), and `DataExport.tsx` is a Settings tab (`Settings.tsx:118` in `wt-f`) rather than a `<Modal>`. There is no separate "export dialog" (`Export` buttons trigger direct CSV/JSON/ZIP downloads).
   - Recommendation: Keep `ImportModal.tsx`, `YnabImportModal.tsx`, and `ImportCategories.tsx` in **G3** (honouring `WAVG-06` and keeping PR G2 focused), and confirm at G3 Task 1 (`D-16`) whether `components/settings/DataExport.tsx`'s two date inputs (`@141, 156`) move in G3 (as the "export" half of WAVG-06) or stay with Settings in Phase 4 (`WAVG-07`).
   - **RESOLVED (planner position, owner confirmation pending as 03-01 Q3):** the import dialogs move in G3 (03-22 ImportModal, 03-25 YnabImportModal and ImportCategories). No export dialog exists, and the WAVG-01 audit files DataExport's dates under G4: Settings, so `DataExport.tsx` moves with Settings in Phase 4 (03-22 prohibition). The planner decided this; the owner did not. Because it re-scopes WAVG-06's "export dialogs" wording, 03-01 Task 2 asks the owner as Q3 (recommended `q3-phase-4`), 03-16 Task 2 records the answer as the `WAVG-06 export:` line or halts G3 on `move-in-g3`, and 03-23 quotes it in the G3 PR.

2. **`Rules.tsx:92` custom `<button role="switch">` (`Disable rule` / `Enable rule`):**
   - What we know: `Rules.tsx:92-118` renders a custom `<button type="button" role="switch">` (32×18 px on desktop, 44×44 px on phone). It is not `<input>`, `<select>`, or `<textarea>`, so Phase 4's lint rule will not flag it, whereas `ui/Switch` has `min-h-11 min-w-11` (`44×44 px`) at all widths.
   - Recommendation: Check WAVG-01 audit in G2 Task 1 (`D-16`); swap to `ui/Switch` only if the audit classifies it for replacement and desktop row spacing tolerates `min-h-11`.
   - **RESOLVED (03-06, re-checked by 03-01 Task 1 under D-16):** keep the button as it is. The audit has no row for it and it is not an `<input>`, `<select>` or `<textarea>`, so D-15 (no behaviour or look change beyond the field swap) leaves it alone; 03-06 Task 2 notes it in its summary. If 03-01's reconciliation finds an audit row for it, the audit wins and 03-01 writes `Reconcile: revise`.

3. **Dense/inline variant for `Budget.tsx` `AmountInput` and `Payees.tsx` / `CategoryManager.tsx` inline rename:**
   - What we know: `02-UI-SPEC.md` defines `md` (`h-10`) and `sm` (`h-8`), while inline table editors use `py-0.5` or borderless cell fills.
   - Recommendation: Per `03-CONTEXT.md` Claude's Discretion, inspect shipped `ui/Input.tsx` in G2 Task 1 and add an `inline` / `dense` variant (with gallery entry + Linux screenshot) if `h-8` (`32px`) distorts register/budget table rows.
   - **RESOLVED (03-06, 03-09, 03-11):** no new variant is planned. The Budget cell uses `CurrencyInput` at `fieldSize` `sm` (03-09 Task 1, keeping `text-right tabular-nums` and the cell width), and the Payees and Category manager inline renames use the shared `Input` at `sm` (03-06 Task 1, 03-11 Task 1). If `sm` distorts a row, the executor extends the shared control with its gallery state and screenshot rather than styling around it (CONTEXT, Claude's Discretion, "Missing variant or state") and records it; the Budget cell's fallback is the shared `Input` with its parser, recorded under "Findings for the owner" (03-09 Task 1, D-15).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js 24 | CI parity, Safe mode tests (`WAVES.md`, `.github/workflows/ci.yml:32`) | ✓ (per `02-RESEARCH.md:483`) | `v24.10.0` at `/opt/homebrew/opt/node@24/bin/node` | Prepend `/opt/homebrew/opt/node@24/bin` to `PATH` |
| Python 3 | `scripts/prepare-release.py` | ✓ | Checked via `python3` in session | — |
| `node_modules` in fresh worktree | `vitest`, `tsc`, `eslint`, `playwright` | ✗ (absent in fresh worktree) | — | Run `npm ci` in root, `client/`, `server/`, `e2e/`, `lint/` before verification |

## Validation Architecture

`workflow.nyquist_validation` is `true` in `docs/superpowers/gsd-records/config.json:25` `[VERIFIED: docs/superpowers/gsd-records/config.json:25]`.

### Test Framework
| Property | Value |
|----------|-------|
| Client unit framework | `vitest` `^5.0.4` (`client/package.json:41`, Node environment, `renderToStaticMarkup` — no `jsdom` or `@testing-library/react` `[VERIFIED: client/package.json:10,41]`) |
| Server typecheck / tests (regression check only) | `vitest` + `tsc --noEmit` (`server/package.json`) — Phase 3 makes no server edits |
| Lint & token framework | `eslint` `^9.39.5` + `node --test` (`lint/package.json:8-10`; `--max-warnings=128`) `[VERIFIED: lint/package.json:8-10]` |
| E2E / Visual framework | `@playwright/test` `1.64.0` (`e2e/package.json:12`, `e2e/playwright.config.ts`) `[VERIFIED: e2e/package.json:12]` |
| Quick run command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint)` |
| Full suite command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint) && npm run format:check && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode && npm test -- --project=gallery)` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVG-05 | G2 screens use only shared controls, zero raw fields outside allowlist, `MerchantSelect` offline/create preserved, G2 e2e green | Unit + Lint + E2E (`desktop`, `phone`, `demo`, `server-mode`) | `cd e2e && npm test -- --project=desktop tests/transactions.spec.ts tests/transaction-filters.spec.ts tests/accounts.spec.ts tests/budget.spec.ts tests/budget-inspector.spec.ts tests/envelope-funding.spec.ts tests/payday.spec.ts tests/targets.spec.ts tests/payees.spec.ts tests/rules.spec.ts tests/recurring.spec.ts tests/receipts-tab.spec.ts tests/receipts-reader.spec.ts tests/accessibility.spec.ts` | ✅ Existing specs (selectors updated per E2E Impact); ❌ W0 G2 D-14 tests |
| WAVG-06 | G3 screens + import dialogs use only shared controls, zero raw fields outside allowlist, G3 e2e green | Unit + Lint + E2E (`desktop`, `phone`, `demo`) | `cd e2e && npm test -- --project=desktop tests/category-goals.spec.ts tests/forecast.spec.ts tests/long-term-forecast.spec.ts tests/investments.spec.ts tests/reports.spec.ts tests/unsaved-drafts.spec.ts tests/files.spec.ts tests/data.spec.ts tests/switchers.spec.ts tests/settings.spec.ts` | ✅ Existing specs (selectors updated per E2E Impact); ❌ W0 G3 D-14 tests |
| WAVG-08 (D-14) | All 9 Phase 3 `type="number"` fields use shared `Input` (`inputMode="numeric"\|"decimal"`) bounded to matching Zod caps | Unit (`vitest`) + E2E (`data.spec.ts`, etc.) | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client` (plus `e2e` targeted specs) | ❌ Wave 0 (failing-first unit/e2e test per D-14 field; e.g. validation helper tests) |
| WAVG-05 / WAVG-06 (390 px, Safe mode, Gallery) | No sideways scroll at `390 px`, phone native pickers open, Safe mode hides amounts, gallery baselines remain green | E2E (`phone`, `demo`, `gallery`) | `cd e2e && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=gallery` | ✅ Existing phone/demo suites (`gallery` arrives in Phase 2) |

### Sampling Rate
- **Per task commit:** `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint)`
- **Per wave merge (after each G2 / G3 screen wave):** Relevant screen specs in `e2e/` (`--project=desktop` and matching `--project=phone` / `--project=demo`)
- **Phase PR gate (G2 PR and G3 PR):** Full suite command above (`client`, `lint`, `format:check`, `e2e` `tsc --noEmit`, plus sequential `desktop`, `phone`, `demo`, `server-mode`, `gallery` — never `E2E_SKIP_BUILD=1`), plus `.ui-evidence/<date>-<wave>/` light/dark 1280/390 screenshots and green CI.

### Wave 0 Gaps
- [ ] **Phase 2 prerequisite artifacts** (must exist before G2 starts per `D-10`, `D-16`): WAVG-01 audit document, shipped `ui/` controls (`Input` `forwardRef` + dense/inline support if needed), `fillDate` in `e2e/tests/fixtures.ts`, and `gallery` Playwright project.
- [ ] **D-14 pure validation/parsing helpers + failing-first Vitest tests** for the 9 Phase 3 `type="number"` fields (`TargetCard` cycle `1..60`, `PaydayPlan` percent `0..100`, `RuleEditorModal` split percent `0..100`, `UpcomingLengthModal` custom count `>=1`, `RecurringFormModal` `dateFlexibility` `0..14` in G2; `ImportModal` `skipRows` `0..1000`, `CashRunway` `spendingPercent` `0..500`, `incomePercent` `0..200`, `annualReturnBasisPoints` `-10000..5000`, `EventEditor` `endYear` `1900..2300` or `null` in G3). *Note:* Since client Vitest runs in Node without DOM (`renderToStaticMarkup`), extract small pure parser/range helpers or test validation state cleanly alongside an e2e invalid-input assertion per `D-14`.
- [ ] **G2 & G3 native-input inventory (`D-17`)**: Exact allowlist of the 7 `<input type="file">` lines recorded in the G2 and G3 PR descriptions for Phase 4's lint rule (`WAVG-09`).

## Security Domain

`security_enforcement` is `true` in `docs/superpowers/gsd-records/config.json:49` `[VERIFIED: docs/superpowers/gsd-records/config.json:49]`.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Client-only form swap; sign-in & auth screens stay untouched until Phase 4 (`D-13`). |
| V3 Session Management | no | No session, cookie, or token changes. |
| V4 Access Control | no | No server routes, read-only token allowlist, or `/api/assistant/do` changes (`REQUIREMENTS.md:9-10`). |
| V5 Input Validation | yes | `D-14` bounds all 9 replaced `type="number"` inputs to their server Zod caps (`targetConfig.ts`, `paydayConfig.ts`, `rules.ts`, `schedules.ts`, `importSettings.ts`, `forecastConfig.ts`, `longTermConfig.ts`); `DatePicker` emits `YYYY-MM-DD` (`isoDate`, `D-08`); `CurrencyInput` stays `type="text" inputMode="decimal"`; Safe mode `<Private>`/`<PrivateSection>` wrappers remain intact in all rebuilt pickers (`AddTransactionModal`). |
| V6 Cryptography | no | No crypto or credential changes. |

## Sources

### Primary (HIGH confidence — verified in `worktree` and read-only `/Users/tristanvanrooyen/wt-f`)
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md` (D-01 through D-17, Claude's Discretion)
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md`, `02-UI-SPEC.md`, `02-RESEARCH.md`, `02-PATTERNS.md`, `02-VALIDATION.md` (planned Phase 2 contract)
- `docs/superpowers/gsd-records/ROADMAP.md`, `docs/superpowers/gsd-records/REQUIREMENTS.md`, `docs/superpowers/gsd-records/STATE.md`, `docs/superpowers/gsd-records/config.json`
- `CLAUDE.md` / `AGENTS.md`, `docs/ui/MAP.md`, `docs/ui/HANDOVER-UI.md`, `docs/ui/WAVES.md`, `docs/ui/README.md`, `gh issue view 267`
- `lint/package.json`, `lint/eslint.config.js`, `lint/README.md`, `.github/workflows/ci.yml`, `scripts/prepare-release.py`, `client/package.json`
- Client source files in `worktree` and `/Users/tristanvanrooyen/wt-f/client/src` (Accounts, Budget, CategoryManager, EditCategoryModal, DeleteCategoryModal, DataExport)
- Server Zod schemas: `server/src/services/targetConfig.ts`, `paydayConfig.ts`, `forecastConfig.ts`, `longTermConfig.ts`, `server/src/routes/rules.ts`, `schedules.ts`, `server/src/utils/importSettings.ts`, `client/src/store/preferencesStore.ts`, `client/src/components/recurring/scheduleFormat.ts`
- E2E suites: `e2e/tests/` (and `/Users/tristanvanrooyen/wt-f/e2e/tests/settings.spec.ts`)

## Metadata

**Confidence breakdown:**
- Screen/file inventory & counts: HIGH — scanned and read directly across `worktree` and `/Users/tristanvanrooyen/wt-f/client/src`.
- `type="number"` & Zod schema mapping: HIGH — all 10 client occurrences and matching server Zod schemas read verbatim.
- List classification (`Select` vs `Combobox` vs `CategoryPicker`): MEDIUM-HIGH — provisional per `D-06` until Phase 2's WAVG-01 audit ships (`D-16`).
- Phase 2 shared control APIs (`Input`, `Select`, `Combobox`, `DatePicker`, `fillDate`): MEDIUM — planned in `02-UI-SPEC.md` / `02-RESEARCH.md`, not yet shipped on disk (`D-16` gate verifies at execution).
- E2E selector impact: HIGH — verified against current desktop, phone, demo, and server-mode specs.

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 (re-check against shipped WAVG-01 audit and Phase 2 `ui/` controls at G2/G3 Task 1 per `D-16`)
