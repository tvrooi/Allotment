# Requirements: Allotment

**Defined:** 2026-11-14
**Core Value:** Every figure the owner sees is right to the cent: bank money lands once, reconciles exactly, and each dollar sits in exactly one envelope. No screen, sync or assistant may silently lose, double or rewrite it.

## v1 Requirements (milestone v1.0 Redesign finish)

Source: REQ-ui-waves-redesign (docs/ui/WAVES.md), issues #244, #241, #267. Waves A to E of that
requirement are already built (see Validated). Every requirement here is client-only: no server
route, allowlist, `/api/assistant/do` or MCP change.

### Wave F: Settings split (#244)

- [ ] **WAVF-01**: From the Accounts page, the user can open Connected banks (Up and the other bank connections) and reach the Up connection in fewer clicks than today's three (Settings, then Connected banks, then Up).
- [ ] **WAVF-02**: The user manages categories from the Budget area instead of a Settings tab.
- [ ] **WAVF-03**: Settings shows only the tabs that remain, and every existing way into a moved section still lands on it: `/settings?tab=connections` and `/settings?tab=categories` links, sidebar, palette and Welcome entries, and guide steps (guide and tip ids unchanged).

### Wave F: good moments (#241)

- [ ] **WAVF-04**: When a goal reaches its target (for example the demo's "New laptop"), the user sees a small brand-voice acknowledgement (for example a sprout tick, docs/BRAND.md) instead of only a plain green bar.
- [ ] **WAVF-05**: When Ready to assign reaches exactly $0, the user sees a brief brand-voice acknowledgement. It never reads as an unqualified "Fully budgeted" while uncategorised spending, overspending or a missing exchange rate remains (phase 6A rule), and zero still shows in normal colour (GLOSSARY.md).

### Wave G: the shared control set (#267 G0, G1)

- [ ] **WAVG-01**: The owner can read an audit of every field and selector in `client/src`. It lists, by file and line, what each one chooses, which element or component it uses, its states (disabled, invalid, read-only, Safe mode, paused saving), its accessible name and its e2e selectors. It also lists the one-off styles found, with screenshots of each control type at 1280 and 390 px in light and dark.
- [ ] **WAVG-02**: `client/src/components/ui/` holds one shared Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, DatePicker, Label and Field (label, help text, error text, required mark).
  - They are styled only from `@theme` tokens, with one height scale, radius, border, focus ring, placeholder colour, disabled look and invalid look, in light and dark.
  - `CategoryPicker` and `PayeeCombobox` become thin wrappers over the shared Combobox, with unchanged behaviour.
  - A disabled Switch looks disabled (#264).
  - Placeholder text meets at least 4.5:1 contrast (the open item from the 9 Nov Budget critique).
- [ ] **WAVG-03**: Every shared control follows its WAI-ARIA keyboard and screen-reader pattern with a visible focus ring, has 44 px touch targets on phones, and on phones opens the picker the owner chose (Wave G decision 2).
- [ ] **WAVG-04**: A development-only gallery page shows every shared control in every state, and a Playwright screenshot test over it runs in CI.

### Wave G: screens move onto the set (#267 G2, G3)

- [ ] **WAVG-05**: On desktop, Transactions, Accounts, Budget, Payees, Rules and Recurring use only the shared controls, with no behaviour change and every changed e2e selector explained in the PR (G2).
- [ ] **WAVG-06**: On desktop, Goals, Forecast, Investments, Reports, Files and the import and export dialogs use only the shared controls, with no behaviour change and every changed e2e selector explained in the PR (G3).

### Wave G: remaining screens and the guard (#267 G4, G5)

- [ ] **WAVG-07**: Settings (after the WAVF split), the bank connection sections, and the shelved and split-candidate pages use the shared controls. The pages are Review, Cash flow, Household (`Household.tsx`), `Tax.tsx` and `CashFlow.tsx`, scoped by Wave G decision 4. The shelved screens get a mechanical swap only, with no redesign (G4).
- [ ] **WAVG-08**: No screen takes a money amount through `type="number"`. Each of the 10 current uses becomes `CurrencyInput` (`type="text" inputMode="decimal"`) for money, or a shared field within the matching Zod cap otherwise.
- [ ] **WAVG-09**: A lint rule in `lint/` fails on a raw `<select>`, `<textarea>` or `<input>` outside `components/ui/` (file inputs, and controls the WAVG-01 audit shows must stay native, are allowlisted). The rule has its own tests with an allowed case and a refusal, and the warning cap goes down to match, never up (G5).
- [ ] **WAVG-10**: The old native `Select` in `ui/Input.tsx` and every component the set replaced are removed. DESIGN.md, docs/ui/MAP.md and docs/ui/HANDOVER-UI.md record the control set, the lint rule and the picker rule as the owner decided (G5).

### Done means, for every wave PR

From the REQ-ui-waves-redesign acceptance:
- A failing test for each fix.
- The full desktop project plus the phone, demo and server-mode e2e suites, and `npx tsc --noEmit` in `e2e/`.
- Screenshots under `.ui-evidence/<date>-<wave>/`.
- The next `0.2.0-up.N` via `npm run release:prepare`, with a CHANGELOG entry.
- docs/ui/HANDOVER-UI.md and docs/ui/MAP.md updated.
- A PR to `redesign` with `--repo tvrooi/Allotment`, merged when CI is green and Codex has no unresolved finding.
- Issues closed by hand.
- Node 24, never `E2E_SKIP_BUILD=1`, and the lint warning cap (135) does not rise.

## Validated (already built; not planned as phases)

All 38 requirement entries from the 10 ingested PRDs (`.planning/intel/requirements.md`). Built SPECs
win over older PRD wording (ingest precedence SPEC > PRD).

| Intel ID | What | Source | Built | Status |
|----------|------|--------|-------|--------|
| REQ-multi-user-isolation | Separate budgets per person behind a gateway | MULTI-USER-PLAN.md | up.48 (steps 1-3, 5) | Validated |
| REQ-multi-user-password-reset | Reset codes by HA notify, email, admin code | MULTI-USER-PLAN.md | up.48; email up.128 | Validated |
| REQ-plan-cancelled-recurring-hidden | Cancelled recurring items leave Monthly, calendar, household bills | PLAN-2026-11 s1 | up.131 | Validated |
| REQ-plan-recurring-amount-reaches-household-bill | Schedule amount edits reach unpaid household bills | PLAN-2026-11 s2 | `followScheduleAmount` (HOUSEHOLDS.md) | Validated |
| REQ-plan-household-edit-and-default | Edit household, default household | PLAN-2026-11 s3 | `is_default` column, `PUT /api/households/:id` | Validated (built differently from the plan; see W-3) |
| REQ-plan-household-reconcile | Agree household balances with adjustment entries | PLAN-2026-11 s4 | `reconcileBalances`, MCP proposal | Validated (built differently from the plan; see W-3) |
| REQ-plan-up-round-ups | Round-ups linked and shown on purchases | PLAN-2026-11 s5 | up.131, up.145 | Validated |
| REQ-plan-essentials-pool | Accounts with their own Ready to Assign | PLAN-2026-11 s6 | ENVELOPE-FUNDING.md | Validated |
| REQ-plan-tab-icon-and-brand-sweep | Allotment tab icon; user-visible name sweep | PLAN-2026-11 s7 | up.131 | Validated |
| REQ-phase7-priorities-profile | 7A financial priorities | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase7-flexibility-reserve | 7B resilience card | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase7-adverse-event-scenarios | 7C life events in forecasts | PSYCHOLOGY-OF-MONEY | up.18 | Validated ("nothing is stored" is stale; see W-4) |
| REQ-phase7-goal-lifecycle | 7D pause, complete, retire, replace | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase7-resume-after-lapse | 7E Resume budgeting, reminders | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase7-extra-income | 7F extra income split | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase7-shared-contract | Phase 7 shared accounting contract | PSYCHOLOGY-OF-MONEY | up.18 | Validated |
| REQ-phase9-review-and-report-visibility | Reviewed marks, hide from reports | PHASE-9 | up.20 | Validated |
| REQ-phase9-tags-saved-views | Tags, saved views | PHASE-9 | up.20 | Validated |
| REQ-phase10-warm-design | Warm visual design | PHASE-10-WARM-DESIGN | implemented | Validated (palette superseded by BRAND.md) |
| REQ-phase8-transaction-selection | One selection module for register, summary, export | MONARCH-DEVELOPMENT-PHASE | up.19 | Validated |
| REQ-phase8-summary-and-savings-rate | Register summary, shared savings rate | MONARCH-DEVELOPMENT-PHASE | phase 8 | Validated |
| REQ-phase8-dashboard-preferences | Per-device dashboard cards | MONARCH-DEVELOPMENT-PHASE | phase 8 | Validated |
| REQ-phase8-merchant-breakdown-annual-overview | Payee breakdown, annual overview | MONARCH-DEVELOPMENT-PHASE | phase 8 | Validated (user word is Payee) |
| REQ-phase8-goal-debt-presentation | Goal and card-debt presentation | MONARCH-DEVELOPMENT-PHASE | phase 8 | Validated |
| REQ-phase6a-authoritative-funding | One shared funding calculation | YNAB-DEVELOPMENT-PHASE | up.9 | Validated |
| REQ-phase6b-card-payment-funding | Card payment funding | YNAB-DEVELOPMENT-PHASE | up.10 | Validated |
| REQ-phase6c-category-funded-goals | Category-funded goals | YNAB-DEVELOPMENT-PHASE | up.12 | Validated |
| REQ-phase6d-true-expense-targets | Category targets | YNAB-DEVELOPMENT-PHASE | up.15 | Validated |
| REQ-phase6e-payday-integration | Payday plans on the shared service | YNAB-DEVELOPMENT-PHASE | up.17 | Validated |
| REQ-phase6f-6g-buffer-and-review | Buffer, runway, guided setup, review | YNAB-DEVELOPMENT-PHASE | up.17 | Validated |
| REQ-depreciating-assets-calculation | ATO prime cost and diminishing value, low-value pool | DEPRECIATING-ASSETS-PLAN | up.94 to up.96 (phases 1-3) | Validated (phase 4 extras: DEPR-01, v2) |
| REQ-depreciating-assets-data-and-api | Asset tables, routes, locks, backup | DEPRECIATING-ASSETS-PLAN | up.94 to up.96 | Validated |
| REQ-ui-waves-redesign | Redesign Waves A to G | docs/ui/WAVES.md | A to E: up.167 to up.173 | Partly built: Waves F and G are WAVF-01 to WAVG-10 above |
| REQ-plan-delivery-rules | One PR per section, failing-then-passing test, checks | PLAN-2026-11 | n/a | Process rule, carried into PROJECT.md Constraints |
| REQ-phase6-compatibility-gates | Preserve data, additive schema, live-install checks | YNAB-DEVELOPMENT-PHASE | n/a | Process rule, carried into PROJECT.md Constraints |
| REQ-phase8-proposal-receipts-attachments | Transaction attachments proposal | PHASE-8-PROPOSALS | built as RECEIPTS-AND-TAX.md and FILES.md | Superseded proposal: do not plan |
| REQ-phase8-proposal-security-holdings | Manual holdings proposal | PHASE-8-PROPOSALS | built as INVESTMENTS.md | Superseded proposal: do not plan |
| REQ-phase8-proposal-long-term-forecasting | Yearly steps proposal | PHASE-8-PROPOSALS | built as LONG-TERM-FORECAST.md (separate engine) | Superseded proposal: do not plan |

Also built and documented as SPECs (constraints in `.planning/intel/constraints.md`):
- Assistant endpoints and checks inside the write, budget review, card payments, category goals and targets, pay-later plans, desktop updates, envelope funding, Files, forecasts with saved scenarios, payday plans, resilience, access tokens and MCP, the gateway, email codes and reminders, investments with sales and income, receipts and tax, households, working from home (D4a) and the long-term forecast.
- Not built from those SPECs: D4b car expenses and household partner links. They are listed as v2 below.

## v2 Requirements (later milestones and backlog)

Acknowledged, not in the current roadmap. The owner placed these after milestone v1.0.

### Tax: car expenses (D4b, docs/TAX-CAR-AND-HOME.md)

- **CAR-01**: The owner records cars (at most 20), logbooks of at least 12 continuous weeks valid for 5 years, odometer readings and trip-by-trip entries, and chooses cents per km or logbook per car per year. Uses the next free migration number (after 0088) and the next backup version (after 34).
- **CAR-02**: A D1 claim names its car; a car can link to a depreciating asset (prompt only); Tax time totals, CSV and ZIP include car claims.
- **CAR-03**: Organise tokens can read cars, logbooks, car years and trips (owner decision T2) with no token write. READ-ONLY-ACCESS.md, ASSISTANT-ENDPOINTS.md, RECEIPTS-AND-TAX.md, FILES.md and HANDOVER.md move with it.

### Households: partner links (docs/HOUSEHOLD-PARTNER-LINKS.md)

- **HHL-01**: A partner claims an owner's household entry with one of their own payments (approach B, `household_entry_claims`). Matches are suggested, never guessed. Blocked on owner decisions 4, 5, 7, 8 and 9.

### Tax: depreciating assets phase 4 (docs/DEPRECIATING-ASSETS-PLAN.md)

- **DEPR-01**: Second-element costs, effective life recalculation and a car cost limit warning.

### Funding rules awaiting an owner decision

- **FUND-01**: Payment funding for pay-later plan accounts is the same in docs and code once the owner settles W-1 (creation versus a reviewed step).
- **FUND-02**: An account that is both an own-Ready-to-Assign pool and the account an envelope follows has a defined, tested rule once the owner settles W-2 (forbid, or define the pool figure).

### Documentation fixes (from the ingest)

- **DOCS-01**: W-3 to W-6 doc updates:
  - PLAN-2026-11 sections 3 and 4 are marked superseded by HOUSEHOLDS.md.
  - The Phase 7 brief says saved scenarios shipped, and whether life events are stored.
  - READ-ONLY-ACCESS.md adds `/tax/assets`, `/tax/pool` and `tax_assets`.
  - INVESTMENTS.md says `GET /api/investments` is readable by organise tokens.
- **DOCS-02**: Fix stale numbers:
  - PAYDAY-PLANS.md "format version 5" and DEVELOPMENT.md line 166 "version 3" (the constant is 34).
  - TAX-CAR-AND-HOME.md section 6 "backup 34" for D4b.
  - The WAVES.md and HANDOVER-UI.md version ranges.

### UI backlog (GitHub issues)

- **UIBL-01**: Triage the `needs-triage` issues #249, #250, #251, #252, #254, #260, #263, #268, #269, #270 and #271. #269 (single-row undo overwrites newer changes) and #270 (register totals at the wrong Safe mode level) affect data and privacy.
- **UIBL-02**: The `ready-for-agent` housekeeping issues #211, #212, #213, #214, #216 and #220.
- **UIBL-03**: The owner-held items: #215 (iPhone check) and the shelved #217, #218 and #219.
- **UIBL-04**: The open Budget critique items: one recommended action between Hold money and Put the rest in, and a bolder "plots" variant as a separate route.

### Release and follow-ups

- **REL-01**: One release of `redesign` (up.154 onward) once the owner decides, with the Safe mode chart fix (#246) and the menu fix in the release notes, and `redesign` reconciled with `main` (PR #209 closed unmerged).
- **ASST-01**: The MCP change-set race (ASSISTANT-PHASE-3 decision 5).
- **LTF-01**: The owner confirms or changes the nine long-term forecast assumptions in section 17.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redesigning Review, Cash flow, Household (#217 to #219) | Shelved by the owner; Wave G swaps their controls only |
| Server changes in Waves F and G | Owner rule: no route, allowlist, `/api/assistant/do` or MCP change |
| Tagging, publishing or installing `redesign` builds | The release decision is the owner's and is undecided |
| A different HA app ID, or migrating or replacing a live budget | CLAUDE.md; needs explicit owner go-ahead and a cold backup |
| Tax advice, ATO lodging, tax payable estimates | Record keeping only |
| Market data or broker imports | Manual prices only; no network calls |
| Up webhooks | Sync at startup, on Sync now and by opt-in polling |
| New Plaid, SimpleFIN, Enable Banking features | Frozen as community supported (audit I-10) |
| Money age | Explicitly not implemented (BUDGET-REVIEW.md) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WAVF-01 | Phase 1 | Pending |
| WAVF-02 | Phase 1 | Pending |
| WAVF-03 | Phase 1 | Pending |
| WAVF-04 | Phase 1 | Pending |
| WAVF-05 | Phase 1 | Pending |
| WAVG-01 | Phase 2 | Pending |
| WAVG-02 | Phase 2 | Pending |
| WAVG-03 | Phase 2 | Pending |
| WAVG-04 | Phase 2 | Pending |
| WAVG-05 | Phase 3 | Pending |
| WAVG-06 | Phase 3 | Pending |
| WAVG-07 | Phase 4 | Pending |
| WAVG-08 | Phase 4 | Pending |
| WAVG-09 | Phase 4 | Pending |
| WAVG-10 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0
- Intel PRD entries accounted for: 38 of 38. 32 are validated as built, 1 is partly built (its open part is the 15 above), 2 are process rules and 3 are superseded proposals.

---
*Requirements defined: 2026-11-14*
*Last updated: 2026-11-14 after roadmap creation*
