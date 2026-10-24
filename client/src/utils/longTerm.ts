// Pure helpers for the long-term forecast screen (docs/LONG-TERM-FORECAST.md): the
// today's-dollars view, the exact breakdown of a year, the worked savings example, and the
// drafts behind the event editors. Money is integer cents; BigInt keeps every product exact.
import type {
  AccountClass,
  Escalation,
  EventKind,
  Plan,
  PlanEvent,
  Split,
  When,
  YearResult,
} from '../api/longTerm';

export const PPB = 1_000_000_000;

function divRound(n: bigint, d: bigint): number {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const negative = n < 0n;
  const abs = negative ? -n : n;
  let q = abs / d;
  if ((abs % d) * 2n >= d) q += 1n;
  return Number(negative ? -q : q);
}

/** a × b ÷ c, exact, rounded half away from zero (the same rule as the server's) */
export const mulDiv = (a: number, b: number, c: number) =>
  divRound(BigInt(a) * BigInt(b), BigInt(c));

/**
 * Each value × num ÷ den, rounded so the results add up to the rounded total exactly: every
 * value takes its floor and the largest remainders get the leftover cents, first value first
 * on a tie. This is what keeps a year's parts adding up to the cent in today's dollars.
 */
export function apportion(values: number[], num: number, den: number): number[] {
  const n = BigInt(num);
  const d = BigInt(den);
  const total = values.reduce((sum, v) => sum + v, 0);
  const target = divRound(BigInt(total) * n, d);
  const floors = values.map((v) => {
    const product = BigInt(v) * n;
    let q = product / d;
    if (product % d < 0n) q -= 1n;
    return { floor: Number(q), rest: Number(product - q * d) };
  });
  const out = floors.map((f) => f.floor);
  let left = target - out.reduce((sum, v) => sum + v, 0);
  const order = floors
    .map((f, i) => ({ i, rest: f.rest }))
    .sort((a, b) => (left >= 0 ? b.rest - a.rest : a.rest - b.rest) || a.i - b.i);
  for (let k = 0; left !== 0 && order.length; k = (k + 1) % order.length) {
    const step = left > 0 ? 1 : -1;
    out[order[k].i] += step;
    left -= step;
  }
  return out;
}

export type Dollars = 'today' | 'future';

/** A net worth in the chosen dollars at the end of a plan year */
export const inDollars = (cents: number, indexPpb: number, mode: Dollars) =>
  mode === 'future' ? cents : mulDiv(cents, PPB, indexPpb);

export interface BridgeRow {
  key: string;
  label: string;
  amount: number;
  /** Group for the table: where the money came from or went */
  group: 'income' | 'events' | 'spending' | 'loans' | 'assets' | 'super' | 'growth' | 'inflation';
}
export interface Bridge {
  opening: number;
  rows: BridgeRow[];
  closing: number;
  /** opening + the rows − closing: always 0 */
  difference: number;
}

/** The parts of a year's change in net worth, in future dollars, exactly as the engine made them */
export function nominalRows(y: YearResult): BridgeRow[] {
  const rows: BridgeRow[] = [];
  for (const i of y.income) {
    rows.push({ key: `income:${i.sourceId}`, label: i.name, amount: i.amount, group: 'income' });
  }
  if (y.agePension) {
    rows.push({ key: 'pension', label: 'Age Pension', amount: y.agePension, group: 'income' });
  }
  for (const e of y.eventFlows) {
    rows.push({ key: `event:${e.id}`, label: e.name, amount: e.amount, group: 'events' });
  }
  rows.push({ key: 'spending', label: 'Spending', amount: -y.spending, group: 'spending' });
  rows.push({
    key: 'loanPayments',
    label: 'Loan payments',
    amount: -y.loanPayments,
    group: 'loans',
  });
  rows.push({
    key: 'principal',
    label: 'Debt reduced by repayments',
    amount: y.loanPrincipal,
    group: 'loans',
  });
  if (y.openedByEvents) {
    rows.push({
      key: 'opened',
      label: 'Property and mortgage opened (net of the deposit)',
      amount: y.openedByEvents,
      group: 'assets',
    });
  }
  rows.push({
    key: 'super',
    label: 'Employer super, after contributions tax',
    amount: y.superNet,
    group: 'super',
  });
  rows.push({ key: 'growth', label: 'Growth', amount: y.growthTotal, group: 'growth' });
  return rows;
}

/**
 * A year's breakdown in the chosen dollars. In future dollars it is the engine's own rows. In
 * today's dollars the opening is the previous year's closing at the previous year's prices,
 * the parts and closing are deflated at this year's prices (the parts apportioned so they add
 * up to the deflated total), and an "Inflation" row carries the rest: what the year's price
 * rise did to the opening balance. Either way opening + rows = closing.
 */
export function bridge(y: YearResult, previousIndexPpb: number, mode: Dollars): Bridge {
  const rows = nominalRows(y);
  if (mode === 'future') {
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    return {
      opening: y.openingNetWorth,
      rows,
      closing: y.closingNetWorth,
      difference: y.openingNetWorth + sum - y.closingNetWorth,
    };
  }
  const real = apportion(
    rows.map((r) => r.amount),
    PPB,
    y.inflationIndexPpb,
  );
  const opening = mulDiv(y.openingNetWorth, PPB, previousIndexPpb);
  const closing = mulDiv(y.closingNetWorth, PPB, y.inflationIndexPpb);
  const scaled: BridgeRow[] = rows.map((r, i) => ({ ...r, amount: real[i] }));
  const inflation = closing - opening - real.reduce((s, v) => s + v, 0);
  scaled.push({
    key: 'inflation',
    label: 'Inflation on the opening balance',
    amount: inflation,
    group: 'inflation',
  });
  const sum = scaled.reduce((s, r) => s + r.amount, 0);
  return { opening, rows: scaled, closing, difference: opening + sum - closing };
}

// ─── Savings splits ──────────────────────────────────────────────────────────

export interface ExampleStep {
  name: string;
  /** What this entry is set to */
  rule: string;
  amount: number;
  remaining: number;
}

/**
 * The sequential allocation, worked through for a surplus: percentages are of what is left,
 * fixed amounts are caps, and whatever remains goes to Extra savings. The same rule as the
 * engine's, shown so the order's effect is clear before a plan relies on it.
 */
export function worked(
  surplus: number,
  splits: (Split & { name: string })[],
  formatMoney: (cents: number) => string,
): ExampleStep[] {
  const steps: ExampleStep[] = [];
  let remaining = surplus;
  for (const s of splits) {
    const portion =
      remaining <= 0
        ? 0
        : s.mode === 'percent'
          ? mulDiv(remaining, s.bps ?? 0, 10_000)
          : Math.min(s.amount ?? 0, remaining);
    remaining -= portion;
    steps.push({
      name: s.name,
      rule:
        s.mode === 'percent'
          ? `${(s.bps ?? 0) / 100}% of what is left`
          : `up to ${formatMoney(s.amount ?? 0)}`,
      amount: portion,
      remaining,
    });
  }
  steps.push({ name: 'Extra savings', rule: 'the rest', amount: remaining, remaining: 0 });
  return steps;
}

// ─── Event drafts ────────────────────────────────────────────────────────────

export const EVENT_KINDS: { kind: EventKind; label: string; help: string }[] = [
  { kind: 'home', label: 'Buy a home', help: 'Deposit, loan, rates and insurance, replacing rent' },
  {
    kind: 'newJob',
    label: 'New job',
    help: 'New take-home pay, replacing some of your current pay',
  },
  {
    kind: 'careerBreak',
    label: 'Career break',
    help: 'Pay stops for a while, spending may change',
  },
  { kind: 'child', label: 'Child', help: 'An upfront cost, then a yearly cost for some years' },
  { kind: 'oneOff', label: 'Windfall or one-off expense', help: 'Money in or out, once' },
  {
    kind: 'recurring',
    label: 'Recurring income or expense',
    help: 'Every year, or every few years',
  },
  { kind: 'retirement', label: 'Retirement', help: 'Work pay stops, super opens up' },
  { kind: 'payOff', label: 'Pay off a loan', help: 'A lump sum against a loan or mortgage' },
];

export const kindLabel = (kind: EventKind) => EVENT_KINDS.find((k) => k.kind === kind)!.label;

let counter = 0;
/** A new event id: letters, digits and dashes; unique within this page and, in practice, overall */
export const newEventId = () =>
  `e${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const INFLATION: Escalation = { mode: 'inflation' };

/** A new draft of an event kind. Nothing is saved until the owner chooses Create. */
export function newDraft(kind: EventKind, ctx: { startYear: number }): PlanEvent {
  const base = { id: newEventId(), enabled: true, start: { year: ctx.startYear + 5 } as When };
  const name = kindLabel(kind);
  switch (kind) {
    case 'home':
      return {
        ...base,
        kind,
        name,
        price: 0,
        deposit: { kind: 'percent', bps: 2000 },
        loanRateBps: 600,
        termYears: 30,
        purchaseCosts: 0,
        annualRates: 0,
        annualInsurance: 0,
        rentMonthly: 0,
        replaceRent: false,
        propertyGrowthBps: 300,
      };
    case 'newJob':
      return {
        ...base,
        kind,
        name,
        takeHome: 0,
        escalation: INFLATION,
        signingBonus: 0,
        grossSalary: 0,
        reductions: { salary: 10_000 },
      };
    case 'careerBreak':
      return {
        ...base,
        kind,
        name,
        durationYears: 1,
        spendingMultiplierBps: 10_000,
        reductions: { salary: 10_000 },
      };
    case 'child':
      return {
        ...base,
        kind,
        name,
        years: 18,
        annualCost: 0,
        upfrontCost: 0,
        escalation: INFLATION,
      };
    case 'oneOff':
      return { ...base, kind, name, amount: 0, todaysDollars: true };
    case 'recurring':
      return {
        ...base,
        kind,
        name,
        amount: 0,
        endYear: null,
        everyYears: 1,
        escalation: INFLATION,
      };
    case 'retirement':
      return {
        ...base,
        kind,
        name,
        start: { age: 65 },
        spendingMultiplierBps: 10_000,
        reductions: { salary: 10_000 },
      };
    case 'payOff':
      return { ...base, kind, name, loanId: '', amount: null };
  }
}

/** What is missing before an event can be created: empty means ready */
export function draftIssues(e: PlanEvent): string[] {
  const issues: string[] = [];
  if (!e.name.trim()) issues.push('Give the event a name');
  switch (e.kind) {
    case 'home':
      if (e.price <= 0) issues.push('Enter the purchase price');
      break;
    case 'newJob':
      if (e.takeHome <= 0) issues.push('Enter the new take-home pay');
      break;
    case 'child':
      if (e.annualCost <= 0 && e.upfrontCost <= 0) issues.push('Enter an upfront or yearly cost');
      break;
    case 'oneOff':
    case 'recurring':
      if (e.amount === 0) issues.push('Enter an amount');
      break;
    case 'payOff':
      if (!e.loanId) issues.push('Choose the loan');
      break;
    default:
      break;
  }
  return issues;
}

/** The calendar year an event takes effect, or null past what the plan can show */
export function eventYear(when: When, birthYear: number): number {
  return 'year' in when ? when.year : birthYear + when.age;
}

/** Where an income reduction applies: the salary, and every new job and income event */
export function incomeSources(plan: Plan): { id: string; name: string }[] {
  return [
    { id: 'salary', name: 'Current salary' },
    ...plan.events.flatMap((e) =>
      e.kind === 'newJob' || (e.kind === 'recurring' && e.amount > 0)
        ? [{ id: e.id, name: e.name }]
        : [],
    ),
  ];
}

export const CLASS_LABEL: Record<AccountClass, string> = {
  cash: 'Cash',
  investments: 'Investments',
  super: 'Super',
  property: 'Property',
  vehicles: 'Vehicles',
  other: 'Other assets',
};

/** 650 → "6.5" for an input; "6.5" → 650. NaN-safe: returns null for text that isn't a rate. */
export const bpsToInput = (bps: number) => String(Math.round(bps) / 100);
export function inputToBps(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const percentLabel = (bps: number) => `${Math.round(bps) / 100}%`;
