import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CategoryPicker } from '../transactions/CategoryPicker';
import { useCategories } from '../../hooks/useCategories';
import { useUpdatePayee } from '../../hooks/usePayees';
import { useCanSave } from '../../hooks/useConnection';
import type { CategoryGroup, Payee } from '../../types';

/**
 * A payee's default category, chosen with the searchable category picker like every other
 * category (#240), with "No default category" as its first choice. Payees list and payee page.
 */
export function DefaultCategoryButton({
  payee,
  className = '',
}: {
  payee: Pick<Payee, 'id' | 'name' | 'defaultCategoryId'>;
  className?: string;
}) {
  const { data: groups = [] } = useCategories();
  const updatePayee = useUpdatePayee();
  const canSave = useCanSave();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = (groups as CategoryGroup[])
    .flatMap((g) => g.categories.map((c) => ({ ...c, group: g.name })))
    .find((c) => c.id === payee.defaultCategoryId);
  const label = current ? `${current.group} → ${current.name}` : 'No default category';

  return (
    <>
      <button
        type="button"
        aria-label={`Default category for ${payee.name}: ${current?.name ?? 'none'}`}
        aria-expanded={anchor !== null}
        disabled={!canSave}
        onClick={(e) => setAnchor(e.currentTarget)}
        className={`inline-flex items-center justify-between gap-2 min-w-0 max-w-full text-sm text-left border border-border rounded-md px-2.5 py-1 max-md:min-h-11 bg-surface text-text hover:bg-hover disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-brand-600 ${className}`}
      >
        <span className={`truncate ${current ? '' : 'text-text-tertiary'}`}>{label}</span>
        <ChevronDown size={12} className="text-text-tertiary shrink-0" aria-hidden />
      </button>
      {anchor && (
        <CategoryPicker
          anchor={anchor}
          value={payee.defaultCategoryId}
          groups={groups as CategoryGroup[]}
          noneLabel="No default category"
          onClose={() => {
            setAnchor(null);
            anchor.focus();
          }}
          onChange={(id) => {
            if (id !== payee.defaultCategoryId)
              updatePayee.mutate({ id: payee.id, defaultCategoryId: id });
            setAnchor(null);
            anchor.focus();
          }}
        />
      )}
    </>
  );
}
