# Envelope funding (phase 6A)

One calculation service supplies the monthly summary and payday planner. Expense
Available is previous Available + Assigned + signed Activity. Refunds increase it.
Like YNAB, an envelope that ends a month overspent starts the next month at zero
(`rollOver` in `budgetService.ts`): the money already left the accounts, so resources and
unassigned already show it, and a one-off such as a loan payout or settlement isn't
carried as a deficit forever. Overspending stays visible, and in Review, for the
month it happened. Card payment categories keep a running total. Income expectations remain separate
from actual received income. Ordinary transactions and stored assignments are never
rewritten during upgrade.

## Resource invariant

`resources = unassigned + reserved`

Resources are the dated balances of personal on-budget checking, savings, cash,
credit and line-of-credit accounts, converted using the existing currency policy.
Other on-budget assets contribute no positive spendable value; negative balances
reduce resources. Household pools and off-budget accounts contribute neither cash
nor debt. Closed accounts remain part of history until their balances are zero.
Internal transfers do not create resources. Boundary transfers retain the existing
personal contribution/category policy. Uncategorised adjustments affect actual cash
without being invented as income.

Reserved is the sum of positive expense-envelope balances through the as-of month,
plus every positive assignment after that month. Future negative assignments do not
release today's money. Negative envelopes cannot offset another purpose's reserve.
Uncategorised debits reduce cash and appear separately as unresolved spending.
New edits, including the existing 12-month bulk action, may not increase reservations
past resources. Unfunded legacy assignments survive and produce a visible funding
shortfall; users can reduce them or move existing money. Income expectations do not
reserve cash.

This is an **interim net-debt model**: outstanding on-budget debt reduces assignable
resources immediately. It does not create dedicated credit-card payment reserves or
claim to distinguish funded purchases from new card debt. Reviewed payment reserves are added in [phase 6B](CARD-PAYMENTS.md) through this
same service. The interim net-debt treatment remains for unreviewed cards.

## Dates and currency

Today's funding uses the server's local calendar date (`todayIso`). Payday funding
uses the plan's configured time zone and supplies that explicit date to the same
service. A historical summary uses the earlier of month end and today. Future month
views show existing assignments and carry, but funding remains capped at today.
The response includes `asOf`; it is not a forecast. All stored later commitments
are reserved even in historical assessments, so those assessments can show negative
funding for commitments made with later receipts. Assignment creation dates are not
available and are not reconstructed.

Opening funds become effective on the earlier of account creation and its first
transaction date, consistent with existing booked-value history. Editing an opening
balance changes that historical assessment explicitly. Opening funds do not become
earned income. Future-dated transactions and unreconciled generated salary receipts
are excluded. Reconciliation confirms a generated receipt. Missing account or activity
exchange rates mark the assessment incomplete and block new funding and moves.
The service uses account balances valued as of the assessment date and stored
transaction conversions for category activity. Currency movements therefore change
unassigned resources; they are not earned salary.

## Moves, coverage and undo

Move money / Cover overspending works on desktop and phone. Choose two distinct
expense categories and a positive amount, preview their resulting availability,
then apply. The source must have availability through every affected month, including
later spending when editing a historical month. Future-month moves are not enabled.
The assignment pair and durable operation are written in one database transaction.
A database revision changes for relevant writes, even changes later reversed, and
prevents competing previews from reusing source money.

History shows the latest 100 operations. Undo restores both assignments atomically
only if no relevant financial change has intervened. Revision checks are deliberately
conservative: imports, account/rate changes, category edits and another allocation
require a new reviewed move. Day changes also invalidate old previews/undo. Category
goals/targets are not yet linked (6C–6D); moving money changes category funds available
for their eventual progress calculations.

Portable backup version 7 retains operations and accepts older backups. Restore
invalidates pre-restore undo, even for an exported operation; it cannot overwrite the
restored budget. Existing manual goals, ledger rows, bank IDs, encryption and payday
receipt duplicate guards are preserved. Currency decimal changes are blocked while
money-move history exists. The browser demo uses the same service and SQL migration.

## Verification and delivery

Disposable-budget coverage includes opening dates, rollover/refunds, future salary
and reservations, deficits, uncategorised spending, household/budget boundaries,
missing rates, splits, net debt, assignment limits, stale previews, ABA edits,
transaction rollback and backup/restore. Browser regressions cover desktop/phone
availability agreement, category detail, coverage, history/undo and payday integration.

Implemented and locally verified on the phase 6A branch; see the PR for exact check
results. Publication and live installation are separate states. No production budget
has been opened, migrated or replaced by these checks.

## Budget start

**Settings → Budget** can set the first month envelopes count (`budget_settings.budget_start_month`,
null = all history). Activity dated before it and assignments for earlier months don't carry into
envelope Available, uncategorised spending, overspending or card payment reserves
(`sinceBudgetStart` in `services/balances.ts`). Account balances, and therefore resources, still
include everything, so cash spent before the start simply isn't there to assign. Reports, the
register and the spending history used by the runway ignore the start. A month before the start
shows no assignments or activity. Moving the start changes the funding revision; it never
rewrites transactions or stored assignments.
