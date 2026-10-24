# Read-only access and MCP

A self-hosted FlyBudget server (including the Home Assistant app) can give another tool,
such as an AI assistant, **read-only** access to the budget with a token. The tool can read
accounts, transactions, the budget, reports, goals and reviews. It cannot change anything.

## What a token can and cannot do

- **Reads only:** `GET` requests to the budget's own data: accounts, categories,
  transactions, budget (monthly and yearly), payees, rules, reports and custom reports,
  schedules, goals, payday plans, review, priorities, households, tags, saved views, currency
  and the filtered CSV export. Plus the MCP endpoint, which only reads.
- **Never:** any write (`POST`, `PUT`, `PATCH`, `DELETE`); sign-in or session routes; server
  settings; full backups or restores; bank connections (Up, Plaid, SimpleFIN, Enable
  Banking); dashboard layouts; or managing tokens. These return 403.
- A token is not a login. It doesn't open the app in a browser, and a browser never sends it
  by itself.
- Tokens are 256-bit random values starting with `fbro_`. The server stores only their
  SHA-256, as it does for login sessions. A token is shown once when it is created.
- Every token expires (7, 30 or 90 days), can be revoked in **Settings → Server → Read-only
  access**, and **changing the password revokes them all**. At most 10 can be active.
- Tokens are never part of a backup.
- Desktop-only installs have no tokens: their API is private to the app.

## Read and categorise tokens

When you want an assistant to sort transactions into categories, create a token with **Access:
Read and categorise** (prefix `fbcat_`). It can do everything a read-only token can, and also:

- create and edit categories (name, group, icon, budget type), create category groups and
  rename them;
- set, clear or undo the **category** of transactions through the same bulk edit the app uses
  (undo takes at most 1,000 rows per call). Reconciled rows, transfers, splits and household entries are skipped.

It still cannot change any other transaction field (amount, date, payee, notes, tags, hidden),
delete or reorder categories, edit rules or budgets, reach settings, backups, sign-in, tokens or
bank connections; those return 403 even if sent directly. Its MCP tools are `create_category`,
`update_category`, `create_category_group`, `update_category_group`, `preview_categorise`,
`categorise_transactions` and `undo_categorise`. A categorise run is: find transactions, preview,
apply with the previewed count (nothing is written if the count differs), and keep the returned
`restore` list to undo. Tools never target every transaction: give ids or at least one filter.
Take a backup before a large run. A read-only token never sees these tools.

## Creating a token

1. Open **Settings → Server → Read-only access**.
2. Name the token after the tool that will use it, choose when it expires, and select
   **Create token**.
3. Copy the token. It is not shown again. Keep it as a secret: in a password manager, or as an
   environment secret of the tool using it. Never paste it into a chat or commit it to a
   repository.

## Using it

The examples use a read-only token; a read and categorise token is used the same way.

### REST

Send the token as a bearer token:

```sh
curl -H "Authorization: Bearer $FLYBUDGET_READONLY_TOKEN" \
  https://budget.example.com/api/transactions/summary?from=2026-10-01&to=2026-10-31
```

Amounts are integer minor units (cents); a negative transaction amount is money out.

### MCP

The server offers an MCP (Model Context Protocol) endpoint at `/api/mcp`, using Streamable
HTTP with JSON responses. Connect a client that supports remote HTTP servers with a bearer
token. For example, Claude Code:

```sh
claude mcp add --transport http flybudget https://budget.example.com/api/mcp \
  --header "Authorization: Bearer $FLYBUDGET_READONLY_TOKEN"
```

It answers at most 300 requests a minute, with at most 20 messages in one JSON-RPC batch.

Its tools are all read-only:

| Tool                                              | What it reads                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `list_accounts`, `list_categories`, `list_payees` | Accounts and balances; the category tree; payees, with the ids other tools take              |
| `list_tags`, `list_rules`, `list_goals`           | Tags with usage counts; categorisation rules; goals and their funding                        |
| `budget_month`, `budget_summary`                  | One month of the envelope budget; available, reserved, overspent and card payment figures    |
| `annual_overview`                                 | A calendar year of assignments and activity, with planned months                             |
| `find_transactions`, `transaction_summary`        | Transactions matching the phase 8/9 filters (up to 500); count, money in/out, net, date span |
| `income_vs_expenses`, `spending_by_category`      | Monthly income and spending; spending per category                                           |
| `spending_by_merchant`                            | Spending per payee                                                                           |
| `budget_review`, `financial_resilience`           | The budget review's open items; reserve and months of essentials                             |

Each tool call is a `GET` of the server's own API made with the caller's token, so a tool can
never reach more than the token itself, and the app's validation applies. Results longer than
200,000 characters are cut, with a note to narrow the request.

### Claude Code on the web

The repository's `.mcp.json` declares a `flybudget` server built from two environment
variables, and `.claude/settings.json` enables it. Add both to the cloud environment's
settings, never to a prompt or the repository:

- `FLYBUDGET_URL`: the server's address, without a trailing slash, for example
  `https://budget.example.com`
- `FLYBUDGET_READONLY_TOKEN`: the token. Despite the name, give it a read and categorise token
  to let the session categorise; the tools offered follow the token's access

The server is read when a session starts, so start a new session after adding them; `/mcp`
shows whether it connected. A claude.ai custom connector can't use this endpoint: connectors
sign in with OAuth and can't send a fixed bearer header.

## Privacy

A tool with a token can read every transaction, payee and note in the budget, and anything it
reads may be kept in that tool's own history. Give a token only to tools you trust, choose the
shortest expiry that works, and revoke it when you no longer need it.
