---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Initial bloom history is still consumed before the row commits"
  - id: WR-02
    severity: warning
    disposition: deferred
    title: "`ConnectedBanks` loading state has no accessible status text"
  - id: WR-03
    severity: warning
    disposition: deferred
    title: "Enable Banking server error messages still point to `Settings → Connected banks`"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "User guide still says `\"fully budgeted\"`, and `lint/terms` check is case-sensitive"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "`docs/DEVELOPMENT.md` route table and `StatusStrip.tsx` doc comment still reference old Settings tabs"
open: 0
total: 5
recorded: 2026-11-16T06:45:13.131Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | wave-f 9149547 (test, failed first) and ad26903 (initial bloom decided in the layout effect); owner-approved 16 November 2026 |
| WR-02 | warning | deferred | Out of scope for gap closure 01-09 by the owner's choice, 15 November 2026 (01-09-PLAN objective) |
| WR-03 | warning | deferred | Out of scope for gap closure 01-09 by the owner's choice, 15 November 2026 (01-09-PLAN objective) |
| WR-04 | warning | fixed | 01-09: wave-f 22c5e94 (guard /i) and 1b6f5f6 (guide and docs); confirmed by the incremental review of 575c3ea..1b6f5f6 |
| IN-01 | info | deferred | Out of scope for gap closure 01-09 by the owner's choice, 15 November 2026 (01-09-PLAN objective) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
