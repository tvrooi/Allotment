# Resilience, priorities and changing goals (phase 7)

Implementation: `0.2.0-up.18` feature branch. Release publication and live installation are separate
delivery gates. Design and acceptance cases: [phase 7 brief](PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md).

Everything here is optional. Skip it and the budget, payday plans, targets and forecasts behave
exactly as before. All money figures come from the shared envelope service (`fundingState`);
there is no second budget, forecast or review engine.

## Priorities (7A)

**Settings → Priorities** stores, for the whole budget:

- A free-text purpose. It never assigns money.
- A purpose for any expense category: **Essential**, **Enjoyment** or **Flexibility reserve**.
  Card payment reserves and income categories cannot take one. A flexibility category cannot
  fund a goal or have a _balance by date_ or _recurring bill_ target (both sides refuse it);
  a monthly or refill target is fine.
- An optional monthly essentials estimate, a comfort target (an amount, or 1–60 months of
  essentials) and a minimum.
- A review reminder: after each payday, monthly, quarterly or off.

Saving needs the revision you loaded, so a stale save from another device is refused. Saving
labels never changes an assignment, payday rule order or household share.

## Flexibility and resilience (7B)

The **Review** page's resilience card splits today's **cash after debts** into card payment
reserves, bill reserves with dates, goals, the flexibility reserve, other envelopes and
unassigned money. Each category's positive availability plus its later-month assignments falls
in exactly one line, so the lines add up to the total.

- **Flexibility available today** is the positive availability of your flexibility categories.
  Money assigned to them in later months is shown but not counted. Moving money between your
  own bank accounts does not change it; moving money between categories does.
- **Monthly essentials** are your estimate, or net spending in essential categories over the
  last three complete calendar months ÷ 3 (the same window as the 6F cash runway).
- **Coverage** is flexibility ÷ monthly essentials, to one decimal. It is unavailable, never
  infinite, when essentials are zero, unknown or the history is too short.
- **Status**: no reserve yet, incomplete (missing rates, or a months target without essentials),
  below minimum, building toward target, at target. **Healthy** also needs no unfunded
  obligations: overspending, card debt without a reserve, underfunded bill targets or
  over-assignment (beyond overspending, which already lowers unassigned money).
- A minimum is a preference. **Move money** previews a notice when a move takes the reserve
  below it, and still allows the move.
- Investment, retirement, property, off-budget and household pool accounts, credit limits,
  expected pay and money owed to you never count.

The 6F cash runway is unchanged: a flexibility category is part of its unrestricted money.

## Life events in forecasts (7C)

Each forecast scenario can add **income pauses** (no payday-plan or scheduled income in a date
range, and no goal contributions from that pay) and **cost changes** (a monthly amount from a
date, on that day each month; a missing day falls back to the month's last day). Templates
prefill these and the existing one-off amounts. Each scenario reports its **first shortfall**
within the horizon (first day below zero) or "no shortfall within this horizon", how much
expected income did not arrive, and, with a flexibility reserve, how far the lowest balance
falls into it. Nothing is saved; the CSV is the dated ledger.

## Goals can change (7D)

A goal's menu offers **Pause**, **Make active again**, **Mark completed** and **Retire**, with an
optional reason and replacement goal. A goal that is not active:

- keeps its money and its category link;
- makes its category target ask for nothing (Fund targets, Review, next month's needs);
- gets nothing from payday rules (shown as "goal not active" in the payday preview);
- gets no planned forecast contributions.

The same confirmed action can move some of the goal's money to another category. The status
change and the move apply together behind the funding revision and the goal's last update, or
not at all. To return money to unassigned, lower the assignment on the budget. Status history
is kept. A replacement must be another goal that is not retired; it only gets money through an
explicit move, and the unique category link still prevents two goals sharing money.

## Resume budgeting and reminders (7E)

The Review page starts with **Resume budgeting**: days since the last completed review,
transactions dated since, uncategorised spending, accounts to reconcile and, with Up connected,
bank changes waiting in Settings → Connected Banks. Today's budget is always available first.

**Mark review complete** stores the date and a snapshot of the reserve and unfunded figures. It
reconciles nothing, acknowledges no bank change and moves no money. With a reminder cadence, a
dismissible banner appears on Review and the Dashboard when a review is due; **Remind me in a
week** stores a snooze date and nothing else.

## Extra income and progress (7F)

**Extra income** (shown once a flexibility reserve exists) previews a split of one received
deposit in an income category: extra = deposit − the usual amount you confirm (0 for a
windfall); the reserve share = extra × your percentage, rounded down and capped at unassigned
money. **Apply** assigns it once. The deposit is then used: it cannot be split again or selected
by a payday plan, and a deposit a payday plan used is not offered. Transfers are never income.

**Since your last review** compares the snapshot with today: the reserve's change, what was
assigned to it and what was spent from it (net of refunds), and the change in unfunded
obligations. If your flexibility categories changed, it says so instead of comparing. Investment
values never appear because they are not cash.

## API and portability

| Route                                     | Effect                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `GET`/`PUT /api/priorities`               | Profile and purposes; `PUT` needs `revision`   |
| `GET /api/review/resilience`              | Read-only                                      |
| `GET /api/review/resume`                  | Read-only                                      |
| `POST /api/review/complete`               | Stores a completion snapshot                   |
| `POST /api/review/snooze`                 | Stores `until` (a date or null)                |
| `GET /api/review/income`                  | Unused received income deposits                |
| `POST /api/review/income/preview`/`apply` | Previews, then applies once                    |
| `POST /api/goals/:id/status`              | Status change with optional move               |
| `GET /api/goals/:id/history`              | Status history                                 |
| `POST /api/forecast`                      | Scenarios accept `incomePauses`, `costChanges` |

Migration `0034_financial_resilience` is additive. Backup format 11 includes the profile,
purposes, goal statuses and history, review completions and income splits; restore validates
them. Older backups restore with every goal active and no profile. The in-browser demo runs the
same routes.
