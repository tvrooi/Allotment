---
phase: 01-settings-split-and-good-moments
reviewed: 2026-11-15T20:53:00+11:00
depth: standard
files_reviewed: 71
files_reviewed_list:
  - CHANGELOG.md
  - DESKTOP-SERVER.md
  - MAINTENANCE.md
  - UP-SUPPORT.md
  - client/src/App.tsx
  - client/src/components/accounts/BankBalanceHint.tsx
  - client/src/components/accounts/ConnectedBanks.tsx
  - client/src/components/budget/BudgetSummaryWidget.tsx
  - client/src/components/budget/RentOrOwn.tsx
  - client/src/components/dashboard/GettingStarted.tsx
  - client/src/components/demo/NotInDemo.tsx
  - client/src/components/goals/GoalPlant.tsx
  - client/src/components/goals/growth.test.ts
  - client/src/components/goals/growth.ts
  - client/src/components/layout/CommandPalette.tsx
  - client/src/components/layout/navPages.ts
  - client/src/components/review/Housekeeping.tsx
  - client/src/components/review/Resilience.tsx
  - client/src/components/settings/UnusedCategories.tsx
  - client/src/components/transactions/BulkDeleteModal.tsx
  - client/src/components/transactions/TransactionDetailPanel.tsx
  - client/src/components/transactions/TransactionTable.tsx
  - client/src/components/ui/PageHeader.tsx
  - client/src/components/ui/Plant.test.ts
  - client/src/components/ui/Plant.tsx
  - client/src/components/up/UpSyncBadge.tsx
  - client/src/guides/pages.ts
  - client/src/index.css
  - client/src/pages/AccountConnections.tsx
  - client/src/pages/Accounts.tsx
  - client/src/pages/Budget.tsx
  - client/src/pages/BudgetCategories.tsx
  - client/src/pages/Goals.tsx
  - client/src/pages/Settings.tsx
  - client/src/userGuide/articles.tsx
  - client/src/utils/fundingStatus.test.ts
  - client/src/utils/fundingStatus.ts
  - client/src/utils/movedSections.test.ts
  - client/src/utils/movedSections.ts
  - docs/DEVELOPMENT.md
  - docs/RESILIENCE.md
  - docs/START-HERE.md
  - docs/ui/HANDOVER-UI.md
  - docs/ui/MAP.md
  - docs/ui/WAVES.md
  - e2e/tests/accessibility.spec.ts
  - e2e/tests/accounts.spec.ts
  - e2e/tests/budget.spec.ts
  - e2e/tests/category-goals.spec.ts
  - e2e/tests/cleanup.spec.ts
  - e2e/tests/command-palette.spec.ts
  - e2e/tests/demo/category-goals.spec.ts
  - e2e/tests/demo/demo.spec.ts
  - e2e/tests/enable-banking.spec.ts
  - e2e/tests/first-import.spec.ts
  - e2e/tests/menus.spec.ts
  - e2e/tests/phone/page-gutter.spec.ts
  - e2e/tests/phone/phone.spec.ts
  - e2e/tests/phone/polish-phone.spec.ts
  - e2e/tests/phone/targets-phone.spec.ts
  - e2e/tests/safe-mode.spec.ts
  - e2e/tests/settings.spec.ts
  - e2e/tests/switchers.spec.ts
  - e2e/tests/up.spec.ts
  - e2e/tests/user-guide.spec.ts
  - homeassistant/DOCS.md
  - homeassistant/config.yaml
  - lint/terms/terms.test.js
  - package.json
  - server/src/routes/accountDeletion.test.ts
  - server/src/services/accountDeletion.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
  necessity: 0
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-15T20:53:00+11:00
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

Reviewed the 71 scoped files on branch `wave-f` (`575c3ea` vs `origin/redesign`) in `/Users/tristanvanrooyen/wt-f` (read-only), covering the Settings split (#244: `/accounts/connections` and `/budget/categories`, redirects in `Settings.tsx`, single-source routing helpers in `client/src/utils/movedSections.ts`, search palette entries, guides, e2e specs, and docs) and good moments (#241: `Plant`, `GoalPlant`, `firstBloom`, `readyToAssignStatus`, `BudgetSummaryWidget`, `lint/terms`, and reduced-motion tokens). The locked `package-lock.json` diff outside the 71-file scope was also checked and contains only the `0.2.0-up.174` version bump matching `package.json` and `homeassistant/config.yaml`.

Read-only verification run in `/Users/tristanvanrooyen/wt-f` on Node 24:
- `npm test --prefix client -- src/utils/movedSections.test.ts src/utils/fundingStatus.test.ts src/components/ui/Plant.test.ts src/components/goals/growth.test.ts`: 4 files, 45 tests passed.
- `npm test --prefix client`: 75 files, 611 tests passed.
- `npm test --prefix server -- accountDeletion.test.ts`: 1 file, 4 tests passed.
- `cd client && npx tsc --noEmit` and `npm run build --prefix client`: passed.
- `npm test --prefix lint`: 86 tests passed; `npm run lint --prefix lint`: 0 errors, 128 warnings (`--max-warnings=128`).
- Playwright `e2e/` tests were not executed (prohibited against shared fixed ports).

Necessity review (`necessity-review.md`) was applied: no impossible-state guards, phantom requirements, or uninstantiated abstractions were introduced (the optional-field fallbacks in `client/src/utils/fundingStatus.ts` and `stage === 'flower'` guard in `client/src/components/ui/Plant.tsx` are justified by the TypeScript types and reusable component props). No P0/Critical security, money-math, or data-loss defects were found. Four P1 warnings and one P2 info item were found:
1. Confirmed from source: `GoalPlant` evaluates `firstBloom` only on mount, breaking in-place bloom transitions on mounted `paused` or manually `completed` goals.
2. `ConnectedBanks` renders only an `aria-hidden` spinner while loading, leaving assistive technology without a loading status.
3. Three user-facing error strings in Enable Banking server services still direct users to `Settings → Connected banks`.
4. `client/src/userGuide/articles.tsx` still uses lowercase `"fully budgeted"`, which `lint/terms/terms.test.js` missed because its `/Fully budgeted/` regex is case-sensitive.
5. `docs/DEVELOPMENT.md`'s route table and `StatusStrip.tsx`'s JSDoc still reference old Settings tabs.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `GoalPlant` evaluates bloom eligibility only on mount

**File:** `client/src/components/goals/GoalPlant.tsx:21` (with `:29-39` and `client/src/pages/Goals.tsx:317, 360-363`)
**Classification:** WARNING (P1)
**Issue:** Confirmed directly from source: `const [bloom] = useState(() => complete && firstBloom(goalId));` runs only on mount. In `client/src/pages/Goals.tsx:317`, each `GoalRow` is keyed by `goal.id` inside its `GoalGroup`, and `completed` (`:360-362`) and `paused` (`:363`) retain goals regardless of whether `complete` is `true` or `false`.
1. **Missed first bloom:** A `paused` goal or manually `completed` goal (short of target, `complete === false`) stays mounted in the same `GoalGroup` when its saved or category-funded amount is raised to `targetAmount` without leaving `/goals`. `stage` updates to `'flower'`, but `bloom` stays `false` from mount and `firstBloom(goalId)` is never recorded.
2. **Repeated bloom:** If a mounted `paused` or `completed` goal initially mounted with `complete === true` (`bloom === true`), lowering its amount below target (`stage` becomes `'bud'`/`'seedling'`/`'seed'`) and raising it back to target (`stage` becomes `'flower'`) remounts `<Plant key={stage} ... bloom={blooming} />` (`GoalPlant.tsx:32`) with `bloom={true}` because `bloom` was never cleared.
3. **Render-phase storage write:** Invoking `firstBloom(goalId)` inside `useState`'s lazy initializer mutates `localStorage` during initialization rather than in an effect (notably `client/src/main.tsx:52` wraps `<App />` in `<StrictMode>`).
**Fix:** Evaluate `firstBloom(goalId)` when `complete` transitions from `false` (or initial mount) to `true` in a `useEffect`, store the bloom state for that completion transition, and reset it when `complete` becomes `false`:
```tsx
const [bloom, setBloom] = useState(false);
const prevComplete = useRef(false);

useEffect(() => {
  if (complete && !prevComplete.current) {
    setBloom(firstBloom(goalId));
  } else if (!complete && prevComplete.current) {
    setBloom(false);
  }
  prevComplete.current = complete;
}, [complete, goalId]);
```
Add a regression test covering a mounted `paused` or manually `completed` goal crossing the target in both directions.

### WR-02: `ConnectedBanks` loading state has no accessible status text

**File:** `client/src/components/accounts/ConnectedBanks.tsx:99-105`
**Classification:** WARNING (P1)
**Issue:** While any of the five bank connection queries are pending (`isLoading`), `ConnectedBanksSetup` returns only a centered `<Loader2 size={24} className="animate-spin text-text-tertiary" aria-hidden />`. Because the icon is `aria-hidden` and no visible or screen-reader status text is present, assistive technology receives no loading announcement after the page heading. (Moving the section intro into `PageHeader` removed the text that previously accompanied the spinner.)
**Fix:** Wrap or pair the spinner with an accessible status element:
```tsx
if (isLoading) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-xs text-text-tertiary">
      <Loader2 size={20} className="animate-spin" aria-hidden />
      <span>Checking your bank connections…</span>
    </div>
  );
}
```

### WR-03: Enable Banking server error messages still point to `Settings → Connected banks`

**File:** `server/src/services/enableBankingService.ts:71, 73` and `server/src/services/enableBankingSyncService.ts:435`
**Classification:** WARNING (P1)
**Issue:** `server/src/services/accountDeletion.ts:83` was updated to `Accounts → Connected banks → ${feed}`, but three sibling user-facing error messages on the Enable Banking path were missed and still direct users to a Settings tab that no longer exists:
- `server/src/services/enableBankingService.ts:71`: `"Enable Banking didn't accept the application ID or private key. Check them in Settings → Connected banks."`
- `server/src/services/enableBankingService.ts:73`: `"The redirect URL isn't registered in your Enable Banking application. Add the one shown in Settings → Connected banks."`
- `server/src/services/enableBankingSyncService.ts:435`: `'Enable Banking is not set up. Add your application in Settings → Connected banks.'`
**Fix:** Update all three strings (and any server tests asserting them) to `Accounts → Connected banks`.

### WR-04: User guide still says `"fully budgeted"`, and `lint/terms` check is case-sensitive

**File:** `client/src/userGuide/articles.tsx:405` and `lint/terms/terms.test.js:19`
**Classification:** WARNING (P1)
**Issue:** `lint/terms/terms.test.js:19` added `[/Fully budgeted/, 'Every dollar has a job']` without the `i` flag. Because the pattern is case-sensitive, it missed `client/src/userGuide/articles.tsx:405`:
> `"It leaves Ready to assign now, so the month can reach $0 and read fully budgeted, and it comes back when next month starts."`

The retired label no longer appears anywhere in the UI; a clean `$0` now reads `"Every dollar has a job"` (`client/src/utils/fundingStatus.ts:127`).
**Fix:** Update `client/src/userGuide/articles.tsx:405` to describe `"Every dollar has a job"` (for example, `read “Every dollar has a job”`) and add the `i` flag in `lint/terms/terms.test.js:19` (`/Fully budgeted/i`).

## Info

### IN-01: `docs/DEVELOPMENT.md` route table and `StatusStrip.tsx` doc comment still reference old Settings tabs

**File:** `docs/DEVELOPMENT.md:268` and `client/src/components/dashboard/StatusStrip.tsx:20-21`
**Classification:** WARNING (P2)
**Issue:**
- `docs/DEVELOPMENT.md:268` still lists `| /settings | Settings (Categories, Account reorder, Data export/backup, Preferences) |` in the route table and omits `/accounts/connections` and `/budget/categories`, even though other sections of `docs/DEVELOPMENT.md` (`:387, 401`) were updated in this PR.
- `client/src/components/dashboard/StatusStrip.tsx:20-21` has a stale JSDoc comment referencing `Settings → Connections`.
**Fix:** Update `docs/DEVELOPMENT.md:255-268` to add `/accounts/connections` and `/budget/categories` and remove `Categories` from `/settings`; update `client/src/components/dashboard/StatusStrip.tsx:20-21` to `Accounts → Connected banks`.

---

_Reviewed: 2026-11-15T20:53:00+11:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
