/** One key in a chart legend: a swatch (or a short line, for line series) and its label. */
export function LegendKey({
  color,
  label,
  line,
  dashed,
}: {
  color: string;
  label: string;
  line?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={line ? 'w-3 h-0.5 rounded-full' : 'w-2.5 h-2.5 rounded-sm'}
        style={
          dashed
            ? {
                backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`,
              }
            : { backgroundColor: color }
        }
      />
      {label}
    </span>
  );
}
