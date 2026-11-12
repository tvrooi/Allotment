import { test, expect, open } from '../fixtures';

test('Wave D: phone drawer shows setup rows without sideways scroll', async ({ page }) => {
  await open(page, '/settings');
  await expect(page.getByTestId('phone-header')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const drawer = page.getByRole('complementary').first();
  for (const name of ['Household', 'Tax time', 'Files'])
    await expect(drawer.getByRole('link', { name: name + ', set up', exact: true })).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'More features (2)' })).toBeVisible();
  const allAccounts = drawer.getByRole('link', { name: /^All accounts/ });
  await allAccounts.scrollIntoViewIfNeeded();
  await expect(allAccounts).toBeInViewport({ ratio: 1 });
  await allAccounts.click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
