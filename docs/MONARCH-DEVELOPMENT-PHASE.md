# Phase 8: transaction investigation, dashboard and planning workflows

Added 21 October 2026; amended 22 October 2026 against main `2319038`.
Status: **implemented**. Delivered: (2) transaction selection, summary, filtered
export and the shared savings rate in `0.2.0-up.19`; (3) home dashboard preferences
in `0.2.0-up.20`; (4) merchant breakdown and annual overview and (5) goal/debt
presentation and the [expansion proposals](PHASE-8-PROPOSALS.md) in `0.2.0-up.21`.

This phase consolidates the recommendations from the owner's signed-in Monarch
REA inspection into the fork's development pipeline. It extends FlyBudget's
existing features; it is not a claim of complete Monarch parity.

## Position and dependencies

Keep the existing phase IDs. Phase 7 is the financial-resilience
[brief](PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md); this is phase 8.
Phase numbers identify workstreams, not a strict execution order.

The initial inspection compared FlyBudget commit `05f653e`, and the first brief
was reconciled against main `4413bc3`. This amendment reconciles it against main
`2319038`, which also includes phase 5 forecasts, 6D targets, 6E payday
integration, 6F buffer, 6G review and phase 7 resilience (7A–7F). Do not
implement any of those again. See [Envelope funding](ENVELOPE-FUNDING.md),
[Card payments](CARD-PAYMENTS.md), [Category-funded goals](CATEGORY-GOALS.md),
[Category targets](CATEGORY-TARGETS.md), [Forecasts](FORECASTS.md),
[Budget review](BUDGET-REVIEW.md), [Resilience](RESILIENCE.md) and the
[phase 6 brief](YNAB-DEVELOPMENT-PHASE.md).

Filtering and dashboard presentation can proceed independently. Goal/budget
integration must use the shared funding services and phase 6C category linkage.
Annual planning must agree with the 6D targets and 6E payday integration already
on main. Forecasts remain phase 5; resilience scenarios and goal lifecycle belong
with phase 7. Do not create competing funding, goal-progress, debt or forecasting
engines.

## Deliverables within this single phase

### Transaction investigation

- Combine multi-account, multi-category, payee, debit/credit, amount-range and
  custom-date filters. Show active selections and a clear/reset action.
- Show filtered transaction count, income, spending and date span. Derive the
  list, summary and filtered export from the same validated selection.
- Preserve supported filter/date/scope context when drilling from cash flow or
  reports into transactions. Keep bank movement and personal/household expense
  attribution explicit; household repayments must not become salary.
- Specify exact amount/date boundaries, split parent/child handling, transfer
  inclusion and missing-rate behavior. Preserve existing reconciliation rules.

Relevant starting points: `client/src/components/transactions/TransactionFilters.tsx`,
`TransactionTable.tsx`, `TransactionDetailPanel.tsx`, `server/src/routes/transactions.ts`,
`reports.ts`, `customReports.ts` and their query/services code. Recheck current
source before editing; the inspection did not establish every query contract.

### Home dashboard personalization

- Add card visibility, ordering and reset to defaults for the existing home
  dashboard. Reuse Reports dashboard layout patterns where appropriate.
- Persist preferences with useful desktop and phone defaults. Handle empty,
  hidden and reordered cards without affecting ledger records.
- Retain existing onboarding and contextual empty states rather than replacing
  them with duplicate setup flows.

Start with `client/src/pages/Dashboard.tsx`, `components/dashboard/`,
`store/preferencesStore.ts` and `components/reports/dashboard/`.

### Goal and debt workflow integration

- Present the existing category-funded goal's assignments, activity and current
  availability coherently across Budget, Goals and relevant transaction detail.
  Offer navigation to the existing assignment/money-move controls.
- Preserve the distinction between manual tracking goals, funded categories,
  bank account locations and credit-card payment reserves. An account link or
  transfer must not become a second funding source.
- If adding transaction-to-goal navigation, derive it from the category linkage;
  do not introduce independently editable progress or another allocation ledger.
  Retain the untouched manual amount for unlinking, as phase 6C requires.
- Surface phase 6B's existing funded-versus-unfunded card debt and payment reserve
  in planning views. General loan payoff scenarios are a design proposal feeding
  phases 5/7, not a new calculation engine in this phase.

Use the current goal routes/hooks and shared envelope/card accounting services.
Preserve the unique category claim, future-assignment rules, unknown-rate states,
portable backups and reconciled/user-edited transaction protections.

### Planning periods and breakdowns

- Add merchant breakdowns alongside category/group views in cash flow, with
  consistent period selection and drill-down context.
- Add an annual budget overview with monthly drill-down. Sum period activity
  and assignments according to existing accounting definitions; do not sum
  running balances or count carried money again each month.
- Keep the current monthly budget available. Distinguish funded money today
  from planned future assignments and expected income.

Start with `client/src/pages/CashFlow.tsx`, `Budget.tsx`, `Reports.tsx` and the
shared report/budget services. A decade selector was observed in Monarch but
not exercised; it is not an acceptance requirement here.

## Implementation contracts (amended 22 October 2026)

The first brief left these decisions open. They are binding for phase 8 PRs.

### One transaction selection

- A single server module parses and validates the selection and builds its SQL.
  The register (`GET /api/transactions`), the filtered summary and the filtered CSV
  export (`GET /api/export/transactions/csv`) all use it; none rebuilds the filters.
- Parameters: `account_ids` (several), `category_ids`, `category_group_id`,
  `uncategorized`, `payee_ids`, `search`, `direction` (`debit` | `credit`),
  `min_amount`/`max_amount`, `from`/`to`, `reconciled`, `transfers`
  (`include` | `exclude`) and `budget_report`. Existing single `account_id`,
  `category_id` and `month` keep working.
- Dates are real `YYYY-MM-DD` days and both bounds are inclusive. A month uses its
  real last day, not `-31`. Invalid dates, reversed ranges and malformed amounts
  return 400 rather than an empty or unfiltered result.
- Amount bounds are integer minor units compared with the **magnitude** of the row's
  own amount, inclusive at both ends: "over 100" is `min_amount=10001`, "100 or
  more" is `min_amount=10000`. `direction=debit` means amount < 0; `credit` means
  amount > 0. Zero-amount rows match neither direction.
- `search` matches payee name and notes, case-insensitively. Merchant drill-down
  uses `payee_ids`; a row without a payee record uses an exact `payee_name`.
- **Splits.** Filters are evaluated on leaves: unsplit rows and split parts (parts
  carry the parent's account, date and payee). The register still shows one row per
  transaction and shows a split parent when any of its parts matches. The summary
  and export count only the matching leaves, so a filtered split contributes its
  matching parts, not its whole amount. With no category, amount or direction
  filter, the leaves add up to the parents exactly.
- **Transfers.** The register includes transfers by default because it is a bank
  register. `transfers=exclude` removes rows linked as transfers. `budget_report=1`
  keeps the existing cash-flow scope: personal budget accounts, and only the budget
  side of a transfer across the budget boundary.
- **Currency.** Summary totals are in the budget currency using each row's stored
  value. Rows whose rate is missing are left out of totals and reported as a
  separate count, matching reports. Export keeps both the account amount and the
  budget value, as today.
- Reading, summarising and exporting never write. Reconciled and user-edited
  protections are unchanged.

### Filtered summary versus income and spending

- The register summary reports **money in**, **money out** and **net** for the
  selected rows, with count and date span. It describes bank movement: a refund
  is money in and a transfer is movement unless excluded. It does not call that
  income or spending, so it never disagrees with category reports.
- Income, spending and savings rate are category accounting: income-category
  activity versus expense-category activity under `budgetActivity`. Spending is
  expense activity net of refunds over the whole period:
  `max(0, -(sum of expense activity))`. This is the `expenseNet` already returned
  by `/api/reports/income-vs-expenses`.
- **Savings rate** = `(income - spending) / income`, unrounded, and undefined when
  income is zero or negative (shown as a dash, never as 0%). One shared client
  helper computes it. Cash Flow uses it for the selected period. The home dashboard
  uses it for the trailing months it already averages, from summed totals rather
  than averaged rounded figures. Transfers, borrowing and valuation changes are
  never income or spending, matching phase 7's requirement. Display rounding is the
  only difference between screens.
- The Sankey diagram may still omit categories with net refunds, because it cannot
  draw negative flows; its headline totals use the shared definition.

### Scope and drill-down

- Drill-down state lives in the transactions URL query, so reload, back and shared
  links keep it. Cash Flow and report drill-downs pass `budget_report=1`, the date
  range and the category, group or payee they came from.
- The transactions register is account movement. Household expense shares and
  personal contribution budgeting stay on the Household page; the register summary
  never presents a household repayment as salary or a share as spending.

### Home dashboard preferences

- Card visibility and order are stored per device in `preferencesStore`, with a
  versioned migration, separate defaults for phone and desktop widths and a reset
  action. A phone and a desktop may reasonably want different home screens.
  These preferences are presentation only. They are not budget data and are not
  part of backups.
- Onboarding (`GettingStarted`) and the 7E review reminder stay outside the
  customisable cards and keep their own show/hide rules. Net worth, summary and
  every existing card can be hidden or moved; hiding everything shows a restore
  prompt.

### Merchant breakdown

- "Merchant" means the payee. Grouping uses the payee record, falling back to the
  stored payee name; rows with neither form "No payee". It uses the same spending
  definition as categories, so category and merchant totals over a period match
  the shared spending total.

### Annual overview

- One server summary per calendar year, built from the same per-month budget
  calculation as the monthly budget (`budgetGroups`), so it agrees with each month.
  Per category it reports monthly assigned and activity, their year totals, and the
  available balance at the end of the latest elapsed month. Balances and carry-over
  are never summed across months.
- Months after the current month are **planned**: their assignments are shown
  apart from money funded today. Spendable money today comes only from the
  existing `fundingState`; future assignments and expected pay never increase it.
- Card payment reserves and funded versus unfunded card debt come from the phase 6B
  service unchanged.

### Expansion proposals

Complete bounded proposals for receipts/attachments, per-transaction review and
visibility, tags/saved views, security holdings and long-term forecasting. Each
must specify the user problem, model, UI, storage/backup/export behavior,
permissions/privacy, dependencies, verification and implementation scope.

These proposals are deliverables within phase 8; implementing all those products
is not required to complete it. Distinguish attachments from retail-account sync,
transaction review from Up bank-source review, account-level investment balances
from security holdings, and historical charts from forecasts. Coordinate review
with phase 6G and forecasts with phases 5/7. AI consent, credit-score services and
household authentication are outside this phase.

## Acceptance and verification

Use a disposable FlyBudget budget with mock data only. The saved Monarch session
is not a test dependency, and no real account or bank export belongs in fixtures.

| Fixture      | Date       | Direction | Category  |   Amount |
| ------------ | ---------- | --------- | --------- | -------: |
| Mock payroll | 2026-10-05 | Income    | Paychecks | 2,000.00 |
| Mock grocer  | 2026-10-07 | Expense   | Groceries |   120.00 |
| Mock cafe    | 2026-10-09 | Expense   | Dining    |    45.00 |
| Mock grocer  | 2026-09-07 | Expense   | Groceries |    90.00 |

1. October totals are income 2,000, spending 165 and net income 1,835. The savings
   rate is 91.75% before intentional display rounding on both Cash Flow and the
   shared helper. All-time spending is 255 and net income 1,745.
   Category/merchant grouping preserves these totals.
2. Mock account + debits + `min_amount=10001` returns only the 120 expense. Payee
   search for the grocer returns both grocery entries, totaling 210 money out.
   Also test exact boundaries, empty selections, refunds, splits, transfers,
   reconciliation, household scope and missing exchange rates; the four-record
   fixture alone is insufficient.
3. Filtered summaries, exports and report drill-downs agree with the displayed
   records and accounting scope. Changing filters never writes financial data.
4. Dashboard preferences survive reload/reset and remain usable on phones;
   changing presentation never changes balances or transaction records.
5. Goal navigation and budget summaries agree with phase 6C progress after
   assignments, spending, refunds, money moves, future reservations and unlinking.
   Existing goals/manual amounts and backup restore remain compatible. Card
   reserve/debt presentation agrees with the phase 6B service.
6. Annual figures agree with monthly activity and assignment totals without
   double-counted carry-over. Future plans never increase spendable cash today.
7. All expansion proposals are documented and explicitly marked as proposals.

Run affected server tests and `cd server && npx tsc --noEmit`; client tests/build
and relevant desktop/phone/demo browser flows for changed UI. Use the smallest
relevant checks from AGENTS.md, format changed files and record results in PRs.
Use additive migrations and shared write helpers if persistence changes.

Implementation can use several focused feature PRs, all tracked under phase 8,
in this order: (1) this amendment; (2) transaction selection, summary and filtered
export; (3) home dashboard preferences; (4) merchant breakdown and annual
overview; (5) goal/debt presentation and the expansion proposals.
App changes require the next prepared version/changelog, green CI, tested-main
publication and verified release delivery. Any live HA update additionally needs
the existing app identity, a restorable cold backup including the encryption key,
and post-update health/budget-access checks. Adding this planning documentation
requires no version bump, release or live update.

## Inspection evidence and limits

Actual REA passive captures of signed-in Monarch covered all ten main navigation
areas on 21 October 2026. The owner subsequently authorized mock data. CUA created
one labelled manual account and four synthetic entries; REA captured populated
results. No bank connection, payment, existing-account edit or AI consent was made.

| Observation                                                                        | REA Evidence ID                                                       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Combined account/debit/amount filtering returned one 120 expense                   | `ev_6de6b3ac81cb202677750f66faa5619946716584794cfe5549a1a40f63ddf733` |
| Merchant search returned two grocery entries totaling 210                          | `ev_f43da88b74deaa99d27784de2c1e7db4381a84710443b8b0424e6ef83f5a311a` |
| October totals and category shares matched the fixture                             | `ev_4d5a88ae7cc35f8feab355f272db16a44b8f1ed5dccdc391b87720746d0f2ef6` |
| Merchant regrouping preserved totals                                               | `ev_ba4c21e88da51ceade745b9799f2051a0967d2f8e7188236df9455ed551e9111` |
| All-time reports included the September expense                                    | `ev_c3e2f35908ec1de09ffd4a607283c62adf5053240fa8382eae859f3b52f7668b` |
| Populated transaction detail exposed splits, goals, tags, attachments and activity | `ev_568c9ae084154aac121efdb9e7395962ab0b90533679c50f05d31ebe1a33cd47` |

These IDs identify observations, not public downloadable captures. Only the
synthetic fixture and summarized findings belong in Git; raw signed-in captures,
identifiers, personal values and credentials are excluded. Manual entry and
aggregation were tested on four records. Attachments, split edits, goal-link
accounting, holdings and forecasts were not exercised. Their visible controls
do not establish their implementation or correctness. Phase 8's design choices
must be validated against FlyBudget's current accounting, not inferred Monarch
internals.
