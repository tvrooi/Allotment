import { test, expect } from '@playwright/test';

// Up round-ups as Up shows them (owner-requested 8 November 2026): the purchase is listed once
// at its total with a mark, its details show the parts, and the round-up's own rows are folded.
test('an Up round-up is shown on its purchase, not as rows of its own', async ({ page }) => {
  await page.goto('/demo/#/transactions');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  const mark = page.getByRole('img', { name: 'Rounded up $0.48' });
  await expect(mark).toHaveCount(1);
  const row = page.getByTestId('transaction-row').filter({ has: mark });
  await expect(row).toContainText('$52');

  await mark.click();
  const details = page.getByRole('region', { name: 'Round-up' });
  await expect(details).toContainText('$51.52');
  await expect(details).toContainText('Round-up to Rainy Day');
  await expect(details).toContainText('$0.48');
  await expect(details).toContainText('$52');

  // Neither leg of the round-up has a row of its own in All transactions
  await page.getByPlaceholder('Search payee or notes…').fill('Round-up from Woolies');
  await expect(page.getByTestId('transaction-row')).toHaveCount(0);
});
