import { count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './index.js';
import { categoryGroups, categories, transactions } from './schema.js';

type BudgetType = 'fixed' | 'flexible' | 'non_monthly' | 'savings';

const defaultGroups: {
  name: string;
  isIncome: number;
  categories: { name: string; icon: string; budgetType?: BudgetType }[];
}[] = [
  {
    name: 'Income',
    isIncome: 1,
    categories: [
      { name: 'Paychecks', icon: 'Banknote' },
      { name: 'Interest', icon: 'Percent' },
      { name: 'Business Income', icon: 'Briefcase' },
      { name: 'Other Income', icon: 'Coins' },
    ],
  },
  {
    name: 'Gifts & Donations',
    isIncome: 0,
    categories: [
      { name: 'Charity', icon: 'Heart', budgetType: 'flexible' },
      { name: 'Gifts', icon: 'Gift', budgetType: 'flexible' },
      { name: 'Donations', icon: 'HeartHandshake', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Transportation',
    isIncome: 0,
    categories: [
      { name: 'Gas / Fuel', icon: 'Fuel', budgetType: 'flexible' },
      { name: 'Car Payment', icon: 'Car', budgetType: 'fixed' },
      { name: 'Car Insurance', icon: 'Shield', budgetType: 'fixed' },
      { name: 'Parking', icon: 'CircleParking', budgetType: 'flexible' },
      { name: 'Public Transit', icon: 'Bus', budgetType: 'flexible' },
      { name: 'Ride Share', icon: 'CarTaxiFront', budgetType: 'flexible' },
      { name: 'Car Maintenance', icon: 'Wrench', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Housing',
    isIncome: 0,
    categories: [
      { name: 'Rent / Mortgage', icon: 'House', budgetType: 'fixed' },
      { name: 'Home Insurance', icon: 'Shield', budgetType: 'fixed' },
      { name: 'Property Tax', icon: 'Building2', budgetType: 'fixed' },
      { name: 'HOA Fees', icon: 'Building', budgetType: 'fixed' },
      { name: 'Home Maintenance', icon: 'Hammer', budgetType: 'flexible' },
      { name: 'Home Improvement', icon: 'Palette', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Bills & Utilities',
    isIncome: 0,
    categories: [
      { name: 'Electric', icon: 'Zap', budgetType: 'fixed' },
      { name: 'Water', icon: 'Droplet', budgetType: 'fixed' },
      { name: 'Gas (Natural)', icon: 'Flame', budgetType: 'fixed' },
      { name: 'Internet', icon: 'Wifi', budgetType: 'fixed' },
      { name: 'Phone', icon: 'Smartphone', budgetType: 'fixed' },
      { name: 'Trash / Recycling', icon: 'Recycle', budgetType: 'fixed' },
      { name: 'Streaming Services', icon: 'Tv', budgetType: 'fixed' },
    ],
  },
  {
    name: 'Food & Dining',
    isIncome: 0,
    categories: [
      { name: 'Groceries', icon: 'ShoppingCart', budgetType: 'flexible' },
      { name: 'Restaurants', icon: 'UtensilsCrossed', budgetType: 'flexible' },
      { name: 'Coffee Shops', icon: 'Coffee', budgetType: 'flexible' },
      { name: 'Fast Food', icon: 'Sandwich', budgetType: 'flexible' },
      { name: 'Alcohol / Bars', icon: 'Wine', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Travel & Lifestyle',
    isIncome: 0,
    categories: [
      { name: 'Flights', icon: 'Plane', budgetType: 'non_monthly' },
      { name: 'Hotels', icon: 'Hotel', budgetType: 'non_monthly' },
      { name: 'Vacation', icon: 'Palmtree', budgetType: 'non_monthly' },
      { name: 'Entertainment', icon: 'Clapperboard', budgetType: 'non_monthly' },
      { name: 'Hobbies', icon: 'Palette', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Shopping',
    isIncome: 0,
    categories: [
      { name: 'Clothing', icon: 'Shirt', budgetType: 'flexible' },
      { name: 'Electronics', icon: 'Laptop', budgetType: 'flexible' },
      { name: 'Home Goods', icon: 'Sofa', budgetType: 'flexible' },
      { name: 'Personal Care', icon: 'Sparkles', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Family',
    isIncome: 0,
    categories: [
      { name: 'Childcare / Daycare', icon: 'Baby', budgetType: 'fixed' },
      { name: 'Kids Activities', icon: 'Clapperboard', budgetType: 'flexible' },
      { name: 'School Supplies', icon: 'Backpack', budgetType: 'flexible' },
      { name: 'Baby Supplies', icon: 'Milk', budgetType: 'flexible' },
      { name: 'Allowance', icon: 'PiggyBank', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Education',
    isIncome: 0,
    categories: [
      { name: 'Tuition', icon: 'GraduationCap', budgetType: 'fixed' },
      { name: 'Books & Supplies', icon: 'BookOpen', budgetType: 'non_monthly' },
      { name: 'Student Loans', icon: 'ScrollText', budgetType: 'fixed' },
      { name: 'Online Courses', icon: 'Laptop', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Health & Wellness',
    isIncome: 0,
    categories: [
      { name: 'Doctor / Medical', icon: 'Stethoscope', budgetType: 'non_monthly' },
      { name: 'Dentist', icon: 'Smile', budgetType: 'non_monthly' },
      { name: 'Pharmacy', icon: 'Pill', budgetType: 'flexible' },
      { name: 'Gym / Fitness', icon: 'Dumbbell', budgetType: 'flexible' },
      { name: 'Mental Health', icon: 'Brain', budgetType: 'non_monthly' },
      { name: 'Vision / Eye Care', icon: 'Glasses', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Financial',
    isIncome: 0,
    categories: [
      { name: 'Savings', icon: 'PiggyBank', budgetType: 'savings' },
      { name: 'Investments', icon: 'TrendingUp', budgetType: 'non_monthly' },
      { name: 'Loan Payment', icon: 'Landmark', budgetType: 'fixed' },
      { name: 'Bank Fees', icon: 'Receipt', budgetType: 'fixed' },
    ],
  },
  {
    name: 'Business',
    isIncome: 0,
    categories: [
      { name: 'Office Supplies', icon: 'Paperclip', budgetType: 'flexible' },
      { name: 'Software / Tools', icon: 'Settings', budgetType: 'flexible' },
      { name: 'Marketing', icon: 'Megaphone', budgetType: 'flexible' },
      { name: 'Professional Services', icon: 'Briefcase', budgetType: 'flexible' },
      { name: 'Business Travel', icon: 'Luggage', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Other',
    isIncome: 0,
    categories: [
      { name: 'Miscellaneous', icon: 'Folder', budgetType: 'flexible' },
      { name: 'Cash / ATM', icon: 'Banknote', budgetType: 'flexible' },
      { name: 'Other', icon: 'Tag', budgetType: 'flexible' },
    ],
  },
];

/**
 * Australian households, kept short (about 20 envelopes): rent or a mortgage, rates and strata,
 * home and garden (Kmart, Bunnings),
 * rego and CTP, private health. Afterpay and Zip are accounts with payment plans
 * (docs/PAYMENT-PLANS.md), not a spending category. Icons are Lucide icon names.
 */
const australianGroups: typeof defaultGroups = [
  {
    name: 'Income',
    isIncome: 1,
    categories: [
      { name: 'Pay', icon: 'Banknote' },
      { name: 'Interest', icon: 'Percent' },
      { name: 'Other Income', icon: 'Coins' },
    ],
  },
  {
    name: 'Home',
    isIncome: 0,
    categories: [
      { name: 'Rent', icon: 'House', budgetType: 'fixed' },
      { name: 'Mortgage', icon: 'Landmark', budgetType: 'fixed' },
      { name: 'Council Rates & Strata', icon: 'Building2', budgetType: 'non_monthly' },
      { name: 'Contents & Home Insurance', icon: 'Shield', budgetType: 'non_monthly' },
      { name: 'Home & Garden', icon: 'Hammer', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Bills',
    isIncome: 0,
    categories: [
      { name: 'Electricity & Gas', icon: 'Zap', budgetType: 'fixed' },
      { name: 'Phone & Internet', icon: 'Wifi', budgetType: 'fixed' },
      { name: 'Subscriptions', icon: 'Tv', budgetType: 'fixed' },
    ],
  },
  {
    name: 'Food',
    isIncome: 0,
    categories: [
      { name: 'Groceries', icon: 'ShoppingCart', budgetType: 'flexible' },
      { name: 'Eating Out & Takeaway', icon: 'UtensilsCrossed', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Getting Around',
    isIncome: 0,
    categories: [
      { name: 'Fuel', icon: 'Fuel', budgetType: 'flexible' },
      { name: 'Public Transport', icon: 'TrainFront', budgetType: 'flexible' },
      { name: 'Rego & CTP', icon: 'FileBadge', budgetType: 'non_monthly' },
      { name: 'Car Insurance & Servicing', icon: 'Wrench', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Health',
    isIncome: 0,
    categories: [
      { name: 'Private Health Insurance', icon: 'HeartPulse', budgetType: 'fixed' },
      { name: 'Medical & Chemist', icon: 'Stethoscope', budgetType: 'flexible' },
    ],
  },
  {
    name: 'Lifestyle',
    isIncome: 0,
    categories: [
      { name: 'Clothing & Personal Care', icon: 'Shirt', budgetType: 'flexible' },
      { name: 'Entertainment', icon: 'Clapperboard', budgetType: 'flexible' },
      { name: 'Gifts', icon: 'Gift', budgetType: 'non_monthly' },
      { name: 'Holidays', icon: 'Palmtree', budgetType: 'non_monthly' },
    ],
  },
  {
    name: 'Savings',
    isIncome: 0,
    categories: [{ name: 'Emergency Fund', icon: 'LifeBuoy', budgetType: 'savings' }],
  },
];

/**
 * Categories that only matter to people who rent, or only to people who own: the budget's
 * "Do you rent or own?" question tucks the other ones away (they're hidden, never deleted).
 */
export const HOUSING_CATEGORIES = {
  rent: ['Rent'],
  own: [
    'Mortgage',
    'Council Rates & Strata',
    'Council Rates & Owners Corp',
    'Property Tax',
    'HOA Fees',
    'Home Maintenance',
  ],
};

/**
 * A few envelopes go by another name in some states, so a new budget uses the words of the place
 * it starts in (its time zone when it is created; existing budgets are never renamed). Victoria
 * pays the TAC charge with its rego and calls strata an owners corporation; New South Wales buys a
 * green slip. Elsewhere, and on a server without an Australian state's zone, the general names.
 */
type AustralianState = 'vic' | 'nsw';
const STATE_BY_ZONE: Record<string, AustralianState> = {
  'Australia/Melbourne': 'vic',
  'Australia/Victoria': 'vic',
  'Australia/Sydney': 'nsw',
  'Australia/NSW': 'nsw',
  'Australia/Broken_Hill': 'nsw',
  'Australia/Yancowinna': 'nsw',
};
const STATE_NAMES: Record<AustralianState, Record<string, string>> = {
  vic: { 'Rego & CTP': 'Rego & TAC', 'Council Rates & Strata': 'Council Rates & Owners Corp' },
  nsw: { 'Rego & CTP': 'Rego & Green Slip' },
};
/** Every state's name for an envelope, the general one first (for Up's category map) */
export const stateNames = (name: string) => [
  name,
  ...Object.values(STATE_NAMES).flatMap((names) => (names[name] ? [names[name]] : [])),
];
function forState(groups: typeof defaultGroups, timeZone: string | undefined) {
  const names = STATE_NAMES[STATE_BY_ZONE[timeZone ?? '']];
  if (!names) return groups;
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => ({ ...c, name: names[c.name] ?? c.name })),
  }));
}

/**
 * The template for a new budget: Allotment is made for Australians, so the Australian one,
 * unless FLYBUDGET_CATEGORY_TEMPLATE=default (or a server outside Australia whose time zone
 * says so, e.g. America/New_York) asks for the general one. A server on UTC, like most Docker
 * hosts, gets the Australian one. An Australian state's zone picks that state's names (forState).
 */
export function categoryTemplate(
  env = process.env.FLYBUDGET_CATEGORY_TEMPLATE,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  if (env === 'au') return forState(australianGroups, timeZone);
  if (env === 'default') return defaultGroups;
  const outsideAustralia =
    !!timeZone && timeZone.includes('/') && !timeZone.startsWith('Australia/');
  return outsideAustralia ? defaultGroups : forState(australianGroups, timeZone);
}

/**
 * Adds the default category groups to a new budget. Skips any budget that already
 * has categories or transactions, so a user who deleted the defaults and started
 * tracking their own way doesn't get them back on the next launch.
 * Returns the number of categories created.
 */
export function seedDefaultCategories(): number {
  const [{ groups }] = db.select({ groups: count() }).from(categoryGroups).all();
  const [{ txns }] = db.select({ txns: count() }).from(transactions).all();
  if (groups > 0 || txns > 0) return 0;

  let created = 0;
  db.transaction((tx) => {
    const now = new Date().toISOString();
    categoryTemplate().forEach((group, groupIdx) => {
      const groupId = nanoid();
      tx.insert(categoryGroups)
        .values({
          id: groupId,
          name: group.name,
          isIncome: group.isIncome,
          sortOrder: groupIdx,
          createdAt: now,
        })
        .run();

      group.categories.forEach((cat, catIdx) => {
        tx.insert(categories)
          .values({
            id: nanoid(),
            groupId,
            name: cat.name,
            icon: cat.icon,
            budgetType: cat.budgetType ?? null,
            sortOrder: catIdx,
            createdAt: now,
          })
          .run();
        created++;
      });
    });
  });
  return created;
}
