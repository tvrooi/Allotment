# Decisions

Synthesized from 45 classified docs (MODE new). The ingest set contains no ADRs and no classification has `locked: true`, so no decision below is a LOCKED ADR. Entries are owner decisions recorded inside SPEC, PRD and DOC sources; status says whether the source records them as taken (locked here means the owner took it and it is built or in force) or still proposed.

## DEC-assistant-checks-inside-write: option A (re-run the row's check inside the write)
- source: docs/ASSISTANT-PHASE-3.md
- status: locked (owner decision 6 Nov 2026, built in 0.2.0-up.127; not an ADR, no `locked: true` classification)
- decision: Option A chosen over B (dedicated handlers) and C (one transaction per request); check runs twice (early in `requireSession` and inside the write); token claims insert-only; guard refusal wording "This changed before it could be saved: <reason>". Decision 5 (MCP change-set race) left as a separate follow-up.
- scope: assistant endpoints, access tokens

## DEC-assistant-policy-table: token writes only through `/api/assistant/do` with a policy table
- source: docs/ASSISTANT-ENDPOINTS.md
- status: locked (audit decision I-11; built up.99/up.101)
- decision: An access token's writes go to dedicated assistant endpoints with their own audit log, instead of exceptions in general routes; every row is an owner-approved exception; never add a writing, settings, backup, auth or bank row; never rename a row.
- scope: access tokens, audit log, proposals

## DEC-household-partner-claims: approach B (claim row in partner's budget)
- source: docs/HOUSEHOLD-PARTNER-LINKS.md
- status: proposed (design only; owner answered 1, 2, 3, 6 on 5 Nov 2026: B; anyone may enter "Alex paid"; settlements as well as expenses; claims kept hidden on stop combining. Decisions 4, 5, 7, 8, 9 still open with recommendations standing)
- decision: Owner's entry stays in the owner's ledger; partner claims it with one of their own payments via `household_entry_claims`; nothing copied between budgets.
- scope: combined households, multi-user

## DEC-email-codes-and-reminders: SMTP via HA options, Nodemailer, gateway-owned delivery
- source: docs/MULTI-USER-EMAIL-AND-REMINDERS.md
- status: locked (owner 7 Nov 2026, built up.128 and up.129)
- decision: S1 (HA options), M1 (Nodemailer), phone proven by confirmation code, TLS always, each person chooses phone/email/both (decision 5 differs from recommendation), R2 (gateway owns delivery), no email codes for single-budget installs, two PRs.
- scope: gateway, password codes, reminders

## DEC-tax-car-home-owner-decisions: nine decisions of 8 Nov 2026
- source: docs/TAX-CAR-AND-HOME.md
- status: locked (owner 8 Nov 2026); D4a built, D4b unbuilt
- decision: H1 daily hours log with Fill a pattern; R1 built-in ATO rate table plus typed override; K2 trip-by-trip entries fill the logbook; C1 D1 claim names its car; A1 asset link and prompt only; T2 organise tokens read year figures and detail routes, no writes; L3 lodged years may change, flagged "Amended since lodging"; compare $1,000 instant deduction only if confirmed law; D4a before D4b.
- scope: tax time

## DEC-envelope-owner-requested-features: linked envelopes and own Ready-to-Assign pools
- source: docs/ENVELOPE-FUNDING.md
- status: locked (owner-requested 9 Nov 2026 linked envelopes; 7 Nov 2026 pools; built)
- decision: Envelopes can mirror one account (`categories.linked_account_id`); accounts can carry their own Ready to Assign (`accounts.assign_pool`). Hold for next month (ACT-03) and Keep overspending (ACT-04) are owner-only settings no access token may change.
- scope: budget funding

## DEC-audit-I-1: "left to spend" excludes savings
- source: docs/AUDIT-2026-11.md
- status: locked (owner decision 3 Nov 2026, option a; landed)
- decision: Dashboard "left to spend" leaves out Savings envelopes and goals' categories (F-01).
- scope: dashboard presentation

## DEC-audit-I-2: first bank connection starts the budget today
- source: docs/AUDIT-2026-11.md
- status: locked (owner 3 Nov 2026, option a; landed via `budget_start_day`, migration 0063)
- decision: A new budget starts the day it connects Up; pre-connection spending is history (F-03).
- scope: budget start

## DEC-audit-I-3: deleting bank-fed rows warns and offers one-tap restore
- source: docs/AUDIT-2026-11.md
- status: locked (owner 3 Nov 2026, option a; landed)
- decision: Keep delete, add confirm copy and a one-tap Restore in the assign block (F-04).
- scope: bank-fed transactions

## DEC-audit-I-4-to-I-11: owner decisions of 4 Nov 2026
- source: docs/AUDIT-2026-11.md
- status: locked (owner 4 Nov 2026; marked Done in the status table)
- decision: I-4 group the sidebar into collapsible "Planning" and "Tools" with progressive disclosure of optional features (`client/src/utils/navFeatures.ts`); I-5 System theme by default; I-6 optional "Backup with files" ZIP (JSON backup unchanged; `services/backupArchive.ts`); I-7 tour-first onboarding; I-8 offer to categorise a recorded repayment back to the shared expense's category (`services/householdCategoryOffers.ts`), owner-confirmed, never silent; I-9 remove `website/` from the repo; I-10 freeze Plaid, SimpleFIN, Enable Banking as "community supported" and offer CSV upload wherever a bank connection is offered; I-11 dedicated assistant endpoints with their own audit log instead of more route-level token exceptions.
- scope: UX, backups, bank providers, assistant access

## DEC-depreciating-assets-owner-decisions: five decisions of 4 Nov 2026
- source: docs/DEPRECIATING-ASSETS-PLAN.md
- status: locked (owner 4 Nov 2026)
- decision: Low-value pool is phase 3; organise tokens may read assets and any assistant change is an owner-approved proposal; lodged-year lock added; short built-in suggested effective lives with ATO links; out of scope confirmed (rental capital works, business assets/instant write-off, car logbooks, capital gains on private share).
- scope: tax time assets

## DEC-investment-sales-owner-decisions: nine decisions of 7 Nov 2026
- source: docs/INVESTMENT-SALES-AND-INCOME.md
- status: locked (owner 7 Nov 2026; recommendations taken except decision 7)
- decision: L1 sale consumes lots and follows lot corrections with lodged-year locks; P1 FIFO default with Choose parcels; losses applied to non-discountable gains first; I1 one income row per payment with reinvestment and franking prefill; T1 cash and franking only for trust distributions; C1 Split or consolidate action (D3c); decision 7 differs: read-only assistant tool delivered in D3b; A1 Tax time leaves out retirement accounts; D3a, D3b, then D3c.
- scope: investments, tax time

## DEC-long-term-forecast-decisions: assumptions and exclusions
- source: docs/LONG-TERM-FORECAST.md
- status: proposed (section 17 lists nine owner questions with defaults; section 18 "Clarifications settled in step 2" records what was settled while building; the note is marked built)
- decision: One person only; plan years start today; end age 95; growth applies to balance after withdrawals before this year's deposits; defaults cash 2%, investments 7%, super 6.5%, property 3%, vehicles -15%, inflation 2.5%, SG 12%, contributions tax 15%, preservation age 60, Age Pension from 67, mortgage 6.0% over 30 years; every `retirement` account is super; super locks until retirement and preservation age; gross salary for super entered by the owner.
- scope: long-term forecast

## DEC-ui-owner-decisions-waves: palette, discoverability, navigation depth
- source: docs/ui/WAVES.md
- status: locked (owner decisions on record 11-13 Nov 2026)
- decision: #224 palette adds no server route, nothing on the allowlist/`/api/assistant/do`/MCP; Wave D dims Household/Tax time/Files as "Set up" rows; Wave E payee page and one-click row details; #244 Settings split endorsed; gutters 16 px phone, 24 px from `md`; categories always use `CategoryPicker`, short lists the shared styled `Select`; release of `redesign` (up.154 to up.171) undecided, do not tag, publish or update the live app until the owner decides.
- scope: UI redesign

## DEC-guides-owner-decisions: progress per person, tour first
- source: docs/GUIDES.md
- status: locked (owner decisions; audit decision I-7, F-12)
- decision: Guide progress is stored per person in their budget (`guide_progress`, migration 0058; never in backups, not on token allowlist); budgets in use before guides get no tour and tips/page guides off with a one-time note; new budgets get the welcome tour offered once in the Get started card; at most one onboarding element above a page's content; never rename a guide or tip id (stored); `utils/guides.test.ts` checks markers exist.
- scope: guides, onboarding

## DEC-critique-budget-currency-and-rail: owner choices in up.154
- source: docs/critiques/2026-11-09-budget.md
- status: locked (acted on in 0.2.0-up.154)
- decision: Ready to assign leads the rail and is green while its figure holds; the budget's own currency is written as plain `$` (not `A$`) and a look-alike currency by its code; rail working folds under "How this is worked out"; $0 rows hidden; pills only for overspent (red) and short/carried (amber).
- scope: Budget page

