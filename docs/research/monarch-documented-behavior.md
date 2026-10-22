# Monarch official documentation supplement

Research date: 22 October 2026. **DOCUMENTED**, not live observed. These notes supplement the REA inspection; they do not establish exhaustive action coverage, exact backend formulas, or availability in this household. No account data was collected for this document.

## Version conflicts to resolve against the live app

Monarch's help pages and release announcements describe different generations. Prefer the live observation for current controls; keep these discrepancies explicit:

- May's Forecasting article says saved scenario comparison is future work; July's release announces comparing two plans on one chart.
- October 2025 Reports help calls Reports web-only; August 2026 announces treemap on both web and mobile.
- January transaction guidance warns pending edits can be lost; August announces improved preservation when pending transactions post.
- The old Using Goals page links to the current Goals experience. Do not apply its one-retirement-goal restriction or transaction-based architecture to Goals 3.0 without verification.

## Transactions: review and automation

**DOCUMENTED**: Review preferences can mark all new transactions or only uncategorized ones for review; rules can refine that workflow. Rules may match original statement text instead of merchant name. Merchants can be merged, and merchant/account logos customized. Tags support cross-category analysis. These actions turn repetitive cleanup into reusable decisions. [Transactions and Rules Tips & Tricks](https://help.monarch.com/hc/en-us/articles/28953573066260-Transactions-and-Rules-Tips-Tricks).

**DOCUMENTED**: The detail drawer's eye control hides a transaction; Filters → Other → Hidden Only retrieves it. Edit Multiple supports bulk hiding with Save then Apply review. Hiding does not remove Needs Review. Account-level hiding must be reversed at account level. This separates analytical inclusion from review completion. [Hiding or Unhiding Transactions](https://help.monarch.com/hc/en-us/articles/4405041904916-Hiding-or-Unhiding-transactions).

**DOCUMENTED**: Transfer categories and credit-card payments represent movement between owned accounts and are excluded from budget, cash-flow, and spending totals, avoiding double counting. [Transfers and Credit Card Payments](https://help.monarch.com/hc/en-us/articles/360048393292-Understanding-Transfers-Categories).

## Budget: control spending with fewer decisions

**DOCUMENTED**: Category budgeting allocates individual category/group budgets. Flex budgeting combines Fixed, Non-monthly, and one Flexible limit. The Flexible total may differ from category sub-budgets; their difference is unallocated flexibility. Fixed and Non-monthly totals derive from their categories. Non-monthly target divided by interval gives the monthly provision: $600 every six months → $100/month, with rollovers accumulating until payment. Variable frequency requires manual provision.

Remaining pills open money movement. Flexible movement operates at bucket level; optional category limits remain informational controls. Category rollovers affect Fixed/Non-monthly totals but not the Flexible total. The pacing tick marks elapsed month; green indicates within budget, yellow Flexible spending ahead of pace, red overspending. Fixed/Non-monthly categories use configured ordering; Flexible categories sort by actual spend. This makes immediate adjustment easier than rebuilding a budget. [Using Flex Budgeting](https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting).

**DOCUMENTED**: Monthly budgets start from expected income, subtract expenses and savings, round displayed budget amounts to dollars, and reset monthly unless rollover is enabled. Dashboard cards can be ordered/disabled independently on web and mobile. Household ownership filters do not create private accounts or multiple Budget pages. [Getting Started](https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch).

## Recurring: timing, completion, and liabilities

**DOCUMENTED**: List/calendar views combine merchants and liability bills. Manage recurring initiates Spinwheel credit-report connection and account mapping; this requires US credit-bureau coverage and desktop initial setup. Each mapped account needs a due date. Due dates, payment accounts/categories, and statement amounts can be overridden; the amount override offers revert. Amount hover exposes minimum payment/details.

Transactions in the mapped account can mark bills Paid or Partially Paid; a manual Mark as paid fallback moves an item to Completed. Loans require payment at least the bill amount for Paid. Credit cards use statement/minimum thresholds; multiple sub-minimum payments can accumulate toward the minimum. These controls record planning status; they are not bank-payment initiation. Bill Sync does not automatically obtain utility/subscription bills. [Getting Started with Bill Sync](https://help.monarch.com/hc/en-us/articles/29446697869076-Getting-started-with-bill-syncing).

## Goals: balances, allocation, and funding intent

**DOCUMENTED**: Current Goals separates Save up from Pay down. Goal accounts define available funding globally; allocation adds/withdraws/shifts assigned money. Income/transfer linking can be manual or rule-driven; expense linking is manual. The old architecture's migration can produce summary contributions absent from daily activity. This matters when comparing totals with a timeline. [Goals in Monarch, updated 20 October 2026](https://help.monarch.com/hc/en-us/articles/44373110771860-Goals-in-Monarch).

**DOCUMENTED**: Save up onboarding collects type, optional amount/date, whether spending reduces progress, existing funds, and monthly contributions. Status requires amount, date, and contribution. Chart: green balance, purple target, black spending, dotted projection. Entire-balance accounts create at most one daily adjustment, excluded from budgets. Partial allocations do not receive modeled investment growth. Whole-account growth is nominal compound interest; target/contributions are not inflation-adjusted. Available means unassigned; over-allocation means allocations exceed actual balances. Archive returns available funds, preserves history, removes future budgeting, and is reversible. [Using Save Up Goals, updated 19 October 2026](https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals).

**DOCUMENTED**: Reconciliation resolves spending from a goal via another account, especially credit cards: the funding account must be identified so savings are not overstated while payment is outstanding. Fund allocations and transaction linking serve related but distinct accounting paths. Do not treat a goal allocation as execution of a bank transfer. [Moving Funds In and Out of Goals](https://help.monarch.com/hc/en-us/articles/46420712538260-Moving-Funds-In-and-Out-of-Goals).

**DOCUMENTED**: Pay down is liability-account based. Edit account details supplies APR, minimum payment, optional planned payment; principal and interest only. Manage/include/exclude controls scope; monthly paid-in-full cards can be excluded from projections. Summary cards show debt principal, projected interest, combined cost, and debt-free date; per-account curves provide timeline or principal/interest views. The calculator explores planned/avalanche/snowball plus additional payments. Save to Budget opens a confirmation to choose all/subset accounts and writes planned contributions; one-time extra payment applies to the current month. Liability-side transaction linking supplies actuals. Budgeting the same payment as both expense and contribution can double count. [Using Pay Down Goals, updated 19 October 2026](https://help.monarch.com/hc/en-us/articles/44373293932052-Using-Pay-Down-Goals).

## Reports: answer a question, then drill to its evidence

**DOCUMENTED**: Cash Flow offers Sankey and bar variants; Spending/Income offer category/group/merchant breakdowns using pie/bar views and totals or change over time. Date/filter controls refine categories, merchants, accounts, tags and amounts. Hover reveals detail; clicking often opens contributing transactions. Download exports charts; saving retains a report configuration that refreshes with new data. [Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Reports).

**DOCUMENTED**, newer release: Spending/Income treemap sizes blocks by amount and drills group → category → merchant → transactions. It supports filtering and saved reports on web/mobile. Early retirement projections now display withdrawal penalties separately beside withdrawals/taxes; pending transaction edits are better preserved through posting. Dashboard spending averages skip months without data. [August 2026 product update](https://www.monarch.com/blog/august-product-update).

## Investments and newer actions

**DOCUMENTED**: Plus portfolio treemap groups holdings by asset class/sector; block size represents position size, click drills to holdings, and classification can be overridden. Transaction Activity shows import/posting/edit history. Receipt-email processing matches receipts and can create categorized splits. Forecasting compares two plans, supports mixed pretax/Roth account portions and growth rates that vary through time. These are separate analytical views/actions; exact available controls need live capture. [July 2026 product update](https://www.monarch.com/blog/july-product-update).

## Forecasting: a simulation with inspectable assumptions

**DOCUMENTED**: Baseline annualizes complete-month actuals (up to 12). Balances roll year to year; current-year January balances are estimated backwards from today. Nominal income/expenses/events inflate cumulatively; per-item growth can override inflation. Surplus enters Extra Savings; cascading splits apply each percentage to the remaining surplus. Deficits withdraw in configured order. Debt Paydown supplies rates/payments unless overridden locally. Payroll contributions require manual input.

Chart events/hover expose yearly detail; Accounts/Cash Flow/Events tables explain calculations. Account gears edit growth, tax, payment, contribution and inclusion assumptions; global assumptions set participants, inflation and horizon. Retirement stops owner income; recurring events can have intervals/end years. Default asset growth: savings 2%, investments 7%, property 3%, vehicles -15%, checking 0%, Extra Savings/others 3%. The same article inconsistently describes savings as 3% in prose: verify the live default. Exact tax/compounding operation order is not established. [Forecasting in Monarch](https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch).

## FlyBudget design inferences (proposals, not Monarch facts)

- Keep actual ledger transactions, planning budgets, goal allocations, recurrence instances and forecast scenarios separate, connected by stable references.
- Every chart drill-down should preserve filters and expose underlying rows or calculation components.
- Prefer drawers for contextual edits, explicit review for bulk changes, and clear save state for autosaving scenarios.
- Store forecast assumptions with provenance (derived/default/overridden), effective dates and units. Show errors for missing inputs rather than silently omitting debt.
- Use integer money internally; keep rounding at display boundaries. Model transfer exclusion consistently across every analytic surface.
- Build reusable filter, review queue, allocation, recurrence-status and chart-tooltip components before implementing advanced forecast events.

Documentation alone does not establish all menu items, empty/populated states, validation, confirmation wording, undo behavior, autosave semantics, mobile parity, receipt intelligence, investment returns methodology, or the full event schema. These remain targets for live inspection and synthetic-data testing.
