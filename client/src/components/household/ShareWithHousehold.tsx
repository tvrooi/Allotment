import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import {
  getHouseholds,
  removeSharedEntries,
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

/** How a household's quick share splits, for a label */
export const splitText = (g: HouseholdSummary) =>
  !g.defaultSplit || g.defaultSplit.mode === 'equal'
    ? 'split equally'
    : g.defaultSplit.mode === 'percentage'
      ? 'split by percentage'
      : 'split by weight';

type ShareOutcome = Awaited<ReturnType<typeof shareAll>>;

/** What a share did, in a sentence: how many, what was skipped and why, and what wasn't sent */
export function describeShare(result: ShareOutcome, householdName?: string) {
  const skipped = result.results.filter((r) => !r.ok);
  const reasons = [...new Set(skipped.map((r) => r.error))].slice(0, 2).join('; ');
  const done =
    householdName && result.shared === 1 && !skipped.length && !result.stopped
      ? `Shared with ${householdName}.`
      : `Shared ${result.shared}${householdName ? ` with ${householdName}` : ''}.`;
  return (
    done +
    (skipped.length ? ` ${skipped.length} not shared: ${reasons}` : '') +
    (result.stopped
      ? ` Then it stopped (${result.stopped.error}): ${result.stopped.unsent} weren't ` +
        'sent. Share again to send them; payments already shared are skipped.'
      : '')
  );
}

/**
 * Shares payments with a household's default split, refreshes what shows them and records one
 * undo step (Undo removes the entries it made). Used by the dialog below and the register's
 * right-click menu.
 */
export function useShareWithHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      ids,
    }: {
      groupId: string;
      ids: string[] | (() => Promise<string[]>);
    }) => ({
      groupId,
      result: await shareAll(groupId, typeof ids === 'function' ? await ids() : ids),
    }),
    onSuccess: ({ groupId, result }) => {
      void qc.invalidateQueries({ queryKey: ['households'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      const shared = result.results.filter((r) => r.ok && r.eventId).map((r) => r.transactionId);
      if (shared.length)
        useUndoStore.getState().push({
          description: `Share ${shared.length} with the household`,
          // By payment, not entry id: the entries may have been removed and recorded again
          // since (Stop sharing, then Undo), with new ids
          undo: async () => {
            await removeSharedEntries(groupId, shared);
            void qc.invalidateQueries({ queryKey: ['households'] });
            void qc.invalidateQueries({ queryKey: ['transactions'] });
          },
          redo: async () => {
            await shareAll(groupId, shared);
            void qc.invalidateQueries({ queryKey: ['households'] });
            void qc.invalidateQueries({ queryKey: ['transactions'] });
          },
        });
    },
  });
}

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
  const { data: groups = [] } = useQuery({ queryKey: ['households'], queryFn: getHouseholds });
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const share = useShareWithHousehold();
  const shareWith = (id: string) =>
    share.mutate(
      {
        groupId: id,
        ids: transactionId
          ? [transactionId]
          : (transactionIds ??
            (async () =>
              (await getTransactions(params ?? {}))
                .filter((t) => t.amount < 0 && !t.isParent && !t.transferTransactionId)
                .map((t) => t.id))),
      },
      {
        onSuccess: ({ result }) => {
          setOutcome(describeShare(result));
          onShared?.(result.sentIds);
        },
        onError: (e: Error) => setOutcome(e.message),
      },
    );
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
              <Button disabled={share.isPending} onClick={() => shareWith(chosen.id)}>
                Share
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
