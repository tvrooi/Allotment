import { and, eq, gte, inArray, isNotNull, lt, lte } from 'drizzle-orm';
import { addDays, format, parseISO } from 'date-fns';
import { db } from '../db/index.js';
import {
  householdEvents as events,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { snapshot, words } from './householdService.js';

// One shared recurring bill (rent, say) reconciled person by person: what each person's share of
// its shared payments came to, and which deposits into the household accounts paid it. Read-only:
// it suggests what to record, and recording stays a separate, explicit step.

/** Days before a payment that a deposit towards it may arrive, and days after */
const DAYS_BEFORE = 35;
const DAYS_AFTER = 7;
/** A deposit counts towards a share when it is within this many basis points of it (2%)… */
const TOLERANCE_BPS = 200;
/** …or within this many cents, whichever is wider */
const TOLERANCE_MIN = 100;
/** Deposits listed per person that match no payment */
const OTHER_DEPOSITS_SHOWN = 20;

const shift = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd');
const dayGap = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** The bank payments of a schedule: matched occurrences and its payee's money out */
function billTransactionIds(scheduleId: string, from: string, to: string) {
  const schedule = db.select().from(schedules).where(eq(schedules.id, scheduleId)).get();
  if (!schedule) throw new Error('Recurring item not found');
  const matched = db
    .select({ id: scheduleOccurrences.matchedTransactionId })
    .from(scheduleOccurrences)
    .where(
      and(
        eq(scheduleOccurrences.scheduleId, scheduleId),
        isNotNull(scheduleOccurrences.matchedTransactionId),
      ),
    )
    .all()
    .map((o) => o.id!);
  const byPayee = schedule.payeeId
    ? db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.payeeId, schedule.payeeId),
            lt(transactions.amount, 0),
            gte(transactions.date, from),
            lte(transactions.date, to),
          ),
        )
        .all()
        .map((t) => t.id)
    : [];
  return { schedule, ids: new Set([...matched, ...byPayee]) };
}

export function billReconciliation(
  groupId: string,
  scheduleId: string,
  from = '0000-01-01',
  to = '9999-12-31',
) {
  if (from > to) throw new Error('Start date must precede end date');
  const state = snapshot(groupId);
  if (!state.recurringBills.some((b) => b.scheduleId === scheduleId))
    throw new Error('This recurring item is not shared with this household');
  const { schedule, ids } = billTransactionIds(scheduleId, from, to);

  // The bill's payments shared with the household, less refunds of them
  const payments = state.events.filter(
    (e) =>
      e.kind === 'expense' &&
      e.transactionId &&
      ids.has(e.transactionId) &&
      e.date >= from &&
      e.date <= to,
  );
  const refunds = state.events.filter(
    (e) => e.kind === 'refund' && payments.some((p) => p.id === e.reversesId),
  );

  // Deposits into the household accounts around those payments
  const first = payments[0]?.date ?? from;
  const last = payments[payments.length - 1]?.date ?? to;
  const deposits = state.poolAccountIds.length
    ? db
        .select()
        .from(transactions)
        .where(
          and(
            inArray(transactions.accountId, state.poolAccountIds),
            gte(transactions.amount, 1),
            gte(transactions.date, shift(first, -DAYS_BEFORE)),
            lte(transactions.date, shift(last, DAYS_AFTER)),
          ),
        )
        .all()
        .filter((t) => !t.isParent && !t.parentTransactionId)
    : [];
  const otherLegs = new Map(
    db
      .select({ id: transactions.id, accountId: transactions.accountId })
      .from(transactions)
      .where(
        inArray(
          transactions.id,
          deposits.map((d) => d.transferTransactionId).filter((id): id is string => !!id),
        ),
      )
      .all()
      .map((t) => [t.id, t.accountId]),
  );
  const linkIds = deposits.flatMap((d) => [d.id, d.transferTransactionId ?? '']).filter(Boolean);
  const linkedEvents = new Map(
    (linkIds.length
      ? db.select().from(events).where(inArray(events.transactionId, linkIds)).all()
      : []
    ).map((e) => [e.transactionId!, e]),
  );

  const self = state.people.find((p) => p.isSelf)!;
  const others = state.people.filter((p) => !p.isSelf);
  /** Whose deposit this is: the household entry it is linked to, a name, or your own transfer */
  const ownerOf = (t: (typeof deposits)[number]) => {
    const event = linkedEvents.get(t.id);
    if (event)
      return event.kind === 'contribution' && event.groupId === groupId && event.payerId
        ? { personId: event.payerId, eventId: event.id }
        : null;
    if (t.transferTransactionId && linkedEvents.has(t.transferTransactionId)) return null;
    const payee = new Set(words(`${t.payeeName ?? ''} ${t.importedPayee ?? ''}`));
    const named = others.filter((p) => words(p.name).some((w) => payee.has(w)));
    if (named.length === 1) return { personId: named[0].id, eventId: null };
    if (named.length > 1) return null;
    const other = t.transferTransactionId ? otherLegs.get(t.transferTransactionId) : undefined;
    if (other && !state.poolAccountIds.includes(other)) return { personId: self.id, eventId: null };
    return null;
  };
  const owned = deposits.flatMap((t) => {
    const owner = ownerOf(t);
    return owner ? [{ t, ...owner }] : [];
  });

  const people = state.people.map((person) => {
    const shareOf = (e: (typeof state.events)[number]) =>
      e.shares.filter((s) => s.personId === person.id).reduce((n, s) => n + s.amount, 0);
    const owed =
      payments.reduce((n, e) => n + shareOf(e), 0) - refunds.reduce((n, e) => n + shareOf(e), 0);
    const mine = owned.filter((d) => d.personId === person.id);
    const used = new Set<string>();
    const matches = payments.map((payment) => {
      const share = shareOf(payment);
      const tolerance = Math.max(TOLERANCE_MIN, Math.round((share * TOLERANCE_BPS) / 10_000));
      const best = mine
        .filter(
          (d) =>
            !used.has(d.t.id) &&
            share > 0 &&
            Math.abs(d.t.amount - share) <= tolerance &&
            d.t.date >= shift(payment.date, -DAYS_BEFORE) &&
            d.t.date <= shift(payment.date, DAYS_AFTER),
        )
        // Nearest in time; a deposit before the payment wins a tie
        .sort(
          (a, b) =>
            Math.abs(dayGap(a.t.date, payment.date)) - Math.abs(dayGap(b.t.date, payment.date)) ||
            a.t.date.localeCompare(b.t.date),
        )[0];
      if (best) used.add(best.t.id);
      return {
        paymentTransactionId: payment.transactionId,
        paymentDate: payment.date,
        share,
        deposit: best
          ? {
              transactionId: best.t.id,
              accountId: best.t.accountId,
              date: best.t.date,
              amount: best.t.amount,
              payeeName: best.t.importedPayee ?? best.t.payeeName,
              notes: best.t.notes,
              recordedEventId: best.eventId,
            }
          : null,
      };
    });
    const paid = matches.reduce((n, m) => n + (m.deposit?.amount ?? 0), 0);
    return {
      personId: person.id,
      name: person.name,
      isSelf: !!person.isSelf,
      owed,
      paid,
      /** Positive: paid more than their share; negative: still owing towards this bill */
      difference: paid - owed,
      matches,
      unmatchedPayments: matches.filter((m) => !m.deposit).length,
      /** Matched deposits not yet recorded: record_household_contributions takes these */
      toRecord: matches
        .filter((m) => m.deposit && !m.deposit.recordedEventId)
        .map((m) => ({ transactionId: m.deposit!.transactionId, personId: person.id })),
      otherDeposits: mine
        .filter((d) => !used.has(d.t.id) && d.t.date >= from && d.t.date <= to)
        .slice(0, OTHER_DEPOSITS_SHOWN)
        .map((d) => ({
          transactionId: d.t.id,
          date: d.t.date,
          amount: d.t.amount,
          payeeName: d.t.importedPayee ?? d.t.payeeName,
          notes: d.t.notes,
          recordedEventId: d.eventId,
        })),
    };
  });

  return {
    bill: { scheduleId, name: schedule.name },
    from,
    to,
    payments: payments.length,
    total: payments.reduce((n, e) => n + e.amount, 0) - refunds.reduce((n, e) => n + e.amount, 0),
    people,
    notes: [
      `A deposit into a household account counts towards a payment when it names the person (or is a transfer from one of your own accounts), arrives up to ${DAYS_BEFORE} days before or ${DAYS_AFTER} after it, and is within 2% (or $1) of their share.`,
      'Money that reaches the bill another way, such as through a shared saver outside the household, shows as unmatched: check it with the owner rather than guessing.',
      'Only payments shared with the household count. Nothing here is recorded until a contribution is.',
    ],
  };
}
