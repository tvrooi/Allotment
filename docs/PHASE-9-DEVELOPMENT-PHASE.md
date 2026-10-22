# Phase 9: tags, saved views, review and report visibility

Added 22 October 2026 against main `2be0990` (`0.2.0-up.19`). Status: **planned; brief
only, no application implementation in this change**.

Phase 9 implements proposals 2 and 3 of the [phase 8 expansion proposals](PHASE-8-PROPOSALS.md)
(per-transaction review and visibility; tags and saved views). They build on the
phase 8 transaction selection (`server/src/services/transactionSelection.ts`). Receipts,
holdings and long-term forecasting stay as proposals.

## Problems it solves

- Spending that crosses categories (a holiday, a renovation, a tax year) has no label
  of its own, and a filter used every week has to be rebuilt each time.
- After an import there is no way to mark which transactions have been looked at.
- A one-off that is not real spending (a reimbursed work expense, a sale) distorts
  income, spending and the savings rate. Today the only fix is to delete or
  miscategorise it, which damages balances or the budget.

## Distinct from existing review features

- **Up bank-source review** (phase 2) compares imported rows with the bank and never
  rewrites the ledger. Unchanged.
- The **6G budget review** stores nothing. **7E** stores review completions, not
  per-transaction state. Both are unchanged; the 6G page may link to unreviewed
  transactions.
- Per-transaction "reviewed" is a personal checklist mark. It is not reconciliation
  and never sets or clears `reconciled`.

## Binding contracts

### Data model (one additive migration)

- `transactions.reviewed_at` (text, nullable) and `transactions.hidden_from_reports`
  (integer 0/1, default 0). Existing rows are unreviewed and visible.
- `tags` (`id`, `name` unique case-insensitively, `color`, `created_at`) and
  `transaction_tags` (`transaction_id`, `tag_id`, primary key on the pair, both
  `ON DELETE CASCADE`).
- `saved_views` (`id`, `name`, `query`, `sort_order`, `created_at`).
- **Where flags and tags live:** on the register row (an unsplit transaction or a split
  parent). A split's parts inherit the parent's review state, visibility and tags.
  The phase 8 proposal suggested tagging parts individually; tagging the whole
  transaction is simpler to use, matches how the register shows a split once, and
  avoids an extra editor in the split UI. Per-part tags can follow later without a
  data change, by allowing part IDs in `transaction_tags`.
- Integer minor units and shared transaction write helpers are unchanged. Nothing
  here writes money.

### Hide from reports

- One condition (`shownInReports`), next to `budgetActivity` in `services/balances.ts`,
  reads the register row's flag (the parent's for a split part).
- It is added to every query in `routes/reports.ts`: Cash Flow, income and spending,
  categories, merchants, trends, comparisons, daily flow and the custom report and
  dashboard widget data. The shared savings rate therefore excludes hidden rows too.
- It is **not** added to account balances, net worth, the envelope budget and its
  activity, card funding, payday plans, the annual overview, forecasts, budget review
  or reconciliation. A hidden row still moves money, so the budget must still see it.
  Hiding changes reports only.
- Hidden rows stay in the register with a mark and are counted in the register
  summary, which describes bank movement. `hidden=0|1` filters them.

### Review

- `reviewed_at` is set or cleared only by an explicit user action: the detail-panel
  toggle, or **Mark reviewed** on the current selection. Imports, sync, rules, bank-source
  corrections, restores of pre-phase-9 backups and edits never set it.
- Bulk review: `POST /api/transactions/review` with the phase 8 selection, `reviewed`
  (true/false) and `expectedCount`, the number the user confirmed. If the selection
  now matches a different number of register rows, nothing is written and the
  response is 409. The response returns the changed IDs so the change can be undone
  exactly (`POST /api/transactions/review` with `ids`).
- Selection filter `reviewed=0|1`.

### Tags

- CRUD at `/api/tags`. Deleting a tag removes it from its transactions only.
- Assign through `PUT /api/transactions/:id/tags` with the full list of tag IDs (an
  idempotent replace).
- Selection filter `tag_ids` (any of the listed tags) matches a register row carrying
  one of them and all its parts. The summary and export count matching parts as in
  phase 8.
- Rules gain an `add_tag` action. It adds and never removes, and like other rule
  actions it never touches reconciled or user-edited protections.

### Saved views

- A saved view stores the All Transactions URL query exactly (phase 8 `FILTER_KEYS`,
  including `range`). The server validates it with the selection schema when saving
  and rejects unknown keys. Opening a view navigates to `/transactions?<query>`, so it
  shows exactly what the link would.
- A view that refers to a deleted account, category, payee or tag still opens, with
  that filter matching nothing, and says so. It is never silently widened.

### Exports and backups

- CSV export gains `Tags` (semicolon-separated, escaped like other text), `Reviewed`
  and `Hidden from reports` columns.
- Backup format 12 adds `tags`, `transaction_tags` and `saved_views` and the two new
  columns. Format 11 backups restore with every row unreviewed, visible and untagged.

### UI

- Detail panel: a **Reviewed** toggle, a **Hide from reports** toggle with a one-line
  explanation, and a tag picker that can create a tag.
- Register rows: tag chips, plus marks for hidden and reviewed (reviewed is subtle,
  hidden is clear).
- Filter panel: **Tags**, **Reviewed** (any/yes/no) and **Hidden from reports**
  (any/yes/no). **Mark reviewed** applies to the current selection after a
  confirmation naming the count, with undo.
- **Save view** beside **Clear all**, and a **Views** menu in the All Transactions
  header to open, rename and delete views.
- **Settings → Tags**: rename, recolour and delete tags, with usage counts.

## Acceptance (mock data only)

1. Hiding a 300 expense removes it from Cash Flow, category and merchant totals and the
   savings rate. Account balances, the monthly budget's activity and available money,
   and the annual overview are unchanged to the cent. Unhiding restores the reports
   exactly.
2. A hidden split hides every part. A part never shows in reports while its parent is
   hidden.
3. Bulk review of a 3-row selection with `expectedCount=3` marks exactly those rows.
   After a new matching row arrives, the same request returns 409 and writes nothing.
   Undo by IDs restores the previous state exactly.
4. Import, Up sync, rules and restore never set `reviewed_at`.
5. A tagged split shows once in the register. A tag filter's summary and export count
   its parts. Deleting the tag removes it everywhere and keeps the transactions.
6. A rule with `add_tag` tags matching new imports and never removes a tag.
7. A saved view reopens with identical rows and totals. An unknown key is rejected
   when saving.
8. Backup format 12 round-trips tags, views and flags. A format 11 backup restores
   unchanged.
9. Desktop, phone and demo browser flows for tagging, review, hiding and views.

Run the affected server tests and `cd server && npx tsc --noEmit` (plus the browser
worker typecheck), client tests and build, and the relevant e2e projects. Format
changed files with Prettier.

## Delivery

One PR series released as `0.2.0-up.20`:
(1) this brief; (2) review and report visibility; (3) tags and the rule action;
(4) saved views. Then the release, a verified cold backup, the live Home Assistant
update and its checks, as in phase 8.
