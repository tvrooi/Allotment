## Conflict Detection Report

Mode: new. Docs ingested: 45 (13 DOC, 22 SPEC, 10 PRD). Cross-references were cleared by owner decision on 2026-11-14 (see-also links, not dependencies), so cycle detection found no cycles. No classification is UNKNOWN or low confidence. No classification has `locked: true`, so no LOCKED-vs-LOCKED or LOCKED-vs-existing check applies. None of these entries was resolved by the synthesizer; each needs an owner or doc-maintainer decision.

### BLOCKERS (0)

None.

### WARNINGS (6)

[WARNING] Payment funding: PAYMENT-PLANS funds a plan account at creation, CARD-PAYMENTS requires a reviewed setup step
  Found: docs/PAYMENT-PLANS.md (SPEC) says "A plan account gets payment funding when it is created (an empty account needs no review)" and the code does it (`setupEmptyCardFunding` is called from `server/src/services/paymentPlanService.ts`). docs/CARD-PAYMENTS.md (SPEC) says payment funding is "an explicit, reviewed change for each personal on-budget credit card or line of credit" and "Nothing is changed until Enable payment funding is applied", with no exception for plan accounts.
  Impact: CARD-PAYMENTS states an unconditional rule that PAYMENT-PLANS (and the code) break for new empty provider accounts. A roadmapper reading only CARD-PAYMENTS would require a review step for Afterpay-style accounts.
  → Add the exception to CARD-PAYMENTS.md (new empty plan accounts are set up at nothing owed, no review needed) or state in PAYMENT-PLANS.md that creation counts as the reviewed setup. Both are SPECs at the same precedence, so neither wins automatically.

[WARNING] Envelope funding has no rule for an account that is both an own-Ready-to-Assign pool and a linked envelope
  Found: docs/ENVELOPE-FUNDING.md defines linked envelopes ("Envelopes linked to an account": `categories.linked_account_id`, mirrors the account balance, `refuseLinked` refuses assignments and Move money) and own Ready-to-Assign pools ("Accounts with their own Ready to Assign": `accounts.assign_pool`, earmarked categories via `categories.pool_account_id`). Neither section says what happens when one account is both a pool and the followed account of an envelope. The server only refuses the category-level combination ("A category that follows an account can't also be funded from a pool", `server/src/routes/categories.ts`); I could not confirm an account-level rule.
  Impact: The pool's `resources` (account balance) and the linked envelope's mirrored Available would count the same balance twice or contradict "main plus pools is always the single figure the budget had before". This is a money-correctness gap, not just a wording gap.
  → Owner decision needed: forbid an account being both (and say so in ENVELOPE-FUNDING.md with a test), or define how the pool's figure treats the mirrored envelope. Check the account-level behaviour in `services/assignPools.ts` before deciding.

[WARNING] Household reconciliation: PLAN-2026-11 and HOUSEHOLDS describe different request shapes and storage
  Found: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md section 4 specifies `POST /api/households/:id/reconcile` with `{ asOf, agreed: { [personId]: cents } }` and one new event kind `adjustment`; section 3 specifies the default household as a preference `defaultHouseholdId` with a `PREFERENCES_VERSION` bump. docs/HOUSEHOLDS.md (and the code in `server/src/services/householdService.ts`, `reconcileBalances`) uses `{ date?, agreed?: [{ personId, amount }] }`, two event kinds `pool_adjustment` and `balance_adjustment`, and an `is_default` column on the household group (`defaultHouseholdId` does not exist in `client/src` or `server/src`).
  Impact: The plan is an implementer work order for already-built features; an agent following it would build the wrong request shape and a duplicate default mechanism. Both docs are active.
  → Treat HOUSEHOLDS.md as authoritative (it matches the code) and mark PLAN-2026-11 sections 3 and 4 as superseded or update them. SPEC (HOUSEHOLDS) outranks PRD (PLAN) by default precedence, so this is recorded here for visibility; the winner was not applied silently to the plan's text.

[WARNING] Saved forecast scenarios: FORECASTS says built, the Phase 7 brief says deferred
  Found: docs/FORECASTS.md has a "Saved scenarios" section (name, Save, at most 20, versioned, `GET|POST /api/forecast/scenarios`, `PUT /:id` with `expectedVersion`, `DELETE`, backup format 13) and `server/src/routes/forecast.ts` serves them. docs/PSYCHOLOGY-OF-MONEY-DEVELOPMENT-PHASE.md amendment 6 says "Phase 5 stores nothing... Saving scenarios is deferred: it would make the forecast page stateful and needs its own decision", and 7C says "nothing is stored".
  Impact: The brief's statement is no longer true, so its 7C acceptance ("nothing is stored") is ambiguous for life-event fields: RESILIENCE.md says life events are not saved, FORECASTS says horizon, history and income settings are not saved but scenario assumptions are. A requirement derived from the brief could forbid persistence the product already has.
  → Update the Phase 7 brief to say saved scenarios shipped after 7C, and state explicitly whether `incomePauses` and `costChanges` are stored with a saved scenario. SPEC (FORECASTS, matches code) outranks PRD (brief).

[WARNING] READ-ONLY-ACCESS lists fewer tax reads than TAX-CAR-AND-HOME approves and the code allows
  Found: docs/READ-ONLY-ACCESS.md names for organise tokens: `GET /api/tax/labels`, `/years`, `/years/:fy`, `/claims`, `/claims/:id`, `/years/:fy/candidates`, `/api/tax/home/:fy`, and `GET /api/investments`. `server/src/auth/accessTokens.ts` `TAX_READ` also allows `/tax/assets[/:id]` and `/tax/pool` (DEPRECIATING-ASSETS-PLAN decision 2; TAX-CAR-AND-HOME section 2), and its MCP tool list omits `tax_assets`. docs/TAX-CAR-AND-HOME.md decision 6 (T2) also approves organise-token reads of cars, logbooks, car years and trips (`/tax/cars`, `/tax/cars/:id`, `.../logbooks`, `.../trips`); those routes are not built (D4b), so the omission is correct today but the approval is not recorded in READ-ONLY-ACCESS.
  Impact: READ-ONLY-ACCESS is the token allowlist reference; it under-describes what a token can read now (assets, pool, `tax_assets`) and does not record the approved D4b reads that must be added with D4b. TAX-CAR-AND-HOME section 6 requires READ-ONLY-ACCESS.md to be updated with each phase.
  → Add assets, pool and `tax_assets` to READ-ONLY-ACCESS.md now, and add the car read paths when D4b ships. No security widening is implied: all are GET-only and already approved by the owner.

[WARNING] INVESTMENTS.md says investments routes are not on the read-only token allowlist
  Found: docs/INVESTMENTS.md: "The routes are under `/api/investments` and need a signed-in session. They are not on the read-only token allowlist." docs/INVESTMENT-SALES-AND-INCOME.md (decision 7, built in 0.2.0-up.142) and docs/READ-ONLY-ACCESS.md allow `GET /api/investments` for organise tokens, and `TAX_READ` in `server/src/auth/accessTokens.ts` includes `/^\/investments$/`.
  Impact: An unconditional claim that the later work made false; a reviewer or roadmapper could treat investments reads by tokens as a violation. Writes remain owner-only in every doc, so there is no security conflict.
  → Update INVESTMENTS.md to say only `GET /api/investments` is readable by organise tokens (INVESTMENT-SALES-AND-INCOME decision 7) and every other investments route is owner-only.

### INFO (9)

[INFO] Backup format version cited in docs versus the current constant
  Note: `BACKUP_VERSION` is 34 in `server/src/services/backupService.ts` (line 123). docs/PAYDAY-PLANS.md says funding history survives "JSON backup/restore (format version 5)". Neighbouring docs cite the version a feature was introduced in: HOUSEHOLDS.md 6, 20, 27, 34; ENVELOPE-FUNDING.md 7 and 29; CARD-PAYMENTS.md 8; CATEGORY-GOALS.md 9; CATEGORY-TARGETS.md 10; RESILIENCE.md 11; PHASE-9 12; FORECASTS.md 13; INVESTMENTS.md 14; LONG-TERM-FORECAST.md 16; PAYMENT-PLANS.md 21; FILES.md 23; INVESTMENT-SALES-AND-INCOME.md 30 to 32; TAX-CAR-AND-HOME.md 32 and 33. These are introduction versions, not conflicts. PAYDAY-PLANS is the only one worded as a current-state claim, and docs/DEVELOPMENT.md line 166 ("`GET /api/export/backup` (version 3)") is stale in the same way. Only the constant (34) is authoritative.

[INFO] TAX-CAR-AND-HOME migration name and D4b backup number
  Note: docs/TAX-CAR-AND-HOME.md section 5.1 names `0085_tax_car_and_home.sql`; section 10 ("As built") states the shipped file is `0085_tax_home_hours.sql` (the repo has `server/src/db/migrations/0085_tax_home_hours.sql`) and that D4b takes the next number. FILES.md and RECEIPTS-AND-TAX.md refer to it only as migration 0085 / `tax_home_hours`, which is consistent. Section 6 still says D4b is "backup 34", but section 5.1 says 34 went to household bill dismissals in up.149 (migration 0086), so D4b needs the next free number (35 or later; 0087 and 0088 also exist). Treated as resolved inside the doc; the built file name wins.

[INFO] Phase 8 proposals versus what was built
  Note: docs/PHASE-8-PROPOSALS.md still says "proposals only". Receipts were built as RECEIPTS-AND-TAX.md and FILES.md with bytes stored in the database (the proposal said on disk, with only large videos on disk now); security holdings became INVESTMENTS.md (securities, prices, lots) rather than a single `holdings` table with string quantity; long-term forecasting was built as a separate yearly engine with its own plan tables (LONG-TERM-FORECAST.md), whereas the proposal said "No new engine". PHASE-9 moved tags from per-leaf to the register row and says so. Built SPECs win; proposals are kept as history.

[INFO] Depreciating assets plan versus car logbook design
  Note: docs/DEPRECIATING-ASSETS-PLAN.md decision 5 confirms "car logbooks" out of scope; docs/TAX-CAR-AND-HOME.md (8 Nov 2026, later) designs logbooks, cents per km and car links to depreciating assets (A1). The later owner-approved design supersedes the earlier out-of-scope line. No action beyond noting it when D4b is planned.

[INFO] MULTI-USER-PLAN original design versus as built
  Note: docs/MULTI-USER-PLAN.md "Upgrading an existing install" (move the budget into `/data/budgets/<id>/`) and delivery step 4 describe the original plan; the "As built" block says the existing budget stays in place and step 4 was replaced. Per CLAUDE.md, moving a live budget needs explicit owner go-ahead and a verified cold backup; the as-built approach avoids it.

[INFO] UX-REVIEW and PHASE-10 superseded by later owner decisions
  Note: docs/UX-REVIEW.md item 1 sent demo links to GitHub and left `website/` alone; audit decision I-9 (docs/AUDIT-2026-11.md, 4 Nov 2026) removed `website/`. Item 7 (keep the sidebar) is superseded by I-4 (grouped sidebar). docs/PHASE-10-WARM-DESIGN.md says "original FlyBudget palette"; BRAND.md now defines the Allotment palette, and docs/ui/README.md lists PHASE-10, UX-REVIEW and UX-UI-AUDIT as historical, not current guidance.

[INFO] PLAN-2026-11 items completed or shaped differently
  Note: docs/PLAN-2026-11-HOUSEHOLDS-POOLS-ROUNDUPS.md section 7 asks for `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`; docs/BRAND.md lists them as existing sources. Section 6's `pools: [{ accountId, readyToAssign }]` is expanded in ENVELOPE-FUNDING.md to `resources`, `envelopes` and `readyToAssign` per pool. Sections 1, 2, 5 and 6 are marked built by ENVELOPE-FUNDING, HOUSEHOLDS and the up.131/up.145 round-up note. Built docs win.

[INFO] Small number drift between UI handover docs
  Note: docs/ui/HANDOVER-UI.md says `redesign` has up.154 to up.172 prepared and untagged; docs/ui/WAVES.md says up.154 to up.171 (its own table also lists Wave D as up.172). The same branch state is described two ways; WAVES.md was written after Wave E (13 Nov 2026) and HANDOVER-UI says it was overwritten at the same time, so treat the range as up.154 to up.173 once Wave E (up.173) is counted, and re-verify against `git log`.

[INFO] Two file-size limits apply by upload path; vocabulary
  Note: docs/RECEIPTS-AND-TAX.md says 10 MB per receipt and 20,000 receipts (`MAX_RECEIPT_BYTES`, `MAX_RECEIPTS` in `receiptService.ts`); docs/FILES.md says 25 MB per file and 50,000 documents (`MAX_FILE_BYTES`, `MAX_DOCUMENTS`). Both constants exist in code for different entry points, so this is not a contradiction. Separately, docs/GLOSSARY.md retires "Merchant" in favour of "Payee" (except for a receipt's or payment plan's merchant), while PHASE-8 and MONARCH-DEVELOPMENT-PHASE use "merchant breakdown" for payee grouping; the PRD defines merchant as the payee, so the user-facing word is Payee.
