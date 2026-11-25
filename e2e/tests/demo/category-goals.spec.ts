import { test, expect } from '@playwright/test';

test('category-funded goals use shared accounting and survive demo backup restore', async ({
  page,
}) => {
  await page.goto('/demo/#/goals');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  const result = await page.evaluate(async () => {
    async function call(method: string, path: string, body?: unknown) {
      const res = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    const groups = await call('GET', '/categories');
    const category = groups.find((g: { isIncome: number }) => !g.isIncome).categories[0];
    const created = await call('POST', '/goals', {
      name: 'Category demo',
      targetAmount: 50000,
      categoryId: category.id,
    });
    const backup = await call('GET', '/export/backup');
    await call('POST', '/export/restore', backup);
    const goals = await call('GET', '/goals');
    const restored = goals.find((g: { id: string }) => g.id === created.id);
    return {
      linked: restored.categoryId === category.id,
      same: restored.fundedAmount === created.fundedAmount,
      version: backup.version,
    };
  });
  expect(result).toEqual({ linked: true, same: true, version: 34 });
  await page.getByRole('link', { name: 'Budget', exact: true }).click();
  await page.getByRole('link', { name: 'Goals', exact: true }).click();
  await expect(page.getByText('Category demo', { exact: true })).toBeVisible();
});

test("the demo's reached goal has flowered (#241)", async ({ page }) => {
  await page.goto('/demo/#/goals');
  const row = page.getByTestId('goal-row').filter({ hasText: 'New laptop' });
  await expect(row.getByTestId('goal-plant')).toHaveAttribute('data-stage', 'flower');
  await expect(row).toContainText('Goal reached');
});

// Wave G3 (#267): the goal form's Progress source is the shared category picker in the demo too
test("the demo's goal form takes its progress source from the category picker", async ({
  page,
}) => {
  await page.goto('/demo/#/goals');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  const name = await page.evaluate(async () => {
    const groups = await (await fetch('/api/categories')).json();
    return groups.find((g: { isIncome: number }) => !g.isIncome).categories[0].name as string;
  });
  await page.getByRole('button', { name: 'Add goal' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add goal' });
  await expect(dialog.getByLabel('Saved so far')).toBeVisible();
  await dialog.getByRole('button', { name: 'Progress source: Manual tracking' }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(dialog.getByRole('button', { name: `Progress source: ${name}` })).toBeVisible();
  await expect(dialog.getByLabel('Saved so far')).toHaveCount(0);
});
