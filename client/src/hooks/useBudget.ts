import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as budgetApi from '../api/budget';
import { useUndoStore } from '../store/undoStore';

// Switching months keeps showing the previous month until the next one arrives, so the
// page doesn't collapse to an empty budget (and jump) in between
export function useBudget(month: string) {
  return useQuery({
    queryKey: ['budget', month],
    queryFn: () => budgetApi.getBudget(month),
    placeholderData: keepPreviousData,
  });
}

export function useBudgetSummary(month: string) {
  return useQuery({
    queryKey: ['budget-summary', month],
    queryFn: () => budgetApi.getBudgetSummary(month),
    placeholderData: keepPreviousData,
  });
}

export function useMonthNote(month: string) {
  return useQuery({
    queryKey: ['budget-note', month],
    queryFn: () => budgetApi.getMonthNote(month),
  });
}

/** Saves a month's note (BUD-10). A note moves no money, so only the note is refetched */
export function useSetMonthNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, note }: { month: string; note: string }) =>
      budgetApi.setMonthNote(month, note),
    onSuccess: (saved) => qc.setQueryData(['budget-note', saved.month], saved),
  });
}

/** Saves a category's note, shown in every month's budget (the global mutation cache refetches
 * the budget, main.tsx) */
export function useSetCategoryNote() {
  return useMutation({
    mutationFn: ({ categoryId, note }: { categoryId: string; note: string }) =>
      budgetApi.setCategoryNote(categoryId, note),
  });
}

export function useSetBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      month,
      categoryId,
      budgeted,
      revision,
    }: {
      month: string;
      categoryId: string;
      budgeted: number;
      revision?: string;
    }) => budgetApi.setBudget(month, categoryId, budgeted, revision),
    onSuccess: (result, { month, categoryId, budgeted }) => {
      qc.invalidateQueries({ queryKey: ['budget'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['review'] });
      const oldBudgeted = result.previousBudgeted;
      let revision = result.revision;
      useUndoStore.getState().push({
        description: `Set budget`,
        undo: async () => {
          revision = (await budgetApi.setBudget(month, categoryId, oldBudgeted, revision)).revision;
          qc.invalidateQueries({ queryKey: ['budget'] });
          qc.invalidateQueries({ queryKey: ['budget-summary'] });
          qc.invalidateQueries({ queryKey: ['review'] });
        },
        redo: async () => {
          revision = (await budgetApi.setBudget(month, categoryId, budgeted, revision)).revision;
          qc.invalidateQueries({ queryKey: ['budget'] });
          qc.invalidateQueries({ queryKey: ['budget-summary'] });
          qc.invalidateQueries({ queryKey: ['review'] });
        },
      });
    },
  });
}

export function useCategoryHistory(categoryId: string | null, currentMonth?: string) {
  return useQuery({
    queryKey: ['category-history', categoryId, currentMonth],
    queryFn: () => budgetApi.getCategoryHistory(categoryId!, currentMonth),
    enabled: !!categoryId,
  });
}

export function useSetBudgetBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      budgeted,
      fromMonth,
      expected,
    }: {
      categoryId: string;
      budgeted: number;
      fromMonth: string;
      expected: Record<string, number>;
    }) => budgetApi.setBudgetBulk(categoryId, budgeted, fromMonth, expected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['review'] });
    },
  });
}
