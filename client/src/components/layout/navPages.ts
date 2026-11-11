import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  CandlestickChart,
  ClipboardCheck,
  FolderOpen,
  House,
  Landmark,
  LayoutDashboard,
  Receipt,
  Repeat,
  Settings,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { NavFeature } from '../../api/guides';
import type { NavGroup } from '../../store/preferencesStore';
import { NAV_FEATURES } from '../../utils/navFeatures';

// The app's pages, in menu order: the sidebar (Sidebar.tsx) and the search palette
// (CommandPalette.tsx) both list these, so a page added here appears in both.

export interface NavPage {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Where the sidebar lists it: the everyday list, a folding group, or the footer */
  section: 'main' | NavGroup | 'footer';
  /** An optional feature (utils/navFeatures.ts): listed once it holds something or is turned on */
  feature?: NavFeature;
}

/** An optional feature's page, named and placed as utils/navFeatures.ts says */
function featurePage(feature: NavFeature, icon: LucideIcon, section: NavPage['section']): NavPage {
  const info = NAV_FEATURES.find((f) => f.key === feature)!;
  return { path: info.path, label: info.label, icon, section, feature };
}

export const NAV_PAGES: NavPage[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
  { path: '/accounts', label: 'Accounts', icon: Landmark, section: 'main' },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight, section: 'main' },
  { path: '/budget', label: 'Budget', icon: Wallet, section: 'main' },
  { path: '/review', label: 'Review', icon: ClipboardCheck, section: 'main' },
  { path: '/recurring', label: 'Recurring', icon: Repeat, section: 'main' },
  featurePage('pay-later', CalendarClock, 'main'),
  featurePage('household', House, 'main'),
  { path: '/reports', label: 'Reports', icon: BarChart3, section: 'main' },
  { path: '/cash-flow', label: 'Cash flow', icon: Workflow, section: 'main' },
  { path: '/goals', label: 'Goals', icon: Target, section: 'planning' },
  { path: '/forecast', label: 'Forecast', icon: TrendingUp, section: 'planning' },
  featurePage('investments', CandlestickChart, 'planning'),
  featurePage('tax', Receipt, 'planning'),
  { path: '/payees', label: 'Payees', icon: Users, section: 'tools' },
  { path: '/rules', label: 'Rules', icon: Zap, section: 'tools' },
  featurePage('files', FolderOpen, 'tools'),
  { path: '/settings', label: 'Settings', icon: Settings, section: 'footer' },
];

/** Where the sidebar's "More features" goes: the Sidebar setting, which turns features on */
export const MORE_FEATURES_LINK = {
  to: '/settings?tab=preferences',
  state: { focus: 'sidebar-features' },
} as const;
