# Phase 1: Settings split and good moments - Research

**Researched:** 2026-11-14
**Domain:** React 19 + React Router 7 client refactor (route moves, redirects, guide/palette wiring), static SVG, pure-function UI state in a Vite/Vitest/Playwright app
**Confidence:** HIGH (nearly everything was read in the repo this session; no new packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Goal reached: seedling to flower (discussed)
- **D-01:** The plant grows along the goal bar as the goal fills: seed, seedling, bud, then a
  flower at 100%. It sits at the bar's leading edge or end; the bar itself stays as today's
  at-a-glance progress record. This follows the owner's #241 comment.
- **D-02:** Only a goal whose money reaches its target gets the flower, using the existing
  `complete` rule in `client/src/pages/Goals.tsx:92` (`remaining === 0 && targetAmount > 0 &&
  fundingComplete !== false`). A goal marked completed by hand short of its target keeps the stage
  its money has reached.
- **D-03:** Phase 1 ships the stages and the flower as static inline SVG: no new package, no
  animation. "Goal reached" stays as text, so the status never depends on the picture; the SVG is
  decorative (`aria-hidden`) or carries a matching label, not a second announcement.
- **D-04:** The plant honours Safe mode the same way the goal bar does today (it shows progress,
  never an amount), and works in light and dark and at 390 px.

#### Settings split (Claude's discretion, within recorded rules)
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

(The approved `01-UI-SPEC.md` has since settled these discretion areas: `/accounts/connections`,
`/budget/categories`, default tab `accounts`, the `Plant` component and the $0 copy table. Treat
the UI-SPEC as locked, except for the three corrections flagged in "Open Questions" below.)

### Deferred Ideas (OUT OF SCOPE)
- **three.js bloom animation (owner choice, moved to Phase 2):** when a goal is reached, a 1-3 s
  3D bloom plays once per goal, remembered per device. three.js is lazy-loaded through a dynamic
  import into one shared canvas (not one WebGL context per row), with a still fallback for reduced
  motion and no-WebGL. It waits for Phase 2's dependency decision (Wave G decision 1). The SVG stages
  from D-01 stay. Phase 2's roadmap entry does not list it yet; add it there (or as a decimal phase)
  when Phase 2 is planned.
- **Open, not decided here:** whether docs/ui/WAVES.md is deleted when Wave F merges (as it says)
  or kept until Wave G ends (STATE.md blocker). Ask the owner before closing Phase 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVF-01 | From Accounts, open Connected banks and reach Up in fewer than three clicks | New lazy route `/accounts/connections` (static segment beats `/accounts/:id`, verified with react-router 7.18.4 `matchRoutes`); Accounts header `ButtonLink`; seven link sites listed in "Link and text inventory"; optional `?provider=` deep link (Open Question 2) |
| WAVF-02 | Manage categories from Budget, not Settings | New lazy route `/budget/categories` mounting `CategoryManager` unchanged; two entry points in `Budget.tsx` header/menu only; `data-guide` marker clash to avoid (Pitfall 3) |
| WAVF-03 | Settings shows only remaining tabs; every old way in lands | `tabs` array at `Settings.tsx:29-45`, default at `:56`; `<Navigate replace>` after hooks; palette-only page list next to `NAV_PAGES`; guide steps `pages.ts:32-36`, `:369-393`; full e2e inventory (18 call sites in 13 specs) |
| WAVF-04 | Reached goal shows a plant flower (light, dark, 390 px, Safe mode) | `progressOf` and `complete` at `Goals.tsx:32-37`, `:92`; bar markup `:229-235`; demo "New laptop" is a manual goal at 130 000 of 130 000 (`demoBudget.ts:1466-1469`); Safe mode hides the whole list (`Goals.tsx:441-444`); Tailwind 4 `fill-*`/`stroke-*` read `--color-*`, which `.dark` redefines |
| WAVF-05 | $0 acknowledgement, never "Fully budgeted" with caveats | `getHeroStyle` at `BudgetSummaryWidget.tsx:63-77`, hero/todo at `:186-206`; `unresolvedReason` at `fundingStatus.ts:19-34` refactored to one `unresolvedCauses` list; server `resolved` definition at `budgetService.ts:262-269`; loading-state flash (Pitfall 5) |
</phase_requirements>

## Summary

**The most important finding is not in the code: an open PR already implements Wave F differently.**
PR #273 (`feat(ui): Wave F: settings split, sprout delight (#244, #241)`, branch `wave-f`, worktree
`/Users/tristanvanrooyen/wt-f`, head `1627cae`, opened 13 Nov 2026, CI green, prepares
`0.2.0-up.174`) has one unresolved Codex P1 finding. It contradicts at least six locked decisions
from the 14 Nov CONTEXT/UI-SPEC: Connected banks is a section at the foot of `/accounts`
(`/accounts?banks=up`), not a sub-page; categories are `/budget?view=categories`, a view inside
`Budget.tsx` (+81/-28 lines); Settings opens on Preferences, not Accounts; "Fully budgeted" stays with a
sprout tick beside it; and it adds CSS keyframe animations and a `localStorage` bloom flag, which
D-03 and the deferral exclude. None of `.planning/` mentions PR #273 [VERIFIED: `gh pr view 273`,
`grep -rn 273 .planning`]. Before any code is written, the planner needs the owner's word that #273
is superseded: close it unmerged and branch fresh from `origin/redesign`. Parts of it can still be
reused: the redirect helper shape (`utils/movedSections.ts`), the e2e re-pointing it worked out, and
its list of doc sites. Building on its branch would mean undoing most of its client changes.

The rest of the phase is a contained client refactor. Two new lazy pages wrap existing panels
(`ConnectedAccounts`, `CategoryManager`). Settings loses two `tabs` entries and gains a synchronous
`<Navigate replace>` for the old `?tab=` values. About nine link sites and roughly a dozen text sites
move to the new paths, which should come from **one constants module**: CLAUDE.md requires that lists
and constants live in one place, and twelve literals would drift. A new `components/ui/Plant.tsx`
draws four static SVG stages, using a pure `plantStage(pct, complete)` function. The $0 label logic
should leave the component as a pure function beside `unresolvedReason`, so that one cause list feeds
both the hero label and the todo line.

Client tests are Vitest 5 in the **node** environment. There are no `.test.tsx` files and no
jsdom or testing-library. Tests are pure `.test.ts` files, and component markup is checked with
`renderToStaticMarkup(createElement(...))` (`components/ui/EmptyState.test.ts`). So every new rule
(plant stage, $0 label, redirect target) must be a pure exported function to get a fast failing test.
Browser behaviour is covered by Playwright 1.64 with a single worker across the desktop, phone, demo and
server-mode projects. CI runs all of them in four shards.

**Primary recommendation:** Get the owner to retire PR #273 first. Then build one PR from a fresh
branch off `origin/redesign` in this order: (1) a `utils/movedSections.ts` constants module and pure
helpers with unit tests; (2) the two pages, routes, Settings redirect and link sweep, with the e2e
re-pointing; (3) `Plant` plus `plantStage` and the Goals row; (4) the `unresolvedCauses` /
`readyToAssignStatus` refactor and the $0 copy; (5) docs, guides, MAP/HANDOVER-UI, release prep.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| New routes `/accounts/connections`, `/budget/categories` | Browser / Client (React Router, `App.tsx`) | — | Hash/browser router; no server route (owner rule) |
| `?tab=connections/categories` redirect | Browser / Client (`Settings.tsx`) | — | Synchronous `<Navigate replace>`; no fetch |
| Bank connection setup and sync | API / Backend (existing `/api/up`, `/api/plaid`, …) | Client panel `ConnectedAccounts` | Panel moves unchanged; server untouched |
| Category CRUD and reorder | API / Backend (existing category routes) | Client panel `CategoryManager` | Panel moves unchanged |
| Goal stage (`plantStage`) | Browser / Client (pure function) | — | Derived from goal fields already fetched; no amount displayed |
| $0 label and caveat causes | Browser / Client (pure function over `BudgetSummary`) | API computes `resolved`, `overspent`, `uncategorized`, `complete` | Client only names causes; figures come from `budgetService.ts` |
| Guide progress / tip ids | API / Backend (stored per person) | Client data `guides/*.ts` | Ids must not change; only text, routes and `version` |
| Palette recents | Browser / Client (`localStorage`, `utils/paletteRecents.ts`) | — | Stored old paths must still resolve (redirect covers them) |

## Project Constraints (from CLAUDE.md)

- Client: `client/src/`. UI work reads `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md` and the MAP.md screen row, not HANDOVER.md history.
- Verification: `npm test --prefix client`; `npm run build --prefix client`; `cd e2e && npm test -- --project=desktop tests/<spec>`; set `E2E_CHROMIUM_PATH` if the installed Chromium is not the build Playwright wants; lint `cd lint && npm ci && npm test && npm run lint`; Prettier on changed files.
- Lockfiles and `.npmrc` with install scripts disabled: do not weaken. No new package this phase.
- Feature branch and PR with explicit `--repo tvrooi/Allotment`; conventional commits; a brief test result in the PR.
- App change: `npm run release:prepare -- <next-version>` plus a CHANGELOG.md entry in the feature PR.
- Review guidelines: one implementation per behaviour (reuse `unresolvedReason`, do not copy its checks); a change removes what it replaces (no dead `CategoryManager`/`ConnectedAccounts` imports in Settings, no stale guide text); constants in one place (route strings); docs move with code (MAP.md, HANDOVER-UI.md, user guide, READMEs); new client pages are `lazy()` in `App.tsx`; new features appear in the demo budget leanly; the lint warning cap does not rise; every fix has a test that fails without it; no skipped or loosened tests and no sleeps; e2e selects by role or label.
- Client rules: interactive controls have accessible names; layouts hold at 390 px with no sideways scroll; demo and offline modes keep working; displayed dates go through `utils/dates.ts`.
- Stored identifiers keep `flybudget` (for example localStorage keys); user-visible text says Allotment.
- Tokens only from `client/src/index.css` `@theme`; never inline hex (docs/ui/README.md).
- Keep AGENTS.md and CLAUDE.md byte-identical (only relevant if a rule changes; none expected).

## Standard Stack

No package is added. Everything uses what is installed [VERIFIED: `client/package-lock.json`].

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.0 | Pages, `renderToStaticMarkup` in tests | Existing |
| react-router-dom | 7.18.4 | `Route`, `Navigate replace`, `useSearchParams`, `NavLink` | Existing; ranking verified below |
| tailwindcss | 4.3.3 | `fill-*` / `stroke-*` colour utilities from `@theme` `--color-*` | Existing; v4 maps `fill-<name>` to `var(--color-<name>)` [CITED: tailwindcss.com/docs/fill] |
| lucide-react | ^1.55.0 | `Link2`, `Layers` icons (already used in Settings.tsx:3,8) | Existing |
| vitest | 5.0.4 | Unit tests (node env, `.test.ts`) | Existing |
| @playwright/test | 1.64.0 | e2e (`e2e/package.json`) | Existing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sub-page routes | In-page section/view (PR #273's approach) | Rejected by UI-SPEC: grows `Budget.tsx`, and an in-page section remounted the Connect dialog and loop-loaded on account failure (both bugs reported in #273's body) |
| Redirect in `Settings.tsx` | A wrapper route element in `App.tsx` | Settings already parses `?tab=`; keeping the redirect there keeps one owner of tab parsing |

**Installation:** none. A fresh worktree needs `npm ci` in root, `client/`, `server/`, `e2e/` (and `lint/` for lint).

## Package Legitimacy Audit

No external packages are installed by this phase. The gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 old bookmark / palette recent / external doc link
   /settings?tab=connections ──┐          /settings?tab=categories ──┐
                               v                                     v
                     Settings.tsx: hooks run, then movedSettingsTab(tab)
                               │  match? ── yes ──> <Navigate to=NEW?other-params replace/>
                               │  no
                               v
                     8 remaining tabs (default 'accounts')

 in-app entry points (one constants module feeds all)
   Accounts header "Connected banks" ─┐
   Accounts empty "Connect a bank" ───┤
   BankSyncPill (Up pill, StatusStrip)┤──> /accounts/connections[?provider=..] ──> AccountConnections page
   GettingStarted / TransactionTable /│        PageHeader(breadcrumb Accounts) + ConnectedAccounts
   BankBalanceHint / Resilience /     │        (provider toggle → Up panel = click 2)
   Housekeeping:55 / palette page ────┘
   guides/pages.ts "Connect Up" step ─┘

   Budget header "Categories" (>=768px) ┐
   Budget phone menu "Categories" ──────┤──> /budget/categories ──> BudgetCategories page
   Budget empty table link ─────────────┤        PageHeader(breadcrumb Budget) + CategoryManager
   Housekeeping:92 / palette page ──────┘

 Goals list ── progressOf(goal).pct + complete rule ──> plantStage() ──> <Plant stage/> beside bar
                                                    (Safe mode: whole list replaced by SafeModeNotice)

 GET budget summary (server) ──> BudgetSummary{toBeBudgeted, resolved, complete, accountIssues,
                                               overspent, uncategorized, paymentShortfall, ...}
     └──> unresolvedCauses(f) ──┬─> unresolvedReason(f)  (todo line "Resolve … ." + Review link)
                                └─> readyToAssignStatus(...) (hero bg/text/label/figure colour/glyph)
```

### Recommended Project Structure (new and touched files)
```
client/src/
├── utils/movedSections.ts          # NEW: CONNECTED_BANKS_PATH, CATEGORIES_PATH, connectedBanksLink(provider?), movedSettingsTab()
├── utils/movedSections.test.ts     # NEW
├── utils/fundingStatus.ts          # EXTEND: unresolvedCauses(), readyToAssignStatus() (or components/budget/readyHero.ts)
├── utils/fundingStatus.test.ts     # EXTEND
├── components/ui/Plant.tsx         # NEW: Plant + plantStage + PlantStage type
├── components/ui/Plant.test.ts     # NEW (renderToStaticMarkup + plantStage table)
├── pages/AccountConnections.tsx    # NEW lazy page
├── pages/BudgetCategories.tsx      # NEW lazy page
├── components/layout/navPages.ts   # ADD: PALETTE_PAGES (palette-only), beside NAV_PAGES
├── components/layout/CommandPalette.tsx  # map PALETTE_PAGES into 'pages' group
├── pages/Settings.tsx, App.tsx, Accounts.tsx, Budget.tsx (entry points only), Goals.tsx
└── components/budget/BudgetSummaryWidget.tsx, settings/ConnectedAccounts.tsx (drop h2+intro)
```

### Pattern 1: One module for the moved locations (CLAUDE.md "lists and constants live in one place")
**What:** Every producer (links, palette, guides, redirect, App routes) imports the paths.
**Example** (shape adapted from PR #273's `utils/movedSections.ts`, paths per UI-SPEC):
```typescript
// client/src/utils/movedSections.ts
export const CONNECTED_BANKS_PATH = '/accounts/connections';
export const CATEGORIES_PATH = '/budget/categories';

const MOVED_SETTINGS_TABS: Readonly<Record<string, string>> = {
  connections: CONNECTED_BANKS_PATH,
  categories: CATEGORIES_PATH,
};

/** Where an old Settings ?tab= now lives, with the other query parameters kept; null if still a tab */
export function movedSettingsTab(params: URLSearchParams): string | null {
  const tab = params.get('tab');
  if (!tab || !Object.hasOwn(MOVED_SETTINGS_TABS, tab)) return null;
  const rest = new URLSearchParams(params);
  rest.delete('tab');
  const query = rest.toString();
  return query ? `${MOVED_SETTINGS_TABS[tab]}?${query}` : MOVED_SETTINGS_TABS[tab];
}
```
`guides/pages.ts` is plain data and can import the constant too (it is `.ts`, and `guides.test.ts`
only checks `data-guide` markers).

### Pattern 2: Redirect after hooks (rules of hooks are a lint **error**)
```typescript
// Settings.tsx: keep useSearchParams first, then the early return
const [searchParams, setSearchParams] = useSearchParams();
const movedTo = movedSettingsTab(searchParams);
if (movedTo) return <Navigate to={movedTo} replace />;
const tabParam = searchParams.get('tab');
const activeTab: TabId = tabParam && tabIds.has(tabParam) ? (tabParam as TabId) : 'accounts';
```

### Pattern 3: New page frame (UI-SPEC section 1-2)
```tsx
// pages/AccountConnections.tsx (default export, lazy in App.tsx)
export default function AccountConnectionsPage() {
  const scrollMemory = useScrollMemory('accounts-connections');
  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        breadcrumbs={[{ label: 'Accounts', to: '/accounts' }, { label: 'Connected banks' }]}
        title="Connected banks"
        subtitle="Automatically import transactions from your financial institutions. Any other bank: import its CSV files from the account's page."
      />
      <div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
        <div className="max-w-2xl"><ConnectedAccounts /></div>
      </div>
    </div>
  );
}
```
`PageHeader` (components/ui/PageHeader.tsx) already takes `breadcrumbs`, `title` and `subtitle`. Its
breadcrumb `<nav>` has no `aria-label` and no phone hit-area padding. UI-SPEC asks for
`max-md:py-4 max-md:-my-4` on crumb links. That edit lands in a shared component used by
`ReportWidgetView.tsx` and `Files.tsx`, so check those two pages at 390 px as well. Adding
`aria-label="Breadcrumb"` is a cheap a11y win [VERIFIED: PageHeader.tsx read].

### Pattern 4: Pure, testable view state
`getHeroStyle` (BudgetSummaryWidget.tsx:63-77) and the `hero`/`todo` block (`:186-206`) are
module-private. Move the decision into a pure exported function that returns
`{ bg, text, label, figureClass, glyph }`. Test it in `fundingStatus.test.ts`. The component then only
renders. The same applies to `plantStage`.

### Anti-Patterns to Avoid
- **A second copy of the caveat checks** in the widget: build both strings from `unresolvedCauses`.
- **Adding the new pages to `NAV_PAGES`**: that adds sidebar rows (`navPages.ts:27-28`: "the sidebar (Sidebar.tsx) and the search palette (CommandPalette.tsx) both list these, so a page added here appears in both").
- **Mounting `CategoryManager` inside `Budget.tsx`** (PR #273 did; UI-SPEC forbids).
- **Hard-coded `'/accounts/connections'` literals** across nine files.
- **Animation, `transition` or keyframes on the plant or hero** (D-03; deferred to Phase 2).

## Link and text inventory (every site, read or grepped this session)

### Link producers (code edits; point at the constants)
| File:line | Today | New |
|-----------|-------|-----|
| `pages/Accounts.tsx:225` | `<ButtonLink variant="secondary" to="/settings?tab=connections">` (empty state "Connect a bank") | `CONNECTED_BANKS_PATH` |
| `pages/Accounts.tsx:199-207` | header: `flex items-center justify-between`; only "Add account" `Button` `data-guide="accounts.add"` | add `ButtonLink` "Connected banks" (`Link2`, `data-guide="accounts.connections"`) left of Add account; row becomes `flex flex-wrap … gap-x-4 gap-y-2` |
| `components/dashboard/GettingStarted.tsx:86` | `{ label: 'Connect a bank', to: '/settings?tab=connections' }` | constant |
| `components/transactions/TransactionTable.tsx:531` | `<ButtonLink variant="secondary" to="/settings?tab=connections">` | constant |
| `components/accounts/BankBalanceHint.tsx:21` | `<Link to="/settings?tab=connections" …>missing round-ups</Link>` (Up-specific) | constant (with `provider=up` if Open Question 2 is accepted) |
| `components/up/UpSyncBadge.tsx:10` | `<StatusPill to="/settings?tab=connections" …>` in `BankSyncPill`, used for **every** provider by `StatusStrip.tsx:65` | constant (provider from `feed.provider` if accepted) |
| `components/review/Resilience.tsx:281` | `<Link to="/settings?tab=connections" …>` "Bank changes to review" | constant |
| `components/review/Housekeeping.tsx:55` | `<Link to="/settings?tab=connections" …>Check round-ups in Up settings</Link>` | constant (Up) |
| `components/review/Housekeeping.tsx:92` | `<Link to="/settings?tab=categories" …>Hide unused categories</Link>` | `CATEGORIES_PATH` |
| `pages/Budget.tsx:1436-1442` | "No categories yet. Add some in Settings" → `/settings?tab=categories` | "No categories yet." + "Set up your categories" → `CATEGORIES_PATH` |
| `pages/Budget.tsx:1023-1028` | `AssignMenu` (desktop only, inside `!isPhone`) | `ButtonLink` "Categories" (`Layers`) right after it |
| `pages/Budget.tsx:1076-1082` | phone menu first item `Link role="menuitem"` "Year" | second item "Categories", same classes |
| `components/layout/CommandPalette.tsx:115-139` | pages from `NAV_PAGES` only | also map a palette-only `PALETTE_PAGES` (Connected banks `Link2`, Categories `Layers`) with `id: \`page:${path}\``, `remember: true` |

No other `?tab=connections` or `?tab=categories` producer exists in `client/src`. The sidebar has no
link to either tab (only `/settings` and `MORE_FEATURES_LINK` → `?tab=preferences`). Welcome
(`pages/Welcome.tsx`) opens connect modals directly and never links to Settings. So the "sidebar and
Welcome entries" in WAVF-03 need no edit beyond the `NavLink` prefix match (Accounts and Budget stay
active on the sub-pages, because `NavLink` defaults to `end=false`) [VERIFIED: grep of `/settings` across client/src; Sidebar.tsx, PhoneTabBar.tsx read].

### User-visible text naming the old places (copy edits)
| File:line | Text today |
|-----------|-----------|
| `guides/pages.ts:11` | accounts summary (unchanged; no Settings mention) |
| `guides/pages.ts:32-36` | step "Bring in transactions automatically": "Connect Up under Settings → Connected banks …", `route: '/accounts'`, no target |
| `guides/pages.ts:373` | `summary: 'Categories, connecting Up, backups and preferences.'` |
| `guides/pages.ts:376-381` | "Everything in tabs": "Categories, account order, … connected banks, …", `target: 'settings.tabs'` |
| `guides/pages.ts:382-386` | "Connect Up": "Under Connected banks, connect Up …", `route: '/settings'` |
| `userGuide/articles.tsx:136-137` | "**Sync Now** in Settings → Connected banks" (**missed by UI-SPEC**) |
| `userGuide/articles.tsx:179` | "open Settings → Connected banks → **Enable Banking**" |
| `userGuide/articles.tsx:237-238` | "Settings → Connected banks says when it ends" (**missed by UI-SPEC**) |
| `userGuide/articles.tsx:391` | "(**Settings → Categories → Edit**)" |
| `components/transactions/BulkDeleteModal.tsx:86-87` | "… Up review, Settings → Connected Banks → Up)" (**missed by UI-SPEC**) |
| `components/transactions/TransactionDetailPanel.tsx:677` | "… Up review (Settings → Connected banks → Up) can restore it." |
| Comments: `UpSyncBadge.tsx:7`, `UnusedCategories.tsx:7`, `RentOrOwn.tsx:33`, `NotInDemo.tsx` doc comment | name new locations |
| `server/src/services/accountDeletion.ts:83` | `` `${name} is linked to ${feed}. Unlink it first: Settings → Connections → ${feed}, …` `` and its test `server/src/routes/accountDeletion.test.ts:113`, plus e2e `cleanup.spec.ts:94` | **server string, already stale ("Connections"); out of scope while the phase is client-only** (Open Question 3) |

`UpConnectModal.tsx:445` ("Retry using Sync Now in Connected banks.") is still accurate; leave it.

### Docs (move with the code)
`UP-SUPPORT.md:11,28,44,65`; `docs/START-HERE.md:70,93`; `docs/RESILIENCE.md:81`;
`docs/DEVELOPMENT.md:390`; `DESKTOP-SERVER.md:20`; `MAINTENANCE.md:114`;
`homeassistant/DOCS.md:35,41` (**missed by UI-SPEC**; this file ships in the HA add-on, so a docs edit there is harmless and keeps it accurate);
`docs/ui/MAP.md` (rows for `/settings`, `/accounts`, `/budget`, `/goals` plus two new rows; recount `wc -l`);
`docs/ui/HANDOVER-UI.md` (overwrite "Done this session"; remove #241/#244 from "Next up"; add the
stale server string to Traps). **Do not** rewrite historical entries in `CHANGELOG.md`,
`docs/AUDIT-2026-11.md`, `docs/investigations/*` or `docs/ux-ui-evidence/expanded.json` (the README
evidence rule says leave the committed audit evidence as it is). README.md has no match.

### e2e call sites that must change (desktop unless noted)
| Spec:line | Why it breaks | Change |
|-----------|---------------|--------|
| `up.spec.ts:11,55,81,130,187` | open `?tab=connections` | open `/accounts/connections` (redirect still works, but direct is clearer; keep **one** redirect test in settings.spec) |
| `enable-banking.spec.ts:44,152` | same | same |
| `first-import.spec.ts:33,245` | same | same |
| `switchers.spec.ts:223,348` | same | same |
| `menus.spec.ts:85-88` | opens `?tab=categories` for a drag handle **and** checks the Settings `Tags` tab cursor on the same page | split: handle on `/budget/categories`; tab cursor on `/settings` (or a CategoryManager button, as #273 did) |
| `menus.spec.ts:65-79` | wheel-scrolls the Settings tab row at 900 px | still overflows with 8 tabs (#273's CI passed with this test unchanged) — no change expected |
| `settings.spec.ts:13-17` (categories describe, many tests) | opens `/settings` expecting the default Categories tab | open `/budget/categories` |
| `settings.spec.ts` new | — | add: tablist has exactly the 8 tabs, default `accounts` selected; both redirects (heading, other params kept, Back skips old URL) |
| `accessibility.spec.ts:184` | `/settings` then "Edit Parking" (category) | `/budget/categories` |
| `accessibility.spec.ts:70-79` | nameless-controls route list | add both new routes |
| `budget.spec.ts:45,303` | assert `'Fully budgeted'` | new copy ("Every dollar has a job"); add a caveat case (overspend after assigning all) |
| `demo/demo.spec.ts:41-44` | Up strip link `href` `'#/settings?tab=connections'` | `'#/accounts/connections'` (plus `?provider=up` if adopted) |
| `demo/demo.spec.ts:63` | `['/settings', 'Pay']` relies on the Categories default | Settings now opens Accounts (AccountReorder): expect a demo account name such as `'Rainy Day'`; add `['/budget/categories', 'Pay']` and `['/accounts/connections', 'Not available in the demo']` |
| `demo/demo.spec.ts:134-140` | opens `?tab=connections`, then clicks the only `Add account` (sidebar) | open `/accounts/connections`; scope `Add account` to `getByRole('complementary')` as a guard |
| `phone/polish-phone.spec.ts:214` | route list for "tab bars scroll sideways only"; also waits for `main [data-testid="scroll-cue-scroller"], main [role="tablist"]` | provider toggle is `role="group"` + `.scroll-row` (ConnectedAccounts.tsx:115-119), so add `main .scroll-row` to the wait selector and use `/accounts/connections` |
| `phone/polish-phone.spec.ts:231-243` | "later tab" uses `Connected banks` tab | use `Data` (or `Server`) |
| `phone/targets-phone.spec.ts:23-25` | `/settings` category buttons | `/budget/categories`; rename test |
| `phone/page-gutter.spec.ts:30-50` | route list (h1 gutter) | add both new routes (PageHeader uses `PAGE_GUTTER`) |
| `phone/phone.spec.ts:50-61` | sideways-overflow route list | add both new routes |
| `navigation.spec.ts:27-29` | `/settings` stays `#/settings` | unchanged (default tab does not redirect) — keep passing |

Unaffected but run: `cleanup.spec.ts:94` asserts the **server** string "Settings → Connections";
leave it alone unless Open Question 3 is decided.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page header with breadcrumbs | New header markup | `components/ui/PageHeader` | Already has breadcrumbs/title/subtitle and `PAGE_GUTTER` |
| Scroll position on Back | Custom scroll restore | `useScrollMemory(name)` | Trap in HANDOVER-UI: a page-level scroll container must use it |
| Tab row | New tablist | Existing Settings `ScrollCue` + `tabList` | Unchanged pattern |
| Caveat detection | New checks in the widget | `unresolvedCauses` extracted from `unresolvedReason` | One implementation per behaviour |
| SVG colours | Inline hex, new tokens | Tailwind `fill-positive`, `fill-brand-500`, `fill-brand-700`, `fill-text-tertiary`, `stroke-border`, `stroke-positive` | `.dark` redefines `--color-*` (index.css:171+), so utilities flip |
| Old-term guard | Ad-hoc grep in CI | Add `[/Fully budgeted/, 'Every dollar has a job']` to `RETIRED` in `lint/terms/terms.test.js` | Existing node test scans client/src and server/src code minus comments; it backstops UI-SPEC's "grep is empty" item |
| Query-param dialog opening | New effect | `hooks/useOpenFromLink` if a param should be consumed once | Existing pattern (drops the param with `replace`) |

**Key insight:** the risk here is drift, not difficulty. About 30 sites name the old places, so
every one of them should read from one module or one copy table.

## Runtime State Inventory

The phase moves sections, so it is partly a relocation. Some state outside git still names the old places.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Guide progress is stored server-side per person by guide/tip **id** (`guides/types.ts`: "Stored in each person's progress: never rename one"). Ids `accounts`, `settings`, and all tip ids are unchanged | None for ids. Raising `settingsGuide.version` (and possibly `accountsGuide.version`) offers "Updated guide" (Open Question 4) |
| Stored data | Palette recents in `localStorage` (`utils/paletteRecents.ts`) may hold `/settings?tab=connections` or `?tab=categories` | None: the redirect resolves them. Do not rename the storage key |
| Live service config | None. No server config names the tabs (grep of `server/src/browser`, `client/src/demo`: no `tab=` references) | None |
| OS-registered state | None. Desktop/HA register no tab URLs | None — verified by grep |
| Secrets/env vars | None | None |
| Build artifacts | `docs/ux-ui-evidence/expanded.json` holds old URLs (historical audit evidence) | Leave as is (docs/ui/README.md evidence rule) |
| External text | Server message `accountDeletion.ts:83` "Settings → Connections → {feed}" | Not editable in a client-only phase (Open Question 3) |

## Common Pitfalls

### Pitfall 1: Building on (or colliding with) PR #273
**What goes wrong:** Two Wave F implementations, both claiming `0.2.0-up.174` and the same files.
**Why it happens:** `.planning/` was written without knowledge of PR #273.
**How to avoid:** Owner checkpoint first: close #273 unmerged, remove the `/Users/tristanvanrooyen/wt-f` worktree after salvaging, and branch fresh from `origin/redesign`.
**Warning signs:** `git log` shows `wave-f` commits; CHANGELOG already has an up.174 entry.

### Pitfall 2: The Codex P1 on #273 applies to the sibling path here too
**What goes wrong:** `BankSyncPill` serves every provider (`StatusStrip.tsx:38-41` builds feeds for `'Up'`, `'Plaid'`, `'SimpleFIN'`, `'Enable Banking'`), but every pill links to one destination. Codex flagged a Plaid pill opening Up. Here, all pills (Up included) open the page on its default provider, `'plaid'` (`ConnectedAccounts.tsx:87`: `useState<Provider>('plaid')`).
**How to avoid:** Accept an allowlisted `?provider=` (values from `ConnectedAccounts.tsx:29`: `type Provider = 'plaid' | 'simplefin' | 'enablebanking' | 'up';`). Map `feed.provider` labels to those ids, and pass `up` from the Up-specific links (BankBalanceHint, Housekeeping:55). Initialise the toggle from it. An unknown value falls back to the current default (Open Question 2).

### Pitfall 3: `data-guide="budget.categories"` already exists
**What goes wrong:** UI-SPEC gives the new Budget header link `data-guide="budget.categories"`. That marker already sits on the envelope list (`Budget.tsx:1223`). The budget guide (`guides/budget.ts:22`) and the welcome tour (`guides/welcome.ts:48`) target `['budget.columns', 'budget.expenses', 'budget.categories']`, and `GuideTour.findTarget` takes "the first shown element" among duplicates.
**How to avoid:** Give the link a distinct marker (for example `budget.manage-categories`) or none. No guide step targets it. `accounts.connections` is new and free (grep: no existing use). The guide step that targets it makes `guides.test.ts` require the marker in a `.tsx` source.

### Pitfall 4: `/accounts/connections` inside `/accounts/:id` matchers
**What goes wrong:** Code that matches `/accounts/:id/*` would read `id = 'connections'`.
**Found:** `AddTransactionModal.tsx:57` `useMatch('/accounts/:id/*')?.params.id`. It is harmless because `defaultAddAccount` keeps only ids of open accounts (`utils/addTransaction.ts:15-17`). Route ranking works regardless of order: `matchRoutes` with react-router 7.18.4 sends `/accounts/connections` to the static route and `/accounts/abc` to `/accounts/:id` [VERIFIED: script run this session against `wt-f/client/node_modules/react-router` 7.18.4, same version as `client/package-lock.json`]. Still declare it before `/accounts/:id` for readability.

### Pitfall 5: The $0 praise shows while the summary is unknown
**What goes wrong:** `Budget.tsx:904` `const tbb = summary?.toBeBudgeted ?? 0;` and `:934` passes `funding={summary}`. While the summary loads or has failed, the widget gets `tbb = 0` and `funding = undefined`. `hasMoney` is then `!funding` → true (`BudgetSummaryWidget.tsx:200`), so today it shows "Fully budgeted". Under UI-SPEC's "funding resolved (or absent)" rule it would show "Every dollar has a job", which is praise with no data behind it.
**How to avoid:** Require `funding` present and `funding.resolved === true` for the clean label. With `funding` absent, show no status label, or keep a neutral one (Open Question 1). Add a unit test for `funding: undefined`.

### Pitfall 6: The $0 figure is green today
**What goes wrong:** `readyAmount` renders with `hero.text` (`BudgetSummaryWidget.tsx:291-292`, `:312-314`), which is `text-positive` at $0. GLOSSARY.md:60-61: "When something is zero, say so plainly and leave it in the normal text colour."
**How to avoid:** Return a separate `figureClass` (`text-text` whenever `tbb === 0`, the "Nothing to assign yet" case included) and keep the heading `text-positive` while the figure holds.

### Pitfall 7: Lint cap is 128, not 135
**What goes wrong:** REQUIREMENTS.md and STATE.md say 135, but `lint/package.json:8` has `--max-warnings=128` (lowered in Wave E, `f279cb6`). #273 reported 128 warnings, so there is no headroom. Any new jsx-a11y or hook-deps warning fails lint.
**How to avoid:** Run `cd lint && npm ci && npm run lint` before the PR. Fix new warnings; never raise the cap.

### Pitfall 8: Node version
**What goes wrong:** WAVES.md says "use Node 24 (`PATH=/usr/local/bin:$PATH`)", but `/usr/local/bin/node` and the nvm default are v22.19.0 on this machine. Node 24.10.0 is at `/opt/homebrew/opt/node@24/bin/node`. #273 ran its checks on 22.19.
**How to avoid:** `export PATH=/opt/homebrew/opt/node@24/bin:$PATH` in every executor shell; check `node --version` prints v24.

### Pitfall 9: Settings default-tab assumptions hidden in tests
Several specs open bare `/settings` and expect categories (settings.spec categories describe,
accessibility:184, targets-phone:25, demo:63). See the e2e table. Specs that click a named tab first
(Preferences, Data) keep working.

### Pitfall 10: Hook order in Settings
An early `return <Navigate/>` placed before `useSearchParams` would break the rules of hooks
(a lint **error**). Keep the redirect after all hooks (Pattern 2).

### Pitfall 11: ConnectedAccounts has two intro blocks
The demo variant (`ConnectedAccounts.tsx:42-47`) and the real one (`:105-112`) each have the
`h2` "Connected banks" and an intro `<p>`. Remove **both** (UI-SPEC). The demo intro lacks the CSV
sentence, but the page subtitle carries the full one, which is true in the demo too.

## Code Examples

### `unresolvedCauses` — one list, two consumers
Source of truth today [VERIFIED: client/src/utils/fundingStatus.ts:19-34]:
```typescript
export function unresolvedReason(f: Funding): string {
  if (f.accountIssues?.length) return 'Reconcile account balances before assigning money';
  if (f.complete === false) return 'Incomplete: missing exchange rates';
  const causes: string[] = [];
  if (f.overspent > 0) causes.push('overspent envelopes');
  if (f.uncategorized > 0) causes.push('uncategorised spending');
  if ((f.paymentShortfall ?? 0) > 0 || (f.uncoveredCardPayments ?? 0) > 0)
    causes.push('card payments without funding');
  if (f.toBeBudgeted < 0) causes.push('more assigned than you have');
  if (!causes.length) return 'Check the Review page';
  ...
  return `Resolve ${list}`;
}
```
Recommended refactor (existing `unresolvedReason` tests must still pass unchanged):
```typescript
export type UnresolvedCause = 'overspent' | 'uncategorised' | 'card-payments' | 'over-assigned';
const CAUSE_WORDS: Record<UnresolvedCause, string> = {
  overspent: 'overspent envelopes',
  uncategorised: 'uncategorised spending',
  'card-payments': 'card payments without funding',
  'over-assigned': 'more assigned than you have',
};
export function unresolvedCauses(f: Funding): UnresolvedCause[] {
  const causes: UnresolvedCause[] = [];
  if (f.overspent > 0) causes.push('overspent');
  if (f.uncategorized > 0) causes.push('uncategorised');
  if ((f.paymentShortfall ?? 0) > 0 || (f.uncoveredCardPayments ?? 0) > 0) causes.push('card-payments');
  if (f.toBeBudgeted < 0) causes.push('over-assigned');
  return causes;
}
// unresolvedReason keeps its first two early returns, then maps unresolvedCauses(f) through CAUSE_WORDS.
// The $0 caveat label (UI-SPEC copy table) maps the same list:
//   ['overspent'] -> 'All assigned, but envelopes are overspent'
//   ['uncategorised'] -> 'All assigned, but some spending has no category'
//   ['card-payments'] -> 'All assigned, but card payments need funding'
//   n >= 2 -> `All assigned, with ${n} things to resolve`
//   [] (resolved false for another reason, e.g. a pool below zero) -> 'All assigned, with items to review'
```
Why the empty case exists: the server's `resolved` (budgetService.ts:262-269) also needs
`pools.every((p) => p.readyToAssign >= 0)`, which `unresolvedReason` does not name. Verbatim:
```
resolved:
  complete &&
  accountIssues.length === 0 &&
  uncategorized === 0 &&
  overspent === 0 &&
  unassigned >= 0 &&
  pools.every((p) => p.readyToAssign >= 0) &&
  card.positions.every((p) => p.shortfall === 0 && p.uncoveredPayments === 0),
```

### Today's hero branch to replace [VERIFIED: BudgetSummaryWidget.tsx:63-77]
```typescript
function getHeroStyle(tbb: number, incomePlanned: number, hasMoney: boolean) {
  if (tbb === 0 && !hasMoney)
    return { bg: 'bg-surface-alt', text: 'text-text-secondary', label: 'Nothing to assign yet' };
  if (tbb < 0)
    return { bg: 'bg-negative-subtle', text: 'text-negative', label: 'Assigned more than you have' };
  if (tbb === 0)
    return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Fully budgeted' };
  const threshold = Math.max(incomePlanned * 0.02, 500);
  if (tbb <= threshold)
    return { bg: 'bg-caution-subtle', text: 'text-caution', label: 'Almost budgeted' };
  return { bg: 'bg-positive-subtle', text: 'text-positive', label: 'Give every dollar a job' };
}
```
The doubtful branch (`:186-196`) stays: `accountIssues` → caution + `unresolvedReason` ("Reconcile account balances…"), and
`complete === false` → "Incomplete: missing exchange rates". The todo line (`:203-206`) stays.

### Plant stage function (UI-SPEC stage table)
`progressOf` and `complete` today [VERIFIED: Goals.tsx:32-37, :92]:
```typescript
function progressOf(goal: Goal) {
  const pct =
    goal.targetAmount > 0
      ? Math.min(100, (Math.max(0, amountOf(goal)) / goal.targetAmount) * 100)
      : 0;
  return { pct, remaining: Math.max(0, goal.targetAmount - amountOf(goal)) };
}
// :92
const complete = remaining === 0 && goal.targetAmount > 0 && goal.fundingComplete !== false;
```
```typescript
// components/ui/Plant.tsx
export type PlantStage = 'seed' | 'seedling' | 'bud' | 'flower';
export function plantStage(pct: number, complete: boolean): PlantStage {
  if (complete) return 'flower';
  if (pct >= 66) return 'bud';
  if (pct >= 33) return 'seedling';
  return 'seed';
}
```
Brand sprout path [VERIFIED: client/public/logo.svg]:
`<path d="M20 51V27C8 28 2 20 2 9c12-1 18 5 18 14C20 14 26 8 38 9c0 11-6 19-18 18" fill="#1B7550"/>` and
`<path d="M20 26v25" stroke="#1B7550" stroke-width="5" stroke-linecap="round" fill="none"/>`. In
`Plant`, replace the hex with `className="fill-positive"` / `className="stroke-positive"`. A unit test
should assert that the rendered markup contains no `#[0-9a-f]{3,6}` and contains `aria-hidden="true"`.

### Unit test style that works here (node env, no JSX in .ts)
```typescript
// Source: client/src/components/ui/EmptyState.test.ts pattern
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Plant, plantStage } from './Plant';

describe('plantStage', () => {
  it.each([[0, 'seed'], [32.99, 'seed'], [33, 'seedling'], [65.99, 'seedling'], [66, 'bud'], [100, 'bud']] as const)(
    '%s%% not complete is %s', (pct, stage) => expect(plantStage(pct, false)).toBe(stage));
  it('only complete flowers', () => expect(plantStage(40, true)).toBe('flower'));
});
it('is decorative and uses tokens only', () => {
  const html = renderToStaticMarkup(createElement(Plant, { stage: 'flower' }));
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
});
```
Components that use `Link`, `useIsPhone` (needs `window.matchMedia`) or query hooks cannot be rendered
this way without a router and a `window`. Test their logic through the extracted pure functions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ten Settings tabs, default Categories | Eight tabs, default Accounts; sections under their pages | This phase | Old `?tab=` URLs redirect |
| "Fully budgeted" at $0 (green figure) | "Every dollar has a job" or a named caveat; $0 figure in normal colour | This phase | e2e `budget.spec.ts:45,303` change |
| PR #273 in-page section + animations | Sub-pages + static SVG (UI-SPEC) | 14 Nov decisions | #273 superseded (owner to confirm) |

**Deprecated/outdated:** WAVES.md's Node path tip (`/usr/local/bin`) and REQUIREMENTS/STATE lint cap 135.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The owner wants PR #273 closed unmerged in favour of the 14 Nov CONTEXT/UI-SPEC design | Summary, Pitfall 1 | Wasted plan, or two conflicting PRs for up.174 |
| A2 | A `?provider=` deep link is in scope (a second small edit to `ConnectedAccounts`) | Pitfall 2 | Without it, Codex likely raises the #273 P1 again for Up/Plaid pills |
| A3 | Bumping `settingsGuide.version` to 2 (and `accountsGuide.version` to 2) is desired, so people are offered the changed steps; ids unchanged | Runtime State | Extra "Updated guide" banner, or people never learn Connect Up moved |
| A4 | The full desktop e2e project takes roughly 20-40 min locally, with one worker (464 tests per #273's run) | Validation | Mis-sized checkpoints |
| A5 | The installed Chromium build matches what Playwright 1.64 wants; otherwise set `E2E_CHROMIUM_PATH` | Environment | First e2e run fails to launch |
| A6 | Adding "Fully budgeted" to `lint/terms` RETIRED is acceptable (it is a wording guard, not a GLOSSARY term) | Don't Hand-Roll | Could be seen as scope creep; the alternative is a client unit test that globs sources |

## Open Questions

1. **Clean $0 label when the summary is absent (UI-SPEC says "resolved (or absent)")**
   - What we know: `tbb` falls back to 0 while the summary loads or fails (Budget.tsx:904), so "absent" means "unknown".
   - Recommendation: show the clean label only when `funding?.resolved === true`, with no label while absent. Record the deviation in the PR body. Low-risk correction to the UI-SPEC.
2. **Provider deep link**
   - What we know: the default provider is Plaid; pills and Up-specific links all open there today, and Codex has already flagged the sibling path.
   - Recommendation: `connectedBanksLink(provider?)` in `movedSections.ts`, with an allowlist `up|plaid|simplefin|enablebanking`, read once to initialise `ConnectedAccounts`' toggle. Click count from the Accounts header stays 2 (or 1 for Up links).
3. **Stale server string "Settings → Connections → Up"** (`accountDeletion.ts:83`, server test `:113`, e2e `cleanup.spec.ts:94`)
   - What we know: it was already wrong ("Connections") and becomes more wrong. The phase is client-only by owner rule.
   - Recommendation: leave it, record it in HANDOVER-UI Traps, and ask the owner whether a message-only server change may ride in this PR (it is not a route, allowlist or MCP change).
4. **Guide versions** — see A3. Recommendation: settings → 2, accounts → 2.
5. **WAVES.md deletion** (deferred in CONTEXT): ask before closing the phase. Wave G is planned from it.
6. **Budget header link `data-guide`**: use `budget.manage-categories` (or none) instead of the UI-SPEC's `budget.categories` (Pitfall 3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | All checks (CI uses `node-version: 24`, ci.yml:32) | ✓ (not default) | 24.10.0 at `/opt/homebrew/opt/node@24/bin` | none needed; default `node` is 22.19.0 — set PATH |
| npm deps in main checkout | tests/build | ✗ (no `node_modules` in root/client/e2e) | — | `npm ci` in root, client, server, e2e, lint (in the worktree) |
| Playwright browsers | e2e | ✓ | `~/Library/Caches/ms-playwright`: chromium-1187, chromium-1248, webkit-2203/2370 | `E2E_CHROMIUM_PATH` |
| gh CLI | PR, closing #273, issues | ✓ | authenticated (PR/issue reads worked) | — |
| e2e fixed ports | e2e | ✓ | `e2e/ports.ts` | only one browser run at a time (do not run two worktrees' e2e together) |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** dependencies need `npm ci` in the new worktree.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.4 (client, node env, `src/**/*.test.ts`); Playwright 1.64.0 (e2e); node:test (lint terms/tokens) |
| Config file | `client/vite.config.ts` (no separate vitest config); `e2e/playwright.config.ts` (projects desktop, phone, iphone-webkit, demo, server-mode, multi-user; `workers: 1`) |
| Quick run command | `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm test --prefix client -- src/utils/fundingStatus.test.ts src/components/ui/Plant.test.ts src/utils/movedSections.test.ts src/utils/guides.test.ts` |
| Full suite command | `npm test --prefix client && npm run build --prefix client && (cd e2e && npx tsc --noEmit && npm test -- --project=desktop && npm test -- --project=phone && npm test -- --project=demo && npm test -- --project=server-mode) && (cd lint && npm ci && npm test && npm run lint)` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVF-01 | `/accounts/connections` renders heading "Connected banks"; Accounts header link reaches it; Up panel after clicking "Up" (2 clicks); empty-state "Connect a bank" opens it | e2e | `cd e2e && npm test -- --project=desktop tests/accounts.spec.ts tests/up.spec.ts` | accounts.spec ✅ (add test) / up.spec ✅ (re-point) |
| WAVF-01 | Link constants and provider allowlist | unit | `npm test --prefix client -- src/utils/movedSections.test.ts` | ❌ Wave 0 |
| WAVF-01 | Phone 390 px: header wraps, no sideways scroll, 44 px targets | e2e phone | `cd e2e && npm test -- --project=phone tests/phone/phone.spec.ts tests/phone/page-gutter.spec.ts tests/phone/polish-phone.spec.ts` | ✅ (add routes) |
| WAVF-02 | `/budget/categories` manages categories (create/edit/reorder/delete) | e2e | `cd e2e && npm test -- --project=desktop tests/settings.spec.ts tests/menus.spec.ts tests/accessibility.spec.ts` | ✅ (re-point) |
| WAVF-02 | Budget header link (desktop) and phone menu item open it | e2e | `cd e2e && npm test -- --project=desktop tests/budget.spec.ts` + `--project=phone tests/phone/targets-phone.spec.ts` | ✅ (add) |
| WAVF-03 | Settings tablist exactly 8 tabs, default Accounts; both redirects keep other params, replace (Back skips) | e2e | `cd e2e && npm test -- --project=desktop tests/settings.spec.ts tests/navigation.spec.ts` | ✅ (add) |
| WAVF-03 | `movedSettingsTab` maps and preserves params | unit | `npm test --prefix client -- src/utils/movedSections.test.ts` | ❌ Wave 0 |
| WAVF-03 | Guide markers exist (`accounts.connections`), ids unchanged | unit | `npm test --prefix client -- src/utils/guides.test.ts` | ✅ (auto-covers new target) |
| WAVF-03 | Palette lists "Connected banks" and "Categories" pages, no new sidebar rows | e2e | `cd e2e && npm test -- --project=desktop tests/command-palette.spec.ts tests/navigation.spec.ts` | ✅ (add one test) |
| WAVF-03 | Demo: Up strip link, `/settings`, new pages | e2e demo | `cd e2e && npm test -- --project=demo tests/demo/demo.spec.ts` | ✅ (update) |
| WAVF-04 | `plantStage` boundaries; Plant aria-hidden, no hex | unit | `npm test --prefix client -- src/components/ui/Plant.test.ts` | ❌ Wave 0 |
| WAVF-04 | Demo "New laptop" row has `goal-plant` `data-stage="flower"` and text "Goal reached" | e2e demo | `cd e2e && npm test -- --project=demo tests/demo/category-goals.spec.ts` | ✅ (add test) |
| WAVF-04 | Safe mode hides plant with the list | e2e | `cd e2e && npm test -- --project=desktop tests/safe-mode.spec.ts` (add a Goals assertion) | ✅ |
| WAVF-04 | Light/dark at 1280/390 | manual + screenshots | `.ui-evidence/2026-11-14-wave-f/` | manual-only (visual) |
| WAVF-05 | Each $0 case → label/colours (clean, each caveat, n≥2, none-named, funding absent, missing rate, account issues, new budget) | unit | `npm test --prefix client -- src/utils/fundingStatus.test.ts` | ✅ (extend) |
| WAVF-05 | "Fully budgeted" never in client/src | unit (lint terms) | `cd lint && npm test` | ✅ (add RETIRED row) |
| WAVF-05 | Browser: $0 clean shows "Every dollar has a job"; overspend after assigning all shows "All assigned, but envelopes are overspent" | e2e | `cd e2e && npm test -- --project=desktop tests/budget.spec.ts` | ✅ (update :45, :303, add) |

### Sampling Rate
- **Per task commit:** the quick unit command, plus the one or two e2e specs the task touched (`--project=desktop tests/<spec>`).
- **Per wave merge:** `npm test --prefix client && npm run build --prefix client` and the touched e2e projects.
- **Phase gate:** the full suite command above (desktop, phone, demo, server-mode, e2e `tsc`, lint). Never `E2E_SKIP_BUILD=1`; run on Node 24.

### Wave 0 Gaps
- [ ] `client/src/utils/movedSections.test.ts`: redirect map, params kept, provider allowlist
- [ ] `client/src/components/ui/Plant.test.ts`: stage table, markup checks
- [ ] Extend `client/src/utils/fundingStatus.test.ts`: `unresolvedCauses` and the $0 status function (each row in UI-SPEC section 5)
- [ ] `lint/terms/terms.test.js`: RETIRED row for "Fully budgeted"
- [ ] e2e additions listed in the e2e table (settings redirects/tablist, accounts link, budget links, demo plant)

## Security Domain

`security_enforcement` is on (ASVS level 1). The phase is client-only routing and presentation.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged (AuthGate) |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | no route, allowlist, token or `/api/assistant/do` change; read-only tokens never reach client routes |
| V5 Input Validation | yes (query params) | `?tab=` resolved against a fixed map; `?provider=` (if added) against a fixed allowlist; never interpolate a param into a path |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect through `?tab=` | Spoofing / Tampering | Redirect targets come only from constants; other params are re-encoded with `URLSearchParams`, never as a path |
| Amount leak in Safe mode | Information disclosure | Plant carries no amount; Goals list already replaced by `SafeModeNotice` under `useHideBalances`; $0 labels contain no figure (figure still via `formatCurrency`) |
| Demo connecting banks | Tampering | `ConnectedAccounts` keeps its `IS_DEMO` branch (`ConnectedAccountsDemo` + `NotInDemo`); demo API still refuses setup (demo.spec.ts) |

## Sources

### Primary (HIGH confidence, read this session)
- `client/src/pages/Settings.tsx:1-149` (tabs `:29-45`, default `:56`, panels `:114-123`)
- `client/src/App.tsx:1-104` (lazy pages, routes `:71-77`, `:90`)
- `client/src/utils/fundingStatus.ts:1-34`, `fundingStatus.test.ts`
- `client/src/components/budget/BudgetSummaryWidget.tsx:1-400`
- `client/src/pages/Goals.tsx:28-45, 60-110, 215-255, 345-360, 436-450`
- `client/src/pages/Accounts.tsx`, `pages/Budget.tsx:1000-1125, 1215-1230, 1425-1450, 904, 925-960`
- `client/src/components/settings/ConnectedAccounts.tsx:1-170`
- `client/src/components/layout/navPages.ts`, `CommandPalette.tsx:40-200`, `utils/commandPalette.ts`
- `client/src/guides/pages.ts`, `guides/types.ts`, `guides/budget.ts`, `components/guide/GuideTour.tsx:30-80`, `utils/guides.ts`, `utils/guides.test.ts`
- `client/src/components/ui/PageHeader.tsx`, `hooks/useScrollMemory.ts`, `components/ui/EmptyState.test.ts`
- `client/public/logo.svg`; `client/src/index.css` `@theme` and `.dark`
- `server/src/services/budgetService.ts:255-270`, `server/src/demo/demoBudget.ts:1466-1474`, `server/src/services/accountDeletion.ts:80-84`
- e2e: `playwright.config.ts`, `fixtures.ts:85-87`, the specs in the e2e table
- `lint/package.json:8`, `lint/README.md`, `lint/terms/terms.test.js`
- `gh pr view 273` (body, files, checks, Codex comment), `gh issue view 241/244`
- react-router 7.18.4 `matchRoutes` run (static vs dynamic segment)

### Secondary (MEDIUM)
- tailwindcss.com/docs/fill — `fill-<color>` maps to `var(--color-*)`, custom `@theme` colours supported (classify-confidence for webfetch returned LOW; cross-checked against the codebase's `.dark` variable override, which is how the flip works)

### Tertiary (LOW)
- e2e runtime estimates (A4)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions from the lockfile
- Architecture: HIGH — every file and line read; route ranking executed
- Pitfalls: HIGH for code-backed items; MEDIUM for the PR #273 disposition (needs the owner)

**Research date:** 2026-11-14
**Valid until:** 2026-11-21 (fast-moving: another wave PR, or a change to PR #273, would shift line numbers and versions)
