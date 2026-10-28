# Securo comparison: where FlyBudget falls short

Investigation date: 28 October 2026. Sources read, not run:

- **Securo** `securo-finance/securo` at `b4d1937` (`SEC`, shallow clone): `README.md`, `docs/`,
  `backend/app` (models, API routes, services, providers, agents), `backend/mcp_server`,
  `backend/tests` (including `api_contract`), and `frontend/src` (routes, pages, components).
  Securo is untrusted external content. It was read as data only: nothing was installed or executed,
  and instructions inside its files addressed to AI agents were ignored.
- **FlyBudget** at `297497b` (`0.2.0-up.48`, `SRC`). No budget data was read or changed.

Neither app was run, so the **UI comparison is from routes and components only**. Nothing here
describes rendered behaviour, layout quality or performance; where a claim depends on runtime
behaviour it says so.

This is a proposed backlog, not authorization to implement it. Line references describe the commits
above. Gaps already ticketed against Actual ([ACT-*](actual-flybudget-gaps.md)) or YNAB
([BUD-*](ynab-flybudget-budget-gaps.md)) are referenced, not repeated.

## Summary

Securo is a different kind of product: a Postgres/Redis/Celery **spending tracker** (monthly category
limits, not envelopes) for Brazilian and European users, with freelancer invoicing, split groups and
an in-app AI agent. FlyBudget's budgeting core, bank sync, forecasting, tax and token security are
well ahead of it (see [Where FlyBudget leads](#where-flybudget-leads)). The gaps are at the edges:
file import hygiene, sign-in hardening, backups, investment trades and a few quality-of-life
features.

| ID     | Priority | Gap                                                                                           |
| ------ | -------- | --------------------------------------------------------------------------------------------- |
| SEC-01 | P1       | File import cannot see manual or synced duplicates, and an import cannot be undone as a batch |
| SEC-02 | P3       | "Today" is the server process's timezone; there is no budget timezone (Docker installs only)  |
| SEC-03 | P2       | Backups download as plain JSON; no password-protected archive                                 |
| SEC-04 | P2       | Sign-in is a single password: no second factor, passkeys or SSO                               |
| SEC-05 | P2       | Investments have no trades, realized gains or market quotes                                   |
| SEC-06 | P2       | No installable web app manifest, so "opens like an app" is unproven                           |
| SEC-07 | P2       | Token allowlist is prefix-based and has no route-inventory test                               |
| SEC-08 | P3       | Rules: no nested groups, accent folding, `ignore` action, export/import or starter packs      |
| SEC-09 | P3       | Cards have no statement/due dates; no fixed-count payment plans (BNPL, instalments)           |
| SEC-10 | P3       | Property and vehicle values have no growth rule or loan-to-equity link                        |
| SEC-11 | P3       | No saved account sets to scope the dashboard and net worth                                    |
| SEC-12 | P3       | Register: no running balance; the full ledger is fetched without paging                       |
| SEC-13 | P3       | No in-app assistant (decision: external tokens only)                                          |
| SEC-14 | P3       | One budget cannot be shared with viewer/editor roles (decision: separate budgets)             |

Shared with earlier lists, not re-ticketed: OFX/QFX/QIF import (`ACT-07`; Securo parses OFX, QIF,
CAMT and CSV), a Ctrl/Cmd+K command palette (`ACT-08`; Securo has `command-palette.tsx` over
`/api/search`), an interface in 18 languages (`ACT-13`; Securo has 18 locale files plus
`i18n.test.ts`), and a scripting CLI (`ACT-10`; Securo's `cli.py` only has `create-user` and
`generate-recurring`, so it is not ahead).

## P1 · SEC-01: file import cannot see manual or synced duplicates, and cannot be undone

- **Securo:** `import_transactions` checks each incoming row against existing rows in the account by
  external id (OFX FITID) plus date, amount and type, else by date, amount, type and either
  description. It then falls back to `find_unique_transaction_match` (date within 3 days, same
  amount and direction, matching description, exactly one candidate) against **synced** rows
  (`SEC backend/app/services/import_service.py` lines 1027-1085;
  `SEC backend/app/services/transaction_match_service.py` line 23). The reverse also exists: when a
  bank connection is added to an account that has file history, the sync adopts the unclaimed
  imported rows (`SEC backend/app/services/connection_service.py` lines 1900-1910). Every file import
  writes an `ImportLog` (filename, format, count, credit and debit totals) and stamps its rows
  (`SEC backend/app/models/import_log.py`). Deleting the log removes exactly those rows
  (`SEC backend/app/api/import_logs.py` line 51; `SEC frontend/src/components/import-history.tsx`). Its delete removes every row of the import unconditionally, even ones the user has since edited or categorised, which FlyBudget should not copy.
- **FlyBudget:** the CSV/CAMT preview and the confirm step both compare only the row's synthetic
  `importedId`, which is `date|amount|payee` plus an occurrence counter
  ([generateImportId](../../client/src/utils/csv.ts#L375);
  [preview](../../server/src/routes/transactions.ts#L613),
  [confirm](../../server/src/routes/transactions.ts#L638)). A manually entered row has
  `importedId: null` ([line 444](../../server/src/routes/transactions.ts#L444)) and an Up, Plaid or
  SimpleFIN row has the provider's id, so neither can ever match an incoming file row. The confirm
  route does not check whether the account is bank-mapped. Rows are not tagged with the import that
  created them, so there is no import history and no "undo this file"; a bad import means selecting
  rows and deleting them. Up refuses to link an account that already has history
  ([UP-SUPPORT.md](../../UP-SUPPORT.md#L93)) and Enable Banking adopts earlier imports
  ([matchExistingImports](../../server/src/services/enableBankingTransactions.ts#L356)), so the hole
  is specifically the **file import path**.
- **Why it matters here:** the owner keeps manual entries (cash, pre-sync history) and imports
  statements for accounts that Up does not cover. A statement that overlaps manually entered days
  doubles spending in the envelope and moves Ready to Assign, and nothing flags it. Not undoable as
  a unit is what turns a mistake into an hour of cleanup. `ACT-08` mentions duplicate merge; this is
  the earlier step that stops them arriving.
- **Seam:** a pure `matchExistingRows` in `services/` shared by `import/preview` and `import/confirm`
  (same amount, within 3 days, payee similarity, each existing row used once; mark as "possible
  duplicate" and untick, never skip silently, in line with the transfer-review rule). An additive
  `import_batches` table plus `transactions.import_batch_id`, with a delete-batch route that refuses
  reconciled rows and is recorded as a change set so it is undoable. Backup format needs the new
  column.

## P3 · SEC-02: "today" is the server process's timezone

- **Securo:** one resolution order for "today": workspace timezone, then an admin-saved application
  timezone, then `TZ`, then the host, then UTC, snapshotted per request and job
  (`SEC backend/app/core/app_clock.py` lines 1-20, `app_today` line 148; README "Timezone"). Budgets,
  due dates and recurring generation all call it.
- **FlyBudget:** server-side "today" is `format(new Date(), 'yyyy-MM-dd')`, i.e. the Node process's
  zone, in the scheduler
  ([scheduleService.ts](../../server/src/services/scheduleService.ts#L85),
  [line 110](../../server/src/services/scheduleService.ts#L110)), schedule routes
  ([schedules.ts](../../server/src/routes/schedules.ts#L118)),
  [dashboardService.ts](../../server/src/services/dashboardService.ts#L115),
  [reports.ts](../../server/src/routes/reports.ts#L535) and
  [householdService.ts](../../server/src/services/householdService.ts#L128). No `TZ` is set in the
  Dockerfile, `homeassistant/` or `docker-compose.yml` (searched). Only payday plans carry their own
  zone ([dateInZone](../../server/src/services/paydayConfig.ts#L88)) and Up dates follow the bank
  offset ([upTransactions.ts](../../server/src/services/upTransactions.ts#L66)).
- **Why it matters here:** on Home Assistant this is normally moot: the Supervisor passes the
  system timezone to every app as `TZ`, so the process's zone is the owner's (reviewer's note; not
  inspected on the live app). A plain `docker compose` install has no `TZ` and runs in UTC, so an
  Australian user's server is a day behind from midnight until about 10 am AEST (11 am in daylight
  time): scheduled items fall due and auto-create late, "overdue" flags flip late, and the browser
  and server can disagree about the date. Money is not lost, but dates drive matching windows and
  the current month. Rated P3 for that reason.
- **Seam:** `budget_settings` timezone (IANA, validated like `paydayConfig`), one `todayIso()` in
  `utils/date.ts`, and replacing the `format(new Date(), …)` calls. Default to the HA-provided or
  host zone so existing budgets behave as before until it is set.

## P2 · SEC-03: backups download as plain JSON

- **Securo:** `POST /api/export/backup` takes an optional password and returns an **AES-256 zip**
  (WinZip AES, openable by 7-Zip and Keka), explicitly not ZipCrypto
  (`SEC backend/app/services/backup_service.py` lines 1-40; `SEC backend/app/api/export.py` lines
  103-135). The password goes in the body, not the query string.
- **FlyBudget:** `GET /export/backup` sends `createBackup()` as a JSON attachment
  ([export.ts](../../server/src/routes/export.ts#L139)). It omits bank credentials, the server
  password and sessions ([backupService.ts](../../server/src/services/backupService.ts#L86)), but it
  holds every transaction, payee, note and receipt line. The guide says to keep it "somewhere safe"
  ([backups.mdx](../../website/docs/backups.mdx)). A restore saves a safety copy first
  ([saveSafetyCopy](../../server/src/services/backupService.ts#L579)), which is good. There is no
  in-app scheduled backup (Home Assistant's own backups cover the HA install).
- **Why it matters here:** the file is meant to travel to a drive or cloud folder, the place where
  an unencrypted copy of a full financial history is worst. Restore-side must also accept the
  encrypted form, and the HA migration rule in CLAUDE.md ("cold backup including the encryption
  key") would benefit from a one-click encrypted export.
- **Seam:** `POST /export/backup` with an optional password; wrap the existing JSON with a streaming
  AES container (no new unsafe install scripts: the repo's `.npmrc` guard stays) and a matching
  restore path. Format must be openable without FlyBudget.

## P2 · SEC-04: sign-in is a single password

- **Securo:** TOTP with brute-force protection (`SEC backend/app/api/two_factor.py`), passkeys
  (WebAuthn; `SEC backend/app/api/passkeys.py`, README "Passkeys" including the HTTPS/localhost rules),
  OIDC with role mapping, auto-registration and existing-user link policies
  (`SEC backend/app/api/oidc_auth.py`, README "OIDC Login"), and a local-auth-off mode.
- **FlyBudget:** scrypt password, HttpOnly SameSite=Strict hashed-token sessions, trusted-device
  lockout protection and a signed-in devices list
  ([sessions.ts](../../server/src/auth/sessions.ts#L13), [DEVELOPMENT.md](../DEVELOPMENT.md#L153)).
  No TOTP, passkey or OIDC code exists (searched `server/src`, `client/src`, `electron`); the only
  mention is "SSO and OIDC Support" in the upstream README's wish list.
- **Why it matters here:** CLAUDE.md requires HTTPS away from home, so the owner exposes the server.
  A single secret is the whole barrier to bank-linked financial data. Sessions last 30 days. Note
  Securo's session model is weaker than FlyBudget's (below), so the lesson is the second factor, not
  the token handling.
- **Seam:** `auth_config` gains encrypted TOTP secret and recovery codes (use the existing
  `credentialEncryption`); passkeys need an RP id that works behind HA ingress and the gateway, which
  is the hard part. Gateway multi-user mode needs the same checks at its sign-in.

## P2 · SEC-05: investments have no trades, realized gains or quotes

- **Securo:** an `asset_transactions` buy/sell ledger is the source of truth; units, weighted
  average cost, cost basis and **realized gain** are derived and cached
  (`SEC docs/rfc-235-investment-ledger.md`; `SEC backend/app/models/asset_transaction.py`;
  `SEC backend/app/services/asset_transaction_service.py` `_recompute` line 43, oversell guard
  line 84). Holdings can be market-priced from a ticker lookup with scheduled refresh
  (`SEC backend/app/providers/market_price.py`; `refresh_all_market_prices`,
  `SEC backend/app/services/asset_service.py` line 1159) and have a portfolio value series.
  Order CSV import exists.
- **FlyBudget:** holdings with tax lots and **manual prices only**, no network calls, stale after 7
  days ([INVESTMENTS.md](../INVESTMENTS.md#L17)). Sales, realized gains, lot selection, dividends,
  automatic quotes and performance over time are listed as deferred
  ([line 29](../INVESTMENTS.md#L29)). Buying is "edit the holding and add a lot".
- **Why it matters here:** this is a documented decision, not an oversight, but it is the largest
  feature gap against a peer. For an Australian owner the missing piece is a sale record: the CGT
  discount depends on holding period per parcel, so the weighted average Securo uses (Brazilian
  "preço médio") is **not** the model to copy; keep lots and add disposals with a chosen lot method.
- **Seam:** additive `holding_trades` beside `tax_lots`; derive quantity from lots minus disposals,
  keep "never writes to the ledger". Quotes would need an opt-in outbound fetch that goes through
  `safeFetch` like the exchange-rate fetch.

## P2 · SEC-06: no web app manifest

Found independently in the FinX comparison as [FINX-03](finx-flybudget-gaps.md#p2--finx-03-phone-shell-installability-and-one-tap-add), which also covers one-tap add.

- **Securo:** `frontend/public/manifest.json` (standalone display, 192/512 and maskable icons) plus
  `apple-touch-icon.png`. It has no service worker, so it installs but is not offline.
- **FlyBudget:** `client/public` holds `logo.png` and `sw.js` only. `client/index.html` has no
  `<link rel="manifest">`, `theme-color` or `apple-touch-icon`. The service worker is registered in
  [main.tsx](../../client/src/main.tsx#L68). The phone guide says Add to Home Screen makes FlyBudget
  "open like an app" and work offline over HTTPS ([phone.mdx](../../website/docs/phone.mdx#L35)).
- **Why it matters here:** without a manifest, Chrome on Android offers a shortcut rather than an
  install and the page keeps the browser chrome; iOS behaviour depends on version. I could not test
  either, so the claim is from source: nothing in the page declares standalone display.
- **Seam:** a manifest served with correct headers (the server's CSP and host checks apply), icons
  generated from `logo.png`, and the meta tags. Check the multi-user gateway and Home Assistant
  ingress base paths so `start_url` and `scope` are right. Same page also says "no separate user
  accounts yet" ([line 42](../../website/docs/phone.mdx#L42)), which multi-user mode has since
  changed; worth correcting in the same pass.

## P2 · SEC-07: the token allowlist is prefix-based, with no route-inventory test

- **Securo:** `backend/tests/api_contract` fans every OpenAPI operation into five variants (owner,
  viewer, empty body, unknown id, anonymous) and compares each with an exact status in
  `baseline.json` (1,066 lines). `test_baseline_covers_every_operation`
  (`SEC backend/tests/api_contract/test_api_contract.py` line 24) fails when a route is added
  without a baseline entry, so a new endpoint forces someone to decide who may call it. A second
  test forbids a baseline that expects a 500.
- **FlyBudget:** a read-only token may GET anything under the `READABLE` prefixes; only one pattern
  is carved out ([READABLE](../../server/src/auth/accessTokens.ts#L142),
  [UNREADABLE](../../server/src/auth/accessTokens.ts#L166),
  [readOnlyAllows](../../server/src/auth/accessTokens.ts#L170)). A new `GET /accounts/:id/<anything>`
  or `GET /transactions/<anything>` is token-readable the moment it is written. Tests assert a
  hand-picked list of ten denied routes
  ([accessTokens.test.ts](../../server/src/routes/accessTokens.test.ts#L111)). Nothing enumerates the
  Express routes (searched for router-stack walking). The invariants in CLAUDE.md ("never add a
  writing, settings, backup, auth or bank route") are therefore enforced by review, not by a test.
- **Why it matters here:** the sensitive part of this app is the token boundary. I found no current
  leak, but my check was a sample (the schedules and accounts GET handlers), not a full audit. The
  point is that the next route is not checked.
- **Seam:** a test that walks the mounted routers, classifies every method and path as
  session-only, token-readable or token-writable, and compares with a checked-in baseline
  (`routeInventory.json`). Adding a route then fails CI until someone classifies it. Express
  `router.stack` is enough; no OpenAPI is needed.

## P3 · SEC-08: rule engine and rule portability

- **Securo:** conditions can nest: a group joins its own leaves with its own AND/OR, so
  `debit AND (UBER OR 99POP)` is one rule (`SEC backend/app/services/rule_engine.py` `_match_group`
  line 172). Matching strips accents from text and pattern. Actions include `set_description` and
  `ignore` (line 285). Rules export and import as a file, with an overwrite confirmation, and
  country **rule packs** install with a category-resolution step
  (`SEC backend/app/api/rules.py` lines 138-175, 227-278;
  `SEC backend/app/services/rule_service.py` `RULE_PACKS`, `install_rule_pack` line 803).
  Securo ships BR, US, EU and GB packs, none for Australia.
- **FlyBudget:** one flat AND/OR per rule ([ConditionsOp](../../server/src/services/rulesEngine.ts#L69)),
  case-insensitive but not accent-insensitive
  ([lower](../../server/src/services/rulesEngine.ts#L115)), no `ignore`/hide action (the
  `hiddenFromReports` flag exists but only by hand), and no rule file export or import or starter
  set. Rule changes do have preview and apply
  ([rules.ts](../../server/src/routes/rules.ts#L152)).
- **Why it matters here:** an Australian starter set (supermarkets, fuel, Up round-ups, BPAY,
  government payments) would help a new budget, and export/import would make rules survive a budget
  reset without a full backup restore. Accent folding is minor for AU payees (café, Zürich).
  Related: `ACT-12`.
- **Seam:** `rulesEngine.ts` is pure, so nested groups are a type change plus `normalizeConditions`
  migration; export/import reuses the `proposedBy`/disabled-by-default path so imported rules arrive
  disabled and are reviewed, consistent with the token rules.

## P3 · SEC-09: card statement dates and fixed-count payment plans

- **Securo:** credit-card accounts carry `statement_close_day` and `payment_due_day`; the service
  derives the next close and due from the same cycle and clamps month ends
  (`SEC backend/app/services/credit_card_service.py` lines 25-50), bills are stored with total and
  minimum (`SEC backend/app/models/credit_card_bill.py`), and a manual bill-cycle override exists.
  `POST /api/transactions/installments` creates a series of N future rows with a stable series id
  that re-syncs the total on edit (`SEC backend/app/services/transaction_service.py` line 897).
- **FlyBudget:** the account has no statement or due day
  ([accounts](../../server/src/db/schema.ts#L22); searched for `statement_close`, `dueDay`,
  `billing_cycle`). Card payment reserves are modelled by funding, not by statement
  ([CARD-PAYMENTS.md](../CARD-PAYMENTS.md)). Schedules end by date only
  ([recurrence.ts](../../server/src/utils/recurrence.ts#L15), `endDate` at
  [schema.ts](../../server/src/db/schema.ts#L206)): there is no "4 payments", no remaining count or
  total. Searched for `installment`, `numberOfPayments`, `remainingPayments`.
- **Why it matters here:** Afterpay, Zip and phone or device plans are common in Australia and are
  exactly "N equal payments, then stop". Today the owner computes the end date by hand. A due day
  would also let Review say when a card payment is due, not just that it is funded. Securo's
  Brazilian "fatura" model is not needed; only the two days and an N-payments schedule.
- **Seam:** optional `statementDay`/`dueDay` beside `account_loan_details`; `schedules` gains an
  optional occurrence count that derives `endDate` and shows "3 of 4 paid".

## P3 · SEC-10: property and vehicle valuation

- **Securo:** a non-market asset can use a **growth rule** (percentage or absolute, daily to
  yearly, optional start date) that generates dated value rows
  (`SEC backend/app/services/asset_service.py` `_generate_growth_values` line 72). Real estate and
  vehicles can be the collateral of a loan, and the page shows equity
  (`SEC backend/app/models/asset.py` `LOAN_COLLATERAL_TYPES` line 20;
  `SEC frontend/src/components/property-equity-summary.tsx`).
- **FlyBudget:** property, vehicle and valuables are accounts whose value changes by hand through
  "Update value" adjustment transactions ([DEVELOPMENT.md](../DEVELOPMENT.md#L274)). Loan details
  (rate, repayment, term) sit beside the loan account but are not linked to an asset
  ([loanDetails.ts](../../server/src/services/loanDetails.ts)). Searched for `equity`, `collateral`,
  `appreciation`, `depreciation`: nothing outside Plaid's data.
- **Why it matters here:** net worth history for a house or car is a step function of manual edits;
  the long-term forecast has growth assumptions but the past does not. Equity (value minus linked
  mortgage) is a number the owner will want on the Accounts page.
- **Seam:** `account_valuation_rules` and a nullable `securedByAccountId` on loan details. Generated
  rows must be adjustments, flagged as rule-made, and never touch the budget (they are off-budget
  accounts).

## P3 · SEC-11: saved account sets

- **Securo:** "collections" are named, coloured bundles of accounts; the active collection filters
  dashboard and report aggregations (`SEC backend/app/models/collection.py`,
  `SEC backend/app/services/collection_service.py`,
  `SEC backend/tests/test_collection_filtering.py`).
- **FlyBudget:** accounts are grouped only by type and on/off budget. The report builder and the
  transaction filters accept account lists
  ([customReports.ts](../../server/src/routes/customReports.ts#L22)), but there is no saved set and
  no way to scope the Dashboard or net worth by one. Searched `collection`: no match.
- **Why it matters here:** "Joint", "Mine", "Business/ABN" and "Super" views without rebuilding a
  filter each time; the household pool accounts already prove the owner has accounts that should not
  mix.
- **Seam:** `account_sets` table plus a selector that feeds the existing `accountIds` parameters.

## P3 · SEC-12: register running balance, and the full ledger fetch

- **Securo:** the account page shows a **running balance** per row and a balance series, computed
  server-side and shared by both so they agree (`SEC backend/app/services/account_service.py`
  `_running_balance_delta` line 1451). Lists are paged: `page`/`limit` (default 50, max 500) with a
  summary (`SEC backend/app/api/transactions.py` lines 175-223).
- **FlyBudget:** the register has no balance column (searched `running.?balance` in `client/src`).
  `GET /transactions` returns every match unless a `limit` is passed, deliberately, because
  reconciliation and category views need all rows
  ([transactions.ts](../../server/src/routes/transactions.ts#L353)). The register table asks for no
  limit and has no virtualization or "load more" (searched). Not measured. At the `ACT-02`
  benchmark size (about 20,000 rows) the response size and the render are the thing to measure.
- **Why it matters here:** a running balance is what the owner compares against a statement before
  using the Reconcile page; the unbounded fetch is the part that would degrade first on the N100 host.
- **Seam:** a computed balance column in `TransactionRow` for single-account views only (it is
  undefined across accounts), and a measured decision on virtualization before any server paging.

## P3 · SEC-13: an in-app assistant (decision, not a defect)

- **Securo:** an Agents module with provider connections (OpenAI, Anthropic, Ollama and compatible),
  tool use over its MCP tools, a per-agent knowledge base with embeddings, usage tracking and a
  global chat panel (`SEC backend/app/agents/`, `SEC frontend/src/components/agents/chat-panel.tsx`).
  Its `propose_*` tools return a card the user applies; for **external** tokens an `apply: true` flag
  performs the write directly (`SEC backend/mcp_server/tools/proposals.py` lines 1-15), including
  creating transactions, recurring items and goals.
- **FlyBudget:** assistants connect from outside through scoped tokens and MCP
  ([READ-ONLY-ACCESS.md](../READ-ONLY-ACCESS.md)); there is no chat inside the app. Local OCR with
  the owner's own Ollama exists for receipts ([RECEIPTS-AND-TAX.md](../RECEIPTS-AND-TAX.md)).
- **Judgement:** the external-token design is the safer one; Securo's direct-apply flag is exactly
  what the token invariants in CLAUDE.md rule out. An in-app panel would be a convenience built on
  the same tools. Recorded so it stays a decision.

## P3 · SEC-14: sharing one budget with roles (decision)

- **Securo:** workspaces with `owner`, `editor`, `viewer` members, invitations, an external
  "manager" role and OIDC group-to-role mapping (`SEC backend/app/models/workspace.py` lines 30-60,
  `SEC backend/app/services/workspace_service.py`). Viewers are blocked from writes by the contract
  suite's `viewer` variant.
- **FlyBudget:** the multi-user design chose **separate budgets behind a gateway** so a missed
  `where` cannot leak one person's money to another
  ([MULTI-USER-PLAN.md](../MULTI-USER-PLAN.md)). A partner can be a household participant but
  gets no access to the budget ([HOUSEHOLDS.md](../HOUSEHOLDS.md)); a read-only token is the nearest
  thing to a viewer.
- **Judgement:** that tradeoff is sound for this data model (about 100 files import the database
  directly). A "viewer for my partner" would be a gateway-level read session onto one budget, not a
  per-row role system. Noted as a decision.

## Code and architecture notes

Only where the source shows it.

- **Money representation:** FlyBudget stores integer minor units. Securo stores `Numeric(15,2)`
  decimals plus a second `amount_primary` column and converts to `float` in places, for example
  `_compute_current_value` in `SEC backend/app/services/asset_service.py` line 53. FlyBudget's
  choice is the safer one and CLAUDE.md already requires it.
- **Sessions:** Securo signs a stateless JWT (default 24 hours, held in `localStorage`,
  `SEC frontend/src/lib/api.ts` line 122; `SEC backend/app/core/auth.py` line 87) with a
  placeholder default secret (`SEC backend/app/core/config.py` line 26). Its login rate limiter
  needs Redis and keys on IP only (`SEC backend/app/core/rate_limit.py`). FlyBudget's
  server-side hashed sessions, device-keyed lockout and revocation are stronger.
- **Decide, don't write:** Securo's reconciliation engine returns a decision plus a trace of which
  strategy fired and why others did not, and never touches the session
  (`SEC backend/app/services/reconciliation_engine.py` lines 1-60); declined suggestions are stored
  so they do not come back (`SEC backend/app/models/reconciliation.py`). FlyBudget has the second
  ([scheduleMatchDismissals, transferMatchDismissals](../../server/src/db/schema.ts#L267)) but its
  schedule matcher carries only a numeric confidence
  ([matchingEngine.ts](../../server/src/services/matchingEngine.ts#L12)). A "why this match" string
  would help review.
- **Test shape:** beside the route sweep (SEC-07), Securo has a page-module evaluation test that
  imports every lazy page from a glob (`SEC frontend/src/pages/pages.contract.test.ts`), because a
  broken lazy chunk passes `tsc` and the build. FlyBudget's e2e navigation spec exercises routes
  but I did not find an equivalent import-every-page unit test. Securo has no browser tests;
  FlyBudget's Playwright suite is the stronger layer.
- **Operations:** Securo needs Postgres, Redis, a Celery worker and beat, and an optional MCP
  container (`docker-compose.yml`). FlyBudget runs one process with SQLite, which fits the Home
  Assistant host and makes the cold-backup rule simple.

## UI notes (from routes and components, not rendered)

| Area         | Securo (`frontend/src`)                                                              | FlyBudget (`client/src`)                                                         |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Navigation   | Per-workspace module list (`module_service.py`), command palette, workspace switcher | Fixed sidebar, no module toggles, no palette                                     |
| Budget       | `budgets.tsx`: monthly category limits versus actual                                 | `Budget.tsx` envelope table, annual view, category detail, phone sheet           |
| Transactions | List and calendar views, column picker, mobile bulk selection, quick add             | Register with saved views, bulk edit with preview, split, tags; no calendar view |
| Calendar     | Transactions plus projected balance by day (`transaction_calendar_service.py`)       | Recurring calendar of scheduled occurrences only (`recurring/Calendar.tsx`)      |
| Reports      | Net worth, income vs expenses, cash flow with Sankey                                 | Dashboards of widgets, custom reports, Sankey cash flow, spending trends         |
| Accounts     | Running balance, closure, credit-card cycle, collections                             | Reconcile page, update value, closed accounts; no running balance                |
| Import       | OFX, QIF, CAMT, CSV with review table and history                                    | CSV and CAMT with mapping and preview; no history                                |
| Auth screens | Login, TOTP, passkeys, OIDC, register, setup                                         | Password with setup code; devices list in Settings                               |
| Onboarding   | Product tour (`onboarding-tour.tsx`)                                                 | Welcome page and website tour                                                    |

A transactions calendar view with a projected daily balance is the one UI feature in this table with
no FlyBudget counterpart that is not already in another gap; FlyBudget's Forecast page covers the
projection itself, so it is a presentation gap only and not ticketed.

## Where FlyBudget leads

- **Budgeting model.** Envelope ledger with Ready to Assign, targets, card-payment funding, payday
  plans, moves and undo, against Securo's per-month category limits
  (`SEC backend/app/services/budget_service.py`: a recurring default plus month overrides).
- **Bank sync breadth and safety.** Up, Plaid, SimpleFIN and Enable Banking with credentials
  encrypted by a key file, round-up checks, opt-in polling with backoff.
- **Token security.** Scoped read, categorise and organise tokens with change sets and undo.
  Securo lets an external token write directly with `apply: true`.
- **Session security.** HttpOnly hashed sessions, device-keyed lockout, signed-in devices list,
  host and origin protections.
- **Forecasting and review.** Scenario forecasts, long-term simulation with super and HECS-HELP,
  resilience and housekeeping reviews. Securo has a cash-flow forecast only.
- **Australian tax and receipts.** ATO deduction claims, receipt OCR and line-item splits.
  Securo's "fiscal" packs are tax-id validators for other countries.
- **Households.** Pool accounts, shares and statements keyed to a personal budget; Securo's groups
  are expense splitting with settlements.
- **Offline.** Read-only offline copy and a queue for new transactions; Securo has no service worker.
- **Money handling and tests.** Integer minor units, additive migrations, a Playwright suite.
- **Operations.** One process, one SQLite file.

Not a gap: Securo's invoices, products and shared invoice links (`SEC backend/app/api/invoices.py`,
`public_invoices.py`) and its Brazilian providers (Pluggy, Tesouro Direto). They serve freelancers and
a market this owner is not in.

## Suggested order

1. **SEC-01**, because it can silently double spending. The matcher is small and reuses the
   transfer-review pattern; the batch table is an additive migration.
2. **SEC-07**, a test only, before more routes or token scopes are added.
3. **SEC-03** and **SEC-04**, together as the hardening pair; SEC-04's gateway work is the larger.
4. **SEC-06** (the same gap as [FINX-03](finx-flybudget-gaps.md)), small and visible on the phone.
5. **SEC-02**, for Docker installs, with the same "no behaviour change until set" default as other
   additive settings.
6. **SEC-05**, once a CGT lot-method design exists; do not copy the weighted average.
7. SEC-08 to SEC-12 as wanted. SEC-09's payment plans are the most useful of these for AU.
8. SEC-13 and SEC-14 stay decisions unless the owner asks.
