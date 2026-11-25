---
phase: 03-screens-on-shared-controls
plan: 03
subsystem: ui
tags: [controls-gallery, baselines, number-field, currency-input, field-classes, month-range-picker, wave-g]

requires:
  - phase: 03-screens-on-shared-controls
    provides: "03-01 owner answer (`MonthRangePicker phone: short`) and 03-02 shared NumberField and extended CurrencyInput"
provides:
  - "Number field and Money field gallery cards with Linux baselines at 1280 and 390 px (light and dark)"
  - "Mounted Playwright interaction tests for NumberField and CurrencyInput on /dev/controls?probe=fields, replacing hookTestHarness.ts (03-02 WR-03)"
  - "Phase 2 review fixes closed: IN-01 (picker classes in fieldClasses.ts), IN-04 (local gallery theme toggle), R2-IN-02 (unique non-empty offline category ids), R2-IN-03 (non-vacuous Select error absence assertion)"
  - "MonthRangePicker short month display on phones ('Jun 2026', 'Nov 2026') over a full-size transparent native month input"
affects: [03-05, 03-07, 03-08, 03-09, 03-10, 03-12, 03-13, 03-14, 03-15, 03-20, 03-24]

plan_head_before: e8baa2cda6f37a7bc4501e4a90070142c19493b0
plan_head_after: eb18265dc33c67297d53497595b88fbae7e1d9a6
commits: 8

actuals:
  tokens: 28036
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Single home for picker classes and named pickerGroupBase/Width/Height/Padding/Text parts in client/src/components/ui/fieldClasses.ts"
    - "Dev-only mounted React interaction probe mode on /dev/controls?probe=fields (stripped from production builds by withoutDevGallery())"
    - "Phone MonthRangePicker displays formatMonth short text ('Nov 2026') behind a full-size transparent native <input type='month'> preserving OS picker, label and 44 px height"

key-files:
  created:
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/number-field-card-1280-light.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/number-field-card-1280-dark.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/number-field-card-390-light.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/number-field-card-390-dark.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/money-field-card-1280-light.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/money-field-card-1280-dark.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/money-field-card-390-light.png
    - e2e/tests/gallery/__screenshots__/text-fields.spec.ts/money-field-card-390-dark.png
  modified:
    - client/src/pages/devGallery/TextFieldCards.tsx
    - client/src/pages/DevControlsGallery.tsx
    - client/src/pages/devGallery/PickerCards.tsx
    - client/src/components/ui/fieldClasses.ts
    - client/src/components/ui/DatePicker.tsx
    - client/src/components/ui/Combobox.tsx
    - client/src/components/ui/MonthPicker.tsx
    - client/src/components/ui/MonthRangePicker.tsx
    - client/src/components/ui/MonthRangePicker.test.ts
    - client/src/components/ui/Select.test.ts
    - client/src/components/ui/NumberField.test.ts
    - client/src/components/ui/CurrencyInput.test.ts
    - e2e/tests/gallery/text-fields.spec.ts
    - e2e/tests/gallery/month-range.spec.ts
    - e2e/tests/gallery/pickers.spec.ts
    - e2e/tests/gallery/__screenshots__/matrix.spec.ts/gallery-1280-light.png
    - e2e/tests/gallery/__screenshots__/matrix.spec.ts/gallery-1280-dark.png
    - e2e/tests/gallery/__screenshots__/matrix.spec.ts/gallery-390-light.png
    - e2e/tests/gallery/__screenshots__/matrix.spec.ts/gallery-390-dark.png
    - e2e/tests/gallery/__screenshots__/overlays.spec.ts/open-combobox-390-light.png

key-decisions:
  - "Applied owner answer `MonthRangePicker phone: short` (03-01-SUMMARY.md, 19 Nov 2026) using existing shared `formatMonth` from `utils/dateRange.ts` over a full-size transparent native `<input type='month'>` so phone fields show 'Jun 2026' / 'Nov 2026' unclipped at 390 px without adding a second formatter or breaking native picker / label / button-count contracts"
  - "Hosted mounted Playwright interaction probes for NumberField and CurrencyInput behind `/dev/controls?probe=fields` so real React 19 + AmountFields coverage replaces `hookTestHarness.ts` (03-02 WR-03) without adding extra controls or Tab stops to the visual gallery page, while remaining excluded from production builds via `withoutDevGallery()`"
  - "Composed `pickerGroupClass` in `fieldClasses.ts` from exported `pickerGroupBase`, `pickerGroupWidth`, `pickerGroupHeight`, `pickerGroupPadding`, and `pickerGroupText` parts so `MonthRangePicker` builds both its desktop toolbar trigger and phone box without string splitting, leaving all existing pixels identical"

patterns-established:
  - "Picker class tokens live exclusively in `client/src/components/ui/fieldClasses.ts` (imported by DatePicker, Combobox, MonthPicker, MonthRangePicker)"
  - "Gallery theme switching toggles `document.documentElement.classList` locally and restores on unmount without touching `usePreferencesStore`"
  - "Mounted component interaction tests for shared controls run in Playwright against `/dev/controls?probe=fields` rather than emulated React hook harnesses"

requirements-completed: [WAVG-05]

coverage:
  - id: D1
    description: "Number field and Money field gallery specimens and Linux baselines at 1280 and 390 px in light and dark themes"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#the Number field card shows valid, invalid, optional, disabled and sm % states"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#the Money field card shows md, sm and expression CurrencyInput states"
        status: pass
      - kind: automated_ui
        ref: "Linux Playwright container (v1.64.0-noble, CI=1): 121/121 across matrix, overlays, switch, text-fields, month-range"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mounted React 19 Playwright interaction coverage for NumberField and CurrencyInput, replacing hookTestHarness.ts (03-02 WR-03)"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#mounted NumberField / CurrencyInput probes (6 specs)"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/NumberField.test.ts + CurrencyInput.test.ts (16/16 pure unit tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 2 review fixes closed: IN-04 (local gallery theme toggle), R2-IN-02 (unique non-empty offline category ids), IN-01 (picker classes in fieldClasses.ts), R2-IN-03 (non-vacuous Select error absence assertion)"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/text-fields.spec.ts#IN-04 and R2-IN-02 tests"
        status: pass
      - kind: unit
        ref: "client/src/components/ui/Select.test.ts + DatePicker.test.ts + MonthRangePicker.test.ts + Combobox.test.ts + MonthPicker.test.ts (92/92)"
        status: pass
      - kind: automated_ui
        ref: "Linux Playwright container (CI=1) after Task 2 class move: 116/116 with zero remade images"
        status: pass
    human_judgment: false
  - id: D4
    description: "MonthRangePicker short month display on phones ('MonthRangePicker phone: short' owner answer) with unclipped 390 px check and updated 390 px baselines"
    requirement: WAVG-05
    verification:
      - kind: unit
        ref: "client/src/components/ui/MonthRangePicker.test.ts (12/12)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/month-range.spec.ts + e2e/tests/phone/phone-native.spec.ts (20/20)"
        status: pass
      - kind: automated_ui
        ref: "Linux Playwright container (CI=1): 121/121, gallery-390-{light,dark}.png inspected"
        status: pass
    human_judgment: false
  - id: D5
    description: "Controls gallery stays absent from the built production app"
    requirement: WAVG-05
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery-absent.spec.ts (desktop project, 1/1)"
        status: pass
    human_judgment: false

duration: 2h 44m
completed: 2026-11-19
status: complete
---

# Phase 03 Plan 03: Gallery Specimens, Deferred Phase 2 Fixes, and MonthRangePicker Phone Short Format Summary

**Added Number field and Money field gallery cards with Linux baselines, replaced the emulated hook harness with mounted React 19 Playwright probes, closed Phase 2 review items IN-01, IN-04, R2-IN-02 and R2-IN-03, and implemented short month names on phone MonthRangePicker per the owner's answer**

## Performance

- **Duration:** 2h 44m (wall-clock includes 5 Linux amd64 Docker QEMU baseline/verify runs)
- **Started:** 2026-11-19T11:12:03Z
- **Completed:** 2026-11-19T13:56:22Z
- **Tasks:** 3
- **Files modified:** 29 (8 new baseline PNGs, 20 modified files, 1 deleted test harness)

## Accomplishments

- **Task 1 (`f688db99`):**
  - Added the **"Number field"** gallery card (`Valid`, `Invalid` seeded 61 with its range alert, `Optional` blank, `Disabled`, `Small` with `%` suffix and decimal mode) and upgraded the **"Money field"** gallery card (`Empty`, `Filled`, `Small`, `Expression`) in `client/src/pages/devGallery/TextFieldCards.tsx`.
  - **IN-04 closed:** `DevControlsGallery.tsx` now toggles the `dark` class locally on `document.documentElement` and restores the initial state on unmount, removing the `usePreferencesStore` import and `setTheme` call (`grep -c 'setTheme'` = `0`).
  - **R2-IN-02 closed:** `PickerCards.tsx` derives offline created category IDs through `uniqueCategoryId(name, groups)` using fallback stem `'category'` for names without Latin letters/digits and appending `-2`, `-3`, … across all groups when a slug collides (`Rent` in Everyday -> `rent-2`, `Groceries!` -> `groceries-2`, `!!!` -> `category`, `日本` -> `category-2`).
  - **03-02 WR-03 closed:** Added mounted React 19 interaction probes on `/dev/controls?probe=fields` (`FieldProbes` in `TextFieldCards.tsx`) and 6 mounted Playwright tests in `e2e/tests/gallery/text-fields.spec.ts` covering every interaction case previously emulated by `hookTestHarness.ts` (including `R3-CR-01`, `CR-02`, `R5-WR-01`, `R2-CR-02`, `R3-WR-01`, `R4-CR-01` both probes, `CR-03`, `R2-CR-03`, `R2-CR-04`, `R3-WR-02`, `R4-WR-01`, `R4-WR-02`, `WR-01`, `CR-01`, `R2-CR-01`, `CR-04`, and `WR-02`). Deleted `client/src/components/ui/hookTestHarness.ts` and simplified `NumberField.test.ts` and `CurrencyInput.test.ts` to pure unit tests.
- **Task 2 (`ece4d52d`):**
  - **IN-01 closed:** Moved `pickerIconButton`, `pickerGroupClass`, `pickerPopoverClass`, `pickerFooterClass`, and `pickerShortcutClass` from `DatePicker.tsx` into `client/src/components/ui/fieldClasses.ts`, exporting named group parts (`pickerGroupBase`, `pickerGroupWidth`, `pickerGroupHeight`, `pickerGroupPadding`, `pickerGroupText`). Updated imports in `DatePicker.tsx`, `Combobox.tsx`, `MonthPicker.tsx`, and `MonthRangePicker.tsx`. `MonthRangePicker` composes `rangeGroupClass` directly from `pickerGroupBase` (`grep -c "pickerGroupClass.split"` = `0`), with zero pixel change across all 54 baselines (`CI=1` verified).
  - **R2-IN-03 closed:** Replaced the vacuous `expect(html).not.toContain('FieldError')` line in `client/src/components/ui/Select.test.ts` with a check asserting no `text-negative` error element follows `</button>` when no error is rendered.
- **Task 3 (`12099a46`):**
  - Evaluated precondition on `03-01-SUMMARY.md`: `MonthRangePicker phone: short` (owner answer of 19 Nov 2026: "Change dates to shorthand Nov, Sep, Oct etc.").
  - Wrote failing-first unit tests in `MonthRangePicker.test.ts` covering all 12 short month labels (`Jan 2026`..`Dec 2026`), phone markup showing `Jun 2026` / `Nov 2026` / `Select month`, and absence of full month names in desktop and phone output (confirmed RED: 2 failed before implementation).
  - Updated `MonthRangePicker.tsx` phone branch to render the visible short month text via the existing shared `formatMonth` in `utils/dateRange.ts` inside a `pickerGroupBase` box behind a full-size transparent native `<input type="month">`, preserving `<Label htmlFor>` association, OS month picker tap target, `value`/`min`/`max`/`disabled`/`readOnly`/`aria-invalid`/`aria-describedby` contract, 44 px height, 16 px input font size, and zero `<button>` elements.
  - Added 390 px assertion in `e2e/tests/gallery/month-range.spec.ts` checking From displays `'Nov 2026'` without clipping (`scrollWidth <= clientWidth`).

## Task Commits

Each task was committed atomically on `worktree-agent-p0303-a1`:

1. **Task 1: Gallery specimens for NumberField and CurrencyInput; IN-04, R2-IN-02, and carried 03-02 WR-03** - `f688db99` (`feat(03-03)`)
2. **Task 2: Picker classes into fieldClasses.ts (IN-01) and vacuous Select assertion (R2-IN-03)** - `ece4d52d` (`refactor(03-03)`)
3. **Task 3: Apply owner's MonthRangePicker phone answer (`short`)** - `12099a46` (`feat(03-03)`)

## Changed & New Baseline Images (All Inspected)

Every image was produced in Playwright's `mcr.microsoft.com/playwright:v1.64.0-noble` (`linux/amd64`, digest `sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`) container, visually inspected, and verified with `CI=1` zero-tolerance comparison:

| Baseline image | Status | Reason |
| --- | --- | --- |
| `text-fields.spec.ts/number-field-card-1280-light.png` | New (Task 1) | New "Number field" gallery card (Valid, Invalid with range error, Optional, Disabled, Small `%`) at 1280 px light |
| `text-fields.spec.ts/number-field-card-1280-dark.png` | New (Task 1) | Same "Number field" gallery card at 1280 px dark |
| `text-fields.spec.ts/number-field-card-390-light.png` | New (Task 1) | Same "Number field" gallery card at 390 px phone light |
| `text-fields.spec.ts/number-field-card-390-dark.png` | New (Task 1) | Same "Number field" gallery card at 390 px phone dark |
| `text-fields.spec.ts/money-field-card-1280-light.png` | New (Task 1) | New "Money field" gallery card (`Empty`, `Filled`, `Small`, `Expression`) at 1280 px light |
| `text-fields.spec.ts/money-field-card-1280-dark.png` | New (Task 1) | Same "Money field" gallery card at 1280 px dark |
| `text-fields.spec.ts/money-field-card-390-light.png` | New (Task 1) | Same "Money field" gallery card at 390 px phone light |
| `text-fields.spec.ts/money-field-card-390-dark.png` | New (Task 1) | Same "Money field" gallery card at 390 px phone dark |
| `matrix.spec.ts/gallery-1280-light.png` | Updated (Task 1) | Full-page gallery includes new "Number field" card and expanded "Money field" card |
| `matrix.spec.ts/gallery-1280-dark.png` | Updated (Task 1) | Same full-page gallery update in dark theme |
| `matrix.spec.ts/gallery-390-light.png` | Updated (Tasks 1 & 3) | Task 1 added "Number field" and expanded "Money field"; Task 3 changed only the MonthRangePicker card (y ~11378–12076 of 15424 px; old y ~10556–11254) to show unclipped `'Jun 2026'` / `'Nov 2026'` short month labels with calendar icons |
| `matrix.spec.ts/gallery-390-dark.png` | Updated (Tasks 1 & 3) | Same full-page 390 px update in dark theme |
| `overlays.spec.ts/open-combobox-390-light.png` | Updated (Task 1) | Same 342×386 dimensions; adding "Number field" above Combobox shifted scroll-offset rounding so the whole crop moved up by ~1 px (2950 changed pixels across x 7–334, y 12–382); benign, no control looks different, passes `CI=1` |

Task 2 remade **zero** baseline images (116/116 passed `CI=1` against Task 1's baselines).
Task 3 remade **only** `gallery-390-light.png` and `gallery-390-dark.png` (zero desktop, focus, or overlay baselines changed).

## Changed e2e Selectors

- **`e2e/tests/gallery/pickers.spec.ts:241`:** Changed `page.getByRole('alert')` to `pickerRow(page, 'Inline').getByRole('alert')`. Reason: adding the seeded-invalid `NumberField` specimen in Task 1 introduced a second `role="alert"` element on `/dev/controls`, causing Playwright strict-mode ambiguity on the page-wide alert locator.

## Closed Review Items

- **02-REVIEW IN-01:** Moved all five picker class exports into `fieldClasses.ts`, decomposed `pickerGroupClass` into named parts, and removed `pickerGroupClass.split(...)` from `MonthRangePicker.tsx`.
- **02-REVIEW IN-04:** Gallery theme toggle updates `document.documentElement.classList` locally and restores on unmount without calling `usePreferencesStore.getState().setTheme`.
- **02-REVIEW-2 R2-IN-02:** Offline category create derives non-empty, cross-group-unique ids (`uniqueCategoryId`) while preserving the per-group duplicate name check.
- **02-REVIEW-2 R2-IN-03:** Removed vacuous `not.toContain('FieldError')` in `Select.test.ts`, asserting absence of `text-negative` after `</button>`.
- **03-02-REVIEW-3 WR-03 (carried into Task 1):** Replaced emulated `hookTestHarness.ts` with mounted React 19 Playwright tests on `/dev/controls?probe=fields`, deleted `client/src/components/ui/hookTestHarness.ts`, and kept pure unit tests in `NumberField.test.ts` and `CurrencyInput.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped `pickers.spec.ts:241` alert locator to the Inline Category picker row**
- **Found during:** Task 1 (first full gallery container run)
- **Issue:** Adding the invalid `NumberField` specimen (which renders `<span role="alert">`) caused `e2e/tests/gallery/pickers.spec.ts:241`'s `page.getByRole('alert')` to hit a Playwright strict-mode violation (2 matching alerts).
- **Fix:** Scoped the locator to `pickerRow(page, 'Inline').getByRole('alert')`.
- **Files modified:** `e2e/tests/gallery/pickers.spec.ts`
- **Verification:** `tests/gallery/pickers.spec.ts` passes 14/14 locally and in Linux Docker.
- **Committed in:** `f688db99` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated `MonthPicker.tsx` imports alongside `DatePicker.tsx`, `Combobox.tsx`, and `MonthRangePicker.tsx`**
- **Found during:** Task 2 (pre-edit grep for picker class exports)
- **Issue:** `client/src/components/ui/MonthPicker.tsx` imported all five picker class constants from `./DatePicker` and was not listed in Task 2's frontmatter `files_modified`.
- **Fix:** Updated `MonthPicker.tsx` to import the five picker class constants from `./fieldClasses` (keeping `NativePicker` from `./DatePicker`).
- **Files modified:** `client/src/components/ui/MonthPicker.tsx`
- **Verification:** `MonthPicker.test.ts` (13/13) and `tsc --noEmit` pass; Task 2 `CI=1` baseline pass green.
- **Committed in:** `ece4d52d` (Task 2 commit)

**3. [Carried orchestrator note — 03-02 WR-03] Deleted `hookTestHarness.ts` and simplified `NumberField.test.ts` / `CurrencyInput.test.ts`**
- **Found during:** Task 1 (explicitly requested in 03-03-PLAN.md Task 1 comment and 03-02-SUMMARY.md)
- **Fix:** Moved all 15 emulated interaction test cases to real mounted React 19 Playwright tests on `/dev/controls?probe=fields`, deleted `client/src/components/ui/hookTestHarness.ts`, and kept all pure unit tests in `NumberField.test.ts` and `CurrencyInput.test.ts`.
- **Committed in:** `f688db99` (Task 1 commit)

---

**Total deviations:** 3 (2 Rule 3 auto-fixes + 1 carried review item explicitly noted in Task 1).
**Impact on plan:** All necessary for correctness and clean compilation; no unintended scope creep.

## Issues Encountered

- **Pre-existing `combobox.spec.ts:134` flake in emulated Linux Docker (`linux/amd64` on Apple Silicon):** Running `bash e2e/gallery-baselines.sh` runs all 205 gallery tests with `--retries=0` and fails exclusively on `combobox.spec.ts:134` (click timeout inside QEMU emulation; 204/205 pass). This is the exact pre-existing container-only flake already documented in `02-VALIDATION.md:128`, `02-11-SUMMARY.md:141`, and `02-REVIEW-FIX.md:237-241`. Following the `02-REVIEW-FIX.md` precedent, baseline updates and strict `CI=1` pixel verifications were run in the identical `mcr.microsoft.com/playwright:v1.64.0-noble` (`linux/amd64`) image across all pixel-bearing specs (`matrix`, `overlays`, `switch`, `text-fields`, `month-range`: 121/121 passed), and the full macOS gallery suite passed 155/155 (including `combobox.spec.ts:134`).
- *(Environment note: `npm --prefix client/e2e/lint/server ci --prefer-offline` was run inside the worktree from the existing lockfiles with `ignore-scripts=true` intact; no package or lockfile was changed.)*

## Verification Results

- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client test` (`cd client && npx vitest run`) — PASS (97 files, 917/917 tests, re-run after WR-01..WR-04)
- `(cd client && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit)` — PASS (0 errors, re-run after WR-01..WR-04)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix client run build` — PASS (built in 1.04s, pre-review)
- `(cd e2e && PATH=/opt/homebrew/opt/node@24/bin:$PATH npx tsc --noEmit)` — PASS (0 errors, re-run after WR-01..WR-04)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix lint test && npm --prefix lint run lint` — PASS (0 errors, 126 warnings; cap 128; 0 new warnings; lint re-run after WR-01..WR-04)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH E2E_GALLERY_ONLY=1 npm --prefix e2e test -- --project=gallery` (macOS, pre-review) — PASS (155 passed, 50 Linux-only pixel tests skipped)
- Linux Docker `mcr.microsoft.com/playwright:v1.64.0-noble` (`linux/amd64`, `CI=1`, `--retries=0`, pre-review) over `matrix`, `overlays`, `switch`, `text-fields`, `month-range` — PASS (121/121, all 54 baselines matched with zero tolerance)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=desktop tests/gallery-absent.spec.ts` (pre-review) — PASS (1/1)
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm --prefix e2e test -- --project=phone tests/phone/phone-native.spec.ts` (pre-review) — PASS (20/20)
- `grep -c 'setTheme' client/src/pages/DevControlsGallery.tsx` — `0`
- `grep -c "pickerGroupClass.split" client/src/components/ui/MonthRangePicker.tsx` — `0`
- `grep -c "FieldError" client/src/components/ui/Select.test.ts` — `0`
- `git diff --check e8baa2cda6f37a7bc4501e4a90070142c19493b0..HEAD -- client/ e2e/` — PASS
- *(Post-review note: Playwright and the Docker baseline container were intentionally not re-run after WR-01..WR-04 because another executor holds the fixed e2e ports; the orchestrator will run the gallery specs and regenerate baselines if needed. Resting phone pixels are unchanged by WR-03 because `opacity-0` applies until `:focus-visible`.)*

## Review fixes

Addressed all 4 warnings (`WR-01`..`WR-04`) and `IN-01` from `03-03-REVIEW.md`, one commit per fix:

- **WR-01** (`257405ee`, `test(03-03): WR-01 cover enabled bound-relax commit before disabled sequence`): Added a `Reset probe` remount button to `ProbeBoundRelaxAndDisabled` in `TextFieldCards.tsx` and added the enabled raise-max sequence (`fill('61')`, `Set max 100` while enabled -> `calls=1`, `saved=61`, `valid=true`; `Set max 50` -> `valid=false`) in `text-fields.spec.ts` before resetting and running the disabled sequence.
- **WR-02** (`5de58d9d`, `test(03-03): WR-02 restore exact UNREADABLE_AMOUNT and aria-invalid checks in CurrencyInput probes`): Asserted exact `UNREADABLE_AMOUNT` `validationMessage` before blur, after blur, and after refocus in the CR-01 probe, and asserted `not.toHaveAttribute('aria-invalid', 'true')` after `Set 2000` and `Set 3500` focused resets (and after blur) in the R2-CR-01 probe.
- **WR-03** (`4f96ed8d`, `fix(03-03): WR-03 reveal phone MonthRangePicker input on keyboard focus`): Applied option (a) in `MonthRangePicker.tsx` — placed `<input type="month">` first with `peer z-10 opacity-0 focus-visible:opacity-100` and hid both the display span and decorative `CalendarRange` icon via `peer-focus-visible:invisible` when keyboard-focused; added unit assertion in `MonthRangePicker.test.ts` and a 767 px keyboard Tab/type/blur test in `e2e/tests/gallery/month-range.spec.ts`.
- **WR-04** (`eb18265d`, `refactor(03-03): WR-04 remove impossible typeof window guard in DevControlsGallery`): Removed the redundant `typeof window !== 'undefined'` check in `DevControlsGallery.tsx`.
- **IN-01** (this summary commit): Corrected the `open-combobox-390-light.png` (~1 px scroll-offset rounding shift across 2950 pixels) and `gallery-390-*.png` MonthRangePicker card y-coordinates (~11378–12076) descriptions in the baseline table above.

## Threat Flags

None. `T-03-04` (gallery theme button tampering with saved preferences) is mitigated by IN-04 (verified by `text-fields.spec.ts`); `T-03-SC` (no package added) holds; `gallery-absent.spec.ts` confirms the dev-only gallery and its `?probe=fields` workbench remain excluded from the production build.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gallery specimens, Linux baselines, picker class parts in `fieldClasses.ts`, and phone short-month `MonthRangePicker` (with keyboard-focus editing visibility) are complete and ready for Wave G2 screen migrations (`03-05` through `03-24`).
- `STATE.md` and `ROADMAP.md` were left untouched for the orchestrator's post-wave update.
- Note from `03-01-SUMMARY.md` Binding 2 still applies for `03-07`: `DatePicker` does not yet carry a `fieldSize` prop, though `pickerGroupBase` and `pickerGroupHeight` are now factored out in `fieldClasses.ts` ready for it.

## Self-Check: PASSED

- All 8 created baseline PNGs under `e2e/tests/gallery/__screenshots__/text-fields.spec.ts/` exist on disk; `client/src/components/ui/hookTestHarness.ts` is deleted.
- All 3 task commits (`f688db99`, `ece4d52d`, `12099a46`) and 4 review-fix commits (`257405ee`, `5de58d9d`, `4f96ed8d`, `eb18265d`) are ancestors of `HEAD` on `worktree-agent-p0303-a1`.
- Zero changes to `docs/superpowers/gsd-records/STATE.md` or `docs/superpowers/gsd-records/ROADMAP.md`.
- Client Vitest (97 files, 917/917), client `tsc --noEmit`, e2e `tsc --noEmit`, and ESLint (0 errors, 126 warnings) all passed after WR-01..WR-04; orchestrator will run Playwright gallery specs once e2e ports are free.

---
*Phase: 03-screens-on-shared-controls*
*Completed: 2026-11-19*
