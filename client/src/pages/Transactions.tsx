import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { AddTransactionModal } from '../components/transactions/AddTransactionModal';
import { Button } from '../components/ui/Button';
import { SavedViewsMenu } from '../components/transactions/SavedViews';
import { useOpenFromLink } from '../hooks/useOpenFromLink';
import { ReceiptsTab, ScanReceiptButton, useAddReceipts } from '../components/receipts/ReceiptsTab';
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
  // The Receipts tab, and the receipt open on it, live in the URL too
  const view = params.get('view') === 'receipts' ? 'receipts' : 'all';
  const openReceipt = params.get('receipt');
  const setPageParam = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  // Like Monarch's Add > Scan receipt: upload, then open it on the Receipts tab
  const scan = useAddReceipts((r) => setPageParam({ view: 'receipts', receipt: r.id }));
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
      <div className="px-6 pt-4 max-md:px-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
            {view === 'receipts' ? 'Receipts' : 'All Transactions'}
          </h1>
          <div className="flex items-center gap-2">
            {view === 'all' && <SavedViewsMenu />}
            {view === 'all' && <ScanReceiptButton onFiles={scan.add} />}
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Add
            </Button>
          </div>
        </div>
        <div className="flex gap-1 mt-2 -mb-px" role="tablist" aria-label="Transactions view">
          {(
            [
              ['all', 'All'],
              ['receipts', 'Receipts'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setPageParam({ view: id === 'all' ? null : id, receipt: null })}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 max-md:min-h-11 ${
                view === id
                  ? 'border-brand-600 text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {scan.error && (
        <p role="alert" className="px-6 py-2 text-sm text-negative">
          {scan.error}
        </p>
      )}
      {view === 'receipts' ? (
        <ReceiptsTab openId={openReceipt} onOpen={(id) => setPageParam({ receipt: id })} />
      ) : (
        <TransactionTable
          key={own.current.generation}
          initialFilters={filtersFromSearch(params)}
          onFiltersChange={onFiltersChange}
          canSaveView
          onAddTransaction={() => setShowAdd(true)}
        />
      )}
      <AddTransactionModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
