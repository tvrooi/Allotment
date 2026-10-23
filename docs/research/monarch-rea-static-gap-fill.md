# Monarch: shipped-code analysis and gap fill

22 October 2026, continuation of the Codex investigation (see [README](README.md)). Every earlier notebook was built from **UI observation** only. This pass adds the evidence type those notebooks lacked: **Monarch's own shipped JavaScript**, analyzed statically with REA. It also runs **committed live tests** on the synthetic account, which the user has now authorized for writes (the account exists only for this investigation).

The result settles several items that the earlier notebooks listed as "unknown" or "would need proprietary source". The most important is that Monarch's Forecasting projection is **not server-side**: it is a Monte Carlo engine that runs in the browser in a Web Worker, and its formulas are below.

Labels: **Shipped code** means read from the production bundle; **Live** means committed in the synthetic account and confirmed through the network payload. **Inferred** marks interpretation. Code identifiers below are minified names from one build and will change between releases.

## Evidence and artifact identity

| Artifact                                                                    | Bytes     | SHA-256 (prefix) | How obtained                                                                                                   |
| --------------------------------------------------------------------------- | --------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `static/js/main.8e12c39a.js`                                                | 5,667,143 | `b00feddd1ca2`   | REA scenario capture of `/login` (`ev_0b9dead9…`), then the signed-in page (`ev_a8ae5a06…`)                    |
| `static/js/8473.676c3b2e.js` (vendor)                                       | 5,034,719 | `ab8b8f22e74f`   | same                                                                                                           |
| `static/js/InAppRoutes.c881d682.chunk.js` (signed-in routes)                | 3,376,506 | `4a2fb64b566d`   | signed-in page inspection `ev_a8ae5a06…`, exported by `ev_ec488035…`                                           |
| `static/js/forecast.worker.bfd7a8dc.chunk.js` (Forecasting engine)          | 320,641   | `4b3e2842acb6`   | resolved from the inline webpack chunk map (`5292:"forecast.worker"`), captured `ev_ac15c44a…`, digest matched |
| Feature-flag payload `features.monarch.com/sdk/api/splitChanges` (Split.io) | 690,473   | n/a              | login-page capture; flag names only, not analyzed further                                                      |

REA JavaScript analysis of the main bundle: `ev_3b2fd79a1f8e…` (1,300 webpack modules, 1.33M AST nodes, no parse failures; semantic coverage partial by design). Nothing was executed. GraphQL documents were recovered from the precompiled `graphql-tag` ASTs by a non-executing literal-to-JSON converter, with **0 parse failures**. Raw captures and the extracted bundle stay outside the repository, in the session scratchpad, because the signed-in captures contain account identifiers.

## 1. Client API surface (shipped code)

The bundles contain **698 named GraphQL operations** (356 queries, 336 mutations, 6 subscriptions) and 147 fragments against `api.monarch.com/graphql`. This is effectively the full contract between the web client and the server. Approximate grouping by operation name:

| Domain                                              | Ops  | Domain                          | Ops |
| --------------------------------------------------- | ---- | ------------------------------- | --- |
| Household, auth, billing, referrals, employee tools | ~105 | Investments, holdings, tax lots | ~43 |
| Accounts, connections, snapshots, provider switch   | ~104 | Recurring                       | ~37 |
| Goals (save up, pay down, debt)                     | ~73  | Budget, rollover, flex          | ~33 |
| Transactions, splits, attachments, tags, rules      | ~80  | Cash flow, reports, tax prep    | ~31 |
| AI assistant, insights, Monarch Method              | ~48  | Forecasting, paychecks          | ~29 |
| Categories and merchants                            | ~45  | Retail sync and receipts        | ~29 |

The 6 subscriptions are all AI-assistant message streams (`OnMessageCreated`, `ArenaOnMessageCreated`, …). Nothing else is pushed in real time; every other screen polls or refetches.

Features visible in the API but not in Codex's notes: **Schedule C / tax-prep** category mapping and CSV (`InitScheduleCDefaultMappings`, `GetScheduleCLineItems`, `StartDownloadScheduleCSession`), **paychecks** with deductions and deposits (`CreatePaycheck`, `PaycheckDeductionFields`, 30+ deduction kinds such as `espp`, `healthcare_fsa`, `federal_income_tax`), **equity grants** (`CreateEquityAccountWithGrants`, FMV/409A), **data-provider switching** between Plaid/MX/Finicity with account mapping (`StartDataProviderSwitch`, `ConfirmDataProviderSwitchMappings`), **statement and balance-history upload parsing** with column mapping (`ParseUploadStatementSession`, `GetStatementParserColumns`), and **AI-generated reports** (`CreateAIReport`, `GenerateReportName`).

## 2. Gap fills, by Codex's open items

### Transactions → Split (was "draft canceled; rounding/constraints unknown")

**Live:** the synthetic REA MOCK Cafe $45.00 was split by percent 33/33/34 (evidence `ev_5ed4f95e…`). The request sent **amounts only**, never percentages:

```
updateTransactionSplit(input: {transactionId, splitData: [
  {merchantName, categoryId, amount: -14.85, hideFromReports: false, ownerUserId: null, businessEntityId: null, businessEntityIsUnassigned: true},
  {… amount: -14.85}, {… amount: -15.30}]})
```

The server returned three child transactions that **inherited the parent's notes**. In the register the parent disappears and its children are listed instead: the transaction count went from 5 to 7 while total spending stayed $280.

**Shipped code (percent → amount):**

1. Percent mode stores each split as a fraction rounded to 2 decimals (`Number((amount/total).toFixed(2))`), so the UI accepts only **whole percentages**. Live, `33.33` was redisplayed as `33`.
2. `cents = round(100 × |total|)`; each split gets `floor(cents × fraction) / 100`.
3. The leftover cents, if between 1 and 100, are distributed **one cent at a time, round-robin from the first split**. This step is skipped if any split is blank or if the leftover is over 100 cents.
4. Signs are re-applied from the parent's direction before sending.

**Validation messages (shipped code):** "Enter an amount"; "You must add at least two splits" (exactly one split is rejected; zero is allowed, which is the recombine path); "Your split must equal the original transaction amount" (exact equality in amount mode). Editing an existing split loads the children in **reverse order**. Rule-driven splits use the same form with merchant and category optional.

### Transactions → Edit multiple (was "one-row draft canceled; no bulk mutation")

**Live** (`ev_4f509930…`): Select all → Edit 7 → Hide = Show → Save opened a **confirmation dialog**: "Does this look right? … you will be applying the following changes to 7 transactions", listing each changed field (`Hide: Show`), with **Apply to all 7**. Before that, the drawer header lists the **affected accounts by name** ("2 accounts selected"), which answers Codex's multi-account question. The committed payload:

```
bulkUpdateTransactions(selectedTransactionIds: [], excludedTransactionIds: [], allSelected: true,
  expectedAffectedTransactionCount: 7, updates: {hide: false},
  filters: {transactionVisibility: "non_hidden_transactions_only"})  → {success: true, affectedCount: 7}
```

**Shipped code:**

- **Selection is a query, not a list.** "All" sends the current filters plus exclusions, and the server resolves the set.
- **`expectedAffectedTransactionCount`** is an optimistic-concurrency guard: the server can refuse if the filter now matches a different number of rows.
- `updates` contains **only changed fields**; "No change" is omitted (`no_change` sentinel). Hide and Recurring are three-state (No change / Hide / Show; No change / Mark as recurring / Not recurring). Notes `null` means "Remove notes". Review has an explicit "Unassign review" sentinel.
- Delete is a separate mutation with the same selection shape.
- "Mark all reviewed" from the summary uses the same mutation with `allSelected` and the page's filters.

### Rules (was "synthetic-only draft; never saved")

**Shipped code**: full model from `TransactionRuleFields` and the form schema:

- **Text criteria** (merchant, merchant name, original statement): operators **`eq` and `contains` only** (no regex, starts-with or not-contains). `merchantCriteriaUseOriginalStatement` switches matching to the raw bank text.
- **Amount criteria**: `eq | gt | lt | between` plus `isExpense` (direction is part of the amount condition). `between` requires `valueRange.lower < upper` ("Must include valueRange if operator is between").
- **Other criteria**: category IDs, account IDs, owner (user IDs or joint), business entity (IDs or unassigned).
- **Actions**: set merchant, set category, add tags, link savings goal, link legacy goal, set review status (`needs_review | reviewed`, where `needs_review` requires a reviewer), needs-review-by user or unassign, **send notification**, hide from reports, link to pay-down budget, set owner, set business entity, and **split** (percent fractions must sum to exactly 1, each 0–1; fixed amounts must add up to the amount criterion).
- A category action is required unless a merchant action is set and that merchant has a default category.
- The form default `applyToExistingTransactions: false` is a field on the rule input. Preview (`transactionRulePreview`) pages **30 results** at a time and returns the before/after per field.
- Rules carry `recentApplicationCount` and `lastAppliedAt` (usage telemetry in the UI). Reordering is a separate `UpdateRuleOrderMutation`, and there is a destructive "delete all rules".

FlyBudget's engine is already richer on text operators (regex, one-of, empty checks) and on condition logic (AND/OR). Monarch's additions are the **owner/business-entity criteria**, the **notification action** and the **expense flag on amount criteria**.

### Transactions → Filters (was "amount operators … not inspected")

**Shipped code:**

- The amount filter offers `equalTo | greaterThan | lessThan | between | debitsOnly | creditsOnly`. The server receives `absAmountGte/absAmountLte` plus `creditsOnly/debitsOnly`, so amount filters are on the **absolute value** and direction is a separate flag.
- The full server filter (`TransactionFilterOutput`) contains: accounts, categories, category groups, merchants, household merchants, uploaded statement, uncategorized, dates or a relative `timeframePeriod {unit, value, includeCurrent}`, hide-from-reports, split, notes, recurring, attachments, investment account, tags, untagged, imported-from-Mint, synced, needs-review (assigned, unassigned or by user), ids, excludeIds, flex spending, category type and pending.
- Saved filter sets exist (`TransactionFilterSetFields`). Sections combine with AND; values within a section combine with OR (inferred from the array-valued fields).

### Budget (was "Decade not captured; propagation and rollover not committed")

- **Decade view (live, `ev_ba26e995…`)**: 10 yearly columns (2026–2035) for Income, Expenses (Fixed/Flexible/Non-Monthly) and Contributions, ending with **Total Left**. The client requests a 12-year window (`GetJointPlanningData` 2025-01-01 → 2037-01-01). The URL keeps `?timeframe=yearly`, so **Decade is not deep-linkable**. The Save-up goal shows **$225 for 2026 versus $900 in later years**: a $75/month plan counts only the months remaining in the current year.
- **Edit scope (shipped code)**: every planned-amount edit carries its own `applyToFuture`, defaulting to the household's `budgetApplyToFutureMonthsDefault` (the Settings radio). Goal contribution rows **autosave on blur or Enter after a debounce** and send only rows whose amount or scope changed.
- **Rollover (shipped code)**: a category's rollover is a `BudgetRolloverPeriod {startMonth, endMonth, startingBalance, targetAmount, frequency, type}` with frequency `monthly | non_monthly | one_time`. That makes rollover a **dated period with a starting balance**, not a boolean flag. The Flexible bucket has its own group-level rollover settings, and `resetBudgetRollover` resets a period. Variability per category or group is `fixed | flexible | non_monthly`.
- **Budget systems**: `budgetSystem` is Flex or Category, initialized by `InitializeFlexBudget`. Recalculate is `RecalculateBudgetMutation` and reset is `ResetBudget`.

### Recurring (was "tolerance/partial/overdue/cancel boundaries")

**Shipped code:**

- Occurrence status is **`upcoming | paid | overdue | possibly_inactive | ended`** (`overdueSince` is stored).
- Credit-card statements are `paid | partially_paid | unpaid` (`MarkRecurringLiabilityStatementAsPaid`).
- Frequencies: `monthly`, `every_2_months` … `every_12_months`, `variable`, plus weekly-type values in the stream model.
- Detection explains failures with **`different_merchant | no_fitting_frequency | no_transactions | not_enough_groups | opposite_signs`**.
- `previewRecurrenceGroup(transactionIds)` returns per-transaction `skipReason`, which lets the UI explain why a transaction isn't part of a series.
- Groups support **merge** (with eligibility and candidate queries), link/unlink a single transaction, mark not recurring, approve/review a detected stream, and active/ended status.
- Recurring V2 is a rebuilt detector that runs alongside the old one; migration states such as `v2_detected_v1_dismissed_merchant` show it reconciling with V1.

### Goals and debt (was "Save to Budget uninspected; multi-debt strategies")

**Shipped code:**

- Debt pay-down is calculated **server-side** (`debtPaydownPlan(SavingsCalculatorInput)`). It returns principal, projected interest, total and debt-free date, both "as planned" and **adjusted** (with extra payments), plus a per-account chart. Strategies are **`avalanche | snowball | planned`**.
- **Save to Budget** sends the same calculator input plus `accountIdsToInclude/Exclude`, and the server writes the monthly budget amounts.
- Savings-goal events are typed `contribution | withdrawal | spending | transaction_adjustment | price_change | rebalance | migration`. That makes a goal's balance an **event ledger**, with reconciliation records linking spending transactions back to goals (`GoalReconciliationHistory`, `ReconcileExternalSpending`).

## 3. Forecasting engine (shipped code, previously "not recoverable")

`forecast.worker.bfd7a8dc.chunk.js` is a self-contained simulator. A pool of **1–4 workers** (`hardwareConcurrency − 1`, clamped to 1–4) splits N paths evenly, with a 30 s no-progress watchdog and progress messages every 50 paths. A single deterministic run uses the same engine with Monte Carlo off. Defaults: start year = this year, **50 projection years**, **3% inflation**, future-dollar display.

### Yearly loop (`run()`)

For each year from 0 to `projectionYears`:

1. **Event effects** come from a precomputed table, with two overlap rules (this answers Codex's question about how overlapping reductions combine):
   - _Per income source_: reductions targeting the same income event are applied in event start-year order, and their total is **capped at that source's income**. The first event consumes first; later ones get the remainder. Reductions don't multiply.
   - _Expense reductions_ (such as Retirement's spending multiplier, or a paid-off loan) are capped at the total positive expenses.
2. `cashflow = income − expenses`.
3. **Liabilities** process the year (interest and payments); payments reduce cash flow.
4. **Paycheck contributions** to retirement accounts are added; they stop once that owner's retirement starts, or during a career break.
5. **Surplus**: first repays any accumulated _unfunded expenses_, then runs the ordered savings splits (below); the rest goes to the system **Extra Savings** account.
   **Deficit**: withdraws in order (below); anything still uncovered goes into the **unfunded expenses** account, which drives the "unfunded expenses" warning.
6. **Then** assets grow, so deposits made this year start growing next year.
7. A snapshot records net worth (sum of active balances), income, expenses, withdrawals, net cash flow and the cumulative inflation factor.

### Savings splits (confirms and extends Codex's 50/50 sample)

The allocation is a sequential reduce over the ordered list:

- `percent` → `remaining × pct/100`.
- `dollarAmount` → `min(amount inflated to that year, remaining)`, so fixed-dollar entries are **caps that grow with inflation**.
- Once `remaining ≤ 0`, later accounts get 0.
- Only included cash or taxable-brokerage accounts are eligible.
- A blank allocation contributes 0.

### Withdrawal order and tax

- **Order**: Extra Savings first, then **cash → taxable investments → tax-deferred (Traditional) → tax-free (Roth)**, then any custom order.
- **Timing**: each account has a withdrawal timing of `always` (UI "Anytime"), `starting_year` or `never`.
- **Gross-up**: `gross = need / (1 − (withdrawalTaxRate × taxablePercent + penalty))`, then `withdraw = min(gross, balance)`, and `net = gross − tax − penalty`.
- **Early-withdrawal penalties** (US-specific):
  - 10% before age **59.5** for 401k, 403b, 457b, IRA, Roth, SEP and SIMPLE accounts.
  - 20% before **65** for an HSA.
  - In the birthday year the balance is split pro rata into penalty-free and penalized parts.
  - No penalty in the account's own starting year.
  - A missing birthday or shared ownership blocks the calculation with an alert.

### Growth and Monte Carlo

- **Defaults** (rate, volatility):

  | Account class                                  | Default rate | Default volatility |
  | ---------------------------------------------- | ------------ | ------------------ |
  | Cash                                           | 2%           | 0                  |
  | Taxable, tax-deferred and tax-free investments | 7%           | 16                 |
  | Real estate                                    | 3%           | 10                 |
  | Vehicles                                       | −15%         | 0                  |
  | Other assets                                   | 0%           | 0                  |
  | Liabilities (default interest)                 | 5%           | 0                  |

- **Random returns**: lognormal, with `σ = sqrt(ln((1 + sqrt(1 + 4n²)) / 2))` where `n = vol/100 / (1 + mean/100)`, and `rate = 100 × (exp(ln(1 + mean) + σz) − 1)`.
- **Shocks**:
  - One shared _market_ shock per year for all investment accounts.
  - One shared _real-estate_ shock.
  - A per-account shock for everything else (seeded by an FNV-1a hash of the account id).
  - Accounts pinned flat skip randomness.
- **Inflation**: stochastic AR(1) with persistence 0.5 (clamped 0–0.95), default volatility 2, and correlation −0.2 with the market shock.
- **PRNG**: SplitMix64 with Box-Muller normals. The seed comes from `(runSeed, pathIndex)`, so runs are **reproducible**.
- **Success** means a path never hits `outOfMoneyYear` (net worth ≤ 0 after having been positive) **and** ends with positive net worth.
- **Fan chart**: percentile bands **P5/P40/P50/P60/P95** with linear interpolation, in nominal or today's dollars.
- Monte Carlo ("Chance of success") sits behind an experiment flag and a "Run simulation" walkthrough.

### Previously unexplained sample values, now explained

- **Comparison %** (`BT(active, compare)`) is `|active − compare| / active`: the denominator is the **active** scenario, as Codex suspected. The percentage is hidden when the active value is ≤ 0, and the delta shows "No change" when it is ~0.
- **Loan "yearly expense reduction 1,747.57"**: 12 × $150 planned payment = $1,800, deflated one year at 3% → 1,800 / 1.03 = 1,747.57. The pay-off annotation uses `12 × monthly payment` (only when `reduceExpensesForPaidOffDebt` is on) shown in today's dollars.
- **Escalation modes**: `inflation` | `increase` (default **2%**) | `decrease` (default **2%**) | none, compounding yearly from the event's start year.
- **Scenario saves** use **optimistic versioning**: each section (scenario, events, accounts, participants, withdrawal rules, allocation rules) is saved with `expectedVersion`, a `VERSION_CONFLICT` error comes back on mismatch, and the client refetches. That explains why opening a template "immediately saves".

## 4. What this changes for FlyBudget

These are recommendations, not code changes. They refine the [implementation backlog](monarch-implementation-backlog.md):

1. **Bulk edit**: adopt Monarch's three safety pieces, all cheap on FlyBudget's server:
   - selection as filter plus exclusions,
   - an `expectedCount` guard,
   - a confirmation that lists the changed fields and affected accounts.
     FlyBudget's undo stays an advantage.
2. **Splits**: FlyBudget's `computeSplitAmounts` already guarantees exact sums, and Monarch's cent-by-cent round-robin from the first split is no improvement on it. Keep FlyBudget's rule, and don't restrict percentages to whole numbers as Monarch does.
3. **Forecast**: FlyBudget's 30–730-day cash forecast and Monarch's 50-year net-worth simulator answer different questions. If FlyBudget adds long-range planning:
   - copy the **structure**: yearly loop ordering, capped overlapping effects, ordered surplus and withdrawal rules, an explicit unfunded-expenses bucket;
   - not the US-specific constants (59.5 penalty, Social Security); Australian super preservation age and tax rules differ;
   - keep FlyBudget's rules: pure module, deterministic seed, no clock access.
4. **Rollover as dated periods** with a starting balance fits FlyBudget's carry-over math better than a per-category boolean, and keeps history intact when rollover is switched on mid-year.
5. **Recurring explanations**: Monarch's `skipReason` / detection-failure enum is a ready-made vocabulary for FlyBudget's `scheduleDiscovery.ts` to explain why a payee wasn't detected.

## 5. Still unknown

- Server-side logic: debt avalanche/snowball math, recurring detection tolerances, rule application order and conflict handling (both now confirmed server-side), and budget rollover arithmetic.
- The worker's account classes' detailed `processYear` for property and mortgage events. The amortization in [the forecasting notebook](monarch-forecasting-reconstruction.md) matches a standard level-payment formula, but the worker's home-event code was not read line by line.
- The default Monte Carlo path count (`mcNumPaths` comes from settings; not traced).
- Split.io feature-flag semantics (690 KB of flag definitions captured but not analyzed).
- Mobile apps (not in scope).

## Synthetic inventory changes in this pass

In addition to the retained items in the [action catalog](monarch-action-catalog.md#current-retained-synthetic-inventory):

- **REA MOCK Cafe $45.00** (9 Oct 2026) is now **split into three children** of $14.85, $14.85 and $15.30, all Restaurants & Bars.
- **Bulk edit** set Hide = Show on all 7 visible transactions. They were already shown, so nothing changed visibly.
- No rules, budget amounts, goals or forecast events were changed in this pass.
