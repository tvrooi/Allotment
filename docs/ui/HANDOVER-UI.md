# UI handover

Overwritten at the end of each UI session, never appended. Wave E entry written 13 November 2026
(branch `feat/wave-e-navigation`, up.173); Wave D and palette entries updated 12 November 2026
(PRs #262 and #259). Other entries last written 11 November 2026 from `redesign` (head `cf2e2f0`). Older detail: grep `docs/handover/ARCHIVE.md`.

## Done this session

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
  hidden; offline groups say Not available offline, demo Files explains its availability;
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

- None committed half-done. `redesign` is ahead of `main`; up.154 to up.172 are prepared, not tagged.

## Next up (issues)

- #211 run category-goals specs; #212 run long-term forecast specs (both unrun after wording changes).
- #213 quick expense test; #214 refresh `docs/ux-ui-evidence/` dates; #215 iPhone check; #216 dark mode.
- #217 Review queue redesign; #218 Cash flow personal share; #219 Household screens by type.
- #220 sidebar item count (UX review item 7).
- P2: #263 Review checklist in place of guide banners (rest of #239, needs an owner decision);
  #264 disabled switch looks enabled; #241 delight moments; #244 split Settings tabs.

## Decisions

- `client/src/index.css` `@theme` is the only token source; DESIGN.md describes it.
- Budget work lives on `redesign`, beside the pre-redesign app on `main`; PR #209 was closed
  unmerged and is reconciled later.
- Goal in-progress bars use one brand colour, reached goals green; `goal.color` only tints the dot.
- Long-range forecast amounts use `formatWholeCurrency`; forecasts are dotted with a ring at today.
- Pickers: a category is always chosen with the searchable `CategoryPicker`; a short fixed list
  uses the one shared styled `Select` (`components/ui/Input.tsx`) (#240, 13 November 2026).
- Gutter: page title rows and the content under them use `PAGE_GUTTER`
  (`components/ui/pageGutter.ts`): 16 px on phones, 24 px from `md`; `e2e/tests/phone/page-gutter.spec.ts`
  checks every route (#240).
- Undo: announcing is part of `undoStore.push`; pass `message` for better words, `quiet` only
  where silence is the point (onboarding sorting) (#245).
  A mutation that may record nothing takes the words and announces without Undo instead; never
  announce again after a push, and never add an inline Undo beside the toast's.

## Traps

- Scroll memory is keyed by the router's history key: a hand-typed hash URL gets the key
  `default`, like the first page load. A page-level scroll container must use `useScrollMemory`
  or Back loses its place.
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
