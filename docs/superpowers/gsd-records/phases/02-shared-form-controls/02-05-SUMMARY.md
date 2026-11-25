---
phase: 02-shared-form-controls
plan: 05
subsystem: ui
tags: [css, tailwind, focus-visible, accessibility, playwright]

requires:
  - phase: 02-shared-form-controls
    provides: "02-02 audit's `## Focus treatment` table (every outline-removing line and its replacement); 02-15 gallery project"
provides:
  - "Global `:focus-visible` outline inside `@layer base`, so a component's own focus utility wins"
  - "Brand focus rings on ContextMenu items, ServerStatus menu items and the bare CategorySelect"
  - "Rule editor and OptionPicker rings on brand-600 instead of the undefined brand-400 step"
  - "Browser tests pinning one focus mark per field, the global outline on a Button, and the menu, rule-editor, server-menu and category-select rings"
affects: [02-shared-form-controls Select plan, phase 03 screen moves, Rules]

actuals:
  tokens: 3755
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Global element rules that utilities must be able to override live in `@layer base`; only rules that must beat utilities (`.scroll-row :focus-visible`, the chart rule) stay unlayered"
    - "A control that removes the outline carries `focus-visible:ring-2 focus-visible:ring-brand-600` (with `ring-inset` inside a clipping menu or popover)"
    - "Browser focus-ring assertions compare the focused element's box-shadow to `--color-brand-600` resolved through a probe element, so colour forms match"

key-files:
  created: []
  modified:
    - client/src/index.css
    - client/src/components/ui/ContextMenu.tsx
    - client/src/components/rules/RuleEditorModal.tsx
    - client/src/components/rules/OptionPicker.tsx
    - client/src/components/layout/ServerStatus.tsx
    - client/src/components/transactions/CategorySelect.tsx
    - DESIGN.md
    - e2e/tests/accessibility.spec.ts
    - e2e/tests/menus.spec.ts

key-decisions:
  - "PayeeCombobox's default class gets no ring: its only default-class caller (TransactionDetailPanel) passes its own 1 px brand ring through `className`, and a focus-visible ring-2 would override that to 2 px"
  - "ServerStatus menu items and ContextMenu items use ring-inset, since they sit flush inside a bordered popover"
  - "The field test uses the Add goal dialog (shared Select with the Input's classes, and the shared Button), because the Add account form uses neither shared component"

patterns-established:
  - "Layered global focus rule: one focus mark per control (D-03)"

requirements-completed: [WAVG-02, WAVG-03]

coverage:
  - id: D1
    description: "A keyboard-focused field shows only its own ring; a Button keeps the global 2 px outline 3 px away"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/accessibility.spec.ts#a field shows one focus mark and a button keeps the global one"
        status: pass
    human_judgment: false
  - id: D2
    description: "A context menu item reached by keyboard shows a focus ring in light and dark"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "e2e/tests/menus.spec.ts#a context menu item shows a focus ring from the keyboard"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rule editor's fields and option picker trigger show a brand-600 ring"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "e2e/tests/accessibility.spec.ts#the rule editor's fields show a brand focus ring"
        status: pass
    human_judgment: false
  - id: D4
    description: "ServerStatus menu items and the bare CategorySelect show a brand-600 ring"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "e2e/tests/accessibility.spec.ts#the server menu items and a bare category select show a brand focus ring"
        status: pass
    human_judgment: false
  - id: D5
    description: "Charts keep the keyboard ring and not after a click; clipped tab rows draw focus inside"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/accessibility.spec.ts#a chart shows the keyboard focus ring, but not after a click"
        status: pass
      - kind: e2e
        ref: "e2e/tests/tabs.spec.ts (desktop project, 13 tests)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-17
status: complete
---

# Phase 2 Plan 05: Layered focus rule Summary

**The global `:focus-visible` outline now sits in `@layer base`, so a field shows only its own ring. ContextMenu, ServerStatus and bare CategorySelect controls draw their own brand-600 ring, and the Rules fields' undefined brand-400 ring now uses brand-600.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-17T12:35:00Z
- **Completed:** 2026-11-17T13:01:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `client/src/index.css`: the global `:focus-visible` rule is inside `@layer base`, and its comment explains why. `.scroll-row :focus-visible` and the chart rule stay unlayered on purpose and are unchanged.
- Every line that the audit's `## Focus treatment` section marks in bold now has a visible keyboard focus mark, or is listed below with the reason it was left alone.
- Four new browser tests pin the behaviour. Each one failed before its code change and passes after it.

## Files whose focus classes changed

| File | Change |
| --- | --- |
| `client/src/components/ui/ContextMenu.tsx` (items, Back item) | `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600` added; `focus:bg-hover` kept |
| `client/src/components/layout/ServerStatus.tsx` (`itemClass`) | the same three classes added |
| `client/src/components/transactions/CategorySelect.tsx` (default class) | `focus-visible:ring-2 focus-visible:ring-brand-600` added; callers that pass `fieldClassName` are unaffected |
| `client/src/components/rules/RuleEditorModal.tsx` (`fieldClass`, tag input wrapper) | `ring-brand-400` → `ring-brand-600` (`focus:`, `focus-within:`) |
| `client/src/components/rules/OptionPicker.tsx` (trigger, search field) | `focus:ring-brand-400` → `focus:ring-brand-600` |
| `client/src/index.css` | global `:focus-visible` moved into `@layer base` |

Only class strings changed in each component file.

## Lines left alone: not keyboard-focusable

These lines are in the audit as "nothing" by design. Script focuses each one, and none is a tab stop:
- `client/src/components/layout/AppShell.tsx:91`: the main scroll region, focused by script after navigation
- `client/src/components/ui/Modal.tsx:206`: the dialog panel (`tabIndex={-1}`)
- `client/src/components/settings/SidebarFeatureSettings.tsx:45`: a heading focused by script (`tabIndex={-1}`)
- `client/src/components/budget/ExpectedNote.tsx:62, 65` and `client/src/components/ui/DatePicker.tsx:121, 123`: React Aria popover and dialog containers; focus moves inside them

Also left alone:
- `client/src/components/transactions/PayeeCombobox.tsx:76`: the default class. Its one default-class caller (`TransactionDetailPanel`) passes its own `focus:ring-1 focus:ring-brand-600`, and the other callers pass `fieldClassName`. A focus ring is visible in every real use, so adding one would only change the detail panel's ring width.

## Hover-only classes on the missing brand step (left for the screens' moves)

These classes are not focus marks:
- `client/src/components/transactions/CategoryPicker.tsx:302`: `hover:border-brand-400`
- `client/src/components/transactions/ImportModal.tsx:655`: `hover:border-brand-400`
- `client/src/components/transactions/YnabImportModal.tsx:289`: `hover:border-brand-400`

## Task Commits

1. **Task 1 (tests first):** `2eb2500` test(e2e): fields show one focus mark and menu items keep theirs (#267)
2. **Task 1 (change):** `38ecf08` fix(ui): the global focus outline no longer doubles a field's own ring (#267)
3. **Task 2:** `83cbac9` fix(ui): rule fields and the remaining outline-free controls show a brand focus ring (#267)

## Verification run

- Before `38ecf08`, the field test failed (outline `solid`, expected `none`) and so did the menu test (box-shadow `none`). Both pass after it.
- With the Task 2 component changes reverted, both Task 2 tests failed. They pass with the changes back.
- `npm --prefix e2e test -- --project=desktop tests/accessibility.spec.ts tests/menus.spec.ts tests/tabs.spec.ts`: 24 passed. This includes the unchanged chart test.
- `npm --prefix e2e test -- --project=desktop tests/accessibility.spec.ts tests/rules.spec.ts tests/menus.spec.ts tests/dialog-focus.spec.ts tests/connection.spec.ts tests/payment-plans.spec.ts`: 38 passed.
- `npm --prefix e2e test -- --project=phone tests/phone/targets-phone.spec.ts`: 5 passed.
- Plan-exit gate `npm --prefix e2e test -- --project=gallery`: 9 passed, 2 skipped. The skipped two are the Linux-only screenshot baselines from 02-15.
- `grep -c 'focus-visible:ring-2' client/src/components/ui/ContextMenu.tsx` gives 2. `grep -c ring-brand-400` in RuleEditorModal and OptionPicker gives 0 each.
- `npm --prefix lint test && npm --prefix lint run lint`: exit 0, 0 errors, 128 warnings (at the cap, unchanged).
- `npm --prefix client run build`: built. Prettier check is clean on every changed file.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Two audit-marked files outside the dispatch file list**
- **Found during:** Task 2
- **Issue:** The audit marks `ServerStatus.tsx:104` ("hover background only") and `CategorySelect.tsx:39` ("nothing visible" with the default class). Task 2 assigns every audit-marked file, but these two were missing from the dispatch's scope list. Without a change, keyboard focus would be invisible on them once the layer moved, which the plan's first prohibition forbids.
- **Fix:** Added ring classes to the class strings only. Added a browser test covering both.
- **Files modified:** `client/src/components/layout/ServerStatus.tsx`, `client/src/components/transactions/CategorySelect.tsx`
- **Committed in:** `83cbac9`

**2. [Rule 3 - Blocking] Test page for the field and button test**
- **Issue:** The plan named the Add account form as having a shared `Input` and `Button`. That form uses neither of them.
- **Fix:** The test uses the Add goal dialog instead. It has the shared `Select`, which uses the same `inputClass` as `Input`, and the shared `Button`.

**Total deviations:** 2 auto-fixed. **Impact on plan:** both were needed to meet the plan's own prohibitions and tests, with no scope creep.

## Issues Encountered

`node_modules` was missing in the root, `client`, `server`, `e2e` and `lint`. I ran `npm ci` in each with the lockfiles, and no package changed.

## UI checker items

1. ContextMenu: closed.
2. Rules ring colour: closed.
3. The Select `ListBoxItem` option treatment belongs to the Select plan and is not in this one.
4. Regression guard: the chart, tabs, dialog-focus, menus and rules specs were rerun, and all pass.

## User Setup Required

None.

## Next Phase Readiness

The layered rule is in place, so shared controls' own focus utilities now take effect. The Select plan must still decide on the option focus treatment (UI-SPEC item 3).

---
*Phase: 02-shared-form-controls*
*Completed: 2026-11-17*

## Self-Check: PASSED

- All 9 modified files exist; commits 2eb2500, 38ecf08 and 83cbac9 are on the branch.
- STATE.md and ROADMAP.md are untouched.
