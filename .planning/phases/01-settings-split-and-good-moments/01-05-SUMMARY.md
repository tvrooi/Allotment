---
phase: 01-settings-split-and-good-moments
plan: 05
subsystem: ui
status: complete
tags: [react, svg, css-motion, goals, playwright, vitest, safe-mode]

requires:
  - "01-04: wave-f at dd6fe29 with the settings split complete"
  - "PR #273: firstBloom / BLOOMED_KEY and the --animate-grow-in, --animate-bloom, --animate-bloom-ring tokens"
provides:
  - "components/ui/Plant.tsx: Plant (four stages, size, ground, bloom, grew, pass-through attributes), plantStage, PlantStage. Plan 06's Ready to assign hero can use it"
  - "components/goals/GoalPlant.tsx: the goal row's plant with once-per-goal bloom and grow-on-stage-change"
  - "Goals row in the UI-SPEC grid: redesign's plain bar in col 1, the plant in an auto col 2, the label row under the bar"
  - "Test hooks: goal-plant, data-stage (seed|seedling|bud|flower), data-bloom, data-motion"
affects: [01-06, 01-07, docs-ui-map, docs-ui-handover]

actuals:
  tokens: 6371
  tasks: 2
  commits: 2
plan_head_before: dd6fe29e12eee75bd81084c10ac9d0384344ac23
plan_head_after: 5064d5edc1ba7aabf53a67857d1cf642e12c65b6

tech-stack:
  added: []
  patterns:
    - "Decorative SVG in ui/: aria-hidden, focusable=false, @theme fill/stroke utilities only, still unless a motion prop is passed; every animated element carries data-motion"

key-files:
  created:
    - client/src/components/ui/Plant.tsx
    - client/src/components/ui/Plant.test.ts
    - client/src/components/goals/GoalPlant.tsx
  modified:
    - client/src/components/goals/growth.ts
    - client/src/components/goals/growth.test.ts
    - client/src/pages/Goals.tsx
    - e2e/tests/category-goals.spec.ts
    - e2e/tests/demo/category-goals.spec.ts
    - e2e/tests/safe-mode.spec.ts
  deleted:
    - client/src/components/goals/GoalGrowthBar.tsx

key-decisions:
  - "No coordinate was adjusted from the UI-SPEC geometry: rendered at 20 px and 80 px in light and dark, the four silhouettes are distinct as specified"
  - "The partial-funding browser test (100% with fundingComplete false shows a bud) was not added: the API cannot produce that state. routes/goals.ts sets fundedAmount to null whenever fundingComplete is false, so the Goals page computes 0%. The unit rule plantStage(100, false) === 'bud' covers it"
  - "#273's role=progressbar wrapper was dropped with GoalGrowthBar, as the plan lists. The bar is redesign's plain bar again and the status stays in text ('Goal reached' or '… to go' and the %)"
  - "The header comment in Plant.tsx writes 'issue 241' rather than the hash form, so the plan's no-hex grep (#[0-9a-f]{3,6}) stays at 0"

patterns-established:
  - "A goal row is one grid (grid-cols-[1fr_auto]): the bar and label share the 1fr column, so the % ends under the bar's end, and a fixed-size glyph sits in the auto column"

requirements-completed: [WAVF-04]

coverage:
  - id: D1
    description: "Four stages by the stage table, with a flower only when the goal is reached"
    requirement: "WAVF-04"
    verification:
      - kind: unit
        ref: "client/src/components/ui/Plant.test.ts#plantStage (#241)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#a goal's plant grows from a seed to a flower as it fills (#241)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The plant is decorative, uses tokens only and is still by default"
    requirement: "WAVF-04"
    verification:
      - kind: unit
        ref: "client/src/components/ui/Plant.test.ts#Plant (#241)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blooms once per goal per device and stays still under reduced motion"
    requirement: "WAVF-04"
    verification:
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#a reached goal blooms once on this device (#241)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#with reduced motion a goal's plant is shown still (#241)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The row holds at 390 px: the plant stays 20 px at the end of the bar and the page has no sideways scroll"
    requirement: "WAVF-04"
    verification:
      - kind: e2e
        ref: "e2e/tests/category-goals.spec.ts#on a phone the plant sits at the end of the bar and keeps its size (#241)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The demo's New laptop has flowered; Safe mode hides the list and its plants"
    requirement: "WAVF-04"
    verification:
      - kind: e2e
        ref: "e2e/tests/demo/category-goals.spec.ts#the demo's reached goal has flowered (#241)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/safe-mode.spec.ts#Goals: the list and its plants are hidden (#241)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual: the stages read at 100% zoom on the row and its hover colour, in light and dark, and look like the brand's sprout"
    requirement: "WAVF-04"
    human_judgment: true
    rationale: "Plan 07 takes the screenshots of Goals ('New laptop') at 1280 and 390 px; the human check in Task 2's verify belongs there"

duration: 10 min
completed: 2026-11-15
---

# Phase 1 Plan 5: Goal plant, seed to flower Summary

**A four-stage inline SVG plant (`ui/Plant.tsx`, built on the logo's sprout and drawn with @theme tokens only) sits in its own grid column at the end of each goal's unchanged bar. Only a goal that reaches its target flowers. It blooms once per goal per device with #273's CSS motion and is still under reduced motion.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-11-15T04:06Z
- **Completed:** 2026-11-15T04:16Z
- **Tasks:** 2
- **Files:** 10 (3 created, 6 modified, 1 deleted by the rename)

## Accomplishments

- `Plant` draws seed, seedling, bud and flower to the UI-SPEC geometry. It is `aria-hidden` and `focusable="false"`, with no title and no role, and has a `shrink-0` 20 px default. Motion is opt-in: `grew` adds `animate-grow-in`, and `bloom` animates five petals with a 40 ms stagger plus one ring. Every animated element has `data-motion`.
- `plantStage(pct, complete)` is the client's only stage rule. `growthStage`, `GrowthStage` and `GoalGrowthBar` are gone, and `growth.ts` keeps only `firstBloom` and `BLOOMED_KEY` (the `flybudget:goals-bloomed` key is unchanged).
- `GoalPlant` keeps #273's once-per-mount bloom decision and its render-time grow-on-stage-change.
- The Goals row is the UI-SPEC grid. The bar is byte-identical to `redesign`, the `complete` rule is untouched, and "Goal reached" stays as text.
- Browser coverage includes the stages, bloom once, reduced motion, 390 px, the demo's New laptop and Safe mode.

## Task Commits (wave-f, not pushed)

1. **Task 1 (tracer): a goal row shows its plant, and a reached goal flowers.** `2be616e` (feat)
2. **Task 2: bloom once, reduced motion, 390 px, demo, Safe mode.** `5064d5e` (test)

## Verification run

- `npm --prefix client test -- src/components/ui/Plant.test.ts src/components/goals/growth.test.ts`: 2 files, 20 tests passed. The RED run before `Plant.tsx` existed failed on the import.
- `npm --prefix client test` (full): 76 files, 599 tests passed.
- `cd client && npx tsc -b`: exit 0.
- `npm --prefix e2e test -- --project=desktop tests/category-goals.spec.ts tests/safe-mode.spec.ts`: 16 passed, 0 failed, 0 flaky.
- `npm --prefix e2e test -- --project=demo tests/demo/category-goals.spec.ts`: 2 passed.
- `cd lint && npm run lint`: 0 errors, 128 warnings, which is the cap (no new warnings). `npm test`: 85 passed.
- Plan greps: `growthStage|GrowthStage|GoalGrowthBar` in client/src and e2e/tests found 0. The hex check in Plant.tsx found 0. `flybudget:goals-bloomed` in growth.ts found 1. `grid-cols-[1fr_auto]` found 1. `GoalPlant` in Goals.tsx found 2. The diff against origin/redesign does not touch the `const complete` line.
- Visual check (scratch render of the four stages at 20 and 80 px, light and dark): the silhouettes are distinct, so no coordinate was changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's no-hex grep matched the issue number in a comment**
- **Found during:** Task 1 acceptance check
- **Issue:** `grep -ci "#[0-9a-f]\{3,6\}"` matched "(#241)" in Plant.tsx's header comment.
- **Fix:** The comment says "issue 241" and explains why.
- **Files modified:** client/src/components/ui/Plant.tsx
- **Commit:** 2be616e

### Scoped out as the plan allows

- The optional partial-funding browser test was not added because the state cannot be reached: the server nulls `fundedAmount` whenever `fundingComplete` is false. The unit test `plantStage(100, false) === 'bud'` covers it.

**Total deviations:** 1 auto-fixed (Rule 1). **Impact:** none on behaviour.

## Notes for later plans

- `docs/ui/HANDOVER-UI.md` (lines 16-18) and `docs/ui/MAP.md` (the `/goals` row) still name `GoalGrowthBar`, `growthStage` and the leading-edge plant. Plan 07 owns those files and should rename them to `GoalPlant`, `ui/Plant` and `plantStage`.
- Plan 06 can render the hero glyph with `<Plant stage="seedling" size={16} ground={false} />`. It renders still with no extra props.

## Known Stubs

None.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 01-06 (the $0 Ready to assign hero, which can reuse `Plant`).

## Self-Check: PASSED

- FOUND: client/src/components/ui/Plant.tsx, client/src/components/ui/Plant.test.ts, client/src/components/goals/GoalPlant.tsx (wt-f)
- FOUND: commits 2be616e and 5064d5e on wave-f (2 commits since dd6fe29)
- GoalGrowthBar.tsx absent
