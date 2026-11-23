---
phase: 03-screens-on-shared-controls
plan: 19
subsystem: ui
tags: [wave-g, g3, long-term-forecast, numberfield, select, combobox, checkbox, radiogroup, d-14]
requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-16 G3 reconcile record (G3 reconcile: match) and the 03-19 gate baselines'
provides:
  - 'longterm/fields.tsx WholeNumberField and RateField built on the shared NumberField (one bounded-number implementation)'
  - 'A recurring event Last year bounded to 1900-2300 or blank (D-14), with an e2e case'
  - 'The long-term forecast page, event editor and five panels on the shared Select, Combobox, Checkbox, RadioGroup, Field and Input'
affects: [03-23]
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: 4a46d000
commits: 5
actuals:
  tokens: 36000
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - 'An "add one" Combobox that never holds a choice is redrawn with a key after each pick and focus is put back on its input'
    - 'Specs pick from a Combobox holding a chosen value by emptying it first, then typing (as recurring.spec.ts does)'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-19-SUMMARY.md
  modified:
    - client/src/components/longterm/fields.tsx
    - client/src/components/longterm/EventEditor.tsx
    - client/src/components/longterm/EventList.tsx
    - client/src/components/longterm/LongTermForecast.tsx
    - client/src/components/longterm/SavingsPanel.tsx
    - client/src/components/longterm/SimulationPanel.tsx
    - client/src/components/longterm/AccountsPanel.tsx
    - client/src/components/longterm/AssumptionsPanel.tsx
    - e2e/tests/long-term-forecast.spec.ts
    - e2e/tests/demo/long-term-forecast.spec.ts
    - e2e/tests/phone/long-term-forecast.spec.ts
key-decisions:
  - 'RateField renders NumberField with allowDecimal, precision 2, suffix %, its own errorMessage and the assumption hint plus Use default as description; onChange gets Math.round(percent * 100) bps, the formula inputToBps uses'
  - 'Last year has no placeholder (NumberField takes none); its description reads "Leave blank for no end"'
  - 'Plan, Compare with and Loan use the Combobox default menuTrigger (open on typing or the chevron), as PaydayPlan and EditCategoryModal do'
  - 'The Year select is named by its visible label "See what made up a year" (it was aria-label "Year")'
  - 'The phone spec was changed (outside files_modified): Compare with is a Combobox at every width, so selectOption cannot reach it'
requirements-completed: []
coverage:
  - id: D1
    description: 'WholeNumberField and RateField on NumberField, names, props, messages and Use default kept'
    requirement: WAVG-06
    verification:
      - kind: e2e
        ref: 'e2e/tests/long-term-forecast.spec.ts (desktop, 11/11), including "typing, Enter and the first click" (Inflation 3x blocks Save) and the Assumption default checks'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Recurring event Last year: blank, 1900 and 2300 accepted; 1800, 2301, 2025.5 marked and block Create'
    requirement: WAVG-06
    verification:
      - kind: e2e
        ref: "e2e/tests/long-term-forecast.spec.ts#a recurring event's last year is blank for no end, or a whole year from 1900 to 2300"
        status: pass
    human_judgment: false
  - id: D3
    description: 'Long-term page, editor and panels on shared controls; gate prints 0'
    requirement: WAVG-06
    verification:
      - kind: e2e
        ref: 'long-term-forecast.spec.ts on desktop (11 passed), demo (1 passed), phone (1 passed)'
        status: pass
      - kind: other
        ref: 'raw-control perl gate over the 8 longterm files: 0 (HEAD 18); type="number" in EventEditor.tsx: 0 (HEAD 1)'
        status: pass
    human_judgment: false
  - id: D4
    description: 'Look of the moved controls (labels now the shared 14 px label, Select and Combobox triggers)'
    verification: []
    human_judgment: true
    rationale: 'Visual parity is judged in the G3 PR (03-23); no screenshot baseline covers the long-term screens'
duration: 75min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 19: Long-term forecast on the shared controls Summary

**The long-term forecast's private number fields now render the shared NumberField, a recurring event's Last year accepts only 1900-2300 or blank, and the page, event editor and five panels use only shared controls. The 8-file gate reads 0 (was 18).**

## Performance

- Duration: about 75 min (including waits for the shared e2e ports and a usage-limit pause)
- Tasks: 3 of 3, plus one fix commit
- Files modified: 8 components, 3 specs

## Accomplishments

- `fields.tsx`: `WholeNumberField` and `RateField` keep their names and props but render `NumberField`. No `useReportAmountValidity` call of its own is left. The messages are unchanged: whole numbers use the shared `Enter a whole number from {min} to {max}.` (the same text as before), and rates pass `Enter a rate between {min}% and {max}%` as `errorMessage`. The "Assumption, default N%" hint and its "Use default" button are the field's description. `WhenField` and `EscalationField` use the shared `Select`. `MoneyField` labels its `CurrencyInput` by id with the shared `Label`, and its help line is tied by `aria-describedby`. The private `Field` wrapper was removed once nothing used it.
- `EventEditor.tsx`: Last year is an optional `NumberField` (1900-2300) with the UI-SPEC message. Name uses the shared Field and Input, deposit type the `Select`, and loan the `Combobox` (placeholder "Choose a loan"). The three checkboxes are the shared `Checkbox`. Save and Create still wait on the editor's `AmountFields`. In `EventList.tsx`, "Include {name}" is the shared `Checkbox`.
- `LongTermForecast.tsx`: Plan and Compare with use the `Combobox`, with "No comparison" kept as a sentinel item (`__none`). Year uses the `Select` (placeholder "Choose a year"), and plan names use the shared Field and Input.
- `SavingsPanel.tsx`: "{account}: takes" uses the `Select`. "Add an account to the savings order" is a `Combobox` that is redrawn empty after each pick, with focus put back on it.
- `SimulationPanel.tsx`: paths use the `Select`.
- `AccountsPanel.tsx`: study kind and asset class use the `Select`, and Include uses the `Checkbox`.
- `AssumptionsPanel.tsx`: the income and spending "From my budget / Use my own figure" radios use the `RadioGroup`, and the four checkboxes use the `Checkbox`, with their sub-text as `description`.

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 | `908fa51d` | feat(03-19): long-term fields on the shared NumberField and Select |
| 2 (RED) | `7dbdbbda` | test(03-19): a recurring event's last year is blank or 1900 to 2300 |
| 2 (GREEN) | `fe725a38` | feat(03-19): life events on the shared controls, with the last year bounded |
| 2 (fix) | `7312dffb` | fix(03-19): the loan list opens on typing, like the other shared Comboboxes |
| 3 | `4a46d000` | feat(03-19): long-term forecast page and panels on the shared controls |

## TDD evidence (Task 2)

- RED: I ran the new case against a snapshot of the tree with Task 1 and the spec but the old `EventEditor` (`type="number"`). It failed at `await expect(message).toBeVisible()` for '1800' (spec line 316, "element(s) not found"). The other cases in that run passed, apart from the simulation test, which timed out at "Running 1,000 paths…" under machine load and passed in every later run.
- GREEN: the same case passes on the final tree.

## Verification (final tree, Node 24)

| Check | Result |
| --- | --- |
| `cd client && npx tsc --noEmit` | exit 0 |
| `npm --prefix client test` | 103 files, 947/947 passed |
| `npm --prefix e2e test -- --project=desktop tests/long-term-forecast.spec.ts` | 11 passed |
| `--project=demo tests/demo/long-term-forecast.spec.ts` and `--project=phone tests/phone/long-term-forecast.spec.ts` | 2 passed |
| `grep -c 'type="number"' EventEditor.tsx` | 0 (HEAD 1) |
| raw-control perl gate over the 8 longterm files | 0 (HEAD 18) |
| `cd lint && npm test && npm run lint` | exit 0, 122 warnings (cap 122, unchanged) |
| Prettier `--check` on changed files | clean |

## Selector changes

| Spec | Was | Now | Reason |
| --- | --- | --- | --- |
| desktop `long-term-forecast.spec.ts` (Year, was :98) | `getByLabel('Year').selectOption({ index: 5 })` | `chooseYear(page, 5)`: opens the `Select` trigger (`/See what made up a year/`) and clicks the 5th option | Year is the shared Select; its option labels depend on today's date, so it picks by position |
| desktop (was :139, :140) | `getByLabel('Add an account to the savings order').selectOption({ label })` | `pick(page, 'Add an account to the savings order', name)` | Combobox (user-grown list, D-06) |
| desktop (was :158, :370, :375) | `getByLabel('Plan').locator('option:checked')).toHaveText(x)` | `getByRole('combobox', { name: 'Plan', exact: true })).toHaveValue(x)` | Plan is a Combobox; its input shows the chosen plan |
| desktop (was :166) | `getByLabel('Compare with').selectOption({ label: 'Main plan' })` | `pick(page, 'Compare with', 'Main plan')` | Combobox |
| desktop (was :351) | `getByLabel('Plan', { exact: true })` | `getByRole('combobox', { name: 'Plan', exact: true })` | getByLabel also matched the Combobox's "Show suggestions Plan" button (strict-mode violation) |
| desktop (was :365, :373) | `getByLabel('Plan').selectOption({ label: 'Second' })` | `pick(page, 'Plan', 'Second')`, plus `expect(leave).toBeHidden()` after Cancel | Combobox |
| desktop (was :468) | `row.getByLabel('HECS: kind of loan')).toHaveValue('help')` | `row.getByRole('button', { name: /HECS: kind of loan/ })).toContainText('HECS-HELP or FEE-HELP')` | Study kind is the shared Select; the desktop trigger is a button showing the label, not a value |
| demo `long-term-forecast.spec.ts:24` | `getByLabel('Year').selectOption({ index: 2 })` | opens the trigger and clicks option `nth(1)` | Same as Year above |
| phone `long-term-forecast.spec.ts:119` | `getByLabel('Year', { exact: true }).selectOption({ index: 3 })` | `getByLabel('See what made up a year').selectOption({ index: 3 })` | Still a native select on phones (D-04); the select is now named by its visible label |
| phone (was :127) | `getByLabel('Compare with').selectOption({ label: 'Retire later' })` | `fill('')`, `fill('Retire later')` on the combobox, then click the option | Combobox is React Aria at every width, so no native select exists on phones |

`pick` empties the combobox and then types, as `recurring.spec.ts`'s `pickCombobox` does. Typing over a chosen label in one input event did not search.

## Behaviour changes

- **Last year (D-14)**: '1800', '2301' and '2025.5' stay as typed and show "Enter a whole year between 1900 and 2300, or leave this blank.", and Create or Save is disabled. Before, the field truncated '2025.5' to 2025 and accepted any year, which the server then refused. Blank still saves `null`. The "No end" placeholder is now the help line "Leave blank for no end", because NumberField takes no placeholder.
- **Number parsing is the shared one** (`readWholeNumber`, `readDecimal`). Whole-number fields now refuse '1e2', '+5' and '0x10', which `Number()` used to accept. Rate fields now accept '6.' and '.5', which were refused before. Exact bounds are checked on the typed text, so '15.004' is now past a 15% cap; before, it rounded to 1500 bps and was accepted. Every value in range parses as before, so a saved plan, an assumption default and a projection are unchanged.
- **RateField layout**: the error line and the assumption hint can show together. Before, the hint was hidden while the text was invalid. "Use default" now also shows while invalid text is typed, as long as the saved rate differs from the default, and choosing it resets the text.
- **Year list**: "Choose a year" is the Select's placeholder and cannot be chosen back from the list (shared Select rule). Clicking a year on the chart still selects one.
- **Labels**: controls now use the shared label style (`text-sm`, was `text-xs`). Selects inside a two-column row align to the top (`items-start`) instead of the bottom. The deposit pair has lost its "Deposit" caption, so the Select's own "Deposit type" label leads it. Savings rows label their mode select "{account}: takes" visibly (it was "Takes" plus a hidden aria-label).
- **Add an account**: after a pick, the field is drawn afresh, empty and closed, and focus returns to it.

## Deviations from Plan

1. **[Rule 3 - Blocking] The phone spec was edited (not in files_modified).** The plan said to leave it on `selectOption`, but Compare with is now the shared Combobox, which is React Aria at every width, so `selectOption` cannot reach it. The Year line keeps `selectOption` (native on phones, D-04) and moved to the visible label because the Select now takes its name from it.
2. **[Rule 1 - Bug] Combobox menuTrigger.** Plan, Compare with and Loan first used `menuTrigger="focus"`. With a chosen value, typed text did not open a search, so the desktop picks timed out. They now use the default trigger, like PaydayPlan's Plan. The loan part is the separate fix commit `7312dffb`, and the LongTermForecast part is inside `4a46d000`.
3. **[Rule 1 - Bug] Add an account stayed open after a pick** when its input was controlled, because the value never changes. It now remounts by key and refocuses its input.
4. **[Plan wording] "volatility and seed radios"**: AssumptionsPanel has no such radios. Volatility is a RateField and seed is a WholeNumberField. The radios in that file are the income and spending overrides (`OverrideMoney`), and those moved to the RadioGroup.
5. **[Plan wording] "the three checkboxes" (EventEditor)**: there are three (replaces rent, today's dollars, include). 03-16 said four.
6. **RateField conversion**: `Math.round(percent * 100)`, the formula `inputToBps` uses, instead of calling `inputToBps(String(percent))`. `String()` can give exponent text for tiny numbers, which `inputToBps` refuses. `bpsToInput` is still used for the value and the default hint.
7. **Environment**: the worktree had no `node_modules`. I ran `npm ci` (lockfiles unchanged, install scripts off) in the root, client, server, e2e and lint folders. E2e runs waited for the shared ports 3169-3180 and retried after EADDRINUSE clashes with sibling runs. Logs are in the session scratchpad under `p0319/`.

Parity condition from 03-16 Note 1: all of these are kept. That covers names, props, labels, messages, the "Assumption, default …" hint with "Use default", and "only a valid value reaches onChange". No `revise` was needed.

## Known Stubs

None.

## Threat Flags

None. T-03-28 is mitigated: Last year accepts only 1900-2300 or blank, which matches `longTermConfig.ts`, and Save waits on it. T-03-SC: no package was added.

## Self-Check: PASSED

- Commits 908fa51d, 7dbdbbda, fe725a38, 7312dffb and 4a46d000 are on HEAD (`git rev-list --count ec7120bd..HEAD` = 5 before this summary).
- The 8 modified components and 3 specs exist; this summary is the only created file.
