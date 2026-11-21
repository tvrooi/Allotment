# UI map

One row per route in `client/src/App.tsx`. Line counts are snapshots from `wc -l`, all refreshed on 14 November 2026 (Wave F). Recount with `wc -l client/src/pages/*.tsx` rather than trusting them. Page files are under
`client/src/pages/`, component folders under `client/src/components/`, hooks under
`client/src/hooks/` (only hooks the page imports directly are listed), specs under `e2e/tests/`.
**split candidate** marks a file over 800 lines.

Dashboard, Budget and Transactions are in the main bundle; every other page is `lazy()`.

## Routes

| route                                    | page file (lines)                        | component folder                                               | key hooks                                                                          | e2e spec                                                                     |
| ---------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/welcome`                               | Welcome.tsx (309)                        | accounts, banks, up, plaid, simplefin, enablebanking           | useAccounts, usePlaid, useServer, useGuides, useConnection                         | first-run, first-import, switchers                                           |
| `/`                                      | redirects to `/dashboard`                |                                                                |                                                                                    |                                                                              |
| `/dashboard`                             | Dashboard.tsx (266)                      | dashboard, review, layout, household, up                       | useNextSteps, useIsPhone (StatusStrip: bank and household hooks)                   | dashboard, home-cards, safe-mode, phone/dashboard-viewport, demo/demo        |
| `/budget`                                | Budget.tsx (1484) **split candidate**    | budget                                                         | useBudget, useCategories, useConnection, useIsPhone, useMenuKeyboard               | budget, budget-inspector, envelope-funding, assign-block, targets            |
| `/budget/year`, `/budget/year/:year`     | AnnualBudget.tsx (440)                   | (ui only)                                                      | none                                                                               | phone/annual-budget-phone                                                    |
| `/budget/categories`                     | BudgetCategories.tsx (27)                | settings (CategoryManager)                                     | useScrollMemory (CategoryManager: useCategories)                                   | settings, menus, phone/targets-phone                                         |
| `/budget/category/:id`                   | CategoryDetail.tsx (370)                 | budget, charts, transactions, files                            | useBudget, useTransactions                                                         | budget                                                                       |
| `/accounts`                              | Accounts.tsx (302)                       | accounts, dashboard, up                                        | useAccounts, useOpenFromLink                                                       | accounts, accounts-access, demo/accounts-access                              |
| `/accounts/connections`                  | AccountConnections.tsx (33)              | accounts (ConnectedBanks), up, plaid, simplefin, enablebanking | useScrollMemory (ConnectedBanks: usePlaid, useSimplefin, useEnableBanking, useUp)  | accounts, up, enable-banking, first-import, switchers                        |
| `/accounts/:id/reconcile`                | ReconcilePage.tsx (375)                  | (ui only)                                                      | none                                                                               | accounts, financial-integrity                                                |
| `/accounts/:id`                          | AccountTransactions.tsx (131)            | accounts, transactions, files                                  | useAccounts                                                                        | accounts, transactions                                                       |
| `/transactions`                          | Transactions.tsx (142)                   | transactions, receipts                                         | useOpenFromLink                                                                    | transactions, transaction-clarity, transaction-filters, transaction-presets  |
| `/household`                             | Household.tsx (1598) **split candidate** | household                                                      | useAccounts, useSchedules, useTransactions, useConnection                          | household, household-categories, housemate-money, phone/household-menu-phone |
| `/payment-plans`                         | PaymentPlans.tsx (160)                   | plans                                                          | useAccounts, useConnection, usePaymentPlans                                        | payment-plans                                                                |
| `/recurring`                             | RecurringTransactions.tsx (224)          | recurring                                                      | useSchedules, useOpenFromLink                                                      | recurring                                                                    |
| `/cash-flow`                             | CashFlow.tsx (1329) **split candidate**  | reports, transactions                                          | useReports, useIsPhone                                                             | cash-flow                                                                    |
| `/reports`                               | Reports.tsx (252)                        | reports, review                                                | useCustomReports, useDashboards                                                    | reports, report-drill-through                                                |
| `/reports/custom`, `/reports/custom/:id` | CustomReportBuilder.tsx (193)            | reports                                                        | useCustomReports, useDebounce                                                      | reports                                                                      |
| `/reports/widget/:id`                    | ReportWidgetView.tsx (187)               | reports                                                        | useDashboards                                                                      | reports                                                                      |
| `/payees`                                | Payees.tsx (436)                         | payees                                                         | usePayees, useIsPhone, useCanSave                                                  | payees, connection                                                           |
| `/payees/:id`                            | PayeeDetail.tsx (263)                    | payees, transactions, charts, rules, currency                  | usePayees, useRules, useTransactions, useFilterSearch, useScrollMemory, useCanSave | payees, transactions, command-palette, safe-mode, currencies                 |
| `/rules`                                 | Rules.tsx (449)                          | rules                                                          | useRules, useIsPhone, useOpenFromLink                                              | rules                                                                        |
| `/settings`                              | Settings.tsx (146)                       | settings (eight tabs, opens on Accounts)                       | none                                                                               | settings, data, safe-mode                                                    |
| `/goals`                                 | Goals.tsx (565)                          | goals (GoalPlant), ui (Plant), files                           | useGoals, useAccounts                                                              | category-goals, demo/category-goals                                          |
| `/forecast`                              | Forecast.tsx (72)                        | forecast, longterm                                             | none                                                                               | forecast, long-term-forecast, phone/long-term-forecast                       |
| `/investments`                           | Investments.tsx (786)                    | investments, accounts, reports                                 | useInvestments, useAccounts                                                        | investments                                                                  |
| `/tax`                                   | Tax.tsx (822) **split candidate**        | tax, reports, connection                                       | useTax, useAssets, useInvestments, useConnection                                   | receipts-tax, depreciating-assets, tax-car-home                              |
| `/files`                                 | Files.tsx (454)                          | files                                                          | useFiles, useTags, useDebounce, useConnection                                      | files                                                                        |
| `/review`                                | Review.tsx (792)                         | review, budget, transactions, plans                            | useBudget, useCategories, useConnection, useTransactions                           | review, review-payees, review-undo, demo/review                              |
| `/guide`, `/guide/:page`                 | Guide.tsx (81)                           | guide                                                          | none                                                                               | user-guide, guides                                                           |

Shared controls on the Wave G2 screens (#267; every field and list on these is from `components/ui`
or a picker wrapper, and the leftover gate in 03-15-PLAN.md prints 0 over their files):

- `/transactions`, `/accounts/:id`, `/budget/category/:id`, `/payees/:id` (the register): form row
  `DatePicker` (sm), `PayeeCombobox`, `CategorySelectButton`, `CurrencyInput`, `Input`; details panel
  `DatePicker` (a pick saves at once), `Textarea`; filters `Input`, `Checkbox`, `CurrencyInput`
  (`nullable`), `DatePicker` (sm, Clear); marks `Input`, `Checkbox`; Add transaction `Combobox`
  (account; its Category field is the one caller that sets `phoneDrawer`), `DatePicker`,
  `CurrencyInput`, `Input`; the register selection (Select, `utils/registerSelection.ts`) with its
  right-click menu `SelectionMenu` (`ContextMenu` with a prompt item over `Input` and `Button`,
  and `CategoryPicker`; no edit dialog); bulk delete `Input`; split `CategorySelectButton`,
  `CurrencyInput`, `Input`; transfer suggestions and the selection's row `Checkbox`; receipts
  `DatePicker`, `CategorySelectButton`, `Combobox`, `Checkbox`, `Select`. Specs for the selection:
  transactions, household, phase9 and phone/register-selection-phone.
- `/accounts`: `Select` (account type, `CurrencySelect`), `Field` and `Input`, `Checkbox`,
  `CurrencyInput`; delete confirmation `Input`. `/accounts/:id/reconcile`: `Checkbox`.
- `/budget`: amount cell and search `Input`, row `Checkbox`; phone sheet `CurrencyInput`
  (`expression`) and `Checkbox`; moves `CategorySelectButton` (Ready to assign as `extraItem`) and
  `CurrencyInput`; target `Select`, `CurrencyInput`, `DatePicker`, `NumberField` (1-60); card
  payments `CurrencyInput`; payday plan `CurrencyInput`, `CategorySelectButton`, `Select`,
  `Combobox`, `DatePicker`, `Checkbox`, `NumberField` (0-100); auto-assign `RadioGroup`, `Select`;
  funding rows `Checkbox`; notes `Textarea`. `/budget/year`: `Select`.
- `/budget/categories`: `Input`; edit `Input`, `Combobox`, `RadioGroup`, `Checkbox`; delete
  `CategorySelectButton`. `IconPickerPopover` stays.
- `/payees`: `Input`, `Checkbox`, `RadioGroup` (merge).
- `/rules`: search `Input`; editor `Select`, `Combobox`, `DatePicker` (sm), `Input`,
  `CurrencyInput`, `NumberField` (split percent), `Checkbox`, and `OptionPicker` over
  `CategorySelectButton`, `MerchantSelect` or `Combobox`; apply `Checkbox`.
- `/recurring`: `Select`, `Combobox`, `DatePicker`, `Input`, `NumberField` (date flexibility,
  upcoming length), `Checkbox`, `MerchantSelect`.
- Native by decision (D-17): the account logo, payee logo and receipt photo file inputs.

Shared controls on the Wave G3 screens (#267; the leftover gate in 03-23-PLAN.md prints 0 over
their files):

- `/goals`: goal form `Field` and `Input`, `CategorySelectButton` (Progress source, none is
  Manual tracking), `Combobox` (linked account), `CurrencyInput`, `DatePicker`; goal status
  `Input`, `Combobox` (replaced by), `CategorySelectButton` (move to category, keep as
  `extraItem`), `CurrencyInput`.
- `/investments`: `DatePicker` (required, up to today), `Select` (income kind, security type),
  `Combobox` (a holding's account and security), `RadioGroup` (parcels sold), `Checkbox`, `Input`,
  `CurrencyInput`.
- `/forecast`: cash runway `NumberField` (spending and income percents, goal growth),
  `CurrencyInput`, `DatePicker`, `Select` (horizon, history, income from, bill shares),
  `Combobox` (saved scenarios); long-term forecast `NumberField` (`WholeNumberField`, `RateField`,
  a life event's last year), `Select`, `Combobox` (plan, compare with, loan, add an account to the
  savings order), `RadioGroup`, `Checkbox`, `Input`, `CurrencyInput`.
- `/reports`, `/reports/custom`: `Select` (Group by, sm), `Checkbox` (accounts, category tree,
  trend categories), `MonthRangePicker`.
- `/files`: `Input` (search, sm, Clear), `Select` (kind, sm), `DatePicker` (From and To, sm);
  details `CategorySelectButton` or `Combobox` (the link), `DatePicker`, `Textarea`, `Input`.
- Import dialogs (from the register, Welcome and Settings → Data): CSV and CAMT `Select` (sm),
  `NumberField` (rows above the header), `Checkbox`, `Input`; YNAB `Select` (date and amount
  format), `Combobox` (target account), `Input`; category mapping `CategorySelectButton`,
  `Combobox` (group for a new category).
- Native by decision (D-17): the Files drop zone and the CSV and YNAB file inputs.

Every page also uses `components/ui`, and most use `components/guide` for the page guide.
Cross-cutting specs: accessibility, dialog-focus, load-errors, menus, navigation, tabs,
unsaved-drafts, phone/phone, phone/polish-phone, phone/iphone-webapp, phone/amounts-phone.

## Shell (every page)

- `components/layout/AppShell.tsx`: desktop shell and `PhoneShell`; mounts the one
  `AddTransactionModal` (opened through `store/addTransactionStore.ts`) and the N key
  (`hooks/useAddTransactionKeyboard.ts`; one-key guard in `utils/pageShortcut.ts`).
- `components/layout/Sidebar.tsx`: desktop sidebar (Add a transaction at its top) and the phone drawer.
- `components/layout/navPages.ts`: the one list of pages (path, label, icon, section, optional
  feature) that the sidebar and the search palette both read; `MORE_FEATURES_LINK`;
  `PALETTE_PAGES`, the pages only Search lists (Connected banks, Categories), whose paths come
  from `utils/movedSections.ts`.
- `components/layout/CommandPalette.tsx` (lazy): search palette over pages, actions, accounts,
  categories, payees and goals, plus debounced read-only transactions/files search; opened by `store/commandPaletteStore.ts`, Cmd/Ctrl+K and `/`
  (`hooks/useCommandPaletteKeyboard.ts`, guard `isPaletteShortcut`) and the phone header's
  Search. Ranking/grouping and the shared search label in `utils/commandPalette.ts`; recents in
  `utils/paletteRecents.ts`. Transaction selection passes one initial detail id through
  `pages/Transactions.tsx` to `components/transactions/TransactionTable.tsx`.
  Payee/transfer labels share `components/transactions/transferLabel.ts` with the register and details.
  Transaction result rows are built in `utils/commandPalette.ts`, using the register's
  `components/transactions/RoundUp.tsx` amount formatter for round-ups and folded transfers.
- `components/guide/KeyboardShortcuts.tsx`: the shortcut list in the guides dialog.
- `components/layout/PhoneTabBar.tsx`: phone tab bar (Home, Transactions, Add, Budget, Review).
- `hooks/useScrollMemory.ts` (memory and per-entry rules in `utils/scrollMemory.ts`,
  `createScrollTracker`; the page moves by itself only on Back and Forward): the shell's `<main>` and every page-level list remember their scroll per
  history entry for Back and Forward, a replaced entry keeping its offset (#245).
- `hooks/useFilterSearch.ts`: register filters in the URL (Transactions, an account, a category,
  a payee), changes replacing the history entry; a scoped page drops its own dimension from the
  URL (`withoutScope`), and `registerParams` keeps the page's scope over any filter.
- `components/ui/pageGutter.ts`: `PAGE_GUTTER`, the one page side gutter (16 px phone, 24 px md+).
- `store/undoStore.ts`: `push` announces the undo toast itself (`message`, or `quiet` for
  onboarding sorting); the store times the toast (8 s with Undo, held while pointed at or focused).
  Mutations that may record nothing (`useUpdatePayee`, `useBulkEdit`, `useShareWithHousehold`)
  take the toast's words and announce without Undo when they record no command.
- Specs: navigation, dialog-focus, transactions ("Add transaction from any page"), command-palette,
  phone/phone, phone/command-palette-phone, demo/demo (palette case).

## Component files over 800 lines (split candidates)

- `components/transactions/ImportModal.tsx` (1147)
- `components/reports/ReportDetail.tsx` (1069)
- `components/forecast/CashRunway.tsx` (1056)
- `components/tax/Assets.tsx` (910)
- `components/budget/PaydayPlan.tsx` (903)
- `components/longterm/LongTermForecast.tsx` (910)
- `components/enablebanking/ConnectEnableBankingModal.tsx` (842)
- Not UI components but over 800: `userGuide/articles.tsx` (1321), `types/index.ts` (1250).

## `client/src/components/ui` primitives

- `amountValidity.tsx`: `useAmountValidity`, `AmountFields`; keeps a save button off while an amount field is not an amount.
- `Badge.tsx`: `Badge`, small tinted label (account types use their icon colour).
- `BankLogos.tsx`: `PlaidLogo`, `SimplefinLogo`.
- `BrandName.tsx`: `BrandName`, the Allotment wordmark.
- `Button.tsx`: `Button`, `ButtonLink`; variants and sizes, 44px on phones.
- `Card.tsx`: `Card`, the surface container.
- `CategoryIcon.tsx`: `CategoryIcon`, a category's icon or dot.
- `Checkbox.tsx`: `Checkbox`, the shared checkbox on React Aria, with help text and an error line.
- `Combobox.tsx`: `Combobox`, a searchable list the user can add to (custom values, Clear, empty state, footer); `SearchList` and its parts, the searchable list under `CategoryPicker`.
- `ConfirmModal.tsx`: `ConfirmModal`, confirm or cancel a destructive action.
- `ContextMenu.tsx`: `ContextMenu`, `useMenuTrigger`; right-click / Shift+F10 menu with flyouts and `MenuItem.prompt`, a one-field form shown in place of the menu.
- `CurrencyInput.tsx`: `CurrencyInput`, the only money input (`type="text" inputMode="decimal"`), formatted when left; options `fieldSize`, `expression` (sums), `onTextChange`, `commitOnBlur`, `nullable` (empty is null, a typed 0 is 0) and a forwarded ref; `readMoneyText`.
- `dateSegments.ts`: `segmentLocale`, `dateExample`; the DatePicker's segment order from the Date format preference.
- `DatePicker.tsx`: `DatePicker`, typed day, month and year segments, a calendar and a Today shortcut; native date input on phones. Options `fieldSize` (sm for rows), `hideLabel` and `optionalHint`.
- `DiscardPrompt.tsx`: `DiscardPrompt`, asks before dropping an unsaved draft.
- `EmptyState.tsx`: `EmptyState`, message plus actions when a list is empty.
- `ExternalLink.tsx`: `ExternalLink`, a link out with optional arrow icon.
- `Field.tsx`: `Field`, `FieldDescription`, `FieldErrorText`; a label, help text and error line around a text field.
- `fieldClasses.ts`: the one place for the shared controls' class strings (field, states, label, help, error, popover, list, option, toggles).
- `fieldMessages.ts`: `requiredMessage`, `fieldSubject` and the other default field messages, written once.
- `HelpTip.tsx`: `HelpTip`, an inline help popover.
- `IconPickerPopover.tsx`: `IconPickerPopover`, anchored icon chooser.
- `Input.tsx`: `Input`, the shared text field on React Aria; and the native `Select` (40px, 44px on phones) that screens still use until Phase 4.
- `Label.tsx`: `Label`, the shared field label.
- `Modal.tsx`: `Modal`, `useModalValue`; dialog with focus handling.
- `NumberField.tsx`: `NumberField`, a bounded whole or decimal number (D-14) built from `Field` and `Input`: keeps the typed text, shows its range line under the field and holds an `AmountFields` save; never `type="number"`. Text readers in `numberText.ts` (`readWholeNumber`, `readDecimal`), range messages in `fieldMessages.ts`.
- `MonthPicker.tsx`: `MonthPicker`, a year stepper and twelve-month grid (`MonthGrid`); native month input on phones.
- `MonthRangePicker.tsx`: `MonthRangePicker`, built on `MonthGrid` from `MonthPicker.tsx` in React Aria's dialog; native From and To month inputs on phones, shown as short months (Nov 2026) (Reports, the report builder, Cash flow).
- `PageHeader.tsx`: `PageHeader`, page title row; its breadcrumbs are a labelled landmark with 48 px links on phones.
- `Plant.tsx`: `Plant`, the goal plant (seed, seedling, bud, flower; `plantStage`), `aria-hidden`, motion opt-in (`grew`, `bloom`); also the still seedling beside a clean $0 Ready to assign.
- `Private.tsx`: `Private`, `HiddenAmount`, `PrivateChart`; Safe mode blurring.
- `RadioGroup.tsx`: `RadioGroup`, `Radio`; the shared radio group.
- `QueryProblem.tsx`: `QueryProblem`, `loadFailed`; unavailable or stale data with Retry.
- `RowMenu.tsx`: `RowMenu`, a row's overflow actions menu.
- `Select.tsx`: `Select`, `SelectOption`, `SelectGroup`; the shared fixed-list select, a listbox popover on desktop and the phone's own picker under 768 px.
- `SegmentedControl.tsx`: `SegmentedControl`, a named group of `aria-pressed` buttons for one choice (Reports' date range, the dashboard charts' ranges).
- `ScrollCue.tsx`: `ScrollCue`, a hint that a strip scrolls sideways.
- `Slider.tsx`: `Slider`, range input with value bubble (adapted from shadcn).
- `Switch.tsx`: `Switch` on React Aria, with a 44 px target, help text, an error line and distinct disabled, read-only and invalid looks (Welcome).
- `Textarea.tsx`: `Textarea`, the shared multi-line field, matching `Input` in every state.
- `StatCard.tsx`: `StatCard` (optional `footer`), `StatGrid`.
- `StatusPill.tsx`: `StatusPill`, a small rounded status link with an optional dot (bank sync, household balance).
- `tabList.tsx`: `TabList`, `tabIds`, `onTabListKeyDown`; accessible tabs.
- `Toasts.tsx`: `Toasts`, the toast stack.
- `UndoToast.tsx`: `UndoToast`, a notice with Undo and Redo.

Shared form controls (Wave G1, #267): the field and selector files above are built on
`react-aria-components`, styled from `fieldClasses.ts`. Picker rule: categories use
`CategoryPicker`, payees use `PayeeCombobox` (both wrappers over `ui/Combobox.tsx`), a fixed list
uses `Select` from `components/ui/Select.tsx`, a list the user grows uses `Combobox`; phones get native
select, date and month controls. A bounded number uses `NumberField`, money `CurrencyInput`. The
Wave G2 and G3 screens (listed under the routes table) have moved; the rest keep the native
`Select` in `ui/Input.tsx` until Phase 4 moves them. `MerchantSelect` (rules and recurring payees) is a
wrapper over the shared Combobox; `CategorySelectButton` opens `CategoryPicker` and is named
`<label>: <shown>`.

- `pages/DevControlsGallery.tsx` and `pages/devGallery/`: the development-only gallery at
  `/dev/controls` (dev server, or a `vite build --mode gallery` build); every other build gets
  `DevControlsGallery.stub.ts` (`client/vite.config.ts`).
- Specs: `e2e/tests/gallery/` (Playwright project `gallery`); its committed Linux baselines in
  `e2e/tests/gallery/__screenshots__/`, checked or remade with `bash e2e/gallery-baselines.sh`
  (`--update`). `gallery-absent.spec.ts` checks no other build has the route. Specs choose and
  fill the shared controls through `chooseOption`, `categoryOption`, `fillDate` and `fillMonth`
  in `e2e/tests/fixtures.ts`.
