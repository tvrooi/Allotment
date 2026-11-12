# UI handover

Overwritten at the end of each UI session, never appended. Last written 11 November 2026 from
`git log -25` on `redesign` (head `cf2e2f0`). Older detail: grep `docs/handover/ARCHIVE.md`.

## Done this session

- Wave C dashboard (up.170, branch `feat/wave-c-dashboard`): #230 the review card keeps an Open
  review button at every width, with steps 2 and 3 as quiet rows beside it on wider screens, and
  Left to spend has a pace bar (`spendingPace`, `monthProgress` in `utils/leftToSpend.ts`). #231
  `StatusStrip` under the opening line: bank feed freshness (`utils/bankSync.ts`, shared with
  `UpSyncBadge`) and the default household's balance (`components/household/balanceHeadline.ts`,
  shared with `BalanceSummary`); always on, not a Customise card; Tax and Files left out (no cheap
  count). #232 paired cards share a height, desktop Bills lists 3 bills and 2 pay days, one
  summary disclosure on phones, and `ui/SegmentedControl` replaces the charts' range selects.
- Search palette, part 1 of #224 (up.169, branch `feat/command-palette-1`): Cmd/Ctrl+K, `/` and
  the phone header's Search open one palette over pages, actions (Add a transaction, Safe mode,
  guides), accounts, categories, payees and goals, from cached lists only; recents on the device;
  hidden features marked Set up. The sidebar now reads its pages from `layout/navPages.ts`. The
  guides dialog lists the keyboard shortcuts.
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

- None committed half-done. `redesign` is ahead of `main`; up.154 to up.166 are prepared, not tagged.

## Next up (issues)

- #211 run category-goals specs; #212 run long-term forecast specs (both unrun after wording changes).
- #213 quick expense test; #214 refresh `docs/ux-ui-evidence/` dates; #215 iPhone check; #216 dark mode.
- #217 Review queue redesign; #218 Cash flow personal share; #219 Household screens by type.
- #220 sidebar item count (UX review item 7).
- #224 PR 2: Files and Transactions search in the palette, "Not available offline" for those
  two groups, and the demo's Files message. Seams: add a group id in `utils/commandPalette.ts`
  `PALETTE_GROUPS` and its entries in `CommandPalette.tsx`.
- Design re-review at `cf2e2f0`, P0: #226 sidebar set-up rows.
- P1: #235 goal/payee links;
  #236 transfers step; #237 empty states; #243 desktop row click; #245 undo and keep filters.
- P2: #239 onboarding step; #240 headers and pickers;
  #241 delight moments; #244 split Settings tabs.

## Decisions

- `client/src/index.css` `@theme` is the only token source; DESIGN.md describes it.
- Budget work lives on `redesign`, beside the pre-redesign app on `main`; PR #209 was closed
  unmerged and is reconciled later.
- Goal in-progress bars use one brand colour, reached goals green; `goal.color` only tints the dot.
- Long-range forecast amounts use `formatWholeCurrency`; forecasts are dotted with a ring at today.

## Traps

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
- Global CSS in `index.css` must sit in an `@layer`, or it beats every Tailwind utility.

## Verify

- `npm test --prefix client`; `npm run build --prefix client`.
- `cd e2e && npm test -- --project=desktop tests/<screen>.spec.ts`, plus the phone spec in `MAP.md`.
- Layout at 390px with no sideways scroll; light and dark; evidence in `.ui-evidence/<date>-<screen>/`.
