# Card payment funding (phase 6B)

Payment funding is an explicit, reviewed change for each personal on-budget credit
card or line of credit. Open Budget → Card payments → Review setup. The preview
shows existing debt, cash to reserve, the remaining payment shortfall and unassigned
money before and after. Nothing is changed until Enable payment funding is applied.
The preview expires on relevant financial edits and calendar-day changes.

Existing transactions, opening balances, bank IDs, reconciliation and assignments
remain intact. Setup adds a payment category, a dated review record and only the
initial payment assignment the user approved. Existing purchases are part of opening
debt, not retrospectively generated funded purchases. Cards without reviewed setup
keep phase 6A's conservative net-debt treatment in the same shared funding service.

## Cash and debt invariant

For a reviewed card, negative card balances are debt, not spendable resources.
Resources comprise personal cash and savings, positive prepaid card balances, and
the existing net-debt treatment of unreviewed accounts. Off-budget and household
accounts remain outside personal funding.

`resources = unassigned + expense envelopes (signed, less credit overspending) + positive payment reserves + later assignments`

Credit overspending, the part of an envelope deficit that unfunded card purchases explain, is
card debt rather than spent cash, so it never comes out of Ready to Assign
([envelope funding](ENVELOPE-FUNDING.md#the-overspending-rule)).

A funded card purchase consumes its expense envelope and moves the cash backing
that purchase into the card's payment envelope. The purchase remains the only
expense in the bank ledger and reports. A linked repayment consumes payment funding
and cash, and reduces debt. It is an internal transfer, not another expense.

With $1,000 cash and $100 groceries assigned, an $80 purchase leaves $20 groceries
and $80 available for payment. Paying $80 leaves $920 cash, no card debt, $20
groceries and no payment reserve. Unassigned remains $900 throughout.

Unfunded purchases create a payment shortfall. Existing debt needs an explicit
assignment to the payment category; use Fund debt or Move money. Covering a purchase
category deficit in the same month also increases purchase funding. Moving cash out of a payment
reserve exposes the resulting payment shortfall. Payments beyond their reserve
show Payments without funding. These review items prevent a fully resolved state.

## Calculation order

The calculation is derived at an explicit as-of date, using stored minor units and
existing currency conversion policies. Category assignments through that month and
cash activity take priority; remaining category resources fund reviewed-card
purchases in date, record-creation-time and ID order. Record creation time breaks
same-day ties; imported rows without distinct times use stable IDs. This is an as-of assessment, not a reconstruction of the
user's assignment timing, which the original ledger does not retain. A later
assignment in the same month can fund earlier purchases; future assignments and expected
income cannot. Funding follows the envelopes' monthly reset ([envelope funding](ENVELOPE-FUNDING.md)):
each month's purchases are backed by what the category carries in plus that month's
assignments and cash activity, and a category that ends a month overspent starts the next
at zero. An old cash deficit therefore doesn't block a new purchase, and a later month's
assignment doesn't fund an earlier month's purchase; that debt needs Fund debt or Move money.

Split parents affect balances once and their leaf parts affect purposes once.
Interest and fees use ordinary expense categories and follow the same purchase
funding rules. A positive card balance is spent before a new payment reserve is
needed. Current card debt is measured at the assessment date; transaction funding
uses stored transaction conversions. Currency changes can therefore expose a payment
shortfall. Missing rates make funding incomplete and block assignments and setup.

Setup retains the identities of existing dated parent transactions. Automatic
funding applies only to new identities dated on/after the setup date. Late imported
older history and edits to reviewed opening-history rows affect debt and original
category activity, but are not silently converted into historical payment funding.
Their resulting shortfalls require review. Historical views before setup retain the
previous net-debt model; later stored assignments remain future commitments as in 6A.

## Refunds, transfers and extra funding

- A refund first reverses unfunded debt from that category, then releases existing
  payment reserves; any amount becoming a positive card balance is prepaid resources.
  A refund that only reduces unreserved opening debt does not invent available cash
  in an expense envelope. Reports still show the original refund in full.
- A refund after a funded payment can restore category availability using its new
  prepaid card balance, without recreating the already-consumed payment reserve.
- Overpayment is retained as a positive card balance. Only the portion repaying debt
  consumes payment funding. Extra manually assigned payment cash remains reserved,
  labelled Extra reserve, until explicitly moved elsewhere.
- A linked balance transfer between two reviewed cards moves existing payment funding
  to the receiving debt account, consuming any prepaid card value before reserving
  cash for new debt. It creates no expense or cash. If the other card was
  not reviewed at the transfer, its starting debt is handled by its own setup review.
- Cash advances create actual cash and unfunded card debt. They are transfers, not
  earned income or successful saving. This phase does not add a savings/runway metric.
- External repayments and refunds that reduce debt can release existing reserves;
  boundary transfers retain existing report and contribution policy.

The payment category is for assignments and derived payment activity only. Record
repayments as linked account transfers. Payment categories are excluded from ordinary
transaction-category pickers and protected against direct ledger use, deletion,
reclassification as income and movement outside personal credit-account scope.
Ordinary categorised card activity and reports remain separate from reserve activity.

## Compatibility and delivery

The additive migration creates no setup, assignments or transactions automatically.
Portable backup version 8 includes setup records and baseline identities; older
backups restore without reviewed setups. Existing move history, payday duplicate
receipt guards, manual goals and encrypted bank credentials retain their policies.
Restore invalidates stale undo and setup previews. No production budget is used by
verification; publishing and live installation are recorded separately.
