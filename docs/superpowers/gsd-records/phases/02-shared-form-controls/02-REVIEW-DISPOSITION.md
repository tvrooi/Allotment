---
phase: 02-shared-form-controls
updated: 2026-11-19
sources: [02-REVIEW.md (iteration 1, c3a73ce6), 02-REVIEW-FIX.md, 02-REVIEW-2.md (iteration 2, 3be0aefb)]
---

# Phase 02: Code Review Disposition

Legend: `open` (untriaged), `fixed` (commit in 02-REVIEW-FIX.md, confirmed by 02-REVIEW-2.md),
`skipped` (fixer declined), `deferred` (triaged, reason given). Edit a row's disposition by hand,
with the reason in the Source cell.

## Iteration 1 (02-REVIEW.md)

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| WR-01 | warning | fixed | 65b2eda9; verified by mutation in 02-REVIEW-2 |
| WR-02 | warning | fixed | 445039c3; verified by mutation in 02-REVIEW-2 |
| WR-03 | warning | fixed | a1c7d181; verified by reasoning (e2e) in 02-REVIEW-2 |
| WR-04 | warning | fixed | 40318792 (refactor, listItems.tsx) |
| WR-05 | warning | fixed | 4b6363f3; verified by mutation in 02-REVIEW-2 |
| WR-06 | warning | fixed | c751eb60 |
| WR-07 | warning | fixed | 9da7412c |
| IN-01 | info | deferred | Phase 3 (screens on shared controls) touches the picker classes; fold fieldClasses.ts consolidation in there |
| IN-02 | info | deferred | Phase 3: MonthPicker month names via date-fns, alongside the locale work |
| IN-03 | info | deferred | Phase 3: upper bound on the month grid's Next year; low impact |
| IN-04 | info | deferred | Phase 3/4: dev gallery theme button writes the saved theme; dev-only page |
| IN-05 | info | fixed | b6c77d13 (pulled into fix scope) |

Also fixed from verification (not REVIEW ids): T-02-44 (7d0d18f0), T-02-10 (c34654fb), UI-REVIEW
top 3 (e2f8a3fa, df96fab6, aa664cdd), gallery baselines remade with reason (ec6e3530, checked
region by region in 02-REVIEW-2).

## Iteration 2 (02-REVIEW-2.md: 0 critical, 0 warning, 3 info)

Ids restart in each iteration; these are recorded as R2-IN-nn so they do not collide with the rows above.

| ID | Severity | Disposition | Source |
|----|----------|-------------|--------|
| R2-IN-01 | info | deferred | Owner check: Switch restyle makes Welcome.tsx feature prompts primary text and wrapped rows ~20 px taller at 390 px. Likely intended (D-03 consistency); owner to confirm, else Phase 3 restores text-secondary on Welcome |
| R2-IN-02 | info | deferred | Phase 3: dev-gallery offline create can collide ids (slug); dev-only |
| R2-IN-03 | info | deferred | Phase 3: remove the vacuous `not.toContain('FieldError')` at Select.test.ts:149 (the test's other assertion guards WR-05) |

Residual (unverified, carried from iteration 1): whether a payee typed in the detail panel is saved
when a second Escape closes the panel. Phase 3 (WAVG-05 detail panel work) should assert it.
