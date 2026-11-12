import { describe, expect, it } from 'vitest';
import { transactionPayeeName, transferLabel, transferSides } from './transferLabel';

const names: Record<string, string> = { spending: 'Spending', pool: '2Up Essentials' };
const name = (id: string) => names[id];
const tx = (amount: number, extra: Record<string, unknown> = {}) => ({
  accountId: 'spending',
  amount,
  transferTransactionId: 'other-side',
  transferAccountId: 'pool',
  transferPair: false,
  payeeName: 'Transfer: 2Up Essentials',
  ...extra,
});

describe('transfer direction', () => {
  it('shares the directional name and payee fallbacks for every transaction surface', () => {
    expect(transactionPayeeName(tx(-8800), name)).toBe('Transfer to 2Up Essentials');
    expect(transactionPayeeName(tx(8800, { payeeName: null }), name)).toBe(
      'Transfer from 2Up Essentials',
    );
    expect(transactionPayeeName(tx(-8800, { transferPair: true }), name)).toBe(
      'Transfer from Spending to 2Up Essentials',
    );
    expect(transactionPayeeName(tx(-8800, { payeeName: 'Rent float' }), name)).toBe('Rent float');
    expect(
      transactionPayeeName(tx(-8800, { transferAccountId: null, payeeName: null }), name),
    ).toBe('Transfer');
    expect(
      transactionPayeeName(tx(-450, { transferTransactionId: null, payeeName: null }), name),
    ).toBe('—');
  });

  it('says which way the money went', () => {
    expect(transferLabel(tx(-8800), name)).toBe('Transfer to 2Up Essentials');
    expect(transferLabel(tx(8800), name)).toBe('Transfer from 2Up Essentials');
    expect(transferSides(tx(8800), name)).toEqual({ from: '2Up Essentials', to: 'Spending' });
  });

  it('names both accounts on a pair listed as one row', () => {
    expect(transferLabel(tx(-8800, { transferPair: true }), name)).toBe(
      'Transfer from Spending to 2Up Essentials',
    );
    expect(transferLabel(tx(8800, { transferPair: true }), name)).toBe(
      'Transfer from 2Up Essentials to Spending',
    );
  });

  it("keeps a name you typed, and leaves anything that isn't a linked transfer", () => {
    expect(transferLabel(tx(-8800, { payeeName: 'Rent float' }), name)).toBeNull();
    expect(transferLabel(tx(-450, { transferTransactionId: null }), name)).toBeNull();
  });
});
