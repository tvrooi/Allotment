import type { ReactNode } from 'react';

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  /** The longer wording, shown on hover */
  title?: string;
}

/**
 * A row of toggle buttons for one choice, such as a chart's range (Reports' date presets and
 * the dashboard's charts). Each is a button with `aria-pressed`, so Tab reaches every option and
 * Enter or Space picks it; the group is named by `label`. Wraps when wider than its space.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-0 ${className}`}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex items-center justify-center gap-1 px-2.5 py-1 max-md:min-h-11 max-md:min-w-11 text-xs font-medium transition-colors border-b-2 cursor-pointer ${
            value === option.value
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
