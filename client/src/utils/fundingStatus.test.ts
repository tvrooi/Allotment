import { describe, expect, it } from 'vitest';
import { readyToAssignStatus, unresolvedCauses, unresolvedReason } from './fundingStatus';

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

// A resolved summary at $0 that has money: the clean case every row below changes one thing of
const zero = {
  ...base,
  toBeBudgeted: 0,
  resolved: true,
  resources: 50_000,
  envelopes: 50_000,
  reserved: 50_000,
};
const OLD_LABEL = new RegExp(['Fully', 'budgeted'].join(' '));

describe('unresolvedCauses', () => {
  it('lists only the causes that are there, in one order', () => {
    expect(unresolvedCauses(zero)).toEqual([]);
    expect(unresolvedCauses({ ...zero, overspent: 1 })).toEqual(['overspent']);
    expect(unresolvedCauses({ ...zero, uncategorized: 1 })).toEqual(['uncategorised']);
    expect(unresolvedCauses({ ...zero, paymentShortfall: 1 })).toEqual(['card-payments']);
    expect(unresolvedCauses({ ...zero, uncoveredCardPayments: 1 })).toEqual(['card-payments']);
    expect(unresolvedCauses({ ...zero, toBeBudgeted: -1 })).toEqual(['over-assigned']);
    expect(
      unresolvedCauses({
        ...zero,
        overspent: 1,
        uncategorized: 1,
        paymentShortfall: 1,
        toBeBudgeted: -1,
      }),
    ).toEqual(['overspent', 'uncategorised', 'card-payments', 'over-assigned']);
  });
});

describe('readyToAssignStatus (#241)', () => {
  const status = readyToAssignStatus;

  it('a clean $0 says every dollar has a job, with the seedling and a normal-colour figure', () => {
    expect(status(0, 0, zero)).toEqual({
      bg: 'bg-positive-subtle',
      text: 'text-positive',
      label: 'Every dollar has a job',
      labelClass: 'text-positive font-medium',
      figureClass: 'text-text',
      glyph: true,
    });
  });

  it.each([
    [{ overspent: 100 }, 'All assigned, but envelopes are overspent'],
    [{ uncategorized: 100 }, 'All assigned, but some spending has no category'],
    [{ paymentShortfall: 100 }, 'All assigned, but card payments need funding'],
    [{ uncoveredCardPayments: 100 }, 'All assigned, but card payments need funding'],
    [{ overspent: 1, uncategorized: 1 }, 'All assigned, with 2 things to resolve'],
    [
      { overspent: 1, uncategorized: 1, paymentShortfall: 1 },
      'All assigned, with 3 things to resolve',
    ],
    // The server's resolved is also false when a pool is below zero, a cause not named here
    [{}, 'All assigned, with items to review'],
  ])('at $0 and unresolved (%o) the label names the job, not praise', (change, label) => {
    expect(status(0, 0, { ...zero, ...change, resolved: false })).toEqual({
      bg: 'bg-positive-subtle',
      text: 'text-positive',
      label,
      labelClass: expect.stringContaining('text-text') as string,
      figureClass: 'text-text',
      glyph: false,
    });
  });

  it('praises nothing while the summary is loading or has failed', () => {
    expect(status(0, 0, undefined)).toMatchObject({
      bg: 'bg-surface-alt',
      label: null,
      figureClass: 'text-text',
      glyph: false,
    });
  });

  it('a budget with no money has nothing to assign yet', () => {
    expect(status(0, 0, { ...zero, resources: 0, envelopes: 0 })).toEqual({
      bg: 'bg-surface-alt',
      text: 'text-text-secondary',
      label: 'Nothing to assign yet',
      labelClass: 'text-text-secondary',
      figureClass: 'text-text',
      glyph: false,
    });
  });

  it('a figure in doubt keeps the caution look and says why', () => {
    expect(status(0, 0, { ...zero, complete: false })).toMatchObject({
      bg: 'bg-caution-subtle',
      label: 'Incomplete: missing exchange rates',
      glyph: false,
    });
    expect(status(0, 0, { ...zero, accountIssues: [{}] as never })).toMatchObject({
      bg: 'bg-caution-subtle',
      label: 'Reconcile account balances before assigning money',
    });
  });

  it('keeps the figures above and below zero as they were', () => {
    expect(status(-500, 0, { ...zero, toBeBudgeted: -500 })).toMatchObject({
      bg: 'bg-negative-subtle',
      label: 'Assigned more than you have',
      figureClass: 'text-negative',
    });
    expect(status(300, 0, { ...zero, toBeBudgeted: 300 })).toMatchObject({
      bg: 'bg-caution-subtle',
      label: 'Almost budgeted',
    });
    expect(status(100_000, 0, { ...zero, toBeBudgeted: 100_000 })).toMatchObject({
      bg: 'bg-positive-subtle',
      label: 'Give every dollar a job',
      figureClass: 'text-positive',
    });
  });

  it('never uses the retired $0 label', () => {
    const cases: Parameters<typeof readyToAssignStatus>[] = [
      [0, 0, zero],
      [0, 0, undefined],
      [0, 0, { ...zero, resources: 0, envelopes: 0 }],
      [0, 0, { ...zero, complete: false }],
      [0, 0, { ...zero, accountIssues: [{}] as never }],
      [-500, 0, { ...zero, toBeBudgeted: -500 }],
      [300, 0, { ...zero, toBeBudgeted: 300 }],
      [100_000, 0, { ...zero, toBeBudgeted: 100_000 }],
      ...[
        { overspent: 1 },
        { uncategorized: 1 },
        { paymentShortfall: 1 },
        { overspent: 1, uncategorized: 1 },
        {},
      ].map((change): Parameters<typeof readyToAssignStatus> => [
        0,
        0,
        { ...zero, ...change, resolved: false },
      ]),
    ];
    for (const args of cases) expect(status(...args).label ?? '').not.toMatch(OLD_LABEL);
  });
});
