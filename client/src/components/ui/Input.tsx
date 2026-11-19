import { forwardRef } from 'react';
import { Input as AriaInput } from 'react-aria-components';
import { fieldBase, fieldHeights, fieldStates } from './fieldClasses';

// The native Select's own field look, kept as it was until Phase 4 replaces this Select (WAVG-10)
const inputClass =
  'block h-10 max-md:h-11 rounded-md border border-border px-3 text-sm bg-surface text-text placeholder:text-text-tertiary transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** md (40 px) beside a md Button, sm (32 px) beside a sm one; 44 px on phones either way */
  fieldSize?: keyof typeof fieldHeights;
  /** Marks the field invalid (aria-invalid); inside a Field, the Field's own state does this */
  isInvalid?: boolean;
};

/**
 * The shared single-line text field, on React Aria's Input: inside a Field it takes its label,
 * description, error and state from the Field; used bare it is a plain input with every native
 * attribute passed through. A caller's className adds to the field's own classes (it used to
 * replace them all, leaving a bare unstyled field). Full width unless the caller gives its own.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = 'w-full', fieldSize = 'md', isInvalid, ...props }, ref) => (
    <AriaInput
      ref={ref}
      {...props}
      aria-invalid={isInvalid ? true : props['aria-invalid']}
      className={`${fieldBase} ${fieldHeights[fieldSize]} ${fieldStates} ${className}`}
    />
  ),
);

// Compact toolbar controls keep the same finish and focus treatment, with stronger borders
// against a card surface. Phone targets stay 44px tall with 16px text. Only the shadow
// animates: foreground/background colours change together without a low-contrast fade.
const compactSelectClass =
  'block h-8 max-md:h-11 rounded-md border border-text-tertiary/75 px-3 text-xs max-md:text-base bg-surface text-text cursor-pointer transition-shadow focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 focus:ring-offset-surface';

// Phase 4 removes this native Select, once its ~80 callers move to ui/Select.tsx (WAVG-10)
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
