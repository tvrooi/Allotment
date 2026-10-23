# Monarch live audit: register, budget and recurring

22 October 2026, continuation after the first Mac unlock. These are **live observations**, with REA evidence; stated purpose is an interpretation. They extend [the initial notebook](monarch-observed-workflows.md). No form changes were saved.

## Transactions: overview and information hierarchy

Evidence `ev_7d6f7ca74c9cb590fa84e74a17ca7d8a475f05c17a5970ef527cd7f3ecea7389`.

The register has All, Receipts (New) and Retail Sync tabs. Top actions are Search, Date, Filters, Add and Toggle summary. Within All, there is an All transactions selector, Edit multiple, Sort and Columns. Rows group by date and show merchant, category, source account, notes indicator, signed amount and detail chevron. Merchant/category cells are editable comboboxes with separate links to their detail pages; source accounts are links. This distinguishes editing a record from opening analysis of its merchant/category/account.

The optional right summary contains count, largest transaction, largest expense, average transaction, total income/spending and first/last dates, plus Download CSV and contextual Ask AI Assistant. Largest transaction/expense amounts are buttons. Their resulting navigation was not exercised. The summary keeps aggregate context beside the register instead of requiring a separate report.

### Detail drawer

Evidence `ev_32f90f4cda629181c0146c73ad02600ae2a37d4195762abf0e6bc5787ed4035f`.

Opening the detail chevron changes the URL to a transaction-specific path and opens a right-side dialog while retaining the register. Controls include previous/next transaction, Mark as reviewed, Hide transaction, Close, signed amount, account link, merchant selector and merchant transaction-count link, debit/type selector, calendar/date, category selector and Split, Spend from save up goal, notes, tags, Needs review by, attachments, expandable Activity and Delete transaction. No explicit Save was visible in the drawer; persistence timing for individual edits remains untested.

Activity expansion was exercised: it showed an Added to Monarch event with timestamp and actor. Purpose: distinguish original source/import history from later cleanup. Review and hide are separate actions; review assignment identifies who should resolve a record, while hiding changes analytical inclusion. No review/hide/delete or attachment action was submitted.

### Split modal

Evidence `ev_21fae2e960bd0422c9492c61cfe964ae3303509bc715dc5a6a9652f6fb4c6b39`.

Split opens a centered modal over the drawer. It states that splitting creates individual transactions that can be categorized and managed separately. The original merchant/category/amount remain visible above the editable splits.

| Control                   | Observed state                                             | Purpose                                                           |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| By Amount / By Percent    | Mode buttons                                               | Allocate with the most convenient unit                            |
| Split rows                | Two initial rows; merchant/category and zero amount inputs | Model independent child transactions                              |
| Expand/collapse split     | One expanded initially                                     | Keep basic allocation compact while exposing metadata when needed |
| Per-split metadata        | Tags, goal link, review status, notes, Hide switch         | Allow different treatment for parts of one original purchase      |
| Add/remove split          | Add a split and remove controls                            | Change allocation count                                           |
| Left to split             | Remaining amount appears as a button                       | Make the sum constraint visible; fill behavior not exercised      |
| Remove all splits         | Visible action                                             | Reset/recombine path; consequences untested                       |
| Cancel / Close            | Dismiss draft                                              | Cancel was used; the original unsplit drawer returned             |
| Split into 2 transactions | Disabled while amounts are zero                            | Prevent an unallocated split from being committed                 |

Exact percent rounding, mixed-sign handling, minimum row count, posting restrictions and recovery of committed splits remain unknown. Do not infer them from the disabled state.

### Filters

Evidence `ev_00f8fd310251afc166915a3f7c235f69232688076aa3c8c33f29629df7f991f3`.

Filters opens a popover with Categories, Merchants, Accounts, Tags, Goals, Amount and Other sections; search; selected-filter count; Clear all, Cancel and Apply. Categories supports group and individual checkboxes plus Select all. The interaction suggests draft selection followed by Apply; no selection was applied.

Other exposes Needs Review by (Anyone/member), Recurring / Not recurring, Has / No attachments, Split / Not split, Has / No notes, Synced / Not synced from institution, In / Not in an investment account, Pending / Not pending, Hidden only / Hidden and not hidden. These states are independent dimensions, useful for targeted review queues. Amount operators and multi-section combination logic were not inspected.

### Bulk editing

Evidence `ev_8860c43efdb2c95060e75566b8e75f890880fe846a6d2fed5a4a227adf936c88`.

Edit multiple adds Select all transactions (Cmd+A), per-row checkboxes, selected count, Escape hint, Cancel and Edit N. Selecting one synthetic row enabled Edit 1; opening it produced a bulk dialog. Merchant, Category, save-up goal, pay-down goal, Date, Recurring, Notes, Tags, Hide transactions and Review status default to **No change**. Save is disabled until a change is made. Delete N is a separate action. Cancel was used without modifying any field.

Purpose: make the mutation set explicit and avoid accidental blanking. A selected field should represent unchanged/set/clear distinctly in FlyBudget's bulk API. Multi-account constraints and the later review/apply stage are not established by this read-only preview.

## Budget

Main evidence `ev_ccf178f5a7ba27eea44e851727bf8d0ac04c220b0f7df9d830998fc9204bfa3e`; settings `ev_db813284e932c8f689d5f59175b3bb6e04fc0df6793719a94132fe6c0dd9a3f6`; category `ev_9078fb4b5cf450ee42e35c0a4162e39608398ce2a80766cc092950b37ac06c68`; year `ev_ca7644ed1479740ce06c71798b63196c7af574fee31a788576c29680c7d954ce`.

### Monthly layout and actions

Header has Previous/Next/Today, Month/Year/Decade and Settings. The live account uses Flex Budget. Sections are Income; Expenses divided into Fixed, Flexible and Non-Monthly; Contributions divided into Save up and Pay down; and Left to Budget. Columns are Planned, Actual and Remaining, with Progress selectors. Groups collapse. Unbudgeted categories can be revealed via Show N unbudgeted. Category names and actual amounts link to category detail pages; category option buttons open Edit Category. The Flexible bucket and visible category rows have amount inputs. Goal rows show pace status and a dedicated Open savings goal budget details action; liability setup explains why no pay-down rows appear.

Summary/Income/Expenses buttons control the supporting summary area; exact visual transitions were not exercised. Left to budget is a popover action. The observed value reflects planned income minus planned expenses/contributions, rather than actual income minus spending. This inference is consistent with the visible zero planned income and nonzero planned contribution; a full formula boundary test is still needed.

### Settings modal and why it exists

Settings is route-backed (`/plan/settings` plus date) and opens a modal containing:

- System: Flex Budget (recommended) or Category Budget.
- Default edit scope: This month only, or All future months. Each description says the scope can be overridden on each budget edit.
- Recalculate default budgets: historical averages generate defaults, **overriding existing amounts**.
- Clear all budget values: described as clearing values back to the starting month.
- Budget walkthrough: Start setup.
- Cancel, Close and Save; Save was disabled without changes.

Purpose: separate budgeting philosophy and global edit defaults from everyday amount entry. Destructive/reset actions were inspected by their descriptions only; their confirmation modals were not opened or submitted.

### Category modal

Edit Category contains icon/name, group, Fixed/Flexible/Non-Monthly descriptions, rollover switch, budget-exclusion switch, Disable and Save. The system-category explanation says it automatically categorizes related transactions. Rollover is described as carrying remaining balances or setting due dates for future expenses. Exclusion says both category and linked transactions will be hidden from the budget. Flexible classification describes reducible variable spending; Fixed describes stable obligations; Non-Monthly describes yearly or less frequent spending. Close was used unchanged.

This modal changes category definition, not just the selected month's number. FlyBudget should make that scope clear. Exact rollover starting-balance/date fields, classification effects on past periods and disable behavior remain untested.

### Year view

Year switches the route's timeframe and replaces per-month Planned/Actual/Remaining columns with Jan–Dec columns, retaining section/group/category hierarchy and goal details actions. A Total Left row summarizes across months. Purpose: plan uneven annual expenses and inspect future allocation in context. Decade is visibly available but its resulting view has not yet been captured.

## Recurring

Evidence `ev_2b73c94bfbedd373fbf6eeca15a60514aeb0371babf23f5d36e2ffb02a75e079`.

Recurring has Monthly and All recurring routes, Filters and Manage recurring. Monthly has month navigation, Today and List/Calendar view controls. Income, Expenses and Credit cards sections have Add recurring income, Add recurring expenses and Set up bill sync. This account's selected month is empty and explains that no recurring items were found. No bill-sync consent or connection was started. The Mac locked again when opening Manage recurring; resulting setup/editor screens remain uncaptured.

Purpose: separate upcoming occurrences (Monthly) from recurring definitions (All recurring), and merchant schedules from credit-liability data. Empty-state actions give a direct route to establishing the missing definitions. Detection, paid matching, calendar interactions and populated item menus still require live evidence.

## FlyBudget translation

1. Retain filter context in URL-backed register/detail navigation. Distinguish an editable cell from a linked analytic detail page.
2. Use unchanged/set/clear bulk semantics and make selection count, affected accounts and scope visible before committing.
3. Give split drafts explicit validation and remainder feedback. Preserve the parent import identity and existing reconciliation invariants even if the interface presents independent rows.
4. Show calculation components beside forecast curves and planned/actual/remaining beside budget rows.
5. Label shared category/profile edits differently from month-local amounts. Reset actions need a concrete description of what will be overwritten.
6. Keep schedules separate from occurrences and actual settled transactions, and recurring status separate from review/hidden/pending states.

These are independent design recommendations, not recovered Monarch source code.
