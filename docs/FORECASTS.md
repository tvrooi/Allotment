# Savings forecasts (phase 5)

Implementation: `0.2.0-up.13` feature branch. Release publication and live installation are separate delivery gates.

Open **Forecast** in the sidebar. The page is read-only: it never creates transactions, schedules,
goal values or budget assignments, and nothing about a scenario is stored. Refreshing the page
returns to the default scenarios.

## Cash runway

A day-by-day balance from today to the chosen horizon (30 days to two years):

- **Starting cash** is the current balance of open, on-budget, personal cash and card accounts
  (checking, savings, cash, credit card, line of credit), using the same budget boundary and
  received-income rule as envelope funding. Household pool accounts, off-budget accounts,
  loans and investments are excluded. Unreconciled generated salary does not count as cash.
- **Income** comes from active payday plans (expected take-home pay on each future payday) or,
  when no plan exists or you choose it, pending scheduled income in income categories. The two
  sources are never combined, so a scheduled salary and a payday plan cannot both be counted.
- **Bills and other movements** are pending, unmatched recurring occurrences on the personal
  side of the budget boundary, plus future-dated register entries. A matched, paid or skipped
  occurrence is replaced by its real transaction. Internal transfers between personal accounts
  net to zero. Overdue unmatched occurrences are reported as a warning, not guessed as paid
  or unpaid.
- **Household shares** add your unreserved personal share of each unpaid household bill on its
  due date: `personal share − personal share × reserved ÷ bill total`. They are off by default
  when contributions into a household pool are already scheduled, so a contribution is not
  counted twice. Household groups in another currency are excluded with a warning.
- **Variable spending** is the net daily average of expense-category budget activity over the
  lookback (28–365 days, or less when history is shorter). Transfers, uncategorized balance
  adjustments, payments matched to schedules, generated rows and (when household shares are
  forecast) household-linked payments are excluded. Refunds reduce the average. Spending is
  applied with cumulative rounding, so the daily cents add back to the exact average.

The summary shows cash today, the lowest balance before the next payday, the lowest balance in
the horizon and the closing balance. Actual history is a solid line; scenarios are dashed.

## Scenarios

Three labelled scenarios are compared. They are assumptions, not predictions or statistical
confidence intervals. Each can change:

| Setting                    | Default (Base / Conservative / Stretch) | Effect                                               |
| -------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Variable spending %        | 100 / 120 / 85                          | Scales the historical average.                       |
| Income %                   | 100 / 95 / 100                          | Scales expected pay or scheduled income.             |
| Spending per day           | History                                 | Replaces the historical average with a fixed amount. |
| Goal growth % a year       | 0                                       | Nominal rate ÷ 12, credited at each month end.       |
| Goal contributions per pay | Plan                                    | Replaces a goal's planned per-pay contribution.      |
| One-off amounts            | None                                    | Signed cash movements inside the horizon.            |

## Goal trajectory

Each goal starts from its current value: category-funded goals use today's positive envelope
availability from the shared funding service (unknown while exchange rates are missing);
manual goals use their saved value, which may overlap other goals or accounts.

Contributions follow the payday plan rule for the goal's category on each future payday: fixed,
percentage of expected pay, smoothed monthly (over the calendar-year paydays) or target-by-date.
Bill, category-target and remainder rules contribute nothing in the forecast. A scenario contribution per pay
replaces the plan; without a plan it applies every 14 days. Scheduled bills in a goal's
category reduce it. Growth is credited on positive balances at each calendar month end,
rounded down to cents. Goal contributions are envelope assignments, so they do not change
the cash runway. The table shows each scenario's estimated attainment date and flags goals
that would be reached after their target date. A goal already funded today is reached.

## Export and API

**CSV** downloads each scenario's daily balance, income, scheduled movements and variable
spending. `POST /api/forecast` accepts `horizonDays`, `lookbackDays`, `incomeSource`,
`includeHousehold` and up to three `scenarios`; invalid goal references or one-offs outside
the horizon return 400. The in-browser demo runs the same route.

## Life events (phase 7C)

Scenarios also accept income pauses, monthly cost changes and report the first dated shortfall
and reserve use. See [Resilience](RESILIENCE.md#life-events-in-forecasts-7c).

## Limits

No saved scenarios, investment holdings, superannuation projection, tax modelling, inflation
adjustment or formula builder. Variable income is modelled only through the income percentage.
Daily forecast dates use the server's local date; payday enumeration uses each plan's dates.
