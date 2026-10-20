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
  it('rejects non-AUD and unsafe or fractional amounts', () => {
    for (const amount of [1.5, Number.MAX_SAFE_INTEGER, NaN]) {
      expect(upTransactionSchema.safeParse(upMockTransaction('bad', amount)).success).toBe(false);
    }
    const raw = upMockTransaction('bad', 100);
    raw.attributes.amount.currencyCode = 'USD';
    expect(upTransactionSchema.safeParse(raw).success).toBe(false);
  });
});
