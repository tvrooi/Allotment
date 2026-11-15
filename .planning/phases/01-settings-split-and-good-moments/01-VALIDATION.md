---
phase: "1"
slug: "settings-split-and-good-moments"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-14"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Work happens in the worktree `/Users/tristanvanrooyen/wt-f` (branch `wave-f`, PR #273; CONTEXT D-07).
> Every command runs on Node 24: prefix with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.4 (client, node env, `src/**/*.test.ts`, no DOM library; render with `renderToStaticMarkup`); Playwright 1.64.0 (e2e, `workers: 1`, fixed ports, one browser run at a time); node:test (`lint/terms`) |
| **Config file** | `client/vite.config.ts`; `e2e/playwright.config.ts` |
| **Quick run command** | `npm test --prefix client -- src/utils/fundingStatus.test.ts src/components/ui/Plant.test.ts src/utils/movedSections.test.ts src/utils/guides.test.ts` |
| **Full suite command** | `npm test --prefix client && npm run build --prefix client && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode) && (cd lint && npm ci && npm test && npm run lint)` |
| **Estimated runtime** | quick ~20 s; one e2e spec ~1-3 min; full suite ~30-45 min |

---

## Sampling Rate

- **After every task commit:** the quick unit command, plus the one or two e2e specs the task touched (`cd e2e && npm test -- --project=desktop tests/<spec>`).
- **After every plan wave:** `npm test --prefix client && npm run build --prefix client` and the touched e2e projects.
- **Before `/gsd-verify-work`:** the full suite must be green on Node 24. Never `E2E_SKIP_BUILD=1`. Lint warnings stay at or under the cap of 128.
- **Max feedback latency:** 180 seconds per task (unit plus one spec).

---

## Per-Task Verification Map

Task IDs filled in by the planner on 15 November 2026 and revised the same day for D-09 and D-10 (plans 01-01 to 01-08; one plan per wave, because the work tree and the e2e ports are shared). Commands run from `/Users/tristanvanrooyen/wt-f`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | WAVF-01 to 05 | T-01-04 | The worktree is repaired and on `wave-f` before any other check | gate | `git -C /Users/tristanvanrooyen/wt-f status --short` exits 0 and HEAD is `wave-f` (first `<verify>` command of 01-01 Task 1) | — | ✅ green |
| 01-01-T1, 01-02-T1 | 01, 02 | 1, 2 | WAVF-01 | T-01-01, T-01-05 | `?provider=` accepts only the allowlist (up, plaid, simplefin, enablebanking); anything else falls back to Up; an unknown feed label gets no parameter | unit | `npm --prefix client test -- src/utils/movedSections.test.ts` | ✅ (#273, revised) | ✅ green |
| 01-01-T1, 01-01-T2, 01-02-T1 | 01, 02 | 1, 2 | WAVF-01 | T-01-06 | A pill opens its own bank | e2e | `npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts tests/up.spec.ts` | ✅ (re-point, add) | ✅ green |
| 01-01-T2, 01-01-T3 | 01 | 1 | WAVF-01 | — | N/A | e2e phone | `npm --prefix e2e test -- --project=phone tests/phone/phone.spec.ts tests/phone/page-gutter.spec.ts tests/phone/polish-phone.spec.ts tests/phone/targets-phone.spec.ts` | ✅ (add routes) | ✅ green |
| 01-03-T1, 01-03-T2, 01-03-T3 | 03 | 3 | WAVF-02 | — | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/settings.spec.ts tests/menus.spec.ts tests/accessibility.spec.ts tests/budget.spec.ts` | ✅ (re-point, add) | ✅ green |
| 01-03-T2 | 03 | 3 | WAVF-02 | — | N/A | e2e phone | `npm --prefix e2e test -- --project=phone tests/phone/targets-phone.spec.ts` | ✅ (add) | ✅ green |
| 01-03-T1, 01-02-T2, 01-07-T1 | 03, 02, 07 | 3, 2, 7 | WAVF-03 | T-01-07, T-01-08, T-01-18 | Redirect is a replace; other query parameters kept, `tab` dropped; paths spelled in one module; guide ids unchanged | unit | `npm --prefix client test -- src/utils/movedSections.test.ts src/utils/guides.test.ts` | ✅ (#273, revised) | ✅ green |
| 01-03-T1, 01-04-T1, 01-07-T1 | 03, 04, 07 | 3, 4, 7 | WAVF-03 | T-01-09, T-01-11 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/settings.spec.ts tests/navigation.spec.ts tests/command-palette.spec.ts tests/guides.spec.ts` | ✅ (add) | ✅ green |
| 01-04-T3 | 04 | 4 | WAVF-03 (D-09) | T-01-25, T-01-26 | Server change is message text only: two files, no route, allowlist or MCP change | server unit, type check, e2e | `npm --prefix server test -- src/routes/accountDeletion.test.ts`; `npx tsc --noEmit` in `server`; `npm --prefix e2e test -- --project=desktop tests/cleanup.spec.ts` | ✅ (update expectation) | ✅ green |
| 01-01-T2, 01-02-T1, 01-03-T3 | 01, 02, 03 | 1, 2, 3 | WAVF-03 | — | N/A | e2e demo | `npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts` | ✅ (update) | ✅ green |
| 01-05-T1 | 05 | 5 | WAVF-04 | T-01-12, T-01-13 | Plant has no amount; bloom memory survives bad storage | unit | `npm --prefix client test -- src/components/ui/Plant.test.ts src/components/goals/growth.test.ts` | ❌ created in 01-05-T1 (growth.test.ts exists) | ✅ green |
| 01-05-T1, 01-05-T2 | 05 | 5 | WAVF-04 | — | N/A | e2e, e2e demo | `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts` and `--project=demo tests/demo/category-goals.spec.ts` | ✅ (rewrite, add) | ✅ green |
| 01-05-T2 | 05 | 5 | WAVF-04 | T-01-12 | Safe mode hides goal rows and plants | e2e | `npm --prefix e2e test -- --project=desktop tests/safe-mode.spec.ts` | ✅ (add test) | ✅ green |
| 01-06-T1 | 06 | 6 | WAVF-05 | T-01-15, T-01-16, T-01-17 | $0 label reveals no amount; no praise without a resolved summary | unit | `npm --prefix client test -- src/utils/fundingStatus.test.ts` | ✅ (extend) | ✅ green |
| 01-06-T2 | 06 | 6 | WAVF-05 | — | N/A | unit (lint terms) | `npm --prefix lint test` | ✅ (add RETIRED row) | ✅ green |
| 01-06-T1, 01-06-T2 | 06 | 6 | WAVF-05 | T-01-15 | N/A | e2e | `npm --prefix e2e test -- --project=desktop tests/budget.spec.ts` | ✅ (update, add) | ✅ green |
| 01-07-T3 | 07 | 7 | WAVF-01 to 05 | T-01-20 | No test skipped or slept; no server change beyond the D-09 message text; no dependency change | full gate | the full suite command above, plus `iphone-webkit` and `multi-user`, the affected server test and the server type check | ✅ | ✅ green |
| 01-08-T1, 01-08-T2 | 08 | 8 | WAVF-01 to 05 | T-01-21, T-01-22, T-01-23 | Evidence from demo and disposable budgets only; plain push; no merge, tag or release | evidence, delivery | `find .ui-evidence/2026-11-14-wave-f -name '*.png'`; `gh pr checks 273 --repo tvrooi/Allotment` | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Check what PR #273 already has before writing new files (it ships `movedSections` and growth-stage tests).

- [x] `client/src/utils/movedSections.test.ts`: redirect map to `/accounts/connections` and `/budget/categories`, parameters kept, `?provider=` allowlist
- [x] `client/src/components/ui/Plant.test.ts`: `plantStage` at 0, 32.99, 33, 65.99, 66 and 100 (complete false) and complete true; markup is `aria-hidden` with no raw hex
- [x] Extend `client/src/utils/fundingStatus.test.ts`: `unresolvedCauses` and the $0 status for every row in UI-SPEC section 5, including funding absent (no praise)
- [x] `lint/terms/terms.test.js`: RETIRED row for "Fully budgeted"
- [x] e2e additions: Settings redirects and tablist, Accounts and Budget links, demo plant flower, reduced motion stops the plant animation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plant stages, flower and bloom read well in light and dark | WAVF-04 | Visual judgement | Screenshot Goals ("New laptop") at 1280 and 390 px in light and dark into `.ui-evidence/2026-11-14-wave-f/` |
| $0 hero clean and caveat look | WAVF-05 | Visual judgement | Screenshot the Budget hero at $0, clean and with a caveat, light and dark, 1280 and 390 px |
| New pages and shorter Settings | WAVF-01 to 03 | Visual judgement | Screenshot `/accounts/connections`, `/budget/categories` and `/settings` at 1280 and 390 px |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-15 (validate-phase audit: 0 gaps; unit 65/65, server accountDeletion 4/4, lint terms 86/86 on Node 24.10.0 in wt-f; CI on 575c3ea green incl. e2e 1-4; 32 screenshots present). Manual-only visual checks remain for the owner.

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
