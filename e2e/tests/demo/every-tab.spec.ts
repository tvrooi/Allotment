import { test as base, expect, type Page } from '@playwright/test';
import { categoryOption } from '../fixtures';

// The demo's sample records (server/src/demo/demoBudget.ts, loaded through their services by
// loadDemoBudget.ts): every tab has something to explore, including the receipts and files the
// demo's worker keeps in its own database.

const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await use();
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

async function openDemo(page: Page, route: string) {
  await page.goto(`/demo/#${route}`);
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
}

/** An image has loaded (through the demo's API, as a blob address) */
const loaded = (page: Page, name: string) =>
  expect
    .poll(() =>
      page
        .getByRole('img', { name })
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);

test('a saved receipt opens with its photo, and its items can be categorised', async ({ page }) => {
  await openDemo(page, '/transactions');
  await page.getByRole('tab', { name: 'Receipts' }).click();
  await page.getByText('Costwise Warehouse').first().click();
  const editor = page.getByRole('dialog', { name: 'Receipt' });
  await loaded(page, 'costwise-receipt.jpg');
  // Its items start Uncategorised: give the coffee (item 2) one, save, and it stays
  await expect(editor.getByLabel('Item 2', { exact: true })).toHaveValue('Coffee beans 1kg');
  await editor.getByRole('button', { name: /^Item 2 category: / }).click();
  await categoryOption(editor, 'Groceries', { exact: true }).click();
  await editor.getByRole('button', { name: 'Save' }).click();
  await editor.getByRole('button', { name: 'Close' }).first().click();
  await page.getByText('Costwise Warehouse').first().click();
  await expect(
    page
      .getByRole('dialog', { name: 'Receipt' })
      .getByRole('button', { name: 'Item 2 category: Groceries', exact: true }),
  ).toBeVisible();
});

test('Files lists the sample receipts and documents, photos included', async ({ page }) => {
  await openDemo(page, '/files');
  await expect(page.getByText('shieldwell-certificate-of-insurance.pdf')).toBeVisible();
  await expect(page.getByText('threadline-return.txt')).toBeVisible();
  await expect(page.getByText('woolies-receipt.jpg')).toBeVisible();
  // The storage panel counts them all
  await expect(
    page.getByRole('complementary', { name: 'File views' }).getByText(/· 7 files$/),
  ).toBeVisible();
});

test('the household, tax time, pay later and the long-term plan are set up', async ({ page }) => {
  await openDemo(page, '/household');
  await expect(page.getByText('Harbour St house').first()).toBeVisible();
  await expect(page.getByText(/Alex owes \$40\.15/).first()).toBeVisible();

  await openDemo(page, '/tax');
  await expect(page.getByText('D9 Gifts or donations')).toBeVisible();
  await page.getByRole('tab', { name: 'Assets' }).click();
  await expect(page.getByText('Laptop (Sam)').first()).toBeVisible();

  await openDemo(page, '/payment-plans');
  await expect(page.getByText('Threadline').first()).toBeVisible();

  await openDemo(page, '/forecast');
  await expect(page.getByText('Buying a home').first()).toBeVisible();
});
