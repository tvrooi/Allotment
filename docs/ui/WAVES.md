# UI waves: orchestration handover

How the design re-review backlog (issues #222 to #245) is being worked through on `redesign`, and
where to pick up. Read after [README.md](README.md) and [HANDOVER-UI.md](HANDOVER-UI.md). Update
the **Status** and **Open PRs** sections whenever a wave PR opens, merges or is sent back; delete
this file when Wave F has merged. Last written 13 November 2026 while Wave E is in review (PR #266 open).

## Roles

- **Orchestrator (Fable):** triages, writes one spec per wave, delegates, reviews, decides merges.
  Writes no code unless the task is trivial.
- **Coder:** one wave per fresh `omc team` worker, from the orchestrator's spec. Waves A to D used
  Codex (high effort). On 12 November the owner changed the coder to Claude Opus 5.5, medium effort
  (`executor` in `.claude/omc.jsonc`). `omc team 1:claude:executor` did not work for Wave E (see
  Traps), so the Wave E coder ran as a background subagent of the orchestrator (Agent tool, model
  opus, medium effort), resumed for each fix round with SendMessage.
- **Explorer and reviewer (Antigravity, `agy`):** maps the files before the spec, reviews the diff
  against the spec and the AGENTS.md review guidelines, and reads the screenshots. A different
  model family from the coder on purpose.
- **Owner:** answers design questions; approves anything outward-facing (a release, a live update).

## Status

| Wave                | Issues                                   | State                                     |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| A shell             | #222, #223, #225                         | Merged, PR #247, up.167. Issues closed.   |
| A palette part 1    | #224 (part)                              | Merged, PR #253, up.169. #224 stays open. |
| A palette part 2    | #224 (rest)                              | Merged, PR #259, up.171. #224 closed.     |
| B small fixes       | #227, #228, #229, #233, #234, #238, #242 | Merged, PR #248, up.168. Issues closed.   |
| C dashboard         | #230, #231, #232                         | Merged, PR #255, up.170. Issues closed.   |
| D discoverability   | #226, #237, #239, #236                   | Merged, PR #262, up.172. Issues closed.   |
| E navigation depth  | #235, #243, #245, #240                   | PR #266 open, up.173. See Open PRs.       |
| F settings, delight | #244, #241                               | Not started.                              |
| G form controls     | #267                                     | Not started. Needs owner decisions.       |

Also merged: PR #256, test-only fixes for date- and timing-dependent Household specs.

Not in any wave:

- Shelved by the owner, leave as `ready-for-human`, and do not redesign Review, Cash flow or
  Household: #217, #218, #219.
- #215 needs the owner's physical iPhone (`ready-for-human`).
- `ready-for-agent` housekeeping with no wave yet: #211, #212, #213, #214, #216, #220.
- Filed during the waves, still `needs-triage`: #249 bulk selection bar at 390, #250 category
  Summary ignores the date tab, #251 configurable e2e ports, #252 add-in-place from account pages
  and dashboard empty states, #254 shortcuts ignored while a dialog fades out, #260 long payee
  name overflows the Dashboard's Recent transactions at 390, #263 the rest of #239 (one Review
  checklist in place of the first-visit guide banners; needs an owner design decision), #264 a
  disabled `ui/Switch` looks enabled.
- Filed during Wave E, `needs-triage`: #268 a payee's files on the payee page (needs a server
  query; left out of #235), #269 single-row category undo overwrites newer changes and sticks on
  a deleted row, #270 the register summary shows totals at the "Balances and totals" Safe mode
  level (privacy), #271 a phone details sheet covers the toasts.
- #267 Wave G (owner-requested 13 November): one set of shared field and selector components
  (shadcn) on desktop in place of native fields. The issue holds the counts, a five-step plan and
  five decisions the owner must make first (new dependencies, phones, scope, dates, and that it
  replaces Wave E's "short lists use the styled native Select" rule on desktop).

## Open PRs

- **PR #266, Wave E** (`feat/wave-e-navigation`, up.173). Implementation plus fix rounds 1 and 2
  are pushed (head `ab83632`): CI passed, and the GitHub Codex review found no major issue on that
  commit. The Antigravity re-review of round 2 then asked for fix round 3, which the coder was
  working on when this was written; the five items are in a comment on the PR. The owner's
  instruction (13 November): merge when round 3 is green. To finish: check that a round-3 commit
  is pushed and **CI passed** is green, squash-merge with `--delete-branch`, close #235, #243,
  #245 and #240 by hand (#235 is fixed except Files, which is #268), remove the worktree, then
  rewrite this file's Status and Open PRs. If no round-3 commit is on the branch, the work was
  lost with the session: redo it from the PR comment.
- The owner can still overrule Wave D's choices, listed in the body of PR #262: the
  transfers step counts in the sidebar Review badge and the Dashboard review card; the demo budget
  seeds no transfer suggestion; the empty-state copy and example values; Cash keeps its warning
  view when accounts are excluded for a missing exchange rate.
- The owner can still overrule Wave C's choices, listed in the body of PR #255: the status
  strip is always on; the Dashboard makes three extra connection requests; Bills is capped at 3
  bills and 2 pay days; Tax and Files are left out of the strip; the stretched Budget card has
  empty space below its rows.

## What to do next, in order

1. Waves D, E, F, one PR each. D and E both touch the sidebar and shared headers, so run them one
   after the other, not in parallel.
2. Triage the `needs-triage` issues above with the owner or by the routine in
   [docs/agents/triage-labels.md](../agents/triage-labels.md).

## Owner decisions on record

- **#224 palette** (plan approved 11 November, in the issue comments): no server change, no new
  route, nothing added to the read-only allowlist, `/api/assistant/do` or MCP; no write except
  opening the Add transaction dialog. Transaction results match payee and notes only, not amounts.
  `/` opens the palette everywhere. Recent destinations are remembered on the device.
  "Sync now" was left out of part 1 because no shell-level sync exists and a sync is a write; the
  owner has not been asked to rule on that.
- **Wave D, 12 November:** #226 Household, Tax time and Files show to everyone as dimmed
  "Set up" rows; explicit Hidden still hides them, and Pay later/Investments keep their existing
  behaviour. #237 Household uses a promise, example and one button opening the existing New
  household dialog; do not split its page. #239 covers the welcome step only: leave first-visit
  guide banners, the Dashboard checklist and Review Guided setup unchanged (the rest is #263).
  #217–#219 remain shelved. The fix round of PR #262 was merged on the Antigravity re-review
  because the GitHub Codex review limit was reached; that exception was for that round only.
- **Wave E, 13 November:** #235 a category-funded goal row opens its category page, a
  hand-tracked row keeps opening the edit dialog, every row has a visible Edit button; a new payee
  page (`/payees/:id`: spend, default category, rules, transactions) opened from the Payees list,
  transaction details and the palette; no server change, so Files was left out (#268). #243 one
  click anywhere on a desktop row opens details; the category pill is the only inline edit; the
  hover arrows, inline payee picker and row logo upload are gone. #245 every undoable change
  announces itself (onboarding sorting stays quiet); a toast offering Undo stays 8 seconds and
  holds while hovered or focused; Back/Forward restores filters and scroll, a fresh visit starts
  at the top. #240 16 px title gutter on phones, 24 px from `md`; categories always use the
  searchable `CategoryPicker`, short lists the shared styled `Select` (Wave G would change the
  second half on desktop). The HIGH tier was not used: gutters are set per page, not in the shell.
- **#244:** the Settings split is endorsed.
- **Release:** undecided. `redesign` carries up.154 to up.171 prepared and untagged. The
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
- **Team workers need valid models:** OMC's built-in worker models are refused by this Codex
  account and by `agy`, and a refused worker is rolled back after 30 seconds with no clear error.
  The working models are set in the user-level `~/.config/claude-omc/config.jsonc`
  (`externalModels.defaults`). `.claude/` is gitignored, so a worktree has no `.claude/omc.jsonc`:
  copy it in before launching a team there.
- **Launch teams with plain `omc team`** from a cmux terminal, not `cmux omc team`, which fails
  with `worker_pane_split_target_unverified`. A Codex team worker runs unsandboxed, so it can run
  browser tests and push. `codex exec` in its default sandbox cannot launch Chromium or commit in
  a worktree, and it hangs unless standard input is closed (`< /dev/null`).
- **Antigravity as a team worker is killed at OMC's fixed 30-second startup limit.** Run it
  directly instead: `agy --model gemini-4-argon-<medium|high> --mode plan --sandbox --print-timeout
900s -p "$(cat <brief>)" < /dev/null`. Without `--dangerously-skip-permissions` any shell command
  it tries is auto-denied and the run ends with no output, so the brief must forbid shell commands
  and, for a review, point at a diff saved under the worktree's `.omc/research/`. Check
  `git status` afterwards.
- **GitHub Codex review has a usage limit.** After about five `@codex review` requests in one
  evening the bot answered that the limit was reached. Ask the owner before merging without it.
- **Sending a fix brief to the same coder:** `omc team api send-message` (from `leader-fixed` to
  `worker-1`) was picked up within a minute. The team's task never left `in_progress`, so wait on
  a marker line in the coder's report, not on `omc team status`, and shut the team down with
  `--force` after the merge.
- **A row that is `aria-disabled`:** Playwright's `click()` waits forever for it; dispatch the
  click event and assert that nothing happened.
- **Launching the coder from a `cmux claude-teams` session (Wave E):** `omc team` fails there
  with `worker_pane_split_target_unverified` (the cmux tmux shim). In a real tmux session the
  Claude worker stops on the one-time Bypass Permissions warning and is rolled back after 30
  seconds; accepting that warning is the owner's decision. Named cmux teammates failed with
  "Socket closed before reply" and left empty panes. A background subagent worked.
- **Antigravity review size:** a 4,000-line diff timed out at 15 minutes with no output. Split
  the diff by area into halves of about 2,000 lines, give each its own brief, run them in
  parallel, and tell the reviewer not to open image files (an image read was auto-denied and
  ended the first run with nothing). The orchestrator reads the screenshots.
- **e2e type check:** CI runs `npx tsc --noEmit` in `e2e/` before the browser tests; a type error
  there fails all four shards with no test run. Put it in the coder's checks.
- **Making a shared call do more** (Wave E made the undo store's `push` announce): search every
  caller. Callers that already announced, or had their own inline Undo, doubled up in six places.
- **Usage limits:** coder sessions stop mid-task at the five-hour limit. Their work is saved;
  resume the same session with a message telling it to check `git status` and leftover processes.
