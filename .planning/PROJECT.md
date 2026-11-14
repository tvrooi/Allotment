# Allotment

## What This Is

Allotment is a self-hosted envelope budgeting app, released under AGPL-3.0-only as a fork of
`dtymoszenko/FlyBudget` (formerly the FlyBudget Up fork, now `tvrooi/Allotment`). It imports settled
AUD transactions from Up bank, gives every dollar a job in a monthly envelope budget, and adds
Australian features: payday plans, card and pay-later funding, households, tax time, investments and
forecasts. It runs as a Node/Express + SQLite server with a React client, packaged as a Home
Assistant app image and an Electron desktop app, with an in-browser demo worker. One owner uses it;
separate budgets for other people on the same server are opt-in behind a gateway.

People see the name Allotment. Stored identifiers keep `flybudget` (see Constraints).

## Core Value

Every figure the owner sees is right to the cent: bank money lands once, reconciles exactly, and each
dollar sits in exactly one envelope. No screen, sync or assistant may silently lose, double or rewrite
it.

## Current Milestone: v1.0 Redesign finish

**Goal:** finish the UI redesign on branch `redesign`: Wave F (#244 split the Settings tabs, #241
mark good moments) and Wave G (#267 one set of shared field and selector components on desktop),
without changing any money behaviour, server route or token allowlist.

Source: docs/ui/WAVES.md, docs/ui/HANDOVER-UI.md, GitHub issues #244, #241, #267
(REQ-ui-waves-redesign). Owner decision, 14 November 2026: other open work goes to later milestones
or the backlog.

GSD milestone numbers (v1.0) are separate from the app's release numbers (`0.2.0-up.N`).

## Requirements

### Validated

Already built and in use. Recorded so they are not planned again. Full list with intel IDs and
versions in `.planning/REQUIREMENTS.md` ("Validated").

- ✓ Up bank sync: settled AUD only, stable IDs, reconciled and user-edited rows preserved; Up-reported round-ups linked and shown on their purchase (up.131, up.145)
- ✓ Envelope funding from one shared calculation (`fundingState`): Assigned / Activity / Available, carry-over, overspending rules, Move money, holds, linked envelopes, own Ready-to-Assign pools (phase 6A, up.9 onward; ENVELOPE-FUNDING.md)
- ✓ Card payment funding, pay-later plans, category-funded goals, targets, payday plans, budget review, buffer and guided setup (phases 6B to 6G, up.10 to up.17; up.67)
- ✓ Resilience: priorities, flexibility reserve, life-event scenarios, goal lifecycle, resume after a lapse, extra income (phase 7, up.18)
- ✓ Transaction selection, register summary and savings rate, dashboard preferences, payee breakdown, annual overview, goal and debt presentation (phase 8, up.19 series)
- ✓ Reviewed marks, hide from reports, tags and saved views (phase 9, up.20)
- ✓ Households: sharing through `sharePayments`, recurring bills that follow their schedule's amount, default household, edit details, reconciliation with adjustment entries, combined households (HOUSEHOLDS.md)
- ✓ Separate budgets per person behind a gateway; password codes by Home Assistant notify, email or administrator code; reminders through the gateway (up.48, up.128, up.129)
- ✓ Receipts and Files, tax deductions, working from home (D4a), depreciating assets phases 1 to 3, investments with sales, income, franking and splits (up.42 to up.144)
- ✓ Cash runway forecast with saved scenarios, and the long-term forecast (FORECASTS.md, LONG-TERM-FORECAST.md)
- ✓ Read-only access tokens, MCP endpoint, token writes only through `/api/assistant/do` with the policy table and checks inside the write (up.99 to up.127)
- ✓ Brand: Allotment name, palette, tab icon (up.131; docs/BRAND.md)
- ✓ Redesign Waves A to E: shell and add-from-anywhere, search palette, small fixes, dashboard, discoverability, navigation depth (up.167 to up.173, on `redesign`, untagged)

### Active

Milestone v1.0. Detail and traceability in `.planning/REQUIREMENTS.md`.

- [ ] **WAVF-01 to WAVF-03** Settings split: Connected banks moves to Accounts, Categories to Budget, every old link still lands (#244)
- [ ] **WAVF-04, WAVF-05** Good moments: a completed goal and a $0 Ready to assign are marked in the brand voice (#241)
- [ ] **WAVG-01 to WAVG-04** Shared form controls: audit, one component set from `@theme` tokens, accessible, with a gallery and screenshot test (#267 G0, G1)
- [ ] **WAVG-05, WAVG-06** Everyday, planning, reports and files screens moved onto the shared controls (#267 G2, G3)
- [ ] **WAVG-07 to WAVG-10** Settings, banks and the remaining screens moved; no money in `type="number"`; lint guard; old controls removed (#267 G4, G5)

### Out of Scope

- Redesigning Review, Cash flow or Household (#217, #218, #219): shelved by the owner. Wave G may only swap their controls, as scoped by the owner's decision 4.
- Any server change in Waves F and G (no new route, nothing on the read-only allowlist, `/api/assistant/do` or MCP): owner rule for the redesign waves.
- Tagging, publishing or installing `redesign` builds without the owner's release decision: release is undecided (WAVES.md).
- Moving to a different Home Assistant app ID, or migrating, replacing or deleting a live budget as part of a release: CLAUDE.md; needs explicit owner go-ahead and a verified cold backup.
- D4b car expenses, household partner links, depreciating-assets phase 4 extras, the documentation fixes from the ingest: owner put them after milestone v1.0 (see REQUIREMENTS.md v2).
- Tax advice, lodging with the ATO, tax payable estimates: the app keeps records only (RECEIPTS-AND-TAX.md, TAX-CAR-AND-HOME.md).
- Market data, broker imports or any network call for prices: manual prices only (INVESTMENTS.md).
- Up webhooks: sync runs at startup, on Sync now and by opt-in polling (CLAUDE.md).
- New features for Plaid, SimpleFIN and Enable Banking: frozen as community supported, CSV upload offered instead (audit I-10).

## Context

- **Brownfield.** About 173 releases on the `0.2.0-up.N` line. Codebase map in `.planning/codebase/`
  (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS). Ingested docs: 45
  (22 SPEC, 10 PRD, 13 DOC, no ADRs); intel in `.planning/intel/`, conflicts in
  `.planning/INGEST-CONFLICTS.md`.
- **Branch state (14 Nov 2026).** `redesign` is at `0.2.0-up.173`, ahead of `main`; the latest tag is
  `v0.2.0-up.153`. up.154 to up.173 are prepared and untagged. HANDOVER-UI.md says up.154 to up.172 and
  WAVES.md says up.154 to up.171; re-check with `git log` (ingest INFO). PR #209 (budget work) was
  closed unmerged and is to be reconciled with `main` later.
- **How waves run** (docs/ui/WAVES.md). One PR per wave to `redesign` with `--repo tvrooi/Allotment`.
  The worktree is made by hand from `origin/redesign`, because the Agent tool's worktree isolation
  looks for `origin/main`. Test first, with a failing test per fix. Screenshots go in
  `.ui-evidence/<date>-<wave>/`. Review the screenshots, merge when **CI passed** is green and Codex
  has no unresolved finding, and close the issues by hand (`redesign` is not the default branch).
  Reviewers so far: Antigravity (`agy`) and the GitHub Codex review, which has a usage limit.
- **Traps on record** (WAVES.md, HANDOVER-UI.md):
  - Use Node 24; Node 26 breaks 11 Safe mode tests.
  - Never set `E2E_SKIP_BUILD=1`.
  - e2e ports are fixed (#251), so only one browser run at a time.
  - The lint warning cap is 135 and full; a new warning must be fixed, not counted.
  - Menus inside animated panels need `overflow-clip`.
  - Lazy shell chunks must survive offline (`utils/retryingImport.ts`).
  - Making a shared call do more means checking every caller.
  - `PREFERENCES_VERSION` is 4.
- **Open UI issues outside this milestone.**
  - `needs-triage`: #249, #250, #251, #252, #254, #260, #263, #268, #269, #270, #271.
  - `ready-for-agent` housekeeping: #211 to #214, #216, #220.
  - `ready-for-human`: #215 (needs the owner's iPhone) and the shelved #217 to #219.
  - #264 (a disabled Switch looks enabled) is folded into Wave G G1, as #267 plans.

## Constraints

- **Money**: integer minor units of the account's currency. No floats, `parseFloat` or `Number()` on amounts. Money inputs go through `CurrencyInput` (`type="text" inputMode="decimal"`), never `type="number"`. Conversion happens only at UI boundaries (`client/src/utils/currency.ts`). Why: core value; Wave G touches every input.
- **Dates**: real `YYYY-MM-DD` (`isoDate`, `isoMonth`); displayed dates go through `client/src/utils/dates.ts`. Why: Wave G may move 47 date fields to a popover (decision 5).
- **Data**: migrations are additive and numbered, with a `_journal.json` entry. New tables are in `BACKUP_TABLES` or the PR says why not. A shipped migration is never edited. Never migrate, replace or delete a live budget as part of a code release. Why: CLAUDE.md data safety.
- **Writes**: transaction, balance, transfer, household and budget writes go through the shared helpers and services, in one DB transaction. A sync never overwrites reconciled or user-edited rows. Transfers are suggested, never guessed (the only exception is Up-reported round-ups). Why: CLAUDE.md invariants.
- **Access tokens**: read-only tokens reach only the allowlisted GET routes plus MCP. Token writes go only through `/api/assistant/do` policy rows. Never add a writing, settings, backup, auth or bank route. Why: security model (READ-ONLY-ACCESS.md, ASSISTANT-ENDPOINTS.md).
- **Security**: keep host, origin and auth protections. Remote Electron pages get no Node or preload bridge. HTTPS away from home; never bypass TLS. Never commit tokens, cookies, `.env`, databases, bank exports, `credentials.key` or hostnames. Tests use mock bank data and disposable budgets.
- **Naming**: users see Allotment. Stored identifiers keep `flybudget`: `FLYBUDGET_*`, cookies, headers, data paths, `flybudget_up`, image names, `flybudget-mac-window` and the desktop internal name. Why: renaming strands data.
- **Dependencies**: lockfiles, and `.npmrc` with install scripts disabled; never weaken it. New packages must be justified, small and maintained, and are not auto-merged. Why: Wave G decision 1 may add shadcn primitives.
- **UI (redesign waves)**:
  - Design tokens come only from `client/src/index.css` `@theme`.
  - Layouts hold at 390 px with no sideways scroll, in light and dark.
  - Safe mode, the demo, offline and server mode keep working.
  - Save controls respect `useCanSave` / `<SavingPausedHint />`.
  - Interactive controls have accessible names.
  - Guide and tip ids are never renamed.
  - A change removes what it replaces.
  - Why: WAVES.md rules and the review guidelines in CLAUDE.md.
- **Process**: for each wave PR:
  - Run the full desktop, phone, demo and server-mode e2e suites, plus `npx tsc --noEmit` in `e2e/`.
  - Run `npm run release:prepare -- <next 0.2.0-up.N>` and add a CHANGELOG entry.
  - Update docs/ui/HANDOVER-UI.md and docs/ui/MAP.md.
  - Use conventional commits.
  - Never accept the upstream CLA.
  - Never move a tag.
  - Documentation-only changes keep the version.
- **Release**: do not tag, publish or update the live app from `redesign` until the owner decides. Before any live update: verify the installed app identity, take a restorable cold backup including the encryption key, then verify health and budget access.

## Key Decisions

These owner decisions are locked: the owner took them, and they are built or in force. They are
recorded inside SPEC, PRD and DOC sources; there are no ADRs.

<decisions>

- **DEC-ui-owner-decisions-waves** (docs/ui/WAVES.md, 11 to 13 Nov 2026):
  - #224 palette: no server change, no new route, nothing added to the allowlist, `/api/assistant/do` or MCP; `/` opens the palette.
  - Wave D: Household, Tax time and Files show as dimmed "Set up" rows; Household gets a promise, an example and one button; the welcome step only.
  - Wave E: payee page `/payees/:id`; one click opens a row's details; every undoable change announces itself, with the toast staying 8 s; gutters 16 px on phones, 24 px from `md`; categories always use `CategoryPicker`, short lists the shared styled `Select`.
  - #244: the Settings split is endorsed.
  - Release of `redesign` is undecided: do not tag, publish or update live.
- **DEC-critique-budget-currency-and-rail** (docs/critiques/2026-11-09-budget.md, up.154): Ready to assign leads the rail and is green while its figure holds; the budget's own currency is written as plain `$`; the rail's working folds under "How this is worked out"; $0 rows are hidden; pills only for overspent (red) and short or carried (amber).
- **DEC-guides-owner-decisions** (docs/GUIDES.md):
  - Guide progress is stored per person in their budget, never in backups or on the allowlist.
  - New budgets are tour-first; at most one onboarding element sits above a page's content.
  - Never rename a guide or tip id.
- **DEC-audit-I-1** (AUDIT-2026-11): the Dashboard's "left to spend" leaves out Savings envelopes and goals' categories.
- **DEC-audit-I-2**: the first bank connection starts the budget that day (`budget_start_day`, migration 0063).
- **DEC-audit-I-3**: deleting a bank-fed row warns and offers a one-tap Restore.
- **DEC-audit-I-4-to-I-11** (4 Nov 2026):
  - I-4 the sidebar is grouped, with progressive disclosure.
  - I-5 System theme by default.
  - I-6 optional "Backup with files" ZIP.
  - I-7 tour-first onboarding.
  - I-8 owner-confirmed category offers on repayments.
  - I-9 `website/` removed.
  - I-10 Plaid, SimpleFIN and Enable Banking frozen as community supported, with CSV upload offered.
  - I-11 dedicated assistant endpoints with their own audit log.
- **DEC-assistant-policy-table** (ASSISTANT-ENDPOINTS.md): token writes only through `/api/assistant/do`. Every policy row is an owner-approved exception; never add a writing, settings, backup, auth or bank row; never rename a row.
- **DEC-assistant-checks-inside-write** (ASSISTANT-PHASE-3.md, up.127): option A. A row's check re-runs inside the write's DB transaction (`assistantGuard`), and token claims are insert-only.
- **DEC-envelope-owner-requested-features** (ENVELOPE-FUNDING.md):
  - Envelopes can follow one account (`categories.linked_account_id`).
  - Accounts can carry their own Ready to Assign (`accounts.assign_pool`).
  - Hold for next month and Keep overspending are owner-only settings.
- **DEC-email-codes-and-reminders** (MULTI-USER-EMAIL-AND-REMINDERS.md):
  - SMTP is set only through Home Assistant options; Nodemailer; TLS always.
  - Each person chooses phone, email or both.
  - The gateway owns delivery; no email codes for single-budget installs.
- **DEC-tax-car-home-owner-decisions** (TAX-CAR-AND-HOME.md, 8 Nov 2026):
  - H1 hours log; R1 ATO rate table plus override; K2 trips fill the logbook.
  - C1 a D1 claim names its car; A1 asset link is a prompt only.
  - T2 organise tokens read, no writes; L3 lodged years may change and are flagged "Amended since lodging".
  - The $1,000 instant deduction only if the law is confirmed; D4a before D4b.
- **DEC-depreciating-assets-owner-decisions** (DEPRECIATING-ASSETS-PLAN.md, 4 Nov 2026): the low-value pool is phase 3; organise tokens read assets, and changes are owner-approved proposals; lodged-year lock; built-in suggested effective lives; rental capital works, business assets and capital gains on the private share are out of scope.
- **DEC-investment-sales-owner-decisions** (INVESTMENT-SALES-AND-INCOME.md, 7 Nov 2026):
  - A sale consumes lots, FIFO by default with Choose parcels; losses go to non-discountable gains first.
  - One income row per payment.
  - Trusts record cash and franking only.
  - Split or consolidate is an action.
  - A read-only assistant tool (decision 7, the owner's choice).
  - Tax time leaves out retirement accounts.

</decisions>

Proposed or partly open (not locked):

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DEC-household-partner-claims: approach B, a claim row in the partner's budget (HOUSEHOLD-PARTNER-LINKS.md) | Nothing is copied between budgets; the owner answered decisions 1, 2, 3 and 6 | — Pending: decisions 4, 5, 7, 8 and 9 open; design only, nothing built |
| DEC-long-term-forecast-decisions: assumptions and exclusions (LONG-TERM-FORECAST.md section 17) | Defaults are visible, changeable assumptions | — Pending: nine section 17 questions keep their defaults; the engine is built on them |
| Milestone v1.0 is Waves F and G only (owner, 14 Nov 2026) | Finish the redesign before new features | — Pending |

## Open Questions

Unresolved owner or doc-maintainer decisions. None was decided during setup, and no doc was edited.

**From the ingest (INGEST-CONFLICTS.md warnings):**

- **W-1 Payment funding for pay-later plan accounts: at creation, or a reviewed step?**
  - Docs: PAYMENT-PLANS.md says a plan account "gets payment funding when it is created (an empty account needs no review)". CARD-PAYMENTS.md says payment funding is "an explicit, reviewed change" per card or line of credit, with no exception.
  - Code: today `server/src/services/paymentPlanService.ts` calls `setupEmptyCardFunding` at creation. That is a statement of fact, not a ruling.
  - The owner decides whether CARD-PAYMENTS.md gains the exception or the behaviour changes. **No side is taken here.**
- **W-2 An account that is both an own-Ready-to-Assign pool and the account an envelope follows** (money correctness).
  - ENVELOPE-FUNDING.md has no rule for this combination.
  - Code: only the category-level refusal was found ("A category that follows an account can't also be funded from a pool", `earmarkError` in `server/src/services/assignPools.ts` and the categories route). No account-level rule is confirmed.
  - Risk: the pool's resources and the linked envelope's mirrored Available may count one balance twice.
  - The owner decides: forbid the combination (with a test and a doc line), or define how the pool figure treats the mirrored envelope. **No side is taken here.**
- **W-3 Household reconciliation request shape and default-household storage.**
  - HOUSEHOLDS.md matches the code: `POST /api/households/:id/reconcile` takes `{ date?, agreed?: [{ personId, amount }] }`; the entries are `pool_adjustment` and `balance_adjustment`; the default is an `is_default` column on the group.
  - PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md sections 3 and 4 (`{ asOf, agreed: {...} }`, kind `adjustment`, preference `defaultHouseholdId`) are stale; `defaultHouseholdId` does not exist in the code.
  - Doc fix pending.
- **W-4 Saved forecast scenarios.**
  - FORECASTS.md matches the code: `server/src/routes/forecast.ts` serves `GET|POST /api/forecast/scenarios`, `PUT|DELETE /:id`.
  - The Phase 7 brief's "saving scenarios is deferred / nothing is stored" is stale.
  - Still open: whether life events (`incomePauses`, `costChanges`) are meant to be stored with a saved scenario. The save route validates with the same `scenarioSchema`, which includes them, so the code appears to keep them (not confirmed end to end), while RESILIENCE.md says life events are not saved.
- **W-5 READ-ONLY-ACCESS.md lists fewer tax reads than the code allows.**
  - The code (`TAX_READ` in `server/src/auth/accessTokens.ts`) matches the owner's approvals in DEPRECIATING-ASSETS-PLAN.md and TAX-CAR-AND-HOME.md: it also allows `/tax/assets[/:id]` and `/tax/pool`.
  - READ-ONLY-ACCESS.md under-describes these, and its MCP list omits `tax_assets`.
  - The approved car reads (T2) are not built (D4b), so they belong in READ-ONLY-ACCESS.md when D4b ships. Doc fix pending.
- **W-6 INVESTMENTS.md says the investments routes are not on the token allowlist.**
  - READ-ONLY-ACCESS.md and INVESTMENT-SALES-AND-INCOME.md (decision 7) match the code: `TAX_READ` includes `/^\/investments$/`, read only.
  - INVESTMENTS.md is stale. Doc fix pending.

**For milestone v1.0:**

- **Wave G gate (#267): five owner decisions before the component spec.**
  1. New dependencies: shadcn on Radix or Base UI plus `class-variance-authority`, `clsx` and `tailwind-merge`, or "shadcn look, no new primitives".
  2. Phones: one component API everywhere, and whether phones keep the native select, date and time pickers.
  3. Confirm that Wave G replaces Wave E's "short lists use the styled native Select" rule on desktop.
  4. Scope of the first pass: all screens, or a mechanical swap only for the shelved and split-candidate pages.
  5. Dates: whether the 47 `type="date"` fields move to a calendar popover in this milestone or later.
- **Release of `redesign`**: undecided. The orchestrator recommends one release soon because the Safe mode chart fix (#246) is a privacy fix; it and the menu fix belong in the release notes.
- **WAVES.md lifetime**: the file says to delete it once Wave F merges, but Wave G is planned from it. Decide whether it stays until Wave G ends.
- **Still overrulable**: Wave C choices (PR #255 body) and Wave D choices (PR #262 body). The owner has not been asked about "Sync now" in the palette.
- **Later**: #263 (a Review checklist in place of the guide banners) needs an owner design decision; household partner links decisions 4, 5, 7, 8 and 9; long-term forecast section 17.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move them to Out of Scope with the reason.
2. Requirements validated? Move them to Validated with a phase reference.
3. New requirements emerged? Add them to Active.
4. Decisions to log? Add them to Key Decisions.
5. Is "What This Is" still accurate? Update it if it has drifted.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections.
2. Core Value check: still the right priority?
3. Audit Out of Scope: are the reasons still valid?
4. Update Context with the current state.

---
*Last updated: 2026-11-14 after initialisation from docs ingest (milestone v1.0 Redesign finish)*
