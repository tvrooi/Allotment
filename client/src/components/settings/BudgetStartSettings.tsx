import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Button } from '../ui/Button';
import { getBudgetStart, setBudgetStart } from '../../api/budget';

// Settings → Budget: the month the envelope budget starts counting, optionally from a day in it
// (a fresh start mid-month, set when a new budget connects its first bank). Bank history from
// before you started budgeting stays in the register and reports, but its spending no longer
// shows as overspent or uncategorised envelopes (server: routes/budget.ts /start).

const inputClass =
  'px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:border-brand-600 focus:outline-none';

export function BudgetStartSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['budget-start'], queryFn: getBudgetStart });
  const current = data?.month ?? null;
  const day = data?.day ?? null;
  const thisMonth = format(new Date(), 'yyyy-MM');
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current ?? thisMonth;
  const save = useMutation({
    mutationFn: setBudgetStart,
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['budget-start'] });
    },
  });
  const monthName = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy');

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-text">Budget start</h2>
        <p className="text-xs text-text-tertiary mt-1">
          When your envelopes start counting. Transactions before it stay in your accounts and
          reports, and balances don't change, but they no longer carry into envelopes as
          overspending or uncategorised spending. Use this when your bank history goes back further
          than your budget does.
        </p>
      </div>
      <p className="text-sm text-text">
        {current && day ? (
          <>
            Envelopes start on <strong>{format(parseISO(day), 'd MMMM yyyy')}</strong>: spending
            earlier in {format(parseISO(day), 'MMMM')} is history.
          </>
        ) : current ? (
          <>
            Envelopes start in <strong>{monthName(current)}</strong>.
          </>
        ) : (
          'Envelopes count all history.'
        )}
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ month: value });
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
        {current && day && (
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate({ month: current, day: null })}
          >
            Count all of {format(parseISO(`${current}-01`), 'MMMM')}
          </Button>
        )}
        {current && (
          <Button
            type="button"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate({ month: null })}
          >
            Count all history
          </Button>
        )}
      </form>
      {save.error && <p className="text-xs text-negative">{save.error.message}</p>}
    </section>
  );
}
