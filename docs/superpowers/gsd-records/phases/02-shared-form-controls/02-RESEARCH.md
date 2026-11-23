# Phase 2: Shared form controls - Research

**Researched:** 2026-11-16
**Domain:** Client form controls (`react-aria-components`, `@internationalized/date`, Tailwind CSS v4 `@theme` tokens, Playwright visual baselines, TypeScript AST UI audit)
**Confidence:** HIGH (codebase facts and design tokens verified from repository files; React Aria v1.22.1 / Playwright v1.64.0 APIs cited from official docs, with runtime Modal/Escape and screenshot-diff thresholds flagged in Assumptions Log for browser verification)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The set is built on `react-aria-components`, which is already a dependency (`client/package.json`, used by `ui/DatePicker.tsx` and `budget/ExpectedNote.tsx`). No Radix, no Base UI, no `cmdk`, and no shadcn source is copied in. #267's statement that no headless library is installed is out of date. One library does the keyboard and screen-reader work for every control.
  — **Reversibility:** costly — every shared control and both picker wrappers are written against React Aria's API; changing library means rewriting the set.
- **D-02:** No new package arrives in Wave G. `class-variance-authority`, `clsx` and `tailwind-merge` are not added. Variants are plain class maps, as `ui/Button` and the other shared components do today; React Aria's state is styled through its data attributes with Tailwind 4. Success criterion 5 ("any new package approved in decision 1") is therefore met by adding none; the lockfile changes only if `react-aria-components` itself needs a bump.
- **D-03:** The look is today's field look, made consistent: the current border, `rounded-md` and brand focus ring, applied to every control, with one height scale. It is not a restyle to shadcn's proportions. The required fixes still land: a disabled Switch reads as disabled (#264), placeholder text meets 4.5:1, and disabled, invalid and read-only looks are the same everywhere.
- **D-04:** One component API on every device. On phones (the existing `useIsPhone` rule, under 768 px) Select, DatePicker and MonthPicker render the native `<select>`, date input and month input, so the OS wheel and calendar open. Desktop gets the custom popover. `ui/DatePicker.tsx` already works this way and is the model.
- **D-05:** On desktop the shared custom Select replaces Wave E's rule that short lists use the styled native Select. The picker rule from now on: categories use `CategoryPicker`, payees use `PayeeCombobox`, and every other list uses the shared Select or Combobox per D-06.
  — **Reversibility:** costly — desktop e2e tests that use `selectOption` on these lists change to the listbox pattern across Phases 3 and 4.
- **D-06:** Searchable or not is decided by the kind of list, not its length. Lists the user grows (accounts, tags, households, people and the like) are a searchable Combobox. Fixed lists (frequency, type, sort order and the like) are a plain Select. The same field has the same form in every budget. The audit classifies each list as one or the other.
- **D-07:** The 47 `type="date"` fields move to the shared DatePicker in this milestone, each with its screen in Phases 3 and 4. Phase 2 builds the control and the shared e2e way to fill it; it does not move screens. Wave G ends with one date control, and the Phase 4 lint rule covers dates.
  — **Reversibility:** costly — every e2e test that fills a date input is rewritten onto a shared helper.
- **D-08:** On desktop a date can be typed or picked, as `ui/DatePicker.tsx` works today: typeable day, month and year segments in the owner's date-format preference, plus a calendar button that opens the popover. The popover gains a Today shortcut. Values stay `YYYY-MM-DD` strings (`isoDate`); displayed dates go through `client/src/utils/dates.ts`.
- **D-09:** Every screen moves onto the shared controls, but the shelved pages (Review, Cash flow, Household) and the split candidates (`Household.tsx`, `Tax.tsx`, `CashFlow.tsx`) get a like-for-like swap only: no layout, wording or structure change. This is what Phase 4's success criterion 1 already assumes.
- **D-10:** Phase 2 ships as two PRs to `redesign`. First the audit and its screenshots, as a documentation-only PR with no version bump. Then the component set, the gallery, the screenshot test and the `CategoryPicker` and `PayeeCombobox` rewiring together, with the next `0.2.0-up.N`. **The set PR does not start until the owner has read the audit and said go.** The owner may change any decision here if the audit shows something unexpected. The planner places a blocking owner checkpoint between the two.
- **D-11:** MonthPicker is an eleventh shared control in the set PR, with the same states, gallery entry and phone rule as DatePicker (native month input on phones). The owner added it on 16 Nov 2026, beyond WAVG-02's original list; WAVG-02 in `docs/superpowers/gsd-records/REQUIREMENTS.md` is amended to match. Whether `MonthRangePicker` is rebuilt on it or only restyled is the planner's call after the audit.

### Claude's Discretion
- **`budget/ExpectedNote.tsx`** (the other React Aria user): move it onto the shared set in this phase or leave it for Budget's move in Phase 3. Decide once the audit shows what it uses.
- **Gallery and screenshot test mechanics:** the route, how it is kept out of production builds, and how screenshot baselines are kept stable in CI. e2e ports are fixed, so one browser run at a time.
- **How "unchanged behaviour" of the picker wrappers is proven:** the existing e2e suites must pass; any changed selector carries its reason in the PR.
- **Exact height scale, Field layout (label, help text, error text, required mark) and the Today shortcut's placement:** left to the UI spec (`/gsd-ui-phase`, with `/impeccable`) within D-03.
- **Who runs the audit:** #267 names Antigravity; the Herdr dispatcher allocates the worker.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (The three.js goal bloom from Phase 1's deferred list stays an idea only; D-02 adds no package in Wave G.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVG-01 | Read-only audit of every field and selector in `client/src` by file and line (what it chooses, element/component, states, accessible name, e2e selectors, one-off styles) + screenshots of each control type at 1280 and 390 px in light and dark. | Automated TypeScript AST scanner + e2e selector cross-reference + D-06 list classification + `.ui-evidence/<date>-wave-g0/` Playwright capture workflow; ships as doc-only PR 1 before owner checkpoint (D-10). |
| WAVG-02 | `client/src/components/ui/` holds one shared Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, DatePicker, MonthPicker (D-11), Label and Field styled only from `@theme` tokens; `CategoryPicker` and `PayeeCombobox` become thin wrappers over Combobox with unchanged behaviour; disabled Switch reads as disabled (#264); placeholder text >= 4.5:1 contrast. | `react-aria-components@1.22.1` + Tailwind v4 `data-[...]:` variants (no plugin); `text-tertiary` for placeholders (5.63:1 light / 6.26:1 dark vs `text-disabled` 3.34:1 / 3.16:1); React Aria `Autocomplete` + `TextField` + `ListBox` inside `Popover` for `CategoryPicker` and `ComboBox` for `PayeeCombobox`. |
| WAVG-03 | Every shared control follows its WAI-ARIA keyboard and screen-reader pattern with a visible focus ring, has 44 px touch targets on phones, and on phones opens the OS picker (D-04). | React Aria handles APG keyboard/ARIA patterns (`Select`, `ComboBox`/`Autocomplete`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`) on desktop; `useIsPhone()` (`max-width: 767px`) switches `Select`, `DatePicker`, and `MonthPicker` to native `<select>`, `<input type="date">`, `<input type="month">` with `min-h-11` and `text-base` (16 px). |
| WAVG-04 | A development-only gallery page shows every shared control in every state, and a Playwright screenshot test over it runs in CI. | Dedicated route (e.g. `/dev/controls`) outside `AppShell`/`AuthGate`, stripped from production/electron/demo builds via a `vite.config.ts` `resolveId` swap (`--mode gallery` + `import.meta.env.DEV`), served on a new fixed port in `e2e/ports.ts`, tested with Playwright `toHaveScreenshot` using Linux baselines. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` (verified byte-identical to `AGENTS.md` in worktree root):
- **Client-only phase, no server changes:** Wave G is client-only (`REQUIREMENTS.md:9-10`: `"Every requirement here is client-only: no server route, allowlist, /api/assistant/do or MCP change."` `[VERIFIED: docs/superpowers/gsd-records/REQUIREMENTS.md:9-10]`). Never touch `server/`, access-token allowlists, or `/api/assistant/do`.
- **Tokens only from `@theme`:** `[VERIFIED: docs/ui/README.md:16]` — `"client/src/index.css @theme is the single source of design tokens (light and dark roles)."` No inline hex/rgb values or shadow/radius inventories outside `client/src/index.css`.
- **Dates & money invariants:**
  - Money stays integer minor units and uses `CurrencyInput` (`type="text" inputMode="decimal"`), never `type="number"`. `[VERIFIED: CLAUDE.md §Review guidelines]`
  - Dates are real `YYYY-MM-DD` (`isoDate`, `isoMonth`); displayed dates go through `client/src/utils/dates.ts`; never slice `toISOString()` for calendar days (`lint/eslint.config.js:55-63` errors on it). `[VERIFIED: lint/eslint.config.js:48-64]`
- **Dependencies:** Use lockfiles; `.npmrc` disables install scripts (`"Dependencies use lockfiles and .npmrc with install scripts disabled. Do not disable that guard."` `[VERIFIED: CLAUDE.md §Verification]`). D-02 adds zero new packages.
- **Verification & tooling:**
  - Node 24 required (Node 26 breaks 11 client Safe mode tests; CI uses `node-version: 24` `[VERIFIED: .github/workflows/ci.yml:32]`).
  - Never set `E2E_SKIP_BUILD=1` (`[VERIFIED: docs/ui/HANDOVER-UI.md:160]` — `"E2E_SKIP_BUILD=1 reuses the last client build; run once without it after changing UI text."`).
  - e2e ports are fixed in `e2e/ports.ts`, so run one browser suite at a time.
  - Prettier formatting: `npm run format:check` runs in CI (`[VERIFIED: .github/workflows/ci.yml:94]`).
  - Lint warning cap: `lint/package.json:8` enforces `"eslint -c lint/eslint.config.js --max-warnings=128 client/src server/src"` `[VERIFIED: lint/package.json:8]`. (Note: `02-CONTEXT.md`, `STATE.md`, and `REQUIREMENTS.md` still mention `135`, which was the pre-Wave-F cap before Wave F burned 7 warnings down to `128`.) The cap may go down or stay, never up.
- **Client UI checks:** Interactive controls must have accessible names (`allotment/icon-only-control` is an error in `lint/eslint.config.js:83`); layouts hold at 390 px with no sideways scroll; Safe mode, demo, offline, and server mode keep working; save buttons respect `useCanSave` / `<SavingPausedHint />`.
- **Two-PR release rule (D-10):**
  - PR 1 (G0 audit + screenshots): documentation-only PR to `redesign` (`--repo tvrooi/Allotment`), **no version bump**, screenshots in git-ignored `.ui-evidence/<date>-wave-g0/` attached to PR/issue.
  - Blocking owner checkpoint before PR 2 begins.
  - PR 2 (G1 set, gallery, screenshot test, `CategoryPicker`/`PayeeCombobox` rewiring): runs `npm run release:prepare -- <next 0.2.0-up.N>`, updates `CHANGELOG.md`, `docs/ui/HANDOVER-UI.md`, and `docs/ui/MAP.md`, and is reviewed at the HIGH tier because it changes shared components (`ROADMAP.md:89`).

## Summary

Phase 2 covers Wave G steps G0 (`WAVG-01`) and G1 (`WAVG-02` through `WAVG-04`). It is strictly client-only and ships as two sequential PRs to `redesign` separated by a blocking owner review checkpoint (`D-10`). First, G0 produces a complete read-only audit of every field and selector in `client/src` (around 490+ raw and wrapped call sites across 310 `.tsx` files) plus light/dark screenshots at 1280 px and 390 px. Second, after the owner approves the audit, G1 builds the eleven shared UI controls (`Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `MonthPicker`, `Label`, `Field`) in `client/src/components/ui/` on top of the already-installed `react-aria-components` (`1.22.1`), rewires `CategoryPicker` and `PayeeCombobox` onto the shared `Combobox`, fixes disabled `Switch` styling (`#264`) and placeholder contrast (`>= 4.5:1`), adds a dev-only gallery route, and adds a Playwright screenshot test in CI.

Codebase inspection surfaced four critical constraints the planner must account for upfront. First, `lint/tokens/contrast.test.js` proves `text-tertiary` passes 4.5:1 in both themes (`5.63:1` light, `6.26:1` dark on `surface`), while `text-disabled` fails (`3.34:1` / `3.16:1`) and is currently used for placeholders in `CurrencyInput.tsx`, `AddTransactionModal.tsx`, `MerchantSelect.tsx`, and `TransactionFormRow.tsx`. Second, rewiring `PayeeCombobox` onto React Aria `ComboBox` changes its input role from `textbox` to `combobox`, which breaks 5 existing e2e selectors (`getByRole('textbox', { name: 'Payee' })`), and rewiring `CategoryPicker` onto a React Aria `ListBox` changes option roles from `button` to `option` (affecting `transactions.spec.ts`, `review.spec.ts`, `payees.spec.ts`) — and `CategoryPicker` must preserve auto-highlighting the first filtered option so `fill('Groceries')` + `Enter` works without `ArrowDown`. Third, React Aria `DatePicker` does not natively support `granularity="month"` input segments, so `MonthPicker` should use React Aria `DialogTrigger` + `Popover` + `Dialog` with a keyboard-accessible month grid on desktop and `<input type="month">` on phones. Fourth, `e2e/global-setup.ts` builds production Vite bundles (`--mode electron`, default web, `--mode demo`), so the gallery needs a dedicated Vite mode (`--mode gallery`) + `resolveId` module swap (mirroring `withoutDemoWorker()` in `client/vite.config.ts`) and Linux baseline screenshots generated consistently for `ubuntu-latest` CI.

**Primary recommendation:** Build PR 1 (`docs/ui/FORM-CONTROLS-AUDIT.md`) using a TypeScript AST audit script and one-off Playwright capture into `.ui-evidence/`; after owner sign-off, build PR 2 with `react-aria-components@1.22.1` + Tailwind v4 `data-[...]:` variants, `Autocomplete` + `TextField` + `ListBox` inside `Popover` for `CategoryPicker`, a standalone `/dev/controls` gallery route swapped out of all non-gallery builds via `client/vite.config.ts`, and Linux Playwright baselines.

## Architectural Responsibility Map

Phase 2 is client-only (`REQUIREMENTS.md:9-10`). No API routes, database schemas, or server services are created or modified.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| G0 control inventory & screenshot capture (WAVG-01) | Tooling / Docs (`docs/ui/`, `.ui-evidence/`) | Browser / Client (read-only inspection) | Enumerates existing TSX files and captures incumbent UI; zero runtime code changes. |
| 11 shared form controls + `CurrencyInput` placeholder fix (WAVG-02, WAVG-03) | Browser / Client (`client/src/components/ui/`) | — | Owns DOM semantics, React Aria WAI-ARIA state, `@theme` token styling, and `useIsPhone()` branching. |
| `CategoryPicker` & `PayeeCombobox` wrappers (WAVG-02) | Browser / Client (`client/src/components/transactions/`) | — | Thin adapters mapping existing caller props (`CategoryGroup[]`, `transferAccounts`, `Payee[]`, `useCreateCategory`) onto shared `Combobox`. |
| Dev-only control gallery route (WAVG-04) | Browser / Client (`client/src/pages/`, `App.tsx`) + Build (`client/vite.config.ts`) | — | Vite `resolveId` swap removes gallery code from production, electron, and demo bundles. |
| E2E date helper, picker proof, and screenshot CI check (D-07, WAVG-04) | CI / E2E Harness (`e2e/`, `.github/workflows/ci.yml`) | Browser / Client | Verifies ARIA/keyboard/focus/390 px/light+dark visuals against built bundles in CI. |

## Standard Stack

No external packages are installed in Phase 2 (`D-02`). All primitives already exist in `client/package.json` and `e2e/package.json`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-aria-components` | `^1.22.1` (lockfile `1.22.1`) `[VERIFIED: client/package.json:25; client/package-lock.json]` | Headless accessible `Select`, `ComboBox`, `Autocomplete`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `Popover`, `Dialog`, `TextField`, `Input`, `TextArea`, `Label`, `FieldError`, `ListBox` | Locked by D-01; already powers `ui/DatePicker.tsx` and `budget/ExpectedNote.tsx`. |
| `@internationalized/date` | `^3.12.4` (lockfile `3.12.4`) `[VERIFIED: client/package.json:17; client/package-lock.json]` | `CalendarDate`, `parseDate`, `today`, `getLocalTimeZone` for `DatePicker` and `MonthPicker` | Required peer data model for React Aria date/calendar primitives (`DatePicker.tsx:1`). |
| `tailwindcss` + `@tailwindcss/vite` | `^4.0.0` / `^4.3.3` `[VERIFIED: client/package.json:32,38]` | Styling via `@theme` CSS custom properties (`client/src/index.css`) and `data-[...]:` / `group-data-[...]:` variants | Locked by D-02; compiles state attributes natively without `tailwindcss-react-aria-components`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.55.0` `[VERIFIED: client/package.json:22]` | Icons (`ChevronDown`, `Check`, `Minus`, `CalendarDays`, `X`, `Search`, `ChevronLeft`, `ChevronRight`) | Trigger chevrons, check/indeterminate marks, calendar/clear buttons (`aria-hidden` when decorative). |
| `date-fns` | `^4.4.0` `[VERIFIED: client/package.json:21]` | Month label formatting via `utils/dateRange.ts` (`formatMonth`) and `utils/dates.ts` | Display formatting for `MonthPicker` trigger and calendar helpers. |
| `@playwright/test` | `1.64.0` `[VERIFIED: e2e/package.json:12]` | E2E tests and `toHaveScreenshot()` visual baseline checks | Verifies ARIA, keyboard, focus, phone viewports, and gallery screenshots in CI. |
| `vitest` | `^5.0.4` `[VERIFIED: client/package.json:41]` | Client unit tests using `renderToStaticMarkup` (`react-dom/server`) | Static HTML/ARIA/token assertions for shared components (matching `Plant.test.ts`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain template-string class maps + Tailwind v4 `data-[...]:` | `clsx`, `tailwind-merge`, `cva`, `tailwindcss-react-aria-components` | Forbidden by D-02 ("No new package arrives in Wave G"). |
| React Aria `Autocomplete` + `TextField` + `ListBox` inside `Popover` for `CategoryPicker` | Putting `ComboBox` directly inside `Popover` or replacing trigger buttons | Trigger buttons live in 7 callers not moved until Phases 3–4; `ComboBox` forces `role="combobox"` and creates nested popovers if wrapped in `Popover`, whereas `Autocomplete` + `TextField` + `ListBox` keeps `role="textbox"` on search input and renders the list inline inside one `Popover`. |

**Installation:**
None — zero packages added (`D-02`). Run `npm ci` in `client/`, `server/`, `e2e/`, and `lint/` using existing lockfiles (`Node 24`).

**Package Legitimacy Audit:** Skipped — no external packages are added in Phase 2 (`D-02`).

## Architecture Patterns

### System Architecture Diagram

```
+-------------------------------------------------------------------------+
| Caller (Phase 2: Gallery, CategoryPicker, PayeeCombobox, GoalFormModal) |
+------------------------------------+------------------------------------+
                                     | props (value, onChange, label,
                                     | isDisabled, isInvalid, isReadOnly)
                                     v
+-------------------------------------------------------------------------+
| Shared Control Layer (client/src/components/ui/)                        |
| Field / Label / Error / Description + 9 Interactive Controls            |
+------------------+-----------------------------------+------------------+
                   | useIsPhone() === false (>=768px)  | useIsPhone() === true (<768px)
                   | (all controls except              | (Select, DatePicker, MonthPicker)
                   |  native-phone variants)           |
                   v                                   v
+----------------------------------+   +----------------------------------+
| React Aria Components (Desktop)  |   | Native HTML Controls (Phone)     |
| - TextField / Input / TextArea   |   | - <select>                       |
| - Select -> Popover -> ListBox   |   | - <input type="date">            |
| - ComboBox / Autocomplete        |   | - <input type="month">           |
| - DatePicker -> Calendar + Today |   | - min-h-11 (44px) & text-base    |
| - MonthPicker -> Popover Grid    |   +----------------------------------+
| - Checkbox / RadioGroup / Switch |
| - Portals to document.body       |
+------------------+---------------+
                   | styled via @theme tokens (client/src/index.css)
                   v
+-------------------------------------------------------------------------+
| Browser DOM (#root [inert when Modal open] + Portal siblings on <body>) |
+-------------------------------------------------------------------------+
```

### Recommended Project Structure

```
client/src/
├── components/ui/
│   ├── fieldClasses.ts          # Shared base, state, height, and label class strings (@theme tokens)
│   ├── Label.tsx                # Shared Label (wrapping RAC Label / span mode for non-input groups)
│   ├── Field.tsx                # Shared Field layout (Label, help text, FieldError, required mark)
│   ├── Input.tsx                # Shared TextField + Input (keep legacy Select temporarily until Phase 4 WAVG-10!)
│   ├── Textarea.tsx             # Shared Textarea on React Aria TextField + TextArea
│   ├── Select.tsx               # Shared Select (RAC Select on desktop, native <select> on phone)
│   ├── Combobox.tsx             # Shared Combobox (RAC ComboBox + Popover/ListBox; plus PopoverPicker helper if shared with CategoryPicker)
│   ├── Checkbox.tsx             # Shared Checkbox (RAC Checkbox + 44px phone touch area)
│   ├── RadioGroup.tsx           # Shared RadioGroup + Radio (RAC RadioGroup/Radio)
│   ├── Switch.tsx               # Shared Switch on RAC Switch (fixes #264 disabled look)
│   ├── DatePicker.tsx           # Extended with disabled/invalid/readOnly/required + Today shortcut
│   ├── MonthPicker.tsx          # New 11th control (D-11): Popover MonthGrid on desktop, input[type="month"] on phone
│   └── CurrencyInput.tsx        # Update placeholder-text-disabled -> placeholder:text-text-tertiary
├── components/transactions/
│   ├── CategoryPicker.tsx       # Thin wrapper over Combobox / Autocomplete + ListBox + Create-category footer
│   └── PayeeCombobox.tsx        # Thin wrapper over Combobox (allowsCustomValue, menuTrigger="focus")
├── pages/
│   ├── DevControlsGallery.tsx   # Dev-only showcase of all 11 controls in every state + theme toggle
│   └── DevControlsGallery.stub.ts # Empty stub swapped in by vite.config.ts outside dev/gallery builds
```

> **CRITICAL Phase 2 Boundary:** Do NOT remove `Select` from `client/src/components/ui/Input.tsx` in Phase 2 (`WAVG-10` removes it in Phase 4 after all 80 `<Select>` callers migrate). Export the new React Aria `Select` from `client/src/components/ui/Select.tsx` (distinct file) so all 80 existing `import { Select } from '../ui/Input'` callers continue working untouched until Phases 3–4!

### Pattern 1: Styling React Aria States with Tailwind v4 Data Attributes (No Plugin)
**What:** `client/src/index.css` uses `@import 'tailwindcss';` (Tailwind v4) without `tailwindcss-react-aria-components` (`D-02`). Style React Aria state attributes using Tailwind v4's `data-[...]:` and `group-data-[...]:` variants, matching existing `DatePicker.tsx`:
- Focus ring: `focus-within:ring-1 focus-within:ring-brand-600 focus-within:border-brand-600` (inputs/groups) or `data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-brand-600` (buttons/switches/checkboxes/radios).
- Disabled: `data-[disabled]:bg-surface-alt data-[disabled]:text-text-disabled data-[disabled]:border-border-light data-[disabled]:cursor-not-allowed` (on Switch track: `group-data-[disabled]:bg-surface-alt group-data-[disabled]:ring-1 group-data-[disabled]:ring-inset group-data-[disabled]:ring-border` and thumb `group-data-[disabled]:bg-text-disabled`, mirroring `Button.tsx:15-16` `filledDisabled`).
- Invalid: `data-[invalid]:border-negative data-[invalid]:focus:border-negative data-[invalid]:focus:ring-negative` (and `group-data-[invalid]:border-negative`).
- Read-only: `data-[readonly]:bg-surface-alt data-[readonly]:text-text-secondary data-[readonly]:cursor-default` (distinct from disabled: keeps readable contrast and stays in Tab order per `[CITED: react-spectrum.adobe.com]`).
- Placeholders: `placeholder:text-text-tertiary` and `data-[placeholder]:text-text-tertiary` (NEVER `text-disabled` or default browser/Preflight 50% opacity).

**Verified Contrast Ratios (computed directly from `client/src/index.css` `@theme` and `.dark`):**
- `text-tertiary` (`#696765` light / `#aaa39a` dark) on `surface` (`#ffffff` / `#262320`): **5.63:1** (light), **6.26:1** (dark) — PASSES `>= 4.5:1` and is enforced by `lint/tokens/contrast.test.js:39` `[VERIFIED: client/src/index.css:41,52,201,210; lint/tokens/contrast.test.js:39]`.
- `text-disabled` (`#8f8c8a` light / `#766f67` dark) on `surface`: **3.34:1** (light), **3.16:1** (dark) — FAILS `4.5:1` (`[VERIFIED: client/src/index.css:41,53,201,211; lint/tokens/contrast.test.js:8-9]`: `"text-disabled is left out on purpose: it is for disabled controls and icons, which WCAG exempts. Text people need to read uses text-tertiary or darker."`).
- Incumbent violations to fix in Phase 2: `CurrencyInput.tsx:109` (`placeholder-text-disabled` `[VERIFIED: client/src/components/ui/CurrencyInput.tsx:109]`) must become `placeholder:text-text-tertiary`. (Three non-ui files — `AddTransactionModal.tsx:33`, `MerchantSelect.tsx:8`, `TransactionFormRow.tsx:177-178` — also use `placeholder-text-disabled` and will be replaced in Phase 3.)

### Pattern 2: `CategoryPicker` and `PayeeCombobox` Thin Wrappers
**Existing callers & contracts verified in `client/src`:**

1. **`PayeeCombobox.tsx` (`105` lines)** `[VERIFIED: client/src/components/transactions/PayeeCombobox.tsx:1-105]`:
   - **Callers (2):** `TransactionFormRow.tsx:264` (passes `id`, `value`, `onChange`, `payees`, `fieldClassName={pickerField}`) and `TransactionDetailPanel.tsx:528` (passes `id`, `value`, `onChange`, `payees`, `className="border border-border rounded-lg ..."`).
   - **Behaviour to preserve:**
     - Takes `value: { id: string | null; name: string }`, `onChange`, `payees: Payee[]`, `id`, `className`, `fieldClassName`.
     - Displays up to 8 matching payees (`query ? filter(...).slice(0, 8) : payees.slice(0, 8)`).
     - Free-text entry: typing updates `onChange({ id: null, name })` immediately (`allowsCustomValue={true}` in React Aria `ComboBox`); selecting a payee calls `onChange({ id: payee.id, name: payee.name })`.
     - Shows `"New payee: \"<query>\""` hint row in the popover when `query && !exactMatch`.
     - Opens suggestions on focus (`menuTrigger="focus"` in React Aria `ComboBox` `[CITED: react-spectrum.adobe.com]`).
   - **E2E impact:** 5 tests query `getByRole('textbox', { name: 'Payee' })`: `e2e/tests/transactions.spec.ts:27`, `connection.spec.ts:85`, `server-mode/auth.spec.ts:437`, `settings.spec.ts:288`, `rules.spec.ts:85`. React Aria `ComboBox` gives `<Input>` `role="combobox"`, so those selectors must update to `getByRole('combobox', { name: 'Payee' })` (or `getByLabel('Payee')`) with the reason explained in PR 2 (`02-CONTEXT.md` Claude's Discretion).

2. **`CategoryPicker.tsx` (`358` lines)** `[VERIFIED: client/src/components/transactions/CategoryPicker.tsx:1-358]`:
   - **Callers (7):**
     - `TransactionRow.tsx:169` (inline `position="below"`, `transferAccounts`)
     - `TransactionDetailPanel.tsx:483` (inline `fullWidth`, `transferAccounts`)
     - `CategorySelectButton.tsx:70` (inline `position`, `fullWidth`, `transferAccounts`)
     - `DefaultCategoryButton.tsx:43` (`anchor={anchor}`, `noneLabel="No default category"`)
     - `BudgetSummaryWidget.tsx:362` (`anchor={pickerButton}`, `allowNone={false}`)
     - `Review.tsx:381` (`anchor={picker.anchor}`, `allowNone={false}`)
     - `SortUncategorised.tsx:142` (`anchor={button}`, `allowNone={false}`)
     - *(Note: `ReportDetail.tsx:607` `TrendCategoryPicker` is a multi-select checkbox dropdown with `MAX_TREND_CATEGORIES`, NOT `CategoryPicker`.)*
   - **Architecture over React Aria:** Because callers own the trigger `<button>` and pass `anchor?: HTMLElement | null` (or mount inside a `relative` wrapper), `CategoryPicker` cannot use an inline `<ComboBox>` trigger without rewriting all 7 callers (out of scope until Phases 3–4). Instead:
     - Build a reusable popover-picker composition in `Combobox.tsx` (or `ComboboxPopover` / `SearchableList` exported alongside `Combobox`) using React Aria `<Popover>` (portaled to `document.body`, anchored to `triggerRef` when `anchor` is supplied or wrapper ref otherwise, with `z-[60]`) + `<Dialog>` + `<Autocomplete filter={contains}>` + `<TextField aria-label="Search categories"><Input placeholder="Search categories..." autoFocus /></TextField>` + `<ListBox>` with `<ListBoxSection>` / `<Header>` + `<ListBoxItem>` + a `"Create new category"` footer!
     - **Why `<TextField>` instead of `<SearchField>`:** `<SearchField>` sets `type="search"` -> `role="searchbox"`, whereas 6+ e2e tests (`review.spec.ts:33,157`, `review-payees.spec.ts:76,139,187`, `first-import.spec.ts:86,88`, `freshness.spec.ts:29`, `transactions.spec.ts:862,987`, `payees.spec.ts:73,147`) assert `getByRole('textbox', { name: 'Search categories' })`. `<TextField>` + `<Input type="text">` preserves `role="textbox"`!
     - **Why `Autocomplete` virtual focus matters:** `Autocomplete` has `disableAutoFocusFirst={false}` by default `[CITED: react-aria.adobe.com/Autocomplete]`, which automatically virtually-focuses the first filtered item on typing so pressing `Enter` immediately selects it without needing `ArrowDown` (required by `transactions.spec.ts:862-863` and `payees.spec.ts:73-74, 147-148`). Verify in e2e that with an empty search query (`""`), `Enter` does NOT accidentally select `Uncategorised` (`CategoryPicker.tsx:40-42`).
     - **Option roles change (`button` -> `option`):** `ListBoxItem` renders `role="option"` (WAI-ARIA listbox pattern), whereas current `CategoryPicker` renders `<button>` (`transactions.spec.ts:179,561,635`, `review.spec.ts:48,55,56`, `payees.spec.ts:154` use `getByRole('button', { name: ... })`). Updating those e2e selectors to `getByRole('option', ...)` is explicitly permitted by `02-CONTEXT.md` Claude's Discretion with reason in the PR.
     - **Create-category footer:** Kept in `CategoryPicker` inside the `<Popover>` footer below `<ListBox>` (not inside `<ListBox>`), using shared `Select` / `Input` / `Button` (`type="button"` on all buttons so outer `<form>` in `RecurringFormModal` never submits, `recurring.spec.ts:89-95`).

### Pattern 3: `DatePicker` (D-08) and `MonthPicker` (D-11)
**`DatePicker.tsx` extensions:**
- Keep existing React Aria `DatePicker` -> `DateInput` -> `DateSegment` on desktop and `<input type="date">` via `useIsPhone()` on phones (`DatePicker.tsx:68-156`).
- Add `isDisabled` / `disabled`, `isInvalid` / `invalid`, `isReadOnly` / `readOnly`, `isRequired` / `required`, `id`, `description`, `errorMessage`, `className` so it shares the `Field`/control API and renders all gallery states.
- **Today shortcut (D-08):** Inside `<Dialog>{({ close }) => (<Calendar>...</Calendar> + footer button)}</Dialog>`, add a `"Today"` button using `today(getLocalTimeZone())` from `@internationalized/date` (disabled when `minValue`/`maxValue` excludes today), calling `onChange(todayIso())` (via `client/src/utils/calendarDay.ts`, never `toISOString().slice(0,10)`) and `close()`.
- **Locale order fix (`DatePicker.tsx:29-34`):** Currently `'d MMM yyyy'` (the default `dateFormat` in `preferencesStore.ts:100`) falls through to `'en-US'` (MM/DD/YYYY), and `'dd.MM.yyyy'` falls back to `navigator.language` (also `'en-US'` in Playwright!). Map `'d MMM yyyy'` -> `'en-AU'` (day-first) and `'dd.MM.yyyy'` -> `'de-DE'` so typed segments match displayed dates per D-08.

**`MonthPicker.tsx` (D-11):**
- React Aria `DatePicker` / `DateField` does NOT natively support `granularity="month"` editable input segments (`[CITED: react-spectrum.adobe.com]` / GitHub issue on month/year-only granularity).
- **Phone (`useIsPhone()`):** `<input type="month" value={value} min={minValue} max={maxValue} ... />` with `min-h-11 text-base` and shared border/focus/disabled/invalid/read-only classes (`BudgetStartSettings.tsx:67` is the sole existing `type="month"` caller).
- **Desktop:** Trigger `<AriaButton>` (or `<Group>` with optional clear button, `h-10`, matching `Select` height/border/radius/focus ring, showing `formatMonth(value)` from `utils/dateRange.ts` or placeholder) + React Aria `<DialogTrigger>` + `<Popover z-[60]>` + `<Dialog>` containing a year stepper (`ChevronLeft` / `year` / `ChevronRight`) and 12-month grid (`Jan`–`Dec`, respecting `minValue`/`maxValue`, `YYYY-MM` values, and a `"This month"` shortcut).
- **`MonthRangePicker.tsx`:** Keep `MonthRangePicker.tsx` intact in Phase 2 (or extract `MonthGrid` into a shared helper if clean); per D-11, whether `MonthRangePicker` is rebuilt on `MonthPicker` or only restyled in Phase 3/4 is the planner's call after the G0 audit.
  - **Superseded by D-11 (owner gate, 17 Nov 2026, `02-03-SUMMARY.md`):** `MonthRangePicker` is rebuilt in Phase 2 on `MonthPicker`'s shared `MonthGrid`, native on phones, in plan 02-14; its three users move with the set PR. The analysis here is kept as written.

### Pattern 4: `budget/ExpectedNote.tsx` (Claude's Discretion)
`ExpectedNote.tsx` (`180` lines `[VERIFIED: client/src/components/budget/ExpectedNote.tsx:1-180]`) uses `Button`, `Dialog`, `DialogTrigger`, `Heading`, `Popover`, and `ProgressBar` from `react-aria-components`, plus `FundingButton` from `../ui/Button`. It contains **zero form fields or selectors** (no `<input>`, `<select>`, `<textarea>`, or any of the 11 controls). **Recommendation:** Leave `ExpectedNote.tsx` untouched in Phase 2 and handle any Budget button/popover alignment when Budget moves in Phase 3.

### Pattern 5: Dev-Only Gallery Route & Stable Playwright Screenshot Baselines in CI
**Keeping gallery out of production builds (`App.tsx` + `client/vite.config.ts`):**
- `e2e/global-setup.ts:228-232` builds `client-desktop` (`--mode electron`), `client-web` (default production mode), and `client-demo` (`--mode demo`), while `Dockerfile:29` runs `npm run build --prefix client`.
- If the gallery is gated ONLY on `import.meta.env.DEV`, Playwright e2e (which runs against `vite build`) cannot visit it; if included in `electron` or default web builds, it leaks into production!
- **Solution (reusing `client/vite.config.ts`'s `withoutDemoWorker()` pattern at lines 95-107):**
  1. Add `client/src/pages/DevControlsGallery.tsx` and `client/src/pages/DevControlsGallery.stub.ts` (exports `() => null`).
  2. In `client/vite.config.ts`, add a `withoutDevGallery()` `resolveId` plugin enabled whenever `command === 'build' && mode !== 'gallery'` that resolves `DevControlsGallery` to `DevControlsGallery.stub.ts`. That guarantees **0 bytes** of gallery code in production web, Electron, Docker, HA, and Demo builds!
  3. In `client/src/App.tsx`, mount `<Route path="/dev/controls" element={...} />` **outside `<AppShell>` and `<AuthGate>`** (wrapped only in `import.meta.env.DEV || import.meta.env.MODE === 'gallery'`), with its own light/dark toggle (`document.documentElement.classList.toggle('dark', ...)`), so screenshots have zero sidebar/auth/database/date flakiness!
  4. In `e2e/ports.ts` (currently uses `3170`–`3180` `[VERIFIED: e2e/ports.ts:2-21]`), reserve `GALLERY_PORT = 3181` (or `3169`) and have `e2e/global-setup.ts` build `client-gallery` with `buildClient(..., 'gallery')` and serve it via a static server (same `startDemoServer` pattern) for a `gallery` Playwright project (`e2e/playwright.config.ts`).

**Stable screenshot baselines across macOS local and Linux CI:**
- `client/src/main.tsx:6-9` already self-hosts `@fontsource/inter` (400, 500, 600, 700), avoiding system-font drift `[VERIFIED: client/src/main.tsx:6-9]`.
- However, Playwright's default `snapshotPathTemplate` encodes `{platform}` (`-darwin.png` vs `-linux.png`) and macOS CoreText vs Linux FreeType rasterize Inter `.woff2` differently `[CITED: playwright.dev]`.
- **Standard CI workflow:**
  1. Generate and commit `-linux.png` baselines using Docker (installed on this host: `Docker version 29.2.1`) with the exact Playwright version image (`mcr.microsoft.com/playwright:v1.64.0-noble` or `jammy`, matching `e2e/package.json` `1.64.0`) — OR run `gh workflow` / CI artifact extraction if Docker isn't used.
  2. In `gallery.spec.ts`, await `page.evaluate(() => document.fonts.ready)` before asserting `expect(page).toHaveScreenshot(..., { fullPage: true, animations: 'disabled' })` across 4 matrix shots: `1280x800` light, `1280x800` dark, `390x844` light, `390x844` dark (plus open-popover states if desired).
  3. Do NOT set high pixel tolerances to paper over macOS/Linux differences; keep strict Linux baselines in CI (`maxDiffPixelRatio` small or default) and run visual updates via Playwright Docker when changing control visuals.

### Pattern 6: G0 Audit Methodology (WAVG-01)
Current codebase scan across all `310` non-test `.tsx` files in `client/src` found:
- Raw elements: `51` `<select>`, `5` `<textarea>`, `177` `<input>` (`32` `type="text"`, `32` omitted/default text, `64` `checkbox`, `10` `radio`, `11` `date`, `10` `file`, `8` `password`, `3` `search`, `3` `number`, `1` `month`, `1` `url`, `1` `range`, `1` dynamic `email`/`text`).
- Wrapped/shared calls: `124` `<Input>` (including `36` `type="date"`, `7` `type="number"` -> totals `47` date and `10` number), `80` `<Select>`, `41` `<CurrencyInput>`, `1` `<Switch>`, `1` `<DatePicker>`, `3` `<MonthRangePicker>`, `3` `<SegmentedControl>`, `1` `<Slider>`, `7` `<CategoryPicker>` callers (+ `TrendCategoryPicker`), `2` `<PayeeCombobox>` callers, `5` `<CategorySelect>` callers, `4` `<CategorySelectButton>` callers, `2` `<MerchantSelect>` callers.

**Practical G0 execution method:**
1. Run a read-only Node/TypeScript AST script (using root/client `typescript` compiler API, discarded after generating data) over `client/src/**/*.tsx` (excluding `*.test.tsx`) to emit every control occurrence with exact `file:line`, tag/component, `type`, `disabled`/`canSave`, `readOnly`, `aria-invalid`, `placeholder`, `className` (flagging one-off class strings), and accessible-name mechanism (`aria-label`, `aria-labelledby`, `<label htmlFor>`, wrapping `<label>`), cross-referenced against `e2e/tests/**/*.ts`.
2. Manually review and enrich each row with "what it chooses" and its D-06 classification (`Select` fixed list vs `Combobox` user-grown list vs `DatePicker`/`MonthPicker`/`CurrencyInput`/`allowlisted native <input type="file">`).
3. Run a temporary Playwright capture script against the built desktop app (with mock seeded data) to capture every control type at `1280×800` and `390×844` in `light` and `dark` into git-ignored `.ui-evidence/<date>-wave-g0/` (attached to PR 1, never committed).
4. Write the audit document (e.g. `docs/ui/FORM-CONTROLS-AUDIT.md`), verify zero code/version changes (`D-10`), open PR 1 to `redesign`, and halt at the blocking owner checkpoint.

### Anti-Patterns to Avoid
- **Using `overflow-hidden` on animated/sliding panels containing menus or focusable triggers:** `Sidebar.tsx:197` and `TransactionTable.tsx:662` explicitly use `overflow-clip` so scrolling doesn't fire false scroll events on `RowMenu` or trap focus mid-slide (`[VERIFIED: client/src/components/transactions/TransactionTable.tsx:660-662]`, `[VERIFIED: client/src/components/layout/Sidebar.tsx:194-197]`). Any new drawer/panel wrapping controls must keep `overflow-clip`.
- **Adding `React.lazy()` inside `AppShell.tsx` without `retryingImport`:** Shell-loaded primitives (`AddTransactionModal`, `Budget`, `Transactions`) sit in the main bundle (`App.tsx:6-8`). Any lazy shell feature must use `client/src/utils/retryingImport.ts` (`[VERIFIED: client/src/utils/retryingImport.ts:13-21]`) so offline start failures do not cache rejected promises.
- **Using `Select` from `ui/Input.tsx` for new Phase 2 work, or deleting it prematurely:** Keep `ui/Input.tsx`'s legacy `Select` exported until Phase 4 (`WAVG-10`).
- **Using `placeholder-text-disabled` or omitting `placeholder:`:** Leaves placeholders at `3.34:1`/`3.16:1` or Tailwind v4 Preflight's 50% `currentcolor` opacity, failing `WAVG-02`'s `>= 4.5:1` rule.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Select/Combobox/DatePicker keyboard & ARIA | Custom `keydown`, `aria-activedescendant`, focus trap, click-outside listeners | `react-aria-components` (`Select`, `ComboBox`, `Autocomplete`, `DatePicker`, `Popover`, `ListBox`) | Handles WAI-ARIA APG keyboard loops, typeahead, virtual focus, portal positioning, and screen readers. |
| Locale-aware typed date segments & calendar math | Manual `DD/MM/YYYY` parsing or `Date.toISOString().slice(0,10)` | `@internationalized/date` (`parseDate`, `today`, `getLocalTimeZone`) + `I18nProvider` + `utils/dates.ts` + `utils/calendarDay.ts` | Avoids UTC off-by-one bugs (`lint/eslint.config.js` forbids `toISOString().slice`) and handles leap years/min/max. |
| Month display formatting | Custom `MONTHS[m]` arrays in new code where `dateRange.ts` exists | `formatMonth` (`client/src/utils/dateRange.ts`) | Single consistent month format across the app. |
| Case-insensitive filtering in `CategoryPicker` | Custom `.toLowerCase().includes()` | `useFilter({ sensitivity: 'base' })` from `react-aria-components` | Locale/diacritic-aware filtering integrated with `Autocomplete`. |
| Phone breakpoint detection | Ad-hoc `window.innerWidth` checks | `useIsPhone()` (`client/src/hooks/useIsPhone.ts`, `PHONE_MAX_WIDTH = 767`) | Synced with Tailwind `md` breakpoint and `matchMedia` resize listeners. |
| Token contrast verification | Manual hex checks | `lint/tokens/contrast.test.js` | Automatically enforces `>= 4.5:1` in both light and dark themes on every CI run. |

**Key insight:** Every portal/overlay bug in the incumbent codebase (`CategoryPicker` clipping inside tables, `RowMenu` scroll traps, `Modal` focus escapes) came from hand-rolled `mousedown` + `keydown` + `getBoundingClientRect` positioning. React Aria `Popover` + `ListBox` + `Autocomplete` eliminates those custom handlers, leaving only `Modal.tsx` integration boundaries to verify.

## Common Pitfalls

### Pitfall 1: `PayeeCombobox` Role Change (`textbox` -> `combobox`) Breaks 5 E2E Tests
**What goes wrong:** Incumbent `PayeeCombobox.tsx:66-78` renders `<input type="text" aria-label="Payee">`, which has implicit ARIA role `textbox`. React Aria `ComboBox` sets `role="combobox"` on its `<Input>`.
**Why it happens:** 5 existing tests query `getByRole('textbox', { name: 'Payee' })` (`e2e/tests/transactions.spec.ts:27`, `connection.spec.ts:85`, `server-mode/auth.spec.ts:437`, `settings.spec.ts:288`, `rules.spec.ts:85`).
**How to avoid:** Update those 5 e2e selectors to `getByRole('combobox', { name: 'Payee' })` in PR 2 and document the role correction in the PR body (per `02-CONTEXT.md` Claude's Discretion).

### Pitfall 2: `CategoryPicker` Role & Enter-to-Select Semantics
**What goes wrong:** Two subtle breaks if `CategoryPicker` is naively replaced:
1. Incumbent `CategoryPicker` renders options as `<button>` (`transactions.spec.ts:179,561,635`, `review.spec.ts:48,55,56`, `payees.spec.ts:154` use `getByRole('button', { name: ... })`), whereas React Aria `ListBoxItem` renders `role="option"`.
2. `transactions.spec.ts:862-863` and `payees.spec.ts:73-74,147-148` fill `'Groceries'` and immediately press `Enter` *without* pressing `ArrowDown`, while `CategoryPicker.tsx:40-42` forbids `Enter` from picking `"Uncategorised"` when the query is empty.
**How to avoid:** Use React Aria `Autocomplete` (`disableAutoFocusFirst={false}` — `[CITED: react-aria.adobe.com/Autocomplete]`) + `TextField` (NOT `SearchField`, which changes `role="textbox"` to `role="searchbox"` and would break `getByRole('textbox', { name: 'Search categories' })`!) + `ListBox`. Guard empty-query `Enter` so nothing is committed when no option is focused. Update `getByRole('button', ...)` on category options in e2e to `getByRole('option', ...)` with rationale in PR 2.

### Pitfall 3: `strayLabels` & `role="combobox"` in `e2e/tests/accessibility.spec.ts`
**What goes wrong:** `e2e/tests/accessibility.spec.ts:105-110` defines `strayLabels`, which fails if ANY visible `<label>` element has `!el.control`. And `accessibility.spec.ts:158-159` expects `add.getByRole('combobox', { name: 'Account type' })` on native `<select>`.
**Why it happens:** Native `<label>` only sets `.control` for labelable HTML elements (`<input>`, `<select>`, `<textarea>`, `<button>`), NOT `DateInput` (`role="group"`) or `RadioGroup` (`role="radiogroup"`).
**How to avoid:** On `DatePicker`, `MonthPicker`, `Select`, and `RadioGroup`, render React Aria `<Label>` with `elementType="span"` (note: React Aria `Select` and `RadioGroup` default their `<Label>` to `<span>` via `labelElementType: 'span'` `[CITED: react-spectrum.adobe.com]`, while `DatePicker`'s `<Label>` should explicitly be `elementType="span"` or verified not to emit an unassociated `<label>`). `Switch` and `Checkbox` in React Aria wrap a native `<input>` inside `<label>`, so `.control` is valid; however, callers like `Welcome.tsx:256` that currently wrap `<Switch>` in an outer `<label>` must NOT nest `<label>` inside `<label>` when Welcome moves in Phase 4.

### Pitfall 4: `Escape` Inside `Modal.tsx` When a React Aria Popover Is Open
**What goes wrong:** `Modal.tsx:153-156` attaches a bubble-phase `document.addEventListener('keydown', ...)` that closes the modal on `Escape` whenever `!e.defaultPrevented`. When a React Aria `ComboBox`, `Select`, or `DatePicker` popover is open inside `Modal.tsx`, pressing `Escape` must close **only** the popover (especially for `ComboBox`, where DOM focus stays on `<Input>` inside the `Modal`!).
**How to avoid:** Explicitly test `Escape` inside `Modal.tsx` for `Select`, `Combobox`, and `DatePicker` in Playwright (`dialog-focus.spec.ts` or new wrapper tests). If React Aria's `Escape` handler stops propagation in React synthetic phase without calling `e.preventDefault()` on the native `KeyboardEvent`, intercept `Escape` in capture phase or call `e.preventDefault()` on open popovers (matching `MonthRangePicker.tsx:189` and `CategoryPicker.tsx:142`).

### Pitfall 5: `DatePicker.tsx` `localeFor(format)` Order Bug for `'d MMM yyyy'`
**What goes wrong:** `DatePicker.tsx:29-34` maps `'dd/MM/yyyy'` -> `'en-AU'`, `'yyyy-MM-dd'` -> `'en-CA'`, `'dd.MM.yyyy'` -> `navigator.language`, and everything else -> `'en-US'`. Because Allotment's default `dateFormat` in `preferencesStore.ts:100` is `'d MMM yyyy'` (day-first!), `DatePicker.tsx` currently renders month-first (`MM/dd/yyyy`) segments on default installs and in Playwright (`locale: 'en-US'`)!
**How to avoid:** Map `'d MMM yyyy'` -> `'en-AU'` (day/month/year) and `'dd.MM.yyyy'` -> `'de-DE'` in `DatePicker.tsx` (`localeFor`), and build the shared Playwright `fillDate` helper (`e2e/tests/fixtures.ts`) targeting `[data-type="year"]`, `[data-type="month"]`, `[data-type="day"]` segments directly so it works regardless of the user's `dateFormat` preference (and falls back to `.fill(iso)` on phones where `isPhone` renders `<input type="date">`).

### Pitfall 6: macOS vs Linux Playwright Screenshot Baselines & CI Constraints
**What goes wrong:** Playwright appends `-darwin.png` on macOS and `-linux.png` on Linux CI (`ubuntu-latest`) and refuses to pass if only `-darwin.png` exists; additionally, macOS vs Linux rasterize `@fontsource/inter` differently `[CITED: playwright.dev]`.
**How to avoid:** Generate committed `*-linux.png` baselines inside Playwright's official Linux Docker container matching `@playwright/test@1.64.0` (`mcr.microsoft.com/playwright:v1.64.0-noble`), wait for `document.fonts.ready` + disable animations, and use a dedicated free port in `e2e/ports.ts` (e.g. `3181`) so `e2e` runs cleanly with one browser run at a time and no `E2E_SKIP_BUILD=1`.

### Pitfall 7: `lint/package.json` Warning Cap (`128`) & `icon-only-control` Rule
**What goes wrong:** `lint/package.json:8` caps warnings at `--max-warnings=128` (tightened from 135 in Wave F). Adding any `jsx-a11y` warning (such as unassociated `<label>`) or `no-explicit-any` warning fails CI. Also `allotment/icon-only-control` errors on icon-only `<button>` without `aria-label`.
**How to avoid:** Run `cd lint && npm test && npm run lint` before pushing; use React Aria `<Label>` (not raw `<label>` without `htmlFor`) inside `Field.tsx` and keep `aria-label` on all icon buttons (`ChevronLeft`, `ChevronRight`, `CalendarDays`, `X`).

## Code Examples

Verified patterns matching `client/src/index.css` `@theme` tokens and `react-aria-components@1.22.1`:

### Shared Field Token Classes (`client/src/components/ui/fieldClasses.ts`)
```typescript
// Tokens verified from client/src/index.css:29-65,193-196
export const fieldControlBase =
  'w-full rounded-md border border-border bg-surface text-sm text-text max-md:text-base placeholder:text-text-tertiary transition-colors focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600';

export const fieldHeights = {
  sm: 'h-8 max-md:min-h-11',
  md: 'h-10 max-md:min-h-11',
} as const;

export const fieldStateClasses =
  'data-[disabled]:bg-surface-alt data-[disabled]:text-text-disabled data-[disabled]:border-border-light data-[disabled]:cursor-not-allowed ' +
  'data-[readonly]:bg-surface-alt data-[readonly]:text-text-secondary data-[readonly]:cursor-default ' +
  'data-[invalid]:border-negative data-[invalid]:focus:border-negative data-[invalid]:focus:ring-negative';
```

### React Aria `Select` with Phone Native Branch (`D-04`, `[CITED: react-spectrum.adobe.com]`)
```tsx
// Desktop: React Aria Select + Popover + ListBox; Phone (<768px): native <select>
if (isPhone) {
  return (
    <label className="block">
      {label && <span className={labelClass}>{label}</span>}
      <select
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text disabled:bg-surface-alt disabled:text-text-disabled"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```
```tsx
// Desktop React Aria Select (elementType="span" avoids strayLabels test failure)
<AriaSelect
  selectedKey={value}
  onSelectionChange={(key) => onChange(String(key))}
  isDisabled={isDisabled}
  isInvalid={isInvalid}
  isRequired={isRequired}
  className="group flex flex-col gap-1.5"
>
  {label && <Label elementType="span" className={labelClass}>{label}</Label>}
  <AriaButton className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus-visible:border-brand-600 focus-visible:ring-1 focus-visible:ring-brand-600 group-data-[disabled]:bg-surface-alt group-data-[disabled]:text-text-disabled group-data-[invalid]:border-negative">
    <SelectValue className="truncate data-[placeholder]:text-text-tertiary" />
    <ChevronDown size={14} className="shrink-0 text-text-tertiary" aria-hidden />
  </AriaButton>
  <Popover className="z-[60] w-(--trigger-width) rounded-md border border-border bg-surface p-1 shadow-card outline-none data-[entering]:animate-menu-in">
    <ListBox className="max-h-60 overflow-y-auto outline-none">
      {options.map((opt) => (
        <ListBoxItem
          key={opt.id}
          id={opt.id}
          isDisabled={opt.disabled}
          className="flex cursor-default items-center justify-between rounded-sm px-2.5 py-1.5 text-sm text-text outline-none data-[focused]:bg-hover data-[selected]:bg-brand-50 data-[selected]:text-brand-700 data-[disabled]:text-text-disabled"
        >
          {({ isSelected }) => (
            <>
              <span className="truncate">{opt.label}</span>
              {isSelected && <Check size={14} className="shrink-0 text-brand-600" aria-hidden />}
            </>
          )}
        </ListBoxItem>
      ))}
    </ListBox>
  </Popover>
</AriaSelect>
```

### React Aria `Switch` Fixing `#264` (`[CITED: react-spectrum.adobe.com]`)
```tsx
<AriaSwitch
  isSelected={checked}
  onChange={onCheckedChange}
  isDisabled={disabled}
  isReadOnly={readOnly}
  className="group inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 cursor-pointer data-[disabled]:cursor-not-allowed"
>
  <span
    aria-hidden="true"
    className="relative block h-6 w-10 rounded-full bg-text-tertiary transition-colors motion-reduce:transition-none group-data-[selected]:bg-brand-600 group-data-[disabled]:bg-surface-alt group-data-[disabled]:ring-1 group-data-[disabled]:ring-inset group-data-[disabled]:ring-border group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"
  >
    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform motion-reduce:transition-none group-data-[selected]:translate-x-4 group-data-[selected]:bg-brand-contrast group-data-[disabled]:bg-text-disabled" />
  </span>
  {children}
</AriaSwitch>
```

### Vite Production-Exclusion Swap for Dev Gallery (Matching `withoutDemoWorker()` in `client/vite.config.ts:95-107`)
```ts
// client/vite.config.ts
function withoutDevGallery(): Plugin {
  const real = normalizePath(path.resolve(import.meta.dirname, 'src/pages/DevControlsGallery.tsx'));
  const stub = normalizePath(path.resolve(import.meta.dirname, 'src/pages/DevControlsGallery.stub.ts'));
  return {
    name: 'flybudget-without-dev-gallery',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('DevControlsGallery')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && normalizePath(resolved.id) === real ? stub : null;
    },
  };
}
// Apply in defineConfig(({ command, mode }) => ...):
// ...(command === 'build' && mode !== 'gallery' ? [withoutDevGallery()] : [])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wave E rule: "short lists use the styled native `Select`" (`HANDOVER-UI.md:128`) | Wave G D-05/D-06: desktop uses React Aria `Select` (fixed lists) or `Combobox` (user-grown lists); phones keep native `<select>` | 16 Nov 2026 (02-CONTEXT.md) | Removes OS-inconsistent `<select>` popups on desktop while keeping OS wheels on phones; desktop e2e tests migrate from `selectOption` to listbox options in Phases 3–4. |
| Hand-rolled `CategoryPicker` (358 lines) & `PayeeCombobox` (105 lines) | Thin wrappers over shared React Aria `Combobox` / `Autocomplete` + `ListBox` | Phase 2 (WAVG-02) | Fixes keyboard/screen-reader gaps and clipping without changing caller screens yet. |
| `placeholder-text-disabled` on `CurrencyInput` | `placeholder:text-text-tertiary` everywhere | Phase 2 (WAVG-02) | Meets WCAG AA `>= 4.5:1` (`5.63:1` light, `6.26:1` dark) in both themes. |

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-aria-components@1.22.1` handles `Escape` inside Allotment's custom `Modal.tsx` without letting `Modal.tsx`'s bubble-phase `document` `keydown` listener close the outer modal when `ComboBox` / `Select` / `DatePicker` popover is open. | Pitfall 4 | Pressing `Escape` to close a picker inside `AddTransactionModal` or `GoalFormModal` closes the whole modal (or triggers `DiscardPrompt`). Mitigated by an explicit Wave G1 Playwright test and, if needed, `e.preventDefault()` / capture-phase guard on open popovers. |
| A2 | `MonthPicker` rendered as a trigger button + React Aria `Popover` + `Dialog` with a 12-month `MonthGrid` (no inline typed month/year segments on desktop) satisfies D-11. | Architecture Patterns (Pattern 3) | If the owner expects typed `MM/YYYY` segments on desktop (like `DatePicker`), a custom two-segment input would be needed instead of a button trigger. Clarify at the G0 owner checkpoint before G1 starts. |
| A3 | `toHaveScreenshot({ fullPage: true, animations: 'disabled' })` with default strict pixel comparison in `mcr.microsoft.com/playwright:v1.64.0-*` Docker produces zero flake in CI `ubuntu-latest`. | Architecture Patterns (Pattern 5) | Minor subpixel variance in CI container vs local Docker might require `maxDiffPixels` tuning (e.g. `<= 20` pixels on a 1280×2000 full-page shot). Verify on the PR 2 CI run. |

## Open Questions (RESOLVED)

1. **Desktop `MonthPicker` interaction: button-triggered grid (like `MonthRangePicker`) vs typed segments?**
   - RESOLVED: routed to the owner gate in plan 02-03 (D-10), which records the answer as `MonthPicker desktop form: grid` unless the owner changes it; plan 02-08 builds the grid.
   - What we know: D-11 says *"MonthPicker is an eleventh shared control in the set PR, with the same states, gallery entry and phone rule as DatePicker (native month input on phones)"*, and React Aria `DatePicker` lacks `granularity="month"` editable segments.
   - What's unclear: Whether desktop `MonthPicker` is fine as a trigger button opening a year-stepper + 12-month grid popover (consistent with `MonthRangePicker`), or needs keyboard-typeable segments.
   - Recommendation: Confirm at the G0 owner checkpoint (D-10) before building G1; default to button + React Aria `Popover`/`Dialog` + `MonthGrid` (matching `MonthRangePicker` and `BudgetStartSettings` needs).

2. **Rebuilding `MonthRangePicker` on `MonthPicker` vs restyling only?**
   - RESOLVED: routed to the owner gate in plan 02-03 (D-10), which records the answer as `MonthRangePicker: leave` unless the owner changes it; plan 02-08 leaves `MonthRangePicker.tsx` untouched.
   - **Superseded by D-11 (owner gate, 17 Nov 2026, `02-03-SUMMARY.md`):** `MonthRangePicker` is rebuilt in Phase 2 on `MonthPicker`'s shared `MonthGrid`, native on phones, in plan 02-14; its three users move with the set PR. The answer recorded was `MonthRangePicker: rebuild`, not `leave`.
   - What we know: `02-CONTEXT.md` D-11 explicitly leaves this to the planner after G0: *"Whether `MonthRangePicker` is rebuilt on it or only restyled is the planner's call after the audit."* `MonthRangePicker` has 3 callers (`CashFlow.tsx:1184`, `ReportBuilderSidebar.tsx:154`, `DateRangeControl.tsx:56`).
   - Recommendation: Extract a shared `MonthGrid` helper inside `MonthPicker.tsx` in G1 so `MonthRangePicker` can reuse it cleanly in Phase 3/4 without duplicating grid markup.

3. **`Select` `isReadOnly` semantics in React Aria:**
   - RESOLVED: decided in `02-UI-SPEC.md` (per-control item 5, Select: `isReadOnly` through an `isOpen` and `onOpenChange` guard, so the trigger stays focusable but does not open) and built in plan 02-07.
   - What we know: Official React Aria docs note `isReadOnly` is natively supported on `TextField`, `TextArea`, `ComboBox`, `Checkbox`, `RadioGroup`, `Switch`, and `DatePicker`, whereas `Select` relies on `isDisabled` or controlled non-mutating handlers (`[CITED: react-spectrum.adobe.com]`).
   - Recommendation: If `Select` exposes `isReadOnly?: boolean` for API uniformity (`WAVG-02` gallery state matrix), implement it via `isOpen={isReadOnly ? false : undefined}` + `onOpenChange` guard + `data-readonly` attribute on the trigger button so it remains focusable (unlike `isDisabled`) and visually matches read-only `Input` / `DatePicker`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | CI parity, Safe mode unit tests (`WAVES.md`, `.github/workflows/ci.yml:32`) | ✓ | `v24.10.0` at `/opt/homebrew/opt/node@24/bin/node` (shell default `PATH` is `v22.19.0`) | Prepend `/opt/homebrew/opt/node@24/bin` to `PATH` when running checks |
| npm | Installing lockfile deps (`client/`, `server/`, `e2e/`, `lint/`) | ✓ | `11.11.1` | — |
| Docker | Generating Linux Playwright screenshot baselines (`*-linux.png`) locally | ✓ | `29.2.1` | Generate Linux baselines from CI failure artifact if Docker is unavailable |
| Python 3 | `scripts/prepare-release.py` (for PR 2 version bump) | ✓ | `3.14.0` | — |
| Git | Worktree operations & commits | ✓ | `2.54.0` | — |
| `node_modules` in worktree | Running `vitest`, `tsc`, `eslint`, `playwright` | ✗ (fresh worktree) | — | Run `npm ci` in `client/`, `server/`, `e2e/`, `lint/` before executing verification |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Worktree `node_modules` directories are absent on fresh checkout; executor runs `npm ci` (respecting `.npmrc` `ignore-scripts=true`) and prepends Homebrew Node 24 to `PATH`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Client unit framework | `vitest` `^5.0.4` (`client/package.json:41`), Node environment (`renderToStaticMarkup` from `react-dom/server`; no `jsdom` or `@testing-library/react` installed) `[VERIFIED: client/package.json:10,41; client/src/components/ui/Plant.test.ts:1-2]` |
| Lint & token framework | `eslint` `^9.39.5` + `node --test` (`lint/package.json:8-10`; `--max-warnings=128`) `[VERIFIED: lint/package.json:8-10]` |
| E2E / Visual framework | `@playwright/test` `1.64.0` (`e2e/package.json:12`, `e2e/playwright.config.ts`) `[VERIFIED: e2e/package.json:12]` |
| Quick run command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit)` |
| Full suite command | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint) && npm run format:check && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode && npm test -- --project=gallery)` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVG-01 | Complete G0 audit doc + light/dark 1280/390 screenshots; zero app/version edits in PR 1 | Manual/AST + `format:check` | `npm run format:check` | ❌ Wave 0 (AST audit script + `docs/ui/FORM-CONTROLS-AUDIT.md`) |
| WAVG-02 | 11 shared controls render `@theme` token classes only, disabled Switch has disabled styling (#264), placeholder uses `text-tertiary` (>= 4.5:1) | Unit (`vitest` `renderToStaticMarkup`) + `lint/tokens` | `npm test --prefix client -- src/components/ui/` and `(cd lint && npm test)` | ✅ `lint/tokens/contrast.test.js`; ❌ Wave 0 `client/src/components/ui/*.test.ts` |
| WAVG-02 | `CategoryPicker` and `PayeeCombobox` thin wrappers preserve behaviour across all screens | E2E (`playwright`) | `cd e2e && npm test -- --project=desktop tests/transactions.spec.ts tests/payees.spec.ts tests/review.spec.ts tests/review-payees.spec.ts tests/recurring.spec.ts tests/rules.spec.ts` | ✅ Existing specs (selectors updated for ARIA roles) |
| WAVG-03 | WAI-ARIA keyboard navigation, focus ring, Escape inside `Modal`, 44 px phone targets, native phone pickers | E2E (`playwright`) | `cd e2e && npm test -- --project=desktop tests/accessibility.spec.ts tests/dialog-focus.spec.ts` + `--project=phone tests/phone/phone-native.spec.ts` | ✅ Existing specs + Wave 0 gallery/picker keyboard & Escape checks |
| WAVG-04 | Dev-only gallery excluded from prod builds; Playwright screenshot test runs in CI (1280/390 light/dark) | Build check + E2E (`playwright`) | `npm run build --prefix client` (verify stub) + `cd e2e && npm test -- --project=gallery` | ❌ Wave 0 (`e2e/tests/gallery/controls-gallery.spec.ts` + Linux baselines) |

### Sampling Rate
- **Per task commit:** `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint)`
- **Per wave merge (PR 2):** Full client build/tests, lint + `format:check`, `cd e2e && npx tsc --noEmit`, and sequential browser suites (`desktop`, `phone`, `demo`, `server-mode`, `gallery` — one at a time because `e2e/ports.ts` ports are fixed).
- **Phase gate:** Full suite green on CI (`CI passed` job in `.github/workflows/ci.yml`) before merge.

### Wave 0 Gaps
- [ ] G0 AST audit runner (temporary script, not committed) -> generates raw table for `docs/ui/FORM-CONTROLS-AUDIT.md` (PR 1)
- [ ] `client/src/components/ui/*.test.ts` — `renderToStaticMarkup` tests covering ARIA attributes, token-only classes (no hex literals), `placeholder:text-text-tertiary`, disabled Switch (`#264`), and phone native branches (`WAVG-02`)
- [ ] `e2e/tests/fixtures.ts` `fillDate` helper — fills desktop React Aria `DatePicker` segments (`[data-type="year"|"month"|"day"]`) and phone `<input type="date">` (`D-07`)
- [ ] `e2e/tests/gallery/controls-gallery.spec.ts` + `*-linux.png` baselines — gallery ARIA/keyboard/Escape-in-Modal checks and `toHaveScreenshot` in 1280/390 light/dark (`WAVG-03`, `WAVG-04`)
- [ ] `lint/tokens/contrast.test.js` — optionally assert `text-tertiary` on `surface` explicitly as the placeholder pair (already covered at line 39: `['text-tertiary', ['page', 'surface', 'surface-alt', 'hover']]`)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Client-only phase; `AuthGate` login forms are unchanged until Phase 4 (`WAVG-07`). |
| V3 Session Management | no | No cookie, token, or gateway changes. |
| V4 Access Control | yes | Dev gallery route (`/dev/controls`) must never ship in production, Electron, Docker, HA, or Demo builds (Vite `resolveId` stub in `client/vite.config.ts`). |
| V5 Input Validation | yes | `DatePicker` emits `YYYY-MM-DD` strings (`isoDate`); `MonthPicker` emits `YYYY-MM` (`isoMonth`); `CurrencyInput` stays `type="text" inputMode="decimal"`; no `dangerouslySetInnerHTML` or inline scripts. |
| V6 Cryptography | no | No crypto, key, or credential changes. |

### Known Threat Patterns for React / Vite / CSP Stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dev-only route exposed in production or Electron bundle | Information Disclosure / Surface Area | Compile-time Vite `resolveId` module replacement (`withoutDevGallery`) + `import.meta.env.DEV \|\| import.meta.env.MODE === 'gallery'` gate; verify built `dist/` contains no gallery route string. |
| Self-hosted font / CSP failure (`style-src 'self'`, `font-src 'self'`) | Tampering / Availability | Continue bundling `@fontsource/inter` locally (`client/src/main.tsx:6-9`) and Tailwind `@theme` CSS variables (`index.css`); never inject external font URLs or runtime `<style>` loaders. |

## Sources

### Primary (HIGH confidence — verified in repo / npm registry)
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` — D-01 to D-11, Claude's Discretion
- `docs/superpowers/gsd-records/REQUIREMENTS.md` & `docs/superpowers/gsd-records/ROADMAP.md` — WAVG-01 to WAVG-04 and Phase 2–4 boundaries
- `CLAUDE.md` / `AGENTS.md`, `DESIGN.md`, `docs/ui/README.md`, `docs/ui/WAVES.md`, `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`
- `client/package.json`, `client/package-lock.json` (`react-aria-components@1.22.1`, `@internationalized/date@3.12.4`, `vitest@5.0.4`)
- `client/src/index.css`, `client/src/App.tsx`, `client/src/main.tsx`, `client/vite.config.ts`
- `client/src/components/ui/` (`DatePicker.tsx`, `Input.tsx`, `Switch.tsx`, `CurrencyInput.tsx`, `MonthRangePicker.tsx`, `Button.tsx`, `Modal.tsx`, `Slider.tsx`, `SegmentedControl.tsx`)
- `client/src/components/transactions/` (`CategoryPicker.tsx`, `PayeeCombobox.tsx`, `CategorySelectButton.tsx`, `CategorySelect.tsx`, `MerchantSelect.tsx`, `TransactionRow.tsx`, `TransactionDetailPanel.tsx`, `TransactionFormRow.tsx`, `AddTransactionModal.tsx`)
- `client/src/components/budget/ExpectedNote.tsx`, `client/src/components/goals/GoalFormModal.tsx`, `client/src/components/settings/BudgetStartSettings.tsx`
- `lint/package.json`, `lint/eslint.config.js`, `lint/tokens/contrast.test.js`, `lint/rules/icon-only-control.js`, `lint/terms/terms.test.js`
- `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/ports.ts`, `e2e/tests/fixtures.ts`, `e2e/tests/accessibility.spec.ts`, `e2e/tests/dialog-focus.spec.ts`, `e2e/tests/transactions.spec.ts`, `e2e/tests/review.spec.ts`, `e2e/tests/payees.spec.ts`, `e2e/tests/recurring.spec.ts`
- `.github/workflows/ci.yml`, `Dockerfile`, `gh issue view 267`, `gh issue view 264`

### Secondary (MEDIUM confidence — official docs via web search)
- Adobe React Aria documentation (`react-spectrum.adobe.com` / `react-aria.adobe.com`): `Select`, `ComboBox` (`allowsCustomValue`, `menuTrigger`, `Section`), `Autocomplete` (`disableAutoFocusFirst`, `disableVirtualFocus`), `DatePicker`, `CalendarMonthPicker`, `Checkbox`, `RadioGroup`, `Switch`, `TextField`, `FieldError`, `Label` (`labelElementType`), `Popover`, `Dialog` (`({ close })`), `isReadOnly` & `data-*` attributes.
- Playwright visual comparisons documentation (`playwright.dev`): `toHaveScreenshot()` OS suffixes (`-darwin.png` vs `-linux.png`), Docker Linux baseline generation, font loading stability.
- W3C WAI-ARIA Authoring Practices Guide (`w3.org/WAI/ARIA/apg/`): Combobox, Checkbox, Radio Group, Switch, Date Picker, Dialog patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked by D-01/D-02 and verified in `client/package.json`, `client/package-lock.json`, and `npm view`.
- Architecture: HIGH — existing `DatePicker.tsx`, `vite.config.ts` module swap, `index.css` `@theme`, and e2e selectors directly inspected.
- Pitfalls: HIGH — exact failing e2e selectors, contrast numbers, `strayLabels`, and `localeFor` bug verified in repo files; `Escape`-in-`Modal` and Linux screenshot tolerance flagged for browser verification.

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 (30 days; stack versions are lockfile-pinned)
