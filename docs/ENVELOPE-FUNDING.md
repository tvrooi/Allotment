# Envelope funding (phase 6A)

One calculation service supplies the monthly summary and payday planner. Expense
Available is previous Available + Assigned + signed Activity. Refunds increase it.
Card payment categories keep a running total. Income expectations remain separate
from actual received income. Ordinary transactions and stored assignments are never
rewritten during upgrade.

## Ready to Assign (the YNAB model)

Every dollar in the budget's accounts is in an envelope or ready to assign
(`fundingState` in `budgetService.ts`):

`ready to assign = resources − Σ envelope Available (signed) − later positive assignments`

Nothing stores a running total: resources come from account opening balances and
transactions, Available from assignments and transactions, so a refresh or a full
recompute gives the same figure. `readyToAssign.test.ts` checks every displayed figure
against an independent ledger recompute (inflows − assignments − earlier months'
overspending) and that no money figure is ever fractional.

- **Inflows** count from their own date and month. An earlier month never sees them,
  and a transaction dated after today isn't received yet.
- **Assigning** moves money from Ready to Assign into one envelope for one month.
- **Moving money** between envelopes changes those two envelopes only. Ready to Assign
  is unchanged, because the signed sum is.
- **Uncategorised** money comes and goes from Ready to Assign directly: an uncategorised
  inflow is ready to assign; uncategorised spending leaves it at once and is listed for
  review.

### The overspending rule

An envelope that ends a month below zero starts the next month at zero (`rollOver`).

- **Cash overspending** (spending more than an envelope held, from cash, savings or an
  unreviewed card) is red in its own month and does not lower that month's Ready to
  Assign. When the next month starts, the envelope resets and the deficit comes out of
  that month's Ready to Assign, once. Example: $1,000 received, $700 Food and $300 Rent
  assigned, $800 spent on Food. October shows Ready to Assign $0 and Food −$100;
  November shows Ready to Assign −$100 and Food $0.
- **Credit overspending** (purchases on a reviewed card that no envelope money backed) is
  card debt, which resources leave out. It is never deducted from Ready to Assign; it
  remains a card payment shortfall until funded ([card payments](CARD-PAYMENTS.md)).
- Card payment envelopes count only a positive reserve; payments beyond it are listed as
  Payments without funding and leave Ready to Assign straight away.

A one-off such as a loan payout or settlement is therefore deducted once, not carried as a
deficit forever. The summary reports `cashOverspent` (this month's cash deficits) next
to `overspent` (all deficits, including credit). An automatic payday allocation leaves
enough to cover this month's cash overspending rather than assigning it again.

### Month views

- **The current month and later months** deduct every positive assignment in later
  months. A later month counts its own envelopes, whose carry has already reset, so this
  month's cash overspending shows there. A negative assignment in a later month releases
  nothing today.
- **A past month** shows what it closed with: later months' assignments take only what it
  had left (`laterDeduction`), so a month before your income shows $0, not the later
  commitments as a negative figure.

The summary's `envelopes` and `laterDeduction` make the identity visible:
`toBeBudgeted + envelopes + laterDeduction = resources`.

### Assignment guard

`fundedWrite` (`budgetMoves.ts`) checks every month an assignment affects. A past month
must have had the money by its own end; the current and later months must also keep
every later month's assignment funded. So an inflow funds its own month and later ones,
never an earlier one. An existing shortfall may stay, and reductions are always allowed,
but no write may deepen a shortfall. Missing exchange rates block any write that takes
money.

Overspending is the one exception, as in YNAB: you can always assign what Ready to Assign
shows. If a category is overspent, assigning that money elsewhere leaves next month's Ready
to Assign negative until you cover the overspending (Move money). Target funding, the
income review and manual edits therefore never offer an amount the guard refuses; payday
plans still hold back enough to cover this month's overspending.

### One pass, cached

Every figure above reads one ledger (`budgetLedger.ts`): each category's months walked
once with the carry after each, accounts' running sums by date, and activity by date.
A month or an as-of date is then a lookup, so the guard's checks over many months cost
one pass over history instead of one per month. The ledger is kept until
`fundingRevision()` changes (today's date plus a revision that SQLite triggers bump on
every write to transactions, accounts, assignments, categories and groups, rates, budget
settings, card funding and the household tables), and when the rate book is reloaded.
It is read-only: a changed input needs a trigger (a migration), or must stay out of the
engine. `budgetEngine.test.ts` holds it to the previous per-month engine, figure for figure.

## Envelopes linked to an account

An expense envelope can follow one account (`categories.linked_account_id`, set in **Settings →
Categories → Edit**). The linked account's side of a confirmed transfer with another personal
budget account counts in the envelope as `transferred`: into the account adds, back out takes
away (`linkedTransfers` in `budgetLedger.ts`). It sits next to `budgeted`, so:

`Available = carry + budgeted + transferred + activity`

Resources don't change (an internal transfer), so the envelope's larger Available comes out of
Ready to Assign, exactly like an assignment. Nothing is stored: the figure is read from
transactions, from the budget start on and up to the assessment date, with the same rule as
income for generated, unreconciled rows. Unlinking or deleting the account (`ON DELETE SET
NULL`) stops it without rewriting a transaction or an assignment.

- Only confirmed transfers count; an unpaired inflow stays ready to assign, and a transfer from
  an off-budget or household account is new money, not a contribution.
- One envelope per account (a unique index), only expense envelopes (not income or card
  payment), and only open checking, savings or cash accounts in the personal budget.
- Targets, auto-assign, goals and the annual overview count `transferred` with `budgeted`.
  The assignment guard and Move money are unchanged: `budgeted` is still only stored assignments.
- Read-only tokens can't set the link (`categoryManageAllows` lists the fields they may edit).
- Reports still leave internal transfers out.

## Resources

Resources are the dated balances of personal on-budget checking, savings, cash,
credit and line-of-credit accounts, converted using the existing currency policy.
Other on-budget assets contribute no positive spendable value; negative balances
reduce resources. Household pools and off-budget accounts contribute neither cash
nor debt. Closed accounts remain part of history until their balances are zero.
Internal transfers do not create resources. Boundary transfers retain the existing
personal contribution/category policy. Uncategorised adjustments affect actual cash
without being invented as income.

`reserved` (positive envelopes plus later positive assignments) is still reported, for the
Review partition. This is an **interim net-debt model** for unreviewed cards: their
outstanding debt reduces resources, and their purchases overspend like cash. Reviewed
payment reserves are added in [phase 6B](CARD-PAYMENTS.md) through this same service.

## Dates and currency

Today's funding uses the server's local calendar date (`todayIso`). Payday funding
uses the plan's configured time zone and supplies that explicit date to the same
service. A historical summary uses the earlier of month end and today. Future month
views show existing assignments and carry, but funding remains capped at today.
The response includes `asOf`; it is not a forecast. Assignment creation dates are not
available and are not reconstructed.

Opening funds become effective on the earlier of account creation and its first
transaction date, consistent with existing booked-value history. Editing an opening
balance changes that historical assessment explicitly. Opening funds do not become
earned income. Future-dated transactions and unreconciled generated salary receipts
are excluded. Reconciliation confirms a generated receipt. Missing account or activity
exchange rates mark the assessment incomplete and block new funding and moves.
The service uses account balances valued as of the assessment date and stored
transaction conversions for category activity. A foreign account's revaluation therefore
lands in Ready to Assign, the one place currency movements change; it is not earned salary.

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

## Balance checks and reconciliation

Ready to Assign still follows the signed-envelope calculation above. Before using it for
new funding, the service checks personal budget accounts for known discrepancies: Up's
current settled balance must match dated received register activity, and a closed cash or
debt account must not hold a residual balance. A bank account awaiting its first balance
also needs sync. Current bank snapshots are never compared with historical month ends.

The response includes `accountIssues`. While it is nonempty, `available` is zero, `resolved`
is false, and new manual, payday and card reserve funding is refused. Automatic assignment
previews have no available money. The raw resource/envelope arithmetic remains visible for
review; no bank record, starting balance or assignment is silently rewritten. Review and
resilience disclose the same incomplete balance check. Bank accounts describe where money
sits; category availability describes what is reserved for each purpose.

Closing requires a zero register balance, checked in the same transaction as the close.
Settings lists older closed accounts too, with a link to reconcile a residual explicitly.
Closing an account cannot erase cash or debt from the funding model. The owner should check
the actual closing statement before reconciling it to zero.

Reconciliation loads one complete dated snapshot, selects all current unreconciled parent
rows initially and excludes future entries and split children. A matching partial selection
may be confirmed, but an adjustment requires every current entry to be checked. A revision
and register-balance check reject stale saves. A correction and its reconciliation commit
in one database transaction; retries of a stale request cannot duplicate it. Corrections
remain distinct from earned income and spending. Only the owner session can use these
writing routes; MCP token scopes are unchanged.

On a bank-connected account, an income schedule remains an expectation for matching to the
actual receipt; it does not auto-create another deposit. A legacy generated income entry
must be reviewed against its bank receipt before reconciliation can make it received cash.
Schedules never auto-create entries in closed accounts. Existing transactions survive the
upgrade unchanged; these safeguards do not perform a live budget repair automatically.
