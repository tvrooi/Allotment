# Phase 1: Settings split and good moments - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Wave F (#244, #241), one PR to `redesign`, client only, no server change:

1. Connected banks moves from Settings to the Accounts area, and Categories moves to the Budget
   area. Settings keeps the remaining tabs, and every old way in still lands on the moved section
   (WAVF-01 to WAVF-03).
2. Goals show a growing plant that reaches a flower when the goal's money reaches its target
   (WAVF-04), and a $0 Ready to assign gets a brief brand-voice acknowledgement that is never an
   unqualified "Fully budgeted" while caveats remain (WAVF-05).

No money figure, server route or token allowlist changes. The plant's CSS animation is in this
phase (D-03); a three.js version is not.

**Delivery (D-07):** this phase revises the open PR #273 (branch `wave-f`, worktree
`/Users/tristanvanrooyen/wt-f`, base `redesign`), which implemented Wave F on 13 Nov with a
different design. The owner chose on 14 Nov to keep the branch and its tests and change it to the
decisions below, rather than close it or merge it as it is.

</domain>

<decisions>
## Implementation Decisions

### Goal reached: seedling to flower (discussed)
- **D-01:** The plant grows along the goal bar as the goal fills: seed, seedling, bud, then a
  flower at 100%. It sits at the bar's leading edge or end; the bar itself stays as today's
  at-a-glance progress record. This follows the owner's #241 comment.
- **D-02:** Only a goal whose money reaches its target gets the flower, using the existing
  `complete` rule in `client/src/pages/Goals.tsx:92` (`remaining === 0 && targetAmount > 0 &&
  fundingComplete !== false`). A goal marked completed by hand short of its target keeps the stage
  its money has reached.
- **D-03:** Phase 1 ships the stages and the flower as inline SVG with no new package. The
  plant animates with plain CSS only, as PR #273 already does (owner, 14 Nov 2026, after seeing
  #273): it grows in place when its stage changes while the page is open, and the flower blooms
  once per goal per device (`flybudget:goals-bloomed` in localStorage; without storage the plant
  is shown still). Arriving on the page plays nothing else. Every animation token is `none` under
  reduced motion, so the static end state shows. "Goal reached" stays as text, so the status never depends on the picture; the SVG is
  decorative (`aria-hidden`) or carries a matching label, not a second announcement.
- **D-04:** The plant honours Safe mode the same way the goal bar does today (it shows progress,
  never an amount), and works in light and dark and at 390 px.

### Settings split (Claude's discretion, within recorded rules)
- **D-05:** Old links keep working. `/settings?tab=connections` and `/settings?tab=categories`
  redirect (replace, not push) to the new locations. The in-app links are updated to point at the
  new locations directly: `Accounts.tsx:225`, `GettingStarted.tsx:86`, `TransactionTable.tsx:531`,
  `BankBalanceHint.tsx:21`, `UpSyncBadge.tsx:10`, `Resilience.tsx:281`, `Housekeeping.tsx:55` and
  `:92`, `Budget.tsx:1438`, plus the sidebar, palette and Welcome entries. Guide steps in
  `client/src/guides/pages.ts` (including "Connect Up" and the `settings.tabs` overview text) get
  new routes and wording, with guide and tip ids unchanged.
  — **Reversibility:** costly — every link site and the e2e suites that open these tabs depend on
  the new routes.
- **D-06:** Settings no longer shows Connected banks or Categories tabs, and its default tab (today
  `categories`) becomes the first remaining tab.

### Delivery and the revision of PR #273
- **D-07:** Revise PR #273 on `wave-f` in `/Users/tristanvanrooyen/wt-f`; do not open a second
  Wave F branch. Where #273 differs from D-01 to D-08 or the approved UI-SPEC, the UI-SPEC wins:
  separate pages `/accounts/connections` and `/budget/categories` instead of the Accounts section
  and `?view=categories`; Settings defaults to `accounts`, not Preferences; four plant stages per
  the UI-SPEC instead of five; "Fully budgeted" removed. Keep what fits: the CSS animation (D-03),
  its reduced-motion tokens, the one-module redirect helper (`utils/movedSections.ts`) and the e2e
  work, re-pointed. Rerun every check on Node 24 (`/opt/homebrew/opt/node@24/bin`); #273 ran on
  22.19. #273 already takes `0.2.0-up.174`; keep it unless `redesign` moved on.
  — **Reversibility:** costly — the branch's e2e expectations and redirects are rewritten.
- **D-08:** Each bank pill and link opens its own provider: an allowlisted `?provider=` on
  `/accounts/connections` (up, plaid, simplefin, enablebanking), so the Up pill opens Up and a Plaid
  pill opens Plaid. This resolves the open Codex P1 on #273, which applies to this design too.

### Claude's Discretion
- **Where Connected banks lives on Accounts:** a sub-page or section reached from the Accounts
  header (for example `/accounts/connections`) is preferred over a modal, so it has its own URL for
  the redirect and the guide. It must reach the Up connection in fewer than today's three clicks,
  and the empty-accounts "Connect a bank" button must open it. `ConnectedAccounts` moves over as it
  is.
- **Where Categories lives in Budget:** a Budget sub-page (for example `/budget/categories`,
  distinct from the existing `/budget/category/:id`) reached from the Budget header. It must not grow
  `Budget.tsx` (already 1466 lines, a split candidate). `CategoryManager` moves over as it is.
- **$0 Ready to assign moment:** a static brand-voice line (BRAND.md voice, for example "Every
  dollar has a job") whenever Ready to assign is exactly $0 and there is money. It replaces the
  unqualified "Fully budgeted" label in `BudgetSummaryWidget.tsx:73`, which breaks WAVF-05 today:
  when uncategorised spending, overspending or a missing exchange rate remains, the label names the
  caveat instead. The zero figure stays in normal colour (GLOSSARY.md), and Ready to assign stays
  green while its figure holds (critique decision). No animation.
- **Plant drawing:** the look is left to the `/impeccable` plan (owner: "you decide"), within
  docs/BRAND.md (Sprout green `--color-positive`, Marigold, the three-plots-and-sprout mark),
  tokens only, readable in dark mode.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and rules
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, notes (client only; critique decisions)
- `.planning/REQUIREMENTS.md` — WAVF-01 to WAVF-05 and "Done means, for every wave PR"
- `docs/ui/WAVES.md` — Wave F is one PR; owner decisions on record (#244 endorsed)
- GitHub issues #244 (split the ten tabs) and #241 (good moments; owner comment asks for an
  `/impeccable animate` plan with the bar growing from a seedling to a flower)

### UI
- `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md` — UI working guide
- `docs/ui/MAP.md` — rows for `/settings`, `/accounts`, `/budget`, `/goals` (files, hooks, e2e specs)
- `docs/BRAND.md` — mark, colours, voice
- `GLOSSARY.md` — zero amounts in normal colour; Ready to assign wording

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/pages/Settings.tsx`: the ten tabs as a `tabs` array, `?tab=` in the URL, panels
  `CategoryManager` and `ConnectedAccounts` render as they are and can be mounted elsewhere.
- `client/src/components/ui/tabList` (`onTabListKeyDown`, `tabIds`): the shared tab pattern if a
  new page needs tabs.
- `client/src/pages/Goals.tsx:233-240`: today's bar (`bg-positive` when complete) and "Goal
  reached" text.
- `client/src/components/budget/BudgetSummaryWidget.tsx` `getHeroStyle`: the Ready to assign
  labels.

### Established Patterns
- New pages are `lazy()` in `client/src/App.tsx`; e2e selects by role or label.
- Reduced motion is respected (`motion-reduce:` / `prefers-reduced-motion` in `index.css`,
  `GuideTour.tsx`), relevant once the Phase 2 animation lands.
- Remembered UI state lives on the device (the palette's recent destinations).

### Integration Points
- Router (`App.tsx`) for the new sub-routes and the `?tab=` redirects.
- `client/src/guides/pages.ts` (step routes and text), `client/src/utils/commandPalette.ts`, the
  sidebar and Welcome entries.
- e2e specs that open `?tab=connections` / `?tab=categories`: `up`, `menus`, `enable-banking`,
  `switchers`, `first-import`, `phone/polish-phone`, `demo/demo`.

</code_context>

<specifics>
## Specific Ideas

- The owner's picture: the goal bar "progressing from a seedling to a flower" as the goal fills.
- The demo's "New laptop" goal is the reference completed goal for screenshots.

</specifics>

<deferred>
## Deferred Ideas

- **three.js bloom (optional, Phase 2 or later):** the owner first chose a 3D bloom; after seeing
  #273's CSS bloom it was kept for Phase 1 (D-03). A three.js version stays an idea only, to raise
  with Wave G's dependency decision if the owner still wants it. Not on the roadmap.
- **Server message (not client-only):** `accountDeletion.ts:83` still says "Settings → Connections
  → Up". It needs a server change; ask the owner whether to fix it in a later wave.
- **Open, not decided here:** whether docs/ui/WAVES.md is deleted when Wave F merges (as it says)
  or kept until Wave G ends (STATE.md blocker). Ask the owner before closing Phase 1.

</deferred>

---

*Phase: 01-settings-split-and-good-moments*
*Context gathered: 2026-11-14*
