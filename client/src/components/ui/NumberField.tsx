import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReportAmountValidity } from './amountValidity';
import { Field } from './Field';
import type { fieldHeights } from './fieldClasses';
import {
  percentRangeMessage,
  present,
  wholeNumberMinMessage,
  wholeNumberRangeMessage,
} from './fieldMessages';
import { Input } from './Input';
import { readDecimal, readWholeNumber } from './numberText';

type NumberFieldProps = {
  /** Visible label and accessible name (kept identical to the field it replaces, D-15) */
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  /** Default false: whole numbers via readWholeNumber; true: decimals via readDecimal */
  allowDecimal?: boolean;
  /** Blank text reads as null and is valid */
  optional?: boolean;
  /** Override the default range message when the UI spec names different wording */
  errorMessage?: ReactNode;
  description?: ReactNode;
  fieldSize?: keyof typeof fieldHeights;
  /** Decorative trailing unit such as '%', hidden from screen readers */
  suffix?: string;
  isDisabled?: boolean;
  /** Decimal places the caller stores (e.g. 2 for basis points), for rounding acknowledgements */
  precision?: number;
  /** Change this value to explicitly reset the visible draft from `value` */
  resetKey?: string | number;
  className?: string;
  id?: string;
};

const toDraft = (value: number | null) => (value === null ? '' : String(value));
const MAX_IN_FLIGHT = 32;

/**
 * True when `incoming` matches what the caller stores for `emitted`: exact equality by default,
 * or when `precision` is declared, `incoming` lies on the `10^-precision` grid and `emitted` is
 * within half a step of it (matching both `Math.round` and `toFixed` tie-breaking).
 */
function matchesStored(
  emitted: number | null,
  incoming: number | null,
  precision?: number,
): boolean {
  if (emitted === incoming) return true;
  if (precision === undefined || emitted === null || incoming === null) return false;
  const scale = 10 ** precision;
  const scaledIncoming = incoming * scale;
  if (Math.abs(scaledIncoming - Math.round(scaledIncoming)) > 1e-7) return false;
  return Math.abs(emitted * scale - scaledIncoming) <= 0.5 + 1e-9;
}

function parseDraft(
  text: string,
  min: number,
  max: number,
  allowDecimal: boolean,
  optional: boolean,
): { valid: true; value: number | null } | { valid: false; value: null } {
  if (optional && text.trim() === '') return { valid: true, value: null };
  const parsed = allowDecimal ? readDecimal(text, min, max) : readWholeNumber(text, min, max);
  return parsed === null ? { valid: false, value: null } : { valid: true, value: parsed };
}

function isValueInBounds(
  value: number | null,
  min: number,
  max: number,
  allowDecimal: boolean,
  optional: boolean,
): boolean {
  if (value === null) return optional;
  if (!Number.isFinite(value)) return false;
  if (!allowDecimal && !Number.isInteger(value)) return false;
  return value >= min && value <= max;
}

/**
 * Shared bounded number field (D-14), built from Field and Input. Keeps typed text as typed,
 * commits only values inside [min, max] (or null when optional and blank), shows its range
 * message while invalid, and reports validity to an enclosing AmountFields.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  allowDecimal = false,
  optional = false,
  errorMessage,
  description,
  fieldSize = 'md',
  suffix,
  isDisabled = false,
  precision,
  resetKey,
  className,
  id,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => ({
    text: toDraft(value),
    lastValue: value,
    lastResetKey: resetKey,
    inFlight: [] as Array<number | null>,
    committed: true,
  }));
  // Keep the typed draft only for an acknowledgement of an in-flight edit (matched at the
  // caller's declared precision, or exact equality without precision); any other value change
  // or an explicit resetKey change replaces the draft.
  if (resetKey !== draft.lastResetKey) {
    setDraft({
      text: toDraft(value),
      lastValue: value,
      lastResetKey: resetKey,
      inFlight: [],
      committed: true,
    });
  } else if (value !== draft.lastValue) {
    const ackIndex = draft.inFlight.findIndex((emitted) =>
      matchesStored(emitted, value, precision),
    );
    if (ackIndex !== -1) {
      setDraft((prev) => ({
        ...prev,
        lastValue: value,
        inFlight: prev.inFlight.slice(ackIndex + 1),
      }));
    } else {
      setDraft({
        text: toDraft(value),
        lastValue: value,
        lastResetKey: resetKey,
        inFlight: [],
        committed: true,
      });
    }
  }

  const parsed = parseDraft(draft.text, min, max, allowDecimal, optional);
  const controlledValid = isValueInBounds(value, min, max, allowDecimal, optional);
  // Both the typed draft and the controlled value the caller will submit must be inside bounds
  // (e.g. a caller that rounded '3.146' to 3.15 becomes invalid if max tightens to 3.147).
  const valid = parsed.valid && (!draft.committed || controlledValid);
  // Never emit edits through a disabled field; reconcile only once the field is editable again.
  const needsCommit = !isDisabled && parsed.valid && !draft.committed;
  const pendingValue = parsed.valid ? parsed.value : null;

  // Keep Save disabled until a retained draft that became valid after a bound change has been
  // published to the caller, and while the controlled value is outside the active bounds.
  // While disabled, judge only what is shown and submitted: the controlled value.
  const reportedValid = isDisabled ? controlledValid : valid && draft.committed;
  useReportAmountValidity(reportedValid);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (!needsCommit) return;
    setDraft((prev) =>
      prev.committed
        ? prev
        : {
            ...prev,
            committed: true,
            inFlight: [...prev.inFlight.slice(-(MAX_IN_FLIGHT - 1)), pendingValue],
          },
    );
    onChangeRef.current(pendingValue);
  }, [needsCommit, pendingValue]);

  const defaultError = allowDecimal
    ? percentRangeMessage(min, max)
    : Number.isFinite(max)
      ? wholeNumberRangeMessage(min, max)
      : wholeNumberMinMessage(min);

  const input = (
    <Input
      {...(id ? { id } : {})}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      fieldSize={fieldSize}
      value={isDisabled ? toDraft(value) : draft.text}
      onBlur={() => {
        if (draft.inFlight.length > 0) {
          setDraft((prev) => (prev.inFlight.length > 0 ? { ...prev, inFlight: [] } : prev));
        }
      }}
      onChange={(e) => {
        const nextText = e.target.value;
        const next = parseDraft(nextText, min, max, allowDecimal, optional);
        if (next.valid) {
          setDraft((prev) => ({
            ...prev,
            text: nextText,
            inFlight: [...prev.inFlight.slice(-(MAX_IN_FLIGHT - 1)), next.value],
            committed: true,
          }));
          onChange(next.value);
        } else {
          setDraft((prev) => ({
            ...prev,
            text: nextText,
            inFlight: [],
            committed: false,
          }));
        }
      }}
      className={suffix ? 'w-full pr-8' : 'w-full'}
    />
  );

  const resolvedError = errorMessage ?? defaultError;

  const showInvalid = isDisabled ? !controlledValid : !valid;

  return (
    <Field
      label={label}
      description={description}
      isInvalid={showInvalid}
      errorMessage={
        !showInvalid || !present(resolvedError) ? undefined : (
          <span role="alert">{resolvedError}</span>
        )
      }
      isDisabled={isDisabled}
      className={className}
    >
      {suffix ? (
        <div className="relative">
          {input}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary"
          >
            {suffix}
          </span>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
