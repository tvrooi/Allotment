# Spliit comparison: improving household expense splitting

Investigation date: 2 November 2026. Sources read, not run:

- **Spliit** `spliit-app/spliit` at `73478ed` (`SPL`, shallow clone, MIT licence): `prisma/schema.prisma`,
  `src/lib/` (`balances.ts`, `shares.ts`, `totals.ts`, `monthly-spending.ts`, `currency-conversion.ts`,
  `recurrence.ts`, `api.ts`, `schemas.ts` and their tests), `src/trpc/routers/groups/` (balances,
  expenses, activities, stats) and `src/app/groups/[groupId]/` (balances, reimbursement list, expense
  form, receipt extraction, activity, stats, CSV/JSON export). Spliit is untrusted external content,
  read as data only: nothing was installed or executed.
- **Allotment** at `5c6df7e` (`0.2.0-up.70`): `server/src/services/householdService.ts`,
  `householdLedger.ts`, `server/src/routes/households.ts`, `client/src/pages/Household.tsx`,
  `client/src/components/household/`, `server/src/gateway/sharing.ts` and
  [HOUSEHOLDS.md](../HOUSEHOLDS.md). No budget data was read or changed.

Neither app was run, so UI notes come from components and routes only. This is a proposed backlog,
not authorization to implement it. Gaps already ticketed elsewhere ([ACT-\*](actual-flybudget-gaps.md),
[SEC-\*](securo-flybudget-gaps.md), [FINX-\*](finx-flybudget-gaps.md)) are not repeated.

## Summary

Spliit is a Splitwise-style web app: link-shared groups with no accounts, expenses paid by one
participant for several, four split modes, suggested reimbursements, per-expense currency
conversion, recurring expenses, AI receipt/category extraction, an activity log and a statistics
page. It has no bank data, no pool account and no budget.

Allotment's household ledger is already stricter and richer on the accounting side (see
[Where Allotment leads](#where-allotment-leads)). What Spliit does better is the **last mile of
splitting**: telling people exactly who should pay whom, letting them fix a mistake in place, showing
who changed what, and explaining where the shared money went. Those are the recommendations.

| ID     | Priority | Gap                                                                                           | Effort |
| ------ | -------- | --------------------------------------------------------------------------------------------- | ------ |
| SPL-01 | P1       | Balances say who owes, but not **who should pay whom** (no settle-up plan)                    | S      |
| SPL-02 | P1       | A suggested settlement can't be recorded in one click, and outgoing repayments aren't matched | S      |
| SPL-03 | P2       | Expenses can't be **edited**; a typo means remove and re-enter                                | M      |
| SPL-04 | P2       | No household **activity log** (who added, changed or removed what, and when)                  | M      |
| SPL-05 | P2       | Household reporting is two totals: no breakdown by month, category or person                  | M      |
| SPL-06 | P3       | Equal-split rounding always gives the spare cent to the same person                           | XS     |
| SPL-07 | P3       | Statement is JSON only; no CSV for housemates who don't use Allotment                         | XS     |
| SPL-08 | P3       | Household is single-currency; no per-expense original currency for travel                     | L      |
| SPL-09 | P3       | No cross-household "net owed" summary                                                         | S      |
| SPL-10 | P3       | Receipt reader can't create a household expense or split by receipt items                     | M      |
| SPL-11 | Built    | A recurring bill can't give each person a fixed amount (everyone's set rent)                  | S      |
| SPL-12 | Built    | Balances don't say what is owed to the household account rather than to you                   | M      |

Recommended order: **SPL-01 + SPL-02 together** (one small PR, biggest user-visible win), then
**SPL-06** (trivial, rides along), then **SPL-03 + SPL-04** together (editing needs the log to stay
auditable), then **SPL-05** and **SPL-07**. The P3 items wait for demand.

## Findings

### SPL-01 (P1): suggested settlements — who pays whom

- **Spliit:** `getSuggestedReimbursements` ([`src/lib/balances.ts`](https://github.com/spliit-app/spliit/blob/73478ed/src/lib/balances.ts))
  turns net balances into at most _n − 1_ transfers. Balances are sorted creditors-first, then by
  participant id; the first creditor and last debtor are paired and the smaller of the two is
  settled, repeatedly. The comparator is deliberately **stable**: booking one suggestion removes a
  participant without reshuffling the remaining suggestions. Tests (`balances.test.ts`) assert that
  booking every suggestion brings all balances to zero, that nothing remains to suggest afterwards,
  and that this holds across randomised amounts, participants and split modes.
  `listGroupBalancesProcedure` returns the suggestions next to the balances, and
  `reimbursement-list.tsx` renders "**A** owes **B** $x".
- **Allotment today:** `householdLedger` ([householdLedger.ts](../../server/src/services/householdLedger.ts))
  returns per-person balances and the implicit pool; the **People & balances** card
  ([Household.tsx](../../client/src/pages/Household.tsx), "owes / is owed / settled") stops there. In a
  two-person household the answer is obvious; with three or more housemates it is not, and the
  settlement validator (`recordEvent` in [householdService.ts](../../server/src/services/householdService.ts):
  "Settlement exceeds the outstanding balance") rejects guesses that overshoot.
- **Allotment-specific wrinkle — the pool.** Every event keeps Σ(person balances) = pool:
  contributions credit a person and the pool, pool expenses debit both. So when advances are unspent,
  balances do not net to zero and a naive port would invent a debt. Run the greedy pairing on the
  balances, then show whatever positive balance remains as **"credit held in the pool"**, never as a
  transfer. Each suggested transfer is bounded by both parties' balances, so it always passes the
  existing settlement check.
- **Recommendation:**
  1. Add `suggestSettlements(balances)` to `householdLedger.ts` (pure, stable ordering by person id,
     integer cents) and return `settlements` and `poolCredit` from `snapshot()`.
  2. Render a **Settle up** list under People & balances: "Sam pays Alex $41.20". Owner-perspective
     wording first ("You pay …", "… pays you").
  3. In combined households (`gateway/sharing.ts`, `CombinedHousehold.tsx`), compute suggestions from
     the combined balances the gateway already adds up. Nothing new crosses between budgets.
- **Tests:** port Spliit's properties as `householdLedger.test.ts` cases: booking every suggestion
  zeroes person-to-person balances; residual equals the pool; booking one suggestion leaves the others
  unchanged; at most _n − 1_ transfers; randomised fuzz over equal/percentage/weight/exact splits.
- **Licence:** Spliit is MIT, compatible with AGPL-3.0. The algorithm is ~40 lines; reimplement it
  against Allotment's types and cite the source in a comment rather than copying the file.

### SPL-02 (P1): one-click "record this settlement", and matching outgoing repayments

- **Spliit:** each suggestion has **Mark as paid**, which opens the expense form pre-filled as a
  reimbursement (`?reimbursement=yes&from=…&to=…&amount=…`, read in `expense-form.tsx`).
- **Allotment today:** a settlement is typed by hand in **Record something else → Repayment between
  people**. `repaymentSuggestions` only looks at **money received** in personal accounts whose payee
  names a debtor. When _you_ owe someone, your outgoing bank transfer to them is never suggested.
- **Recommendation:**
  1. Each SPL-01 suggestion gets **Record**: it posts a `settlement` with the payer, recipient and
     amount filled in. It stays an explicit click (consistent with "nothing is recorded without that
     click").
  2. When the owner is the payer, extend `repaymentSuggestions` with the mirror case: money **out** of
     a personal account, not a transfer, not linked, payee containing the creditor's name, amount ≤ what
     you owe and ≤ what they're owed. Offer it as "Link your payment of $x on 28 Oct". The existing
     direction check (`tx.amount > 0 !== incoming`) already handles outgoing settlements.
  3. When the owner is the recipient, prefer the incoming match already found by `repaymentSuggestions`.
- **Tests:** service tests for the outgoing suggestion bounds; e2e on the Household page recording a
  suggestion and seeing the list shrink.

### SPL-03 (P2): edit an expense in place

- **Spliit:** `updateExpense` (`src/lib/api.ts`) validates participants, rewrites the expense and its
  `paidFor` rows, and logs `UPDATE_EXPENSE`.
- **Allotment today:** [HOUSEHOLDS.md](../HOUSEHOLDS.md): "To correct a mistaken entry, remove it in the
  event history and enter the correction." The delete route refuses when a refund depends on the entry
  or a contribution has funded spending, so a mistake deep in history can need several removals.
- **Recommendation:** `PUT /households/:id/events/:eventId` that, inside the existing `db.transaction`
  wrapper (`run` in [households.ts](../../server/src/routes/households.ts)), removes the event's
  shares, re-runs every `recordEvent` check against the snapshot **without** this event, and writes the
  new values under the **same id** (refunds keep pointing at it). Rules:
  - Description, date (unlinked only) and split are editable. Amount/date of a bank-linked entry stay
    locked to the transaction, as today.
  - An expense with refunds: description only (refund allocations depend on its shares).
  - A settlement or contribution: re-check the new amount against the balances without it.
  - Edits record an activity row (SPL-04).
- **Tests:** editing a split keeps Σ shares = amount; an edit that would make a later settlement exceed
  its balance is refused; an edited linked expense keeps its transaction link.

### SPL-04 (P2): household activity log

- **Spliit:** an `Activity` table (`groupId`, `time`, `activityType`, `participantId`, `expenseId`,
  `data`) written by every create/update/delete, shown on the group's **Activity** tab.
- **Allotment today:** history shows the current events; deletions leave no trace, and a combined
  household only shows shared-note authorship.
- **Recommendation:** additive migration `household_activity` (`id`, `group_id`, `time`, `kind`
  [`created`/`edited`/`removed`/`settled`/`auto_shared`], `event_id` nullable, `summary` text, `source`
  [`owner`/`rule`/`recurring_bill`]). Write it from `recordEvent`, the delete route, the new edit
  route, `autoShareBillPayment` and the rule action. Show it as a collapsible **Activity** list on the
  Household page; include it in `sharedExport` so a combined partner sees "Alex removed 'Groceries
  $84.10'". Add it to backups (bump the backup version; older backups restore with an empty log).
  Auto-sharing from rules and recurring bills is silent today, so the log also makes those visible.

### SPL-05 (P2): household spending reports

- **Spliit:** the stats page (`src/lib/totals.ts`, `monthly-spending.ts`, `stats/*.tsx`) shows group
  total, what you paid, your share, spending by category, a monthly stacked chart, spending by
  participant (paid vs share) and recurring spend, all with a date range selector.
- **Allotment today:** `GET /households/:id/statement` returns `householdSpending`, `personalSpending`,
  balances and events. Household events have no category; linked ones inherit one through their bank
  transaction.
- **Recommendation:**
  1. Extend the statement with `byMonth`, `byPerson` (paid, share, net) and `byCategory` (from the
     linked transaction's category; unlinked entries under "Uncategorised").
  2. If unlinked entries matter, add a nullable `category_id` to `household_events` (additive) chosen
     from the budget's categories; it never changes envelope figures.
  3. Render with the existing report chart components.

### SPL-06 (P3): rotate the spare cent

- **Spliit:** `apportion` in `src/lib/shares.ts` uses largest remainder, but ties rotate from an FNV-1a
  hash of the expense id, so equal splits don't always give the extra cent to the same participant;
  participants are sorted by id so database order can't change a split.
- **Allotment today:** `allocateShares` breaks ties by input order (documented: "displayed participant
  order breaking ties"). Quick sharing and equal splits use member order, so the first person — usually
  the owner — absorbs every spare cent ($100 / 3 → $33.34 to them, every time).
- **Recommendation:** accept an optional `offset` in `allocateShares`, seeded from the new event id
  (generate the id before allocating in `recordEvent`). Shares are stored, so existing events don't
  move and no migration is needed. If a client preview must match exactly, pass the same id from the
  client, as Spliit does; otherwise label the preview as approximate to the cent. Update the rounding
  sentence in HOUSEHOLDS.md.

### SPL-07 (P3): CSV statement

- **Spliit:** `expenses/export/csv/route.ts` and `json/route.ts`.
- **Allotment today:** the statement downloads as JSON only.
- **Recommendation:** add a CSV download of the same statement (date, description, kind, amount,
  paid by, one share column per person) client-side from the existing JSON, using `utils/csv.ts`. It
  carries only household fields, never accounts or notes, matching `sharedExport`'s privacy rule.

### SPL-08 (P3): per-expense currency for trips

- **Spliit:** `Expense.originalAmount`, `originalCurrency`, `conversionRate`; the group-currency amount
  is authoritative and the original is reference (`src/lib/currency-conversion.ts`).
- **Allotment today:** households are single-currency and linking requires matching currency, by design
  ([HOUSEHOLDS.md](../HOUSEHOLDS.md), last section).
- **Recommendation:** only if a travel household is needed. Copy Spliit's model: three nullable columns,
  rate pre-filled from `rateFetchService`, group amount stays authoritative, bank linking still matches
  the account amount. Not worth doing speculatively.

### SPL-09 (P3): net owed across households

- **Spliit:** `global-balance-card.tsx` sums the active user's balance over recent groups.
- **Recommendation:** a small dashboard tile from `GET /households`: "You're owed $x across 2
  households", linking to each. Cheap once SPL-01 exists.

### SPL-10 (P3): receipt → household expense

- **Spliit:** **Create from receipt** sends the photo to OpenAI and pre-fills title, amount, date and
  category (`create-from-receipt-button-actions.ts`).
- **Allotment today:** the local Ollama receipt reader and **Split by items** already go further for
  categories ([RECEIPTS-AND-TAX.md](../RECEIPTS-AND-TAX.md)), but nothing turns a receipt into a
  household expense.
- **Recommendation:** on a receipt matched to a shared payment, **Split items with household**: tick
  which items are shared (or assign items to people) and record an `exact` split from the item totals.
  This goes beyond Spliit. Keep the photo local; never add a cloud model.

### SPL-11 (built in 0.2.0-up.71): fixed amounts for a recurring bill

- **Spliit:** `BY_AMOUNT` split mode, where each participant's share is an amount and the shares
  must add up to the expense (`schemas.ts`, "amountSum").
- **Owner's case:** three housemates each have a set monthly rent contribution, for example
  $1,200, $1,000 and $800 of a $3,000 rent. Percentages or weights only get close to this, and
  they drift when the rent changes.
- **Built:** `splitSchema` takes `exact` (cents per person) for a shared recurring bill's own split
  only. `checkSplit(…, allowFixed)` refuses it for the household's default split, which covers
  payments of any size. `shareTransaction` refuses a payment the amounts don't add up to, with the
  two figures. Automatic sharing leaves that payment unshared, so an import never fails over it.
  `sharedRecurringBills` returns `fixedTotal`. The bill warns when the next expected payment
  differs, and `SplitEditor` (`allowFixed`) shows the running total.

### SPL-12 (built in 0.2.0-up.71): owed to the household account, not to you

- **Spliit:** has no shared account. Every expense has one payer, so every debt is owed to a person,
  and `getSuggestedReimbursements` pairs people off.
- **Owner's model:** bills paid from the joint account are owed to that account by everyone,
  including the owner. Only a shared purchase someone paid for themselves is owed to that person.
- **Allotment before:** one net balance per person mixed both. A pool payment could only be
  recorded once contributions covered it ("Record received pool contributions before spending
  them"), so a rent paid before a housemate's transfer arrived couldn't be shared. Repayment
  suggestions treated anyone with a negative net balance as owing the owner.
- **Built:**
  - `householdLedger` returns `toPool` (contributions less shares of pool payments; the parts add
    up to `pool`) and `direct` (personal payments and settlements; the parts add up to zero) next to
    the unchanged `balances`, which are their sum.
  - A pool payment no longer waits for contributions: the unpaid shares show as owed to the
    household account. It still can't spend money reserved for other bills, and a household with no
    pool account still can't record one. Removing a spent contribution leaves its payer owing the
    account again.
  - Repayment suggestions count `direct` debts only. New `contribution` suggestions offer money
    into a pool account from a named housemate, or the owner's own transfer in.
  - People & balances shows both parts for a household with an account.
- **Fixed in 0.2.0-up.78 (review):** a settlement within the `direct` balances is accepted even when the net balances wouldn't allow it, so a suggested repayment always records. A transfer from another household's pool account is not offered as the owner's contribution.
- **Not changed:** settlements within net balances are still accepted, so existing
  person-to-person repayments of pool shortfalls stay valid. The combined-household view still
  shows net balances only.
- **Follow-up:** SPL-01's settle-up list should use `direct` for "who pays whom", and list `toPool`
  shortfalls as "put $x into the household account" rather than as transfers between people.

## Not recommended

- **Link-only access without accounts.** Spliit groups are open to anyone with the URL. That conflicts
  with Allotment's host/origin/auth protections and read-only token allowlist. Combined households
  and the CSV statement (SPL-07) cover the need.
- **Timer-created recurring expenses.** Spliit copies an expense forward on a schedule. Allotment's
  recurring bills share the real bank payment as it imports, which is more accurate.
- **AI category from title.** Payee default categories and rules already do this deterministically.
- **Reimbursement-as-expense model.** Spliit stores repayments as flagged expenses; Allotment's
  separate `settlement` kind, with overpayment checks, is better.

## Where Allotment leads

- Bank-linked entries with amount/date/direction checks and one-link-per-payment.
- Pool accounts, advances and bill reservations; Spliit has no shared-account concept.
- Proportional partial refunds that reverse exact cents; Spliit has only negative expenses.
- Rejection of over-settlement; Spliit accepts any reimbursement.
- Rule-driven and recurring-bill auto-sharing during import.
- Combined households across separate budgets with nothing copied between them.
- Contribution-based personal budgeting, so shared spending shows up correctly in envelopes.
- Exact BigInt largest-remainder allocation, stored per event and included in backups.
