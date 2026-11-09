import { formatCurrency } from '../../utils/currency';
import type { CashBreakdown } from '../../types';

interface Props {
  breakdown: CashBreakdown;
  /** Cash in budget accounts net of overdrafts, before debt on enrolled cards */
  resources: number;
  readyToAssign: number;
}

/**
 * How the cash in the budget's accounts becomes Ready to assign, from the server's figures
 * (fundingState `breakdown`). The first group adds up to Ready to assign; card debt is shown
 * apart because Ready to assign does not subtract it (it stays a payment shortfall).
 */
export function CashBridge({ breakdown: b, resources, readyToAssign }: Props) {
  const rows: { label: string; value: number }[] = [
    { label: 'Cash in your budget accounts', value: b.cash },
    ...(b.otherDebt !== 0
      ? [{ label: 'Less overdrafts and unreviewed card debt', value: b.otherDebt }]
      : []),
    ...b.linked.map((l) => ({
      label: `${formatCurrency(l.amount)} in ${l.accountName}, held by ${l.name}`,
      value: -l.amount,
    })),
    { label: 'Held in other envelopes', value: -b.everydayEnvelopes },
    ...(b.setAside !== 0
      ? [{ label: 'Later months, holds and separate pools', value: -b.setAside }]
      : []),
    { label: 'Ready to assign', value: readyToAssign },
  ];
  const debt = b.cardDebt;
  return (
    <>
      <dl className="grid gap-1 mb-2 border-b border-border-light pb-2" aria-label="Cash breakdown">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt>{r.label}</dt>
            <dd className="tabular-nums">{formatCurrency(r.value)}</dd>
          </div>
        ))}
      </dl>
      {debt.total > 0 && (
        <>
          <dl className="grid gap-1 mb-2 border-b border-border-light pb-2">
            <div className="flex justify-between gap-2">
              <dt>Less card debt without a payment reserve</dt>
              <dd className="tabular-nums">{formatCurrency(-debt.unreserved)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Net cash after that debt</dt>
              <dd className="tabular-nums">{formatCurrency(resources - debt.unreserved)}</dd>
            </div>
          </dl>
          <p className="text-text-tertiary mb-2">
            Ready to assign does not subtract card debt; fund the card payment to cover it.
          </p>
        </>
      )}
    </>
  );
}
