import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { usePlanHistory } from '../../hooks/usePaymentPlans';
import { formatCurrency } from '../../utils/currency';
import { formatShortDay } from '../../utils/dates';
import { PROVIDER_NAMES, type HistoryGroup, type PlanProvider } from '../../api/paymentPlans';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  provider: PlanProvider;
  onRecord: (group: HistoryGroup) => void;
}

/**
 * "Sort out earlier payments": past bank payments to the provider, grouped into the plans they
 * probably belong to. Record each one as the purchase it paid for; until then they stay as
 * they are. A guess to check: nothing changes until you record a purchase.
 */
export function EarlierPaymentsModal({ isOpen, onClose, provider, onRecord }: Props) {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = usePlanHistory(provider, months, isOpen);
  const name = PROVIDER_NAMES[provider];
  const groups = data?.groups ?? [];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Earlier ${name} payments`} size="lg">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-secondary max-w-md">
            Each group looks like one purchase&apos;s payments. Record what you bought so the
            spending shows in its real category instead of as {name} payments.
          </p>
          <div className="w-40">
            <Select
              aria-label="How far back"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 2 years</option>
            </Select>
          </div>
        </div>
        {isLoading && <p className="text-sm text-text-tertiary">Looking…</p>}
        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-text-tertiary">
            No unrecorded {name} payments in this time. Payments already linked to a plan
            aren&apos;t shown.
          </p>
        )}
        <ul className="divide-y divide-border-light">
          {groups.map((g) => {
            const first = g.transactions[0];
            return (
              <li key={first.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="flex-1 min-w-52">
                  <span className="text-text">
                    {g.transactions.length} payment{g.transactions.length === 1 ? '' : 's'} from{' '}
                    {formatShortDay(first.date)}
                    {g.inProgress ? ', still being paid' : ''}
                  </span>
                  <span className="block text-xs text-text-tertiary">
                    {g.accountName} ·{' '}
                    {g.transactions.map((t) => formatCurrency(-t.amount)).join(' + ')} · about{' '}
                    {formatCurrency(g.suggested.total)} in {g.suggested.instalmentCount}
                  </span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onRecord(g)}>
                  Record purchase
                </Button>
              </li>
            );
          })}
        </ul>
        {!!data?.lockedCount && (
          <p className="text-xs text-text-tertiary">
            {data.lockedCount} reconciled {name} payment{data.lockedCount === 1 ? ' is' : 's are'}{' '}
            locked and left as they are.
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
