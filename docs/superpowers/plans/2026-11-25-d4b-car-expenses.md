# D4b Car Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tax time records cars, their logbooks, trips and yearly method (cents per km or logbook), links D1 claims and assets to a car, and counts D1 by the car's method, with lodged-year amendment flags.

**Architecture:** Pure maths in `server/src/services/carExpenses.ts` (no DB), persistence in a new `server/src/services/taxCarService.ts`, routes added to `routes/tax.ts`, and the year's figures folded into `taxYear` and the lodged-figures snapshot that D4a built. The client adds a Car section to the existing Car and home tab and Car selects on claims and assets.

**Tech Stack:** Express + Drizzle/SQLite, Zod 4, Vitest + fast-check, React + TanStack Query, Playwright.

**Spec:** [docs/TAX-CAR-AND-HOME.md](../../TAX-CAR-AND-HOME.md): §5 (design), §7 (tests), §9 (owner decisions), §10 (D4a as built). Read §3 to §5 and §7 before starting; this plan says only what the spec leaves open or what has changed since it was written.

## Global Constraints

- Branch from `main` (the redesign is merged into `main` by PR #288). One PR, `--repo tvrooi/Allotment`.
- Migration **`0089_tax_cars.sql`**, journal `idx` 89, `when` **1797350400000** (0088 is 1797264000000; one day later). Additive only. Statements separated by `--> statement-breakpoint`.
- **`BACKUP_VERSION` 35** (34 is household bill dismissals). New tables go in `TABLES` after `depreciatingAssetYears` / the D4a tables and before `documentLinks`, parents first: `taxCars`, `taxCarLogbooks`, `taxCarYears`, `taxCarTrips`. A version 34 backup restores with them empty.
- Distances are **integer tenths of a km**; rates **tenths of a cent**; money **integer cents**. Every share and claim uses `mulDiv` (`services/investmentMath.ts`), half away from zero. No floats, `parseFloat` or `Number()` on amounts.
- Dates are real `YYYY-MM-DD` via `isoDate` / `isRealDate`; the 84-day logbook minimum uses real date arithmetic.
- Rates: `CENTS_PER_KM = { 2022: 780, 2023: 850, 2024: 880, 2025: 880, 2026: 910 }`, `MAX_WORK_KM = 50_000`. **Re-check every rate on the ATO's cents-per-km page before Task 1** and update `RATES_SOURCE.checked`; if a rate differs, the ATO wins and §3 of the spec is corrected in the same PR.
- Caps: at most **20 cars**, **2,000 trips per car per financial year**, purpose **≤ 200** characters, notes **≤ 500**.
- Lodged years: car writes are **never refused** in a lodged year (decision 7, L3); lodging snapshots each car part as `part = 'car:<carId>'`. Asset and investment locks stay as they are.
- Tokens: organise tokens read the car GETs only (decision 6, T2). No new policy row, no token write; a token's claim body with `carId` is refused.
- Client fields come from `client/src/components/ui/` (the `allotment/no-raw-form-control` lint rule fails otherwise). Km inputs are `Input` with `inputMode="decimal"`, parsed by one helper, never `type="number"` and never `CurrencyInput`. Saves respect `useCanSave` and show `<SavingPausedHint />`. Layout holds at 390 px.
- User-visible words: sentence case, "cents per km", "logbook", "work km", "Car and home". Never ask for a number plate.
- App change: `npm run release:prepare -- 0.2.0-up.183` (or the next free version at the time) and a CHANGELOG entry.

## Review Focus

1. **A trip edited or removed after its year was marked lodged.** Expected: the save succeeds and Deductions shows "Amended since lodging" for that car. Test: Task 5, `amends a lodged year when a trip changes`.
2. **A logbook that spans 30 June.** Its business km are the trips in the logbook period (not the financial year), and it serves the year it starts in plus the next four. Test: Task 1, `logbookKm counts trips by the logbook period across 30 June`.
3. **A refund on a linked claim in a logbook year.** Expected: a negative counted amount, rounded half away from zero, which lowers D1. Test: Task 1, `logbook share of a refund is negative and rounds away from zero`.
4. **Archiving a car that already has claims.** The claims keep counting by the car's method; the car stops appearing in the Car select for new claims, but an existing claim's select still shows it. Tests: Task 4, `archived car keeps its claims but refuses a new link`; Task 7, the select test.
5. **Typed km with a comma or two decimals** ("1,234.5", "12.35"). Expected: "1,234.5" reads as 12,345 tenths; "12.35" is refused with a message, never silently rounded. Test: Task 7, `parseKmTenths`.

---

### Task 1: Rates and the pure car maths

**Files:**

- Modify: `server/src/services/taxRates.ts`
- Create: `server/src/services/carExpenses.ts`
- Test: `server/src/services/taxRates.test.ts`, `server/src/services/carExpenses.test.ts`

**Interfaces:**

- Produces (all exported from `carExpenses.ts`):
  - `type CarMethod = 'cents_per_km' | 'logbook'`
  - `interface Logbook { id: string; startsOn: string; endsOn: string; odometerStart: number | null; odometerEnd: number | null; totalKm: number | null; businessKm: number | null }`
  - `interface Trip { date: string; km: number }`
  - `MIN_LOGBOOK_DAYS = 84`; `logbookLongEnough(startsOn: string, endsOn: string): boolean` (both days counted)
  - `logbookFor(logbooks: Logbook[], fy: number): Logbook | null`
  - `logbookKm(logbook: Logbook, trips: Trip[]): { businessKm: number | null; totalKm: number | null; source: 'trips' | 'typed' | 'mixed'; missing: ('km' | 'tripsOverTotal')[] }`
  - `businessBps(businessKm: number, totalKm: number): number`
  - `workKmFor(typedWorkKm: number | null, trips: Trip[], fy: number): { workKm: number; source: 'typed' | 'trips' }`
  - `interface LinkedClaim { transactionId: string; cost: number; workUseBps: number }`
  - `carYear(input: { year: { method: CarMethod; workKm: number | null; odometerStart: number | null; odometerEnd: number | null; rateTenths: number | null } | null; fy: number; logbooks: Logbook[]; trips: Trip[]; claims: LinkedClaim[] }): CarYearFigures` where `CarYearFigures = { method: CarMethod | null; claim: number; workKm: number | null; workKmSource: 'typed' | 'trips' | null; cappedKm: number | null; rateTenths: number | null; businessBps: number | null; logbookId: string | null; kmSource: 'trips' | 'typed' | 'mixed' | null; linkedClaims: { transactionId: string; counted: number; covered: boolean }[]; missing: ('method' | 'workKm' | 'rate' | 'logbook' | 'km' | 'tripsOverTotal' | 'odometerStart' | 'odometerEnd')[] }`
  - From `taxRates.ts`: `CENTS_PER_KM`, `MAX_WORK_KM`, and `RATES_SOURCE.centsPerKm` (the ATO URL in the spec's `[cpk]` link)

- [ ] **Step 1: Re-check the rates** on the ATO cents-per-km page; record the date in `RATES_SOURCE.checked`.
- [ ] **Step 2: Write the failing tests**, covering spec §7 "D4b" and the fast-check lines, plus:
  - `rateFor(CENTS_PER_KM, y, null)` for every year in the table; `2027` is `null`; an override wins.
  - Cap: 49_999 tenths → `mulDiv(49_999, 880, 100)`; 50_000 and 50_001 both claim `mulDiv(50_000, 880, 100)` = 440_000 cents ($4,400).
  - A logbook year with no odometer reading at the year's start reports `missing: ['odometerStart']` (and `'odometerEnd'` likewise), with the claim still worked out from the share.
  - `logbookLongEnough('2024-01-01','2024-03-24')` is true (84 days including 29 February); `'2024-01-01','2024-03-23'` is false.
  - `logbookFor`: a logbook starting 2021-08-01 (FY 2021) serves 2025, not 2026; a newer logbook wins.
  - `logbookKm counts trips by the logbook period across 30 June`: logbook 2025-05-01 to 2025-08-31, trips on 2025-06-30 and 2025-07-01 both count.
  - Each fallback: typed both → `typed`; trips + odometer → `trips`; typed business + odometer total → `mixed`; nothing → `missing: ['km']`; trips over total → `missing: ['tripsOverTotal']`.
  - `logbook share of a refund is negative and rounds away from zero`: cost −1_005 (a refund) at 5_000 bps counts −503.
  - Cents per km: every linked claim counts `0` with `covered: true`. No method: `method: null`, `missing: ['method']`, each claim counts at its own `workUseBps` and `claim` is their sum.
  - fast-check: a cents-per-km claim never exceeds `mulDiv(MAX_WORK_KM, rate, 100)`; adding a trip never lowers a cents-per-km claim.
- [ ] **Step 3: Run** `npm test --prefix server -- carExpenses taxRates`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `carExpenses.ts` and the `taxRates.ts` additions. Financial years come from `financialYearOf` / `financialYearRange` (`services/financialYear.ts`); no new date helpers.
- [ ] **Step 5: Run** the same command. Expected: PASS. `cd server && npx tsc --noEmit` is clean.
- [ ] **Step 6: Commit** `feat(tax): cents per km and logbook maths for D4b`.

### Task 2: Migration, schema and backup

**Files:**

- Create: `server/src/db/migrations/0089_tax_cars.sql`; Modify: `server/src/db/migrations/meta/_journal.json`, `server/src/db/schema.ts`, `server/src/services/backupService.ts`
- Test: `server/src/db/taxCars.migration.test.ts` (pattern: `loanDetails.test.ts`), the existing backup tests (`grep -rn "toBe(34)" server/src` moves to 35)

**Interfaces:**

- Produces: Drizzle tables `taxCars`, `taxCarLogbooks`, `taxCarYears`, `taxCarTrips`; columns `taxClaims.carId`, `depreciatingAssets.carId`, `documentLinks.carId`, `documentLinks.carLogbookId`. Every column and CHECK as spec §5.1 "D4b"; index `tax_car_trips_car_date_idx` on `(car_id, trip_date)`; partial unique indexes on the two new `document_links` columns, like `document_links_goal_idx`.

- [ ] **Step 1: Write the failing tests.** Migration test: on a database migrated to 0088 with a claim, an asset, a lodged year and home hours, applying 0089 keeps them all unchanged and the new columns are null. A row that breaks each CHECK is refused. Backup: a version 35 round trip keeps one row in each new table and the two `car_id` links; a version 34 backup restores with the new tables empty.
- [ ] **Step 2: Run** `npm test --prefix server -- taxCars.migration backup`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, the journal entry (values in Global Constraints), the schema and `BACKUP_VERSION = 35`.
- [ ] **Step 4: Run** the same command, then `npm test --prefix server`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): tables for cars, logbooks, car years and trips`.

### Task 3: Car service, routes and the Files link kinds

**Files:**

- Create: `server/src/services/taxCarService.ts` (my call: `taxCarHomeService.ts` keeps working from home and the lodged-figures writer; cars are a separate responsibility and would push it past 600 lines)
- Modify: `server/src/routes/tax.ts`, `server/src/services/documentService.ts` (`LINK_TARGETS`)
- Test: `server/src/routes/taxCar.test.ts`

**Interfaces:**

- Consumes: Task 1's `logbookLongEnough`; Task 2's tables.
- Produces (`taxCarService.ts`): `class CarError extends Error { status: number }` (mirror `HomeError`); `MAX_CARS = 20`, `MAX_TRIPS_PER_YEAR = 2_000`; `listCars()`, `createCar(input)`, `updateCar(id, input)`, `removeCar(id)`, `addLogbook(carId, input)`, `updateLogbook(carId, logbookId, input)`, `removeLogbook(carId, logbookId)`, `setCarYear(carId, fy, input)`, `removeCarYear(carId, fy)`, `listTrips(carId, fy, page)`, `addTrip(carId, input)`, `updateTrip(carId, tripId, input)`, `removeTrip(carId, tripId)`, and `carYearsFor(fy): { car: {id, name, archivedAt}; figures: CarYearFigures }[]` (loads rows and calls Task 1's `carYear`; Task 5 uses it).
- Routes: exactly those in spec §5.3 "D4b". `GET /tax/cars` returns each car with its logbooks (each with `logbookKm`). Trips page by date, 200 per page.
- `LINK_TARGETS` gains `car` (column `documentLinks.carId`) and `carLogbook` (column `documentLinks.carLogbookId`), each with `resolve` and `describe` like `goal`.

- [ ] **Step 1: Write the failing route tests**: each Zod refusal in spec §7 for D4b (business km above total, odometer end before start, a trip with no purpose, the 2,001st trip of a year, an 83-day logbook, the 21st car, a fake date, a PUT that omits optional fields does not reset them); a happy path for every route; removing a car removes its logbooks, years and trips. A file links to a car and a logbook through the existing Files link route.
- [ ] **Step 2: Run** `npm test --prefix server -- taxCar`. Expected: FAIL.
- [ ] **Step 3: Implement.** Zod before any DB access; PUT schemas are written out, not `create.partial()`; failures are `CarError` with 404/409/422. Multi-row writes run in one `db.transaction`, opened at the route as `PUT /tax/lodged/:fy` does (the demo's sql.js cannot nest one).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): cars, logbooks, car years and trips routes`.

### Task 4: Claims and assets name their car

**Files:**

- Modify: `server/src/routes/tax.ts` (the `claim` schema, the asset body), `server/src/services/taxService.ts` (`setClaim`, `getClaim`), `server/src/services/depreciatingAssetService.ts`, `server/src/auth/assistantPolicy.ts` (`taxClaimCheck`)
- Test: `server/src/routes/taxCar.test.ts`, `server/src/auth/assistantPolicy.test.ts`

**Interfaces:**

- Produces: claim body `carId: z.string().nullable().default(null)`; the asset body gains the same. `TaxError` 422 "Only a D1 claim can name a car" and 422 "That car is archived" (new links only).

- [ ] **Step 1: Write the failing tests**: `carId` on a D5 claim → 422; an archived car on a new link → 422; `archived car keeps its claims but refuses a new link` (re-saving an existing claim that already names it succeeds); the same two refusals for an asset; deleting a car leaves its claims and assets with `carId` null. Policy: an organise token's `PUT /tax/claims/:id` with `carId` is refused with "Only the owner links a claim to a car", and the same body without `carId` is still allowed.
- [ ] **Step 2: Run** `npm test --prefix server -- taxCar assistantPolicy`. Expected: FAIL.
- [ ] **Step 3: Implement.** `taxClaimCheck` reads the request body and refuses any `carId` key.
- [ ] **Step 4: Run** the same command plus `npm test --prefix server -- receiptsTax`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): D1 claims and assets can name their car`.

### Task 5: The year: D1 total, notes, snapshots, CSV and ZIP

**Files:**

- Modify: `server/src/services/taxService.ts` (`taxYear`, `taxYears`, `taxYearCsv`, `taxYearArchive`), `server/src/services/taxCarHomeService.ts` (`currentParts`)
- Test: `server/src/routes/taxCar.test.ts`, `server/src/services/carExpenses.test.ts` (the D1 invariant)

**Interfaces:**

- Consumes: Task 3's `carYearsFor(fy)`.
- Produces: `taxYear(fy)` gains `cars: { id, name, archived: boolean, figures: CarYearFigures, files }[]`; each `claims[]` entry gains `carId: string | null` and `counted: number` (equal to `claim` when unlinked). `currentParts(fy)` adds one part per car in `cars`: `{part: 'car:<id>', label: '<car name>', figures: {method, workKm, rateTenths, odometerStart, odometerEnd, logbookId, businessBps, claim}}`.

- [ ] **Step 1: Write the failing tests**: D1 = unlinked claims + each car's `claim` + D1 assets (fast-check over random claims and cars); D1 is unchanged by linking a claim to a car with no method; a cents-per-km year makes linked claims count 0; a logbook year applies the share; a logbook-year claim with no receipt counts in `missingReceipts`; each car note in spec §5.3 appears when its condition holds; the two asset prompts in spec §4 (A1) appear and the asset's schedule is unchanged; `taxYears` includes a year that has only a car year; `amends a lodged year when a trip changes` (lodge, add a trip, see an `amended` amendment for `car:<id>`, lodge again, see none); the CSV has a row per car-year; the ZIP passes `unzip -t` and holds the car's and logbook's files under `files/`.
- [ ] **Step 2: Run** `npm test --prefix server -- taxCar carExpenses taxHome`. Expected: FAIL.
- [ ] **Step 3: Implement.** Notes word the car name and the year with `financialYearName`. The amendment note comes from `amendmentNote` unchanged.
- [ ] **Step 4: Run** `npm test --prefix server` and `cd server && npx tsc --noEmit`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(tax): D1 counts each car by its method; car figures in lodged snapshots, CSV and ZIP`.

### Task 6: Token reads and the assistant text

**Files:**

- Modify: `server/src/auth/accessTokens.ts` (`TAX_READ`), `server/src/routes/mcp.ts` (`tax_deductions` text)
- Test: `server/src/auth/accessTokens.test.ts`, the MCP test that covers `tax_deductions`

- [ ] **Step 1: Write the failing tests**: an organise token reads `/tax/cars`, `/tax/cars/<id>`, `/tax/cars/<id>/logbooks` and `/tax/cars/<id>/trips?fy=2025`; a read-only (non-organise) token is refused each; an organise token is refused every car, logbook, year and trip write. `tax_deductions` text lists each car's method and claim.
- [ ] **Step 2: Run** `npm test --prefix server -- accessTokens mcp`. Expected: FAIL.
- [ ] **Step 3: Implement** the four regexes from spec §5.5, with a comment citing decision 6. Confirm how `taxReadAllows` strips the query string before matching `/trips`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): organise tokens read cars, logbooks and trips`.

### Task 7: Client: the Car section and the Car selects

**Files:**

- Create: `client/src/components/tax/CarSection.tsx` (my call: `CarAndHome.tsx` is 482 lines and renders it), `client/src/utils/carKm.ts`, `client/src/utils/carKm.test.ts`
- Modify: `client/src/api/tax.ts`, `client/src/hooks/useTax.ts`, `client/src/components/tax/CarAndHome.tsx`, `client/src/components/tax/TaxClaimSection.tsx`, `client/src/components/tax/Assets.tsx`, the Deductions view in `client/src/pages/Tax.tsx`
- Test: `client/src/utils/carKm.test.ts`

**Interfaces:**

- Produces: `parseKmTenths(text: string): number | null` (thousands commas allowed, at most one decimal place, > 0; "12.35" → null) and `formatKm(tenths: number): string` ("1,234.5 km"). Extend `utils/homeHours.ts`'s `parseRateTenths` parsing into a shared private helper rather than writing a second digit parser.

- [ ] **Step 1: Write the failing tests** for `parseKmTenths`: "1,234.5" → 12_345, "12" → 120, "12.35" → null, "0" → null, "" → null, " 7.5 km " → 75.
- [ ] **Step 2: Run** `npm test --prefix client -- carKm`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper, then the UI as spec §5.4 "Car (D4b)": add a car; each car shows its year's method, km or odometer readings, logbook and share, claim and prompts; logbooks (add, edit, remove, "From trips" or "Typed", a link to the file through `FilesSection`); trips by month with the logbook period marked, and the last few purposes offered by the shared `Combobox`. The Car select on D1 claims and D1 assets lists unarchived cars plus the one already chosen. Deductions shows "Logbook 62%" or "Covered by cents per km" beside a linked claim. Every mutation invalidates `taxYear`, the years list and its own list.
- [ ] **Step 4: Run** `npm test --prefix client`, `npm run build --prefix client` and `cd lint && npm test && npm run lint`. Expected: PASS; warnings not above the cap.
- [ ] **Step 5: Commit** `feat(tax): Car section on Car and home, and Car selects on claims and assets`.

### Task 8: Demo, guide, docs, browser test and release prep

**Files:**

- Modify: `server/src/demo/demoBudget.ts`, `client/src/userGuide/articles.tsx` (the `tax` article), `client/src/guides/pages.ts` (`taxGuide`), `docs/TAX-CAR-AND-HOME.md` (§10 "D4b as built"), `docs/RECEIPTS-AND-TAX.md` §4 and §6, `docs/FILES.md` §4, `docs/READ-ONLY-ACCESS.md`, `docs/ASSISTANT-ENDPOINTS.md`, `HANDOVER.md` State, `CHANGELOG.md`
- Test: `e2e/tests/tax-car-home.spec.ts`

- [ ] **Step 1: Write the failing browser test** (by role and label), desktop and phone: add a car, enter three trips, add a logbook from them, choose Logbook for the year, link a fuel claim from the transaction panel, and see D1 at the logbook's share on Deductions.
- [ ] **Step 2: Run** `cd e2e && npm test -- --project=desktop tests/tax-car-home.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the demo (one car, a logbook filled by a dozen trips, a logbook year, one linked fuel claim), the guide section with the ATO links, and the docs.
- [ ] **Step 4: Run** the browser test on desktop and phone, then `npm run release:prepare -- 0.2.0-up.183` and add the CHANGELOG entry. Expected: PASS; `package.json`, `package-lock.json` and `homeassistant/config.yaml` agree.
- [ ] **Step 5: Commit** `feat(tax): D4b car expenses in the demo, guide and docs (0.2.0-up.183)`.
