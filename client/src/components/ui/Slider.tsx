import { useId } from 'react';

// Adapted from shadcn's "slider with tooltip": a bubble above the thumb shows the value. Built on
// a native range input (keyboard, touch and screen readers for free) and Allotment's tokens, so
// it needs no extra dependency. 44px tall on phones, like the other controls.

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** Names the control for screen readers; there is no visible label of its own */
  'aria-label': string;
  min?: number;
  max?: number;
  step?: number;
  /** What the bubble and screen readers say for a value, e.g. a percentage */
  format?: (value: number) => string;
  className?: string;
}

// Thumb width, so the bubble sits over the thumb's centre instead of the track's raw percentage
const THUMB = 20;

export function Slider({
  value,
  onChange,
  'aria-label': ariaLabel,
  min = 0,
  max = 100,
  step = 1,
  format = String,
  className = '',
}: Props) {
  const id = useId();
  const fraction = (value - min) / (max - min);
  const text = format(value);
  return (
    <div className={`relative pt-7 ${className}`}>
      <output
        htmlFor={id}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium tabular-nums text-brand-contrast"
        style={{ left: `calc(${fraction * 100}% + ${THUMB / 2 - fraction * THUMB}px)` }}
      >
        {text}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block h-6 w-full cursor-pointer accent-brand-600 max-md:h-11 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
      />
    </div>
  );
}
