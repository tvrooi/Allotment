import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';

interface DeletedImport {
  accountId: string;
  accountName: string;
  importedId: string;
  deletedAt: string;
  date: string | null;
  amount: number | null;
  description: string | null;
}

/**
 * Audit F-14: bank-fed rows you deleted (Enable Banking, SimpleFIN, Plaid) stay deleted when the
 * bank sends them again. Restore lets the next sync bring one back. Up's are in Up review.
 */
export function DeletedBankImports() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ['deleted-imports'],
    queryFn: () => apiFetch<DeletedImport[]>('/transactions/deleted-imports'),
  });
  const restore = useMutation({
    mutationFn: (r: DeletedImport) =>
      apiFetch('/transactions/deleted-imports/restore', {
        method: 'POST',
        body: JSON.stringify({ accountId: r.accountId, importedId: r.importedId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deleted-imports'] }),
  });
  if (!rows.length) return null;
  return (
    <section aria-label="Deleted bank transactions" className="space-y-2">
      <h3 className="text-sm font-semibold text-text">Deleted bank transactions</h3>
      <p className="text-xs text-text-tertiary">
        You deleted these, so syncs don't bring them back. Restore one and the next sync imports it
        again.
      </p>
      <ul className="divide-y divide-border-light rounded-lg border border-border">
        {rows.map((r) => (
          <li key={`${r.accountId}:${r.importedId}`} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0 text-sm">
              <p className="truncate text-text">
                {r.description ?? 'A bank transaction'}
                {r.amount !== null && <> · {formatCurrency(r.amount)}</>}
              </p>
              <p className="text-xs text-text-tertiary">
                {r.accountName}
                {r.date && <> · {formatDay(r.date)}</>}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={restore.isPending}
              onClick={() => restore.mutate(r)}
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {restore.error && <p className="text-xs text-negative">{restore.error.message}</p>}
    </section>
  );
}
