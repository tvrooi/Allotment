import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { updateTransaction } from '../../api/transactions';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { formatMoney } from '../../utils/currency';

/** A repayment to you whose deposit has no category, with what the repayer owed you for */
interface Offer {
  eventId: string;
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  candidates: { categoryId: string; name: string; amount: number }[];
}

const DISMISSED = 'household.categoryOffers.dismissed';
function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * Audit decision I-8: offer to categorise a repayment back to the shared expense's category, so
 * your personal reports show your share rather than the whole bill plus an uncategorised
 * deposit. Only when you press Categorise; the household ledger never changes.
 */
export function RepaymentCategoryOffers({
  groupId,
  currency,
}: {
  groupId: string;
  currency: string;
}) {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(dismissed);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { data: offers = [] } = useQuery({
    queryKey: ['households', groupId, 'category-offers'],
    queryFn: () => apiFetch<Offer[]>(`/households/${groupId}/category-offers`),
  });
  const categorise = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      updateTransaction(id, { categoryId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['households', groupId, 'category-offers'] }),
  });
  const shown = offers.filter((o) => !hidden.includes(o.eventId));
  if (!shown.length) return null;
  const notNow = (eventId: string) => {
    const next = [...hidden, eventId];
    setHidden(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next.slice(-200)));
    } catch {
      // a private window keeps it for this visit only
    }
  };
  return (
    <section
      aria-label="Categorise repayments"
      className="rounded-lg border border-border-light p-4 space-y-3"
    >
      <div>
        <h2 className="text-sm font-semibold text-text">Categorise repayments</h2>
        <p className="text-xs text-text-tertiary">
          A repayment in the same category as what it paid for makes your reports show your share,
          not the whole bill. The household's balances stay as they are.
        </p>
      </div>
      <ul className="divide-y divide-border-light">
        {shown.map((o) => {
          const categoryId = chosen[o.eventId] ?? o.candidates[0].categoryId;
          return (
            <li key={o.eventId} className="py-2 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-40 text-sm text-text">
                {o.description}, {formatMoney(o.amount, currency)}
              </span>
              <Select
                aria-label={`Category for ${o.description}`}
                className="w-auto"
                value={categoryId}
                onChange={(e) => setChosen({ ...chosen, [o.eventId]: e.target.value })}
              >
                {o.candidates.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name} (owed {formatMoney(c.amount, currency)})
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={categorise.isPending}
                onClick={() => categorise.mutate({ id: o.transactionId, categoryId })}
              >
                Categorise
              </Button>
              <Button size="sm" variant="ghost" onClick={() => notNow(o.eventId)}>
                Not now
              </Button>
            </li>
          );
        })}
      </ul>
      {categorise.error && <p className="text-xs text-negative">{categorise.error.message}</p>}
    </section>
  );
}
