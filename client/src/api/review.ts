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
  accountIssues?: import('../types').BudgetSummary['accountIssues'];
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
  accountIssues?: import('../types').BudgetSummary['accountIssues'];
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

// Phase 7: resilience (7B), resume and reminders (7E), extra income (7F).
export type ResilienceStatus =
  'not-set-up' | 'incomplete' | 'below-minimum' | 'below-target' | 'on-target' | 'no-target';
export interface ResilienceState {
  asOf: string;
  month: string;
  complete: boolean;
  status: ResilienceStatus;
  healthy: boolean;
  resources: number | null;
  partition: {
    card: number;
    committed: number;
    goals: number;
    flexibility: number;
    other: number;
    /** Cash spent beyond envelopes this month, as a negative amount */
    overspent: number;
    unassigned: number;
  } | null;
  flexibility: {
    categories: { categoryId: string; name: string; available: number; later: number }[];
    available: number | null;
    later: number;
    minimum: number | null;
    minimumGap: number | null;
    target: number | null;
    targetSource: { type: 'amount'; amount: number } | { type: 'months'; months: number } | null;
    targetGap: number | null;
  };
  essentials: {
    monthly: number | null;
    source: 'estimate' | 'measured';
    window: { from: string; to: string; total: number } | null;
    reasons: string[];
  };
  coverageTenths: number | null;
  unfunded: {
    overspent: number;
    cardWithoutReserve: number;
    committedShortfall: number;
    overAssigned: number;
  };
  unfundedTotal: number;
  incomplete: string[];
  assumptions: string[];
}
export interface ResumeState {
  asOf: string;
  lastReview: { completedAt: string; asOf: string } | null;
  daysSince: number | null;
  transactionsSince: number | null;
  uncategorisedCount: number;
  unreconciledAccounts: number;
  bank: { lastSyncedAt: string | null; itemsToReview: number | null } | null;
  complete: boolean;
  resolved: boolean;
  reminder: {
    cadence: 'payday' | 'monthly' | 'quarterly';
    dueSince: string | null;
    due: boolean;
    snoozedUntil: string | null;
  } | null;
  progress:
    | { comparable: false; reason: string; unfundedChange: number }
    | {
        comparable: true;
        reserveChange: number;
        assignedIn: number;
        reserveUse: number;
        refunds: number;
        unexplained: number;
        unfundedChange: number;
      }
    | null;
}
export interface IncomeCandidate {
  id: string;
  date: string;
  payee: string | null;
  amount: number;
}
export interface IncomeSplit {
  transactionId: string;
  baseline: number;
  reservePercent: number;
  categoryId: string;
}
export interface IncomePreview {
  transaction: IncomeCandidate;
  extra: number;
  share: number;
  proposed: number;
  shortfall: number;
  remainsUnassigned: number;
  complete: boolean;
  revision: string;
}

const post = <T>(path: string, body: unknown = {}) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const getResilience = () => apiFetch<ResilienceState>('/review/resilience');
export const getResume = () => apiFetch<ResumeState>('/review/resume');
export const completeReview = () => post<ResumeState>('/review/complete');
export const snoozeReminder = (until: string | null) =>
  post<ResumeState>('/review/snooze', { until });
export const getIncomeCandidates = () => apiFetch<IncomeCandidate[]>('/review/income');
export const previewIncome = (split: IncomeSplit) =>
  post<IncomePreview>('/review/income/preview', split);
export const applyIncome = (split: IncomeSplit, preview: IncomePreview) =>
  post<IncomePreview>('/review/income/apply', {
    ...split,
    revision: preview.revision,
    proposed: preview.proposed,
  });

/** Setup problems that make the budget less useful (server: services/housekeeping.ts) */
export interface Housekeeping {
  budgetStart: {
    current: string | null;
    historyStartMonth: string | null;
    suggestion: string | null;
  };
  missingRoundUps: { accountId: string; accountName: string; count: number; total: number }[];
  unlinkedSavers: { name: string; count: number; net: number; ids: string[] }[];
  unusedCategories: number;
}
export const getHousekeeping = () => apiFetch<Housekeeping>('/review/housekeeping');
