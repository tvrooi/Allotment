import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency, parseCents, isUnreadableAmount } from '../../utils/currency';
import type { BudgetCategory } from '../../types';
import { Button } from '../ui/Button';

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
  return (
    <div className="mb-4 text-sm">
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        Move money / Cover overspending
      </Button>
      {open && (
        <section aria-label="Move money" className="mt-3 grid gap-3">
          <p>Cover an overspent envelope or change priorities. Both assignments change together.</p>
          <label>
            From
            <select
              aria-label="Move from"
              className="block w-full bg-surface border border-border p-2"
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
            </select>
          </label>
          <label>
            To
            <select
              aria-label="Move to"
              className="block w-full bg-surface border border-border p-2"
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
            </select>
          </label>
          <label>
            Amount
            <input
              aria-label="Move amount"
              className="block w-full bg-surface border border-border p-2"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <Button
            disabled={!canSave || mutation.isPending || !sourceId || !destinationId}
            onClick={() => mutation.mutate('preview')}
          >
            Preview move
          </Button>
          {preview && (
            <div role="region" aria-label="Money move preview">
              <p>From available after move: {formatCurrency(preview.sourceAfter)}</p>
              <p>To available after move: {formatCurrency(preview.destinationAfter)}</p>
              <p>{preview.targetNotice}</p>
              <Button
                disabled={!canSave || mutation.isPending}
                onClick={() => mutation.mutate('apply')}
              >
                Apply move
              </Button>
            </div>
          )}
          {message && <p role="status">{message}</p>}
          <details>
            <summary>Money move history</summary>
            {history.data?.map((op) => (
              <div key={op.id} className="my-2">
                {op.month}: {formatCurrency(op.amount)}:{' '}
                {categories.find((c) => c.id === op.sourceId)?.name ?? 'Removed category'} →{' '}
                {categories.find((c) => c.id === op.destinationId)?.name ?? 'Removed category'}{' '}
                {op.undone ? (
                  'Undone'
                ) : (
                  <button
                    disabled={!canSave || mutation.isPending}
                    className="underline"
                    onClick={() => mutation.mutate(`undo:${op.id}`)}
                  >
                    Undo move
                  </button>
                )}
              </div>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}
