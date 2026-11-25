import { Fragment, useCallback, useEffect, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { ClipboardCheck, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNextSteps } from '../hooks/useNextSteps';
import SummaryStats from '../components/dashboard/SummaryStats';
import GettingStarted from '../components/dashboard/GettingStarted';
import BudgetProgress from '../components/dashboard/BudgetProgress';
import NetWorthMini from '../components/dashboard/NetWorthMini';
import IncomeExpensesMini from '../components/dashboard/IncomeExpensesMini';
import SpendingComparison from '../components/dashboard/SpendingComparison';
import SpendingBreakdown from '../components/dashboard/SpendingBreakdown';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import UpcomingBills from '../components/dashboard/UpcomingBills';
import { CustomizeHome } from '../components/dashboard/CustomizeHome';
import { HelpFooter } from '../components/layout/HelpFooter';
import { Button, ButtonLink } from '../components/ui/Button';
import { Private } from '../components/ui/Private';
import { formatCurrency } from '../utils/currency';
import { EmptyState } from '../components/ui/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { getResume } from '../api/review';
import { ReminderBanner } from '../components/review/Resilience';
import { useIsPhone } from '../hooks/useIsPhone';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  HOME_CARDS,
  normalizeLayout,
  visibleCards,
  type HomeCardId,
  type HomeLayout,
} from '../utils/homeCards';
import { Tip } from '../components/guide/Tip';
import { TIPS } from '../guides';
import { useGuideStore } from '../store/guideStore';
import { OnboardingContext } from '../components/dashboard/onboarding';
import { DashboardStatus } from '../components/dashboard/DashboardStatus';
import { StatusStrip } from '../components/dashboard/StatusStrip';

const now = new Date();
const currentMonth = format(now, 'yyyy-MM');
const sixMonthsAgo = format(subMonths(now, 5), 'yyyy-MM');

/** The optional review reminder (phase 7E); renders nothing unless one is due. */
function Reminder() {
  const resume = useQuery({ queryKey: ['review', 'resume'], queryFn: getResume });
  return resume.data ? <ReminderBanner resume={resume.data} /> : null;
}

/**
 * Use the same ordered next steps and destinations as Review and its sidebar count. The first
 * leads with Open review as the card's one button; the two after it are quiet rows beside it on
 * wider screens, so the card holds the list instead of an empty row.
 */
function ReviewAttention() {
  const steps = useNextSteps();
  const [first, ...rest] = steps;
  if (!first) return null;
  const after = rest.slice(0, 2);
  return (
    <section
      aria-label="Review attention"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <ClipboardCheck size={20} aria-hidden className="mt-3 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">
            <Link
              to={first.to}
              className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
            >
              {first.title}
            </Link>
          </h2>
          <p className="text-xs text-text-secondary">
            {steps.length === 1
              ? 'The one next step for your budget'
              : `1 of ${steps.length} next steps for your budget`}
          </p>
        </div>
      </div>
      {after.length > 0 && (
        <ol
          aria-label="Then"
          start={2}
          className="hidden min-w-0 flex-1 basis-64 md:block divide-y divide-border-light"
        >
          {after.map((step, i) => (
            <li key={step.id}>
              <Link
                to={step.to}
                className="flex min-h-9 items-center gap-2 text-sm text-text-secondary hover:text-text"
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-alt text-2xs font-semibold text-text-tertiary"
                >
                  {i + 2}
                </span>
                <span className="min-w-0 flex-1 truncate">{step.title}</span>
                {step.amount !== undefined && (
                  <span className="tabular-nums">
                    <Private>{formatCurrency(step.amount)}</Private>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
      <ButtonLink
        to={first.id === 'transfers' ? first.to : '/review'}
        className="shrink-0 max-md:w-full"
      >
        {first.id === 'transfers' ? 'Check transfers' : 'Open review'}
      </ButtonLink>
    </section>
  );
}

function HomeCard({ id, phone }: { id: HomeCardId; phone: boolean }) {
  switch (id) {
    case 'net-worth':
      return <NetWorthMini />;
    case 'summary':
      return (
        <SummaryStats
          currentMonth={currentMonth}
          sixMonthsAgo={sixMonthsAgo}
          section={phone ? 'current' : 'all'}
        />
      );
    case 'income-expenses':
      return <IncomeExpensesMini sixMonthsAgo={sixMonthsAgo} currentMonth={currentMonth} />;
    case 'spending-comparison':
      return <SpendingComparison />;
    case 'budget-progress':
      return <BudgetProgress currentMonth={currentMonth} />;
    case 'upcoming-bills':
      return <UpcomingBills />;
    case 'spending-breakdown':
      return <SpendingBreakdown currentMonth={currentMonth} />;
    case 'recent-transactions':
      return <RecentTransactions />;
  }
}

const isWide = (id: HomeCardId) => HOME_CARDS.find((c) => c.id === id)?.wide;

export default function Dashboard() {
  const factor = useIsPhone() ? 'phone' : 'desktop';
  const saved = usePreferencesStore((s) => s.homeLayouts[factor]);
  const setHomeLayout = usePreferencesStore((s) => s.setHomeLayout);
  const changeLayout = (next: HomeLayout | null) => setHomeLayout(factor, next);
  const layout = normalizeLayout(saved, factor);
  const cards = visibleCards(layout);
  const historyAfter = cards.includes('budget-progress')
    ? 'budget-progress'
    : cards.includes('upcoming-bills')
      ? 'upcoming-bills'
      : 'summary';
  const [customizing, setCustomizing] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  // While the Get started card shows, it is this page's one onboarding element: the guide
  // banner above the page and the tip stay out of its way (audit decision I-7)
  const setChecklistShown = useGuideStore((s) => s.setChecklistShown);
  const onChecklistChange = useCallback(
    (visible: boolean) => {
      setOnboarding(visible);
      setChecklistShown(visible);
    },
    [setChecklistShown],
  );
  useEffect(() => () => setChecklistShown(false), [setChecklistShown]);

  return (
    <OnboardingContext.Provider value={onboarding}>
      {/* One gap between every block, the same as between cards. A block with nothing to show is
          hidden (empty:hidden), and a hidden block takes no gap. */}
      <div className="p-8 max-md:p-4 max-w-[1400px] mx-auto flex flex-col gap-6 max-md:gap-4">
        <div className="flex items-start justify-between gap-3 md:items-center md:gap-4">
          <DashboardStatus currentMonth={currentMonth} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCustomizing(true)}
            data-guide="dashboard.customize"
            className="shrink-0 max-md:w-11 max-md:px-0"
          >
            <LayoutGrid size={15} aria-hidden /> <span className="max-md:sr-only">Customise</span>
          </Button>
        </div>
        {/* Not cards: they keep their own show/hide rules */}
        <StatusStrip />
        <div className="empty:hidden">
          <Reminder />
        </div>
        <div className="empty:hidden">
          <GettingStarted currentMonth={currentMonth} onVisibleChange={onChecklistChange} />
        </div>

        {!onboarding && <ReviewAttention />}

        {cards.length === 0 ? (
          <EmptyState
            compact
            icon={<LayoutGrid size={20} />}
            keepActions
            title="All cards are hidden"
            description="Your home page is empty on this device. Nothing in your budget changed."
            actions={
              <Button variant="secondary" size="sm" onClick={() => changeLayout(null)}>
                Show the default cards
              </Button>
            }
          />
        ) : (
          // Cards side by side share a height, so a row ends in one line (Budget beside Bills)
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-md:gap-4">
            {cards.map((id) => (
              <Fragment key={id}>
                <section
                  data-testid={`home-card-${id}`}
                  className={`min-w-0 *:h-full ${isWide(id) ? 'lg:col-span-2' : ''}`}
                >
                  <HomeCard id={id} phone={factor === 'phone'} />
                </section>
                {factor === 'phone' && cards.includes('summary') && id === historyAfter && (
                  <section data-testid="home-history" className="min-w-0">
                    <SummaryStats
                      currentMonth={currentMonth}
                      sixMonthsAgo={sixMonthsAgo}
                      section="history"
                    />
                  </section>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {!onboarding && (
          <div className="empty:hidden">
            <Tip
              tip={TIPS.safeModeKey}
              desktopOnly
              className="rounded-lg border border-border-light p-4"
            />
          </div>
        )}

        {/* Not part of the cards: further from them than they are from each other */}
        <HelpFooter className="mt-4" />
        <CustomizeHome
          isOpen={customizing}
          onClose={() => setCustomizing(false)}
          factor={factor}
          layout={layout}
          onChange={changeLayout}
          onReset={() => changeLayout(null)}
        />
      </div>
    </OnboardingContext.Provider>
  );
}
