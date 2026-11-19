import { useState } from 'react';
import { CategoryPicker } from '../../components/transactions/CategoryPicker';
import { PayeeCombobox } from '../../components/transactions/PayeeCombobox';
import { Button } from '../../components/ui/Button';
import { Combobox } from '../../components/ui/Combobox';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Modal';
import { MonthPicker } from '../../components/ui/MonthPicker';
import { MonthRangePicker } from '../../components/ui/MonthRangePicker';
import { Select } from '../../components/ui/Select';
import { ACCOUNTS, PAYEES } from './ComboboxCard';
import { GROUPS, TRANSFER_ACCOUNTS } from './PickerCards';
import { FREQUENCIES } from './SelectCard';
import { GalleryCard, Specimen } from './Specimen';

/** The category picker's button, opening it beside itself as the app's forms do */
function CategoryButton() {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <Button ref={setOpener} variant="secondary" onClick={() => setOpen(!open)}>
        Category: {value ?? 'none'}
      </Button>
      {open && (
        <CategoryPicker
          value={value}
          groups={GROUPS}
          transferAccounts={TRANSFER_ACCOUNTS}
          anchor={opener}
          onClose={() => setOpen(false)}
          onChange={(next) => {
            setValue(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The shared Modal holding one of each popover control, so the gallery's specs can show that
 * Escape with a list open closes only the list and leaves the dialog open (D-12), and that Tab
 * stays inside the dialog. Values start on the gallery's pinned day and months.
 */
export function DialogCard() {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [account, setAccount] = useState('');
  const [day, setDay] = useState('2026-11-16');
  const [month, setMonth] = useState('2026-11');
  const [range, setRange] = useState({ from: '2026-06', to: '2026-11' });
  const [payee, setPayee] = useState<{ id: string | null; name: string }>({ id: null, name: '' });
  return (
    <GalleryCard title="In a dialog">
      <Specimen control="Dialog" state="Default">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open a dialog
        </Button>
      </Specimen>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Controls in a dialog">
        <div className="space-y-4">
          <Select
            label="Frequency"
            options={FREQUENCIES}
            value={frequency}
            onChange={setFrequency}
          />
          <Combobox
            label="Account"
            placeholder="Choose an account"
            items={ACCOUNTS}
            value={account}
            onChange={setAccount}
          />
          <DatePicker label="Date" value={day} onChange={setDay} />
          <MonthPicker label="Month" value={month} onChange={setMonth} />
          <MonthRangePicker
            {...range}
            max="2026-12"
            label="Months"
            onChange={(from, to) => setRange({ from, to })}
          />
          <PayeeCombobox value={payee} onChange={setPayee} payees={PAYEES} />
          <CategoryButton />
        </div>
      </Modal>
    </GalleryCard>
  );
}
