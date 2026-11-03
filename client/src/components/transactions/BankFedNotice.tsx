import { useState } from 'react';
import { useAccounts, useCreateAccount } from '../../hooks/useAccounts';

interface Props {
  /** The account the new transaction is for */
  accountId: string;
  /** Switch the transaction to this account (the Cash account, made first when there is none) */
  onUseAccount: (id: string) => void;
  /** Names the account the entry is going to once it has been switched */
  switched?: boolean;
}

/**
 * Shown above the entry form when the account is fed by a bank: a row added by hand makes it
 * disagree with the bank. One tap moves the entry to Cash, creating that account if needed.
 */
export function BankFedNotice({ accountId, onUseAccount, switched }: Props) {
  const { data: accounts = [] } = useAccounts();
  const createAccount = useCreateAccount();
  const [error, setError] = useState('');
  const open = accounts.filter((a) => !a.closedAt);
  const account = open.find((a) => a.id === accountId);
  const cash = open.find((a) => a.type === 'cash');
  if (switched && cash && cash.id === accountId)
    return (
      <p role="status" className="px-4 py-2 text-xs text-text-secondary">
        Adding to {cash.name}, so your bank account stays in step with the bank.
      </p>
    );
  if (!account?.bankLinked) return null;

  async function useCash() {
    setError('');
    if (cash) return onUseAccount(cash.id);
    try {
      const created = await createAccount.mutateAsync({
        name: 'Cash',
        type: 'cash',
        startingBalance: 0,
      });
      onUseAccount(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the Cash account');
    }
  }

  return (
    <div className="px-4 py-2">
      <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-caution">
        <span>
          {account.name} is linked to your bank. A transaction added by hand will make it disagree
          with the bank.
        </span>
        <button
          type="button"
          onClick={() => void useCash()}
          className="underline font-medium cursor-pointer"
        >
          {cash ? 'Use Cash instead' : 'Use a new Cash account instead'}
        </button>
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
