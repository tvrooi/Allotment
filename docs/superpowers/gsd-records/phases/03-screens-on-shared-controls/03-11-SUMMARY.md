---
phase: 03-screens-on-shared-controls
plan: 11
subsystem: ui
tags: [react-aria, shared-controls, categories, budget, combobox, radiogroup, checkbox, category-picker, wave-g, wavg-05]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 D-16 reconciliation (`Reconcile: match`) and 03-04 `CategorySelectButton` `groups`/`allowNone`/`allowCreate`/`includeHidden` pass-through"
provides:
  - "`CategoryManager.tsx` inline rename, new category, and new group inputs on shared `Input` (`fieldSize='sm'`)"
  - "`EditCategoryModal.tsx` on shared `Label` + `Input` (preserving accessible name `'Category name'` per D-15), `Combobox` (group, follows account, pool account), card-row `RadioGroup` (`Budget type`), `Checkbox` (`Keep overspending`), and `useCanSave` + `SavingPausedHint`"
  - "`DeleteCategoryModal.tsx` `Merge into` on `CategorySelectButton` over `CategoryPicker` filtered to same-kind groups with source category excluded"
  - "`EditCategoryModal.test.ts` unit test proving bound `'Icon & Name'` label and preserved `'Category name'` accessible name"
affects: [03-15]

tech-stack:
  added: []
  patterns:
    - "Shared `<Label htmlFor={nameId}>Icon & Name</Label>` bound to `<Input id={nameId} aria-label='Category name' />` so visible label stays bound (zero strayLabels) while accessible name stays `'Category name'` per D-15"
    - "Non-empty `NONE_ACCOUNT = '__none__'` sentinel for Combobox account 'none' options (`No account`, `The main Ready to assign`) since shared `Combobox` maps `''` to `selectedKey={null}`"
    - "Card-row `RadioGroup` styling via `[&_label]:flex [&_label]:w-full [&_label]:items-start [&_label]:gap-3 [&_label]:p-3` and `border-brand-600 bg-brand-50` / `border-border hover:bg-hover` (matching 03-06 `Payees.tsx`)"
    - "Filtered `CategorySelectButton` with `allowNone={false}`, `allowCreate={false}`, and `includeHidden` for exact D-15 parity on category deletion merge"

key-files:
  created:
    - client/src/components/settings/EditCategoryModal.test.ts
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-11-SUMMARY.md
  modified:
    - client/src/components/settings/CategoryManager.tsx
    - client/src/components/settings/EditCategoryModal.tsx
    - client/src/components/settings/DeleteCategoryModal.tsx
    - e2e/tests/settings.spec.ts

key-decisions:
  - "Rendered shared `<Label htmlFor={nameId}>Icon & Name</Label>` bound to `<Input id={nameId} aria-label='Category name' />` instead of `<Field>` (which injects `aria-labelledby` and overrides `aria-label`), keeping `'Category name'` as the accessible name per D-15 while keeping zero stray labels (WR-01)"
  - "Used non-empty sentinel `NONE_ACCOUNT = '__none__'` in `EditCategoryModal` account Comboboxes and ignored empty `onChange('')` mid-edit so clearing text to search never snaps back to 'No account' or clears a required group"
  - "Wired `useCanSave()` and `<SavingPausedHint />` into `EditCategoryModal.tsx` (previously missing) per Task 1 and `CLAUDE.md` §Client"
  - "Passed `allowCreate={false}` and `includeHidden` on `DeleteCategoryModal`'s `CategorySelectButton` so hidden same-kind categories remain merge targets and inline creation is not offered during deletion (D-15 parity, mirroring 03-04 WR-04)"

patterns-established:
  - "When a visible `<Label>` covers a compound row (e.g. icon + text input) whose input has its own distinct `aria-label`, bind `<Label htmlFor={id}>` to bare `<Input id={id} aria-label='...' />` so `aria-label` wins under accname without creating a stray label"
  - "Combobox fields with a visible 'none' option map `''` to a sentinel key (`__none__`) and ignore empty intermediate `onChange('')` during typing so blur reverts to the last selected key"

requirements-completed: [WAVG-05]

plan_head_before: 045792d8fa26ac8c2f0449f2ce29e1fefc87a0d8
plan_head_after: 978a5d8d0a34e3b4f1a7bc653e8d647aac5979e7
commits: 5

actuals:
  tokens: 7084
  tasks: 2
  commits: 5

coverage:
  - id: D1
    description: "CategoryManager inline rename, new group, and add category inputs migrated to shared Input at sm size (keeping autoFocus, select-on-focus, Enter, Escape, blur) and EditCategoryModal migrated to shared Label+Input (accessible name 'Category name' preserved), Combobox, card-row RadioGroup, Checkbox, and useCanSave/SavingPausedHint"
    requirement: "WAVG-05"
    verification:
      - kind: unit
        ref: "cd client && npx vitest run src/components/settings (EditCategoryModal.test.ts: 1/1 passed)"
        status: pass
      - kind: e2e
        ref: "Pre-review Playwright desktop tests/household-categories.spec.ts tests/settings.spec.ts (21/21 passed) + phone tests/phone/targets-phone.spec.ts (5/5 passed); post-WR-01/WR-02 settings.spec.ts run deferred to orchestrator (shared e2e ports busy)"
        status: pass
      - kind: other
        ref: "perl raw-control check on CategoryManager.tsx + EditCategoryModal.tsx => 0; client tsc + e2e tsc + eslint (0 errors, 126/128 warnings) passed after WR-01/WR-02"
        status: pass
    human_judgment: false
  - id: D2
    description: "DeleteCategoryModal Merge into migrated to CategorySelectButton over CategoryPicker filtered to same income/expense kind with source category excluded, 'Select a category…' placeholder, allowNone=false, allowCreate=false, includeHidden, and listbox-opened T-03-17 assertions in settings.spec.ts"
    requirement: "WAVG-05"
    verification:
      - kind: e2e
        ref: "Pre-review Playwright desktop tests/settings.spec.ts tests/household-categories.spec.ts (21/21 passed); post-WR-02 settings.spec.ts run deferred to orchestrator (shared e2e ports busy)"
        status: pass
      - kind: other
        ref: "perl raw-control check on CategoryManager.tsx + EditCategoryModal.tsx + DeleteCategoryModal.tsx => 0; client tsc + e2e tsc + eslint (0 errors, 126/128 warnings) passed after WR-01/WR-02"
        status: pass
    human_judgment: false

duration: 26 min
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 11: Category Management and Dialogs on Shared Controls Summary

**Migrated Budget > Categories (`CategoryManager.tsx`, `EditCategoryModal.tsx`, and `DeleteCategoryModal.tsx`) onto the shared `Input`, `Label`, `Combobox`, card-row `RadioGroup`, `Checkbox`, and `CategorySelectButton`/`CategoryPicker` controls with 0 raw non-file form controls remaining, preserved the `'Category name'` accessible name (WR-01), and hardened the T-03-17 merge listbox assertions (WR-02).**

## Performance

- **Duration:** 26 min (including review fixes WR-01 and WR-02)
- **Started:** 2026-11-19T10:53:54Z
- **Completed:** 2026-11-19T11:20:22Z
- **Tasks:** 2 (+ 2 review fixes)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Replaced all three raw `<input>` elements in `client/src/components/settings/CategoryManager.tsx` (inline group rename, add category, add group) with shared `Input` at `fieldSize="sm"`, preserving `inputRef` select-on-focus, `autoFocus`, `Enter`/`Escape`/`onBlur` handling, placeholders, and adding accessible `aria-label`s (`Group name`, `Category name`) without changing visual copy. Removed the `border-brand-500` one-off on inline rename.
- Migrated all form controls in `client/src/components/settings/EditCategoryModal.tsx` onto shared controls:
  - Category name to shared `Label` (`htmlFor={nameId}`, `"Icon & Name"`) + shared `Input` (`id={nameId}`, `aria-label="Category name"`), preserving the exact `'Category name'` accessible name per D-15 with zero stray labels (WR-01).
  - `Group`, `Follows the account`, and `Ready to assign from` to shared `Combobox` (per WAVG-01 audit D-06 user-grown lists), keeping `'No account'` and `'The main Ready to assign'` choices, `isDisabled={groupLocked}`, and help descriptions wired via `description`.
  - `Budget type` radios to shared `RadioGroup` (`label="Budget type"`) and `Radio` with UI-SPEC §2 card-row styling (`border-brand-600 bg-brand-50` selected, `border-border hover:bg-hover` unselected), removing the outer `<label>` wrappers and `<div role="group">`.
  - `Keep overspending` to shared `Checkbox` with its help text wired via `description`.
  - Gated Save on `useCanSave()` and rendered `<SavingPausedHint className="text-right" />`.
- Replaced the raw `<select>` in `client/src/components/settings/DeleteCategoryModal.tsx` with `CategorySelectButton` (`label="Merge into"`, `placeholder="Select a category…"`, `allowNone={false}`, `allowCreate={false}`, `includeHidden`) over `filteredGroups` restricted to the deleted category's income/expense kind with the deleted category removed and empty groups dropped.
- Updated `e2e/tests/settings.spec.ts` for the shared controls, restored line 158's `{ name: 'Category name' }` locator (WR-01), verified T-03-17 self-exclusion and same-kind filtering inside the visibly open `'Search categories'` listbox (WR-02), and added end-to-end coverage for inline group rename (`Escape` cancel + `Enter` commit) and editing group, budget type, linked account, and pool account in `EditCategoryModal`.
- Added `client/src/components/settings/EditCategoryModal.test.ts` verifying `<label for>` binding and preserved `'Category name'` accessible name.
- Left all other `client/src/components/settings/*` files untouched (Phase 4 WAVG-07) and left `e2e/tests/accessibility.spec.ts:190` to plan 03-15 as instructed.

## Task Commits

Each task and review fix was committed atomically on `worktree-agent-p0311-a1`:

1. **Task 1: Category manager and edit category** - `c470734f` (feat)
2. **Task 2: Delete category's Merge into** - `a0e00755` (feat)
3. **Initial plan summary** - `d2e3aed0` (docs)
4. **Review fix WR-01: preserve `'Category name'` accessible name in `EditCategoryModal`** - `27a49396` (fix)
5. **Review fix WR-02: wait for Merge into listbox to open before T-03-17 absence checks** - `978a5d8d` (fix)

## Files Created/Modified

- `client/src/components/settings/CategoryManager.tsx` - Replaced the three raw `<input>` elements with shared `Input` (`fieldSize="sm"`), preserving `ref`, `autoFocus`, select-on-focus, and key/blur handlers.
- `client/src/components/settings/EditCategoryModal.tsx` - Replaced raw `<input>`, `<select>`, radio `<input>`, and checkbox `<input>` elements with shared `Label`+`Input` (preserving `'Category name'` accessible name), `Combobox`, card-row `RadioGroup`/`Radio`, `Checkbox`, and wired `useCanSave()` + `<SavingPausedHint />`.
- `client/src/components/settings/EditCategoryModal.test.ts` - Created unit test verifying `<label for={id}>Icon & Name</label>` binding and `aria-label="Category name"` without `aria-labelledby` override (WR-01).
- `client/src/components/settings/DeleteCategoryModal.tsx` - Replaced the Merge into `<select>` with `CategorySelectButton` over same-kind, source-excluded `filteredGroups`.
- `e2e/tests/settings.spec.ts` - Updated changed category-editor and merge selectors (listed below; `:158` `'Category name'` restored unchanged per WR-01) and added end-to-end coverage for inline group rename, `RadioGroup`, `Combobox`, and open-listbox T-03-17 merge filtering (WR-02).

## Selector changes

`e2e/tests/settings.spec.ts:158` (`dialog.getByRole('textbox', { name: 'Category name' })`) is **restored unchanged** after WR-01. `e2e/tests/household-categories.spec.ts` needed no selector changes (it tests `/review` and `/household` and passed unchanged). `e2e/tests/accessibility.spec.ts:190` (`getByRole('group', { name: 'Budget type' })`) was deliberately left untouched for plan 03-15 as specified in Task 1.

| spec:line | before | after | reason |
| --- | --- | --- | --- |
| `e2e/tests/settings.spec.ts:137` | `await keep.check();` | `await setToggle(keep, true);` | `Keep overspending` is now the shared React Aria `Checkbox`, whose hidden 1 px `<input>` sits behind `<span aria-hidden="true">`; `setToggle` from `./fixtures` clicks its wrapping `<label>` and asserts checked state |
| `e2e/tests/settings.spec.ts:145` | `await keep.uncheck();` | `await setToggle(keep, false);` | Same as `:137` — shared React Aria `Checkbox` toggled via `setToggle` |
| `e2e/tests/settings.spec.ts:261-266` (was `:184`) | `dialog.getByRole('combobox', { name: 'Merge into' }).selectOption(transit.id)` | `dialog.getByRole('button', { name: 'Merge into: Select a category…' }).click()`, wait for `Transit` visible inside `page.getByRole('listbox', { name: 'Search categories' })`, assert `Parking` & `Paychecks` count 0 inside that listbox, then click `Transit` | `DeleteCategoryModal` `Merge into` moved from native `<select>` to `CategorySelectButton` over `CategoryPicker` (trigger button + searchable listbox options); open-listbox check prevents vacuous `toHaveCount(0)` (WR-02) |

## Stays native

Per `docs/ui/FORM-CONTROLS-AUDIT.md` and plan `<output>`, both `IconPickerPopover` instances remain unchanged (an icon grid dialog, not a form list):

- `client/src/components/settings/CategoryManager.tsx:287` — `IconPickerPopover` for picking a new category's icon.
- `client/src/components/settings/EditCategoryModal.tsx:138` — `IconPickerPopover` for changing a category's icon.

## Review fixes

Addressed both warnings from `.git/gsd-handoff/03-11-REVIEW.md` (`WR-01`, `WR-02`), one commit each:

1. **WR-01 (`27a49396`) — Preserve `'Category name'` accessible name on `EditCategoryModal`:**
   - **RED:** Added `client/src/components/settings/EditCategoryModal.test.ts`; ran `cd client && npx vitest run src/components/settings` -> 1/1 failed (missing `aria-label="Category name"` and `Field` injected `aria-labelledby`).
   - **Fix:** Replaced `<Field label="Icon & Name">` with `<div className="flex flex-col gap-1"><Label htmlFor={nameId}>Icon & Name</Label>...<Input id={nameId} aria-label="Category name" ... /></div>` in `EditCategoryModal.tsx`, and reverted `e2e/tests/settings.spec.ts:158` back to `{ name: 'Category name' }`.
   - **GREEN:** `cd client && npx vitest run src/components/settings` -> 1/1 passed; `cd client && npx tsc --noEmit` -> 0 errors; `cd e2e && npx tsc --noEmit` -> 0 errors; `perl` raw-control check -> 0.
2. **WR-02 (`978a5d8d`) — Wait for Merge into listbox to be visibly open before T-03-17 absence checks:**
   - **Fix:** In `e2e/tests/settings.spec.ts:261-266`, scoped to `const list = page.getByRole('listbox', { name: 'Search categories' })`, asserted `await expect(categoryOption(list, 'Transit')).toBeVisible()` before checking `Parking` and `Paychecks` have count 0 inside `list`, then clicked `categoryOption(list, 'Transit')`.
   - **Verification:** `cd client && npx vitest run src/components/settings` (1/1 passed), `cd client && npx tsc --noEmit` (0 errors), `cd e2e && npx tsc --noEmit` (0 errors), `npm --prefix lint run lint` (0 errors, 126/128 warnings). Playwright re-run deferred to the orchestrator because another executor holds the shared e2e ports.

## Decisions Made

- Kept shared `<Label htmlFor={nameId}>Icon & Name</Label>` + `<Input id={nameId} aria-label="Category name" />` so D-15's accessible name contract and `accessibility.spec.ts` `strayLabels` both hold simultaneously.
- Used a non-empty sentinel value (`NONE_ACCOUNT = '__none__'`) for the two optional account Comboboxes (`Follows the account` and `Ready to assign from`) and ignored empty `onChange('')` during intermediate typing so React Aria displays `'No account'` / `'The main Ready to assign'` when unset, allows clearing text to filter, and reverts cleanly on blur without saving an empty `groupId`.
- Added `allowCreate={false}` and `includeHidden` on `DeleteCategoryModal`'s `CategorySelectButton` to keep exact D-15 parity with the old `<select>` (mirroring 03-04 WR-04 on `CurrencyDifference`).
- Left `e2e/tests/accessibility.spec.ts:190` untouched for plan 03-15 per Task 1 instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired `useCanSave()` and `<SavingPausedHint />` into `EditCategoryModal.tsx`**
- **Found during:** Task 1 (`EditCategoryModal.tsx`)
- **Issue:** Task 1 requires keeping the Save button on `useCanSave` and `SavingPausedHint` (matching `CLAUDE.md` §Client), but `EditCategoryModal.tsx` did not previously import or wire either.
- **Fix:** Imported `useCanSave` from `../../hooks/useConnection` and `SavingPausedHint` from `../connection/SavingPausedHint`, guarded `handleSubmit` and Save's `disabled` prop with `!canSave`, and rendered `<SavingPausedHint className="text-right" />`.
- **Files modified:** `client/src/components/settings/EditCategoryModal.tsx`
- **Verification:** `npm run build --prefix client`, `npm --prefix lint run lint`, `settings.spec.ts` (pre-review 19/19 passed).
- **Committed in:** `c470734f`

**2. [D-15 / Review WR-01] Used shared `Label` + `Input` instead of `Field` for `EditCategoryModal`'s compound `Icon & Name` row**
- **Found during:** Independent review (`WR-01`)
- **Issue:** `<Field label="Icon & Name">` wraps React Aria `TextField`, which sets `aria-labelledby` pointing to `<Label>`, overriding `aria-label="Category name"` and changing the textbox's accessible name against D-15.
- **Fix:** Rendered shared `<Label htmlFor={nameId}>Icon & Name</Label>` bound to shared `<Input id={nameId} aria-label="Category name" />` and reverted `e2e/tests/settings.spec.ts:158` to `{ name: 'Category name' }`.
- **Files modified:** `client/src/components/settings/EditCategoryModal.tsx`, `client/src/components/settings/EditCategoryModal.test.ts`, `e2e/tests/settings.spec.ts`
- **Verification:** `EditCategoryModal.test.ts` (1/1 passed), `client tsc --noEmit`, `e2e tsc --noEmit`, `perl` raw-control check (`0`).
- **Committed in:** `27a49396`

---

**Total deviations:** 2 auto-fixed (1 Rule 2 missing critical, 1 D-15 review fix WR-01)
**Impact on plan:** Preserves D-15 accessible-name parity and `CLAUDE.md` §Client connection gating with 0 raw controls remaining.

## Verification

- Precondition check: `grep -c '^Reconcile: match$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` → `1`
- Raw-control check (`perl` regex from Task 2) on `CategoryManager.tsx`, `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx` → `0` (down from 10)
- Post-WR-01/WR-02 checks:
  - `cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run src/components/settings` → **1 file / 1 test passed** (`EditCategoryModal.test.ts`)
  - `cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit` → passed (0 errors)
  - `cd e2e && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit` → passed (0 errors)
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint run lint` → passed (0 errors, 126 warnings; cap 128; 0 new warnings)
- Pre-review checks (Playwright re-run of `settings.spec.ts` after WR-01/WR-02 delegated to orchestrator because another executor is using the fixed e2e ports):
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build --prefix client` → passed
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm test --prefix client` → passed
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test` → passed (0 failed)
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/settings.spec.ts tests/household-categories.spec.ts` → **21 passed (39.2s)**
  - `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=phone tests/phone/targets-phone.spec.ts` → **5 passed (14.7s)**

## Threat Model Verification

- **T-03-17 (Merge into filtering & self-exclusion):** Verified in `DeleteCategoryModal.tsx` (`filteredGroups` filters by `g.isIncome === sourceIsIncome` and removes `c.id === categoryId`) and asserted inside the visibly open `'Search categories'` listbox in `e2e/tests/settings.spec.ts:261-266` (`Transit` visible before checking `'Parking'` and `'Paychecks'` have count 0).
- **T-03-SC (npm installs):** No packages added (D-02); only existing lockfile `npm ci` was run in the fresh worktree.
- No new security surface introduced; no server files modified.

## Issues Encountered

- Running `npm ci` in `client/`, `server/`, `e2e/`, and `lint/` was needed in the fresh worktree before build, lint, and Playwright verification could execute (using lockfiles with `.npmrc` `ignore-scripts=true` intact).
- React Aria `<TextField>` inside `<Field>` injects `aria-labelledby`, overriding `aria-label="Category name"` on `<Input>`; resolved in WR-01 (`27a49396`) by binding shared `<Label htmlFor={nameId}>` to shared `<Input id={nameId} aria-label="Category name" />`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Budget > Categories (`CategoryManager.tsx`, `EditCategoryModal.tsx`, `DeleteCategoryModal.tsx`) is complete with WR-01 and WR-02 resolved; ready for orchestrator Playwright run of `settings.spec.ts`.
- Plan 03-15 will update `e2e/tests/accessibility.spec.ts:190` from `getByRole('group', { name: 'Budget type' })` to `getByRole('radiogroup', { name: 'Budget type' })`.
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` were left untouched for the orchestrator's post-wave merge.

## Self-Check: PASSED

- Created/modified files verified on disk: `client/src/components/settings/CategoryManager.tsx`, `client/src/components/settings/EditCategoryModal.tsx`, `client/src/components/settings/EditCategoryModal.test.ts`, `client/src/components/settings/DeleteCategoryModal.tsx`, `e2e/tests/settings.spec.ts`, `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-11-SUMMARY.md`.
- Commits verified in `worktree-agent-p0311-a1` ancestry: `c470734f`, `a0e00755`, `d2e3aed0`, `27a49396`, `978a5d8d`.
- `docs/superpowers/gsd-records/STATE.md`, `docs/superpowers/gsd-records/ROADMAP.md`, and all other `client/src/components/settings/*` files untouched.
- No stubs, placeholders, skips, sleeps, or new threat surface introduced.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
