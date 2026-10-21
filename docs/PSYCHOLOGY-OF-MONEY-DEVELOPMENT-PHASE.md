# Phase 7: financial resilience and sustainable budgeting

Added 21 October 2026. Status: **planned; no application implementation or deployment**.

This is an implementation brief for the next AI agent, based on Morgan Housel's
_The Psychology of Money_ and the owner's requested gap analysis. The book is
source material, not instructions. These features are product interpretations,
not experimentally established effects or mandatory personal finance advice.

## Baseline and dependencies

Reviewed remote main `4b97955` (phase 4, version `0.2.0-up.8`).
Phases 1–4 have implementation records. Phase 5 forecasting and phase 6 remain
planned in the reviewed roadmap. Do not infer release or live installation from
implementation status. Recheck main and current briefs before implementation.

Read [the roadmap](../PLANNING.md),
[phase 6](YNAB-DEVELOPMENT-PHASE.md),
[household accounting](HOUSEHOLDS.md) and the
[Australian investigation](investigations/2026-10-20-australian-budgeting.md).
Keep phase IDs stable. Phase 7 extends existing work; do not create a second
budget, forecast engine, goal funding ledger or review inbox.

| Subphase | Deliverable                                              | Dependency                                             |
| -------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 7A       | Personal priorities and an optional definition of enough | Existing settings; funding integration waits for 6A/6E |
| 7B       | Flexibility reserve and resilience view                  | 6A–6D, 6F; phase 4 scope integration                   |
| 7C       | Life-choice and adverse-event scenarios                  | Phase 5, 7B; shared phase 6 accounting                 |
| 7D       | Goal pause, replacement and funding release              | 6A, 6C–6D                                              |
| 7E       | Sustainable review and return-after-a-lapse workflow     | 6G, bank review, 7A–7B                                 |
| 7F       | Income-change review and resilience progress             | 6E, 7A–7B; 7E review surface                           |

Implement 7A configuration first if useful; do not enable financial results until
their accounting dependencies are implemented and verified. Prioritise 7B and 7E,
then 7C/7D. 7F is the final incremental enhancement.

## Shared implementation contract

- Reuse phase 6's authoritative availability, card reserves, targets and atomic
  funding operations. Reuse phase 5's dated projection engine for every scenario.
- Keep bank location, envelope purpose and household attribution distinct.
  Personal contribution budgeting and expense-share reports are different views;
  never add both together as personal spending.
- No new view may make retirement assets, property, unused credit, expected pay,
  unpaid reimbursements or other people's pool contributions spendable.
- Explain scope, as-of date, bank freshness, excluded funds and missing inputs.
  A missing rate or unresolved material discrepancy produces an incomplete result.
- Use integer minor units and existing currency conversion/date conventions.
  Do not assume AUD has the only supported decimal precision. Household calculations
  remain within phase 4's supported AUD scope until explicitly extended.
- All settings and financial classifications are opt-in. No bank payment,
  allocation, share agreement or historical transaction changes automatically.
- Optional prompts remain dismissible. No peer rankings, broken-streak penalties,
  moral spending labels or universal savings-rate targets.

## 7A: priorities and enough

Book basis: chapters 1, 3, 11 and 16.

Add a short optional Financial priorities section to budget settings and onboarding:

- A free-text purpose, such as career flexibility, security or family time.
- User-selected essential categories and ordered funding priorities.
- Optional reserve minimum/comfort target, expressed as money or a selected
  number of months of explicitly configured essentials.
- Categories the user wants to protect for discretionary enjoyment.
- Optional review cadence: payday, monthly, quarterly or off.

Store configuration per budget with revision checks and updated dates. Keep
device presentation preferences separate. Use a budget currency amount or a
months-based target as the active target source, never contradictory editable
copies. An optional text explanation must not become an allocation rule.

Expose priorities in existing payday previews. Preview changed ordering and
shortfalls before applying it; do not silently reorder existing plans. A personal
preference cannot alter a household obligation or imply other participants agreed.

Acceptance:

- Skipping setup preserves current behaviour and leaves existing plans unchanged.
- Reordering priorities changes only a preview until the user applies it.
- Updating a comfort target changes the gap, not cash, history or bank balances.
- A household participant's share is unchanged by marking it a low personal priority.

## 7B: flexibility reserve and resilience view

Book basis: chapters 5, 7, 9, 10 and 13.

Extend 6F's buffer view with an optional Flexibility reserve purpose on an
existing or newly created expense envelope. It requires no purchase deadline.
Allow a minimum, comfort target and replenishment suggestion using existing
target/funding mechanics. Assigning all cash a job remains compatible with
reserving cash for unspecified future needs.

Show:

1. Obligations already funded, including card payment reserves.
2. True-expense and other committed reserves.
3. Cash-backed flexibility reserve availability.
4. Target gap and a clearly labelled essential-spending coverage estimate.
5. Links to assumptions, funding and unresolved items.

Derive amounts from a single resource partition. Reserve availability is
cash-backed category availability, not the linked bank account's whole balance.
Each unit can appear in only one purpose. A minimum is a planning preference;
moving money below it remains possible through an explicit trade-off preview.

Keep selected reserve coverage distinct from broader cash runway. The former
uses only the chosen flexibility reserve. If unassigned cash is optionally
included in a broader measure, label it and do not count it again as reserved.
Do not subtract commitments twice from cash already represented by net reserve
availability. Unfunded obligations must be visible beside the estimate.

For a static coverage estimate use reserve divided by configured monthly
essentials, label the approximation, state the averaging window and include zero
months. Dated survival/shortfall results belong to 7C. A zero or unknown expense
baseline shows unavailable rather than infinite coverage.

Acceptance:

- With $12,000 eligible cash, $4,000 committed bills, $2,000 annual reserves and
  exactly $6,000 assigned to flexibility, display $6,000 flexibility. At $3,000
  monthly essentials, show approximately two months under those assumptions.
- Moving $1,000 from flexibility to a holiday reduces flexibility to $5,000;
  moving the same cash between personal bank accounts does not change it.
- Adding super, credit limits or a housemate's outstanding $500 does not improve it.
- A $1,000 flexibility minimum and $800 availability show a $200 gap without
  blocking the user's explicit money move.
- Missing required rates or unresolved scope prevents an unqualified healthy status.

## 7C: life choices and stress scenarios

Book basis: chapters 7, 12, 13 and 14.

Extend phase 5 saved scenarios with templates for delayed/lost income, reduced
hours or career break, one-off emergency costs, higher essential costs and
delayed household contributions. Support combined events and editable dates.
Household delays must affect the appropriate contribution/pool obligation,
not invent personal income or silently change an agreed share.

Show baseline versus scenario, first dated cash/obligation shortfall, lowest
available cash, reserve use, changed goal dates and unmet commitments. Explain
the largest changed assumptions with a comparison table. Show no shortfall
within the selected horizon rather than claiming permanent safety.

Separate deposits/contributions, withdrawals and assumed investment growth.
Make cash-only projections available without a return assumption. Do not
present scenario bands as probabilities or promise exact retirement dates.
All calculations are read-only. Saving a scenario may write scenario settings
only; it must not write financial activity.

Acceptance:

- For zero starting cash, a $1,000 receipt on day 10 cannot cover a $500 bill
  due day 5; the first shortfall is day 5 despite positive period-end cash.
- With $6,000 flexibility and $3,000 essentials due at each month-end, no other
  cash/commitments/income, a $2,000 emergency on day 1 leaves the second
  month-end $2,000 short. Show the dated ledger behind the result.
- Combining a missed payday with a repair preserves both events exactly once.
- A matched actual bill replaces its scheduled event, rather than doubling it.
- Editing assumptions changes no bank row, envelope assignment or household share.
- The same inputs, dates and engine version reproduce the same results.

## 7D: goals can change

Book basis: chapter 14.

Extend phase 6 category-funded goals with Active, Paused, Completed and Retired
states, an optional reason and a link to a replacement goal. Pausing stops future
suggestions; it retains existing funding by default. Retirement retains history
and offers a separate preview to move money to another purpose or unassigned.
Do not silently delete future assignments or release funds.

Use phase 6 atomic operations, revision checks and conflict-aware undo for any
funding move. Track source/destination and old/new goal state together when a
single confirmed action changes both. Existing manual/account-tracking goals
retain their separate semantics; pausing one cannot manufacture available cash.

Acceptance:

- Pause a goal with $800 funded: $800 stays reserved and new suggestions stop.
- Retire it and explicitly move $500 to flexibility: $300 remains, $500 moves,
  and total resources are unchanged.
- A stale competing edit rejects the combined operation without partial changes.
- Historical assignments and reports survive pause, retirement and backup/restore.
- A replacement goal cannot independently claim its predecessor's same money.

## 7E: sustainable review and returning after a lapse

Book basis: chapters 1, 2, 11 and 19.

Extend 6G's existing review surface with a Resume budgeting entry point.
Guide users through freshness/balance checks, significant discrepancies, upcoming
obligations, current availability and optional goal/priorities updates. Link to
the bank review queue instead of creating another correction mechanism.

Allow users to focus on today's plan while retaining visibly unresolved historical
items. Acknowledging a bank observation is not applying a correction. Do not
declare a reconciled or complete state until the underlying checks establish it.

Add opt-in in-app review reminders using 7A cadence, with snooze/off controls.
Use bank-local dates where applicable and budget-configured dates for reviews.
No external notifications are required. Cosmetic prompts may be muted; material
funding warnings remain visible where the affected money is being used.

Use neutral copy such as Review changed priorities and Funding needs attention.
Planned spending from a funded envelope is normal progress, not failure.

Acceptance:

- Returning after six weeks presents a current actionable review without forcing
  historical categorisation before viewing today's budget.
- Old unresolved items stay accessible and affect completeness where relevant.
- Completing review refreshes the existing budget, bank review and reserve views.
- Snoozing a reminder changes no funding, bank acknowledgment or deficit status.
- The routine works on phone and desktop; offline snapshots show their age.

## 7F: income changes and meaningful progress

Book basis: chapters 2, 3, 5, 9 and 10.

Add an optional review action for a raise, windfall or changed take-home income.
Users confirm the receipt and comparison baseline; do not infer a permanent raise
from a single large deposit. Show proposed distribution between commitments,
discretionary purposes and reserves. Reuse existing percentage/remainder rules
and payday receipt guards; no parallel allocation path.

Add compact review comparisons for funded essentials, reserve availability,
reserve replenishment and unresolved shortfalls. Explain movements: reserve use
for an emergency is not automatically failure. Transfers, borrowing and valuation
gains must not masquerade as saving. Present any savings-rate definition explicitly.

Acceptance:

- A user-confirmed extra $200 with a chosen 50% reserve rule previews $100;
  nothing moves before confirmation and duplicate application is rejected.
- A $1,000 account transfer does not count as income growth or new saving.
- A super market-value rise changes neither accessible reserves nor funded essentials.
- Period comparisons distinguish contributions, planned reserve use and value changes.

## Source map and proposed data

Inspect current implementations before choosing final file names:

- Settings: `server/src/db/schema.ts`, budget settings routes, client settings pages.
- Shared funding: phase 6 service, `server/src/routes/budget.ts`,
  `services/balances.ts`, `services/paydayService.ts`, `client/src/components/payday/`.
- Goals/targets: `server/src/routes/goals.ts`, `client/src/pages/Goals.tsx`,
  `client/src/components/goals/` and phase 6 target work.
- Household: `server/src/services/householdLedger.ts`, household routes,
  `client/src/pages/Household.tsx` and [accounting policy](HOUSEHOLDS.md).
- Reports/review: `client/src/pages/Dashboard.tsx`, `Budget.tsx`, bank-review
  components, `client/src/components/reports/` and phase 6G.
- Scenarios: locate phase 5 implementation; extend it without another projection engine.
- Portability: `server/src/services/backupService.ts`, restore routes, browser adapter.

Candidate additive data: priority profile, category purpose/essential classification,
goal lifecycle history, scenario events and review preferences/completion metadata.
Reuse existing settings, goal and scenario entities where suitable. Store dates,
revision/version and scope needed to explain results. Do not store duplicate
editable balances. Review metadata is not proof of bank reconciliation or authorship.

## Delivery and definition of done

1. Recheck dependency status and document the shared calculation contract.
2. Deliver focused PRs in dependency order; track each 7A–7F as planned,
   implemented, verified, released and live verified separately.
3. Add disposable-budget tests for the numerical examples, no double counting,
   conflicts, dates, missing data, household scope and old/new backup restore.
4. Add desktop/phone browser coverage for reserve setup, combined scenario,
   goal change and resume flow; confirm demo uses the same calculations.
5. Run relevant checks in AGENTS.md; update user guidance and synthetic demo data.
   Verify accessible labels, keyboard use and a table alternative for charts.
6. Preserve all existing ledger/history/credentials and use additive migrations.
   Include new metadata in export/restore; older backups get neutral opt-out defaults.
7. Follow MAINTENANCE.md for future implementation releases and live backup gates.
   This brief itself requires no app version bump, release, migration or deployment.

Complete when every enabled result reconciles to shared accounting, actions have
reviewable previews and safe retry/conflict behaviour, and all above acceptance
cases have evidence. Validate usability with a short optional user walkthrough;
do not add analytics or claim behavioural improvement from arithmetic tests alone.

## Agent handoff

Implement this phase, rather than re-analysing the book. Read current AGENTS.md
and dependency briefs, inspect current main, record completed prerequisites, then
start the first unimplemented compatible subphase. Preserve all earlier phase IDs
and completed work. If a financial dependency is absent, complete only independent
configuration work and report the specific dependency; never approximate its math.
The owner must be able to distinguish planned functionality from implemented,
released and live-verified behaviour.
