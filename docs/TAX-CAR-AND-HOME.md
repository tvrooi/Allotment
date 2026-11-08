# Tax: car expenses and working from home

Status: **design, awaiting owner decisions (§9).** D4 of the Larger features group. It takes the
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
  checked when the build starts. D4 adds a note on Tax time at most (decision 8).

## 4. Options

**Hours record**

- **H1 (recommended): a daily log.** One row per date: minutes worked at home, and a note. Add a
  day, edit a day, remove a day. **Fill a pattern** writes the same minutes on chosen weekdays
  across a date range, after a confirmation. It never overwrites a day already recorded. The rows
  are ordinary ones the owner edits, and the guide says they must match the hours actually worked.
- **H2: weekly totals.** Less typing, but further from the ATO's "actual hours" record.
- **H3: a timesheet CSV import only.** Useful for some employers. It could be added to H1 later.

**Rates**

- **R1 (recommended): a built-in table** of the rates above, keyed by financial year, with the ATO
  link and the date each was checked, in one module. A year that is not in the table, or a year
  where the owner wants a different rate, needs a rate typed for that year. Until one is typed,
  the year shows "Type the ATO's rate for 2026–27" and claims nothing for it. A rate is never
  guessed or carried forward.
- **R2: the owner always types the rate.**

**Car records**

- **K1 (recommended): totals, with the logbook itself as a file.** A **car** (a name and notes,
  never a number plate). Its **logbooks**: start and end dates, total km, business km, notes, and
  the logbook's photo or PDF linked in Files. Its **years**: method, work km (cents per km), and
  odometer start and end (logbook).
- **K2: also trip-by-trip entries** (date, km, purpose) inside Allotment. This would be a lot of
  typing on a phone; most people keep a logbook app or the paper one.

**D1 claims and the car**

- **C1 (recommended): a D1 claim can name its car** (`tax_claims.car_id`).
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

- **A1 (recommended): link and prompt only.** A D1 asset can name its car
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

- **T1 (recommended): read through the year only.** `GET /tax/years/:fy` is already readable by
  organise tokens, and it gains the car and working-from-home figures (§5.3). The MCP
  `tax_deductions` tool shows them. The new detail routes (`/tax/cars…`, `/tax/home…`) are not
  on `TAX_READ`, and there is no new token write.
- **T2: also allow reading the detail routes** (hours by day, logbooks) for organise tokens.
- **T3: leave the new figures out of what tokens see.**

**Lodged years**

- **L1 (recommended): the new figures are locked like investments.** Their figures join the
  lodged-year snapshot, so a change that alters a lodged year's car or working-from-home figure is
  refused with "Unlock the year first". This extends `keepingLodgedYears` (§5.3) instead of
  writing a second lock.
- **L2: no lock.** Claims aren't locked either.

## 5. Recommended design

This is the design with every recommendation in §4 taken. The builder takes the next free
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
  - `total_km` and `business_km`: integers in tenths of a km.
  - `notes`, `created_at`, `updated_at`.
  - CHECK `0 < business_km AND business_km <= total_km`.
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

**`server/src/services/homeHours.ts`**:

- `homeYear(days: {date, minutes}[], rateTenths: number | null)` returns
  `{minutes, days, rateTenths, claim, missing: ('rate')[]}`.
- `claim = mulDiv(minutes, rateTenths, 600)` (minutes ÷ 60 × tenths of a cent ÷ 10), half away
  from zero, in cents. With no rate, the claim is `0` and `missing: ['rate']`.

**`server/src/services/carExpenses.ts`**:

- `logbookFor(logbooks, fy)`: the logbook with the latest `starts_on` whose financial year is
  from `fy − 4` to `fy`. Otherwise null.
- `businessBps(logbook) = mulDiv(business_km, 10_000, total_km)`.
- `carYear({year, logbooks, rate, claims, assets})` returns
  `{method, claim, workKm, cappedKm, businessBps, logbookId, linkedClaims[], missing[]}`.
  - **Cents per km:** `claim = mulDiv(min(workKm, MAX_WORK_KM), rateTenths, 100)`, in cents
    (tenths of a km × tenths of a cent ÷ 100). Every linked claim counts `0` and is marked covered.
    `missing` can be `'workKm'` or `'rate'`.
  - **Logbook:** every linked claim is `sign × mulDiv(|cost|, businessBps, 10_000)`, and `claim`
    is their sum. `missing` can be `'logbook'` (none valid), `'odometerStart'` or
    `'odometerEnd'`.
  - A car with claims or assets in a year but no `tax_car_years` row reports `method: null`,
    `claim: 0` and `missing: ['method']`. Its linked claims then count at their own work use, as
    today, until a method is chosen.

### 5.3 Server

- **One lodged-year lock.** Move `keepingLodgedYears` and `lockedFigures` from `investmentTax.ts`
  into `services/taxLocks.ts`.
  - `lockedFigures(fy)` gains `home: [minutes, rateTenths, claim]` and, per car,
    `[carId, method, workKm, rateTenths, odometerStart, odometerEnd, logbookId, businessBps]`.
    These are the car records' own inputs, not the linked claims, because claims stay unlocked
    (§2).
  - The error becomes a generic `TaxLockError` (409, "That would change the figures of 2025–26,
    already lodged. Unlock the year first.").
  - `investmentTax.ts` re-exports nothing and its callers import from `taxLocks.ts`, so there
    is one implementation.
- **Service `taxCarHomeService.ts`:** every write runs inside `keepingLodgedYears`.
- **Routes** in `routes/tax.ts`, owner session only. Every body is Zod-validated before any DB
  access, PUT schemas are not `create.partial()`, and the error is a `TaxError` with a status.
  - D4a:
    - `GET /tax/home/:fy` → `{days: [{date, minutes, notes}], year: homeYear(...), rate: {table, override}}`
    - `PUT /tax/home/days/:date` `{minutes 1..1440, notes ≤ 500}`
    - `DELETE /tax/home/days/:date`
    - `POST /tax/home/fill` `{from, to, weekdays: (1..7)[], minutes}`: at most 400 days, inside one
      financial year, skips days that already have hours, and returns `{added, skipped}`.
    - `PUT /tax/home/years/:fy` `{rateTenths: int 1..10_000 | null, notes}`
  - D4b:
    - `GET /tax/cars`, `POST /tax/cars`, `PUT|DELETE /tax/cars/:id` (at most 20 cars).
    - `POST /tax/cars/:id/logbooks`, `PUT|DELETE /tax/cars/:id/logbooks/:logbookId`.
    - `PUT|DELETE /tax/cars/:id/years/:fy`.
    - The claim body (`PUT /tax/claims/:transactionId`) gains `carId` (nullable): allowed only
      with label D1 and a car that isn't archived.
    - The asset body gains `carId`, also D1 only.
- **The year.** `taxYear(fy)` gains `home` and `cars[]` (the results above, plus car names). In
  `totals`:
  - **D1** = unlinked D1 claims at their own work use + every car's `claim` + D1 assets
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
    - **Logbooks**: add, edit, remove, with a link to the file.
  - Amounts are shown through the currency formatter. Km and hours are plain text inputs with
    `inputMode="decimal"` (not money, so not `CurrencyInput`), converted to tenths or minutes by
    one helper. Save buttons follow `useCanSave` and show `<SavingPausedHint />`. The layout holds
    at 390 px.
- **Deductions tab:** the D1 and D5 rows include the new amounts. A linked claim shows
  "Logbook 62%" or "Covered by cents per km" beside its own share.
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
  - D4b: one car with a logbook and a logbook year, and one fuel claim linked to it.

### 5.5 Tokens and the assistant (T1)

- No new token route, no new policy row, and nothing added to `TAX_READ`. `/tax/home…` and
  `/tax/cars…` are refused for every token, as is any tax path not on the list.
- `GET /tax/years/:fy` (already allowed for organise tokens) carries `home` and `cars` with the
  rest of the year. Car names are the owner's own words; they aren't more sensitive than payee
  names, which tokens already read.
- `claim_tax_deduction` (the token's insert-only claim) does not accept `carId`. A token's claim
  body with `carId` is refused by the policy's body schema. Only the owner links a claim to a car.
- MCP `tax_deductions` lists the car and working-from-home lines in its text.
- docs/READ-ONLY-ACCESS.md and docs/ASSISTANT-ENDPOINTS.md say the year now includes these
  figures and that tokens can't change them.

## 6. Phases (one PR and release each)

- **D4a, working from home:**
  - migration (`tax_home_hours`, `tax_home_years`, the `homeYear` link kind) and backup 33;
  - `taxRates.ts`, `homeHours.ts`, `taxLocks.ts` (the move, with the investment callers);
  - the routes and the D5 total, notes, CSV, ZIP and `taxYears`;
  - the **Car and home** tab with only its working-from-home section;
  - the demo, guide, docs and tests.
- **D4b, car:**
  - migration (`tax_cars`, `tax_car_logbooks`, `tax_car_years`, the `car_id` columns, the `car` and
    `carLogbook` link kinds) and backup 34;
  - `carExpenses.ts`, the routes, the claim and asset links, and the D1 total, notes, CSV and ZIP;
  - the tab's car section, the Car selects, and the asset prompts;
  - the demo, guide, docs and tests.

Each phase runs `npm run release:prepare -- <next version>`, adds a CHANGELOG entry, and updates
HANDOVER.md's State, RECEIPTS-AND-TAX.md §4 and §6, FILES.md §4 (the link kinds),
READ-ONLY-ACCESS.md and §10 here.

## 7. Tests

- **Pure** (`taxRates.test.ts`, `homeHours.test.ts`, `carExpenses.test.ts`):
  - every year in both tables;
  - a year not in the table gives `missing: ['rate']` and a claim of 0, and an override wins over
    the table;
  - the ATO's worked example: 843 hours at 70c is $590.10 (the ATO's example says $590);
  - minutes rounding: 1 minute at 70c is 1c, half a cent rounds away from zero;
  - the 5,000 km cap at 4,999.9, 5,000 and 5,000.1 km;
  - a logbook starting in 2021–22 is valid for 2025–26 and not 2026–27, and a newer logbook wins;
  - an 83-day logbook is refused and an 84-day one accepted (across 29 February too);
  - the business share, with linked claims rounded half away from zero, including a refund;
  - fast-check:
    - a cents-per-km claim is never above 5,000 × the rate;
    - adding a day never lowers the hours claim;
    - the D1 total equals unlinked + each car's claim + assets.
- **Service and routes** (`routes/taxCarHome.test.ts`):
  - Zod refusals: a fake date, 0 or 1,441 minutes, a fill across two financial years or over
    400 days, business km above total km, `carId` on a D5 claim, an archived car;
  - fill skips recorded days and reports how many;
  - a cents-per-km year makes linked claims count 0, and a logbook year applies its share;
  - a car year with no method falls back to the claim's own share;
  - a change that alters a lodged year's figure is refused (409), and the same change in an open
    year succeeds. An investment sale in a lodged year is still refused after the move to
    `taxLocks.ts` (the existing tests stay green);
  - deleting a car unlinks its claims and assets without deleting them;
  - the CSV and the ZIP (`unzip -t` as today) include the new rows and files.
- **Auth** (`accessTokens` / `assistantPolicy.test.ts`):
  - an organise token reads `/tax/years/:fy` with `home` and `cars` (the allowed case);
  - every token is refused `GET /tax/home/:fy`, `GET /tax/cars` and each new write (the nearest
    refusals);
  - a token's `claim_tax_deduction` body with `carId` is refused.
- **Backup:** version 33/34 round trip with the new tables, and a version 32 backup restores with
  them empty.
- **Migration:** applied on a populated 0084 (or 0085) database, with existing claims and assets
  unchanged.
- **Playwright** (`e2e/tests/tax-car-home.spec.ts`, by role and label):
  - D4a: add hours, fill a pattern, see the D5 total on Deductions.
  - D4b: add a car and a logbook, link a fuel claim from the transaction panel, and see D1 at the
    logbook's share.
  - Both at 390 px.

## 8. Out of scope

- The actual cost method's calculator (floor area, utility apportioning). It stays ordinary D5
  claims.
- The 52c method of earlier years, and the 80c shortcut method of 2019–20 to 2021–22.
- Work vehicles that aren't cars, novated leases and FBT, and the car cost limit (DEPRECIATING-ASSETS-PLAN
  phase 4, project D7).
- GPS or trip tracking, and trip-by-trip logbooks (K2).
- Working out the $1,000 instant deduction, or any tax payable.
- Any token write, and any assistant proposal for these records.

## 9. Owner decisions

Recommendation first in each.

1. **Hours record.** Recommended: H1, a daily log with **Fill a pattern** (it never overwrites a
   day). Or H2 (weekly totals) or H3 (CSV import only).
2. **Rates.** Recommended: R1, the built-in ATO table, and a typed rate for a year not in it (for
   example 2026–27's hourly rate) or to override it. Or R2, always typed.
3. **Car records.** Recommended: K1, totals and odometer readings with the logbook kept as a
   file. Or K2, also trip-by-trip entries.
4. **D1 claims.** Recommended: C1, a claim names its car; the year's method decides what it
   counts. Or C2, no link.
5. **Car depreciation.** Recommended: A1, link and prompt; the asset's schedule never changes on
   its own. Or A2, automatic.
6. **Tokens.** Recommended: T1, organise tokens see the figures in the year they can already
   read; no detail routes and no writes. Or T2 (also the detail routes) or T3 (hide them).
7. **Lodged years.** Recommended: L1, locked like investments, through one shared
   `keepingLodgedYears`. Or L2, no lock.
8. **The $1,000 instant deduction (2026–27).** Recommended: a note on Tax time once the build
   confirms it is law, and no calculation. Or leave it out entirely.
9. **Delivery.** Recommended: D4a (working from home) first, then D4b (car). Or one PR for both.

## 10. As built

Not built yet.

[cpk]: https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/cars-transport-and-travel/motor-vehicle-and-car-expenses/expenses-for-a-car-you-own-or-lease/cents-per-kilometre-method
[logbook]: https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method
[d1]: https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2026-instructions/deduction-questions-d1-d10-individual-tax-return-2026/d1-work-related-car-expenses-2026
[wfh]: https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method
