import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';
import { readAmountExpression } from '../../utils/amountExpression';
import {
  UNREADABLE_AMOUNT,
  amountPlaceholder,
  amountToInput,
  formatAmount,
  readTypedAmount,
  useAmountStyle,
  type AmountStyle,
} from '../../utils/currency';
import { useReportAmountValidity } from './amountValidity';
import { fieldHeights } from './fieldClasses';

/** Reads typed money text as minor units, allowing arithmetic sums when expression is on */
export function readMoneyText(text: string, style: AmountStyle, expression = false): number | null {
  return expression ? readAmountExpression(text, style) : readTypedAmount(text, style);
}

interface BaseProps {
  defaultValue?: number | null;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  allowNegative?: boolean;
  'aria-label'?: string;
  /** For a visible <label htmlFor> beside the field */
  id?: string;
  /** The currency the amount is in (an account's); null or left out = the budget's */
  currency?: string | null;
  /** md (40 px) default, sm (32 px) for table cells; always 44 px on phones */
  fieldSize?: keyof typeof fieldHeights;
  /** Allow sums such as '100+50' through readAmountExpression (off by default) */
  expression?: boolean;
  /** Called on every keystroke with what the text reads as, or null while unreadable */
  onTextChange?: (cents: number | null) => void;
  /** Default true; false leaves committing to the caller's own keys */
  commitOnBlur?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  readOnly?: boolean;
  'aria-busy'?: React.AriaAttributes['aria-busy'];
  'aria-describedby'?: string;
  title?: string;
}

/**
 * By default an empty field is 0 and 0 shows empty. `nullable` keeps them apart, for a field
 * where 0 is a value of its own (a filter's "At most 0"): empty is null, a typed 0 is 0.
 */
type Props = BaseProps &
  (
    | { nullable?: false; value: number; onChange: (cents: number) => void }
    | { nullable: true; value: number | null; onChange: (cents: number | null) => void }
    | { nullable?: never; value?: undefined; onChange?: never }
  );

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(function CurrencyInput(
  {
    value: controlledValue,
    defaultValue = null,
    onChange,
    nullable = controlledValue === undefined,
    name,
    disabled,
    placeholder,
    className = '',
    allowNegative = false,
    'aria-label': ariaLabel,
    currency,
    id,
    fieldSize = 'md',
    expression = false,
    onTextChange,
    commitOnBlur = true,
    onBlur,
    onKeyDown,
    autoFocus,
    readOnly,
    'aria-busy': ariaBusy,
    'aria-describedby': ariaDescribedBy,
    title,
  },
  ref,
) {
  const [committed, setCommitted] = useState(defaultValue);
  const value = controlledValue === undefined ? committed : controlledValue;
  const commit = (next: number | null) => {
    if (controlledValue === undefined) setCommitted(next);
    (onChange as ((cents: number | null) => void) | undefined)?.(next);
  };
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  // Explicit-commit (commitOnBlur={false}) drafts stay visible and editable across blur/refocus
  // until the caller unmounts or resets value (e.g. Budget cell on window blur vs click-away).
  const [dirty, setDirty] = useState(false);
  // Text that isn't an amount stays in the field, marked, instead of quietly becoming 0
  const [invalid, setInvalid] = useState(false);
  // Whether what's in the field now is an amount: checked as it's typed, so a form can't be
  // submitted (and a dialog keeps Save disabled) while it isn't, even before the field is left
  const [readable, setReadable] = useState(true);
  useReportAmountValidity(readable);
  const style = useAmountStyle(currency);
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const amount = value ?? 0;
  /** The amount as it is edited: empty only for no amount (nullable) or 0 (default) */
  const editText = () =>
    value === null
      ? ''
      : nullable && amount === 0
        ? '0'
        : (amount < 0 ? '-' : '') + amountToInput(amount, style);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        const cleanup: unknown = ref(node);
        if (typeof cleanup === 'function') {
          const detach = cleanup as () => void;
          return () => {
            inputRef.current = null;
            detach();
          };
        }
        return;
      }
      if (ref) ref.current = node;
    },
    [ref],
  );

  // The dialog set an amount itself (reopened, reset, a suggestion picked): it replaces text
  // that couldn't be read, unless that text is being typed right now. In explicit-commit mode
  // (commitOnBlur={false}), any value prop change is an authoritative external reset even while
  // focused, so both the visible draft and its validity reset together.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!focused || !commitOnBlur) {
      setInvalid(false);
      setReadable(true);
      setDirty(false);
      if (focused) setRaw(editText());
    }
  }
  useEffect(() => {
    if (readable) inputRef.current?.setCustomValidity('');
  }, [readable]);

  // Move focus imperatively on mount when opt-in autoFocus is set, avoiding a jsx-a11y/no-autofocus
  // warning on the shared input while still focusing before an enclosing Modal's own effect runs.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const hasDraft = !commitOnBlur && dirty;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const text = e.target.value;
    setRaw(text);
    if (!commitOnBlur) setDirty(true);
    const cents = readMoneyText(text, style, expression);
    const ok = cents !== null;
    setReadable(ok);
    if (ok) setInvalid(false);
    // The browser then refuses to submit a form holding this field, and says why
    e.target.setCustomValidity(ok ? '' : UNREADABLE_AMOUNT);
    onTextChange?.(cents === null ? null : allowNegative ? cents : Math.abs(cents));
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    const initial = invalid || hasDraft ? raw : editText();
    setFocused(true);
    setRaw(initial);
    // Select the amount once it's shown for editing, so typing replaces it. Only if nothing
    // was typed in the meantime, or the first keystroke would be selected and overwritten.
    const input = e.currentTarget;
    if (initial) {
      requestAnimationFrame(() => {
        if (document.activeElement === input && input.value === initial) input.select();
      });
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    if (!readOnly) {
      if (commitOnBlur && nullable && raw.trim() === '') {
        setInvalid(false);
        commit(null);
      } else if (commitOnBlur) {
        const cents = readMoneyText(raw, style, expression);
        setInvalid(cents === null);
        if (cents !== null) {
          commit(allowNegative ? cents : Math.abs(cents));
        }
      } else {
        setInvalid(!readable);
      }
    }
    onBlur?.(e);
  }

  const describedBy =
    [invalid ? hintId : '', ariaDescribedBy].filter(Boolean).join(' ') || undefined;
  const shown =
    focused || invalid || hasDraft
      ? raw
      : value === null || (!nullable && amount === 0)
        ? ''
        : formatAmount(amount, style);
  const submitted =
    focused || invalid || hasDraft
      ? raw.trim() === ''
        ? null
        : readMoneyText(raw, style, expression)
      : value;
  const formStyle = { ...style, format: 'dot' } as const;
  const formValue =
    submitted == null
      ? ''
      : (submitted < 0 && allowNegative ? '-' : '') +
        (amountToInput(submitted, formStyle) || amountPlaceholder(formStyle));
  return (
    <>
      <input
        ref={setRefs}
        id={id}
        // Text, not number: a number field won't take a decimal comma (12,50)
        type="text"
        inputMode="decimal"
        value={shown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder ?? amountPlaceholder(style)}
        aria-label={ariaLabel}
        aria-busy={ariaBusy}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        title={title}
        className={`block w-full rounded-md border px-3 ${fieldHeights[fieldSize]} text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:ring-1 ${
          invalid
            ? 'border-negative focus:border-negative focus:ring-negative'
            : 'border-border focus:border-brand-600 focus:ring-brand-600'
        } ${className}`}
      />
      {name != null && <input type="hidden" name={name} value={formValue} disabled={disabled} />}
      {invalid && (
        <p id={hintId} role="alert" className="mt-1 basis-full text-xs text-negative">
          {UNREADABLE_AMOUNT}
        </p>
      )}
    </>
  );
});
