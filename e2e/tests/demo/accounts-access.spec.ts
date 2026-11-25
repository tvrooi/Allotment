import { test, expect } from '@playwright/test';

test('account access and the compact overview work in the offline demo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/#/accounts');
  const main = page.getByRole('main');
  const spending = main.getByRole('link', { name: /^Spending Everyday/ });
  await expect(spending).toBeInViewport({ ratio: 1 });
  await main.getByRole('button', { name: 'Show overview' }).click();
  await expect(main.getByRole('group', { name: 'Net worth period' })).toBeVisible();
  await main.getByRole('button', { name: 'Hide overview' }).click();
  const cash = main.getByRole('button', { name: /^Cash/ });
  await cash.focus();
  await page.keyboard.press('Tab');
  await expect(spending).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/accounts\/demo-acct-checking$/);
});
