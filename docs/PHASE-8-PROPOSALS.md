# Phase 8 expansion proposals

Added 22 October 2026. Status: **proposals only**. Proposals 2 and 3 are scheduled as [phase 9](PHASE-9-DEVELOPMENT-PHASE.md). Nothing here is implemented or
scheduled. Each proposal is bounded so it can become one focused phase or PR series
under the rules of the [phase 8 brief](MONARCH-DEVELOPMENT-PHASE.md): integer minor
units, additive migrations, shared transaction write helpers, mock data in tests,
and no second funding, review, goal or forecast engine.

These came from the owner's Monarch inspection, where the controls were visible but
not exercised. Their design is checked against FlyBudget's accounting, not inferred
from Monarch.

## 1. Receipts and attachments

**Problem.** A purchase sometimes needs its receipt, invoice or warranty at hand, for
example for a return, a tax deduction or a shared-expense claim.

**Distinct from.** Retail-account sync (importing order lines from a shop) is a
different product and is not proposed.

**Model.** A new `transaction_attachments` table: `id`, `transaction_id`
(cascade delete), `filename`, `media_type`, `size`, `sha256`, `created_at`. File bytes
are stored on disk beside the database under a content-addressed name, not in SQLite.
Allowed types are JPEG, PNG, WebP, HEIC and PDF, up to 10 MB each and 20 per
transaction. An attachment belongs to the register row: a split parent holds it, and
its parts show it.

**UI.** An "Attachments" section in the transaction detail panel, with upload, preview,
download and delete. A paperclip mark on register rows. A phone can take a photo.

**Storage, backup, export.** The JSON backup gains an optional attachments manifest.
A full backup becomes a `.zip` holding the JSON plus files; the plain JSON backup stays
available and states that it has no files. The CSV export adds no columns. Restoring
checks each `sha256`.

**Permissions and privacy.** Served only through the authenticated API with
`Content-Disposition: attachment` and `nosniff`; never inline HTML; never sent to a
third party. Uploads are type-checked by content, not by name. The HA `/data` volume
holds the files, so the HA cold backup covers them.

**Dependencies.** The backup format version, and a cap on HA disk use (a visible total
in Settings → Data).

**Verification.** Server tests for type and size refusals, cascade on delete,
backup/restore round trip and hash mismatch. e2e upload, preview and delete on desktop
and phone. Demo: disabled, with an explanation.

**Scope.** About one PR for the server and backup, and one for the UI.

## 2. Per-transaction review and visibility

**Problem.** After an import, the owner wants to mark transactions as "looked at", and
to hide some from reports (a reimbursed work expense, a one-off sale) without deleting
them or breaking balances.

**Distinct from.** Up bank-source review (phase 2) compares imported rows with the
bank and never rewrites the ledger. The 6G budget review guide stores nothing. 7E
stores review completions, not per-transaction flags. This proposal is per-transaction
state only.

**Model.** Two additive columns on `transactions`: `reviewed_at` (nullable) and
`hidden_from_reports` (0/1).

- `reviewed_at` is never set by an import, a rule or a bank-source correction.
- `hidden_from_reports` removes the row from income, spending and savings-rate reports
  through one condition added beside `budgetActivity`. It never changes balances,
  envelope activity or reconciliation, so the budget is unchanged.
- A hidden row still appears in the register, with a mark and a filter, so nothing
  disappears silently.

**UI.** A "Reviewed" toggle and a "Hide from reports" toggle in the detail panel. A
`reviewed=0` selection filter (added to the shared selection) and "Mark selection
reviewed" for the current register selection, after a confirmation that shows the
count.

**Storage, backup, export.** Both columns go in the backup. The CSV gains `Reviewed`
and `Hidden from reports` columns.

**Permissions and privacy.** Local only.

**Dependencies.** The phase 8 transaction selection. 6G review keeps its own role and
may link to the unreviewed selection.

**Verification.** Reports exclude hidden rows while balances and budget activity stay
identical (a property test over generated ledgers). Bulk review changes only
`reviewed_at`.

**Scope.** One PR.

## 3. Tags and saved views

**Problem.** Some spending crosses categories (a holiday, a renovation, a tax year), and
some filters get rebuilt every week.

**Model.**

- **Tags:** `tags` (`id`, `name`, `color`) and `transaction_tags` (`transaction_id`,
  `tag_id`, unique pair). Tags attach to leaves (unsplit rows and split parts), matching
  how the selection filters.
- **Saved views:** `saved_views` (`id`, `name`, `query`). `query` is exactly the
  register's URL query string from phase 8, validated by the server's selection schema
  when saved and again when opened.

**UI.**

- Tags: a tag picker in the detail panel and split editor, a `tag_ids` filter in the
  filter panel, and tag chips on rows.
- Saved views: "Save view" beside **Clear all**, and a list in the Transactions header.
- Rules may add a tag as an action.

**Storage, backup, export.** All three tables go in the backup. The CSV gains a `Tags`
column (semicolon-separated, escaped like other text cells).

**Permissions and privacy.** Local only.

**Dependencies.** The phase 8 selection, which gains a `tag_ids` parameter; and the
rules engine, which gains an action.

**Verification.** Tagged split parts count in the summary and export exactly like
category filters. A saved view reopens with identical results. Restore round trip.

**Scope.** Two PRs (tags; saved views).

## 4. Security holdings

**Problem.** Investment accounts show one balance today. The owner may want to see
what is held in them.

**Distinct from.** Account-level investment balances (today's "Update value") remain
the source of net worth. Holdings explain a balance; they never replace it.

**Model.** `holdings` (`id`, `account_id`, `symbol`, `name`, `quantity` as a decimal
string, `unit_price` in minor units, `currency`, `as_of`). Manual entry only. A holding
total that differs from the account balance is shown as "unexplained", never adjusted
automatically. Price feeds are out of scope; any later feed would use `safeFetch` and
be opt-in.

**UI.** A "Holdings" tab on investment accounts, with allocation by holding.

**Storage, backup, export.** In the backup; a separate CSV export.

**Permissions and privacy.** No network calls in this proposal.

**Dependencies.** Investment and asset account types; currency conversion.

**Verification.** Net worth is identical with and without holdings. Rounding of
quantity × price into minor units is exact and tested.

**Scope.** One PR.

## 5. Long-term forecasting

**Problem.** The phase 5 forecast covers the cash runway and goal trajectories, and
phase 7 adds life-event scenarios. Planning across decades (retirement, a mortgage)
needs a longer horizon.

**Distinct from.** Historical charts (reports, net worth over time) describe the past.
This proposal projects forward and is always labelled as a projection.

**Model.** No new engine. Phase 5's dated projection gains yearly steps beyond its
current horizon, with growth and inflation assumptions stored with the scenario, as
7C's are. Loan payoff needs a debt model (balance, rate, repayment) that does not
exist yet. That model is a prerequisite and its own proposal, coordinated with the 6B
card accounting.

**UI.** A "Long term" range on the Forecast page with assumption inputs and a clear
"projection, not a promise" label. Nothing writes to the budget.

**Storage, backup, export.** Assumptions are stored with forecast scenarios (already
in the backup).

**Permissions and privacy.** Local only.

**Dependencies.** Phases 5 and 7 (forecast and scenarios), and a future debt model.
Coordinated with the phase 7 owners; not started in phase 8.

**Verification.** At its existing horizon the projection is identical to phase 5's. A
zero-growth, zero-inflation scenario equals the plain sum of planned flows. Expected pay
never becomes spendable money today.

**Scope.** Design review first; then one PR for yearly steps and one for assumptions.

## Outside phase 8

AI consent flows, credit-score services and household authentication (separate
logins per person) are outside this phase, as the brief states.
