# Allotment — working guide

This repository is `tvrooi/Allotment` (Allotment, formerly the FlyBudget Up fork), an AGPL-3.0-only
fork of `dtymoszenko/FlyBudget`, detached from its fork network. Brand: [docs/BRAND.md](docs/BRAND.md).
Read only the files relevant to the request. Do not read the entire repository or long conversation history.
Detailed upstream architecture: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), on demand.
Release process and known limitations: [MAINTENANCE.md](MAINTENANCE.md).
Current state, live setup and where to pick up: [HANDOVER.md](HANDOVER.md). Update it as work lands.
Keep AGENTS.md and CLAUDE.md byte-identical (Codex reads one, Claude Code the other).

## Where to work

- React UI: `client/src/`; Express + SQLite: `server/src/`.
- Up API: `server/src/services/upService.ts`, `upSyncService.ts`, `upTransactions.ts`, `routes/up.ts`.
- Up UI: `client/src/components/up/`, `hooks/useUp.ts`, `api/up.ts`.
- Files (documents, links, receipts as documents): `server/src/services/documentService.ts`,
  `fileStore.ts`, `routes/files.ts`; `client/src/components/files/`. Design: [docs/FILES.md](docs/FILES.md).
- Desktop remote connection: `electron/connection.ts`, `connectionPage.ts`, `main.ts`.
- HA wrapper: `homeassistant/`; image builds and desktop releases: `.github/workflows/release.yml`.
- HA install catalog: separate `tvrooi/home-assistant-apps` repo. Never duplicate app source there.

## Verification — use the smallest relevant checks

- Server logic: `npm test --prefix server -- <affected-test>`; `cd server && npx tsc --noEmit`.
- Client: `npm test --prefix client`; `npm run build --prefix client`.
- Desktop: `npm run compile:electron`; `node --test electron/connection.test.cjs`.
- HA: `node --test homeassistant/ha-launch.test.cjs`; `python3 -m unittest discover -s scripts`.
- Container: package with `python3 homeassistant/package.py --out /tmp/<new-dir>`, build its
  `flybudget_up` directory, then `node homeassistant/smoke-test.cjs <image>` (disposable data only).
- Browser integration: `cd e2e && npm test -- --project=desktop tests/up.spec.ts`.
- Lint: `cd lint && npm ci && npm run lint` (errors fail; warnings are capped, lint/README.md).
- Format changed files with Prettier; CI runs full type/unit/browser/build checks.
- Dependencies use lockfiles and `.npmrc` with install scripts disabled. Do not disable that guard.

## Safety and invariants

- Never commit tokens, cookies, `.env`, databases, bank exports, credentials.key or deployment hostnames.
  Tests use mock bank data and disposable budgets only. Do not copy production data into the checkout.
- Integer minor units for money; additive migrations; shared transaction helpers for writes.
- Up imports settled AUD only; stable IDs prevent duplicates. Preserve reconciled/user-edited rows.
  Review transfer suggestions; never silently guess transfers. Tokens are encrypted and excluded from exports.
- Keep host/origin/auth protections. Remote Electron pages must have no Node or preload bridge.
  A server window drops the macOS title bar only when its page has the `flybudget-mac-window`
  marker, and learns it through its user agent (`electron/macWindow.ts`), never a bridge.
  HTTPS away from home; never bypass TLS errors.
- Read-only access tokens (`server/src/auth/accessTokens.ts`) reach only an allowlist of side-effect-free
  GET routes plus the MCP endpoint. Token writes go only through `/api/assistant/do`, each a row of the
  policy table (`auth/assistantPolicy.ts`, docs/ASSISTANT-ENDPOINTS.md), logged; changes needing approval are owner-applied proposals. Never add a writing, settings, backup, auth or bank route. Owner-approved
  exceptions: a `categorise` token may set `categoryId` alone on past transactions and create/edit categories;
  an `organise` token may also propose rules (created disabled, never enabled/reordered/deleted by a token),
  apply a category-only rule to uncategorised past rows, set payee default categories, set or replace
  a payee logo (never remove one), link only server-suggested transfers,
  suggest assignments that only the owner applies, claim past unclaimed transactions as tax
  deductions (never replace or remove a claim), read depreciating assets (never change one), and record a household contribution linked to a
  past deposit into that household's account for its exact amount and date (never expenses,
  settlements, edits or removals), and record the owner's own unlinked contribution up to what
  the owner owes the household account (never anyone else's, never into credit). Token category changes are undoable change sets;
  only the owner redoes one.
- HA `/data/options.json` stays root-only; root opens it before dropping to uid 1000. Never regenerate
  an existing key. Supervisor watchdog must be TCP because strict hosts reject its IP-based HTTP probe.
- Prebuilt HA images need `io.hass.type=app`, version and architecture labels. BuildKit says `arm64`;
  HA says `aarch64`. The container smoke test verifies the actual image metadata.
- People see the name Allotment. Stored identifiers keep `flybudget`: `FLYBUDGET_*` variables, cookies,
  headers, data paths, the `flybudget_up` HA slug, image names, `flybudget-mac-window`, and the packaged
  desktop app's internal name (its userData folder and keychain entry). Renaming them strands data.
- Never migrate, replace or delete a live budget as part of a code release. HA catalog installation has
  a different app ID from `local_flybudget_up`; migration needs a cold backup including the encryption key.

## Changes and releases

Use a feature branch and PR to this fork (explicit `--repo tvrooi/Allotment`, never upstream by accident).
Conventional commits. Keep a brief test result in the PR. Never accept the upstream CLA on the user's behalf.
Do not auto-merge dependency updates.
For owner-requested features and fixes, standing authorization covers technical review, merging green PRs,
publishing tested releases, backing up and updating the existing HA app in place, and providing desktop
download links. Complete these routine steps without asking again; an explicit per-task restriction wins.
Documentation-only changes do not need a release. Before a live update, verify the installed app identity,
complete a restorable cold backup including the encryption key, then verify health and budget access after
updating. Missing administrative access or an unverified backup is a blocker to installation, not success.
The standing authorization does not cover moving to a different HA app ID or migrating/replacing a budget.
For app changes, run `npm run release:prepare -- <next-version>` and update CHANGELOG.md in the
feature PR before merging. After main CI passes, **Publish tested main** creates the matching tag and
starts **Release** automatically. Documentation-only PRs keep the version unchanged. Never move a tag;
release tags must point to a main commit with successful CI. Manual recovery can run **Release** on an
existing tested tag; a manual run on a branch only validates packaging.
GitHub builds installers and the HA image. Only a completed release is eligible for catalog promotion.
Up sync runs at startup/manual Sync Now, with opt-in server polling and backoff; no webhooks.
Bank-source review never rewrites ledger rows. Desktop in-app updates require a verified Developer ID
signed Mac build; unsigned builds offer installer downloads from inside the app. Signing/notarization
is optional until configured; see docs/DESKTOP-UPDATES.md.

## Review guidelines

Used by automatic PR review (Codex). Security-specific checks are in [SECURITY.md](SECURITY.md)
under "Security review guidelines"; apply both. CI already runs types, Prettier, unit, browser and
build checks, so comment on what CI cannot see. Do not comment on formatting or style.

**Report format.** One finding per problem: file and line, what breaks (a concrete input, state or
caller, not "could be an issue"), and how you checked it. Rank **P0** money or data loss, a secret or
auth exposure, a migration that can lose or skip data; **P1** wrong behaviour, a broken invariant,
new behaviour without a test, a second copy of logic that already exists; **P2** staleness: dead code,
drifted docs, duplicated lists. If you cannot verify something, say so rather than guess. If the
change is sound, say so briefly.

**How to check.**

1. Read each changed function whole, then its callers. When a contract changes (route path or body,
   response shape, schema column, helper signature, query key, enum or scope value), search for every
   other use: `client/src`, `server/src` (including `routes/mcp.ts` and `server/src/browser/`), the
   demo budget, `e2e/`, docs. A change that updates one of several sites is P1.
2. Find the sibling paths. This app reaches one effect many ways: manual entry, CSV import, backup
   restore, the Up, Plaid, SimpleFIN and Enable Banking syncs, the owner versus an access token
   (`/api/assistant/do`), desktop versus server mode versus multi-user gateway, the real server versus
   the in-browser demo worker. A rule, guard or fix on one path must hold on the rest.
3. Run the narrowest relevant check from "Verification" above when the diff touches its area, rather
   than reading code and assuming. A claim in the PR body must match what the diff does.
4. Ask what the next 50 changes will do to this one: does it add a place that every future change must
   remember to update?

**Correctness.**

- Money is integer minor units of the account's currency; no floats, `parseFloat` or `Number()` on
  amounts, and conversion only at UI boundaries (`client/src/utils/currency.ts`). Splits: the parent
  holds the total, children the parts, and totals never count both (`isParent`, `inAccountBalance`).
- Dates are real `YYYY-MM-DD` (`isoDate`, `isoMonth`); never build date math on a regex-valid string.
- Writes to transactions, balances, transfers, households and the budget go through the shared
  helpers and services, in one DB transaction when several rows change. A write that bypasses them
  skips reconciled-row, split, transfer, household and payment-envelope rules.
- Never overwrite reconciled or user-edited rows from a sync. Synced imports keep stable IDs so a
  re-run adds nothing, and an owner-deleted import stays deleted (`deletedImportIds`). Transfers are
  suggested for review, never linked by guess.
- PUT schemas must not be `createSchema.partial()` when the create schema has `.default()`s (Zod 4
  applies the defaults and resets unsent fields). Request bodies are validated with Zod before any
  DB access, with caps on sizes, counts and ranges.
- Failures reach the client as generic JSON (422/409 for bank errors, never 502-504, which the client
  reads as "server down"); details are logged server side. No `catch` that silently drops a failed
  write or sync, and no fallback that makes bad data look fine.
- Rules read old formats on read and write only the current one. Preferences changes bump
  `PREFERENCES_VERSION` with a migration step.

**Database and data.**

- Migrations are additive and numbered in sequence: `server/src/db/migrations/NNNN_name.sql`, the
  matching `schema.ts` change, and a `_journal.json` entry with the next `idx`, the same `tag` and a
  `when` larger than the previous one (drizzle skips an entry whose `when` is not newer). Statements
  are separated by `--> statement-breakpoint`. A shipped migration is never edited. DROP, rename,
  type change or a backfill that rewrites rows is P0 unless it is its own reviewed migration, is
  idempotent and keeps the data; check it on a populated database as well as an empty one
  (`loanDetails.test.ts` shows how a test applies the migrations).
- A new table or column is in `BACKUP_TABLES` (`services/backupService.ts`) and survives export and
  restore, or the PR says why not (secrets, tokens, the assistant log, file bytes are deliberately
  excluded). Restoring an older backup that lacks the new field must still work.
- New queries on large tables (transactions) are indexed, bounded and not run per row (N+1). Lists
  have caps or paging. Nothing heavy runs synchronously in a request handler.

**Staleness and drift** (the main long-term risk; check every PR for these).

- One implementation per behaviour. Reuse the existing service or helper (`fundingPlan.ts`,
  `householdService.sharePayments`, `transactionHelpers.ts`, `safeFetch`, `escapeCsv`, the
  `client/src/utils/currency.ts` and `dates.ts` formatters, `isoDate`). A parallel version of logic
  that exists is P1 even if it works today. If a helper almost fits, extend it.
- A change removes what it replaces: unused exports, routes, hooks, types, components, query keys,
  flags, guide text, demo-budget entries and test fixtures. No commented-out code, no `TODO` or
  `any` or `eslint-disable`/`@ts-ignore` without a reason on the line, no compatibility shim with no
  caller. Lint warnings are capped (`--max-warnings` in `lint/package.json`): the number goes down or
  stays, never up.
- Lists and constants live in one place and are imported, not retyped (account types exist on both
  sides, so both must change together; route and scope names, `TABLES`, tab and storage keys).
  Prose docs name where a list lives instead of copying it. New code does not hard-code a version,
  count, date or hostname that will rot.
- Docs and code move together in the same PR: the matching `docs/*.md`, `HANDOVER.md` State,
  `docs/ASSISTANT-ENDPOINTS.md` and its policy table, `docs/READ-ONLY-ACCESS.md`, `README.md`,
  `UP-SUPPORT.md`, `MAINTENANCE.md`, and the `AGENTS.md` / `CLAUDE.md` pair when a rule changes. A
  doc that still describes removed or renamed behaviour is P2; an unconditional claim a change has
  made false is P1. Comments say why, and are updated when the code under them changes.
- New server routers are mounted in `server/src/index.ts` and `server/src/browser/app.ts` (Node-only
  code stays out of modules the demo loads; new Express features also need `expressShim.ts`). New
  client pages are `lazy()` in `client/src/App.tsx`. New features appear in the demo budget leanly.
- New dependencies are justified, small and maintained, with lockfile updated, no install scripts and
  no weakening of `.npmrc`. GitHub Actions are pinned to a commit SHA. Native or Electron-coupled
  packages are not bundled into routine updates.
- Dependency, CI and workflow edits are reviewed for what they could execute (secrets in
  `pull_request` jobs, `permissions`, untrusted input in `run:` steps).
- Stored identifiers keep `flybudget` and renaming them strands data; user-visible text says
  Allotment. Flag a rename of either kind.

**Tests.**

- New behaviour and every bug fix come with a test that fails without the change. Server logic uses
  Vitest, with property-based invariants (fast-check) where the logic is arithmetic or ordering; UI
  flows use Playwright (`e2e/`), selecting by role or label. Tests use mock bank data and disposable
  budgets, never real data.
- A test must not be skipped, loosened, retried or made to sleep to pass. Do not accept a changed
  expectation without a reason in the PR. Time, randomness and shared state are injected or reset, so
  tests do not depend on today's date, order or leftover rows.
- Security and policy changes carry both the allowed case and the nearest refusal
  (`assistantPolicy.test.ts` is the model).

**Client.**

- Mutations invalidate the queries they affect. Save buttons respect the connection state
  (`useCanSave`, `<SavingPausedHint />`; `useAddTransaction()` for new transactions). Money inputs are
  `type="text" inputMode="decimal"` through `CurrencyInput`, never `type="number"`; displayed dates go
  through `utils/dates.ts`.
- Interactive controls have accessible names; layouts hold at 390 px with no sideways scroll; the
  demo and offline modes keep working.

**Releases.** An app change runs `npm run release:prepare -- <next-version>`, which sets
`package.json`, `package-lock.json` and `homeassistant/config.yaml` together, and adds a matching
`CHANGELOG.md` entry; check that all three agree and that the version is not already tagged. A
documentation-only change leaves the version alone. Tags are never moved. A PR keeps to one
purpose: unrelated reformatting or drive-by refactors are P2, because they hide the real change.
