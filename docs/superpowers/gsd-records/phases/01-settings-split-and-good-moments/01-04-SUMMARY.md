---
phase: 01-settings-split-and-good-moments
plan: 04
subsystem: ui
status: complete
tags: [react, command-palette, user-guide, playwright, vitest, server-message]

requires:
  - "01-01: CONNECTED_BANKS_PATH and the /accounts/connections page"
  - "01-02: the movedSections source guard"
  - "01-03: CATEGORIES_PATH and the /budget/categories page"
provides:
  - "navPages.ts PALETTE_PAGES: Connected banks (Link2, CONNECTED_BANKS_PATH) and Categories (Layers, CATEGORIES_PATH), with no sidebar row"
  - "Palette page results page:/accounts/connections and page:/budget/categories, remembered as recents"
  - "Palette recents of either page show their own name and icon (pageFor covers NAV_PAGES and PALETTE_PAGES)"
  - "User guide wording: Accounts → Connected banks (three places), Budget → Categories → Edit"
  - "D-09: the bank-linked delete blocker says 'Unlink it first: Accounts → Connected banks → {feed}'"
affects: [01-05, 01-06, 01-07, guides, docs-ui-map]

actuals:
  tokens: 3110
  tasks: 3
  commits: 3
plan_head_before: 90af5e4d02dbe8188a0f79e7d17202ac4c944040
plan_head_after: dd6fe29e12eee75bd81084c10ac9d0384344ac23

tech-stack:
  added: []
  patterns:
    - "Palette-only pages: a PALETTE_PAGES list beside NAV_PAGES. The sidebar reads only NAV_PAGES, and the palette reads both"

key-files:
  created: []
  modified:
    - client/src/components/layout/navPages.ts
    - client/src/components/layout/CommandPalette.tsx
    - client/src/userGuide/articles.tsx
    - client/src/components/settings/UnusedCategories.tsx
    - client/src/components/budget/RentOrOwn.tsx
    - server/src/services/accountDeletion.ts
    - server/src/routes/accountDeletion.test.ts
    - e2e/tests/command-palette.spec.ts
    - e2e/tests/user-guide.spec.ts
    - e2e/tests/cleanup.spec.ts

key-decisions:
  - "pageFor (palette recents) also looks at PALETTE_PAGES. Without that, a recent Connected banks would show as 'Connected banks · Accounts' with the Accounts icon"
  - "Guide sentences were lightly reworded ('every time it starts, and whenever', 'the Accounts → Connected banks page') so each place name stays on one source line after Prettier. The meaning is unchanged"

patterns-established:
  - "A page reached from another page's header, with no sidebar row, goes in PALETTE_PAGES so search still finds it"

requirements-completed: [WAVF-03]

coverage:
  - id: D1
    description: "The palette finds 'Connected banks' and 'Categories', opens /accounts/connections and /budget/categories, and lists both as recents; the sidebar has no new row"
    requirement: "WAVF-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/command-palette.spec.ts#Connected banks and Categories are found by search, and are not sidebar rows (#244)"
        status: pass
      - kind: e2e
        ref: "e2e/tests/navigation.spec.ts#every page opens from the sidebar"
        status: pass
      - kind: e2e
        ref: "npm --prefix e2e test -- --project=phone tests/phone/command-palette-phone.spec.ts (2 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The in-app user guide and the code comments say Accounts → Connected banks and Budget → Categories"
    requirement: "WAVF-03"
    verification:
      - kind: e2e
        ref: "e2e/tests/user-guide.spec.ts#the guide names where bank connections live now (#244)"
        status: pass
      - kind: command
        ref: "grep acceptance gates: 'Manage categories' 0, 'on the Accounts page' outside guides 0, articles 'Accounts → Connected banks' 3, 'Budget → Categories' 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-09: the 409 for a bank-linked account names Accounts → Connected banks → {feed}; the server diff is one string and one expectation"
    requirement: "WAVF-03"
    verification:
      - kind: unit
        ref: "server/src/routes/accountDeletion.test.ts#refuses while a bank feed supplies the account, and says how to unlink"
        status: pass
      - kind: e2e
        ref: "e2e/tests/cleanup.spec.ts#an account linked to Up cannot be deleted, and says how to unlink it"
        status: pass
    human_judgment: false

duration: 6 min
completed: 2026-11-15
---

# Phase 01 Plan 04: Palette entries and the new place names Summary

**Search now finds the palette-only pages Connected banks and Categories, which are also remembered as recents. The user guide and comments name Accounts → Connected banks and Budget → Categories. The server's bank-linked delete message points to Accounts → Connected banks → {feed} (D-09, one string).**

## Performance

- **Duration:** about 6 min (2026-11-15T04:02:11Z to 04:08Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 10 (75 insertions, 15 deletions)

## Accomplishments

- Added `PALETTE_PAGES` beside `NAV_PAGES`. Both paths come from `utils/movedSections`, so the source guard holds. `CommandPalette` appends these pages after the sidebar's pages, in the plain page shape with `remember: true`. `NAV_PAGES` still has 18 rows, and `Sidebar.tsx` does not reference the new list.
- The guide's Up article (Sync Now), its Enable Banking article (when access ends), and the Keep overspending hint now use the UI-SPEC names. The `UnusedCategories` and `RentOrOwn` comments now say Budget → Categories.
- D-09: the blocker message's wording changed, and nothing else did. The server diff against `origin/redesign` touches 2 files with 1+/1- each. No file under `server/src/routes` or `server/src/auth` changed apart from the test.

## Task Commits (wave-f, not pushed)

1. **Task 1 (tracer): the search palette opens Connected banks and Categories**: `4555726` (feat)
2. **Task 2: the guide and comments name the new places**: `ce527c9` (docs)
3. **Task 3: D-09 bank-linked delete message**: `dd6fe29` (fix)

## Verification Run (Node v24.10.0, one browser run at a time)

| Command | Result |
|---|---|
| Precondition: wave-f branch, Node v24 | met |
| desktop `command-palette.spec.ts -g "not sidebar rows"` before the code | RED: 1 failed (option "Connected banks" not found) |
| desktop `command-palette.spec.ts navigation.spec.ts` | 32 passed (tracer gate: run on the committed Task 1 tree) |
| phone `phone/command-palette-phone.spec.ts` | 2 passed |
| `npm --prefix client test -- src/utils/movedSections.test.ts src/utils/commandPalette` | 24 passed |
| desktop `user-guide.spec.ts` | 4 passed |
| `npm --prefix client test -- src/userGuide` | 4 passed |
| `npm --prefix client run build` | built, no `error TS` |
| `npm --prefix server test -- src/routes/accountDeletion.test.ts` after changing the expectation only | RED: 1 failed / 3 passed |
| the same, after the message change | 4 passed |
| `cd server && npx tsc --noEmit` | exit 0 |
| desktop `cleanup.spec.ts` | 3 passed |
| `npm --prefix client test` (full) | 75 files, 584 tests passed |
| `cd lint && npm run lint` | 0 errors, 128 warnings (cap 128, unchanged) |
| Acceptance greps (all tasks) | all pass |

Server diff (`git diff origin/redesign -- server/`), the whole of it:

```diff
-  expect(res.body.error).toMatch(/linked to Up\. Unlink it first: Settings → Connections → Up/);
+  expect(res.body.error).toMatch(/linked to Up\. Unlink it first: Accounts → Connected banks → Up/);
-      `${name} is linked to ${feed}. Unlink it first: Settings → Connections → ${feed}, then disconnect ${feed} (its transactions stay) and try again.`,
+      `${name} is linked to ${feed}. Unlink it first: Accounts → Connected banks → ${feed}, then disconnect ${feed} (its transactions stay) and try again.`,
```

## Decisions Made

- Palette recents resolve their page through both lists. A recent of a palette-only page then shows its own icon and has no parent "Accounts"/"Budget" detail. A small `ALL_PAGES` module constant holds the combined list.
- The guide was reworded only enough to keep each place name on a single source line. Otherwise Prettier would wrap "Accounts →" and "Connected banks" onto separate lines and the line-based acceptance grep would undercount. The text the person reads is unaffected either way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A palette recent of a palette-only page would show as a section of its parent page**
- **Found during:** Task 1
- **Issue:** `pageFor` (the recents' label and icon lookup) only searched `NAV_PAGES`. A remembered "Connected banks" would therefore match `/accounts` and show as "Connected banks · Accounts" with the Landmark icon.
- **Fix:** `pageFor` searches `ALL_PAGES = [...NAV_PAGES, ...PALETTE_PAGES]`. The new e2e test asserts each recent's exact accessible name.
- **Files modified:** `client/src/components/layout/CommandPalette.tsx` (already in the plan's file list)
- **Commit:** `4555726`

**Process notes:**
- Task 2: `ConnectedBanks.tsx` (doc comment and the `provider` prop comment) and `NotInDemo.tsx` already had the wording the plan asks for, from earlier waves, so they were left unchanged. `BulkDeleteModal.tsx` and `TransactionDetailPanel.tsx` already read "Accounts → Connected banks → Up", as confirmed.
- Task 2: no existing user-guide test opened the Connecting Up article, so the plan's fallback test "the guide names where bank connections live now (#244)" was added.
- Task 3: the plan's acceptance command `grep -c 'Unlink it first: Accounts → Connected banks → ${feed}'` prints 0 under macOS BSD grep, which reads the `$` as an anchor. `grep -cF` with the same text prints 1. The file is correct; only the gate command's regex is at fault.
- Task 3: one more search of `docs/`, `client/src`, `server/src`, `e2e/tests` and the root `*.md` files turned up no other copy of the old "Settings → Connections" wording.
- Task 2 was committed as `docs(ui)`. It changes the text people read in the in-app guide; the code is untouched.

**Total deviations:** 1 auto-fixed (Rule 1), plus 5 process notes. **Impact:** none beyond the plan's files; no scope creep.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. On the plan's threat register:
- T-01-11: both entries take their paths from `movedSections`, and the browser test opens each one and checks the URL.
- T-01-25: the server diff is exactly one string plus one expectation, and no route, auth, allowlist, policy or MCP file changed.
- T-01-10: the recents storage key and `isRecent` are unchanged.
- T-01-SC: no package was installed or changed.

## User Setup Required

None.

## Next Phase Readiness

- The palette half of E8 is done. The guide-step wording (`guides/pages.ts`, including "Connected banks are on the Accounts page" at line 379) and the docs sweep still belong to their own plans.
- Plan 07's HANDOVER-UI "Traps" note about the stale server string can now say it is fixed (D-09 landed in `dd6fe29`).

---
*Phase: 01-settings-split-and-good-moments*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND on wave-f: 4555726, ce527c9, dd6fe29 (ancestors of HEAD `dd6fe29`; 3 commits after `90af5e4`)
- FOUND: PALETTE_PAGES in navPages.ts (1) and CommandPalette.tsx (3), 0 in Sidebar.tsx
- wave-f holds no `.planning` file
