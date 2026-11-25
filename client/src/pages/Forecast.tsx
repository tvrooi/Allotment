import { useSearchParams } from 'react-router-dom';
import { CashRunway } from '../components/forecast/CashRunway';
import { GuideLink } from '../components/guide/GuideLink';
import { LongTermForecast } from '../components/longterm/LongTermForecast';
import { tabIds, TabList } from '../components/ui/tabList';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

// The Forecast page: the long-term, decades-long view first, with the cash runway (the next
// 30 days to two years) as its second tab. Neither writes to the budget.
const TABS = [
  { id: 'long-term', label: 'Long term' },
  { id: 'cash', label: 'Cash runway' },
] as const;

export default function ForecastPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'cash' ? 'cash' : 'long-term';
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`pt-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            Forecast
          </h1>
          {tab === 'long-term' && (
            <GuideLink
              page="long-term-forecast"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 max-md:min-h-11 inline-flex items-center"
            >
              How the long-term forecast works
            </GuideLink>
          )}
        </div>
        <TabList
          label="Forecast view"
          data-guide="forecast.tabs"
          className="scroll-row flex gap-1 mt-3 -mb-px"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabIds('forecast', t.id).tab}
              aria-controls={tabIds('forecast', t.id).panel}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() =>
                setParams(t.id === 'long-term' ? {} : { tab: t.id }, { replace: true })
              }
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 max-md:min-h-11 ${
                tab === t.id
                  ? 'border-brand-600 text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </TabList>
      </div>
      <div
        role="tabpanel"
        id={tabIds('forecast', tab).panel}
        aria-labelledby={tabIds('forecast', tab).tab}
        className="flex flex-col flex-1 min-h-0"
      >
        {tab === 'cash' ? <CashRunway /> : <LongTermForecast />}
      </div>
    </div>
  );
}
