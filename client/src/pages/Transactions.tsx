import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { AddTransactionModal } from '../components/transactions/AddTransactionModal';
import { Button } from '../components/ui/Button';
import { SavedViewsMenu } from '../components/transactions/SavedViews';
import { useOpenFromLink } from '../hooks/useOpenFromLink';
import {
  FILTER_KEYS,
  filtersFromSearch,
  filtersToSearch,
  type FilterState,
} from '../utils/transactionFilters';

export default function TransactionsPage() {
  const [showAdd, setShowAdd] = useState(false);
  useOpenFromLink('add', () => setShowAdd(true));

  // The filters live in the URL, so reload, back and drill-down links keep them. A URL the
  // register didn't write itself (a link followed while already here) starts it afresh.
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const own = useRef({ search, generation: 0 });
  if (search !== own.current.search) {
    own.current = { search, generation: own.current.generation + 1 };
  }
  const onFiltersChange = useCallback(
    (filters: FilterState) => {
      setParams(
        (prev) => {
          // Other keys (like ?add=1) belong to the page
          const next = filtersToSearch(filters);
          for (const [key, value] of prev) if (!FILTER_KEYS.has(key)) next.set(key, value);
          own.current = { ...own.current, search: next.toString() };
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-text">All Transactions</h1>
        <div className="flex items-center gap-2">
          <SavedViewsMenu />
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add
          </Button>
        </div>
      </div>
      <TransactionTable
        key={own.current.generation}
        initialFilters={filtersFromSearch(params)}
        onFiltersChange={onFiltersChange}
        canSaveView
        onAddTransaction={() => setShowAdd(true)}
      />
      <AddTransactionModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
