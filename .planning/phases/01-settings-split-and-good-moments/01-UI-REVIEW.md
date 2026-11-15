# Phase 1 — UI Review

**Audited:** 2026-11-15
**Baseline:** Approved `01-UI-SPEC.md`, with the recorded decisions and deviations in `01-CONTEXT.md` and plans 01-01 through 01-08.
**Screenshots:** Existing captures reviewed: all 32 PNGs in `/Users/tristanvanrooyen/wt-f/.ui-evidence/2026-11-14-wave-f/`, light/dark at 1280 and 390 px. No new captures; localhost ports 3000, 5173 and 8080 were unavailable.
**Interaction captures:** off (`interaction_capture: false`). Interaction findings below are code-derived, not observations from a live browser.
**Implementation audited:** `/Users/tristanvanrooyen/wt-f`, branch `wave-f`, HEAD `575c3ea48bd32f791a1417762140a1a7bd482c0a`; scope determined by `git diff --name-only origin/redesign..wave-f` (72 files). This planning worktree's old client was not audited.

No application files were changed. No server, e2e run, or persistent browser was started. Existing evidence is git-ignored (`git check-ignore` verified); screenshots were neither copied nor staged. The task's narrower write scope supersedes creating a new screenshot directory and `.gitignore` here.

---

## Pillar Scores

| Pillar               | Score | Key Finding                                                                                                                     |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Copywriting       | 4/4   | New destinations and clean/caveat labels match the contract; unavailable funding correctly withholds praise.                    |
| 2. Visuals           | 3/4   | Saved layouts have clear hierarchy, but Connected banks captures show the demo substitute, not the specified provider controls. |
| 3. Color             | 4/4   | Token-based plants, neutral zero figures and legible light/dark hero text match the contract.                                   |
| 4. Typography        | 4/4   | Shared heading, subtitle and metadata roles are retained; no new font or weight system.                                         |
| 5. Spacing           | 4/4   | Shared gutters, two-column plant alignment and phone header wrapping are present in code and saved renders.                     |
| 6. Experience Design | 2/4   | Mount-only bloom state misses/repeats in-place celebrations; the documented silent loading spinner remains.                     |

**Overall: 21/24**

Scores apply to the phase changes, not every inherited control on these pages. A positive finding justifies each passing pillar; missing evidence is identified separately from a demonstrated product defect. No task-blocking defect or pillar score of 1 was found. This report is evidence for the orchestrator, not release approval.

---

## Top 3 Priority Fixes

1. **WARNING / P1 — Decide bloom eligibility when a goal becomes complete, not only on mount.** A paused or manually completed goal can reach its target without blooming, or bloom repeatedly after dropping below its target and recovering. Update the transition handling in `client/src/components/goals/GoalPlant.tsx:21` to consume `firstBloom(goalId)` on each entry into the flower stage and retain that decision for that transition. Add regression coverage for a row that stays mounted.
2. **WARNING / P1 — Announce bank-panel loading.** At `client/src/components/accounts/ConnectedBanks.tsx:101`, a pending bank query produces only an aria-hidden spinner. Add a status region with “Checking your bank connections…” and verify its accessible text while a query is pending. This is the already documented 01-01 limitation, not an undiscovered deviation.
3. **WARNING — Complete the missing visual evidence.** Capture the real provider toggle/setup surface at 390 px in both themes, Budget at 768–1024 px with its new Categories action, and plant stages on the row hover colour. The existing images cannot establish those acceptance checks. Do this later in an isolated, authorized browser run; the current assignment explicitly forbids starting one.

There are two code recommendations and one verification recommendation; no additional minor recommendations.

---

## Detailed Findings

All application file references below are relative to `/Users/tristanvanrooyen/wt-f`, at the audited HEAD.

### Pillar 1: Copywriting (4/4)

**Positive finding:** The new pages name their destinations consistently. `pages/AccountConnections.tsx:20` and `pages/BudgetCategories.tsx:15` use the required titles, breadcrumbs and subtitles. `pages/Accounts.tsx:206` uses “Connected banks” for navigation and retains “Connect a bank” for the empty state. `pages/Budget.tsx:1457` replaces the old Settings instruction with “Set up your categories”. The screenshots show sentence-case headings without competing descriptions of the same destination.

`utils/fundingStatus.ts:67` defines the three single-cause caveats; `:122` selects the clean label only when the summary is resolved, and `:135` selects the count/fallback caveat. `components/budget/BudgetSummaryWidget.tsx:194` retains the separate explanation and Review link. Both clean/caveat screenshots at both widths communicate the difference without describing overspending as success.

The no-summary branch at `utils/fundingStatus.ts:118` deliberately shows no label and a neutral background. This is the recorded 01-06 deviation and is preferable to claiming a resolved budget while its summary is unavailable. It is not a new finding. The unchanged currency formatter renders `$0`, not the contract's illustrative `$0.00`; no formatting regression is inferred.

The route wording changes in `guides/pages.ts`, `userGuide/articles.tsx`, the transaction deletion explanations, and the bank-link callers point to the new homes. No generic new “Submit”, “OK”, or “Click here” action was introduced. The loading announcement recommendation is counted once under Experience Design.

### Pillar 2: Visuals (3/4)

**Positive finding:** `accounts-header-{1280,390}-{light,dark}.png` shows the new secondary link beside the primary Add account button. At 390 px, title/sync status and actions occupy two tidy lines. The eight Settings tabs and their scroll cue remain recognizable in `settings-*.png`. The budget hero still gives the figure visual priority over its qualifying text.

The four silhouettes in `components/ui/Plant.tsx:99` are distinguishable in the saved stage renders at their displayed size; the demo's New laptop has a flower and “Goal reached” in both themes and widths. `pages/Goals.tsx:232` groups each plant with its bar. The decorative SVG is aria-hidden and nonfocusable (`components/ui/Plant.tsx:85`), leaving the text status as the accessible signal. The plant introduces no competing control.

**WARNING — Evidence gap, not a claim of broken layout:** All four `accounts-connections-*.png` show the demo Up card, disabled Connect Up and explanatory download panel. `components/accounts/ConnectedBanks.tsx:42` explicitly selects that separate demo render. They therefore do not show the real provider group at `:112`, its selected state, its horizontal scrolling, or the setup forms. The UI-SPEC calls that toggle the page's focal point; 01-01-PLAN's human check specifically asks for it at 390 px. Existing e2e source verifies provider navigation, but that is not a rendered visual check of these controls.

The same evidence follow-up should cover the Budget action group at 768–1024 px and plant hover backgrounds. The available widths are only 1280 and 390. The hover omission is explicitly acknowledged in 01-08-SUMMARY; no hover appearance is claimed here. These gaps limit visual sign-off rather than proving failure at the unobserved sizes/states.

### Pillar 3: Color (4/4)

**Positive finding:** The new plant uses only semantic/theme classes. Static source counts in `components/ui/Plant.tsx`: `fill-positive` 1, `stroke-positive` 3, `stroke-border` 1, `fill-text-tertiary` 1, `fill-brand-500` 3 and `fill-brand-700` 1. These are source occurrences, not rendered-element counts: the petal loop renders five petals. No hard-coded plant colour or new colour token was added.

`utils/fundingStatus.ts:100` assigns `text-text` to a zero figure. The clean hero uses positive text; the caveat uses `text-text font-medium text-pretty` (`:142`). Both light/dark screenshot sets show that distinction. Missing exchange rates and account issues retain caution treatment and replace the figure with words; they do not display a coloured numeric zero (`components/budget/BudgetSummaryWidget.tsx:161`).

Computed from the actual CSS token values, the hero's foreground/background contrast ratios are 5.06:1 light and 5.97:1 dark for positive text, and 13.70:1 light and 10.97:1 dark for the neutral zero/caveat. Breadcrumb tertiary text against the page token is 5.17:1 light and 6.96:1 dark. These are token calculations, not browser pixel measurements.

Across the 25 touched non-test TSX files, the raw scan finds 25 `text-brand-600`, 15 `text-brand-700`, 6 `bg-brand-600`, 2 `bg-brand-500`, 3 `fill-brand-500` and 1 `fill-brand-700` occurrences. Most belong to inherited content. The screenshots remain predominantly neutral surfaces, with accent reserved for controls and small plant/bar details. A literal 60/30/10 pixel ratio was not measured and is not asserted. The orange category-group outlines are inherited unchanged, as 01-08-SUMMARY records; they are not charged to this phase.

### Pillar 4: Typography (4/4)

**Positive finding:** Both new pages use `PageHeader`, whose `text-title max-md:text-2xl font-display` heading and `text-sm` subtitle are at `components/ui/PageHeader.tsx:48`. `index.css:189` defines the 28/36 px title role, and `:345` fixes display weight at 500. Breadcrumbs use `text-xs`; goal labels retain `text-xs`, with `font-medium` only for the reached status. The hero keeps the existing phone `text-nav` role and figure weights.

The full touched-file scan finds `text-sm` 106, `text-xs` 82, `text-nav` 13, `text-base` 13, `text-title` 7, responsive `text-2xl` 7, `text-2xs` 4, `text-lg` 2 and `text-xl` 1 occurrences. Weight classes are medium 62, semibold 42, normal 2, display 6 and bold 6. These counts include unchanged tables, guides and panels; treating them as newly introduced roles would falsely fail the contract. New page/plant/status markup stays within the approved existing roles and weights.

Impeccable's static detector ran once over the changed client source files. Its sole result was `overused-font` at `index.css:357` for Inter (exit 2). This is not an actionable finding: the approved UI-SPEC and incumbent design explicitly require bundled Inter. No typography penalty is applied for honoring that contract.

### Pillar 5: Spacing (4/4)

**Positive finding:** Both new pages use `py-6`, `PAGE_GUTTER`, `max-w-2xl`, and their own scroll-memory key (`pages/AccountConnections.tsx:14,26`; `pages/BudgetCategories.tsx:10,21`). `components/ui/pageGutter.ts:6` supplies 16 px phone and 24 px desktop gutters. Saved new-page titles/content share that left edge.

The goal's `grid-cols-[1fr_auto] gap-x-2` at `pages/Goals.tsx:232` leaves the plant in its own 20 px column and keeps the label/percentage under the bar column. The 390 px stage images show approximately 240 px of track, matching the contract. The existing 6 px bar/label offsets and goal-row inset are explicitly permitted exceptions, not arbitrary new spacing.

The clean hero's 16 px glyph uses an 8 px gap (`components/budget/BudgetSummaryWidget.tsx:176`). The Accounts action row uses `gap-2`, while its header uses `gap-x-4 gap-y-2`. Shared small buttons supply `max-md:min-h-11`; breadcrumb links supply 48 px height and minimum 44 px width (`components/ui/PageHeader.tsx:35`). Existing phone tests assert target sizes; they were read, not rerun here.

The whole-file spacing scan is dominated by ordinary scale classes: `py-2` 41, `gap-2` 35, `px-4` 32, `px-3` 29, `gap-3` 21. There is no new arbitrary pixel gutter. The 32 saved renders show no visible page-level sideways clipping; their capture summary records 0 px overflow, which this audit did not independently remeasure. Intermediate-width rendering remains the explicit verification follow-up under Visuals.

### Pillar 6: Experience Design (2/4)

**WARNING / P1 — Mount-only bloom eligibility breaks in-place transitions.**

- **Location:** `components/goals/GoalPlant.tsx:21` and `:29`.
- **Concrete case:** Open a hand-tracked, manually completed goal with $75 saved against a $100 target. Edit Saved so far to $100 without leaving Goals. Its status remains completed, so `pages/Goals.tsx:360` keeps it in the same group and `:317` retains the row by goal id. The stage becomes flower, but `bloom` remains the `false` captured at mount. A paused goal has the same issue. Active goals commonly move from In progress to Completed and remount, so checking only that path hides the defect.
- **Related replay:** If the same mounted completed/paused row initially bloomed, reducing its amount below target and restoring it retains `bloom=true`. `key={stage}` remounts the SVG on each transition back to flower and requests another bloom without consulting the memory again.
- **Evidence:** Read the full component, `firstBloom`, the row/group callers and `GoalFormModal`'s editable Saved so far field (`components/goals/GoalFormModal.tsx:193`). An in-memory Node 24 source-bundle check, with mocked `useState` and JSX, produced `bud/bloom=false → flower/bloom=false` and left bloom storage empty; the reverse sequence produced `flower/true → bud/false → flower/true`. This verifies component decision logic, not browser animation timing. No browser interaction capture was made.
- **Fix/check:** Decide and consume the per-goal first-bloom flag on the transition into complete, retaining one decision for that transition. Add coverage for a completed or paused row edited across the target without remounting, then below and back above it. Keep reduced-motion and unavailable-storage behavior. `e2e/tests/category-goals.spec.ts:116` checks initial stages, and `:139` checks mount/reload bloom; neither exercises this case.

**WARNING / P1 — Loading the real bank panel has no accessible status (known limitation).**

- **Location:** `components/accounts/ConnectedBanks.tsx:101`.
- **Concrete case:** On first opening Connected banks while any of the five bank queries is pending, the provider controls are replaced by a container whose only child is `Loader2` with `aria-hidden`. Screen-reader users get no loading explanation after the page heading.
- **Evidence:** The complete loading branch contains neither text nor `role="status"`. The existing screenshots are the demo branch and cannot verify this transient real-panel state. 01-01-SUMMARY already records the issue, and the UI-SPEC's “own spinner, unchanged” wording permits the visual spinner; that does not provide an accessible announcement.
- **Fix/check:** Keep the spinner, add a status region with visible or screen-reader text “Checking your bank connections…”, and assert the pending state's accessible message. This is a recommended correction to a known limitation, not a newly discovered missing component or an invented spec requirement.

**Positive state coverage:** `Plant.tsx:85` keeps decorative art out of announcements; all three new animation tokens become `none` under reduced motion (`index.css:274`). Storage failures return false from `firstBloom`, leaving the flower still. The 100%-but-unfunded stage is covered by `Plant.test.ts`; 01-05 documents why the server does not expose that browser fixture, so its absence is not a new defect. Goals still has loading, error, empty and Safe mode branches. The budget hero retains its status role and the separate caveat action. The moved panels retain their existing forms/confirmations rather than adding a competing mutation path.

`utils/movedSections.ts:55` preserves non-tab parameters on old Settings redirects; `pages/Settings.tsx:56` uses replace navigation. URL provider selection, palette-only destinations, remembered Budget month and the shared scroll-memory hooks are wired as specified. New routes are lazy in `App.tsx:18,21`. These paths were checked in source and existing test declarations; no fresh end-to-end pass is claimed.

---

## Verification and Limits

- Confirmed implementation HEAD, the 72-file diff boundary, and all 32 evidence files. Existing untracked `.omc/` in `wt-f` was left alone.
- Inspected all eight screen families in both themes and both available widths. Captures are viewport renders from demo/disposable budgets, not physical-device touch tests. No new screenshots or interaction states were captured.
- Ran Impeccable's static detector once; its only font warning is rejected for the documented reason above. No package was installed.
- Ran read-only in-memory source assertions on Node v24.10.0: seven plant-stage cases, six hero states, and three redirect/provider cases passed. Ran the separate two-sequence component-state reproduction described above. Source was bundled in memory using the existing Rolldown installation; no generated files were written to `wt-f`.
- An initial attempt to use the installed TypeScript package as a JavaScript transpiler failed with `MODULE_NOT_FOUND`; the successful checks used Rolldown instead. These checks are not represented as Vitest or browser-suite runs.
- Read the existing unit/e2e expectations and recorded execution summaries. Full unit/build/e2e checks were not rerun during this documentation-only audit; starting e2e/shared servers is expressly prohibited. No claim of current remote CI verification is made.
- No `components.json` was found; UI-SPEC declares no shadcn or third-party registries. Registry source inspection is therefore not applicable; no Registry Safety finding or score deduction.
- Impeccable was loaded from its installed `SKILL.md` because this runtime has no Claude `Skill` tool; its context and audit playbook were applied. The supplied six-pillar report format takes precedence over the skill's generic five-dimension template. No delegation was needed. Herdr identity (`t4h`) and runtime validation passed.

## Files Audited

Planning inputs in this worktree: `01-01-PLAN.md` through `01-08-PLAN.md`, corresponding summaries, `01-UI-SPEC.md`, and `01-CONTEXT.md` in this phase directory. Project context: both worktrees' `CLAUDE.md`; `wt-f`'s `PRODUCT.md`, design context, `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md`, relevant `docs/ui/MAP.md` rows and Wave F notes in `docs/ui/WAVES.md`.

Primary implementation and direct support files in `wt-f`:

- `client/src/pages/AccountConnections.tsx`, `BudgetCategories.tsx`, `Accounts.tsx`, `Settings.tsx`, `Goals.tsx`; changed entry points and surrounding layout in `Budget.tsx`.
- `client/src/components/accounts/ConnectedBanks.tsx`, `BankBalanceHint.tsx`; `components/budget/BudgetSummaryWidget.tsx`, `RentOrOwn.tsx`.
- `client/src/components/goals/GoalPlant.tsx`, `growth.ts`, `growth.test.ts`; `GoalFormModal.tsx` saved-amount/update path.
- `client/src/components/ui/Plant.tsx`, `Plant.test.ts`, `PageHeader.tsx`, `Button.tsx`, `pageGutter.ts`; relevant theme, type and motion rules in `client/src/index.css`.
- `client/src/utils/fundingStatus.ts`, `fundingStatus.test.ts`, `movedSections.ts`; redirect/provider assertions and declared tests for `movedSections`.
- Route/entry-point diffs in `client/src/App.tsx`, `components/layout/navPages.ts`, `CommandPalette.tsx`, `components/up/UpSyncBadge.tsx`, `components/dashboard/GettingStarted.tsx`, `components/review/Housekeeping.tsx`, `Resilience.tsx`, and `components/transactions/TransactionTable.tsx`.
- Wording diffs in `client/src/guides/pages.ts`, `userGuide/articles.tsx`, `components/demo/NotInDemo.tsx`, `components/settings/UnusedCategories.tsx`, `components/transactions/BulkDeleteModal.tsx`, and `TransactionDetailPanel.tsx`.
- Relevant test expectations in `e2e/tests/category-goals.spec.ts`, and plan-linked coverage for accounts, settings, budget, demo/category-goals, phone targets/gutters and accessibility. These are test-source/recorded-evidence checks, not new browser executions.
- Every PNG matching `{goals-new-laptop,goals-stages,budget-zero-clean,budget-zero-caveat,accounts-header,accounts-connections,budget-categories,settings}-{1280,390}-{light,dark}.png` under `.ui-evidence/2026-11-14-wave-f/`.
