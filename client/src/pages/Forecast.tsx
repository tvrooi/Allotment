import { useSearchParams } from 'react-router-dom';
import { CashRunway } from '../components/forecast/CashRunway';
import { LongTermForecast } from '../components/longterm/LongTermForecast';

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
      <div className="px-6 pt-4 max-md:px-4 border-b border-border shrink-0">
        <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
          Forecast
        </h1>
        <div
          className="flex gap-1 mt-3 -mb-px overflow-x-auto"
          role="tablist"
          aria-label="Forecast view"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
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
        </div>
      </div>
      {tab === 'cash' ? <CashRunway /> : <LongTermForecast />}
    </div>
  );
}
