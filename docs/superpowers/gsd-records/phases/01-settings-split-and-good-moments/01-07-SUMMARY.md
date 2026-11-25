---
phase: 01-settings-split-and-good-moments
plan: 07
subsystem: ui
tags: [guides, docs, changelog, e2e, gate, node24]

requires:
  - phase: 01-settings-split-and-good-moments (plans 01-06)
    provides: "the two pages, provider links, palette entries, D-09 message, goal plant and $0 label that the guides and docs now describe"
provides:
  - "accountsGuide version 2 whose last step highlights accounts.connections"
  - "settingsGuide with its Connect Up step restored on CONNECTED_BANKS_PATH"
  - "MAP.md rows for /accounts/connections and /budget/categories, every page recounted"
  - "HANDOVER-UI.md, WAVES.md (D-10), CHANGELOG up.174 and three other docs describing the revised Wave F"
  - "a recorded green run of the full gate on Node v24.10.0"
affects: [01-08, pr-273-body, docs-ui-map, docs-ui-handover]

actuals:
  tokens: 10900
  tasks: 3
  commits: 2
plan_head_before: 6d0bb8eb77bf95688e4b5ed5b1fd50ec17416198
plan_head_after: 575c3ea48bd32f791a1417762140a1a7bd482c0a

tech-stack:
  added: []
  patterns:
    - "A guide step's route that points at a moved page uses the movedSections constant, never the path literal"

key-files:
  created: []
  modified:
    - client/src/guides/pages.ts
    - docs/ui/MAP.md
    - docs/ui/HANDOVER-UI.md
    - docs/ui/WAVES.md
    - CHANGELOG.md
    - DESKTOP-SERVER.md
    - MAINTENANCE.md
    - homeassistant/DOCS.md

key-decisions:
  - "accountsGuide raised to version 2 (RESEARCH A3), so people who took it are offered it again as Updated guide; record this in the PR body"
  - "The repository-wide Prettier check is recorded against tracked files: npm run format:check fails only on .impeccable/hook.cache.json, a local tool cache that is untracked and excluded through .git/info/exclude, so CI never sees it"

patterns-established:
  - "Guide routes to moved sections import CONNECTED_BANKS_PATH / CATEGORIES_PATH from utils/movedSections"

requirements-completed: [WAVF-01, WAVF-02, WAVF-03, WAVF-04, WAVF-05]

coverage:
  - id: D1
    description: "The Accounts guide's last step highlights the Connected banks header link, and the Settings guide's Connect Up step opens /accounts/connections; ids unchanged"
    requirement: "WAVF-03"
    verification:
      - kind: unit
        ref: "client/src/utils/guides.test.ts#every highlighted element has its data-guide marker in the app"
        status: pass
      - kind: e2e
        ref: "e2e/tests/guides.spec.ts#every page guide opens from its page and finds what it points at"
        status: pass
      - kind: e2e
        ref: "e2e/tests/phone/guides-phone.spec.ts#every page guide works on a phone, started from the menu"
        status: pass
    human_judgment: false
  - id: D2
    description: "MAP.md, HANDOVER-UI.md, WAVES.md, the changelog and three operator docs name the new places and describe the revised design"
    requirement: "WAVF-01"
    verification:
      - kind: other
        ref: "prettier --check on the seven docs; old-place grep over the docs prints 0; MAP line counts equal wc -l"
        status: pass
    human_judgment: true
    rationale: "Whether the prose reads well and matches the owner's intent is a reading judgment; the greps only prove the old places are gone"
  - id: D3
    description: "Full gate on Node 24: client unit, build, e2e types, six browser projects, lint tests, lint at 128 warnings, Prettier, server D-09 test and types"
    requirement: "WAVF-02"
    verification:
      - kind: unit
        ref: "npm --prefix client test (75 files, 611 tests)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop (471 passed)"
        status: pass
      - kind: e2e
        ref: "phone 61, demo 25, server-mode 17, iphone-webkit + multi-user 11 passed"
        status: pass
      - kind: other
        ref: "npm --prefix lint run lint (0 errors, 128 warnings)"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-11-15
status: complete
---

# Phase 1 Plan 07: Guides, docs and the full gate Summary

**The Accounts guide (now version 2) spotlights the header's Connected banks link, and the Settings guide's restored "Connect Up" step opens `CONNECTED_BANKS_PATH`. MAP.md, HANDOVER-UI.md, WAVES.md, the up.174 changelog entry and three operator docs describe the revised Wave F. Every check in the gate passed on Node v24.10.0, with lint at 128 warnings (the cap).**

## Performance

- **Duration:** 29 min
- **Started:** 2026-11-15T04:29:51Z
- **Completed:** 2026-11-15T04:59:08Z
- **Tasks:** 3 of 3 (Task 3 needed no fix, so it has no commit)
- **Files modified:** 8 on `wave-f`

## Accomplishments

- `guides/pages.ts`: `accountsGuide` is version 2, with a comment saying why. Its step "Bring in transactions automatically" has the UI-SPEC body and `target: 'accounts.connections'`. In `settingsGuide`, the summary and the "Everything in tabs" body now match the UI-SPEC word for word. The "Connect Up" step is back between "Everything in tabs" and "Back up and preferences", with `route: CONNECTED_BANKS_PATH` imported from `utils/movedSections`. No guide or tip id changed. `docs/GUIDES.md` lists no steps or versions, so it was left as it was.
- `docs/ui/MAP.md`:
  - new rows for `/accounts/connections` (AccountConnections.tsx, 33 lines) and `/budget/categories` (BudgetCategories.tsx, 27 lines);
  - corrected rows for `/accounts` (302, no embedded banks), `/budget` (1484, budget only), `/settings` (eight tabs, opens on Accounts) and `/goals` (565, `GoalPlant` and `ui/Plant`);
  - the snapshot date is now 14 November 2026, and every page count was checked against `wc -l`;
  - `PALETTE_PAGES`, `Plant.tsx` and the phone breadcrumb landmark of `PageHeader` are now listed;
  - `ReportDetail.tsx` was recounted as 1069 lines.
- `docs/ui/HANDOVER-UI.md`:
  - the Wave F entry is rewritten to the design as built: the pages and routes, `?provider=` and `bankFeedLink` (D-08), the eight tabs and the redirects that keep other parameters, `movedSections` and its source guard, `PALETTE_PAGES`, the guide versions, `Plant`/`plantStage`/`GoalPlant` and the bloom memory, `readyToAssignStatus` and the `lint/terms` guard, and the D-09 message in `server/src/services/accountDeletion.ts`;
  - #241 and #244 are removed from Next up, and the decisions of 14 November replace the old ones;
  - Traps: the scroller trap is dropped, the moved-tabs trap is corrected, and the `budget.categories` / `budget.manage-categories` and WAVES.md lifetime traps are added.
- `docs/ui/WAVES.md` (D-10, kept):
  - the opening note now says the file is deleted when Wave G has merged;
  - "Last written" is 15 November;
  - the Wave F row and Open PRs show PR #273 as open, revised and not merged.
- `CHANGELOG.md`: the two up.174 bullets are rewritten for what people now see. Only lines 5 and 6 changed.
- `DESKTOP-SERVER.md`, `MAINTENANCE.md` and `homeassistant/DOCS.md` (two places) now say Accounts → Connected banks. On a read-only check, UP-SUPPORT.md, START-HERE.md, RESILIENCE.md and DEVELOPMENT.md already read true.

## Task Commits (wave-f, not pushed)

1. **Task 1 (tracer): the Accounts guide points at Connected banks, the Settings guide sends you there**: `113e76c` (feat)
2. **Task 2: the docs and the changelog describe the revised Wave F**: `575c3ea` (docs)
3. **Task 3: the full gate**: no commit; nothing failed.

## Full gate (Node v24.10.0, one browser run at a time, after the last source commit `575c3ea`)

Logs: `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/logs/` (git-ignored).

| # | Command | Result |
|---|---|---|
| 1 | `npm --prefix client test` | 75 files, 611 tests passed |
| 1 | `npm --prefix client run build` | built, 0 `error TS` |
| 2 | `cd e2e && npx tsc --noEmit` | exit 0, 0 `error TS` |
| 3 | `npm --prefix e2e test -- --project=desktop --reporter=line` | 471 passed (17.2 min), 0 failed, 0 flaky |
| 3 | `... --project=phone` | 61 passed, 0 failed, 0 flaky |
| 3 | `... --project=demo` | 25 passed |
| 3 | `... --project=server-mode` | 17 passed |
| 3 | `... --project=iphone-webkit --project=multi-user` | 11 passed (3 iphone-webkit, 8 multi-user) |
| 4 | `npm --prefix lint test` | 86 passed, 0 failed, 0 `not ok` |
| 4 | `npm --prefix lint run lint` | 0 errors, **128 warnings** (cap `--max-warnings=128`, unchanged) |
| 5 | `npm run format:check` | exit 1 on `.impeccable/hook.cache.json` only (see Issues) |
| 5 | `git ls-files -z \| xargs -0 prettier --check --ignore-unknown` (2020 tracked files) | all files use Prettier code style |
| 6 | `npm --prefix server test -- src/routes/accountDeletion.test.ts` | 4 passed |
| 6 | `cd server && npx tsc --noEmit` | exit 0 |
| T1 | `npm --prefix client test -- src/utils/guides.test.ts src/utils/movedSections.test.ts` | 29 passed (before and after the change) |
| T1 | desktop `tests/guides.spec.ts` | 4 passed before the change, 4 passed after |
| T1 | phone `tests/phone/guides-phone.spec.ts` | 2 passed |

Guard checks:
- `max-warnings=128` appears once in lint/package.json.
- The server diff against `origin/redesign` is exactly `accountDeletion.ts` and its test (2 files, 0 others).
- No dependency line changed in any package.json, and `.npmrc` is unchanged.
- The diff adds 0 `test.skip`/`test.fixme`/`waitForTimeout`/`E2E_SKIP_BUILD` lines to `e2e/tests`.
- The guide diff changes 0 `id:` lines.
- "on the Accounts page" appears 0 times in client/src.

## Test expectations changed in the phase (for the PR body)

- `e2e/tests/budget.spec.ts` (2 sites): "Fully budgeted" is now "Every dollar has a job". The $0 label was retired (WAVF-05, plan 06).
- `e2e/tests/cleanup.spec.ts`: "Settings → Connections" is now "Accounts → Connected banks → Up". This is the D-09 message (plan 04). In `server/src/routes/accountDeletion.test.ts` the same expectation changed.
- `e2e/tests/menus.spec.ts`: the pointer-cursor check used the Settings "Tags" tab. It now opens `/budget/categories` and checks "Create group", because the category manager is no longer under a Settings tab (plan 03).
- Bank and category specs in `accounts`, `up`, `enable-banking`, `first-import`, `switchers`, `settings`, `demo/demo`, `accessibility` and the phone specs now open the new routes instead of the Settings tabs (plans 01 to 03). The demo strip's expected href is `#/accounts/connections?provider=up` (plan 02, D-08).
- Every other test change adds tests. No expectation was loosened.

## Decisions Made

- `accountsGuide` → version 2 (RESEARCH A3). People who took it see it again as "Updated guide". Record this in the PR body.
- The guide import of `CONNECTED_BANKS_PATH` creates no cycle, because `utils/movedSections.ts` imports nothing.

## Deviations from Plan

### Auto-fixed Issues

None needed a rule-based fix. Notes:

**1. [Scope note] MAP.md: three small additions beyond the named rows**
- **Found during:** Task 2
- **Issue:** MAP.md's primitives and shell lists did not name `Plant.tsx`, `PALETTE_PAGES` or the phone breadcrumb landmark added this phase. `ReportDetail.tsx` was listed as 1067 lines, but `wc -l` gives 1069 (drift that was already on `redesign`).
- **Fix:** one line for each, and the count corrected. Docs move with the code.
- **Commit:** `575c3ea`

**2. [Process] The repository-wide Prettier command fails on a local, untracked file**
- `npm run format:check` exits 1 only on `.impeccable/hook.cache.json`, the impeccable hook's local cache. It is not in git (`git ls-files .impeccable` lists only config.json and design.json), and it is excluded through `.git/info/exclude`, which Prettier does not read. CI checks out tracked files, so it never sees this file. The same check over all 2020 tracked files passes. The file was not edited because it is not part of the repository or this phase. To make the local command pass, add `.impeccable/hook.cache.json` to `.prettierignore` (a repo change, out of scope here) or delete the cache.

**Total deviations:** 0 auto-fixed, 2 documented notes. **Impact:** none on behaviour or scope.

## Issues Encountered

- See deviation 2: `npm run format:check` and the local tool cache. It is not caused by this phase, it would fail in any checkout that has this cache file, and CI is not affected.

## Known Stubs

None.

## Threat Flags

None. T-01-18: no id changed. T-01-19: the docs name in-app places and file paths only, with no hostname, token or bank data. T-01-20: the gate diff guards are at 0. T-01-SC: no package was installed or changed.

## Next Phase Readiness

Ready for 01-08. It takes the 390 px light and dark screenshots (D7, Goals "New laptop", the Budget header at 768-1024 px) and pushes `wave-f`. Items for the PR body:
- This closes the Codex P1 on #273 (plan 02).
- The accounts guide version is now 2.
- `figureInDoubt` and the caveat scenario come from plan 06.
- The UI-SPEC deviation for an absent summary (plan 06).
- The test-expectation list above.
- The gate table above.

## Self-Check: PASSED

- FOUND (wt-f): client/src/guides/pages.ts, docs/ui/MAP.md, docs/ui/HANDOVER-UI.md, docs/ui/WAVES.md, CHANGELOG.md, DESKTOP-SERVER.md, MAINTENANCE.md, homeassistant/DOCS.md
- FOUND commits on wave-f: 113e76c, 575c3ea (2 commits since 6d0bb8e)

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*
