# Handover: where this fork stands and where to pick up

Read this after [CLAUDE.md](CLAUDE.md) (rules and checks). It is kept short: update **State** and
**Open items** whenever a PR, release or live update changes them, and move superseded detail to
[docs/handover/ARCHIVE.md](docs/handover/ARCHIVE.md) (history: grep it, do not read it whole).
UI sessions start at [docs/ui/README.md](docs/ui/README.md) instead.
This file contains no credentials, hostnames or IP addresses, and must never contain them.
Keep those private, outside the repository.

Last updated: 12 November 2026 (design re-review waves on `redesign`; see `docs/ui/WAVES.md`).

## State

- **Released:** the newest tag is `v0.2.0-up.153`; `main` carries the pre-redesign app.
- **Live:** `0.2.0-up.149` on the catalog app `24ff2149_flybudget_up` since 9 November 2026, auto update on.
- **Unreleased on `redesign`:** up.154 to up.169 are prepared (versions and CHANGELOG entries) but not tagged.
  The owner has not yet decided how `redesign` is released; do not tag or publish until they do.
- Design re-review waves (issues #222 to #245) are in progress on `redesign`: status, open PRs and
  the routine are in `docs/ui/WAVES.md`.
- `redesign` holds the design passes: Budget (up.154), Dashboard (up.154, made the Dashboard in up.166).
- Also on `redesign`: Transactions money clarity and iPhone web-app hardening (up.155), Review (up.156 to up.160).
- Also on `redesign`: Accounts (up.161 to up.163), day-first dates and Household (up.164), Forecast (up.165), Goals, Investments.
- PR #209 (Budget design onto `main`) was closed unmerged; `redesign` is reconciled with `main` later.
- Budgeting review Phase 1 is built (up.152); Phase 2 (goal summaries, merged goal and target, one expected-income source) is next.
- D4a working from home is built (up.144); D4b, the car, is next (`docs/TAX-CAR-AND-HOME.md`).
- Design record: `DESIGN.md` and `PRODUCT.md`; tokens live in `client/src/index.css` `@theme`.
- UI backlog: GitHub issues titled `ui(<screen>): ...`; current session notes in `docs/ui/HANDOVER-UI.md`.
- Full feature history, live update log and the "Recent features" table: [docs/handover/ARCHIVE.md](docs/handover/ARCHIVE.md).

## Owner's live setup (non-secret facts)

- **Hardware:** Home Assistant OS on an x86-64 mini PC with an Intel Alder Lake-N (N100-class) CPU
  and 16 GB RAM. About 4.6 GiB is in normal use; Frigate is the largest user and takes a lot of CPU.
- **Receipt reading:** the owner chooses the provider in Allotment (up.98). A local model on this
  CPU took 2–4 minutes a photo, so a cloud provider with the owner's own key is the suggested choice.

## Tools another session will have

- **GitHub:** the `mcp__github__*` tools. Codex reviews when you comment `@codex review`. Verify each
  finding, fix it with a test that fails on the old code, reply on the thread before pushing, then
  resolve the thread.
- **Home Assistant:** the owner's "HASS via Cloudfared" connector (ha-mcp) can read entities and
  history, list apps with memory and CPU statistics, read app logs, change app options, restart apps,
  proxy app APIs and create backups (`ha_manage_backup`).
  - It stops every request after 30 s, so long app API calls time out there.
  - The Allotment app has no ingress and its own password, so a session cannot call Allotment through
    the connector. The owner tests it in the app, for example with **Try a sample receipt**.
- **Local browser tests:** Chromium is under `/opt/pw-browsers/` (see Gotchas for the build
  number). Point Playwright at it with `E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium-<build>/chrome-linux64/chrome`
  (read by `e2e/playwright.config.ts`; nothing to create or exclude). Without `E2E_SKIP_BUILD`
  the run builds the client itself, so it never uses a stale build.

## Open items (pick up here)

The full wording of each item, as of 10 November 2026, is in the archive under "Open items".

0. After release, zero the live household through **Reconcile balances** once the owner confirms
   the preview, and set up Essentials' own Ready to assign.
1. After each release confirm the live app: installed identity, version, health and that the budget
   opens. Auto update is on: take the cold backup before the store sees a new release.
2. Multi-user: confirm the owner signed in with the setup code and the budget kept its data, Up sync
   and tokens. Email codes need the owner's `smtp_` options.
3. Larger features: D4b car expenses next; Budgeting review Phase 2; reconcile `redesign` with `main`.
4. Depreciating assets and Files: ask the owner to try them on real records (archive items 7 and 8).
5. Household partner links (`docs/HOUSEHOLD-PARTNER-LINKS.md`): decisions 4, 5, 7, 8 and 9 open; no code.
6. UI items: GitHub issues listed in `docs/ui/HANDOVER-UI.md`.

## Gotchas learned the hard way

- After a squash merge, start new work from a fresh branch off `origin/main`.
- A bulk rewrite of UI text (casing, renaming a term) also hits strings the code compares. In up.105
  a sentence-case pass changed `Property Tax`, `HOA Fees`, `Home Maintenance` and `Bank Fees` in
  `RentOrOwn.tsx` and `PlanCard.tsx`; they are stored category names matched exactly. A server test
  (`defaultCategories.test.ts`) now checks both lookups against the seed. After any such pass, search
  for the old text in `server/src` and the tests too: it found three server tests that matched the
  old "Insufficient unassigned money" message, and case-sensitive regexes in e2e.
- CI type-checks `e2e/` (`cd e2e && npx tsc --noEmit`) before any shard runs, and runs the whole
  server suite. A Playwright run alone catches neither, so run both before pushing a test change.
- Playwright matches names case-insensitively and by substring unless `exact: true` or a regex is
  used. Making two labels identical (for example "Net worth" as a widget title and a summary label)
  can turn a passing `getByText(..., { exact: true })` into a strict-mode violation.
- `E2E_SKIP_BUILD=1` reuses the client built by the last run, so after changing UI text run once
  without it.
- **CI passed** reports _failure_ when a newer push cancels a run. Check the jobs: a `cancelled` e2e
  job on a superseded commit is not a real failure.
- CI's e2e runs as four shards, `e2e (1/4)` … `e2e (4/4)`, split by file. Reproduce a failure
  locally with `npm test -- --shard=N/4` in `e2e/`. Artifacts are `playwright-report-N` and
  `phone-screenshots-N`. Branch protection requires only **CI passed**, which covers all shards.
- Backups: a new table needs `BACKUP_VERSION` bumped and the table added to `backupService.ts`
  (`TABLES` and the imports), and every test asserting the version updated, including
  `e2e/tests/data.spec.ts` and `e2e/tests/demo/category-goals.spec.ts`. New columns on existing
  tables do not need a bump.
- The in-browser demo runs server code in the browser: code it imports must not use `node:crypto`,
  and `/receipts` routes are stubbed there (`server/src/browser/app.ts`).
- In e2e, `fill()` on a money input appends to what is there. Call `clear()` first. Money inputs show
  values such as `$2`, not `2.00`. `api.transactions()` nests split parts under `parent.children`.
- The receipt editor is keyed on `id:updatedAt`, so state that must survive a save, such as messages
  and errors, lives above it. Any change to what the editor shows, line items included, must advance
  `updatedAt`.
- Controlled checkboxes that save to the server need local, optimistic state, or the click doesn't
  register until the reply arrives.
- Saves refresh the ledger views through the global `MutationCache.onSuccess` (`main.tsx`,
  `utils/ledgerViews.ts`). Code that calls an API function directly instead of through a mutation
  (as `FreshStartNote` and `AssignBlockError` do) must call `invalidateLedgerViews(qc)` itself.
- Local e2e: Playwright 1.64 expects Chromium build 1248, but the cloud container has 1243 at
  `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. Set `E2E_CHROMIUM_PATH` to it (see Tools).
  Kill leftover servers on ports 3171–3180 after
  an aborted run, or the next global setup fails with "No setup code in the server log".
- Global rules in `client/src/index.css` belong in an `@layer` (usually `base`). Unlayered CSS beats
  every Tailwind utility whatever its specificity: the unlayered `* { scrollbar-width: thin }` kept
  `ScrollCue`'s `[scrollbar-width:none]` from applying until up.75.

History: [docs/handover/ARCHIVE.md](docs/handover/ARCHIVE.md).
