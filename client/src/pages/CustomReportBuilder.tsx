import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Download } from 'lucide-react';
import ReportBuilderSidebar from '../components/reports/ReportBuilderSidebar';
import ReportChartArea from '../components/reports/ReportChartArea';
import SaveReportModal from '../components/reports/SaveReportModal';
import SavedReportsList from '../components/reports/SavedReportsList';
import {
  useCustomReportData,
  useSavedReport,
  useCreateSavedReport,
  useUpdateSavedReport,
} from '../hooks/useCustomReports';
import { useDebounce } from '../hooks/useDebounce';
import { downloadCsv } from '../utils/exportCsv';
import { computeDateRange, decodeRangeParam, resolveDateRange } from '../utils/dateRange';
import { Button } from '../components/ui/Button';
import { DiscardPrompt } from '../components/ui/DiscardPrompt';
import type { CustomReportConfig } from '../types';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

const defaultConfig = (): CustomReportConfig => ({
  chartType: 'bar',
  mode: 'total',
  groupBy: 'category',
  balanceType: 'expense',
  dateRange: { preset: '6m', ...computeDateRange('6m') },
  filters: { accountIds: [], categoryIds: [], categoryGroupIds: [] },
});

export default function CustomReportBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // The dashboard this report was started from; a new report is added to it on save
  const [searchParams] = useSearchParams();
  const dashboardPageId = searchParams.get('dashboard') ?? undefined;
  // Opened from a dashboard widget: start with the months that widget shows
  const rangeParam = decodeRangeParam(searchParams.get('range'));
  const [config, setConfig] = useState<CustomReportConfig>(() => ({
    ...defaultConfig(),
    ...(rangeParam && { dateRange: rangeParam }),
  }));
  // The settings as last loaded or saved: anything else is unsaved work (UX audit AU-007)
  const [baseline, setBaseline] = useState(() => JSON.stringify(config));
  const dirty = JSON.stringify(config) !== baseline;
  // Where the person asked to go while the settings were unsaved; the prompt asks first
  const [leaving, setLeaving] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState('');

  const { data: savedReport } = useSavedReport(id);
  const createMutation = useCreateSavedReport();
  const updateMutation = useUpdateSavedReport();

  const savedReportId = savedReport?.id;
  const savedReportUpdatedAt = savedReport?.updatedAt;
  // The widget's range only applies when the report first loads, not after saving changes
  const rangeAppliedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (savedReport) {
      const firstLoad = rangeAppliedFor.current !== savedReport.id;
      rangeAppliedFor.current = savedReport.id;
      // Live ranges were computed when the report was saved; bring them up to today
      const loaded = {
        ...savedReport.config,
        dateRange: (firstLoad && rangeParam) || resolveDateRange(savedReport.config.dateRange),
      };
      setConfig(loaded);
      setBaseline(JSON.stringify(loaded));
      setReportName(savedReport.name);
    }
  }, [savedReportId, savedReportUpdatedAt]);

  const debouncedConfig = useDebounce(config, 300);
  const { data, isLoading } = useCustomReportData(debouncedConfig);

  // The dialog waits for this, closes on success and shows the reason on failure
  async function handleSave(name: string) {
    const saving = JSON.stringify(config);
    if (id && savedReport) {
      await updateMutation.mutateAsync({ id, data: { name, config } });
      setBaseline(saving);
    } else {
      const saved = await createMutation.mutateAsync({ name, config, dashboardPageId });
      setBaseline(saving);
      const back = dashboardPageId ? `?dashboard=${dashboardPageId}` : '';
      navigate(`/reports/custom/${saved.id}${back}`, { replace: true });
    }
  }

  // Closing or reloading the tab with unsaved settings: the browser asks
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const backTo = dashboardPageId ? `/reports?dashboard=${dashboardPageId}` : '/reports';

  function handleExport() {
    if (!data) return;
    const filename = `custom-report-${config.dateRange.from}-${config.dateRange.to}.csv`;
    if (data.mode === 'total') {
      downloadCsv(
        filename,
        data.data.map((d) => ({ name: d.name, amount_cents: d.value })),
      );
    } else {
      downloadCsv(
        filename,
        data.data.map((d) => {
          const row: Record<string, unknown> = { month: d.month };
          for (const g of data.groups) row[g] = d[g] ?? 0;
          return row;
        }),
      );
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className={`py-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-2 ${PAGE_GUTTER}`}
      >
        <div className="flex items-center gap-3">
          <Link
            to={backTo}
            aria-label="Back to reports"
            onClick={(e) => {
              if (!dirty) return;
              e.preventDefault();
              setLeaving(backTo);
            }}
            className="text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            {reportName || 'Custom report'}
          </h1>
          <SavedReportsList activeId={id} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={!data}>
            <Download size={13} /> Export
          </Button>
          <Button size="sm" onClick={() => setSaveOpen(true)}>
            <Save size={13} /> {id ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>

      {leaving && dirty && (
        <DiscardPrompt
          message="Leave without saving this report?"
          onKeep={() => setLeaving(null)}
          onDiscard={() => navigate(leaving)}
          className="mx-6 mt-3 max-md:mx-4"
        />
      )}

      {/* Phones: the chart on top, the options below it, in one scrolling column */}
      <div className="flex max-md:flex-col flex-1 overflow-hidden max-md:overflow-y-auto">
        <ReportBuilderSidebar config={config} onChange={setConfig} />
        <div className="flex-1 max-md:flex-none max-md:order-first p-6 max-md:p-4 overflow-auto bg-page">
          <div className="h-[500px] max-md:h-[360px]" key={id ?? 'new'}>
            <ReportChartArea
              config={config}
              data={data}
              isLoading={isLoading}
              // The settings that produced `data`; a table row's link asks first when unsaved
              linkConfig={debouncedConfig}
              onFollowLink={(to, e) => {
                if (!dirty) return;
                e.preventDefault();
                setLeaving(to);
              }}
            />
          </div>
        </div>
      </div>

      <SaveReportModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
        initialName={reportName}
        isUpdating={!!id}
      />
    </div>
  );
}
