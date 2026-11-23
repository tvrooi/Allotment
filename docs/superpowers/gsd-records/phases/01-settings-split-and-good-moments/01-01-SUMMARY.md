---
phase: 01-settings-split-and-good-moments
plan: 01
subsystem: ui
tags: [react, react-router, playwright, vitest, accounts, connected-banks]

requires: []
provides:
  - "Lazy page /accounts/connections (pages/AccountConnections.tsx, default export AccountConnectionsPage)"
  - "movedSections.ts: CONNECTED_BANKS_PATH, BANK_PROVIDERS, type BankProvider, parseProvider, connectedBanksLink (CONNECTED_BANKS_LINK kept as an alias for plan 02)"
  - "?provider= allowlisted query parameter on /accounts/connections, held in the URL"
  - "Accounts header link 'Connected banks' (data-guide accounts.connections); empty state 'Connect a bank' opens the page"
  - "ConnectedBanks panel without its own heading/intro/ref; props provider: BankProvider, onProvider"
  - "PageHeader breadcrumb nav aria-label='Breadcrumb', 48 px phone hit area, aria-hidden chevron"
  - "Bank e2e specs re-pointed at /accounts/connections"
affects: [01-02, 01-03, 01-07, guides, command-palette, link-sites]

actuals:
  tokens: 10300
  tasks: 3
  commits: 3
plan_head_before: 1627caee17ed8826c3d67efd0dcfd16a8b7ac032
plan_head_after: 0c482d1e0f179ead9fa6b94e0fb9e38a5e28daca

tech-stack:
  added: []
  patterns:
    - "URL-held sub-page state: parseProvider(searchParams.get('provider')) ?? 'up' on every render; setSearchParams({ provider }, { replace: true })"
    - "Moved-section paths and the provider allowlist live only in utils/movedSections.ts; routes import the constant"

key-files:
  created:
    - client/src/pages/AccountConnections.tsx
  modified:
    - client/src/utils/movedSections.ts
    - client/src/utils/movedSections.test.ts
    - client/src/App.tsx
    - client/src/components/accounts/ConnectedBanks.tsx
    - client/src/pages/Accounts.tsx
    - client/src/components/ui/PageHeader.tsx
    - e2e/tests/accounts.spec.ts
    - e2e/tests/up.spec.ts
    - e2e/tests/enable-banking.spec.ts
    - e2e/tests/first-import.spec.ts
    - e2e/tests/switchers.spec.ts
    - e2e/tests/settings.spec.ts
    - e2e/tests/demo/demo.spec.ts
    - e2e/tests/phone/polish-phone.spec.ts
    - e2e/tests/phone/targets-phone.spec.ts
    - e2e/tests/phone/phone.spec.ts
    - e2e/tests/phone/page-gutter.spec.ts
    - e2e/tests/accessibility.spec.ts

key-decisions:
  - "Connected banks opens on Up when ?provider= is absent or not allowed: Up is the supported bank and first in the toggle"
  - "The URL is the only provider state (no useState copy), so a pill clicked while the page is open still switches provider"
  - "origin/redesign was already an ancestor of wave-f (1627cae); no merge was needed and wave-f holds no .planning file"
  - "CONNECTED_BANKS_LINK stays exported, equal to CONNECTED_BANKS_PATH, so its six importers compile until plan 02 re-points them"

patterns-established:
  - "Sub-page frame: flex flex-col h-full bg-surface, PageHeader with breadcrumbs, content flex-1 overflow-y-auto py-6 PAGE_GUTTER with useScrollMemory(name), inner max-w-2xl"
  - "Breadcrumb links get max-md:py-4 max-md:-my-4 for a 48 px phone hit area without growing the row"

requirements-completed: [WAVF-01, WAVF-03]

coverage:
  - id: D1
    description: "Accounts header link opens /accounts/connections and Up is reached in two clicks; breadcrumb returns to /accounts"
    requirement: "WAVF-01"
    verification:
      - kind: e2e
        ref: "e2e/tests/accounts.spec.ts#the Up connection is two clicks from Accounts (#244)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With no accounts, the empty state's 'Connect a bank' link opens the page on Up"
    requirement: "WAVF-01"
    verification:
      - kind: e2e
        ref: "e2e/tests/accounts.spec.ts#a budget with no accounts yet can connect a bank from Accounts (#244)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/settings?tab=connections lands on /accounts/connections with Up pressed"
    requirement: "WAVF-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/settings.spec.ts#old links to Connected banks and Categories open their new homes"
        status: pass
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#movedSettingsTab (#244)"
        status: pass
    human_judgment: false
  - id: D4
    description: "?provider= is matched exactly against the four bank ids; anything else falls back to Up"
    verification:
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#parseProvider (#244)"
        status: pass
      - kind: unit
        ref: "client/src/utils/movedSections.test.ts#connectedBanksLink (#244)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Up, Enable Banking, first-import, switcher, demo and phone tab-bar flows pass against the new page"
    verification:
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/up.spec.ts tests/enable-banking.spec.ts tests/first-import.spec.ts tests/switchers.spec.ts tests/settings.spec.ts (37 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=demo tests/demo/demo.spec.ts (14 passed)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=phone tests/phone/polish-phone.spec.ts (12 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 390 px the breadcrumb and Accounts header buttons are at least 44 px, the header wraps its buttons under the title, no sideways overflow, title on the shared gutter, no nameless controls"
    verification:
      - kind: e2e
        ref: "e2e/tests/phone/targets-phone.spec.ts#the Connected banks page has a full-size way back and full-size header buttons (#244)"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=phone tests/phone/phone.spec.ts tests/phone/page-gutter.spec.ts"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=desktop tests/accessibility.spec.ts (10 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 390 px, light and dark, the Accounts header reads as two tidy lines and the provider toggle sits directly under the Connected banks header"
    verification: []
    human_judgment: true
    rationale: "Visual judgment from the plan's <human-check>; screenshots are taken in plan 07"

duration: 15min
completed: 2026-11-15
status: complete
---

# Phase 1 Plan 01: Connected banks under Accounts Summary

**Connected banks is its own lazy page at `/accounts/connections`, opened from the Accounts header and empty state, with an allowlisted `?provider=` held in the URL (Up by default), and every bank e2e flow pointed at it**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-14T23:05:00Z
- **Completed:** 2026-11-14T23:20:00Z (15 November 2026, AEDT)
- **Tasks:** 3 of 3
- **Files modified:** 19 (1 created, 18 modified) on `wave-f`

## Accomplishments

- Worktree repaired: `git worktree repair` pointed `/Users/tristanvanrooyen/wt-f/.git` at `~/Github/Allotment/.git/worktrees/wt-f`; the gate printed `worktree-ok` (branch `wave-f`, `1627cae` at HEAD).
- `origin/redesign` (`0426504`) had not moved past wave-f's base, so nothing was merged. `git ls-files .planning` is 0 on wave-f.
- Node v24.10.0 (`/opt/homebrew/opt/node@24/bin`) for every check. Baseline client suite before any edit: 75 files, 577 tests passed.
- `/accounts/connections`: PageHeader with breadcrumbs "Accounts › Connected banks", the UI-SPEC subtitle verbatim, `useScrollMemory('accounts-connections')`, a `max-w-2xl` column inside `PAGE_GUTTER`. Its route is declared before `/accounts/:id`.
- `movedSections.ts` gives the final bank API: `CONNECTED_BANKS_PATH`, `BANK_PROVIDERS`, `BankProvider`, `parseProvider`, `connectedBanksLink`. The `connections` redirect now targets the page.
- The Accounts page is back to redesign's version plus two edits: the header has a secondary "Connected banks" link left of "Add account" and a wrapping row, and the empty state's "Connect a bank" goes to the page.
- On phones the PageHeader breadcrumb is a labelled landmark with 48 px links, which also covers Files and the report widget view.

## Task Commits

Committed on `wave-f` in `/Users/tristanvanrooyen/wt-f` (not pushed):

1. **Task 1: tracer, Accounts header opens Connected banks on Up**: `65804d8` (feat)
2. **Task 2: bank flow specs open the new page**: `313b6ce` (test)
3. **Task 3: phone targets and accessibility sweeps**: `0c482d1` (fix)

**Plan metadata:** this SUMMARY's commit in the planning checkout (`redesign`)

## Files Created/Modified

- `client/src/pages/AccountConnections.tsx`: the new page. The provider comes from the URL, falling back to Up.
- `client/src/utils/movedSections.ts` (+ test): the path, the provider allowlist, the link builder and the redirect target.
- `client/src/App.tsx`: the lazy `AccountConnectionsPage` route at `CONNECTED_BANKS_PATH`.
- `client/src/components/accounts/ConnectedBanks.tsx`: `BanksSection`, the h2, the intro text, `headingRef`, `HEADING_ID` and the local `BankProvider` are removed. The variants render in a `space-y-5` div; the loading state is only the spinner.
- `client/src/pages/Accounts.tsx`: restored from origin/redesign, plus the header link and the empty-state target.
- `client/src/components/ui/PageHeader.tsx`: `aria-label="Breadcrumb"`, the phone hit area on breadcrumb links, and an `aria-hidden` chevron.
- e2e: `accounts` (two rewritten tests), `up` (5 sites), `enable-banking` (2 sites plus the comment), `first-import` (2), `switchers` (2), `settings` (Connected banks half of the redirect test), `demo/demo` (strip href, bank test route), `phone/polish-phone` (route list), `phone/targets-phone` (new test), `phone/phone`, `phone/page-gutter`, `accessibility` (route lists).

## Verification Run (Node 24, one browser run at a time)

| Command | Result |
|---|---|
| Worktree gate (`git -C wt-f status`, branch, `1627cae` ancestor) | `worktree-ok` |
| `npm --prefix client test -- src/utils/movedSections.test.ts` | RED 4 failed, then GREEN 5 passed |
| `npm --prefix e2e test -- --project=desktop tests/accounts.spec.ts` | 13 passed |
| desktop `up`, `enable-banking`, `first-import`, `switchers`, `settings` | 37 passed |
| demo `demo/demo.spec.ts` | 14 passed |
| phone `polish-phone` (re-run on the final tree) | 12 passed |
| phone `targets-phone` before the PageHeader edit | new test failed (`Breadcrumb` nav not found); other 3 passed |
| phone `targets-phone`, `phone`, `page-gutter` | 11 passed |
| desktop `accessibility.spec.ts` | 10 passed |
| `npm --prefix client test` (full) | 75 files, 580 tests passed |
| `npm run build --prefix client` | built |
| `cd client && npx tsc --noEmit` | exit 0 |
| `cd lint && npm test` / `npm run lint` | 85 passed / 0 errors, 128 warnings (cap 128, unchanged) |

## Decisions Made

- **Default provider is Up.** When `?provider=` is missing or not in the allowlist, the page opens on Up, because Up is the supported bank and first in the toggle.
- **The URL is the only provider state.** The page reads the provider from the URL on every render instead of copying it into `useState`. A pill clicked while the page is already open therefore still switches the provider. Writes use `replace: true`, as Settings does for its tab.
- `CONNECTED_BANKS_LINK` stays as an alias of `CONNECTED_BANKS_PATH`; plan 02 re-points the six importers and removes it. `MANAGE_CATEGORIES_LINK`, the `categories` redirect and `movedSettingsTab`'s signature are unchanged (plan 03 owns them).

## Deviations from Plan

### Auto-fixed Issues

None needed a rule-based fix. Three small, documented departures:

**1. [Scope note] Panel and demo comments reworded**
- **Found during:** Task 1 and Task 2
- **Issue:** The panel's doc comment called it "a section of the Accounts page", and the demo test's comment said banks live on Accounts. Neither was true after the change.
- **Fix:** The panel comment now says it is the body of its page under Accounts. The demo comment explains that the sidebar scoping is a guard. No behaviour change.
- **Committed in:** `65804d8`, `313b6ce`

**2. [Process] Browser RED for Task 1 was not run on its own**
- **Issue:** The plan says to watch the tests fail before implementing. RED was observed for the unit test (4 failures). The two rewritten browser tests were not run before the implementation, to save a full build cycle. They assert on a link and a route that did not exist at `1627cae`, so they could not have passed there. Task 3's browser RED was observed.

**3. [Process] polish-phone ran twice**
- The first run happened before Task 3's PageHeader edit. It was re-run on the final tree (12 passed), so its result covers the committed code.

**Total deviations:** 0 auto-fixed, 3 documented process/comment notes. **Impact:** none on scope or behaviour.

## Issues Encountered

- The panel's loading branch used to show a visible line, "Checking your bank connections…", through the removed section description. As the plan specifies, it now shows only the spinner, which is `aria-hidden`. While the bank queries load, assistive technology therefore hears nothing. This matches the UI-SPEC ("its own spinner, unchanged"), but the verifier may want a `role="status"` label in a later plan.

## Known Stubs

None.

## Threat Flags

None. `?provider=` (T-01-01) is mitigated by `parseProvider`'s exact allowlist, and unit tests cover `UP`, `Up`, `../x`, `constructor`, the empty string and null. The redirect target (T-01-02) is still the constant behind `Object.hasOwn`. No merge happened (T-01-04). No package was installed (T-01-SC).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 02 can re-point the six `CONNECTED_BANKS_LINK` importers to `connectedBanksLink(...)` and remove the alias. The guide step can target `accounts.connections`, which now exists on `/accounts`.
- Plan 03 owns the Categories half: `MANAGE_CATEGORIES_LINK`, the `categories` redirect, and `movedSettingsTab` taking `URLSearchParams`.
- Plan 07 pushes `wave-f` and takes the 390 px light and dark screenshots (D7).

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND: /Users/tristanvanrooyen/wt-f/client/src/pages/AccountConnections.tsx
- FOUND on wave-f: 65804d8, 313b6ce, 0c482d1 (ancestors of HEAD `0c482d1`; 3 commits after `1627cae`)
