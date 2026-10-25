import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { getCategoriesWithUsage, setCategoryHidden } from '../../api/categories';
import type { Category } from '../../types';

// Settings → Categories: categories nothing has ever used (no transactions, never assigned),
// from a starter template, can be hidden in one go. A hidden category leaves pickers and the
// budget while it holds no money; its history stays and it can be shown again.

export function UnusedCategories() {
  const qc = useQueryClient();
  const { data: groups = [] } = useQuery({
    queryKey: ['categories', 'usage'],
    queryFn: getCategoriesWithUsage,
  });
  const hide = useMutation({
    mutationFn: async ({ ids, hidden }: { ids: string[]; hidden: boolean }) => {
      for (const id of ids) await setCategoryHidden(id, hidden);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
  const all = groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })));
  const unused = all.filter((c) => !c.hidden && c.transactionCount === 0 && !c.everAssigned);
  const hidden = all.filter((c) => c.hidden);
  if (!unused.length && !hidden.length) return null;
  const label = (c: Category & { groupName: string }) =>
    `${c.icon ? `${c.icon} ` : ''}${c.name} · ${c.groupName}`;

  return (
    <section
      aria-labelledby="unused-categories"
      className="rounded-lg border border-border-light p-4"
    >
      <h2 id="unused-categories" className="text-sm font-semibold text-text">
        Tidy up categories
      </h2>
      {unused.length > 0 && (
        <>
          <p className="text-xs text-text-tertiary mt-1">
            {unused.length} {unused.length === 1 ? 'category has' : 'categories have'} never been
            used: no transactions and nothing assigned. Hide them to keep pickers and the budget
            short. Hidden categories keep their history and can be shown again.
          </p>
          <ul aria-label="Unused categories" className="mt-2 flex flex-wrap gap-1.5">
            {unused.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => hide.mutate({ ids: [c.id], hidden: true })}
                  disabled={hide.isPending}
                  aria-label={`Hide ${c.name}`}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-alt px-2 py-0.5 text-xs text-text hover:bg-hover"
                >
                  <EyeOff size={11} aria-hidden /> {label(c)}
                </button>
              </li>
            ))}
          </ul>
          <Button
            className="mt-3"
            variant="secondary"
            size="sm"
            disabled={hide.isPending}
            onClick={() => hide.mutate({ ids: unused.map((c) => c.id), hidden: true })}
          >
            Hide all {unused.length} unused
          </Button>
        </>
      )}
      {hidden.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-text-secondary cursor-pointer">
            {hidden.length} hidden {hidden.length === 1 ? 'category' : 'categories'}
          </summary>
          <ul aria-label="Hidden categories" className="mt-2 flex flex-wrap gap-1.5">
            {hidden.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => hide.mutate({ ids: [c.id], hidden: false })}
                  disabled={hide.isPending}
                  aria-label={`Show ${c.name}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-text-secondary hover:bg-hover"
                >
                  <Eye size={11} aria-hidden /> {label(c)}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {hide.error && <p className="text-xs text-negative mt-2">{hide.error.message}</p>}
    </section>
  );
}
