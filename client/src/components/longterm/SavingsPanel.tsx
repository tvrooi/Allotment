import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { Plan, PlanResult, Split, StartingPoint } from '../../api/longTerm';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Select } from '../ui/Select';
import { formatCurrency } from '../../utils/currency';
import { CLASS_LABEL, worked } from '../../utils/longTerm';
import { MoneyField, RateField } from './fields';

const SPLIT_MODES = [
  { value: 'percent', label: 'A percent of what is left' },
  { value: 'fixed', label: 'Up to a dollar amount' },
];

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Where a surplus goes, in an order the owner chooses: each entry takes a percentage of what
 * is LEFT or a fixed amount (a cap that grows with inflation), and the remainder goes to Extra
 * savings. Below it, the order money is taken out when it runs short, and a worked example.
 */
export function SavingsPanel({
  plan,
  setPlan,
  point,
  result,
}: {
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  point: StartingPoint | undefined;
  result: PlanResult | undefined;
}) {
  const [example, setExample] = useState(1_000_000);
  // How many accounts were added here: the add field's key, and the cue to put focus back on it
  const [added, setAdded] = useState(0);
  const addRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (added > 0) addRef.current?.querySelector('input')?.focus();
  }, [added]);
  const eligible = (point?.accounts ?? []).filter((a) => {
    const c = plan.accounts.find((x) => x.accountId === a.id);
    const cls = c?.cls ?? a.cls;
    return c?.included !== false && (cls === 'cash' || cls === 'investments');
  });
  const nameOf = (id: string) =>
    point?.accounts.find((a) => a.id === id)?.name ?? 'An account that is gone';
  const unused = eligible.filter((a) => !plan.splits.some((s) => s.accountId === a.id));
  const setSplits = (fn: (s: Split[]) => Split[]) =>
    setPlan((p) => ({ ...p, splits: fn(p.splits) }));
  const surplus = result?.years[1]?.netCashFlow ?? 0;

  // Withdrawal order: the owner's order first, then the default (cash, investments, super)
  const included = (point?.accounts ?? []).filter(
    (a) => plan.accounts.find((x) => x.accountId === a.id)?.included !== false,
  );
  const rank = (id: string) => {
    const a = included.find((x) => x.id === id)!;
    const cls = plan.accounts.find((x) => x.accountId === id)?.cls ?? a.cls;
    return cls === 'cash' ? 0 : cls === 'investments' ? 1 : cls === 'super' ? 2 : 3;
  };
  const drawable = included.filter((a) => rank(a.id) <= 2).map((a) => a.id);
  const listed = plan.settings.withdrawalOrder.filter((id) => drawable.includes(id));
  const order = [
    'extra-savings',
    ...listed,
    ...drawable.filter((id) => !listed.includes(id)).sort((x, y) => rank(x) - rank(y)),
  ].filter((id, i, all) => all.indexOf(id) === i);
  const setOrder = (ids: string[]) =>
    setPlan((p) => ({
      ...p,
      settings: { ...p.settings, withdrawalOrder: ids.filter((id) => id !== 'extra-savings') },
    }));
  const orderNames = (id: string) => (id === 'extra-savings' ? 'Extra savings' : nameOf(id));
  const steps = worked(
    example,
    plan.splits.map((s) => ({ ...s, name: nameOf(s.accountId) })),
    formatCurrency,
  );

  return (
    <div className="space-y-8">
      <section aria-label="Savings allocation" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">When you have money left over</h3>
        <p className="text-sm text-text-secondary">
          Each year's surplus first repays any unfunded spending, then goes down this list in order.
          A percentage is a share of <strong>what is left at that step</strong>, not of the whole
          surplus. A dollar amount is a cap that grows with inflation. Whatever remains goes to
          Extra savings.
        </p>
        <ol className="space-y-2">
          {plan.splits.map((s, i) => (
            <li
              key={`${s.accountId}`}
              className="flex flex-wrap items-end gap-3 rounded-md border border-border-light p-3"
            >
              <span className="text-sm font-medium w-6">{i + 1}.</span>
              <span className="text-sm min-w-32 flex-1">{nameOf(s.accountId)}</span>
              <Select
                label={`${nameOf(s.accountId)}: takes`}
                value={s.mode}
                onChange={(mode) =>
                  setSplits((all) =>
                    all.map((x, j) =>
                      j === i
                        ? mode === 'percent'
                          ? { accountId: x.accountId, mode: 'percent', bps: 5000 }
                          : { accountId: x.accountId, mode: 'fixed', amount: 100_000 }
                        : x,
                    ),
                  )
                }
                options={SPLIT_MODES}
                className="w-auto"
              />
              {s.mode === 'percent' ? (
                <RateField
                  label={`${nameOf(s.accountId)}: percent`}
                  bps={s.bps ?? 0}
                  min={0}
                  max={100}
                  onChange={(bps) =>
                    setSplits((all) => all.map((x, j) => (j === i ? { ...x, bps } : x)))
                  }
                />
              ) : (
                <MoneyField
                  label={`${nameOf(s.accountId)}: amount per year`}
                  value={s.amount ?? 0}
                  hint="Today's dollars"
                  onChange={(amount) =>
                    setSplits((all) => all.map((x, j) => (j === i ? { ...x, amount } : x)))
                  }
                />
              )}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${nameOf(s.accountId)} up`}
                  disabled={i === 0}
                  onClick={() => setSplits((all) => move(all, i, i - 1))}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${nameOf(s.accountId)} down`}
                  disabled={i === plan.splits.length - 1}
                  onClick={() => setSplits((all) => move(all, i, i + 1))}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${nameOf(s.accountId)}`}
                  onClick={() => setSplits((all) => all.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </Button>
              </div>
            </li>
          ))}
          <li className="text-sm text-text-secondary px-3">
            {plan.splits.length + 1}. Extra savings: the rest
          </li>
        </ol>
        {unused.length > 0 && (
          <div ref={addRef} className="flex gap-2 items-end">
            {/* Picking adds the account. The field never holds a choice, so it is drawn afresh
                (empty and closed) after each one, and the keyboard stays on it */}
            <Combobox
              key={added}
              label="Add an account to the savings order"
              placeholder="Choose an account"
              items={unused.map((a) => ({ value: a.id, label: a.name }))}
              value=""
              onChange={(accountId) => {
                if (!accountId) return;
                setSplits((all) => [...all, { accountId, mode: 'percent', bps: 5000 }]);
                setAdded((n) => n + 1);
              }}
              className="w-auto min-w-64"
            />
            <Plus size={16} className="mb-3 text-text-tertiary" aria-hidden />
          </div>
        )}
        {eligible.length === 0 && (
          <p className="text-xs text-text-tertiary">
            Savings go to cash or investment accounts. You have none included.
          </p>
        )}
      </section>

      <section aria-label="Worked example" className="space-y-3 rounded-lg bg-surface-alt p-4">
        <h3 className="text-sm font-semibold text-text">Worked example</h3>
        <div className="flex flex-wrap items-end gap-3">
          <MoneyField label="A surplus of" value={example} onChange={setExample} />
          {surplus > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setExample(surplus)}>
              Use my first-year surplus ({formatCurrency(surplus)})
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-tertiary">
              <th className="font-medium py-1">Step</th>
              <th className="font-medium">Rule</th>
              <th className="text-right font-medium">Gets</th>
              <th className="text-right font-medium">Left</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border-light">
              <td className="py-1">Surplus</td>
              <td />
              <td />
              <td className="text-right tabular-nums">{formatCurrency(example)}</td>
            </tr>
            {steps.map((s) => (
              <tr key={`${s.name}:${steps.indexOf(s)}`} className="border-t border-border-light">
                <td className="py-1">{s.name}</td>
                <td className="text-text-secondary">{s.rule}</td>
                <td className="text-right tabular-nums">{formatCurrency(s.amount)}</td>
                <td className="text-right tabular-nums">{formatCurrency(s.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Shortfalls" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">When money runs short</h3>
        <p className="text-sm text-text-secondary">
          A shortfall is taken from the top of this list first. Super is on the list but stays
          preserved until 65, or until you retire at or after the preservation age (
          {plan.settings.preservationAge}). If everything unlocked runs out, the rest is shown as{' '}
          <em>unfunded spending</em>, with the first year it happens.
        </p>
        <ol className="space-y-1">
          {order.map((id, i) => {
            const locked = id !== 'extra-savings' && rank(id) === 2;
            const canMove = id !== 'extra-savings';
            return (
              <li
                key={id}
                className="flex items-center gap-2 text-sm rounded-md border border-border-light px-3 py-2"
              >
                <span className="w-6 font-medium">{i + 1}.</span>
                <span className="flex-1">
                  {orderNames(id)}
                  {locked && (
                    <span className="ml-2 text-xs text-text-tertiary">
                      ({CLASS_LABEL.super}, preserved until 65 or retired from{' '}
                      {plan.settings.preservationAge})
                    </span>
                  )}
                </span>
                {canMove && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Draw on ${orderNames(id)} earlier`}
                      disabled={i <= 1}
                      onClick={() => setOrder(move(order, i, i - 1))}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Draw on ${orderNames(id)} later`}
                      disabled={i === order.length - 1}
                      onClick={() => setOrder(move(order, i, i + 1))}
                    >
                      <ArrowDown size={14} />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {plan.settings.withdrawalOrder.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setOrder([])}>
            Use the default order
          </Button>
        )}
        <p className="text-xs text-text-tertiary">
          Property, vehicles and other assets are never sold to cover spending.
        </p>
      </section>
    </div>
  );
}
