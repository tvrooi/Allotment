import { test, expect, open, isoDay } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// WebKit verifies the Safari engine, not iOS's native Home Screen compositor. Chromium's
// safe-area override exercises real env() padding without replacing the app's CSS.
for (const [width, height] of [
  [430, 932],
  [430, 740],
  [932, 430],
]) {
  test(`iPhone web app stays usable at ${width}×${height}`, async ({
    page,
    api,
    browserName,
  }, testInfo) => {
    const account = await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -4250,
      payeeName: 'Corner Grocery',
      categoryId: groceries.id,
    });
    await page.setViewportSize({ width, height });
    const insets =
      width > height
        ? { top: 0, bottom: 21, left: 59, right: 59 }
        : { top: height === 932 ? 59 : 0, bottom: 34, left: 0, right: 0 };
    if (browserName === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
    }
    await open(page, '/dashboard');
    await expect(page.getByTestId('home-card-summary')).toBeVisible();
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(0);
    expect(await sidewaysOverflow(page)).toEqual([]);
    if (width < 768) {
      const header = page.getByTestId('phone-header');
      await expect(header).toHaveCSS('position', 'sticky');
      await expect(header).toHaveCSS('filter', 'none');
      await expect(header).toHaveCSS('backdrop-filter', 'none');
      await expect(header).toHaveCSS('opacity', '1');
      await expect(header).toHaveCSS('isolation', 'isolate');
      const background = await header.evaluate((e) => getComputedStyle(e).backgroundColor);
      await expect(page.locator('html')).toHaveCSS('background-color', background);
      if (browserName === 'chromium')
        await expect(header).toHaveCSS('padding-top', `${insets.top}px`);
      const menu = page.getByRole('button', { name: 'Open menu', exact: true });
      const menuBox = (await menu.boundingBox())!;
      expect(menuBox.height).toBeGreaterThanOrEqual(44);
      expect(menuBox.width).toBeGreaterThanOrEqual(44);
      expect(menuBox.y).toBeGreaterThanOrEqual(browserName === 'chromium' ? insets.top : 0);
      await menu.click();
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
      await expect(menu).toBeFocused();
      const headerTop = (await header.boundingBox())!.y;
      const comparison = page.getByRole('group', { name: 'Compare spending with' });
      await comparison.scrollIntoViewIfNeeded();
      expect((await header.boundingBox())!.y).toBe(headerTop);
    }
    await page.screenshot({ path: testInfo.outputPath('phone-iphone-dashboard.png') });

    await open(page, '/transactions');
    const row = page
      .getByTestId(width < 768 ? 'transaction-card' : 'transaction-row')
      .filter({ hasText: 'Corner Grocery' });
    await expect(row).toBeVisible();
    const search = page.getByRole('textbox', { name: 'Search payee or notes', exact: true });
    if (width < 768) {
      expect(
        await search.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await search.fill('Corner');
    await expect(row).toBeVisible();
    await page.getByRole('button', { name: /^Filters/ }).click();
    const filters = page.getByRole('region', { name: 'Advanced filters' });
    await expect(filters).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeInViewport({ ratio: 0.8 });
    expect(await sidewaysOverflow(page)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('phone-iphone-transactions.png') });
  });
}

// UAT G-03-1: on the owner's iPhone the Date field ran past the sheet's right edge, level with
// nothing. iOS sizes a native date input by its value, which a flex column does not shrink. This
// runs in the phone (Chromium) and iphone-webkit (WebKit) projects; neither draws iOS Safari's
// native date control, so it guards the geometry rather than proving the iOS-only overflow.
test('Add transaction keeps its Date field inside the sheet', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/transactions');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  // The native date input, named by its label
  const date = dialog.getByRole('textbox', { name: 'Date', exact: true });
  const amount = dialog.getByRole('textbox', { name: 'Amount' });
  await expect(date).toBeVisible();
  const d = (await date.boundingBox())!;
  const a = (await amount.boundingBox())!;
  // Ends no further right (and starts no further left) than the Amount field above it
  expect(d.x + d.width, 'Date ends past Amount').toBeLessThanOrEqual(a.x + a.width + 1);
  expect(d.x, 'Date starts before Amount').toBeGreaterThanOrEqual(a.x - 1);
  expect(await sidewaysOverflow(page)).toEqual([]);
});
