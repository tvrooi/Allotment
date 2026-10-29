import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { CategoryPicker } from '../transactions/CategoryPicker';
import type { CategoryGroup } from '../../types';
import { Button } from '../ui/Button';
import { Private } from '../ui/Private';
import { useCategories } from '../../hooks/useCategories';
import { useCategorisePayee, type PayeeTarget } from '../../hooks/useCategorisePayee';
import { useSalaryGuess, useUncategorisedPayees } from '../../hooks/useReports';
import { useCanSave } from '../../hooks/useConnection';
import { useTransferSuggestions } from '../../hooks/useTransfers';
import { useUndoStore } from '../../store/undoStore';
import { formatCurrency } from '../../utils/currency';
import { transactionsLink } from '../../utils/transactionFilters';
import type { SalaryGuess } from '../../api/reports';

const SHOWN = 25;
const TRANSFER_NOTE = 'Up internal transfer';

/** "every 14 days", "every week", "every month" */
export const salaryCadence = (s: Pick<SalaryGuess, 'schedule' | 'intervalDays'>) =>
  s.schedule === 'monthly'
    ? 'every month'
    : s.schedule === 'weekly'
      ? 'every 7 days'
      : `every ${s.intervalDays} days`;

/**
 * "Looks like pay from X every 14 days": one tap puts that payee's deposits in the income
 * category and makes it the payee's default. Nothing happens until the owner taps.
 */
export function SalaryOffer({ salary, future = true }: { salary: SalaryGuess; future?: boolean }) {
  const canSave = useCanSave();
  const sort = useCategorisePayee();
  const undo = useUndoStore((s) => s.undo);
  const top = useUndoStore((s) => s.undoStack.at(-1)?.description);
  const [done, setDone] = useState(false);
  if (!salary.categoryId || (!salary.uncategorisedCount && !done)) return null;
  return (
    <div
      role="group"
      aria-label="Pay detected"
      className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm space-y-2"
    >
      {done ? (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <Check size={14} aria-hidden /> {salary.payeeName} is now {salary.categoryName}.
          </span>
          {/* Only while it is the latest change: Undo steps back one change at a time */}
          {top === `Sort ${salary.payeeName} as ${salary.categoryName}` && (
            <button
              type="button"
              className="font-medium text-brand-600 underline"
              onClick={() => {
                setDone(false);
                void undo();
              }}
            >
              Undo
            </button>
          )}
        </p>
      ) : (
        <>
          <p className="text-text">
            Looks like pay from <strong>{salary.payeeName}</strong> {salaryCadence(salary)}. Mark it
            as income?
          </p>
          <p className="text-xs text-text-secondary">
            Latest <Private>{formatCurrency(salary.latestAmount)}</Private> on {salary.latestDate}.
            Its {salary.uncategorisedCount} uncategorised deposit
            {salary.uncategorisedCount === 1 ? '' : 's'} go to {salary.categoryName}
            {future ? ', and new ones will too' : ''}.
          </p>
          <Button
            size="sm"
            disabled={!canSave || sort.isPending}
            onClick={() =>
              sort.mutate(
                {
                  payee: { payeeId: salary.payeeId, payeeName: salary.payeeName },
                  categoryId: salary.categoryId!,
                  categoryName: salary.categoryName!,
                  future,
                },
                { onSuccess: () => setDone(true) },
              )
            }
          >
            Mark as income
          </Button>
        </>
      )}
      {sort.error && (
        <p role="alert" className="text-negative">
          {sort.error.message}
        </p>
      )}
    </div>
  );
}

/**
 * "Choose a category…" for one payee: a searchable list, so the keyboard works (type to narrow,
 * arrows to move, Enter to pick, Escape to close). A native select would commit on an arrow key.
 */
function PayeeCategoryButton({
  payeeName,
  groups,
  disabled,
  onPick,
}: {
  payeeName: string;
  groups: CategoryGroup[];
  disabled: boolean;
  onPick: (categoryId: string) => void;
}) {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={setButton}
        type="button"
        disabled={disabled}
        aria-label={`Category for ${payeeName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-48 max-w-full min-h-11 md:min-h-0 border border-border rounded-md px-2 py-1.5 bg-surface text-text-secondary text-sm text-left flex items-center justify-between gap-1 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
      >
        <span className="truncate">Choose a category…</span>
        <ChevronDown size={14} className="shrink-0 text-text-tertiary" aria-hidden />
      </button>
      {open && (
        <CategoryPicker
          anchor={button}
          groups={groups}
          allowNone={false}
          onClose={() => {
            setOpen(false);
            button?.focus();
          }}
          onChange={(id) => {
            setOpen(false);
            if (id) onPick(id);
          }}
        />
      )}
    </>
  );
}

/**
 * What is still uncategorised, a payee at a time (the biggest groups first): one category pick
 * sorts all of a payee's transactions and, by default, the ones that arrive later. Every pick
 * can be undone.
 */
export function SortUncategorised({ onDone }: { onDone?: () => void }) {
  const canSave = useCanSave();
  const { data: groups = [] } = useCategories();
  const salary = useSalaryGuess();
  const list = useUncategorisedPayees();
  const sort = useCategorisePayee();
  // The same count as the Transactions banner: suggested pairs, not their two rows each
  const pairs = useTransferSuggestions().data?.length ?? 0;
  const undo = useUndoStore((s) => s.undo);
  const top = useUndoStore((s) => s.undoStack.at(-1)?.description);
  const [future, setFuture] = useState(true);
  const [showAll, setShowAll] = useState(false);
  // Newest pick first: only the latest can be undone from here (it is the top of the undo stack)
  const [sorted, setSorted] = useState<{ key: string; name: string; category: string }[]>([]);
  const [error, setError] = useState('');

  const payees = useMemo(() => {
    const all = list.data?.payees ?? [];
    // Up's own transfers between accounts are linked in the register, never given a category
    const isTransfer = (p: (typeof all)[number]) =>
      p.sampleNotes.some((n) => n.includes(TRANSFER_NOTE));
    return { sortable: all.filter((p) => !isTransfer(p)) };
  }, [list.data]);
  const salaryPayeeId =
    salary.data?.categoryId && salary.data.uncategorisedCount ? salary.data.payeeId : null;
  const rows = payees.sortable.filter((p) => !salaryPayeeId || p.payeeId !== salaryPayeeId);
  const visible = showAll ? rows : rows.slice(0, SHOWN);
  const key = (p: PayeeTarget) => p.payeeId ?? `name:${p.payeeName}`;

  function pick(p: (typeof rows)[number], categoryId: string) {
    if (!categoryId) return;
    const category = groups.flatMap((g) => g.categories).find((c) => c.id === categoryId);
    if (!category) return;
    setError('');
    sort.mutate(
      { payee: p, categoryId, categoryName: category.name, future },
      {
        onSuccess: () =>
          setSorted((prev) => [
            { key: key(p), name: p.payeeName, category: category.name },
            ...prev,
          ]),
        onError: (e) => setError(e.message),
      },
    );
  }

  const incomeFirst = (p: (typeof rows)[number]) => p.moneyIn > 0 && p.moneyOut === 0;
  const optionGroups = (p: (typeof rows)[number]) =>
    [...groups]
      .filter((g) => g.categories.some((c) => !c.hidden))
      .sort((a, b) => (incomeFirst(p) ? b.isIncome - a.isIncome : a.isIncome - b.isIncome));

  if (list.isPending) return <p role="status">Looking for what is left to sort…</p>;
  return (
    <section aria-label="Sort your first import" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text">Sort your first import</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          {rows.length || salaryPayeeId
            ? 'Pick a category for each payee. It sorts all of their transactions at once.'
            : 'Everything has a category. You can change any of them later.'}
        </p>
      </div>
      {salary.data && <SalaryOffer salary={salary.data} future={future} />}
      {rows.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-sm text-text min-h-11 md:min-h-0">
            <input type="checkbox" checked={future} onChange={(e) => setFuture(e.target.checked)} />
            Also apply to future transactions
          </label>
          <ul className="divide-y divide-border-light border border-border rounded-lg max-h-72 overflow-y-auto">
            {visible.map((p) => (
              <li
                key={key(p)}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-medium text-text truncate">{p.payeeName || 'No payee'}</p>
                  <p className="text-xs text-text-secondary">
                    {p.count} transaction{p.count === 1 ? '' : 's'} ·{' '}
                    <Private>
                      {p.moneyOut < 0 && `${formatCurrency(-p.moneyOut)} out`}
                      {p.moneyOut < 0 && p.moneyIn > 0 && ', '}
                      {p.moneyIn > 0 && `${formatCurrency(p.moneyIn)} in`}
                    </Private>
                  </p>
                </div>
                <PayeeCategoryButton
                  payeeName={p.payeeName}
                  groups={optionGroups(p)}
                  disabled={!canSave || sort.isPending}
                  onPick={(categoryId) => pick(p, categoryId)}
                />
              </li>
            ))}
          </ul>
          {rows.length > SHOWN && !showAll && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
              Show all {rows.length} payees
            </Button>
          )}
        </>
      )}
      {sorted.length > 0 && (
        <p role="status" className="text-xs text-text-secondary flex flex-wrap gap-x-3">
          <span>
            Sorted {sorted.length} payee{sorted.length === 1 ? '' : 's'}. Latest: {sorted[0].name}{' '}
            as {sorted[0].category}.
          </span>
          {top === `Sort ${sorted[0].name} as ${sorted[0].category}` && (
            <button
              type="button"
              className="font-medium text-brand-600 underline"
              onClick={() => {
                void undo();
                setSorted((prev) => prev.slice(1));
              }}
            >
              Undo
            </button>
          )}
        </p>
      )}
      {pairs > 0 && (
        <p className="text-xs text-text-secondary">
          {pairs} possible transfer{pairs === 1 ? '' : 's'} between your accounts{' '}
          {pairs === 1 ? 'is' : 'are'} left for you to review as{' '}
          <Link to="/transactions" className="underline">
            transfers
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {onDone && (
          <Button variant={rows.length ? 'secondary' : 'primary'} onClick={onDone}>
            {rows.length ? 'Skip for now' : 'Done'}
          </Button>
        )}
        {rows.length > 0 && (
          <Link
            to={transactionsLink({ uncategorized: true, datePreset: 'all' })}
            onClick={onDone}
            className="text-sm text-brand-600 underline"
          >
            See them in Transactions
          </Link>
        )}
      </div>
    </section>
  );
}
