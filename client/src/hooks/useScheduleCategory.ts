import { useCallback } from 'react';
import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { needsCategory, type CategoryNeedSchedule } from '../components/recurring/scheduleFormat';

/** A schedule's category name, and whether it is an expense the budget can't plan for yet. */
export function useScheduleCategory() {
  const { data: groups = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  return useCallback(
    (schedule: CategoryNeedSchedule) => ({
      name: schedule.categoryId
        ? (groups.flatMap((g) => g.categories).find((c) => c.id === schedule.categoryId)?.name ??
          null)
        : null,
      needsCategory: needsCategory(schedule, accounts),
    }),
    [groups, accounts],
  );
}
