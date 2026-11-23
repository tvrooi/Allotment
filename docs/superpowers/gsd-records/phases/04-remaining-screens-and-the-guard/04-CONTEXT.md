# Phase 4: Remaining screens and the guard - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Wave G steps G4 and G5 (#267), client and `lint/` only, no server change.

1. **G4 (WAVG-07, WAVG-08):** the last screens move onto the shared controls. Settings (after
   Phase 1's split), the bank connection sections (Up, Plaid, SimpleFIN, Enable Banking, Connected
   banks), and a like-for-like swap in Review, Cash flow, Household and Tax. By Phase 3's D-13 this
   PR also takes every screen with fields that no earlier PR moved: Dashboard, Payment plans,
   Welcome, the sign-in screens, the app shell and any stray shared piece (for example
   `components/currency/`). After G4 no money amount is typed into a `type="number"` field
   anywhere.
2. **G5 (WAVG-09, WAVG-10):** the guard. A lint rule in `lint/` fails on a raw `<select>`,
   `<textarea>` or `<input>` outside `client/src/components/ui/`, with an allowlist, its own tests
   and the warning cap lowered to match. The old native `Select` in `ui/Input.tsx` and every
   component the set replaced are removed. `DESIGN.md`, `docs/ui/MAP.md` and
   `docs/ui/HANDOVER-UI.md` record the control set, the lint rule and the picker rule.

Not in this phase: redesigning, re-laying-out or splitting any shelved page or split candidate
(D-09), new controls beyond what a moved screen needs, and server changes.

This phase was planned before Phases 2 and 3 were executed. The WAVG-01 audit, the shared controls
and the Phase 3 PRs do not exist yet when these plans are written (see D-16).

</domain>

<decisions>
## Implementation Decisions

### Carried forward from Phases 2 and 3 (locked for all of Wave G)

D-01 to D-11 are the owner's decisions in
`docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md`; D-12 to D-17 are in
`docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md`. They keep their numbers here. Read
those files for the full wording and reversibility ratings; the lines below say how each binds
Phase 4.

- **D-01:** Screens use the shared controls built on `react-aria-components`; no screen builds its
  own field from React Aria.
- **D-02:** No new package, in the client or for the lint rule. The rule is written with what
  `lint/` already has.
- **D-03:** Today's field look, made consistent. One-off field classes are deleted, screens are
  not restyled.
- **D-04:** One component API on every device; native pickers under 768 px through the shared
  component.
- **D-05:** Custom Select on desktop. Picker rule: categories use `CategoryPicker`, payees use
  `PayeeCombobox`, every other list uses the shared Select or Combobox. This is the picker rule G5
  writes into the docs.
- **D-06:** Lists the user grows are a searchable Combobox, fixed lists a plain Select, as the
  audit classifies them.
- **D-07:** Every remaining `type="date"` field moves to the shared DatePicker with its screen.
  After G4 none is left, and the G5 lint rule covers dates because it covers every raw `<input>`.
- **D-08:** Dates can be typed or picked; values stay `YYYY-MM-DD`.
- **D-09:** Review, Cash flow and Household (shelved) and `Household.tsx`, `Tax.tsx` and
  `CashFlow.tsx` (split candidates) get a like-for-like swap only: each field is replaced by the
  shared control of the same kind, in the same place, with the same label and wording. No layout,
  wording or structure change, and no file is split.
- **D-10:** [informational] Phase 2's delivery and its owner checkpoint after the audit.
- **D-11:** A remaining `type="month"` field moves to the shared MonthPicker.
- **D-12:** [informational] Phase 3's two PRs. Phase 4 does not start until both are merged to
  `redesign`.
- **D-13:** Screens with no parent in the Phase 3 lists move here, in G4: Dashboard, Payment
  plans, Welcome, the sign-in screens, the app shell, and any shared piece with a raw field that
  Phase 3 left (owner, 16 Nov 2026).
- **D-14:** A `type="number"` field is fixed with its screen. Phase 3 fixes the ones on its
  screens; G4 fixes every one that is left (on 16 Nov 2026 that is
  `components/plans/NewPlanModal.tsx`, plus any Phase 3 missed) and proves with a search-based test
  that no money amount goes through `type="number"` anywhere. `CurrencyInput` for money, otherwise
  a shared field within the matching Zod cap, each with a test that fails first.
- **D-15:** Apart from D-14, a screen move changes only which component draws the field: same
  values saved, same validation and error text, same accessible names, `useCanSave` and
  `<SavingPausedHint />` kept, Safe mode still hides amounts. Anything else that would change is a
  finding to raise, not a change to make.
- **D-16:** These plans were written before the audit, the shared controls and the Phase 3 PRs
  existed. Each PR starts with a task that reads the audit, the shipped controls and what Phase 3
  actually moved, and checks the plan's file list, list classifications and "must stay native"
  entries against them. If the owner changed a Wave G decision after reading the audit, execution
  stops and the plan is revised first.
- **D-17:** A field the audit says must stay native stays native. The lists of those fields from
  the audit and from the G2, G3 and G4 PRs are the source for the lint allowlist.

### Delivery
- **D-18:** Phase 4 ships as two PRs to `redesign`, G4 then G5, as #267 and the roadmap say. Each
  is an app change with its own next `0.2.0-up.N` and CHANGELOG entry. G5 does not start until G4
  is merged, because the lint rule fails while any raw field is left outside `components/ui/`.
- **D-19:** Settings and the bank sections are moved from the Phase 1 (Wave F) layout: Settings
  split into its sections, and banks under Accounts → Connected banks. G4 does not start until
  PR #273 is merged to `redesign`.

### Sign-in and bank fields
- **D-20:** Fields that take a password, token, API key or bank credential keep their `type`,
  `name`, `autoComplete`, `inputMode`, `spellCheck` and paste behaviour exactly, so password
  managers and the bank flows behave as before. A secret is never shown where it was hidden, never
  logged, and never put in a test fixture. This follows the project's safety rules and is not open
  to trade-off.

### The guard
- **D-21:** The lint rule is an error, not a warning: it fails lint (WAVG-09). It covers raw
  `<select>`, `<textarea>` and `<input>` in `client/src` outside `client/src/components/ui/`. The
  allowlist is explicit and short: file inputs, and the fields D-17 lists, each with its reason on
  the line. The rule has its own tests in `lint/` with at least one allowed case and one refusal.
  The warning cap in `lint/package.json` goes down to the new count or stays; it never goes up.
- **D-22:** WAVG-10 removal is complete: the native `Select` export in `ui/Input.tsx`, any old
  implementation the shared set replaced, their unused exports, one-off classes, test fixtures and
  doc mentions all go in G5. A removed name is searched for across `client/src`, `e2e/`, the demo
  budget and `docs/` before the PR is opened.

### Claude's Discretion
- **How the rule is written** (a custom ESLint rule or `no-restricted-syntax` selectors), where its
  tests live in `lint/`, and whether the allowlist is by file, by attribute (`type="file"`) or
  both.
- **Whether the guard also refuses `type="number"`** on the shared Input or anywhere in
  `client/src`. Add it only if it is a few lines in the same rule and has its own allowed and
  refused test cases; otherwise the search-based test from D-14 is the guard.
- **The docs.** `DESIGN.md`, `docs/ui/MAP.md` and `docs/ui/HANDOVER-UI.md` are named by WAVG-10.
  If the picker rule or the lint rule changes a line in `CLAUDE.md`, the same edit goes into
  `AGENTS.md` so the two stay byte-identical. `docs/ui/WAVES.md` gets Wave G's record if that is
  how earlier waves were closed.
- **How each PR is cut into plans** and the order of screens inside G4.
- **Missing variant or state:** extend the shared control with its gallery state and screenshot,
  as in Phase 3.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and rules
- `docs/superpowers/gsd-records/ROADMAP.md` §Phase 4 — goal and five success criteria; §Phase 1 for the Settings
  split this phase depends on
- `docs/superpowers/gsd-records/REQUIREMENTS.md` — WAVG-07 to WAVG-10 and "Done means, for every wave PR"
- `docs/superpowers/gsd-records/PROJECT.md` §Constraints — money, dates, dependencies, UI and process rules
- GitHub issue #267 (`gh issue view 267 --repo tvrooi/Allotment`) — "G2 to G4. Migration, by area,
  mechanical", "G5. Keep it that way" and "Rules that bite". Where the issue and the CONTEXT files
  differ, the CONTEXT files win.
- `CLAUDE.md` §Safety and invariants (tokens, auth protections), §Review guidelines (client rules,
  staleness and drift, lint warning cap, releases); `AGENTS.md` must stay byte-identical to it
- `SECURITY.md` §Security review guidelines — for the sign-in and bank fields (D-20)
- `docs/ui/WAVES.md` — how waves run and the traps on record

### Earlier Wave G outputs this phase builds on
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` — D-01 to D-11 in full
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-CONTEXT.md` — D-12 to D-17 in full
- `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-UI-SPEC.md`, `02-RESEARCH.md`, `02-PATTERNS.md` —
  the control set's contract and research
- `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-UI-SPEC.md`, `03-RESEARCH.md` and
  `03-*-PLAN.md` where present — how screens are mapped onto the set, and which files Phase 3
  takes
- `docs/superpowers/gsd-records/phases/01-settings-split-and-good-moments/` — the Settings split and the Connected
  banks page (01-CONTEXT.md and the plan summaries)
- The WAVG-01 audit itself, once Phase 2 has produced it (D-16, D-17)

### UI and lint
- `docs/ui/README.md`, `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`, `DESIGN.md` — the docs G5
  updates
- `client/src/index.css` `@theme`, `docs/BRAND.md`
- `lint/README.md`, `lint/eslint.config.js`, `lint/package.json` (`--max-warnings`),
  `lint/terms/terms.test.js` — how lint rules, their tests and the cap work here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The shared controls from Phase 2 in `client/src/components/ui/`, `CategoryPicker`,
  `PayeeCombobox`, `CurrencyInput`, and the e2e helpers Phase 2 adds.
- `lint/terms/terms.test.js` — the model for a lint guard with its own tests.
- `client/src/hooks/useCanSave`, `<SavingPausedHint />` — unchanged.

### Established Patterns
- Lint warnings are capped (`--max-warnings=128` in `lint/package.json` on 16 Nov 2026); errors
  fail. The cap goes down or stays.
- Shared components take a `className` string; classes are plain template strings (D-02).
- e2e selects by role or label; ports are fixed, so one browser run at a time.

### Integration Points
- Counts on `redesign`, 16 Nov 2026 (`.tsx`, tests excluded; raw = `<select>`, `<input>`,
  `<textarea>`; old = `ui/Input` `Input` + `Select`). The audit replaces these.
  - Settings: `components/settings` 35 raw + 8 old (3 date); `pages/Settings.tsx` is 146 lines in
    both trees.
  - Banks: `components/enablebanking` 9 raw, `components/plaid` 7 raw, `components/up` 6 raw
    (1 date), `components/simplefin` 4 raw.
  - Shelved and split candidates: `components/household` 5 raw + 16 old (2 date),
    `components/tax` 5 raw + 20 old (5 date), `components/review` 1 raw + 5 old;
    `pages/Household.tsx` 1598 lines, `pages/CashFlow.tsx` 1329, `pages/Tax.tsx` 822,
    `pages/Review.tsx` 792.
  - From D-13: `components/plans` 1 raw + 10 old (4 date, 1 number), `components/auth` 4 raw
    (`AuthGate.tsx`), `components/currency` 2 raw, `components/dashboard` 1 raw + 1 old
    (`CustomizeHome.tsx`), `components/layout` 1 raw (`CommandPalette.tsx`).
- The 10 `type="number"` uses on 16 Nov 2026: `forecast/CashRunway.tsx` (2),
  `budget/TargetCard.tsx`, `budget/PaydayPlan.tsx`, `recurring/RecurringFormModal.tsx`,
  `recurring/UpcomingLengthModal.tsx`, `rules/RuleEditorModal.tsx`,
  `transactions/ImportModal.tsx`, `longterm/EventEditor.tsx` (Phase 3 by D-14), and
  `plans/NewPlanModal.tsx` (Phase 4).
- `client/src/components/ui/` itself holds 5 raw fields; they are inside the allowed folder.
- Wave F (Phase 1) code is in `/Users/tristanvanrooyen/wt-f` on branch `wave-f` until PR #273 is
  merged. Settings, Accounts and bank files must be read there until then (D-19).

</code_context>

<specifics>
## Specific Ideas

- The owner wants each screen touched once, and the shelved pages swapped mechanically with
  nothing else moved.
- The guard should make the shared set "the only way to build a field" (roadmap goal).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Splitting `Household.tsx`, `Tax.tsx` and
`CashFlow.tsx` stays out of this milestone's Wave G (D-09).

</deferred>

---

*Phase: 04-remaining-screens-and-the-guard*
*Context gathered: 2026-11-16*
