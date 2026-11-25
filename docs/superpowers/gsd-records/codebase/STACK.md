---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
# Technology Stack

**Analysis Date:** 2026-11-13

## Languages

**Primary:**
- TypeScript (ESM, `"type": "module"`) - server in `server/src/`, client in `client/src/`, Electron main process in `electron/*.ts`
- TypeScript 7 (`typescript: ^7.0.2`) is used by `server/`, `client/`, `e2e/` and the root; `lint/` pins TypeScript `~6.0.3` because typescript-eslint needs the JavaScript API (`lint/package.json`)

**Secondary:**
- SQL - SQLite migrations in `server/src/db/migrations/` (90 files), generated against `server/src/db/schema.ts`
- CommonJS JavaScript - Electron build output and tests: `electron/connection.test.cjs`, `electron/macWindow.test.cjs`, `electron/remote-smoke.cjs`, `homeassistant/ha-launch.cjs`, `homeassistant/smoke-test.cjs`
- Python 3 - release tooling `scripts/prepare-release.py` (`npm run release:prepare`), Home Assistant packaging `homeassistant/package.py`, `homeassistant/repair-permissions.py`, and unit tests under `scripts/`
- Shell - `homeassistant/start.sh`
- CSS via Tailwind (utility classes in `client/src/`)

## Runtime

**Environment:**
- Node.js 24 - CI (`.github/workflows/ci.yml`, `node-version: 24`), Docker base image `node:24-bookworm-slim` (`Dockerfile`). No `.nvmrc` or `.node-version` file exists.
- Electron `^44.7.0` for the desktop app (root `package.json` devDependencies)
- Browser demo: the server code also runs in-browser via `server/src/browser/` (worker, `db.ts`, `expressShim.ts`) with its own tsconfig (`server/src/browser/tsconfig.json`)

**Package Manager:**
- npm (CI uses npm 11 with `npm ci`)
- Lockfiles: present for root (`package-lock.json`), `server/package-lock.json`, `client/package-lock.json`
- `e2e/` has its own `package.json`; it has no lockfile listed in the root tree check, so verify before adding one
- `.npmrc` at repo root and in `server/` and `client/`: `ignore-scripts=true` (blocks dependency install scripts; do not disable). `ELECTRON_SKIP_BINARY_DOWNLOAD=1` is set in CI.
- CI runs `npm audit signatures` on server and client before builds.

## Frameworks

**Core (server):**
- Express `^5.3.0` - HTTP API; routers in `server/src/routes/` mounted from `server/src/index.ts`
- Drizzle ORM `^0.45.4` with `drizzle-orm/better-sqlite3` - data access (`server/src/db/index.ts`, `server/src/db/schema.ts`)
- drizzle-kit `^0.31.11` - migrations (`server/drizzle.config.ts`: schema `./src/db/schema.ts`, out `./src/db/migrations`, dialect sqlite)
- Zod `^4.6.7` - request and config validation
- helmet `^8.3.0`, cors `^2.8.6`, express-rate-limit `^8.7.1` - HTTP hardening and rate limits (`server/src/middleware/security.ts`)
- ipaddr.js `^2.5.0` - address checks for host/SSRF protection (`server/src/services/safeFetch.ts`)
- nanoid `^6.0.2`, date-fns `^4.4.0`
- undici `^8.12.3` - outbound HTTP client
- nodemailer `^10.3.1` - SMTP mail for the multi-user gateway (`server/src/gateway/mail.ts`)
- plaid `^47.0.0` - Plaid SDK (`server/src/services/plaidService.ts`)

**Core (client):**
- React `^19.3.0` and React DOM `^19.3.0`
- Vite `^8.3.4` with `@vitejs/plugin-react ^6.1.2` (`client/vite.config.ts`); build is `tsc -b && vite build`; Electron build uses `--mode electron`
- react-router-dom `^7.18.4` - routing (pages `lazy()`-loaded in `client/src/App.tsx`)
- @tanstack/react-query `^5.104.2` - server state
- zustand `^5.0.15` - client state
- react-aria-components `^1.22.1` - accessible UI primitives
- @dnd-kit/core `^6.3.1`, @dnd-kit/sortable `^10.0.0`, @dnd-kit/utilities `^3.2.2` - drag and drop
- react-grid-layout `^2.3.0` - dashboard layout
- @tanstack/charts `^1.5.0` and d3-shape `^3.2.0` - charts
- pdfjs-dist `6.4.299` (pinned exact) - PDF rendering
- lucide-react `^1.55.0` - icons
- @fontsource/inter `^5.3.0` - bundled font
- @internationalized/date `^3.12.4`, date-fns `^4.4.0` - dates
- Tailwind CSS `^4.0.0` with `@tailwindcss/vite ^4.3.3`

**Desktop:**
- Electron `^44.7.0` - `electron/main.ts`, `electron/connection.ts`, `electron/connectionPage.ts`, `electron/preload.ts`, `electron/connectionPreload.ts`, `electron/macWindow.ts`, `electron/updates.ts`, `electron/desktopUpdates.ts`
- electron-updater `6.8.9` (root `dependencies`)
- electron-builder `^26.15.3` - packaging (`electron-builder.json`, `electron-builder.release.cjs`)
- esbuild `^0.28.2` - bundles the server for Electron (`build:server:bundle` script, target node22) and for Docker (target node24)
- Compiled with `tsc -p electron/tsconfig.json`

**Testing:**
- Vitest `^5.0.4` - server (`server/vitest.config.ts`) and client unit tests; run with `npm test --prefix server` / `npm test --prefix client`
- fast-check `^4.10.2` - property-based tests (server and client)
- sql.js `^1.14.2` and `@types/sql.js` - test-side SQLite (server devDependencies)
- Playwright `1.64.0` (`@playwright/test`) - browser integration tests in `e2e/` (config in `e2e/`)
- Node built-in test runner - `node --test` for `electron/*.test.cjs` and `homeassistant/ha-launch.test.cjs`
- ESLint `^9.39.5` with typescript-eslint `^8.72.1`, eslint-plugin-react-hooks `^7.1.1`, eslint-plugin-jsx-a11y `^6.10.2` - in `lint/` (config `lint/eslint.config.js`, `--max-warnings=128`)

**Build/Dev:**
- concurrently `^10.0.6`, cross-env `^10.1.0`, wait-on `^9.5.1` - dev orchestration (`npm run dev`, `npm run electron:dev` in root `package.json`)
- tsx `^4.23.15` - runs TypeScript directly (`npm run dev --prefix server` uses `tsx watch src/index.ts`; seeds via `tsx`)
- Prettier `^3.9.10` - formatting (`.prettierrc`, `npm run format:check`)
- Docker multi-stage build (`Dockerfile`), image published to GHCR via `.github/workflows/docker.yml` (linux/amd64 and linux/arm64); `docker-compose.yml` runs it read-only with a data volume

## Key Dependencies

**Critical:**
- `better-sqlite3` `^13.0.3` (server) - the only database driver; native module, copied into the Docker image and Electron build. Overridable via `DB_NATIVE_BINDING` (`server/src/db/index.ts` and related).
- `drizzle-orm` `^0.45.4` - ORM over SQLite
- `express` `^5.3.0` - HTTP server
- `plaid` `^47.0.0` - Plaid bank-link SDK
- `zod` `^4.6.7` - schema validation; PUT schemas must not be `createSchema.partial()` when defaults exist (see `CLAUDE.md`)
- `electron` `^44.7.0` and `electron-updater` `6.8.9` - desktop shell and in-app updates (`docs/DESKTOP-UPDATES.md`)
- `react` `^19.3.0`, `vite` `^8.3.4` - UI and build

**Infrastructure:**
- `esbuild` (root) - single-file bundles: `electron/dist/server.js`, Docker `dist/` bundles for `server/src/index.ts` and `server/src/gateway/index.ts`
- `undici` `^8.12.3` - outbound fetch
- `nodemailer` `^10.3.1` - password codes by SMTP (gateway only)
- `helmet`, `cors`, `express-rate-limit`, `ipaddr.js` - security middleware and address checks

## Configuration

**Environment:**
- Runtime config is read from `process.env` in `server/src/config.ts`, `server/src/index.ts`, `server/src/db/secretCrypto.ts`, service modules, and Electron files. Main names (values not recorded here):
  - Paths and modes: `DB_PATH`, `CLIENT_DIST`, `MIGRATIONS_PATH`, `FLYBUDGET_FILES_DIR`, `FLYBUDGET_BUDGETS_DIR`, `FLYBUDGET_SERVER_MODE`, `FLYBUDGET_HOST_KIND`, `FLYBUDGET_HOST`, `PORT`, `EXPRESS_PORT`, `FLYBUDGET_BUDGET_PORT`
  - Security: `FLYBUDGET_ALLOWED_HOSTS`, `FLYBUDGET_TRUST_PROXY`, `FLYBUDGET_OUTER_TRUST_PROXY`, `FLYBUDGET_DATA_KEY`, `FLYBUDGET_DATA_KEY_FILE`, `FLYBUDGET_API_TOKEN`, `FLYBUDGET_GATEWAY_SECRET`
  - Integrations: `FLYBUDGET_UP_API` (Up API base override), `FLYBUDGET_ENABLE_BANKING_API`, `FLYBUDGET_EXCHANGE_RATES_URL`, `SUPERVISOR_TOKEN` (Home Assistant)
  - Gateway: `FLYBUDGET_GATEWAY_DB`, `FLYBUDGET_GATEWAY_AUTOSTART`, `FLYBUDGET_NOTIFY_PORT`, `FLYBUDGET_DEV_MAIL_PORT`, `FLYBUDGET_PERSON_ID`
  - Defaults: `FLYBUDGET_CATEGORY_TEMPLATE`, `FLYBUDGET_VERSION`, `TZ`
  - Desktop: `ELECTRON_DEV`, `ELECTRON_PROD`, `FLYBUDGET_SERVER_SCRIPT`, `FLYBUDGET_SERVER_NODE_ARGS`, `FLYBUDGET_MAC_SIGNING`, `CSC_LINK` (code signing; never record its value)
- No `.env` loading library is listed in server dependencies; configuration comes from the process environment (set by `docker-compose.yml`, Home Assistant `options`, or the Electron launcher).
- Data encryption key: `FLYBUDGET_DATA_KEY` or the file named by `FLYBUDGET_DATA_KEY_FILE`, used by `server/src/db/secretCrypto.ts` and `server/src/services/credentialEncryption.ts`.
- Home Assistant options are declared in `homeassistant/config.yaml` (`allowed_hosts`, `trust_proxy`, `multi_user`); the launcher reads `/data/options.json` (`homeassistant/ha-launch.cjs`). Details in `homeassistant/README.md` and `homeassistant/DOCS.md`.
- Docker: `docker-compose.yml` (read-only root, `no-new-privileges`, all caps dropped, data volume at `/data`, port 3001)

**Build:**
- Root: `package.json` scripts (`dev`, `electron:dev`, `electron:build`, `build:server:bundle`, `compile:electron`, `release:prepare`, `format`)
- Server: `server/tsconfig.json`, `server/src/browser/tsconfig.json`, `server/vitest.config.ts`, `server/drizzle.config.ts`
- Client: `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`
- Electron: `electron/tsconfig.json`, `electron-builder.json`, `electron-builder.release.cjs`
- Lint: `lint/eslint.config.js`
- Formatting: `.prettierrc`, `.prettierignore`
- Containers: `Dockerfile`, `.dockerignore`, `docker-compose.yml`

## Platform Requirements

**Development:**
- Node.js 24 and npm 11 (matching CI)
- Native build tooling for `better-sqlite3` (prebuilt binaries are typical; `ignore-scripts=true` means install scripts do not run, so native binding setup must be handled explicitly, see `Dockerfile` build stage)
- Optional: Chromium for Playwright (`E2E_CHROMIUM_PATH`), Docker for container smoke tests (`homeassistant/smoke-test.cjs`)

**Production:**
- Docker image `ghcr.io/tvrooi/flybudget` (linux/amd64, linux/arm64), port 3001, non-root uid 1000 (see `Dockerfile`, `docker-compose.yml`)
- Home Assistant app `flybudget_up` (slug in `homeassistant/config.yaml`), architectures `aarch64` and `amd64`
- Desktop installers for macOS and others built by `.github/workflows/release.yml` via electron-builder; Developer ID signing optional (`docs/DESKTOP-UPDATES.md`)
- Single SQLite database file in the data directory; back it up (see `MAINTENANCE.md`)

---

*Stack analysis: 2026-11-13*
