---
phase: 02-shared-form-controls
plan: 04
subsystem: ui
tags: [gallery, vite, playwright, e2e, build-exclusion, wave-g]

requires:
  - phase: 02-shared-form-controls
    provides: "02-03 owner gate: go-with-changes, Changed decisions: D-11 (precondition checked: gate-ok)"
provides:
  - "/dev/controls: the development-only controls gallery (PageHeader 'Controls gallery', theme button, Switch card: today's Switch off, on, disabled)"
  - "withoutDevGallery() in client/vite.config.ts and the Vite mode `gallery`"
  - "GalleryCard and Specimen (client/src/pages/devGallery/Specimen.tsx), the card and the named specimen row every later card uses"
  - "GALLERY_PORT = 3169, the `gallery` Playwright project, E2E_GALLERY_ONLY=1"
  - "openGallery(page, { theme, width }) and specimen(page, control, state) in e2e/tests/gallery/gallery.ts"
affects: [02-11, 02-12, 02-15, 02-16, 02-17, 02-18, 02-19]

actuals:
  tokens: 5518
  tasks: 1
  commits: 1
plan_head_before: 20c4efcfa04da622ea9f15dbcbe10b7606278b8a
plan_head_after: da09d18bcb430e53e85650bbd14999fe37090cf0

tech-stack:
  added: []
  patterns:
    - "Build exclusion by resolveId stub, like withoutDemoWorker(): the real module only in dev and `--mode gallery`"
    - "Gallery specs use Playwright's own `test`; each test sets its viewport and theme through openGallery"
    - "Specimen rows are role=group named '<Control>, <State>'; cards are sections (regions) named by their h2"

key-files:
  created:
    - client/src/pages/DevControlsGallery.tsx
    - client/src/pages/DevControlsGallery.stub.ts
    - client/src/pages/devGallery/Specimen.tsx
    - client/src/pages/devGallery/SwitchCard.tsx
    - e2e/tests/gallery/gallery.ts
    - e2e/tests/gallery/harness.spec.ts
    - e2e/tests/gallery-absent.spec.ts
  modified:
    - client/src/App.tsx
    - client/vite.config.ts
    - e2e/ports.ts
    - e2e/global-setup.ts
    - e2e/playwright.config.ts

key-decisions:
  - "Gallery port is 3169, not 02-UI-SPEC.md's 3181: from 3180 up, ports belong to the multi-user budgets"
  - "The absence spec opens /dev/controls on the default web build in server mode (SERVER_PORT), which answers any page URL; the desktop server has no page-URL fallback, so a desktop-port check would be vacuous"
  - "The theme button goes through the app's own theme preference (usePreferencesStore.setTheme, which applyTheme draws); applyTheme.ts was outside this plan's files and exports only initTheme"
  - "The gallery project blocks service workers: the gallery build is a production, non-electron build, so main.tsx registers sw.js"
  - "global-setup's static serving is one helper (sendBuildFile, listen) shared by the demo and gallery servers, plus removeRunDir shared by both teardowns, rather than a second copy"

patterns-established:
  - "A new gallery card: a component in client/src/pages/devGallery/ using GalleryCard and Specimen, added to DevControlsGallery's main; its spec in e2e/tests/gallery/ calls openGallery first"

requirements-completed: [WAVG-04]

coverage:
  - id: D1
    description: "The gallery opens in its own build at /dev/controls with its heading, a working theme button, no sideways scroll at 390 px, and a disabled Switch specimen"
    requirement: "WAVG-04"
    verification:
      - kind: e2e
        ref: "e2e/tests/gallery/harness.spec.ts (npm --prefix e2e test -- --project=gallery)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The default, electron and demo builds contain no gallery text, and the default build served in server mode shows its sign-in, not the gallery, at /dev/controls"
    requirement: "WAVG-04"
    verification:
      - kind: other
        ref: "npm --prefix client run build && ! grep -rlq 'Controls gallery' client/dist (and --mode electron, --mode demo into scratch dirs)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery-absent.spec.ts (desktop project)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E_GALLERY_ONLY=1 runs the gallery project without the desktop, server-mode or multi-user servers"
    requirement: "WAVG-04"
    verification:
      - kind: e2e
        ref: "E2E_GALLERY_ONLY=1 npm --prefix e2e test -- --project=gallery, with ports 3170-3178 polled each second: none listened"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-11-17
status: complete
---

# Phase 2 Plan 04: The controls gallery harness Summary

**A development-only `/dev/controls` gallery, swapped for an empty stub in every build except `vite build --mode gallery`, served on port 3169 to its own `gallery` Playwright project, with today's Switch (off, on, disabled) as its first card.**

## Performance

- **Duration:** about 20 minutes
- **Completed:** 2026-11-17
- **Tasks:** 1 of 1 (tracer)
- **Files:** 12 (7 created, 5 modified), 337 insertions, 39 deletions

## Accomplishments

- **Gallery page.** `DevControlsGallery.tsx` renders, inside its own `BrowserRouter`, the shared
  `PageHeader` titled "Controls gallery", a secondary `Button` reading "Switch to dark theme" or
  "Switch to light theme", and the cards on `bg-page` with `PAGE_GUTTER`, `pt-6 pb-16` and
  `space-y-8`. It fetches nothing and reads no budget.
- **Card and row.** `GalleryCard` is a `section` labelled by its `h2` (so it is a region named
  after the control), `bg-surface rounded-lg p-4 md:p-6`. `Specimen` is a `role="group"` row named
  "<Control>, <State>", the state name (`w-24 text-sm font-medium text-text-secondary`) beside its
  content.
- **Switch card.** `SwitchCard.tsx` shows `components/ui/Switch` as it is today: Off and On
  (interactive, local state) and Disabled (off). Each switch is named "Sample setting".
- **Route.** `App.tsx` lazily imports the gallery and, when
  `import.meta.env.DEV || import.meta.env.MODE === 'gallery'` and the path is `/dev/controls`,
  returns it in a `Suspense` instead of `AuthGate` and the router: no sign-in, server or budget.
  `useSafeMode()` stays the first call.
- **Build exclusion.** `withoutDevGallery()` resolves `src/pages/DevControlsGallery.tsx` to
  `DevControlsGallery.stub.ts` (a default export rendering `null`) whenever
  `command === 'build' && mode !== 'gallery'`. The dev server and the gallery build get the real
  page.
- **e2e harness.** `GALLERY_PORT = 3169`; global-setup builds `client-gallery` beside the other
  three builds (and in the `E2E_SKIP_BUILD` cache as `flybudget-e2e-cache-client-gallery`), serves
  it at the root with the demo's headers (a path without an extension gets `index.html`), and
  closes it in the teardown. `E2E_GALLERY_ONLY=1` builds and serves only the gallery and returns
  before any mock or server starts. The `gallery` project matches `tests/gallery/*.spec.ts` at
  1280×800; `desktop` ignores `tests/gallery/`.

## Task Commits

1. **Task 1: the gallery opens in its own build and no other** - `da09d18` (feat)

## Files Created/Modified

- `client/src/pages/DevControlsGallery.tsx` - the gallery page
- `client/src/pages/DevControlsGallery.stub.ts` - the empty module every other build gets
- `client/src/pages/devGallery/Specimen.tsx` - `GalleryCard`, `Specimen`
- `client/src/pages/devGallery/SwitchCard.tsx` - today's Switch off, on, disabled
- `client/src/App.tsx` - the gated `/dev/controls` route outside `AuthGate`
- `client/vite.config.ts` - `withoutDevGallery()`; `defineConfig` now destructures `command`
- `e2e/ports.ts` - `GALLERY_PORT = 3169`
- `e2e/global-setup.ts` - gallery build and server, `E2E_GALLERY_ONLY`, shared static-file helper
- `e2e/playwright.config.ts` - the `gallery` project; `gallery` in desktop's `testIgnore`
- `e2e/tests/gallery/gallery.ts` - `openGallery`, `specimen`
- `e2e/tests/gallery/harness.spec.ts` - heading, theme, 390 px, disabled switch
- `e2e/tests/gallery-absent.spec.ts` - no gallery at `/dev/controls` on the default build

## Verification (run on the host, Node 24.10.0)

| Check | Result |
|-------|--------|
| Precondition (02-03 record: `Owner gate: go-with-changes`, `Changed decisions: D-11`, 02-14-PLAN.md present) | `gate-ok` |
| `npm --prefix e2e test -- --project=gallery tests/gallery/harness.spec.ts` | 4 passed |
| `npm --prefix client run build && ! grep -rlq 'Controls gallery' client/dist && echo absent` | `absent` |
| `--mode electron` and `--mode demo` builds into scratch dirs, grepped | both absent; `--mode gallery` present |
| Mutation: `withoutDevGallery()` disabled, default build grepped | present (the guard is load-bearing) |
| `npm --prefix e2e test -- --project=desktop tests/gallery-absent.spec.ts tests/navigation.spec.ts` | 10 passed |
| Negative: absence spec pointed at the gallery build (3169), temporarily | failed as it should, then restored |
| `E2E_GALLERY_ONLY=1 npm --prefix e2e test -- --project=gallery`, ports 3170-3178 polled | 4 passed; no server port opened |
| Order: `--repeat-each=2`, and one test alone (`-g 'disabled switch'`) | 8 passed; 1 passed |
| Plan-exit gate `npm --prefix e2e test -- --project=gallery` | 4 passed |
| `npm --prefix e2e test -- --project=desktop --list` files under `tests/gallery/` | 0 |
| `(cd e2e && npx tsc --noEmit)` | exit 0 |
| `npm run build --prefix client` (includes `tsc -b`) | built |
| `npm test --prefix client` | 76 files, 617 tests passed |
| `cd lint && npm run lint` | 0 errors, 128 warnings (cap 128; the only App.tsx warning is the existing `window as any` line) |
| Prettier on the 12 files | unchanged |
| `Switch.tsx`, `Welcome.tsx`, every `package.json` and lockfile | unchanged |

## Decisions Made

See `key-decisions` above. In short: port 3169; absence checked on the default build in server
mode; the theme button writes the app's theme preference; service workers blocked in the gallery
project; one shared static-file helper in global-setup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The absence spec opens the default build in server mode, not the desktop port**
- **Found during:** Task 1
- **Issue:** The plan puts `gallery-absent.spec.ts` in the desktop project and has it open
  `/dev/controls` "on the built app". The desktop server (`server/src/index.ts`) serves page URLs
  only in server mode, so `/dev/controls` on the desktop port is a 404, and the hash form
  (`/#/dev/controls`) never matches the route's path check. Either would pass with a gallery
  present.
- **Fix:** The spec stays in the desktop project but uses Playwright's own `test` and opens
  `http://localhost:${SERVER_PORT}/dev/controls`: the default web build (what Docker and Home
  Assistant ship), which answers any page URL. It waits for the set-up or sign-in screen, then
  finds no "Controls gallery" heading. Shown to fail when pointed at the gallery build.
- **Files modified:** `e2e/tests/gallery-absent.spec.ts`
- **Commit:** `da09d18`

**2. [Rule 2 - Missing critical functionality] Service workers blocked in the gallery project**
- **Found during:** Task 1
- **Issue:** The gallery build is a production build outside electron and the demo, so
  `main.tsx` registers `/sw.js`, which would make the page depend on a cache in later screenshot
  runs.
- **Fix:** `serviceWorkers: 'block'` in the `gallery` project's `use`.
- **Files modified:** `e2e/playwright.config.ts`
- **Commit:** `da09d18`

**3. [Rule 3 - Blocking] Root `npm ci` for Prettier**
- **Found during:** Task 1
- **Issue:** The plan's install list (client, server, e2e, lint) leaves out the root, where
  Prettier lives.
- **Fix:** `npm ci` at the root from the lockfile, install scripts still disabled by `.npmrc`. No
  `package.json` or lockfile changed.
- **Commit:** none (no file changed)

**Not deviations, recorded for clarity:** the theme button calls
`usePreferencesStore.getState().setTheme`, which `applyTheme`'s subscription draws (the plan's
"through `applyTheme`"; `applyTheme.ts` was outside the plan's files and exports only
`initTheme`). global-setup's demo server now shares `sendBuildFile`/`listen` with the gallery
server and both teardowns share `removeRunDir`; the demo server's behaviour is unchanged.

## Issues Encountered

None beyond the deviations above.

## For plan 02-15 (and every later gallery plan)

- **Opening the gallery.** Every spec calls `openGallery(page, { theme, width })` first. It sets
  the viewport (1280×800 or 390×844), pins `prefers-color-scheme: light`, opens `/dev/controls`,
  waits for the heading, asserts the light state, clicks the theme button when dark is asked for
  (and waits for the `dark` class), then waits for `document.fonts.ready`. No test relies on
  another's viewport or theme.
- **Finding rows.** `specimen(page, 'Switch', 'Disabled')` is the group by role and exact name.
  Cards are regions named by their title (`getByRole('region', { name: 'Switch' })`).
- **Adding a card.** Put it in `client/src/pages/devGallery/`, build it from `GalleryCard` and
  `Specimen`, and add it to `DevControlsGallery`'s `main`. The harness files do not need to change.
- **The Switch card today** has Off, On and Disabled only, each switch named "Sample setting".
  02-15 rebuilds the Switch and can extend the card to the five UI-SPEC states (Default, Focus,
  Disabled, Invalid, Read-only) and give each switch its own name.
- **Theme side effect.** The theme button writes the app's saved theme preference (localStorage).
  Each Playwright test has a fresh context, so nothing leaks between tests; in `npm run dev` it
  changes the developer's own saved theme on that origin.
- **Screenshots.** No `snapshotPathTemplate` or `toHaveScreenshot` defaults are set yet; the
  `gallery` project has `serviceWorkers: 'block'` and a 1280×800 default viewport. Fonts are the
  app's self-hosted Inter, loaded by `main.tsx`.
- **What the default build still contains.** A tiny `DevControlsGallery.stub-*.js` chunk (the
  lazy import resolved to the stub) and nothing else: no "Controls gallery" text and no
  `dev/controls` string (the route check folds away).
- **Gallery-only runs.** `E2E_GALLERY_ONLY=1` is for `--project=gallery` only; any other project
  needs the servers it skips. Never set `E2E_SKIP_BUILD=1` for a checked run.

## Threat Model Outcome

- **T-02-09** mitigated: stub swap in every non-gallery build, route gated on `DEV` or the gallery
  mode, grep gate on default/electron/demo outputs, desktop-project spec on the default build.
- **T-02-10** mitigated: the page fetches nothing, touches no API, cookie or token.
- **T-02-SC** mitigated: no package added or upgraded; lockfiles untouched.

No new security-relevant surface beyond the plan's threat model.

## Known Stubs

None that block the plan's goal. `DevControlsGallery.stub.ts` is the intended empty module for
non-gallery builds, not a missing-data stub.

## Next Phase Readiness

Plan 02-15 can rebuild the Switch and add the first Linux baselines on this harness.

## Self-Check: PASSED

- FOUND: client/src/pages/DevControlsGallery.tsx, client/src/pages/DevControlsGallery.stub.ts,
  client/src/pages/devGallery/Specimen.tsx, client/src/pages/devGallery/SwitchCard.tsx,
  e2e/tests/gallery/gallery.ts, e2e/tests/gallery/harness.spec.ts, e2e/tests/gallery-absent.spec.ts
- FOUND: commit da09d18 on HEAD's history
- `docs/superpowers/gsd-records/STATE.md` and `docs/superpowers/gsd-records/ROADMAP.md` unchanged by this plan
