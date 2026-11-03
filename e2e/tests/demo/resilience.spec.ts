import { test, expect } from '@playwright/test';

test('the resilience and resume cards run in the offline demo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo/#/review');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flexibility and resilience' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resume budgeting' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const priorities = await (await fetch('/api/priorities')).json();
    const resilience = await (await fetch('/api/review/resilience')).json();
    const summary = await (await fetch(`/api/budget/${resilience.month}/summary`)).json();
    return { priorities, resilience, summary };
  });
  expect(result.priorities.revision).toBe(0);
  expect(result.resilience.status).toBe('not-set-up');
  // The same shared funding figures as the budget: the partition, including cash already spent
  // beyond envelopes this month (negative, so it depends on the day the demo is generated),
  // adds up to its resources.
  const p = result.resilience.partition;
  expect(
    p.card + p.committed + p.goals + p.flexibility + p.other + p.overspent + p.unassigned,
  ).toBe(result.resilience.resources);
  expect(p.unassigned).toBe(result.summary.toBeBudgeted);
  expect(errors).toEqual([]);
});
