# Monarch continuation: recurring, goals, reports and investments

22 October 2026. Live observations supplied from the continued REA inspection. These extend the [initial notebook](monarch-observed-workflows.md) and [earlier continuation](monarch-live-audit-continued.md). Evidence IDs identify captures; interpretations of purpose are labeled separately. No undocumented calculation or unexercised action is treated as recovered behavior.

The user explicitly authorized clearly labeled synthetic data and a test scenario for further inspection. This authorization excludes edits to baseline or real financial records. The allocation and recurring drafts described below were canceled. Investments remained empty; its populated calculations are unverified. Forecast continuation is recorded separately.

## Recurring management

Manager evidence: `ev_f993d37177df6c9a7b3d70071a9ebceb6acf6790675722cfea3929920942f9fc`. Manual editor evidence: `ev_546e0279705dda490a5e84a1e90017d3979e5e21c20b2fe11e932c49e696c709`.

**Observed:** Manage recurring opens a modal with three paths: liability sync, manually choosing a merchant, and finding recurring items in accounts. Manual merchant search requires at least three characters. Selecting a merchant opens Edit merchant with merchant name/photo and a draft Mark recurring checkbox checked.

| Control       | Observed options / explanation                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frequency     | Weekly; every 2 weeks; every 4 weeks; twice monthly on 1st/15th or 15th/last day; monthly; every 2, 3, 4 or 6 months; yearly |
| Type          | Expense or Income                                                                                                            |
| Start date    | Used for forecasts                                                                                                           |
| Amount        | Editable amount field                                                                                                        |
| Status        | Active or Canceled; explanation says canceled retains past calendar entries and stops future entries                         |
| Other actions | Merge & delete; Cancel; Save                                                                                                 |
| Validation    | Save disabled when frequency is absent                                                                                       |

Cancel was used; no recurring schedule was saved. The status explanation establishes intended behavior, not a tested cancellation of an existing schedule. Merge & delete, liability sync, discovery results, holiday/month-end rules, matching, edits to existing occurrences and save persistence were not exercised.

**Intent, inferred:** the manager separates automated liability data, manually defined merchant schedules and account-based discovery. Frequency and start date define expected occurrences; canceled status offers a future stop while retaining historical context. A recurrence editor should make these effects visible before committing.

## Goals: overview, detail and funding

Landing evidence: `ev_a41208556fc87e7d951c5a9a84e18616abad2566e298ad3f7c0ac19a20ae1e54`. Detail: `ev_1f933d054c421c3ddf78a386b76ef8a1b174c56087fa2deb23d3d95b0a100fd1`. Settings: `ev_4203ddcb311e54c3cec98e1601d046abb1883ac5593ee110d50b0c90582045a3`. Allocation: `ev_6c20a833e65e48e104120da8734ec0ebdb588dfcb044276d2e8667d36279d30b`.

### Overview and detail

**Observed:** the landing page separates Save up and Pay down, with Manage, Allocate and Add actions. A savings total appears separately from Available for goals accounts.

Goal detail shows a timeline/contributions view; total saved, spent, available and left; status, target and contribution information; account allocations; and activity with Show adjustments. These are distinct displayed measures. Their exact reconciliation and inclusion rules were not boundary-tested.

**Intent, inferred:** separating account availability from a goal's accumulated progress helps explain where backing funds reside and how much has been earmarked. Saved versus spent versus available distinguishes contributions from later consumption; it should not be reduced to one progress percentage without explanation.

### Goal settings

**Observed:** settings exposes name, target amount, optional target date and optional monthly planned contribution. The form shows a recommended required amount per month and explains that spending reduces progress. This supports a distinction between target, planning pace and actual activity. The formula for recommended monthly contribution and partial-month handling remains unverified.

### Allocate modal and budget inclusion

**Observed:** Allocate includes From account or goal, To goal, Amount, Date and Include in budget. The checkbox is checked; its explanation says inclusion affects budget actuals. Cancel was used, with no allocation submitted.

**Intent, inferred:** an allocation expresses earmarking between a source and goal, while the checkbox controls analytical treatment in budget actuals. This does not establish whether Monarch stores a ledger transaction, adjustment or separate allocation record. Insufficient-funds checks, cross-goal rules, retrospective edits and reversing allocations remain unknown.

**FlyBudget proposal:** retain explicit funding provenance and separate allocation facts from bank-import identities. Before adopting an inclusion toggle, define how it affects actual spending, transfers, category balances and double counting; the observed label alone is insufficient to change ledger accounting.

## Reports: chart, drill-through and register stay together

Main report evidence: `ev_584746fb47d2a82f625d1b0d41d7e13784089c01768a39bdd07ec016214e582a`. Spending variants: `ev_0f8bd9ba5ef708b59e808fb396691a35ba71b7c15d69fd3e81167b887dd39929`. Treemap controls: `ev_15e8685f4b35c39aab0b8448b983171b20df8a60af08f80052c145f078655215`. Drill-through: `ev_dd4bd0a7853a5b4c2dd89df8a17ece2de5213059105e5c6d72033740d4b55e4d`.

**Observed:** Reports offers Cashflow, Spending and Income, with Date, Filters, Reports and Save controls. A chart appears with underlying editable transactions, a summary and CSV action. The Cashflow report offers Sankey or Trend bars, and a By category & group selector.

The mock sample supports different denominator labels in the Sankey: expense groups show share of income, while category leaves show share of expenses. This is sample-backed behavior, not a demonstrated universal rule for negative income, refunds or zero denominators.

Spending offers pie, breakdown, treemap and trend-bar visualizations. Treemap shows Top 15, By category and a breadcrumb. Clicking a category drills into merchants and filters the underlying transaction table and summary. The URL retains a `treemapDrill` stack. Thus the selected chart context affects all three visible analytical surfaces in this exercised path.

**Intent, inferred:** chart variants answer composition versus change over time; the transaction list makes aggregate totals inspectable and supports cleanup in context. Breadcrumb plus URL drill state provides a recoverable exploration path. Save presence does not establish which filters, visualization choices or drill levels are persisted.

**FlyBudget proposal:** use one explicit filter/drill specification for chart, table, summary and export. Label each percentage's denominator. Test consistency with mock refunds, transfers, empty results and date boundaries; do not assume Monarch's edge-case rules.

## Separate Cash Flow destination

Evidence: `ev_5d9b9b4d7108bd5afb02cb8aa464127b17cce455e9cb7cc591e3ceba61f25e5d`.

**Observed:** the separate Cash Flow page provides monthly, quarterly and yearly periods, period bars, income, expenses, total savings and savings rate. It has Category/Group/Merchant breakdown choices, Share buttons and Filters.

**Intent, inferred:** period summaries foreground changes in inflows, outflows and savings, while the report's Sankey foregrounds allocation. Both can share underlying data without requiring identical layouts. Share destination/permissions, filter combination, savings-rate formula and negative-income behavior were not exercised.

## Investments: onboarding and empty analytical shell

Onboarding evidence: `ev_353256cd04371274ee1743c78f7e42297d81f86ae6a4534491ad1b8a8175bc33`. Holdings: `ev_9023f3144b9fb0ea980a5766ebb095193382f1ee8b9ba94cfffd92b73f657395`. Advanced views: `ev_c9a26b1bf059a89a6dd7bb292a1d4d64cb95bcfc06acce1a5088b177a5137632`.

**Observed:** three onboarding slides explain gains/losses relative to what was paid, tax lots enabling an actual performance timeline, and Morningstar fund classification. These are product explanations; no populated holding, tax lot or classification was validated.

Holdings shows a Backtested performance chart, Market/Allocation controls, period selection, download-chart action and benchmarks S&P 500, US stocks and US bonds. Holdings has Group by asset class, Accounts filtering and Add holding. The holdings list is empty. Advanced views expose Allocation, Gains & Losses and Funds, all without data.

**Intent, inferred:** holdings composition, historical backtesting and gain/loss accounting answer different questions. The onboarding's distinction between backtested and actual performance is material: the empty chart does not reveal how deposits, sales, dividends, fees, currencies or tax lots enter calculations.

**FlyBudget proposal:** defer performance parity until an independently specified positions/valuation/cashflow model exists. Do not infer actual investment returns from balance changes or reuse backtesting labels for a different calculation. Add-holding fields, populated allocation hierarchy, benchmark normalization, cost-basis method and export behavior remain uninspected.

## Remaining coverage boundaries

- Recurring populated schedules, matching, liability sync consent and merge/delete consequences remain untested.
- Goal funding mutations, Pay down setup, lifecycle operations, overspending and reversal need controlled synthetic cases.
- Report Save/Share/export contents and unusual-sign arithmetic remain untested.
- Investments has empty-state/control coverage only; populated calculations are not reconstructed.
- No claim is made here about forecast editors or formulas; this document intentionally covers the other destinations from the continuation.
