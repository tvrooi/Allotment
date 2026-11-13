import { Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Coins,
  Download,
  SlidersHorizontal,
  Server,
  Compass,
  Tag,
  CalendarRange,
} from 'lucide-react';
import { ServerSettings } from '../components/settings/ServerSettings';
import { AccountReorder } from '../components/settings/AccountReorder';
import { DataExport } from '../components/settings/DataExport';
import { PreferencesPanel } from '../components/settings/PreferencesPanel';
import { CurrencySettings } from '../components/settings/CurrencySettings';
import { PrioritiesSettings } from '../components/settings/PrioritiesSettings';
import { TagManager } from '../components/settings/TagManager';
import { BudgetStartSettings } from '../components/settings/BudgetStartSettings';
import { movedSettingsTab } from '../utils/movedSections';
import { LICENSE_URL, SOURCE_CODE_URL } from '../utils/project';
import { ScrollCue } from '../components/ui/ScrollCue';
import { onTabListKeyDown, tabIds as tabPanelIds } from '../components/ui/tabList';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

const tabs = [
  // The theme, Safe mode, the sidebar and guides: what most visits come for, so it opens first
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'accounts', label: 'Accounts', icon: ArrowUpDown },
  // When the envelope budget starts counting
  { id: 'budget', label: 'Budget', icon: CalendarRange },
  // Phase 9 transaction tags
  { id: 'tags', label: 'Tags', icon: Tag },
  // The budget's currency, exchange rates and how each currency is written
  { id: 'currencies', label: 'Currencies', icon: Coins },
  // Optional financial priorities and category purposes (phase 7A)
  { id: 'priorities', label: 'Priorities', icon: Compass },
  { id: 'data', label: 'Data', icon: Download },
  // Where the data lives; on a self-hosted server also security, devices and password
  { id: 'server', label: 'Server', icon: Server },
] as const;

type TabId = (typeof tabs)[number]['id'];

const tabIds = new Set<string>(tabs.map((t) => t.id));

export default function SettingsPage() {
  // The tab lives in the URL (?tab=server), so links like the sidebar's "Server settings"
  // can open it
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = tabParam && tabIds.has(tabParam) ? (tabParam as TabId) : 'preferences';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });
  // Connected banks and Categories moved to Accounts and Budget (#244); old links still arrive
  const movedTo = movedSettingsTab(tabParam);
  if (movedTo) return <Navigate to={movedTo} replace />;

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={`py-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
        <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
          Settings
        </h1>
        <div data-guide="settings.tabs">
          {/* The row overlaps the bar's border by a pixel, so the open tab's underline sits
              on it. Its tabs stay inside the row: one hanging out made it scroll up and down. */}
          <ScrollCue
            className="mt-3 border-b border-border-light -mb-px"
            scrollerClassName="flex gap-0 -mb-px"
            activeKey={activeTab}
            scrollerProps={{
              role: 'tablist',
              'aria-label': 'Settings sections',
              onKeyDown: onTabListKeyDown,
            }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={tabPanelIds('settings', tab.id).tab}
                  aria-controls={tabPanelIds('settings', tab.id).panel}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  data-scroll-active={isActive}
                  className={`flex items-center gap-1.5 px-3 py-2 max-md:min-h-11 text-sm font-medium whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </ScrollCue>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
        <div
          className="max-w-2xl"
          role="tabpanel"
          id={tabPanelIds('settings', activeTab).panel}
          aria-labelledby={tabPanelIds('settings', activeTab).tab}
        >
          {activeTab === 'accounts' && <AccountReorder />}
          {activeTab === 'tags' && <TagManager />}
          {activeTab === 'budget' && <BudgetStartSettings />}
          {activeTab === 'currencies' && <CurrencySettings />}
          {activeTab === 'priorities' && <PrioritiesSettings />}
          {activeTab === 'data' && <DataExport />}
          {activeTab === 'preferences' && <PreferencesPanel />}
          {activeTab === 'server' && <ServerSettings onOpenTab={setActiveTab} />}

          <p className="mt-10 pt-4 border-t border-border-light text-xs text-text-tertiary">
            Allotment is free software under the{' '}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary"
            >
              GNU AGPL v3
            </a>
            .{' '}
            <a
              href={SOURCE_CODE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary"
            >
              Source code
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
