# Handover: where this fork stands and where to pick up

Read this after [CLAUDE.md](CLAUDE.md) (rules and checks). Keep it current: update the
**State** and **Open items** sections whenever a PR, release or live update changes them.
This file contains no credentials, hostnames or IP addresses, and must never contain them.
Keep those private, outside the repository.

Last updated: 7 November 2026 (live app on up.129: D2a email codes, D2b reminders; up.140 in review).

## State

- **UI/UX audit (7 November 2026; documentation only):** see [the report](docs/UX-UI-AUDIT.md)
  and [evidence guide](docs/ux-ui-evidence/README.md). Fourteen stable findings, ranked work,
  acceptance criteria and a phased roadmap are ready for implementation. Start with shared
  load/save failure handling, modal focus and whole financial amounts. Review the coverage
  gaps before claiming completion; 176 browser checks passed, one was environment-blocked
  and its following serial check did not run. Product changes land in the follow-up PRs below.
  Preserve finding IDs and update the coverage checklist as follow-up work lands.
  Follow-up PRs in order: A (AU-003, 009, 012, 013; 0.2.0-up.132, merged), B amounts on one
  line (AU-008; 0.2.0-up.133, merged), C modal focus (AU-001; 0.2.0-up.134, merged), D save and delete feedback
  (AU-005/006; 0.2.0-up.135, merged), E load errors
  (AU-004; 0.2.0-up.136, merged), F unsaved drafts (AU-007; 0.2.0-up.137, merged), G tabs (AU-010; 0.2.0-up.138, merged), H report drill-through (AU-014; 0.2.0-up.139, merged), I follow-ups
  (AU-011 yearly budget month anchor; focus after a deleted row; Tax/Transactions tab panels;
  custom report table drill-through; Forecast panel layout; the slow payee delete test; 0.2.0-up.140).
  AU-002 phone Budget order (owner-approved without user validation) is in the same PR. Each finding's heading in the report carries its status.

- **Households, round-ups, Essentials pool and brand icons (up.131; owner-requested 7 November
  2026; migrations 0080 `household_groups.is_default` and 0081 `accounts.assign_pool` +
  `categories.pool_account_id`, both additive, backups carry them with their tables):** the plan in
  `docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md` is built. Cancelled recurring is hidden from
  Monthly and household bills; an edited recurring amount reprices today's occurrence; households
  can be renamed and one made the default; `reconcileBalances` agrees balances with
  `pool_adjustment` / `balance_adjustment` entries (MCP proposal `household.reconcile`);
  `linkRoundUpTransfers` links exactly-reported Up round-up pairs after each sync; `assignPools.ts`
  gives an account its own Ready to Assign. **Live follow-up:** after the release, back up and
  preview the live household's reconciliation with the owner before applying it (zeroing is the
  owner's decision); then turn on Essentials' own Ready to assign with the owner.
- **Recurring bills, shared costs and categories (up.130; owner-requested 7 November 2026; no
  migration, no backup change):** one rule for which recurring items the personal budget plans
  for, `plansInPersonalBudget` with `budgetAccountScope` in `services/balances.ts` (money out of
  an open personal account, spent or moved across the boundary into a household or off-budget
  account), used by `expectedDebits` (which skipped only off-budget accounts, so a household
  account's rent was expected in full in a personal envelope, and skipped every transfer) and
  `billCoverage` (payday). `scheduleScopes` gives a household-account bill not on the household's
  recurring bills list the owner's part of its newest linked expense's shares, scaled with
  `allocateShares` (`latestRecordedSplits`), before the default split.
  `linkOccurrenceToTransaction` (`matchingEngine.ts`) now runs in one DB transaction and fills a
  null category from the schedule (not split parents, adjustments or a transfer unless the
  schedule is one). `housekeeping().uncategorisedRecurring` (Review → Tidy up, MCP
  `budget_housekeeping`). `GET /reports/uncategorised-payees` groups by payee and scope
  (`personal` first, `household` with the household, `off_budget`) and adds `housemate` from
  `housematePayees`; Sort your first import lists `personal` only and doesn't lead with Income
  for housemate money. `repaymentCategoryOffers` also offers your own settlements paid out
  (`direction: 'from_you'`, `personId`): your shares of expenses the recipient paid, categorised
  from a linked payment or, with none, the payee the description names exactly (default
  category, else most used). Tests: `expectedDebits.test.ts`, `scheduleScope.test.ts`,
  `matchingEngine.test.ts` (new), `budgetUx.test.ts`, `routes/uncategorisedPayees.test.ts` (new),
  `routes/householdCategoryOffers.test.ts`, e2e `household-categories.spec.ts` (new). Not done:
  whether a shared bill paid from a personal account should be planned at the owner's share
  rather than in full (payday and expected still plan the full amount, since the owner pays it
  first); a policy guard refusing an Income category for housemate money (only described to
  assistants, since an owner may keep such a category on purpose).
- **Reminders for separate budgets (up.129, D2b of the Larger features group; gateway, budget
  and client; budget migration 0079, additive):** the gateway listens on loopback only
  (`gateway/notifyListener.ts`, `127.0.0.1`, `FLYBUDGET_NOTIFY_PORT`, default one below the first
  budget's port, so 4100) with one route, `POST /notify` `{ title, message }` (Zod `.strict()`,
  title ≤ 100 with no control characters, message ≤ 2,000). Each budget launch gets a fresh
  random notify token (`Budgets`, kept only as a SHA-256 per person, compared in constant time,
  dropped when the budget stops) and `FLYBUDGET_NOTIFY_URL`/`FLYBUDGET_NOTIFY_TOKEN`
  (`processLauncher`). The gateway sends to that person's own confirmed phone or email, as they
  chose (`people.reminder_channel`, additive with its `CHECK`; phone until they choose; the
  other one when the chosen can't be used here; `PUT /api/people/me/reminder-channel`):
  204 when delivered anywhere, 409 nowhere to send, 422 nothing delivered, 401 a missing or
  other token. Password codes and reminders pick destinations through one helper
  (`gateway/delivery.ts`). Budget side: `gatewayNotify` (`gateway/notify.ts`) is the `Notify`
  when `FLYBUDGET_NOTIFY_URL` is a loopback `/notify` URL with a token (`gatewayNotifySettings`);
  `budget_settings.reminders_via_gateway` (0079, default 0, in backups with the other settings)
  turns reminders on, and a single budget ignores it (`reminderService()` in
  `reminderService.ts`). `GET /api/reminders` now also returns `viaGateway` and `enabled`; behind
  the gateway `PUT` takes `{ enabled, showDetails }` only. Settings → Server → Reminders in a
  multi-user budget is **Send reminders** (no service field), with **Include the name and
  amount** and **Send a test**; Password codes gains **Send reminders to** beside **Send codes
  to**. The daytime window, marking after a successful send and generic text are unchanged.
  Tests: `gateway/notifyListener.test.ts` (own person only, 401/400/409/422, choices and
  fallback, nothing but `/notify`, tokens new per launch and gone on stop),
  `gateway/gateway.test.ts` (real budgets: test reminders to Edward's phone and Tristan's email,
  no destination named by a budget, failures, the public port has no `/notify`),
  `services/reminderService.test.ts` (through a fake gateway: off until on, own token, marks
  nothing on 409/422), `routes/reminders.test.ts`, `routes/backup.test.ts` (round trip and an
  older backup), `e2e/tests/multi-user/people.spec.ts` (Send a test arrives by email). The e2e
  mail catcher moved to port 3170, since 3179 is now the gateway's notify port.
- **Email codes for separate budgets (up.128, D2a of the Larger features group; gateway, client
  and HA options; no budget migration):** optional HA options `smtp_host`, `smtp_port`,
  `smtp_security` (`tls`/`starttls`), `smtp_username`, `smtp_password` (password field),
  `smtp_from`, checked as a set by `ha-launch.cjs` `smtpSettings` and passed to
  `startGateway({ smtp })`, never through the environment. `gateway/mail.ts` sends through
  Nodemailer 10 (new server dependency, MIT-0, no dependencies or install scripts; bundled only
  into `gateway.js`): TLS always, certificate checked, 10-second timeouts, plain text, fixed
  subjects, errors logged as codes without the address. Settings → Server → **Password codes**
  (was "Password codes to your phone"): a phone and an email address, each saved only once the
  code sent to it is typed back (`POST/DELETE /api/people/me/{phone,email}`,
  `…/confirm`; `PUT /me/notify` and its Test are gone), and with both, **My phone / My email /
  Both** (`PUT /me/code-channel`). Forgot password sends where chosen (falling back to what the
  person has when that's off), the administrator's code also to the Log; at most one code a
  minute per purpose and destination and ten emails a day per person (`code_sends`). `people.db`
  gets its first additive change: `people.email`, `people.code_channel` (after a
  `pragma table_info` check), and new tables `destination_codes` and `code_sends`. Deviations
  from the design are in docs/MULTI-USER-EMAIL-AND-REMINDERS.md "As built". Tests:
  `gateway/mail.test.ts`, `gateway/store.test.ts` (confirmation, limits, upgrading an up.127
  `people.db` keeps every row and a second start changes nothing), `gateway/gateway.test.ts`
  (confirming phone and email, forgot by email, channels, fallback, the administrator by email
  and Log), `homeassistant/ha-launch.test.cjs`, `e2e/tests/multi-user/people.spec.ts` (add an
  address and reset by email through `e2e/mailCatcher.ts`), and the container smoke test (starts
  with SMTP set without connecting; the mail password is in no process's environment). D2b
  (reminders through the gateway) is next.
- **Assistant endpoints, phase 3 (up.127, D1 of the Larger features group; server only, no
  migration):** each row of the policy table now has `matches` (request only) and, for the seven
  rows whose rule reads the budget, `check`. `requireSession` runs both and keeps the request in
  `res.locals.assistantPending`; the write calls `assistantGuard(res.locals)` first inside its
  own transaction (transactions PUT, `PUT /rules/:id`, `applyRules`, `linkTransfer`, `setClaim`,
  household `POST /:id/events`), which runs the check again and throws `AssistantRefusal`
  (`auth/assistantRefusal.ts`, 403 through `errorHandler`, logged `refused`, "This changed before
  it could be saved: …"). A matched row whose check refuses at the first run answers with the
  check's reason, logged under that row. The tokens' reconciled-row rule moved from the
  transactions route into `categorise_transaction`'s check; with a guard `setClaim` only inserts;
  `undoChangeSet` and `createAssistantProposal` read ownership and the 50 cap inside their
  transactions. Owner took all six recommendations of docs/ASSISTANT-PHASE-3.md on 6 November;
  decision 5's follow-up (MCP change sets record the category read before an awaited PUT, so undo
  can restore a stale one) is not built. Test: `auth/assistantPolicy.test.ts` (each budget-reading
  row's allowed case, early refusal and refusal after a middleware changes the budget between the
  check and the write; request-only rows' allowed and nearest refusal with database reads
  forbidden; every row is in one of the two lists).
- **Legacy recurring table dropped (up.123, C4 of the Polish and help group; migration 0078, no
  backup version change):** `0078_drop_legacy_recurring` drops `transactions_recurring_idx`, then
  `transactions.recurring_transaction_id`, then `recurring_transactions` (column first, so no
  foreign key points at the table). Neither was in `schema.ts` or any backup since 0011 copied
  them into `schedules` and `transactions.schedule_id`; `parseBackup` reads only schema columns,
  so an older backup that still names them restores. The index and table drops are `IF EXISTS`;
  SQLite has no `DROP COLUMN IF EXISTS`, so the column drop relies on the journal running it once,
  inside the migrator's single transaction. Before installing on the live app, take the usual
  cold backup: the migration rewrites the `transactions` table. Tests: `db/legacyRecurring.test.ts`
  (a populated pre-0078 database keeps every transaction, schedule and `schedule_id`, passes
  `foreign_key_check`, and a second run changes nothing; a new database), `routes/backup.test.ts`
  (a backup with `recurringTransactions` and `recurringTransactionId` restores). Docs:
  DEVELOPMENT.md (hand-written migrations note, schedules in the schema summary, occurrence
  matching), PLANNING.md.
- **Labels joined to their fields, part 2 (up.126, C6b of the Polish and help group; client and
  lint only):** the other 42 `label-has-associated-control` warnings (accounts, goals, plaid,
  plans, recurring, reports, settings, simplefin) and 7 labels lint can't check because their
  text is an expression (Add account's balance, Update value, a transaction's value in the main
  currency, Recurring's amount and date flexibility, the dashboard's name dialog, Edit several
  transactions' tri-state selects) now have `htmlFor` and an `id`. A caption over a row of buttons
  is a `span` with an id, and the row is `role="group"` with `aria-labelledby` (account logo, goal
  icon and colour, recurring type and amount precision, category budget type). The rule's `depth`
  is 3, for checkbox and radio labels whose text sits in nested spans. The jsx-a11y label burn-down
  is done: no `label-has-associated-control` warnings are left. Warning cap 197 → 155. Test:
  `e2e/tests/accessibility.spec.ts` ("every label in the account, goal, recurring and category
  forms points at its field").
- **Labels joined to their fields, part 1 (up.125, C6a of the Polish and help group; client and
  lint only):** jsx-a11y's `label-has-associated-control` takes `controlComponents` (`Input`,
  `Select`, `CurrencyInput`, `MoneyInput`, `AmountInput`; each renders a native field first), so
  the 54 labels that already wrapped one stop warning. The 19 real ones in
  `components/transactions/` and `ReconcilePage` now have `htmlFor` and an `id` (from `useId`);
  `CurrencyInput`, `CategorySelect`, `CategorySelectButton`, `MerchantSelect` and `PayeeCombobox`
  take an optional `id` for it. A caption over a button named by its value (the details panel's
  Category, Add transaction's Account) or over static text (Recurring) is a `span`/`p`, not a
  `<label>`: a label would rename the button. Warning cap 270 → 197. Test:
  `e2e/tests/accessibility.spec.ts` ("every label in the transaction forms points at its field").
- **Receipt reading with Anthropic's structured output (up.124, C5 of the Polish and help group;
  server only, no migration):** `askImage` in `receiptReader.ts` sends the reply schema as
  `output_config.format` (`json_schema`); `REPLY_SCHEMA` closes both objects
  (`additionalProperties: false`, which structured outputs require; Ollama takes it too). It no
  longer sends `temperature: 0`, which current Claude models, the suggested `claude-haiku-5-5`
  among them, reject with a 400 (so a read with the suggested model failed until now), and
  `max_tokens` is 16,000 because those models think first. `stop_reason` `refusal` or
  `max_tokens` fails the read with its own message instead of parsing. Transcription for Files
  search has no schema and is unchanged; OpenAI and local reads are unchanged (`jsonIn` stays
  for them). Not built: the optional cost per read (left for the owner to ask for; prices per
  model would need a list that rots). Tests: `receiptReader.test.ts` (cloud providers). Docs:
  RECEIPTS-AND-TAX.md §5.
- **Enable Banking's setup steps in the guide (up.122, C3 of the Polish and help group; client
  only, no migration):** a new guide page, `enable-banking` (`DOCS_PAGES`, the article after
  Connecting Up), replaces the last flybudget.org help link: the setup form's **Step-by-step
  guide** and the sync result's **How syncing works** are `GuideLink`s that close the dialog
  (`GuideLink` takes `onClick`; the sidebar keeps its dialog mounted across pages), and
  `upstreamDocsUrl` and `WEBSITE_URL` are gone. The server's reverse-proxy warning
  (`middleware/security.ts`) points to `docs/START-HERE.md`. Left alone on purpose: the desktop
  redirect `RELAY_REDIRECT_URL` (`https://flybudget.org/bank-callback/`, registered in each
  user's Enable Banking application) and the comments and tests about it. Tests:
  `articles.test.ts` (no `flybudget.org` in `client/src`, and the new page is linked), e2e
  `enable-banking.spec.ts` ("the setup links to Allotment's own Enable Banking guide…"). Docs:
  GUIDES.md "The user guide", DEVELOPMENT.md. Next: C4 (remove the legacy
  `recurring_transactions` table in its own migration).
- **User-guide articles, page guides and tips (up.121, C2 of the Polish and help group; client
  only, no migration):** four articles in `client/src/userGuide/articles.tsx`: Payday plans, Card
  payments, Budget review (resilience) and Long-term forecast (super, HECS-HELP). The guide's pages
  are one list, `DOCS_PAGES` (`client/src/utils/project.ts`), and `userGuide/articles.test.ts`
  checks each has one article that some page links to; so every page now links its article
  (Budget → Until payday, the Card payments panel, Review, Forecast's long-term tab, Tax time,
  Reports, Household's "How this works", Settings → Data, the Up settings). Page guides for Payees
  and Cash flow (`guides/pages.ts`, markers `payees.*`, `cash-flow.*`); tips on Review, Recurring
  and the long-term forecast (`guides/tips.ts`). Tests: `articles.test.ts`, e2e
  `user-guide.spec.ts` (each link, and the header links at 44 px on a phone); the page-guide
  walks in `guides.spec.ts` and the phone spec cover the new guides. Docs: GUIDES.md "The user
  guide", LONG-TERM-FORECAST.md's status line. Not built: articles for Pay later, Investments,
  Files and Cash flow (their page guides cover them). Next: C3 (Enable Banking's setup steps).
- **Previous and next in transaction details (up.120, C1 of the Polish and help group; client
  only, no migration):** `TransactionDetailPanel` takes `onPrevious`/`onNext` (missing at the first
  or last row, shown as `aria-disabled` so focus stays on the button); `TransactionTable` steps
  through its loaded `transactions` in register order (search, filters and scope applied), grows
  the drawn rows when the next one is past them, scrolls the open row into view beside the desktop
  panel, and on close focuses the row again (rows and phone cards carry `data-tx-id`). Moving
  only changes `detailId`; blur saves the date, payee or notes being typed to their own
  transaction first. 44 px buttons on a phone. Tests: e2e `transactions.spec.ts` ("steps through
  the listed rows…": filtered list, edits kept, keyboard, focus back to the row) and
  `phone/polish-phone.spec.ts` (44 px, no sideways scroll). Docs: the Transactions guide page
  ("Working through the list"), the Monarch backlog ticket. Not built: a link per transaction
  (the panel is still state, not a route), so Back doesn't close it. Next: C2 (user-guide articles).
- **Housemate money is not income (up.119, B9; no migration):** `scheduleScopes`
  (`server/src/services/scheduleScope.ts`) gives each recurring item a scope: personal, household
  (`bill` with the owner's `myShare` from `billShares`, or `contribution` with the person, from
  the owner's own transfer, a payee recorded as a housemate's money (`housematePayees`), or the
  name via `personNamedIn`), or off budget. `GET /schedules`, `/schedules/:id` and
  `/schedules/occurrences` return `scope`. Client: `groupOccurrences` (`scheduleFormat.ts`) feeds
  Recurring → Monthly (Income, Expenses with "Your share of Rent (2Up)", and a collapsed
  **Household account** out of the totals), the dashboard's Bills and income and its "Next pay";
  All recurring shows the household icon and no "+" on contributions; Find recurring labels
  household items and never gives a pool deposit an Income category. Server: forecast and Review
  use `isPersonalIncomeSchedule` (one `incomeCategoryIds`, moved from forecastService and the copy
  in reviewService); a housemate's no-account deposit isn't forecast; `detectSalary` skips
  housemate payees. Tests: `scheduleScope.test.ts` (with `detectSalary`), `forecastService.test.ts`,
  `reviewService.test.ts`, `scheduleDiscovery.test.ts`, client `scheduleFormat.test.ts`, e2e
  `housemate-money.spec.ts`. Docs: HOUSEHOLDS.md "Recurring and the dashboard" (the plan file is
  deleted), the Bills and pay guide page. Not built: a household in the demo budget; preferring
  the payday plan's date for "Next pay"; the unused `GET /schedules/summary` still sums by sign.
  Next: the Budgeting PR list is done; pick up from Open items.
- **Reviewed list of the transfers Up reported (up.118, B8; no migration):** Up's
  `transferAccount` (kept in `up_source_records.source_json` as `transferAccountId`) names the
  other account of a transfer, not the other transaction. `upReportedAccounts`
  (`transferService.ts`) maps it through `up_account_mappings` to a budget account and sets
  `reportedAccountId` on the candidate; `findTransferMatches` (`transferMatching.ts`) then pairs
  such a row only with a row in that account and sorts reported pairs first, and each suggestion
  carries `reported`. An Up account not linked to the budget leaves its rows to ordinary matching.
  `bestCounterpart` (the owner's explicit "Transfer: account") ignores reports. The register's
  `TransferSuggestions` lists reported pairs under **Up reported these**, then **Other possible
  transfers**; the owner ticks and links as before, and the sync links nothing. Organise tokens
  link only server suggestions (`assistantPolicy.ts`), so the narrower pairing applies to them
  too. Tests: `transferMatching.test.ts` (properties: a reported row pairs only into the named
  account, no reports change nothing), `routes/upReportedTransfers.test.ts` (through the Up mock
  and the routes, with a same-day decoy in another account), e2e `up-transfers.spec.ts`. Docs:
  UP-SUPPORT.md, the Transactions guide page, MCP `transfer_suggestions`. Not built: offering a
  pair Up reported when the other side is outside the five-day window. Next: B9 (done in
  up.119).
- **Keyboard entry, sums, the inspector and notes (up.117, BUD-05, BUD-10; migration 0077,
  backup format 29):** `readAmountExpression` (`client/src/utils/amountExpression.ts`) reads the
  desktop Assigned editor and the phone sheet: `+ - * /` with brackets in exact BigInt fractions,
  `+50` is 50, `*2` and other malformed sums are refused; plain amounts still go to
  `readTypedAmount`. `assignmentToInput` keeps a negative assignment's sign (the editor used to drop
  it, and the phone sheet's `Math.abs` is gone). Desktop keys: Enter saves, Escape cancels,
  Down/Tab and Up/Shift+Tab save and open the neighbouring rendered row (`tr[data-budget-row]`),
  unchanged amounts aren't re-saved. `BudgetInspector.tsx` at the top of the sidebar: month view
  (expense totals from `selectionFigures`, month note), one ticked envelope (figures, target, note,
  history link), several (sums and **Fund N targets**, which opens Fund targets through
  `useScopedPlan.load(fetch, only)`). Notes: `budget_month_notes` and `category_notes`
  (`services/budgetNotes.ts`, `PUT /budget/:month/note`, `PUT /budget/category/:id/note`,
  `GET /budget/:month/note`, `note` on each category of `GET /budget/:month`), no revision trigger,
  owner-only writes, 2,000 characters; the demo budget has one of each. Tests:
  `amountExpression.test.ts`, `budgetFigures.test.ts` (selection property),
  `routes/budgetNotes.test.ts`, `accessTokens.test.ts` (token refused, read allowed), e2e
  `budget-inspector.spec.ts`. Docs: ENVELOPE-FUNDING.md "Typing assignments" and "The inspector and
  notes", Budgeting guide page. Not built: one amount typed into several envelopes, group/account
  notes. Next: B8 (done in up.118), then B9.
- **Card payments in the budget table (up.116, BUD-09; client only, no migration):** every payment
  envelope (`paymentAccountId` on the budget categories) is a row of a **Card payments** section after
  Total expenses (desktop `BudgetTypeSection` with `showAll`, phone `PhoneBudgetSection.always`), found
  with `paymentCategories` in `utils/cardRows.ts` and matched to its `summary.cards` position by
  category (`cardsByCategory`). `cardNotes` and `CardRowNotes` put debt, shortfall, unfunded payments,
  extra reserve and prepaid balance under the name; the sidebar's `CardPayments` uses the same `cardNotes` (with `showZero`, so its debt and shortfall always show). No server change
  and no second ledger; the envelope is still out of `allExpenseCats` and so out of the expense totals
  and the hero. The sidebar's `CardPayments` keeps Fund debt and the review of unreviewed cards. Tests:
  `utils/cardRows.test.ts`, e2e `card-payments.spec.ts` (desktop and phone: $20 Groceries and $80 on
  the card, linked repayment, shortfall). Docs: CARD-PAYMENTS.md "Where it appears", Budgeting guide
  page ("Cards in the budget"). Not built: a per-row detail view beyond the notes. Next: B7 (BUD-05
  keyboard entry and expressions, then BUD-10 inspector and notes).
- **Row-anchored moves, and giving money back to Ready to assign (up.115, BUD-06; no migration):**
  the Available figure of an envelope that isn't $0 is a button (desktop table, phone cards) that
  opens the Move money panel prefilled through `useMoveRequest` (`store/moveRequestStore.ts`): the
  envelope as the source when it has money, as the destination with its deficit when overspent;
  never for a future month. `READY_TO_ASSIGN` (`budgetMoves.ts`, mirrored in `MoneyMoves.tsx`) is a
  move destination only: `previewMove` reports Ready to assign now as its available figure,
  `moveWithinTransaction` writes only the source's assignment, and `budget_moves.destination_id`
  keeps the sentinel (no foreign key, so no migration; history and undo name it and undo restores
  the source alone). `goalLifecycle.ts` refuses it, so a goal's retire-and-move still goes to a
  category. The preview's generic `targetNotice` is replaced by `sourceTarget` and
  `destinationTarget` (`targetEffect`: a target's requirement doesn't depend on this month's
  assignment, so only the change in assignment moves it) and the panel has **Cancel**. Tests:
  `readyToAssign.test.ts`, `budgetProperties.test.ts` (Ready to assign rises by exactly the amount,
  nothing else changes, undo restores every row), `resilience.test.ts` (goal refusal), e2e
  `envelope-funding.spec.ts` (desktop and phone, plus the guide link). Docs: ENVELOPE-FUNDING.md
  "Moves, coverage and undo", a new **Move money** guide page (`move-money` in `DocsPage` and
  `userGuide/articles.tsx`). Not built: assigning from Ready to assign inside the panel (the planned
  field does it), moves in a future month. Next: B6 (BUD-09 card rows in the budget table).
- **Household corrections as owner-applied proposals (up.114):** owner-requested on 6 November 2026, replacing up.113's temporary direct rows (`household_remove_contribution`, `household_remove_own_expense`, `household_pool_expense`, `household_unlink_transfer`, now gone from `auth/assistantPolicy.ts`; up.113 was used once that day to correct the owner's household, 16 entries removed, 8 transfers unlinked and 5 re-linked, 7 contributions and 9 bills recorded, balances reconciled to the bank). Proposal kinds `household.remove_entries`, `household.share_bills`, `household.unlink_transfers` in `services/assistantActions.ts`: checked when proposed (`proposalContent`), payload lists every item for the owner, applied whole in one `db.transaction` through `removeEvent`, `recordEvent` and `unlinkTransfer` (`applyHouseholdProposal`). MCP `remove_household_entries`, `record_household_bill_expenses`, `unlink_household_transfers` file them through the existing `propose_change` row; **Waiting for you** (`ReadOnlyAccess.tsx`) shows "Show what it changes". Tests: "household corrections, proposed for the owner to apply" in `routes/assistantTools.test.ts` (every token refused directly, the token can't apply, apply-time refusal leaves the batch undone and pending).
- **Month quick fills and selected-category funding (up.112, ACT-05, BUD-07; no migration):** auto-assign
  (`services/autoAssign.ts`) already had assigned/spent last month and a 3-month average (add only);
  up.112 adds `zero`, 6 and 12-month averages (`months`), a `mode` of `add` or `replace` (a negative
  `need` takes money back, never below a zero assignment) and a `categoryIds` scope. `planFunding`
  in `fundingPlan.ts` takes `only` and applies reductions first; **Fund targets** takes the same
  `categoryIds`. The scope is part of the reviewed plan (apply rebuilds with it; a different scope is a
  409). Client: `useScopedPlan` and `FundingRows` (ticks) in both dialogs; the Auto-assign dialog has
  Add/Replace, a months select and **Set to zero**. Tests: `routes/targets.test.ts`,
  `fundingPlan.test.ts`, `budgetProperties.test.ts` (random strategy, mode and scope), e2e
  `budget.spec.ts`. Docs: ENVELOPE-FUNDING.md "Planned assigning", Budgeting guide page. Not built:
  Actual's copy-until-year-end and single-category copy, a new target cadence (BUD-07 asks only if
  verified), a "fund selected" action from ticked rows in the budget table itself (the ticks are in
  the dialogs). Next: B5 (BUD-06 moving rows, returning money to Ready to assign, the Move money
  guide page).
- **Hold for next month (up.111, ACT-03; migration 0076, backup format 28):** table `budget_holds`
  (`month` primary key, `amount`; triggers bump `budget_revision`), loaded into the ledger
  (`holdMonths`, `holdTotals`, `heldFrom`, `holdAt` in `budgetLedger.ts`). `fundingState` subtracts
  `held` (holds in the viewed month and after it, on top of `laterDeduction`; capped for a past
  month) from `unassigned`, so a month with a hold can read fully budgeted, and the summary adds
  `held` and `holdAmount`. `assignable` in `budgetMoves.ts` subtracts it too, so held money can't be
  assigned to any month. `setHold` (`services/budgetHolds.ts`, `PUT /budget/:month/hold`, registered
  before `/:month/:categoryId`) holds in the current month only and no more than is ready to assign;
  owner only (a token's PUT is refused: `accessTokens.test.ts`). Client: `HoldMoney.tsx` under the
  hero (**Hold money…**, not "Hold for next month…": Playwright's substring match would make it
  collide with the Next month button), **Held for next month** in the hero's working. Tests:
  `routes/budgetHolds.test.ts`, `budgetProperties.test.ts` (recompute with random holds, and a
  hold only moves Ready to assign between months), e2e `budget.spec.ts`. Docs:
  ENVELOPE-FUNDING.md "Holding money for next month", Budgeting guide page. Not built: automatic
  hold. Next in the Budgeting group: B4 (ACT-05 month quick fills, BUD-07 selected-category funding).
- **Keep overspending (up.110, ACT-04; migration 0075, no backup bump):** `categories.keep_overspending`
  (owner only, Settings → Categories → Edit; `categoryEditSchema` in `routes/categories.ts`, not in
  the token policy's `CATEGORY_FIELDS`). `budgetLedger.ts` sets `resets` false for such a category
  (a separate `expense` flag keeps linked-account transfers working), `cardFunding.ts` skips its
  `poolAt` reset (`keepsOverspending`), and `fundingState` holds a deficit carried into a later
  month as spent cash (`cash`). The deficit still counts in `overspent`; Review marks it `kept`.
  Tests: `routes/keepOverspending.test.ts`, `budgetProperties.test.ts` (random kept sets),
  `cardFunding.test.ts`, `accessTokens.test.ts` (refusal), `budgetFigures.test.ts`, e2e
  `settings.spec.ts`. Docs: ENVELOPE-FUNDING.md "overspending rule", Budgeting guide page. B3 (up.111) followed.
- **Save and undo feedback, availability states (up.109, BUD-02, BUD-03; client only, no migration):**
  `handleSave` in `pages/Budget.tsx` resolves to the refusal reason or `null`; the row's editor
  (and the phone `BudgetAmountSheet`) closes only on `null`, shows **Saving…**, ignores a second
  Enter while a save is in flight, and keeps the typed amount with **Not saved. <reason>** after a
  refusal. `undoStore.ts` reports a failed undo or redo as an `error` toast; a 409 (the budget moved
  on) drops the stale command, anything else keeps it for another try. `availability()` in
  `utils/budgetFigures.ts` names Overspent, Short of target and Covered by carried funds for the
  desktop table, phone cards and `SpentBar` (`covered`, amber instead of red). Tests:
  `undoStore.test.ts`, `budgetFigures.test.ts`, e2e `budget.spec.ts`. B2 (ACT-04) followed in up.110.
- **Household reports (up.108, SPL-05; no migration):** `householdBreakdown`
  (`services/householdReport.ts`) returns `byMonth`, `byPerson` (paid, share, paid less share; the
  household account is its own line) and `byCategory` (from the linked bank payment's category,
  else Uncategorised); the statement route returns them (and so does the MCP `household_statement`
  tool) and `HouseholdBreakdown.tsx` shows them under the spending list. The page's own total
  and table still come from the loaded events. Tests: `routes/householdReport.test.ts`
  (fast-check: every breakdown adds to the total), e2e `household.spec.ts`. Not built: a
  `category_id` on household entries, per-person monthly stacks, CSV (SPL-07). With this the
  household group (A2 to A4) is done.
- **Edit entries and household activity (up.107, SPL-03, SPL-04; migration 0074, backup format 27):**
  `updateEvent` / `removeEvent` in `householdService.ts` (one write path: it deletes the entry's
  shares and row and re-runs `recordEvent` under the same id, inside the route's transaction),
  `PUT` and `DELETE /households/:id/events/:eventId`, `GET /households/:id/activity`, table
  `household_activity` (no FK on `event_id`; newest 500 per household). Client: `EditEntry.tsx`
  (Edit in the history), `ActivityLog.tsx`, the combined register's merged Activity. Tests:
  `routes/householdEdit.test.ts`, `db/householdActivity.test.ts` (migration on a populated
  database), `gateway/sharing.test.ts`, e2e `household.spec.ts`. First `households` user-guide page.
  Not done: the partner-link design (`docs/HOUSEHOLD-PARTNER-LINKS.md`) needs these edit rules
  ("changed, claim again") before it is built; SPL-05 reports follow.
- **Settle up (up.106, SPL-01, SPL-02, SPL-06; no migration):** the Household page lists who should pay whom
  (`suggestSettlements` in `householdLedger.ts`, from the `direct` balances; `poolOwed` listed apart), each
  with **Record** or **Link payment**; `repaymentSuggestions` has a `payment` kind for your own outgoing
  repayments; the spare cent of an uneven equal split starts at a place taken from the event id. The
  combined-household view has no settle-up list yet.
- **Stage 2 quality (up.105, no migration):** F-15, F-09, F-20, F-24 and F-19's G.2 items.
  _F-15:_ `lint/rules/icon-only-control.js` (an error: a button or link of only an icon needs an
  `aria-label`; jsx-a11y's own rule never saw lucide icons) found and fixed four nameless controls;
  Budget's month title is the page `h1` ("Budget, November 2026" to a screen reader) and Category
  detail's name is its `h1`; dashboard widget titles are `h2`. Text colours were already above 4.5:1
  (`lint/tokens/contrast.test.js` reads `index.css` and keeps both themes there); the failures were
  `text-text-disabled` used for readable text (now `text-tertiary`) and `opacity-50` on disabled
  rules (now the words "Off: turn it on to use it."). Phone targets are 44 px in Settings →
  categories (`CategoryManager`), the dashboard (its recent transactions use `TransactionCard` on a
  phone), `PayeeIcon`, Review, cash flow presets, year view and Files. Not done: the 115
  `label-has-associated-control` warnings (most inputs have an `aria-label` already, so they are
  named; the labels just don't focus them; done since, in up.125 and up.126), and
  `RowMenu`/`ContextMenu` focus warnings. The warning cap stayed at 270.
  _F-09:_ "Ready to assign" is the only name (UI, server error messages, e2e), "Payee" replaces
  "Merchant" where a payee is picked or shown (component names such as `MerchantSelect` and the
  `showMerchantIcons` preference key keep their names; receipts and payment plans keep Merchant).
  `lint/terms/terms.test.js` fails a retired name; the table is in docs/GLOSSARY.md. The hero
  already named only non-zero causes (`fundingStatus.test.ts`) and zero rows were already neutral;
  a scan of the demo found no zero shown in the caution or negative colour.
  _F-20:_ sentence case across `client/src` UI strings (the rule is in docs/BRAND.md, "Writing");
  default category names such as "Bank Fees" are data and unchanged. Dates in `PaydayPlan`,
  `ImportModal`, `Household`, `UpReview` and others go through `formatDay`, which now returns an
  unparseable value as it came instead of throwing; `formatDayTime` shows moments.
  _F-24:_ `E2E_CHROMIUM_PATH` replaces the uncommitted local config; the `macWindow` test holds
  the event loop open itself (Node 22 cancelled it); lint's `npm test` is in CI.
  _F-19 (G.2):_ `docs/DEVELOPMENT.md` Welcome and `recurring_transactions` text, Settings → Server's
  self-hosting link (now this repo's Start here), HANDOVER's local-browser and Saver-transfer notes.
  `SECURITY.md` and the backup copy were already fixed.
  _Release state:_ up.105 is the version this PR ships; the live app was on up.104 (#147, the iPhone
  header fix) when it merged. Installing up.105 on the live app follows the standing steps in
  CLAUDE.md (verify identity, cold backup with the key, update, verify health); nobody has done it.
  Check the live version before assuming. _Next:_ Stage 3 of the audit roadmap (section H), then the
  115 `label-has-associated-control` warnings (cleared in up.125 and up.126).
- **Stage 1 follow-up (up.103, migrations 0072 and 0073, backup format 26):** the rest of SEC-01 and
  FINX-02.
  _SEC-01 import history:_ `import_batches` (one row per confirmed file import: account, file name,
  rows added, `adjusted_through`) and `transactions.import_batch_id`. `/import/confirm` takes an
  optional `fileName` and answers `importBatchId`; `GET /transactions/import/batches?accountId=`
  lists imports that still have rows; `DELETE /transactions/import/batches/:id`
  (`services/importBatches.ts`) removes the file's rows except reconciled, reviewed, transfer-linked,
  hand-split, household-shared and file-attached ones, which it returns as `kept` with a reason,
  puts the starting balance back when the import had moved it, and returns the removed rows in the
  import's shape so the client's **Put them back** re-imports them. Not a change set (those are for
  token category changes); the undo is the explicit button and its re-import. Tokens cannot read the
  history (`UNREADABLE` in `auth/accessTokens.ts`). Client: `ImportHistory.tsx`, in the import
  dialog's first and last steps.
  _FINX-02 reminders:_ `schedules.reminder_days` (null = off), `schedule_occurrences.reminded_at`,
  `budget_settings.reminder_notify_service` / `reminder_show_details`.
  `services/reminderService.ts` (`sendDueReminders`) runs from the schedule timer's `afterTick`
  (`index.ts`, only when `canNotify()`): one message per tick for occurrences within their lead,
  08:00 to 20:59 local, generic text unless the owner opted into names and amounts, marked after a
  successful send (a failure is retried next hour; `regenerateFutureOccurrences` keeps the mark).
  `routes/reminders.ts` (`GET/PUT /api/reminders`, `POST /api/reminders/test`; owner only);
  client `ReminderSettings.tsx` (Settings → Server) and a "Remind me" select in
  `RecurringFormModal.tsx`. Single-budget Home Assistant only: a multi-user budget has no
  Supervisor token, so its reminders go through the gateway (D2b, up.129; see State). The
  positive path (a real notify service) is covered by server tests with a stub, not e2e.
  Settings → Server's token section is now "Access tokens" (it was "Read-only access" although
  categorise and organise tokens write).
- **Stage 1 correctness (up.102, built on #140's up.101):** four items from the competitor
  comparisons and the audit.
  _SEC-01:_ `services/importDuplicates.ts` (`matchExistingRows`, `existingRowsNear`,
  `takenImportedIds`) finds a file row that an existing row of the account may repeat: same
  amount, dated within 3 days, payee not contradicting (shared word, one starts the other, or
  either blank), each existing row claimed once, nearest day first. `POST
/transactions/import/preview` adds `possibleDuplicate` (`manual`/`synced`/`scheduled`/`file`);
  `/import/confirm` adds `possibleDuplicates`. The import dialog unticks these rows and says what
  they look like; nothing is skipped without the person's choice. Not built: tagging rows with the
  import that made them and "undo this file" (the rest of SEC-01).
  _FINX-01:_ `services/scheduleTimer.ts` runs `ensureOccurrencesForAll` (90 days ahead) then
  `autoCreateDueScheduled` every hour (unref'd; waits for the startup bank syncs and for
  `isUpSyncing()`); `index.ts` starts it and stops it when the server closes. Tests use fake timers.
  _F-22:_ `server/src/utils/date.ts` (`addDaysIso`, `addMonthsIso`, `daysBetweenIso`, `eachDayIso`,
  `isIsoDay`, `todayIso`, `localDayIso`, `utcDayIso`) and the client's `utils/calendarDay.ts`; the
  ESLint rule `no-restricted-syntax` in `lint/eslint.config.js` rejects `toISOString()` cut down to
  a date in production code (tests are exempt). `fundingState` takes a `today` argument for `past`.
  _F-23:_ `dayRange` is `eachDayIso`; `date.test.ts` runs the helpers in child processes for UTC,
  Sydney, Montevideo, Havana and Beirut. Currency-code spacing needed no change, only a test.
  No migration. Check the live app after updating that a bill due today posts within the hour.
- **Review guidelines (documentation only, no release):** `AGENTS.md` (and its identical copy
  `CLAUDE.md`) gained a `## Review guidelines` section and `SECURITY.md` a "Security review
  guidelines" section; Codex's automatic PR review reads both (repository settings → Code review).
  They cover how to check a diff, correctness and database rules, staleness and drift, tests, and
  the security model. `SECURITY.md` was also brought up to date (repository and attestation names, Up,
  Enable Banking, access tokens, receipt reader; removed the unverifiable CodeQL claim and the dead
  upstream website link). When a protection, outbound service, stored secret, token scope or route
  exception changes, update the matching `SECURITY.md` section in the same PR.
- **Assistant policy table and log (up.101, PR #140 merged onto up.99's endpoint):** two sessions
  built I-11 in parallel. Kept from up.99: the `/api/assistant/do` endpoint (`assistantDispatch`
  rewrite plus `res.locals.viaAssistant`), proposals, migration 0069's tables. From #140: the policy
  table `auth/assistantPolicy.ts` (`ASSISTANT_ACTIONS`, named rows with scope, summary and check;
  `propose_change` added for proposals), `services/assistantLog.ts` (outcome refused/applied/failed,
  reason, MCP tool from `x-flybudget-assistant-tool`, no bodies, newest 5,000 rows),
  `GET /api/assistant/activity` and its settings view, and docs/ASSISTANT-ENDPOINTS.md. #140's own
  `app.handle` grant and its migration were dropped (0069 had shipped); migration 0071 adds the
  columns and clears the bodies up.99 kept. `tokenAllows` answers reads only; `requireSession`
  checks writes against the table. Tests: `routes/assistant.test.ts`, `assistantTools.test.ts`.
- **Audit F-11, F-13, F-14 (up.100):** F-11: `client/src/App.tsx` lazy-loads every page except
  Dashboard, Budget and Transactions, each in its own `Suspense` inside the shell; main chunk 2,327 kB
  to 1,266 kB (634 to 354 kB gzip); `emoji-picker-react` removed. F-13: `householdService.sharePayments`
  is the only share path (the Share action, `shareBillPayments`, `autoShareBillPayment`, rules), one
  result format with who owes what, `preview: true` on `POST /households/:id/share` records nothing;
  `services/fundingPlan.ts` (`planFunding`, `applyFundingPlan`, `addAssigned`) backs auto-assign,
  target funding, payday plans and budget proposals; desktop Budget has one **Assign** menu
  (`components/budget/AssignMenu.tsx`; phones keep the More menu). F-14: `deleteTransactionByOwner`
  remembers every synced import (`isSyncedImport`: `up:`, `eb:`, `simplefin:`, `plaid:`) in
  `up_deleted_imports` (name kept; migration 0070 adds what the row was: date, amount, payee,
  imported payee, notes); the
  Enable Banking, SimpleFIN and Plaid syncs skip them (`deletedImportIds`); Up review still lists only
  Up's, `GET /transactions/deleted-imports` and `POST …/restore` the others (Restore recreates the
  row from those details, `services/deletedImportRestore.ts`, since Plaid's cursor and Enable
  Banking's window would never send it again; an older deletion without them is only forgotten), shown in Settings →
  Connected Banks (`DeletedBankImports.tsx`). Tests: `deletedImports.test.ts`, `householdShare.test.ts`,
  `fundingPlan.test.ts`, e2e `budget.spec.ts`, `targets.spec.ts`.
- **Assistant endpoint and repayment categories (up.99):** audit decisions I-11 and I-8. A token
  writes only through `/api/assistant/do/<path>`: `assistantDispatch` (`routes/assistant.ts`, mounted
  before `requireSession`) rewrites it to `/api/<path>` and sets `res.locals.viaAssistant`; only that
  flag lets `requireSession` accept a token write, and only for a row of the policy table
  (since up.101 `auth/assistantPolicy.ts`; up.99 had its own action list). Each is logged in
  `assistant_actions` (migration 0069, 0071; not backed up), refused ones too. `assistant_proposals` holds asset proposals
  (`asset.create`/`asset.update`, MCP `propose_tax_asset`, at most 50 pending) that only the owner
  applies (`/api/assistant/proposals/:id/apply|decline`). The scope predicates in
  `auth/accessTokens.ts` moved into that table in up.101; it is F-18's declarative table. MCP's `callApi` sends non-GET requests through the endpoint. UI: **Waiting for you**
  and **Assistant activity** in `ReadOnlyAccess.tsx`. I-8: `GET /households/:id/category-offers`
  (`services/householdCategoryOffers.ts`) lists settlements to you linked to an uncategorised
  deposit, with the repayer's shares of your categorised expenses in the year before by category;
  `RepaymentCategoryOffers.tsx` on the Household page categorises the deposit with a normal
  transaction update. Tests: `routes/assistantTools.test.ts` (I-11 cases),
  `routes/householdCategoryOffers.test.ts`, e2e server-mode and `household.spec.ts`.
- **Receipt providers and learned Up categories (up.98):** owner request of 4 November. The receipt
  reader takes a provider (`budget_settings.receipt_reader_provider`, migration 0068): `local` (any
  server speaking the Ollama API), `anthropic` or `openai` with the owner's API key in
  `receipt_reader_secrets` (encrypted, write-only, not in `TABLES` so never backed up).
  `askImage` in `receiptReader.ts` is the one place a photo is sent. Up records now keep Up's
  category slug (`up_source_records.up_category`); `learnUpCategories` in `upCategoryMap.ts` turns
  the owner's own categorising (at least 3 rows, 80% in one visible envelope) into the slug's
  fallback, ahead of the name list. Older records get their slug at the next full sweep (weekly,
  or **Check all history**). Tests: `receiptReader.test.ts` (cloud providers),
  `upCategoryMap.test.ts`, e2e `receipts-reader.spec.ts`.
- **4 November releases (up.87 to up.96, all merged with green CI and published):** up.87 Up
  categories mapped to state-aware envelope names (`forState`, a Home & Garden envelope); up.88
  ESLint in CI (`lint/`, warning cap 271, 270 since up.98) and the sidebar crash fix; up.89 sidebar groups with
  progressive disclosure (`utils/navFeatures.ts`, migration 0064); up.90 System theme by default;
  `website/` removed; up.91 Plaid, SimpleFIN and Enable Banking marked community supported with
  CSV import offered everywhere (I-10) and Review not asking to reconcile Up accounts that matched
  Up (F-17, `services/bankVerified.ts`); up.92 backup with files (I-6, `services/backupArchive.ts`);
  up.93 incremental Up sync (F-10, #133, migration 0065: the 14 days before the newest date Up
  reported plus open holds, a weekly full sweep, **Check all history**); up.94 to up.96 depreciating
  assets phases 1 to 3 (#134, #135, #136: Tax time → Assets, **Depreciate instead**, lodged-year
  locks, the low-value pool; migrations 0066 and 0067, backup format 25; see Open items 7).
- **Full audit and Stage 1 fixes (up.85, up.86):** an owner-requested repository, architecture, financial, security and UX audit on 3 November is in [docs/AUDIT-2026-11.md](docs/AUDIT-2026-11.md) (findings F-01–F-24, roadmap, owner decisions I-1–I-11; the status table at its top says what has landed). Owner decisions taken: left to spend excludes savings (I-1), a new budget starts the day it connects Up (I-2), bank deletes warn and offer Restore (I-3). **up.85 (#122, released):** `client/src/utils/ledgerViews.ts` lists every ledger-derived query; the global `MutationCache.onSuccess` in `main.tsx` refreshes them after any save, and `setAfterUndoChange` in `store/undoStore.ts` after Undo/Redo (e2e `freshness.spec.ts`). `utils/leftToSpend.ts` leaves out Savings-type envelopes and goals' categories (`savingsCategoryIds`), and the dashboard card says what it leaves out; the full template's Savings and the demo's Emergency Fund are type `savings`, and the demo trip goal saves in Holidays. `AssignBlockError` lists Up rows deleted here, with Restore (`GET /up/review`, `POST /up/review/restore`; e2e in `assign-block.spec.ts`), and the delete confirmations say assigning pauses. `utils/fundingStatus.ts` names only the real causes on the Ready to assign hero. Full Backup copy says file bytes aren't in it. `config.ts` `unprotectedBindError`: the server refuses `FLYBUDGET_HOST` beyond loopback outside server mode and the desktop app. **up.86 (#123, merged 3 November; its tag and release follow main CI, check before relying on it):** `budget_settings.budget_start_day` (migration 0063, additive, CHECKed; backup format unchanged). The shared `budgetStartDay` SQL in `services/balances.ts` uses it, so envelope activity, card funding and the guards all honour a mid-month start without engine changes. `startBudgetIfNew` (called by `POST /up/map-accounts`) starts a new budget today; the Up dialog's `FreshStartNote` offers "Count all of _month_ instead"; Settings → Budget start shows and changes the day; `GET/PUT /budget/start` carry `{ month, day }`. Tests: `readyToAssign.test.ts`, `budgetFunding.test.ts`, `budgetService.test.ts`, `budgetEngine.test.ts` (generator includes a day start), e2e `first-import.spec.ts`. Neither release has been installed on the live app by these sessions.
- **UX review (up.83):** owner-requested teardown in `docs/UX-REVIEW.md`, implemented except #7 (the sidebar's item count). Pull to refresh is back on phones as an in-app gesture (`hooks/usePullToRefresh.ts`, `components/layout/PullToRefresh.tsx`: refetches active queries) because `html, body` keep `overscroll-behavior: none`. The demo is an Australian Up budget (`server/src/demo/demoBudget.ts`: AUD, Spending/Rainy Day/Holiday/2Up keyed `checking`/`savings`/`holiday`/`card`, fortnightly pay and rent, every envelope funded to stay ≥ $0 and a $300 buffer; property test in `demoBudget.test.ts`) with a pretend Up connection in `server/src/browser/app.ts`; its links go to GitHub (`DemoBanner.tsx`). Category and goal icons are Lucide names (`client/src/utils/categoryIcons.ts`, emoji mapped at render time, no data migration); the short Australian template is the default unless the time zone is outside Australia (`db/defaultCategories.ts`), and `upCategoryMap.ts` knows its merged names. Allotment's own guide is `client/src/userGuide/articles.tsx` at `/guide`; Enable Banking's setup steps are its `enable-banking` article (up.122); nothing links to flybudget.org. Welcome redirects only from `/` and `/dashboard` (`AppShell.tsx`). Review's `utils/reviewNext.ts` drives both "Do this next" and the sidebar badge. First-visit intros: `guides/intros.ts` (seen under `intro.*` ids). Transactions bulk actions need **Select all** (`SelectionSummary.tsx`).
- **Menu bars and buttons (up.82):** owner-requested review after a Settings tab bar on a phone could be dragged up and down (a tab's `-mb-px` hung 1px out of an `overflow-x-auto` row, and `overflow-x` alone makes a row scroll vertically too). Every sideways row now uses the `scroll-row` utility (`index.css`: `overflow-y: hidden`, `overscroll-behavior-x: contain`, no scrollbar, focus ring drawn inside); the underline overlap moved from the tabs to the row. Long rows use `ScrollCue` (fade, arrow, wheel scrolls it sideways, `activeKey` keeps the open tab in view). `role="tablist"` rows use `TabList` from `components/ui/tabList.tsx` (arrow keys, roving tabindex). Drop-down menus use `hooks/useMenuKeyboard.ts` (focus first item, arrows, Escape returns focus, outside press or focus leaving closes; a nested menu counts as inside). `html, body` have `overscroll-behavior: none` (the frame never bounces; pull to refresh is off). The global button cursor moved into `@layer base`, so `cursor-grab` and disabled cursors apply. Checks: `e2e/tests/menus.spec.ts`, and the tab-bar tests in `e2e/tests/phone/polish-phone.spec.ts`.
- **Repayments paid ahead (up.80), Tricount history recorded, temporary token permission removed (up.81):** owner-approved on 3 November. `eventSchema.advance` lets a settlement exceed what is owed (`recordEvent` skips only the outstanding-balance check; still a repayment between two different people); the Household form's **Paid ahead** tick sets it, and Undo (`restoreHouseholdEvent`) sends it for settlements so a removed advance comes back. up.80 also carried a temporary organise-token permission (`householdEntryAllows`, MCP `record_household_entries`), used once on 3 November to record the owner's Tricount history in their two-person household (169 past expenses and repayments, 89 linked to the owner's bank payments, none refused); up.81 removes it and `routes/assistantTools.test.ts` now checks every token is refused. The owner revokes the organise token used for it.
- **Files (up.79, PR #112):** a document library after PocketSmith's Files (`docs/FILES.md`). Migration 0062 (`documents`, `document_links` with one nullable FK column per kind of target, `document_tags`, `receipts.document_id`, `receipt_files.on_disk`, `budget_settings.files_cap_mb`; every existing receipt became a document with the same id), backup version 23. Server: `services/documentService.ts` (`LINK_TARGETS` registry: transaction, category, goal, account; adding a kind is a column plus an entry), `fileStore.ts` (bytes in the database, videos over 25 MB on disk in `<db name>-files/` beside it, streaming uploads, `releaseFiles` only when no document or receipt uses a file), `fileTypes.ts` (types from bytes, OOXML/ODF via `utils/unzip.ts`, text by extension only if UTF-8), `fileText.ts` (search text from text, Office, ODF and PDFs; photos only via the local model), `filesExport.ts` (streamed ZIP via `ZipWriter`), `documentRecords.ts` (Node-free: `ensureReceiptDocuments`, `moveCategoryLinks`), `routes/files.ts` at `/api/files` (not on the token allowlist). Register filter `has_files`. Tax: files linked to a claimed transaction are evidence and go in the archive. Client: `pages/Files.tsx`, `components/files/` (`FilesSection` on transactions, categories, goals, accounts; `PdfPreview` with `pdfjs-dist` 6.4.299, lazy-loaded), share target (`public/manifest.webmanifest`, `sw.js` `receiveShare`). `docker/backup.cjs` copies the files folder too. Tests: `routes/files.test.ts`, `e2e/tests/files.spec.ts`. The depreciating assets plan (PR #108) was amended to build on it: migration 0066 (0063 to 0065 are taken), backup 24, an `asset` link kind for an asset's records.
- **Right-click "Share with…" (up.77, PR 2 of 2):** `components/ui/ContextMenu.tsx` (`ContextMenu` with flyout sub-menus, in-place with Back on phones, roving focus and focus return; `useMenuTrigger`/`MenuTarget` for right-click, Shift+F10, the Menu key and a 500 ms long press; text fields keep the browser's menu). `components/transactions/TransactionContextMenu.tsx` stays mounted in `TransactionTable` so results reach the toast after the menu closes; `TransactionCard` has a ⋯ button (`onMenu`). `useShareWithHousehold`, `describeShare` and `splitText` now live in `ShareWithHousehold.tsx` (its redo now tracks the new entries, so undo after redo works). Stop sharing removes an expense entry and its undo re-records it with `mode: 'exact'` shares (`restoreHouseholdEvent` in `api/households.ts`); money-in entries are only viewed from the menu. `undoStore.announce` shows "done" toasts with Undo (`UndoToast` has `data-testid="undo-toast"`). The register's `household` now carries the entry's `kind`. Tests: two cases in `e2e/tests/household.spec.ts`, `e2e/tests/phone/household-menu-phone.spec.ts`.
- **Household pictures and shared marks (up.76, PR 1 of 2):** owner-requested on 3 November, with "Share with…" in a right-click menu to follow. Migration 0061 adds `household_groups.logo`; `PUT /households/:id/logo` (owner only, `logoSchema`, not on the token allowlist; `GET /households` and the household snapshot return it; `sharedExport` leaves it out). `GET /transactions` left-joins `household_events` and returns `household: { id, eventId } | null`. Client: `components/household/HouseholdIcon.tsx` (rounded square, initial fallback, editable), Picture in `HouseholdSharing.tsx`, the badge in `RowMarks` (`TransactionMarks.tsx`), "Shared with … / View in household" in `TransactionDetailPanel.tsx`, `/household?household=<id>`, `hooks/useHouseholds.ts`. Tests: `routes/householdLogo.test.ts`, token case in `routes/assistantTools.test.ts`, "a household picture…" in `e2e/tests/household.spec.ts`. Owner decisions: share from the menu at once with Undo (no confirm), the badge shows even with Merchant icons off, a combined partner doesn't see the picture. The menu came in up.77.
- **Own household contribution (up.74):** owner-approved on 2 November. `ownContributionAllows` in `auth/accessTokens.ts`: an organise token may `POST /households/:id/events` with a contribution and no `transactionId` only for the household's `isSelf` person, dated today or earlier, up to `-toPool[self]`. MCP `record_own_household_contribution`. For the owner's rent share paid through the closed joint 🏡 Rent saver (closed accounts can't be household accounts, so those transfers can't be linked). Tests in `routes/assistantTools.test.ts`.
- **Assistant household and tax tools (up.73):** owner-approved on 2 November. Any token: MCP `household_contribution_suggestions` (`GET /households/:id/repayment-suggestions`) and `household_bill_reconciliation` (`GET /households/:id/recurring-bills/:scheduleId/reconciliation`, `services/householdReconciliation.ts`: per person, shares of the bill's shared payments matched to pool-account deposits by name or own transfer, −35/+7 days, within 2% or $1; `toRecord`). Organise tokens: `record_household_contributions` (`householdContributionAllows` in `auth/accessTokens.ts`: `POST /households/:id/events`, contribution only, linked to a past deposit into that household's account with its exact amount and date), `tax_years`, `tax_claim`, `tax_claim_candidates` (`claimCandidates` in `taxService.ts`, `GET /tax/years/:fy/candidates`). Tests in `routes/assistantTools.test.ts`. Rent reconciliation (owner's household, May–Oct): Juno and Zephyr's deposits cover their shares (Zephyr's $8 a month over is bills money, owner's call); the owner's own share went through the joint 🏡 Rent saver, outside the household accounts, so it is recorded by hand.
- **Token tax claims and change set redo (up.72):** owner-approved on 2 November. An organise token may read `/tax/labels`, `/tax/years`, `/tax/years/:fy`, `/tax/claims[/:id]` (not the CSV or archive) and `PUT /tax/claims/:id` for a past transaction with no claim (`taxClaimAllows` in `auth/accessTokens.ts`); it never replaces or removes a claim. MCP organise tools `tax_deductions` and `claim_tax_deductions` (skips claimed, future, money-in rows). `POST /change-sets/:id/redo` (`redoChangeSet`, owner only) re-applies an undone set where rows still have the category the undo restored; **Redo** in `ReadOnlyAccess.tsx`. Tests in `routes/assistantTools.test.ts`. Pending owner steps: press **Redo** on the two undone "Claude RC" change sets; the 2025–26 AI subscription claims (D5, 25%) wait for a session started with the new organise token.
- **Review fixes (up.70, PR #97, live 1 November):** from a full code and UX review on 31 October. Safe mode: the category history chart (`pages/CategoryDetail.tsx`), the budget editor's chart (`BudgetEditPopover.tsx`) and the dashboard Spending chart (`SpendingComparison.tsx`) printed amounts with hand-written `$` formatters; they use `formatCentsAxis` now, and `safe-mode.spec.ts` checks SVG chart text. Up: a deleted Up transaction is remembered in `up_deleted_imports` (migration 0059, backup version 22) by `deleteTransactionByOwner` (`transactionHelpers.ts`, used by `DELETE /transactions/:id` and bulk delete; syncs and internal clean-ups still use `deleteTransactionRow`). `upSyncService` skips them, `GET /up/review` lists them as `deleted`, and `POST /up/review/restore` forgets one and syncs. `PUT /transactions/:id` refuses moving a bank-fed row to another account; `syncErrorMessage` reports non-`UpError` faults as Allotment's and logs them. Migration 0060 indexes `parent_transaction_id`, `transfer_transaction_id` and `payee_id`. Server dependency advisories fixed (`undici` 8.12.3, `body-parser` 2.4.0 and others), with npm 11 so the lockfile keeps its `libc` fields. UX: phone Budget shows Ready to assign first and folds the breakdown (`PhoneCollapsed` in `BudgetSummaryWidget.tsx`), "Nothing to assign yet" on an empty budget, plainer breakdown labels, Australian spelling, a desktop **Skip to content** link (`AppShell.tsx`, `<main id="main">`), labelled activity links, 44 px phone targets, and the tours' envelope step targets `budget.expenses` (first expense group on phones). Tests: `routes/upDeletedImports.test.ts`, `up.spec.ts`, `safe-mode.spec.ts`.
- **Review fixes for up.71 (up.78, PR #101):** from Codex on PR #99. `recordEvent` accepts a settlement within either the `direct` balances or the net balances, so a suggested repayment (direct-based) records even when the recipient owes the household account. `repaymentSuggestions` treats a transfer into a pool account as the owner's contribution only when its other leg is in no household's pool (`poolGroupOf`). Tests: the last describe in `householdJointAccount.test.ts`.
- **Household joint account and fixed amounts (up.71):** `householdLedger` also returns `toPool` (contributions less shares of pool payments, adding up to `pool`) and `direct` (personal payments and settlements, adding up to zero); `balances` is their sum, unchanged. `recordEvent` no longer needs contributions before a pool payment, only refuses spending other bills' reservations; the delete route lets a spent contribution go unless reservations need it. `splitSchema` takes `exact` for a recurring bill's own split only (`checkSplit(…, allowFixed)`); `shareTransaction` refuses a payment the fixed amounts don't add up to; `sharedRecurringBills` returns `fixedTotal`. `repaymentSuggestions` uses `direct` and adds `kind: 'contribution'` suggestions into pool accounts. Client: `SplitEditor` `allowFixed`, `BalanceParts` in `Household.tsx`. Tests: `householdJointAccount.test.ts`, the last case in `e2e/tests/household.spec.ts`. Not built: SPL-01 settle-up list, combined-household split balances.
- **Page guides (up.69, PR 2 of 2):** a guide for every main page in `client/src/guides/pages.ts` (Accounts, Transactions, Rules, Recurring, Review, Pay later, Household, Goals, Forecast, Investments, Tax time, Reports, Settings) with new `data-guide` markers on those pages, and a Payees tip. `GuideTour` exposes `data-target` (`searching`/`found`/`missing`); `e2e/tests/guides.spec.ts` walks every page guide on desktop and `phone/guides-phone.spec.ts` on a phone. Note for local e2e: `E2E_SKIP_BUILD=1` reuses a cached build in the system temp folder from its first use, so it can be stale; run without it after client changes.
- **Guides and tips (up.68, PR 1 of 2):** a welcome tour, a Budget page guide and three tips (`docs/GUIDES.md`). Progress is per person in the budget: migration 0058 `guide_progress` (one row; none = new budget; existing budgets with accounts or transactions get tour dismissed, tips and page guides off, and a one-time note), `services/guideService.ts`, `routes/guides.ts` at `/api/guides` (merge-only `PUT`, `POST /reset`), not in backups, not on the token allowlist. Client: guides as data in `client/src/guides/`, steps point at `data-guide` markers (checked by `utils/guides.test.ts`), `components/guide/` (`GuideTour` makes `#root` inert while open, `GuideBanner`, `Tip`, `HelpMenu` replaces the sidebar's docs link, `GuidesDialog`, `GuideSettings` also in Preferences), `?` opens the list. e2e `guides.spec.ts`, `phone/guides-phone.spec.ts` (guide progress is not in backups, so since up.83 the e2e `resetDatabase` fixture also resets it before every test). Next (PR 2): page guides for the other pages and more tips.
- **Pay later / Afterpay (up.67):** a buy-now-pay-later purchase is recorded once in its real category on an Afterpay credit account, and the bank's instalments are linked as transfers only when the owner confirms them (`docs/PAYMENT-PLANS.md`). Migration 0057 (`payment_plans`, `payment_plan_instalments`, `payment_plan_dismissals`), backup version 21. `services/paymentPlanService.ts` (create/link/unlink/refund/fee/remove, `findPaymentMatches`, `historyGroups` for earlier payments, `expectedInstalments` merged into `expectedDebits.ts`), `routes/paymentPlans.ts` at `/api/payment-plans`, `cardFundingSetup.setupEmptyCardFunding` (no-review setup for a new empty account), `transferToAccount(..., { createNew })`. Client: `pages/PaymentPlans.tsx` ("Pay later" in the sidebar), `components/plans/`, matches also on Review. The AU template no longer seeds "Afterpay / Zip". Owner decisions: confirm every link (no auto-linking), reconciled rows are skipped, one Afterpay account for all plans, earlier payments default to 12 months. Not built: Pay Monthly, token access to plans.
- **Household follow-ups (up.66):** migration 0056 adds `household_recurring_bills.split_json` (a bill's own split; null = default) and `auto_share_from` (null = off). `householdService`: `checkSplit` (shared with the default-split route), `updateRecurringBill` (`PUT /households/:id/recurring-bills/:scheduleId` with `split`/`autoShare`), `shareBillPayments` (`POST …/recurring-bills/:scheduleId/share`), `autoShareBillPayment` (called from `ruleService.insertNewTransaction` for unsplit rows a rule didn't share; payee match, money out, date ≥ `auto_share_from`, never throws), `addPerson`/`renamePerson` (`POST /households/:id/people`, `PUT …/people/:personId`; names unique ignoring case), `editBill`/`deleteBill` (`PUT`/`DELETE /households/:id/bills/:billId`; amounts locked and delete refused once an expense is matched). Client `components/household/SplitEditor.tsx` (also used by Household settings). Not built: removing people.
- **Household recurring bills (up.65):** schedules can be shared with a household (`household_recurring_bills`, migration 0055, backup version 20). `householdService.sharedRecurringBills` adds `recurringBills` to `GET /households/:id` (next pending occurrence, default-split preview, payments in the last 180 days matched to the schedule or by its payee, each flagged shared); `POST /households/:id/recurring-bills` and `DELETE …/recurring-bills/:scheduleId`. Sharing a payment is still the explicit `POST /share`. Client `components/household/RecurringBills.tsx`; the Household page was reordered (balances, recurring bills, statement, collapsed "Record something else", pool-only "Bills to reserve for", history, settings) and loads at most 500 recent payments only while the form is open. Per-bill splits, automatic sharing, bill editing and people came in up.66.
- **HA release stall fixed (up.64):** `homeassistant/package.py` used to strip `--platform=$BUILDPLATFORM`, so the ARM64 image compiled the client under QEMU and the publish step stalled (up.57, up.60, up.63). The build stage now runs natively; PR runs build both architectures without pushing. `v0.2.0-up.63` was tagged but its release was cancelled after the stall, so it is not published; up.64 carries the rebrand.
- **Allotment rebrand (up.63):** the owner detached the fork from `dtymoszenko/FlyBudget` and renamed the repository `tvrooi/Allotment` on 30 October (GitHub redirects the old address). The app is now called Allotment: name, icon, Marigold/Soil/Canvas palette and tagline (`docs/BRAND.md`). Stored identifiers keep `flybudget` (env vars, cookies, data paths, HA slug `flybudget_up`, image names, the packaged desktop app's internal name via `app.setName` in `electron/main.ts`). Desktop apps before up.63 cannot find updates after the move and need one manual install. Follow-ups: the `tvrooi/home-assistant-apps` catalog's own text still says FlyBudget, and the user-guide links went to the upstream flybudget.org site until up.122.
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
- **Live:** `0.2.0-up.83` (UX review: Up-first onboarding, Australian demo, in-app guide, pull to refresh) installed on 3 November around 22:20 local time on the catalog app `24ff2149_flybudget_up` (source commit `1868d92`), after app-only cold backups `41046965` ("Before Allotment 0.2.0-up.83") and `4feb9762` ("Before Allotment 0.2.0-up.83 (final)"), both at up.82, password-protected, no failed apps. Catalog sync run by hand, store reloaded, only Allotment updated (Cloudflared, Matter Server and Music Assistant left alone). Both budgets started, no errors in the log, and `/api/health` answers ok with the allowed host. Client and demo changes, no migrations. Not verified from here: that the budget opens (the app has its own password). Before it: `0.2.0-up.82` (menu bars and buttons) installed on 3 November around 18:55 local time on the catalog app `24ff2149_flybudget_up` (source commit `69e10e9`), after app-only cold backup `dfb3353b` ("Before Allotment 0.2.0-up.82", app at up.81, no failed apps). Catalog sync run by hand, store reloaded, only Allotment updated (Cloudflared, Matter Server and Music Assistant left alone). Both budgets started and `/api/health` answers ok. Client only, no migrations. Before it: `0.2.0-up.81` (the temporary token permission removed) installed on 3 November around 16:30 local time on the catalog app `24ff2149_flybudget_up` (source commit `772ff0a`), after app-only cold backups `72c60c86` (with the recorded Tricount history) and `0e7b3a6e` ("Before Allotment 0.2.0-up.81 (final)"), both at up.80 with no failed apps. Catalog sync run by hand, store reloaded, only Allotment updated (Cloudflared, Matter Server and Music Assistant left alone). Both budgets started, `/api/health` ok, the household reads 198 entries, and the organise token is refused a household entry (403) and no longer lists `record_household_entries`. Before it: `0.2.0-up.80` (repayments paid ahead; the temporary token permission used for the owner's Tricount history) installed on 3 November around 14:55 local time on the catalog app `24ff2149_flybudget_up` (source commit `5d1d2f6`), after app-only cold backups `9fe2a6c0` and `ae3511bc` ("Before Allotment 0.2.0-up.80 (final)", app at up.79, no failed apps). Catalog sync run by hand for `v0.2.0-up.80`, store reloaded, app updated in place: both budgets started, `/api/health` ok, household data readable through the token. Before it: `0.2.0-up.79` (Files; also brings up.76 household pictures, up.77 the "Share with…" menu and up.78 the household repayment fixes) installed on 3 November around 13:45 local time on the catalog app `24ff2149_flybudget_up` (source commit `66c5612`), straight from up.75: up.76–up.78 had not reached the store yet. Before it: app-only cold backups `08d658a3` (13:07, before the catalog could promote up.77), `ccc6e626` (13:32, after #112 merged) and `514f1f29` (13:44, "Before Allotment 0.2.0-up.79 (final)"), all with the app at up.75 and no failed apps. These were made with `hassio.backup_partial` through ha-mcp and are not password-protected, unlike the earlier ones. The catalog sync was run by hand for `v0.2.0-up.79`, the store reloaded and only Allotment updated in place (Cloudflared, Matter Server and Music Assistant updates left alone). Options unchanged; it started with "Allotment multi-user gateway on port 3001: 2 budget(s) running", no errors in the log, and `/api/health` answers `ok` (with the allowed host; the bare internal address gets "Forbidden host", as it should). Migrations 0061 (household logo) and 0062 (Files: one document per existing receipt) run before the server listens, so both budgets starting means they applied. Not verified from here: signing in and the bank connection (the app has its own password); the owner should open the budget and check **Files** shows their receipts. Earlier: up.75 (3 November, backup `d0c0268c`; client only), up.74 (3 November, backup `c0f934b4`; the owner's own May–October rent share recorded by their assistant), up.73 (2 November, backup `07e53a3a`; Juno's and Zephyr's 12 linked rent contributions recorded), up.72 (2 November, backup `2bedcb50`), up.71 (2 November, backup `abf156aa`), up.70 (1 November, backup `25aa02c9`), up.69 (1 November, backup `8177cdce`; client only), up.68 (31 October, backup `9b50febd`; migration 0058, guides and tips), up.67 (backup `eede7265`), up.66 (backup `285cc1e6`), up.65 (30 October, backup `60d27495`), up.64 (backups `a56b814d`, `c183d5ce`), up.62, up.61 and up.59.
- **Live Home Assistant app:** installed from the catalog repository (not the old `local_flybudget_up`), with **Auto update on**. On 7 November it was found on `0.2.0-up.113` (the 6 November household corrections) although auto update was on and the store offered up.126; why it hadn't updated is not known. App-only cold backup `b8874c71` ("Before Allotment 0.2.0-up.129", app at up.113, no failed apps, protected with the default backup password) was taken at 01:13 UTC. The catalog promoted `v0.2.0-up.129` (source commit `cdfe807`; D2a email codes and D2b reminders) at 01:24 UTC, and auto update installed it before the hand-run sync and store reload at 01:38 UTC, straight from up.113, so migrations 0077 to 0079 (0078 rewrites `transactions`) ran in that step. Both budgets started with no errors, stopped budgets or failed starts in the log, `/api/health` answers ok with the allowed host, and `/api/auth/status` reports `canEmail: false` (no `smtp_` options set). Not verified from here: that the budget opens (the app has its own password). On 5 November around 20:25 local time it was updated by hand from up.103 to `0.2.0-up.104` (iPhone home-screen app: the header runs up behind the status bar; source commit `b2ea522`, catalog commit `d8f3442`), after app-only cold backup `02bf7c83` ("Before Allotment 0.2.0-up.104", app at up.103, no failed apps, not password-protected). Catalog sync run by hand, store reloaded, only Allotment updated. Both budgets started, `/api/health` answers ok with the allowed host, and the served page carries `viewport-fit=cover` and `theme-color`. Client only, no migrations. Not verified from here: the look on a real iPhone (the owner re-adds the Home Screen app) and that the budget opens. On 4 November it was found on `0.2.0-up.92`: auto update had moved it from up.83 through the catalog without a "Before" backup (the nightly full backup `ac00bd40`, app at up.83, covers that step). Then app-only backup `3f064315` ("Before Allotment 0.2.0-up.96", app at up.92, no failed apps, not password-protected) was taken at 06:37 UTC, the catalog sync for `v0.2.0-up.96` run by hand (catalog commit `f109ef7`), and only Allotment updated in place (OS, Matter Server and Music Assistant left alone). It runs `0.2.0-up.96` (source commit `eeb69c1`): both budgets started, so migrations 0064 to 0067 applied, and `/api/health` answers ok with the allowed host. Not verified from here: that the budget opens (the app has its own password). Confirm the installed app identity and version before updating.
  A completed release reaches it through the catalog sync (MAINTENANCE.md, step 5) and then its
  auto-update. Before relying on that, verify the installed version afterwards, and take a cold
  backup first when you update it by hand.

## Recent features, and where they are documented

| Feature                                                                                         | PR / version | Design doc                                                         | Main code                                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Australian super: preserved vs accessible wealth, preservation age                              | #52 / up.40  | `docs/INVESTMENTS.md`, `docs/LONG-TERM-FORECAST.md`                | `server/src/services/` forecast and investment services                                               |
| HECS-HELP and Student Start-up Loan: CPI indexation, compulsory repayment bands, extra payments | #53 / up.41  | `docs/LONG-TERM-FORECAST.md`, `docs/FORECASTS.md`                  | forecast services and the debt UI                                                                     |
| Receipts, receipt inbox, tax deductions (ATO labels, FY exports)                                | #54 / up.42  | `docs/RECEIPTS-AND-TAX.md` §1–4                                    | `receiptService.ts`, `taxService.ts`, `routes/receipts.ts`, `routes/tax.ts`                           |
| Receipts tab (Monarch parity): matching, autosplit, Split by items                              | #55 / up.43  | `docs/RECEIPTS-AND-TAX.md` §5                                      | `receiptMatching.ts`, `client/src/components/receipts/`                                               |
| Reading receipts with a chosen model                                                            | #56 / up.44  | `docs/RECEIPTS-AND-TAX.md` §5, "Reading photos with a local model" | `receiptReader.ts`, `receiptSample.ts`                                                                |
| Overspending resets each month (YNAB), card funding month by month                              | #57 / up.45  | `docs/ENVELOPE-FUNDING.md`, `docs/CARD-PAYMENTS.md`                | `budgetService.ts` (`rollOver`), `cardFunding.ts`                                                     |
| Ready to assign follows YNAB: signed envelopes, cash vs credit overspending, month-aware guard  | #61 / up.47  | `docs/ENVELOPE-FUNDING.md` (Ready to Assign)                       | `budgetService.ts` (`fundingState`), `budgetMoves.ts` (`fundedWrite`), `readyToAssign.test.ts`        |
| Category merge keeps assignments; groups with history can't be deleted                          | #64 / up.49  | `docs/research/actual-flybudget-gaps.md` (ACT-01)                  | `routes/categories.ts` (`mergeCategory`), `categoryMerge.test.ts`                                     |
| One-pass, cached envelope ledger                                                                | #65 / up.50  | `docs/ENVELOPE-FUNDING.md` ("One pass, cached")                    | `budgetLedger.ts`, `budgetEngine.test.ts`                                                             |
| Envelopes funded by transfers to a linked account (Rent → Rent saver)                           | #68 / up.52  | `docs/ENVELOPE-FUNDING.md` (Envelopes linked to an account)        | `budgetLedger.ts` (`linkedTransfers`), `routes/categories.ts` (`linkError`), `linkedEnvelope.test.ts` |
| Afterpay and other pay-later plans: real-category purchases, confirmed instalment links         | #92 / up.67  | `docs/PAYMENT-PLANS.md`                                            | `paymentPlanService.ts`, `routes/paymentPlans.ts`, `client/src/components/plans/`                     |
| Guides and tips: welcome tour, page guides, tips, per-person progress                           | up.68        | `docs/GUIDES.md`                                                   | `guideService.ts`, `routes/guides.ts`, `client/src/guides/`, `client/src/components/guide/`           |
| Files: document library, many-to-many links, labels, search inside, videos, share target        | #112 / up.79 | `docs/FILES.md`                                                    | `documentService.ts`, `fileStore.ts`, `routes/files.ts`, `client/src/components/files/`               |

Allotment's own guide is `client/src/userGuide/` (served at `/guide`); the upstream Docusaurus
site in `website/` was removed (audit decision I-9).

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

0. **November 2026 owner requests (built in up.131):** after release, zero the live household
   through **Reconcile balances** once the owner confirms the preview, and set up Essentials' own
   Ready to assign.
1. **Confirm the live app after each release:** version, health, and that the budget opens. In
   November, check the October deficits no longer carry. Ask the owner to choose a receipt
   provider (Anthropic or OpenAI key) and press **Try a sample receipt**.
   Auto update is on: take the cold backup before the store sees a new release.
2. **Owner's own setup, outside Allotment:** any local model server the owner keeps should not be
   published on the host's ports; Allotment needs only an internal address, or none with a cloud
   provider.
3. **Multi-user (separate budgets per person):** built in `0.2.0-up.48` (`server/src/gateway/`,
   `docs/MULTI-USER-PLAN.md`, `homeassistant/DOCS.md`) and turned on live on 29 October (see
   State). Confirm the owner has signed in with the setup code and their budget opened with its
   data, Up sync and access tokens intact. Email codes are built (up.128, D2a; the owner sets the
   `smtp_` options to turn them on), and so are reminders through the gateway (up.129, D2b);
   both are in `docs/MULTI-USER-EMAIL-AND-REMINDERS.md`. Shared households are combined
   households (up.58).
4. **Gaps found in the 26 October audit** (not built or not documented):
   - User guide pages for payday plans, budget review, card payments and the long-term
     forecast are written (up.121), and every article is linked from its page.
   - YNAB budget backlog in `docs/research/ynab-flybudget-budget-gaps.md` (PR #41): BUD-02 and
     BUD-03 are done (up.109), BUD-07 (up.112), BUD-06 (up.115), BUD-09 (up.116), and BUD-05 and
     BUD-10 (up.117): the YNAB backlog is built. BUD-01 fixed in up.46.
   - Household splitting backlog from the Spliit comparison in
     `docs/research/spliit-household-gaps.md`: SPL-01, SPL-02, SPL-06 (up.106) and SPL-03, SPL-04
     (up.107) and SPL-05 (up.108) are built; the P3 items (SPL-07 to SPL-09) wait for demand.
   - B9 is done (up.119): housemates' money is never income; see HOUSEHOLDS.md "Recurring and
     the dashboard". The Budgeting group's PR list (B1 to B9) is complete.
   - Transaction detail previous/next is built (up.120); a link per transaction is not.
   - Future-month money moves; money age (deliberately not built, see BUDGET-REVIEW.md).
   - Investments deferrals (sales, dividends, franking); receipts §6 (PDF reading, email
     forwarding, logbooks, depreciation, WFH hours).
   - The legacy `recurring_transactions` cleanup is done (up.123, migration 0078).
5. **Receipt providers (up.98) follow-ups:** Anthropic's structured output is done (up.124); a
   cost note per read if the owner wants one.
6. **Left from the 31 October review**, rechecked by the 3 November audit. Fixed: Ready to assign
   above cash after a first Up import (up.86, a new budget starts that day), and the demo's
   negative Ready to assign (up.83). Partly superseded: Up's Saver transfers count as
   uncategorised spending only when one leg is unmapped (with both legs on budget they net to
   zero); they still need reviewing as transfers; up.118 lists the pairs Up reported first in the
   register's review, for the owner to link (owner rule: no silent links). Settings → Server's self-hosting link now opens this repository's
   Start here guide, and Enable Banking's setup steps are the guide's `enable-banking` page
   (up.122): no help link goes to flybudget.org. Done: incremental Up fetch (F-10, up.93),
   route splitting (F-11, up.100).
7. **Depreciating assets on Tax time (phases 1 to 3 released, up.94 to up.96):** owner request of 3 November.
   [docs/DEPRECIATING-ASSETS-PLAN.md](docs/DEPRECIATING-ASSETS-PLAN.md) has the ATO rules
   (prime cost and diminishing value), the design, four phases and five owner decisions (§7).
   The owner took the five decisions on 4 November: low-value pool in phase 3; organise tokens
   read assets, and an assistant's changes are proposals the owner approves one at a time
   (through audit decision I-11's endpoints; read only until they exist); lodged years lock; a
   short built-in list of effective lives with ATO links (phase 2); out of scope confirmed.
   Phase 1 (server) is built: `services/depreciation.ts` (pure), `depreciatingAssetService.ts`,
   routes under `/tax/assets` and `/tax/lodged`, migration 0066, backup version 24, MCP `tax_assets`
   (read only). Phase 2 (up.95) adds the screens: Tax time → **Assets** (`client/src/components/tax/Assets.tsx`:
   list, add/edit with both methods previewed and suggested lives, detail with schedule, per-year
   work use, Records, disposal, removal; lodged-year buttons), asset rows in Deductions, **Depreciate
   instead** on claims over $300 and in the transaction panel (prefill passed as navigation state;
   there is no single-transaction GET), and the `asset` link kind in Files. Test:
   `e2e/tests/depreciating-assets.spec.ts`. Phase 3 (up.96) adds the low-value pool (D6):
   migration 0067 (`depreciating_assets.pooled_fy`), backup version 25, `poolSchedule`,
   `poolEntryFor` and `poolEntryOf` in `depreciation.ts` (18.75% for low-cost assets in their first
   year, 37.5% of the opening balance and low-value additions, taxable shares fixed at allocation,
   termination values off the balance with any excess as income), `PUT`/`DELETE
/tax/assets/:id/pool`, `GET /tax/pool` (organise tokens may read it; MCP `tax_assets` includes
   it), D6 in the tax year, CSV, schedule and ZIP. Lodged-year locks compare each lodged year's
   asset and pool figures before and after any change. Phase 4 (second-element costs, effective
   life recalculation, a D1 car limit warning) is optional and not planned. An asset's records
   are files linked to it (an `asset` link kind). Still to do: once live, ask the owner to try
   it on a real purchase; the assistant proposes assets with `propose_tax_asset` (up.99).
8. **Files (up.79) follow-ups:** live since 3 November. Ask the owner to confirm Files lists their
   receipts; confirm the HA app's `/data/flybudget/budget-files/` is created only
   once a video over 25 MB is added. Not built: an email inbox (deliberately), files for tokens,
   video thumbnails, OCR of scanned PDFs.
9. **Next fixes from the competitor comparisons** (`docs/research/`, PR #63): SEC-01 duplicates
   and FINX-01 the schedule timer are done (up.102), as are SEC-01's import history and "undo
   this file" and FINX-02 reminders (up.103; for multi-user budgets, through the gateway, up.129). ACT-04 per-category overspending is done (up.110) and so is ACT-03 hold for
   next month (up.111); ACT-05 month quick fills and BUD-07 selected-category funding are done
   (up.112); BUD-06 row-anchored moves and returning money to Ready to assign (up.115).

10. **Audit roadmap, next round** ([docs/AUDIT-2026-11.md](docs/AUDIT-2026-11.md) section H): Stage 1
    leftovers are financial property tests across transfers, cards, splits, linked envelopes and
    household pools, plus "sync twice equals sync once" (F-16); deleted-import memory for Enable
    Banking and SimpleFIN like Up's `up_deleted_imports` (F-14, probable, verify first). Stage 2:
    ESLint with `react-hooks` and `jsx-a11y` in CI (F-08); one term per concept and neutral zeros
    (F-09); one onboarding surface (F-12); one service per action family for sharing and assigning
    (F-13); a declarative token policy (F-18); treat bank-synced accounts as reconciled to the sync
    date (F-17). Stage 3: route splitting and removing the unused `emoji-picker-react` (F-11),
    incremental Up fetch (F-10), the remaining accessibility fixes (F-15), docs drift (F-19, G.2).
    Owner decisions I-4 to I-11 were taken on 4 November (audit section I, "Owner decisions"):
    grouped sidebar with progressive disclosure, System theme, a backup ZIP with files, tour-first
    onboarding, an offer to categorise a repayment back to the shared expense's category, remove
    `website/`, freeze Plaid/SimpleFIN/Enable Banking as community supported and show CSV import
    as an option, and dedicated assistant endpoints with their own audit log (replacing F-18's
    declarative token policy). F-14 now applies only to a provider in use. I-10 is done (`components/banks/CommunitySupported.tsx`; policy in MAINTENANCE.md, Current limits). F-17 is done: Review doesn't ask to reconcile an Up account that matched Up at the last sync (`services/bankVerified.ts`, derived, no rows changed). I-6 is done: Settings → Data → Backup with files (`services/backupArchive.ts`, docs/FILES.md §2). F-10 is done: Up syncs fetch the last 14 days before the newest row plus open holds, with a full sweep weekly, on the first sync, on Check all history and on Up review's Restore (`upSyncService.ts`, migration 0065). F-08 is done (ESLint, `lint/README.md`; lower its
    warning cap as accessibility warnings are fixed) and so is I-4 (sidebar groups and optional
    features, `client/src/utils/navFeatures.ts`, migration 0064). F-16 is done:
    `server/src/services/budgetProperties.test.ts` and `server/src/routes/upSyncProperties.test.ts`
    (fast-check; `PROPERTY_RUNS=500` searches harder). The short template's missing envelopes were
    answered by up.87's nearest-envelope names and up.98's learning from the owner's own choices;
    Up slugs with no sensible envelope (pets, gambling, tobacco, cycling, parking) stay
    uncategorised until the owner's habit teaches them.
    I-7 is done (up.97): tour first, one onboarding element at a time (docs/GUIDES.md, "Tour
    first"). I-11 and I-8 are done (up.99), F-11, F-13 and F-14 (up.100). F-22 and F-23 are done (up.102). F-09, F-15, F-19, F-20
    and F-24 are done (up.105; what is left of each is under State).
    Work in feature PRs with tests; the owner reviews and merges.

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

11. **When a household person joins Allotment** (owner's note, 3 November): once the other person in the
    owner's two-person household has their own Allotment, entries they paid will need linking to their
    bank payments on their side too. Today a household entry links only the owner's payments; design how a member's own budget links
    theirs before they join. _Design written 5 November 2026:_ `docs/HOUSEHOLD-PARTNER-LINKS.md`
    (recommends a claim row in the partner's budget, nothing copied between budgets). Owner chose
    that approach (anyone may enter "Alex paid"; settlements too; claims kept hidden on Stop
    combining); decisions 4, 5, 7, 8 and 9 on that page are still open; no code built.
