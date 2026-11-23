---
phase: 03-screens-on-shared-controls
plan: 26
subsystem: ui
tags: [react-aria, popover, combobox, category-picker, date-picker, phone, ios, playwright, uat-gap]

requires:
  - phase: 03-screens-on-shared-controls
    provides: shared SearchList/CategoryPicker/NativePicker controls (03-01 to 03-25), UAT gap G-03-1
provides:
  - "SearchList/SearchListBody focusSearchOnOpen (default true) and containerPadding"
  - "Opt-in CategoryPicker/CategorySelectButton phoneDrawer, set only by Add transaction's Category field"
  - "NativePicker input that cannot outgrow its container on iOS"
affects: [03-29 PR body, 03-30, 03-31, phone UAT re-test of test 1]

actuals:
  tokens: 5000
  tasks: 3
  commits: 4
plan_head_before: 4f28b3986f431d2b4a4a6fdaf233694d1e28942b
plan_head_after: d31833dd8b8107533f4cecf32d3473ef6403ffa7

tech-stack:
  added: []
  patterns:
    - "Opt-in phone presentation: the screen states intent (phoneDrawer), the shared picker decides what it means on a phone (D-04)"
    - "A list that must sit flush with a portal container's edge sets containerPadding={0} (React Aria default is 12)"

key-files:
  created: []
  modified:
    - client/src/components/ui/Combobox.tsx
    - client/src/components/transactions/CategoryPicker.tsx
    - client/src/components/transactions/CategorySelectButton.tsx
    - client/src/components/transactions/AddTransactionModal.tsx
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/ui/DatePicker.test.ts
    - e2e/tests/phone/polish-phone.spec.ts
    - e2e/tests/phone/iphone-webapp.spec.ts

key-decisions:
  - "SearchList gained a containerPadding prop (not in the plan's artifact list): it is the only way to make the drawer flush, because React Aria pushes a list drawn into a portal container 12 px in from the container's left edge"
  - "The drawer is placed against the whole field (the spot's parent, the caller's relative wrapper) with placement bottom start and React Aria's flip, so it can open below or above without covering the field; the caller's `position` prop is not used on this path"
  - "phoneDrawer is ignored when `anchor` is given (the anchored list already floats in the page, not in a portal container)"

requirements-completed: [WAVG-05, WAVG-06]

coverage:
  - id: D1
    description: "On a phone, Add transaction's Category list opens flush with its field in the plain popover card, with no text field focused; search is one tap away; Escape closes only the list"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/polish-phone.spec.ts#the category list in Add transaction opens flush with its field, without the keyboard"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every other phone category list (details sheet and the rest) keeps its focused search and raised card; desktop and the gallery pickers are unchanged"
    requirement: WAVG-06
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/polish-phone.spec.ts#other phone category lists still focus their search"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/pickers.spec.ts (all 14, unedited)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts and dialog-focus.spec.ts on the desktop project"
        status: pass
    human_judgment: false
  - id: D3
    description: "NativePicker's input carries min-w-0, appearance-none and a left-aligned WebKit value, so the Add transaction Date stays inside the sheet on iOS"
    requirement: WAVG-06
    verification:
      - kind: unit
        ref: "client/src/components/ui/DatePicker.test.ts#the native input cannot outgrow its container (iOS sizes a date input by its value)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/phone/iphone-webapp.spec.ts#Add transaction keeps its Date field inside the sheet (phone and iphone-webkit)"
        status: pass
    human_judgment: true
    rationale: "No automated engine reproduces the iOS-only overflow (it passed before the fix in Chromium and WebKit); the owner's iPhone check is the gate for the Date part of G-03-1"
  - id: D4
    description: "Gallery 390 px matrix baselines still match after the date class change"
    verification: []
    human_judgment: true
    rationale: "Docker is not installed on this Mac, so the Linux baselines were not compared locally; CI's e2e job compares them (hand-off to 03-29)"

duration: 55min
completed: 2026-11-22
status: complete
---

# Phase 3 Plan 26: Calm phone category list and Date field fit (G-03-1) Summary

**Add transaction's Category field opens a flush, keyboard-free drawer on phones through an opt-in `phoneDrawer` (every other caller untouched), and every phone date/month field gets `min-w-0 appearance-none` so iOS cannot widen it past its sheet.**

## Performance

- **Duration:** about 55 min
- **Completed:** 2026-11-22 (local)
- **Tasks:** 3 (Task 3 changed no files: Docker unavailable, hand-off recorded)
- **Files modified:** 8

## Accomplishments

- Add transaction's Category list on a phone: left and right edges within 1 px of the field, directly above or below it, the plain `popoverClass` card (no `shadow-lg`), search not focused (focus rests on the listbox), search focuses on a tap, a category tap sets the field and closes only the list, Escape closes only the list.
- Opt-in end to end (owner decision A): `AddTransactionModal` adds the bare `phoneDrawer` attribute and nothing else (no device check in a screen, D-04); `CategorySelectButton` forwards it; `CategoryPicker` decides what it means on a phone; `SearchList` gets `focusSearchOnOpen` (default true) and `containerPadding`.
- Shared NativePicker layout fix for the Date field running past the sheet's edge on the owner's iPhone.

## Task Commits

1. **Task 1 (tracer): phone category list** - `f140c2fe` (feat)
2. **Task 2 (TDD): phone Date field** - `7bcae0c3` (test, RED), `e6de106e` (fix, GREEN)
3. **Task 1 follow-up: wait for the card's entrance animation before measuring** - `d31833dd` (test)
4. **Task 3: gallery baselines** - no commit (nothing to change; see Docker hand-off)

**Plan metadata:** the docs(03-26) commit that adds this file.

## RED evidence

- **Task 1:** the reworked polish-phone test failed on the unmodified code at `e2e/tests/phone/polish-phone.spec.ts:187`, assertion `left edges`: `expect(Math.abs(p.x - f.x)).toBeLessThanOrEqual(1)` received 12. That is the owner's "shifted to the right" reproduced as 12 px. It passes now.
- **No-spill-over guard:** `other phone category lists still focus their search` passes before and after. Deliberate red run: with `drawer = isPhone && !anchor` (every caller treated as opted in) it failed at `polish-phone.spec.ts:239`, `expect(search).toBeFocused()` received "inactive". Restored to `phoneDrawer && isPhone && !anchor`.
- **Task 2 unit test:** `DatePicker.test.ts` "the native input cannot outgrow its container" failed on the unmodified code at the `min-w-0` assertion (`DatePicker.test.ts:169`, the class string held none of the three classes). It passes now.
- **Task 2 geometry test (Add transaction Date vs Amount):** passed BEFORE the fix in both projects (phone Chromium 390 px, iphone-webkit 430 px): **recorded exception.** No automated engine here reproduces the overflow, because Playwright's WebKit is desktop WebKit and does not draw iOS Safari's native date control, whose value-sized minimum width causes it. The test stays as a regression guard and was not loosened. **The Date part of G-03-1 is closed only by the owner's iPhone check** (see For 03-29).
- The first run of the geometry test failed for a wrong locator (`getByLabel('Date', { exact: true })` finds nothing because the required label text differs); that was a test defect, fixed to `getByRole('textbox', { name: 'Date', exact: true })`, not a RED for the feature.

## Cause of the ~11 px shift (and who else it moves)

React Aria's `Popover` applies `containerPadding` (default 12) when it keeps an overlay inside its boundary. For an overlay drawn into a positioned portal container, `getDelta` compares the overlay's start offset with `containerOffsetWithBoundary + padding`; the container offset cancels, so the overlay is forced at least 12 px in from the container's left edge. A list whose trigger sits at the container's left edge (`CategoryPicker`'s zero-height spot is both trigger and container, offset 0) is therefore pushed 12 px right, and, as wide as its trigger, ends 12 px past the field's right edge. Measured in the phone project: popover `left: 12px`, `--trigger-anchor-point: -12px`, list x 28 against field x 16.

**It also moves other callers' lists (finding for the owner, not fixed here, 03-29 PR body):**
- Every non-anchored `CategoryPicker`/`CategorySelectButton` list on phones has the same 12 px shift.
- The Account `Combobox` in Add transaction, the list the owner likes, is measured at the same 12 px (list x 28, width 358, in a 358 px host at x 16: `left: 12px`). Any `Combobox` with `portalContainer` and its trigger at the container's left edge will match. The owner prefers that look, so it was left as is. The fix, if wanted, is `containerPadding={0}` on that Popover.

The drawer path sets `containerPadding={0}` and places the list against the field (parent of the spot), so it is flush; all other callers keep today's lists.

## Files Created/Modified

- `client/src/components/ui/Combobox.tsx` - `focusSearchOnOpen` (default true; focus goes to the listbox, `aria-activedescendant` mirrored there) and `containerPadding`.
- `client/src/components/transactions/CategoryPicker.tsx` - `phoneDrawer` (via `useIsPhone`, called unconditionally), drawer render branch.
- `client/src/components/transactions/CategorySelectButton.tsx` - forwards `phoneDrawer`.
- `client/src/components/transactions/AddTransactionModal.tsx` - one bare `phoneDrawer` attribute.
- `client/src/components/ui/DatePicker.tsx` - NativePicker classes.
- `client/src/components/ui/DatePicker.test.ts`, `e2e/tests/phone/polish-phone.spec.ts`, `e2e/tests/phone/iphone-webapp.spec.ts` - tests.

## Decisions Made

See `key-decisions` in the frontmatter. In short: `containerPadding` prop added to SearchList; the drawer is placed against the whole field with flip and ignores `position`; `phoneDrawer` does nothing with `anchor`.

## Deviations from Plan

### Auto-fixed / judgment

**1. [Rule 3 - Blocking] `containerPadding` on SearchList**
- **Found during:** Task 1
- **Issue:** The plan asked for the cause of the shift to be found and fixed for the drawer path; the cause is React Aria's default `containerPadding` 12, reachable only through a Popover prop that SearchList did not expose.
- **Fix:** Optional `containerPadding` prop on SearchList (default undefined, so React Aria's 12 remains for every other caller).
- **Files modified:** `client/src/components/ui/Combobox.tsx`
- **Committed in:** `f140c2fe`

**2. [Plan wording] Drawer placement**
- Placed against the field (spot's parent) with `bottom start` and flip, as the plan said, so the caller's `position="above"` is not used on this path. In the 390x844 phone project it opens above the field (no room below); verified by the polish-phone test (gap 0 to 8 px above or below).

**3. [Process] TDD commits for Task 2**
- RED test commit (`7bcae0c3`) then the fix (`e6de106e`), per the TDD reference, although the plan lists one commit per task.

**4. [Environment] `node_modules`**
- The worktree had none; `client/`, `server/` and `e2e/` `node_modules` were symlinked to the main checkout's (git-ignored, nothing committed, no install, `.npmrc` untouched).

**Total deviations:** 1 auto-fixed (Rule 3), 3 notes. **Impact:** none on scope; no package added.

## Issues Encountered

- **Pre-existing, time-dependent failure, out of scope:** `phone-native.spec.ts` "adds a split transaction from a bottom sheet" failed at `phone-native.spec.ts:197` (`Outflow` textbox not found while the Payee list is open) on three runs before local midnight on 21 November, including one on the unmodified base (the four source files checked out from `4f28b398`, same failure, then restored). It passed in both full phone runs after the clock rolled to 22 November, so it depends on the date, not on this plan. Not touched. For the orchestrator or 03-29 to triage (a test that passes or fails by the day).
- **One flaky run of the new flush test:** in the first full phone run the new test failed at its `left edges` assertion (received value not captured). The card's entrance is a 110 ms `scale(0.97)`, so a box read mid-animation is a few px small; the test now waits for the card's animations to finish before measuring (commit below). It then passed 6 of 6 repeated runs and in the next full phone run (68 passed).
- **`E2E_SKIP_BUILD=1` serves "Cannot GET /"** here (no reusable build); every run was a full build.

## Task 3: gallery baselines (Docker hand-off)

`docker` is not installed (`/usr/local/bin/docker` points at a missing `/Applications/Docker.app`); per the plan's precondition it was not installed and no baseline was drawn on macOS. **Baselines not compared locally: no Docker.** Handed to 03-29: CI's e2e job compares the gallery on Linux. If `matrix.spec.ts` `gallery-390-light/dark.png` fail there, download the run's `playwright-report-N` artifact (`gh run download <run-id> --repo tvrooi/Allotment`), look at every `-actual.png` with the Read tool, and commit only images whose sole difference is a native date or month field. No picker baseline should move (no gallery picker opts in).

What did run locally: `gallery` `pickers.spec.ts` and `overlays.spec.ts` (33 passed, 16 pixel tests skipped on macOS by design), `desktop` `dialog-focus.spec.ts` and `transactions.spec.ts` (58 passed). `git diff --stat HEAD -- e2e/tests/gallery/*.spec.ts` is empty; `git ls-files .ui-evidence` is empty; no review screenshots were taken.

## Verification

- `npm --prefix client test -- Combobox.test.ts CategoryPicker.test.ts DatePicker.test.ts MonthPicker.test.ts`: pass; `tsc --noEmit -p client`: clean.
- phone project: polish-phone, phone-native, iphone-webapp pass (phone-native's split test failed earlier only for the date-dependent reason above). iphone-webkit: 4 passed.
- gallery pickers/overlays and desktop dialog-focus/transactions: pass (above).
- Full phone project after the animation wait below: 68 passed (phone-native included).

## For 03-29

- **Behaviour change (owner-requested, UAT G-03-1):** Add transaction's Category list on a phone no longer focuses its search on open (keyboard stays down until the search is tapped); it opens flush with the field in the plain popover card. One changed caller: `AddTransactionModal`. Every other category list is unchanged (owner decision A).
- **Shared layout fix:** `NativePicker` (every phone date and month field) now has `min-w-0 appearance-none [&::-webkit-date-and-time-value]:text-left`; not a behaviour change.
- **Selector change:** the polish-phone list locator is now `getByRole('dialog', { name: 'Search categories' })` (and its parent for the card) instead of the `shadow-lg` xpath, which the drawer no longer carries.
- **Screenshots changed:** none committed; matrix `gallery-390-light/dark` may move because of the date classes (compare in CI, see above).
- **Finding for the owner:** the 12 px `containerPadding` shift also affects the Account Combobox list in Add transaction and every non-anchored CategorySelectButton list on phones; left as is.
- **Owner's iPhone check (the gate for the Date part of G-03-1):** on Safari, Add transaction's Date field ends inside the sheet, level with Amount, and still opens the iPhone date wheel. Also confirm the Category list opens with no keyboard and the search works on a tap.
- **Date-dependent phone-native split-transaction test** (above) to triage.

## Self-Check: PASSED

- Files present: `DatePicker.tsx`, `DatePicker.test.ts`, `iphone-webapp.spec.ts`, `polish-phone.spec.ts` and the four category source files.
- Commits `f140c2fe`, `7bcae0c3`, `e6de106e`, `d31833dd` are ancestors of HEAD; `git rev-list --count` from `plan_head_before` gave 4.
- Acceptance greps: `focusSearchOnOpen` in Combobox.tsx 6 (>= 2); `phoneDrawer` in 3 tsx files (== 3); `appearance-none` in DatePicker.tsx 1; `webkit-date-and-time-value` in DatePicker.test.ts 1; the AddTransactionModal diff is the single `phoneDrawer` line; no gallery spec edited; `git ls-files .ui-evidence` empty; no package.json or lockfile touched.
