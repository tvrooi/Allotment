import { useEffect, useId, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as api from '../../api/payday';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Input } from '../ui/Input';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Label } from '../ui/Label';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { GuideLink } from '../guide/GuideLink';
import { HelpTip } from '../ui/HelpTip';
import { useCanSave } from '../../hooks/useConnection';
import { newClientId } from '../../utils/offline';
import { useCategories } from '../../hooks/useCategories';
import { useTransactions, useUpdateTransaction } from '../../hooks/useTransactions';
import { useSalaryGuess } from '../../hooks/useReports';
import { findPayCategory } from '../../utils/payCategory';
import { salaryCadence } from '../review/SortUncategorised';
import type { SalaryGuess } from '../../api/reports';

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
const WEEKEND_OPTIONS: { value: api.PaydayConfig['weekendAdjust']; label: string }[] = [
  { value: 'none', label: 'Keep the date' },
  { value: 'before', label: 'Previous weekday' },
  { value: 'after', label: 'Next weekday' },
  { value: 'closest', label: 'Closest weekday' },
];
const METHOD_OPTIONS = Object.entries(methods).map(([value, label]) => ({ value, label }));
/** The server's bounds on a percentage rule (`percent` in server/src/services/paydayConfig.ts) */
const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

function PlanEditor({
  plan,
  prefill,
  onDone,
}: {
  plan?: api.PaydayPlan;
  /** The pay found in the register: a new plan starts from its latest date and amount */
  prefill?: SalaryGuess | null;
  onDone: (id?: string) => void;
}) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data: categories = [] } = useQuery({
    queryKey: ['payday-categories'],
    queryFn: api.getFundingCategories,
  });
  // The rule's picker offers exactly the categories the server funds, in their groups
  const fundableIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const { allValid, report } = useAmountValidity();
  const fieldId = useId();
  const [config, setConfig] = useState<api.PaydayConfig>(
    plan ?? {
      name: 'My payday plan',
      anchorDate: prefill?.latestDate ?? format(new Date(), 'yyyy-MM-dd'),
      expectedIncome: prefill?.latestAmount ?? 0,
      weekendAdjust: 'none',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rules: [],
    },
  );
  // Each rule row's own key, moved, removed and added with its rule, so a field's typed text
  // stays with the rule it was typed for. Kept beside the rules, never in what is saved.
  const [ruleKeys, setRuleKeys] = useState(() => config.rules.map(() => newClientId()));
  const save = useMutation({
    mutationFn: () => api.savePlan(config, plan?.id),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['payday'] });
      onDone(saved.id);
    },
  });
  // The native required checks the date inputs had: a plan needs its anchor, a due rule its date
  const datesSet =
    config.anchorDate !== '' && config.rules.every((r) => r.method !== 'due' || !!r.dueDate);
  const canSubmit = canSave && allValid && datesSet && !save.isPending;
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
        if (canSubmit) save.mutate();
      }}
    >
      <AmountFields report={report}>
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
          <div className={field}>
            {/* The visible label sits beside its help; the picker carries the same name itself */}
            <span className="flex items-center gap-1">
              <span aria-hidden="true">Anchor payday</span>
              <HelpTip label="How to choose the payday date">
                Pick any one day you were paid. Allotment counts every other payday from it, using
                your pay rhythm (for example every 14 days), so it can tell when the next pay is
                due.
              </HelpTip>
            </span>
            <DatePicker
              label="Anchor payday"
              hideLabel
              isRequired
              value={config.anchorDate}
              onChange={(anchorDate) => setConfig({ ...config, anchorDate })}
              description="One day you were paid. Later paydays are counted from it."
            />
          </div>
          <div className={field}>
            <Label htmlFor={`${fieldId}-income`}>Expected take-home pay</Label>
            <CurrencyInput
              id={`${fieldId}-income`}
              aria-label="Expected take-home pay"
              // Signed, so a typed negative reaches the server's nonnegative check, never saved as positive
              allowNegative
              value={config.expectedIncome}
              onChange={(expectedIncome) => setConfig({ ...config, expectedIncome })}
              onTextChange={(cents) => {
                if (cents !== null) setConfig({ ...config, expectedIncome: cents });
              }}
            />
          </div>
          <Select
            label="Weekend adjustment"
            value={config.weekendAdjust}
            onChange={(value) =>
              setConfig({
                ...config,
                weekendAdjust: value as api.PaydayConfig['weekendAdjust'],
              })
            }
            options={WEEKEND_OPTIONS}
          />
          <label className={field}>
            Time zone
            <Input
              required
              value={config.timeZone}
              onChange={(e) => setConfig({ ...config, timeZone: e.target.value })}
            />
          </label>
        </div>
        {!plan && prefill && (
          <p role="status" className="text-sm text-text">
            Filled in from your pay from {prefill.payeeName} ({formatDay(prefill.latestDate)},{' '}
            {formatCurrency(prefill.latestAmount)}, {salaryCadence(prefill)}). Change anything that
            is not right.
          </p>
        )}
        <p className="text-sm text-text-secondary">
          A funding rule says how much of each pay goes to one category.
          <HelpTip label="What is a funding rule?">
            Each rule is a category plus a way to work out an amount: a fixed sum, a percentage of
            pay, what is needed by a due date, or whatever is left over. Rules are filled from the
            top, so put the most important first.
          </HelpTip>{' '}
          Pay repeats every 14 days. Expected pay is for planning only. Scheduled bill categories
          without a rule are funded first. Add category rules below in funding priority order; the
          remainder runs last.
        </p>
        {config.rules.map((rule, index) => (
          <fieldset key={ruleKeys[index]} className="border border-border rounded-md p-3 space-y-2">
            <legend className="px-1 text-sm">Priority {index + 1}</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className={field}>
                <Label htmlFor={`${fieldId}-category-${index}`}>Category</Label>
                <CategorySelectButton
                  id={`${fieldId}-category-${index}`}
                  label={`Category ${index + 1}`}
                  placeholder="Choose category"
                  value={rule.categoryId || null}
                  onChange={(id) => update(index, { categoryId: id ?? '' })}
                  categoryIds={fundableIds}
                  allowNone={false}
                  allowCreate={false}
                  includeHidden
                />
              </div>
              <div className={field}>
                <span aria-hidden="true">Funding method</span>
                <Select
                  aria-label={`Funding method ${index + 1}`}
                  value={rule.method}
                  onChange={(value) => update(index, { method: value as api.FundingMethod })}
                  options={METHOD_OPTIONS}
                />
              </div>
              {['fixed', 'due', 'monthly'].includes(rule.method) && (
                <div className={field}>
                  <Label htmlFor={`${fieldId}-amount-${index}`}>
                    {rule.method === 'due'
                      ? 'Target balance'
                      : rule.method === 'monthly'
                        ? 'Monthly cost'
                        : 'Amount per pay'}
                  </Label>
                  <CurrencyInput
                    id={`${fieldId}-amount-${index}`}
                    aria-label={`Rule amount ${index + 1}`}
                    // Signed, so a typed negative reaches the server's nonnegative check, never saved as positive
                    allowNegative
                    value={rule.amount}
                    onChange={(amount) => update(index, { amount })}
                    onTextChange={(cents) => {
                      if (cents !== null) update(index, { amount: cents });
                    }}
                  />
                </div>
              )}
              {rule.method === 'due' && (
                <DatePicker
                  label="Due date"
                  isRequired
                  value={rule.dueDate ?? ''}
                  onChange={(dueDate) => update(index, { dueDate: dueDate || null })}
                />
              )}
              {rule.method === 'percentage' && (
                <NumberField
                  label="Percent"
                  min={PERCENT_MIN}
                  max={PERCENT_MAX}
                  value={rule.percent}
                  onChange={(percent) => {
                    if (percent !== null) update(index, { percent });
                  }}
                />
              )}
              {rule.method === 'target' && (
                <p className="text-xs text-text-secondary sm:col-span-2">
                  Funds what the category's target still needs this month, shared between this and
                  the month's remaining paydays. Set the target on the category's page.
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
                  const keys = [...ruleKeys];
                  [keys[index - 1], keys[index]] = [keys[index], keys[index - 1]];
                  setRuleKeys(keys);
                }}
              >
                Move up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfig({ ...config, rules: config.rules.filter((_, i) => i !== index) });
                  setRuleKeys(ruleKeys.filter((_, i) => i !== index));
                }}
              >
                Remove rule
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          variant="secondary"
          disabled={config.rules.length >= 100}
          onClick={() => {
            setConfig({
              ...config,
              rules: [
                ...config.rules,
                { categoryId: '', method: 'fixed', amount: 0, dueDate: null, percent: 0 },
              ],
            });
            setRuleKeys([...ruleKeys, newClientId()]);
          }}
        >
          Add funding rule
        </Button>
      </AmountFields>
      {save.error && (
        <p role="alert" className="text-negative">
          {save.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit}>
          Save payday plan
        </Button>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * No income deposit to fund from: offer the recent money in that has no category, so the pay can
 * be marked as income here instead of in the register.
 */
function PayCandidates({ onPay }: { onPay: (transactionId: string) => void }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data: groups = [] } = useCategories();
  const pay = findPayCategory(groups);
  const recent = useTransactions({ uncategorized: true, direction: 'credit', limit: 8 });
  const update = useUpdateTransaction();
  const rows = (recent.data ?? []).filter(
    (t) => !t.transferTransactionId && !t.notes?.includes('Up internal transfer'),
  );
  if (recent.isPending) return <p role="status">Looking for recent deposits…</p>;
  if (!rows.length || !pay)
    return (
      <p className="text-sm">
        No unused income deposits. Import or record received pay in an income category first.
      </p>
    );
  return (
    <div className="space-y-2" role="group" aria-label="Recent deposits without a category">
      <p className="text-sm">
        No deposits are marked as income yet. Which of these is your pay? It is put in {pay.name}.
      </p>
      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1 basis-48">
              {formatDay(t.date)} · {t.payeeName || 'Deposit'} · {formatCurrency(t.amount)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`This is pay: ${t.payeeName || 'Deposit'} on ${formatDay(t.date)}`}
              disabled={!canSave || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: t.id, data: { categoryId: pay.id } },
                  {
                    onSuccess: () => {
                      void qc.invalidateQueries({ queryKey: ['payday'] });
                      void qc.invalidateQueries({ queryKey: ['reports'] });
                      onPay(t.id);
                    },
                  },
                )
              }
            >
              This is pay
            </Button>
          </li>
        ))}
      </ul>
      {update.error && (
        <p role="alert" className="text-negative">
          {update.error.message}
        </p>
      )}
    </div>
  );
}

function FundingPanel({ plan, onEdit }: { plan: api.PaydayPlan; onEdit: () => void }) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [chosenDate, setChosenDate] = useState('');
  // The suggestion depends on the payday shown, so the chosen date is part of the key
  const context = useQuery({
    queryKey: ['payday', plan.id, chosenDate],
    queryFn: () => api.getPaydayContext(plan.id, chosenDate || undefined),
    placeholderData: keepPreviousData,
  });
  const [showOthers, setShowOthers] = useState(false);
  const [actualDate, setActualDate] = useState('');
  // null = untouched: only the server's suggested deposit (if any) is ticked until the person chooses
  const [picked, setPicked] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<api.PaydayPreview | null>(null);
  const [message, setMessage] = useState('');
  const [needDeposit, setNeedDeposit] = useState(false);
  // The funding just applied, so Undo sits next to the confirmation
  const [justApplied, setJustApplied] = useState<string | null>(null);
  // Whether the actual payday is a whole date: a half-typed one holds no day (the request would
  // still carry the last whole one), so no preview is made or kept for it
  const { allValid: actualWhole, report: reportActual } = useAmountValidity();
  useEffect(() => {
    if (!actualWhole) setPreview(null);
  }, [actualWhole]);
  const data = context.data;
  const incomeIds = picked ?? (data?.suggestion ? [data.suggestion.id] : []);
  const setIncomeIds = (ids: string[]) => {
    setPicked(ids);
    setNeedDeposit(false);
  };
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
      setJustApplied(event.alreadyApplied ? null : event.id);
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
  const undo = useMutation({
    mutationFn: (eventId: string) => api.undoPayday(plan.id, eventId),
    onSuccess: (result) => {
      setJustApplied(null);
      setPreview(null);
      setPicked(null);
      const reversed = result.reversed.reduce((sum, r) => sum + r.amount, 0);
      setMessage(
        `Funding undone: ${formatCurrency(reversed)} taken back out of the budget. The pay is free to preview again.` +
          (result.skipped.length
            ? ` Not taken back, because you changed the assignment since: ${result.skipped
                .map((s) => `${s.name} ${formatCurrency(s.amount)}`)
                .join(', ')}.`
            : ''),
      );
      qc.invalidateQueries({ queryKey: ['payday'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['review'] });
    },
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
        <Select
          label="Payday"
          value={pay?.scheduledDate ?? ''}
          onChange={(value) => {
            setChosenDate(value);
            setActualDate('');
            setPreview(null);
            setPicked(null);
            setShowOthers(false);
            setMessage('');
          }}
          options={data!.paydays.map((p) => ({
            value: p.scheduledDate,
            label:
              formatDay(p.expectedDate) +
              (data!.history.some((e) => e.scheduledDate === p.scheduledDate) ? ' · applied' : ''),
          }))}
        />
        <AmountFields report={reportActual}>
          <DatePicker
            label="Actual or adjusted payday"
            value={request.actualPayDate}
            onChange={(value) => {
              setActualDate(value);
              setPreview(null);
            }}
          />
        </AmountFields>
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
              <PayCandidates
                onPay={(id) => {
                  setIncomeIds(incomeIds.includes(id) ? incomeIds : [...incomeIds, id]);
                  setPreview(null);
                }}
              />
            )}
            {data!.suggestion ? (
              <p className="text-sm" role="status">
                Suggested: {data!.suggestion.reasons.join('. ')}.
              </p>
            ) : (
              data!.income.length > 0 && (
                <p className="text-sm" role="status">
                  Choose the deposit that pays this cycle
                </p>
              )
            )}
            {(() => {
              const row = (income: api.PaydayContext['income'][number]) => (
                <Checkbox
                  key={income.id}
                  className="min-h-11 items-center gap-3"
                  checked={incomeIds.includes(income.id)}
                  onCheckedChange={(checked) => {
                    setIncomeIds(
                      checked
                        ? [...incomeIds, income.id]
                        : incomeIds.filter((id) => id !== income.id),
                    );
                    setPreview(null);
                  }}
                >
                  {`${formatDay(income.date)} · ${income.name || 'Income'} · ${formatCurrency(income.amount)}`}
                </Checkbox>
              );
              const suggested = data!.income.filter((i) => i.id === data!.suggestion?.id);
              const others = data!.income.filter((i) => i.id !== data!.suggestion?.id);
              // Nothing is suggested: the person has to choose, so the list is open
              const open = !data!.suggestion || showOthers;
              return (
                <>
                  {suggested.map(row)}
                  {data!.suggestion && others.length > 0 && (
                    <button
                      type="button"
                      className="text-sm underline min-h-11"
                      aria-expanded={showOthers}
                      aria-controls="payday-other-deposits"
                      onClick={() => setShowOthers(!showOthers)}
                    >
                      Choose another deposit
                    </button>
                  )}
                  {open && (
                    <div id="payday-other-deposits" className="max-h-56 overflow-y-auto space-y-2">
                      {others.map(row)}
                    </div>
                  )}
                </>
              );
            })()}
          </fieldset>
          <Button
            variant="secondary"
            disabled={!canSave || !pay || !actualWhole || refresh.isPending || apply.isPending}
            onClick={() => {
              setPreview(null);
              if (!incomeIds.length) return setNeedDeposit(true);
              refresh.mutate();
            }}
          >
            Preview funding
          </Button>
          {needDeposit && (
            <p role="alert" className="text-sm text-negative">
              Tick the pay you received above first, then preview.
            </p>
          )}
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
                {formatDay(b.date)} · {b.name} · {formatCurrency(b.amount)}
                {b.estimated ? ' (estimate)' : ''}
              </p>
            ))}
          </details>
          {preview.totalAllocated <= 0 && !preview.future && !preview.existingEventId && (
            <p role="status" className="text-sm">
              Nothing to fund before your next payday on {formatDay(preview.nextPayday)} — add a
              funding rule or a bill to put this pay to work.
            </p>
          )}
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
          {!preview.future && !preview.existingEventId && preview.totalAllocated <= 0 && (
            <p className="text-xs text-text-secondary">
              Apply is off because there is nothing to add.
            </p>
          )}
        </section>
      )}
      {(refresh.error || apply.error || archive.error || undo.error) && (
        <p role="alert" className="text-negative">
          {(refresh.error || apply.error || archive.error || undo.error)!.message}
        </p>
      )}
      {message && (
        <div role="status" className="flex flex-wrap items-center gap-3 text-positive">
          <span>{message}</span>
          {justApplied && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!canSave || undo.isPending}
              onClick={() => undo.mutate(justApplied)}
            >
              Undo
            </Button>
          )}
        </div>
      )}
      <details>
        <summary className="cursor-pointer select-none text-sm font-medium text-text-secondary hover:text-text">
          Funding history ({data!.history.length + (data!.undone ?? []).length})
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
              <div className="pl-4 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Undo funding for payday ${formatDay(event.scheduledDate)}`}
                  disabled={!canSave || undo.isPending}
                  onClick={() => undo.mutate(event.id)}
                >
                  Undo
                </Button>
              </div>
            </details>
          );
        })}
        {(data!.undone ?? []).map((event) => {
          const saved = JSON.parse(event.snapshotJson) as api.PaydayPreview;
          const result = JSON.parse(event.resultJson) as Pick<api.UndoResult, 'skipped'>;
          return (
            <details key={event.id} className="py-2 text-sm">
              <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
                Payday {formatDay(event.scheduledDate)} · {formatCurrency(saved.totalAllocated)} ·
                Undone on {formatDay(event.undoneAt.slice(0, 10))}
              </summary>
              {saved.rows
                .filter((r) => r.allocated > 0)
                .map((r) => (
                  <p key={r.categoryId} className="pl-4 py-1 line-through">
                    {r.name}: {formatCurrency(r.allocated)} → {saved.month}
                  </p>
                ))}
              {result.skipped.map((s) => (
                <p key={s.categoryId} className="pl-4 py-1">
                  Not taken back: {s.name} {formatCurrency(s.amount)}
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
  const salary = useSalaryGuess();
  // Pay every 14 days is what a plan repeats; weekly or monthly pay can't prefill it
  const prefill = salary.data?.intervalDays === 14 ? salary.data : null;
  const active = plans.filter((p) => showArchived || !p.archived);
  const selected = active.find((p) => p.id === selectedId) ?? active[0];
  return (
    <section aria-label="Payday plan" className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Payday plan</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditor('new')}>
          New payday plan
        </Button>
        <GuideLink
          page="payday-plans"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 max-md:min-h-11 inline-flex items-center"
        >
          How payday plans work
        </GuideLink>
      </div>
      {isPending && <p role="status">Loading plans…</p>}
      {error && <p role="alert">{error.message}</p>}
      {editor === 'new' && salary.isPending ? (
        <p role="status">Looking for your pay…</p>
      ) : editor ? (
        <PlanEditor
          key={editor === 'edit' ? selected?.id : 'new'}
          plan={editor === 'edit' ? selected : undefined}
          prefill={editor === 'new' ? prefill : undefined}
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
            <Combobox
              label="Plan"
              items={active.map((p) => ({
                value: p.id,
                label: p.name + (p.archived ? ' · archived' : ''),
              }))}
              value={selected?.id ?? ''}
              // Emptying the text to search keeps the plan shown until another is picked
              onChange={(id) => {
                if (id) setSelectedId(id);
              }}
            />
          )}
          {selected &&
            (selected.archived ? (
              <ArchivedHistory plan={selected} />
            ) : (
              <FundingPanel key={selected.id} plan={selected} onEdit={() => setEditor('edit')} />
            ))}
          {plans.some((p) => p.archived) && (
            <Checkbox checked={showArchived} onCheckedChange={setShowArchived}>
              Show archived plans
            </Checkbox>
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
