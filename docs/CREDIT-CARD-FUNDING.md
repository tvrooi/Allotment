# Credit-card payment funding (phase 6B)

Credit cards and lines of credit can use dedicated cash reserves for payment.
Open **Budget → Card payment funding**, review a card's setup preview, then confirm.
The preview shows the effective date, debt, reserve, payment shortfall, and the
before/after unassigned total. No ledger rows, bank IDs, reconciliation flags or
historical category assignments are changed.

## Cash, purposes and debt

For a reviewed card, debt is not deducted as if it were already paid. Instead:

`existing cash resources = unassigned + positive expense envelopes + future assignments + payment reserves`

An $80 funded card purchase uses $80 of its expense envelope and reserves $80 of
existing cash for payment. A linked $80 repayment consumes that reserve and reduces
cash and debt; it adds no category spending. Interest and fees are expenses in the
chosen category. Splits use their child categories, once; account balances retain
the parent/child rules used by the register.

Unfunded purchases produce credit category deficits and a payment shortfall.
Assigning money to the expense envelope covers its credit deficit and increases
payment funding, including across months. Cash deficits remain separately visible.
Explicit payment funding from unassigned cash covers old/opening debt without
inventing category assignments. Positive adjustments are capped by unassigned
cash and the outstanding payment shortfall. Releases require available payment
funding; automatic reserves supplied by funded purchases may require reviewing the
expense assignments first. The preview shows the actual resulting reserve.

The same cash cannot fund both an envelope and a payment. Reservations above debt
are released after each dated day, so later expense funding cannot claim an existing
payment reserve twice. Legacy overcommitments remain visible and are not repaired.
A payment shortfall, category deficit, unknown spending or unlinked card inflow
prevents an unqualified fully resolved state.

## Refunds, positive balances and transfers

- A categorized card refund first cancels that card's unfunded spending in that
  category. Remaining refunds release its existing payment reserve into the
  category. Released cash can cover another card's deficit in the same category.
- Refunds without reserve funding reduce debt or become positive card credit;
  they cannot create cash availability. A refund after repayment is therefore
  card credit until spent on that card or withdrawn to a cash account.
- Positive card balances and overpayments are noncash credit. Purchases use this
  credit first, reserving cash only for the portion that creates debt.
- Category Activity remains the signed ledger amount. **Card credit adjustment**
  explains the noncash portion: Available = carry + assigned + activity + adjustment.
  These adjustments are calculated, not synthetic transactions or assignments.
- Confirmed card-to-card balance transfers move existing payment funding from the
  card whose debt is paid to the card taking on that debt. Using positive card credit
  to repay another card releases the corresponding cash instead. No transfer is
  guessed from names or amounts, and no ledger link is created automatically.
- Cash advances expose debt and a payment shortfall; their actually received cash
  enters cash resources. It is borrowing, not saving or earned salary.
- If one linked payment leg lies after the assessment date, funding is explicitly
  incomplete until both legs have posted. New funding is blocked in that interval.
  Unlinked uncategorized card inflows require register review; reconciled linked
  transfers retain their existing protections.

## Dates, setup and compatibility

Existing cards retain phase 6A's conservative net-debt treatment until explicitly
reviewed. Setup starts on the server's current date, including rows dated that day.
Earlier assessments keep the prior model. Old debt starts unfunded; setup never
silently generates historical allocations. The household pool and off-budget scopes
remain outside personal payment funding.

The shared calculation replays monthly assignments on the first day. Dated activity
and explicit payment funding use a persisted insertion sequence within each day;
a linked payment is recognised after both legs. Imports use the bank date first
and the captured insertion order for same-day ties. Existing rows receive a stable
sequence during the additive migration, without changing any transaction. Backups
preserve this ordering. Covering mixed deficits funds outstanding credit category
deficits first, in stable account order; paid deficits become cash deficits. All
current/historical budget surfaces, payday funding and the browser demo use this
same service. Future salary and unconfirmed generated receipts remain expectations.

Money stays in integer minor units. Foreign card credit usage shares each transaction's
stored budget-currency value using exact integer allocation. Debt is valued at the
assessment day's rate; FX changes can produce a visible payment shortfall or release
an excess reserve. Missing rates make the assessment incomplete and block setup/new
funding. Currency decimal changes are blocked while card setup/history exists.

Setup and funding apply inside transactions with database revision checks. Stale
previews, duplicate retries and competing clients cannot reuse the same money.
Portable backup version 8 preserves card setup and funding history, accepts older
backups as unconfigured, and retains the existing bank credential exclusions.

## Verification and delivery

Disposable-budget checks cover funded/partial/unfunded purchases, old debt, mixed
cash/credit deficits, repayments, refunds before/after payment, positive balances,
overpayments, splits, fees, card transfers, missing rates, setup previews, conflicts,
history and backup compatibility. Browser checks exercise the reviewed setup and
funding workflows on desktop, phone and the offline demo.

Implementation, local verification, release publication, catalog promotion and live
installation are separate delivery states. Live installation still requires verified
administrative access and a restorable cold backup including the encryption key.
