# Read-only access and MCP

A self-hosted FlyBudget server (including the Home Assistant app) can give another tool,
such as an AI assistant, **read-only** access to the budget with a token. The tool can read
accounts, transactions, the budget, reports, goals and reviews. It cannot change anything,
except that a read and categorise token can set the category of past transactions and edit
categories, and a read, categorise and organise token can also propose rules, set payee
default categories and link suggested transfers.

## What a token can and cannot do

- **Reads only:** `GET` requests to the budget's own data: accounts, categories,
  transactions, budget (monthly and yearly), payees, rules, reports and custom reports,
  schedules, goals, payday plans, review, priorities, households, tags, saved views, currency
  and the filtered CSV export. Plus the MCP endpoint, which only reads.
- **Never:** any other write (`POST`, `PUT`, `PATCH`, `DELETE`); sign-in or session routes; server
  settings; full backups or restores; bank connections (Up, Plaid, SimpleFIN, Enable
  Banking); dashboard layouts; or managing tokens. These return 403.
- A token is not a login. It doesn't open the app in a browser, and a browser never sends it
  by itself.
- **Read and categorise** tokens can also set the category of a past transaction (dated today or
  earlier): a `PUT /api/transactions/:id` whose body is exactly `{"categoryId": "…"}`. They can't
  change any other field, clear a category, touch a future transaction, edit many at once, or
  reach anything else a read-only token can't. The register's own rules still apply: reconciled
  rows, split parents, transfers inside the budget, household-linked entries and payment
  envelopes are refused. They can also create and edit **categories and groups** (name, group,
  icon, budget type; a group's income flag is set only when it is created), but never delete or
  reorder them. Choose **Read and categorise** under **Access** when creating the token.
- **Read, categorise and organise** tokens (owner-approved) can do everything a categorise
  token can, plus:
  - dry-run rules (`POST /api/rules/test` and `/api/rules/preview`);
  - **propose** a rule: `POST /api/rules` with `"enabled": false`. It is saved switched off and
    marked with the token's name, and runs only after you turn it on in **Rules** (which accepts
    it). A token can edit a rule only while it is switched off, and never enables, reorders or
    deletes one;
  - apply one rule whose actions only set a category, to uncategorised past transactions
    (`POST /api/rules/apply` with `"scope": "uncategorized"`);
  - set a payee's default category, and nothing else about the payee
    (`PUT /api/payees/:id` with exactly `{"defaultCategoryId": …}`);
  - link two transactions as a transfer, only when the app itself suggests that pair
    (`POST /api/transactions/transfers/link`).
- **Change sets:** every category change made over MCP is saved as a change set, listed in
  **Settings → Server → Read-only access** with **Undo** (`GET /api/change-sets`,
  `POST /api/change-sets/:id/undo`). Undo puts back the previous category (even none) only
  where the transaction still has the category the change set gave it and isn't reconciled. A
  token sees and undoes only its own change sets; you can undo any.
- Tokens are 256-bit random values starting with `fbro_`. The server stores only their
  SHA-256, as it does for login sessions. A token is shown once when it is created.
- Every token expires (7, 30 or 90 days), can be revoked in **Settings → Server → Read-only
  access**, and **changing the password revokes them all**. At most 10 can be active.
- Tokens are never part of a backup.
- Desktop-only installs have no tokens: their API is private to the app.

## Creating a token

1. Open **Settings → Server → Read-only access**.
2. Name the token after the tool that will use it, choose when it expires, and select
   **Create token**.
3. Copy the token. It is not shown again. Keep it as a secret: in a password manager, or as an
   environment secret of the tool using it. Never paste it into a chat or commit it to a
   repository.

## Using it

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

Its read tools:

| Tool                                                  | What it reads                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `list_accounts`, `list_categories`, `list_payees`     | Accounts and balances; the category tree; payees, with the ids other tools take              |
| `list_tags`, `list_rules`, `list_goals`               | Tags with usage counts; categorisation rules; goals and their funding                        |
| `budget_month`, `budget_summary`                      | One month of the envelope budget; available, reserved, overspent and card payment figures    |
| `annual_overview`                                     | A calendar year of assignments and activity, with planned months                             |
| `find_transactions`, `transaction_summary`            | Transactions matching the phase 8/9 filters (up to 500); count, money in/out, net, date span |
| `income_vs_expenses`, `spending_by_category`          | Monthly income and spending; spending per category                                           |
| `spending_by_merchant`                                | Spending per payee                                                                           |
| `budget_review`, `financial_resilience`               | The budget review's open items; reserve and months of essentials                             |
| `long_term_plans`, `long_term_plan`                   | Saved long-term forecast plans; one plan's settings, life events and savings splits          |
| `long_term_forecast`, `long_term_compare`             | A plan's year-by-year result; two plans side by side                                         |
| `uncategorised_payees`, `transfer_suggestions`        | Uncategorised transactions grouped by payee; unlinked pairs that look like transfers         |
| `budget_start`, `bank_sync_status`                    | The first budget month; each synced account's bank against register balance and round-ups    |
| `list_households`, `household`, `household_statement` | Household groups and pool accounts; one group's people, events and balances; your share      |
| `list_change_sets`                                    | This token's category changes, each undoable                                                 |

`find_transactions` pages with `limit` and `offset`, and `fields` (for example
`id,date,amount,payeeName,categoryId`) keeps each result short. `bank_sync_status` has no
connection details: no tokens, bank ids or error messages.

With a **read and categorise** token the server also lists `categorise_transactions`: up to 100
transaction ids and one category id; and `categorise_by_payee`: one payee's uncategorised past
transactions (up to 1,000 per call); and `undo_change_set`. Both categorising tools return a
`changeSetId`. It changes them one at a time through the same API, and
returns each one's result and previous category, so a change can be put back. It also lists
`create_category`, `update_category`, `create_category_group` and `rename_category_group`, so an
assistant can set up the categories it needs before sorting. Paths are matched ignoring letter
case, as the server's router does.

With a **read, categorise and organise** token it also lists `test_rule_conditions`,
`propose_rule`, `update_proposed_rule`, `preview_rule`, `apply_rule`,
`set_payee_default_category` and `link_transfer`. `categorise_by_payee` with
`set_default: true` also makes the category the payee's default, so later imports get it.

Each read tool call is a `GET` of the server's own API made with the caller's token, so a tool can
never reach more than the token itself, and the app's validation applies. Results longer than
200,000 characters are cut, with a note to narrow the request.

### Claude Code on the web

The repository's `.mcp.json` declares a `flybudget` server built from two environment
variables, and `.claude/settings.json` enables it. Add both to the cloud environment's
settings, never to a prompt or the repository:

- `FLYBUDGET_URL`: the server's address, without a trailing slash, for example
  `https://budget.example.com`
- `FLYBUDGET_READONLY_TOKEN`: the read-only token

The server is read when a session starts, so start a new session after adding them; `/mcp`
shows whether it connected. A claude.ai custom connector can't use this endpoint: connectors
sign in with OAuth and can't send a fixed bearer header.

## Privacy

A tool with a token can read every transaction, payee and note in the budget, and anything it
reads may be kept in that tool's own history. Give a token only to tools you trust, choose the
shortest expiry that works, and revoke it when you no longer need it.
