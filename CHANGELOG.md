# Changes

## 0.2.0-up.5

- Use consistent budget-account scopes across reports and drill-downs.
- Preserve categories on confirmed transfers and support categorising the budget side of transfers to or from off-budget accounts.
- Preserve existing Up transactions and opening balances when a later sync detects a discrepancy; require review instead of hiding it in historical balances.
- Validate round-up metadata without changing purchases or inventing transfer legs; automatic round-up repair remains pending bank-source verification.
- Automatically publish prepared releases after successful main CI, then make completed releases available through the existing Home Assistant catalog sync.

## 0.2.0-up.4

- Preserve the working Up preview: direct settled AUD imports, including Savers and 2Up.
- Desktop server picker with isolated sessions and HTTPS support.
- Home Assistant startup permissions, persistent encryption key and TCP watchdog fix.
- Automated desktop and multi-architecture Home Assistant releases with Supervisor-compatible image labels.
- Separate Home Assistant catalog updates after successful image publication.

Based on upstream commit `8a692ea679f5b98cf266779d53ccae79f05b0b09`.
