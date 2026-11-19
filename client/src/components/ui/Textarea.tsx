import { forwardRef } from 'react';
import { TextArea as AriaTextArea } from 'react-aria-components';
import { fieldBase, fieldStates } from './fieldClasses';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Marks the field invalid (aria-invalid); inside a Field, the Field's own state does this */
  isInvalid?: boolean;
};

/**
 * The shared multi-line text field, on React Aria's TextArea, with Input's border, radius, focus
 * ring and states (fieldBase, fieldStates). Inside a Field it takes its label, description, error
 * and state from the Field; used bare it is a plain textarea with every native attribute passed
 * through. Three rows and at least 80 px by default; it wraps, scrolls vertically and resizes
 * vertically only. A caller's className adds to its classes; full width unless it gives its own.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = 'w-full', rows = 3, isInvalid, ...props }, ref) => (
    <AriaTextArea
      ref={ref}
      rows={rows}
      {...props}
      aria-invalid={isInvalid ? true : props['aria-invalid']}
      className={`${fieldBase} ${fieldStates} min-h-20 py-2 resize-y overflow-y-auto ${className}`}
    />
  ),
);
