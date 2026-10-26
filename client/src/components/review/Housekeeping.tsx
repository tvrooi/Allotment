import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHousekeeping, type Housekeeping as HousekeepingData } from '../../api/review';
import { setBudgetStart } from '../../api/budget';
import { bulkEditTransactions, restoreBulkEdit } from '../../api/transactions';
import { useCategories } from '../../hooks/useCategories';
import { useCanSave } from '../../hooks/useConnection';
import { useUndoStore } from '../../store/undoStore';
import { formatCurrency } from '../../utils/currency';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';

// Review → Tidy up: setup problems that quietly make a budget less useful. Each one is fixed
// here in one step, or links to where it is fixed. Nothing changes until you act.

const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy');

export function Housekeeping() {
  const { data } = useQuery({ queryKey: ['review', 'housekeeping'], queryFn: getHousekeeping });
  if (!data) return null;
  const { budgetStart, missingRoundUps, unlinkedSavers, unusedCategories } = data;
  if (
    !budgetStart.suggestion &&
    !missingRoundUps.length &&
    !unlinkedSavers.length &&
    !unusedCategories
  )
    return null;
  return (
    <Card>
      <section aria-labelledby="tidy-up" className="space-y-4">
        <div>
          <h2 id="tidy-up" className="text-base font-semibold text-text">
            Tidy up
          </h2>
          <p className="text-xs text-text-secondary">
            Setup problems that make the budget harder to trust.
          </p>
        </div>
        {budgetStart.suggestion && <BudgetStartItem data={budgetStart} />}
        {missingRoundUps.map((r) => (
          <div key={r.accountId} className="text-sm">
            <p className="font-medium text-text">{r.accountName} is missing round-ups</p>
            <p className="text-text-secondary">
              Up's balance is {formatCurrency(r.total)} lower than FlyBudget's, exactly the{' '}
              {r.count} round-up {r.count === 1 ? 'debit' : 'debits'} that never imported. Spending
              looks smaller than it is until they're added.
            </p>
            <Link to="/settings?tab=connections" className="text-brand-700 underline text-sm">
              Check round-ups in Up settings
            </Link>
          </div>
        ))}
        {unlinkedSavers.length > 0 && <SaverItem savers={unlinkedSavers} />}
        {unusedCategories > 0 && (
          <div className="text-sm">
            <p className="font-medium text-text">
              {unusedCategories} {unusedCategories === 1 ? 'category was' : 'categories were'} never
              used
            </p>
            <Link to="/settings?tab=categories" className="text-brand-700 underline">
              Hide unused categories
            </Link>
          </div>
        )}
      </section>
    </Card>
  );
}

function BudgetStartItem({ data }: { data: HousekeepingData['budgetStart'] }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const start = useMutation({
    mutationFn: () => setBudgetStart(data.suggestion),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review'] });
      void qc.invalidateQueries({ queryKey: ['budget'] });
      void qc.invalidateQueries({ queryKey: ['budget-summary'] });
    },
  });
  return (
    <div className="text-sm">
      <p className="font-medium text-text">
        Your budget counts every month since {monthLabel(data.historyStartMonth!)}
      </p>
      <p className="text-text-secondary">
        Imported history you never budgeted for shows as overspending. Starting the budget in{' '}
        {monthLabel(data.suggestion!)} keeps that history in accounts and reports, without the old
        deficits. You can change it in Settings → Budget.
      </p>
      <Button
        className="mt-1.5"
        size="sm"
        variant="secondary"
        disabled={!canSave || start.isPending}
        onClick={() => start.mutate()}
      >
        Start budgeting in {monthLabel(data.suggestion!)}
      </Button>
      {start.error && <p className="text-negative text-xs mt-1">{start.error.message}</p>}
    </div>
  );
}

function SaverItem({ savers }: { savers: HousekeepingData['unlinkedSavers'] }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data: groups = [] } = useCategories();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const categorise = useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string }) => {
      const result = await bulkEditTransactions({ params: {}, ids }, { categoryId }, ids.length);
      return { result, ids, categoryId };
    },
    onSuccess: ({ result, ids, categoryId }) => {
      void qc.invalidateQueries();
      useUndoStore.getState().push({
        description: `Categorise ${result.changed} saver transfers`,
        undo: async () => {
          await restoreBulkEdit(result.restore);
          void qc.invalidateQueries();
        },
        redo: async () => {
          await bulkEditTransactions({ params: {}, ids }, { categoryId }, ids.length);
          void qc.invalidateQueries();
        },
      });
    },
  });
  const options = groups.flatMap((g) =>
    g.categories.filter((c) => !c.hidden).map((c) => ({ ...c, group: g.name })),
  );
  return (
    <div className="text-sm">
      <p className="font-medium text-text">Movements to savers that aren't in FlyBudget</p>
      <p className="text-text-secondary">
        Up names these after savers you closed or never connected. Uncategorised, they look like
        spending and income. Give each saver one category (for example a transfers category), or add
        the saver as an account and link them.
      </p>
      <ul aria-label="Savers not in FlyBudget" className="mt-2 space-y-2">
        {savers.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-40">
              {s.name}: {s.count} {s.count === 1 ? 'transaction' : 'transactions'}, net{' '}
              {formatCurrency(s.net)}
            </span>
            <span className="w-52">
              <Select
                aria-label={`Category for ${s.name}`}
                value={choice[s.name] ?? ''}
                onChange={(e) => setChoice((c) => ({ ...c, [s.name]: e.target.value }))}
              >
                <option value="">Choose a category</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.group}: {c.name}
                  </option>
                ))}
              </Select>
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canSave || !choice[s.name] || categorise.isPending}
              onClick={() => categorise.mutate({ ids: s.ids, categoryId: choice[s.name] })}
            >
              Categorise
            </Button>
          </li>
        ))}
      </ul>
      {categorise.error && <p className="text-negative text-xs mt-1">{categorise.error.message}</p>}
    </div>
  );
}
