# Changes

## 0.2.0-up.68

- **A guided tour for new budgets.** A new budget shows **New to Allotment?** at the top of the dashboard. **Take the tour** highlights one part of the app at a time and explains it, in about two minutes: the sidebar, accounts, transactions, Ready to assign, categories, moving money, Review, recurring bills, the dashboard, hiding amounts and where help is. The page behind is paused while it's open; **Next**, **Back**, the arrow keys and **Escape** work, and on a phone it's a sheet at the screen's edge.
- **Guides for a page.** The Budget page has its own short guide, offered the first time you open it (once the welcome tour is taken or turned down). More pages follow.
- **Find guides again.** The sidebar's **?** button now has **Guide for this page**, **Take the welcome tour**, **All guides and tips** and **Read the online guide**. On a computer, **?** on the keyboard lists every guide.
- **Tips, once each.** Short tips appear in the page, never over it, one at a time: **Got it** hides one, **Turn off tips** hides them all. **Settings → Preferences → Guides and tips** turns tips and page guides on or off, starts the tour, and resets what you've seen.
- **Per person.** What you've seen is saved with your budget, so it follows you to every device; in multi-user mode each person has their own. If you used Allotment before this release, the tour isn't offered and tips are off; a note says where guides are. Guide progress isn't part of backups.

## 0.2.0-up.67

- **Afterpay purchases count as what you bought.** The new **Pay later** page records a purchase made with Afterpay once, in its real category: a drill from Bunnings is $200 of Home improvement, not four Afterpay payments. **Set up Afterpay** adds an Afterpay account (a small credit account) and an **Afterpay payment** envelope; **Add a purchase** takes the shop, category, price, number of payments (four, fortnightly, by default) and the account that pays.
- **Payments are linked when you confirm them.** An Afterpay payment from your bank close to its due date is listed under **Payments to confirm** on Pay later and Review. **Confirm** makes it a transfer to the Afterpay account, so it isn't counted as spending twice; **Not this** stops suggesting it. A payment covering the next few instalments links to all of them. Nothing is linked without you, and a reconciled transaction is never changed.
- **Earlier Afterpay payments.** **Earlier payments** groups your bank's past Afterpay payments (6, 12 or 24 months) into the purchases they probably paid for; **Record purchase** names what you bought and links them.
- **Your budget follows the money.** A purchase moves its envelope's money into Afterpay payment, each payment uses it up, and the Budget page shows payments due this month under that envelope. Refunds (taken off the last payments first) and late fees (added to the next payment) are one click; **Remove plan** puts everything back.
- New budgets in Australia no longer start with an "Afterpay / Zip" spending category. Existing budgets keep theirs. Backups are now format 21.

## 0.2.0-up.66

- **Split each recurring bill its own way.** **Change split** on a bill in **Household → Recurring bills** gives it equal, percentage or weight shares of its own, for example more of the internet for the person working from home. Its shares and **Share _N_ payments** use that split; **The household's default split** puts it back.
- **Share a bill's payments as they arrive.** Tick **Share new payments automatically** on a bill and each new payment to its payee, from that day on, is shared with the bill's split when it's imported. Payments from before stay a click, refunds and transfers are never shared, and unticking it stops at once.
- **Add or rename people.** **Add person** under People & balances adds a new housemate, starting settled; **Rename** next to a name changes it, keeping their entries and balance. A percentage or weight default split leaves someone new out until you change it, and the page says so.
- **Edit or delete one-off bills.** Bills to reserve for now have **Edit** (name, due date, total and your share) and **Delete**. Once a payment is matched to a bill, only its name and date can change, and it can't be deleted until that entry is removed.

## 0.2.0-up.65

- **Recurring bills on the Household page.** Bills you set up in Recurring (power, gas, internet, water) can now be shared with a household: **Household → Recurring bills → Add recurring bills**, tick the ones you split. Each shows how often it comes, its next date, what everyone's share of it is with the household's default split, and whether its recent payments are shared yet. **Share _N_ payments** shares the ones that aren't, in one click; nothing is shared without it. **Stop sharing** takes a bill off the list and keeps what was already shared.
- **A clearer Household page.** Balances say who owes and who is owed instead of a signed number. The household account figures (pool funding, bank cash, available to reserve) and **Bills to reserve for** only show when the household has its own account. The form for a one-off expense, advance or repayment opens from **Record something else**, and the page only loads recent payments while it's open, instead of every transaction in the budget. Percentage splits are typed as percentages, as in the default split, not basis points. The household's settings (accounts, default split, combining) moved to the bottom.

## 0.2.0-up.64

- **Home Assistant releases no longer stall.** The ARM64 Home Assistant image built its web client under emulation, which froze the release three times (up.57, up.60 and up.63, which was never published). The client and server are now built natively for both architectures. Only the small runtime layer is assembled per architecture, and pull requests now build both architectures before a release.
- Includes everything in up.63: **FlyBudget is now Allotment**, with the new name, icon and colours. Your budget, Up connection, passwords and settings stay where they are.

## 0.2.0-up.63

- **FlyBudget is now Allotment.** Every dollar gets its plot. The app, desktop installers and Home Assistant app are called Allotment, with a new icon (three garden plots and a sprout) and the brand's Marigold, Soil and Canvas colours. See [docs/BRAND.md](docs/BRAND.md).
- **Nothing to move.** Your budget, Up connection, passwords and settings stay where they are. The Home Assistant app keeps its ID and updates in place; it now shows as **Allotment** under Settings, Apps. The desktop app keeps its local budget and stored keys.
- **New home on GitHub:** [tvrooi/Allotment](https://github.com/tvrooi/Allotment), no longer linked to the upstream fork network. The old address redirects. Desktop installers are now named `Allotment-…`.
- **Desktop apps from before this release can't find updates by themselves** after the repository move. Download this release once from the Releases page; from then on, desktop update checks work again.

## 0.2.0-up.62

- **Link Up to an account that already has history.** In **Connect Up**, **Link an existing account** now works for an AUD account with transactions. You pick the day Up takes over (by default the day after the account's newest transaction). Your history before that day stays exactly as it is; Up's transactions from that day on are imported. Up rows close to the cut-over, or that look like one you already have (same amount, within 2 days; 3 just after the cut-over), are imported and listed under **Possible duplicates from your old history** in Settings, Connected Banks, Up, where you choose **Keep both** or **Delete the older one**. Nothing is merged for you, a reconciled row is never deleted, and no opening-balance row is made: if your history disagrees with Up's balance on the day before the cut-over, the difference is shown and the usual "account disagrees with the bank" steps apply. Empty accounts link as before.
- **Categories come with a CSV.** The column mapper has **Category** and **Category group**. After mapping, each category in the file is matched to yours by name or created in a group you choose, before anything is imported. The file's categories win over rules; blank ones stay uncategorised.
- **Import from YNAB.** From the Welcome page, **Settings, Data** and an account's Import dialog: pick YNAB's register export, and FlyBudget creates or matches one account for each YNAB account, with categories and memos. "Ready to Assign" income stays uncategorised. YNAB's plan export (assigned amounts) is not imported yet.
- **A balance you typed stays true.** An account added with "Current balance as of today" keeps that balance when you later import older history: the starting balance moves by what the older rows add, and the import says so. Not for bank-linked accounts or accounts with reconciled rows (it shows the balance change instead), and not after you edit the starting balance yourself.
- **After an import, the register shows it.** The register jumps to the imported dates instead of an empty This Month.
- **Linking works before you pick a currency.** An account with no currency of its own in a budget with no currency yet can be linked to Up (it makes the budget AUD, as creating an Up account does). When an account really can't be linked, the dialog says why next to the option.
- **Settle the cut-over difference without fake income.** If your history disagrees with Up's balance the day before the cut-over, Settings, Connected Banks, Up offers **Add an opening balance dated** that day: one balance adjustment you confirm, not income, instead of a reconcile adjustment dated today. Deleting an older row refreshes the figure.
- **Deleting a possible duplicate asks first**, naming the older transaction (date, payee, amount).
- **YNAB transfers are linked.** When both legs of a transfer are in the file and both accounts are imported together, they become one transfer; the summary says how many. Rows that don't mirror exactly are left as they are.
- **Smarter category matches.** The suggested match ignores case and punctuation, accepts one part of "Gas / Fuel", and knows a few equivalents (Public Transport = Public Transit). You can still change each one.
- **First sync isn't a list of changes.** The starting import is no longer counted under "Bank changes to review"; later changes and possible duplicates are.
- **Welcome page** suggests an order for people coming from another app: connect your bank first and import only older history, or import everything and link Up from a cut-over date.

## 0.2.0-up.61

- **Phone fixes.** Reconcile shows the summary above a full-width list, and prefills the bank's balance for bank-linked accounts. The Budget header is compact: the extra actions sit in a **...** menu, month buttons look like buttons, and **Find a category** reaches Groceries in two taps. Tab bars show a fade and arrow when they scroll, and the Add transaction category list is full width.
- **Dates follow your browser.** New installs show dates in your locale's style (for example 05/03/2026 in Australia). Existing choices are kept.
- **Not categorised yet.** A filter at the top of Categories lists transactions with no category. New budgets call the default category **Other** instead of Uncategorized; existing budgets are unchanged.
- **Safe mode covers what a friend sees.** The default is **All amounts**. People who never chose a level are moved to it; a level you picked is kept.
- **Setup and reset codes say where to look.** In the Home Assistant app: Settings, Apps, FlyBudget, Log. In Docker: `docker logs flybudget`.
- **Category picker keyboard.** Enter picks the first match, arrows move, Escape closes, in the register and the first-import sort step.
- **Last month** preset in Reports and Transactions. Months before the budget starts show what you really spent, read-only.
- **Put the rest in...** on Ready to assign. A brand-new budget no longer hides its empty categories.
- **Recurring finder** skips transfers, ATM withdrawals, refunds and one-offs, and **Create N recurring** stays visible.
- **Plain words.** "?" help for Ready to assign, Anchor payday and Funding rule; deleting a category says **Merge into...**; **Split across categories** and **Share with people**; cancelling a recurring item asks **Keep it** / **Stop this bill**.

## 0.2.0-up.60

- **Undo a payday funding.** Right after **Apply funding** there is an **Undo** button, and every entry in **Funding history** has one. It takes back exactly what that funding added to each category's assigned amount, frees the deposits you used and returns the payday to "not applied", so the same preview comes back. It never takes back more than a category is still assigned that month, so money you moved or changed since is left alone and the screen lists what it could not take back. The entry stays in Funding history as "Undone on …".
- **Undo a reconciliation, and fix a reconciled row.** On an account, **Undo last reconciliation** unlocks the transactions that reconciliation locked and removes the balance adjustment it made, unless you have changed that adjustment since (then it is kept). Rows locked by an earlier reconciliation, and rows you have already unlocked or moved, are left alone. A single reconciled transaction has an **Unlock** button with a warning. Category, payee, notes and tags can now be changed on a reconciled transaction without unlocking it, since they don't change a balance. Amount, date and account stay locked.
- **Cash goes to Cash.** In **Add transaction**, the account list offers **Cash (create)** when you have no Cash account. Choosing a bank-linked account (Up or another bank feed) now shows "this account is linked to your bank; a transaction added by hand will make it disagree" with **Use Cash instead**.
- **The assign block explains itself.** When Budget refuses to assign money because an account doesn't match its bank, it names each account, what FlyBudget has against what the bank says, and links to the account's transactions (to delete or move a row you added by hand) and to reconcile it.
- **Forgot your password?** On a single-user server the sign-in screen now has **Forgot password?**. It makes a one-time reset code (the same strength as the setup code, working once, for 24 hours), writes it to the server log (the app's **Log** tab in Home Assistant, or `docker logs flybudget`) and, in the Home Assistant app, also shows it as a Home Assistant notification. Entering the code and a new password signs every other device out. Requests are rate limited and asking again while a code is still valid returns the same code. `docker/reset-password.cjs` still works.
- **Clean up in bulk.** The transaction list has **Delete N** next to **Edit N**: it shows what would go, keeps reconciled transactions and ones tied to a household entry, and needs you to type `delete`. An account's **Edit** has **Delete…** to remove the account and all its transactions after typing its name. It refuses while a bank feed supplies the account (and says how to unlink it), while recurring items, a household or card funding use it, or a transfer's other side is reconciled elsewhere. Neither can be undone.

## 0.2.0-up.59

- **Your first Up import arrives mostly categorised.** FlyBudget now reads Up's own category on each transaction (Groceries, Takeaway, Rent and Mortgage, Public Transport and so on) and puts new transactions in the matching FlyBudget category when you have one. A rule or a payee's default category still wins, transfers and money in are never categorised from Up, and transactions already in your budget are never changed. Where Up's category has no clear match here (for example Life Admin), the transaction stays uncategorised for you to sort.
- **Sort your first import in a few picks.** After **Save & Sync**, a new step lists what is still uncategorised, a payee at a time with the biggest groups first. One pick sorts all of a payee's transactions and, with **Also apply to future transactions** ticked (the default), makes it the payee's default category. Each pick can be undone, and **Skip for now** leaves everything as it is.
- **Pay is found for you.** A repeating deposit from the same payee every 7 or 14 days, or monthly, is offered as "Looks like pay from X every 14 days. Mark it as income?". One tap puts its deposits in your pay category and makes that the payee's default; it can be undone. The offer appears when an import finishes and in **Get started** on the dashboard.
- **Payday plans start from your pay.** A new payday plan is filled in from the latest pay found (its date, amount and the 14-day cycle), so it can be saved without typing. When no deposit is marked as income yet, the plan lists recent uncategorised deposits with a **This is pay** button instead of telling you to leave the screen.
- **Forecasts and reports say what they leave out.** When more than 5% of spending has no category, the cash runway forecast and Reports show "$X of spending isn't categorised, so this leaves it out" with a link to those transactions. Reports no longer shows "Income $0" and a green expenses figure while none of your income is categorised; it points you to sort it instead.

## 0.2.0-up.58

- **Combine households with another FlyBudget user.** With separate budgets per person (the Home Assistant app's **multi_user** option), two people who each keep a household can join them: **Household → Combine with another FlyBudget user**. One asks and the other accepts, each choosing who the other is in their own household.
  - **What you both see:** one register of both households' entries, with date, amount, merchant and logo, who paid and the full split, and whose entry it is.
  - **Balances:** add both ledgers. Housemates stay as each household named them.
  - **Notes:** each entry has one shared note that either of you can edit. Each of you still edits only your own entries.
  - **What stays private:** accounts, categories, transaction notes, balances and other transactions. An expense you both recorded on the same day for the same amount is flagged as a possible duplicate.
  - **Stopping:** either of you can stop combining at any time. The other's view ends at once and the shared notes are deleted; both households keep their own entries.

## 0.2.0-up.57

- **Safe mode hides balances while someone helps you.** Turn it on with the new eye button at the top of the menu, **Alt+Shift+H**, or **Settings → Preferences → Safe mode**. By default it hides balances and totals: account balances, sidebar totals, net worth, assets and liabilities, savings, super, investments, goals, forecasts, the resilience and cash runway cards on Review, reconciling and the balances in guided setup. Transactions, payees, rules and the budget stay visible so someone can still help with them. Choose **All amounts** to hide every figure instead. Hidden figures aren't on the page at all, not just blurred. Safe mode switches off when the app or tab closes and only applies on that device. It keeps figures off the screen but doesn't lock them: anyone using the device can turn it off, and exports and backups are unchanged.

## 0.2.0-up.56

- **See recurring bills coming in the budget.** A recurring expense with a category now shows against that category as an orange **−$X expected** amount under Activity, and its spending bar continues in orange by the same amount, so you can see what's still due this month before it's debited. Hover over it for each bill, its date and what the category will have left. A bill stops showing once it's paid (matched to a transaction) or skipped; overdue bills in the current month stay until they arrive. It's a forecast only: Activity, Available and Ready to Assign don't change until the money leaves the account. Transfers, paused items, income and closed or off-budget accounts aren't included.

## 0.2.0-up.55

- **An assistant can replace payee logos.** A _read, categorise and organise_ access token can now replace a payee's logo as well as add one, for example to swap in a cleaner brand icon. It still can't remove a logo. This includes images you uploaded yourself, so revoke the token if you don't want an assistant changing them.

## 0.2.0-up.54

- **An assistant can add brand logos to payees.** A _read, categorise and organise_ access token can now give a payee that has no logo one, such as the merchant's brand icon (`PUT /api/payees/:id` with only `logo`). It never replaces or removes a logo you set: remove a wrong one on the Payees page and it can set another. Logos are stored in the budget, so everyone using it sees them.

## 0.2.0-up.53

- **Check balances before assigning money.** A known mismatch with Up's settled balance, an uninitialised bank balance or money still recorded in a closed budget account marks Ready to Assign as unverified and blocks new funding. The budget lists each discrepancy; Review and resilience show the same warning. Existing cash and assignments are preserved for review.
- **Safer reconciliation.** The first screen shows the dated register balance and selects all current transactions. An adjustment cannot be created from unchecked entries, future transactions or duplicate generated bank income. The server checks for stale data and saves the correction and reconciliation together, so a failed save cannot leave half a correction. Negative statement balances stay negative.
- **Closed accounts keep their history without hiding money.** Accounts must reach zero before closing. Older closed accounts remain visible in Settings with their balances and a route to reconcile residuals explicitly.
- **Prevent duplicate generated salaries.** Connected bank accounts wait for the imported income receipt instead of auto-creating another salary. Closed accounts never auto-create scheduled transactions. Existing entries are not deleted or rewritten.
- Payday funding cannot consume a received deposit while account balances need reconciliation; card payment reserves and manual assignments have the same protection.

## 0.2.0-up.52

- **Fund a category from its own account.** Edit a category and choose an account under **Funded by transfers to** (for example Rent → your Rent saver). A transfer into that account from another budget account now goes straight into the category, as if you'd assigned it, and comes out of Ready to assign; moving money back out takes it out of the category. The category shows **+$X moved to …** for the month, and the transfer counts toward its target. Only linked (confirmed) transfers count, and each account funds one expense category.

## 0.2.0-up.51

- **Auto-assign**, like YNAB's. A new **Auto-assign** button on the budget previews what it would add to each category, then assigns exactly that once you confirm: **Cover overspending** (bring every negative category back to $0), **Underfunded** (what targets still need), **Assigned last month**, **Spent last month** or **Average spent** (last 3 months). It only uses money that is ready to assign today, never counts expected income and never lowers an amount you already assigned.
- **One-click amounts in the assign field.** Clicking into an overspent category's amount now offers **Cover $X overspent**, and a category with a target offers **Fund target**; either saves straight away. The **Spent last month** and **Monthly average** figures are now buttons that assign that amount.
- Fix: the editor no longer offers "Use $0 for the next 12 months" before you've typed anything. It now repeats the amount you've typed.

## 0.2.0-up.50

- **The budget is much faster on long histories.** Every month's envelopes are now worked out in one pass and kept until something changes, instead of being rebuilt from your whole history for each month. On a five-year test budget, changing last year's assignment went from about 6 seconds to under a tenth of a second, and opening a month from about a quarter of a second to almost nothing. Every figure is exactly the same as before.

## 0.2.0-up.49

- Fix: **deleting a category into another keeps its money.** The money assigned to it in every month now moves into the category you choose, along with its transactions, so the months it covered no longer turn overspent, and Ready to Assign no longer shows that spent money as available. Its schedules, payee defaults, rules and receipt lines move too. A category with transactions or assigned money can no longer be deleted without choosing where they go, and income only merges into income.
- Fix: **a group can't be deleted while its categories hold history.** Deleting a group used to delete its categories' assignments and leave their transactions uncategorised. The dialog now lists the categories to delete and move first.

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
