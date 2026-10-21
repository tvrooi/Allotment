import { test, expect } from '@playwright/test';

test('the read-only forecast runs in the offline demo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo/#/forecast');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Forecast' })).toBeVisible();
  await expect(page.getByText('Cash runway', { exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const call = async (body: unknown) => {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };
    const before = await (await fetch('/api/transactions?limit=500')).json();
    const ok = await call({ horizonDays: 30, incomeSource: 'schedules' });
    const invalid = await call({ horizonDays: 5000 });
    const after = await (await fetch('/api/transactions?limit=500')).json();
    return { ok, invalid, unchanged: JSON.stringify(before) === JSON.stringify(after) };
  });
  expect(result.ok.status).toBe(200);
  expect(result.ok.body.scenarios).toHaveLength(3);
  expect(result.ok.body.scenarios[0].days).toHaveLength(31);
  expect(result.invalid.status).toBe(400);
  expect(result.unchanged).toBe(true);
  expect(errors).toEqual([]);
});
