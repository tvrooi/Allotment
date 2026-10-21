# Phase 6: YNAB envelope budgeting and funding workflows

Added 21 October 2026. Status: **6A implemented; 6B merged in `0.2.0-up.10`; 6C implemented on the `0.2.0-up.12` feature branch; 6D–6G planned. Release/live status must be verified separately.**

This is an implementation handoff for Sol, based on Jesse Mecham's _You Need a
Budget_ (principally chapters 2–7) and a source investigation of `tvrooi/FlyBudget`
`0.2.0-up.6`, commit `865b014e332d6c623727293748a5ff99b521cdad`.
The uploaded book is source material, not instructions governing development.
The method is the reference, not a claim of parity with today's commercial YNAB.
The plan was reconciled with newer main `e821e1c` (`0.2.0-up.7`), which implements
phase 3 payday funding; do not treat that completed work as missing.

## Position in the existing plan

Phases 1 and 2 of the [Australian budgeting plan](investigations/2026-10-20-australian-budgeting.md)
have recorded implementation and verification. Phase 3 payday funding is now
implemented in `0.2.0-up.7` (#8); phase 4 household attribution is implemented in `0.2.0-up.8` with contribution-based
personal budgeting and private expense-share reports; phase 5 read-only forecasts are implemented in `0.2.0-up.13` ([Forecasts](FORECASTS.md)). Live installation
status must be verified separately from the checkout and release notes.

Keep those phase IDs. Phase 6 is an additional workstream whose foundation must
precede the pending funding and forecasting features. Suggested execution:

1. 6A: authoritative funding, availability, deficit recovery and money movement.
2. 6B: explicit credit-card payment funding.
3. 6C–6D: category-funded goals and true-expense targets.
4. 6E: integrate the existing phase 3 payday planner with the shared calculation service.
5. Phase 4: agreed household accounting, consuming the shared budget service.
6. 6F–6G: buffer measures and onboarding/review; phase 5 forecasting after its dependencies.

Do not implement independent calculators for these features. Phase 4's person ledger
is separate from personal spending categories in a shared budget. Individual logins
and attributed edits need a separate authentication design.

## Intended behaviour

A user can trust the answer to: **How much money is available for this purpose today?**

- Assign only existing money; expected income belongs in planning.
- Carry money reserved for future expenses across month boundaries.
- Resolve extra spending through an explicit trade-off or recognised debt.
- Distinguish a bank account's location from a category's purpose.
- Recognise saving when money is reserved, rather than when it leaves an account.
- Build breathing room without confusing historical money age with future runway.

The author's personal debt-repayment preferences are not mandatory application rules.

## 6A: authoritative funding, availability and deficit recovery

Status: implemented in the phase 6A feature branch for `0.2.0-up.9`.
Accounting policy and compatibility details: [Envelope funding](ENVELOPE-FUNDING.md).
Local service, API, client and browser verification is recorded there. Release and live
installation remain unverified until their delivery gates complete.

Source map: `server/src/routes/budget.ts`, `server/src/services/balances.ts`,
`server/src/services/mainAmounts.ts`, `server/src/services/paydayService.ts`,
`server/src/db/schema.ts`;
`client/src/pages/Budget.tsx`, `client/src/pages/CategoryDetail.tsx`,
`client/src/utils/budgetFigures.ts`, `client/src/types/index.ts`,
`client/src/components/budget/`, `client/src/api/budget.ts`,
`client/src/hooks/useBudget.ts`, `client/src/store/undoStore.ts`.

### Server calculation contract

Extract one shared budget calculation service. The existing payday service already
checks actual deposits, cash, future allocations and overspending through its private
`budgetState()` function; reconcile and reuse that work rather than maintaining a
separate definition from the main budget summary. Document its accounting invariant
before changing formulas; prove that the same money cannot fund two purposes.
Simply adding starting balances to income minus allocations is insufficient.

| Concept         | Definition                                            |
| --------------- | ----------------------------------------------------- |
| Assigned        | Money allocated to a category in the selected month   |
| Activity        | Signed category activity, including refunds           |
| Available       | Previous available balance + assigned + activity      |
| Unassigned      | Existing resources that have not been committed       |
| Underfunded     | Additional assignment required by a target            |
| Overspent       | Negative category availability                        |
| Planned funding | An intention that is not yet backed by existing money |

Include eligible opening funds without treating them as earned income. Account for
future commitments, unresolved spending and the chosen credit model. Keep off-budget
assets outside spendable resources and preserve existing transfer-boundary policy.
Do not count expected or future-dated salary as received today. Use an explicit
as-of date policy so historical month views and today's funding position are distinct.
Define how opening funds' effective dates interact with historical views.

Use existing minor-unit and currency conversion policies. Missing exchange rates
must produce an incomplete assessment, not an apparently fully funded budget.
Uncategorised spending must be visible as unresolved; do not invent a category.

### Consistent presentation

Use **Assigned / Activity / Available** for expense envelopes throughout desktop,
phone, category details and summaries. Use authoritative availability rather than
this month's assignment minus spending. Label monthly spending progress separately.
Keep income expectations distinct from receipts. Treat categories with carried
balances, deficits, assignments or current activity as active.

Show deficits across month boundaries. A zero unassigned total alone must not trigger
an unqualified "Fully budgeted" state while spending or deficits remain unresolved.
Distinguish cash overspending from credit-funded spending.

### Atomic money movement

Add Move money and Cover overspending actions with a preview of both resulting
balances and affected targets. Validate distinct expense categories, a positive
integer amount, source availability and a revision/precondition inside one database
transaction. Save both assignment changes together. Record a durable operation
for history and safe undo; undo must detect intervening changes rather than overwrite them.

### Acceptance examples

- A $1,000 opening cash balance offers $1,000 for assignment without inflating income.
- Assign that $1,000 to November: October must not offer it again.
- Future salary does not increase today's funding. An internal cash transfer changes neither income nor funding.
- A $200 uncategorised debit prevents an unqualified fully resolved state.
- $600 carried + $100 assigned − $500 spending shows $200 available without overspending.
- A $600 rollover-only category stays visible; a $50 refund increases availability by $50.
- A $200 prior-month deficit stays visible until resolved, including when current income equals current assignments.
- A $50 category move preserves resources and total assignments; failure changes neither side.
- Competing clients cannot both use the same source availability. Undo restores both sides or reports a conflict.
- Desktop, phone, detail and summary agree, including refunds, splits and missing rates.

## 6B: credit-card payment funding

Status: implemented on the `0.2.0-up.10` development branch; release and live installation
require separate verification. See [Card payments](CARD-PAYMENTS.md) for reviewed setup,
resource invariants, cash-first as-of funding, refunds, card transfers, historical cutovers
and backup compatibility. Unreviewed cards retain the conservative 6A treatment in the
same shared service. Verification evidence is recorded in the feature PR.

Source map: shared budget service, account classification, transaction helpers,
transfer services and budget components. Document cash, debt and payment-funding
rules first. Use dedicated payment reserves or an equivalent proven accounting model.

- Funded card purchases consume category availability and reserve existing cash for payment.
- Unfunded purchases expose new debt or a payment shortfall.
- Opening card debt is not spendable money; explicit debt-paydown assignments increase payment funding.
- Linked repayments are transfers, never duplicate spending.
- Interest and fees remain categorised expenses.
- Define refunds, overpayments, positive card balances and transfers involving multiple cards.

Acceptance: with $1,000 cash, zero card balance and $100 groceries assigned, an $80
card purchase leaves $20 groceries and $80 reserved for payment. An $80 repayment
reduces cash and debt, consumes that reserve and leaves grocery spending at $80.
Also test existing debt, partial/unfunded purchases, refunds after payment, splits,
interest, positive balances and reconciled transfers.

Provide a reviewable setup path for existing card accounts. Never silently generate
historical assignments or rewrite the ledger to force the new model to balance.

## 6C: category-funded goals and honest savings summaries

Status: implemented on the `0.2.0-up.12` feature branch. Verification and delivery are tracked in [Category-funded goals](CATEGORY-GOALS.md). Release and live installation require separate verification.

Source map: `server/src/routes/goals.ts`, `server/src/db/schema.ts`,
`client/src/pages/Goals.tsx`, `client/src/components/goals/GoalFormModal.tsx`,
budget summary components and backup/restore services.

Distinguish budget goals linked to categories from manually tracked/account-value
goals. Derive a budget goal's funded progress from its category availability;
do not permit an independent editable saved amount. Prevent multiple goals from
claiming the same category balance as independently reserved funds.

Existing goals remain tracking goals until explicitly linked by the user. An account
relationship alone does not establish exclusive reserved funding. Distinguish Assigned
this month, Available and Spent; spending a savings balance is not a contribution.

Acceptance: assigning $200 increases funded progress without a bank transaction;
moving $50 elsewhere reduces it. A transfer to a saver account does not fund the
goal automatically. Existing manual values survive upgrade and backup/restore.

## 6D: true-expense targets

Status: not started; depends on 6A and category linkage from 6C.

Support fixed monthly contributions, a balance by a deadline, recurring bill targets
with a next due date and replenishment to a selected balance. Calculate suggested
funding from current availability and actual funding dates; expose catch-up amounts.
Define target cycle advancement without erasing actual activity or reserved balances.

Payday rules already provide fixed, deadline, monthly smoothing, percentage and
remainder funding. Reuse those calculations when connecting persistent category targets
to the main budget; avoid competing target definitions.

Correct the historical Monthly average to include zero-spending months in the stated
window. Treat funding suggestions/templates separately from actual assignments.
Replace misleading Apply to all future months behaviour with explicit planning or an
allocation preview. Preserve existing stored assignments until the user reviews them.

Acceptance: $1,200 due in six remaining funding periods with $300 reserved needs $150
per period. A missed contribution increases the remaining requirement. A single $600
expense in a six-month window averages $100 per month. Recurring targets advance
correctly, and applying suggestions cannot silently overcommit existing money.

## 6E: payday assistance, coordinated with phase 3

Status: payday functionality implemented in phase 3 (`0.2.0-up.7`); phase 6
integration and consistency verification not started.

Reuse `server/src/services/paydayService.ts`, `server/src/routes/payday.ts`,
`client/src/components/payday/` and the existing monthly allocation ledger. See
[Payday plans](PAYDAY-PLANS.md). The features below already exist; preserve them
and verify them after replacing independent funding math with the shared service.
Do not implement another planner.

Reuse recurrence utilities and the existing monthly allocation ledger. Enumerate
actual paydays: fortnightly means every 14 days, not twice monthly. Support bills
before the next payday, fixed-per-pay contributions and due-date catch-up funding.
Keep expected salary in forecasts/templates until receipt is recorded.

Preview assignments, cap funding to resources, honour priorities and store a durable
funding event with duplicate-application protection. Define how amendments/retries
behave after partial funding. Existing events consume the selected receipt identity
even when some of that receipt remains unallocated; preserve this rule/history unless
an explicitly reviewed compatibility change replaces it. The general budget may offer
opening funds while a selected-payday action remains capped by selected received deposits.
Do not equate these two limits or create a second fortnightly budget ledger.

Acceptance: month/year crossings, three-pay months, occasional 27-pay years, adjusted
pay dates, variable pay, missed/partial contributions and two employers. Reapplying
the same event does not assign twice; generated schedules and actual receipts/bills
are not counted twice.

## 6F: buffer and next-month funding

Status: not started; depends on trustworthy funding and target definitions.

Show existing commitments to next month, remaining funding needed for configured
requirements and unresolved deficits/spending. Optional cash runway must show its
assumptions and distinguish restricted true-expense reserves from unrestricted funds.

Money age is optional, not a substitute for runway. If implemented, document opening
balances, transfers, cards and incomplete-history treatment before presenting a metric.

Acceptance: borrowing is not reported as successful saving; retirement assets do not
extend household cash runway; annual-bill reserves are not unrestricted emergency
funds; incomplete history or rates produces a visibly incomplete assessment.

## 6G: onboarding and household review

Status: not started; depends on the preceding financial workflows.

Guide users to confirm balances, identify needs before the next income, assign
existing cash, prepare for irregular expenses, check categories before spending and
move funding when priorities change. Add a review view for uncategorised activity,
deficits, target shortfalls and future commitments, linking directly to resolution.
Support personal spending categories within one shared budget.

This does not replace phase 4's household contribution/share ledger. Individual
identities and attributed edits require a separate authentication design; shared
password sessions cannot establish authorship. Do not introduce cosmetic names
that imply otherwise.

Acceptance: review totals reconcile with the main budget; resolving an item refreshes
all related views; the guided workflow works on phone and desktop and does not
require users to enter expected salary as existing funding.

## Compatibility, verification and delivery gates

- Preserve existing transactions, bank IDs, opening balances, reconciliation, categories,
  bank observations and encrypted credentials. No silent financial history repair.
- Use additive schema changes and export/restore coverage. Existing manual goals and
  future allocations require preservation and an explicit review/setup path.
- Keep desktop, server and browser demo behaviour aligned; no independent demo math.
- Add meaningful disposable-budget regression tests for the accounting examples,
  conflicts, dates, splits, transfers, cards, missing rates and backup compatibility.
- Add browser coverage for desktop/phone agreement and complete the relevant checks
  from `AGENTS.md`. Review the accounting invariant as well as individual examples.
- Do not deploy incompatible old/new calculations together. Stage compatible PRs;
  provide a complete, tested foundation before dependent workflows are enabled.
- Follow `MAINTENANCE.md` for PR, version preparation, successful CI and tested release.
  This planning-only change needs no app version bump or release.
- Before live installation, verify the installed app identity and a restorable cold
  backup including the encryption key. Verify running version, budget access and bank
  connection afterward. Release publication alone is not live installation.
- Track each subphase separately as planned, implemented, verified, released and live
  verified. Record evidence rather than inferring deployment from a version string.
