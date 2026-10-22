# Phase 10: a warmer FlyBudget

Added 22 October 2026. Status: implemented; local verification completed below.
Release delivery is tracked separately in the feature PR.

## Intent and evidence

Give the existing application a softer, warmer feeling inspired by Monarch's
public homepage. REA captured its rendered desktop homepage and public CSS on
22 October: warm white `#FBFAF8`, stone `#EFECEA`, charcoal `#22201D`, orange
`#FF692D`, ABC Oracle primary typography and Copernicus secondary typography.
These observations describe the marketing site, not signed-in app behavior.
Use an original FlyBudget palette and system serif headings; do not copy licensed
fonts, imagery, logos or page layouts.

This follows phases 8 and 9. Preserve their dashboard personalization, transaction
filters, review, tags and saved views. No financial calculation, storage format,
bank integration or authorization changes belong in this phase.

## Implementation plan

1. **Foundation:** warm ivory/stone light surfaces, charcoal text, terracotta
   brand accents and a warm charcoal dark theme. Keep readable semantic colours,
   define contrasting brand foregrounds, quiet scrollbars and visible focus rings.
2. **Shared elements:** soften cards, buttons and fields. Use system serif only
   for page headings; keep Inter and tabular numerals for amounts. Preserve phone
   touch targets, dialog behavior and reduced-motion support.
3. **Navigation:** use a light stone sidebar in light mode and warm dark surfaces
   in dark mode, rounded active states, roomier links and readable account totals.
   Keep persistent/auto-hide modes and the phone drawer.
4. **Dashboard and charts:** add a calm page heading, more space between cards,
   a clearly framed net-worth summary, aligned statistic cards and a muted chart
   palette. Preserve card IDs, saved visibility/order and chart/data semantics.
5. **Verify and deliver:** format changed files, run client unit tests/build and
   relevant existing desktop/phone browser flows. Visually inspect populated
   desktop/phone screens, dark mode and representative forms using disposable mock
   data. Check text/action contrast and overflow. Prepare the next release,
   review the diff and open a PR to `tvrooi/FlyBudget`; merge only green CI.

## Acceptance

- Light and dark themes feel related, with readable text, selected states,
  fields, badges, focus indicators and charts.
- Dashboard customization and financial values behave as before.
- Desktop navigation and phone drawer work with keyboard and touch; account
  names/totals remain readable. No horizontal page overflow on a 390px phone.
- Dashboard, Budget, Transactions and Settings remain usable with the new shared
  styles. Monetary text keeps sans-serif tabular numerals.
- No new runtime font/network dependency, schema change or production-data use.
- Release/catalog steps follow MAINTENANCE.md. Live installation requires verified
  administrative access, the installed app identity and a restorable cold backup
  including the encryption key.

## Verification results

- Client: all 224 unit tests pass; production TypeScript/Vite build passes.
- Desktop: dashboard customization, navigation, settings, report and Cash Flow suites pass,
  including the new keyboard-focus regression for auto-hidden navigation. Navigation
  and accounts share a scroll area so short drawers retain their account links.
  Cash Flow validates ordinary/uncategorized node fills in both themes; colour
  blending uses CSS so theme variables remain live.
- Phone: all 17 layout, drawer, transaction, budget, dialog and touch-target checks
  pass. The all-pages overflow check covers a 390px screen.
- Demo: all 11 existing browser flows pass, including preferences and bank/data
  isolation checks.
- Temporary mock-data visual QA covers populated light/dark dashboards,
  transactions, Budget and the phone drawer. Twelve foreground/background token
  pairs in each theme meet at least 4.5:1 normal-text contrast; the lowest measured
  pair is light muted text on stone at 4.70:1. These checks do not constitute a
  complete application accessibility audit.
- Financial calculations, stored category colours, dashboard IDs/preferences,
  bank behavior and backup formats are unchanged. No production data was used.
