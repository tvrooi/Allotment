# Changes

## 0.2.0-up.7

- Add opt-in fortnightly payday plans and an Until next payday budget view for desktop and phones.
- Preview bill coverage, fixed funding, due-date targets, monthly smoothing, percentages and remainder allocations using actual payday dates.
- Cap funding to received income and available budget cash; preserve rollover, existing allocations and bank transactions.
- Apply allocations atomically with persistent payday/deposit duplicate protection and stale-preview checks.
- Preserve funding history and archived plans in JSON backup version 5; accept older backups.
- Keep unconfirmed scheduled salaries out of available funding and protect payday amounts when changing currency decimals.

## 0.2.0-up.6

- Add opt-in background Up sync, failure backoff and visible freshness.
- Keep bank observations separate from the ledger; review new imports, changed and omitted bank records without overwriting edits or reconciliation.
- Preserve initialized opening balances even after a register is emptied.
- Show expandable daily round-up purchase details, with boosts included once and original register access. No inferred transfer links or historical ledger repair.
- Preserve token-free bank observations and review history in JSON backup version 4.
- Add native desktop release checks and installer downloads without requiring Apple membership. Verified Developer ID signed Mac builds additionally support download/restart installation; signing and notarization remain optional until configured. The first updater build needs one manual install.

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
