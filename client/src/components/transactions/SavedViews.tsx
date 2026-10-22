import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import NameModal from '../reports/dashboard/NameModal';
import RowMenu from '../ui/RowMenu';
import { Button } from '../ui/Button';
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
} from '../../hooks/useTags';
import { filtersToSearch, type FilterState } from '../../utils/transactionFilters';
import type { SavedView } from '../../types';

// Phase 9 saved views: an All Transactions URL query under a name. Opening one is following
// its link, so it shows exactly what that link would.

/** The All Transactions header's Views menu */
export function SavedViewsMenu() {
  const { data: views = [] } = useSavedViews();
  const update = useUpdateSavedView();
  const remove = useDeleteSavedView();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  if (!views.length) return null;

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bookmark size={13} /> Views
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Saved views"
          className="absolute right-0 top-full mt-1 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface shadow-card py-1"
        >
          {views.map((v) => (
            <div key={v.id} className="flex items-center gap-1 px-1">
              <Link
                role="menuitem"
                to={`/transactions?${v.query}`}
                onClick={() => setOpen(false)}
                className="flex-1 min-w-0 truncate px-2 py-1.5 max-md:min-h-11 text-sm text-text rounded hover:bg-surface-alt"
              >
                {v.name}
              </Link>
              <RowMenu
                label={`Actions for ${v.name}`}
                items={[
                  { label: 'Rename', onClick: () => setRenaming(v) },
                  { label: 'Delete view', danger: true, onClick: () => remove.mutate(v.id) },
                ]}
              />
            </div>
          ))}
        </div>
      )}
      {renaming && (
        <NameModal
          title="Rename view"
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
    </div>
  );
}

/** Asks for a name and saves the current filters as a view */
export function SaveViewModal({ filters, onClose }: { filters: FilterState; onClose: () => void }) {
  const create = useCreateSavedView();
  return (
    <>
      <NameModal
        title="Save view"
        label="Name"
        placeholder="e.g. Holiday spending"
        submitLabel="Save view"
        onClose={onClose}
        onSave={(name) =>
          create.mutate(
            { name, query: filtersToSearch(filters).toString() },
            { onSuccess: onClose },
          )
        }
      />
      {create.error && (
        <p role="alert" className="sr-only">
          {create.error.message}
        </p>
      )}
    </>
  );
}
