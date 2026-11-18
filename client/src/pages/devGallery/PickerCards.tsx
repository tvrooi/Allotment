import { useRef, useState } from 'react';
import { CategoryPicker } from '../../components/transactions/CategoryPicker';
import { Button } from '../../components/ui/Button';
import { SearchList, type SearchListSection } from '../../components/ui/Combobox';
import type { Category, CategoryGroup } from '../../types';
import { GalleryCard, Specimen } from './Specimen';

/** Two sample sections, in the order they are listed */
const SECTIONS: SearchListSection[] = [
  {
    id: 'everyday',
    heading: 'Everyday',
    options: [
      { value: 'groceries', label: 'Groceries' },
      { value: 'dining', label: 'Dining out' },
      { value: 'fuel', label: 'Fuel' },
    ],
  },
  {
    id: 'bills',
    heading: 'Bills',
    options: [
      { value: 'rent', label: 'Rent' },
      { value: 'power', label: 'Power and gas' },
    ],
  },
];

const LABELS = new Map(SECTIONS.flatMap((s) => s.options.map((o) => [o.value, o.label])));

/**
 * The searchable list as a caller drives it: it owns the search and filters by a lower-cased
 * substring, and the pinned "No envelope" row joins the arrow keys only while nothing is typed.
 */
function SearchListSpecimen() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (next: string | null) => {
    setValue(next);
    close();
  };
  const text = query.toLowerCase();
  const sections = SECTIONS.map((s) => ({
    ...s,
    options: s.options.filter((o) => o.label.toLowerCase().includes(text)),
  }));
  return (
    <div>
      <Button ref={trigger} variant="secondary" onClick={() => setOpen(!open)}>
        Envelope: {value ? LABELS.get(value) : 'none'}
      </Button>
      {open && (
        <SearchList
          triggerRef={trigger}
          onClose={close}
          searchLabel="Search envelopes"
          searchPlaceholder="Search envelopes..."
          query={query}
          onQueryChange={setQuery}
          sections={sections}
          value={value}
          onPick={pick}
          pinned={{
            label: 'No envelope',
            isSelected: value === null,
            onPick: () => pick(null),
            inKeyboardOrder: !query,
          }}
          emptyText="No envelopes found"
          width="w-64"
        />
      )}
      <p data-testid="search-list-readout" className="mt-1 text-xs text-text-tertiary">
        Chosen: {value ?? 'none'}
      </p>
    </div>
  );
}

const CREATED = '2026-11-18T00:00:00.000Z';
const category = (id: string, name: string, extra: Partial<Category> = {}): Category => ({
  id,
  groupId: '',
  name,
  icon: null,
  budgetType: 'flexible',
  sortOrder: 0,
  createdAt: CREATED,
  ...extra,
});

/** Sample groups: spending groups in a set order, a hidden category and an income group */
export const GROUPS: CategoryGroup[] = [
  {
    id: 'everyday',
    name: 'Everyday',
    isIncome: 0,
    sortOrder: 0,
    createdAt: CREATED,
    categories: [
      category('groceries', 'Groceries'),
      category('dining', 'Dining out'),
      category('long', 'Weekend markets, bakeries and the corner shop on the way home'),
      category('old-gym', 'Old gym', { hidden: 1 }),
    ],
  },
  {
    id: 'bills',
    name: 'Bills',
    isIncome: 0,
    sortOrder: 1,
    createdAt: CREATED,
    categories: [category('rent', 'Rent'), category('power', 'Power and gas')],
  },
  {
    id: 'income',
    name: 'Income',
    isIncome: 1,
    sortOrder: 2,
    createdAt: CREATED,
    categories: [category('salary', 'Salary', { budgetType: null })],
  },
];

export const TRANSFER_ACCOUNTS = [
  { id: 'savings', name: 'Rainy day savings' },
  { id: 'card', name: 'Credit card' },
];

/**
 * The category picker as its callers open it: floating beside its button (`anchor`, as the
 * payee, Review and budget screens do), or in the button's own relative wrapper (as the
 * transaction row and the category button do). The gallery has no server, so a create fails
 * unless a spec answers the request.
 */
function CategoryPickerSpecimen({ anchored }: { anchored: boolean }) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const testId = `category-picker-readout-${anchored ? 'anchored' : 'inline'}`;
  const picker = open && (
    <CategoryPicker
      value={value}
      groups={GROUPS}
      transferAccounts={TRANSFER_ACCOUNTS}
      anchor={anchored ? opener : null}
      fullWidth={!anchored}
      onClose={() => setOpen(false)}
      onChange={(next) => {
        setValue(next);
        setOpen(false);
      }}
    />
  );
  return (
    <div>
      <div className="relative w-64 max-w-full">
        <Button ref={setOpener} variant="secondary" onClick={() => setOpen(!open)}>
          Category: {value ?? 'none'}
        </Button>
        {!anchored && picker}
      </div>
      {anchored && picker}
      <p data-testid={testId} className="mt-1 text-xs text-text-tertiary">
        Chosen: {value ?? 'none'}
      </p>
    </div>
  );
}

/** The pickers built on the shared searchable list (02-UI-SPEC.md, the CategoryPicker bullet) */
export function PickerCards() {
  return (
    <>
      <GalleryCard title="Searchable list">
        <Specimen control="Searchable list" state="Default">
          <SearchListSpecimen />
        </Specimen>
      </GalleryCard>
      <GalleryCard title="Category picker">
        <Specimen control="Category picker" state="Anchored">
          <CategoryPickerSpecimen anchored />
        </Specimen>
        <Specimen control="Category picker" state="Inline">
          <CategoryPickerSpecimen anchored={false} />
        </Specimen>
      </GalleryCard>
    </>
  );
}
