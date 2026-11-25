---
phase: 03-screens-on-shared-controls
plan: 03-06
reviewed: 2026-11-19T04:05:54Z
depth: standard
diff_base: dd7f3482
head: 147c26f6
worktree: .claude/worktrees/agent-p0306-a1
files_reviewed: 4
files_reviewed_list:
  - client/src/pages/Payees.tsx
  - client/src/pages/Rules.tsx
  - client/src/components/rules/ApplyRulesModal.tsx
  - e2e/tests/payees.spec.ts
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
  necessity: 1
status: issues_found
---

# Phase 03 (plan 03-06): Code Review Report

**Reviewed:** 2026-11-19T04:05:54Z
**Depth:** standard
**Files Reviewed:** 4 (plus the shared `ui/Checkbox.tsx`, `ui/RadioGroup.tsx`, `ui/Input.tsx`, `ui/fieldClasses.ts`, `SavingPausedHint.tsx`, and every e2e spec that opens `/payees` or `/rules`)
**Status:** issues_found

## Summary

I reviewed `git diff dd7f3482..HEAD` (commits 8ac98af8, a22da41c, 147c26f6) against 03-06-PLAN, 03-CONTEXT (D-03, D-13, D-15, D-17), 03-UI-SPEC §2 and §4, 03-RESEARCH open questions 2 and 3, the WAVG-01 audit rows for Payees and Rules, and CLAUDE.md "Review guidelines".

**What holds (checked):**
- The raw-control count (the plan's perl check) is 0 for `Payees.tsx` and 0 for `Rules.tsx` + `ApplyRulesModal.tsx`. `PayeeDetail.tsx` and `components/payees/*` are also 0. The only remaining raw input is `PayeeIcon.tsx:99` `type="file"` (D-17, listed under "Stays native").
- Must-haves 1–4 hold when I read the code. The merge dialog uses `RadioGroup`/`Radio` with the UI-SPEC card-row classes (`border-brand-600 bg-brand-50` / `border-border hover:bg-hover`). Its `[&_label]:*` arbitrary variants beat the Radio's own `inline-flex items-start max-md:py-3` on specificity. The same `keepId` reaches `onMerge` (T-03-08). The search fields, inline renames (fieldSize `sm`: h-8 matches the 32 px `PayeeIcon md`, so desktop row height is unchanged) and the checkboxes are the shared controls.
- Rules `role="switch"` button (`Rules.tsx:95`) is untouched. This matches 03-RESEARCH open question 2 "RESOLVED (03-06 …): keep the button as it is". The audit's Rules section has no row for it; I re-grepped `docs/ui/FORM-CONTROLS-AUDIT.md` to confirm.
- The prohibition holds: `e2e/tests/rules.spec.ts` is not in the diff.
- No money field is in scope: there is no `CurrencyInput` change and no `type="number"` in any of the three files.
- `client` `tsc --noEmit` passes, `e2e` `tsc --noEmit` passes, and Prettier is clean on all 4 files.
- The select-all/indeterminate logic is correct for React Aria. Clicking an indeterminate box calls `onCheckedChange(true)`, which selects all filtered rows, as before. ApplyRulesModal's inverted `checked ? new Set() : all` matches the old `allOn ? all : new Set()` in every state.
- Every changed e2e selector in `payees.spec.ts` (lines 58–75) has a reason under "Selector changes".

**Not verified by me:** I did not run any Playwright project. The fixed e2e ports are shared with the other executors and the phase runs one browser at a time. Two claims therefore rest on the executor's run: `.check()` times out on React Aria's hidden input, and "15 passed / rules.spec 3 passed 1 failed". The claim about `.check()` fits `first-run.spec.ts:18` (`switchTarget`), which works around the same interception for the shared Switch.

**Key concerns:**
1. The change breaks a phone spec. That spec is a verification gate for three later plans, and none of them is told about the break.
2. `rules.spec.ts` is red at this HEAD, so must-have 5 is not met.
3. Several behaviour changes go beyond D-15 ("anything else that would change is a finding to raise, not a change to make"). The changes are clear buttons, select-on-focus, accessible names, the selection semantics, a click dead zone and the paused-save gate. Each was shipped rather than raised, and two of them have no test.
4. The search-with-clear markup and the e2e label-click helper are each copied again instead of shared.

## Critical Issues

### CR-01: phone-native.spec.ts merge test broken; three later plans' gates run it without the handoff

**File:** `e2e/tests/phone/phone-native.spec.ts:309` (also `:310`, `:314`), caused by `client/src/pages/Payees.tsx:262-275` (phone row `Checkbox`) and `Payees.tsx:46-72` (merge `Radio`)
**Issue:** The phone list's row checkboxes and the merge radios are now React Aria's visually hidden inputs. The executor's own diagnosis (SUMMARY "Selector changes") is that `.check()` on them times out because `<span aria-hidden>` intercepts the pointer. `phone-native.spec.ts:309-310` (`getByRole('checkbox', { name: 'Select Corner Grocery' }).check()`) and `:314` (`merge.getByRole('radio', …).check()`) do exactly that. The phone project was never run, so the break is unverified and unfixed. The only handoff is a bold "**Note for 03-15**" paragraph buried in "Selector changes". It is not a "For 03-15" section, and the 03-15 plan says it applies "every "For 03-15" selector line". The break also lands well before 03-15 (wave 6). Several earlier plans run this spec as an automated gate, and none of them reads the 03-06 summary (`grep -c 03-06-SUMMARY` = 0 in each):
- 03-08 (wave 3, `03-08-PLAN.md:130`)
- 03-09 (wave 3, `03-09-PLAN.md:102`)
- 03-13 (wave 5, `03-13-PLAN.md:90`; 03-13 also owns that spec's edits)

After 03-06 merges, these gates fail on a test their own change did not touch. The likely result is a wrongly attributed failure, or an out-of-scope "fix" by those executors. 03-06's plan did not prohibit editing `phone-native.spec.ts` (only `rules.spec.ts`). Its read_first also listed `e2e/tests/phone (grep 'Payees')`, so the plan expected the phone selectors to be handled here.
**Fix:** Either update the three lines in this plan and run `npm --prefix e2e test -- --project=phone tests/phone/phone-native.spec.ts`:
```ts
const corner = page.getByRole('checkbox', { name: 'Select Corner Grocery' });
await corner.locator('xpath=ancestor::label[1]').click();
await expect(corner).toBeChecked();
// same for 'Select Streamflix Premium' and merge.getByRole('radio', { name: /Corner Grocery/ })
```
or have the orchestrator add this line to the read_first of 03-08, 03-09 and 03-13, and rename the summary note to a `## For 03-15` heading (better still, `## For 03-08 / 03-09 / 03-13`). Use the shared helper from WR-07 either way.

## Warnings

### WR-01: rules.spec.ts is red at this HEAD; must-have 5 is not met

**File:** `client/src/components/rules/ApplyRulesModal.tsx:162-168` → `e2e/tests/rules.spec.ts:61`
**Issue:** Must-have truth 5 says "payees.spec.ts and rules.spec.ts pass in the desktop project". By the executor's own run, `rules.spec.ts` test 1 fails at line 61 (`.uncheck()` on the new Checkbox). The plan's acceptance criteria accept "or the summary lists the lines left for 03-07". 03-07 does consume that list (`03-07-PLAN.md:119,122`, depends on 03-06), so the handoff itself is sound. Still, the branch carries a red desktop spec until 03-07 lands, and coverage D3 in the summary is honestly marked `status: fail`. The orchestrator must not count must-have 5 as satisfied, and the G2 PR must not be cut between 03-06 and 03-07.
**Fix:** No code change in 03-06 (the edit is prohibited). Record must-have 5 as "deferred to 03-07". Gate wave 3 on `rules.spec.ts` passing after 03-07.

### WR-02: New behaviour shipped instead of raised (D-15); the Rules clear button has no test

**File:** `client/src/pages/Payees.tsx:197-206`, `client/src/pages/Rules.tsx:304-313`, `Payees.tsx:124-126,292,391`
**Issue:** D-15 allows a screen move to change "only which component draws the field … Anything else that would change is a finding to raise, not a change to make." The base had no clear button on either search field, and the renames had only `autoFocus`, no selection; the diff's `-` lines show both. Yet the diff adds:
- (a) a new "Clear search" button on Payees and on Rules;
- (b) select-all-on-focus on both rename fields;
- (c) an indeterminate dash on three select-all boxes.

The plan's wording ("clear button kept", "keeping … select on focus", "same … indeterminate state") assumed these already existed. The executor implemented the plan's false premise instead of raising the gap. UI-SPEC §4.3 calls the clear button "optional". The Rules clear button and the Rules search have no e2e coverage at all: `grep 'Search rules'` in `e2e/` finds nothing. CLAUDE.md ranks new behaviour without a test as P1.
**Fix:** Record (a), (b) and (c) under "Findings for the owner" in the summary, so the owner accepts or reverts them. If they are kept, add a Rules test: fill the search, assert the filter, click `Clear search`, and assert all rules show and the field is empty.

### WR-03: Clearing the search drops keyboard focus to `<body>`

**File:** `client/src/pages/Payees.tsx:197-206`, `client/src/pages/Rules.tsx:304-313`
**Issue:** The clear button renders only while `search` is non-empty. Clicking it (or pressing Enter/Space on it) sets `search` to `''`, which unmounts the focused button. Focus falls to `document.body`, so a keyboard or screen-reader user loses their place in the toolbar. This is new code; the same flaw exists in `TransactionFilters.tsx:394`, but that is not a reason to copy it.
**Fix:** Give the Input a ref and refocus it after clearing:
```tsx
const searchRef = useRef<HTMLInputElement>(null);
…
<Input ref={searchRef} … />
<button onClick={() => { setSearch(''); searchRef.current?.focus(); }} …>
```
Add the focus assertion to the clear-search test.

### WR-04: Search-with-clear markup is now in three hand-written copies

**File:** `client/src/pages/Payees.tsx:183-207`, `client/src/pages/Rules.tsx:290-314` (third copy: `client/src/components/transactions/TransactionFilters.tsx:382-404`)
**Issue:** The Payees and Rules blocks are byte-identical: the icon classes, `pl-8 pr-8 max-md:pr-11`, and the clear button with `md:h-8 md:w-8 max-md:min-h-11 max-md:min-w-11`. UI-SPEC §4.3 lists five filter bars that need this exact pattern (TransactionFilters, Files, Rules, Payees, Budget). CLAUDE.md says: "One implementation per behaviour … A parallel version of logic that exists is P1", and asks what the next 50 changes will do. Every later filter-bar plan will paste a fourth and fifth copy, and a fix like WR-03 then has to land in five places.
**Fix:** Extract one shared `SearchField` (wrapping `Input fieldSize="sm"`, the icon, the clear button with refocus, and an `aria-label`) under `components/ui/`, and use it on both screens. If wave isolation forbids touching `ui/`, raise it as a finding for the phase owner and keep a single local component until then.

### WR-05: ApplyRulesModal's first cell is now a click dead zone

**File:** `client/src/components/rules/ApplyRulesModal.tsx:162`
**Issue:** Before this change, `stopPropagation` sat on the `<input>`, so a click on the `<td>` padding around the checkbox bubbled to `<tr onClick>` and toggled the row. Now `<td onClick={(e) => e.stopPropagation()}>` swallows every click in the cell. The checkbox's label is `inline-flex` and does not fill the 12 px × 8 px padded cell, so clicks in that padding do nothing, while the rest of the row still toggles. This is a behaviour change on the row's own click target (D-15).
**Fix:** Stop only the clicks that come from the checkbox's label, so cell padding keeps toggling the row:
```tsx
<td className="px-3 py-2" onClick={(e) => { if ((e.target as HTMLElement).closest('label')) e.stopPropagation(); }}>
```
Alternatively, make the label fill the cell (`className="align-middle w-full h-full"` with the padding moved onto the label).

### WR-06: Paused-save gate added to Apply rules without a test

**File:** `client/src/components/rules/ApplyRulesModal.tsx:43,191,197`
**Issue:** Adding `useCanSave()`/`<SavingPausedHint />` is correct per CLAUDE.md §Client, and the summary records it as deviation 1. It is still new behaviour: Apply is disabled and a hint shows while the connection is down. Nothing tests either the allowed or the refused case. `connection.spec.ts` covers Payees rename (`:177,190`) but not this dialog. CLAUDE.md: "New behaviour and every bug fix come with a test that fails without the change."
**Fix:** Extend `connection.spec.ts` with the existing pause helper. Open Apply rules, pause the connection, and assert that `Apply to N transactions` is disabled and "Saving is paused until Allotment reconnects." is visible. Then reconnect and assert Apply is enabled again.

### WR-07: `toggleTarget` copies `first-run.spec.ts`'s `switchTarget` instead of sharing it in fixtures

**File:** `e2e/tests/payees.spec.ts:30-31` (copy of `e2e/tests/first-run.spec.ts:18`)
**Issue:** The same `xpath=ancestor::label[1]` helper now exists twice under different names. The summary tells 03-07 and 03-15 to inline it a third and fourth time (`rules.spec.ts:61`, `phone-native.spec.ts:309-314`). Every spec that touches a shared Checkbox, Radio or Switch will need it, and `e2e/tests/fixtures.ts` is where the shared interaction helpers already live (`chooseOption`, `fillDate`, `categoryOption`). Duplicated lists and helpers are P1/P2 drift under CLAUDE.md.
**Fix:** Export `toggleTarget(control: Locator)` (or `setToggle(control, on)`, which clicks the label and asserts the checked state) from `e2e/tests/fixtures.ts`. Import it in `payees.spec.ts` and point the 03-07 and phone handoffs at it. Replacing `first-run.spec.ts`'s local copy can wait for a plan that owns that spec.

### WR-08: The Escape-cancel test can pass even if Escape saves

**File:** `e2e/tests/payees.spec.ts:121-131`
**Issue:** After `fill('Should Not Save')` and `press('Escape')`, the only negative check is `expect(row(page, 'AMZN Mktp')).toBeVisible()`. That passes immediately, before any rename request could have returned. The final API poll expects `['Amazon', 'Amazon Marketplace']`, and that result is the same whether or not a stray `Should Not Save` PATCH happened in between. The test catches a regression only if the stray save happens to land before the second `Rename AMZN Mktp` click, so it is race-dependent.
**Fix:** Assert the server state directly after Escape, before renaming again:
```ts
await input.press('Escape');
await expect(input).toBeHidden();
expect((await api.call<any[]>('GET', '/payees')).map((p) => p.name).sort()).toEqual(['AMZN Mktp', 'Amazon']);
```
Or count PATCH requests to `**/api/payees/*` with the existing `intercept` helper and expect 0.

## Info

### IN-01: `items-center` on the phone "Select all" Checkbox has no effect

**File:** `client/src/pages/Payees.tsx:257`
**Issue:** Checkbox's own label classes include `items-start`. Tailwind v4 emits `.items-start` after `.items-center` (in the built `client/dist/assets/index-rnYfPT_Q.css`: `.items-center` at byte 37791, `.items-start` at 37856), so the caller's `items-center` loses. `gap-3` and `text-text-secondary` do win, so the visible result is still fine: a 20 px box beside a 20 px text line. This is a dead class that implies an alignment the code does not get.
**Fix:** Drop `items-center` from the className, or add an `align` prop to the shared Checkbox if centring is ever needed.

### IN-02: Search fields' accessible names changed from the placeholder to a new aria-label

**File:** `client/src/pages/Payees.tsx:194`, `client/src/pages/Rules.tsx:301`
**Issue:** The audit row says "none: placeholder only, 'Search payees…'". The computed name was therefore "Search payees…" and is now "Search payees" (Rules likewise). D-15 says "accessible names stay the same". This is a harmless improvement, and the specs use `getByPlaceholder`, which still matches. It should still be recorded as a deliberate name change.
**Fix:** List both under "Findings for the owner" or "Behaviour changes" in the summary.

### IN-03: Select-all now counts only the visible selection

**File:** `client/src/pages/Payees.tsx:132-137`
**Issue:** Before, select-all was checked when `selected.size === filtered.length`. That was wrong when hidden payees were selected: one hidden selected payee plus a one-row filter showed "all selected". Now it compares the visible selection only. This fixes a real mis-report, but it is a behaviour change beyond D-15. It is recorded in the summary as a "decision", not raised as a finding. Unchanged and still true: checking select-all replaces any hidden selection, and unchecking it clears hidden selections too.
**Fix:** Move it to "Findings for the owner", and add a test: select one payee, filter it out, and assert the select-all state.

### IN-04: Already-defended-elsewhere — two mechanisms select the rename text

**File:** `client/src/pages/Payees.tsx:124-126` (plus `:292`, `:391`)
**Category:** necessity
**Issue:** The rename field selects its text twice: through `onFocus={(e) => e.currentTarget.select()}` and again through a `useEffect` on `editingId` that calls `renameInputRef.current?.select()`. React's `autoFocus` focuses the field on mount, and that focus fires `onFocus`, which already selects the text. On that reading the effect and the shared `renameInputRef` are redundant. This rests on React's autoFocus firing `onFocus`, which I believe but did not prove in a browser, hence Info. The `onFocus` version also reselects all the text on every later refocus, such as returning to the window.
**Fix:** Keep one mechanism, preferably the effect plus ref, which selects once per edit. Remove `onFocus` and keep the selection assertion at `payees.spec.ts:114-120`.

---

### Counts by severity

- **Critical: 1**
  - CR-01 `e2e/tests/phone/phone-native.spec.ts:309` (caused by `client/src/pages/Payees.tsx:262-275`, `:46-72`)
- **Warning: 8**
  - WR-01 `client/src/components/rules/ApplyRulesModal.tsx:162` → `e2e/tests/rules.spec.ts:61`
  - WR-02 `client/src/pages/Payees.tsx:197`, `client/src/pages/Rules.tsx:304`, `client/src/pages/Payees.tsx:124`
  - WR-03 `client/src/pages/Payees.tsx:197`, `client/src/pages/Rules.tsx:304`
  - WR-04 `client/src/pages/Payees.tsx:183`, `client/src/pages/Rules.tsx:290`
  - WR-05 `client/src/components/rules/ApplyRulesModal.tsx:162`
  - WR-06 `client/src/components/rules/ApplyRulesModal.tsx:197`
  - WR-07 `e2e/tests/payees.spec.ts:30`
  - WR-08 `e2e/tests/payees.spec.ts:121`
- **Info: 4** (IN-04 is a necessity finding)

_Reviewed: 2026-11-19T04:05:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
