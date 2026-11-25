import { format, parseISO } from 'date-fns';
import { ChartNoAxesColumn } from 'lucide-react';
import { CATEGORY_COLORS } from '../../utils/chartColors';
import { StatGrid } from '../ui/StatCard';

export const EXPENSE_COLORS = CATEGORY_COLORS;

export const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yy');

export const TOOLTIP_CLASS = 'bg-surface border border-border rounded-md shadow-hover px-3 py-2';

export function ChartSkeleton() {
  return (
    <div className="h-full flex items-end gap-2 px-4 pb-4 pt-8 animate-pulse">
      {[55, 72, 40, 85, 60, 78, 45, 90, 50, 65].map((h, i) => (
        <div key={i} className="flex-1 bg-surface-alt rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** A chart with nothing to draw: says so, and what would fill it */
export function EmptyState({
  message = 'No data for this period',
  hint = 'Add transactions, or pick a longer date range.',
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="h-full min-h-24 flex flex-col items-center justify-center text-center gap-1 px-4">
      <ChartNoAxesColumn size={20} className="text-text-disabled mb-1" aria-hidden />
      <p className="text-sm font-medium text-text-secondary">{message}</p>
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}

export interface StatCard {
  label: string;
  value: string;
  sub?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

const TONE_CLASS = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-text-tertiary',
} as const;

export function StatCardRow({
  cards,
  variant = 'default',
}: {
  cards: StatCard[];
  /** 'hero': white raised cards with a centered large value above the label, always full width */
  variant?: 'default' | 'hero';
}) {
  if (!cards.length) return null;
  if (variant === 'hero') {
    return (
      <StatGrid wide={cards.length % 3 === 0 ? 3 : 4} className="gap-4 mb-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl bg-surface border border-border-light shadow-card px-4 py-6 text-center"
          >
            <p
              className={`text-xl font-semibold tabular-nums whitespace-nowrap ${c.tone ? TONE_CLASS[c.tone] : 'text-text'}`}
            >
              {c.value}
            </p>
            <p className="text-sm text-text-secondary mt-1.5">{c.label}</p>
            {c.sub && <p className="text-xs text-text-tertiary mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </StatGrid>
    );
  }
  return (
    <div className="flex gap-3 mb-5 flex-wrap">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg bg-surface-alt border border-border-light px-4 py-3 min-w-[110px]"
        >
          <p className="text-xs text-text-tertiary">{c.label}</p>
          {c.sub && <p className="text-2xs text-text-tertiary">{c.sub}</p>}
          <p
            className={`text-lg font-semibold mt-0.5 tabular-nums whitespace-nowrap ${c.tone ? TONE_CLASS[c.tone] : 'text-text'}`}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
