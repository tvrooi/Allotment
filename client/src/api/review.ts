import { apiFetch } from './client';

// Read-only views over the shared funding figures (phases 6F–6G). Nothing here writes.
interface GroupedItem {
  categoryId: string;
  name: string;
  groupId: string;
  groupName: string;
  amount: number;
}
export interface BudgetReview {
  asOf: string;
  month: string;
  revision: string;
  complete: boolean;
  resolved: boolean;
  unassigned: number;
  totals: {
    uncategorised: number;
    deficits: number;
    targetShortfalls: number;
    futureCommitments: number;
    cardShortfall: number;
    uncoveredCardPayments: number;
  };
  uncategorised: {
    id: string;
    date: string;
    payee: string | null;
    amount: number;
    accountId: string;
    accountName: string | null;
  }[];
  uncategorisedCount: number;
  deficits: GroupedItem[];
  targetShortfalls: (GroupedItem & { dueDate: string | null })[];
  commitments: { month: string; amount: number; categories: GroupedItem[] }[];
  cards: {
    accountId: string;
    categoryId: string;
    name: string;
    shortfall: number;
    uncoveredPayments: number;
  }[];
  groups: { id: string; name: string }[];
}
export interface BufferState {
  asOf: string;
  month: string;
  nextMonth: string;
  complete: boolean;
  nextAssigned: number;
  laterAssigned: number;
  nextNeeds: {
    categoryId: string;
    name: string;
    required: number;
    assigned: number;
    underfunded: number;
  }[];
  nextUnderfunded: number;
  unresolved: {
    overspent: number;
    uncategorised: number;
    cardShortfall: number;
    uncoveredCardPayments: number;
    overAssigned: number;
  };
  runway: {
    resources: number | null;
    restricted: number;
    restrictedRows: {
      categoryId: string;
      name: string;
      kind: 'card' | 'true-expense';
      amount: number;
    }[];
    cardDebtWithoutReserve: number;
    unrestricted: number | null;
    spending: { from: string; to: string; total: number; days: number };
    monthlySpending: number;
    days: number | null;
    incomplete: string[];
    assumptions: string[];
  };
}
export type GuideStepId =
  'balances' | 'before-income' | 'assign' | 'irregular' | 'before-spending' | 'priorities';
export interface GuideState {
  asOf: string;
  month: string;
  unassigned: number;
  complete: boolean;
  steps: { id: GuideStepId; status: 'done' | 'todo' | 'attention' | 'info'; summary: string }[];
  balances: {
    accountId: string;
    name: string;
    currency: string | null;
    balance: number;
    unreconciled: number;
  }[];
  nextIncome: string | null;
  needsUntil: string;
  needs: {
    categoryId: string;
    name: string;
    due: number;
    available: number;
    uncovered: number;
    bills: { id: string; name: string; date: string; amount: number; estimated: boolean }[];
  }[];
  billsComplete: boolean;
  irregular: { categoryId: string; name: string; hasTarget: boolean }[];
}

export const getReview = () => apiFetch<BudgetReview>('/review');
export const getBuffer = () => apiFetch<BufferState>('/review/buffer');
export const getGuide = () => apiFetch<GuideState>('/review/guide');
