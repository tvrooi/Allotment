import type { Account } from '../types';

/** Keep grouped inspection and categorisation within the same personal-budget accounts. */
export function personalPayeeSelection(
  payee: { payeeId: string | null; payeeName: string },
  accounts: Pick<Account, 'id' | 'isOffBudget' | 'householdPool'>[],
) {
  const accountIds = accounts.filter((a) => !a.isOffBudget && !a.householdPool).map((a) => a.id);
  if (!accountIds.length) throw new Error('No personal budget accounts to sort.');
  return {
    uncategorized: true,
    accountIds,
    ...(payee.payeeId ? { payeeIds: [payee.payeeId] } : { payeeName: payee.payeeName }),
  };
}
