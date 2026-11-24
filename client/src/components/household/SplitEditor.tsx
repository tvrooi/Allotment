import { useState } from 'react';
import type { HouseholdSplit } from '../../api/households';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CurrencyInput } from '../ui/CurrencyInput';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { formatMoney } from '../../utils/currency';
import { decimalToMinor, minorToDecimal } from '../../utils/money';

// How an amount is split between a household's people: equal, percentages, weights or (for a
// recurring bill) fixed amounts. Saves percentages in basis points (40% → 4000) and amounts in
// cents, as the server keeps them.

interface Props {
  people: { id: string; name: string }[];
  current: HouseholdSplit | null;
  /** What "Equal" means here, e.g. "Equal" or "The household's default split" */
  equalLabel?: string;
  saving?: boolean;
  /** Offer fixed amounts (a recurring bill, where each payment is the same) */
  allowFixed?: boolean;
  /** The amount the bill is expected to be, to compare fixed amounts with */
  expected?: number;
  currency?: string;
  /** The save button's words; the default saves a split */
  saveLabel?: string;
  onSave: (split: HouseholdSplit | null) => void;
  onCancel?: () => void;
}

const LABEL: Record<HouseholdSplit['mode'], string> = {
  equal: 'share',
  percentage: 'percentage',
  weight: 'weight',
  exact: 'amount',
};

export function SplitEditor({
  people,
  current,
  equalLabel,
  saving,
  allowFixed,
  expected,
  currency = 'AUD',
  saveLabel = 'Save split',
  onSave,
  onCancel,
}: Props) {
  const { allValid, report } = useAmountValidity();
  const [mode, setMode] = useState<HouseholdSplit['mode']>(current?.mode ?? 'equal');
  const [values, setValues] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(
      people.map((p) => {
        const v = current?.shares.find((s) => s.personId === p.id)?.value;
        return [
          p.id,
          v === undefined
            ? ''
            : current?.mode === 'exact'
              ? v
              : String(current?.mode === 'percentage' ? v / 100 : v),
        ];
      }),
    ),
  );
  const exactAmount = (value: string | number | undefined) =>
    typeof value === 'number' ? value : Math.max(0, decimalToMinor(value || '0', 2) ?? 0);
  const ratioText = (value: string | number | undefined) =>
    typeof value === 'number' ? minorToDecimal(value, 2) : (value ?? '');
  const fixedTotal = people.reduce((n, p) => n + exactAmount(values[p.id]), 0);
  function save() {
    if (!allValid) return;
    if (mode === 'equal') return onSave(null);
    onSave({
      mode,
      shares: people.map((p) => {
        const ratio = Number(ratioText(values[p.id]));
        return {
          personId: p.id,
          value:
            mode === 'exact'
              ? exactAmount(values[p.id])
              : mode === 'percentage'
                ? Math.round(ratio * 100)
                : Math.round(ratio),
        };
      }),
    });
  }
  return (
    <AmountFields report={report}>
      <div className="grid gap-2">
        <Select
          aria-label="Split"
          value={mode}
          onChange={(value) => setMode(value as HouseholdSplit['mode'])}
          options={[
            { value: 'equal', label: equalLabel ?? 'Equal' },
            { value: 'percentage', label: 'Percentages' },
            { value: 'weight', label: 'Weights (for example 2 : 1 : 1)' },
            ...(allowFixed || mode === 'exact'
              ? [{ value: 'exact', label: "Fixed amounts (for example each person's rent)" }]
              : []),
          ]}
        />
        {mode !== 'equal' &&
          people.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="w-24 truncate">{p.name}</span>
              {mode === 'exact' ? (
                <CurrencyInput
                  aria-label={`${p.name}'s amount`}
                  currency={currency}
                  value={exactAmount(values[p.id])}
                  onChange={(amount) => setValues((prev) => ({ ...prev, [p.id]: amount }))}
                />
              ) : (
                <Input
                  aria-label={`${p.name}'s ${LABEL[mode]}`}
                  inputMode="decimal"
                  value={ratioText(values[p.id])}
                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                />
              )}
              {mode === 'percentage' && '%'}
            </label>
          ))}
        {mode === 'exact' && (
          <p className="text-xs text-text-tertiary" aria-live="polite">
            Adds up to {formatMoney(fixedTotal, currency)}
            {expected !== undefined && expected !== fixedTotal
              ? `; the next payment is expected to be ${formatMoney(expected, currency)}. A payment that doesn't match isn't shared automatically.`
              : '. A payment that doesn’t match it isn’t shared automatically.'}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={save} disabled={saving || !allValid}>
            {saveLabel}
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </AmountFields>
  );
}

/** "equal between everyone", or "Me 50%, Sam 25%, Jo 25%" / "Me ×2, Sam ×1" / "Me $1,200.00" */
export function describeSplit(
  s: HouseholdSplit | null,
  people: { id: string; name: string }[],
  currency = 'AUD',
) {
  return !s || s.mode === 'equal'
    ? 'equal between everyone'
    : s.shares
        .map(
          (x) =>
            `${people.find((p) => p.id === x.personId)?.name ?? '?'} ${
              s.mode === 'percentage'
                ? `${x.value / 100}%`
                : s.mode === 'exact'
                  ? formatMoney(x.value, currency)
                  : `×${x.value}`
            }`,
        )
        .join(', ');
}
