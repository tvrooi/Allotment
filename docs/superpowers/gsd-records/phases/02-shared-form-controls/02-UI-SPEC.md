---
phase: "02"
slug: "shared-form-controls"
status: approved
reviewed_at: "2026-11-16"
shadcn_initialized: false
preset: none
created: "2026-11-16"
---

# Phase 02 — UI Design Contract

> Visual and interaction contract for Phase 02: Shared form controls (Wave G G0–G1). Consumes `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-CONTEXT.md` (D-01 through D-11), `docs/superpowers/gsd-records/phases/02-shared-form-controls/02-RESEARCH.md`, `docs/superpowers/gsd-records/REQUIREMENTS.md` (WAVG-01 through WAVG-04), `DESIGN.md`, `docs/BRAND.md`, `lint/package.json` (`--max-warnings=128`), and `client/src/index.css`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (`components.json` absent; no shadcn source copied, per D-01, D-02) |
| Preset | not applicable |
| Component library | `react-aria-components` (`1.22.1`, already installed in `client/package.json`; D-01, D-02) |
| Icon library | `lucide-react` (`1.55.0`) |
| Font | `Inter, ui-sans-serif, system-ui, sans-serif` (`@fontsource/inter`, weights `400` and `500` used in this contract) |

---

## Component Inventory

Enumerated by `ls client/src/components/ui/*.tsx | wc -l` — 33 components — flybudget@0.2.0-up.174 (commit `ce32490`; primitives built on `react-aria-components@1.22.1`) — 2026-11-16.

> Non-exhaustive list of existing `client/src/components/ui/` form and interactive primitives relevant to Phase 02, alongside the 11 shared form controls specified for G1. All styling uses Tailwind CSS v4 utilities over `@theme` tokens from `client/src/index.css` with plain template-string class maps (no `cva`, `clsx`, or `tailwind-merge`; D-02).

| Component | Import path | Notes |
|-----------|-------------|-------|
| `Input`, `Select` (existing) | `client/src/components/ui/Input.tsx` | Current `h-10 max-md:h-11` text input and native `<select>` (`Select` stays exported here until Phase 4 `WAVG-10` removes it; the new desktop React Aria `Select` exports from `ui/Select.tsx`) |
| `DatePicker` (existing) | `client/src/components/ui/DatePicker.tsx` | React Aria `DatePicker` on desktop + native `<input type="date">` on phones (`useIsPhone`); baseline for D-04, D-07, D-08 |
| `Switch` (existing) | `client/src/components/ui/Switch.tsx` | Native `<button role="switch">`, 44 px touch target, currently missing disabled visual state (#264); rebuilt on React Aria `Switch` |
| `CurrencyInput`, `amountValidity` | `client/src/components/ui/CurrencyInput.tsx`, `amountValidity.tsx` | Money entry (`type="text" inputMode="decimal"`); stays separate from `Input` (D-03), gains placeholder contrast parity (`placeholder:text-text-tertiary`) |
| `Button`, `ButtonLink` | `client/src/components/ui/Button.tsx` | Shared height scale (`md`: `h-10`, `sm`: `h-8`, phone `max-md:min-h-11`) and `filledDisabled` reference pattern |
| `Slider` | `client/src/components/ui/Slider.tsx` | Native `<input type="range">` with value bubble; stays native (allowlisted in Phase 4) |
| `SegmentedControl` | `client/src/components/ui/SegmentedControl.tsx` | `aria-pressed` button group for chart range tabs; stays as-is |
| `MonthRangePicker` | `client/src/components/ui/MonthRangePicker.tsx` | Portaled dual `MonthGrid` popover for report month ranges; rebuilt in Phase 2 on `MonthPicker`'s shared `MonthGrid`, with native From and To month inputs on phones (D-11, owner gate 17 Nov 2026; plan 02-14) |
| `IconPickerPopover` | `client/src/components/ui/IconPickerPopover.tsx` | Portaled category icon grid popover |
| `Textarea`, `Select`, `Combobox`, `Checkbox`, `RadioGroup`, `MonthPicker`, `Label`, `Field` (Phase 2 additions) | `client/src/components/ui/` | Built on `react-aria-components@1.22.1` in G1 alongside updated `Input`, `Switch`, and `DatePicker` |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between `Label`, control, help text, and error text inside `Field` (`gap-1`); required `*` mark (`ml-1`); `ListBox` inner padding (`p-1`); `DatePicker`/`MonthPicker` trigger trailing padding (`pr-1`); `DateSegment` horizontal padding (`px-1` on editable segments, `px-0` on literal separators); `MonthPicker` 3×4 month grid gap (`gap-1`); `Popover` `offset={4}` across all picker popovers (`Select`, `Combobox`, `CategoryPicker`, `PayeeCombobox`, `DatePicker`, `MonthPicker`) |
| sm | 8px | Gap between `Checkbox`/`Radio`/`Switch` indicator and its label (`gap-2`); vertical gap between options inside one control group (`RadioGroup`, tightly coupled checkbox list: `gap-2`); `ListBoxItem` vertical padding (`py-2`); calendar/month popover header and footer spacing (`gap-2`, `mb-2`, `mt-2 pt-2`) |
| md | 16px | Default vertical gap between stacked form fields (`space-y-4` / `gap-4`, `Field` to `Field`) and horizontal `RadioGroup` option gap (`gap-4`); card padding on phones (`p-4`); page side gutter on phones (`PAGE_GUTTER`) |
| lg | 24px | Gallery card padding on desktop (`p-6`); page side gutter on desktop (`md+`) |
| xl | 32px | Gallery section group breaks (`space-y-8`) |
| 2xl | 48px | Major layout breaks between gallery control categories |
| 3xl | 64px | Page-level bottom clearance on gallery scroll views |

Exceptions (all multiples of 4):
- `0px` (`px-0`, `border-collapse`): Literal date separators (`DateSegment` `data-[type=literal]`) and `CalendarGrid` table cell gap (`border-collapse` around `size-9` cells).
- `12px` (`px-3`, `pl-3`, `p-3`):
  - Horizontal padding inside `Input`, `Textarea`, `Select`, `Combobox`, `ListBoxItem` options (`px-3`), and leading horizontal padding (`pl-3`, paired with `pr-1` = 4px around trailing icon buttons) inside `DatePicker` and `MonthPicker` trigger groups, preserving existing `Input.tsx` and `DESIGN.md` proportions.
  - Inner padding (`p-3`) inside `DatePicker` popover, `MonthPicker` dialog, and the preserved `CategoryPicker` inline create-category footer, matching incumbent `DatePicker.tsx` and `CategoryPicker.tsx` (D-03).
- `20px` (`size-5`): Visual indicator box/circle for `Checkbox` and `Radio` inside their 44 px phone hit targets.
- `32px` (`h-8`, `size-8`): Compact `sm` control height on desktop (`>= 768px`) matching `Button size="sm"`, and icon buttons (`X`, `CalendarDays`, `ChevronLeft`, `ChevronRight`) inside picker triggers and calendar/month headers.
- `36px` (`min-h-9`, `h-9`, `size-9`): Desktop `ListBoxItem` option row minimum height, `CalendarCell` / `CalendarHeaderCell` size, and `MonthPicker` month cell height (expanding to `max-md:min-h-11` = 44px on phones).
- `40px` (`h-10`): Default `md` control height on desktop (`>= 768px`), matching `Button size="md"` and existing `Input.tsx`.
- `44px` (`max-md:min-h-11 max-md:min-w-11`; `Switch` retains `min-h-11 min-w-11` at all widths): Minimum touch target height on phones (`< 768px`, `useIsPhone`) and minimum 44×44 px phone hit target for `Checkbox`, `Radio`, and `Switch` (including standalone label-less toggles).
- `80px` (`min-h-20`), `224px` (`w-[224px]`), `288px` (`max-h-72`): Default `Textarea` minimum height (`rows={3}`), proposed desktop `MonthPicker` dialog width, and `ListBox` scroll cap.

> **Spacing integrity note:** Every spacing value in this contract is a multiple of 4. Off-grid values in `02-RESEARCH.md` snippets (such as `gap-1.5`, `px-2.5`, `py-1.5`, `gap-2.5`) AND in incumbent files (`DatePicker.tsx`, `Input.tsx`, `MonthRangePicker.tsx`, `CategoryPicker.tsx`, `PayeeCombobox.tsx` — such as `px-0.5`, `py-1.5`, `py-2.5`, `gap-1.5`, `gap-2.5`, `mb-1.5`, `offset={6}`) are non-normative and must not be copied into Phase 02 controls (`px-1`/`px-0`, `gap-1`/`gap-2`, `px-3`, `py-2`, `offset={4}` win).

---

## Typography

Declared strictly from `client/src/index.css` `@theme` and `DESIGN.md` (4 sizes — with 1 responsive Display size — and 2 weights: `400` regular and `500` medium; `font-semibold` `600` is not used in Phase 02 controls):

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Helper / Meta | 12px (`0.75rem`, `text-xs`) | 400 (help/error) / 500 (headers) | 1.33 (`16px`) | `Field` help text, `FieldError` messages, popover section headers, calendar weekday headers (`CalendarHeaderCell`) |
| Label / Desktop Control | 14px (`0.875rem`, `text-sm`) | 500 (label/heading) / 400 (value) | 1.43 (`20px`) | `Label` (`font-medium`), desktop `Input`, `Textarea`, `Select`, `Combobox`, `DatePicker`, `MonthPicker`, `Checkbox`/`Radio` labels, calendar month heading (`font-medium`), `data-[today]` calendar cell (`font-medium`) |
| Body / Phone Control | 16px (`1rem`, `text-base`) | 400 | 1.5 (`24px`) | Gallery body descriptions and phone (`max-md:text-base`) field values to prevent iOS focus zoom (`index.css` `@media (max-width: 767px)`) |
| Display | 28px desktop / 24px phone (`1.75rem` `text-title` / `max-md:text-2xl`, one responsive Display role via untouched `PageHeader`) | 500 | 1.29 (`36px`) / 1.33 (`32px`) | Gallery page `<h1>` via shared `PageHeader` |

---

## Color

All color values come exclusively from `client/src/index.css` `@theme` (light) and `.dark` (dark). No inline hex colors or unapproved palette tokens are permitted.

| Role | Value (Light / Dark) | Usage |
|------|----------------------|-------|
| Dominant (60%) | `--color-page` (`#f7f5ef` / `#1c1a17`), `--color-surface` (`#ffffff` / `#262320`) | Page canvas (`--color-page`); resting control fills, gallery cards, and popover surfaces (`--color-surface`) |
| Secondary (30%) | `--color-surface-alt` (`#efece9` / `#302c28`), `--color-border` (`#e4e1de` / `#4a443e`), `--color-border-light` (`#efece9` / `#3a3531`), `--color-hover` (`#eeebe8` / `#3a3531`) | Disabled and read-only field surfaces (`--color-surface-alt`); 1px control borders (`--color-border`); popover dividers (`--color-border-light`); option/cell hover fills (`--color-hover`) |
| Accent (10%) | `--color-brand-600` (`#bf3e00` / `#ff8a57`), `--color-brand-contrast` (`#ffffff` / `#22201d`), `--color-brand-700` (`#9f3300` / `#ffa57e`), `--color-brand-100` (`#ffe9de` / `#4a2a1c`), `--color-brand-50` (`#fff4ee` / `#3a2318`) | Focus rings, enabled checked/selected state fills, and calendar/create-action text (strictly enumerated below) |
| Destructive / Invalid | `--color-negative` (`#cb2b30` / `#ff8f8c`) | Invalid borders/focus rings (`border-negative`), `FieldError` text (`text-negative`), required `*` mark, and destructive actions only |

Accent reserved for (exact enumerable list):
1. Keyboard and field focus indicators (deliberate three-treatment rule matching `DESIGN.md` §Dialogs and motion and D-03, backed by an explicit global CSS layer change):
   - **Global CSS prerequisite (`client/src/index.css:363-366` — explicit planner change):** `:focus-visible { outline: 2px solid var(--color-brand-600); outline-offset: 3px; }` is currently **unlayered** in `client/src/index.css`, which per CSS Cascade Layers overrides every Tailwind v4 `@layer utilities` rule (`outline-none`, `focus:outline-none`, `focus-visible:outline-offset-2`). Wrap `:focus-visible` at `client/src/index.css:363-366` in `@layer base { ... }` (mirroring the scrollbar rule at `index.css:370` and matching `DESIGN.md:311`), while keeping `.scroll-row :focus-visible { outline-offset: -2px; }` (`index.css:305-307`) unlayered.
     - *What else this affects (verified across `client/src/`):* Controls without an `outline-*` utility (`Button`, `ButtonLink`, links, `MonthRangePicker` buttons, etc.) retain the global `2px solid var(--color-brand-600)` outline with `3px` offset (`DESIGN.md:311`). Existing components that already pair `outline-none` / `focus:outline-none` with a replacement indicator (`Input`, `CurrencyInput`, `Modal` inputs/panel, `ContextMenu` items, `PayeeCombobox`, `CategoryPicker`, `DefaultCategoryButton`, `PayeeIcon`, `Slider` `outline-offset-4`, `Switch` `outline-offset-2`, `DatePicker`, and non-interactive `tabIndex={-1}` containers such as `AppShell` `<main>` and `SidebarFeatureSettings` `<h4>`) stop drawing a redundant outer 3px-offset outline on top of their own ring and allow their declared utility to take effect; every interactive caller of `outline-none` in `client/src/` already defines a replacement focus treatment.
   - **Boxed fields & trigger groups** (`Input`, `Textarea`, `Select` trigger, `Combobox` group, `DatePicker` `Group` + `DateSegment` + phone `<input>`, `MonthPicker` trigger `Group` + phone `<input>`): `outline-none` + `border-brand-600 ring-1 ring-brand-600` on `focus` / `focus-within` / `data-[focus-visible]` (`outline-none focus:bg-brand-100` on `DateSegment`) so the ring integrates cleanly with the 1 px field border inside `overflow-clip` panels without a second outer outline.
   - **Discrete toggles** (`Checkbox` indicator, `Radio` indicator, `Switch` track): `outline-none` on the visually-hidden `<input>`, and `group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600` (keyboard-only, matching `Switch.tsx:20`) on the visible indicator/track `span`.
   - **Picker icon buttons & calendar/month grid cells** (`X` clear button, `CalendarDays` button, `ChevronLeft`/`ChevronRight` steppers, `CalendarCell`, `MonthPicker` month grid buttons): `outline-none focus-visible:ring-2 focus-visible:ring-brand-600` / `data-[focus-visible]:ring-2 data-[focus-visible]:ring-brand-600` (matching incumbent `DatePicker.tsx:56,146`, with `relative data-[focus-visible]:z-10` / `relative focus-visible:z-10` on grid cells so the 2 px ring stays cleanly inside trigger groups and grid bounds).
2. Enabled checked/on states of selection toggles: `bg-brand-600` track on enabled checked `Switch`, `bg-brand-600 border-brand-600 text-brand-contrast` box on enabled checked/indeterminate `Checkbox`, and `border-brand-600` ring + `bg-brand-600` inner dot on enabled selected `Radio`.
3. Active/selected picker items: `bg-brand-600 text-brand-contrast` on selected `CalendarCell` and `MonthPicker` month cell; `bg-brand-50 text-brand-700` on selected `Select`/`Combobox` option; `bg-brand-100` on focused `DateSegment`.
4. Picker inline action text: `"Today"` (`DatePicker` footer), `"This month"` (`MonthPicker` footer), and `"Create new category"` (`CategoryPicker` footer) using `text-brand-600 hover:text-brand-700`.

Placeholder, disabled & read-only contrast contract (WAVG-02 / D-03):
- Text values use `--color-text` (`#262520` / `#f4f1ec`).
- Labels use `--color-text-secondary` (`#5f5d5b` / `#c9c3bb`).
- **Placeholder text MUST use `--color-text-tertiary`** (`#696765` light = `5.63:1` on `--color-surface` and `4.79:1` on `--color-surface-alt`; `#aaa39a` dark = `6.26:1` on `--color-surface` and `5.55:1` on `--color-surface-alt`), meeting >= 4.5:1 WCAG AA contrast in both themes. Never use `--color-text-disabled` (`3.34:1` light / `3.16:1` dark) for placeholders.
- Unchecked `Checkbox` box border, `Radio` ring border, and unchecked `Switch` track use `--color-text-tertiary` (5.63:1 / 6.26:1 against `--color-surface`) so resting control boundaries remain clearly legible.
- **Disabled controls never stack `opacity-*` over `--color-text-disabled`**, and **disabled toggles follow `Button.tsx` `filledDisabled` (`bg-surface-alt` + inset `ring-1 ring-inset ring-border` + `bg-text-disabled`/`text-text-disabled`)** with zero `bg-brand-*` color so disabled `Switch` (#264), `Checkbox`, and `Radio` unambiguously read as disabled everywhere (D-03).
- **Read-only controls are visually distinct from disabled controls**: they keep full-contrast readable text (`text-text` / `text-text-secondary`, never `text-text-disabled` or `opacity-75`), use `bg-surface-alt/60` on fields and `bg-surface-alt border-border` (with `bg-text-secondary text-surface` when checked) on toggles, and keep `cursor-default` while remaining focusable in Tab order.

---

## Copywriting Contract

Phase 02 ships shared library primitives and a standalone dev gallery route (`/dev/controls`, which has no form submission flow — only a light/dark theme toggle), rather than a user-facing screen submission CTA. Templates below use `{subject}`, defined by the one shared rule `fieldSubject` (`fieldMessages.ts`, plan 02-16): `errorLabel` when given, else `label` when it is a string, else the control's `aria-label`, and never empty or `undefined`; it covers both naming forms the set supports, a visible string label and an `aria-label` alone (keeping `label`'s or `aria-label`'s own casing when `errorLabel` is omitted so proper nouns such as `Up`, `Plaid`, `SimpleFIN`, `Enable Banking`, `Allotment` and acronyms such as `ABN`, `PAYG`, `GST`, `CSV`, `PDF`, `ID` never lose capitals per `docs/BRAND.md`; callers with sentence-case multi-word labels containing no proper nouns/acronyms may pass lowercase `errorLabel`).

| Element | Copy |
|---------|------|
| Primary CTA | `"Switch to dark theme"` / `"Switch to light theme"` (dev gallery theme switcher on `/dev/controls`); `"Choose from a calendar"` (`DatePicker` calendar icon button `aria-label`); `"Select today"` / `"Today"` (`DatePicker` footer shortcut); `"Select this month"` / `"This month"` (`MonthPicker` footer shortcut); `"Clear {subject}"` (optional `Combobox` / `DatePicker` / `MonthPicker` clear button `aria-label`); `"Create new category"` (`CategoryPicker` inline creator toggle) |
| Empty state heading | `"No matching options"` (`Combobox` generic empty state); `"No categories found"` (`CategoryPicker` exact preserved text for `e2e/tests/review.spec.ts`) |
| Empty state body | `"Type a different search term or clear the filter to see all choices."` (`Combobox` generic); `"New payee: \"{query}\""` (`PayeeCombobox` new-entry hint); `"Select month"` (`MonthPicker` unset trigger placeholder) |
| Preserved `CategoryPicker` inline creator copy | Input `aria-label`: `"New category name"`; input placeholder: `"Category name"`; budget types: `"Fixed"`, `"Flexible"`, `"Non-Monthly"`; submit button: `"Create"` / `"Creating..."` (single word preserved to keep existing behaviour and tests intact); cancel `aria-label`: `"Cancel new category"` |
| Error state | Required empty text field (`Input` / `Textarea`): `"Enter {subject} to continue"`; required choice or picker (`Select` / `Combobox` / `RadioGroup`): `"Select {subject} to continue"`; required toggle (`Checkbox` / `Switch`): caller-supplied `errorMessage`, or default `"Turn on {subject} to continue"`; incomplete/invalid `DatePicker` value: `"Enter the full date, like {example}"` where `{example}` follows the mapped segment locale (`16/11/2026` for `'d MMM yyyy'` and `'dd/MM/yyyy'` -> `'en-AU'`; `11/16/2026` for `'MM/dd/yyyy'` -> `'en-US'`; `16.11.2026` for `'dd.MM.yyyy'` -> `'de-DE'`; `2026-11-16` for `'yyyy-MM-dd'` -> `'en-CA'`), matching segment order rather than word display format; `DatePicker` range errors (bounds formatted via `formatDay` in `client/src/utils/dates.ts`): `"Enter a date between {formatDay(min)} and {formatDay(max)}"` (both), `"Enter a date on or after {formatDay(min)}"` (min only), `"Enter a date on or before {formatDay(max)}"` (max only); `MonthPicker` range errors (bounds formatted via `formatMonth` in `client/src/utils/dateRange.ts`): `"Choose a month between {formatMonth(min)} and {formatMonth(max)}"` (both), `"Choose a month on or after {formatMonth(min)}"` (min only), `"Choose a month on or before {formatMonth(max)}"` (max only); `CurrencyInput`: `"That isn't an amount. Type it like 12.50 or 12,50."` (`UNREADABLE_AMOUNT`, preserved) |
| Destructive confirmation | None in Phase 02 shared form controls (clearing an optional `DatePicker`, `MonthPicker`, or `Combobox` via `"Clear {subject}"` is non-destructive and immediately reversible by picking again) |

---

## Shared Controls Visual & Interaction Contract (WAVG-02, WAVG-03, D-01 to D-11)

### 1. Unified Field States (every control, light and dark)

| State | Visual & Surface Treatment | Interactive & ARIA Contract |
|-------|----------------------------|-----------------------------|
| **Default** | `bg-surface border border-border text-text`, placeholder `text-text-tertiary` | Standard keyboard & pointer input; accessible name via `Label` or `aria-label` |
| **Focus** | Fields/triggers: `outline-none` + `border-brand-600 ring-1 ring-brand-600`; toggles (`Checkbox`/`Radio`/`Switch`): `outline-none` on hidden `<input>` + `outline-2 outline-offset-2 outline-brand-600` on indicator/track; picker icon buttons & grid cells: `outline-none` + `ring-2 ring-brand-600` (enabled by wrapping `:focus-visible` in `@layer base` in `client/src/index.css:363-366`) | Visible in both light and dark; never `outline: none` without replacement ring |
| **Disabled** | Fields: `bg-surface-alt text-text-disabled border-border-light cursor-not-allowed`; `Checkbox`/`Radio`: `bg-surface-alt border-border text-text-disabled cursor-not-allowed`; `Switch`: `filledDisabled` pattern (`bg-surface-alt ring-1 ring-inset ring-border` track + `bg-text-disabled` thumb positioned to reflect `isSelected`, `cursor-not-allowed`) (#264). No `opacity-*` stacking. | `disabled` / `isDisabled`, `aria-disabled="true"`, non-interactive, excluded from tab order where native/React Aria handles it |
| **Invalid** | `border-negative focus:border-negative focus:ring-negative` (toggles: `ring-1 ring-negative`); `FieldError` / `role="alert"` in `text-xs text-negative` | `aria-invalid="true"` / `data-[invalid]`, error text linked via `aria-describedby` (handled automatically by React Aria `FieldError`) |
| **Read-only** | Fields: `bg-surface-alt/60 border-border text-text cursor-default`; toggles: `bg-surface-alt border-border text-text-secondary cursor-default` (checked/selected indicator uses `bg-text-secondary border-text-secondary text-surface` instead of `bg-brand-600`, no `opacity-*` dimming) | `readOnly` / `isReadOnly`, `aria-readonly="true"` / `data-[readonly]`, focusable and selectable, popovers/value mutations blocked |

### 2. Per-Control Contract (`client/src/components/ui/`)

1. **`Label`** — Wraps React Aria `Label` (supports `elementType="span"` for non-labelable control groups such as `RadioGroup`, desktop `Select`, desktop `DatePicker`, and desktop `MonthPicker` so `e2e/tests/accessibility.spec.ts` `strayLabels` never flags an unassociated `<label>`). `text-sm font-medium text-text-secondary`. When `isRequired` / `required` is set, appends `<span aria-hidden="true" className="ml-1 text-negative">*</span>` while the underlying control carries `required` / `isRequired`.
2. **`Field`** — Composes `<Label>`, control slot, optional help text (`<Text slot="description" className="text-xs text-text-tertiary">`), and optional error text (`<FieldError className="text-xs text-negative">`) in a `flex flex-col gap-1` vertical stack; supports optional `errorLabel` (passed to default required validation messages so `{subject}` preserves proper nouns and acronyms). Keeps `Label` left-aligned above the control; wraps long labels and error messages (`break-words`).
3. **`Input`** — Built on React Aria `Input` (inside `TextField` or standalone). Sizes: `md` (`h-10`, `max-md:min-h-11`), `sm` (`h-8`, `max-md:min-h-11`). `px-3 rounded-md text-sm max-md:text-base placeholder:text-text-tertiary outline-none`.
4. **`Textarea`** — Built on React Aria `TextArea`. `min-h-20` (80px, `rows={3}` default), `px-3 py-2 rounded-md text-sm max-md:text-base resize-y placeholder:text-text-tertiary outline-none`.
5. **`Select`** (D-04, D-05) —
   - **Phone (`useIsPhone()`, `< 768px`)**: Renders native `<select>` (`min-h-11 px-3 rounded-md text-base border bg-surface text-text outline-none`) associated with its `<label>` so the OS picker opens.
   - **Desktop (`>= 768px`)**: React Aria `Select` + `<Label elementType="span">` + `Button` trigger (`h-10`, `sm` `h-8`, `px-3 rounded-md justify-between gap-2 outline-none focus-visible:border-brand-600 focus-visible:ring-1 focus-visible:ring-brand-600`, `ChevronDown` icon `aria-hidden`) + `Popover` (`offset={4}`, `rounded-lg border border-border-light bg-surface shadow-card animate-menu-in`, `min-w-[var(--trigger-width)] max-w-[calc(100vw-16px)]`) + `ListBox` (`max-h-72 overflow-y-auto p-1`) + `ListBoxItem` (`min-h-9 px-3 py-2 rounded-sm text-sm flex items-center justify-between gap-2 cursor-default outline-none data-[focused]:bg-hover data-[selected]:bg-brand-50 data-[selected]:text-brand-700`). Supports `isReadOnly` via `isOpen={isReadOnly ? false : undefined}` + `onOpenChange` guard + `data-readonly` attribute so it stays focusable and visually matches read-only fields (`02-RESEARCH.md` Open Question 3).
6. **`Combobox`** (D-05, D-06) —
   - Built on React Aria `ComboBox` (`Group` holding `Input` with `outline-none` + optional `"Clear {subject}"` `Button` + trigger `Button`, `Popover` with `offset={4}` + `ListBox` with `p-1` and `min-h-9 px-3 py-2` items, optional `ListBoxSection` + `Header`, custom empty state, and optional footer slot). Same height, border, focus ring, and phone `max-md:min-h-11` option targets.
   - Used for user-grown lists (accounts, tags, households, people, categories, payees) per D-06; fixed lists use `Select`.
   - **`CategoryPicker` (`components/transactions/CategoryPicker.tsx`)**: Thin wrapper over shared React Aria `Popover` (`offset={4}`) + `Dialog` + `Autocomplete` (`disableAutoFocusFirst={false}` so typing + `Enter` selects the first filtered match, while guarding empty-query `Enter` so nothing is committed when query is `""`) + `TextField` / `Input` (NOT `SearchField`, preserving `role="textbox"` for `getByRole('textbox', { name: 'Search categories' })`) + `ListBox` / `ListBoxSection` / `ListBoxItem` (`min-h-9 px-3 py-2`, `max-md:min-h-11`). Preserves all external props, `"No categories found"` empty state, `"Transfer"` section, and inline `"Create new category"` footer (using shared `Select`/`Input`/`Button` with `type="button"` and `p-3 gap-2` spacing). Existing e2e suites pass with role-corrected option selectors (`button` -> `option` on `ListBoxItem`, documented in PR 2 per `02-CONTEXT.md` Claude's Discretion).
   - **`PayeeCombobox` (`components/transactions/PayeeCombobox.tsx`)**: Thin wrapper over shared `Combobox` (`allowsCustomValue`, `menuTrigger="focus"`, `Popover` `offset={4}`). Preserves `aria-label="Payee"`, `placeholder="Payee"`, `"New payee: \"{query}\""` hint, and free-text entry + selection behaviour. Because React Aria `ComboBox` gives `<Input>` `role="combobox"`, the 5 existing e2e selectors (`getByRole('textbox', { name: 'Payee' })`) update to `getByRole('combobox', { name: 'Payee' })` with the reason documented in PR 2 (`02-CONTEXT.md` Claude's Discretion, `02-RESEARCH.md` Pitfall 1).
7. **`Checkbox`** — React Aria `Checkbox` (wraps a native `<input>`, so callers must never wrap it in an outer `<label>`) with `max-md:min-h-11 max-md:min-w-11 inline-flex items-center gap-2` (plus `max-md:justify-center` when rendered without a label so standalone checkboxes maintain a 44×44 px phone hit target). Visual indicator: `size-5` (`20px × 20px`) `rounded-sm border border-text-tertiary bg-surface` when unchecked; `bg-brand-600 border-brand-600 text-brand-contrast` with `Check` (or `Minus` when `isIndeterminate`) when selected. Focus ring: `outline-none` on the visually-hidden `<input>`, and `group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600` on the indicator. Supports all 5 states including `isDisabled`, `isInvalid`, `isReadOnly`.
8. **`RadioGroup`** — React Aria `RadioGroup` (`<Label elementType="span">` so `strayLabels` never flags an unassociated `<label>`) + `Radio` with vertical (`gap-2`) or horizontal (`flex-wrap gap-4`) orientation. Each `Radio` has `max-md:min-h-11 max-md:min-w-11 inline-flex items-center gap-2` (and `max-md:justify-center` when label-less). Visual indicator: `size-5` (`20px × 20px`) `rounded-full border border-text-tertiary bg-surface`; when `data-[selected]`, `border-brand-600` with centered `size-2` (`8px × 8px`) `rounded-full bg-brand-600` dot. Focus ring: `outline-none` on the visually-hidden `<input>`, and `group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600` on the indicator. Arrow keys move selection within group per WAI-ARIA RadioGroup pattern.
9. **`Switch`** (#264) — React Aria `Switch` (wraps native `<input>` inside `<label>`) with `min-h-11 min-w-11 inline-flex items-center gap-2` touch target. Track: `h-6 w-10 rounded-full transition-colors motion-reduce:transition-none` (`bg-text-tertiary` unchecked, `bg-brand-600` checked; **disabled**: `filledDisabled` pattern `bg-surface-alt ring-1 ring-inset ring-border cursor-not-allowed`; **read-only**: `bg-surface-alt border border-border cursor-default`, checked `bg-text-secondary border-text-secondary`). Thumb: `size-4 rounded-full bg-surface` (unchecked) / `bg-brand-contrast translate-x-4` (checked) / `bg-text-disabled` (disabled, still `translate-x-4` when selected). Invalid (`data-[invalid]`): `ring-1 ring-negative` around track. Focus ring: `outline-none` on the visually-hidden `<input>`, and `group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600` on track.
10. **`DatePicker`** (D-04, D-07, D-08) —
    - **Phone (`< 768px`)**: Native `<input type="date">` (`min-h-11 text-base border rounded-md bg-surface text-text outline-none`) supporting `value`, `minValue`, `maxValue`, `disabled`, `readOnly`, `aria-invalid`, inside `<label>` for valid `strayLabels` association.
    - **Desktop (`>= 768px`)**: React Aria `DatePicker` + `I18nProvider` with fixed `localeFor(dateFormat)` (`'d MMM yyyy'` -> `'en-AU'`, `'dd/MM/yyyy'` -> `'en-AU'`, `'yyyy-MM-dd'` -> `'en-CA'`, `'dd.MM.yyyy'` -> `'de-DE'`, `'MM/dd/yyyy'` -> `'en-US'`, fixing `02-RESEARCH.md` Pitfall 5). `<Label elementType="span">` (`strayLabels` safe). `Group` (`h-10 pl-3 pr-1 gap-1 rounded-md border bg-surface text-sm`) containing typeable `DateInput` / `DateSegment`s (`px-1 data-[type=literal]:px-0 rounded-sm outline-none data-[placeholder]:text-text-tertiary focus:bg-brand-100`, replacing incumbent `px-0.5`), optional `"Clear {subject}"` `X` button (`size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`, replacing incumbent `Clear ${label.toLowerCase()}`), and `"Choose from a calendar"` button (`size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`, `CalendarDays` `aria-hidden`). `Popover` (`offset={4}`, replacing incumbent `offset={6}`, `rounded-lg border border-border-light bg-surface shadow-card p-3`) holds `Calendar` (`header` `gap-2 mb-2` with `ChevronLeft` `"Previous month"` `size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`, `Heading` `text-sm font-medium`, `ChevronRight` `"Next month"` `size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`; `CalendarGrid` `border-collapse` with `size-9` cells, `relative outline-none data-[focus-visible]:z-10 data-[focus-visible]:ring-2 data-[focus-visible]:ring-brand-600`, and `data-[today]:font-medium data-[today]:ring-1 data-[today]:ring-inset data-[today]:ring-border` — never `font-semibold`) plus a footer bar (`mt-2 pt-2 border-t border-border-light flex items-center justify-end`) with the **Today** shortcut button (`"Today"`, `aria-label="Select today"`, `text-xs font-medium text-brand-600 hover:text-brand-700 disabled:text-text-disabled disabled:cursor-not-allowed`, disabled when today from `today(getLocalTimeZone())` is outside `minValue`/`maxValue`).
11. **`MonthPicker`** (D-04, D-11) —
    - Value contract: `'yyyy-MM'` string (`''` when optional/unset), `minValue` / `maxValue` `'yyyy-MM'`.
    - **Phone (`< 768px`)**: Native `<input type="month">` (`min-h-11 text-base border rounded-md bg-surface text-text outline-none`) supporting all 5 states inside `<label>`.
    - **Desktop (`>= 768px`) — the grid form, decided by the owner at the G0 audit gate on 17 Nov 2026 (D-11, `02-03-SUMMARY.md`); typeable `MM/YYYY` segments were the alternative considered (React Aria `DatePicker` lacks `granularity="month"` editable segments) and were not chosen:**
      - `<Label elementType="span">` (`id={labelId}`, `strayLabels` safe).
      - Trigger `Group` (`h-10 pl-3 pr-1 rounded-md border bg-surface text-sm flex items-center gap-1 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600`) containing:
        1. One `DialogTrigger` `<AriaButton>` (`id={triggerId}`, `aria-labelledby="{labelId} {valueId}"` so screen readers announce `"{Label}, Nov 2026"` or `"{Label}, Select month"`, satisfying WCAG 2.5.3 Label in Name; `flex-1 min-w-0 h-full flex items-center justify-between gap-2 text-left outline-none`) displaying `<span id={valueId} className="truncate">` (`formatMonth(value)` e.g. `"Nov 2026"`, or `"Select month"` in `text-text-tertiary`) and a decorative `CalendarRange` icon (`size={16}`, `aria-hidden="true"`, `shrink-0 text-text-tertiary`).
        2. Optional `"Clear {subject}"` `X` `<AriaButton>` (`size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`, `slot={null}`, outside `DialogTrigger`, rendered when `optional && value && !isDisabled && !isReadOnly`).
      - Opens React Aria `Popover` (`offset={4}`) + `Dialog` (`aria-label="Choose a month"`, `p-3 w-[224px] rounded-lg border border-border-light bg-surface shadow-card outline-none`) with year stepper (`flex items-center justify-between gap-2 mb-2` with `ChevronLeft` `"Previous year"` `size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`, year `text-sm font-medium tabular-nums`, `ChevronRight` `"Next year"` `size-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-600`), 3×4 month grid (`grid grid-cols-3 gap-1`, `Jan`–`Dec`, `h-9 rounded-md text-xs font-medium outline-none relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-600`, `aria-pressed`, selected `bg-brand-600 text-brand-contrast`, disabled out-of-range `text-text-disabled cursor-not-allowed`), and footer bar (`mt-2 pt-2 border-t border-border-light flex items-center justify-end`) with **"This month"** shortcut (`aria-label="Select this month"`, `text-xs font-medium text-brand-600 hover:text-brand-700`, disabled when current month is out of range).
12. **Phase 2 scope boundary (`Claude's Discretion`)** — `budget/ExpectedNote.tsx` uses React Aria `DialogTrigger`/`Popover`/`ProgressBar` (zero form fields) and stays untouched until Phase 3 moves Budget.

### 3. Development-Only Gallery & Screenshot Test Mechanics (WAVG-04)

- **Route & production exclusion**: Registered in `client/src/App.tsx` at `/dev/controls` **outside `<AppShell>` and `<AuthGate>`**, guarded by `import.meta.env.DEV || import.meta.env.MODE === 'gallery'`, using a lazy chunk (`DevControlsGallery.tsx`) paired with `client/vite.config.ts`'s `withoutDevGallery()` `resolveId` plugin (`command === 'build' && mode !== 'gallery'` resolves `DevControlsGallery` to `DevControlsGallery.stub.ts`, mirroring `withoutDemoWorker()`). This guarantees production `vite build`, `--mode electron`, `--mode demo`, Docker, and HA bundles stay provably free of gallery code.
- **Dedicated E2E gallery harness**: Built in `e2e/global-setup.ts` via `--mode gallery` on its own fixed port (`GALLERY_PORT = 3181` in `e2e/ports.ts`) and run via a dedicated `gallery` Playwright project (`e2e/playwright.config.ts`) so existing desktop/web/demo test builds stay identical to production.
- **Visual anchor & layout**: `PageHeader` (`<h1>` `"Controls gallery"`, `28px` desktop / `24px` phone, weight `500`) + theme switcher (`"Switch to dark theme"` / `"Switch to light theme"` via `.dark` class) + one surface card per control showing 5 labelled specimen rows (`Default`, `Focus` [an interactive specimen targeted by the keyboard focus pass], `Disabled`, `Invalid`, `Read-only`) plus interactive `CategoryPicker` and `PayeeCombobox` samples, and a `1280×800` / `390×844` responsive grid (`PAGE_GUTTER`, zero horizontal scroll at 390 px).
- **CI determinism & full state/popover screenshot matrix**: Gallery props pin a fixed seed date (`"2026-11-16"`) and month (`"2026-11"`) so Playwright `toHaveScreenshot()` baselines in CI never fail across calendar days. Committed `*-linux.png` baselines are generated via `mcr.microsoft.com/playwright:v1.64.0-noble` after `document.fonts.ready` with `animations: 'disabled'` across three deterministic layers:
  1. **Full-page resting matrix (4 baselines):** `1280×800` light, `1280×800` dark, `390×844` light, `390×844` dark (`fullPage: true`), verifying card layout, resting states, and zero horizontal overflow (`scrollWidth <= 390`).
  2. **Per-control keyboard focus baselines (11 controls × light & dark at `1280×800`):** Rather than faking focus with a gallery-only CSS class, Playwright clears pointer focus, advances keyboard `Tab` onto each control's `Focus` specimen (triggering real browser `:focus-visible` and React Aria `data-focus-visible="true"`), and asserts `expect(rowLocator).toHaveScreenshot(...)`. This renders all 11 focus states deterministically and proves the `client/src/index.css` `@layer base` `:focus-visible` fix in Chromium.
  3. **Named open-popover baselines (`1280×800` light & dark, plus `390×844` light for `Combobox` and `CategoryPicker`):** Playwright opens each popover specimen and captures the trigger + portaled overlay (`Select` `ListBox`, `Combobox` `ListBox`, `CategoryPicker` with search/sections/`Transfer`/`Create new category` footer, `PayeeCombobox` with suggestions + `"New payee: \"...\""` hint, `DatePicker` `Calendar` + `"Today"` footer on `"2026-11-16"`, `MonthPicker` `MonthGrid` + `"This month"` footer on `"2026-11"`).
- Lint checks must remain within `lint/package.json`'s `--max-warnings=128` cap.

---

## UI Considerations

> Shape-rooted UI state coverage for the Phase 02 shared controls and the development gallery, from the
> ui-phase probe (58 considerations over 8 surfaces) and resolved by the owner on 16 Nov 2026. Empty-state
> and error-state wording lives in `## Copywriting Contract` above and is referenced here, not restated.

Applicable state considerations resolved: 10 covered, 4 backstop, 0 unresolved, 5 dismissed with reasons (rows below; each row groups the controls that share an answer)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| `empty` | `Field`, `Input`, `Textarea`, `Select`, `DatePicker`, `MonthPicker`, `Checkbox`, `RadioGroup`, `Switch` | ✅ covered | An unfilled field shows its placeholder in `--color-text-tertiary` with its `Label` still visible; an unset date or month shows empty segments or the placeholder trigger text; an unchecked toggle is its own empty state |
| `empty` | `Combobox`, `CategoryPicker`, `PayeeCombobox` | ✅ covered | A filter with no match shows the Copywriting Contract empty line: "No categories found" for `CategoryPicker`, the new-payee row for `PayeeCombobox`, the generic empty state for `Combobox` and `Select` |
| `empty` | Controls gallery | ➖ dismissed | The gallery always renders its fixed set of cards; it has no data and cannot be empty |
| `loading` | `CategoryPicker` inline create | ✅ covered | While the create request is pending the Create button is disabled and reads "Creating..." |
| `loading` | every other shared control, Controls gallery | ➖ dismissed | Each control gets its options and value from its caller and has no loading state of its own; screens that load data keep handling it themselves (owner, 16 Nov 2026). No loading prop is added |
| `error` | all 11 shared controls through `Field` | ✅ covered | An invalid control shows `border-negative`, `aria-invalid="true"` and an error line under it from `Field`, using the field-specific Copywriting Contract messages |
| `error` | `CategoryPicker` inline create | ✅ covered | A failed create keeps the inline form open with its error line; the typed name is kept |
| `error` | save failures, Controls gallery | ➖ dismissed | A failed save belongs to the screen, not the control; the gallery has no load to fail |
| `partial` | `DatePicker`, `MonthPicker` | ✅ covered | A half-typed date stays editable, counts as no value until complete, and shows the "Enter the full date" message on blur, required or not (a half-typed date holds an enclosing form up); a value change or Clear drops it |
| `partial` | `Field`, `Label`, `Input`, `Textarea`, `Select`, `Combobox` | ✅ covered | Help text, error text, the required mark and the Clear button each render only when they apply, and leave no gap when absent |
| `partial` | `Checkbox`, `RadioGroup`, `Switch`, Controls gallery | ➖ dismissed | A toggle is never partial (no indeterminate state in this phase); the gallery always shows every card |
| `populated` | `Select`, `Combobox`, `CategoryPicker`, `PayeeCombobox` open lists | 🧪 backstop | An open list shows its options with the chosen one marked, capped at `max-h-72` and scrolling inside; proved by the named open-popover gallery screenshots |
| `populated` | `DatePicker` calendar, `MonthPicker` month grid, Controls gallery | 🧪 backstop | The calendar and month grid are a fixed size with the chosen day or month marked; the gallery shows one card per control; proved by the open-popover and full-page gallery screenshots |
| `overflow` | `Select`, `Combobox`, `CategoryPicker`, `PayeeCombobox`, `Input` | 🧪 backstop | A long chosen value or option truncates on one line with an ellipsis; a long list scrolls inside the popover; no popover is wider than the screen less 16 px; proved by the 390 px gallery screenshot with no sideways scroll |
| `overflow` | `DatePicker`, `MonthPicker`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, Controls gallery | 🧪 backstop | Nothing in these controls or the gallery page scrolls sideways at 390 px; proved by the 390 px gallery screenshot |
| `zero-one-many` | `Select`, `Combobox`, `CategoryPicker`, `PayeeCombobox` | ✅ covered | Zero options shows the empty line; one option shows a one-row list and is never chosen automatically; many options scroll; no wording changes between one and many |
| `zero-one-many` | `DatePicker`, `MonthPicker`, Controls gallery | ➖ dismissed | The calendar and month grid are always full; the gallery shows a fixed set of cards |
| `long-text` | `Label`, `Field` help and error text, `Checkbox`, `RadioGroup`, `Switch` labels | ✅ covered | Labels, help text and error messages wrap onto more lines and never truncate; a toggle's label wraps beside it with the toggle aligned to the first line |
| `long-text` | `Textarea`, `Input`, `Select`, `Combobox`, `DatePicker`, `MonthPicker`, Controls gallery | ✅ covered | `Textarea` wraps and scrolls vertically; a single-line value scrolls or truncates inside its box (see `overflow`); gallery card headings wrap |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ➖ dismissed → not applicable, reason recorded; not lifted
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None (no shadcn, no third-party registries; D-01, D-02) | none | not applicable — no registry blocks used |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG (non-blocking; see the items for the planner below)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-11-16 (gsd-ui-checker round 3, after two revision rounds)

### Items for the planner from the final check (not yet reflected above)

The global CSS prerequisite in this contract (moving the `:focus-visible` rule at
`client/src/index.css:363-366` into `@layer base`) is sound in cascade terms, but it changes keyboard focus
on every existing screen: 109 `outline-none` lines across 70 files in `client/src` stop getting the outer
2 px brand outline. The checker read each line; these need handling in the same commit as the layer move,
which should be its own task:

1. `client/src/components/ui/ContextMenu.tsx:174-179` and `:223` use `outline-none` with only
   `focus:bg-hover` (1.19:1 light, 1.29:1 dark). After the move they have no visible keyboard focus. Add a
   brand focus ring there, or remove `outline-none`.
2. `client/src/components/rules/RuleEditorModal.tsx:42` and `:346`, and
   `client/src/components/rules/OptionPicker.tsx:20` and `:98`, use `ring-brand-400`, which `@theme` does not
   define, so the ring falls back to the text colour. Inferred from `@theme`, not checked in a browser.
   Change to `brand-600`, or record it as accepted until Rules moves in Phase 3.
3. This contract's own `ListBoxItem` for `Select` (`outline-none data-[focused]:bg-hover`) has the same
   weak indicator, because React Aria `Select` moves real focus to options. Add a focus-visible ring to the
   option, or state bg-hover as the accepted active-option treatment.
4. Regression guard: run `e2e/tests/accessibility.spec.ts` ("a chart shows the keyboard focus ring, but not
   after a click") plus a keyboard pass over ContextMenu and Rules with the layer move. Unlayered
   third-party CSS on `.ts-chart` could beat the layered ring; not inspected.

Decided at the audit checkpoint (owner gate, 17 Nov 2026, `02-03-SUMMARY.md`; CONTEXT.md D-11): the desktop MonthPicker is the grid form, a button opening a year stepper, a twelve-month grid and "This month".
