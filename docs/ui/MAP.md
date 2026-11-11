# UI map

One row per route in `client/src/App.tsx`. Line counts are from `wc -l` on 11 November 2026;
recount with `wc -l client/src/pages/*.tsx` rather than trusting them. Page files are under
`client/src/pages/`, component folders under `client/src/components/`, hooks under
`client/src/hooks/` (only hooks the page imports directly are listed), specs under `e2e/tests/`.
**split candidate** marks a file over 800 lines.

Dashboard, Budget and Transactions are in the main bundle; every other page is `lazy()`.

## Routes

| route                                    | page file (lines)                        | component folder                                     | key hooks                                                            | e2e spec                                                                     |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/welcome`                               | Welcome.tsx (261)                        | accounts, banks, up, plaid, simplefin, enablebanking | useAccounts, usePlaid, useServer                                     | first-run, first-import, switchers                                           |
| `/`                                      | redirects to `/dashboard`                |                                                      |                                                                      |                                                                              |
| `/dashboard`                             | Dashboard.tsx (229)                      | dashboard, review, layout                            | useNextSteps, useIsPhone                                             | dashboard, home-cards, phone/dashboard-viewport                              |
| `/budget`                                | Budget.tsx (1457) **split candidate**    | budget                                               | useBudget, useCategories, useConnection, useIsPhone, useMenuKeyboard | budget, budget-inspector, envelope-funding, assign-block, targets            |
| `/budget/year`, `/budget/year/:year`     | AnnualBudget.tsx (439)                   | (ui only)                                            | none                                                                 | phone/annual-budget-phone                                                    |
| `/budget/category/:id`                   | CategoryDetail.tsx (357)                 | budget, charts, transactions, files                  | useBudget, useTransactions                                           | budget                                                                       |
| `/accounts`                              | Accounts.tsx (285)                       | accounts, dashboard, up                              | useAccounts, useOpenFromLink                                         | accounts, accounts-access, demo/accounts-access                              |
| `/accounts/:id/reconcile`                | ReconcilePage.tsx (374)                  | (ui only)                                            | none                                                                 | accounts, financial-integrity                                                |
| `/accounts/:id`                          | AccountTransactions.tsx (122)            | accounts, transactions, files                        | useAccounts                                                          | accounts, transactions                                                       |
| `/transactions`                          | Transactions.tsx (144)                   | transactions, receipts                               | useOpenFromLink                                                      | transactions, transaction-clarity, transaction-filters, transaction-presets  |
| `/household`                             | Household.tsx (1587) **split candidate** | household                                            | useAccounts, useSchedules, useTransactions                           | household, household-categories, housemate-money, phone/household-menu-phone |
| `/payment-plans`                         | PaymentPlans.tsx (157)                   | plans                                                | useAccounts, useConnection, usePaymentPlans                          | payment-plans                                                                |
| `/recurring`                             | RecurringTransactions.tsx (221)          | recurring                                            | useSchedules, useOpenFromLink                                        | recurring                                                                    |
| `/cash-flow`                             | CashFlow.tsx (1328) **split candidate**  | reports, transactions                                | useReports, useIsPhone                                               | cash-flow                                                                    |
| `/reports`                               | Reports.tsx (251)                        | reports, review                                      | useCustomReports, useDashboards                                      | reports, report-drill-through                                                |
| `/reports/custom`, `/reports/custom/:id` | CustomReportBuilder.tsx (190)            | reports                                              | useCustomReports, useDebounce                                        | reports                                                                      |
| `/reports/widget/:id`                    | ReportWidgetView.tsx (187)               | reports                                              | useDashboards                                                        | reports                                                                      |
| `/payees`                                | Payees.tsx (434)                         | payees                                               | usePayees, useCategories, useIsPhone                                 | payees                                                                       |
| `/rules`                                 | Rules.tsx (448)                          | rules                                                | useRules, useIsPhone, useOpenFromLink                                | rules                                                                        |
| `/settings`                              | Settings.tsx (148)                       | settings                                             | none                                                                 | settings, data, safe-mode                                                    |
| `/goals`                                 | Goals.tsx (518)                          | goals, files                                         | useGoals, useAccounts                                                | category-goals, demo/category-goals                                          |
| `/forecast`                              | Forecast.tsx (74)                        | forecast, longterm                                   | none                                                                 | forecast, long-term-forecast, phone/long-term-forecast                       |
| `/investments`                           | Investments.tsx (786)                    | investments, accounts, reports                       | useInvestments, useAccounts                                          | investments                                                                  |
| `/tax`                                   | Tax.tsx (822) **split candidate**        | tax, reports, connection                             | useTax, useAssets, useInvestments, useConnection                     | receipts-tax, depreciating-assets, tax-car-home                              |
| `/files`                                 | Files.tsx (419)                          | files                                                | useFiles, useTags, useDebounce                                       | files                                                                        |
| `/review`                                | Review.tsx (792)                         | review, budget, transactions, plans                  | useBudget, useCategories, useConnection, useTransactions             | review, review-payees, review-undo, demo/review                              |
| `/guide`, `/guide/:page`                 | Guide.tsx (81)                           | guide                                                | none                                                                 | user-guide, guides                                                           |

Every page also uses `components/ui`, and most use `components/guide` for the page guide.
Cross-cutting specs: accessibility, dialog-focus, load-errors, menus, navigation, tabs,
unsaved-drafts, phone/phone, phone/polish-phone, phone/iphone-webapp, phone/amounts-phone.

## Component files over 800 lines (split candidates)

- `components/transactions/ImportModal.tsx` (1147)
- `components/reports/ReportDetail.tsx` (1067)
- `components/forecast/CashRunway.tsx` (1028)
- `components/tax/Assets.tsx` (910)
- `components/budget/PaydayPlan.tsx` (903)
- `components/longterm/LongTermForecast.tsx` (867)
- `components/enablebanking/ConnectEnableBankingModal.tsx` (842)
- Not UI components but over 800: `userGuide/articles.tsx` (1297), `types/index.ts` (1250).

## `client/src/components/ui` primitives

- `amountValidity.tsx`: `useAmountValidity`, `AmountFields`; keeps a save button off while an amount field is not an amount.
- `Badge.tsx`: `Badge`, small tinted label (account types use their icon colour).
- `BankLogos.tsx`: `PlaidLogo`, `SimplefinLogo`.
- `BrandName.tsx`: `BrandName`, the Allotment wordmark.
- `Button.tsx`: `Button`, `ButtonLink`; variants and sizes, 44px on phones.
- `Card.tsx`: `Card`, the surface container.
- `CategoryIcon.tsx`: `CategoryIcon`, a category's icon or dot.
- `ConfirmModal.tsx`: `ConfirmModal`, confirm or cancel a destructive action.
- `ContextMenu.tsx`: `ContextMenu`, `useMenuTrigger`; right-click / Shift+F10 menu with flyouts.
- `CurrencyInput.tsx`: `CurrencyInput`, the only money input (`type="text" inputMode="decimal"`).
- `DatePicker.tsx`: `DatePicker`.
- `DiscardPrompt.tsx`: `DiscardPrompt`, asks before dropping an unsaved draft.
- `EmptyState.tsx`: `EmptyState`, message plus actions when a list is empty.
- `ExternalLink.tsx`: `ExternalLink`, a link out with optional arrow icon.
- `HelpTip.tsx`: `HelpTip`, an inline help popover.
- `IconPickerPopover.tsx`: `IconPickerPopover`, anchored icon chooser.
- `Input.tsx`: `Input`, `Select` (40px, 44px on phones).
- `Modal.tsx`: `Modal`, `useModalValue`; dialog with focus handling.
- `MonthRangePicker.tsx`: `MonthRangePicker`.
- `PageHeader.tsx`: `PageHeader`, page title row.
- `Private.tsx`: `Private`, `HiddenAmount`, `PrivateChart`; Safe mode blurring.
- `QueryProblem.tsx`: `QueryProblem`, `loadFailed`; unavailable or stale data with Retry.
- `RowMenu.tsx`: `RowMenu`, a row's overflow actions menu.
- `ScrollCue.tsx`: `ScrollCue`, a hint that a strip scrolls sideways.
- `Slider.tsx`: `Slider`, range input with value bubble (adapted from shadcn).
- `StatCard.tsx`: `StatCard`, `StatGrid`.
- `tabList.tsx`: `TabList`, `tabIds`, `onTabListKeyDown`; accessible tabs.
- `Toasts.tsx`: `Toasts`, the toast stack.
- `UndoToast.tsx`: `UndoToast`, a notice with Undo and Redo.
