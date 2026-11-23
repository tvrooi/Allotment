---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
# Codebase Structure

**Analysis Date:** 2026-11-13

## Directory Layout

```
Allotment/
├── client/                 # React + Vite web app (also the Electron and demo UI)
│   ├── src/                # App code: pages, components, hooks, api, store, utils
│   ├── public/             # Static assets served as-is
│   ├── scripts/            # generate-demo-logos.mjs
│   └── .impeccable/        # Design-tool notes for the client
├── server/                 # Express + SQLite API and services
│   └── src/                # routes, services, db, auth, gateway, browser (demo), demo, utils
├── electron/               # Desktop shell (main process, connection page, updates)
│   └── resources/          # Desktop icons and packaged resources
├── e2e/                    # Playwright browser tests and fixtures
│   ├── tests/              # *.spec.ts UI flows
│   └── fixtures/           # Mock bank data and seed inputs
├── homeassistant/          # Home Assistant add-on wrapper (launcher, smoke test, packaging)
├── docker/                 # backup.cjs, reset-password.cjs (container helpers)
├── lint/                   # Custom lint rules, term and token lists (lint/README.md)
├── scripts/                # Release tooling (prepare-release.py, auto-release.py, catalog export)
├── docs/                   # Design, plans, handover archive, UI map, agent docs
│   ├── ui/                 # UI handover, screen map, waves
│   ├── handover/           # ARCHIVE.md (history, grep only)
│   ├── agents/             # Issue tracker and triage conventions
│   ├── research/ investigations/ critiques/ ux-ui-evidence/
├── .github/                # CI, release and promotion workflows
├── .agents/ .claude/       # Agent skills and settings (identical AGENTS.md/CLAUDE.md pair at root)
├── .impeccable/            # Repo-level design notes
├── skills/                 # Local skill definitions (system and workflow helpers)
├── docs/superpowers/gsd-records/codebase/     # Generated codebase maps (this document lives here)
├── package.json            # Root scripts: dev, electron:*, build:server:bundle, release:prepare
├── Dockerfile              # Self-hosted server image
├── docker-compose.yml
└── electron-builder*.json* # Desktop packaging config
```

## Directory Purposes

**`server/src/routes/`:**
- Purpose: One Express router per domain, mounted in `server/src/index.ts`.
- Contains: `<domain>.ts` routers and `<domain>.test.ts` tests (about 112 files).
- Key files: `transactions.ts`, `budget.ts`, `rules.ts`, `up.ts`, `households.ts`, `assistant.ts`, `accessTokens.ts`, `mcp.ts`, `files.ts`, `backupArchive.ts`.

**`server/src/services/`:**
- Purpose: Business logic and bank sync.
- Contains: `<area>.ts` services, pure math modules (`splitMath.ts`, `fundingMath.ts`, `investmentMath.ts`), and tests (about 181 files).
- Key files: `transactionHelpers.ts`, `budgetService.ts`, `rulesEngine.ts`, `transferMatching.ts`, `upSyncService.ts`, `upService.ts`, `householdService.ts`, `documentService.ts`, `fileStore.ts`, `safeFetch.ts`, `backupService.ts`.

**`server/src/db/`:**
- Purpose: SQLite connection, schema, migrations, encryption of stored secrets, seeds.
- Contains: `index.ts`, `schema.ts`, `secretCrypto.ts`, `defaultCategories.ts`, `seed*.ts`, `migrations/` (numbered `NNNN_name.sql`, `meta/` journal), and tests.
- Key files: `migrations/_journal.json` (`meta/`), `schema.ts`.

**`server/src/auth/`:**
- Purpose: Owner sessions, password, setup code, read-only access tokens and assistant policy.
- Key files: `sessions.ts`, `password.ts`, `accessTokens.ts`, `assistantPolicy.ts`, `hostKind.ts`.

**`server/src/middleware/`:**
- Purpose: Transport guards and error handling.
- Key files: `security.ts`.

**`server/src/gateway/`:**
- Purpose: Multi-user gateway (one loopback server per person), mail, reminders delivery, sharing.
- Key files: `index.ts` (entry, bundled as `gateway.js`), `app.ts`, `budgets.ts`, `store.ts`, `mail.ts`, `notify.ts`.

**`server/src/browser/`:**
- Purpose: In-browser demo server (Worker). Holds Node-only stand-ins.
- Key files: `app.ts`, `worker.ts`, `db.ts`, `expressShim.ts`, `crypto.ts`, `path.ts`, `secretCrypto.ts`, `README.md`, and its own `tsconfig.json` (excluded from the server's type check).

**`server/src/demo/`:**
- Purpose: Demo budget data (pure) and its loader.
- Key files: `demoBudget.ts`, `loadDemoBudget.ts`, `logos.ts`.

**`server/src/utils/`:**
- Purpose: Shared pure helpers: money, dates, recurrence, validation, currencies, zip, logos, logging.
- Key files: `money.ts`, `date.ts`, `validation.ts`, `currencies.ts`, `accountTypes.ts`, `recurrence.ts`, `log.ts`.

**`server/src/test/`:**
- Purpose: Mock Up data for tests.
- Key files: `upMock.ts`, `upRichData.ts`.

**`client/src/pages/`:**
- Purpose: Route targets. Each page is a lazy chunk except Dashboard, Budget and Transactions.
- Key files: `Dashboard.tsx`, `Budget.tsx`, `Transactions.tsx`, `Accounts.tsx`, `Reports.tsx`, `Settings.tsx`, `Review.tsx`, `Files.tsx`, `Household.tsx`.

**`client/src/components/`:**
- Purpose: UI grouped by domain: `accounts`, `auth`, `banks`, `budget`, `charts`, `connection`, `currency`, `dashboard`, `demo`, `enablebanking`, `files`, `forecast`, `goals`, `guide`, `household`, `investments`, `layout`, `longterm`, `payees`, `plaid`, `plans`, `receipts`, `recurring`, `reports`, `review`, `rules`, `settings`, `simplefin`, `tax`, `transactions`, `ui` (shared primitives), `up`.
- Key files: `layout/AppShell.tsx`, `layout/Sidebar.tsx`, `layout/CommandPalette.tsx`, `layout/navPages.ts`, `up/UpSettings.tsx`, `up/UpReview.tsx`, `up/UpConnectModal.tsx`.

**`client/src/api/`:**
- Purpose: Typed fetch wrappers, one module per server domain.
- Key files: `client.ts` (`apiFetch`, `NetworkError`, `ApiError`), `base.ts` (`API_BASE`), `person.ts`, `up.ts`, `transactions.ts`, `budget.ts`.

**`client/src/hooks/`:**
- Purpose: React Query hooks wrapping the api layer, plus keyboard and viewport helpers.
- Key files: `useTransactions.ts`, `useBudget.ts`, `useUp.ts`, `useCategories.ts`, `useConnection.ts`, `useOffline.ts`, `useAddTransactionKeyboard.ts`.

**`client/src/store/`:**
- Purpose: UI state stores (non-server).
- Key files: `appStore.ts`, `connectionStore.ts`, `undoStore.ts`, `preferencesStore.ts`, `commandPaletteStore.ts`, `safeModeStore.ts`.

**`client/src/utils/`:**
- Purpose: Pure client helpers with co-located `*.test.ts`.
- Key files: `currency.ts` (minor-unit conversion at the UI boundary), `dates.ts`, `connection.ts`, `commandPalette.ts`, `accountTypes.ts`.

**`client/src/demo/`:**
- Purpose: Demo fetch interception and worker bootstrap.
- Key files: `demoApi.ts`.

**`client/src/offline/`:**
- Purpose: Offline copy and waiting transactions (off in the demo).

**`client/src/guides/`, `client/src/userGuide/`:**
- Purpose: In-app help content.

**`electron/`:**
- Purpose: Desktop shell. CommonJS (`electron/package.json`).
- Key files: `main.ts`, `connection.ts`, `connectionPage.ts`, `connectionPreload.ts`, `preload.ts`, `macWindow.ts`, `updates.ts`, `desktopUpdates.ts`, `releaseCheck.ts`, and tests `*.test.cjs`, `remote-smoke.cjs`.

**`e2e/`:**
- Purpose: Playwright tests against a built app and mock bank servers.
- Key files: `playwright.config.ts`, `global-setup.ts`, `mockUp.ts`, `mockEnableBanking.ts`, `mockFrankfurter.ts`, `mailCatcher.ts`, `ports.ts`, `tests/*.spec.ts` (for example `up.spec.ts`, `accessibility.spec.ts`).

**`homeassistant/`:**
- Purpose: Add-on wrapper.
- Key files: `config.yaml`, `start.sh`, `ha-launch.cjs` (with `ha-launch.test.cjs`), `package.py`, `smoke-test.cjs`, `repair-permissions.py`, `DOCS.md`.

**`lint/`:**
- Purpose: Custom lint for terms, tokens and rules (`lint/README.md`).
- Key directories: `lint/rules/`, `lint/terms/`, `lint/tokens/`.

**`scripts/`:**
- Purpose: Release automation and HA catalog export. Python tests `test_release.py`, `test_auto_release.py`.

**`docs/`:**
- Purpose: Design and planning docs. Read on demand.
- Key files: `ASSISTANT-ENDPOINTS.md`, `READ-ONLY-ACCESS.md`, `FILES.md`, `DEVELOPMENT.md`, `DESKTOP-UPDATES.md`, `MULTI-USER-PLAN.md`, `ui/MAP.md`, `ui/HANDOVER-UI.md`, `handover/ARCHIVE.md`.

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: server bootstrap and router mounting
- `server/src/gateway/index.ts`: multi-user gateway
- `server/src/browser/worker.ts`: demo worker
- `client/src/main.tsx`: web client bootstrap
- `client/src/App.tsx`: route table
- `electron/main.ts`: desktop app

**Configuration:**
- `server/src/config.ts`: server env (mode, host, proxy, keys)
- `client/vite.config.ts`: build modes, demo aliases
- `server/drizzle.config.ts`: Drizzle migration settings
- `electron-builder.json`, `electron-builder.release.cjs`: desktop packaging
- `homeassistant/config.yaml`: add-on manifest (version kept in sync by `release:prepare`)
- `.npmrc`: install scripts disabled; do not weaken
- `package.json` (root), `server/package.json`, `client/package.json`, `electron/package.json`

**Core Logic:**
- `server/src/services/transactionHelpers.ts`: transaction write rules
- `server/src/services/budgetService.ts`: budget calculations
- `server/src/services/upSyncService.ts`: Up sync
- `server/src/services/transferMatching.ts`: transfer suggestions
- `server/src/services/householdService.ts`: households

**Testing:**
- Server unit tests: beside source, `*.test.ts`, Vitest (`server/vitest.config.ts`)
- Client unit tests: beside source, `*.test.ts`
- Browser tests: `e2e/tests/`
- Electron tests: `electron/*.test.cjs`
- HA tests: `homeassistant/ha-launch.test.cjs`
- Release tests: `scripts/test_*.py`
- Lint: `lint/`

## Naming Conventions

**Files:**
- Server modules: camelCase, one concept each: `upSyncService.ts`, `transferMatching.ts`, `householdLedger.ts`
- Routers: plural or domain noun in camelCase: `accessTokens.ts`, `budgetProposals.ts`, `enableBanking.ts`
- Tests: same base name plus `.test.ts` (`up.test.ts`, `rules.test.ts`); Electron and HA tests use `.test.cjs`
- Migrations: `NNNN_snake_name.sql` (for example `0088_household_include_bills.sql`), sequential, never edited once shipped
- React pages: PascalCase, route noun (`Budget.tsx`, `CashFlow.tsx`)
- React components: PascalCase in domain folders (`client/src/components/up/UpSettings.tsx`)
- Hooks: `use<Domain>.ts` (`useUp.ts`, `useTransactions.ts`)
- Client api: lowercase domain names (`up.ts`, `accessTokens.ts`)
- Playwright specs: kebab-case (`accounts-access.spec.ts`) or domain (`up.spec.ts`)

**Directories:**
- Lowercase, single word or camelCase (`enablebanking`, `longterm` in `client/src/components/`); server directories are lowercase.

**Identifiers to keep (do not rename):** `FLYBUDGET_*` env vars, `flybudget` cookies and headers, data paths, the `flybudget_up` HA slug, the `flybudget-mac-window` marker. Display text says Allotment.

## Where to Add New Code

**New API domain (server):**
- Router: `server/src/routes/<domain>.ts`, with a `<domain>.test.ts`
- Mount: `server/src/index.ts` and `server/src/browser/app.ts` (the demo must mount it too)
- Logic: `server/src/services/<domain>Service.ts`
- Schema: `server/src/db/schema.ts` plus `server/src/db/migrations/NNNN_name.sql` and a `_journal.json` entry with the next `idx`
- Backup: add the table to `BACKUP_TABLES` in `server/src/services/backupService.ts`
- If it needs Node-only modules, check `server/src/browser/` stand-ins and `client/vite.config.ts`

**New bank or import source:**
- Sync: `server/src/services/<bank>SyncService.ts`, plus a provider service and router under `server/src/routes/`
- Rate limit: add to the `bankRateLimit` mount in `server/src/index.ts`
- Client: `client/src/components/<bank>/`, `client/src/hooks/use<Bank>.ts`, `client/src/api/<bank>.ts`

**New screen (client):**
- Page: `client/src/pages/<Name>.tsx`, lazy-loaded in `client/src/App.tsx` with `lazy()` and wrapped in `page(...)`
- Components: `client/src/components/<domain>/`
- Nav entry: `client/src/components/layout/navPages.ts`
- Data: `client/src/api/<domain>.ts` plus `client/src/hooks/use<Domain>.ts`
- UI rules: `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md`, and the screen row in `docs/ui/MAP.md`
- Shared primitives: `client/src/components/ui/`

**New shared helper:**
- Server: `server/src/utils/` (pure) or `server/src/services/` (stateful)
- Client: `client/src/utils/` with a `*.test.ts`

**New end-to-end test:**
- `e2e/tests/<feature>.spec.ts`; mocks in `e2e/mockUp.ts` style files

**New desktop behaviour:**
- `electron/main.ts` or a module beside it, with a `*.test.cjs`

**Demo coverage:**
- Demo budget rows: `server/src/demo/demoBudget.ts`

## Special Directories

**`server/src/db/migrations/`:**
- Purpose: SQL migrations applied at startup, plus the `meta/` journal.
- Generated: Partly (drizzle-kit writes SQL and the journal; hand-edit only the additive statements)
- Committed: Yes. A shipped migration is never edited.

**`client/dist/`, `server/dist/`, `electron/dist/`:**
- Purpose: Build output (`electron/dist/server.js` is the bundled server).
- Generated: Yes
- Committed: No

**`budget.db` (repository root or `DB_PATH`):**
- Purpose: Live database. Never committed, never copied into the checkout.
- Generated: Yes
- Committed: No

**`docs/superpowers/gsd-records/`:**
- Purpose: Planning and codebase maps for GSD workflows.
- Generated: Yes
- Committed: Only as the workflow requires

**`skills/`:**
- Purpose: Local skill definitions. Untracked in the current working tree.
- Generated: No
- Committed: Not decided

---

*Structure analysis: 2026-11-13*
