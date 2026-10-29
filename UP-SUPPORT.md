# Connecting Up

FlyBudget can import your Up transactions directly, using a personal access token that only you
hold. New to FlyBudget? Begin with [Start here](docs/START-HERE.md), which covers installing and
making the token.

## Connect your accounts

1. Create a personal access token at [Up's developer portal](https://api.up.com.au/).
   [Start here](docs/START-HERE.md#make-an-up-token) has the three short steps.
2. In FlyBudget choose **Connect Up** on the welcome screen, or **Settings → Connected Banks → Up →
   Connect Up**.
3. Paste the token and select **Connect**. Do not put it in a GitHub issue or send it in chat.
4. For each Up account choose **Create a new account**, link an AUD account you already have, or skip it.
   An account that already has transactions is linked from a **cut-over date** you choose: its older
   history stays, and Up's transactions from that day on are added.
5. Select **Save & Sync**. FlyBudget then offers **Sort your first import**. Later, use **Sync Now** to
   sync again. A desktop budget also syncs when the app starts; a Home Assistant budget syncs when
   the app starts.

Spending accounts, Savers, joint/2Up accounts and home loans are discovered when Up makes them
available to your token. Accounts are created with their appropriate type and AUD currency.
This is a settled-transaction import: pending holds are excluded. The settled register balance
therefore differs from Up's available balance while holds exist. Cashback is separate income.

Sync reports whether Up could be reached and its transactions imported, and **Last synced** moves on
with every successful import. A register that differs from Up's settled balance doesn't fail the
sync. The account shows "Up says $X" beside its balance, and **Settings → Connected Banks → Up →
Round-up accounting check** explains the difference (for example round-ups Up doesn't list) or links
to **Reconcile**. FlyBudget never adjusts the balance by itself.

## Current limits

- Sync runs at startup, with **Sync Now**, and optionally in the background (15, 30, 60 or 240
  minutes, with backoff after failures). It fetches full history on every sync, so large accounts
  can take time or hit Up's rate limit.
- Internal transfers use FlyBudget's existing transfer-review flow. Link the two sides in the
  register before relying on income and spending reports.
- Round-ups: Up attaches round-up details to a purchase, but does not link it to the Saver credit.
  **Round-up accounting check** (Settings → Connected Banks → Up) compares each account's register
  with Up's settled balance. When the register is higher by exactly the round-ups settled since
  the first sync, you can choose **Add round-up debits**. That adds one uncategorized
  "Up round-up" debit per purchase (boost included) and keeps adding them on later syncs; link
  each to its Saver credit with transfer suggestions. Nothing is added when the balance already
  matches or the difference has another cause. Purchases settled before the first sync are part
  of the opening balance and get no debit. **Stop adding round-up debits** keeps rows already added.
- Linking an account that already has history needs a cut-over date, so nothing is imported twice.
  Up's transactions before that date are not added.
- Existing imported transactions are preserved, including edits, splits and reconciled rows.
  Later bank corrections or deletions of a settled transaction are not applied automatically.

## Your token and your data

- The token is stored encrypted on your own server or computer and is excluded from JSON backups.
  Restoring on the same installation keeps the account links; a fresh installation needs a new connection.
- Access is read-only.
- **Disconnect Up** removes the saved token locally. To revoke access at Up itself, revoke the token
  in Up's developer portal.
