---
phase: 01-settings-split-and-good-moments
verified: 2026-11-16T18:11:00+11:00
status: human_needed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
target_repo: /Users/tristanvanrooyen/wt-f
target_branch: wave-f
target_commit: ad269035da8e0016272b8bbe801119e73a5bde34
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
  - .planning/phases/01-settings-split-and-good-moments/01-09-PLAN.md
  - .planning/phases/01-settings-split-and-good-moments/01-09-SUMMARY.md
  - .planning/phases/01-settings-split-and-good-moments/01-CONTEXT.md
  - .planning/phases/01-settings-split-and-good-moments/01-REVIEW-DISPOSITION.md
  - .planning/phases/01-settings-split-and-good-moments/01-REVIEW.md
  - .planning/phases/01-settings-split-and-good-moments/01-UI-REVIEW.md
  - .planning/phases/01-settings-split-and-good-moments/01-UI-SPEC.md
  - .planning/phases/01-settings-split-and-good-moments/01-VALIDATION.md
covered_digest: v4:sha256:afb20cbce1f8a12c4483dd4b8c235f67eec4afe26e37aefc6afc63ab2147797e
re_verification:
  previous_status: gaps_found
  previous_score: 13/15
  gaps_closed:
    - "A goal's plant grows in place when its stage changes while the page is open, and the flower blooms once per goal per device (SC 4 / WAVF-04 / D-03 / WR-01)"
    - "The retired $0 Ready to assign wording ('Fully budgeted') leaves client/src user-facing copy and is guarded case-insensitively (WAVF-05 / Plan 07 / WR-04)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "At 390 px, in light and dark, inspect the Accounts header and Connected banks screenshots in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (attach images to a PR #273 comment; never commit)."
    expected: "The Accounts header reads as two tidy lines and the Connected banks page has the provider toggle directly under the header."
    why_human: "Visual layout quality, two-line balance, and spacing require human visual judgement."
  - test: "In the screenshots of Goals (\"New laptop\") at 1280 px and 390 px, light and dark, plus live hover over a reached goal row on `/goals`."
    expected: "The four stages are told apart at 100% zoom, the flower reads clearly on both the row and its hover colour (`--color-hover`, not captured in `.ui-evidence`), and the plant looks like part of the brand (the logo's sprout), not an ornament."
    why_human: "Silhouette legibility at 100% zoom, brand cohesion, and hover-row contrast require human visual inspection."
  - test: "In the screenshots of the Budget hero at $0, clean and with a caveat, light and dark, 1280 px and 390 px."
    expected: "The $0 figure is the anchor in normal text colour, the clean line reads as quiet encouragement with the small seedling, and the caveat reads as a job to do, not as praise or an alarm."
    why_human: "Typography hierarchy, emotional tone, and brand voice require human judgement."
  - test: "Open `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` and review the plant stages and flower, the $0 hero clean and with a caveat, the two new pages (`/accounts/connections`, `/budget/categories`), and the shorter Settings, in light and dark at both sizes (plus live browser playback of `--animate-grow-in` / `--animate-bloom` / `--animate-bloom-ring` with normal motion and OS reduced motion)."
    expected: "All 32 screenshots satisfy the 01-VALIDATION.md manual checks, and live CSS transitions feel smooth under normal motion and render still without jitter under OS reduced motion."
    why_human: "End-to-end visual sign-off across all 32 PNGs and perceived CSS animation timing require human observation."
---

# Phase 01: Settings split and good moments — Re-Verification Report

**Phase Goal:** The owner reaches bank connections and categories where they think of them (Accounts and Budget), Settings is shorter, and the app marks a completed goal and a fully assigned month in the brand voice.
**Verified:** 2026-11-16T18:11:00+11:00
**Status:** human_needed
**Score:** 15/15 must-haves verified
**Re-verification:** Yes — after gap closure (Plan `01-09` + review follow-up `9149547`..`ad26903`)
**Target Checkout:** `/Users/tristanvanrooyen/wt-f` (branch `wave-f`, commit `ad269035da8e0016272b8bbe801119e73a5bde34`, PR `#273` OPEN against `redesign`)

> [!IMPORTANT]
> **Verification Scope Boundary:** Working directory `/Users/tristanvanrooyen/Github/Allotment` (branch `redesign`) holds Phase 01 `.planning` artifacts over older `redesign` source. Every code, build, unit, type, lint, Playwright, and PR check below was executed read-only against `/Users/tristanvanrooyen/wt-f` at `ad269035da8e0016272b8bbe801119e73a5bde34` on Node `v24.10.0`. Per owner decision recorded for this re-verification, `WR-02`, `WR-03`, and `IN-01` are recorded deferrals (`01-REVIEW-DISPOSITION.md`), and the advisory post-phase audits (`01-VALIDATION.md`, `01-SECURITY.md`, `01-UI-REVIEW.md`) were not re-run.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + Plan Must-Haves)

| # | Truth / Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | **SC 1 (`WAVF-01`):** Opening Accounts gives direct access to Connected banks (and the empty state lets a user connect a bank), with Up reachable in fewer clicks; `/accounts/connections` honours `?provider=` (`up`, `plaid`, `simplefin`, `enablebanking`, falling back to `up`) and keeps switching in the URL; account-deletion error and feed status pills point there too. | ✓ VERIFIED | Regression check in `wt-f`: files unchanged since `575c3ea` (`AccountConnections.tsx`, `Accounts.tsx`, `movedSections.ts`, `UpSyncBadge.tsx`, `accountDeletion.ts`); `client` suite `76/76` (`617/617`), `accountDeletion.test.ts` `4/4`, CI `e2e (1/4)-(4/4)` green on `ad26903`. Non-blocking `WR-03` (3 Enable Banking strings) deferred by owner. |
| 2 | **SC 2 (`WAVF-02`):** Opening Budget gives direct access to Categories (`BudgetCategories` under `/budget/categories`), from the Budget header on desktop/tablet, the `⋯` menu on a phone, and the empty-budget prompt. | ✓ VERIFIED | Regression check in `wt-f`: `Budget.tsx`, `BudgetCategories.tsx`, `PageHeader.tsx` unchanged since `575c3ea`; `client` build + `76/76` tests + CI `e2e` green on `ad26903`. |
| 3 | **SC 3 (`WAVF-03`):** Settings holds the remaining eight tabs (`Accounts`..`Server`) and opens on Accounts; old links with `?tab=connections` or `?tab=categories` redirect cleanly while preserving other parameters and leaving no history entry; Search palette includes `Connected banks` & `Categories` while sidebar, palette and Welcome entries stay in sync. | ✓ VERIFIED | Regression check in `wt-f`: `Settings.tsx`, `navPages.ts`, `CommandPalette.tsx`, `guides/pages.ts` unchanged since `575c3ea`; `client` `76/76` + CI `e2e` green on `ad26903`. Non-blocking `IN-01` deferred by owner. |
| 4 | **SC 4 (static & mount / `WAVF-04`):** Each goal row ends with a four-stage SVG plant (`seed`, `seedling`, `bud`, `flower`), flowering only at `complete`, using `@theme` tokens only, with `aria-hidden="true"`, hidden in Safe mode, and CSS animations (`grow-in`, `bloom`, `bloom-ring`) disabled under `prefers-reduced-motion`. | ✓ VERIFIED | `Plant.tsx:1-155` unchanged since `575c3ea`; `Goals.tsx:240,445-448` unchanged; `e2e/tests/category-goals.spec.ts` `10/10` passed directly at `ad26903` (including `Laptop` mount/reload and reduced-motion `animation-name: none`); `client` `76/76` passed. |
| 5 | **SC 4 (in-place growth, bloom once per device, abandoned-mount safety / `WR-01`):** A goal's plant grows in place when its stage changes while the page is open (`data-motion`), blooms once per goal per device when reaching target whether mounted reached or reached in place, never replays after dipping and returning, and never consumes a bloom on an interrupted/uncommitted render. | ✓ VERIFIED | **Gap closed (`d5216fb`..`ad26903`):** `growth.ts:31-40` exports `nextBloom(goalId, wasComplete, complete, bloom)`; `GoalPlant.tsx:26-32` initializes `bloom` to `false` and `seen` ref to `{ complete: false, bloom: false }`, deciding bloom only inside `useLayoutEffect([goalId, complete])` via `nextBloom`. `growth.test.ts:44-89` (5 `nextBloom` cases), `GoalPlant.test.ts:1-28` (`renderToStaticMarkup` writes `0` keys), and `e2e/tests/category-goals.spec.ts:178-213` (`Tent` in-place growth/bloom + reload, `Kayak` dip-and-return) all pass directly at `ad26903`. |
| 6 | **SC 5 (Ready to assign hero / `WAVF-05`):** At `$0` Ready to assign with `funding.resolved`, `BudgetSummaryWidget` reads `'Every dollar has a job'` beside a quiet seedling in normal text colour; when `funding` is incomplete/disagreeing/unresolved at `$0`, it names the unresolved reason instead. | ✓ VERIFIED | Regression check in `wt-f`: `fundingStatus.ts`, `BudgetSummaryWidget.tsx` unchanged since `575c3ea`; `client` `76/76` + CI `e2e` green on `ad26903`. |
| 7 | **WAVF-05 (`Fully budgeted` removal & guide copy / `WR-04`):** Old `'Fully budgeted'` wording is replaced across app/docs and guarded case-insensitively by `lint/terms`. | ✓ VERIFIED | **Gap closed (`22c5e94`..`1b6f5f6`):** `client/src/userGuide/articles.tsx:405` now reads `so the month can reach $0 and read “Every dollar has a job”`; `docs/ENVELOPE-FUNDING.md:86` and `docs/BUDGET-REVIEW.md:31` updated; `lint/terms/terms.test.js:19` uses `[/Fully budgeted/i, 'Every dollar has a job']`. `npm --prefix lint test` passes `86/86` and `grep -rniE "fully[ -]budgeted" client/src server/src` returns 0 matches. |

**Score:** 15/15 must-haves verified (0 failed, 0 behavior-unverified)

### Advisory (New Scope, Unevidenced)

None.

### Required Artifacts (Plan `01-09` Gap Closure + Regression Sanity)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `client/src/components/goals/growth.ts` | Exports `BLOOMED_KEY`, `firstBloom`, `nextBloom`; `flybudget:goals-bloomed` & `MAX_REMEMBERED` preserved | ✓ VERIFIED | `nextBloom` exported (`growth.ts:31-40`), delegates rising edge to unchanged `firstBloom` (`growth.ts:13-23`), `BLOOMED_KEY` unchanged (`growth.ts:6`). |
| `client/src/components/goals/growth.test.ts` | Preserves 3 `firstBloom` tests + adds `nextBloom` unit tests | ✓ VERIFIED | Lines `4-41` intact; lines `44-89` cover first sight, dip/return, steady reached without storage access, not reached, and blocked storage. |
| `client/src/components/goals/GoalPlant.tsx` | `bloom` state follows `complete` via ref + `useLayoutEffect` calling `nextBloom`; `shown`/`grew` preserved | ✓ VERIFIED | `GoalPlant.tsx:26-39`; never calls `firstBloom`/`nextBloom` in render or state updater; `Goals.tsx:317` keys `GoalRow` by `goal.id`. |
| `client/src/components/goals/GoalPlant.test.ts` | Regression test that uncommitted/static render records no bloom | ✓ VERIFIED | Lines `1-28` render reached goal with `renderToStaticMarkup` and assert `data-stage="flower"` and `store.size === 0`. |
| `e2e/tests/category-goals.spec.ts` | Adds 2 paused-goal in-place tests without altering/skipping/loosening existing tests | ✓ VERIFIED | Lines `178-213` add `in place (#241)` and `does not bloom again (#241)`; `0` deleted lines and `0` `skip`/`fixme`/`waitForTimeout`/`retries` in diff since `575c3ea`. |
| `lint/terms/terms.test.js` | Case-insensitive `/Fully budgeted/i` RETIRED row (1-line diff) | ✓ VERIFIED | Line `19` is `[/Fully budgeted/i, 'Every dollar has a job']`. |
| `client/src/userGuide/articles.tsx` | Hold section names `"Every dollar has a job"` | ✓ VERIFIED | Line `405` reads `so the month can reach $0 and read “Every dollar has a job”`. |
| `docs/ENVELOPE-FUNDING.md`, `docs/BUDGET-REVIEW.md` | Living docs aligned with `"Every dollar has a job"` | ✓ VERIFIED | `ENVELOPE-FUNDING.md:86` and `BUDGET-REVIEW.md:31` updated (`1` match each). |
| Phase `01-01`..`01-08` key files (`AccountConnections.tsx`, `BudgetCategories.tsx`, `Settings.tsx`, `Accounts.tsx`, `Budget.tsx`, `Goals.tsx`, `movedSections.ts`, `fundingStatus.ts`, `Plant.tsx`, `accountDeletion.ts`) | Present and unregressed in `wt-f` | ✓ VERIFIED | All exist in `wt-f`; `git diff 575c3ea..ad26903` did not modify `Goals.tsx`, `Plant.tsx`, `server/`, `package.json`, `package-lock.json`, `homeassistant/config.yaml`, or `CHANGELOG.md`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `client/src/components/goals/GoalPlant.tsx` | `client/src/components/goals/growth.ts` | `useLayoutEffect([goalId, complete])` calling `nextBloom(goalId, seen.current.complete, complete, seen.current.bloom)` | ✓ WIRED | `GoalPlant.tsx:28-32` updates `seen.current` and `setBloom(next)` before paint; `Goals.tsx:240` passes `goalId={goal.id}` on `key={goal.id}` rows (`Goals.tsx:317`). |
| `client/src/components/goals/growth.ts` | `client/src/components/goals/growth.ts` | `nextBloom` calls `firstBloom(goalId)` only on rising edge (`!wasComplete && complete`) | ✓ WIRED | `growth.ts:37-39`; steady `wasComplete && complete` returns `bloom` without storage I/O. |
| `lint/terms/terms.test.js` | `client/src/userGuide/articles.tsx` | `RETIRED` pattern `/Fully budgeted/i` scans all non-test `.ts`/`.tsx` files in `client/src` and `server/src` | ✓ WIRED | `terms.test.js:19,38-51`; `npm --prefix lint test` (`86/86`) fails on lowercase `fully budgeted` and passes on updated `articles.tsx:405`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `GoalPlant.tsx` | `bloom` | `useLayoutEffect` -> `nextBloom` -> `firstBloom` reading/writing `localStorage[flybudget:goals-bloomed]` + `Goals.tsx` `complete` (`remaining === 0 && targetAmount > 0 && fundingComplete !== false`) | Yes | ✓ FLOWING |
| `GoalPlant.tsx` | `stage` | `plantStage(pct, complete)` fed by `progressOf(goal)` in `Goals.tsx` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks (Executed in `/Users/tristanvanrooyen/wt-f` at `ad26903`, Node `v24.10.0`)

| Behavior / Check | Command | Result | Status |
| ---------------- | ------- | ------ | ------ |
| Client full unit suite (incl. `growth.test.ts`, `GoalPlant.test.ts`, `Plant.test.ts`, `movedSections.test.ts`, `fundingStatus.test.ts`, `guides.test.ts`) | `npm test --prefix client` | `76/76` files, `617/617` tests passed | ✓ PASS |
| Client TypeScript & production build | `(cd client && npx tsc --noEmit) && npm run build --prefix client` | Exit `0`; built in `771ms` | ✓ PASS |
| Desktop Goals e2e spec (in-place growth/bloom, dip/return, mount/reload, reduced motion, 390px) | `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts` | `10 passed (26.3s)`, `0` failed/skipped | ✓ PASS |
| E2E TypeScript | `(cd e2e && npx tsc --noEmit)` | Exit `0` | ✓ PASS |
| Server TypeScript & account deletion test | `(cd server && npx tsc --noEmit) && npm test --prefix server -- src/routes/accountDeletion.test.ts` | Exit `0`; `1/1` file, `4/4` tests passed | ✓ PASS |
| Retired terms & contrast suite | `npm --prefix lint test` | `86/86` tests passed across `7` suites (`0` failed, `0` skipped) | ✓ PASS |
| ESLint ceiling | `npm --prefix lint run lint` | `0` errors, `128` warnings (at `--max-warnings=128`) | ✓ PASS |
| Retired label grep in app source | `grep -rniE "fully[ -]budgeted" client/src server/src` | Exit `1` (0 matches) | ✓ PASS |
| PR `#273` CI & untouched release/merge invariants | `gh pr view 273`, `gh pr checks 273`, `gh issue view 241`, `gh issue view 244`, `git tag -l`, `git ls-remote --tags origin` | PR `OPEN` (`redesign <- wave-f`, `ad26903`, has `Gap closure, 15 November 2026`); `17` CI checks passed (`CI/e2e (1/4)-(4/4)`, `CI/client`, `CI/server`, `CI/lint`, `CI/electron`, `Docker/test`, `Release/build`, `Release/homeassistant`, `Release/verify`), `2` skipped (`Docker/publish`, `Release/release`); issues `241` & `244` `OPEN`; tag `v0.2.0-up.174` absent locally & remotely | ✓ PASS |

### Requirements Coverage (`REQUIREMENTS.md`)

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| `WAVF-01` | 01, 02, 04, 07, 08 | Open Connected banks from Accounts; reach Up in <3 clicks; provider deep-links | ✓ SATISFIED | Unregressed from verified `575c3ea`; `client` `76/76` + CI `e2e` green on `ad26903`. (`WR-02`, `WR-03` recorded deferrals.) |
| `WAVF-02` | 03, 07, 08 | Manage Categories from Budget area instead of Settings tab | ✓ SATISFIED | Unregressed from verified `575c3ea`; `client` `76/76` + CI `e2e` green on `ad26903`. |
| `WAVF-03` | 01, 02, 03, 04, 07, 08 | Settings shows remaining 8 tabs; redirects, palette, Welcome & guides work | ✓ SATISFIED | Unregressed from verified `575c3ea`; `client` `76/76` + `accountDeletion.test.ts` `4/4` + CI `e2e` green on `ad26903`. (`IN-01` recorded deferral.) |
| `WAVF-04` | 05, 07, 08, 09 | Brand-voice sprout/flower moment on reached goal; light/dark, 390px, Safe mode, reduced motion, in-place bloom once/device | ✓ SATISFIED | `WR-01` closed: `nextBloom` + `GoalPlant` `useLayoutEffect`; `GoalPlant.test.ts` (`1/1`), `growth.test.ts` (`8/8`), `Plant.test.ts` (`17/17`), and `category-goals.spec.ts` (`10/10`) pass at `ad26903`. Visual check routed to human verification. |
| `WAVF-05` | 06, 07, 08, 09 | $0 Ready to assign brand-voice acknowledgement, unresolved caveats, normal zero colour, no unqualified `'Fully budgeted'` | ✓ SATISFIED | `WR-04` closed: `articles.tsx:405`, `docs/ENVELOPE-FUNDING.md:86`, `docs/BUDGET-REVIEW.md:31` updated; `lint/terms/terms.test.js:19` uses `/Fully budgeted/i`; `86/86` lint tests pass; `0` matches in `client/src` or `server/src`. Visual check routed to human verification. |

### Anti-Patterns & Recorded Deferrals

| Severity | Finding | Location | Classification |
| -------- | ------- | -------- | -------------- |
| Clean | Debt/stub scan (`TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`), skipped/slept tests, and `01-09` prohibition checks across `575c3ea..ad26903` | `client/src/components/goals/*`, `client/src/userGuide/articles.tsx`, `lint/terms/terms.test.js`, `e2e/tests/category-goals.spec.ts` | Verified clean (`0` matches; `0` removed lines in `category-goals.spec.ts`; `0` unexpected diffs) |
| Deferred (P2) | Enable Banking server error strings still point to `Settings → Connected banks` | `server/src/services/enableBankingService.ts:71,73`, `enableBankingSyncService.ts:435` | `WR-03` — owner-deferred (`01-REVIEW-DISPOSITION.md`) |
| Deferred (P2) | `ConnectedBanks` loading spinner is `aria-hidden` without status text | `client/src/components/accounts/ConnectedBanks.tsx:99-105` | `WR-02` — owner-deferred (`01-REVIEW-DISPOSITION.md`) |
| Deferred (P2) | Stale prose references to old Settings tabs | `docs/DEVELOPMENT.md:268`, `client/src/components/dashboard/StatusStrip.tsx:20-21` | `IN-01` — owner-deferred (`01-REVIEW-DISPOSITION.md`) |

### Human Verification Required

All 32 screenshots remain present in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` (gitignored; `git ls-files .planning .ui-evidence .omc` = `0`). The four visual/subjective checks below are harvested from `01-01-PLAN.md`, `01-05-PLAN.md`, `01-06-PLAN.md`, `01-08-PLAN.md`, and `01-UI-REVIEW.md`:

### 1. Accounts 390 px Header & Connected Banks Provider Toggle (`01-01-PLAN`)

**Test:** Inspect the 390 px light and dark screenshots of Accounts and Connected banks in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/`.
**Expected:** At 390 px, in light and dark, the Accounts header reads as two tidy lines and the Connected banks page has the provider toggle directly under the header.
**Why human:** Visual layout quality, two-line balance, and spacing require human visual judgement.

### 2. Goals Plant Stages, Hover Contrast & Brand Cohesion (`01-05-PLAN` / `01-UI-REVIEW`)

**Test:** Inspect the Goals ("New laptop") screenshots at 1280 px and 390 px in light and dark, and hover over a reached goal row on `/goals` in a live browser.
**Expected:** In the screenshots of Goals ("New laptop") at 1280 and 390 px, light and dark: the four stages are told apart at 100% zoom, the flower reads on both the row and its hover colour (`--color-hover`), and the plant looks like part of the brand (the logo's sprout), not an ornament.
**Why human:** Silhouette legibility at 100% zoom, brand cohesion, and `--color-hover` row contrast (not captured in `.ui-evidence`) require human visual inspection.

### 3. Budget `$0` Hero Tone & Visual Hierarchy (`01-06-PLAN`)

**Test:** Inspect the Budget hero screenshots at `$0` (clean and with a caveat) at 1280 px and 390 px in light and dark.
**Expected:** The figure is the anchor in normal text colour, the clean line reads as quiet encouragement with the small seedling, and the caveat reads as a job to do, not as praise or an alarm.
**Why human:** Typography hierarchy, emotional tone, and brand voice require human judgement.

### 4. Full Screenshot Sign-Off, PR Evidence Attachment & Live Motion Feel (`01-08-PLAN`)

**Test:** Open `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/` and look at the plant stages and the flower, the $0 hero clean and with a caveat, the two new pages and the shorter Settings, in light and dark at both sizes (and optionally observe live `--animate-grow-in` / `--animate-bloom` / `--animate-bloom-ring` playback in normal and OS reduced motion). Attach selected images to a PR `#273` comment (never commit).
**Expected:** All three manual checks in `01-VALIDATION.md` look right and live animations feel smooth under normal motion and still under reduced motion.
**Why human:** Aesthetic sign-off across all 32 PNGs and perceived CSS animation feel require human observation.

---

_Verified: 2026-11-16T18:11:00+11:00_
_Verifier: Gemini 4 Hydrogen via Antigravity (gsd-verifier), dispatched through hdispatch_
