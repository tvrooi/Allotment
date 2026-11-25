---
phase: 02-shared-form-controls
plan: 20
subsystem: e2e
tags: [e2e, category-picker, search-list, selectors]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 10
    provides: "e2e/tests/fixtures.ts: categoryOption, and the pinned row's role (option)"
  - phase: 02-shared-form-controls
    plan: 17
    provides: "How the role experiment is applied and reverted"
provides:
  - "The import, freshness, polish, recovery and phone specs locate category-list rows only through categoryOption"
  - "The measured list of every category-row selector in this plan's six spec files (below)"
affects: [02-18]
requirements-completed: [WAVG-02, WAVG-03]
actuals:
  tasks: 2
  commits: 2
plan_head_before: 96ce5a6
plan_head_after: 311db4d
tech-stack:
  added: []
  patterns:
    - "The same reverted role experiment as 02-17 (rows role option in CategoryPicker, categoryOption switched to option) finds positive row selectors; negative ones are found by reading"
key-files:
  created: []
  modified:
    - e2e/tests/first-import.spec.ts
    - e2e/tests/polish.spec.ts
    - e2e/tests/recover.spec.ts
    - e2e/tests/phone/phone-native.spec.ts
key-decisions:
  - "polish.spec.ts:59 ('Market', toHaveCount(0)) is not a picker row: the picker is closed there, and it checks the register filtered by 'Not categorised yet'. It stays on the button role"
duration: ~20 min
completed: 2026-11-18
---

# Phase 02 Plan 20: Import, freshness, polish, recovery and phone specs onto categoryOption Summary

**Every category-list row the import, polish, recovery and phone specs locate now goes through
`categoryOption`, measured by a reverted role experiment plus a reading for negative checks. No
client file or fixture is committed.**

## Performance

- Tasks: 2, commits: 2
- Files modified: 4 spec files (2 of the 6 needed no change)

## Measured list (this plan's six spec files)

Line numbers are those of the file before this plan. Same-line replacements, except that
`recover.spec.ts`'s chained locator loses one line and `phone-native.spec.ts`'s import becomes a
multi-line import (Prettier), which shifts its site from 78 to 87.

| File | Line | Kind | Selector before | How found |
|------|------|------|-----------------|-----------|
| `e2e/tests/first-import.spec.ts` | 91 | positive | `page.getByRole('button', { name: 'Miscellaneous' })` | experiment |
| `e2e/tests/polish.spec.ts` | 193 | **negative** (`toHaveCount(0)`, no "Uncategorised" row in "Put $X in an envelope…") | `page.getByRole('button', { name: 'Uncategorised' })` | reading only |
| `e2e/tests/recover.spec.ts` | 47-50 | positive | `page.getByRole('button', { name: /Groceries/ }).first()` | experiment |
| `e2e/tests/phone/phone-native.spec.ts` | 78 (87 after) | positive | `page.getByRole('button', { name: /Streaming Services/ })` | experiment |

Each now reads `categoryOption(page, <same name>)`; none of the four had `exact`, so none has it now.
The `.first()` on the recovery site is kept.

**Files that needed no change:** `e2e/tests/freshness.spec.ts` (fills "Search categories" and
presses Enter) and `e2e/tests/phone/polish-phone.spec.ts` (opens the picker only to measure its
width). Neither locates a row. `phone-native.spec.ts:288-292` (default category) also picks by
search and Enter.

**Kept on the button role (not rows):** triggers (`recover.spec.ts:46` and `phone-native.spec.ts:76`
"Uncategorised" in the details panel, `phone-native.spec.ts:288` "Default category for Corner
Grocery: none", `polish-phone.spec.ts:173` `/^Category:/`; first-import's `Category for …` are labels),
the search field (textbox or placeholder), and `polish.spec.ts:59` ("Market", a register check with
the picker closed). `grep -rn "Create new category" e2e/tests` shows the same 2 button-role
selectors as before; none are in this plan's files.

## How the role experiment was applied

1. `client/src/components/transactions/CategoryPicker.tsx`: `role="option"` on the no-category row
   button and on each section row button (categories and "Transfer: …" share that map), as
   02-10-SUMMARY records for SearchList's pinned row and 02-17 applied it.
2. `e2e/tests/fixtures.ts`: `categoryOption` returned `scope.getByRole('option', …)`.
3. Ran this plan's specs (desktop for the four, phone for the two), moved each failing site, reran.
4. Reverted with `git checkout -- client/src/components/transactions/CategoryPicker.tsx e2e/tests/fixtures.ts`.
   The guard printed `experiment-reverted`. No spec owned by 02-17 or 02-18 was run or edited.

## Runs

- Baseline, unchanged picker, before any change: desktop four specs, 25 passed.
- Task 1, experiment on, before moving: 2 failed (`first-import.spec.ts:91`, `recover.spec.ts:50`),
  23 passed. After moving (plus the polish negative): 25 passed.
- **Negative case** (experiment on): `first-import.spec.ts:91` put back on `getByRole('button', …)`
  made "the first Up import arrives categorised…" fail at line 91 (1 failed, 4 passed). Restored.
- Task 2, experiment on, before moving: 1 failed (`phone-native.spec.ts:78`), 27 passed. After
  moving: 28 passed.
- Experiment reverted, unchanged picker: desktop 25 passed, phone 28 passed.
- `(cd e2e && npx tsc --noEmit)`: exit 0. Prettier on the four changed specs: unchanged.

## Plan verification commands

- `npm --prefix e2e test -- --project=desktop tests/first-import.spec.ts tests/freshness.spec.ts tests/polish.spec.ts tests/recover.spec.ts`: 25 passed.
- `grep -c 'categoryOption' e2e/tests/polish.spec.ts`: 2 (≥ 2).
- `npm --prefix e2e test -- --project=phone tests/phone/phone-native.spec.ts tests/phone/polish-phone.spec.ts`: 28 passed.
- Revert guard: `experiment-reverted` printed.
- `(cd e2e && npx tsc --noEmit)`: exit 0.
- `git diff 96ce5a6..HEAD -- client server`: empty. `git log --name-only 96ce5a6..HEAD` touches only
  the four changed spec files. No skip, retry, timeout or wait added.

## Task Commits

1. **Task 1: import, freshness, polish and recovery specs** - `7562246` (test)
2. **Task 2: phone specs** - `311db4d` (test)

## Decisions Made

- `polish.spec.ts:59` left alone: not a picker row (see key-decisions).

## Deviations from Plan

None. The plan executed as written. The `<start>` for the file check is `96ce5a6`, the worktree's
base, rather than `origin/redesign`. `npm ci` was run in the root, `client`, `server`, `e2e` and
`lint` because `node_modules` was missing. No lockfile changed.

## Issues Encountered

None.

## Next Phase Readiness

Plan 02-18 can switch `categoryOption`'s role to `option` for these six specs too. The no-category
negative check at `polish.spec.ts:193` now follows the helper's role.

## Self-Check: PASSED

- `e2e/tests/polish.spec.ts` contains `categoryOption` (2).
- Commits `7562246` and `311db4d` exist on `worktree-agent-p0220-a1`.
- No STATE.md, ROADMAP.md, client or fixtures change.
