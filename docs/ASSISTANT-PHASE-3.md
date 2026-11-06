# Assistant endpoints, phase 3: checks inside the write

Status: **design only, 6 November 2026. Nothing is built.** It plans phase 3 of
[ASSISTANT-ENDPOINTS.md](ASSISTANT-ENDPOINTS.md) (the remaining F-18 note in
[AUDIT-2026-11.md](AUDIT-2026-11.md)) and waits on the owner decisions at the end. No code,
migration or version change comes with this page.

## The problem

An access token's write is checked once, in `requireSession` (`routes/auth.ts`), against its row
in `ASSISTANT_ACTIONS` (`auth/assistantPolicy.ts`). Several rows read the budget to decide: the
transaction's date, whether a claim exists, whether a rule is still disabled. The route then
writes in its own database transaction. The check and the write are two separate reads of the
budget, so in principle the budget can change between them (time of check, time of use).

## What is true today (checked in code, 6 November 2026)

- **No gap can open today.** `express.json` parses the body before `requireSession`; no
  asynchronous middleware sits between `requireSession` and the routers these rows reach
  (`server/src/index.ts`); every handler involved is synchronous; better-sqlite3 runs one
  statement at a time on one connection. The check, the route's validation and the write run in
  one turn of the event loop, so no other request can run in between.
- **That safety is accidental.** Nothing enforces it. An `await` added to one of these routes, an
  asynchronous middleware mounted before them (an upload parser, a rate limiter), or Express's
  own router deferring `next()` with `setImmediate` after 100 nested synchronous calls
  (`router` 2.x, "max sync stack") would open the gap with no test failing.
- **The routes don't re-check the token's limits.** The audit's "routes re-validate" holds for each
  route's own rules (reconciled rows, splits, transfers, household links). The token-only limits
  live only in the policy: past dates, never replacing a claim (`setClaim` upserts, so the route
  would replace one), a rule still disabled, a category-only rule, a server-suggested pair, a
  deposit's exact amount and date, what you owe.
- **One token rule sits outside the table.** `PUT /transactions/:id` refuses a reconciled row when
  the `Authorization` header starts with `Bearer` (`routes/transactions.ts`). It is policy, keyed
  off a header string, in a general route.
- **Some writes span more than one statement without a transaction.** `setClaim`
  (`services/taxService.ts`) and `recordEvent` (`services/householdService.ts`) write without
  `db.transaction`; `applyRules` (`services/ruleService.ts`) plans before opening its transaction;
  `createAssistantProposal` counts the 50 waiting proposals before it inserts.
- **The tests named for the policy don't exist.** CLAUDE.md and the header of
  `assistantPolicy.ts` name `assistantPolicy.test.ts`; the cases live in `routes/assistant.test.ts`,
  `routes/assistantTools.test.ts` and `routes/accessTokens.test.ts`.
- **A related race, not policy:** MCP's categorising tools read each transaction's category, then
  call the API over HTTP (`routes/mcp.ts`, `callApi`, an `await` per row), then record the change
  set with the category read before. If the owner changed the category in between, undo restores
  the stale one (undo still refuses a row that no longer has the new category).

## The rows

Rows that read the budget need their check inside the write. The rest decide from the method,
path and body alone, so there is nothing to change between check and write.

| Row                                                                                                                | Reads the budget                                          | Write (where the transaction is)                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| `categorise_transaction`                                                                                           | transaction date is today or earlier; not reconciled (\*) | `PUT /transactions/:id`, inline `db.transaction` |
| `edit_proposed_rule`                                                                                               | the rule is disabled                                      | `PUT /rules/:id` (`routes/rules.ts`)             |
| `apply_rule`                                                                                                       | the rule only sets a category; every row is in the past   | `applyRules` (plan moves inside its transaction) |
| `link_transfer`                                                                                                    | the pair is one the server suggests                       | `linkTransfer`, `db.transaction`                 |
| `claim_tax_deduction`                                                                                              | no claim yet; transaction in the past                     | `setClaim` (needs a transaction)                 |
| `household_contribution`                                                                                           | the deposit: account, amount, date, not an internal move  | `recordEvent` (needs a transaction)              |
| `own_household_contribution`                                                                                       | the household snapshot: what you owe                      | `recordEvent` (needs a transaction)              |
| `undo_change_set`                                                                                                  | none in the policy; the service checks ownership (†)      | `undoChangeSet`                                  |
| `propose_change`                                                                                                   | none in the policy; the service checks the 50 cap (†)     | `createAssistantProposal`                        |
| `manage_categories`, `rule_dry_run`, `propose_rule`, `payee_default_category`, `payee_logo`, `suggest_assignments` | none: method, path and body only                          | their routes, unchanged                          |

(\*) Today in the route, by header (see above); it moves into the row's check.
(†) The service's own read happens before its insert or transaction; it moves inside.

## Options

**A. Run the row's check again inside the write (recommended).** Each row keeps its one
predicate in the table. `requireSession` runs it as today (early refusal, logged, the route never
reached). The service that writes runs the same predicate again as the first statement inside its
`db.transaction`, through a guard the route passes in. One predicate, run twice; no second copy.
If a future route forgets the guard, behaviour falls back to today's early check, not to no check.

**B. Dedicated assistant handlers.** Each row gets its own handler under `/api/assistant/…` that
validates, checks and calls the service in one transaction, and `/assistant/do` stops forwarding
to the general routes (the audit's "capability-specific endpoints"). Strongest separation, but
each handler re-validates what the general route already validates (a second copy of logic, P1),
MCP's `callApi` and its tests change throughout, and every new route rule must be added twice.

**C. One transaction around the whole request.** better-sqlite3 transactions are synchronous;
holding `BEGIN` open across Express's callbacks on the single connection would let any other
request's writes join it. A hook on `db.transaction` keyed by request context (AsyncLocalStorage)
is invisible at the call site and misses writes outside a transaction. Rejected.

## Recommended design (option A)

1. **The table.** Each row splits its predicate into `matches(method, path, body)` (which row:
   method, path and body shape; reads nothing) and, for rows that read the budget, `check(request)`
   returning a refusal reason or nothing. `assistantActionFor` uses `matches`, then `check`. Names,
   scopes and summaries stay; no row is added, renamed or widened.
2. **The guard.** `requireSession` keeps the matched row and a snapshot of the request (method,
   path, parsed body) in `res.locals`. `assistantGuard(res)` (`routes/assistant.ts`) returns
   nothing for the owner, or a function that re-runs the row's `check` and throws
   `AssistantRefusal` (403). Owner requests are unchanged.
3. **The services.** Each write listed above takes an optional `guard` and calls it first inside its
   transaction: the transactions PUT, `PUT /rules/:id`, `applyRules`, `linkTransfer`, `setClaim`,
   `recordEvent`, `undoChangeSet`, `createAssistantProposal`. `setClaim` and `recordEvent` gain a
   `db.transaction`; `applyRules` plans inside its transaction. These also benefit the owner.
4. **The header rule.** The reconciled-row refusal leaves `routes/transactions.ts` and becomes part
   of `categorise_transaction`'s check, so no general route asks whether the caller is a token.
5. **The log.** A refusal from the guard is logged as `refused` (today `finishAssistantAction`
   writes `failed` for every status of 400 or more), with the check's reason.
6. **Docs.** ASSISTANT-ENDPOINTS.md (steps 4 and 5, phase 3 done), READ-ONLY-ACCESS.md where it
   describes checks, CLAUDE.md/AGENTS.md's test file name, HANDOVER State.

## Tests

- **`auth/assistantPolicy.test.ts`** (new; the file CLAUDE.md already names): for every row, the
  allowed case and the nearest refusal, moved from or pointing at the existing route tests, and a
  test that every row with a `check` has an interleaving case below.
- **Interleaving, per budget-reading row:** the test app mounts a middleware between
  `requireSession` and the routers that changes the budget after the early check: dates the
  transaction tomorrow, adds a claim, enables the rule, dismisses the suggested pair, changes the
  deposit's amount, records a contribution that clears what you owe, fills the 50 proposals. Each
  must answer 403, change nothing and log `refused`. Each fails without the change (the write goes
  through today).
- **Owner unchanged:** the owner's same writes still succeed (including replacing a claim).
- Existing allowed and refused cases in `assistant.test.ts`, `assistantTools.test.ts` and
  `accessTokens.test.ts` keep passing unchanged; MCP tools need no change.

## Size and release

One app PR (server only, no migration, no backup change, no UI): about 15 files, a patch version
from `npm run release:prepare`, a CHANGELOG entry. No user guide page: owners see no new screen,
only `refused` in **Assistant activity** where a write lost a race.

## Owner decisions

1. **Option A, B or C.** Recommended: A.
2. **Run the check twice, or move it.** Recommended: twice (early in `requireSession` and inside the
   write), so a route that forgets its guard still has today's check. Moving it means one run, but a
   forgotten guard means no check at all.
3. **Scope of rows.** Recommended: the seven budget-reading rows plus the two service-side checks
   († above). The six shape-only rows keep their single early check, and a test asserts they read
   nothing from the database.
4. **Claims structurally insert-only for tokens.** Recommended: yes. With a guard, `setClaim` inserts
   without `onConflictDoUpdate`, so the database's unique key refuses a replacement even if a
   check were wrong. The owner's path keeps replacing.
5. **The MCP change-set race.** Recommended: a separate small PR after this one (the transactions
   PUT returns the category it replaced, read inside its transaction, and MCP records that), to
   keep this PR to one purpose. Or include it here.
6. **The guard refusal's wording** in the log and the response. Recommended: "This changed before
   it could be saved: " followed by the check's own reason.
