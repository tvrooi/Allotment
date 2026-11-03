import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deleteAccountPermanently, getAccountDeletion } from '../../api/accounts';
import { useCanSave } from '../../hooks/useConnection';
import { useFormReset } from '../../hooks/useFormReset';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import type { Account } from '../../types';

interface Props {
  account: Account | null;
  onClose: () => void;
  /** The account is gone */
  onDeleted?: () => void;
}

/**
 * Permanently delete an account and all of its transactions, after typing its name. Says what
 * will go, and refuses (with how to fix it) while a bank feed supplies the account.
 */
export function DeleteAccountModal({ account, onClose, onDeleted }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canSave = useCanSave();
  const [typed, setTyped] = useState('');
  useFormReset(account?.id ?? null, () => setTyped(''));
  const preview = useQuery({
    queryKey: ['account-deletion', account?.id],
    queryFn: () => getAccountDeletion(account!.id),
    enabled: !!account,
    gcTime: 0,
  });
  const remove = useMutation({
    mutationFn: () => deleteAccountPermanently(account!.id, typed),
    onSuccess: () => {
      for (const key of [
        'accounts',
        'transactions',
        'budget',
        'budget-summary',
        'reports',
        'review',
        'dashboards',
        'schedules',
      ])
        qc.invalidateQueries({ queryKey: [key] });
      (onDeleted ?? onClose)();
      navigate('/accounts');
    },
  });
  const data = preview.data;
  const blocked = !!data && data.blockers.length > 0;
  const matches = !!account && typed === account.name;

  return (
    <Modal
      isOpen={!!account}
      onClose={onClose}
      title="Delete account and its transactions"
      size="md"
    >
      <div className="space-y-4">
        {preview.isPending && <p role="status">Checking what would be deleted…</p>}
        {data && (
          <p className="text-sm text-text-secondary">
            This deletes <strong>{data.name}</strong> and its {data.transactions.toLocaleString()}{' '}
            transaction{data.transactions === 1 ? '' : 's'}
            {data.reconciled > 0 && ` (${data.reconciled.toLocaleString()} reconciled)`} for good.
            It can't be undone. Transfers to other accounts stay there as ordinary transactions.
          </p>
        )}
        {blocked && (
          <div role="alert" className="space-y-2 text-sm text-negative">
            {data.blockers.map((b) => (
              <p key={b}>{b}</p>
            ))}
          </div>
        )}
        {data && !blocked && (
          <label className="block text-sm font-medium text-text-secondary">
            Type the account name <span className="font-mono">{data.name}</span> to confirm
            <input
              aria-label="Type the account name to confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
          </label>
        )}
        {(preview.error || remove.error) && (
          <p role="alert" className="text-sm text-negative">
            {(preview.error || remove.error)!.message}
          </p>
        )}
        <SavingPausedHint />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => remove.mutate()}
            disabled={!data || blocked || !matches || !canSave || remove.isPending}
          >
            Delete account
          </Button>
        </div>
      </div>
    </Modal>
  );
}
