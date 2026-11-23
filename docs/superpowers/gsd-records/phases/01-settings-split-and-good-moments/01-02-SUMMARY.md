---
phase: 01-settings-split-and-good-moments
plan: 02
subsystem: ui
tags: [react, react-router, playwright, vitest, connected-banks, links]

requires:
  - "01-01: CONNECTED_BANKS_PATH, BankProvider, parseProvider, connectedBanksLink, the ?provider= page"
provides:
  - "movedSections.ts: bankFeedLink(feedLabel) with a private feed-label -> BankProvider map (Object.hasOwn)"
  - "BankSyncPill links to its own provider: bankFeedLink(feed.provider)"
  - "Up-only links (BankBalanceHint missing round-ups, Housekeeping round-ups) open ?provider=up"
  - "General links (GettingStarted, empty register, Resilience bank changes) open connectedBanksLink()"
  - "CONNECTED_BANKS_LINK removed; movedSections exports only final names"
  - "Unit guard: no client source but utils/movedSections.ts and tests spells /accounts/connections, tab=connections or tab=categories"
affects: [01-03, 01-07, link-sites, status-strip]

actuals:
  tokens: 3250
  tasks: 2
  commits: 2
plan_head_before: 0c482d1e0f179ead9fa6b94e0fb9e38a5e28daca
plan_head_after: 6267de4f76fefa5ede82afd14ea61e96817e5943

tech-stack:
  added: []
  patterns:
    - "Display label -> id lookups use a private readonly map guarded with Object.hasOwn; the label is never put into the URL"
    - "Source guard test: import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', eager: true }); files in the test's own folder are keyed './x.ts'"

key-files:
  created: []
  modified:
    - client/src/utils/movedSections.ts
    - client/src/utils/movedSections.test.ts
    - client/src/components/up/UpSyncBadge.tsx
    - client/src/components/accounts/BankBalanceHint.tsx
    - client/src/components/review/Housekeeping.tsx
    - client/src/components/dashboard/GettingStarted.tsx
    - client/src/components/transactions/TransactionTable.tsx
    - client/src/components/review/Resilience.tsx
    - e2e/tests/accounts.spec.ts
    - e2e/tests/demo/demo.spec.ts

key-decisions:
  - "A feed label the app does not know opens /accounts/connections with no ?provider=, which shows Up; the label is looked up, never concatenated"
  - "The source guard excludes only utils/movedSections.ts and *.test.ts(x); MANAGE_CATEGORIES_LINK still lives in movedSections, so plan 03's categories path stays covered"

patterns-established:
  - "New bank provider: add its label in StatusStrip.tsx (and UpSyncBadge.tsx for Up) and in movedSections' FEED_PROVIDERS together"

requirements-completed: [WAVF-01, WAVF-03]

coverage:
  - id: D1
    description: "Each provider's pill links to its own provider: Up, Plaid, SimpleFIN, Enable Banking; unknown labels open the page plainly (Codex P1 on #273)"
    requirement: "WAVF-01"
    verification:
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#bankFeedLink (#244)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/demo/demo.spec.ts#the demo opens on a finished budget, and every page works (Up pill href ?provider=up)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The page opens the provider a link names, falls back to Up for an unknown one, and keeps a chosen provider in the URL"
    requirement: "WAVF-01"
    verification:
      - kind: e2e
        ref: "e2e/tests/accounts.spec.ts#a link to Connected banks opens the provider it names (#244)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Up-only links open Up; general links open the page; CONNECTED_BANKS_LINK is gone; the client builds"
    requirement: "WAVF-03"
    verification:
      - kind: command
        ref: "grep -rn CONNECTED_BANKS_LINK client/src | wc -l -> 0; npm --prefix client run build"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/review.spec.ts tests/resilience.spec.ts (12 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "One module spells the moved addresses; a unit test fails if another client source does"
    requirement: "WAVF-03"
    verification:
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#the moved sections' addresses are written in one place"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-11-15
status: complete
---

# Phase 1 Plan 02: Bank links open their own provider Summary

**`bankFeedLink` maps a bank feed's label to `?provider=`, so a Plaid, SimpleFIN or Enable Banking status pill opens its own bank on `/accounts/connections`. The two Up-only links open Up, the alias `CONNECTED_BANKS_LINK` is gone, and a source guard keeps the moved addresses in `utils/movedSections.ts`.**

This closes the open Codex P1 on PR #273 (a Plaid pill opened Up). Plan 07 should say so in the PR body.

## Performance

- **Duration:** about 4 min
- **Started:** 2026-11-15T03:41:50Z
- **Completed:** 2026-11-15T03:45:50Z
- **Tasks:** 2 of 2
- **Files modified:** 10 on `wave-f` (none created)

## Accomplishments

- `bankFeedLink(feedLabel)` in `movedSections.ts` looks the label up in a private `FEED_PROVIDERS` map (`Up`, `Plaid`, `SimpleFIN`, `Enable Banking`), guarded with `Object.hasOwn`, and returns `connectedBanksLink(id)`. A label that is not in the map returns the plain path. The map's comment names `StatusStrip.tsx` and `UpSyncBadge.tsx` as the places that write the labels.
- `BankSyncPill` passes `bankFeedLink(feed.provider)` to `StatusPill`, and its doc comment now says Accounts → Connected banks.
- The missing round-ups hint (`BankBalanceHint`) and Review's "Check round-ups in Up settings" (`Housekeeping`) use `connectedBanksLink('up')`. Get started, the empty register and Review's "Bank changes to review" use `connectedBanksLink()`. The Housekeeping categories link is unchanged and left for plan 03.
- The temporary `CONNECTED_BANKS_LINK` export is deleted. `grep` finds it nowhere in `client/src`, `e2e` or the docs. The only remaining mention is the untracked `.omc/research/wave-f.diff`, which is outside the repository.
- New guard test "the moved sections' addresses are written in one place". It was checked against a planted literal in `Resilience.tsx`, which it caught, and the plant was reverted.

## Task Commits

On `wave-f` in `/Users/tristanvanrooyen/wt-f` (not pushed):

1. **Task 1 (tracer): a bank status pill opens its own provider**: `947d3e0` (fix)
2. **Task 2: other links re-pointed, alias removed, source guard**: `6267de4` (refactor)

**Plan metadata:** this SUMMARY's commit in the planning checkout (`redesign`)

## Files Created/Modified

- `client/src/utils/movedSections.ts`: `FEED_PROVIDERS` and `bankFeedLink` added; `CONNECTED_BANKS_LINK` removed.
- `client/src/utils/movedSections.test.ts`: `bankFeedLink` tests (four labels; `Monzo`, `constructor`, `up` and `''` rejected) and the source guard.
- `client/src/components/up/UpSyncBadge.tsx`: the pill links to its own provider.
- `BankBalanceHint.tsx`, `Housekeeping.tsx`, `GettingStarted.tsx`, `TransactionTable.tsx`, `Resilience.tsx`: each changes one import and one `to` value.
- `e2e/tests/accounts.spec.ts`: new test "a link to Connected banks opens the provider it names (#244)".
- `e2e/tests/demo/demo.spec.ts`: the Up strip link's expected href is now `#/accounts/connections?provider=up`.

## Verification Run (Node v24.10.0, one browser run at a time)

| Command | Result |
|---|---|
| Precondition: wave-f branch, Node v24 | met |
| `npm --prefix client test -- src/utils/movedSections.test.ts` (Task 1) | RED 2 failed / 5 passed, then GREEN 7 passed |
| `npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts` | 14 passed |
| `npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts` | 14 passed |
| Guard test with a planted literal in `Resilience.tsx` | failed as intended (1 failed), plant reverted |
| `npm --prefix client test -- src/utils/movedSections.test.ts` (Task 2) | 8 passed |
| `npm --prefix client run build` | built, no `error TS` |
| `npm --prefix e2e test -- --project=desktop tests/review.spec.ts tests/resilience.spec.ts` | 12 passed |
| `npm --prefix client test` (full) | 75 files, 583 tests passed |
| `cd client && npx tsc --noEmit` | exit 0 |
| `cd lint && npm run lint` | 0 errors, 128 warnings (cap 128, unchanged) |
| Acceptance greps (both tasks) | all pass: `bankFeedLink` 1, `bankFeedLink(feed.provider)` 1, "Settings → Connections" 0, `provider=up` 1, `CONNECTED_BANKS_LINK` 0, each `connectedBanksLink(...)` site 1 |

Tracer gate (auto mode): the three Task 1 checks were re-run on the implementation and passed before Task 2 started.

## Decisions Made

- An unknown feed label opens the page with no parameter, and the page then shows Up (01-01's default). The label is only looked up, never written into the URL (T-01-05).
- The guard excludes only `./movedSections.ts` and test files. `MANAGE_CATEGORIES_LINK` is still defined in that module, so the guard already covers plan 03's categories address.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The guard test's own exclusion key was wrong on the first run**
- **Found during:** Task 2
- **Issue:** Vite keys glob results in the test's own folder as `./movedSections.ts`, not `../utils/movedSections.ts`. The first version of the guard therefore flagged the module itself.
- **Fix:** The exclusion now compares against `./movedSections.ts`.
- **Files modified:** `client/src/utils/movedSections.test.ts` (before the commit)
- **Commit:** `6267de4`

**Process notes:**
- The browser test in Task 1 checks page behaviour that 01-01 had already built (`?provider=` read back, Up fallback). It passed on its first run, so it was never RED. The RED evidence for Task 1 is the unit test (2 failed) and the demo href, which the test edit changed before the pill did.
- The source guard is a regression test. It passes on the real tree because the link sites already used constants. Its ability to fail was shown with a planted literal instead.
- Task 2 is committed as `refactor`. The Up-only links now say `?provider=up`, but they already landed on Up through the page default, so nothing changes for the user.

**Total deviations:** 1 auto-fixed (Rule 1, in a test, before its commit), plus 3 process notes. **Impact:** none on scope.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-01-05 is mitigated by the fixed map with `Object.hasOwn`, and the `constructor` reject is unit-tested. T-01-06 is mitigated because the pill derives its link from `feed.provider`, all four labels are pinned, and the browser test proves the page opens the named provider. T-01-SC: no package was installed or changed. Nothing under `server/` was touched.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03 can rename `MANAGE_CATEGORIES_LINK` to `CATEGORIES_PATH` and repoint the categories half. The guard test will then fail if any client file spells `tab=categories`.
- Plan 07: the PR body should record that this closes the Codex P1 on #273.

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND on wave-f: 947d3e0, 6267de4 (ancestors of HEAD `6267de4`; 2 commits after `0c482d1`)
- FOUND: /Users/tristanvanrooyen/wt-f/client/src/utils/movedSections.ts exports bankFeedLink, connectedBanksLink, CONNECTED_BANKS_PATH
- wave-f holds no `.planning` file
