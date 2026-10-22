import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CategorySelect } from './CategorySelect';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useFormReset } from '../../hooks/useFormReset';
import { useSplitTransaction } from '../../hooks/useTransactionEdits';
import {
  amountPlaceholder,
  amountToInput,
  formatAmount,
  readTypedAmount,
  useAmountStyle,
} from '../../utils/currency';
import {
  WHOLE,
  amountsToPercents,
  leftToSplit,
  percentToInput,
  percentsToAmounts,
  readPercent,
} from '../../utils/splitParts';
import type { CategoryGroup, Transaction } from '../../types';

interface Part {
  categoryId: string | null;
  /** What's typed: an amount (always positive, like the transaction's size) or a percentage */
  value: string;
  notes: string;
}

interface Props {
  transaction: Transaction;
  currency: string | null;
  groups: CategoryGroup[];
  isOpen: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

/**
 * Split a transaction that already exists (synced from the bank or added earlier) into parts
 * with their own categories, change its parts, or put it back together. The transaction keeps
 * its amount, account, date and payee; only how it's categorized changes.
 */
export function SplitTransactionModal({
  transaction: tx,
  currency,
  groups,
  isOpen,
  onClose,
}: Props) {
  const style = useAmountStyle(currency);
  const canSave = useCanSave();
  const split = useSplitTransaction();
  const total = tx.amount;
  const size = Math.abs(total);
  const sign = total < 0 ? -1 : 1;
  const existing = tx.isParent === 1 && tx.children?.length ? tx.children : null;

  const [mode, setMode] = useState<'amount' | 'percent'>('amount');
  const [parts, setParts] = useState<Part[]>([]);
  useFormReset(isOpen ? tx.id : null, () => {
    setMode('amount');
    setParts(
      existing
        ? existing.map((c) => ({
            categoryId: c.categoryId,
            value: amountToInput(Math.abs(c.amount), style),
            notes: c.notes ?? '',
          }))
        : [
            { categoryId: tx.categoryId, value: '', notes: '' },
            { categoryId: null, value: '', notes: '' },
          ],
    );
  });

  // Each part's signed amount, or null when its field is empty or unreadable
  const typed = parts.map((p) => {
    if (!p.value.trim()) return null;
    if (mode === 'amount') {
      const cents = readTypedAmount(p.value, style);
      return cents === null || cents <= 0 ? null : cents;
    }
    return readPercent(p.value);
  });
  const amounts: (number | null)[] =
    mode === 'amount'
      ? typed.map((c) => (c === null ? null : sign * c))
      : typed.every((t) => t !== null)
        ? (percentsToAmounts(total, typed as number[]) ?? typed.map(() => null))
        : typed.map(() => null);
  const unreadable = parts.map((p, i) => !!p.value.trim() && typed[i] === null);
  const filled = (mode === 'amount' ? amounts : typed).filter((a): a is number => a !== null);
  const left =
    mode === 'amount' ? leftToSplit(total, filled) : WHOLE - filled.reduce((a, b) => a + b, 0);
  const complete = parts.length >= 2 && amounts.every((a) => a !== null) && left === 0;

  function update(i: number, change: Partial<Part>) {
    setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...change } : p)));
  }

  /** Give what's left to the first empty part, or the last one */
  function fillRemainder() {
    const target = parts.findIndex((p) => !p.value.trim());
    const i = target === -1 ? parts.length - 1 : target;
    const own = mode === 'amount' ? (amounts[i] ?? 0) : (typed[i] ?? 0);
    const value = mode === 'amount' ? Math.abs(own + left) : (own as number) + left;
    if (value <= 0) return;
    update(i, {
      value: mode === 'amount' ? amountToInput(value, style) : percentToInput(value),
    });
  }

  function switchMode(next: 'amount' | 'percent') {
    if (next === mode) return;
    // Carry complete figures across; otherwise start the other way empty
    if (complete) {
      const signed = amounts as number[];
      const values =
        next === 'percent'
          ? amountsToPercents(total, signed).map(percentToInput)
          : signed.map((a) => amountToInput(Math.abs(a), style));
      setParts((ps) => ps.map((p, i) => ({ ...p, value: values[i] })));
    } else {
      setParts((ps) => ps.map((p) => ({ ...p, value: '' })));
    }
    setMode(next);
  }

  function save(splits: { categoryId: string | null; amount: number; notes?: string | null }[]) {
    split.mutate({ tx, splits }, { onSuccess: onClose });
  }

  const leftLabel =
    mode === 'amount' ? formatAmount(Math.abs(left), style) : `${percentToInput(Math.abs(left))}%`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Split transaction" size="md">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Give parts of this {formatAmount(size, style)} their own categories. The transaction stays
          as it is in its account; budgets and reports use the parts.
        </p>

        <div
          role="group"
          aria-label="Split by"
          className="inline-flex rounded-full border border-border p-0.5"
        >
          {(['amount', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-full max-md:min-h-11 ${mode === m ? 'bg-brand-600 text-white' : 'text-text-secondary hover:text-text'}`}
            >
              {m === 'amount' ? 'By amount' : 'By percent'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {parts.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_7rem_auto] max-md:grid-cols-[1fr_auto] gap-2 items-start"
            >
              <div className="max-md:col-span-2">
                <CategorySelect
                  value={p.categoryId}
                  onChange={(categoryId) => update(i, { categoryId })}
                  groups={groups}
                  label={`Part ${i + 1} category`}
                  fieldClassName={inputCls}
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={p.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  aria-label={`Part ${i + 1} ${mode === 'amount' ? 'amount' : 'percentage'}`}
                  aria-invalid={unreadable[i] || undefined}
                  placeholder={mode === 'amount' ? amountPlaceholder(style) : '50'}
                  className={`${inputCls} text-right tabular-nums ${mode === 'percent' ? 'pr-7' : ''} ${unreadable[i] ? 'border-negative' : ''}`}
                />
                {mode === 'percent' && (
                  <span className="absolute right-3 top-2 text-sm text-text-tertiary">%</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}
                disabled={parts.length <= 2}
                aria-label={`Remove part ${i + 1}`}
                className="p-2 text-text-tertiary hover:text-negative disabled:invisible max-md:min-h-11 max-md:min-w-11 flex items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
              <input
                type="text"
                value={p.notes}
                onChange={(e) => update(i, { notes: e.target.value })}
                placeholder={tx.notes ? `Notes (default: ${tx.notes})` : 'Notes'}
                aria-label={`Part ${i + 1} notes`}
                className={`${inputCls} col-span-2 max-md:col-span-2 text-xs`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setParts((ps) => [...ps, { categoryId: null, value: '', notes: '' }])}
            disabled={parts.length >= 20}
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 max-md:min-h-11"
          >
            <Plus size={14} /> Add a part
          </button>
          {left === 0 ? (
            <span className="text-sm text-positive">Fully split</span>
          ) : (
            <button
              type="button"
              onClick={fillRemainder}
              disabled={(mode === 'amount' ? sign * left : left) < 0}
              className="text-sm tabular-nums text-text-secondary hover:text-text max-md:min-h-11"
              title="Give what's left to the next empty part"
            >
              {(mode === 'amount' ? sign * left : left) < 0 ? 'Over by ' : 'Left to split: '}
              <span className="font-medium">{leftLabel}</span>
            </button>
          )}
        </div>

        {split.error && (
          <p role="alert" className="text-sm text-negative">
            {split.error.message}
          </p>
        )}
        <SavingPausedHint />

        <div className="flex items-center gap-3 pt-2 flex-wrap">
          {existing && (
            <Button
              variant="ghost"
              onClick={() => save([])}
              disabled={!canSave || split.isPending}
              title="Back to one transaction with one category"
            >
              Unsplit
            </Button>
          )}
          <div className="ml-auto flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                save(
                  parts.map((p, i) => ({
                    categoryId: p.categoryId,
                    amount: amounts[i] as number,
                    ...(p.notes.trim() ? { notes: p.notes.trim() } : {}),
                  })),
                )
              }
              disabled={!complete || !canSave || split.isPending}
            >
              {existing ? 'Save parts' : `Split into ${parts.length}`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
