# Roadmap: Allotment

## Overview

Allotment is a working brownfield app; everything up to redesign Wave E is built. Milestone v1.0
finishes the UI redesign on branch `redesign`. Wave F splits the crowded Settings page and marks good
moments. Wave G then gives every field and selector on desktop one shared, accessible component set,
moves the screens onto it area by area, and adds a lint rule so the set stays the only way to build a
field. No phase changes a money figure, a server route or the token allowlist. Each phase is one or
two wave PRs to `redesign`.

## Milestones

- 🚧 **v1.0 Redesign finish** - Phases 1-4 (in progress)

GSD milestone numbers are separate from the app's release numbers (`0.2.0-up.N`).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Settings split and good moments** - Wave F: Connected banks on Accounts, Categories on Budget, a brand-voice moment for a completed goal and a $0 Ready to assign (#244, #241)
- [ ] **Phase 2: Shared form controls** - Wave G G0-G1: audit every field, build one accessible component set from `@theme` tokens, with a gallery and screenshot test (#267, #264)
- [ ] **Phase 3: Screens on shared controls** - Wave G G2-G3: everyday money screens, then planning, reports and files, move onto the set with no behaviour change (#267)
- [ ] **Phase 4: Remaining screens and the guard** - Wave G G4-G5: Settings, banks and the shelved pages swapped, no money in `type="number"`, a lint rule, old controls removed (#267)

## Phase Details

### Phase 1: Settings split and good moments
**Goal**: The owner reaches bank connections and categories where they think of them (Accounts and Budget), Settings is shorter, and the app marks a completed goal and a fully assigned month in the brand voice.
**Depends on**: Nothing (first phase)
**Requirements**: WAVF-01, WAVF-02, WAVF-03, WAVF-04, WAVF-05
**Success Criteria** (what must be TRUE):
  1. From the Accounts page the user opens Connected banks and reaches the Up connection in fewer clicks than today's three.
  2. The user manages categories from the Budget area, and Settings no longer shows a Connected banks or Categories tab.
  3. Every old way in still lands on the moved section: `/settings?tab=connections` and `?tab=categories` links, the sidebar, palette and Welcome entries, and guide steps, with guide and tip ids unchanged.
  4. When a goal reaches its target (the demo's "New laptop"), the user sees a small sprout-tick style moment instead of only a plain green bar. It shows in light and dark, at 390 px and in Safe mode without revealing hidden amounts.
  5. When Ready to assign reaches exactly $0, the user sees a brief acknowledgement that never reads as "Fully budgeted" while uncategorised spending, overspending or a missing exchange rate remains.
**Plans**: 3/8 plans executed, one per wave, all delivered by revising PR #273 (WAVES.md plans Wave F as one PR)
**UI hint**: yes

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Repair the wave-f worktree; Connected banks becomes the page /accounts/connections, opened from Accounts

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Each bank pill and link opens its own provider (D-08, the Codex P1 on #273)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Categories becomes the page /budget/categories; Settings has eight tabs, opens on Accounts and redirects the old tabs

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-04-PLAN.md — The search palette opens both pages; in-app help and the server's account-deletion message name the new places (D-09)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-05-PLAN.md — The goal plant: four stages at the end of the bar, a flower when reached

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 01-06-PLAN.md — $0 Ready to assign: "Every dollar has a job" or the named caveat; the old label retired

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 01-07-PLAN.md — Guide steps, docs, WAVES.md note (D-10) and changelog; the full gate on Node 24

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 01-08-PLAN.md — Screenshots, release version check, push to PR #273 and its body (no merge)

Notes: client only, except one server message string (accountDeletion.ts, owner D-09, 15 Nov 2026). Files from the `/settings`, `/accounts`, `/budget` and `/goals`
rows of docs/ui/MAP.md; `client/src/pages/Settings.tsx` holds the ten tabs in `?tab=` URLs. Mind the
critique decision that Ready to assign is green while its figure holds, and that zero amounts show in
normal colour (GLOSSARY.md).

### Phase 2: Shared form controls
**Goal**: Every kind of field and selector exists once, as a shared component styled only from `@theme` tokens, that looks and behaves the same in light and dark and is ready for the screens to move onto.
**Depends on**: Phase 1 (Wave G runs after Wave F), and the owner's five Wave G decisions recorded in #267
**Requirements**: WAVG-01, WAVG-02, WAVG-03, WAVG-04
**Success Criteria** (what must be TRUE):
  1. The owner can read the audit of every field and selector in `client/src`: file and line, control type, states, accessible name and e2e selectors. Screenshots of each control type at 1280 and 390 px, in light and dark, come with it.
  2. A development-only gallery shows Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, DatePicker, Label and Field in every state (default, focus, disabled, invalid, read-only). They share one height scale, radius, border and focus ring in light and dark; a disabled Switch reads as disabled, and placeholder text meets 4.5:1 contrast.
  3. A keyboard-only or screen-reader user can operate every gallery control by its WAI-ARIA pattern with a visible focus ring. On a 390 px phone each control has a 44 px touch target and opens the picker the owner chose for phones.
  4. Choosing a category or payee works exactly as before on every screen that uses it (existing e2e pass), now through the shared Combobox.
  5. The gallery screenshot test runs in CI. Any new package approved in decision 1 arrives only in this phase, with the lockfile updated and install scripts still disabled.
**Plans**: TBD (#267 sends G1 to the HIGH tier for a plan review because it changes shared components)
**UI hint**: yes

Gate: the five owner decisions in #267 are: (1) dependencies, (2) phones, (3) replacing Wave E's
"short lists use the styled native Select" rule on desktop, (4) scope of the first pass, and
(5) dates (47 `type="date"` uses). The G0 audit is read-only and can inform them; the G1 spec waits
for them.

### Phase 3: Screens on shared controls
**Goal**: On desktop, the everyday money screens and the planning, reports and files screens use only the shared controls, and nothing they do changes.
**Depends on**: Phase 2
**Requirements**: WAVG-05, WAVG-06
**Success Criteria** (what must be TRUE):
  1. On desktop, every field and selector on Transactions, Accounts, Budget, Payees, Rules and Recurring, and on Goals, Forecast, Investments, Reports, Files and the import and export dialogs, is a shared control that looks the same in light and dark.
  2. Entering, editing, filtering and saving on those screens gives the same results as before. Money is still typed in `CurrencyInput`, save buttons still pause when saving is paused, and Safe mode still hides amounts.
  3. Each of those screens holds at 390 px with no sideways scroll, and still works in the demo and offline.
  4. The desktop, phone, demo and server-mode browser suites pass, and every changed test selector has its reason in the PR.
**Plans**: TBD (#267 ships G2 and G3 as separate PRs, in that order)
**UI hint**: yes

### Phase 4: Remaining screens and the guard
**Goal**: The last screens move onto the shared set, no money is typed into a number field anywhere, and a lint rule keeps the shared set the only way to build a field.
**Depends on**: Phase 3 (and Phase 1's Settings split)
**Requirements**: WAVG-07, WAVG-08, WAVG-09, WAVG-10
**Success Criteria** (what must be TRUE):
  1. Settings and the bank connection sections use only shared controls. Review, Cash flow, Household and Tax get their controls swapped, as scoped by decision 4, with no other change to their layout.
  2. No screen takes a money amount through `type="number"`. Each of the 10 former uses is `CurrencyInput` for money, or a shared field within its Zod cap.
  3. Lint fails on a raw `<select>`, `<textarea>` or `<input>` outside `components/ui/` (allowlisted exceptions only). The rule's own tests show an allowed case and a refusal, and the warning cap goes down or stays.
  4. The old native `Select` in `ui/Input.tsx` and every replaced component are gone. DESIGN.md, docs/ui/MAP.md and docs/ui/HANDOVER-UI.md name the control set, the lint rule and the picker rule.
  5. The gallery screenshot test and the full desktop, phone, demo and server-mode suites pass on `redesign`.
**Plans**: TBD (#267 plans G4 and G5 as separate PRs)
**UI hint**: yes

## Backlog (later milestones, not scheduled)

The owner placed these after milestone v1.0. IDs are in `.planning/REQUIREMENTS.md` (v2); promote
with `/gsd-review-backlog` or `/gsd-new-milestone`.

- Tax car expenses, D4b (CAR-01 to CAR-03). Designed and owner-approved 8 Nov 2026; not built.
- Household partner links (HHL-01). Design only; owner decisions 4, 5, 7, 8 and 9 open.
- Depreciating assets phase 4 extras (DEPR-01).
- Funding rules awaiting owner decisions W-1 and W-2 (FUND-01, FUND-02). W-2 is a money-correctness gap.
- Documentation fixes from the ingest (DOCS-01, DOCS-02).
- UI issue backlog (UIBL-01 to UIBL-04). #269 and #270 touch data and privacy; the owner may want them inserted as decimal phases.
- Release of `redesign` and reconciling it with `main` (REL-01), the MCP change-set race (ASST-01), long-term forecast assumptions (LTF-01).

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Settings split and good moments | 3/8 | In Progress | - |
| 2. Shared form controls | 0/TBD | Not started | - |
| 3. Screens on shared controls | 0/TBD | Not started | - |
| 4. Remaining screens and the guard | 0/TBD | Not started | - |
