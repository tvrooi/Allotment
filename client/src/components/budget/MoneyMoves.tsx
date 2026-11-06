import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { useCanSave } from '../../hooks/useConnection';
import { centsToInput, formatCurrency, parseCents, isUnreadableAmount } from '../../utils/currency';
import { useMoveRequest } from '../../store/moveRequestStore';
import type { BudgetCategory } from '../../types';
import { Button } from '../ui/Button';
import { GuideLink } from '../guide/GuideLink';
import { Input, Select } from '../ui/Input';

/** Where money goes when it is given back to Ready to assign: not a category, and the server
 * refuses it as a source (`READY_TO_ASSIGN` in server/src/services/budgetMoves.ts) */
const READY_TO_ASSIGN = 'ready-to-assign';
const READY_LABEL = 'Ready to assign';

/** How much a funding target still asks for, before and after the move */
type TargetEffect = { before: number; after: number } | null;
type Preview = {
  revision: string;
  sourceId: string;
  destinationId: string;
  toReady: boolean;
  sourceAfter: number;
  destinationAfter: number;
  sourceTarget: TargetEffect;
  destinationTarget: TargetEffect;
  /** Set when the move takes the flexibility reserve below its minimum (allowed). */
  reserveNotice: { minimum: number; availableAfter: number; belowBy: number } | null;
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
/** A line under the preview for a funding target the move changes; nothing for one it doesn't */
function TargetLine({ name, effect }: { name: string; effect: TargetEffect }) {
  if (!effect) return null;
  return (
    <p>
      {name} target:{' '}
      {effect.after === 0 ? 'fully funded' : `still needs ${formatCurrency(effect.after)}`} (was{' '}
      {effect.before === 0 ? 'fully funded' : `${formatCurrency(effect.before)} short`}).
    </p>
  );
}

export function MoneyMoves({ month, categories }: { month: string; categories: BudgetCategory[] }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSource] = useState('');
  const [destinationId, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const qc = useQueryClient();
  const canSave = useCanSave();
  const panel = useRef<HTMLElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const request = useMoveRequest((s) => s.request);
  const clearRequest = useMoveRequest((s) => s.clear);
  const [handled, setHandled] = useState(0);
  // A row asked for this panel (its Available figure was clicked): open it with that envelope
  // filled in, show it, and put the cursor where the person goes next
  if (request && request.id !== handled) {
    setHandled(request.id);
    setOpen(true);
    setPreview(null);
    setMessage('');
    if (request.mode === 'cover') {
      setSource('');
      setDestination(request.categoryId);
      setAmount(centsToInput(request.amount));
    } else {
      setSource(request.categoryId);
      setDestination('');
      setAmount('');
    }
  }
  useEffect(() => {
    if (!request || request.id !== handled) return;
    panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    if (request.mode === 'from') amountField.current?.focus({ preventScroll: true });
    clearRequest();
  }, [request, handled, clearRequest]);
  // Leaving the page with a request unread (the month changes, or another page opens) drops it
  useEffect(() => clearRequest, [clearRequest]);
  const history = useQuery({
    queryKey: ['budget-moves'],
    queryFn: () => apiFetch<Operation[]>('/budget/moves/history'),
    enabled: open,
  });
  const refresh = () => {
    for (const key of [
      'budget',
      'budget-summary',
      'budget-moves',
      'payday',
      'category-history',
      'review',
      'forecast',
      'goals',
    ])
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
  const nameOf = (id: string) =>
    id === READY_TO_ASSIGN
      ? READY_LABEL
      : (categories.find((c) => c.id === id)?.name ?? 'Removed category');
  const label = 'grid gap-1 text-xs font-medium text-text-secondary';
  return (
    <section
      ref={panel}
      aria-label="Move money"
      data-guide="budget.move"
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
            Choose Ready to assign to give money back.{' '}
            <GuideLink
              page="move-money"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              How moving money works
            </GuideLink>
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
              <option value={READY_TO_ASSIGN}>{READY_LABEL}</option>
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
              ref={amountField}
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
              <p>
                {preview.toReady ? `${READY_LABEL} after move` : 'To available after move'}:{' '}
                {formatCurrency(preview.destinationAfter)}
              </p>
              <TargetLine name={nameOf(preview.sourceId)} effect={preview.sourceTarget} />
              <TargetLine name={nameOf(preview.destinationId)} effect={preview.destinationTarget} />
              {preview.reserveNotice && (
                <p className="text-caution">
                  This leaves your flexibility reserve at{' '}
                  {formatCurrency(preview.reserveNotice.availableAfter)},{' '}
                  {formatCurrency(preview.reserveNotice.belowBy)} below your{' '}
                  {formatCurrency(preview.reserveNotice.minimum)} minimum. You can still move it.
                </p>
              )}
              <div className="pt-1">
                <Button
                  size="sm"
                  disabled={!canSave || mutation.isPending}
                  onClick={() => mutation.mutate('apply')}
                >
                  Apply move
                </Button>{' '}
                <Button size="sm" variant="secondary" onClick={() => setPreview(null)}>
                  Cancel
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
                  {op.month}: {formatCurrency(op.amount)}: {nameOf(op.sourceId)} →{' '}
                  {nameOf(op.destinationId)}{' '}
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
