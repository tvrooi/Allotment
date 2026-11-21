import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  CircleDashed,
  Eraser,
  Eye,
  EyeOff,
  Shapes,
  StickyNote,
  Tag,
  Trash2,
  UserPen,
  Users,
  X,
} from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useCanSave } from '../../hooks/useConnection';
import { useHouseholds } from '../../hooks/useHouseholds';
import { useTags } from '../../hooks/useTags';
import {
  useBulkEdit,
  type BulkChanges,
  type BulkResult,
  type BulkSkipReason,
  type EditTarget,
} from '../../hooks/useTransactionEdits';
import { useUndoStore } from '../../store/undoStore';
import { SAVING_PAUSED } from '../connection/savingPaused';
import { HouseholdIcon } from '../household/HouseholdIcon';
import { splitText, useShareWithHousehold } from '../household/ShareWithHousehold';
import { ContextMenu, type MenuItem, type MenuPoint } from '../ui/ContextMenu';
import { BulkDeleteModal } from './BulkDeleteModal';
import { CategoryPicker } from './CategoryPicker';

// The register's right-click (long-press, Shift+F10, ⋯, More actions) menu for the selected
// transactions. Every action applies to all of them at once, with no dialog: edits go through the
// existing bulk route (the server checks the count and skips rows an edit can't reach) and a
// toast offers Undo. Delete is the exception: it opens its own dialog, which previews the delete
// and asks for the word "delete". A write elsewhere in this menu goes through a hook, never a
// request here.

interface Props {
  /** The open menu: where it opens (null = closed) */
  menu: { at: MenuPoint } | null;
  /** The selected rows as the bulk route takes them: the register's params plus their ids (null =
   *  nothing is selected, so nothing here can write) */
  target: EditTarget | null;
  /** How many rows are selected: the count the server checks the edit against */
  count: number;
  /** The selected rows sharing with a household accepts */
  shareableIds: string[];
  onClose: () => void;
  /** Empties the selection */
  onClearSelection: () => void;
}

/** "2 reconciled transactions", "1 split transaction (change its parts instead)" */
const SKIP_TEXT: Record<BulkSkipReason, (n: number) => string> = {
  reconciled: (n) => `${n.toLocaleString()} reconciled transaction${n === 1 ? '' : 's'}`,
  transfer: (n) => `${n.toLocaleString()} transfer${n === 1 ? '' : 's'}`,
  split: (n) =>
    `${n.toLocaleString()} split transaction${n === 1 ? ' (change its parts instead)' : 's (change their parts instead)'}`,
  household: (n) =>
    `${n.toLocaleString()} transaction${n === 1 ? '' : 's'} linked to a household entry`,
};

const noun = (n: number) => `transaction${n === 1 ? '' : 's'}`;

/** What an edit did, and the rows it left alone (a transfer's category, say), in the toast */
function changedMessage(changed: number, result: BulkResult) {
  const skipped = (Object.keys(result.skipped) as BulkSkipReason[])
    .filter((reason) => result.skipped[reason] > 0)
    .map((reason) => SKIP_TEXT[reason](result.skipped[reason]));
  return (
    `Changed ${changed.toLocaleString()} of ${result.matched.toLocaleString()} ` +
    `${noun(result.matched)}.` +
    (skipped.length ? ` Left as they are: ${skipped.join(', ')}.` : '')
  );
}

/**
 * Stays mounted while the menu opens and closes, so an edit started from it can still report
 * back (the toast, the refresh) once the menu has closed.
 */
export function SelectionMenu({
  menu,
  target,
  count,
  shareableIds,
  onClose,
  onClearSelection,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: households = [] } = useHouseholds();
  const { data: groups = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const edit = useBulkEdit();
  const share = useShareWithHousehold();
  const canSave = useCanSave();
  const announce = useUndoStore((s) => s.announce);
  // The category list opens where the menu was, once the menu has closed
  const [picker, setPicker] = useState<MenuPoint | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLDivElement | null>(null);
  // Delete keeps the selection it was opened for: a selection that changes or ends behind its
  // dialog never widens what the dialog deletes
  const [deleting, setDeleting] = useState<EditTarget | null>(null);

  /** The one way an edit from this menu is applied: all selected rows, then Undo in the toast */
  const apply = (
    changes: BulkChanges,
    message: (changed: number, result: BulkResult) => string = changedMessage,
  ) =>
    target &&
    edit.mutate(
      { ...target, changes, expectedCount: count, message },
      {
        onError: (e: Error) => {
          // The server's own message (a changed or removed row, say); then the list catches up
          announce(e.message, false);
          void qc.invalidateQueries({ queryKey: ['transactions'] });
        },
      },
    );

  const shareWith = (h: (typeof households)[number]) =>
    share.mutate(
      { groupId: h.id, ids: shareableIds, householdName: h.name },
      { onError: (e: Error) => announce(e.message, false) },
    );

  const category: MenuItem = {
    key: 'category',
    label: 'Category…',
    icon: <Shapes size={14} />,
    onSelect: () => menu && setPicker(menu.at),
  };

  const payee: MenuItem = {
    key: 'payee',
    label: 'Payee…',
    icon: <UserPen size={14} />,
    prompt: {
      title: `Payee for ${count.toLocaleString()} ${noun(count)}`,
      label: 'New payee',
      submitLabel: 'Apply',
      // A free-text name, as the Edit dialog took it
      onSubmit: (payeeName) => apply({ payeeName }),
    },
  };

  const replaceNotes: MenuItem = {
    key: 'notes',
    label: 'Replace notes…',
    icon: <StickyNote size={14} />,
    prompt: {
      title: `Notes for ${count.toLocaleString()} ${noun(count)}`,
      label: 'New notes',
      submitLabel: 'Apply',
      onSubmit: (notes) => apply({ notes }),
    },
  };

  const removeNotes: MenuItem = {
    key: 'remove-notes',
    label: 'Remove notes',
    icon: <Eraser size={14} />,
    onSelect: () => apply({ notes: null }),
  };

  // Tags are listed in their own order; with none there is nothing to add or remove
  const tagItems = (change: (tagId: string) => BulkChanges): MenuItem[] =>
    tags.map((t) => ({
      key: t.id,
      label: t.name,
      icon: <Tag size={14} />,
      onSelect: () => apply(change(t.id)),
    }));
  const tagMenus: MenuItem[] = tags.length
    ? [
        {
          key: 'add-tag',
          label: 'Add tag',
          icon: <Tag size={14} />,
          separatorBefore: true,
          submenu: tagItems((id) => ({ addTagIds: [id] })),
        },
        {
          key: 'remove-tag',
          label: 'Remove tag',
          icon: <Tag size={14} />,
          submenu: tagItems((id) => ({ removeTagIds: [id] })),
        },
      ]
    : [];

  const reports: MenuItem = {
    key: 'reports',
    label: 'Reports',
    icon: <Eye size={14} />,
    submenu: [
      {
        key: 'hide',
        label: 'Hide from reports',
        icon: <EyeOff size={14} />,
        onSelect: () => apply({ hiddenFromReports: true }),
      },
      {
        key: 'show',
        label: 'Show in reports',
        icon: <Eye size={14} />,
        onSelect: () => apply({ hiddenFromReports: false }),
      },
    ],
  };

  const review: MenuItem = {
    key: 'review',
    label: 'Review',
    icon: <CheckCheck size={14} />,
    submenu: [
      {
        key: 'reviewed',
        label: 'Mark reviewed',
        icon: <CheckCheck size={14} />,
        onSelect: () => apply({ reviewed: true }, (n) => `Marked ${n} reviewed.`),
      },
      {
        key: 'not-reviewed',
        label: 'Mark not reviewed',
        icon: <CircleDashed size={14} />,
        onSelect: () => apply({ reviewed: false }, (n) => `Marked ${n} not reviewed.`),
      },
    ],
  };

  const shareLabel = `Share ${shareableIds.length.toLocaleString()} selected with`;
  const shareItem: MenuItem = !households.length
    ? {
        key: 'share',
        label: 'Share with a household…',
        hint: 'Set up a household first',
        icon: <Users size={14} />,
        separatorBefore: true,
        onSelect: () => navigate('/household'),
      }
    : !shareableIds.length
      ? {
          key: 'share',
          label: 'Share selected with',
          hint: 'None of these can be shared',
          icon: <Users size={14} />,
          separatorBefore: true,
          disabled: true,
        }
      : {
          key: 'share',
          label: shareLabel,
          hint:
            shareableIds.length < count
              ? `${(count - shareableIds.length).toLocaleString()} can't be shared`
              : undefined,
          icon: <Users size={14} />,
          separatorBefore: true,
          submenu: households.map((h) => ({
            key: h.id,
            label: h.name,
            hint: splitText(h),
            icon: <HouseholdIcon name={h.name} logo={h.logo} size="sm" />,
            onSelect: () => shareWith(h),
          })),
        };

  // Opens the dialog that previews the delete and asks for the word "delete" (never one click)
  const del: MenuItem = {
    key: 'delete',
    label: `Delete ${count.toLocaleString()}`,
    icon: <Trash2 size={14} />,
    danger: true,
    separatorBefore: true,
    onSelect: () => setDeleting(target),
  };

  // The items that write: one list, and one rule for all of them while saving is paused (every
  // change waits, with the reason on the item, a sub-menu's parent included). Opening /household
  // writes nothing, so that form of the share item stays as it is.
  const shareWrites = households.length > 0;
  const writing: MenuItem[] = [
    category,
    payee,
    replaceNotes,
    removeNotes,
    ...tagMenus,
    reports,
    review,
    shareItem,
    del,
  ];
  const whilePaused = (item: MenuItem): MenuItem =>
    canSave ? item : { ...item, disabled: true, hint: SAVING_PAUSED };
  const items: MenuItem[] = [
    ...writing.map((item) => (item === shareItem && !shareWrites ? item : whilePaused(item))),
    {
      key: 'clear',
      label: 'Clear selection',
      icon: <X size={14} />,
      separatorBefore: true,
      onSelect: onClearSelection,
    },
  ];

  return (
    <>
      {menu && (
        <ContextMenu
          items={items}
          at={menu.at}
          onClose={onClose}
          label={`Actions for ${count.toLocaleString()} selected transaction${count === 1 ? '' : 's'}`}
        />
      )}
      {picker && canSave && (
        <>
          {/* A point, not a button: the list opens where the menu did */}
          <div
            ref={setPickerAnchor}
            aria-hidden
            className="fixed size-0"
            style={{ left: picker.x, top: picker.y }}
          />
          {pickerAnchor && (
            // As the Edit dialog's list was: Uncategorised clears, hidden categories are
            // offered, and no new category is made here
            <CategoryPicker
              anchor={pickerAnchor}
              groups={groups}
              allowCreate={false}
              includeHidden
              onClose={() => setPicker(null)}
              onChange={(categoryId) => {
                setPicker(null);
                apply({ categoryId });
              }}
            />
          )}
        </>
      )}
      {deleting && (
        <BulkDeleteModal
          params={deleting.params}
          ids={deleting.ids}
          excludeIds={deleting.excludeIds}
          isOpen
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
