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
      className={`bg-surface rounded-lg px-5 py-4 border border-border-light shadow-card ${
        accent ? accentBorders[accent] : ''
      } ${className}`}
    >
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p
        className={`text-xl font-semibold tabular-nums tracking-tight mt-2 break-words ${valueColor || 'text-text'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
