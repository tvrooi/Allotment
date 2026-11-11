# UI waves: orchestration handover

How the design re-review backlog (issues #222 to #245) is being worked through on `redesign`, and
where to pick up. Read after [README.md](README.md) and [HANDOVER-UI.md](HANDOVER-UI.md). Update
the **Status** and **Open PRs** sections whenever a wave PR opens, merges or is sent back; delete
this file when Wave F has merged. Last written 12 November 2026 with `redesign` at `28eb8e6`.

## Roles

- **Orchestrator (Fable):** triages, writes one spec per wave, delegates, reviews, decides merges.
  Writes no code unless the task is trivial.
- **Coder (Opus 5.5, medium effort):** one wave per fresh session, from the orchestrator's spec.
- **Owner:** answers design questions; approves anything outward-facing (a release, a live update).

## Status

| Wave                | Issues                                   | State                                         |
| ------------------- | ---------------------------------------- | --------------------------------------------- |
| A shell             | #222, #223, #225                         | Merged, PR #247, up.167. Issues closed.       |
| A palette part 1    | #224 (part)                              | Merged, PR #253, up.169. #224 stays open.     |
| A palette part 2    | #224 (rest)                              | Not started. Next to dispatch.                |
| B small fixes       | #227, #228, #229, #233, #234, #238, #242 | Merged, PR #248, up.168. Issues closed.       |
| C dashboard         | #230, #231, #232                         | PR #255 open, up.170, reviewed; see Open PRs. |
| D discoverability   | #226, #237, #239, #236                   | Not started.                                  |
| E navigation depth  | #235, #243, #245, #240                   | Not started.                                  |
| F settings, delight | #244, #241                               | Not started.                                  |

Also merged: PR #256, test-only fixes for date- and timing-dependent Household specs.

Not in any wave:

- Shelved by the owner, leave as `ready-for-human`, and do not redesign Review, Cash flow or
  Household: #217, #218, #219.
- #215 needs the owner's physical iPhone (`ready-for-human`).
- `ready-for-agent` housekeeping with no wave yet: #211, #212, #213, #214, #216, #220.
- Filed during the waves, still `needs-triage`: #249 bulk selection bar at 390, #250 category
  Summary ignores the date tab, #251 configurable e2e ports, #252 add-in-place from account pages
  and dashboard empty states, #254 shortcuts ignored while a dialog fades out.

## Open PRs

- **#255 Wave C** (`feat/wave-c-dashboard`): screenshot review passed for #230, #231 and #232; CI
  and Codex were clean at `73b0b3b`. The coder was asked on 12 November to rebase onto `28eb8e6`
  (keeping up.170), run the full desktop, phone, demo and `iphone-webkit` projects, and report.
  To finish: confirm the push, comment `@codex review`, wait for **CI passed** and a Codex result
  on the head commit, squash-merge, close #230, #231 and #232 with a comment naming the PR.
  Owner-overrulable choices are listed in the PR body (status strip always on; three extra
  connection requests on the Dashboard; Bills capped at 3 bills and 2 pay days; Tax and Files left
  out of the strip; the stretched Budget card has empty space below its rows).

## What to do next, in order

1. Finish #255 as above.
2. Dispatch **palette part 2** (#224): Files search (`GET /api/files?q=`) and Transactions search
   (`GET /api/transactions?search=`, 8 rows, "See all in Transactions"), both debounced from two
   characters; "Not available offline" for those two groups; "Files are not available in the demo"
   in the demo (its in-browser server answers `/files` with an empty list). Seams are named in
   HANDOVER-UI.md. Close #224 when it merges.
3. Waves D, E, F, one PR each. D and E both touch the sidebar and shared headers, so run them one
   after the other, not in parallel.
4. Triage the `needs-triage` issues above with the owner or by the routine in
   [docs/agents/triage-labels.md](../agents/triage-labels.md).

## Owner decisions on record

- **#224 palette** (plan approved 11 November, in the issue comments): no server change, no new
  route, nothing added to the read-only allowlist, `/api/assistant/do` or MCP; no write except
  opening the Add transaction dialog. Transaction results match payee and notes only, not amounts.
  `/` opens the palette everywhere. Recent destinations are remembered on the device.
  "Sync now" was left out of part 1 because no shell-level sync exists and a sync is a write; the
  owner has not been asked to rule on that.
- **#226:** Household, Tax time and Files show to everyone as dimmed "Set up" rows.
- **#244:** the Settings split is endorsed.
- **Release:** undecided. `redesign` carries up.154 to up.169 prepared and untagged. The
  orchestrator's recommendation is one release from `redesign` soon, because the Safe mode chart
  fix (#246) is a privacy fix; it and the menu fix must appear in the release notes. Do not tag,
  publish or update the live app until the owner decides.

## Per-wave routine

1. **Worktree.** The Agent tool's built-in worktree isolation fails here (it looks for
   `origin/main`). Create one by hand from the current head:
   `git fetch origin redesign && git worktree add -b <branch> <scratchpad>/wt-<x> origin/redesign`,
   and tell the coder to work only there. Remove it after the merge.
2. **Spec.** Give the coder: the worktree path and branch; Node 24; `npm ci` in root, `client/`,
   `server/`, `e2e/`; the issues and what "fixed" means for each; the files from the MAP.md row;
   constraints from CLAUDE.md that bite (tokens only from `@theme`, Safe mode, demo and offline,
   no server change unless the wave needs it, remove what you replace); files another open PR owns;
   test-first with a failing test per fix; the exact checks to run; screenshots to capture under
   `.ui-evidence/<date>-<wave>/`; the next version for `npm run release:prepare` and a CHANGELOG
   entry; HANDOVER-UI.md and MAP.md updates; PR to `redesign` with `--repo tvrooi/Allotment`; what
   to report back. The earlier specs were not saved; PR #247, #248, #253 and #255 show what each
   produced.
3. **Review from screenshots** of the changed screens only. Mark each issue fixed, partly fixed or
   not fixed, and send anything short of fixed back to the same coder session (SendMessage resumes
   it with its context). Check for rule breaks a screenshot cannot show: polling or sleeps added to
   tests, changed expectations without a reason, files under `server/`.
4. **Merge** when **CI passed** is green and Codex has no unresolved finding on the head commit
   (comment `@codex review` after any push; it only reviews automatically when a PR opens).
   Squash-merge with `--delete-branch`. Close the issues by hand: "Closes #n" does not fire because
   `redesign` is not the default branch.
5. **Renumber.** Each wave PR prepares the next `0.2.0-up.N`. When PRs overlap, the later one
   rebases, keeps its own number and puts its CHANGELOG entry on top.

## Traps met in these waves

- **Node:** use Node 24 (`PATH=/usr/local/bin:$PATH` on the owner's Mac). Node 26, the default
  there, breaks 11 client Safe mode tests.
- **Never `E2E_SKIP_BUILD=1`:** the shared client build cache is stale.
- **e2e ports are fixed** (`e2e/ports.ts`, #251), so two worktrees cannot run browser tests at
  once. Parallel coders must wait and retry, never kill a process they did not start, and prefix
  their log files.
- **Coders ran subsets.** A subset missed a real failure once. Ask for the full desktop project
  plus phone, demo and server-mode before a PR is called ready.
- **CI infrastructure:** `npx playwright install --with-deps` hung for 90 minutes once and failed
  all four shards with no test run. Check the failing step before blaming the change, then
  `gh run rerun <id> --failed`.
- **Date and timing in tests:** dates built with `toISOString()` are UTC and fail east of UTC before
  11:00; a 390px overflow check must wait for the phone layout (`phoneWidth(page)` in
  `household.spec.ts`). CI runs in UTC, so such failures show locally first.
- **Menus in animated panels:** a `RowMenu` closes on scroll events; a panel that slides in inside
  a scrollable `overflow-hidden` box fires them. Use `overflow-clip` (as the sidebar rail and the
  transaction details box do).
- **Lazy chunks offline:** a lazily loaded shell feature must be warmed while online and must not
  take the shell down if its import fails (`utils/retryingImport.ts`).
- **Lint cap:** 135 warnings, at the cap. A new warning must be fixed, not counted.
- **Usage limits:** coder sessions stop mid-task at the five-hour limit. Their work is saved;
  resume the same session with a message telling it to check `git status` and leftover processes.
