import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_ADD_ACCOUNT_KEY,
  defaultAddAccount,
  readLastAddAccount,
  rememberAddAccount,
} from './addTransaction';

const open = (id: string) => ({ id, closedAt: null });
const closed = (id: string) => ({ id, closedAt: '2026-10-01T00:00:00.000Z' });

describe('defaultAddAccount', () => {
  const accounts = [open('everyday'), open('saver'), closed('old')];

  it("chooses the page's account over the last one used", () => {
    expect(defaultAddAccount(accounts, 'saver', 'everyday')).toBe('saver');
  });

  it('chooses the last one used when the page has no account', () => {
    expect(defaultAddAccount(accounts, null, 'everyday')).toBe('everyday');
  });

  it('chooses none when neither is known', () => {
    expect(defaultAddAccount(accounts, null, null)).toBe('');
  });

  it('ignores a closed account, on the page or remembered', () => {
    expect(defaultAddAccount(accounts, 'old', 'everyday')).toBe('everyday');
    expect(defaultAddAccount(accounts, null, 'old')).toBe('');
  });

  it('ignores an account that is gone (deleted, or from another budget)', () => {
    expect(defaultAddAccount(accounts, 'gone', null)).toBe('');
    expect(defaultAddAccount(accounts, null, 'gone')).toBe('');
  });
});

describe('the last account used', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is remembered on this device', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    expect(readLastAddAccount()).toBeNull();
    rememberAddAccount('saver');
    expect(store.get(LAST_ADD_ACCOUNT_KEY)).toBe('saver');
    expect(readLastAddAccount()).toBe('saver');
  });

  it('is simply not remembered when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => rememberAddAccount('saver')).not.toThrow();
    expect(readLastAddAccount()).toBeNull();
  });
});
