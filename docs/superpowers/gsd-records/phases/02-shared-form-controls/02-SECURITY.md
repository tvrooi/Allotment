---
phase: "2"
slug: "shared-form-controls"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-18"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register from the 20 PLAN `<threat_model>` blocks plus 3 SUMMARY Threat Flags; verified by
> gsd-security-auditor (read-only) at `db27e5a`, `block_on: high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Dev controls gallery → app | `/dev/controls` renders outside AuthGate in `npm run dev` only; absent from default, electron and demo builds | Sample data; the CategoryPicker create can reach `POST /api/categories` via the dev proxy (T-02-10) |
| Shared controls → screens | Shared Field/Input/Select/Combobox/DatePicker/SearchList used by money, date and category entry | User-entered amounts, dates, payees and categories (integer minor units unchanged) |
| npm registry → checkout | Dependency installs in client, e2e, lint and CI | Packages; lockfiles plus `ignore-scripts=true` (T-02-SC) |
| Baseline container → screenshots | Official Playwright image renders gallery baselines | Checkout mounted read-only; only `--update` writes the baseline folder (T-02-11) |
| Evidence and docs → public PRs | Audit docs and screenshots in PRs #275/#277 | Labels and file:line only; `.ui-evidence/` gitignored |

---

## Threat Register

Status column is the verified status; Evidence gives the mitigation found (file:line) or the documented rationale.

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence (file:line or rationale) |
|---|---|---|---|---|---|---|
| T-02-01 | Information disclosure | Audit rows and examples | low | mitigate | CLOSED | `docs/ui/FORM-CONTROLS-AUDIT.md`: every row cites `client/src/...:line` (617 source rows), there are no URLs, hostnames or values, and credential rows give only labels and types (e.g. lines 480, 524-526). No scanner was committed (no added file outside ui/gallery/tests, per `git diff --name-status d18b270 HEAD`). |
| T-02-02 | Tampering | Source change in a documentation PR | medium | mitigate | CLOSED | PR #275 (MERGED, squash `fea7122`) changed exactly `docs/ui/FORM-CONTROLS-AUDIT.md` and `docs/ui/HANDOVER-UI.md` (`git show --stat fea7122`, `gh pr view 275 --json files`). |
| T-02-SC (02-01) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-03 | Information disclosure | Screenshots | medium | mitigate | CLOSED | `.gitignore:52` ignores `.ui-evidence/` (`git check-ignore -v`); `git ls-files .ui-evidence` is empty; the PR #277 file list (152 files, paginated) has no `.ui-evidence/` path. |
| T-02-04 | Information disclosure | Sign-in and bank credential audit rows | low | mitigate | CLOSED | `docs/ui/FORM-CONTROLS-AUDIT.md:51,480,512,524-526` record only the attribute type and label text, and no credential, token or hostname appears in the document. |
| T-02-05 | Tampering | Source change or stray spec in a docs PR | medium | mitigate | CLOSED | #275 has 2 docs files only. No stray spec: the only e2e files added outside `tests/gallery/` are `gallery-absent.spec.ts` and `gallery-baselines.sh` (both planned in 02-04/02-15). `git status` is clean for `e2e`, `client` and `server`. |
| T-02-SC (02-02) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-06 | Tampering | Pushing content that should not leave the machine | medium | mitigate | CLOSED | #275 head `docs/wave-g0-audit` holds exactly the two named files. `docs/superpowers/gsd-records/` reached `origin/redesign` in phase 01 (`b886cfc`, 16 Nov), not this phase, and was removed by #276 (`6d4e538`). PR #277's 152 files have no `docs/superpowers/gsd-records/` path. |
| T-02-07 | Elevation of privilege | Building or merging without the owner | high | mitigate | CLOSED | `02-03-PLAN.md:136` `<task type="checkpoint:decision" gate="blocking-human">`. The record is at `02-03-SUMMARY.md:27-31` (`Owner gate: go-with-changes`, `Changed decisions: D-11`, owner's verbatim answer at :36). The precondition is at `02-04-PLAN.md:164` (rerun now: prints `gate-ok`). Every later build plan depends on 02-04 through `depends_on` (02-15→02-04, and the chain onward). |
| T-02-08 | Repudiation | PR body or record not matching the owner | low | mitigate | CLOSED | Fixed record lines are at `02-03-SUMMARY.md:27-31`, with the changed decision id named verbatim (`D-11`) and the owner's words quoted at :36. |
| T-02-SC (02-03) | Tampering | npm installs | high | mitigate | CLOSED | No install by this plan; shared SC evidence above. |
| T-02-09 | Information disclosure | `/dev/controls` in a shipped build | medium | mitigate | CLOSED | The stub swap is at `client/vite.config.ts:115-129`, applied at `:136` when `command === 'build' && mode !== 'gallery'` (it covers the default, electron and demo builds), with `client/src/pages/DevControlsGallery.stub.ts` returning null. The route gate is `client/src/App.tsx:43` (`DEV \|\| MODE === 'gallery'`) and `:71`. `e2e/tests/gallery-absent.spec.ts:9-19` checks the built app. The current `client/dist` (built 18 Nov) has 0 files containing "Controls gallery". |
| T-02-10 | Elevation of privilege | Gallery route outside `AuthGate` | low | mitigate | **OPEN (non-blocking, below high)** | The claim "The page fetches nothing … No API route, cookie or token is touched" does not hold. The gallery renders `CategoryPicker` (`client/src/pages/devGallery/PickerCards.tsx:146-160`, `DialogCard.tsx:2`), whose inline create calls `useCreateCategory` (`client/src/components/transactions/CategoryPicker.tsx:163,173`), which sends `POST /categories` through `apiFetch` (`client/src/api/categories.ts:34-39`). On the dev server, `/api` is proxied to the local server (`client/vite.config.ts:149-156`), and `client/src/main.tsx:53` provides the QueryClient, so the mutation runs. `PickerCards.tsx:139-140` itself says "a create fails unless a spec answers the request". The parts that do hold: it is dev and gallery builds only (see T-02-09), it reads no budget, and the server still enforces auth, so there is no actual privilege gain. The stale claim is also at `client/src/pages/DevControlsGallery.tsx:21`. |
| T-02-SC (02-04) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-13 | Denial of service | Keyboard users losing focus visibility | medium | mitigate | CLOSED | `client/src/index.css:367-372` puts the global ring in `@layer base`. Browser tests: `e2e/tests/accessibility.spec.ts:240` (field and Button), `:285` (rule editor), `:208` (chart), and `e2e/tests/menus.spec.ts:50` (context menu item). |
| T-02-14 | Tampering | Chart CSS overriding the layered rule | low | mitigate | CLOSED | The unlayered chart rule is at `client/src/index.css:399-401`; the phase diff of `index.css` changes only the base-layer block and its comment. Chart focus test: `e2e/tests/accessibility.spec.ts:208`. |
| T-02-SC (02-05) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-15 | Tampering | Field text rendered back to the page | low | mitigate | CLOSED | Zero matches for `dangerouslySetInnerHTML\|innerHTML\|outerHTML\|insertAdjacentHTML` in `client/src/components/ui/`, `CategoryPicker.tsx`, `PayeeCombobox.tsx`, `DevControlsGallery.tsx`, `devGallery/` and `utils/inertRoot.ts`. |
| T-02-16 | Tampering | Money through a generic field | medium | mitigate | CLOSED | CurrencyInput was not rebuilt (its only change is one placeholder class, `CurrencyInput.tsx:109`). The test `client/src/components/ui/CurrencyInput.test.ts:22-25` pins `type="text"` and `inputMode="decimal"`. The prohibition is in `02-06-PLAN.md:71`, `docs/ui/MAP.md:108` ("the only money input") and CLAUDE.md "Client". |
| T-02-17 | Information disclosure | Password fields on the shared Input | low | mitigate | CLOSED | `client/src/components/ui/Input.tsx:23-26` spreads `...props` (type and autoComplete pass through), and `Input.test.ts:39-46` pins `type="password"`. No logging or storage in the component. |
| T-02-SC (02-06) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-18 | Tampering | Option labels in listbox and native select | low | mitigate | CLOSED | No raw HTML insertion (T-02-15 grep). `onChange` receives only the selected key or option value: `client/src/components/ui/Select.tsx:131-132` (React Aria key from the caller's items) and `:237-238` (native `e.target.value`). |
| T-02-19 | Spoofing | Auto-selecting the only option | low | mitigate | CLOSED | `e2e/tests/gallery/select.spec.ts:89` ("one option is listed but never chosen") and `e2e/tests/gallery/combobox.spec.ts:216-217`. |
| T-02-SC (02-07) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-20 | Tampering | Wrong calendar day saved | medium | mitigate | CLOSED | `client/src/components/ui/DatePicker.tsx:183-186` emits `CalendarDate.toString()` or `''` when incomplete, and `:279` sets `todayIso()` for Today. The lint rule `lint/eslint.config.js:48-61` bans `toISOString().slice`. Clocks are fixed in `e2e/tests/gallery/dates.spec.ts:63,79,253`, with bounds tests at `:95` and `:269`. |
| T-02-21 | Tampering | Segment order differing from displayed dates | medium | mitigate | CLOSED | `client/src/components/ui/dateSegments.ts:27` (`segmentLocale`). `dateSegments.test.ts:6-12` covers all five preferences, and `:19` checks that the default is day first. Unit run: passed. |
| T-02-SC (02-08) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-23 | Tampering | Payee names in suggestion list | low | mitigate | CLOSED | No raw HTML insertion in `ui/Combobox.tsx` or `PayeeCombobox.tsx` (T-02-15 grep). |
| T-02-SC (02-09) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-24 | Tampering | Category or transfer not chosen by the person | high | mitigate | CLOSED | The pure functions are `client/src/components/transactions/CategoryPicker.tsx:22` (`categorySections`), `:51` (`categoryKeyboardOrder`) and `:63` (`categoryListEmpty`), unit-tested in `CategoryPicker.test.ts:55,101-133` (run: passed). Characterisation tests: `e2e/tests/transactions.spec.ts:1277-1346` (Enter with nothing typed, no-category row while searching, ArrowDown→Enter, click outside, Escape in dialog). Gallery: `e2e/tests/gallery/pickers.spec.ts:19,36,90,108`. |
| T-02-26 | Tampering | Category and account names in list | low | mitigate | CLOSED | No raw HTML insertion (T-02-15 grep). |
| T-02-SC (02-10) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-27 | Information disclosure | Baseline images | low | mitigate | CLOSED | The gallery uses fixed sample constants (`devGallery/PickerCards.tsx:86-126`, `ComboboxCard.tsx` `PAYEES`/`ACCOUNTS`, pinned `CREATED` date) and reads no budget (no query hooks or fetch in `DevControlsGallery.tsx` or `devGallery/`). The one exception is the user-initiated create path in T-02-10, which never feeds a baseline. The "looked at before commit" step is process (recorded in the PR #277 body). |
| T-02-28 | Denial of service | Flaky screenshot checks | medium | mitigate | CLOSED | `e2e/playwright.config.ts:36` (`animations: 'disabled'`), with fonts awaited at `e2e/tests/gallery/gallery.ts:35,64`. Clocks are pinned (`matrix.spec.ts:95,123`, `overlays.spec.ts:25`). Pixel tests run on Linux only (`gallery.ts:48`). There is no `maxDiffPixels` or `threshold` under `e2e/tests/gallery/`. |
| T-02-29 | Tampering | Escape closing a dialog and discarding a form | medium | mitigate | CLOSED | `e2e/tests/gallery/overlays.spec.ts:109-126` runs over `IN_DIALOG` with 7 controls (Select, Combobox, DatePicker, MonthPicker, MonthRangePicker, PayeeCombobox, CategoryPicker) and asserts the dialog survives the first Escape and `#root` stays inert. The control fix is `client/src/utils/inertRoot.ts:10-25` (`keepInert`). |
| T-02-SC (02-11) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-30 | Information disclosure | Evidence screenshots and PR body | medium | mitigate | CLOSED | `.ui-evidence/` is ignored and untracked (T-02-03). The PR #277 body's Evidence section lists image file names and descriptions only, and none of its 152 files is under `.ui-evidence/`. |
| T-02-31 | Tampering | Pushing content that should not leave the machine | medium | mitigate | CLOSED | The PR #277 file list (152, paginated through `gh api`) has no `docs/superpowers/gsd-records/`, `.ui-evidence/`, `.omc/` or `server/` path. The PR head `aefe89a` is a separate branch from `origin/redesign`, not the local `redesign`. |
| T-02-32 | Elevation of privilege | Releasing or merging without the owner | high | mitigate | CLOSED | PR #277 is OPEN (`mergedAt: null`) and issue #267 is OPEN. No `v0.2.0-up.175` tag exists locally or on origin (`git ls-remote --tags`). The record is at `docs/superpowers/gsd-records/STATE.md:81` ("Do not tag, publish or update the live app from `redesign` until the owner decides"). |
| T-02-33 | Repudiation | PR body claims not matching what ran | low | mitigate | CLOSED | The PR #277 body's "Checks run on Node 24" table (Node 24.10.0) lists each command with its result. The "Changed e2e selectors, each with its reason" section lists every selector change with the file and line. |
| T-02-SC (02-12) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. The only version-string change is from `release:prepare` (`package.json`, `package-lock.json`, `homeassistant/config.yaml`). |
| T-02-34 | Tampering | Labels and `errorLabel` in toggles | low | mitigate | CLOSED | No raw HTML insertion. `requiredMessage` is a pure function at `client/src/components/ui/fieldMessages.ts:15-17`, tested in `fieldMessages.test.ts:17`. |
| T-02-35 | Tampering | Required toggle state not shown | low | mitigate | CLOSED | `client/src/components/ui/Checkbox.tsx:50-54,93` builds the default line and renders it when invalid (Switch is the same, through `fieldMessages`). Unit tests: `Checkbox.test.ts:92,98` and `Switch.test.ts:155,167,176,188` (aria-describedby). Browser tests: `e2e/tests/gallery/toggles.spec.ts:69,178` and `switch.spec.ts:86,104`. |
| T-02-SC (02-13) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-36 | Tampering | Reversed or half-typed range saved | medium | mitigate | CLOSED | `client/src/utils/dateRange.ts:145` (`pickRangeMonth`) is used at `client/src/components/ui/MonthRangePicker.tsx:119,182`, and a cleared input (`''`) is refused (`:116-120`). The fast-check properties at `client/src/utils/dateRange.test.ts:240-280` cover isMonth, from <= to, to <= max, and leaving the range unchanged for a non-month or a month after max. Unit run: passed. |
| T-02-37 | Tampering | Rebuilt picker changing report or cash flow months | medium | mitigate | CLOSED | `e2e/tests/reports.spec.ts` and `report-drill-through.spec.ts` are unchanged against `d18b270`. The cash-flow test `e2e/tests/cash-flow.spec.ts:95-135` (CSV name `cash-flow-<from>-<to>.csv`) landed in `fdf2072`, an ancestor of the rebuild commit `f197f77`. |
| T-02-SC (02-14) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-11 | Tampering | Baseline container image | low | accept | CLOSED | The accept rationale is documented in `02-15-PLAN.md` (the T-02-11 row) and `02-15-SUMMARY.md:287-289`. It matches the code: the official `mcr.microsoft.com/playwright:v${version}-noble` image is pinned to the exact `@playwright/test` version (`e2e/gallery-baselines.sh:35-40`, with `e2e/package.json:12` at `1.64.0`). The digest is printed (`:46`), the checkout is mounted `:ro` (`:48`), and only `--update` mounts the baseline folder for writing (`:49-52`). No SECURITY.md accepted-risks log exists yet; the orchestrator must add this entry. |
| T-02-12 | Denial of service | Flaky screenshot check blocking every PR | medium | mitigate | CLOSED | Same evidence as T-02-28, plus amd64 Linux to match CI (`e2e/gallery-baselines.sh:41-42`). No tolerance is configured. |
| T-02-38 | Tampering | Welcome switch looking on while disabled | low | mitigate | CLOSED | `client/src/components/ui/Switch.test.ts:55-70` checks a disabled switch has no `bg-brand-` and no `opacity-`. `e2e/tests/gallery/switch.spec.ts:73` covers the dark theme. In `e2e/tests/first-run.spec.ts`, only the click and measure target changed (`switchTarget`), and its reason is recorded in the PR #277 body and 02-15-SUMMARY. |
| T-02-SC (02-15) | Tampering | npm installs (host and container) | high | mitigate | CLOSED | Shared SC evidence above, plus `npm_config_ignore_scripts=true` and `--ignore-scripts` in the container (`e2e/gallery-baselines.sh:60,67-68`). |
| T-02-39 | Repudiation | Default message naming no field | medium | mitigate | CLOSED | `client/src/components/ui/fieldMessages.ts:46-49` (`FieldNames` requires at least one name) and `:56-60` (`fieldSubject`). `fieldMessages.test.ts:87` checks that nothing says "undefined". It is imported by Checkbox, Combobox, Field, DatePicker, MonthPicker, RadioGroup, Select and Switch. Residual: a caller passing only empty strings gets `''`, which reads "Select  to continue" (see `:58`). That is not "undefined" and is outside the declared vector. |
| T-02-40 | Tampering | Textarea values and messages rendered | low | mitigate | CLOSED | No raw HTML insertion (T-02-15 grep covers `ui/Textarea.tsx`). |
| T-02-SC (02-16) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-41 | Repudiation | Negative row assertion left on button role | medium | mitigate | CLOSED (role vector) | Every row locator goes through `categoryOption`, which returns `getByRole('option', …)` (`e2e/tests/fixtures.ts:236-242`). Negative sites are listed in `02-17-SUMMARY.md:59-72` (review.spec.ts:56 named as negative) and `02-20-SUMMARY.md:61` (polish.spec.ts:193). The remaining `getByRole('button', { name: 'Groceries' })` at `transactions.spec.ts:1292` is the category trigger, not a row. See T-02-44 for the same check being vacuous by name. |
| T-02-SC (02-17) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-42 | Tampering | (continues T-02-24) Category set the person did not choose | high | mitigate | CLOSED | The wrapper reads its rows and keyboard order from the same pure functions (`CategoryPicker.tsx:114,132`). Popover clicks are contained by `client/src/components/ui/Combobox.tsx:595` (`onClick={e => e.stopPropagation()}`), with Enter/Escape handling at `:394` and `:529`. The characterisation tests (`transactions.spec.ts:1277-1346`) are unchanged apart from `categoryOption`. |
| T-02-25 | Tampering | Inline create submitting the surrounding form | medium | mitigate | CLOSED | `client/src/components/ui/Button.tsx:44` defaults `type = 'button'`, and no picker button passes `submit`. The create input's Enter key calls `preventDefault` (`CategoryPicker.tsx:235-238`). The mutation arguments `{groupId, name, budgetType}` (`:173-178`) are identical to base `d18b270:CategoryPicker.tsx:163-168`. Guard test `e2e/tests/recurring.spec.ts:89-96`; pending, failure and success at `e2e/tests/gallery/pickers.spec.ts:220,237,252`. |
| T-02-44 | Repudiation | (continues T-02-41) Negative assertion passing vacuously | medium | mitigate | **OPEN (non-blocking, below high)** | The mitigation's proof failed at the named check. `02-18-SUMMARY.md:223-233,252`: a mutation that ignores the search while it matches still **passed** `review.spec.ts`. The check `e2e/tests/review.spec.ts:56` is `expect(categoryOption(page, 'Rent', { exact: true })).toHaveCount(0)`, but the e2e budget uses the `default` template (`e2e/global-setup.ts:64`, `FLYBUDGET_CATEGORY_TEMPLATE: 'default'`), whose category is `Rent / Mortgage` (`server/src/db/defaultCategories.ts:49`). There is no row named exactly `Rent`, so the check can never fail. It is still at HEAD. The filter itself remains guarded elsewhere (`review.spec.ts:36` empty line, the `categorySections` unit tests, and the gallery mixed-case test), so the risk is limited to this check. |
| T-02-SC (02-18) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-22 | Tampering | Rewired payee field saving a different payee | medium | mitigate | CLOSED | `client/src/components/transactions/PayeeCombobox.tsx:71` (typing reports `{ id: null, name }`) and `:79` (a pick reports the payee's id and name). Characterisation tests: `e2e/tests/transactions.spec.ts:1106-1261` ("the payee field": Enter, Escape, ArrowDown). Non-ASCII names: `PayeeCombobox.test.ts:21,28` (`Bäckerei Müller`, `Corner Café`). Unit run: passed. |
| T-02-43 | Tampering | (continues T-02-29) Escape closing the phone sheet | medium | mitigate | CLOSED | D-12 is at `PayeeCombobox.tsx:83-84`. `e2e/tests/transactions.spec.ts:1225-1259` checks the list closes, the sheet stays open and saves (`payeeName: 'Corner'`), and then the negative case: with the list closed, Escape closes the sheet. The gallery dialog case is in T-02-29. |
| T-02-SC (02-19) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| T-02-45 | Repudiation | (continues T-02-41) Vacuous no-category negative check | medium | mitigate | CLOSED | `e2e/tests/polish.spec.ts:193` `categoryOption(page, 'Uncategorised')` targets a real row label: the picker's default `noneLabel = 'Uncategorised'` (`CategoryPicker.tsx:300`, rendered at `:129`). It is listed as negative at `02-20-SUMMARY.md:61`. |
| T-02-SC (02-20) | Tampering | npm installs | high | mitigate | CLOSED | Shared SC evidence above. |
| FLAG-02-06 (origin: 02-06-SUMMARY.md:201 Threat Flags) | — | "None. No raw HTML insertion, no new network or storage surface" | — | informational | CLOSED (maps to T-02-15, T-02-17) | No new surface; the T-02-15 and T-02-17 evidence holds. |
| FLAG-02-07 (origin: 02-07-SUMMARY.md:263 Threat Flags) | — | "None", citing T-02-18, T-02-19, T-02-SC | — | informational | CLOSED (maps to T-02-18, T-02-19, T-02-SC) | Mapped; no unregistered flag. |
| FLAG-02-16 (origin: 02-16-SUMMARY.md:163 Threat Flags) | — | "None", citing T-02-39, T-02-40, T-02-SC | — | informational | CLOSED (maps to T-02-39, T-02-40, T-02-SC) | Mapped; no unregistered flag. |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Open below threshold (non-blocking, follow-up):**
- **T-02-10 (low):** the gallery's CategoryPicker create sends `POST /api/categories` through the dev proxy
  (`client/src/pages/devGallery/PickerCards.tsx:139-160`); the "fetches nothing" mitigation and
  `DevControlsGallery.tsx:21` comment do not hold. Server auth still applies; dev-only. Fix: offline create in
  the gallery, or amend the mitigation text.
- **T-02-44 (medium):** `e2e/tests/review.spec.ts:56` negative check targets `'Rent'`, which the e2e budget does
  not have (`Rent / Mortgage`), so it is vacuous. Fix: target `'Rent / Mortgage'` and rerun 02-18's mutation.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-11 | Gallery baselines render in the official `mcr.microsoft.com/playwright:v<version>-noble` image pinned to the exact `@playwright/test` version, digest printed, checkout mounted read-only, baseline folder writable only with `--update` (`e2e/gallery-baselines.sh:35-52`). Rationale in 02-15-PLAN and 02-15-SUMMARY. | Plan 02-15 (owner-approved plan set) | 2026-11-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-18 | 65 (+3 flags) | 63 (+3) | 2 (below high) | gsd-security-auditor via hdispatch |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-18
