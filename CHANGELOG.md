# Changes

## 0.2.0-up.48

- **Separate budgets for more than one person** (Home Assistant option **multi_user**, off by default). Each person signs in by name to a budget only they can open, with its own password, database and encryption key, run as its own process behind a new sign-in gateway. The budget already on the server stays in place and becomes the first person's; turning the option off goes back to it.
- **Settings → Server → People** (administrator): add a person with an invitation code, issue a password reset code (written to the app's Log), or stop someone signing in. The administrator can't open anyone else's budget.
- **Forgot password?** sends a code to the person's phone as a Home Assistant notification (Settings → Server → Password codes to your phone): six digits, for 10 minutes. The administrator's code, valid for 24 hours, is also written to the Log.
- Read-only access tokens and the assistant (MCP) connection reach only the budget that created them. A new password revokes that person's tokens. Bank connections (Enable Banking) return to the budget that started them.
- On a shared browser, a page never keeps one person's budget, offline copy, waiting transactions or undo history after someone else signs in.

## 0.2.0-up.47

- **Ready to assign works like YNAB.** Every dollar in your accounts is either in a category or ready to assign, so the figure is always your accounts minus what your categories hold. Assigning $700 and $300 from a $1,000 paycheck leaves exactly $0, in every month you look at.
- **Earlier months no longer go negative.** A month before your income now shows $0, instead of next month's assignments as a negative number. Money can only be assigned in the month it arrived or later; assigning it in an earlier month is refused with the reason.
- **Overspending follows one rule.** Overspending with cash is red in its category for that month and comes out of next month's Ready to assign, once. Before, it was taken off Ready to assign straight away _and_ shown in the category, so it was counted twice. Overspending on a reviewed credit card is card debt: it never comes out of Ready to assign and stays a card payment shortfall until you fund it.
- **Moving money only changes the two categories.** Covering an overspent category no longer changes Ready to assign.
- The budget summary's breakdown shows what later months' assignments take from the month you're viewing and how much overspending will come out of next month. A payday plan still leaves enough to cover this month's overspending. Review → "Where today's money is" lists spending beyond your categories, so its rows add up to your cash.

## 0.2.0-up.46

- **Pick payments to share with a household.** **Pick to share** above the transaction list puts a checkbox beside each payment; tick the ones you split (or **Pick all shown**), then **Share _N_ picked with household**. Each becomes a shared expense with the household's default split, equal (50/50 for two people) when none is set. Payments already shared are skipped, and **Undo** removes them.
- **Receipt reading checks what it read.** The model is told how Australian receipts work (day-first dates, prices that include GST, the printed GST amount, card surcharges). Items that don't add up to the total aren't kept, so a matched payment isn't split by wrong amounts; the receipt says what was left out. A card terminal (EFTPOS, Tyro, Square) is never taken for the shop.
- Fix: an assignment being typed when you switch months could be saved into the month that was still loading. The budget now waits for the new month before it can be edited.

## 0.2.0-up.45

- **Overspending resets each month, like YNAB.** An overspent category is red for the month it happened and starts the next month at zero, instead of carrying the deficit forward until you cover it. The money had already left your accounts, so **Ready to assign** doesn't change. A one-off like paying out a loan or a settlement no longer follows you from month to month. Positive balances still roll over, and credit card payment categories keep their running total. With card payment funding, each month's card purchases are funded from that month's envelope, so an old deficit doesn't block them; card debt left unfunded in an earlier month stays a payment shortfall until you fund it.

## 0.2.0-up.44

- **Read receipts automatically** with a vision model on your own Ollama server (for example the Ollama app on Home Assistant). Photos are read in the background and fill in the merchant, date, amounts and line items with categories, then the receipt is matched as usual. Only empty fields are filled, so anything you typed is kept. Off until you choose an Ollama address and model in the Receipts tab's settings.
- **Try a sample receipt** checks a model's accuracy and speed on a made-up receipt without touching your budget.
- Receipts never leave your network: they go only to the Ollama address you choose. Read-only tokens can't reach any of it.

## 0.2.0-up.43

- **Receipts tab** on Transactions, like Monarch's: every receipt, matched or not, for any purchase (not only tax). Upload several at once, drop or paste them, or **Scan receipt** with a phone's camera (also from the All tab).
- **Receipt details:** merchant, date, amount, subtotal, tax, tip and fees, and line items with categories.
- **Automatic matching** to money out of exactly the receipt's amount: from the same merchant up to 2 days before or 7 days after its date, or any merchant within a day. When two transactions could fit, you choose. Receipts that arrive first are matched when their transaction arrives from the bank.
- Matched transactions are tagged **Receipt** and get the receipt's notes and items. One with no category yet is **split by the items' categories** (tax in proportion, tip and fees evenly per item). One that already has a category is left as it is unless you choose **Split by items**. A transaction claimed as a tax deduction is never split, so its claim isn't lost. The amount is never changed. Each step can be turned off in the tab's settings.
- **Find match** searches your transactions; **Add transaction** makes one from a cash receipt; **Unmatch** puts a receipt back. Deleting a receipt never deletes its transaction.
- Backup format 19 includes receipts' line items; format 18 backups restore unchanged.

## 0.2.0-up.42

- **Receipts:** attach photos or PDFs to a transaction from its details: choose a file (the camera on a phone), drop one, or paste a screenshot. Photos are shrunk before they are saved. A paperclip in the register marks transactions with a receipt.
- **Receipt inbox** (**Tax time → Receipt inbox**): keep a receipt before its bank transaction arrives. Type its date and total, and the inbox suggests the matching transaction, exact totals first, for **Attach**. Deleting a transaction moves its receipts back to the inbox.
- **Tax deductions:** tick **Claim as a tax deduction** on a transaction, then choose its return label (D1 car to D10 cost of managing tax affairs, and D15) and its work-use share. Claim split transactions part by part.
- **Rules can claim deductions:** the new **Claim as tax deduction** action claims matching payments as they import, and never replaces a claim you made.
- **Tax time** shows a financial year's deductions (1 July to 30 June) by label, with each claim's receipts. It flags receipts missing once work expenses pass $300, and items over $300 that are usually depreciated. Download the year as **CSV**, or as **CSV and receipts (ZIP)** for your tax agent. Record keeping, not tax advice.
- **Backups and security:**
  - Backup format 18 carries receipt details and claims. Receipt files stay in the database, which full backups (Home Assistant) include, and restoring on the same installation keeps them. Format 17 backups restore unchanged.
  - Files are checked by their contents and served so they can never run as a page.
  - Assistant (read-only) tokens cannot see receipts or claims.
- See [receipts and tax](docs/RECEIPTS-AND-TAX.md).
- Fix: in the long-term forecast, super fees that emptied a small fund still left its old balance earning (or losing) returns, so the balance could go below zero. Fees now leave the fund before growth.

## 0.2.0-up.41

- **HECS-HELP and other study loans in the long-term forecast:** a student loan account is now an income-contingent study loan (HECS-HELP, VET Student Loan, Student Start-up Loan, ABSTUDY SSL or Apprenticeship Support Loan, guessed from its name and changeable per plan) instead of a loan with no repayment data.
  - No interest: the debt is **indexed each year** (with inflation by default, or a rate you set; 2.8% on 1 June 2026) and repaid by the **compulsory repayment** on your repayment income with the 2026–27 marginal bands (nothing up to $69,528, then 15c and 17c per dollar, 10% of all income from $186,051). HELP is repaid before a Start-up Loan.
  - Take-home pay is assumed to already have the repayment withheld, so once the debt is repaid your take-home rises. You can turn this off.
  - **Extra yearly payments** per loan, paid from surplus, and **Pay off a loan** events. The forecast shows when study loans are repaid, and what extra payments bring forward and save in indexation compared with compulsory repayments alone. Comparisons add the year they are repaid.
  - The Accounts summary explains that study loans are indexed rather than charged interest.
- See [the forecast design note, §23](docs/LONG-TERM-FORECAST.md).

## 0.2.0-up.40

- **Superannuation replaces the US retirement account:** the **Retirement** account type (hinted "401(k), IRA, Roth") is now **Superannuation** ("Super fund, SMSF or account-based pension"), in its own **Superannuation** group. **Brokerage** is now **Shares & Funds**. Existing accounts keep their data; only labels and grouping change.
- **Accessible and preserved wealth:** the Accounts summary shows super as **Super (preserved)** with an **Accessible now** figure for cash and investments. The long-term forecast splits every year into accessible wealth (cash, investments and released super) and preserved super, draws both on the chart, and adds **Accessible at retirement** and **Super opens** to the key figures and **Accessible wealth at retirement** to comparisons.
- **Super follows the Australian rules more closely** in the long-term forecast:
  - super opens at **65 even while still working**, as well as on retiring from the preservation age (previously only on retiring);
  - once retired and released it pays at least the **minimum pension** (4% under 65, rising to 14% from 95) into spendable cash, with **tax-free earnings**; this can be turned off;
  - new assumptions for **salary sacrifice**, **personal (after-tax) contributions**, **fees and insurance** and **tax on earnings before the pension**, all 0 by default so existing plans are unchanged until you set them;
  - warnings when contributions pass the **concessional** ($32,500) or **non-concessional** ($130,000) cap, or super passes the **transfer balance cap** ($2.1 million) when its pension starts (2026–27 figures, editable).
- See [the forecast design note, §22](docs/LONG-TERM-FORECAST.md).

## 0.2.0-up.39

- The Budget summary is now always titled **Ready to assign**, with the amount below and a status line ("Give every dollar a job", "Fully budgeted", "Assigned more than you have", or "Resolve overspending and uncategorised spending"). The title was previously replaced whenever anything was unresolved, so a budget with old deficits never showed it.
- **Transfers out of the budget remember their category:** linking a transfer into a household pool or an off-budget account (your rent share, a loan repayment) gives it the category of the last transfer between the same two accounts, or into the same account. A monthly transfer is categorised once. An existing category is never replaced, and transfers inside the budget still need none.
- Fix: **Review → Tidy up** listed Up savers as "not in FlyBudget" when their FlyBudget names had an emoji ("🐈 Cat Vet"). Names are now compared by their letters and numbers.

## 0.2.0-up.38

- Fix: Up's settled balance left out the round-ups of **pending** purchases, which Up has already moved to your Saver. A Spending account with pending card purchases looked a few cents short of its register, the round-up check called the difference "unexplained", and the round-up repair stayed locked.
- **Sync works like YNAB's:** a sync that reached Up and imported everything is a successful sync, and **Last synced** moves on. A register that differs from Up's balance no longer marks the connection as failed. It's a note to review: the account shows "Up says $X" beside its balance, linking to the round-up check or **Reconcile**. Connection, token and data problems are still errors.

## 0.2.0-up.37

- **Several household accounts:** **Household → Sharing** adds more accounts to a household's pool, for example an Up 2Up spending account beside its bills saver. Each one leaves your personal budget like the first: rent paid from the joint account is the household's expense, and only your own transfers into it count, as your share, in the category you give them. Backup format 17 includes them; format 16 backups restore unchanged.
- **Default split:** set how a household usually splits costs (equal, percentages or weights).
- **Share with household** in one step: from a transaction's details, or for every payment in the current transaction list. Each payment becomes a shared expense with the default split, without filling in a form per payment, and **Undo** removes the entries. Payments already shared are skipped.
- **Repayment suggestions:** money received from someone who owes the household (their name in the payee, no more than they owe) is listed under **Household → Sharing** with **Record repayment**.
- **Rules can share:** a new rule action, **Share with household**, records matching payments as shared expenses with the default split as they import. If a payment can't be shared, the import still succeeds.
- See [households](docs/HOUSEHOLDS.md).
- Fix: splitting a foreign-currency value between parts with opposite signs could, for amounts in the quadrillions, come out a cent off. Such an impossible split is now refused instead (found by the property tests).

## 0.2.0-up.36

- **Ready to assign:** the Budget summary now says **Ready to assign** for money you have without a job. Income rows read **Expected**, **Received** and **Still to come**: an expected amount is only a plan, and income counts as ready to assign as soon as it arrives, whatever its category.
- **Assistant suggestions:** a read, categorise and organise token can suggest amounts for expense envelopes (`propose_assignments`). The Budget page shows a banner; **Review suggestion** lists each amount and reason, and **Apply** adds them all from money ready to assign, or nothing if there isn't enough. Nothing is assigned until you apply it.
- **Review → Tidy up** finds setup problems:
  - a budget that counts years of imported history, with a one-click budget start;
  - Up accounts whose balance proves round-up debits are missing;
  - movements to or from Up savers that aren't in FlyBudget (closed or never connected), grouped by saver, to categorise in one step with undo;
  - categories that were never used.
- **Hide categories:** **Settings → Categories → Tidy up categories** hides never-used categories one at a time or all at once. Hidden categories leave pickers and the budget while they hold no money, keep their history, and can be shown again. Tokens with categorise access can hide them too (`hide_category`), and `list_categories` now shows how much each category is used.
- Connecting Up to a new budget (nothing ever assigned, no budget start) now starts the budget in the current month, so imported history doesn't become overspending.
- New budgets on a server in an Australian time zone (as the Home Assistant app is in Australia), or with `FLYBUDGET_CATEGORY_TEMPLATE=au`, start with Australian categories: rent and strata, rego and CTP, private health, Afterpay / Zip, super contributions, pets and more. Existing budgets don't change.
- New MCP tools: `budget_housekeeping` and `list_budget_proposals`.

## 0.2.0-up.35

- Add **read, categorise and organise** access tokens (**Settings → Server → Read-only access**). Besides everything a categorise token can do, an assistant can **propose rules** (saved switched off and marked "Proposed by" in **Rules** until you turn them on), apply a rule that only sets a category to uncategorised past transactions, set **payee default categories** so future imports are categorised, and **link transfers the app suggests**. It still can't enable, reorder or delete rules, or change anything else.
- Every category change a token makes is saved as a **change set**: **Settings → Server → Read-only access** lists them with **Undo**, and the assistant can undo its own (`undo_change_set`). A transaction you edited since keeps your change.
- New MCP tools for every token: `uncategorised_payees` (the categorising worklist), `transfer_suggestions`, `budget_start`, `list_households`, `household`, `household_statement`, `bank_sync_status` (last sync, bank against register balance, and whether missing round-ups explain a difference, with no connection details) and `list_change_sets`. `find_transactions` pages with `offset` and keeps results short with `fields`. Categorise tokens also get `categorise_by_payee`. The server's MCP instructions now explain how the budget counts money.
- See [Read-only access](docs/READ-ONLY-ACCESS.md).

## 0.2.0-up.34

- A **read and categorise** token's MCP tools can now also **create and edit categories** and category groups (create, rename, move a category to another group, change its icon or budget type) so an assistant can set up categories before sorting transactions. They still can't delete or reorder categories or change anything else.
- Fix: a token could read an account's bank import settings by capitalising the path (`/Import-Settings`). Token paths are now matched ignoring letter case.

## 0.2.0-up.33

- Add a **Simulation** tab to the long-term forecast: it runs your saved plan many times with random yearly returns and shows the **chance of success** (the share of simulated paths that never ran out of money and ended above zero) and a band of outcomes (the middle half and the middle 90% of paths, with the median and the steady-return forecast for comparison). Only returns vary, and they are seeded, so the same seed always gives the same answer. Works in today's or future dollars, on a phone and in the offline demo.
- How much returns swing is an assumption with its default shown (investments and super 16%, property 10%, cash and other accounts none), under **Assumptions**. Read-only access can run it too (`long_term_simulation`).
- See [the long-term forecast](docs/LONG-TERM-FORECAST.md).

## 0.2.0-up.32

- **Forecast** now opens on a **Long term** view: your net worth year by year, from today's real balances to an age you choose, with a marker on the line for each life event. The 30-day to 2-year **Cash runway** is its second tab, unchanged. See [the long-term forecast](docs/LONG-TERM-FORECAST.md).
- Make plans with life events (buy a home, new job, career break, child, windfall or expense, recurring income or expense, retirement, pay off a loan). Opening an editor saves nothing: an event is saved when you choose **Create**. Plans are saved with versions, so a change on another device is never overwritten.
- Every rate and age (inflation, growth by kind of account, super guarantee, contributions tax, preservation age, Age Pension) is an assumption with its default shown beside it. Super is drawn only after you retire and reach the preservation age. If money runs out, an **unfunded spending** warning names the first year.
- Click a year to see what made up its change; the parts add up to the cent, in today's or future dollars (toggle at the top). Choose where surplus money goes, as a percentage of what is left or a fixed amount, with a worked example, and the order money is taken out when it runs short.
- Duplicate, rename and delete plans, and compare one with another: two lines, paired key figures and the difference in money and in percent of the plan you compare against. Works on a phone and in the offline demo.

## 0.2.0-up.31

- Add storage and an API for long-term forecast plans (see [the design note](docs/LONG-TERM-FORECAST.md)): named plans with life events, per-account assumptions and savings splits, saved with versions so a change on another device is never overwritten. They read your real balances, income and spending, compare two plans, and never write to your budget. There is no screen for them yet.
- Record a loan or mortgage's rate, repayment and term beside its account (`account_loan_details`).
- Read-only and categorise tokens can read plans and results, and the read-only MCP endpoint gains `long_term_plans`, `long_term_plan`, `long_term_forecast` and `long_term_compare`. Backup format 16 includes plans and loan details; format 15 backups restore unchanged.

## 0.2.0-up.30

- Groundwork for a long-term forecast (see [the design note](docs/LONG-TERM-FORECAST.md)): a pure year-by-year engine for net worth over decades, with life events, super, loans and savings splits, and a table for a loan or mortgage's rate and repayment. Nothing in the app uses it yet and it never touches your budget; the forecast page and its storage arrive in later releases.

## 0.2.0-up.29

- Add a **budget start** (**Settings → Budget**): the first month your envelopes count. Bank history from before you started budgeting stays in your accounts and reports, and balances don't change, but its spending no longer carries into envelopes as overspending or uncategorised spending. Card payment reserves start there too. Clearing it counts all history again. Backup format 15 includes it; format 14 backups restore unchanged.
- The sidebar lists household pool accounts under their own **Household** heading instead of **For budget**, so the For budget total matches the money your budget counts.
- Add **read and categorise** access tokens (**Settings → Server → Read-only access**). Besides reading, they can set the category of past transactions and nothing else: no other field, no clearing a category, no future transactions, and the register's rules still apply. Over MCP they get a `categorise_transactions` tool that reports each transaction's previous category. Read-only tokens are unchanged. See [Read-only access](docs/READ-ONLY-ACCESS.md).
- Make the import settings round-trip test independent between its random runs.

## 0.2.0-up.28

- New look from the FlyBudget design system: warm neutral surfaces, an orange accent, Inter headings, 12px cards and a refreshed dark theme. Text and button colours were tuned for AA contrast, and budget progress bars are slimmer. Charts keep their teal colours.

## 0.2.0-up.27

- Add **Investments**: record what investment, retirement and crypto accounts hold (shares, ETFs, funds, bonds or coins, including fractions), enter dated prices yourself, and see each holding's value. Holdings never change an account's balance, the budget or net worth; when the holdings and the recorded balance differ, **Record as value** opens the usual Update Value adjustment for you to confirm.
- Record purchases with their total cost to see **unrealized gains**. A cost you don't know stays unknown rather than counting as zero, and a holding shows a gain only when every unit's cost is known. Prices older than a week are marked stale; other currencies are converted at the latest exchange rate or left out with a note. See [Investments](docs/INVESTMENTS.md).
- The sidebar's **Add account** menu no longer closes when the sidebar scrolls the button into view. Backup format 14 includes securities, prices, holdings and purchases; format 13 backups restore unchanged (P3).

## 0.2.0-up.26

- On macOS, a desktop window connected to a self-hosted server now has no title bar either, like the app's own budget. The app first checks that the server's version can draw that layout; an older server keeps the usual title bar until it's updated.

## 0.2.0-up.25

- After you change a transaction's category, offer to **fix the cause**: give the payee's other transactions the same category, make it the payee's default, create a rule, or stop asking for that payee. Each choice can be undone from the same message.
- **Find recurring** now lists payees that almost qualified, with the reason (amounts vary, only two payments, dates drift, or money in and out mixed), and **Add anyway** fills in a new recurring item from the next expected payment.
- Mark recurring items whose last two payments never came as **Possibly ended**. **Cancel recurring** keeps their paid history and skips the missed payments; **Still active** keeps them. The forecast leaves possibly ended items out and names them.
- **Save forecast scenarios** and reopen them after a refresh or on another device. A save never overwrites a change made elsewhere: you choose **Use theirs** or **Keep mine**. Stat cards compare each scenario with the first in money.
- Editing a transaction's details no longer loses a field you're typing when another field saves. Backup format 13 includes saved scenarios and the new settings; format 12 backups restore unchanged.

## 0.2.0-up.24

- **Split** a transaction after it arrives, including bank-synced ones: from its details, by amount or by percentage (the parts always add up exactly), change the parts later, or put it back together. Undo works for each step.
- **Edit many transactions at once** from the register's selection: category, payee, notes, tags, Reviewed and Hide from reports, each left unchanged unless you pick a value. A preview lists how many rows change, which accounts they're in and which are skipped (reconciled rows, transfers' payee and category, split categories, household entries); applying refuses if the selection changed meanwhile, and one undo puts every row back.

## 0.2.0-up.23

- Add **read-only access** for self-hosted servers (**Settings → Server → Read-only access**): tokens that let another tool, such as an AI assistant, read the budget. They can't change anything, sign in, download backups or reach bank connections. They expire, can be revoked, are revoked together when the password changes, and are stored only as a hash. See [Read-only access](docs/READ-ONLY-ACCESS.md).
- Add a read-only **MCP endpoint** at `/api/mcp` with tools for accounts, the monthly and yearly budget, transactions and their totals, reports, goals, rules, tags and the budget review. Each tool reads through the API with the caller's token, so it can never see more than the token.

## 0.2.0-up.22

- On macOS the desktop app has no title bar: the sidebar and page run to the top of the window, with the window buttons inside the sidebar and the window moved by its top strip. Windows connected to a self-hosted server keep the usual title bar.
- Pinning and unpinning the sidebar slides the page instead of jumping, and an unpinned sidebar closes once the pointer leaves, even right after clicking the pin. On macOS the collapsed sidebar is a little wider so the window buttons fit evenly.

## 0.2.0-up.21

- Give FlyBudget a warmer ivory, stone and terracotta theme, with a matching warm charcoal dark mode and readable selected controls.
- Soften cards, buttons and fields, add serif page headings, and make the sidebar roomier with a gentle active state and clearer account balances. Auto-hidden navigation also expands for keyboard focus.
- Add a welcoming dashboard heading, frame net worth in a card, refresh statistic spacing and use a muted chart palette. Saved dashboard layouts and financial calculations remain unchanged (phase 10).

## 0.2.0-up.20

- Add **tags**: label transactions across categories (a holiday, a renovation) from a transaction's details, see them on rows, filter by them, and rename, recolour or delete them in **Settings → Tags**. A split's parts share its tags. Rules can **Add tag**, and never remove one.
- Add **Reviewed**, a personal checklist mark per transaction, and **Mark reviewed** for the filtered list. It asks you to confirm the count, refuses if the list changed in the meantime, and can be undone. Imports, sync, rules and restores never set it, and it never reconciles anything.
- Add **Hide from reports**: leave a one-off such as a reimbursed work expense out of Cash Flow, spending, income, merchants, trends and the savings rate. Balances, the envelope budget, forecasts, the annual overview and reconciliation still count it.
- Save the current All Transactions filters as a **view** and reopen it from **Views**. Views are checked by the same rules as the filters themselves.
- CSV exports gain Tags, Reviewed and Hidden from reports columns at the end. Backup format 12 includes tags, views and the new marks; format 11 backups restore unchanged (phase 9).

## 0.2.0-up.19

- Filter transactions by several accounts, categories and payees at once, by money in or out, by an inclusive amount range, by custom dates, and with transfers hidden. Active filters show as chips with **Clear all**, and the selection lives in the page's link, so reload, back and shared links keep it.
- Show the selection's count, money in, money out, net and date span above the register, and export exactly that selection as CSV. A filtered split counts only its matching parts; rows without an exchange rate are left out of the totals and counted.
- Search now matches notes as well as payees, with `%` and `_` taken literally. Invalid dates, reversed ranges and malformed amounts are rejected instead of widening the list.
- Open a Cash Flow drill-down in **All Transactions** with its budget scope, dates and category.
- Cash Flow and the dashboard compute the savings rate the same way: spending net of refunds over the whole period, and a dash instead of 0% without income (phase 8).
- Customize the home dashboard: show, hide and reorder its cards, or reset them, from **Customize**. Phones and desktops keep separate layouts on each device, with a phone default that leads with the summary, bills and budget. Layouts are presentation only: they never change budget data and are not part of backups. Onboarding and the review reminder keep their own rules (phase 8).
- Add a **Merchants** view to Cash Flow: spending by payee under the same definition as categories, with net refunds listed so the rows add up to the period's spending, and a drill-down that opens in **All Transactions**.
- Add an annual budget overview (**Budget → Year**): monthly assignments and activity per category with year totals, available money at the latest started month (never a sum of balances), later months marked as plans, today's money available to assign, and card debt with its payment reserve. Select a month to open it in the monthly budget.
- Link category-funded goals to their category (assign or move money) and its transactions, and show in a transaction's details which goal its category funds. Progress still comes only from the category.
- Document bounded proposals for receipts, per-transaction review and visibility, tags and saved views, security holdings and long-term forecasting.
- This completes phase 8 (the amended brief in `docs/MONARCH-DEVELOPMENT-PHASE.md`).

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
