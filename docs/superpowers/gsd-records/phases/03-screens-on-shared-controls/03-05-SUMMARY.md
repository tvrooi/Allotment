---
phase: 03-screens-on-shared-controls
plan: 05
subsystem: ui
tags: [react-aria, shared-controls, accounts, reconcile, select, input, checkbox, wave-g, wavg-05]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (`Reconcile: match`), 03-02 shared controls, and 03-04 CurrencySelect/CurrencyDifference"
provides:
  - "`AccountTypeSelect.tsx` on shared `Select` with grouped `ACCOUNT_GROUPS` options, hint description, and native select on phones (D-04)"
  - "`AddAccountModal.tsx`, `EditAccountModal.tsx`, and `DeleteAccountModal.tsx` on shared `Field`/`Label`, `Input`, and `Checkbox`, with `EditAccountModal` logo file input kept native (D-17)"
  - "`ReconcilePage.tsx` select-all and per-row cleared checkboxes on shared `Checkbox` with indeterminate state and label-only click stopPropagation (T-03-07)"
  - "Passing desktop and phone e2e suites (`accounts.spec.ts`, `financial-integrity.spec.ts`, `assign-pools.spec.ts`, `cleanup.spec.ts`, `currencies.spec.ts`, `first-run.spec.ts`, `switchers.spec.ts`, `accounts-access.spec.ts`, `safe-mode.spec.ts`, `polish.spec.ts`, and phone specs)"
affects: [03-15]

plan_head_before: c4e7827f3e7518983217c6fef256eae4e9d2e5a0
plan_head_after: f859045bbec3e083906c11b02fe3072cf8967c1e
commits: 2

actuals:
  tokens: 4890
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Shared `<Label htmlFor={confirmId}>` bound to `<Input id={confirmId} aria-label='Type the account name to confirm' />` in `DeleteAccountModal.tsx` so visible label stays bound (zero strayLabels) while exact accessible name is preserved per D-15"
    - "Label-only `stopPropagation` on `ReconcilePage.tsx`'s row checkbox `<td>` (`if ((e.target as HTMLElement).closest('label')) e.stopPropagation()`) so clicking the shared `Checkbox` toggles once without breaking row/cell clicks (T-03-07)"

key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-05-SUMMARY.md
  modified:
    - client/src/components/accounts/AccountTypeSelect.tsx
    - client/src/components/accounts/AddAccountModal.tsx
    - client/src/components/accounts/EditAccountModal.tsx
    - client/src/components/accounts/DeleteAccountModal.tsx
    - client/src/pages/ReconcilePage.tsx
    - e2e/tests/accounts.spec.ts
    - e2e/tests/assign-pools.spec.ts
    - e2e/tests/financial-integrity.spec.ts

key-decisions:
  - "Precomputed `ACCOUNT_TYPE_OPTIONS: SelectGroup[]` from `ACCOUNT_GROUPS` and `ACCOUNT_TYPES` in `AccountTypeSelect.tsx`, passing `description={accountTypeInfo(value).hint}` to shared `Select` so help text stays linked via `aria-describedby` on desktop and phone"
  - "Used `<Label htmlFor={confirmId}>` + bare `<Input id={confirmId} aria-label='Type the account name to confirm' />` in `DeleteAccountModal.tsx` instead of `<Field>` (which injects `aria-labelledby` and would replace the accessible name with the dynamic account name), preserving `D-15` and `cleanup.spec.ts` unchanged"
  - "Wired off-budget and Ready-to-assign-pool helper copy through `Checkbox`'s `description` prop and removed outer `<label>` wrappers (preventing nested labels and stray labels)"
  - "Preserved `allChecked = checkedIds.size === unreconciledTxns.length` on `ReconcilePage.tsx` (required when unreconciled count is 0 so `Create adjustment` stays enabled) while driving `isIndeterminate` from `checkedIds.size > 0 && checkedIds.size < unreconciledTxns.length`"
  - "Updated `e2e/tests/assign-pools.spec.ts:14` to `setToggle` because React Aria `Checkbox`'s hidden 1 px input is pointer-intercepted under Playwright `.check()`; left `e2e/tests/accessibility.spec.ts` untouched for plan 03-15"

patterns-established:
  - "Use `setToggle` / `toggleTarget` from `e2e/tests/fixtures.ts` for all migrated React Aria `Checkbox` controls"
  - "Use `Label` + `Input` with explicit `aria-label` whenever a visible label includes dynamic prose (like an entity name) that must not replace the static accessible name (D-15)"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "AccountTypeSelect, AddAccountModal, EditAccountModal, and DeleteAccountModal migrated to shared Select, Field/Label+Input, and Checkbox with EditAccountModal logo file input kept native (D-17), zero raw non-file controls, and accounts/assign-pools/cleanup/currencies/first-run/switchers/accounts-access specs passing"
    requirement: "WAVG-05"
    verification:
      - kind: e2e
        ref: "PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts (14 passed); tests/assign-pools.spec.ts (1 passed); tests/cleanup.spec.ts tests/currencies.spec.ts tests/first-run.spec.ts tests/switchers.spec.ts tests/accounts-access.spec.ts (34 passed)"
        status: pass
      - kind: other
        ref: "perl raw-control check on AccountTypeSelect.tsx, AddAccountModal.tsx, EditAccountModal.tsx, DeleteAccountModal.tsx => 0; EditAccountModal.tsx file input count => 1; accounts.spec.ts selectOption count => 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ReconcilePage select-all and per-row cleared checkboxes migrated to shared Checkbox with indeterminate state and label-only click stopPropagation (T-03-07), verified by single-toggle e2e guard in financial-integrity.spec.ts (baseline run on old page passed 5/5; post-migration run passed 19/19 with accounts.spec.ts)"
    requirement: "WAVG-05"
    verification:
      - kind: e2e
        ref: "PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts tests/financial-integrity.spec.ts (19 passed); tests/safe-mode.spec.ts tests/polish.spec.ts (24 passed); --project=phone tests/phone/phone-native.spec.ts tests/phone/targets-phone.spec.ts tests/phone/polish-phone.spec.ts (37 passed)"
        status: pass
      - kind: other
        ref: "perl raw-control check on client/src/pages/ReconcilePage.tsx => 0; lint test (86/86) + eslint (0 errors, 126/128 warnings); client vitest (98 files, 930 tests); client build + e2e tsc --noEmit"
        status: pass
    human_judgment: false

duration: 15 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 05: Accounts Dialogs and Reconcile on Shared Controls Summary

**Migrated `AccountTypeSelect`, `AddAccountModal`, `EditAccountModal`, `DeleteAccountModal`, and `ReconcilePage` onto the shared `Select`, `Field`/`Label`, `Input`, and `Checkbox` controls (keeping `EditAccountModal`'s hidden logo file input native per D-17), preserved single-toggle reconciliation with a baseline-verified e2e guard (T-03-07), and updated the affected desktop e2e selectors.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-11-19T14:03:14Z
- **Completed:** 2026-11-19T14:18:32Z
- **Tasks:** 2
- **Files modified:** 8 (+ `03-05-SUMMARY.md`)

## Accomplishments

- Migrated `AccountTypeSelect.tsx` onto the shared `Select` (`client/src/components/ui/Select.tsx`) with `ACCOUNT_GROUPS`/`ACCOUNT_TYPES` grouped into `SelectGroup[]` in identical order and labels, accessible label `'Account type'`, hint text wired via `description`, and native `<select>` on phones (D-04). Removed one-off `focus:border-brand-500 focus:ring-brand-500` classes.
- Migrated `AddAccountModal.tsx` and `EditAccountModal.tsx`:
  - `Account name` moved to `<Field label="Account name"><Input ... autoFocus /></Field>` (removing one-off `focus:border-brand-500` and `placeholder-text-tertiary` drift).
  - `Off budget` (add & edit) and `Own Ready to assign for the bills paid from this account` (edit) moved to shared `Checkbox` with outer `<label>` wrappers removed and helper text wired through `description`.
  - Kept `CurrencyInput`, `CurrencySelect`, `useCanSave()`, `<SavingPausedHint />`, validation, and Enter-to-submit unchanged. Kept `EditAccountModal`'s hidden `<input type="file">` native (D-17).
- Migrated `DeleteAccountModal.tsx`'s confirmation input onto `<Label htmlFor={confirmId}>` + shared `<Input id={confirmId} aria-label="Type the account name to confirm" />`, keeping zero stray labels while preserving the exact `'Type the account name to confirm'` accessible name (D-15) so `cleanup.spec.ts` passes unchanged.
- Migrated `ReconcilePage.tsx`'s select-all and per-row cleared checkboxes onto shared `Checkbox` with `aria-label`s preserved, `isIndeterminate={someChecked}` on select-all, and label-only `stopPropagation` on the row checkbox `<td>` so clicking a row's checkbox toggles once (T-03-07).
- Added a single-toggle + cleared-total guard assertion (plus indeterminate check on select-all) in `e2e/tests/financial-integrity.spec.ts`, verified passing on the unmodified `ReconcilePage.tsx` before editing it, and verified passing after migration along with Safe mode and phone specs.

## Task Commits

Each task was committed atomically on `worktree-agent-p0305-a1`:

1. **Task 1: Account dialogs and the account type field** - `71dbb047` (feat)
2. **Task 2: Reconcile page checkboxes** - `f859045b` (feat)

## Files Created/Modified

- `client/src/components/accounts/AccountTypeSelect.tsx` - Replaced raw `<select>`/`<optgroup>` with shared `Select` over grouped `ACCOUNT_TYPE_OPTIONS` and `description` hint.
- `client/src/components/accounts/AddAccountModal.tsx` - Replaced raw name `<input>` and off-budget `<input type="checkbox">` with shared `Field`+`Input` and `Checkbox`.
- `client/src/components/accounts/EditAccountModal.tsx` - Replaced raw name `<input>` and off-budget / Ready-to-assign-pool `<input type="checkbox">` elements with shared `Field`+`Input` and `Checkbox`; kept hidden logo `<input type="file">` native.
- `client/src/components/accounts/DeleteAccountModal.tsx` - Replaced raw confirm `<input>` and wrapping `<label>` with shared `Label` (`htmlFor`) and `Input` (`aria-label="Type the account name to confirm"`).
- `client/src/pages/ReconcilePage.tsx` - Replaced select-all and per-row `<input type="checkbox">` elements with shared `Checkbox`, adding `someChecked` indeterminate state and label-only `stopPropagation` in the row cell.
- `e2e/tests/accounts.spec.ts` - Updated `'Account type'` `selectOption` calls to `chooseOption` on the desktop trigger button.
- `e2e/tests/assign-pools.spec.ts` - Updated `'Own Ready to assign'` `.check()` to `setToggle(..., true)` for shared React Aria `Checkbox`.
- `e2e/tests/financial-integrity.spec.ts` - Updated select-all `.uncheck()`/`.check()` to `setToggle` and added single-toggle row checkbox + indeterminate select-all guard assertions using `toggleTarget`.

## Selector changes

Grep across `e2e/tests/` checked every accessible name, role, label, and placeholder of the migrated controls (`Account type`, `Account name`, `Off budget`, `Own Ready to assign`, `Type the account name to confirm`, `Select all current transactions`, `Select transaction`). `cleanup.spec.ts`, `currencies.spec.ts`, `first-run.spec.ts`, `switchers.spec.ts`, `accounts-access.spec.ts`, `safe-mode.spec.ts`, `polish.spec.ts`, and all phone specs passed without selector edits. `e2e/tests/accessibility.spec.ts:159` (`getByRole('combobox', { name: 'Account type' })`) was deliberately left untouched because plan `03-15` owns `accessibility.spec.ts`.

| spec:line | before | after | reason |
| --- | --- | --- | --- |
| `e2e/tests/accounts.spec.ts:11` | `dialog.getByRole('combobox', { name: 'Account type' }).selectOption('checking')` | `chooseOption(dialog.getByRole('button', { name: 'Account type' }), 'Everyday')` | `AccountTypeSelect` is now the shared `Select` (desktop trigger `button` + listbox option by visible label, D-05) |
| `e2e/tests/accounts.spec.ts:61` | `dialog.getByRole('combobox', { name: 'Account type' }).selectOption('real_estate')` | `chooseOption(dialog.getByRole('button', { name: 'Account type' }), 'Real estate')` | Same as `:11` — shared `Select` desktop trigger `button` + visible option `'Real estate'` |
| `e2e/tests/assign-pools.spec.ts:14` | `dialog.getByRole('checkbox', { name: /Own Ready to assign/ }).check()` | `setToggle(dialog.getByRole('checkbox', { name: /Own Ready to assign/ }), true)` | `EditAccountModal` `Own Ready to assign` moved to shared React Aria `Checkbox`, whose hidden 1 px `<input>` sits behind `<span aria-hidden="true">`; `setToggle` clicks its wrapping `<label>` and asserts checked state |
| `e2e/tests/financial-integrity.spec.ts:26` | `await all.uncheck();` | `await setToggle(all, false);` | `ReconcilePage` select-all moved to shared React Aria `Checkbox`; `setToggle` clicks the wrapping `<label>` |
| `e2e/tests/financial-integrity.spec.ts:38` (was `:29`) | `await all.check();` | `await setToggle(all, true);` | Same as `:26` — shared React Aria `Checkbox` toggled via `setToggle` |
| `e2e/tests/financial-integrity.spec.ts:34` (new guard) | `await employerBox.click();` (baseline run on old page) | `await toggleTarget(employerBox).click();` | Single-toggle T-03-07 guard clicks the shared `Checkbox`'s wrapping `<label>` (real user target) and asserts one toggle + `$1,000 -> $1,200` + select-all indeterminate |

## Stays native

| File:line | Element | Reason (D-17 / Phase 4 lint allowlist) |
| --- | --- | --- |
| `client/src/components/accounts/EditAccountModal.tsx:160` | `<input ref={fileRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />` | Hidden browser file dialog trigger for account logo upload (WAVG-01 audit row `EditAccountModal.tsx:157`, stays native per D-17) |

## Decisions Made

- Kept `ConnectedBanks.tsx`, `AccountConnections.tsx`, `UpdateValueModal.tsx`, and `e2e/tests/accessibility.spec.ts` completely untouched (per plan prohibitions and D-13/03-15 ownership).
- Preserved `DeleteAccountModal.tsx`'s static accessible name (`Type the account name to confirm`) using `<Label htmlFor>` + `<Input aria-label>` instead of `<Field>` (which would override `aria-label` with `aria-labelledby`).
- Used label-only `stopPropagation` on `ReconcilePage.tsx`'s row checkbox `<td>` so clicking the checkbox toggles once while clicking cell padding or other columns still toggles the row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Orchestrator spec check] Updated `e2e/tests/assign-pools.spec.ts:14` to use `setToggle`**
- **Found during:** Task 1 (cross-spec verification per `<orchestrator_notes>`)
- **Issue:** Moving `EditAccountModal.tsx`'s `Own Ready to assign` checkbox to the shared React Aria `Checkbox` caused `dialog.getByRole('checkbox', { name: /Own Ready to assign/ }).check()` in `e2e/tests/assign-pools.spec.ts:14` to time out after 30 s because React Aria's hidden 1 px `<input>` is covered by `<span aria-hidden="true">` inside its `<label>`.
- **Fix:** Imported `setToggle` from `./fixtures` and replaced `.check()` with `setToggle(dialog.getByRole('checkbox', { name: /Own Ready to assign/ }), true)`.
- **Files modified:** `e2e/tests/assign-pools.spec.ts`
- **Verification:** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/assign-pools.spec.ts` passed (1/1 in 2.1 s).
- **Committed in:** `71dbb047` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — broken e2e selector on migrated `Checkbox`, explicitly required by `<orchestrator_notes>`).
**Impact on plan:** Necessary to keep the full desktop e2e suite green after moving `EditAccountModal` onto shared `Checkbox`. No scope creep.

## Issues Encountered

- Worktree initially had no `node_modules/` in `client/`, `server/`, `e2e/`, or `lint/`; ran lockfile-exact `npm ci` in those four directories using Node 24 without modifying any lockfile or `.npmrc`.

## Verification

- **Precondition:** `grep -c '^Reconcile: match$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` -> `1`
- **Task 1 perl raw-control check** (`AccountTypeSelect.tsx`, `AddAccountModal.tsx`, `EditAccountModal.tsx`, `DeleteAccountModal.tsx`): `0` (was 7)
- **Task 1 file input count** (`EditAccountModal.tsx`): `1`; `accounts.spec.ts` `selectOption` count: `0`
- **Task 2 baseline guard run** (before editing `ReconcilePage.tsx`): `tests/financial-integrity.spec.ts` -> `5 passed (14.9s)`
- **Task 2 perl raw-control check** (`ReconcilePage.tsx`): `0` (was 2)
- **Desktop Playwright (plan verify):** `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts tests/financial-integrity.spec.ts` -> `19 passed (46.8s)`
- **Desktop Playwright (other specs referencing changed controls & Safe mode):**
  - `tests/assign-pools.spec.ts` -> `1 passed (11.0s)`
  - `tests/cleanup.spec.ts tests/currencies.spec.ts tests/first-run.spec.ts tests/switchers.spec.ts tests/accounts-access.spec.ts` -> `34 passed`
  - `tests/safe-mode.spec.ts tests/polish.spec.ts` -> `24 passed`
- **Phone Playwright (390 px, native select & reconcile layout):**
  - `tests/phone/phone-native.spec.ts tests/phone/targets-phone.spec.ts tests/phone/polish-phone.spec.ts` -> `37 passed (1.0m)`
- **Lint & tests:**
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test` -> `86 passed, 0 failed`
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint run lint` -> `0 errors, 126 warnings` (cap 128)
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test` -> `98 files, 930 tests passed`
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client run build` -> passed
  - `cd e2e && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit` -> passed

## Self-Check: PASSED

- All modified files exist on disk and pass Prettier, TypeScript, Vitest, ESLint, and Playwright checks.
- Commits `71dbb047` and `f859045b` exist on `worktree-agent-p0305-a1` with zero unexpected deletions.
- `STATE.md`, `ROADMAP.md`, `ConnectedBanks.tsx`, `AccountConnections.tsx`, and `e2e/tests/accessibility.spec.ts` are untouched.
- Zero stubs or TODO/FIXME markers introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Accounts dialogs (`AccountTypeSelect`, `AddAccountModal`, `EditAccountModal`, `DeleteAccountModal`) and `ReconcilePage` are completely migrated onto the shared controls, ready for wave integration and plan `03-15` (which updates `accessibility.spec.ts:159` for the desktop `Account type` trigger button).

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
