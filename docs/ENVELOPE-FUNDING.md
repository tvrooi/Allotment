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

**The cash breakdown.** `fundingState` also returns `breakdown`, naming the parts without changing
any figure: `cash` (the positive side of resources) and `otherDebt` (overdrafts and unreviewed
card debt it nets off), so `cash + otherDebt = resources`; `cardDebt` (`total`, `reserved`,
`unreserved`) for cards enrolled in card payments, whose debt resources leave out, with
`unreserved` the payment shortfall; `linked` (each linked envelope with its account's name and
amount) and `everydayEnvelopes`, which add up to `envelopes`; and `setAside` (later assignments,
holds and separate pools). So `cash + otherDebt − envelopes − setAside = unassigned`. Budget's
"How Ready to assign is worked out" and Review show it with `CashBridge`. Ready to assign does not subtract
unreserved card debt; the bridge shows it apart, with net cash `resources − unreserved`.

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

**Keeping overspending (ACT-04).** A category can instead keep its overspending, for spending
that will be paid back (`categories.keep_overspending`, set only by the owner in Settings →
Categories → Edit, never by an access token: it changes what Ready to assign means). Its deficit
then carries into the next month (`resets` is false in `budgetLedger.ts`, so `rollOver` and the
card engine's `poolAt` leave it alone), and because the envelope still holds the deficit, Ready
to assign is not reduced by it: Σ Available is unchanged. Assigning to the category covers the
deficit from Ready to assign; a repayment categorised to it brings it back to zero while the
cash comes back into resources. In a later month only the part of a carried deficit that was
really spent counts as cash already spent (`cashDeficitInto`, `cash` in `fundingState`): a
negative assignment in a later month is still a release, not spending. Money that covers a
kept deficit repays cash overspending first, then the earlier unfunded card purchases, which the
card payment then reserves (`cover` in `cardFunding.ts`), so the same money is not assigned
twice. What explains the part not yet covered stays card debt, as above. The deficit stays
disclosed: it still counts in `overspent`, so Review lists it (marked `kept`) and the budget is not "resolved" until it is repaid or covered. Only expense
categories can keep it; card payment and income categories already keep a running total.

A one-off such as a loan payout or settlement is therefore deducted once, not carried as a
deficit forever. The summary reports `cashOverspent` (this month's cash deficits) next
to `overspent` (all deficits, including credit). An automatic payday allocation leaves
enough to cover this month's cash overspending rather than assigning it again.

### Holding money for next month

**Hold for next month (ACT-03).** Money that is ready to assign but not for this month, such as
pay that covers next month's bills, can be held instead of left unassigned: **Hold money…** under
Ready to assign, in the current month only (`PUT /budget/:month/hold`, `setHold` in
`services/budgetHolds.ts`, table `budget_holds` with one row per month, owner only: no access
token reaches it). A hold is not an assignment: it touches no envelope and no account. In the month
it was held in and every month before it, `fundingState` subtracts it from Ready to assign
(`held`, on top of `laterDeduction`), so that month can reach $0 and read fully budgeted; from the
next month it no longer applies, so the money is ready to assign again there. While held it can't
be assigned, even to a later month's envelope: `assignable` in `budgetMoves.ts` checks every month
against `unassignedBeforeLater − futureAssigned − held`, so the one funded-write guard refuses it.
A hold can only be raised by what is ready to assign now after later assignments (it never makes
Ready to assign negative), and lowered or released at any time. A past month still shows its hold
(capped at what it had left, like later assignments), and a hold in a month before the budget start
is ignored. The identity is now `toBeBudgeted + envelopes + laterDeduction + held = resources`.
Planned assigning follows without a change: `planFunding` caps at `available`, which is after the
hold. Tests: `routes/budgetHolds.test.ts` (scenario, guard, backup), `budgetProperties.test.ts` (a
recompute with random holds, and a hold only moves Ready to assign between months), e2e
`budget.spec.ts`. Not built: Actual's automatic hold for living on last month's income.

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
Categories → Edit → Follows the account**). Owner-requested on 9 November 2026, it **mirrors**
that account: from the month the account takes effect (the earlier of its creation and first
transaction, and not before the budget start), Available at the end of each month, or on today
in the current month, is the account's balance. What brings it there after assignments and the
category's own activity is `transferred` (`mirrorSteps` and `currentTransferred` in
`budgetLedger.ts`, balances by `accountBalanceAt`, the same rule as Ready to Assign's resources):

`Available = carry + budgeted + transferred + activity` = the account's balance

- Everything in the account is the envelope's: transfers in and out, an unpaired inflow, money
  from an off-budget or household account. Interest that lands and is forwarded on (Up's
  "Forward to") nets to nothing; interest kept there stays in the envelope.
- Spending in this category from another account doesn't lower the envelope (the account didn't
  pay it), so it comes out of Ready to Assign.
- Resources include the account, and envelopes hold the same amount, so a transfer in moves money
  from Ready to Assign to the envelope and nothing else does. An assignment would change nothing,
  so `refuseLinked` (`budgetMoves.ts`) refuses assignments and Move money for a linked envelope,
  in every writer that goes through `fundedWrite` and in `fundingPlan.addAssigned` (payday plans,
  suggestions); auto-assign, **Fund targets** and payday rules leave it out. Earlier stored
  assignments stay as history and are balanced out; a later month's leftover assignment reserves
  nothing (`promised`, `carryInto`, `cashDeficitInto` skip it) and may be cleared to zero.
- A reviewed card's refund adjustment to a linked envelope is ignored (`budgetService.assessment`):
  the mirror already settled it.
- Targets, goals and the annual overview count `transferred` with `budgeted`; the Budget page
  shows "Move $X more to <account>" for a linked envelope's target.
- One envelope per account (a unique index), only expense envelopes (not income or card
  payment), and only open checking, savings or cash accounts in the personal budget. Nothing is
  stored: unlinking or deleting the account (`ON DELETE SET NULL`) returns the envelope to plain
  assignments without rewriting a transaction or an assignment.
- Read-only tokens can't set the link (`categoryManageAllows` in `auth/assistantPolicy.ts` lists the fields they may edit).
- Reports still leave internal transfers out.

## Accounts with their own Ready to Assign

Owner-requested on 7 November 2026: an account that pays only some bills (an Up Essentials
account for your own bills, say) can have its own Ready to Assign. **Edit account → Own Ready to
assign for the bills paid from this account** sets `accounts.assign_pool`; turning it on earmarks
the categories of the active recurring bills paid from it (`categories.pool_account_id`), and
**Edit category → Ready to assign from** changes one. Turning it off returns them to the main
figure. Code: `services/assignPools.ts`; both columns are in backups with their tables.

`fundingState` gives each pool `resources` (the account's own balance, by the same rules as
any budget account), `envelopes` (what its earmarked categories hold) and `readyToAssign` (the
difference). The main `unassigned`, `unassignedBeforeLater` and `toBeBudgeted` leave every pool's
`readyToAssign` out, so main plus pools is always the single figure the budget had before (a
property test in `readyToAssign.test.ts`). A transfer from another budget account into the pool
moves money from the main Ready to Assign to the pool's; spending from it on an earmarked bill
leaves its Ready to Assign unchanged. The assignment guard (`budgetMoves.ts assignable`) also
refuses a write that would take a pool below zero, with the pool's name in the message.
Later-month assignments and holds count against the main figure. The Budget page shows each
pool under Ready to Assign; `budget_summary` (MCP) includes `pools`.

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

## Planned assigning (one path)

Auto-assign, **Fund targets**, payday plans and assistant suggestions each decide what to add;
`services/fundingPlan.ts` does the rest the same way for all of them (audit F-13): `planFunding`
caps the additions at money unassigned today, in budget order, in one preview format (`rows` with
`proposed` and `shortfall`, `total`, `shortfall`, `complete`, `revision`); `applyFundingPlan`
rebuilds the plan inside the funded write and refuses one that differs from what was previewed
(409); `addAssigned` is the single write that adds to a month's assignment. On desktop Budget they
sit together in one **Assign** menu (`components/budget/AssignMenu.tsx`); on phones in the More menu.
Move money and typing an assignment stay on the envelope (below).

Auto-assign (`services/autoAssign.ts`) is also the month quick fill (ACT-05). Its strategies are cover
overspending, underfunded, assigned last month, spent last month, average spent over 3, 6 or 12
months (months without spending count as zero) and `zero`. The level strategies and `zero` take a
`mode`: `add` (the default) only tops an envelope up; `replace` sets it to the level, so a negative
`need` takes money back, never lowering an assignment below zero. `zero` always replaces and clears the assignment itself, whatever transfers moved through a linked
account, and cover
overspending and underfunded always add (the preview echoes the `mode` that ran). `planFunding`
applies reductions first, so the money they free can fund the additions in the same plan; the
funded-write guard still refuses a write that would leave Ready to assign short in any month.
Taking money back can overspend an envelope, so the preview marks such a row.

Every plan can be limited to chosen categories (BUD-07): `planFunding`'s `only`, sent as
`categoryIds` on the auto-assign and **Fund targets** preview and apply routes. The scope is part of
the reviewed plan, since the cap is shared out in order and leaving one envelope out changes the
others' amounts; apply rebuilds the plan with the same scope and refuses a different one (409). The
client's `useScopedPlan` and `FundingRows` do the ticking for both dialogs.

## Typing assignments (BUD-05)

The desktop table's Assigned editor and the phone sheet read what is typed with
`readAmountExpression` (`client/src/utils/amountExpression.ts`):

- **Sums.** `+ - * /` (and `×`, `÷`) with brackets and the usual order: `100+50` saves $150, `150*2`
  $300. Each number is read like any amount, in the budget's currency and separators (`12,50+1` with
  a decimal comma). Worked in exact fractions (BigInt), rounded once to the minor unit, half away
  from zero; no `eval`, no floats.
- **Never relative.** A sum doesn't start from what the field held: `+50` saves $50, like typing 50.
  One that starts with `*` or `/` (`*2`) is refused rather than guessed. Malformed sums, dividing by
  zero and results beyond the server's bound are unreadable: the editor stays open, marked invalid.
- **Plain amounts are unchanged.** Text with no operator between two numbers goes to
  `readTypedAmount` as before (`-50`, `(50)`, `$1,234.50`).
- **Signs agree.** An assignment can be negative on both desktop and phone (the phone used to drop
  the sign), and the editor opens with the sign (`assignmentToInput`), so saving an unchanged
  negative assignment keeps it.
- **Keys (desktop).** Enter saves and closes; Escape cancels; Down or Tab saves and opens the next
  envelope the table shows, Up or Shift+Tab the one before. Rows not on the page (collapsed
  sections, inactive rows, the filter's misses) are skipped, because the neighbour is read from the
  rendered rows (`tr[data-budget-row]`). An unchanged amount isn't saved again (no empty undo step).
  A refused save keeps the editor open with its reason and doesn't move. With no row that way, an
  arrow saves and closes and Tab saves and leaves the table. Clicking away cancels (the typed amount
  is dropped, nothing is saved); the History popover counts as part of the editor, and the window
  losing focus leaves the editor as it was.

Not built: one typed amount applied to several selected envelopes at once (a batch write needs its
own reviewed endpoint); Fund targets from a selection covers the common case.

## The inspector and notes (BUD-10)

`BudgetInspector.tsx` sits at the top of the sidebar (after Ready to assign on a phone). Ticking
envelopes changes no money.

- **Nothing ticked:** the month, with every expense envelope's total up front as **In envelopes**
  (quieter than Ready to assign, and not the table's Available column), split into
  spending envelopes and saved (envelopes with the Savings budget type, `savedSplit`), and
  From last month, Assigned and Activity folded under "What makes up In envelopes"
  (`selectionFigures` in `utils/budgetFigures.ts`, so Assigned and Activity match the Total
  expenses row), and the month's note.
- **One ticked:** that envelope's figures (plus **After expected bills** when recurring debits are
  still to come), its availability caption and target, its note, Fund target when it is short,
  and a link to its history and transactions.
- **Uncovered bills.** `availability()` reports `uncovered` (amber, "$25 short for Food bank", or
  "short of expected bills" for several) when `expected` exceeds a non-negative balance. The server's
  `expected` leaves out matched, paid and skipped occurrences, so a posted bill is in the balance
  and not counted twice. The rail's primary is "Put $X in an envelope…", or **Fund targets (n)**
  when a target is short.
- **Several ticked:** only their sums, their names, and **Fund N targets**, which opens Fund targets
  with only those ticked (`useScopedPlan.load(fetch, only)`; the others stay listed, unticked).
  Card payment rows have no tick.

**Notes.** `budget_month_notes` (one per month) and `category_notes` (one per category, the same in
every month, deleted with its category), migration 0077, backup format 29. `services/budgetNotes.ts`
is the one writer: `PUT /budget/:month/note` and `PUT /budget/category/:categoryId/note` (`{ note }`,
at most 2,000 characters, trimmed, empty removes it); `GET /budget/:month/note`, and each category
in `GET /budget/:month` carries `note`. Neither table has a `budget_revision` trigger: a note moves
no money, so it never makes a funding preview stale. Owner only: an access token can read notes
(GET under `/budget`) but never write them (`accessTokens.test.ts`). `NoteField.tsx` saves when the
field is left, so ticking another envelope or closing the phone sheet keeps what was typed; a
refused save keeps the text with the reason. On a phone, a category's note is in its amount sheet.
The demo budget has one of each. The older, unused `budget_months.notes` column stays unread.

## Moves, coverage and undo

Move money works on desktop and phone. Its button reads Cover overspending while an
envelope is overspent, and Move between envelopes otherwise. Choose two distinct
expense categories and a positive amount, preview their resulting availability,
then apply. The source must have availability through every affected month, including
later spending when editing a historical month. Future-month moves are not enabled.
The assignment pair and durable operation are written in one database transaction.
A database revision changes for relevant writes, even changes later reversed, and
prevents competing previews from reusing source money.

**From the budget row (BUD-06).** The Available figure of an envelope that isn't $0 is a button in
the desktop table and the phone cards (`useMoveRequest`, `store/moveRequestStore.ts`): with money
it opens the panel with that envelope as the source, overspent it opens it as the destination
with the deficit as the amount. It only prefills the same preview and apply path; nothing is
written until Apply move. The row buttons are absent for a future month.

**Returning money to Ready to assign.** `READY_TO_ASSIGN` (`budgetMoves.ts`, mirrored in
`MoneyMoves.tsx`) is accepted as a move's destination only. It is not a category or an account:
`previewMove` reports Ready to assign now (`fundingState(today).unassigned`) as the destination's
available figure, `moveWithinTransaction` writes only the source's assignment (the month's
assignment falls by the amount, so the envelope's available falls by it and Ready to assign rises
by exactly it), and the `budget_moves` row keeps the sentinel as `destination_id` (no migration:
that column has no foreign key), so history and undo name it and undo restores the source alone.
The same availability, current-or-past month, revision and stale-undo rules apply. Assigning it to
an envelope again is the ordinary guarded assignment. A goal's retire-and-move refuses it
(`goalLifecycle.ts`), so a goal change still moves money between categories only.

**Target figures.** The preview's `sourceTarget` and `destinationTarget` hold how much a funding
target still asks for before and after (`targetEffect`; null when there is no target or the move
doesn't change it). A target's requirement depends on what was carried in, not on this month's
assignment, so only the assignment change moves it. Tests: `readyToAssign.test.ts`,
`budgetProperties.test.ts` (Ready to assign rises by exactly the amount, nothing else changes,
undo restores every row), e2e `envelope-funding.spec.ts`.

History shows the latest 100 operations. Undo restores both assignments atomically
only if no relevant financial change has intervened. Revision checks are deliberately
conservative: imports, account/rate changes, category edits and another allocation
require a new reviewed move. Day changes also invalidate old previews/undo. Category
targets read the new assignments, and the preview says how a move changes them.

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

**A start day (a fresh start mid-month).** The start can also be a day in its month
(`budget_settings.budget_start_day`, migration 0063; null = the month's first day). Activity
before it is history in the same way, so the start month's earlier spending is neither
overspending nor uncategorised. A new budget connecting its first bank starts **today**
(`startBudgetIfNew`, called by `POST /up/map-accounts`): Ready to assign is then exactly the money
in the accounts, instead of the month's earlier spending showing as cash overspending and Ready
to assign exceeding cash. The Up dialog says so and offers **Count all of _month_ instead**
(`PUT /budget/start` with `day: null`); **Settings → Budget** shows and changes it. A start on the
1st is stored as the month alone.

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

### Expected bill details

The funding note above the category bar opens a read-only popover (`ExpectedNote`) on desktop and
phones. It lists the remaining recurring bills with dates, shows how much their envelope
covers, and gives the balance after those bills. Enter opens it; Escape or Close dismisses
it. The phone Activity link remains separate. Displayed dates follow the date preference.

Each bill name links to `/recurring?schedule=<id>`, opening its existing recurring editor.
The page waits for schedules to load and consumes the parameter so reload does not reopen
the editor. A missing schedule leaves the recurring page open without creating a new item.

The note reads "$X needed by the 10th" for the first day whose remaining bills exceed
what is available, combining bills due that day. It shows only that first gap, not later
funding needs; the popover lists all remaining bills. Covered bills show "Funded".

"Assign to [envelope]…" in the breakdown closes it and opens the existing desktop amount
editor or phone planning sheet. It changes no money until the owner saves. The shortcut is
omitted when offline, before the budget start, or for an account-linked envelope.

The dated funding note replaces the repeated bill-shortfall caption beside Available.
The amber Available figure, overspending and target warnings remain. If bill detail is
missing, the shortfall caption stays as a fallback.

A funding deadline before the current local calendar day turns the deadline text and
Available bubble red, without a visible overdue suffix. The original due day stays visible,
and the accessible label names the overdue state. Due today and funded envelopes are not overdue.

The breakdown explains the next funding gap with bills due by that date, the amount already
covered, and what is still needed. Its bill list separates everything due by that deadline
(including earlier bills) from later bills, so the gap is not confused with the whole-month
shortfall. The overall coverage and balance after all expected bills remain visible.
