# Monarch workflow reconstruction notebook

Inspection date: 22 October 2026. Target: the user's signed-in Monarch web app, Chrome 154, observed through REA CDP and the native Chrome UI. This is an ongoing evidence-based investigation, **not an exhaustive reverse engineering of every action**. No server implementation or proprietary forecasting formula has been recovered.

## How to use this notebook

- **Observed** means visible in this session, with an REA Evidence ID or an explicitly described native UI observation.
- **Intent** is an interpretation of why a control exists. It is not evidence of internal implementation.
- **Proposed** means an independent FlyBudget design recommendation.
- Official product documentation is recorded separately in [documented behavior](monarch-documented-behavior.md). It can describe states this account cannot expose and may lag the current UI.
- [FlyBudget adaptation map](monarch-flybudget-gap-map.md) identifies existing source seams. Reuse those before adding another tab or engine.

Only sanitized behavior belongs in this repository. Raw captures may contain account names, balances, profile fields and identifiers. They are excluded here. A temporary REA evidence bundle was exported outside the repository; it is not a distributable fixture or bank-data backup.

## Coverage register

This table reflects the latest continuation: all ten main destinations have live coverage, with deeper inspection documented in the linked supplements. It is not an exhaustive action inventory. The initial captures below remain historical observations; later synthetic tests and their retained artifacts are documented separately and summarized in the [index](README.md).

| Destination              | Live inspection                                                                                                                                                                                                         | Still required for exhaustive coverage                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                | Main widgets, contextual selectors, Customize modal                                                                                                                                                                     | Each card's drill-through, goal display settings, drag persistence, AI responses, onboarding actions                                                    |
| Accounts                 | Chart selectors, aggregate summaries, group rows, actions                                                                                                                                                               | Account detail, add-account flows, connection errors, manual valuations, balance history, filters/export contents                                       |
| Transactions             | [Register, route-backed drawer/activity, split draft, filters and bulk-edit draft](monarch-live-audit-continued.md)                                                                                                     | Saved-view persistence, applied edits/splits, rules, attachments, receipts/retail sync, review mutations and confirmation/error paths                   |
| Cash Flow                | [Monthly/quarterly/yearly periods, bars, savings metrics, breakdown selectors, Share and Filters](monarch-populated-workflows.md)                                                                                       | Applied filters, Share/export outcomes, unusual-sign arithmetic and downstream actions                                                                  |
| Reports                  | [Cashflow/Spending/Income controls, chart variants, treemap merchant drill-through linked to table/summary and URL](monarch-populated-workflows.md)                                                                     | Save persistence, custom-report paths, export contents, filter combinations and edge-case calculations                                                  |
| Budget                   | [Monthly/year views, Flex sections, settings, category modal and edit-scope descriptions](monarch-live-audit-continued.md)                                                                                              | Applied propagation/rollover, category-mode transitions, decade view, reset confirmations and calculation boundaries                                    |
| Recurring                | [Empty monthly view and manager; manual merchant definition/frequency/status form canceled without saving](monarch-populated-workflows.md)                                                                              | Populated schedules/calendar, detection, paid matching, saved mutations, liability sync and merge/delete consequences                                   |
| Goals                    | [Save up/Pay down overview, detail metrics, settings and allocation draft](monarch-populated-workflows.md)                                                                                                              | Populated debt pay-down, applied allocations/contributions, lifecycle actions, reversals and funding edge cases                                         |
| Investments              | [Synthetic manual holding, security drawer, look-through allocation, tax lot/gain sample and Funds view](monarch-investments-tested.md)                                                                                 | Multi-lot/sale/realized gains, actual performance, connected-account behavior, document upload, benchmarks and calculation boundaries                   |
| Forecasting              | [Scenario duplication/comparison, event editors, mortgage sample, source reductions and sequential savings split](monarch-forecasting-reconstruction.md); initial assumptions/withdrawal/Accounts/Cash Flow views below | Recurring Expense editor, rates/account tax settings, chart hover/drag validation, withdrawal/depletion, timing/rounding and other numerical boundaries |
| Settings/global controls | Sidebar navigation inventory only                                                                                                                                                                                       | Search, notifications, profile, households, business settings, categories, tags, rules, import/export, security and help overlays                       |

The Mac locked during the initial pass and again during later continuations. The third lock currently blocks saving a pending synthetic loan form. REA confirmed that the loan was **not created** (`ev_652e4a9baf94cdccc134a4a7571aee76a5204e1e8b75e1dc5e9044316e9970a4`). Native browser interaction requires unlocking. Historically, REA's controlled scenario runner returned `execution_failure`, including a separate CLI attempt; Doctor verified Node and registration without diagnosing the failure. Passive captures succeeded. Missing native disassemblers did not block browser inspection. Do not repeatedly retry unchanged scenario requests.

## Shared shell and navigation

**Observed:** persistent left navigation contains Dashboard, Accounts, Transactions, Cash Flow, Reports, Budget, Recurring, Goals, Investments, Forecasting; the footer exposes AI Assistant, Help & Support, referral and profile. Header icons include search, notifications, settings and sidebar collapse visually. Forecasting has a Plus badge. Sidebar Budget initially points at `/plan`; a dashboard Budget card points at `/budget`. Treat route aliases separately from distinct features.

**Intent:** navigation groups distinct user questions: overall status; balances; individual records; period activity; analysis; spending plan; future obligations; earmarked objectives; portfolio; long-term scenarios. A consistent shell allows each destination to reuse dates, account filters and transaction drill-through.

**Proposed:** keep URL-backed filters and drawers so chart drill-through can preserve context and browser Back can return to the prior view. That is a FlyBudget design proposal; only Forecasting's route-backed sidebars were directly observed here.

## Dashboard

Evidence: `ev_be3a2054413ffd0a1733ebe01dc7d0cae4fc0a830820c60139b2038e4db18157`; Customize `ev_c34539aec82dbad895bcd1d3ef801efb7fd3fd07346f3515d486a8d1359088f9`.

| Action / element                 | Observed result or available state                                                                                           | Intent / implementation implication                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Customize                        | Centered modal: select widgets; each row has a visibility checkbox and drag handle; Close dismisses                          | Personalize information density and order. Save timing and persistence were not exercised                                |
| Widget drag handle               | Present on cards and in Customize                                                                                            | Reorder by priority. Provide keyboard reordering and stable widget IDs in FlyBudget                                      |
| Getting started                  | Completed-items control; setup actions for business/partner; explore-on-own action                                           | Progressive onboarding rather than an empty landing page; consequences were not exercised                                |
| Budget widget                    | Month label, Expenses selector, empty state explaining budgets are needed                                                    | Summarize plan progress and provide a reason when unavailable                                                            |
| Net worth widget                 | Current value, absolute/percentage change, timeframe selector, historical chart, Accounts link                               | Answer whether overall wealth is changing; denominator/rounding remain unverified                                        |
| Savings goals                    | Monthly contribution total; goal card with amount, percent, ahead status and target-date comparison; display-settings button | Convert an abstract target into pace feedback                                                                            |
| Spending trend                   | This-month vs last-month selector; day-of-month x-axis and two series                                                        | Compare equivalent portions of months; exact partial-month treatment remains unverified                                  |
| Recent transactions              | Filter selector; merchant/category comboboxes, merchant/category links, Notes and Open transaction details                   | Routine cleanup without leaving overview. Selecting a combobox value may write immediately, so no changes were submitted |
| Recurring widget                 | Period selector, remaining-due total, explanatory empty state and See recurring                                              | Surface upcoming obligations before they are paid                                                                        |
| Investments widget               | Sync-investments link in unconnected state                                                                                   | Explain the prerequisite instead of showing a misleading zero-performance chart                                          |
| Credit score / business tracking | Setup calls to action                                                                                                        | Optional product areas. No setup, consent, account linking or external invitations were performed                        |
| Ask AI Assistant                 | Context-specific actions and suggested questions in accessible text                                                          | Scope assistance to a card's question; no query was sent                                                                 |

Customize lists ten widgets: Getting started guide, Budget, Credit score, Net worth, Savings goals, Business tracking, Spending trend, Transactions, Recurring transactions, Investments.

## Accounts

Evidence: `ev_e72abd34aa099743b2be381a66cb57fa22890eb40af04763cfc8f23a005662b9`.

**Observed:** Accounts has Net worth metric selection, Chart type and Timeframe comboboxes; the current chart type is Performance. The selected timeframe shows a change amount, percent and period label. Account groups have collapse and reorder controls. Account rows show name, subtype, balance and freshness. Summary has Assets/Liabilities, Totals/Percent toggles and Download CSV. Header actions include Refresh all and Add account; list controls include Sort and Filters.

**Intent:** the chart answers trend, the summary explains composition, and the rows identify underlying sources and stale connections. Refresh all addresses data freshness; it should not be conflated with manually editing balances. Totals/Percent changes composition units. Download CSV supports independent review. These purposes are inferred; resulting overlays and exported contents are not yet inspected.

## Forecasting: live mechanics

Initial assumptions evidence: `ev_6ba70bd4b2ea4bc4aaa80d3eed295659e078f94b7542afb7afc2e0efa60c6b1e`. Withdrawal order: `ev_ea4b6934c2a2c7c9f0529d6080686850e05da92fe2b666e412d24502f2b0c2b4`. Cash Flow subview: `ev_799a935759d7c5a4369ea455b650fe3d8745ff3bf68acc3775b6f3563db2f1b6`. Expense editor: `ev_71169fc724ede775b927fb4e437211a6938db83c2cbf8cb691b72940be92a894`.

### Scenario and visualization

**Observed:** a scenario chooser and Add scenario sit beside the page title. The scenario card has name/icon, Scenario actions, Watch walkthrough, Edit assumptions and Add event. Scenario actions visually contains Edit name and icon, Duplicate and Delete scenario; deletion was disabled for the baseline. The top summary shows net worth at end of year, net worth at retirement, retirement age and net worth at end. Information controls appear on net-worth metrics. A Saved timestamp indicates persistence.

The primary visualization is a net-worth line over calendar years, with money on the vertical axis and event icons positioned on the timeline. The current scenario is a decades-long projection. Event markers expose draggable handles. Exact snapping, collision behavior, hover details and recomputation timing were not tested. Beneath the chart, tabs switch Accounts, Cash Flow and Events. The annual table scrolls horizontally and its left hierarchy groups the source rows.

**Accounts subview:** Net Worth, Assets, cash accounts, Extra Savings and Liabilities; expand/collapse controls at group/account levels; account settings; rate controls. Extra Savings expands into Starting balance, Inflation adjustment, Growth and Deposits. Positive and negative components use green/red emphasis. This explains the balance change instead of exposing only the final curve.

**Cash Flow subview:** expandable Income and Expenses, named income sources, Social Security, Yearly living expenses and Retirement, with settings controls on relevant rows; Net Cash Flow total. Switching the tab changes the route to `plan/cashflow` while preserving the scenario.

**Intent:** chart for long-term consequences; KPI strip for decision checkpoints; annual table for auditing the explanation; Events for managing causal inputs. A scenario definition must remain separate from real ledger transactions.

### Assumptions drawer

| Control                         | Observed behavior / explanation                                                          | Purpose                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member                          | Birthday, life expectancy in years and year, exclude-member checkbox                     | Define personal timing and projection endpoint. Birthday explicitly also changes profile/Household Members, so this is not necessarily scenario-local |
| Current income sources          | Named source and Add new                                                                 | Establish future inflows independently of the observed transaction sample                                                                             |
| Use actual expenses as baseline | Describes using the last 12 months of expenses                                           | Ground the starting spending assumption in recorded behavior; inclusion/exclusion details remain unverified                                           |
| Yearly living expenses          | Money input, change-over-time selector including Match inflation                         | Separate amount from escalation policy                                                                                                                |
| Yearly inflation rate           | Slider and percent input, explanatory help                                               | Make nominal versus real assumptions explicit                                                                                                         |
| Show future values in           | Today's dollars recommended; Future dollars alternative                                  | Controls display. UI says all entered amounts are in today's dollars                                                                                  |
| Expense withdrawal order        | Opens a nested sidebar with Back, Close sidebar and reorderable cash/investment accounts | Define funding sequence for expenses in retirement and other events; no reorder was saved                                                             |
| Split extra savings             | Change savings splits button and explanation of distributing surplus across accounts     | Define allocation of positive cash flow; nested editor not yet inspected                                                                              |

Opening nested withdrawal order changed the query from `sidebar=assumptions` to `sidebar=withdrawal-order`. Closing the sidebar returned to the scenario. Query strings also carry event editor state and the selected year. This is observed route behavior, not a claim about the application's internal state library.

### Events and autosave

The New event drawer visually exposes Income, Expense, Retire, Buy a home, Social Security, New job, Have a kid, Career break and Windfall. A Coming soon heading precedes Get married, Education and Emergency. Do not implement the latter as proven available editors.

Opening the Expense template **immediately created and saved a zero-dollar event**, without a separate create confirmation. The editor then exposed Exclude from forecast, More options, Close sidebar, name/icon/color, year, One-time/Recurring and an amount labeled in today's dollars. This is an important discovered persistence boundary: a template click is a write, not merely preview navigation. Recurring fields and exclusion semantics were not exercised.

The accidental inspection event was deleted after explicit user approval. More options → Delete event removed the editor and its extra timeline marker; the normal baseline view returned. No pre-existing event was deleted. Do not infer whether deletion has undo/recovery from this observation.

**Proposed for FlyBudget:** open a draft first and use an explicit Create action, or clearly label immediate creation with Undo. Show autosave/pending/error state for later edits. Changing birthday should be labeled as shared-profile scope before committing.

### Forecast calculation boundaries

Observed labels establish inputs and explanatory components, not exact formulas. A defensible independent model needs explicit conventions for periods, compounding, event order, inflation, income escalation, surplus allocation, withdrawal ordering, debt interest and taxes. For a real-value display, dividing a nominal value at time t by `(1 + inflation)^t` is a standard **proposed** convention, not recovered Monarch code. Validate any such formula with controlled synthetic scenarios before claiming parity.

Open questions include partial first years; one-time versus recurring timing; year-start versus year-end deposits; rates before/after retirement; insufficient funds; account depletion; multiple members; jurisdiction-specific tax and retirement treatment; life-expectancy endpoint; excluded-account treatment; comparison alignment; event collision order and zero/negative values. Australian superannuation must be independently designed rather than translating U.S. Social Security labels.

## Reusable interaction specification

For every remaining action capture: destination and prerequisites → trigger → modal/drawer/popover/navigation → fields/defaults → dependent fields → validation → save/cancel/autosave → persistence scope → resulting chart/list change → undo/recovery → keyboard/focus behavior → evidence ID. Mere presence of an action does not establish its outcome.

Recommended priorities for the remaining trial: Forecasting's remaining event editors and comparisons; transaction drawer/splits/rules/bulk edits; budget mode/rollover/propagation; recurring matching; goal funding provenance; connected investment calculations. Populate only a clearly disposable inspection scenario/account if explicitly authorized. Account linking, invitations and financial-data edits are not necessary for a first read-only pass.
