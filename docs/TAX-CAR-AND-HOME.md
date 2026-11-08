# Tax: car expenses and working from home

Status: **design approved 8 November 2026** (the owner's decisions are in §9; three differ from
the first recommendations: trip-by-trip entries, token detail reads, and amending lodged years
instead of locking them). D4a (working from home) is built first, then D4b (car); see §10. D4 of the Larger features group. It takes the
"working-from-home hours (the fixed rate per hour), car logbooks and cents per kilometre" line of
[RECEIPTS-AND-TAX.md](RECEIPTS-AND-TAX.md) §6 and adds them to Tax time beside deductions,
[depreciating assets](DEPRECIATING-ASSETS-PLAN.md) and
[investments](INVESTMENT-SALES-AND-INCOME.md). Like the rest of Tax time it is record keeping, not
tax advice: it adds up what the owner records and points at the ATO's rules. It never guesses an
amount, a rate or a number of hours.

The phase names below are D4a and D4b. They are not the return's label D4 (self-education).

## 1. The problem

Tax time claims one transaction at a time (`tax_claims`). That does not work for the two most common work
deductions that aren't a single purchase:

- **Working from home (D5).** Most employees use the ATO's fixed rate: hours worked at home × a
  rate per hour. The record the ATO wants is the hours, day by day, for the whole year. Allotment
  has nowhere to keep hours, so the owner keeps a spreadsheet and types a total somewhere.
- **Car expenses (D1).** The owner either claims cents per kilometre (work km × a rate, at most
  5,000 km) or uses a logbook: a 12-week record gives a business-use share, and every car
  expense (fuel, rego, insurance, servicing, interest, decline in value) is claimed at that share.
  Today a D1 claim is an ordinary claim with its own work use. Nothing knows which car it belongs
  to, which method the year uses, or that under cents per km the receipts aren't deductible at all.
  The written-evidence total already leaves D1 out for this reason (§2).

## 2. What is true today (checked in code, 8 November 2026)

- **Labels and claims** (`server/src/services/taxService.ts`):
  - `TAX_LABELS` (line 42) is D1 to D10 and D15, with `workRelated` true for D1 to D5. The client
    copy of the names is `client/src/utils/taxLabels.ts`.
  - `tax_claims` (`db/schema.ts`) has one row per transaction: `label`, `work_use_bps`
    (1 to 10,000), `notes`.
  - A claim is `Math.sign(cost) * Math.round(Math.abs(cost) * workUseBps / 10_000)` (line 235).
  - D1 is left out of the over-$300 flag (line 249) and the written-evidence total (line 271),
    because car expenses have their own record rules.
  - `setClaim` refuses a transaction that is linked to a depreciating asset (409).
- **The year** (`taxYear(fy)`, line 174) returns
  `{financialYear, name, from, to, claims[], assets[], pool, capitalGains, investmentIncome,
totals[], total, assetIncome, workRelatedTotal, missingReceipts, notes[]}`.
  - `totals` loops over `TAX_LABEL_KEYS`. It adds claims, `assets[].deduction` on the same label,
    and the pool for D6. A label with no entries is dropped.
  - `taxYears(today)` (line 419) is the union of the years that have data.
  - The year's CSV (`taxYearCsv`, line 550) and ZIP (`taxYearArchive`, line 628) are built from
    `taxYear`.
- **Financial years:** `services/financialYear.ts` has `financialYearOf`, `financialYearRange` and
  `financialYearName`. Routes parse `:fy` with `z.coerce.number().int().min(1990).max(2200)`
  (`routes/tax.ts:50`).
- **Depreciating assets** (`depreciatingAssetService.ts`, `depreciation.ts`):
  - A car is just an asset labelled D1. Its per-year work use is in `depreciating_asset_years`.
  - There is no car cost limit; that is phase 4 of DEPRECIATING-ASSETS-PLAN.md (project D7, not
    planned).
- **Lodged years** (`tax_lodged_years`):
  - Asset writes compare each lodged year's schedule before and after the change
    (`refuseLodgedChanges`).
  - Investment writes go through `keepingLodgedYears` (`services/investmentTax.ts:32`). It
    snapshots `lockedFigures(fy)` for every lodged year, runs the change in one `db.transaction`,
    and throws a 409 "…Unlock the year first." if a snapshot moved. Its error is an
    `InvestmentError` that says "investment figures".
  - Claims (`setClaim`, `removeClaim`) are not locked. D4 doesn't change that.
- **Tokens:**
  - `TAX_READ` (`auth/accessTokens.ts:183`) lets organise tokens make the tax GETs:
    `/tax/labels`, `/tax/years`, `/tax/years/:fy` (and `/candidates`), `/tax/claims`,
    `/tax/assets`, `/tax/pool` and `/investments`.
  - The only tax write a token makes is `claim_tax_deduction` (`auth/assistantPolicy.ts:473`).
  - The MCP tools are `tax_deductions`, `tax_years`, `tax_assets`, `claim_tax_deductions`,
    `tax_claim`, `tax_claim_candidates` and `propose_tax_asset` (`routes/mcp.ts`).
- **Files:** link kinds are `LINK_TARGETS` in `services/documentService.ts`. Adding one is a
  nullable foreign-key column on `document_links` with a partial unique index (FILES.md §4).
- **Shared helpers:**
  - `mulDiv(a, b, c)` (`services/investmentMath.ts:53`): BigInt, half away from zero.
  - `isoDate` and `isRealDate` (`utils/validation.ts`).
  - `formatDay` (`client/src/utils/dates.ts`).
- **Backups:** `BACKUP_VERSION = 32`. The last migration is 0084 (journal `idx` 84,
  `when` 1796918400000; each entry adds one day).
- **Client:**
  - `client/src/pages/Tax.tsx` has `TABS` (line 44): `deductions`, `assets` and `inbox`, chosen by
    `?tab=`.
  - `client/src/components/tax/TaxClaimSection.tsx` is the claim box in the transaction panel.
  - The calls are in `api/tax.ts`, and the hooks in `hooks/useTax.ts` and `hooks/useAssets.ts`.
- **Guide:** the `page: 'tax'` article in `client/src/userGuide/articles.tsx`, and `taxGuide` in
  `client/src/guides/pages.ts`.
- **Demo:** `server/src/demo/demoBudget.ts` has no tax claims or assets. The browser app mounts
  `/tax` (`server/src/browser/app.ts:134`) and refuses the ZIP in the demo.
- **Nothing** in `server/src` or `client/src` mentions logbooks, cents per km or working from home.

## 3. The rules this follows

Checked on ato.gov.au on 8 November 2026 ([cents per km][cpk], [logbook][logbook],
[D1 instructions 2026][d1], [fixed rate method][wfh]). Each rule below gets a test. The build PR
checks the rates against the ATO's pages again, and the guide article links them.

**Cents per kilometre (D1)**

- A rate per work kilometre, by income year:

  | Year    | Rate                             |
  | ------- | -------------------------------- |
  | 2022–23 | 78c                              |
  | 2023–24 | 85c                              |
  | 2024–25 | 88c                              |
  | 2025–26 | 88c                              |
  | 2026–27 | 91c (89c base plus a one-off 2c) |

- **At most 5,000 work kilometres per car per year.** More km than that are still claimed as 5,000.
- The rate covers every running cost and decline in value. Fuel, servicing, rego and
  depreciation for that car can't also be claimed that year.
- No written evidence is needed, but the owner must be able to show how the km were worked out
  (for example a diary of work trips).

**Logbook method (D1)**

- A logbook kept for **at least 12 continuous weeks**, during the first income year it is used
  and representative of the year's travel, gives the business-use share: business km ÷ total km
  over the logbook period.
- The logbook is **valid for 5 years**: the income year it starts in and the next four. A new
  logbook replaces it from the year the new one starts.
- Each year the method is used needs **odometer readings at the start and end of the year**.
- Claim = each car expense × business share, plus the car's decline in value × business share.
- **Written evidence** is needed for every expense. Fuel and oil may instead be estimated from
  the odometer records.
- The logbook and odometer records are kept for 5 years after the last income year they support.

**Both car methods**

- The method is chosen **per car, per year**.
- These rules are for a car the owner owns or leases. Work vehicles that aren't cars (a ute
  carrying a tonne or more, a van carrying nine or more people) follow other rules and are out
  of scope.

**Working from home: fixed rate method (D5)**

- Hours worked at home × a rate per hour, by income year:

  | Year                | Rate                                                                |
  | ------------------- | ------------------------------------------------------------------- |
  | 2022–23 and 2023–24 | 67c                                                                 |
  | 2024–25 and 2025–26 | 70c                                                                 |
  | 2026–27             | Not published by the ATO at the time of writing; the owner types it |

  The 52c method of 2020–21 and 2021–22 is a different method and is not supported.

- **Actual hours for the whole year** must be recorded: a timesheet, roster or diary. An
  estimate, or a four-week sample, is not accepted.
- The rate covers energy, phone, internet, stationery and computer consumables. None of these
  can be claimed separately. The owner needs **one record of each covered expense** they had (for
  example one electricity bill and one internet bill).
- The decline in value of work equipment is claimed separately; in Allotment it goes on Tax time
  → Assets, unchanged.
- The **actual cost method** stays what it is today: ordinary D5 claims on transactions.

**From 2026–27**

- A $1,000 instant deduction for work-related expenses has been proposed, which would replace
  itemising if it's larger. Whether it is law, and how it interacts with these claims, is
  checked when the build starts. If it is, Tax time compares it with the itemised work-related
  total (decision 8).

## 4. Options

**Hours record**

- **H1 (chosen): a daily log.** One row per date: minutes worked at home, and a note. Add a
  day, edit a day, remove a day. **Fill a pattern** writes the same minutes on chosen weekdays
  across a date range, after a confirmation. It never overwrites a day already recorded. The rows
  are ordinary ones the owner edits, and the guide says they must match the hours actually worked.
- **H2: weekly totals.** Less typing, but further from the ATO's "actual hours" record.
- **H3: a timesheet CSV import only.** Useful for some employers. It could be added to H1 later.

**Rates**

- **R1 (chosen): a built-in table** of the rates above, keyed by financial year, with the ATO
  link and the date each was checked, in one module. A year that is not in the table, or a year
  where the owner wants a different rate, needs a rate typed for that year. Until one is typed,
  the year shows "Type the ATO's rate for 2026–27" and claims nothing for it. A rate is never
  guessed or carried forward.
- **R2: the owner always types the rate.**

**Car records**

- **K1: totals, with the logbook itself as a file.** A **car** (a name and notes,
  never a number plate). Its **logbooks**: start and end dates, total km, business km, notes, and
  the logbook's photo or PDF linked in Files. Its **years**: method, work km (cents per km), and
  odometer start and end (logbook).
- **K2 (chosen): K1, plus trip-by-trip entries** (date, km, purpose) inside Allotment, and the
  trips fill the logbook (decision 3): the business km of a logbook are its car's trips in the
  logbook period, and the total km come from odometer readings at its start and end. Typed
  totals still work for a paper logbook with no trips entered. Trips also give a cents-per-km
  year its work km when none is typed.

**D1 claims and the car**

- **C1 (chosen): a D1 claim can name its car** (`tax_claims.car_id`).
  - In a **logbook year**, the claim is cost × the logbook's share. The claim's own work use is
    kept, but not used, and the page says so.
  - In a **cents-per-km year**, the claim counts $0 and shows "Covered by cents per km".
  - A D1 claim with no car keeps today's behaviour (its own work use), with a prompt to choose
    a car once one exists.
  - A logbook year counts every linked claim in written evidence: claims without a receipt or
    other file are counted in `missingReceipts`, and the year's note says the ATO wants written
    evidence for each one.
- **C2: no link.** The owner sets each D1 claim's work use to the logbook share by hand, and
  remembers that cents-per-km years claim none.

**Car depreciation**

- **A1 (chosen): link and prompt only.** A D1 asset can name its car
  (`depreciating_assets.car_id`). Tax time compares them:
  - "Logbook share 62%; this asset uses 80% in 2026–27."
  - "2026–27 uses cents per km, which covers decline in value; this asset's deduction is counted
    anyway: set its work use for that year to 0%."
    The asset's schedule is never changed automatically, so a lodged year's asset figures can't
    move behind the owner's back.
- **A2: automatic.** A linked asset's yearly work use follows the car's method and logbook. This is
  more correct with less typing, but a change to a logbook would move asset schedules and their
  locks.

**Tokens**

- **T1: read through the year only.** `GET /tax/years/:fy` is already readable by
  organise tokens, and it gains the car and working-from-home figures (§5.3). The MCP
  `tax_deductions` tool shows them. The new detail routes (`/tax/cars…`, `/tax/home…`) are not
  on `TAX_READ`, and there is no new token write.
- **T2 (chosen): T1, and organise tokens may also read the detail routes** (hours by day, cars,
  logbooks, car years, trips). Still no token write.
- **T3: leave the new figures out of what tokens see.**

**Lodged years**

- **L1: the new figures are locked like investments.** A change that alters a lodged year's car
  or working-from-home figure is refused with "Unlock the year first".
- **L2: no lock.** Claims aren't locked either.
- **L3 (chosen): change freely, and flag the amendment.** The owner can change a lodged year,
  "like you can amend a lodged tax return" (decision 7). Marking a year lodged records what its
  car and working-from-home figures were. Afterwards Tax time shows "Amended since lodging: was
  $X, now $Y" for each one that changed, so the owner knows to lodge an amendment, and **Mark
  lodged again** records the new figures. Assets and investments keep their existing lock; a
  later PR can move them to the same flag if the owner wants.

## 5. Design

This is the design with the owner's choices in §9. The builder takes the next free
migration number and backup version when building, and re-checks every line reference.

### 5.1 Data (migration `0085_tax_car_and_home.sql`, additive)

D4a (working from home):

- **`tax_home_hours`**:
  - `work_date` text primary key: a real `YYYY-MM-DD`.
  - `minutes` integer: `CHECK (minutes BETWEEN 1 AND 1440)`.
  - `notes` text, nullable.
  - `created_at`, `updated_at`.
- **`tax_home_years`**: one row only when the owner sets something for a year.
  - `financial_year` integer primary key.
  - `rate_tenths` integer nullable: the rate in tenths of a cent per hour, so 70c is 700. A null
    uses the built-in table.
  - `notes` text, nullable.
  - It is also the target of a Files link kind **`homeYear`**
    (`document_links.home_year_fy`, `ON DELETE CASCADE`). The owner keeps the covered-expense
    bills there.
- **`tax_lodged_figures`**: what a part of a lodged year claimed when it was marked lodged
  (decision 7).
  - `financial_year` integer, references `tax_lodged_years`, `ON DELETE CASCADE`.
  - `part` text: `'home'` in D4a, and `'car:<car id>'` in D4b.
  - `figures` text: JSON of the part's inputs and claim. For `home` that is
    `{minutes, rateTenths, claim}`; for a car, `{method, workKm, rateTenths, odometerStart,
odometerEnd, logbookId, businessBps, claim}`.
  - `recorded_at` text.
  - Primary key `(financial_year, part)`.

D4b (car; its own migration, the next number):

- **`tax_cars`**:
  - `id` text primary key, `name` text not null, `notes` text.
  - `archived_at` text, nullable. An archived car keeps its years; it isn't offered for new
    claims.
  - `created_at`, `updated_at`.
- **`tax_car_logbooks`**:
  - `id` text primary key.
  - `car_id`, references `tax_cars`, `ON DELETE CASCADE`.
  - `starts_on`, `ends_on`.
  - `odometer_start`, `odometer_end`: integers nullable (tenths of a km), read at the logbook's
    start and end.
  - `total_km` and `business_km`: integers nullable (tenths of a km). These are typed overrides
    for a paper logbook; when null they are worked out (§5.2).
  - `notes`, `created_at`, `updated_at`.
  - CHECK `business_km IS NULL OR business_km > 0`, CHECK
    `total_km IS NULL OR business_km IS NULL OR business_km <= total_km`, and CHECK
    `odometer_end IS NULL OR odometer_start IS NULL OR odometer_end > odometer_start`.
  - The 84-day minimum (12 weeks, both days counted) is checked in Zod with real date arithmetic,
    not in SQL.
  - A Files link kind **`carLogbook`** (`document_links.car_logbook_id`) holds the logbook file.
- **`tax_car_years`**:
  - Primary key `(car_id, financial_year)`, `ON DELETE CASCADE`.
  - `method`: `'cents_per_km' | 'logbook'`.
  - `work_km` integer nullable (tenths; cents per km).
  - `odometer_start`, `odometer_end`: integers nullable (tenths; logbook).
  - `rate_tenths` integer nullable (an override of the cents-per-km rate, as for hours).
  - `notes`.
  - CHECK `odometer_end IS NULL OR odometer_start IS NULL OR odometer_end >= odometer_start`.
- **`tax_car_trips`** (decision 3): each work trip.
  - `id` text primary key, `car_id` (references `tax_cars`, `ON DELETE CASCADE`).
  - `trip_date` (a real `YYYY-MM-DD`), `km` integer (tenths, `CHECK (km > 0)`),
    `purpose` text not null (at most 200 characters), `notes`.
  - `created_at`, `updated_at`.
  - An index on `(car_id, trip_date)`. At most 2,000 trips per car per financial year, checked
    in the service.
- **`tax_claims.car_id`**: nullable, references `tax_cars`, `ON DELETE SET NULL`.
- **`depreciating_assets.car_id`**: nullable, references `tax_cars`, `ON DELETE SET NULL`.
- A Files link kind **`car`** (`document_links.car_id`) for odometer photos and trip diaries.

Every migration also needs:

- the matching `schema.ts` change, and a `_journal.json` entry with the next `idx`, the same
  `tag` and a `when` one day after the previous one;
- the new tables in `TABLES` in `services/backupService.ts`, after `depreciatingAssetYears` and
  before `documentLinks` (parents first): backup version 33 in D4a and 34 in D4b. An older backup
  restores with the new tables empty. Every test that hard-codes the version moves with it
  (`grep -rn "toBe(32)" server/src`);
- a migration test on a populated database, like `loanDetails.test.ts`.

### 5.2 Calculation (pure, no DB)

**`server/src/services/taxRates.ts`** is the one place the rates live:

```ts
export const CENTS_PER_KM = { 2022: 780, 2023: 850, 2024: 880, 2025: 880, 2026: 910 }; // tenths of a cent
export const HOME_HOURLY = { 2022: 670, 2023: 670, 2024: 700, 2025: 700 };
export const RATES_SOURCE = {
  centsPerKm: '<ATO url>',
  homeHourly: '<ATO url>',
  checked: '2026-11-08',
};
export const MAX_WORK_KM = 50_000; // 5,000 km in tenths
export function rateFor(table, fy, override: number | null): number | null; // override ?? table[fy] ?? null
```

**`server/src/services/lodgedFigures.ts`** (pure part, decision 7):

- `amendments(lodged: {part, figures}[], now: {part, label, figures}[], isLodged)` returns
  `[{part, label, lodgedClaim, claim, status}]`, where `status` is `'amended'` (the claim
  differs) or `'notRecorded'` (the year is lodged but this part has no snapshot: it was lodged
  before the feature existed, or the part was added afterwards). Unchanged parts are left out.
- `amendmentNote(a)` is the one helper that words both the year's note and the page's banner:
  "Amended since lodging: working from home was $590.10, now $612.50. Lodge an amendment with
  the ATO, then mark the year lodged again." and "Working from home wasn't recorded when 2025–26
  was lodged."

**`server/src/services/homeHours.ts`**:

- `homeYear(days: {date, minutes}[], rateTenths: number | null)` returns
  `{minutes, days, rateTenths, claim, missing: ('rate')[]}`.
- `claim = mulDiv(minutes, rateTenths, 600)` (minutes ÷ 60 × tenths of a cent ÷ 10), half away
  from zero, in cents. With no rate, the claim is `0` and `missing: ['rate']`.

**`server/src/services/carExpenses.ts`**:

- `logbookFor(logbooks, fy)`: the logbook with the latest `starts_on` whose financial year is
  from `fy − 4` to `fy`. Otherwise null.
- `logbookKm(logbook, trips)` (decision 3) returns `{businessKm, totalKm, source, missing[]}`:
  - business km: the typed `business_km`, else the sum of the car's trips from `starts_on` to
    `ends_on` inclusive;
  - total km: the typed `total_km`, else `odometer_end − odometer_start`;
  - `source` is `'trips'`, `'typed'` or `'mixed'`, shown on the page;
  - `missing: ['km']` when either is unknown or zero, and `missing: ['tripsOverTotal']` when the
    business km exceed the total.
- `businessBps(km) = mulDiv(businessKm, 10_000, totalKm)`.
- A cents-per-km year's work km: the typed `work_km`, else the sum of the car's trips in the
  financial year. The page says which.
- `carYear({year, logbooks, rate, claims, assets})` returns
  `{method, claim, workKm, cappedKm, businessBps, logbookId, linkedClaims[], missing[]}`.
  - **Cents per km:** `claim = mulDiv(min(workKm, MAX_WORK_KM), rateTenths, 100)`, in cents
    (tenths of a km × tenths of a cent ÷ 100). Every linked claim counts `0` and is marked covered.
    `missing` can be `'workKm'` or `'rate'`.
  - **Logbook:** every linked claim is `sign × mulDiv(|cost|, businessBps, 10_000)`, and `claim`
    is their sum. `missing` can be `'logbook'` (none valid), `'km'` (the logbook's km can't be
    worked out), `'odometerStart'` or `'odometerEnd'` (the year's readings).
  - A car with claims or assets in a year but no `tax_car_years` row reports `method: null` and
    `missing: ['method']`. Its linked claims count at their own work use, as today, until a
    method is chosen, and its `claim` is their sum, so linking a claim before choosing a method
    never lowers D1.

### 5.3 Server

- **No lock; lodging records a snapshot** (decision 7).
  - Car and working-from-home writes are not refused in a lodged year and are not wrapped in
    `keepingLodgedYears`. `investmentTax.ts` and the asset lock are left as they are.
  - `PUT /tax/lodged/:fy` (today `lodgeYear` in `depreciatingAssetService.ts`, which inserts
    with `onConflictDoNothing`) also writes the year's `tax_lodged_figures` rows, replacing any
    there, in one DB transaction with the lodged row. On a year that is already lodged this
    refreshes the snapshot: that is **Mark lodged again**. The snapshot is built from the same
    functions `taxYear` uses, so the two can't disagree. The writer lives in `lodgedFigures.ts`
    (its DB part); `lodgeYear` calls it. (sql.js in the demo can't nest transactions: open the
    transaction once, at the route, as `setClaim` does.)
  - `DELETE /tax/lodged/:fy` removes the rows by the cascade.
  - Only the car and working-from-home parts are snapshotted. Assets and investments are locked
    instead, and claims are neither.
- **Service `taxCarHomeService.ts`:** the CRUD for hours, home years (and in D4b cars,
  logbooks, car years and trips). Writes that touch several rows (fill) run in one DB
  transaction.
- **Routes** in `routes/tax.ts`, owner session only. Every body is Zod-validated before any DB
  access, PUT schemas are not `create.partial()`, and the error is a `TaxError` with a status.
  - D4a:
    - `GET /tax/home/:fy` → `{days: [{date, minutes, notes}], year: homeYear(...), rate: {table, override}}`
    - `PUT /tax/home/days/:date` `{minutes 1..1440, notes ≤ 500}`
    - `DELETE /tax/home/days/:date`
    - `POST /tax/home/fill` `{from, to, weekdays: (1..7)[], minutes}`: at most 400 days, inside one
      financial year, skips days that already have hours, and returns `{added, skipped}`.
    - `PUT /tax/home/years/:fy` `{rateTenths: int 1..10_000 | null, notes}`
    - `PUT /tax/lodged/:fy` keeps its path and body; it now also records the snapshot.
  - D4b:
    - `GET /tax/cars`, `POST /tax/cars`, `PUT|DELETE /tax/cars/:id` (at most 20 cars).
    - `POST /tax/cars/:id/logbooks`, `PUT|DELETE /tax/cars/:id/logbooks/:logbookId`.
    - `PUT|DELETE /tax/cars/:id/years/:fy`.
    - `GET /tax/cars/:id/trips?fy=` (one financial year, paged by date),
      `POST /tax/cars/:id/trips`, `PUT|DELETE /tax/cars/:id/trips/:tripId`.
    - The claim body (`PUT /tax/claims/:transactionId`) gains `carId` (nullable): allowed only
      with label D1 and a car that isn't archived.
    - The asset body gains `carId`, also D1 only.
- **The year.** `taxYear(fy)` gains `home`, `cars[]` (the results above, plus car names),
  `amendments[]` (from `lodgedFigures.ts`) and, if decision 8's measure is law,
  `instantDeduction`. In `totals`:
  - **D1** = unlinked D1 claims at their own work use + every car's `claim` (which, for a car
    with no method yet, is its linked claims at their own work use, §5.2) + D1 assets
    (unchanged).
  - **D5** += `home.claim`.
  - In each `claims[]` entry, a linked claim carries `carId` and the amount it counts
    (`counted`), so the page and the CSV show both.
- **Notes**, added to `notes[]`:
  - Working from home:
    - "Keep a record of the hours you actually worked and one bill for each expense the rate
      covers (energy, phone, internet, stationery)."
    - "Type the ATO's rate for 2026–27."
  - Car:
    - "Choose how to claim <car> for 2025–26."
    - "<car>'s logbook is more than five years old."
    - "Record the odometer at the start and end of the year."
    - "Only 5,000 km are claimed at cents per km."
    - "Logbook claims need written evidence; <n> have no receipt."
  - Assets (A1): the prompts in §4.
  - Lodged years: one note per amendment, from `amendmentNote`.
- **The $1,000 comparison** (decision 8). The build first checks on ato.gov.au whether the
  instant deduction is law, from which year, and which labels it replaces.
  - If it is law: `taxRates.ts` holds `INSTANT_WORK_DEDUCTION = {fromFy, amount, source,
checked}` (amount in cents). For years from `fromFy`, `taxYear` adds
    `instantDeduction: {amount, itemised, larger: 'instant' | 'itemised'}`. `itemised` is the
    sum of the totals of the labels `TAX_LABELS` marks `workRelated` (D1 to D5), so there is
    one definition of the set; if the ATO's set differs, change it in `TAX_LABELS` with a note.
    The note: "Claiming the $1,000 instant deduction instead of itemising would give $X more"
    (or "Your itemised work expenses are $X more than the instant deduction").
  - If it is not law, it is left out, and §10 says why. It is never a tax estimate.
- **`taxYears`** also includes the years that have hours, a `tax_home_years` row or a
  `tax_car_years` row.
- **CSV and ZIP** (`taxYearCsv`, `taxYearArchive`):
  - a row per car-year (method, km or share, claim) and a working-from-home row (hours, rate,
    claim);
  - `home-hours.csv` (date, hours, notes) in the ZIP;
  - the files linked to the year's `homeYear`, to the car and to its logbook. Names follow the
    existing pattern: `files/<date> <label> <name>.<ext>`.
- **Browser app:** the routes come with `taxRouter`, so nothing new to mount. No Node-only
  imports in the new services.

### 5.4 Client

- **A new Tax time tab, Car and home** (`?tab=car-home`), added to `TABS` in `pages/Tax.tsx`, in its
  own `components/tax/CarAndHome.tsx` (lazy-loaded like the page). It follows the year chosen on
  the page.
  - **Working from home (D4a):**
    - Hours this year, the rate (with "ATO rate" or "your rate", and **Change**) and the claim.
    - The days by month: the date via `formatDay`, then hours and minutes.
    - **Add hours** (date and hours/minutes), **Fill a pattern** (range, weekdays, hours; it
      confirms "Adds 92 days, skips 3 already recorded").
    - Each day has edit and remove buttons with aria-labels.
    - **Bills** opens the year's linked files.
  - **Car (D4b):**
    - **Add a car.**
    - Each car shows the year's method (**Cents per km** or **Logbook**), work km or odometer
      readings, the logbook in use and its share, the claim, and its prompts.
    - **Logbooks**: add, edit, remove, with a link to the file, odometer readings at the start
      and end, and "From trips" or "Typed" beside its km.
    - **Trips**: add, edit and remove (date, km, purpose, notes), listed by month, with the
      logbook period marked. Purpose remembers the last few typed for quick entry.
  - Amounts are shown through the currency formatter. Km and hours are plain text inputs with
    `inputMode="decimal"` (not money, so not `CurrencyInput`), converted to tenths or minutes by
    one helper. Save buttons follow `useCanSave` and show `<SavingPausedHint />`. The layout holds
    at 390 px.
- **Deductions tab:** the D1 and D5 rows include the new amounts. A linked claim shows
  "Logbook 62%" or "Covered by cents per km" beside its own share.
  - In a lodged year with amendments, a banner lists each one (from the year's `amendments`,
    worded like `amendmentNote`), with **Mark lodged again** (owner only, `useCanSave`).
  - When the year has `instantDeduction`, a tile shows "Work-related total" beside "Instant
    deduction" and which is larger.
- **Transaction panel** (`TaxClaimSection.tsx`): a **Car** select for D1 claims once a car exists.
- **Assets** (`components/tax/Assets.tsx`): a **Car** select on D1 assets.
- **API and hooks:** types and calls in `api/tax.ts`, and hooks in `hooks/useTax.ts`. Every
  mutation invalidates the year (`taxYear`), the years list and its own list.
- **Words** (docs/GLOSSARY.md and BRAND.md): sentence case, "working from home", "cents per km",
  "logbook", "work km".
- **Guide:** a "Car expenses and working from home" section in the `tax` article of
  `client/src/userGuide/articles.tsx`, with the ATO links and the records each method needs, and
  a line in `taxGuide` (`guides/pages.ts`).
- **Demo budget** (`server/src/demo/demoBudget.ts`), kept lean:
  - D4a: three weeks of hours in the current year.
  - D4b: one car with a logbook filled by a dozen trips, a logbook year, and one fuel claim
    linked to it.

### 5.5 Tokens and the assistant (T2, decision 6)

- `TAX_READ` (`auth/accessTokens.ts`) gains GETs only, with a comment citing decision 6:
  - D4a: `/^\/tax\/home\/\d{4}$/`;
  - D4b: `/^\/tax\/cars$/`, `/^\/tax\/cars\/[^/]+$/`, `/^\/tax\/cars\/[^/]+\/logbooks$/`
    and `/^\/tax\/cars\/[^/]+\/trips$/` (the query string is not part of the matched path;
    check how `taxReadAllows` strips it).
- No new policy row and no new token write. Every write route is refused for every token, and
  read-only (non-organise) tokens get none of the tax routes, as today.
- `GET /tax/years/:fy` (already allowed for organise tokens) carries `home` and `cars` with the
  rest of the year. Car names are the owner's own words; they aren't more sensitive than payee
  names, which tokens already read.
- `claim_tax_deduction` (the token's insert-only claim) does not accept `carId`. A token's claim
  body with `carId` is refused by the policy's body schema. Only the owner links a claim to a car.
- MCP `tax_deductions` lists the car, working-from-home and amendment lines in its text. A new
  read-only MCP tool is not needed: an assistant can read the detail through `callApi`'s GETs.
  (If the owner wants one later, `tax_assets` is the pattern.)
- docs/READ-ONLY-ACCESS.md and docs/ASSISTANT-ENDPOINTS.md list the new readable paths and say
  tokens can't change them.

## 6. Phases (one PR and release each)

- **D4a, working from home:**
  - migration (`tax_home_hours`, `tax_home_years`, `tax_lodged_figures`, the `homeYear` link
    kind) and backup 33;
  - `taxRates.ts`, `homeHours.ts`, `lodgedFigures.ts`, and the snapshot written by
    `PUT /tax/lodged/:fy`;
  - the routes, the D5 total, notes, amendments, the $1,000 comparison (if law), CSV, ZIP and
    `taxYears`;
  - `TAX_READ` gains `/tax/home/:fy`;
  - the **Car and home** tab with only its working-from-home section, and the Deductions banner
    and tile;
  - the demo, guide, docs and tests.
- **D4b, car:**
  - migration (`tax_cars`, `tax_car_logbooks`, `tax_car_years`, `tax_car_trips`, the `car_id`
    columns, the `car` and `carLogbook` link kinds) and backup 34;
  - `carExpenses.ts` with the trip fallbacks, the routes, the claim and asset links, the D1
    total, car snapshots and amendments, notes, CSV and ZIP;
  - `TAX_READ` gains the car GETs;
  - the tab's car section with trips, the Car selects, and the asset prompts;
  - the demo, guide, docs and tests.

Each phase runs `npm run release:prepare -- <next version>`, adds a CHANGELOG entry, and updates
HANDOVER.md's State, RECEIPTS-AND-TAX.md §4 and §6, FILES.md §4 (the link kinds),
READ-ONLY-ACCESS.md, ASSISTANT-ENDPOINTS.md and §10 here.

## 7. Tests

- **Pure** (`taxRates.test.ts`, `homeHours.test.ts`, `lodgedFigures.test.ts`,
  `carExpenses.test.ts`):
  - every year in both tables;
  - a year not in the table gives `missing: ['rate']` and a claim of 0, and an override wins over
    the table;
  - the ATO's worked example: 843 hours at 70c is $590.10 (the ATO's example says $590);
  - minutes rounding: 1 minute at 70c is 1c, half a cent rounds away from zero;
  - amendments: an unchanged part is left out, a changed one is `amended` with both claims, a
    lodged year with no snapshot is `notRecorded`, an open year gives none; the note's wording;
  - the $1,000 comparison both ways, and none before `fromFy` (only if it is law);
  - D4b: the 5,000 km cap at 4,999.9, 5,000 and 5,000.1 km; a logbook starting in 2021–22 is
    valid for 2025–26 and not 2026–27, and a newer logbook wins; an 83-day logbook is refused
    and an 84-day one accepted (across 29 February too); the business share, with linked claims
    rounded half away from zero, including a refund; each km fallback (typed, from trips, from
    odometer, mixed, missing, trips over the total); cents-per-km work km from trips;
  - fast-check:
    - adding a day never lowers the hours claim;
    - a cents-per-km claim is never above 5,000 × the rate;
    - the D1 total equals unlinked + each car's claim + assets.
- **Service and routes** (`routes/taxHome.test.ts` in D4a, `routes/taxCar.test.ts` in D4b):
  - Zod refusals: a fake date, 0 or 1,441 minutes, a fill across two financial years or over
    400 days, a rate of 0; in D4b business km above total km, odometer end before start, a
    trip with no purpose, the 2,001st trip of a year, `carId` on a D5 claim, an archived car;
  - fill skips recorded days and reports how many;
  - lodging records the snapshot; a change in a lodged year **succeeds** and the year then
    reports the amendment; lodging again clears it; unlodging removes the snapshot; an asset or
    investment change in a lodged year is still refused (the existing tests stay green);
  - D4b: a cents-per-km year makes linked claims count 0, a logbook year applies its share, a
    car year with no method falls back to the claim's own share (D1 is the same before and after
    linking the claim), and deleting a car unlinks its
    claims and assets without deleting them;
  - the CSV and the ZIP (`unzip -t` as today) include the new rows and files.
- **Auth** (`accessTokens.test.ts`, `assistantPolicy.test.ts`), each with the allowed case and
  the nearest refusal:
  - an organise token reads `/tax/years/:fy` with `home`, and `GET /tax/home/:fy` (D4b: the car
    GETs);
  - a read-only (non-organise) token is refused those GETs;
  - an organise token is refused every new write (`PUT /tax/home/days/:date`,
    `POST /tax/home/fill`, `PUT /tax/home/years/:fy`, `PUT /tax/lodged/:fy`; D4b the car,
    logbook, year and trip writes);
  - D4b: a token's `claim_tax_deduction` body with `carId` is refused.
- **Backup:** version 33/34 round trip with the new tables, and a version 32 backup restores with
  them empty.
- **Migration:** applied on a populated 0084 (or D4a's) database, with existing claims, assets
  and lodged years unchanged.
- **Playwright** (`e2e/tests/tax-car-home.spec.ts`, by role and label):
  - D4a: add hours, fill a pattern, see the D5 total on Deductions; mark the year lodged, change
    a day, see "Amended since lodging", and mark it lodged again.
  - D4b: add a car, enter trips and a logbook from them, link a fuel claim from the transaction
    panel, and see D1 at the logbook's share.
  - Both at 390 px.

## 8. Out of scope

- The actual cost method's calculator (floor area, utility apportioning). It stays ordinary D5
  claims.
- The 52c method of earlier years, and the 80c shortcut method of 2019–20 to 2021–22.
- Work vehicles that aren't cars, novated leases and FBT, and the car cost limit
  (DEPRECIATING-ASSETS-PLAN phase 4, project D7).
- GPS tracking and trip import from a logbook app.
- Moving assets and investments from their lock to the amendment flag (a later PR if wanted).
- Any tax payable estimate, any token write, and any assistant proposal for these records.

## 9. Owner decisions

Taken on 8 November 2026, one by one:

| #   | Decision         | Owner's choice                                                                                                                                  |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hours record     | H1: a daily log with **Fill a pattern** (never overwrites a day). As recommended.                                                               |
| 2   | Rates            | R1: the built-in ATO table, and a typed rate for a missing year or an override. As recommended.                                                 |
| 3   | Car records      | **K2: also trip-by-trip entries**, and the trips fill the logbook's km (typed totals still allowed).                                            |
| 4   | D1 claims        | C1: a claim names its car; the year's method decides what it counts. As recommended.                                                            |
| 5   | Car depreciation | A1: link and prompt; the asset's schedule never changes on its own. As recommended.                                                             |
| 6   | Tokens           | **T2: organise tokens read the year's figures and the detail routes**; no writes.                                                               |
| 7   | Lodged years     | **L3: "I should be able to amend, like you can with a lodged tax return."** Change freely, flag "Amended since lodging", and mark lodged again. |
| 8   | $1,000 deduction | **Compare** it with the itemised work-related total, if the build confirms it is law.                                                           |
| 9   | Delivery         | D4a (working from home) first, then D4b (car). As recommended.                                                                                  |

## 10. As built

Not built yet.

[cpk]: https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/cars-transport-and-travel/motor-vehicle-and-car-expenses/expenses-for-a-car-you-own-or-lease/cents-per-kilometre-method
[logbook]: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method
[d1]: https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2026-instructions/deduction-questions-d1-d10-individual-tax-return-2026/d1-work-related-car-expenses-2026
[wfh]: https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method
