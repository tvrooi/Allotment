import { forwardRef } from 'react';
import { Input as AriaInput } from 'react-aria-components';
import { fieldBase, fieldHeights, fieldStates } from './fieldClasses';

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
