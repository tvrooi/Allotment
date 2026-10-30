# Contributing to Allotment

Thanks for helping make Allotment better. Bug reports, ideas and pull requests
are all welcome.

## Before you start

- **Found a security problem?** Don't open a public issue. Follow
  [SECURITY.md](SECURITY.md) to report it privately.
- **Planning something big?** Open an issue first so we can agree on the
  approach before you spend time on it.

## This fork

Send changes to **tvrooi/Allotment**, not upstream by accident. Contributions to this fork remain
under AGPL-3.0-only; no separate CLA is required here. `CLA.md` is retained as an upstream document
and describes submissions to the original project. No agreement is accepted on a contributor's behalf.

For release steps, see [MAINTENANCE.md](MAINTENANCE.md). For a short file/test map, see [AGENTS.md](AGENTS.md).

## Make changes and release

Open this checkout as a dedicated Codex or Claude Code project. Start with [AGENTS.md](AGENTS.md), a
short map of the files and relevant checks. Read the longer [development reference](docs/DEVELOPMENT.md)
only when needed. Use feature branches and PRs to this fork; green CI is required on main.

[MAINTENANCE.md](MAINTENANCE.md) documents the full release process. Feature and fix PRs include the
next `0.2.0-up.N` version and release notes. After merging and successful main CI, GitHub automatically
tags that prepared version, builds and tests installers and containers, then publishes the completed
release. The Home Assistant catalog follows verified releases; its installed app can use Home
Assistant's **Auto update**. Desktops offer **Budget → Check for desktop updates…** and installer
downloads. Verified signed Mac builds additionally support restart-and-install. The first updater
build needs one manual install. See [Desktop updates and optional signing](docs/DESKTOP-UPDATES.md).
Documentation-only merges do not publish a new version, and a merge does not bypass release checks.

## Moving an existing local Home Assistant preview

The catalog-installed app has a different identifier and private data directory from the older
manually copied `local_flybudget_up` app. Adding the repository does not migrate it. Keep the working
app until a verified cold backup and restore has preserved the database **and encryption key**. A JSON
export excludes the Up token. See [migration and rollback notes](MAINTENANCE.md#first-release-and-migration).

## Building the desktop app yourself

Most people should download an installer from [Releases](https://github.com/tvrooi/Allotment/releases).
To build your own you need Node.js 22 or newer, npm, and the tools Electron Builder needs on your
system. The repository's `.npmrc` disables dependency install scripts; keep that setting.

```sh
npm ci
npm ci --prefix client
npm ci --prefix server
npm run build:client:electron
npm run build:server:bundle
npm run compile:electron
npx electron-builder --mac dmg --arm64   # or another target from electron-builder.json
```

The installer appears in `dist-electron/`. Builds are ad-hoc signed, not Apple-notarised. Plain
`npm run dev` and `npm run electron:dev` do not provide credential encryption; use a packaged app or
an encrypted server for a real Up token. To build the server image yourself:
`docker build -t flybudget-up:local .`, then use `docker-compose.yml` with that image.

## Checking the desktop server connection

```sh
npm run compile:electron
node --test electron/connection.test.cjs
npm run build:server:bundle
npm run build --prefix client -- --outDir /tmp/flybudget-web
node electron/remote-smoke.cjs /tmp/flybudget-web
```

The smoke test uses real Electron and an isolated local server, with a throwaway database/profile.
It checks the native picker, HTTP confirmation, login/setup, server writes visible to another
signed-in device, session persistence, and that no local database or credential key was created.
It does not use real Up credentials.

## Where the Up code lives

- `server/src/services/upService.ts`: bounded API requests and pagination.
- `server/src/services/upTransactions.ts`: validation, exact amounts, dates and balance handling.
- `server/src/services/upSyncService.ts`: atomic account imports, rules and duplicate detection.
- `server/src/routes/up.ts`: authenticated setup, mapping, sync and disconnect endpoints.
- `client/src/components/up/`: setup and Connected Banks UI.

Tests use a local mock of Up's documented API, never real financial data or credentials. To propose
a change upstream, read the upstream project's own contribution rules and CLA first; nothing has been
submitted on anyone's behalf.

## Development setup

```bash
npm install && npm install --prefix client && npm install --prefix server
npm run dev   # client on http://localhost:5173, server on port 3001
```

Every package has an `.npmrc` with `ignore-scripts=true`, so dependency install
scripts never run. None are needed.

## Checks to run before opening a pull request

```bash
cd server && npx tsc --noEmit && npm test
cd client && npx tsc --noEmit && npm test
cd e2e && npm ci && npx playwright install chromium && npm test   # end-to-end
npm run format:check   # from the root; `npm run format` fixes it
```

CI runs all of these on every pull request.

## Guidelines

- **Amounts are integer cents** everywhere; convert only in the UI.
- **Validate every request body** with Zod on the server, and use the shared
  validators in `server/src/utils/validation.ts` for dates and months.
- **Add tests** for what you change. Most tests are property-based (fast-check);
  UI changes should come with a Playwright test in `e2e/`.
- **Never leave a blank screen.** When a page or card has nothing to show, use
  `EmptyState` (`client/src/components/ui/`): say what goes there and offer a
  button for the first step.
- **Give controls accessible names** (labels, `aria-label`), so they work with
  screen readers and can be found by tests.
- **Keep the security model intact.** [SECURITY.md](SECURITY.md) and
  [CLAUDE.md](CLAUDE.md) describe it; loading anything from a new external
  origin, for example, means updating the Content Security Policy.

## Commit messages

Use conventional commit prefixes:

| Type       | Description                                 |
| ---------- | ------------------------------------------- |
| `feat`     | Adds a new feature                          |
| `fix`      | Fixes a bug                                 |
| `docs`     | Documentation-only changes                  |
| `style`    | Formatting or styling changes               |
| `refactor` | Restructures code without changing behavior |
| `perf`     | Improves performance                        |
| `test`     | Adds or updates tests                       |
| `build`    | Changes the build system or dependencies    |
| `ci`       | Changes CI/CD configuration                 |
| `chore`    | General maintenance work                    |
| `revert`   | Reverts a previous commit                   |
