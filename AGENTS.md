# FlyBudget Up fork — working guide

This repository is `tvrooi/FlyBudget`, an AGPL-3.0-only fork of `dtymoszenko/FlyBudget`.
Read only the files relevant to the request. Do not read the entire repository or long conversation history.
Detailed upstream architecture: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), on demand.
Release process and known limitations: [MAINTENANCE.md](MAINTENANCE.md).
Keep this file and CLAUDE.md identical.

## Where to work

- React UI: `client/src/`; Express + SQLite: `server/src/`.
- Up API: `server/src/services/upService.ts`, `upSyncService.ts`, `upTransactions.ts`, `routes/up.ts`.
- Up UI: `client/src/components/up/`, `hooks/useUp.ts`, `api/up.ts`.
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
  GET routes plus the MCP endpoint. Never add a writing, settings, backup, auth or bank route. Owner-approved
  exceptions: a `categorise` token may set `categoryId` alone on past transactions and create/edit categories;
  an `organise` token may also propose rules (created disabled, never enabled/reordered/deleted by a token),
  apply a category-only rule to uncategorised past rows, set payee default categories, link only
  server-suggested transfers, and suggest assignments that only the owner applies. Token category changes are undoable change sets.
- HA `/data/options.json` stays root-only; root opens it before dropping to uid 1000. Never regenerate
  an existing key. Supervisor watchdog must be TCP because strict hosts reject its IP-based HTTP probe.
- Prebuilt HA images need `io.hass.type=app`, version and architecture labels. BuildKit says `arm64`;
  HA says `aarch64`. The container smoke test verifies the actual image metadata.
- Never migrate, replace or delete a live budget as part of a code release. HA catalog installation has
  a different app ID from `local_flybudget_up`; migration needs a cold backup including the encryption key.

## Changes and releases

Use a feature branch and PR to this fork (explicit `--repo tvrooi/FlyBudget`, never upstream by accident).
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
