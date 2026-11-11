# UI handover

Overwritten at the end of each UI session, never appended. Last written 11 November 2026 from
`git log -25` on `redesign` (head `cf2e2f0`). Older detail: grep `docs/handover/ARCHIVE.md`.

## Done this session

- Dashboard: the refined design is now `/dashboard` (`pages/Dashboard.tsx`), with a shared chart
  kit; `/dashboard/refined` and DashboardRefined are gone (`cf2e2f0`, up.166).
- Investments: holding cards on phones, a desktop table, a summary strip and one shared holding
  menu (`35555fc`).
- Goals: one summary line, a funding-source tag per row, one progress colour (`b47ddd5`).
- Forecast: leads with the answer, plan menu, no-income callout, projection charts (`fa588b5`, up.165).
- Household: balance band with settle up, split slider, quick shared expense and recent shared
  expenses, tabs and share preview (`da18c99` to `cdeed35`, up.164).
- Dates: day-first word format, `d MMM yyyy` (`f97f2d8`, up.164).
- Accounts, Review, Transactions and Budget passes (`5f2902c` to `b90f132`, up.154 to up.163).
- Engineering skills configured: issue tracker, triage labels, domain docs (`c037524`).

## In progress

- None committed half-done. `redesign` is ahead of `main`; up.154 to up.166 are prepared, not tagged.

## Next up (issues)

- #211 run category-goals specs; #212 run long-term forecast specs (both unrun after wording changes).
- #213 quick expense component test; #214 refresh `docs/ux-ui-evidence/` dates.
- #215 physical iPhone check; #216 dark mode visual check.
- #217 Review queue redesign; #218 Cash flow personal share; #219 Household screens by type.
- #220 sidebar item count (UX review item 7).

## Decisions

- `client/src/index.css` `@theme` is the only token source; DESIGN.md describes it.
- Budget work lives on `redesign`, beside the pre-redesign app on `main`; PR #209 was closed
  unmerged and is reconciled later.
- Goal in-progress bars use one brand colour, reached goals green; `goal.color` only tints the dot.
- Long-range forecast amounts use `formatWholeCurrency`; forecasts are dotted with a ring at today.

## Traps

- The Forecast no-income callout hides a server warning by its leading text (`longTermInputs.ts`):
  change both together.
- The date option's stored value changed: `PREFERENCES_VERSION` is 4 with a migration step.
- Bulk UI text rewrites hit strings the code compares (stored category names); search `server/src`
  and tests for the old text.
- `E2E_SKIP_BUILD=1` reuses the last client build; run once without it after changing UI text.
- Global CSS in `index.css` must sit in an `@layer`, or it beats every Tailwind utility.

## Verify

- `npm test --prefix client`; `npm run build --prefix client`.
- `cd e2e && npm test -- --project=desktop tests/<screen>.spec.ts`, plus the phone spec in `MAP.md`.
- Layout at 390px with no sideways scroll; light and dark; evidence in `.ui-evidence/<date>-<screen>/`.
