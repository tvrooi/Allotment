import { test, expect } from '@playwright/test';

test('payday funding and validation work in the offline demo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/demo/#/budget');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };
    const groups = (await call('GET', '/categories')).body;
    const salary = groups.find((g: { isIncome: number }) => g.isIncome).categories[0];
    const food = groups.find((g: { isIncome: number }) => !g.isIncome).categories[0];
    const account = (await call('POST', '/accounts', { name: 'Payday demo', type: 'checking' }))
      .body;
    const today = new Date().toISOString().slice(0, 10);
    const income = (
      await call('POST', '/transactions', {
        accountId: account.id,
        date: today,
        amount: 10000000,
        categoryId: salary.id,
        payeeName: 'Payday demo employer',
      })
    ).body;
    const config = {
      name: 'Demo payday',
      anchorDate: today,
      expectedIncome: 10000000,
      timeZone: 'UTC',
      rules: [{ categoryId: food.id, method: 'fixed', amount: 1000 }],
    };
    const invalid = await call('POST', '/payday', { ...config, timeZone: 'invalid/zone' });
    const plan = (await call('POST', '/payday', config)).body;
    const request = { scheduledDate: today, actualPayDate: today, incomeIds: [income.id] };
    const preview = await call('POST', `/payday/${plan.id}/preview`, request);
    const applied = await call('POST', `/payday/${plan.id}/apply`, {
      ...request,
      previewKey: preview.body.previewKey,
    });
    const repeated = await call('POST', `/payday/${plan.id}/apply`, {
      ...request,
      previewKey: preview.body.previewKey,
    });
    return {
      invalid: invalid.status,
      preview: preview.status,
      // The sample budget's bills due before the next payday are funded too, and which ones
      // depends on today's date: check only this test's own rule
      allocated: preview.body.rows.find((r: { categoryId: string }) => r.categoryId === food.id)
        .allocated,
      applied: applied.status,
      repeated: repeated.body.alreadyApplied,
    };
  });
  expect(result).toEqual({
    invalid: 400,
    preview: 200,
    allocated: 1000,
    applied: 200,
    repeated: true,
  });
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await expect(
    page.getByText('This payday has already been funded.', { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
