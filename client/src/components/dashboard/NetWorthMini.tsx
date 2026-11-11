import { Select } from '../ui/Input';
import { DataFeedback, dataUnavailable } from './DataFeedback';
import { useState, useMemo } from 'react';
import { format, subMonths, subDays, startOfYear } from 'date-fns';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import type { ChartPoint } from '@tanstack/charts';
import { decorative } from '@tanstack/charts/mark/decorative';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import type { ChartTooltipContent } from '@tanstack/charts/tooltip';
import { useNetWorth } from '../../hooks/useReports';
import { useAccounts } from '../../hooks/useAccounts';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatCurrency } from '../../utils/currency';
import { chartColors } from '../../utils/chartColors';
import { formatDateAxisLabels, formatDateLabel } from '../../utils/chartTicks';
import { FillChart } from '../charts/FillChart';
import { areaGradient, pointScale, smooth } from '../charts/kit';
import { useHideBalances } from '../../utils/safeMode';
import { Private, PrivateChart } from '../ui/Private';
import { TrendingUp } from 'lucide-react';
import { useOnboardingActive } from './onboarding';

type Preset = '1m' | '3m' | '6m' | 'ytd' | '1y' | 'all';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
];

function computeRange(preset: Preset): {
  from: string;
  to: string;
  granularity: 'daily' | 'monthly';
} {
  const now = new Date();
  switch (preset) {
    case '1m':
      return {
        from: format(subDays(now, 30), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
        granularity: 'daily',
      };
    case '3m':
      return {
        from: format(subMonths(now, 3), 'yyyy-MM-dd'),
        to: format(now, 'yyyy-MM-dd'),
        granularity: 'daily',
      };
    case '6m':
      return {
        from: format(subMonths(now, 5), 'yyyy-MM'),
        to: format(now, 'yyyy-MM'),
        granularity: 'monthly',
      };
    case 'ytd':
      return {
        from: format(startOfYear(now), 'yyyy-MM'),
        to: format(now, 'yyyy-MM'),
        granularity: 'monthly',
      };
    case '1y':
      return {
        from: format(subMonths(now, 11), 'yyyy-MM'),
        to: format(now, 'yyyy-MM'),
        granularity: 'monthly',
      };
    case 'all':
      return { from: '2000-01', to: format(now, 'yyyy-MM'), granularity: 'monthly' };
  }
}

export default function NetWorthMini() {
  const [preset, setPreset] = useState<Preset>('1m');

  const { from, to, granularity } = useMemo(() => computeRange(preset), [preset]);
  const netWorthQuery = useNetWorth(from, to, granularity);
  const { data = [] } = netWorthQuery;
  const accountsQuery = useAccounts();
  const { data: accounts } = accountsQuery;
  const noAccounts = !accountsQuery.isLoading && accounts?.length === 0;
  const onboarding = useOnboardingActive();

  const dateLabels = useMemo(() => formatDateAxisLabels(data.map((d) => d.month)), [data]);
  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 100];
    const values = data.map((d) => d.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.05 : Math.abs(max) * 0.01 || 100;
    return [min - pad, max + pad];
  }, [data]);

  const latest = data.length > 0 ? data[data.length - 1].netWorth : 0;
  const first = data.length > 0 ? data[0].netWorth : latest;
  const change = latest - first;
  const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
  const hide = useHideBalances();

  const labels = useMemo(
    () => new Map(data.map((d, i) => [d.month, dateLabels[i]] as [string, string])),
    [data, dateLabels],
  );
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          decorative(
            areaY(data, {
              x: 'month',
              y1: yDomain[0],
              y2: 'netWorth',
              fill: 'url(#gNetMini)',
              fillOpacity: 1,
              curve: smooth,
            }),
          ),
          lineY(data, {
            x: 'month',
            y: 'netWorth',
            z: () => 'Net worth',
            stroke: chartColors.brand,
            strokeWidth: 2,
            curve: smooth,
          }),
        ],
        scales: {
          x: pointScale((k) => labels.get(k) ?? k, 28),
          y: { scale: scaleLinear().domain(yDomain), axis: false },
        },
        gradients: [areaGradient('gNetMini', chartColors.brand, 0.2)],
        focus: 'nearest-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          content: (points: readonly ChartPoint[]): ChartTooltipContent => {
            const d = points[0]?.datum as (typeof data)[number] | undefined;
            return d
              ? {
                  title: formatDateLabel(d.month),
                  rows: [
                    {
                      label: 'Net worth',
                      value: formatCurrency(d.netWorth),
                      color: chartColors.brand,
                    },
                  ],
                }
              : { rows: [] };
          },
        },
      }),
    [data, yDomain, labels],
  );

  const sources = [netWorthQuery, accountsQuery];
  if (dataUnavailable(sources)) return <DataFeedback title="Net worth" sources={sources} />;

  if (sources.some((q) => q.isLoading)) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse" />
          <div className="h-8 w-28 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="h-28 bg-surface-alt rounded animate-pulse mt-4" />
      </Card>
    );
  }

  return (
    <Card>
      <DataFeedback title="Net worth" sources={sources} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-text-secondary">Net worth</p>
          <p
            className={`text-4xl max-md:text-3xl font-semibold tracking-tight tabular-nums mt-2 break-words ${latest >= 0 || hide ? 'text-text' : 'text-negative'}`}
          >
            <Private>{formatCurrency(latest)}</Private>
          </p>
          {noAccounts && (
            <p className="text-sm text-text-tertiary mt-1">
              What you own minus what you owe, across all your accounts.
            </p>
          )}
          {/* The change and its percentage would give the total away */}
          {data.length > 1 && !noAccounts && !hide && (
            <p
              className={`text-sm tabular-nums mt-0.5 ${change >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {change >= 0 ? '+' : ''}
              {formatCurrency(change)} ({Math.abs(pct).toFixed(1)}%)
            </p>
          )}
        </div>

        {noAccounts ? (
          !onboarding && (
            <ButtonLink size="sm" to="/accounts?add=1">
              Add an account
            </ButtonLink>
          )
        ) : (
          <Select
            compact
            aria-label="Net worth period"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-auto"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Before any accounts there's nothing to draw: no flat $0 line */}
      {noAccounts && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-tertiary">
          <TrendingUp size={18} className="text-brand-600 shrink-0" aria-hidden />
          Your net worth over time appears here once an account is in.
        </div>
      )}
      {data.length > 1 && !noAccounts && (
        <div className="mt-4">
          <PrivateChart height={112}>
            <FillChart definition={definition} height={112} ariaLabel="Net worth over time" />
          </PrivateChart>
        </div>
      )}
    </Card>
  );
}
