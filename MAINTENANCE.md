# Maintain this fork

Application: https://github.com/tvrooi/FlyBudget
Home Assistant catalog: https://github.com/tvrooi/home-assistant-apps
Upstream: https://github.com/dtymoszenko/FlyBudget

## Everyday changes

Open this repository as its own Codex project. Describe one change, then work on a feature branch
and a pull request to **tvrooi/FlyBudget**. CI checks types, formatting, unit tests, browser tests
and builds. Review the diff and merge green checks. Small changes need only the relevant local
checks; let CI run the full suite. AGENTS.md is deliberately short; detailed architecture is in
`docs/DEVELOPMENT.md` and should be read only when needed.

## Release a tested update

1. Run `npm run release:prepare -- 0.2.0-up.5` (choose the next version), add CHANGELOG.md notes,
   and merge that release PR once **CI passed** is green.
2. Push `v0.2.0-up.5` pointing at that tested main commit. Never move or reuse a published tag.
3. **Release** builds Windows, macOS (ARM/Intel), Linux installers and the HA image for AMD64/ARM64.
   It smoke-tests the actual HA container, including login, private Supervisor options, strict-host
   watchdog and persistent database/key. Desktop packages start in disposable CI-only local profiles.
4. The release is published only after all build jobs succeed. Its `home-assistant-app.zip` contains
   public installation metadata plus the exact source commit and image digest. Downloads have
   SHA-256 checksums and GitHub build-provenance attestations.
5. The catalog repo's **Sync FlyBudget release** workflow checks for completed Up releases hourly.
   You can run it manually immediately. It verifies the bundle's provenance, checksums, expected
   filenames, version and image digest, then commits only the catalog metadata. It needs no PAT
   or cross-repository write access. A failed/incomplete release cannot update the catalog.
6. In Home Assistant, check for updates and click **Update**. Take a cold HA backup first. Download
   desktop installers from Releases when desktop code changes; there is no desktop auto-updater.
   Server UI/Up changes appear in the connected desktop without reinstalling it.

A merge alone does not deploy anything. Pre-release `-up.N` tags are intentional for this fork.
Keep the GHCR package public so Home Assistant can pull it without storing registry credentials.

## First release and migration

The currently installed local HA preview is a separate app (`local_flybudget_up`). Repository apps
have a different identifier and private data directory. Adding this catalog does **not** migrate it.
Keep the working local app until a checked cold backup and restore has been performed. Back up the
entire private app data, including `credentials.key` and database/WAL files, while the app is stopped.
A FlyBudget JSON export excludes the Up token; it cannot preserve the bank connection by itself.
Do not run two copies on port 3001. Restore first, verify login, account/transaction counts, bank
connection and the key, then switch port/routing. Do not delete the original app or backup until
verification. A Home Assistant full backup is the rollback path.

## Upstream updates

Fetch `upstream/main`, merge it into a dedicated branch, review schema/security changes and resolve
conflicts. Run CI and release normally. Never pull upstream directly into the production app.
The original AGPL license/copyright notices remain. The inherited CLA and dependency auto-merge workflows are removed in this fork by owner approval.
CI, container vulnerability scans and Scorecard remain active. No upstream CLA was accepted.

## Current limits

- Up imports settled AUD transactions; startup and manual **Sync Now**, no timer/webhooks.
- One owner password and one Up token per budget; no multi-user separation.
- Remote desktop budgets require the server to be reachable; no full offline merge.
- macOS builds are ad-hoc signed and unnotarized; Windows builds lack Authenticode signing.
- Keep real tokens, passwords, databases, bank exports and deployment hostnames out of GitHub.
