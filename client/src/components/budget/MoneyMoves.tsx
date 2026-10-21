import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency, parseCents, isUnreadableAmount } from '../../utils/currency';
import type { BudgetCategory } from '../../types';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

type Preview = {
  revision: string;
  sourceAfter: number;
  destinationAfter: number;
  targetNotice: string;
};
type Operation = {
  month: string;
  createdAt: string;
  id: string;
  sourceId: string;
  destinationId: string;
  amount: number;
  undone: number;
};
export function MoneyMoves({ month, categories }: { month: string; categories: BudgetCategory[] }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSource] = useState('');
  const [destinationId, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const qc = useQueryClient();
  const canSave = useCanSave();
  const history = useQuery({
    queryKey: ['budget-moves'],
    queryFn: () => apiFetch<Operation[]>('/budget/moves/history'),
    enabled: open,
  });
  const refresh = () => {
    for (const key of ['budget', 'budget-summary', 'budget-moves', 'payday', 'category-history'])
      qc.invalidateQueries({ queryKey: [key] });
  };
  const mutation = useMutation({
    mutationFn: async (action: 'preview' | 'apply' | string) => {
      if (action.startsWith('undo:')) {
        await apiFetch(`/budget/moves/${action.slice(5)}/undo`, { method: 'POST' });
        setMessage('Money move undone.');
        setPreview(null);
        refresh();
        return;
      }
      if (isUnreadableAmount(amount) || parseCents(amount) <= 0)
        throw new Error('Enter a positive amount.');
      const result = await apiFetch<Preview>(
        `/budget/${month}/moves${action === 'preview' ? '/preview' : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceId,
            destinationId,
            amount: parseCents(amount),
            revision: preview?.revision,
          }),
        },
      );
      if (action === 'preview') {
        setPreview(result);
        setMessage('');
      } else {
        setPreview(null);
        setMessage('Money moved.');
        refresh();
      }
    },
    onError: (e: Error) => {
      setPreview(null);
      setMessage(e.message);
    },
  });
  const label = 'grid gap-1 text-xs font-medium text-text-secondary';
  return (
    <section
      aria-label="Move money"
      className="mb-4 bg-surface rounded-lg shadow-card border border-border-light p-4 text-sm space-y-3"
    >
      <h2 className="font-semibold text-text">Move money</h2>
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Move money / Cover overspending
      </Button>
      {open && (
        <div className="grid gap-3">
          <p className="text-xs text-text-secondary">
            Cover an overspent envelope or change priorities. Both assignments change together.
          </p>
          <label className={label}>
            From
            <Select
              aria-label="Move from"
              value={sourceId}
              onChange={(e) => {
                setSource(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Choose category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatCurrency(c.balance)} available)
                </option>
              ))}
            </Select>
          </label>
          <label className={label}>
            To
            <Select
              aria-label="Move to"
              value={destinationId}
              onChange={(e) => {
                setDestination(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Choose category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatCurrency(c.balance)} available)
                </option>
              ))}
            </Select>
          </label>
          <label className={label}>
            Amount
            <Input
              aria-label="Move amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <Button
            size="sm"
            disabled={!canSave || mutation.isPending || !sourceId || !destinationId}
            onClick={() => mutation.mutate('preview')}
          >
            Preview move
          </Button>
          {preview && (
            <div
              role="region"
              aria-label="Money move preview"
              className="bg-surface-alt rounded-lg p-3 space-y-1 text-xs text-text-secondary"
            >
              <p>From available after move: {formatCurrency(preview.sourceAfter)}</p>
              <p>To available after move: {formatCurrency(preview.destinationAfter)}</p>
              <p>{preview.targetNotice}</p>
              <div className="pt-1">
                <Button
                  size="sm"
                  disabled={!canSave || mutation.isPending}
                  onClick={() => mutation.mutate('apply')}
                >
                  Apply move
                </Button>
              </div>
            </div>
          )}
          {message && (
            <p role="status" className="text-xs text-text-secondary">
              {message}
            </p>
          )}
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
              Money move history
            </summary>
            <ul className="mt-2 space-y-1.5">
              {history.data?.map((op) => (
                <li key={op.id}>
                  {op.month}: {formatCurrency(op.amount)}:{' '}
                  {categories.find((c) => c.id === op.sourceId)?.name ?? 'Removed category'} →{' '}
                  {categories.find((c) => c.id === op.destinationId)?.name ?? 'Removed category'}{' '}
                  {op.undone ? (
                    <span className="text-text-tertiary">Undone</span>
                  ) : (
                    <button
                      disabled={!canSave || mutation.isPending}
                      className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                      onClick={() => mutation.mutate(`undo:${op.id}`)}
                    >
                      Undo move
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
