import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Select } from '../ui/Select';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/priorities';
import { useBudget } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import { FUNDING_VIEWS } from '../../utils/fundingViews';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

// Settings → Priorities (phase 7A). Everything here is optional and only labels categories or
// records preferences: saving never assigns money, reorders payday rules or changes a share.

const section = 'bg-surface-alt rounded-lg p-5 space-y-4';
const label = 'grid gap-1 text-xs font-medium text-text-secondary';
const PURPOSE_LABEL: Record<api.CategoryPurpose, string> = {
  essential: 'Essential',
  enjoyment: 'Enjoyment',
  flexibility: 'Flexibility reserve',
};

export function PrioritiesSettings() {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { allValid, report } = useAmountValidity();
  const saved = useQuery({ queryKey: ['priorities'], queryFn: api.getPriorities });
  const budget = useBudget(format(new Date(), 'yyyy-MM'));
  const [form, setForm] = useState<{
    purpose: string;
    essential: number | null;
    targetType: 'none' | 'amount' | 'months';
    targetAmount: number | null;
    targetMonths: string;
    minimum: number | null;
    cadence: api.ReviewCadence;
    purposes: Record<string, api.CategoryPurpose | ''>;
  } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = saved.data;
    if (!p || form) return;
    setForm({
      purpose: p.purpose ?? '',
      essential: p.essentialMonthlyAmount,
      targetType: p.reserveTarget?.type ?? 'none',
      targetAmount: p.reserveTarget?.type === 'amount' ? p.reserveTarget.amount : null,
      targetMonths: p.reserveTarget?.type === 'months' ? String(p.reserveTarget.months) : '3',
      minimum: p.reserveMinimum,
      cadence: p.reviewCadence,
      purposes: Object.fromEntries(p.purposes.map((x) => [x.categoryId, x.purpose])),
    });
  }, [saved.data, form]);

  if (!saved.data || !form) return <p className="text-sm text-text-tertiary">Loading…</p>;
  const groups = (budget.data ?? []).filter((g) => !g.isIncome);
  const set = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setMessage(null);
  };

  async function save() {
    if (!form || !saved.data) return;
    const amounts = [
      form.essential,
      form.minimum,
      form.targetType === 'amount' ? form.targetAmount : null,
    ];
    if (!allValid || amounts.some((value) => value != null && value <= 0)) {
      setMessage({ tone: 'error', text: 'Amounts must be positive, like 3000 or 3000.00.' });
      return;
    }
    const months = Number(form.targetMonths);
    if (
      form.targetType === 'months' &&
      !(Number.isInteger(months) && months >= 1 && months <= 60)
    ) {
      setMessage({ tone: 'error', text: 'Choose between 1 and 60 months.' });
      return;
    }
    if (form.targetType === 'amount' && form.targetAmount == null) {
      setMessage({ tone: 'error', text: 'Enter a target amount, or choose no target.' });
      return;
    }
    setBusy(true);
    try {
      const next = await api.savePriorities({
        revision: saved.data.revision,
        purpose: form.purpose.trim() || null,
        essentialMonthlyAmount: form.essential,
        reserveTarget:
          form.targetType === 'amount' && form.targetAmount != null
            ? { type: 'amount', amount: form.targetAmount }
            : form.targetType === 'months'
              ? { type: 'months', months }
              : null,
        reserveMinimum: form.minimum,
        reviewCadence: form.cadence,
        purposes: Object.entries(form.purposes)
          .filter((e): e is [string, api.CategoryPurpose] => !!e[1])
          .map(([categoryId, purpose]) => ({ categoryId, purpose })),
      });
      qc.setQueryData(['priorities'], next);
      for (const key of [...FUNDING_VIEWS, 'priorities'])
        await qc.invalidateQueries({ queryKey: [key] });
      setMessage({ tone: 'ok', text: 'Priorities saved. No money was moved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AmountFields report={report}>
      <div className="space-y-6">
        <div className={section}>
          <div>
            <h2 className="text-base font-semibold text-text">Financial priorities</h2>
            <p className="text-sm text-text-secondary">
              Optional. These labels describe what your money is for. They never assign money,
              reorder payday plans or change a household share. Skip this and the budget works as
              before.
            </p>
          </div>
          <label className={label}>
            What is your money for? (optional)
            <Input
              aria-label="Purpose"
              placeholder="For example: time with family, career flexibility, security"
              value={form.purpose}
              maxLength={500}
              onChange={(e) => set({ purpose: e.target.value })}
            />
          </label>
          <Select
            label="Review reminder"
            value={form.cadence}
            onChange={(value) => set({ cadence: value as api.ReviewCadence })}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'payday', label: 'After each payday' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
            ]}
          />
        </div>

        <div className={section}>
          <div>
            <h3 className="text-sm font-semibold text-text">Category purposes</h3>
            <p className="text-xs text-text-secondary">
              <strong>Essential</strong> categories measure what a month of necessities costs.{' '}
              <strong>Enjoyment</strong> marks spending you want to protect.{' '}
              <strong>Flexibility reserve</strong> holds money for no particular deadline; it cannot
              fund a goal or have a date target. Card payment reserves are not listed.
            </p>
          </div>
          {groups.map((g) => (
            <fieldset key={g.id} className="space-y-1">
              <legend className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                {g.name}
              </legend>
              {g.categories
                .filter((c) => !c.paymentAccountId)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-text">{c.name}</span>
                    <Select
                      aria-label={`Purpose for ${c.name}`}
                      className="w-48 max-md:w-40"
                      value={form.purposes[c.id] || 'none'}
                      onChange={(value) =>
                        set({
                          purposes: {
                            ...form.purposes,
                            [c.id]: value === 'none' ? '' : (value as api.CategoryPurpose),
                          },
                        })
                      }
                      options={[
                        { value: 'none', label: 'No purpose' },
                        ...Object.entries(PURPOSE_LABEL).map(([value, label]) => ({
                          value,
                          label,
                        })),
                      ]}
                    />
                  </div>
                ))}
            </fieldset>
          ))}
        </div>

        <div className={section}>
          <div>
            <h3 className="text-sm font-semibold text-text">Flexibility reserve</h3>
            <p className="text-xs text-text-secondary">
              Measured against the money available today in your flexibility categories. See it on{' '}
              <Link to="/review" className="text-brand-600 font-medium">
                Review
              </Link>
              .
            </p>
          </div>
          <label className={label}>
            Monthly essentials estimate (optional; otherwise measured from the last three months)
            <CurrencyInput
              nullable
              allowNegative
              aria-label="Monthly essentials estimate"
              placeholder="Measured"
              value={form.essential}
              onChange={(essential) => set({ essential })}
            />
          </label>
          <Select
            label="Comfort target"
            value={form.targetType}
            onChange={(value) => set({ targetType: value as typeof form.targetType })}
            options={[
              { value: 'none', label: 'No target' },
              { value: 'amount', label: 'An amount' },
              { value: 'months', label: 'Months of essentials' },
            ]}
          />
          {form.targetType === 'amount' && (
            <label className={label}>
              Target amount
              <CurrencyInput
                nullable
                allowNegative
                aria-label="Target amount"
                value={form.targetAmount}
                onChange={(targetAmount) => set({ targetAmount })}
              />
            </label>
          )}
          {form.targetType === 'months' && (
            <label className={label}>
              Months of essentials
              <Input
                aria-label="Months of essentials"
                inputMode="numeric"
                value={form.targetMonths}
                onChange={(e) => set({ targetMonths: e.target.value })}
              />
            </label>
          )}
          <label className={label}>
            Minimum (optional; a preference, never a block)
            <CurrencyInput
              nullable
              allowNegative
              aria-label="Reserve minimum"
              value={form.minimum}
              onChange={(minimum) => set({ minimum })}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={!canSave || busy} onClick={save}>
            Save priorities
          </Button>
          {message && (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={`text-sm ${message.tone === 'error' ? 'text-negative' : 'text-positive'}`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </AmountFields>
  );
}
