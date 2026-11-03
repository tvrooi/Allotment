# Plan: depreciating assets on the Tax time page

Status: **plan, not built.** Owner request, 3 November 2026: add depreciating assets to the Tax
tab, worked out by the ATO's two methods (prime cost and diminishing value). This extends
[RECEIPTS-AND-TAX.md](RECEIPTS-AND-TAX.md) §4, and replaces the "Depreciation schedules" line in
its §6 "Not built" once it ships. Record keeping, not tax advice, like the rest of Tax time.

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
- Backups are at version 22 and include `tax_claims`.

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
  existing claim). That includes sets: identical items bought together that total over $300
  are depreciated.
- **Balancing adjustment event:** sold, lost, destroyed, or no longer used and never expected to
  be used again. Termination value (usually sale proceeds or an insurance payout) less the
  adjustable value on that day gives a balancing adjustment. A shortfall is a deduction; an
  excess is assessable income. Each is reduced by the private-use share. Any capital gain or
  loss on the private share is outside this feature: Allotment shows a note about it.
- **Low-value pool (D6):** a low-cost asset (under $1,000) or a low-value asset (DV adjustable
  value under $1,000) may go into the pool. It's written down at 18.75% in the year it's
  allocated and 37.5% of the closing balance after that. Once an asset is pooled it stays
  pooled. See [Low-value pool][pool].
- **Labels:** an asset's decline goes on the label of what it's used for: D5 for most work
  tools, D4 for self-education, D1 for a car (logbook method only) and D6 for the pool.
- **Records:** keep them for the whole time the asset is held, and for five years after the
  last claim or after disposal.

## 3. Design

### 3.1 Data (migration 0061, additive)

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
| `transaction_id`                         | purchase transaction, nullable, `ON DELETE SET NULL`                                                                               |
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
  - a cost of $300 or less (suggest a claim instead);
  - an effective life of zero or less;
  - a start time before 10 May 2006;
  - a method change once a year that includes the asset is lodged;
  - a transfer or split-parent purchase transaction;
  - a purchase transaction already linked to another asset.
- **No double counting:** `setClaim` refuses a transaction that is an asset's purchase ("This is
  depreciated as <asset>"). `claimByRule` skips it quietly. `claimCandidates` leaves it out.
  "Depreciate instead" on a claimed transaction creates the asset and removes the outright claim
  in one database transaction.
- **`taxYear(fy)`** gains `assets`: each asset's row for the year, with its receipts taken from
  the purchase transaction. Asset deductions add into the label totals and the year total.
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
- **Exports:** the year's deductions CSV gains a row per asset ("Decline in value: <name>").
  The ZIP adds `depreciation-<year>.csv` and the purchase receipts of assets claimed that year.
  Every cell goes through `csvCell`.
- **Backups:** add the three tables, bump `BACKUP_VERSION` to 23, and make restoring an older
  backup leave them empty. Data export: the same.
- **Tokens:** nothing new by default. The new routes are not on the allowlist. Owner decision 2
  covers read access.

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
  - **Mark this year lodged** and its undo sit beside the year selector.
- **Deductions tab:** label totals include asset deductions. Under the claims table, a "Decline
  in value" table lists that year's asset rows. An "Over $300" claim gets a **Depreciate
  instead** button.
- **Transaction panel:** money out over $300 shows "Record as a depreciating asset" beside
  _Claim as a tax deduction_. A purchase already linked to an asset shows that link instead.
- **Safe mode:** every amount goes through `formatCurrency`/`Private`, and `safe-mode.spec.ts`
  covers the new tab.
- **Guides:** add steps to the Tax time page guide in `client/src/guides/pages.ts`, with new
  `data-guide` markers (`tax.assets`, `tax.assetMethod`). `utils/guides.test.ts` checks them.
- Hooks and API in `hooks/useTax.ts` and `api/tax.ts`. React Query invalidates the tax year when
  an asset changes.

### 3.5 MCP (only with owner approval, decision 2)

A read-only `tax_assets` tool, listing assets and this year's schedule rows. No tool creates,
edits or disposes of an asset.

## 4. Phases (one PR and release each)

1. **Calculation and storage (server only):** `depreciation.ts` with tests, migration 0061,
   the service, routes, the double-counting guards, `taxYear` and CSV integration, and backup
   version 23.
2. **UI:** the Assets tab, the form with both-method preview, the asset page, disposal, lodged
   years, "Depreciate instead", the transaction panel action, guides, the user guide
   (`website/docs/tax.mdx`) and docs.
3. **Low-value pool (D6):** allocating low-cost or low-value assets, one pool across years
   (18.75% for the year an asset is added, 37.5% of the opening balance), disposals reducing the
   closing balance, and the D6 total. Pooled assets leave the per-asset schedule. This also
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
  - disposal: a balancing adjustment deduction and an income case, both reduced by private use;
  - start times before 10 May 2006 refused.
- **Route tests:**
  - CRUD validation and the $300 floor;
  - lodged-year locks;
  - `setClaim` refused for an asset's purchase, and "Depreciate instead" being atomic;
  - `taxYear` totals including assets;
  - CSV and ZIP contents, with formula cells neutralised;
  - a backup round trip at version 23, with a version 22 backup restoring;
  - the new routes not reachable with any token (until decision 2).
- **Client:** form validation and the preview showing both methods.
- **e2e:** extend `e2e/tests/receipts-tax.spec.ts` to add an asset from a purchase over $300,
  check the Deductions total, dispose of it, and check Safe mode.
- Checks: `npm test --prefix server -- depreciation tax`, `cd server && npx tsc --noEmit`,
  `npm test --prefix client`, `npm run build --prefix client` and
  `cd e2e && npm test -- --project=desktop tests/receipts-tax.spec.ts`.

## 6. Release and live update

Each app phase follows CLAUDE.md:

- `npm run release:prepare -- <next-version>` and a CHANGELOG entry in the PR;
- after main CI passes, Publish tested main;
- a cold backup including the encryption key before the live HA app takes the release.

Migration 0061 only adds tables, so existing claims, transactions and budgets are untouched.

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
