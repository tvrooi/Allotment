import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency';
import { customReportRowLink } from '../../utils/customReportSelection';
import { monthLabel } from './ChartHelpers';
import type { CustomReportConfig, CustomReportData } from '../../types';

/** Called as a row's link is followed; preventDefault keeps the page (unsaved settings) */
export type FollowLink = (to: string, e: MouseEvent<HTMLAnchorElement>) => void;

interface Props {
  data: CustomReportData;
  /** The settings `data` came from: each row links to the transactions behind it */
  config: CustomReportConfig;
  onFollowLink?: FollowLink;
}

export default function ReportTable({ data, config, onFollowLink }: Props) {
  if (data.mode === 'total') {
    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-text-secondary">Name</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row, i) => (
              <tr key={i} className="border-b border-border-light hover:bg-hover">
                <td className="py-2 px-3 text-text-secondary">
                  <RowName config={config} row={row} onFollowLink={onFollowLink} />
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums font-medium ${row.value < 0 ? 'text-negative' : 'text-text'}`}
                >
                  {formatCurrency(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="py-2 px-3 font-semibold text-text">Total</td>
              <td className="py-2 px-3 text-right tabular-nums font-semibold text-text">
                {formatCurrency(data.data.reduce((s, r) => s + r.value, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-semibold text-text-secondary sticky left-0 bg-surface">
              Month
            </th>
            {data.groups.map((g) => (
              <th
                key={g}
                className="text-right py-2 px-3 font-semibold text-text-secondary whitespace-nowrap"
              >
                {g}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, i) => (
            <tr key={i} className="border-b border-border-light hover:bg-hover">
              <td className="py-2 px-3 text-text-secondary sticky left-0 bg-surface">
                {monthLabel(row.month as string)}
              </td>
              {data.groups.map((g) => {
                const val = (row[g] as number) || 0;
                return (
                  <td
                    key={g}
                    className={`py-2 px-3 text-right tabular-nums ${val < 0 ? 'text-negative' : 'text-text-secondary'}`}
                  >
                    {val !== 0 ? formatCurrency(val) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The row's name, as a link to the transactions behind its amount where the register can
 * select exactly those (customReportRowLink, UX audit AU-014)
 */
function RowName({
  config,
  row,
  onFollowLink,
}: {
  config: CustomReportConfig;
  row: { name: string; id: string | null };
  onFollowLink?: FollowLink;
}) {
  const to = customReportRowLink(config, row);
  if (!to) return <>{row.name}</>;
  return (
    <Link
      to={to}
      aria-label={`View transactions: ${row.name}`}
      onClick={(e) => onFollowLink?.(to, e)}
      className="text-text hover:text-brand-600 hover:underline"
    >
      {row.name}
    </Link>
  );
}
