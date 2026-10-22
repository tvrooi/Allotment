# Monarch account tools, rules preview and settings

22 October 2026. Live REA observations, including a rule draft restricted to the authorized synthetic merchant. No rule was saved, no transaction was recategorized, no balance-history edit was saved and no account transfer was started. This extends the [synthetic debt/recurring tests](monarch-debt-recurring-tested.md).

## Account balance and action menu

Evidence: `ev_6565667349e0257baa8bbda6dfabfdf466902273a33715774e0126329036c4eb`.

**Observed:** the synthetic loan now has balance **1,025**, verifying the result after its 25 debit with balance adjustment enabled. This resolves the earlier balance-verification question for this account and sample; it does not establish all liability sign conventions.

The account menu contains Edit account, Download transactions, Import transactions, Transfer data (New), Copy balance history, Download balance history, Import balance history and Edit balance history. Presence does not establish exported file contents or import validation.

### Balance-history editor

Initial evidence: `ev_669a70ca933171e0c9ffc419686a7d8cd9ef403b3177bd16257a0eb89083a63c`. Loaded editor: `ev_77d39911c6e155ab9b782f027306955cbfd866ceb5eadf1a2dd5174fe66ca111`.

**Observed:** the editor exposes per-date amounts and Save changes. It warns that saving overwrites 90 days, recommends downloading a backup, and describes editing/re-uploading CSV for older history. No edit was saved.

**Intent, inferred:** direct recent-history correction and older CSV correction offer different scopes. The overwrite warning makes history replacement explicit rather than presenting it as a harmless display preference.

### Transfer-data workflow

Introduction: `ev_deb4d2106c3fbb83f12dad688e30305c9aa5956d835a3947620402e931863542`. Setup: `ev_276eae2c9f337e42d3663838c44b7d8da1564b986055da0d700e99e74ed8c937`.

**Observed:** the introduction frames this as duplicate-account consolidation: choose a transition date; overlapping destination data is deleted; inspect the new account afterward, then delete the old account. Setup offers old/new account comboboxes, recommends CSV backups before transfer, shows Exit and Next up: Transactions. Next is disabled until a new account is selected. No account was chosen and no migration was performed.

The observed overlap-deletion description is a material mutation boundary. Transition-date inclusivity, exactly which records are replaced, rollback, reconciliation preservation and confirmation stages remain unknown.

## Settings navigation inventory

Evidence: `ev_1d192b839e765f2ff66e1f1cc771e547d9c15dfd095a2577bc5a952ab35d34b2`.

**Observed navigation only:** Account settings lists Profile, Display, Notifications, Security, Early access and MCP connector. Household settings lists General, Businesses, Members, Preferences, Institutions, Categories, Merchants, Rules, Tags, Data, Billing, Gift, Estate and Referrals. Except for the specific controls below, these pages were not inspected and their behavior is not reconstructed.

## Display, notifications and preferences

Evidence: `ev_538be7f705ed7831fc0d2c27f0e7788d980a65db09d53010e9248bde107e4ea7`.

**Observed:** Display has an appearance combobox showing Light. Notifications offers in-app/email/push channels for events including disconnected accounts, deposits/expenses with threshold amounts, review and receipts. Turn all off is available per channel. No settings were changed.

Preferences exposes All new transactions need review versus Uncategorized transactions. A pending-edits toggle also includes pending transactions in budget, Cash Flow and reports; its explanation says pending records are otherwise excluded. A warning explains that pending-to-posted matching may fail and manual edits may be lost. These are displayed descriptions, not a tested posting/matching sequence.

Other visible controls include global AI enablement, irreversible per-member Delete chat history and aggregated-statistics sharing. No toggle or deletion was submitted.

**Intent, inferred:** preferences change downstream inclusion and review policy, not merely appearance. Coupling pending editing with analytical inclusion should be explicit wherever pending amounts appear. Notification thresholds let users control interruption volume by event and channel.

## Rules: ordering, draft and preview

Builder evidence: `ev_5ef4aa5d667fb8f02b78b873ba78bf4bddeaa16ac53d4d18b0dbd25cc5b76728`. Detailed controls: `ev_ed31a8db40f79fb3aa350b4e6bb6b09e5443214edc32cb7479c7115930e2d1da`.

**Observed:** the rules page says rules run top to bottom and provides drag ordering, search, options and Create. Available action families include renaming, recategorizing and splitting.

Create opens a modal with Settings and Preview tabs. Conditions include Original statement, Merchant name, Amount, Categories and Accounts. Actions include Rename, Category, Tags, Hide, Review status, linking Save up/Pay down goals and Split. Update existing transactions defaults off; Save initially is disabled.

Inspected condition controls include Merchant Contains text with Add merchant name for multiple entries; Amount with Debit, Greater than and an amount field; and a category selector. Boolean combination, case sensitivity, rule chaining and split behavior were not tested.

### Controlled synthetic preview: matching is distinct from applying

Update-existing-off evidence: `ev_8f4d54c77b194c28ab95b05b558c0ef759f4e0058b78d588dbbf8a9579224bbf`. Draft-on evidence: `ev_038c88c44b563b4a31de648ae5b0bd0e376ed59f7bb99c49b3237654ff278906`.

The draft was restricted **only to REA INSPECTION recurring utility**, with target category Groceries. It found one matching existing transaction. With Update existing off, Preview changes showed zero and explained that the rule would not apply to existing transactions.

Checking Update existing **inside the unsaved draft** changed Preview changes to one. The preview showed date, merchant, before category Gas & Electric, after category Groceries and amount 25. **Save was never used: no rule was created and the transaction category was not changed.**

This test distinguishes three states: a record matches conditions; the draft's application scope includes or excludes existing records; and preview predicts the specific changes. It does not establish what a committed rule would do on later imports or how concurrent edits are handled.

**Intent, inferred:** before/after previews and explicit historical scope make automation reviewable before it changes existing data. A matching count alone would obscure the difference between eligible records and actual planned mutations.

## FlyBudget recommendations and remaining boundaries

These are independent design recommendations:

- Extend existing rules with a dry-run contract that returns eligible count, changed count and per-field before/after values. Keep historical application opt-in and ensure preview itself cannot write.
- Bind a committed bulk/rule operation to the reviewed scope and detect changed records before applying it. The concurrency design is a proposal, not observed Monarch behavior.
- Explain the downstream accounting/reporting effect of each inclusion switch. Preserve pending and settled state distinctions and bank import identity.
- Show history-overwrite ranges, backup actions and concrete destination effects before any account consolidation. Do not treat a menu visit as authorization to migrate records.
- Keep notification channel controls and event thresholds separate; never silently change data inclusion when adjusting notification preferences.

Uninspected areas include export/import contents and validation; committed rule behavior; rule precedence conflicts; balance-history interpolation; transfer confirmations/recovery; most settings destinations; AI execution and chat deletion; and pending-to-posted matching boundaries. The only new verified account amount is the synthetic loan's 1,025 balance at this checkpoint.
