# Phase 2: Shared form controls - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Wave G steps G0 and G1 (#267, #264), client only, no server change:

1. **G0, the audit (WAVG-01).** A read-only audit of every field and selector in `client/src`, by
   file and line, with screenshots of each control type at 1280 and 390 px in light and dark.
2. **G1, the component set (WAVG-02 to WAVG-04).** One shared Input, Textarea, Select, Combobox,
   Checkbox, RadioGroup, Switch, DatePicker, MonthPicker (added by the owner, D-11), Label and Field
   in `client/src/components/ui/`, styled only from `@theme` tokens. `CategoryPicker` and
   `PayeeCombobox` become thin wrappers over the shared Combobox with unchanged behaviour. A
   development-only gallery shows every control in every state, with a Playwright screenshot test
   in CI.

Screens do not move onto the set in this phase, except the category and payee pickers through
their wrappers (success criterion 4). Phases 3 and 4 do the moves, the `type="number"` clean-up,
the lint rule and the removal of the old controls.

This discussion also settled the five owner decisions that #267 lists as its gate. Decisions 4 and
5 mostly bind Phases 3 and 4; they are recorded here because the G1 spec waited on them.

</domain>

<decisions>
## Implementation Decisions

### Primitives and packages (#267 decision 1)
- **D-01:** The set is built on `react-aria-components`, which is already a dependency
  (`client/package.json`, used by `ui/DatePicker.tsx` and `budget/ExpectedNote.tsx`). No Radix, no
  Base UI, no `cmdk`, and no shadcn source is copied in. #267's statement that no headless library
  is installed is out of date. One library does the keyboard and screen-reader work for every
  control.
  — **Reversibility:** costly — every shared control and both picker wrappers are written against
  React Aria's API; changing library means rewriting the set.
- **D-02:** No new package arrives in Wave G. `class-variance-authority`, `clsx` and
  `tailwind-merge` are not added. Variants are plain class maps, as `ui/Button` and the other
  shared components do today; React Aria's state is styled through its data attributes with
  Tailwind 4. Success criterion 5 ("any new package approved in decision 1") is therefore met by
  adding none; the lockfile changes only if `react-aria-components` itself needs a bump.
- **D-03:** The look is today's field look, made consistent: the current border, `rounded-md` and
  brand focus ring, applied to every control, with one height scale. It is not a restyle to
  shadcn's proportions. The required fixes still land: a disabled Switch reads as disabled (#264),
  placeholder text meets 4.5:1, and disabled, invalid and read-only looks are the same everywhere.

### Phones and short lists (#267 decisions 2 and 3)
- **D-04:** One component API on every device. On phones (the existing `useIsPhone` rule, under
  768 px) Select, DatePicker and MonthPicker render the native `<select>`, date input and month
  input, so the OS wheel and calendar open. Desktop gets the custom popover. `ui/DatePicker.tsx`
  already works this way and is the model.
- **D-05:** On desktop the shared custom Select replaces Wave E's rule that short lists use the
  styled native Select. The picker rule from now on: categories use `CategoryPicker`, payees use
  `PayeeCombobox`, and every other list uses the shared Select or Combobox per D-06.
  — **Reversibility:** costly — desktop e2e tests that use `selectOption` on these lists change
  to the listbox pattern across Phases 3 and 4.
- **D-06:** Searchable or not is decided by the kind of list, not its length. Lists the user grows
  (accounts, tags, households, people and the like) are a searchable Combobox. Fixed lists
  (frequency, type, sort order and the like) are a plain Select. The same field has the same form
  in every budget. The audit classifies each list as one or the other.

### Date fields (#267 decision 5)
- **D-07:** The 47 `type="date"` fields move to the shared DatePicker in this milestone, each with
  its screen in Phases 3 and 4. Phase 2 builds the control and the shared e2e way to fill it; it
  does not move screens. Wave G ends with one date control, and the Phase 4 lint rule covers dates.
  — **Reversibility:** costly — every e2e test that fills a date input is rewritten onto a shared
  helper.
- **D-08:** On desktop a date can be typed or picked, as `ui/DatePicker.tsx` works today: typeable
  day, month and year segments in the owner's date-format preference, plus a calendar button that
  opens the popover. The popover gains a Today shortcut. Values stay `YYYY-MM-DD` strings
  (`isoDate`); displayed dates go through `client/src/utils/dates.ts`.

### Scope and delivery (#267 decision 4)
- **D-09:** Every screen moves onto the shared controls, but the shelved pages (Review, Cash flow,
  Household) and the split candidates (`Household.tsx`, `Tax.tsx`, `CashFlow.tsx`) get a
  like-for-like swap only: no layout, wording or structure change. This is what Phase 4's success
  criterion 1 already assumes.
- **D-10:** Phase 2 ships as two PRs to `redesign`. First the audit and its screenshots, as a
  documentation-only PR with no version bump. Then the component set, the gallery, the screenshot
  test and the `CategoryPicker` and `PayeeCombobox` rewiring together, with the next `0.2.0-up.N`.
  **The set PR does not start until the owner has read the audit and said go.** The owner may
  change any decision here if the audit shows something unexpected. The planner places a blocking
  owner checkpoint between the two.
- **D-11:** MonthPicker is an eleventh shared control in the set PR, with the same states, gallery
  entry and phone rule as DatePicker (native month input on phones). The owner added it on
  16 Nov 2026, beyond WAVG-02's original list; WAVG-02 in `docs/superpowers/gsd-records/REQUIREMENTS.md` is amended
  to match. **Owner gate, 17 Nov 2026 (02-03-SUMMARY.md):** the desktop MonthPicker is the grid
  form (a button opening a year stepper, a twelve-month grid and "This month"), and
  `MonthRangePicker` is **rebuilt in this phase** on the MonthPicker's grid, not left for
  Reports (Phase 3) and Cash flow (Phase 4). Its three users (`reports/DateRangeControl.tsx`,
  `reports/ReportBuilderSidebar.tsx`, `pages/CashFlow.tsx`) move to the rebuilt picker with the
  set PR. The owner also accepted every recommendation for the 36 "owner to decide" rows in
  `docs/ui/FORM-CONTROLS-AUDIT.md`; those rows move with their screens in Phases 3 and 4.
- **D-12:** Escape with a combobox list open closes only the list, never the enclosing dialog or
  sheet; for PayeeCombobox this is an owner-approved behaviour change (17 Nov 2026), named in the
  set PR.

### Claude's Discretion
- **`budget/ExpectedNote.tsx`** (the other React Aria user): move it onto the shared set in this
  phase or leave it for Budget's move in Phase 3. Decide once the audit shows what it uses.
- **Gallery and screenshot test mechanics:** the route, how it is kept out of production builds,
  and how screenshot baselines are kept stable in CI. e2e ports are fixed, so one browser run at a
  time.
- **How "unchanged behaviour" of the picker wrappers is proven:** the existing e2e suites must
  pass; any changed selector carries its reason in the PR.
- **Exact height scale, Field layout (label, help text, error text, required mark) and the
  Today shortcut's placement:** left to the UI spec (`/gsd-ui-phase`, with `/impeccable`) within
  D-03.
- **Who runs the audit:** #267 names Antigravity; the Herdr dispatcher allocates the worker.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and rules
- `docs/superpowers/gsd-records/ROADMAP.md` §Phase 2 — goal, five success criteria, the gate note. Phases 3 and 4 for
  what must not be done here.
- `docs/superpowers/gsd-records/REQUIREMENTS.md` — WAVG-01 to WAVG-04 (WAVG-02 amended for MonthPicker) and "Done
  means, for every wave PR"
- `docs/superpowers/gsd-records/PROJECT.md` §Constraints — money, dates, dependencies, UI and process rules
- GitHub issue #267 (`gh issue view 267 --repo tvrooi/Allotment`) — the Wave G plan, counts and
  "Rules that bite". Its five open decisions are answered by D-01 to D-11 here; where the issue
  and this file differ (shadcn on Radix, "no headless library installed"), this file wins.
- GitHub issue #264 — a disabled `ui/Switch` looks enabled; fixed in the set PR
- `docs/ui/WAVES.md` — how waves run, the traps on record, the Wave E picker rule that D-05
  replaces on desktop
- `CLAUDE.md` §Review guidelines — client rules (`CurrencyInput`, `useCanSave`, accessible names,
  390 px), dependency rules, lint warning cap

### UI
- `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md` — UI working guide
- `docs/ui/MAP.md` — the list of shared components and each screen's files and e2e specs
- `DESIGN.md` — the design system record that Phase 4 updates with the control set
- `client/src/index.css` `@theme` — the only source of design tokens
- `docs/BRAND.md` — colours and voice

### External
- React Aria Components documentation (Select, ComboBox, Checkbox, RadioGroup, Switch, DatePicker,
  TextField, styling by data attributes) — check current docs for the installed version rather
  than relying on memory
- WAI-ARIA Authoring Practices — the keyboard and screen-reader pattern for each control (WAVG-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/ui/DatePicker.tsx` (157 lines): already React Aria (`DatePicker`,
  `DateInput`, `Calendar`, `Popover`) with `@internationalized/date`, the date-format preference,
  min and max, and the native input on phones. One user today (`goals/GoalFormModal.tsx`). The
  base for D-04, D-07 and D-08.
- `client/src/components/ui/Input.tsx` (30 lines): `Input` and the styled native `Select`, both
  `forwardRef`. About 124 and 82 uses. The native `Select` is removed in Phase 4, not here.
- `client/src/components/ui/Switch.tsx`: `role="switch"` button with a 44 px target; has
  `disabled:cursor-not-allowed` but no disabled look (#264).
- `client/src/components/ui/CurrencyInput.tsx`, `amountValidity.tsx`: money entry stays here and
  is not replaced by the shared Input.
- `client/src/components/transactions/CategoryPicker.tsx` (358 lines, portal, create-category,
  hand-rolled) and `PayeeCombobox.tsx` (105 lines, hand-rolled): become wrappers over the shared
  Combobox.
- `client/src/components/ui/SegmentedControl.tsx`, `MonthRangePicker.tsx`, `IconPickerPopover.tsx`,
  `Slider.tsx` (adapted from shadcn, no primitive): neighbours the audit must classify.
- `client/src/hooks/useIsPhone.ts`: `PHONE_MAX_WIDTH = 767`, the phone rule for D-04.

### Established Patterns
- Shared components take a `className` string and build classes with template strings; there is no
  `cn()` helper and none is added (D-02).
- Focus is `focus-visible:outline-2 outline-offset-2 outline-brand-600` on buttons and
  `focus:ring-1 focus:ring-brand-600 focus:border-brand-600` on fields; the set settles on one.
- Menus inside animated or scrollable panels need `overflow-clip` (WAVES.md trap); popovers from
  React Aria render in a portal.
- A primitive loaded by the shell must survive offline start (`utils/retryingImport.ts`).
- New pages are `lazy()` in `client/src/App.tsx`; e2e selects by role or label; Playwright keeps
  screenshots only on failure today, so the gallery test is the first baseline screenshot test.

### Integration Points
- Raw controls counted on `redesign`, 16 Nov 2026 (`.tsx`, tests excluded): 51 `<select`,
  177 `<input` (64 checkbox, 47 date, 10 radio, 10 number, 1 month), 5 `<textarea`. The audit
  replaces these counts with the full table.
- Router (`App.tsx`) for the gallery route; `e2e/` for the screenshot test and the shared
  date-fill helper; CI for running it.
- Every screen that uses `CategoryPicker` or `PayeeCombobox` is touched through the wrappers; their
  e2e suites are the proof for success criterion 4.

</code_context>

<specifics>
## Specific Ideas

- "Today's look, unified": the owner wants the fields they know, made consistent, not a new look.
- A Today shortcut in the calendar popover.
- A shared MonthPicker beside DatePicker.
- The owner wants to read the audit before any component is built.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The three.js goal bloom from Phase 1's deferred list
stays an idea only; D-02 adds no package in Wave G.)

</deferred>

---

*Phase: 02-shared-form-controls*
*Context gathered: 2026-11-16*
