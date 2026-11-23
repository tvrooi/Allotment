---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
<!-- refreshed: 2026-11-13 -->
# Architecture

**Analysis Date:** 2026-11-13

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Client (React + Vite, `client/src/`)              │
│  pages/ · components/ · hooks/ (React Query) · api/ (typed fetch) · store/│
├──────────────────────┬────────────────────────┬───────────────────────────┤
│  Browser / Server    │  Electron desktop      │  In-browser demo          │
│  BrowserRouter       │  HashRouter, file://   │  HashRouter, worker fetch │
│  `client/src/main.tsx`│ `electron/main.ts`    │ `client/src/demo/demoApi.ts`│
└──────────┬───────────┴───────────┬────────────┴─────────────┬─────────────┘
           │ HTTP /api/*           │ loopback HTTP (same-origin)│ postMessage
           ▼                       ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Express API (`server/src/index.ts`, `startServer`)                       │
│  middleware (host/origin/token/security) → auth gate → routers/*.ts       │
├───────────────────────────────────────────────────────────────────────────┤
│  Services (`server/src/services/*.ts`): budget engine, rules, transfers,  │
│  households, bank sync (Up, Plaid, SimpleFIN, Enable Banking), files, tax  │
├───────────────────────────────────────────────────────────────────────────┤
│  Data (`server/src/db/`): Drizzle schema + better-sqlite3, WAL, FK on     │
│  `db/migrations/0000…0088`; secrets via `db/secretCrypto.ts`              │
└───────────────────────────────────────────────────────────────────────────┘
   Side paths:
   • Multi-user gateway (`server/src/gateway/`) runs one server per person on loopback
   • Demo (`server/src/browser/`) runs the same routers in a Web Worker over sql.js
   • Home Assistant wrapper (`homeassistant/`) launches the server add-on
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Server bootstrap | Builds the Express app, applies guards, mounts routers, runs migrations, starts timers and Up polling | `server/src/index.ts` |
| Config | Reads env (mode, host, proxy, data key, gateway secret) and refuses unsafe bind settings | `server/src/config.ts` |
| DB connection | Opens SQLite (`DB_PATH`, WAL, foreign keys on) and exports the Drizzle `db` | `server/src/db/index.ts` |
| Schema | Drizzle table definitions (about 99 tables) | `server/src/db/schema.ts` |
| Migrations | Numbered additive SQL, applied on startup | `server/src/db/migrations/` |
| Request guards | Host allowlist, origin check, API token, security headers, rate limits, error handler | `server/src/middleware/security.ts` |
| Sessions and auth | Password, setup code, sessions, host kind | `server/src/auth/*.ts`, `server/src/routes/auth.ts` |
| Read-only access | Token policy and allowlist for side-effect-free GETs and the MCP endpoint | `server/src/auth/accessTokens.ts`, `server/src/auth/assistantPolicy.ts` |
| Assistant writes | The single write path for tokens, one row per policy entry, logged | `server/src/routes/assistant.ts`, `server/src/services/assistantActions.ts` |
| Transaction writes | Shared helpers for every transaction mutation (splits, reconciled rows, transfers) | `server/src/services/transactionHelpers.ts`, `server/src/services/transactionEdits.ts` |
| Budget engine | Ready-to-assign, envelopes, funding, holds and moves | `server/src/services/budgetService.ts`, `budgetLedger.ts`, `fundingPlan.ts`, `budgetMoves.ts` |
| Rules | Categorisation rules: read old formats, write current only | `server/src/services/rulesEngine.ts`, `ruleService.ts` |
| Transfers | Suggests and pairs transfers for review (never guesses) | `server/src/services/transferMatching.ts`, `transferService.ts` |
| Up bank | Token handling, sync (startup, manual, opt-in polling), categories, round-up transfer linking | `server/src/services/upService.ts`, `upSyncService.ts`, `upTransactions.ts`, `routes/up.ts` |
| Other bank feeds | Plaid, SimpleFIN, Enable Banking sync services | `server/src/services/plaid*.ts`, `simplefin*.ts`, `enableBanking*.ts` |
| Households | Shared budgets, partner links, shared payments and ledger | `server/src/services/householdService.ts`, `householdLedger.ts` |
| Files | Documents, links and receipts as documents; byte store | `server/src/services/documentService.ts`, `fileStore.ts`, `routes/files.ts` |
| Outbound fetches | SSRF-guarded fetch for rates and bank callbacks | `server/src/services/safeFetch.ts` |
| Gateway | Multi-user sign-in, per-person budget process, notify relay | `server/src/gateway/index.ts`, `app.ts`, `budgets.ts` |
| Demo server | Node-only modules swapped for browser stand-ins | `server/src/browser/app.ts`, `worker.ts`, `db.ts`, `expressShim.ts` |
| Client shell | Routes (lazy pages), auth gate, app shell, command palette | `client/src/App.tsx`, `client/src/components/layout/AppShell.tsx` |
| Client API layer | `apiFetch` with typed errors and connection reporting | `client/src/api/client.ts`, `client/src/api/base.ts` |
| Client server state | React Query hooks per domain | `client/src/hooks/*.ts` |
| Client UI state | Stores for app, connection, undo, command palette, preferences | `client/src/store/*.ts` |
| Desktop shell | Electron window, connection page, updates, macOS window marker | `electron/main.ts`, `electron/connection.ts`, `electron/macWindow.ts`, `electron/updates.ts` |

## Pattern Overview

**Overall:** Modular monolith. One Node/Express process owns one SQLite database. A React single-page client talks to it over `/api/*`. The same server code is packaged three ways: a self-hosted server (Docker, Home Assistant add-on), an Electron desktop app that embeds it on loopback, and an in-browser demo that runs it in a Web Worker.

**Key Characteristics:**
- Thin routers in `server/src/routes/*.ts` validate with Zod, then delegate to `server/src/services/*.ts`. Routers hold little business logic.
- All money is integer minor units. Dates are `YYYY-MM-DD` strings handled by `server/src/utils/date.ts` and `server/src/utils/money.ts`.
- Writes to transactions, balances, transfers, households and the budget go through shared helpers in one DB transaction when several rows change.
- Migrations are additive and applied automatically at startup (`server/src/index.ts`, `startServer`).
- Single-process, synchronous `better-sqlite3`. Long work is scheduled (`scheduleTimer.ts`, `upSyncService.startUpPolling`) rather than run inside a request.
- Feature code is shared between server and demo. The demo rebuilds the server with `vite.config.ts` aliases (`demoServerModules`), so new Node-only imports in the demo path break the demo build.

## Layers

**HTTP guards and transport:**
- Purpose: Reject bad hosts, origins and tokens before any route runs.
- Location: `server/src/middleware/security.ts`
- Contains: `hostGuard`, `originGuard`, `apiTokenGuard`, `securityHeaders`, `bankRateLimit`, `bankCallbackRateLimit`, `apiNotFound`, `errorHandler`
- Depends on: `server/src/config.ts`
- Used by: `server/src/index.ts`, `server/src/browser/app.ts`

**Auth and access:**
- Purpose: Owner sessions, read-only tokens, assistant policy.
- Location: `server/src/auth/`, `server/src/routes/auth.ts`, `server/src/routes/accessTokens.ts`, `server/src/routes/assistant.ts`
- Contains: `sessions.ts`, `password.ts`, `setupCode.ts`, `accessTokens.ts`, `assistantPolicy.ts`
- Depends on: `server/src/db/`, `server/src/db/secretCrypto.ts`
- Used by: `requireSession` and `assistantDispatch` in `server/src/index.ts`

**Routers (HTTP surface):**
- Purpose: Map a path to validation and a service call.
- Location: `server/src/routes/`
- Contains: about 112 files, one per domain (`transactions.ts`, `budget.ts`, `rules.ts`, `up.ts`, `households.ts`, `files.ts`, `mcp.ts`, and others). Test files live beside them.
- Depends on: `server/src/services/`, `server/src/utils/validation.ts`
- Used by: `server/src/index.ts` (mounted under `/api/<name>`)

**Services (business logic):**
- Purpose: Financial rules, sync, calculations, document handling.
- Location: `server/src/services/`
- Contains: about 181 files, including budget, transfers, rules, households, bank sync, investments, tax, forecasts, reminders.
- Depends on: `server/src/db/`, `server/src/utils/`
- Used by: routers, timers (`scheduleTimer.ts`), startup tasks, the gateway

**Data:**
- Purpose: Persistence and encryption of stored secrets.
- Location: `server/src/db/`
- Contains: `index.ts` (connection), `schema.ts`, `migrations/`, `secretCrypto.ts`, `defaultCategories.ts`, `seed*.ts`
- Depends on: `better-sqlite3`, `drizzle-orm`
- Used by: services and routers

**Client pages and components:**
- Purpose: Screens and reusable UI.
- Location: `client/src/pages/` (route targets), `client/src/components/` (grouped by domain: `accounts`, `budget`, `up`, `household`, `layout`, `ui`, and others)
- Depends on: `client/src/hooks/`, `client/src/api/`, `client/src/store/`, `client/src/utils/`
- Used by: `client/src/App.tsx`

**Client data layer:**
- Purpose: Fetch, cache and mutate server state.
- Location: `client/src/api/` (one module per domain, all built on `apiFetch` in `client/src/api/client.ts`), `client/src/hooks/` (React Query wrappers)
- Depends on: `client/src/store/connectionStore.ts` (reports reachability), `client/src/api/person.ts`
- Used by: pages and components

## Data Flow

### Primary Request Path (owner, server mode)

1. Browser calls `/api/<domain>` with the session cookie. Client wrapper: `apiFetch` in `client/src/api/client.ts`.
2. `hostGuard`, `originGuard`, `apiTokenGuard`, `securityHeaders` run in `server/src/index.ts` before routing.
3. `requireSession` (`server/src/routes/auth.ts`) checks the session, except for `/api/auth`, `/api/health`, and the assistant dispatcher.
4. The domain router in `server/src/routes/<domain>.ts` validates the body with Zod, then calls one or more services.
5. Services write through `server/src/services/transactionHelpers.ts` or a domain service inside a `db.transaction`. Errors reach the client through `errorHandler` as generic JSON.

### Bank Sync Path (Up, startup or manual Sync Now)

1. `startServer` in `server/src/index.ts` calls `startUpPolling()` from `server/src/services/upSyncService.ts`. Manual sync is a `routes/up.ts` POST that calls `syncUp`.
2. `upSyncService.ts` fetches via `upService.ts` (network calls through `safeFetch.ts`), maps rows with `upTransactions.ts` and `upCategoryMap.ts`, and writes with stable IDs.
3. Reconciled or user-edited rows are preserved. Transfer suggestions go to `upReviewService.ts` for review. Round-up transfers are linked only when Up reports them exactly (`linkRoundUpTransfers`).
4. The client reads the result through `client/src/hooks/useUp.ts` and `client/src/components/up/`.

### Assistant / Read-Only Token Path

1. A token request reaches `assistantDispatch` (`server/src/index.ts`) before the session gate.
2. `accessTokens.ts` checks the GET allowlist. Anything else must be a row of the policy table in `server/src/auth/assistantPolicy.ts`.
3. Writes go only through `POST /api/assistant/do` (`server/src/routes/assistant.ts`) and are logged by `server/src/services/assistantLog.ts`. Changes needing owner approval become proposals (`budgetProposals.ts`).

### Desktop Path

1. `electron/main.ts` picks a budget location (`electron/connection.ts`), starts the server bundle (`electron/dist/server.js`, built by `build:server:bundle`) on port 58342, or connects to a remote server.
2. The window loads the built client from the embedded server with `CLIENT_DIST`, so pages are same-origin with the API.
3. Remote pages get no Node or preload bridge (`electron/connectionPreload.ts`).

### Demo Path

1. `client/src/demo/demoApi.ts` intercepts `fetch('/api/...')` and sends it to `client/src/demo` worker messages.
2. `server/src/browser/worker.ts` runs the same routers (`server/src/browser/app.ts` mounts them) over sql.js (`server/src/browser/db.ts`) with the rows from `server/src/demo/demoBudget.ts`.
3. Bank connections and sign-in return `NotInDemo`.

**State Management:**
- Server: SQLite is the only source of truth. Caches are per-request or in memory; check each service before assuming one.
- Client server state: React Query keys owned by the hooks in `client/src/hooks/`. Mutations invalidate the queries they affect.
- Client UI state: stores in `client/src/store/` (`appStore.ts`, `connectionStore.ts`, `undoStore.ts`, `commandPaletteStore.ts`, `preferencesStore.ts`, `safeModeStore.ts`). Preferences use `PREFERENCES_VERSION` with a migration step.

## Key Abstractions

**Shared transaction helpers:**
- Purpose: One place for the rules on reconciled rows, splits, transfers, households and payment envelopes.
- Examples: `server/src/services/transactionHelpers.ts`, `server/src/services/transactionEdits.ts`, `server/src/services/splitMath.ts`
- Pattern: Every write that touches transactions calls these; a direct `db.insert` on `transactions` bypasses them.

**Budget ledger and funding plan:**
- Purpose: Ready-to-assign, envelope balances, card funding, payment plans.
- Examples: `server/src/services/budgetLedger.ts`, `server/src/services/fundingPlan.ts`, `server/src/services/cardFunding.ts`, `server/src/services/paymentPlanService.ts`
- Pattern: Pure calculation modules (`fundingMath.ts`, `budgetEngine.test.ts` covers them) feed the services that write.

**Change sets and proposals:**
- Purpose: Undoable token-made category changes; owner-applied suggestions.
- Examples: `server/src/services/changeSets.ts`, `server/src/routes/changeSets.ts`, `server/src/services/budgetProposals.ts`
- Pattern: Each token write is a reversible set; only the owner may redo.

**Bank provider adapters:**
- Purpose: Same sync shape for each bank.
- Examples: `server/src/services/upSyncService.ts`, `plaidSyncService.ts`, `simplefinSyncService.ts`, `enableBankingSyncService.ts`
- Pattern: Stable import IDs, `deletedImportIds` respected, sync never rewrites reconciled rows.

**Rules engine:**
- Purpose: Auto-categorise and tag imported rows.
- Examples: `server/src/services/rulesEngine.ts`, `server/src/services/ruleService.ts`
- Pattern: Old rule formats are read; only the current format is written.

**Express shim (demo):**
- Purpose: Let the same router code run in a Worker.
- Examples: `server/src/browser/expressShim.ts`, tested in `server/src/browser/expressShim.test.ts`
- Pattern: Supports plain and `:param` segments, `router.param`, middleware chains, and async handlers. New Express features need a shim addition.

## Entry Points

**Server (single-user, server mode, gateway):**
- Location: `server/src/index.ts` (`startServer`), `server/src/gateway/index.ts` (gateway bundle)
- Triggers: `npm run dev --prefix server`, the Docker image (`Dockerfile`), the Home Assistant add-on (`homeassistant/start.sh`, `homeassistant/ha-launch.cjs`), the bundled `electron/dist/server.js`.
- Responsibilities: Migrations, guards, routers, timers, Up polling, optional SPA static serving when `CLIENT_DIST` is set.

**Client web:**
- Location: `client/src/main.tsx` → `client/src/App.tsx`
- Triggers: Browser load of the app. Routing is `BrowserRouter` in server mode and `HashRouter` in Electron and the demo.
- Responsibilities: Route table (lazy pages except Dashboard, Budget, Transactions), `AuthGate`, `AppShell`.

**Electron:**
- Location: `electron/main.ts`, `electron/preload.ts`, `electron/connectionPreload.ts`
- Triggers: Packaged app launch, `npm run electron:dev`.
- Responsibilities: Starts or connects the server, owns window creation, updates (`electron/updates.ts`, `electron/desktopUpdates.ts`), menus.

**Demo worker:**
- Location: `server/src/browser/worker.ts`
- Triggers: `client/src/demo/demoApi.ts` on `/demo/` builds.

**Migrations and seeds (scripts):**
- Location: `server/src/db/seed.ts`, `seed-demo.ts`, `seed-rich.ts`; `docker/backup.cjs`, `docker/reset-password.cjs`
- Triggers: `npm run db:seed-demo` and the Docker helpers.

## Architectural Constraints

- **Threading:** Single Node event loop. `better-sqlite3` is synchronous, so heavy work in a handler blocks every request. Timers (`scheduleTimer.ts`, Up polling) run on the same loop.
- **Global state:** `sqlite` and `db` singletons in `server/src/db/index.ts`; `secretCipher` in `server/src/db/secretCrypto.ts`; `setRateDownloader` in `server/src/routes/currency.ts`; session state in `server/src/auth/sessions.ts`.
- **Circular imports:** Not detected as a policy, but the demo rebuild depends on Node-only modules staying out of files the demo loads. Check `server/src/browser/` and `vite.config.ts` when adding imports.
- **Build-time swaps:** `client/vite.config.ts` (`demoServerModules`) replaces `express`, `db`, `secretCrypto`, `path` and `crypto` in demo builds. Every name a server file imports from `crypto` must exist in `server/src/browser/crypto.ts`.
- **Bind safety:** `unprotectedBindError` in `server/src/config.ts` refuses unsafe listen settings; a gateway budget must run in server mode on `127.0.0.1`.
- **Electron embedding:** The desktop server must use the loopback port and the per-launch secret cookie; remote pages have no bridge.
- **Stored identifiers:** Keep `flybudget` names (`FLYBUDGET_*` env vars, cookies, data paths, the `flybudget_up` HA slug, `flybudget-mac-window`). Renaming strands data.

## Anti-Patterns

### Writing transactions directly from a router

**What happens:** A router inserts or updates `transactions` rows itself, or a service writes without `transactionHelpers.ts`.
**Why it's wrong:** It skips the reconciled-row, split, transfer, household and payment-envelope rules.
**Do this instead:** Call the helpers in `server/src/services/transactionHelpers.ts` and `transactionEdits.ts`, inside one `db.transaction` when several rows change.

### Duplicating a parallel version of existing logic

**What happens:** A new service re-implements money formatting, CSV escaping, safe URL checks, or funding math.
**Why it's wrong:** Two copies drift; the bank sync and manual paths disagree.
**Do this instead:** Reuse `server/src/utils/money.ts`, `server/src/services/safeFetch.ts`, `server/src/services/fundingPlan.ts`, `client/src/utils/currency.ts`, `client/src/utils/dates.ts`.

### New Node-only import in shared server code

**What happens:** A server file imported by the demo pulls in `fs`, `path` or `crypto` at module load.
**Why it's wrong:** The demo build fails or throws at runtime in the Worker.
**Do this instead:** Put Node-only code in a module the demo does not load, or add a stand-in under `server/src/browser/` and register it in `client/vite.config.ts`.

## Error Handling

**Strategy:** Validate early, fail with generic JSON, log details server side.

**Patterns:**
- Zod validation of request bodies before any DB access (`server/src/utils/validation.ts`).
- `errorHandler` in `server/src/middleware/security.ts` returns generic messages; bank failures return 422/409, never 502–504 (the client reads those as "server down").
- Startup maintenance tasks are wrapped in `runStartupTask` in `server/src/index.ts`, so one failure does not stop the server.
- Client `apiFetch` maps failures to `NetworkError` or `ApiError` (`client/src/api/client.ts`).

## Cross-Cutting Concerns

**Logging:** `server/src/utils/log.ts` (server); `console` in `electron/`. Secrets are never logged.
**Validation:** Zod in routers; caps on sizes, counts and ranges.
**Authentication:** Owner session (`server/src/routes/auth.ts`), read-only tokens (`server/src/auth/accessTokens.ts`), gateway sign-in (`server/src/gateway/`).
**Time:** Injected or derived from `server/src/utils/date.ts`; tests avoid depending on today's date.
**Configuration:** `server/src/config.ts` (server), `electron/connection.ts` (desktop), `homeassistant/config.yaml` and `homeassistant/start.sh` (HA add-on).

---

*Architecture analysis: 2026-11-13*
