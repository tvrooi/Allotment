# Phase 2: Shared form controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-16
**Phase:** 2-Shared form controls
**Areas discussed:** Primitives and packages, Phones and short lists, Date fields, Scope and delivery

---

## Primitives and packages

Research shown first: shadcn's CLI offers Radix or Base UI; Radix Select needs `cmdk` for search;
React Aria is the most thorough for screen readers. Codebase finding: `react-aria-components` is
already installed and behind `ui/DatePicker.tsx`, contrary to #267.

**Which headless primitives should the set be built on?**

| Option | Description | Selected |
|--------|-------------|----------|
| React Aria (Recommended) | Already installed; no new primitive package; one library for every control | ✓ |
| Radix, shadcn source | Several `@radix-ui` packages plus `cmdk`; two headless libraries in the app | |
| Base UI, shadcn source | One package with a built-in combobox; still a second library | |
| No primitives | Restyle hand-rolled components; write every WAI-ARIA pattern ourselves | |

**Which class-name helper packages may Phase 2 add?**

| Option | Description | Selected |
|--------|-------------|----------|
| None (Recommended) | Plain class maps; React Aria data attributes styled with Tailwind 4 | ✓ |
| clsx + tailwind-merge | A `cn()` helper | |
| All three | Adds class-variance-authority as well | |

**Should the app's other React Aria users change in this phase?**

| Option | Description | Selected |
|--------|-------------|----------|
| DatePicker only (Recommended) | ExpectedNote waits for Budget's move in Phase 3 | |
| Both now | Move ExpectedNote too | |
| You decide | Planner decides after the audit | ✓ |

**What should the controls look like?**

| Option | Description | Selected |
|--------|-------------|----------|
| Today's look, unified (Recommended) | Current border, radius and focus ring on every control, plus the named fixes | ✓ |
| shadcn look in our tokens | shadcn's proportions in Allotment colours | |
| Decide in the UI spec | Leave to `/gsd-ui-phase` | |

**Notes:** none.

---

## Phones and short lists

Research: mobile guidance favours native selects and date inputs; a custom calendar should keep a
typeable field.

**On phones, what should Select and DatePicker open?**

| Option | Description | Selected |
|--------|-------------|----------|
| Native pickers (Recommended) | One API; native on phones, custom popover on desktop | ✓ |
| Custom everywhere | Same custom listbox and calendar on phones | |
| Native select, custom date | Mixed | |

**Does the custom Select replace Wave E's short-list rule on desktop?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, replace it (Recommended) | Desktop short lists open the shared custom listbox | ✓ |
| Keep native on desktop | Styled native select everywhere | |

**When is a list a searchable Combobox?**

| Option | Description | Selected |
|--------|-------------|----------|
| By kind of list (Recommended) | User-grown lists are a Combobox; fixed lists a Select | ✓ |
| By length | Searchable above about 10 options | |
| Keep as today | Only categories and payees searchable | |

**Notes:** none.

---

## Date fields

**When do the 47 `type="date"` fields move onto the shared DatePicker?**

| Option | Description | Selected |
|--------|-------------|----------|
| This milestone (Recommended) | With each screen in Phases 3 and 4 | ✓ |
| Later milestone | Allowlist `type="date"` in the lint rule for now | |
| Styled native only | Drop the calendar popover | |

**How is a date entered on desktop?**

| Option | Description | Selected |
|--------|-------------|----------|
| Type or pick (Recommended) | Typeable segments plus calendar popover, as today's DatePicker | |
| Type or pick, plus Today | The same, with a Today shortcut | ✓ |
| Pick only | No typing | |

**Do month pickers join the set?**

| Option | Description | Selected |
|--------|-------------|----------|
| Restyle only (Recommended) | MonthRangePicker takes the shared look; no new control | |
| Leave untouched | Ten controls only | |
| Add a MonthPicker | A shared MonthPicker beside DatePicker; beyond WAVG-02's list | ✓ |

**Notes:** the owner then confirmed MonthPicker is added to Phase 2 as an eleventh control (see
Scope and delivery).

---

## Scope and delivery

**How far does Wave G go on the shelved and split-candidate pages?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanical swap (Recommended) | Like-for-like swap only | ✓ |
| All screens equally | Tidy one-off layouts too | |
| Leave them out | Keep native, allowlisted | |

**How should Phase 2 ship?**

| Option | Description | Selected |
|--------|-------------|----------|
| Audit PR, then set PR (Recommended) | Documentation-only audit PR, then the set with gallery, test and wrappers | ✓ |
| Three PRs | Wrappers reviewed on their own | |
| One PR | Everything together | |

**After the audit PR lands, does the set wait for the owner?**

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for my read (Recommended) | Set PR starts only after the owner says go | ✓ |
| Carry on, flag surprises | Stop only on a contradiction | |

**How is the MonthPicker recorded?**

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Phase 2 (Recommended) | Amend WAVG-02; eleventh control in the set PR | ✓ |
| Own later phase | Deferred idea | |

**Notes:** none.

---

## Claude's Discretion

- Whether `budget/ExpectedNote.tsx` moves in this phase.
- Gallery route, production exclusion and screenshot baseline mechanics.
- How unchanged picker behaviour is proven.
- Height scale, Field layout and Today placement (UI spec).
- Whether `MonthRangePicker` is rebuilt on MonthPicker or restyled.

## Deferred Ideas

None.
