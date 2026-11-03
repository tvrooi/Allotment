# Pay later: Afterpay and other payment plans (up.67)

A purchase made with Afterpay (or Zip Plus, Klarna, PayPal Pay in 4, Humm) is recorded once,
in what it was for, and the fortnightly payments from the bank pay it off. Before this, Up only
showed the payments: four "AFTERPAY" debits in an Afterpay / Zip category, and the drill itself
never appeared in Home improvement.

## Model

A provider is a small **credit account** (`type = 'credit'`, on budget). Nothing new in the
ledger: the existing credit-card machinery ([CARD-PAYMENTS.md](CARD-PAYMENTS.md)) does the
envelope work.

| Row                                  | Account       | Category         |
| ------------------------------------ | ------------- | ---------------- |
| Purchase: Bunnings −$200             | Afterpay      | Home improvement |
| Payment 1: transfer −$50 / +$50      | Up ↔ Afterpay | none (transfer)  |
| Payments 2–4: transfers, fortnightly | Up ↔ Afterpay | none (transfer)  |

- **Reports** count the $200 as Home improvement in the month of purchase. Payments are internal
  transfers, so nothing is counted twice and no "BNPL" spending appears.
- **Envelopes.** A plan account gets payment funding when it is created (an empty account needs no
  review). A funded purchase moves Home improvement's money into **Afterpay payment**; each payment
  uses it up; Ready to Assign does not change. An unfunded purchase is credit overspending (card
  debt, not taken from Ready to Assign) and shows as a payment shortfall to fund.
- **Budget page.** Unpaid instalments due this month (and overdue ones) show in orange under the
  payment envelope, like other expected bills (`expectedInstalments` in `expectedDebits.ts`).
- **Forecast.** No change: the plan account is a liquid credit account, so its debt is already in
  the cash position, and payments between personal accounts net to zero.

## Data (migration 0057, backup version 21)

- `payment_plans`: plan account, payment account, the purchase row, provider, merchant, total,
  instalment count, frequency (weekly, fortnightly, monthly), first due date, and
  `extra_transaction_ids` (JSON: refund and fee rows the plan created).
- `payment_plan_instalments`: number, due date, amount, and once paid `transaction_id` (the plan
  account's side of the transfer; one payment may pay several instalments), `previous_json` (the
  bank row's payee and category before linking) and `paid_at`. An instalment a refund brought to
  0 is settled.
- `payment_plan_dismissals`: "Not this payment" for one instalment and bank row.

Amounts split equally with the odd cents on the first instalment, as Afterpay rounds; any unpaid
instalment's date and amount can be changed to match the provider's app.

## Linking payments (never guessed)

`GET /api/payment-plans/matches` suggests bank rows that:

- are in the plan's payment account, money out, not a transfer, split, adjustment, household
  entry or reconciled row;
- name the provider in the bank text (`/after\s*pay/i` for Afterpay; "Payment plan" has no
  pattern);
- equal one unpaid instalment within 3 days before to 10 days after its due date (retries), or
  the next several unpaid instalments together (paying ahead).

Nothing is linked until the owner confirms (`POST /:id/link`), on the Pay later page or Review.
Linking makes the bank row a transfer into the plan account (always a new other side, never an
existing row there), clears its category and notes the plan account's side
("Bunnings: payment 2 of 4"). Unlinking (`POST /:id/instalments/:iid/unlink`) restores the bank
row's payee and category exactly and deletes the created side. Reconciled rows are refused.

## Earlier purchases

`GET /api/payment-plans/history?months=12` groups past unlinked provider payments into likely
plans: same account, about a fortnight apart (12–16 days), the same amount (the first may be up
to 3 cents more), at most four. A group whose last payment is within 16 days is "still being
paid" and suggests four payments. The owner names the merchant and category; `POST
/payment-plans` with `linkTransactionIds` records the purchase (dated at the first payment),
takes the linked payments' actual amounts for the first instalments, and links them in one
database transaction. Reconciled payments are locked: counted, never grouped or linked.

## Refunds, late fees, removal

- **Refund** (`POST /:id/refund`): a credit on the plan account in the purchase's category, so
  reports net it against what was bought; unpaid instalments shrink from the last. A refund
  larger than what is owed leaves a credit on the account; when the provider pays it back to the
  bank, link it as an ordinary transfer.
- **Late fee** (`POST /:id/fee`): an expense on the plan account (Bank Fees by default in the
  form), added to the next unpaid instalment, or a new instalment when none is left.
- **Remove plan** (`DELETE /:id`): unlinks every payment (as above), deletes the purchase, refunds
  and fees it created, and the plan. Refused while any of those rows is reconciled. Bank rows are
  never deleted. The client's undo for "Add a purchase" is this removal.

## Not built

- The plan account's opening debt for plans already underway before the budget start: record
  them as earlier purchases, or set the account's starting balance and reconcile.
- Afterpay Pay Monthly (interest-bearing), and Zip Pay's revolving monthly minimum (Zip Pay is
  just a credit account; no plan is needed).
- Read-only access tokens see no plan routes.
- The Australian category template no longer creates "Afterpay / Zip" for new budgets. Existing
  budgets keep theirs; hide it once it's empty.
