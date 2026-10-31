import { useState } from 'react';
import { CalendarClock, History, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Private } from '../components/ui/Private';
import { NewPlanModal } from '../components/plans/NewPlanModal';
import { EarlierPaymentsModal } from '../components/plans/EarlierPaymentsModal';
import { PaymentMatches } from '../components/plans/PaymentMatches';
import { PlanCard } from '../components/plans/PlanCard';
import { planAccounts } from '../components/plans/planHelpers';
import { useAccounts } from '../hooks/useAccounts';
import { useCanSave } from '../hooks/useConnection';
import { useCreatePlanAccount, usePaymentPlans } from '../hooks/usePaymentPlans';
import { formatCurrency } from '../utils/currency';
import type { HistoryGroup, PlanProvider } from '../api/paymentPlans';

/**
 * Pay later (docs/PAYMENT-PLANS.md): purchases made with Afterpay and similar, each recorded
 * once in what it was for, with the fortnightly payments linked as they leave the bank.
 */
export default function PaymentPlansPage() {
  const provider: PlanProvider = 'afterpay';
  const { data: plans = [], isLoading } = usePaymentPlans();
  const { data: accounts = [] } = useAccounts();
  const createAccount = useCreatePlanAccount();
  const canSave = useCanSave();
  const [adding, setAdding] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [earlier, setEarlier] = useState<HistoryGroup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasAccount = planAccounts(accounts).length > 0;
  const active = plans.filter((p) => p.status === 'active');
  const paid = plans.filter((p) => p.status === 'paid');
  const owing = active.reduce((s, p) => s + p.remaining, 0);

  function setUp() {
    setNotice(null);
    createAccount.mutate(
      { provider },
      {
        onSuccess: ({ paymentFunding }) =>
          setNotice(
            paymentFunding.ok
              ? 'Your Afterpay account is ready, with an "Afterpay payment" envelope on the Budget page.'
              : `Your Afterpay account is ready. Payment funding wasn't set up: ${paymentFunding.reason} Set it up later in Budget → Card payments.`,
          ),
        onError: (err) => setNotice(err instanceof Error ? err.message : 'Could not set up'),
      },
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-x-4">
        <h1
          data-guide="plans.header"
          className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text py-4"
        >
          Pay later
        </h1>
        {hasAccount && (
          <div className="flex items-center gap-2 py-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEarlierOpen(true)}
              data-guide="plans.earlier"
            >
              <History size={13} /> Earlier payments
            </Button>
            <Button size="sm" onClick={() => setAdding(true)} data-guide="plans.add">
              <Plus size={13} /> Add a purchase
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-4">
          {notice && <p className="text-sm text-text-secondary">{notice}</p>}
          {!isLoading && !hasAccount && (
            <EmptyState
              icon={<CalendarClock size={24} />}
              title="Track Afterpay purchases as what you bought"
              description="Record a drill as Home improvement, not as four Afterpay payments. Allotment adds an Afterpay account; each fortnightly payment from your bank is linked to the purchase once you confirm it."
              actions={
                <Button
                  onClick={setUp}
                  disabled={!canSave || createAccount.isPending}
                  data-guide="plans.setup"
                >
                  Set up Afterpay
                </Button>
              }
            />
          )}
          {hasAccount && <PaymentMatches />}
          {hasAccount && active.length > 0 && (
            <p className="text-sm text-text-secondary">
              Still to pay:{' '}
              <span className="font-medium text-text">
                <Private>{formatCurrency(owing)}</Private>
              </span>{' '}
              across {active.length} purchase{active.length === 1 ? '' : 's'}
            </p>
          )}
          {hasAccount && !isLoading && plans.length === 0 && (
            <EmptyState
              compact
              icon={<CalendarClock size={20} />}
              title="No purchases yet"
              description="Add one you just made, or record earlier ones from your bank's Afterpay payments."
              actions={
                <>
                  <Button size="sm" onClick={() => setAdding(true)}>
                    Add a purchase
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEarlierOpen(true)}>
                    Earlier payments
                  </Button>
                </>
              }
            />
          )}
          <div className="space-y-2">
            {active.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
          {paid.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-text-tertiary pt-2">Paid off</h2>
              {paid.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      <NewPlanModal isOpen={adding} onClose={() => setAdding(false)} provider={provider} />
      <NewPlanModal
        isOpen={earlier !== null}
        onClose={() => setEarlier(null)}
        provider={provider}
        earlier={earlier}
      />
      <EarlierPaymentsModal
        isOpen={earlierOpen && earlier === null}
        onClose={() => setEarlierOpen(false)}
        provider={provider}
        onRecord={setEarlier}
      />
    </div>
  );
}
