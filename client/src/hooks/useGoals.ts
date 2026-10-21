import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as goalsApi from '../api/goals';
import { useUndoStore } from '../store/undoStore';
import type { Goal } from '../types';

// Restore the tracking value before explicitly relinking; it is never funded progress.
async function recreateGoal(snapshot: Goal) {
  const created = await goalsApi.createGoal({
    name: snapshot.name,
    targetAmount: snapshot.targetAmount,
    currentAmount: snapshot.currentAmount,
    targetDate: snapshot.targetDate,
    accountId: snapshot.accountId,
    icon: snapshot.icon,
    color: snapshot.color,
  });
  try {
    if (snapshot.categoryId)
      await goalsApi.updateGoal(created.id, { categoryId: snapshot.categoryId });
  } catch (error) {
    await goalsApi.deleteGoal(created.id);
    throw error;
  }
  return created;
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: goalsApi.getGoals,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.createGoal,
    onSuccess: (created) => {
      let activeId = created.id;
      qc.invalidateQueries({ queryKey: ['goals'] });
      useUndoStore.getState().push({
        description: `Create goal "${created.name}"`,
        undo: async () => {
          await goalsApi.deleteGoal(activeId);
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
        redo: async () => {
          activeId = (await recreateGoal(created)).id;
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
      });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof goalsApi.updateGoal>[1] }) =>
      goalsApi.updateGoal(id, data),
    onMutate: async ({ id }) => {
      const goals = qc.getQueryData<Goal[]>(['goals']);
      return { old: goals?.find((g) => g.id === id) };
    },
    onSuccess: (_, { id, data }, ctx) => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      if (!ctx?.old) return;
      const snapshot = ctx.old;
      useUndoStore.getState().push({
        description: `Edit goal`,
        undo: async () => {
          await goalsApi.updateGoal(id, {
            name: snapshot.name,
            targetAmount: snapshot.targetAmount,
            currentAmount: snapshot.categoryId ? undefined : snapshot.currentAmount,
            categoryId: snapshot.categoryId,
            targetDate: snapshot.targetDate,
            accountId: snapshot.accountId,
            icon: snapshot.icon,
            color: snapshot.color,
          });
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
        redo: async () => {
          await goalsApi.updateGoal(id, data);
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
      });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const goals = qc.getQueryData<Goal[]>(['goals']);
      const snapshot = goals?.find((g) => g.id === id);
      return goalsApi.deleteGoal(id).then(() => snapshot);
    },
    onSuccess: (snapshot) => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      if (!snapshot) return;
      let restoredId: string | undefined;
      useUndoStore.getState().push({
        description: `Delete goal "${snapshot.name}"`,
        undo: async () => {
          restoredId = (await recreateGoal(snapshot)).id;
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
        redo: async () => {
          if (restoredId) await goalsApi.deleteGoal(restoredId);
          qc.invalidateQueries({ queryKey: ['goals'] });
        },
      });
    },
  });
}
