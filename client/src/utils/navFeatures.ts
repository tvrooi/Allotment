import type { GuideProgress, NavFeature } from '../api/guides';

// The sidebar's optional features (audit decision I-4, docs/AUDIT-2026-11.md): a new budget's menu
// stays short, and each appears once it holds something, or when the person turns it on in
// Settings → Preferences → Sidebar. Their pages always open from a link or a guide, and the menu
// shows the one you're on.

export interface NavFeatureInfo {
  key: NavFeature;
  label: string;
  path: string;
  /** What it's for, in Settings */
  description: string;
}

export const NAV_FEATURES: NavFeatureInfo[] = [
  {
    key: 'pay-later',
    label: 'Pay later',
    path: '/payment-plans',
    description: 'Afterpay, Zip and other instalment plans',
  },
  {
    key: 'household',
    label: 'Household',
    path: '/household',
    description: 'Bills and money shared with people you live with',
  },
  {
    key: 'investments',
    label: 'Investments',
    path: '/investments',
    description: 'Shares, ETFs and funds you hold',
  },
  { key: 'tax', label: 'Tax time', path: '/tax', description: 'Deductions and receipts for tax' },
  { key: 'files', label: 'Files', path: '/files', description: 'Documents, receipts and links' },
];

const onPage = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/**
 * Whether the menu lists an optional feature. `progress` is undefined while it loads (hidden, so
 * nothing flashes in and out); `failed` (an older server, or none reachable) lists everything,
 * as before features were optional.
 */
export function featureShown(
  feature: NavFeature,
  progress: GuideProgress | undefined,
  pathname: string,
  failed = false,
): boolean {
  const info = NAV_FEATURES.find((f) => f.key === feature)!;
  if (onPage(pathname, info.path)) return true;
  if (failed) return true;
  if (!progress) return false;
  const choice = progress.navFeatures?.[feature];
  if (choice) return choice === 'shown';
  if (!progress.featuresInUse) return true;
  return progress.featuresInUse.includes(feature);
}

/** How many optional features the menu leaves out right now */
export function hiddenFeatureCount(
  progress: GuideProgress | undefined,
  pathname: string,
  failed = false,
): number {
  if (!progress || failed) return 0;
  return NAV_FEATURES.filter((f) => !featureShown(f.key, progress, pathname, failed)).length;
}
