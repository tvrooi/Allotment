import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import type { CategoryGroup } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reassignTo: string) => void;
  categoryName: string;
  categoryId: string;
  transactionCount: number;
  /** Money is assigned to the category in some month; it moves with the transactions */
  hasAssignments: boolean;
  groups: CategoryGroup[];
}

export function DeleteCategoryModal({
  isOpen,
  onClose,
  onConfirm,
  categoryName,
  categoryId,
  transactionCount,
  hasAssignments,
  groups,
}: Props) {
  const [reassignTo, setReassignTo] = useState('');
  // Income and expense categories only merge within their own kind, never into themselves
  const filteredGroups = useMemo(() => {
    const sourceIsIncome =
      groups.find((g) => g.categories.some((c) => c.id === categoryId))?.isIncome ?? 0;
    return groups
      .filter((g) => g.isIncome === sourceIsIncome)
      .map((g) => ({
        ...g,
        categories: g.categories.filter((c) => c.id !== categoryId),
      }))
      .filter((g) => g.categories.length > 0);
  }, [groups, categoryId]);

  function handleConfirm() {
    if (!reassignTo) return;
    onConfirm(reassignTo);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge into another category" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-text">{categoryName}</span> has{' '}
          <span className="font-medium text-text">{transactionCount}</span> transaction
          {transactionCount !== 1 ? 's' : ''}
          {hasAssignments ? ' and assigned money' : ''}. Merge it into another category:{' '}
          {transactionCount > 0 && hasAssignments
            ? 'they move'
            : transactionCount > 0
              ? 'the transactions move'
              : 'the money moves'}{' '}
          there, then {categoryName} is removed.
        </p>
        {hasAssignments && (
          <p className="text-xs text-caution">
            The money assigned to this category in every month moves into the chosen category too,
            so none of it is lost.
          </p>
        )}
        <CategorySelectButton
          label="Merge into"
          placeholder="Select a category…"
          value={reassignTo || null}
          onChange={(id) => setReassignTo(id ?? '')}
          groups={filteredGroups}
          allowNone={false}
          allowCreate={false}
          includeHidden
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={!reassignTo}>
          Merge & remove
        </Button>
      </div>
    </Modal>
  );
}
