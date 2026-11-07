# Investments: sales, dividends and franking

Status: **design approved 7 November 2026; nothing is built yet.** The owner took every
recommendation in §9 except decision 7: a read-only assistant tool comes in D3b. Splits come in a
later PR (D3c), as recommended. D3 of the Larger features
group. It takes the first two lines of [INVESTMENTS.md](INVESTMENTS.md) "Deferred" (sales and
realised gains with lot selection; dividends, reinvestment and franking credits) and the Australian
tax treatment they need, and adds them to Tax time beside deductions and
[depreciating assets](DEPRECIATING-ASSETS-PLAN.md). Like the rest of Tax time it is record
keeping, not tax advice: it adds up what the owner records and points at the ATO's rules; it never
guesses an amount.

## 1. The problem

The Investments page (P3, migration 0038) values manual holdings from manual prices and shows an
unrealised gain from tax lots. It has no way to say "I sold 40 units" or "this dividend was paid".
Today the owner lowers the holding's quantity and edits or deletes lots by hand, which loses the
record of what was sold, when, for how much and against which parcels, and there is nowhere to
keep a dividend's franked amount and franking credit. At tax time both are needed:

- **Item 18 (capital gains):** each sale's gain or loss, whether the 50% discount applies, losses
  netted, and losses carried forward.
- **Item 11 (dividends):** unfranked amount, franked amount, franking credit and any TFN amount
  withheld, from each dividend statement.

## 2. What is true today (checked in code, 7 November 2026)

- **Tables** (`0038_investments.sql`, `db/schema.ts`): `securities` (code, name, kind, currency),
  `security_prices` (one per security per day), `holdings` (one per security per account,
  `quantity` in millionths, `>= 0`) and `tax_lots` (`acquired_on`, `quantity > 0`, `cost_basis`
  nullable, never treated as zero). Deleting a holding cascades to its lots.
- **Valuation** (`services/investmentMath.ts`, pure): `valueHolding` compares the holding's
  quantity with the lots' total and reports `complete`, `partial`, `missing` or `mismatch`; gain is
  shown only when every unit has a known cost. `mulDiv` rounds half away from zero with BigInt.
- **Service and routes** (`investmentService.ts`, `routes/investments.ts`): CRUD for securities,
  prices, holdings and lots, owner session only. `updateHolding` sets any quantity and
  `updateLot` any field; nothing ties the two together. Lots can't be dated in the future.
- **Accounts:** holdings live only in open `investment`, `retirement` or `crypto` accounts
  (`INVESTMENT_ACCOUNT_TYPES`).
- **Ledger:** holdings, prices and lots never write transactions or change balances. Cash for a
  purchase or a sale, and dividends, are ordinary register rows (often an Up deposit, not a row in
  the investment account).
- **Currencies:** values convert through the exchange-rate book (`convertAmount`, manual or ECB
  rates by date); a missing rate leaves the value out and says so.
- **Tax time** (`taxService.ts`, `depreciatingAssetService.ts`, `pages/Tax.tsx`): financial years
  named by their start (`financialYearOf`, `financialYearName`); claims by label D1 to D10 and D15;
  depreciating assets and the low-value pool; `tax_lodged_years` locks a lodged year's asset
  figures by comparing them before and after a change; a year's CSV and ZIP. No income items.
- **Tokens and MCP:** `/api/investments` is not on the read-only allowlist and no MCP tool reads
  it. The assistant policy table has no investment rows.
- **Backups** are at version 29 and include the four investment tables. The last migration is 0081. The demo budget has an investment account with no holdings. No user guide article covers
  Investments.

## 3. The rules this follows

From the ATO's [capital gains tax][cgt] pages and the dividend and franking guidance for
individuals. Each rule below gets a test, and the build PR checks the wording against the
ATO's current pages and links them from the guide article.

**Sales (CGT event A1)**

- The event happens on the **contract (trade) date**, not settlement. That date decides the
  financial year.
- **Gain or loss** = capital proceeds − cost base. Brokerage on the purchase is in the lot's cost
  (already the P3 rule); brokerage on the sale reduces the proceeds. A loss uses the reduced cost
  base, which for listed shares and units is the same figure here.
- **50% discount** for an individual when the asset was held **at least 12 months**, not counting
  the day bought or the day sold: acquired 1 January 2025, sold 1 January 2026 is not eligible;
  sold 2 January 2026 is.
- **Netting:** capital losses (this year's, then net capital losses carried forward from earlier
  years) reduce gains **before** the discount, and the owner may choose which gains they reduce.
  Applying them to non-discountable gains first gives the lowest net gain, which is what the ATO's
  own calculator does. A net loss is carried forward, never against other income.
- **Which parcels were sold:** specific identification when the records say which; the ATO
  accepts first in, first out when they don't.
- **Foreign securities:** cost and proceeds are converted to AUD at the rate on each event's date
  (the purchase's for cost, the sale's for proceeds), not by converting the gain.
- **Crypto:** selling, swapping or spending is a disposal like a share sale. A swap's proceeds are
  the market value of what was received.
- **Super:** holdings inside a super fund are taxed in the fund and are not on a personal return.

**Dividends and franking**

- Item 11 takes the **unfranked amount (S)**, **franked amount (T)**, **franking credit (U)** and
  **TFN amounts withheld (V)**, as shown on each dividend statement.
- A franking credit is the company tax already paid: franked amount × rate ÷ (1 − rate), where
  the rate is the company's (30%, or 25% for base-rate entities). The statement states it; the
  calculation is only a prefill.
- **Holding period rule:** a credit counts only if the shares were held at risk for 45 days (90
  for preference shares), not counting the days bought and sold, unless the **small shareholder
  exemption** applies (total franking credits under $5,000 for the year).
- **Dividend reinvestment:** the dividend is still income; the new shares are a new lot acquired
  on the allotment date, with a cost of the amount reinvested.
- **Trust distributions** (most ETFs and managed funds) belong at item 13 and item 18 from the
  fund's annual tax statement (AMMA or AMIT), with their own components (discounted and other
  capital gains, foreign income, cost base adjustments). They are not dividends.

## 4. Options

**Sales, how they relate to lots**

- **L1 (recommended): a sale consumes lots.** A `sale` row (contract date, units, proceeds, sale
  brokerage) and one `parcel` row per lot it drew from (lot, units). A lot's remaining units are
  its units less what parcels took; recording a sale lowers the holding's quantity in the same DB
  transaction, and removing the sale puts both back. A parcel's cost is the lot's cost × parcel
  units ÷ lot units, worked out when read, so correcting a lot's cost corrects the gain, and a
  lodged year is protected the way assets are (compare before and after; refuse with "Unlock the
  year first").
- **L2: a sale stores its own cost.** The sale copies each parcel's cost and acquired date when
  saved. Simpler to lock, but a later correction to the lot is silently not reflected.
- **L3: the owner types the gain.** A sale records proceeds and a cost the owner works out. Least
  code, no help with lots or the discount.

**Lot choice when recording a sale**

- **P1 (recommended): first in, first out by default, with "Choose parcels"** to pick units from
  each lot (specific identification). The choice is saved on the sale as parcels, so the year's
  figures don't change if a later sale picks differently.
- **P2: first in, first out only.**
- **P3: also offer "Highest cost first" and "Lowest gain first"** shortcuts that fill the parcel
  picker. Useful, but they read like advice; could follow later.

**Units without a lot.** A sale needs parcels with a known cost to show a gain. When the holding
has fewer lot units than it sells, or a lot's cost is unknown, the sale is saved with its gain
**unknown** (never zero), shown on the page and counted on Tax time as "costs to add".

**Dividends**

- **I1 (recommended): one income row per payment**, on a holding: paid date, kind (`dividend`,
  `distribution` or `interest`), cash received, unfranked amount, franked amount, franking credit,
  TFN or foreign tax withheld, and optionally units reinvested (which add a lot in the same DB
  transaction, its cost the reinvested amount). Prefill the credit at 30% from the franked
  amount, with 25% one click away; the owner types what the statement says.
- **I2: dividends as tagged transactions.** Use the cash deposit itself with extra columns. It
  ties income to the register but most dividends land in a bank account where the holding isn't,
  reinvested dividends have no cash row at all, and it mixes tax fields into transactions.

**Trust distributions**

- **T1 (recommended): later (D3c).** In D3b a `distribution` row records cash, franked amount and
  credit only, and Tax time shows distributions apart, telling the owner to use the fund's annual
  tax statement for item 13 and 18.
- **T2: enter the annual statement's components** (capital gains discounted and other, foreign
  income, AMIT cost base increase or decrease, which adjust lots). Correct, but larger; its own PR.

**Links to the register.** Sales and income never write transactions (the P3 invariant). Each may
**link** one register row: the sale's settlement deposit or the dividend's deposit. The page
suggests rows with the same amount (in the budget's currency, converted by date) within 7 days and
the owner confirms; never linked by guess, like transfers. Linking only marks the deposit as
investment money on the transaction panel; it changes no category or balance.

**Corporate actions (splits and consolidations).** A split changes units but not cost or acquired
date, and is not a CGT event. **C1 (recommended): a "Split or consolidate" action** that records a split
**event** (date and ratio) and scales the holding in one DB transaction. Lots and earlier sale
parcels are never rewritten: a lot's units on a date are its recorded units times the ratios of
splits after it was acquired and on or before that date, and a parcel's units are as of its sale
date. So a partly sold lot keeps its earlier sale's cost, and only the unsold units are scaled:
100 units costing $100, 40 sold for a cost of $40, then a 2-for-1 split leaves 120 units costing
$60, and the sale still costs $40. **C2:** leave it to manual lot edits. Mergers, demergers, returns of capital and rights
issues stay out of scope.

**Which accounts count for tax.** **A1 (recommended):** sales and income can be recorded in any
investment account, but Tax time leaves out `retirement` accounts (super) and says so. **A2:** also
let the owner mark a non-super account as not theirs for tax (a child's, a trust's); later, if
asked.

## 5. Recommended design

### 5.1 Data (migration 0082, additive; take the next free number when built)

- `investment_sales`: `id`, `holding_id` (RESTRICT: a holding with sales can't be deleted; it stays
  at zero units under **Sold**), `sold_on` (contract date, not in the future), `quantity` (> 0,
  millionths), `proceeds` (minor units of the security's currency, before sale brokerage, `>= 0`),
  `fees` (`>= 0`), `transaction_id` (nullable, SET NULL), `notes`, timestamps. No AUD figure is
  stored: conversion uses the rate book on each date, and a missing rate leaves the AUD figures
  out and says so.
- `investment_sale_parcels`: `sale_id` (CASCADE), `lot_id` (RESTRICT: a lot with parcels can't be
  deleted, and its units can't drop below what parcels took), `quantity` (> 0); primary key
  `(sale_id, lot_id)`.
- `investment_income`: `id`, `holding_id` (RESTRICT, as sales), `paid_on`, `kind`
  (`dividend`, `distribution`, `interest`), `amount` (cash received), `unfranked`, `franked`,
  `franking_credit`, `withheld` (all `>= 0`, minor units of the security's currency), `reinvested_lot_id`
  (nullable, SET NULL), `transaction_id` (nullable, SET NULL), `notes`, timestamps. A check that
  `unfranked + franked = amount + withheld` for dividends is a prompt on the form, not a database
  constraint, because some statements differ by rounding.
- D3c adds `investment_splits`: `id`, `holding_id` (CASCADE only with the holding, which sales
  already protect), `effective_on`, `to_units` and `from_units` (positive integers: 2 and 1 for a
  2-for-1 split, 1 and 3 for a 1-for-3 consolidation). No lot or parcel is changed by a split.
- Indexes on `holding_id` and on the dates for year queries. Backup version 30 with all three
  tables; a version 29 backup restores with no sales or income.

### 5.2 Calculation (`server/src/services/capitalGains.ts` and `investmentIncome.ts`, pure)

- `discountEligible(acquiredOn, soldOn)`: date arithmetic through `isoDate`, the boundary pinned
  by the 1 January examples above and by 29 February acquisitions.
- `lotUnitsOn(lot, splits, date)`: the lot's recorded units scaled by each split after its
  acquisition and on or before `date` (rounded down to a millionth; any fraction lost to a
  consolidation is shown, never silently dropped). A lot's remaining units today are
  `lotUnitsOn(lot, splits, today)` less each parcel's units scaled from its sale date to today.
- `saleParcels(sale, lots, splits, rates)`: each parcel's cost (lot cost × parcel units ÷
  `lotUnitsOn(lot, splits, sale date)`, `mulDiv`),
  AUD cost on the lot's date and AUD proceeds on the sale's date, apportioned to parcels by units
  with the remainder cent on the largest parcel so parts sum to the whole; gain per parcel, its
  discount eligibility, or `unknown` with the reason (no lot, no cost, no rate).
- `fifoParcels(lots, remaining, units)`: oldest acquired first, ties by created time.
- `netCapitalGain(parcels, lossesCarriedIn)`: losses against non-discountable gains first, then
  discountable, then the discount: returns 18H (total current year gains), 18A (net capital gain),
  18V (net capital losses carried forward), and what is unknown.
- `frankingCredit(franked, rateBps)` for the prefill; `holdingPeriodCheck(lots, sales, paidOn)`
  for a prompt when shares bought within 45 days of a dividend were sold soon after, shown only
  when the year's credits reach $5,000.
- Property tests (fast-check): parcels never take more units than lots hold; FIFO equals the
  owner picking oldest first; parts sum to the sale; recording then removing a sale restores the
  holding and lots exactly; losses never make 18A negative; the discount is applied once.

### 5.3 Server

- Service functions in `investmentService.ts` (or a new `investmentTaxService.ts` if it grows):
  `recordSale`, `updateSale`, `removeSale`, `recordIncome`, `updateIncome`, `removeIncome`,
  `splitHolding`, `linkTransaction`/`unlinkTransaction`, each in one DB transaction and each
  checking `lodgedYears()` before and after, as assets do. The holding's quantity stays the units
  held now and `updateHolding` still edits it; lots against remaining units keep the existing
  `mismatch` state as a prompt, not a block, for owners who keep lots loosely.
- Routes under `/api/investments` (owner session only, Zod-validated with caps):
  `POST/PUT/DELETE /holdings/:id/sales[/:saleId]`, `POST /holdings/:id/sales/preview` (parcels,
  gain, discount, before saving), `POST/PUT/DELETE /holdings/:id/income[/:incomeId]`,
  `POST /holdings/:id/split`, and `GET /tax/years/:fy/investments` for Tax time. Mounted in both
  `server/src/index.ts` and `server/src/browser/app.ts` (the demo).
- `taxYear(fy)` gains an `investments` part (item 11 totals, item 18 figures, the sales and income
  rows, unknowns and prompts); the year's CSV gets two more sections and the ZIP includes files
  linked to a sale or income row (a new `investment` link kind in Files, through `LINK_TARGETS`).
- Carried-forward losses: worked out from earlier years recorded in Allotment, plus an optional
  opening figure per budget ("net capital losses from before Allotment") the owner types once.

### 5.4 Client

- **Investments page:** a holding's menu gains **Sell**, **Record dividend** and **Split or
  consolidate**. Sell shows units, contract date, proceeds, brokerage, the parcels (FIFO, or
  **Choose parcels**), and a preview of the gain, the cost and whether the discount applies,
  before saving. A holding's detail lists its sales and income with dates through `formatDay`.
  Holdings at zero units move under a collapsed **Sold** list.
- **Tax time:** a year gains an **Investments** section after Deductions: item 11 (S, T, U, V),
  item 18 (H, A, V), the rows behind them, and prompts: costs to add, missing rates, super left
  out, distributions to take from the fund's statement, the holding period check.
- Money inputs through `CurrencyInput`; names from GLOSSARY.md; every icon-only button labelled.
  The user guide gets an **Investments** article (holdings, prices, lots, selling, dividends,
  what Tax time shows and what it doesn't), linked from both pages.
- Demo budget: one holding with two lots, one sale and one franked dividend, kept lean.

### 5.5 Tokens and the assistant

**Read only, in D3b (decision 7).** An `investments` MCP tool for `organise` tokens, marked
`readOnly`, like `tax_assets`: holdings with their lots, sales (parcels, gain, discount) and
income, valued on a date, plus a year's item 11 and item 18 figures. It reads through GET routes
added to `TAX_READ` in `auth/accessTokens.ts` (the organise tax-read list), not to the general
read-only allowlist: `/investments` (the overview), `/investments/holdings/:id/sales` and
`/investments/holdings/:id/income`, and `/tax/years/:fy/investments`. Every write stays owner-only:
no assistant policy row, no proposal kind, nothing through `/api/assistant/do`. Tests: an organise
token reads each new GET and the tool; a `categorise` or `read` token is refused the same GETs;
an organise token is refused every new POST, PUT and DELETE (sales, income, split, links) and the
preview `POST`. `docs/READ-ONLY-ACCESS.md`, `docs/ASSISTANT-ENDPOINTS.md` and the organise scope's
description in `routes/mcp.ts` change with it.

## 6. Phases (one PR and release each)

- **D3a, sales:** migration, sales and parcels, preview, FIFO and chosen parcels, discount, the
  Investments page's Sell and Sold, Tax time item 18 with carried-forward losses, lodged-year
  locks, backup 30, CSV, demo, guide article, tests.
- **D3b, dividends and franking:** income rows, reinvestment lots, franking prefill, register
  links (also for sales), Tax time item 11, holding period prompt, the `investment` file link kind
  and the ZIP, the read-only `investments` MCP tool for organise tokens (§5.5), tests.
- **D3c, splits:** the "Split or consolidate" action (C1). Trust statements (T2) wait for
  demand.

## 7. Tests

- Pure: every rule in §3 (discount boundary both sides and across 29 February, netting order,
  carried losses, foreign currency by event date, franking prefill at 30% and 25%), plus the
  property tests in §5.2.
- Service: a sale lowers the holding and a removal restores it, in one DB transaction (a failing
  parcel insert leaves nothing changed); a lot with parcels can't be deleted or cut below what was
  sold; a holding with sales can't be deleted; a change to a lodged year is refused and the same
  change in an open year is allowed; a reinvested dividend adds a lot and removing it removes the
  lot; a migration test on a populated 0081 database. D3c: a partial sale, then a split, keeps the
  sale's cost and gain unchanged and scales only the unsold units (the 100-unit example in §4); a
  consolidation's lost fraction is reported; a later sale after a split draws the right cost.
- Routes: Zod refusals (future date, zero units, more units than held, parcels from another
  holding), owner-only writes (every token is refused every new write route; organise tokens may make the
  new GETs, §5.5).
- Backup: version 30 round trip; a version 29 backup restores.
- Playwright (`e2e/tests/investments.spec.ts`): sell part of a holding with chosen parcels, see
  the gain and the discount, find it on Tax time; record a franked dividend and see item 11.

## 8. Out of scope

Automatic quotes or broker imports; mergers, demergers, returns of capital, rights issues and
takeovers; wash-sale or anti-avoidance rules; the personal-use asset exemption for crypto;
foreign income tax offsets beyond recording tax withheld; small business CGT concessions; any tax
payable estimate; performance (time- or money-weighted returns); any token write.

## 9. Owner decisions

Taken on 7 November 2026: the owner endorsed every recommendation except decision 7, where a
read-only assistant tool comes in D3b. Splits (decision 6) come in a later PR, D3c.

1. **Sales and lots.** Recommended: L1, a sale consumes lots and its gain follows lot corrections,
   protected by lodged-year locks. Or L2 (sale copies the cost) or L3 (owner types the gain).
2. **Lot choice.** Recommended: P1, first in, first out by default with "Choose parcels". Or P2
   (FIFO only) or P3 (also cost-based shortcuts).
3. **Loss order.** Recommended: losses against non-discountable gains first, shown on Tax time.
   Or let the owner choose the order each year.
4. **Dividends.** Recommended: I1, one income row per payment with reinvestment and a franking
   prefill. Or I2 (columns on the deposit transaction).
5. **Trust distributions.** Recommended: T1, cash and franking only now, the annual statement
   later (D3c). Or T2 now.
6. **Splits.** Recommended: C1, a "Split or consolidate" action in D3c. Or C2, manual edits.
7. **Tokens.** Recommended: none in D3; a read-only MCP tool later if wanted. Or include a
   read-only tool in D3b. **Owner's choice: a read-only tool in D3b (§5.5).**
8. **Super and other people's accounts.** Recommended: A1, Tax time leaves out retirement
   accounts. Or A2, also a per-account "not mine for tax" switch.
9. **Delivery.** Recommended: D3a (sales), then D3b (dividends and franking), then D3c only if
   decisions 5 or 6 call for it. With C1 chosen, D3c (splits) follows D3b.

[cgt]: https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax
