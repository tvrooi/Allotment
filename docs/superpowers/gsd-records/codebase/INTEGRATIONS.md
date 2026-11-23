---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
# External Integrations

**Analysis Date:** 2026-11-13

## APIs & External Services

**Bank data (Australia):**
- Up Bank public API - primary AU bank source; settled AUD imports, round-up transfers, sync
  - Base URL constant: `server/src/services/upService.ts` (`https://api.up.com.au/api/v1/`); overridable with `FLYBUDGET_UP_API`
  - Routes: `server/src/routes/up.ts`; sync: `server/src/services/upSyncService.ts`; transaction mapping: `server/src/services/upTransactions.ts`; category mapping: `server/src/services/upCategoryMap.ts`
  - Client: `client/src/components/up/`, `client/src/hooks/useUp.ts`, `client/src/api/up.ts`
  - Auth: personal access token entered by the owner, stored encrypted (`server/src/services/credentialEncryption.ts`); excluded from exports
- SimpleFIN Bridge - bank aggregation via token setup
  - Service: `server/src/services/simplefinService.ts`, sync `server/src/services/simplefinSyncService.ts`, route `server/src/routes/simplefin.ts`
  - Client setup link points to the SimpleFIN beta bridge (`client/src/components/simplefin/SimplefinConnectModal.tsx`, `SimplefinConfigForm.tsx`)
  - Auth: setup token exchanged for an access URL; stored encrypted
- Plaid - bank link (Hosted Link supported)
  - SDK: `plaid` package; service `server/src/services/plaidService.ts`, Hosted Link `server/src/services/plaidHostedLink.ts`, sync `server/src/services/plaidSyncService.ts`, route `server/src/routes/plaid.ts` mounted at `/api/plaid` in `server/src/index.ts`
  - Client: `client/src/components/plaid/` (`PlaidConfigForm.tsx`, `PlaidSetupModal.tsx`)
  - Auth: Plaid client credentials and access tokens, supplied by the owner and stored encrypted (never in the repo). Plaid is configured only when `isPlaidConfigured()` returns true.
- Enable Banking - European open banking (PSD2)
  - Base URL: `https://api.enablebanking.com` in `server/src/services/enableBankingService.ts`; overridable with `FLYBUDGET_ENABLE_BANKING_API`
  - Services: `enableBankingAuth.ts`, `enableBankingService.ts`, `enableBankingSyncService.ts`, `enableBankingTransactions.ts`; route `server/src/routes/enableBanking.ts`
  - Auth: application ID and RSA-signed JWT (`iss`/`aud` claims in `enableBankingService.ts`); the signing key is owner-provided and stored encrypted
  - Client: `client/src/components/enablebanking/EnableBankingSetupForm.tsx` links to the Enable Banking control panel

**Exchange rates:**
- Frankfurter (`https://api.frankfurter.dev/v1`) - default FX rates, `DEFAULT_RATES_URL` in `server/src/services/rateFetchService.ts`
  - Override with `FLYBUDGET_EXCHANGE_RATES_URL` (operator-chosen source)
  - No API key

**Receipt reading (optional, owner-enabled):**
- Ollama - local or LAN model server, `/api/chat` and `/api/tags` (`server/src/services/receiptReader.ts`); URL is set by the owner
- Anthropic Messages API - `https://api.anthropic.com/v1/messages` (`receiptReader.ts`), owner's own API key
- OpenAI Chat Completions - `https://api.openai.com/v1/chat/completions` (`receiptReader.ts`), owner's own API key
- Off by default; the photo is sent only to the provider the owner selects. Keys are stored in `receiptReaderSecrets` table (`server/src/db/schema.ts`) and encrypted via `server/src/db/secretCrypto.ts`.

**Outbound request safety:**
- All outbound fetches to user-supplied URLs go through `server/src/services/safeFetch.ts` (address checks with `ipaddr.js`); do not add raw `fetch` for user-configured hosts.

**Assistant / MCP:**
- MCP endpoint served from `server/src/routes/mcp.ts`; read-only access tokens in `server/src/auth/accessTokens.ts`; write policy in `server/src/auth/assistantPolicy.ts` (see `docs/ASSISTANT-ENDPOINTS.md`). This is an inbound integration; the server does not call an LLM for it.

**Project links shown in UI (not runtime calls):**
- Allotment repository and releases (`https://github.com/tvrooi/Allotment`), `client/src/` help text and the user guide (`client/src/userGuide/articles.tsx`)

## Data Storage

**Databases:**
- SQLite, single file per budget
  - Connection: `DB_PATH` env var; opened in `server/src/db/index.ts` via `better-sqlite3`
  - ORM: Drizzle (`server/src/db/schema.ts`); migrations `server/src/db/migrations/` applied at startup
  - Multi-user gateway keeps its own database `people.db` (or `FLYBUDGET_GATEWAY_DB`), see `server/src/gateway/store.ts`
  - Per-budget databases are created under `FLYBUDGET_BUDGETS_DIR` for the gateway (`server/src/gateway/budgets.ts`)
  - Browser demo: sql.js-style in-browser SQLite via `server/src/browser/db.ts` and `server/src/browser/worker.ts`
- Encryption of secrets: `server/src/db/secretCrypto.ts` (data key from `FLYBUDGET_DATA_KEY` or `FLYBUDGET_DATA_KEY_FILE`)

**File Storage:**
- Local filesystem only: documents, receipts and links stored by `server/src/services/fileStore.ts` and `documentService.ts` under `FLYBUDGET_FILES_DIR`
- Backups: `server/src/services/backupService.ts`, `backupArchive.ts`; export in `server/src/routes/export.ts`; secrets and file bytes are excluded from export per `CLAUDE.md`

**Caching:**
- None detected (no Redis or memcached). In-memory caching only within modules.

## Authentication & Identity

**Auth Provider:**
- Custom, local
  - Password hashing: `server/src/auth/password.ts`
  - Sessions: `server/src/auth/sessions.ts`, cookies (names under the `flybudget` prefix)
  - Setup and reset codes: `server/src/auth/setupCode.ts`, `server/src/auth/resetCode.ts`, delivered by `server/src/auth/resetNotify.ts`
  - Host and origin checks: `server/src/auth/hostKind.ts`, `server/src/middleware/security.ts`; allowlist via `FLYBUDGET_ALLOWED_HOSTS`
  - Access tokens for read-only and assistant use: `server/src/auth/accessTokens.ts`, `server/src/auth/assistantPolicy.ts`
- Multi-user gateway: shared secret `FLYBUDGET_GATEWAY_SECRET` (`server/src/config.ts`) and per-person budgets (`server/src/gateway/`)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry or similar SDK)

**Logs:**
- `console` logging from the server; the Docker image has no external log shipper configured
- Assistant actions logged in `server/src/services/assistantLog.ts`
- Home Assistant logs via the Supervisor when run as an HA app

## Email

**SMTP (gateway only):**
- nodemailer in `server/src/gateway/mail.ts`; TLS required and verified
- Used to send password codes in multi-user mode when `smtp` settings are passed by the launcher (`server/src/gateway/index.ts`)
- Local development mail port via `FLYBUDGET_DEV_MAIL_PORT`
- Alternative delivery path: Home Assistant notify services (`homeassistant_api: true` in `homeassistant/config.yaml`; `server/src/gateway/notify.ts`, `delivery.ts`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker container (`docker-compose.yml`), image `ghcr.io/tvrooi/flybudget`
- Home Assistant app `flybudget_up` (`homeassistant/config.yaml`), install catalog in a separate repository (not in this repo)
- Desktop app via electron-builder; release feed on GitHub Releases (`electron-builder.json` `publish`, `electron/updates.ts`, `electron/releaseCheck.ts`, `electron/desktopUpdates.ts`)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`):
  - `ci.yml` - server and client type checks, `npm audit signatures`, unit tests, build, lint, e2e
  - `docker.yml` - buildx multi-arch image, Anchore scan (`anchore/scan-action`), CodeQL SARIF upload, build provenance attestation
  - `release.yml` - desktop and HA image releases on tags
  - `auto-release.yml` - publishes tested main
  - `scorecard.yml` - OpenSSF Scorecard
- All actions pinned to commit SHAs
- Container registry: GitHub Container Registry (GHCR)

## Environment Configuration

**Required env vars (names only; set by the deployment, not stored in repo):**
- `FLYBUDGET_ALLOWED_HOSTS` - recommended in production (`docker-compose.yml` comments)
- `FLYBUDGET_TRUST_PROXY` - set when behind a reverse proxy
- `FLYBUDGET_DATA_KEY` or `FLYBUDGET_DATA_KEY_FILE` - encryption key for stored credentials; back up with the database
- `SUPERVISOR_TOKEN` - injected by Home Assistant Supervisor when running as an app (`homeassistant/ha-launch.cjs`)

**Secrets location:**
- Bank and provider tokens: encrypted in the budget SQLite database (`server/src/services/credentialEncryption.ts`); data key from the file named by `FLYBUDGET_DATA_KEY_FILE` or the env var
- Home Assistant options: `/data/options.json`, root-only (`homeassistant/ha-launch.cjs`, `homeassistant/repair-permissions.py`)
- Code-signing material for desktop builds: CI secrets (`CSC_LINK` and related), never committed
- `.env` files are not used by the project; do not create one in the repository

## Webhooks & Callbacks

**Incoming:**
- Plaid Hosted Link return and bank callback handling: `server/src/routes/plaid.ts`, `server/src/routes/enableBanking.ts` (Enable Banking redirect to the app's `bank-callback` page; the callback URL in client docs points to the public project domain)
- No webhooks from Up; sync is pull-based at startup, manual Sync Now, and opt-in polling with backoff (`server/src/services/upSyncService.ts`)
- MCP endpoint `server/src/routes/mcp.ts` (inbound requests from assistant clients)

**Outgoing:**
- None. Outbound calls are pulls or sends initiated by the owner's actions: Up, Plaid, SimpleFIN, Enable Banking, FX rates, optional receipt model providers, and optional SMTP/HA notifications.

---

*Integration audit: 2026-11-13*
