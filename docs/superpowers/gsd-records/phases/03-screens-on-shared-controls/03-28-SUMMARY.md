---
phase: 03-screens-on-shared-controls
plan: 28
subsystem: ui
tags: [react, transactions, register, selection, context-menu, bulk-delete, playwright, phone]
gap_closure: true
gap_ids: [G-03-2]

requires:
  - phase: 03-screens-on-shared-controls
    provides: register selection model, SelectionMenu, excludeIds on the bulk hooks (03-27)
  - phase: 03-screens-on-shared-controls
    provides: the Edit dialog's options in the menu, the SAVING_PAUSED rule (03-30)
provides:
  - Select all N as the register's whole-list selection (All N selected, excludeIds for unticked rows)
  - Delete N in the selection menu, behind BulkDeleteModal's preview and typed word, for any selection target
  - Filter-change reset of a whole-list selection, compared by a JSON key of params
  - Phone tap-to-toggle on cards while selecting, and the phone path proved at 390 px
removed:
  - BulkEditModal.tsx, useReviewSelection, reviewSelection, restoreReview, ReviewChange, and SelectionSummary's action group
affects: [03-29, 03-31]

actuals:
  tokens: 15600
  tasks: 3
  commits: 4

plan_head_before: 82485787adab132ed8ec4b69fd7c35fcc5715a26
plan_head_after: 5fa9a81474882c688a3733e2beb230d8edce3be9
commits: 4

tech-stack:
  added: []
  patterns:
    - "One selection (hand-picked or whole list) feeds one bar and one menu; the table never builds an id list itself"
    - "A whole-list selection is reset by an effect keyed on JSON.stringify(params), so equal params keep it and any other filter ends it"

key-files:
  created:
    - e2e/tests/phone/register-selection-phone.spec.ts
  modified:
    - client/src/components/transactions/SelectionMenu.tsx
    - client/src/components/transactions/BulkDeleteModal.tsx
    - client/src/components/transactions/SelectionSummary.tsx
    - client/src/components/transactions/TransactionTable.tsx
    - client/src/components/household/ShareWithHousehold.tsx
    - client/src/hooks/useTags.ts
    - client/src/api/transactions.ts
    - e2e/tests/transactions.spec.ts
    - e2e/tests/phase9.spec.ts
  deleted:
    - client/src/components/transactions/BulkEditModal.tsx

key-decisions:
  - "The bar says All N selected only while nothing is unticked; the Select all N button is hidden then and shows again once a row is unticked, so it re-selects the whole list"
  - "After Select all the bar's Share is the list's own link (by the list's params); with rows unticked it is the compact button sharing the ticked rows sharing accepts"
  - "Selecting ends when the list has no rows (not only after a whole-list review)"

requirements-completed: [WAVG-05]

duration: ~100min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 28: Select all and Delete through the one selection, the Edit dialog removed, the phone path Summary

**Select all N now ticks every row as the register's whole-list selection, the selection menu offers Delete N behind the same typed confirmation, BulkEditModal and the list's old action group are deleted, and on a phone a tap ticks a card while selecting.**

## Performance

- **Tasks:** 3 (Task 1 tracer, Task 2 TDD, Task 3 auto)
- **Files:** 11 changed (1 created, 1 deleted), +485 / -655 lines
- **Commits:** 4 task commits (one RED test, three feature commits)

## Accomplishments

- **Delete from the menu (tracer).** `Delete N` (danger, after Share) opens BulkDeleteModal mounted in SelectionMenu. The modal takes `ids` and `excludeIds` beside `params` and passes them to the preview and the delete; title, sample, kept-reconciled note and typed word are unchanged. It sits in the `writing` list, so the paused rule disables it with the SAVING_PAUSED hint. When no household exists the `Share with a household…` item (which only opens /household) is still exempt from the paused rule and keeps its place before Delete.
- **Whole-list selection.** `Select all N` calls `selectAll()`. The bar reads `All N selected` until a row is unticked, then `N-1 selected`; edits and deletes send `excludeIds`. Right-click on any ticked row, the bar's More actions and (phone) a card's ⋯ open the one selection menu.
- **Filter change ends it.** An effect keyed on `JSON.stringify(params)` turns a whole-list selection into an empty one (selecting stays on, bar `0 selected`); hand-picked rows stay and are pruned to what is still listed. When the list has no rows selecting ends.
- **Old action group and dialog gone.** SelectionSummary keeps money movement, count, date span, MissingRateNote, Export and `Select all N` (new `onSelectAll` and `selectingAll` props). Mark reviewed with its confirm, Edit N, the list Share link, More actions with Delete, Clear selection and their state are removed. BulkEditModal.tsx (and with it its copy of `SKIP_TEXT`), `useReviewSelection`, `reviewSelection`, `restoreReview` and `ReviewChange` are deleted; nothing in `client/src` or `e2e` mentions them. The server route `/transactions/review` is untouched (03-31).
- **Phone.** While selecting, a tap on a card toggles it (the card's `onOpenDetail` becomes the toggle; TransactionCard unchanged). The phone hint now reads "Tap transactions to select them, then use More actions or ⋯." instead of mentioning right-click. `register-selection-phone.spec.ts` proves select, double toggle, no sideways overflow, 44 px targets (More actions, Clear selection, Done, Share, a card checkbox, a card's ⋯), Category… with the shared list's search focused, Review > Mark reviewed with Back, and `Delete 2` in the menu with the menu open and no overflow.

## Task Commits

1. **Task 1 (tracer): Delete from the selection menu** - `2a9de974` (feat; tests and implementation in one commit, as 03-30's tracer)
2. **Task 2: whole-list selection, dialog removed** - `3ab08350` (test, RED), `baf70a30` (feat, GREEN)
3. **Task 3: phone path** - `5fa9a814` (feat, with the new phone spec)

## RED results (recorded before each change)

- **Task 1:** three tests failed on the unmodified code, all at the missing menuitem `Delete 2` in `Actions for 2 selected transactions` (the two new delete tests and the extended paused test, which failed at `toBeEnabled` on `/^Delete 2/` before any pause). All pass now, with the paused state asserting `Delete 2` disabled then enabled again.
- **Task 2:** six tests failed (the rewritten phase9 review test at the missing `Review` item in `Actions for 3 selected transactions`; five transactions.spec cases at the missing `Selected transactions` region, because Select all did not select). After GREEN, two of my own test bugs surfaced and were fixed (the unticked-row cases passed `setToggle` its default `checked = true`, a no-op on a ticked box; one case looked for a payee it had just renamed). All 6 pass.
- **Task 3:** `register-selection-phone.spec.ts` failed on the unmodified table at the second card tap (the first tap opened the full-screen details overlay, which intercepted the next pointer event). That is the recorded check that the spec fails if the tap-to-toggle line is reverted. It passes now.
- The `gsd_run check tdd-red-evidence` classifier does not read Playwright's reporter (as noted in 03-30), so RED was inspected by hand: each named test ran, reached the planned assertion and failed there.

## Verification

- `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/phase9.spec.ts tests/cleanup.spec.ts tests/household.spec.ts tests/menus.spec.ts tests/connection.spec.ts`: 112 passed (final run, after the last code change). cleanup.spec.ts and household.spec.ts are unedited.
- `--project=phone tests/phone/register-selection-phone.spec.ts household-menu-phone.spec.ts phone.spec.ts phone-native.spec.ts`: 28 passed (those last three unedited).
- `npm --prefix client test`: 104 files, 975 tests passed. `tsc --noEmit -p client`: clean. `npm run build --prefix client`: ok.
- `npm --prefix lint run lint`: 0 errors, 121 warnings (cap 122, no warning added).
- Prettier clean on every changed file.
- Acceptance greps: `test -e BulkEditModal.tsx` prints 1; `grep -rl BulkEditModal client/src e2e/tests | wc -l` 0; review-selection names in `client/src` 0; `PencilLine|ConfirmModal|BulkDeleteModal` in SelectionSummary 0; `excludeIds` in BulkDeleteModal 4; `server/` diff empty; no package added.
- Not run here: Linux gallery pixel baselines (no Docker). SelectionSummary and the selection bar have no gallery specimen.

## Behaviour changes (owner-requested, 21 November 2026 UAT unless marked)

- Select all N ticks every row; the list's own action group is replaced by the selection bar and menu (Mark reviewed, edits, Share, Delete). No Edit dialog exists.
- Delete keeps its typed confirmation and is only reachable from an explicit selection's menu.
- Owner-approved during planning, decision B (distinct from the UAT request; record as such in the 03-29 PR body): Mark reviewed on the whole list applies at once with Undo, no confirm dialog.
- Planner's choice within the UAT request: on phones a tap on a card toggles it while selecting.
- Whole-list selection ends on a filter change; selecting ends when the list is empty. (Reported: before, `acting` reset on a params change.)
- After Select all with a row unticked, the bar's Share shares only the ticked rows sharing accepts (the compact button), not the list.

## For 03-29: every changed selector

| Spec | Old | New | Reason |
|---|---|---|---|
| phase9.spec.ts "marks the selection reviewed after confirming, and undoes it" | renamed "marks the whole list reviewed from the selection menu, and undoes it"; `Mark reviewed` button, dialog button `Mark 3 reviewed` | button `More actions`, menu `Actions for 3 selected transactions`, menuitem `Review`, menu `Review`, menuitem `Mark reviewed` | the old group and its confirm are gone (decision B); toast, `No transactions found`, Undo, `3 transactions`, Redo assertions unchanged |
| transactions.spec.ts "bulk edit sets the category, notes, payee and report visibility on the whole list" | `Edit 2` button, dialog `Edit 2 transactions`, `Category change`/`Notes change`/`Reports` selects, `Review changes`, `Does this look right?`, `Apply to 2` | rewritten as "Select all, then the selection menu sets …": `Select all 2`, bar `All 2 selected`, right-click a row, menuitems `Category…`, `Payee…`, `Replace notes…`, `Reports` > `Hide from reports`; the same API assertions | the dialog is deleted |
| transactions.spec.ts (new) | n/a | "ticked transactions are deleted from the right-click menu after typing delete", "a ticked reconciled transaction is kept, and the dialog says so", "a row unticked after Select all is left out of a review…", "…is not deleted", "changing the date range ends a whole-list selection", "a one-row list reads All 1 selected, and reviewing the whole list ends selecting" | new behaviour |
| transactions.spec.ts "while saving is paused …" | writing items `Payee…`, `Review`, `Add tag`, `Share 2 selected with` | adds `/^Delete 2/` | Delete N joins the paused rule |
| Product text | bar `N selected`; Select all group `N selected`, `Actions for N transactions`, `Mark reviewed`, `Edit N`, list `Share with household`, list `More actions` > `Delete N`, `Clear selection` | bar `All N selected` / `N-1 selected`; the one `Selected transactions` bar with `More actions`, `Share …`, `Clear selection`, `Done`; menuitem `Delete N`; Select all N hidden while the whole list is selected | one selection, bar and menu |
| Phone hint | "Tick transactions, then right-click one of them…" | "Tap transactions to select them, then use More actions or ⋯." | no right-click on a phone |

Docs for the 03-29 pass that still name removed code or the old flow: `docs/ui/FORM-CONTROLS-AUDIT.md` (BulkEditModal rows at lines 107-112, 854, 856, 917, 927, 928, 1066, 1070, 1193), `docs/ui/HANDOVER-UI.md:31`, `docs/ux-ui-evidence/surface-files.txt:26` and `SURFACES.md:129,136`, `docs/HOUSEHOLDS.md` (picked wording, from 03-27), and the user-facing CHANGELOG line. `server/src/routes/transactions.ts` and `services/transactionMarks.ts` still carry the review route for 03-31.

## Safari finding for the owner (assumption, not a root cause)

The 03-UAT.md test 2 screenshot's Edit 44 transactions dialog has the pre-G2 layout (native selects with Safari's up/down arrows, auto-width Category and Notes lists, 21 px tall), which matches BulkEditModal before c283170c (up.176), not the file this plan deleted (the shared Select's button trigger with a chevron, 160 px mode lists). `useIsPhone` cannot be true in a 1421 px window. That suggests the server that served it ran a build older than up.176, but nobody has checked the running build's version. Nothing in code replaced the dialog with a native select, and 03-30's menu tests assert no `select` on the page. Advice for the PR (03-29): check the running build's version before the re-test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] e2e verification environment**
- **Found during:** Task 1 RED run
- **Issue:** the worktree had no `node_modules`, and the fixed e2e ports could collide with sibling runs.
- **Fix:** symlinked the main checkout's `client`, `server`, `e2e` and `lint` `node_modules` (git-ignored) and shifted `e2e/ports.ts` by 50000 locally. The ports edit was never staged and was reverted with `git checkout -- e2e/ports.ts`; the symlinks were removed. Nothing reached a commit.

**2. [Rule 2 - Missing critical] The whole-list Share link was not a 44 px target on phones**
- **Found during:** Task 3 (UI-SPEC: bar controls at least 44 px)
- **Issue:** the link variant of ShareWithHousehold (now shown in the bar after Select all) had `max-md:min-h-8`.
- **Fix:** `max-md:min-h-11`. Its only caller is the bar. File not in the plan's `files_modified`.
- **Files modified:** client/src/components/household/ShareWithHousehold.tsx
- **Commit:** `5fa9a814`

**3. [Rule 1 - Bug] Phone hint told a phone user to right-click**
- **Found during:** Task 3
- **Fix:** the hint is phone-specific ("Tap transactions to select them, then use More actions or ⋯."), the desktop wording unchanged.
- **Commit:** `5fa9a814`

**4. Plan wording refinements (no behaviour impact)**
- Task 1 is a tracer: tests and implementation are one commit (as 03-30's tracer), with the RED recorded above.
- `Delete N` is placed after Share even when no household exists (the exempt `Share with a household…` item sits inside the `writing` list and is skipped by the paused rule, rather than being appended after it).
- The phone spec taps a card's ⋯ with `dispatchEvent('click')` on `Actions for Mock two`, not `Actions for Mock one`. The register's page is taller than a phone screen and the cards sit under the bottom bar; Playwright's own scroll to reach a card fires its scroll events after the menu has opened, and the menu closes on any scroll. The ⋯ size is asserted as 44 px beside the other targets.
- Two of my first Task 2 tests misused `setToggle` (its default `checked = true` does not untick); fixed to `setToggle(…, false)`.

**Total deviations:** 3 (1 blocking, 1 missing-critical, 1 bug) plus refinements. **Impact:** none on scope.

## Issues Encountered

- `transactions.spec.ts` "in the detail panel, Escape with suggestions open closes only the list" failed once in a full run under load and passed 3 of 3 when re-run alone, and in the final 112-test run.
- At 390 px the register's header, summary and the selection bar fill most of the screen (about two cards stay in view). It meets the plan's overflow and 44 px criteria; for a reviewer's look, not changed here.

## Known Stubs

None.

## Threat Flags

None. No route, auth path or schema changed. T-03-41 (Delete needs the menu item, the preview and the typed word; the server's `expectedCount` check refuses a changed selection) and T-03-42 (unticked rows sent as `excludeIds`) are covered by e2e; T-03-43 by the date-range test (`0 selected` after the range changes); T-03-44 by the phase9 Undo and Redo.

## Self-Check: PASSED

- Created: `e2e/tests/phone/register-selection-phone.spec.ts` present; `BulkEditModal.tsx` absent (intended).
- Commits present on this branch: `2a9de974`, `3ab08350`, `baf70a30`, `5fa9a814`.
