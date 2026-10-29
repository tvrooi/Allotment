import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAllAccounts } from '../../api/accounts';
import { useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAccounts, useReorderAccounts } from '../../hooks/useAccounts';
import { Badge } from '../ui/Badge';
import { formatMoney } from '../../utils/currency';
import { useHideBalances } from '../../utils/safeMode';
import { Private } from '../ui/Private';
import type { Account, AccountType } from '../../types';

function SortableAccountRow({ account }: { account: Account }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const hide = useHideBalances();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-2.5 bg-surface border border-border-light rounded-md hover:border-border transition-all"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-text-disabled hover:text-text-tertiary cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <span className="text-sm font-medium text-text-secondary flex-1 min-w-0 truncate">
        {account.name}
      </span>
      <Badge variant={account.type as AccountType} />
      <span
        className={`text-sm tabular-nums font-medium shrink-0 ${account.balance >= 0 || hide ? 'text-text-secondary' : 'text-negative'}`}
      >
        <Private>{formatMoney(account.balance, account.currency)}</Private>
      </span>
    </div>
  );
}

function AccountSection({
  title,
  accounts,
  onReorder,
}: {
  title: string;
  accounts: Account[];
  onReorder: (ids: string[]) => void;
}) {
  const [local, setLocal] = useState(accounts);
  useEffect(() => {
    setLocal(accounts);
  }, [accounts]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = local.findIndex((a) => a.id === active.id);
    const newIndex = local.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(local, oldIndex, newIndex);
    setLocal(reordered);
    onReorder(reordered.map((a) => a.id));
  }

  if (accounts.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-text-tertiary mb-2">{title}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={local.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {local.map((account) => (
              <SortableAccountRow key={account.id} account={account} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function AccountReorder() {
  const { data: accounts = [], isLoading } = useAccounts();
  const reorderAccounts = useReorderAccounts();
  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts', 'including-closed'],
    queryFn: getAllAccounts,
  });
  const closed = allAccounts.filter((a) => a.closedAt);

  const onBudget = accounts.filter((a) => !a.isOffBudget);
  const offBudget = accounts.filter((a) => a.isOffBudget);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
        Loading...
      </div>
    );
  }

  if (accounts.length === 0 && closed.length === 0) {
    return (
      <p className="text-sm text-text-tertiary text-center py-8">
        No accounts yet. Add one from the Accounts page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-text">Account Order</h2>
        <p className="text-xs text-text-tertiary mt-0.5">
          Drag to reorder accounts in the sidebar.
        </p>
      </div>
      {!!closed.length && (
        <section aria-label="Closed accounts" className="space-y-2">
          <h3 className="text-sm font-semibold">Closed accounts</h3>
          <p className="text-xs text-text-secondary">
            Closing an account keeps its history. Any remaining balance must be reviewed and
            reconciled to zero.
          </p>
          {closed.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border rounded-md p-3 text-sm">
              <span className="flex-1">{a.name}</span>
              <Private>{formatMoney(a.balance, a.currency)}</Private>
              {a.balance !== 0 && (
                <Link className="underline text-caution" to={`/accounts/${a.id}/reconcile`}>
                  Reconcile to zero
                </Link>
              )}
            </div>
          ))}
        </section>
      )}
      <AccountSection
        title="On Budget"
        accounts={onBudget}
        onReorder={(ids) => reorderAccounts.mutate([...ids, ...offBudget.map((a) => a.id)])}
      />
      <AccountSection
        title="Off Budget"
        accounts={offBudget}
        onReorder={(ids) => reorderAccounts.mutate([...onBudget.map((a) => a.id), ...ids])}
      />
    </div>
  );
}
