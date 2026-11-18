// The one place the shared form controls' class strings live (02-UI-SPEC.md, "Unified Field
// States"). Plain strings built only from the @theme tokens in index.css: no class helper library
// (D-02), no hex colour, no opacity dimming. Off-grid spacing from older files (px-0.5, py-1.5,
// gap-1.5) is not copied here.

// Discrete toggles (Switch track; later the Checkbox and Radio indicators). The toggle's root
// is a React Aria `group` that carries data-focus-visible, so the ring shows for the keyboard only.

/** The 2 px brand outline around a toggle's visible indicator when the keyboard is on it */
export const toggleFocusRing =
  'group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600';

/**
 * A disabled toggle, like Button's filledDisabled: a surface-alt fill with an inset border, never
 * a brand colour (issue 264). The 1 px ring is inset so the indicator keeps its size and its
 * thumb or mark stays centred.
 */
export const toggleDisabled = 'bg-surface-alt ring-1 ring-inset ring-border cursor-not-allowed';

/** A read-only toggle: the same quiet fill and border, with no not-allowed cursor */
export const toggleReadOnly = 'bg-surface-alt ring-1 ring-inset ring-border cursor-default';

/** An invalid toggle: a 1 px negative ring around the indicator */
export const toggleInvalid = 'ring-1 ring-negative';

// Text fields (Input; later Textarea and the picker triggers). Every state applies through the
// native attribute and React Aria's data attribute alike, because Input is used bare on existing
// screens as well as inside a Field. Width is left to the caller (Input's default className is
// w-full), so a caller's own width never fights one set here.

/** A field's box: border, radius, padding, type and placeholder, with the 1 px brand focus ring */
export const fieldBase =
  'block rounded-md border border-border bg-surface px-3 text-sm max-md:text-base text-text placeholder:text-text-tertiary outline-none transition-colors focus:border-brand-600 focus:ring-1 focus:ring-brand-600';

/** 40 px beside a md Button, 32 px beside a sm one; always 44 px on phones */
export const fieldHeights = { md: 'h-10 max-md:min-h-11', sm: 'h-8 max-md:min-h-11' } as const;

/**
 * Disabled, read-only and invalid, through native attributes and React Aria's data attributes.
 * Read-only uses the attribute, not `:read-only`, which also matches a disabled input.
 */
export const fieldStates = [
  'disabled:bg-surface-alt disabled:text-text-disabled disabled:border-border-light disabled:cursor-not-allowed',
  'data-[disabled]:bg-surface-alt data-[disabled]:text-text-disabled data-[disabled]:border-border-light data-[disabled]:cursor-not-allowed',
  '[&[readonly]]:bg-surface-alt/60 [&[readonly]]:border-border [&[readonly]]:text-text [&[readonly]]:cursor-default',
  // A button or native select has no readonly attribute, so the Select marks its trigger instead
  'data-[readonly]:bg-surface-alt/60 data-[readonly]:border-border data-[readonly]:text-text data-[readonly]:cursor-default',
  'aria-invalid:border-negative aria-invalid:focus:border-negative aria-invalid:focus:ring-negative',
  'data-[invalid]:border-negative data-[invalid]:focus:border-negative data-[invalid]:focus:ring-negative',
].join(' ');

/** A field's visible label */
export const labelClass = 'text-sm font-medium text-text-secondary';

/** Help text under a field */
export const helpClass = 'text-xs text-text-tertiary';

/** The error line under a field */
export const errorClass = 'text-xs text-negative';

// Lists (Select; later Combobox and the pickers). React Aria moves real focus onto the options, so
// the keyboard's option gets a ring as well as the hover fill (02-UI-SPEC.md, final check item 3).

/**
 * A list's popover: the card surface with the menu entrance, at least as wide as its trigger and
 * never wider than the screen less 16 px
 */
export const popoverClass =
  'rounded-lg border border-border-light bg-surface shadow-card outline-none data-[entering]:animate-menu-in min-w-[var(--trigger-width)] max-w-[calc(100vw-16px)]';

/** The list inside a popover: capped at 288 px, scrolling inside */
export const listClass = 'max-h-72 overflow-y-auto p-1 outline-none';

/**
 * One option: hover and keyboard fill, an inset brand ring for the keyboard, the brand-50 fill
 * when chosen. Its label truncates on one line (the option's own `truncate` span).
 */
export const optionClass =
  'flex items-center justify-between gap-2 min-h-9 max-md:min-h-11 px-3 py-2 rounded-sm text-sm text-text cursor-default outline-none hover:bg-hover data-[focused]:bg-hover data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-brand-600 data-[selected]:bg-brand-50 data-[selected]:text-brand-700 data-[disabled]:text-text-disabled';
