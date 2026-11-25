---
phase: 03-screens-on-shared-controls
plan: 31
subsystem: api
tags: [express, transactions, review, bulk-edit, route-removal, vitest]
gap_closure: true
gap_ids: [G-03-2]

requires:
  - phase: 03-screens-on-shared-controls
    provides: the selection menu's Mark reviewed on POST /transactions/bulk, the removed Mark reviewed button and client request (03-27, 03-28)
provides:
  - One server path for marking a list reviewed (POST /transactions/bulk with changes.reviewed)
  - The review guarantees (expected-count 409, already-reviewed rows keep their time, exact undo) proved on the bulk route
  - POST /transactions/review removed (answers 404)
removed:
  - POST /transactions/review handler, reviewChangeSchema, reviewSchema, ReviewChange, reviewSelection, restoreReview
affects: [03-29]

actuals:
  tokens: 6000
  tasks: 2
  commits: 3

plan_head_before: 9165b3b5cc631dc1b8d484950988df28692266aa
plan_head_after: 3042121f3f5e80c74d82a5c588a61f8a7328d338
commits: 3

tech-stack:
  added: []
  patterns:
    - "A route's last caller is removed in one plan and the route in the next, with the caller audit recorded before removal"

key-files:
  created: []
  modified:
    - server/src/routes/transactions.ts
    - server/src/services/transactionMarks.ts
    - server/src/routes/phase9.test.ts
    - docs/PHASE-9-DEVELOPMENT-PHASE.md

key-decisions:
  - "The 404 check reads only the response status: Express answers an unknown route with an HTML page, which the test's JSON helper cannot parse"

requirements-completed: [WAVG-05]

duration: ~15min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 31: Remove the POST /transactions/review route Summary

**The server route only the old Mark reviewed button used is gone: marking a list reviewed is now POST /transactions/bulk with `changes: { reviewed }`, with the expected-count 409, the unchanged already-reviewed rows and the exact undo proved on that route.**

## Accomplishments

- **Caller audit (recorded before removal).** Searched `client/src`, `server/src` (including `routes/mcp.ts`, `server/src/browser/`, `auth/assistantPolicy.ts`, `auth/accessTokens.ts`), `e2e`, `electron`, `homeassistant`, `scripts`, `skills` and every top-level and `docs/` markdown file (excluding `docs/handover/ARCHIVE.md`) for the old route path and `reviewSelection`, `restoreReview`, `ReviewChange`, `reviewSchema`, `reviewChangeSchema`, `useReviewSelection`. Hits, all inside this plan's four files:
  - `server/src/routes/transactions.ts`: the two imports, `reviewChangeSchema`, `reviewSchema` and the handler.
  - `server/src/services/transactionMarks.ts`: `ReviewChange`, `reviewSelection`, `restoreReview`.
  - `server/src/routes/phase9.test.ts`: three posts in the "review" test.
  - `docs/PHASE-9-DEVELOPMENT-PHASE.md`: two mentions.
  - Non-hits that look similar: `previewSchema` in `tax.ts` and `depreciatingAssetService.ts` (different name); `routes/mcp.ts` has `budget_review` on GET `/review` and its housekeeping and resilience siblings, `browser/app.ts` mounts `reviewRouter` at `/review` and the shared `transactionsRouter`, `accessTokens.ts` lists GET `/review`, `assistantPolicy.ts` names only `/rules/test` and `/rules/preview`. None calls the removed route. No stop condition was met.
- **Ported test.** "marks the confirmed selection, refuses a changed one and undoes exactly" now posts to `/transactions/bulk`: `changes: { reviewed: true }`, `expectedCount: 3` answers 200 with `matched` 3 and `changed` 2, and the `restore` ids are `groc` and `laptop` (the already-reviewed `pay` keeps `2026-10-01T00:00:00.000Z`); a fourth row makes `reviewed: false` with `expectedCount: 3` answer 409 and write nothing; posting `restore` returns `{ restored: 2 }` and puts the times back exactly. A new case, "has one route for marking a list reviewed: the old review route is gone", asserts POST `/transactions/review` answers 404 and marks nothing.
- **Removal.** `routes/transactions.ts` loses the handler, both schemas and the two imports; `services/transactionMarks.ts` loses the interface and the two functions, and its now-unused imports (`and`, `isNull`, `registerCondition`, `Selection`). `parseSelection`, `sendMarkError`, `MarkError`, tags and saved views stay. No migration, schema or stored identifier touched.
- **Doc.** The "Review" section of `docs/PHASE-9-DEVELOPMENT-PHASE.md` describes bulk review on `POST /api/transactions/bulk` (selection, optional `ids`/`excludeIds`, `changes: { reviewed }`, `expectedCount`, 409, `restore` for the undo), names Mark reviewed in the selection menu as the explicit action, and notes the separate route was removed because only the old button used it.

## Task Commits

1. **Task 1 RED:** `f6946328` (test) - ported test and the 404 case.
2. **Task 1 GREEN:** `9ac7f64a` (refactor) - route, schemas, types and functions removed.
3. **Task 2:** `3042121f` (docs) - phase 9 doc.

## RED result (recorded before the removal)

On the unmodified route: 8 of 11 cases passed, 3 failed. The 404 case failed with `expected 200 to be 404` (the old route still marked the October list reviewed). Two later cases ("creates, assigns, filters and deletes tags…" and "round-trips tags, views and flags in format 12…") also failed, only because the old route's write left reviewed rows behind that those cases do not expect. They passed again once the route was removed. The ported bulk case passed on the unmodified code, as expected: it proves guarantees the bulk route already had.

## Verification

- `npm test --prefix server -- src/routes/phase9.test.ts src/services/transactionEdits.test.ts`: 2 files, 26 tests passed.
- `cd server && npx tsc --noEmit`: clean.
- `npm --prefix e2e test -- --project=desktop tests/phase9.spec.ts`: 4 passed (including "marks the whole list reviewed from the selection menu, and undoes it").
- `npm --prefix lint run lint`: 0 errors, 121 warnings (cap 122, none added).
- Prettier clean on all four changed files.
- Acceptance greps: `reviewSelection|restoreReview|ReviewChange` exports in `transactionMarks.ts` 0 (was 3); `reviewSchema` in `transactions.ts` 0 (was 2); old route path in `client/src e2e/tests docs server/src/routes/transactions.ts server/src/routes/mcp.ts server/src/browser` 0 (was 5); `/api/transactions/bulk` in the phase 9 doc 2 (was 0); `git diff --stat HEAD -- server/src/db` empty.

## For 03-29 (PR body)

Removed the `POST /transactions/review` server route (handler, schemas, `ReviewChange`, `reviewSelection`, `restoreReview`). Only the Mark reviewed button 03-28 removed ever called it; marking a list reviewed is `POST /transactions/bulk` with `changes: { reviewed }`, which the selection menu already used. The web client, desktop remote pages and HA app all load the client the server serves, so no shipped client still calls it after this release; MCP, the demo worker, the assistant policy and the read-only allowlist never used it. The bulk route's guarantees (expected-count 409 with nothing written, already-reviewed rows keep their time, exact undo) are proved in `phase9.test.ts` and end to end in `phase9.spec.ts`. No migration or schema change. The route removal is a server API change: it belongs in the CHANGELOG entry for the release.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verification environment**
- **Found during:** Task 1 RED run
- **Issue:** the worktree had no `node_modules`.
- **Fix:** symlinked the main checkout's `client`, `server`, `e2e` and `lint` `node_modules` (git-ignored) and removed them before returning. The e2e ports were free, so `e2e/ports.ts` was not touched.

**2. [Rule 1 - Bug in own test] 404 case read the body as JSON**
- **Found during:** Task 1 GREEN run
- **Issue:** Express answers an unknown route with an HTML page, which the test's `send` helper cannot parse, so the 404 case threw after the removal.
- **Fix:** that case uses `fetch` directly and reads only the status.
- **Files modified:** `server/src/routes/phase9.test.ts`
- **Commit:** `9ac7f64a`

**Total deviations:** 2 (1 blocking, 1 bug in own test). **Impact:** none on scope.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. A route was removed; no new endpoint, auth path or schema. T-03-48 (stranded caller) is covered by the caller audit above and `phase9.spec.ts`; T-03-49 (review writes on the bulk route) by the ported test.

## Self-Check: PASSED

- Commits present on this branch: `f6946328`, `9ac7f64a`, `3042121f`.
- Four planned files modified; nothing else changed.
