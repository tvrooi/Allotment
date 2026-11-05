import { inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, transactions } from '../db/schema.js';
import { snapshot } from './householdService.js';

// Household spending reports (SPL-05): what the household spent, by month, person and category,
// for a date range. Read-only. Only expenses and refunds count; repayments and money put into
// the household account are not spending (docs/HOUSEHOLDS.md, "Reports and portability").

/** Entries without a category: unlinked ones, and linked payments that have none */
export const UNCATEGORISED = 'Uncategorised';

export interface HouseholdBreakdown {
  /** Gross spending in the range, and your share of it */
  total: number;
  myShare: number;
  byMonth: { month: string; household: number; myShare: number }[];
  /**
   * `paid` is what a person paid directly; `share` is what they owe of the spending; `net` is
   * paid less share. Spending the household account paid has no person (`personId` null).
   */
  byPerson: { personId: string | null; name: string; paid: number; share: number; net: number }[];
  /** From each entry's linked bank payment; entries with none are under Uncategorised (id null) */
  byCategory: { categoryId: string | null; name: string; household: number; myShare: number }[];
}

/** Spending in a household between two days (inclusive), broken down three ways */
export function householdBreakdown(
  state: ReturnType<typeof snapshot>,
  from: string,
  to: string,
): HouseholdBreakdown {
  const selfId = state.people.find((p) => p.isSelf)!.id;
  const entries = state.events.filter(
    (e) => (e.kind === 'expense' || e.kind === 'refund') && e.date >= from && e.date <= to,
  );
  const mine = (e: (typeof entries)[number]) =>
    e.shares.filter((s) => s.personId === selfId).reduce((n, s) => n + s.amount, 0);

  const linked = entries.map((e) => e.transactionId).filter((t): t is string => !!t);
  const categoryOf = new Map(
    linked.length
      ? db
          .select({ id: transactions.id, categoryId: transactions.categoryId })
          .from(transactions)
          .where(inArray(transactions.id, linked))
          .all()
          .map((t) => [t.id, t.categoryId] as const)
      : [],
  );
  const categoryIds = [...new Set([...categoryOf.values()].filter((c): c is string => !!c))];
  const categoryNames = new Map(
    categoryIds.length
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
          .all()
          .map((c) => [c.id, c.name] as const)
      : [],
  );

  const months = new Map<string, { household: number; myShare: number }>();
  const byCategory = new Map<string | null, { household: number; myShare: number }>();
  const persons = new Map<string | null, { paid: number; share: number }>(
    state.people.map((p) => [p.id, { paid: 0, share: 0 }]),
  );
  const add = <K>(
    map: Map<K, { household: number; myShare: number }>,
    key: K,
    e: (typeof entries)[number],
  ) => {
    const row = map.get(key) ?? { household: 0, myShare: 0 };
    row.household += e.amount;
    row.myShare += mine(e);
    map.set(key, row);
  };
  for (const e of entries) {
    add(months, e.date.slice(0, 7), e);
    const category = (e.transactionId && categoryOf.get(e.transactionId)) || null;
    add(byCategory, category && categoryNames.has(category) ? category : null, e);
    const payer = persons.get(e.payerId) ?? { paid: 0, share: 0 };
    payer.paid += e.amount;
    persons.set(e.payerId, payer);
    for (const s of e.shares) persons.get(s.personId)!.share += s.amount;
  }

  const name = (id: string | null) => state.people.find((p) => p.id === id)?.name;
  return {
    total: entries.reduce((n, e) => n + e.amount, 0),
    myShare: entries.reduce((n, e) => n + mine(e), 0),
    byMonth: [...months]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v })),
    byPerson: [...persons]
      // A person with nothing in the range is left out; the household account only if it paid
      .filter(([, v]) => v.paid !== 0 || v.share !== 0)
      .map(([personId, v]) => ({
        personId,
        name: name(personId) ?? 'Household account',
        paid: v.paid,
        share: v.share,
        net: v.paid - v.share,
      })),
    byCategory: [...byCategory]
      .map(([categoryId, v]) => ({
        categoryId,
        name: categoryId ? (categoryNames.get(categoryId) ?? UNCATEGORISED) : UNCATEGORISED,
        ...v,
      }))
      // Largest spending first, with Uncategorised last whatever its size
      .sort(
        (a, b) =>
          Number(a.categoryId === null) - Number(b.categoryId === null) ||
          Math.abs(b.household) - Math.abs(a.household) ||
          a.name.localeCompare(b.name),
      ),
  };
}
