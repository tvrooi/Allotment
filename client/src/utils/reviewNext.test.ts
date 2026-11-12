import { describe, expect, it } from 'vitest';
import { nextSteps, transferSuggestionCount } from './reviewNext';
import type { BudgetReview, ResumeState } from '../api/review';

type ReviewOverrides = Omit<Partial<BudgetReview>, 'totals'> & {
  totals?: Partial<BudgetReview['totals']>;
};
const review = (over: ReviewOverrides = {}) =>
  ({
    asOf: '2026-11-03',
    month: '2026-11',
    revision: 'r',
    complete: true,
    resolved: true,
    unassigned: 0,
    uncategorised: [],
    uncategorisedCount: 0,
    deficits: [],
    targetShortfalls: [],
    commitments: [],
    cards: [],
    groups: [],
    ...over,
    totals: {
      uncategorised: 0,
      deficits: 0,
      targetShortfalls: 0,
      futureCommitments: 0,
      cardShortfall: 0,
      uncoveredCardPayments: 0,
      ...over.totals,
    },
  }) as BudgetReview;
const resume = (over: Partial<ResumeState> = {}) =>
  ({ uncategorisedCount: 0, unreconciledAccounts: 0, ...over }) as ResumeState;

describe('nextSteps', () => {
  it('is empty when the budget is in order', () => {
    expect(nextSteps(review(), resume(), '/t')).toEqual([]);
  });

  it('puts money problems first, then sorting, planning and housekeeping', () => {
    const steps = nextSteps(
      review({
        unassigned: -5_000,
        uncategorisedCount: 3,
        targetShortfalls: [
          { categoryId: 'a', name: 'Rego', groupName: 'Car', amount: 100 },
        ] as never,
        totals: { deficits: 2_000, targetShortfalls: 100 },
      }),
      resume({ unreconciledAccounts: 2 }),
      '/t?u=1',
    );
    expect(steps.map((s) => s.id)).toEqual([
      'overspent',
      'over-assigned',
      'uncategorised',
      'targets',
      'reconcile',
    ]);
    expect(steps[1]).toMatchObject({ amount: 5_000, to: '/budget' });
    expect(steps[2]).toMatchObject({ title: 'Give 3 transactions a category', to: '/t?u=1' });
    expect(steps[4].title).toBe('Reconcile 2 accounts with your bank');
  });

  it('offers to assign money that is waiting, but not when figures are incomplete', () => {
    expect(nextSteps(review({ unassigned: 30_000 }), undefined, '/t')[0].id).toBe('assign');
    expect(nextSteps(review({ unassigned: 30_000, complete: false }), undefined, '/t')).toEqual([]);
  });

  it('works from the resume figures alone while the review loads', () => {
    expect(nextSteps(undefined, resume({ uncategorisedCount: 1 }), '/t')[0].title).toBe(
      'Give 1 transaction a category',
    );
  });
});

it('checks possible transfers after money problems and before categorising', () => {
  const steps = nextSteps(
    review({ unassigned: -100, uncategorisedCount: 2, totals: { deficits: 100 } }),
    undefined,
    '/t',
    2,
  );
  expect(steps.map((s) => s.id)).toEqual([
    'overspent',
    'over-assigned',
    'transfers',
    'uncategorised',
  ]);
  expect(steps[2]).toMatchObject({
    title: 'Check 2 possible transfers',
    to: '/transactions?possible-transfers=1',
  });
  expect(nextSteps(undefined, undefined, '/t', 1)[0].title).toBe('Check 1 possible transfer');
  expect(nextSteps(undefined, undefined, '/t', 0)).toEqual([]);
});

describe('transferSuggestionCount', () => {
  it('keeps successful data during a background refetch', () => {
    const data = [{}, {}];
    expect(transferSuggestionCount(true, { data, isSuccess: true, isFetching: false })).toBe(2);
    expect(transferSuggestionCount(true, { data, isSuccess: true, isFetching: true })).toBe(2);
  });
  it('omits the step before first success, on failure, and offline', () => {
    expect(transferSuggestionCount(true, { isSuccess: false, isFetching: true })).toBe(0);
    expect(transferSuggestionCount(true, { data: [{}], isSuccess: false, isFetching: false })).toBe(
      0,
    );
    expect(transferSuggestionCount(false, { data: [{}], isSuccess: true, isFetching: false })).toBe(
      0,
    );
  });
});
