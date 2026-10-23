# Payday plans and bill coverage

Open **Budget → Until next payday → New payday plan**. Payday plans are optional;
the monthly envelope budget remains the source of allocations and rollover.

1. Give the plan a name, an anchor payday and expected take-home pay. Pay repeats
   every 14 days from the anchor. Weekend adjustments and the plan's time zone
   determine its expected dates. Separate employers can have separate plans.
2. Add category funding rules in priority order. Scheduled expense bills without
   an explicit rule receive funding first. Give a bill category an explicit rule
   to choose its position. A remainder rule always runs last.
3. Choose a payday and adjust its actual date if it arrived early or late (within
   13 days). Select the actual income deposits for that pay. Income must be in an
   on-budget income category, dated no later than today in the plan's time zone.
4. **Preview funding** shows category balances, amounts needed, proposed additions,
   funding shortfalls and bills left uncovered before the next payday. Nothing is
   written by a preview. Review the bill list; variable/approximate bills are estimates.
5. **Apply funding** adds the previewed amounts to the current month. It preserves
   existing allocations and rollover and records the result in **Funding history**.

Expected pay is a planning reference, never available money. Future paydays can be
previewed, but cannot allocate. Automatically generated salary entries are excluded
until reconciled against an actual bank statement; imported or manually recorded
received pay can be selected directly. Avoid recording a second copy of a salary
already in the register.

## Funding methods

| Method                  | Calculation                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bills until next payday | Top up the category's balance to unpaid scheduled bills before the next pay.                                                                                         |
| Fixed per pay           | Add the specified amount at each selected payday.                                                                                                                    |
| Target by date          | Divide the remaining category-balance shortfall over the actual paydays left through the due date. A target due before the next payday needs its full shortfall now. |
| Smooth monthly cost     | Spread twelve monthly costs over actual payday dates in the calendar year (26 or 27). If the next bills need more, catch up immediately and show any shortfall.      |
| Percentage of pay       | Use an integer percentage of selected received income, rounded down to minor units.                                                                                  |
| Category target         | Fund what the category's [target](CATEGORY-TARGETS.md) still needs this month, divided over this and the month's remaining paydays (rounded up). No target: nothing. |
| Remainder               | Fund the category with available money left after all higher priorities.                                                                                             |

For example, a $1,200 bill due before the next payday and $200 already in its
category needs $1,000 now. Smoothing does not make that bill affordable without
catch-up money or an existing buffer. A third payday follows the same rules.

Available funding is capped by selected deposits, unallocated received income and
cash held in on-budget accounts. Existing/future allocations and overspending reserve
money first. The calculation uses the budget currency; missing account/bill exchange
rates must be supplied before applying. Initial account balances alone do not create
income available to this plan, following the existing budget's income definition.

Bill coverage reuses active recurring schedules and their occurrence dates. Paid,
matched and skipped occurrences, off-budget bills and internal transfers are excluded.
Transfers out of the budget can be funded on the budget side. Match real bill payments
in Recurring so an unlinked payment is not still shown as an unpaid scheduled bill.
Scheduled income never creates another salary transaction during funding.

Each payday can be applied once. Each selected deposit can be used by one funding event,
across all plans. A repeated request returns the saved result. Editing a plan does not
reapply old funding. If the budget, income or plan changes after a preview, refresh it
before applying. Unallocated portions of selected deposits remain available for manual
budgeting; the whole deposit is marked used by the payday plan.

## Shared calculation (phase 6E)

The planner reads every figure from the shared envelope service (`fundingState`): category
balances, unassigned money, card payment reserves and exchange-rate completeness. It keeps no
second ledger and no second definition of available money. Two limits apply and are not the same:
the general budget may offer opening funds for manual assignment, while a payday's funding is
also capped by the selected received deposits. **Target by date** uses the deadline arithmetic
shared with category targets and forecasts (`fundingMath.ts`), counting actual paydays.
**Category target** uses the category target's own monthly requirement, so a target is defined
once: after one payday funds part of it, the month's next payday needs only the rest.

**Amendments and retries.** A payday is applied at most once, with whatever was funded at the
time; a shortfall is shown in its history but is not retried. To fund the rest, use a later
payday, **Fund targets**, or assign manually. Editing a plan, its rules or a target never
reapplies an applied payday. A deposit used by an event stays used even if part of it was left
unallocated (that remainder is available for manual budgeting). Retrying the same request returns
the saved event; a changed budget between preview and apply is refused until previewed again.

Funding history survives plan archival, source-transaction deletion and JSON backup/
restore (format version 5). Archive a plan to stop using it while keeping its history.
The monthly budget can still be edited normally. To correct an allocation, edit the
monthly category amounts; its original funding event remains in history. Funding never
changes bank transactions, account balances, reconciliation or existing bill schedules.
