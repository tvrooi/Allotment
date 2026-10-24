# YNAB Budget comparison: FlyBudget gaps and implementation candidates

Investigation date: 24 October 2026. FlyBudget source baseline: `5bb4b652b931212b6883d126472dbc1f410bed80` (`SRC`).
This is a proposed backlog, not authorization to implement it. No FlyBudget application code or budget data was changed. YNAB tests changed only the user-confirmed synthetic test budget.

The [companion findings](ynab-budget-tab.md) distinguish YNAB documentation, reference UI and live-test evidence.
The tickets below establish FlyBudget behavior from source and cite the companion report's `LIVE-*` evidence for verified YNAB interactions.
Proposed acceptance criteria remain synthetic FlyBudget tests, not claims that FlyBudget was exercised. Unverified YNAB cases are identified explicitly.
Line references describe `SRC`; follow-up changes must recheck them.
Live evidence: `LIVE-01` layout/inspector, `LIVE-02` editing/undo, `LIVE-03` targets, `LIVE-04` money moves, `LIVE-05` month/RTA behavior, `LIVE-06` cash/cards, `LIVE-07` responsive widths.
`LIVE-08` verifies notes/hiding; `LIVE-09` verifies the unconfirmed whole-header auto-assign preview. `LIVE-04` also covers moving money to RTA and Recent Moves.

This complements [phase 6](../YNAB-DEVELOPMENT-PHASE.md), not a replacement for it.
Envelope accounting, atomic moves, targets, reviewed card reserves and funding previews already exist.
The task is to improve access, explanation and consistency around them, with explicit decisions for accounting differences.

## Priority and verification conventions

- **P1:** incorrect-month or stale-write risk, or a state that could mislead an assignment decision.
- **P2:** core workflow friction or a missing interaction in the requested comparison.
- **P3:** optional presentation and metadata work after core interactions are verified.
- **C:** `npm test --prefix client` and `npm run build --prefix client` for client changes.
- **S(file):** `npm test --prefix server -- <file>` and `cd server && npx tsc --noEmit` for affected server logic.
- **E(file):** `cd e2e && npm test -- --project=desktop tests/<file>`; exercise narrow/phone fixtures where applicable.
- These are proposed checks for implementation. This documentation pass does not report them as executed.

## P1 · BUD-01: bind editing and saving to a loaded month

- **Evidence / status:** Source-confirmed risk; actual race reproduction remains a test task.
  [Budget queries](../../client/src/hooks/useBudget.ts#L5) retain previous-month data while loading.
  [Save](../../client/src/pages/Budget.tsx#L487) uses `selectedMonth`; normal rows gate editing only on connectivity at line 107.
  The table is faded, not disabled, at line 589. [Card funding](../../client/src/components/budget/CardPayments.tsx#L95) already checks loading and month identity.
- **Trigger:** Navigate October to November with a delayed response, then edit an October row still on screen; also navigate with a phone sheet open.
- **Seam:** `BudgetPage`, `CategoryRow`, `PhoneBudget`, and `BudgetAmountSheet`; carry loaded month identity through editors and mutations.
  [Plain assignment](../../server/src/routes/budget.ts#L117) accepts an optional revision, but the ordinary page save omits it.
- **Invariants:** Never apply a displayed value to another month; reject stale assignment writes without overwriting another client's change.
  Keep the existing funded-write transaction and integer minor units.
- **Acceptance:** Delay November loading, attempt an edit and assert no unintended November write; old editors close or remain bound to October explicitly.
  Two clients editing the same assignment receive a clear conflict on stale state. Offline edits remain disabled.
- **Smallest checks:** C; S(`src/routes/budgetFunding.test.ts`) if adding preconditions; E(`budget.spec.ts`) with delayed-load and stale-edit cases.

## P1 · BUD-02: show save progress and failed undo clearly

- **Evidence / status:** Source-confirmed feedback gap; latency and animation quality have not been measured against YNAB.
  [Manual save](../../client/src/pages/Budget.tsx#L487) closes immediately, refetches on success and renders errors at line 581.
  [Undo store](../../client/src/store/undoStore.ts#L38) restores a failed command to its stack without surfacing its error.
- **Trigger:** Reject an assignment for insufficient funds, interrupt connectivity during save, or undo after a competing financial edit.
- **Seam:** `useSetBudget`, `undoStore`, shared toasts and the editor; define pending, saved, retry and conflict presentation.
  [Move history](../../client/src/components/budget/MoneyMoves.tsx#L196) already reports operation messages separately.
- **Invariants:** No success message before persistence; never restore stale values over newer data; no unreviewed automatic retry of a financial operation.
- **Acceptance:** A rejected save preserves the entered value for correction and identifies the reason; repeated Enter cannot create confusing duplicate requests.
  Failed undo visibly reports a conflict and leaves current assignments intact. Test global undo outside an input and native text undo inside it.
- **Smallest checks:** C; focused undo-store failure tests and E(`budget.spec.ts`) with one rejected mutation. Preserve move-conflict coverage in E(`envelope-funding.spec.ts`).

## P1 · BUD-03: make availability states explain their meaning

- **Evidence / status:** Source-confirmed simplified state model; `LIVE-03` verified target progress/shortfall and `LIVE-05`/`LIVE-06` verified overspending and overassignment states. Remaining color combinations need the companion test matrix.
  [Available pills](../../client/src/pages/Budget.tsx#L112) use only positive, negative and zero balance.
  [Progress bars](../../client/src/components/budget/SpentBar.tsx#L13) use monthly spending/assignment ratio; target underfunding is separate text at Budget line 134.
- **Trigger:** A carried balance covers spending above this month's assignment, or an underfunded target still has positive Available.
- **Seam:** A shared semantic status helper used by desktop, phone, card presentation and inspector; keep progress and spendable balance distinct.
- **Invariants:** Color cannot change arithmetic. Do not infer cash versus card overspending from balance sign alone; retain explicit server evidence and mixed-spending policy.
- **Acceptance:** Synthetic rows cover positive funds, zero, target shortfall, cash deficit, card shortfall and missing rates.
  A $600 carry + $100 assignment − $500 activity shows $200 Available and cannot imply an envelope deficit merely because monthly progress exceeded $100.
  State labels remain understandable without color and consistent on phone.
- **Smallest checks:** C plus semantic-state unit cases; E(`envelope-funding.spec.ts`), adding the carried-funds/progress case.

## P2 · BUD-04: category groups, visibility and responsive layout

- **Evidence / status:** Comparable monthly columns/collapsible sections exist; `LIVE-01` verified YNAB category-group and inspector layout. FlyBudget grouping differs; `LIVE-08` verifies hiding a zero-balance row, the Hidden Categories section, and Undo restoration; group collapse retains totals.
  [Budget types](../../client/src/pages/Budget.tsx#L410) regroup expense categories into four fixed types at line 442.
  [Inactive filtering](../../client/src/utils/budgetFigures.ts#L76) is derived from balances/activity, not persistent user hiding.
  [PhoneBudget](../../client/src/components/budget/PhoneBudget.tsx#L29) uses category cards and an amount sheet.
- **Trigger:** A user wants their saved category groups, a collapsed group, a hidden inactive category, or the same selected category at a narrow width.
- **Seam:** `BudgetPage` section composition, category-group display preferences and shared selection state.
  Persistent hide/unhide would need an additive field/API: [categories](../../server/src/db/schema.ts#L50) has no category-hidden flag.
- **Invariants:** Hiding is presentation only; never drop balances, deficits, targets or activity from totals. Preserve saved group/type metadata and historical categories.
- **Acceptance:** Reorder/collapse groups without changing assignments; hidden categories remain recoverable and their money remains counted.
  At narrow and phone widths all three figures, errors, moves and inspector actions remain reachable; deficits cannot disappear silently.
  `LIVE-07` found the inspector off viewport at 900px and desktop clipping at 390px; this is not a native-mobile inspection or a behavior to copy. Hiding a funded/overspent category and explicit unhide remain unverified.
- **Smallest checks:** C and E(`budget.spec.ts`); only add server/backup checks if persistent metadata is introduced.

## P2 · BUD-05: predictable keyboard, expression and multi-category assignment

- **Evidence / status:** Basic inline editing and undo exist; no budget-grid navigation, arithmetic evaluator or selected-category batch flow is implemented in the reviewed page.
  `LIVE-02` verified YNAB `100+50` → 150, `150*2` → 300, ArrowDown selecting/opening the next category, and undo/redo 300 ↔ 150. Literal replacement of $350 with `+50` saved $50; replacement with `*2` saved $2. The original $350 was restored. Tab left the editor; its exact destination was not established.
  [AmountInput](../../client/src/pages/Budget.tsx#L33) handles Enter, Escape and blur; [currency parsing](../../client/src/utils/currency.ts#L281) reads amounts.
  [BulkPreview](../../client/src/components/budget/BulkPreview.tsx#L21) overwrites one category over 12 months, a different operation.
- **Trigger:** Navigate assigned cells, use a verified full expression such as `100+50` or `150*2`, undo an edit, or apply an amount to several selected categories.
- **Seam:** Extract a budget editor/navigation controller and a narrowly scoped expression parser; add an atomic batch endpoint only if needed.
  Check desktop signed input against [phone save](../../client/src/components/budget/BudgetAmountSheet.tsx#L80), which currently applies `Math.abs`.
- **Invariants:** Preserve the distinction between verified literal replacement and untested operator keystrokes with existing text selected; never assume `+50`/`*2` are relative to the old amount; no `eval`, no float currency storage and no accidental change to import parsing.
  Batch writes require a reviewed scope, funding guard, concurrency precondition and coherent undo.
- **Acceptance:** Document and test Enter/Tab/Shift+Tab/arrows/Escape with group collapse and hidden rows.
  Verify `100+50` saves $150 and `150*2` saves $300; test malformed expressions and locale separators. If matching literal replacement, `+50` saves $50 and `*2` saves $2, regardless of the prior $350. Specify selected-text/operator-key behavior separately.
  Desktop/phone negative-assignment behavior agrees; batch failure changes no rows; 12-month overwrite remains explicitly previewed.
- **Smallest checks:** C with parser and focus cases; S(`src/routes/budgetFunding.test.ts`) for batches; E(`budget.spec.ts`).

## P2 · BUD-06: row-anchored moves and unassigned-money entry points

- **Evidence / status:** Atomic move/cover/undo already exists; row-anchored entry and Ready-to-Assign endpoints are missing from this workflow.
  `LIVE-04` verified YNAB moving $50 from groceries $400 → $350 to transport $0 → $50 without changing RTA, then a separate $10 move to RTA that reduced category assignment/Available and increased RTA $10; Undo restored it. Recent Moves has All/Moved/Assigned tabs and dated descriptions. `LIVE-06` verified assignment covering a credit overspend.
  [Available](../../client/src/pages/Budget.tsx#L183) is a noninteractive span; [MoneyMoves](../../client/src/components/budget/MoneyMoves.tsx#L97) is a separate sidebar form.
  [Move service](../../server/src/services/budgetMoves.ts#L41) accepts two expense categories, not an unassigned pseudo-category.
- **Trigger:** Click positive Available to move funds, click a deficit to cover it, or return funds to unassigned.
- **Seam:** Prefill the existing move preview from the row; use guarded assignment operations for unassigned-to-category/category-to-unassigned, sharing mutation infrastructure.
- **Invariants:** Preserve atomic pairs, durable operation history, source availability through affected months and revision checks.
  Keep future-month move restrictions explicit. A display alias for unassigned must not create an invented ledger account/category.
- **Acceptance:** Move $30 between two synthetic envelopes and preview both results; cover a $20 deficit; return $10 to unassigned and assign it elsewhere once.
  Intervening changes reject stale previews; cancel writes nothing. Replace the generic [target notice](../../server/src/services/budgetMoves.ts#L94) with actual changed target figures where supported.
- **Smallest checks:** S(`src/services/budgetService.test.ts`), C and E(`envelope-funding.spec.ts`).

## P2 · BUD-07: target cadence and selected-category assignment shortcuts

- **Evidence / status:** Four target types and reviewed capped funding exist. `LIVE-03` verified a $400 monthly YNAB target with $300 assigned showing 75% and $100 needed; sidebar Underfunded immediately assigned the $100 without a confirmation step.
  `LIVE-03` also verified Weekly $100 Saturday requiring $200 in this October fixture; Yearly $1,200 due 1 November needing $250 beyond $350 assigned; and an undated $1,200 balance target with no Underfunded shortcut.
  Monthly refill needed $50 with $350 assigned/$340 Available now, but $300 with $100 assigned/$440 Available in future November. `LIVE-09` verified header Assign → Underfunded opening a two-category preview (+$1,650/+50), card warning, Cancel and Assign Money; confirmation was not executed. Cycle-boundary behavior remains unverified.
  [TargetCard](../../client/src/components/budget/TargetCard.tsx#L11) supports monthly, by-date, recurring-month and refill targets.
  [Fund targets](../../server/src/services/targetService.ts#L148) funds all underfunded targets in budget order with a reviewed preview: comparable to YNAB's observed header preview, different from immediate inspector shortcuts.
  [Phone suggestions](../../client/src/components/budget/BudgetAmountSheet.tsx#L94) already offer last-month spending and average; desktop displays those values in its history popover.
- **Trigger:** Fund only selected categories, apply last month's assigned/spent or an average, or specify a cadence not represented by existing target fields.
- **Seam:** Extend target configuration/calculation only for verified semantics; reuse `targetStatus`, `previewTargetFunding`, history data and funded writes.
- **Invariants:** Targets remain suggestions; expected income does not fund them. Keep date/recurrence math in shared services and preserve existing targets and assignments.
- **Acceptance:** Preview selected categories only, distinguish replacing versus adding assignment, and show remaining shortfalls when resources run out.
  A $400 monthly target with $300 assigned shows $100 needed. `LIVE-03` also applied selected Rent/Groceries shortfalls $1,650 + $50 immediately and undid both together. Decide explicitly whether scoped shortcuts apply immediately or retain FlyBudget's review step; keep funding guards either way.
  Compare future refill semantics explicitly: FlyBudget already uses projected carry, whereas the verified YNAB future view did not credit it toward the target. Do not infer actual rollover behavior from that preview alone.
  Include zero-spending months in averages; test new cadence at month/year boundaries if approved. Opening target editor or changing a target never assigns funds.
- **Smallest checks:** S(`src/routes/targets.test.ts`), C and E(`targets.spec.ts`); add a focused recurrence test only if adding cadence logic.

## P2 · BUD-08: explain rollover and unassigned funds without changing policy

- **Evidence / status:** Positive carry, future reservations and resource caps exist. Negative envelope carry is an intentional FlyBudget policy, not an unimplemented YNAB feature.
  `LIVE-05`/`LIVE-06` verified YNAB cash overspending $30 resetting to zero next month with RTA reduced $30; credit overspending $40 reset without that RTA deduction or extra payment reserve. A $100 future assignment lowered current RTA $100.
  YNAB accepted manual overassignment and displayed a red Fix This state; FlyBudget guards reject new reservations beyond resources.
  [Budget arithmetic](../../server/src/services/budgetService.ts#L79) retains prior assignments/activity; [funding](../../server/src/services/budgetService.ts#L153) reserves positive envelopes and future assignments.
  [Summary](../../client/src/components/budget/BudgetSummaryWidget.tsx#L165) exposes as-of, deficits and future reservations.
- **Trigger:** A user moves to next month after cash/card overspending, funds a future category, or attempts to assign more money than exists.
- **Seam:** Add a legible funding breakdown and month-transition explanation using existing summary/service data.
  [Funded write](../../server/src/services/budgetMoves.ts#L126) rejects an increase that overcommits resources; preserve that rather than copying an over-assigned editing path blindly.
- **Invariants:** `resources = unassigned + reserved`; future positive assignments reserve current funds; expected receipts remain excluded.
  Retain negative carry and legacy overcommitment visibility unless a separately reviewed accounting/migration design is authorized.
- **Acceptance:** Synthetic $1,000 opening cash with $300 assigned next month leaves $700 unassigned now; expected salary changes neither figure.
  Carry a $50 deficit into the next month and explain it. Reject a new overassignment atomically while still displaying a preserved legacy shortfall.
  Document the verified YNAB cash/card month-reset and accepted-overassignment differences as intentional divergences, not cosmetic parity fixes.
- **Smallest checks:** Existing S(`src/services/budgetService.test.ts`) and S(`src/routes/budgetFunding.test.ts`) examples; C and E(`envelope-funding.spec.ts`) for explanation changes.

## P2 · BUD-09: integrate card-payment presentation with the budget table

- **Evidence / status:** Payment reserves and reviewed setup already exist; presentation differs. `LIVE-06` verified a funded $10 card purchase reducing groceries $10 and increasing payment reserve $10; assigning $40 to cover credit overspending added $40 to that reserve.
  [Budget](../../client/src/pages/Budget.tsx#L438) excludes payment categories from ordinary expense rows; [CardPayments](../../client/src/components/budget/CardPayments.tsx#L64) shows them in the sidebar.
  [Shared assessment](../../server/src/services/budgetService.ts#L99) consumes the card calculator.
- **Trigger:** Compare grocery availability with cash reserved for a funded card purchase, or inspect a payment shortfall alongside other categories.
- **Seam:** Render managed payment rows/group and a contextual detail view from the same card position data; retain explicit review for existing cards.
- **Invariants:** No second card ledger; repayments remain transfers, historical rows are preserved, and unreviewed cards keep their disclosed conservative treatment.
  Keep missing rates, prepaid balances, shortfalls and excess reserve visible.
- **Acceptance:** With $100 groceries assigned and an $80 funded card purchase, show $20 groceries and $80 for payment.
  An $80 linked repayment consumes reserve without duplicating grocery activity; show a partially funded purchase honestly on desktop/phone.
- **Smallest checks:** S(`src/services/cardFunding.test.ts`), C and E(`card-payments.spec.ts`); do not rebuild working calculation coverage for a presentation-only change.

## P2 · BUD-10: contextual inspector and scoped notes

- **Evidence / status:** Summary/history/target information exists in separate surfaces; a selected-category inspector and category/month notes are missing from the reviewed Budget flow.
  `LIVE-01` verified YNAB single-category, multiple-category and no-selection inspector states. `LIVE-08` verified month-note save with OK and category-note blur save after deselection; both survived reload and were restored afterward.
  [Sidebar](../../client/src/pages/Budget.tsx#L761) is fixed; [CategoryDetail](../../client/src/pages/CategoryDetail.tsx#L136) has budget figures, history, transactions and target editing.
  [Category schema](../../server/src/db/schema.ts#L50) has no category note; transaction notes are a different entity.
- **Trigger:** Select one category, multiple categories, or no categories and keep useful context while assigning money.
- **Seam:** Shared selection/inspector components reusing summary, category history, targets and activity links; additive note schema/API only if approved.
- **Invariants:** Selection changes no money; aggregated figures reconcile with the table. Notes never masquerade as transactions or change category identity.
- **Acceptance:** No selection shows monthly summary; one selection shows the correct category; multiple selections aggregate only those categories and scope actions visibly.
  Phone inspector is reachable and dismissible without losing edits. If notes are introduced, test save/error, Unicode, backup/restore and category deletion behavior.
- **Smallest checks:** C and E(`budget.spec.ts`); add focused API/backup tests only for new persistent notes.

## Decisions before implementation

No further live tests are planned for this pass. Remaining cases for a later confirmed synthetic-budget investigation are operator keystrokes with existing text selected, exact Tab destination, target cycle boundaries, confirmation of header auto-assign, move-from-RTA and funded-category hiding/explicit unhide.
Do not downgrade already verified full-expression editing, inspector states, money movement, future funding and cash/card rollover to documentation-only evidence.
Keep policy choices explicit: retaining deficits and forbidding new overcommitment are not accidental UI omissions.
Start with BUD-01/BUD-02 regression cases, then shared selection/status work; build row moves, target shortcuts and inspector on those seams.
The synthetic fixture is not fully reset: three test transactions ($30 cash, $40 card, $10 funded card), assignments and the monthly refill target remain; temporary overassignment, selected funding and the $10 RTA move were undone, and notes restored.
No application release, version bump, installation or live-budget migration follows from this documentation-only investigation.
