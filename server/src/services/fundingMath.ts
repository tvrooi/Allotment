// Funding arithmetic shared by payday plans, category targets and forecasts, so a
// deadline means the same thing everywhere. Amounts are integer minor units.

/** Even share of what is still missing, rounded up so following it reaches the target. */
export const perPeriodNeed = (target: number, balance: number, periodsLeft: number) =>
  Math.ceil(Math.max(0, target - balance) / Math.max(1, periodsLeft));

/** Calendar months from `from` to `to` inclusive (YYYY-MM); 0 when `to` is earlier. */
export function monthsBetween(from: string, to: string) {
  const months = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  return Math.max(0, months(to) - months(from) + 1);
}

/** The month `count` months after `month` (YYYY-MM). */
export function addMonthsTo(month: string, count: number) {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** The real last day of `month` (YYYY-MM), as YYYY-MM-DD. */
export function monthEnd(month: string) {
  const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}
