# Assistant endpoints and their audit log

Audit decision I-11 (docs/AUDIT-2026-11.md, F-18): an access token's writes go to dedicated
assistant endpoints with their own audit log, instead of exceptions carved into general routes.

## How a token's write is handled

1. A categorise or organise token sends a write to the same route path under
   `/api/assistant/do`, for example `PUT /api/assistant/do/transactions/:id` with
   `{ "categoryId": "…" }`. MCP tools do this for you (`callApi` in `routes/mcp.ts` sends every
   write there and names the tool in the `x-flybudget-assistant-tool` header).
2. Before routing, `assistantDispatch` (`routes/assistant.ts`) rewrites it to `/api/<route path>`
   and marks the request (`res.locals.viaAssistant`). Only this server code sets the mark; no
   header can. Rewriting happens once, so `/assistant/do/assistant/do/…` matches no row.
3. `requireSession` (`routes/auth.ts`) verifies the token. A token's write without the mark gets
   403: no general route takes a token's write directly, and `tokenAllows`
   (`auth/accessTokens.ts`) answers reads only. A read token's write is refused outright. The
   owner gets 403 from the assistant endpoint too: they use the app.
4. With the mark, `requireSession` finds the request's row in the policy table,
   `ASSISTANT_ACTIONS` in `auth/assistantPolicy.ts`. Each row has a stable name, the narrowest
   scope that may use it, an owner-facing summary, `matches` (method, path and body shape; reads
   nothing) and, for a row whose rule depends on the budget, `check` (the transaction's date, an
   existing claim, the rule's state, the server's own transfer suggestions and so on). No row
   matches: 403, logged as **refused**. A row matches but its check refuses: 403 with the check's
   reason, logged as **refused** under that row.
5. With a row, the request is logged and passed on to its route, which applies all its own
   rules, as it does for the owner (split parents, transfers, household links). A row with a
   check runs it again as the first step inside the write's own database transaction
   (`assistantGuard`, since 0.2.0-up.127): if the budget changed after step 4, the write is
   refused with "This changed before it could be saved: …", nothing is written, and the log row
   records **refused**. Otherwise, when the route answers, the log row records **applied** (under 400) or **failed**, with the route's error.

Up to 0.2.0-up.100 the log kept the request body and the endpoint used `services/assistantActions.ts`'s
own action names; PR #140's policy table and log replaced them, with migration 0071 clearing the
bodies already kept.

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
| `propose_change`             | organise   | `POST /assistant/proposals`: a depreciating asset proposal (see Phases)  |

Organise tokens also read the tax paths (`taxReadAllows`); reads stay on the general routes.

Rules for the table:

- Every row is an owner-approved exception (CLAUDE.md, docs/READ-ONLY-ACCESS.md). Never add a
  writing, settings, backup, auth or bank row.
- Never rename a row: names are stored in the log.
- A new row needs an allowed case and the nearest refusal in `auth/assistantPolicy.test.ts`
  (with a refusal inside the write when it has a `check`; that file fails until it does), tool
  tests through `/api/assistant` (`routes/assistantTools.test.ts`, `routes/accessTokens.test.ts`),
  and its name added to the list in `routes/assistant.test.ts`.
- A row whose rule reads the budget has a `check`, and the service that writes calls
  `assistantGuard(res.locals)` first inside its transaction. A row without one decides from the
  request alone.

## The audit log

`assistant_actions` (migration 0069, columns from 0071), written by `services/assistantLog.ts`: time, token id and
name, scope, row name, MCP tool, method, path, outcome (`refused`, `applied`, `failed`), status
and reason. No request bodies are kept. The newest 5,000 rows are kept. It is a security log:
never in backups, and no token can read it.

The owner reads it at `GET /api/assistant/activity` (`limit`, `offset`; with the policy rows'
summaries) and in **Settings → Server → Access tokens → Assistant activity**.

## Phases

1. **Done (0.2.0-up.99, policy table and log from #140 in 0.2.0-up.101):** the endpoint, the policy table, the log and the owner's view. All
   existing exceptions moved over with their tests; MCP tools use the endpoints.
2. **Done (0.2.0-up.99):** proposals. Writes the owner must approve arrive as proposals
   (`assistant_proposals`, `services/assistantActions.ts`; at most 50 waiting), listed under
   **Waiting for you** in the same settings section and applied or declined one at a time by the
   owner (`POST /api/assistant/proposals/:id/apply|decline`). Depreciating asset proposals are the
   first (MCP `propose_tax_asset`; docs/DEPRECIATING-ASSETS-PLAN.md §7, owner decision 2).
   Household corrections followed in 0.2.0-up.114 (owner request of 6 November 2026, replacing
   up.113's temporary direct rows): `household.remove_entries`, `household.share_bills` (bills a
   household account paid, linked to their payments) and `household.unlink_transfers` (transfers
   with a side in a household account), MCP `remove_household_entries`,
   `record_household_bill_expenses` and `unlink_household_transfers`. `household.reconcile`
   (owner request of 7 November 2026; MCP `propose_household_reconciliation`) agrees every
   balance from a date with adjustment entries (docs/HOUSEHOLDS.md), refused at apply if any
   balance changed since it was proposed. Each holds up to 50 items,
   is checked when proposed, lists every item for the owner, and is applied whole in one database
   transaction through the household and transfer services, or not at all.
3. **Done (0.2.0-up.127): checks inside the write.** Each row whose rule depends on the budget
   runs its check again inside the write's transaction, so the check and the write can't be
   separated (F-18's TOCTOU note); a token's claim is only ever inserted; the reconciled-row rule
   for tokens moved from the transactions route into `categorise_transaction`'s check. Design and
   the owner's decisions: [ASSISTANT-PHASE-3.md](ASSISTANT-PHASE-3.md).
