# Allotment UI and UX audit

Audited **7 November 2026**, repository `tvrooi/Allotment`, baseline **main @ 99021a5944006e3e968a169aeaf02ecddc342125** (0.2.0-up.131). Working branch: `docs/ux-ui-audit-2026-11-07`. This is an audit and proposed plan; no product code was changed. The documentation and evidence are submitted for review and implementation handoff.

**Coverage qualification:** this report contains a route-wide visual review, source review, independent interaction probes and executed browser journeys. It is not an exhaustive accessibility certification or deployment sign-off. The coverage tables explicitly distinguish observed, automated, source-only and untested states. Do not interpret a screenshot as a completed interaction review. Remaining gaps are retained below rather than described as passing.

## A. Assessment

Allotment already feels like a considered, warm budgeting tool rather than a generic administration console. The Soil/Canvas surfaces, restrained orange action colour, sentence-case headings, useful empty states and mobile transaction/category cards are worth keeping. The financial model is often explained at the point of action: payday previews distinguish expected pay from received deposits; reconciliation describes a correction before creating it; cash-runway projections identify assumptions; goal forms distinguish category funding from manual tracking.

The main weakness is **uneven assurance at the edges of a task**. A failed load can look like an empty budget feature; a failed save can look like a button that did nothing; a failed deletion dismisses its confirmation; keyboard focus escapes a modal; a large financial amount breaks across lines. These are more consequential than changing the palette, adding decoration or making every page look identical. The first implementation phase should make “loaded”, “saved”, “failed”, “cancelled” and “still editing” unmistakable.

The next refinement is composition: mobile Budget puts explanation and summaries ahead of the envelope work; report detail needs a layout that protects whole amounts; Preferences needs stacked feature controls. These recommendations respond to visible task and readability constraints, not an Apple visual imitation. No P0 money-loss defect was established by this UX audit, and no user research or measured conversion/task-time improvement is claimed.

### Product model and deployment constraints

- A category is an envelope. Assignment moves budget capacity, not money at the bank. Ready to assign is received, on-budget money without a category job; future expected pay is not spendable cash. Category balances include carry-over, assignment and activity.
- Up imports settled AUD history with stable identifiers. Savers and 2Up are supported; pending holds and reconciliation need their own explanation. A connection is read-only at the bank, but sorting and assignments change the local budget.
- Household sharing and separate private household-member budgets are different concepts. Pool accounts leave the personal envelope boundary; a shared-expense report is not another personal-budget spending total. Keep these boundaries explicit when selecting an account or switching a budget.
- Payday plans allocate selected received deposits after a preview, with history, stale-preview protection and limits. A preview is not a write. Forecast is read-only with respect to ledger and allocations; saved scenario assumptions are a separate persistence action.
- Desktop-local storage, desktop connection to a server, and a browser accessing the Home Assistant-hosted server are distinct deployment contexts. Keep where-data-lives and connection status visible. This audit used disposable Node servers and Chromium, not a packaged Electron binary or a Home Assistant appliance.

Read context: AGENTS.md, README, BRAND, GLOSSARY, contributing/setup instructions, PAYDAY-PLANS, FORECASTS, relevant LONG-TERM-FORECAST, HOUSEHOLDS, FILES and START-HERE sections, demo runtime documentation, App.tsx, layout/navigation, tokens and shared controls. Prior UX-REVIEW and AUDIT-2026-11 were historical context only; findings below were checked independently against this commit. Long documents were consulted for relevant sections, not claimed read exhaustively.

## B. Coverage and evidence

### Method

**Visual:** Chromium screenshots at 1440×900 and 390×844, initial populated/empty states, plus 320×844 captures. Light and dark primary-route captures; mobile dark layouts visually compared. Settings sections, all 19 guide articles, core dialogs, account/category/reconcile and report-detail routes have additional captures. Contact sheets are overview aids; original PNGs remain available.

**Interaction:** independent keyboard traversal/dismissal, report save failure, goal deletion failure, dirty-goal dismissal, failed queries, selected tabs/dialogs, saved-report creation, report detail, resizing, and synthetic reconciliation. The real application runs its actual API routes in the demo worker. Failure probes deliberately substitute a 422 response in that tab's fetch wrapper; they do not claim to reproduce a particular real server outage.

**Browser regression journeys:** **176 passed across three runs (36 + 90 + 50); one environment-blocked failure and one subsequent serial test not run.** The failure was the plain-HTTP warning test: the cloud proxy returned “No approved upstream IPv4 address” for `flybudget.test` before Allotment rendered. It is not evidence of an Allotment warning defect. The following lockout test did not run because of that serial failure. See `http-warning-test-failure.png` and `journeys-second.log`. The repository Playwright tests ran against fresh disposable databases and mock bank services. Their desktop default is **1400×900**, distinct from the audit screenshots at 1440×900; phone tests use **390×844**. Test names and results are preserved in `journeys-*.log`. Passing tests establish the named assertions only, not overall intuitiveness. Initial script selector misses (e.g. looking for role=button where the app correctly uses role=tab) were corrected; they are not product findings.

**Responsive:** transactions resized through 320, 360, 390, 640, 767, 768, 900, 1024 and 1440 CSS px without document-level overflow. This does not establish every internal scroller's usability. Phone regression tests additionally check page/main overflow. Browser viewport emulation does not test physical thumb reach, iOS keyboard, safe-area hardware or Electron chrome.

**Accessibility:** sampled keyboard/focus behavior, rendered accessible names/labels through existing tests, DOM semantics, token contrast, reduced-motion styles and reflow. An additional axe-core scan sampled all 21 primary app routes at both viewports; see `axe.json`. The 42 axe-core scans reported zero automatic violations in the sampled states. They left 207 node/rule occurrences requiring manual review (color-contrast: 172, th-has-data-cells: 2, aria-prohibited-attr: 33); occurrences may repeat the same component across routes. These are unresolved checks, not passes, and do not negate the independently reproduced modal keyboard defect. The isolated scan context bypassed CSP solely to inject the scanner; product CSP was not modified. No screen-reader session was performed. Seven sampled token pairs per theme all exceed 4.5:1: light tertiary/surface 5.63:1, dark 6.26:1, primary filled-button text 5.38:1 light and 6.98:1 dark. This is not a complete contrast audit of graphs, images, opacity states or all background combinations. See `contrast-tokens.json`.

### Evidence index

All paths below are relative to [ux-ui-evidence/](ux-ui-evidence/README.md). The evidence README records naming conventions, reproduction and capture limitations.

| Record                                                                                                | What it proves                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `captures.json`, `*-1440-demo.png`, `*-390-demo.png`, `*-320-demo.png`                                | Initial route visits, resolved URLs and document overflow. The original Welcome demo redirects; initial desktop Dashboard was loading. Use corrected files below. |
| `dashboard-*-settled.png`, `welcome-*-empty.png`, `empty.json`                                        | Corrected dashboard and true Welcome; 36 empty-budget route captures on an isolated server.                                                                       |
| `expanded.json`, `settings-*-*.png`, `guide-*-*.png`, `*-dialog-*.png`                                | Settings, guide and dialog exploration. Errors in this discovery log are selector/discovery gaps, not claimed application failures.                               |
| `tabs.json`, `forecast-tab-cash-*`, `tax-tab-assets-*`, `tax-tab-inbox-*`, `receipts-*`               | Corrected tab routes. Ignore the earlier `transactions-tab-receipts-*`: actual query parameter is `view=receipts`.                                                |
| `details.json`, `account-*`, `category-expense-*`, `reconcile-*`, `saved-report-*`, `report-widget-*` | Actual dynamic IDs and detail screens; saved-report creation.                                                                                                     |
| `themes-resize.json`, `*-dark.png`                                                                    | OS colour-scheme response and live resize results.                                                                                                                |
| `defects.json`, `report-save-failure-390.png`, `goal-focus-escape-390.png`                            | Injected report save failure and focus traversal outside a goal dialog.                                                                                           |
| `load-errors.json`, `*-load-error-390.png`                                                            | Failed Goals, Payees, Rules, Files fetches presented as empty states.                                                                                             |
| `delete-failure.json`, `delete-goal-390.png`                                                          | Failed delete closes confirmation without alert; misleading irreversibility copy.                                                                                 |
| `final-probes.json`                                                                                   | Dirty goal loses name on Escape/reopen; focusable chart outline suppression; reduced-motion token values.                                                         |
| `populated.json`, `*-synthetic.png`, `files-flow.json`, `files-*-detail.png`                          | Additional real-server synthetic holdings, instalment purchase, tax claim, household, long-term plan and file-detail states at desktop/mobile/narrow widths.      |
| `report-journey.json`, `report-spending-detail-390.png`                                               | Aggregate row does not drill through; calendar day → account → Back retains the selected day in the sampled journey.                                              |
| `reconciliation.json`, `reconcile-discrepancy-*.png`                                                  | $975 register vs $970 statement, correction preview and resulting $970 balance, isolated data only.                                                               |
| `SURFACES.md`                                                                                         | Source-discovered inline/modal/drawer/menu/form inventory, including secondary surfaces not visible in primary navigation.                                        |
| `journeys-*.log`                                                                                      | Exact named automated checks and results.                                                                                                                         |

### Complete route-family inventory

Codes: **V** = visual review of representative rendered state; **I** = independent interaction; **T** = executed named browser-test coverage; **S** = source inspection. These are not exhaustive-state claims. Initial captures use `route` with slashes replaced by hyphens. “Shared gaps” means the limitations table below applies. Detail screenshots use the explicit names in Evidence.

| Page or surface                      | User purpose / strongest current pattern                                | Desktop reviewed | Mobile reviewed | States reviewed                                                                                                                         | Evidence                                                    | Gaps / proposed direction                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- | ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| /welcome; auth gate                  | Connect or create first account; Up explains read-only access           | V,T              | V,T             | True empty Welcome; manual first account; skip; setup/login/password/session/offline tests                                              | welcome-_-empty; auth-setup-_; auth tests                   | Actual Electron picker and HA host remain untested                                                                           |
| / → /dashboard                       | Understand spendable position and next bills; useful ordered onboarding | V,T              | V,T             | Populated, empty, loading, light/dark, customise controls in source                                                                     | dashboard-_-settled; dashboard-_-empty                      | Full custom-widget permutation review outstanding; preserve savings exclusion                                                |
| /budget                              | Assign received money and cover overspending; preview safeguards        | V,T              | V,T             | Empty/populated; assignment/refused save/month loading; overspending; hold; payday preview/apply/undo                                   | budget-*; budget/payday tests                               | AU-002; full keyboard matrix for every funding method outstanding                                                            |
| /budget/year; /budget/year/:year     | Compare monthly plan and actuals; future months clearly marked          | V,T              | V               | Current and future year, populated/empty, month navigation                                                                              | budget-year-_; budget-year-2027-_                           | AU-011; narrow horizontal comparison needs focused user validation                                                           |
| /budget/category/:id                 | Explain one envelope and set target; related transactions visible       | V,T              | V,T             | Income and expense details; category goal funding; targets represented in source                                                        | detail---budget-category-_; category-expense-_              | All target types/date boundary combinations not interactively exhausted                                                      |
| /accounts                            | Understand balances and account boundary; type grouping                 | V,T              | V,T             | Empty/populated; add/edit/close/value update; invalid amount                                                                            | accounts-*; accounts tests                                  | All account types in every currency not visually exhausted                                                                   |
| /accounts/:id                        | Review one account; contextual name and reconciliation action           | V,T              | V,T             | Register, edit, import entry point, long name, filtered views via tests                                                                 | account-*; phone tests                                      | CSV mapping variants need dedicated import check                                                                             |
| /accounts/:id/reconcile              | Match statement and resolve discrepancy; correction consequence shown   | V,I,T            | V,I             | Statement entry; discrepancy preview at 1440/390/320; applied correction; undo/unlock tests                                             | reconcile-*; reconciliation.json; recover tests             | No live-bank comparison; physical keyboard behavior untested                                                                 |
| /transactions                        | Review, categorise, split, search and bulk edit                         | V,T              | V,T             | Empty/populated; add and split; receipt tab; phone card/edit; filters through flows                                                     | transactions-_; receipts-_; phone-native tests              | Dense histories, transfer linking and deduplication tested; CSV/YNAB mapping permutations not exhausted                      |
| /household                           | Track shared obligations; explicit split and pool boundaries            | V,T              | V,I,T           | Empty creation; sharing, pool bills, corrections, settlement, activity and switch/default tests                                         | household-*; household tests                                | Synthetic household created and reviewed at 1440/390/320; populated shared-money interactions covered by named desktop tests |
| /payment-plans                       | Track instalment purchases without duplicate spending                   | V,T              | V               | Setup empty; synthetic purchase with instalment schedule; setup/add/matching/earlier-payment tests                                      | payment-plans-_; payment-plans-_-synthetic; third-run tests | Refund/fee variation and provider-specific unusual schedules not exhausted                                                   |
| /recurring                           | See due bills/income, match or create schedules                         | V,I,T            | V,I,T           | Monthly; All recurring; add form; matching banner; phone cards                                                                          | recurring-_; recurring-All-recurring-_                      | Every frequency/approximate/end-date combination not exhausted                                                               |
| /cash-flow                           | Explain historical money in/out; list alternative to diagram            | V,T              | V,T             | Populated/empty; category/payee drill; mobile list/diagram                                                                              | cash-flow-*; planning and phone-native tests                | Chart keyboard/data equivalence requires full assistive-tech check                                                           |
| /reports                             | Compose dashboards and inspect totals; explicit date ranges             | V,I,T            | V,I,T           | Overview/year review; dashboard create; frozen date picker; empty/populated                                                             | reports-_; reports-year-_; reports tests                    | All widget types and layouts not visually exhausted                                                                          |
| /reports/custom; /reports/custom/:id | Build, save and reopen a report                                         | V,T              | V,I             | New/saved; grouping/table/date choices; injected failed save                                                                            | reports-custom-_; saved-report-_; defects.json              | AU-005/AU-007; slow-save duplicate behavior not load-tested                                                                  |
| /reports/widget/:id                  | Inspect one widget and underlying data                                  | V,I              | V,I             | Net-worth detail; date context; populated values                                                                                        | report-widget-*                                             | AU-008; other widget-specific drill paths covered only where tests name them                                                 |
| /payees                              | Organise payees and defaults; phone cards expose actions                | V,S              | V,T             | Populated/empty/load failure; defaults; phone edit/menu                                                                                 | payees-*; load-errors.json                                  | AU-004; merge and bulk edge cases not exhausted                                                                              |
| /rules                               | Automate sorting; readable conditions and precedence explanation        | V,I              | V,I,T           | Populated/empty/load failure; creation dialog; phone enable/reorder/delete                                                              | rules-*; load-errors.json                                   | AU-004; every condition/action permutation untested                                                                          |
| /settings                            | Manage configuration and storage; URL-addressable sections              | V,I,T            | V,I,T           | Ten sections; preferences/themes; server security/backup tests                                                                          | settings-_-_                                                | AU-010/AU-012; provider-specific external connections excluded                                                               |
| /goals                               | Understand progress and fund category targets                           | V,T              | V,I,T           | Manual/category progress; create/cancel; focus; refused delete; load failure                                                            | goals-*; defects.json; final-probes.json                    | AU-001/004/006/007/009/013                                                                                                   |
| /forecast                            | Compare long-term plans and near-term cash runway                       | V,I,T            | V,I,T           | Long-term first use and saved plan; events/drafts/comparison tests; cash runway/scenarios; overdue warning; read-only ledger assertions | forecast-_; forecast-tab-cash-_                             | Named event/editor flows exercised; every possible scenario combination not exhausted                                        |
| /investments                         | Record holdings separately from ledger balances                         | V,I,T            | V,I             | Empty holdings; synthetic priced holding; security/holding/price/purchase/record-value test                                             | investments-*                                               | Historical-price/currency combinations not exhaustive; preserve explicit unknown price/cost                                  |
| /tax                                 | Record deductions and receipts; scope is Australian record keeping      | V,I,T            | V,I             | Empty and synthetic claim; receipt attach/match; depreciation method, low-value pool and lodged-year locks tested                       | tax-_; tax-tab-_                                            | All tax return labels and multi-year combinations not exhausted; not tax-calculation certification                           |
| /files                               | Store/find/link documents; removal semantics explained                  | V,I,T            | V,I             | Empty/load failure; upload/detail at 1440/390/320; link/search/backup restore tests                                                     | files-*; files tests                                        | Storage-cap refusal and every file renderer/size not exhausted                                                               |
| /review                              | Resolve the highest-priority budget issues; action order                | V,T              | V,T             | Empty/populated; resolve uncategorised/overspent items; completion                                                                      | review-*; review tests                                      | Good model to reuse for actionable error recovery                                                                            |
| /guide; /guide/:page                 | Explain concepts in local, offline-friendly help                        | V,S              | V,S             | Index and all 19 article routes; desktop/mobile captures and rendered text                                                              | guide-*                                                     | AU-013; external provider setup not executed                                                                                 |

All routes in `client/src/App.tsx` are represented above, including `/` redirect, optional annual year, report creation/editing and widget detail. There is no separate router path for authentication: AuthGate selects that surface. Do not count `/welcome` on the populated demo as Welcome coverage.

### Secondary surfaces and state inventory

| Page or surface                                                                                                                                                                                                                   | User purpose                           | Desktop reviewed               | Mobile reviewed                | States reviewed                                                                                 | Evidence                                                                | Gaps                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Settings: Categories, Accounts, Budget, Tags, Connected banks, Currencies, Priorities, Data, Preferences, Server                                                                                                                  | Configuration tasks                    | V/S all 10; T selected         | V/S all 10; T selected         | Default sections; populated/empty; theme; server session/password/data workflows in named tests | settings-{section}-{width}; Settings.tsx                                | Nested category/tag forms, every preference mutation and exchange-rate error not all exercised |
| Guide: getting-started, bank-sync, enable-banking, accounts, transactions, budgeting, move-money, payday-plans, card-payments, recurring, review, rules, goals, long-term-forecast, reports, tax, currencies, households, backups | Explain task and next step             | V/S each                       | V/S each                       | Article content and local links; index                                                          | guide-{slug}-{width}; articles.tsx                                      | No real provider login or physical offline-device test                                         |
| Navigation rail/drawer, More features, Help, hide balances                                                                                                                                                                        | Orient and reveal optional tasks       | S/T                            | V/T                            | Open/close/backdrop/Escape; short drawer; active links; source-persisted groups                 | Sidebar.tsx, AppShell.tsx; phone tests                                  | Full screen-reader reading order not tested                                                    |
| Goal/account/transaction/recurring/rule/security dialogs                                                                                                                                                                          | Create/edit a record                   | V/I representative; T selected | V/I representative; T selected | Initial values, cancel, errors selected, save selected                                          | _-dialog-_; defects.json; tests                                         | Shared focus defect applies; every field variation not exhausted                               |
| Row menus/context menus; date/month pickers; category selection                                                                                                                                                                   | Choose local action                    | S/T                            | V/T                            | Keyboard menu patterns in source; phone actions; nested picker Escape test                      | RowMenu.tsx, ContextMenu.tsx, MonthRangePicker.tsx; reports/phone tests | Every nested submenu focus path not manually traversed                                         |
| Assignment/hold/move/auto-assign/payday/funding history                                                                                                                                                                           | Make budget changes with preview       | T/S                            | T/S                            | Apply, refuse stale preview, undo, overspending correction                                      | budget/payday/review logs                                               | All funding strategies and insufficient-funds combinations not exhausted                       |
| Transaction details, bulk actions, import, transfer, split, receipt editor                                                                                                                                                        | Review and change ledger records       | S/T selected                   | V/T selected                   | Split/add, category edits, locked reconciliation, file linking                                  | transactions components; phone/recover/files tests                      | CSV/YNAB permutations and bulk failure subsets remain source-only                              |
| Forecast tabs/scenario controls; recurring monthly/all; tax deductions/assets/inbox; reports dashboard/widget/builder                                                                                                             | Change work context                    | V/I                            | V/I                            | Corrected URL tabs and snapshots                                                                | tabs.json, details.json                                                 | Not every simulation/event combination exercised                                               |
| ConfirmModal / UndoToast                                                                                                                                                                                                          | Commit and recover destructive actions | S                              | I/S                            | Goal delete refused; confirmation copy; timer source                                            | delete-failure.json; ConfirmModal.tsx; UndoToast.tsx                    | Other callers need regression matrix after shared change                                       |

The companion [surface register](ux-ui-evidence/SURFACES.md) lists every discovered JSX modal/drawer/popover/menu/form instance with source line. It is a discovery checklist, not a blanket “tested” mark. A state not named above or in a test log remains unverified.

### End-to-end journeys and transitions

| Journey                                     | What was actually checked                                                                                                                            | Result / remaining distinction                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| First launch → setup → first useful budget  | Server setup code/password, Welcome manual account/skip, onboarding checklist and income assignment, across named tests                              | Passed parts of the full chain on disposable databases; actual native desktop picker/HA appliance remain deployment gaps |
| Connect/import → review → categorise        | Mock Up invalid token, account import/resync/disconnect, source review, round-up choice; Review categorisation; transfers/import deduplication tests | Passed; no real bank connection. External provider login intentionally excluded                                          |
| Receive income → assign → explain remainder | Budget income/off-budget exclusion; monthly allocation; payday received deposits/preview/apply/history/undo                                          | Passed amount/state assertions. User comprehension still needs focused research                                          |
| Overspend → move money → verify             | Amount editor and auto-assign cover overspending; Review agrees with budget; refused amount stays editable                                           | Passed; preserve preview and explicit month context                                                                      |
| Plan bills/payday → cash flow/forecast      | Recurring creation/paid/paused/cancelled/discovery; cash-flow payee drill; payday and both forecast flows                                            | Passed named assertions; forecast write isolation and scenario assumptions preserved                                     |
| Goal → fund → progress                      | Category goal links to category/register, allocation-derived progress, manual compatibility; independent create/dismiss                              | Funding tests passed; AU-007 loses unsaved draft; AU-013 guide description is inconsistent                               |
| Reconcile → resolve discrepancy             | Independent $975 register/$970 statement at 1440/390/320, $5 adjustment preview/application; unlock/undo-reconciliation tests                        | Resulting account $970 verified; long labels reflowed; no real bank statement used                                       |
| Reports → underlying transactions → return  | Calendar Nov 6 → account → Back, selected Nov 6 retained; Cash flow → filtered register; spending-category row click                                 | Calendar sample preserved day; cash-flow drill passed. Spending aggregate row has no drill action (AU-014)               |
| Household/private budget context            | Household create/default/switch/edit/share/settle/correction tests; multi-user invitations, isolated budgets and same-browser tab takeover           | Passed named tests; sharing household entries is not granting access to a private budget                                 |
| Edit → cancel → failure recovery            | Invalid amount stays; delayed budget save doesn't close newer editor; offline retry; independent report/delete/query refusal                         | Budget and offline patterns passed. AU-004/005/006/007 identify uneven handling elsewhere                                |

### Remaining gaps and what resolves them

| Gap                                                                | Status / reason                                                        | Required next evidence                                                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packaged Electron, native picker/titlebar/update/download behavior | Not available in this browser run; deployment-specific                 | Disposable packaged desktop profile on supported OS; keyboard/window sizing and remote-server connection                                                 |
| Actual Home Assistant host and phone safe areas/keyboard           | No appliance or physical device used                                   | Throwaway HA install and iOS/Android browser; keyboard-open forms, home indicator, orientation                                                           |
| Screen readers, OS high contrast and native zoom                   | Not performed; DOM checks are not a substitute                         | VoiceOver/Safari and NVDA/Chrome task walkthrough; 200%/400% actual zoom                                                                                 |
| Live bank authentication                                           | Intentionally excluded by task                                         | Continue with repository mock provider; real credentials are not needed for this audit                                                                   |
| Unusual feature combinations beyond named flows                    | Representative populated scenarios now reviewed; not every combination | Use third-run test names and populated.json to avoid repeating completed work; target currencies, large histories, uncommon schedules and file renderers |
| Every nested form/error permutation                                | Source inventory retained; not exhaustively exercised                  | Use SURFACES.md as follow-up matrix; prioritise money-changing and destructive forms first                                                               |
| Usability interpretation of mobile composition                     | Design hypothesis, not a technical blocker                             | Focused novice assignment and report-reading tasks; record errors and explanation accuracy, not opinions about prettiness                                |

## C. Strong patterns to preserve

1. **The identity already works.** Keep Soil `#262520`, Canvas `#F7F5EF`, Marigold `#F46B35` and Sprout `#1B7550`; preserve the darker light-theme filled-action colour and brighter dark-theme adaptation. Token contrast sampling supports these choices.
2. **Money previews and context.** Payday preview/apply once, stale-preview refusal, account scope and reconciliation correction explanation protect financial understanding. Preserve the distinction between moving envelopes and bank transfers.
3. **Intentional phone patterns.** Transaction cards, category amount sheets, 44px primary controls, mobile navigation drawer and cash-flow list mode passed their named phone checks. Do not replace these with horizontally scrolling desktop tables.
4. **Actionable empty states.** EmptyState, the first-budget checklist and Review's ordered next actions help people begin. Fix query-state discrimination rather than discarding these designs.
5. **Undo and reconciliation recovery.** Existing undo hooks, unlock warnings and undo-reconciliation checks are useful. Align confirmation copy and feedback with actual reversibility.
6. **Local help and plain language.** Sentence case, local guide links, one name for Ready to assign and common formatters reduce interpretation. Correct the small documentation drift instead of writing a separate vocabulary.
7. **Purposeful motion.** Current 160ms dialog, 220ms sheet and 120ms exits explain arrival/dismissal; reduced motion replaces spatial movement with 150ms fades. Keep this restraint.

## D. Proposed Allotment design contract

| Area                | Reusable rule                                                                                                                                                                                                                                                               | Owner / justified exception                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Page structure      | One h1; purpose/context and primary action in a predictable header; 24px desktop and 16px phone side gutters. Keep related period/filter controls beside the work area.                                                                                                     | PageHeader.tsx plus page callers. Budget may display the month while its accessible h1 includes “Budget”.                                |
| Navigation          | Active location remains visible; detail back restores originating budget/month/filter/scroll. Direct-entry fallback goes to the parent. Do not silently switch budget context.                                                                                              | AppShell, Sidebar, transaction filter/date-range helpers. A security sign-out intentionally clears private state.                        |
| Spacing/type        | Keep existing 4px rhythm, Inter and 28px desktop/24px mobile title scale. Use 16px mobile text inputs; avoid ad hoc compressed labels to fit controls.                                                                                                                      | index.css, Input, Button, PageHeader. Dense desktop registers may use smaller secondary metadata.                                        |
| Colour              | Brand means action/selection; green/red/caution have semantic meanings accompanied by words/icons. Zero does not imply trouble. Keep comparable series stable across pages.                                                                                                 | Semantic tokens, chartColors and formatter helpers. Category identity colours are not success/error.                                     |
| Financial numbers   | Never split an amount inside its digits. Use shared minor-unit formatting, tabular figures, explicit currency/account scope; wrap the card/grid first. Label actual, planned and projected data.                                                                            | StatCard, ChartHelpers, BuiltinReport, currency.ts. Compact chart axis labels may abbreviate when the full value is accessible nearby.   |
| Forms               | Visible label, optional/help text, linked field error; retain entered values on failure. Explicit Save/Cancel for multi-field work. Pending disables duplicate submit and says what is happening. Dirty passive dismissal preserves a draft or offers Keep editing/Discard. | Modal/form state helpers; CurrencyInput and AmountFields. Single reversible toggles may autosave with status and undo.                   |
| Choice controls     | Use links for navigation; tablist/selected panel for local tab views; radiogroup for mutually exclusive settings. Provide correct arrow-key behavior, not only a role attribute.                                                                                            | tabList.ts and shared choice control. Settings can remain URL-based navigation if rendered as links with aria-current.                   |
| Tables/lists        | Desktop keeps column alignment; mobile prioritises identity, amount, date and actionable status. Put search/filter/reset together, preserve state in deep links. Row navigation and selection must be distinguishable.                                                      | Register/card components; ScrollCue. Annual cross-month comparison can retain a table if month jump and scroll orientation are provided. |
| Surface choice      | Page for long, resumable or deep-linked work; dialog/sheet for one bounded decision; popover for short choices; inline editor for one reversible amount.                                                                                                                    | Modal, RowMenu, ContextMenu. Do not turn complex tax/forecast setup into an ever-taller modal.                                           |
| Query states        | Distinguish initial loading, successful empty, no matches, stale cached data and failure. Failed amounts are unknown, not zero. Show retry and age of last successful data.                                                                                                 | New shared QueryState wrapper integrated with existing connection/offline infrastructure. Preserve existing data during refetch.         |
| Mutation states     | Idle → pending → success or failure. Close on confirmed success, announce result, offer Undo only if it really restores the action. Failure remains actionable at the point of action.                                                                                      | ConfirmModal, SaveReportModal, useCanSave/SavingPausedHint. Offline new-transaction queue must retain its explicit local-pending state.  |
| Modal accessibility | Move focus in, contain it, make background inert, close only topmost surface, restore to opener/logical successor. A visible focus indicator survives all states.                                                                                                           | Modal and nested popovers. Existing mobile sidebar inert/focus pattern is a useful reference, not a drop-in trap.                        |
| Motion              | Reuse current timings/easing; animate entry/exit, expansion and context changes only. No rolling currency digits, celebratory delay or mandatory animation before action. Reduced motion removes translation/scale and nonessential loops.                                  | index.css tokens, Modal EXIT_MS; chart/loading libraries must be checked separately.                                                     |
| Voice               | Warm and precise: name what changed, what did not, and the next step. “Available in Groceries” is more useful than an unlabeled total. Dates obey preference; forecasts say assumptions rather than certainty.                                                              | BRAND/GLOSSARY, shared currency/date helpers, guide articles. Tax/legal boundaries can be explicit without dominating the main task.     |

## E. Findings

Priority uses the requested task definitions: P0 critical-task/serious financial risk; P1 common-task confusion or accessibility barrier; P2 meaningful usability/consistency; P3 minor refinement. Effort is a design/engineering planning estimate: S ≈ 0.5–2 days, M ≈ 2–5 days, L ≈ 1–2 weeks including focused regression checks; not a delivery commitment. Confidence refers to the evidence, not measured impact.

Abbreviated source paths in findings are relative to `client/src/`; server paths are stated explicitly.

### Systemic issues

### AU-001 — Modal focus escapes and is not restored

**P1 · Accessibility · Shared · Effort M · Confidence High.**

**Status: fixed in 0.2.0-up.134, except focus after a deleted row.** `components/ui/Modal.tsx` now handles focus for every dialog:

- It remembers the opener and focuses the dialog, unless a field's autoFocus already has focus.
- Tab and Shift+Tab stay inside the dialog. Pickers the dialog opens in their own portal keep their own Tab order.
- `#root` is inert while a dialog is open, through `utils/inertRoot.ts`, which GuideTour shares.
- A stack of open dialogs lets only the top one answer Escape and Tab; a dialog underneath is `inert`.
- On close, focus goes back to the opener.

`RowMenu` puts focus back on its ⋮ button before running an item, so a dialog opened from a menu returns there. Toasts render on `<body>`, so they stay announced while the app is inert.

Test: `e2e/tests/dialog-focus.spec.ts`, at desktop and phone sizes. Each case fails without the change. Still open:

- After a successful deletion, focus should move to the next row; it goes with AU-006, where the confirmation knows the delete succeeded.
- Screen-reader and hardware-keyboard checks.

- **Reproduce / state:** Goals → Add goal, 390×844, keyboard; repeat with Tab through fields, icon/colour choices and Cancel, then Escape.
- **Evidence / source:** `defects.json` and `expanded.json` record focus leaving the dialog for BODY and remaining there after Escape; `goal-focus-escape-390.png`. `client/src/components/ui/Modal.tsx:58` handles Escape but no focus containment/restoration; GoalFormModal provides its own initial autofocus.
- **Current → impact:** Initial autofocus works for this form, but Tab leaves a surface announced as aria-modal. Closing loses the opener. Keyboard and assistive-technology users can lose task context.
- **Proposed after:** Move focus ownership into Modal: save opener, choose initial field/heading, make background inert, contain forward/reverse traversal, restore on close. Keep the existing mobile sheet and exit continuity.
- **Why:** Protects orientation and makes the declared modal semantics true.
- **Dependencies:** Nested month/category/icon popovers and disappearing row openers must be covered.
- **Acceptance:** At 1440 and 390, Tab/Shift+Tab never reach background controls; topmost Escape closes once; visible focus returns to opener or logical successor after exit; validate with screen reader and mobile hardware keyboard.

### AU-004 — Failed reads masquerade as empty features

**P1 · Usability / financial confidence · Shared · Effort M · Confidence High.**

**Status: fixed in 0.2.0-up.136 for the four reproduced pages.** `components/ui/QueryProblem.tsx` takes a react-query result and handles two cases:

- **Nothing loaded:** a `role="alert"` panel says "Couldn't load your …", gives the error's message (safe to show, from `api/client.ts`) and "Nothing has been changed", and offers **Retry** (`refetch`).
- **Earlier data still showing:** a `role="status"` notice above the data says it is what was loaded earlier, with **Retry**.

`loadFailed(query)` lets a page show the panel instead of its empty state. Goals, Payees, Rules and Files use both. Totals and counts render only with data.

Test: `e2e/tests/load-errors.spec.ts`, which runs each page with its list request refused, then retries, plus a failed refresh on Goals. It fails without the change. Still open: other pages that default a failed query to `[]`, which are suspected but not yet reproduced. Move them over as they're found.

- **Reproduce / state:** Start on Guide in a populated demo; reject GET for Goals, Payees, Rules or Files with a 422 JSON error, then navigate to that page and wait for retry. Tested at 390×844.
- **Evidence / source:** `load-errors.json`, `goals-load-error-390.png`, `payees-load-error-390.png`, `rules-load-error-390.png`, `files-load-error-390.png`; `pages/Goals.tsx:284`, `Payees.tsx:84`, `Rules.tsx:217`, `Files.tsx:158` default query data without a rendered query error.
- **Current → impact:** A failed Goals read says “Save for what matters”; Payees says “No payees yet”; Rules offers the first rule; Files says “No files yet”. These imply absent data rather than unavailable data.
- **Proposed after:** Introduce shared query-state handling: initial skeleton → data or genuine empty; failure without cache → “Couldn’t load your goals” + Retry; stale cache → retained data labelled last updated with retry. Do not substitute financial zero.
- **Why:** Prevents mistaken belief that data disappeared and unnecessary re-entry.
- **Dependencies:** Integrate with connection store/offline cache; audit other default-array queries as suspected, not yet reproduced, instances.
- **Acceptance:** Both sizes and themes: injected 422/500/offline distinguish failure from successful []; retry restores existing records without duplicate creation; cached figures remain explicitly stale; error is announced and retry keyboard reachable.

### AU-005 — Report saving has no pending or failure state

**P1 · Usability · Local pattern with shared remedy · Effort S–M · Confidence High.**

**Status: fixed in 0.2.0-up.135.** `SaveReportModal` awaits `onSave` (`CustomReportBuilder` passes `mutateAsync`). The button shows **Saving…** and is disabled while saving. The dialog closes only once the save succeeds; on failure it shows the reason (`role="alert"`) and keeps the name. Cancel and Escape are ignored while saving. Test: `e2e/tests/confirm-and-save.spec.ts`, where a refused save is retried once successfully. It fails without the change.

- **Reproduce / state:** Reports → Custom report → Save → name it → submit with POST /custom-reports returning 422.
- **Evidence / source:** `report-save-failure-390.png`, `defects.json`: injected=true, dialog text remains “Save report / Report name / Cancel / Save”, no alerts. `pages/CustomReportBuilder.tsx:68`; `components/reports/SaveReportModal.tsx:5`; `main.tsx:27` supplies success invalidation, not global error feedback.
- **Current → impact:** The dialog appears unchanged after refusal; no explanation or recovery. Save has no isPending prop, so repeated activation remains possible. Duplicate creation under slow requests is a source-supported risk, not a measured outcome.
- **Proposed after:** Pass pending/error into SaveReportModal. Show “Saving…” and disable duplicate submit; on failure keep name/config and display inline alert with retry; close only on success and announce saved report name. Apply same convention to Update.
- **Why:** Makes progress/outcome understandable and preserves work.
- **Dependencies:** Respect useCanSave/offline rules; maintain existing saved-report undo and dashboard insertion behavior.
- **Acceptance:** At desktop/mobile: delay request, activate twice and observe one submission; reject it and retain all fields; retry succeeds once; success names result; editing a saved report keeps its correct name.

### AU-006 — Confirmation dismisses before a destructive action succeeds

**P1 · Usability / consistency · Shared · Effort M · Confidence High.**

**Status: fixed in 0.2.0-up.135 for callers that return a promise.** When `onConfirm` returns a promise, `ConfirmModal` waits for it:

- It shows `pendingLabel` and blocks a repeat press and closing while the action runs.
- It closes once the action succeeds.
- If the action fails, it stays open with the error message, which `api/client.ts` makes safe to show.

Callers that return nothing close straight away, as before. These callers now return a promise:

- Goals, Payees and Rules (`mutateAsync`)
- Up and SimpleFIN disconnect, and file delete, which already returned one

The other callers still use `mutate` and can move over one at a time. Test: `e2e/tests/confirm-and-save.spec.ts`, covering a refused goal delete with a retry, and a slow payee delete on a phone that is sent once. It fails without the change. Still open: moving focus to the next row after a successful deletion (left over from AU-001).

- **Reproduce / state:** Goals → first Actions → Delete goal → Delete while DELETE /goals/:id returns 422; 390×844.
- **Evidence / source:** `delete-failure.json`: dialogs=0, alerts=[], goal still present; `delete-goal-390.png`. `components/ui/ConfirmModal.tsx:39` invokes onConfirm then onClose synchronously; Goals.tsx:452 passes mutate. Other callers include Payees and Rules.
- **Current → impact:** A refusal closes the decision surface without explaining why the item remains. Closing implies completion that never happened.
- **Proposed after:** Make confirmation async-aware, or have the caller control completion. Show Deleting…, prevent repeat, retain dialog with error on refusal, close and announce only after success. Keep action-specific preview/counts for financial bulk changes.
- **Why:** Prevents false completion and makes recovery direct.
- **Dependencies:** Audit all ConfirmModal callers; do not replace the richer BulkDeleteModal preview with a generic prompt.
- **Acceptance:** Both sizes: slow/delete-failure/success paths show distinct outcomes; failure retains entity/name and retry; successful removal restores focus to next row; no duplicate request.

### AU-007 — Passive dismissal silently discards multi-field work

**P2 · Usability · Shared convention; reproduced locally · Effort M · Confidence High for goal; medium for other callers.**

**Status: fixed in 0.2.0-up.137 for the goal form and the report builder's Back link.** The shared parts:

- `ui/Modal` takes `dirty`. Escape, a backdrop click or ✕ then show `ui/DiscardPrompt`, "Discard your changes?", with **Keep editing** focused and **Discard**. Escape on the prompt keeps editing. A clean form closes in one step, and the form's own Cancel and Save are unchanged.
- `GoalFormModal` compares its fields with what it opened with.
- `CustomReportBuilder` compares its settings with those last loaded or saved. Its Back link asks "Leave without saving this report?", and `beforeunload` covers closing the tab.

Test: `e2e/tests/unsaved-drafts.spec.ts`, at desktop and 390 px, including a saved and a reopened report that must not ask. It fails without the change. Still open:

- Sidebar links and the saved-reports list don't ask. The app uses `BrowserRouter`/`HashRouter`, not a data router, so react-router's `useBlocker` isn't available.
- Other multi-field dialogs can pass `dirty` as they're found.

- **Reproduce / state:** Goals → Add goal → enter “Unsaved audit goal” → Escape → reopen. Also inspect custom-report Back behavior.
- **Evidence / source:** `final-probes.json`: dirtyDismiss=0 dialogs, reopenedName="". `GoalFormModal.tsx:117`, `Modal.tsx:62`/backdrop; `pages/CustomReportBuilder.tsx:117` navigates back without dirty protection.
- **Current → impact:** Goal draft is lost with one Escape; custom report settings are local state until Save. Accidental dismissal costs work, particularly on long mobile forms.
- **Proposed after:** Track meaningful dirty state. Clean close remains immediate. For dirty Escape/backdrop/navigation offer Keep editing / Discard changes, or preserve a clearly labelled local draft. Explicit Cancel may use the same clear discard convention. Never submit on dismissal.
- **Why:** Protects user effort without confirmation noise on untouched forms.
- **Dependencies:** Define defaults versus meaningful edits; nested popover Escape must not open discard prompt for the outer form.
- **Acceptance:** Desktop/mobile: untouched dismissal one step; dirty name/amount retained after Keep editing; discard resets; browser/app Back handled deliberately; successful save clears dirty state; no stale draft when editing a different record.

### AU-008 — Financial amounts break inside their digits

**P1 · Usability / financial readability · Shared · Effort S–M · Confidence High.**

**Status: fixed in 0.2.0-up.133.** Summary tiles now use one layout, `StatGrid` (`components/ui/StatCard.tsx`), wherever they appear: `StatCard`, `StatCardRow` (default and hero, which covers long-term forecast, cash runway, cash flow, goals, tax and investments), report detail, dashboard `SummaryStats` and the reports Summary widget. Values are `whitespace-nowrap`. Each tile is at least as wide as its unbroken value, so a tile that can't fit beside another takes a row of its own; nothing is clipped or shrunk. Test: `e2e/tests/phone/amounts-phone.spec.ts` checks every dollar amount on Reports, net-worth detail and Dashboard at 320 and 390 px, with $1.4M and −$1.2M balances. It fails without the fix. Still open: actual browser zoom and long currency codes.

- **Reproduce / state:** Open net-worth report widget detail at 390×844 with the demo’s A$165,905.18 balance; inspect summary tiles. Also inspect the synthetic long-term forecast at 390px: its large negative end-age value separates its sign and overruns the intended card.
- **Evidence / source:** `report-widget-390.png` displays final “8” on a second line; `components/ui/StatCard.tsx:26` uses break-words; `components/reports/ReportDetail.tsx:224` fixes two columns. Related `forecast-390-synthetic.png` reproduces large-negative-value stress in `components/longterm/LongTermForecast.tsx:534` → ChartHelpers StatCardRow; BuiltinReport.tsx:106 also requires stress checks.
- **Current → impact:** The amount ceases to read as one number. Similar large balances, negative signs and currency prefixes can be misread even though document overflow is zero.
- **Proposed after:** Set whole-value no-wrap; let tiles switch to one column when an exact value cannot fit. Use an appropriate minimum track width/container rule, not arbitrary clipping or smaller and smaller text. Preserve exact value; abbreviate only axes with full-value access.
- **Why:** Protects the primary information rather than the grid shape.
- **Dependencies:** Shared StatCard change needs report, forecast, goal and dashboard regression at large amounts and multiple currencies.
- **Acceptance:** 1440, 390 and 320: A$165,905.18, -A$1,234,567.89 and long currency codes remain intact and visible; no ellipsis or digit wrap; zoom reflows cards; smaller dashboard summary test remains green.

### AU-003 — Charts suppress the shared focus indicator

**P1 · Accessibility · Shared · Effort S–M · Confidence High source/DOM; visual indicator coverage incomplete.**

**Status: fixed in 0.2.0-up.132.** The blanket rule now applies only to focus that isn't keyboard focus (`:focus:not(:focus-visible)`), so keyboard focus on a chart shows the shared ring and a click or tap shows none. Test: `e2e/tests/accessibility.spec.ts` ("a chart shows the keyboard focus ring"). Still open: the per-chart screen-reader check in the acceptance criteria.

- **Reproduce / state:** Dashboard → keyboard-focus the chart surface; inspect chart focus styles.
- **Evidence / source:** `final-probes.json` shows focusable SVG role=application/tabindex=0 with outline:none; `client/src/index.css:344` removes outlines on chart wrapper/surface/all descendants. Dashboard screenshots provide context; no full screen-reader chart test was performed.
- **Current → impact:** The global focus style is overridden throughout charts. This creates an orientation risk wherever the library does not provide an equally visible alternative.
- **Proposed after:** Remove blanket descendant suppression. Explicitly style :focus-visible on focusable chart surfaces/controls; avoid decorative tab stops; retain textual tables/detail views and keyboard-accessible values.
- **Why:** Makes keyboard location visible without adding mouse-only decoration.
- **Dependencies:** Check Recharts tooltip/highlight behavior before concluding every chart has no indicator; classify each implementation.
- **Acceptance:** Both themes/sizes: every tab stop has a persistent visible indicator, values accessible without hover or colour; screen-reader task can reach equivalent data; no decorative shape focus spam.

### AU-009 — Delete-goal copy contradicts available Undo

**P2 · Content consistency · Local plus confirmation-copy sweep · Effort S · Confidence High.**

**Status: fixed in 0.2.0-up.132.** Verified what `recreateGoal` restores: undo makes a new goal, so file links (removed by cascade) are not restored and the goal comes back active. The confirmation (`utils/deleteGoalMessage.ts`) now says this. Deleting a goal shows an Undo toast, so undo is reachable on a phone. Tests: `deleteGoalMessage.test.ts` and `e2e/tests/category-goals.spec.ts`. Failed deletion still follows AU-006.

- **Reproduce / state:** Goals → Actions → Delete goal. Compare dialog promise with useDeleteGoal implementation.
- **Evidence / source:** `delete-goal-390.png` says “This cannot be undone”; `pages/Goals.tsx:456`; `hooks/useGoals.ts` useDeleteGoal pushes recreateGoal undo/redo after successful deletion.
- **Current → impact:** A reversible goal deletion is described as irreversible. Users cannot develop a reliable expectation of recovery.
- **Proposed after:** After verifying exactly what recreateGoal restores (including links), state the accurate scope: “Delete this goal? You can undo this until …” only if that lifetime is guaranteed. If restoration is partial, name the limitation instead of a blanket promise.
- **Why:** Aligns consequence language with behavior; avoids warning fatigue.
- **Dependencies:** Verify linked file/status restoration and undo lifetime before choosing copy; leave genuinely irreversible bulk-ledger deletion warnings intact.
- **Acceptance:** At both sizes, success offers working Undo; restored goal matches promised fields/links; confirmation describes any exceptions; failed deletion follows AU-006.

### AU-010 — Local-view controls use inconsistent selection semantics

**P2 · Accessibility / consistency · Shared · Effort M · Confidence High source; keyboard validation incomplete.**

**Status: fixed in 0.2.0-up.138.** One shared `components/ui/TabList.tsx` now gives Recurring, Forecast, Tax and Transactions their tab list, and Settings uses the same pattern through `ScrollCue`: `role="tablist"`, `role="tab"`, `aria-selected`, a roving `tabIndex`, and `components/ui/tabList.ts` `onTabListKeyDown` for the arrow keys, Home and End. Settings, inside `ScrollCue` through its `scrollerProps`, keeps its URL `?tab=` (with `replace`). Recurring, Settings and Forecast label their content `role="tabpanel"`, using `tabIds()` from the same file. Test: `e2e/tests/tabs.spec.ts`, at desktop and 390 px; it fails without the change. Existing tests now find these controls as tabs. The shared `TabList` also cleared four `interactive-supports-focus` lint warnings (the cap is now 152). Still open: Tax and Transactions' panels aren't labelled yet. A screen-reader walkthrough was not done.

- **Reproduce / state:** Compare Recurring Monthly/All recurring, Settings sections and Forecast tabs.
- **Evidence / source:** `pages/RecurringTransactions.tsx:104` styles buttons without the tab semantics used by Forecast.tsx:35; Settings.tsx:79 uses aria-current on buttons. Captures recurring-390-demo/settings-390-demo/forecast-390-demo show similar visual tab treatments.
- **Current → impact:** Visually similar controls communicate different selection/navigation models. A styled underline alone is insufficient for assistive technology.
- **Proposed after:** Use one local TabList with selected state, labelled panel and arrow-key handling. For Settings URL sections, either real links with aria-current or an explicitly implemented tab model. Do not add roles without keyboard behavior.
- **Why:** Predictable operation and announced state reduce relearning.
- **Dependencies:** Preserve URL state and date/filter context; do not change navigation history semantics accidentally.
- **Acceptance:** Desktop/mobile keyboard: announced selected item matches content; arrow/Home/End keys follow selected pattern; Tab exits group; direct URL selects correct section; back behavior is documented and tested.

### Page-specific improvements

### AU-002 — Put the mobile assignment work within reach

**P2 · Design opportunity · Budget/local composition · M · Medium confidence.**

- **Reproduce:** first visit to Budget at 390×844 with populated demo. See `budget-390-demo.png` and the dark variant after first-visit guidance is gone. Introduction, month/search controls and Ready to assign/hold/remainder summary precede the envelope work. Source: `BudgetSummaryWidget.tsx:210`, `:262`, `HoldMoney.tsx`, `pages/Budget.tsx`.
- **Impact:** the person seeking to assign income scrolls before encountering the working envelopes. This is a task-discovery hypothesis, not an observed participant failure.
- **Before → after:** retain a compact, dismissible introduction; keep month/search next to envelope work; show a compact Ready to assign amount and Assign action, with the calculation and Hold controls in a labelled disclosure. Do not hide financial scope or the uncat­egorised warning. Avoid a large sticky stack above the keyboard.
- **Why / dependencies:** prioritises the primary task while keeping the useful explanation. Reuse existing mobile amount sheets and summary disclosure; preserve desktop's side-by-side workspace.
- **Acceptance:** after dismissing introduction, the first envelope/assignment affordance is visible at 390×844 and 320×844; all current summary/hold actions remain reachable; keyboard-open layout retains the edited category and Save; month/context never ambiguous. Validate with novice users assigning income and explaining what remains before implementing a major layout change.

### AU-011 — Give annual-budget comparison a mobile month anchor

**P2 · Design opportunity · Annual budget/local · M · Medium confidence.**

- **Reproduce:** `/budget/year`, 390×844, November demo. `budget-year-390-demo.png` begins with Jan/Feb columns; current month is off-screen. Source `pages/AnnualBudget.tsx:156` horizontal scroller, sticky category column, month links.
- **Impact:** a broad overview is available, but getting from today's context to the relevant column requires lateral searching. This is a discoverability opportunity, not a broken-scroll claim.
- **Before → after:** keep the comparative table on desktop; on phones add a labelled month jump and scroll cue, initially reveal current/selected month without losing the category column, and optionally offer single-month cards with previous/next. Preserve the year summary and future-plan distinction.
- **Why / dependency:** makes the initial view relevant and explains hidden information. Coordinate with selected-month budget navigation.
- **Acceptance:** 320/390 users can reach November directly and open its monthly budget; active month announced; sticky label never covers values; all 12 months reachable by keyboard; 1440 comparison remains efficient. Validate comparison tasks before replacing the table.

### AU-012 — Stack feature visibility controls on phones

**P2 · Responsive usability · Settings → Preferences/local · S · High confidence.**

**Status: fixed in 0.2.0-up.132.** Below `md`, each row stacks with a full-width three-column choice row; the Date format examples also wrap at 320 px. Test: `e2e/tests/phone/polish-phone.spec.ts` at 320 and 390 px. Keyboard semantics for the choice group remain with AU-010.

- **Reproduce:** `/settings?tab=preferences`, 390×844, scroll to “Show in the menu”. `settings-preferences-390.png` shows a very narrow Pay later description beside three choices. Source `components/settings/SidebarFeatureSettings.tsx:54`: flex-1/min-w-0 text competes with a nonwrapping radio group.
- **Impact:** text wraps into short fragments, increasing reading effort for the control that reveals optional features.
- **Before → after:** below the existing phone breakpoint, use a full-width name/description row and a second full-width choice row; keep 44px targets. Desktop may keep text and choices side-by-side. Use a proper keyboard-operable single-choice group.
- **Why / dependencies:** preserves explanation and choice labels instead of sacrificing copy width; align with AU-010 semantics.
- **Acceptance:** all five feature rows readable at 320/390, including long translations/labels; no words reduced to one-character columns; selection remains visible and saves across reload; desktop grouping unchanged.

### AU-013 — Correct what the guide promises about account-linked goals

**P2 · Financial terminology / content defect · Guide and Goals/local · S · High confidence.**

**Status: fixed in 0.2.0-up.132.** The Goals guide now names the form's **Progress source** options (a category, or **Manual tracking**) and says an account link is for reference only. Reader-prediction validation remains open.

- **Reproduce:** read `/guide/goals`, then Goals → Add goal → Progress source/Linked account. `guide-goals-390.png` says a goal can “follow an account”. The form says “Account links are for reference only”; `goals-dialog-390.png`. Source `userGuide/articles.tsx:865`, `GoalFormModal.tsx:153`, `pages/Goals.tsx:31`, `server/src/routes/goals.ts:43`.
- **Impact:** someone may expect a Saver balance to update the goal automatically, although manual goals use currentAmount and account links are references.
- **Before → after:** replace the short guide paragraph with two explicit methods: “Category funded: progress follows that envelope's available money. Manual tracking: update Saved so far yourself. Linking an account is a reference and does not update progress.” Link to assignment and describe spending/moving funds reducing category progress.
- **Why / dependencies:** makes the guide agree with the implemented model; no financial behavior change needed.
- **Acceptance:** desktop/mobile guide and form use the same terms; a linked manual goal does not imply automatic bank funding; category-funded instructions match the tested assignment journey. Ask a reader to predict what happens after a Saver deposit and a category expense.

### AU-014 — Carry a report total into its underlying transactions

**P2 · Usability opportunity · Reports/shared reporting navigation · M · High current-behavior confidence; benefit needs task validation.**

- **Reproduce:** Reports → Spending by category detail → scroll to category table → activate Rent at 390×844. `report-journey.json` records unchanged URL and zero links/buttons in the Rent row; `report-spending-detail-390.png`. Source `components/reports/ReportDetail.tsx:539` renders category/amount cells without onRowClick; `ReportTable.tsx:22` similarly renders static custom totals.
- **Current → impact:** the user can read an aggregate but must reconstruct category and date filters elsewhere to inspect what produced it. Cash flow already supports a drill-through pattern, so related tasks are inconsistent. Calendar drill-through does work; do not describe all reports as dead ends.
- **Proposed after:** make actual-spending/income category/payee aggregates expose an explicit “View transactions” link or accessible row action carrying category/payee, date range, account scope and report boundary. Preserve the source report, selected range and scroll on return. For projected net worth, use assumption/year detail rather than pretending there is an underlying transaction set.
- **Why / dependencies:** supports checking a surprising number without memory or filter reconstruction. Reuse transactionFilters/transactionsLink and server report-scope logic; handle split parents, transfers and uncategorised rows identically to the aggregate.
- **Acceptance:** at desktop/mobile, drill a category total and reconcile the register's included amounts to that total; return restores context; links are keyboard reachable and have meaningful names; no ordinary row selection is mistaken for navigation. Test a split, refund and transfer-boundary case. Ask users to explain a surprising spending total and observe whether they can find its records.

## F. Ten highest-value improvements

Qualitative ranking, not measured usage analytics. Frequency/reach estimates derive from shared callers and task centrality; they need telemetry or research to quantify.

| Rank | Improvement                                     | Impact                                     | Frequency / reach                   | Effort            | Priority |
| ---: | ----------------------------------------------- | ------------------------------------------ | ----------------------------------- | ----------------- | -------- |
|    1 | AU-004 distinguish failed reads from empty data | Prevent false belief that records vanished | Every affected read; shared pattern | M                 | P1       |
|    2 | AU-001 modal focus ownership                    | Restore keyboard task access/orientation   | Most forms and confirmations        | M                 | P1       |
|    3 | AU-008 keep financial amounts intact            | Prevent misreading core figures            | Shared metric cards; large balances | S–M               | P1       |
|    4 | AU-006 close confirmations only after success   | Prevent false completion                   | Destructive actions across features | M                 | P1       |
|    5 | AU-005 report pending/error feedback            | Make save outcome recoverable              | Report creation/editing             | S–M               | P1       |
|    6 | AU-003 visible chart focus                      | Make data exploration operable             | Dashboard/reports/chart surfaces    | S–M               | P1       |
|    7 | AU-007 protect dirty multi-field drafts         | Avoid lost effort                          | Forms and builders                  | M                 | P2       |
|    8 | AU-013 truthful goal-funding guidance           | Avoid incorrect funding expectations       | Goal onboarding                     | S                 | P2       |
|    9 | AU-014 report drill-through                     | Make surprising totals explainable         | Reports and financial review        | M                 | P2       |
|   10 | AU-002 mobile envelope-first composition        | Reduce task-discovery/scroll friction      | Common budgeting task               | M plus validation | P2       |

AU-009 copy alignment, AU-010 choice semantics, AU-011 annual month navigation and AU-012 mobile preferences follow or join the related shared work. Do not delay small proven content fixes behind a redesign. Do not prioritise new animations ahead of data-state and keyboard correctness.

## G. Phased roadmap

### Phase 1 — Foundation and shared patterns

1. Introduce explicit query-state rendering in the four reproduced pages; inventory other data defaults before spreading the pattern (AU-004).
2. Repair Modal focus/background/restore behavior and async confirmation lifecycle (AU-001/006). Protect nested pickers and existing exit animations.
3. Make financial cards intrinsically safe for long exact values (AU-008), then chart focus (AU-003). Keep the established tokens.
4. Define choice semantics, form pending/error contract and truthful Undo wording (AU-005/009/010). Prototype a small shared primitive before rewriting callers.

Exit gate: keyboard modal flow, injected fetch/write failures, stale/offline retained-data behavior and large monetary amounts pass desktop/phone checks; no new ledger behavior.

### Phase 2 — Core financial journeys

1. Apply draft protection to money-changing forms/builders with meaningful dirty tracking (AU-007).
2. Validate mobile Budget composition with assignment, overspending and payday tasks, then implement only the supported changes (AU-002).
3. Fix goal guide drift immediately (AU-013); verify category/manual progress and household/account boundaries across linked screens.
4. Add scoped report drill-through and contextual return (AU-014), preserving the working calendar/cash-flow patterns.
5. Re-run setup → mocked import → categorise → assign → overspend → transfer between envelopes → reconcile. Verify amount/period consistency at each handoff and persisted filter/back context.

Exit gate: participants can explain account balance versus available/assigned/forecast and predict each action's consequence; automated money invariants and recovery remain green. Research should record errors and misunderstanding, not make unsupported percentage-improvement claims.

### Phase 3 — Page-specific refinement and motion

1. Stack visibility settings and add annual mobile orientation (AU-012/011).
2. Refine the now-reviewed populated tax/investment/payment-plan/long-term variants; use the remaining unusual-state and source-only entries in the coverage register for targeted follow-up.
3. Consolidate header/gutter variations only where they impede scanning; preserve task-specific tables, cards and long-form pages.
4. Tune continuity after semantics are stable: preserve context on detail return, retain old content during refetch, animate disclosures and sheet exit using existing tokens. Verify reduced motion for charts and loading loops as well as CSS tokens.

Exit gate: no unresolved P1 from this audit; route/state matrix updated with actual OS/device/accessibility coverage rather than inferred compliance.

## H. Three consequential before/after interaction specifications

### 1. Loading a financial surface: truth before convenience (AU-004)

**Before:** request fails → default empty array → first-use copy and creation CTA.

**After:**

- First load: labelled skeleton for the real page structure, no fabricated zeros.
- Successful nonempty response: content plus normal controls.
- Successful empty response: current helpful empty state and one next action.
- Successful filtered empty response: “No matches” + clear filters; do not imply no records exist.
- Failed initial response: page title/context retained; “Couldn't load your goals. Your saved goals haven't been changed.” only when that no-write fact is known; Retry and connection help.
- Failed refresh with cached response: retain last successful figures, show “Last updated … · Couldn't refresh” and Retry. Do not silently use stale data in an action requiring a fresh financial preview.
- Retry: pending announced; prevent duplicate retry; successful result replaces error without resetting filters or focus unexpectedly.

**Desktop/mobile:** same information hierarchy; inline error panel occupies the data region and wraps naturally. No global alert blocking unrelated loaded pages. Test with 422, 500, offline, timeout, stale cache and recovery; verify the appropriate connection affordance rather than treating all errors as offline.

### 2. Confirming, saving and dismissing a form: completion is explicit (AU-001/005/006/007)

**Before:** forms independently autofocus; Tab can escape; Escape discards; report failure has no feedback; generic confirm closes immediately.

**After:** opener → focused labelled dialog/sheet → field validation → pending → success/retained failure. Opening makes background inert. A multi-field form's Cancel/Escape/backdrop uses its dirty policy. A nested picker consumes its own first Escape. Submit locks repeated activation, keeps the action labelled (“Saving…”/“Deleting…”), and leaves the relevant content visible. A server refusal identifies the failed action and preserves input; focus moves to the error summary only if useful, never back to the page. Success closes after acknowledgement, restores opener/logical next row, announces what changed and offers accurate Undo.

**Desktop/mobile:** centered dialog and bottom sheet are presentations of the same state machine. Long forms scroll within a reachable container; the virtual keyboard must not hide the focused field or final action. No confirmation for opening/closing an unchanged form. Test nested overlays, one invalid amount, one refused save, double activation, lost connection, and deletion of the opener's row.

### 3. Reading a financial amount on a phone: protect the value (AU-008)

**Before:** two fixed columns + break-words → `A$165,905.1` then `8`.

**After:** format the complete exact amount as a no-wrap atomic value; select grid columns based on available container width and supported value length. When two cards do not fit, stack them, retaining label/value/subtext order. Allow labels/help to wrap; never the sign/currency/digits. Keep summary reading order stable: net worth, change, assets, liabilities. Charts may retain compact axis labels, but exact values are reachable in detail/table/tooltips.

**Desktop/mobile acceptance:** use zero, negative six/seven-digit balances, cents and long currency labels at 1440/390/320 and actual zoom. Compare screenshots and element bounds; a no-overflow assertion alone is insufficient. Do not use tiny text or ellipsis to make the test pass.

## I. Verification checklist for implementation

- [ ] Each finding's acceptance criteria satisfied; update IDs/status without renumbering.
- [ ] All primary routes, dynamic detail routes, settings sections and guide links reviewed at 1440×900 and 390×844; 320/360 and breakpoint transitions retained.
- [ ] Corrected evidence replaces loading/redirect/misaddressed captures; named screenshots identify data, theme and state.
- [ ] Shared primitives tested through at least two distinct callers; modal nested picker and row-deletion focus restoration included.
- [ ] Query empty/error/no-match/stale states and mutation pending/refusal/retry/success/undo are distinct; no unavailable amount shown as zero.
- [ ] Dirty data protected without blocking clean dismissals; cancel changes nothing; no repeated write on double activation.
- [ ] Income/assignment/overspending/payday/reconciliation totals checked before and after; forecast changes no ledger; household switch retains clear context.
- [ ] Large exact amounts and long labels remain readable without whole-page horizontal scroll or split digits.
- [ ] Keyboard traversal, accessible names, focus visibility, screen-reader labels/announcements and actual 200%/400% zoom checked.
- [ ] Both themes, colour-independent meaning, all relevant contrast pairs and reduced motion checked; no compliance claim from token checks alone.
- [ ] Physical mobile keyboard, safe areas and orientation checked; packaged Electron and Home Assistant tested separately from Chromium emulation.
- [ ] Repository tests appropriate to changed components pass; add meaningful regressions for each reproduced defect, not screenshot-only assertions.
- [ ] No production credentials/data used; documentation/guide terminology and screenshots match the final implementation.

### Continuation rule

The coverage qualification remains until outstanding important surfaces/states are actually inspected. Do not convert source-only rows or unexecuted tests to “reviewed” for presentation. Use SURFACES.md, the route matrix and exact test logs to resume. This report supersedes the earlier short checkpoint; earlier evidence files are retained with their limitations explicitly identified.
