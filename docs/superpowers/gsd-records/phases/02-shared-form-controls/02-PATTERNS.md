# Phase 2: Shared form controls - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 29
**Analogs found:** 28 / 29 (1 partial/no-visual-baseline analog: `e2e/tests/gallery/controls-gallery.spec.ts`)

> **Source-tree provenance:** Wave F (Phase 1) code is not merged on `worktree-agent-p02-patterns` yet and lives read-only in `/Users/tristanvanrooyen/wt-f` (branch `wave-f`). Every excerpt below states whether it came from **this worktree** (`worktree-agent-p02-patterns`) or **`wt-f`** (`/Users/tristanvanrooyen/wt-f`). All named analog paths are git-tracked in their respective trees.
>
> **Two-PR split (D-10):** PR 1 ships `docs/ui/FORM-CONTROLS-AUDIT.md` (documentation-only, no version bump, blocking owner checkpoint). PR 2 ships the 11 shared controls (`client/src/components/ui/`), the CSS focus-layer fix, `CategoryPicker`/`PayeeCombobox` rewiring, the dev-only gallery + Playwright visual test, unit tests, and doc updates.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `docs/ui/FORM-CONTROLS-AUDIT.md` | doc | transform | `docs/ui/MAP.md` (`worktree`) | role-match |
| `client/src/components/ui/fieldClasses.ts` | utility | transform | `client/src/components/ui/Button.tsx` & `Input.tsx` (`worktree`) | exact |
| `client/src/components/ui/Label.tsx` | component | event-driven | `client/src/components/ui/DatePicker.tsx` (`worktree`) | exact |
| `client/src/components/ui/Field.tsx` | component | event-driven | `client/src/components/accounts/AccountTypeSelect.tsx` (`wt-f`) & `CurrencyInput.tsx` (`worktree`) | role-match |
| `client/src/components/ui/Input.tsx` | component | event-driven | `client/src/components/ui/Input.tsx` (`worktree`) | exact |
| `client/src/components/ui/Textarea.tsx` | component | event-driven | `client/src/components/ui/Input.tsx` & `files/FileDetailModal.tsx` (`worktree`) | role-match |
| `client/src/components/ui/Select.tsx` | component | event-driven | `client/src/components/ui/DatePicker.tsx` & `Input.tsx` (`worktree`) | exact |
| `client/src/components/ui/Combobox.tsx` | component | event-driven | `client/src/components/transactions/PayeeCombobox.tsx` & `CategoryPicker.tsx` (`worktree`) | exact |
| `client/src/components/ui/Checkbox.tsx` | component | event-driven | `client/src/components/ui/Switch.tsx` (`worktree`) & `settings/ReminderSettings.tsx` (`wt-f`) | role-match |
| `client/src/components/ui/RadioGroup.tsx` | component | event-driven | `client/src/components/settings/PeopleSettings.tsx` & `SidebarFeatureSettings.tsx` (`wt-f`) | role-match |
| `client/src/components/ui/Switch.tsx` | component | event-driven | `client/src/components/ui/Switch.tsx` & `Button.tsx` (`worktree`) | exact |
| `client/src/components/ui/DatePicker.tsx` | component | event-driven | `client/src/components/ui/DatePicker.tsx` & `utils/calendarDay.ts` (`worktree`) | exact |
| `client/src/components/ui/MonthPicker.tsx` | component | event-driven | `client/src/components/ui/MonthRangePicker.tsx` (`worktree`) & `settings/BudgetStartSettings.tsx` (`wt-f`) | exact |
| `client/src/components/ui/CurrencyInput.tsx` | component | event-driven | `client/src/components/ui/CurrencyInput.tsx` (`worktree`) | exact |
| `client/src/components/transactions/CategoryPicker.tsx` | component | event-driven | `client/src/components/transactions/CategoryPicker.tsx` & `ui/DatePicker.tsx` (`worktree`) | exact |
| `client/src/components/transactions/PayeeCombobox.tsx` | component | event-driven | `client/src/components/transactions/PayeeCombobox.tsx` (`worktree`) | exact |
| `client/src/index.css` | config | transform | `client/src/index.css` (`worktree`) | exact |
| `client/src/components/ui/ContextMenu.tsx` | component | event-driven | `client/src/components/ui/ContextMenu.tsx` (`worktree`) | exact |
| `client/src/pages/DevControlsGallery.tsx` | component | event-driven | `client/src/components/ui/PageHeader.tsx` & `pageGutter.ts` (`worktree`) | role-match |
| `client/src/pages/DevControlsGallery.stub.ts` | utility | transform | `client/src/demo/demoWorker.stub.ts` (`worktree`) | exact |
| `client/src/App.tsx` | config | request-response | `client/src/App.tsx` (`worktree`) | exact |
| `client/vite.config.ts` | config | transform | `client/vite.config.ts` (`worktree`) | exact |
| `client/src/components/ui/*.test.ts` | test | transform | `client/src/components/ui/Plant.test.ts` & `EmptyState.test.ts` (`worktree`) | exact |
| `e2e/ports.ts` | config | static | `e2e/ports.ts` (`worktree`) | exact |
| `e2e/global-setup.ts` | config | event-driven | `e2e/global-setup.ts` (`worktree`) | exact |
| `e2e/playwright.config.ts` | config | static | `e2e/playwright.config.ts` (`worktree`) | exact |
| `e2e/tests/fixtures.ts` | test | event-driven | `e2e/tests/fixtures.ts` (`worktree`) | exact |
| `e2e/tests/gallery/controls-gallery.spec.ts` | test | event-driven | `e2e/tests/dialog-focus.spec.ts` & `phone/phone-native.spec.ts` (`worktree`) | partial (no `toHaveScreenshot` analog) |
| `e2e/tests/*.spec.ts` (picker role selector updates) | test | event-driven | `e2e/tests/transactions.spec.ts`, `review.spec.ts`, `payees.spec.ts` (`worktree`) | exact |

---

## Pattern Assignments

### 1. `docs/ui/FORM-CONTROLS-AUDIT.md` (doc, transform — PR 1)

**Analog:** `docs/ui/MAP.md` (`worktree`)
**Core pattern** (lines 1-14): Table-driven inventory with explicit snapshot date, file paths, component folders, and e2e specs so downstream phases can look up every call site without re-scanning:
```markdown
# UI map

One row per route in `client/src/App.tsx`. Line counts are snapshots from `wc -l`, all refreshed on 14 November 2026 (Wave F). Recount with `wc -l client/src/pages/*.tsx` rather than trusting them. Page files are under
`client/src/pages/`, component folders under `client/src/components/`, hooks under
`client/src/hooks/` (only hooks the page imports directly are listed), specs under `e2e/tests/`.
```
Apply the same snapshot-date + file:line + e2e cross-reference format for the G0 audit table, plus D-06 list classification (`Select` vs `Combobox` vs `DatePicker` vs `MonthPicker` vs allowlisted native).

---

### 2. `client/src/components/ui/fieldClasses.ts` (utility, transform)

**Analogs:** `client/src/components/ui/Button.tsx` (`worktree`), `client/src/components/ui/Input.tsx` (`worktree`)
**Core pattern — plain exported class constants and lookup objects (no `cva`, `clsx`, or `tailwind-merge` per D-02):**
From `Button.tsx` (lines 15-36):
```typescript
export const filledDisabled =
  'disabled:bg-surface-alt disabled:text-text-tertiary disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-border';

const sizes = {
  sm: 'h-8 px-3 text-xs max-md:min-h-11 max-md:text-sm',
  md: 'h-10 px-4 text-sm max-md:min-h-11',
};
```
From `Input.tsx` (lines 3-12):
```typescript
// 40px, the height of a md Button beside it; 44px on phones, like a Button there
const inputClass =
  'block h-10 max-md:h-11 rounded-md border border-border px-3 text-sm bg-surface text-text placeholder:text-text-tertiary transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = 'w-full', ...props }, ref) => (
    <input ref={ref} className={`${inputClass} ${className}`} {...props} />
  ),
);
```
> **Note:** Incumbent `DatePicker.tsx`, `MonthRangePicker.tsx`, `Input.tsx`, and `02-RESEARCH.md` snippets contain off-4px-grid classes (`px-0.5`, `py-1.5`, `gap-1.5`, `offset={6}`). Do **not** copy those off-grid values; enforce `02-UI-SPEC.md` spacing (`h-10` / `h-8` / `max-md:min-h-11`, `px-3`, `py-2`, `gap-1` / `gap-2`, `offset={4}`).

---

### 3. `client/src/components/ui/Label.tsx` & `client/src/components/ui/Field.tsx` (components, event-driven)

**Analogs:** `client/src/components/ui/DatePicker.tsx` (`worktree`), `client/src/components/accounts/AccountTypeSelect.tsx` (`wt-f`), `client/src/components/ui/CurrencyInput.tsx` (`worktree`)

**Label pattern** from `DatePicker.tsx` (`worktree`, lines 18, 66, 93):
```tsx
import { Label } from 'react-aria-components';
// ...
const labelClass = 'block text-sm font-medium text-text-secondary mb-1.5';
// ...
<Label className={labelClass}>{label}</Label>
```
**Field help + control + error composition** from `AccountTypeSelect.tsx` (`wt-f`, lines 14-39) and `CurrencyInput.tsx` (`worktree`, lines 115-119):
```tsx
// AccountTypeSelect.tsx (wt-f, lines 14-39)
    <div>
      <label
        htmlFor={`${fieldId}-account-type`}
        className="block text-sm font-medium text-text-secondary mb-1"
      >
        Account type
      </label>
      <select ... />
      <p className="mt-1 text-xs text-text-tertiary">{accountTypeInfo(value).hint}</p>
    </div>
```
```tsx
// CurrencyInput.tsx (worktree, lines 115-119)
      {invalid && (
        <p id={hintId} role="alert" className="mt-1 basis-full text-xs text-negative">
          {UNREADABLE_AMOUNT}
        </p>
      )}
```
**Crucial accessibility constraint** from `e2e/tests/accessibility.spec.ts` (`worktree`, lines 105-110):
```typescript
/** The text of each visible <label> in `scope` that points at no field */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !el.control)
      .map((el) => el.textContent?.trim()),
  );
```
Therefore `Label.tsx` must support `elementType="span"` for non-labelable React Aria groups (`RadioGroup`, desktop `Select`, desktop `DatePicker`, desktop `MonthPicker`), while keeping `<label>` for `<input>`/`<textarea>`/`<select>` (`TextField`, phone `Select`, phone `DatePicker`, phone `MonthPicker`). Use `flex flex-col gap-1` per `02-UI-SPEC.md` §2.2.

---

### 4. `client/src/components/ui/Input.tsx` & `client/src/components/ui/Textarea.tsx` (components, event-driven)

**Analogs:** `client/src/components/ui/Input.tsx` (`worktree`), `client/src/components/files/FileDetailModal.tsx` (`worktree`), `client/src/components/transactions/TransactionDetailPanel.tsx` (`worktree`)

**Critical Phase 2 boundary in `Input.tsx` (`worktree`, lines 21-30):**
```tsx
export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }
>(({ className = 'w-full', compact = false, ...props }, ref) => (
  <select
    ref={ref}
    className={`${compact ? compactSelectClass : inputClass} ${className}`}
    {...props}
  />
));
```
Keep `export const Select` in `ui/Input.tsx` untouched until Phase 4 (`WAVG-10`), because ~80 existing callers import `{ Select } from '../ui/Input'`. The new shared desktop/phone `Select` lives in `client/src/components/ui/Select.tsx`.

**Textarea analog** from `FileDetailModal.tsx` (`worktree`, lines 289-301) and `TransactionDetailPanel.tsx` (`worktree`, lines 546-555):
```tsx
// FileDetailModal.tsx (worktree, lines 291-300)
        <textarea
          value={description}
          maxLength={2000}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (doc.description ?? '') && save({ description: description || null })
          }
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
        />
```
```tsx
// TransactionDetailPanel.tsx (worktree, lines 546-555)
          <textarea
            id={`${fieldId}-notes`}
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes to this transaction..."
            aria-label="Notes"
            rows={3}
            className={`${inputCls} resize-none`}
          />
```
Per `02-UI-SPEC.md` §2.4, build `Textarea.tsx` on React Aria `TextArea` (`rows={3}` default, `min-h-20`, `px-3 py-2 rounded-md text-sm max-md:text-base resize-y placeholder:text-text-tertiary outline-none`) with the unified 5-state classes from `fieldClasses.ts`.

---

### 5. `client/src/components/ui/Select.tsx` (component, event-driven)

**Analogs:** `client/src/components/ui/DatePicker.tsx` (`worktree`), `client/src/components/ui/Input.tsx` (`worktree`), `client/src/components/accounts/AccountTypeSelect.tsx` (`wt-f`)

**Phone/desktop split pattern** from `DatePicker.tsx` (`worktree`, lines 63-81):
```tsx
export function DatePicker({ value, onChange, label, optional, minValue, maxValue }: Props) {
  const isPhone = useIsPhone();
  // ...
  if (isPhone)
    return (
      <label className="block">
        <span className={labelClass}>{label}</span>
        <input
          type="date"
          value={value}
          min={minValue}
          max={maxValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-11 px-3 py-2 text-base border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
        />
      </label>
    );
```
**Optgroup/grouped option support** from `AccountTypeSelect.tsx` (`wt-f`, lines 28-36):
```tsx
        {ACCOUNT_GROUPS.map((g) => (
          <optgroup key={g.value} label={g.label}>
            {ACCOUNT_TYPES.filter((t) => t.group === g.value).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
```
On desktop (`!isPhone`), `Select.tsx` uses React Aria `Select` + `<Label elementType="span">` + `Button` trigger (`h-10`, `sm` `h-8`) + `Popover` (`offset={4}`) + `ListBox` / `ListBoxSection` / `ListBoxItem` (`min-h-9 px-3 py-2`), supporting `isReadOnly` via `isOpen={isReadOnly ? false : undefined}` + `onOpenChange` guard + `data-readonly` (`02-UI-SPEC.md` §2.5).

---

### 6. `client/src/components/ui/Combobox.tsx` (component, event-driven)

**Analogs:** `client/src/components/transactions/PayeeCombobox.tsx` (`worktree`), `client/src/components/transactions/CategoryPicker.tsx` (`worktree`)

**Imports & React Aria popover pattern** from `DatePicker.tsx` (`worktree`, lines 3-20, 118-123):
```tsx
import {
  Button as AriaButton,
  Dialog,
  Group,
  Popover,
} from 'react-aria-components';
// ...
<Popover
  placement="bottom end"
  offset={6} // use offset={4} per 02-UI-SPEC.md
  className="rounded-lg border border-border-light bg-surface shadow-card outline-none data-[entering]:animate-menu-in"
>
  <Dialog className="p-3 outline-none">...</Dialog>
</Popover>
```
`Combobox.tsx` provides:
1. Standard React Aria `ComboBox` (`Group` holding `Input` + optional clear `Button` + chevron `Button`, `Popover` `offset={4}`, `ListBox` with `ListBoxSection`/`Header`/`ListBoxItem`, custom empty state, optional footer slot).
2. A shared `Popover` + `Autocomplete` + `TextField` + `ListBox` composition (or exported helper) so `CategoryPicker.tsx` can reuse the exact same `Popover` / `ListBox` / `ListBoxSection` / `ListBoxItem` styling without duplicating list markup.

---

### 7. `client/src/components/ui/Checkbox.tsx` & `client/src/components/ui/RadioGroup.tsx` (components, event-driven)

**Analogs:** `client/src/components/ui/Switch.tsx` (`worktree`), `client/src/components/settings/ReminderSettings.tsx` (`wt-f`), `client/src/components/settings/PeopleSettings.tsx` (`wt-f`), `client/src/components/settings/SidebarFeatureSettings.tsx` (`wt-f`)

**Checkbox layout + description analog** from `ReminderSettings.tsx` (`wt-f`, lines 96-109):
```tsx
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 rounded border-border text-brand-600 focus:ring-brand-600"
              />
              <span className="text-sm text-text-secondary">
                Send reminders
                <span className="block text-xs text-text-tertiary">
                  They go to your phone or email, chosen under Password codes.
                </span>
              </span>
            </label>
```
**RadioGroup analog** from `PeopleSettings.tsx` (`wt-f`, lines 112-128) and `SidebarFeatureSettings.tsx` (`wt-f`, lines 77-81):
```tsx
// PeopleSettings.tsx (wt-f, lines 112-128)
    <fieldset className="mt-4">
      <legend className="text-xs font-medium text-text-secondary">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text">
        {(['phone', 'email', 'both'] as const).map((c) => (
          <label key={c} className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name={name}
              checked={value === c}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            {c === 'phone' ? 'My phone' : c === 'email' ? 'My email' : 'Both'}
          </label>
        ))}
      </div>
    </fieldset>
```
**React Aria rules from `02-UI-SPEC.md` §§2.7–2.8:**
- `Checkbox.tsx`: React Aria `Checkbox` renders a `<label>` wrapping its hidden `<input>`; callers must not wrap it in an outer `<label>`. Use `max-md:min-h-11 max-md:min-w-11 inline-flex items-center gap-2` (`max-md:justify-center` when label-less), `size-5` indicator box, and `group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600`.
- `RadioGroup.tsx`: React Aria `RadioGroup` with `<Label elementType="span">` (for `strayLabels`) + `Radio` items (`size-5` indicator circle, `size-2` inner dot when `data-[selected]`).

---

### 8. `client/src/components/ui/Switch.tsx` (component, event-driven — fixes `#264`)

**Analogs:** `client/src/components/ui/Switch.tsx` (`worktree`), `client/src/components/ui/Button.tsx` (`worktree`), `client/src/pages/Welcome.tsx` (`worktree`)

**Existing `Switch.tsx` (`worktree`, lines 12-32):**
```tsx
export function Switch({ checked, onCheckedChange, className = '', ...props }: Props) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-10 rounded-full transition-colors motion-reduce:transition-none ${checked ? 'bg-brand-600' : 'bg-text-tertiary'}`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${checked ? 'translate-x-4 bg-brand-contrast' : 'bg-surface'}`}
        />
      </span>
    </button>
  );
}
```
**Existing sole caller in `Welcome.tsx` (`worktree`, lines 256-274):**
```tsx
                    <label
                      key={feature}
                      className="flex min-h-11 items-center justify-between gap-4 py-3 text-sm text-text-secondary"
                    >
                      <span>
                        {FEATURE_PROMPTS[feature]}{' '}
                        <span className="text-text-tertiary">({label})</span>
                      </span>
                      <Switch
                        aria-label={FEATURE_PROMPTS[feature] + ' (' + label + ')'}
                        checked={progress?.navFeatures?.[feature] === 'shown'}
                        disabled={!progress || !canSave}
                        onCheckedChange={(checked) => ...}
                      />
                    </label>
```
> **Important caller compatibility note:** Because React Aria `Switch` itself renders a `<label>` wrapping `<input type="checkbox" role="switch">`, `Welcome.tsx:256` wraps `<Switch>` in an outer `<label>`. Check during planning whether `Welcome.tsx:256` must swap its outer `<label>` to `<div>` (with `aria-label` kept on `<Switch>`) or pass `children` to `Switch` so Phase 2 does not create nested `<label><label>...</label></label>` HTML!

**Disabled look fix (`#264`) from `Button.tsx` (`worktree`, lines 15-16):**
```typescript
export const filledDisabled =
  'disabled:bg-surface-alt disabled:text-text-tertiary disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-border';
```
Apply via React Aria `group-data-[disabled]:bg-surface-alt group-data-[disabled]:ring-1 group-data-[disabled]:ring-inset group-data-[disabled]:ring-border` on the track and `group-data-[disabled]:bg-text-disabled` on the thumb (zero `bg-brand-*` when disabled, zero `opacity-*` stacking).

---

### 9. `client/src/components/ui/DatePicker.tsx` (component, event-driven)

**Analogs:** `client/src/components/ui/DatePicker.tsx` (`worktree`), `client/src/utils/calendarDay.ts` (`worktree`), `client/src/utils/dates.ts` (`worktree`)

**Existing React Aria + phone pattern (`DatePicker.tsx`, lines 29-34, 83-156):**
```tsx
function localeFor(format: DateFormatOption): string {
  if (format === 'dd/MM/yyyy') return 'en-AU';
  if (format === 'yyyy-MM-dd') return 'en-CA';
  if (format === 'dd.MM.yyyy') return navigator.language;
  return 'en-US';
}
```
Fix per `02-RESEARCH.md` Pitfall 5 & `02-UI-SPEC.md` §2.10: map `'d MMM yyyy'` -> `'en-AU'` and `'dd.MM.yyyy'` -> `'de-DE'` so day-first preferences do not fall through to `'en-US'`.

**Today helper pattern** from `client/src/utils/calendarDay.ts` (`worktree`, lines 36-41):
```typescript
/** The day on the wall clock of `date` on this device */
export function localDayIso(date: Date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Today as `YYYY-MM-DD` on this device */
export const todayIso = (): string => localDayIso();
```
Use `today(getLocalTimeZone())` (from `@internationalized/date`) for `Calendar` range checks and `todayIso()` (never `.toISOString().slice(0, 10)`, which ESLint bans) for the `"Today"` shortcut inside `<Dialog>{({ close }) => ...}</Dialog>`. Replace `<Label>` with `<Label elementType="span">` (`strayLabels` safe), `px-0.5` -> `px-1`, `offset={6}` -> `offset={4}`, `font-semibold` -> `font-medium`, and add `isDisabled`/`disabled`, `isInvalid`/`invalid`, `isReadOnly`/`readOnly`, `isRequired`/`required`, `id`, `description`, `errorMessage`, `className`.

---

### 10. `client/src/components/ui/MonthPicker.tsx` (component, event-driven — D-11)

**Analogs:** `client/src/components/ui/MonthRangePicker.tsx` (`worktree`), `client/src/components/settings/BudgetStartSettings.tsx` (`wt-f`), `client/src/utils/dateRange.ts` (`worktree`)

**Phone native `<input type="month">` pattern** from `BudgetStartSettings.tsx` (`wt-f`, lines 64-73):
```tsx
        <label>
          <span className="block text-xs font-medium text-text-secondary mb-1">Start month</span>
          <input
            type="month"
            value={value}
            max={thisMonth}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
          />
        </label>
```
**Desktop 12-month grid + year stepper pattern** from `MonthRangePicker.tsx` (`worktree`, lines 41-107):
```tsx
function MonthGrid({
  title,
  value,
  onPick,
  isDisabled,
}: {
  title: string;
  value: string;
  onPick: (v: string) => void;
  isDisabled: (v: string) => boolean;
}) {
  const [year, setYear] = useState(() => Math.max(MIN_YEAR, parseInt(value.slice(0, 4), 10) || 0));
  // ...
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          className={navBtn}
          disabled={year <= MIN_YEAR}
          onClick={() => setYear(year - 1)}
          aria-label="Previous year"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-text tabular-nums">{year}</span>
        <button
          type="button"
          className={navBtn}
          onClick={() => setYear(year + 1)}
          aria-label="Next year"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((m, i) => {
          const v = ym(year, i);
          const selected = v === value;
          const disabled = isDisabled(v);
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={format(parseISO(`${v}-01`), 'MMMM yyyy')}
              onClick={() => onPick(v)}
```
Rebuild the popover container on React Aria `DialogTrigger` + `Popover` (`offset={4}`) + `Dialog` (`aria-label="Choose a month"`) instead of manual `createPortal`/`placeNear`/`mousedown`, use `formatMonth` from `client/src/utils/dateRange.ts` for trigger display (`"Select month"` placeholder in `text-text-tertiary`), add optional `"Clear {subject}"` `X` button + `"This month"` footer shortcut, and apply `02-UI-SPEC.md` grid/font rules (`w-[224px]`, `p-3`, `h-9`, `font-medium`, `focus-visible:ring-2 focus-visible:ring-brand-600`). Keep `MonthRangePicker.tsx` intact in Phase 2 (optionally extract reusable `MonthGrid`).

> **Superseded by D-11 (owner gate, 17 Nov 2026, `02-03-SUMMARY.md`):** `MonthRangePicker` is rebuilt in Phase 2 on `MonthPicker`'s shared `MonthGrid`, native on phones, in plan 02-14; its three users move with the set PR. The "keep `MonthRangePicker.tsx` intact" sentence above no longer applies; the pattern itself stands.

---

### 11. `client/src/components/ui/CurrencyInput.tsx` (component, event-driven)

**Analog:** `client/src/components/ui/CurrencyInput.tsx` (`worktree`, lines 109-113):
```tsx
        className={`block w-full rounded-md border px-3 py-2 text-sm text-text placeholder-text-disabled focus:outline-none focus:ring-1 ${
          invalid
            ? 'border-negative focus:border-negative focus:ring-negative'
            : 'border-border focus:border-brand-600 focus:ring-brand-600'
        } ${className}`}
```
Minimal edit: replace `placeholder-text-disabled` with `placeholder:text-text-tertiary` (5.63:1 light / 6.26:1 dark on `surface`, verified in `lint/tokens/contrast.test.js:39`).

---

### 12. `client/src/components/transactions/CategoryPicker.tsx` (component, event-driven)

**Analogs:** `client/src/components/transactions/CategoryPicker.tsx` (`worktree`), `client/src/components/ui/DatePicker.tsx` (`worktree`)

**External prop contract to preserve (`CategoryPicker.tsx`, lines 9-25):**
```tsx
interface Props {
  value?: string | null;
  onChange: (id: string | null) => void;
  groups: CategoryGroup[];
  onClose: () => void;
  position?: 'below' | 'above';
  transferAccounts?: { id: string; name: string }[];
  fullWidth?: boolean;
  anchor?: HTMLElement | null;
  allowNone?: boolean;
  noneLabel?: string;
}
```
**Critical invariants from `CategoryPicker.tsx` (lines 40-42, 109-128, 195-204, 265-353):**
1. Hidden categories stay out unless `c.id === value`; `"Transfer"` section lists `transfer:<id>` options; `allowNone` offers `noneLabel` (`"Uncategorised"` / `"No default category"`).
2. Search input uses `<TextField aria-label="Search categories">` + `<Input type="text" placeholder="Search categories..." autoFocus />` (NOT `SearchField`) so `getByRole('textbox', { name: 'Search categories' })` keeps matching.
3. React Aria `Autocomplete` (`disableAutoFocusFirst={false}`) inside `<Popover>` + `<Dialog>` auto-highlights the first filtered match so typing + `Enter` selects without `ArrowDown`; guard empty-query `Enter` so pressing `Enter` when `query === ''` does not accidentally select `"Uncategorised"`.
4. Empty state exact copy: `"No categories found"`.
5. Inline `"Create new category"` footer stays in `<Popover>` footer below `<ListBox>` with all buttons `type="button"` (never submitting an outer form like `RecurringFormModal`).

---

### 13. `client/src/components/transactions/PayeeCombobox.tsx` (component, event-driven)

**Analog:** `client/src/components/transactions/PayeeCombobox.tsx` (`worktree`, lines 4-18, 45-62, 66-101):
```tsx
interface PayeeValue {
  id: string | null;
  name: string;
}

interface Props {
  value: PayeeValue;
  onChange: (v: PayeeValue) => void;
  payees: Payee[];
  className?: string;
  fieldClassName?: string;
  id?: string;
}
```
Preserve:
- Top 8 matching payees (`query ? filter(...).slice(0, 8) : payees.slice(0, 8)`)
- Free-text entry (`allowsCustomValue`, `onInputChange` calls `onChange({ id: null, name })`; `onSelectionChange` calls `onChange({ id: payee.id, name: payee.name })`)
- `menuTrigger="focus"`, `aria-label="Payee"`, `placeholder="Payee"`, and `"New payee: \"${query}\""` hint row when `query && !exactMatch`
- Support `fieldClassName` / `className` so existing callers (`TransactionFormRow.tsx:264`, `TransactionDetailPanel.tsx:528`) keep their layout until Phases 3–4.

---

### 14. `client/src/index.css` & `client/src/components/ui/ContextMenu.tsx` (global focus layer prerequisite)

**Analogs:** `client/src/index.css` (`worktree`), `client/src/components/ui/ContextMenu.tsx` (`worktree`), `client/src/components/rules/OptionPicker.tsx` & `RuleEditorModal.tsx` (`worktree`)

**Layer pattern** from `client/src/index.css` (`worktree`, lines 362-370):
```css
/* Consistent keyboard focus without changing mouse or touch interactions. */
:focus-visible {
  outline: 2px solid var(--color-brand-600);
  outline-offset: 3px;
}

/* Scrollbar. In the base layer so a utility on one element (a tab row hiding its own
   scrollbar) wins; unlayered, these rules beat every utility. */
@layer base {
```
Move `:focus-visible` (lines 363-366) inside `@layer base { ... }` (keeping `.scroll-row :focus-visible` at lines 305-307 unlayered).

**Flagged sibling fixes in the same commit (`02-UI-SPEC.md` Checker items):**
1. `ContextMenu.tsx` (`worktree`, lines 174-180, 223): currently uses `outline-none` with only `focus:bg-hover` / `focus:bg-negative-subtle`. Add a visible brand focus ring (e.g., `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600`) or remove `outline-none` so keyboard focus stays visible after the layer move.
2. `RuleEditorModal.tsx` (`worktree`, lines 41-42, 346) and `OptionPicker.tsx` (`worktree`, lines 19-20, 98): currently use `focus:ring-brand-400` / `focus-within:ring-brand-400`, which is undefined in `@theme` (`index.css` defines `brand-50..300, 500..800`). Change to `brand-600` (or explicitly document deferring to Phase 3).

---

### 15. `client/src/pages/DevControlsGallery.tsx`, `DevControlsGallery.stub.ts`, `client/src/App.tsx`, `client/vite.config.ts` (dev-only gallery & build isolation)

**Analogs:** `client/src/demo/demoWorker.stub.ts`, `client/vite.config.ts`, `client/src/App.tsx`, `client/src/components/ui/PageHeader.tsx`, `client/src/components/ui/pageGutter.ts` (`worktree`)

**Compile-time stub pattern** from `client/src/demo/demoWorker.stub.ts` (`worktree`, lines 1-4):
```typescript
// Used instead of demoWorker.ts in every build except the demo (see vite.config.ts)
export function startDemoWorker(): Worker {
  throw new Error('The demo worker is only in the demo build (vite --mode demo)');
}
```
**Vite `resolveId` plugin pattern** from `client/vite.config.ts` (`worktree`, lines 95-114):
```typescript
function withoutDemoWorker(): Plugin {
  const real = normalizePath(path.resolve(import.meta.dirname, 'src/demo/demoWorker.ts'));
  const stub = normalizePath(path.resolve(import.meta.dirname, 'src/demo/demoWorker.stub.ts'));
  return {
    name: 'flybudget-without-demo-worker',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('demoWorker')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && normalizePath(resolved.id) === real ? stub : null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'demo' ? [demoServerModules(), demoPage()] : [withoutDemoWorker()]),
  ],
```
Add `withoutDevGallery()` enabled when `command === 'build' && mode !== 'gallery'` (note: destructure `({ command, mode })` in `defineConfig`), swapping `src/pages/DevControlsGallery.tsx` -> `src/pages/DevControlsGallery.stub.ts` (default export `() => null`).

**Route placement pattern** from `client/src/App.tsx` (`worktree`, lines 66-72):
```tsx
  return (
    <AuthGate>
      <Router>
        <Routes>
          <Route path="/welcome" element={page(WelcomePage)} />
          <Route element={<AppShell />}>
```
Mount `<Route path="/dev/controls" element={...} />` **outside `<AuthGate>` and `<AppShell>`**, guarded by `import.meta.env.DEV || import.meta.env.MODE === 'gallery'`, using `PageHeader` (`PageHeader.tsx:19-60`) and `PAGE_GUTTER` (`pageGutter.ts:6`).

---

### 16. `client/src/components/ui/*.test.ts` (unit tests, transform)

**Analogs:** `client/src/components/ui/Plant.test.ts` & `EmptyState.test.ts` (`worktree`)
**Core pattern** from `Plant.test.ts` (`worktree`, lines 1-8, 29-37):
```typescript
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Plant, plantStage, type PlantStage } from './Plant';

const STAGES: PlantStage[] = ['seed', 'seedling', 'bud', 'flower'];
const render = (props: Parameters<typeof Plant>[0]) =>
  renderToStaticMarkup(createElement(Plant, props));
// ...
    const html = render({ stage });
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
```
Client unit tests run in Node without `jsdom`. Use `renderToStaticMarkup(createElement(...))` to assert ARIA attributes, token-only classes (no hex literals, no `text-disabled` on placeholders, disabled `Switch` uses `bg-surface-alt` / `bg-text-disabled` instead of `bg-brand-600`), and `window.matchMedia` / `useIsPhone` phone-branch rendering if mocked cleanly.

---

### 17. `e2e/ports.ts`, `e2e/global-setup.ts`, `e2e/playwright.config.ts`, `e2e/tests/fixtures.ts`, and `e2e/tests/*.spec.ts`

**Analogs:** `e2e/ports.ts`, `e2e/global-setup.ts`, `e2e/playwright.config.ts`, `e2e/tests/fixtures.ts`, `e2e/tests/transactions.spec.ts`, `review.spec.ts`, `payees.spec.ts` (`worktree`)

1. **`e2e/ports.ts`** (lines 6-7): reserve `export const GALLERY_PORT = 3181;` (next unused port after `3180`).
2. **`e2e/global-setup.ts`** (lines 45-50, 196-245): call `buildClient(path.join(dir, 'client-gallery'), 'gallery')` and start a static server on `GALLERY_PORT` (mirroring `startDemoServer`, serving `index.html` fallback for `/dev/controls` browser routing) and close it in the teardown callback (lines 363-370).
3. **`e2e/playwright.config.ts`** (lines 38-74): add `{ name: 'gallery', testMatch: /\/tests\/gallery\/.*\.spec\.ts$/, use: { baseURL: \`http://localhost:${GALLERY_PORT}\` } }` and exclude `gallery` from `desktop`'s `testIgnore` regex (line 41: `/\/tests\/(server-mode|phone|demo|multi-user|gallery)\//`).
4. **`e2e/tests/fixtures.ts`** (lines 201-209): model `fillDate(field, iso)` after `typeAmount`:
   ```typescript
   export async function typeAmount(field: Locator, amount: string) {
     const page = field.page();
     await field.click();
     await expect(field).toBeFocused();
     await page.keyboard.press('ControlOrMeta+A');
     await page.keyboard.type(amount);
     await page.keyboard.press('Tab');
   }
   ```
   `fillDate` inspects whether the control is a native `<input type="date">` (phone: `.fill(iso)`) or React Aria `DateInput` segments (desktop: targets `[data-type="year"]`, `[data-type="month"]`, `[data-type="day"]` so it works regardless of `dateFormat`).
5. **Existing e2e selector updates (`02-RESEARCH.md` Pitfalls 1 & 2, verified in `transactions.spec.ts`, `review.spec.ts`, `payees.spec.ts`):**
   - `PayeeCombobox` (`textbox` -> `combobox`): update `getByRole('textbox', { name: 'Payee' })` (e.g., `transactions.spec.ts:27`) to `getByRole('combobox', { name: 'Payee' })`.
   - `CategoryPicker` (`button` -> `option` on `ListBoxItem`): update category option selectors (`transactions.spec.ts:179`, `review.spec.ts:48,55,56`) from `getByRole('button', ...)` to `getByRole('option', ...)`, while keeping `getByRole('textbox', { name: 'Search categories' })` (`payees.spec.ts:73`, `review.spec.ts:33`, `transactions.spec.ts:862`) and `getByRole('button', { name: 'Create new category' })` (`review.spec.ts:43`).

---

## Shared Patterns

### Design Tokens & State Rules
**Source:** `client/src/index.css` (`worktree`, lines 24-65, 193-227) & `lint/tokens/contrast.test.js` (`worktree`, lines 35-60)
**Apply to:** All 11 `ui/` controls, `CurrencyInput`, `CategoryPicker`, `PayeeCombobox`, `DevControlsGallery`
```css
/* Light (@theme) -> Dark (.dark) verified tokens */
--color-surface: #ffffff;        /* -> #262320 */
--color-surface-alt: #efece9;    /* -> #302c28 (disabled/read-only fills) */
--color-hover: #eeebe8;          /* -> #3a3531 */
--color-border: #e4e1de;         /* -> #4a443e */
--color-border-light: #efece9;   /* -> #3a3531 */
--color-text: #262520;           /* -> #f4f1ec */
--color-text-secondary: #5f5d5b; /* -> #c9c3bb (labels) */
--color-text-tertiary: #696765;  /* -> #aaa39a (placeholders: 5.63:1 / 6.26:1) */
--color-text-disabled: #8f8c8a;  /* -> #766f67 (disabled controls only; NEVER placeholders) */
--color-brand-600: #bf3e00;      /* -> #ff8a57 (focus ring, active fill) */
--color-negative: #cb2b30;       /* -> #ff8f8c (invalid border/text, required *) */
```

### Phone Native Branching & Touch Targets
**Source:** `client/src/hooks/useIsPhone.ts` (`worktree`, lines 4-21), `client/src/index.css` (lines 283-289), `e2e/tests/phone/phone-native.spec.ts` (lines 8-20)
**Apply to:** `Select`, `DatePicker`, `MonthPicker` (native branch under `768px`), and `Checkbox`, `RadioGroup`, `Switch`, `ListBoxItem` (`min-h-11` = 44px phone targets)
```typescript
export const PHONE_MAX_WIDTH = 767;
export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
```
And `index.css` lines 283-289 guarantees `max(16px, 1em)` on phone `<input>`, `<select>`, `<textarea>` to prevent iOS focus zoom; controls also declare `max-md:text-base` and `max-md:min-h-11`.

### Modal `Escape` & `overflow-clip` Compatibility
**Source:** `client/src/components/ui/Modal.tsx` (`worktree`, lines 153-157), `client/src/components/ui/MonthRangePicker.tsx` (`worktree`, lines 186-191)
**Apply to:** `Select`, `Combobox`, `DatePicker`, `MonthPicker`, `CategoryPicker`, `PayeeCombobox`
`Modal.tsx` closes on `Escape` unless `e.defaultPrevented`:
```typescript
if (e.key === 'Escape') {
  if (!e.defaultPrevented) requestCloseRef.current();
  return;
}
```
Verify in Playwright (`controls-gallery.spec.ts` / `dialog-focus.spec.ts`) that pressing `Escape` when a React Aria `Select`, `ComboBox`, `DatePicker`, or `MonthPicker` popover is open inside `Modal` closes only the popover, not the outer `Modal`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `e2e/tests/gallery/controls-gallery.spec.ts` (Playwright `toHaveScreenshot` visual assertions) | test | event-driven | `e2e/playwright.config.ts:34` currently uses `screenshot: 'only-on-failure'` and has zero `toHaveScreenshot()` baselines in the repository. Use `02-RESEARCH.md` Pattern 5 and `02-UI-SPEC.md` §3 (`document.fonts.ready`, `animations: 'disabled'`, `*-linux.png` baselines generated in `mcr.microsoft.com/playwright:v1.64.0-noble`), while reusing `dialog-focus.spec.ts` (`Tab` focus) and `phone-native.spec.ts` (44 px target / overflow) patterns for interaction assertions. |

---

## Metadata

**Analog search scope:** `client/src/components/ui/`, `client/src/components/transactions/`, `client/src/components/rules/`, `client/src/components/files/`, `client/src/pages/`, `client/src/demo/`, `client/src/hooks/`, `client/src/utils/`, `client/src/index.css`, `client/vite.config.ts`, `lint/tokens/`, `e2e/` (`worktree-agent-p02-patterns`), plus `client/src/components/settings/`, `client/src/components/accounts/`, `client/src/components/budget/` (`/Users/tristanvanrooyen/wt-f`, branch `wave-f`).
**Files scanned:** ~45 tracked files across both trees
**Pattern extraction date:** 2026-11-16
