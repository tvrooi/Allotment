import { CircleArrowUp } from 'lucide-react';
import type { Transaction } from '../../types';
import { formatMoney } from '../../utils/currency';

// Up round-ups, as Up shows them (owner-requested 8 November 2026): the purchase is listed once
// at its total, with a mark; its details show the parts. The server folds the round-up's own rows
// out of lists (server/src/services/roundUps.ts) and puts the round-up on the purchase.

/** What a list shows for the row: a purchase with a round-up shows its total */
export const listedAmount = (tx: Transaction) => tx.amount + (tx.roundUp?.amount ?? 0);

export function RoundUpMark({ tx, currency }: { tx: Transaction; currency: string | null }) {
  if (!tx.roundUp) return null;
  const label = `Rounded up ${formatMoney(Math.abs(tx.roundUp.amount), currency)}`;
  return (
    <CircleArrowUp
      size={14}
      className="inline-block shrink-0 text-brand-600"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
    </CircleArrowUp>
  );
}

/** The purchase, its round-up and the total, as in Up's purchase details */
export function RoundUpDetails({ tx, currency }: { tx: Transaction; currency: string | null }) {
  const r = tx.roundUp;
  if (!r) return null;
  const money = (cents: number) => formatMoney(Math.abs(cents), currency);
  return (
    <section
      aria-label="Round-up"
      className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2.5 bg-surface-alt rounded-lg border border-border-light text-sm"
    >
      <span className="text-text-secondary">Purchase</span>
      <span className="text-right tabular-nums">{money(tx.amount)}</span>
      <span className="flex items-center gap-1.5 text-text-secondary">
        <CircleArrowUp size={14} className="text-brand-600" aria-hidden />
        Round-up{r.toAccountName ? ` to ${r.toAccountName}` : ''}
        {r.boost ? (
          <span className="text-text-tertiary">(incl. {money(r.boost)} boost)</span>
        ) : null}
      </span>
      <span className="text-right tabular-nums">{money(r.amount)}</span>
      <span className="font-medium text-text">Total</span>
      <span className="text-right font-medium tabular-nums">{money(listedAmount(tx))}</span>
    </section>
  );
}
