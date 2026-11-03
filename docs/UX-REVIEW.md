# Allotment UX teardown — 3 November 2026

> **Status:** implemented in 0.2.0-up.83, except #7 (the owner chose to keep the sidebar as it
> is). As the owner asked: #1 sends the demo's links to GitHub (the `website/` is left as it is),
> #18 replaces emoji with the app's line icons, #21 splits bills and income, #22 is a first-visit
> intro, #24 removes the welcome footer links, and #25 is Allotment's own guide in the app.

Reviewed on `0.2.0-up.81` (main). Everything below comes from running it, not from reading source:

- the marketing site in `website/` and its in-browser demo at `/demo/`
- a fresh self-hosted server (server mode, empty database): setup code → password → Welcome → empty app
- desktop at 1440×900 and phone at 390×844

**One correction to the brief.** Allotment has no free trial to convert to. The conversion events that
matter here are:

1. **Visitor → demo** (they click "Try the Demo")
2. **Demo → install** (they click "Download")
3. **Install → activated** (Up is connected and the first dollar is assigned)

Every finding below is ranked by how much it costs one of those three steps.

Each item has a tag. **[Design]** is pass 1: the designer ripping apart visual decisions. **[User]** is
pass 2: a first-time user clicking through and saying where they got lost or wanted to leave.

---

## 🔴 Critical — people are leaving here

### 1. [Design][User] The website sells a different product

The landing page, nav, hero, download page and file names all say **FlyBudget**. The look is the old
one too: a blue winged dollar on navy. The "Download Allotment" button in the demo goes to that page,
where it reads "Download FlyBudget" and offers `FlyBudget-Linux-amd64.deb`.

From the user's side: _"I clicked Download Allotment and landed on a different app. Is this a scam
fork?"_ That is the moment you lose a privacy-minded finance user for good.

The site also never mentions Up, Australia or Home Assistant. Those three things are the only reason
this fork exists.

**Fix:** Pick one of two:

- Rebrand `website/` to Allotment (Soil, Canvas, Marigold, the plots mark, "Every dollar gets its
  plot", Up in the hero).
- Stop pointing the demo at it: send "Download" to GitHub Releases or `docs/START-HERE.md`, and
  "Back to home" to the README.

Shipping a half-branded funnel is worse than shipping no website at all.

### 2. [User] The demo's sample budget is broken on the first screen you see

Budget opens on **Ready to assign −$925.83** in a yellow alarm box that says "Resolve overspending and
uncategorised spending". Review says $3,339.49 of spending is uncategorised. Most of that is one row:
"ONLINE PAYMENT – CREDIT CARD −$3,251.80". That is a credit card repayment the demo itself failed to
mark as a transfer. The first card in the right rail is a warning that "Summit Rewards Card isn't set
up for card payments yet".

The demo exists to show the budget at its best. Instead it shows a budget in debt with three
setup warnings, and the user thinks: _"If the sample data is a mess, mine will be worse."_

**Fix:** Make the seed data clean. Link the card payment as a transfer, set the card up for card
payments, categorise Parcel and Hearth & Home, and land Ready to assign on a small positive number. Then
leave **one** deliberately uncategorised row so the tour has something to teach.

### 3. [User] The demo hides the one feature that sets Allotment apart

The demo uses US data: "Harbor Checking", "Riley's paycheck", "Maple Court Apartments", a EUR account,
"Renters Insurance". There is no Up account, no Savers, no 2Up, no "Synced from Up" state, no
fortnightly payday plan.

The README pitches "Australians with an Up account". An Up customer opening the demo sees a US
checking-account app.

**Fix:** Reseed the demo as an Australian Up user:

- a Spending account, two Savers and a 2Up account, with a "Last synced 4 min ago" badge
- AUD, fortnightly pay, rent paid fortnightly
- payees like Woolies and Opal

Make "Connect Up" visible but disabled ("Works in the real app").

### 4. [User] First run starts with "go read your server log"

The very first screen asks for a 16-character **setup code** that is "Printed in the server log.
Docker: run docker logs flybudget". So:

- Home Assistant users (the main audience) get Docker instructions.
- The hint uses the old name.
- The submit button stays a pale, disabled-looking orange with no word on what is missing.

This is the steepest drop-off point in the funnel. The user's job is just "open the app", and they
hit a wall before seeing a single pixel of value.

**Fix:**

- Detect the host. On Home Assistant, say "Open the app's **Log** tab in Home Assistant" and link to it.
- Show a 3-step visual with a screenshot of where the code appears.
- Let people paste the whole log line and pull the code out of it.
- Make the button explain itself: "Enter the setup code to continue".

Keep the security model; fix the wayfinding.

### 5. [Design][User] The Welcome screen gives Up the same weight as four banks you don't need

After setting a password you get five identical cards: Up, Plaid, SimpleFIN ($1.50/month), "a European
bank" and Manual, plus a YNAB link and four footer links. For an app whose positioning is "direct
connection to Up", that is a tax on decisions. Two of the options ask Australians to sign up for US or
EU developer programs.

The Up "logo" is just the word _Up_ in orange on a white tile, while Plaid and SimpleFIN get real
marks. The cards are huge buttons with a small "Connect Up ›" link, so it isn't clear where to click.

**Fix:**

- Make one hero card: **"Connect Up — about 2 minutes"**, a big filled button, and a 3-step strip
  (open Up's developer portal → copy the token → paste it).
- Put "Use another bank or add accounts by hand" under a single disclosure.
- Put the YNAB import in that disclosure too.

### 6. [User] "Connect Up" asks for a credential without explaining it

The modal says "Create a token at Up's developer portal, then paste it below." A normal Up customer
has never heard of a "personal access token". They will:

- leave the app
- land on a developer site
- see `up:yeah:…` and wonder whether this hands someone access to their money

Many leave at this step.

**Fix:** Put the reassurance right next to the field:

- "**Read-only.** Allotment can't move money. Up lets you revoke this any time."
- Show what a token looks like (`up:yeah:…`) and validate the prefix as they paste.
- Use a "Paste" button rather than an empty field.
- Link to an illustrated how-to, not only to the portal.

The token being encrypted and left out of exports is a selling point. Say it in bigger text than
caption size.

---

## 🟠 High impact

### 7. [Design] 18 sidebar items. This is feature soup, not a product.

The items are:

- Dashboard, Accounts, Transactions, Budget, Review, Recurring, Pay later, Household
- Reports, Cash Flow, Goals, Forecast, Investments, Tax time, Files
- Payees, Rules, Settings

All of them get equal weight and the same icon style. On an empty install, 14 of them lead to empty
pages. Linear shows you about 5 things. This shows you an accounting package's org chart.

**Fix:** Sort the sidebar into three groups:

- **Primary:** Budget, Transactions, Accounts, Review.
- **Plan:** Recurring, Goals, Forecast, Pay later.
- **Insights:** Reports, Cash Flow, Investments, Tax.

Put Household, Files, Payees and Rules under "More" or Settings. Hide modules the user hasn't turned
on until they have data, or behind "Add a feature".

### 8. [User] Four onboarding systems competing on one screen

After "Skip for now", the empty dashboard shows all of these at once:

- a **tour banner** ("New to Allotment? A two-minute tour…")
- a **Get started checklist** (0 of 5)
- a **Net Worth $0** card with a flat line and its own "Add an account" button

Review has a fourth system, **Guided setup**. Budget has a fifth: a paragraph-long tip banner. Every
one has a different call to action.

_"Which one am I supposed to do?"_

**Fix:** Keep one system, the checklist. Fold the tour into step 1 ("Show me around") and suppress
other empty-state CTAs while the checklist is visible. Also hide charts that have no data instead of
drawing a flat $0 line across 30 days.

### 9. [User] The default categories are American

The checklist talks about "A checking account". The fresh budget is seeded with **HOA Fees, Property
Tax, Gas (Natural)**: 68 categories in all. An Australian renter has to delete a dozen irrelevant rows
before budgeting. It reads as "this wasn't built for me".

**Fix:**

- Ship an AU template: Rent, Strata, Council rates, Rego, CTP/Green slip, Private health, Opal/Myki,
  Electricity, Phone, Internet, Groceries, Takeaway.
- Make it the default when the first linked source is Up.
- Ask "Rent or own?" to prune it.
- Start with about 20 categories, not 68.

### 10. [Design] Red and green mean three things

On the dashboard:

- Avg Monthly Expenses **$4,513.55 is red**, as if spending money were an error.
- Savings rate **16% is red** against a 20% goal, which shames the user on screen one.
- Left to Spend is green while Net this month is red. These figures contradict each other at a glance,
  and nothing explains why.

On Transactions, outflows are black and positive (`$49`) while the summary shows `Out $2,847.49` in
red. On Budget, the brand orange is used for every progress bar, so every fully-funded bill looks like
a warning.

**Fix:** Use colour by semantic role only:

- **Red** for overspent or negative balances.
- **Green** for income and available money.
- **Neutral** for expenses.
- **Marigold** for exactly one CTA per screen. Brand doc: "The one bright spot".

Use one sign convention for amounts everywhere.

### 11. [Design] The budget table is a wall of input boxes

Every row has an outlined `$0` input and a grey `$0` pill. On an empty budget that is 68 × 2 identical
boxes. Your eye has no idea where to go.

**Fix:**

- Render amounts as plain text that turns into an input on hover or focus.
- Show the pill only when the amount isn't zero.
- Make Available the visually dominant column.
- Collapse groups that have no assignments.

### 12. [Design] Header controls you have to decode

Next to the logo sit three unlabelled icons: `?`, an eye, and a **pin**. Budget's toolbar shows
"Year", "Auto-assign" and "Until next payday" as identical ghost pills next to arrows and "Today". "Year"
looks like a label, not a button.

**Fix:**

- Move the eye ("Hide balances") and the pin into the account menu or behind tooltips.
- On Budget, use a segmented control for **Month | Year | Until payday**.
- Make Auto-assign the one filled button.

### 13. [Design] Two banners stack above the content and eat the first screen

In the demo, the demo bar plus the tour bar take about 95px on desktop. On phone they take
**about 230px**, more than a quarter of the screen, before "Your money, at a glance" even starts. The
phone demo bar is three icon buttons, two of them unlabelled (home, restart).

**Fix:**

- Put "Start the tour" inside the demo bar and drop the second banner.
- On phone, shrink the demo bar to a 36px strip: "Demo · nothing saved · Download".

### 14. [User] Copy that explains the internals instead of the benefit

Examples:

- "Read-only; changes happen only when you act."
- "Linking a pool removes its cash and activity from personal budget availability. Categorize your
  confirmed transfers into it as contributions."
- "Agreed shares, pool advances and repayments, tracked privately. Bank payments keep their full
  amounts; claims are not spendable cash."
- "Moving money to a saver changes where it sits. Assign it to a category to reserve it for rent or
  another purpose."

All of it is accurate, and none of it is skimmable. On the Household page, a first-time user gives up
before typing a name.

**Fix:** Lead with one outcome sentence, for example "Split bills with your housemate and see who
owes who". Put the mechanics behind "How this works". Follow BRAND.md's rule: "clear words, warm
encouragement, one next step".

### 15. [User] Destructive bulk actions are always visible

The Transactions summary row shows **"Delete 6"** whenever a filter is active, right beside "Edit 6"
and "Export", at the same weight. One misclick deletes the whole month of results.

**Fix:** Show bulk actions only after an explicit selection. Put Delete in an overflow menu and confirm
with the count.

### 16. [User] Opening a link on a new device dumps you back on Welcome

"Skip for now" is stored per browser (`setupSkipped`). Until an account exists, opening any link (for
example `/settings`) on a phone or a second browser redirects to the Welcome page. _"I already set
this up. Why is it asking again?"_

**Fix:** Store the skip on the server, or redirect only from `/`, never from deep links.

---

## 🟢 Nice to have

17. **[Design] Hero copy.** The dashboard's "Your money, at a glance / A little clarity for your everyday
    plans" takes 90px to say nothing. Replace it with a one-line status: "You have **$2,947** left to
    spend until payday on Fri 7 Nov."
18. **[Design] Mixed icon languages.** Lucide line icons in the nav, colour emoji on categories (🏠 ⚡ 🚗),
    filled circle avatars on payees, and a third style for account glyphs. Choose one: monochrome
    category icons with optional emoji the user opts into.
19. **[Design] Mixed spelling.** "Uncategorised", "Categorise" and "Prioritise" sit next to "Customize",
    "Categorize your confirmed transfers" and "Checking". Pick en-AU, since that is the audience.
20. **[Design] Empty Net Worth chart.** A flat line at $0 with 16 date labels is noise. Show an
    illustration and one CTA instead.
21. **[User] "Upcoming Bills" includes the paycheck.** Rename it "Coming up", or split it into Bills and
    Income.
22. **[User] Unexplained jargon in the nav.** "Pay later", "Review", "Tax time" and "Files" aren't
    self-explanatory for new users. Add a one-line description on hover, or a first-visit intro on each
    page.
23. **[Design] Disabled states look like brand colour.** The pale orange disabled button ("Create
    password", "Connect") reads as a styling choice, not as disabled. Use a neutral grey and helper text
    that says what is missing.
24. **[Design] Welcome page footer clutter.** "Compare bank options", "Read the guide", "Source on
    GitHub" and "Report a problem" compete with the main CTA. Keep "Need help?" and nothing else.
25. **[User] The guide links go to the upstream FlyBudget site** (noted in BRAND.md). Every "Read the
    getting started guide" click leaves Allotment's brand again. Host a short Allotment version of the
    guide, or at least add a note on the link.
26. **[Design] Review page layout.** Two columns of equal weight with orange "Reconcile (46)" links
    everywhere. Show one prioritised list ("Do this next") with a count badge in the nav instead.
27. **[User] Demo resets when the tab closes.** Fine, but it should say so at the moment of a first
    edit ("Nice — this won't be saved. Download to keep a real budget") rather than only in the
    banner. That is the conversion moment.

---

## If you only do five things

1. Fix the funnel's brand: the website and the demo's Download and Home links (#1).
2. Reseed the demo as a clean, Australian Up budget with a positive Ready to assign (#2, #3).
3. Rebuild setup-code and Up-token entry around Home Assistant and reassurance (#4, #6).
4. Make the Welcome screen one big "Connect Up" button (#5).
5. Collapse onboarding to one checklist and the nav to about 6 primary items (#7, #8).
