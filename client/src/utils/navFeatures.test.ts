import { describe, expect, it } from 'vitest';
import type { GuideProgress } from '../api/guides';
import { featureShown, hiddenFeatureCount } from './navFeatures';

const progress = (extra: Partial<GuideProgress> = {}): GuideProgress => ({
  tipsEnabled: true,
  pageGuidesEnabled: true,
  welcomeTour: 'done',
  guidesNotice: false,
  seenGuides: {},
  dismissedTips: [],
  navFeatures: {},
  featuresInUse: [],
  ...extra,
});

describe('optional sidebar features', () => {
  it('appear once they hold something, unless the person chose otherwise', () => {
    expect(featureShown('household', progress(), '/dashboard')).toBe(false);
    expect(
      featureShown('household', progress({ featuresInUse: ['household'] }), '/dashboard'),
    ).toBe(true);
    expect(
      featureShown(
        'household',
        progress({ featuresInUse: ['household'], navFeatures: { household: 'hidden' } }),
        '/dashboard',
      ),
    ).toBe(false);
    expect(featureShown('tax', progress({ navFeatures: { tax: 'shown' } }), '/dashboard')).toBe(
      true,
    );
  });

  it('always show the page you are on, so a link or a guide never leads somewhere unlisted', () => {
    const hidden = progress({ navFeatures: { files: 'hidden' } });
    expect(featureShown('files', hidden, '/files')).toBe(true);
    expect(featureShown('tax', progress(), '/tax/2026')).toBe(true);
    expect(featureShown('tax', progress(), '/taxes')).toBe(false);
  });

  it('wait while loading, and list everything for a server that predates them', () => {
    expect(featureShown('investments', undefined, '/budget')).toBe(false);
    expect(featureShown('investments', undefined, '/budget', true)).toBe(true);
    const older = progress({ navFeatures: undefined, featuresInUse: undefined });
    expect(featureShown('investments', older, '/budget')).toBe(true);
  });

  it('counts what the menu leaves out', () => {
    expect(hiddenFeatureCount(progress({ featuresInUse: ['files', 'tax'] }), '/budget')).toBe(3);
    expect(hiddenFeatureCount(undefined, '/budget')).toBe(0);
  });
});
