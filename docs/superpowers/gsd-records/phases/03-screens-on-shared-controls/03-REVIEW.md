---
phase: 03-screens-on-shared-controls
reviewed: 2026-11-22T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - client/src/api/transactions.ts
  - client/src/components/connection/SavingPausedHint.tsx
  - client/src/components/household/ShareWithHousehold.tsx
  - client/src/components/transactions/AddTransactionModal.tsx
  - client/src/components/transactions/BulkDeleteModal.tsx
  - client/src/components/transactions/CategoryPicker.tsx
  - client/src/components/transactions/CategorySelectButton.tsx
  - client/src/components/transactions/SelectionMenu.tsx
  - client/src/components/transactions/SelectionSummary.tsx
  - client/src/components/transactions/TransactionContextMenu.tsx
  - client/src/components/transactions/TransactionTable.tsx
  - client/src/components/ui/Combobox.tsx
  - client/src/components/ui/ContextMenu.tsx
  - client/src/components/ui/DatePicker.test.ts
  - client/src/components/ui/DatePicker.tsx
  - client/src/hooks/useTags.ts
  - client/src/hooks/useTransactionEdits.ts
  - client/src/utils/registerSelection.test.ts
  - client/src/utils/registerSelection.ts
  - e2e/tests/household.spec.ts
  - e2e/tests/phase9.spec.ts
  - e2e/tests/phone/iphone-webapp.spec.ts
  - e2e/tests/phone/polish-phone.spec.ts
  - e2e/tests/phone/register-selection-phone.spec.ts
  - e2e/tests/transactions.spec.ts
  - server/src/routes/phase9.test.ts
  - server/src/routes/transactions.ts
  - server/src/services/transactionMarks.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
  necessity: 1
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the gap-closure plans 03-26..03-31 against `diff_base` 4f28b398. No P0 found. The core contract holds: `selectionTarget` sends `ids` for hand-picked rows and `excludeIds` (or params alone) for Select all; the server bulk and bulk-delete schemas accept both and `targetRows` applies them together with `registerCondition`. The `expectedCount` guard is the client's `ticked.length` against the server's matched or deletable count, so a changed list returns 409 and writes nothing. Mutations invalidate through `refreshAfterEdit`, and that list contains `transactions`, `review` and `reports`. Whole-list selection resets on a params change (JSON key) and hand-picked rows are pruned to the listed rows.

Nothing in `client/src`, `server/src` or `e2e` still references `BulkEditModal`, `useReviewSelection`, `reviewSelection`, `restoreReview` or `/transactions/review`, except the 404 regression test. Stale mentions remain only in generated docs (IN-04). The `transactionMarks.ts` imports are clean.

The defects are a sibling path that missed the paused-saving rule, a divergent copy of the "shareable" rule that now feeds the new menu, a whole-list fallback target, a false "one copy" claim, and a redundant helper.

## Warnings

### WR-01: The single-transaction menu's writing items ignore the paused-saving rule the selection menu now enforces

**File:** `client/src/components/transactions/TransactionContextMenu.tsx:99-210`
**Issue:** `SelectionMenu` disables every writing item while `useCanSave()` is false (`whilePaused`, SelectionMenu.tsx:297-300). The sibling per-row `TransactionContextMenu` has no `canSave` use at all (grep finds none). While offline, "Share with <household>", "Stop sharing with", "Remove from" and the Pay ahead targets stay enabled. They fire `share.mutate`, `stopSharing.mutate` and pay-ahead writes that fail, or queue nothing, and report only through a toast. The same effect reached by two menus now behaves differently. CLAUDE.md "find the sibling paths" calls this P1.
**Fix:** Apply the same rule in `TransactionContextMenu`: read `useCanSave()`, and map the writing items (`share` and its submenu, `stop`, `ahead`) through `{ ...item, disabled: true, hint: SAVING_PAUSED }`. Keep the navigation-only items (`open`, `view`, `setup`, `custom`) enabled. Better, hoist `whilePaused` into one shared helper next to `SAVING_PAUSED` so both menus call it.

### WR-02: Table's `shareable` is a second, narrower copy of `whyNotShareable`, so Select-all share counts include rows the server rejects

**File:** `client/src/components/transactions/TransactionTable.tsx:352` (feeds `shareableTicked`, line ~384, and `SelectionMenu` lines 255-270)
**Issue:** `shareable = amount < 0 && !isParent && !transferTransactionId`. `whyNotShareable` in `TransactionContextMenu.tsx:32` also rejects `isAdjustment` (balance corrections). A balance correction that is selected counts as shareable. The menu then reads "Share N selected with", hides the "N can't be shared" hint, and sends the adjustment id. The server skips it and the toast says "1 not shared". Neither check excludes rows already linked to a household (`tx.household`), so the menu offers to re-share rows that are already shared. The `ShareWithHousehold` compact button in the bar uses the same list. The comment at line 351 and the docstring on `whyNotShareable` both say "as sharing in the register decides", yet there are two implementations. CLAUDE.md: "a parallel version of logic that exists is P1".
**Fix:**
```ts
import { whyNotShareable } from './TransactionContextMenu';
const shareable = (t: Transaction) => whyNotShareable(t) === null && !t.household;
```
Better, move `whyNotShareable` to a util and delete the inline copy.

### WR-03: A null selection falls back to a whole-list target while the menu and delete dialog stay mounted

**File:** `client/src/components/transactions/TransactionTable.tsx:756-766`
**Issue:** `SelectionMenu` receives `selected ? selectionTarget(...) : { params }`. `{ params }` with no `ids` is the Select-all-the-whole-list target. `selected` becomes null whenever the list is empty (the prune effect at line ~362 sets `null`) and when Done is pressed. `SelectionMenu` and its `BulkDeleteModal` stay mounted, and `BulkDeleteModal` reads `params`, `ids` and `excludeIds` from props at the moment Delete is pressed. If the selection ends while the menu or delete dialog is open (a refetch that empties the list), the next action carries `{ params }` and `count = 0`. For an edit the zero `expectedCount` makes the server answer 409. For Delete, `expectedCount` comes from the dialog's earlier preview, so the guard holds only because both sides still agree on a count. The safety rests on that coincidence, not on the target being incapable of reaching the whole list.
**Fix:** Do not give the menu a whole-list target when nothing is selected. Pass `target={selected ? selectionTarget(...) : null}` and render nothing, or disable every item, when it is null. In `BulkDeleteModal`, freeze the target in state when the dialog opens (as `useFormReset` already does for the preview), so the delete uses the same rows that were previewed.

### WR-04: "The one copy" of the paused wording is not the only copy

**File:** `client/src/components/connection/SavingPausedHint.tsx:4`
**Issue:** `SAVING_PAUSED` is documented as "the one copy". The same sentence is still written out in `client/src/hooks/useOffline.ts:19` (no trailing period) and `client/src/pages/Budget.tsx:422`, plus string literals in `CategoryPicker.test.ts:436`, `ReceiptEditor.test.ts:126` and the e2e specs. The two source copies already differ from the constant. CLAUDE.md "lists and constants live in one place and are imported". The comment is now a false unconditional claim (P1 drift).
**Fix:** Import `SAVING_PAUSED` in `useOffline.ts` and `Budget.tsx` (drop the period difference or add a deliberate variant), and have the unit tests import the constant. Otherwise soften the comment to "the selection menu's copy".

### WR-05: `targetOf` and the `Target`/`EditTarget` types duplicate `bulkBody` and `BulkTarget`

**File:** `client/src/hooks/useTransactionEdits.ts:59-70`
**Category:** necessity
**Issue:** `targetOf` strips unset `ids`/`excludeIds` "so an unset field is never sent as undefined". `bulkBody` in `client/src/api/transactions.ts:316-320` already spreads each field only when set, and `JSON.stringify` drops `undefined` anyway. The guarded state cannot occur at the wire. `EditTarget = Pick<BulkTarget,'ids'|'excludeIds'> & { params }` is `BulkTarget` itself, and `type Target = EditTarget` is a second alias for it. Four hooks call `targetOf` for no effect.
**Fix:** Export `BulkTarget` (already exported) as the type, delete `EditTarget`, `Target` and `targetOf`, and pass the object straight to `txApi.*`. Keep one place (`bulkBody`) that decides what goes on the wire.

## Info

### IN-01: `selectedCount` is exported but only the tests use it

**File:** `client/src/utils/registerSelection.ts:77`
**Issue:** `TransactionTable` computes `ticked.length` from `selectedIds` instead. CLAUDE.md lists unused exports as P2.
**Fix:** Delete it and its test cases, or use it for `count`.

### IN-02: Undo-toast messages for review are not formatted like the others

**File:** `client/src/components/transactions/SelectionMenu.tsx:224,230`
**Issue:** `Marked ${n} reviewed.` prints a raw number; the removed hook used `toLocaleString()`, and `changedMessage` does too. It also reads "Marked 0 reviewed." when every row already had that state, and says nothing about skipped rows.
**Fix:** `(n) => \`Marked ${n.toLocaleString()} ${noun(n)} reviewed.\``, and reuse `changedMessage` where it fits.

### IN-03: ContextMenu closes itself on window resize and blur while the prompt field has the keyboard

**File:** `client/src/components/ui/ContextMenu.tsx:124-128`
**Issue:** The `resize` and `blur` listeners call `close(false)`. The new prompt panel (Payee, Replace notes) is the first menu state with a text field. On Android Chrome builds where the soft keyboard resizes the layout viewport, opening it fires `resize` and closes the prompt as it appears. I could not confirm this on a device, so it is an unverified risk. The prompt Apply button also stays enabled if connectivity drops while it is open (the `whilePaused` rule only applies at item level), and the field has no `maxLength` (server caps: payee 500, notes 5000, so an over-long entry returns a 400 toast).
**Fix:** Ignore `resize` while `promptItem` is set (or compare `visualViewport` width), set `maxLength` on the field from a prop, and let the caller disable Apply with a `disabled` prop on `MenuPrompt`.

### IN-04: Generated audit docs still list the deleted file and the old route

**File:** `docs/ux-ui-evidence/SURFACES.md:129,136`, `docs/ui/FORM-CONTROLS-AUDIT.md:107-112,160`
**Issue:** They reference `BulkEditModal.tsx` and the "Pick ..." checkbox label that no longer exist (the label is now "Select ..."). Likely snapshot evidence, but the next regeneration or a reader will find rows for a deleted component.
**Fix:** Regenerate, or mark the rows as superseded by 03-26..03-31.

### IN-05: Ctrl+click is advertised as a toggle but is the context-menu gesture on macOS

**File:** `client/src/components/transactions/TransactionTable.tsx:393-402`
**Issue:** `modifierClick` treats `ctrlKey` as a toggle. On macOS a Ctrl+click is normally delivered as a right-click (`contextmenu`, no `click`), so the toggle likely never runs and the menu opens instead. Cmd+click and Shift+click work. Unverified on all browsers. The bar's hint text names only Shift+click, so there is no user-facing promise broken, but the `ctrlKey` branch may be dead on Mac.
**Fix:** Keep `ctrlKey` for Windows/Linux and say so in the comment, or test on macOS Safari and Chrome before relying on it.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
