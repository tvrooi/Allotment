# Plan: depreciating assets on the Tax time page

Status: **plan, not built.** Owner request, 3 November 2026: add depreciating assets to the Tax
tab, worked out by the ATO's two methods (prime cost and diminishing value). This extends
[RECEIPTS-AND-TAX.md](RECEIPTS-AND-TAX.md) §4, and replaces the "Depreciation schedules" line in
its §6 "Not built" once it ships. Record keeping, not tax advice, like the rest of Tax time.

Amended 3 November 2026 for [Files](FILES.md) (0.2.0-up.79), which this builds on: an asset's
records (invoice, warranty, photos, a valuation) are files in Files linked to the asset, through a
new `asset` link kind. Files took migration 0062 and backup version 23, so this plan uses 0063
and 24.

## 1. What exists today

- `tax_claims` (`server/src/db/schema.ts`): one claim per transaction, with a return label
  (D1–D10, D15) and a work-use share in basis points. Claim = cost × share, rounded half away
  from zero.
- `taxService.taxYear(fy)` builds a financial year's claims, totals by label, and checks. A
  D2–D5 item over $300 gets `overImmediateLimit` and the note "usually claimed as decline in
  value over several years", but nothing helps the owner do that.
- `client/src/pages/Tax.tsx` has two tabs, **Deductions** and **Receipt inbox**, selected by
  `?tab=`. The transaction panel has `TaxClaimSection`.
- Tokens: organise tokens may read the tax years and add claims (`taxClaimAllows`); MCP has
  `tax_years`, `tax_deductions`, `tax_claim_candidates` and `claim_tax_deductions`.
- **Files** ([FILES.md](FILES.md)): `documents` (every stored file, receipts included),
  `document_links` (one row per link, one nullable foreign-key column per kind of target:
  transaction, category, goal, account) and `document_tags`. `LINK_TARGETS` in
  `services/documentService.ts` lists the kinds; `FilesSection` (`client/src/components/files/`)
  lists, adds and links files for any target. `taxYear` already gives each claim its `files`
  (files linked to the transaction), which count as evidence, and the year's ZIP includes them.
- Backups are at version 23 (Files) and include `tax_claims`, `documents`, `document_links` and
  `document_tags`. The last migration is 0062 (`0062_files.sql`).

## 2. The ATO rules this follows

From the ATO's [Guide to depreciating assets 2026][guide] and
[Working out decline in value][decline]:

|                             | Prime cost (straight line)                     | Diminishing value                                                                              |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Decline in value for a year | cost × days held ÷ 365 × 100% ÷ effective life | base value × days held ÷ 365 × 200% ÷ effective life                                           |
| Base value                  | always the cost                                | cost in the first year, then the opening adjustable value                                      |
| Ends                        | when the adjustable value reaches zero         | never on its own (approaches zero); ends at disposal, or when the asset joins a low-value pool |

- **Days held** counts the days in the income year from the **start time**, when the asset was
  first used or installed ready for use for any purpose. That is not always the purchase date.
  In a leap year days held can be 366, but the divisor stays 365. FY 2027–28 includes
  29 February 2028.
- **DV rate** is 200% for assets first held from 10 May 2006 and 150% before that. Allotment
  refuses start times before 10 May 2006 instead of supporting the old rate.
- **Cap:** a year's decline never exceeds the base value (DV) or the remaining adjustable value
  (PC). This matters for short effective lives: a 2-year DV asset is written off at 100% a year.
- **Taxable use:** the decline is worked out in full, and the deduction is that decline × the
  taxable-use (work-use) share. The adjustable value falls by the **full** decline, not just the
  deducted part.
- **Effective life:** the owner either self-assesses it or uses the Commissioner's
  determination (the ATO's effective life tables). Allotment stores what the owner types.
- **Method:** chosen per asset, and it can't be changed for that asset later.
- **$300 or less:** an item used mainly to earn non-business income is deducted at once (the
  existing claim), unless it is part of a set, or one of several identical or substantially
  identical items, costing more than $300 in total in the income year. Those items are
  depreciated (or pooled) even though each costs $300 or less.
- **Balancing adjustment event:** sold, lost, destroyed, or no longer used and never expected to
  be used again. Termination value (usually sale proceeds or an insurance payout) less the
  adjustable value on that day gives a balancing adjustment. A shortfall is a deduction; an
  excess is assessable income. Each is reduced by the private-use share. Any capital gain or
  loss on the private share is outside this feature: Allotment shows a note about it.
- **Low-value pool (D6):** a low-cost asset (under $1,000) or a low-value asset (DV adjustable
  value under $1,000) may go into the pool. A low-cost asset is written down at 18.75% in the
  year it's allocated. A low-value asset is written down at 37.5% of its opening adjustable
  value in that year. After that, the pool is written down at 37.5% of the previous year's
  closing balance. Once an asset is pooled it stays
  pooled. See [Low-value pool][pool].
- **Labels:** an asset's decline goes on the label of what it's used for: D5 for most work
  tools, D4 for self-education, D1 for a car (logbook method only) and D6 for the pool.
- **Records:** keep them for the whole time the asset is held, and for five years after the
  last claim or after disposal.

## 3. Design

### 3.1 Data (migration 0063, additive; the next free number when built)

`depreciating_assets`

| Column                                   | Notes                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                     | text primary key                                                                                                                   |
| `name`, `notes`                          |                                                                                                                                    |
| `label`                                  | return label: D1, D2, D3, D4, D5 or D15 (D6 comes with the pool in phase 3)                                                        |
| `method`                                 | `prime_cost` or `diminishing_value`; locked once a lodged year includes the asset                                                  |
| `cost`                                   | integer cents, GST-inclusive (the owner isn't GST-registered)                                                                      |
| `start_date`                             | start time (first used or installed ready for use); 10 May 2006 or later                                                           |
| `purchase_date`                          | for the owner's records; defaults to the purchase transaction's date                                                               |
| `effective_life_hundredths`              | effective life in hundredths of a year, so 2.5 years is 250                                                                        |
| `work_use_bps`                           | default taxable-use share, 1–10,000                                                                                                |
| `transaction_id`                         | purchase transaction, nullable, `ON DELETE SET NULL`; its receipts and files are the purchase evidence                             |
| `opening_fy`, `opening_adjustable_value` | optional: for an asset already depreciated elsewhere, the adjustable value at the start of `opening_fy`; the schedule starts there |
| `disposed_date`, `termination_value`     | balancing adjustment event, nullable                                                                                               |
| `created_at`, `updated_at`               |                                                                                                                                    |

`depreciating_asset_years`: `(asset_id, financial_year)` primary key, `work_use_bps` override.
The work-use share can change from year to year, for example a home laptop that becomes mostly
for work.

`tax_lodged_years`: `(financial_year)`, `lodged_at`. The owner marks a year lodged. After that,
edits that would change that year's figures are refused: cost, start date, method, effective
life, opening values and that year's work-use share. Without this lock, fixing a typo in 2027
would silently change the 2026–27 figures already lodged.

Integer cents everywhere, like the rest of Allotment. The asset doesn't change the transaction
or the budget: the purchase stays an expense in its category.

**Files link to assets** (the same migration): one more link kind, exactly as FILES.md §4
describes for adding one.

```sql
ALTER TABLE `document_links` ADD `asset_id` text REFERENCES `depreciating_assets`(`id`) ON DELETE CASCADE;
CREATE UNIQUE INDEX `document_links_asset_idx` ON `document_links` (`asset_id`,`document_id`) WHERE asset_id IS NOT NULL;
```

- `schema.ts`: `assetId` on `documentLinks`, with the same partial unique index.
- `documentService.ts`: one entry in `LINK_TARGETS`,
  `asset: { column: documentLinks.assetId, noun: 'Asset', ...named(depreciatingAssets) }`
  (`named` gives `resolve` and `describe` for any table with `id` and `name`; add
  `typeof depreciatingAssets` to its parameter type). The route's `linkKind` enum, search
  (`GET /files?linkKind=asset`), `linkCounts`, labels on links and the Download all index follow
  from `LINK_KINDS` with no other change.
- Deleting an asset removes only its links: the files stay in Files. Records must be kept for five
  years after the last claim or disposal (§2), so the asset's delete confirmation says how many
  files it has, and that they stay.
- An asset's **evidence** is its files plus the purchase transaction's receipts and files.

### 3.2 Calculation (`server/src/services/depreciation.ts`, pure)

`schedule(asset, years, lodged) → rows[]`, one row per financial year from the start
(or `opening_fy`) to disposal or a zero value:

`{ financialYear, daysHeld, opening, baseValue, decline, workUseBps, deduction, closing,
balancingAdjustment?, kind: 'decline' | 'disposal' }`

- Days held are counted inclusively: start time to 30 June, then whole years, then
  1 July to the disposal date. Divided by 365 (366 days held in a leap year).
- Each year's decline is rounded once to cents, half away from zero, then capped. The deduction
  is the rounded decline × the share, rounded once. Doing PC by cumulative difference (each year's
  decline is the total to date less the total to last year) avoids drift. The final PC year takes
  exactly what is left.
- The function has no database access, so it can be tested on its own and reused by a preview
  route and an MCP read.

Worked example: a laptop costing $2,400, start time 1 October 2026, effective life 2 years,
80% work use. FY 2027–28 holds 29 February 2028, so it has 366 days held.

| FY                 |      PC decline | PC deduction | PC closing |      DV decline | DV deduction | DV closing |
| ------------------ | --------------: | -----------: | ---------: | --------------: | -----------: | ---------: |
| 2026–27 (273 days) |          897.53 |       718.02 |   1,502.47 |        1,795.07 |     1,436.06 |     604.93 |
| 2027–28 (366 days) |        1,203.29 |       962.63 |     299.18 | 604.93 (capped) |       483.94 |          0 |
| 2028–29            | 299.18 (capped) |       239.34 |          0 |                 |              |            |

### 3.3 Server

- `services/depreciatingAssetService.ts` handles create, update, dispose, undispose and remove,
  using the shared transaction helpers. It refuses:
  - a cost of $300 or less, unless the owner ticks "Part of a set or identical items costing
    over $300 this year" (otherwise suggest a claim instead);
  - an effective life of zero or less;
  - a start time before 10 May 2006;
  - a method change once a year that includes the asset is lodged;
  - a transfer or split-parent purchase transaction;
  - a purchase transaction already linked to another asset.
- **No double counting:** `setClaim` refuses a transaction that is an asset's purchase ("This is
  depreciated as <asset>"). `claimByRule` skips it quietly. `claimCandidates` leaves it out.
  "Depreciate instead" on a claimed transaction creates the asset and removes the outright claim
  in one database transaction.
- **`taxYear(fy)`** gains `assets`: each asset's row for the year, with `receipts` and `files`
  shaped like a claim's: the purchase transaction's receipts, and its files together with the
  files linked to the asset (the same query as claims' files, on `document_links.asset_id` as
  well as `transaction_id`, without duplicates). Asset deductions add into the label totals and
  the year total. Missing receipts counts an asset with neither, like a claim.
  `overImmediateLimit` claims link to "Depreciate instead". A balancing adjustment that is
  income shows as a separate note, not as a negative deduction.
- **Routes** in `routes/tax.ts`:
  - `GET /tax/assets` and `GET /tax/assets/:id` (the asset with its full schedule);
  - `POST /tax/assets/preview` returns both methods' schedules without saving, for the form;
  - `POST /tax/assets`, `PUT /tax/assets/:id` and `DELETE /tax/assets/:id`;
  - `PUT /tax/assets/:id/years/:fy` sets a year's work-use share;
  - `POST /tax/assets/:id/dispose` and `DELETE /tax/assets/:id/dispose`;
  - `PUT /tax/lodged/:fy` and `DELETE /tax/lodged/:fy` (owner only);
  - `GET /tax/years/:fy/assets/csv`: the depreciation schedule for the agent, in the shape of
    the ATO's depreciation worksheet.
- **Exports:** the year's deductions CSV gains a row per asset ("Decline in value: <name>"), with
  its receipts and **Other files**. The ZIP adds `depreciation-<year>.csv`, the purchase receipts
  of assets claimed that year (`receipts/…`, as for claims) and their files
  (`files/<date> <label> <name>`, the same code path as claims' files in `taxYearArchive`; a video
  kept on disk is left out). Every cell goes through `csvCell`. Files' own **Download all** index
  shows asset links as "Asset: <name>" (`filesExport.ts`).
- **Backups:** add the three tables to `TABLES` in `backupService.ts`, before `documentLinks`
  (parents before the rows that reference them), bump `BACKUP_VERSION` to 24, and make restoring
  an older backup leave them empty. `document_links.asset_id` travels with `documentLinks`, which
  is already backed up; a version 23 backup has no `assetId` and restores as it is. Data export:
  the same.
- **Tokens:** nothing new by default. The new routes are not on the allowlist. Owner decision 2
  covers read access. Files stay off the allowlist either way (FILES.md §3): a token that may read
  assets sees how many files each has, never the files.

### 3.4 Client

- **Tax time page:** a third tab, **Assets** (`?tab=assets`), between Deductions and Receipt
  inbox.
  - The year selector is shared with Deductions.
  - A list of assets: name, label, method, cost, this year's decline and deduction, closing
    adjustable value, and "Disposed" or "Fully written off" when that applies.
  - **Add asset** opens a form for name, label, cost, start time, effective life and work use.
    It links to the ATO effective life tables and can pick a purchase transaction, which fills
    in the cost, date and receipts.
  - The method choice shows both schedules side by side from `/preview`, with a plain sentence:
    "Diminishing value gives more in the early years; prime cost gives the same each full year.
    You can't change the method later."
  - The asset's page shows the full schedule by year, a work-use share per year, **Dispose**
    (date and termination value, showing the balancing adjustment) and Delete (with
    confirmation, refused while a lodged year includes it).
  - **Records** on the asset's page: `<FilesSection kind="asset" targetId={asset.id}
title="Records" />` for the invoice, warranty, photos or a valuation, above a read-only list of
    the purchase transaction's receipts and files. A line says how long to keep them ("Keep until
    30 June <year>": five years after the last claim, or after disposal). The asset list shows a
    paperclip from `GET /files/counts?kind=asset`.
  - Creating an asset from a purchase links nothing new: the purchase's receipts and files already
    count. Files added on the asset's page are linked to the asset.
  - **Mark this year lodged** and its undo sit beside the year selector.
- **Deductions tab:** label totals include asset deductions. Under the claims table, a "Decline
  in value" table lists that year's asset rows. An "Over $300" claim gets a **Depreciate
  instead** button.
- **Transaction panel:** money out shows "Record as a depreciating asset" beside _Claim as a
  tax deduction_. For $300 or less the form asks for the set tick first. A purchase already
  linked to an asset shows that link instead.
- **Safe mode:** every amount goes through `formatCurrency`/`Private`, and `safe-mode.spec.ts`
  covers the new tab.
- **Guides:** add steps to the Tax time page guide in `client/src/guides/pages.ts`, with new
  `data-guide` markers (`tax.assets`, `tax.assetMethod`). `utils/guides.test.ts` checks them.
- **Files, for the new kind:** `LinkKind` in `api/files.ts` gains `'asset'`; `FileDetailModal`
  gains an **Asset** choice under **Link** (a select of assets, like goals) and `linkTarget` opens
  `/tax?tab=assets&asset=<id>`. Nothing else in Files changes.
- Hooks and API in `hooks/useTax.ts` and `api/tax.ts`. React Query invalidates the tax year when
  an asset changes, and `['files']` when one is deleted (its links go).

### 3.5 MCP (only with owner approval, decision 2)

A read-only `tax_assets` tool, listing assets and this year's schedule rows. No tool creates,
edits or disposes of an asset.

## 4. Phases (one PR and release each)

1. **Calculation and storage (server only):** `depreciation.ts` with tests, migration 0063
   (with `document_links.asset_id`), the service, routes, the `asset` link kind, the
   double-counting guards, `taxYear` and CSV/ZIP integration (asset evidence), and backup
   version 24.
2. **UI:** the Assets tab, the form with both-method preview, the asset page with its Records
   (`FilesSection`), disposal, lodged years, "Depreciate instead", the transaction panel action,
   the **Asset** link choice in Files, guides, the user guides (`website/docs/tax.mdx`,
   `website/docs/files.mdx`) and docs (this file, FILES.md §4 and §8).
3. **Low-value pool (D6):** allocating low-cost or low-value assets, one pool across years
   (18.75% for a low-cost asset added this year, 37.5% for a low-value asset's opening
   adjustable value in its first pooled year, and 37.5% of the previous year's closing balance),
   disposals reducing the closing balance, and the D6 total. Pooled assets leave the per-asset schedule. This also
   lets a DV asset that falls under $1,000 move into the pool.
4. **Optional, later:**
   - second-element costs (an upgrade added to an asset's cost);
   - effective life recalculation;
   - a warning for the car cost limit on D1;
   - suggested effective lives for common work items, such as laptops and phones, each linked to
     the ATO table.

## 5. Tests

- **Unit tests (`depreciation.test.ts`):**
  - the ATO guide's own worked examples, both methods (including the leap-year refrigerator
    example);
  - the laptop table above;
  - a part-year first and last year, a leap-year 366/365 year, and caps for short lives;
  - PC adding up to exactly the cost, and a DV tail;
  - a work-use share that changes by year;
  - an opening adjustable value brought forward;
  - (phase 3) pool entry rates: 18.75% for a low-cost asset, 37.5% for a low-value asset;
  - disposal: a balancing adjustment deduction and an income case, both reduced by private use;
  - start times before 10 May 2006 refused.
- **Route tests:**
  - CRUD validation, the $300 floor and its set exception;
  - lodged-year locks;
  - `setClaim` refused for an asset's purchase, and "Depreciate instead" being atomic;
  - `taxYear` totals including assets;
  - CSV and ZIP contents, with formula cells neutralised;
  - a backup round trip at version 24 with an asset's file links, with version 23 and 22
    backups restoring;
  - the new routes not reachable with any token (until decision 2), and `/files` still not;
  - Files: linking a file to an asset (and to a missing one, 404), `GET /files?linkKind=asset`,
    `GET /files/counts?kind=asset`, deleting an asset keeping its files, and an asset with only a
    linked file (no receipt) counting as evidenced in `taxYear`, with that file in the ZIP
    (extend `server/src/routes/files.test.ts`, "tax time").
- **Client:** form validation and the preview showing both methods.
- **e2e:** extend `e2e/tests/receipts-tax.spec.ts` to add an asset from a purchase over $300,
  add a warranty PDF under its Records, check the Deductions total, dispose of it, and check
  Safe mode.
- Checks: `npm test --prefix server -- depreciation tax files`, `cd server && npx tsc --noEmit`,
  `npm test --prefix client`, `npm run build --prefix client` and
  `cd e2e && npm test -- --project=desktop tests/receipts-tax.spec.ts`.

## 6. Release and live update

Each app phase follows CLAUDE.md:

- `npm run release:prepare -- <next-version>` and a CHANGELOG entry in the PR;
- after main CI passes, Publish tested main;
- a cold backup including the encryption key before the live HA app takes the release.

Migration 0063 only adds tables and one nullable column, so existing claims, transactions, files
and budgets are untouched.

## 7. Owner decisions

1. **Low-value pool:** as phase 3 (recommended), or in the first release?
2. **Assistant access:** should organise tokens read assets (`GET /tax/assets[/:id]` on the
   allowlist and an MCP `tax_assets` read)? Recommended: reading only, never writing.
3. **Lodged-year lock:** add it (recommended), or let past years recalculate freely?
4. **Suggested effective lives:** a short built-in list with ATO links, or none (recommended for
   now, since the ATO revises them)?
5. **Out of scope, confirm:** rental property capital works and depreciation (the rental
   schedule), business assets (simplified depreciation and instant asset write-off), car
   logbooks, and capital gains on the private share.

[guide]: https://www.ato.gov.au/law/view/document?DocID=SAV%2FDEPRECIATING%2F00001
[decline]: https://www.ato.gov.au/forms-and-instructions/depreciating-assets-guide-2020/deductions-for-the-cost-of-depreciating-assets/working-out-decline-in-value
[pool]: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/low-value-assets-pool
