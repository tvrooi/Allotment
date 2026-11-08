import { useState } from 'react';
import { Button } from '../ui/Button';
import { Private } from '../ui/Private';
import { ErrorText } from './InvestmentModals';
import { useDepositSuggestions, useLinkDeposit } from '../../hooks/useInvestments';
import type { DepositOf } from '../../api/investments';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';

// D3b (docs/INVESTMENT-SALES-AND-INCOME.md §4): a sale or a payment may point at the deposit that
// brought its cash in. Suggestions are deposits for the same amount within 7 days; the owner picks
// one. A link only marks the deposit as investment money: no category or balance changes.

export function DepositLink({
  of,
  transactionId,
  label,
}: {
  of: DepositOf;
  transactionId: string | null;
  /** What the row is, for the buttons' names: "the sale of 7 Sep 2026" */
  label: string;
}) {
  const [choosing, setChoosing] = useState(false);
  const link = useLinkDeposit();
  const suggestions = useDepositSuggestions(choosing ? of : null);

  if (transactionId)
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
        <span>Deposit linked: the transaction shows it as investment money.</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => link.mutate({ of, transactionId: null })}
          aria-label={`Unlink the deposit of ${label}`}
        >
          Unlink
        </Button>
        <ErrorText error={link.error} />
      </div>
    );

  if (!choosing)
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setChoosing(true)}
        aria-label={`Link the deposit of ${label}`}
      >
        Link the deposit
      </Button>
    );

  return (
    <div className="space-y-1 rounded-md border border-border-light p-2 text-sm">
      <p className="text-xs text-text-tertiary">
        Deposits for the same amount within 7 days. Linking changes no category or balance.
      </p>
      {suggestions.isLoading ? (
        <p className="text-xs text-text-tertiary">Looking…</p>
      ) : suggestions.data?.length ? (
        <ul className="divide-y divide-border-light">
          {suggestions.data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0">
                {t.payeeName ?? 'Deposit'}
                <span className="block text-xs text-text-tertiary">
                  {formatDay(t.date)} · {t.accountName} ·{' '}
                  <Private>{formatMoney(t.amount, t.currency)}</Private>
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={link.isPending}
                onClick={() =>
                  link.mutate({ of, transactionId: t.id }, { onSuccess: () => setChoosing(false) })
                }
                aria-label={`Link ${t.payeeName ?? 'the deposit'} of ${formatDay(t.date)}`}
              >
                Link
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary">
          No deposit for that amount within 7 days. A reinvested payment may have none.
        </p>
      )}
      <ErrorText error={link.error ?? suggestions.error} />
      <Button size="sm" variant="ghost" onClick={() => setChoosing(false)}>
        Cancel
      </Button>
    </div>
  );
}
