# Budget review, buffer and guided setup (phases 6F–6G)

Implementation: `0.2.0-up.17` feature branch. Release publication and live installation are separate delivery gates.

Open **Review** in the sidebar. The page is read-only: every figure comes from the same
`fundingState` call as the monthly budget summary (`server/src/services/reviewService.ts`),
and nothing changes until you act on an item. Resolving an item from the page (categorising a
transaction, moving money, funding targets) refreshes the review, the budget, its summary, payday
plans, goals and the forecast together.

The review starts with next actions and an expandable **Check budget setup** section, then
Needs attention. Uncategorised spending shows a short preview with a control to show the
remaining fetched transactions. Guided setup steps open on request. The page header scrolls
with the content, leaving more working room on phones. **Record today’s review** at the end
saves a comparison snapshot; unresolved work remains open.

## Needs attention (6G review)

| Item                          | Total equals the budget summary's | Resolve it                                                  |
| ----------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Uncategorised spending        | `uncategorized`                   | Search categories inline; expand the short preview for more |
| Overspent categories          | `overspent`                       | **Move money** (click its Available), from a funded one     |
| Targets underfunded           | each target's `underfunded`       | **Fund targets** (previewed, applied once)                  |
| Card debt without a reserve   | `paymentShortfall` + uncovered    | Card payments on the budget                                 |
| Assigned to later months      | `futureAssigned`                  | Listed by month; it is reserved today                       |
| Unassigned (or over-assigned) | `toBeBudgeted`                    | Assign it, or reduce an assignment                          |

A category set to **Keep overspending** (for spending that will be paid back) stays in the
overspent list, marked `kept`, until its deficit is covered or repaid; see
[the overspending rule](ENVELOPE-FUNDING.md#the-overspending-rule). Money held for next month
(ACT-03) is not ready to assign, so a month with a hold can read fully budgeted; see
[holding money](ENVELOPE-FUNDING.md#holding-money-for-next-month).

The queue uses the shared searchable category picker, grouped by expense category group.
Type to narrow the list, use arrows and Enter to choose, or Escape to cancel without saving.
A successful pick refreshes the review and keeps keyboard focus in the queue; a failed save
leaves the row available to retry. A success notification offers **Undo**, even when the queue
is now empty; **Redo** follows an undo. The shared keyboard undo history also keeps the change
after the notification is dismissed. Undo and redo change only the category, preserving later
edits to the transaction’s other fields.

**Sort repeated payees together** opens the existing payee-level sorting flow inside the queue.
Each payee’s **View transactions** link opens its uncategorised personal-budget entries across all dates in Transactions. Browser Back returns to Review; reopen grouped sorting to choose a category.
It lists repeated payees in personal budget accounts, leaving already categorised transactions,
transfers, split parents and household-linked entries unchanged. Household and off-budget accounts
are excluded even when they use the same merchant. One choice categorises the matching eligible
transactions, with one Undo/Redo for the group. **Also apply to future transactions** starts off
in Review; opting in changes the payee default as part of the same undoable action.

Missing exchange rates mark the review incomplete. Category changes leave reconciled amounts,
dates and accounts locked.

**Personal spending categories in one shared budget.** Give each person's own spending
categories a category group (for example "Sam personal") and filter category details inside Needs attention by group. This filter affects overspent categories, target shortfalls and later-month category details; totals and other review items remain budget-wide. This
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
   Expected pay is only a date: it never becomes money to assign. The window is up to, but not
   including, that date: a bill due on the next income day counts towards the next pay, and the
   step says so. The step reports one of three outcomes and the horizon date:
   _No tracked bills due before {date}_, _All tracked bills before {date} are funded_, or
   _Can't confirm coverage: N bills need categories_ (never done). A personal bill with no
   category can't be matched to an envelope, so it is listed and links to
   `/recurring?filter=needs-category`, where a category is chosen on the row (only `categoryId`
   is sent, so the confirmed amount is untouched). Bills a household pool account pays are listed
   as information (_Household pool bills are handled in the household_) and never block done.
   `guideState` returns this as `coverage` and `excludedBills`; the figures come from
   `billCoverageDetail` (payday), whose `excluded` list carries each bill's reason.
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

**Cash coverage with no income** (optional, the runway) is shown with its assumptions. It assumes no
income arrives and still includes money assigned to everyday envelopes:

- `Cash in your budget accounts` is the shared service's resources: personal, on-budget checking,
  savings, cash and card accounts. Unreviewed debt and overdrafts net against cash; debt on a card
  enrolled in card payments does not (only its positive balance counts), so this is cash before
  that debt. The response's `breakdown` names the parts (see ENVELOPE-FUNDING.md). Investment, retirement, property and
  off-budget accounts contribute nothing, so retirement assets never extend the runway.
- **Restricted** money is excluded: balances (and later assignments) of categories with a
  _balance by date_ or _recurring bill_ target, and card payment reserves. Reviewed card debt
  without a payment reserve is subtracted too, so borrowing never looks like saving.
- `No-income cash coverage` (API field `unrestricted`) = cash in budget accounts − restricted − card
  debt without a reserve.
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
