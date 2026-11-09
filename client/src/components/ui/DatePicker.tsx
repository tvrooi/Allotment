import { parseDate, type CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
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
  Label,
  Popover,
} from 'react-aria-components';
import { useIsPhone } from '../../hooks/useIsPhone';
import { usePreferencesStore, type DateFormatOption } from '../../store/preferencesStore';

/**
 * The language whose day/month/year order matches the Date format preference, so the typed
 * segments read the way every other date in the app does. Dotted dates keep the device's own
 * language, which is where that preference came from.
 */
function localeFor(format: DateFormatOption): string {
  if (format === 'dd/MM/yyyy') return 'en-AU';
  if (format === 'yyyy-MM-dd') return 'en-CA';
  if (format === 'dd.MM.yyyy') return navigator.language;
  return 'en-US';
}

const toCalendarDate = (value: string): CalendarDate | null => {
  try {
    return value ? parseDate(value) : null;
  } catch {
    return null;
  }
};

interface Props {
  /** A real YYYY-MM-DD day, or '' for none */
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Clearing is offered when the date is optional */
  optional?: boolean;
  minValue?: string;
  maxValue?: string;
}

const iconButton =
  'flex items-center justify-center rounded-md text-text-tertiary hover:text-text hover:bg-hover outline-none focus-visible:ring-2 focus-visible:ring-brand-600';

/**
 * A date field with a calendar (React Aria, after shadcn's aria calendar, in Allotment's
 * tokens). Values stay YYYY-MM-DD strings, as everywhere else. Phones keep the native picker,
 * which their keyboards and wheels already do well.
 */
export function DatePicker({ value, onChange, label, optional, minValue, maxValue }: Props) {
  const isPhone = useIsPhone();
  const format = usePreferencesStore((s) => s.dateFormat);
  const labelClass = 'block text-sm font-medium text-text-secondary mb-1.5';

  if (isPhone)
    return (
      <label className="block">
        <span className={labelClass}>{label}</span>
        <input
          type="date"
          value={value}
          min={minValue}
          max={maxValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-11 px-3 py-2 text-base border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
        />
      </label>
    );

  return (
    <I18nProvider locale={localeFor(format)}>
      <AriaDatePicker
        value={toCalendarDate(value)}
        // A CalendarDate writes itself as a real YYYY-MM-DD day
        onChange={(d) => onChange(d ? d.toString() : '')}
        minValue={toCalendarDate(minValue ?? '') ?? undefined}
        maxValue={toCalendarDate(maxValue ?? '') ?? undefined}
        className="group w-full"
      >
        <Label className={labelClass}>{label}</Label>
        <Group className="flex items-center gap-1 w-full h-10 pl-3 pr-1 text-sm border border-border rounded-md bg-surface text-text focus-within:ring-1 focus-within:ring-brand-600 focus-within:border-brand-600 group-data-[invalid]:border-negative">
          <DateInput className="flex flex-1 min-w-0 tabular-nums">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded-sm px-0.5 outline-none text-text data-[placeholder]:text-text-tertiary data-[type=literal]:px-0 data-[type=literal]:text-text-tertiary focus:bg-brand-100 focus:text-text"
              />
            )}
          </DateInput>
          {optional && value && (
            <AriaButton
              aria-label={`Clear ${label.toLowerCase()}`}
              // Not a calendar slot: it empties the field instead of opening the calendar
              slot={null}
              onPress={() => onChange('')}
              className={`${iconButton} size-8`}
            >
              <X size={14} aria-hidden />
            </AriaButton>
          )}
          <AriaButton aria-label="Choose from a calendar" className={`${iconButton} size-8`}>
            <CalendarDays size={16} aria-hidden />
          </AriaButton>
        </Group>
        <Popover
          placement="bottom end"
          offset={6}
          className="rounded-lg border border-border-light bg-surface shadow-card outline-none data-[entering]:animate-menu-in"
        >
          <Dialog className="p-3 outline-none">
            <Calendar className="w-fit">
              <header className="flex items-center justify-between gap-2 mb-2">
                <AriaButton slot="previous" className={`${iconButton} size-8`}>
                  <ChevronLeft size={16} aria-hidden />
                </AriaButton>
                <Heading className="text-sm font-semibold text-text" />
                <AriaButton slot="next" className={`${iconButton} size-8`}>
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
                      className="flex size-9 items-center justify-center rounded-md text-sm tabular-nums text-text cursor-default outline-none hover:bg-hover data-[outside-month]:text-text-disabled data-[disabled]:text-text-disabled data-[disabled]:hover:bg-transparent data-[unavailable]:line-through data-[today]:font-semibold data-[today]:ring-1 data-[today]:ring-inset data-[today]:ring-border data-[selected]:bg-brand-600 data-[selected]:text-brand-contrast data-[selected]:ring-0 data-[focus-visible]:ring-2 data-[focus-visible]:ring-brand-600"
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </AriaDatePicker>
    </I18nProvider>
  );
}
