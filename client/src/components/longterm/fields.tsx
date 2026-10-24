import { useId, useState, type ReactNode } from 'react';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input, Select } from '../ui/Input';
import { bpsToInput, inputToBps } from '../../utils/longTerm';
import type { Escalation, When } from '../../api/longTerm';

/** A labelled input, with an optional hint (for an assumption: the default beside it) */
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`relative flex min-w-0 flex-col gap-1 text-xs font-medium text-text-secondary ${className}`}
    >
      {label}
      {children}
      {hint && <span className="font-normal text-text-tertiary">{hint}</span>}
    </label>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  allowNegative,
  className,
}: {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  hint?: ReactNode;
  allowNegative?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <CurrencyInput
        aria-label={label}
        value={value}
        onChange={onChange}
        allowNegative={allowNegative}
      />
    </Field>
  );
}

/** A percentage typed as text (6.5), held as basis points. Text that is not a rate waits, marked. */
export function RateField({
  label,
  bps,
  onChange,
  defaultBps,
  min = -50,
  max = 1000,
  hint,
  className,
}: {
  label: string;
  bps: number;
  onChange: (bps: number) => void;
  /** An assumption's default, shown beside it */
  defaultBps?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
  className?: string;
}) {
  const [text, setText] = useState(bpsToInput(bps));
  const [last, setLast] = useState(bps);
  if (bps !== last) {
    setLast(bps);
    if (inputToBps(text) !== bps) setText(bpsToInput(bps));
  }
  const parsed = inputToBps(text);
  const invalid = parsed === null || parsed < min * 100 || parsed > max * 100;
  const id = useId();
  return (
    <Field
      label={label}
      className={className}
      hint={
        <>
          {invalid ? (
            <span id={id} className="text-negative">
              Enter a rate between {min}% and {max}%
            </span>
          ) : defaultBps !== undefined ? (
            <>
              Assumption, default {bpsToInput(defaultBps)}%
              {bps !== defaultBps && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setText(bpsToInput(defaultBps));
                      setLast(defaultBps);
                      onChange(defaultBps);
                    }}
                  >
                    Use default
                  </button>
                </>
              )}
            </>
          ) : null}
          {hint && <> {hint}</>}
        </>
      }
    >
      <div className="relative">
        <Input
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={invalid ? id : undefined}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = inputToBps(e.target.value);
            if (v !== null && v >= min * 100 && v <= max * 100) {
              setLast(v);
              onChange(v);
            }
          }}
          style={{ paddingRight: '2rem' }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">
          %
        </span>
      </div>
    </Field>
  );
}

export function WholeNumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  className,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <Input
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const n = Math.trunc(Number(e.target.value));
          if (e.target.value !== '' && Number.isFinite(n))
            onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </Field>
  );
}

/** A year or an age, as the event's date */
export function WhenField({
  when,
  onChange,
  birthYear,
  label = 'When',
}: {
  when: When;
  onChange: (w: When) => void;
  birthYear: number;
  label?: string;
}) {
  const byAge = 'age' in when;
  const year = 'year' in when ? when.year : birthYear + when.age;
  const age = 'age' in when ? when.age : when.year - birthYear;
  return (
    <fieldset className="relative grid min-w-0 grid-cols-2 gap-3 items-end">
      <legend className="sr-only">{label}</legend>
      <Field label={`${label} as`}>
        <Select
          aria-label={`${label} as`}
          value={byAge ? 'age' : 'year'}
          onChange={(e) => onChange(e.target.value === 'age' ? { age } : { year })}
        >
          <option value="year">A year</option>
          <option value="age">An age</option>
        </Select>
      </Field>
      {byAge ? (
        <WholeNumberField
          label={`${label}: age`}
          value={age}
          min={0}
          max={130}
          onChange={(a) => onChange({ age: a })}
          hint={`Year ${year}`}
        />
      ) : (
        <WholeNumberField
          label={`${label}: year`}
          value={year}
          min={1900}
          max={2300}
          onChange={(y) => onChange({ year: y })}
          hint={`Age ${age}`}
        />
      )}
    </fieldset>
  );
}

export function EscalationField({
  label = 'Changes each year',
  value,
  onChange,
}: {
  label?: string;
  value: Escalation;
  onChange: (e: Escalation) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 items-end">
      <Field label={label}>
        <Select
          aria-label={label}
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value as Escalation['mode'];
            onChange(mode === 'rate' ? { mode, rateBps: 200 } : ({ mode } as Escalation));
          }}
        >
          <option value="inflation">With inflation</option>
          <option value="rate">By a set rate</option>
          <option value="none">Not at all</option>
        </Select>
      </Field>
      {value.mode === 'rate' && (
        <RateField
          label={`${label}: rate`}
          bps={value.rateBps}
          min={-50}
          max={15}
          onChange={(rateBps) => onChange({ mode: 'rate', rateBps })}
        />
      )}
    </div>
  );
}
