import { formatCurrency } from '../../utils/currency';

interface PlannedRow {
  categoryId: string;
  proposed: number;
  shortfall: number;
  /** Available in the envelope before the plan, to warn when taking money back overspends it */
  balance?: number;
}

/**
 * The rows of a funding preview with a tick for each category (BUD-07): untick one to leave it
 * out. A left-out row says so, and the amounts of the others are the server's, not guessed here.
 */
export function FundingRows({
  candidates,
  checked,
  rows,
  onToggle,
}: {
  candidates: { categoryId: string; name: string }[];
  checked: Set<string>;
  rows: PlannedRow[];
  onToggle: (categoryId: string) => void;
}) {
  const byId = new Map(rows.map((r) => [r.categoryId, r]));
  return (
    <ul className="space-y-1 max-h-72 overflow-y-auto">
      {candidates.map((c) => {
        const row = byId.get(c.categoryId);
        const on = checked.has(c.categoryId);
        const overspends = !!row && row.proposed < 0 && (row.balance ?? 0) + row.proposed < 0;
        return (
          <li key={c.categoryId} className="flex items-baseline gap-2 tabular-nums">
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(c.categoryId)}
              aria-label={`Include ${c.name}`}
              className="accent-brand-600 self-center"
            />
            <span className={`flex-1 ${on ? 'text-text' : 'text-text-tertiary'}`}>{c.name}</span>
            <span className="text-right text-text-secondary">
              {!on || !row
                ? 'left out'
                : row.proposed < 0
                  ? `take back ${formatCurrency(-row.proposed)}`
                  : `assign ${formatCurrency(row.proposed)}`}
              {on && row && row.shortfall > 0 && ` · ${formatCurrency(row.shortfall)} short`}
              {on && overspends && ' · will be overspent'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
