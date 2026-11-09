import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '../../hooks/useAccounts';
import { useCanSave } from '../../hooks/useConnection';
import { useUpdateSchedule } from '../../hooks/useSchedules';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { FUNDING_VIEWS } from '../../utils/fundingViews';
import { formatScheduleAmount, needsCategory } from './scheduleFormat';
import NeedsCategoryBadge from './NeedsCategoryBadge';
import type { Schedule } from '../../types';

/**
 * Recurring bills the budget can't plan for because they have no category (`?filter=needs-category`).
 * The category is saved on its own: the update sends categoryId and nothing else, so the
 * confirmed amount (amountConfirmedAt) is left alone.
 */
export default function NeedsCategoryList({ allRecurring }: { allRecurring: Schedule[] }) {
  const { data: accounts = [] } = useAccounts();
  const canSave = useCanSave();
  const qc = useQueryClient();
  const updateSchedule = useUpdateSchedule();
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = allRecurring
    .filter((s) => needsCategory(s, accounts))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  function choose(id: string, categoryId: string | null) {
    if (!categoryId || categoryId.startsWith('transfer:')) return;
    updateSchedule.mutate(
      { id, categoryId },
      {
        onSuccess: () => {
          // Envelopes, the payday plan and the Review steps all read the schedule's category
          for (const key of [...FUNDING_VIEWS, 'budget-summary'])
            void qc.invalidateQueries({ queryKey: [key] });
        },
      },
    );
  }

  return (
    <div className="p-6 max-md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Bills without a category. No envelope expects them and your payday plan sets nothing aside
          for them.
        </p>
        <Link
          to="/recurring"
          className="text-sm font-medium text-brand-700 underline max-md:min-h-11 max-md:inline-flex max-md:items-center"
        >
          Show all recurring
        </Link>
      </div>
      <SavingPausedHint className="mb-2" />
      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm italic text-text-tertiary">
          Every bill has a category.
        </p>
      ) : (
        <ul
          aria-label="Recurring bills that need a category"
          className="rounded-lg border border-border-light bg-surface divide-y divide-border-light"
        >
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                  <span className="truncate">{s.name}</span>
                  <NeedsCategoryBadge />
                </p>
                <p className="text-xs text-text-tertiary tabular-nums">
                  {formatScheduleAmount(s.amount, s.amountType, false)}
                  {s.accountId && accountName.get(s.accountId)
                    ? ` · ${accountName.get(s.accountId)}`
                    : ''}
                </p>
              </div>
              {canSave && (
                <div className="w-64 max-md:w-full">
                  <CategorySelectButton
                    value={null}
                    onChange={(categoryId) => choose(s.id, categoryId)}
                    placeholder={`Choose a category for ${s.name}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
