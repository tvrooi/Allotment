import { describe, expect, it } from 'vitest';
import { hostKind } from './hostKind.js';

describe('hostKind', () => {
  it('is Home Assistant when the launcher says so or a Supervisor token exists', () => {
    expect(hostKind({ FLYBUDGET_HOST_KIND: 'home-assistant' }, () => true)).toBe('home-assistant');
    expect(hostKind({ SUPERVISOR_TOKEN: 'x' }, () => true)).toBe('home-assistant');
  });

  it('is Docker inside a container, otherwise something else', () => {
    expect(hostKind({}, () => true)).toBe('docker');
    expect(hostKind({}, () => false)).toBe('other');
    expect(hostKind({ FLYBUDGET_HOST_KIND: 'docker' }, () => false)).toBe('docker');
  });
});
