---
phase: 03-screens-on-shared-controls
plan: 30
subsystem: ui
tags: [react, transactions, register, selection, context-menu, bulk-edit, playwright]
gap_closure: true
gap_ids: [G-03-2]

requires:
  - phase: 03-screens-on-shared-controls
    provides: SelectionMenu, selection model, useBulkEdit and POST /transactions/bulk (03-27)
provides:
  - ContextMenu prompt item (MenuPrompt, MenuItem.prompt): a one-field form in place of the menu
  - SelectionMenu items Category…, Payee…, Replace notes…, Remove notes, Add tag, Remove tag, Reports
  - SKIP_TEXT toast wording naming the rows an edit left alone
  - SAVING_PAUSED, the one copy of the paused wording, and the paused rule on every writing item
  - "Share N selected with household" wording in the register bar and its dialog
affects: [03-28, 03-29]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5

plan_head_before: 2820d465803d8400fadc5ca34f46bb2aedef19e1
plan_head_after: ef138464d0b638538ede521ded4a0b29e46b413a
commits: 5

tech-stack:
  added: []
  patterns:
    - "A root-level MenuItem.prompt opens a dialog-role form in place of the menu (Escape or Back returns, Tab wraps inside, Enter applies)"
    - "One whilePaused rule maps the SelectionMenu `writing` list: disabled with hint SAVING_PAUSED"
    - "The category list opens from a zero-size fixed anchor at the closed menu's point"

key-files:
  created: []
  modified:
    - client/src/components/ui/ContextMenu.tsx
    - client/src/components/transactions/SelectionMenu.tsx
    - client/src/components/connection/SavingPausedHint.tsx
    - client/src/components/household/ShareWithHousehold.tsx
    - client/src/hooks/useTransactionEdits.ts
    - e2e/tests/transactions.spec.ts
    - e2e/tests/household.spec.ts

key-decisions:
  - "The prompt's Back control is a plain button, not a menuitem: the panel is a dialog, and a menuitem outside a menu is invalid ARIA"
  - "The toast pluralises matched (Changed 1 of 1 transaction.) instead of the plan's fixed 'transactions'"
  - "The paused rule leaves the 'Share with a household…' form (no households) enabled: it only opens /household"
  - "useTransactionEdits re-exports BulkResult and BulkSkipReason so SelectionMenu still imports nothing from api/"

requirements-completed: [WAVG-05]

duration: 100min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 30: The Edit dialog's options in the selection menu Summary

**Right-clicking a hand-picked selection now offers Category…, Payee…, Replace notes…, Remove notes, Add tag, Remove tag and Reports beside Review and Share, applied at once through the existing bulk route with Undo, naming rows left alone, and every writing item waits while saving is paused.**

## Performance

- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files modified:** 7 (none created)
- **Commits:** 5 task commits (two RED test commits, three feature commits)

## Accomplishments

- ContextMenu gained `MenuItem.prompt` (`MenuPrompt`): choosing it replaces the menu in place with a `dialog` named for the change holding the shared `Input` and `Button`. Apply is disabled while the text is blank, Enter applies, Escape or Back returns to the menu, Tab wraps field, Apply, Back. Items without a prompt behave as before; `menus.spec.ts` is unedited and passes.
- SelectionMenu has every option the Edit dialog had. Category… opens `CategoryPicker` at the menu's point (Uncategorised clears, hidden categories offered, no create). Add tag and Remove tag only appear when tags exist. All edits go through the one `apply` helper (`useBulkEdit`, `expectedCount: count`); no new route or request, server untouched.
- The toast reads `Changed N of M transactions.` plus, when the server skipped rows, `Left as they are: 1 transfer.` built from `SKIP_TEXT` (the dialog's four wordings, copied here until 03-28 deletes BulkEditModal). A refused edit (the server's 409) shows its message unchanged and invalidates the list so the selection prunes the gone row.
- While `useCanSave()` is false every writing item is disabled with the hint `Saving is paused until Allotment reconnects.`, taken from the new exported `SAVING_PAUSED` (the hint component renders the same constant). Clear selection stays enabled; the category list does not open while paused.
- The household button and dialog say "selected": `Share N selected with household`, `Each of the N selected payments`.

## Task Commits

1. **Task 1 (tracer): Payee… from the menu** - `6304c42c` (feat)
2. **Task 2: the rest of the Edit dialog's options** - `8e585cbf` (test, RED), `667650fc` (feat, GREEN)
3. **Task 3: paused rule and "selected" wording** - `38ae1eab` (test, RED), `ef138464` (feat, GREEN)

## RED results

- Task 1 (tracer, single commit): on the 03-27 code the new payee test timed out waiting for the menuitem `Payee…` in `Actions for 2 selected transactions`. Passes now.
- Task 2: of 6 new tests, 5 failed (no `Category…`, `Replace notes…`, `Add tag`, `Reports`, or `Payee…` item in a 1-row menu); the concurrency test passed on the 03-27 code because Review already reports the server's 409 (it pins that behaviour for the register). The transfer test first failed on a wrong checkbox name in the test itself (`Select Transfer: Rainy Day Savings $7`); after fixing the locator it failed on the missing `Category…` item. All 6 pass.
- Task 3: the paused test failed on the Task 2 code at `toBeDisabled` on `Payee…` (connection lost, item still enabled). Passes now with both the allowed and paused states asserted.
- The `gsd_run check tdd-red-evidence` classifier does not read Playwright's reporter format, so RED was inspected by hand: the named test ran, reached the planned assertion and failed there.

## Verification

- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/household.spec.ts tests/connection.spec.ts tests/menus.spec.ts`: 99 passed. An earlier run of transactions, menus and household: 91 passed. (Two timeouts in an earlier run under a machine load average of 55 passed when re-run alone.)
- `npm --prefix client test`: 104 files, 975 tests passed. `tsc --noEmit -p client`: clean.
- `npm --prefix lint run lint`: 0 errors, 121 warnings (cap 122).
- Prettier clean on every changed file.
- Acceptance greps: `MenuPrompt` in ContextMenu 3, `SKIP_TEXT` in SelectionMenu 2, `prompt:` 2, `SAVING_PAUSED` in SavingPausedHint 2, `useCanSave` in SelectionMenu 2, old "picked" wording in `client/src` 0, React Aria imports in SelectionMenu 0, `menus.spec.ts` diff empty, `server/` diff empty.
- Not run here: the Linux gallery pixel baselines (no Docker); CI owns them. ContextMenu has no gallery specimen of the prompt.

## Behaviour changes (owner-requested, 21 November 2026 UAT unless marked)

- The selection menu offers the Edit dialog's options and applies them at once (UAT G-03-2).
- Owner-approved during planning, decision B (distinct from the UAT request; record as such in the 03-29 PR body): edits apply at once with Undo and no preview or confirm dialog.
- Every writing item in the selection menu is disabled while saving is paused (UI-SPEC loading, checker W3).
- The register bar's share button and dialog say "selected", not "picked".

## For 03-29: every changed selector

| Spec | Old | New | Reason |
|---|---|---|---|
| household.spec.ts | bar button `Share 2 picked with household` | `Share 2 selected with household` | wording moves with this plan |
| transactions.spec.ts | (new) menu items `Category…`, `Payee…`, `Replace notes…`, `Remove notes`, `Add tag`, `Remove tag`, `Reports` | n/a | new items |
| transactions.spec.ts | (new) dialogs `Payee for N transaction(s)`, `Notes for N transaction(s)`, textboxes `New payee`, `New notes`, button `Apply`, button `Back` | n/a | the prompt |

Docs for the 03-29 pass: `docs/HOUSEHOLDS.md` still describes "picked with" (see the 03-27 list); the user-facing CHANGELOG line should mention the right-click edits. The dev gallery has no ContextMenu prompt specimen; add one if the controls gallery should cover it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Paused test could not provoke the reconnect state as planned**
- **Found during:** Task 3 (RED run)
- **Issue:** the plan's `visibilitychange` refetch does nothing here: queries have a 30 s `staleTime`, and the connection store only checks on `visibilitychange` while already paused, so the "Can't reach Allotment" status never appeared.
- **Fix:** with the server stopped, the test chooses Review > Mark reviewed from the (still enabled) menu. That write fails, the app reports the network failure, the Connection status appears, and the test then checks the paused state. `startDesktopServer()` stays in `finally`.
- **Files modified:** e2e/tests/transactions.spec.ts
- **Commit:** `38ae1eab`

**2. [Rule 3 - Blocking] e2e verification environment**
- Same as 03-27: no `node_modules` in the worktree (symlinked the main checkout's, then removed) and fixed e2e ports possibly held by sibling runs (shifted by 45000 in `e2e/ports.ts` locally). The ports edit was never staged and was reverted with `git checkout -- e2e/ports.ts`. Nothing reached a commit.

**3. Plan wording refinements (no behaviour impact)**
- The prompt's Back is a plain `button` (ARIA); the toast pluralises `matched`; `useTransactionEdits.ts` re-exports `BulkResult` and `BulkSkipReason`; a context-menu right-click inside the prompt keeps the browser's own menu so paste works.

**Total deviations:** 3 (1 bug, 1 blocking, 1 refinement). **Impact:** none on scope.

## Issues Encountered

- The machine was heavily loaded (load average 55) during the first full run: two tests timed out at 30 s and passed when re-run alone.
- The Task 2 concurrency test already passed on the 03-27 code (Review's 409 path is the same code). It stays as a regression pin for the edit items, which share that path.

## Decisions and notes for later plans

- 03-28 should add Delete N to the SelectionMenu `writing` list: `whilePaused` maps that list, so the paused rule then covers it. The `Share with a household…` item (no households) is outside `writing` on purpose.
- `SKIP_TEXT` now exists twice (SelectionMenu and BulkEditModal) until 03-28 deletes the modal; delete BulkEditModal's copy with it.
- SelectionMenu takes `count` from the table's ticked rows; Select all (03-28) must keep passing the matched count there, since the server checks `expectedCount` against it.

## Known Stubs

None.

## Threat Flags

None. No route, auth path or schema changed. T-03-37 (transfer, split, household rows) and T-03-38 (concurrent change) are covered by e2e; T-03-47 (writes while paused) by the paused test.

## Self-Check: PASSED

- Modified files present: ContextMenu.tsx, SelectionMenu.tsx, SavingPausedHint.tsx, ShareWithHousehold.tsx, useTransactionEdits.ts, transactions.spec.ts, household.spec.ts.
- Commits present on this branch: `6304c42c`, `8e585cbf`, `667650fc`, `38ae1eab`, `ef138464`.
