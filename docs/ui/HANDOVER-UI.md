# UI handover

Overwritten at the end of each UI session, never appended. UAT 03 fixes entry written 22 November 2026
(branch `feat/uat-03-selection-and-phone-pickers`, up.178, not merged); Wave G3 entry written 21 November 2026
(PR #279 from `feat/wave-g3-screens`, up.177, merged into `redesign`); Wave G2 entry 20 November 2026 (PR #278,
up.176, merged into `redesign`). Wave F entry rewritten 15 November 2026
for the revised PR #273 (branch `wave-f`, up.174, not merged); Wave E entry 13 November 2026 (branch `feat/wave-e-navigation`, up.173); Wave D and palette entries updated 12 November 2026
(PRs #262 and #259). Other entries last written 11 November 2026 from `redesign` (head `cf2e2f0`). Older detail: grep `docs/handover/ARCHIVE.md`.

## Done this session

- UAT 03 fixes (#267; up.178, branch `feat/uat-03-selection-and-phone-pickers`, PR #280 into
  `redesign`, not merged): the owner's UAT of 21 November 2026 found two gaps, both closed in code.
  The register has one selection: **Select** puts a checkbox on every row and phone card, **Select
  all _N_** selects the whole list, and `utils/registerSelection.ts` is its pure model (toggle,
  Cmd/Ctrl and Shift clicks, prune, `selectionTarget`). Right-click, Shift+F10, the Menu key, long
  press, the bar's More actions or a card's ⋯ on a selected row opens `SelectionMenu`: Review, Category…,
  Payee…, Replace notes…, Remove notes, Add tag, Remove tag, Reports, Share _N_ selected with ▸ and
  Delete _N_. Every edit goes through `useBulkEdit` and `POST /api/transactions/bulk` at once, with
  Undo in the toast and the server's expected-count check; the old Edit dialog
  and the list's action group are gone. Delete is still behind `BulkDeleteModal`'s preview and
  typed word. `ContextMenu` gained `MenuItem.prompt`, a one-field form in place of the menu (Escape
  or Back returns). Every writing item is disabled with `SAVING_PAUSED` (`SavingPausedHint.tsx`,
  the one copy of the wording) while saving is paused. `POST /api/transactions/review` was removed
  (only the old Mark reviewed button called it): `phase9.test.ts` proves the same guarantees on
  the bulk route. Add transaction's Category field on a phone opens like the account list, flush
  with the field and without the keyboard: `phoneDrawer` on `CategorySelectButton` and
  `CategoryPicker`, `focusSearchOnOpen` and `containerPadding` on `SearchList`. `NativePicker`
  (every phone date and month field) gained `min-w-0 appearance-none` and a left-aligned WebKit
  value so the Date field cannot outgrow its sheet on iOS; no engine here reproduces that, so the
  owner's iPhone check closes it. Docs: `docs/HOUSEHOLDS.md` (sharing selected payments),
  `docs/PHASE-9-DEVELOPMENT-PHASE.md` (review on the bulk route). `FORM-CONTROLS-AUDIT.md` is the
  G0 snapshot and keeps its old lines by design.
- Wave G3 (#267, WAVG-06; up.177, PR #279 from `feat/wave-g3-screens`, merged into `redesign`): the planning,
  reports, files and import screens use only the shared controls. Goals (`GoalFormModal`,
  `GoalStatusModal`), Investments (`IncomeModals`, `InvestmentModals`, `SaleModals`,
  `SplitModals`), Forecast (`CashRunway`), the long-term forecast (`fields.tsx`, `EventEditor`,
  `EventList`, `LongTermForecast`, `SavingsPanel`, `SimulationPanel`, `AccountsPanel`,
  `AssumptionsPanel`), Reports (`ReportBuilderSidebar`, `AccountMultiSelect`,
  `CategoryTreePicker`, `ReportDetail`), Files (`Files.tsx`, `FileDetailModal`) and the import
  dialogs (`ImportModal`, `YnabImportModal`, `ImportCategories`). The leftover gate in
  03-23-PLAN.md prints 0 over these files. Bounded numbers now say when they are out of range
  (D-14): the runway's Variable spending % (0-500), Income % (0-200) and Goal growth % a year
  (-100 to 50), a life event's Last year (1900-2300 or blank) and the CSV wizard's Rows above the
  header (0 to the smaller of 1000 and the file's rows less one). The long-term `WholeNumberField`
  and `RateField` are wrappers over `NumberField`. The month grid's names come from date-fns
  (`monthNames` in `utils/dateRange.ts`, IN-02) and Next year stops at the grid's max (`maxYear`,
  IN-03). Files keeps From and To in page state beside the URL (`useUrlHeldDay`, see Traps).
  Stays native (D-17): the Files drop zone and the CSV and YNAB file inputs. Exports are download
  buttons; `settings/DataExport.tsx` moves with Settings in Phase 4 (owner, 19 November 2026).
  Every behaviour change and changed selector is in the body of PR #279 and `CHANGELOG.md`.
- Wave G2 (#267, WAVG-05; up.176, PR #278 from `feat/wave-g2-screens`, merged into `redesign`): the everyday money
  screens use only the shared controls. Transactions (`TransactionFormRow`, `TransactionDetailPanel`,
  `AddTransactionModal`, `BulkDeleteModal`, `SplitTransactionModal`, `TransferSuggestions`,
  the register's share-picking boxes, `TransactionFilters`,
  `TransactionMarks`), Accounts (`AccountTypeSelect`, add, edit and delete dialogs,
  `ReconcilePage`), Budget (the table's amount cell, `BudgetAmountSheet`, `CardPayments`,
  `MoneyMoves`, `TargetCard`, `PaydayPlan`, `AutoAssign`, `FundingRows`, `NoteField`,
  `AnnualBudget`), Categories (`CategoryManager`, `EditCategoryModal`, `DeleteCategoryModal`),
  Payees, Rules (`RuleEditorModal`, `OptionPicker`, `ApplyRulesModal`), Recurring
  (`RecurringFormModal`, `UpcomingLengthModal`, `AllTab`, `DiscoverSchedulesModal`,
  `OccurrenceMatchModal`), receipts (`ReceiptEditor`, receipt settings) and
  `CurrencySelect`/`CurrencyDifference`. The leftover gate in 03-15-PLAN.md prints 0 over these files.
  Added to the set: `ui/NumberField.tsx` (bounded whole or decimal numbers, D-14: keeps the typed
  text, shows its range line under the field, holds an `AmountFields` save; text helpers in
  `ui/numberText.ts`, messages in `fieldMessages.ts`); `CurrencyInput` options `fieldSize`,
  `expression`, `onTextChange`, `commitOnBlur`, `nullable` (empty is null, a typed 0 is a bound) and
  a forwarded ref; `DatePicker` options `fieldSize`, `hideLabel` and `optionalHint`.
  `MerchantSelect` is a wrapper over the shared Combobox (same sort, footer and Escape rule);
  `CategoryPicker`/`CategorySelectButton` gained `extraItem` (a pinned choice such as Ready to
  assign), `hint`, `allowCreate`, `includeHidden`, `allowNone`/`noneLabel` and `label`, and a
  button is named `<label>: <shown>`. `MonthRangePicker` shows short months (Nov 2026) on phones
  (owner, 19 November 2026). Stays native (D-17): the three file inputs (account logo, payee logo,
  receipt scan photo) and `IconPickerPopover`. Every behaviour change and changed selector is in the
  body of PR #278 and `CHANGELOG.md`. Its bulk edit dialog was replaced by the register selection
  (UAT 03 fixes, above).
- Wave F settings split and good moments (up.174, branch `wave-f`, PR #273 revised to the owner's
  14 November decisions): #244 Connected banks is its own page, `/accounts/connections`
  (`pages/AccountConnections.tsx` around `components/accounts/ConnectedBanks.tsx`), opened from
  the Accounts header link (`accounts.connections`) and the empty state's Connect a bank. An
  allowlisted `?provider=` (up, plaid, simplefin, enablebanking; Up when missing) holds the open
  bank in the URL, and each status pill opens its own bank through `bankFeedLink` (D-08), so Up is
  at most two clicks away. Categories is its own page, `/budget/categories`
  (`pages/BudgetCategories.tsx` around `settings/CategoryManager.tsx`), opened from the Budget
  header's Categories link, the phone ⋯ menu and the empty budget's Set up your categories.
  Settings has eight tabs and opens on Accounts; `?tab=connections` and `?tab=categories` redirect
  (replace) to the new pages and keep the other parameters (`movedSettingsTab`). The paths,
  provider allowlist and link builders live in `utils/movedSections.ts`, and a unit test there fails
  if either path is spelled in another client file. Search lists both pages (`PALETTE_PAGES`,
  palette only, not the sidebar). The Accounts and Settings guides are version 2. The
  account-deletion message in `server/src/services/accountDeletion.ts` now names Accounts →
  Connected banks (D-09: the phase's one server change, message text only). #241 each goal row
  ends in a plant (`components/goals/GoalPlant.tsx`, drawn by `components/ui/Plant.tsx`): four
  stages, seed, seedling, bud and flower, from `plantStage`; the flower only when the goal's money
  reaches its target. It grows in place when its stage changes and blooms once per goal per device
  (`firstBloom`, `flybudget:goals-bloomed`). At $0 the Ready to assign label comes from
  `readyToAssignStatus` (`utils/fundingStatus.ts`): "Every dollar has a job" with a still seedling
  only when the server says nothing is left to sort out, otherwise it names what is left; the figure
  is in normal colour. `lint/terms` guards the retired $0 label. Motion tokens `--animate-grow-in`,
  `bloom` and `bloom-ring` in `index.css` are `none` under reduced motion.
- Wave E navigation depth (up.173, branch `feat/wave-e-navigation`): #235 a payee page
  (`/payees/:id`, `pages/PayeeDetail.tsx`: spending by month and total, default category, the
  rules naming it via `ruleMentionsPayee`, its transactions), opened from the Payees list, a
  transaction's details and Search; a category-funded goal row opens its category, every goal row
  has Edit. Files for a payee are left out: listing them needs one request per transaction or a
  server change. #243 one click opens a desktop row's details; the category pill is the one
  inline edit (chevron always shown), the row ends in Edit; `PayeePicker` and the hover arrows
  are gone (details keep the payee, category and account links). #245 `undoStore.push` announces
  the toast itself (`quiet` only for onboarding sorting); the toast stays 8 s with Undo and waits
  while pointed at or focused; account, category and payee registers and the Payees search keep
  their filters in the URL (`useFilterSearch`); `useScrollMemory` restores scroll on Back and
  Forward. #240 one gutter (`PAGE_GUTTER`); the Payees default category uses `CategoryPicker`.
  Fix rounds 1-2: payee-page failures show `QueryProblem`, totals and chart use `Private` /
  `PrivateChart`, and missing rates show `MissingRateNote`; toasts stack in one column; one Undo
  per change (Mark reviewed, follow-up toast, sharing, paying ahead all speak through `push`);
  goal rows have one control per destination (the name's link or Edit) plus a chevron cue.

- Wave D discoverability (up.172, PR #262): #226 fixed sidebar Set up rows for Household, Tax time and
  Files, respecting explicit Hidden and keeping their fixed positions; palette Set up links open
  their pages, while hidden entries still open Preferences. #237 shared EmptyState examples for
  Files, Household and Forecast; Household and long-term creation forms open after one action.
  #236 possible transfers join the shared next-steps list and open the existing owner-review
  dialog. #239 partly done: welcome switches only; guide banners, Get started and Guided setup
  stay as they are. Illustrative examples use the budget currency and remain visible in Safe mode;
  actual forecasts stay hidden. Review keeps successful transfer counts during background refresh,
  and Welcome uses touch-sized switches that accept multiple pending choices.

- Wave C dashboard (up.170, branch `feat/wave-c-dashboard`): #230 the review card keeps an Open
  review button at every width, with steps 2 and 3 as quiet rows beside it on wider screens, and
  Left to spend has a pace bar (`spendingPace`, `monthProgress` in `utils/leftToSpend.ts`). #231
  `StatusStrip` under the opening line: bank feed freshness (`utils/bankSync.ts`, shared with
  `UpSyncBadge`) and the default household's balance (`components/household/balanceHeadline.ts`,
  shared with `BalanceSummary`); always on, not a Customise card; Tax and Files left out (no cheap
  count). #232 paired cards share a height, desktop Bills lists 3 bills and 2 pay days, one
  summary disclosure on phones, and `ui/SegmentedControl` replaces the charts' range selects.
- Search palette, parts 1 and 2 of #224 (up.169/up.171, PRs #253 and #259):
  Cmd/Ctrl+K, `/` and phone Search cover pages, actions and cached accounts, categories, payees
  and goals, then read-only Transactions (8 rows plus See all, all dates, details on selection)
  and Files (5 rows, opens the file). Server searches start at two trimmed characters after
  250 ms; palette-only query keys never enter the offline copy or recents. Hidden Files stays
  hidden; offline groups say Not available offline (the demo searches its sample files);
  loading/failure rows are unavailable, amounts use Private at every Safe mode level. Split-note
  matches show the child's note; register, card, details and palette share payee/transfer wording
  in `transactions/transferLabel.ts`. Transaction amounts come from the register's
  `formatRegisterAmount`, so round-ups and folded transfers read the same in both. Choosing a
  transaction opens its details only when the row is in the first loaded page of the search.
- Wave B fixes (up.168): #227 category opens on All time, #228 one Income/Expenses palette in
  the chart kit, #229 category layout, #233 Delete in the details menu plus filter links, #234
  quiet Recurring callout, #238 Reports summary on phones, #242 row arrow and eye names.
- Add transaction from every page (up.167, branch `feat/wave-a-add-and-tabs`): one shell-level
  `AddTransactionModal` opened by the sidebar's Add a transaction button, the phone tab bar's
  centre Add, the N key and the Transactions page's Add (#223). It opens on Amount, with the
  page's account or else the last one used on this device (#222). Phones get a bottom tab bar:
  Home, Transactions, Add, Budget, Review (#225).
- Dashboard: the refined design is now `/dashboard` (`pages/Dashboard.tsx`), with a shared chart
  kit; `/dashboard/refined` and DashboardRefined are gone (`cf2e2f0`, up.166).
- Investments: holding cards on phones, a desktop table, a summary strip and one shared holding
  menu (`35555fc`).
- Goals: one summary line, a funding-source tag per row, one progress colour (`b47ddd5`).
- Forecast: leads with the answer, plan menu, no-income callout, projection charts (`fa588b5`, up.165).
- Household: balance band with settle up, split slider, quick shared expense and recent shared
  expenses, tabs and share preview (`da18c99` to `cdeed35`, up.164).
- Dates: day-first word format, `d MMM yyyy` (`f97f2d8`, up.164).
- Accounts, Review, Transactions and Budget passes (`5f2902c` to `b90f132`, up.154 to up.163).
- Engineering skills configured: issue tracker, triage labels, domain docs (`c037524`).

## In progress

- None committed half-done. `redesign` is ahead of `main`; up.154 to up.178 are prepared, not tagged.
- Wave G shared form controls (#267): G0, the audit, is
  [FORM-CONTROLS-AUDIT.md](FORM-CONTROLS-AUDIT.md) (PR #275): every field and selector in
  `client/src` with its file and line, what it becomes and the phase that moves it.
- G1, the shared control set (merged into `redesign` as #277, with #264): `client/src/components/ui/`
  has `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `Switch`,
  `DatePicker`, `MonthPicker`, `Label` and `Field`, on `react-aria-components` (already a
  dependency; no new package). Their class strings live in one place, `ui/fieldClasses.ts`;
  default messages and the control's subject in `ui/fieldMessages.ts`. Phones get native select,
  date and month controls. Fixes: the disabled Switch reads as disabled (#264), placeholders
  meet 4.5:1, and a field shows one focus mark. The DatePicker gains a Today shortcut.
- The gallery: a development-only page at `/dev/controls` (the dev server, or a
  `vite build --mode gallery` build); every other build swaps it for a stub, and
  `e2e/tests/gallery-absent.spec.ts` checks that. Its Playwright project is `gallery`; the
  screenshot test compares committed Linux baselines in `e2e/tests/gallery/__screenshots__/`,
  checked with `bash e2e/gallery-baselines.sh` and remade with `--update` (Playwright's Linux
  container; macOS skips the pixel tests). Look at every changed image before committing it.
  Specs drive the controls through `chooseOption`, `categoryOption`, `fillDate` and `fillMonth`
  in `e2e/tests/fixtures.ts`.
- `MonthRangePicker` was rebuilt in this phase, at the owner's request (D-11, 17 November 2026),
  on MonthPicker's `MonthGrid` inside React Aria's dialog, with two native month inputs (From and
  To) on phones and its props unchanged. Its three users are `reports/DateRangeControl.tsx`,
  `reports/ReportBuilderSidebar.tsx` and `pages/CashFlow.tsx`.
- What has not moved yet: Phase 4 is next, after the owner merges the UAT 03 fixes and re-runs UAT
  tests 1 and 2 (G3 is merged). G4 moves Settings
  (with `settings/DataExport.tsx`), the bank connection sections (`ConnectedBanks`) and the shelved
  and split-candidate pages (Review, Cash flow, Household, Tax); G5 adds the lint rule and removes
  the native `Select` in `ui/Input.tsx` and `CategorySelect.tsx` (it stays until Payment plans
  move).

## Next up (issues)

- #211 run category-goals specs; #212 run long-term forecast specs (both unrun after wording changes).
- #213 quick expense test; #214 refresh `docs/ux-ui-evidence/` dates; #215 iPhone check; #216 dark mode.
- #217 Review queue redesign; #218 Cash flow personal share; #219 Household screens by type.
- #220 sidebar item count (UX review item 7).
- P2: #263 Review checklist in place of guide banners (rest of #239, needs an owner decision);
  #264 disabled switch looks enabled (fixed in the G1 PR; closed by hand after it merges).

## Decisions

- `client/src/index.css` `@theme` is the only token source; DESIGN.md describes it.
- Budget work lives on `redesign`, beside the pre-redesign app on `main`; PR #209 was closed
  unmerged and is reconciled later.
- Goal in-progress bars use one brand colour, reached goals green; `goal.color` only tints the dot.
  A goal's plant (14 November 2026, #241) grows seed, seedling, bud and flowers only when the
  goal's money reaches its target (Goals.tsx's `complete` rule); a goal completed by hand short of
  it keeps its stage. Plain CSS motion, no package; "Goal reached" stays as text.
- Connected banks and Categories are pages, `/accounts/connections` and `/budget/categories`, not
  Settings tabs and not sections of another page; Settings opens on Accounts (14 November 2026,
  #244). Every bank link opens its own provider.
- A $0 Ready to assign never says an unqualified "all done" while a caveat remains: the label names
  the caveat, and the figure keeps the normal text colour (14 November 2026, #241).
- Long-range forecast amounts use `formatWholeCurrency`; forecasts are dotted with a ring at today.
- Pickers (Wave G1, #267, replacing Wave E's short-list rule): categories use `CategoryPicker`,
  payees use `PayeeCombobox`, a fixed list uses `Select` (`components/ui/Select.tsx`), and a list
  the user grows uses `Combobox`; phones get native select, date and month controls. A bounded
  number uses `NumberField`, money `CurrencyInput` (D-14). The G2 and G3 screens are on this; the
  rest move in Phase 4, and until a screen moves it keeps the native `Select` in `ui/Input.tsx`.
- The register's selection (owner, 21 November 2026, UAT tests 1 and 2): transactions are selected
  one by one or all at once and changed from the right-click menu, with no edit dialog. Owner
  decision A, given during planning on 21 November 2026: the calm phone category list (no
  keyboard, flush with the field) is Add transaction's Category field only, and the date fix is
  shared. Owner decision B, also given during planning on 21 November 2026: edits apply at once
  with Undo and no preview or confirm, Mark reviewed on the whole list loses its confirm dialog,
  the share-picking button is renamed Select, and its button for every shown row is removed.
- Gutter: page title rows and the content under them use `PAGE_GUTTER`
  (`components/ui/pageGutter.ts`): 16 px on phones, 24 px from `md`; `e2e/tests/phone/page-gutter.spec.ts`
  checks every route (#240).
- Undo: announcing is part of `undoStore.push`; pass `message` for better words, `quiet` only
  where silence is the point (onboarding sorting) (#245).
  A mutation that may record nothing takes the words and announces without Undo instead; never
  announce again after a push, and never add an inline Undo beside the toast's.

## Traps

- Settings' moved tabs: a moved section is a row of `MOVED_SETTINGS_TABS` (`utils/movedSections.ts`).
  Link through `CONNECTED_BANKS_PATH`, `connectedBanksLink`, `bankFeedLink` and `CATEGORIES_PATH`,
  never a hand-typed path or `?tab=`: `movedSections.test.ts` fails on a spelled-out path.
- Guide markers on Budget: `budget.categories` marks the envelope list (two guides target it); the
  header's Categories link is `budget.manage-categories`.
- `docs/ui/WAVES.md` is kept until Wave G merges (owner, 15 November 2026); update its Status and
  Open PRs when a wave PR opens, merges or is sent back.

- The register has one selection (`utils/registerSelection.ts`): never add a second. A selected row
  opens `SelectionMenu`, any other row `TransactionContextMenu`. A whole-list selection (Select
  all) ends when the filters or range change by value (a JSON key of the params), hand-picked rows
  are pruned to what is still listed once the list query succeeds, and `expectedCount` must be the
  matched count or the server refuses. A new writing menu item goes in `SelectionMenu`'s `writing`
  list so the paused rule covers it.
- Only a caller that sets `phoneDrawer` gets the calm phone category list; every other category
  picker focuses its search when it opens (owner decision A). A new caller decides on purpose.
  The 12 px `containerPadding` shift React Aria applies to a list drawn into a portal container
  still affects the Account `Combobox` in Add transaction and other non-anchored category lists on
  phones; `containerPadding={0}` fixes it where wanted.
- Scroll memory is keyed by the router's history key: a hand-typed hash URL gets the key
  `default`, like the first page load. A page-level scroll container must use `useScrollMemory`
  or Back loses its place. The page moves by itself only on Back and Forward (a replace only
  carries the remembered offset; scroll intent ends a restore): keep it that way.
- The phone tab bar carries the bottom safe-area inset (not `<main>`), and phone toasts sit
  5rem up to clear it (`Toasts aboveTabBar`): change the bar's height and that offset together.
- The Forecast no-income callout hides a server warning by its leading text (`longTermInputs.ts`):
  change both together.
- The date option's stored value changed: `PREFERENCES_VERSION` is 4 with a migration step.
- Bulk UI text rewrites hit strings the code compares (stored category names); search `server/src`
  and tests for the old text.
- The dashboard's status strip and the Household band share `balanceHeadline`; the strip's
  bank pills and the Accounts page's Up badge share `bankSyncLabel`: change wording there once.
- `E2E_SKIP_BUILD=1` reuses the last client build; run once without it after changing UI text.
- Global CSS in `index.css` must sit in an `@layer`, or it beats every Tailwind utility. The
  global `:focus-visible` outline is in `@layer base`, so a control's own ring wins; a control
  without one (ContextMenu, ServerStatus, a bare CategorySelect) must draw its own.
- A label over a group of controls (radio group, date segments) must be a `span`, not a `label`:
  a `label` element names only one control.
- `CategoryPicker` and `PayeeCombobox` are wrappers over `ui/Combobox.tsx`: change list keyboard
  or popover behaviour there, not in the wrapper. Their rows are `option`s and the payee field is
  a `combobox`; specs reach category rows through `categoryOption`.
- `DatePicker` holds the day for the `value` it was given and resets to a new `value` as soon as
  one arrives. A caller whose value catches up a render late (one read back from the URL) loses
  the second figure of a typed day: keep the day in page state as well, as Files does with
  `useUrlHeldDay`.
- The shared `Combobox` opens its list on typing (`menuTrigger` `input`), not on a click. Specs
  type part of the name and click the option on the page; `chooseOption` is for `Select`. Pass
  `menuTrigger="focus"` only where a click must open the list (the runway's saved scenarios, the
  YNAB account target).

## Verify

- `npm test --prefix client`; `npm run build --prefix client`.
- `cd e2e && npm test -- --project=desktop tests/<screen>.spec.ts`, plus the phone spec in `MAP.md`.
- Layout at 390px with no sideways scroll; light and dark; evidence in `.ui-evidence/<date>-<screen>/`.
