import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { setHold } from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import type { BudgetSummary } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';

/**
 * Hold part of this month's Ready to assign for the next month (ACT-03). Held money leaves
 * Ready to assign now, so the month can reach $0 while next month's pay is still in the
 * account, and comes back when the month starts. It is only for the current month.
 */
export function HoldMoney({ summary }: { summary: BudgetSummary }) {
  const canSave = useCanSave();
  const held = summary.holdAmount ?? 0;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [tried, setTried] = useState(false);
  const mutation = useMutation({
    mutationFn: (cents: number) => setHold(summary.month, cents),
    onSuccess: () => setOpen(false),
  });
  // The most that can be held: what is ready to assign, and what is already held
  const room = Math.max(0, summary.toBeBudgeted) + held;
  if (!open && !held && room <= 0) return null;
  const refused = mutation.error instanceof Error ? mutation.error.message : null;
  const busy = mutation.isPending;
  // The amount is read when the field is left, which a click on Hold does first
  const problem =
    amount > room
      ? 'That is more than is ready to assign.'
      : tried && amount <= 0
        ? 'Enter an amount to hold.'
        : null;
  return (
    <section aria-label="Hold for next month" className="mt-2 text-center text-xs">
      {!open && (
        <>
          {held > 0 && (
            <p role="status" className="text-text-secondary mb-1">
              {formatCurrency(held)} held for next month.
            </p>
          )}
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={false}
            onClick={() => {
              mutation.reset();
              setTried(false);
              setAmount(held || Math.max(0, summary.toBeBudgeted));
              setOpen(true);
            }}
          >
            {held > 0 ? 'Change hold' : 'Hold money…'}
          </Button>
        </>
      )}
      {open && (
        <form className="grid gap-2 text-left" onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-1 font-medium text-text-secondary">
            <span aria-hidden>Amount to hold for next month</span>
            <CurrencyInput aria-label="Amount to hold" value={amount} onChange={setAmount} />
          </div>
          <p className="text-text-tertiary">
            Up to {formatCurrency(room)}. It leaves Ready to assign now and comes back when next
            month starts.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!canSave || busy}
              onClick={() => {
                setTried(true);
                if (amount > 0 && amount <= room) mutation.mutate(amount);
              }}
            >
              {busy ? 'Saving…' : 'Hold'}
            </Button>
            {held > 0 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canSave || busy}
                onClick={() => mutation.mutate(0)}
              >
                Release hold
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {/* Below the buttons: a message that appears or goes when the amount is read must not
              move them out from under a click */}
          {problem && (
            <p role="alert" className="text-negative">
              {problem}
            </p>
          )}
          {refused && (
            <p role="alert" className="text-negative">
              Not saved. {refused}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
