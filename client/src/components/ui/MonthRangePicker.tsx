import { useId, useRef, useState, type ReactNode } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button as AriaButton, Dialog, DialogTrigger, Group, Popover } from 'react-aria-components';
import { useIsPhone } from '../../hooks/useIsPhone';
import { thisMonthIso } from '../../utils/calendarDay';
import {
  formatMonth,
  formatMonthRange,
  isMonth,
  pickRangeMonth,
  type MonthRange,
} from '../../utils/dateRange';
import { Button } from './Button';
import { describedByIds, FieldLines } from './Field';
import { fieldHeights, pickerGroupBase, pickerPopoverClass } from './fieldClasses';
import { Label } from './Label';
import { MonthGrid } from './MonthPicker';
import { supportsMonthInput } from './nativeInput';

interface Props {
  /** 'yyyy-MM' */
  from: string;
  /** 'yyyy-MM' */
  to: string;
  /** Called only when the range changed, with from on or before to and neither after max */
  onChange: (from: string, to: string) => void;
  /** Latest selectable month, 'yyyy-MM' (defaults to the current month) */
  max?: string;
  /** Open the popover on mount, e.g. right after choosing the "Custom" preset (desktop only) */
  defaultOpen?: boolean;
  /** A visible label; without one the range text alone names the control */
  label?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Focusable and announced, but the months cannot change and the grids do not open */
  isReadOnly?: boolean;
  id?: string;
  /** Added to the outer box */
  className?: string;
}

/**
 * MonthPicker's trigger group at the small control height (32 px, beside `sm` buttons): its
 * three users sit in toolbars, so it is as wide as its text rather than the whole row
 */
const rangeGroupClass = [
  pickerGroupBase,
  'w-fit max-w-full pl-3 pr-3 text-xs',
  fieldHeights.sm,
].join(' ');

/** Phone From/To box: shows short month text behind a full-size transparent native month input */
const phoneBoxClass = `${pickerGroupBase} relative w-full min-w-0 min-h-11 px-3 justify-between text-base`;

/**
 * A month range (02-UI-SPEC.md, per-control item 11; D-04, D-11). On desktop, a compact
 * "Jan 2025 – Nov 2026" trigger opening two of MonthPicker's month grids, From and To, so the two
 * controls cannot drift apart; picks are a draft until Done. On phones (under 768 px), two native
 * month inputs, where the phone's own picker is the draft; a browser without a native month input
 * (supportsMonthInput) keeps the grids, stacked to fit the phone. Every pick goes through
 * pickRangeMonth, so the range never ends before it starts and never passes max.
 */
export function MonthRangePicker({
  from,
  to,
  onChange,
  max = thisMonthIso(),
  defaultOpen = false,
  label,
  description,
  errorMessage,
  isDisabled = false,
  isInvalid = false,
  isReadOnly = false,
  id,
  className = '',
}: Props) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<MonthRange>({ from, to });
  // Neither grid steps past the year of the last month either can choose (02-REVIEW IN-03)
  const maxYear = isMonth(max) ? Number(max.split('-')[0]) : undefined;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const ids = useId();
  const error = isInvalid ? errorMessage : undefined;
  const describedBy = describedByIds(ids, description, error);
  const labelId = `${ids}-label`;

  // A browser with no native month input keeps the grids on phones too (02-REVIEW WR-02)
  if (isPhone && supportsMonthInput()) {
    // A cleared or half-typed month reads as '', which pickRangeMonth refuses: the inputs stay
    // on the saved range
    const change = (side: 'from' | 'to', month: string) => {
      const next = pickRangeMonth({ from, to }, side, month, max);
      if (next.from !== from || next.to !== to) onChange(next.from, next.to);
    };
    const input = (side: 'from' | 'to', name: string) => {
      const inputId = side === 'from' && id ? id : `${ids}-${side}`;
      const value = side === 'from' ? from : to;
      const formatted = value ? formatMonth(value) : '';
      return (
        <div className="flex flex-1 min-w-0 flex-col gap-1">
          <Label htmlFor={inputId}>{name}</Label>
          <div
            data-disabled={isDisabled || undefined}
            data-invalid={isInvalid || undefined}
            data-readonly={isReadOnly || undefined}
            className={phoneBoxClass}
          >
            {/* Input comes first with `peer` so keyboard focus shows native segment editing and hides the display span (WR-03) */}
            <input
              type="month"
              id={inputId}
              value={value}
              min={side === 'to' ? from : undefined}
              max={max}
              onChange={(e) => change(side, e.target.value)}
              disabled={isDisabled}
              readOnly={isReadOnly}
              aria-invalid={isInvalid || undefined}
              aria-describedby={describedBy}
              className={`peer absolute inset-0 z-10 h-full w-full min-h-11 rounded-md bg-transparent px-3 text-base text-text outline-none opacity-0 focus-visible:opacity-100 ${
                isDisabled ? 'cursor-not-allowed' : isReadOnly ? 'cursor-default' : 'cursor-pointer'
              }`}
            />
            <span
              aria-hidden="true"
              data-month-display={side}
              className={`min-w-0 truncate tabular-nums peer-focus-visible:invisible ${formatted ? '' : 'text-text-tertiary'}`}
            >
              {formatted || 'Select month'}
            </span>
            <CalendarRange
              size={16}
              aria-hidden="true"
              className={`shrink-0 peer-focus-visible:invisible ${isDisabled ? 'text-text-disabled' : 'text-text-tertiary'}`}
            />
          </div>
        </div>
      );
    };
    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {label && (
          <Label elementType="span" id={labelId}>
            {label}
          </Label>
        )}
        <div
          role="group"
          aria-label={label ? undefined : 'Months'}
          aria-labelledby={label ? labelId : undefined}
          className="flex gap-2"
        >
          {input('from', 'From')}
          {input('to', 'To')}
        </div>
        <FieldLines id={ids} description={description} error={error} />
      </div>
    );
  }

  // Back to the trigger, unless the person pressed outside onto something that took focus
  function refocus() {
    const active = document.activeElement;
    if (!active || active === document.body || dialogRef.current?.contains(active))
      triggerRef.current?.focus();
  }

  function openChange(next: boolean) {
    // Read-only never opens; the draft starts from the saved months each time it does
    if (next && isReadOnly) return;
    if (next) setDraft({ from, to });
    else refocus();
    setOpen(next);
  }

  function apply() {
    if (draft.from !== from || draft.to !== to) onChange(draft.from, draft.to);
    openChange(false);
  }

  const pick = (side: 'from' | 'to') => (month: string) =>
    setDraft((range) => pickRangeMonth(range, side, month, max));
  const valueId = `${ids}-value`;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <Label elementType="span" id={labelId}>
          {label}
        </Label>
      )}
      <Group
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        isReadOnly={isReadOnly}
        className={rangeGroupClass}
      >
        <DialogTrigger isOpen={open && !isReadOnly} onOpenChange={openChange}>
          <AriaButton
            ref={triggerRef}
            id={id}
            aria-haspopup="dialog"
            // "{Label} Jan 2025 – Nov 2026" with a label; the range text alone without one
            aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
            aria-describedby={describedBy}
            isDisabled={isDisabled}
            className="flex min-w-0 h-full items-center gap-2 font-medium text-text-secondary outline-none disabled:cursor-not-allowed"
          >
            <CalendarRange size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />
            <span id={valueId} className="tabular-nums whitespace-nowrap">
              {formatMonthRange(from, to)}
            </span>
          </AriaButton>
          <Popover
            placement="bottom start"
            offset={4}
            className={`${pickerPopoverClass} max-md:overflow-y-auto`}
          >
            <Dialog ref={dialogRef} aria-label="Choose months" className="p-3 outline-none">
              {/* Stacked on a phone, which shows the grids only without a native month input */}
              <div className="flex gap-4 max-md:flex-col">
                <div className="w-[200px]">
                  <MonthGrid
                    label="From"
                    value={draft.from}
                    onPick={pick('from')}
                    isDisabled={(month) => month > max}
                    maxYear={maxYear}
                    focusOnOpen
                  />
                </div>
                <div className="w-[200px]">
                  <MonthGrid
                    label="To"
                    value={draft.to}
                    onPick={pick('to')}
                    isDisabled={(month) => month < draft.from || month > max}
                    maxYear={maxYear}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-border-light">
                <span className="text-xs text-text-tertiary tabular-nums">
                  {formatMonthRange(draft.from, draft.to)}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openChange(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={apply}>
                    Done
                  </Button>
                </div>
              </div>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </Group>
      <FieldLines id={ids} description={description} error={error} />
    </div>
  );
}
