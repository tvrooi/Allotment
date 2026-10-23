import { describe, expect, it } from 'vitest';
import { nearMissDraft, nearMissReason } from './nearMiss';
import type { NearMiss } from '../types';

const miss = (extra: Partial<NearMiss> = {}): NearMiss => ({
  id: 'id:gym|acct',
  accountId: 'acct',
  accountName: 'Everyday',
  payeeId: 'gym',
  payeeName: 'Gym',
  reason: 'amounts_vary',
  recurrenceType: 'weekly',
  count: 4,
  lastDate: '2026-10-20',
  amount: -1500,
  minAmount: -2100,
  maxAmount: -1500,
  categoryId: 'fun',
  ...extra,
});

describe('nearMissReason', () => {
  it('says why, in words', () => {
    expect(nearMissReason(miss())).toMatch(/^Amounts vary by more than 7\.5% \(.*15.*to.*21/);
    expect(nearMissReason(miss({ reason: 'too_few', count: 2 }))).toBe(
      'Only 2 of the 3 payments needed so far',
    );
    expect(nearMissReason(miss({ reason: 'dates_drift', recurrenceType: 'biweekly' }))).toBe(
      'Dates drift more than 2 days (about every 2 weeks)',
    );
  });
});

describe('nearMissDraft', () => {
  it('starts at the next payment after today', () => {
    expect(nearMissDraft(miss(), '2026-10-23')).toMatchObject({
      startDate: '2026-10-27',
      amountType: 'variable',
      dateFlexibility: 3,
      payeeId: 'gym',
    });
    // Last paid 31 Aug, monthly: 30 Sep and 31 Oct are clamped by date-fns, never in the past
    const monthly = nearMissDraft(
      miss({ reason: 'dates_drift', recurrenceType: 'monthly', lastDate: '2026-08-31' }),
      '2026-10-23',
    );
    expect(monthly.startDate > '2026-10-23').toBe(true);
    expect(monthly).toMatchObject({ amountType: 'exact', dateFlexibility: 7 });
  });
});
