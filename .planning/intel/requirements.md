# Requirements

Extracted from the 10 PRD-classified docs. Each entry carries source, description, acceptance and scope. Acceptance is quoted from the source or marked as not specified.

## REQ-multi-user-isolation
- source: docs/MULTI-USER-PLAN.md
- description: Separate budgets for more than one person on one server, each in its own process with its own database and encryption key, behind a gateway that owns sign-in. Opt-in via Home Assistant option `multi_user`; the existing budget stays in place as the first person's.
- acceptance: Person A's session, cookies, access tokens and MCP calls get 404 or 403 for every route on B's budget; proxy never forwards the gateway secret or one person's session cookie to another's process; reset tests (expiry, single use, try limits, hashed storage, generic answers, no reset without configured destination); container smoke test with two budgets (both start, both persist across restart, watchdog healthy).
- scope: gateway, people, sign-in, budgets; status built (steps 1-3, 5)

## REQ-multi-user-password-reset
- source: docs/MULTI-USER-PLAN.md
- description: Forgot-password via Home Assistant notify code, email code (SMTP) or administrator reset code in the Log; codes random, hashed, single use, 10-minute expiry, at most 5 tries, rate limited; generic answer "if that person exists, a code was sent".
- acceptance: reset tests as above; delivered detail in MULTI-USER-EMAIL-AND-REMINDERS.md
- scope: gateway password reset

## REQ-plan-cancelled-recurring-hidden
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: Cancelled recurring items are hidden from the Monthly list, household recurring bills, and calendar/forecast/budget, but stay visible under All recurring. Filter `status === 'cancelled'` in `MonthlyTab.tsx` and the Calendar view; `householdService.sharedRecurringBills` and `scheduleScope.scheduleScopes` skip ended or soft-deleted schedules; check `forecastService.ts`, `expectedDebits.ts`, cash flow, `fundingPlan.ts` targets; move status names (`AllTab.tsx:67` maps `'canceled'` to `'cancelled'`) to one shared constant.
- acceptance: Vitest for scope/forecast exclusion; Playwright checks a cancelled row is absent from Monthly and present under All recurring.
- scope: owner request 7 Nov 2026, PR 1 of 7

## REQ-plan-recurring-amount-reaches-household-bill
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: Editing a recurring amount (`PUT /api/schedules/:id`, `routes/schedules.ts`) recomputes unmatched, unpaid `household_bills` linked by `scheduleId` in the same DB transaction via a helper extracted from `householdService.editBill`; matched or paid bills untouched; an exact split that no longer adds up returns a warning and shows the existing "doesn't add up" state; schedule mutation hook invalidates household query keys.
- acceptance: Failing test first: Rent schedule A$4,780 shared with a household; edit the amount; household bill and "Your share" occurrence change.
- scope: owner request 7 Nov 2026 (built later as `followScheduleAmount`, see HOUSEHOLDS.md)

## REQ-plan-household-edit-and-default
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: `PUT /api/households/:id` (Zod: `name` 1-80 chars; `currency` only while no events) via `householdService.updateGroup`, logged in `household_activity`; demo worker (`server/src/browser/app.ts`) serves it. Default household as preference `defaultHouseholdId` (bump `PREFERENCES_VERSION` with migration step); `client/src/pages/Household.tsx` picks `?household=` then preference then `groups[0]`; Make default and Edit details modal; sidebar `SidebarAccountList.tsx` opens default; MCP `list_households` marks default; owner-only.
- acceptance: not specified beyond the request (built version stores `is_default` on the group per HOUSEHOLDS.md, not a preference; see conflicts report)
- scope: owner request 7 Nov 2026

## REQ-plan-household-reconcile
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: "Where these figures come from" expander built on `/households/:id/statement`; new event kind `adjustment` with per-person `household_shares` bringing each balance to an agreed figure; `POST /api/households/:id/reconcile` body `{ asOf, agreed: { [personId]: cents } }` (default 0) computed from `householdLedger` (`server/src/services/householdLedger.ts`), recorded through `recordEvent` in one transaction, undoable through `removeEvent`; `direct` totals still sum to zero; update `validSettlements`, statement, `sharedExport`, backup restore, demo. UI Reconcile button with preview and Confirm. MCP read `household_reconciliation_preview`; write only as owner-applied proposal `propose_household_reconciliation` (organise scope, `routes/mcp.ts` `ACTION_TOOLS`, `auth/assistantPolicy.ts` row, allowed/refused cases in `assistantPolicy.test.ts`, `docs/ASSISTANT-ENDPOINTS.md`); add exception to CLAUDE.md and AGENTS.md byte-identical. Live zeroing only after cold backup and owner confirmation of the preview, never in a migration.
- acceptance: preview matches live household; applied only after owner confirms; undoable
- scope: owner request 7 Nov 2026 (built request shape differs; see conflicts report)

## REQ-plan-up-round-ups
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: Show an Up round-up as secondary on its purchase (e.g. "A$4.60 · round-up A$0.40 to Saver"), link the `:roundup` row to its purchase and hide it from the register list while it still counts in the balance (reuse split model `isParent`/`inAccountBalance` or additive `round_up_of` column); on the Saver, group the day's round-up credit against `roundUpDays`; link automatically only when Up reports it (`transferAccount` set, same day, sum equal to the cent), otherwise one grouped suggestion ("Round-ups for 5 Nov, 12 purchases"); keep round-up legs out of ordinary transfer suggestions; never rewrite reconciled or user-edited rows; stable IDs. Status: link landed in up.131; display on purchase in up.145 (`services/roundUps.ts`).
- acceptance: mock Up payload tests: purchase with round-up and boost, daily Saver credit, re-sync adds nothing, mismatch stays a suggestion; update `UP-SUPPORT.md`.
- scope: Up sync, owner request 7-8 Nov 2026

## REQ-plan-essentials-pool
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: Account flag `assignPool` (additive column; `BACKUP_TABLES`); `fundingState` returns `pools: [{ accountId, readyToAssign }]`; main figure excludes their balances and earmarked envelopes; category earmarked when its bills come from that account (derived from `schedules.accountId`) with explicit `categories.poolAccountId` override; `budgetMoves.fundedWrite` enforces; UI `BudgetSummaryWidget.tsx`, Budget page grouping, toggle in `EditAccountModal.tsx`.
- acceptance: fast-check property tests: main + pools = resources - envelopes; no cent counted twice; update `docs/ENVELOPE-FUNDING.md`, demo budget and MCP budget read output.
- scope: owner request 7 Nov 2026 (built; see ENVELOPE-FUNDING.md "Accounts with their own Ready to Assign")

## REQ-plan-tab-icon-and-brand-sweep
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: Add `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` from `logo.svg`, referenced with a version query in `index.html` and `manifest.webmanifest`; bump cache name in `client/public/sw.js`; check `electron/resources/icon.ico` and HA icon; sweep case-insensitive `flybudget` (about 790 hits) changing only user-visible text to Allotment, keeping stored identifiers (`FLYBUDGET_*`, cookies, headers, data paths, `flybudget_up`, image names, `flybudget-mac-window`, desktop internal name) and upstream attribution to `dtymoszenko/FlyBudget`; put the sweep table in the PR body.
- acceptance: browser tab icon shows the Allotment mark; no stored identifier renamed
- scope: branding

## REQ-plan-delivery-rules
- source: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md
- description: One PR per section in order, each with failing-then-passing test, `npm run release:prepare -- <next-version>` and CHANGELOG entry.
- acceptance: each PR runs `npm test --prefix server -- <affected>`, `cd server && npx tsc --noEmit`, `npm test --prefix client`, `npm run build --prefix client`, e2e spec, `cd lint && npm ci && npm test && npm run lint` (warning cap does not rise), migrations tested on a populated database.
- scope: process

## REQ-phase7-priorities-profile
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7A. Optional Financial priorities in Settings: free-text purpose (never an allocation rule); category purpose Essential|Enjoyment|Flexibility reserve (one per category; not on card reserves or income categories; a flexibility category cannot fund a goal or carry a date/recurring target); optional monthly essentials estimate overriding the measured figure; comfort target (amount or months of essentials, one source) and minimum; review cadence payday|monthly|quarterly|off (default off). Ordered funding priorities explicitly removed (payday rules and Fund targets already order funding).
- acceptance: Skipping setup preserves behaviour; updating comfort target changes the gap not cash/history/balances; marking a household-linked category low priority leaves household shares unchanged; a stale save is rejected without changing the profile.
- scope: Phase 7A; implemented and released 0.2.0-up.18

## REQ-phase7-flexibility-reserve
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7B. Review "Resilience" card partitions `fundingState.resources` exactly into card payment reserves, committed bill reserves, goal-funded categories, flexibility reserve, other envelopes, unassigned (held-for-next-month is its own line while a hold exists); coverage = flexibility available / monthly essentials (6F's three-month window or user's estimate) to one decimal, unavailable (never infinite) when essentials zero/unknown/history short; status not set up | incomplete | below minimum | below target | on target; Healthy only when on target, complete, no unfunded obligations; minimum is a preference (move preview warns, still allowed).
- acceptance: $12,000 resources, $4,000 committed bills, $2,000 annual reserves, $6,000 flexibility shows $6,000 and 2.0 months at $3,000 essentials; moving $1,000 from flexibility to a holiday gives $5,000; personal-account transfers do not change it; investment/retirement accounts, credit limits, household receivables do not improve it; $1,000 minimum with $800 shows $200 gap and warns without blocking; missing rates or unfunded obligation prevents healthy.
- scope: Phase 7B

## REQ-phase7-adverse-event-scenarios
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7C. Each phase 5 forecast scenario may add income pauses (date ranges) and cost changes (signed monthly amount from a date, last day fallback); reports first shortfall day (or none within horizon, never "safe") and reserve use capped at flexibility availability; templates prefill the existing form; calculations read-only and "nothing is stored". The brief states "Saving scenarios is deferred: it would make the forecast page stateful and needs its own decision" and that phase 5 "stores nothing" (see conflicts report: FORECASTS.md documents saved scenarios as built).
- acceptance: from zero cash, $1,000 on day 10 cannot cover $500 bill due day 5 (first shortfall day 5); $6,000 cash and $3,000 essentials at each month end with $2,000 emergency on day 1 leaves second month end $2,000 short; missed payday plus repair keeps both exactly once; a pause outside the horizon or ending before it starts is rejected; identical inputs reproduce identical results.
- scope: Phase 7C

## REQ-phase7-goal-lifecycle
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7D. Goal states Active|Paused|Completed|Retired with optional reason, replacement goal and status history; one confirmed action may change status and move money to another category in one transaction behind the funding revision and goal's last update; non-active goal: category target reports no requirement, payday rules propose nothing, no forecast contributions, funding retained; replacement must be another non-retired goal and gets money only via explicit move; manual tracking goals change state without touching cash.
- acceptance: pause goal with $800 funded keeps $800 and Fund targets proposes nothing; retire and move $500 to flexibility leaves $300, resources unchanged; stale revision or goal edit rejects whole operation; history, assignments, reports survive pause/retire/backup/restore.
- scope: Phase 7D

## REQ-phase7-resume-after-lapse
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7E. Review ends with Resume budgeting (days since last completed review, transactions since, uncategorised spending, Up bank-source items, unreconciled accounts, today's resolution); never requires historical categorisation first; "Record today's review" stores date and snapshot only (not a reconciliation); dismissible reminders on Review and Dashboard per cadence; snooze stores a date only; neutral copy; "offline snapshots" requirement removed (no offline mode).
- acceptance: after six weeks the page shows today's actionable review with older items accessible; completing a review changes no funding, bank acknowledgment or deficit; snoozing hides reminder only; works on phone and desktop.
- scope: Phase 7E

## REQ-phase7-extra-income
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: 7F. Extra income previews a split of one received income deposit: baseline confirmed by user (0 windfall, usual pay raise), reserve percentage, flexibility category; extra = deposit - baseline; reserve share = extra x percentage rounded down capped at unassigned; Apply once through `fundedWrite`; deposit then used (not reusable, not selectable by a payday event); transfers and non-income deposits refused. "Since last review" compares snapshot with today (assignments in vs reserve use, unfunded-obligation change; investment values never appear; says so if flexibility categories changed). No savings rate presented.
- acceptance: confirmed $2,200 deposit against $2,000 baseline at 50% previews $100; nothing moves before Apply; applying twice refused; $1,000 personal transfer not offered as income; super value rise changes neither reserve nor comparison; comparison separates assignments from reserve use.
- scope: Phase 7F

## REQ-phase7-shared-contract
- source: docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md
- description: Reuse `fundingState`, card reserves, targets, atomic funding operations and phase 5 projection; keep bank location, envelope purpose and household attribution distinct; no view makes retirement assets, property, unused credit, expected pay, unpaid reimbursements or others' pool contributions spendable; explain scope, as-of date, exclusions, missing inputs; integer minor units; all settings opt-in with no automatic change; prompts dismissible; no peer rankings, streak penalties, moral labels or universal savings-rate targets. Data: migration `0034_financial_resilience` (`financial_priorities`, `category_purposes`, `goal_status_events`, `review_completions`, `income_reviews`, goal columns `status`, `status_reason`, `replaced_by_goal_id`, `status_changed_at`), backup format 11. Debt payoff out of scope; household contribution delays deferred.
- acceptance: every enabled result reconciles to shared accounting; actions have reviewable previews and safe retry/conflict behaviour; disposable-budget tests cover numerical examples, old/new backup restore; desktop/phone browser coverage; do not claim behavioural improvement from arithmetic tests. Delivery status: 7A-7F implemented and released (0.2.0-up.18).
- scope: Phase 7 contract

## REQ-phase8-proposal-receipts-attachments
- source: docs/PHASE-8-PROPOSALS.md
- description: Proposal 1: `transaction_attachments` (`id`, `transaction_id` cascade, `filename`, `media_type`, `size`, `sha256`, `created_at`); bytes on disk beside the database under a content-addressed name, not in SQLite; JPEG, PNG, WebP, HEIC, PDF up to 10 MB each and 20 per transaction; served via authenticated API with `Content-Disposition: attachment` and `nosniff`; full backup as `.zip`; demo disabled. Status: proposals only (later built as Receipts and Files, with bytes stored in the database; see RECEIPTS-AND-TAX.md and FILES.md).
- acceptance: server tests for type/size refusals, cascade on delete, backup round trip and hash mismatch; e2e upload, preview, delete on desktop and phone.
- scope: Phase 8 expansion proposal 1

## REQ-phase8-proposal-security-holdings
- source: docs/PHASE-8-PROPOSALS.md
- description: Proposal 4: manual `holdings` (`id`, `account_id`, `symbol`, `name`, `quantity` decimal string, `unit_price` minor units, `currency`, `as_of`); total differing from account balance shown as "unexplained", never adjusted; no network calls; Holdings tab on investment accounts. Superseded in practice by INVESTMENTS.md (securities/prices/holdings/tax lots).
- acceptance: net worth identical with and without holdings; quantity x price rounding exact.
- scope: proposal only

## REQ-phase8-proposal-long-term-forecasting
- source: docs/PHASE-8-PROPOSALS.md
- description: Proposal 5: "No new engine. Phase 5's dated projection gains yearly steps beyond its current horizon, with growth and inflation assumptions stored with the scenario"; a debt model is a prerequisite; "Long term" range on Forecast page labelled "projection, not a promise". Built differently: a separate pure yearly engine with its own plan tables (LONG-TERM-FORECAST.md).
- acceptance: at existing horizon identical to phase 5; zero-growth zero-inflation equals the plain sum of planned flows; expected pay never becomes spendable today.
- scope: proposal only; "Outside phase 8": AI consent flows, credit-score services, household authentication

## REQ-phase9-review-and-report-visibility
- source: docs/PHASE-9-DEVELOPMENT-PHASE.md
- description: `transactions.reviewed_at` (nullable text) and `transactions.hidden_from_reports` (0/1 default 0); `reviewed_at` set only by explicit user action (detail toggle or Mark reviewed on a selection), never by import, sync, rules, bank-source corrections or restores; `POST /api/transactions/review` with phase 8 selection, `reviewed`, `expectedCount` (409 and no write if count changed; returns changed IDs for undo by `ids`); selection filters `reviewed=0|1`, `hidden=0|1`. Hide from reports via one condition `shownInReports` beside `budgetActivity` in `services/balances.ts`, added to every query in `routes/reports.ts` (Cash Flow, income/spending, categories, merchants, trends, comparisons, daily flow, custom report and dashboard widget data, savings rate) but NOT to balances, net worth, envelope budget, card funding, payday plans, annual overview, forecasts, budget review or reconciliation; hidden rows stay in the register with a mark; Cash Flow drill-down scope `budget_report=1` leaves hidden rows out.
- acceptance: (1) hiding a 300 expense removes it from reports and savings rate while balances, budget activity and annual overview are unchanged to the cent; unhiding restores exactly. (2) a hidden split hides every part. (3) bulk review of 3 rows with `expectedCount=3` marks those rows; 409 after a new matching row; undo by IDs exact. (4) import, Up sync, rules, restore never set `reviewed_at`. 9. desktop, phone and demo flows.
- scope: Phase 9, implemented in 0.2.0-up.20; backup format 12

## REQ-phase9-tags-saved-views
- source: docs/PHASE-9-DEVELOPMENT-PHASE.md
- description: `tags` (`id`, `name` unique case-insensitive, `color`, `created_at`), `transaction_tags` (pair PK, both cascade), `saved_views` (`id`, `name`, `query`, `sort_order`, `created_at`); CRUD `/api/tags`; assign via `PUT /api/transactions/:id/tags` (idempotent replace); tags live on the register row and split parts inherit (replaces phase 8 proposal's per-part tagging); selection filter `tag_ids` (any of); rule action `add_tag` adds never removes; saved view stores the All Transactions URL query exactly (phase 8 `FILTER_KEYS`, including `range`), validated by selection schema, unknown keys rejected, a view referring to a deleted account/category/payee/tag still opens matching nothing and says so; CSV gains `Tags`, `Reviewed`, `Hidden from reports`; Settings > Tags. Backup format 12; format 11 restores with all rows unreviewed, visible, untagged.
- acceptance: a tagged split shows once in the register; tag filter summary and export count its parts; deleting a tag keeps transactions; a rule with `add_tag` tags new imports; saved view reopens identical; backup 12 round trip; delivery as one PR series released as `0.2.0-up.20`.
- scope: Phase 9

## REQ-phase10-warm-design
- source: docs/PHASE-10-WARM-DESIGN.md
- description: Warmer visual design (warm ivory/stone light surfaces `#FBFAF8`, `#EFECEA`, charcoal `#22201D`, terracotta accent, warm charcoal dark theme; system serif for page headings only; Inter with tabular numerals for amounts); soften cards/buttons/fields; light stone sidebar with rounded active states; muted chart palette; no copied licensed fonts, imagery, logos or layouts; no financial calculation, storage format, bank integration, authorization, runtime font/network dependency or schema change. Status: implemented, local verification completed.
- acceptance: light and dark themes related with readable text, selected states, focus indicators and charts; dashboard customization and values behave as before; no horizontal overflow at 390 px; text/action contrast at least 4.5:1 (lowest measured 4.70:1); Dashboard, Budget, Transactions, Settings usable; client 224 unit tests, 17 phone checks, 11 demo flows passed.
- scope: Phase 10 (document still says "original FlyBudget palette"; superseded by docs/BRAND.md naming)

## REQ-phase8-transaction-selection
- source: docs/MONARCH-DEVELOPMENT-PHASE.md
- description: One server module (`server/src/services/transactionSelection.ts`) parses/validates the selection and builds SQL for the register (`GET /api/transactions`), filtered summary and filtered CSV export (`GET /api/export/transactions/csv`). Parameters: `account_ids`, `category_ids`, `category_group_id`, `uncategorized`, `payee_ids`, `search` (payee name and notes, case-insensitive), `direction` (`debit` amount < 0 | `credit` amount > 0; zero matches neither), `min_amount`/`max_amount` (integer minor units against magnitude, inclusive: "over 100" is `min_amount=10001`), `from`/`to` (real `YYYY-MM-DD`, inclusive; month uses real last day; invalid/reversed/malformed returns 400), `reconciled`, `transfers` (`include|exclude`), `budget_report`; legacy `account_id`, `category_id`, `month` keep working. Splits: filters on leaves, register shows split parent when any part matches, summary/export count matching leaves only. Transfers included by default; `budget_report=1` keeps cash-flow scope. `round_ups=fold` (default) / `show` (`server/src/services/roundUps.ts`); `transfer_pairs=fold` (default) / `show`, `GET /transactions` adds `transferAccountId`, `transferPair` (`client/src/components/transactions/transferLabel.ts`). Summary totals in budget currency from stored values; missing-rate rows left out and counted. Reading/summarising/exporting never write.
- acceptance: October totals income 2,000, spending 165, net 1,835, savings rate 91.75%; all-time spending 255, net 1,745; mock account + debits + `min_amount=10001` returns only the 120 expense; payee search for the grocer returns both entries totalling 210 money out; exact boundaries, empty selections, refunds, splits, transfers, reconciliation, household scope, missing rates also tested; summaries, exports and drill-downs agree with displayed records.
- scope: Phase 8 deliverable 2; implemented 0.2.0-up.19

## REQ-phase8-summary-and-savings-rate
- source: docs/MONARCH-DEVELOPMENT-PHASE.md
- description: Register summary reports money in, money out, net, count, date span (bank movement, not "income"/"spending"). Income, spending, savings rate use category accounting under `budgetActivity`; spending = `max(0, -(sum of expense activity))` (= `expenseNet` of `/api/reports/income-vs-expenses`); savings rate = (income - spending) / income, unrounded, undefined (dash, never 0%) when income is zero or negative; one shared client helper used by Cash Flow and the home dashboard (from summed totals); transfers, borrowing and valuation changes never income or spending; Sankey may omit net-refund categories.
- acceptance: savings rate 91.75% on both Cash Flow and shared helper; category and merchant totals match shared spending total.
- scope: Phase 8

## REQ-phase8-dashboard-preferences
- source: docs/MONARCH-DEVELOPMENT-PHASE.md
- description: Home dashboard card visibility, order and reset stored per device in `preferencesStore` with versioned migration and separate phone/desktop defaults; not budget data, not in backups; desktop defaults summary, bills, budget progress first; `useNextSteps` actions above cards; onboarding (`GettingStarted`) and 7E review reminder stay outside customisable cards; hiding everything shows a restore prompt; existing custom orders preserved.
- acceptance: preferences survive reload/reset and remain usable on phones; presentation never changes balances or records.
- scope: Phase 8 deliverable 3

## REQ-phase8-merchant-breakdown-annual-overview
- source: docs/MONARCH-DEVELOPMENT-PHASE.md
- description: Merchant = payee (record, else stored payee name, else "No payee"), same spending definition as categories. Annual overview: one server summary per calendar year built from the same per-month calculation as the monthly budget (`budgetGroups`); per category monthly assigned and activity, year totals, available at end of latest elapsed month; balances/carry-over never summed across months; months after the current are planned and shown apart; spendable money today only from `fundingState`; card reserves and debt from the 6B service unchanged.
- acceptance: annual figures agree with monthly activity and assignment totals without double-counted carry-over; future plans never increase spendable cash today.
- scope: Phase 8 deliverable 4

## REQ-phase8-goal-debt-presentation
- source: docs/MONARCH-DEVELOPMENT-PHASE.md
- description: Present category-funded goal assignments/activity/availability coherently across Budget, Goals and transaction detail with navigation to existing assignment/move controls; preserve manual vs funded vs bank location vs card reserve distinction; no independently editable progress or second allocation ledger; surface 6B funded/unfunded card debt; general loan payoff scenarios are a design proposal, not a new engine.
- acceptance: goal navigation and budget summaries agree with phase 6C progress after assignments, spending, refunds, moves, future reservations, unlinking; backup restore compatible; card reserve/debt agrees with 6B service; expansion proposals documented and marked proposals.
- scope: Phase 8 deliverable 5; delivery as focused PRs in order (amendment, selection, dashboard, merchant/annual, goal/debt + proposals); documentation-only changes need no version bump

## REQ-phase6a-authoritative-funding
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: One shared budget calculation service answers "How much money is available for this purpose today?": assign only existing money; carry reserved money across months; distinguish account location from category purpose; shared definitions Assigned, Activity, Available (previous + assigned + activity), Unassigned, Underfunded, Overspent, Planned funding. Opening funds eligible without counting as earned income; expected/future-dated salary not received today; explicit as-of date; missing exchange rates give an incomplete assessment; uncategorised spending visible as unresolved; off-budget assets excluded; deficits shown in their month and the envelope starts next month at zero (owner decision, October 2026); zero unassigned alone must not show an unqualified "Fully budgeted"; Move money and Cover overspending are atomic with preview, revision precondition, durable operation and safe undo. Use Assigned / Activity / Available everywhere.
- acceptance: $1,000 opening cash offers $1,000 without inflating income; assigning it to November means October cannot offer it again; future salary does not raise today's funding; $200 uncategorised debit prevents a fully resolved state; $600 carried + $100 assigned - $500 spending shows $200 available; $600 rollover-only category stays visible; $50 refund adds $50; $200 deficit visible for its month; $50 move preserves resources and total assignments and failure changes neither side; competing clients cannot both use the same source availability; desktop, phone, detail and summary agree.
- scope: Phase 6A (implemented 0.2.0-up.9); see ENVELOPE-FUNDING.md

## REQ-phase6b-card-payment-funding
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: Funded card purchases consume category availability and reserve cash for payment; unfunded purchases expose debt or payment shortfall; opening card debt not spendable; linked repayments are transfers; interest and fees categorised expenses; reviewable setup for existing cards; never silently generate historical assignments or rewrite the ledger.
- acceptance: $1,000 cash, zero card balance, $100 groceries, $80 card purchase leaves $20 groceries and $80 reserved; $80 repayment reduces cash and debt, consumes reserve, leaves grocery spending $80; also existing debt, partial/unfunded purchases, refunds after payment, splits, interest, positive balances, reconciled transfers.
- scope: Phase 6B (merged 0.2.0-up.10); see CARD-PAYMENTS.md

## REQ-phase6c-category-funded-goals
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: Distinguish budget goals linked to categories from manually tracked goals; derive funded progress from category availability with no independently editable saved amount; prevent multiple goals claiming one category; existing goals remain tracking goals until explicitly linked; an account relationship alone is not reserved funds; distinguish Assigned this month, Available, Spent.
- acceptance: assigning $200 raises funded progress without a bank transaction; moving $50 elsewhere reduces it; a transfer to a saver does not fund the goal automatically; manual values survive upgrade and backup/restore.
- scope: Phase 6C (0.2.0-up.12); see CATEGORY-GOALS.md

## REQ-phase6d-true-expense-targets
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: Targets: fixed monthly, balance by deadline, recurring bill with next due date, replenish to balance; suggestions from current availability and actual funding dates with catch-up; reuse payday rule calculations (no competing target definitions); Monthly average includes zero-spending months; replace "Apply to all future months" with explicit planning/allocation preview; preserve stored assignments until reviewed.
- acceptance: $1,200 due in six remaining periods with $300 reserved needs $150 per period; a missed contribution raises the requirement; a single $600 expense in a six-month window averages $100; recurring targets advance correctly; applying suggestions cannot silently overcommit.
- scope: Phase 6D (0.2.0-up.15); see CATEGORY-TARGETS.md

## REQ-phase6e-payday-integration
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: Payday planner reads the shared funding service, adds a Category target rule over the month's remaining paydays; enumerate actual paydays (fortnightly = every 14 days); preview, cap to resources, honour priorities, durable funding event with duplicate protection; existing events consume the selected receipt identity even when part is unallocated; general budget may offer opening funds while a selected-payday action stays capped by deposits; do not create a second planner or fortnightly ledger.
- acceptance: month/year crossings, three-pay months, occasional 27-pay years, adjusted pay dates, variable pay, missed/partial contributions, two employers; reapplying does not assign twice; generated schedules and actual receipts not counted twice.
- scope: Phase 6E (0.2.0-up.17); see PAYDAY-PLANS.md

## REQ-phase6f-6g-buffer-and-review
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: 6F: show next-month commitments, remaining funding needed and unresolved deficits; optional cash runway with visible assumptions separating restricted reserves from unrestricted funds; money age optional and not a runway substitute. 6G: guided setup (confirm balances, needs before next income, assign existing cash, prepare irregular expenses, check categories, move funding) and a review view linking to resolution; personal spending categories inside one shared budget; individual identities need separate authentication design, shared password sessions cannot establish authorship.
- acceptance: borrowing not reported as saving; retirement assets do not extend runway; annual-bill reserves not unrestricted emergency funds; incomplete history/rates visibly incomplete; review totals reconcile with the main budget; resolving an item refreshes related views; works on phone and desktop; no need to enter expected salary as funding.
- scope: Phases 6F, 6G (0.2.0-up.17); see BUDGET-REVIEW.md

## REQ-phase6-compatibility-gates
- source: docs/YNAB-DEVELOPMENT-PHASE.md
- description: Preserve transactions, bank IDs, opening balances, reconciliation, categories, bank observations, encrypted credentials; no silent history repair; additive schema with export/restore; desktop, server and demo aligned with no independent demo math; do not deploy incompatible old/new calculations together; follow MAINTENANCE.md; before live installation verify installed app identity and restorable cold backup with encryption key; track each subphase planned/implemented/verified/released/live verified.
- acceptance: disposable-budget regression tests for accounting examples, conflicts, dates, splits, transfers, cards, missing rates, backup compatibility; browser coverage for desktop/phone agreement; planning-only changes need no version bump.
- scope: Phase 6 delivery

## REQ-depreciating-assets-calculation
- source: docs/DEPRECIATING-ASSETS-PLAN.md
- description: Tax time depreciating assets by the ATO's two methods. Pure `server/src/services/depreciation.ts` `schedule(asset, years, lodged)`: prime cost = cost x days held / 365 x 100% / effective life; diminishing value = base value x days held / 365 x 200% / effective life (base = cost in first year, then opening adjustable value); divisor stays 365 (days held may be 366); decline capped at base value (DV) or remaining adjustable value (PC); decline rounded once to cents half away from zero, PC by cumulative difference, final PC year takes the remainder; deduction = decline x taxable-use share (adjustable value falls by the full decline); start time must be 10 May 2006 or later (150% DV rate before is unsupported); method chosen per asset and locked once a lodged year includes it; effective life typed by the owner (stored in hundredths of a year). Balancing adjustment on disposal (termination value less adjustable value; shortfall deduction, excess assessable; both reduced by private use; capital gain on private share out of scope). Low-value pool D6 (phase 3): low-cost under $1,000 at 18.75% in first year; low-value DV asset at 37.5% of opening adjustable value; then 37.5% of previous closing balance; once pooled stays pooled.
- acceptance: laptop $2,400, start 1 Oct 2026, 2-year life, 80% work use: PC FY2026-27 (273 days) decline 897.53 deduction 718.02 closing 1,502.47; FY2027-28 (366 days) decline 1,203.29 deduction 962.63 closing 299.18; FY2028-29 299.18 capped deduction 239.34; DV 2026-27 decline 1,795.07 deduction 1,436.06 closing 604.93; 2027-28 604.93 capped deduction 483.94 closing 0; ATO guide examples including leap-year refrigerator; PC sums exactly to cost; start before 10 May 2006 refused.
- scope: phases 1-3 built (0.2.0-up.94, 95, 96); phase 4 optional (second-element costs, effective life recalculation, car cost limit warning)

## REQ-depreciating-assets-data-and-api
- source: docs/DEPRECIATING-ASSETS-PLAN.md
- description: Migration 0066 (additive): `depreciating_assets` (label D1-D5/D15, method `prime_cost|diminishing_value`, cost integer cents GST-inclusive, `start_date`, `purchase_date`, `effective_life_hundredths`, `work_use_bps` 1-10,000, `transaction_id` SET NULL, `opening_fy`, `opening_adjustable_value`, `disposed_date`, `termination_value`), `depreciating_asset_years` ((asset, FY) work-use override), `tax_lodged_years`; `document_links.asset_id` (CASCADE, partial unique index) and `asset` entry in `LINK_TARGETS`; backup (plan said version 24; pool added migration 0067, backup 25); tables in `TABLES` before `documentLinks`. Service `depreciatingAssetService.ts` refuses: cost $300 or less unless set/identical-items tick; effective life <= 0; start before 10 May 2006; method change after lodging; transfer or split-parent purchase; purchase already linked to another asset. No double counting: `setClaim` refuses an asset purchase, `claimByRule` skips, `claimCandidates` omits; "Depreciate instead" is atomic. Lodged-year lock refuses edits changing a lodged year's figures. Routes: `GET /tax/assets`, `GET /tax/assets/:id`, `POST /tax/assets/preview`, `POST /tax/assets`, `PUT|DELETE /tax/assets/:id`, `PUT /tax/assets/:id/years/:fy`, `POST|DELETE /tax/assets/:id/dispose`, `PUT|DELETE /tax/lodged/:fy` (owner only), `GET /tax/years/:fy/assets/csv`. `taxYear(fy)` gains `assets`; CSV row per asset; ZIP adds `depreciation-<year>.csv`, purchase receipts and files. Deleting an asset keeps its files. Safe mode: all amounts via `formatCurrency`/`Private`.
- acceptance: unit tests (`depreciation.test.ts`), route tests (CRUD, $300 floor, lodged locks, atomic Depreciate instead, backup round trip with older versions, token refusals), client form validation, e2e extension of `e2e/tests/receipts-tax.spec.ts` with Safe mode check.
- scope: owner decisions 4 Nov 2026: low-value pool phase 3; organise tokens may read assets (`GET /tax/assets[/:id]`, MCP `tax_assets`), writes only as owner-approved proposals; lodged-year lock added; built-in suggested effective lives with ATO links; out of scope: rental capital works, business assets/instant write-off, car logbooks (later designed in TAX-CAR-AND-HOME.md), capital gains on private share

## REQ-ui-waves-redesign
- source: docs/ui/WAVES.md
- description: Design re-review backlog (issues #222 to #245, plus #267) worked through on branch `redesign` in waves: A shell (#222, #223, #225) up.167; A palette (#224) up.169 and up.171; B small fixes (#227, #228, #229, #233, #234, #238, #242) up.168; C dashboard (#230, #231, #232) up.170; D discoverability (#226, #237, #239, #236) up.172; E navigation depth (#235, #243, #245, #240) up.173 PR #266 merged; F settings, delight (#244, #241) not started; G form controls (#267) not started, needs five owner decisions (new dependencies, phones, scope, dates, replacing Wave E's "short lists use the styled native Select" rule on desktop). Shelved by owner: #217, #218, #219 (do not redesign Review, Cash flow or Household); #215 needs owner's iPhone.
- acceptance: each wave PR: failing test per fix, full desktop project plus phone, demo and server-mode e2e, `e2e` `npx tsc --noEmit`, screenshots under `.ui-evidence/<date>-<wave>/`, next `0.2.0-up.N` via `npm run release:prepare`, HANDOVER-UI.md and MAP.md updated, PR to `redesign` with `--repo tvrooi/Allotment`; merge when CI green and Codex has no unresolved finding; issues closed by hand; Node 24; never `E2E_SKIP_BUILD=1`; lint warning cap 135.
- scope: owner decisions on record: #224 palette (no server change, no new route, nothing added to allowlist, `/api/assistant/do` or MCP; `/` opens palette); Wave D (#226 Household, Tax time, Files show as dimmed "Set up" rows; #237 Household promise/example/one button; #239 welcome step only); Wave E (#235 goal rows and payee page `/payees/:id`; #243 one click opens details; #245 every undoable change announces itself, toast 8 s; #240 16 px gutter on phones, 24 px from `md`); #244 Settings split endorsed; release undecided (`redesign` carries up.154 to up.171 prepared and untagged).

