import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, categoryGroups } from '../db/schema.js';

/**
 * Up's own category slugs, each mapped to the names it could have in FlyBudget's category
 * templates (Australian first, then the general one). A slug maps to the first name the budget
 * has. Unclear matches are left out: an uncategorised row is better than a confidently wrong one.
 * Up's parent categories (good-life, home, personal, transport) are too broad to map, and so are
 * lottery-and-gambling, tobacco-and-vaping, cycling and utilities (water, gas and power together).
 */
const UP_CATEGORY_NAMES: Record<string, string[]> = {
  groceries: ['Groceries'],
  takeaway: ['Takeaway & Delivery', 'Fast Food'],
  'restaurants-and-cafes': ['Eating Out', 'Restaurants'],
  'pubs-and-bars': ['Alcohol', 'Alcohol / Bars'],
  booze: ['Alcohol', 'Alcohol / Bars'],
  'tv-and-music': ['Streaming & Subscriptions', 'Streaming Services'],
  'apps-games-and-software': ['Software & AI', 'Software / Tools', 'Entertainment'],
  'events-and-gigs': ['Entertainment'],
  hobbies: ['Hobbies'],
  'holidays-and-travel': ['Holidays', 'Vacation'],
  'homeware-and-appliances': ['Home Goods', 'Home Maintenance'],
  internet: ['Internet'],
  'maintenance-and-improvements': ['Home Maintenance', 'Home Improvement'],
  pets: ['Pet Food & Supplies'],
  'rates-and-insurance': ['Contents & Home Insurance', 'Home Insurance'],
  'rent-and-mortgage': ['Rent', 'Rent / Mortgage'],
  'hair-and-beauty': ['Personal Care'],
  'health-and-medical': ['GP & Specialists', 'Doctor / Medical'],
  technology: ['Electronics'],
  'clothing-and-accessories': ['Clothing'],
  'education-and-student-loans': ['Tuition', 'Student Loans'],
  'fitness-and-wellbeing': ['Fitness', 'Gym / Fitness'],
  'gifts-and-charity': ['Gifts'],
  investments: ['Investments'],
  'mobile-phone': ['Mobile', 'Phone'],
  'news-magazines-and-books': ['Books & Supplies'],
  'car-insurance-and-maintenance': ['Car Insurance'],
  fuel: ['Fuel', 'Gas / Fuel'],
  parking: ['Tolls & Parking', 'Parking'],
  'public-transport': ['Public Transport', 'Public Transit'],
  'car-repayments': ['Loan Repayments', 'Car Payment'],
  'taxis-and-share-cars': ['Rideshare & Taxis', 'Ride Share'],
  'toll-roads': ['Tolls & Parking'],
};

export const knownUpCategories = () => Object.keys(UP_CATEGORY_NAMES);

/** Pure: the category id for an Up slug, given the budget's spending categories by lowercase name */
export function mapUpCategory(slug: string | null | undefined, byName: Map<string, string>) {
  if (!slug) return null;
  for (const name of UP_CATEGORY_NAMES[slug] ?? []) {
    const id = byName.get(name.toLowerCase());
    if (id) return id;
  }
  return null;
}

/** Looks the budget's categories up once per sync. Income categories are never a target. */
export function upCategoryResolver() {
  const byName = new Map<string, string>();
  for (const c of db
    .select({ id: categories.id, name: categories.name, hidden: categories.hidden })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(eq(categoryGroups.isIncome, 0))
    .orderBy(categories.hidden, categories.sortOrder)
    .all()) {
    const key = c.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, c.id);
  }
  return (slug: string | null | undefined) => mapUpCategory(slug, byName);
}
