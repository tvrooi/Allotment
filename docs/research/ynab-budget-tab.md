# YNAB monthly Budget/Plan tab: observed behavior and FlyBudget comparison

Investigated 24 October 2026 in local Chrome through REA. The product calls this surface **Plan**; this report retains Budget where it matches the brief or FlyBudget.
YNAB page metadata reported `26.157`; Chrome reported `156.0.8078.47`. These identify the inspected session, not a claim about every deployment.
FlyBudget source baseline: `5bb4b652b931212b6883d126472dbc1f410bed80` (`SRC`).

The user confirmed a separate synthetic YNAB budget for testing. Mutations below were performed there after checking the test-budget identity.
No FlyBudget application code or budget data was changed, and no production budget was edited.
Raw browser captures remain outside the repository. This report omits budget/account identifiers, account names, email addresses and session material.
Generic category labels and deliberately entered amounts are synthetic examples.
The investigation used the existing test budget. Three synthetic transactions ($30 cash, $40 card and $10 funded card), assignments and the monthly refill target remain.
Temporary overassignment, multi-category funding and the $10 move to RTA were undone; temporary notes were restored. The entire fixture was not reset.

The principal finding is a workflow gap around an existing accounting foundation: FlyBudget already has envelopes, atomic moves, targets, funding guards and reviewed card reserves.
YNAB integrates these tasks into row selection, a contextual inspector and immediate scoped assignment actions.
Two verified accounting differences must stay explicit: YNAB resets overspent category availability at month rollover and accepts manual overassignment; FlyBudget retains deficits and guards new reservations.
Neither difference should be changed as a cosmetic parity fix.

## Evidence and limits

**Observed** means a completed REA step and the corresponding settled UI state, or a screenshot inspected during the run.
**Source-confirmed** describes FlyBudget code at `SRC`; it does not mean its UI was run in this investigation.
**Inferred** is a proposed explanation of observed results. **Unknown** means the action, edge case or formula has not been established.
Official documentation is separately indexed as `DOC-*`; a documented behavior is not automatically a live-test result.

The snapshots are sequential, not independent clean budgets: later tests reuse earlier assignments and synthetic transactions.
Only the stated before/after deltas should be compared across scenarios. Some immediate snapshots showed an updated editor before totals settled; final comparisons use later successful checkpoints.
Failed selector steps were not counted as successful tests. For example, the first ArrowDown attempt failed after Tab, but a subsequent fresh-editor ArrowDown test succeeded.
No offline, multi-client conflict, slow-server failure or native mobile-app test was performed.

### Compact REA evidence index

The opaque IDs identify tool results in this investigation session; they contain no bank/account identifiers. Checkpoint names identify the relevant successful result within a scenario.

| Label   | Scenario / checkpoints                                                               | REA evidence ID                                                       |
| ------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| LIVE-01 | Layout and single-category inspector; `ynabMath1 / observe-saved`                    | `ev_c9f92c45087993ff74f770d1eaccda7bf2ab7c58b39ccb9fc2f9d1d9e0609313` |
| LIVE-01 | Two-category and whole-month inspectors; `ynabMultiHeader / funded, restored, clear` | `ev_b5c153757e4821beeab58ad1bce3d7683fad25709e3c985d5334f038f1ff6cec` |
| LIVE-02 | Addition; `ynabMath1 / observe-saved`                                                | `ev_c9f92c45087993ff74f770d1eaccda7bf2ab7c58b39ccb9fc2f9d1d9e0609313` |
| LIVE-02 | Multiply, undo, redo, Tab; `ynabMathKeys / undo-settle, redo-settle, tab-next`       | `ev_fbca3dd2ead158139cfb87169e685865368f02ba21b051229812da2816dd4216` |
| LIVE-02 | Fresh-editor ArrowDown; `ynabTargetOpen / arrow-down`                                | `ev_5241f4cf54fe6feafc588f0c51a14afa15c0dad73747ec80588ea470312c80ff` |
| LIVE-02 | Replace $350 with literal `+50`, save $50, undo                                      | `ev_89fee544e86e970b006559a4743d874dc792b388a4759c2998dd382f38290dcd` |
| LIVE-02 | Replace $350 with literal `*2`, save $2                                              | `ev_a5bd8dd7b25349b87e700202abb76eaad26c64594b0d6cfe379f6f358f93e0b4` |
| LIVE-02 | Original $350 assignment restored                                                    | `ev_ca94820b298b96fd9c59de773334b6429193984b597f8a74daff124516da4404` |
| LIVE-03 | Monthly target; `ynabTargetCommit / settle`                                          | `ev_f02f214cfe542a68070261b887e3274dd86f2843f40d10d6b33c45b56b7c89f1` |
| LIVE-03 | Single-category Underfunded; `ynabMoveOpen / settle`                                 | `ev_17380490cb4bd0db2102bcfa548363178f7c18be72f662dab2bbde7a747b4aea` |
| LIVE-03 | Weekly target; `ynabWeekly / settle`                                                 | `ev_2e4e43a73eac4a1e197c4ac2218f8e262b52b56825ad0fd91b4c3355685623a9` |
| LIVE-03 | Yearly target and custom choices; `ynabYearlyCustom / settle, custom-behavior`       | `ev_9d1d315497f42b276a4ed3224ec66958aa7f8987f72e57d3a7481e1f094d9934` |
| LIVE-03 | Undated balance target; `ynabCustomBalance / settle`                                 | `ev_d84b64ad9b43d5bf0641a35c36f9b8557f85b05fac6b0e03d4d1ec7615e981c8` |
| LIVE-03 | Monthly refill; `ynabRefill / current, future`                                       | `ev_a7401249504040def6aac0422a113e53ca354aceaca63f0cc73791ff5bb16124` |
| LIVE-03 | Multi-selection Underfunded and undo; `ynabMultiHeader / funded, restored`           | `ev_b5c153757e4821beeab58ad1bce3d7683fad25709e3c985d5334f038f1ff6cec` |
| LIVE-04 | $50 category move; `ynabMoveCommit / settle`                                         | `ev_67bfb4d0aa8637f2693a804bce8301daf9af2e5954ec946f2dfa1d127bf3ec68` |
| LIVE-04 | Cash cover and credit assignment; `ynabCoverDone / settle, card-covered`             | `ev_75f98cc7b5256dbeaceea9732143480672b5b6e2cc9b05deb540270019c774d3` |
| LIVE-05 | RTA breakdown; `ynabRta / rta`                                                       | `ev_4a613eb7279f14422db59bf9d0e380435efde076f24ac529de073d143f3e3b3f` |
| LIVE-05 | Future assignment; `ynabFuture / future-settle, rta-breakdown`                       | `ev_88eedc05884a9dc461a5c5250b5a70a6e51471cf06f188c645e6716c60de9ba4` |
| LIVE-05 | Accepted overassignment; `ynabOverassignCard / negative, restored`                   | `ev_d9f5f6b98705e52982f24f84e3ab78cbbdec7d7e27d60e9cad6e82c56b9cd1d7` |
| LIVE-06 | Cash overspending/rollover; `ynabCashOverspend / plan-settle, rollover, breakdown`   | `ev_a0e67b16b47fe31bd993b47583ffadeb2b4c6df0e3408df37bce04364a736ca7` |
| LIVE-06 | Credit overspending/rollover; `ynabCreditOverspend / plan-settle, rollover`          | `ev_d93c7ed3fc0ffabe3d83098be0181d8d2bd14e468d30bcbd3a4af7b982fa02ed` |
| LIVE-06 | Funded card purchase; `ynabFundedCard / plan-settle`                                 | `ev_ad1660cd1ea930365829e28d8204294d9b427acaca39fccdd2294d5a55151a88` |
| LIVE-07 | 900px desktop viewport and screenshot                                                | `ev_e03893f625699ad2a7da7cb79499f387eb1efe36612288015935949ab6d881c8` |
| LIVE-07 | 390px desktop viewport and screenshot                                                | `ev_425ad081b3aa7c13c94bcb2563288f0151a5c08f0ea6ddbf1fc7caafb84abf19` |
| LIVE-08 | Hide/undo and group collapse; `ynabHiddenNotes`                                      | `ev_245bf108f6b2d34f1e03e9fba5da2525eba356ca23dab9fd4da801ece38050a1` |
| LIVE-08 | Month-note save/reload; `ynabNotePersistence`                                        | `ev_0834e9d30c16079ffb4d175185098e9d2708ee49b4bd415c22fef702b8676f33` |
| LIVE-08 | Category-note blur save/reload; `ynabCategoryNoteSaved`                              | `ev_632818d75ce5dfdd50b0492a215defff038a135404835e9580b571a41f005b56` |
| LIVE-08 | Temporary category note cleared successfully                                         | `ev_9d17460e5a3ab87fcbb0d1ab85d2d5266332a9371d1b9e118e56497c5a1fe328` |
| LIVE-09 | Header Underfunded preview, not confirmed; `ynabHeaderPreview`                       | `ev_669baf0db92d19031408906c5ad7b17e13f468fa3724c104f1a48f87a831323b` |
| LIVE-04 | Move to RTA and Recent Moves; `ynabRtaMoveHistory`                                   | `ev_22f11bdd0ee8318f6acd050acdffe661375b63b0a3ab36606c25dd4c623318e5` |

### Official reference index

These links provide current product terminology and follow-up guidance. Live conclusions below cite `LIVE-*`, not documentation alone.

- `DOC-header`: [Plan header](https://support.ynab.com/en_us/the-plan-header-BkmiuJ_C9).
- `DOC-targets`: [Targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks).
- `DOC-auto`: [Auto-Assign](https://support.ynab.com/en_us/auto-assign-a-guide-r1gBNbBJo).
- `DOC-rollover`: [Month rollover](https://support.ynab.com/en_us/when-the-month-rolls-over-a-guide-rkyyd6qC9).
- `DOC-colors`: [Colors and icons](https://support.ynab.com/en_us/colors-and-icons-in-your-plan-HJQv_XHko).
- `DOC-keys`: [Keyboard shortcuts](https://support.ynab.com/en_us/keyboard-shortcuts-Skw9Xp9A9?mobile-help=true).
- `DOC-moves`: [Moving money](https://support.ynab.com/en_us/moving-money-in-your-plan-ryyCKbBJi?mobile-help=true).
- `DOC-cards`: [Credit-card payments](https://support.ynab.com/en_us/credit-card-payments-a-guide-r1_506Q1j).

## 1. Layout, groups, selection and narrow widths

**Observed — LIVE-01:** The month header, RTA area and table form the main workspace. Table columns are Assigned, Activity and Available; group rows aggregate categories.
Categories have selection checkboxes, group collapse controls and target/progress text. Credit Card Payments appears as a distinct group.
The inspector changes with selection: one category shows its balance breakdown, target and assignment assistance; multiple selections show a combined summary; clearing selection restores the monthly summary.
The whole-month summary includes future assignments. This makes the scope of the same assistance controls depend on selection.

**Observed — LIVE-07:** At 900px the inspector was off viewport. At 390px the desktop sidebar/table clipped rather than becoming FlyBudget-style phone cards.
Screenshots used desktop Chrome's user agent and DPR 2. This was responsive desktop inspection, not YNAB's native phone experience or a verified mobile browser mode.
Do not adopt clipping as a parity requirement.

**FlyBudget — partly matches, differs, missing:** Monthly columns and collapsed sections exist.
[Expense grouping](../../client/src/pages/Budget.tsx#L410) uses four fixed budget types, flattening saved category groups; [inactive filtering](../../client/src/utils/budgetFigures.ts#L76) is automatic rather than explicit user hiding.
[PhoneBudget](../../client/src/components/budget/PhoneBudget.tsx#L29) is a dedicated card/sheet layout, and the desktop [sidebar](../../client/src/pages/Budget.tsx#L761) is a fixed summary/cards/moves surface.
Contextual selection and inspector are missing. `LIVE-08` additionally verified hiding a zero-balance Entertainment row: it disappeared, Hidden Categories appeared, and Undo restored it.
Collapsing Needs hid children while retaining group totals; reexpanding restored the rows. Hiding funded/overspent categories and explicit unhide were not tested.

## 2. Assignment entry, keyboard, arithmetic and undo

**Observed — LIVE-02:** Entering `100+50` produced $150; `150*2` produced $300.
A separate literal-replacement test replaced $350 with `+50`; Enter saved $50, not $400, and Undo restored $350. Replacing $350 with `*2` saved $2, not $700; $350 was subsequently restored.
These tests establish replacement-text semantics, not what happens when individual operator keystrokes are typed while the existing amount is selected. Do not assume leading shorthand increments or multiplies the old amount.
Undo restored $150 and Redo restored $300. A fresh-editor ArrowDown selected the next category and opened its assignment editor.
Tab left the current editor; the exact resulting focus destination was not established. The failed subsequent ArrowDown step does not establish grid behavior from that focus state.
Operator keystrokes with the existing amount selected, Shift+Tab, ArrowUp, keyboard behavior at group boundaries and malformed/localized expressions remain unknown.

**Observed — LIVE-03:** Selecting Rent and Groceries exposed a combined $1,700 Underfunded action.
Invoking it immediately assigned $1,650 and $50 respectively; one Undo restored both assignments.
This verifies a selected-category operation and grouped undo, not every bulk command or a general arbitrary-amount batch editor.

**FlyBudget — partly matches, missing:** [AmountInput](../../client/src/pages/Budget.tsx#L33) selects text, saves on Enter/blur and cancels on Escape.
[Currency input](../../client/src/utils/currency.ts#L281) parses an amount, not an expression; no budget-grid keyboard controller or selected-category batch flow is present.
[Manual assignment undo](../../client/src/hooks/useBudget.ts#L23) exists with revision checks, and [global shortcuts](../../client/src/hooks/useUndoKeyboard.ts#L7) deliberately leave text inputs alone.
The existing [12-month bulk preview](../../client/src/components/budget/BulkPreview.tsx#L21) is one category across months, a different scope from YNAB selected categories.
Phone [save](../../client/src/components/budget/BudgetAmountSheet.tsx#L80) takes the absolute value while desktop permits signed parsing; consistency needs a separate implementation decision.

## 3. Move money and cover overspending

**Observed — LIVE-04:** Clicking a positive Available amount opened the move interaction.
A $50 move changed Groceries $400 → $350 and Transportation $0 → $50, with RTA unchanged.
The target then reported the source's renewed shortfall; moving an envelope's money is separate from adding resources.
Covering a $30 cash deficit from Transportation left the overspent category at zero and Transportation reduced by $30.
Assigning $40 to the credit-overspent category covered its negative Available and increased payment funding by $40 (`LIVE-06`).
`LIVE-04` later verified moving $10 from Groceries to RTA: assigned and Available each fell $10 while RTA rose $10; Undo restored the prior state.
Recent Moves exposed All, Moved and Assigned tabs with dated descriptions. Moving from RTA through that same popover, source-search edge cases and insufficient-source behavior remain unverified.

**FlyBudget — accounting capability matches, interaction differs:** [MoneyMoves](../../client/src/components/budget/MoneyMoves.tsx#L97) already previews and atomically applies moves and cover, with history and undo.
It lives in the sidebar; the [Available pill](../../client/src/pages/Budget.tsx#L183) is a noninteractive span.
The [service](../../server/src/services/budgetMoves.ts#L41) accepts expense-category pairs and enforces source availability through affected months; RTA is not a move endpoint.
Reuse this service for row-anchored interactions. Its [target notice](../../server/src/services/budgetMoves.ts#L94) is generic rather than a calculated before/after target impact.

## 4. Available colors, target states and progress

**Observed — LIVE-03/05/06:** The test distinguished target underfunding, funded spending, cash overspending, credit overspending and negative RTA.
Monthly target progress changed from 75% to funded after the missing $100 was assigned; later moving $50 away restored a shortfall.
Cash and card overspending had different downstream month behavior even though each had negative Available.
Manual overassignment produced the red RTA state with Fix This. The evidence does not establish every pill/icon/color combination or mixed cash/card priority rule.
**Documented — [DOC-colors](https://support.ynab.com/en_us/colors-and-icons-in-your-plan-HJQv_XHko):** The full meaning includes target and scheduled-payment status, not just balance sign. This reference matrix is not a claim that every combination was exercised live.

| Available color | Documented meaning                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red             | Cash overspending; other envelopes still appear to hold money already spent.                                                                                         |
| Yellow          | Credit overspending, or insufficient funding for a target or upcoming scheduled transaction. Icons distinguish these causes.                                         |
| Green           | Positive available funds with scheduled spending covered and the target on track or snoozed; an undated savings goal can be green before reaching its final balance. |
| Gray            | Zero available with no underfunding warning.                                                                                                                         |

The credit warning, calendar and partial target icons explain different yellow states. Target progress and available money must therefore remain separate values.

**FlyBudget — differs:** [Pill styling](../../client/src/pages/Budget.tsx#L112) tests only positive, negative or zero balance; target warning text is separate.
[SpentBar](../../client/src/components/budget/SpentBar.tsx#L13) is a monthly spending/assignment ratio, not a target or carried-funds indicator.
Therefore a carried balance can be healthy while this month's spending bar is red; a positive balance may still have a target shortfall.
A shared semantic status model should preserve these distinctions and accessible text, not merely adopt YNAB colors.

## 5. Targets and assignment assistance

**Observed — LIVE-03:** The editor exposed Weekly, Monthly, Yearly and Custom choices, with behavior options within them.
The following are measured examples, not a complete reverse-engineered recurrence formula.

| Target fixture                                                 | Settled result                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly $400 with $300 assigned                                | 75% funded; $100 more needed. Sidebar Underfunded immediately assigned $100 without a confirmation step.                                              |
| Weekly $100, Saturday, created 24 October                      | Amount to assign in October was $200; existing $350 assignment already met it. Do not generalize this single creation-date fixture.                   |
| Yearly $1,200 due 1 November 2026, $350 assigned               | $250 more needed this month; $850 left to assign toward the total. The latter is total minus assigned, not an additional monthly requirement.         |
| Custom undated balance $1,200 with $340 Available              | $860 remaining to reach the balance; no Underfunded shortcut was shown. The panel used current balance rather than cumulative assignment as progress. |
| Monthly refill $400, October assigned $350 / Available $340    | $50 more needed; Funded was $350 despite the $10 purchase.                                                                                            |
| Same refill in future November, assigned $100 / Available $440 | $300 more needed despite projected carry of $340. The future target did not credit that projected carry in this snapshot.                             |
| Selected Rent + Groceries                                      | Underfunded $1,700 immediately applied $1,650 + $50; Undo restored both.                                                                              |

**Inferred:** Future-month refill conservatively withheld projected carry from the target calculation; actually crossing into that month was not tested.
The UI exposed Assigned Last Month, Average Assigned and reset actions; seeing a button is not proof of its mutation semantics.
The full set of history shortcuts, target snooze, repeat cycles and dates across years remain separate follow-ups.
**Observed — LIVE-09:** Header Assign → Underfunded opened an Auto-Assign Preview listing $1,650 and $50 for two categories, plus a card-attention warning and Cancel/Assign Money controls.
The preview was not confirmed. This is a distinct interaction from immediate single/multiple-selection inspector Underfunded actions; do not describe all auto-assign as immediate.

**FlyBudget — partly matches, differs:** [Four target types](../../client/src/components/budget/TargetCard.tsx#L11) already cover monthly, by-date, recurring-month and refill concepts.
They are not one-for-one equivalents of the observed choices: weekly cadence and the undated balance target need explicit mapping.
[Target calculation](../../server/src/services/targetService.ts#L43) uses carried funds for refill; compare its future-month behavior carefully with the verified YNAB example.
[Fund targets](../../server/src/services/targetService.ts#L148) previews all underfunded categories in budget order, capped at current resources, then requires apply.
That resembles the verified header review step but differs from the observed immediate scoped inspector Underfunded action. [Phone suggestions](../../client/src/components/budget/BudgetAmountSheet.tsx#L94) already apply last-month spending or average to the editor; desktop currently displays that history.

## 6. Month navigation and rollover

**Observed — LIVE-05/06:** Positive Available carried into the next month; a further $100 future assignment added to that carry.
A synthetic $30 cash overspend showed −$30 in October; November's category availability reset to zero and RTA was $30 lower.
A $40 credit overspend also reset to zero in November but caused no additional $40 RTA deduction and did not create extra payment reserve.
Covering overspending back in October changed the funding position. These observations are separate from a general claim about all historical edits or mixed-source spending.

**FlyBudget — positive carry matches, negative carry intentionally differs:** [Carry](../../server/src/services/budgetService.ts#L79) sums prior assignments plus signed activity, retaining negative envelopes across months.
[Active-category logic](../../client/src/utils/budgetFigures.ts#L19) keeps carry-only and deficit categories visible.
This policy is documented in [Envelope funding](../ENVELOPE-FUNDING.md). Copying YNAB's reset behavior would require an accounting design and compatibility review, not a row-rendering change.
Existing ledger rows must not be rewritten to make screenshots match.

## 7. Ready to Assign, future commitments and overassignment

**Observed — LIVE-05:** RTA has an expandable breakdown exposing inflow, assignment in the current month and assignment in future months.
Assigning $100 in November reduced October RTA by $100 and added a future-assignment entry; moving funds between two current categories did not alter RTA.
The displayed example reconciled inflow less current/future assignments. It is not enough evidence to derive every opening-balance, refund, transfer or debt case.
YNAB accepted a manually entered overassignment and displayed a red Fix This state; Undo restored the preceding position.

**FlyBudget — resource principle matches, formula/explanation and guard differ:** [fundingState](../../server/src/services/budgetService.ts#L147) computes resources minus positive current envelopes and positive future assignments.
It excludes future receipts and unreconciled generated salary; its summary has explicit as-of, missing-rate, uncategorized, deficit and card-shortfall states.
[BudgetSummaryWidget](../../client/src/components/budget/BudgetSummaryWidget.tsx#L165) shows future reservations but not the same interactive YNAB breakdown.
[fundedWrite](../../server/src/services/budgetMoves.ts#L126) rejects new increased reservations beyond resources while retaining legacy overcommitments.
Retain that guard unless separately authorized to redesign it; expected salary must never become money available today.

## 8. Credit-card payment categories

**Observed — LIVE-06:** A funded $10 card purchase reduced Groceries Available by $10 and raised the card-payment reserve by $10.
An initially unfunded $40 purchase did not increase reserve; later assigning $40 to cover its category increased reserve by $40.
This distinguishes money reserved for payment from outstanding debt. The test did not exercise card repayment, refunds, positive card balances, interest, multiple cards or historical setup migration.

**FlyBudget — core model comparable, presentation differs:** [Shared assessment](../../server/src/services/budgetService.ts#L99) already incorporates card funding.
[Payment categories](../../client/src/pages/Budget.tsx#L438) are excluded from the ordinary expense rows; [CardPayments](../../client/src/components/budget/CardPayments.tsx#L64) instead shows debt, reserve, shortfall and explicit setup/funding in the sidebar.
Reviewed cards and unreviewed net-debt treatment must remain distinguishable. Reuse these positions if introducing a payment group; do not create another card ledger.
The existing source tests cover substantially more card cases than this YNAB session observed.

## 9. Inspector and notes

**Observed — LIVE-01/03:** One selected category shows an Available breakdown separating prior cash, assigned funds, cash spending and credit spending.
It also shows target progress and scoped assignment actions. Multiple selections show aggregate assigned, activity and available figures for that selection.
With no selection, the inspector shows monthly totals, targets and future assignments. This context survives moving between editing and assistance operations.
**Observed — LIVE-08:** A month note saved through OK and survived reload; it was subsequently restored to empty.
Clicking the category Notes paragraph opened a textarea. A synthetic category note saved on blur when the row was deselected and survived reload/reselection; the temporary note was restored afterward.
Notes have distinct save interactions and scopes; neither can be represented by transaction notes alone.

**FlyBudget — information partly present, interaction missing:** The fixed [Budget sidebar](../../client/src/pages/Budget.tsx#L761) does not respond to row selection.
[CategoryDetail](../../client/src/pages/CategoryDetail.tsx#L136) already has budget figures, history, transactions and a target editor, while the assignment popover has history.
These are reusable sources for an inspector. [Category schema](../../server/src/db/schema.ts#L50) has no category-note field; transaction notes are a different entity.
Adding persistent notes would need additive storage and backup coverage, not only a text box.

## 10. Saving, loading, animation and errors

**Observed — LIVE-02/03/04:** Ordinary assignment, sidebar Underfunded and selected-category Underfunded updated the working plan without a separate confirmation dialog.
Moves and target edits had explicit commit controls. Undo restored single assignments and the tested selected-category funding operation.
Some immediate snapshots contained a newly edited assigned amount with older aggregate/Available text; settled snapshots converged.
This supports an asynchronous UI update observation, not a measured latency, animation duration or guarantee about server persistence.
No controlled save-error, offline, stale-client or network-delay experiment was run; animation smoothness was not measured.

**FlyBudget — source-confirmed seams:** [Month queries](../../client/src/hooks/useBudget.ts#L5) preserve previous data while loading, and [the page](../../client/src/pages/Budget.tsx#L589) fades it.
The ordinary editor checks connection state but not loaded-month identity; its save uses `selectedMonth` at line 487. This suggests a month-switch race and needs a delayed-response regression test before claiming reproduction.
Manual saves close the editor then refetch; errors display above the table. [Undo failures](../../client/src/store/undoStore.ts#L50) are silently returned to the stack.
These are higher-priority correctness/feedback candidates than copying animation. Card funding already guards loading/month identity and provides a useful local pattern.

## Scope of the next pass

The [prioritized gap report](ynab-flybudget-budget-gaps.md) converts these findings into reviewable implementation candidates and synthetic acceptance checks.
It preserves existing accounting services and distinguishes observed YNAB behavior from source-inferred FlyBudget risks.
Unverified cases include operator keystrokes with existing selected text, exact Tab destination, target cycle boundaries, history-shortcut mutations, move-from-RTA, funded-category hiding/explicit unhide, error handling and confirmation of the header auto-assign preview. No further live tests are planned for this pass.
This documentation-only investigation does not authorize application changes, a release, deployment or live-budget migration.
