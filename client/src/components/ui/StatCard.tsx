interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: 'positive' | 'negative' | 'caution' | 'brand';
  valueColor?: string;
  className?: string;
}

const accentBorders: Record<string, string> = {
  positive: 'border-l-[3px] border-l-positive',
  negative: 'border-l-[3px] border-l-negative',
  caution: 'border-l-[3px] border-l-caution',
  brand: 'border-l-[3px] border-l-brand-600',
};

export function StatCard({ label, value, sub, accent, valueColor, className = '' }: Props) {
  return (
    <div
      className={`bg-surface rounded-lg px-6 py-4 max-md:px-4 border border-border-light shadow-card ${
        accent ? accentBorders[accent] : ''
      } ${className}`}
    >
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p
        className={`text-xl font-semibold tabular-nums tracking-tight mt-2 whitespace-nowrap ${valueColor || 'text-text'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

/** Wider layouts: four (or three) to a row from `lg`, or from a widget's `@4xl` container */
const WIDE = {
  4: 'lg:*:basis-[calc(25%-1rem)]',
  3: 'lg:*:basis-[calc(33.333%-1rem)]',
  'container-4': '@4xl:*:basis-[calc(25%-1rem)]',
} as const;

/**
 * Lays out summary tiles two to a row (more on wide screens). An amount never breaks inside
 * its digits: each tile is at least as wide as its unbroken value, so a tile whose amount
 * doesn't fit beside another takes the row on its own instead (UX audit AU-008). Labels and
 * notes still wrap. Pair it with `whitespace-nowrap` on the value.
 */
export function StatGrid({
  wide = 4,
  className = 'gap-3',
  children,
}: {
  wide?: keyof typeof WIDE;
  /** Gap and spacing; a gap of up to 1rem keeps the columns' widths in step */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-wrap *:grow *:basis-[calc(50%-1rem)] ${WIDE[wide]} ${className}`}>
      {children}
    </div>
  );
}
