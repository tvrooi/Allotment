import { forwardRef } from 'react';

// 40px, the height of a md Button beside it; 44px on phones, like a Button there
const inputClass =
  'block h-10 max-md:h-11 rounded-md border border-border px-3 text-sm bg-surface text-text placeholder:text-text-tertiary transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

// A caller's className adds to the field's own classes (it used to replace them all, leaving a
// bare unstyled field). Full width unless the caller gives its own width.
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = 'w-full', ...props }, ref) => (
    <input ref={ref} className={`${inputClass} ${className}`} {...props} />
  ),
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = 'w-full', ...props }, ref) => (
    <select ref={ref} className={`${inputClass} ${className}`} {...props} />
  ),
);
