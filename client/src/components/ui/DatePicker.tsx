import { getLocalTimeZone, parseDate, today, type CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
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
import { todayIso } from '../../utils/calendarDay';
import { dateExample, segmentLocale } from './dateSegments';
import { FieldDescription, FieldErrorText } from './Field';
import { errorClass, fieldBase, fieldStates, helpClass, labelClass } from './fieldClasses';
import {
  dateRangeMessage,
  fieldSubject,
  incompleteDateMessage,
  requiredMessage,
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
  /** Added to the field's outer box; full width unless the caller gives its own */
  className?: string;
}

/** A picker's icon button: Clear, the calendar button and the steppers (32 px, 2 px ring) */
export const pickerIconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:text-text hover:bg-hover outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:text-text-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed';

/**
 * The trigger group: a field's box (02-UI-SPEC.md, per-control item 10), with 4 px after the
 * trailing buttons, the ring on focus-within and the shared disabled, read-only and invalid looks
 */
export const pickerGroupClass = `${fieldStates} flex items-center gap-1 w-full h-10 pl-3 pr-1 rounded-md border border-border bg-surface text-sm text-text outline-none transition-colors focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 data-[invalid]:focus-within:border-negative data-[invalid]:focus-within:ring-negative`;

/**
 * A calendar or month grid's popover: the card surface with the menu entrance. Unlike a list's
 * popoverClass it is not stretched to the trigger's width: the calendar and the month grid are a
 * fixed size.
 */
export const pickerPopoverClass =
  'rounded-lg border border-border-light bg-surface shadow-card outline-none data-[entering]:animate-menu-in max-w-[calc(100vw-16px)]';

/** The bar under a calendar or month grid holding its shortcut: a top border, 8 px either side */
export const pickerFooterClass =
  'mt-2 pt-2 border-t border-border-light flex items-center justify-end';

/** The Today and This month shortcuts: small brand text, text-disabled when out of range */
export const pickerShortcutClass =
  'rounded-sm px-1 text-xs font-medium text-brand-600 hover:text-brand-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:text-text-disabled disabled:hover:text-text-disabled disabled:cursor-not-allowed';

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
    className = 'w-full',
  } = props;
  const isPhone = useIsPhone();
  const format = usePreferencesStore((s) => s.dateFormat);
  const groupRef = useRef<HTMLDivElement>(null);
  // Set when a required field is left half-typed; a complete date or the next blur re-checks it
  const [halfTyped, setHalfTyped] = useState(false);
  const subject = fieldSubject({ errorLabel, label });
  const min = toCalendarDate(minValue);
  const max = toCalendarDate(maxValue);
  const day = toCalendarDate(value);
  const incomplete = halfTyped && isRequired && !isPhone;
  const outOfRange = day !== null && outside(day, min, max);
  // A caller's message always wins; then the half-typed line, the range line, the required line
  const error =
    errorMessage ??
    (incomplete
      ? incompleteDateMessage(dateExample(format))
      : outOfRange
        ? rangeLine(min, max)
        : isRequired
          ? requiredMessage('choice', subject)
          : undefined);
  const invalid = isInvalid || incomplete || outOfRange;
  // Today for the range check comes from the calendar library; the value set is todayIso()
  const todayAllowed = !outside(today(getLocalTimeZone()), min, max);

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
        value={toCalendarDate(value)}
        // A CalendarDate writes itself as a real YYYY-MM-DD day; a cleared one is null
        onChange={(d) => {
          if (d) setHalfTyped(false);
          onChange(d ? d.toString() : '');
        }}
        // Leaving the field is when a half-typed date is named (the "partial" state)
        onFocusChange={(focused) => {
          if (!focused) setHalfTyped(isHalfTyped(groupRef.current));
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
        <Label elementType="span" isRequired={isRequired}>
          {label}
        </Label>
        <Group
          ref={groupRef}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          className={pickerGroupClass}
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
              className={pickerIconButton}
            >
              <X size={14} aria-hidden />
            </AriaButton>
          )}
          <AriaButton aria-label="Choose from a calendar" className={pickerIconButton}>
            <CalendarDays size={16} aria-hidden />
          </AriaButton>
        </Group>
        {description != null && <FieldDescription>{description}</FieldDescription>}
        {error != null && <FieldErrorText>{error}</FieldErrorText>}
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
  | 'minValue'
  | 'maxValue'
  | 'id'
  | 'description'
  | 'isDisabled'
  | 'isInvalid'
  | 'isReadOnly'
  | 'isRequired'
  | 'className'
> & {
  /** A day (YYYY-MM-DD) or a month (YYYY-MM) */
  type: 'date' | 'month';
  /** The error line to show, already chosen by the picker; given only while invalid */
  error: ReactNode;
};

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
  minValue,
  maxValue,
  id,
  description,
  error,
  isDisabled,
  isInvalid,
  isReadOnly,
  isRequired,
  className,
}: NativeProps) {
  const lineId = useId();
  const describedBy = [
    description != null ? `${lineId}-description` : '',
    error != null ? `${lineId}-error` : '',
  ].filter(Boolean);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex flex-col gap-1">
        <span className={`${labelClass} break-words`}>
          {label}
          {isRequired && (
            <span aria-hidden="true" className="ml-1 text-negative">
              *
            </span>
          )}
        </span>
        <input
          type={type}
          id={id}
          value={value}
          min={minValue}
          max={maxValue}
          // A cleared or unfinished native value reads as '', the same as on desktop
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          readOnly={isReadOnly}
          required={isRequired}
          aria-invalid={isInvalid || error != null || undefined}
          aria-describedby={describedBy.length ? describedBy.join(' ') : undefined}
          className={`${fieldBase} ${fieldStates} w-full min-h-11 text-base`}
        />
      </label>
      {description != null && (
        <p id={`${lineId}-description`} className={`${helpClass} break-words`}>
          {description}
        </p>
      )}
      {error != null && (
        <p id={`${lineId}-error`} className={`${errorClass} break-words`}>
          {error}
        </p>
      )}
    </div>
  );
}
