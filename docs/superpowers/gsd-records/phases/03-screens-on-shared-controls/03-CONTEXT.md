# Phase 3: Screens on shared controls - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Wave G steps G2 and G3 (#267), client only, no server change. On desktop, two groups of screens
stop using raw `<select>`, `<input>` and `<textarea>`, the old `ui/Input` `Select` and one-off
field classes, and use only the shared controls that Phase 2 builds in
`client/src/components/ui/`.

1. **G2 (WAVG-05):** Transactions, Accounts, Budget, Payees, Rules and Recurring.
2. **G3 (WAVG-06):** Goals, Forecast, Investments, Reports, Files and the import and export
   dialogs.

What the screens do does not change: entering, editing, filtering and saving give the same results.
Money is still typed in `CurrencyInput`, save buttons still pause when saving is paused, Safe mode
still hides amounts, each screen holds at 390 px, and the demo and offline modes keep working.

Not in this phase: building or restyling the shared controls themselves (Phase 2), Settings, the
bank connection sections, Review, Cash flow, Household and Tax (Phase 4), the lint rule, and the
removal of the old `Select` in `ui/Input.tsx` (Phase 4).

This phase was planned before Phase 2 was executed. The WAVG-01 audit and the shared controls do
not exist yet when these plans are written (see D-16).

</domain>

<decisions>
## Implementation Decisions

### Carried forward from Phase 2 (locked for all of Wave G)

The owner's decisions D-01 to D-11 are recorded in full in
`docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md`. They keep their numbers here. Read that
file for the wording and the reversibility ratings; the lines below say how each binds Phase 3.

- **D-01:** The shared controls are built on `react-aria-components`. Screens use the shared
  controls; a screen does not import React Aria directly to build its own field.
- **D-02:** No new package. No `cn()` helper, `clsx`, `tailwind-merge` or
  `class-variance-authority` arrives with a screen move.
- **D-03:** Today's field look, made consistent. A screen move deletes one-off field classes; it
  does not restyle the screen.
- **D-04:** One component API on every device. Under 768 px (`useIsPhone`) Select, DatePicker and
  MonthPicker render the native control. Screens do not branch on device themselves.
- **D-05:** On desktop the shared custom Select replaces the styled native Select. Picker rule:
  categories use `CategoryPicker`, payees use `PayeeCombobox`, every other list uses the shared
  Select or Combobox per D-06. Desktop e2e tests that used `selectOption` on a moved list change to
  the listbox pattern.
- **D-06:** Lists the user grows (accounts, tags, households, people and the like) are a
  searchable Combobox. Fixed lists (frequency, type, sort order and the like) are a plain Select.
  The audit's classification of each list is followed.
- **D-07:** Every `type="date"` field on a Phase 3 screen moves to the shared DatePicker with its
  screen. e2e tests fill dates through the shared helper Phase 2 adds.
- **D-08:** A date can be typed or picked on desktop; values stay `YYYY-MM-DD` strings (`isoDate`);
  displayed dates go through `client/src/utils/dates.ts`.
- **D-09:** [informational] Shelved pages and split candidates get a like-for-like swap only. This
  binds Phase 4; no Phase 3 screen is shelved.
- **D-10:** [informational] Phase 2's two-PR delivery and its owner checkpoint after the audit.
  Phase 3 does not start until Phase 2's set PR is merged to `redesign`.
- **D-11:** A `type="month"` field on a Phase 3 screen moves to the shared MonthPicker.

### Delivery
- **D-12:** Phase 3 ships as two PRs to `redesign`, G2 then G3, as #267 and the roadmap say. Each
  is an app change with its own next `0.2.0-up.N` (`npm run release:prepare`) and CHANGELOG entry.
  G3 does not start until G2 is merged.
- **D-13:** A sub-page or dialog moves in the PR of the screen that opens it (owner, 16 Nov 2026).
  Reconcile and an account's transactions go with Accounts; the annual budget, budget categories
  and category detail go with Budget; payee detail goes with Payees; the receipts dialogs go with
  the screen that opens them (Transactions in G2, Files in G3); the long-term forecast goes with
  Forecast; the custom report builder and widget view go with Reports. A screen with no parent in
  the Phase 3 lists (Dashboard, Payment plans, Welcome, the sign-in screens, the app shell) is not
  touched here; it moves in Phase 4 with the remaining screens.

### Number fields
- **D-14:** A `type="number"` field on a Phase 3 screen is fixed in that screen's PR (owner,
  16 Nov 2026): `CurrencyInput` (`type="text" inputMode="decimal"`) when it takes money, otherwise
  a shared field within the matching Zod cap. Each one that changes what can be typed gets a test
  that fails before the change. This is the one allowed behaviour change in Phase 3 and each is
  named in the PR. WAVG-08 stays a Phase 4 requirement: Phase 4 fixes the uses left on its own
  screens and proves none remain anywhere.
  — **Reversibility:** reversible — each field is a local change with its own test.

### What "nothing changes" means
- **D-15:** Apart from D-14, a screen move changes only which component draws the field. The same
  values are saved, the same validation and error text apply, the same field is focused first, the
  same keyboard submit works, accessible names stay the same, save buttons keep `useCanSave` and
  `<SavingPausedHint />`, and Safe mode still hides amounts. The visible differences are the ones
  D-03, D-05 and D-07 already accept: a consistent field look, a custom list instead of the native
  one on desktop, and the shared date control. Anything else that would change is a finding to
  raise, not a change to make.
- **D-16:** The plans were written before the WAVG-01 audit and the shared controls existed. Each
  PR therefore starts with a task that reads the audit and the shipped controls and checks the
  plan's file list, list classifications (D-06) and "must stay native" entries against them. Where
  the audit disagrees with a plan, the audit wins for classification. If the owner changed a Wave G
  decision after reading the audit (D-10 allows it), execution stops and the plan is revised first.
- **D-17:** A field that the audit says must stay native (a file input, for example) stays native
  and is listed in the PR, so Phase 4's lint allowlist can be built from those lists.

### Claude's Discretion
- **Missing variant or state.** If a screen needs something the shared set lacks (a dense size for
  a table filter, an inline-edit look), extend the shared control, with its gallery state and
  screenshot, rather than styling around it on the screen. The planner decides whether that is a
  task inside the screen's PR or a small PR to the set first.
- **`budget/ExpectedNote.tsx`.** If Phase 2 left it alone, it moves with Budget in G2.
- **Neighbour controls** (`SegmentedControl`, `Slider`, `IconPickerPopover`, `MonthRangePicker`,
  `CurrencyInput`): they are shared components already and are not replaced here, unless the audit
  or Phase 2 says otherwise.
- **How each PR is cut into plans** (per screen, per control type), and the order of screens
  inside a PR.
- **e2e changes.** Select by role or label, use the shared helpers from Phase 2, and give each
  changed selector its reason in the PR. No test is skipped, loosened or made to wait.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and rules
- `docs/superpowers/gsd-records/ROADMAP.md` §Phase 3 — goal and four success criteria; §Phase 2 and §Phase 4 for what
  is not done here
- `docs/superpowers/gsd-records/REQUIREMENTS.md` — WAVG-05, WAVG-06, WAVG-08 (for D-14) and "Done means, for every
  wave PR"
- `docs/superpowers/gsd-records/PROJECT.md` §Constraints — money, dates, dependencies, UI and process rules
- GitHub issue #267 (`gh issue view 267 --repo tvrooi/Allotment`) — the Wave G plan, "G2 to G4.
  Migration, by area, mechanical" and "Rules that bite". Where the issue and the CONTEXT files
  differ, the CONTEXT files win.
- `CLAUDE.md` §Review guidelines — client rules (`CurrencyInput`, `useCanSave`, accessible names,
  390 px), sibling paths (demo, offline, server mode), tests, releases, lint warning cap
- `docs/ui/WAVES.md` — how waves run and the traps on record

### Phase 2 outputs this phase builds on
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` — D-01 to D-11 in full
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md` — the control set's design contract:
  sizes, states, copy, focus ring, phone rule
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-RESEARCH.md` — React Aria findings, the e2e
  selector pitfalls, the picker wrappers
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-PATTERNS.md` — analog files and excerpts
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-*-PLAN.md` — where the audit document, the shared
  controls, the gallery and the e2e helpers will live (paths are set there)
- The WAVG-01 audit itself, once Phase 2 has produced it (D-16)

### UI
- `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md` — UI working guide
- `docs/ui/MAP.md` — each screen's page file, component folders, hooks and e2e specs; use it to
  apply D-13
- `DESIGN.md`, `client/src/index.css` `@theme`, `docs/BRAND.md`

### External
- React Aria Components documentation for the installed version (Select, ComboBox, DatePicker,
  TextField, Checkbox, RadioGroup, Switch) — how the shared controls behave under test

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The shared controls from Phase 2 in `client/src/components/ui/` (Input, Textarea, Select,
  Combobox, Checkbox, RadioGroup, Switch, DatePicker, MonthPicker, Label, Field), plus
  `CategoryPicker` and `PayeeCombobox` as wrappers over the shared Combobox.
- `client/src/components/ui/CurrencyInput.tsx`, `amountValidity.tsx` — money entry; the target for
  money `type="number"` fields (D-14).
- `client/src/hooks/useCanSave`, `<SavingPausedHint />`, `useAddTransaction()` — unchanged.
- The shared e2e date-fill helper and the listbox selection pattern that Phase 2 adds to `e2e/`.

### Established Patterns
- Shared components take a `className` string; classes are plain template strings (D-02).
- Menus inside animated or scrollable panels need `overflow-clip` (WAVES.md trap); React Aria
  popovers render in a portal, which matters for controls inside modals and table rows.
- e2e selects by role or label; e2e ports are fixed, so one browser run at a time.

### Integration Points
- Counts on `redesign`, 16 Nov 2026 (`.tsx`, tests excluded; raw = `<select>`, `<input>`,
  `<textarea>`; old = `ui/Input` `Select` + `Input`). The audit replaces these with the full table.
  - G2: `components/transactions` 54 raw (5 date, 1 number); `components/rules` 19 raw (1 date,
    1 number); `components/budget` 11 raw + 19 old (4 date, 2 number); `components/recurring`
    8 raw + 9 old (2 date, 2 number); `components/accounts` 8 raw; `components/payees` 1 raw.
  - G3: `components/investments` 4 raw + 18 old (5 date); `components/forecast` 15 old (4 date,
    2 number); `components/longterm` 11 raw + 18 old (1 number); `components/reports` 5 raw +
    2 old; `components/goals` 2 raw + 5 old; `components/files` 2 raw + 6 old (1 date);
    `components/receipts` 3 raw + 11 old (1 date).
  - `client/src/pages` holds 19 raw + 41 old (8 date) across all pages; split them by D-13.
- Wave F (Phase 1) changed Accounts and Budget files and split Settings. Until PR #273 is merged,
  that code is in `/Users/tristanvanrooyen/wt-f` on branch `wave-f`, not on `redesign`. The counts
  for accounts and budget are the same in both trees today. Phase 3 executes on `redesign` after
  #273 and Phase 2 are merged.
- Large files on the path: `components/transactions/ImportModal.tsx` (1147 lines),
  `components/longterm/LongTermForecast.tsx` (910 lines).

</code_context>

<specifics>
## Specific Ideas

- The owner wants each screen touched once: number fields are fixed with their screen (D-14), and
  sub-pages travel with their parent (D-13).
- "Today's look, unified" (Phase 2) still holds: a screen move is not a redesign.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Dashboard, Payment plans, Welcome, the sign-in
screens and the app shell are Phase 4 work by D-13, not a new idea.

</deferred>

---

*Phase: 03-screens-on-shared-controls*
*Context gathered: 2026-11-16*
