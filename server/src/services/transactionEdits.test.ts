import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  payees,
  tags,
  householdEvents,
  householdGroups,
  transactions,
  transactionTags,
} from '../db/schema.js';
import {
  bulkDelete,
  previewBulkDelete,
  bulkEdit,
  previewBulkEdit,
  restoreBulkEdit,
  splitTransaction,
} from './transactionEdits.js';
import { MarkError } from './transactionMarks.js';

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
});

function reset() {
  for (const table of [
    householdEvents,
    householdGroups,
    transactionTags,
    tags,
    transactions,
    payees,
    categories,
    categoryGroups,
    accounts,
  ])
    db.delete(table).run();
  db.insert(accounts)
    .values([
      { id: 'cash', name: 'Cash', type: 'checking', createdAt: '2026-09-01' },
      { id: 'card', name: 'Card', type: 'credit', createdAt: '2026-09-01' },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'expenses', name: 'Expenses' }).run();
  db.insert(categories)
    .values(['food', 'home', 'fun'].map((id) => ({ id, name: id, groupId: 'expenses' })))
    .run();
  db.insert(tags)
    .values([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ])
    .run();
}
beforeEach(reset);

function addTx(id: string, amount: number, extra: Partial<typeof transactions.$inferInsert> = {}) {
  db.insert(transactions)
    .values({
      id,
      accountId: 'cash',
      date: '2026-10-09',
      amount,
      payeeName: 'Grocer',
      categoryId: 'food',
      notes: 'bank note',
      importedId: `up:${id}`,
      createdAt: '2026-10-09',
      ...extra,
    })
    .run();
}
const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!;
const parts = (id: string) =>
  db.select().from(transactions).where(eq(transactions.parentTransactionId, id)).all();

/** Amounts that add up to `total`, none zero, in 2-6 parts */
const partsOf = (total: number) =>
  fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 5 }).map((cuts) => {
    const amounts = cuts.map((c) => Math.sign(total) * c);
    return [...amounts, total - amounts.reduce((a, b) => a + b, 0)];
  });

describe('splitTransaction', () => {
  it('keeps the transaction and its bank identity; the parts add up exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5_000_000, max: 5_000_000 }).filter((n) => n !== 0),
        fc.integer({ min: 0, max: 1_000 }),
        (total, seed) => {
          reset();
          addTx('t', total);
          const amounts = fc.sample(partsOf(total), { numRuns: 1, seed })[0];
          if (amounts.some((a) => a === 0)) return;
          splitTransaction(
            't',
            amounts.map((amount, i) => ({ categoryId: i % 2 ? 'home' : 'food', amount })),
          );
          const parent = row('t');
          expect(parent.isParent).toBe(1);
          expect(parent.categoryId).toBeNull();
          expect(parent.amount).toBe(total);
          expect(parent.importedId).toBe('up:t');
          const p = parts('t');
          expect(p.reduce((s, x) => s + x.amount, 0)).toBe(total);
          expect(p.every((x) => x.notes === 'bank note' && x.date === parent.date)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('changes parts, then puts the transaction back together', () => {
    addTx('t', -4500);
    splitTransaction('t', [
      { categoryId: 'food', amount: -1500 },
      { categoryId: 'home', amount: -3000 },
    ]);
    splitTransaction('t', [
      { categoryId: 'fun', amount: -1000, notes: 'own note' },
      { categoryId: 'fun', amount: -3500 },
    ]);
    expect(
      parts('t')
        .map((p) => p.amount)
        .sort(),
    ).toEqual([-1000, -3500].sort());
    expect(parts('t').find((p) => p.amount === -1000)!.notes).toBe('own note');
    splitTransaction('t', []);
    expect(parts('t')).toHaveLength(0);
    // Every part was "fun", so the whole transaction is
    expect(row('t')).toMatchObject({ isParent: 0, categoryId: 'fun', amount: -4500 });
  });

  it('refuses what would break the ledger', () => {
    addTx('t', -4500);
    addTx('rec', -100, { reconciled: 1 });
    const two = [
      { categoryId: 'food', amount: -100 },
      { categoryId: 'home', amount: -4400 },
    ];
    expect(() => splitTransaction('t', [{ categoryId: 'food', amount: -4500 }])).toThrow(MarkError);
    expect(() =>
      splitTransaction('t', [
        { categoryId: 'food', amount: -100 },
        { categoryId: 'home', amount: -100 },
      ]),
    ).toThrow(/add up/);
    expect(() => splitTransaction('rec', two)).toThrow(/reconciled/);
    expect(() =>
      splitTransaction('t', [
        { categoryId: 'nope', amount: -100 },
        { categoryId: 'home', amount: -4400 },
      ]),
    ).toThrow(/Unknown category/);
    expect(row('t').isParent).toBe(0);
  });
});

describe('bulkEdit', () => {
  const all = { selection: {} };

  it('refuses a stale count and writes nothing', () => {
    addTx('x', -100);
    addTx('y', -200);
    expect(() => bulkEdit(all, { categoryId: 'fun' }, 3)).toThrow(/now has 2/);
    expect(row('x').categoryId).toBe('food');
  });

  it('skips rows that cannot take a ledger change and reports why; reconciled rows take them', () => {
    addTx('x', -100);
    addTx('rec', -200, { reconciled: 1 });
    addTx('s', -300);
    splitTransaction('s', [
      { categoryId: 'food', amount: -100 },
      { categoryId: 'home', amount: -200 },
    ]);
    const preview = previewBulkEdit(all, { categoryId: 'fun' });
    expect(preview).toMatchObject({ matched: 3, changing: 2 });
    expect(preview.skipped).toMatchObject({ reconciled: 0, split: 1 });
    expect(preview.accounts.map((a) => a.name)).toEqual(['Cash']);
    const result = bulkEdit(all, { categoryId: 'fun', hiddenFromReports: true }, 3);
    expect(row('x').categoryId).toBe('fun');
    expect(row('rec').categoryId).toBe('fun');
    expect(row('rec').reconciled).toBe(1);
    // Report visibility is not a ledger change: every row takes it
    expect([row('x'), row('rec'), row('s')].every((r) => r.hiddenFromReports === 1)).toBe(true);
    expect(result.changed).toBe(3);
  });

  it('leaves transfers their payee and counts only rows that really change', () => {
    addTx('x', -100, { payeeName: 'Cafe' });
    addTx('t1', -500, { payeeName: 'Transfer: Card', categoryId: null });
    addTx('t2', 500, { accountId: 'card', payeeName: 'Transfer: Cash', categoryId: null });
    db.update(transactions)
      .set({ transferTransactionId: 't2' })
      .where(eq(transactions.id, 't1'))
      .run();
    db.update(transactions)
      .set({ transferTransactionId: 't1' })
      .where(eq(transactions.id, 't2'))
      .run();
    const preview = previewBulkEdit(all, { payeeName: 'Cafe' });
    // x already has that payee name but no payee id, so linking it is the one change
    expect(preview).toMatchObject({ matched: 3, changing: 1, skipped: { transfer: 2 } });
    bulkEdit(all, { payeeName: 'Cafe' }, 3);
    expect(row('t1').payeeName).toBe('Transfer: Card');
    expect(row('t2').payeeName).toBe('Transfer: Cash');
    // Asking for what every row already has changes nothing, and says so
    expect(previewBulkEdit(all, { payeeName: 'Cafe', hiddenFromReports: false })).toMatchObject({
      changing: 0,
    });
    expect(bulkEdit(all, { payeeName: 'Cafe', hiddenFromReports: false }, 3).changed).toBe(0);
  });

  it('creates a new payee only when a row takes it', () => {
    addTx('t1', -500, { payeeName: 'Transfer: Card', categoryId: null });
    addTx('t2', 500, { accountId: 'card', payeeName: 'Transfer: Cash', categoryId: null });
    db.update(transactions)
      .set({ transferTransactionId: 't2' })
      .where(eq(transactions.id, 't1'))
      .run();
    db.update(transactions)
      .set({ transferTransactionId: 't1' })
      .where(eq(transactions.id, 't2'))
      .run();
    const named = (name: string) => db.select().from(payees).where(eq(payees.name, name)).all();
    expect(bulkEdit(all, { payeeName: 'Brand new' }, 2).changed).toBe(0);
    expect(named('Brand new')).toHaveLength(0);
    addTx('x', -100);
    expect(bulkEdit(all, { payeeName: 'Brand new' }, 3).changed).toBe(1);
    expect(named('Brand new')).toHaveLength(1);
    expect(row('x').payeeId).toBe(named('Brand new')[0].id);
  });

  it('previews exactly what the apply changes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            categoryId: fc.constantFrom('food', 'fun', null),
            hidden: fc.boolean(),
            reconciled: fc.boolean(),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        fc.record(
          {
            categoryId: fc.constantFrom('fun', null),
            hiddenFromReports: fc.boolean(),
            notes: fc.constantFrom('bank note', null),
          },
          { requiredKeys: [] },
        ),
        (rows, changes) => {
          reset();
          rows.forEach((r, i) =>
            addTx(`t${i}`, -100 * (i + 1), {
              categoryId: r.categoryId,
              hiddenFromReports: r.hidden ? 1 : 0,
              reconciled: r.reconciled ? 1 : 0,
            }),
          );
          if (!Object.keys(changes).length) return;
          const preview = previewBulkEdit(all, changes);
          expect(bulkEdit(all, changes, rows.length).changed).toBe(preview.changing);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('honours hand-picked and unticked rows', () => {
    addTx('x', -100);
    addTx('y', -200);
    addTx('z', -300);
    bulkEdit({ selection: {}, ids: ['x', 'y'], excludeIds: ['y'] }, { notes: null }, 1);
    expect([row('x').notes, row('y').notes, row('z').notes]).toEqual([
      null,
      'bank note',
      'bank note',
    ]);
  });

  it('undo puts every row back exactly, whatever changed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            categoryId: fc.constantFrom('food', 'home', null),
            hidden: fc.boolean(),
            reviewed: fc.boolean(),
            tags: fc.subarray(['a', 'b']),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        fc.record(
          {
            categoryId: fc.constantFrom('fun', null),
            payeeName: fc.constantFrom('Cafe', 'Grocer'),
            notes: fc.constantFrom('new', null),
            hiddenFromReports: fc.boolean(),
            reviewed: fc.boolean(),
            addTagIds: fc.subarray(['a', 'b']),
            removeTagIds: fc.subarray(['a', 'b']),
          },
          { requiredKeys: [] },
        ),
        (rows, changes) => {
          reset();
          rows.forEach((r, i) => {
            addTx(`t${i}`, -100 * (i + 1), {
              categoryId: r.categoryId,
              hiddenFromReports: r.hidden ? 1 : 0,
              reviewedAt: r.reviewed ? '2026-10-01T00:00:00.000Z' : null,
            });
            for (const tagId of r.tags)
              db.insert(transactionTags)
                .values({ transactionId: `t${i}`, tagId })
                .run();
          });
          if (!Object.keys(changes).length) return;
          const snapshot = () => ({
            tx: db.select().from(transactions).all(),
            tags: db
              .select()
              .from(transactionTags)
              .all()
              .sort((a, b) =>
                `${a.transactionId}${a.tagId}`.localeCompare(`${b.transactionId}${b.tagId}`),
              ),
          });
          const before = snapshot();
          const result = bulkEdit(all, changes, rows.length);
          restoreBulkEdit(result.restore);
          const after = snapshot();
          // The payee may be new; everything about the transactions is as it was
          expect(after.tx).toEqual(before.tx);
          expect(after.tags).toEqual(before.tags);
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe('bulkDelete', () => {
  const target = { selection: {} };
  const ids = () =>
    db
      .select({ id: transactions.id })
      .from(transactions)
      .all()
      .map((r) => r.id)
      .sort();

  it('deletes the selection, skips and counts reconciled rows, and a split goes with its parts', () => {
    addTx('a', -100);
    addTx('b', -200);
    addTx('rec', -300, { reconciled: 1 });
    addTx('s', -400);
    splitTransaction('s', [
      { categoryId: 'food', amount: -100 },
      { categoryId: 'home', amount: -300 },
    ]);
    const preview = previewBulkDelete(target);
    expect(preview).toMatchObject({
      matched: 4,
      deletable: 3,
      skipped: { reconciled: 1, household: 0 },
    });
    expect(preview.accounts.map((a) => a.name)).toEqual(['Cash']);
    expect(bulkDelete(target, 3)).toMatchObject({ deleted: 3, skipped: { reconciled: 1 } });
    expect(ids()).toEqual(['rec']);
  });

  it('writes nothing when the count the user confirmed is out of date', () => {
    addTx('a', -100);
    addTx('b', -200);
    expect(() => bulkDelete(target, 1)).toThrow(/now has 2/);
    expect(ids()).toEqual(['a', 'b']);
  });

  it('only deletes the hand-picked, unexcluded rows', () => {
    for (const id of ['a', 'b', 'c']) addTx(id, -100);
    expect(bulkDelete({ ...target, ids: ['a', 'b', 'c'], excludeIds: ['b'] }, 2).deleted).toBe(2);
    expect(ids()).toEqual(['b']);
  });

  it('leaves a transfer whose other side is reconciled, and turns the surviving side ordinary', () => {
    addTx('t1', -500, { payeeName: 'Transfer: Card', transferTransactionId: 't2' });
    addTx('t2', 500, { accountId: 'card', transferTransactionId: 't1', reconciled: 1 });
    addTx('u1', -50, { payeeName: 'Transfer: Card', transferTransactionId: 'u2' });
    addTx('u2', 50, { accountId: 'card', transferTransactionId: 'u1' });
    const result = bulkDelete({ ...target, ids: ['t1', 'u1'] }, 1);
    expect(result).toMatchObject({ deleted: 1, skipped: { reconciled: 1 } });
    expect(ids()).toEqual(['t1', 't2', 'u2']);
    expect(row('u2').transferTransactionId).toBeNull();
  });

  it('skips a payment tied to a household entry', () => {
    addTx('h', -100);
    addTx('x', -100);
    db.insert(householdGroups)
      .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'card' })
      .run();
    db.insert(householdEvents)
      .values({
        id: 'ev',
        groupId: 'home',
        kind: 'expense',
        date: '2026-10-09',
        description: 'Power',
        amount: 100,
        transactionId: 'h',
      })
      .run();
    expect(previewBulkDelete(target)).toMatchObject({ deletable: 1, skipped: { household: 1 } });
  });
});
