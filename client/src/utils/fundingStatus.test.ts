import { describe, expect, it } from 'vitest';
import { unresolvedReason } from './fundingStatus';

const base = {
  overspent: 0,
  uncategorized: 0,
  toBeBudgeted: 1000,
  paymentShortfall: 0,
  uncoveredCardPayments: 0,
  accountIssues: [],
  complete: true,
};

describe('unresolvedReason', () => {
  it('names only the causes that are there', () => {
    expect(unresolvedReason({ ...base, uncategorized: 2349 })).toBe(
      'Resolve uncategorised spending',
    );
    expect(unresolvedReason({ ...base, overspent: 100 })).toBe('Resolve overspent envelopes');
    expect(unresolvedReason({ ...base, overspent: 1, uncategorized: 1, toBeBudgeted: -5 })).toBe(
      'Resolve overspent envelopes, uncategorised spending and more assigned than you have',
    );
    expect(unresolvedReason({ ...base, paymentShortfall: 10 })).toBe(
      'Resolve card payments without funding',
    );
  });

  it('puts balance checks and missing rates first', () => {
    expect(unresolvedReason({ ...base, overspent: 1, accountIssues: [{}] as never })).toBe(
      'Reconcile account balances before assigning money',
    );
    expect(unresolvedReason({ ...base, overspent: 1, complete: false })).toBe(
      'Incomplete: missing exchange rates',
    );
  });
});
