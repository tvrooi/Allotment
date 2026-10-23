# Budget review, buffer and guided setup (phases 6F–6G)

Implementation: `0.2.0-up.17` feature branch. Release publication and live installation are separate delivery gates.

Open **Review** in the sidebar. The page is read-only: every figure comes from the same
`fundingState` call as the monthly budget summary (`server/src/services/reviewService.ts`),
and nothing changes until you act on an item. Resolving an item from the page (categorising a
transaction, moving money, funding targets) refreshes the review, the budget, its summary, payday
plans, goals and the forecast together.

## Needs attention (6G review)

| Item                          | Total equals the budget summary's | Resolve it                                       |
| ----------------------------- | --------------------------------- | ------------------------------------------------ |
| Uncategorised spending        | `uncategorized`                   | Choose a category inline (latest 100 are listed) |
| Overspent categories          | `overspent`                       | **Move money** on the page, from a funded one    |
| Targets underfunded           | each target's `underfunded`       | **Fund targets** (previewed, applied once)       |
| Card debt without a reserve   | `paymentShortfall` + uncovered    | Card payments on the budget                      |
| Assigned to later months      | `futureAssigned`                  | Listed by month; it is reserved today            |
| Unassigned (or over-assigned) | `toBeBudgeted`                    | Assign it, or reduce an assignment               |

Missing exchange rates mark the review incomplete. A reconciled transaction cannot be
categorised from here, as anywhere else in the app.

**Personal spending categories in one shared budget.** Give each person's own spending
categories a category group (for example "Sam personal") and filter the review by group. This
is only a way of organising categories inside the one shared budget: the shared password
session cannot tell who made an edit, so nothing records or implies authorship. Phase 4's
household contribution and share ledger is separate and unchanged.

## Guided setup (6G)

Six steps, each derived from the budget as it is now (nothing is stored, so a step cannot
disagree with the budget):

1. **Confirm your balances** — cash and card accounts with today's balance; done when no
   account has unreconciled transactions. Each links to its reconcile page.
2. **Cover what is due before your next income** — unpaid scheduled bills (the payday
   planner's bill coverage) up to the next expected income: the next payday of any active plan,
   or the next pending scheduled income, whichever is earlier. With neither, the next 14 days.
   Expected pay is only a date: it never becomes money to assign.
3. **Assign the money you already have** — unassigned today; attention when over-assigned or
   when rates are missing.
4. **Prepare for irregular expenses** — non-monthly categories and categories with quarterly,
   half-yearly or yearly bills; done when each has a target.
5. **Check categories before spending** — attention while anything is overspent or uncategorised.
6. **Move money when priorities change** — a pointer to Move money.

The page works at phone width (390 px) and on desktop; the browser suite checks both.

## Next month and buffer (6F)

**Next month** shows what is already assigned to it, what is assigned to the months after it,
what its targets still need, and what is unresolved this month. Next month's target needs start
from today's availability, as if nothing more is spent or assigned this month; overspending
carries into it as it does in the budget.

**Cash runway** (optional) is shown with its assumptions:

- `Cash after debts` is the shared service's resources: personal, on-budget checking, savings,
  cash and card accounts. Unreviewed debt nets against cash. Investment, retirement, property and
  off-budget accounts contribute nothing, so retirement assets never extend the runway.
- **Restricted** money is excluded: balances (and later assignments) of categories with a
  _balance by date_ or _recurring bill_ target, and card payment reserves. Reviewed card debt
  without a payment reserve is subtracted too, so borrowing never looks like saving.
- `Unrestricted` = cash after debts − restricted − card debt without a reserve.
- Spending rate: net spending (refunds reduce it) over the last three complete calendar months,
  excluding restricted categories; uncategorised debits are included. Runway days =
  unrestricted ÷ daily rate. No income is assumed.
- The runway is **incomplete**, and shows no number, when exchange rates are missing, the
  budget's history (earliest account creation or transaction) starts after the window, the
  window has a transaction without a rate, or there was no spending to measure against.

Money age is not implemented. It would need documented treatment of opening balances,
transfers, cards and incomplete history before it could be presented; the runway does not
depend on it.

## Phase 7 additions

The page also shows **Resume budgeting**, the **Flexibility and resilience** card and **Extra
income**; see [Resilience](RESILIENCE.md). They read the same `fundingState` figures.

## API

`GET /api/review`, `GET /api/review/buffer` and `GET /api/review/guide` are read-only and
mounted behind the same guards as the budget. The in-browser demo serves the same routes.
