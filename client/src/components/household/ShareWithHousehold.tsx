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
import { inBatches } from '../../utils/batches';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Input';
import type { TransactionQueryParams } from '../../types';

// "Share with household": records payments as shared household expenses with the household's
// default split (Household → Sharing), in one step instead of a form per payment. For one
// transaction, the payments picked in the register, or every payment in its current list.
// Undo removes the entries.

/** The share endpoint takes at most this many ids, so a larger selection goes in batches */
const SHARE_BATCH = 500;
/**
 * Share in batches. If a batch fails after others succeeded, what was shared is still reported
 * (and can be undone), with why it stopped and what wasn't sent; if none succeeded, it throws.
 */
async function shareAll(groupId: string, ids: string[]) {
  const out = await inBatches(ids, SHARE_BATCH, (batch) => shareTransactions(groupId, batch));
  if (out.error && out.sent === 0) throw out.error;
  return {
    shared: out.results.reduce((n, p) => n + p.shared, 0),
    results: out.results.flatMap((p) => p.results),
    sentIds: ids.slice(0, out.sent),
    stopped: out.error ? { error: out.error.message, unsent: ids.length - out.sent } : null,
  };
}

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
  /** After sharing, with the ids that were sent (e.g. to clear those picks) */
  onShared?: (sentIds: string[]) => void;
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
        : (transactionIds ??
          (await getTransactions(params ?? {}))
            .filter((t) => t.amount < 0 && !t.isParent && !t.transferTransactionId)
            .map((t) => t.id));
      return { id, result: await shareAll(id, ids) };
    },
    onSuccess: ({ id, result }) => {
      void qc.invalidateQueries({ queryKey: ['households'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      const skipped = result.results.filter((r) => !r.ok);
      const reasons = [...new Set(skipped.map((r) => r.error))].slice(0, 2).join('; ');
      setOutcome(
        `Shared ${result.shared}.` +
          (skipped.length ? ` ${skipped.length} not shared: ${reasons}` : '') +
          (result.stopped
            ? ` Then it stopped (${result.stopped.error}): ${result.stopped.unsent} weren't ` +
              'sent. Share again to send them; payments already shared are skipped.'
            : ''),
      );
      onShared?.(result.sentIds);
      const events = result.results.filter((r) => r.ok && r.eventId).map((r) => r.eventId!);
      if (events.length)
        useUndoStore.getState().push({
          description: `Share ${events.length} with the household`,
          undo: async () => {
            for (const e of [...events].reverse()) await removeHouseholdEvent(id, e);
            void qc.invalidateQueries({ queryKey: ['households'] });
          },
          redo: async () => {
            await shareAll(
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
