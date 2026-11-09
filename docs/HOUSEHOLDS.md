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

The page opens with **Recurring bills**, then **People & balances**. The expense statement and
**All contributions, payments & repayments** list entries newest first. They open on the newest
entry's month and the month before it, counted from that entry rather than from today, so a
quiet household still shows its last activity. **Show older** reaches the next hidden entry and
three months more (`client/src/components/household/recentEntries.ts`). A **From** date shows its
whole range. The statement's total and its export always cover the chosen dates (all of them
when none are set), not just the rows on screen. The server keeps sending entries oldest first;
only the page reverses them.

### Bills coverage

With a household account, **Bills coverage** sits at the top of the page, like the dial in Up's
Essentials. It compares what the household accounts hold now with the bills they will pay in the
next 30 days (`COVERAGE_DAYS`): "A$150 of A$1,320 needed by 8 Dec", a meter, and what is still to
be paid in. The bills it counts are:

- every expected date of a shared recurring bill paid from a household account
  (`sharedRecurringBills` → `upcoming`); and
- one-off bills that are not fully paid, including overdue ones. A one-off bill tied to a shared
  recurring item is left out, because that item's dates already count it.

Each person's row shows their part of those bills, from the bill's split (the same `billShares`
the bill list uses), and what they have paid in since the first of the month. The figures come
from `householdCoverage.ts` through `GET /api/households/:id` (`coverage`), so MCP `household` reads them too. They are a
projection only and never write. The older figures (in the account now; paid in, less what the
account paid; not set aside for a bill) are under **Household account figures** in People &
balances.

## More pool accounts, default splits and sharing in one step

A household can have **several pool accounts** (**Household → Sharing → Household accounts**),
for example an Up 2Up spending account and the 2Up saver its bills come from. Each one leaves
the personal budget exactly as the first does, and pool expenses and contributions may use any
of them. An account belongs to at most one household. The first pool account stays; others can
be removed while no household entry links one of their transactions.

The **default split** (equal, percentages in basis points, or weights) is what quick sharing
uses. **Share with household** records a payment as an expense with that split: paid by you
when it left a personal account, or by the household account when it left a pool account. From the register it shares every payment in the current
list, each checked on its own, so one refusal doesn't stop the rest; **Undo** removes the
entries it made. **Pick to share** in the register puts a checkbox on each payment
(money out that isn't a transfer); tick the ones you share, or **Pick all shown**, then
**Share _N_ picked with household**. Without a default split, sharing splits equally, so a
two-person household is 50/50. A rule action, **Share with household**, does the same for matching payments
as they import (or when the rule is applied to existing transactions), and never fails an
import: a payment the household checks refuse is left unshared.

Every way of sharing (the Share action, a bill's **Share** list, a bill shared as its payments
arrive, a rule) goes through one function, `householdService.sharePayments` (audit F-13): the
same checks, the same refusal messages and the same result for each payment, which is who owes
what (`{ ok, eventId, amount, shares }`) or why not. `POST /households/:id/share` with
`preview: true` runs exactly those checks and records nothing.

**A household's picture** (**Household → Sharing → Picture**) shows next to every payment
shared with it, in the register, on phone cards and in the transaction details; without one, the
household's initial shows on a coloured square (households are square, merchants round). It is
a small PNG, JPEG or WebP image, like an account or payee logo (`household_groups.logo`,
migration 0061, `PUT /api/households/:id/logo`, owner only; no access token reaches it). It is
kept in backups and never sent to a combined household. A payment the register lists carries
`household: { id, eventId, kind }` when it is linked to an entry in a household, and the details then
show **Shared with _name_** and **View in household** (`/household?household=<id>`) instead of
the share buttons.

**Right-click a transaction** in the register (or press Shift+F10 or the Menu key on it, long
press it, or tap ⋯ on a phone card) for its menu (`components/ui/ContextMenu.tsx`,
`components/transactions/TransactionContextMenu.tsx`):

- **Share with ▸** lists each household with its picture and split; choosing one shares the
  payment at once with that household's default split, and the toast offers **Undo**.
  **Custom split…** opens the Household page's form for it. While payments are picked, right-
  clicking one of them shares all of the picked ones (**Share _N_ picked with ▸**).
- A payment that can't be shared (money in, a transfer, a split as a whole, a balance
  correction) shows the item greyed out with the reason. With no household yet, the item opens
  the Household page.
- A shared payment shows **View in _household_** and **Stop sharing with _household_**. Stop
  sharing removes the entry; **Undo** records it again with exactly the same shares (a
  `mode: 'exact'` entry). Entries for money in (contributions, settlements) are removed on the
  Household page, not from the menu.

The menu is keyboard-operable (arrows, Home/End, Right or Enter opens the sub-menu, Left or
Escape goes back, Tab closes) and returns focus to the row. On a phone the sub-menu opens in
place with **Back**.

**Settle up** (**Household**, under People & balances) lists who should pay whom to clear what
people owe each other for things they paid themselves: at most one fewer repayment than there
are people, each within both people's balances. **Record** saves one as a repayment. If one of
your bank payments, or money you received, already looks like it, the button reads **Link
payment** and records that instead, so it isn't entered twice. What people owe the household
account is listed apart as "puts $x into the household account", never as a repayment between
people. Nothing is recorded without a click.

**Repayment and contribution suggestions** (**Household → Sharing**) list money received in
the last 120 days that isn't linked yet:

- money into your personal accounts whose payee contains the name of someone who owes for
  things people paid themselves, up to what they owe and what is owed to you. **Record
  repayment** saves it as their settlement to you. What someone owes the household account is
  never counted as owed to you.
- money out of your personal accounts whose payee contains the name of someone you owe for
  things they paid themselves, up to what you owe and what they are owed. **Record your
  repayment to** saves it as your settlement to them.
- money into a household account whose payee contains the name of someone in the household, or
  a transfer into it from one of your own accounts. **Record contribution** saves it as their
  contribution.

Nothing is recorded without that click.

## Paying ahead for a shared expense

Money you send someone in a household towards something you share, before anyone has recorded
the expense (your part of a bill they will pay, say), can be marked as **paid ahead**: right-click
the payment in the register (or ⋯ on a phone card) and choose **Paid ahead to ▸ _person_**, or open
it and choose **Paid ahead for a shared expense**. It is saved as a repayment paid ahead from you
to them (`kind: 'settlement'`, `advance: true`, linked to the payment), the same entry the
Household form's **Paid ahead** tick makes. Until the expense is recorded they owe it back to you;
once it is (by you on the Household page, or by them in their own budget when the households are
combined), your share of it comes off, and any difference stays in the balances. Nothing is
matched by guess: the advance is not tied to one expense.

Only your own money out can be paid ahead: not money in, a transfer between your accounts, a
split, a balance correction, a payment already in a household, or a payment from a household
account (that is the household's money, so the server refuses a repayment linked to one).
**Undo** in the toast, or **Remove from _household_** in the menu, removes the entry. The
activity log says "Me paid Juno $60.00 ahead" when it is more than was owed. `GET /households`
lists each household's `people` (id, name, `isSelf`) for the menu. The bank payment keeps its own
category; **Categorise repayments** can suggest one once the expense is recorded.

## Recurring bills

Bills you already track in **Recurring** can be shared with a household: **Household → Recurring
bills → Add recurring bills**, then tick the ones you split (any active, repeating payment that
isn't a transfer). A bill is shared with one household at a time. Each one lists its frequency, its
next date, everyone's share of the expected amount with the household's default split, and its
payments from the last six months: those matched to it in Recurring, and those to its payee. A
payment that isn't shared yet can be shared in one click (**Share _N_ payments**), which records it
exactly as **Share with household** in Transactions does, but with the bill's split. **Change
split** gives a bill its own equal, percentage or weight split; **The household's default split**
puts it back. A bill's own split can also be **Fixed amounts**: a set dollar amount for each
person, such as everyone's part of the rent. They're saved in cents and used exactly. A payment
they don't add up to isn't shared (sharing it says what the amounts add up to and what the
payment is, and automatic sharing leaves it unshared), and the bill warns when its next
expected payment differs. The household's default split can't use fixed amounts, since it
applies to payments of any size. **Share new payments automatically** shares each new payment to the bill's payee as
it is imported, from the day it was ticked: money out only, never a transfer or a split part, and
a payment the household refuses is left unshared rather than failing the import. Older payments
stay a click. A **Share with household** rule that matches the payment comes first. **Stop
sharing** takes a bill off the list and leaves its shared payments in the household. These links
are in backup version 20 (`household_recurring_bills`, with `split_json` and `auto_share_from`);
older backups restore without them.

### Amounts that change, and one-off bills

Each recurring bill is a tile with its due date in words ("Due in 3 days", "Overdue since …"). When
its newest payment is outside the schedule's tolerance of the expected amount, the tile says
**amount changed** and offers **Update to** the last amount or **Use the average of the last 3**
(`services/billDrift.ts`, the tolerance from `matchingEngine.ts`: exact 0%, approximate 10%,
variable 25%), or **Keep** when the change was intentional, such as a price rise not billed yet.
Nothing changes without that click. **Edit amount** sets the expected amount and how it varies.
Setting the amount or how it varies, anywhere, records the day in `schedules.amount_confirmed_at`
(migration 0087); **Keep** records it without changing the amount. Payments on or before that day
never flag the bill again, so only a later payment that still differs does. All of these save the schedule through `PUT /api/schedules/:id`, with Undo, so Recurring and the
forecast follow. The same update moves the schedule's household bills that are due from today and
have no payment matched to them to the new amount, with my share recomputed by the bill's split
(`followScheduleAmount`), in the same database transaction. Bills already paid, due before today, or
with more set aside than the new amount keep what they were: reservations are never changed, so Undo
puts everything back. The tile also lists its payments from
the last six months, newest first, with their total. Frequency and dates are still changed in
Recurring.

### Bills the household account pays

With a household account, **Looks like a bill** lists payees the account pays again and again that
aren't recurring bills yet, like power every two months or water every quarter
(`services/householdBillSuggestions.ts`). Schedule discovery only finds weekly to monthly habits over
four months, so this reads a year of money out of the household's own accounts. It skips transfers,
split parents, and payees a live recurring item already covers (`scheduledPayeeKeys`). It needs two
payments or more whose median gap reads as monthly, every 2 months, quarterly, every 6 months or
yearly, and the last payment can be no more than one and a half usual gaps ago. **Add as household
bill** creates a variable recurring item from the last payment on (its amount the median of the last
three, linked to that payment, through `createDiscoveredSchedules`) and shares it with the household.
**Not a bill** stops suggesting that payee for this household (`household_bill_dismissals`, migration
0086, backup version 34; older backups restore with none). Routes: `GET
/api/households/:id/bill-suggestions`, `POST …/bill-suggestions/add` with `{ id }`, `POST
…/bill-suggestions/dismiss` with `{ payeeKey }`. They are owner only, not on the token allowlist.

**One-off bills** (formerly "Bills to reserve for") sit under the recurring bills: a bill that
doesn't repeat, with money set aside for it from the household account.

## Editing a household

**Edit** beside the household's name renames it (`PUT /api/households/:id` with `{ name }`); its
people, entries and balances stay as they are. **Open this household first** makes it the default
(`{ isDefault: true }`, the `is_default` column, kept in backups): the Household page and the
sidebar's Household link open it unless the address names another (`?household=`). Only one
household is the default; with none, the first one opens. Both are owner-only settings, so access
tokens can't change them; `list_households` shows which one is the default.

## Where the balances come from, and reconciling them

Each person's balance is two parts (`householdLedger`): **household account**, money they put
in less their share of what the household account paid, and **between people**, what they paid
for others less their share of what others paid, after repayments. **Where these figures come
from** under People & balances shows both parts per person. The amount beside Household in the
sidebar is something else: the household accounts' bank balance.

**Reconcile balances** agrees everyone's balance from a date (0 unless another figure is typed;
positive is credit held in the household account). It records up to two adjustment entries,
`pool_adjustment` (each person's household-account part moves to the agreed figure) and
`balance_adjustment` (what people owe each other directly is cleared; its shares add up to 0),
dated that day and described "Balances agreed on …". Earlier entries stay as they were, and
removing the adjustment entries (they can't be edited) brings the old balances back. It is refused
when nothing would change, or when bill reservations would no longer be covered. Routes:
`GET /api/households/:id/reconcile` previews agreeing everyone at 0;
`POST /api/households/:id/reconcile` with `{ date?, agreed?: [{ personId, amount }] }` records it.
An `organise` token can only propose it (MCP `propose_household_reconciliation`, after
`household_reconciliation_preview`), and the owner applies it; applying is refused if any balance
changed since.

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
Allocations are saved in cents. Equal/weighted rounding uses the largest remainder. When
shares tie, the spare cent starts at a place taken from the linked bank payment (or the new
entry's id when there is none), so it doesn't always land on the first person, and sharing the
same payment again after Undo gives the same split. For $100 split three ways one person is saved with $33.34
and the others $33.33; which one varies from entry to entry. Saved shares never move. Exact
mode can move the residual cent. A refund reverses the original shares exactly.

A direct payment credits its payer and debits each participant's agreed share.
Someone else can pay without adding a transaction to your bank register. Select an
existing bank payment when it belongs to you; its date, amount, currency and
payment direction must match. Linking is metadata only. A payment or either leg of
a confirmed transfer cannot be linked twice.

A positive person balance is prepaid credit or an amount owed to that person;
a negative balance means they owe the group. Balances net obligations across the
group. With a household account, **People & balances** also shows each balance in two parts:

- **The household account:** what they put in less their shares of what the account paid.
  Negative means they owe the household account (not you); positive is credit held there.
- **Things people paid themselves:** a direct payment credits its payer and debits everyone's
  shares; repayments move it between people. Only this part is owed to a person.

The two parts add up to the balance, and the household-account parts add up to the pool. Repayments move credit between people, support partial amounts and can
settle balances spanning several expenses. Overpayments beyond either person's
outstanding balance are rejected; a repayment within what is owed for things people paid
themselves is accepted even while either person owes the household account. They are net group settlements, not a legal
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
correct a mistaken entry, use **Edit** on it in the event history (below), or remove it and
enter the correction; remove dependent refunds first. Removing a contribution the household account has
already spent leaves its payer owing the account again; one still needed for bill
reservations can't be removed until they are released.

## Editing an entry, and the activity log

**Edit** (`PUT /households/:id/events/:eventId`, `updateEvent` in `householdService.ts`) changes
an entry under its own id, so refunds and the bank link keep pointing at it. The body is a full
entry, as for a new one; the edit removes the entry's shares and runs `recordEvent`'s checks
against the ledger without it, all in the route's one database transaction, so a refusal changes
nothing. Rules:

- The kind and the bank payment never change. An entry linked to a bank payment keeps that
  payment's date and amount (the existing bank checks), and can change its description, payer and
  split.
- A refund, and an expense a refund depends on, change their description only (the body is
  `{ description }`).
- Afterwards no repayment that was within what was owed at its place in the ledger may now exceed
  it (`validSettlements`), and money set aside for bills must stay covered. The bill an entry is
  matched to stays with it.

**Activity** (`GET /households/:id/activity`, table `household_activity`, migration 0074) records
a line for each entry added (`created`), repaid (`settled`), shared by a rule or a shared recurring
bill (`auto_shared`, with its `source`), edited (`edited`, naming what changed) and removed
(`removed`). A line holds its whole sentence, because the entry may be gone; `event_id` has no
foreign key for the same reason. The newest 500 lines per household are kept, and the log goes
with its household. Lines are written inside the same transaction as the change, so a refused or
previewed change leaves none. It is in backup version 27; older backups restore with an empty log.
`sharedExport` includes the newest 50, and the combined register merges both households' lines
(`activity`, each with who made it). Only the owner can read or write it: it is not on any access
token's allowlist. Removing an entry is `removeEvent`, the same code the Remove entry button and
Undo use.

## Advances and shared bills

Record what each person puts into the household account as a contribution (an advance).
Each one credits that person; a payment from the account consumes the agreed shares. For
$4,780 rent with an explicit 40/30/30 allocation, advances of $1,912/$1,434/$1,434 leave all
balances zero after payment. Paying personally instead leaves $2,868 owed to you. Do not
record an advance and a repayment for the same receipt.

The household account can pay before everyone has put their part in: a payment from it is
recorded whatever has been contributed, and each person's unpaid share shows as owed to the
household account until their contribution arrives. The one limit is money reserved for bills:
a payment can't spend what is reserved for other bills.

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

**Categorising a repayment** (audit decision I-8, `services/householdCategoryOffers.ts`): someone
repaying you shows in your personal reports as an uncategorised deposit next to the whole bill you
paid, and your repayment to someone for things they paid shows as uncategorised spending. The
Household page's **Categorise repayments** lists each repayment linked to an uncategorised bank
row, either way:

- **To you** (a deposit): the categories of what that person owed you for in the year before
  (their shares of expenses you paid, largest first).
- **From you** (a payment, marked "you paid"): the categories of your shares of expenses the
  person you repaid paid in the year before. Their expense has no bank payment of yours, so its
  category comes from the payee its description names exactly, ignoring case: that payee's
  default category, else the spending category you use most for it. An expense whose
  description names no payee isn't counted.

**Categorise** sets the bank row's category, a normal transaction edit, so your reports show your
share; **Not now** hides it on this device. Nothing is changed without that press, and the
household ledger never changes (`GET /households/:id/category-offers`, each offer with
`direction` `to_you` or `from_you`).

**Spending by month, person and category** (SPL-05, `services/householdReport.ts`) breaks the
same range down three ways, from the statement route (`GET /households/:id/statement`, so the
assistant's `household_statement` returns it too). Only expenses and refunds count; repayments
and contributions are not spending. _By month_: gross and your share. _By person_: what each
person paid directly, their share, and paid less share; spending the household account paid
is listed on its own line and is nobody's payment. _By category_: the category of the bank
payment an entry is linked to (a household entry has no category of its own), largest first;
entries with no payment, or a payment with no category, are under Uncategorised, listed last. Each
breakdown adds up to the same total. It is a report only: nothing here changes a category or a
budget figure.

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

## Recurring and the dashboard

Housemates' money is never the owner's income, and a shared bill counts in personal figures at
the owner's share only (owner's decision, 6 November 2026: net against the bill). One server
helper, `scheduleScopes` in `server/src/services/scheduleScope.ts`, gives every recurring item a
**scope**, returned as `scope` by `GET /schedules`, `GET /schedules/:id` and
`GET /schedules/occurrences`:

- **personal**: an item in a personal budget account, or with no account.
- **household**, with the household and a role:
  - `bill`: money out of a household (pool) account, or a recurring item shared with the
    household on its page, wherever it is paid from. `myShare` is the owner's cents of the
    expected amount, from the bill's own split or the household's default (`billShares` in
    `householdService.ts`, the same sums as the Household page's recurring bills). A household
    account's bill that isn't on the recurring bills list takes the owner's part of how its
    newest payment matched in Recurring was shared, scaled to the expected amount (rent in fixed
    amounts stays in those amounts); before any is shared, the household's default split.
  - `contribution`: money into a household account, or the owner's own transfer into one. The
    person is the owner for their own transfer, else the housemate the payee was recorded as, else
    the one whose name is in the payee or the item's name (`personNamedIn`, shared with the
    repayment suggestions).
  - A deposit into a personal account, or with no account, is a housemate's contribution only
    when its payee was already recorded as that housemate's money: a contribution, or a
    settlement paid to the owner (`housematePayees`). This is learned from what the owner
    recorded, never guessed from a name.
- **off_budget**: an item in any other off-budget account.

Where it is used:

- **Recurring → Monthly** has three sections: **Income** (the owner's money in), **Expenses**
  (the owner's money out, plus "Your share of Rent (2Up)" for each household bill, with the full
  amount beside it), and **Household account**, collapsed, with the bills in full and each
  contribution. The summary totals cover the first two only. The grouping is
  `groupOccurrences` in `client/src/components/recurring/scheduleFormat.ts`.
- **All recurring** marks household items with the household's icon, and a contribution isn't
  shown as green "+" income. **Find recurring** labels a household account's items "Household
  bill" or "Household contribution", and never gives a deposit into one an Income category.
- **Dashboard**: "Bills and income" lists a household bill at the owner's share, marked as shared;
  "Next pay" is the owner's own income only.
- **Forecast** and **Review** (`isPersonalIncomeSchedule`): household money is never expected
  pay. A housemate's deposit saved without an account isn't forecast at all; one into a personal
  account still counts as cash coming in, but not as income. Household bill shares in the
  forecast are unchanged (`includeHousehold`), so the owner's transfer into the household
  account and their share of the rent aren't both counted.
- **Budget page and payday plan** (`plansInPersonalBudget` in `services/balances.ts`): an
  envelope expects a recurring payment, and the payday plan funds it, only when it leaves one of
  the owner's open personal accounts, spent or moved into a household or off-budget account. A
  bill a household account pays is never expected in a personal envelope; the owner's own
  transfer into the household account is, in its category.
- **Uncategorised payees** (`GET /reports/uncategorised-payees`, MCP `uncategorised_payees`):
  each group has a `scope` (`personal` first, `household` for a household account's rows,
  `off_budget`) and `housemate` when its payee is recorded as a housemate's money (from
  `housematePayees`). **Sort your first import** lists `personal` only and doesn't lead with
  Income categories for a housemate's money.
- **Salary offer** (`detectSalary`): a payee recorded as a housemate's money is never offered as
  pay.

Nothing is stored: scope is worked out when read, so there is no migration or backup change.
Not built: a household in the demo budget, and preferring the payday plan's next date for the
dashboard's "Next pay".
