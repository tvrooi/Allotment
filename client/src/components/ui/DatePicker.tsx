import { parseDate, type CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Button as AriaButton,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Popover,
} from 'react-aria-components';
import { useIsPhone } from '../../hooks/useIsPhone';
import { usePreferencesStore } from '../../store/preferencesStore';
import { isIsoDay, todayIso } from '../../utils/calendarDay';
import { isMonth } from '../../utils/dateRange';
import { useReportAmountValidity } from './amountValidity';
import { dateExample, segmentLocale } from './dateSegments';
import { describedByIds, FieldDescription, FieldErrorText, FieldLines } from './Field';
import {
  fieldBase,
  fieldHeights,
  fieldStates,
  pickerFooterClass,
  pickerGroupBase,
  pickerGroupHeight,
  pickerGroupPadding,
  pickerGroupText,
  pickerGroupWidth,
  pickerIconButton,
  pickerIconButtonSm,
  pickerPopoverClass,
  pickerShortcutClass,
} from './fieldClasses';
import {
  dateRangeMessage,
  errorLine,
  fieldSubject,
  incompleteDateMessage,
  present,
} from './fieldMessages';
import { Label } from './Label';

const toCalendarDate = (value: string | undefined): CalendarDate | null => {
  try {
    return value ? parseDate(value) : null;
  } catch {
    return null;
  }
};

/** Whether `day` lies outside the inclusive bounds: a day equal to either is allowed (E-02) */
const outside = (day: CalendarDate, min: CalendarDate | null, max: CalendarDate | null) =>
  (min !== null && day.compare(min) < 0) || (max !== null && day.compare(max) > 0);

/** The contract's range line for whichever bounds are given, or undefined when there are none */
function rangeLine(min: CalendarDate | null, max: CalendarDate | null): string | undefined {
  if (min !== null) return dateRangeMessage(min.toString(), max?.toString());
  if (max !== null) return dateRangeMessage(undefined, max.toString());
  return undefined;
}

/**
 * Whether the typed segments hold part of a date: some filled, some still placeholders. React
 * Aria keeps a half-typed date inside the field and gives no value for it, so the segments are
 * the only place it shows.
 */
function isHalfTyped(group: HTMLElement | null): boolean {
  const segments = [...(group?.querySelectorAll('[role="spinbutton"]') ?? [])];
  const filled = segments.filter((segment) => !segment.hasAttribute('data-placeholder'));
  return filled.length > 0 && filled.length < segments.length;
}

interface Props {
  /** A real YYYY-MM-DD day, or '' for none */
  value: string;
  /** A complete day as YYYY-MM-DD; a cleared or half-typed one as '' */
  onChange: (value: string) => void;
  label: string;
  /** Clearing is offered when the date is optional */
  optional?: boolean;
  /** Shows a muted "(optional)" hint beside the label without changing the accessible name */
  optionalHint?: boolean;
  /** Earliest allowed day, YYYY-MM-DD, itself allowed */
  minValue?: string;
  /** Latest allowed day, YYYY-MM-DD, itself allowed */
  maxValue?: string;
  id?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  /** Names the subject of the Clear button and the default required line instead of the label */
  errorLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Focusable and announced, but the value cannot change and the calendar does not open */
  isReadOnly?: boolean;
  isRequired?: boolean;
  /** md (40 px) beside a md Button, sm (32 px) beside a sm one; 44 px on phones either way */
  fieldSize?: keyof typeof fieldHeights;
  /** Keeps the accessible name while visually hiding the label in compact rows */
  hideLabel?: boolean;
  /** Added to the field's outer box; full width unless the caller gives its own */
  className?: string;
}

/**
 * The shared DatePicker (02-UI-SPEC.md, per-control item 10; D-04, D-07, D-08). On desktop it is
 * React Aria's DatePicker: day, month and year segments typed in the Date format preference's
 * order (segmentLocale), and a calendar popover. On phones (under 768 px) it is the native date
 * input, which their keyboards and wheels already do well. Both take and give a YYYY-MM-DD
 * string, '' for none; a half-typed date is never a value.
 */
export function DatePicker(props: Props) {
  const {
    value,
    onChange,
    label,
    optional,
    optionalHint = false,
    minValue,
    maxValue,
    id,
    description,
    errorMessage,
    errorLabel,
    isDisabled = false,
    isInvalid = false,
    isReadOnly = false,
    isRequired = false,
    fieldSize = 'md',
    hideLabel = false,
    className = 'w-full',
  } = props;
  const isPhone = useIsPhone();
  const format = usePreferencesStore((s) => s.dateFormat);
  const groupRef = useRef<HTMLDivElement>(null);
  // Set when the field is left half-typed; a complete date or the next blur re-checks it
  const [halfTyped, setHalfTyped] = useState(false);
  // The same check as each segment is edited. React Aria gives no value for a half-typed date,
  // so the caller still holds the last whole one; an enclosing AmountFields learns the field holds
  // no date and keeps its save unavailable until the date is whole or empty again. The line
  // above still waits for the field to be left.
  const [draftHalf, setDraftHalf] = useState(false);
  const recheckDraft = () => setDraftHalf(isHalfTyped(groupRef.current));
  // A caller-driven change (Clear, a reset, another payday) re-checks both, so a line named for
  // a half-typed date does not outlive it
  useEffect(() => {
    const half = isHalfTyped(groupRef.current);
    setDraftHalf(half);
    if (!half) setHalfTyped(false);
  }, [value]);
  useReportAmountValidity(isPhone || !draftHalf);
  const subject = fieldSubject({ errorLabel, label });
  const min = toCalendarDate(minValue);
  const max = toCalendarDate(maxValue);
  // One CalendarDate per value: React Aria compares it by identity, and a new one on every render
  // reads as a new value, putting back the last whole date over segments being typed. A pick
  // (calendar or Today) sets a fresh one, so picking the day already held still refills the
  // segments when the caller's value does not change. It is keyed on the value string it was made
  // for, not its own toString(): a stored day that does not round-trip (year 0000 reads as 0001)
  // would otherwise never match and re-render forever.
  const [held, setHeld] = useState(() => ({ value, day: toCalendarDate(value) }));
  if (held.value !== value) setHeld({ value, day: toCalendarDate(value) });
  const day = held.value === value ? held.day : toCalendarDate(value);
  const hold = (iso: string) => setHeld({ value: iso, day: toCalendarDate(iso) });
  // Named whether required or not: a half-typed date holds an enclosing form up either way
  const incomplete = halfTyped && !isPhone;
  const outOfRange = day !== null && outside(day, min, max);
  // A caller's message always wins; then the half-typed line, the range line, the required line
  const error = errorLine(errorMessage, {
    isRequired,
    kind: 'choice',
    names: { errorLabel, label },
    own: incomplete
      ? incompleteDateMessage(dateExample(format))
      : outOfRange
        ? rangeLine(min, max)
        : undefined,
  });
  const invalid = isInvalid || incomplete || outOfRange;
  // The same today the Today button sets (todayIso), so the gate and the value cannot disagree
  const todayDay = toCalendarDate(todayIso());
  const todayAllowed = todayDay !== null && !outside(todayDay, min, max);

  if (isPhone)
    return (
      <NativePicker
        {...props}
        type="date"
        className={className}
        error={invalid ? error : undefined}
      />
    );

  return (
    <I18nProvider locale={segmentLocale(format)}>
      <AriaDatePicker
        id={id}
        value={day}
        // A CalendarDate writes itself as a real YYYY-MM-DD day; a cleared one is null
        onChange={(d) => {
          if (d) {
            setHalfTyped(false);
            setDraftHalf(false);
            hold(d.toString());
          }
          onChange(d ? d.toString() : '');
        }}
        // Leaving the field is when a half-typed date is named (the "partial" state)
        onFocusChange={(focused) => {
          if (!focused) {
            setHalfTyped(isHalfTyped(groupRef.current));
            recheckDraft();
          }
        }}
        minValue={min ?? undefined}
        maxValue={max ?? undefined}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        isRequired={isRequired}
        isInvalid={invalid}
        // Required marks the field and shows the line; it never blocks a form's native submit
        validationBehavior="aria"
        className={`group flex flex-col gap-1 ${className}`}
      >
        <Label elementType="span" isRequired={isRequired} className={hideLabel ? 'sr-only' : ''}>
          {label}
          {optionalHint && !isRequired && (
            <span aria-hidden="true" className="ml-1 font-normal text-text-tertiary">
              (optional)
            </span>
          )}
        </Label>
        <Group
          ref={groupRef}
          // A typed or cleared segment has reached the DOM by key-up
          onKeyUp={recheckDraft}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          className={`${pickerGroupBase} ${pickerGroupWidth} ${fieldSize === 'sm' ? fieldHeights.sm : pickerGroupHeight} ${pickerGroupPadding} ${pickerGroupText}`}
        >
          <DateInput className="flex flex-1 min-w-0 tabular-nums">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded-sm px-1 outline-none data-[placeholder]:text-text-tertiary data-[type=literal]:px-0 data-[type=literal]:text-text-tertiary focus:bg-brand-100 focus:text-text"
              />
            )}
          </DateInput>
          {optional && value && !isDisabled && !isReadOnly && (
            <AriaButton
              aria-label={`Clear ${subject}`}
              // Not a calendar slot: it empties the field instead of opening the calendar
              slot={null}
              onPress={() => onChange('')}
              className={fieldSize === 'sm' ? pickerIconButtonSm : pickerIconButton}
            >
              <X size={14} aria-hidden />
            </AriaButton>
          )}
          <AriaButton
            aria-label="Choose from a calendar"
            className={fieldSize === 'sm' ? pickerIconButtonSm : pickerIconButton}
          >
            <CalendarDays size={16} aria-hidden />
          </AriaButton>
        </Group>
        {present(description) && <FieldDescription>{description}</FieldDescription>}
        {present(error) && <FieldErrorText>{error}</FieldErrorText>}
        <Popover placement="bottom end" offset={4} className={pickerPopoverClass}>
          <Dialog className="p-3 outline-none">
            {({ close }) => (
              <>
                <Calendar className="w-fit">
                  <header className="flex items-center justify-between gap-2 mb-2">
                    <AriaButton
                      slot="previous"
                      aria-label="Previous month"
                      className={pickerIconButton}
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </AriaButton>
                    <Heading className="text-sm font-medium text-text" />
                    <AriaButton slot="next" aria-label="Next month" className={pickerIconButton}>
                      <ChevronRight size={16} aria-hidden />
                    </AriaButton>
                  </header>
                  <CalendarGrid className="border-collapse">
                    <CalendarGridHeader>
                      {(day) => (
                        <CalendarHeaderCell className="size-9 text-xs font-medium text-text-tertiary">
                          {day}
                        </CalendarHeaderCell>
                      )}
                    </CalendarGridHeader>
                    <CalendarGridBody>
                      {(date) => (
                        <CalendarCell
                          date={date}
                          className="relative flex size-9 items-center justify-center rounded-md text-sm tabular-nums text-text cursor-default outline-none hover:bg-hover data-[outside-month]:text-text-disabled data-[disabled]:text-text-disabled data-[disabled]:hover:bg-transparent data-[unavailable]:line-through data-[today]:font-medium data-[today]:ring-1 data-[today]:ring-inset data-[today]:ring-border data-[selected]:bg-brand-600 data-[selected]:text-brand-contrast data-[selected]:ring-0 data-[focus-visible]:z-10 data-[focus-visible]:ring-2 data-[focus-visible]:ring-brand-600"
                        />
                      )}
                    </CalendarGridBody>
                  </CalendarGrid>
                </Calendar>
                <div className={pickerFooterClass}>
                  <AriaButton
                    aria-label="Select today"
                    // Not a calendar or dialog slot: it sets the day itself, then closes
                    slot={null}
                    isDisabled={!todayAllowed}
                    onPress={() => {
                      setHalfTyped(false);
                      setDraftHalf(false);
                      hold(todayIso());
                      onChange(todayIso());
                      close();
                    }}
                    className={pickerShortcutClass}
                  >
                    Today
                  </AriaButton>
                </div>
              </>
            )}
          </Dialog>
        </Popover>
      </AriaDatePicker>
    </I18nProvider>
  );
}

/** What the phone branch takes: a picker's own props, less the desktop-only ones */
type NativeProps = Pick<
  Props,
  | 'value'
  | 'onChange'
  | 'label'
  | 'optionalHint'
  | 'minValue'
  | 'maxValue'
  | 'id'
  | 'description'
  | 'isDisabled'
  | 'isInvalid'
  | 'isReadOnly'
  | 'isRequired'
  | 'hideLabel'
  | 'className'
> & {
  /** A day (YYYY-MM-DD) or a month (YYYY-MM) */
  type: 'date' | 'month';
  /** The error line to show, already chosen by the picker; given only while invalid */
  error: ReactNode;
};

/**
 * What a native input's value gives the caller: a real YYYY-MM-DD day or YYYY-MM month, else ''.
 * A browser without the native control (Firefox has no month input) leaves a free-text box,
 * whose text must never reach a caller as a value.
 */
export function nativeValue(type: 'date' | 'month', raw: string): string {
  return (type === 'month' ? isMonth(raw) : isIsoDay(raw)) ? raw : '';
}

/**
 * The phone branch of DatePicker and MonthPicker (D-04): a native date or month input inside its
 * label, so tapping either opens the phone's own picker, 44 px tall with 16 px text. Help and
 * error lines are tied to it by id, as a Field ties them.
 */
export function NativePicker({
  type,
  value,
  onChange,
  label,
  optionalHint = false,
  minValue,
  maxValue,
  id,
  description,
  error,
  isDisabled,
  isInvalid,
  isReadOnly,
  isRequired,
  hideLabel = false,
  className,
}: NativeProps) {
  const lineId = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex flex-col gap-1">
        <Label elementType="span" isRequired={isRequired} className={hideLabel ? 'sr-only' : ''}>
          {label}
          {optionalHint && !isRequired && (
            <span aria-hidden="true" className="ml-1 font-normal text-text-tertiary">
              (optional)
            </span>
          )}
        </Label>
        <input
          type={type}
          id={id}
          value={value}
          min={minValue}
          max={maxValue}
          // A cleared, unfinished or free-typed value reads as '', the same as on desktop
          onChange={(e) => onChange(nativeValue(type, e.target.value))}
          disabled={isDisabled}
          readOnly={isReadOnly}
          required={isRequired}
          aria-invalid={isInvalid || present(error) || undefined}
          aria-describedby={describedByIds(lineId, description, error)}
          // iOS Safari sizes a native date input by its value and centres it, so in this flex
          // column it would outgrow its container: it may shrink (min-w-0), drops the native
          // look and keeps its value on the left like any field (UAT G-03-1); with `block` from
          // fieldBase it stacks the value at the top, so zero vertical margin and a 42 px line
          // (the 44 px field less its two 1 px borders) vertically centre it (UAT G-03-3). Android
          // Chromium draws the same pseudo-element, so both rules sit behind a WebKit-only @supports
          className={`${fieldBase} ${fieldStates} w-full min-w-0 min-h-11 appearance-none text-base [&::-webkit-date-and-time-value]:text-left supports-[-webkit-touch-callout:none]:[&::-webkit-date-and-time-value]:my-0 supports-[-webkit-touch-callout:none]:[&::-webkit-date-and-time-value]:leading-[42px]`}
        />
      </label>
      <FieldLines id={lineId} description={description} error={error} />
    </div>
  );
}
