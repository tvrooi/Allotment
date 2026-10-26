import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Button } from '../ui/Button';
import { getBudgetStart, setBudgetStart } from '../../api/budget';

// Settings → Budget: the month the envelope budget starts counting. Bank history imported from
// before you started budgeting stays in the register and reports, but its spending no longer
// shows as overspent or uncategorised envelopes (server: routes/budget.ts /start).

const inputClass =
  'px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:border-brand-600 focus:outline-none';

export function BudgetStartSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['budget-start'], queryFn: getBudgetStart });
  const current = data?.month ?? null;
  const thisMonth = format(new Date(), 'yyyy-MM');
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current ?? thisMonth;
  const save = useMutation({
    mutationFn: setBudgetStart,
    onSuccess: () => {
      setDraft(null);
      for (const key of ['budget-start', 'budget', 'budget-summary', 'review'])
        void qc.invalidateQueries({ queryKey: [key] });
    },
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-text">Budget start</h2>
        <p className="text-xs text-text-tertiary mt-1">
          The first month your envelopes count. Transactions before it stay in your accounts and
          reports, and balances don't change, but they no longer carry into envelopes as
          overspending or uncategorised spending. Use this when your bank history goes back further
          than your budget does.
        </p>
      </div>
      <p className="text-sm text-text">
        {current ? (
          <>
            Envelopes start in <strong>{format(parseISO(`${current}-01`), 'MMMM yyyy')}</strong>.
          </>
        ) : (
          'Envelopes count all history.'
        )}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(value);
        }}
      >
        <label>
          <span className="block text-xs font-medium text-text-secondary mb-1">Start month</span>
          <input
            type="month"
            value={value}
            max={thisMonth}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
          />
        </label>
        <Button type="submit" disabled={!value || value === current || save.isPending}>
          Start budget here
        </Button>
        {current && (
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate(null)}
          >
            Count all history
          </Button>
        )}
      </form>
      {save.error && <p className="text-xs text-negative">{save.error.message}</p>}
    </section>
  );
}
