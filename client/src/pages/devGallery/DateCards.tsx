import { useState } from 'react';
import { DatePicker } from '../../components/ui/DatePicker';
import { MonthPicker } from '../../components/ui/MonthPicker';
import { MonthRangePicker } from '../../components/ui/MonthRangePicker';
import { AmountFields, useAmountValidity } from '../../components/ui/amountValidity';
import { formatDay } from '../../utils/dates';
import { GalleryCard, Specimen } from './Specimen';

/** The pinned day the specimens start on, so screenshots never depend on the day they run */
const DAY = '2026-11-16';

/** The pinned month the MonthPicker specimens start on */
const MONTH = '2026-11';

/** A controlled value, so each specimen keeps what is typed or picked in it */
function useDay(initial = '') {
  const [value, setValue] = useState(initial);
  return { value, onChange: setValue };
}

/** The specimen's value as the person reads it, for specs to read back */
function Shown({ value }: { value: string }) {
  return (
    <p className="mt-1 text-xs text-text-tertiary">
      Value: <output>{value ? formatDay(value) : 'none'}</output>
    </p>
  );
}

/** A month specimen's value as stored (YYYY-MM), for specs to read back */
function ShownMonth({ value }: { value: string }) {
  return (
    <p className="mt-1 text-xs text-text-tertiary">
      Value: <output>{value || 'none'}</output>
    </p>
  );
}

/**
 * The shared DatePicker in its five states, an empty optional one, ranged ones (both bounds, a
 * floor only, and a ceiling that leaves today out), a required empty one and a required, invalid
 * empty one, the small, label-hidden size a rule condition row uses (02-UI-SPEC.md, per-control
 * item 10), and one inside a form whose save waits while the date is half-typed. Each starts on
 * or near the pinned day.
 */
export function DatePickerCard() {
  const def = useDay(DAY);
  const focus = useDay(DAY);
  const optional = useDay();
  const optionalHint = useDay();
  const ranged = useDay(DAY);
  const fromNovember = useDay(DAY);
  const required = useDay();
  const beforeToday = useDay('2026-10-16');
  const small = useDay(DAY);
  const inForm = useDay(DAY);
  const form = useAmountValidity();
  return (
    <GalleryCard title="DatePicker">
      <Specimen control="DatePicker" state="Default">
        <DatePicker label="Date" {...def} />
        <Shown value={def.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Focus">
        <DatePicker label="Paid on" {...focus} />
      </Specimen>
      <Specimen control="DatePicker" state="Disabled">
        <DatePicker label="Imported on" isDisabled value={DAY} onChange={() => {}} />
      </Specimen>
      <Specimen control="DatePicker" state="Invalid">
        <DatePicker
          label="Due date"
          isInvalid
          errorMessage="Choose a day the bill is due."
          value={DAY}
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="DatePicker" state="Read-only">
        <DatePicker label="Settled on" isReadOnly value={DAY} onChange={() => {}} />
      </Specimen>
      <Specimen control="DatePicker" state="Optional">
        <DatePicker
          label="Target date (optional)"
          errorLabel="target date"
          optional
          description="Leave it empty for no deadline"
          {...optional}
        />
        <Shown value={optional.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Optional hint">
        <DatePicker label="End date" optional optionalHint {...optionalHint} />
        <Shown value={optionalHint.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Ranged">
        <DatePicker
          label="Start date"
          minValue="2026-11-01"
          maxValue="2026-11-30"
          description="A day in November 2026"
          {...ranged}
        />
        <Shown value={ranged.value} />
      </Specimen>
      <Specimen control="DatePicker" state="From a day">
        <DatePicker label="Paid from" minValue="2026-11-01" {...fromNovember} />
        <Shown value={fromNovember.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Required">
        <DatePicker label="Bill date" isRequired {...required} />
        <Shown value={required.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Missing">
        <DatePicker label="Due on" isRequired isInvalid value="" onChange={() => {}} />
      </Specimen>
      <Specimen control="DatePicker" state="Before today">
        <DatePicker label="Closed on" maxValue="2026-10-31" {...beforeToday} />
        <Shown value={beforeToday.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Small">
        <DatePicker label="Applies from" hideLabel fieldSize="sm" {...small} />
        <Shown value={small.value} />
      </Specimen>
      <Specimen control="DatePicker" state="Half-typed in a form">
        {/* Clearing one segment leaves the caller's last whole day, so the form is told instead */}
        <AmountFields report={form.report}>
          <DatePicker label="Pay date" isRequired {...inForm} />
        </AmountFields>
        <Shown value={inForm.value} />
        <p className="mt-1 text-xs text-text-tertiary">
          Save:{' '}
          <output data-testid="save-state">{form.allValid ? 'available' : 'unavailable'}</output>
        </p>
      </Specimen>
    </GalleryCard>
  );
}

/**
 * The shared MonthPicker in its five states, an empty optional one, a ranged one whose bounds can
 * be chosen, a required, invalid empty one and one whose range ends before this month, showing
 * the range line (02-UI-SPEC.md, per-control item 11). Each starts on the pinned month.
 */
export function MonthPickerCard() {
  const def = useDay(MONTH);
  const focus = useDay(MONTH);
  const optional = useDay();
  const ranged = useDay(MONTH);
  const beforeThisMonth = useDay(MONTH);
  return (
    <GalleryCard title="MonthPicker">
      <Specimen control="MonthPicker" state="Default">
        <MonthPicker label="Budget month" {...def} />
        <ShownMonth value={def.value} />
      </Specimen>
      <Specimen control="MonthPicker" state="Focus">
        <MonthPicker label="Report month" {...focus} />
      </Specimen>
      <Specimen control="MonthPicker" state="Disabled">
        <MonthPicker label="Imported month" optional isDisabled value={MONTH} onChange={() => {}} />
      </Specimen>
      <Specimen control="MonthPicker" state="Invalid">
        <MonthPicker
          label="Statement month"
          isInvalid
          errorMessage="Choose a month the bank has sent."
          value={MONTH}
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="MonthPicker" state="Read-only">
        <MonthPicker label="Closed month" optional isReadOnly value={MONTH} onChange={() => {}} />
      </Specimen>
      <Specimen control="MonthPicker" state="Optional">
        <MonthPicker
          label="Ends in (optional)"
          errorLabel="end month"
          optional
          description="Leave it empty to keep going"
          {...optional}
        />
        <ShownMonth value={optional.value} />
      </Specimen>
      <Specimen control="MonthPicker" state="Ranged">
        <MonthPicker label="Start month" minValue="2026-03" maxValue="2026-11" {...ranged} />
        <ShownMonth value={ranged.value} />
      </Specimen>
      <Specimen control="MonthPicker" state="Missing">
        <MonthPicker label="Pay month" isRequired isInvalid value="" onChange={() => {}} />
      </Specimen>
      <Specimen control="MonthPicker" state="Before this month">
        <MonthPicker label="Last full month" maxValue="2026-10" {...beforeThisMonth} />
        <ShownMonth value={beforeThisMonth.value} />
      </Specimen>
    </GalleryCard>
  );
}

/** The pinned range the MonthRangePicker specimens start on, and their latest month */
const RANGE = { from: '2026-06', to: '2026-11' };
const RANGE_MAX = '2026-12';

/** A controlled month range, so each specimen keeps what is picked in it */
function useRange() {
  const [range, setRange] = useState(RANGE);
  return {
    ...range,
    max: RANGE_MAX,
    onChange: (from: string, to: string) => setRange({ from, to }),
  };
}

/** A range specimen's value as stored, for specs to read back */
function ShownRange({ from, to }: { from: string; to: string }) {
  return (
    <p className="mt-1 text-xs text-text-tertiary">
      Value: <output>{`${from} to ${to}`}</output>
    </p>
  );
}

/**
 * The shared MonthRangePicker in its five states and with a label (02-UI-SPEC.md, per-control
 * item 11): each starts on June to November 2026, with December 2026 the latest month.
 */
export function MonthRangePickerCard() {
  const def = useRange();
  const focus = useRange();
  const labelled = useRange();
  const fixed = { ...RANGE, max: RANGE_MAX, onChange: () => {} };
  return (
    <GalleryCard title="MonthRangePicker">
      <Specimen control="MonthRangePicker" state="Default">
        <MonthRangePicker {...def} />
        <ShownRange {...def} />
      </Specimen>
      <Specimen control="MonthRangePicker" state="Focus">
        <MonthRangePicker {...focus} />
        <ShownRange {...focus} />
      </Specimen>
      <Specimen control="MonthRangePicker" state="Disabled">
        <MonthRangePicker {...fixed} isDisabled />
        <ShownRange {...fixed} />
      </Specimen>
      <Specimen control="MonthRangePicker" state="Invalid">
        <MonthRangePicker {...fixed} isInvalid errorMessage="Choose months the bank has sent." />
        <ShownRange {...fixed} />
      </Specimen>
      <Specimen control="MonthRangePicker" state="Read-only">
        <MonthRangePicker {...fixed} isReadOnly />
        <ShownRange {...fixed} />
      </Specimen>
      <Specimen control="MonthRangePicker" state="Labelled">
        <MonthRangePicker
          {...labelled}
          label="Report months"
          description="The months the report covers"
        />
        <ShownRange {...labelled} />
      </Specimen>
    </GalleryCard>
  );
}
