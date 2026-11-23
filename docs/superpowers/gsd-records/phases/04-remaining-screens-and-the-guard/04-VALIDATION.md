---
phase: "4"
slug: "remaining-screens-and-the-guard"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-16"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from
> `04-RESEARCH.md` §Validation Architecture; the planner fills the per-task map. Where this file
> and that section differ on a command, the research section is the source.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (client unit), ESLint + `node --test` (`lint/`), Playwright (`e2e/`) |
| **Config file** | `client/vite.config.ts`, `lint/eslint.config.js`, `e2e/playwright.config.ts` |
| **Quick run command** | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit)` |
| **Full suite command** | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && npm run build --prefix client && (cd lint && npm test && npm run lint) && npm run format:check && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode && npm test -- --project=gallery)` |
| **Estimated runtime** | Quick: about 60 seconds. Full: tens of minutes (browser projects run one at a time; e2e ports are fixed) |

Node 24 only. Never set `E2E_SKIP_BUILD=1`. The `gallery` Playwright project is added by Phase 2.

---

## Sampling Rate

- **After every task commit:** Run the quick run command, plus `(cd lint && npm test && npm run lint)` when a `.tsx` file changed, plus the desktop e2e spec(s) of the screen the task touched
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green, and CI green on the PR
- **Max feedback latency:** 120 seconds for the per-task sample (unit and types); the screen's e2e spec follows

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 04-01 | 1 | WAVG-07, WAVG-08 | T-04-01 | G4 starts only on a reconciled tree; CategorySelect importers and the AUD-only household currency recorded | record check | `grep -cE '^G4 reconcile: (match\|revise)$' …/04-01-SUMMARY.md` (=1); the mapped-lines, importer/currency and clean-tree gates | ❌ W0 (the summary is this task's output) | ⬜ pending |
| 4-01-02 | 04-01 | 1 | WAVG-07 | — | Owner's 19 Nov 2026 answers recorded from STATE.md, never assumed, not asked again | checkpoint (answered) + record check | `grep -cE '^(WAVES\.md at Wave G close: delete-in-g5\|WFH rate field: input)$' …/04-01-SUMMARY.md` (=2); `grep -c 'i agree with phase 4 decisions'` (≥1) | ❌ W0 | ⬜ pending |
| 4-02-01 | 04-02 | 2 | WAVG-07 | T-04-03 | Combobox submits the item key, never its label; Select's phone branch submits the same value | unit, failing first | `npm --prefix client test -- src/components/ui/Select.test.ts src/components/ui/Combobox.test.ts`; `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-02-02 | 04-02 | 2 | WAVG-07 | T-04-02 | CurrencyInput's submitted text round-trips through cents() for AUD; no float parse | unit, failing first; gallery | `npm --prefix client test -- src/components/ui/CurrencyInput.test.ts`; `E2E_GALLERY_ONLY=1 npm test -- --project=gallery` | ✅ | ⬜ pending |
| 4-17-01 | 04-17 | 2 | WAVG-07 | T-04-33 | DatePicker submits YYYY-MM-DD on both branches; MonthPicker unchanged | unit, failing first | `npm --prefix client test -- src/components/ui/DatePicker.test.ts src/components/ui/MonthPicker.test.ts`; MonthPicker diff empty; tsc | ✅ | ⬜ pending |
| 4-17-02 | 04-17 | 2 | WAVG-07 | T-04-34 | Checkbox submits 'on' (or its value) only when ticked | unit, failing first | `npm --prefix client test -- src/components/ui/Checkbox.test.ts`; `grep -c defaultChecked` (≥1); tsc | ✅ | ⬜ pending |
| 4-03-01 | 04-03 | 2 | WAVG-07 | T-04-04, T-04-05 | Rate server URL keeps type url | gate + e2e | leftover gate (0); `npm test -- --project=desktop tests/settings.spec.ts tests/currencies.spec.ts` | ✅ | ⬜ pending |
| 4-03-02 | 04-03 | 2 | WAVG-07 | T-04-04 | Export dates submit YYYY-MM-DD | gate + e2e | leftover gate (0); `npm test -- --project=desktop tests/data.spec.ts tests/settings.spec.ts` | ✅ | ⬜ pending |
| 4-04-01 | 04-04 | 3 | WAVG-07 | T-04-06, T-04-07 | Password, autoComplete, spellCheck, autoCapitalize, inputMode kept (D-20) | gate + attribute gate + e2e | leftover gate (0); attribute gate `3 5 2 1 1` (GUARD MUTATION); server-mode auth, multi-user people, desktop settings specs | ✅ | ⬜ pending |
| 4-04-02 | 04-04 | 3 | WAVG-07 | T-04-08, T-04-09 | Priorities money in integer cents via CurrencyInput | gate + e2e, failing first | leftover gate (0); `grep -c '<CurrencyInput'` (=3); `npm test -- --project=desktop tests/resilience.spec.ts tests/settings.spec.ts` | ✅ | ⬜ pending |
| 4-05-01 | 04-05 | 2 | WAVG-07 | T-04-10, T-04-11 | Up token keeps id, type password, autoComplete off, spellCheck false | gate + attribute gate + e2e | leftover gate (0); attribute gate `1 1 1 1` (GUARD MUTATION); `npm test -- --project=desktop tests/up.spec.ts tests/switchers.spec.ts` | ✅ | ⬜ pending |
| 4-05-02 | 04-05 | 2 | WAVG-07 | T-04-10, T-04-12 | Plaid secrets stay type password; link submits account id | gate + e2e | Plaid gate (0); `type="password"` count (=2, GUARD MUTATION); `npm test -- --project=desktop tests/accounts.spec.ts` | ✅ | ⬜ pending |
| 4-18-01 | 04-18 | 2 | WAVG-07 | T-04-36 | SimpleFIN setup tokens keep type text and font-mono | gate + e2e | SimpleFIN gate (0); font-mono count (=2, GUARD MUTATION); `npm test -- --project=desktop tests/accounts.spec.ts` | ✅ | ⬜ pending |
| 4-18-02 | 04-18 | 2 | WAVG-07 | T-04-35, T-04-36 | Enable Banking ID and pasted address keep autoComplete off, spellCheck false, onPaste; .pem stays native | gate + attribute gate + e2e | EB gate (0); attribute gate `2 2 1 4` (GUARD MUTATION); `npm test -- --project=desktop tests/enable-banking.spec.ts tests/accounts.spec.ts` | ✅ | ⬜ pending |
| 4-06-01 | 04-06 | 2 | WAVG-07 | T-04-13, T-04-14 | Sign-in password fields and palette search keep their attributes | gate + attribute gate + e2e | input gate (0); attribute gate `2 5 2 1 1` (GUARD MUTATION); desktop command-palette, accessibility, first-run; server-mode auth | ✅ | ⬜ pending |
| 4-06-02 | 04-06 | 2 | WAVG-07 | T-04-15 | N/A | gate + e2e | gate (0); desktop dashboard, home-cards, first-run; full phone project | ✅ | ⬜ pending |
| 4-07-01 | 04-07 | 2 | WAVG-08 | T-04-16, T-04-17 | No field is type=number; instalment count 1 to 60 | unit (source scan) + e2e, failing first | `npm --prefix client test -- src/utils/noNumberInput.test.ts`; repo type=number count (=0); `npm test -- --project=desktop tests/payment-plans.spec.ts` | ❌ W0 (noNumberInput.test.ts created here) | ⬜ pending |
| 4-07-02 | 04-07 | 2 | WAVG-07, WAVG-10 | T-04-16 | N/A | gate + search + e2e | plans gate (0); `git grep -qw CategorySelect -- client/src e2e` (none-found); client tsc, tests, build; desktop payment-plans | ✅ | ⬜ pending |
| 4-08-01 | 04-08 | 2 | WAVG-07 | T-04-18 | N/A | gate + e2e | gate (0); `npm test -- --project=desktop tests/review.spec.ts tests/review-undo.spec.ts` | ✅ | ⬜ pending |
| 4-08-02 | 04-08 | 2 | WAVG-07 | T-04-19 | Usual amount in integer cents via CurrencyInput | gate + e2e, failing first | gate (0); CashFlow.tsx unchanged; desktop resilience and review; demo resilience and review | ✅ | ⬜ pending |
| 4-09-01 | 04-09 | 2 | WAVG-07 | T-04-20 | N/A | gate + e2e | gate (0); `npm test -- --project=desktop tests/investments.spec.ts tests/receipts-tax.spec.ts tests/transactions.spec.ts` | ✅ | ⬜ pending |
| 4-09-02 | 04-09 | 2 | WAVG-07 | T-04-20 | N/A | gate + preservation gate + e2e | gate (0); `list="asset-lives"` and datalist count (=2, GUARD MUTATION); desktop depreciating-assets | ✅ | ⬜ pending |
| 4-09-03 | 04-09 | 2 | WAVG-07 | T-04-21 | WFH rate per the owner's answer; no precision loss | gate + e2e | gate (0); tsc; `npm test -- --project=desktop tests/tax-car-home.spec.ts` | ✅ | ⬜ pending |
| 4-10-01 | 04-10 | 2 | WAVG-07 | T-04-23 | People lists submit ids | gate + e2e | gate (0); multi-user people.spec.ts; desktop household.spec.ts (full, green) | ✅ | ⬜ pending |
| 4-10-02 | 04-10 | 2 | WAVG-07 | T-04-22 | Exact split shares in integer cents | gate + e2e, failing first | gate (0); SplitEditor parseFloat (=0, GUARD MUTATION); desktop household.spec.ts (full, green) | ✅ | ⬜ pending |
| 4-16-01 | 04-16 | 3 | WAVG-07 | T-04-37 | Category and household choices submit ids | gate + e2e | gate (0); desktop household-categories, household (full), transactions | ✅ | ⬜ pending |
| 4-16-02 | 04-16 | 3 | WAVG-07 | T-04-38 | Reconcile date submits YYYY-MM-DD; HouseholdIcon file input untouched | gate + e2e | gate (0); HouseholdIcon.tsx unchanged; desktop household (full) and household-categories | ✅ | ⬜ pending |
| 4-11-01 | 04-11 | 4 | WAVG-07 | T-04-24 | FormData names and f.get reads unchanged; the 'Household' picker assertions read the shared Combobox's value | types + count gates + e2e | tsc; `grep -c "f.get("` (=30, GUARD MUTATION); `grep -c "option:checked" e2e/tests/household.spec.ts` (=0, GUARD MUTATION); desktop household.spec.ts -g household/person/people | ✅ | ⬜ pending |
| 4-11-02 | 04-11 | 4 | WAVG-07 | T-04-24, T-04-25 | Household amounts round-trip through cents() (AUD only) | count gates + e2e, failing first | f.get (=30); parseFloat (=0); desktop household.spec.ts -g record/event/expense/refund/settle/split/contribution | ✅ | ⬜ pending |
| 4-11-03 | 04-11 | 4 | WAVG-07 | T-04-24, T-04-25 | Bill amounts round-trip; filter dates YYYY-MM-DD | gate + e2e, failing first | page gate (0); f.get (=30); desktop household and household-categories; full phone project | ✅ | ⬜ pending |
| 4-12-01 | 04-12 | 5 | WAVG-07, WAVG-08 | T-04-26 | No raw field outside components/ui/ except D-17 file inputs | whole-tree gate + full suite | whole-G4 gate (0); client tests and build; lint test and lint; e2e tsc; desktop, phone, demo, server-mode, multi-user, gallery | ✅ | ⬜ pending |
| 4-12-02 | 04-12 | 5 | WAVG-07, WAVG-10 | T-04-27 | No active doc names CategorySelect; version files agree | record + search + format | version-ok; docs CategorySelect search (none-found); Prettier check | ✅ | ⬜ pending |
| 4-12-03 | 04-12 | 5 | WAVG-07, WAVG-08 | T-04-26 | No .planning, evidence or secret pushed | PR + CI | `gh pr list … feat/wave-g4-screens` (=1); `gh pr checks` | ✅ | ⬜ pending |
| 4-13-01 | 04-13 | 6 | WAVG-09 | T-04-28 | G5 starts only on the merged G4 tree with no raw field left | record + gate | `G5 reconcile:` line (=1); non-ui raw-field gate (0) | ❌ W0 (the summary is this task's output) | ⬜ pending |
| 4-13-02 | 04-13 | 6 | WAVG-09 | T-04-28, T-04-29 | Lint refuses a raw field outside components/ui/; allowlist cannot go stale | lint rule tests (allowed and refused), failing first; probe | `npm --prefix lint test`; `npm --prefix lint run lint`; one no-restricted-syntax (GUARD MUTATION); probe file fails lint | ❌ W0 (no-raw-form-control.test.js created here) | ⬜ pending |
| 4-13-03 | 04-13 | 6 | WAVG-09 | T-04-31 | Agent rules identical in CLAUDE.md and AGENTS.md | doc gate | rule named in both (count of files missing it = 0); `cmp -s CLAUDE.md AGENTS.md` | ✅ | ⬜ pending |
| 4-14-01 | 04-14 | 7 | WAVG-10 | T-04-30 | N/A | search + types + build + lint | `git grep -qwE 'compactSelectClass\|CategorySelect' -- client/src e2e` (none-found); perl import gate for Select from ui/Input (=0, GUARD MUTATION; not `git grep -E` with `\s`/`\b`, which Apple Git does not support); `'Select'` in controlComponents (=0); lint W0/W1 recorded, halt on a rise; client tsc, tests, build; lint | ✅ | ⬜ pending |
| 4-14-02 | 04-14 | 7 | WAVG-10 | T-04-30 | N/A | search + types + build | same search including active docs (none-found); client tsc and build | ✅ | ⬜ pending |
| 4-15-01 | 04-15 | 8 | WAVG-09, WAVG-10 | — | N/A | doc gates | rule named in the five docs; no old native-Select guidance; `cmp -s CLAUDE.md AGENTS.md` | ✅ | ⬜ pending |
| 4-15-02 | 04-15 | 8 | WAVG-09, WAVG-10 | T-04-SC | Dependency blocks and lockfiles unchanged | record + full suite | version-ok; waves-ok; client tests and build; lint; e2e tsc; desktop, phone, demo, server-mode, multi-user, gallery | ✅ | ⬜ pending |
| 4-15-03 | 04-15 | 8 | WAVG-09, WAVG-10 | T-04-32 | No .planning, evidence or secret pushed; screenshot waiver recorded | PR + CI | `gh pr list … feat/wave-g5-guard` (=1); `gh pr checks`; PR body has an Evidence section; on delete-in-g5 `grep -c 'WAVES\.md' HANDOVER.md` (=0) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs are `4-<plan>-<task>`. Commands run on Node 24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`) as each plan's `<verify>` gives them in full; the table abbreviates. "(0)" and "(=N)" are the expected gate values. Full e2e projects inside a task (4-06-02, 4-11-03, 4-12-01, 4-15-02) exceed the 120-second sample on purpose: REQUIREMENTS.md "Done means, for every wave PR" requires the full suites.

Wave order: 1 (04-01) → 2 (04-02, 04-03, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-17, 04-18) → 3 (04-04, 04-16) → 4 (04-11) → 5 (04-12, G4 PR) → 6 (04-13, after the owner merges G4) → 7 (04-14) → 8 (04-15, G5 PR).

---

## Wave 0 Requirements

- [x] D-16 reconciliation against the WAVG-01 audit, the shipped controls and what Phase 3 moved, at the start of each PR: planned as 4-01-01 (G4) and 4-13-01 (G5)
- [x] The source-scan test for `type="number"` (WAVG-08), written to fail before the last field is fixed: planned as 4-07-01 (`client/src/utils/noNumberInput.test.ts`)
- [x] The lint rule test file in `lint/` with allowed cases and refusals (WAVG-09): planned as 4-13-02 (`lint/rules/no-raw-form-control.test.js`)

These are planned, not yet run; `wave_0_complete` turns true when 4-01-01, 4-07-01 and 4-13-02 have run.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password managers still fill sign-in and bank credential fields | WAVG-07, D-20 | Browser password managers are not automated in the repo | Sign in with a saved password in Safari and Chrome; open one bank connect form and paste a token |
| Shelved pages look the same apart from the field look | WAVG-07, D-09 | No per-screen screenshot baseline exists | Owner or reviewer opens Review, Cash flow, Household and Tax at 1280 and 390 px in both themes |
| Native pickers open on a real phone on the moved screens | D-04 | Playwright emulates the phone | On an iPhone, open one Select and one date field in Settings and Household |
| VoiceOver reads the moved fields (02-UAT test 1, still the owner's) | WAVG-07 | Screen reader output is not automated | With VoiceOver on, tab through one Settings form and the Household record dialog; each field announces its label and value |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (4-01-02 is a checkpoint with an automated record check)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (noNumberInput.test.ts in 4-07-01, no-raw-form-control.test.js in 4-13-02, the two reconcile summaries in 4-01-01 and 4-13-01)
- [x] No watch-mode flags
- [ ] Feedback latency < 120s: holds for the unit, type and gate samples; the four tasks that run a full e2e project exceed it by requirement (see the note under the map)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 19 Nov 2026; execution status per row stays pending
