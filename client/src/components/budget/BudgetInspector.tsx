import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useMonthNote, useSetCategoryNote, useSetMonthNote } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import type { BudgetCategory } from '../../types';
import { availability, selectionFigures } from '../../utils/budgetFigures';
import { formatCurrency } from '../../utils/currency';
import { targetLabel } from '../../utils/targets';
import { Button } from '../ui/Button';
import { NoteField } from './NoteField';

/**
 * The budget's inspector (BUD-10), beside the table. With nothing ticked it shows the month: the
 * expense totals (the table's Total expenses row) and the month's note. With one envelope ticked,
 * that envelope's figures, target and note; with several, only their sums, and actions that
 * name how many they act on. Selecting changes no money.
 */
export function BudgetInspector({
  month,
  categories,
  selectedIds,
  onClear,
  onFundSelected,
}: {
  month: string;
  /** Every expense envelope in the table (payment envelopes aside) */
  categories: BudgetCategory[];
  selectedIds: ReadonlySet<string>;
  onClear: () => void;
  /** Opens Fund targets with only these ticked */
  onFundSelected: (ids: string[]) => void;
}) {
  const selected = categories.filter((c) => selectedIds.has(c.id));
  return (
    <section
      aria-label="Inspector"
      data-testid="budget-inspector"
      className="mb-4 rounded-lg border border-border-light bg-surface-alt p-3"
    >
      {selected.length === 0 ? (
        <MonthView month={month} categories={categories} />
      ) : selected.length === 1 ? (
        <OneView cat={selected[0]} onClear={onClear} onFund={onFundSelected} />
      ) : (
        <ManyView cats={selected} onClear={onClear} onFund={onFundSelected} />
      )}
    </section>
  );
}

function Figures({ cats }: { cats: BudgetCategory[] }) {
  const f = selectionFigures(cats);
  const rows: [string, number][] = [
    ['Carried in', f.carriedIn],
    ['Assigned', f.assigned],
    ...(f.transferred ? ([['Transferred in', f.transferred]] as [string, number][]) : []),
    ['Activity', f.activity],
    ['Available', f.available],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
      {rows.map(([label, cents]) => (
        <div key={label} className="contents">
          <dt className={label === 'Available' ? 'font-semibold text-text' : 'text-text-secondary'}>
            {label}
          </dt>
          <dd
            className={`text-right tabular-nums ${label === 'Available' ? (cents < 0 ? 'font-semibold text-negative' : 'font-semibold text-text') : 'text-text'}`}
          >
            {formatCurrency(cents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MonthView({ month, categories }: { month: string; categories: BudgetCategory[] }) {
  const { data, isSuccess } = useMonthNote(month);
  const setNote = useSetMonthNote();
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold text-text">
          {format(parseISO(`${month}-01`), 'MMMM yyyy')}
        </h2>
        <p className="text-xs text-text-tertiary">
          Every envelope this month. Tick envelopes in the table to see only those.
        </p>
      </div>
      <Figures cats={categories} />
      {isSuccess && (
        <NoteField
          key={month}
          label="Note for this month"
          note={data.note}
          onSave={(note) => setNote.mutateAsync({ month, note })}
        />
      )}
    </div>
  );
}

function FundButton({ cats, onFund }: { cats: BudgetCategory[]; onFund: (ids: string[]) => void }) {
  const canSave = useCanSave();
  const short = cats.filter((c) => c.target?.underfunded);
  if (!short.length) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={!canSave}
      onClick={() => onFund(short.map((c) => c.id))}
    >
      {cats.length === 1
        ? 'Fund target'
        : `Fund ${short.length === 1 ? '1 target' : `${short.length} targets`}`}
    </Button>
  );
}

function OneView({
  cat,
  onClear,
  onFund,
}: {
  cat: BudgetCategory;
  onClear: () => void;
  onFund: (ids: string[]) => void;
}) {
  const setNote = useSetCategoryNote();
  const { caption } = availability(cat, false);
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold text-text">{cat.name}</h2>
        {caption && <p className="text-xs text-text-tertiary">{caption}</p>}
      </div>
      <Figures cats={[cat]} />
      {cat.target && (
        <p className={`text-xs ${cat.target.underfunded ? 'text-caution' : 'text-text-tertiary'}`}>
          {targetLabel(cat.target)}
        </p>
      )}
      <NoteField
        key={cat.id}
        label={`Note for ${cat.name}`}
        note={cat.note ?? ''}
        onSave={(note) => setNote.mutateAsync({ categoryId: cat.id, note })}
      />
      <div className="flex flex-wrap gap-2">
        <FundButton cats={[cat]} onFund={onFund} />
        <Link
          to={`/budget/category/${cat.id}`}
          className="inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          History and transactions
        </Link>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}

function ManyView({
  cats,
  onClear,
  onFund,
}: {
  cats: BudgetCategory[];
  onClear: () => void;
  onFund: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold text-text">{cats.length} envelopes selected</h2>
        <p className="text-xs text-text-tertiary">{cats.map((c) => c.name).join(', ')}</p>
      </div>
      <Figures cats={cats} />
      <div className="flex flex-wrap gap-2">
        <FundButton cats={cats} onFund={onFund} />
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}
