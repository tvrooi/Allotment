import { test, expect } from '@playwright/test';

// A transfer between two listed accounts is one row that says which way the money went
// (owner-requested 8 November 2026); an account's own register keeps its side.
test('a transfer reads as one row, from one account to the other', async ({ page }) => {
  await page.goto('/demo/#/transactions');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Last 3 months' }).click();
  const pair = page
    .getByTestId('transaction-row')
    .filter({ hasText: 'Transfer from Spending to 2Up Spending' });
  await expect(pair.first()).toBeVisible();
  // The money-in side ("Transfer from Spending" alone) isn't a row of its own here
  await expect(
    page.getByTestId('transaction-row').filter({ hasText: /Transfer from Spending(?! to)/ }),
  ).toHaveCount(0);

  await pair.first().getByText('Transfer from Spending to 2Up Spending').click();
  await expect(page.getByLabel('Transfer between accounts')).toContainText('FromSpending');
  await expect(page.getByLabel('Transfer between accounts')).toContainText('To2Up Spending');
});
