---
phase: 03-screens-on-shared-controls
plan: 22
subsystem: ui
tags: [wave-g, g3, import, number-field, select, d-14, d-17]
requires:
  - phase: 03-screens-on-shared-controls
    provides: 'G3 reconcile: match (03-16); shared NumberField, Select, Field, Input, Checkbox (G1/G2)'
provides:
  - 'ImportModal.tsx (CSV/CAMT import wizard) on the shared controls; only the native file input is left'
  - 'Rows above the header bounded to 0..min(1000, rows - 1) with Preview gated while invalid'
affects: [03-23, 03-25]
tech-stack:
  added: []
  patterns:
    - 'A bounded count gates its action through useAmountValidity + AmountFields around a NumberField'
    - 'Spec checks of a shared Select read the trigger button text (toHaveText) and choose through chooseOption'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-22-SUMMARY.md
  modified:
    - client/src/components/transactions/ImportModal.tsx
    - e2e/tests/data.spec.ts
    - e2e/tests/switchers.spec.ts
key-decisions:
  - 'skipRowsDraft was removed, not kept: NumberField owns the typed draft, so a second copy would be dead state'
  - 'Every ImportModal field uses fieldSize sm (UI-SPEC lists ImportModal among the sm Selects), Statement included'
  - 'The 1000 cap is a local constant beside MAX_IMPORT_ROWS, pointing at skipRows in server/src/utils/importSettings.ts (csv.ts is outside this plan)'
requirements-completed: []
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: 3a813d920871f19b8ffb3bbc06985721bda5a9f6
commits: 2
actuals:
  tokens: 8900
  tasks: 2
  commits: 2
duration: 95min
completed: 2026-11-20
status: complete
---

# Phase 3 Plan 22: Import wizard on the shared controls Summary

**ImportModal.tsx now uses the shared controls throughout. Rows above the header is a NumberField capped at min(1000, the file's rows less one), with its own messages, and Preview stays disabled while the field is invalid. Statement, Separator, Encoding, Dates, Amounts and each column's role are the shared Select. The word for money out is Field with Input, and the preview rows use Checkbox. The bank file input stays native.**

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | `42815d0e` | feat(03-22): bound Rows above the header with the shared NumberField |
| 2 | `3a813d92` | feat(03-22): move the CSV/CAMT import wizard onto the shared controls |

## TDD (Task 1)

- RED: two new tests failed on the old code: `rows above the header stop at the server's cap of 1000` and `a file with no room above its header takes only 0`. The field was a spinbutton, so `getByRole('textbox', { name: 'Rows above the header' })` found nothing. The old code also had no 1000 cap: its max was rows less one, so 1001 was accepted in a 1003-row file.
- GREEN: after the change, `tests/data.spec.ts` passed in full: 28 passed.

## Behaviour changes

- **Rows above the header** (D-14) is a text field with a numeric keyboard. It accepts a whole number from 0 to `min(1000, rows - 1)`.
  - Outside that range it shows "Enter a whole number from 0 to {max}.".
  - A file with only a header row shows "Enter 0 — this file has no rows above the header." for anything but 0.
  - Invalid text stays visible after blur, and the last valid table stays on screen.
  - Preview is disabled until the text is valid.
  - Before, the field accepted any row up to rows less one, even past the server's limit of 1000. On blur it snapped back to the last valid number.
- Separator, Encoding, Dates, Amounts, Statement and the column roles are React Aria Selects on desktop and native selects on phones (D-04).
  - The labels and option labels are unchanged.
  - Unset Dates and Amounts show "Choose…" as the placeholder, as the old empty option did.
- The visible labels now use the shared label style. Before, they were the compact 12 px tertiary text.
- The way an import creates transactions, accounts or categories is unchanged: same rows, stable IDs and deleted-import handling. Only the controls that feed the existing state changed. The import specs show this: totals, duplicates, undo, CAMT and the remembered settings all pass.

## Selector changes

| Spec | Was | Now | Reason |
| --- | --- | --- | --- |
| data.spec.ts (3 sites) | `getByRole('spinbutton', { name: 'Rows above the header' })` | `getByRole('textbox', …)` | D-14: NumberField is a text field with a numeric keyboard |
| data.spec.ts (25 checks) | `getByRole('combobox', { name: X }).toHaveValue(v)` for Column …, Separator, Dates, Amounts | `getByRole('button', { name: X }).toHaveText(label)` | The shared Select's desktop trigger is a button named by value + label. Its text is the chosen option's label (date→Date, dmy→DD/MM/YYYY, comma→1.234,56, ''→Choose…) |
| data.spec.ts (15 picks) | `.selectOption(v)` on those fields and Encoding | `chooseOption(button, label)` | The one way specs choose from the shared Select (fixtures.ts) |
| data.spec.ts:130 | `getByRole('checkbox', …).check()` | `setToggle(…)` | React Aria's hidden input; the label takes the click |
| switchers.spec.ts:46 only | `combobox 'Column Category'` `toHaveValue('category')` | `button 'Column Category'` `toHaveText('Category')` | ImportModal's column role moved. Lines 50-59 and 142-147 (ImportCategories, YnabImportModal, plan 03-25) and the bank-connection lines (Phase 4) are untouched |

New test: `asks which statement to import from a file for several accounts`. It uses a two-account CAMT file, chooses the second statement through `chooseOption` on `button 'Statement'`, and imports only that statement. Every named control (Statement, Separator, Encoding, Rows above the header, Dates, Amounts, Word for money out) is now found by role and name in data.spec.ts.

## Stays native

- `client/src/components/transactions/ImportModal.tsx` bank file input, `<input id="csv-file-input" type="file">` (D-17, the browser's file dialog). It is now at line 703 (`type="file"`). The perl gate excludes it.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix e2e test -- --project=desktop tests/data.spec.ts tests/switchers.spec.ts tests/first-import.spec.ts` | 39 passed, exit 0 |
| `npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts` | 14 passed, exit 0 |
| `grep -c "'spinbutton', { name: 'Rows above the header'" e2e/tests/data.spec.ts` | 0 |
| raw-control perl gate over ImportModal.tsx | 0 (was 10); 1 `type="file"` left |
| `npm --prefix lint test` / `npm --prefix lint run lint` | 86/86 pass; 0 errors, 122 warnings = cap (`--max-warnings=122`), exit 0. ImportModal's 2 warnings are the existing drop zone div |
| `cd client && npx tsc --noEmit` | exit 0 |
| `npm --prefix client test` (vitest) | 947/947 passed |
| Prettier (3.9.10, the lockfile version) on the changed files | formatted |

Run on Node 24. The e2e runs waited for the shared ports 3169-3180 (sibling G3 executors) and retried on EADDRINUSE. The desktop run's server on 3171 was confirmed to be this worktree's.

## Deviations from Plan

1. **[Rule 1 - judgment] `skipRowsDraft` was removed, not kept.** The plan said "keep skipRowsDraft as the draft". NumberField keeps the typed draft itself (and keeps the last valid table, because only valid values reach `onChange`), so the separate state would have been dead code that copies NumberField's draft. The behaviour the plan asks for still holds and is tested: invalid text stays visible and the table keeps its last valid state.
2. **[Rule 2 - test coverage] New Statement test.** No spec reached the Statement field, and the acceptance criterion asks for each name to be found by role, so a two-account CAMT test was added.
3. **Statement is at fieldSize sm.** UI-SPEC lists ImportModal among the sm Selects, so every ImportModal field uses sm for consistency.
4. **Environment:** node_modules are symlinks to the main checkout's installs (lockfiles identical, ignored by git, not committed).

## Known Stubs

None.

## Threat Flags

None. T-03-31 is mitigated: Rows above the header now matches importSettings.ts (0..1000) and Preview is gated. T-03-SC: no package was added.

## Self-Check: PASSED

- `client/src/components/transactions/ImportModal.tsx` contains `<NumberField` (FOUND)
- Commits `42815d0e` and `3a813d92` are ancestors of HEAD (FOUND)
- No STATE.md or ROADMAP.md change

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-20_
