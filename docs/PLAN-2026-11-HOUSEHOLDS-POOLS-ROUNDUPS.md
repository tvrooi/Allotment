# Plan: households, recurring, Up round-ups, Essentials pool, brand sweep (November 2026)

Owner-requested on 7 November 2026. This file is the work plan for an implementing agent (Sonnet,
in a separate session). Read CLAUDE.md first; every rule there applies. Ship **one PR per section,
in this order**, each with a failing-then-passing test, `npm run release:prepare -- <next-version>`
and a CHANGELOG entry (section 7's sweep may be docs/text only where it touches no app code).

## Owner's requests and decisions

1. Edit a household's details, including its name.
2. Choose which household shows by default.
3. Editing a recurring amount does not reach the household bill amount.
4. Explain where the household figures come from, add reconciliation of household owings, extend
   the MCP tools, then zero the household out.
5. Cancelled recurring items should not show.
6. Up Round Ups should attach to their purchase as secondary, not appear as a detached 52c
   transfer to review.
7. The browser tab icon still shows the old icon; remove remaining FlyBudget references (use a
   Sonnet subagent for the sweep).
8. The Essentials account (Up) is a separate assignable pool for bills paid from it.

Decisions (owner, 7 November 2026):

- Cancelled recurring is hidden from the Monthly list, household recurring bills, and
  calendar/forecast/budget. It stays visible under **All recurring**.
- The household is zeroed with a dated, undoable "balance agreed" adjustment per person, applied
  to the live budget only after the owner confirms the figures. Never as part of a migration.
- Essentials becomes a separate Ready to Assign pool, per account flagged as a pool.

## 1. Cancelled recurring hidden everywhere (small)

- `client/src/components/recurring/MonthlyTab.tsx`: filter `status === 'cancelled'` out before
  `groupOccurrences` / `renderSection` (`computeTotals` already skips it). Same for the Calendar
  view in `client/src/components/recurring/`.
- Server: `householdService.sharedRecurringBills` and `scheduleScope.scheduleScopes` skip schedules
  that are ended or soft-deleted (`scheduleActivity.endSchedule`; soft delete in
  `routes/schedules.ts` marks pending occurrences `cancelled`). Check `forecastService.ts`,
  `expectedDebits.ts`, cash flow and `fundingPlan.ts` targets for the same exclusion.
- `AllTab.tsx:67` maps `'canceled'` to `'cancelled'`: move the status names to one shared constant
  instead of retyping them.
- Tests: Vitest for scope/forecast exclusion; Playwright checks a cancelled row is absent from
  Monthly and present under All recurring.

## 2. Recurring amount edit reaches the household bill

- Cause found: recurring shares are derived (`scheduleScope.ownShare` → `billShares`), but
  `household_bills.amount` / `personalShare` are stored and never updated when
  `PUT /api/schedules/:id` (`server/src/routes/schedules.ts`, about lines 388–461) changes the
  amount. An **exact** split keeps fixed cents whatever the amount, so it also drifts.
- Write the failing test first: a Rent schedule (A$4,780) shared with a household, edit the
  amount, expect the household bill and the "Your share" occurrence to change.
- Fix: in the same DB transaction as the schedule update, recompute unmatched, unpaid
  `household_bills` linked by `scheduleId`, through a helper extracted from
  `householdService.editBill` (one implementation; never touch matched or paid bills). For an exact
  split that no longer adds up, return a warning and show the existing "doesn't add up" state on
  the bill. The schedule mutation hook invalidates the household query keys.

## 3. Edit household details; default household

- Server: `PUT /api/households/:id` (Zod: `name` 1–80 chars; `currency` only while the group has
  no events) → `householdService.updateGroup`, logged in `household_activity`. Confirm the demo
  worker (`server/src/browser/app.ts`) serves it.
- Default: a preference `defaultHouseholdId` (bump `PREFERENCES_VERSION` with a migration step).
  `client/src/pages/Household.tsx` (about lines 110–124) picks `?household=` → preference →
  `groups[0]`. Add **Make default** beside the household select and an **Edit details** modal
  (name, logo, default split; reuse the existing logo and default-split routes). The sidebar
  Household row (`SidebarAccountList.tsx`) opens the default household.
- MCP: `list_households` marks the default. No token write for this (owner-only settings).

## 4. Household reconciliation, then zero it

- Where figures come from today: per-person balances are `householdLedger()`
  (`server/src/services/householdLedger.ts`): `toPool` (contributions minus shares of expenses the
  pool paid) plus `direct` (paid for others ± settlements). The sidebar **Household** amount is the
  bank balance of the pool accounts (`householdPool`), a different thing. Add a "Where these
  figures come from" expander on the Household page listing each event with a running total per
  person, built on `/households/:id/statement`.
- New event kind `adjustment` (additive migration if `kind` is constrained; `_journal.json` entry),
  with per-person `household_shares` amounts that bring each balance to an agreed figure.
  `POST /api/households/:id/reconcile` body `{ asOf, agreed: { [personId]: cents } }` (default 0)
  computes adjustments from `householdLedger`, records them through `recordEvent` in one
  transaction, and is undoable through `removeEvent`. `direct` totals must still sum to zero.
  Update `validSettlements`, the statement, `sharedExport`, backup restore of older versions, and
  the demo budget.
- UI: **Reconcile** on the Household page: current balances, agreed inputs (default 0), preview,
  Confirm.
- MCP: read tool `household_reconciliation_preview` (side-effect-free GET; allowlist and
  `docs/READ-ONLY-ACCESS.md`). Write only as an owner-applied proposal,
  `propose_household_reconciliation` (organise scope) in `routes/mcp.ts` `ACTION_TOOLS`, a row in
  `auth/assistantPolicy.ts` with allowed and refused cases in `assistantPolicy.test.ts`, and
  `docs/ASSISTANT-ENDPOINTS.md`. Add the exception (owner-requested 7 November 2026) to CLAUDE.md
  and AGENTS.md, byte-identical.
- Live zeroing after release: cold backup per CLAUDE.md, show the owner the preview for the live
  household, apply only after they confirm.

## 5. Up Round Ups attached to their purchase

- Up API: `attributes.roundUp { amount, boostPortion }` is on the purchase (`amount` negative and
  includes any boost). The sample suggests the purchase `amount` excludes the round-up; verify
  against a mock built from a real response shape. The Saver receives its own credit, often one
  per day, with `relationships.transferAccount` set.
- Existing code: `upTransactions.ts` parses `roundUp` and deliberately imports no row;
  `upReviewService.ts` has `roundUpDays`, `roundUpDebit` (`:roundup` rows when the owner enabled
  them), `roundUpCheck`, `enableRoundUpDebits`; suggestions come from
  `transferService.listTransferSuggestions` and `transferMatching.ts`.
- Change:
  - Spending account: show the round-up as secondary on the purchase (e.g. "A$4.60 · round-up
    A$0.40 to Saver"). When debits are enabled, link the `:roundup` row to its purchase and hide it
    from the register list while it still counts in the balance. Reuse the split model
    (`isParent`, `inAccountBalance`) if it fits; otherwise an additive `round_up_of` column.
  - Saver: group the day's round-up credit against `roundUpDays`. Link automatically only when Up
    reports it (`transferAccount` set, same day, sum equal to the cent); that is bank-reported, not
    a guess. Otherwise show one grouped suggestion ("Round-ups for 5 Nov, 12 purchases"), never one
    prompt per purchase.
  - Keep round-up legs out of the ordinary transfer suggestions. Never rewrite reconciled or
    user-edited rows; stable IDs so a re-sync adds nothing.
- Tests with mock Up payloads: purchase with round-up and boost, daily Saver credit, re-sync adds
  nothing, a mismatch stays a suggestion. Update `UP-SUPPORT.md`.

## 6. Essentials as a separate assignable pool

- Today: one Ready to Assign (`budgetService.fundingState`, `resourcesAt`,
  `balances.personalBudgetAccount`). Nearest concept: `categories.linkedAccountId`
  (`budgetLedger.linkedTransfers`).
- Account flag `assignPool` (additive column; `BACKUP_TABLES`; older backups restore). For flagged
  accounts `fundingState` also returns `pools: [{ accountId, readyToAssign }]`; the main figure
  excludes their balances and the envelopes earmarked to them.
- Earmarking: a category belongs to a pool when its bills come from that account (derived from
  `schedules.accountId`), with an explicit `categories.poolAccountId` override. Assigning to an
  earmarked category draws from its pool; `budgetMoves.fundedWrite` enforces it. Transfers into the
  account raise the pool; transfers out lower it.
- UI: `BudgetSummaryWidget.tsx` shows "Essentials: A$X to assign" beside the main figure; the
  Budget page groups earmarked categories under their pool; toggle in `EditAccountModal.tsx`.
- Property tests (fast-check): main + pools = resources − envelopes; no cent counted twice. Update
  `docs/ENVELOPE-FUNDING.md`, the demo budget and the MCP budget read output.

## 7. Tab icon and remaining FlyBudget text

- `client/public/logo.png`, `logo.svg` and `electron/resources/*` already show the Allotment mark;
  `client/index.html` uses `/logo.png` as the only icon. Add `favicon.svg`, `favicon-32.png` and
  `apple-touch-icon.png` from `logo.svg`, reference them with a version query in `index.html` and
  `manifest.webmanifest`, and bump the cache name in `client/public/sw.js` so no stale icon is
  served. Check `electron/resources/icon.ico` and the HA icon (`homeassistant/package.py` copies
  `logo.png`). Confirm in a browser which page sets the tab icon under HA ingress.
- Spawn a **Sonnet subagent** to sweep case-insensitive `flybudget` (about 790 hits; most in docs,
  server, root files and e2e). Change only user-visible text to Allotment. Keep every stored
  identifier CLAUDE.md and `docs/BRAND.md` list (`FLYBUDGET_*`, cookies, headers, data paths,
  `flybudget_up`, image names, `flybudget-mac-window`, the desktop internal name) and the upstream
  and licence attribution to `dtymoszenko/FlyBudget`. Put the subagent's table (path, text, changed
  or kept and why) in the PR body.

## Verification (each PR)

- `npm test --prefix server -- <affected>`; `cd server && npx tsc --noEmit`.
- `npm test --prefix client`; `npm run build --prefix client`.
- `cd e2e && npm test -- --project=desktop tests/<spec>` for Monthly, household and budget flows.
- `cd lint && npm ci && npm test && npm run lint` (warning cap does not rise).
- Migrations tested on a populated database (`loanDetails.test.ts` shows how).
