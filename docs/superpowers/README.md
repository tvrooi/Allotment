# Planning (Superpowers)

Allotment's specs and plans follow the [Superpowers](https://github.com/obra/superpowers) workflow:
brainstorm → spec → plan → execute → finish the branch. GSD was retired on 23 November 2026; its
records moved here unchanged apart from paths.

| Folder                         | Holds                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| [`specs/`](specs/)             | Design specs, `YYYY-MM-DD-<topic>-design.md` (written by `superpowers:brainstorming`)         |
| [`plans/`](plans/)             | Implementation plans, `YYYY-MM-DD-<feature>.md` (written by `superpowers:writing-plans`)      |
| [`gsd-records/`](gsd-records/) | The former `.planning/`: project, requirements, roadmap, codebase maps, intel and every phase |

Every `.planning/` path inside the GSD records was rewritten to `docs/superpowers/gsd-records/`. The
records still name GSD commands (`/gsd-*`, `hdispatch job`); read those as history, not as steps to
run. The GSD-only bookkeeping (`state.json`, `config.json`, `ingest-manifest.yaml`) is kept for
reference and nothing reads it now.

## How to work

- **New work:** `superpowers:brainstorming` writes a spec in `specs/`, then
  `superpowers:writing-plans` writes a plan in `plans/`. Keep each plan to one PR.
- **Executing:** prefer `superpowers:executing-plans` (inline, in batches). Use
  `superpowers:subagent-driven-development` only for large plans: it runs an implementer and two
  reviewers per task and costs far more tokens.
- **Tick as you go:** tick a plan's checkboxes in the same PR as the work, and update this file's
  "Where things stand" when a plan finishes.
- The repository rules in `CLAUDE.md` / `AGENTS.md` (branches, verification, releases, invariants)
  outrank anything in a plan.

## Where things stand (24 November 2026)

Milestone **v1.0 Redesign finish** on branch `redesign`. Spec:
[specs/2026-11-14-redesign-finish-design.md](specs/2026-11-14-redesign-finish-design.md).

| Phase                              | State                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Settings split and good moments | Done 16 Nov 2026                                                                                                                                                                                                |
| 2. Shared form controls            | All 20 plans done                                                                                                                                                                                               |
| 3. Screens on shared controls      | All plans done; UAT 03 round 2 (PR #283, up.180) merged into `redesign`: [plans/2026-11-23-uat-03-round-2-close-out.md](plans/2026-11-23-uat-03-round-2-close-out.md)                                           |
| 4. Remaining screens and the guard | G4 (PR #284, up.181) merged into `redesign`. G5 (PR #287, up.182) open for review: [plans/2026-11-23-phase-04-remaining-screens-and-the-guard.md](plans/2026-11-23-phase-04-remaining-screens-and-the-guard.md) |

The owner still needs to re-run UAT 03 tests 1 and 2.
The backlog for later milestones is at the end of
[gsd-records/ROADMAP.md](gsd-records/ROADMAP.md#backlog-later-milestones-not-scheduled), with
IDs in [gsd-records/REQUIREMENTS.md](gsd-records/REQUIREMENTS.md).
