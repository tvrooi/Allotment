# Phase 4: Remaining screens and the guard - Research

**Researched:** 2026-11-16
**Domain:** Client form control migration (Settings, Bank connections, Shelved/split-candidate pages, D-13 screens), `type="number"` elimination (`WAVG-08`), ESLint JSX guard (`WAVG-09`), and legacy removal + UI docs (`WAVG-10`)
**Confidence:** HIGH (all in-repo counts, file:line locations, e2e selectors, server Zod caps, and `lint/` setup verified directly in `worktree-agent-p04-researcher` and cross-checked against `/Users/tristanvanrooyen/wt-f`; Phase 2 shared control APIs and Phase 3 migration boundaries are **planned, not shipped**, sourced from `02-CONTEXT.md`, `02-UI-SPEC.md`, `02-RESEARCH.md`, `02-PATTERNS.md`, and `03-CONTEXT.md`)

> **Source-tree provenance:** Both `worktree-agent-p04-researcher` (`redesign` at `dcfbaf7`) and `/Users/tristanvanrooyen/wt-f` (`wave-f` at `ad26903`) were checked via `diff -rq --exclude=node_modules --exclude=.git client/src /Users/tristanvanrooyen/wt-f/client/src`, which returned zero differences: Wave F's split (`Settings.tsx` 8 tabs, `AccountConnections.tsx`, `BudgetCategories.tsx`, `ConnectedBanks.tsx`) is already present in both trees. Claims about Phase 2's shared controls (`client/src/components/ui/`) and Phase 3's screen migrations are **planned, not shipped** until Phases 2 and 3 execute (`D-12`, `D-16`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Carried forward from Phases 2 and 3 (locked for all of Wave G)

D-01 to D-11 are the owner's decisions in `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md`; D-12 to D-17 are in `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md`. They keep their numbers here. Read those files for the full wording and reversibility ratings; the lines below say how each binds Phase 4.

- **D-01:** Screens use the shared controls built on `react-aria-components`; no screen builds its own field from React Aria.
- **D-02:** No new package, in the client or for the lint rule. The rule is written with what `lint/` already has.
- **D-03:** Today's field look, made consistent. One-off field classes are deleted, screens are not restyled.
- **D-04:** One component API on every device. Native pickers under 768 px through the shared component.
- **D-05:** Custom Select on desktop. Picker rule: categories use `CategoryPicker`, payees use `PayeeCombobox`, every other list uses the shared Select or Combobox. This is the picker rule G5 writes into the docs.
- **D-06:** Lists the user grows are a searchable Combobox, fixed lists a plain Select, as the audit classifies them.
- **D-07:** Every remaining `type="date"` field moves to the shared DatePicker with its screen. After G4 none is left, and the G5 lint rule covers dates because it covers every raw `<input>`.
- **D-08:** Dates can be typed or picked; values stay `YYYY-MM-DD`.
- **D-09:** Review, Cash flow and Household (shelved) and `Household.tsx`, `Tax.tsx` and `CashFlow.tsx` (split candidates) get a like-for-like swap only: each field is replaced by the shared control of the same kind, in the same place, with the same label and wording. No layout, wording or structure change, and no file is split.
- **D-10:** [informational] Phase 2's delivery and its owner checkpoint after the audit.
- **D-11:** A remaining `type="month"` field moves to the shared MonthPicker.
- **D-12:** [informational] Phase 3's two PRs. Phase 4 does not start until both are merged to `redesign`.
- **D-13:** Screens with no parent in the Phase 3 lists move here, in G4: Dashboard, Payment plans, Welcome, the sign-in screens, the app shell, and any shared piece with a raw field that Phase 3 left (owner, 16 Nov 2026).
- **D-14:** A `type="number"` field is fixed with its screen. Phase 3 fixes the ones on its screens; G4 fixes every one that is left (on 16 Nov 2026 that is `components/plans/NewPlanModal.tsx`, plus any Phase 3 missed) and proves with a search-based test that no money amount goes through `type="number"` anywhere. `CurrencyInput` for money, otherwise a shared field within the matching Zod cap, each with a test that fails first.
- **D-15:** Apart from D-14, a screen move changes only which component draws the field: same values saved, same validation and error text, same accessible names, `useCanSave` and `<SavingPausedHint />` kept, Safe mode still hides amounts. Anything else that would change is a finding to raise, not a change to make.
- **D-16:** These plans were written before the audit, the shared controls and the Phase 3 PRs existed. Each PR starts with a task that reads the audit, the shipped controls and what Phase 3 actually moved, and checks the plan's file list, list classifications and "must stay native" entries against them. If the owner changed a Wave G decision after reading the audit, execution stops and the plan is revised first.
- **D-17:** A field the audit says must stay native stays native. The lists of those fields from the audit and from the G2, G3 and G4 PRs are the source for the lint allowlist.

### Delivery
- **D-18:** Phase 4 ships as two PRs to `redesign`, G4 then G5, as #267 and the roadmap say. Each is an app change with its own next `0.2.0-up.N` and CHANGELOG entry. G5 does not start until G4 is merged, because the lint rule fails while any raw field is left outside `components/ui/`.
- **D-19:** Settings and the bank sections are moved from the Phase 1 (Wave F) layout: Settings split into its sections, and banks under Accounts → Connected banks. G4 does not start until PR #273 is merged to `redesign`.

### Sign-in and bank fields
- **D-20:** Fields that take a password, token, API key or bank credential keep their `type`, `name`, `autoComplete`, `inputMode`, `spellCheck` and paste behaviour exactly, so password managers and the bank flows behave as before. A secret is never shown where it was hidden, never logged, and never put in a test fixture. This follows the project's safety rules and is not open to trade-off.

### The guard
- **D-21:** The lint rule is an error, not a warning: it fails lint (WAVG-09). It covers raw `<select>`, `<textarea>` and `<input>` in `client/src` outside `client/src/components/ui/`. The allowlist is explicit and short: file inputs, and the fields D-17 lists, each with its reason on the line. The rule has its own tests in `lint/` with at least one allowed case and one refusal. The warning cap in `lint/package.json` goes down to the new count or stays; it never goes up.
- **D-22:** WAVG-10 removal is complete: the native `Select` export in `ui/Input.tsx`, any old implementation the shared set replaced, their unused exports, one-off classes, test fixtures and doc mentions all go in G5. A removed name is searched for across `client/src`, `e2e/`, the demo budget and `docs/` before the PR is opened.

### Claude's Discretion
- **How the rule is written** (a custom ESLint rule or `no-restricted-syntax` selectors), where its tests live in `lint/`, and whether the allowlist is by file, by attribute (`type="file"`) or both.
- **Whether the guard also refuses `type="number"`** on the shared Input or anywhere in `client/src`. Add it only if it is a few lines in the same rule and has its own allowed and refused test cases; otherwise the search-based test from D-14 is the guard.
- **The docs.** `DESIGN.md`, `docs/ui/MAP.md` and `docs/ui/HANDOVER-UI.md` are named by WAVG-10. If the picker rule or the lint rule changes a line in `CLAUDE.md`, the same edit goes into `AGENTS.md` so the two stay byte-identical. `docs/ui/WAVES.md` gets Wave G's record if that is how earlier waves were closed.
- **How each PR is cut into plans** and the order of screens inside G4.
- **Missing variant or state:** extend the shared control with its gallery state and screenshot, as in Phase 3.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Splitting `Household.tsx`, `Tax.tsx` and `CashFlow.tsx` stays out of this milestone's Wave G (D-09).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVG-07 | Settings (after the WAVF split), bank connection sections, shelved/split-candidate pages (`Review`, `CashFlow`, `Household`, `Tax`), and D-13 screens (`Dashboard`, `PaymentPlans`, `Welcome`, `AuthGate`, `CommandPalette`, `components/currency/`) use shared controls; shelved/split pages get a mechanical like-for-like swap only (`D-09`, `D-13`, `D-19`, `D-20`). | Complete file-and-line inventory below across 38 Phase 4 TSX files (34 in G4 scope + 4 cross-phase shared/boundary files to confirm in `D-16` Task 1); identifies `Household.tsx` uncontrolled `FormData` (`name`/`defaultValue`) constraint and `D-20` credential passthrough contract. |
| WAVG-08 | No screen takes a money amount through `type="number"`. Each of the 10 current uses becomes `CurrencyInput` (`type="text" inputMode="decimal"`) for money, or a shared field within the matching Zod cap otherwise (`D-14`). | All 10 `type="number"` occurrences verified across `client/src/`: **zero** are money amounts (all 10 are counts, percentages, days, months, or years); 9 sit in Phase 3 screens and 1 (`NewPlanModal.tsx:193`, `instalmentCount`, Zod cap `min(1).max(60)` in `server/src/routes/paymentPlans.ts:94`) sits in Phase 4. Search-based Vitest test modeled on `movedSections.test.ts` proves zero unallowlisted/money `type="number"`. |
| WAVG-09 | ESLint guard in `lint/` errors on raw `<select>`, `<textarea>`, `<input>` outside `components/ui/` (with short allowlist for file inputs and `D-17` native exceptions), has own allowed + refused tests in `cd lint && npm test`, and `--max-warnings` in `lint/package.json` goes down or stays (`D-02`, `D-21`). | Custom rule `lint/rules/no-raw-form-control.js` + `no-raw-form-control.test.js` (mirroring `icon-only-control.js`) avoids colliding with `no-restricted-syntax` in `lint/eslint.config.js:55`, handles `<input type="file">` + `D-17` allowlist, updates `jsx-a11y/label-has-associated-control` `controlComponents`, and recounts `--max-warnings=128` via `npm run lint:report`. |
| WAVG-10 | Remove native `Select` in `ui/Input.tsx` and every component replaced by the shared set; update `DESIGN.md`, `docs/ui/MAP.md`, and `docs/ui/HANDOVER-UI.md` with the control set, lint rule, and picker rule (`D-05`, `D-22`). | Full removal inventory (`ui/Input.tsx` `Select`, `CategorySelect.tsx`, `MerchantSelect.tsx` + `selectorInputClass`, `CategorySelectButton.tsx` if replaced in Phase 3), cross-repo search targets (`client/src`, `e2e/`, `client/src/demo/`, `docs/`), and exact section edits for `DESIGN.md`, `docs/ui/MAP.md`, `docs/ui/HANDOVER-UI.md`, `docs/DEVELOPMENT.md`, `docs/ui/WAVES.md`, and `CLAUDE.md`/`AGENTS.md`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives verified in `CLAUDE.md` (and confirmed byte-identical to `AGENTS.md` via `cmp -s CLAUDE.md AGENTS.md`):
- **Client and `lint/` only; no server changes:** Wave G (`REQUIREMENTS.md:9-10`, `[VERIFIED: docs/superpowers/gsd-records/REQUIREMENTS.md:9-10]`: `"Every requirement here is client-only: no server route, allowlist, /api/assistant/do or MCP change."`) forbids any edits under `server/`.
- **Byte-identical `CLAUDE.md` / `AGENTS.md`:** `[VERIFIED: CLAUDE.md:9]` — `"Keep AGENTS.md and CLAUDE.md byte-identical (Codex reads one, Claude Code the other)."` Any G5 doc edit touching one must mirror into the other.
- **No new packages and `.npmrc` guard intact:** `[VERIFIED: CLAUDE.md:35]` — `"Dependencies use lockfiles and .npmrc with install scripts disabled. Do not disable that guard."` `D-02` adds zero npm packages in `client/` or `lint/`.
- **Money & date invariants:** Money uses integer minor units via `CurrencyInput` (`type="text" inputMode="decimal"`), never `type="number"`; dates stay real `YYYY-MM-DD` (`isoDate`, `isoMonth`) and display via `client/src/utils/dates.ts` (`[VERIFIED: CLAUDE.md:196-210]`).
- **Client UI invariants:** Mutations invalidate affected queries; save buttons respect `useCanSave` and `<SavingPausedHint />`; interactive controls keep accessible names (`allotment/icon-only-control` is an error in `lint/eslint.config.js:83`); layouts hold at `390 px` with no sideways scroll; Safe mode, demo, and offline modes keep working (`[VERIFIED: CLAUDE.md:208-213]`).
- **Lint warning cap:** `[VERIFIED: lint/package.json:8]` — `"lint": "cd .. && eslint -c lint/eslint.config.js --max-warnings=128 client/src server/src"`. Cap may go down or stay, never up (`D-21`).
- **Verification & release discipline:** Node 24 (`[VERIFIED: .github/workflows/ci.yml:32]`), never `E2E_SKIP_BUILD=1` (`[VERIFIED: docs/ui/HANDOVER-UI.md:160]`), sequential e2e runs (fixed ports in `e2e/ports.ts`), Prettier `npm run format:check`, and each PR (`G4` then `G5` to `redesign` via `--repo tvrooi/Allotment`) runs `npm run release:prepare -- <next-version>` + updates `CHANGELOG.md`, `docs/ui/HANDOVER-UI.md`, and `docs/ui/MAP.md` (`[VERIFIED: CLAUDE.md:54-75; docs/superpowers/gsd-records/REQUIREMENTS.md:48-56]`).
- **Security review rules (`SECURITY.md`):** Never expose, log, or put into test fixtures any token, password, bank credential, or encryption key; keep `type="password"`, `autoComplete`, `spellCheck`, and paste behaviour intact on auth and bank setup fields (`D-20`, `[VERIFIED: SECURITY.md:261-275]`).

## Summary

Phase 4 closes Wave G in two sequential PRs to `redesign` (`D-18`): **G4** (`WAVG-07`, `WAVG-08`) migrates the remaining screens onto the Phase 2 shared control set and verifies that no money input uses `type="number"`, and **G5** (`WAVG-09`, `WAVG-10`) turns on the ESLint guard banning raw `<select>`, `<textarea>`, and `<input>` outside `client/src/components/ui/`, removes legacy controls, and updates the UI documentation. Because Phase 2's shared components and Phase 3's migrations have not executed yet, every file boundary, list classification (`Select` vs `Combobox`), and shipped prop API must be verified in Task 1 of each PR against `docs/ui/FORM-CONTROLS-AUDIT.md` and the shipped `components/ui/` code (`D-16`).

Full codebase inspection across every non-test `.tsx` file in `client/src` surfaced four critical planning constraints that `04-CONTEXT.md` alone does not detail:
1. **`Household.tsx` relies heavily on uncontrolled `FormData` submission (`f.get(...)`):** Its create-household, edit-person, add-person, record-event, edit-bill, add-bill, and edit-household forms submit native `FormData` fields (`name="accountId"`, `name="dueDate"`, `name="payerId"`, `name="isDefault"`, `name="include-${p.id}"`, etc.) using `defaultValue`/`defaultChecked`. Phase 4 plans MUST verify in Task 1 that the shipped `Select`, `DatePicker`, `Checkbox`, `Input`, and `Textarea` in `components/ui/` accept `name` + `defaultValue`/`defaultSelected` and emit hidden form values for `FormData`, or else those `Household.tsx` forms will submit `null`.
2. **Cross-folder boundaries between Phase 3 and Phase 4:** Several files sit in one folder while serving another screen: `components/settings/CategoryManager.tsx` (+ `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx`) is mounted solely by `pages/BudgetCategories.tsx` (`/budget/categories`, Phase 3 Budget per `03-CONTEXT.md` D-13); `components/currency/CurrencySelect.tsx` is imported by both `Settings` (Phase 4) and `AddAccountModal` (Phase 3); `components/tax/TaxClaimSection.tsx`, `components/tax/ReceiptsSection.tsx`, and `components/household/ShareWithHousehold.tsx` are imported by `TransactionDetailPanel.tsx` (Phase 3) as well as Phase 4 pages. Task 1 (`D-16`) must reconcile which files Phase 3 already migrated.
3. **All 10 `type="number"` fields are non-money; `NewPlanModal.tsx:193` is the sole Phase 4 site:** Server Zod schemas confirm every `type="number"` field is an integer/decimal count, percentage, days, or year — never money. `NewPlanModal.tsx:193` (`instalmentCount`) matches `server/src/routes/paymentPlans.ts:94` (`z.number().int().min(1).max(60)`). Switching it to shared `<Input type="text" inputMode="numeric" ... />` and adding a Vitest source-scan test (`import.meta.glob`, matching `movedSections.test.ts`) seals `WAVG-08`.
4. **`lint/` flat-config & e2e role shifts:** Adding a second `no-restricted-syntax` block in `lint/eslint.config.js` would silently overwrite the `toISOString()` rule at lines 55–63. A dedicated custom rule (`lint/rules/no-raw-form-control.js`) registered on the single `allotment` plugin object beside `icon-only-control` avoids that collision, enables native `RuleTester` tests in `cd lint && npm test`, cleanly handles `<input type="file">` + `D-17` allowlists, and lets `lint/package.json` lower `--max-warnings` below `128`. On e2e, React Aria `<Select>` triggers expose `role="button"` instead of `role="combobox"` (breaking `dashboard.spec.ts:103` `Savings rate goal`, `currencies.spec.ts`, `household.spec.ts`, `review.spec.ts`, etc.), `BudgetStartSettings.tsx` (`Settings → Budget`) needs a `MonthPicker` helper (`settings.spec.ts:431`), and `UpConnectModal`, `Household`, and `Tax` date fields move onto the Phase 2 `fillDate` helper.

**Primary recommendation:** Cut G4 into a `D-16` gate plan (`04-01`), four disjoint area-migration plans (`04-02` Settings + currency, `04-03` Bank connections, `04-04` D-13 screens, `04-05` Shelved/split-candidate swap), and a `WAVG-08` + release-gate plan (`04-06`); after G4 merges (`D-18`), run G5 (`04-07`) with `lint/rules/no-raw-form-control.js`, full legacy removal, warning cap recount, and doc updates.

## Architectural Responsibility Map

Phase 4 is strictly client and `lint/` only (`REQUIREMENTS.md:9-10`, `04-CONTEXT.md` Phase Boundary). No server routes, database migrations, or `/api/assistant/do` policies change.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Migrating remaining screens & shelved pages (`WAVG-07`) | Browser / Client (`client/src/pages/`, `client/src/components/{settings,up,plaid,simplefin,enablebanking,review,household,tax,dashboard,plans,auth,layout,currency}/`) | Shared UI (`client/src/components/ui/`) | Replaces raw HTML elements and legacy `ui/Input` `Select` with Phase 2 shared controls while keeping behaviour, `FormData` keys, `D-20` credential attributes, and `useCanSave` unchanged. |
| `type="number"` replacement & money-field proof (`WAVG-08`) | Browser / Client (`client/src/components/plans/NewPlanModal.tsx` + Vitest source guard) | API / Backend (`server/src/routes/paymentPlans.ts` — read-only Zod contract) | Client enforces matching Zod bounds (`min(1).max(60)` for `instalmentCount`) via shared `Input`; source-scan unit test guarantees zero money fields use `type="number"`. |
| ESLint raw-control guard & warning cap burn-down (`WAVG-09`) | Tooling / Lint (`lint/rules/`, `lint/eslint.config.js`, `lint/package.json`) | Browser / Client (allowlisted native `<input type="file">` / `D-17` sites) | Enforces shared-control adoption at CI error severity outside `client/src/components/ui/` without adding npm dependencies (`D-02`). |
| Legacy control removal & documentation (`WAVG-10`) | Browser / Client (`client/src/components/{ui,transactions}/`) + Docs (`DESIGN.md`, `docs/ui/`, `CLAUDE.md`/`AGENTS.md`) | E2E Harness (`e2e/tests/`) | Removes dead `Select` export and superseded hand-rolled pickers, and updates design/UI docs + e2e selectors to reflect the unified control set. |

## Standard Stack

No external packages are installed in Phase 4 (`D-02`: `"No new package, in the client or for the lint rule. The rule is written with what lint/ already has."`).

### Core (Already Installed)
| Library | Version | Purpose | Where Verified |
|---------|---------|---------|----------------|
| `react-aria-components` | `^1.22.1` | Underlying primitives for Phase 2 shared controls consumed by G4 screens (**planned, not shipped**) | `[VERIFIED: client/package.json:25]` (`"react-aria-components": "^1.22.1"`) |
| `eslint` | `^9.39.5` | Flat-config linter & `RuleTester` for `WAVG-09` rule and tests | `[VERIFIED: lint/package.json:14]` (`"eslint": "^9.39.5"`) |
| `typescript-eslint` | `^8.72.1` | `tseslint.config` & `tseslint.parser` for TS/TSX AST parsing in `lint/` | `[VERIFIED: lint/package.json:19]` (`"typescript-eslint": "^8.72.1"`) |
| `eslint-plugin-jsx-a11y` | `^6.10.2` | Accessibility warnings (`controlComponents` in `lint/eslint.config.js:126`) | `[VERIFIED: lint/package.json:15]` (`"eslint-plugin-jsx-a11y": "^6.10.2"`) |
| `vitest` | `^5.0.4` | Client unit tests including `import.meta.glob` source-scan tests (`WAVG-08`) | `[VERIFIED: client/package.json:41]` (`"vitest": "^5.0.4"`) |
| `@playwright/test` | `1.64.0` | Desktop, phone, demo, server-mode, and gallery e2e verification | `[VERIFIED: e2e/package.json:12]` (`"@playwright/test": "1.64.0"`) |

### Alternatives Considered (for WAVG-09 Lint Rule)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom rule `lint/rules/no-raw-form-control.js` | `no-restricted-syntax` selectors in `lint/eslint.config.js` | `eslint.config.js:55` already uses `no-restricted-syntax` for `toISOString()` (`audit F-22`); a second `no-restricted-syntax` rule block in ESLint flat config **overwrites** the first array for matching files unless manually concatenated. Moreover, `no-restricted-syntax` cannot be tested cleanly via ESLint's `RuleTester` in `cd lint && npm test` (`icon-only-control.test.js` pattern). Custom rule is cleaner, collision-free, and directly testable. |

**Installation:** None (`D-02`). Use existing `npm ci` in `client/`, `server/`, `e2e/`, and `lint/` under Node 24.

## Architecture Patterns

### 1. Complete Per-Area Inventory for G4 (`WAVG-07`)

All counts below were verified by AST/regex scan and direct file inspection across all non-test `.tsx` files in `client/src` on `worktree-agent-p04-researcher` (`dcfbaf7`) and confirmed identical to `/Users/tristanvanrooyen/wt-f/client/src` (`ad26903`). Note that `Input` and `Select` in the "Old `ui/Input`" column refer to the legacy exports in `client/src/components/ui/Input.tsx` (in Phase 2, `Input.tsx` transitions `Input` to React Aria while keeping `Select` until G5 `WAVG-10`).

#### A. Settings (`pages/Settings.tsx` + `components/settings/`)
`pages/Settings.tsx` (`146` lines `[VERIFIED: client/src/pages/Settings.tsx:1-146]`) renders 8 tabs (`accounts`, `budget`, `tags`, `currencies`, `priorities`, `data`, `preferences`, `server`) and holds **0** form fields directly (`AccountReorder.tsx` also holds **0** form fields `[VERIFIED: client/src/components/settings/AccountReorder.tsx:1-185]`).

| File | Line(s) | Current Element / Component | Type / Purpose | Target Shared Control (D-05, D-06, D-17) | Notes / Special Attributes |
|------|---------|-----------------------------|----------------|------------------------------------------|----------------------------|
| `settings/BudgetStartSettings.tsx` | 66 | `<input type="month">` | Start month (`max={thisMonth}`) `[VERIFIED: client/src/components/settings/BudgetStartSettings.tsx:66-72]` | `MonthPicker` (`D-11`) | Sole `type="month"` in codebase; breaks `settings.spec.ts:431` `.fill(thisMonth)` on desktop |
| `settings/CurrencySettings.tsx` | 243 | `<input type="date">` | Exchange rate day `[VERIFIED: client/src/components/settings/CurrencySettings.tsx:243-249]` | `DatePicker` (`D-07`) | Needs `id="rate-date"` |
| `settings/CurrencySettings.tsx` | 255 | `<input type="text">` | Rate decimal (`inputMode="decimal"`, `aria-invalid`, `placeholder="1.0812"`) `[VERIFIED: client/src/components/settings/CurrencySettings.tsx:255-264]` | `Input` | Exchange rate ratio (not money in minor units) |
| `settings/CurrencySettings.tsx` | 348 | `<input type="checkbox">` | "Download ECB reference rates" `[VERIFIED: client/src/components/settings/CurrencySettings.tsx:348-354]` | `Checkbox` | Remove outer `<label>` wrapper when moving to RAC `Checkbox` |
| `settings/CurrencySettings.tsx` | 396 | `<input type="url">` | Optional Frankfurter server URL `[VERIFIED: client/src/components/settings/CurrencySettings.tsx:396-403]` | `Input` (`type="url"`) | Verify `Input` passes `type="url"` |
| `settings/CurrencySettings.tsx` | 464 | `<input type="text">` | Per-currency display symbol (`maxLength={5}`) `[VERIFIED: client/src/components/settings/CurrencySettings.tsx:464-472]` | `Input` | `aria-label={`${code} symbol`}` |
| `settings/DataExport.tsx` | 141, 156 | `<input type="date">` (x2) | CSV export From / To dates `[VERIFIED: client/src/components/settings/DataExport.tsx:141-162]` | `DatePicker` (`D-07`) | Optional dates (`from`, `to`) |
| `settings/DataExport.tsx` | 235 | `<input type="file">` | Backup `.json` / `.zip` restore `[VERIFIED: client/src/components/settings/DataExport.tsx:235-244]` | **Keep native** (`D-17`) | Allowlisted file input |
| `settings/PeopleSettings.tsx` | 117 | `<input type="radio">` (mapped 3x) | Code delivery channel (`phone` / `email` / `both`) `[VERIFIED: client/src/components/settings/PeopleSettings.tsx:112-128]` | `RadioGroup` + `Radio` | Preserves `fieldset` / `legend` accessible group name |
| `settings/PeopleSettings.tsx` | 250 | `<input>` | 6-digit OTP (`inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`) `[VERIFIED: client/src/components/settings/PeopleSettings.tsx:250-259]` | `Input` | Must pass `inputMode`, `autoComplete`, `maxLength` (`D-20`) |
| `settings/PeopleSettings.tsx` | 285 | `<input>` | Notify destination (`type={destination === 'email' ? 'email' : 'text'}`, `autoComplete={...}`, `spellCheck={false}`) `[VERIFIED: client/src/components/settings/PeopleSettings.tsx:285-294]` | `Input` | Dynamic `type`/`autoComplete` + `spellCheck={false}` (`D-20`) |
| `settings/PeopleSettings.tsx` | 412 | `<input>` | New person's name (`maxLength={60}`) `[VERIFIED: client/src/components/settings/PeopleSettings.tsx:412-419]` | `Input` | `aria-label="New person's name"` |
| `settings/PreferencesPanel.tsx` | 291 | `<input type="text">` | Custom currency symbol (`maxLength={3}`) `[VERIFIED: client/src/components/settings/PreferencesPanel.tsx:291-298]` | `Input` | Only rendered when `!budgetCurrency` |
| `settings/PrioritiesSettings.tsx` | 131, 214, 237, 248, 258 | Old `ui/Input` `<Input>` (5x) | Purpose (`maxLength={500}`), Essentials (`inputMode="decimal"`), Target amount (`inputMode="decimal"`), Months (`inputMode="numeric"`), Minimum (`inputMode="decimal"`) `[VERIFIED: client/src/components/settings/PrioritiesSettings.tsx:131-263]` | Shared `Input` | Wait on `D-16` / audit whether `214,237,258` stay `Input` or become `CurrencyInput` (note `D-15`: saved format is string, no `type="number"`) |
| `settings/PrioritiesSettings.tsx` | 141, 175, 224 | Old `ui/Input` `<Select>` (3x) | Review cadence (`off`/`payday`/`monthly`/`quarterly`), per-category purpose, Comfort target (`none`/`amount`/`months`) `[VERIFIED: client/src/components/settings/PrioritiesSettings.tsx:141-233]` | Shared `Select` | Fixed option lists (`D-06`); breaks `resilience.spec.ts:22-24` `selectOption` |
| `settings/ReadOnlyAccess.tsx` | 106 | `<input>` | Token name (`maxLength={60}`) `[VERIFIED: client/src/components/settings/ReadOnlyAccess.tsx:106-112]` | `Input` | Inside `<label>` — convert to `Field` or `label` prop |
| `settings/ReadOnlyAccess.tsx` | 116, 130 | `<select>` (2x) | Expiry days (`DAYS`), Access scope (`read`/`categorise`/`organise`) `[VERIFIED: client/src/components/settings/ReadOnlyAccess.tsx:116-139]` | Shared `Select` | Fixed lists (`D-06`); breaks `server-mode/auth.spec.ts:233` `selectOption('organise')` |
| `settings/ReminderSettings.tsx` | 97, 131 | `<input type="checkbox">` (2x) | Send reminders; Include name and amount `[VERIFIED: client/src/components/settings/ReminderSettings.tsx:97-144]` | `Checkbox` | Remove wrapping `<label>` |
| `settings/ReminderSettings.tsx` | 115 | `<input>` | HA notify service (`maxLength={100}`, `autoCapitalize="none"`, `spellCheck={false}`) `[VERIFIED: client/src/components/settings/ReminderSettings.tsx:115-123]` | `Input` | Pass `autoCapitalize`, `spellCheck` (`D-20`) |
| `settings/ServerSettings.tsx` | 134 | `<input type="checkbox">` | "Keep a copy of my budget on this device" `[VERIFIED: client/src/components/settings/ServerSettings.tsx:134-142]` | `Checkbox` | Checked by `settings.spec.ts:137,145` |
| `settings/ServerSettings.tsx` | 419, 436, 453 | `<input type="password">` (3x) | Current, New, Confirm password (`autoComplete`) `[VERIFIED: client/src/components/settings/ServerSettings.tsx:419-461]` | `Input` (`type="password"`) | `D-20` critical: keep `type="password"` and `autoComplete` |
| `settings/TagManager.tsx` | 53 | `<select>` | Tag colour swatch (`opacity-0` overlay over 16×16 dot) `[VERIFIED: client/src/components/settings/TagManager.tsx:51-65]` | Shared `Select` (compact swatch trigger) or `D-17` audit check | **Pitfall:** `opacity-0` native `<select>` cannot swap 1:1 to a standard `h-10` button trigger without shifting row layout; see Pitfalls |
| **Boundary (Phase 3 G2)** `settings/CategoryManager.tsx`, `DeleteCategoryModal.tsx`, `EditCategoryModal.tsx` | — | 3 `<input>` in `CategoryManager`, 1 `<select>` in `DeleteCategoryModal`, 1 `<input>` + 3 `<select>` + 1 `<input type="radio">` + 1 `<input type="checkbox">` in `EditCategoryModal` | Mounted by `pages/BudgetCategories.tsx` (`/budget/categories`) `[VERIFIED: client/src/pages/BudgetCategories.tsx:1-22]` | Moved in **Phase 3 G2** with Budget (`03-CONTEXT.md` D-13) | Verify in G4 Task 1 (`D-16`) that Phase 3 actually moved these 3 `components/settings/*` files |

**Settings G4 total (excluding `CategoryManager` trio):** `30` raw (`1` month, `3` date, `12` text/url/email/numeric, `3` password, `5` checkbox, `1` radio loop, `4` select, `1` file) + `8` old `ui/Input` (`5` `Input`, `3` `Select`).

#### B. Bank Connection Sections (`ConnectedBanks.tsx` + `up/`, `plaid/`, `simplefin/`, `enablebanking/`)
`components/accounts/ConnectedBanks.tsx` (`365` lines) and `DeletedBankImports.tsx` (`74` lines) hold **0** raw or old form fields (`[VERIFIED: client/src/components/accounts/ConnectedBanks.tsx:1-365; client/src/components/settings/DeletedBankImports.tsx:1-74]`).

| File | Line(s) | Current Element | Type / Purpose | Target Shared Control | Notes / Special Attributes |
|------|---------|-----------------|----------------|-----------------------|----------------------------|
| `up/UpConnectModal.tsx` | 276 | `<input type="password">` | Up personal access token (`id="up-token"`, `autoComplete="off"`, `spellCheck={false}`, `placeholder="up:yeah:…"`, `aria-describedby`) `[VERIFIED: client/src/components/up/UpConnectModal.tsx:276-286]` | `Input` (`type="password"`) | `D-20`: keep `type="password"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono`, and adjacent Paste button |
| `up/UpConnectModal.tsx` | 349, 385 | `<select>` (2x) | Account action (`create`/`link`/`skip`); Link target account (`eligible`) `[VERIFIED: client/src/components/up/UpConnectModal.tsx:349-398]` | `Select` (349 fixed), `Combobox` or `Select` per audit (385 user-grown accounts) | Breaks `switchers.spec.ts:229,230,240,356,357,359` `selectOption` |
| `up/UpConnectModal.tsx` | 370 | `<input>` | New account name (`aria-label={`Name for ${a.name}`}`) `[VERIFIED: client/src/components/up/UpConnectModal.tsx:370-376]` | `Input` | Inside `<label>` — preserve `aria-label` |
| `up/UpConnectModal.tsx` | 404 | `<input type="date">` | Cut-over date (`aria-label={`Cut-over date for ${a.name}`}`) `[VERIFIED: client/src/components/up/UpConnectModal.tsx:404-413]` | `DatePicker` (`D-07`) | Breaks `switchers.spec.ts:239` `.fill(cutover)` |
| `up/UpSettings.tsx` | 110 | `<select>` | Background sync poll interval (`0`, `15`, `30`, `60`, `240`) `[VERIFIED: client/src/components/up/UpSettings.tsx:110-134]` | `Select` (fixed) | Breaks `up.spec.ts:84,102` `selectOption` |
| `plaid/PlaidConfigForm.tsx` | 57, 73 | `<input type="text">`, `<input type="password">` | Plaid Client ID & Secret `[VERIFIED: client/src/components/plaid/PlaidConfigForm.tsx:57-80]` | `Input` | `D-20`: keep `type="password"` on Secret; add `autoComplete="off"` only if present/unchanged |
| `plaid/PlaidSetupModal.tsx` | 90, 106 | `<input type="text">`, `<input type="password">` | Plaid Client ID & Secret `[VERIFIED: client/src/components/plaid/PlaidSetupModal.tsx:90-113]` | `Input` | `D-20`: keep `type="password"` on Secret |
| `plaid/PlaidEnvironmentSelect.tsx` | 21 | `<select>` | `production` / `sandbox` `[VERIFIED: client/src/components/plaid/PlaidEnvironmentSelect.tsx:21-29]` | `Select` (fixed) | — |
| `plaid/ConnectBankModal.tsx` | 309, 325 | `<select>`, `<input type="text">` | Link existing account; New account name `[VERIFIED: client/src/components/plaid/ConnectBankModal.tsx:309-331]` | `Combobox` / `Select` (309 per audit), `Input` (325) | — |
| `simplefin/SimplefinConfigForm.tsx` | 61 | `<input type="text">` | SimpleFIN setup token (`font-mono`) `[VERIFIED: client/src/components/simplefin/SimplefinConfigForm.tsx:61-68]` | `Input` | `D-20`: keep `type="text"` and `font-mono` |
| `simplefin/SimplefinConnectModal.tsx` | 164, 336, 352 | `<input type="text">`, `<select>`, `<input type="text">` | Setup token (`font-mono`); Link account; Account name `[VERIFIED: client/src/components/simplefin/SimplefinConnectModal.tsx:164-170,336-358]` | `Input`, `Combobox` / `Select` (336 per audit), `Input` | `D-20`: keep token attributes |
| `enablebanking/EnableBankingSetupForm.tsx` | 224, 246 | `<input type="text">`, `<input type="file">` | Application ID (`autoComplete="off"`, `spellCheck={false}`, `font-mono`); Private key `.pem` file `[VERIFIED: client/src/components/enablebanking/EnableBankingSetupForm.tsx:224-252]` | `Input` (224), **Keep native** `type="file"` (246, `D-17`) | `D-20`: keep `autoComplete="off"`, `spellCheck={false}` |
| `enablebanking/ConnectEnableBankingModal.tsx` | 357 | `<select>` | Country (`id="eb-country"`) `[VERIFIED: client/src/components/enablebanking/ConnectEnableBankingModal.tsx:357-369]` | `Select` or `Combobox` per audit | Breaks `enable-banking.spec.ts:57` `selectOption('FI')` |
| `enablebanking/ConnectEnableBankingModal.tsx` | 381 | `<input type="search">` | Bank search filter (`id="eb-search"`) `[VERIFIED: client/src/components/enablebanking/ConnectEnableBankingModal.tsx:381-389]` | `Input` (`type="search"`) | Filters listbox directly below |
| `enablebanking/ConnectEnableBankingModal.tsx` | 536 | `<input type="text">` | Pasted callback redirect URL (`id="eb-paste"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono`) `[VERIFIED: client/src/components/enablebanking/ConnectEnableBankingModal.tsx:536-545]` | `Input` | `D-20` + `enable-banking.spec.ts:105` |
| `enablebanking/ConnectEnableBankingModal.tsx` | 703, 711, 728, 759 | `<input type="text">`, `<select>` (2x), `<input type="checkbox">` | Account name; Account type (fixed `ACCOUNT_TYPES`); Existing account (user-grown); Full history checkbox `[VERIFIED: client/src/components/enablebanking/ConnectEnableBankingModal.tsx:703-764]` | `Input`, `Select`, `Combobox` / `Select` (728 per audit), `Checkbox` | `ConnectEnableBankingModal.tsx` is `842` lines (`MAP.md:92` split candidate; keep whole per Wave G scope) |

**Bank connections G4 total:** `26` raw (`9` Enable Banking [`1` file], `7` Plaid [`2` password], `6` Up [`1` password, `1` date], `4` SimpleFIN).

#### C. Shelved & Split-Candidate Pages (`Review`, `CashFlow`, `Household`, `Tax`) — Mechanical Swap Only (`D-09`)

1. **Cash Flow (`pages/CashFlow.tsx`, `1329` lines):** Holds **0** raw HTML fields and **0** legacy `ui/Input` fields. Its sole control is `<MonthRangePicker>` at line 1184 `[VERIFIED: client/src/pages/CashFlow.tsx:1184]`. (`MonthRangePicker` in `components/ui/MonthRangePicker.tsx` is handled per Phase 2 `D-11` planner decision.)
2. **Review (`pages/Review.tsx`, `792` lines + `components/review/`):**
   - `pages/Review.tsx:381` uses `<CategoryPicker>` (already rewired in Phase 2); `pages/Review.tsx:500` uses old `ui/Input` `<Select>` (`value={group}`) for category group filter (`review.spec.ts:97` `selectOption`) `[VERIFIED: client/src/pages/Review.tsx:381,500]`.
   - `components/review/Housekeeping.tsx:191` uses old `ui/Input` `<Select aria-label={`Category for ${s.name}`}>` (`review-undo.spec.ts:127,152` `selectOption`) `[VERIFIED: client/src/components/review/Housekeeping.tsx:191-202]`. Note: check audit / `D-05` vs `D-09` whether this category list moves to `CategoryPicker` (recommended per `D-05` picker rule) or shared `Select` (if `D-09` swap-only governs).
   - `components/review/Resilience.tsx:409,455` use old `ui/Input` `<Select>` (deposit candidate list; reserve category when `>1`); `:428,441` use old `ui/Input` `<Input>` (`inputMode="decimal"` baseline amount; `inputMode="numeric"` share percent) `[VERIFIED: client/src/components/review/Resilience.tsx:409-468]`.
   - `components/review/SortUncategorised.tsx:142,272` use `<CategoryPicker>` and raw `<input type="checkbox">` ("Also apply to future transactions") `[VERIFIED: client/src/components/review/SortUncategorised.tsx:272-277]`.
   - **Review G4 total:** `1` raw (`checkbox`) + `6` old (`5` `Select`, `2` `Input` — wait: `1` `Select` in `Review.tsx` + `1` `Select` in `Housekeeping.tsx` + `2` `Select` + `2` `Input` in `Resilience.tsx` = `6` old total).
3. **Household (`pages/Household.tsx`, `1598` lines + `components/household/`):**
   - `pages/Household.tsx` holds **35** fields (`1` raw `<textarea>` at L335; `4` raw `<input type="checkbox">` at L360, L911, L941, L1538; `11` old `ui/Input` `<Select>` at L345, L439, L837, L881, L902, L923, L963, L979, L993, L1279, L1317; `18` old `ui/Input` `<Input>` — `6` `type="date"` at L856, L1154, L1252, L1257, L1330, L1334 and `12` text/`inputMode="decimal"` at L331, L620, L684, L846, L867, L950, L1144, L1163, L1172, L1213, L1261, L1265, L1274 — wait: count L1144, L1163, L1172, L1213, L1261, L1265, L1274 = 7 in bills, plus L331, L620, L684, L846, L867, L950 = 6 -> `13` text + `6` date = `19` `<Input>`, total `35` fields!). `[VERIFIED: client/src/pages/Household.tsx:331-1538]`.
   - **Critical `FormData` pattern in `Household.tsx`:** Lines 329–394, 620–627, 684–691, 835–1010, 1144–1295, and 1520–1560 read values via `new FormData(e.currentTarget)` (`f.get('name')`, `f.get('dueDate')`, `f.get('accountId')`, `f.get('payerId')`, `f.get('recipientId')`, `f.get('billId')`, `f.get('reversesId')`, `f.get('transactionId')`, `f.get('scheduleId')`, `f.get('isDefault')`, `f.get('advance')`, `f.get('include-' + p.id)`). Every shared replacement control (`Input`, `Textarea`, `Select`, `DatePicker`, `Checkbox`) MUST preserve `name` + `defaultValue`/`defaultSelected` submission in `FormData`.
   - `components/household/*` holds **21** fields (`5` raw: `textarea` in `CombinedHousehold.tsx:413`, `checkbox` in `HouseholdBills.tsx:36` and `RecurringBills.tsx:232,323`, `file` in `HouseholdIcon.tsx:89` [**keep native**, `D-17`]; plus `16` old `ui/Input`: `11` `Select` and `5` `Input` including `2` `type="date"` in `EditEntry.tsx:124` and `ReconcileBalances.tsx:118`). Note `ShareWithHousehold.tsx:213` is also imported by `TransactionTable`/`TransactionDetailPanel` (check in `D-16` Task 1 whether Phase 3 touched it). `QuickExpense.tsx:150` keeps shared `<Slider>` (`ui/Slider.tsx`).
4. **Tax (`pages/Tax.tsx`, `822` lines + `components/tax/`):**
   - `pages/Tax.tsx` holds **3** fields (`Select` at L133; `Input` at L779; `Input type="date"` at L788) plus `2` `<CurrencyInput>` (`L592`, `L794`) `[VERIFIED: client/src/pages/Tax.tsx:133,592,779-794]`.
   - `components/tax/Assets.tsx` (`910` lines): `2` `Select` (`L340`, `L496`), `7` `Input` (`L486`, `L522` with `<datalist id="asset-lives">`, `L542`, `L630`, `L834` + `2` `type="date"` at `L512`, `L882`), `1` `checkbox` (`L574`), `1` `radio` loop (`L599`), plus `2` `<CurrencyInput>` (`L506`, `L892`) `[VERIFIED: client/src/components/tax/Assets.tsx:486-635,834-892]`. Note `L522` uses HTML `list="asset-lives"` (`<datalist>`) — check in `D-16` Task 1 whether Phase 2 `Input` forwards `list` attribute!
   - `components/tax/CarAndHome.tsx` (`491` lines): `1` `Select` (`L57`), `3` `Input type="date"` (`L263`, `L351`, `L355`), `4` `Input type="text"` (`L272`, `L282`, `L379`, `L455`), `1` `checkbox` loop (`L363`) `[VERIFIED: client/src/components/tax/CarAndHome.tsx:263-455]`.
   - `components/tax/TaxClaimSection.tsx` (`170` lines, also imported by `TransactionDetailPanel.tsx`): `1` `checkbox` (`L100`), `1` `Select` (`L114`), `2` `Input` (`L129`, `L144`) `[VERIFIED: client/src/components/tax/TaxClaimSection.tsx:100-150]`.
   - `components/tax/ReceiptsSection.tsx` (`150` lines, also imported by `Tax.tsx`, `ReceiptsTab.tsx`, `TransactionDetailPanel.tsx`): `1` `<input type="file">` (`L81`, **keep native** per `D-17`) `[VERIFIED: client/src/components/tax/ReceiptsSection.tsx:81-92]`.

#### D. D-13 Screens (No Parent in Phase 3)
`pages/Dashboard.tsx` (`266` lines) and `pages/PaymentPlans.tsx` (`160` lines) hold **0** form controls directly (`[VERIFIED: client/src/pages/PaymentPlans.tsx:1-160]`).

| File | Line(s) | Current Element / Component | Purpose | Target Shared Control | Notes |
|------|---------|-----------------------------|---------|-----------------------|-------|
| `components/auth/AuthGate.tsx` | 348, 363, 393, 409 | `<input>` (x2), `<input type="password">` (x2) | Sign-in/setup/reset Name (`autoComplete="username"`), Code (`autoComplete="one-time-code"`, `spellCheck={false}`, `onPaste`), Password (`autoComplete="current-password" \| "new-password"`), Confirm (`autoComplete="new-password"`) `[VERIFIED: client/src/components/auth/AuthGate.tsx:348-416]` | `Input` | `D-20`: preserve every attribute + `onPaste` prefix-stripping |
| `components/layout/CommandPalette.tsx` | 370 | `<input type="text">` | Search palette combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `autoComplete="off"`, `spellCheck={false}`, `ref={inputRef}`, `onKeyDown`) `[VERIFIED: client/src/components/layout/CommandPalette.tsx:370-389]` | `Input` (passing `role` + `aria-*` + `ref` + `onKeyDown`) OR `D-17` allowlisted native `<input>` | Verified by `accessibility.spec.ts:266-297`; using shared `Input` avoids an allowlist entry if `Input` forwards `role`/`aria-*` |
| `components/dashboard/CustomizeHome.tsx` | 38 | `<input type="checkbox">` | Show/hide each home card `[VERIFIED: client/src/components/dashboard/CustomizeHome.tsx:38-43]` | `Checkbox` | Remove wrapping `<label>` |
| `components/dashboard/SummaryStats.tsx` | 211 | Old `ui/Input` `<Select compact>` | Savings rate goal (`10%..60%` fixed) `[VERIFIED: client/src/components/dashboard/SummaryStats.tsx:211-226]` | Shared `Select` (`size="sm"`) | **Breaks `e2e/tests/dashboard.spec.ts:103` (`getByRole('combobox')` -> `role="button"`)** |
| `pages/Welcome.tsx` | 256–274 | `<label><Switch .../></label>` | 3 optional feature toggles `[VERIFIED: client/src/pages/Welcome.tsx:256-274]` | `Switch` (already shared) | Verify Phase 2 already replaced outer `<label>` with `<div>` (nested `<label>` fix noted in `02-PATTERNS.md:355`); otherwise fix here |
| `components/plans/NewPlanModal.tsx` | 143, 156, 179, 191, 204, 220, 236, 253, 265 | `1` raw `checkbox`, `1` `CategorySelect`, `3` old `Select`, `1` old `Input` text, `2` old `Input type="date"`, `1` old `Input type="number"` (`193`) `[VERIFIED: client/src/components/plans/NewPlanModal.tsx:143-271]` | Add/record payment plan purchase | `Input`, `CategoryPicker` (`D-05`), `CurrencyInput` (unchanged), `DatePicker` (x2), `Input inputMode="numeric"` (`1..60`, `WAVG-08`), `Select` (frequency), `Combobox`/`Select` (accounts per audit), `Checkbox` | Fixing `CategorySelect` -> `CategoryPicker` updates `payment-plans.spec.ts:32`; fixing `L193` `type="number"` -> `inputMode="numeric"` (`1..60`) satisfies `WAVG-08` |
| `components/plans/PlanCard.tsx` | 212, 315, 322 | `2` old `Input type="date"`, `1` `CategorySelect`, `2` `<CurrencyInput>` (`L224`, `L314` — note `L314` has no `type="date"`, L315 does) `[VERIFIED: client/src/components/plans/PlanCard.tsx:212-326]` | Edit future payment dates; refund/fee adjustment modal | `DatePicker` (x2), `CategoryPicker` (`D-05`) | — |
| `components/plans/EarlierPaymentsModal.tsx` | 36 | Old `ui/Input` `<Select>` | History lookback (`6`/`12`/`24` months, fixed) `[VERIFIED: client/src/components/plans/EarlierPaymentsModal.tsx:36-44]` | Shared `Select` | — |
| `components/currency/CurrencySelect.tsx` | 45 | `<select>` | ~150 ISO currencies (`Common` + `All currencies` optgroups) `[VERIFIED: client/src/components/currency/CurrencySelect.tsx:45-68]` | Shared `Select` or `Combobox` per `WAVG-01` audit (`D-06`) | **Boundary:** also used by `AddAccountModal` (Phase 3). Recommend `Combobox` if audit treats 150-currency picker as searchable, or `Select` with optgroups (`D-06` fixed list). Breaks `currencies.spec.ts:31,41,126` |
| `components/currency/CurrencyDifference.tsx` | 83 | `<select>` | Choose income/expense category for FX gain/loss `[VERIFIED: client/src/components/currency/CurrencyDifference.tsx:83-99]` | `CategoryPicker` (`D-05`) | Check `allowNone` + `noneLabel="No category (net worth only)"` and income/expense `choices` filter |

---

### 2. Shelved Pages & Split Candidates: Safe Mechanical Swap Strategy (`D-09`)

`Household.tsx` (`1598` lines), `CashFlow.tsx` (`1329` lines), `Tax.tsx` (`822` lines), and `Review.tsx` (`792` lines) — plus large component files `Assets.tsx` (`910` lines) and `ConnectEnableBankingModal.tsx` (`842` lines) — must receive a **like-for-like swap only**: same field kind, same location, same label/copy, no splitting, no refactoring (`D-09`).

How to execute and verify safely without layout drift or edit collisions:
1. **Cut by component/section boundary rather than splitting files:**
   - `CashFlow.tsx` has zero raw/old fields (`MonthRangePicker` only) — verify and move on.
   - `Review.tsx` has only 2 form controls (`L381` `CategoryPicker`, `L500` `Select`) plus 3 small files in `components/review/` — handle as one clean task.
   - `Tax.tsx` has only 3 form controls (`L133`, `L779`, `L788`) — handle alongside `components/tax/*` in one task.
   - `Household.tsx` (`35` controls across 4 regions: Create/Edit Household modals L329–372 & L1533–1545; People inline forms L620–691; Record Entry modal L835–1010; Bills edit/reserve/add forms L1142–1295; Activity filter bar L1315–1335) stays owned by **one plan/agent** (`Plan 04-05`), edited top-to-bottom within its existing JSX blocks so no two tasks touch `Household.tsx`.
2. **Preserve `FormData` contracts in `Household.tsx`:** Because `Household.tsx` uses uncontrolled `FormData` (`submit(e, (f) => ({ ... }))`) on 7 forms, verify in Task 1 (`D-16`) that Phase 2's `Select`, `DatePicker`, `Checkbox`, `Input`, and `Textarea` forward `name` and `defaultValue`/`defaultSelected` to React Aria's hidden form inputs (`[CITED: react-spectrum.adobe.com]`). Do **not** rewrite `Household.tsx` to controlled `useState` unless a shared control omits `name` support (and if it does, extending the shared control in `components/ui/` per `D-01` / Claude's Discretion is cleaner and preserves `D-09`).
3. **Preserve compact inline widths:** In `Household.tsx:1315-1335` (`w-36`, `w-40`), `Tax.tsx:778-798` (`grid-cols-1 sm:grid-cols-3`), and `Review.tsx:499` (`w-48 max-md:w-full`), keep the existing width wrapper classes around the shared controls (`D-03`, `D-09`) and verify at `1280px` and `390px` with no sideways scroll.

---

### 3. Sign-in and Bank Credential Fields (`D-20`)

Every field taking a password, token, API key, setup/reset code, or bank credential must keep its `type`, `name`, `autoComplete`, `inputMode`, `spellCheck`, `autoCapitalize`, `maxLength`, `aria-describedby`, and paste behaviour **verbatim**:

| File & Line | Field | Required Attributes to Preserve |
|-------------|-------|---------------------------------|
| `AuthGate.tsx:348` | Name | `id="name"`, `autoComplete="username"`, `autoFocus={!isSetup}` |
| `AuthGate.tsx:363` | Setup / invite / reset code | `id="setup-code"`, `autoComplete="one-time-code"`, `spellCheck={false}`, `autoFocus={isSetup}`, `onPaste` (`codeFromPaste` handler), `aria-describedby`, `font-mono uppercase` |
| `AuthGate.tsx:393` | Password / New password | `id="password"`, `type="password"`, `autoComplete={choosing ? 'new-password' : 'current-password'}`, `autoFocus={!isSetup && !needsName}` |
| `AuthGate.tsx:409` | Confirm password | `id="confirm"`, `type="password"`, `autoComplete="new-password"` |
| `ServerSettings.tsx:419,436,453` | Change password (3 fields) | `type="password"`, `autoComplete="current-password" \| "new-password"`, `aria-label` |
| `PeopleSettings.tsx:250` | Confirmation code | `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, `font-mono` |
| `PeopleSettings.tsx:285` | Notify service / email | `type={destination === 'email' ? 'email' : 'text'}`, `autoComplete={destination === 'email' ? 'email' : 'off'}`, `spellCheck={false}`, `font-mono` |
| `ReminderSettings.tsx:115` | HA notify service | `maxLength={100}`, `autoCapitalize="none"`, `spellCheck={false}` |
| `UpConnectModal.tsx:276` | Up personal access token | `id="up-token"`, `type="password"`, `autoComplete="off"`, `spellCheck={false}`, `aria-describedby`, `font-mono`, plus adjacent Paste button |
| `PlaidConfigForm.tsx:57,73` & `PlaidSetupModal.tsx:90,106` | Plaid Client ID & Secret | `type="text"` (Client ID), `type="password"` (Secret) — never unmask Secret |
| `SimplefinConfigForm.tsx:61` & `SimplefinConnectModal.tsx:164` | SimpleFIN setup token | `type="text"`, `font-mono` |
| `EnableBankingSetupForm.tsx:224` | EB Application ID | `id="eb-app-id"`, `type="text"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono` |
| `ConnectEnableBankingModal.tsx:536` | EB pasted callback URL | `id="eb-paste"`, `type="text"`, `autoComplete="off"`, `spellCheck={false}`, `font-mono` |

**Planned shared `Input` compatibility check (`D-16` Task 1):**
React Aria's `<Input>` renders a native `<input>` element and forwards standard `InputHTMLAttributes` (`type`, `name`, `autoComplete`, `inputMode`, `spellCheck`, `autoCapitalize`, `onPaste`, `defaultValue`, `maxLength`, `aria-describedby`, `role`, `ref`) `[CITED: react-spectrum.adobe.com]`. **Critical trap:** if Phase 2's `client/src/components/ui/Input.tsx` wraps `<TextField>` around `<Input>` and spreads `...props` onto `<TextField>` instead of `<Input>`, attributes like `spellCheck`, `onPaste`, `autoCapitalize`, and `role` will either fail TypeScript compilation or not reach `<input>`. G4 Task 1 must inspect the shipped `ui/Input.tsx` and, if needed, ensure `inputProps` (or standalone `<Input>`) forwards every attribute above directly to the `<input>` DOM node.

---

### 4. `WAVG-08`: All 10 `type="number"` Fields, Zod Caps, and Search-Based Test

Verified scan (`rg -n 'type=["'\''{]?number' client/src/`) across all `client/src`:

| # | File & Line | Purpose | Money? | Owner Phase | Server Zod Schema & Cap (Verified) | Replacement |
|---|-------------|---------|--------|-------------|-----------------------------------|-------------|
| 1 | `plans/NewPlanModal.tsx:193` | `instalmentCount` ("Number of payments") | **No** (count) | **Phase 4 (G4)** | `server/src/routes/paymentPlans.ts:94`: `instalmentCount: z.number().int().min(1).max(60)` `[VERIFIED: server/src/routes/paymentPlans.ts:94]` | Shared `Input` (`type="text" inputMode="numeric"`), clamped/validated `1..60` (and `>= Math.max(1, linked.length)`), with a failing-first test |
| 2 | `budget/TargetCard.tsx:115` | `cycle` ("Repeats every (months)") | No (months) | Phase 3 (G2) | `server/src/services/targetConfig.ts:16`: `cycleMonths: z.number().int().min(1).max(60)` `[VERIFIED: server/src/services/targetConfig.ts:16]` | Confirm Phase 3 replaced with shared field (`1..60`) |
| 3 | `budget/PaydayPlan.tsx:246` | `rule.percent` ("Percent") | No (%) | Phase 3 (G2) | `server/src/services/paydayConfig.ts:11`: `percent: z.number().int().min(0).max(100).default(0)` `[VERIFIED: server/src/services/paydayConfig.ts:11]` | Confirm Phase 3 replaced (`0..100`) |
| 4 | `forecast/CashRunway.tsx:182` | `spendingPercent` / `incomePercent` | No (%) | Phase 3 (G3) | `server/src/services/forecastConfig.ts:10,12`: `min(0).max(500)` / `min(0).max(200)` `[VERIFIED: server/src/services/forecastConfig.ts:10-12]` | Confirm Phase 3 replaced (`0..500`, `0..200`) |
| 5 | `forecast/CashRunway.tsx:221` | `annualReturnBasisPoints / 100` | No (% / yr) | Phase 3 (G3) | `server/src/services/forecastConfig.ts:16`: `annualReturnBasisPoints: z.number().int().min(-10000).max(5000)` (`-100%..50%`) `[VERIFIED: server/src/services/forecastConfig.ts:16]` | Confirm Phase 3 replaced (`-100..50`) |
| 6 | `transactions/ImportModal.tsx:767` | `skipRows` ("Rows above the header") | No (row count) | Phase 3 (G2) | Client-only CSV header offset (`0..records.length - 1`) `[VERIFIED: client/src/components/transactions/ImportModal.tsx:768-769]` | Confirm Phase 3 replaced |
| 7 | `rules/RuleEditorModal.tsx:563` | `p.value` (`kind === 'percent'`) | No (%) | Phase 3 (G2) | `server/src/routes/rules.ts:75`: `.refine((p) => p.kind !== 'percent' || p.value <= 100)` (`0..100`) `[VERIFIED: server/src/routes/rules.ts:71-75]` | Confirm Phase 3 replaced (`0..100`); `fixed` already uses `CurrencyInput` at L554 |
| 8 | `recurring/RecurringFormModal.tsx:520` | `dateFlexibility` ("± days for matching") | No (days) | Phase 3 (G2) | `server/src/routes/schedules.ts:88`: `dateFlexibility: z.number().int().min(0).max(14)` `[VERIFIED: server/src/routes/schedules.ts:88]` | Confirm Phase 3 replaced (`0..14`) |
| 9 | `recurring/UpcomingLengthModal.tsx:82` | `num` (custom upcoming length) | No (count) | Phase 3 (G2) | Client preference (`>= 1`) `[VERIFIED: client/src/components/recurring/UpcomingLengthModal.tsx:83-85]` | Confirm Phase 3 replaced |
| 10 | `longterm/EventEditor.tsx:382` | `endYear` ("Last year") | No (year) | Phase 3 (G3) | `server/src/services/longTermConfig.ts:173`: `endYear: z.number().int().min(1900).max(2300).nullable()` `[VERIFIED: server/src/services/longTermConfig.ts:173]` | Confirm Phase 3 replaced (`1900..2300`) |

**WAVG-08 search-based test (`D-14`):** Follow `client/src/utils/movedSections.test.ts:66-85` (`import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })`). Strip comments (`withoutComments` pattern from `lint/terms/terms.test.js:31-35`) and assert **zero** occurrences of `type="number"` / `type='number'` / `type={'number'}` remain anywhere in `client/src/` (or if any Phase 3 non-money field intentionally retained `type="number"`, assert exact `[file, count]` match against a small non-money allowlist verified by `D-16` Task 1 — zero money fields allowed).

---

### 5. `WAVG-09`: `lint/` Architecture, Custom Rule, Allowlist, Tests, and Warning Cap

**How `lint/` works today (`[VERIFIED: lint/eslint.config.js:1-133; lint/package.json:1-21; lint/README.md:1-32]`):**
- Independent package (`flybudget-lint`) using ESLint `9.39.5`, `typescript-eslint` `8.72.1` (`typescript` `~6.0.3` for AST parsing only), `eslint-plugin-react-hooks` `7.1.1`, `eslint-plugin-jsx-a11y` `6.10.2`, `globals` `17.14.0`.
- `npm test` runs `node --test "rules/*.test.js" "tokens/*.test.js" "terms/*.test.js"`.
- `npm run lint` runs `cd .. && eslint -c lint/eslint.config.js --max-warnings=128 client/src server/src`.
- `lint/eslint.config.js:80-84` registers `{ files: ['client/src/**/*.tsx'], ignores: ['**/*.test.tsx'], plugins: { allotment: { rules: { 'icon-only-control': iconOnlyControl } } }, rules: { 'allotment/icon-only-control': 'error' } }`.

**Recommended implementation (`lint/rules/no-raw-form-control.js` + `.test.js`):**
1. **Custom rule vs `no-restricted-syntax`:** Write a custom ESLint 9 rule `lint/rules/no-raw-form-control.js` (`meta.type = 'problem'`, `JSXOpeningElement` visitor checking `node.name.type === 'JSXIdentifier' && /^(input|select|textarea)$/.test(node.name.name)`).
   - Why not `no-restricted-syntax`? `lint/eslint.config.js:55` already defines `'no-restricted-syntax'` for `toISOString()`. Adding a second `'no-restricted-syntax'` block for `client/src/**/*.tsx` in ESLint flat config **replaces** the `toISOString()` selector unless merged, and `no-restricted-syntax` has no clean `RuleTester` target for `cd lint && npm test`.
   - **Flat-config plugin rule:** Define `const allotmentPlugin = { rules: { 'icon-only-control': iconOnlyControl, 'no-raw-form-control': noRawFormControl } };` once in `lint/eslint.config.js` so `allotment` is never redefined with a different object reference (ESLint 9 throws `Cannot redefine plugin "allotment"` otherwise).
2. **Scoping:**
   - Apply `'allotment/no-raw-form-control': 'error'` with `files: ['client/src/**/*.tsx']` and `ignores: ['**/*.test.tsx', 'client/src/components/ui/**']`.
   - Wait: what about `client/src/components/ui/Input.tsx`, `CurrencyInput.tsx`, `DatePicker.tsx`, `Slider.tsx`, etc.? They live under `client/src/components/ui/`, so ignoring `client/src/components/ui/**` matches `D-21` (`"outside client/src/components/ui/"`) cleanly.
3. **Allowlist design (`D-17`, `D-21`):**
   - **Attribute allowlist (`type="file"`):** Inside `no-raw-form-control.js`, allow `<input>` when it has a static `JSXAttribute` `name.name === 'type'` with literal `'file'` (covers all 10 file inputs across `client/src`: `DataExport.tsx:235`, `EnableBankingSetupForm.tsx:246`, `HouseholdIcon.tsx:89`, `ReceiptsSection.tsx:81`, plus Phase 3's 6 file inputs).
   - **Explicit file/exception allowlist (`D-17`):** If the WAVG-01 audit or G2–G4 PRs leave any non-file native exception (e.g., `TagManager.tsx:53` colour swatch or `CommandPalette.tsx:370` if not switched to shared `Input`), either pass a structured `allow: [{ file: '...', element: '...', reason: '...' }]` rule option in `lint/eslint.config.js` (checking `context.filename` suffix + element name, failing if a stale allowlist entry matches nothing or cleanly documented per line) OR use `// eslint-disable-next-line allotment/no-raw-form-control -- <D-17 reason>` (allowed by `CLAUDE.md:170` when reason is on the line). Keeping the allowlist in `lint/eslint.config.js` options (`D-21`: `"The allowlist is explicit and short: file inputs, and the fields D-17 lists, each with its reason on the line"`) makes every exception auditable in one table.
   - **Optional `type="number"` check (Claude's Discretion):** A 5-line check on `<Input type="number">` / `<input type="number">` can emit a separate `noNumberInput` error if Phase 3 left zero `type="number"` usages; otherwise let the D-14 Vitest test own `type="number"` so `WAVG-09` stays focused on raw elements.
4. **Tests (`lint/rules/no-raw-form-control.test.js`):**
   - Copy `RuleTester` + `tseslint.parser` setup from `lint/rules/icon-only-control.test.js:1-14` (`[VERIFIED: lint/rules/icon-only-control.test.js:1-14]`).
   - `valid`: `<Input />`, `<Select />`, `<Textarea />`, `<CurrencyInput />`, `<DatePicker />`, `<input type="file" />`, `<input type="file" accept=".pem" />`.
   - `invalid`: `<input />`, `<input type="text" />`, `<input type="date" />`, `<input type="password" />`, `<select><option /></select>`, `<textarea />` (and `<Input type="number" />` if enabled).
5. **Update `jsx-a11y/label-has-associated-control` and recount `--max-warnings`:**
   - In `lint/eslint.config.js:126`, remove `'Select'` from `controlComponents: ['Input', 'Select', 'CurrencyInput', 'MoneyInput', 'AmountInput']` once `ui/Input.tsx`'s native `Select` is removed in G5 (`[VERIFIED: lint/eslint.config.js:119-126]` — comment explicitly states `"Keep this list to components that do [render a native input or select as its first labelable element]"`).
   - Run `cd lint && npm run lint:report`, count the remaining warnings, and lower `--max-warnings=128` in `lint/package.json:8` to the exact new warning count (`D-21`).

---

### 6. `WAVG-10`: Removal List, Reference Audit, and Exact Doc Updates

**Names to remove in G5 (`D-22`):**
- `Select` export and `compactSelectClass` in `client/src/components/ui/Input.tsx` (`[VERIFIED: client/src/components/ui/Input.tsx:18-30]`) — verify all ~80 callers are off it before deleting.
- `client/src/components/transactions/CategorySelect.tsx` (native `<select>` for categories; callers in G2/G3 + `NewPlanModal.tsx:156` and `PlanCard.tsx:322` in G4).
- `client/src/components/transactions/MerchantSelect.tsx` and its exported `selectorInputClass` (`[VERIFIED: client/src/components/transactions/MerchantSelect.tsx:7-30]`; callers in `AddTransactionModal`, `RuleEditorModal`, `RecurringFormModal`, and `CategorySelectButton` — all Phase 3 G2).
- `client/src/components/transactions/CategorySelectButton.tsx` (check after Phase 3 whether `CategorySelectButton` was removed or converted into a thin `CategoryPicker` field wrapper; if unused, delete it in G5).
- Any old internal hand-rolled picker helpers or one-off CSS field classes left unused after G2–G4 (e.g., `inputClass` constants in `BudgetStartSettings.tsx:12`, `CurrencySettings.tsx:31`, `ConnectEnableBankingModal.tsx:662`, `textareaClass` in `Household.tsx`).
- Search all removed symbol names across `client/src/`, `e2e/`, `client/src/demo/`, and `docs/` before opening the G5 PR (`D-22`). Today's scan confirmed zero references to `CategorySelect`, `MerchantSelect`, `CategorySelectButton`, or `ui/Input` `Select` inside `client/src/demo/` and `e2e/`, and one stale mention in `docs/DEVELOPMENT.md:227` (`"PayeeCombobox/CategorySelect take fieldClassName"` `[VERIFIED: docs/DEVELOPMENT.md:227]`) plus historical archive notes in `docs/handover/ARCHIVE.md` and `docs/AUDIT-2026-11.md` (leave historical audit/archive logs untouched, update active docs).

**Exact doc sections to update in G5 (`WAVG-10`):**
1. **`DESIGN.md`:**
   - `§Components → Inputs and selects` (`[VERIFIED: DESIGN.md:289-292]`): record the 11 shared form controls (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`) + `CurrencyInput`, unified height/radius/focus/disabled/invalid/read-only rules, phone native branching (`< 768 px`), and the Wave G picker rule (`CategoryPicker` for categories, `PayeeCombobox` for payees, `Select` for fixed lists, `Combobox` for user-grown lists). Update `frontmatter` `components.input` if needed.
2. **`docs/ui/MAP.md`:**
   - `§client/src/components/ui primitives` (`[VERIFIED: docs/ui/MAP.md:95-129]`): replace `Input.tsx: Input, Select` at L113 (`[VERIFIED: docs/ui/MAP.md:113]`) with the 11 shared controls (`Checkbox`, `Combobox`, `DatePicker`, `Field`, `Input`, `Label`, `MonthPicker`, `RadioGroup`, `Select`, `Switch`, `Textarea`) plus note the `allotment/no-raw-form-control` ESLint guard and `type="number"` source test; refresh `wc -l client/src/pages/*.tsx` line counts (`MAP.md:3`).
3. **`docs/ui/HANDOVER-UI.md`:**
   - `§Decisions` lines 127–128 (`[VERIFIED: docs/ui/HANDOVER-UI.md:127-128]`): replace Wave E's outdated rule (`"a short fixed list uses the one shared styled Select (components/ui/Input.tsx)"`) with Wave G's picker rule (`CategoryPicker` for categories, `PayeeCombobox` for payees, shared `Select` for fixed lists, shared `Combobox` for user-grown lists, native pickers under 768 px, and `allotment/no-raw-form-control` enforcing no raw fields outside `components/ui/`).
   - `§Done this session` & `§Verify`: record G4 + G5 completion (`0.2.0-up.N`).
4. **`docs/DEVELOPMENT.md`:**
   - Line 227 (`[VERIFIED: docs/DEVELOPMENT.md:227]`): update stale `CategorySelect` mention if `CategorySelect` is removed.
5. **`docs/ui/WAVES.md` & `CLAUDE.md`/`AGENTS.md` (Claude's Discretion):**
   - `docs/ui/WAVES.md:5-6` notes `"delete this file when Wave G has merged (owner, 15 November 2026)"`; confirm at G5 whether to record Wave G in its Status table or delete it per that Wave F owner note.
   - `CLAUDE.md` / `AGENTS.md`: if adding a note about `allotment/no-raw-form-control` or updating the picker/control rule under `§Review guidelines → Client`, edit both files identically and verify with `cmp -s CLAUDE.md AGENTS.md`.

---

### 7. E2E Impact Matrix (Phase 4 Screens)

All desktop `<select>` -> React Aria `Select`/`Combobox` changes replace native `role="combobox"` with a `role="button"` trigger (for `Select`) + portaled `role="listbox"` / `role="option"` (while phone `<768 px` projects keep native `<select>` and `selectOption` unchanged per `D-04`). Desktop `<input type="date">` -> `DatePicker` moves to the Phase 2 `fillDate` helper (`e2e/tests/fixtures.ts`), and `<input type="month">` moves to a new `fillMonth` helper (or popover grid click).

| Spec File | Line(s) | Current Selector / Action | Screen / Control | Replacement Pattern (Desktop) |
|-----------|---------|---------------------------|------------------|-------------------------------|
| `e2e/tests/dashboard.spec.ts` | 103 | `page.getByRole('combobox', { name: 'Savings rate goal' })` | `SummaryStats.tsx:211` (`Select`) | `getByRole('button', { name: /Savings rate goal/ })` or `getByLabel('Savings rate goal')` (note: `phone/amounts-phone.spec.ts:73` & `phone/dashboard-viewport.spec.ts:45` stay `<select>` / `combobox`!) |
| `e2e/tests/settings.spec.ts` | 431 | `page.getByLabel('Start month').fill(thisMonth)` | `BudgetStartSettings.tsx:66` (`MonthPicker`) | Shared `fillMonth(page.getByRole('button', { name: /Start month/ }), thisMonth)` clicking year/month in popover (`dialog`), or `This month` shortcut |
| `e2e/tests/currencies.spec.ts` | 18, 31, 41, 126 | `getByRole('combobox', { name: 'Budget currency' \| 'Currency' }).selectOption(...)` | `CurrencySelect.tsx:45`, `CurrencySettings.tsx` | Trigger button/combobox + click `getByRole('option', ...)` |
| `e2e/tests/resilience.spec.ts` | 22–24 | `getByLabel('Purpose for ...' \| 'Comfort target').selectOption(...)` | `PrioritiesSettings.tsx:141,175,224` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/server-mode/auth.spec.ts` | 233 | `section.getByLabel('Access').selectOption('organise')` | `ReadOnlyAccess.tsx:130` | Trigger `click()` + `getByRole('option', { name: 'Read, categorise and organise' })` |
| `e2e/tests/up.spec.ts` | 84, 102 | `getByLabel('Background sync').selectOption('15' \| '0')` | `UpSettings.tsx:110` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/switchers.spec.ts` | 229, 230, 240, 356, 357, 359 | `.selectOption(...)` (6 lines) | `UpConnectModal.tsx:349,385` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/switchers.spec.ts` | 239 | `getByLabel('Cut-over date for Up Everyday').fill(cutover)` | `UpConnectModal.tsx:404` | `fillDate(...)` helper from `fixtures.ts` |
| `e2e/tests/enable-banking.spec.ts` | 57 | `dialog.getByLabel('Country').selectOption('FI')` | `ConnectEnableBankingModal.tsx:357` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/payment-plans.spec.ts` | 32 | `dialog.getByLabel('What it was for').selectOption(home.id)` | `NewPlanModal.tsx:156` (`CategoryPicker`) | Open `CategoryPicker` button + search/select `getByRole('option', ...)` |
| `e2e/tests/review.spec.ts` | 96–97 | `getByRole('combobox', { name: /^Category details/ }).selectOption(...)` | `Review.tsx:500` | `getByRole('button', { name: /^Category details/ })` + `getByRole('option', ...)` |
| `e2e/tests/review-undo.spec.ts` | 126–127, 151–152 | `getByRole('combobox', { name: 'Category for Mock Splurge' }).selectOption(...)` | `Housekeeping.tsx:191` | Update to `Select` or `CategoryPicker` option click |
| `e2e/tests/household.spec.ts` | 44, 45, 49, 124, 382, 666, 742, 837, 939, 966 | `.selectOption(...)` and `getByRole('combobox', { name: 'Household' })` | `Household.tsx`, `PayAhead.tsx`, `SplitEditor.tsx` | Trigger/combobox + `getByRole('option', ...)` |
| `e2e/tests/household.spec.ts` | 42, 917, 964 | `.fill('2026-10-21')`, `.fill('2026-10-01')` | `Household.tsx:856,1330` | `fillDate(...)` helper |
| `e2e/tests/household-categories.spec.ts` | 73 | `getByRole('combobox', { name: 'Category for Paid Sam back' }).toHaveValue(...)` | `RepaymentCategoryOffers.tsx:90` | `getByRole('button', { name: 'Category for Paid Sam back' })` + `toContainText(...)` |
| `e2e/tests/multi-user/people.spec.ts` | 158, 159, 168 | `.selectOption(...)` (3 lines) | `CombinedHousehold.tsx:80,146` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/investments.spec.ts` | 127, 191 | `getByLabel('Financial year').selectOption(...)` | `Tax.tsx:133` | Trigger `click()` + `getByRole('option', ...)` |
| `e2e/tests/depreciating-assets.spec.ts` | 83 | `.fill(isoDay())` | `Assets.tsx:512` | `fillDate(...)` helper |
| `e2e/tests/receipts-tax.spec.ts` | 60 | `.fill(isoDay())` | `Tax.tsx:788` | `fillDate(...)` helper |
| `e2e/tests/tax-car-home.spec.ts` | 25, 41, 42 | `.fill(date)`, `.fill(monday)`, `.fill(addDays(...))` | `CarAndHome.tsx:263,351,355` | `fillDate(...)` helper |

**Specs likely unaffected (verify in full run):** `home-cards.spec.ts` (uses `getByRole('checkbox')`, works identically on RAC `Checkbox`), `command-palette.spec.ts` + `accessibility.spec.ts:266-297` (keep `role="combobox"` + listbox on `CommandPalette`), `first-run.spec.ts`, `first-import.spec.ts`, `cash-flow.spec.ts`, `safe-mode.spec.ts`. Note also `server-mode/auth.spec.ts:94-96,351-353` (`getByRole('textbox', { name: 'Current password' })`) continues working on `<Input type="password">` because Chromium exposes `<input type="password">` as `role="textbox"` (`[ASSUMED]` — verify in `server-mode` e2e).

---

### 8. Plan & Wave Cut for G4 and G5

Because `D-18` requires G4 to merge to `redesign` before G5 starts, cut Phase 4 into **two sequential PR gates**:

- **G4 PR (`WAVG-07`, `WAVG-08`):**
  - **Wave 1 — `04-01-PLAN.md` (D-16 Gate & Shared Control Audit):** Read `docs/ui/FORM-CONTROLS-AUDIT.md`, shipped `components/ui/*`, and Phase 3 PR diffs; verify `Input` passthrough for `D-20` + `CommandPalette` (`role`, `aria-*`, `spellCheck`, `onPaste`, `autoCapitalize`, `list`), verify `FormData` (`name` + `defaultValue`/`defaultSelected`) on `Select`/`DatePicker`/`MonthPicker`/`Checkbox`, confirm cross-boundary files (`CategoryManager.tsx`, `ShareWithHousehold.tsx`, `TaxClaimSection.tsx`, `CurrencySelect.tsx`), and extend shared controls only if a gap blocks G4.
  - **Wave 2 (Parallel — disjoint component/page directories):**
    - `04-02-PLAN.md`: **Settings & Currency** (`components/settings/` except Phase 3 `CategoryManager` trio; `components/currency/CurrencySelect.tsx`, `CurrencyDifference.tsx`; e2e `settings.spec.ts`, `currencies.spec.ts`, `resilience.spec.ts`).
    - `04-03-PLAN.md`: **Bank Connections** (`components/up/`, `components/plaid/`, `components/simplefin/`, `components/enablebanking/`; e2e `up.spec.ts`, `switchers.spec.ts`, `enable-banking.spec.ts`).
    - `04-04-PLAN.md`: **D-13 Screens & WAVG-08 Fix** (`components/auth/AuthGate.tsx`, `components/layout/CommandPalette.tsx`, `components/dashboard/` `CustomizeHome.tsx` + `SummaryStats.tsx`, `pages/Welcome.tsx` label check, `components/plans/` `NewPlanModal.tsx` [`type="number"` -> `inputMode="numeric"` + failing-first test] + `PlanCard.tsx` + `EarlierPaymentsModal.tsx`; e2e `dashboard.spec.ts`, `payment-plans.spec.ts`, `server-mode/auth.spec.ts`).
    - `04-05-PLAN.md`: **Shelved & Split-Candidate Mechanical Swap (`D-09`)** (`pages/Review.tsx` + `components/review/*`, `pages/CashFlow.tsx` check, `pages/Tax.tsx` + `components/tax/*`, `pages/Household.tsx` + `components/household/*`; e2e `review.spec.ts`, `review-undo.spec.ts`, `household.spec.ts`, `household-categories.spec.ts`, `multi-user/people.spec.ts`, `depreciating-assets.spec.ts`, `receipts-tax.spec.ts`, `tax-car-home.spec.ts`, `investments.spec.ts`). *(Note: if `04-02` and `04-04` both touch `server-mode/auth.spec.ts` or `04-05` touches `multi-user/people.spec.ts`, isolate e2e edits cleanly by spec file or serialize Wave 2's e2e updates into `04-06`.)*
  - **Wave 3 — `04-06-PLAN.md` (WAVG-08 Source Test & G4 Release Gate):** Add Vitest `type="number"` source-scan test, run sequential full verification (`client` unit/build/tsc, `lint`, `format:check`, `e2e` `desktop`, `phone`, `demo`, `server-mode`, `gallery`), capture `.ui-evidence/<date>-wave-g4/`, run `npm run release:prepare`, update `CHANGELOG.md`, `HANDOVER-UI.md`, `MAP.md`, merge G4 PR.

- **G5 PR (`WAVG-09`, `WAVG-10` — Wave 4, blocked on G4 merge):**
  - **Wave 4 — `04-07-PLAN.md`:**
    1. `D-16` post-G4 check: verify zero unallowlisted raw controls remain outside `components/ui/`.
    2. `WAVG-09`: Add `lint/rules/no-raw-form-control.js` + `lint/rules/no-raw-form-control.test.js`, register in `lint/eslint.config.js` beside `icon-only-control`, update `controlComponents` in `eslint.config.js:126`, run `npm run lint:report` and lower `--max-warnings` in `lint/package.json:8`.
    3. `WAVG-10`: Remove `Select` from `ui/Input.tsx`, delete `CategorySelect.tsx`, `MerchantSelect.tsx` (+ `selectorInputClass`), unused `CategorySelectButton.tsx`, and one-off classes; run repo-wide search across `client/src`, `e2e/`, `client/src/demo/`, `docs/` for every removed symbol.
    4. `WAVG-10` Docs & G5 Release Gate: Update `DESIGN.md`, `docs/ui/MAP.md`, `docs/ui/HANDOVER-UI.md`, `docs/DEVELOPMENT.md:227`, `docs/ui/WAVES.md`, and `CLAUDE.md`/`AGENTS.md` (if changed); run `npm run release:prepare`, update `CHANGELOG.md`, run full CI parity verification (`client`, `server`, `lint`, `format:check`, `e2e` all projects).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form field / selector UI | Custom `<select>`, `<input>`, `<textarea>`, or ad-hoc `react-aria-components` wrappers in screens (`D-01`) | Phase 2 shared controls in `client/src/components/ui/` (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`, `CurrencyInput`, `CategoryPicker`, `PayeeCombobox`) | Enforces consistent tokens, 44 px phone targets, native phone pickers, WAI-ARIA patterns, and passes `WAVG-09`. |
| ESLint JSX selector guard | Second `no-restricted-syntax` block in `lint/eslint.config.js` or regex grep script | Custom rule `lint/rules/no-raw-form-control.js` + `RuleTester` in `lint/rules/no-raw-form-control.test.js` | Avoids overwriting the existing `no-restricted-syntax` rule (`audit F-22`) and integrates cleanly with `cd lint && npm test`. |
| Repo-wide `type="number"` guard | Shell `grep` only in docs or manual checklist | Vitest `import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })` test (modeled on `movedSections.test.ts:66-85`) | Runs on every `npm test --prefix client` and CI run automatically. |
| Month selection on desktop/phone | Custom `YYYY-MM` text parser in `BudgetStartSettings` | Shared `MonthPicker` (`D-11`) | Native `<input type="month">` on phones, accessible popover grid on desktop. |

## Common Pitfalls

### Pitfall 1: Uncontrolled `FormData` Failure in `Household.tsx`
**What goes wrong:** `Household.tsx` uses `new FormData(e.currentTarget)` across 7 forms (`name`, `people`, `accountId`, `payerId`, `recipientId`, `billId`, `reversesId`, `transactionId`, `scheduleId`, `dueDate`, `date`, `amount`, `personalShare`, `reserved`, `isDefault`, `advance`, `include-${p.id}`). If Phase 2's `Select`, `DatePicker`, or `Checkbox` wrappers omitted `name` or `defaultValue`/`defaultSelected` props, `FormData.get(...)` silently returns `null`, breaking household creation, event recording, bill creation, and edit modals.
**How to avoid:** Check `name`, `defaultValue`, and `defaultSelected` support in `04-01-PLAN.md` (`D-16` Task 1) and add a unit/e2e assertion for `Household.tsx` `FormData` submission.

### Pitfall 2: React Aria `Select` Role Change (`combobox` -> `button`) in E2E
**What goes wrong:** Native `<select>` has ARIA role `combobox`, whereas React Aria `<Select>` trigger `<Button>` has `role="button"` (`aria-haspopup="listbox"`). Existing tests query `getByRole('combobox', { name: 'Savings rate goal' })` (`dashboard.spec.ts:103`), `Budget currency` / `Currency` (`currencies.spec.ts:18,31,41,126`), `Paid to` / `Household` (`household.spec.ts:382,939`), `Category details` (`review.spec.ts:96`), `Category for Mock Splurge` (`review-undo.spec.ts:126,151`), and `Category for Paid Sam back` (`household-categories.spec.ts:73`, which also calls `.toHaveValue()`).
**How to avoid:** Update desktop selectors to `getByRole('button', ...)` (or `getByLabel(...)` + `getByRole('option', ...)` / `toContainText`), while leaving phone tests (`amounts-phone.spec.ts:73`, `dashboard-viewport.spec.ts:45`) untouched because phone renders native `<select>` (`D-04`).

### Pitfall 3: `TagManager.tsx` Invisible Colour Swatch `<select>`
**What goes wrong:** `TagManager.tsx:51-65` overlays an `opacity-0` `<select>` on top of a `16×16 px` (`h-4 w-4`) colour circle. Replacing it naively with a full-width `h-10` shared `<Select>` trigger breaks the compact tag row layout and violates `D-03`.
**How to avoid:** Either check in `04-01-PLAN.md` whether shared `Select` supports a `trigger` / `renderValue` / compact swatch className (adding its gallery state if needed per Claude's Discretion), or record it as a `D-17` audit native exception if the audit already classified it so.

### Pitfall 4: Duplicate `allotment` Plugin Definition & `no-restricted-syntax` Collision in `lint/eslint.config.js`
**What goes wrong:** Defining `plugins: { allotment: { rules: { ... } } }` in two separate flat-config blocks throws `Cannot redefine plugin "allotment"` in ESLint 9. Similarly, adding a second `no-restricted-syntax` rule block replaces `lint/eslint.config.js:55`'s `toISOString()` restriction.
**How to avoid:** Define the `allotment` plugin object once in `lint/eslint.config.js` containing both `icon-only-control` and `no-raw-form-control`, and enable `'allotment/no-raw-form-control': 'error'` in a block with `ignores: ['**/*.test.tsx', 'client/src/components/ui/**']`.

### Pitfall 5: `CommandPalette.tsx` and `AuthGate.tsx` Attribute Stripping
**What goes wrong:** `CommandPalette.tsx:370` uses `ref={inputRef}`, `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `onKeyDown`; `AuthGate.tsx:363` uses `onPaste`, `spellCheck={false}`, `autoComplete="one-time-code"`; `ReminderSettings.tsx:115` uses `autoCapitalize="none"`. If Phase 2's `Input` puts `...props` on `<TextField>` instead of `<Input>`, those props are dropped or fail `tsc`.
**How to avoid:** Verify `ui/Input.tsx` passthrough in `04-01-PLAN.md` (`D-16`); keep `CommandPalette` as shared `<Input>` (once verified) or explicit `D-17` allowlist entry if `role="combobox"` conflicts with `TextField`.

### Pitfall 6: `jsx-a11y/label-has-associated-control` `controlComponents` Stale Entry
**What goes wrong:** `lint/eslint.config.js:126` lists `'Select'` in `controlComponents` because old `ui/Input.tsx` `Select` rendered a native `<select>`. Once G5 removes old `Select` and screens use React Aria `Select` (which uses `<Label elementType="span">`), keeping `'Select'` in `controlComponents` misleads future authors into wrapping `<Select>` in `<label>` (producing `strayLabels` accessibility failures).
**How to avoid:** Remove `'Select'` from `controlComponents` in `lint/eslint.config.js:126` in G5 alongside deleting `Select` from `ui/Input.tsx`.

## Code Examples

### Example 1: Custom ESLint 9 Rule (`lint/rules/no-raw-form-control.js`) + Test (`RuleTester`)
```js
// Source: Modeled on lint/rules/icon-only-control.js & lint/rules/icon-only-control.test.js [VERIFIED]
// and ESLint 9 JSXElement RuleTester docs [CITED: eslint.org]
const RAW_CONTROLS = new Set(['input', 'select', 'textarea']);

function isFileInput(opening) {
  return opening.attributes.some(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name.name === 'type' &&
      attr.value?.type === 'Literal' &&
      attr.value.value === 'file',
  );
}

export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                element: { enum: ['input', 'select', 'textarea'] },
                reason: { type: 'string' },
              },
              required: ['file', 'element', 'reason'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawControl:
        'Use a shared control from components/ui/ instead of raw <{{name}}> (Wave G, WAVG-09).',
    },
  },
  create(context) {
    const allow = context.options[0]?.allow ?? [];
    const filename = context.filename.replaceAll('\\', '/');
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;
        if (!RAW_CONTROLS.has(name)) return;
        if (name === 'input' && isFileInput(node)) return;
        if (allow.some((entry) => entry.element === name && filename.endsWith(entry.file))) return;
        context.report({ node, messageId: 'rawControl', data: { name } });
      },
    };
  },
};
```

### Example 2: `WAVG-08` Search-Based Vitest Test (`client/src/utils/noNumberMoney.test.ts`)
```ts
// Source: Modeled on client/src/utils/movedSections.test.ts:66-85 [VERIFIED]
import { describe, expect, it } from 'vitest';

function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('WAVG-08: no money input uses type="number"', () => {
  it('forbids type="number" across client/src (or matches only non-money allowlist)', () => {
    const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const hits: string[] = [];
    for (const [file, content] of Object.entries(sources)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const clean = withoutComments(content);
      if (/\btype\s*=\s*(?:["']number["']|\{\s*["']number["']\s*\})/.test(clean)) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});
```

## State of the Art

| Old Approach | Current Approach (Wave G) | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| Wave E rule: `CategoryPicker` for categories, native styled `Select` (`ui/Input.tsx`) for short fixed lists (`HANDOVER-UI.md:127-128`) | Wave G (`D-05`, `D-06`): `CategoryPicker` for categories, `PayeeCombobox` for payees, React Aria `Select` (fixed lists) / `Combobox` (user-grown lists) on desktop; native pickers `< 768 px` | `02-CONTEXT.md` (16 Nov 2026) | `Select` in `ui/Input.tsx` is deleted in G5; desktop e2e `selectOption` calls migrate to trigger + `role="option"`. |
| Ad-hoc `<input>`, `<select>`, `<textarea>`, `type="date"`, `type="month"`, `type="number"` across screens | All screens use shared `components/ui/` controls; ESLint `allotment/no-raw-form-control` enforces error gate outside `components/ui/` | Phase 4 (`WAVG-07`–`WAVG-10`) | Prevents regressions; burns down `jsx-a11y` warnings below `128`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 2's shipped `components/ui/` controls (`Select`, `DatePicker`, `MonthPicker`, `Checkbox`, `Input`, `Textarea`) will support or can be extended in `04-01` to support `name` + `defaultValue`/`defaultSelected` (`FormData`) and HTML passthrough attributes (`autoComplete`, `spellCheck`, `inputMode`, `autoCapitalize`, `onPaste`, `list`, `role`, `aria-*`, `ref`). | Architecture Patterns §§2–3 | If `ui/Input` wraps `TextField` without forwarding `inputProps`, `AuthGate`, `UpConnectModal`, `CommandPalette`, `Assets` (`list=`), or `Household` `FormData` forms will fail `tsc` or drop attributes until `ui/` components are extended in `04-01`. |
| A2 | Phase 3 (G2 and G3) will migrate `components/settings/CategoryManager.tsx`, `DeleteCategoryModal.tsx`, `EditCategoryModal.tsx` (mounted by `/budget/categories`), plus cross-boundary transaction callers (`ShareWithHousehold.tsx`, `TaxClaimSection.tsx`, `ReceiptsSection.tsx`, `CurrencySelect.tsx` if touched by Accounts), and the 9 Phase 3 `type="number"` occurrences. | Architecture Patterns §§1, 4 | If Phase 3 leaves any of those files unmoved, `WAVG-09` (`no-raw-form-control`) will fail lint in G5 until `04-01` (`D-16` Task 1) catches and assigns them to G4. |
| A3 | `e2e/tests/server-mode/auth.spec.ts:94-96,351-353` (`getByRole('textbox', { name: 'Current password' })`) continues matching React Aria `<Input type="password">` in Chromium. | E2E Impact Matrix | Low risk — React Aria `Input` renders a native `<input type="password">`, same as incumbent `<input type="password">`. Verify in `server-mode` e2e run. |

## Open Questions (RESOLVED)

1. **(RESOLVED) Will `CurrencySelect.tsx` (`~150` currencies) and `ConnectEnableBankingModal.tsx:357` (`Country`) be classified as `Combobox` (searchable) or `Select` (fixed list) in the WAVG-01 audit?**
   - What we know: `D-06` says `"Lists the user grows ... are a searchable Combobox. Fixed lists ... are a plain Select. The audit classifies each list as one or the other."` Both currencies and EEA countries are fixed lists, though ~150 currencies benefit from search.
   - Recommendation: Follow the WAVG-01 audit classification verbatim at `04-01-PLAN.md` Task 1 (`D-16`).
   - RESOLVED: the audit is binding (D-06). 04-01 Task 1 item (3a) records the audit's class for Enable Banking's Country (04-18 plans Select) and checks CurrencySelect.tsx under item (3) (Phase 3, 03-04); a plan that differs from the audit makes the record `G4 reconcile: revise` and halts G4 until the plan follows the audit.

2. **(RESOLVED) Should `Housekeeping.tsx:191` (`Category for ${s.name}`) and `CurrencyDifference.tsx:83` (`Category`) use `CategoryPicker` (`D-05`) or `Select` (`D-09`)?**
   - What we know: Both choose from budget categories; `CurrencyDifference.tsx` filters to income vs spending groups and allows `"No category (net worth only)"`, while `Housekeeping.tsx` maps all categories as `"Group: Name"`.
   - Recommendation: Use `CategoryPicker` (`D-05` picker rule) unless the WAVG-01 audit explicitly marks them `Select`. Verify in `04-01` Task 1 (`D-16`).
   - RESOLVED: 04-08 Task 1 makes Housekeeping's saver category CategorySelectButton over CategoryPicker (D-05); CurrencyDifference.tsx belongs to Phase 3 (03-04). 04-01 Task 1 item (3a) records the audit's class for both and halts G4 with `G4 reconcile: revise` if the audit says Select.

3. **(RESOLVED) What happens to `docs/ui/WAVES.md` at G5 close?**
   - What we know: `docs/ui/WAVES.md:5-6` says `"delete this file when Wave G has merged (owner, 15 November 2026)"`, while `04-CONTEXT.md` Claude's Discretion says `"docs/ui/WAVES.md gets Wave G's record if that is how earlier waves were closed."`
   - Recommendation: Update `docs/ui/WAVES.md` with Wave G's G0–G5 status during G4/G5, and ask the owner at G5 PR merge whether to delete `docs/ui/WAVES.md` then or in a follow-up chore.
   - RESOLVED (the plan differs from this recommendation): the owner was asked before G4 starts, with `delete-in-g5` recommended because the file carries the owner's own 15 November note to delete it when Wave G merges, and 04-15 needs the answer before it opens the G5 PR. The owner answered on 19 Nov 2026, "i agree with phase 4 decisions" (STATE.md Decisions): delete-in-g5. 04-01 Task 2 records it as `WAVES.md at Wave G close: delete-in-g5` without asking again; 04-15 Task 2 deletes the file (moving the traps still true to HANDOVER-UI.md) and Task 3 removes HANDOVER.md's mentions of it before the G5 PR.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | CI parity, client Safe mode unit tests (`WAVES.md`, `.github/workflows/ci.yml:32`) | ✓ | `v24.10.0` (`/opt/homebrew/opt/node@24/bin/node`; default PATH has `v22.19.0`) | Prepend `/opt/homebrew/opt/node@24/bin` to `PATH` |
| Python 3 | `npm run release:prepare` (`scripts/prepare-release.py`) | ✓ | System `python3` | — |
| `node_modules` in worktree | `vitest`, `tsc`, `eslint`, `playwright` | ✗ (fresh worktree) | — | Run `npm ci` in `client/`, `server/`, `e2e/`, `lint/` before executing verification |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Worktree `node_modules` are absent on fresh checkout; run `npm ci` (respecting `.npmrc` `ignore-scripts=true`) with Node 24 on `PATH`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Client: `vitest` `^5.0.4` (`[VERIFIED: client/package.json:41]`); Lint: `eslint` `^9.39.5` + `node --test` (`[VERIFIED: lint/package.json:10,14]`); E2E: `@playwright/test` `1.64.0` (`[VERIFIED: e2e/package.json:12]`) |
| Config file | `client/vite.config.ts` / `client/package.json`; `lint/eslint.config.js`; `e2e/playwright.config.ts` |
| Quick run command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint)` |
| Full suite command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit && npm run build) && (cd server && npx tsc --noEmit && npm test) && (cd lint && npm test && npm run lint) && npm run format:check && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode && npm test -- --project=gallery)` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVG-07 | Settings, bank connections, Review, CashFlow, Household, Tax, and D-13 screens use shared controls with unchanged behaviour, `D-20` attrs, `useCanSave`, Safe mode, and 390 px layout | E2E (Playwright `desktop`, `phone`, `demo`, `server-mode`) | `cd e2e && npm test -- --project=desktop tests/settings.spec.ts tests/currencies.spec.ts tests/resilience.spec.ts tests/up.spec.ts tests/switchers.spec.ts tests/enable-banking.spec.ts tests/dashboard.spec.ts tests/home-cards.spec.ts tests/payment-plans.spec.ts tests/review.spec.ts tests/review-undo.spec.ts tests/household.spec.ts tests/household-categories.spec.ts tests/depreciating-assets.spec.ts tests/receipts-tax.spec.ts tests/tax-car-home.spec.ts tests/investments.spec.ts tests/cash-flow.spec.ts tests/command-palette.spec.ts tests/accessibility.spec.ts` + `--project=server-mode` + `--project=phone` + `--project=demo` | ✅ Existing specs (updated for desktop `Select`/`DatePicker`/`MonthPicker` selectors) |
| WAVG-08 | `NewPlanModal` enforces `instalmentCount` `1..60` without `type="number"`, and no money input uses `type="number"` anywhere in `client/src` | Unit (`vitest`) | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client -- src/utils/noNumberMoney.test.ts` (+ plan count validation test) | ❌ Wave 0 (`noNumberMoney.test.ts` + `NewPlanModal` test) |
| WAVG-09 | `allotment/no-raw-form-control` errors on raw `<input>`/`<select>`/`<textarea>` outside `components/ui/` (allowing `type="file"` and `D-17` list); `--max-warnings` lowered/kept | Unit (`node --test` `RuleTester`) + Lint | `(cd lint && npm test && npm run lint)` | ❌ Wave 0 (`lint/rules/no-raw-form-control.js` + `.test.js`) |
| WAVG-10 | Removed `Select` in `ui/Input.tsx` and legacy pickers have zero remaining imports/references; docs updated; gallery + full e2e pass | Search check + Typecheck + Build + Full E2E | `(cd client && npx tsc --noEmit && npm run build) && (cd e2e && npx tsc --noEmit && npm test -- --project=gallery)` | ✅ Gallery test (Phase 2); search check in G5 |

### Sampling Rate
- **Per task commit:** `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint)` (plus targeted e2e spec for the area moved).
- **Per PR merge (G4 and G5):** Full client/server/lint/format/e2e sequential verification (`desktop`, `phone`, `demo`, `server-mode`, `gallery` — never parallel e2e runs because `e2e/ports.ts` ports are fixed, and never `E2E_SKIP_BUILD=1`), plus `.ui-evidence/<date>-wave-g4/` and `-wave-g5/` screenshots.
- **Phase gate:** Full CI green (`CI passed` job) and Codex review clear before merging G4, then before merging G5.

### Wave 0 Gaps
- [ ] `client/src/utils/noNumberMoney.test.ts` — source-scan Vitest guard proving zero money fields (and zero unallowlisted fields) use `type="number"` (`WAVG-08`)
- [ ] Failing-first unit/e2e check for `NewPlanModal` `instalmentCount` (`1..60`) when moving off `type="number"` (`D-14`)
- [ ] `lint/rules/no-raw-form-control.js` and `lint/rules/no-raw-form-control.test.js` — custom ESLint rule + `RuleTester` allowed/refused tests (`WAVG-09`)
- [ ] `fillMonth` e2e helper in `e2e/tests/fixtures.ts` (if Phase 2 built only `fillDate`) for `BudgetStartSettings` in `e2e/tests/settings.spec.ts:431`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Preserve `AuthGate.tsx` & `ServerSettings.tsx` `type="password"`, `autoComplete` (`username`, `current-password`, `new-password`, `one-time-code`), `spellCheck={false}`, `inputMode="numeric"`, and `codeFromPaste` (`D-20`, `SECURITY.md`). |
| V3 Session Management | no | No session/cookie/token-verification changes (client-only). |
| V4 Access Control | no | No route or access-token policy changes (`REQUIREMENTS.md:9-10`). |
| V5 Input Validation | yes | Preserve Zod-aligned bounds (`NewPlanModal` `instalmentCount` `1..60`), `isoDate` (`YYYY-MM-DD`), `isoMonth` (`YYYY-MM`), `maxLength` caps, and bank token validation hints (`UpConnectModal`, `EnableBankingSetupForm`). |
| V6 Cryptography | no | No key generation or encryption logic changes. |

### Known Threat Patterns for Auth & Bank Credential Fields (`D-20`, `SECURITY.md`)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shoulder-surfing / secret exposure if `type="password"` is dropped during `Input` swap | Information Disclosure | Explicitly test/assert `type="password"` stays on `AuthGate.tsx:393,409`, `ServerSettings.tsx:419,436,453`, `UpConnectModal.tsx:276`, `PlaidConfigForm.tsx:73`, and `PlaidSetupModal.tsx:106` (`D-20`). |
| Password-manager / autofill breakage from altered `name` or `autoComplete` | Authentication / Spoofing | Preserve exact `id`, `name`, `autoComplete`, `inputMode`, `spellCheck` attributes when moving to shared `Input`. |
| Credential leakage in tests, logs, or screenshots | Information Disclosure | Mock tokens/passwords only in tests; never log request bodies or secret fields (`SECURITY.md:263-274`). |

## Sources

### Primary (HIGH confidence — verified in repo)
- `docs/superpowers/gsd-records/phases/04-remaining-screens-and-the-guard/04-CONTEXT.md` (D-01 to D-22, Claude's Discretion)
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md` (D-12 to D-17)
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md`, `02-RESEARCH.md`, `02-UI-SPEC.md`, `02-PATTERNS.md`
- `docs/superpowers/gsd-records/ROADMAP.md`, `docs/superpowers/gsd-records/REQUIREMENTS.md`, `docs/superpowers/gsd-records/STATE.md`, `CLAUDE.md`, `AGENTS.md`, `SECURITY.md`, `gh issue view 267`
- `client/src/pages/{Settings,AccountConnections,BudgetCategories,Welcome,Review,CashFlow,Household,Tax,PaymentPlans}.tsx`
- `client/src/components/{accounts/ConnectedBanks,auth/AuthGate,currency/*,dashboard/*,enablebanking/*,household/*,layout/CommandPalette,plaid/*,plans/*,review/*,settings/*,simplefin/*,tax/*,transactions/CategorySelect*,transactions/MerchantSelect,ui/Input,ui/Slider,up/*}.tsx`
- `server/src/{routes/paymentPlans,routes/schedules,routes/rules,services/targetConfig,services/paydayConfig,services/forecastConfig,services/longTermConfig}.ts`
- `lint/{eslint.config.js,package.json,README.md,rules/icon-only-control.js,rules/icon-only-control.test.js,terms/terms.test.js}`
- `client/src/utils/movedSections.test.ts`, `DESIGN.md`, `docs/ui/{MAP,HANDOVER-UI,WAVES,README}.md`, `docs/DEVELOPMENT.md`, `.github/workflows/ci.yml`
- `e2e/tests/{accessibility,dashboard,currencies,depreciating-assets,enable-banking,fixtures,home-cards,household,household-categories,investments,multi-user/people,payment-plans,receipts-reader,receipts-tax,resilience,review,review-undo,server-mode/auth,settings,switchers,tax-car-home,up}.spec.ts`

### Secondary (MEDIUM confidence — official docs via web search)
- Adobe React Aria documentation (`react-spectrum.adobe.com`): `TextField`, `Input`, `Select`, `DatePicker` form integration (`name`, `defaultValue`, `autoComplete`, `inputMode`, `spellCheck`).
- ESLint 9 documentation (`eslint.org`): flat config `no-restricted-syntax` vs custom `JSXOpeningElement` rules and `RuleTester` `languageOptions`.

## Metadata

**Confidence breakdown:**
- Area inventory & `type="number"` / Zod caps: HIGH — every file, line, element, and server schema read directly in `worktree-agent-p04-researcher` (and confirmed identical to `/Users/tristanvanrooyen/wt-f/client/src`).
- Lint rule (`WAVG-09`) & removal/doc scope (`WAVG-10`): HIGH — `lint/eslint.config.js`, `icon-only-control`, `package.json`, `DESIGN.md`, `MAP.md`, `HANDOVER-UI.md` directly inspected.
- Shared control prop forwarding & Phase 3 completion boundary: MEDIUM — Phase 2 and Phase 3 are **planned, not shipped**, gated on `D-16` Task 1 verification.

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 (re-verify via `D-16` Task 1 once Phases 2 and 3 merge to `redesign`)
