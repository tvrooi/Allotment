# Phase 1: Settings split and good moments - Pattern Map

**Mapped:** 2026-11-14
**Tree mapped:** `/Users/tristanvanrooyen/wt-f` (branch `wave-f`, head `1627cae`, PR #273), compared with `redesign` via `git diff redesign...wave-f` from `/Users/tristanvanrooyen/Github/Allotment`
**Files analyzed:** 30 (code) + e2e and docs sweep
**Analogs found:** 30 / 30 (most are #273's own files, revised)

## Trap before any work: the wt-f worktree's git link is broken

`/Users/tristanvanrooyen/wt-f/.git` contains `gitdir: /Users/tristanvanrooyen/Allotment/.git/worktrees/wt-f`,
a path that no longer exists (the repo is now at `~/Github/Allotment`). Any `git` command inside wt-f fails with
`fatal: not a git repository`. `git worktree list` from the main repo still lists it. The first plan task
must run `git -C /Users/tristanvanrooyen/Github/Allotment worktree repair /Users/tristanvanrooyen/wt-f`
(or edit that `.git` file to point at `/Users/tristanvanrooyen/Github/Allotment/.git/worktrees/wt-f`), then
check `git -C /Users/tristanvanrooyen/wt-f status`.

## File Classification

| File (client/src unless noted) | Role | Data flow | #273 state | Closest analog | Match |
|---|---|---|---|---|---|
| `utils/movedSections.ts` | utility (constants + pure fn) | transform | EXISTS, wrong paths | itself (#273) | exact, revise |
| `utils/movedSections.test.ts` | test | - | EXISTS, wrong expectations | itself | exact, revise |
| `pages/AccountConnections.tsx` | page | request-response (wraps panel) | NEW (#273 used a section in Accounts.tsx) | `pages/Files.tsx` PageHeader frame + `PageHeader` breadcrumbs | role-match |
| `pages/BudgetCategories.tsx` | page | request-response | NEW (#273 put it in Budget.tsx `?view=categories`) | #273's in-Budget categories view (Budget.tsx diff) | exact content, move out |
| `App.tsx` | route config | - | unchanged by #273 | `App.tsx:16-36` lazy, `:71-77` routes | exact |
| `components/accounts/ConnectedBanks.tsx` (renamed from `settings/ConnectedAccounts.tsx`) | component | request-response | EXISTS, controlled `provider` props + own `h2` section | itself | revise |
| `pages/Settings.tsx` | page | - | EXISTS, default `preferences` | itself | revise |
| `pages/Accounts.tsx` | page | - | EXISTS, embeds banks section, `useOpenFromLink('banks')` | `redesign` version of Accounts.tsx | revert most, add header link |
| `pages/Budget.tsx` | page | - | EXISTS, +81 lines (view + lazy CategoryManager) | `redesign` version | revert view, keep entry links only |
| `components/ui/Plant.tsx` | component (SVG) | transform | NEW as named (#273 has inner `Plant` in `goals/GoalGrowthBar.tsx`) | `components/goals/GoalGrowthBar.tsx` | role-match |
| `components/ui/Plant.test.ts` | test | - | NEW (#273 has `goals/growth.test.ts`) | `components/goals/growth.test.ts`, `components/ui/EmptyState.test.ts` | exact |
| `components/goals/growth.ts` | utility (stage + bloom memory) | transform / localStorage | EXISTS, five stages | itself | revise to four stages or fold into Plant.tsx |
| `components/goals/GoalGrowthBar.tsx` | component | - | EXISTS | itself | revise (use ui/Plant, UI-SPEC grid) or delete |
| `pages/Goals.tsx` | page | - | EXISTS, uses GoalGrowthBar | itself | revise |
| `index.css` | config (tokens) | - | EXISTS, five `--animate-*` + keyframes + reduced-motion `none` | itself | keep; drop `tick-draw`/`leaf-in` if SproutTick goes |
| `utils/fundingStatus.ts` (+ test) | utility | transform | unchanged by #273 | itself (`unresolvedReason`) | extend |
| `components/budget/BudgetSummaryWidget.tsx` | component | - | EXISTS, keeps "Fully budgeted" + SproutTick | itself | revise |
| `components/budget/SproutTick.tsx`, `readyReached.ts(+test)` | component / utility | - | EXISTS | - | DELETE (UI-SPEC: static Plant seedling glyph, no animation on hero) |
| `components/layout/navPages.ts` + `CommandPalette.tsx` | config + component | - | not touched by #273 | `CommandPalette.tsx:115-139` | role-match |
| Link sites: `BankBalanceHint.tsx`, `up/UpSyncBadge.tsx`, `dashboard/GettingStarted.tsx`, `transactions/TransactionTable.tsx`, `review/Resilience.tsx`, `review/Housekeeping.tsx` | component | - | EXIST, point at `CONNECTED_BANKS_LINK` / `MANAGE_CATEGORIES_LINK` | `BankBalanceHint.tsx` #273 diff | exact, re-point + provider |
| `guides/pages.ts` | data | - | EXISTS, Connect Up step deleted, settings v2 | itself | revise wording/routes; restore Connect-Up as accounts step |
| Copy sites: `userGuide/articles.tsx`, `BulkDeleteModal.tsx`, `TransactionDetailPanel.tsx`, `UnusedCategories.tsx`, `RentOrOwn.tsx`, `NotInDemo.tsx` | copy | - | EXIST (say "Accounts page"/"Budget page") | #273 diffs | revise wording to "Accounts → Connected banks", "Budget → Categories" |
| `lint/terms/terms.test.js` | test | - | not touched | its `RETIRED` list | role-match |
| e2e specs (see list below) | test | - | EXIST, point at `?banks=up` / `?view=categories` | themselves | re-point |
| Docs: `docs/ui/MAP.md`, `HANDOVER-UI.md`, `UP-SUPPORT.md`, `START-HERE.md`, `RESILIENCE.md`, `DEVELOPMENT.md`, `CHANGELOG.md`, plus `homeassistant/DOCS.md`, `DESKTOP-SERVER.md`, `MAINTENANCE.md` (not touched by #273) | docs | - | partly | #273 diffs | revise |

## Pattern Assignments

### `utils/movedSections.ts` (revise)

**Today in wt-f** (whole file, lines 1-19):
```typescript
export const CONNECTED_BANKS_LINK = '/accounts?banks=up';
export const MANAGE_CATEGORIES_LINK = '/budget?view=categories';
const MOVED_SETTINGS_TABS: Readonly<Record<string, string>> = {
  connections: CONNECTED_BANKS_LINK,
  categories: MANAGE_CATEGORIES_LINK,
};
export function movedSettingsTab(tab: string | null): string | null {
  return tab && Object.hasOwn(MOVED_SETTINGS_TABS, tab) ? MOVED_SETTINGS_TABS[tab] : null;
}
```
**Change to match UI-SPEC / D-08:**
- `CONNECTED_BANKS_PATH = '/accounts/connections'`, `CATEGORIES_PATH = '/budget/categories'` (rename the two exports; update every importer, grep `CONNECTED_BANKS_LINK|MANAGE_CATEGORIES_LINK`).
- Keep the `Object.hasOwn` guard (it is what the `'constructor'`/`'toString'` test covers).
- Change `movedSettingsTab` to take `URLSearchParams` and keep other params (RESEARCH Pattern 1 code, lines 244-257), so `?tab=connections&x=1` -> `/accounts/connections?x=1`.
- Add `BANK_PROVIDERS = ['up','plaid','simplefin','enablebanking'] as const`, `type BankProvider`, `parseProvider(value: string | null): BankProvider | null` (allowlist, same `includes`/`hasOwn` style), and `connectedBanksLink(provider?: BankProvider)` returning `${CONNECTED_BANKS_PATH}?provider=up` etc. Move the `BankProvider` type here from `ConnectedBanks.tsx:29` so pills, links and the panel share one list.
- Add a feed-label map for `BankSyncPill`: `bankSync.ts` feeds carry display names `'Up' | 'Plaid' | 'SimpleFIN' | 'Enable Banking'` (`StatusStrip.tsx:38-41`, `bankSync.ts:5,27`); map label -> `BankProvider`, unknown -> no `provider` param.

### `utils/movedSections.test.ts` (revise)
Keep the structure of wt-f lines 1-16 (`describe('movedSettingsTab (#244)')`, the prototype-name refusal case). Change expectations to new paths, add: other params kept and `tab` dropped; `parseProvider` accepts the four ids and rejects `'UP'`, `'../x'`, `'constructor'`, `null`; `connectedBanksLink()` with and without provider.

### `pages/AccountConnections.tsx` (NEW, page)

**Analog frame:** `components/ui/PageHeader.tsx` (lines 19-52: `breadcrumbs`, `title`, `subtitle`, `actions`) as used by `pages/Files.tsx:223-235`; content scroller pattern from #273's categories view in Budget.tsx (diff hunk `@@ -906,6 +917,33 @@`):
```tsx
<div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
  <div className="max-w-2xl">…</div>
</div>
```
Use the full skeleton in RESEARCH.md Pattern 3 (lines 274-289): `useScrollMemory('accounts-connections')`, `PageHeader breadcrumbs=[Accounts -> /accounts, Connected banks]`, subtitle = the panel's intro sentence. Read `?provider=` once with `parseProvider(searchParams.get('provider'))` into `useState` initial value (default `'up'`? UI-SPEC focal point: "provider toggle (Up first)"; #273's `useState<BankProvider | null>(null)` in Accounts.tsx means nothing open; pick one and state it). Pass `provider`/`onProvider` to `ConnectedBanks`, which is already controlled in #273 (lines 30-35), so the page owns the state. Default export, `lazy()` in App.tsx.

### `pages/BudgetCategories.tsx` (NEW, page)

**Analog:** #273's in-Budget view (Budget.tsx diff hunk at new line 920-945) has the body; move it into its own page and swap the hand-built header for `PageHeader`:
```tsx
<Suspense fallback={<p role="status" className="text-sm text-text-tertiary">Loading…</p>}>
  <CategoryManager />
</Suspense>
```
Since the page itself is `lazy()`, import `CategoryManager` statically (`components/settings/CategoryManager`), no inner `Suspense`/`lazy`. `useScrollMemory('budget-categories')`, breadcrumbs `[Budget -> /budget, Categories]`. Drop the "Back to budget" ButtonLink (breadcrumb replaces it).

### `App.tsx` (modify)
Follow lines 16-36 (`const XPage = lazy(() => import('./pages/X'))`) and route lines 71-77 (`element={page(X)}`). Add `/budget/categories` next to `:74` `/budget/category/:id` and `/accounts/connections` before `:76-77` `/accounts/:id/*`. Route paths should come from the movedSections constants.

### `components/accounts/ConnectedBanks.tsx` (revise)
#273 renamed `settings/ConnectedAccounts.tsx` to this, made it controlled (`provider`, `onProvider`, `headingRef`, lines 30-35) and wrapped both variants in a `BanksSection` with its own `<h2 id="connected-banks-heading">` (lines ~48-70). UI-SPEC: page header carries title and intro, so remove `BanksSection`'s h2 + description and `headingRef`/`HEADING_ID` (they only served scroll-into-view on Accounts). Keep: provider toggle `role="group" aria-label="Bank connection provider" className="scroll-row …"` (lines 150-197, Up first, `aria-pressed`), `provider !== null && provider !== 'up' && <CommunitySupportedNote />` (199), demo branch with `NotInDemo`. The loading branch keeps its `Loader2 … aria-hidden`. Keeping the file in `components/accounts/` is fine (MAP.md must name it); the UI-SPEC's "ConnectedAccounts" name is a reference to the same panel.

### `pages/Settings.tsx` (revise)
wt-f already removed both tabs, imports and panels and added `<Navigate replace>` after `useSearchParams` (hook order correct). Changes:
- Restore tab order with `accounts` first: undo the move of `preferences` to the top (put it back between `data` and `server` as on redesign) and drop its comment.
- Default `'preferences'` -> `'accounts'` (diff line `const activeTab … : 'preferences'`).
- `movedSettingsTab(searchParams)` (whole params) instead of `movedSettingsTab(tabParam)`. Keep the redirect before the JSX return and after all hooks.

### `pages/Accounts.tsx` (revise toward redesign)
Revert #273's banks section: remove `useRef/useEffect`, `provider`/`revealBanks`/`banksHeading`/`openBanks`, `useOpenFromLink('banks', …)`, the `banks` element and the single-scroller restructure (diff hunk `@@ -210,80 +233,87 @@`). Then:
- Empty state "Connect a bank": back to redesign's `<ButtonLink variant="secondary" to={…}>` with `connectedBanksLink()`.
- Header (redesign `:199-207`): add `ButtonLink variant="secondary" size="sm"` `Link2` 14, "Connected banks", `data-guide="accounts.connections"` left of "Add account"; row classes `flex flex-wrap items-center justify-between gap-x-4 gap-y-2`. `ButtonLink` import restored (`../components/ui/Button`).
Easiest path: `git checkout redesign -- client/src/pages/Accounts.tsx` then apply the two edits.

### `pages/Budget.tsx` (revise toward redesign)
Remove: `lazy, Suspense, useSearchParams` imports, the `CategoryManager` lazy const, `manageCategories` and its whole early-return view, and the search-row restructure plus ghost "Manage categories" ButtonLink. Keep, re-labelled per UI-SPEC: phone menu item (wt-f diff, after "Year") with label "Categories" and `to={CATEGORIES_PATH}`; desktop `ButtonLink variant="secondary" size="sm"` `Layers` 14 "Categories" placed right after `AssignMenu` (redesign `:1023-1028`), `data-guide="budget.manage-categories"` (not `budget.categories`, which is on `:1223` and targeted by `guides/budget.ts:22`, `guides/welcome.ts:48`). Empty-table copy at redesign `:1436-1442` -> "No categories yet." + link "Set up your categories". Net growth: a few lines only.

### `components/ui/Plant.tsx` (NEW) + `components/goals/growth.ts` / `GoalGrowthBar.tsx` (revise)

**Analog:** `components/goals/GoalGrowthBar.tsx` lines 15-97 (inner `Plant`), and `growth.ts` lines 1-32.

Keep from #273:
- SVG conventions (lines 18-28): `viewBox="0 0 20 20"`, `aria-hidden`, `focusable="false"`, `className="block overflow-visible origin-bottom …"`, colours via `fill-positive`, `stroke-positive`, `fill-brand-500` (no hex).
- Motion hooks: `animate-grow-in` on the svg when `grew`; petals `animate-bloom` with `style={{ transformOrigin: '10px 5px', animationDelay: \`${i * 40}ms\` }}`; ring `animate-bloom-ring`; `data-motion` attrs.
- `firstBloom(goalId)` + `BLOOMED_KEY = 'flybudget:goals-bloomed'` with try/catch fallback to still (growth.ts 14-32) and the `useState(() => complete && firstBloom(goalId))` once-per-mount guard (GoalGrowthBar 117-125, including the render-time `shown !== stage` grow detection).

Change:
- Stages: `type PlantStage = 'seed' | 'seedling' | 'bud' | 'flower'`, `plantStage(pct, complete)` with 33/66 thresholds (RESEARCH lines 559-566), replacing `growthStage` five stages (`sprout`/`leaf` gone).
- Geometry per UI-SPEC section 4 (ground line `stroke-border`, seed ellipse `fill-text-tertiary`, brand `SPROUT` path from `client/public/logo.svg` transformed per stage, bud path, five petal circles `r=2` and centre `fill-brand-700`; #273 used `fill-brand-600` for the centre).
- Props `Plant({ stage, size = 20, ground = true, className, ...dataAttrs })` exported from `components/ui/Plant.tsx` so the hero can use `stage="seedling" size={16} ground={false}`. Bloom/grow animation props stay optional (hero passes none, static).
- Placement: UI-SPEC grid (`mt-3 pl-12 grid grid-cols-[1fr_auto] items-center gap-x-2`, bar col 1, `<Plant data-testid="goal-plant" data-stage={stage}/>` col 2, label row col 1 row 2). This replaces #273's "plant rides the leading edge" absolute positioning (GoalGrowthBar 128-149, `pt-6.5`, `clamp(13px, …)`). The bar keeps redesign's plain markup (no `role="progressbar"` wrapper unless kept deliberately; if kept, check the label row still announces once).
- Either delete `GoalGrowthBar.tsx`/`growth.ts` and put `firstBloom` next to `plantStage`, or keep `growth.ts` only for `firstBloom`. Do not leave two stage functions.

### `components/ui/Plant.test.ts` (NEW)
Copy structure of `components/goals/growth.test.ts` (wt-f) for the stage table and `components/ui/EmptyState.test.ts` lines 1-25 for markup (`createElement` + `renderToStaticMarkup`, node env, `.test.ts` not `.tsx`). Assertions per RESEARCH lines 576-591: boundaries 32.99/33/65.99/66/100, only `complete` flowers, markup has `aria-hidden="true"` and no `#[0-9a-f]{3,6}`. Port growth.test.ts's `firstBloom` cases (storage throws -> false, second call false).

### `pages/Goals.tsx` (revise)
wt-f diff replaces the bar block at `:227-235` with `<GoalGrowthBar goalId name pct complete/>` and `mt-2`. Change to the UI-SPEC grid with `<Plant stage={plantStage(pct, complete)} …/>`; keep `complete` from `:92` unchanged, keep "Goal reached" text row.

### `index.css` (keep, trim)
wt-f adds tokens inside `@theme` after line ~128 (`--animate-grow-in`, `--animate-bloom`, `--animate-bloom-ring`, `--animate-tick-draw`, `--animate-leaf-in` + `@keyframes`) and sets all five to `none` in the reduced-motion block (~line 287). Keep grow-in, bloom, bloom-ring. Remove `tick-draw` and `leaf-in` (tokens, keyframes, reduced-motion lines) when SproutTick is deleted.

### `utils/fundingStatus.ts` + `fundingStatus.test.ts` (extend)
Analog: `unresolvedReason` (wt-f lines 19-35, identical to redesign). Refactor into `unresolvedCauses(f)` + `CAUSE_WORDS` and add `readyToAssignStatus(...)` returning `{ bg, text, label, figureClass, glyph }` per RESEARCH Code Examples (lines 489-513) and UI-SPEC section 5 table. Extend the `Funding` Pick (lines 3-12) with `resolved`, `resources`, `envelopes`, `reserved` if the status function takes funding. Existing `unresolvedReason` tests must pass unchanged. Clean label only when `funding?.resolved === true` (RESEARCH Open Question 1).

### `components/budget/BudgetSummaryWidget.tsx` (revise)
wt-f added `hasMoney` const, `fullyBudgeted`, `seen/celebrate` state with `reachedZeroNow`, `heroLabel` with `<SproutTick animate>`, and a "Every dollar has a job." subline. Replace with: one call to `readyToAssignStatus`, drop `getHeroStyle` (lines 63-77, its `'Fully budgeted'` branch) and the SproutTick/readyReached imports and state; render `<Plant stage="seedling" size={16} ground={false} />` before the label only in the clean case; figure uses `status.figureClass` (`text-text` at $0) not `hero.text` (the two `readyAmount` sites). Keep #273's `hasMoney` extraction (it is the same expression redesign inlined). Keep the doubtful branch and todo line as they are.

### `components/layout/navPages.ts` + `CommandPalette.tsx` (modify)
Add `PALETTE_PAGES: { path; label; icon }[]` beside `NAV_PAGES` in navPages.ts (Connected banks `Link2` -> `CONNECTED_BANKS_PATH`, Categories `Layers` -> `CATEGORIES_PATH`), and append them in `CommandPalette.tsx:115-139` with the same shape as the "shown" branch:
```typescript
{ id: `page:${p.path}`, group: 'pages', label: p.label, icon: p.icon, to: p.path, remember: true }
```
Do not add them to `NAV_PAGES` (navPages.ts:26-27 comment: sidebar and palette both list it).

### Link sites (re-point)
Pattern from wt-f `BankBalanceHint.tsx` diff: `import { CONNECTED_BANKS_LINK } from '../../utils/movedSections'; <Link to={CONNECTED_BANKS_LINK} …>`. Rename to the new constants/helpers and pass providers:
- `BankBalanceHint.tsx:21`, `Housekeeping.tsx:55` (Up-specific): `connectedBanksLink('up')`.
- `UpSyncBadge.tsx` `BankSyncPill` (`StatusPill to=…`): provider from `feed.provider` label map (the Codex P1). Fix its doc comment "linking to Settings → Connections".
- `GettingStarted.tsx:86`, `TransactionTable.tsx:531`, `Resilience.tsx:281`: `connectedBanksLink()`.
- `Housekeeping.tsx:92`: `CATEGORIES_PATH`.

### `guides/pages.ts` (revise)
wt-f diff: accounts step body says "below your accounts" (wrong now), settings `version: 2` (keep, with its comment), summary and "Everything in tabs" body rewritten (adjust: list starts with account order, "Connected banks are under Accounts → Connected banks, and categories under Budget → Categories"), and the "Connect Up" step deleted. Restore a Connect-Up step with `route: CONNECTED_BANKS_PATH` (in accountsGuide, target `accounts.connections` on `/accounts`, so `guides.test.ts` checks the marker), bump `accountsGuide.version` to 2. Ids unchanged.

### `lint/terms/terms.test.js` (modify)
Add `[/Fully budgeted/, 'Every dollar has a job']` to its `RETIRED` list (RESEARCH Don't Hand-Roll).

## e2e re-pointing (wt-f specs already edited by #273)
Grep in wt-f: `grep -rn "banks=up\|view=categories\|Manage categories\|sprout-tick\|Fully budgeted\|data-bloom\|goal-plant" e2e/tests`. Every hit moves to `/accounts/connections[?provider=…]`, `/budget/categories`, label "Categories", the new $0 copy, and `data-stage` four-stage values. Specs #273 touched: `accessibility, accounts, budget, category-goals, demo/demo, enable-banking, first-import, menus, phone/polish-phone, phone/targets-phone, settings, switchers, up`. Not yet touched and needed per RESEARCH e2e table: `phone/page-gutter.spec.ts:30-50`, `phone/phone.spec.ts:50-61`, `accessibility.spec.ts:70-79` (add both routes), `command-palette.spec.ts` (palette entries), settings default `accounts` + 8 tabs + params-kept redirect.

## Shared Patterns

### Constants in one module
**Source:** `utils/movedSections.ts`. **Apply to:** App routes, Settings redirect, all link sites, palette, guides. No literal `'/accounts/connections'` elsewhere.

### Page frame
**Source:** `components/ui/PageHeader.tsx:19-52` + `useScrollMemory(name)` + `PAGE_GUTTER` (`components/ui/pageGutter`). **Apply to:** both new pages. UI-SPEC also asks breadcrumb links `max-md:py-4 max-md:-my-4` and `aria-label="Breadcrumb"` on the `<nav>` at `PageHeader.tsx:24` (shared; check Files.tsx and ReportWidgetView at 390 px).

### Query-param allowlist
**Source:** `movedSettingsTab` `Object.hasOwn` guard. **Apply to:** `?tab=` and `?provider=`. Never interpolate a param into a path.

### Decorative SVG + motion tokens
**Source:** `GoalGrowthBar.tsx:18-28` and `index.css` `--animate-*` with reduced-motion `none`. **Apply to:** Plant on goals (animated) and hero glyph (static).

### Unit tests are node-env `.test.ts`
**Source:** `components/ui/EmptyState.test.ts:1-25`. Logic goes in pure exported functions (`plantStage`, `readyToAssignStatus`, `movedSettingsTab`, `parseProvider`).

## No Analog Found
None. `readyToAssignStatus` has no existing analog beyond `getHeroStyle`/`unresolvedReason`; follow RESEARCH Code Examples.

## Files to delete (from #273)
`components/budget/SproutTick.tsx`, `components/budget/readyReached.ts`, `readyReached.test.ts`; and `components/goals/GoalGrowthBar.tsx` + `growth.ts`/`growth.test.ts` once their content lives in `components/ui/Plant.tsx(.test.ts)`.

## Metadata
**Search scope:** wt-f `client/src/{pages,components,utils,guides,hooks}`, `index.css`, `App.tsx`; `git diff redesign...wave-f` (51 files).
**Pattern extraction date:** 2026-11-14
