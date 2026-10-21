import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { getBulkPreview } from '../../api/budget';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../ui/Button';

/** Lists every month a "next 12 months" change overwrites, before anything is saved. */
export function BulkPreview({
  categoryId,
  cents,
  month,
  onConfirm,
  onCancel,
}: {
  categoryId: string;
  cents: number;
  month: string;
  onConfirm: (expected: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const { data, error } = useQuery({
    queryKey: ['bulk-preview', categoryId, cents, month],
    queryFn: () => getBulkPreview(categoryId, cents, month),
    gcTime: 0,
  });
  if (error)
    return (
      <p role="alert" className="text-xs text-negative">
        {error.message}
      </p>
    );
  if (!data) return <p className="text-xs text-text-tertiary">Loading the months to change…</p>;
  const changes = data.months.filter((m) => m.current !== m.next);
  return (
    <div role="region" aria-label="Next 12 months preview" className="space-y-2">
      <p className="text-xs text-text-secondary">
        {changes.length
          ? `${changes.length} of 12 months change. Future assignments reserve money you have today.`
          : 'All 12 months already have this amount.'}
      </p>
      <ul className="text-xs text-text-secondary max-h-40 overflow-y-auto space-y-0.5">
        {changes.map((m) => (
          <li key={m.month} className="flex justify-between gap-2 tabular-nums">
            <span>{format(parseISO(`${m.month}-01`), 'MMM yyyy')}</span>
            <span>
              {formatCurrency(m.current)} → {formatCurrency(m.next)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          type="button"
          disabled={!changes.length}
          onClick={() =>
            onConfirm(Object.fromEntries(data.months.map((m) => [m.month, m.current])))
          }
        >
          Apply to 12 months
        </Button>
      </div>
    </div>
  );
}
