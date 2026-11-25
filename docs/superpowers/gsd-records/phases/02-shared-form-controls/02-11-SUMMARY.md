---
phase: 02-shared-form-controls
plan: 11
subsystem: ui
tags: [gallery, playwright, screenshots, keyboard, escape, modal, inert, phone]
status: complete
requires:
  - phase: 02-shared-form-controls
    provides: "openGallery, specimen, expectScreenshot, PIXELS and gallery-baselines.sh (02-04, 02-15); every control's gallery card (02-04 to 02-10, 02-13 to 02-19); MonthRangePicker on MonthGrid (02-14)"
provides:
  - "matrix.spec.ts: Tab from the top reaches each of the eleven controls' and MonthRangePicker's Focus specimen, focus mark asserted by computed style; cards visited in page order; 24 focus and 4 full-page Linux baselines"
  - "overlays.spec.ts: Escape in the shared Modal closes only the open list for seven popover controls; Tab stays in the dialog; 44 px targets and native pickers at 390 px; native at 767 px, custom at 768 px; 16 open-popover Linux baselines"
  - "DialogCard: the shared Modal holding one of each popover control"
  - "tabTo and clearFocus in gallery.ts; expectScreenshot takes a locator or the page, with clip or fullPage"
  - "holdRootInert keeps #root inert while held, even when React Aria's list cleanup clears it"
  - "Specimen rows stack on phones"
affects: [02-12 docs and CHANGELOG, phase 03/04 screens using Combobox inside a Modal]
tech-stack:
  added: []
  patterns:
    - "Popover pictures are clipped to the union of the specimen row and the popover, measured after the popover's animations finish, on whole pixels"
    - "Full-page pictures run on a clock far from the pinned day (5 March 2031), so a specimen that read today's date would show it"
key-files:
  created:
    - client/src/pages/devGallery/DialogCard.tsx
    - e2e/tests/gallery/matrix.spec.ts
    - e2e/tests/gallery/overlays.spec.ts
    - e2e/tests/gallery/__screenshots__/matrix.spec.ts/ (28 images)
    - e2e/tests/gallery/__screenshots__/overlays.spec.ts/ (16 images)
  modified:
    - e2e/tests/gallery/gallery.ts
    - client/src/pages/DevControlsGallery.tsx
    - client/src/pages/devGallery/Specimen.tsx
    - client/src/pages/devGallery/ComboboxCard.tsx
    - client/src/pages/devGallery/PickerCards.tsx
    - client/src/pages/devGallery/SelectCard.tsx
    - client/src/utils/inertRoot.ts
    - client/src/utils/inertRoot.test.ts
key-decisions:
  - "Escape needed no fix in any of the seven controls: each already marks the key handled before the Modal's document listener"
  - "Closing a Combobox or PayeeCombobox list inside a dialog cleared #root.inert (React Aria ariaHideOutside restores with inert = false); fixed in holdRootInert with a MutationObserver that puts inert back while held, not in the controls"
  - "The phone 44 px check measures a toggle by its label and a Combobox text field by its field box; the Combobox card's Payee field specimen is left out like Money entry, because PayeeCombobox is a wrapper whose bare look is the register row's"
  - "Specimen rows stack on phones so a control gets the card's width, as on a screen; found by looking at gallery-390"
  - "Sample lists (FREQUENCIES, ACCOUNTS, PAYEES, GROUPS, TRANSFER_ACCOUNTS) are exported from their cards for DialogCard rather than copied"
requirements-completed: [WAVG-03, WAVG-04]
duration: 5 h 10 min (mostly container runs under amd64 emulation)
completed: 2026-11-18
actuals:
  tasks: 3
  commits: 4
plan_head_before: 7c1ef304225fddb173d38301821ecebf5b86f4dc
plan_head_after: 67c61db
coverage:
  - deliverable: "Keyboard reaches every control's Focus specimen with a visible focus mark"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/matrix.spec.ts#Tab reaches the <Control> Focus specimen and shows its focus mark (12 tests)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/matrix.spec.ts#Tab visits the gallery cards in page order"
        status: pass
  - deliverable: "Escape inside the shared Modal closes only the open list (D-12), and the page under the dialog stays inert"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/overlays.spec.ts#Escape with the <Control> open in a dialog closes only the <Control> (7 tests)"
        status: pass
      - kind: unit
        ref: "client/src/utils/inertRoot.test.ts#puts inert back when something else clears it while held"
        status: pass
  - deliverable: "44 px targets, native pickers and no sideways scroll at 390 px; E-03 at 767/768 px"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/overlays.spec.ts#at 390 px … / at 767 px … / at 768 px … (5 tests)"
        status: pass
  - deliverable: "Screenshot matrix on committed Linux baselines"
    human_judgment: false
    verification:
      - kind: e2e
        ref: "container compare of matrix, overlays and switch specs, twice in a row (86/86 each)"
        status: pass
  - deliverable: "Screen-reader pass and iPhone native pickers (02-VALIDATION manual checks)"
    human_judgment: true
    verification: []
---

# Phase 2 Plan 11: The gallery's checks over the whole set — Summary

**Keyboard pass, Escape inside the app's Modal, phone checks and a 46-image screenshot matrix for the shared controls. The Escape check turned up a real bug, now fixed: closing a Combobox list inside a dialog made the page under it usable again.**

## Performance

- Started 2026-11-18 06:11 UTC; finished about 11:20 UTC
- Tasks: 3 of 3, plus one fix commit for flaky popover pictures
- Most of the time went on container runs: Playwright's amd64 image under emulation on this Mac takes about 10 minutes for the 86 tests in three specs

## Accomplishments

- **Keyboard pass (Task 1).** For each of the eleven controls and MonthRangePicker, a test clicks the page heading and presses Tab from the top until the Focus specimen has focus. It then checks the focus mark by computed style: a brand `box-shadow` with `outline-style: none` on fields and triggers, and a 2 px solid brand outline on the Checkbox, Radio and Switch indicator. Another test Tabs through the whole page and checks the cards come in page order. The gallery fakes no focus. Negative case, run once and reverted: removing the ring classes from `fieldBase` makes the Input test fail (`Received: null`).
- **Escape in a dialog (Task 2).** `DialogCard` opens the shared `Modal` with a Select, Combobox, DatePicker, MonthPicker, MonthRangePicker, PayeeCombobox and a CategoryPicker button. For all seven, the first Escape closes only the list and the dialog stays open; the second closes the dialog. **No control needed an Escape fix.**
- **Phone and the 768 px line (Task 2).** At 390 px every control in the twelve set cards is at least 44 by 44 px, toggles measured by their label and the Combobox by its field box. Select is a native `select`, DatePicker a date input, MonthPicker a month input, and MonthRangePicker two month inputs named From and To. Nothing scrolls sideways, with or without an open Combobox list or category picker. At 767 px the three date pickers are native; at 768 px they are the custom controls.
- **Screenshot matrix (Tasks 1 to 3).** 46 committed baselines. Every image was looked at.

| Layer | Count | Names |
|---|---|---|
| Focus specimens, 1280 px, light and dark | 24 | `focus-<control>-<theme>` (eleven controls and MonthRangePicker) |
| Open popovers, 1280 px, light and dark | 14 | `open-<control>-<theme>`: Select, Combobox, CategoryPicker, PayeeCombobox, DatePicker, MonthPicker, MonthRangePicker |
| Open popovers, 390 px, light | 2 | `open-combobox-390-light`, `open-categorypicker-390-light` |
| Full page, 1280 and 390 px, light and dark | 4 | `gallery-<width>-<theme>` |
| Switch card (from 02-15, unchanged) | 2 | `switch-card-<theme>` |

- **Container:** `mcr.microsoft.com/playwright:v1.64.0-noble`, `linux/amd64`, digest `sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`. All baselines come from runs on this image. After the final update, two comparisons in a row passed 86/86 each with no update between them.

## Task Commits

1. `fc7e7a0` test(e2e): every shared control's keyboard focus, by assertion and by picture (#267)
2. `492dbc0` test(e2e): shared popovers close alone on Escape in a dialog, fit a phone, and are pictured open (#267). Includes the `holdRootInert` fix and the stacked Specimen rows.
3. `2258027` test(e2e): the controls gallery's full-page screenshot matrix (#267)
4. `67c61db` test(e2e): picture an open popover once its entrance has played out (#267)

## Deviations from Plan

**1. [Rule 1, bug] Closing a Combobox list inside a dialog cleared the page's `inert`.** While a Combobox list is open, React Aria's `ariaHideOutside` hides the rest of the page with `aria-hidden`. When the list closes, it restores each node with `inert = false`, which wipes the `inert` that `Modal` keeps on `#root`. In the app, any Combobox or PayeeCombobox in a dialog then left the page under the dialog clickable and visible to screen readers. The Modal's own Tab trap still kept Tab inside. Fixed in `client/src/utils/inertRoot.ts`: while anything holds the page inert, a `MutationObserver` on `#root`'s `inert` attribute puts it back. The Escape tests now also check `#root.inert` after the first and second Escape; without the fix, Combobox and PayeeCombobox fail. A unit test in `inertRoot.test.ts` fails without the fix as well. `inertRoot.ts` was not in the plan's files.

**2. [Defect found by looking] On phones, specimen rows squeezed their controls.** In `gallery-390-light`, MonthRangePicker's native From and To read "June 2(" and "Novem", and fields were narrower than on a screen. `Specimen.tsx` now puts the state name above the control under 768 px. The phone test asserts each From/To input is at least 150 px wide; it fails without the change. Desktop pictures are unchanged.

**3. Pictures of open popovers drifted by 1 to 3 px between runs.** The clip was measured while the popover's entrance animation was still running. The test now waits for the popover's animations to finish and rounds the clip to whole pixels (commit 4). No tolerance or retry was added.

**4. The Payee field specimen is outside the 44 px check.** The bare PayeeCombobox in the Combobox card is 23 px tall at 390 px. It is the register row's look; the phone sheet passes its own field classes. As with Money entry, it is left out with a comment in the spec. See Issues for the screen-level follow-up.

**5. Sample data exported.** `FREQUENCIES`, `ACCOUNTS`, `PAYEES`, `GROUPS` and `TRANSFER_ACCOUNTS` are now exported from their gallery cards, so `DialogCard` reuses them instead of copying them.

**6. Baselines made with the script's own steps, limited to three specs.** `bash e2e/gallery-baselines.sh` stops before copying any image when a test fails, and an existing Combobox test fails in the container (see Issues). As in 02-13, I ran a scratch copy of the script that differs only in passing the spec list (`matrix`, `overlays`, `switch`) to Playwright. Same image, platform, lockfile installs and `--update-snapshots=changed`.

**7. The full-page "not today" check uses a clock set to 5 March 2031** rather than the real date. The real month is the pinned month (November 2026), so checking against today could not catch anything this month. The test asserts that no "2031", "05/03" or "5 Mar" appears, and that "16 Nov 2026" does.

## Issues Encountered

- **`bash e2e/gallery-baselines.sh` (whole gallery project) still exits 1 in the container, on a test this plan did not touch.** `combobox.spec.ts:134` ("without custom values the field returns to the chosen label…") times out because the list closes while Playwright scrolls to click an option. 02-13 recorded the same failure on the untouched base commit. It passes on macOS (42/42 with `--repeat-each=3`). The plan's command `bash e2e/gallery-baselines.sh && bash e2e/gallery-baselines.sh` therefore does not pass as written. The comparison over this plan's three specs passed twice in a row. CI's Linux run may show the same failure; it needs fixing in `combobox.spec.ts` (02-12 or the Combobox owner).
- **MonthRangePicker on phones still cuts off the last digit of "November 2026".** Each native month input is about 160 px wide beside the other inside a card, and Chromium on Linux draws the full month name with a picker icon. This is MonthRangePicker's own phone layout from 02-14, not the gallery's. On iOS Safari the native month field is drawn differently and may not clip; the manual iPhone check below will tell. Left for the owner: stack From and To, or accept it.
- **The bare PayeeCombobox is 23 px tall at 390 px.** It does not affect phones today because the phone sheet passes its own field classes. The transaction detail panel passes a `className` over the bare look (about 38 px); check it in Phase 3/4 if that panel is used on phones.

## Manual checks (02-VALIDATION.md)

Not done. They need the owner: the VoiceOver pass over `/dev/controls`, and on an iPhone at 390 px, tapping Select, DatePicker, MonthPicker and MonthRangePicker's From and To to confirm the phone's own pickers open.

## Verification

- `npm --prefix e2e test -- --project=gallery tests/gallery/matrix.spec.ts`: 13 passed, 28 skipped (pixel tests; the four full-page tests run their date and width checks before skipping the picture)
- `npm --prefix e2e test -- --project=gallery tests/gallery/overlays.spec.ts`: 19 passed, 16 skipped (pixel)
- Plan-exit gate `npm --prefix e2e test -- --project=gallery`: 145 passed, 46 skipped (pixel tests only)
- Container comparison of matrix, overlays and switch specs: 86/86, twice in a row with no update between
- `npm --prefix e2e test -- --project=desktop tests/dialog-focus.spec.ts tests/accessibility.spec.ts`: 21 passed
- `npm --prefix client test`: 826 passed (92 files)
- `cd e2e && npx tsc --noEmit`: clean; `cd client && npx tsc --noEmit`: clean
- ESLint on the changed client files: no findings; Prettier check on every changed file: clean
- `find e2e/tests/gallery/__screenshots__ -name '*.png' | wc -l`: 46 (focus 24, open 16, gallery 4, switch 2)
- `grep -c "data-focus-fake\|force-focus" client/src/pages/DevControlsGallery.tsx`: 0
- `grep -c "maxDiffPixelRatio\|threshold:" e2e/tests/gallery/*.ts`: 0 for every file
- No package or lockfile change; no STATE.md or ROADMAP.md change

## Self-Check: PASSED

- Files exist: `matrix.spec.ts`, `overlays.spec.ts`, `DialogCard.tsx`, 46 baselines
- Commits exist: fc7e7a0, 492dbc0, 2258027, 67c61db
- Every committed image was looked at (focus, open and full-page, light and dark)

## Next Phase Readiness

02-12 can document the gallery, the screenshot test and `gallery-baselines.sh`. Before relying on the whole-project script, fix the existing `combobox.spec.ts:134` container failure. The CHANGELOG should mention the dialog fix: a Combobox list closing inside a dialog no longer makes the page behind it clickable.
