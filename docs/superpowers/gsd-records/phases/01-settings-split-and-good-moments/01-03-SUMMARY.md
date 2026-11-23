---
phase: 01-settings-split-and-good-moments
plan: 03
subsystem: ui
tags: [react, react-router, playwright, vitest, categories, settings, budget]

requires:
  - "01-01: the sub-page frame (PageHeader breadcrumbs, useScrollMemory, PAGE_GUTTER), CONNECTED_BANKS_PATH"
  - "01-02: the movedSections source guard"
provides:
  - "Lazy page /budget/categories (pages/BudgetCategories.tsx, default export BudgetCategoriesPage), scroll memory 'budget-categories'"
  - "movedSections.ts: CATEGORIES_PATH; movedSettingsTab(params: URLSearchParams) keeps the other query parameters and drops tab"
  - "Settings: eight tabs (Accounts, Budget, Tags, Currencies, Priorities, Data, Preferences, Server), default accounts, redirect after the hooks"
  - "Budget header link 'Categories' (768 px and up, data-guide budget.manage-categories) and phone menu item 'Categories' after 'Year'"
  - "Budget empty table: 'No categories yet.' + 'Set up your categories' -> /budget/categories"
  - "Review's 'Hide unused categories' opens /budget/categories; MANAGE_CATEGORIES_LINK removed"
  - "PageHeader breadcrumb links at least 44 px wide on phones (max-md:min-w-11)"
  - "Source guard also forbids '/budget/categories' outside utils/movedSections.ts"
affects: [01-04, 01-05, 01-06, 01-07, guides, command-palette, docs-ui-map]

actuals:
  tokens: 3981
  tasks: 3
  commits: 3
plan_head_before: 6267de4f76fefa5ede82afd14ea61e96817e5943
plan_head_after: 90af5e4d02dbe8188a0f79e7d17202ac4c944040

tech-stack:
  added: []
  patterns:
    - "Redirect helper over the whole URLSearchParams: look the tab up with Object.hasOwn, copy the params, delete tab, append the rest as a query string"
    - "A page that is itself the lazy chunk imports its panel statically (no inner Suspense)"

key-files:
  created:
    - client/src/pages/BudgetCategories.tsx
  modified:
    - client/src/utils/movedSections.ts
    - client/src/utils/movedSections.test.ts
    - client/src/App.tsx
    - client/src/pages/Settings.tsx
    - client/src/pages/Budget.tsx
    - client/src/components/review/Housekeeping.tsx
    - client/src/components/ui/PageHeader.tsx
    - e2e/tests/settings.spec.ts
    - e2e/tests/budget.spec.ts
    - e2e/tests/menus.spec.ts
    - e2e/tests/accessibility.spec.ts
    - e2e/tests/demo/demo.spec.ts
    - e2e/tests/phone/targets-phone.spec.ts
    - e2e/tests/phone/phone.spec.ts
    - e2e/tests/phone/page-gutter.spec.ts

key-decisions:
  - "The Budget header link uses data-guide budget.manage-categories, so budget.categories still marks only the envelope list that guides/budget.ts and guides/welcome.ts target (RESEARCH Pitfall 3)"
  - "Phone breadcrumb links get max-md:min-w-11: the new targets test found 'Budget' at 41x48 px; the Link is a flex item, so min-width applies without changing the row"
  - "Budget.tsx was restored from origin/redesign and gained only the three entry points: 1484 lines (redesign 1466, +18)"

patterns-established:
  - "Moved Settings tabs: add the target path constant and one MOVED_SETTINGS_TABS entry in movedSections.ts; the redirect and its parameter handling come for free"

requirements-completed: [WAVF-02, WAVF-03]

coverage:
  - id: D1
    description: "/budget/categories renders the unchanged CategoryManager under PageHeader 'Budget > Categories'; every category e2e (add, edit, icons, reorder, delete) passes against it"
    requirement: "WAVF-02"
    verification:
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/settings.spec.ts tests/navigation.spec.ts (27 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings has eight tabs in the redesign order and opens on Accounts; an unknown ?tab= also selects Accounts"
    requirement: "WAVF-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/settings.spec.ts#Settings has eight tabs and opens on Accounts"
        status: pass
    human_judgment: false
  - id: D3
    description: "/settings?tab=connections and ?tab=categories redirect with replace to their pages, keep other parameters, drop tab, and Back skips the old URL; constructor/toString refused"
    requirement: "WAVF-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/settings.spec.ts#old links to Connected banks and Categories open their new pages, keep their parameters and leave no trace in history"
        status: pass
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#movedSettingsTab (#244)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Budget opens Categories from the header (768 px and up) and the phone menu (second item); the breadcrumb returns to Budget; the empty table links 'Set up your categories'"
    requirement: "WAVF-02"
    verification:
      - kind: e2e
        ref: "e2e/tests/budget.spec.ts#Categories opens the category page from Budget, and the breadcrumb returns (#244)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/phone/targets-phone.spec.ts#the Budget menu opens Categories on a phone (#244)"
        status: pass
    human_judgment: false
  - id: D5
    description: "At 390 px the Categories page has full-size buttons and breadcrumb, no sideways scroll, the shared gutter, and no nameless controls; demo routes include both new pages"
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/targets-phone.spec.ts#the category list on the Categories page has full-size buttons"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=phone tests/phone/phone.spec.ts tests/phone/page-gutter.spec.ts tests/phone/polish-phone.spec.ts (19 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/menus.spec.ts tests/accessibility.spec.ts (14 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts (14 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "One module spells both moved paths; a unit test fails if any other client source writes /budget/categories"
    requirement: "WAVF-03"
    verification:
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#the moved sections' addresses are written in one place (plant in Housekeeping.tsx caught, reverted)"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 768-1024 px the Budget header's action group wraps tidily with the new Categories link, light and dark"
    verification: []
    human_judgment: true
    rationale: "Visual layout judgment; no test asserts the wrap at tablet widths. Screenshots are taken in plan 07"

duration: 11min
completed: 2026-11-15
status: complete
---

# Phase 1 Plan 03: Categories under Budget, Settings opens on Accounts Summary

**Categories is its own lazy page at `/budget/categories` (breadcrumb Budget › Categories), opened from the Budget header, the phone menu, the empty table and Review. Settings has eight tabs and opens on Accounts, and both old `?tab=` links redirect with replace while keeping every other query parameter.**

This replaces PR #273's in-page `?view=categories` view and its Preferences-first Settings (D-07).

## Performance

- **Duration:** about 11 min
- **Started:** 2026-11-15T03:48:06Z
- **Completed:** 2026-11-15T03:59:22Z
- **Tasks:** 3 of 3
- **Files modified:** 16 on `wave-f` (1 created, 15 modified)

## Accomplishments

- `movedSections.ts` adds `CATEGORIES_PATH = '/budget/categories'`. `movedSettingsTab(params: URLSearchParams)` looks `tab` up with `Object.hasOwn`, copies the parameters, removes `tab` and adds whatever is left as a query string. The destination is always a constant (T-01-07, T-01-08).
- `pages/BudgetCategories.tsx` copies the Connected banks frame: `useScrollMemory('budget-categories')`, `PAGE_GUTTER`, `max-w-2xl`, and `CategoryManager` imported statically. `App.tsx` lazy-loads it at `CATEGORIES_PATH`, next to `/budget/category/:id`.
- Settings has the redesign order without the two moved tabs: Accounts, Budget, Tags, Currencies, Priorities, Data, Preferences, Server. The fallback is `accounts`. `movedSettingsTab(searchParams)` and its `Navigate replace` come after every hook.
- `Budget.tsx` was restored from `origin/redesign`, removing #273's view, its lazy import and its search-row change. It then gained three entry points:
  - a "Categories" `ButtonLink` after `AssignMenu`, marked `budget.manage-categories`;
  - a phone menu item after "Year";
  - the empty-table link "Set up your categories".
  - Final line count: **1484** (for plan 07's MAP.md recount).
- `Housekeeping.tsx` now links to `CATEGORIES_PATH`, and `MANAGE_CATEGORIES_LINK` is deleted. Nothing in `client/src` or `e2e/tests` mentions `view=categories` any more.

## Task Commits

On `wave-f` in `/Users/tristanvanrooyen/wt-f` (not pushed):

1. **Task 1 (tracer): an old Categories link lands on the Categories page, parameters kept**: `b98252c` (feat)
2. **Task 2: Budget's own ways in, temporary name gone**: `a614e09` (feat)
3. **Task 3: category specs and route sweeps use the new page**: `90af5e4` (test)

**Plan metadata:** this SUMMARY's commit in the planning checkout (`redesign`)

## Files Created/Modified

- `client/src/pages/BudgetCategories.tsx`: the new page.
- `client/src/utils/movedSections.ts` (+ test): `CATEGORIES_PATH`, the redirect over the whole query string, and the guard extended to `/budget/categories`.
- `client/src/App.tsx`: lazy `BudgetCategoriesPage` route.
- `client/src/pages/Settings.tsx`: tab order, default `accounts`, redirect after the hooks. The comment about Preferences opening first is removed.
- `client/src/pages/Budget.tsx`: redesign's file plus the three entry points.
- `client/src/components/review/Housekeeping.tsx`: "Hide unused categories" goes to `CATEGORIES_PATH`.
- `client/src/components/ui/PageHeader.tsx`: phone breadcrumb links are at least 44 px wide.
- e2e changes:
  - `settings`: two rewritten tests; the categories `beforeEach` opens `/budget/categories`.
  - `budget`: #273's test is replaced by the header-link and breadcrumb test.
  - `phone/targets-phone`: a new menu test, plus the renamed category-buttons test with the breadcrumb added.
  - `menus`, `accessibility`, `demo/demo`, `phone/phone` and `phone/page-gutter`: re-pointed at the page or extended with it.

## Verification Run (Node v24.10.0, one browser run at a time)

| Command | Result |
|---|---|
| Precondition: wave-f branch, Node v24 | met |
| `npm --prefix client test -- src/utils/movedSections.test.ts` (Task 1) | RED 2 failed / 7 passed, then GREEN 9 passed |
| `npm --prefix e2e test -- --project=desktop tests/settings.spec.ts tests/navigation.spec.ts` | 27 passed (re-run after restoring the Up panel assertion: 27 passed) |
| desktop `budget.spec.ts -g "Categories opens the category page"` before the Budget edit | RED: 1 failed (link not found) |
| `npm --prefix client test -- src/utils/movedSections.test.ts src/utils/guides.test.ts` | 29 passed |
| Guard with a planted `"/budget/categories"` in `Housekeeping.tsx` | failed as intended, plant reverted |
| desktop `budget.spec.ts` | 23 passed |
| phone `targets-phone.spec.ts` | first run 1 failed (breadcrumb "Budget" 41x48 px), after the PageHeader fix 5 passed |
| desktop `menus.spec.ts accessibility.spec.ts` | 14 passed |
| demo `demo/demo.spec.ts` | 14 passed |
| phone `phone.spec.ts page-gutter.spec.ts polish-phone.spec.ts` | 19 passed |
| desktop `settings navigation budget review` on the final tree | 57 passed |
| `npm --prefix client test` (full) | 75 files, 584 tests passed |
| `cd client && npx tsc --noEmit` | exit 0 |
| `npm --prefix client run build` | built |
| `cd lint && npm run lint` | 0 errors, 128 warnings (cap 128, unchanged) |
| Acceptance greps (all tasks) | all pass. For example: `CATEGORIES_PATH` in movedSections 4, Budget.tsx 4, Housekeeping 2; `MANAGE_CATEGORIES_LINK` 0; `view=categories` 0; `tab=` in e2e 2; `budget.categories` marker 1; Budget.tsx 1484 lines |

Tracer gate (auto mode): the Task 1 verify was re-run on the final Task 1 tree and passed before Task 2 started.

## Decisions Made

- The header link's marker is `budget.manage-categories`, not the UI-SPEC's `budget.categories`. The envelope list already carries that marker, and two guides target it (Pitfall 3).
- Phone breadcrumb links get `max-md:min-w-11`. Because the link is a flex item, the minimum width applies without changing the row height.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Short breadcrumb labels were under 44 px wide on phones**
- **Found during:** Task 2 (the plan added the "Budget" breadcrumb to the `undersized` list)
- **Issue:** "Budget" measured 41x48 px at 390 px. Plan 01-01 only gave breadcrumbs a 48 px height, so a short label is narrower than 44 px.
- **Fix:** `max-md:min-w-11` on PageHeader breadcrumb links, with a comment explaining why. The change only applies on phones. Files and the report widget view share it, and the change can only make their links larger.
- **Files modified:** `client/src/components/ui/PageHeader.tsx` (not in the plan's file list)
- **Verification:** `targets-phone` 5 passed; `phone`, `page-gutter` and `polish-phone` 19 passed
- **Committed in:** `a614e09`

**Process notes:**
- Task 1: the plan's new redirect test leaves out 01-01's "How connecting Up works" assertion. I kept that assertion, so existing coverage is not lost.
- Task 1's two browser tests were not run before the implementation, to save a build cycle. They assert routes, a query string and a tab order that did not exist at `6267de4`. RED was observed for the unit tests (2 failed) and for Task 2's desktop test (1 failed).
- The guard extension is a regression test. It passed on the real tree, and a planted literal showed that it can fail.

**Total deviations:** 1 auto-fixed (Rule 1), plus 3 process notes. **Impact:** one shared component gained a phone-only minimum width; no scope creep.

## Issues Encountered

None beyond the breadcrumb width above.

## Known Stubs

None.

## Threat Flags

None.
- T-01-07: the destination comes only from the moved-tabs constants via `Object.hasOwn`; `constructor` and `toString` are rejected in a unit test.
- T-01-08: the other parameters are re-encoded through `URLSearchParams` and only ever go into the query string.
- T-01-09: neither target is a `/settings` route, and the browser test loads both old links.
- T-01-SC: no package was installed or changed, and nothing under `server/` was touched.

## User Setup Required

None.

## Next Phase Readiness

- Plan 07's MAP.md recount: `Budget.tsx` is 1484 lines, and the page `/budget/categories` needs a row.
- UI-SPEC still expects a palette-only "Categories" result (`Layers`, `CATEGORIES_PATH`), along with the guide and docs wording sweep. Both belong to their own plans, and both must import `CATEGORIES_PATH`, because the guard rejects the literal.
- D7 (how the Budget header wraps at 768-1024 px) needs the plan 07 screenshots.

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND: /Users/tristanvanrooyen/wt-f/client/src/pages/BudgetCategories.tsx
- FOUND on wave-f: b98252c, a614e09, 90af5e4 (ancestors of HEAD `90af5e4`; 3 commits after `6267de4`)
- wave-f holds no `.planning` file
