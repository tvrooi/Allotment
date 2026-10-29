import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useFormReset } from '../../hooks/useFormReset';
import { useBulkDelete, usePreviewBulkDelete } from '../../hooks/useTransactionEdits';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import type { TransactionQueryParams } from '../../types';

interface Props {
  params: TransactionQueryParams;
  isOpen: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = 'delete';

/**
 * Delete every transaction in the register's list. It first asks the server what would go (and
 * what is left alone: reconciled rows and ones tied to a household entry), shows the count and a
 * sample, and needs the word "delete" typed, because a deleted row cannot be brought back whole.
 */
export function BulkDeleteModal({ params, isOpen, onClose }: Props) {
  const canSave = useCanSave();
  const preview = usePreviewBulkDelete();
  const remove = useBulkDelete();
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState<{ deleted: number; reconciled: number } | null>(null);
  useFormReset(isOpen ? 'open' : null, () => {
    setTyped('');
    setDone(null);
    remove.reset();
    preview.reset();
    preview.mutate({ params });
  });

  const data = preview.data;
  const skipped = data ? data.skipped.reconciled + data.skipped.household : 0;
  const ready = !!data && data.deletable > 0 && typed.trim().toLowerCase() === CONFIRM_WORD;

  function doDelete() {
    if (!data) return;
    remove.mutate(
      { params, expectedCount: data.deletable },
      { onSuccess: (r) => setDone({ deleted: r.deleted, reconciled: r.skipped.reconciled }) },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        done
          ? 'Deleted'
          : data
            ? `Delete ${data.deletable.toLocaleString()} transactions`
            : 'Delete transactions'
      }
      size="md"
    >
      {done ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-text">
            Deleted {done.deleted.toLocaleString()} transaction{done.deleted === 1 ? '' : 's'}.
            {done.reconciled > 0 &&
              ` ${done.reconciled.toLocaleString()} reconciled transaction${done.reconciled === 1 ? ' was' : 's were'} kept: unlock ${done.reconciled === 1 ? 'it' : 'them'} first to delete.`}
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {preview.isPending && <p role="status">Checking what would be deleted…</p>}
          {data && (
            <>
              <p className="text-sm text-text-secondary">
                {data.deletable.toLocaleString()} transaction{data.deletable === 1 ? '' : 's'}
                {data.accounts.length > 0 &&
                  ` in ${data.accounts.map((a) => a.name).join(', ')}`}{' '}
                will be deleted for good. This can't be undone.
              </p>
              {data.sample.length > 0 && (
                <ul className="text-sm text-text space-y-1 list-disc pl-5">
                  {data.sample.map((t) => (
                    <li key={t.id}>
                      {formatDay(t.date)} · {t.payeeName || 'No payee'} · {formatCurrency(t.amount)}
                    </li>
                  ))}
                  {data.deletable > data.sample.length && (
                    <li className="list-none -ml-5 text-text-tertiary">
                      and {(data.deletable - data.sample.length).toLocaleString()} more
                    </li>
                  )}
                </ul>
              )}
              {skipped > 0 && (
                <p className="text-sm text-text-secondary">
                  Left alone:{' '}
                  {[
                    data.skipped.reconciled > 0 &&
                      `${data.skipped.reconciled.toLocaleString()} reconciled (unlock them to delete)`,
                    data.skipped.household > 0 &&
                      `${data.skipped.household.toLocaleString()} linked to a household entry`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  .
                </p>
              )}
              {data.deletable === 0 ? (
                <p role="status" className="text-sm">
                  Nothing here can be deleted.
                </p>
              ) : (
                <label className="block text-sm font-medium text-text-secondary">
                  Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
                  <input
                    aria-label={`Type ${CONFIRM_WORD} to confirm`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                </label>
              )}
            </>
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
              onClick={doDelete}
              disabled={!ready || !canSave || remove.isPending}
            >
              {data ? `Delete ${data.deletable.toLocaleString()}` : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
