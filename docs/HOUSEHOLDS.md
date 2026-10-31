# Household attribution and shared expenses

Phase 4 adds a private **Household** page. It supports AUD groups with two or more
people, one of whom is you. Participants are accounting participants, not inferred
bank account holders, and they do not receive access to your budget.

Create a group with yourself first. Optionally select a household pool account.
Only select an account used for the household: its entire cash and transaction
history is excluded from personal envelope budgeting and payday funding. The
register, starting balance, bank IDs and reconciliation remain unchanged. Review
historical budget figures after linking an existing account.

Two accounting policies work together:

- **Contribution-based personal budgeting:** categorize confirmed payments from
  personal funds into the household as contributions. The personal side of a
  confirmed transfer across this boundary counts in its selected category. Pool
  cash, housemates' deposits and unpaid reimbursement claims cannot fund your
  personal payday plan. Future allocations and envelope balances still use the
  existing monthly budget service.
- **Expense-share reporting:** the Household page shows the group's gross expenses
  and your agreed shares. Contributions and repayments are funding events, not
  another expense or salary. Do not add this report's shares to your personal
  contribution-based budget totals; these answer different questions.

## More pool accounts, default splits and sharing in one step

A household can have **several pool accounts** (**Household → Sharing → Household accounts**),
for example an Up 2Up spending account and the 2Up saver its bills come from. Each one leaves
the personal budget exactly as the first does, and pool expenses and contributions may use any
of them. An account belongs to at most one household. The first pool account stays; others can
be removed while no household entry links one of their transactions.

The **default split** (equal, percentages in basis points, or weights) is what quick sharing
uses. **Share with household** records a payment as an expense with that split: paid by you
when it left a personal account, or by the pool when it left a pool account (which needs
received contributions, as before). From the register it shares every payment in the current
list, each checked on its own, so one refusal doesn't stop the rest; **Undo** removes the
entries it made. **Pick to share** in the register puts a checkbox on each payment
(money out that isn't a transfer); tick the ones you share, or **Pick all shown**, then
**Share _N_ picked with household**. Without a default split, sharing splits equally, so a
two-person household is 50/50. A rule action, **Share with household**, does the same for matching payments
as they import (or when the rule is applied to existing transactions), and never fails an
import: a payment the household checks refuse is left unshared.

**Repayment suggestions** list money received in your personal accounts within the last 120
days whose payee contains the name of someone who owes the household, up to what they owe and
what is owed to you, and not yet linked. **Record repayment** saves it as their settlement to
you. Nothing is recorded without that click.

## Recurring bills

Bills you already track in **Recurring** can be shared with a household: **Household → Recurring
bills → Add recurring bills**, then tick the ones you split (any active, repeating payment that
isn't a transfer). A bill is shared with one household at a time. Each one lists its frequency, its
next date, everyone's share of the expected amount with the household's default split, and its
payments from the last six months: those matched to it in Recurring, and those to its payee. A
payment that isn't shared yet can be shared in one click (**Share _N_ payments**), which records it
exactly as **Share with household** in Transactions does, but with the bill's split. **Change
split** gives a bill its own equal, percentage or weight split; **The household's default split**
puts it back. **Share new payments automatically** shares each new payment to the bill's payee as
it is imported, from the day it was ticked: money out only, never a transfer or a split part, and
a payment the household refuses is left unshared rather than failing the import. Older payments
stay a click. A **Share with household** rule that matches the payment comes first. **Stop
sharing** takes a bill off the list and leaves its shared payments in the household. These links
are in backup version 20 (`household_recurring_bills`, with `split_json` and `auto_share_from`);
older backups restore without them.

## People

**Add person** under People & balances adds someone with a zero balance. An equal split includes
them from then on; a percentage or weight split (the default or a bill's) leaves them out until it
is changed. **Rename** changes a name and keeps that person's entries, shares and balance. Names
are unique within a household, ignoring case. People can't be removed yet.

## Combining with another person

With multi-user mode (separate budgets per person, `docs/MULTI-USER-PLAN.md`), two people who
each keep a household in their own budget can combine them: **Household → Combine with another
Allotment user**. One asks, choosing which of their household's people is the other person; the
other accepts with one of their own households, choosing who the first person is in it. Both
households must use the same currency.

Once combined, each sees one register of both households' entries, newest first: date, amount,
kind, the merchant and its logo for an entry linked to a bank payment, who paid and the full
split, whose entry it is, and anything flagged for review. Balances add both ledgers, with the two
linked people counted once each; other people (housemates) stay separate, as each household
named them, and a household pool payment moves no one's balance. Each person edits only their own
entries, in their own budget. One **shared note** per entry is the exception: either can edit it,
and it shows who changed it last. An expense both recorded on the same day for the same amount is
flagged as a possible duplicate.

Nothing is copied between budgets. The gateway (`server/src/gateway/sharing.ts`) puts the register
together each time it's opened from each budget's `GET /api/households/:id/shared-export`, which
gives only the group's name and currency, its people, and its entries with their shares and
merchants: never an account, category, transaction note, bank balance or pool cash. The links and
the shared notes are kept in the gateway's `people.db`. Either person can stop combining at any
time (**Stop combining**, or declining or cancelling a request); the other's view ends at once and
the shared notes are deleted. Both households keep their own entries. Read-only access tokens and
the MCP endpoint belong to one budget and never reach a combined register.

## Expenses and people

Record a shared expense with a date, total, payer and participants. Choose equal,
percentage (integer basis points, 10000 = 100%), weight or exact dollar shares.
Allocations are saved in cents. Equal/weighted rounding uses the largest remainder,
with displayed participant order breaking ties. For $100 split three ways the
saved amounts are $33.34/$33.33/$33.33. Exact mode can move the residual cent.

A direct payment credits its payer and debits each participant's agreed share.
Someone else can pay without adding a transaction to your bank register. Select an
existing bank payment when it belongs to you; its date, amount, currency and
payment direction must match. Linking is metadata only. A payment or either leg of
a confirmed transfer cannot be linked twice.

A positive person balance is prepaid credit or an amount owed to that person;
a negative balance means they owe the group. Balances net obligations across the
group. Repayments move credit between people, support partial amounts and can
settle balances spanning several expenses. Overpayments beyond either person's
outstanding balance are rejected. They are net group settlements, not a legal
per-invoice debt assignment.

For personal repayments/refunds, categorize the bank receipt against the original
expense rather than salary. The Household report excludes repayments from spending;
the bank/category budget retains the real cash refund. Linked transaction notes,
payees, reconciliation and expense categories remain editable. Remove the household
entry before changing the bank amount, date, account, split or transfer structure.
If a bank sync removes a linked payment, its household entry and saved shares remain;
the bank link is detached and the entry is visibly flagged for review. Sync can
continue without silently erasing the agreed expense.

Refunds reference the original expense and reverse its saved shares. Partial
refunds allocate proportionally to the remaining unrefunded shares; the last refund
reverses the remaining cents exactly. Cumulative over-refunds are rejected. To
correct a mistaken entry, remove it in the event history and enter the correction.
Remove dependent refunds first; contributions already consumed or reserved for
bills cannot be removed without correcting those dependent entries.

## Advances and shared bills

Record received advances from each person into a selected pool before recording
pool expenses. Each advance credits that person; spending the pool consumes the
agreed shares. For $4,780 rent with an explicit 40/30/30 allocation, advances of
$1,912/$1,434/$1,434 leave all balances zero after payment. Paying personally
instead leaves $2,868 owed to you. Do not record an advance and a repayment for the
same receipt.

Bills have a due date, total estimate or billed amount, personal estimate and
reserved amount. **Edit** changes a bill's name and due date at any time, and its amounts while
no expense is matched to it; **Delete** removes a bill with no matched expense and releases its
reservation. Reservations use the smaller of received ledger funding and bank
cash, after other reservations. They can be increased across paydays as actual
contributions arrive. Account cash by itself is not bill coverage. Payment consumes
its bill reservation; an unrelated expense cannot consume funds reserved for other
bills. Bills show funded, shortfall, due, paid or needs-review status. Cash falling
below existing reservations and refunded/partial bills need review.

A bill can reference an existing recurring schedule with automatic transaction
creation disabled. The schedule cannot subsequently enable automatic creation while
linked to a shared bill. Select the imported debit and bill once when recording its
expense. Use the existing Recurring matching workflow for schedule occurrences;
this page does not create duplicate debits or initiate payments. Enter separate
bill occurrences for later quarters/months; estimates do not generate bank activity.

## Reports and portability

Select **My share** or **Household**, with optional date bounds. Scope persists on
this device and appears in the heading and downloaded JSON statement. Gross and
personal amounts remain visible together. Current person balances include all
periods; date bounds apply to expense reporting. The normal account register remains
the bank-movement view. Net Worth remains the existing full-bank-balance wealth
report; this release does not infer personal ownership of joint-account assets or
add unpaid receivables as extra accounts.

Groups, people, agreed shares, events and bills are included in portable backup
version 6 and restored atomically alongside the phase 3 payday history. Older
backups restore with an empty household ledger. Bank tokens remain excluded.

Cross-currency household conversion, invitations, individual logins, collaborative
permissions, automatic Up bill-definition imports and Tricount sync are outside
this private AUD ledger. Agreed shares are entered explicitly.
