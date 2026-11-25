---
phase: 03-screens-on-shared-controls
plan: 27
subsystem: ui
tags: [react, transactions, register, selection, context-menu, bulk-edit, fast-check, playwright]
gap_closure: true
gap_ids: [G-03-2]

requires:
  - phase: 03-screens-on-shared-controls
    provides: shared ContextMenu, Checkbox, useBulkEdit and POST /transactions/bulk (03-12)
provides:
  - Register-wide Select mode (checkbox on every row and phone card) replacing Pick to share
  - SelectionMenu (Review, Share N selected with, Clear selection) applied at once with Undo
  - utils/registerSelection.ts, a pure selection model (toggle, range, select all, prune, target)
  - Cmd/Ctrl+click and Shift+click selection that never opens details
  - BulkTarget.excludeIds and ids/excludeIds on the four bulk hooks
affects: [03-28, 03-29, 03-30]

actuals:
  tokens: 12500
  tasks: 2
  commits: 4

plan_head_before: 4f28b3986f431d2b4a4a6fdaf233694d1e28942b
plan_head_after: 54deb84a26d2584f4890e055a41be417413d511d
commits: 4

tech-stack:
  added: []
  patterns:
    - "Selection is one pure module read through selectionTarget; the table never builds an id list itself"
    - "Writing menu items live in one list (SelectionMenu `writing`) so one rule can disable them all"

key-files:
  created:
    - client/src/components/transactions/SelectionMenu.tsx
    - client/src/utils/registerSelection.ts
    - client/src/utils/registerSelection.test.ts
  modified:
    - client/src/components/transactions/TransactionTable.tsx
    - client/src/components/transactions/TransactionContextMenu.tsx
    - client/src/hooks/useTransactionEdits.ts
    - client/src/api/transactions.ts
    - e2e/tests/transactions.spec.ts
    - e2e/tests/household.spec.ts

key-decisions:
  - "Share N selected with counts the rows sharing accepts, with a hint naming how many of the selection can't be shared"
  - "A Shift range moves the anchor to the clicked row and only ever adds; Select all (kind all) has no anchor, so Shift+click there toggles"
  - "Pruning waits for the list query to succeed, because the list is empty while a new filter loads and would wipe the selection"

requirements-completed: [WAVG-05]

duration: 60min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 27: Register selection and its right-click menu Summary

**Hand-picked register selection (Select button, per-row checkboxes, Cmd/Ctrl and Shift clicks) with one right-click menu that marks the selected rows reviewed or shares them through the existing bulk route, Undo in the toast, no dialog.**

## Performance

- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 9 (3 created)
- **Commits:** 4 task commits

## Accomplishments

- Pick to share became Select, the one register selection: every row and phone card gets a checkbox, the bar is `Selected transactions` (N selected, More actions, household share, Clear selection, Done), and Pick all shown is gone.
- Right-click, Shift+F10, the Menu key, long press or the card's ⋯ on a selected row opens `Actions for N selected transactions`. Review > Mark reviewed / Mark not reviewed goes through `useBulkEdit` and `POST /transactions/bulk` with the register's params plus the selected ids and `expectedCount`; the toast says `Marked N reviewed.` and Undo puts every changed row back. A refused edit shows the server's message and refreshes the list.
- `registerSelection.ts` is a pure model (24 Vitest cases including 7 fast-check properties) and feeds TransactionTable: Cmd/Ctrl+click toggles, Shift+click selects the range in the list's order (same rows from either end), neither opens details, and the selection is pruned to listed rows after every successful list load.
- Server untouched (`git diff` on `server/` is empty); no package added.

## Task Commits

1. **Task 1: tick rows, right-click one, mark them reviewed** - `c14015d5` (feat)
2. **Task 2: selection model** - `46a3eb56` (test, RED), `7fb6afc3` (feat, GREEN), `54deb84a` (feat, table integration and e2e)

## RED results (recorded before each change)

- Task 1: the new e2e test failed on the unmodified code at `getByRole('button', { name: 'Select', exact: true })` (no Select button; the button was Pick to share).
- Task 2 unit: `registerSelection.test.ts` failed with "Failed to resolve import ./registerSelection" before the module existed; 24/24 pass after.
- Task 2 e2e: with the model not yet wired into the table, 3 of the 4 new tests failed (modifier clicks, anchor/range, search pruning); the fourth (empty selection) already passed from Task 1. All 4 pass after.

## Verification

- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/household.spec.ts`: 79 passed (full files, run before the last unused-import removal; the 7 selection and sharing tests were re-run after it, 7 passed).
- `npm --prefix client test`: 104 files, 974 tests passed. `tsc --noEmit -p client`: clean.
- eslint on the changed client files: 0 errors; the 5 warnings in TransactionTable.tsx are pre-existing (dayAmount dependency, overlay portal handlers), so the cap is unchanged.
- Prettier check clean on every changed file.
- Acceptance greps: `pickedIds` 0, `Pick to share` in TransactionTable 0, `excludeIds` in api 3, `useBulkEdit` in SelectionMenu 2, `registerSelection` in TransactionTable 1, `fc.property` 7. SelectionMenu imports nothing from `api/` (it takes types and the hook from `hooks/useTransactionEdits`).

## Behaviour changes (owner-requested, 21 November 2026 UAT unless marked)

- The register selects individual transactions and acts on them from a right-click menu, with no edit dialog (owner UAT request, G-03-2).
- Owner-approved during planning, decision B (distinct from the UAT request): Pick to share is renamed Select and becomes the one selection; the Pick all shown button is removed; edits apply at once with Undo instead of a preview and confirm.
- The Select button shows for every register with rows, not only when a household exists.
- Checkboxes are never disabled; rows sharing refuses are simply left out of the share action and counted in its hint.

## For 03-29: every changed selector

| Spec | Old | New | Reason |
|---|---|---|---|
| household.spec.ts (2 tests) | button `Pick to share` | button `Select` (exact) | renamed |
| household.spec.ts | checkboxes `/^Pick X/` | `/^Select X/` | checkbox names |
| household.spec.ts | menu item and submenu `Share 2 picked with` | `Share 2 selected with` | SelectionMenu |
| household.spec.ts | region `Picked payments` | `Selected transactions` | renamed bar |
| household.spec.ts | `2 picked`, `0 picked` | `2 selected`, `0 selected` | bar count |
| household.spec.ts | bar button `Share 2 picked with household` | unchanged | wording moves in 03-30 |

Docs that still describe Pick to share and need the 03-29 pass: `docs/HOUSEHOLDS.md` (lines 66-68 "Pick to share", "Pick all shown", "picked with"; line 96) and the user-facing line in CHANGELOG; `docs/AUDIT-2026-11.md:101` is historical. `client/src/components/household/ShareWithHousehold.tsx` still says "picked" in the bar button, its modal text and its header comment; 03-30 changes that wording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `households` query left in TransactionTable**
- **Found during:** Task 2 lint
- **Issue:** the household list was only used by the removed share-picking button; eslint reported `no-unused-vars` (an error).
- **Fix:** removed the query and its two imports.
- **Commit:** `54deb84a`

**2. [Rule 3 - Blocking] e2e verification environment**
- **Found during:** Task 1 RED run
- **Issue:** the fixed e2e ports (3169-3180) were held by another run (the parallel 03-26 worktree), and the worktree had no `node_modules`.
- **Fix:** symlinked the main checkout's `client`, `server`, `e2e` and `lint` `node_modules` (gitignored) and shifted the ports by 40000 in `e2e/ports.ts` locally. The ports edit was never staged and was reverted with `git checkout -- e2e/ports.ts`; the symlinks were removed. Nothing about this reached a commit.

**3. SelectionMenu gained an `onClearSelection` prop**
- The plan lists the props as `menu, target, count, shareableIds, onClose`, but Clear selection needs to empty the table's selection, so the menu takes that callback too. 03-28 and 03-30 should extend the same props.

**Total deviations:** 3 (1 bug, 1 blocking, 1 interface addition). **Impact:** none on scope.

## Issues Encountered

- A plain click in the "details still open" e2e landed on the row's category button (Playwright clicks the centre); the test now clicks the payee area, which is the part of the row that opens details (#243).

## Decisions and notes for later plans

- `selectionTarget(sel, params, listed)` already returns `{ params }` / `{ params, excludeIds }` for Select all, and the four bulk hooks and `BulkTarget` take `ids` and `excludeIds`, so 03-28 only has to set `selectAll()` and route Delete through the same target. `useBulkDelete`/`usePreviewBulkDelete` already accept the target shape.
- `useBulkEdit`'s `message` is `(changed, result)`; `EditTarget` and `BulkChanges` are exported from `hooks/useTransactionEdits.ts` for SelectionMenu and 03-30.
- In SelectionMenu the writing items are the `writing` array (Review, Share); 03-30's paused rule should map over it, and 03-28 should add Delete N to it.
- The phone tap-to-toggle while selecting is 03-28; this plan only puts the checkboxes on cards and opens the menu from ⋯, long press or More actions.

## Known Stubs

None.

## Threat Flags

None. No route, auth path or schema changed (T-03-40); ids are pruned to listed rows and the server intersects them with the register's params and checks `expectedCount` (T-03-36).

## Self-Check: PASSED

- Created files present: `SelectionMenu.tsx`, `registerSelection.ts`, `registerSelection.test.ts`.
- Commits present on this branch: `c14015d5`, `46a3eb56`, `7fb6afc3`, `54deb84a`.
