import { describe, expect, it } from 'vitest';
import { formatScheduleAmount, groupOccurrences, isIncomeAmount } from './scheduleFormat';
import type { ScheduleOccurrence, ScheduleScope } from '../../types';

const household = (
  role: 'bill' | 'contribution',
  extra: Partial<Extract<ScheduleScope, { kind: 'household' }>> = {},
): ScheduleScope => ({
  kind: 'household',
  groupId: 'g1',
  groupName: '2Up',
  role,
  myShare: null,
  personId: null,
  personName: null,
  ...extra,
});

let n = 0;
function occ(
  name: string,
  expectedAmount: number,
  scope: ScheduleScope | undefined,
  expectedDate = '2026-11-10',
): ScheduleOccurrence {
  n++;
  return {
    id: `o${n}`,
    scheduleId: `s${n}`,
    scheduledDate: expectedDate,
    expectedDate,
    expectedAmount,
    status: 'pending',
    displayStatus: 'upcoming',
    matchedTransactionId: null,
    matchType: null,
    matchConfidence: null,
    skippedAt: null,
    paidAt: null,
    createdAt: '2026-11-01T00:00:00Z',
    scheduleName: name,
    recurrenceType: 'monthly',
    amountType: 'exact',
    scheduleAccountId: null,
    scheduleCategoryId: null,
    schedulePayeeId: null,
    matchedAmount: null,
    matchedDate: null,
    scope,
  };
}

describe('groupOccurrences', () => {
  const pay = occ('Pay', 300_000, { kind: 'personal' }, '2026-11-14');
  const phone = occ('Phone', -5_000, { kind: 'personal' });
  const juno = occ(
    'Juno',
    80_000,
    household('contribution', { personId: 'p2', personName: 'Juno' }),
    '2026-11-01',
  );
  const rent = occ('Rent', -240_000, household('bill', { myShare: 80_000 }), '2026-11-03');

  it("leaves housemates' deposits out of income and counts a shared bill at the owner's share", () => {
    const { income, expenses, household: shared } = groupOccurrences([pay, phone, juno, rent]);
    expect(income.map((o) => o.scheduleName)).toEqual(['Pay']);
    const share = expenses.find((o) => o.shareOf);
    expect(share).toMatchObject({
      id: rent.id,
      scheduleName: 'Your share of Rent (2Up)',
      expectedAmount: -80_000,
      shareOf: 240_000,
    });
    // Expenses hold the share, never the full rent
    expect(expenses.reduce((sum, o) => sum + o.expectedAmount, 0)).toBe(-85_000);
    expect(shared.map((o) => [o.scheduleName, o.expectedAmount])).toEqual([
      ['Juno', 80_000],
      ['Rent', -240_000],
    ]);
  });

  it('keeps the old sign rule for items without a scope', () => {
    const {
      income,
      expenses,
      household: shared,
    } = groupOccurrences([occ('Refund', 1_000, undefined), occ('Gym', -2_000, undefined)]);
    expect(income).toHaveLength(1);
    expect(expenses).toHaveLength(1);
    expect(shared).toHaveLength(0);
  });

  it('never counts more than the bill, and leaves out a zero share', () => {
    const big = occ('Water', -9_000, household('bill', { myShare: 12_000 }));
    const none = occ('Internet', -9_000, household('bill', { myShare: 0 }));
    const { expenses, household: shared } = groupOccurrences([big, none]);
    expect(expenses.map((o) => o.expectedAmount)).toEqual([-9_000]);
    expect(shared).toHaveLength(2);
  });
});

describe('a paid shared bill', () => {
  it("counts the owner's share of what was actually paid", () => {
    const water = {
      ...occ('Water', -10_000, household('bill', { myShare: 5_000 })),
      displayStatus: 'paid' as const,
      matchedAmount: -12_000,
    };
    const [share] = groupOccurrences([water]).expenses;
    expect(share).toMatchObject({ expectedAmount: -5_000, matchedAmount: -6_000 });
  });
});

describe('household amounts', () => {
  it('shows a contribution without the income sign', () => {
    const scope = household('contribution');
    expect(isIncomeAmount(80_000, scope)).toBe(false);
    expect(isIncomeAmount(80_000, { kind: 'personal' })).toBe(true);
    expect(formatScheduleAmount(80_000, 'exact', isIncomeAmount(80_000, scope))).toBe('$800');
    expect(formatScheduleAmount(80_000, 'exact')).toBe('+$800');
  });
});
