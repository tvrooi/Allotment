import { describe, expect, it } from 'vitest';
import { unprotectedBindError } from './config.js';

describe('unprotectedBindError', () => {
  const check = (listenHost: string, serverMode = false, desktop = false) =>
    unprotectedBindError({ listenHost, serverMode, desktop });

  it('refuses listening beyond this machine without a login or the desktop token', () => {
    for (const host of ['0.0.0.0', '::', '192.168.1.20', 'budget.example'])
      expect(check(host)).toMatch(/without a password/);
  });

  it('allows loopback, server mode and the desktop app', () => {
    for (const host of ['127.0.0.1', '::1', 'localhost', 'LOCALHOST'])
      expect(check(host)).toBeNull();
    expect(check('0.0.0.0', true)).toBeNull();
    expect(check('0.0.0.0', false, true)).toBeNull();
  });
});
