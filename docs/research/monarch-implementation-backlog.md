# Monarch-informed FlyBudget implementation backlog

22 October 2026. Research only; no app changes. Sources: [initial live notebook](monarch-observed-workflows.md), [continued live audit](monarch-live-audit-continued.md), and [existing FlyBudget seams](monarch-flybudget-gap-map.md). Priorities rank improvements to existing workflows, not visual parity. Each ticket is a proposed independent implementation; its evidence paragraph describes only what was observed. Verify the current implementation before treating a suggested acceptance criterion as a missing feature.

## P1 · Register context survives opening and closing details

**Evidence:** the live register opens a transaction-specific route and right drawer while keeping the register visible; drawer previous/next controls exist. Continued audit: Detail drawer. Unsaved-edit persistence and previous/next selection rules were not tested.

**Trigger/result:** opening a transaction from filtered results preserves the filter, sort, selection and return position; closing or Back returns to that context. Previous/next traverses the same result set.

**Seam:** [Transactions.tsx](../../client/src/pages/Transactions.tsx), [TransactionTable.tsx](../../client/src/components/transactions/TransactionTable.tsx), [TransactionDetailPanel.tsx](../../client/src/components/transactions/TransactionDetailPanel.tsx), [App.tsx](../../client/src/App.tsx).

**Invariants:** navigation must not write a transaction. Record identity stays separate from transient list position. Account access and filter eligibility still apply to deep links.

**Acceptance:** a direct detail link loads safely; Back restores filters; closing restores focus to the originating row; first/last rows disable unavailable traversal; removed/inaccessible records show a recoverable state. An editable merchant/category control and a navigation link have distinct accessible targets.

**Smallest checks:** focused register navigation browser test with mock transactions; `npm run build --prefix client`. No server change is needed if existing detail fetching supports the route.

## P1 · Bulk edits explicitly distinguish unchanged, set and clear

**Evidence:** Edit multiple reveals selection count and keyboard hints; the bulk dialog defaults fields to No change and disables Save until a change. Continued audit: Bulk editing. No bulk save was submitted.

**Trigger/result:** selecting records and choosing Edit opens one draft with affected record/account count. Only explicitly changed fields are included in the mutation; clearing an optional field is deliberate.

**Seam:** [SelectionSummary.tsx](../../client/src/components/transactions/SelectionSummary.tsx), [TransactionTable.tsx](../../client/src/components/transactions/TransactionTable.tsx), [api/transactions.ts](../../client/src/api/transactions.ts), [routes/transactions.ts](../../server/src/routes/transactions.ts).

**Invariants:** preserve import IDs, reconciled protections, split-parent constraints, transfer pairing and user-edited data. Use existing shared write helpers and atomic transactions for the supported batch scope. Never imply that an unselected page or all matching results is selected.

**Acceptance:** untouched fields remain byte-for-byte equivalent; empty string/null clearing is distinguishable from omission; no-op save is disabled; Cancel writes nothing; affected count and any ineligible rows are visible; error/partial-success behavior is explicit. Delete remains a separate confirmed action.

**Smallest checks:** focused selection/bulk route tests using disposable rows, including unchanged/set/clear and rejected reconciled/split cases; `cd server && npx tsc --noEmit`; client build. Extend [transactionSelection.test.ts](../../server/src/routes/transactionSelection.test.ts) if its existing scope fits.

## P1 · Split drafts explain the remainder before commit

**Evidence:** the live split dialog retains the original amount, starts with two parts, shows Left to split and disables commit when unallocated. Cancel returned to the original drawer. Amount/Percent modes are visible; rounding and committed behavior remain unknown.

**Trigger/result:** Split opens an isolated draft showing the original amount, sum of parts and signed remainder; users can add/remove rows and commit only a valid allocation.

**Seam:** [TransactionFormRow.tsx](../../client/src/components/transactions/TransactionFormRow.tsx), [AddTransactionModal.tsx](../../client/src/components/transactions/AddTransactionModal.tsx), [TransactionDetailPanel.tsx](../../client/src/components/transactions/TransactionDetailPanel.tsx), [routes/transactions.ts](../../server/src/routes/transactions.ts). The server already validates exact split sums and protects part edits; reuse these constraints.

**Invariants:** integer minor units; sum equals parent exactly; parent bank import identity remains stable; no duplicate import or silent reconciliation change. Never copy Monarch's child-row wording into a new ledger storage model without a separate design.

**Acceptance:** remainder updates on valid input, invalid text never becomes zero silently, Cancel leaves parent/parts untouched, signed refunds have defined validation, and one atomic write persists a valid split. A percent mode is optional; if added, document deterministic rounding and which row receives residual cents.

**Smallest checks:** focused split route tests for exact sum, invalid sum, refund and atomic rollback; a client interaction check for draft cancellation and validation; server typecheck and client build.

## P1 · Budget edits expose month-local versus shared scope

**Evidence:** budget settings expose a default month/future edit scope; category definition opens a separate modal with classification, rollover and exclusion. The observed descriptions distinguish category settings from a month's amount. Reset actions were not executed.

**Trigger/result:** editing a monthly amount displays the affected month/range; editing classification or rollover clearly identifies shared category scope. Bulk propagation previews affected months before applying.

**Seam:** [Budget.tsx](../../client/src/pages/Budget.tsx), [AnnualBudget.tsx](../../client/src/pages/AnnualBudget.tsx), [api/budget.ts](../../client/src/api/budget.ts), [routes/budget.ts](../../server/src/routes/budget.ts). Reuse existing bulk expected-value handling rather than inventing a second propagation path.

**Invariants:** category metadata and month allocations remain distinct; planned future amounts never increase today's cash; preserve additive migrations and integer amounts. No recalculation may overwrite existing allocations without explicit scope and confirmation.

**Acceptance:** month/range visible before Save; existing-value conflicts are surfaced; changing a category definition explains its scope; annual/month totals stay consistent; Cancel does not mutate. Do not add Flex Budget mode or a Decade view merely because their controls appeared in Monarch.

**Smallest checks:** focused budget route/funding tests for selected scope, conflict detection and unchanged adjacent months; server typecheck; client build. Add a browser check only for newly introduced scope/confirmation behavior.

## P1 · Forecast explains why a balance changes

**Evidence:** forecast chart has event markers and Accounts/Cash Flow/Events subviews; expanded rows expose balance components. Assumptions describe baseline spending and dollar basis. Exact formulas are unrecovered.

**Trigger/result:** selecting a forecast date/scenario shows the existing calculation's opening balance, dated events, variable spending and ending balance alongside its curve, with source freshness and assumptions.

**Seam:** [Forecast.tsx](../../client/src/pages/Forecast.tsx), [api/forecast.ts](../../client/src/api/forecast.ts), [forecastService.ts](../../server/src/services/forecastService.ts), [forecastService.test.ts](../../server/src/services/forecastService.test.ts). The existing daily results/events are the starting contract.

**Invariants:** read-only calculation; no creation of ledger rows or category assignments; no double counting scheduled income, future register rows and household shares; display assumptions as assumptions. Do not substitute a long-term net-worth model for the current liquid-cash forecast.

**Acceptance:** displayed components reconcile to the service's daily balance at integer precision; scenario selection updates explanation and chart together; estimates and actual future register events differ visibly; warnings remain available on narrow screens; keyboard selection exposes the same information as hover.

**Smallest checks:** extend the existing focused forecast test only if calculation/contract changes; otherwise client interaction/build checks for explanation selection, totals and empty results. Run server typecheck for API changes.

## P2 · Save forecast assumptions with an explicit draft boundary

**Evidence:** Monarch shows named scenarios, Duplicate/Delete and Saved time; opening an Expense template immediately saved a zero-dollar event. This last behavior is a discovered write boundary, not a recommended pattern. Birthday editing explicitly affects shared profile data.

**Trigger/result:** Create scenario/event opens a draft, then explicit Create saves it; duplicate creates an independent definition. Subsequent edits show saving/saved/error states and clearly identify any shared-profile changes.

**Seam:** [Forecast.tsx](../../client/src/pages/Forecast.tsx), [api/forecast.ts](../../client/src/api/forecast.ts), [routes/forecast.ts](../../server/src/routes/forecast.ts), [forecastConfig.ts](../../server/src/services/forecastConfig.ts). FlyBudget currently sends unsaved assumptions to a read-only endpoint: persistence is a new proposal, not a small UI toggle.

**Invariants:** separate additive scenario-definition storage from ledger facts; version input schema; account/goal references validated; saving assumptions never posts transactions, changes goals or updates profile fields implicitly. Deleting a scenario must not delete financial data.

**Acceptance:** Cancel creates nothing; failed saves retain the draft; refresh restores explicitly saved definitions; duplicate edits do not affect original; deletion explains its scope; deleted account/goal references produce a warning. Establish conflict handling before supporting simultaneous editors.

**Smallest checks:** focused CRUD/authorization/validation tests against disposable SQLite; forecast regression tests; server typecheck; client build and one draft/save/cancel browser flow. No new long-term event catalogue is required for this ticket.

## P2 · Make recurring empty states direct and explain definitions versus occurrences

**Evidence:** Monthly/All recurring separate upcoming periods from definitions; Monthly offers List/Calendar, month navigation and direct income/expense setup actions. Populated menus, detection and matching were not captured.

**Trigger/result:** an empty month explains whether there are no definitions or simply no occurrences in that month, and offers Create recurring income/expense or change month. Editing a definition identifies its effect on future occurrences.

**Seam:** [RecurringTransactions.tsx](../../client/src/pages/RecurringTransactions.tsx), [RecurringFormModal.tsx](../../client/src/components/recurring/RecurringFormModal.tsx), [scheduleService.ts](../../server/src/services/scheduleService.ts), [scheduleDiscovery.ts](../../server/src/services/scheduleDiscovery.ts).

**Invariants:** definitions, occurrences and settled transactions remain separate; detection is a suggestion; adopting a schedule must not silently reclassify existing rows or create duplicate settled entries.

**Acceptance:** empty state actions open correctly typed drafts; Cancel leaves data untouched; switching List/Calendar/month preserves relevant context; any matching suggestion explains candidate date/amount/source and requires explicit acceptance. The latter explanation is a FlyBudget proposal, not observed Monarch matching behavior.

**Smallest checks:** client build plus focused empty-state/navigation checks. Only if matching/service behavior changes, add focused schedule-service tests and run server typecheck.

## P2 · Make dashboard personalization and missing prerequisites legible

**Evidence:** Customize displays widget visibility and drag handles; widgets show setup explanations when unavailable. Monarch's drag/save persistence was not tested.

**Trigger/result:** Customize identifies whether changes apply immediately and which device layout they affect; hidden-card recovery is obvious. A card lacking inputs explains the missing prerequisite and links to its existing setup workflow.

**Seam:** [CustomizeHome.tsx](../../client/src/components/dashboard/CustomizeHome.tsx), [Dashboard.tsx](../../client/src/pages/Dashboard.tsx), [homeCards.ts](../../client/src/utils/homeCards.ts), [preferencesStore.ts](../../client/src/store/preferencesStore.ts). FlyBudget already has show/hide/reorder and button-based move controls; audit their labeling/focus before adding drag behavior.

**Invariants:** widget changes affect preferences only, never budget data; retain separate desktop/phone layouts; hidden/unavailable data must not appear as a misleading zero.

**Acceptance:** scope and immediate-save behavior are stated; move controls are keyboard accessible; focus remains on moved item; restoring cards works from an empty dashboard; setup links point to real supported features. Do not add unavailable credit-score/business/AI widgets for parity.

**Smallest checks:** focused preference normalization tests if logic changes; client build and keyboard/focus inspection. No server work or ledger tests for wording/layout changes.

## Deferred until evidence or a separate product decision

- Investments performance, benchmarks, quotes and security details: manual holdings, prices and unrealized gain shipped as P3 ([INVESTMENTS.md](../INVESTMENTS.md)); connected runtime behavior and a returns methodology are still missing.
- Long-term retirement/tax/superannuation mechanics: labels and controls do not establish calculation rules. Australian models require separate requirements and synthetic validation.
- Event dragging, comparison alignment, withdrawal/surplus allocation: visible controls do not establish exact persistence or numerical semantics.
- AI assistant, receipt ingestion, retail sync, bill sync, credit score and household invitations: external services, consent and product scope are unresolved.
- New hidden/review/attachment dimensions: inspect current FlyBudget data semantics first. A visible Monarch filter does not justify introducing a boolean with untested accounting effects.

Implement each accepted ticket on a feature branch with a focused PR. Apply the repository's normal release procedure only for app changes; this backlog is documentation and needs no release.
