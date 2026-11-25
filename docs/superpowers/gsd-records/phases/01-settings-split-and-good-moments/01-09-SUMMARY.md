---
phase: 01-settings-split-and-good-moments
plan: 09
subsystem: ui
status: complete
gap_closure: true
tags: [react, goals, plant, bloom, copy, lint-terms, vitest, playwright]

requires:
  - "01-08: wave-f at 575c3ea pushed to PR #273; 01-VERIFICATION.md gaps WR-01 and WR-04, which the owner chose to fix"
provides:
  - "goals/growth.ts: nextBloom(goalId, wasComplete, complete, bloom), the one rule for when a goal's flower blooms"
  - "GoalPlant: bloom is state that follows `complete` while the row is mounted (ref + useLayoutEffect)"
  - "Two browser tests that change a goal on an open /goals page: reached in place, and dipped and returned"
  - "lint/terms RETIRED row for the old $0 label is case-insensitive (/Fully budgeted/i)"
  - "The Budgeting guide's hold section and two living docs name the current $0 label, “Every dollar has a job”"
affects: [01-verification, pr-273]

actuals:
  tokens: 2106
  tasks: 3
  commits: 4
plan_head_before: 575c3ea48bd32f791a1417762140a1a7bd482c0a
plan_head_after: 1b6f5f6941799b5ead62808b3f18551a552391d7
review_followup_head: ad26903

tech-stack:
  added: []
  patterns:
    - "A per-mount decision that must follow a prop: a pure rule (nextBloom) fed by a ref of the last seen pair, applied in a layout effect, never during render or in an updater (StrictMode runs those twice)"
    - "e2e: type into amount fields with the typeAmount fixture, after asserting the dialog has loaded the current amount"

key-files:
  created:
    - client/src/components/goals/GoalPlant.test.ts
  modified:
    - client/src/components/goals/growth.ts
    - client/src/components/goals/growth.test.ts
    - client/src/components/goals/GoalPlant.tsx
    - e2e/tests/category-goals.spec.ts
    - lint/terms/terms.test.js
    - client/src/userGuide/articles.tsx
    - docs/ENVELOPE-FUNDING.md
    - docs/BUDGET-REVIEW.md

key-decisions:
  - "Ran inline in wt-f instead of through the Herdr dispatcher: the plan requires writing only in the existing wt-f checkout, and the adapter accepts writing workers only in GSD-created worktree-agent-* worktrees (owner's choice, 15 November 2026)"
  - "The new browser tests type amounts with the existing typeAmount fixture rather than fill(), which the CurrencyInput loses when the field already holds an amount"

requirements-completed: [WAVF-04, WAVF-05]

coverage:
  - id: D1
    description: "A goal reached while its row stays on the page grows and blooms in place, once per goal per device; a dip and return shows a still flower"
    requirement: WAVF-04
    verification:
      - kind: unit
        ref: "client/src/components/goals/growth.test.ts#nextBloom (#241)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#a goal reached while the page is open grows and blooms in place (#241)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#a reached goal that dips and returns does not bloom again (#241)"
        status: pass
    human_judgment: false
  - id: D2
    description: "First sight, reload, reduced motion and the stored key behave as before"
    requirement: WAVF-04
    verification:
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts (three existing #241 tests, unedited)"
        status: pass
      - kind: unit
        ref: "client/src/components/goals/growth.test.ts#firstBloom (#241)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The old $0 label is gone from client and server copy and refused in any letter case"
    requirement: WAVF-05
    verification:
      - kind: automated_ui
        ref: "npm --prefix lint test (86/86)"
        status: pass
      - kind: other
        ref: "grep -rniE 'fully[ -]budgeted' client/src server/src -> no match"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both fixes on PR #273 after green local checks and a plain push; CI green; nothing merged, tagged, published or closed"
    verification:
      - kind: other
        ref: "gh pr checks 273 at 1b6f5f6: all pass (publish/release skipped)"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-11-15
---

# Phase 01 Plan 09: Gap closure (bloom in place, $0 label) Summary

**`nextBloom` makes a goal's flower follow the goal while its row is on the page (once per goal per device), and the retired $0 label is gone from the guide and refused in any letter case — pushed to PR #273 at `1b6f5f6` with CI green.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-11-15T10:46:56Z
- **Completed:** 2026-11-15T11:15:40Z
- **Tasks:** 3
- **Files modified:** 8 (all in wt-f, exactly the plan's `files_modified`)

## Accomplishments

- WR-01 closed: `nextBloom` in `goals/growth.ts` is the one rule (not complete → false; still complete → keep; newly complete → `firstBloom`). `GoalPlant` holds the bloom in state, with the last seen `complete`/`bloom` in a ref, updated in a `useLayoutEffect` on `[goalId, complete]`. `firstBloom`, `BLOOMED_KEY` (`flybudget:goals-bloomed`) and `MAX_REMEMBERED` are unchanged.
- WR-04 closed: the hold section now reads “can reach $0 and read “Every dollar has a job””; `docs/ENVELOPE-FUNDING.md` and `docs/BUDGET-REVIEW.md` say `read "Every dollar has a job"`; the `lint/terms` row is `/Fully budgeted/i` (one-line change).
- New coverage of growth in place (seed → seedling with `data-motion`) that no test had before.

## Failing output before each fix (RED)

Unit, `npm --prefix client test -- src/components/goals/growth.test.ts` (before `nextBloom` existed):

```
 FAIL  src/components/goals/growth.test.ts > nextBloom (#241) > never blooms a goal that is not reached
TypeError: nextBloom is not a function
      Tests  5 failed | 3 passed (8)
```

Browser, `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts` (tests committed, component unchanged):

```
  ✘   7 … a goal reached while the page is open grows and blooms in place (#241)
    Expected: "true"
    Received: "false"
    > 194 |   await expect(plant).toHaveAttribute('data-bloom', 'true');
  ✘   8 … a reached goal that dips and returns does not bloom again (#241)
    Expected: "false"
    Received: "true"
    > 212 |   await expect(plant).toHaveAttribute('data-bloom', 'false');
  2 failed
  8 passed
```

The seedling and `data-motion` steps passed before the fix, as the plan expected.

Guard, `npm --prefix lint test` after adding `i` and before the copy changed:

```
✖ nothing in the client or server says /Fully budgeted/i; it is "Every dollar has a job"
  actual: [ 'client/src/userGuide/articles.tsx:405: assign now, so the month can reach $0 and read fully budgeted, and it comes back when' ]
ℹ tests 86
ℹ pass 85
ℹ fail 1
```

Only line 405 of the user guide was listed; nothing under `server/src`.

## Task Commits

All in `/Users/tristanvanrooyen/wt-f` on `wave-f`, tests before fixes:

1. **Task 1: a goal reached while its row is on the page blooms once**
   - `d5216fb` test(ui): a goal reached on an open page blooms once (#241)
   - `64ee47d` fix(ui): a goal's flower follows the goal while its row is on the page (#241)
2. **Task 2: the old $0 label leaves the guide and is refused in any letter case**
   - `22c5e94` test(lint): the retired $0 label is refused in any letter case (#241)
   - `1b6f5f6` fix(ui): the hold guide names the $0 label the app shows (#241)
3. **Task 3: checks, push, PR body** — no source commit; plain push `575c3ea..1b6f5f6`, PR body section added.

## Checks (Node 24.10.0, one browser run at a time, at `1b6f5f6`)

| Check | Result |
|-------|--------|
| `npm --prefix client test -- growth.test.ts Plant.test.ts` | 25/25 |
| `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts` | 10 passed (8 before + 2 new), none failed/flaky/skipped |
| `cd e2e && npx tsc --noEmit` | clean |
| `npm test --prefix client` | 616/616 in 75 files |
| `npm run build --prefix client` | passed |
| `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts tests/budget.spec.ts` | 33 passed |
| `npm --prefix e2e test -- --project=demo tests/demo/category-goals.spec.ts` | 2 passed |
| `npm --prefix lint test` | 86/86 |
| `npm --prefix lint run lint` | 0 errors, 128 warnings (cap 128, unchanged) |
| `npm --prefix client test -- src/utils/guides.test.ts` | 20/20 |

Pre-push: `origin/wave-f` and `origin/redesign` both ancestors of HEAD; status clean but untracked `.omc/`; no tracked `.planning`, `.ui-evidence` or `.omc`; diff = the 8 planned files; version `0.2.0-up.174`; no tag `v0.2.0-up.174` locally or remotely.

## PR #273 and CI

- Push: `575c3ea..1b6f5f6 wave-f -> wave-f` (fast-forward, no force).
- Body: section "Gap closure, 15 November 2026" appended before the footer; title and earlier sections kept. Verified `OPEN redesign wave-f true`.
- CI on `1b6f5f6`: every check passed — client, server, lint, test, verify, electron, homeassistant, e2e 1–4, build linux/macos/windows, Vercel, "CI passed"; publish and release skipped as normal for a PR.
- Automatic review: no new review or comment on `1b6f5f6` as of 11:11Z. No thread was resolved.
- PR #273, #244 and #241 are OPEN. Nothing merged, tagged, published or closed.

## Decisions Made

- Executed inline in `wt-f` (owner's choice at the dispatch checkpoint): plan D-07 forbids another worktree or branch, while the Herdr adapter accepts writing workers only in GSD-created `worktree-agent-*` worktrees; GSD's own `worktree.base-check` had already degraded isolation to none (`redesign` HEAD ≠ `origin/HEAD`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The edit dialog lost amounts typed with `fill()`**
- **Found during:** Task 1 (RED run of the browser tests)
- **Issue:** The plan said to fill `Saved so far` and press Tab, as the file's first test does. That test fills an empty field; here the field already held an amount, and the save request carried the old `currentAmount` (2000), so both tests failed at the seedling/bud step instead of the bloom step. The trace showed the PUT body unchanged.
- **Fix:** The helper waits for the field to show the goal's current amount (`$20`, `$100`, …) and types with the existing `typeAmount` fixture (`e2e/tests/fixtures.ts`), which documents that `fill()` doesn't work on amount fields. Reused, not duplicated.
- **Files modified:** `e2e/tests/category-goals.spec.ts` (new lines only; no existing line removed)
- **Verification:** RED then failed exactly where the plan predicted (lines 194 and 212); GREEN passed 10/10.
- **Committed in:** `d5216fb` (the test commit)

---

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** test mechanics only; the assertions are the plan's, unchanged.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None.

## Follow-up from the code review (16 November 2026, owner-approved)

The incremental code review of `575c3ea..1b6f5f6` (`01-REVIEW.md`, WR-01) confirmed both fixes. It found one residual: the mount-time initializer `useState(() => nextBloom(goalId, false, complete, false))` called `firstBloom` during render, so a render React discards (a suspended mount) used up a goal's one bloom. My comment above it also said the bloom was never decided during render. The owner chose to fix it now.

- `9149547` test(ui): a goal plant that is never shown uses up no bloom (#241). New `GoalPlant.test.ts` renders a reached goal with `renderToStaticMarkup`, which runs no effects, and expects nothing stored. Before the fix: `AssertionError: expected 1 to be +0`.
- `ad26903` fix(ui): a goal's bloom is remembered only once its plant is shown (#241). `bloom` starts `false` and the ref starts `{ complete: false, bloom: false }`, so the existing layout effect decides on mount too, before the first paint. The comment now says so.
- Checks at `ad26903`: goals and Plant unit tests 26/26; e2e desktop `category-goals.spec.ts` 10 passed (first sight, reload and reduced motion unedited); client 617/617 in 76 files; build passed; `lint/terms` 86/86; lint 0 errors, 128 warnings; e2e `tsc` clean; e2e desktop goals + budget 33 passed; demo 2 passed.
- Plain push `1b6f5f6..ad26903`; the PR body's gap-closure section has a follow-up paragraph. CI result: see the phase verification.

## Next

Phase complete on the plan side (9/9 summaries). Left for the owner: re-verify phase 01 (`01-VERIFICATION.md` re-run, scoped to `wt-f`, `git diff origin/redesign..wave-f`), get the automatic review on `1b6f5f6`, then merge PR #273, close #244 and #241, and release `0.2.0-up.174`.
