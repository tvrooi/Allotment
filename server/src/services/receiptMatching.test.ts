import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';

// Receipts matched and enriched like Monarch's Receipts tab (docs/RECEIPTS-AND-TAX.md §6).
// Mock data and made-up files only.

const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { eq } = await import('drizzle-orm');
const { db } = await import('../db/index.js');
const {
  accounts,
  budgetSettings,
  categories,
  categoryGroups,
  receiptFiles,
  receiptLineItems,
  receipts,
  tags,
  taxClaims,
  transactions,
  transactionTags,
} = await import('../db/schema.js');
const { addReceipt, updateReceipt, createTransactionFromReceipt, listReceipts } =
  await import('./receiptService.js');
const {
  apportion,
  findAutoMatch,
  matchPendingReceipts,
  sameMerchant,
  splitByItems,
  splitPlan,
  updateReceiptSettings,
} = await import('./receiptMatching.js');
const { insertNewTransaction, buildRuleContext } = await import('./ruleService.js');
const { createBackup } = await import('./backupService.js');

beforeAll(() => migrate(db, { migrationsFolder: './src/db/migrations' }));

const jpeg = (fill: string) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(fill.repeat(32))]);

beforeEach(() => {
  for (const t of [
    receiptLineItems,
    receipts,
    receiptFiles,
    taxClaims,
    transactionTags,
    tags,
    transactions,
  ])
    db.delete(t).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  db.delete(accounts).run();
  db.delete(budgetSettings).run();
  db.insert(accounts)
    .values({ id: 'card', name: 'Card', type: 'credit', startingBalance: 0 })
    .run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Everyday', sortOrder: 0 }).run();
  db.insert(categories)
    .values([
      { id: 'groceries', groupId: 'g', name: 'Groceries', sortOrder: 0 },
      { id: 'household', groupId: 'g', name: 'Household', sortOrder: 1 },
    ])
    .run();
});

const tx = (id: string, date: string, amount: number, payeeName: string, extra = {}) =>
  db
    .insert(transactions)
    .values({ id, accountId: 'card', date, amount, payeeName, createdAt: date, ...extra })
    .run();

/** A receipt with its details, as typed on the Receipts tab */
function receipt(details: Parameters<typeof updateReceipt>[1], fill = 'r') {
  const r = addReceipt({ bytes: jpeg(fill), fileName: 'receipt.jpg' });
  db.update(receipts)
    .set({
      merchant: details.merchant ?? null,
      receiptDate: details.receiptDate ?? null,
      total: details.total ?? null,
      tax: details.tax ?? null,
      tip: details.tip ?? null,
      notes: details.notes ?? null,
    })
    .where(eq(receipts.id, r.id))
    .run();
  if (details.lineItems) updateReceipt(r.id, { lineItems: details.lineItems });
  return r.id;
}

const row = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!;
const tagNames = (id: string) =>
  db
    .select({ name: tags.name })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(eq(transactionTags.transactionId, id))
    .all()
    .map((t) => t.name);
const parts = (id: string) =>
  db
    .select({ amount: transactions.amount, categoryId: transactions.categoryId })
    .from(transactions)
    .where(eq(transactions.parentTransactionId, id))
    .all()
    .sort((a, b) => a.amount - b.amount);

describe('automatic matching', () => {
  it('matches the same merchant from 2 days before to 7 days after, and enriches it', () => {
    tx('late', '2026-08-08', -2_500, 'WOOLWORTHS 1234 SYDNEY');
    const id = receipt({
      merchant: 'Woolworths',
      receiptDate: '2026-08-01',
      total: 2_500,
      notes: 'Weekly shop',
    });
    expect(matchPendingReceipts()).toBe(1);
    const r = db.select().from(receipts).where(eq(receipts.id, id)).get()!;
    expect(r).toMatchObject({ transactionId: 'late', matchedBy: 'auto' });
    expect(tagNames('late')).toEqual(['Receipt']);
    expect(row('late')).toMatchObject({ amount: -2_500, notes: 'Weekly shop' });
  });

  it('needs a day for a different merchant name, and never guesses between two', () => {
    tx('near', '2026-08-02', -1_000, 'SQ *CAFE');
    tx('far', '2026-08-04', -1_200, 'Other');
    const close = receipt(
      { merchant: 'Corner Coffee', receiptDate: '2026-08-01', total: 1_000 },
      'a',
    );
    const distant = receipt(
      { merchant: 'Corner Coffee', receiptDate: '2026-08-01', total: 1_200 },
      'b',
    );
    expect(findAutoMatch(close)).toBe('near');
    expect(findAutoMatch(distant)).toBeNull();
    tx('twin', '2026-08-01', -1_000, 'SQ *CAFE');
    expect(findAutoMatch(close)).toBeNull();
    // Outside the window, before the receipt
    tx('early', '2026-07-29', -3_000, 'Corner Coffee');
    expect(
      findAutoMatch(
        receipt({ merchant: 'Corner Coffee', receiptDate: '2026-08-01', total: 3_000 }, 'c'),
      ),
    ).toBeNull();
  });

  it('matches a receipt when its transaction arrives later', async () => {
    const id = receipt({ merchant: 'Bunnings', receiptDate: '2026-08-01', total: 4_990 });
    const out = insertNewTransaction(
      {
        accountId: 'card',
        date: '2026-08-03',
        amount: -4_990,
        payeeId: null,
        payeeName: 'BUNNINGS 456',
        importedPayee: null,
        notes: null,
        categoryId: null,
        importedId: 'bank-1',
      },
      { rules: [], ctx: buildRuleContext() },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(db.select().from(receipts).where(eq(receipts.id, id)).get()!.transactionId).toBe(
      out.transaction.id,
    );
  });

  it('compares merchant names by their letters and numbers', () => {
    expect(sameMerchant("McDonald's", 'MCDONALDS 123')).toBe(true);
    expect(sameMerchant('Coles', 'Woolworths')).toBe(false);
    expect(sameMerchant('BP', 'BP Connect')).toBe(false);
  });
});

describe('autosplit and categories', () => {
  const groceriesAndHousehold = {
    merchant: 'Coles',
    receiptDate: '2026-08-01',
    total: 5_800,
    tax: 500,
    tip: 300,
    lineItems: [
      { description: 'Milk', amount: 1_500, categoryId: 'groceries' },
      { description: 'Bread', amount: 1_500, categoryId: 'groceries' },
      { description: 'Detergent', amount: 2_000, categoryId: 'household' },
    ],
  };

  it('splits by category: tax in proportion, fees per item, adding up exactly', () => {
    tx('shop', '2026-08-01', -5_800, 'Coles');
    receipt(groceriesAndHousehold);
    matchPendingReceipts();
    expect(row('shop').isParent).toBe(1);
    expect(parts('shop')).toEqual([
      { amount: -3_500, categoryId: 'groceries' },
      { amount: -2_300, categoryId: 'household' },
    ]);
  });

  it('splits to the transaction amount when matched by hand at a different total', () => {
    tx('shop', '2026-08-01', -5_801, 'Coles');
    const id = receipt(groceriesAndHousehold);
    updateReceipt(id, { transactionId: 'shop' });
    expect(parts('shop').reduce((s, p) => s + p.amount, 0)).toBe(-5_801);
  });

  it('respects the settings, never changes a chosen category, and skips a reconciled one', () => {
    updateReceiptSettings({ autoSplit: false, addTag: false, addNotes: false });
    tx('shop', '2026-08-01', -5_800, 'Coles');
    receipt(groceriesAndHousehold);
    matchPendingReceipts();
    expect(row('shop')).toMatchObject({ isParent: 0, notes: null });
    expect(tagNames('shop')).toEqual([]);

    updateReceiptSettings({ autoSplit: true });
    tx('chosen', '2026-09-01', -900, 'IGA', { categoryId: 'household' });
    tx('blank', '2026-09-10', -700, 'IGA');
    receipt(
      {
        merchant: 'IGA',
        receiptDate: '2026-09-01',
        total: 900,
        lineItems: [{ description: 'Eggs', amount: 900, categoryId: 'groceries' }],
      },
      'x',
    );
    receipt(
      {
        merchant: 'IGA',
        receiptDate: '2026-09-10',
        total: 700,
        lineItems: [{ description: 'Eggs', amount: 700, categoryId: 'groceries' }],
      },
      'y',
    );
    matchPendingReceipts();
    expect(row('chosen').categoryId).toBe('household');
    expect(row('blank').categoryId).toBe('groceries');

    tx('locked', '2026-10-01', -5_800, 'Coles', { reconciled: 1 });
    // Dated a month away, so it isn't matched automatically first
    const id = receipt({ ...groceriesAndHousehold, receiptDate: '2026-11-01' }, 'z');
    expect(updateReceipt(id, { transactionId: 'locked' }).outcome).toMatchObject({
      split: 0,
      skipped: 'The transaction is reconciled, so it was not split',
    });
  });

  it('never splits a categorised or claimed transaction by itself; Split by items does on request', () => {
    tx('chosen', '2026-08-01', -5_800, 'Coles', { categoryId: 'groceries' });
    const id = receipt(groceriesAndHousehold);
    expect(db.select().from(receipts).where(eq(receipts.id, id)).get()!.transactionId).toBe(
      'chosen',
    );
    expect(row('chosen')).toMatchObject({ isParent: 0, categoryId: 'groceries' });
    expect(splitByItems(id).split).toBe(2);
    expect(parts('chosen').map((p) => p.amount)).toEqual([-3_500, -2_300]);

    tx('claimed', '2026-09-01', -5_800, 'Coles');
    db.insert(taxClaims)
      .values({ transactionId: 'claimed', label: 'D5', createdAt: 'x', updatedAt: 'x' })
      .run();
    const other = receipt({ ...groceriesAndHousehold, receiptDate: '2026-09-01' }, 'q');
    expect(row('claimed').isParent).toBe(0);
    expect(updateReceipt(other, { notes: 'again' }).outcome?.skipped).toBe(
      'The transaction is claimed as a tax deduction, so it was not split',
    );
    expect(() => splitByItems(other)).toThrow('The transaction is claimed as a tax deduction');
  });

  it('enriches a transaction when details are typed after the receipt was added to it', () => {
    tx('shop', '2026-08-01', -5_800, 'Coles');
    const r = addReceipt({ bytes: jpeg('later'), fileName: 'r.jpg', transactionId: 'shop' });
    expect(row('shop').isParent).toBe(0);
    const out = updateReceipt(r.id, {
      notes: 'Weekly shop',
      tax: 500,
      tip: 300,
      lineItems: groceriesAndHousehold.lineItems,
    });
    expect(out.outcome).toMatchObject({ split: 2, notesAdded: true });
    expect(parts('shop').map((p) => p.amount)).toEqual([-3_500, -2_300]);
  });

  it('apportions any amount exactly by weight', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1_000_000_000 }), { minLength: 1, maxLength: 8 }),
        (amount, weights) => {
          const out = apportion(amount, weights);
          if (weights.every((w) => w === 0)) return out.every((p) => p === 0);
          return (
            out.reduce((s, p) => s + p, 0) === amount &&
            out.every((p) => Math.sign(p) * Math.sign(amount) >= 0)
          );
        },
      ),
    );
    expect(
      splitPlan(-1_000, [{ description: 'A', amount: 1_000, categoryId: 'groceries' }], null, null),
    ).toBeNull();
  });
});

describe('receipts without a transaction yet', () => {
  it('creates the transaction from the receipt, and unmatching leaves it alone', () => {
    const id = receipt({ merchant: 'Market stall', receiptDate: '2026-08-05', total: 1_200 });
    const made = createTransactionFromReceipt(id, { accountId: 'card' });
    expect(made.transactionId).not.toBeNull();
    expect(row(made.transactionId!)).toMatchObject({
      amount: -1_200,
      payeeName: 'Market stall',
      date: '2026-08-05',
    });
    expect(made.matchedBy).toBe('created');
    updateReceipt(id, { transactionId: null });
    expect(listReceipts({ matched: false }).map((r) => r.id)).toEqual([id]);
    expect(row(made.transactionId!)).toBeTruthy();
  });

  it('says what is missing before making a transaction', () => {
    const id = receipt({ merchant: 'Stall' });
    expect(() => createTransactionFromReceipt(id, { accountId: 'card' })).toThrow(
      /merchant, date and amount/,
    );
  });

  it('backs up line items in format 19', () => {
    receipt({
      merchant: 'Coles',
      lineItems: [{ description: 'Milk', amount: 100, categoryId: 'groceries' }],
    });
    const backup = createBackup() as Record<string, unknown>;
    expect(backup.version).toBe(19);
    expect(backup.receiptLineItems).toHaveLength(1);
  });
});
