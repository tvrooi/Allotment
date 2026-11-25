import { useState } from 'react';
import { GuideLink } from '../components/guide/GuideLink';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, LayoutGrid, Plus } from 'lucide-react';
import { MissingRatesBanner } from '../components/currency/MissingRatesBanner';
import { UncategorisedBanner } from '../components/review/UncategorisedBanner';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useModalValue } from '../components/ui/Modal';
import RowMenu from '../components/ui/RowMenu';
import AddWidgetMenu from '../components/reports/dashboard/AddWidgetMenu';
import DashboardGrid from '../components/reports/dashboard/DashboardGrid';
import NameModal from '../components/reports/dashboard/NameModal';
import { ChartSkeleton } from '../components/reports/ChartHelpers';
import { DateRangeControl } from '../components/reports/DateRangeControl';
import {
  useCreateDashboard,
  useDashboards,
  useDashboardWidgets,
  useDeleteDashboard,
  useUpdateDashboard,
} from '../hooks/useDashboards';
import { useSavedReports } from '../hooks/useCustomReports';
import { dashboardDateRange, dayBounds, encodeRangeParam } from '../utils/dateRange';
import { ScrollCue } from '../components/ui/ScrollCue';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

type DashboardModal = 'new' | 'rename' | 'delete' | null;

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pages = [], isLoading: pagesLoading } = useDashboards();
  const { data: reports = [] } = useSavedReports();
  const createDashboard = useCreateDashboard();
  const updateDashboard = useUpdateDashboard();
  const deleteDashboard = useDeleteDashboard();
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<DashboardModal>(null);

  // The open dashboard lives in the URL so the report builder can link back to it
  const active = pages.find((p) => p.id === searchParams.get('dashboard')) ?? pages[0];
  const { data: widgets = [], isLoading: widgetsLoading } = useDashboardWidgets(active?.id);
  const dashboardRange = dashboardDateRange(active);
  const newModal = useModalValue(modal === 'new');
  const renameModal = useModalValue(modal === 'rename' && active);
  // Widgets with their own range (live or frozen) ignore the dashboard's picker
  const ownRangeCount = widgets.filter((w) => w.meta.dateRange).length;

  function select(id: string) {
    setSearchParams({ dashboard: id }, { replace: true });
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`pt-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-4">
            <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text shrink-0">
              Reports
            </h1>
            <GuideLink
              page="reports"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 max-md:min-h-11 inline-flex items-center"
            >
              How reports work
            </GuideLink>
          </div>
          {active && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Layout editing is desktop-only; phones get a single stacked column */}
              <div className="hidden md:block">
                <Button
                  variant={editing ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? <Check size={13} /> : <LayoutGrid size={13} />}
                  {editing ? 'Done' : 'Edit layout'}
                </Button>
              </div>
              <AddWidgetMenu pageId={active.id} reports={reports} />
              <Link
                to={`/reports/custom?dashboard=${active.id}&range=${encodeRangeParam(dashboardRange)}`}
                data-guide="reports.custom"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-contrast bg-brand-600 rounded-md hover:bg-brand-700 shadow-xs transition-colors"
              >
                <Plus size={13} />
                Custom report
              </Link>
            </div>
          )}
        </div>

        {/* The dashboards scroll sideways when there are many; New and the dashboard's menu
            stay at the ends of the bar */}
        <div data-guide="reports.pages" className="flex items-center gap-0 mt-3 -mb-px">
          <ScrollCue className="min-w-0" scrollerClassName="flex" activeKey={active?.id}>
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                aria-current={active?.id === p.id ? 'page' : undefined}
                data-scroll-active={active?.id === p.id}
                className={`px-3 py-2 max-md:min-h-11 text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  active?.id === p.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {p.name}
              </button>
            ))}
          </ScrollCue>
          <button
            type="button"
            onClick={() => setModal('new')}
            aria-label="New dashboard"
            title="New dashboard"
            className="ml-1 p-1.5 max-md:min-w-11 max-md:min-h-11 shrink-0 flex items-center justify-center rounded text-text-tertiary hover:text-text-secondary hover:bg-hover transition-colors"
          >
            <Plus size={15} />
          </button>
          {active && (
            <div className="ml-auto pl-2 shrink-0">
              <RowMenu
                items={[
                  { label: 'Rename dashboard…', onClick: () => setModal('rename') },
                  {
                    label: 'Delete dashboard',
                    danger: true,
                    hidden: pages.length <= 1,
                    onClick: () => setModal('delete'),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto py-6 bg-page ${PAGE_GUTTER}`}>
        <MissingRatesBanner className="mb-4" />
        {active && (
          <UncategorisedBanner
            className="mb-4"
            from={dayBounds(dashboardRange.from, dashboardRange.to).from}
            to={dayBounds(dashboardRange.from, dashboardRange.to).to}
          />
        )}
        {active && (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-4">
            <span className="text-xs font-medium text-text-secondary">Date range</span>
            <DateRangeControl
              value={dashboardRange}
              onChange={(dateRange) =>
                updateDashboard.mutate({ id: active.id, data: { dateRange } })
              }
            />
            {ownRangeCount > 0 && (
              <span className="text-xs text-text-tertiary">
                {ownRangeCount === 1
                  ? '1 widget keeps its own dates'
                  : `${ownRangeCount} widgets keep their own dates`}
              </span>
            )}
          </div>
        )}
        {pagesLoading || widgetsLoading ? (
          <div className="h-64">
            <ChartSkeleton />
          </div>
        ) : active && widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-3 px-6">
            <LayoutGrid size={26} className="text-brand-600" aria-hidden />
            <p className="text-base font-semibold text-text">This dashboard is empty</p>
            <p className="text-sm text-text-tertiary max-w-sm">
              Add charts like net worth, spending trends or a transaction calendar, or build your
              own report and pin it here.
            </p>
            <AddWidgetMenu pageId={active.id} reports={reports} />
          </div>
        ) : (
          active && (
            <DashboardGrid
              pageId={active.id}
              widgets={widgets}
              reports={reports}
              pages={pages}
              dashboardRange={dashboardRange}
              editing={editing}
            />
          )
        )}
      </div>

      {newModal.value && (
        <NameModal
          isOpen={newModal.isOpen}
          title="New dashboard"
          label="Dashboard name"
          placeholder="e.g. Yearly review"
          submitLabel="Create"
          onClose={() => setModal(null)}
          onSave={(name) =>
            createDashboard.mutate(name, {
              onSuccess: (page) => {
                setModal(null);
                select(page.id);
              },
            })
          }
        />
      )}
      {renameModal.value && (
        <NameModal
          isOpen={renameModal.isOpen}
          title="Rename dashboard"
          label="Dashboard name"
          initialName={renameModal.value.name}
          submitLabel="Rename"
          onClose={() => setModal(null)}
          onSave={(name) =>
            updateDashboard.mutate(
              { id: renameModal.value!.id, data: { name } },
              { onSuccess: () => setModal(null) },
            )
          }
        />
      )}
      {active && (
        <ConfirmModal
          isOpen={modal === 'delete'}
          onClose={() => setModal(null)}
          onConfirm={() =>
            deleteDashboard.mutate(active.id, {
              onSuccess: () => {
                setModal(null);
                const next = pages.find((p) => p.id !== active.id);
                if (next) select(next.id);
              },
            })
          }
          title="Delete dashboard"
          message={`Delete "${active.name}" and its widgets? Saved custom reports are kept.`}
          confirmLabel="Delete"
          danger
        />
      )}
    </div>
  );
}
