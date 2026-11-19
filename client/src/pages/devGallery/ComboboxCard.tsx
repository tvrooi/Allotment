import { useState } from 'react';
import { PayeeCombobox } from '../../components/transactions/PayeeCombobox';
import { Combobox } from '../../components/ui/Combobox';
import type { SelectOption } from '../../components/ui/Select';
import type { Payee } from '../../types';
import { GalleryCard, Specimen } from './Specimen';

/** Sample account names: a user-grown list, which is what a Combobox is for (D-06) */
export const ACCOUNTS: SelectOption[] = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'savings', label: 'Savings' },
  { value: 'joint', label: 'Joint bills' },
  { value: 'holiday', label: 'Holiday savings' },
  { value: 'credit', label: 'Credit card' },
  { value: 'offset', label: 'Home loan offset' },
];

const SHORT = ACCOUNTS.slice(0, 3);

const MANY: SelectOption[] = Array.from({ length: 40 }, (_, i) => ({
  value: `envelope-${i + 1}`,
  label: `Envelope ${i + 1}`,
}));

/** Two options with one label, told apart only by value (E-02) */
const SAME_LABEL: SelectOption[] = [
  { value: 'savings-up', label: 'Savings' },
  { value: 'savings-bank', label: 'Savings' },
  { value: 'everyday', label: 'Everyday' },
];

const LONG: SelectOption[] = [
  {
    value: 'long',
    label:
      'Joint everyday account shared with the household for bills, groceries and the weekend away',
  },
  { value: 'short', label: 'Personal' },
];

/** Twelve sample payees for the payee field, more than the eight it lists */
export const PAYEES: Payee[] = [
  'Corner Grocery',
  'Corner Bakery',
  'Fuel Stop',
  'Streamflix',
  'City Council',
  'Gym Co',
  'Pharmacy',
  'Bookshop',
  'Corner Café',
  'Bäckerei Müller',
  'Hardware Barn',
  'Zoo',
].map((name, i) => ({
  id: `payee-${i + 1}`,
  name,
  defaultCategoryId: null,
  logo: null,
  skipCategoryFollowup: 0,
  createdAt: '2026-11-18T00:00:00.000Z',
}));

/** The payee field's value, starting from a typed name that matches no payee */
function PayeeSpecimen() {
  const [value, setValue] = useState<{ id: string | null; name: string }>({
    id: null,
    name: 'Night Market',
  });
  return (
    <div>
      <PayeeCombobox value={value} onChange={setValue} payees={PAYEES} />
      <p data-testid="combobox-readout" className="mt-1 text-xs text-text-tertiary">
        Payee: {value.name || 'none'}; id: {value.id ?? 'new'}
      </p>
    </div>
  );
}

/** A controlled value, so each specimen keeps what is chosen in it */
function useChoice(initial = '') {
  const [value, setValue] = useState(initial);
  return { value, onChange: setValue };
}

/** A value and the field's text as the Combobox reports them, with a line that shows both */
function useReported(initial = '', initialText = '') {
  const [value, setValue] = useState(initial);
  const [text, setText] = useState(initialText);
  const line = (
    <p data-testid="combobox-readout" className="mt-1 text-xs text-text-tertiary">
      Text: {text}; value: {value || 'none'}
    </p>
  );
  return { props: { value, onChange: setValue, onInputChange: setText }, line };
}

/**
 * The shared Combobox in its five states, then custom values, opening on focus, caller-owned
 * filtering, empty states, a footer, zero, one and many options, clearing in both naming forms,
 * two options with one label, a long label, and the payee field built on it (02-UI-SPEC.md,
 * per-control item 6). Focus is the specimen the keyboard tests Tab onto.
 */
export function ComboboxCard() {
  const def = useChoice();
  const focus = useChoice();
  const invalid = useChoice();
  const custom = useReported();
  const onFocus = useChoice();
  const callerFilters = useChoice();
  const customEmpty = useChoice();
  const footer = useChoice();
  const none = useChoice();
  const one = useChoice();
  const many = useChoice();
  const optional = useReported('savings', 'Savings');
  const named = useChoice('everyday');
  const required = useChoice();
  const sameLabel = useReported();
  const long = useChoice('long');
  return (
    <GalleryCard title="Combobox">
      <Specimen control="Combobox" state="Default">
        <Combobox label="Account" placeholder="Choose an account" items={ACCOUNTS} {...def} />
      </Specimen>
      <Specimen control="Combobox" state="Focus">
        <Combobox
          aria-label="Paid from"
          placeholder="Choose an account"
          items={ACCOUNTS}
          {...focus}
        />
      </Specimen>
      <Specimen control="Combobox" state="Disabled">
        <Combobox
          label="Imported into"
          items={ACCOUNTS}
          isDisabled
          value="everyday"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Combobox" state="Invalid">
        <Combobox
          label="Transfer to"
          items={ACCOUNTS}
          isInvalid
          errorMessage="Choose a different account from the one it came from."
          {...invalid}
        />
      </Specimen>
      <Specimen control="Combobox" state="Read-only">
        <Combobox
          label="Set by the bank"
          items={ACCOUNTS}
          isReadOnly
          value="joint"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Combobox" state="Custom value">
        <div>
          <Combobox
            label="Payee"
            placeholder="Payee"
            items={ACCOUNTS}
            allowsCustomValue
            {...custom.props}
          />
          {custom.line}
        </div>
      </Specimen>
      <Specimen control="Combobox" state="Opens on focus">
        <Combobox label="Account to open" items={ACCOUNTS} menuTrigger="focus" {...onFocus} />
      </Specimen>
      <Specimen control="Combobox" state="Caller filters">
        <Combobox
          label="Recent accounts"
          description="The caller narrows the list itself"
          items={SHORT}
          filter={false}
          {...callerFilters}
        />
      </Specimen>
      <Specimen control="Combobox" state="Custom empty state">
        <Combobox
          label="Household account"
          items={ACCOUNTS}
          emptyState={
            <p className="px-3 py-2 text-sm text-text-tertiary">No account has that name yet</p>
          }
          {...customEmpty}
        />
      </Specimen>
      <Specimen control="Combobox" state="Footer">
        <Combobox
          label="Linked account"
          items={[]}
          footer={<p className="px-3 py-2 text-xs text-text-tertiary">Add accounts in Settings</p>}
          {...footer}
        />
      </Specimen>
      <Specimen control="Combobox" state="No options">
        <Combobox label="Tag" placeholder="Choose a tag" items={[]} {...none} />
      </Specimen>
      <Specimen control="Combobox" state="One option">
        <Combobox
          label="Household"
          placeholder="Choose a household"
          items={[ACCOUNTS[2]]}
          {...one}
        />
      </Specimen>
      <Specimen control="Combobox" state="Many options">
        <Combobox label="Envelope" placeholder="Choose an envelope" items={MANY} {...many} />
      </Specimen>
      <Specimen control="Combobox" state="Optional">
        <div>
          <Combobox label="Account" items={ACCOUNTS} optional {...optional.props} />
          {optional.line}
        </div>
      </Specimen>
      <Specimen control="Combobox" state="Named by aria-label">
        <Combobox aria-label="Payee" items={ACCOUNTS} optional {...named} />
      </Specimen>
      <Specimen control="Combobox" state="Required">
        <Combobox aria-label="Payee" items={ACCOUNTS} isRequired isInvalid {...required} />
      </Specimen>
      <Specimen control="Combobox" state="Same label">
        <div>
          <Combobox label="Savings account" items={SAME_LABEL} {...sameLabel.props} />
          {sameLabel.line}
        </div>
      </Specimen>
      <Specimen control="Combobox" state="Long text">
        <Combobox label="Bills account" items={LONG} className="w-full max-w-sm" {...long} />
      </Specimen>
      <Specimen control="Combobox" state="Payee field">
        <PayeeSpecimen />
      </Specimen>
    </GalleryCard>
  );
}
