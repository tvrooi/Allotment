---
phase: 01-settings-split-and-good-moments
reviewed: 2026-11-16T00:18:19Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - client/src/components/goals/GoalPlant.tsx
  - client/src/components/goals/growth.test.ts
  - client/src/components/goals/growth.ts
  - client/src/userGuide/articles.tsx
  - docs/BUDGET-REVIEW.md
  - docs/ENVELOPE-FUNDING.md
  - e2e/tests/category-goals.spec.ts
  - lint/terms/terms.test.js
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
  necessity: 0
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-16T00:18:19Z  
**Depth:** standard  
**Files Reviewed:** 8  
**Status:** issues_found

## Summary

Incremental review of `575c3ea48bd32f791a1417762140a1a7bd482c0a..1b6f5f6941799b5ead62808b3f18551a552391d7` in `/Users/tristanvanrooyen/wt-f`, whose HEAD matches the latter commit. The eight relative paths above all refer to that checkout. Read the changed files, their diff, the goal row/group callers, Plant, goal mutation invalidation, test fixtures, and the matching funding-status label. The planning checkout's old application source was not reviewed.

The in-place completion and dip/return defects from the earlier WR-01 are fixed. Initial completion and subsequent remount also work under the installed React's StrictMode. One part of WR-01 remains: initial bloom history is still written during render, despite the new comment saying otherwise. The deterministic interrupted-mount probe below demonstrates the robustness problem; an ordinary application navigation reproducer was not established.

Earlier WR-04 is fixed: the guide and both scoped documents use the current label, and the terminology guard is case-insensitive. Earlier WR-02, WR-03 and IN-01 concern files outside this incremental scope; their omission here is not a declaration that they are fixed. Their existing disposition file was left untouched.

No money, authentication, migration or secret-handling changes occur in this diff. Necessity review was applied with no findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Initial bloom history is still consumed before the row commits

**File:** `/Users/tristanvanrooyen/wt-f/client/src/components/goals/GoalPlant.tsx:25-26`  
**Classification:** WARNING (P1; robustness, residual portion of earlier WR-01)  
**Issue:** With `complete=true`, the lazy state initializer calls `nextBloom(goalId, false, true, false)`, which calls `firstBloom` and writes `flybudget:goals-bloomed` immediately. Thus a first render that React abandons has already consumed the goal's one-time bloom even though no flower was committed. A later successful mount reads that ID and stays still. The effect cannot repair it because `seen` starts with `complete=true`. Lines 21–24 incorrectly claim the decision never happens during render.

**Evidence:** Bundled the actual unchanged GoalPlant and Plant source in memory with the checkout's installed React and mounted it in isolated Chromium with mock goal IDs, `createRoot`, StrictMode and `act`. A reached goal followed by a sibling that suspends inside a Suspense boundary produced no committed goal SVG, while localStorage already contained its ID. Discarding that tree and mounting the same reached goal without the suspending sibling produced `data-bloom="false"`. Observed output:

```json
{
  "suspendedPlant": null,
  "suspendedStored": "[\"mounted\",\"initial\",\"aborted\"]",
  "afterAbortedMount": "false"
}
```

This is a component-level interrupted-mount reproduction using an injected suspending sibling, not evidence that the current Goals page routinely suspends after rendering its rows. The actual app uses a concurrent root (`client/src/main.tsx:50-56`) and a page Suspense boundary (`client/src/App.tsx:49-54`). Ordinary StrictMode mounting alone does **not** reproduce a missed bloom: the installed renderer retains the first initializer result, and the probe observed the correct initial bloom. The warning concerns writing durable history before commit, not a claim that StrictMode necessarily loses the initializer's first value.

**Fix:** Start with pure state and a not-yet-complete ref, so the existing guarded layout effect decides both initial and subsequent blooms:

```tsx
const [bloom, setBloom] = useState(false);
const seen = useRef({ complete: false, bloom: false });
useLayoutEffect(() => {
  const next = nextBloom(goalId, seen.current.complete, complete, seen.current.bloom);
  seen.current = { complete, bloom: next };
  setBloom(next);
}, [goalId, complete]);
```

The current caller keys GoalRow by goal ID, so each goal already gets its own component lifetime. Keep the first-paint layout effect and its replay guard. Add a component regression asserting that an abandoned initial render does not write bloom history and that its later committed mount blooms once. Helper-only tests cannot exercise this lifecycle.

## Verification

- `PATH=/usr/local/bin:$PATH npm test --prefix client -- src/components/goals/growth.test.ts src/components/ui/Plant.test.ts`: **25 tests passed** across two files. The initial sandboxed attempt could not write Vite's temporary config cache; the approved retry passed.
- `node --test lint/terms/terms.test.js`: **6 tests passed**, including the new case-insensitive retired-label check.
- `PATH=/usr/local/bin:$PATH node client/node_modules/typescript/bin/tsc --noEmit -p e2e/tsconfig.json`: **passed**.
- Isolated Chromium component probe against the actual source: incomplete → reached → dip → reached yielded bloom values **false → true → false → false**; an initially reached goal yielded **true**, then **false** after remount. The interrupted-mount case yielded the warning above. The probe used mocked goals, an intercepted synthetic origin and an in-memory bundle, with no application server or budget.
- `git -C /Users/tristanvanrooyen/wt-f diff --check 575c3ea..1b6f5f6`: **passed**.
- Full client build and full application Playwright suite were **not run** in this read-only incremental review. The isolated probe does not substitute for the new category-goals end-to-end tests; the orchestrator should retain that verification gate.
- Source checkout status remained unchanged: only the pre-existing untracked `.omc/` directory. No source changes, commits, pushes or disposition changes were made.

Herdr identity and runtime checks passed. The configured reviewer skill query returned no additional skills. No structural pre-pass or external reviewer evidence was supplied.

---

_Reviewer: Codex (gsd-code-reviewer)_  
_Depth: standard_

