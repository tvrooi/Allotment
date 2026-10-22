import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as api from '../../api/payday';
import { formatCurrency, centsToInput, parseCents, isUnreadableAmount } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCanSave } from '../../hooks/useConnection';

const methods: Record<api.FundingMethod, string> = {
  bills: 'Bills until next payday',
  fixed: 'Fixed per pay',
  due: 'Target by date',
  monthly: 'Smooth monthly cost',
  percentage: 'Percentage of pay',
  target: 'Category target',
  remainder: 'Remainder',
};
const field = 'flex flex-col gap-1 text-sm text-text-secondary';
function MoneyInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const [raw, setRaw] = useState(centsToInput(value));
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={raw}
      aria-invalid={isUnreadableAmount(raw) || undefined}
      onChange={(e) => {
        setRaw(e.target.value);
        if (!isUnreadableAmount(e.target.value)) onChange(parseCents(e.target.value));
      }}
      onBlur={() => {
        if (isUnreadableAmount(raw)) setRaw(centsToInput(value));
      }}
    />
  );
}

function PlanEditor({ plan, onDone }: { plan?: api.PaydayPlan; onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data: categories = [] } = useQuery({
    queryKey: ['payday-categories'],
    queryFn: api.getFundingCategories,
  });
  const [config, setConfig] = useState<api.PaydayConfig>(
    plan ?? {
      name: 'My payday plan',
      anchorDate: format(new Date(), 'yyyy-MM-dd'),
      expectedIncome: 0,
      weekendAdjust: 'none',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rules: [],
    },
  );
  const save = useMutation({
    mutationFn: () => api.savePlan(config, plan?.id),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['payday'] });
      onDone(saved.id);
    },
  });
  const update = (index: number, patch: Partial<api.FundingRule>) =>
    setConfig({
      ...config,
      rules: config.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={field}>
          Plan name
          <Input
            required
            maxLength={100}
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </label>
        <label className={field}>
          Anchor payday
          <Input
            required
            type="date"
            value={config.anchorDate}
            onChange={(e) => setConfig({ ...config, anchorDate: e.target.value })}
          />
        </label>
        <label className={field}>
          Expected take-home pay
          <MoneyInput
            label="Expected take-home pay"
            value={config.expectedIncome}
            onChange={(expectedIncome) => setConfig({ ...config, expectedIncome })}
          />
        </label>
        <label className={field}>
          Weekend adjustment
          <Select
            value={config.weekendAdjust}
            onChange={(e) =>
              setConfig({
                ...config,
                weekendAdjust: e.target.value as api.PaydayConfig['weekendAdjust'],
              })
            }
          >
            <option value="none">Keep the date</option>
            <option value="before">Previous weekday</option>
            <option value="after">Next weekday</option>
            <option value="closest">Closest weekday</option>
          </Select>
        </label>
        <label className={field}>
          Time zone
          <Input
            required
            value={config.timeZone}
            onChange={(e) => setConfig({ ...config, timeZone: e.target.value })}
          />
        </label>
      </div>
      <p className="text-sm text-text-secondary">
        Pay repeats every 14 days. Expected pay is for planning only. Scheduled bill categories
        without a rule are funded first. Add category rules below in funding priority order; the
        remainder runs last.
      </p>
      {config.rules.map((rule, index) => (
        <fieldset key={index} className="border border-border rounded-md p-3 space-y-2">
          <legend className="px-1 text-sm">Priority {index + 1}</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={field}>
              Category
              <Select
                aria-label={`Category ${index + 1}`}
                value={rule.categoryId}
                onChange={(e) => update(index, { categoryId: e.target.value })}
              >
                <option value="">Choose category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className={field}>
              Funding method
              <Select
                aria-label={`Funding method ${index + 1}`}
                value={rule.method}
                onChange={(e) => update(index, { method: e.target.value as api.FundingMethod })}
              >
                {Object.entries(methods).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            {['fixed', 'due', 'monthly'].includes(rule.method) && (
              <label className={field}>
                {rule.method === 'due'
                  ? 'Target balance'
                  : rule.method === 'monthly'
                    ? 'Monthly cost'
                    : 'Amount per pay'}
                <MoneyInput
                  key={rule.categoryId}
                  label={`Rule amount ${index + 1}`}
                  value={rule.amount}
                  onChange={(amount) => update(index, { amount })}
                />
              </label>
            )}
            {rule.method === 'due' && (
              <label className={field}>
                Due date
                <Input
                  type="date"
                  required
                  value={rule.dueDate ?? ''}
                  onChange={(e) => update(index, { dueDate: e.target.value })}
                />
              </label>
            )}
            {rule.method === 'percentage' && (
              <label className={field}>
                Percent
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={rule.percent}
                  onChange={(e) => update(index, { percent: Number(e.target.value) })}
                />
              </label>
            )}
            {rule.method === 'target' && (
              <p className="text-xs text-text-secondary sm:col-span-2">
                Funds what the category's target still needs this month, shared between this and the
                month's remaining paydays. Set the target on the category's page.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={index === 0}
              onClick={() => {
                const rules = [...config.rules];
                [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
                setConfig({ ...config, rules });
              }}
            >
              Move up
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setConfig({ ...config, rules: config.rules.filter((_, i) => i !== index) })
              }
            >
              Remove rule
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        disabled={config.rules.length >= 100}
        onClick={() =>
          setConfig({
            ...config,
            rules: [
              ...config.rules,
              { categoryId: '', method: 'fixed', amount: 0, dueDate: null, percent: 0 },
            ],
          })
        }
      >
        Add funding rule
      </Button>
      {save.error && (
        <p role="alert" className="text-negative">
          {save.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || save.isPending}>
          Save payday plan
        </Button>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FundingPanel({ plan, onEdit }: { plan: api.PaydayPlan; onEdit: () => void }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const context = useQuery({
    queryKey: ['payday', plan.id],
    queryFn: () => api.getPaydayContext(plan.id),
  });
  const [chosenDate, setChosenDate] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [incomeIds, setIncomeIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<api.PaydayPreview | null>(null);
  const [message, setMessage] = useState('');
  const data = context.data;
  const defaultPay =
    data?.paydays.filter((p) => p.expectedDate <= data.today).at(-1) ?? data?.paydays[0];
  const pay = data?.paydays.find((p) => p.scheduledDate === chosenDate) ?? defaultPay;
  const request = {
    scheduledDate: pay?.scheduledDate ?? '',
    actualPayDate: actualDate || pay?.expectedDate || '',
    incomeIds,
  };
  const alreadyApplied = data?.history.some((e) => e.scheduledDate === pay?.scheduledDate);
  const refresh = useMutation({
    mutationFn: () => api.previewPayday(plan.id, request),
    onSuccess: (result) => {
      setPreview(result);
      setMessage('');
    },
  });
  const apply = useMutation({
    mutationFn: () => api.applyPayday(plan.id, request, preview!.previewKey),
    onSuccess: (event) => {
      setPreview(null);
      setIncomeIds([]);
      setMessage(
        event.alreadyApplied
          ? 'This payday was already applied.'
          : 'Funding applied to your monthly budget.',
      );
      qc.invalidateQueries({ queryKey: ['payday'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['review'] });
    },
    onError: () => setPreview(null),
  });
  const archive = useMutation({
    mutationFn: () => api.archivePlan(plan.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payday'] }),
  });
  if (context.isPending) return <p role="status">Loading payday plan…</p>;
  if (context.error) return <p role="alert">{context.error.message}</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onEdit} disabled={!canSave}>
          Edit plan
        </Button>
        <Button
          variant="ghost"
          disabled={!canSave || archive.isPending}
          onClick={() => archive.mutate()}
        >
          Archive plan
        </Button>
      </div>
      <p className="text-sm text-text-secondary">
        Every 14 days · expected {formatCurrency(plan.expectedIncome)} · {plan.timeZone}. Choose the
        actual received income below. Applying adds to the current monthly budget and preserves
        rollover.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={field}>
          Payday
          <Select
            value={pay?.scheduledDate ?? ''}
            onChange={(e) => {
              setChosenDate(e.target.value);
              setActualDate('');
              setPreview(null);
              setIncomeIds([]);
              setMessage('');
            }}
          >
            {data!.paydays.map((p) => (
              <option key={p.scheduledDate} value={p.scheduledDate}>
                {formatDay(p.expectedDate)}
                {data!.history.some((e) => e.scheduledDate === p.scheduledDate) ? ' · applied' : ''}
              </option>
            ))}
          </Select>
        </label>
        <label className={field}>
          Actual or adjusted payday
          <Input
            type="date"
            value={request.actualPayDate}
            onChange={(e) => {
              setActualDate(e.target.value);
              setPreview(null);
            }}
          />
        </label>
      </div>
      {alreadyApplied ? (
        <p role="status">
          This payday has already been funded. Its saved allocation is in the history below.
        </p>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="font-medium mb-2">Income received</legend>
            <p className="text-sm text-text-secondary">
              Select deposits for this pay. Unconfirmed scheduled salary estimates and deposits
              already used by another plan are excluded. Reconcile a generated salary against your
              bank statement before using it. Any unused portion stays available for manual
              budgeting.
            </p>
            {data!.income.length === 0 && (
              <p className="text-sm">
                No unused income deposits. Import or record received pay in an income category
                first.
              </p>
            )}
            <div className="max-h-56 overflow-y-auto space-y-2">
              {data!.income.map((income) => (
                <label key={income.id} className="flex items-center gap-3 text-sm min-h-11">
                  <input
                    type="checkbox"
                    checked={incomeIds.includes(income.id)}
                    onChange={(e) => {
                      setIncomeIds(
                        e.target.checked
                          ? [...incomeIds, income.id]
                          : incomeIds.filter((id) => id !== income.id),
                      );
                      setPreview(null);
                    }}
                  />
                  <span>
                    {income.date} · {income.name || 'Income'} · {formatCurrency(income.amount)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button
            variant="secondary"
            disabled={!canSave || !pay || refresh.isPending || apply.isPending}
            onClick={() => {
              setPreview(null);
              refresh.mutate();
            }}
          >
            Preview funding
          </Button>
        </>
      )}
      {preview && (
        <section aria-label="Funding preview" className="space-y-3">
          <h3 className="font-semibold">Until next payday · {formatDay(preview.nextPayday)}</h3>
          <p className="text-sm">
            Received {formatCurrency(preview.received)} · available to this plan{' '}
            {formatCurrency(preview.available)} · allocate {formatCurrency(preview.totalAllocated)}{' '}
            · left unallocated {formatCurrency(preview.unallocated)}.
          </p>
          <p className="text-sm text-text-secondary">
            Allocations go into {preview.month}. Available money accounts for existing allocations,
            rollover, overspending and cash held. Expected wages do not increase it.
          </p>
          {preview.future && (
            <p role="status">
              Future payday: planning only. Funding becomes available once income is received and
              the adjusted payday arrives.
            </p>
          )}
          {preview.shortfall > 0 && (
            <p className="text-negative">
              Funding shortfall: {formatCurrency(preview.shortfall)}. Higher priorities receive
              money first.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Available now</th>
                  <th className="text-right p-2">Needed</th>
                  <th className="text-right p-2">Add</th>
                  <th className="text-right p-2">Bills uncovered</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.categoryId} className="border-t border-border">
                    <td className="p-2">
                      {r.name}
                      <div className="text-xs text-text-tertiary">
                        {methods[r.method]}
                        {r.method === 'target' &&
                          (r.targetUnderfunded === null
                            ? ' · no target set'
                            : ` · ${formatCurrency(r.targetUnderfunded)} still needed this month`)}
                        {r.goalInactive && ' · goal not active, nothing proposed'}
                      </div>
                    </td>
                    <td className="p-2 text-right">{formatCurrency(r.balance)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.needed)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.allocated)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.uncoveredBills)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary className="cursor-pointer select-none text-sm font-medium text-text-secondary hover:text-text">
              Bills before next payday ({preview.bills.length})
            </summary>
            {preview.bills.length === 0 && (
              <p className="text-sm py-2">
                No unpaid scheduled bills in this period. Add recurring bills with expense
                categories to see coverage.
              </p>
            )}
            {preview.bills.map((b) => (
              <p key={b.id} className="text-sm py-2">
                {b.date} · {b.name} · {formatCurrency(b.amount)}
                {b.estimated ? ' (estimate)' : ''}
              </p>
            ))}
          </details>
          <Button
            disabled={
              !canSave ||
              preview.future ||
              !!preview.existingEventId ||
              preview.totalAllocated <= 0 ||
              apply.isPending
            }
            onClick={() => apply.mutate()}
          >
            Apply funding
          </Button>
        </section>
      )}
      {(refresh.error || apply.error || archive.error) && (
        <p role="alert" className="text-negative">
          {(refresh.error || apply.error || archive.error)!.message}
        </p>
      )}
      {message && (
        <p role="status" className="text-positive">
          {message}
        </p>
      )}
      <details>
        <summary className="cursor-pointer select-none text-sm font-medium text-text-secondary hover:text-text">
          Funding history ({data!.history.length})
        </summary>
        {data!.history.map((event) => {
          const saved = JSON.parse(event.snapshotJson) as api.PaydayPreview;
          return (
            <details key={event.id} className="py-2 text-sm">
              <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
                Payday {formatDay(event.scheduledDate)} · applied {formatDay(event.appliedDate)} ·{' '}
                {formatCurrency(saved.totalAllocated)}
              </summary>
              {saved.rows
                .filter((r) => r.allocated > 0)
                .map((r) => (
                  <p key={r.categoryId} className="pl-4 py-1">
                    {r.name}: {formatCurrency(r.allocated)} → {saved.month}
                  </p>
                ))}
            </details>
          );
        })}
      </details>
    </div>
  );
}

export function PaydayPlan() {
  const {
    data: plans = [],
    error,
    isPending,
  } = useQuery({ queryKey: ['payday'], queryFn: api.getPlans });
  const [selectedId, setSelectedId] = useState('');
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = plans.filter((p) => showArchived || !p.archived);
  const selected = active.find((p) => p.id === selectedId) ?? active[0];
  return (
    <section aria-label="Payday plan" className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Payday plan</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditor('new')}>
          New payday plan
        </Button>
      </div>
      {isPending && <p role="status">Loading plans…</p>}
      {error && <p role="alert">{error.message}</p>}
      {editor ? (
        <PlanEditor
          key={editor === 'edit' ? selected?.id : 'new'}
          plan={editor === 'edit' ? selected : undefined}
          onDone={(id) => {
            setEditor(null);
            if (id) setSelectedId(id);
          }}
        />
      ) : (
        <>
          {!active.length && !isPending && (
            <p className="text-sm text-text-secondary">
              Set up fortnightly funding and see what your bills need before the next pay.
            </p>
          )}
          {active.length > 0 && (
            <label className={field}>
              Plan
              <Select value={selected?.id ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.archived ? ' · archived' : ''}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {selected &&
            (selected.archived ? (
              <ArchivedHistory plan={selected} />
            ) : (
              <FundingPanel key={selected.id} plan={selected} onEdit={() => setEditor('edit')} />
            ))}
          {plans.some((p) => p.archived) && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived plans
            </label>
          )}
        </>
      )}
    </section>
  );
}
function ArchivedHistory({ plan }: { plan: api.PaydayPlan }) {
  const { data } = useQuery({
    queryKey: ['payday', plan.id],
    queryFn: () => api.getPaydayContext(plan.id),
  });
  return (
    <div className="space-y-2 text-sm">
      <p>This plan is archived. Funding history is preserved.</p>
      {data?.history.map((e) => (
        <p key={e.id}>
          {formatDay(e.scheduledDate)} ·{' '}
          {formatCurrency((JSON.parse(e.snapshotJson) as api.PaydayPreview).totalAllocated)}
        </p>
      ))}
    </div>
  );
}
