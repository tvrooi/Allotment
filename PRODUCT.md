# Allotment

<!-- impeccable:product-schema 1 -->

## Platform

web

The React interface also runs in an Electron desktop wrapper. Mobile use is through a browser; the wrapper does not establish a separate native design language.

## Users

Australians with an Up account who want an envelope budget they control. People may run it on their own computer or use Home Assistant to reach their budget from other devices. Household budgeting is a supported workflow.

## Product Purpose

Give every dollar a purpose, help people review imported transactions, and make upcoming personal and household bills easier to cover. Success means understanding what money is available and taking a clear next budgeting step.

## Positioning

A private, open-source envelope budget with direct Up Bank imports and local ownership of the budget. No Allotment account or tracking is required. Allotment is an independent AGPL-3.0-only fork of FlyBudget, not an official Up or Home Assistant product.

## Operating Context

People assign money to categories, review and categorise transactions, plan around payday, reserve for recurring bills, and manage household contributions. Desktop installations can work on their own; Home Assistant provides browser access across devices. Imports from YNAB and CSV support existing budgeting history.

## Capabilities and Constraints

- Zero-based envelope budgeting, payday plans, bill coverage, forecasts and goals.
- Up imports settled AUD transactions, including Savers and 2Up accounts. Other existing integrations do not change the primary audience.
- The app also supports reports, files, investments and Australian tax workflows; their detailed contracts remain in the relevant project documentation.
- Budget data and encrypted bank tokens stay on the person's computer or server. Tokens are excluded from exports.
- Preserve reconciled and user-edited ledger rows, stable import identities, explicit review of transfer suggestions, and the existing owner-versus-assistant permission boundaries. See AGENTS.md for implementation invariants and documented exceptions.
- Demo and offline modes must keep working. Use mock data for demonstrations and tests; never put private budget data or credentials in project context.
- Stored identifiers retain `flybudget` for compatibility; user-visible naming is Allotment.

## Brand Commitments

The name is Allotment. The tagline is “Every dollar gets its plot.” Use clear words, warm encouragement and one next step. Use sentence case and the app's established terminology. The existing mark and brand commitments are maintained in docs/BRAND.md; this record does not replace them.

## Evidence on Hand

- README.md: audience, purpose, installation paths and privacy commitments.
- docs/BRAND.md: name, voice and existing identity assets.
- docs/GLOSSARY.md and client/src/userGuide/: established concepts and user guidance.
- client/src/ and server/src/: the existing implementation, including demo support.
- HANDOVER.md: current implementation state and known open work.

Do not invent testimonials, customer counts, financial outcomes or independent endorsements.

## Product Principles

1. Keep people in control of their budget and data.
2. Make available money and upcoming commitments understandable.
3. Preserve financial history and make consequential choices explicit.
4. Give clear, encouraging guidance without concealing uncertainty.
5. Extend existing workflows consistently across desktop, mobile web, demo and offline use.

## Accessibility & Inclusion

Interactive controls need accessible names. Layouts must work at 390 px without sideways scrolling. Respect the person's date and currency preferences through the existing formatters.

## Open Decisions

No additional audience expansion or accessibility certification target was established during initialization.
