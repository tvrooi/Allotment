# Long-term forecast: design note

Status: **design only (step 1 of 5). Nothing is built.** This note is for the owner's review before step 2.
Every default below is an **assumption you can change**, and the UI must show it next to the input
(for example "Super guarantee rate: 12% — assumption, default 12%"). A forecast is a projection, not a
promise.

Sources: Monarch's recovered engine (`docs/research/monarch-rea-static-gap-fill.md` §3), its live UI
(`docs/research/monarch-forecasting-reconstruction.md`), `docs/PHASE-8-PROPOSALS.md` §5,
`docs/FORECASTS.md`, and `docs/investigations/2026-10-20-australian-budgeting.md` §4. We copy Monarch's
**structure** (yearly loop order, capped overlapping reductions, ordered splits, an unfunded-spending bucket),
not its US constants.

## 1. What it is, and what it is not

A yearly, decades-long projection of **net worth** from today's real balances to an end age, with life
events, named scenarios and a scenario comparison. It is read-only: it never writes transactions, schedules,
goals, assignments or account balances. Deleting a plan deletes only the plan.

It is separate from the existing 30-day to 2-year **cash runway**, which stays as the second tab on the
Forecast page. The long-term view becomes the default tab (step 4). The runway engine is untouched.

**Excluded (v1):** income tax (income is take-home pay), capital gains tax, tax on investment or super
earnings, the Age Pension means test, super minimum drawdown rules, partners or a second person, HECS/HELP
indexation, state stamp-duty tables, selling a property, refinancing, and any US feature (59½ penalty, Social
Security, Roth/Traditional, HSA).

## 2. Units, rounding and the pure module

- Module: `server/src/services/longTermForecast.ts`. **No database, no clock, no I/O.** It receives the plan
  and today's figures (including `startYear` and `startAge`, supplied by the caller) and returns a
  year-by-year result. The in-browser demo runs the same code. A test fails if the file imports `db` or
  reads `Date`/`Math.random`.
- Money is **integer cents**. Rates are **integer basis points** (1 bp = 0.01%; 6.5% = 650). Inflation
  indexes are integers in parts per billion.
- **One rounding function**, `mulDiv(a, b, c)`: computes `a × b ÷ c` with `BigInt` (no float, no overflow)
  and rounds **half away from zero**. Every rate application goes through it, once per quantity. These are
  the **only** places that round: `mulDiv` itself; the level-payment formula (§7), done exactly in `BigInt`
  and rounded once; and the today's-dollars display apportionment (§5), which is display-only. No floats
  touch money. Chained quantities are separate exact rows (for example super: contribution, then tax as
  `mulDiv(contribution, taxBps, 10000)`, then net = contribution − tax). A zero denominator is guarded.
- **Sign convention:** assets are positive and loans are stored as negative balances (as in
  `accountTypes.ts`). Net worth = Σ asset balances + Σ loan balances (negative) − unfunded spending.
- Because each flow is rounded once where it is created and every balance is the integer sum of flows,
  **the parts of a year add up to the cent by construction**. A test asserts
  `closing = opening + Σ parts` for every year of generated plans, including home purchases, pay-offs, Age Pension and deficits.

## 3. Time

- Year 0 is **today's snapshot**. Plan year _k_ (k ≥ 1) is the 12 months starting today, labelled by the
  calendar year it starts in (`startYear + k − 1`) and by age (`startAge + k − 1` at its start). There is
  no partial first year.
- An event dated by year fires in the plan year with that label. An event dated by age fires in the plan
  year whose starting age equals it. An interval of _n_ years covers plan years `start … start + n − 1`
  (start inclusive, end exclusive).
- All flows within a plan year are treated as **end-of-year** (no intra-year timing), except loan repayments,
  which are simulated monthly (§7), and growth, whose base is the balance after the year's withdrawals but
  before its deposits (§6 step 6). That is a stated simplification: it lets money earn a full year on the
  opening balance minus withdrawals, but never grows money that was withdrawn.
- End age default **95** (assumption).

## 4. Starting point

**Accounts (today's real balances).** Every open account, on or off budget, with its current balance. Each
gets a class and a growth assumption:

| Class       | Account types                                                                    | Default growth (assumption) | Withdrawable                                  |
| ----------- | -------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------- |
| Cash        | checking, savings, cash                                                          | 2.0%                        | yes                                           |
| Investments | investment, crypto                                                               | 7.0%                        | yes                                           |
| Super       | retirement (every one is treated as super)                                       | 6.5%                        | only after retirement + preservation age (§8) |
| Property    | real_estate                                                                      | 3.0%                        | no (no selling in v1)                         |
| Vehicles    | vehicle                                                                          | −15.0%                      | no                                            |
| Other       | valuables, other_asset                                                           | 0.0%                        | no                                            |
| Liabilities | credit, line_of_credit, mortgage, auto_loan, student_loan, loan, other_liability | own rate, §7                | n/a                                           |

Per-account overrides of class and growth are stored in the plan. Investment accounts use their **balance**,
not holdings. A system **Extra Savings** account (opening 0, cash growth) collects unallocated surplus.
Defaults are Monarch's where Monarch had one, except super (a net-of-fees figure for you to confirm) and
inflation below. Please confirm or replace each.

**Income and spending (a starting point you can override).**

- Income: annual take-home from active payday plans (paydays × expected take-home); with no plan, pending
  scheduled income in income categories. Same either/or rule as the cash runway, never both.
- Spending: trailing-12-month net average of expense-category spending (transfers excluded, refunds net).
- **Double-count guard:** repayments on loans the plan models are transfers in FlyBudget and so are not
  in spending. The UI shows the spending figure and warns when a category looks like loan or mortgage
  repayments, so you can remove it.
- Both are entered in **today's dollars** and rise with inflation by default (§5). Each can instead use a fixed
  growth rate or none.

## 5. Inflation and the dollars toggle

Inflation is one plan assumption, default **2.5%** (assumption; midpoint of the RBA target band).
Index<sub>k</sub> is computed iteratively as `mulDiv(index<sub>k−1</sub>, 10000 + bps, 10000)` from 10⁹.

The engine **always computes in future (nominal) dollars**. "Today's dollars" is a display transform that
divides by the year's index. Year 1 deflates by one year of inflation. In the breakdown, the opening balance is
deflated by index _k−1_ and parts and closing by index _k_, so year _k_'s opening equals year _k−1_'s
closing. To keep the cent-exact promise there, each part is deflated with largest-remainder rounding so the parts equal the deflated total, plus an explicit row
**"Inflation on opening balance"** that carries the rest. The toggle never changes the maths.

Amounts you enter "in today's dollars" are inflated to their event year; fixed-dollar split caps likewise.

## 6. The yearly order (fixed)

For each plan year, in this order. This is the contract the tests enforce.

1. **Events.** Resolve which events are active. Compute event effects per §6.1. One-off amounts, loan
   pay-offs and home-purchase costs for the year are produced here.
2. **Cash flow.** `cashflow = income − spending`, using the capped reductions of §6.1 and escalated
   amounts, plus recurring and one-off event cash flows and Age Pension if due.
3. **Liabilities.** Each loan runs 12 monthly steps (§7). Total payments reduce cash flow. Interest and
   principal are recorded separately.
4. **Super contributions.** Employer contributions on the salary that remains after reductions (§8) go
   straight into super, after contributions tax. They are not part of take-home cash flow.
5. **Surplus or deficit.** Net cash flow after loan payments:
   - **Surplus:** first repays accumulated **unfunded spending**; the rest runs the ordered **savings
     splits** (§9); anything left goes to Extra Savings.
   - **Deficit:** withdraw in the set order (§10); any amount still uncovered is added to the **unfunded
     spending** balance.
6. **Growth.** Each growing account earns `rate × base`, where **base = opening balance − this year's
   withdrawals (floored at 0)**. Deposits, contributions and a property bought this year start growing next
   year. Liabilities do not use this step.
7. **Snapshot.** Closing balance per account and class, net worth, and the explanation rows of §11.

Net worth = Σ asset balances − Σ loan balances − unfunded spending balance.

### 6.1 Overlapping reductions: the combination rule

Written before coding, as asked.

**Income.** The baseline salary and every income event (new job, recurring income) are separate _income
sources_, each with an annual amount for the year. Events that reduce income (new job, career break,
retirement) carry a **per-source reduction percentage**, 0–100%.

For each source, take the active reducing events in **start order**: each event's start is converted
to a plan-year index (an age becomes the plan year in which that age is reached), ties broken by the
event's stored `position`. For each:

```
reduction_i = min(remaining, mulDiv(source_income, pct_i, 10000))
remaining  -= reduction_i
```

`remaining` starts at the source's income. So total reduction **can never exceed the source's income**, the
first event consumes first, later ones get what is left, and reductions are **added, never multiplied**.
Example: income 100,000, career break 60% then retirement 60% → 60,000 then min(40,000, 60,000) = 40,000;
total 100,000, income 0.

**Spending.** Events carry a **spending multiplier** (retirement, career break; 100% = same). Each is a
reduction of the _baseline_ spending: `mulDiv(baseline, 10000 − m_i, 10000)`, applied in start order and
capped at the remaining positive spending. The base is the escalated baseline spending only, not event
expenses. A multiplier above 100% is an addition, uncapped, and does not raise the cap for later
reductions. Example: baseline 100,000; career break 50% then retirement 80% → reductions 50,000 and
min(50,000, 20,000) = 20,000; spending 30,000 (not 40,000). A fixed-amount reduction such as replaced rent
sits in the same start-ordered list. A new-job event cannot reduce its own income source. Paid-off
or replaced items (rent replaced by a home, a loan's repayments after it ends when you flagged them as in
spending) are reductions in the same list, with the same cap.

**Super follows income.** Employer super is paid on the salary source's gross salary × (its remaining
income ÷ its original income), so a career break or retirement stops contributions in proportion.

## 7. Loans

Today's loan accounts need rate and repayment data, which does not exist yet. Added **additively** as a new
table `account_loan_details` (account id, annual rate in bps, monthly repayment in cents, optional term in
months), not as columns on `accounts`. A liability account with no details stays flat, with no payments, and
the plan shows a warning ("no repayment data").

- Monthly step: `interest = mulDiv(balance, rate_bps, 12 × 10000)`; `payment = min(repayment,
balance + interest)`; `balance = balance + interest − payment`. When a term is set, **month _n_ pays the whole balance plus
  interest** (the final payment absorbs rounding drift); otherwise the final payment shrinks when the
  balance is smaller than the repayment.
- The standard formula, for tests and for setting a new loan's repayment: `P = L·r / (1 − (1 + r)⁻ⁿ)`,
  `r` = annual rate ÷ 12, `n` = months, computed exactly with integers as `L·bps·(120000+bps)ⁿ ÷ (120000·((120000+bps)ⁿ − 120000ⁿ))` and rounded
  once to cents. Monarch's sample (400,000 − 80,000 at 6.5%,
  360 months → 2,022.62) is a test. A test checks the balance is zero at month _n_ and that the final payment differs from the level
  payment only by accumulated rounding (a few dollars at most, never a stray month 361).
- A yearly row records: payments (cash out), interest, principal (liability falls).

## 8. Super (its own class)

| Assumption                      | Default            | Note                                                                                                                                  |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Super guarantee rate            | 12%                | ATO rate from 1 July 2025. Editable.                                                                                                  |
| Salary super is paid on (gross) | none, you enter it | Income is take-home; we do not gross it up. No figure means no employer contributions.                                                |
| Contributions tax               | 15%                | One editable rate. Net into fund = contribution × (1 − rate).                                                                         |
| Preservation age                | 60                 | Entered by you; 60 applies from birth on 1 July 1964.                                                                                 |
| Super caps                      | not modelled       | SG applies to ordinary time earnings up to the maximum contribution base; the concessional cap and Division 293 tax are not modelled. |
| Super earnings tax              | not modelled       | Use a lower growth rate if you want it reflected.                                                                                     |

- Contributions go into the super class and are **not spendable income**. They stop with the salary (§6.1).
- **Locked until the retirement event, and at or after the preservation age.** Before either, super is
  excluded from withdrawals even if cash runs out. This is stricter than the real rules (access at 65 without
  retiring, transition to retirement); it is a deliberate, conservative simplification, stated in the UI.
- After both conditions, super takes part in withdrawals in its place in the order. Withdrawals are
  tax-free (income tax is out of scope). No minimum drawdown rule is modelled.
- **Age Pension (optional):** a yearly amount in today's dollars that you type, starting at an age you choose
  (default 67), indexed with inflation. Off by default. It is not calculated and has no means test.
- Retirement before the preservation age is allowed and shows the bridging years drawing on cash and
  investments (and the unfunded warning if they run out).

## 9. Savings splits

Surplus goes to accounts in **an order you choose**, then the remainder to Extra Savings. A sequential
reduce over the ordered list:

- **Percent:** `portion = mulDiv(remaining, bps, 10000)` of **what is left, not of the original surplus**.
- **Fixed amount:** `min(amount inflated to that year, remaining)`. Fixed amounts are caps that rise with
  inflation.
- Once `remaining ≤ 0`, later entries get 0. A blank entry gets 0. Portions never exceed `remaining`, so
  the splits plus Extra Savings equal the surplus exactly.
- Eligible destinations: cash and investment accounts (and Extra Savings, which is always last). Super is
  not a split target in v1.

**Worked example (shown in the UI, from Monarch's verified sample):** surplus 10,000; account A 50% → 5,000
(remaining 5,000); account B 50% → 2,500 (remaining 2,500); Extra Savings 2,500. With A as a fixed 3,000 cap
and B 50%: A 3,000, B 3,500, Extra Savings 3,500. The UI says "percent of what's left".

## 10. Shortfalls and withdrawals

When the year's net cash flow is negative, cover it in this default order, which you can reorder (super
stays locked by §8 regardless of its position):

1. Extra Savings → 2. cash → 3. investments → 4. super (if unlocked).

Each account gives `min(need remaining, max(0, balance))`; an overdrawn account gives nothing. Property, vehicles and other assets never fund spending.
There is no gross-up (no tax). If need remains after every unlocked account is empty, it is added to the
**unfunded spending** balance, which counts against net worth, carries no interest, and is repaid first
from later surplus. The result reports the **first year** unfunded spending appears, and the UI shows an
"unfunded spending" warning with that year and age.

## 11. Explaining a year

Clicking a year shows an exact bridge. Every row is an integer; the table's own total row is asserted equal
to the change in net worth.

```
Opening net worth
 + Income (each source)
 + Age Pension
 + Event cash flows (one row per event, signed; a home purchase's deposit, duty, costs and running costs)
 − Spending
 − Loan payments (cash out; a pay-off lump appears here)
 + Principal repaid (the debt falls by this, including a pay-off; net effect of payments is −interest)
 + Assets and loans opened by events (property +price, mortgage −loan: nets to +deposit, which
   offsets the deposit counted in event cash flows, so a purchase's net effect is −(duty + costs))
 + Super employer contributions (after contributions tax)
 + Growth (by class)
= Closing net worth
```

There is **no unfunded-spending row**: in a deficit year, withdrawals and new unfunded spending together
equal the deficit, and net worth already falls by that cash flow; repaying unfunded spending from surplus
is a move. Withdrawals, savings allocation, unfunded drawn and unfunded repaid are shown as **moves**
between accounts (they change the account mix, not net worth), with amounts per account. A generated test
asserts the table total equals the change in net worth.

## 12. Life events

**Timing of balance-creating events:** the event creates its balances in step 1 (a property at the inflated
price, a mortgage at price − deposit). Its cash (deposit, duty, costs, a pay-off lump) is a step-2 event
cash flow and is funded through step 5, so shortfalls are honest. A new mortgage makes **no payments and
accrues no interest in its opening year** (the property also starts growing next year); repayments begin
the following year. A pay-off's default amount is the loan's **opening balance for that year**, and the loan
accrues no interest that year.

Each event has its own editor, a name and an include/exclude switch. Dates are a year or an age.
Escalation, where offered, is one of: none, inflation, or a fixed rate (default 2%, may be negative), compounding yearly
from the start year.

| Event                           | Fields                                                                                                                                                                                                                                                                                                                               | Effect                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Buy a home**                  | year/age; price (today's dollars); deposit (amount or %); loan rate (default 6.0%) and term (default 30 years); stamp duty and costs (amount you enter, no state table); yearly council and water rates and insurance (amounts, today's dollars, inflation-escalated); current rent per month (optional) and a "replace rent" switch | Opens a property account at the inflated price and a mortgage loan account. Deposit, duty and costs are one-off expenses in the purchase year, funded through the normal cash flow and withdrawal order (so shortfalls are honest). Repayment = standard formula (editable). Running costs are expenses. "Replace rent" removes the rent as a capped spending reduction from the purchase year. Property grows from next year. |
| **New job**                     | year/age; take-home per year; escalation; signing bonus; gross salary for super; per-source income reduction (default 100% of baseline salary)                                                                                                                                                                                       | New income source; reduces existing sources via §6.1.                                                                                                                                                                                                                                                                                                                                                                          |
| **Career break**                | start; duration in years; spending multiplier (default 100%); per-source income reduction (default 100% of baseline)                                                                                                                                                                                                                 | Capped reductions; super stops in proportion.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Child**                       | start; years of costs; yearly cost; upfront cost; escalation                                                                                                                                                                                                                                                                         | Expenses. Help text: remove existing child costs from baseline spending to avoid double counting.                                                                                                                                                                                                                                                                                                                              |
| **One-off windfall or expense** | year/age; signed amount; today's dollars or nominal                                                                                                                                                                                                                                                                                  | One-off flow.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Recurring income or expense** | start; optional end; repeat every _n_ years; amount; escalation                                                                                                                                                                                                                                                                      | Recurring flow.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Retirement**                  | year/age; spending multiplier (default 100%); per-source reduction (default 100% of work income); optional Age Pension (§8)                                                                                                                                                                                                          | Stops work income and employer super; unlocks super subject to preservation age. At most one per plan.                                                                                                                                                                                                                                                                                                                         |
| **Pay off a loan**              | year/age; a loan account; amount (default full balance at that point)                                                                                                                                                                                                                                                                | Lump sum paid from cash flow and the withdrawal order in the events step. If the loan's repayments are flagged as included in spending, they are removed afterwards as a capped reduction.                                                                                                                                                                                                                                     |

## 13. Scenarios and comparison

Several named scenarios (case-insensitive unique names): create, duplicate, rename, delete. Compare one
scenario (**active**) against another (**reference**):

- Two lines on one chart, event markers for both, paired key figures: net worth at retirement age, at end
  age, lowest net worth, super at preservation age, first unfunded year.
- **Difference in money** = active − reference.
- **Percent difference** = `(active − reference) ÷ reference`, as **"change relative to the reference
  plan"**. The UI labels the denominator in words next to the number. It is shown as "n/a" when the
  reference value is 0 or less, and only for money figures (not for "first unfunded year", where the
  difference is in years). This deliberately differs from Monarch, which divides by the active value
  without saying so.
- Today's/future dollars toggle applies to both.

## 14. Storage, drafts, backups, access

**Tables (all new, additive):**

| Table                           | Holds                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `long_term_plans`               | id, name (unique, NOCASE), `version`, settings JSON (inflation, end age, ages, SG, tax and pension assumptions), created/updated |
| `long_term_events`              | id, plan id (cascade), kind, position, enabled, parameters JSON (validated by the same schema as the API)                        |
| `long_term_account_assumptions` | plan id, account id, class, growth bps                                                                                           |
| `long_term_splits`              | plan id, position, destination account, mode (percent/fixed), bps or cents                                                       |
| `account_loan_details`          | account id, rate bps, monthly repayment, optional term                                                                           |

A plan saves as **one unit** in a single transaction with `expectedVersion`; a stale version returns 409
with the current copy (as `docs/FORECASTS.md` describes), and the client offers Use theirs / Keep mine (and Save as new when the plan was deleted). One version per plan (not per section as in Monarch) avoids partial saves. Limits: 20 plans, 50
events per plan.

**Drafts.** Opening an event editor creates nothing and saves nothing. The event lives in client state until
**Create**; editing an existing event is also a draft until Save. (This deliberately differs from
Monarch, whose templates save on open.) The chart does **not** preview an unsaved draft. An incomplete draft shows what is missing and Create stays
disabled; a complete one can show a preview line only if the pure module runs on the client, which the
read-only GET cannot do for an unsaved draft. Preview is a step-4 decision.

**Ledger safety.** The plan routes import no write helpers for transactions, schedules, goals, assignments
or balances; a test asserts the ledger tables are unchanged after plan create, edit, run and delete.

**Backups.** Backup format 15 becomes 16 with the long-term tables (see §18). Restoring a format ≤ 15 backup leaves the new
tables empty and everything else unchanged (tested), as format 13 → 14 did.

**Read-only access.** `/forecast` is already on the read-only allowlist as a GET prefix. Plans and results
will live under `GET /api/forecast/long-term/…`, so a token can read them and nothing else; an access-token
test proves every non-GET route under it is refused. The result is a GET so no POST-style compute is needed.
Optional read-only MCP tools for plans and results are added in step 3 only if they stay read-only.

**Mock data only** in tests and the demo.

## 15. Monte Carlo (step 5, later)

Designed now so the engine needs no change: the growth step takes a `returnFor(year, class, accountId)`
provider, and the deterministic run is the provider that returns the fixed assumption.

- Seeded **SplitMix64** with Box-Muller normals; seed from `(runSeed, pathIndex)`. The same seed always
  gives the same result. The seed is stored with the run.
- Lognormal returns with volatility per class (defaults: investments and super 16%, property 10%, others
  0); one shared market shock per year for investments and super, one for property.
- **Chance of success** = share of paths that never have unfunded spending and end with positive net
  worth. Band = P5, P25, P50, P75, P95 per year (the percentile set is for you to choose; Monarch uses
  P5/P40/P50/P60/P95). Path count and run in a Web Worker in the browser. Inflation stays fixed in v1.

## 16. Delivery and verification

1. **This note**, reviewed and accepted by the owner.
2. Loan details and the deterministic engine. Tests: zero-growth, zero-inflation plan equals the plain sum of
   its flows; amortisation matches the standard formula; overlapping reductions are capped; splits are
   sequential; shortfall order is respected; the same input gives the same output; `closing = opening + Σ
parts` over generated plans; no `db`/clock imports.
3. Storage, API, backups, read-only access.
4. UI: default long-term tab, event editors with drafts, comparison, year breakdown, splits, dollars toggle,
   phone layout, browser tests.
5. Monte Carlo.

Each step is one PR with `npm run release:prepare` and a CHANGELOG entry where the app changes. This
documentation-only PR does not need a release.

## 17. Decisions for the owner

1. **One person only** in v1 (partner is excluded). OK?
2. **Plan years start today** (no partial first year), end age 95. OK?
3. **Growth applies to the balance after withdrawals but before this year's deposits.** Monarch's
   description says deposits start growing next year; this is the cent-exact way to say it without growth
   appearing on money that was withdrawn.
4. **Defaults:** cash 2%, investments 7%, super 6.5%, property 3%, vehicles −15%, inflation 2.5%, SG 12%,
   contributions tax 15%, preservation age 60, Age Pension from 67, mortgage 6.0% over 30 years. Which should
   change?
5. **Every `retirement` account is super.** Do you want a per-account switch for non-super retirement
   accounts?
6. **Super locks until retirement and preservation age**, though the real rules also allow access at 65.
   Keep the stricter rule?
7. **Spending multiplier or per-source reduction on events** are given as the only retirement effects; no
   separate healthcare allowance (Monarch had one in the US).
8. **Gross salary for super** is entered by you since income is take-home. Prefill it from payday plans if
   those store gross pay? (Not checked here.)
9. Percentile band set for step 5.

## 18. Clarifications settled in step 2

Decisions made while building the engine. They refine the sections above; where they differ, this section wins.

- **Escalation.** Amounts are entered in today's dollars and first inflated to their start year. Then
  `inflation` keeps them level in real terms, `none` holds that start-year amount flat in nominal terms, and
  `rate` compounds it yearly from the start year (negative allowed). The salary and baseline spending start in
  plan year 1. Year 1 is inflated by one year, as in §5.
- **Income sources** are the salary, each new job, and each recurring event with a positive amount. A
  recurring source pays only in its occurrence years. A recurring amount below zero is an expense and cannot
  be reduced. Signing bonuses are event cash flows and cannot be reduced.
- **Super follows income** by running the §6.1 rule on a notional 10,000 (basis points), so the fraction of
  salary that remains is exact even when take-home is zero. Employer super is
  `gross × remainingBps × guaranteeBps ÷ 10000²` rounded once (`mulDiv2`), tax is its own `mulDiv`, and net is
  contribution − tax. Rate escalation likewise rounds once. Contributions go to the first super account, or to a system "Super (new contributions)"
  account when you have none.
- **No "repayments in spending" flag (deferred).** Repayments on modelled loans are not in baseline spending
  (§4), and the UI warns on categories that look like repayments. A pay-off just clears the loan; it does
  not shrink spending afterwards. This replaces the sentence in the pay-off row of §12.
- **Partial pay-offs** reduce the balance in step 1, and the rest accrues interest that year as normal.
- **Limits** keep a century of compounding inside safe integers: yearly rates at most 15%, loan rates at most
  100%, spending multipliers at most 500%. Anything larger, or an overflow, is a clear error, never a crash.
  Generated ids (`<event>:property`, `:mortgage`, `:bonus`) are reserved. A blank split entry gets 0.
- **Warnings** also cover events dated after the plan ends, and loans whose repayment does not cover their
  interest or that have a term but no repayment (a balloon).
- **Escalation, to confirm:** `none` means flat at the start-year amount, which is the entered figure inflated
  to that year, not the entered figure itself. If you would rather `none` mean "my figure, flat", say so.
- **Loans:** a pay-off lump is paid in step 1 and counted in both "Loan payments" and "Principal repaid". A new
  mortgage makes no payments in its opening year, and its term counts from the next year. A loan with a term
  pays the whole balance in its last month.
- **Events dated before today:** a home, one-off or pay-off is ignored with a warning. Ongoing events
  (a retirement, job, child or break already under way) still apply.
- **Withdrawal order:** accounts you list come first, then the default order (Extra savings, cash,
  investments, unlocked super). Overdrawn accounts give nothing.
- **Horizon:** `endAge − startAge` plan years; year 0 is today's snapshot. At most 100 years.
- **Backups:** the format is now 15 (up.29), so the long-term tables arrive as **format 16** in step 3.
  `account_loan_details` was added in step 2 with no way to write to it yet, so no backup is affected.
- **Read-only access:** `main` now also has "read and categorise" tokens. Step 3 must prove those tokens
  cannot write plans either.
