# Assistant endpoints and their audit log

Audit decision I-11 (docs/AUDIT-2026-11.md, F-18): an access token's writes go to dedicated
assistant endpoints with their own audit log, instead of exceptions carved into general routes.

## How a token's write is handled

1. A categorise or organise token sends a write as `POST` or `PUT /api/assistant/<route path>`,
   for example `PUT /api/assistant/transactions/:id` with `{ "categoryId": "…" }`. MCP tools do this
   for you (`callApi` in `routes/mcp.ts` sends every write there and names the tool in the
   `x-flybudget-assistant-tool` header).
2. `requireSession` (`routes/auth.ts`) verifies the token. `tokenAllows`
   (`auth/accessTokens.ts`) lets a token write only into `/assistant/`; every general route refuses a
   token's write with 403. A read token reaches no assistant endpoint.
3. `routes/assistant.ts` finds the request's row in the policy table, `ASSISTANT_ACTIONS` in
   `auth/assistantPolicy.ts`. Each row has a stable name, the narrowest scope that may use it, an
   owner-facing summary and the check it makes (body shape, the row's date, the rule's actions,
   the server's own transfer suggestions and so on). No row: 403, logged as **refused**.
4. With a row, the request is logged and handed to its route in the same process
   (`app.handle`), with a one-time grant for exactly that method and path. `requireSession`
   consumes the grant; nothing outside the process can set it. The route applies all its own
   rules, as it does for the owner (reconciled rows, split parents, transfers, household links).
5. When the route answers, the log row records **applied** (under 400) or **failed**, with the
   route's error.

## The policy table

| Row                          | Scope      | Allows                                                                   |
| ---------------------------- | ---------- | ------------------------------------------------------------------------ |
| `categorise_transaction`     | categorise | `PUT /transactions/:id` with only `categoryId`, on a past transaction    |
| `manage_categories`          | categorise | create a category or group; edit a category's fields; rename a group     |
| `undo_change_set`            | categorise | `POST /change-sets/:id/undo` (the route checks it is the token's own)    |
| `rule_dry_run`               | organise   | `POST /rules/test`, `POST /rules/preview`                                |
| `propose_rule`               | organise   | `POST /rules` with `enabled: false`                                      |
| `edit_proposed_rule`         | organise   | `PUT /rules/:id` on a disabled rule, never enabling or reordering it     |
| `apply_rule`                 | organise   | `POST /rules/apply`: one category-only rule, uncategorised past rows     |
| `payee_default_category`     | organise   | `PUT /payees/:id` with only `defaultCategoryId`                          |
| `payee_logo`                 | organise   | `PUT /payees/:id` with only a valid `logo` (never removing one)          |
| `link_transfer`              | organise   | `POST /transactions/transfers/link` for a pair the server suggests       |
| `suggest_assignments`        | organise   | `POST /budget-proposals` (applying one is the owner's)                   |
| `claim_tax_deduction`        | organise   | `PUT /tax/claims/:id` on an unclaimed past transaction                   |
| `household_contribution`     | organise   | a contribution linked to a past deposit into the household, exact amount |
| `own_household_contribution` | organise   | your own unlinked contribution, up to what you owe the household account |

Organise tokens also read the tax paths (`taxReadAllows`); reads stay on the general routes.

Rules for the table:

- Every row is an owner-approved exception (CLAUDE.md, docs/READ-ONLY-ACCESS.md). Never add a
  writing, settings, backup, auth or bank row.
- Never rename a row: names are stored in the log.
- A new row needs an allowed case and the nearest refusal through `/api/assistant`
  (`routes/assistantTools.test.ts`, `routes/accessTokens.test.ts`), and its name added to the list
  in `routes/assistant.test.ts`.

## The audit log

`assistant_actions` (migration 0069), written by `services/assistantLog.ts`: time, token id and
name, scope, row name, MCP tool, method, path, outcome (`refused`, `applied`, `failed`), status
and reason. No request bodies are kept. The newest 5,000 rows are kept. It is a security log:
never in backups, and no token can read it.

The owner reads it at `GET /api/assistant/activity` (`limit`, `offset`; with the policy rows'
summaries) and in **Settings → Server → Read-only access → Assistant activity**.

## Phases

1. **Done (this release):** the endpoints, the policy table, the log and the owner's view. All
   existing exceptions moved over with their tests; MCP tools use the endpoints.
2. **Proposals:** writes the owner must approve arrive as proposals (stored, listed in the app,
   approved or declined one at a time, each logged). The depreciating assets plan's asset proposals
   are the first (docs/DEPRECIATING-ASSETS-PLAN.md §7, owner decision 2).
3. **Checks inside the write:** move each row's check into the service that writes, inside its
   transaction, so the check and the write can't be separated (F-18's TOCTOU note). Today the
   routes re-validate and better-sqlite3 runs each synchronous handler without interleaving.
