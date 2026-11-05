import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, PanelRight, SlidersHorizontal, Users, UserMinus } from 'lucide-react';
import {
  getHouseholdEvents,
  removeHouseholdEvent,
  removeSharedEntries,
  restoreHouseholdEvent,
  type HouseholdSummary,
} from '../../api/households';
import { useHouseholds } from '../../hooks/useHouseholds';
import { useUndoStore } from '../../store/undoStore';
import { HouseholdIcon } from '../household/HouseholdIcon';
import { describeShare, splitText, useShareWithHousehold } from '../household/ShareWithHousehold';
import { ContextMenu, type MenuItem, type MenuPoint } from '../ui/ContextMenu';
import type { Transaction } from '../../types';

// The register's right-click (long-press, Shift+F10, ⋯) menu for one transaction: open it,
// share it with a household in one step (default split, Undo in the toast), or see and stop
// how it's shared. Right-clicking one of several picked payments shares all of them.

/** Why a payment can't be shared from here (null = it can), as sharing in the register decides */
export function whyNotShareable(tx: Transaction): string | null {
  if (tx.isAdjustment) return "A balance correction can't be shared";
  if (tx.transferTransactionId) return "A transfer can't be shared";
  if (tx.isParent) return "A split payment can't be shared as a whole";
  if (tx.amount >= 0) return 'Only money out can be shared';
  return null;
}

const payeeOf = (tx: Transaction) => tx.payeeName || 'this payment';

interface Props {
  /** The open menu: for which transaction, and where (null = closed) */
  menu: { tx: Transaction; at: MenuPoint } | null;
  /** The payments picked to share in the register, when picking */
  pickedIds?: string[];
  onOpenDetail: (id: string) => void;
  onClose: () => void;
}

/**
 * Stays mounted while the menu opens and closes, so a share or stop started from it can still
 * report back once the menu has closed.
 */
export function TransactionContextMenu({ menu, pickedIds = [], onOpenDetail, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: households = [] } = useHouseholds();
  const share = useShareWithHousehold();
  const announce = useUndoStore((s) => s.announce);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['households'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
  };
  const stopSharing = useMutation({
    mutationFn: async ({ h, tx }: { h: HouseholdSummary; tx: Transaction }) => {
      const { eventId } = tx.household!;
      const entry = (await getHouseholdEvents(h.id)).find((e) => e.id === eventId);
      if (!entry) throw new Error('That household entry was already removed');
      await removeHouseholdEvent(h.id, eventId);
      return { h, entry, name: payeeOf(tx) };
    },
    onSuccess: ({ h, entry, name }) => {
      refresh();
      // Undo records it again exactly as it was, split included (with a new id, so redo and an
      // earlier share's undo find it by its payment)
      useUndoStore.getState().push({
        description: `Stop sharing ${name} with ${h.name}`,
        undo: async () => {
          await restoreHouseholdEvent(h.id, entry);
          refresh();
        },
        redo: async () => {
          await removeSharedEntries(h.id, [entry.transactionId!]);
          refresh();
        },
      });
      announce(`Stopped sharing ${name} with ${h.name}.`, true);
    },
    onError: (e: Error) => announce(e.message, false),
  });

  const shareWith = (h: HouseholdSummary, ids: string[]) =>
    share.mutate(
      { groupId: h.id, ids },
      {
        onSuccess: ({ result }) => announce(describeShare(result, h.name), result.shared > 0),
        onError: (e: Error) => announce(e.message, false),
      },
    );

  if (!menu) return null;
  const { tx, at } = menu;
  const name = payeeOf(tx);
  const linked = tx.household ? households.find((h) => h.id === tx.household!.id) : undefined;
  // Right-clicking one of several picked payments acts on all of them
  const ids = pickedIds.length > 1 && pickedIds.includes(tx.id) ? pickedIds : [tx.id];

  const items: MenuItem[] = [
    {
      key: 'open',
      label: 'Open details',
      icon: <PanelRight size={14} />,
      onSelect: () => onOpenDetail(tx.id),
    },
  ];
  const reason = whyNotShareable(tx);
  if (tx.household && linked) {
    const shared = tx.household.kind === 'expense';
    items.push({
      key: 'view',
      label: `View in ${linked.name}`,
      hint: shared ? `Shared with ${linked.name}` : `Linked to ${linked.name}`,
      icon: <HouseholdIcon name={linked.name} logo={linked.logo} size="xs" />,
      separatorBefore: true,
      onSelect: () => navigate(`/household?household=${encodeURIComponent(linked.id)}`),
    });
    if (shared)
      items.push({
        key: 'stop',
        label: `Stop sharing with ${linked.name}`,
        icon: <UserMinus size={14} />,
        danger: true,
        onSelect: () => stopSharing.mutate({ h: linked, tx }),
      });
  } else if (!households.length) {
    items.push({
      key: 'setup',
      label: 'Share with a household…',
      hint: 'Set up a household first',
      icon: <Users size={14} />,
      separatorBefore: true,
      onSelect: () => navigate('/household'),
    });
  } else if (reason) {
    items.push({
      key: 'share',
      label: 'Share with',
      hint: reason,
      icon: <Users size={14} />,
      separatorBefore: true,
      disabled: true,
    });
  } else {
    items.push({
      key: 'share',
      label: ids.length > 1 ? `Share ${ids.length.toLocaleString()} picked with` : 'Share with',
      icon: <Users size={14} />,
      separatorBefore: true,
      submenu: [
        ...households.map((h) => ({
          key: h.id,
          label: h.name,
          hint: splitText(h),
          icon: <HouseholdIcon name={h.name} logo={h.logo} size="sm" />,
          onSelect: () => shareWith(h, ids),
        })),
        ...(ids.length === 1
          ? [
              {
                key: 'custom',
                label: 'Custom split…',
                hint: 'Choose who pays what',
                icon: <SlidersHorizontal size={14} />,
                separatorBefore: true,
                onSelect: () =>
                  navigate(
                    `/household?household=${encodeURIComponent(households[0].id)}&transaction=${encodeURIComponent(tx.id)}`,
                  ),
              },
            ]
          : []),
      ],
    });
  }
  if (tx.household && !linked)
    items.push({
      key: 'household',
      label: 'Open household',
      icon: <ExternalLink size={14} />,
      separatorBefore: true,
      onSelect: () => navigate('/household'),
    });

  return <ContextMenu items={items} at={at} onClose={onClose} label={`Actions for ${name}`} />;
}
