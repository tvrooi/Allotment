import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2, GitMerge, Pencil, Search, Store } from 'lucide-react';
import { usePayees, useUpdatePayee, useDeletePayee, useMergePayees } from '../hooks/usePayees';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal, useModalValue } from '../components/ui/Modal';
import { Button, ButtonLink } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Input } from '../components/ui/Input';
import { Radio, RadioGroup } from '../components/ui/RadioGroup';
import { EmptyState } from '../components/ui/EmptyState';
import { QueryProblem, loadFailed } from '../components/ui/QueryProblem';
import { PayeeIcon } from '../components/payees/PayeeIcon';
import { DefaultCategoryButton } from '../components/payees/DefaultCategoryButton';
import RowMenu, { type RowMenuItem } from '../components/ui/RowMenu';
import { useIsPhone } from '../hooks/useIsPhone';
import { useCanSave } from '../hooks/useConnection';
import type { PayeeWithCount } from '../types';
import { Tip } from '../components/guide/Tip';
import { TIPS } from '../guides';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

function MergeModal({
  isOpen,
  selected,
  payees,
  onMerge,
  onClose,
}: {
  isOpen: boolean;
  selected: string[];
  payees: PayeeWithCount[];
  onMerge: (keepId: string, mergeIds: string[]) => void;
  onClose: () => void;
}) {
  const [keepId, setKeepId] = useState(selected[0]);
  const selectedPayees = payees.filter((p) => selected.includes(p.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge payees" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Choose which payee name to keep. All transactions will be moved to the selected payee.
        </p>
        <RadioGroup
          aria-label="Payee to keep"
          value={keepId}
          onChange={setKeepId}
          className="w-full [&>div]:w-full"
        >
          {selectedPayees.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border transition-colors [&_label]:flex [&_label]:w-full [&_label]:items-center [&_label]:gap-3 [&_label]:p-3 ${
                keepId === p.id ? 'border-brand-600 bg-brand-50' : 'border-border hover:bg-hover'
              }`}
            >
              <Radio value={p.id}>
                <span className="flex items-center gap-3">
                  <PayeeIcon name={p.name} logo={p.logo} size="md" force />
                  <span>
                    <span className="block text-sm font-medium text-text">{p.name}</span>
                    <span className="block text-xs text-text-tertiary">
                      {p.transactionCount} transaction{p.transactionCount !== 1 ? 's' : ''}
                    </span>
                  </span>
                </span>
              </Radio>
            </div>
          ))}
        </RadioGroup>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onMerge(
                keepId,
                selected.filter((id) => id !== keepId),
              );
              onClose();
            }}
          >
            Merge
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function PayeesPage() {
  // Back and Forward return to where this list was (#245)
  const scrollMemory = useScrollMemory('payees');
  const payeesQuery = usePayees();
  const { data: payees = [], isLoading } = payeesQuery;
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();
  const mergePayees = useMergePayees();

  // The search lives in the URL, so Back returns to it (#245); typing replaces the entry
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const setSearch = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('search', value);
        else next.delete('search');
        return next;
      },
      { replace: true },
    );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const mergeModal = useModalValue(showMerge);

  const filtered = useMemo(
    () => payees.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [payees, search],
  );
  const selectedInView = useMemo(
    () => filtered.filter((p) => selected.has(p.id)).length,
    [filtered, selected],
  );
  const allSelected = filtered.length > 0 && selectedInView === filtered.length;
  const someSelected = selectedInView > 0 && selectedInView < filtered.length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEditName(p: PayeeWithCount) {
    setEditingId(p.id);
    setEditingName(p.name);
  }

  function commitEditName(id: string) {
    if (editingName.trim()) updatePayee.mutate({ id, name: editingName.trim() });
    setEditingId(null);
  }

  function handleMerge(keepId: string, mergeIds: string[]) {
    mergePayees.mutate({ keepId, mergeIds }, { onSuccess: () => setSelected(new Set()) });
  }

  const deleteTarget = payees.find((p) => p.id === deleteId);
  const isPhone = useIsPhone();
  // Renaming and logos need the server: not offered while saving is paused
  const canSave = useCanSave();

  // A row's ⋮ menu: phones, and the table on a touch screen (no hover, so no hidden buttons)
  const rowActions = (p: PayeeWithCount): RowMenuItem[] => [
    { label: 'Rename', onClick: () => startEditName(p), hidden: !canSave },
    {
      label: 'Remove image',
      onClick: () =>
        updatePayee.mutate({ id: p.id, logo: null, message: `Removed the image for ${p.name}` }),
      hidden: !canSave || !p.logo,
    },
    { label: 'Delete', danger: true, onClick: () => setDeleteId(p.id) },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`py-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            Payees
          </h1>
          <div className="flex items-center gap-2 min-w-0">
            {selected.size >= 2 && (
              <button
                onClick={() => setShowMerge(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 max-md:min-h-11 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 transition-colors"
              >
                <GitMerge size={13} />
                Merge {selected.size} payees
              </button>
            )}
            <div className="relative min-w-0" data-guide="payees.search">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <Input
                fieldSize="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search payees…"
                aria-label="Search payees"
                className="w-full min-w-0 pl-8"
              />
            </div>
          </div>
        </div>
      </div>
      {payees.length > 0 && (
        <Tip
          tip={TIPS.payeeDefault}
          className={`py-2.5 border-b border-border-light shrink-0 ${PAGE_GUTTER}`}
        />
      )}

      {!loadFailed(payeesQuery) && (
        <QueryProblem what="payees" query={payeesQuery} className="mx-6 my-3 max-md:mx-4" />
      )}
      <div ref={scrollMemory} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
            Loading...
          </div>
        ) : loadFailed(payeesQuery) ? (
          <QueryProblem what="payees" query={payeesQuery} />
        ) : filtered.length === 0 ? (
          search ? (
            <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
              No payees match your search.
            </div>
          ) : (
            <EmptyState
              icon={<Store size={26} />}
              title="No payees yet"
              description="Payees are the people and businesses you pay or get paid by. They’re added automatically as you enter or import transactions, and you can give each one a default category."
              actions={
                <ButtonLink variant="secondary" to="/transactions?add=1">
                  Add a transaction
                </ButtonLink>
              }
            />
          )
        ) : isPhone ? (
          // Phones: a card per payee. Renaming and deleting are in the ⋮ menu (no hover or
          // double-click on a touch screen), and ticking two or more offers "Merge"
          <ul aria-label="Payees" data-guide="payees.list">
            <li className="flex items-center min-h-11 px-4 border-b border-border-light bg-surface-alt">
              <Checkbox
                aria-label="Select all payees"
                checked={allSelected}
                isIndeterminate={someSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set())
                }
                className="gap-3 text-text-secondary"
              >
                Select all
              </Checkbox>
            </li>
            {filtered.map((p) => (
              <li
                key={p.id}
                data-testid="payee-card"
                className={`grid gap-2 px-4 py-3 border-b border-border-light ${selected.has(p.id) ? 'bg-brand-50' : 'bg-surface'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    aria-label={`Select ${p.name}`}
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleSelect(p.id)}
                    className="-ml-3"
                  />
                  <PayeeIcon
                    name={p.name}
                    logo={p.logo}
                    size="md"
                    force
                    onLogoChange={
                      canSave ? (logo) => updatePayee.mutate({ id: p.id, logo }) : undefined
                    }
                    inList
                  />
                  {editingId === p.id ? (
                    <Input
                      autoFocus
                      fieldSize="sm"
                      aria-label={`Rename ${p.name}`}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitEditName(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditName(p.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 min-w-0"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 grid">
                      <Link
                        to={`/payees/${p.id}`}
                        className="truncate text-row font-medium text-text hover:text-brand-600"
                      >
                        {p.name}
                      </Link>
                      <span className="text-xs text-text-tertiary">
                        {p.transactionCount} transaction{p.transactionCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  )}
                  <RowMenu label={`Actions for ${p.name}`} items={rowActions(p)} />
                </div>
                <DefaultCategoryButton payee={p} className="w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <table className="w-full">
              <thead className="sticky top-0 bg-surface-alt border-b border-border z-10">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <Checkbox
                      aria-label="Select all payees"
                      checked={allSelected}
                      isIndeterminate={someSelected}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set())
                      }
                      className="align-middle"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">
                    Name
                  </th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-text-tertiary"
                    data-guide="payees.default"
                  >
                    Default category
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-text-tertiary">
                    Transactions
                  </th>
                  <th className="w-20 px-4 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`group hover:bg-hover transition-colors ${selected.has(p.id) ? 'bg-brand-50' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <Checkbox
                        aria-label={`Select ${p.name}`}
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                        className="align-middle"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <PayeeIcon
                          name={p.name}
                          logo={p.logo}
                          size="md"
                          force
                          onLogoChange={
                            canSave ? (logo) => updatePayee.mutate({ id: p.id, logo }) : undefined
                          }
                          inList
                        />
                        {editingId === p.id ? (
                          <Input
                            autoFocus
                            fieldSize="sm"
                            aria-label={`Rename ${p.name}`}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => commitEditName(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEditName(p.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full max-w-xs"
                          />
                        ) : (
                          <Link
                            to={`/payees/${p.id}`}
                            className="text-sm font-medium text-text hover:text-brand-600 transition-colors"
                          >
                            {p.name}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <DefaultCategoryButton payee={p} className="max-w-[260px]" />
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-text-secondary">
                      {p.transactionCount}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      {/* Renaming is a visible button, as on phones (no double-click). A touch
                          screen gets the phone's ⋮ menu instead, which also removes the image */}
                      <span className="hidden touch:inline-block align-middle">
                        <RowMenu label={`Actions for ${p.name}`} items={rowActions(p)} />
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditName(p)}
                        disabled={!canSave}
                        aria-label={`Rename ${p.name}`}
                        title="Rename"
                        className="p-1 pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex touch:hidden items-center justify-center align-middle text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex touch:hidden items-center justify-center align-middle text-text-tertiary hover:text-negative transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mergeModal.value && (
        <MergeModal
          isOpen={mergeModal.isOpen}
          selected={[...selected]}
          payees={payees}
          onMerge={handleMerge}
          onClose={() => setShowMerge(false)}
        />
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => (deleteId ? deletePayee.mutateAsync(deleteId) : undefined)}
        pendingLabel="Deleting…"
        title="Delete payee"
        message={`Delete "${deleteTarget?.name}"? This will remove the payee from all their transactions.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
