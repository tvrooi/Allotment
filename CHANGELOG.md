# Changes

## 0.2.0-up.20

- Customize the home dashboard: show, hide and reorder its cards, or reset them, from **Customize**. Phones and desktops keep separate layouts on each device, with a phone default that leads with the summary, bills and budget. Layouts are presentation only: they never change budget data and are not part of backups. Onboarding and the review reminder keep their own rules (phase 8).

## 0.2.0-up.19

- Filter transactions by several accounts, categories and payees at once, by money in or out, by an inclusive amount range, by custom dates, and with transfers hidden. Active filters show as chips with **Clear all**, and the selection lives in the page's link, so reload, back and shared links keep it.
- Show the selection's count, money in, money out, net and date span above the register, and export exactly that selection as CSV. A filtered split counts only its matching parts; rows without an exchange rate are left out of the totals and counted.
- Search now matches notes as well as payees, with `%` and `_` taken literally. Invalid dates, reversed ranges and malformed amounts are rejected instead of widening the list.
- Open a Cash Flow drill-down in **All Transactions** with its budget scope, dates and category.
- Cash Flow and the dashboard compute the savings rate the same way: spending net of refunds over the whole period, and a dash instead of 0% without income (phase 8).

## 0.2.0-up.18

- Add optional **Settings → Priorities**: a purpose, essential/enjoyment/flexibility labels for expense categories, a monthly essentials estimate, a reserve comfort target and minimum, and a review reminder. Labels never assign money or reorder payday rules.
- Add a **Flexibility and resilience** card to Review that splits cash after debts by purpose (each dollar once), shows the flexibility reserve, its target and minimum gaps, months of essentials from the same three-month window as the cash runway, and unfunded obligations. Moving money below the minimum is allowed with a notice.
- Add life events to forecast scenarios: income pauses and monthly cost changes, with templates, the first dated shortfall and how far the lowest balance falls into the reserve.
- Let goals be paused, completed, retired or replaced. Their money stays unless moved in the same confirmed action; targets, payday rules and forecasts stop suggesting funding for them. Status history is kept.
- Add **Resume budgeting** with review completions, in-app reminders and snooze, and an **Extra income** split that assigns a share of a raise or windfall to the reserve once, guarded against reuse by payday plans.
- Amend the phase 7 brief against the implemented phases 5 and 6. Backup format 11.

## 0.2.0-up.17

- Add a **Category target** payday rule: it funds what a category target still needs this month, shared between that payday and the month's remaining paydays, from the same shared funding figures as the budget. Document how applied, partial and retried payday funding behaves.
- Add a read-only **Review** page: uncategorised spending (categorised in place), overspending (covered with Move money), underfunded targets (Fund targets), card debt without a reserve and money assigned to later months, with totals that match the budget summary and a category-group filter.
- Add next-month funding and an optional cash runway that excludes bill reserves, card payment reserves, retirement assets and borrowing, states its assumptions and shows itself as incomplete for short history or missing rates. Add a guided setup checked against the budget, without entering expected pay as money.
- Fix a date-dependent server test that failed once the real date passed the test's fixed date.

## 0.2.0-up.16

- Rebuild the Household page with the app's standard page header, cards, form controls, tables and status pills, with a dialog for adding another household. Give Household its own navigation icon.
- Bring fork-added budget panels in line with the original design: card-style Move money and Card payments panels, a label/value funding summary, the standard select in the goal form, styled disclosure summaries, compact Up review buttons and the app's date format throughout.

## 0.2.0-up.15

- Add category targets: monthly amount, balance by date, recurring bill (advancing every N months) and refill to balance. Requirements use the shared envelope balance and the same deadline arithmetic as payday plans, with catch-up amounts shown.
- Add **Fund targets**, a preview of assignments for underfunded targets capped at money unassigned today, applied exactly once after review. Targets never assign money by themselves.
- Count months without spending in the category monthly average, and show every month a "next 12 months" change would overwrite before saving it. Targets are included in backup format 10.

## 0.2.0-up.14

- Add an Up round-up accounting check that compares each linked account's register with Up's settled balance from the last sync, without pairing purchases and Saver credits.
- When the register is higher by exactly the round-ups settled since the first sync, offer an explicit choice to add the missing spending-side round-up debits (boost included), then keep adding new ones on sync. Matching or unexplained differences add nothing. Existing purchases, opening balances and reconciled rows are untouched.

## 0.2.0-up.13

- Add a read-only Forecast page with a day-by-day cash runway built from payday plans, pending recurring bills, future-dated entries, household bill shares and averaged variable spending. It never creates transactions or assignments.
- Compare labelled Base, Conservative and Stretch scenarios with editable spending, income, daily spending, one-off amounts, goal contributions and growth. Show the lowest balance before payday, goal attainment dates, assumptions, data freshness and a CSV export.
- Prevent double counting: payday plans and scheduled salary are never combined, matched occurrences are replaced by real payments, and scheduled household contributions switch off household bill shares by default.

## 0.2.0-up.12

- Add explicit category-funded goals whose progress follows shared envelope availability, including assignments, money moves, refunds and spending.
- Keep existing manual goals and their saved values intact; account links remain references and do not reserve funds. Each expense category can fund only one goal.
- Show assigned funds, activity, availability and incomplete funding assessments on desktop and phones. Preserve goal linkage and manual history in backup format 9 while accepting older backups.

## 0.2.0-up.11

- Calculate payment assignment previews from a consistent server-side budget snapshot, with guarded totals and the actual effects of refunds and prior funding.
- Pause card debt funding while the selected month or its funding summary is loading, so an assignment from the previous month cannot be reused in a payment-funding preview.
- Cover delayed month responses with a browser regression that verifies the exact saved current-month assignment.

## 0.2.0-up.10

- Add reviewed credit-card and line-of-credit payment envelopes. Existing debt and bank history stay intact until an explicit setup preview is approved.
- Reserve cash for funded purchases, consume it on linked repayments and expose unfunded debt and payments without reserves through the shared budget/payday calculation.
- Handle refunds, overpayments, positive card balances, split purchases, interest, fees and balance transfers between reviewed cards without duplicating ledger expenses.
- Add desktop and phone payment funding, setup and debt-assignment previews. Protect payment envelopes from ordinary transaction use and incompatible account/category changes.
- Preserve reviewed setups and baseline identities in portable backup version 8, with support for older backups. See `docs/CARD-PAYMENTS.md` for accounting order and compatibility rules.

## 0.2.0-up.9

- Unify monthly budget and payday funding around existing liquid resources, opening funds, carried envelopes and future reservations. Expected salaries cannot fund assignments; missing rates block new funding.
- Show Assigned / Activity / Available consistently on desktop, phones and category details, including refunds, rollover and unresolved deficits.
- Add atomic Move money / Cover overspending previews, persistent history and conflict-checked undo. Reject new overcommitments while preserving existing assignments and bank records.
- Preserve money-move history in portable backup version 7; older backups remain supported. Restore invalidates stale undo operations.
- Document the interim net-debt policy and historical funding dates in `docs/ENVELOPE-FUNDING.md`. Card payment reserves remain a separate phase 6B.

## 0.2.0-up.8

- Add a private AUD household ledger with explicit people, exact saved expense shares, advances, partial repayments and allocation-preserving refunds.
- Keep household pool cash and receipts out of personal envelope and payday funding while retaining the real bank register and contribution-based transfer categories.
- Track shared bill estimates, personal shares and reservations against received funds without duplicating imported payments or auto-created schedules.
- Add persistent personal/household expense scope, gross-versus-share display, bank-payment linking and exportable statements.
- Preserve household and payday history together in portable backup version 6. See `docs/HOUSEHOLDS.md` for accounting policy and limits.

## 0.2.0-up.7

- Add opt-in fortnightly payday plans and an Until next payday budget view for desktop and phones.
- Preview bill coverage, fixed funding, due-date targets, monthly smoothing, percentages and remainder allocations using actual payday dates.
- Cap funding to received income and available budget cash; preserve rollover, existing allocations and bank transactions.
- Apply allocations atomically with persistent payday/deposit duplicate protection and stale-preview checks.
- Preserve funding history and archived plans in JSON backup version 5; accept older backups.
- Keep unconfirmed scheduled salaries out of available funding and protect payday amounts when changing currency decimals.

## 0.2.0-up.6

- Add opt-in background Up sync, failure backoff and visible freshness.
- Keep bank observations separate from the ledger; review new imports, changed and omitted bank records without overwriting edits or reconciliation.
- Preserve initialized opening balances even after a register is emptied.
- Show expandable daily round-up purchase details, with boosts included once and original register access. No inferred transfer links or historical ledger repair.
- Preserve token-free bank observations and review history in JSON backup version 4.
- Add native desktop release checks and installer downloads without requiring Apple membership. Verified Developer ID signed Mac builds additionally support download/restart installation; signing and notarization remain optional until configured. The first updater build needs one manual install.

## 0.2.0-up.5

- Use consistent budget-account scopes across reports and drill-downs.
- Preserve categories on confirmed transfers and support categorising the budget side of transfers to or from off-budget accounts.
- Preserve existing Up transactions and opening balances when a later sync detects a discrepancy; require review instead of hiding it in historical balances.
- Validate round-up metadata without changing purchases or inventing transfer legs; automatic round-up repair remains pending bank-source verification.
- Automatically publish prepared releases after successful main CI, then make completed releases available through the existing Home Assistant catalog sync.

## 0.2.0-up.4

- Preserve the working Up preview: direct settled AUD imports, including Savers and 2Up.
- Desktop server picker with isolated sessions and HTTPS support.
- Home Assistant startup permissions, persistent encryption key and TCP watchdog fix.
- Automated desktop and multi-architecture Home Assistant releases with Supervisor-compatible image labels.
- Separate Home Assistant catalog updates after successful image publication.

Based on upstream commit `8a692ea679f5b98cf266779d53ccae79f05b0b09`.
