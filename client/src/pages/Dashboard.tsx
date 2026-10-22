import { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { LayoutGrid } from 'lucide-react';
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
import { HOME_CARDS, normalizeLayout, visibleCards, type HomeCardId } from '../utils/homeCards';

const now = new Date();
const currentMonth = format(now, 'yyyy-MM');
const sixMonthsAgo = format(subMonths(now, 5), 'yyyy-MM');

/** The optional review reminder (phase 7E); renders nothing unless one is due. */
function Reminder() {
  const resume = useQuery({ queryKey: ['review', 'resume'], queryFn: getResume });
  return resume.data ? <ReminderBanner resume={resume.data} /> : null;
}

function HomeCard({ id }: { id: HomeCardId }) {
  switch (id) {
    case 'net-worth':
      return <NetWorthMini />;
    case 'summary':
      return <SummaryStats currentMonth={currentMonth} sixMonthsAgo={sixMonthsAgo} />;
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
  const layout = normalizeLayout(saved, factor);
  const cards = visibleCards(layout);
  const [customizing, setCustomizing] = useState(false);

  return (
    <div className="p-6 max-md:p-4 max-w-[1400px] mx-auto">
      {/* Not cards: they keep their own show/hide rules */}
      <div className="mb-5 empty:hidden">
        <Reminder />
      </div>
      <div className="mb-6 empty:hidden">
        <GettingStarted currentMonth={currentMonth} />
      </div>

      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
          <LayoutGrid size={13} /> Customize
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          compact
          icon={<LayoutGrid size={20} />}
          title="All cards are hidden"
          description="Your home page is empty on this device. Nothing in your budget changed."
          actions={
            <Button variant="secondary" size="sm" onClick={() => setHomeLayout(factor, null)}>
              Show the default cards
            </Button>
          }
        />
      ) : (
        // Rows take their tallest card's height, so side-by-side cards line up
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {cards.map((id) => (
            <section
              key={id}
              data-testid={`home-card-${id}`}
              className={`min-w-0 [&>*]:h-full ${isWide(id) ? 'lg:col-span-2' : ''}`}
            >
              <HomeCard id={id} />
            </section>
          ))}
        </div>
      )}

      <HelpFooter className="mt-4" />
      <CustomizeHome
        isOpen={customizing}
        onClose={() => setCustomizing(false)}
        factor={factor}
        layout={layout}
        onChange={(next) => setHomeLayout(factor, next)}
        onReset={() => setHomeLayout(factor, null)}
      />
    </div>
  );
}
