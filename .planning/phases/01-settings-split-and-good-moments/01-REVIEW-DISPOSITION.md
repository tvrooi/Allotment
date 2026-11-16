---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Initial bloom history is still consumed before the row commits"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`ConnectedBanks` loading state has no accessible status text"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Enable Banking server error messages still point to `Settings → Connected banks`"
  - id: WR-04
    severity: warning
    disposition: open
    title: "User guide still says `\"fully budgeted\"`, and `lint/terms` check is case-sensitive"
  - id: IN-01
    severity: info
    disposition: open
    title: "`docs/DEVELOPMENT.md` route table and `StatusStrip.tsx` doc comment still reference old Settings tabs"
open: 5
total: 5
recorded: 2026-11-16T06:45:13.131Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - (not in the current review) |
| WR-03 | warning | open | - (not in the current review) |
| WR-04 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
