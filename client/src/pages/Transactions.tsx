import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { Button } from '../components/ui/Button';
import { SavedViewsMenu } from '../components/transactions/SavedViews';
import { useOpenFromLink } from '../hooks/useOpenFromLink';
import { useAddTransactionStore } from '../store/addTransactionStore';
import { ReceiptsTab, ScanReceiptButton, useAddReceipts } from '../components/receipts/ReceiptsTab';
import { Tip } from '../components/guide/Tip';
import { TIPS } from '../guides';
import { tabIds, TabList } from '../components/ui/tabList';
import { useFilterSearch } from '../hooks/useFilterSearch';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

export default function TransactionsPage() {
  // The app shell's Add transaction dialog (one for every page)
  const showAdd = useAddTransactionStore((s) => s.show);
  useOpenFromLink('add', showAdd);

  // The filters live in the URL, so reload, back and drill-down links keep them. A URL the
  // register didn't write itself (a link followed while already here) starts it afresh.
  const location = useLocation();
  const navigate = useNavigate();
  const state: unknown = location.state;
  const initialDetailId =
    state &&
    typeof state === 'object' &&
    'transactionDetailId' in state &&
    typeof state.transactionDetailId === 'string'
      ? state.transactionDetailId
      : undefined;
  // Consume the palette's router state after the table has taken its initial selection.
  useEffect(() => {
    if (!initialDetailId) return;
    const nextState = { ...(state as Record<string, unknown>) };
    delete nextState.transactionDetailId;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: nextState },
    );
  }, [initialDetailId, state, navigate, location.pathname, location.search, location.hash]);
  const [params, setParams] = useSearchParams();
  // A new palette choice also reopens details when the search URL itself is unchanged.
  const filters = useFilterSearch({ restartKey: initialDetailId ? location.key : null });
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
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`pt-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            {view === 'receipts' ? 'Receipts' : 'Transactions'}
          </h1>
          <div className="flex items-center gap-2">
            {view === 'all' && <SavedViewsMenu />}
            {view === 'all' && <ScanReceiptButton onFiles={scan.add} compactOnPhone />}
            <Button size="sm" onClick={showAdd} data-guide="transactions.add">
              <Plus size={13} /> Add
            </Button>
          </div>
        </div>
        <TabList
          label="Transactions view"
          data-guide="transactions.tabs"
          className="scroll-row flex gap-1 mt-2 -mb-px"
        >
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
              id={tabIds('transactions', id).tab}
              aria-controls={tabIds('transactions', id).panel}
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
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
        </TabList>
      </div>
      {scan.error && (
        <p role="alert" className={`py-2 text-sm text-negative ${PAGE_GUTTER}`}>
          {scan.error}
        </p>
      )}
      {view === 'all' && (
        <Tip
          tip={TIPS.undoKey}
          desktopOnly
          className={`py-2.5 border-b border-border-light shrink-0 ${PAGE_GUTTER}`}
        />
      )}
      <div
        role="tabpanel"
        id={tabIds('transactions', view).panel}
        aria-labelledby={tabIds('transactions', view).tab}
        className="flex flex-col flex-1 min-h-0"
      >
        {view === 'receipts' ? (
          <ReceiptsTab openId={openReceipt} onOpen={(id) => setPageParam({ receipt: id })} />
        ) : (
          <TransactionTable
            key={filters.generation}
            initialFilters={filters.initialFilters}
            initialDetailId={initialDetailId}
            onFiltersChange={filters.onFiltersChange}
            canSaveView
            onAddTransaction={showAdd}
          />
        )}
      </div>
    </div>
  );
}
