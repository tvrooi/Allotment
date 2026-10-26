// Long-term forecast engine (docs/LONG-TERM-FORECAST.md). Pure: no database, no clock and no
// randomness, so the same plan always gives the same result and the in-browser demo can run the
// same code. Money is integer cents, rates are integer basis points, inflation indexes are
// integer parts per billion. Rounding happens only in mulDiv (half away from zero) and in
// standardLoanPayment, once per quantity; every balance is the integer sum of flows, so a year's
// parts add up to the cent by construction.

export const PPB = 1_000_000_000;
export const EXTRA_SAVINGS_ID = 'extra-savings';
export const SALARY_SOURCE_ID = 'salary';
export const SUPER_NEW_ID = 'super-new-contributions';
const BPS = 10_000;
const MONTHLY_BPS = 120_000;
export const MAX_YEARS = 100;
/** Highest yearly rate accepted, so a century of compounding stays inside safe integers */
const MAX_RATE_BPS = 1500;
/** Reaching 65 is a condition of release on its own, working or not (SIS Regulations sch 1) */
export const SUPER_RELEASE_AGE = 65;
/** Personal (non-concessional) contributions are accepted up to this age */
export const SUPER_PERSONAL_CONTRIBUTION_AGE = 75;

/**
 * Standard minimum yearly payment from an account-based pension, by age on 1 July: a share of
 * the balance that must leave super each year once it pays a pension.
 */
export const MINIMUM_DRAWDOWN: { fromAge: number; bps: number }[] = [
  { fromAge: 0, bps: 400 },
  { fromAge: 65, bps: 500 },
  { fromAge: 75, bps: 600 },
  { fromAge: 80, bps: 700 },
  { fromAge: 85, bps: 900 },
  { fromAge: 90, bps: 1100 },
  { fromAge: 95, bps: 1400 },
];

/**
 * Income-contingent study and training loans (HECS-HELP and the rest), in the order the ATO
 * applies one compulsory repayment across several of them.
 */
export const STUDY_LOAN_KINDS = ['help', 'vsl', 'ssl', 'abstudy_ssl', 'aasl'] as const;
export type StudyLoanKind = (typeof STUDY_LOAN_KINDS)[number];

/**
 * Compulsory repayment bands in today's dollars (2026–27): nothing up to the threshold, 15c of
 * each dollar above it, 17c above the second, and 10% of all repayment income above the third.
 * The thresholds rise with inflation in the forecast.
 */
export interface StudyRepaymentBands {
  threshold: number;
  second: number;
  third: number;
  firstBps: number;
  secondBps: number;
  topBps: number;
}
export const STUDY_REPAYMENT_BANDS: StudyRepaymentBands = {
  threshold: 6_952_800,
  second: 12_971_700,
  third: 18_605_000,
  firstBps: 1500,
  secondBps: 1700,
  topBps: 1000,
};

/** The year's compulsory repayment on a repayment income, with the bands as given */
export function compulsoryStudyRepayment(income: number, b: StudyRepaymentBands): number {
  if (income <= b.threshold) return 0;
  if (income <= b.second) return mulDiv(income - b.threshold, b.firstBps, BPS);
  if (income <= b.third)
    return (
      mulDiv(b.second - b.threshold, b.firstBps, BPS) + mulDiv(income - b.second, b.secondBps, BPS)
    );
  return mulDiv(income, b.topBps, BPS);
}

export function minimumDrawdownBps(age: number): number {
  let bps = MINIMUM_DRAWDOWN[0].bps;
  for (const step of MINIMUM_DRAWDOWN) if (age >= step.fromAge) bps = step.bps;
  return bps;
}

export class LongTermForecastError extends Error {}

// ─── Rounding ────────────────────────────────────────────────────────────────

function divRound(n: bigint, d: bigint): number {
  if (d === 0n) throw new RangeError('Division by zero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const negative = n < 0n;
  const abs = negative ? -n : n;
  let q = abs / d;
  if ((abs % d) * 2n >= d) q += 1n;
  const out = Number(negative ? -q : q);
  if (!Number.isSafeInteger(out)) throw new RangeError('Amount out of range');
  return out;
}

/** a × b ÷ c, exact in BigInt, rounded half away from zero. The one rounding rule. */
export function mulDiv(a: number, b: number, c: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c)) {
    throw new RangeError('mulDiv takes integers');
  }
  const product = a * b;
  // Small products stay in plain integers, which is exact and much faster than BigInt; the
  // result is the same either way (a simulation runs this millions of times)
  if (Number.isSafeInteger(product) && c !== 0) {
    const negative = product < 0 !== c < 0;
    const n = Math.abs(product);
    const d = Math.abs(c);
    const rest = n % d;
    let q = (n - rest) / d;
    if (rest >= d - rest) q += 1;
    return q === 0 ? 0 : negative ? -q : q;
  }
  return divRound(BigInt(a) * BigInt(b), BigInt(c));
}

/** a × b1 × b2 ÷ (c1 × c2), rounded once, for quantities that would otherwise round twice. */
export function mulDiv2(a: number, b1: number, b2: number, c1: number, c2: number): number {
  for (const v of [a, b1, b2, c1, c2])
    if (!Number.isSafeInteger(v)) throw new RangeError('mulDiv2 takes integers');
  return divRound(BigInt(a) * BigInt(b1) * BigInt(b2), BigInt(c1) * BigInt(c2));
}

/** Level monthly payment for a loan, exactly: L·r / (1 − (1 + r)^−n) with r = bps ÷ 120000. */
export function standardLoanPayment(principal: number, rateBps: number, months: number): number {
  if (!Number.isSafeInteger(principal) || principal < 0) throw new RangeError('Bad principal');
  if (!Number.isInteger(months) || months < 1) throw new RangeError('Bad term');
  if (principal === 0) return 0;
  if (rateBps === 0) return divRound(BigInt(principal), BigInt(months));
  const a = BigInt(MONTHLY_BPS + rateBps);
  const b = BigInt(MONTHLY_BPS);
  const n = BigInt(months);
  const an = a ** n;
  const bn = b ** n;
  return divRound(BigInt(principal) * BigInt(rateBps) * an, b * (an - bn));
}

/**
 * Overlapping reductions of one amount, applied in the order given and capped at the amount:
 * each takes its percentage of the ORIGINAL base, limited to what is left. Added, never
 * multiplied. (docs/LONG-TERM-FORECAST.md §6.1)
 */
export function applyCappedReductions(base: number, pctsBps: number[]) {
  let remaining = Math.max(0, base);
  const reductions = pctsBps.map((pct) => {
    const r = Math.min(remaining, mulDiv(Math.max(0, base), pct, BPS));
    remaining -= r;
    return r;
  });
  return { reductions, total: Math.max(0, base) - remaining, remaining };
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export type AccountClass = 'cash' | 'investments' | 'super' | 'property' | 'vehicles' | 'other';

export interface PlanAccount {
  id: string;
  name: string;
  cls: AccountClass;
  /** Today's balance in cents */
  balance: number;
  /** Yearly growth in basis points (may be negative) */
  growthBps: number;
}

export interface PlanLoan {
  id: string;
  name: string;
  /** Today's balance in cents; loans are negative, as in the ledger */
  balance: number;
  rateBps: number;
  /** Monthly repayment in cents (0 = none known) */
  monthlyRepayment: number;
  /** Months left, or null for open-ended */
  termMonths: number | null;
  /**
   * An income-contingent study loan: no interest, indexed each year, repaid by the compulsory
   * repayment on repayment income and by voluntary payments from surplus. Rate, repayment and
   * term are ignored.
   */
  study?: { kind: StudyLoanKind; extraAnnual: number };
}

export type Escalation =
  { mode: 'none' } | { mode: 'inflation' } | { mode: 'rate'; rateBps: number };

/** A date for an event: a calendar year or the age reached in that plan year */
export type When = { year: number } | { age: number };

interface EventBase {
  id: string;
  name: string;
  /** Position in the plan's event list; breaks ties between events starting together */
  position: number;
  enabled: boolean;
  start: When;
}

/** Per-source income reduction, in basis points of that source's income */
export type Reductions = Record<string, number>;

export interface HomeEvent extends EventBase {
  kind: 'home';
  /** Price in today's dollars */
  price: number;
  deposit: { kind: 'amount'; cents: number } | { kind: 'percent'; bps: number };
  loanRateBps: number;
  termYears: number;
  /** Stamp duty and purchase costs, today's dollars */
  purchaseCosts: number;
  /** Yearly council and water rates, and insurance; today's dollars, inflation-escalated */
  annualRates: number;
  annualInsurance: number;
  /** Monthly rent today, and whether the home replaces it */
  rentMonthly: number;
  replaceRent: boolean;
  /** Overrides the standard repayment (cents a month) */
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
  /** Signed: positive is a windfall */
  amount: number;
  todaysDollars: boolean;
}

export interface RecurringEvent extends EventBase {
  kind: 'recurring';
  /** Signed amount per occurrence: positive is income */
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
  /** Cents to pay; null = the loan's balance at the start of that year */
  amount: number | null;
}

export type LifeEvent =
  | HomeEvent
  | NewJobEvent
  | CareerBreakEvent
  | ChildEvent
  | OneOffEvent
  | RecurringEvent
  | RetirementEvent
  | PayOffEvent;

export interface SplitRule {
  accountId: string;
  mode: 'percent' | 'fixed';
  /** Percent of what is left, in basis points */
  bps?: number;
  /** Fixed amount in today's dollars; a cap that grows with inflation */
  amount?: number;
}

/**
 * How super is paid in, taxed and released. Fields after the first three are optional and
 * off when left out, so a plan written before them runs exactly as it did.
 */
export interface SuperRules {
  guaranteeBps: number;
  contributionsTaxBps: number;
  preservationAge: number;
  /** Salary sacrifice a year, today's dollars: concessional, already out of take-home pay */
  salarySacrifice?: number;
  /** Personal after-tax contributions a year, today's dollars, paid from surplus while working */
  personalContribution?: number;
  /** Fund admin fees and insurance premiums a year, today's dollars, taken from super */
  feesAnnual?: number;
  /** Tax on earnings while super is in the accumulation phase; none once it pays a pension */
  earningsTaxBps?: number;
  /** Pay the legislated minimum pension each year once retired and released */
  minimumDrawdown?: boolean;
  /** Caps in today's dollars; only warned about, never enforced */
  concessionalCap?: number;
  nonConcessionalCap?: number;
  transferBalanceCap?: number;
}

/**
 * What super can do in a plan year. Preserved: locked. Accessible: a condition of release is
 * met (65, or retired at or past the preservation age) and it can fund shortfalls. Pension:
 * retired and released, so its earnings are tax-free and the minimum payment applies.
 */
export type SuperPhase = 'preserved' | 'accessible' | 'pension';

/** Closing net worth split by when it can be spent; the four parts add up to net worth */
export interface WealthSplit {
  /** Cash, investments and released super, less unfunded spending */
  accessible: number;
  /** Super still locked by preservation */
  preserved: number;
  /** Property, vehicles and other assets the plan never sells */
  illiquid: number;
  /** Loans, as a negative number */
  debts: number;
}

export interface StudyLoanRules {
  /** Take-home pay already has compulsory repayments withheld, as an employer does */
  withheldFromPay: boolean;
  /** Repayment income beyond the gross salaries, today's dollars (investment income, fringe benefits) */
  otherRepaymentIncome: number;
  /** Yearly indexation; null follows inflation. Never below 0 (debts are not reduced by deflation) */
  indexationBps: number | null;
  bands: StudyRepaymentBands;
}

export interface ForecastPlan {
  startYear: number;
  startAge: number;
  endAge: number;
  inflationBps: number;
  accounts: PlanAccount[];
  loans: PlanLoan[];
  /** Annual take-home pay in today's dollars, and the gross salary super is paid on */
  salary: { takeHome: number; grossForSuper: number; escalation: Escalation };
  /** Annual spending in today's dollars */
  spending: { annual: number; escalation: Escalation };
  super: SuperRules;
  /** Optional Age Pension: yearly amount in today's dollars from an age; no means test */
  agePension: { enabled: boolean; annual: number; startAge: number };
  extraSavingsGrowthBps: number;
  /** How study loans are repaid; needed only when a loan is a study loan */
  studyLoans?: StudyLoanRules;
  splits: SplitRule[];
  /** Account ids first in the withdrawal order; others follow in the default order */
  withdrawalOrder: string[];
  events: LifeEvent[];
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export interface Row {
  id: string;
  name: string;
  amount: number;
}

export interface IncomeRow {
  sourceId: string;
  name: string;
  /** Before reductions */
  gross: number;
  reductions: Row[];
  /** After reductions */
  amount: number;
}

export interface YearResult {
  /** 1-based plan year; year 0 is today's snapshot */
  index: number;
  calendarYear: number;
  /** Age at the start of the plan year */
  age: number;
  inflationIndexPpb: number;
  income: IncomeRow[];
  agePension: number;
  eventFlows: Row[];
  /** Baseline spending after reductions, and the reductions made */
  spending: number;
  spendingBase: number;
  spendingChanges: Row[];
  loanPayments: number;
  loanInterest: number;
  loanPrincipal: number;
  /** Net effect on net worth of balances events open: property + mortgage */
  openedByEvents: number;
  /** Concessional contributions (employer and salary sacrifice), before contributions tax */
  superContribution: number;
  /** The salary sacrifice part of superContribution */
  superSalarySacrifice: number;
  superTax: number;
  superNet: number;
  /** Personal after-tax contributions moved from this year's surplus (also an allocation) */
  superPersonal: number;
  /** Fund fees and insurance premiums taken from super */
  superFees: number;
  /** Tax on super earnings in the accumulation phase */
  superEarningsTax: number;
  /** Minimum pension payments moved out of super into this year's cash flow */
  superDrawdown: number;
  /** What super could do during this year */
  superPhase: SuperPhase;
  /** Repayment income the compulsory study loan repayment was worked out on */
  studyRepaymentIncome: number;
  /** Indexation added to study debts (no interest is charged) */
  studyIndexation: number;
  /** Compulsory repayments applied to study debts (cash out, debt down) */
  studyCompulsory: number;
  /** Pay already withheld for study loans in the take-home figure, counted back as income */
  studyWithheld: number;
  /** Voluntary study loan payments from surplus (also an allocation) */
  studyVoluntary: number;
  /** Net cash flow after loan payments (pension payments included) */
  netCashFlow: number;
  /** Moves between accounts: they change the mix, not net worth */
  withdrawals: Row[];
  allocations: Row[];
  unfundedAdded: number;
  unfundedRepaid: number;
  growth: Row[];
  growthTotal: number;
  openingNetWorth: number;
  closingNetWorth: number;
  /** Closing balances; loans are negative */
  balances: Record<string, number>;
  unfundedBalance: number;
  /** Closing net worth by when it can be spent, with super as it stands at the next year's start */
  wealth: WealthSplit;
  /** opening + Σ parts − closing; always 0 */
  bridgeDifference: number;
}

export interface PlanMoment {
  index: number;
  calendarYear: number;
  age: number;
}

export interface StudyLoanSummary {
  /** Plan year every study debt is repaid in, or null if it never is */
  repaid: PlanMoment | null;
  indexationTotal: number;
  voluntaryTotal: number;
  /** The same loans with compulsory repayments only: no voluntary payments or pay-offs */
  minimumOnly: { repaid: PlanMoment | null; indexationTotal: number };
}

export interface ForecastResult {
  /** Index 0 is today's snapshot (only balances and net worth are meaningful) */
  years: YearResult[];
  firstUnfunded: { index: number; calendarYear: number; age: number } | null;
  /** Null when the plan has no study loans */
  studyLoans: StudyLoanSummary | null;
  warnings: string[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

const isInt = Number.isSafeInteger;

function fail(message: string): never {
  throw new LongTermForecastError(message);
}

function checkBps(value: number, label: string, min = 0, max = BPS) {
  if (!isInt(value) || value < min || value > max)
    fail(`${label} must be between ${min} and ${max}`);
}

function checkEscalation(e: Escalation, label: string) {
  if (e.mode === 'rate') checkBps(e.rateBps, `${label} rate`, -5000, MAX_RATE_BPS);
}

function checkReductions(r: Reductions, label: string) {
  for (const [key, pct] of Object.entries(r)) checkBps(pct, `${label} reduction for ${key}`);
}

export function validatePlan(plan: ForecastPlan): void {
  if (!isInt(plan.startYear) || !isInt(plan.startAge))
    fail('Start year and age must be whole numbers');
  if (plan.startAge < 0 || plan.startAge > 120) fail('Start age is out of range');
  if (!isInt(plan.endAge) || plan.endAge <= plan.startAge)
    fail('End age must be after the start age');
  if (plan.endAge - plan.startAge > MAX_YEARS) fail(`A plan covers at most ${MAX_YEARS} years`);
  checkBps(plan.inflationBps, 'Inflation', -2000, MAX_RATE_BPS);
  checkBps(plan.extraSavingsGrowthBps, 'Extra savings growth', -5000, MAX_RATE_BPS);
  checkBps(plan.super.guaranteeBps, 'Super guarantee rate');
  checkBps(plan.super.contributionsTaxBps, 'Contributions tax');
  if (!isInt(plan.super.preservationAge)) fail('Preservation age must be a whole number');
  for (const [key, label] of [
    ['salarySacrifice', 'Salary sacrifice'],
    ['personalContribution', 'Personal super contributions'],
    ['feesAnnual', 'Super fees'],
    ['concessionalCap', 'Concessional cap'],
    ['nonConcessionalCap', 'Non-concessional cap'],
    ['transferBalanceCap', 'Transfer balance cap'],
  ] as const) {
    const v = plan.super[key];
    if (v !== undefined && (!isInt(v) || v < 0)) fail(`${label} must be non-negative whole cents`);
  }
  if (plan.super.earningsTaxBps !== undefined)
    checkBps(plan.super.earningsTaxBps, 'Super earnings tax');
  for (const v of [plan.salary.takeHome, plan.salary.grossForSuper, plan.spending.annual]) {
    if (!isInt(v) || v < 0) fail('Income and spending must be non-negative whole cents');
  }
  checkEscalation(plan.salary.escalation, 'Salary escalation');
  checkEscalation(plan.spending.escalation, 'Spending escalation');
  if (!isInt(plan.agePension.annual) || plan.agePension.annual < 0)
    fail('Age Pension must be whole cents');

  const ids = new Set<string>([EXTRA_SAVINGS_ID, SALARY_SOURCE_ID, SUPER_NEW_ID]);
  const claim = (id: string, label: string) => {
    if (!id || ids.has(id)) fail(`${label} id "${id}" is empty or used twice`);
    ids.add(id);
  };
  const accountIds = new Set<string>();
  for (const a of plan.accounts) {
    claim(a.id, 'Account');
    accountIds.add(a.id);
    if (!isInt(a.balance)) fail(`Account ${a.name} balance must be whole cents`);
    checkBps(a.growthBps, `${a.name} growth`, -5000, MAX_RATE_BPS);
  }
  const loanIds = new Set<string>();
  for (const l of plan.loans) {
    claim(l.id, 'Loan');
    loanIds.add(l.id);
    if (!isInt(l.balance) || l.balance > 0)
      fail(`Loan ${l.name} balance must be zero or negative cents`);
    checkBps(l.rateBps, `${l.name} rate`, 0, BPS);
    if (!isInt(l.monthlyRepayment) || l.monthlyRepayment < 0)
      fail(`Loan ${l.name} repayment is invalid`);
    if (l.termMonths !== null && (!isInt(l.termMonths) || l.termMonths < 1)) {
      fail(`Loan ${l.name} term is invalid`);
    }
    if (l.study) {
      if (!STUDY_LOAN_KINDS.includes(l.study.kind)) fail(`Loan ${l.name} has an unknown kind`);
      if (!isInt(l.study.extraAnnual) || l.study.extraAnnual < 0)
        fail(`Loan ${l.name} extra payment must be non-negative whole cents`);
      if (!plan.studyLoans) fail('A study loan needs the study loan rules');
    }
  }
  if (plan.studyLoans) {
    const r = plan.studyLoans;
    if (!isInt(r.otherRepaymentIncome) || r.otherRepaymentIncome < 0)
      fail('Other repayment income must be non-negative whole cents');
    if (r.indexationBps !== null)
      checkBps(r.indexationBps, 'Study loan indexation', -2000, MAX_RATE_BPS);
    const b = r.bands;
    for (const v of [b.threshold, b.second, b.third])
      if (!isInt(v) || v < 0) fail('Study loan thresholds must be whole cents');
    if (!(b.threshold <= b.second && b.second <= b.third)) fail('Study loan thresholds must rise');
    checkBps(b.firstBps, 'Study loan rate');
    checkBps(b.secondBps, 'Study loan rate');
    checkBps(b.topBps, 'Study loan rate');
  }

  const sources = new Set<string>([SALARY_SOURCE_ID]);
  for (const e of plan.events) {
    claim(e.id, 'Event');
    if (e.kind === 'home') {
      claim(`${e.id}:property`, 'Generated');
      claim(`${e.id}:mortgage`, 'Generated');
    }
    if (e.kind === 'newJob') claim(`${e.id}:bonus`, 'Generated');
    if (e.kind === 'newJob' || (e.kind === 'recurring' && e.amount > 0)) sources.add(e.id);
  }
  const cents = (v: unknown, label: string) => {
    if (typeof v !== 'number' || !isInt(v) || v < 0)
      fail(`${label} must be non-negative whole cents`);
  };
  const whole = (v: unknown, label: string, min = 0) => {
    if (typeof v !== 'number' || !isInt(v) || v < min)
      fail(`${label} must be a whole number of at least ${min}`);
  };
  for (const e of plan.events) {
    if (!isInt(e.position)) fail(`${e.name} position is invalid`);
    if (!e.start || !('year' in e.start ? isInt(e.start.year) : isInt(e.start.age))) {
      fail(`${e.name} needs a whole-number start year or age`);
    }
    if ('reductions' in e) {
      checkReductions(e.reductions, e.name);
      for (const key of Object.keys(e.reductions)) {
        if (!sources.has(key)) fail(`${e.name} reduces an unknown income source`);
        if (key === e.id) fail(`${e.name} cannot reduce its own income`);
      }
    }
    if ('spendingMultiplierBps' in e)
      checkBps(e.spendingMultiplierBps, `${e.name} spending`, 0, 50_000);
    if ('escalation' in e) checkEscalation(e.escalation, e.name);
    switch (e.kind) {
      case 'home':
        cents(e.price, `${e.name} price`);
        cents(e.purchaseCosts, `${e.name} costs`);
        cents(e.annualRates, `${e.name} rates`);
        cents(e.annualInsurance, `${e.name} insurance`);
        cents(e.rentMonthly, `${e.name} rent`);
        if (e.repaymentOverride !== undefined) cents(e.repaymentOverride, `${e.name} repayment`);
        if (e.deposit.kind === 'percent') checkBps(e.deposit.bps, `${e.name} deposit`);
        else cents(e.deposit.cents, `${e.name} deposit`);
        checkBps(e.loanRateBps, `${e.name} loan rate`, 0, BPS);
        checkBps(e.propertyGrowthBps, `${e.name} property growth`, -5000, MAX_RATE_BPS);
        whole(e.termYears, `${e.name} term`, 1);
        if (e.termYears > 50) fail(`${e.name} term is invalid`);
        break;
      case 'newJob':
        cents(e.takeHome, `${e.name} take-home`);
        cents(e.signingBonus, `${e.name} signing bonus`);
        cents(e.grossSalary, `${e.name} gross salary`);
        break;
      case 'careerBreak':
        whole(e.durationYears, `${e.name} duration`, 1);
        break;
      case 'child':
        whole(e.years, `${e.name} years`, 1);
        cents(e.annualCost, `${e.name} yearly cost`);
        cents(e.upfrontCost, `${e.name} upfront cost`);
        break;
      case 'oneOff':
        if (!isInt(e.amount)) fail(`${e.name} amount must be whole cents`);
        break;
      case 'recurring':
        if (!isInt(e.amount)) fail(`${e.name} amount must be whole cents`);
        whole(e.everyYears, `${e.name} repeat`, 1);
        if (e.endYear !== null) whole(e.endYear, `${e.name} end year`, -10_000);
        break;
      case 'retirement':
        break;
      case 'payOff':
        if (!loanIds.has(e.loanId)) fail(`${e.name} pays off an unknown loan`);
        if (e.amount !== null) cents(e.amount, `${e.name} amount`);
        break;
      default:
        fail(`Unknown event kind on ${(e as { name?: string }).name ?? 'an event'}`);
    }
  }
  if (plan.events.filter((e) => e.kind === 'retirement' && e.enabled).length > 1) {
    fail('A plan has at most one retirement');
  }
  if (!isInt(plan.agePension.startAge)) fail('Age Pension age must be a whole number');
  for (const a of plan.accounts) {
    if (!['cash', 'investments', 'super', 'property', 'vehicles', 'other'].includes(a.cls)) {
      fail(`Account ${a.name} has an unknown class`);
    }
  }
  // A blank split entry gets 0
  for (const s of plan.splits) {
    const target = plan.accounts.find((a) => a.id === s.accountId);
    if (!target || (target.cls !== 'cash' && target.cls !== 'investments')) {
      fail('Savings go to cash or investment accounts only');
    }
    if (s.mode === 'percent') {
      if (s.bps !== undefined) checkBps(s.bps, 'Split percentage');
    } else if (s.mode === 'fixed') {
      if (s.amount !== undefined) cents(s.amount, 'Split amount');
    } else fail('Unknown split mode');
  }
}

// ─── Engine ──────────────────────────────────────────────────────────────────

interface Acct {
  id: string;
  name: string;
  cls: AccountClass;
  balance: number;
  growthBps: number;
  opening: number;
}

interface LoanState {
  id: string;
  name: string;
  owed: number;
  rateBps: number;
  repayment: number;
  monthsLeft: number | null;
  /** Plan year the loan opened in; it makes no payments that year */
  openedIndex: number;
  study?: { kind: StudyLoanKind; extraAnnual: number; order: number };
}

interface IncomeSource {
  id: string;
  name: string;
  startIndex: number;
  annual: number;
  escalation: Escalation;
  grossForSuper: number;
  /** Occurs every n plan years from startIndex (1 = every year) */
  every: number;
  /** Last plan year it can occur in */
  lastIndex: number;
}

function rateIndexPpb(rateBps: number, years: number): number {
  let index = PPB;
  for (let i = 0; i < years; i++) index = mulDiv(index, BPS + rateBps, BPS);
  return index;
}

function startIndexOf(when: When, plan: ForecastPlan): number {
  return 'year' in when ? when.year - plan.startYear + 1 : when.age - plan.startAge + 1;
}

function runLoanYear(loan: LoanState) {
  let payments = 0;
  let interest = 0;
  for (let month = 0; month < 12 && loan.owed > 0; month++) {
    const i = mulDiv(loan.owed, loan.rateBps, MONTHLY_BPS);
    const due = loan.owed + i;
    let pay = loan.repayment;
    if (loan.monthsLeft !== null) {
      loan.monthsLeft -= 1;
      if (loan.monthsLeft <= 0) pay = due;
    }
    pay = Math.min(pay, due);
    loan.owed = due - pay;
    payments += pay;
    interest += i;
  }
  return { payments, interest, principal: payments - interest };
}

export interface ForecastOptions {
  /**
   * Replaces an account's yearly growth for one plan year, in whole basis points. The
   * deterministic forecast leaves it out; a simulation gives each year its own return.
   */
  growthBps?: (
    index: number,
    account: { id: string; cls: AccountClass; growthBps: number },
  ) => number;
  /** The plan has already been validated (a simulation runs one plan many times) */
  validated?: boolean;
}

export function forecastLongTerm(
  plan: ForecastPlan,
  options: ForecastOptions = {},
): ForecastResult {
  try {
    return runForecast(plan, options);
  } catch (error) {
    if (error instanceof RangeError)
      throw new LongTermForecastError('Amounts are too large to forecast');
    throw error;
  }
}

function runForecast(plan: ForecastPlan, options: ForecastOptions): ForecastResult {
  if (!options.validated) validatePlan(plan);
  const warnings: string[] = [];
  const years = plan.endAge - plan.startAge;

  // Inflation indexes: index[k] is the price level of plan year k against today
  const inflation: number[] = [PPB];
  for (let k = 1; k <= years; k++)
    inflation.push(mulDiv(inflation[k - 1], BPS + plan.inflationBps, BPS));

  /** An amount in today's dollars at plan year k, escalated from its start year s */
  const escalate = (amount: number, esc: Escalation, s: number, k: number): number => {
    const startIndex = inflation[Math.min(Math.max(s, 0), years)];
    if (esc.mode === 'inflation') return mulDiv(amount, inflation[k], PPB);
    if (esc.mode === 'none') return mulDiv(amount, startIndex, PPB);
    return mulDiv2(amount, startIndex, rateIndexPpb(esc.rateBps, Math.max(0, k - s)), PPB, PPB);
  };

  const accounts: Acct[] = [];
  const addAccount = (a: Omit<Acct, 'opening'>) => accounts.push({ ...a, opening: a.balance });
  addAccount({
    id: EXTRA_SAVINGS_ID,
    name: 'Extra savings',
    cls: 'cash',
    balance: 0,
    growthBps: plan.extraSavingsGrowthBps,
  });
  for (const a of plan.accounts) addAccount({ ...a });
  const hasSuper = plan.accounts.some((a) => a.cls === 'super');
  if (!hasSuper) {
    addAccount({
      id: SUPER_NEW_ID,
      name: 'Super (new contributions)',
      cls: 'super',
      balance: 0,
      growthBps: 0,
    });
  }
  const superTarget = accounts.find((a) => a.cls === 'super') as Acct;

  const loans: LoanState[] = plan.loans.map((l, i) => ({
    id: l.id,
    name: l.name,
    owed: 0 - l.balance,
    rateBps: l.rateBps,
    repayment: l.monthlyRepayment,
    monthsLeft: l.termMonths,
    openedIndex: 0,
    study: l.study
      ? { ...l.study, order: STUDY_LOAN_KINDS.indexOf(l.study.kind) * 1000 + i }
      : undefined,
  }));
  // Compulsory repayments go to study loans in the ATO's order, then their order in the plan
  const studyLoans = loans
    .filter((l) => l.study)
    .sort((a, b) => (a.study as { order: number }).order - (b.study as { order: number }).order);
  const studyRules = plan.studyLoans;
  const hasStudyDebt = studyLoans.some((l) => l.owed > 0);
  /** The minimum-only shadow: the same loans with compulsory repayments and nothing else */
  const shadow = new Map(studyLoans.map((l) => [l.id, l.owed]));
  let shadowRepaid: PlanMoment | null = null;
  let shadowIndexation = 0;
  let studyRepaid: PlanMoment | null = null;
  let studyIndexationTotal = 0;
  let studyVoluntaryTotal = 0;
  let unfunded = 0;

  const events = plan.events
    .filter((e) => e.enabled)
    .map((e) => ({ e, s: startIndexOf(e.start, plan) }))
    .sort((a, b) => a.s - b.s || a.e.position - b.e.position);
  for (const { e, s } of events) {
    if (s > years) warnings.push(`${e.name} is dated after the end of the plan and never happens`);
  }
  for (const { e, s } of events) {
    if (s < 1 && (e.kind === 'home' || e.kind === 'oneOff' || e.kind === 'payOff')) {
      warnings.push(`${e.name} is dated before today and was ignored`);
    }
  }

  // Income sources: the salary, new jobs and recurring income events
  const sources: IncomeSource[] = [
    {
      id: SALARY_SOURCE_ID,
      name: 'Salary',
      startIndex: 1,
      annual: plan.salary.takeHome,
      escalation: plan.salary.escalation,
      grossForSuper: plan.salary.grossForSuper,
      every: 1,
      lastIndex: years,
    },
  ];
  for (const { e, s } of events) {
    if (e.kind === 'newJob') {
      sources.push({
        id: e.id,
        name: e.name,
        startIndex: s,
        annual: e.takeHome,
        escalation: e.escalation,
        grossForSuper: e.grossSalary,
        every: 1,
        lastIndex: years,
      });
    } else if (e.kind === 'recurring' && e.amount > 0) {
      sources.push({
        id: e.id,
        name: e.name,
        startIndex: s,
        annual: e.amount,
        escalation: e.escalation,
        grossForSuper: 0,
        every: e.everyYears,
        lastIndex: e.endYear === null ? years : Math.min(years, e.endYear - plan.startYear + 1),
      });
    }
  }

  // Dated-before-today homes, one-offs and pay-offs never happen; ongoing events still apply
  const active = events.filter(
    ({ e, s }) => !(s < 1 && (e.kind === 'home' || e.kind === 'oneOff' || e.kind === 'payOff')),
  );
  const retirement = events.find(({ e }) => e.kind === 'retirement');
  const rules = plan.super;
  /** What super can do in plan year k (k may run one past the end, for the closing split) */
  const phaseOf = (k: number): SuperPhase => {
    const age = plan.startAge + k - 1;
    const retiredBy = retirement !== undefined && retirement.s <= k;
    const released = (retiredBy && age >= rules.preservationAge) || age >= SUPER_RELEASE_AGE;
    if (!released) return 'preserved';
    return retiredBy ? 'pension' : 'accessible';
  };
  const wealthOf = (phase: SuperPhase): WealthSplit => {
    const split = { accessible: 0 - unfunded, preserved: 0, illiquid: 0, debts: 0 };
    for (const a of accounts) {
      if (a.cls === 'cash' || a.cls === 'investments') split.accessible += a.balance;
      else if (a.cls === 'super') {
        if (phase === 'preserved') split.preserved += a.balance;
        else split.accessible += a.balance;
      } else split.illiquid += a.balance;
    }
    for (const l of loans) split.debts -= l.owed;
    return split;
  };
  let warnedConcessional = false;
  let warnedTransferCap = false;
  if (
    rules.personalContribution &&
    rules.nonConcessionalCap !== undefined &&
    rules.personalContribution > rules.nonConcessionalCap
  ) {
    warnings.push(
      'Personal super contributions are above the non-concessional cap; tax on the excess is not modelled',
    );
  }
  const nominalWorth = () => {
    const assets = accounts.reduce((sum, a) => sum + a.balance, 0);
    const worth = assets - loans.reduce((sum, l) => sum + l.owed, 0) - unfunded;
    if (!Number.isSafeInteger(worth) || accounts.some((a) => !Number.isSafeInteger(a.balance))) {
      throw new RangeError('Amount out of range');
    }
    return worth;
  };
  const snapshotBalances = () => {
    const out: Record<string, number> = {};
    for (const a of accounts) out[a.id] = a.balance;
    for (const l of loans) out[l.id] = 0 - l.owed;
    return out;
  };

  const results: YearResult[] = [
    {
      index: 0,
      calendarYear: plan.startYear,
      age: plan.startAge,
      inflationIndexPpb: PPB,
      income: [],
      agePension: 0,
      eventFlows: [],
      spending: 0,
      spendingBase: 0,
      spendingChanges: [],
      loanPayments: 0,
      loanInterest: 0,
      loanPrincipal: 0,
      openedByEvents: 0,
      superContribution: 0,
      superSalarySacrifice: 0,
      superTax: 0,
      superNet: 0,
      superPersonal: 0,
      superFees: 0,
      superEarningsTax: 0,
      superDrawdown: 0,
      superPhase: phaseOf(1),
      studyRepaymentIncome: 0,
      studyIndexation: 0,
      studyCompulsory: 0,
      studyWithheld: 0,
      studyVoluntary: 0,
      netCashFlow: 0,
      withdrawals: [],
      allocations: [],
      unfundedAdded: 0,
      unfundedRepaid: 0,
      growth: [],
      growthTotal: 0,
      openingNetWorth: nominalWorth(),
      closingNetWorth: nominalWorth(),
      balances: snapshotBalances(),
      unfundedBalance: 0,
      wealth: wealthOf(phaseOf(1)),
      bridgeDifference: 0,
    },
  ];
  let firstUnfunded: ForecastResult['firstUnfunded'] = null;

  for (let k = 1; k <= years; k++) {
    const age = plan.startAge + k - 1;
    const calendarYear = plan.startYear + k - 1;
    for (const a of accounts) a.opening = a.balance;
    const openingNetWorth = nominalWorth();
    const retired = retirement !== undefined && retirement.s <= k;
    const phase = phaseOf(k);

    // 1. Events: balances they open or change
    let openedByEvents = 0;
    let lumpPayments = 0;
    let lumpPrincipal = 0;
    const eventFlows = new Map<string, Row>();
    const flow = (id: string, name: string, amount: number) => {
      const row = eventFlows.get(id) ?? { id, name, amount: 0 };
      row.amount += amount;
      eventFlows.set(id, row);
    };
    for (const { e, s } of active) {
      if (s !== k) continue;
      if (e.kind === 'home') {
        const price = mulDiv(e.price, inflation[k], PPB);
        const deposit = Math.min(
          price,
          e.deposit.kind === 'amount'
            ? mulDiv(e.deposit.cents, inflation[k], PPB)
            : mulDiv(price, e.deposit.bps, BPS),
        );
        const loan = price - deposit;
        const months = e.termYears * 12;
        accounts.push({
          id: `${e.id}:property`,
          name: `${e.name} (property)`,
          cls: 'property',
          balance: price,
          growthBps: e.propertyGrowthBps,
          opening: 0,
        });
        loans.push({
          id: `${e.id}:mortgage`,
          name: `${e.name} (mortgage)`,
          owed: loan,
          rateBps: e.loanRateBps,
          repayment: e.repaymentOverride ?? standardLoanPayment(loan, e.loanRateBps, months),
          monthsLeft: months,
          openedIndex: k,
        });
        openedByEvents += price - loan;
        flow(e.id, e.name, -(deposit + mulDiv(e.purchaseCosts, inflation[k], PPB)));
      } else if (e.kind === 'payOff') {
        const loan = loans.find((l) => l.id === e.loanId) as LoanState;
        const lump = Math.min(loan.owed, e.amount ?? loan.owed);
        loan.owed -= lump;
        lumpPayments += lump;
        lumpPrincipal += lump;
      } else if (e.kind === 'newJob' && e.signingBonus) {
        flow(`${e.id}:bonus`, `${e.name} signing bonus`, mulDiv(e.signingBonus, inflation[k], PPB));
      } else if (e.kind === 'child' && e.upfrontCost) {
        flow(e.id, e.name, -escalate(e.upfrontCost, e.escalation, s, k));
      }
    }

    // 2. Cash flow
    const incomeRows: IncomeRow[] = [];
    let incomeTotal = 0;
    const superBase: { gross: number; remainingBps: number }[] = [];
    let salaryRemainingBps = BPS;
    for (const src of sources) {
      const occurs =
        k >= src.startIndex && k <= src.lastIndex && (k - src.startIndex) % src.every === 0;
      const gross = occurs ? escalate(src.annual, src.escalation, src.startIndex, k) : 0;
      const reducers = active
        .filter(({ e, s }) => {
          if (!('reductions' in e) || !e.reductions[src.id] || s > k) return false;
          if (e.kind === 'careerBreak') return k < s + e.durationYears;
          return true;
        })
        .map(({ e }) => ({ e: e as NewJobEvent | CareerBreakEvent | RetirementEvent }));
      const pcts = reducers.map(({ e }) => e.reductions[src.id]);
      const capped = applyCappedReductions(gross, pcts);
      const amount = gross - capped.total;
      if (src.id === SALARY_SOURCE_ID)
        salaryRemainingBps = applyCappedReductions(BPS, pcts).remaining;
      incomeTotal += amount;
      if (gross !== 0 || amount !== 0) {
        incomeRows.push({
          sourceId: src.id,
          name: src.name,
          gross,
          reductions: reducers.map(({ e }, i) => ({
            id: e.id,
            name: e.name,
            amount: capped.reductions[i],
          })),
          amount,
        });
      }
      if (src.grossForSuper > 0 && k >= src.startIndex) {
        const grossSuper = escalate(src.grossForSuper, src.escalation, src.startIndex, k);
        superBase.push({
          gross: grossSuper,
          remainingBps: applyCappedReductions(BPS, pcts).remaining,
        });
      }
    }
    const pension =
      plan.agePension.enabled && age >= plan.agePension.startAge
        ? mulDiv(plan.agePension.annual, inflation[k], PPB)
        : 0;

    for (const { e, s } of active) {
      if (e.kind === 'child' && k >= s && k < s + e.years) {
        flow(e.id, e.name, -escalate(e.annualCost, e.escalation, s, k));
      } else if (e.kind === 'oneOff' && s === k) {
        flow(e.id, e.name, e.todaysDollars ? mulDiv(e.amount, inflation[k], PPB) : e.amount);
      } else if (e.kind === 'recurring' && e.amount < 0) {
        const last = e.endYear === null ? years : Math.min(years, e.endYear - plan.startYear + 1);
        if (k >= s && k <= last && (k - s) % e.everyYears === 0) {
          flow(e.id, e.name, escalate(e.amount, e.escalation, s, k));
        }
      } else if (e.kind === 'recurring' && e.amount > 0) {
        // income sources are counted above
      } else if (e.kind === 'home' && k >= s) {
        flow(e.id, e.name, -mulDiv(e.annualRates + e.annualInsurance, inflation[k], PPB));
      }
    }

    // Spending: the baseline, then reductions and additions in event start order
    const spendingBase = escalate(plan.spending.annual, plan.spending.escalation, 1, k);
    const changes: { id: string; name: string; reduction: number; addition: number }[] = [];
    for (const { e, s } of active) {
      if (s > k) continue;
      if ((e.kind === 'careerBreak' && k < s + e.durationYears) || e.kind === 'retirement') {
        const m = e.spendingMultiplierBps;
        if (m < BPS)
          changes.push({
            id: e.id,
            name: e.name,
            reduction: mulDiv(spendingBase, BPS - m, BPS),
            addition: 0,
          });
        else if (m > BPS)
          changes.push({
            id: e.id,
            name: e.name,
            reduction: 0,
            addition: mulDiv(spendingBase, m - BPS, BPS),
          });
      } else if (e.kind === 'home' && e.replaceRent && e.rentMonthly > 0) {
        changes.push({
          id: `${e.id}:rent`,
          name: `${e.name} replaces rent`,
          reduction: mulDiv(12 * e.rentMonthly, inflation[k], PPB),
          addition: 0,
        });
      }
    }
    let spendRemaining = Math.max(0, spendingBase);
    const spendingChanges: Row[] = [];
    let spending = spendingBase;
    for (const c of changes) {
      if (c.addition) {
        spending += c.addition;
        spendingChanges.push({ id: c.id, name: c.name, amount: c.addition });
      } else {
        const taken = Math.min(spendRemaining, c.reduction);
        spendRemaining -= taken;
        spending -= taken;
        if (taken) spendingChanges.push({ id: c.id, name: c.name, amount: -taken });
      }
    }

    // 3. Liabilities
    let loanPayments = lumpPayments;
    let loanInterest = 0;
    let loanPrincipal = lumpPrincipal;
    for (const loan of loans) {
      if (loan.openedIndex === k || loan.study) continue;
      const run = runLoanYear(loan);
      loanPayments += run.payments;
      loanInterest += run.interest;
      loanPrincipal += run.principal;
    }

    // 4. Super: employer contributions and salary sacrifice on the salary that remains, after
    // contributions tax; then fees, then the minimum payment out of a pension
    let superContribution = 0;
    for (const base of superBase) {
      superContribution += mulDiv2(
        base.gross,
        base.remainingBps,
        plan.super.guaranteeBps,
        BPS,
        BPS,
      );
    }
    const superSalarySacrifice = rules.salarySacrifice
      ? mulDiv(
          escalate(rules.salarySacrifice, plan.salary.escalation, 1, k),
          salaryRemainingBps,
          BPS,
        )
      : 0;
    superContribution += superSalarySacrifice;
    const superTax = mulDiv(superContribution, plan.super.contributionsTaxBps, BPS);
    const superNet = superContribution - superTax;
    superTarget.balance += superNet;
    if (
      !warnedConcessional &&
      rules.concessionalCap !== undefined &&
      superContribution > mulDiv(rules.concessionalCap, inflation[k], PPB)
    ) {
      warnedConcessional = true;
      warnings.push(
        `Concessional super contributions pass the cap in ${calendarYear}; tax on the excess is not modelled`,
      );
    }
    const superFees = rules.feesAnnual
      ? Math.min(Math.max(0, superTarget.balance), mulDiv(rules.feesAnnual, inflation[k], PPB))
      : 0;
    superTarget.balance -= superFees;
    const drawn = new Map<string, number>();
    let superDrawdown = 0;
    if (phase === 'pension') {
      const superOpening = accounts
        .filter((a) => a.cls === 'super')
        .reduce((sum, a) => sum + Math.max(0, a.opening), 0);
      if (
        !warnedTransferCap &&
        rules.transferBalanceCap !== undefined &&
        superOpening > mulDiv(rules.transferBalanceCap, inflation[k], PPB)
      ) {
        warnedTransferCap = true;
        warnings.push(
          `Super is above the transfer balance cap when its pension starts in ${calendarYear}; the excess would stay in accumulation and pay earnings tax, which is not modelled`,
        );
      }
      if (rules.minimumDrawdown) {
        const rate = minimumDrawdownBps(age);
        for (const a of accounts) {
          if (a.cls !== 'super') continue;
          const d = Math.min(Math.max(0, a.balance), mulDiv(Math.max(0, a.opening), rate, BPS));
          if (d <= 0) continue;
          a.balance -= d;
          drawn.set(a.id, d);
          superDrawdown += d;
        }
      }
    }

    // 4b. Study loans: the compulsory repayment on this year's repayment income, applied in the
    // ATO's order, then indexation on what is left (repayments are credited before 1 June)
    let studyRepaymentIncome = 0;
    let studyIndexation = 0;
    let studyCompulsory = 0;
    let studyWithheld = 0;
    if (studyRules && studyLoans.length) {
      for (const base of superBase)
        studyRepaymentIncome += mulDiv(base.gross, base.remainingBps, BPS);
      studyRepaymentIncome += mulDiv(studyRules.otherRepaymentIncome, inflation[k], PPB);
      const b = studyRules.bands;
      const scaled: StudyRepaymentBands = {
        ...b,
        threshold: mulDiv(b.threshold, inflation[k], PPB),
        second: mulDiv(b.second, inflation[k], PPB),
        third: mulDiv(b.third, inflation[k], PPB),
      };
      const due = compulsoryStudyRepayment(studyRepaymentIncome, scaled);
      // Today's take-home has the withholding taken out, so it is income the plan never saw;
      // once the debt is gone that pay is no longer withheld and arrives as cash
      if (studyRules.withheldFromPay && hasStudyDebt) studyWithheld = due;
      const rate = Math.max(0, studyRules.indexationBps ?? plan.inflationBps);
      let left = due;
      let shadowLeft = due;
      for (const loan of studyLoans) {
        const pay = Math.min(left, loan.owed);
        loan.owed -= pay;
        left -= pay;
        studyCompulsory += pay;
        const idx = mulDiv(loan.owed, rate, BPS);
        loan.owed += idx;
        studyIndexation += idx;
        const s0 = shadow.get(loan.id) as number;
        const sp = Math.min(shadowLeft, s0);
        shadowLeft -= sp;
        const sIdx = mulDiv(s0 - sp, rate, BPS);
        shadow.set(loan.id, s0 - sp + sIdx);
        shadowIndexation += sIdx;
      }
      studyIndexationTotal += studyIndexation;
      if (!shadowRepaid && [...shadow.values()].every((v) => v <= 0))
        shadowRepaid = { index: k, calendarYear, age };
    }

    // 5. Surplus or deficit
    const eventTotal = [...eventFlows.values()].reduce((sum, r) => sum + r.amount, 0);
    const netCashFlow =
      incomeTotal +
      pension +
      eventTotal -
      spending -
      loanPayments +
      superDrawdown +
      studyWithheld -
      studyCompulsory;
    const withdrawn = new Map<string, number>();
    const allocations: Row[] = [];
    let unfundedAdded = 0;
    let unfundedRepaid = 0;
    let superPersonal = 0;
    let studyVoluntary = 0;
    if (netCashFlow >= 0) {
      unfundedRepaid = Math.min(unfunded, netCashFlow);
      unfunded -= unfundedRepaid;
      let remaining = netCashFlow - unfundedRepaid;
      // Voluntary study loan payments next, never more than the debt or what is left
      for (const loan of studyLoans) {
        const extra = (loan.study as { extraAnnual: number }).extraAnnual;
        if (!extra || remaining <= 0 || loan.owed <= 0) continue;
        const pay = Math.min(remaining, loan.owed, mulDiv(extra, inflation[k], PPB));
        loan.owed -= pay;
        remaining -= pay;
        studyVoluntary += pay;
        allocations.push({ id: loan.id, name: loan.name, amount: pay });
      }
      studyVoluntaryTotal += studyVoluntary;
      // Personal contributions come first from what is left, while working and under 75
      if (rules.personalContribution && !retired && age < SUPER_PERSONAL_CONTRIBUTION_AGE) {
        superPersonal = Math.min(remaining, mulDiv(rules.personalContribution, inflation[k], PPB));
        if (superPersonal > 0) {
          superTarget.balance += superPersonal;
          remaining -= superPersonal;
          allocations.push({ id: superTarget.id, name: superTarget.name, amount: superPersonal });
        }
      }
      for (const split of plan.splits) {
        if (remaining <= 0) break;
        const target = accounts.find((a) => a.id === split.accountId) as Acct;
        const portion =
          split.mode === 'percent'
            ? mulDiv(remaining, split.bps ?? 0, BPS)
            : Math.min(mulDiv(split.amount ?? 0, inflation[k], PPB), remaining);
        if (portion <= 0) continue;
        target.balance += portion;
        remaining -= portion;
        allocations.push({ id: target.id, name: target.name, amount: portion });
      }
      if (remaining > 0) {
        accounts[0].balance += remaining;
        allocations.push({ id: EXTRA_SAVINGS_ID, name: accounts[0].name, amount: remaining });
      }
    } else {
      let need = -netCashFlow;
      const superOpen = phase !== 'preserved';
      const eligible = accounts.filter(
        (a) => a.cls === 'cash' || a.cls === 'investments' || (a.cls === 'super' && superOpen),
      );
      const rank = (a: Acct) => (a.cls === 'cash' ? 0 : a.cls === 'investments' ? 1 : 2);
      const defaults = [...eligible].sort((x, y) =>
        x.id === EXTRA_SAVINGS_ID ? -1 : y.id === EXTRA_SAVINGS_ID ? 1 : rank(x) - rank(y),
      );
      const listed = plan.withdrawalOrder
        .map((id) => eligible.find((a) => a.id === id))
        .filter((a): a is Acct => a !== undefined);
      const order = [...new Set([...listed, ...defaults])];
      for (const a of order) {
        if (need <= 0) break;
        const take = Math.min(need, Math.max(0, a.balance));
        if (take <= 0) continue;
        a.balance -= take;
        need -= take;
        withdrawn.set(a.id, take);
      }
      if (need > 0) {
        unfunded += need;
        unfundedAdded = need;
        if (!firstUnfunded) firstUnfunded = { index: k, calendarYear, age };
      }
    }

    // 6. Growth on the balance after withdrawals, before this year's deposits
    const growth: Row[] = [];
    let growthTotal = 0;
    let superEarningsTax = 0;
    for (const a of accounts) {
      // Fees left the fund this year too, so they earn nothing and lose nothing
      const out =
        (withdrawn.get(a.id) ?? 0) + (drawn.get(a.id) ?? 0) + (a === superTarget ? superFees : 0);
      const base = Math.max(0, a.opening - out);
      const rate = options.growthBps ? options.growthBps(k, a) : a.growthBps;
      const g = mulDiv(base, rate, BPS);
      if (g !== 0) {
        a.balance += g;
        growth.push({ id: a.id, name: a.name, amount: g });
        growthTotal += g;
      }
      if (a.cls === 'super' && g > 0 && phase !== 'pension' && rules.earningsTaxBps) {
        const t = mulDiv(g, rules.earningsTaxBps, BPS);
        a.balance -= t;
        superEarningsTax += t;
      }
    }

    // 7. Snapshot
    if (hasStudyDebt && !studyRepaid && studyLoans.every((l) => l.owed <= 0))
      studyRepaid = { index: k, calendarYear, age };
    const closingNetWorth = nominalWorth();
    const parts =
      incomeTotal +
      pension +
      eventTotal -
      spending -
      loanPayments +
      loanPrincipal +
      openedByEvents +
      superNet -
      superFees +
      growthTotal -
      superEarningsTax +
      studyWithheld -
      studyIndexation;
    results.push({
      index: k,
      calendarYear,
      age,
      inflationIndexPpb: inflation[k],
      income: incomeRows,
      agePension: pension,
      eventFlows: [...eventFlows.values()],
      spending,
      spendingBase,
      spendingChanges,
      loanPayments,
      loanInterest,
      loanPrincipal,
      openedByEvents,
      superContribution,
      superSalarySacrifice,
      superTax,
      superNet,
      superPersonal,
      superFees,
      superEarningsTax,
      superDrawdown,
      superPhase: phase,
      studyRepaymentIncome,
      studyIndexation,
      studyCompulsory,
      studyWithheld,
      studyVoluntary,
      netCashFlow,
      withdrawals: [...withdrawn].map(([id, amount]) => ({
        id,
        name: (accounts.find((a) => a.id === id) as Acct).name,
        amount,
      })),
      allocations,
      unfundedAdded,
      unfundedRepaid,
      growth,
      growthTotal,
      openingNetWorth,
      closingNetWorth,
      balances: snapshotBalances(),
      unfundedBalance: unfunded,
      wealth: wealthOf(phaseOf(k + 1)),
      bridgeDifference: openingNetWorth + parts - closingNetWorth,
    });
  }

  if (studyLoans.length && !studyRepaid && studyLoans.every((l) => l.owed <= 0)) {
    // Repaid at the very start (a zero balance) is reported as plan year 0
    studyRepaid = { index: 0, calendarYear: plan.startYear, age: plan.startAge };
  }
  if (hasStudyDebt && results.slice(1).every((y) => y.studyRepaymentIncome === 0)) {
    warnings.push(
      'Study loans have no repayment income, so no compulsory repayments are made: enter your gross salary',
    );
  }
  for (const loan of plan.loans) {
    if (loan.balance === 0 || loan.study) continue;
    const firstInterest = mulDiv(-loan.balance, loan.rateBps, MONTHLY_BPS);
    if (loan.monthlyRepayment === 0 && loan.rateBps === 0) {
      warnings.push(`${loan.name} has no repayment data and stays flat`);
    } else if (loan.monthlyRepayment === 0 && loan.termMonths !== null) {
      warnings.push(
        `${loan.name} has no repayment, so its whole balance falls due in its last month`,
      );
    } else if (loan.monthlyRepayment <= firstInterest && loan.rateBps > 0) {
      warnings.push(`${loan.name}'s repayment does not cover its interest, so the balance grows`);
    }
  }
  const studySummary: StudyLoanSummary | null = studyLoans.length
    ? {
        repaid: studyRepaid,
        indexationTotal: studyIndexationTotal,
        voluntaryTotal: studyVoluntaryTotal,
        minimumOnly: {
          repaid: hasStudyDebt ? shadowRepaid : studyRepaid,
          indexationTotal: shadowIndexation,
        },
      }
    : null;
  return { years: results, firstUnfunded, studyLoans: studySummary, warnings };
}
