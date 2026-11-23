---
phase: "2"
slug: "shared-form-controls"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-16"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from
> `02-RESEARCH.md` §Validation Architecture; the planner fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (client unit, Node environment, `renderToStaticMarkup`), ESLint + `node --test` (`lint/`), Playwright 1.64 (`e2e/`) |
| **Config file** | `client/vite.config.ts`, `lint/eslint.config.js`, `e2e/playwright.config.ts` |
| **Quick run command** | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit)` |
| **Full suite command** | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test --prefix client && (cd client && npx tsc --noEmit) && (cd lint && npm test && npm run lint) && npm run format:check && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode && npm test -- --project=gallery)` |
| **Estimated runtime** | Quick: about 60 seconds. Full: tens of minutes (browser projects run one at a time; e2e ports are fixed) |

Node 24 only. Never set `E2E_SKIP_BUILD=1`. The `gallery` Playwright project does not exist yet
(Wave 0).

---

## Sampling Rate

- **After every task commit:** Run the quick run command, plus `(cd lint && npm test && npm run lint)` when a `.tsx` file changed
- **After every plan wave:** Run the full suite command (set PR only; the audit PR runs `npm run format:check`)
- **Before `/gsd-verify-work`:** Full suite must be green, and **CI passed** green on the PR
- **Max feedback latency:** 120 seconds for the per-task sample

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | WAVG-01 | T-02-01, T-02-02 | N/A | docs or source check | the task's verify block in 02-01-PLAN.md (2 checks; the first is too long to quote) | ✅ | ✅ green (gate at 8ed6a0f: missing=0 of 51; prettier ok) |
| 2-01-02 | 02-01 | 1 | WAVG-01 | T-02-01, T-02-02 | N/A | docs or source check | the task's verify block in 02-01-PLAN.md (1 check; the first is too long to quote) | ✅ | ✅ green (gate at 8ed6a0f) |
| 2-01-03 | 02-01 | 1 | WAVG-01 | T-02-01, T-02-02 | N/A | docs or source check | the task's verify block in 02-01-PLAN.md (3 checks; the first is too long to quote) | ✅ | ✅ green (gate at 8ed6a0f; prettier ok) |
| 2-02-01 | 02-02 | 2 | WAVG-01 | T-02-03, T-02-04, T-02-05 | N/A | docs or source check | the task's verify block in 02-02-PLAN.md (2 checks; the first is too long to quote) | ✅ | ✅ green (gates at 8ed6a0f: 0 of 233, 0 of 285) |
| 2-02-02 | 02-02 | 2 | WAVG-01 | T-02-03, T-02-04, T-02-05 | N/A | docs or source check | the task's verify block in 02-02-PLAN.md (4 checks; the first is too long to quote) | ✅ | ✅ green (outline-none 0 of 70; 8 headings; prettier ok) |
| 2-02-03 | 02-02 | 2 | WAVG-01 | T-02-03, T-02-04, T-02-05 | N/A | docs or source check | `find .ui-evidence -path '*-wave-g0/*' -name '*.png' \| wc -l` (first of 4) | ✅ | ✅ green (68 images in main checkout) |
| 2-03-01 | 02-03 | 3 | WAVG-01 | T-02-06, T-02-07, T-02-08 | N/A | docs or source check | the task's verify block in 02-03-PLAN.md (3 checks; the first is too long to quote) | ✅ | ✅ green (#275 docs-only, CI 12 pass, merged fea7122) |
| 2-03-02 | 02-03 | 3 | WAVG-01 | T-02-06, T-02-07, T-02-08 | N/A | owner gate (manual) | none: a blocking owner decision (D-10) | n/a | manual (recorded: go-with-changes) |
| 2-03-03 | 02-03 | 3 | WAVG-01 | T-02-06, T-02-07, T-02-08 | N/A | docs or source check | `grep -cE '^Owner gate: (go\|go-with-changes\|revise-audit)$' docs/superpowers/gsd-records/phases/02-shared-form-controls/02-03-SUMMARY.md` (first of 3) | ✅ | ✅ green |
| 2-04-01 | 02-04 | 4 | WAVG-04 | T-02-09, T-02-10 | Gallery absent from every production build | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/harness.spec.ts` (first of 3) | ✅ | ✅ green (harness; absent from default, electron, demo builds) |
| 2-15-01 | 02-15 | 5 | WAVG-02, WAVG-03, WAVG-04 | T-02-11, T-02-12, T-02-38 | N/A | unit | `npm --prefix client test -- src/components/ui/Switch.test.ts` (first of 4) | ✅ | ✅ green |
| 2-15-02 | 02-15 | 5 | WAVG-02, WAVG-03, WAVG-04 | T-02-11, T-02-12, T-02-38 | N/A | e2e (Linux container) | `bash e2e/gallery-baselines.sh` (first of 3) | ✅ | ✅ green (Linux baselines: CI on #277 at aefe89a) |
| 2-05-01 | 02-05 | 6 | WAVG-02, WAVG-03 | T-02-13, T-02-14 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/accessibility.spec.ts tests/menus.spec.ts tests/tabs.spec.ts` (first of 2) | ✅ | ✅ green |
| 2-05-02 | 02-05 | 6 | WAVG-02, WAVG-03 | T-02-13, T-02-14 | N/A | docs or source check | `grep -c 'ring-brand-400' client/src/components/rules/RuleEditorModal.tsx` (first of 5) | ✅ | ✅ green |
| 2-06-01 | 02-06 | 7 | WAVG-02, WAVG-03 | T-02-15, T-02-16, T-02-17 | N/A | unit | `npm --prefix client test -- src/components/ui/Field.test.ts src/components/ui/Input.test.ts` (first of 4) | ✅ | ✅ green |
| 2-06-02 | 02-06 | 7 | WAVG-02, WAVG-03 | T-02-15, T-02-16, T-02-17 | N/A | docs or source check | `grep -c 'placeholder-text-disabled' client/src/components/ui/CurrencyInput.tsx` (first of 5) | ✅ | ✅ green |
| 2-16-01 | 02-16 | 8 | WAVG-02, WAVG-03 | T-02-39, T-02-40 | No default message or Clear button without a subject | unit | `npm --prefix client test -- src/components/ui/fieldMessages.test.ts src/components/ui/Field.test.ts` (first of 5) | ✅ | ✅ green |
| 2-16-02 | 02-16 | 8 | WAVG-02, WAVG-03 | T-02-39, T-02-40 | N/A | unit | `npm --prefix client test -- src/components/ui/Textarea.test.ts src/components/ui/` (first of 3) | ✅ | ✅ green |
| 2-07-01 | 02-07 | 9 | WAVG-02, WAVG-03 | T-02-18, T-02-19 | N/A | unit | `npm --prefix client test -- src/components/ui/Select.test.ts` (first of 3) | ✅ | ✅ green |
| 2-07-02 | 02-07 | 9 | WAVG-02, WAVG-03 | T-02-18, T-02-19 | N/A | unit | `npm --prefix client test -- src/components/ui/Select.test.ts` (first of 4) | ✅ | ✅ green |
| 2-08-01 | 02-08 | 10 | WAVG-02, WAVG-03 | T-02-20, T-02-21 | N/A | unit | `npm --prefix client test -- src/components/ui/dateSegments.test.ts src/components/ui/DatePicker.test.ts` (first of 4) | ✅ | ✅ green |
| 2-08-02 | 02-08 | 10 | WAVG-02, WAVG-03 | T-02-20, T-02-21 | N/A | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/dates.spec.ts` (first of 3) | ✅ | ✅ green |
| 2-08-03 | 02-08 | 10 | WAVG-02, WAVG-03 | T-02-20, T-02-21 | N/A | unit | `npm --prefix client test -- src/components/ui/MonthPicker.test.ts src/components/ui/` (first of 4) | ✅ | ✅ green |
| 2-09-01 | 02-09 | 11 | WAVG-02, WAVG-03 | T-02-23 | N/A | unit | `npm --prefix client test -- src/components/ui/Combobox.test.ts` (first of 3) | ✅ | ✅ green |
| 2-09-02 | 02-09 | 11 | WAVG-02, WAVG-03 | T-02-23 | N/A | unit | `npm --prefix client test -- src/components/ui/Combobox.test.ts` (first of 3) | ✅ | ⚠️ flaky (combobox.spec.ts:134: 1 of 3 full macOS runs, 0 of 120 alone, green in CI) |
| 2-19-01 | 02-19 | 12 | WAVG-02, WAVG-03 | T-02-22, T-02-43 | Escape with payee suggestions open never closes the sheet (D-12) | unit | `npm --prefix client test -- src/components/transactions/PayeeCombobox.test.ts` (first of 7) | ✅ | ✅ green |
| 2-10-01 | 02-10 | 13 | WAVG-02, WAVG-03 | T-02-24, T-02-26 | N/A | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/pickers.spec.ts` (first of 5) | ✅ | ✅ green |
| 2-10-02 | 02-10 | 13 | WAVG-02, WAVG-03 | T-02-24, T-02-26 | N/A | unit | `npm --prefix client test -- src/components/transactions/CategoryPicker.test.ts` (first of 4) | ✅ | ✅ green |
| 2-17-01 | 02-17 | 14 | WAVG-02, WAVG-03 | T-02-41 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/review.spec.ts tests/review-payees.spec.ts tests/review-undo.spec.ts` (first of 4) | ✅ | ✅ green |
| 2-17-02 | 02-17 | 14 | WAVG-02, WAVG-03 | T-02-41 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/payees.spec.ts tests/rules.spec.ts tests/recurring.spec.ts` (first of 4) | ✅ | ✅ green |
| 2-20-01 | 02-20 | 15 | WAVG-02, WAVG-03 | T-02-45 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/first-import.spec.ts tests/freshness.spec.ts tests/polish.spec.ts tests/recover.spec.ts` (first of 3) | ✅ | ✅ green |
| 2-20-02 | 02-20 | 15 | WAVG-02, WAVG-03 | T-02-45 | N/A | e2e | `npm --prefix e2e test -- --project=phone tests/phone/phone-native.spec.ts tests/phone/polish-phone.spec.ts` (first of 3) | ✅ | ✅ green (+ Payee sheet 44 px test) |
| 2-18-01 | 02-18 | 16 | WAVG-02, WAVG-03 | T-02-42, T-02-25, T-02-44 | N/A | e2e | the task's verify block in 02-18-PLAN.md (2 checks; the first is too long to quote) | ✅ | ✅ green |
| 2-18-02 | 02-18 | 16 | WAVG-02, WAVG-03 | T-02-42, T-02-25, T-02-44 | N/A | unit | `npm --prefix client test -- src/components/transactions/CategoryPicker.test.ts src/components/ui/Combobox.test.ts` (first of 5) | ✅ (written by plan 02-10) | ✅ green |
| 2-18-03 | 02-18 | 16 | WAVG-02, WAVG-03 | T-02-42, T-02-25, T-02-44 | Categories picked only as chosen, on every screen | e2e | the task's verify block in 02-18-PLAN.md (5 checks; the first is too long to quote) | ✅ | ✅ green |
| 2-13-01 | 02-13 | 17 | WAVG-02, WAVG-03 | T-02-34, T-02-35 | N/A | unit | `npm --prefix client test -- src/components/ui/Checkbox.test.ts` (first of 3) | ✅ | ✅ green |
| 2-13-02 | 02-13 | 17 | WAVG-02, WAVG-03 | T-02-34, T-02-35 | N/A | unit | `npm --prefix client test -- src/components/ui/RadioGroup.test.ts` (first of 2) | ✅ | ✅ green |
| 2-13-03 | 02-13 | 17 | WAVG-02, WAVG-03 | T-02-34, T-02-35 | N/A | unit | `npm --prefix client test -- src/components/ui/Switch.test.ts` (first of 6) | ✅ | ✅ green |
| 2-14-01 | 02-14 | 18 | WAVG-02, WAVG-03 | T-02-36, T-02-37 | A month range never ends before it starts | unit | `npm --prefix client test -- src/utils/dateRange.test.ts src/components/ui/MonthPicker.test.ts` (first of 6) | ✅ | ✅ green |
| 2-14-02 | 02-14 | 18 | WAVG-02, WAVG-03 | T-02-36, T-02-37 | N/A | unit | `npm --prefix client test -- src/components/ui/MonthRangePicker.test.ts src/components/ui/` (first of 3) | ✅ | ✅ green (escalated: phone month clips, Manual-Only) |
| 2-14-03 | 02-14 | 18 | WAVG-02, WAVG-03 | T-02-36, T-02-37 | N/A | e2e | `npm --prefix e2e test -- --project=phone tests/phone/phone-native.spec.ts` (first of 4) | ✅ | ✅ green |
| 2-11-01 | 02-11 | 19 | WAVG-03, WAVG-04 | T-02-27, T-02-28, T-02-29 | N/A | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/matrix.spec.ts` (first of 3) | ✅ | ✅ green |
| 2-11-02 | 02-11 | 19 | WAVG-03, WAVG-04 | T-02-27, T-02-28, T-02-29 | N/A | e2e | `npm --prefix e2e test -- --project=gallery tests/gallery/overlays.spec.ts` (first of 3) | ✅ | ✅ green (escalated: detail Payee 41 px, Manual-Only) |
| 2-11-03 | 02-11 | 19 | WAVG-03, WAVG-04 | T-02-27, T-02-28, T-02-29 | N/A | e2e (Linux container) | `bash e2e/gallery-baselines.sh && bash e2e/gallery-baselines.sh` (first of 4) | ✅ | ✅ green (Linux baselines: CI on #277 at aefe89a) |
| 2-12-01 | 02-12 | 20 | WAVG-02, WAVG-03, WAVG-04 | T-02-30, T-02-31, T-02-32, T-02-33 | N/A | docs or source check | the task's verify block in 02-12-PLAN.md (8 checks; the first is too long to quote) | ✅ | ✅ green |
| 2-12-02 | 02-12 | 20 | WAVG-02, WAVG-03, WAVG-04 | T-02-30, T-02-31, T-02-32, T-02-33 | N/A | unit | `npm --prefix client test && npm --prefix client run build` (first of 11) | ✅ | ✅ green |
| 2-12-03 | 02-12 | 20 | WAVG-02, WAVG-03, WAVG-04 | T-02-30, T-02-31, T-02-32, T-02-33 | N/A | docs or source check | the task's verify block in 02-12-PLAN.md (4 checks; the first is too long to quote) | ✅ | ✅ green (#277 open, CI green; #267 open) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · manual*

One row per task; a task id is phase, plan and task (`2-04-02` is plan 02-04, Task 2). The command
shown is the task's first automated check, run on Node 24; its full list is in the task's verify
block. Threat Ref lists the threats of the task's plan, whose threat register names each
mitigation. A whole Playwright project runs at a plan's exit gate, not per task, except where the
task says why nothing faster proves its property (the Linux baselines in 02-15, 02-11 and 02-13,
the category-row measures and sweeps in 02-17, 02-20 and 02-18, the payee sweep in 02-19, the whole phone
project in 02-14, and the full check in 02-12). Plans run one per wave in this order: 02-04, 02-15,
02-05, 02-06, 02-16, 02-07, 02-08, 02-09, 02-19, 02-10, 02-17, 02-20, 02-18, 02-13, 02-14, 02-11,
02-12 (waves 4 to 20; plans 02-15 to 02-19 came from the second plan revision's splits, plan 02-20
from the third, which split the category-row measure by owning plan).

---

## Wave 0 Requirements

- [x] Audit runner (temporary, not committed) producing the table for the audit document (audit PR)
- [x] `client/src/components/ui/*.test.ts` — `renderToStaticMarkup` tests: ARIA attributes, token-only classes, placeholder colour, disabled Switch (#264), phone native branches
- [x] `e2e/tests/fixtures.ts` `fillDate` helper — fills the desktop DatePicker segments and the phone date input (D-07)
- [x] A `gallery` Playwright project and Linux screenshot baselines — keyboard, Escape-in-Modal and `toHaveScreenshot` at 1280 and 390 px, light and dark (built as one spec per control family under `e2e/tests/gallery/`, not one `controls-gallery.spec.ts`; 46 baselines)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The owner reads the audit and says go before the set PR starts | WAVG-01, D-10 | An owner decision gate, not a test | Owner reads the audit document and screenshots in the audit PR and replies |
| Screen-reader announcements of each control | WAVG-03 | No screen-reader automation in the repo | VoiceOver pass over the gallery: name, role, state and value announced for each control |
| Native pickers open on a real phone | WAVG-03, D-04 | Playwright's phone project emulates; the OS picker is not rendered | On an iPhone at 390 px, tap Select, DatePicker, MonthPicker and MonthRangePicker's From and To in the gallery |
| ESCALATED: MonthRangePicker's phone month inputs cut off "November 2026" | WAVG-03, D-04 | Implementation defect, owner decision (stack From and To, or accept); implementation is out of a test-only audit's scope | Chromium at 390 px: each input is 159 px wide where an unconstrained one needs 177 px; the To field reads "November 202" (`client/src/components/ui/MonthRangePicker.tsx:123`, `flex-1 min-w-0` labels side by side). Failing check kept out of the suite: a gallery test comparing each input's width with a `width:auto` clone (Nyquist audit, 18 Nov 2026). Confirm on an iPhone whether Safari clips too |
| ESCALATED: the transaction detail sheet's Payee field is 41 px tall on a phone | WAVG-03 (screen move is WAVG-05, Phase 3) | Implementation defect in a screen, not in the shared set; the bare PayeeCombobox is 23 px | `client/src/components/transactions/TransactionDetailPanel.tsx:533` passes `py-2` over the bare look. Failing check kept out of the suite: phone project, open a transaction card, measure `combobox` "Payee" in "Transaction details" (expects 44, gets 41). Fix when Phase 3 moves the panel to the shared field classes |
| FLAKY: `e2e/tests/gallery/combobox.spec.ts:134` | WAVG-03 | Fails rarely, root cause not found: the "Savings" option detaches mid-click and the list does not return | Failed in 1 of 3 full macOS gallery runs and in the emulated Linux container (02-11, 02-12, 02-13 SUMMARYs); 0 failures in 120 isolated runs, at 6x and 20x CPU throttle, and in CI on #277 (no retry used). The option was inside the viewport (y 441 of 800), so a scroll-to-click does not explain it. Capture a trace when it next fails |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (2-03-02 is the owner gate, Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (client unit suite 10 s, `tsc` under 30 s)
- [ ] `nyquist_compliant: true` set in frontmatter (false: two escalated defects and one flaky test above)

**Approval:** partial — every automated row ran green on 4eb5cfd (client and e2e identical to #277's aefe89a) except the flaky 2-09-02; two defects escalated to the owner

Run on 18 November 2026 (Node 24, macOS): client unit 830/830 in 92 files; client `tsc` ok; client build ok, gallery absent from the default, electron and demo builds; lint tests 86/86, lint 0 errors and 126 warnings (cap 128); e2e `tsc` ok; Playwright desktop 489/489, phone 64/64 existing plus the new Payee-sheet test, demo 25/25, server-mode 17/17, gallery 144 passed, 1 failed (`combobox.spec.ts:134`), 46 pixel tests skipped off Linux by design (two full re-runs: 145 passed each, `combobox.spec.ts:134` green, the only failure being the escalated month-width check). The 02-01 and 02-02 coverage gates were run at the audit's commit 8ed6a0f, where they print missing=0; at HEAD later plans have moved code (51, 231 and 353 places, 3, 6 and 69 not cited), which is the audit being a dated snapshot, not a gap. Point-in-time exact counts have also moved on: 4 `textbox "Payee"` selectors (3 in recurring.spec.ts plus a gallery Input specimen) and 5 MonthRangePicker importers (plus the gallery's DialogCard).

## Validation Audit 2026-11-18

| Metric | Count |
|---|---|
| Gaps found | 4 |
| Resolved | 1 |
| Escalated | 3 |
