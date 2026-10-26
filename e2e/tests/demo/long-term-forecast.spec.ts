import { test, expect } from '@playwright/test';

// The long-term forecast runs in the offline demo too: its plans live in the demo's own
// in-browser database, and nothing leaves the page.
test('the long-term forecast works in the offline demo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo/#/forecast');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Long term' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByLabel('Plan name').fill('Demo plan');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Net worth by year, Demo plan' })).toBeVisible();

  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('button', { name: /^Retirement/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Retirement · ').first()).toBeVisible();
  await page.getByLabel('Year', { exact: true }).selectOption({ index: 2 });
  await expect(page.getByText('The parts add up to the change, to the cent')).toBeVisible();

  await page.getByRole('tab', { name: 'Simulation' }).click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByLabel('Chance of success')).toBeVisible();

  const result = await page.evaluate(async () => {
    const plans = await (await fetch('/api/forecast/long-term/plans')).json();
    const run = await fetch(`/api/forecast/long-term/plans/${plans[0].id}/result?view=summary`);
    return { count: plans.length, status: run.status, years: (await run.json()).years.length };
  });
  expect(result).toMatchObject({ count: 1, status: 200 });
  expect(result.years).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
