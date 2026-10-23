import { apiFetch } from './client';

export interface ForecastScenarioInput {
  name: string;
  spendingPercent: number;
  incomePercent: number;
  dailySpending: number | null;
  annualReturnBasisPoints: number;
  goalContributions: { goalId: string; amountPerPay: number }[];
  oneOffs: { date: string; amount: number; description: string }[];
  /** Phase 7C: ranges with no income, and monthly cost changes from a date */
  incomePauses: { from: string; to: string }[];
  costChanges: { from: string; monthlyAmount: number; description: string }[];
}
export interface ForecastRequest {
  horizonDays: number;
  lookbackDays: number;
  incomeSource: 'payday' | 'schedules' | null;
  includeHousehold: boolean | null;
  scenarios: ForecastScenarioInput[];
}
export interface ForecastEvent {
  id: string;
  date: string;
  kind: 'income' | 'bill' | 'scheduled' | 'household' | 'register' | 'one-off' | 'cost-change';
  description: string;
  amount: number;
  categoryId: string | null;
  estimated: boolean;
}
export interface GoalProjection {
  id: string;
  name: string;
  source: 'category' | 'manual';
  start: number | null;
  target: number;
  targetDate: string | null;
  end: number | null;
  contributed: number;
  attainmentDate: string | null;
  onTrack: boolean | null;
  points: { date: string; balance: number }[];
}
export interface ScenarioResult extends ForecastScenarioInput {
  days: { date: string; balance: number; income: number; scheduled: number; variable: number }[];
  events: ForecastEvent[];
  endBalance: number;
  lowest: { date: string; balance: number };
  /** First day below zero within the horizon; null means none within the horizon */
  firstShortfall: { date: string; balance: number } | null;
  pausedIncome: number;
  /** How far the lowest balance falls into today's flexibility reserve; null without one */
  reserveUse: number | null;
  nextPayday: string | null;
  lowestBeforeNextPayday: { date: string; balance: number } | null;
  variableTotal: number;
  goals: GoalProjection[];
}
export interface Forecast {
  today: string;
  end: string;
  horizonDays: number;
  currency: string | null;
  incomeSource: 'payday' | 'schedules';
  includeHousehold: boolean;
  startBalance: number;
  accounts: { id: string; name: string; balance: number }[];
  spending: { from: string; to: string; days: number; total: number; count: number };
  history: { date: string; balance: number }[];
  freshness: { latestTransaction: string | null; upLastSyncedAt: string | null };
  plans: { id: string; name: string; expectedIncome: number }[];
  assumptions: string[];
  warnings: string[];
  scenarios: ScenarioResult[];
}

/** Read-only projection: the request only carries assumptions; nothing is saved. */
export const getForecast = (request: ForecastRequest) =>
  apiFetch<Forecast>('/forecast', { method: 'POST', body: JSON.stringify(request) });

/** A saved scenario: its assumptions and the version a save or delete must name */
export interface SavedScenario {
  id: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  scenario: ForecastScenarioInput;
}

export const getSavedScenarios = () => apiFetch<SavedScenario[]>('/forecast/scenarios');
export const createSavedScenario = (scenario: ForecastScenarioInput) =>
  apiFetch<SavedScenario>('/forecast/scenarios', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });
/** 409 with the current copy when another device saved or deleted it since */
export const updateSavedScenario = (
  id: string,
  scenario: ForecastScenarioInput,
  expectedVersion: number,
) =>
  apiFetch<SavedScenario>(`/forecast/scenarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ scenario, expectedVersion }),
  });
export const deleteSavedScenario = (id: string, expectedVersion: number) =>
  apiFetch<void>(`/forecast/scenarios/${id}?expectedVersion=${expectedVersion}`, {
    method: 'DELETE',
  });
