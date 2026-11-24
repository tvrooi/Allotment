import { Select } from '../ui/Select';
import { Combobox } from '../ui/Combobox';
import { Checkbox } from '../ui/Checkbox';
import { DatePicker } from '../ui/DatePicker';
import { NumberField } from '../ui/NumberField';
import { useState, useId } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useCreatePlan } from '../../hooks/usePaymentPlans';
import { formatCurrency } from '../../utils/currency';
import { formatShortDay } from '../../utils/dates';
import {
  PROVIDER_NAMES,
  type HistoryGroup,
  type PlanFrequency,
  type PlanProvider,
} from '../../api/paymentPlans';
import {
  FREQUENCY_LABELS,
  fundingAccounts,
  planAccounts,
  purchaseGroups,
  splitTotal,
} from './planHelpers';

const label = 'block text-sm font-medium text-text-secondary mb-1';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  provider: PlanProvider;
  /** Recording an earlier purchase: the bank payments already made for it */
  earlier?: HistoryGroup | null;
  onCreated?: () => void;
}

/**
 * "Add a purchase": what was bought, where and for what, and how the provider splits it.
 * The purchase goes on the provider's account with its real category; the payments are linked
 * as they arrive from the bank (or, for an earlier purchase, the ones already made now).
 */
export function NewPlanModal({ isOpen, onClose, provider, earlier, onCreated }: Props) {
  const fieldId = useId();
  const { allValid, report } = useAmountValidity();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const canSave = useCanSave();
  const create = useCreatePlan();
  const plans = planAccounts(accounts);
  const sources = fundingAccounts(accounts);

  const initial = () => ({
    accountId: plans[0]?.id ?? '',
    fundingAccountId: earlier?.accountId ?? sources[0]?.id ?? '',
    merchant: '',
    purchaseDate: earlier?.suggested.firstDueDate ?? today,
    total: earlier?.suggested.total ?? 0,
    categoryId: null as string | null,
    instalmentCount: earlier?.suggested.instalmentCount ?? 4,
    frequency: (earlier?.suggested.frequency ?? 'fortnightly') as PlanFrequency,
    firstDueDate: earlier?.suggested.firstDueDate ?? today,
    firstSameDay: true,
  });
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  // A fresh form each time it opens (for a different earlier purchase too)
  const key = isOpen ? (earlier ?? 'new') : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (isOpen) {
      setForm(initial());
      setError(null);
    }
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const linked = earlier?.transactions ?? [];
  const paid = linked.reduce((s, t) => s - t.amount, 0);
  const preview = splitTotal(form.total - paid, form.instalmentCount - linked.length);
  const firstDueDate = form.firstSameDay && !earlier ? form.purchaseDate : form.firstDueDate;
  const valid =
    allValid &&
    form.accountId &&
    form.fundingAccountId &&
    form.merchant.trim() &&
    form.total > 0 &&
    form.instalmentCount >= Math.max(1, linked.length) &&
    form.instalmentCount <= 60 &&
    form.purchaseDate &&
    form.purchaseDate <= today &&
    firstDueDate &&
    firstDueDate >= form.purchaseDate;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    create.mutate(
      {
        accountId: form.accountId,
        fundingAccountId: form.fundingAccountId,
        provider,
        merchant: form.merchant.trim(),
        purchaseDate: form.purchaseDate,
        total: form.total,
        categoryId: form.categoryId,
        instalmentCount: form.instalmentCount,
        frequency: form.frequency,
        firstDueDate,
        linkTransactionIds: linked.length ? linked.map((t) => t.id) : undefined,
      },
      {
        onSuccess: () => {
          onCreated?.();
          onClose();
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Could not save'),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={earlier ? 'Record an earlier purchase' : 'Add a purchase'}
      size="lg"
    >
      <AmountFields report={report}>
        <form onSubmit={submit} className="space-y-4">
          {earlier && (
            <div className="rounded-md bg-surface-alt px-3 py-2 text-sm text-text-secondary">
              Links {linked.length} payment{linked.length === 1 ? '' : 's'} from{' '}
              {earlier.accountName}:{' '}
              {linked
                .map((t) => `${formatShortDay(t.date)} ${formatCurrency(-t.amount)}`)
                .join(', ')}
              . They become payments to this purchase instead of spending.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="plan-merchant">
                Where you bought it
              </label>
              <Input
                id="plan-merchant"
                value={form.merchant}
                onChange={(e) => set('merchant', e.target.value)}
                placeholder="Bunnings"
                autoFocus
              />
            </div>
            <div>
              <p className={label}>What it was for</p>
              <CategorySelectButton
                value={form.categoryId}
                onChange={(id) => set('categoryId', id)}
                groups={purchaseGroups(groups)}
                includeHidden
                allowCreate={false}
                label="What it was for"
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-price`} className={label}>
                Price
              </label>
              <CurrencyInput
                id={`${fieldId}-price`}
                value={form.total}
                onChange={(v) => set('total', v)}
                aria-label="Price"
              />
            </div>
            <div>
              <DatePicker
                id="plan-date"
                label="Bought on"
                value={form.purchaseDate}
                maxValue={today}
                onChange={(date) => set('purchaseDate', date)}
              />
            </div>
            <div>
              <NumberField
                id="plan-count"
                label="Number of payments"
                min={Math.max(1, linked.length)}
                max={60}
                value={form.instalmentCount}
                onChange={(count) => {
                  if (count !== null) set('instalmentCount', count);
                }}
              />
            </div>
            <div>
              <Select
                id="plan-frequency"
                label="How often"
                value={form.frequency}
                onChange={(value) => set('frequency', value as PlanFrequency)}
                options={Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
            <div>
              <Combobox
                id="plan-account"
                label="On account"
                value={form.accountId}
                onChange={(id) => set('accountId', id)}
                items={plans.map((account) => ({ value: account.id, label: account.name }))}
                menuTrigger="focus"
              />
            </div>
            <div>
              <Combobox
                id="plan-funding"
                label="Payments come from"
                value={form.fundingAccountId}
                onChange={(id) => set('fundingAccountId', id)}
                items={sources.map((account) => ({ value: account.id, label: account.name }))}
                menuTrigger="focus"
                isDisabled={!!earlier}
              />
            </div>
          </div>
          {!earlier && (
            <div className="space-y-2">
              <Checkbox
                checked={form.firstSameDay}
                onCheckedChange={(checked) => set('firstSameDay', checked)}
              >
                The first payment was taken when I bought it
              </Checkbox>
              {!form.firstSameDay && (
                <div className="max-w-xs">
                  <DatePicker
                    id="plan-first"
                    label="First payment"
                    minValue={form.purchaseDate}
                    value={form.firstDueDate}
                    onChange={(date) => set('firstDueDate', date)}
                  />
                </div>
              )}
            </div>
          )}
          {preview.length > 0 && (
            <p className="text-sm text-text-tertiary">
              {linked.length ? `Then ${preview.length} more: ` : ''}
              {preview.length === 1
                ? formatCurrency(preview[0])
                : preview[0] === preview[preview.length - 1]
                  ? `${preview.length} × ${formatCurrency(preview[0])}`
                  : `${formatCurrency(preview[0])}, then ${preview.length - 1} × ${formatCurrency(preview[1])}`}{' '}
              {FREQUENCY_LABELS[form.frequency].toLowerCase()}. If {PROVIDER_NAMES[provider]}&apos;s
              amounts differ, change them on the plan.
            </p>
          )}
          {plans.length === 0 && (
            <p className="text-sm text-caution">
              Set up a {PROVIDER_NAMES[provider]} account first.
            </p>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <SavingPausedHint className="text-right" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || !canSave || create.isPending}>
              {earlier ? 'Record purchase' : 'Add purchase'}
            </Button>
          </div>
        </form>
      </AmountFields>
    </Modal>
  );
}
