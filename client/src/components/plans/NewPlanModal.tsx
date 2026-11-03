import { useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CategorySelect } from '../transactions/CategorySelect';
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
    form.accountId &&
    form.fundingAccountId &&
    form.merchant.trim() &&
    form.total > 0 &&
    form.instalmentCount >= Math.max(1, linked.length) &&
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
      <form onSubmit={submit} className="space-y-4">
        {earlier && (
          <div className="rounded-md bg-surface-alt px-3 py-2 text-sm text-text-secondary">
            Links {linked.length} payment{linked.length === 1 ? '' : 's'} from {earlier.accountName}
            :{' '}
            {linked.map((t) => `${formatShortDay(t.date)} ${formatCurrency(-t.amount)}`).join(', ')}
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
            <label className={label} htmlFor="plan-category">
              What it was for
            </label>
            <div className="rounded-md border border-border px-3 py-2.5 bg-surface">
              <CategorySelect
                value={form.categoryId}
                onChange={(id) => set('categoryId', id)}
                groups={purchaseGroups(groups)}
                label="What it was for"
              />
            </div>
          </div>
          <div>
            <label className={label}>Price</label>
            <CurrencyInput
              value={form.total}
              onChange={(v) => set('total', v)}
              aria-label="Price"
            />
          </div>
          <div>
            <label className={label} htmlFor="plan-date">
              Bought on
            </label>
            <Input
              id="plan-date"
              type="date"
              value={form.purchaseDate}
              max={today}
              onChange={(e) => set('purchaseDate', e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="plan-count">
              Number of payments
            </label>
            <Input
              id="plan-count"
              type="number"
              min={Math.max(1, linked.length)}
              max={60}
              value={form.instalmentCount}
              onChange={(e) => set('instalmentCount', Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className={label} htmlFor="plan-frequency">
              How often
            </label>
            <Select
              id="plan-frequency"
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value as PlanFrequency)}
            >
              {(Object.keys(FREQUENCY_LABELS) as PlanFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={label} htmlFor="plan-account">
              On account
            </label>
            <Select
              id="plan-account"
              value={form.accountId}
              onChange={(e) => set('accountId', e.target.value)}
            >
              {plans.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={label} htmlFor="plan-funding">
              Payments come from
            </label>
            <Select
              id="plan-funding"
              value={form.fundingAccountId}
              onChange={(e) => set('fundingAccountId', e.target.value)}
              disabled={!!earlier}
            >
              {sources.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!earlier && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.firstSameDay}
                onChange={(e) => set('firstSameDay', e.target.checked)}
              />
              The first payment was taken when I bought it
            </label>
            {!form.firstSameDay && (
              <div className="max-w-xs">
                <label className={label} htmlFor="plan-first">
                  First payment
                </label>
                <Input
                  id="plan-first"
                  type="date"
                  min={form.purchaseDate}
                  value={form.firstDueDate}
                  onChange={(e) => set('firstDueDate', e.target.value)}
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
          <p className="text-sm text-caution">Set up a {PROVIDER_NAMES[provider]} account first.</p>
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
    </Modal>
  );
}
