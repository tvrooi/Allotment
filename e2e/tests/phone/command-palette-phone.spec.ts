import { test, expect, open } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// The search palette on a phone (issue #224): the header's Search button opens it, and it fits
// 390px with no sideways scroll.

test('the header Search button opens the palette, which fits the screen', async ({ page, api }) => {
  await api.createAccount('Everyday Spending', 432_109);
  await open(page, '/dashboard');
  const header = page.getByTestId('phone-header');
  const search = header.getByRole('button', { name: 'Search' });
  const box = (await search.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await sidewaysOverflow(page)).toEqual([]);

  await search.click();
  const palette = page.getByRole('dialog', { name: 'Search' });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('option', { name: 'Dashboard' })).toBeVisible();
  // No keyboard hints on a phone
  await expect(palette.locator('kbd')).toHaveCount(0);
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('phone-palette-empty.png') });

  await palette.getByRole('combobox').fill('every');
  const account = palette.getByRole('option', { name: 'Everyday Spending' });
  await expect(account).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('phone-palette-query.png') });
  await account.click();
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/#\/accounts\/[^/]+$/);

  // Closing by hand returns to the button
  await search.click();
  await palette.getByRole('button', { name: 'Close' }).click();
  await expect(search).toBeFocused();
});
