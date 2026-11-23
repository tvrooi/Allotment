import { Checkbox } from '../../components/ui/Checkbox';
import { DatePicker } from '../../components/ui/DatePicker';
import { Combobox } from '../../components/ui/Combobox';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { useState } from 'react';
import { Select, type SelectGroup, type SelectOption } from '../../components/ui/Select';
import { GalleryCard, Specimen } from './Specimen';

export const FREQUENCIES: SelectOption[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const ACCOUNT_TYPES: SelectGroup[] = [
  {
    label: 'Cash',
    options: [
      { value: 'checking', label: 'Everyday' },
      { value: 'savings', label: 'Savings' },
    ],
  },
  {
    label: 'Credit',
    options: [
      { value: 'credit', label: 'Credit card' },
      { value: 'loan', label: 'Loan' },
      { value: 'bnpl', label: 'Buy now, pay later', isDisabled: true },
    ],
  },
];

const DAYS: SelectOption[] = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `Day ${i + 1} of the month`,
}));

const LONG_OPTIONS: SelectOption[] = [
  {
    value: 'long',
    label:
      'Joint everyday account shared with the household for bills, groceries and the weekend away',
  },
  { value: 'short', label: 'Personal' },
];

/** A controlled value, so each specimen keeps what is chosen in it */
function useChoice(initial = '') {
  const [value, setValue] = useState(initial);
  return { value, onChange: setValue };
}

/**
 * The shared Select in its five states, plus grouped, zero, one and many options and a long
 * chosen label (02-UI-SPEC.md, per-control item 5). Focus is the specimen the keyboard tests
 * Tab onto.
 */
export function SelectCard() {
  const def = useChoice();
  const focus = useChoice();
  const invalid = useChoice();
  const required = useChoice();
  const grouped = useChoice('savings');
  const one = useChoice();
  const none = useChoice();
  const many = useChoice();
  const long = useChoice('long');
  const small = useChoice('monthly');
  return (
    <GalleryCard title="Select">
      <Specimen control="Select" state="Default">
        <Select label="Frequency" placeholder="Choose how often" options={FREQUENCIES} {...def} />
      </Specimen>
      <Specimen control="Select" state="Focus">
        <Select
          aria-label="Repeat"
          placeholder="Choose how often"
          options={FREQUENCIES}
          {...focus}
        />
      </Specimen>
      <Specimen control="Select" state="Disabled">
        <Select
          label="Imported frequency"
          options={FREQUENCIES}
          isDisabled
          value="monthly"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Select" state="Invalid">
        <Select
          label="Pay cycle"
          options={FREQUENCIES}
          isInvalid
          errorMessage="Choose a pay cycle the household uses."
          {...invalid}
        />
      </Specimen>
      <Specimen control="Select" state="Read-only">
        <Select
          label="Set by the bank"
          options={FREQUENCIES}
          isReadOnly
          value="fortnightly"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Select" state="Required">
        <Select
          label="Account type"
          placeholder="Choose a type"
          options={ACCOUNT_TYPES}
          isRequired
          isInvalid
          {...required}
        />
      </Specimen>
      <Specimen control="Select" state="Grouped">
        <Select
          label="Kind of account"
          description="Grouped as the accounts list groups them"
          options={ACCOUNT_TYPES}
          {...grouped}
        />
      </Specimen>
      <Specimen control="Select" state="One option">
        <Select
          label="Household"
          placeholder="Choose a household"
          options={[FREQUENCIES[2]]}
          {...one}
        />
      </Specimen>
      <Specimen control="Select" state="No options">
        <Select label="Tag" placeholder="Choose a tag" options={[]} {...none} />
      </Specimen>
      <Specimen control="Select" state="Many options">
        <Select label="Due day" placeholder="Choose a day" options={DAYS} {...many} />
      </Specimen>
      <Specimen control="Select" state="Long text">
        <Select label="Account" options={LONG_OPTIONS} className="w-full max-w-sm" {...long} />
      </Specimen>
      <Specimen control="Select" state="Small">
        <Select aria-label="Group by" fieldSize="sm" options={FREQUENCIES} {...small} />
      </Specimen>
    </GalleryCard>
  );
}

const SWATCHES = [
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
];

export function FormProbes() {
  return (
    <GalleryCard title="Named form controls">
      <form aria-label="Named form controls" className="space-y-4">
        <Specimen control="Select" state="Swatch">
          <Select
            aria-label="Colour for Food"
            name="colour"
            defaultValue="green"
            options={SWATCHES}
            swatch={(value) => (
              <span
                className={`block size-4 rounded-full ${value === 'red' ? 'bg-negative' : 'bg-positive'}`}
              />
            )}
          />
        </Specimen>
        <Combobox
          label="Frequency"
          name="frequency"
          defaultValue="monthly"
          items={FREQUENCIES}
          optional
        />
        <CurrencyInput aria-label="Amount" name="amount" currency="AUD" defaultValue={1234} />
        <DatePicker label="Due date" name="dueDate" defaultValue="2026-10-21" optional />
        <Checkbox name="advance" value="yes" defaultChecked={false}>
          Advance
        </Checkbox>
        <Checkbox name="isDefault" defaultChecked>
          Default household
        </Checkbox>
      </form>
    </GalleryCard>
  );
}
