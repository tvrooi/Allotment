import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useCanSave } from '../../hooks/useConnection';
import {
  useDismissPaymentMatch,
  useLinkPayment,
  usePaymentMatches,
} from '../../hooks/usePaymentPlans';
import { formatCurrency } from '../../utils/currency';
import { formatShortDay } from '../../utils/dates';

/**
 * Bank payments that look like an instalment. Nothing is linked until you confirm: then the
 * payment becomes a transfer to the provider's account instead of spending.
 */
export function PaymentMatches({ compact = false }: { compact?: boolean }) {
  const { data: matches = [] } = usePaymentMatches();
  const link = useLinkPayment();
  const dismiss = useDismissPaymentMatch();
  const canSave = useCanSave();
  const [error, setError] = useState<string | null>(null);
  if (!matches.length) return null;
  return (
    <section
      className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3"
      aria-label="Payments to confirm"
    >
      <h2 className="text-sm font-medium text-text">
        {matches.length} payment{matches.length === 1 ? '' : 's'} to confirm
      </h2>
      {!compact && (
        <p className="text-xs text-text-tertiary mt-0.5">
          Confirming makes the bank payment a transfer to the plan, so it isn&apos;t counted as
          spending twice.
        </p>
      )}
      <ul className="mt-2 divide-y divide-border-light">
        {matches.map((m) => {
          const which =
            m.seqs.length === 1
              ? `${m.seqs[0]} of ${m.instalmentCount}`
              : `${m.seqs[0]}–${m.seqs[m.seqs.length - 1]} of ${m.instalmentCount}`;
          return (
            <li
              key={`${m.planId}:${m.transaction.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <div className="flex-1 min-w-48">
                <span className="text-text">
                  {m.providerName} payment → {m.merchant}, {which}
                </span>
                <span className="block text-xs text-text-tertiary">
                  {m.transaction.payeeName ?? 'Bank payment'} · {formatShortDay(m.transaction.date)}{' '}
                  · {formatCurrency(-m.transaction.amount)}
                </span>
              </div>
              <Button
                size="sm"
                disabled={!canSave || link.isPending}
                onClick={() => {
                  setError(null);
                  link.mutate(
                    {
                      planId: m.planId,
                      transactionId: m.transaction.id,
                      instalmentIds: m.instalmentIds,
                    },
                    {
                      onError: (err) =>
                        setError(err instanceof Error ? err.message : 'Could not link'),
                    },
                  );
                }}
              >
                <Check size={13} /> Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canSave}
                onClick={() =>
                  dismiss.mutate({
                    instalmentId: m.instalmentIds[0],
                    transactionId: m.transaction.id,
                  })
                }
              >
                <X size={13} /> Not this
              </Button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-negative mt-1">{error}</p>}
    </section>
  );
}
