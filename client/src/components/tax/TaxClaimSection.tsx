import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TAX_LABEL_NAMES, type TaxLabel } from '../../api/tax';
import { useClaim, useReceipts, useRemoveClaim, useSetClaim } from '../../hooks/useTax';
import { formatMoney } from '../../utils/currency';
import { Input, Select } from '../ui/Input';
import type { Transaction } from '../../types';

/**
 * Claim a transaction as a tax deduction: its return label and the share of it that was for
 * work. Saved as soon as it changes. Record keeping only; it never changes the transaction.
 */
export function TaxClaimSection({ tx, currency }: { tx: Transaction; currency: string | null }) {
  const { data: claim, isLoading } = useClaim(tx.id);
  const { data: receipts = [] } = useReceipts({ transactionId: tx.parentTransactionId ?? tx.id });
  const save = useSetClaim();
  const remove = useRemoveClaim();
  const [percent, setPercent] = useState('100');
  const [notes, setNotes] = useState('');
  // Ticks at once; the saved claim follows
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(!!claim);
    setPercent(claim ? String(claim.workUseBps / 100) : '100');
    setNotes(claim?.notes ?? '');
  }, [claim]);

  if (tx.isParent)
    return (
      <p className="text-xs text-text-tertiary">
        To claim part of this split as a tax deduction, open the part from the register.
      </p>
    );
  if (tx.transferTransactionId || isLoading) return null;

  const store = (change: Partial<{ label: TaxLabel; workUseBps: number; notes: string | null }>) =>
    save.mutate({
      transactionId: tx.id,
      claim: {
        label: change.label ?? claim?.label ?? 'D5',
        workUseBps: change.workUseBps ?? claim?.workUseBps ?? 10_000,
        notes: change.notes !== undefined ? change.notes : (claim?.notes ?? null),
      },
    });
  const bps = Math.round(Number(percent) * 100);
  const validPercent = Number.isFinite(bps) && bps >= 1 && bps <= 10_000;
  const claimAmount = claim ? Math.round((-tx.amount * claim.workUseBps) / 10_000) : 0;

  return (
    <section aria-label="Tax deduction" className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            if (e.target.checked) store({});
            else remove.mutate(tx.id);
          }}
        />
        Claim as a tax deduction
      </label>
      {claim && (
        <div className="space-y-2 pl-6">
          <Select
            aria-label="Tax return label"
            value={claim.label}
            onChange={(e) => store({ label: e.target.value as TaxLabel })}
          >
            {Object.entries(TAX_LABEL_NAMES).map(([label, name]) => (
              <option key={label} value={label}>
                {label} {name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary" htmlFor={`work-${tx.id}`}>
              Work use
            </label>
            <Input
              id={`work-${tx.id}`}
              aria-label="Work use percent"
              aria-invalid={!validPercent}
              inputMode="decimal"
              className="w-20"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              onBlur={() => validPercent && bps !== claim.workUseBps && store({ workUseBps: bps })}
            />
            <span className="text-xs text-text-tertiary">%</span>
            <span className="ml-auto text-sm tabular-nums">
              Claim {formatMoney(claimAmount, currency)}
            </span>
          </div>
          <Input
            aria-label="Claim notes"
            placeholder="What it was for (e.g. laptop for work)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => (notes || null) !== claim.notes && store({ notes: notes || null })}
          />
          {receipts.length === 0 && (
            <p className="text-xs text-caution">
              No receipt yet. The ATO expects one once your work expenses pass $300 for the year.
            </p>
          )}
          {-tx.amount > 30_000 && claim.label !== 'D1' && (
            <p className="text-xs text-text-tertiary">
              Over $300: usually claimed as decline in value over several years. Check with your tax
              agent.
            </p>
          )}
          <Link to="/tax" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            See this year's deductions
          </Link>
        </div>
      )}
    </section>
  );
}
