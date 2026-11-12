import type { GuideProgress, NavFeature } from '../api/guides';

// Optional navigation uses the budget's choices and usage. Setup features stay in their fixed
// menu positions before they hold data; an explicit Hidden choice still leaves them out.
export const SETUP_FEATURES = ['household', 'tax', 'files'] as const;
export type FeatureState = 'shown' | 'setup' | 'hidden';

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
 * Loading leaves optional rows out; failed/older guides and the current page show normal rows.
 * Explicit choices take precedence over usage, except while visiting the feature itself.
 */
export function featureState(
  feature: NavFeature,
  progress: GuideProgress | undefined,
  pathname: string,
  failed = false,
): FeatureState {
  const info = NAV_FEATURES.find((f) => f.key === feature)!;
  if (onPage(pathname, info.path) || failed) return 'shown';
  if (!progress) return 'hidden';
  const choice = progress.navFeatures?.[feature];
  if (choice) return choice === 'shown' ? 'shown' : 'hidden';
  if (!progress.featuresInUse || progress.featuresInUse.includes(feature)) return 'shown';
  return SETUP_FEATURES.some((key) => key === feature) ? 'setup' : 'hidden';
}

/** Whether a feature has a row, including its setup row. */
export function featureShown(
  feature: NavFeature,
  progress: GuideProgress | undefined,
  pathname: string,
  failed = false,
): boolean {
  return featureState(feature, progress, pathname, failed) !== 'hidden';
}

/** How many optional features the menu leaves out right now */
export function hiddenFeatureCount(
  progress: GuideProgress | undefined,
  pathname: string,
  failed = false,
): number {
  if (!progress || failed) return 0;
  return NAV_FEATURES.filter((f) => featureState(f.key, progress, pathname, failed) === 'hidden')
    .length;
}
