# FlyBudget Up community fork

Native Up Bank imports and a desktop client that connects to your own FlyBudget server.
Maintained fork of [dtymoszenko/FlyBudget](https://github.com/dtymoszenko/FlyBudget), under AGPL-3.0-only.
This is an independent community preview, not an official FlyBudget, Up or Home Assistant release.

## Install and use

- [Desktop downloads](https://github.com/tvrooi/FlyBudget/releases): macOS ARM/Intel, Windows and Linux.
- [Home Assistant app repository](https://github.com/tvrooi/home-assistant-apps): prebuilt AMD64/ARM64 containers and normal HA updates.
- [Connect the desktop to your server](DESKTOP-SERVER.md): **Budget → Budget location…**, enter its HTTPS URL and sign in with the FlyBudget password.
- [Connect Up](UP-SUPPORT.md): use **Connect Up** in the welcome screen or Settings → Connected Banks.

Your budget and encrypted bank token stay on your server. The desktop displays that server's UI;
you do not need to budget inside Home Assistant. Server UI changes reach the connected desktop
without reinstalling it. Desktop-specific changes require downloading a new installer.

macOS builds are ad-hoc signed and unnotarized. Windows builds are not Authenticode-signed.
Up currently imports settled AUD transactions, including Savers and available 2Up accounts.
Sync runs at server startup and via **Sync Now**; there is no periodic timer or webhook yet.

## Moving an existing local HA preview

The repository-installed app has a different identifier and private data directory. Adding the
repository does not migrate `local_flybudget_up`. Keep the working app until a verified cold backup
and restore has preserved the database **and encryption key**. A JSON export excludes the Up token.
See [migration and rollback notes](MAINTENANCE.md#first-release-and-migration).

## Make changes and release

Open this checkout as a dedicated Codex project. Start with [AGENTS.md](AGENTS.md), a short map of
the files and relevant checks. Read the longer [development reference](docs/DEVELOPMENT.md) only
when needed. Use feature branches and PRs to this fork; green CI is required on main.

[MAINTENANCE.md](MAINTENANCE.md) documents the full release process. In brief: prepare the next
`0.2.0-up.N` version and notes, merge green CI, then push its matching `v` tag. GitHub builds and
tests installers and containers. Only a completed, verified release reaches the HA catalog. A merge
alone does not deploy to your live budget.

## Upstream, security and license

Original application and copyright: [dtymoszenko/FlyBudget](https://github.com/dtymoszenko/FlyBudget).
The [upstream README](docs/UPSTREAM-README.md) is retained as reference; its download links and
contribution policies describe upstream. This fork's instructions are above and in [CONTRIBUTING.md](CONTRIBUTING.md).

[Report security issues privately](https://github.com/tvrooi/FlyBudget/security/advisories/new).
See [SECURITY.md](SECURITY.md). Never put bank tokens, databases, keys or private exports in issues or PRs.

All original notices and the [AGPL-3.0-only license](LICENSE) are retained. Modified source is public
here and linked from the application. This fork does not require or accept the upstream CLA on your behalf.
