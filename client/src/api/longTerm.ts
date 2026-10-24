import { apiFetch } from './client';

// The long-term forecast (docs/LONG-TERM-FORECAST.md). Types mirror the server's plan schema
// and engine result. Every rate is an integer in basis points (1% = 100) and every amount is
// integer cents, in future dollars until utils/longTerm.ts converts a view to today's.

export type Escalation =
  { mode: 'none' } | { mode: 'inflation' } | { mode: 'rate'; rateBps: number };
export type When = { year: number } | { age: number };
export type Reductions = Record<string, number>;
export type AccountClass = 'cash' | 'investments' | 'super' | 'property' | 'vehicles' | 'other';

interface EventBase {
  id: string;
  name: string;
  enabled: boolean;
  start: When;
}
export interface HomeEvent extends EventBase {
  kind: 'home';
  price: number;
  deposit: { kind: 'amount'; cents: number } | { kind: 'percent'; bps: number };
  loanRateBps: number;
  termYears: number;
  purchaseCosts: number;
  annualRates: number;
  annualInsurance: number;
  rentMonthly: number;
  replaceRent: boolean;
  repaymentOverride?: number;
  propertyGrowthBps: number;
}
export interface NewJobEvent extends EventBase {
  kind: 'newJob';
  takeHome: number;
  escalation: Escalation;
  signingBonus: number;
  grossSalary: number;
  reductions: Reductions;
}
export interface CareerBreakEvent extends EventBase {
  kind: 'careerBreak';
  durationYears: number;
  spendingMultiplierBps: number;
  reductions: Reductions;
}
export interface ChildEvent extends EventBase {
  kind: 'child';
  years: number;
  annualCost: number;
  upfrontCost: number;
  escalation: Escalation;
}
export interface OneOffEvent extends EventBase {
  kind: 'oneOff';
  amount: number;
  todaysDollars: boolean;
}
export interface RecurringEvent extends EventBase {
  kind: 'recurring';
  amount: number;
  endYear: number | null;
  everyYears: number;
  escalation: Escalation;
}
export interface RetirementEvent extends EventBase {
  kind: 'retirement';
  spendingMultiplierBps: number;
  reductions: Reductions;
}
export interface PayOffEvent extends EventBase {
  kind: 'payOff';
  loanId: string;
  amount: number | null;
}
export type PlanEvent =
  | HomeEvent
  | NewJobEvent
  | CareerBreakEvent
  | ChildEvent
  | OneOffEvent
  | RecurringEvent
  | RetirementEvent
  | PayOffEvent;
export type EventKind = PlanEvent['kind'];

export interface PlanSettings {
  birthYear: number;
  endAge: number;
  inflationBps: number;
  superGuaranteeBps: number;
  contributionsTaxBps: number;
  preservationAge: number;
  agePension: { enabled: boolean; annual: number; startAge: number };
  income: { takeHome: number | null; grossForSuper: number; escalation: Escalation };
  spending: { annual: number | null; escalation: Escalation };
  classGrowthBps: Record<AccountClass, number>;
  extraSavingsGrowthBps: number;
  withdrawalOrder: string[];
}
export interface AccountChoice {
  accountId: string;
  included: boolean;
  cls: AccountClass | null;
  growthBps: number | null;
}
export interface Split {
  accountId: string;
  mode: 'percent' | 'fixed';
  bps?: number;
  amount?: number;
}
export interface Plan {
  name: string;
  settings: PlanSettings;
  accounts: AccountChoice[];
  splits: Split[];
  events: PlanEvent[];
}
export interface SavedPlan {
  id: string;
  version: number;
  sortOrder: number;
  updatedAt: string;
  plan: Plan;
}
export interface PlanSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  eventCount: number;
}

export interface Row {
  id: string;
  name: string;
  amount: number;
}
export interface IncomeRow {
  sourceId: string;
  name: string;
  gross: number;
  reductions: Row[];
  amount: number;
}
export interface YearResult {
  index: number;
  calendarYear: number;
  /** Age at the start of the plan year */
  age: number;
  inflationIndexPpb: number;
  income: IncomeRow[];
  agePension: number;
  eventFlows: Row[];
  spending: number;
  spendingBase: number;
  spendingChanges: Row[];
  loanPayments: number;
  loanInterest: number;
  loanPrincipal: number;
  openedByEvents: number;
  superContribution: number;
  superTax: number;
  superNet: number;
  netCashFlow: number;
  withdrawals: Row[];
  allocations: Row[];
  unfundedAdded: number;
  unfundedRepaid: number;
  growth: Row[];
  growthTotal: number;
  openingNetWorth: number;
  closingNetWorth: number;
  balances: Record<string, number>;
  unfundedBalance: number;
  bridgeDifference: number;
}
export interface PlanResult {
  id: string;
  version: number;
  name: string;
  years: YearResult[];
  firstUnfunded: { index: number; calendarYear: number; age: number } | null;
  warnings: string[];
  startYear: number;
  startAge: number;
  endAge: number;
  preservationAge: number;
  retirementAge: number | null;
  inputs: {
    income: number;
    incomeSource: 'payday' | 'override';
    spending: number;
    spendingSource: 'history' | 'override';
  };
  superAccountIds: string[];
}

export interface StartingPoint {
  today: string;
  startYear: number;
  accounts: { id: string; name: string; type: string; cls: AccountClass; balance: number }[];
  loans: {
    id: string;
    name: string;
    type: string;
    balance: number;
    details: LoanDetails | null;
  }[];
  income: { annualTakeHome: number; source: 'payday' | 'none'; paydayPlans: number };
  spending: { annual: number; from: string; days: number };
  warnings: string[];
}
export interface LoanDetails {
  rateBps: number;
  monthlyRepayment: number;
  termMonths: number | null;
}
export interface Defaults {
  settings: PlanSettings;
  classGrowthBps: Record<AccountClass, number>;
  classes: AccountClass[];
  limits: { plans: number; events: number };
}
export interface Figure {
  key: string;
  label: string;
  unit: 'money' | 'year';
  active: number | null;
  reference: number | null;
  difference: number | null;
  percentBps: number | null;
}
export interface Comparison {
  active: { id: string; version: number; name: string };
  reference: { id: string; version: number; name: string };
  figures: Figure[];
  series: {
    index: number;
    calendarYear: number;
    age: number;
    active: number;
    reference: number;
    difference: number;
  }[];
  percentDefinition: string;
}

const base = '/forecast/long-term';
const json = (body: unknown) => JSON.stringify(body);

export const getDefaults = (birthYear?: number) =>
  apiFetch<Defaults>(`${base}/defaults${birthYear ? `?birthYear=${birthYear}` : ''}`);
export const getStartingPoint = () => apiFetch<StartingPoint>(`${base}/starting-point`);
export const listPlans = () => apiFetch<PlanSummary[]>(`${base}/plans`);
export const getPlan = (id: string) => apiFetch<SavedPlan>(`${base}/plans/${id}`);
export const createPlan = (plan: Plan) =>
  apiFetch<SavedPlan>(`${base}/plans`, { method: 'POST', body: json({ plan }) });
/** 409 when another device saved or deleted it since: fetch it again to see theirs */
export const updatePlan = (id: string, plan: Plan, expectedVersion: number) =>
  apiFetch<SavedPlan>(`${base}/plans/${id}`, {
    method: 'PUT',
    body: json({ plan, expectedVersion }),
  });
export const deletePlan = (id: string, expectedVersion: number) =>
  apiFetch<void>(`${base}/plans/${id}?expectedVersion=${expectedVersion}`, { method: 'DELETE' });
export const duplicatePlan = (id: string, name: string) =>
  apiFetch<SavedPlan>(`${base}/plans/${id}/duplicate`, { method: 'POST', body: json({ name }) });
export const getResult = (id: string) => apiFetch<PlanResult>(`${base}/plans/${id}/result`);
export const getComparison = (id: string, reference: string, dollars: 'today' | 'future') =>
  apiFetch<Comparison>(
    `${base}/plans/${id}/compare?reference=${encodeURIComponent(reference)}&dollars=${dollars}`,
  );
export const setLoanDetails = (accountId: string, details: LoanDetails) =>
  apiFetch<LoanDetails>(`${base}/loans/${accountId}`, { method: 'PUT', body: json(details) });
export const deleteLoanDetails = (accountId: string) =>
  apiFetch<void>(`${base}/loans/${accountId}`, { method: 'DELETE' });
