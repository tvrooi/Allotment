# Native Up support — local preview

This checkout adds a direct Up personal-API connector to FlyBudget. It is a local, unofficial
change based on the upstream repository; the published FlyBudget release does not include it yet.

## Connect your accounts

1. Run the custom desktop build or self-hosted server described below.
2. Create a personal access token at [Up's developer portal](https://api.up.com.au/).
3. In FlyBudget, choose **Settings → Connected Banks → Up → Connect Up**.
4. Paste the token directly into FlyBudget. Do not put it in a GitHub issue or send it in chat.
5. Create a new account for each Up account you want, link an empty AUD account, or skip it.
6. Choose **Save & Sync**. Later, use **Sync Now** to sync again. A local desktop budget also
   syncs when its app starts; a hosted budget syncs when the server starts.

Spending accounts, Savers, joint/2Up accounts and home loans are discovered when made available
by Up to your token. Accounts are created with their appropriate type and AUD currency.
This is a settled-transaction import: pending holds are excluded. The settled register balance
therefore differs from Up's available balance while holds exist. Cashback is separate income.

Sync works like YNAB's direct import: the connection reports whether Up could be reached and its
transactions imported, and **Last synced** moves on with every successful import. A register
that differs from Up's settled balance doesn't fail the sync. The account shows "Up says $X"
beside its balance, and **Settings → Connected Banks → Up → Round-up accounting check** explains
the difference (for example round-ups Up doesn't list) or links to **Reconcile**. FlyBudget never
adjusts the balance by itself.

## Desktop build

Prerequisites: Node.js 22 or newer, npm, and the tools required by Electron Builder on your OS.
The repository's `.npmrc` disables dependency installation scripts; keep that setting.

From this checkout:

```sh
npm ci
npm ci --prefix client
npm ci --prefix server
npm run build:client:electron
npm run build:server:bundle
npm run compile:electron
```

For an Apple silicon Mac, build a separate preview app:

```sh
npx electron-builder --mac dmg --arm64 --config.productName="FlyBudget Up Preview" --config.appId=com.flybudget.up-preview --config.extraMetadata.name=flybudget-up-preview --config.mac.artifactName=FlyBudget-Up-Preview-arm64.dmg
```

The DMG appears in `dist-electron/`. The preview name gives the app its own data folder and avoids
replacing an ordinary FlyBudget installation. It is ad-hoc signed, not Apple-notarized.
Quit any running FlyBudget before opening it: both versions use the same local API port.
Other platforms use the targets in `electron-builder.json`.

The packaged desktop app uses FlyBudget's OS-protected credential encryption when available.
Plain `npm run dev` / `npm run electron:dev` is for development and does not provide that credential
protection automatically. Use the packaged app or encrypted server for your real token.

The updated desktop preview also supports a hosted budget: choose **Budget → Budget location…**
and enter the standalone FlyBudget server URL. Home Assistant can host the data and bank connector
while you use the desktop window. The server's password login applies, and no embedded database
is opened in this mode. See `DESKTOP-SERVER.md`. Selecting **Use this computer** keeps the original
local mode available; it does not move or merge budgets.

## Self-hosting

Build the image from this modified source, rather than pulling the upstream image:

```sh
docker build -t flybudget-up:local .
```

Copy the provided `docker-compose.yml`, replace its FlyBudget image with `flybudget-up:local`,
then follow the repository's existing self-hosting instructions for the encryption-key file,
password setup, persistent data volume and HTTPS. Keep backups before changing an existing install.
The connector needs no extra container, subscription, webhook or incoming network endpoint.

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
- Linking existing CSV/manual history is deliberately refused to prevent double imports.
- Existing imported transactions are preserved, including edits, splits and reconciled rows.
  Later bank corrections or deletions of a settled transaction are not applied automatically.
- Disconnecting removes the token locally; revoke the token in Up's portal to revoke bank access.
- Bank credentials are excluded from JSON backups. Restore on the same installation retains the
  account links; a fresh installation needs a new connection.

## Verification and contribution

Automated verification uses a local mock of Up's documented API, without real financial data or
credentials. A live Up account has not been tested. The main implementation is:

- `server/src/services/upService.ts`: bounded API requests and pagination.
- `server/src/services/upTransactions.ts`: validation, exact amounts, dates and balance handling.
- `server/src/services/upSyncService.ts`: atomic account imports, rules and duplicate detection.
- `server/src/routes/up.ts`: authenticated setup, mapping, sync and disconnect endpoints.
- `client/src/components/up/`: native setup and Connected Banks UI.
- `server/src/db/migrations/0025_up_bank.sql`: additive encrypted-token and mapping tables.

Verified locally on 20 October 2026: 435 server tests, 206 client tests and 161 browser tests
passed. Client/server type checks, Prettier checks, the Electron client/server build and Mac arm64
packaging also passed. The server suite used two workers after unrelated timing-sensitive tests
exceeded their timeouts while builds were running concurrently.

To propose the change upstream, create your own GitHub fork, push the `feat/native-up-bank` branch,
and open a pull request. The maintainers request an issue to agree on substantial features first;
the scope prepared here is direct personal-token access and settled transactions. They also
require the contributor to read and accept their CLA. No issue, PR or CLA acceptance has been
submitted on your behalf.

See `CONTRIBUTING.md` for the full checks. Do not include any tokens, account exports or screenshots
of real financial data in a public contribution.
