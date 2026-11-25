import { afterEach, describe, expect, it } from 'vitest';
import { formatRegisterAmount } from './RoundUp';
import { useSafeModeStore } from '../../store/safeModeStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { HIDDEN_AMOUNT } from '../../utils/safeMode';
import { formatMoney } from '../../utils/currency';
import type { Transaction } from '../../types';

const transaction = (amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: 'sample',
  accountId: 'spending',
  date: '2026-01-01',
  amount,
  payeeId: null,
  payeeName: 'Sample',
  categoryId: null,
  notes: null,
  reconciled: 0,
  transferTransactionId: null,
  isParent: 0,
  parentTransactionId: null,
  importedId: null,
  importedPayee: null,
  scheduleId: null,
  createdAt: '2026-01-01',
  ...extra,
});

const originalSafeModeLevel = usePreferencesStore.getState().safeModeLevel;
afterEach(() => {
  useSafeModeStore.getState().setOn(false);
  usePreferencesStore.setState({ safeModeLevel: originalSafeModeLevel });
});

describe('register money direction', () => {
  it('distinguishes money in, money out and zero without colour', () => {
    expect(formatRegisterAmount(transaction(-4250), 'AUD')).toBe(formatMoney(-4250, 'AUD'));
    expect(formatRegisterAmount(transaction(4250), 'AUD')).toBe('+' + formatMoney(4250, 'AUD'));
    expect(formatRegisterAmount(transaction(0), 'AUD')).toBe(formatMoney(0, 'AUD'));
  });
  it('leaves a folded transfer neutral regardless of its stored side', () => {
    for (const amount of [-4250, 4250]) {
      expect(formatRegisterAmount(transaction(amount, { transferPair: true }), 'AUD')).toBe(
        formatMoney(4250, 'AUD'),
      );
    }
  });
  it('includes the purchase round-up with its outgoing direction', () => {
    const tx = transaction(-5152, {
      roundUp: { amount: -48, transactionId: 'round-up', toAccountName: 'Savings', boost: null },
    });
    expect(formatRegisterAmount(tx, 'AUD')).toBe(formatMoney(-5200, 'AUD'));
  });
  it('hides the sign along with the amount in full Safe mode', () => {
    usePreferencesStore.getState().setSafeModeLevel('all');
    useSafeModeStore.getState().setOn(true);
    expect(formatRegisterAmount(transaction(4250), 'AUD')).toBe(HIDDEN_AMOUNT);
    expect(formatRegisterAmount(transaction(-4250), 'AUD')).toBe(HIDDEN_AMOUNT);
  });
});
