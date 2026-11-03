import { describe, expect, it } from 'vitest';
import { whereIsTheLog } from './hostKind';

describe('whereIsTheLog', () => {
  it('points Home Assistant users at the app Log', () => {
    expect(whereIsTheLog('home-assistant')).toBe(
      'Find it in Home Assistant: Settings → Apps → Allotment → Log.',
    );
    expect(whereIsTheLog('home-assistant', { notifications: true })).toContain('Notifications');
  });

  it('keeps the Docker wording for Docker, and stays general otherwise', () => {
    expect(whereIsTheLog('docker')).toContain('docker logs flybudget');
    expect(whereIsTheLog('other')).not.toContain('docker');
    expect(whereIsTheLog(undefined)).not.toContain('docker');
  });
});
