import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button as AriaButton, Dialog, DialogTrigger, Group, Popover } from 'react-aria-components';
import { useIsPhone } from '../../hooks/useIsPhone';
import { thisMonthIso } from '../../utils/calendarDay';
import { formatMonth, isMonth } from '../../utils/dateRange';
import {
  NativePicker,
  pickerFooterClass,
  pickerGroupClass,
  pickerIconButton,
  pickerPopoverClass,
  pickerShortcutClass,
} from './DatePicker';
import { describedByIds, FieldLines } from './Field';
import { errorLine, fieldSubject, monthRangeMessage } from './fieldMessages';
import { Label } from './Label';
import { supportsMonthInput } from './nativeInput';

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** Earliest year the grid steps back to, as MonthRangePicker's ("All" starts in 2020) */
const MIN_YEAR = 2000;

// Months are year and month numbers: no day arithmetic, no ISO-timestamp slicing

/** A YYYY-MM month as its year and its month number (1 to 12), or null when it is not a month */
function parts(month: string | undefined): { year: number; month: number } | null {
  if (!isMonth(month)) return null;
  const [year, number] = month.split('-').map(Number);
  return { year, month: number };
}

/** The YYYY-MM month for a year and a month number (1 to 12) */
const toMonth = (year: number, month: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;

/** A month as a count of months, so two months compare as numbers */
const ordinal = (m: { year: number; month: number }) => m.year * 12 + m.month - 1;

/** Whether `month` lies outside the inclusive bounds: a month equal to either is allowed */
function outside(month: string, min: string | undefined, max: string | undefined): boolean {
  const m = parts(month);
  if (!m) return false;
  const lo = parts(min);
  const hi = parts(max);
  return (lo !== null && ordinal(m) < ordinal(lo)) || (hi !== null && ordinal(m) > ordinal(hi));
}

/** The contract's range line for whichever bounds are given, or undefined when there are none */
function rangeLine(min: string | undefined, max: string | undefined): string | undefined {
  const lo = isMonth(min) ? min : undefined;
  const hi = isMonth(max) ? max : undefined;
  if (lo !== undefined) return monthRangeMessage(lo, hi);
  if (hi !== undefined) return monthRangeMessage(undefined, hi);
  return undefined;
}

/** The year steppers: the picker's icon button, a 44 px target where a phone shows the grid */
const stepperButton = `${pickerIconButton} max-md:min-h-11 max-md:min-w-11`;

/** How far each arrow key moves along the month grid's rows of three */
const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };

interface MonthGridProps {
  /** The chosen month, YYYY-MM, or '' for none */
  value: string;
  onPick: (month: string) => void;
  /** Whether a YYYY-MM month cannot be chosen; its button is disabled */
  isDisabled: (month: string) => boolean;
  /** Shown above the year stepper and naming the grid's group ("From", "To") */
  label?: string;
  /** Focus the chosen month (else this month, else the first one) when the grid mounts */
  focusOnOpen?: boolean;
  /** The earliest year the stepper goes back to, when later than 2000 */
  minYear?: number;
}

/**
 * A year stepper, a three-by-four grid of month buttons and a This month footer: the one month
 * grid MonthPicker and (from plan 02-14) MonthRangePicker share (D-11). Each month button has
 * its full month and year as its name and `aria-pressed` when chosen.
 */
export function MonthGrid({
  value,
  onPick,
  isDisabled,
  label,
  focusOnOpen = false,
  minYear,
}: MonthGridProps) {
  const thisMonth = thisMonthIso();
  const floor = Math.max(MIN_YEAR, minYear ?? MIN_YEAR);
  const start = parts(value) ?? parts(thisMonth);
  const [year, setYear] = useState(() => Math.max(floor, start?.year ?? floor));
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusOnOpen) return;
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const pick =
      gridRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)') ??
      gridRef.current?.querySelector<HTMLButtonElement>('[data-this-month]:not(:disabled)') ??
      buttons?.[0];
    pick?.focus({ preventScroll: true });
    // Not on `year`: stepping the year keeps focus where the person put it
  }, [focusOnOpen]);

  // Arrow keys move along the three-by-four grid, within the year, onto enabled months only
  function move(event: KeyboardEvent, index: number) {
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const target = gridRef.current?.querySelectorAll<HTMLButtonElement>('button')[index + step];
    if (target && !target.disabled) target.focus();
  }

  return (
    <div role={label ? 'group' : undefined} aria-label={label}>
      {label && <p className="text-xs font-medium text-text-tertiary mb-2">{label}</p>}
      <div className="flex items-center justify-between gap-2 mb-2">
        <AriaButton
          aria-label="Previous year"
          slot={null}
          isDisabled={year <= floor}
          onPress={() => setYear(year - 1)}
          className={stepperButton}
        >
          <ChevronLeft size={16} aria-hidden />
        </AriaButton>
        <span className="text-sm font-medium text-text tabular-nums">{year}</span>
        <AriaButton
          aria-label="Next year"
          slot={null}
          onPress={() => setYear(year + 1)}
          className={stepperButton}
        >
          <ChevronRight size={16} aria-hidden />
        </AriaButton>
      </div>
      <div ref={gridRef} className="grid grid-cols-3 gap-1">
        {SHORT.map((short, i) => {
          const month = toMonth(year, i + 1);
          const chosen = month === value;
          const disabled = isDisabled(month);
          return (
            <button
              key={short}
              type="button"
              disabled={disabled}
              aria-pressed={chosen}
              aria-label={`${FULL[i]} ${year}`}
              data-this-month={month === thisMonth || undefined}
              onClick={() => onPick(month)}
              onKeyDown={(event) => move(event, i)}
              className={`relative h-9 max-md:min-h-11 rounded-md text-xs font-medium outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-600 ${
                chosen
                  ? 'bg-brand-600 text-brand-contrast'
                  : disabled
                    ? 'text-text-disabled cursor-not-allowed'
                    : 'text-text-secondary hover:bg-hover'
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
      <div className={pickerFooterClass}>
        <AriaButton
          aria-label="Select this month"
          slot={null}
          isDisabled={isDisabled(thisMonth)}
          onPress={() => onPick(thisMonth)}
          className={pickerShortcutClass}
        >
          This month
        </AriaButton>
      </div>
    </div>
  );
}

interface Props {
  label: string;
  /** A YYYY-MM month, or '' for none */
  value: string;
  /** A chosen month as YYYY-MM; a cleared one as '' */
  onChange: (value: string) => void;
  /** Clearing is offered when the month is optional */
  optional?: boolean;
  /** Earliest allowed month, YYYY-MM, itself allowed */
  minValue?: string;
  /** Latest allowed month, YYYY-MM, itself allowed */
  maxValue?: string;
  id?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  /** Names the subject of the Clear button and the default required line instead of the label */
  errorLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Focusable and announced, but the value cannot change and the grid does not open */
  isReadOnly?: boolean;
  isRequired?: boolean;
  /** Added to the field's outer box; full width unless the caller gives its own */
  className?: string;
}

/**
 * The shared MonthPicker (02-UI-SPEC.md, per-control item 11; D-04, D-11). On desktop, the grid
 * form the owner chose: a trigger showing the month, or "Select month", opening a year stepper
 * and a twelve-month grid. On phones (under 768 px) it is the native month input, where the
 * browser has one (supportsMonthInput); elsewhere the grid, which fits a phone. Both take and
 * give a YYYY-MM string, '' for none, with DatePicker's states and lines.
 */
export function MonthPicker(props: Props) {
  const {
    label,
    value,
    onChange,
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
  const [open, setOpen] = useState(false);
  const ids = useId();
  const subject = fieldSubject({ errorLabel, label });
  const outOfRange = isMonth(value) && outside(value, minValue, maxValue);
  // A caller's message always wins; then the range line, then the required line
  const error = errorLine(errorMessage, {
    isRequired,
    kind: 'choice',
    names: { errorLabel, label },
    own: outOfRange ? rangeLine(minValue, maxValue) : undefined,
  });
  const invalid = isInvalid || outOfRange;
  const shownError = invalid ? error : undefined;

  // A browser with no native month input keeps the grid on phones too (02-REVIEW WR-02)
  if (isPhone && supportsMonthInput())
    return <NativePicker {...props} type="month" className={className} error={shownError} />;

  const labelId = `${ids}-label`;
  const valueId = `${ids}-value`;
  const minYear = parts(minValue)?.year;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Label elementType="span" id={labelId} isRequired={isRequired}>
        {label}
      </Label>
      <Group
        isDisabled={isDisabled}
        isInvalid={invalid}
        isReadOnly={isReadOnly}
        className={pickerGroupClass}
      >
        {/* Read-only never opens: the trigger takes focus, but the grid stays shut */}
        <DialogTrigger
          isOpen={open && !isReadOnly}
          onOpenChange={(next) => setOpen(next && !isReadOnly)}
        >
          <AriaButton
            id={id}
            // "{Label} Nov 2026" or "{Label} Select month": the visible label is in the name
            aria-labelledby={`${labelId} ${valueId}`}
            aria-describedby={describedByIds(ids, description, shownError)}
            isDisabled={isDisabled}
            className="flex flex-1 min-w-0 h-full items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed"
          >
            <span id={valueId} className={`truncate ${value ? '' : 'text-text-tertiary'}`}>
              {value ? formatMonth(value) : 'Select month'}
            </span>
            <CalendarRange size={16} aria-hidden="true" className="shrink-0 text-text-tertiary" />
          </AriaButton>
          <Popover placement="bottom start" offset={4} className={pickerPopoverClass}>
            <Dialog aria-label="Choose a month" className="p-3 w-[224px] outline-none">
              {({ close }) => (
                <MonthGrid
                  value={value}
                  onPick={(month) => {
                    onChange(month);
                    close();
                  }}
                  isDisabled={(month) => outside(month, minValue, maxValue)}
                  minYear={minYear}
                  focusOnOpen
                />
              )}
            </Dialog>
          </Popover>
        </DialogTrigger>
        {optional && value && !isDisabled && !isReadOnly && (
          <AriaButton
            aria-label={`Clear ${subject}`}
            onPress={() => onChange('')}
            className={pickerIconButton}
          >
            <X size={14} aria-hidden />
          </AriaButton>
        )}
      </Group>
      <FieldLines id={ids} description={description} error={shownError} />
    </div>
  );
}
