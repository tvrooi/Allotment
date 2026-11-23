---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
# Testing Patterns

**Analysis Date:** 2026-11-13

## Test Framework

**Runner:**
- Vitest 5 for server (`server/package.json`, config `server/vitest.config.ts`) and client (`client/package.json`, Vite config `client/vite.config.ts`, no separate vitest config).
- Playwright for end-to-end tests in `e2e/` (config `e2e/playwright.config.ts`).
- Node's built-in test runner (`node --test`) for the lint package tests in `lint/`.

**Assertion Library:**
- Vitest `expect` (`import { describe, it, expect } from 'vitest';`).
- Property-based testing with `fast-check` (`import fc from 'fast-check';`) in both server and client.
- Playwright `expect` in `e2e/`.

**Run Commands:**
```bash
npm test --prefix server                       # Server unit and integration tests (all)
npm test --prefix server -- <affected-test>    # One server test file, e.g. src/routes/transfers.test.ts
cd server && npx tsc --noEmit                  # Server type check
npm test --prefix client                       # Client unit tests (vitest run)
npm run build --prefix client                  # Client type check (tsc -b) and production build
npm run compile:electron                       # Desktop type check
node --test electron/connection.test.cjs       # Desktop connection tests
cd lint && npm ci && npm test && npm run lint # Lint rule tests, then lint itself
cd e2e && npm test -- --project=desktop tests/up.spec.ts   # One browser spec
cd e2e && npm test -- --project=demo           # In-browser demo suite
E2E_SKIP_BUILD=1 npm test                      # Reuse client builds from the last run
E2E_CHROMIUM_PATH=/path/to/chrome npm test     # Use an installed Chromium
```
Watch mode and coverage are not configured in the repo scripts. Use `npx vitest` in the package directory for watch mode.

## Test File Organization

**Location:**
- Server and client unit tests are co-located with the module: `server/src/utils/money.test.ts` beside `server/src/utils/money.ts`; `client/src/store/undoStore.test.ts` beside `client/src/store/undoStore.ts`.
- Server route and integration tests are also co-located in `server/src/routes/` (about 150 `*.test.ts` files in the server source tree).
- Browser end-to-end tests are separate, under `e2e/tests/`, with subfolders for `demo/`, `multi-user/`, and `phone/`.
- Shared test fixtures for the server live in `server/src/test/` (`upMock.ts`, `upRichData.ts`). The mock Up Bank server is shared by unit and integration tests.
- E2E fixtures and helpers live in `e2e/tests/fixtures.ts` and the mock services in `e2e/mockUp.ts`, `e2e/mockEnableBanking.ts`, `e2e/mockFrankfurter.ts`, `e2e/mailCatcher.ts`.

**Naming:**
- Vitest: `<module>.test.ts`. Specialised variants use a suffix: `security.serverMode.test.ts`.
- Playwright: `<feature>.spec.ts`, kebab-case.
- The client has no `.test.tsx` files. Component behaviour is covered by Playwright, not component tests.

**Structure:**
```
server/src/routes/transfers.test.ts      # integration test for the route
server/src/utils/money.test.ts           # unit + property tests
server/src/test/upMock.ts                # shared mock servers and fixtures
client/src/store/undoStore.test.ts       # store unit test
e2e/tests/accounts.spec.ts               # browser test using fixtures
e2e/tests/fixtures.ts                    # Api helper, open(), typeAmount(), isoDay()
```

## Test Structure

**Suite Organization (server integration test, from `server/src/routes/transfers.test.ts`):**
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { transactionsRouter } from './transactions.js';

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

describe('transfers between existing transactions', () => {
  it('suggests an imported payment and its other side, then links them', async () => {
    // arrange through the API, then assert on the API and on the row
  });
});
```

**Suite Organization (client unit test, from `client/src/store/undoStore.test.ts`):**
```typescript
describe('undo store failures', () => {
  beforeEach(() => {
    useUndoStore.setState({ undoStack: [], redoStack: [], toastMessage: null, toastAction: null });
  });

  it('a conflicting undo says so, forgets the stale command and runs nothing more', async () => {
    // ...
  });
});
```

**Patterns:**
- Setup: `beforeAll` migrates an in-memory SQLite database and mounts the router on an ephemeral port (`app.listen(0, '127.0.0.1')`).
- Teardown: `afterAll(() => server.close())`. Reset store state in `beforeEach`.
- Assertions: check both the HTTP response and the stored row (`db.select().from(transactions).where(...).get()`).
- Test names are full sentences describing behaviour, not implementation (`'a conflicting undo says so, forgets the stale command and runs nothing more'`).
- Write the expected value with a hand-computed fixture, and use `fc.assert(fc.property(...))` for arithmetic and ordering invariants.

## Mocking

**Framework:** Vitest's built-in `vi` (`import { vi } from 'vitest'`) is available. Most server tests avoid mocking by using the real in-memory database and real routers. Mocks are replaced with fake servers.

**Patterns:**
- Prefer a real in-memory database and a real Express app on an ephemeral port over mocking the database.
- External banks are mocked with local HTTP servers, not stubbed functions. Up Bank: `server/src/test/upMock.ts` (`startUpMock`, `UP_TEST_TOKEN`). Enable Banking, Frankfurter (currency rates) and mail: `e2e/mockEnableBanking.ts`, `e2e/mockFrankfurter.ts`, `e2e/mailCatcher.ts`.
- The server test environment is set in `server/vitest.config.ts`:
  - `DB_PATH: ':memory:'` so tests never open the real `budget.db`.
  - A fixed `FLYBUDGET_DATA_KEY` so encrypted credential columns behave as they do in the desktop app.
- Time is injected or fixed. Do not depend on today's date. Tests use values like `'2096-01-10'` in `server/src/routes/transfers.test.ts` to avoid colliding with real rows.

**What to Mock:**
- External bank and network APIs (use the local mock servers above).
- Clock-dependent behaviour, by injecting a date.

**What NOT to Mock:**
- The database and SQL: tests run migrations against an in-memory SQLite database.
- Express routing and Zod validation: exercise the real router.
- The shared transaction helpers and services: test them through the route.

## Fixtures and Factories

**Test Data:**
```typescript
// Server: build rows through the API, then read them back
const checking = await account('Checking A');
const out = await imported(checking, '2096-01-10', -12_345, 'PAYMENT TO CARD');

// E2E: seed through the Api helper in e2e/tests/fixtures.ts
await api.createAccount('Checking', 120_000);
```

**Location:**
- Server fixtures: `server/src/test/upMock.ts` and `server/src/test/upRichData.ts`.
- E2E fixtures: `e2e/tests/fixtures.ts` (the `Api` class, `open`, `typeAmount`, `isoDay`, `thisMonth`). The `api` fixture resets the database before each test via `/api/export/restore`.
- Demo budget data for the in-browser demo: `server/src/demo/`.
- Mock bank data only. Never copy production budgets or bank exports into the repo or test fixtures.

## Coverage

**Requirements:** No coverage threshold is enforced. Coverage is not collected by the repo scripts.

**View Coverage:**
```bash
npx vitest run --coverage --prefix server   # if the coverage plugin is installed; not configured in the repo
```

## Test Types

**Unit Tests:**
- Pure helpers in `server/src/utils/` and `client/src/utils/` (money, dates, recurrence, currency, CSV).
- Store behaviour in `client/src/store/` (undo, preferences).
- Property-based tests for arithmetic and ordering (`server/src/utils/money.test.ts`, which checks rounding, parsing and formatting round-trips).

**Integration Tests:**
- Server route tests in `server/src/routes/*.test.ts`. These mount real routers on an in-memory database and call them over HTTP with `fetch`.
- Migration tests: `server/src/db/loanDetails.test.ts` and similar apply `server/src/db/migrations/` to a fresh database. Check a migration on a populated database as well as an empty one.
- Security and policy tests: `server/src/auth/assistantPolicy.test.ts` is the model. Every security or policy change needs both the allowed case and the nearest refusal.

**E2E Tests:**
- Playwright with real browsers and real servers, throwaway databases (`e2e/global-setup.ts`).
- Projects in `e2e/playwright.config.ts`:
  - `desktop`: the desktop app at 1400x900. Runs one worker at a time because the suite shares one database, reset before each test.
  - `phone`: 390x844 mobile viewport.
  - `iphone-webkit`: WebKit at iPhone 14 Pro Max size.
  - `demo`: the in-browser demo in a Web Worker.
  - `server-mode` and `multi-user`: additional server configurations.
- Selectors use roles and labels (`getByRole('dialog', { name: 'Add account' })`, `getByRole('textbox', { name: 'Account name' })`), not CSS classes.
- Retries: `retries: 1` in CI, `0` locally. `forbidOnly` in CI.
- Traces are kept on failure (`trace: 'retain-on-failure'`), screenshots only on failure.

**Lint tests:**
- `lint/rules/icon-only-control.test.js`, `lint/tokens/contrast.test.js` (WCAG contrast of theme colours read from `client/src/index.css`), `lint/terms/terms.test.js` (retired names that must not return, from `docs/GLOSSARY.md`).
- Run with `npm test` in `lint/`.

## Common Patterns

**Async Testing:**
```typescript
// Server: await fetch helpers; never sleep
const { body } = await call('POST', '/accounts', { name, type, startingBalance: 0 });

// E2E: poll a value instead of sleeping
await expect
  .poll(async () => (await api.accounts()).map((a) => a.name))
  .toEqual(['Chase Checking']);
```

**Error Testing:**
```typescript
// Client store: a conflicting (409) failure is reported and dropped
const conflict = Object.assign(new Error('Your budget changed. Refresh before editing.'), {
  status: 409,
});
useUndoStore.getState().push(command({ undo: async () => { throw conflict; } }));
await useUndoStore.getState().undo();
expect(useUndoStore.getState().toastAction).toBe('error');

// Server: a refusal returns a status and a generic body
expect(res.status).toBe(400);
```

**Property-based Testing:**
```typescript
const arbAmount = fc.integer({ min: -1_000_000_000_00, max: 1_000_000_000_00 });
it('is the exact value rounded once', () => {
  fc.assert(
    fc.property(arbAmount, arbRate, (amount, rate) => {
      fc.pre(fits(amount, rate));
      // assert against the exact fraction
    }),
  );
});
```

## Rules for new tests

- Every new behaviour and every bug fix comes with a test that fails without the change.
- Do not skip, loosen, retry, or sleep a test to make it pass. Do not accept a changed expectation without a reason in the PR.
- Use mock bank data and disposable budgets only.
- Use `expect.poll` or explicit waits for asynchronous UI state in E2E tests.
- Use fixed dates and injected time. Do not depend on today's date, test order, or leftover rows.

---

*Testing analysis: 2026-11-13*
