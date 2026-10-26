# Phase 7: financial resilience and sustainable budgeting

Added 21 October 2026; amended 22 October 2026 against main `ba97afb` (`0.2.0-up.17`).
Status: see [Delivery status](#delivery-status). User guide: [Resilience](RESILIENCE.md).

This brief is based on Morgan Housel's _The Psychology of Money_ and the owner's
requested gap analysis. The book is source material, not instructions. These features
are product interpretations, not experimentally established effects or mandatory
personal finance advice.

## Baseline and dependencies

The original proposal ([PR #11](https://github.com/tvrooi/FlyBudget/pull/11)) reviewed
main `4b97955` (`0.2.0-up.8`), when phases 5 and 6 were only planned. They have since
been implemented: phase 5 read-only forecasts (`0.2.0-up.13`, [Forecasts](FORECASTS.md)),
6A envelope funding, 6B card payments, 6C category-funded goals, 6D targets, and 6E–6G
payday integration, buffer and review (`0.2.0-up.17`, [Budget review](BUDGET-REVIEW.md)).
This amendment replaces PR #11's assumptions with those implementations. Phase 8
([Monarch brief](MONARCH-DEVELOPMENT-PHASE.md)) routes resilience scenarios, goal
lifecycle and loan-payoff scenarios here.

| Subphase | Deliverable                                            | Builds on                                                       |
| -------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| 7A       | Optional priorities profile and category purposes      | Budget settings; 6F spending window                             |
| 7B       | Flexibility reserve and resilience view                | `fundingState` partition, 6D targets, 6F runway, 7A             |
| 7C       | Adverse-event scenarios in the phase 5 forecast        | Phase 5 projection engine, 7B reserve                           |
| 7D       | Goal pause, completion, retirement and replacement     | 6C goals, 6D targets, payday rules, atomic money moves          |
| 7E       | Resume-after-a-lapse review and in-app reminders       | 6G Review and guided setup, Up bank-source review, 7A cadence   |
| 7F       | Extra-income distribution and progress between reviews | Payday receipt guard, `fundedWrite`, 7B reserve, 7E completions |

## Amendments to PR #11

Each item was checked against the code on main. The reason is what the original
text would have broken or duplicated.

1. **Baseline.** PR #11 described phases 5 and 6 as planned and its roadmap row sat
   outside the table. The roadmap row now replaces the "reserved" entry.
2. **7A ordered funding priorities removed.** Payday plans already fund in rule order
   and **Fund targets** uses budget order. A third ordering would disagree with both.
   Users reorder payday rules or categories, as today.
3. **One definition of essentials.** 6F measures spending over the last three complete
   calendar months. 7B's monthly essentials use that same window, restricted to the
   categories marked essential, or an explicit monthly estimate the user enters. There
   is no separate averaging window.
4. **Minimum and comfort live on the profile, not a second target.** 6D allows one
   target per category; **Refill to balance** already provides replenishment. The
   reserve minimum and comfort target are profile values measured against the sum of
   the flexibility categories.
5. **Flexibility is unrestricted for the 6F runway.** 6F restricts only date/recurring
   targets and card reserves. A flexibility category must not have a date or recurring
   target (rejected on both sides), so it stays inside 6F's unrestricted money, which
   is correct for emergency money. 7B's reserve coverage and 6F's runway are shown
   side by side with their different numerators and denominators labelled.
6. **7C extends the phase 5 request, not saved scenarios.** Phase 5 stores nothing and
   allows three scenarios. 7C adds dated income pauses, recurring cost increases,
   first-shortfall reporting and reserve use to the same engine. One-off amounts,
   income/spending percentages and matched-bill replacement already exist and are not
   reimplemented. Saving scenarios is deferred: it would make the forecast page
   stateful and needs its own decision. Templates prefill the existing form.
7. **Household contribution delays deferred.** Phase 5 projects personal cash and
   adds the personal share of household bills; it has no pool balance to delay. A
   housemate's late contribution changes the pool, not personal cash, until a pool
   forecast exists.
8. **7D pause acts where suggestions come from.** Goals have no funding rules of their
   own; suggestions come from the linked category's target and payday rules. A goal
   that is not active makes its category target report no requirement, and payday
   rules for that category propose nothing. A retired goal keeps its category claim
   until the user unlinks it (6C then restores the manual value). Releasing money is
   a money move to another category in the same confirmed action; returning it to
   unassigned is an ordinary assignment change on the budget.
9. **7E extends the stateless 6G guide with a little stored state.** 6G stores nothing.
   7E stores only review completions (with a snapshot used for comparison) and reminder
   preferences. A completion never marks anything reconciled. The "offline snapshots"
   requirement is removed: the app has no offline mode.
10. **7F windfalls use the payday receipt guard.** Payday funding requires a payday. A
    windfall or raise is a received income deposit with a confirmed baseline; its
    reserve share is assigned through the same `fundedWrite` guard, and a deposit can be
    used by one payday event or one income review, never both. Raising expected pay is
    an edit of the payday plan, as today.
11. **Savings rate.** Phase 8's cash-flow savings rate and 7F's progress must not
    disagree. 7F presents no savings rate; its progress figures are reserve
    contributions, reserve use and shortfall changes. Phase 8 must exclude transfers,
    borrowing and valuation changes from any savings rate it adds.
12. **Debt payoff.** Out of scope here. 6B already reports funded versus unfunded card
    debt, and 7B lists it as an unfunded obligation; loan payoff scenarios need a debt
    model that does not exist yet.

## Shared implementation contract

- Reuse `fundingState` availability, card reserves, targets and atomic funding
  operations. Reuse phase 5's dated projection for every scenario.
- Keep bank location, envelope purpose and household attribution distinct. Personal
  contribution budgeting and expense-share reports are different views; never add
  both together as personal spending.
- No view makes retirement assets, property, unused credit, expected pay, unpaid
  reimbursements or other people's pool contributions spendable.
- Explain scope, as-of date, excluded funds and missing inputs. A missing rate or an
  unfunded obligation prevents an unqualified healthy status.
- Integer minor units, existing currency conversion and date conventions.
- All settings and classifications are opt-in. No bank payment, allocation, share
  agreement or historical transaction changes automatically.
- Prompts are dismissible. No peer rankings, streak penalties, moral spending labels
  or universal savings-rate targets.

## 7A: priorities profile

Book basis: chapters 1, 3, 11 and 16.

An optional **Financial priorities** section in Settings stores, per budget:

- A free-text purpose (career flexibility, security, family time). It is never an
  allocation rule.
- A purpose for any expense category: **Essential**, **Enjoyment** (protected
  discretionary spending) or **Flexibility reserve**. One purpose per category.
- An optional monthly essentials estimate, which overrides the measured figure.
- An optional reserve comfort target, either an amount or a number of months of
  essentials (one active source, never both), and an optional minimum.
- A review cadence: payday, monthly, quarterly or off (default off).

Saving requires the revision the user loaded; a stale save is refused. Card payment
reserves and income categories cannot take a purpose; a flexibility category cannot
fund a goal or carry a date/recurring target. Purposes are labels: payday rules,
targets and existing plans are unchanged.

Acceptance:

- Skipping setup preserves current behaviour and leaves every plan unchanged.
- Updating a comfort target changes the gap, not cash, history or bank balances.
- Marking a household-linked category low priority leaves every household share unchanged.
- A stale save is rejected without changing the stored profile.

## 7B: flexibility reserve and resilience view

Book basis: chapters 5, 7, 9, 10 and 13.

The Review page's **Resilience** card partitions `fundingState.resources` exactly,
using each expense category's positive availability plus its future assignments:

1. Card payment reserves.
2. Committed bill reserves (categories with date or recurring targets).
3. Goal-funded categories.
4. Flexibility reserve.
5. Other envelopes.
6. Unassigned (negative when over-assigned).

The six lines sum to resources; each unit appears once. Flexibility **available** is
today's positive availability of the flexibility categories; future assignments to
them are shown separately and not counted as coverage. Unfunded obligations
(overspending, card debt without a reserve, underfunded date/recurring targets,
over-assignment) are listed beside the estimate.

Coverage = flexibility available ÷ monthly essentials, shown to one decimal and
labelled as an approximation with its window. Monthly essentials are the user's
estimate, or net spending in essential categories over 6F's window ÷ 3. Coverage is
unavailable, never infinite, when essentials are zero or unknown or history is short.

Status: _not set up_ (no flexibility category), _incomplete_ (missing rates or
essentials needed by a months-based target), _below minimum_, _below target_, _on
target_. **Healthy** is reported only when on target, complete and with no unfunded
obligations. A minimum is a preference: a money move that takes flexibility below it
previews a trade-off notice and is still allowed.

Acceptance:

- $12,000 resources, $4,000 committed bills, $2,000 annual reserves and exactly $6,000
  flexibility show $6,000 flexibility; at $3,000 essentials, 2.0 months.
- Moving $1,000 from flexibility to a holiday makes it $5,000; a transfer between
  personal accounts does not change it.
- An investment/retirement account, a credit limit or a household receivable does not
  improve it.
- A $1,000 minimum with $800 available shows a $200 gap and the move preview warns
  without blocking.
- Missing rates or an unfunded obligation prevents a healthy status.

## 7C: adverse-event scenarios

Book basis: chapters 7, 12, 13 and 14.

Each phase 5 scenario may add:

- **Income pauses**: date ranges in which payday-plan or scheduled income is not received
  (lost job, career break). Reduced hours remain the income percentage.
- **Cost changes**: a signed monthly amount from a date, applied on that day of each
  month (rent rise, new essential cost). Months without that day use their last day.
- Existing one-off amounts cover emergencies and windfalls.

Each scenario reports its **first shortfall** (first day the projected balance is below
zero) within the horizon, or none within the horizon (never "safe"). With a flexibility
reserve set up, it also reports **reserve use**: how far the lowest balance falls into
today's flexibility availability, capped at that availability. Templates on the forecast
page prefill these fields. The CSV remains the dated ledger behind every result.
Calculations remain read-only and nothing is stored.

Acceptance:

- From zero cash, $1,000 on day 10 cannot cover a $500 bill due day 5: first shortfall
  day 5 despite a positive period end.
- With $6,000 cash and $3,000 essentials due at each month end, a $2,000 emergency on
  day 1 leaves the second month end $2,000 short.
- A missed payday combined with a repair keeps both events exactly once.
- A pause outside the horizon or ending before it starts is rejected.
- Identical inputs and dates reproduce identical results.

## 7D: goals can change

Book basis: chapter 14.

Goals gain **Active**, **Paused**, **Completed** and **Retired** states, an optional reason,
an optional replacement goal and a status history. One confirmed action may change the
status and move money from the goal's category to another category; both apply in one
transaction behind the funding revision and the goal's last update, or neither does.

- Any non-active goal's category target reports no requirement (Fund targets, Review and
  next-month needs skip it) and its payday rules propose nothing. Funding is retained.
- Forecast contributions stop for a non-active goal.
- A replacement goal must be another, non-retired goal; it gets money only through an
  explicit move. The unique category claim still prevents shared money.
- Manual tracking goals change state without touching cash.

Acceptance:

- Pause a goal with $800 funded: $800 stays and Fund targets proposes nothing for it.
- Retire it and move $500 to flexibility: $300 remains, $500 moves, resources unchanged.
- A stale revision or stale goal edit rejects the combined operation with no partial change.
- Status history, assignments and reports survive pause, retirement and backup/restore.

## 7E: returning after a lapse

Book basis: chapters 1, 2, 11 and 19.

The Review page opens with **Resume budgeting**: days since the last completed review,
transactions dated since then, uncategorised spending, Up bank-source items awaiting
review (linked to the existing queue), unreconciled accounts and today's resolution. It
never requires historical categorisation before today's budget is visible.

**Mark review complete** stores the date and a snapshot (flexibility, assigned to
flexibility to date, essentials, unfunded obligations, resolution). It is not a
reconciliation and does not change any bank observation or funding.

With a cadence set, a dismissible reminder appears on the Review and Dashboard pages when
due: monthly or quarterly after the last completion, or after a payday-plan payday since
it. Snoozing stores a date and changes nothing else. Funding warnings stay where the money
is used. Copy is neutral ("Review changed priorities", "Funding needs attention").

Acceptance:

- After six weeks, the page shows today's actionable review with older items accessible.
- Completing a review changes no funding, bank acknowledgment or deficit.
- Snoozing hides the reminder until the date and changes nothing else.
- The flow works on phone and desktop.

## 7F: income changes and progress

Book basis: chapters 2, 3, 5, 9 and 10.

**Extra income** on the Review page previews a split of one received income deposit:
the user confirms the comparison baseline (0 for a windfall, the usual pay for a raise),
a reserve percentage and the flexibility category to receive it. Extra = deposit −
baseline; reserve share = extra × percentage, rounded down, capped at unassigned money.
Nothing moves before **Apply**. Applying assigns the share once; the deposit is then
used and cannot be applied again or used by a payday event (and a deposit used by a
payday event is refused here). Transfers and deposits outside income categories are
refused.

**Since last review** compares the snapshot with today: flexibility change split into
assignments in and reserve use (spending), and unfunded-obligation change. Value changes
of investments never appear, because they are not cash. If the set of flexibility
categories changed, the comparison says so instead of guessing.

Acceptance:

- A confirmed $2,200 deposit against a $2,000 baseline at 50% previews $100; nothing moves
  before Apply, and applying twice is refused.
- A $1,000 transfer between personal accounts is not offered as income.
- A super value rise changes neither the reserve nor the comparison.
- The comparison separates assignments in from reserve use.

## Data and portability

Additive migration `0034_financial_resilience`: `financial_priorities` (one row),
`category_purposes`, `goal_status_events`, `review_completions`, `income_reviews`, and
goal `status`, `status_reason`, `replaced_by_goal_id`, `status_changed_at` columns.
Backup format 11 includes them; restore validates purposes, statuses, replacements and
snapshots. Older backups restore with every goal active and no profile.

## Delivery and definition of done

1. Recheck dependency status before building on this brief.
2. Track each subphase as planned, implemented, verified, released and live verified.
3. Disposable-budget tests cover the numerical examples, double counting, conflicts,
   dates, missing data and old/new backup restore.
4. Desktop/phone browser coverage for priorities, resilience, scenarios, goal changes
   and resume; the demo runs the same routes.
5. Follow MAINTENANCE.md for releases and live backup gates.

Complete when every enabled result reconciles to shared accounting, actions have
reviewable previews and safe retry/conflict behaviour, and the acceptance cases have
evidence. Do not claim behavioural improvement from arithmetic tests alone.

## Delivery status

| Subphase | Status                                   |
| -------- | ---------------------------------------- |
| 7A–7F    | Implemented and released (`0.2.0-up.18`) |
