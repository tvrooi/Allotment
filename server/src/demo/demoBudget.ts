/**
 * The demo budget: an Australian couple banking with Up (a Spending account, two Savers and a
 * shared 2Up account), paid fortnightly, with about 18 months of history ending today and
 * every feature in use (see README in ../browser). Pure: it takes today's
 * date and returns rows, the same rows every time for the same day (a seeded random
 * generator, readable ids), so a visitor always sees a coherent, finished-looking budget.
 */
import {
  addDays,
  addMonths,
  format,
  getDay,
  lastDayOfMonth,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import type {
  accounts,
  budgetSettings,
  exchangeRates,
  budgetMonths,
  categories,
  categoryGroups,
  customReports,
  dashboardPages,
  dashboardWidgets,
  goals,
  budgetMonthNotes,
  categoryNotes,
  holdings,
  investmentSaleParcels,
  investmentSales,
  payees,
  rules,
  schedules,
  securities,
  securityPrices,
  taxLots,
  transactions,
} from '../db/schema.js';
import {
  buildRecurrenceRule,
  computeOccurrenceDates,
  type RecurrenceRule,
  type RecurrenceType,
} from '../utils/recurrence.js';
import type { Action, Condition } from '../services/rulesEngine.js';
import { DEMO_LOGOS, type DemoLogo } from './logos.js';

type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];

export interface ScheduleLink {
  scheduleId: string;
  scheduledDate: string;
  /** The payment, or null for an occurrence the couple skipped */
  transactionId: string | null;
}

export interface DemoBudget {
  /** In Australian dollars, like everything Up holds */
  budgetSettings: Row<typeof budgetSettings>[];
  /** None: every account is in the budget's own currency */
  exchangeRates: Row<typeof exchangeRates>[];
  categoryGroups: Row<typeof categoryGroups>[];
  categories: Row<typeof categories>[];
  accounts: Row<typeof accounts>[];
  payees: Row<typeof payees>[];
  schedules: Row<typeof schedules>[];
  transactions: Row<typeof transactions>[];
  /** Past occurrences to mark paid (linked to their transaction) or skipped */
  scheduleLinks: ScheduleLink[];
  budgetMonths: Row<typeof budgetMonths>[];
  rules: Row<typeof rules>[];
  customReports: Row<typeof customReports>[];
  dashboardPages: Row<typeof dashboardPages>[];
  dashboardWidgets: Row<typeof dashboardWidgets>[];
  goals: Row<typeof goals>[];
  /** A note on this month and one on an envelope (BUD-10) */
  budgetMonthNotes: Row<typeof budgetMonthNotes>[];
  categoryNotes: Row<typeof categoryNotes>[];
  /** One share fund in the brokerage account: two purchases and one sale (D3a), kept lean */
  securities: Row<typeof securities>[];
  securityPrices: Row<typeof securityPrices>[];
  holdings: Row<typeof holdings>[];
  taxLots: Row<typeof taxLots>[];
  investmentSales: Row<typeof investmentSales>[];
  investmentSaleParcels: Row<typeof investmentSaleParcels>[];
}

// ─── Random numbers ────────────────────────────────────────────────────────────

/** mulberry32: small, fast, and the same sequence for the same seed */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── The budget's structure ───────────────────────────────────────────────────

type BudgetType = 'fixed' | 'flexible' | 'non_monthly' | 'savings';

/** Category groups and categories: key → [name, icon, budget type] */
const GROUPS: {
  key: string;
  name: string;
  isIncome?: boolean;
  cats: [string, string, string, BudgetType?][];
}[] = [
  {
    key: 'income',
    name: 'Income',
    isIncome: true,
    cats: [
      ['paychecks', 'Pay', 'Banknote'],
      ['interest', 'Interest', 'Percent'],
      ['otherIncome', 'Other Income', 'Coins'],
    ],
  },
  {
    key: 'housing',
    name: 'Home',
    cats: [
      ['rent', 'Rent', 'House', 'fixed'],
      ['rentersInsurance', 'Contents Insurance', 'Shield', 'fixed'],
      ['homeGoods', 'Home Goods', 'Sofa', 'flexible'],
    ],
  },
  {
    key: 'bills',
    name: 'Bills',
    cats: [
      ['electric', 'Electricity', 'Zap', 'fixed'],
      ['internet', 'Internet', 'Wifi', 'fixed'],
      ['phone', 'Phone', 'Smartphone', 'fixed'],
      ['streaming', 'Streaming', 'Tv', 'fixed'],
    ],
  },
  {
    key: 'food',
    name: 'Food',
    cats: [
      ['groceries', 'Groceries', 'ShoppingCart', 'flexible'],
      ['restaurants', 'Eating Out', 'UtensilsCrossed', 'flexible'],
      ['coffee', 'Coffee', 'Coffee', 'flexible'],
    ],
  },
  {
    key: 'transport',
    name: 'Getting Around',
    cats: [
      ['carPayment', 'Car Loan', 'Car', 'fixed'],
      ['carInsurance', 'Car Insurance', 'ShieldCheck', 'fixed'],
      ['gas', 'Fuel', 'Fuel', 'flexible'],
      ['transit', 'Public Transport', 'TrainFront', 'flexible'],
      ['carMaintenance', 'Car Servicing', 'Wrench', 'non_monthly'],
      ['rego', 'Rego & CTP', 'FileBadge', 'non_monthly'],
    ],
  },
  {
    key: 'health',
    name: 'Health',
    cats: [
      ['gym', 'Gym', 'Dumbbell', 'fixed'],
      ['pharmacy', 'Chemist', 'Pill', 'flexible'],
      ['medical', 'Doctor & Dentist', 'Stethoscope', 'non_monthly'],
    ],
  },
  {
    key: 'lifestyle',
    name: 'Lifestyle',
    cats: [
      ['clothing', 'Clothing', 'Shirt', 'flexible'],
      ['personalCare', 'Personal Care', 'Sparkles', 'flexible'],
      ['pets', 'Biscuit (dog)', 'Dog', 'flexible'],
      ['entertainment', 'Entertainment', 'Clapperboard', 'flexible'],
      ['electronics', 'Electronics', 'Laptop', 'non_monthly'],
    ],
  },
  {
    key: 'giving',
    name: 'Gifts & Giving',
    cats: [
      ['gifts', 'Gifts', 'Gift', 'non_monthly'],
      ['charity', 'Charity', 'HeartHandshake', 'fixed'],
    ],
  },
  {
    key: 'goals',
    name: 'Savings Goals',
    cats: [
      ['vacation', 'Holidays', 'Palmtree', 'non_monthly'],
      ['emergencyFund', 'Emergency Fund', 'LifeBuoy', 'savings'],
    ],
  },
];

type CategoryKey = (typeof GROUPS)[number]['cats'][number][0];

const ACCOUNTS: {
  key: string;
  name: string;
  type: string;
  offBudget?: boolean;
  logo: DemoLogo;
  startingBalance?: number;
  /** Up's own kind of account, for the demo's Up connection (none = not from Up) */
  up?: 'TRANSACTIONAL' | 'SAVER';
}[] = [
  { key: 'checking', name: 'Spending', type: 'checking', logo: 'upSpending', up: 'TRANSACTIONAL' },
  { key: 'savings', name: 'Rainy Day', type: 'savings', logo: 'upSaver', up: 'SAVER' },
  { key: 'holiday', name: 'Holiday', type: 'savings', logo: 'upHoliday', up: 'SAVER' },
  // The couple's shared 2Up account: everyday shared spending, topped up from Spending
  { key: 'card', name: '2Up Spending', type: 'checking', logo: 'twoUp', up: 'TRANSACTIONAL' },
  {
    key: 'retirement',
    name: 'Evergreen Super',
    type: 'retirement',
    offBudget: true,
    logo: 'evergreen',
    startingBalance: 6_842_000,
  },
  {
    key: 'brokerage',
    name: 'Pinecone Shares',
    type: 'investment',
    offBudget: true,
    logo: 'pinecone',
    startingBalance: 615_000,
  },
  {
    key: 'carLoan',
    name: 'Northstar Car Loan',
    type: 'auto_loan',
    offBudget: true,
    logo: 'northstar',
    startingBalance: -1_795_000,
  },
  {
    key: 'car',
    name: '2021 Hatchback',
    type: 'vehicle',
    offBudget: true,
    logo: 'vehicle',
    startingBalance: 2_450_000,
  },
];

type AccountKey =
  'checking' | 'savings' | 'holiday' | 'card' | 'retirement' | 'brokerage' | 'carLoan' | 'car';

/** The accounts the demo's (pretend) Up connection brings in, with Up's names and kinds */
export const DEMO_UP_ACCOUNTS = ACCOUNTS.filter((a) => a.up).map((a) => ({
  accountId: `demo-acct-${a.key}`,
  name: a.name,
  accountType: a.up!,
}));

/** The budget's currency */
const BUDGET_CURRENCY = 'AUD';

/** Payees: key → [name, logo, default category, raw bank text] */
const PAYEES: Record<string, [string, DemoLogo, CategoryKey | null, string | null]> = {
  brightwave: ['Brightwave Studio', 'brightwave', 'paychecks', 'BRIGHTWAVE STUDIO PAY'],
  cedarHealth: ['Cedar Health', 'cedarHealth', 'paychecks', 'CEDAR HEALTH SALARY'],
  harbor: ['Up', 'upSaver', 'interest', 'Interest'],
  mapleCourt: ['Harbourside Realty', 'mapleCourt', 'rent', 'HARBOURSIDE REALTY RENT'],
  shieldwell: ['Shieldwell Insurance', 'shieldwell', 'carInsurance', 'SHIELDWELL INS PREMIUM'],
  cityPower: ['Southern Power', 'cityPower', 'electric', 'SOUTHERN POWER DD'],
  loopFiber: ['Loop NBN', 'loopFiber', 'internet', 'LOOP NBN'],
  nimbus: ['Nimbus Mobile', 'nimbus', 'phone', 'NIMBUS MOBILE'],
  streamline: ['Streamline', 'streamline', 'streaming', 'STREAMLINE.TV'],
  tuneful: ['Tuneful', 'tuneful', 'streaming', 'TUNEFUL*PREMIUM'],
  flexplay: ['FlexPlay', 'flexplay', 'streaming', 'FLEXPLAY SUBSCRIPTION'],
  peakFitness: ['Peak Fitness', 'peakFitness', 'gym', 'PEAK FITNESS CLUB'],
  freshFields: ['Woolies', 'freshFields', 'groceries', 'WOOLWORTHS 1142 NEWTOWN'],
  costwise: ['Costwise Warehouse', 'costwise', 'groceries', 'COSTWISE WHSE 0487'],
  cornerGrocer: ['Corner Grocer', 'cornerGrocer', 'groceries', 'CORNER GROCER'],
  dailyGrind: ['Daily Grind Coffee', 'dailyGrind', 'coffee', 'SQ *DAILY GRIND 1142'],
  luigis: ["Luigi's Trattoria", 'luigis', 'restaurants', 'LUIGIS TRATTORIA'],
  tacoLuna: ['Taco Luna', 'tacoLuna', 'restaurants', 'TACO LUNA'],
  sakura: ['Sakura Sushi', 'sakura', 'restaurants', 'SAKURA SUSHI BAR'],
  burgerBarn: ['Burger Barn', 'burgerBarn', 'restaurants', 'BURGER BARN 12'],
  fuelStop: ['Fuel Stop', 'fuelStop', 'gas', 'FUEL STOP 0318'],
  opal: ['Opal', 'opal', 'transit', 'OPAL TOP UP'],
  quickLube: ['QuickLube Auto Care', 'quickLube', 'carMaintenance', 'QUICKLUBE AUTO CARE'],
  registry: ['Motor Registry', 'registry', 'rego', 'MOTOR REGISTRY RENEWAL'],
  northstar: ['Northstar Mutual', 'northstar', 'carPayment', 'NORTHSTAR MUTUAL LOAN'],
  evergreen: ['Evergreen Super', 'evergreen', null, null],
  pinecone: ['Pinecone Invest', 'pinecone', null, null],
  wellway: ['Wellway Chemist', 'wellway', 'pharmacy', 'WELLWAY CHEMIST 0921'],
  riverside: ['Riverside Medical', 'riverside', 'medical', 'RIVERSIDE MEDICAL GAP'],
  threadline: ['Threadline', 'threadline', 'clothing', 'THREADLINE ONLINE'],
  hearthHome: ['Hearth & Home', 'hearthHome', 'homeGoods', 'HEARTH AND HOME 88'],
  parcel: ['Parcel', 'parcel', null, 'PARCEL.COM.AU*ORDER'],
  glow: ['Glow Beauty', 'glow', 'personalCare', 'GLOW BEAUTY'],
  happyPaws: ['Happy Paws Pet Supply', 'happyPaws', 'pets', 'HAPPY PAWS PET SUPPLY'],
  oakwoodVet: ['Oakwood Vet', 'oakwoodVet', 'pets', 'OAKWOOD VETERINARY'],
  skyhop: ['SkyHop Airlines', 'skyhop', 'vacation', 'SKYHOP AIR 0271'],
  lakesideInn: ['Lakeside Inn', 'lakesideInn', 'vacation', 'LAKESIDE INN'],
  cineplex: ['Cineplex 8', 'cineplex', 'entertainment', 'CINEPLEX 8 TICKETS'],
  kindred: ['Kindred Food Bank', 'kindred', 'charity', 'KINDRED FOOD BANK'],
};

type PayeeKey = keyof typeof PAYEES;

const MONTHS_OF_HISTORY = 18;

/** Fortnightly take-home pay, and the fortnightly rent */
const RILEY_PAY = 205_000;
const RILEY_PAY_BEFORE_RAISE = 198_600;
const SAM_PAY = 172_400;
const RENT = 115_000;

// ─── Building it ────────────────────────────────────────────────────────────────

export function buildDemoBudget(today: Date): DemoBudget {
  const rand = seededRandom(20260929);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

  const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
  const todayStr = ymd(today);
  const firstMonth = startOfMonth(subMonths(today, MONTHS_OF_HISTORY - 1));
  const monthStarts = Array.from({ length: MONTHS_OF_HISTORY }, (_, i) => addMonths(firstMonth, i));
  const monthKey = (d: Date) => format(d, 'yyyy-MM');
  const currentMonth = monthKey(today);
  const reconciledBefore = ymd(subDays(today, 40));
  /** A date in month `m` (clamped to its last day), or null if it hasn't happened yet */
  const dayIn = (m: Date, day: number): string | null => {
    const d = ymd(
      new Date(m.getFullYear(), m.getMonth(), Math.min(day, lastDayOfMonth(m).getDate())),
    );
    return d <= todayStr ? d : null;
  };

  // Categories
  const cat = {} as Record<CategoryKey, string>;
  const result: DemoBudget = {
    budgetSettings: [{ id: 'budget', currency: BUDGET_CURRENCY }],
    exchangeRates: [],
    categoryGroups: [],
    categories: [],
    accounts: [],
    payees: [],
    schedules: [],
    transactions: [],
    scheduleLinks: [],
    budgetMonths: [],
    rules: [],
    customReports: [],
    dashboardPages: [],
    dashboardWidgets: [],
    goals: [],
    budgetMonthNotes: [],
    categoryNotes: [],
    securities: [],
    securityPrices: [],
    holdings: [],
    taxLots: [],
    investmentSales: [],
    investmentSaleParcels: [],
  };
  const budgetTypes = {} as Record<CategoryKey, BudgetType | undefined>;
  GROUPS.forEach((group, gi) => {
    const groupId = `demo-group-${group.key}`;
    result.categoryGroups.push({
      id: groupId,
      name: group.name,
      isIncome: group.isIncome ? 1 : 0,
      sortOrder: gi,
    });
    group.cats.forEach(([key, name, icon, budgetType], ci) => {
      cat[key as CategoryKey] = `demo-cat-${key}`;
      budgetTypes[key as CategoryKey] = budgetType;
      result.categories.push({
        id: `demo-cat-${key}`,
        groupId,
        name,
        icon,
        budgetType: budgetType ?? null,
        sortOrder: ci,
      });
    });
  });

  // Accounts
  const acct = {} as Record<AccountKey, string>;
  const accountNames = {} as Record<AccountKey, string>;
  ACCOUNTS.forEach((a, i) => {
    acct[a.key as AccountKey] = `demo-acct-${a.key}`;
    accountNames[a.key as AccountKey] = a.name;
    result.accounts.push({
      id: `demo-acct-${a.key}`,
      name: a.name,
      type: a.type,
      startingBalance: a.startingBalance ?? 0,
      isOffBudget: a.offBudget ? 1 : 0,
      sortOrder: i,
      logo: DEMO_LOGOS[a.logo],
      createdAt: `${ymd(firstMonth)} 09:00:00`,
    });
  });

  // Payees
  for (const [key, [name, logo, defaultCategory]] of Object.entries(PAYEES)) {
    result.payees.push({
      id: `demo-payee-${key}`,
      name,
      logo: DEMO_LOGOS[logo],
      defaultCategoryId: defaultCategory ? cat[defaultCategory] : null,
      createdAt: `${ymd(firstMonth)} 09:00:00`,
    });
  }

  // ─── Transactions ────────────────────────────────────────────────────────────
  let txCount = 0;
  const nextTxId = () => `demo-tx-${String(++txCount).padStart(5, '0')}`;

  function add(t: {
    account: AccountKey;
    date: string;
    amount: number;
    payee?: PayeeKey;
    category?: CategoryKey | null;
    notes?: string;
    adjustment?: boolean;
  }): string {
    const id = nextTxId();
    const payee = t.payee ? PAYEES[t.payee] : null;
    result.transactions.push({
      id,
      accountId: acct[t.account],
      date: t.date,
      amount: t.amount,
      payeeId: t.payee ? `demo-payee-${t.payee}` : null,
      payeeName: payee?.[0] ?? null,
      // Everything except adjustments gets its payee's category unless told otherwise
      categoryId:
        t.category === null
          ? null
          : t.category
            ? cat[t.category]
            : payee?.[2] && !t.adjustment
              ? cat[payee[2]]
              : null,
      notes: t.notes ?? null,
      reconciled: t.date < reconciledBefore ? 1 : 0,
      importedPayee: payee?.[3] ?? null,
      isAdjustment: t.adjustment ? 1 : 0,
    });
    return id;
  }

  function transfer(
    from: AccountKey,
    to: AccountKey,
    date: string,
    amount: number,
    notes?: string,
  ) {
    const outId = nextTxId();
    const inId = nextTxId();
    const reconciled = date < reconciledBefore ? 1 : 0;
    result.transactions.push(
      {
        id: outId,
        accountId: acct[from],
        date,
        amount: -amount,
        payeeName: `Transfer: ${accountNames[to]}`,
        transferTransactionId: inId,
        notes: notes ?? null,
        reconciled,
      },
      {
        id: inId,
        accountId: acct[to],
        date,
        amount,
        payeeName: `Transfer: ${accountNames[from]}`,
        transferTransactionId: outId,
        notes: notes ?? null,
        reconciled,
      },
    );
    return outId;
  }

  function split(
    account: AccountKey,
    date: string,
    payee: PayeeKey,
    parts: [CategoryKey, number][],
    notes?: string,
  ) {
    const parentId = nextTxId();
    const total = parts.reduce((s, [, a]) => s + a, 0);
    const [name, , , imported] = PAYEES[payee];
    const reconciled = date < reconciledBefore ? 1 : 0;
    const base = {
      accountId: acct[account],
      date,
      payeeId: `demo-payee-${payee}`,
      payeeName: name,
      importedPayee: imported,
      reconciled,
    };
    result.transactions.push({
      ...base,
      id: parentId,
      amount: total,
      isParent: 1,
      notes: notes ?? null,
    });
    for (const [category, amount] of parts) {
      result.transactions.push({
        ...base,
        id: nextTxId(),
        amount,
        categoryId: cat[category],
        parentTransactionId: parentId,
      });
    }
  }

  // ─── Recurring bills and paychecks (schedules) ──────────────────────────────
  interface ScheduleSpec {
    key: string;
    name: string;
    payee?: PayeeKey;
    account: AccountKey;
    transferTo?: AccountKey;
    category?: CategoryKey;
    amount: number;
    amountType?: 'exact' | 'approximate' | 'variable';
    type: RecurrenceType;
    /** First occurrence */
    start: string;
    rule?: RecurrenceRule;
    end?: string;
    status?: 'active' | 'paused' | 'canceled';
    weekendAdjust?: 'none' | 'before' | 'after';
    /** The amount paid on a given occurrence (defaults to `amount`) */
    paid?: (date: string, index: number) => number;
    /** Occurrences the couple skipped */
    skipped?: (date: string) => boolean;
    /** Paid, but not yet linked to its occurrence: the Recurring page suggests the match */
    unlinked?: (date: string) => boolean;
    notes?: string;
  }

  const start = ymd(firstMonth);
  const monthlyOn = (day: number) =>
    ymd(new Date(firstMonth.getFullYear(), firstMonth.getMonth(), day));
  // The first Friday of the history, for Riley's fortnightly pay
  const firstFriday = addDays(firstMonth, (5 - getDay(firstMonth) + 7) % 7);
  const raiseDate = ymd(addMonths(firstMonth, 9));
  // The monthly donation falls due two days ago, so the Recurring page has one "due" item
  const donationDay = Math.min(subDays(today, 2).getDate(), 28);
  // Electric bills follow the seasons (more in winter and summer)
  const electric = (date: string) => {
    const m = parseISO(date).getMonth();
    const seasonal = [138, 126, 104, 82, 70, 88, 118, 124, 96, 76, 92, 128][m];
    return -Math.round((seasonal + (rand() * 10 - 5)) * 100);
  };

  const scheduleSpecs: ScheduleSpec[] = [
    {
      key: 'paycheckRiley',
      name: "Riley's pay",
      payee: 'brightwave',
      account: 'checking',
      amount: RILEY_PAY,
      amountType: 'approximate',
      type: 'biweekly',
      start: ymd(firstFriday),
      paid: (date) => (date < raiseDate ? RILEY_PAY_BEFORE_RAISE : RILEY_PAY),
    },
    {
      key: 'paycheckSam',
      name: "Sam's pay",
      payee: 'cedarHealth',
      account: 'checking',
      amount: SAM_PAY,
      type: 'biweekly',
      // The Thursday of the other week: one of them is paid every week
      start: ymd(addDays(firstFriday, 6)),
    },
    {
      key: 'rent',
      name: 'Rent',
      payee: 'mapleCourt',
      account: 'checking',
      amount: -RENT,
      type: 'biweekly',
      start: ymd(addDays(firstFriday, 3)),
    },
    {
      key: 'carPayment',
      name: 'Car loan',
      payee: 'northstar',
      account: 'checking',
      amount: -38_900,
      type: 'monthly',
      start: monthlyOn(20),
    },
    {
      key: 'electric',
      name: 'Electricity',
      payee: 'cityPower',
      account: 'checking',
      amount: -9_800,
      amountType: 'approximate',
      type: 'monthly',
      start: monthlyOn(18),
      paid: electric,
    },
    {
      key: 'internet',
      name: 'Internet',
      payee: 'loopFiber',
      account: 'card',
      amount: -6_500,
      type: 'monthly',
      start: monthlyOn(9),
    },
    {
      key: 'phone',
      name: 'Phone plan',
      payee: 'nimbus',
      account: 'card',
      amount: -9_000,
      type: 'monthly',
      start: monthlyOn(22),
    },
    {
      key: 'streamline',
      name: 'Streamline',
      payee: 'streamline',
      account: 'card',
      amount: -1_549,
      type: 'monthly',
      start: monthlyOn(5),
    },
    {
      key: 'flexplay',
      name: 'FlexPlay',
      payee: 'flexplay',
      account: 'card',
      amount: -1_199,
      type: 'monthly',
      start: monthlyOn(11),
      end: ymd(subMonths(today, 5)),
      status: 'canceled',
      notes: 'Canceled: we only watched one show',
    },
    {
      key: 'gym',
      name: 'Gym membership',
      payee: 'peakFitness',
      account: 'card',
      amount: -4_900,
      type: 'monthly',
      start: monthlyOn(3),
      // Paused for a month while Riley's knee healed
      skipped: (date) => date.slice(0, 7) === monthKey(subMonths(today, 7)),
    },
    {
      key: 'carInsurance',
      name: 'Car insurance',
      payee: 'shieldwell',
      account: 'card',
      amount: -14_200,
      type: 'monthly',
      start: monthlyOn(12),
    },
    {
      key: 'rentersInsurance',
      name: 'Contents insurance',
      payee: 'shieldwell',
      account: 'card',
      category: 'rentersInsurance',
      amount: -1_800,
      type: 'monthly',
      start: monthlyOn(26),
    },
    {
      key: 'savings',
      name: 'Move to savings',
      account: 'checking',
      transferTo: 'savings',
      amount: -90_000,
      type: 'monthly',
      start: monthlyOn(2),
    },
    {
      key: 'donation',
      name: 'Food bank donation',
      payee: 'kindred',
      account: 'checking',
      amount: -2_500,
      type: 'monthly',
      start: monthlyOn(donationDay),
      // The latest one came through the bank but isn't linked yet: Recurring asks to match it
      unlinked: (date) => date >= ymd(subDays(today, 5)),
    },
    {
      key: 'dogFood',
      name: "Biscuit's food",
      payee: 'happyPaws',
      account: 'card',
      amount: -5_800,
      amountType: 'approximate',
      type: 'weekly',
      start: ymd(addDays(firstMonth, 6)),
      rule: { type: 'weekly', interval: 4, anchorDay: getDay(addDays(firstMonth, 6)) },
      paid: () => -between(5_400, 6_300),
    },
  ];

  for (const spec of scheduleSpecs) {
    const scheduleId = `demo-schedule-${spec.key}`;
    const rule = spec.rule ?? buildRecurrenceRule(spec.type, spec.start);
    result.schedules.push({
      id: scheduleId,
      name: spec.name,
      amount: spec.amount,
      amountType: spec.amountType ?? 'exact',
      recurrenceType: spec.type,
      recurrenceRule: JSON.stringify(rule),
      startDate: spec.start,
      endDate: spec.end ?? null,
      weekendAdjust: spec.weekendAdjust ?? 'none',
      accountId: acct[spec.account],
      transferAccountId: spec.transferTo ? acct[spec.transferTo] : null,
      categoryId: spec.category
        ? cat[spec.category]
        : spec.payee && PAYEES[spec.payee][2]
          ? cat[PAYEES[spec.payee][2]!]
          : null,
      payeeId: spec.payee ? `demo-payee-${spec.payee}` : null,
      notes: spec.notes ?? null,
      status: spec.status ?? 'active',
      source: 'manual',
      // Canceled schedules get no occurrences; mark this one done so the server's startup
      // upgrade of old schedules doesn't create them
      occurrenceHorizon: spec.status === 'canceled' ? (spec.end ?? null) : null,
      createdAt: `${start} 09:00:00`,
      updatedAt: `${start} 09:00:00`,
    });

    const dates = computeOccurrenceDates(
      {
        startDate: spec.start,
        endDate: spec.end ?? null,
        recurrenceType: spec.type,
        recurrenceRule: rule,
        weekendAdjust: spec.weekendAdjust ?? 'none',
      },
      spec.start,
      todayStr,
    );
    dates.forEach(({ scheduledDate, expectedDate }, i) => {
      if (spec.skipped?.(expectedDate)) {
        result.scheduleLinks.push({ scheduleId, scheduledDate, transactionId: null });
        return;
      }
      const amount = spec.paid?.(expectedDate, i) ?? spec.amount;
      const transactionId = spec.transferTo
        ? transfer(spec.account, spec.transferTo, expectedDate, -amount, 'Monthly savings')
        : add({
            account: spec.account,
            date: expectedDate,
            amount,
            payee: spec.payee,
            category: spec.category,
          });
      // A canceled schedule has no occurrences left to link
      if (spec.status !== 'canceled' && !spec.unlinked?.(expectedDate)) {
        result.scheduleLinks.push({ scheduleId, scheduledDate, transactionId });
      }
    });
  }

  // The music subscription was never added as recurring: "Find recurring" spots it
  for (const m of monthStarts) {
    const date = dayIn(m, 14);
    if (date) add({ account: 'card', date, amount: -1_699, payee: 'tuneful' });
  }

  // ─── Everyday spending ──────────────────────────────────────────────────────
  monthStarts.forEach((m, mi) => {
    const days = lastDayOfMonth(m).getDate();
    const on = (day: number) => dayIn(m, day);
    const isDecember = m.getMonth() === 11;

    // Groceries: a big weekly shop, small top-ups, and a monthly warehouse run (split)
    for (let day = 1 + ((6 - getDay(m) + 7) % 7); day <= days; day += 7) {
      const date = on(day);
      if (date)
        add({ account: 'card', date, amount: -between(8_600, 15_800), payee: 'freshFields' });
    }
    for (const day of [between(3, 13), between(16, 27)]) {
      const date = on(day);
      if (date)
        add({ account: 'checking', date, amount: -between(1_150, 3_400), payee: 'cornerGrocer' });
    }
    const warehouse = on(between(8, 14));
    if (warehouse) {
      const food = between(12_000, 16_500);
      const home = between(4_500, 8_500);
      split('card', warehouse, 'costwise', [
        ['groceries', -food],
        ['homeGoods', -home],
      ]);
    }

    // Eating out
    for (let i = 0; i < 7; i++) {
      const date = on(between(1, days));
      if (date) add({ account: 'card', date, amount: -between(475, 1_250), payee: 'dailyGrind' });
    }
    for (let i = 0; i < 4; i++) {
      const date = on(between(1, days));
      if (!date) continue;
      const payee = pick(['luigis', 'tacoLuna', 'sakura', 'burgerBarn'] as const);
      const range = payee === 'luigis' || payee === 'sakura' ? [5_200, 9_600] : [2_200, 4_800];
      add({ account: 'card', date, amount: -between(range[0], range[1]), payee });
    }
    if (mi === 4) {
      const date = on(21);
      if (date)
        add({
          account: 'card',
          date,
          amount: -14_860,
          payee: 'luigis',
          notes: 'Anniversary dinner',
        });
    }

    // This month they went out for a birthday dinner they hadn't planned for, so by the end
    // of the month flexible spending is a little over (the demo shows an overspent budget)
    if (mi === monthStarts.length - 1) {
      const date = on(4);
      if (date)
        add({
          account: 'card',
          date,
          amount: -11_860,
          payee: 'sakura',
          notes: "Sam's birthday dinner",
        });
    }

    // Last month was an expensive one early on: a weekend away and new tyres, so the
    // dashboard's "this month vs. last month" spending lines pull clearly apart
    if (mi === monthStarts.length - 2) {
      const flights = on(5);
      if (flights)
        add({
          account: 'card',
          date: flights,
          amount: -38_960,
          payee: 'skyhop',
          notes: 'Flights for the weekend away',
        });
      const hotel = on(7);
      if (hotel)
        add({
          account: 'card',
          date: hotel,
          amount: -48_620,
          payee: 'lakesideInn',
          notes: 'Weekend away',
        });
      const tyres = on(10);
      if (tyres)
        add({
          account: 'card',
          date: tyres,
          amount: -61_240,
          payee: 'quickLube',
          notes: 'New tyres',
        });
    }

    // Car
    for (const day of [between(2, 9), between(12, 19), between(22, 28)]) {
      const date = on(day);
      if (date) add({ account: 'card', date, amount: -between(3_600, 5_000), payee: 'fuelStop' });
    }
    if (mi % 4 === 1) {
      const date = on(between(5, 25));
      if (date)
        add({ account: 'card', date, amount: -6_999, payee: 'quickLube', notes: 'Oil change' });
    }
    if (mi === 8) {
      const date = on(16);
      if (date)
        add({
          account: 'card',
          date,
          amount: -61_240,
          payee: 'quickLube',
          notes: 'Four new tyres + alignment',
        });
    }

    // Opal top-ups for the train, and the car's rego and CTP once a year
    for (const day of [between(1, 7), between(8, 14), between(15, 21), between(22, 28)]) {
      const date = on(day);
      if (date) add({ account: 'checking', date, amount: -between(2_000, 4_000), payee: 'opal' });
    }
    if (mi % 12 === 7) {
      const date = on(between(10, 20));
      if (date)
        add({
          account: 'checking',
          date,
          amount: -84_250,
          payee: 'registry',
          notes: 'Rego and CTP for the year',
        });
    }

    // Health
    {
      const date = on(between(4, 26));
      if (date) add({ account: 'card', date, amount: -between(1_200, 3_900), payee: 'wellway' });
    }
    if (mi % 3 === 2) {
      const date = on(between(6, 24));
      if (date)
        add({ account: 'checking', date, amount: -3_500, payee: 'riverside', notes: 'Gap fee' });
    }

    // Shopping and lifestyle
    if (mi % 2 === 0 || isDecember) {
      const date = on(between(3, 27));
      if (date)
        add({ account: 'card', date, amount: -between(3_800, 14_500), payee: 'threadline' });
    }
    if (mi % 3 === 1) {
      const date = on(between(3, 27));
      if (date)
        add({ account: 'card', date, amount: -between(2_400, 11_800), payee: 'hearthHome' });
    }
    {
      const date = on(between(8, 20));
      if (date) add({ account: 'card', date, amount: -between(1_800, 4_400), payee: 'glow' });
    }
    {
      const date = on(between(5, 26));
      if (date) add({ account: 'card', date, amount: -between(2_600, 3_400), payee: 'cineplex' });
    }
    for (const [day, category] of [
      [between(2, 14), pick(['homeGoods', 'electronics', 'personalCare'] as const)],
      [between(15, 28), pick(['homeGoods', 'pets', 'electronics'] as const)],
    ] as const) {
      const date = on(day);
      if (date)
        add({ account: 'card', date, amount: -between(1_500, 6_200), payee: 'parcel', category });
    }
    if (isDecember) {
      for (const day of [4, 9, 13, 17]) {
        const date = on(day);
        if (date)
          add({
            account: 'card',
            date,
            amount: -between(3_500, 9_500),
            payee: pick(['parcel', 'threadline', 'hearthHome'] as const),
            category: 'gifts',
            notes: 'Christmas gifts',
          });
      }
    }
    if (mi === 6 || mi === 13) {
      const date = on(between(8, 20));
      if (date)
        add({
          account: 'card',
          date,
          amount: -between(4_500, 7_500),
          payee: 'parcel',
          category: 'gifts',
          notes: 'Birthday gift for Mum',
        });
    }
    if (mi === 3) {
      const date = on(11);
      if (date)
        add({
          account: 'card',
          date,
          amount: -18_500,
          payee: 'oakwoodVet',
          notes: "Biscuit's checkup and shots",
        });
    }
    if (mi === 15) {
      const date = on(18);
      if (date)
        add({
          account: 'card',
          date,
          amount: -21_300,
          payee: 'oakwoodVet',
          notes: "Biscuit's yearly checkup",
        });
    }

    // Savings account interest (4.1% APY on a growing balance)
    {
      const date = on(days);
      if (date) {
        const balance = 480_000 + mi * 92_000;
        add({
          account: 'savings',
          date,
          amount: Math.round((balance * 0.041) / 12),
          payee: 'harbor',
        });
      }
    }
  });

  // The trip they took, paid for from the Vacation category they'd saved in
  const tripMonth = subMonths(today, 5);
  add({
    account: 'card',
    date: ymd(new Date(tripMonth.getFullYear(), tripMonth.getMonth() - 2, 14)),
    amount: -48_620,
    payee: 'skyhop',
    notes: 'Flights to the coast (2)',
  });
  // The trip was up the coast: money moved to the Holiday saver beforehand, the hotel and a
  // dinner paid from it
  transfer(
    'checking',
    'holiday',
    ymd(new Date(tripMonth.getFullYear(), tripMonth.getMonth() - 1, 20)),
    80_000,
    'For the trip',
  );
  add({
    account: 'holiday',
    date: ymd(new Date(tripMonth.getFullYear(), tripMonth.getMonth(), 9)),
    amount: -64_400,
    payee: 'lakesideInn',
    notes: '4 nights, ocean view',
  });
  add({
    account: 'holiday',
    date: ymd(new Date(tripMonth.getFullYear(), tripMonth.getMonth(), 10)),
    amount: -9_050,
    payee: 'sakura',
    category: 'vacation',
    notes: 'Trip dinner',
  });

  // A laptop they saved up for (the finished goal)
  add({
    account: 'card',
    date: ymd(new Date(today.getFullYear(), today.getMonth() - 2, 6)),
    amount: -129_900,
    payee: 'parcel',
    category: 'electronics',
    notes: 'New laptop for Sam',
  });

  // One recent purchase still waiting for a category, for the tour to sort
  add({
    account: 'card',
    date: ymd(subDays(today, 1)),
    amount: -2_349,
    payee: 'parcel',
    category: null,
  });
  add({
    account: 'checking',
    date: ymd(subDays(today, 3)),
    amount: -6_420,
    payee: 'hearthHome',
  });

  // The opening deposit: money they had when they started budgeting
  add({
    account: 'checking',
    date: start,
    amount: 520_000,
    payee: 'harbor',
    category: 'otherIncome',
    notes: 'Opening balance',
  });
  add({
    account: 'card',
    date: start,
    amount: 600_000,
    payee: 'harbor',
    category: 'otherIncome',
    notes: 'Opening balance',
  });
  add({
    account: 'savings',
    date: start,
    amount: 480_000,
    payee: 'harbor',
    category: 'otherIncome',
    notes: 'Opening balance',
  });

  // ─── 2Up top-ups: on the 1st, Spending covers what the shared account spent last month ──
  const sharedSpending = (month: string) =>
    result.transactions
      .filter(
        (t) =>
          t.accountId === acct.card &&
          !t.transferTransactionId &&
          !t.parentTransactionId &&
          t.date.startsWith(month),
      )
      .reduce((s, t) => s + t.amount, 0);
  monthStarts.slice(1).forEach((m) => {
    const date = dayIn(m, 1);
    const spent = -sharedSpending(monthKey(subMonths(m, 1)));
    if (!date || spent <= 0) return;
    transfer('checking', 'card', date, spent, 'Top up 2Up');
  });

  // ─── Accounts that change value: super, shares, car loan, the car ───────
  let retirement = 1_842_000;
  let brokerage = 615_000;
  let loan = -1_795_000;
  monthStarts.forEach((m, mi) => {
    const date = dayIn(m, lastDayOfMonth(m).getDate());
    if (!date) return;
    // Payroll contributions plus the market's ups and downs
    const retirementChange = 61_000 + Math.round(retirement * (0.006 + (rand() - 0.45) * 0.045));
    retirement += retirementChange;
    add({
      account: 'retirement',
      date,
      amount: retirementChange,
      payee: 'evergreen',
      notes: 'Value update',
      adjustment: true,
    });
    const brokerageChange = 15_000 + Math.round(brokerage * (0.005 + (rand() - 0.45) * 0.05));
    brokerage += brokerageChange;
    add({
      account: 'brokerage',
      date,
      amount: brokerageChange,
      payee: 'pinecone',
      notes: 'Value update',
      adjustment: true,
    });
    // The principal part of each payment (the rest is interest)
    const principal = 38_900 - Math.round((-loan * 0.059) / 12);
    loan += principal;
    add({
      account: 'carLoan',
      date,
      amount: principal,
      payee: 'northstar',
      notes: 'Balance update',
      adjustment: true,
    });
    if (mi % 3 === 2)
      add({
        account: 'car',
        date,
        amount: -between(38_000, 52_000),
        notes: 'Value update',
        adjustment: true,
      });
  });

  // ─── The budget: what they planned for each category, month by month ───────
  // Fixed bills get exactly their amount; everything else gets its typical monthly
  // spending, rounded up, so balances stay small and positive. Whatever's left each month
  // goes to savings goals, keeping next month's budget funded ("living on last month's
  // income"), so this month's To Be Budgeted is a small, tidy number.
  const spending = new Map<string, number>();
  const income = new Map<string, number>();
  const onBudget = new Set([acct.checking, acct.savings, acct.holiday, acct.card]);
  const incomeCats = new Set(
    ['paychecks', 'interest', 'otherIncome'].map((k) => cat[k as CategoryKey]),
  );
  for (const t of result.transactions) {
    if (!t.categoryId || !onBudget.has(t.accountId) || t.isParent) continue;
    const month = t.date.slice(0, 7);
    const value = t.amount;
    if (incomeCats.has(t.categoryId)) {
      income.set(month, (income.get(month) ?? 0) + value);
    } else {
      spending.set(
        `${t.categoryId}|${month}`,
        (spending.get(`${t.categoryId}|${month}`) ?? 0) - value,
      );
    }
  }
  const fullMonths = monthStarts.slice(1, -1).map(monthKey);
  const lastFullMonth = fullMonths[fullMonths.length - 1];
  const plan = new Map<string, number>();
  for (const c of result.categories) {
    if (incomeCats.has(c.id)) continue;
    const key = c.id.replace('demo-cat-', '') as CategoryKey;
    const total = fullMonths.reduce((s, month) => s + (spending.get(`${c.id}|${month}`) ?? 0), 0);
    // A fixed bill is planned at what it costs now (the electric bill changes with the
    // seasons, so it gets its average like everything else), rounded up to the dollar;
    // others at their average, rounded up to $5
    const fixed = budgetTypes[key] === 'fixed' && key !== 'electric' && key !== 'rent';
    const amount = fixed
      ? (spending.get(`${c.id}|${lastFullMonth}`) ?? 0)
      : total / fullMonths.length;
    const step = fixed ? 100 : 500;
    plan.set(c.id, Math.ceil(amount / step) * step);
  }
  // The electric bill is planned at its most expensive month plus a little, rounded to $5,
  // so it's never short: in milder months some of it is left over (the dashboard's Fixed
  // bar shows a sliver still to spend)
  const electricMax = Math.max(
    ...fullMonths.map((month) => spending.get(`${cat.electric}|${month}`) ?? 0),
  );
  plan.set(cat.electric, Math.ceil((electricMax + 2_500) / 500) * 500);
  // Rent is paid fortnightly, so some months have three payments: it's planned for those,
  // and the two-payment months leave a fortnight's rent waiting
  plan.set(cat.rent, 3 * RENT);
  plan.set(cat.vacation, 25_000);
  plan.set(cat.electronics, Math.max(plan.get(cat.electronics) ?? 0, 15_000));
  plan.set(cat.emergencyFund, 0);
  const planTotal = [...plan.values()].reduce((s, v) => s + v, 0);

  // What's left unassigned at the end of each month, so the budget opens on a small positive
  // Ready to assign rather than exactly zero
  const BUFFER = 30_000;
  /** How many fortnightly rent payments fall in a month */
  const rentStart = addDays(firstFriday, 3);
  const rentDue = (month: string) => {
    let n = 0;
    for (let d = rentStart; monthKey(d) <= month; d = addDays(d, 14))
      if (monthKey(d) === month) n++;
    return n;
  };
  /** Each category's balance carried into the month being planned */
  const balances = new Map<string, number>();
  let carry = 0;
  monthStarts.forEach((m) => {
    const month = monthKey(m);
    const available = carry + (income.get(month) ?? 0);
    const isCurrent = month === currentMonth;

    // Each category gets its plan, or more when a dearer month would otherwise take it below
    // zero: the app counts an overspent envelope against Ready to assign, and the demo opens
    // on a budget with nothing overspent
    const assigned = new Map<string, number>();
    for (const [categoryId, planned] of plan) {
      // Rent and power are planned at what the month needs, so their envelopes don't pile up:
      // rent for the fortnights that fall in it, power for the bill (its average this month)
      const amount =
        categoryId === cat.rent
          ? rentDue(month) * RENT
          : categoryId === cat.electric && !isCurrent
            ? Math.ceil((spending.get(`${categoryId}|${month}`) ?? 0) / 500) * 500
            : planned;
      const before = balances.get(categoryId) ?? 0;
      const spent = spending.get(`${categoryId}|${month}`) ?? 0;
      const budgeted = Math.max(amount, Math.ceil((spent - before) / 100) * 100);
      assigned.set(categoryId, budgeted);
    }
    const assignedTotal = [...assigned.values()].reduce((a, b) => a + b, 0);

    // They budget a month ahead: each month is funded by the month before, and what's left
    // after keeping next month's plan (and a small buffer) in reserve goes to the emergency
    // fund. This month's pay is for next month, so it waits in Ready to assign.
    const extra = isCurrent ? 0 : Math.max(0, available - assignedTotal - planTotal - BUFFER);
    assigned.set(cat.emergencyFund, (assigned.get(cat.emergencyFund) ?? 0) + extra);

    // Income is planned too: the pay they expect, fortnightly averaged over the month
    const riley = Math.round(
      ((m < parseISO(raiseDate) ? RILEY_PAY_BEFORE_RAISE : RILEY_PAY) * 26) / 12,
    );
    result.budgetMonths.push(
      {
        id: `demo-budget-${month}-${cat.paychecks}`,
        month,
        categoryId: cat.paychecks,
        budgeted: Math.round((riley + (SAM_PAY * 26) / 12) / 100) * 100,
      },
      {
        id: `demo-budget-${month}-${cat.interest}`,
        month,
        categoryId: cat.interest,
        budgeted: 5_000,
      },
    );

    for (const [categoryId, budgeted] of assigned) {
      const spent = spending.get(`${categoryId}|${month}`) ?? 0;
      balances.set(categoryId, (balances.get(categoryId) ?? 0) + budgeted - spent);
      if (budgeted === 0) continue;
      result.budgetMonths.push({
        id: `demo-budget-${month}-${categoryId}`,
        month,
        categoryId,
        budgeted,
      });
    }
    carry = available - assignedTotal - extra;
  });

  // ─── Rules ───────────────────────────────────────────────────────────────────
  const addRule = (
    conditions: Condition[],
    actions: Action[],
    opts: { op?: 'and' | 'or'; enabled?: boolean } = {},
  ) =>
    result.rules.push({
      id: `demo-rule-${result.rules.length + 1}`,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      conditionsOp: opts.op ?? 'and',
      enabled: opts.enabled === false ? 0 : 1,
      sortOrder: result.rules.length,
      createdAt: `${start} 09:00:00`,
    });
  addRule(
    [{ field: 'imported_payee', op: 'contains', value: 'DAILY GRIND' }],
    [
      { type: 'set_payee', value: 'demo-payee-dailyGrind' },
      { type: 'set_category', value: cat.coffee },
    ],
  );
  addRule(
    [{ field: 'imported_payee', op: 'starts_with', value: 'FRESH FIELDS' }],
    [{ type: 'set_payee', value: 'demo-payee-freshFields' }],
  );
  addRule(
    [
      {
        field: 'payee',
        op: 'one_of',
        value: [
          'demo-payee-luigis',
          'demo-payee-tacoLuna',
          'demo-payee-sakura',
          'demo-payee-burgerBarn',
        ],
      },
    ],
    [{ type: 'set_category', value: cat.restaurants }],
  );
  addRule(
    [{ field: 'payee', op: 'is', value: 'demo-payee-costwise' }],
    [
      {
        type: 'split',
        parts: [
          { kind: 'percent', value: 70, categoryId: cat.groceries, notes: null },
          { kind: 'remainder', value: 0, categoryId: cat.homeGoods, notes: 'Household' },
        ],
      },
    ],
  );
  addRule(
    [
      { field: 'payee', op: 'is', value: 'demo-payee-northstar' },
      { field: 'amount', op: 'approx', value: 38_900 },
    ],
    [
      { type: 'set_category', value: cat.carPayment },
      { type: 'append_notes', value: 'Auto loan' },
    ],
  );
  addRule(
    [
      { field: 'notes', op: 'contains', value: 'gift' },
      { field: 'imported_payee', op: 'contains', value: 'GIFT' },
    ],
    [{ type: 'set_category', value: cat.gifts }],
    { op: 'or' },
  );
  addRule(
    [
      { field: 'direction', op: 'is', value: 'outflow' },
      { field: 'amount', op: 'gt', value: 50_000 },
      { field: 'category', op: 'is_empty' },
    ],
    [{ type: 'prepend_notes', value: 'Big purchase: ' }],
    { enabled: false },
  );

  // ─── Goals ───────────────────────────────────────────────────────────────────
  // The trip goal shows what's set aside in the Vacation category
  const vacationSaved =
    result.budgetMonths
      .filter((b) => b.categoryId === cat.vacation)
      .reduce((sum, b) => sum + (b.budgeted ?? 0), 0) -
    [...spending].reduce((sum, [k, v]) => (k.startsWith(`${cat.vacation}|`) ? sum + v : sum), 0);

  const savingsBalance = result.transactions
    .filter((t) => t.accountId === acct.savings)
    .reduce((s, t) => s + t.amount, 0);
  result.goals.push(
    {
      id: 'demo-goal-emergency',
      name: 'Emergency fund',
      targetAmount: 2_500_000,
      currentAmount: savingsBalance,
      accountId: acct.savings,
      icon: 'LifeBuoy',
      color: '#059669',
      sortOrder: 0,
    },
    {
      id: 'demo-goal-trip',
      name: 'Anniversary trip to Tasmania',
      targetAmount: 450_000,
      currentAmount: vacationSaved,
      targetDate: ymd(lastDayOfMonth(addMonths(today, 7))),
      // Saved in the Holidays envelope, so the dashboard counts it as set aside
      categoryId: cat.vacation,
      icon: 'Plane',
      color: '#0EA5E9',
      sortOrder: 1,
    },
    {
      id: 'demo-goal-laptop',
      name: 'New laptop',
      targetAmount: 130_000,
      currentAmount: 130_000,
      targetDate: ymd(new Date(today.getFullYear(), today.getMonth() - 2, 6)),
      icon: 'Laptop',
      color: '#7C3AED',
      sortOrder: 2,
    },
  );

  // ─── Reports: two dashboards and three saved custom reports ─────────────────
  const range = (preset: string, months: number) => ({
    preset,
    from: monthKey(subMonths(today, months - 1)),
    to: currentMonth,
  });
  const noFilters = { accountIds: [], categoryIds: [], categoryGroupIds: [] };
  const report = (key: string, name: string, config: object, sortOrder: number) =>
    result.customReports.push({
      id: `demo-report-${key}`,
      name,
      config: JSON.stringify({ ...config, filters: noFilters }),
      sortOrder,
      createdAt: `${start} 09:00:00`,
      updatedAt: `${start} 09:00:00`,
    });
  report(
    'whereItGoes',
    'Where the money goes',
    {
      chartType: 'donut',
      mode: 'total',
      groupBy: 'categoryGroup',
      balanceType: 'expense',
      dateRange: range('3m', 3),
    },
    0,
  );
  report(
    'monthlyGroups',
    'Spending by group, month by month',
    {
      chartType: 'stacked-bar',
      mode: 'time',
      groupBy: 'categoryGroup',
      balanceType: 'expense',
      dateRange: range('6m', 6),
    },
    1,
  );
  report(
    'topPayees',
    'Top places we spend',
    {
      chartType: 'bar',
      mode: 'total',
      groupBy: 'payee',
      balanceType: 'expense',
      dateRange: range('3m', 3),
    },
    2,
  );

  result.dashboardPages.push(
    {
      id: 'demo-dash-overview',
      name: 'Overview',
      sortOrder: 0,
      dateRange: JSON.stringify(range('6m', 6)),
    },
    {
      id: 'demo-dash-year',
      name: 'Year in review',
      sortOrder: 1,
      dateRange: JSON.stringify(range('12m', 12)),
    },
  );
  const widget = (
    page: string,
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    extra: { reportId?: string; meta?: object } = {},
  ) =>
    result.dashboardWidgets.push({
      id: `demo-widget-${result.dashboardWidgets.length + 1}`,
      pageId: `demo-dash-${page}`,
      type,
      customReportId: extra.reportId ?? null,
      x,
      y,
      width,
      height,
      meta: JSON.stringify(extra.meta ?? {}),
    });
  widget('overview', 'summary', 0, 0, 12, 1);
  widget('overview', 'net-worth', 0, 1, 6, 4);
  widget('overview', 'income-expenses', 6, 1, 6, 4);
  widget('overview', 'spending', 0, 5, 6, 4);
  widget('overview', 'custom-report', 6, 5, 6, 4, { reportId: 'demo-report-whereItGoes' });
  widget('overview', 'spending-trends', 0, 9, 6, 4, {
    meta: { categoryIds: [cat.groceries, cat.restaurants, cat.gas, cat.coffee] },
  });
  widget('overview', 'calendar', 6, 9, 6, 4, { meta: { dateRange: range('1m', 1) } });
  widget('year', 'net-worth', 0, 0, 12, 4, { meta: { name: 'Net worth this year' } });
  widget('year', 'custom-report', 0, 4, 6, 4, { reportId: 'demo-report-monthlyGroups' });
  widget('year', 'custom-report', 6, 4, 6, 4, { reportId: 'demo-report-topPayees' });
  widget('year', 'calendar', 0, 8, 12, 4, { meta: { name: 'Every day this year' } });

  const notedAt = today.toISOString();
  result.budgetMonthNotes.push({
    month: currentMonth,
    note: 'Rego is due soon: keep Rego & CTP topped up.',
    updatedAt: notedAt,
  });
  result.categoryNotes.push({
    categoryId: cat.groceries,
    note: 'The warehouse run is split with the household.',
    updatedAt: notedAt,
  });

  // Investments: 50 units bought over two years ago and 30 last year; 20 of the first sold two
  // months ago (held over 12 months, so the discount applies). Units are millionths.
  const units = (n: number) => n * 1_000_000;
  result.securities.push({
    id: 'demo-security-gum',
    symbol: 'GUM',
    name: 'Gumtree Australian Shares ETF',
    kind: 'etf',
    currency: BUDGET_CURRENCY,
  });
  result.securityPrices.push(
    { securityId: 'demo-security-gum', date: ymd(subMonths(today, 1)), price: 9_980 },
    { securityId: 'demo-security-gum', date: todayStr, price: 10_250 },
  );
  result.holdings.push({
    id: 'demo-holding-gum',
    accountId: 'demo-acct-brokerage',
    securityId: 'demo-security-gum',
    quantity: units(60),
  });
  result.taxLots.push(
    {
      id: 'demo-lot-gum-first',
      holdingId: 'demo-holding-gum',
      acquiredOn: ymd(subMonths(today, 26)),
      quantity: units(50),
      costBasis: 400_000,
    },
    {
      id: 'demo-lot-gum-second',
      holdingId: 'demo-holding-gum',
      acquiredOn: ymd(subMonths(today, 7)),
      quantity: units(30),
      costBasis: 285_000,
    },
  );
  result.investmentSales.push({
    id: 'demo-sale-gum',
    holdingId: 'demo-holding-gum',
    soldOn: ymd(subMonths(today, 2)),
    quantity: units(20),
    proceeds: 196_000,
    fees: 950,
  });
  result.investmentSaleParcels.push({
    saleId: 'demo-sale-gum',
    lotId: 'demo-lot-gum-first',
    quantity: units(20),
  });
  return result;
}
