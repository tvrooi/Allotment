---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The single-transaction menu's writing items ignore the paused-saving rule the selection menu now enforces"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Table's `shareable` is a second, narrower copy of `whyNotShareable`, so Select-all share counts include rows the server rejects"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "A null selection falls back to a whole-list target while the menu and delete dialog stay mounted"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "\"The one copy\" of the paused wording is not the only copy"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`targetOf` and the `Target`/`EditTarget` types duplicate `bulkBody` and `BulkTarget`"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "`selectedCount` is exported but only the tests use it"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Undo-toast messages for review are not formatted like the others"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "ContextMenu closes itself on window resize and blur while the prompt field has the keyboard"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "Generated audit docs still list the deleted file and the old route"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "Ctrl+click is advertised as a toggle but is the context-menu gesture on macOS"
open: 0
total: 10
recorded: 2026-11-22T03:40:00.000Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | b231d01c (PR #280 86ea5599); the row menu's Share with, Stop sharing and Paid ahead to are disabled with SAVING_PAUSED; e2e paused test extended, red without the fix |
| WR-02 | warning | fixed | b231d01c; `shareable` is `!whyNotShareable(t) && !t.household`; new household e2e, red without the fix |
| WR-03 | warning | fixed | b231d01c; target is null with no selection, Delete freezes its target when opened |
| WR-04 | warning | fixed | b231d01c; `components/connection/savingPaused.ts` is the one copy (useOffline, Budget, both menus, the hint) |
| WR-05 | warning | fixed | b231d01c; `EditTarget = BulkTarget`, `targetOf` removed (`bulkBody` already drops unset fields) |
| IN-01 | info | deferred | test-only export, harmless; tidy in Phase 4 |
| IN-02 | info | deferred | cosmetic number formatting in a toast; Phase 4 |
| IN-03 | info | deferred | unverified on a device; for the owner's phone re-test |
| IN-04 | info | deferred | FORM-CONTROLS-AUDIT.md is the G0 snapshot, ux-ui-evidence is historical (named in PR #280) |
| IN-05 | info | deferred | unverified; Cmd+click is the macOS gesture and works |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.
