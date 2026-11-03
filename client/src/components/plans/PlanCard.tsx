import { useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Private } from '../ui/Private';
import { CategorySelect } from '../transactions/CategorySelect';
import { useCategories } from '../../hooks/useCategories';
import { useCanSave } from '../../hooks/useConnection';
import {
  useDeletePlan,
  usePlanAdjustment,
  useUnlinkPayment,
  useUpdatePlan,
} from '../../hooks/usePaymentPlans';
import { formatCurrency } from '../../utils/currency';
import { formatShortDay } from '../../utils/dates';
import type { PaymentPlan } from '../../api/paymentPlans';
import { FREQUENCY_LABELS, purchaseGroups } from './planHelpers';

const STATUS: Record<PaymentPlan['instalments'][number]['status'], string> = {
  paid: 'Paid',
  settled: 'Refunded',
  due: 'Due',
  overdue: 'Overdue',
};

/** One plan: what was bought, how much is left, each payment, and what you can do about it */
export function PlanCard({ plan }: { plan: PaymentPlan }) {
  const [open, setOpen] = useState(plan.status === 'active');
  const [adjust, setAdjust] = useState<'refund' | 'fee' | null>(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlink = useUnlinkPayment();
  const remove = useDeletePlan();
  const canSave = useCanSave();
  const onError = (err: unknown) => setError(err instanceof Error ? err.message : 'Could not save');
  const paidShare = plan.instalmentCount ? plan.paidCount / plan.instalments.length : 0;

  return (
    <div className="rounded-lg border border-border bg-surface" data-testid="payment-plan">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-text">{plan.merchant}</span>
            <span className="text-sm text-text-tertiary">
              {plan.purchase?.split
                ? 'Split'
                : (plan.purchase?.categoryName ?? 'Not categorised yet')}{' '}
              · {formatCurrency(plan.total)}
            </span>
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {plan.status === 'paid'
              ? `Paid off · ${plan.instalmentCount} payments`
              : `${plan.paidCount} of ${plan.instalments.length} paid${
                  plan.nextDue
                    ? ` · next ${formatCurrency(plan.nextDue.amount)} ${formatShortDay(plan.nextDue.date)}`
                    : ''
                }`}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface-alt overflow-hidden" aria-hidden>
            <div
              className="h-full bg-brand-600"
              style={{ width: `${Math.round(paidShare * 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-text">
            <Private>{formatCurrency(plan.remaining)}</Private>
          </div>
          <div className="text-xs text-text-tertiary">to pay</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border-light px-4 py-3 space-y-3">
          <p className="text-xs text-text-tertiary">
            {plan.accountName} · {FREQUENCY_LABELS[plan.frequency]} from{' '}
            {plan.fundingAccountName ?? 'a closed account'}
            {plan.purchase && (
              <>
                {' · '}
                <Link className="underline" to={`/accounts/${plan.accountId}`}>
                  Bought {formatShortDay(plan.purchase.date)}
                </Link>
              </>
            )}
          </p>
          {plan.purchaseChanged && (
            <p className="text-xs text-caution">
              The purchase was changed in the register; the payments still add up to the plan.
            </p>
          )}
          {editing ? (
            <EditInstalments plan={plan} onDone={() => setEditing(false)} onError={onError} />
          ) : (
            <ul className="divide-y divide-border-light text-sm">
              {plan.instalments.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-14 text-text-tertiary">
                    {i.seq} of {plan.instalments.length}
                  </span>
                  <span className="flex-1 text-text-secondary">
                    {formatShortDay(i.paidAt ?? i.dueDate)}
                  </span>
                  <span
                    className={`text-xs ${
                      i.status === 'paid'
                        ? 'text-positive'
                        : i.status === 'overdue'
                          ? 'text-negative'
                          : 'text-text-tertiary'
                    }`}
                  >
                    {i.status === 'paid' && <Check size={12} className="inline mr-0.5" />}
                    {STATUS[i.status]}
                  </span>
                  <span className="w-24 text-right">{formatCurrency(i.amount)}</span>
                  {i.status === 'paid' ? (
                    <button
                      type="button"
                      title="Not a payment for this plan"
                      aria-label={`Unlink payment ${i.seq}`}
                      disabled={!canSave}
                      onClick={() =>
                        unlink.mutate({ planId: plan.id, instalmentId: i.id }, { onError })
                      }
                      className="p-1 rounded text-text-tertiary hover:text-text cursor-pointer"
                    >
                      <Undo2 size={14} />
                    </button>
                  ) : (
                    <span className="w-6" />
                  )}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          {!editing && (
            <div className="flex flex-wrap gap-2">
              {plan.status === 'active' && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Change payments
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setAdjust('refund')}>
                Refund
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAdjust('fee')}>
                Late fee
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
                Remove plan
              </Button>
            </div>
          )}
        </div>
      )}

      <AdjustModal plan={plan} kind={adjust} onClose={() => setAdjust(null)} />
      <ConfirmModal
        isOpen={removing}
        onClose={() => setRemoving(false)}
        onConfirm={() => remove.mutate(plan.id, { onError })}
        title={`Remove ${plan.merchant}?`}
        message="The purchase, refunds and fees this plan added are deleted. Payments go back to ordinary bank transactions with their old payee and category. Bank transactions are never deleted."
        confirmLabel="Remove plan"
        danger
      />
    </div>
  );
}

function EditInstalments({
  plan,
  onDone,
  onError,
}: {
  plan: PaymentPlan;
  onDone: () => void;
  onError: (err: unknown) => void;
}) {
  const open = plan.instalments.filter((i) => i.status !== 'paid');
  const [rows, setRows] = useState(open.map((i) => ({ ...i })));
  const update = useUpdatePlan();
  const canSave = useCanSave();
  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        Match what {plan.providerName} shows, so each bank payment links.
      </p>
      {rows.map((r, idx) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span className="w-14 text-text-tertiary">
            {r.seq} of {plan.instalments.length}
          </span>
          <div className="w-40">
            <Input
              type="date"
              aria-label={`Payment ${r.seq} date`}
              value={r.dueDate}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((x, j) => (j === idx ? { ...x, dueDate: e.target.value } : x)),
                )
              }
            />
          </div>
          <div className="w-32">
            <CurrencyInput
              aria-label={`Payment ${r.seq} amount`}
              value={r.amount}
              onChange={(amount) =>
                setRows((rs) => rs.map((x, j) => (j === idx ? { ...x, amount } : x)))
              }
            />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!canSave || update.isPending}
          onClick={() =>
            update.mutate(
              {
                id: plan.id,
                instalments: rows.map(({ id, dueDate, amount }) => ({ id, dueDate, amount })),
              },
              { onSuccess: onDone, onError },
            )
          }
        >
          Save payments
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AdjustModal({
  plan,
  kind,
  onClose,
}: {
  plan: PaymentPlan;
  kind: 'refund' | 'fee' | null;
  onClose: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: groups = [] } = useCategories();
  const refund = usePlanAdjustment('refund');
  const fee = usePlanAdjustment('fee');
  const canSave = useCanSave();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (kind !== shownFor) {
    setShownFor(kind);
    if (kind) {
      setDate(today);
      setAmount(0);
      setError(null);
      const fees = groups.flatMap((g) => g.categories).find((c) => c.name === 'Bank Fees');
      setCategoryId(kind === 'refund' ? (plan.purchase?.categoryId ?? null) : (fees?.id ?? null));
    }
  }
  const mutation = kind === 'fee' ? fee : refund;
  return (
    <Modal
      isOpen={kind !== null}
      onClose={onClose}
      title={kind === 'fee' ? `Late fee for ${plan.merchant}` : `Refund from ${plan.merchant}`}
      size="sm"
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!kind || amount <= 0) return;
          mutation.mutate(
            { planId: plan.id, date, amount, categoryId },
            {
              onSuccess: onClose,
              onError: (err) => setError(err instanceof Error ? err.message : 'Could not save'),
            },
          );
        }}
      >
        <p className="text-sm text-text-secondary">
          {kind === 'fee'
            ? `Added to the next payment, as ${plan.providerName} collects it.`
            : 'Takes the last payments down first, as the provider does. Reports count it against what you bought.'}
        </p>
        <CurrencyInput value={amount} onChange={setAmount} aria-label="Amount" />
        <Input
          type="date"
          aria-label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="rounded-md border border-border px-3 py-2.5 bg-surface">
          <CategorySelect
            value={categoryId}
            onChange={setCategoryId}
            groups={purchaseGroups(groups)}
          />
        </div>
        {error && <p className="text-sm text-negative">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={amount <= 0 || !canSave || mutation.isPending}>
            {kind === 'fee' ? 'Add fee' : 'Record refund'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
