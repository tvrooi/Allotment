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
    return { review: review.totals, summary, count: review.uncategorisedCount };
  });
  expect(totals.review.uncategorised).toBe(totals.summary.uncategorized);
  expect(totals.review.deficits).toBe(totals.summary.overspent);
  expect(totals.review.futureCommitments).toBe(totals.summary.futureAssigned);
  const category = page.getByRole('button', { name: /^Category for/ }).first();
  await category.click();
  const search = page.getByRole('textbox', { name: 'Search categories' });
  await expect(search).toBeFocused();
  await search.fill('Groceries');
  await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(category).toBeFocused();
  await category.click();
  await search.fill('Groceries');
  await page.keyboard.press('Enter');
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('categorised as Groceries');
  await expect
    .poll(() =>
      page.evaluate(async () => (await (await fetch('/api/review')).json()).uncategorisedCount),
    )
    .toBe(totals.count - 1);
  await toast.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await (await fetch('/api/review')).json()).uncategorisedCount),
    )
    .toBe(totals.count);
  await toast.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await (await fetch('/api/review')).json()).uncategorisedCount),
    )
    .toBe(totals.count - 1);
  expect(errors).toEqual([]);
});

test('review groups repeated payees in the offline demo', async ({ page }) => {
  await page.goto('/demo/#/accounts');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await page.evaluate(async () => {
    const accounts = await (await fetch('/api/accounts')).json();
    const account = accounts.find(
      (a: { type: string; isOffBudget: number; householdPool?: string }) =>
        a.type === 'checking' && !a.isOffBudget && !a.householdPool,
    );
    const { asOf } = await (await fetch('/api/review')).json();
    for (let i = 0; i < 2; i++) {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          date: asOf,
          amount: -1000,
          payeeName: 'Demo repeated merchant',
          categoryId: null,
        }),
      });
      if (!response.ok) throw new Error(`Could not seed demo transaction: ${response.status}`);
    }
  });
  await page.getByRole('link', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Sort repeated payees together', exact: true }).click();
  const group = page.getByRole('region', { name: 'Sort repeated payees', exact: true });
  await expect(group.getByLabel('Also apply to future transactions')).not.toBeChecked();
  const picker = group.getByRole('button', {
    name: 'Category for Demo repeated merchant',
    exact: true,
  });
  await group
    .getByRole('link', { name: 'View transactions for Demo repeated merchant', exact: true })
    .click();
  await expect(page.getByTestId('transaction-row')).toHaveCount(2);
  await expect(
    page.getByTestId('transaction-row').filter({ hasText: 'Demo repeated merchant' }),
  ).toHaveCount(2);
  await page.goBack();
  await page.getByRole('button', { name: 'Sort repeated payees together', exact: true }).click();
  await picker.click();
  await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
  await page.keyboard.press('Enter');
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('2 transactions for Demo repeated merchant');
  await expect(picker).toHaveCount(0);
  await toast.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(picker).toBeVisible();
  await toast.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(picker).toHaveCount(0);
});
