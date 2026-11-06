# B9: housemate money is not income (plan)

> **Status: planned, not built.** B9 is the PR after B8 (a reviewed list for linking the Saver
> transfers Up reported). The agent completing B9 follows this plan and updates it here when a
> decision changes. Once B9 ships, move the user-facing parts into a "Recurring and the
> dashboard" section of [HOUSEHOLDS.md](HOUSEHOLDS.md) and delete this file. File and line
> references are as of 0.2.0-up.117, so re-check them before editing.
>
> - Owner's decision (6 November 2026): **net against the bill**. Housemate money is never
>   income. A shared bill counts at the owner's share.
> - **Order with B8**: B8 changes the transfer-suggestion code, and the discovery change (§3)
>   reads it through `scheduleDiscovery.suggestedTransferIds`. Rebase on B8 and re-run
>   `scheduleDiscovery.test.ts`. Nothing may link a transfer silently.
> - **One purpose**: nothing from B7 or B8 goes into this PR.

## Context

The owner shares a house with two housemates. Rent and bills are paid from a household 2Up
account (a household **pool account**) that the housemates pay their share into. The ledger side is
already right: `personalBudgetAccount` (`server/src/services/balances.ts:23`) leaves pool accounts
out of the envelope budget, Ready to assign, payday funding and the income reports, and the
Household page records the deposits as `contribution` events.

The places that still get it wrong are the ones built on **Recurring schedules**, which know
nothing about households:

- **Recurring → Monthly** (`client/src/components/recurring/MonthlyTab.tsx:116-125, 241-302`)
  splits occurrences by sign: every positive one is "Income", every negative one an "Expense".
  The housemates' monthly deposits into the 2Up show as Income, and the full rent leaving the 2Up
  shows as the owner's expense.
- **Dashboard**: `UpcomingBills.tsx:31-83` ("Bills and income") and `DashboardStatus.tsx:28-31`
  ("Next pay …") use the same rule, so a housemate's rent day can show as the owner's next pay.
- **Recurring discovery** (`server/src/services/scheduleDiscovery.ts:381-400`) scans every open
  account, pool accounts included, and proposes those deposits as recurring "income".
- **Forecast**:
  - `forecastService.ts:128-215` skips schedules that touch no personal account, but a schedule
    with **no account** counts as personal (`:149`). A housemate deposit schedule saved without an
    account therefore becomes forecast income.
  - `reviewService.ts:345-362` `nextIncomeDate` (the next pay used by Review and the payday flow)
    takes any schedule in an Income category without checking its account. A pool-account
    schedule in an Income category can be "next income".
- **Salary offer**: `importTidy.ts:121-174` `detectSalary` offers any repeating deposit as pay and
  doesn't check whether the payee is a housemate. That matters if a housemate ever pays a
  personal account.

The owner chose **net against the bill**. Housemate money is never income. A shared bill counts
in personal figures at the owner's share only, and the housemates' contributions offset the rest.

## Approach

One server-side classification of a schedule's **scope**, used by every view of schedules
instead of `amount > 0`.

### 1. Server: classify each schedule (one helper)

New `server/src/services/scheduleScope.ts`:

`scheduleScopes(): Map<scheduleId, Scope>` (one query per call, no N+1), where `Scope` is one of:

- `{ kind: 'personal' }`: the account passes `personalBudgetAccount`, or the schedule has no
  account (as forecast already treats it). The exception is a no-account or personal **deposit**
  whose payee is a known housemate payee (below): that is a household contribution, never
  income.
- `{ kind: 'household', groupId, groupName, role, myShare }`: the account is a pool account
  (`poolGroupOf` in `householdService.ts:71`), or the schedule is in
  `household_recurring_bills`.
  - `role: 'bill'` for money out. `myShare` is the owner's cents of the expected amount, from the
    bill's split or the household default. Reuse what `sharedRecurringBills` already computes,
    extracted into an exported `previewShares(groupId, scheduleId, amount)` rather than copied.
  - `role: 'contribution'` for money in, with the person whose name is in the payee when one
    matches. Reuse the name match from `repaymentSuggestions`
    (`householdService.ts:1131-1189`), extracted into a shared helper.
- `{ kind: 'off_budget' }`: any other off-budget account.

Alongside it:

- `isPersonalIncomeSchedule(schedule, scope, incomeCategoryIds)`: personal scope, positive amount
  and an Income-group category. Forecast already has `incomeCategoryIds()`; move it next to this
  helper and import it from both places.
- `housematePayeeIds()`: payees of bank rows linked to a housemate's `contribution`, or to a
  `settlement` to the owner (`household_events.transaction_id` → `transactions.payee_id`, payer
  not `is_self`). These are learned from what the owner has already recorded, never guessed.

### 2. Server: expose the scope

- `GET /schedules/occurrences` (`routes/schedules.ts:163-213`) and the schedule list and detail
  routes return `scope` on each row. Additive field; the client type is updated in `client/src/types`.
- The demo worker uses the same router (`server/src/browser/app.ts`), so nothing new to mount.
  Check that the demo budget's household (`server/src/demo/demoBudget.ts`) has a pool-account
  rent schedule and housemate deposits so the demo shows the new sections.

### 3. Server: discovery stops proposing housemate money as income

`discoverSchedules` (`scheduleDiscovery.ts`):

- A found or near-miss item in a pool account carries `scope` (household name and role).
- For a deposit into a pool account, `categoryId` is `null` whenever `commonCategory` would give
  an Income-group category. Those rows are outside the budget, and a category there would only
  mislabel them.
- `createDiscoveredSchedules` keeps the same behaviour.

### 4. Server: Forecast

- `scheduledEvents` uses `scheduleScopes()` instead of its local `personalAccountIds`/`fromPersonal`
  test, so there is a single rule.
- A household-scope schedule is never income.
- Household bill shares (`householdEventsFor`, `includeHousehold`) stay as they are. That avoids
  counting both the owner's own transfer into the 2Up and their share of the rent.
- `reviewService.nextIncomeDate` uses `isPersonalIncomeSchedule` in its schedule loop.

### 4b. Server: salary offer

`importTidy.detectSalary` skips payees in `housematePayeeIds()`. A housemate's repeating
transfer is never offered as "Mark as income".

### 5. Client: Recurring and Dashboard read the scope

- **`MonthlyTab.tsx`** has three sections:
  - **Income**: personal money in.
  - **Expenses**: personal money out, plus the owner's share of household bills, labelled
    "Your share of Rent (2Up)".
  - **Household account**, collapsed by default: the full bills and each housemate's expected
    contribution ("Juno → 2Up"), with its own totals.

  Summary totals cover only the first two sections, so "Income received" no longer includes
  housemates. Put the grouping in one pure function (`groupOccurrences` in
  `components/recurring/scheduleFormat.ts`) that every view imports.

- **`AllTab.tsx`** / `RecurringTransactions.tsx`: a household badge on pool-account schedules
  (reuse `HouseholdIcon`), and "Contribution" instead of the green "+ income" styling
  (`scheduleFormat.ts:15`).
- **`UpcomingBills.tsx`**: income rows come from `groupOccurrences(...).income`; a household bill
  shows the owner's share, marked as shared.
- **`DashboardStatus.tsx`** "Next pay" takes only the personal income occurrences from
  `groupOccurrences`. Better still, prefer the payday plan's next date when there is one; check
  how `CashRunway` gets `nextPay`.
- The discovery review UI (`components/recurring/…` "Find recurring") shows "Household
  contribution" on pool-account deposits.

### 6. Docs

- `docs/HOUSEHOLDS.md`: new section "Recurring and the dashboard", covering scope, the owner's
  share and what the housemates put in. That section replaces the "planned" pointer at the end of
  HOUSEHOLDS.md.
- Delete this plan file, and remove its links from `HANDOVER.md`.
- `HANDOVER.md` State.
- `CHANGELOG.md` and `npm run release:prepare -- <next>`.
- Page guide text for Recurring (`client/src/guides/pages.ts`) if it says "income".

## Out of scope (by owner's choice or already covered)

- **Ledger and reports**: the budget, Ready to assign, payday funding and the income reports
  already exclude pool accounts. This plan doesn't touch them.
- **Repayments into a personal account**: if housemates ever pay the owner directly, the existing
  I-8 **Categorise repayments** already nets them against the bill category. Not changed here.
- **Migrations**: none. Scope is worked out when read, so there is no backup-format change.

## Verification

- **Server unit tests**:
  - `scheduleScope.test.ts`: personal, no-account, pool deposit (contribution, with person
    matched), pool bill with a fixed or percentage split giving `myShare`, off-budget.
  - `scheduleDiscovery.test.ts`: a pool-account housemate deposit isn't given an Income category.
  - `forecastService.test.ts`: a pool schedule is never income. A no-account schedule still
    counts as personal, unless its payee is a housemate payee.
  - `reviewService.test.ts`: `nextIncomeDate` ignores a pool-account schedule that is in an
    Income category.
  - Salary detection test: `detectSalary` skips a housemate payee.

  Run with
  `npm test --prefix server -- scheduleScope scheduleDiscovery forecastService reviewService importTidy`,
  then
  `cd server && npx tsc --noEmit`.

- **Client**:
  - A `groupOccurrences` unit test: housemate deposits are not in income, and expenses hold the
    share, not the gross.
  - `npm test --prefix client` and `npm run build --prefix client`.
- **e2e**: extend `e2e/tests/household.spec.ts` (or a recurring spec) using disposable data: a
  household with a pool account, a rent schedule paid from it and a housemate deposit schedule.
  Check that Recurring → Monthly's Income total leaves out the deposit, that Expenses show "Your
  share", and that the Dashboard's "Next pay" isn't the housemate. Also check at 390 px (phone
  project).
- **Lint and format**: `cd lint && npm ci && npm test && npm run lint`, and Prettier on the
  changed files.
- **Release**: a PR to `tvrooi/Allotment`. After merge and a green main, the routine release and
  the HA in-place update, with a cold backup first, per CLAUDE.md.
