import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  householdEvents as events,
  householdGroups as groups,
  householdPeople as people,
  householdPoolAccounts as poolAccounts,
  householdRecurringBills as recurringBills,
  payees,
  schedules,
  transactions,
} from '../db/schema.js';
import { personalBudgetAccount } from './balances.js';
import { billShares, parseSplit, personNamedIn } from './householdService.js';

// Whose money a recurring schedule is (docs/HOUSEHOLDS.md "Recurring and the dashboard"). Every
// view of schedules reads this instead of the sign of the amount, so a housemate's deposit into
// a household account is never the owner's income and a shared bill counts at the owner's share.

export type ScheduleScope =
  | { kind: 'personal' }
  | {
      kind: 'household';
      groupId: string;
      groupName: string;
      /** A bill the household pays, or money put into the household (or its account) */
      role: 'bill' | 'contribution';
      /** A bill: the owner's cents of the expected amount, from its split or the default */
      myShare: number | null;
      /** A contribution: who it's from, when known (a transfer of the owner's own is the owner) */
      personId: string | null;
      personName: string | null;
    }
  | { kind: 'off_budget' };

type Schedule = typeof schedules.$inferSelect;

/** Categories in the Income group */
export function incomeCategoryIds() {
  return new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(categoryGroups.isIncome, 1))
      .all()
      .map((c) => c.id),
  );
}

/**
 * Expected pay: money into the owner's side in an Income category. `amountIn` is the amount as
 * it reaches the owner's accounts (a forecast turns a transfer's sign around); household money
 * is never income.
 */
export function isPersonalIncomeSchedule(
  schedule: Pick<Schedule, 'amount' | 'categoryId'>,
  scope: ScheduleScope | undefined,
  incomeIds: Set<string>,
  amountIn = schedule.amount,
) {
  return (
    scope?.kind !== 'household' &&
    amountIn > 0 &&
    !!schedule.categoryId &&
    incomeIds.has(schedule.categoryId)
  );
}

/**
 * Payees of bank rows the owner has already recorded as a housemate's money: a contribution
 * into a household (account), or a settlement paid to the owner. Learned from what was
 * recorded, never guessed from a name. Each maps to its household and person.
 */
export function housematePayees() {
  const rows = db
    .select({
      payeeId: transactions.payeeId,
      groupId: events.groupId,
      personId: events.payerId,
      kind: events.kind,
      recipientId: events.recipientId,
    })
    .from(events)
    .innerJoin(transactions, eq(transactions.id, events.transactionId))
    .innerJoin(people, eq(people.id, events.payerId))
    .where(
      and(
        isNotNull(transactions.payeeId),
        eq(people.isSelf, 0),
        inArray(events.kind, ['contribution', 'settlement']),
      ),
    )
    .all();
  const selfIds = new Set(
    db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.isSelf, 1))
      .all()
      .map((p) => p.id),
  );
  const byPayee = new Map<string, { groupId: string; personId: string }>();
  for (const r of rows) {
    // A settlement counts only when it was paid to the owner, not between housemates
    if (r.kind === 'settlement' && !(r.recipientId && selfIds.has(r.recipientId))) continue;
    byPayee.set(r.payeeId!, { groupId: r.groupId, personId: r.personId! });
  }
  return byPayee;
}

/** Each schedule's scope, from a fixed number of queries whatever the number of schedules */
export function scheduleScopes(only?: Schedule[]): Map<string, ScheduleScope> {
  const list = only ?? db.select().from(schedules).all();
  const result = new Map<string, ScheduleScope>();
  if (!list.length) return result;
  const allGroups = db.select().from(groups).all();
  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const poolGroup = new Map<string, string>();
  for (const g of allGroups) if (g.accountId) poolGroup.set(g.accountId, g.id);
  for (const p of db.select().from(poolAccounts).all()) poolGroup.set(p.accountId, p.groupId);
  const personal = new Set(
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(personalBudgetAccount)
      .all()
      .map((a) => a.id),
  );
  const members = db.select().from(people).all();
  const membersOf = (groupId: string) => members.filter((m) => m.groupId === groupId);
  const links = new Map(
    db
      .select()
      .from(recurringBills)
      .all()
      .map((l) => [l.scheduleId, l]),
  );
  const housemates = housematePayees();
  const payeeIds = [...new Set(list.map((s) => s.payeeId).filter((id): id is string => !!id))];
  const names = new Map(
    (payeeIds.length ? db.select().from(payees).where(inArray(payees.id, payeeIds)).all() : []).map(
      (p) => [p.id, p.name],
    ),
  );
  const payeeName = (id: string | null) => (id ? (names.get(id) ?? '') : '');
  const household = (
    groupId: string,
    role: 'bill' | 'contribution',
    extra: { myShare?: number | null; personId?: string | null } = {},
  ): ScheduleScope => {
    const person = extra.personId ? members.find((m) => m.id === extra.personId) : undefined;
    return {
      kind: 'household',
      groupId,
      groupName: groupById.get(groupId)?.name ?? '',
      role,
      myShare: extra.myShare ?? null,
      personId: person?.id ?? null,
      personName: person?.name ?? null,
    };
  };
  const ownShare = (groupId: string, splitJson: string | null, amount: number) => {
    const group = groupById.get(groupId);
    const self = membersOf(groupId).find((m) => m.isSelf);
    if (!group || !self) return null;
    const split = parseSplit(splitJson) ?? parseSplit(group.defaultSplitJson);
    const { shares } = billShares(split, membersOf(groupId), Math.abs(amount));
    return shares.find((s) => s.personId === self.id)?.amount ?? 0;
  };
  const selfOf = (groupId: string) => membersOf(groupId).find((m) => m.isSelf)?.id ?? null;

  for (const s of list) {
    const link = links.get(s.id);
    const pool = s.accountId ? poolGroup.get(s.accountId) : undefined;
    const intoPool = s.transferAccountId ? poolGroup.get(s.transferAccountId) : undefined;
    if (link && s.amount < 0) {
      result.set(
        s.id,
        household(link.groupId, 'bill', {
          myShare: ownShare(link.groupId, link.splitJson, s.amount),
        }),
      );
    } else if (pool) {
      if (s.amount < 0 && !s.transferAccountId) {
        result.set(s.id, household(pool, 'bill', { myShare: ownShare(pool, null, s.amount) }));
      } else {
        // Money in (or a transfer either way): from the owner when the other side is theirs,
        // else from the housemate the payee is recorded as, or whose name it has
        const fromOwn = !!s.transferAccountId && personal.has(s.transferAccountId);
        const recorded = s.payeeId ? housemates.get(s.payeeId) : undefined;
        const others = membersOf(pool).filter((m) => !m.isSelf);
        const personId = fromOwn
          ? selfOf(pool)
          : recorded?.groupId === pool
            ? recorded.personId
            : s.transferAccountId
              ? null
              : (personNamedIn(`${payeeName(s.payeeId)} ${s.name}`, others)?.id ?? null);
        result.set(s.id, household(pool, 'contribution', { personId }));
      }
    } else if (intoPool && (!s.accountId || personal.has(s.accountId))) {
      // The owner's own transfer into the household account: their contribution, not spending
      result.set(s.id, household(intoPool, 'contribution', { personId: selfOf(intoPool) }));
    } else if (s.accountId && !personal.has(s.accountId)) {
      result.set(s.id, { kind: 'off_budget' });
    } else {
      // A deposit from a payee recorded as a housemate's money is theirs, never the owner's pay
      const recorded = s.amount > 0 && s.payeeId ? housemates.get(s.payeeId) : undefined;
      result.set(
        s.id,
        recorded
          ? household(recorded.groupId, 'contribution', { personId: recorded.personId })
          : { kind: 'personal' },
      );
    }
  }
  return result;
}
