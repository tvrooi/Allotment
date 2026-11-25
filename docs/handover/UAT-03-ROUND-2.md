# UAT 03 round 2: paused before the PR (22 November 2026)

Self-contained handoff. GSD is retired (23 November 2026); the checklist form of this handoff is
[docs/superpowers/plans/2026-11-23-uat-03-round-2-close-out.md](../superpowers/plans/2026-11-23-uat-03-round-2-close-out.md).

## What the round fixes

Two gaps from the owner's UAT 03 re-run (`docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-UAT.md`):

- **G-03-3** (UAT test 49): on iPhone, Add transaction's Date text sits high in its field.
- **G-03-4**: selecting register rows should be shown by colour only, with no checkbox, and nothing on
  the screen should move. The owner's words: "Don't move the list".

## Where the code is (all unpushed, all local)

| Branch                     | Worktree                                    | Base                                  | Holds                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix/uat-03-date-centre`   | `~/Github/Allotment-worktrees/uat03-date`   | `origin/redesign` `b22fb6fa` (up.179) | G-03-3: `37654611` test, `88e678c7` fix, `fef6d53a` review fix (rules scoped to WebKit with `@supports (-webkit-touch-callout:none)`, because Android Chromium draws the same pseudo-element) |
| `fix/uat-03-row-selection` | `~/Github/Allotment-worktrees/uat03-select` | `origin/redesign` `b22fb6fa`          | G-03-4: 03-33 `a57aacb0`..`edb3e917`; 03-35 specs `4eb8b2ec`; review fixes `da048a87`..`159f2087` (13 commits)                                                                                |

Both worktrees use symlinked `node_modules` from the main checkout. Run every npm command with
`PATH=/opt/homebrew/opt/node@24/bin:$PATH`. The main checkout's `redesign` is 3 commits behind
`origin/redesign` and has the unpushed GSD planning history. Never build a PR branch from it.

Plan and summary files for reference: `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-32` to `03-35`
(`-PLAN.md`, `-SUMMARY.md`), `03-33-REVIEW-FIX.md`. Reviews (git-ignored, local only):
`.git/gsd-handoff/03-32-REVIEW-sol.md`, `.git/gsd-handoff/03-33-REVIEW-sol.md`.

## What was verified (by the orchestrator, not just the workers)

- **03-32:** DatePicker and MonthPicker 37/37; the new test fails on the old source; client tsc and
  build pass; the built CSS holds `margin-block:0` and `line-height:42px` on
  `::-webkit-date-and-time-value` inside the `@supports` block.
- **03-33 + 03-35 + review fixes** (at `159f2087`): client and e2e tsc clean; client 975/975; lint 119
  warnings (cap 121); phone project 72 passed; desktop transactions, household, phase9, menus,
  transaction-filters and accessibility 124 to 125 of 126 passed.
- **The one desktop failure:** `transactions.spec.ts:1346` (a typed payee is kept when two Escapes
  close the panel) fails only under the full run and passes 5/5 alone. Not yet checked on
  `origin/redesign`, so it is unknown whether this branch made it flaky.
- The review of 03-33 found 8 issues (stale bar overlap while the summary loads, "Select all 0",
  checkbox names using the wrong amount, no forced-colours marker, More actions shifting, focus lost
  after Done, same-day order in a test, a duplicated colour probe). The fixer reported all 8 fixed with
  a failing-first test each. Reviews were capped at one round (owner, 20 November), so the fixes were
  verified by test runs, not re-reviewed.

## What is left (plan 03-34; read its PLAN.md for the exact allowlist)

1. **One PR branch.** Create `fix/uat-03-selection-colour-and-date` from `origin/redesign`. Merge both
   fix branches into it, and nothing else: no `.impeccable` or `.ui-evidence` files.
2. **Whole-change gate on Node 24**, one Playwright project at a time:
   - client unit tests, client tsc and build;
   - lint, with the cap lowered if warnings fell;
   - e2e tsc;
   - the desktop, phone, iphone-webkit, demo, server-mode and gallery projects.

   Recheck `transactions.spec.ts:1346` on `origin/redesign` too.

3. **Docs and version.**
   - Run `npm run release:prepare -- 0.2.0-up.180`, then add a CHANGELOG entry describing both fixes.
     `up.180` is the next free version, and no tag exists for it.
   - Update `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`, `docs/ui/WAVES.md`, `docs/HOUSEHOLDS.md` and
     `HANDOVER.md` State. They must describe selection by click or tap with the selected colour and
     no checkbox, the bar covering the toolbar so the list never moves, the row as its own checkbox
     for assistive technology, and the iOS date classes. None may still say rows are ticked.
4. **Evidence.** Take screenshots of two rows selected, at 1280 px and 390 px, in light and dark mode,
   using demo or disposable data. Save them in the PR worktree's git-ignored
   `.ui-evidence/2026-11-22-uat-03-round-2/`.
5. **The PR.** Open one PR into `redesign` with `--repo tvrooi/Allotment`, and get CI green, including
   the Linux gallery pixel comparison.

   The PR body must:
   - keep the owner's UAT words apart from the planner's choices (a plain click selects while
     selecting);
   - list the review fixes;
   - list the unplanned spec change: "changing the date range ends a whole-list selection" now checks
     2 rows instead of the "2 transactions" text, which the bar covers;
   - report G-03-3 as awaiting the owner's iPhone check, never as closed.

   Do not merge, tag or release: the owner merges `redesign` PRs.

## Owner checks still needed

- **iPhone Safari, UAT test 49:** in Add transaction, the Date text should be vertically centred and
  level with Amount and Payee. Its right edge should line up with Amount, and tapping it should still
  open the wheel.
- **Re-run of G-03-4:** selection shows only by colour, and nothing on the screen moves.

## Cleanup once the PR is open

- **Local GSD worktrees** (summaries are already merged into local `redesign`):
  `.claude/worktrees/agent-p0332-uat2-a1`, `agent-p0333-uat2-a1`, `agent-p0335-uat2-a1` and
  `agent-p0333-fix-a1`, with their `worktree-agent-*` branches.
- **Dispatcher jobs:** all are accepted or completed. Orchestrator id `allotment-v1-p03-uat2`; none
  is running.
