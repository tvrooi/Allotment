# Actual Budget comparison: where FlyBudget falls short

Investigation date: 28 October 2026. Sources read, not run:

- **Actual** `actualbudget/actual` at `dff6b4b` (`ACT`): `packages/loot-core` (engine, rules, schedules,
  importers), `packages/desktop-client` (UI), `packages/api`, `packages/cli`, `packages/crdt` and the
  user docs in `packages/docs/docs`. Actual was not installed or exercised; behavior comes from its
  source and documentation.
- **FlyBudget** at `297497b` (`0.2.0-up.48`, `SRC`). One synthetic benchmark was run against `SRC`
  (below); no budget data was read or changed.

This is a proposed backlog, not authorization to implement it. Line references describe the commits
above. Items already ticketed in the [YNAB gap list](ynab-flybudget-budget-gaps.md) are referenced
(`BUD-*`) instead of repeated.

## Summary

Actual and FlyBudget now share the same core budget arithmetic: Ready to Assign ("To Budget" in
Actual) is a ledger in which overspending resets at the month boundary and comes out of the next
month's figure (`ACT packages/loot-core/src/server/budget/envelope.ts`, `last-month-overspent`;
FlyBudget `fundingState`, since `0.2.0-up.47`). The gaps are around that core, in order of impact:

| ID     | Priority | Gap                                                                                 |
| ------ | -------- | ----------------------------------------------------------------------------------- |
| ACT-01 | P1       | Deleting a category into another drops its assignment history                       |
| ACT-02 | P1       | Recomputing from scratch makes past-month edits slow (6.4 s on 5 years)             |
| ACT-03 | P2       | No "hold for next month" (manual or automatic)                                      |
| ACT-04 | P2       | No per-category "keep overspending" (reimbursables)                                 |
| ACT-05 | P2       | No month-level quick fills (copy last month, averages, zero)                        |
| ACT-06 | P2       | Targets lack priorities, history averages, remainder weights, caps, cleanup         |
| ACT-07 | P2       | No YNAB or OFX/QFX/QIF import                                                       |
| ACT-08 | P2       | Register lacks keyboard editing, cleared state, command palette, duplicate merge    |
| ACT-09 | P2       | Offline is read-only plus new transactions; no multi-device merge or E2E encryption |
| ACT-10 | P3       | No public read/write API or CLI                                                     |
| ACT-11 | P3       | No multi-month budget view, category/month notes, or category merge                 |
| ACT-12 | P3       | Rule stages, set-any-field, schedule-link and formula actions                       |
| ACT-13 | P3       | English only; no translation layer                                                  |
| ACT-14 | P3       | Smaller report gaps: crossover point, formula cards                                 |

FlyBudget is ahead of Actual in several areas (see [Where FlyBudget leads](#where-flybudget-leads)),
so this is not a case for copying Actual wholesale.

## P1 · ACT-01: deleting a category into another drops its assignment history

- **FlyBudget:** `DELETE /categories/:id?reassignTo=` moves the category's transactions to the target
  and then deletes the category's `budget_months` rows
  ([categories.ts](../../server/src/routes/categories.ts#L206), line 220). The target inherits every
  past month's spending without the money that funded it.
- **Consequence under the ledger engine:** a fully funded, fully spent category (say $500 assigned and
  $500 spent in September) becomes a $500 deficit in the target for September. That is cash
  overspending, so October's Ready to Assign drops by $500 and every later month after it. A routine
  tidy-up silently rewrites history.
- **Actual:** `deleteCategory(category, transferId)` first adds the deleted category's budgeted amount
  into the target for every month (`doTransfer`, `ACT packages/loot-core/src/server/budget/base.ts`
  line 345), then records a `category_mapping` so references to the old id resolve to the new one
  (`ACT packages/loot-core/src/server/db/index.ts` line 538).
- **Fix:** in one transaction, add each month's assignment to the target's row for that month
  (upsert, summing), then delete. Without `reassignTo`, refuse deletion of a category that has
  assignments or activity, or require an explicit choice; today its spending becomes uncategorised
  and its assignments vanish.
- **Acceptance:** for every month, Ready to Assign and the sum of Available are unchanged by a merge;
  extend `readyToAssign.test.ts` with a merge case. Category deletion is a budget write, so it also
  needs change-set undo.

## P1 · ACT-02: from-scratch recomputation makes past-month edits slow

- **FlyBudget:** every summary rebuilds the whole envelope history (`rawBudgetGroups` and
  `assessment` in [budgetService.ts](../../server/src/services/budgetService.ts#L35)). The
  assignment guard calls `fundingState` once for each checked month
  ([budgetMoves.ts](../../server/src/services/budgetMoves.ts#L158)), and `previewMove` does the same
  (line 76). Cost grows with the square of the history length.
- **Measured** (synthetic: 60 months, 30 categories, 19,860 transactions, this container's CPU):

  | Operation                         | Time    |
  | --------------------------------- | ------- |
  | Budget groups, current month      | 61 ms   |
  | Summary, current month            | 226 ms  |
  | Summary, next month               | 273 ms  |
  | Summary, January 2023             | 147 ms  |
  | Guarded assignment, current month | 352 ms  |
  | Guarded assignment, January 2023  | 6356 ms |

  The live app runs on an N100 Home Assistant host and will be slower than this.

- **Actual:** an incremental spreadsheet engine (`ACT packages/loot-core/src/server/spreadsheet`):
  each month's `leftover-<category>` cell depends on the previous month's, and a change recomputes
  only the dependent cells.
- **Fix, keeping "recompute from raw records" as the source of truth:**
  1. Compute every month's envelope state in one pass. A single history walk yields carry,
     deficits and `unassignedBeforeLater` for all months, so the guard and moves become one
     calculation instead of one per month.
  2. Cache that per-month state keyed by `fundingRevision()`. The revision already changes on every
     relevant write, so the cache can never serve stale figures.
  3. Keep the existing from-scratch recompute test as the oracle for both.
- **Acceptance:** the January 2023 case under 500 ms on the same synthetic budget; the 40-budget
  recompute test still passes.

## P2 · ACT-03: hold money for next month

- **Actual:** **Hold for next month** takes an amount out of this month's To Budget and adds it to
  the next month's; **Reset next month's buffer** undoes it (`holdForNextMonth`, `resetHold` in
  `ACT …/budget/actions.ts` lines 485–515; `buffered` cells in `envelope.ts`). **Auto hold** does this
  for chosen income categories every month, for people living on last month's income
  (`docs/budgeting/index.md`, "Automatic Holding of Funds").
- **FlyBudget:** no equivalent. Money can only stay unassigned, so "Fully budgeted" can't be reached
  while deliberately saving this month's pay for next month.
- **Seam:** a per-month `held` amount next to assignments (additive table), included in the ledger as
  `unassignedBeforeLater − held` this month and `+ held` the next. It must pass the assignment guard
  like any other assignment.

## P2 · ACT-04: keep overspending in a category

- **Actual:** **Rollover overspending** per category: a negative balance carries into the next month
  instead of resetting, and is excluded from `last-month-overspent` (`carryover-<id>` in
  `envelope.ts`; `setCategoryCarryover`, `actions.ts` line 703). Used for reimbursable expenses.
- **FlyBudget:** one rule for all expense categories (`rollOver`, `resets`); only card payment and
  income categories keep running totals.
- **Seam:** a category flag that sets `resets = false` in `rawBudgetGroups`. It needs care in the card
  engine's `poolAt` reset, and the deficit must stay disclosed in Review.

## P2 · ACT-05: month-level quick fills

- **Actual:** the month menu offers copy last month's budget, set to zero, 3-, 6- and 12-month
  averages, copy until year end, and a per-category "copy single previous month" (`copyPreviousMonth`,
  `setZero`, `set3MonthAvg`, `copyUntilYearEnd` in `actions.ts` lines 217–700). Each is one undoable
  batch.
- **FlyBudget:** per-category bulk "apply to all future months"
  ([budget.ts](../../server/src/routes/budget.ts#L260)), target funding, and payday plans. There's no
  whole-month copy or average fill.
- **Seam:** preview and apply through `fundedWrite` as one write, like target funding.

## P2 · ACT-06: richer targets

- **Actual budget automation** (`docs/experimental/budget-automation.md`,
  `ACT …/budget/goal-template.ts`) adds, beyond FlyBudget's monthly, by-date, recurring-bill and
  refill targets ([CATEGORY-TARGETS.md](../CATEGORY-TARGETS.md)):
  - **From history:** the average of the last N months.
  - **% of income.**
  - **Cover schedule:** fund the linked schedules due.
  - **Whatever is left:** distribute the remainder by weights.
  - **Balance cap.**
  - **Several lines per category**, applied in **priority order** across the whole budget.
  - **End-of-month cleanup:** sweep leftovers from source categories into sink categories by weight
    (`cleanup-template.ts`).
- **FlyBudget:** one target per category, funded in budget order. Payday plans already have
  `percentage` and `remainder` methods ([paydayConfig.ts](../../server/src/services/paydayConfig.ts#L8))
  that targets could reuse.
- Related: `BUD-07` (target cadence shortcuts).

## P2 · ACT-07: import from YNAB and from bank files

- **Actual:** importers for YNAB 4 and current YNAB (`ACT …/server/importers/ynab4.ts`, `ynab5.ts`)
  bring over accounts, categories, assignments and history. File import covers OFX, QFX, QIF, CAMT
  and CSV (`docs/transactions/importing.md`).
- **FlyBudget:** CSV and CAMT import; no OFX/QFX/QIF and no YNAB import.
- **Why it matters here:** the owner budgets the YNAB way. A YNAB import (assignments by month,
  categories, payees, transfers) would bring real history into the new ledger instead of a budget
  start that hides it. It must map YNAB's "Inflow: Ready to Assign" to income categories and
  preserve integer minor units.

## P2 · ACT-08: register editing, cleared state and duplicates

- **Actual:**
  - Spreadsheet-style register: J/K or arrows to move, Space to select, Tab/Enter between cells,
    inline splits, and Enter on a new transaction to turn it into a schedule
    (`ACT packages/desktop-client/src/components/modals/KeyboardShortcutModal.tsx`).
  - A command palette (Ctrl/Cmd+K, `CommandBar.tsx`) and a privacy filter that hides amounts.
  - Three transaction states: uncleared, cleared, reconciled (`types/models/transaction.ts`), with
    cleared and uncleared balances per account.
  - **Merge duplicate transactions** (`docs/transactions/merging.md`).
- **FlyBudget:** detail-panel editing with Escape and Enter; global undo
  ([useUndoKeyboard.ts](../../client/src/hooks/useUndoKeyboard.ts)). Only a `reconciled` flag
  ([schema.ts](../../server/src/db/schema.ts#L95)). No duplicate merge; duplicates are prevented on
  import by stable ids, but manual duplicates can't be combined.
- Related: `BUD-05` (budget-table keyboard input).

## P2 · ACT-09: offline and multi-device

- **Actual:** local-first. Every device holds the whole budget, all edits work offline, and changes
  merge through a CRDT message log (`ACT packages/crdt`) with optional end-to-end encryption of
  synced data (`docs/getting-started/sync.md`, Settings → Encryption).
- **FlyBudget:** server-first. The offline copy is a read-only snapshot plus a queue for _new_
  transactions; edits, deletes and budget changes wait for the server
  ([DEVELOPMENT.md](../DEVELOPMENT.md), "Offline copy" and "Waiting transactions"). Data is
  protected by HTTPS and the server's password, not end-to-end encryption.
- **Judgement:** full CRDT sync would be a rewrite, and it conflicts with server-side bank sync and
  the ledger guard. The realistic step is queueing assignment changes offline and applying them
  through `fundedWrite` with revision checks when the server is reachable (the same model as waiting
  transactions). Recorded so the difference is a decision, not an oversight.

## P3 · ACT-10: public API and CLI

- **Actual:** `@actual-app/api` exposes read and write methods for budgets, transactions, rules,
  schedules, holds and queries (`ACT packages/api/methods.ts`), and `packages/cli` wraps them.
- **FlyBudget:** the internal REST API, plus read-only and scoped tokens and MCP tools for assistants
  ([READ-ONLY-ACCESS.md](../READ-ONLY-ACCESS.md)). Writes beyond the owner-approved token exceptions
  are deliberately excluded. A documented owner-token API for scripting (imports, assignments) would
  need its own security review.

## P3 · ACT-11: multi-month view, notes and category merge

- **Actual:** the budget shows as many months side by side as the width allows; notes on
  categories, groups, months and accounts (`components/Notes.tsx`); merge categories.
- **FlyBudget:** one month at a time. `budget_months.notes` exists
  ([schema.ts](../../server/src/db/schema.ts#L144)) but nothing reads or writes it. Category merge is
  ACT-01.
- Related: `BUD-04`, `BUD-10` (inspector and notes).

## P3 · ACT-12: rule capabilities

- **FlyBudget's rules are close to Actual's** and add household sharing, tax claims and tags
  ([rulesEngine.ts](../../server/src/services/rulesEngine.ts#L53)).
- **Actual additionally has:**
  - Pre, default and post stages (`rule.ts`).
  - `set` on any field (account, date, amount, cleared).
  - `link-schedule` and `delete-transaction` actions.
  - Formula and template actions (`action.ts`, `docs/experimental/rule-templating.md`).
  - A `hasTags` condition.
  - Automatic rule creation from the user's categorisations (`docs/budgeting/rules/index.md`,
    "Automatic Rules"). FlyBudget has payee default categories instead.

## P3 · ACT-13: translation

Actual routes user text through i18next with a lint rule that enforces it (482 files use it). FlyBudget
is English only. Low priority for a single-owner fork; costly to retrofit later.

## P3 · ACT-14: report gaps

- **FlyBudget already has** dashboards, custom reports, Sankey cash flow, a calendar (Recurring),
  forecasts and a long-term simulation.
- **Actual additionally has:**
  - A crossover-point report (when investment income covers spending).
  - Formula cards (`docs/experimental/formulas.md`).
  - A budget-analysis report.

## Where FlyBudget leads

These have no Actual equivalent, or only a manual workaround:

- **Native Up sync**, with round-up accounting checks.
- **Real multi-currency** with dated rates; Actual's multi-currency guide is a rule-template
  workaround.
- **Reviewed credit-card payment funding:** funded purchases move into a payment reserve, and credit
  overspending is kept apart from cash. Actual leaves this to manual strategies
  (`docs/budgeting/credit-cards`).
- **Households and shared expenses.**
- **Receipts with local OCR, and ATO tax deductions.**
- **Payday plans.**
- **Review, resilience and long-term forecasts** with super and HECS-HELP.
- **Investments.**
- **Scoped AI access tokens.**

## Suggested order

1. **ACT-01**, a correctness bug that rewrites history.
2. **ACT-02**, before features that add more months to check.
3. **ACT-03, ACT-04 and ACT-05**: small, contained ledger additions.
4. **ACT-07 YNAB import.**
5. **ACT-06**, together with `BUD-07`.
6. The rest as wanted.
