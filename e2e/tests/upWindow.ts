import { test, type Page } from '@playwright/test';
import type { Api } from './fixtures';

/**
 * The Up tests share the bank routes' write limit (20 a minute). Starts a test in a fresh
 * window with at least `need` writes left, and clears any Up connection on the way.
 */
export async function freshUpWindow(page: Page, api: Api, need = 8) {
  for (;;) {
    const res = await api.request.fetch('/api/up/connection', { method: 'DELETE' });
    const limit = res.headers()['ratelimit'] ?? '';
    const remaining = Number(/r=(\d+)/.exec(limit)?.[1] ?? 20);
    const reset = Number(/t=(\d+)/.exec(limit)?.[1] ?? 0);
    if (res.status() !== 429 && remaining >= need) break;
    // Waiting for the window must not eat the test's own time
    const wait = (reset + 1) * 1000;
    test.info().setTimeout(test.info().timeout + wait);
    await page.waitForTimeout(wait);
  }
}
