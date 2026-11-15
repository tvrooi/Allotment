---
phase: 01-settings-split-and-good-moments
verified: 2026-11-15T21:02:00+11:00
status: gaps_found
score: 13/15 must-haves verified
overrides_applied: 0
target_repo: /Users/tristanvanrooyen/wt-f
target_branch: wave-f
target_commit: 575c3ea48bd32f791a1417762140a1a7bd482c0a
pr: 273
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/01-settings-split-and-good-moments/01-01-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-01-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-02-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-02-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-03-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-03-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-04-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-04-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-05-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-05-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-06-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-06-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-07-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-07-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-08-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-08-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-CONTEXT.md
  - .planning/phases/01-settings-split-and-good-moments/01-REVIEW-DISPOSITION.md
  - .planning/phases/01-settings-split-and-good-moments/01-REVIEW.md
  - .planning/phases/01-settings-split-and-good-moments/01-UI-REVIEW.md
  - .planning/phases/01-settings-split-and-good-moments/01-UI-SPEC.md
covered_digest: v4:sha256:c47c816eb78606577a6603936750e87a5cc427e1f7191090ae7b00361167b9f1
gaps:
  - truth: "A goal's plant grows in place when its stage changes while the page is open, and the flower blooms once per goal per device (SC 4 / WAVF-04 / D-03 / WR-01)"
    status: failed
    reason: "`GoalPlant.tsx:21` evaluates `firstBloom(goalId)` only inside `useState(() => complete && firstBloom(goalId))` on component mount. Active goals crossing into `completed` remount `GoalRow` in `Goals.tsx:360-362` (so they bloom), but rows that stay mounted inside the same `GoalGroup` when `complete` flips `false -> true` (paused goals funded to target, manually `completed` goals edited up to target, or goals whose `fundingComplete` resolves `false -> true` after mount) stay `data-bloom=\"false\"` and never persist/play the bloom. Conversely, a goal mounted complete in the `completed` group that dips below target and returns without unmounting stays `bloom=true` in memory. In addition, neither unit tests nor `e2e/tests/category-goals.spec.ts` exercise live stage growth (`seed -> seedling -> bud -> flower`) without a page reload."
    artifacts:
      - path: "client/src/components/goals/GoalPlant.tsx"
        issue: "Line 21 captures `bloom` only on initial mount via `useState(() => complete && firstBloom(goalId))`, missing in-place `complete` `false -> true` transitions on mounted rows."
      - path: "e2e/tests/category-goals.spec.ts"
        issue: "Tests four static pre-funded goals and initial-mount + reload bloom (`Laptop`), with no test driving an in-place stage change or mounted `complete` transition while `/goals` stays open."
    missing:
      - "Track `complete` rising edge in `GoalPlant` (e.g., `useEffect` calling `firstBloom(goalId)` when `complete` transitions `false -> true` while mounted, and clearing transient `bloom` when `complete` becomes `false`) so in-place transitions on mounted rows bloom once and only once."
      - "Add a component or e2e test asserting in-place stage transition (`grew` / stage attribute change and `data-bloom=\"true\"` on `false -> true` without reload)."
  - truth: "The retired $0 Ready to assign wording (`Fully budgeted`) leaves `client/src` user-facing copy and is guarded case-insensitively (WAVF-05 / Plan 07 / WR-04)"
    status: failed
    reason: "`client/src/userGuide/articles.tsx:405` still instructs readers that held money lets the month 'reach $0 and read fully budgeted' (lowercase), and `lint/terms/terms.test.js:19` guards only case-sensitive `/Fully budgeted/`, allowing lowercase occurrences to slip past."
    artifacts:
      - path: "client/src/userGuide/articles.tsx"
        issue: "Line 405 still reads `so the month can reach $0 and read fully budgeted`."
      - path: "lint/terms/terms.test.js"
        issue: "Line 19 regex `/Fully budgeted/` is case-sensitive rather than `/Fully budgeted/i` (or catching `'fully budgeted'`)."
    missing:
      - "Update `client/src/userGuide/articles.tsx:405` to match `'Every dollar has a job'`."
      - "Make the `lint/terms/terms.test.js:19` guard case-insensitive (`/Fully budgeted/i`)."
behavior_unverified_items:
  - "Owner visual inspection of the 32 captured PNGs in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (28 named light/dark 1280/390 screen screenshots + 4 goal stage PNGs) — UI-SPEC / Plans 01, 05, 06, 08 require owner eyes on typography hierarchy, plant silhouette legibility at 100% zoom, brand consistency with logo sprout, and $0 tone."
  - "Hover-row contrast over `flower` petals in `client/src/pages/Goals.tsx` / `client/src/components/ui/Plant.tsx` — hover styling (`--color-hover`) was not photographed in `.ui-evidence/2026-11-14-wave-f/` (reported in `01-UI-REVIEW.md`)."
  - "Live visual playback feel of `--animate-grow-in` (320 ms) and `--animate-bloom` / `--animate-bloom-ring` (560 ms / 720 ms) in normal motion and real browser reduced motion — `e2e/tests/category-goals.spec.ts` asserts `animation-name: none` under emulated reduced motion, while normal-motion visual smoothness requires human eyes."
  - "390 px Accounts header two-line wrapping (`Connected banks` + `Add account`) and Connected banks provider bar placement in light and dark mode (captured in `.ui-evidence/2026-11-14-wave-f/`, awaiting owner visual sign-off)."
  - "Live browser verification of Enable Banking bank-connection error links (`server/src/services/enableBankingService.ts:71,73`, `enableBankingSyncService.ts:435`) — flagged as non-blocking D-09 scope finding `WR-03`."
human_verification:
  - test: "Inspect the 32 wave-f screenshots in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (attach to PR #273 comment; never commit)."
    expected: "Accounts 390px header reads cleanly in two rows; Connected banks sits directly under breadcrumb; Budget $0 clean hero feels quietly encouraging with seedling and figure in normal text colour, while $0 caveat reads as an actionable job; Goals four stages are distinct at 100% zoom and match the brand sprout in light and dark at 1280px and 390px."
    why_human: "Aesthetic quality, tone, brand cohesion, and legibility at 100% zoom require human visual judgement."
  - test: "Hover over a completed goal row on `/goals` in light and dark mode in a live browser."
    expected: "Flower petals and stem remain clearly legible over the row's hover background (`--color-hover`)."
    why_human: "Hover background state is not captured in `.ui-evidence/2026-11-14-wave-f/` (`01-UI-REVIEW.md` finding)."
  - test: "Trigger goal completion (`in-progress -> Goal reached`) and observe live growth/bloom animations in a browser (with and without OS reduced motion)."
    expected: "Stage change scales smoothly (`320ms`), flower opens cleanly with ring (`560ms`/`720ms`), and under reduced motion renders immediately still without jitter."
    why_human: "Live CSS keyframe timing and perceived smoothness require human observation beyond CSS `animation-name` assertions."
---

# Phase 01: Settings split and good moments — Verification Report

**Phase Goal:** The owner reaches bank connections and categories where they think of them (Accounts and Budget), Settings is shorter, and the app marks a completed goal and a fully assigned month in the brand voice.
**Verified:** 2026-11-15T21:02:00+11:00
**Status:** gaps_found
**Score:** 13/15 must-haves verified
**Target Checkout:** `/Users/tristanvanrooyen/wt-f` (branch `wave-f`, commit `575c3ea48bd32f791a1417762140a1a7bd482c0a`, PR `#273` OPEN against `redesign`)

> [!IMPORTANT]
> **Verification Scope Boundary:** Working tree `.claude/worktrees/agent-p01-verifier` holds only Phase 01 `.planning` artifacts over older `redesign` code. Every codebase, build, unit, type, lint, and CI check below was verified read-only against `/Users/tristanvanrooyen/wt-f` at `575c3ea48bd32f791a1417762140a1a7bd482c0a`. Local Playwright `e2e/` was intentionally not run due to fixed shared ports; full CI Playwright results on `575c3ea` (`gh pr checks 273`) were inspected alongside the diffed e2e specs.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + Plan Must-Haves)

| # | Truth / Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | **SC 1:** Opening Accounts gives direct access to Connected banks (and the empty state lets a user connect a bank), with Up reachable in at most two clicks; `/accounts/connections` honours `?provider=` (`up`, `plaid`, `simplefin`, `enablebanking`, falling back to `up`) and keeps switching in the URL; account-deletion error and feed status pills point there too. | ✓ VERIFIED | `client/src/pages/Accounts.tsx:206-218,236`; `client/src/pages/AccountConnections.tsx:1-33`; `client/src/utils/movedSections.ts`; `client/src/components/up/UpSyncBadge.tsx:16`; `server/src/services/accountDeletion.ts:83`; `movedSections.test.ts` (9/9), `accountDeletion.test.ts` (4/4), CI `e2e` (`accounts.spec.ts`, `up.spec.ts`, `phone/targets-phone.spec.ts`). Note non-blocking `WR-03` on 3 Enable Banking messages (outside D-09 scope). |
| 2 | **SC 2:** Opening Budget gives direct access to Categories (`BudgetCategories` under `/budget/categories`), from the Budget header on desktop/tablet, the `⋯` menu on a phone, and the empty-budget prompt. | ✓ VERIFIED | `client/src/pages/Budget.tsx` header (`Categories` `ButtonLink`), phone `More budget actions` menu (`Year`, `Categories`), and empty table (`Set up your categories`); `client/src/pages/BudgetCategories.tsx:1-27`; `PageHeader.tsx` breadcrumbs back to `/budget`; CI `e2e` (`budget.spec.ts`, `settings.spec.ts`, `phone/targets-phone.spec.ts`). |
| 3 | **SC 3:** Settings holds the remaining eight tabs (`Accounts`..`Server`) and opens on Accounts; old links with `?tab=connections` or `?tab=categories` redirect cleanly while preserving other parameters and leaving no history entry; Search palette includes `Connected banks` & `Categories` while sidebar, palette and Welcome entries stay in sync. | ✓ VERIFIED | `client/src/pages/Settings.tsx:21-57` (8 tabs, `DEFAULT_TAB = 'accounts'`, `Navigate to={movedTo} replace`); `navPages.ts` (`PALETTE_PAGES` has both, `NAV_PAGES` unchanged); `CommandPalette.tsx:72-78,144-152`; `guides/pages.ts` (`accounts` v2, `settings` v2, `guides.test.ts` 20/20); `Welcome.tsx` & `Sidebar.tsx` clean of stale settings links; CI `e2e` (`settings.spec.ts`, `command-palette.spec.ts`). Note non-blocking `IN-01` doc/JSDoc drift (`DEVELOPMENT.md:268`, `StatusStrip.tsx:20-21`). |
| 4 | **SC 4 (static & mount):** Each goal row ends with a four-stage SVG plant (`seed`, `seedling`, `bud`, `flower`), flowering only at `complete`, using `@theme` tokens only, with `aria-hidden="true"`, hidden in Safe mode, and CSS animations (`grow-in`, `bloom`, `bloom-ring`) disabled under `prefers-reduced-motion`. | ✓ VERIFIED | `client/src/components/ui/Plant.tsx:1-155` (`plantStage`, zero raw hex, `aria-hidden="true" focusable="false"`); `Plant.test.ts` (17/17); `client/src/pages/Goals.tsx:93,233-244,445-448`; `client/src/index.css:133-157,274-278`; `client/src/components/goals/growth.ts` + `growth.test.ts` (3/3); CI `e2e` (`category-goals.spec.ts`, `demo/category-goals.spec.ts`, `safe-mode.spec.ts`). |
| 5 | **SC 4 (in-place state transitions / `WR-01`):** A goal's plant grows in place when its stage changes while the page is open, and blooms once per goal per device when reaching target. | ✗ FAILED | `client/src/components/goals/GoalPlant.tsx:21` computes `const [bloom] = useState(() => complete && firstBloom(goalId));` on mount only. Active goals moving `inProgress -> completed` remount via `GoalGroup` (`Goals.tsx:359-362`), but rows staying mounted in the same group when `complete` turns `false -> true` (paused goals reaching target, manually `completed` goals edited to target, or `fundingComplete` flipping `false -> true` after mount) stay `data-bloom="false"`. Also unverified by tests: neither unit nor e2e tests drive a live in-place stage change or mounted `complete` transition without reload. |
| 6 | **SC 5 (Ready to assign hero):** At `$0` Ready to assign with `funding.resolved`, `BudgetSummaryWidget` reads `'Every dollar has a job'` beside a quiet seedling in normal text colour; when `funding` is incomplete/disagreeing/unresolved at `$0`, it never praises as `'Every dollar has a job'` or `'Fully budgeted'` and names the unresolved reason instead. | ✓ VERIFIED | `client/src/utils/fundingStatus.ts:1-149` (7 cases; `$0` always `figureClass: 'text-text'`; unresolved caveats named); `client/src/components/budget/BudgetSummaryWidget.tsx:172-206,267-312` (desktop + phone `role="status"`, `Plant stage="seedling"`); `fundingStatus.test.ts` (16/16); CI `e2e` (`budget.spec.ts` clean `$0` + overspent `$0` + 390px single-line check). |
| 7 | **WAVF-05 (`Fully budgeted` removal & guide copy / `WR-04`):** Old `'Fully budgeted'` wording is replaced across app/docs/tests and guarded by `lint/terms`. | ✗ FAILED | Capitalised `Fully budgeted` is absent across `client/src` and guarded by `lint/terms/terms.test.js:19` (`/Fully budgeted/`), **but** `client/src/userGuide/articles.tsx:405` still reads `"so the month can reach $0 and read fully budgeted"` (lowercase) because `terms.test.js:19` lacks the `/i` flag. |

### Requirement Coverage (`REQUIREMENTS.md`)

| Requirement | Plan(s) | Status | Verification Summary & Notes |
|-------------|---------|--------|-----------------------------|
| `WAVF-01` | 01, 03, 04, 07 | ✓ SATISFIED | `/accounts/connections` + `?provider=` allowlist, Accounts header + empty-state links, `UpSyncBadge` `bankFeedLink` pills, `accountDeletion.ts:83` error message, Accounts guide v2, and unit + CI e2e coverage. (`WR-02` spinner `aria-hidden` preserved from prior panel per UI-SPEC; `WR-03` 3 Enable Banking messages outside D-09 scope.) |
| `WAVF-02` | 02, 03, 04, 07 | ✓ SATISFIED | `/budget/categories` + `PageHeader` breadcrumb, Budget header `Categories` link, phone `⋯` menu entry, empty-budget link, and CI e2e coverage across desktop & 390px phone. |
| `WAVF-03` | 02, 03, 04, 07 | ✓ SATISFIED | Settings trimmed to 8 tabs defaulting to `accounts`; `?tab=connections|categories` redirect cleanly (`replace`, preserving extra query params); `PALETTE_PAGES` adds both to Search without altering sidebar; `Welcome.tsx` & `Sidebar.tsx` clean. (`IN-01` stale docs/JSDoc tracked as P2.) |
| `WAVF-04` | 05, 07, 08 | ✗ PARTIAL / GAP (`WR-01`) | 4-stage token-only SVG `Plant`, `plantStage`, `@theme` keyframes + reduced-motion disablement, Safe mode hiding, 390px sizing, and initial-mount/remount `firstBloom` work and pass tests. **Gap:** `GoalPlant.tsx:21` misses `complete: false -> true` on non-remounting rows and lacks a live stage-transition test. |
| `WAVF-05` | 06, 07, 08 | ✗ PARTIAL / GAP (`WR-04`) | `readyToAssignStatus` and `BudgetSummaryWidget` implement all 7 `$0`/unassigned/caveat states faithfully; `index.css` dropped `tick-draw`/`leaf-in`; `budget.spec.ts` covers clean & overspent `$0`. **Gap:** `client/src/userGuide/articles.tsx:405` still reads lowercase `fully budgeted`, missed by case-sensitive `lint/terms/terms.test.js:19`. |

### Decision Coverage

Automated check via `gsd-tools.cjs query check.decision-coverage-verify ".planning/phases/01-settings-split-and-good-moments" ".planning/phases/01-settings-split-and-good-moments/01-CONTEXT.md"` returned `total: 10, honored: 10, not_honored: []`. Independent spot verification against `wt-f`:

| Decision | Summary | Code / Check Evidence | Status |
|----------|---------|----------------------|--------|
| `D-01`..`D-02` | Connected banks & Categories routes, UI triggers, 8-tab Settings, redirects | `movedSections.ts`, `Settings.tsx`, `Accounts.tsx`, `Budget.tsx`, `movedSections.test.ts` | ✓ Verified |
| `D-03` | 4-stage `Plant` on `/goals`, flowers on completion, blooms once/device, grows in place | `Plant.tsx`, `Goals.tsx`, `growth.ts`, **Gap in `GoalPlant.tsx:21` (`WR-01`) for non-remounting rows** | ⚠️ Partial (`WR-01`) |
| `D-04` | Budget `$0` hero `'Every dollar has a job'` + seedling, normal colour `$0`, unresolved caveats | `fundingStatus.ts`, `BudgetSummaryWidget.tsx`, `fundingStatus.test.ts`, `budget.spec.ts` | ✓ Verified |
| `D-05`..`D-07` | Reduced motion stillness, palette-only entries + guide v2, UI copy hygiene (`articles.tsx:405` miss) | `index.css:274-278`, `navPages.ts`, `guides/pages.ts`, `articles.tsx:405` (`WR-04`) | ⚠️ Partial (`WR-04`) |
| `D-08` | `?provider=` allowlist + `BankSyncPill` deep-links via `bankFeedLink` | `movedSections.ts`, `AccountConnections.tsx`, `UpSyncBadge.tsx` | ✓ Verified |
| `D-09` | Single server change: `accountDeletion.ts` unlink hint text | `server/src/services/accountDeletion.ts:83`, `accountDeletion.test.ts:94-116` (`git diff --stat server/` confirms only these 2 server files touched) | ✓ Verified |
| `D-10` | Package release `0.2.0-up.174` + `CHANGELOG.md` + `homeassistant/config.yaml` + `docs/ui/*` | `package.json:3`, `homeassistant/config.yaml:2`, `CHANGELOG.md:3-6`, `docs/ui/MAP.md`, `HANDOVER-UI.md`, `WAVES.md` | ✓ Verified |

### Automated Checks Executed & Observed (Read-Only on `/Users/tristanvanrooyen/wt-f`, Node `v24.10.0`)

| Check | Command (in `/Users/tristanvanrooyen/wt-f`) | Result | Notes |
|-------|-------------------------------------------|--------|-------|
| Targeted client unit tests | `npm test --prefix client -- src/utils/movedSections.test.ts src/components/ui/Plant.test.ts src/components/goals/growth.test.ts src/utils/fundingStatus.test.ts src/utils/guides.test.ts` | ✓ Passed (`5/5` files, `65/65` tests) | Re-run directly at `575c3ea` |
| Full client Vitest suite | `npm test --prefix client` | ✓ Passed (`75/75` files, `611/611` tests) | Zero failures, zero skipped |
| Client TypeScript | `(cd client && npx tsc --noEmit)` | ✓ Passed (exit `0`) | Zero diagnostics |
| Client production build | `npm run build --prefix client` | ✓ Passed (exit `0`, `1.23s`) | Bundles lazy `AccountConnections`, `BudgetCategories`, `CommandPalette`, `Goals` |
| Server targeted Vitest | `npm test --prefix server -- src/routes/accountDeletion.test.ts` | ✓ Passed (`1/1` file, `4/4` tests) | Covers `Accounts → Connected banks → Up` 409 error |
| Server TypeScript | `(cd server && npx tsc --noEmit)` | ✓ Passed (exit `0`) | Zero diagnostics |
| Lint rules + contrast tests | `npm --prefix lint test` | ✓ Passed (`86/86` tests across `7` suites, `0` skipped) | Notice: `terms.test.js:19` checks case-sensitive `/Fully budgeted/` |
| ESLint (`client/src` & `server/src`) | `npm --prefix lint run lint` | ✓ Passed (`0` errors, `128` warnings at `--max-warnings=128`) | Baseline ceiling maintained |
| Release version sync | Read `package.json`, `homeassistant/config.yaml`, `CHANGELOG.md` | ✓ Consistent (`0.2.0-up.174`) | Matches `package-lock.json` diff in PR #273 |
| GitHub PR `#273` CI checks | `gh pr checks 273 --repo tvrooi/Allotment` | ✓ `17` passed, `2` skipped (`Docker/publish`, `Release/release`), `0` failing | Includes `CI/e2e (1/4)-(4/4)`, `CI/electron`, `CI/server`, `Docker/test`, `Release/build (linux/macos/windows)`, `Release/homeassistant`, `Release/verify` |

### Test Quality Audit

- **Skip / focus scan:** `grep -rnE "it\.skip|describe\.skip|test\.skip|test\.fixme|test\.only|it\.only|describe\.only"` across all Phase 01 unit tests (`movedSections.test.ts`, `Plant.test.ts`, `growth.test.ts`, `fundingStatus.test.ts`, `guides.test.ts`, `accountDeletion.test.ts`) and modified/verified e2e specs (`accounts.spec.ts`, `settings.spec.ts`, `category-goals.spec.ts`, `demo/category-goals.spec.ts`, `budget.spec.ts`, `command-palette.spec.ts`, `safe-mode.spec.ts`, `cleanup.spec.ts`, `up.spec.ts`) returned **0 matches**.
- **Strength & structural guards:**
  - `movedSections.test.ts` enforces a repo-wide `import.meta.glob` source invariant blocking hardcoded `/accounts/connections`, `/budget/categories`, `tab=connections`, or `tab=categories` outside `movedSections.ts` and tests.
  - `Plant.test.ts` checks `plantStage` boundaries (`24/25/69/70/100`), never-flower before `complete`, SVG accessibility attributes (`aria-hidden="true"`, `focusable="false"`), and absence of hardcoded hex colors.
  - `fundingStatus.test.ts` verifies all 7 states cleanly (clean `$0`, unassigned positive, over-assigned negative, missing rates, account disagreements, overspent/uncategorised/card shortfall caveats, undefined funding).
  - `e2e/tests/category-goals.spec.ts`, `budget.spec.ts`, `accounts.spec.ts`, `settings.spec.ts`, `command-palette.spec.ts`, `safe-mode.spec.ts`, `phone/targets-phone.spec.ts` assert role-based locators, URL/history replacement (`goBack()`), reduced-motion computed `animation-name: none`, 390px single-line wrap metrics, and `scrollWidth <= innerWidth`.
- **Coverage gap (linked to `WR-01`):** No test exercises a mounted `GoalRow` / `GoalPlant` transitioning `pct` across stage thresholds or `complete: false -> true` in place without reload/remount.
- **Test-guard gap (linked to `WR-04`):** `lint/terms/terms.test.js:19` uses case-sensitive `/Fully budgeted/`, missing lowercase `"fully budgeted"` in `client/src/userGuide/articles.tsx:405`.

### Anti-Patterns & Non-Blocking Findings Scanned

| Severity | Finding | Location | Classification |
|----------|---------|----------|----------------|
| Gap (P1) | `GoalPlant` captures `firstBloom(goalId)` only inside `useState` initializer on mount | `client/src/components/goals/GoalPlant.tsx:21` | **Blocks SC 4 (`WR-01`)** for non-remounting rows + lacks live transition test |
| Gap (P1/P2) | Lowercase `'fully budgeted'` remains in Budget user-guide article; `terms.test.js` guard is case-sensitive | `client/src/userGuide/articles.tsx:405`, `lint/terms/terms.test.js:19` | **Blocks WAVF-05 hygiene (`WR-04`)** |
| Warning (P2) | Enable Banking server error strings still point to `Settings → Connected banks` | `server/src/services/enableBankingService.ts:71,73`, `server/src/services/enableBankingSyncService.ts:435` | Non-blocking (phase limited server edits to `accountDeletion.ts` by `D-09`; track for follow-up) |
| Info (P2) | `ConnectedBanks` loading spinner is `aria-hidden` without `role="status"` / screen-reader label | `client/src/components/accounts/ConnectedBanks.tsx:99-105` | Non-blocking (`WR-02`; matches pre-existing `ConnectionsPanel` per `01-UI-SPEC.md`) |
| Info (P2) | Stale prose references to old Settings tabs | `docs/DEVELOPMENT.md:268`, `client/src/components/dashboard/StatusStrip.tsx:20-21` | Non-blocking (`IN-01` documentation staleness) |
| Clean | No `TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`, no raw hex in `Plant.tsx`, old `@keyframes tick-draw`/`leaf-in` removed | Phase 01 changed files, `client/src/index.css` | Verified clean |

## Human Verification Required

All 32 screenshots exist in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (28 screen shots across light/dark at 1280px and 390px + 4 stage PNGs) and `.ui-evidence/` is confirmed gitignored (`.gitignore:52`). None are gaps, as visual aesthetics and hover/motion feel require owner inspection:

1. **Owner screenshot review (`01-01-PLAN`, `01-05-PLAN`, `01-06-PLAN`, `01-08-PLAN`):** Open `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (and attach to a PR `#273` comment without committing) and verify:
   - Accounts header wraps cleanly into two lines at 390 px in light and dark, and Connected banks places the provider toggle directly below its breadcrumb header.
   - Goals (`"New laptop"` + 4 stages) are clearly distinguishable at 100% zoom at 1280 px and 390 px and feel cohesive with Allotment's sprout logo.
   - Budget `$0` hero (`Ready to assign`): `$0` in normal text colour anchors the card, `"Every dollar has a job"` + small seedling feel quietly encouraging, and caveat rows read as calm jobs to do rather than praise or alarm.
2. **Hover-state legibility (`01-UI-REVIEW` / `01-05-PLAN`):** Hover a reached goal row on `/goals` in light and dark mode to verify petal/stem legibility over `--color-hover` (not photographed in `.ui-evidence`).
3. **Live animation timing:** Reach a goal target in a live browser session under normal motion (`320ms` grow-in, `560ms` bloom, `720ms` ring) and OS reduced motion (`prefers-reduced-motion: reduce`).

## Gaps Summary

Two concrete, easily scoped code/copy gaps remain before Phase 01 can be marked `passed` / `human_needed`:
1. **`WR-01` (`client/src/components/goals/GoalPlant.tsx:21`):** Update `GoalPlant` to react to `complete` transitioning `false -> true` while a row stays mounted (e.g., via `useEffect`), reset ephemeral bloom state if `complete` drops back to `false`, and add a test covering an in-place stage/completion transition without page reload.
2. **`WR-04` (`client/src/userGuide/articles.tsx:405`, `lint/terms/terms.test.js:19`):** Replace `"reach $0 and read fully budgeted"` with `"Every dollar has a job"` wording in `articles.tsx:405` and add the `/i` flag to `/Fully budgeted/` in `lint/terms/terms.test.js:19`.

_(Non-blocking follow-ups recorded: `WR-03` Enable Banking error copy in `enableBankingService.ts:71,73` & `enableBankingSyncService.ts:435`; `IN-01` `docs/DEVELOPMENT.md:268` & `StatusStrip.tsx:20-21`; `WR-02` `ConnectedBanks.tsx:99-105` loading accessibility.)_
