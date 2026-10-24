import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/longTerm';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { formatCurrency } from '../../utils/currency';
import { CLASS_LABEL } from '../../utils/longTerm';
import { MoneyField, RateField, WholeNumberField } from './fields';

const CLASSES: api.AccountClass[] = [
  'cash',
  'investments',
  'super',
  'property',
  'vehicles',
  'other',
];

/** One loan's rate, repayment and term, saved on its own (they belong to the account, not the plan) */
function LoanRow({ loan }: { loan: api.StartingPoint['loans'][number] }) {
  const qc = useQueryClient();
  const initial = loan.details ?? { rateBps: 600, monthlyRepayment: 0, termMonths: null };
  const [d, setD] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const dirty =
    d.rateBps !== initial.rateBps ||
    d.monthlyRepayment !== initial.monthlyRepayment ||
    d.termMonths !== initial.termMonths;

  async function save() {
    setStatus(null);
    try {
      await api.setLoanDetails(loan.id, d);
      setStatus('Saved');
      qc.invalidateQueries({ queryKey: ['lt-start'] });
      qc.invalidateQueries({ queryKey: ['lt-result'] });
      qc.invalidateQueries({ queryKey: ['lt-compare'] });
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <li
      className="rounded-md border border-border-light p-3 space-y-3"
      aria-label={`Loan: ${loan.name}`}
    >
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium">{loan.name}</span>
        <span className="tabular-nums text-negative">{formatCurrency(loan.balance)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <RateField
          label={`${loan.name}: interest rate`}
          bps={d.rateBps}
          min={0}
          max={100}
          onChange={(rateBps) => setD({ ...d, rateBps })}
        />
        <MoneyField
          label={`${loan.name}: repayment per month`}
          value={d.monthlyRepayment}
          onChange={(monthlyRepayment) => setD({ ...d, monthlyRepayment })}
        />
        <WholeNumberField
          label={`${loan.name}: months left (0 for no end)`}
          value={d.termMonths ?? 0}
          min={0}
          max={1200}
          onChange={(m) => setD({ ...d, termMonths: m > 0 ? m : null })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty && !!loan.details}>
          Save loan details
        </Button>
        {status && (
          <span role="status" className="text-xs text-text-secondary">
            {status}
          </span>
        )}
        {!loan.details && (
          <span className="text-xs text-caution">
            No repayment data yet, so this loan stays flat.
          </span>
        )}
      </div>
    </li>
  );
}

/** What the forecast starts from: real balances, each with its kind and growth, and the loans */
export function AccountsPanel({
  plan,
  setPlan,
  point,
}: {
  plan: api.Plan;
  setPlan: Dispatch<SetStateAction<api.Plan>>;
  point: api.StartingPoint | undefined;
}) {
  if (!point) return <div className="h-32 bg-surface-alt rounded animate-pulse" />;
  const choice = (id: string) => plan.accounts.find((a) => a.accountId === id);
  /** Keep only choices that differ from the defaults */
  const update = (id: string, change: Partial<api.AccountChoice>) =>
    setPlan((p) => {
      const current = p.accounts.find((a) => a.accountId === id) ?? {
        accountId: id,
        included: true,
        cls: null,
        growthBps: null,
      };
      const next = { ...current, ...change };
      const isDefault = next.included && next.cls === null && next.growthBps === null;
      return {
        ...p,
        accounts: [...p.accounts.filter((a) => a.accountId !== id), ...(isDefault ? [] : [next])],
      };
    });
  const total = point.accounts.reduce((s, a) => s + a.balance, 0);
  return (
    <div className="space-y-6">
      <section aria-label="Accounts" className="space-y-3">
        <p className="text-sm text-text-secondary">
          Today's real balances, {formatCurrency(total)} in all. Each account grows at its kind's
          rate unless you give it its own. Leaving one out removes it from the forecast only.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[36rem]">
            <thead>
              <tr className="text-left text-xs text-text-tertiary">
                <th className="py-1.5 font-medium">Include</th>
                <th className="font-medium">Account</th>
                <th className="font-medium">Kind</th>
                <th className="font-medium">Yearly growth</th>
                <th className="text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {point.accounts.map((a) => {
                const c = choice(a.id);
                const cls = c?.cls ?? a.cls;
                const rate = c?.growthBps ?? plan.settings.classGrowthBps[cls];
                return (
                  <tr key={a.id} className="border-t border-border-light align-top">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        aria-label={`Include ${a.name}`}
                        checked={c?.included !== false}
                        onChange={(e) => update(a.id, { included: e.target.checked })}
                      />
                    </td>
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 pr-3">
                      <Select
                        aria-label={`${a.name} kind`}
                        value={cls}
                        onChange={(e) =>
                          update(a.id, {
                            cls:
                              e.target.value === a.cls
                                ? null
                                : (e.target.value as api.AccountClass),
                          })
                        }
                      >
                        {CLASSES.map((k) => (
                          <option key={k} value={k}>
                            {CLASS_LABEL[k]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3 w-36">
                      <RateField
                        label={`${a.name} growth`}
                        bps={rate}
                        min={-50}
                        max={15}
                        defaultBps={plan.settings.classGrowthBps[cls]}
                        onChange={(bps) =>
                          update(a.id, {
                            growthBps: bps === plan.settings.classGrowthBps[cls] ? null : bps,
                          })
                        }
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(a.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {point.accounts.length === 0 && (
          <p className="text-sm text-text-tertiary">You have no accounts with a balance yet.</p>
        )}
      </section>

      <section aria-label="Loans" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Loans and debts</h3>
        {point.loans.length === 0 ? (
          <p className="text-sm text-text-tertiary">You have no loan or debt accounts.</p>
        ) : (
          <>
            <p className="text-xs text-text-tertiary">
              A loan's rate, repayment and months left are saved on the account straight away, not
              with the plan.
            </p>
            <ul className="space-y-3">
              {point.loans.map((l) => (
                <LoanRow key={l.id} loan={l} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
