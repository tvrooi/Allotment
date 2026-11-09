import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useMonthNote, useSetCategoryNote, useSetMonthNote } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import { useIsPhone } from '../../hooks/useIsPhone';
import type { BudgetCategory } from '../../types';
import { availability, savedSplit, selectionFigures } from '../../utils/budgetFigures';
import { formatCurrency } from '../../utils/currency';
import { targetLabel } from '../../utils/targets';
import { Button } from '../ui/Button';
import { NoteField } from './NoteField';
import { useLinkedAccount } from './TransferredNote';

/**
 * The budget's inspector (BUD-10), beside the table. With nothing ticked it shows the month: the
 * expense totals (the table's Total expenses row, as In envelopes) and the month's note. With one envelope ticked,
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
    ['From last month', f.carriedIn],
    ['Assigned', f.assigned],
    // An envelope linked to an account: what moved it to the account's balance this month
    ...(f.transferred ? ([['Account in and out', f.transferred]] as [string, number][]) : []),
    ['Activity', f.activity],
    ['Available', f.available],
    // Recurring bills not debited yet come out of Available; only shown when there are some
    ...(f.expected > 0
      ? ([['After expected bills', f.available - f.expected]] as [string, number][])
      : []),
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
      {rows.map(([label, cents]) => (
        <div key={label} className="contents">
          <dt className={label === 'Available' ? 'font-semibold text-text' : 'text-text-secondary'}>
            {label}
          </dt>
          <dd
            className={`text-right tabular-nums ${
              label === 'Available'
                ? cents < 0
                  ? 'font-semibold text-negative'
                  : 'font-semibold text-text'
                : label === 'After expected bills' && cents < 0
                  ? 'font-medium text-caution'
                  : 'text-text'
            }`}
          >
            {formatCurrency(cents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The month as one block: In envelopes up front, split into spending and saved so a large Savings
 * envelope doesn't read as money to spend, with the working folded underneath.
 */
function MonthFigures({ cats }: { cats: BudgetCategory[] }) {
  const f = selectionFigures(cats);
  const { spending, saved } = savedSplit(cats);
  const rows: [string, number][] = [
    ['From last month', f.carriedIn],
    ['Assigned', f.assigned],
    ...(f.transferred ? ([['Account in and out', f.transferred]] as [string, number][]) : []),
    ['Activity', f.activity],
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-text">In envelopes</span>
        <span
          className={`text-sm font-medium tabular-nums ${f.available < 0 ? 'text-negative' : 'text-text'}`}
        >
          {formatCurrency(f.available)}
        </span>
      </div>
      {saved !== 0 && (
        <p className="mt-0.5 text-nav text-text-secondary tabular-nums">
          {formatCurrency(spending)} in spending envelopes · {formatCurrency(saved)} saved
        </p>
      )}
      <details className="group mt-2">
        <summary className="flex min-h-11 md:min-h-9 cursor-pointer select-none items-center gap-1 text-nav text-text-secondary hover:text-text">
          <ChevronRight
            size={14}
            aria-hidden
            className="shrink-0 transition-transform group-open:rotate-90"
          />
          What makes up In envelopes
        </summary>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
          {rows.map(([label, cents]) => (
            <div key={label} className="contents">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="text-right tabular-nums text-text">{formatCurrency(cents)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function MonthView({ month, categories }: { month: string; categories: BudgetCategory[] }) {
  const { data, isSuccess } = useMonthNote(month);
  const setNote = useSetMonthNote();
  // Phones list envelopes as cards with nothing to tick
  const isPhone = useIsPhone();
  return (
    <div className="grid gap-3">
      <div>
        {/* The page heading already names the month, so this one is only for the outline */}
        <h2 className="sr-only">This month's envelopes</h2>
        <p className="text-nav text-text-tertiary">
          {isPhone
            ? 'Every envelope this month.'
            : 'Every envelope this month. Choose Select to total just some of them.'}
        </p>
      </div>
      <MonthFigures cats={categories} />
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
  // An envelope linked to an account is funded by a transfer into it, not an assignment
  const short = cats.filter((c) => c.target?.underfunded && !c.linkedAccountId);
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
  const linked = useLinkedAccount(cat);
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold text-text">{cat.name}</h2>
        {caption && <p className="text-nav text-text-tertiary">{caption}</p>}
      </div>
      <Figures cats={[cat]} />
      {cat.target && (
        <p className={`text-nav ${cat.target.underfunded ? 'text-caution' : 'text-text-tertiary'}`}>
          {targetLabel(cat.target, linked?.name)}
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
        <h2 className="text-base font-semibold text-text">{cats.length} envelopes selected</h2>
        <p className="text-nav text-text-tertiary">{cats.map((c) => c.name).join(', ')}</p>
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
