# Contributing to FlyBudget

Thanks for helping make FlyBudget better. Bug reports, ideas and pull requests
are all welcome.

## Before you start

- **Found a security problem?** Don't open a public issue. Follow
  [SECURITY.md](SECURITY.md) to report it privately.
- **Planning something big?** Open an issue first so we can agree on the
  approach before you spend time on it.

## This fork

Send changes to **tvrooi/FlyBudget**, not upstream by accident. Contributions to this fork remain
under AGPL-3.0-only; no separate CLA is required here. `CLA.md` is retained as an upstream document
and describes submissions to the original project. No agreement is accepted on a contributor's behalf.

For release steps, see [MAINTENANCE.md](MAINTENANCE.md). For a short file/test map, see [AGENTS.md](AGENTS.md).

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
