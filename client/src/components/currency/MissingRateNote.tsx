/**
 * Transactions with no exchange rate yet are left out of a total in the budget's currency:
 * this says how many, wherever such a total is shown (the register's summary, a payee page).
 */
export function MissingRateNote({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`text-caution ${className}`} title="Their exchange rate is missing">
      {count} without a rate left out
    </span>
  );
}
