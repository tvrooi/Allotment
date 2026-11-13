---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
# Coding Conventions

**Analysis Date:** 2026-11-13

## Naming Patterns

**Files:**
- Server modules are camelCase `.ts`: `server/src/routes/transfers.ts`, `server/src/services/reconciliationService.ts`, `server/src/utils/money.ts`.
- Server tests sit beside the module as `*.test.ts` (for example `server/src/routes/transfers.test.ts`, `server/src/utils/money.test.ts`).
- Client components are PascalCase `.tsx` grouped by feature folder: `client/src/components/up/UpReview.tsx`, `client/src/components/up/UpSettings.tsx`.
- Client hooks are `use*.ts` in `client/src/hooks/` (`useAccounts.ts`, `useUndoKeyboard`-style names such as `useAddTransactionKeyboard.ts`).
- Client API wrappers are one module per resource in `client/src/api/` (`client/src/api/up.ts`, `client/src/api/accounts.ts`), built on `apiFetch` from `client/src/api/client.ts`.
- Client stores are zustand stores in `client/src/store/` (`client/src/store/undoStore.ts`, `client/src/store/preferencesStore.ts`).
- Platform-coupled or demo-only server code lives under `server/src/browser/` and `server/src/demo/`.
- E2E specs are kebab-case `.spec.ts` under `e2e/tests/` (`e2e/tests/confirm-and-save.spec.ts`, `e2e/tests/payday.spec.ts`).

**Functions:**
- camelCase for all functions. Express routers are exported as `<name>Router` (`accountsRouter` in `server/src/routes/accounts.ts`, `transactionsRouter` in `server/src/routes/transactions.ts`).
- React components are PascalCase function declarations; hooks are `useX`.
- Mutation hooks are named `useCreateAccount`-style verbs (`client/src/hooks/useAccounts.ts`).
- Service helpers keep domain verbs: `previewAccountDeletion`, `deleteAccountWithTransactions`, `reviewSelection`, `setAssignPool`.

**Variables:**
- camelCase locals; `const` by default.
- Module-level constants are SCREAMING_SNAKE_CASE when they are true constants: `MAX_STACK` in `client/src/store/undoStore.ts`, `HIDDEN_AMOUNT` in `client/src/utils/safeMode.ts`.
- Database identifiers in SQL and Drizzle schema are snake_case columns mapped to camelCase TypeScript properties in `server/src/db/schema.ts`.

**Types:**
- Zod schemas are named `<thing>Schema` (`reviewSchema`, `bulkChangesSchema`, `importSettingsSchema`), and types are inferred or declared as `interface` (`UpConnection`, `UpMappingChoice` in `client/src/api/up.ts`).
- Shared domain enums use Zod (`accountTypeSchema` in `server/src/utils/accountTypes.ts`, `currencySchema` in `server/src/utils/validation.ts`).
- Error classes extend `Error` and are named `<Domain>Error` (`ReconciliationError` in `server/src/services/reconciliationService.ts`, `ChangeSetError` in `server/src/services/changeSets.ts`, `TaxError` in `server/src/services/taxService.ts`).

## Code Style

**Formatting:**
- Prettier, configured in `.prettierrc` at the repo root: single quotes, semicolons, 2-space indent, trailing commas `all`, `printWidth` 100, `arrowParens: always`.
- Check with `npm run format:check` from the root; fix with `npm run format` (`prettier --write .`). Ignored paths are in `.prettierignore`.
- Run Prettier on every changed file before committing.

**Linting:**
- ESLint lives in its own package at `lint/` because typescript-eslint needs TypeScript's JS API and the app uses TypeScript 7. Config is `lint/eslint.config.js`.
- Run: `cd lint && npm ci && npm test && npm run lint`.
- Errors fail CI: JavaScript and typescript-eslint recommended rules, React hooks rules, and two house rules:
  - `lint/rules/icon-only-control.js`: an icon-only button or link needs an `aria-label`.
  - Calendar-day rule: `toISOString()` sliced to a date is an error in production code. Use `server/src/utils/date.ts` on the server and `client/src/utils/calendarDay.ts` in the client (`addDaysIso`, `todayIso`, `localDayIso`, `utcDayIso`).
- Warnings are a burn-down: `lint/package.json` sets `--max-warnings=128`. New code must not add warnings; when you fix some, lower the number in the same change.
- TypeScript is strict in both packages (`server/tsconfig.json` has `"strict": true`; `client/tsconfig.json` is checked with `tsc -b` in the client build).

## Import Organization

**Order (observed):**
1. Package imports (`express`, `zod`, `drizzle-orm`, `@tanstack/react-query`, `react`).
2. Local server or client modules, often grouped by layer (`../db/...`, `../services/...`, `../utils/...`).
3. Type-only imports are written inline with `type` (`import { type CurrencyContext }`) or as `import type`.

The order is not enforced by a sorter; match the surrounding file.

**Module specifiers:**
- Server source uses explicit `.js` extensions on relative imports (`import { db } from '../db/index.js';`), because the server is ESM (`"type": "module"`) and built with `tsx`/`esbuild`.
- Client source imports relative paths without extensions (`import { apiFetch } from './client';`).

**Path Aliases:**
- No path aliases are configured. Use relative paths.

## Error Handling

**Server routes:**
- Validate request bodies with Zod before any DB access: `const parsed = reviewSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });` (`server/src/routes/transactions.ts`).
- Domain errors are thrown from services as typed `Error` subclasses, caught in the route, and mapped to HTTP status by a helper (`sendMarkError(res, error)` in `server/src/routes/transactions.ts`).
- Failures reach the client as generic JSON. Bank and sync failures use 422/409, never 502-504, because the client reads 5xx as "server down". Details go to the log, not the response (`server/src/utils/log.ts`).
- Do not add a `catch` that silently drops a failed write or sync. Surface it.

**Client:**
- Mutations surface errors through the undo/toast store (`useUndoStore`, `client/src/store/undoStore.ts`). Failed undo or redo shows a toast with the reason, and a 409 conflict drops the stale command.
- Queries and mutations use TanStack Query; surface errors via the query's error state, not `console.error`.

**Patterns:**
- Money is never a float. Keep amounts as integer minor units; convert only at UI boundaries via `client/src/utils/currency.ts` and `server/src/utils/money.ts`.
- Dates are real `YYYY-MM-DD` values validated with `isoDate` (`server/src/utils/validation.ts`). Do not do date math on a string that only passes a regex.

## Logging

**Framework:** `console` on the server, wrapped by `logError(context, err)` in `server/src/utils/log.ts`.

**Patterns:**
- Use `logError('context', err)` for failures. It JSON-escapes the detail and strips U+2028/U+2029 so request or bank text cannot forge log lines.
- Do not log secrets, tokens, bank payloads, or budget contents.
- Client code does not log to the console in production paths.

## Comments

**When to Comment:**
- Comments explain why, especially for invariants that are not obvious. Examples: the reason the demo swaps modules in `client/vite.config.ts`, the reason the Zod PUT schema must not be `.partial()` (see the review rules in `CLAUDE.md`), and the reason `DB_PATH` is `:memory:` in `server/vitest.config.ts`.
- Reference issues or audit findings by number when they explain a rule (`(issue #89)`, `(audit F-22)`).
- Do not leave commented-out code, bare `TODO`s, or `eslint-disable` / `@ts-ignore` without a reason on the same line.

**JSDoc/TSDoc:**
- `/** ... */` blocks sit on exported helpers and on non-obvious types (for example `UpSyncResult` fields in `client/src/api/up.ts`, `AmountStyle` in `client/src/utils/currency.ts`).
- Not required on every function.

## Function Design

**Size:** Route handlers stay thin: validate, call a service, respond. Logic lives in `server/src/services/`. Large single files exist (for example `server/src/routes/transactions.ts`), so put new logic in a service rather than growing a route file further.

**Parameters:** Prefer a single options object for more than two arguments. Zod-parsed bodies are passed as typed objects.

**Return Values:** Services return plain objects or throw domain errors. Routes return `res.json(...)`.

## Module Design

**Exports:**
- Named exports only. Routers are exported as named constants (`export const accountsRouter = Router();`).
- Do not add a default export to a module that already uses named exports.

**Barrel Files:**
- Not used. Import from the module file directly.

**Shared lists and constants:**
- Lists live in one place and are imported, not retyped. Account types live in `server/src/utils/accountTypes.ts`, and the client mirrors them, so both sides change together.
- Route and scope names, `TABLES`, tab keys and storage keys are shared constants. Check for an existing one before adding a string literal.
- Compatibility shims with no caller are not added. A change removes the code it replaces.

## Where new code goes

- New server router: `server/src/routes/<name>.ts`, mounted in `server/src/index.ts` and `server/src/browser/app.ts`. Express features also need `server/src/browser/expressShim.ts` support.
- New client page: lazy-loaded in `client/src/App.tsx`.
- New domain logic: `server/src/services/`; reuse `balances.ts`, `transactionHelpers`, `safeFetch` and similar existing helpers before writing a parallel one.

---

*Convention analysis: 2026-11-13*
