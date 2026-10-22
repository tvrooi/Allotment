# Monarch investments: controlled holding and tax-lot inspection

22 October 2026. Live REA observations from an explicitly authorized synthetic manual account. This extends the earlier [empty investments shell](monarch-populated-workflows.md). It describes recorded UI behavior and one controlled calculation sample, not a recovered portfolio engine.

## Authorized test data and retained inventory

A manual **Brokerage (Taxable)** account named **REA INSPECTION — synthetic holdings** was created with one VOO share. This records a manual holding; it is not a market trade. The account, holding and a synthetic tax lot remain pending user permission to delete them. Adding the account changes aggregate net worth, even though no existing records were edited.

The tax lot uses acquired date 22 October 2026, price per share 500 and quantity one. Account URLs and identifiers are omitted from this document. Values below are a captured sample, not current market quotations.

## Add holding workflow

Form evidence: `ev_763f15d151c6daf49c3ebcbb317d6075f04afefa922f6c4f6a758a3cfd22f1c4`. Saved result: `ev_7940e4d6ed63921040b6e907f4beb4a32c66b5e3923f064f69c4f47919fbb482`.

**Observed:** Add holding opens a route-backed security search. Searching VOO and selecting the result proceeds to quantity and account selection. New Manual Account opens account type/name fields, after which Save creates the manual holding/account used in this inspection. No minimum search length or popular-result behavior was established.

The populated holdings table shows Security, Price, Quantity, Value, Weight and Past 3 months. It supports Group by asset class, group collapse and period selection.

**Intent, inferred:** security selection establishes the quoted instrument, quantity determines the position and account selection establishes where it is held. The manual-account path allows an unconnected position to appear in portfolio analysis without a banking connection.

## Row selection versus security details

Evidence: `ev_e8b5c3b1906a4aa47ef150b1289440e4cabe6c7891be18b38fc6e2152cf4afa4`.

**Observed:** selecting the holding row adds a VOO series to the backtested performance chart; it does not open the security drawer. A separate unlabeled row button opens that drawer. The drawer shows price, period performance selectors 1M/3M/6M/YTD/1Y/5Y, summary quantity/value and distribution across accounts.

**Intent, inferred:** row selection compares the instrument with the portfolio/reference chart, while the drawer provides position and instrument context. These are different actions despite their proximity. The unlabeled button is an observed affordance, not an accessibility pattern recommended for FlyBudget.

Backtest methodology, dividend adjustment, account cashflows, currency conversion and benchmark normalization remain unverified.

## Advanced allocation: underlying exposure

Evidence: `ev_d88877e2a478ac85614cc3b29df1212e9fe6032f6700fff2d8575756f401fce6`.

**Observed:** the allocation view looks through the ETF to underlying exposures: Cash 0.07%, U.S. stocks 99.45% and international stocks 0.48%. It combines a treemap with collapsible asset groups/subgroups and apportioned holding rows.

This distinguishes the holding's broad instrument classification from exposure inside the fund. The single VOO position can contribute to several underlying allocation groups. The capture does not establish classification update cadence, unsupported-fund behavior, rounding rules or data-provider coverage.

**Intent, inferred:** underlying exposure answers diversification questions that a list containing only the ETF's top-level classification cannot answer. An independent implementation must label whether it is showing instruments or look-through exposure.

## Gains & Losses and the missing-cost-basis state

Overview evidence: `ev_1699ffad853045ee0bfe56ac9db9e5477b320487039f9b35fe5f2b883081401f`.

**Observed:** Gains & Losses offers bar/line views, grouping and Download chart. Summaries show Portfolio Value, Portfolio Cost and gain in dollars/percent. Table fields include cost basis, current value and gains, with expandable tax lots.

Before a lot was added, the header's cost defaulted to current value and its gain showed zero. The row's basis button also showed current value, while row gain fields were dashes. This inconsistent-looking missing-data presentation is **not proof of a true zero return**; the inspected holding had no supplied acquisition basis at that point.

**Intent, inferred:** position value can be displayed without acquisition data, while meaningful gains require basis. FlyBudget should represent missing basis explicitly rather than interpreting a fallback cost as a verified acquisition amount.

## Tax-lot entry and one verified sample

Entry-choice evidence: `ev_bc3eb191820f818859fe4c7476703bc5ba47206c2abb89dca0535fa1423bf1a0`. Inline editor: `ev_94665a21ab6bf8b85b81cb186238a970680d9f84653a3e02800a57e021408b59`. Saved calculation: `ev_8b0cf0692976ffb00e029f1544b58a40a21ffc8a70c1e3731d6b961450cc845a`.

**Observed:** Add tax lot offers Add manually or Upload document. Only manual entry was exercised. It opens an inline row with Acquired date, Holding period, Price/share, Lot quantity, Cost basis, Current value, Gain dollars/percent, Delete and Add lot controls, plus totals.

The saved synthetic lot produced:

| Field                | Captured result |
| -------------------- | --------------- |
| Acquired             | 22 October 2026 |
| Price per share      | 500             |
| Quantity             | 1               |
| Derived cost basis   | 500             |
| Current value        | 710.72          |
| Gain                 | 210.72          |
| Gain percent         | +42.14%         |
| Holding period label | Short           |

**Derived check, not recovered code:** `basis = quantity × acquisition price`, `gain = current value - basis` and `gain percent = gain / basis × 100` match this sample: `210.72 / 500 × 100 = 42.144%`, displayed as 42.14%. This does not establish the general treatment of fees, sales, realized gains, transferred lots, splits, zero basis, currency changes, lot selection or jurisdiction-specific tax periods. The Short label is observed for this date; its complete date-boundary rule was not tested.

## Funds view and inclusion boundary

Evidence: `ev_fc00af55d23c8d9b9f8b684b0b5b7e6324452fed72d606909e2d6247b882c68a`.

**Observed:** Funds exposes a Broad asset class dropdown and Pie chart type control. A warning says the view includes ETFs and mutual funds only, excluding individual stocks, bonds and other holdings; Got it dismisses the warning. The inspected view has a U.S. Equity group, a pie value and holding rows using the same cost-basis/gain fields.

**Intent, inferred:** the view offers fund-specific classification rather than a complete portfolio allocation. Its inclusion warning prevents a partial total from being mistaken for all assets. Dismissing the warning was observed; persistence of that dismissal was not established.

## FlyBudget design implications and limits

These are independent recommendations, not claims about recovered implementation:

- Separate manual position records, account balances, security prices and tax lots. Creating a holding must clearly explain its effect on aggregate net worth.
- Distinguish historical backtests, actual account performance and unrealized gain/loss. A single cost-basis sample verifies none of the other engines.
- Treat unknown cost basis as missing data. Label totals that include estimated/fallback basis or exclude unsupported positions.
- Use separate accessible controls for chart comparison and security details; preserve period/account filters across both.
- Explain instrument classification versus look-through exposure and identify fund-only totals.

No market order, sale, document upload, realized-gain calculation, multi-lot operation or deletion was exercised. The synthetic account, one-share holding and one tax lot remain available for review until deletion is explicitly authorized.
