import { useId, type ReactNode } from 'react';
import { CurrencyInput } from '../ui/CurrencyInput';
import { describedByIds, FieldLines } from '../ui/Field';
import { Label } from '../ui/Label';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { bpsToInput } from '../../utils/longTerm';
import type { Escalation, When } from '../../api/longTerm';

/**
 * A money amount: the shared CurrencyInput under its label, with an optional hint tied to it.
 * CurrencyInput is not a React Aria input, so the label points at it by id, as other screens do.
 */
export function MoneyField({
  label,
  value,
  onChange,
  hint,
  allowNegative,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  hint?: ReactNode;
  allowNegative?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <CurrencyInput
        id={id}
        aria-label={label}
        aria-describedby={describedByIds(id, hint, undefined)}
        value={value}
        onChange={onChange}
        allowNegative={allowNegative}
      />
      <FieldLines id={id} description={hint} error={undefined} />
    </div>
  );
}

/**
 * A percentage typed as text (6.5), held as basis points: the shared NumberField with decimals.
 * Only a rate inside [min, max] reaches onChange; other text waits, marked, and holds up the
 * dialog or panel around it. An assumption shows its default, with "Use default" while changed.
 */
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
  const assumption = defaultBps !== undefined && (
    <>
      Assumption, default {bpsToInput(defaultBps)}%
      {bps !== defaultBps && (
        <>
          {' · '}
          <button type="button" className="underline" onClick={() => onChange(defaultBps)}>
            Use default
          </button>
        </>
      )}
    </>
  );
  return (
    <NumberField
      label={label}
      value={Number(bpsToInput(bps))}
      onChange={(percent) => {
        // Not optional, so never null. Whole basis points, rounded as inputToBps rounds
        if (percent !== null) onChange(Math.round(percent * 100));
      }}
      min={min}
      max={max}
      allowDecimal
      precision={2}
      suffix="%"
      errorMessage={`Enter a rate between ${min}% and ${max}%`}
      description={
        assumption || hint ? (
          <>
            {assumption}
            {assumption && hint ? ' ' : null}
            {hint}
          </>
        ) : undefined
      }
      className={className}
    />
  );
}

/**
 * A whole number (a year, an age, a count): the shared NumberField. What is typed stays as typed;
 * only a whole number in range reaches the plan, and while the text is anything else the dialog
 * or panel around it cannot be saved.
 */
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
    <NumberField
      label={label}
      value={value}
      onChange={(n) => {
        // Not optional, so a committed value is always a whole number in range
        if (n !== null) onChange(n);
      }}
      min={min}
      max={max}
      description={hint}
      className={className}
    />
  );
}

const WHEN_AS = [
  { value: 'year', label: 'A year' },
  { value: 'age', label: 'An age' },
];

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
    <fieldset className="relative grid min-w-0 grid-cols-2 gap-3 items-start">
      <legend className="sr-only">{label}</legend>
      <Select
        label={`${label} as`}
        value={byAge ? 'age' : 'year'}
        onChange={(v) => onChange(v === 'age' ? { age } : { year })}
        options={WHEN_AS}
        className="min-w-0"
      />
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

const ESCALATION_MODES: { value: Escalation['mode']; label: string }[] = [
  { value: 'inflation', label: 'With inflation' },
  { value: 'rate', label: 'By a set rate' },
  { value: 'none', label: 'Not at all' },
];

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
    <div className="grid grid-cols-2 gap-3 items-start">
      <Select
        label={label}
        value={value.mode}
        onChange={(v) => {
          const mode = v as Escalation['mode'];
          onChange(mode === 'rate' ? { mode, rateBps: 200 } : ({ mode } as Escalation));
        }}
        options={ESCALATION_MODES}
        className="min-w-0"
      />
      {value.mode === 'rate' && (
        <RateField
          label={`${label}: rate`}
          bps={value.rateBps}
          min={-50}
          max={15}
          defaultBps={200}
          onChange={(rateBps) => onChange({ mode: 'rate', rateBps })}
        />
      )}
    </div>
  );
}
