---
last_mapped_commit: 0426504f2113a5ba99091987a5e27ec6ee353b23
last_mapped_at: 2026-11-13
---
<!-- refreshed: 2026-11-13 -->
# Codebase Concerns

**Analysis Date:** 2026-11-13

## Tech Debt

**Oversized modules (schema, services, routes, pages):**
- Issue: A handful of files carry most of the logic and are hard to review in one pass. Largest non-test sources: `server/src/db/schema.ts` (~1930 lines), `server/src/services/householdService.ts` (~1575), `server/src/routes/mcp.ts` (~1535), `server/src/services/longTermForecast.ts` (~1500), `server/src/services/paymentPlanService.ts` (~1080), `server/src/routes/transactions.ts` (~1070), `client/src/pages/Household.tsx` (~1600), `client/src/pages/Budget.tsx` (~1470), `client/src/pages/CashFlow.tsx` (~1330), `client/src/types/index.ts` (~1250).
- Files: as listed above
- Impact: Changes to one concern (for example a household rule) are easy to miss in the rest of the same file. Review diffs grow large, which the review guidelines treat as a reason to hide real changes.
- Fix approach: Split by responsibility when touching these files next: schema by domain into re-exported modules, household rules into pure helpers beside `householdService.ts`, MCP tool definitions out of the router. Do this as its own PR, not inside a feature change.

**Demo and seed data maintained by hand alongside the real schema:**
- Issue: `server/src/demo/demoBudget.ts` (~1675 lines) and `server/src/db/seed-rich.ts` (~1730 lines) are hand-written fixtures that must track every schema and behaviour change.
- Files: `server/src/demo/demoBudget.ts`, `server/src/db/seed-rich.ts`, `server/src/demo/logos.ts`
- Impact: Schema changes that do not reach the demo budget or the rich seed silently leave the demo wrong. The demo is served by the in-browser worker, so it drifts without failing server tests.
- Fix approach: Add a test that loads the demo budget through the migrations and checks every new column or table is represented or explicitly skipped. Keep `logos.ts` (large inline base64 data URIs) out of routine diffs.

**Lint warning budget is a ceiling, not a target:**
- Issue: `lint/package.json` runs ESLint with `--max-warnings=128` over `client/src` and `server/src`. The cap is the only guard against new warnings.
- Files: `lint/package.json`
- Impact: Warnings can accumulate up to the cap without anyone triaging them.
- Fix approach: Lower the cap whenever warnings are removed, and triage the remaining ones by rule.

**Type escapes and lint suppressions in product code:**
- Issue: About 14 `eslint-disable` / `@ts-ignore` comments and 3 `as any` casts remain in non-test code. Most are in client pages and components, for example `client/src/pages/Budget.tsx`, `client/src/pages/Files.tsx`, `client/src/hooks/useTax.ts`, `client/src/components/receipts/ReceiptEditor.tsx`, `client/src/components/transactions/YnabImportModal.tsx`.
- Files: the files above; find the rest with `grep -rn "eslint-disable\|@ts-ignore\|as any" client/src server/src`
- Impact: Type errors in these spots will not surface at compile time.
- Fix approach: Require a reason on each suppression line (the review guidelines already do) and replace the `as any` casts with narrowed types.

**Parallel console and error-handling patterns:**
- Issue: About 9 server source files call `console.log` directly rather than a shared logger, and error handling varies by file.
- Files: grep `console.log` under `server/src`
- Impact: Inconsistent log shape makes it harder to trace bank sync failures.
- Fix approach: Route server logging through one helper; keep details server-side and generic JSON to the client, as the review guidelines require.

**Stray and duplicated documentation at repo root:**
- Issue: The root has a stray `monarch-rea-inspection-status.md` and several overlapping docs (`PLANNING.md`, `DESIGN.md`, `DESKTOP-SERVER.md`, `PRODUCT.md`) alongside `docs/`. An untracked `skills/` directory is also present in the working tree.
- Files: `monarch-rea-inspection-status.md`, `PLANNING.md`, `DESIGN.md`, `DESKTOP-SERVER.md`, `PRODUCT.md`, `skills/`
- Impact: Readers may follow stale guidance. The untracked directory risks an accidental commit.
- Fix approach: Move or delete the stray file, decide which root doc is canonical and link the others to it, and gitignore or commit `skills/` deliberately.

## Known Bugs

**Silent failure in first-run password setup masks non-duplicate errors:**
- Symptoms: `setInitialPassword` returns `false` for any database error, not only the primary-key conflict it is meant to detect. A real write failure is reported to the caller as "password already set".
- Files: `server/src/auth/sessions.ts`
- Trigger: Any insert failure during setup (for example a locked or unwritable database file).
- Workaround: Check the database file and logs manually.

**Plaid revocation swallows decryption failures:**
- Symptoms: If a stored Plaid credential cannot be decrypted, the catch block in the disconnect path does nothing and the access token is never revoked upstream. The owner sees a successful disconnect.
- Files: `server/src/routes/plaid.ts` (around the disconnect handler, the `catch {}` after the `plaidItems` select)
- Trigger: Encryption key lost or changed while a Plaid item is connected.
- Workaround: Revoke the item in the Plaid dashboard.

**Broad `catch (err: any)` in Plaid routes:**
- Symptoms: Errors from Plaid calls are caught as `any`, so the shape of a failure (bank error vs server bug) is not checked before it is mapped to a response.
- Files: `server/src/routes/plaid.ts` (around lines 180, 198, 222)
- Trigger: Any upstream Plaid error.
- Workaround: None; check server logs.

## Security Considerations

**Bank credentials are stored unencrypted when no key is configured:**
- Risk: `server/src/db/secretCrypto.ts` encrypts bank credentials (AES-256-GCM) only when a key is supplied. Without one, values are stored as plain text (described in the file as the plain `npm run dev` path).
- Files: `server/src/db/secretCrypto.ts`, `server/src/db/schema.ts` (`encryptedText` column type)
- Current mitigation: The desktop app supplies the key; the key file path and env variable are read once at startup. Tokens are excluded from exports.
- Recommendations: Confirm which deployment modes (Docker, Home Assistant wrapper, plain server) set the key. Refuse to store bank credentials when the server is not in dev mode and no key is present, or show a visible warning in Settings. This was not verified end to end in this pass.

**Container runs as a non-root user but the key/option handling depends on startup order:**
- Risk: The Home Assistant options file is root-only and must be read before dropping to uid 1000 (see `CLAUDE.md` safety rules). A change to the entry script that reorders this would expose or break options.
- Files: `homeassistant/` wrapper scripts, `Dockerfile` (`USER node` directive)
- Current mitigation: Container smoke test (`homeassistant/smoke-test.cjs`) runs against the built image.
- Recommendations: Keep the smoke test as the gate for any change to the entry script; add an assertion that the options file is not readable by uid 1000.

**Rate limits depend on the proxy configuration:**
- Risk: Auth and forgot-password limits use `express-rate-limit` keyed by IP (`ipKeyGenerator`). If the server sits behind a reverse proxy without a trusted-proxy setting, all clients share one key and the limit either locks everyone out or is ineffective.
- Files: `server/src/routes/auth.ts` (`authRateLimit`, `forgotRateLimit`), `server/src/gateway/app.ts`, `server/src/middleware/security.ts` (`bankRateLimit`, `bankCallbackRateLimit`), `server/src/routes/mcp.ts` (MCP limit of 300 per minute)
- Current mitigation: `ipKeyGenerator` is used; limits are per route.
- Recommendations: Document the trust-proxy requirement for each deployment and test it.

**Single owner password and single Up token:**
- Risk: One password and one Up token protect the whole budget; there is no per-user separation.
- Files: `server/src/auth/sessions.ts`, `server/src/auth/accessTokens.ts`
- Current mitigation: Read-only access tokens reach only an allowlisted set of GET routes plus MCP; writes go through `/api/assistant/do` and its policy table (`server/src/auth/assistantPolicy.ts`).
- Recommendations: Keep every new route out of the token allowlist unless it is in the policy table with a test for the allowed case and the nearest refusal.

## Performance Bottlenecks

**Forecast and reporting computed in request handlers:**
- Problem: Long-term forecast and report routes do heavy computation synchronously.
- Files: `server/src/services/longTermForecast.ts`, `server/src/routes/reports.ts` (about 980 lines), `client/src/components/forecast/CashRunway.tsx`
- Cause: Work scales with transaction history and runs in the request path.
- Improvement path: Bound the date range per request, cache per budget version, and move any batch work out of the handler. Check queries for N+1 patterns when touching these files.

**Large transactions table queries:**
- Problem: Transaction lists and reports scan the transactions table.
- Files: `server/src/routes/transactions.ts`, `server/src/db/schema.ts` (index definitions)
- Cause: Index coverage for every filter combination was not verified in this pass.
- Improvement path: Confirm indexes for each new filter; add paging caps where missing.

## Fragile Areas

**Household and payment-envelope rules:**
- Files: `server/src/services/householdService.ts`, `server/src/services/paymentPlanService.ts`, `server/src/services/fundingPlan.ts`
- Why fragile: Shared-account balances, pool accounts, contributions and settlements interact; the rules are spread across several services and the household page.
- Safe modification: Route every change through the shared helpers, in one DB transaction when several rows change. Read the callers listed in the review guidelines before editing.
- Test coverage: Tests exist beside these services (`*.test.ts`), but not every household correction path is covered.

**Up sync and deleted-import memory:**
- Files: `server/src/services/upSyncService.ts`, `server/src/services/upTransactions.ts`, `server/src/services/upCategoryMap.ts`
- Why fragile: Stable IDs prevent duplicates and `deletedImportIds` keeps owner deletions; a change to ID generation would re-import or duplicate rows.
- Safe modification: Add a test that re-runs a sync and asserts zero new rows, and one that asserts an owner-deleted import stays deleted.

**Migration chain:**
- Files: `server/src/db/migrations/` (90 entries, last `0088_household_include_bills.sql`), `server/src/db/schema.ts`
- Why fragile: Migrations are additive and ordered by `_journal.json`; a wrong `when` or `idx` makes drizzle skip an entry silently.
- Safe modification: Follow the journal rules in the review guidelines and test on a populated database as well as an empty one (`loanDetails.test.ts` shows the pattern).

**Money handling outside the shared helpers:**
- Files: 93 uses of `Number(` or `parseFloat(` across `server/src/services` (not all are money paths; verify each)
- Why fragile: The rule is integer minor units. A single float conversion on an amount breaks reconciliation.
- Safe modification: Grep the amount paths first, and use `server/src/utils/money.ts` for parsing.

## Scaling Limits

**Single-process SQLite:**
- Current capacity: One SQLite file per budget, one server process.
- Limit: Concurrent heavy writes (bulk import, sync, restore) contend in one process; multi-user is not supported.
- Scaling path: Keep the gateway as the only multi-user path; consider a separate import worker if imports grow.

**Backup size:**
- Current capacity: Restore parses a larger body after the login check; ordinary request bodies are capped (413 otherwise).
- Limit: Very large backups hit memory limits during restore.
- Scaling path: Stream archive entries instead of parsing whole bodies.

## Dependencies at Risk

**Community-supported bank connectors:**
- Risk: Plaid, SimpleFIN and Enable Banking are not tested against a real bank each release (per `MAINTENANCE.md`).
- Files: `server/src/routes/plaid.ts`, `server/src/services/enableBankingSyncService.ts`, SimpleFIN code under `server/src`
- Impact: Upstream API changes can break these silently.
- Migration plan: Bring them to the Up safeguards (stable IDs, deleted-import memory, reconciled-row protection) before relying on them.

**Electron-coupled packages:**
- Risk: Native or Electron-coupled packages must not be bundled into routine dependency updates (per the review guidelines).
- Files: `package.json`, `electron-builder.json`, `electron/`
- Impact: A routine update can break desktop packaging.
- Migration plan: Update these separately with a packaging check.

## Missing Critical Features

**Desktop offline merge:**
- Problem: Remote desktop budgets need the server to be reachable; there is no full offline merge.
- Blocks: Working away from home without a connection to the server.

**Multi-user separation:**
- Problem: One owner password and one Up token per budget.
- Blocks: Sharing a budget with separate logins and per-user audit.

## Test Coverage Gaps

**Demo budget versus real server:**
- What's not tested: Whether the in-browser demo worker matches the real server for every route it shadows.
- Files: `server/src/browser/app.ts`, `server/src/demo/demoBudget.ts`
- Risk: Demo behaviour diverges silently from the server.
- Priority: Medium

**Sibling import paths:**
- What's not tested: Each rule (reconciled-row protection, transfer suggestion, stable IDs) across CSV import, backup restore, and each bank sync.
- Files: `server/src/services/` (sync and import services), `e2e/tests/up.spec.ts`
- Risk: A fix on one path does not hold on the others.
- Priority: High

**Skipped or deleted-import edge cases:**
- What's not tested: Owner-deleted imports across Plaid, SimpleFIN and Enable Banking (the audit shared the memory only from up.100).
- Files: `server/src/services/enableBankingSyncService.ts`, Plaid and SimpleFIN routes
- Risk: A deleted bank row reappears after a sync.
- Priority: High

**Unverified in this pass:**
- Encryption-key configuration per deployment mode, trust-proxy setting for rate limits, and index coverage were not verified by running the code. Confirm before acting on the related items above.

---

*Concerns audit: 2026-11-13*
