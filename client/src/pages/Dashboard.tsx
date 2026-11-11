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
import { Button } from '../components/ui/Button';
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

const now = new Date();
const currentMonth = format(now, 'yyyy-MM');
const sixMonthsAgo = format(subMonths(now, 5), 'yyyy-MM');

/** The optional review reminder (phase 7E); renders nothing unless one is due. */
function Reminder() {
  const resume = useQuery({ queryKey: ['review', 'resume'], queryFn: getResume });
  return resume.data ? <ReminderBanner resume={resume.data} /> : null;
}

/** Use the same ordered next steps and destinations as Review and its sidebar count. */
function ReviewAttention() {
  const steps = useNextSteps();
  const first = steps[0];
  if (!first) return null;
  return (
    <section
      aria-label="Review attention"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
    >
      <div className="flex items-start gap-3 min-w-0">
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
          <Link
            to="/review"
            className="inline-flex items-center min-h-11 text-xs text-text-secondary underline underline-offset-4 hover:text-text"
          >
            {`${steps.length} ${steps.length === 1 ? 'next step' : 'next steps'} for your budget`}
          </Link>
        </div>
      </div>
      <Link
        to="/review"
        className="hidden md:inline-flex items-center min-h-11 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Open review
      </Link>
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
          // Each card keeps its own height, so a short card doesn't stretch beside a tall one
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-md:gap-4 items-start">
            {cards.map((id) => (
              <Fragment key={id}>
                <section
                  data-testid={`home-card-${id}`}
                  className={`min-w-0 ${isWide(id) ? 'lg:col-span-2' : ''}`}
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
