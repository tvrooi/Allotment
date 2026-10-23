import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  upAccountSchema,
  upTransactionSchema,
  upImportRows,
  upSettledBalance,
} from './upTransactions.js';
import { upMockTransaction } from '../test/upMock.js';

describe('Up transaction mapping', () => {
  it('keeps exact cents, stable bank IDs and the bank’s local purchase date', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), (amount) => {
        const tx = upTransactionSchema.parse(upMockTransaction('coffee', amount));
        expect(upImportRows(tx, 'spending')[0]).toMatchObject({
          amount,
          date: '2026-10-01',
          importedId: 'up:spending:coffee',
          payeeName: 'Coffee shop',
        });
      }),
    );
  });
  it('leaves holds out and refuses transactions from another account', () => {
    const held = upTransactionSchema.parse(upMockTransaction('hold', -400, 'HELD'));
    expect(upImportRows(held, 'spending')).toEqual([]);
    expect(() => upImportRows(held, 'saver')).toThrow('different account');
  });
  it('imports cashback separately and sanitizes bank text', () => {
    const tx = upTransactionSchema.parse(upMockTransaction('purchase', -1_000));
    tx.attributes.description = 'Coffee\nshop\u0000';
    tx.attributes.cashback = {
      description: 'Perk up',
      amount: { currencyCode: 'AUD', valueInBaseUnits: 500 },
    };
    const rows = upImportRows(tx, 'spending');
    expect(rows.map((r) => r.amount)).toEqual([-1_000, 500]);
    expect(rows[1].importedId).toBe('up:spending:purchase:cashback');
    expect(rows[0].payeeName).toBe('Coffee shop');
  });
  it('removes the effect of pending holds from Up’s available balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e7, max: 1e7 }),
        fc.integer({ min: -1e7, max: 0 }),
        (available, hold) => {
          const account = upAccountSchema.parse({
            id: 'spending',
            attributes: {
              displayName: 'Up',
              accountType: 'TRANSACTIONAL',
              ownershipType: 'INDIVIDUAL',
              balance: { currencyCode: 'AUD', valueInBaseUnits: available },
            },
          });
          const history = [upTransactionSchema.parse(upMockTransaction('hold', hold, 'HELD'))];
          expect(upSettledBalance(account, history)).toBe(available - hold);
        },
      ),
    );
  });
  it.each([
    [-40, null], // ordinary change
    [-240, -200], // total already includes the boost
    [-100, -100], // even-dollar purchase with a boost
    [0, null],
  ])(
    'retains round-up metadata (%s cents) without changing or duplicating a purchase',
    (total, boost) => {
      const raw = upMockTransaction('rounding', -1760);
      const tx = upTransactionSchema.parse({
        ...raw,
        attributes: {
          ...raw.attributes,
          roundUp: {
            amount: { currencyCode: 'AUD', valueInBaseUnits: total },
            boostPortion: boost === null ? null : { currencyCode: 'AUD', valueInBaseUnits: boost },
          },
        },
      });
      expect(tx.attributes.roundUp?.amount.valueInBaseUnits).toBe(total);
      expect(upImportRows(tx, 'spending')).toEqual(
        upImportRows(upTransactionSchema.parse(raw), 'spending'),
      );
      tx.attributes.status = 'HELD';
      expect(upImportRows(tx, 'spending')).toEqual([]);
    },
  );
  it('keeps identical small bank credits distinct across destinations', () => {
    const rows = ['saver-a', 'saver-b'].flatMap((account) =>
      ['one', 'two'].flatMap((id) => {
        const tx = upTransactionSchema.parse(upMockTransaction(id, 40, 'SETTLED', account));
        return upImportRows(tx, account);
      }),
    );
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.importedId)).size).toBe(4);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(160);
  });
  it('keeps a late settlement on the timestamp’s local day across DST and midnight', () => {
    const raw = upMockTransaction('late', -1760);
    raw.attributes.createdAt = '2026-10-04T00:10:00+10:00';
    raw.attributes.settledAt = '2026-10-07T01:00:00+11:00';
    expect(upImportRows(upTransactionSchema.parse(raw), 'spending')[0]).toMatchObject({
      date: '2026-10-04',
      amount: -1760,
      importedId: 'up:spending:late',
    });
  });
  it('rejects non-AUD and unsafe or fractional amounts', () => {
    for (const amount of [1.5, Number.MAX_SAFE_INTEGER, NaN]) {
      expect(upTransactionSchema.safeParse(upMockTransaction('bad', amount)).success).toBe(false);
    }
    const raw = upMockTransaction('bad', 100);
    raw.attributes.amount.currencyCode = 'USD';
    expect(upTransactionSchema.safeParse(raw).success).toBe(false);
  });
});
