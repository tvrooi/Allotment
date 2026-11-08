# Access tokens and MCP

(The file keeps its name so links stay valid. A token is read only unless you choose a wider scope.)

A self-hosted Allotment server (including the Home Assistant app) can give another tool,
such as an AI assistant, **read-only** access to the budget with a token. The tool can read
accounts, transactions, the budget, reports, goals and reviews. It cannot change anything,
except that a read and categorise token can set the category of past transactions and edit
categories, and a read, categorise and organise token can also propose rules, set payee
default categories and logos, link suggested transfers and claim past transactions as tax
deductions.

## What a token can and cannot do

- **Reads only:** `GET` requests to the budget's own data: accounts, categories,
  transactions, budget (monthly and yearly), payees, rules, reports and custom reports,
  schedules, goals, payday plans, review, priorities, households, tags, saved views, currency
  and the filtered CSV export. Plus the MCP endpoint, which only reads.
  The budget's reads include the owner's month and category notes; writing a note is owner only.
- **Never:** any other write (`POST`, `PUT`, `PATCH`, `DELETE`); sign-in or session routes; server
  settings; full backups or restores; bank connections (Up, Plaid, SimpleFIN, Enable
  Banking); dashboard layouts; or managing tokens. These return 403.
- A token cannot read **import history** (`GET /api/transactions/import/batches`): its file names
  can carry a bank or account number. Like the bank import settings, it is the owner's.
- A token is not a login. It doesn't open the app in a browser, and a browser never sends it
  by itself.
- **Read and categorise** tokens can also set the category of a past transaction (dated today or
  earlier): a `PUT /api/transactions/:id` whose body is exactly `{"categoryId": "…"}`. They can't
  change any other field, clear a category, touch a future transaction, edit many at once, or
  reach anything else a read-only token can't. The register's own rules still apply: reconciled
  rows, split parents, transfers inside the budget, household-linked entries and payment
  envelopes are refused. They can also create and edit **categories and groups** (name, group,
  icon, budget type, hidden; a group's income flag is set only when it is created), but never delete or
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
  - set or replace a payee's logo, such as a brand icon (`PUT /api/payees/:id` with exactly
    `{"logo": "data:image/png;base64,…"}`, PNG, JPEG or WebP). It can replace a logo you
    uploaded, but never removes one;
  - link two transactions as a transfer, only when the app itself suggests that pair
    (`POST /api/transactions/transfers/link`);
  - suggest assignments (`POST /api/budget-proposals`): this month or next, expense
    categories only, within money ready to assign. Only the owner applies or dismisses one;
  - read tax deductions (`GET /api/tax/labels`, `/api/tax/years`, `/api/tax/years/:fy`,
    `/api/tax/claims`, `/api/tax/claims/:id`; never a year's CSV or receipt archive) and claim a
    past transaction that has no claim yet (`PUT /api/tax/claims/:id` with only `label`,
    `workUseBps` and `notes`). It never replaces or removes a claim: those stay the owner's. The
    tax route still refuses split parents and transfers. Owner-approved on 2 November 2026.
    It may also list a year's likely missed claims (`GET /api/tax/years/:fy/candidates`). A
    year also carries its capital gains from investment sales (item 18, `capitalGains`, since
    0.2.0-up.141) and its investment income (items 10 and 11, `investmentIncome`, since
    0.2.0-up.142);
  - read investments (`GET /api/investments`: holdings with their lots, splits, sales and income; MCP
    `investments`), read only (owner decision 7 of INVESTMENT-SALES-AND-INCOME.md, since
    0.2.0-up.142). Every other `/api/investments` route, and every write to a sale, a payment, a
    split, a lot, a deposit link or the losses carried in, stays the owner's;
  - record a household contribution linked to a deposit (`POST /api/households/:id/events` with
    exactly `kind: "contribution"`, `date`, `description`, `amount`, `payerId` and
    `transactionId`): a past deposit into one of that household's accounts, for exactly its
    amount and date. Never an expense, settlement, refund, bill, unlinked amount, edit or removal:
    those stay the owner's, who removes an entry on the Household page. The household route
    still checks the person and that the deposit (or its other transfer leg) isn't linked
    already. Owner-approved on 2 November 2026;
  - record your own contribution with no bank link (`POST /api/households/:id/events` with
    exactly `kind: "contribution"`, `date`, `description`, `amount` and `payerId`): only for the
    household's "you" person, dated today or earlier, and at most what you owe the household
    account now, so it can bring you to zero but never into credit. For money you paid some
    other way, such as through a shared saver that isn't a household account. Never for anyone
    else. Owner-approved on 2 November 2026.
- **Change sets:** every category change made over MCP is saved as a change set, listed in
  **Settings → Server → Access tokens** with **Undo** (`GET /api/change-sets`,
  `POST /api/change-sets/:id/undo`). Undo puts back the previous category (even none) only
  where the transaction still has the category the change set gave it and isn't reconciled. A
  token sees and undoes only its own change sets; you can undo any. You can also **Redo** an
  undone change set (`POST /api/change-sets/:id/redo`, the owner only): it sets the token's
  categories again where the transaction still has the category the undo put back and isn't
  reconciled.
- Tokens are 256-bit random values starting with `fbro_`. The server stores only their
  SHA-256, as it does for login sessions. A token is shown once when it is created.
- Every token expires (7, 30 or 90 days), can be revoked in **Settings → Server → Access
  tokens**, and **changing the password revokes them all**. At most 10 can be active.
- Tokens are never part of a backup.
- Desktop-only installs have no tokens: their API is private to the app.

## Creating a token

1. Open **Settings → Server → Access tokens**.
2. Name the token after the tool that will use it, choose when it expires, and select
   **Create token**.
3. Copy the token. It is not shown again. Keep it as a secret: in a password manager, or as an
   environment secret of the tool using it. Never paste it into a chat or commit it to a
   repository.

## Using it

### REST

Send the token as a bearer token:

```sh
curl -H "Authorization: Bearer $ALLOTMENT_TOKEN" \
  https://budget.example.com/api/transactions/summary?from=2026-10-01&to=2026-10-31
```

Amounts are integer minor units (cents); a negative transaction amount is money out.

### The assistant endpoint (writes)

Since 0.2.0-up.99 (audit decision I-11) a token never writes to the app's routes directly. A
write the token's scope allows goes to the same path under `/api/assistant/do`, for example
`PUT /api/assistant/do/transactions/<id>` with `{"categoryId": "..."}`. Only the named actions in
the policy table, `server/src/auth/assistantPolicy.ts` (docs/ASSISTANT-ENDPOINTS.md), are
accepted there, each with its own check, and the target route still applies its
own checks. A check that depends on the budget (a date, an existing claim, a rule's state) runs
again inside the write's own database transaction, so nothing can change in between; if
something did, the write is refused and logged as refused (0.2.0-up.127). Every write a token asks for, allowed or refused, is logged: **Settings → Server →
Access tokens → Assistant activity** (owner only, `GET /api/assistant/activity`; no request bodies are kept, the newest 5,000 rows). The MCP server
does this for you.

Changes the owner must approve arrive as proposals: an organise token may
`POST /api/assistant/do/assistant/proposals` (MCP `propose_tax_asset`) to propose a new
depreciating asset or a change to one, and (owner-requested on 6 November 2026) household
corrections: removing household entries (MCP `remove_household_entries`), sharing past bills a
household account paid, linked to their payments (`record_household_bill_expenses`), and
unlinking past transfers with a side in a household account (`unlink_household_transfers`), and
(owner-requested on 7 November 2026) agreeing a household's balances from a date
(`propose_household_reconciliation`; `household_reconciliation_preview` reads what it would
change).
Nothing changes until the owner chooses **Apply** under **Waiting for you** in the same settings
section (`POST /api/assistant/proposals/:id/apply` or `/decline`, owner only), which lists every
item a household proposal would change. Applying runs the same checks as the owner's own change,
including lodged-year locks; a household proposal is applied whole in one database transaction or
not at all, and a refusal keeps it waiting with the reason. No token removes, shares or unlinks
directly. Neither the log nor proposals are in backups.

### MCP

The server offers an MCP (Model Context Protocol) endpoint at `/api/mcp`, using Streamable
HTTP with JSON responses. Connect a client that supports remote HTTP servers with a bearer
token. For example, Claude Code:

```sh
claude mcp add --transport http flybudget https://budget.example.com/api/mcp \
  --header "Authorization: Bearer $ALLOTMENT_TOKEN"
```

It answers at most 300 requests a minute, with at most 20 messages in one JSON-RPC batch.

Its read tools:

| Tool                                                  | What it reads                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_accounts`, `list_categories`, `list_payees`     | Accounts and balances; the category tree; payees, with the ids other tools take                                                                                 |
| `list_tags`, `list_rules`, `list_goals`               | Tags with usage counts; categorisation rules; goals and their funding                                                                                           |
| `budget_month`, `budget_summary`                      | One month of the envelope budget; available, reserved, overspent and card payment figures                                                                       |
| `annual_overview`                                     | A calendar year of assignments and activity, with planned months                                                                                                |
| `find_transactions`, `transaction_summary`            | Transactions matching the phase 8/9 filters (up to 500); count, money in/out, net, date span                                                                    |
| `income_vs_expenses`, `spending_by_category`          | Monthly income and spending; spending per category                                                                                                              |
| `spending_by_merchant`                                | Spending per payee                                                                                                                                              |
| `budget_review`, `financial_resilience`               | The budget review's open items; reserve and months of essentials                                                                                                |
| `long_term_plans`, `long_term_plan`                   | Saved long-term forecast plans; one plan's settings, life events and savings splits                                                                             |
| `long_term_forecast`, `long_term_compare`             | A plan's year-by-year result; two plans side by side                                                                                                            |
| `uncategorised_payees`, `transfer_suggestions`        | Uncategorised transactions grouped by payee and whose money (personal, household, off budget; housemate payees marked); unlinked pairs that look like transfers |
| `budget_start`, `bank_sync_status`                    | The first budget month; each synced account's bank against register balance and round-ups                                                                       |
| `list_households`, `household`, `household_statement` | Household groups and pool accounts; one group's people, events and balances; your share, by month, person and category                                          |
| `household_contribution_suggestions`                  | Deposits that look like someone paying the household or you, not recorded yet                                                                                   |
| `household_bill_reconciliation`                       | One shared recurring bill person by person: shares owed, matched deposits, what's left to record                                                                |
| `list_change_sets`                                    | This token's category changes, each undoable                                                                                                                    |
| `budget_housekeeping`, `list_budget_proposals`        | Setup problems (budget start, missing round-ups, unknown savers, unused categories, recurring bills with no category); assignment suggestions                   |

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
`set_payee_default_category`, `link_transfer`, `propose_assignments` (suggested amounts
for expense envelopes, which the owner applies or dismisses on the Budget page),
`tax_deductions` (one financial year's claims and totals) and `claim_tax_deductions` (up to 100
past money-out transactions under one return label, with a work-use percentage and notes;
already-claimed rows are skipped), `tax_years` (years with claims, and the return labels),
`tax_claim` (one transaction's claim), `tax_claim_candidates` (unclaimed past payments from a
payee, or failing that a category, already claimed this year or last, with the label and share
of that claim) and `record_household_contributions` (up to 50 deposits into a household account
recorded as the named person's contributions, each linked to its deposit) and
`record_own_household_contribution` (your own contribution without a bank link, up to what you
owe the household account), plus `remove_household_entries`, `record_household_bill_expenses`
and `unlink_household_transfers`, which only propose household corrections for the owner to
apply (below). `categorise_by_payee` with
`set_default: true` also makes the category the payee's default, so later imports get it.

Each read tool call is a `GET` of the server's own API made with the caller's token, so a tool can
never reach more than the token itself, and the app's validation applies. Results longer than
200,000 characters are cut, with a note to narrow the request.

### Claude Code on the web

The repository's `.mcp.json` declares a `flybudget` server built from two environment
variables, and `.claude/settings.json` enables it. Add both to the cloud environment's
settings, never to a prompt or the repository:

- `ALLOTMENT_URL`: the full MCP endpoint, for example `https://budget.example.com/api/mcp`
- `ALLOTMENT_TOKEN`: the access token

The server is read when a session starts, so start a new session after adding them; `/mcp`
shows whether it connected. A claude.ai custom connector can't use this endpoint: connectors
sign in with OAuth and can't send a fixed bearer header.

## Privacy

A tool with a token can read every transaction, payee and note in the budget, and anything it
reads may be kept in that tool's own history. Give a token only to tools you trust, choose the
shortest expiry that works, and revoke it when you no longer need it.
