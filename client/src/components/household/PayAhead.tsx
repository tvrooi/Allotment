import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react';
import { recordPaidAhead, removeSharedEntries, type HouseholdSummary } from '../../api/households';
import { useCanSave } from '../../hooks/useConnection';
import { useHouseholds } from '../../hooks/useHouseholds';
import { useUndoStore } from '../../store/undoStore';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Input';
import type { Transaction } from '../../types';

// "Paid ahead": your payment to someone you share costs with, towards a shared expense they
// will record (or you will, for them) later. It is saved as a repayment paid ahead, so until the
// expense is recorded they owe it back; once it is, your share nets it off (docs/HOUSEHOLDS.md
// "Paying ahead for a shared expense"). Used by the register's menu and the details panel.

export interface PayAheadTarget {
  household: HouseholdSummary;
  person: { id: string; name: string };
  selfId: string;
}

/** Why this payment can't be paid ahead to someone (null = it can) */
export function whyNotPayAhead(tx: Transaction, households: HouseholdSummary[]): string | null {
  if (tx.household) return 'Already in a household';
  if (tx.isAdjustment) return "A balance correction can't be paid ahead";
  if (tx.transferTransactionId) return 'A transfer between your own accounts';
  if (tx.isParent || tx.parentTransactionId) return "A split payment can't be paid ahead";
  if (tx.amount >= 0) return 'Only money you paid out';
  if (households.some((h) => h.poolAccountIds.includes(tx.accountId)))
    return 'Money out of the household account is a household expense';
  return null;
}

/** Everyone but you, in each household */
export const payAheadTargets = (households: HouseholdSummary[]): PayAheadTarget[] =>
  households.flatMap((household) => {
    const self = household.people.find((p) => p.isSelf);
    return self
      ? household.people
          .filter((p) => !p.isSelf)
          .map((person) => ({ household, person, selfId: self.id }))
      : [];
  });

/** Records the payment as paid ahead, refreshes what shows it, and adds one undo step */
export function usePayAhead() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['households'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
  };
  return useMutation({
    mutationFn: async ({ tx, target }: { tx: Transaction; target: PayAheadTarget }) => {
      await recordPaidAhead(target.household.id, tx, target.selfId, target.person);
      return { tx, target };
    },
    onSuccess: ({ tx, target }) => {
      refresh();
      const groupId = target.household.id;
      useUndoStore.getState().push(
        {
          description: `Paid ahead to ${target.person.name}`,
          undo: async () => {
            await removeSharedEntries(groupId, [tx.id], 'settlement');
            refresh();
          },
          redo: async () => {
            await recordPaidAhead(groupId, tx, target.selfId, target.person);
            refresh();
          },
        },
        // The toast says what happened and offers Undo
        { message: describePayAhead(target) },
      );
    },
  });
}

/** What paying ahead did, in a sentence for a toast */
export const describePayAhead = (t: PayAheadTarget) =>
  `Paid ahead to ${t.person.name}. It counts towards your share once the expense is recorded in ${t.household.name}.`;

/** The details panel's button: choose who it was for, with what it means */
export function PayAhead({ tx }: { tx: Transaction }) {
  const { data: households = [] } = useHouseholds();
  const canSave = useCanSave();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const payAhead = usePayAhead();
  const targets = payAheadTargets(households);
  if (!targets.length || whyNotPayAhead(tx, households)) return null;
  const target = targets[Math.min(chosen, targets.length - 1)];
  const many = households.length > 1;

  return (
    <>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <HandCoins size={14} /> Paid ahead for a shared expense
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Paid ahead for a shared expense"
        size="sm"
      >
        <div className="space-y-3 text-sm">
          <Select
            aria-label="Paid to"
            value={String(chosen)}
            onChange={(e) => setChosen(Number(e.target.value))}
          >
            {targets.map((t, i) => (
              <option key={`${t.household.id}:${t.person.id}`} value={i}>
                {many ? `${t.person.name} (${t.household.name})` : t.person.name}
              </option>
            ))}
          </Select>
          <p className="text-text-secondary">
            For money you sent {target.person.name} towards something you share that hasn’t been
            recorded yet. Until it is, {target.person.name} owes it back to you. When the expense is
            recorded in {target.household.name} (by you, or by them in a combined household), your
            share comes off it.
          </p>
          {error && <p role="alert">{error}</p>}
          <SavingPausedHint />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canSave || payAhead.isPending}
              onClick={() =>
                payAhead.mutate(
                  { tx, target },
                  {
                    // The payment is linked now, so the panel shows that instead of this button;
                    // the toast says what happened and offers Undo
                    onSuccess: () => setOpen(false),
                    onError: (e: Error) => setError(e.message),
                  },
                )
              }
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
