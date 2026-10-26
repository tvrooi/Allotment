import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import {
  getHouseholds,
  removeHouseholdEvent,
  shareTransactions,
  type HouseholdSummary,
} from '../../api/households';
import { getTransactions } from '../../api/transactions';
import { useUndoStore } from '../../store/undoStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Input';
import type { TransactionQueryParams } from '../../types';

// "Share with household": records payments as shared household expenses with the household's
// default split (Household → Sharing), in one step instead of a form per payment. For one
// transaction, the payments picked in the register, or every payment in its current list.
// Undo removes the entries.

const splitText = (g: HouseholdSummary) =>
  !g.defaultSplit || g.defaultSplit.mode === 'equal'
    ? 'split equally'
    : g.defaultSplit.mode === 'percentage'
      ? 'split by percentage'
      : 'split by weight';

interface Props {
  /** One transaction, the payments picked in the register, or the register's list */
  transactionId?: string;
  transactionIds?: string[];
  params?: TransactionQueryParams;
  count?: number;
  variant?: 'button' | 'link' | 'compact';
  /** After sharing, e.g. to clear the register's picks */
  onShared?: () => void;
}

export function ShareWithHousehold({
  transactionId,
  transactionIds,
  params,
  count,
  variant = 'button',
  onShared,
}: Props) {
  const qc = useQueryClient();
  const { data: groups = [] } = useQuery({ queryKey: ['households'], queryFn: getHouseholds });
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const share = useMutation({
    mutationFn: async (id: string) => {
      const ids = transactionId
        ? [transactionId]
        : transactionIds
          ? transactionIds.slice(0, 500)
          : (await getTransactions(params ?? {}))
              .filter((t) => t.amount < 0 && !t.isParent && !t.transferTransactionId)
              .map((t) => t.id)
              .slice(0, 500);
      return { id, result: await shareTransactions(id, ids) };
    },
    onSuccess: ({ id, result }) => {
      void qc.invalidateQueries({ queryKey: ['households'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      const skipped = result.results.filter((r) => !r.ok);
      const reasons = [...new Set(skipped.map((r) => r.error))].slice(0, 2).join('; ');
      setOutcome(
        `Shared ${result.shared}.` +
          (skipped.length ? ` ${skipped.length} not shared: ${reasons}` : ''),
      );
      onShared?.();
      const events = result.results.filter((r) => r.ok && r.eventId).map((r) => r.eventId!);
      if (events.length)
        useUndoStore.getState().push({
          description: `Share ${events.length} with the household`,
          undo: async () => {
            for (const e of [...events].reverse()) await removeHouseholdEvent(id, e);
            void qc.invalidateQueries({ queryKey: ['households'] });
          },
          redo: async () => {
            await shareTransactions(
              id,
              result.results.filter((r) => r.ok).map((r) => r.transactionId),
            );
            void qc.invalidateQueries({ queryKey: ['households'] });
          },
        });
    },
    onError: (e: Error) => setOutcome(e.message),
  });
  if (!groups.length) return null;
  const chosen = groups.find((g) => g.id === (groupId || groups[0].id))!;
  const label = transactionId
    ? 'Share with household'
    : transactionIds
      ? `Share ${transactionIds.length.toLocaleString()} picked with household`
      : `Share ${count === undefined ? '' : `${count.toLocaleString()} `}with household`;

  return (
    <>
      {variant === 'link' ? (
        <button
          type="button"
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text max-md:min-h-8"
          title="Record the payments in this list as shared household expenses"
        >
          <Users size={12} /> {label}
        </button>
      ) : variant === 'compact' ? (
        <Button
          size="sm"
          disabled={transactionIds?.length === 0}
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
        >
          <Users size={13} /> {label}
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
        >
          <Users size={14} /> {label}
        </Button>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Share with household" size="sm">
        <div className="space-y-3 text-sm">
          {groups.length > 1 && (
            <Select
              aria-label="Household"
              value={chosen.id}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
          <p className="text-text-secondary">
            {transactionId
              ? 'This payment'
              : transactionIds
                ? `Each of the ${transactionIds.length.toLocaleString()} picked payments`
                : 'Each payment (money out) in this list'}{' '}
            becomes a shared {chosen.name} expense, {splitText(chosen)}. Change the split in
            Household → Sharing. Payments already shared are skipped.
          </p>
          {outcome && <p role="status">{outcome}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {outcome ? 'Close' : 'Cancel'}
            </Button>
            {!outcome && (
              <Button disabled={share.isPending} onClick={() => share.mutate(chosen.id)}>
                Share
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
