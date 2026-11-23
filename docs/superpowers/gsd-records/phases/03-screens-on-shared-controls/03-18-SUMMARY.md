---
phase: 03-screens-on-shared-controls
plan: 18
subsystem: ui
tags: [wave-g, g3, forecast, cash-runway, d-14, numberfield, currencyinput, datepicker, select, combobox]
requires:
  - phase: 03-screens-on-shared-controls
    provides: '03-16 G3 reconcile record (G3 reconcile: match) and the CashRunway gate baselines (2 and 7)'
provides:
  - 'CashRunway.tsx on the shared controls only: NumberField x3, CurrencyInput x4, DatePicker x4, Select x4, Combobox x1, Input'
  - 'An AmountFields provider per scenario editor; Save, Keep mine and Save as new wait for allValid'
  - 'forecast.spec.ts: two D-14 cases and one moved-controls case, each checked through the requests the page sends'
affects: [03-19, 03-23]
tech-stack:
  added: []
  patterns:
    - 'A card-level footer as a render function `footer(allValid)` so the slot bar outside AmountFields reads the editor''s validity'
    - 'Shared Select with a sentinel value (AUTOMATIC = "auto") for an option whose request value is null, since the Select reads "" as unset'
    - 'Decimal NumberField to basis points through bpsToInput / inputToBps(n.toFixed(2)) with precision={2}'
key-files:
  created:
    - docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-18-SUMMARY.md
  modified:
    - client/src/components/forecast/CashRunway.tsx
    - e2e/tests/forecast.spec.ts
key-decisions:
  - 'Out-of-range percents and rates block instead of clamping (D-14): 501 stays as typed with its line, the scenario keeps the last valid value'
  - 'Scenario amounts commit when the field is left (CurrencyInput''s contract), not on every keystroke as AmountInput did'
  - 'A cleared or half-typed scenario date keeps the last whole date instead of sending "" to the server'
  - 'Keep mine / Save as new are gated on allValid as well as Save, since they write the same scenario'
  - 'The saved-scenario Combobox uses menuTrigger="focus" so one click shows the list, as the native select did'
requirements-completed: []
plan_head_before: ec7120bd1b4005d82daac8efc34576cf171fcb1d
plan_head_after: 0d9defe0
commits: 3
actuals:
  tokens: 13850
  tasks: 2
  commits: 3
duration: 2h (most of it waiting for the shared e2e ports)
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 18: Cash runway on the shared controls

**The cash runway's three number fields are bounded NumberFields that block Save instead of clamping (D-14), and every other runway control is now a shared one: four CurrencyInputs, four DatePickers, four Selects and a Combobox for saved scenarios. Each scenario editor reports its fields' validity to its own Save.**

## Performance

- Tasks: 2/2. Files modified: 2.
- Most of the time went on the e2e ports 3169-3180, which the sibling G3 runs share (see Issues).

## Task Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 (RED) | `05de3f9f` | test(03-18): add failing D-14 cases for the runway percents and growth rate |
| 1 (GREEN) | `aa26fcca` | feat(03-18): bound the runway percents and growth rate with NumberField (D-14) |
| 2 | `0d9defe0` | feat(03-18): move the cash runway's money, dates, lists and saved scenarios to the shared controls |

## TDD Gate Compliance

- RED, Task 1 (`05de3f9f`, run against `ec7120bd`): 2 failed. `Variable spending %` filled with `501` read back as `500` (the old `type="number"` clamped it), and `Goal growth % a year` filled with `51` read back as `50`.
- GREEN, Task 1 (`aa26fcca`): `tests/forecast.spec.ts` 7 passed, 0 failed.
- RED, Task 2 (new test run against `aa26fcca`): 1 failed. After `abc` was typed in `Base spending per day`, "That isn't an amount. Type it like 12.50 or 12,50." never appeared: the old AmountInput neither said so nor held Save.
- GREEN, Task 2 (`0d9defe0`): `tests/forecast.spec.ts tests/safe-mode.spec.ts` 16 passed, 0 failed.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix e2e test -- --project=desktop tests/forecast.spec.ts tests/safe-mode.spec.ts` | 16 passed (8 forecast, 8 safe mode) |
| `grep -c 'type="number"' client/src/components/forecast/CashRunway.tsx` | 0 (was 2) |
| raw-control perl gate over CashRunway.tsx | 0 (was 7) |
| `cd client && npx tsc --noEmit` | exit 0 |
| `npm --prefix lint test` | 86/86 pass |
| `npm --prefix lint run lint` | exit 0, 0 errors, 122 warnings = the cap (unchanged) |
| Prettier on both files | clean |

Every e2e run was on Node 24, with this worktree's client prebuilt into a private `TMPDIR` cache and `E2E_SKIP_BUILD=1`, so a run took the shared ports for seconds rather than through a build. The script is outside the repo; see Issues.

## Selector changes

| Spec | Selector | Reason |
| --- | --- | --- |
| `forecast.spec.ts` (new) | `getByLabel('Variable spending %' / 'Income %' / 'Goal growth % a year', { exact: true }).first()` | NumberField's Field label names the input exactly as the old wrapping label did. `.first()` picks Base out of three editors |
| `forecast.spec.ts` (new) | `getByRole('button', { name: 'Save Base', exact: true })` | Unchanged control. It is the Save that allValid now gates |
| `forecast.spec.ts` (new) | `typeAmount(getByLabel('Base spending per day'))`, `typeAmount(getByLabel('One-off amount (negative for spending)'))`, `typeAmount(getByLabel('Extra cost per month'))` | CurrencyInput shows "$50" until focused and commits when left, so the shared `typeAmount` helper is used, not `fill` |
| `forecast.spec.ts` (new) | `fillDate(page, 'One-off date' / 'No income until' / 'Cost change from', iso)` | The shared DatePicker. `hideLabel` keeps the old aria-label as the group's name |
| `forecast.spec.ts` (new) | `chooseOption(getByRole('button', { name: /Horizon/ }), …)`, same for `/Income from/` | The shared Select's desktop trigger is a button named by its label and value |
| `forecast.spec.ts` (new) | `getByRole('combobox', { name: 'Open a saved scenario' })`, then `getByRole('option', { name: 'Base' })` | Was a native `<select>` with the same aria-label |

No existing selector changed: no other spec reached these fields (`first-import`, `resilience`, `tabs`, `user-guide` and `demo/forecast` touch only tabs, templates and text, and still pass where run).

## Behaviour changes

1. **Percents and growth rate (D-14).** `Variable spending %` takes whole numbers 0-500 and `Income %` 0-200. Typing `501`, `201` or `12.5` keeps the text, shows "Enter a whole number from 0 to 500." (or "… 0 to 200."), marks the field invalid and disables `Save {name}`. `Goal growth % a year` takes -100 to 50 with decimals. `51`, `-101` or `5.5x` show "Enter a percentage from -100% to 50%.". Before, these fields clamped silently (`501` became `500`). The forecast keeps the last valid value, and the test checks that no out-of-range value goes out in any `/api/forecast` or scenario save request. `5.5` saves as 550 basis points and reads back as `5.5` after a reload.
2. **Save gating.** Each scenario card is an `AmountFields` provider. While any NumberField, CurrencyInput or half-typed DatePicker in it is invalid, `Save {name}` is disabled, and so are the conflict alert's `Keep mine` / `Save as new` (they write the same scenario; see Deviations).
3. **Scenario amounts commit when the field is left.** AmountInput applied each keystroke. CurrencyInput, the shared control, applies on blur (Tab or click away). The forecast is debounced 300 ms either way. Unreadable text such as `abc` now stays in the field with "That isn't an amount…" and holds Save. Before, it was ignored with no message. Amounts now show formatted (`$50`) when not focused, and they follow the scenario: the old AmountInput kept its own text, so after removing a row above it, or after "Use theirs", it showed a stale amount.
4. **Signs.** One-off amount and Extra cost per month keep negatives (`allowNegative`). Spending per day and goal contributions are positive only (CurrencyInput takes the absolute value). The server allows only non-negative values there, so `-50` per day used to fail the forecast request. Goal contributions used to clamp to 0.
5. **Dates.** The four dates are the shared DatePicker (native date input on phones). One-off date and cost change from keep `minValue={today}`, which now shows the range line for an earlier day. Clearing or half-typing a date keeps the last whole date in the scenario. Before, `''` reached the server and the forecast failed with a 400.
6. **Lists.** Horizon, Spending history, Income from and Household bill shares have the same labels, options and order. "Automatic" is `'auto'` inside the Select and `null` in the request, as before. The saved-scenario picker is a Combobox: a click shows the list, typing filters it, and choosing opens the scenario. Its visible label is still "Open saved" or "Replace {name} with", and its accessible name is still "Open a saved scenario".
7. **Layout.** One-off and cost change rows are two lines: the description and remove button, then the date and amount. The no-income row is "No income" with remove, then from and until. Before, all of these were 3-4 columns on one line, which a date picker cannot fit in a third of a card. Labels are the shared Label and Field styles, not the old `text-xs` wrapping labels.

## Deviations from Plan

1. **[Rule 2 - correctness] `Keep mine` / `Save as new` also wait for `allValid`.** The plan names only the slot bar's Save, but these two buttons write the same `slot.scenario` to the server. Gating them keeps "Save requires allValid" true for every write. File: CashRunway.tsx (`SaveBar`). Commit `aa26fcca`.
2. **[Rule 1 - bug] A cleared or half-typed date is not passed on.** `DatePicker` emits `''` for a cleared date. Passing it on would send an invalid scenario, so the small `ScenarioDate` wrapper commits only whole dates. Commit `0d9defe0`.
3. **[Rule 3 - blocking] The Combobox uses `menuTrigger="focus"`.** With the default (`'input'`), a click only focused the field: the first GREEN run timed out waiting for the option. A click now opens the list, as the native select's did. Commit `0d9defe0`.
4. **[Test fix] Moved-controls test order.** The first GREEN attempt chose Horizon 30, then Payday plans, then Automatic. React Query served the last combination from its cache, so no new request went out. The test now chooses Payday plans, then Automatic, then Horizon 30. No product change.
5. **The plan ledger file under `.git/worktrees/…` could not be written** (the worktree sandbox refuses writes into the git dir). `plan_head_before` is the dispatch base `ec7120bd`, and `commits: 3` is `git rev-list --count ec7120bd..0d9defe0`, counted before this summary's commit.

## Issues Encountered

- **Shared e2e ports.** The sibling G3 runs share the fixed ports 3169-3180 (`e2e/ports.ts`). Two runs died with `EADDRINUSE` when a sibling bound a port during this run's 1-2 minute client build. The fix was a scratch script (not committed) that prebuilds the four client bundles into a private `TMPDIR=/tmp/fb0318` cache, waits until every port is free, then runs with `E2E_SKIP_BUILD=1`. A long `TMPDIR` under the session scratchpad broke tsx's IPC socket path (`listen EINVAL … .pipe`), hence the short one. Siblings may hit the same race. The shared `os.tmpdir()` cache that `E2E_SKIP_BUILD` uses must not be shared between worktrees.
- The run stopped once mid-plan on a usage limit, and the coordinator resumed it. Every test result above comes from a run after the resume, read in full.

## Known Stubs

None.

## Threat Flags

None. T-03-27 is mitigated: the NumberField bounds match `scenarioSchema` (0-500, 0-200, -10000 to 5000 bps), Save requires `allValid`, and the D-14 tests check every forecast and save request for out-of-range values. T-03-SC is accepted: no package was added.

## Next Phase Readiness

- 03-19 (long-term forecast) is independent. `bpsToInput` and `inputToBps` are imported unchanged, and `longterm/fields.tsx` was not touched.
- 03-23 (G3 PR) can quote "Selector changes" and "Behaviour changes" above. The changelog entry and version bump belong to that PR.
- WAVG-06 is not marked complete here, because the other G3 plans are still open.

## Self-Check: PASSED

- `client/src/components/forecast/CashRunway.tsx` and `e2e/tests/forecast.spec.ts` exist and are committed.
- `05de3f9f`, `aa26fcca` and `0d9defe0` are ancestors of HEAD.
- STATE.md and ROADMAP.md are untouched.

---

_Phase: 03-screens-on-shared-controls_
_Completed: 2026-11-21_
