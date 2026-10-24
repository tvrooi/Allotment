import type { Comparison, Figure } from '../../api/longTerm';
import { formatCurrency } from '../../utils/currency';

const value = (f: Figure, v: number | null) =>
  v === null ? '—' : f.unit === 'year' ? String(v) : formatCurrency(v);
const diff = (f: Figure) =>
  f.difference === null
    ? '—'
    : f.unit === 'year'
      ? `${f.difference > 0 ? '+' : f.difference < 0 ? '−' : ''}${Math.abs(f.difference)} years`
      : `${f.difference > 0 ? '+' : f.difference < 0 ? '−' : ''}${formatCurrency(Math.abs(f.difference))}`;
const percent = (f: Figure) =>
  f.percentBps === null
    ? 'n/a'
    : `${f.percentBps > 0 ? '+' : f.percentBps < 0 ? '−' : ''}${(Math.abs(f.percentBps) / 100).toFixed(1)}%`;

/** Paired key figures for two plans, and the difference in money and percent */
export function ComparePanel({ comparison }: { comparison: Comparison }) {
  return (
    <section aria-label="Comparison" className="space-y-3">
      <h3 className="text-sm font-semibold text-text">
        {comparison.active.name} compared with {comparison.reference.name}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[34rem]">
          <thead>
            <tr className="text-left text-xs text-text-tertiary">
              <th className="py-1.5 font-medium">Figure</th>
              <th className="text-right font-medium">{comparison.active.name}</th>
              <th className="text-right font-medium">{comparison.reference.name} (reference)</th>
              <th className="text-right font-medium">Difference</th>
              <th className="text-right font-medium">Percent of reference</th>
            </tr>
          </thead>
          <tbody>
            {comparison.figures.map((f) => (
              <tr key={f.key} className="border-t border-border-light">
                <th scope="row" className="text-left py-2 font-normal">
                  {f.label}
                </th>
                <td className="text-right tabular-nums">{value(f, f.active)}</td>
                <td className="text-right tabular-nums">{value(f, f.reference)}</td>
                <td
                  className={`text-right tabular-nums ${f.difference !== null && f.difference < 0 && f.unit === 'money' ? 'text-negative' : ''}`}
                >
                  {diff(f)}
                </td>
                <td className="text-right tabular-nums">{percent(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-tertiary">{comparison.percentDefinition}</p>
    </section>
  );
}
