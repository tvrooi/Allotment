# Category-funded goals (phase 6C)

Implementation: `0.2.0-up.12` feature branch. Release publication and live installation are separate delivery gates.

Existing goals remain manual tracking goals. Their saved amount and optional account reference are preserved. An account link does not reserve money and an account transfer does not fund a goal.

Choose an expense category in a goal's Progress source to explicitly link it. Each category can fund one goal; income and credit-card payment reserve categories cannot fund savings goals. The API, a unique database index and additive migration constraints enforce these rules. Unlinking or deleting the category restores the original manually tracked value without rewriting transactions or assignments.

A linked goal uses today's availability from the shared envelope/card accounting service, in budget minor units. Funded progress is the positive portion of availability; negative availability remains visible as a deficit. Assignments and carried funds increase progress; moving funds elsewhere or spending reduces it; refunds restore availability. Future-month assignments do not fund today's goal. There is no independently editable funded amount. The form and API preserve the manual tracking value separately for an eventual unlink.

The goal row distinguishes this month's assignments, signed activity and current availability. The summary separates category-funded progress from manual values, which can overlap other goals/accounts and are not evidence of reserved cash. A missing exchange-rate assessment returns unknown funded progress and an explicit incomplete warning rather than claiming fully funded savings.

Backup format 9 stores category linkage and the untouched manual value, not derived progress. Older backups restore as manual goals. Restore rejects missing, income, payment-reserve and duplicate category claims before changing the budget. The browser demo runs the same routes and calculations.

Verification is recorded in the feature PR. Regression coverage includes assignment changes, spending, refunds, account transfers, future reservations, invalid/duplicate links, unlink and category deletion, incomplete rates, and new/legacy backup restore. Browser coverage exercises desktop/phone linking and manual tracking, plus demo backup restore. Live installation requires administrative access and a verified cold backup including the encryption key, as specified in MAINTENANCE.md.

Goals can be paused, completed, retired or replaced (phase 7D); see [Resilience](RESILIENCE.md#goals-can-change-7d). A goal that is not active keeps its funding and category link but gets no target, payday or forecast funding suggestions.
