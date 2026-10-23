import { test, expect } from '@playwright/test';

test('the budget review, buffer and guided setup run in the offline demo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo/#/review');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guided setup' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next month and buffer' })).toBeVisible();
  const totals = await page.evaluate(async () => {
    const review = await (await fetch('/api/review')).json();
    const summary = await (await fetch(`/api/budget/${review.month}/summary`)).json();
    return { review: review.totals, summary };
  });
  expect(totals.review.uncategorised).toBe(totals.summary.uncategorized);
  expect(totals.review.deficits).toBe(totals.summary.overspent);
  expect(totals.review.futureCommitments).toBe(totals.summary.futureAssigned);
  expect(errors).toEqual([]);
});
