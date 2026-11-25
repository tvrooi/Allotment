---
phase: "3"
slug: "screens-on-shared-controls"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-16"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from
> `03-RESEARCH.md` §Validation Architecture; the planner fills the per-task map. Where this file
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Task | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|------|-----------|-------------------|-------------|--------|
| 3-01-01 | 03-01 | 1 | WAVG-05, WAVG-06 | T-03-01 | Reconcile the G2 plans with the audit and the shipped controls (D-16) | record/gate | `grep -cE '^Reconcile: (match\|revise)$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md` | n/a | ⬜ pending |
| 3-01-02 | 03-01 | 1 | WAVG-05, WAVG-06 | T-03-01 | Owner answers the two Phase 2 questions and the WAVG-06 export scope | owner checkpoint + record gate | `S=docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md; grep -cE '^(MonthRangePicker phone: (stack\|accept)\|Welcome switch rows: (accept\|restore-in-phase-4)\|…` (+2 more in plan) | n/a | ⬜ pending |
| 3-02-01 | 03-02 | 2 | WAVG-05 | T-03-02, T-03-03 | numberText parsers and range messages, test first | unit/types (failing first) | `npm --prefix client test -- src/components/ui/numberText.test.ts src/components/ui/fieldMessages.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 3-02-02 | 03-02 | 2 | WAVG-05 | T-03-02, T-03-03 | NumberField, the shared bounded number field | unit/types (failing first) | `npm --prefix client test -- src/components/ui/NumberField.test.ts` (+1 more in plan) | ❌ W0 (created in task) | ⬜ pending |
| 3-02-03 | 03-02 | 2 | WAVG-05 | T-03-02, T-03-03 | CurrencyInput options for the money fields the owner moved to it | unit/types (failing first) | `npm --prefix client test -- src/components/ui/CurrencyInput.test.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-03-01 | 03-03 | 3 | WAVG-05 | T-03-04 | Gallery specimens for NumberField and CurrencyInput; IN-04 and R2-IN-02 | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/text-fields.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-03-02 | 03-03 | 3 | WAVG-05 | T-03-04 | Picker classes into fieldClasses.ts (IN-01) and the vacuous Select assertion (R2-IN-03) | unit/types | `npm --prefix client test -- src/components/ui/Select.test.ts src/components/ui/DatePicker.test.ts src/components/ui/MonthRangePicker.test.ts src/components/ui/Combobox…` (+2 more in plan) | ✅ | ⬜ pending |
| 3-03-03 | 03-03 | 3 | WAVG-05 | T-03-04 | Apply the owner's MonthRangePicker phone answer | unit/types | `npm --prefix client test -- src/components/ui/MonthRangePicker.test.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-04-01 | 03-04 | 2 | WAVG-05 | T-03-05, T-03-06 | MerchantSelect on the shared Combobox | unit/types (failing first) | `npm --prefix client test -- src/components/transactions/MerchantSelect.test.ts` (+2 more in plan) | ❌ W0 (created in task) | ⬜ pending |
| 3-04-02 | 03-04 | 2 | WAVG-05 | T-03-05, T-03-06 | CategoryPicker pinned item and hint; CategorySelectButton label | unit/types (failing first) | `npm --prefix client test -- src/components/transactions/CategoryPicker.test.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-04-03 | 03-04 | 2 | WAVG-05 | T-03-05, T-03-06 | CurrencySelect on the shared Select; CurrencyDifference on CategoryPicker | e2e | `npm --prefix e2e test -- --project=desktop tests/currencies.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-05-01 | 03-05 | 3 | WAVG-05 | T-03-07 | Account dialogs and the account type field | e2e | `npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-05-02 | 03-05 | 3 | WAVG-05 | T-03-07 | Reconcile page checkboxes | e2e | `npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts tests/financial-integrity.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-06-01 | 03-06 | 2 | WAVG-05 | T-03-08 | Payees page and its merge dialog | e2e | `npm --prefix e2e test -- --project=desktop tests/payees.spec.ts tests/review-payees.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-06-02 | 03-06 | 2 | WAVG-05 | T-03-08 | Rules page search and Apply rules dialog | e2e | `npm --prefix e2e test -- --project=desktop tests/rules.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-07-01 | 03-07 | 3 | WAVG-05 | T-03-09, T-03-10 | Split percent to NumberField, test first (D-14) | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/rules.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-07-02 | 03-07 | 3 | WAVG-05 | T-03-09, T-03-10 | Rule editor lists, date, tag box and OptionPicker | e2e | `npm --prefix e2e test -- --project=desktop tests/rules.spec.ts tests/transaction-presets.spec.ts` (+4 more in plan) | ✅ | ⬜ pending |
| 3-08-01 | 03-08 | 3 | WAVG-05 | T-03-11, T-03-12 | Recurring form, with date flexibility tested first | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/recurring.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-08-02 | 03-08 | 3 | WAVG-05 | T-03-11, T-03-12 | Upcoming length, schedule search, match search and Discover | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/recurring.spec.ts` (+3 more in plan) | ✅ | ⬜ pending |
| 3-09-01 | 03-09 | 3 | WAVG-05 | T-03-13, T-03-14 | Budget table cell, phone sheet and card payments on CurrencyInput | e2e | `npm --prefix e2e test -- --project=desktop tests/budget.spec.ts tests/budget-inspector.spec.ts tests/card-payments.spec.ts tests/assign-block.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-09-02 | 03-09 | 3 | WAVG-05 | T-03-13, T-03-14 | Search, checkboxes, Auto-assign, note and Annual budget | e2e | `npm --prefix e2e test -- --project=desktop tests/budget.spec.ts tests/budget-inspector.spec.ts tests/envelope-funding.spec.ts tests/safe-mode.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-10-01 | 03-10 | 3 | WAVG-05 | T-03-15, T-03-16 | Move money on CategoryPicker and CurrencyInput | e2e | `npm --prefix e2e test -- --project=desktop tests/envelope-funding.spec.ts tests/safe-mode.spec.ts` | ✅ | ⬜ pending |
| 3-10-02 | 03-10 | 3 | WAVG-05 | T-03-15, T-03-16 | Category target editor, with the cycle tested first | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/targets.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-10-03 | 03-10 | 3 | WAVG-05 | T-03-15, T-03-16 | Payday plan editor, with the percent tested first | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/payday.spec.ts tests/envelope-funding.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-11-01 | 03-11 | 3 | WAVG-05 | T-03-17 | Category manager and edit category | e2e | `npm --prefix e2e test -- --project=desktop tests/household-categories.spec.ts tests/settings.spec.ts` | ✅ | ⬜ pending |
| 3-11-02 | 03-11 | 3 | WAVG-05 | T-03-17 | Delete category's Merge into | e2e | `npm --prefix e2e test -- --project=desktop tests/settings.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-12-01 | 03-12 | 4 | WAVG-05 | T-03-18, T-03-19 | Add transaction's account list on the shared Combobox | unit/types | `npm --prefix client test -- src/components/ui/Combobox.test.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-12-02 | 03-12 | 4 | WAVG-05 | T-03-18, T-03-19 | Bulk edit, bulk delete and split transaction | e2e | `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/transaction-clarity.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-12-03 | 03-12 | 4 | WAVG-05 | T-03-18, T-03-19 | Transfer suggestions and the register's select-all | e2e | `npm --prefix e2e test -- --project=desktop tests/up-transfers.spec.ts tests/transactions.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-13-01 | 03-13 | 5 | WAVG-05 | T-03-20 | Inline transaction form row | e2e | `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-13-02 | 03-13 | 5 | WAVG-05 | T-03-20 | Detail panel date, notes, payee height and the second Escape | e2e | `npm --prefix e2e test -- --project=desktop tests/transactions.spec.ts tests/receipts-tax.spec.ts` (+3 more in plan) | ✅ | ⬜ pending |
| 3-14-01 | 03-14 | 3 | WAVG-05 | T-03-22 | Receipt editor | e2e | `npm --prefix e2e test -- --project=desktop tests/receipts-tab.spec.ts` | ✅ | ⬜ pending |
| 3-14-02 | 03-14 | 3 | WAVG-05 | T-03-22 | Receipt reader settings | e2e | `npm --prefix e2e test -- --project=desktop tests/receipts-reader.spec.ts tests/receipts-tab.spec.ts tests/receipts-tax.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-15-01 | 03-15 | 6 | WAVG-05 | T-03-23, T-03-24 | Cross-screen spec, whole-G2 gate, lint cap and the full check | unit/types | `npm --prefix client test && npm --prefix client run build` (+4 more in plan) | ✅ | ⬜ pending |
| 3-15-02 | 03-15 | 6 | WAVG-05 | T-03-23, T-03-24 | Docs, version, changelog and evidence | record/gate | `V=$(node -p "require('./package.json').version"); grep -c "version: \"$V\"\\|version: $V" homeassistant/config.yaml && head -20 CHANGELOG.md \| grep -c "## $V" && test -…` (+1 more in plan) | n/a | ⬜ pending |
| 3-15-03 | 03-15 | 6 | WAVG-05 | T-03-23, T-03-24 | The G2 pull request | PR + CI | `gh pr list --repo tvrooi/Allotment --head feat/wave-g2-screens --state open --json number --jq length` (+1 more in plan) | n/a | ⬜ pending |
| 3-16-01 | 03-16 | 7 | WAVG-06 | T-03-25 | Confirm G2 is merged and bring the checkout up to date | unit/types | `(cd client && npx tsc --noEmit) && npm --prefix client test` | ✅ | ⬜ pending |
| 3-16-02 | 03-16 | 7 | WAVG-06 | T-03-25 | Reconcile the G3 plans and re-measure their gates (D-16) | record/gate | `grep -cE '^G3 reconcile: (match\|revise)$' docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-16-SUMMARY.md` (+1 more in plan) | n/a | ⬜ pending |
| 3-17-01 | 03-17 | 8 | WAVG-06 | T-03-26 | Goal form and goal status | e2e | `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts tests/settings.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-17-02 | 03-17 | 8 | WAVG-06 | T-03-26 | Investment dialogs | e2e | `npm --prefix e2e test -- --project=desktop tests/investments.spec.ts tests/safe-mode.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-18-01 | 03-18 | 8 | WAVG-06 | T-03-27 | The runway's percents and growth rate, tested first (D-14) | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/forecast.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-18-02 | 03-18 | 8 | WAVG-06 | T-03-27 | The runway's money, dates, lists and names | e2e | `npm --prefix e2e test -- --project=desktop tests/forecast.spec.ts tests/safe-mode.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-19-01 | 03-19 | 8 | WAVG-06 | T-03-28 | fields.tsx on NumberField and the shared Select | e2e | `npm --prefix e2e test -- --project=desktop tests/long-term-forecast.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-19-02 | 03-19 | 8 | WAVG-06 | T-03-28 | Event editor and list, with the end year tested first | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/long-term-forecast.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-19-03 | 03-19 | 8 | WAVG-06 | T-03-28 | Forecast page, panels and the specs | e2e | `npm --prefix e2e test -- --project=desktop tests/long-term-forecast.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-20-01 | 03-20 | 8 | WAVG-06 | T-03-29 | Report builder and report detail controls | e2e | `npm --prefix e2e test -- --project=desktop tests/reports.spec.ts tests/unsaved-drafts.spec.ts tests/report-drill-through.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-20-02 | 03-20 | 8 | WAVG-06 | T-03-29 | Month grid names from date-fns and a bounded Next year (IN-02, IN-03) | unit/types (failing first) | `npm --prefix client test -- src/components/ui/MonthPicker.test.ts src/components/ui/MonthRangePicker.test.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-21-01 | 03-21 | 8 | WAVG-06 | T-03-30 | Files page filters and the attach search | e2e | `npm --prefix e2e test -- --project=desktop tests/files.spec.ts` | ✅ | ⬜ pending |
| 3-21-02 | 03-21 | 8 | WAVG-06 | T-03-30 | File details dialog | e2e | `npm --prefix e2e test -- --project=desktop tests/files.spec.ts tests/receipts-tax.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-22-01 | 03-22 | 8 | WAVG-06 | T-03-31 | Rows above the header, tested first (D-14) | e2e (failing first) | `npm --prefix e2e test -- --project=desktop tests/data.spec.ts` (+1 more in plan) | ✅ | ⬜ pending |
| 3-22-02 | 03-22 | 8 | WAVG-06 | T-03-31 | The rest of the import wizard | e2e | `npm --prefix e2e test -- --project=desktop tests/data.spec.ts tests/switchers.spec.ts tests/first-import.spec.ts` (+3 more in plan) | ✅ | ⬜ pending |
| 3-23-01 | 03-23 | 10 | WAVG-06 | T-03-33, T-03-34 | Whole-G3 gate, lint cap and the full check | unit/types | `npm --prefix client test && npm --prefix client run build` (+3 more in plan) | ✅ | ⬜ pending |
| 3-23-02 | 03-23 | 10 | WAVG-06 | T-03-33, T-03-34 | Docs, version, changelog and evidence | record/gate | `V=$(node -p "require('./package.json').version"); grep -c "version: \"$V\"\\|version: $V" homeassistant/config.yaml && head -20 CHANGELOG.md \| grep -c "## $V" && test -…` (+1 more in plan) | n/a | ⬜ pending |
| 3-23-03 | 03-23 | 10 | WAVG-06 | T-03-33, T-03-34 | The G3 pull request | PR + CI | `gh pr list --repo tvrooi/Allotment --head feat/wave-g3-screens --state open --json number --jq length` (+1 more in plan) | n/a | ⬜ pending |
| 3-24-01 | 03-24 | 5 | WAVG-05 | T-03-21 | Filters | e2e | `npm --prefix e2e test -- --project=desktop tests/transaction-filters.spec.ts` (+1 more in plan: transactions.spec.ts, failures allowed only on lines recorded under "For 03-15") | ✅ | ⬜ pending |
| 3-24-02 | 03-24 | 5 | WAVG-05 | T-03-21 | Marks, the two-file gate and lint | e2e | `npm --prefix e2e test -- --project=desktop tests/transaction-filters.spec.ts` (+4 more in plan) | ✅ | ⬜ pending |
| 3-25-01 | 03-25 | 9 | WAVG-06 | T-03-32 | YNAB import | e2e | `npm --prefix e2e test -- --project=desktop tests/switchers.spec.ts tests/data.spec.ts` (+2 more in plan) | ✅ | ⬜ pending |
| 3-25-02 | 03-25 | 9 | WAVG-06 | T-03-32 | Import category mapping, the three-file gate and lint | e2e | `npm --prefix e2e test -- --project=desktop tests/switchers.spec.ts tests/data.spec.ts` (+5 more in plan) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

One row per task (58 tasks in 25 plans), filled by the planner in checker iteration 1. The command
shown is the task's main sample, without the Node 24 `PATH` prefix the plans carry; "+N more" means
the task's `<verify>` has further gates (leftover counts, name gates, lint). Threat Ref lists the
plan's threats. Task-level browser runs are filtered to the screen's specs; the whole `phone`,
`demo`, `server-mode` and `gallery` projects run only in 03-15 Task 1 (G2) and 03-23 Task 1 (G3).
Same-wave browser plans declare their shared fixed ports in `coupling_justified`; browser verifies
run one at a time.

---

## Wave 0 Requirements

- [ ] D-16 reconciliation against the WAVG-01 audit and the shipped controls, at the start of each PR
- [ ] A failing test for each `type="number"` field that changes what can be typed (D-14)
- [ ] Phase 2 e2e helpers (`fillDate`, the listbox selection pattern) present before any selector is rewritten

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each moved screen looks the same apart from the field look, in light and dark | WAVG-05, WAVG-06, D-15 | No per-screen screenshot baseline exists; only the gallery has one | Owner or reviewer opens each moved screen at 1280 and 390 px in both themes |
| Native pickers open on a real phone on the moved screens | D-04 | Playwright emulates the phone; the OS picker is not rendered | On an iPhone, open one Select, one date and one month field per moved screen |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the three new unit test files are created first in their own tdd tasks, 03-02 and 03-04)
- [x] No watch-mode flags
- [x] Feedback latency < 120s for the unit and type sample; each task's filtered screen spec follows it
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
