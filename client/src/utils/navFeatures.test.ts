import { describe, expect, it } from 'vitest';
import type { GuideProgress } from '../api/guides';
import { featureShown, featureState, hiddenFeatureCount } from './navFeatures';

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
    expect(featureShown('household', progress(), '/dashboard')).toBe(true);
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
    expect(featureState('tax', progress(), '/taxes')).toBe('setup');
  });

  it('wait while loading, and list everything for a server that predates them', () => {
    expect(featureShown('investments', undefined, '/budget')).toBe(false);
    expect(featureShown('investments', undefined, '/budget', true)).toBe(true);
    const older = progress({ navFeatures: undefined, featuresInUse: undefined });
    expect(featureShown('investments', older, '/budget')).toBe(true);
  });

  it('counts what the menu leaves out', () => {
    expect(hiddenFeatureCount(progress({ featuresInUse: ['files', 'tax'] }), '/budget')).toBe(2);
    expect(hiddenFeatureCount(undefined, '/budget')).toBe(0);
  });
});

it('distinguishes setup rows from shown and explicitly hidden features', () => {
  for (const feature of ['household', 'tax', 'files'] as const) {
    expect(featureState(feature, progress(), '/budget')).toBe('setup');
    expect(
      featureState(feature, progress({ navFeatures: { [feature]: 'shown' } }), '/budget'),
    ).toBe('shown');
    expect(featureState(feature, progress({ featuresInUse: [feature] }), '/budget')).toBe('shown');
    expect(
      featureState(
        feature,
        progress({ featuresInUse: [feature], navFeatures: { [feature]: 'hidden' } }),
        '/budget',
      ),
    ).toBe('hidden');
    expect(featureState(feature, undefined, '/budget')).toBe('hidden');
    expect(featureState(feature, undefined, '/budget', true)).toBe('shown');
  }
  expect(featureState('files', progress({ navFeatures: { files: 'hidden' } }), '/files')).toBe(
    'shown',
  );
  expect(featureState('investments', progress(), '/budget')).toBe('hidden');
  expect(featureState('pay-later', progress(), '/budget')).toBe('hidden');
  expect(hiddenFeatureCount(progress(), '/budget')).toBe(2);
  expect(hiddenFeatureCount(progress({ navFeatures: { files: 'hidden' } }), '/budget')).toBe(3);
  expect(hiddenFeatureCount(undefined, '/budget', true)).toBe(0);
});
