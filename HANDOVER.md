# Handover: where this fork stands and where to pick up

Read this after [CLAUDE.md](CLAUDE.md) (rules and checks). Keep it current: update the
**State** and **Open items** sections whenever a PR, release or live update changes them.
This file contains no credentials, hostnames or IP addresses, and must never contain them.
Keep those private, outside the repository.

Last updated: 28 October 2026.

## State

- **Balance integrity (up.53):** reconciliation is atomic and rejects adjustments from partial or stale selections. Known bank mismatches and residual balances in closed budget accounts block new funding; Settings exposes closed balances for explicit reconciliation. Bank-fed income is never auto-created a second time. Existing ledger rows are preserved. See docs/ENVELOPE-FUNDING.md, “Balance checks and reconciliation”.
- The connected budget server reported **up.51 on 28 October**. Publication of up.53 and a verified live update are separate steps. Before installation, verify app identity and obtain a cold backup with the encryption key; a JSON export alone is insufficient.

- **Last verified published release at preparation:** `v0.2.0-up.51`. The balance-integrity fix targets `v0.2.0-up.53`; verify completion on the [GitHub Releases](https://github.com/tvrooi/FlyBudget/releases) page before installation. Overspending resets and signed-envelope Ready to Assign from earlier releases remain unchanged.

- **Live Home Assistant app:** installed from the catalog repository (not the old `local_flybudget_up`), with **Auto update on**. The connected server reported `0.2.0-up.51` on 28 October; confirm the installed app identity and version before updating.
  A completed release reaches it through the catalog sync (MAINTENANCE.md, step 5) and then its
  auto-update. Before relying on that, verify the installed version afterwards, and take a cold
  backup first when you update it by hand.

## Recent features, and where they are documented

| Feature                                                                                         | PR / version    | Design doc                                                         | Main code                                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Australian super: preserved vs accessible wealth, preservation age                              | #52 / up.40     | `docs/INVESTMENTS.md`, `docs/LONG-TERM-FORECAST.md`                | `server/src/services/` forecast and investment services                                               |
| HECS-HELP and Student Start-up Loan: CPI indexation, compulsory repayment bands, extra payments | #53 / up.41     | `docs/LONG-TERM-FORECAST.md`, `docs/FORECASTS.md`                  | forecast services and the debt UI                                                                     |
| Receipts, receipt inbox, tax deductions (ATO labels, FY exports)                                | #54 / up.42     | `docs/RECEIPTS-AND-TAX.md` §1–4                                    | `receiptService.ts`, `taxService.ts`, `routes/receipts.ts`, `routes/tax.ts`                           |
| Receipts tab (Monarch parity): matching, autosplit, Split by items                              | #55 / up.43     | `docs/RECEIPTS-AND-TAX.md` §5                                      | `receiptMatching.ts`, `client/src/components/receipts/`                                               |
| Reading receipts with local Ollama                                                              | #56 / up.44     | `docs/RECEIPTS-AND-TAX.md` §5, "Reading photos with a local model" | `receiptReader.ts`, `receiptSample.ts`                                                                |
| Overspending resets each month (YNAB), card funding month by month                              | #57 / up.45     | `docs/ENVELOPE-FUNDING.md`, `docs/CARD-PAYMENTS.md`                | `budgetService.ts` (`rollOver`), `cardFunding.ts`                                                     |
| Ready to assign follows YNAB: signed envelopes, cash vs credit overspending, month-aware guard  | #61 / up.47     | `docs/ENVELOPE-FUNDING.md` (Ready to Assign)                       | `budgetService.ts` (`fundingState`), `budgetMoves.ts` (`fundedWrite`), `readyToAssign.test.ts`        |
| Envelopes funded by transfers to a linked account (Rent → Rent saver)                           | this PR / up.52 | `docs/ENVELOPE-FUNDING.md` (Envelopes linked to an account)        | `budgetLedger.ts` (`linkedTransfers`), `routes/categories.ts` (`linkError`), `linkedEnvelope.test.ts` |

The user guide for receipts and tax is in `website/docs/tax.mdx`.

## Owner's live setup (non-secret facts)

- **Hardware:** Home Assistant OS on an x86-64 mini PC with an Intel Alder Lake-N (N100-class) CPU
  and 16 GB RAM. About 4.6 GiB is in normal use; Frigate is the largest user and takes a lot of CPU.
- **Ollama app** (community repository): FlyBudget reaches it on Home Assistant's internal network
  at the hostname shown in the Ollama app's documentation, `http://<app-hostname>:11434`. Keep the
  actual address out of the repository. The model for receipts is `qwen3-vl:4b-instruct`. The
  plain `qwen3-vl:4b` tag is a thinking variant, slower on a CPU; it is also installed, using about
  3.3 GB, and can be removed if the owner agrees.
  - `OLLAMA_KV_CACHE_TYPE` was changed from `q8_0` to `f16`: `q8_0` with flash attention off stopped
    any model loading.
  - Recommended to the owner but not confirmed as applied: `OLLAMA_KEEP_ALIVE` 300 (it was −1),
    `OLLAMA_CONTEXT_LENGTH` 8192, `OLLAMA_NO_CLOUD` on. FlyBudget sends `keep_alive` and `num_ctx`
    itself either way.
  - Measured: taking in even a small image takes about 75 s on this CPU. Allow 2–4 minutes a photo.
- **Home Assistant's own Ollama integration** uses the same model with "Think before responding"
  off and a keep-alive of 300.

## Tools another session will have

- **GitHub:** the `mcp__github__*` tools. Codex reviews when you comment `@codex review`. Verify each
  finding, fix it with a test that fails on the old code, reply on the thread before pushing, then
  resolve the thread.
- **Home Assistant:** the owner's "HASS via Cloudfared" connector (ha-mcp) can read entities and
  history, list apps with memory and CPU statistics, read app logs, change app options, restart apps,
  proxy app APIs and create backups (`ha_manage_backup`).
  - It stops every request after 30 s. A long Ollama request (downloading a model, reading an image)
    times out there, although an Ollama download resumes if you call it again.
  - The FlyBudget app has no ingress and its own password, so a session cannot call FlyBudget through
    the connector. The owner tests it in the app, for example with **Try a sample receipt**.
- **Local browser tests:** Chromium is at `/opt/pw-browsers/chromium`. Create
  `e2e/playwright.local-browser.config.ts`, which spreads the base config and sets
  `use.launchOptions.executablePath` to that path. It is listed in `.git/info/exclude` and never
  committed. Run `npm run build --prefix client` before e2e, or the tests use a stale build.

## Open items (pick up here)

1. **Confirm the live app reached the latest release** (`0.2.0-up.46` once released): version,
   health, and that the budget opens. In November, check the October deficits no longer carry.
   Ask the owner to press **Try a sample receipt** with `qwen3-vl:4b-instruct` and report what it
   got right and how long it took.
2. **Security, waiting on the owner's decision:** the Ollama app publishes port 11434 on the host.
   Its log showed requests from public internet addresses, and Ollama has no authentication. The fix
   is to clear the app's 11434 port mapping, since FlyBudget uses the internal address. Do that only
   after checking that Home Assistant's Ollama integration uses the internal address too.
3. **Multi-user (separate budgets per person):** built in `0.2.0-up.48` (`server/src/gateway/`,
   `docs/MULTI-USER-PLAN.md`, `homeassistant/DOCS.md`). Opt-in with the HA option `multi_user`;
   the existing budget stays in place as the administrator's. Not built yet: SMTP email codes,
   shared households across budgets. Before the owner turns it on live: take a cold backup with
   the key, then check the app restarts healthy and the owner can set up with the Log's code.
4. **Gaps found in the 26 October audit** (not built or not documented):
   - User guide pages missing for shipped features: households, payday plans, resilience/budget
     review, card payments, the long-term forecast (super, HECS-HELP) and Move money.
   - YNAB budget backlog in `docs/research/ynab-flybudget-budget-gaps.md` (PR #41): BUD-02 save
     and undo feedback, BUD-03 availability states, BUD-05 keyboard/expressions, BUD-06 row moves
     and returning money to unassigned, BUD-07 selected-category funding, BUD-09 card rows in the
     table, BUD-10 inspector and notes. BUD-01 fixed in up.46.
   - Transaction detail has no previous/next (Monarch backlog P1).
   - A budget start on a specific day (YNAB's "fresh start" mid-month); today it is a month.
   - Future-month money moves; money age (deliberately not built, see BUDGET-REVIEW.md).
   - Investments deferrals (sales, dividends, franking); receipts §6 (PDF reading, email
     forwarding, logbooks, depreciation, WFH hours).
   - `docs/DEVELOPMENT.md`'s pending legacy cleanup of `recurring_transactions`.
5. **Optional, the owner's call:** remove the unused `qwen3-vl:4b` thinking model; try a larger
   receipt model (`qwen2.5vl:7b`) with **Try a sample receipt** if accuracy matters more than speed.

## Gotchas learned the hard way

- After a squash merge, start new work from a fresh branch off `origin/main`.
- **CI passed** reports _failure_ when a newer push cancels a run. Check the jobs: a `cancelled` e2e
  job on a superseded commit is not a real failure.
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
