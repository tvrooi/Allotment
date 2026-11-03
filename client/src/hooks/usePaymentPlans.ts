import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as api from '../api/paymentPlans';
import { useUndoStore } from '../store/undoStore';

// Buy now, pay later plans. A plan's purchase and payments are transactions, so every change
// refreshes transactions, accounts and the budget too; matches live under ['transactions'] so
// a bank sync or edit refreshes them.

const refresh = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ['payment-plans'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['accounts'] });
  qc.invalidateQueries({ queryKey: ['budget'] });
};

export function usePaymentPlans() {
  return useQuery({ queryKey: ['payment-plans'], queryFn: api.getPlans });
}

export function usePaymentMatches() {
  return useQuery({
    queryKey: ['transactions', 'payment-plan-matches'],
    queryFn: api.getPaymentMatches,
    // Bank rows also arrive from server-side syncs: look again whenever a page shows them
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function usePlanHistory(provider: api.PlanProvider, months: number, enabled: boolean) {
  return useQuery({
    queryKey: ['transactions', 'payment-plan-history', provider, months],
    queryFn: () => api.getHistory(provider, months),
    enabled,
  });
}

export function usePlanForTransaction(id: string | null | undefined) {
  return useQuery({
    queryKey: ['payment-plans', 'for-transaction', id],
    queryFn: () => api.getPlanForTransaction(id!),
    enabled: !!id,
  });
}

export function useCreatePlanAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, name }: { provider: api.PlanProvider; name?: string }) =>
      api.createPlanAccount(provider, name),
    onSuccess: () => {
      refresh(qc);
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

/** Records a purchase; undo removes the plan and puts any linked payments back */
export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPlan,
    onSuccess: (plan, input) => {
      refresh(qc);
      let id = plan.id;
      useUndoStore.getState().push({
        description: `Record ${plan.merchant}`,
        undo: async () => {
          await api.deletePlan(id);
          refresh(qc);
        },
        redo: async () => {
          id = (await api.createPlan(input)).id;
          refresh(qc);
        },
      });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...change }: { id: string } & Parameters<typeof api.updatePlan>[1]) =>
      api.updatePlan(id, change),
    onSuccess: () => refresh(qc),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deletePlan, onSuccess: () => refresh(qc) });
}

/** "Confirm": the bank payment pays the instalments; undo unlinks it again */
export function useLinkPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      transactionId,
      instalmentIds,
    }: {
      planId: string;
      transactionId: string;
      instalmentIds?: string[];
    }) => api.linkPayment(planId, transactionId, instalmentIds),
    onSuccess: (plan, vars) => {
      refresh(qc);
      // Unlinking any instalment the payment paid unlinks all of them
      const instalment = plan.instalments.find(
        (i) => i.transactionId && vars.instalmentIds?.includes(i.id),
      );
      if (!instalment) return;
      useUndoStore.getState().push({
        description: `Payment for ${plan.merchant}`,
        undo: async () => {
          await api.unlinkPayment(plan.id, instalment.id);
          refresh(qc);
        },
        redo: async () => {
          await api.linkPayment(vars.planId, vars.transactionId, vars.instalmentIds);
          refresh(qc);
        },
      });
    },
  });
}

export function useUnlinkPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, instalmentId }: { planId: string; instalmentId: string }) =>
      api.unlinkPayment(planId, instalmentId),
    onSuccess: () => refresh(qc),
  });
}

export function useDismissPaymentMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instalmentId,
      transactionId,
    }: {
      instalmentId: string;
      transactionId: string;
    }) => api.dismissMatch(instalmentId, transactionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', 'payment-plan-matches'] }),
  });
}

export function usePlanAdjustment(kind: 'refund' | 'fee') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      ...input
    }: {
      planId: string;
      date: string;
      amount: number;
      categoryId?: string | null;
    }) => (kind === 'refund' ? api.recordRefund(planId, input) : api.recordFee(planId, input)),
    onSuccess: () => refresh(qc),
  });
}
