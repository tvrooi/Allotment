# Handover: where this fork stands and where to pick up

Read this after [CLAUDE.md](CLAUDE.md) (rules and checks). Keep it current: update the
**State** and **Open items** sections whenever a PR, release or live update changes them.
This file contains no credentials, hostnames or IP addresses, and must never contain them.
Keep those private, outside the repository.

Last updated: 31 October 2026.

## State

- **Pay later / Afterpay (up.67):** a buy-now-pay-later purchase is recorded once in its real category on an Afterpay credit account, and the bank's instalments are linked as transfers only when the owner confirms them (`docs/PAYMENT-PLANS.md`, user guide `website/docs/pay-later.mdx`). Migration 0057 (`payment_plans`, `payment_plan_instalments`, `payment_plan_dismissals`), backup version 21. `services/paymentPlanService.ts` (create/link/unlink/refund/fee/remove, `findPaymentMatches`, `historyGroups` for earlier payments, `expectedInstalments` merged into `expectedDebits.ts`), `routes/paymentPlans.ts` at `/api/payment-plans`, `cardFundingSetup.setupEmptyCardFunding` (no-review setup for a new empty account), `transferToAccount(..., { createNew })`. Client: `pages/PaymentPlans.tsx` ("Pay later" in the sidebar), `components/plans/`, matches also on Review. The AU template no longer seeds "Afterpay / Zip". Owner decisions: confirm every link (no auto-linking), reconciled rows are skipped, one Afterpay account for all plans, earlier payments default to 12 months. Not built: Pay Monthly, token access to plans.
- **Household follow-ups (up.66):** migration 0056 adds `household_recurring_bills.split_json` (a bill's own split; null = default) and `auto_share_from` (null = off). `householdService`: `checkSplit` (shared with the default-split route), `updateRecurringBill` (`PUT /households/:id/recurring-bills/:scheduleId` with `split`/`autoShare`), `shareBillPayments` (`POST …/recurring-bills/:scheduleId/share`), `autoShareBillPayment` (called from `ruleService.insertNewTransaction` for unsplit rows a rule didn't share; payee match, money out, date ≥ `auto_share_from`, never throws), `addPerson`/`renamePerson` (`POST /households/:id/people`, `PUT …/people/:personId`; names unique ignoring case), `editBill`/`deleteBill` (`PUT`/`DELETE /households/:id/bills/:billId`; amounts locked and delete refused once an expense is matched). Client `components/household/SplitEditor.tsx` (also used by Household settings). Not built: removing people.
- **Household recurring bills (up.65):** schedules can be shared with a household (`household_recurring_bills`, migration 0055, backup version 20). `householdService.sharedRecurringBills` adds `recurringBills` to `GET /households/:id` (next pending occurrence, default-split preview, payments in the last 180 days matched to the schedule or by its payee, each flagged shared); `POST /households/:id/recurring-bills` and `DELETE …/recurring-bills/:scheduleId`. Sharing a payment is still the explicit `POST /share`. Client `components/household/RecurringBills.tsx`; the Household page was reordered (balances, recurring bills, statement, collapsed "Record something else", pool-only "Bills to reserve for", history, settings) and loads at most 500 recent payments only while the form is open. Per-bill splits, automatic sharing, bill editing and people came in up.66.
- **HA release stall fixed (up.64):** `homeassistant/package.py` used to strip `--platform=$BUILDPLATFORM`, so the ARM64 image compiled the client under QEMU and the publish step stalled (up.57, up.60, up.63). The build stage now runs natively; PR runs build both architectures without pushing. `v0.2.0-up.63` was tagged but its release was cancelled after the stall, so it is not published; up.64 carries the rebrand.
- **Allotment rebrand (up.63):** the owner detached the fork from `dtymoszenko/FlyBudget` and renamed the repository `tvrooi/Allotment` on 30 October (GitHub redirects the old address). The app is now called Allotment: name, icon, Marigold/Soil/Canvas palette and tagline (`docs/BRAND.md`). Stored identifiers keep `flybudget` (env vars, cookies, data paths, HA slug `flybudget_up`, image names, the packaged desktop app's internal name via `app.setName` in `electron/main.ts`). Desktop apps before up.63 cannot find updates after the move and need one manual install. Follow-ups: the `tvrooi/home-assistant-apps` catalog's own text still says FlyBudget, and the user-guide links still go to the upstream flybudget.org site.
- **Balance integrity (up.53):** reconciliation is atomic and rejects adjustments from partial or stale selections. Known bank mismatches and residual balances in closed budget accounts block new funding; Settings exposes closed balances for explicit reconciliation. Bank-fed income is never auto-created a second time. Existing ledger rows are preserved. See docs/ENVELOPE-FUNDING.md, “Balance checks and reconciliation”.
- **Payee logos (up.54, up.55):** an organise token may set or replace a payee's logo, never remove one (docs/READ-ONLY-ACCESS.md). On 29 October an assistant added brand icons to 188 business payees and swapped 44 of them for cleaner theSVG brand icons (rendered to PNG); about 270 small or overseas businesses still show initials.
- **Expected recurring debits (up.56):** the Budget page shows each expense category's unpaid recurring bills for the month in orange (`server/src/services/expectedDebits.ts`, attached by `GET /api/budget/:month`; `client/src/components/budget/ExpectedNote.tsx`). A projection only; it never writes occurrences or ledger rows.
- **Safe mode (up.57):** a session-only screen privacy toggle (eye button, Alt+Shift+H, Settings → Preferences). `client/src/utils/safeMode.ts` and `store/safeModeStore.ts` hold the rules; `components/ui/Private.tsx` (`Private`, `PrivateChart`, `PrivateSection`) wraps balance displays, and the **All amounts** level masks in `formatAmount`/`formatAxisAmount`, and `App` subscribes so every page re-renders in place (no remount; a `useMemo` that formats amounts needs the level in its deps). New balance displays must use `Private`; `e2e/tests/safe-mode.spec.ts` checks no figure reaches the page. Not access control.
- **Combined households (up.58):** two people in multi-user mode can combine a household each keeps (`server/src/gateway/sharing.ts`, `docs/HOUSEHOLDS.md` "Combining with another person"). The gateway merges both budgets' `GET /api/households/:id/shared-export` live; links and shared notes are in `people.db` (`household_links`, `household_notes`). Each person edits only their own entries; the note is shared. Not built: shared bills, receipts, or a combined view in single-user mode.
- **Categorised first import (up.59):** Up's own category slug on each new row is a last-resort suggestion (`services/upCategoryMap.ts`; `fallbackCategoryId` in `ruleService.insertNewTransaction`, after rules and the payee default; never for existing rows, transfers or income). `services/importTidy.ts` adds `GET /api/reports/uncategorised-summary` (share of spending with no category) and `GET /api/reports/salary` (repeating pay guess, 7/14/28-31 days). The client sorts by payee with `hooks/useCategorisePayee.ts` (payee default plus bulk edit, one undo step) in `components/review/SortUncategorised.tsx` (Up connect step, dashboard Get started, payday plan "This is pay"). Forecast and Reports show `UncategorisedBanner` above 5%. The Up mock has a `/__mock/rich` mode (`server/src/test/upRichData.ts`).
- **Recover from mistakes (up.60):** `paydayService.undoPayday` reverses a funding (history in `payday_funding_undos`; takes back at most what each category is still assigned); `reconciliationService` records each reconciliation (`account_reconciliations`) for `undoLastReconciliation`, and `unlockTransaction`; `PUT /transactions/:id` lets a reconciled row change category, payee and notes only; `BudgetError.details` carries `accountIssues` to the Budget error (`AssignBlockError`); `accounts` list has `bankLinked` for the Add-transaction Cash prompt; single-user password reset (`auth/resetCode.ts`, `auth/resetNotify.ts`, `/api/auth/forgot` and `/reset`, in-memory code, 24 h, HA persistent notification); `transactionEdits.bulkDelete` and `accountDeletion.ts` (typed confirmation, no undo).
- **First-week polish (up.61):** phone Reconcile/Budget header/tab-bar fixes, "Not categorised yet" filter, Safe mode default `All amounts` (`safeModeLevelChosen` keeps explicit choices; preferences v3), host-aware setup/reset-code hint (`hostKind` in `/auth/status`, `FLYBUDGET_HOST_KIND` set by `ha-launch.cjs`; `client/src/utils/hostKind.ts`), picker keyboard, Last month preset, pre-start months show real Activity read-only (`services/historicActivity.ts`), "Put the rest in…", stricter recurring finder (`scheduleDiscovery.ts`, `isNotABill`), `HelpTip`/`ScrollCue` components. New budgets name the default category "Other".
- **Switchers (up.62):** Up can link to a non-empty AUD account from a cut-over date (`up_account_mappings.cutover_date`/`cutover_difference`, `services/upCutover.ts`, sync filters rows before it, never changes existing rows, no opening-balance row; overlap candidates get `up_source_records.review_state = 'overlap'` + `overlap_transaction_id`, listed in `UpReview`, `POST /up/review/overlap/delete-old` refuses reconciled rows; tests `routes/upCutover.test.ts`). CSV import has Category/Category group roles with a mapping step (`ImportCategories.tsx`; rows carry `categoryId`, `keepUserCategory`), a YNAB register importer (`YnabImportModal.tsx`; accounts + categories), `accounts.balance_as_of` keeps a typed "balance as of today" through older imports (`/transactions/import/confirm`, `routes/importSwitchers.test.ts`), the register jumps to the imported dates. e2e `switchers.spec.ts`. Not built: YNAB plan export (assigned amounts); transfer detection in YNAB files.
- **Multi-user on live (29 October):** `multi_user` turned on after a full cold HA backup ("Before FlyBudget multi_user on", which includes the app). The gateway started healthy and printed a setup code in the app's Log. The owner still has to sign in with that code to claim the existing budget as administrator, then add their partner from Settings → Server → People.
- **Live:** `0.2.0-up.67` (Pay later / Afterpay) installed on 31 October around 21:35 local time on the catalog app `24ff2149_flybudget_up` (source commit `76296b9`). Before it: an app-only cold backup (`eede7265`, "Before Allotment 0.2.0-up.67", app at up.66, no failed apps). The hourly catalog sync had already promoted the release, so the backup was taken before Home Assistant's store saw it (the app has auto-update on); then the store was reloaded and the app updated in place. Options unchanged; it started with "Allotment multi-user gateway on port 3001: 2 budget(s) running" and the same two budget IDs, no errors. Migration 0057 runs on each budget's start. Budget access and the new **Pay later** page are for the owner to confirm in the app. Earlier: up.66 (31 October, backup `285cc1e6`), up.65 (30 October, backup `60d27495`), up.64 (backups `a56b814d`, `c183d5ce`), up.62, up.61 and up.59.

- **Live Home Assistant app:** installed from the catalog repository (not the old `local_flybudget_up`), with **Auto update on**. It ran `0.2.0-up.67` on 31 October; confirm the installed app identity and version before updating.
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
| Afterpay and other pay-later plans: real-category purchases, confirmed instalment links         | #92 / up.67     | `docs/PAYMENT-PLANS.md`                                            | `paymentPlanService.ts`, `routes/paymentPlans.ts`, `client/src/components/plans/`                     |

The user guide for receipts and tax is in `website/docs/tax.mdx`.

## Owner's live setup (non-secret facts)

- **Hardware:** Home Assistant OS on an x86-64 mini PC with an Intel Alder Lake-N (N100-class) CPU
  and 16 GB RAM. About 4.6 GiB is in normal use; Frigate is the largest user and takes a lot of CPU.
- **Ollama app** (community repository): Allotment reaches it on Home Assistant's internal network
  at the hostname shown in the Ollama app's documentation, `http://<app-hostname>:11434`. Keep the
  actual address out of the repository. The model for receipts is `qwen3-vl:4b-instruct`. The
  plain `qwen3-vl:4b` tag is a thinking variant, slower on a CPU; it is also installed, using about
  3.3 GB, and can be removed if the owner agrees.
  - `OLLAMA_KV_CACHE_TYPE` was changed from `q8_0` to `f16`: `q8_0` with flash attention off stopped
    any model loading.
  - Recommended to the owner but not confirmed as applied: `OLLAMA_KEEP_ALIVE` 300 (it was −1),
    `OLLAMA_CONTEXT_LENGTH` 8192, `OLLAMA_NO_CLOUD` on. Allotment sends `keep_alive` and `num_ctx`
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
  - The Allotment app has no ingress and its own password, so a session cannot call Allotment through
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
   is to clear the app's 11434 port mapping, since Allotment uses the internal address. Do that only
   after checking that Home Assistant's Ollama integration uses the internal address too.
3. **Multi-user (separate budgets per person):** built in `0.2.0-up.48` (`server/src/gateway/`,
   `docs/MULTI-USER-PLAN.md`, `homeassistant/DOCS.md`) and turned on live on 29 October (see
   State). Confirm the owner has signed in with the setup code and their budget opened with its
   data, Up sync and access tokens intact. Not built yet: SMTP email codes. Shared households
   are combined households (up.58).
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
