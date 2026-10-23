# Investments (P3)

P3 of the [Monarch adaptation map](research/monarch-flybudget-gap-map.md#recommended-implementation-order):
a dedicated Investments page for positions held in investment, retirement and crypto
accounts. It is a separate feature, not derived from net-worth charts or account balances.
Observations that informed it are in
[monarch-investments-tested.md](research/monarch-investments-tested.md); nothing here claims
to reproduce Monarch's engine.

## Scope decisions

| Question                 | Decision                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Positions                | A **holding** is a quantity of one security in one open account of type investment, retirement or crypto. One holding per security per account.                                                                                                              |
| Quantities               | Integer millionths of a unit (`quantity`), so fractional shares and coins are exact.                                                                                                                                                                         |
| Securities               | Manual records: code, name, kind (share, ETF, managed fund, bond, crypto, other) and the ISO currency it is priced in. Kind describes the instrument, not look-through exposure. One code per currency.                                                      |
| Quotes and valuation day | **Manual prices only**, one per security per day, in integer minor units per unit. A holding is valued with the latest price on or before the valuation day; a price more than 7 days older is shown as stale. No market-data service, no network calls.     |
| Currencies               | Values are in the security's currency, converted to the account's currency for the account total and to the budget's currency for the page totals, using the existing exchange-rate book (manual or ECB). A missing rate leaves the value out and says so.   |
| Cost basis               | **Tax lots**: acquired date, units and total cost (fees included). A lot's cost may be **unknown** (null); it is never treated as zero.                                                                                                                      |
| Unrealized gain          | Only when every unit is in a lot with a known cost: `gain = value − Σ cost`, `percent = gain / cost`. Partial, missing or mismatched lots show the state instead of a gain. Totals leave such holdings out and count them.                                   |
| Ledger                   | Holdings, prices and lots **never** write transactions or change balances, budget, net worth or reports. The page compares holdings value with the recorded balance; **Record as value** opens the existing Update Value adjustment for the user to confirm. |
| Transfers, deposits      | Not modelled. Cash moving into or out of the account stays in the register as today; buying units is recorded by editing the holding and adding a lot.                                                                                                       |
| Performance              | Unrealized gain on cost only. No time-weighted or money-weighted returns, benchmarks or backtests: they need cash-flow history this model doesn't keep.                                                                                                      |

## Deferred

These need their own design and synthetic validation before any code:

- Sales and realized gains, lot selection (FIFO, specific identification), splits and corporate actions.
- Dividends and distributions, reinvestment and franking credits.
- Australian CGT discount periods or any jurisdiction's tax treatment. The lot's acquired date is recorded but no holding-period label is derived from it.
- Automatic quotes, security search and look-through allocation (fund holdings).
- Performance charts over time, which would need price history per holding and account cash flows.

## Data and invariants

- Migration `0038_investments.sql` adds `securities`, `security_prices`, `holdings` and `tax_lots`. It is additive; existing tables are untouched.
- Deleting a holding removes its lots. A security can't be deleted while held (in any account, closed ones included), and its currency can't change once it has prices.
- Closing an account hides its holdings from the page; they come back if it's reopened.
- Backups (format 14) include all four tables and validate them on restore; format 13 backups restore with no holdings.
- The routes are under `/api/investments` and need a signed-in session. They are not on the read-only token allowlist.

Code: [investmentMath.ts](../server/src/services/investmentMath.ts) (pure valuation),
[investmentService.ts](../server/src/services/investmentService.ts),
[routes/investments.ts](../server/src/routes/investments.ts),
[Investments.tsx](../client/src/pages/Investments.tsx).
