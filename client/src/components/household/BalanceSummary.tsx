import { formatMoney } from '../../utils/currency';
import { Button } from '../ui/Button';

interface Props {
  currency: string;
  people: { id: string; name: string; isSelf: number }[];
  /** Per person, across everything shared: negative = owes, positive = is owed */
  balances: Record<string, number>;
  /** True when a repayment or a payment into the household account would clear something */
  canSettle: boolean;
  /** Bank payments of recurring bills that are not in the balances yet, and which bills */
  unshared: { count: number; bills: string[] };
  /** The household pays from a shared account (otherwise people pay as they go and settle up) */
  sharedAccount: boolean;
  /** Whether the household includes bills (its Bills tab, coverage and prompts) */
  withBills: boolean;
  onSettle: () => void;
  onReview: () => void;
  onRecord: () => void;
}

/**
 * The answer the Household page exists for, at the top: do you owe, are you owed, and who else
 * is out of balance. Balances only include what has been shared, so unshared bill payments are
 * named instead of letting "all square" stand. One action follows the state: settle up when
 * something can be cleared, review unshared payments next, otherwise record a new shared cost.
 */
export function BalanceSummary({
  currency,
  people,
  balances,
  canSettle,
  unshared,
  sharedAccount,
  withBills,
  onSettle,
  onReview,
  onRecord,
}: Props) {
  const money = (n: number) => formatMoney(n, currency);
  const self = people.find((p) => p.isSelf);
  const mine = self ? (balances[self.id] ?? 0) : 0;
  const allSquare = people.every((p) => (balances[p.id] ?? 0) === 0);
  const payments = (n: number) => `${n} payment${n === 1 ? '' : 's'}`;
  const note =
    unshared.count === 0
      ? ''
      : unshared.bills.length === 1
        ? `${unshared.bills[0]} has ${payments(unshared.count)} not shared yet, so ${unshared.count === 1 ? 'it isn’t' : 'they aren’t'} counted here.`
        : `${payments(unshared.count)} across ${unshared.bills.length} bills aren’t shared yet, so they aren’t counted here.`;

  const headline = allSquare
    ? unshared.count > 0
      ? 'Square on what’s shared'
      : 'All square'
    : mine > 0
      ? `You’re owed ${money(mine)}`
      : mine < 0
        ? `You owe ${money(-mine)}`
        : 'You’re square';
  const tone = mine > 0 ? 'text-positive' : mine < 0 ? 'text-negative' : 'text-text';
  const others = people.filter((p) => !p.isSelf);

  return (
    <section
      aria-label="Who owes whom"
      className="rounded-lg border border-border-light bg-surface-alt p-4 md:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0">
        <p className={`text-xl font-semibold tracking-tight ${tone}`}>{headline}</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {others.map((p) => {
            const b = balances[p.id] ?? 0;
            return (
              <li key={p.id} className="text-text-secondary">
                {p.name}{' '}
                <span
                  className={`tabular-nums font-medium ${b < 0 ? 'text-negative' : b > 0 ? 'text-positive' : 'text-text-tertiary'}`}
                >
                  {b < 0 ? `owes ${money(-b)}` : b > 0 ? `is owed ${money(b)}` : 'settled'}
                </span>
              </li>
            );
          })}
        </ul>
        {note && <p className="mt-2 text-sm text-text-secondary">{note}</p>}
        <p className="mt-2 text-xs text-text-tertiary">
          {sharedAccount ? 'Shared account' : 'Split as you go'}
          {' · '}
          {withBills ? 'Bills included' : 'Bills not included'}
        </p>
      </div>
      {canSettle ? (
        <Button onClick={onSettle} className="max-md:w-full">
          Settle up
        </Button>
      ) : unshared.count > 0 ? (
        <Button onClick={onReview} className="max-md:w-full">
          Review unshared payments
        </Button>
      ) : (
        <Button onClick={onRecord} className="max-md:w-full">
          Record an expense
        </Button>
      )}
    </section>
  );
}
