/**
 * How much of a category's plan is used: green, amber from 80%, red when over. Recurring
 * debits still expected this month follow in orange.
 */
export function SpentBar({
  spent,
  budgeted,
  isIncome,
  expected = 0,
  className = 'h-[3px] w-[90%] mt-1',
}: {
  spent: number;
  budgeted: number;
  isIncome?: boolean;
  /** Positive cents still expected to be spent this month */
  expected?: number;
  className?: string;
}) {
  if (budgeted <= 0 && spent <= 0 && expected <= 0) return null;
  const effectiveBudget = Math.max(budgeted, 1);
  const ratio = spent / effectiveBudget;
  const fillWidth = Math.min(ratio * 100, 100);

  let color: string;
  if (isIncome || ratio < 0.8 || ratio === 1) {
    color = 'bg-positive';
  } else if (ratio < 1) {
    color = 'bg-caution';
  } else {
    color = 'bg-negative';
  }

  const expectedWidth = Math.min(
    Math.max((expected / effectiveBudget) * 100, 0),
    100 - Math.max(fillWidth, 0),
  );

  return (
    <div className={`${className} bg-surface-alt rounded-full overflow-hidden flex`}>
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${fillWidth.toFixed(1)}%` }}
      />
      {expectedWidth > 0 && (
        <div
          className="h-full rounded-full transition-all bg-expected opacity-70"
          style={{ width: `${expectedWidth.toFixed(1)}%` }}
          data-testid="expected-bar"
        />
      )}
    </div>
  );
}
