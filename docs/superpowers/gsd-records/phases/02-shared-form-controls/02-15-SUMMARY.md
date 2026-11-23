---
phase: 02-shared-form-controls
plan: 15
subsystem: ui
tags: [switch, react-aria, gallery, playwright, screenshots, baselines, wave-g, "264"]

requires:
  - phase: 02-shared-form-controls
    provides: "02-04: the controls gallery, its `gallery` Playwright project, openGallery and specimen"
provides:
  - "client/src/components/ui/fieldClasses.ts: toggleFocusRing, toggleDisabled, toggleReadOnly, toggleInvalid"
  - "The shared Switch on React Aria (SwitchField + SwitchButton) with props readOnly, isInvalid, children, labelSide; a name is required by its types (E-03)"
  - "Switch card with Default, Focus, Disabled (off and on), Invalid, Read-only (off and on)"
  - "expectScreenshot(locator, name) and PIXELS in e2e/tests/gallery/gallery.ts"
  - "e2e/gallery-baselines.sh [--update]: check or remake the gallery's Linux baselines in Playwright's image"
  - "Committed baselines switch-card-light.png and switch-card-dark.png"
affects: [02-06, 02-11, 02-12, 02-13, 02-16, 02-17, 02-18, 02-19]

actuals:
  tokens: 8076
  tasks: 2
  commits: 3
plan_head_before: ea3d537581ee030440a0fac183210b281a82e5a9
plan_head_after: 7d1f0df73c0e66e1601b6e73c3f9a2a4ff5317e9

tech-stack:
  added: []
  patterns:
    - "A toggle's looks are chosen in code from its props (disabled > read-only > enabled), so a unit test on static markup can prove a disabled switch carries no brand class"
    - "Focus ring on the visible indicator through group-data-[focus-visible] on React Aria's label"
    - "Pixel tests: test.skip(!PIXELS, reason) then expectScreenshot; functional tests never skip"
    - "Browser colour checks compare computed styles with a token's computed value (a probe element), through retrying toHaveCSS"

key-files:
  created:
    - client/src/components/ui/fieldClasses.ts
    - client/src/components/ui/Switch.test.ts
    - e2e/gallery-baselines.sh
    - e2e/tests/gallery/switch.spec.ts
    - e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-light.png
    - e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-dark.png
  modified:
    - client/src/components/ui/Switch.tsx
    - client/src/pages/Welcome.tsx
    - client/src/pages/devGallery/SwitchCard.tsx
    - e2e/playwright.config.ts
    - e2e/tests/gallery/gallery.ts
    - e2e/tests/gallery/harness.spec.ts
    - e2e/tests/first-run.spec.ts

key-decisions:
  - "Built on SwitchField + SwitchButton, not the plain Switch: react-aria-components 1.22.1 marks Switch deprecated and its props omit isInvalid"
  - "Disabled and read-only tracks use an inset 1 px ring, not a border, so the thumb stays centred in the 24 px track"
  - "Read-only: off is a surface-alt track with a text-secondary thumb; on is a text-secondary track with a surface thumb (UI-SPEC is silent on the read-only thumb)"
  - "The label (React Aria's SwitchButton) is the 44 px target and carries the cursor; the class prop goes on it"
  - "Baselines from mcr.microsoft.com/playwright:v1.64.0-noble on linux/amd64 (under emulation on this Apple Silicon Mac)"
  - "The default per-pixel threshold stays: a near-hue swap (brand-600 to negative) passes it, a clear token change fails it. Not tightened, as the plan asks for no change to comparison strictness"

patterns-established:
  - "A new control's state strings go in fieldClasses.ts"
  - "A gallery card's pixel test: openGallery, then expectScreenshot on the card's region, named <control>-card-<theme>; baselines made with bash e2e/gallery-baselines.sh --update"

requirements-completed: [WAVG-02, WAVG-03, WAVG-04]

coverage:
  - id: D1
    description: "A disabled Switch has a surface-alt track, an inset border ring and a text-disabled thumb at its on or off position, with no brand class and no opacity (#264)"
    requirement: "WAVG-02"
    verification:
      - kind: unit
        ref: "client/src/components/ui/Switch.test.ts (failed 7 of 9 on the old Switch, passes 9 of 9)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/switch.spec.ts 'a disabled switch in the dark theme has the surface-alt track (#264)'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Keyboard: Tab reaches the Focus specimen with a 2 px brand outline on its track, Space toggles it, Tab skips disabled switches, Space leaves a read-only one unchanged"
    requirement: "WAVG-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/switch.spec.ts 'the keyboard reaches the switch...'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Switch is a 44 x 44 px target at 1280 and 390 px wide, with or without a visible label"
    requirement: "WAVG-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/switch.spec.ts 'every switch has a 44 px hit area at 1280/390 px'; e2e/tests/first-run.spec.ts touch targets"
        status: pass
    human_judgment: false
  - id: D4
    description: "Welcome's feature switches keep their names and behaviour with no label inside a label"
    requirement: "WAVG-02"
    verification:
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/first-run.spec.ts tests/accessibility.spec.ts (18 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gallery's Switch card is compared in light and dark against committed Linux baselines; a changed control and a missing baseline both fail"
    requirement: "WAVG-04"
    verification:
      - kind: e2e
        ref: "bash e2e/gallery-baselines.sh (11 passed); mutation bg-brand-600 -> bg-positive exit 1; missing baseline exit 1"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-11-17
status: complete
---

# Phase 2 Plan 15: The shared Switch on React Aria, and Linux screenshot baselines Summary

**The shared Switch is now React Aria's SwitchField and SwitchButton. A disabled switch reads as disabled (#264), and read-only and invalid have their own looks. The Switch card's light and dark images are committed Linux baselines that CI compares, checked or remade by one script in Playwright's own container.**

## Performance

- **Duration:** about 75 minutes
- **Completed:** 2026-11-17
- **Tasks:** 2 of 2 (tracer with TDD, then auto)
- **Files:** 13 (6 created, 7 modified), 479 insertions, 59 deletions

## Accomplishments

- **`fieldClasses.ts`** (new): `toggleFocusRing` (keyboard-only 2 px brand outline, offset 2,
  through `group-data-[focus-visible]`), `toggleDisabled` (`bg-surface-alt ring-1 ring-inset
  ring-border cursor-not-allowed`), `toggleReadOnly` (same fill and ring, `cursor-default`),
  `toggleInvalid` (`ring-1 ring-negative`). Tokens only, no hex, no opacity.
- **`Switch.tsx`**: `SwitchField` (`display: contents`) around a `SwitchButton` label, which is
  the `min-h-11 min-w-11 inline-flex items-center gap-2` target, holding the visually hidden
  `input role="switch"`, an optional visible label and the `h-6 w-10` track. Props: `checked`,
  `onCheckedChange`, `disabled`, `readOnly`, `isInvalid`, `className`, `children`, `labelSide`
  (`'end'` by default), and `aria-label`, which is required when there are no children (E-03).
  Looks:
  - Enabled: a text-tertiary track when off and brand-600 when on, with a surface or
    brand-contrast thumb.
  - Disabled: `toggleDisabled` with a text-disabled thumb that stays at its on or off position.
  - Read-only: `toggleReadOnly` when off; a text-secondary track with a surface thumb when on.
  - Invalid: adds `toggleInvalid`.
  - Motion stops under reduced motion.
- **Welcome**: each feature row is a `div` holding `<Switch labelSide="start" className="w-full
  justify-between">` with the same prompt and `(Feature)` text as its children. The name, the
  wording, text on the left with the switch on the right, and clicking the text all stay the
  same. The separate `aria-label` is gone, because the visible label now names the switch.
- **Switch card**: the specimens are Default ("Weekly summary", on), Focus (no visible label,
  "Round up purchases"), Disabled (off and on), Invalid and Read-only (off and on).
- **Screenshots**:
  - `playwright.config.ts` adds `snapshotPathTemplate`
    `{testDir}/{testFileDir}/__screenshots__/{testFileName}/{arg}{ext}`,
    `expect.toHaveScreenshot: { animations: 'disabled' }`, and
    `updateSnapshots: process.env.CI ? 'none' : 'missing'`.
  - `gallery.ts` adds `PIXELS` and `expectScreenshot`.
  - `switch.spec.ts` adds the two card shots at 1280×800 in light and dark.
- **`e2e/gallery-baselines.sh`**: reads the pinned `@playwright/test` version and runs that
  Playwright image on `linux/amd64`. It mounts the checkout read-only, copies it without
  `node_modules`, `.git`, builds or results, and runs `npm ci` for client and e2e with install
  scripts off (both from `.npmrc` and from flags). Then it runs the gallery project with
  `--retries=0`. A plain run compares with `CI=1`. `--update` uses
  `--update-snapshots=changed`, copies `__screenshots__` back and gives the files to the host
  user. It prints the image and its digest.

## Task Commits

1. **Task 1 (RED): failing unit and gallery tests** - `a97606a` (test)
2. **Task 1 (GREEN): the Switch on React Aria, fieldClasses, Welcome, card** - `afec26e` (fix)
3. **Task 2: Linux screenshot baselines** - `7d1f0df` (test)

## Baseline image and platform

- **Image:** `mcr.microsoft.com/playwright:v1.64.0-noble`
- **Digest:** `mcr.microsoft.com/playwright@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`
- **Platform:** `linux/amd64`. It ran under emulation on this arm64 Mac (Docker Desktop
  29.2.1), so the fallback without the platform flag was not needed.
- Both images were opened and checked by eye before committing (light 23.6 KB, dark 24.3 KB,
  1232×372).

## e2e selector changes (for the PR body)

- **`e2e/tests/first-run.spec.ts`**: the five welcome-switch clicks and the touch-target test
  now use a new helper, `switchTarget(control)` (`xpath=ancestor::label[1]`). React Aria puts
  the switch's input, visually hidden at 1 px, inside its label. The label covers the input, so
  clicking the input timed out, and the input's own box is 1 px rather than the 44 px target.
  The tests now click and measure the label, which is what a person taps. The checked and
  enabled assertions still use the switch itself, by role and name.
- **`e2e/tests/gallery/harness.spec.ts`** (outside the plan's file list): its last test looked
  for the old card's Off and On specimens and `aria-checked`. React Aria's input reports
  checked natively, and the card now has the five UI-SPEC states. The test now checks that
  every Disabled switch is disabled and the Default one is enabled.

## Verification

| Check | Result |
|-------|--------|
| Precondition: 02-04-SUMMARY.md present, `grep -c "name: 'gallery'" e2e/playwright.config.ts` | present; 1 |
| RED: `npm --prefix client test -- src/components/ui/Switch.test.ts` on the old Switch | 7 failed, 2 passed (the disabled tests among the failures) |
| GREEN: same | 9 passed |
| `npm --prefix e2e test -- --project=gallery tests/gallery/switch.spec.ts tests/gallery/harness.spec.ts` | 9 passed (before the pixel tests existed) |
| `npm --prefix e2e test -- --project=desktop tests/first-run.spec.ts tests/accessibility.spec.ts` | 18 passed |
| `npm --prefix lint test` / `npm --prefix lint run lint` | 86 pass, 0 fail / 0 errors, 128 warnings (cap 128) |
| `npm --prefix client run build` (includes `tsc -b`) | built |
| `npm --prefix client test` | 77 files, 626 tests passed |
| E-03 mutation: `aria-label` made optional with no children, `tsc -b` | `TS2578: Unused '@ts-expect-error'`; restored |
| `grep -c react-aria-components client/src/components/ui/Switch.tsx` | 1 |
| Hex grep on `fieldClasses.ts` | 0 |
| `<label` in `Welcome.tsx` | none |
| `bash e2e/gallery-baselines.sh --update` | 11 passed, 2 baselines written |
| `bash e2e/gallery-baselines.sh` | 11 passed, exit 0 |
| Negative: on colour `bg-brand-600` changed to `bg-positive`, `bash e2e/gallery-baselines.sh` | exit 1; light 564 px, dark 562 px different; restored |
| Negative (E-04 empty): `switch-card-dark.png` moved away, `bash e2e/gallery-baselines.sh` | exit 1, "A snapshot doesn't exist"; restored |
| `find e2e/tests/gallery/__screenshots__ -name '*.png' \| wc -l` | 2 |
| `git ls-files e2e/tests/gallery/__screenshots__` | both PNGs |
| `maxDiffPixelRatio` count in config, gallery.ts, switch.spec.ts | 0, 0, 0 (and no `threshold` or `maxDiffPixels`) |
| Plan-exit gate on the host: `npm --prefix e2e test -- --project=gallery` | 9 passed, 2 skipped (the pixel tests, macOS) |
| `bash -n e2e/gallery-baselines.sh`, mode | exit 0; 100755 in git |
| `git check-ignore` on the PNGs; `.prettierignore` | not ignored; Prettier does not parse PNG or shell files |
| `(cd e2e && npx tsc --noEmit)` | exit 0 |
| Prettier on every changed TS/TSX file | clean |
| `package.json` and lockfiles | unchanged |

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The gallery harness test followed the card's new specimens**
- **Found during:** Task 1
- **Issue:** `harness.spec.ts` asserted the old Off and On specimens and `aria-checked`. Neither
  exists after the rebuild: React Aria's input is natively checked, and the card has the five
  UI-SPEC states.
- **Fix:** The test now checks that every Disabled switch is disabled and the Default one is
  enabled. Keyboard and state checks are in `switch.spec.ts`.
- **Files modified:** `e2e/tests/gallery/harness.spec.ts`
- **Commit:** `afec26e`

**2. [Rule 1 - Bug] Colour assertions read the colours mid-transition**
- **Found during:** Task 1
- **Issue:** `transition-colors` animates `background-color` and `outline-color`. The dark-theme
  disabled check and the focus-ring colour check read a colour part-way through (for example
  `rgb(233, 230, 227)` on the way to the dark surface-alt).
- **Fix:** Both use Playwright's retrying `toHaveCSS`, which waits for the final value. There is
  no sleep and no retry setting.
- **Files modified:** `e2e/tests/gallery/switch.spec.ts`
- **Commit:** `afec26e`

**3. [Rule 3 - Blocking] Selector change in first-run.spec.ts** (allowed by the plan; see "e2e
selector changes" above)
- **Commit:** `afec26e`

**4. [Rule 3 - Blocking] Docker Desktop was not running**
- **Fix:** Started Docker Desktop (`open -a Docker`). No configuration changed.

**Not deviations, recorded for clarity:**
- **Welcome spacing:** the gap between a feature's text and its switch is now the Switch's
  `gap-2` (8 px, which UI-SPEC sets for a toggle and its label), where the old row had `gap-4`.
  It shows only when the text wraps beside the switch.
- **The hidden input's outline:** the input has `[&_input]:outline-none`, but the global
  unlayered `:focus-visible` rule in `index.css` currently overrides that utility. Nothing shows,
  because React Aria's VisuallyHidden clips the 1 px input. The `@layer base` change that a
  later plan makes to `index.css` lets the utility apply.

## Issues Encountered

- **The default threshold lets a near hue through.** A first mutation that swapped `bg-brand-600`
  for `bg-negative` (#bf3e00 and #cb2b30 in light) passed the comparison, because Playwright's
  default per-pixel colour `threshold` (0.2) absorbs the difference. A clear token change
  (`bg-positive`) failed it. The plan forbids loosening and did not ask for tightening, so the
  default stays. If the owner wants hue-level changes caught, a stricter `threshold` in
  `expect.toHaveScreenshot` is the knob; plan 02-12 can decide once it has seen CI's images.

## Open risk for plan 02-12

- The baselines were drawn on `linux/amd64` under emulation on an arm64 Mac. CI's
  `ubuntu-latest` runs the same tests natively on the runner's own Ubuntu with Playwright's
  Chromium, not inside this image. Fonts are self-hosted Inter and animations are disabled, but
  system libraries (FreeType, HarfBuzz, Skia's CPU path) can differ, so CI may draw a few pixels
  differently. If it does, plan 02-12 takes CI's own images as the baselines (from the failing
  run's `test-results` artifact) rather than adding a tolerance.

## Threat Model Outcome

- **T-02-11** (accept): the official image is pinned to the `e2e/package.json` version, its
  digest is printed and recorded above, the checkout is mounted read-only, and only `--update`
  writes, to the baseline folder alone.
- **T-02-12** mitigated: Linux baselines, self-hosted fonts awaited, animations disabled, fixed
  specimen values, no tolerance.
- **T-02-38** mitigated: the disabled look is unit-tested and checked in the dark theme in the
  browser. Welcome's names and wording are unchanged; `first-run.spec.ts` passes with only the
  label-click selector change recorded above.
- **T-02-SC** mitigated: no package added or upgraded, lockfiles untouched, install scripts off
  on the host and in the container.

No new security-relevant surface beyond the plan's threat model.

## Known Stubs

None. The Switch's help text, error line and default required message are left for plan 02-13
by design (they need `FieldErrorText` from 02-06 and `fieldMessages.ts` from 02-16).
`SwitchField` already provides the description and error slots they will use.

## Next Phase Readiness

Later plans add a card, a spec and (from plan 02-11) baselines with `bash e2e/gallery-baselines.sh
--update`. They do not need to touch the harness, the config or the script.

## Self-Check: PASSED

- FOUND: client/src/components/ui/fieldClasses.ts, client/src/components/ui/Switch.tsx,
  client/src/components/ui/Switch.test.ts, client/src/pages/Welcome.tsx,
  client/src/pages/devGallery/SwitchCard.tsx, e2e/playwright.config.ts, e2e/gallery-baselines.sh,
  e2e/tests/gallery/gallery.ts, e2e/tests/gallery/switch.spec.ts,
  e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-light.png,
  e2e/tests/gallery/__screenshots__/switch.spec.ts/switch-card-dark.png
- FOUND: commits a97606a, afec26e, 7d1f0df on HEAD's history
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` unchanged by this plan
- No commit mixes a `docs/superpowers/gsd-records/` file with a repository file
