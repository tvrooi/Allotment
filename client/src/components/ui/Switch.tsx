import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'onClick' | 'children' | 'role' | 'aria-checked'
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** A labelled switch with a full touch target; follows the Rules page's track-and-thumb pattern. */
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
