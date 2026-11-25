import { test, expect, open, isoDay } from '../fixtures';
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

test('server search, Safe mode and offline messages fit 390 px', async ({ page, api }) => {
  await api.call('PUT', '/guides', { navFeatures: { files: 'shown' } });
  const account = await api.createAccount('Everyday Spending');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -1234,
    payeeName: 'Palette Coffee',
    notes:
      'Phone receipt: coffee and lunch with friends, including the extra takeaway order and the reusable cup deposit, paid together at the counter',
  });
  await open(page, '/dashboard');
  await expect(page.getByTestId('phone-header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main pages' })).toBeVisible();
  await page.getByTestId('phone-header').getByRole('button', { name: 'Search' }).click();
  const palette = page.getByRole('dialog', { name: 'Search' });
  await palette.getByRole('combobox').fill('Palette Coffee');
  const rows = palette.getByRole('group', { name: 'Transactions', exact: true });
  const row = rows.getByRole('option', { name: /^Palette Coffee/ });
  await expect(row).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.screenshot({ path: '../.ui-evidence/2026-11-12-palette-2/phone-payee.png' });
  // Exercise long text inside the palette without overflowing an unrelated Dashboard payee row.
  await palette.getByRole('combobox').fill('Phone receipt');
  await expect(row).toContainText(
    'including the extra takeaway order and the reusable cup deposit',
  );
  expect(await sidewaysOverflow(page)).toEqual([]);
  await palette.getByRole('combobox').fill('safe');
  await palette.getByRole('option', { name: 'Turn Safe mode on', exact: true }).click();
  await expect(palette).toBeHidden();
  await page.getByTestId('phone-header').getByRole('button', { name: 'Search' }).click();
  await palette.getByRole('combobox').fill('Palette Coffee');
  await expect(rows.getByRole('img', { name: 'Hidden', exact: true })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.screenshot({ path: '../.ui-evidence/2026-11-12-palette-2/phone-safe.png' });
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
  await palette.getByRole('combobox').fill('network disconnect');
  for (const name of ['Transactions', 'Files']) {
    const message = palette.getByRole('group', { name, exact: true }).getByRole('option');
    await expect(message).toHaveText('Not available offline');
    await expect(message).toHaveAttribute('aria-disabled', 'true');
  }
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.screenshot({ path: '../.ui-evidence/2026-11-12-palette-2/phone-offline.png' });
});
