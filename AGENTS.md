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
  HTTPS away from home; never bypass TLS errors.
- HA `/data/options.json` stays root-only; root opens it before dropping to uid 1000. Never regenerate
  an existing key. Supervisor watchdog must be TCP because strict hosts reject its IP-based HTTP probe.
- Prebuilt HA images need `io.hass.type=app`, version and architecture labels. BuildKit says `arm64`;
  HA says `aarch64`. The container smoke test verifies the actual image metadata.
- Never migrate, replace or delete a live budget as part of a code release. HA catalog installation has
  a different app ID from `local_flybudget_up`; migration needs a cold backup including the encryption key.

## Changes and releases

Use a feature branch and PR to this fork (explicit `--repo tvrooi/FlyBudget`, never upstream by accident).
Conventional commits. Keep a brief test result in the PR. Never accept the upstream CLA on the user's behalf.
Do not auto-merge dependency updates. Do not publish a release unless requested.
For a requested release, `npm run release:prepare -- <version>`, update CHANGELOG.md, merge green CI,
then push matching `v<version>`. Release tags must point to a main commit with successful CI.
GitHub builds installers and the HA image. Only a completed release is eligible for catalog promotion.
Up sync has startup/manual Sync Now only; no periodic timer/webhooks. Desktop updates are manual downloads.
