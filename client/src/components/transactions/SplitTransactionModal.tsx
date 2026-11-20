import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CategorySelectButton } from './CategorySelectButton';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input } from '../ui/Input';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useFormReset } from '../../hooks/useFormReset';
import { useSplitTransaction } from '../../hooks/useTransactionEdits';
import { formatAmount, useAmountStyle } from '../../utils/currency';
import { newClientId } from '../../utils/offline';
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
  /** Stays with the part when another is removed, so each row keeps its own amount field */
  key: string;
  categoryId: string | null;
  /** By amount: the part's size in minor units (positive, like the transaction's size); 0 = none */
  amount: number;
  /** By percent: what's typed */
  percent: string;
  notes: string;
}

const newPart = (categoryId: string | null = null, amount = 0, notes = ''): Part => ({
  key: newClientId(),
  categoryId,
  amount,
  percent: '',
  notes,
});

interface Props {
  transaction: Transaction;
  currency: string | null;
  groups: CategoryGroup[];
  isOpen: boolean;
  onClose: () => void;
}

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
  // Amount text that isn't an amount: the field keeps it, marked, and the split can't be saved
  const { allValid: amountsReadable, report } = useAmountValidity();
  useFormReset(isOpen ? tx.id : null, () => {
    setMode('amount');
    setParts(
      existing
        ? existing.map((c) => newPart(c.categoryId, Math.abs(c.amount), c.notes ?? ''))
        : [newPart(tx.categoryId), newPart()],
    );
  });

  // Each part's size (minor units) or percentage, or null when its field is empty or unreadable
  const typed = parts.map((p) => {
    if (mode === 'amount') return p.amount > 0 ? p.amount : null;
    return p.percent.trim() ? readPercent(p.percent) : null;
  });
  const amounts: (number | null)[] =
    mode === 'amount'
      ? typed.map((c) => (c === null ? null : sign * c))
      : typed.every((t) => t !== null)
        ? (percentsToAmounts(total, typed as number[]) ?? typed.map(() => null))
        : typed.map(() => null);
  // A typed percentage that isn't one (an amount field marks its own)
  const unreadable = parts.map(
    (p, i) => mode === 'percent' && !!p.percent.trim() && typed[i] === null,
  );
  const filled = (mode === 'amount' ? amounts : typed).filter((a): a is number => a !== null);
  const left =
    mode === 'amount' ? leftToSplit(total, filled) : WHOLE - filled.reduce((a, b) => a + b, 0);
  // A percentage of a tiny amount can round a part to nothing; every part needs some money
  const tooSmall = mode === 'percent' && amounts.some((a) => a === 0);
  const complete =
    parts.length >= 2 &&
    amounts.every((a) => a !== null && a !== 0) &&
    left === 0 &&
    (mode === 'percent' || amountsReadable);

  function update(key: string, change: Partial<Part>) {
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  /** Give what's left to the first empty part, or the last one */
  function fillRemainder() {
    const target = parts.findIndex((p) => (mode === 'amount' ? p.amount === 0 : !p.percent.trim()));
    const i = target === -1 ? parts.length - 1 : target;
    const own = mode === 'amount' ? (amounts[i] ?? 0) : (typed[i] ?? 0);
    const value = mode === 'amount' ? Math.abs(own + left) : (own as number) + left;
    if (value <= 0) return;
    update(
      parts[i].key,
      mode === 'amount' ? { amount: value } : { percent: percentToInput(value) },
    );
  }

  function switchMode(next: 'amount' | 'percent') {
    if (next === mode) return;
    // Carry complete figures across; otherwise start the other way empty
    if (complete) {
      const signed = amounts as number[];
      if (next === 'percent') {
        const percents = amountsToPercents(total, signed).map(percentToInput);
        setParts((ps) => ps.map((p, i) => ({ ...p, amount: 0, percent: percents[i] })));
      } else {
        setParts((ps) => ps.map((p, i) => ({ ...p, amount: Math.abs(signed[i]), percent: '' })));
      }
    } else {
      setParts((ps) => ps.map((p) => ({ ...p, amount: 0, percent: '' })));
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
      <AmountFields report={report}>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Give parts of this {formatAmount(size, style)} their own categories. The transaction
            stays as it is in its account; budgets and reports use the parts.
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
                className={`px-3 py-1 text-xs font-medium rounded-full max-md:min-h-11 ${mode === m ? 'bg-brand-600 text-brand-contrast' : 'text-text-secondary hover:text-text'}`}
              >
                {m === 'amount' ? 'By amount' : 'By percent'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {parts.map((p, i) => (
              <div
                key={p.key}
                className="grid grid-cols-[1fr_7rem_auto] max-md:grid-cols-[1fr_auto] gap-2 items-start"
              >
                <div className="max-md:col-span-2">
                  {/* As the list it replaces: every category, hidden ones too, and no new ones here */}
                  <CategorySelectButton
                    value={p.categoryId}
                    onChange={(categoryId) => update(p.key, { categoryId })}
                    groups={groups}
                    label={`Part ${i + 1} category`}
                    allowNone
                    allowCreate={false}
                    includeHidden
                  />
                </div>
                <div className="relative">
                  {mode === 'amount' ? (
                    <CurrencyInput
                      value={p.amount}
                      onChange={(amount) => update(p.key, { amount })}
                      // Left to split follows the typing; unreadable text counts as no amount
                      onTextChange={(cents) => update(p.key, { amount: cents ?? 0 })}
                      aria-label={`Part ${i + 1} amount`}
                      currency={currency}
                      className="text-right tabular-nums"
                    />
                  ) : (
                    <>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={p.percent}
                        onChange={(e) => update(p.key, { percent: e.target.value })}
                        aria-label={`Part ${i + 1} percentage`}
                        isInvalid={unreadable[i]}
                        placeholder="50"
                        className="w-full text-right tabular-nums pr-7"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary"
                      >
                        %
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setParts((ps) => ps.filter((part) => part.key !== p.key))}
                  disabled={parts.length <= 2}
                  aria-label={`Remove part ${i + 1}`}
                  className="p-2 text-text-tertiary hover:text-negative disabled:invisible max-md:min-h-11 max-md:min-w-11 flex items-center justify-center"
                >
                  <Trash2 size={15} />
                </button>
                <Input
                  type="text"
                  value={p.notes}
                  onChange={(e) => update(p.key, { notes: e.target.value })}
                  placeholder={tx.notes ? `Notes (default: ${tx.notes})` : 'Notes'}
                  aria-label={`Part ${i + 1} notes`}
                  fieldSize="sm"
                  className="col-span-2 w-full"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setParts((ps) => [...ps, newPart()])}
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

          {tooSmall && (
            <p className="text-sm text-caution">
              One part would be less than a cent. Use fewer parts or split by amount.
            </p>
          )}
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
      </AmountFields>
    </Modal>
  );
}
