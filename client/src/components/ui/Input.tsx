import { forwardRef } from 'react';

const inputClass =
  'block w-full rounded-md border border-border px-3 py-2.5 text-sm bg-surface text-text placeholder:text-text-tertiary transition-colors focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} className={inputClass} {...props} />,
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => <select ref={ref} className={inputClass} {...props} />,
);
