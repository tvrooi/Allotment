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

## Default delivery workflow

The owner has given standing authorization for requested features and fixes to go through the complete
routine delivery process: implement, run relevant tests, technically review the diff, open a PR to this
fork, merge after successful CI, prepare and publish a tested release, promote the completed release to
the HA catalog, back up and update the existing HA app in place, verify the result, and provide the new
desktop download links. Do not request fresh approval at every routine step. A narrower instruction in
a particular task takes precedence. Documentation-only changes need no release; dependency updates
still require review and must not be auto-merged.

Before installing, identify the actual installed app and version and confirm administrative access.
Complete and verify a restorable cold backup containing the database and encryption key before changing
the live app. After updating, verify the running version, health, budget access and bank connection
status. Record deployment details privately outside the repository. Only report installation as complete
once the live update has been verified; a published image or catalog update alone is not installation.
If access or backup verification is unavailable, finish the independent release work and report that
specific installation blocker.

The currently exposed Home Assistant device-control connector does not provide app management or
backup operations. Establish an appropriate administrative access path once before promising unattended
installation. Never add credentials or deployment hostnames to these instructions or to GitHub.

The standing permission covers routine updates of the same app. It does not authorise moving a budget
between app IDs, replacing/deleting a budget, changing credentials, or bypassing security protections.
If the existing installation is still the local preview, the one-time move to the catalog app remains a
separate migration task under the backup-and-restore procedure below. The first updater-enabled signed Mac desktop needs a manual install. Later signed Mac builds
can download and restart through the app; other platforms use manual downloads. Reopening/reloading
the connected client is sufficient for server/UI changes.

## Release a tested update

1. Include `npm run release:prepare -- 0.2.0-up.5` (choose the next unused version) and CHANGELOG.md
   notes in the feature/fix PR. Documentation-only changes leave the version unchanged.
2. Merge after **CI passed** is green. CI runs again on the main commit; after it succeeds,
   **Publish tested main** creates the matching `v0.2.0-up.5` tag and explicitly starts **Release**.
   It only accepts this fork's main push CI, skips superseded commits and versions already tagged,
   and never moves/reuses a tag or overwrites an existing release. The bot token needs no PAT and
   cannot access Home Assistant. A missing version bump is reported as a skipped release; agents
   must prepare the version as part of app changes, so the owner only needs to merge the tested PR.
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
6. With the administrative access established above, verify the existing app, complete its cold backup,
   check for updates and install the new version. Verify the live result before reporting success.
   Provide desktop installers from Releases. Signed Mac clients can update through the app after
   the first updater-enabled signed build is installed; see docs/DESKTOP-UPDATES.md. Other platforms
   use manual installers. Server UI/Up changes appear without reinstalling the desktop.

A merged, prepared app version now starts publication automatically after main CI; it does not
publish unchecked code or directly deploy to Home Assistant. If the publishing step fails before
starting **Release**, retry **Publish tested main** on main. If a tag already belongs to an earlier
main commit, run **Release** manually on that exact tag after verifying its successful main CI;
never retag it. Release still publishes only after all installer/image checks succeed.

To receive routine automatic HA updates, add the catalog repository using Settings → Apps → Install
app → Repositories, then enable **Auto update** on the catalog-installed FlyBudget app after the
backup/update path has been verified. Adding a repository only registers a source; it does not
replace the local app, move its budget or enable updates on that local app. The existing local
preview still needs separately authorised migration before it can follow catalog updates.

Pre-release `-up.N` tags are intentional for this fork. Keep the GHCR package public so Home Assistant
can pull it without storing registry credentials.

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

- Up imports settled AUD transactions; startup/manual sync and opt-in server polling with backoff, no webhooks.
- One owner password and one Up token per budget; no multi-user separation.
- Remote desktop budgets require the server to be reachable; no full offline merge.
- Mac signing/notarization is optional until configured. Unsigned Mac, Windows and Linux builds check for releases in the app and offer installer downloads; automatic installation requires a verified Developer ID signed Mac build.
- Keep real tokens, passwords, databases, bank exports and deployment hostnames out of GitHub.
