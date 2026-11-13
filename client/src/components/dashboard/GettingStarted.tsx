import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Compass, X } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudget } from '../../hooks/useBudget';
import { useSchedules } from '../../hooks/useSchedules';
import { useRules } from '../../hooks/useRules';
import { useSalaryGuess } from '../../hooks/useReports';
import { Modal } from '../ui/Modal';
import { SortUncategorised, salaryCadence } from '../review/SortUncategorised';
import { usePreferencesStore } from '../../store/preferencesStore';
import { AddAccountModal } from '../accounts/AddAccountModal';
import { GuideLink } from '../guide/GuideLink';
import { Card } from '../ui/Card';
import { UpConnectModal } from '../up/UpConnectModal';
import { useGuideProgress, useUpdateGuides } from '../../hooks/useGuides';
import { useGuideStore } from '../../store/guideStore';
import { CONNECTED_BANKS_LINK } from '../../utils/movedSections';

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  action: { label: string; to?: string; onClick?: () => void };
  /** A second, quieter way to do it */
  alternative?: { label: string; onClick: () => void };
}

/**
 * The first things to do in a new budget, ticked off as they're done. Shown on the
 * dashboard until every step is done or the user hides it.
 */
export default function GettingStarted({
  currentMonth,
  onVisibleChange,
}: {
  currentMonth: string;
  /** Whether the checklist is showing, so the dashboard's cards can leave the next steps to it */
  onVisibleChange?: (visible: boolean) => void;
}) {
  const hidden = usePreferencesStore((s) => s.gettingStartedHidden);
  const setHiddenPreference = usePreferencesStore((s) => s.setGettingStartedHidden);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [upOpen, setUpOpen] = useState(false);
  const guideProgress = useGuideProgress().data;
  const updateGuides = useUpdateGuides();
  const startGuide = useGuideStore((s) => s.start);
  const offerTour = guideProgress?.welcomeTour === 'offer';
  // Hiding the checklist turns down the tour it offered: the page guides and tips that wait
  // for it can start
  const setHidden = (value: boolean) => {
    setHiddenPreference(value);
    if (value && offerTour) updateGuides.mutate({ welcomeTour: 'dismissed' });
  };
  const [sortOpen, setSortOpen] = useState(false);

  const accounts = useAccounts();
  const transactions = useTransactions({ limit: 1 });
  const budget = useBudget(currentMonth);
  const schedules = useSchedules();
  const rules = useRules();
  const salary = useSalaryGuess().data;

  const loading = [accounts, transactions, budget, schedules, rules].some((q) => q.isLoading);

  const firstAccount = accounts.data?.find((a) => !a.closedAt);
  const steps: Step[] = [
    {
      id: 'account',
      title: 'Bring in your accounts',
      description:
        'Connect Up for your Spending account, Savers and 2Up, or add any account by hand.',
      done: (accounts.data?.length ?? 0) > 0,
      action: { label: 'Connect Up', onClick: () => setUpOpen(true) },
      alternative: { label: 'Add account', onClick: () => setAddAccountOpen(true) },
    },
    {
      id: 'transactions',
      title: 'Bring in your transactions',
      description:
        'Up brings them in by itself. Otherwise import a CSV file from your bank, or add them by hand.',
      done: (transactions.data?.length ?? 0) > 0,
      action: firstAccount
        ? { label: 'Import or add', to: `/accounts/${firstAccount.id}` }
        : { label: 'Connect a bank', to: CONNECTED_BANKS_LINK },
    },
    // Only while there is pay in the register that is not yet income
    ...(salary?.categoryId && salary.uncategorisedCount
      ? [
          {
            id: 'pay',
            title: 'Mark your pay as income',
            description: `Looks like pay from ${salary.payeeName} ${salaryCadence(salary)}. One tap puts it in ${salary.categoryName}.`,
            done: false,
            action: { label: 'Review', onClick: () => setSortOpen(true) },
          } satisfies Step,
        ]
      : []),
    {
      id: 'recurring',
      title: 'Add your bills and pay',
      description: 'See what’s due next and never miss a payment.',
      done: (schedules.data?.length ?? 0) > 0,
      action: { label: 'Add recurring', to: '/recurring' },
    },
    {
      id: 'budget',
      title: 'Plan this month’s budget',
      description: 'With your pay and bills in, give the rest of your money a job.',
      done: (budget.data ?? []).some((g) => g.categories.some((c) => c.budgeted !== 0)),
      action: { label: 'Open budget', to: '/budget' },
    },
    {
      id: 'rules',
      title: 'Categorise automatically',
      description: 'Rules sort new transactions for you, by payee, amount and more.',
      done: (rules.data?.length ?? 0) > 0,
      action: { label: 'Create a rule', to: '/rules' },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const visible = !hidden && !loading && doneCount < steps.length;
  useEffect(() => onVisibleChange?.(visible), [visible, onVisibleChange]);
  // Every step done before the tour was taken: it isn't offered any more, so the page guides
  // and tips that wait for it can start
  const allDone = !loading && doneCount === steps.length;
  useEffect(() => {
    if (allDone && offerTour) updateGuides.mutate({ welcomeTour: 'dismissed' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, offerTour]);
  if (!visible) return null;
  const nextStep = steps.find((s) => !s.done);

  // Tour first (audit decision I-7): until the welcome tour is taken or skipped, it is the one
  // thing a new budget is offered. The steps come after it.
  if (offerTour) {
    return (
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4">
          <Compass size={20} className="text-brand-600 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text">Get started with Allotment</h2>
            <p className="text-sm text-text-tertiary mt-0.5">
              Start with a two-minute tour of where everything is. Your first steps come next.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => startGuide('welcome')}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-brand-600 text-brand-contrast hover:bg-brand-700 max-md:min-h-11"
              >
                Show me around
                <span className="font-normal opacity-80 max-md:hidden">· 2 min</span>
              </button>
              <button
                type="button"
                onClick={() => updateGuides.mutate({ welcomeTour: 'dismissed' })}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text hover:bg-hover max-md:min-h-11"
              >
                Skip the tour
              </button>
            </div>
          </div>
          <button
            onClick={() => setHidden(true)}
            aria-label="Hide getting started"
            title="Hide getting started"
            className="p-1.5 -mr-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:bg-hover hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-base font-semibold text-text">Get started with Allotment</h2>
          <p className="text-sm text-text-tertiary mt-0.5">
            {doneCount} of {steps.length} done. Each step brings more of your dashboard to life.
          </p>
        </div>
        <button
          onClick={() => setHidden(true)}
          aria-label="Hide getting started"
          title="Hide getting started"
          className="p-1.5 -mr-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:bg-hover hover:text-text"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="mx-5 mt-3 h-1.5 rounded-full bg-surface-alt overflow-hidden"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-full bg-brand-600 rounded-full transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-3 divide-y divide-border-light">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-3 px-5 py-3 ${isNext ? 'bg-brand-50' : ''}`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step.done
                    ? 'bg-positive text-semantic-contrast'
                    : isNext
                      ? 'bg-brand-600 text-brand-contrast'
                      : 'bg-surface-alt text-text-tertiary'
                }`}
              >
                {step.done ? <Check size={14} aria-label="Done" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? 'text-text-tertiary line-through' : 'text-text'}`}
                >
                  {step.title}
                </p>
                {!step.done && (
                  <p className="text-xs text-text-tertiary mt-0.5">{step.description}</p>
                )}
              </div>
              {!step.done && step.alternative && (
                <button
                  type="button"
                  onClick={step.alternative.onClick}
                  className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary hover:text-text hover:bg-hover max-md:min-h-11"
                >
                  {step.alternative.label}
                </button>
              )}
              {!step.done && <StepAction step={step} primary={isNext} />}
            </li>
          );
        })}
      </ol>

      <div className="px-5 py-3 border-t border-border-light text-xs text-text-tertiary">
        Not sure where to begin?{' '}
        <GuideLink
          page="getting-started"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Read the getting started guide
        </GuideLink>
      </div>

      <AddAccountModal isOpen={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      <UpConnectModal isOpen={upOpen} onClose={() => setUpOpen(false)} />
      {sortOpen && (
        <Modal
          isOpen
          onClose={() => setSortOpen(false)}
          title="Sort your imported transactions"
          size="lg"
        >
          <SortUncategorised onDone={() => setSortOpen(false)} />
        </Modal>
      )}
    </Card>
  );
}

function StepAction({ step, primary }: { step: Step; primary: boolean }) {
  const className = `shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-md:min-h-11 ${
    primary
      ? 'bg-brand-600 text-brand-contrast hover:bg-brand-700'
      : 'text-brand-600 hover:bg-brand-50'
  }`;
  const content = (
    <>
      {step.action.label} <ChevronRight size={13} aria-hidden />
    </>
  );
  if (step.action.to) {
    return (
      <Link to={step.action.to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={step.action.onClick} className={className}>
      {content}
    </button>
  );
}
