# Synthesis summary

Entry point for `gsd-roadmapper`. MODE: new. Precedence: ADR > SPEC > PRD > DOC. Generated 2026-11-14 from `docs/superpowers/gsd-records/intel/classifications/` (45 files).

## Doc counts by type

- ADR: 0
- SPEC: 22
- PRD: 10
- DOC: 13
- UNKNOWN: 0
- Total: 45. No classification has `locked: true`, a non-null `precedence`, or low confidence. `cross_refs` is empty in all 45 (cleared by owner decision on 2026-11-14), so there are no cycle blockers.

## Decisions

16 entries in `decisions.md`. There are no ADRs and so no LOCKED ADR decisions; all entries are owner decisions recorded inside SPEC, PRD and DOC sources. Locked (owner took it, built or in force): assistant checks inside the write (ASSISTANT-PHASE-3), assistant policy table (ASSISTANT-ENDPOINTS), email codes and reminders (MULTI-USER-EMAIL-AND-REMINDERS), tax car/home nine decisions (TAX-CAR-AND-HOME), envelope linked/pool features (ENVELOPE-FUNDING), audit I-1 to I-3 and I-4 to I-11 (AUDIT-2026-11), depreciating assets (DEPRECIATING-ASSETS-PLAN), investment sales (INVESTMENT-SALES-AND-INCOME), UI waves (WAVES), guides (GUIDES), Budget critique choices (2026-11-09-budget). Proposed or partly open: household partner claims (HOUSEHOLD-PARTNER-LINKS, decisions 4, 5, 7, 8, 9 open), long-term forecast assumptions (LONG-TERM-FORECAST section 17).

## Requirements

38 entries in `requirements.md`, from the 10 PRDs:

- MULTI-USER-PLAN: REQ-multi-user-isolation, REQ-multi-user-password-reset
- PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS: REQ-plan-cancelled-recurring-hidden, REQ-plan-recurring-amount-reaches-household-bill, REQ-plan-household-edit-and-default, REQ-plan-household-reconcile, REQ-plan-up-round-ups, REQ-plan-essentials-pool, REQ-plan-tab-icon-and-brand-sweep, REQ-plan-delivery-rules
- PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE (phase 7): REQ-phase7-priorities-profile, REQ-phase7-flexibility-reserve, REQ-phase7-adverse-event-scenarios, REQ-phase7-goal-lifecycle, REQ-phase7-resume-after-lapse, REQ-phase7-extra-income, REQ-phase7-shared-contract
- PHASE-8-PROPOSALS: REQ-phase8-proposal-receipts-attachments, REQ-phase8-proposal-security-holdings, REQ-phase8-proposal-long-term-forecasting
- PHASE-9-DEVELOPMENT-PHASE: REQ-phase9-review-and-report-visibility, REQ-phase9-tags-saved-views
- PHASE-10-WARM-DESIGN: REQ-phase10-warm-design
- MONARCH-DEVELOPMENT-PHASE (phase 8): REQ-phase8-transaction-selection, REQ-phase8-summary-and-savings-rate, REQ-phase8-dashboard-preferences, REQ-phase8-merchant-breakdown-annual-overview, REQ-phase8-goal-debt-presentation
- YNAB-DEVELOPMENT-PHASE (phase 6): REQ-phase6a-authoritative-funding, REQ-phase6b-card-payment-funding, REQ-phase6c-category-funded-goals, REQ-phase6d-true-expense-targets, REQ-phase6e-payday-integration, REQ-phase6f-6g-buffer-and-review, REQ-phase6-compatibility-gates
- DEPRECIATING-ASSETS-PLAN: REQ-depreciating-assets-calculation, REQ-depreciating-assets-data-and-api
- WAVES: REQ-ui-waves-redesign

Most PRDs describe work that is already built; each entry says so in its scope. Open work in the PRDs: UI Waves F and G (WAVES), D4b car expenses (TAX-CAR-AND-HOME, a SPEC), HOUSEHOLD-PARTNER-LINKS (design only), depreciating assets phase 4 extras, and the PLAN-2026-11 sweep items if not yet merged.

No competing acceptance variants were found: no two PRDs define the same requirement scope with different acceptance criteria.

## Constraints

23 entries in `constraints.md`: api-contract 6, schema 10, protocol 5, nfr 2. Sources: ASSISTANT-ENDPOINTS, ASSISTANT-PHASE-3, BUDGET-REVIEW, CARD-PAYMENTS, CATEGORY-GOALS, CATEGORY-TARGETS, PAYMENT-PLANS, DESKTOP-UPDATES, ENVELOPE-FUNDING, FILES, FORECASTS, HOUSEHOLD-PARTNER-LINKS, PAYDAY-PLANS, RESILIENCE, READ-ONLY-ACCESS, MULTI-USER-PLAN (gateway protocol; classified PRD, also recorded as requirements), MULTI-USER-EMAIL-AND-REMINDERS, INVESTMENTS, RECEIPTS-AND-TAX, HOUSEHOLDS, TAX-CAR-AND-HOME, INVESTMENT-SALES-AND-INCOME, LONG-TERM-FORECAST.

## Context topics

13 entries in `context.md` (DOC): Australian budgeting investigation, Budget critique, full audit, brand, glossary, guides, start here, DEVELOPMENT.md, UX-REVIEW, UX-UI-AUDIT, ui README, HANDOVER-UI, MAP. Large documents (AUDIT-2026-11, UX-UI-AUDIT, DEVELOPMENT, the 2026-10-20 investigation, START-HERE, UX-REVIEW, MAP) were read by status blocks, headings, decision tables and selected sections, not line by line; the SPEC and PRD documents were read in full except LONG-TERM-FORECAST (sections 1, 14, 17, 19 and 21 read; others by heading) and INVESTMENT-SALES-AND-INCOME (sections 3, 5.1, 5.3, 5.5, 8, 9, 10 read in full; sections 1, 2 and 4 and the tests/client sections by heading or summary).

## Conflicts

0 blockers, 6 competing-variant style warnings, 9 info (auto-resolved or recorded for transparency). Detail: `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/INGEST-CONFLICTS.md`.

Warnings: (1) PAYMENT-PLANS vs CARD-PAYMENTS payment funding; (2) ENVELOPE-FUNDING pool plus linked-envelope gap; (3) PLAN-2026-11 vs HOUSEHOLDS reconciliation request shape and default household storage; (4) FORECASTS saved scenarios vs Phase 7 brief "deferred"; (5) READ-ONLY-ACCESS lists fewer tax reads than the code and TAX-CAR-AND-HOME approve; (6) INVESTMENTS.md says investments routes are not on the token allowlist.

Verified against code while synthesising: `BACKUP_VERSION` is 34 (`server/src/services/backupService.ts`); migrations 0085 to 0088 exist, with 0085 named `0085_tax_home_hours.sql`; `TAX_READ` in `server/src/auth/accessTokens.ts`; `reconcileBalances` request shape in `server/src/services/householdService.ts`; saved scenarios in `server/src/routes/forecast.ts`.

## Per-type intel files

- `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/intel/decisions.md`
- `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/intel/requirements.md`
- `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/intel/constraints.md`
- `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/intel/context.md`
- Conflicts: `/Users/tristanvanrooyen/Github/Allotment/docs/superpowers/gsd-records/INGEST-CONFLICTS.md`

STATUS: AWAITING USER. No blockers, but six warnings need an owner or doc-maintainer decision before routing.
