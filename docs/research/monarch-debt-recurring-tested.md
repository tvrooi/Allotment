# Monarch debt pay-down and populated recurring tests

22 October 2026. Live REA controlled-scenario observations using explicitly authorized synthetic records. This continues the [recurring/goal inspection](monarch-populated-workflows.md). It supersedes the earlier loan-not-created checkpoint for this newly completed test, without rewriting that historical checkpoint.

## Tool status and retained synthetic inventory

REA's controlled runner now works with the supported `environment.service_workers=allow` option. The earlier default-block preflight may have interfered with a sandbox iframe; that is an inference, and the original error was scrubbed. These continuation tests used REA controlled scenarios, not CUA.

New retained artifacts are:

- Manual liability account **REA INSPECTION — synthetic loan**, type Loan, initially created with balance 1,000.
- One manual debit transaction for 25 in that account, category Gas & Electric, notes **Synthetic inspection only**.
- Merchant **REA INSPECTION recurring utility**.
- Its active monthly Expense definition, amount 25, starting 22 October 2026.

These remain pending user-authorized cleanup. No deletion was performed. The transaction's Adjust account balance by 25 checkbox was checked by default and retained; the account's current balance must be verified rather than inferred from the debit label or sign conventions.

## Loan creation and missing setup

Creation evidence: `ev_61753ffb7163c7de8ba1457e158c22c230d1ff87f86adc3b57dec161636b93d7`. Initial pay-down evidence: `ev_29ea92606224c18ee1b81be16428d0e90c03b4b4382905d8535c5bc954559db7`.

**Observed:** after creating the synthetic Loan liability with balance 1,000, Pay down displayed Not enough data and asked for APR/payment setup. Its summary was zero despite the row showing 1,000. Thus the missing-setup summary is not evidence that the debt balance is zero.

**Intent, inferred:** a debt balance alone is insufficient to calculate repayment timing and interest. A setup action supplies the additional financial assumptions before the projection becomes meaningful.

## Account settings and independent exclusions

Editor evidence: `ev_f107fcfc08effef23730010fb892b1aa154d6af6290e75b0b7b9e4d575f0657b`.

**Observed:** setup routes to Edit Account, exposing name, balance, type/subtype, notes, interest rate, fixed/variable rate type, minimum payment and optional planned payment.

Separate switches are Hide account, Exclude balance, Hide transactions, Exclude Pay down and Exclude budget contributions. Exclude budget contributions is checked by default in the inspected form. These independent controls should not be collapsed into one generic hidden state.

Close account is described as setting balance to zero while retaining history; Delete removes all data. Those descriptions were inspected, but neither destructive action was executed.

## Configured pay-down projection

Configured result: `ev_e95144fc7ed71f496c32ba389bf16268fc196b6d3bff0eb272f8244cf9e0b50d`. Principal/interest view: `ev_c5bc9455b2d48cf404180e801ddead32b0f4cb6621007377f7fc7a32eecf7827`.

**Observed:** the synthetic account was configured with APR 12%, minimum payment 100 and planned payment 150. Exclude budget contributions remained checked. The pay-down view then showed principal 1,000, rounded interest 40, total 1,040 and debt-free date May 2027. It offers a timeline, export and an explanatory calculator with Planned, Avalanche and Snowball choices.

The principal/interest view showed exact projected interest 40.11, with separate grouped principal and interest visuals. These are projection outputs for this configured sample, not observed paid interest or a recovered amortization engine. Payment timing, day-count convention, compounding, final-payment rounding, variable-rate changes and multi-debt ordering were not boundary-tested.

Save to Budget was available but not submitted. An attempt to capture its modal was blocked by tool review before execution. The raw review reason was lost during a JSON parse failure, so no specific rejection reason can be reported. **The modal was not inspected and the budget was not changed.**

**Intent, inferred:** principal/interest separation explains financing cost; the calculator compares repayment strategies, while Save to Budget connects a selected plan to budgeting only through a further action. The existence of that action does not establish its confirmation fields or overwrite scope.

## Synthetic transaction and merchant persistence boundary

Transaction form evidence: `ev_0eeaf2287ba5a6762ea120992e1c78b78da5f5dc65e9c25c98f3388fa63f6a1f`. Saved transaction: `ev_e8beff06e8b299de3bb1d960d07a52301295afc5a8fb91243054dc2b66e17bdb`.

**Observed:** the manual transaction form requires a category and says liability transactions cannot link to a Save up goal. A 25 debit was saved to the synthetic loan account, with the new synthetic merchant, Gas & Electric category and the inspection-only note. The default balance-adjustment checkbox remained checked.

A previous merchant draft had not persisted: the option was not found afterward. Creating the merchant as part of the saved transaction did persist it. This establishes the exercised draft-versus-transaction-save boundary, without claiming every merchant-creation path behaves identically.

## Saved recurring definition

Merchant editor: `ev_8f38f4ff25e64b2d7d20f6ad5044556d125c30812d8c38ded76b64049a444bb0`. Saved definition: `ev_f34083d886163558fc2ebd31ffad540d0eabc8e99f0d7e768ebc3568f5716560`. All recurring verification: `ev_32086149976de6a738d66a31c4b5f21682bf011ad5c06fe768bb9f2ddf81805e`.

**Observed:** the merchant editor was used to save Monthly, amount 25, start date 22 October 2026, Expense and Active. All recurring then showed it in the Active group with next due, frequency, payment account, category and amount. By Status filtering, group collapse and a row menu were visible. The menu's downstream actions were not exercised here.

## Monthly list/calendar: actuals versus projected occurrences

Monthly evidence: `ev_b1ac57c553d42fae2d5fb7095cda23e6db67ea175d29bd412c56e981f7fd87b9`. Future-item detail: `ev_2f635c9b72451e061f68436ba3a3ccef352c998a9617e0b444a81414ddc38672`.

**Observed:** October's list showed paid 25, remaining zero and the item in a Complete group. November's calendar showed total 25, paid zero, remaining 25 and an event on 22 November. List/Calendar switching and period navigation were exercised. Clicking the future calendar item opened the merchant detail for November, which showed No Transactions.

This demonstrates a future expected occurrence without a corresponding actual transaction in the exercised month. The October classification is one identical sample; it does not establish matching tolerance, date windows, amount variation, partial payments, duplicate handling or cross-account matching rules.

**Intent, inferred:** monthly views connect obligations and settlement status while leaving future expectations distinct from recorded financial activity. Calendar navigation supports planning; the merchant drill-through makes the absence of actual records visible.

## FlyBudget implications and remaining tests

These are independent design recommendations:

- Represent missing APR/payment setup as unavailable projection data, rather than presenting summary zero as actual debt.
- Preserve separate account visibility, balance inclusion, transaction analytics, debt planning and budget-contribution settings, with their effects explained.
- Show principal and estimated interest separately and define projection conventions before claiming numerical parity.
- Keep Save to Budget as an explicit, reviewable boundary with affected periods/values identified; its Monarch modal remains unobserved.
- Maintain separate recurring definitions, expected occurrences and actual transactions. Explain matching decisions and test tolerances with disposable data rather than inferring them from one successful case.

Still untested: populated multi-debt strategies, Save to Budget, variable-rate behavior, paid matching boundaries, partial/overdue/canceled occurrences, row-menu consequences, exports and cleanup/reversal effects. Verify the synthetic loan's current balance before any further numerical comparison.
