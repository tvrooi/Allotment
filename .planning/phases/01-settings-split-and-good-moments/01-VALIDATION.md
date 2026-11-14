---
phase: "1"
slug: "settings-split-and-good-moments"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Task IDs are filled in by the planner; rows are keyed by requirement until then.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | WAVF-01 | — | `?provider=` accepts only the allowlist (up, plaid, simplefin, enablebanking); anything else falls back to the default | unit | `npm test --prefix client -- src/utils/movedSections.test.ts` | check #273 | ⬜ pending |
| TBD | TBD | TBD | WAVF-01 | — | N/A | e2e | `cd e2e && npm test -- --project=desktop tests/accounts.spec.ts tests/up.spec.ts` | ✅ (re-point, add) | ⬜ pending |
| TBD | TBD | TBD | WAVF-01 | — | N/A | e2e phone | `cd e2e && npm test -- --project=phone tests/phone/phone.spec.ts tests/phone/page-gutter.spec.ts tests/phone/polish-phone.spec.ts` | ✅ (add routes) | ⬜ pending |
| TBD | TBD | TBD | WAVF-02 | — | N/A | e2e | `cd e2e && npm test -- --project=desktop tests/settings.spec.ts tests/menus.spec.ts tests/accessibility.spec.ts tests/budget.spec.ts` | ✅ (re-point, add) | ⬜ pending |
| TBD | TBD | TBD | WAVF-02 | — | N/A | e2e phone | `cd e2e && npm test -- --project=phone tests/phone/targets-phone.spec.ts` | ✅ (add) | ⬜ pending |
| TBD | TBD | TBD | WAVF-03 | — | Redirect is a replace; other query parameters kept, `tab` dropped | unit | `npm test --prefix client -- src/utils/movedSections.test.ts src/utils/guides.test.ts` | check #273 | ⬜ pending |
| TBD | TBD | TBD | WAVF-03 | — | N/A | e2e | `cd e2e && npm test -- --project=desktop tests/settings.spec.ts tests/navigation.spec.ts tests/command-palette.spec.ts` | ✅ (add) | ⬜ pending |
| TBD | TBD | TBD | WAVF-03 | — | N/A | e2e demo | `cd e2e && npm test -- --project=demo tests/demo/demo.spec.ts` | ✅ (update) | ⬜ pending |
| TBD | TBD | TBD | WAVF-04 | — | Plant has no amount; hidden with the list in Safe mode | unit | `npm test --prefix client -- src/components/ui/Plant.test.ts` | ❌ W0 (or adapt #273's growth-stage test) | ⬜ pending |
| TBD | TBD | TBD | WAVF-04 | — | N/A | e2e demo | `cd e2e && npm test -- --project=demo tests/demo/category-goals.spec.ts` | ✅ (add) | ⬜ pending |
| TBD | TBD | TBD | WAVF-04 | — | Safe mode hides goal rows and plants | e2e | `cd e2e && npm test -- --project=desktop tests/safe-mode.spec.ts` | ✅ (add assertion) | ⬜ pending |
| TBD | TBD | TBD | WAVF-05 | — | $0 label reveals no amount | unit | `npm test --prefix client -- src/utils/fundingStatus.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | WAVF-05 | — | N/A | unit (lint terms) | `cd lint && npm test` | ✅ (add RETIRED row) | ⬜ pending |
| TBD | TBD | TBD | WAVF-05 | — | N/A | e2e | `cd e2e && npm test -- --project=desktop tests/budget.spec.ts` | ✅ (update :45, :303, add) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Check what PR #273 already has before writing new files (it ships `movedSections` and growth-stage tests).

- [ ] `client/src/utils/movedSections.test.ts`: redirect map to `/accounts/connections` and `/budget/categories`, parameters kept, `?provider=` allowlist
- [ ] `client/src/components/ui/Plant.test.ts`: `plantStage` at 0, 32.99, 33, 65.99, 66 and 100 (complete false) and complete true; markup is `aria-hidden` with no raw hex
- [ ] Extend `client/src/utils/fundingStatus.test.ts`: `unresolvedCauses` and the $0 status for every row in UI-SPEC section 5, including funding absent (no praise)
- [ ] `lint/terms/terms.test.js`: RETIRED row for "Fully budgeted"
- [ ] e2e additions: Settings redirects and tablist, Accounts and Budget links, demo plant flower, reduced motion stops the plant animation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plant stages, flower and bloom read well in light and dark | WAVF-04 | Visual judgement | Screenshot Goals ("New laptop") at 1280 and 390 px in light and dark into `.ui-evidence/2026-11-14-wave-f/` |
| $0 hero clean and caveat look | WAVF-05 | Visual judgement | Screenshot the Budget hero at $0, clean and with a caveat, light and dark, 1280 and 390 px |
| New pages and shorter Settings | WAVF-01 to 03 | Visual judgement | Screenshot `/accounts/connections`, `/budget/categories` and `/settings` at 1280 and 390 px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
