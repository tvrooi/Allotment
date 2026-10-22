# Monarch investigation

Start with the [master action catalog](monarch-action-catalog.md) for consolidated actions, tested mutation boundaries, current synthetic inventory and remaining gaps.

22 October 2026. Branch: `codex/monarch-workflow-research`.

1. [Live workflow notebook and coverage register](monarch-observed-workflows.md): REA evidence, actual UI observations, visualization structure, action purposes, modal/drawer behavior and remaining audit work.
2. [Official documentation supplement](monarch-documented-behavior.md): behavior described by Monarch, including newer releases and conflicts with older help pages. These are not live-tested claims.
3. [FlyBudget adaptation map](monarch-flybudget-gap-map.md): existing components, services and recommended extension points.
4. [Continued live audit](monarch-live-audit-continued.md): transaction drawer, split modal, filters, bulk editing, monthly/annual Budget and initial Recurring inspection.
5. [Implementation backlog](monarch-implementation-backlog.md): eight prioritized FlyBudget improvements with acceptance criteria, existing code seams and focused verification.
6. [Recurring, goals, reports and investments continuation](monarch-populated-workflows.md): recurring management drafts, goal funding controls, linked report drill-through, separate cash-flow views and the empty investments shell.
7. [Forecasting reconstruction](monarch-forecasting-reconstruction.md): isolated synthetic scenario, comparison, event editors, mortgage sample and verified sequential savings splits.
8. [Tested investments workflows](monarch-investments-tested.md): synthetic manual holding, security drawer, look-through allocation, missing basis, manual tax lot and fund-only analysis.
9. [Tested debt and recurring workflows](monarch-debt-recurring-tested.md): synthetic loan setup/pay-down, transaction/merchant persistence and populated recurring list/calendar behavior.
10. [Account tools, rules and settings](monarch-account-rules-settings.md): verified loan balance, history/transfer warnings, settings controls and an unsaved before/after rule preview.
11. [Shipped-code analysis and gap fill](monarch-rea-static-gap-fill.md): REA static analysis of Monarch's production JavaScript (698 GraphQL operations, enums, form validation) plus committed split and bulk-edit tests. It recovers the client-side Monte Carlo Forecasting engine (yearly loop, savings splits, withdrawal order/tax, growth model, success metric), the split rounding algorithm, the bulk-edit selection and safety model, the rule/filter operators, rollover periods, recurring statuses and the Decade view. It supersedes several "unknown" entries below.

All ten main destinations have live coverage. Transactions, Budget, Goals/debt pay-down, Reports, Investments, Forecasting and populated Recurring received deeper inspection. Account history/transfer tools, rule previews, settings, receipt/retail controls and the initial CSV wizard were also inspected. This remains partial action coverage; sampled calculations do not establish every formula or validation.

The earlier Mac locks and loan-not-created checkpoint are historical. The synthetic loan was subsequently created; its latest verified balance is1,025 after the 25 debit. REA controlled scenarios now work with the supported `environment.service_workers=allow` option. Raw captures remain outside the repository because they may contain financial/profile data.

Retained synthetic inventory, pending explicit cleanup permission:

- **REA INSPECTION — synthetic forecast**: seven new events (Home, New job, Child, Career break, Income, Windfall, zero-dollar recurring Expense), copied Retirement/Social Security/End of plan, two sequential 50% savings allocations, and synthetic holding growth changed to Variable rate (advanced), initially 2026/7%.
- **REA INSPECTION — synthetic holdings**: manual Brokerage (Taxable), one VOO share and one lot acquired 22 October 2026 at 500 × 1.
- **REA INSPECTION — synthetic loan**: initial 1,000, APR 12%, minimum 100/planned 150; latest verified balance 1,025. One 25 debit to **REA INSPECTION recurring utility**, Gas & Electric, inspection-only note, plus that merchant's Active monthly Expense 25 starting 22 October 2026.

Adding synthetic accounts affects aggregate net worth. No cleanup deletion is recorded. The synthetic-only recategorization rule stayed an unsaved draft: no rule or transaction category edit was committed. No balance-history save, account transfer, CSV/receipt upload, security change or Save to Budget submission was performed.

Remaining gaps include committed split/bulk/rule paths; populated multi-debt/multi-lot calculations; receipt/retail matching and CSV mapping/validation; forecast timing, depletion, tax, variable-rate interpolation and drag boundaries; unvisited global settings; and downstream confirmations/error/recovery. See the catalog for action-specific limits rather than treating a visible control as tested completion.

No application changes or release are part of these findings. The documents are a reconstruction guide and investigation ledger, not a claim of source equivalence.
