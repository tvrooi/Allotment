import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../ui/ConfirmModal';
import NameModal from '../reports/dashboard/NameModal';
import RowMenu from '../ui/RowMenu';
import { Button } from '../ui/Button';
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '../../hooks/useTags';
import { transactionsLink } from '../../utils/transactionFilters';
import type { Tag } from '../../types';

// Settings → Tags (phase 9): rename, recolour and delete tags. Deleting a tag removes it from
// its transactions; the transactions themselves stay.

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b'];

export function TagManager() {
  const { data: tags = [] } = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const error = create.error ?? update.error ?? remove.error;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Tags</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Label transactions across categories, like a holiday or a renovation. Add tags in a
            transaction's details or with a rule.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add tag
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error.message}
        </p>
      )}
      {tags.length === 0 ? (
        <p className="text-sm text-text-tertiary">No tags yet.</p>
      ) : (
        <ul className="divide-y divide-border-light border border-border-light rounded-lg">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <label className="relative h-4 w-4 shrink-0 cursor-pointer">
                <span className="sr-only">Colour for {t.name}</span>
                <select
                  value={t.color}
                  onChange={(e) => update.mutate({ id: t.id, color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {[...new Set([t.color, ...COLORS])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
              </label>
              <span className="flex-1 min-w-0 truncate text-sm text-text">{t.name}</span>
              <Link
                to={transactionsLink({ tagIds: [t.id], datePreset: 'all' })}
                className="text-xs text-brand-600 hover:text-brand-700 tabular-nums"
              >
                {t.count ?? 0} transaction{t.count === 1 ? '' : 's'}
              </Link>
              <RowMenu
                label={`Actions for ${t.name}`}
                items={[
                  { label: 'Rename', onClick: () => setRenaming(t) },
                  { label: 'Delete tag', danger: true, onClick: () => setDeleting(t) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <NameModal
          title="Add tag"
          label="Name"
          placeholder="e.g. Holiday"
          submitLabel="Add tag"
          onClose={() => setAdding(false)}
          onSave={(name) => {
            create.mutate({ name, color: COLORS[tags.length % COLORS.length] });
            setAdding(false);
          }}
        />
      )}
      {renaming && (
        <NameModal
          title="Rename tag"
          label="Name"
          initialName={renaming.name}
          submitLabel="Rename"
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            update.mutate({ id: renaming.id, name });
            setRenaming(null);
          }}
        />
      )}
      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(null);
        }}
        title="Delete tag"
        message={`Delete "${deleting?.name ?? ''}"? It is removed from ${deleting?.count ?? 0} transaction${deleting?.count === 1 ? '' : 's'}; the transactions stay.`}
        confirmLabel="Delete tag"
        danger
      />
    </div>
  );
}
