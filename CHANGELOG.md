# Changes

## 0.2.0-up.150

- **Bills you changed on purpose stay changed.** A household bill no longer says **amount changed** because of payments made before you set its amount. Raise a bill for a price rise and the old, lower payments stop flagging it; only a later bill that still doesn't match does.
- **Keep** joins **Update to** and the average on a bill's amount-changed prompt, for when the amount it expects is right. Undo takes it back.
- An amount you already raised before this update is still flagged once: choose **Keep** to clear it.

## 0.2.0-up.149

The last two of four Household updates that bring the page closer to Up's Essentials. Part three was merged as 0.2.0-up.148 but that version was already released with paying ahead, so it ships here.

- **When a bill's amount changes.** Each shared recurring bill is now a tile that says when it's due ("Due in 3 days"). When its last payment doesn't match what it expects, it says **amount changed** and offers **Update to** the last amount or the average of the last three payments. Nothing changes until you click. The tolerance is the one Recurring uses for matching: exact bills prompt on any change, "about the same" bills beyond 10%, and changing bills beyond 25%.
- **Edit amount** on the tile sets the expected amount and how it varies, with Undo. Recurring and your forecast follow.
- **Household bills follow an amount you change.** Editing a recurring amount, here or in Recurring, now also updates that bill's household bills that aren't paid yet, with your share recomputed. Paid and past bills keep what they were, and so does a bill with more set aside for it than the new amount (lower what's set aside first). Undo puts it all back.
- Each tile lists its latest payments (up to six, from the last six months), newest first, with their total.
- **One-off bills** (formerly "Bills to reserve for") now sit under the recurring bills.
- **Bills you haven't set up yet.** With a household account, **Looks like a bill** lists payees the account pays again and again that aren't recurring bills, such as power every two months or water every quarter. It reads a year of payments and shows how often each one comes, the range of amounts, and when the next one is about due.
- **Add as household bill** makes it a recurring bill shared with the household, with an amount that's allowed to change. Its expected amount is the middle of its last three payments. **Not a bill** stops suggesting it. Nothing is added unless you choose it.
- Backups are now version 34 and include the payees you said aren't bills. An older backup restores with none.

## 0.2.0-up.148

- **Pay your share ahead.** Sent a housemate money towards a shared bill they haven't recorded yet? Right-click the payment in your register (or tap ⋯ on a phone) and choose **Paid ahead to** and their name, or open the payment and choose **Paid ahead for a shared expense**. Until the bill is recorded in the household they owe it back to you; once it is, by you or by them in a combined household, your share comes off it. **Undo** in the toast, or **Remove from** the household in the menu, takes it back.
- Only your own money out can be paid ahead. A payment from a household account can't be recorded as a repayment from you any more: it is the household's money, so it is a contribution or an expense.

## 0.2.0-up.147

The first two of four Household updates that bring the page closer to Up's Essentials (see `docs/HOUSEHOLDS.md`).

- **Bills first.** The Household page opens with your recurring bills, then who owes what.
- **Is there enough for the bills?** With a household account, **Bills coverage** at the top works like the dial in Up's Essentials. It compares what the account holds now with the bills it will pay in the next 30 days ("A$150 of A$1,320 needed by 8 Dec"). It lists those bills and what is still to be paid in, then each person's part of them beside what they have paid in this month. The older figures, under plainer names, are under **Household account figures**. Assistants see the same figures in the `household` tool.
- **Newest first, and not everything at once.** Your expense shares and **All contributions, payments & repayments** list the newest entry first and open on its month and the month before. **Show older** goes further back, and always reaches at least one more entry. Choosing a **From** date still shows that whole range, and the statement's total and export still cover every date you chose.

## 0.2.0-up.146

- **Transfers say which way the money went.** A transfer between two of your accounts reads **Transfer to 2Up Essentials** on the money-out side and **Transfer from Spending** on the money-in side, instead of "Transfer: Spending", which could mean either. A name you typed yourself is kept.
- **One row per transfer.** Where a list shows both accounts, such as All transactions, a transfer between them is one row: **Transfer from Spending to 2Up Essentials**. Its details show the account it came **From** and the one it went **To**. An account's own register still lists its side, and a list filtered by anything other than accounts and dates (a search or a category, say) still shows both sides. The count above the list counts what it shows; the money in and out still includes both sides, as before. This applies to every linked transfer, and it matters most with Up, where your personal and 2Up accounts all sync.

## 0.2.0-up.145

- **Round-ups look like they do in Up.** A purchase you rounded up is listed once, at its total, with a small round-up mark: a A$51.52 shop rounded up 48c shows as A$52. Open it to see the purchase, the round-up, the Saver it went to and any boost. The round-up's own rows no longer fill All transactions or your Spending account; your Saver's own register still lists each credit, as Up's Saver does. A round-up whose purchase is still pending is left out of All transactions too. Nothing in your ledger changes: balances, the budget, reports, exports and your assistant still count every cent, and the transaction count above the list counts what it shows.

## 0.2.0-up.144

Working from home (D4a of `docs/TAX-CAR-AND-HOME.md`). Record keeping for your Australian return, not tax advice.

- **Hours at home, day by day.** Tax time has a new **Car and home** tab. **Add hours** records the hours you actually worked at home on a date (7.5 or 7:30), and each day can be edited or removed. **Fill a pattern** writes the same hours on chosen weekdays across a range, after showing "Adds 9 days, skips 1 already recorded"; a day you already recorded is never changed.
- **The ATO's fixed rate.** Hours times the year's rate go in **D5** on Deductions. Allotment knows the ATO's rate for 2022–23 to 2025–26 (67c, then 70c an hour). For a year it doesn't know, such as 2026–27, it says "Type the ATO's rate" and claims nothing until you do. You can also type your own rate for any year. A rate is never guessed or carried forward.
- **Bills.** Keep one bill for each expense the rate covers (energy, phone, internet, stationery) under the year's **Bills**. They go in the year's ZIP, and the CSV and ZIP include the hours.
- **Lodged years can be amended.** Marking a year lodged now records what working from home claimed. If you change the hours afterwards the change is allowed, and Deductions shows **Amended since lodging** with the old and new claim and **Mark lodged again**. Assets and investments keep their locks.
- **Assistants with an organise token can read the hours** (`GET /api/tax/home/{year}`) and the year's working-from-home claim and amendments in `tax_deductions`. They can't change any of it.
- The $1,000 instant deduction is not built: it is not confirmed as law yet, so there is nothing to compare.
- The demo budget has three weeks of hours. Backups are now version 33 and include hours, a year's rate and what lodged years claimed. An older backup restores with none.
- The car (cents per km and logbooks) comes in a later update (D4b).

## 0.2.0-up.143

Splits and consolidations (D3c of `docs/INVESTMENT-SALES-AND-INCOME.md`). Record keeping for your Australian return, not tax advice.

- **Split or consolidate a holding.** On **Investments**, a holding's menu has **Split or consolidate**: enter the date the new units count from and the ratio (**2 for 1** is a split, **1 for 3** a consolidation). You see the units you hold now and after, and each purchase's units, before you save. A split changes how many units you hold, not what they cost or when you bought them, and it isn't a sale, so it adds nothing to Tax time on its own.
- **Earlier sales keep their cost.** A purchase keeps the units and cost you recorded; its units today follow from the splits since. A sale counts its units as they were on its date, so 100 units costing $100, 40 sold for a $40 cost, then a 2-for-1 split leaves 120 units costing $60, and the sale still costs $40. A later sale draws its cost from the units on its own date. A sale dated before a split can still be recorded afterwards, in the units of its date.
- **Order matters, and Allotment says so.** A split can't be recorded or removed while a sale is dated on or after it, because that would change what the sale's units mean: remove the sale and enter it again afterwards. A consolidation rounds an odd unit down by less than a millionth of a unit and shows that it did.
- Purchases now show their units today when a split has changed them, and a purchase's cost can't be cut below what sales took, counted after the split. Reinvested units are counted the same way.
- Backups are now version 32 and include splits. An older backup restores with none.
- Mergers, demergers, returns of capital, rights issues and a fund's annual tax statement stay out of scope.

## 0.2.0-up.142

Dividends, franking credits and deposits (D3b of `docs/INVESTMENT-SALES-AND-INCOME.md`). Record keeping for your Australian return, not tax advice.

- **Record a payment** on a holding: a dividend, a distribution from an ETF or fund, or interest, copied from the statement. Enter the amount paid, the unfranked and franked amounts, the franking credit and any tax withheld. Without the credit, **30%** or **25%** works it out from the franked amount.
- **Dividend reinvestment.** Tick **Reinvested through a dividend plan** and enter the units allotted. They become a purchase of their own, at the amount reinvested, and the holding's units go up. Changing or removing the payment changes them too. Units a sale already took can't be taken away.
- **Link the deposit.** Under a holding's **Income** or **Sales**, link the payment or sale to its deposit in the register. Deposits for the same amount within 7 days are suggested, and nothing is linked by guess. The transaction then shows **Investment money**; its category and amount don't change. Each payment and sale can keep its statement or contract note as files.
- **Dividends and interest on Tax time.** A year's **Deductions** now also has **Dividends and interest (items 10 and 11)**:
  - Dividends' unfranked amount, franked amount, franking credit and tax withheld (11S, T, U and V), and gross interest (10L, M).
  - Distributions are shown apart, with a note to take their tax parts from the fund's annual statement.
  - A dividend whose parts don't add up is flagged. Super accounts are left out.
  - With $5,000 or more of franking credits in a year, a note explains the 45-day rule and flags payments around which units were bought and sold quickly.
  - The year's CSV and ZIP include them. Lodged years lock these figures as well as capital gains.
- **Assistants with an organise token can read your investments** (holdings, purchases, sales, income and a year's items 10, 11 and 18) through the new read-only `investments` tool. They can't record, change or link anything.
- The demo budget has a fully franked dividend.
- Backups are now version 31 and include payments. An older backup restores with none.
- Splits and consolidations come in a later update (D3c).

## 0.2.0-up.141

Investment sales and capital gains (D3a of `docs/INVESTMENT-SALES-AND-INCOME.md`). Record keeping for your Australian return, not tax advice.

- **Sell from a holding.** On **Investments**, a holding's menu has **Sell**: copy the contract note's trade date, units, proceeds and sale brokerage. The oldest purchases are sold first unless you **Choose parcels**. Before you save, you see each parcel's cost, its gain or loss, and whether it was held 12 months or more, so the 50% discount applies. The sale lowers the units held and what is left of each purchase. Nothing is added to the register: the cash is whatever your bank recorded. **Sales** on the same menu lists, changes or removes them; removing one puts its units back.
- **Sold holdings move out of the way.** A holding with every unit sold stays, under a collapsed **Sold** list, because its sales are the record of what was sold. A purchase that a sale drew from can't be removed or cut below what was sold.
- **Capital gains on Tax time.** A year's **Deductions** now has **Capital gains (item 18)**: total capital gains (18H), losses used, the CGT discount, net capital gain (18A) and net capital losses carried forward (18V), with each sale. Losses go against gains with no discount first. Losses carry from year to year, and you can enter net capital losses from before Allotment once. Super accounts are left out. A sale whose cost, purchase or exchange rate is missing is counted as not known, never zero, and Tax time says what to add. A foreign sale's cost and proceeds are converted on their own dates. The year's CSV (and ZIP) includes the sales and item 18.
- **Lodged years stay put.** With a year locked under Tax time → Assets, any change that would move its capital gains (a sale, a purchase's cost or date, losses carried in) is refused until you unlock it.
- **A new guide page, Investments,** covers holdings, prices, purchases, selling and what Tax time shows.
- The demo budget sells part of its share fund.
- Backups are now version 30 and include sales. An older backup restores with none.
- Dividends, franking credits, splits and a fund's annual tax statement come in later updates (D3b and D3c).

## 0.2.0-up.140

From the UI and UX audit (`docs/UX-UI-AUDIT.md`: AU-002, AU-011, and what was left of AU-001, AU-010 and AU-014).

- **On a phone, the budget opens on your envelopes.** Ready to assign is now one compact row (the amount, what it means and **Put the rest in…**), followed straight away by the envelopes you assign money to, then card payments, then Income. The month's summary and note, **Move money** and card payment details come after them. **Hold money** and how Ready to assign is worked out are under **Hold money, and how this is worked out**. Balance warnings, Ready to assign for each pool and money held for next month stay in view. The computer layout is unchanged.
- **The yearly budget opens on this month on a phone.** **Budget → Year** used to open on January, with this month off screen to the right. On a phone it now opens on the month you have open in the monthly budget (or this month), with **Jump to month** to go straight to any other. A fade on the right shows there are more months. The category names, group names and the **Assigned** / **Activity** labels stay in place as the months scroll. This month's column is marked for screen readers.
- **Custom report tables open their transactions.** In a custom report shown as a table, each name in the **Name / Amount** table opens **Transactions** with the same months, budget accounts and filters, and the same spending or income, so the register adds up to that row. Rows the register can't match exactly have no link: a report that picks its own accounts, filters more than one category group, or shows income grouped by payee, account or month, and the one payee row that gathers everything without a saved payee. Following a link with unsaved report changes asks **Leave without saving this report?** first.
- **After you delete a goal, payee or rule, the keyboard stays in the list.** Focus moves to the same button on the next row (or the row before, when you deleted the last), instead of being lost. The row also disappears as soon as the delete succeeds.
- **Tax time and Transactions tabs label their content,** like Recurring, Settings and Forecast, so screen readers say which tab it belongs to.
- **Fixed:** a long forecast on **Forecast** could scroll the heading and tabs off the page (since 0.2.0-up.138). The forecast scrolls inside its tab again.
- A browser test of a slow payee delete on a phone no longer depends on how fast the machine running it is.

## 0.2.0-up.139

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-014).

- **A category's spending opens the transactions behind it.** In **Reports → Spending by category**, each category's name in the table now opens **Transactions** filtered to that category, the report's months and the same budget accounts the report counts. Their **Net** matches the report's total: a split counts only its part in that category, a refund counts against it, and transfers between your accounts are left out. **Uncategorised** opens the uncategorised ones. Back returns to the report.

## 0.2.0-up.138

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-010).

- **Recurring and Settings tabs work like the others.** **Monthly** / **All recurring** and the Settings sections are now proper tabs, as on Forecast, Tax and Transactions. Screen readers say which one is open. With the keyboard, Tab reaches the open tab, the Left and Right arrows move between tabs (Home and End go to the first and last), and Tab again goes on to the content. A link to a Settings section still opens it.
- Screen readers now say which tab the content below belongs to on Recurring, Settings and Forecast.

## 0.2.0-up.137

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-007).

- **A half-written goal isn't lost to one Escape.** If you've typed or changed anything in **Add goal** or **Edit goal**, pressing Escape, clicking outside or ✕ now asks **Discard your changes?** with **Keep editing** (already selected) or **Discard**. Pressing Escape again keeps editing. A form you haven't touched still closes straight away, and **Cancel** still cancels.
- **Leaving a report you haven't saved asks first.** In the report builder, the back arrow asks **Leave without saving this report?** when its settings have changed since you opened or saved it, and the browser asks before closing or reloading the tab. The menu and the list of saved reports don't ask yet.

## 0.2.0-up.136

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-004).

- **A page that couldn't load says so, instead of looking empty.** If Goals, Payees, Rules or Files can't be fetched (Allotment can't be reached, or the server refuses), the page now says "Couldn't load your goals" (or payees, rules, files), gives the reason, and says nothing has been changed. **Retry** fetches them again. It used to show the welcome screen for a page with nothing in it, such as "No payees yet", as if they were gone.
- **If a refresh fails, what's on screen stays.** When the list was already loaded and fetching it again fails, it stays on screen with a note that it's what was loaded earlier, and **Retry**.

## 0.2.0-up.135

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, findings AU-005 and AU-006).

- **A delete that doesn't go through no longer looks like it did.** Deleting a goal, payee or rule now shows **Deleting…** until the server answers, and can't be pressed twice. If it's refused or Allotment can't be reached, the confirmation stays open with the reason, and pressing **Delete** again retries. The confirmations for disconnecting Up or SimpleFIN and deleting a file work the same way.
- **Saving a report shows that it's saving, and when it didn't.** **Save** and **Update** in the report builder show **Saving…** and can't be pressed twice. If the save is refused, the dialog stays open with the reason and your report name, so you can try again.

## 0.2.0-up.134

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-001).

- **The keyboard stays in an open dialog.** Pressing Tab or Shift+Tab in a dialog or phone sheet now cycles through its own controls instead of wandering onto the page behind, which can no longer be reached by keyboard or screen reader while the dialog is open.
- **Closing a dialog puts you back where you were.** Escape, Cancel or saving returns focus to the button that opened it. For a dialog opened from a row's ⋮ menu, that's the row's ⋮ button.
- **Escape closes one dialog at a time.** With a confirmation open over another dialog (such as **Close account** over **Edit account**), Escape closes only the confirmation and leaves you in the dialog underneath.
- Messages at the bottom of the screen, such as **Undo**, are still announced and usable while a dialog is open.

## 0.2.0-up.133

From the UI and UX audit (`docs/UX-UI-AUDIT.md`, finding AU-008).

- **Large amounts stay on one line.** On a phone, a summary figure such as $165,905.18 could break inside its digits, with the last "8" on its own line, or run off the edge of the screen. Summary tiles on the dashboard, the reports, report details, the forecasts, goals, tax and investments now keep each amount whole. A tile whose amount doesn't fit beside another takes the full row instead. Labels still wrap, and nothing is shortened or made smaller.

## 0.2.0-up.132

First fixes from the 7 November 2026 UI and UX audit (`docs/UX-UI-AUDIT.md`, findings AU-003, AU-009, AU-012 and AU-013).

- **Charts show where the keyboard is.** Tabbing onto a chart now shows the same focus ring as everywhere else. Clicking or tapping a chart still shows no box.
- **Deleting a goal says what Undo brings back.** The confirmation no longer says "This cannot be undone". It says you can undo it, that files attached to the goal are unlinked (they stay in **Files**), and that a paused, completed or retired goal comes back active. After deleting, a message with **Undo** appears, so you can undo on a phone too, not only with Ctrl/⌘+Z.
- **Show in the menu is readable on a phone.** In **Settings → Preferences**, each optional feature's description now takes the full width, with **When in use**, **Always** and **Hidden** on a row below. The **Date format** choices no longer run off the edge of a narrow phone.
- **The Goals guide matches the goal form.** It now describes the two progress sources: a category, where progress is the money available in that envelope, and **Manual tracking**, where you update **Saved so far** yourself. Linking an account is for reference and doesn't update the goal.

## 0.2.0-up.131

- **Cancelled recurring items leave the month.** A cancelled subscription (shown as **Cancelled**) no longer appears in **Recurring → Monthly**, its calendar or its totals, and a cancelled bill drops off the household's **Recurring bills**. It stays under **All recurring**. Forecasts and the budget already left them out.
- **Changing a recurring amount reaches the household bill.** Editing a bill's amount now also updates an occurrence due today or moved by a weekend, which the household's **Recurring bills** and "Your share of …" read. The Household page refreshes straight away.
- **Rename a household, and choose which one opens first.** **Edit** beside the household's name changes its name. **Open this household first** makes it the default for the Household page and the sidebar's Household link.
- **See where household balances come from, and reconcile them.** Under **People & balances**, **Where these figures come from** shows each person's household-account part and what people owe each other directly. **Reconcile balances** agrees everyone's balance from a date (zero unless you type another figure). It does this with adjustment entries that keep the history. Removing those entries undoes it. Assistants can preview it (`household_reconciliation_preview`) and propose it (`propose_household_reconciliation`); nothing changes until you apply the proposal.
- **Up round-ups stay with their purchase.** A round-up debit now reads "↳ Round-up of _purchase_" in the register. When Up reports the Saver credit for exactly that round-up on the same day, the sync links the two itself, so you're no longer asked whether a 52c round-up is a transfer. Any other move to a Saver is still offered for you to confirm.
- **An Essentials account can have its own Ready to assign.** In **Edit account**, turn on **Own Ready to assign for the bills paid from this account**. The categories of the recurring bills paid from it are then funded only from the money moved into it, and that money shows under its own name below Ready to assign. **Edit category → Ready to assign from** changes which categories it covers. The main Ready to assign leaves that money out, and assigning more than the account holds is refused.
- **The tab icon is the Allotment mark everywhere.** The browser and phone icons now load from new addresses, so browsers that kept the old icon pick up the new one.

## 0.2.0-up.130

- **Bills a household account pays no longer show as expected in your own envelopes.** The Budget page's orange "expected" note (and "Available after these") left out bills paid from a household account only if that account was off budget. Rent paid from a 2Up account, for example, showed its full amount as still to come in your personal Rent envelope. Now the Budget page and the payday plan use one rule: a recurring payment counts only when it leaves one of your own open accounts, whether spent or moved out to a household or off-budget account. So a scheduled transfer of your share into the household account is now expected in its category on the Budget page too, as the payday plan already counted it.
- **Your share of a household bill follows how you actually split it.** A bill paid from a household account that isn't on the household's **Recurring bills** list used to show "your share" with the household's default split (equal when there is none). It now uses how its latest payment was shared, such as rent in fixed amounts, scaled to the expected amount, and falls back to the default split only before anything is shared. Recurring → Monthly and the dashboard's Bills show the same figure.
- **Matching a payment to a recurring item gives it the item's category.** When a bank payment is matched to a recurring item (by hand, from a suggestion, or by **Find recurring**), it now takes the item's category if it has none, so the bill counts in its envelope instead of sitting uncategorised. A category you, a rule or a payee default already set is kept, and split totals, balance corrections and plain transfers are left alone.
- **Review → Tidy up lists recurring bills with no category.** These are bills no envelope expects and no payday plan sets money aside for. **Open Recurring** takes you to fix them. Assistants see the same list in `budget_housekeeping`.
- **Household money is kept apart when sorting uncategorised payees.** The list of uncategorised payees now says whose money each group is: your own budget first, then rows in a household account (which never touch your budget) and off-budget rows. A payee you already recorded as a housemate's money is marked as theirs. **Sort your first import** only lists your own budget, notes a housemate's money ("Alex's money (Home), not your income") and no longer puts Income categories first for it. Assistants are told never to give a housemate's money an Income category.
- **Categorise repayments you make, too.** **Household → Categorise repayments** now also lists money you paid someone back for things they paid, when the payment has no category. It suggests the categories of your shares of what they paid. An expense they paid has no bank payment of yours, so its category comes from the payee its description names: that payee's default category, or the one you use most for it. As before, nothing changes until you press **Categorise**, and the household's balances stay as they are.

## 0.2.0-up.129

- **Bill reminders work with separate budgets.** With **multi_user** on, each person can now turn on reminders in **Settings → Server → Reminders** (**Send reminders**) and choose how early in each recurring item, as with a single budget. There's no notify service to enter: a reminder goes to that person's own phone or email from **Password codes**, their phone unless they choose otherwise under **Send reminders to** (My phone, My email or Both). **Include the name and amount** and **Send a test** work as before, and reminders still go out once, in the daytime. A budget can only send to its own person, and only through the app on the same machine. Turning **multi_user** off brings back a single budget's own notify service setting, unchanged.

## 0.2.0-up.128

- **Password codes by email, for separate budgets.** With **multi_user** on, the Home Assistant administrator can set a mail server in the app's new optional `smtp_` options (host, port, `tls` or `starttls`, login and the address codes come from). Each person can then add an email address in **Settings → Server → Password codes**, beside their phone, and **Forgot password?** sends their six-digit code there. Emails are plain text with no links, always sent over an encrypted connection with the mail server's certificate checked, and the mail password never reaches anyone's budget. Leaving the options empty keeps email off, as before.
- **A phone or address is saved only once you confirm it.** Adding or changing your phone or email address sends a code to it, and it is saved when you type the code back, so nobody can point their codes at someone else's phone or inbox. A phone you already saved stays as it is. The **Test** button is gone: the confirmation code shows it works. You can remove either at any time.
- **You choose where your codes go.** With both a phone and an address, choose **My phone**, **My email** or **Both** (both until you choose). The administrator's code also goes where they chose and is still written to the app's Log. If what you chose can't be used any more (say email is turned off), the code goes to the other. To keep inboxes and phones from being flooded, at most one code a minute goes to each, and at most ten emails a day per person.

## 0.2.0-up.127

- **An assistant's changes are checked again at the moment they're saved.** When an assistant using an access token makes a change (setting a category, editing or applying a rule it proposed, linking a suggested transfer, claiming a tax deduction, recording a household contribution), the rule that allows it is now checked a second time inside the same save, not only before it. If something changed in between (you reconciled the transaction, enabled the rule, claimed the deduction yourself, or the deposit's amount changed), the assistant's change is refused, nothing is saved, and **Settings → Server → Access tokens → Assistant activity** lists it as refused with the reason "This changed before it could be saved". An assistant's tax claim can now only ever add a claim, never replace one, even by mistake. Your own changes in the app work as before.

## 0.2.0-up.126

- **Field names are joined to their fields everywhere else too.** Adding or editing an account, updating an account's value, goals, recurring items, categories, payment plans, saved reports and dashboard names, the export dates, password change, Plaid and SimpleFIN setup, a transaction's value in your main currency, and editing several transactions at once: clicking a field's name now puts the cursor in that field, and screen readers read each field with the name shown above it. A name over a row of buttons (an account's logo, a goal's icon and colour, a recurring item's type and amount precision, a category's budget type) now names that group of buttons for screen readers. Nothing about what the forms save has changed.

## 0.2.0-up.125

- **Field names in the transaction forms are joined to their fields.** In Add transaction, the new-transaction row of an account, a transaction's details, editing several transactions at once and Reconcile, clicking a field's name (such as **Notes** or **Outflow**) now puts the cursor in that field, and screen readers read each field with the name shown above it. Nothing about what the forms save has changed.

## 0.2.0-up.124

- **Reading receipts with Claude works with today's models.** When Anthropic reads your receipts, Allotment now asks Claude for its answer in a fixed form (structured output), so the merchant, date, amounts and items always come back in the shape Allotment expects. It also no longer sends a setting that current Claude models, including the suggested **claude-haiku-5-5**, reject with an error, and it gives them room to think before answering. If Claude declines to read a photo, or its answer is cut off, the receipt says so instead of keeping a half-read answer. Local model servers and OpenAI read receipts as before.

## 0.2.0-up.123

- **An old, unused table is removed.** Recurring items moved to a new format in September, and the old copy has been left behind unused since. Updating removes it and the link each transaction kept to it; your recurring items, their payments and every transaction stay as they are. Take a backup before updating as usual: backups never held the old table, so any backup, older ones included, restores as before.

## 0.2.0-up.122

- **Enable Banking's setup steps are in Allotment's own guide.** The new **Enable Banking (Europe)** page of the guide explains what you need, setting up your own free application (a Production application, the redirect URL, the .pem key and linking your accounts), connecting your bank, pasting the address back if your bank can't return you to Allotment, and reconnecting when the bank's access ends. The setup form's **Step-by-step guide** and **How syncing works** after a sync now open that page inside Allotment, closing the dialog, instead of the upstream FlyBudget website, and **Connecting Up** links to it under Other banks. The server's warning about an unconfigured reverse proxy now points to Allotment's Start here guide. No link in the app goes to flybudget.org any more.

## 0.2.0-up.121

- **Four new pages in the guide.** **Payday plans** (setting one up, each kind of funding rule, what happens on payday, undo), **Card payments** (setting a card up, what a purchase and a repayment do, and a reserve that's short), **Budget review** (coming back after a break, what needs attention, guided setup, the flexibility reserve, the cash runway and extra income) and **Long-term forecast** (starting a plan, life events, super, HECS-HELP and other study loans, today's dollars and the simulation). Each page now links to the guide page that explains it: **How payday plans work** under Budget → Until payday, **How card payments work** in the Card payments panel, **How the review works** on Review and **How the long-term forecast works** on Forecast, as do Tax time, Reports, Household, Settings → Data and the Up settings for their own pages.
- **Guides for Payees and Cash flow, and three new tips.** Both pages now have a short guide, offered on a first visit and kept under **?** → **Guide for this page**. New one-time tips: on Review, that **Mark review complete** lets the next review show what changed; on Recurring, that **Find recurring** suggests bills and pay from your history; and on the long-term forecast, what today's and future dollars mean. As before, a page shows at most one tip, and none while it offers its guide.

## 0.2.0-up.120

- **Previous and next in a transaction's details.** The details panel (a full-screen sheet on a phone) now has **Previous transaction** and **Next transaction** buttons beside **Close**, so you can work through a list without closing and reopening each one. They follow the list you're looking at, in its order, with your search and filters applied, and go past the rows shown so far when there are more. At the first or last transaction the button is greyed out. Anything you typed is saved to its own transaction before the next one opens, and moving between transactions changes nothing on its own. The buttons work from the keyboard, are 44 pixels square on a phone, and closing the details puts the keyboard back on the row you were looking at.

## 0.2.0-up.119

- **Housemates' money isn't your income.** When housemates pay their share into a household account (a 2Up, say), Recurring no longer counts it as your income, and the dashboard's **Next pay** is only ever your own pay. Recurring → **Monthly** now has three parts: **Income** and **Expenses** are yours, and a bill the household shares shows there at your share, such as "Your share of Rent (Home)" with the full amount beside it; **Household account**, folded away, lists the household's bills in full and what each person puts in, and isn't in your totals. **All recurring** marks household items with the household's picture, and **Find recurring** labels them "Household bill" or "Household contribution" without putting a housemate's deposit in an Income category. The forecast and Review never take household money as expected pay, and Allotment no longer offers a housemate's regular transfer as your salary once you've recorded it as theirs.

## 0.2.0-up.118

- **Review the transfers Up reported.** Up says which account a transfer went to or came from (your Spending account to a Saver, for example), though not which transaction is the other side. Allotment now uses that: in an account's **Possible transfers → Review**, pairs Up reported come first under **Up reported these**, and the banner says how many there are. A transaction from Up is only ever paired with one in the account Up named, so a payment of the same amount into another account on the same day is no longer offered in its place. As before, a sync links nothing: you tick each pair that is right and choose **Link**, or **Not a transfer**.

## 0.2.0-up.117

- **Type sums and move between envelopes from the keyboard.** An envelope's amount can be a sum: **100+50** saves $150 and **150\*2** saves $300, in your currency's separators. A sum doesn't add to what was there, so **+50** saves $50, and one that can't be worked out (such as **\*2** or **100+**) stays in the box to fix instead of saving. On a computer, the **down arrow** or **Tab** saves and goes to the next envelope shown, the **up arrow** or **Shift+Tab** to the one before, **Enter** saves and **Esc** cancels; hidden and filtered-out envelopes are skipped. A negative assignment now opens with its minus sign, so saving it unchanged keeps it, and the phone keeps a minus sign as the computer does.
- **An inspector beside the budget, and notes.** With nothing ticked, the panel at the top of the sidebar shows the month: what was carried in, assigned, spent and is available across your envelopes, plus a note for the month. Tick an envelope to see its own figures, target and note, or several to see only their totals and **Fund** just their targets. Ticking never moves money. Notes save when you leave the box; an envelope's note is the same every month and goes if the category is deleted, and on a phone it's in the envelope's amount sheet. Backups include notes (older backups restore with none); an access token can read notes but not change them.

## 0.2.0-up.116

- **Card payments are rows in the budget.** Each card you've set up for payment funding now has its payment envelope in a **Card payments** section of the budget table (and a card on a phone), beside the envelopes its purchases came out of. With $100 assigned to Groceries and an $80 purchase on the card, Groceries reads $20 and the card's payment envelope reads $80. Under its name the row says what is owed, and shows anything the reserve doesn't cover in red (**Payment shortfall**, **Payments without funding**) plus **Extra reserve** and **Prepaid card balance** when there are any. A repayment you've linked as a transfer uses the reserve up without changing Groceries. The figures are the same ones the sidebar's **Card payments** panel shows, which still has **Fund debt** and the setup review: cards you haven't reviewed keep their conservative treatment and still show as a review there. The expense totals still leave payment envelopes out, as before.

## 0.2.0-up.115

- **Move money from the envelope, and give money back to Ready to assign.** Click an envelope's **Available** figure (tap it on a phone) and **Move money** opens with it filled in: an envelope with money becomes the source, and an overspent one becomes the destination with the amount it is short, so you only choose the other side. **Ready to assign** is now a destination: it takes money out of an envelope without giving it to another one, and Ready to assign rises by exactly that amount. The preview shows both sides' figures afterwards, now says what the move does to each funding target (for example "Groceries target: still needs $50 (was fully funded)") in place of the old general notice, and has a **Cancel** that writes nothing. Money move history names Ready to assign, and **Undo move** works for it as for any move. A new **Move money** page in the guide explains it. Moves in a future month are still not available, and a goal's retire-and-move still goes to a category only.

## 0.2.0-up.114

- **Household corrections now wait for your approval.** An assistant with a **Read, categorise and organise** token can propose removing household entries, sharing bills paid from a household account, or unlinking transfers the bank matched wrongly into a household account, but no longer makes those changes itself. Each request arrives as one proposal under **Settings → Server → Access tokens → Waiting for you**, where **Show what it changes** lists every entry, bill or transfer with its date, amount and people. Nothing changes until you choose **Apply**, and then all of it happens or none: if anything is refused, nothing changes and the proposal keeps waiting with the reason. **Decline** discards it. This replaces the temporary permission in 0.2.0-up.113.

## 0.2.0-up.113

- **A temporary assistant permission to correct a household's history.** Approved by the owner on 6 November 2026, for one household where rent was counted twice, bills paid from its accounts were never shared, and some deposits were matched to the wrong transfers. For this release only, an assistant with a **Read, categorise and organise** token may remove a household contribution, or an expense you paid yourself that you don't share with those people (never an expense the household account or someone else paid, a repayment or a refund), share a past bill paid from a household account as an expense, for exactly that payment's amount and date, and unlink a transfer that touches a household account so the deposit or bill can be recorded properly. Everything else stays the owner's, the household's activity list records each change, and **Assistant activity** in Settings logs every request. The next release removes the permission.

## 0.2.0-up.112

- **Month quick fills, and choosing which envelopes to fill.** **Assign → Auto-assign** can now use the average of the last 3, 6 or 12 months' spending (months with no spending count), and **Set to zero** clears the month's assignments. For copying last month's assignments or spending, or an average, you choose **Add** (only top envelopes up, as before) or **Replace** (set each envelope to that amount, giving the difference back to Ready to assign; an assignment never goes below $0). Every row now has a tick: untick an envelope to leave it out and the rest is planned again, in **Fund targets** too. The preview shows what each row takes back or adds, and marks an envelope that taking money back would leave overspent. Nothing changes until you apply, and the same checks as typing an amount still apply.

## 0.2.0-up.111

- **Hold money for next month.** In the current month, **Hold money…** under Ready to assign sets aside part of what's ready to assign for the month after. It leaves Ready to assign now, so the month can reach $0 and read fully budgeted while next month's pay is still in your account, and it comes back when next month starts. Held money can't be given to a category (this month's or a later one) until then; you can only hold what is ready to assign, and **Change hold** or **Release hold** puts it back. Nothing is spent or moved: it is a note about those dollars, shown in the working under Ready to assign as **Held for next month**. Your backup includes holds; older backups restore with none. An access token can't set one.

## 0.2.0-up.110

- **Keep overspending, for money you'll be paid back.** In **Settings → Categories → Edit**, a category can now **Keep overspending**. Normally an envelope that ends a month overspent starts the next at $0 and the money comes out of Ready to assign. With this on, the deficit carries into the next month instead, so Ready to assign isn't reduced until you assign money to cover it or the repayment arrives and you give it that category (then it's back to $0). The budget reads **Overspending kept** on that envelope, and Review still lists it as overspent, marked **kept until repaid**. Card purchases that no envelope money backed stay card debt until the money that covers the deficit arrives, which then reserves them on the card payment. It is off for every existing category, income and card payment categories can't use it, and an access token can't turn it on. Your backup includes the setting; older backups restore with it off.

## 0.2.0-up.109

- **A refused budget amount stays in the box.** Typing an amount for an envelope no longer closes the box before the server has answered. It shows **Saving…** while the request is on its way (a second Enter sends nothing more), and if the amount is refused, for example because it is more than you have to assign, the box stays open with what you typed and **Not saved** plus the reason. On a phone, the sheet stays open the same way. Nothing says it saved until it has.
- **Undo says when it can't.** If an undo or redo fails, a message now says why instead of nothing happening. When the budget changed since (another edit, another device), it says so, leaves your current figures as they are and drops the stale step.
- **Available explains itself.** An envelope below $0 reads **Overspent**; one with money in it but less than its target needs reads **Short of target**; and one where you spent more than you assigned this month but carried-in money covers it reads **Covered by carried funds** (the bar is amber, not red, because it isn't a deficit). Phone cards say the same, and screen readers hear it.

## 0.2.0-up.108

- **Household spending by month, person and category.** On the Household page, **Spending by month, person and category** (under the spending list) uses the same date range and shows spending by month (with a chart), what each person paid against their share of it, and spending by category taken from the category of each entry's linked bank payment, with entries that have none under Uncategorised. Repayments and money put into the household account are not counted as spending. The household statement, and the assistant's `household_statement` tool, return the same three breakdowns.

## 0.2.0-up.107

- **Edit a household entry where it is.** On the Household page, **Edit** next to an entry in the history changes its description, and, when it isn't linked to a bank payment, its date, amount, who paid and how it's split. Refunds and the bank link stay attached. An entry linked to a bank payment keeps that payment's date and amount, and an expense with a refund changes its description only. A change that would leave a later repayment larger than what was owed is refused with the reason, and nothing changes.
- **Household activity.** A new **Activity** list under the history shows what was added, changed, removed or repaid, newest first, and keeps the line for an entry you removed. Payments shared by a rule or a shared recurring bill are marked as theirs. In a combined household, both people's activity is listed together. Your backup now includes it; older backups restore with an empty list.

## 0.2.0-up.106

- **Settle up on the Household page.** Under **People & balances**, a new **Settle up** list says who should pay whom to clear what people owe each other for things they paid themselves, for example "You pay Alex $30" and "Sam pays Alex $30", in at most one fewer repayments than there are people. **Record** saves one as a repayment in one click. What people owe the household account is listed separately ("Sam puts $x into the household account") and never as a repayment between people.
- **Your own repayments are matched too.** When you owe a housemate and one of your bank payments names them, **Household → Sharing** now offers **Record your repayment to …**, and Settle up offers **Link payment** instead of **Record**, so the same payment isn't entered twice.
- **The spare cent moves around.** An equal split that doesn't divide evenly (for example $100 three ways) no longer always gives the extra cent to the first person. Which person gets it now varies from entry to entry. Entries already saved don't change, and refunds still reverse the original shares exactly.

## 0.2.0-up.105

- **Easier to use with a screen reader or a thumb.** Budget and a category's page now have a proper heading, every icon-only button says what it does (the report builder's back link and group expanders, saved-report delete, cancel in the category picker), and the dashboard's period menus and the Add transaction date are labelled. Faded text on disabled rules is gone: a rule that is off now says **Off: turn it on to use it.** Placeholder and empty-state text that was too pale to read is darker. On a phone, the buttons in Settings → categories, the dashboard's recent transactions (now the same cards as the register), payee pictures, Review links, cash flow presets, the year view's months and the Files filters are at least 44 px.
- **One name for each thing.** **Ready to assign** is now the only name for money with no job yet (it was also Unassigned and Left to assign), and **Payee** replaces Merchant wherever you pick or read who was paid (receipts and payment plans keep their shop's name as Merchant). The words are listed in docs/GLOSSARY.md.
- **Consistent capitals and dates.** Headings, buttons and labels use sentence case ("Cash flow", "Add account", "Connected banks"). Dates that showed as 2026-11-05 in imports, Payday, Household and Up now follow your Date Format, and Up's last-synced times do too.
- Settings → Server's self-hosting link opens this project's Start here guide, not the upstream site's page, which uses different names.
- Behind it: a lint rule that fails a nameless icon button, tests that keep every text colour at the 4.5:1 contrast in both themes and that keep the retired names out, a browser setting (`E2E_CHROMIUM_PATH`) for tests on a machine whose Chromium differs from Playwright's, and a desktop test that no longer fails under Node 22.

## 0.2.0-up.104

- **No gap at the top on iPhone.** Added to the Home Screen, Allotment left an empty band between the status bar and its header. The header now reaches up behind the clock and battery in the header's own colour, light or dark, and pages, the menu, sign-in and messages keep clear of the notch and the home bar. Safari's toolbar also takes the header colour. If you had already added Allotment to your Home Screen, remove it and add it again so iOS picks this up.

## 0.2.0-up.103

- **Take a file import back out.** Every import into an account is now remembered. When you open **Import CSV**, **Earlier imports** lists each file with how many of its transactions are still there, and **Undo this import** removes exactly those. Anything you have reconciled, marked reviewed, linked as a transfer, split, shared with a household or attached a file to is kept, and the result lists what was kept and why. If the import had moved the starting balance to keep today's balance, it is moved back. **Put them back** re-imports what was removed. The last step of an import offers the same Undo. A backup now includes the history (backup format 26); older backups restore without it.
- **Bill and payday reminders.** A schedule can now remind you **On the day**, **1 day**, **3 days** or **1 week before** (Recurring, **Remind me**). Reminders arrive as Home Assistant notifications on the phone you choose in **Settings → Server → Reminders**, with a **Send a test** button. Off until you turn it on; one message per occurrence, sent in the daytime from the hourly schedule timer; the text only says how many items are due unless you tick **Include the name and amount**, because a lock screen shows it. A failed send is tried again the next hour. It works in the single-budget Home Assistant app; a multi-user server, a desktop copy or Docker has no way to send, and Settings says so.
- **Settings → Server → Access tokens.** The section was called "Read-only access" and said a token can only read, but categorise and organise tokens can change things (categories, rules, payee settings, tax claims, household contributions). The name and the explanation now say so, and the password-change message says "access tokens". Access tokens cannot list import history, because file names can carry an account number.

## 0.2.0-up.102

- **File imports warn about repeats.** When a statement file covers days an account already has, the preview now flags each row that looks like a transaction already there: the same amount within three days, with a payee that doesn't contradict it. That catches rows you typed by hand, rows a bank sync brought in, rows a schedule posted and an earlier import of the same period in another format. Flagged rows start unticked, say what they look like ("Looks like Woolworths on 2 Nov, entered by hand"), and import if you tick them. Nothing is skipped without you choosing. The finished screen counts any flagged rows that you did import.
- **Scheduled transactions no longer wait for a restart.** Recurring items set to auto-create, and the 90 days of upcoming occurrences, were only topped up when Allotment started. Now they are checked every hour while the server is running, after the startup bank syncs and never while an Up sync is in progress. A bill due today posts within the hour.
- **Dates count the same in every time zone.** One date helper now does all day-by-day arithmetic. This fixes a lookback that came out one day short in Sydney, a household bill due-date check and a month-ago balance that used the UTC day instead of yours, and the daily net-worth report, which lost a day in zones whose clocks change at midnight (it is now tested in Sydney, UTC, Montevideo, Havana and Beirut). A lint rule stops the pattern coming back.
- A currency written as its code (for example AUD or EUR) keeps a space before the number; this was checked and is now covered by a test.

## 0.2.0-up.101

- **Clearer assistant activity.** Settings → Server → Read-only access → **Assistant activity** now says, for every change an assistant asked for, what it was in plain words, which tool asked, and whether it was done, not done (the app's own rules said no, with why) or refused. It keeps no copy of what was sent, and only the newest 5,000 entries; entries kept by up.99 and up.100 lose theirs.
- Behind it, each kind of change an assistant may make is one entry in a single policy list with its own check, so nothing else can get through. Assistants using Allotment's MCP server need no change.

## 0.2.0-up.100

- **Faster first load.** Allotment now loads only the Dashboard, Budget and Transactions up front; every other page loads the first time you open it. The app's main download is about 44% smaller, which matters most on a phone or away from home.
- **One Assign menu.** On Budget, **Assign** gathers Auto-assign, Fund targets and Until next payday. Each still shows what every envelope would get before anything changes. Behind them, all planned assigning (including an assistant's suggestions) now uses the same plan and the same write, and every way of sharing a payment with a household gives the same checks and messages.
- **Deleted bank transactions stay deleted for every bank.** Deleting a transaction that Enable Banking, SimpleFIN or Plaid brought in now keeps the next sync from bringing it back, as Up already did. Settings → Connected Banks lists them, in each account's own currency, with Restore, which puts the transaction straight back.

## 0.2.0-up.99

- **See everything an assistant does.** Settings → Server → Read-only access → **Assistant activity** lists every change an access token asked for, newest first, including the ones it was refused. Behind it, a token can only make changes through one assistant endpoint, as a named action; it can no longer write to the app's routes directly. Existing assistants using Allotment's MCP server keep working unchanged.
- **Assistants can propose depreciating assets.** An organise token's assistant can propose a new asset, or a change to one, from a receipt or purchase. It waits under **Waiting for you** in the same settings section until you choose Apply or Decline; applying runs the same checks as your own change, including locked lodged years.
- **Categorise repayments back to what they paid for.** When someone in your household repays you, the Household page offers to categorise the deposit to the category of what they owed you for (for example Groceries), so your reports show your share rather than the whole bill. Nothing changes until you press Categorise, and the household's balances never change.

## 0.2.0-up.98

- **Read receipts with Claude or ChatGPT.** Settings → Read receipts automatically now asks who reads them: a model server on your own network (as before), Anthropic (Claude) or OpenAI (ChatGPT) with your own API key. A cheap model is suggested (Claude Haiku or GPT mini); a receipt usually costs a fraction of a cent. The key is stored encrypted, is never shown again, and is left out of backups and exports. A Claude or ChatGPT subscription doesn't include API use: create a key in Anthropic's or OpenAI's console.
- **Up categories learn from you.** When you have put at least three Up transactions of one Up category into the same envelope (four times out of five or more), new transactions in that Up category go there too, after your rules and payee defaults. Up's water, gas and power category now lands in Electricity & Gas on the short Australian template, hobbies and books in Entertainment.

## 0.2.0-up.97

- **Tour first.** A new budget's Get started card now leads with the two-minute tour: **Show me around** or **Skip the tour**, and the first steps follow. Only one thing at a time is offered above a page: no guide note or tip appears beside the Get started list, and a page's "First time here?" note shows on your first visit only. Its guide stays under the **?** button.

## 0.2.0-up.96

- **The low-value pool (D6).** An asset that cost under $1,000 can go into the low-value pool in its first year, and a diminishing value asset can join once its value falls under $1,000: open it in Tax time → Assets and choose **Move to the pool**. The pool is written down 18.75% for assets added that year and 37.5% of its balance, on each asset's work-use share; selling a pooled asset reduces the balance (anything over it is income). Tax time → Assets shows the pool year by year, and Deductions, its totals, CSV and ZIP include the D6 deduction. Lodged years stay locked: a change that would alter a lodged year's asset or pool figures is refused until it is unlocked.
- Backups now use format 25 (they keep each asset's pool year). Older backups still restore.

## 0.2.0-up.95

- **Depreciating assets on Tax time.** A new **Assets** tab keeps things that lose value over several years, such as a laptop for work. Add one, compare the ATO's two methods (prime cost and diminishing value) side by side, and pick one; suggested effective lives for common items link to the ATO's table. Each asset shows its year-by-year schedule, lets you change a year's work-use share, keeps its records (warranty, invoice) as files, and records when you sell it or stop using it. Lock a year once it's lodged so its figures stay as lodged.
- **Depreciate instead.** A claim over $300 in **Deductions**, or in a transaction's details, offers **Depreciate instead**: the asset replaces the outright claim in one step. Each year's decline in value appears in Deductions, its totals and exports.
- **Files can be linked to an asset**, and Allotment's guide has a **Tax time** page.

## 0.2.0-up.94

- **Depreciating assets, behind the scenes.** Tax time can now work out the decline in value of something that loses value over several years, such as a laptop for work, the ATO's two ways (prime cost and diminishing value), including the first year's days held, each year's work-use share, and selling or disposing of it. A financial year can be marked lodged, which locks its asset figures. A purchase is never both claimed outright and depreciated. Assets are kept in backups and appear in a year's deductions, CSV and ZIP. The screens to add and manage assets come in the next release.

## 0.2.0-up.93

- **Faster Up syncs.** A sync now asks Up only for recent transactions (the two weeks before the newest one) and any that are still pending, instead of your whole history every time, so it makes a couple of requests per account instead of hundreds. A pending transaction that settles weeks later is still picked up. All of Up's history is still checked once a week, on an account's first sync, after **Restore** in Up review, and whenever you choose **Check all history** in Settings → Connected Banks → Up.

## 0.2.0-up.92

- **Backup with files.** Settings → Data now has **Backup with files (.zip)**: the same backup as **Download Backup**, plus every file in Files (receipt photos, PDFs, documents and videos). **Restore Backup…** takes it too, on this installation or a new one, and checks every file before it changes anything: a damaged ZIP restores nothing. Bank connection credentials, passwords and the encryption key are never in a backup.

## 0.2.0-up.91

- **Up first, any bank by CSV.** Plaid, SimpleFIN and Enable Banking are now marked **community supported**: they keep working, but only Up is checked with every release. Wherever a bank connection is offered (Welcome, **Settings → Connected Banks**, **Add account** in the menu), importing your bank's CSV files is offered too, and works with every bank.
- **Review no longer asks you to reconcile what Up just checked.** Right after an Up sync, an Up account whose register matches Up's balance isn't counted under "Reconcile accounts with your bank"; Review says it matches Up instead. Nothing is marked reconciled for you, and adding or deleting a transaction by hand brings the request back.

## 0.2.0-up.90

- **Light or dark, as your device is.** A new install starts on the **System** theme, so Allotment follows your phone's or computer's light and dark setting. A theme already chosen on a device stays as it is; change it in **Settings → Preferences → Theme**.

## 0.2.0-up.89

- **A shorter menu.** The sidebar groups **Planning** (Goals, Forecast, Investments, Tax time) and **Tools** (Payees, Rules, Files) under headings you can fold away. **Pay later**, **Household**, **Investments**, **Tax time** and **Files** appear once they hold something, so a new budget's menu starts short. Choose for each one in **Settings → Preferences → Sidebar** (When in use, Always or Hidden); **More features** in the menu leads there. Their pages still open from any link, and the menu always shows the page you're on. The choice is saved with your budget and follows you to every device.

## 0.2.0-up.88

- **Fix: the sidebar's account list could crash when a balance crossed zero.** It read the hidden-balances setting only for overdrawn accounts, which React doesn't allow; it now reads it for every account.
- **A linter checks every change.** ESLint now runs in CI on the app and server code, with React's hook rules and accessibility checks. Its first run found the sidebar bug above, along with unused code (including a report query on Cash Flow that fetched data nobody used), which is now removed. Accessibility findings are counted and can only go down from here (`lint/README.md`).

## 0.2.0-up.87

- **More of a first Up import arrives categorised.** Up's categories that the short Australian template had no envelope for now go to the nearest one: taxis and rideshare (Uber) to **Public Transport**, technology (JB Hi-Fi) to **Entertainment**, homeware and repairs (Kmart, Bunnings) to a new **Home & Garden** envelope, and life admin (Service Victoria, Service NSW) to the rego envelope. In the test history that leaves about 1–5% of spending to sort, down from 10–22%. A closer envelope still wins where a budget has one (Ride Share, Electronics, Home Maintenance).
- **Envelopes in your state's words.** A new budget created in Victoria starts with **Rego & TAC** and **Council Rates & Owners Corp**, and one in New South Wales with **Rego & Green Slip**; elsewhere the names stay **Rego & CTP** and **Council Rates & Strata**. The state comes from the time zone where the budget is created. Existing budgets keep their envelopes and names: to use the new mapping, add a **Home & Garden** envelope, or rename one, in **Settings → Categories**.

## 0.2.0-up.86

- **A new budget starts the day you connect Up.** Connecting Up mid-month used to count the month's earlier spending against empty envelopes: the first thing Review asked was to cover overspent envelopes, and Ready to assign showed more than the accounts held. A new budget now starts on the day of its first connection. Spending earlier that month stays in your accounts, the register and reports, but isn't overspending, so Ready to assign is the money you have. The Up dialog says so, with **Count all of _month_ instead**, and **Settings → Budget** shows the start day and can count the whole month. Existing budgets are unchanged.

## 0.2.0-up.85

Fixes from a full audit of the app (correctness first).

- **Figures stay current after every change.** After you recategorised or edited a transaction, the Budget page could show the old Activity and Available for up to 30 seconds. Every change that saves (and every Undo and Redo) now refreshes the budget, Review, account balances, reports, forecasts, payday plans and goals at once.
- **"Left to spend" means spending money.** The dashboard's headline and its **Left to spend** card no longer count savings: envelopes whose type is **Savings**, and the category a goal saves in. The card says how much it leaves out ("Not counting $X in savings"). New budgets' **Savings** category is a Savings envelope, and so is the demo's Emergency Fund; the demo's trip goal saves in Holidays.
- **Deleting an Up transaction says what it does.** Up still has it, so the account stops matching Up's balance and assigning money pauses. The confirmation now says so, and when an assignment is refused for that reason, the Budget page lists the transactions you deleted with a **Restore** button for each. Restoring brings it back and assigning works again.
- **Ready to assign names the actual problem.** Instead of "Resolve overspending and uncategorised spending" whatever the cause, it says which of overspent envelopes, uncategorised spending, card payments without funding or more assigned than you have needs attention. Its smaller text is easier to read.
- **The backup says what's in it.** **Full Backup** no longer calls itself complete: it lists what it keeps, and that files (receipt photos, PDFs, documents and videos) stay in the installation, with **Files → Download all** to keep a copy elsewhere.
- **No password-free network access by mistake.** Outside server mode the server refuses to start when `FLYBUDGET_HOST` is anything but this machine (`127.0.0.1`, `::1`, `localhost`): without a login, anyone on the network could have read and changed the budget. Docker, Home Assistant and the desktop app are unaffected.

## 0.2.0-up.84

Spacing and alignment, checked against a 4px grid on a computer and a phone.

- **The Files search and date fields have their frames back.** A field given its own width or padding lost its whole style, so on a phone the search box ran into **Any kind** and the dates sat unframed. The work-use % box on Tax time had the same problem.
- **Buttons and fields are the same height.** A filled button is now as tall as an outlined one beside it, and both match a text field (40px; 44px on a phone), so **Cancel** and **Save** and a search box with its button line up.
- **Every page title is the same size**, and the headers of Files, Payees and Annual budget sit at the same edge as the rest of the page on a phone.
- **The sidebar's account list lines up** with the links above it, and its totals line up with the account balances.
- **The dashboard has one gap between everything**, and the summary figures line up with the Net worth card above them. The Budget card's heading matches the other cards'.
- In-between text sizes use whole-pixel line heights, so rows no longer land a fraction of a pixel off.
- On a phone transaction, a long account name shortens before the category does.

## 0.2.0-up.83

Changes from a UX review of the whole app ([docs/UX-REVIEW.md](docs/UX-REVIEW.md)), as a first-time user would meet it.

- **Pull to refresh is back on phones.** Drag the page down from the top and let go to fetch everything on screen again. The app's frame still stays still: only the content moves.
- **A one-step start with Up.** The welcome screen leads with **Connect Up — about 2 minutes** and three short steps. Other banks, adding accounts by hand and importing from YNAB are under **Use another bank or add accounts by hand**. The footer links are gone.
- **Connecting Up explains the token.** The dialog says, beside the box, that the token is read-only, can be revoked in Up, and is stored encrypted and never in backups. A **Paste** button fills it, and a token that doesn't start with `up:yeah:` gets a gentle hint.
- **Finding the setup code.** The first screen gives steps for where Allotment runs (Home Assistant's **Log** tab, `docker logs`, or the service log), shows what the line looks like, and accepts the whole pasted log line. A button that can't be pressed yet says what it's waiting for, and disabled buttons are grey instead of pale orange.
- **One place to start.** The dashboard's **Get started** checklist offers **Connect Up** and the two-minute tour (**Show me around**); the separate tour banner is gone. While the checklist shows, the cards below it don't repeat its buttons, and Net worth no longer draws a flat $0 line.
- **Links open the page you asked for.** Before there are accounts, only opening the app goes to the welcome screen: a link to Settings or another page on a second device opens that page.
- **Australian categories by default.** New budgets start with about 20 envelopes (Rent, Mortgage, Council Rates & Strata, Rego & CTP, Private Health Insurance and so on), unless the server's time zone is outside Australia or `FLYBUDGET_CATEGORY_TEMPLATE=default`. The budget asks **Do you rent or own your home?** and tucks away the envelopes that don't apply (hidden, never deleted). Up's categories map onto the new names.
- **Icons, not emoji.** Categories and goals use the app's own line icons, picked from a grid; older budgets' emoji show as the nearest icon.
- **Colour means one thing.** Red is for overspent or negative balances only: spending, a savings rate under its goal and a negative month are no longer red. Bills still to come are grey, not orange.
- **A calmer budget table.** Amounts are plain text until you point at or tab to them, Available is the column that stands out (with a pill only when it isn't $0), and sections with no money in them start folded. **Month**, **Year** and **Until payday** are one switch, and **Auto-assign** is the one filled button.
- **The dashboard says where you stand**: "You have $X left to spend this month. Next pay Fri 7 Nov.", with when Up last synced. **Bills and income** lists them apart, so pay isn't a bill.
- **Review starts with Do this next**, one list in order of urgency, and the sidebar's Review link shows how many things are on it.
- **Bulk changes need Select all.** On Transactions, Mark reviewed, Edit and Share appear after **Select all**, and Delete is in the **More** menu.
- **Every page says what it's for** on a first visit, once.
- **Allotment's own guide.** A short guide (getting started, connecting Up, budgeting and more) is built into the app at **Guide** in the ? menu, and every "Learn more" link opens it, offline too.
- **Plainer words, Australian spelling.** Household, the budget's first-month notice and Review lead with what they do; the mechanics are under **How this works**. Spelling is Australian throughout (customise, categorise, colour, cancelled), and the Checking account type is now **Everyday**.
- The sidebar's pin moved from the header to a labelled control at its foot.
- **The demo is an Australian Up budget**: a Spending account, two Savers and a shared 2Up account, fortnightly pay and rent, opening with money ready to assign and nothing overspent. Its bar is one line (one slim line on a phone) with the tour, and its links go to Allotment's README and releases on GitHub. The first change you make says it won't be kept.

## 0.2.0-up.82

Menu bars and buttons, reviewed on a computer, in a browser and on a phone.

- **Tab bars only scroll sideways.** On a phone, the Settings tabs (and the Transactions periods and a long-term plan's sections) could be dragged up and down by a pixel. Every tab bar now moves sideways only, and a swipe that reaches its end no longer moves the page.
- **The open tab is in view.** Settings opened on a later tab (from a link, or after reloading) scrolls its tab bar so that tab shows whole, instead of half hidden at the edge. A long-term plan's sections and the Reports dashboards do the same, and show they scroll with the same fade and arrow as Settings.
- **The app frame stays still.** On a phone, dragging the top bar no longer pulls the whole page down: only the content scrolls and bounces. Pull to refresh is off as a result; use **Sync Now** or reload.
- **A mouse wheel scrolls a tab bar** that is wider than the window, instead of doing nothing.
- **Keyboard.** Left and Right (and Home and End) move between tabs, and only the open tab is a Tab stop. The ⋮ menus, **Views** and the phone Budget menu open with focus on their first item, move with the arrow keys, and close on Escape, putting focus back on their button. A keyboard focus ring in a tab bar is no longer cut off.
- **The Views menu closes** when you click elsewhere or press Escape. It used to stay open.
- **Buttons feel like an app's.** Holding a button on a phone no longer selects its label, and tapping quickly no longer zooms the page. Disabled buttons don't show a pointer, and drag handles show a hand.
- **The bank provider switch** (Up, Plaid, SimpleFIN, Enable Banking) has equal-height, touch-sized buttons, and the selected one's outline isn't clipped.

## 0.2.0-up.81

- **The temporary assistant permission is gone.** An assistant can no longer record past household expenses or repayments (`record_household_entries`, added in 0.2.0-up.80 to bring in one Tricount history). You record these on the Household page, where **Paid ahead** stays.

## 0.2.0-up.80

- **Record a repayment paid ahead.** When you record a repayment between people on the Household page, tick **Paid ahead** to record it even if it is more than is owed now. The extra is then owed back the other way. Without the tick, Allotment still refuses a repayment larger than what is owed.
- **For now, an assistant can bring in past shared expenses.** With a _read, categorise and organise_ token, `record_household_entries` records past expenses split in exact amounts per person, and repayments between a household's people. It can link your own unlinked bank payment with the same date and amount, and it stops at the first entry Allotment refuses. It can't record anything paid by the household account, refunds or contributions, or change or remove an entry. This is temporary, to bring in one Tricount history, and goes in the next release.

## 0.2.0-up.79

- **Files: a library for your documents.** **Files** in the sidebar keeps bills, warranties, insurance policies and photos or videos of what you own with your budget. Link each file to as many transactions, categories, goals and accounts as it belongs to; removing a link keeps the file. Star files as reminders, mark the ones that matter as important, sort them with labels, and download them all at once as a ZIP with a list of what each one is.
- **More kinds of file.** Besides photos and PDFs: Word, Excel, PowerPoint and OpenDocument files, CSV, Markdown and text, GIFs, and videos (MP4, MOV) up to 250 MB. Allotment checks what each file really is and refuses anything else.
- **Search inside files.** Search finds the words in PDFs, Word, Excel, PowerPoint and text files, as well as names, descriptions and labels. With reading receipts turned on, your own model can read a photo's words too.
- **See files without leaving Allotment.** Photos, videos, text and PDFs show in the page. PDFs are drawn page by page, so nothing inside them can run.
- **Files everywhere they belong.** A transaction's details have **Other files**, a category's page has **Files**, and goals and accounts have **Files** too. In Transactions, a paperclip marks rows with receipts or files, and a new **Receipts and files** filter finds them.
- **Receipts are files too.** Every receipt appears in Files, linked to its transaction, and a photo or PDF in Files can become a receipt (**Use as a receipt**).
- **Better tax evidence.** At tax time, a file linked to a claimed transaction (an invoice, a policy) counts as its evidence, and goes in the year's download.
- **Share to Allotment from your phone.** Installed on an Android home screen, Allotment appears in the share sheet and adds what you share to Files.
- **Storage.** Files shows how much your files take, and you can set a limit. Backups made with this version are format 23: they carry what each file is and what it's linked to, not the files themselves (your server's own backup and **Download all** keep those).

## 0.2.0-up.78

Fixes from a review of 0.2.0-up.71.

- **A suggested repayment can always be recorded.** If you were owed money for something you paid, but still owed the household account, recording the suggested repayment was refused. A repayment now only has to fit what is owed for things people paid themselves.
- **Another household's money isn't your contribution.** A transfer into a household account from an account that belongs to another household is no longer offered as your contribution.

## 0.2.0-up.77

- **Share a transaction from its menu.** Right-click a transaction (or long-press it, or tap ⋯ on a phone) and choose **Share with**, then a household. It's shared at once with that household's usual split, and **Undo** in the message takes it back. **Custom split…** opens the Household page to choose who pays what. If you've picked several payments to share, right-click one of them to share them all.
- **Stop sharing just as easily.** On a shared payment the menu shows **View in _household_** and **Stop sharing**. **Undo** puts it back with exactly the same split.
- A payment that can't be shared, such as money in or a transfer, says why in the menu. The menu works from the keyboard too: Shift+F10 or the Menu key opens it, then use the arrow keys, Enter and Escape.

## 0.2.0-up.76

- **See which payments are shared with a household.** A payment shared with a household now shows that household's picture next to its payee, in the register and on phone cards. Open it and the details say **Shared with _household_**, with **View in household**, instead of offering to share it again.
- **Give a household a picture.** **Household → Sharing → Picture** takes a small image, the way account and payee logos do. Without one, the household's initial shows on a coloured square. The Household page shows it next to the household's name. It's kept in backups and isn't shown to someone you've combined a household with.

## 0.2.0-up.75

- **Tidier period tabs on Transactions.** A scrollbar no longer draws across This Month, Last Month and the rest. The tabs are never squeezed beside **Filters** with a label cut off: they keep their full width or take a row of their own, and on a phone the period you choose scrolls into view.
- Scrollbars elsewhere stay thin; a row that hides its own scrollbar now does.

## 0.2.0-up.74

- **An assistant can record your own household contribution.** If you paid your share some other way, such as rent through a shared saver that isn't one of the household's accounts, `record_own_household_contribution` (a _read, categorise and organise_ token) records it with no bank link. It's only for you, never for anyone else, and at most what you owe the household account, so it can bring you to zero but never into credit. Remove an entry on the Household page.

## 0.2.0-up.73

- **An assistant can reconcile a shared bill.** Any token's MCP tools now include `household_bill_reconciliation`: for one shared recurring bill, such as rent, it shows each person's share of its payments, the deposit into the household account that paid each one, and what's left. `household_contribution_suggestions` lists the deposits the Household page would suggest.
- **An assistant can record household contributions.** With a _read, categorise and organise_ token, `record_household_contributions` records deposits into a household account as the person's contribution, each linked to its deposit, for exactly its amount and date. It can't record expenses, settlements or unlinked amounts, or change or remove an entry. Remove an entry on the Household page.
- **An assistant can find missed tax claims.** `tax_claim_candidates` lists past payments in a financial year with no claim, from a payee (or category) you've already claimed this year or last, with that claim's label and work-use share. `tax_years` and `tax_claim` read the years and one claim. Claiming is still `claim_tax_deductions`, and still never replaces or removes a claim.

## 0.2.0-up.72

- **Redo an assistant's undone changes.** **Settings → Server → Read-only access → Changes made with tokens** now offers **Redo** on a change you undid. It sets the assistant's categories again, except on transactions you've changed since or reconciled.
- **An assistant can claim tax deductions.** An AI assistant with a _read, categorise and organise_ token can read a financial year's claims and claim past payments as deductions, with a return label, a work-use share and a note (MCP tools `tax_deductions` and `claim_tax_deductions`). It can't change or remove a claim, download the tax CSV or receipt archive, or see receipts. Read-only and categorise tokens still see no claims.

## 0.2.0-up.71

Household bills shared the way a joint account works.

- **Fixed amounts for a recurring bill.** **Household → Recurring bills → Change split → Fixed amounts** gives each person a set dollar amount, such as everyone's part of the rent. A payment those amounts don't add up to isn't shared (it says what they add up to and what the payment was), and the bill warns when its next payment is expected to be different. The household's default split stays equal, percentages or weights.
- **Owed to the household account, not to you.** With a household account, **People & balances** shows each person's balance in two parts: what they owe the household account (their shares of what it paid, less what they put in) and what they owe, or are owed, for things someone paid themselves. Only the second is owed to a person.
- **The household account can pay first.** A payment from the household account can be shared before everyone has put their part in. Whatever is missing shows as owed to the account until their contribution arrives. Money reserved for other bills still can't be spent.
- **Contributions suggested.** **Household → Sharing** now also offers money into the household account from someone in the household, or your own transfer into it, as their contribution: **Record contribution**. Repayment suggestions count only what people owe you for things you paid.
- A server test and a browser test no longer fail on days when the sample bank history happens to have three Coles trips.

## 0.2.0-up.70

Fixes from a full code and UX review.

- **Safe mode hides chart amounts too.** A category's history chart showed its monthly figures above the bars (an income category showed your pay), and the dashboard's Spending chart and the Budget page's small history chart showed amounts on their axes, all with Safe mode on. They now hide like every other amount, and use your budget's currency instead of always "$". An income category's chart is now called **Income History**.
- **A deleted Up transaction stays deleted.** Before, the next sync imported it again, uncategorised. Now syncs leave it out, and **Settings → Connected Banks → Up → Deleted here, still at Up** lists it with **Restore**. The delete confirmations say so. Deleted Up transactions are part of backups (format 22).
- **Up syncs say when Allotment is at fault.** A fault in Allotment used to show as "Could not reach Up"; it now says it was Allotment, and the app's log has the details. A bank-fed transaction can no longer be moved to another account, which could stop its account syncing.
- **Security updates** for the server's network and request libraries (`undici`, `body-parser` and three others with published advisories).
- **The Budget page on a phone** shows Ready to assign first; how it's worked out and the Income and Expenses summary fold under **How this is worked out**, and Card payments and Move money follow, so the envelopes come sooner. A budget with no money yet says **Nothing to assign yet** instead of "Fully budgeted".
- **Plainer words** in the Ready to assign breakdown ("In your accounts, less card debt", "Left to assign", "Overspent envelopes") and for cards not set up for card payments yet. Australian spelling throughout: **Uncategorised**, **Categorise automatically**.
- **Keyboard and screen readers:** **Skip to content** is the first stop on every page on a computer, and the Budget page's activity amounts say which category they belong to.
- **Bigger tap targets on phones** for Settings tabs, report date ranges and the register's Edit, Delete and Export.
- **The welcome tour on a phone** now points at your envelopes, not income, when it explains categories.
- **Faster lookups** of split parts, transfers and payees on large budgets (new database indexes).
- **Settings → Data** says that backups leave out receipt photos.

## 0.2.0-up.69

- **A guide for every page.** Accounts, Transactions, Rules, Recurring, Review, Pay later, Household, Goals, Forecast, Investments, Tax time, Reports and Settings now each have a short guide, like the Budget page's: offered the first time you open the page (once the welcome tour is taken or turned down) and always under **? → Guide for this page**. Settings' guide shows where to connect Up.
- **A tip on Payees:** give a payee a default category and its new transactions are sorted for you.
- The guides list (**?** on the keyboard, or **? → All guides and tips**) shows them all, ticked once seen.

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
