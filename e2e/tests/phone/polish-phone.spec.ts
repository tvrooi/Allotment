import type { Locator, Page } from '@playwright/test';
import { test, expect, open, isoDay } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// First-week polish on a phone (390×844): the reconcile screen, the budget header, tab bars
// that scroll sideways, and the category list in the add-transaction sheet.

const WIDTH = 390;

async function box(locator: Locator) {
  return (await locator.boundingBox())!;
}

test('the reconcile list fills the screen under the summary', async ({ page, api }) => {
  const acct = await api.createAccount('Everyday', 100_000);
  for (const [i, payee] of ['Corner Grocery', 'Streamflix', 'City Power & Light'].entries())
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(-i),
      amount: -(2_000 + i * 500),
      payeeName: payee,
    });
  await open(page, `/accounts/${acct.id}/reconcile`);
  await page.getByRole('textbox', { name: 'Statement balance' }).fill('900');
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();

  const table = page.getByRole('table');
  await expect(table.getByRole('row', { name: /Corner Grocery/ })).toBeVisible();
  const list = await box(table);
  // The list is as wide as the screen, not squeezed beside the summary
  expect(list.width).toBeGreaterThanOrEqual(WIDTH * 0.9);
  const summary = await box(page.getByText('Selected Balance'));
  expect(summary.y, 'summary is above the list').toBeLessThan(list.y);
  // Payee names are readable, and the buttons are reachable
  const payee = await box(table.getByText('Corner Grocery'));
  expect(payee.width).toBeGreaterThan(80);
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
});

test.describe('the budget header', () => {
  test('is short, keeps one menu for the rest, and finds Groceries in two taps', async ({
    page,
    api,
  }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    const header = page.getByTestId('budget-header');
    await expect(header).toBeVisible();
    // Everything above the categories, tip included, fits in a fifth of the screen
    await expect(page.getByRole('status', { name: 'Ready to assign' })).toBeVisible();
    expect((await box(header)).height).toBeLessThanOrEqual(200);
    const tip = page.getByText(/No assignments for/);
    const bottom = (await box(tip)).y + (await box(tip)).height;
    expect(bottom).toBeLessThanOrEqual(300);

    // Year, Auto-assign and Until next payday are in one menu
    await expect(page.getByRole('link', { name: 'Year', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Auto-assign' })).toHaveCount(0);
    await page.getByRole('button', { name: 'More budget actions' }).click();
    const menu = page.getByRole('menu');
    for (const name of ['Year', 'Auto-assign', 'Until next payday'])
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Auto-assign' }).click();
    await expect(page.getByRole('dialog', { name: 'Auto-assign' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // Month buttons look like buttons
    for (const name of ['Previous month', 'Next month']) {
      const border = await page
        .getByRole('button', { name })
        .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
      expect(border).toBeGreaterThan(0);
    }

    // Tap 1: the search field. Tap 2: the category.
    await page.getByRole('searchbox', { name: 'Find a category' }).fill('Groc');
    const planned = page.getByRole('button', { name: /^Planned for Groceries:/ });
    await expect(planned).toBeInViewport();
    expect(await sidewaysOverflow(page)).toEqual([]);
    await planned.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('"Until next payday" opens from the menu', async ({ page, api }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    await page.getByRole('button', { name: 'More budget actions' }).click();
    await page.getByRole('menuitem', { name: 'Until next payday' }).click();
    await expect(page.getByRole('heading', { name: 'Until next payday' })).toBeVisible();
  });
});

/** Every tab is whole (its label isn't cut), and the bar says when more is off screen */
async function expectTabsReadable(page: Page, bar: Locator, tabs: Locator) {
  await expect(bar.getByTestId('scroll-cue-right')).toBeVisible();
  await expect(bar.getByTestId('scroll-cue-left')).toHaveCount(0);
  const scroller = bar.getByTestId('scroll-cue-scroller');
  const count = await tabs.count();
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    await tab.scrollIntoViewIfNeeded();
    // The label fits its button...
    const clipped = await tab.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, `tab ${i} label is cut`).toBe(false);
    // ...and the button sits inside the bar (no half tab at the edge)
    const t = await box(tab);
    const s = await box(scroller);
    expect(t.x).toBeGreaterThanOrEqual(s.x - 1);
    expect(t.x + t.width).toBeLessThanOrEqual(s.x + s.width + 1);
  }
  // At the far end the cue has turned round
  await expect(bar.getByTestId('scroll-cue-right')).toHaveCount(0);
  await expect(bar.getByTestId('scroll-cue-left')).toBeVisible();
}

test('the Transactions period tabs show they scroll, and none is cut off', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/transactions');
  const tabs = page.getByRole('button', {
    name: /^(This Month|Last Month|Last 3 Months|This Year|All Time|Custom)$/,
  });
  const bar = page.getByTestId('scroll-cue').first();
  await expectTabsReadable(page, bar, tabs);
});

test('the Settings tabs show they scroll, and none is cut off', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/settings');
  const bar = page.getByTestId('scroll-cue').first();
  const tabs = bar.locator('button');
  await expectTabsReadable(page, bar, tabs);
});

test('the category list in Add transaction is as wide as its field', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/transactions');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByRole('button', { name: /^Category:/ });
  await field.click();
  const search = page.getByRole('textbox', { name: 'Search categories' });
  await expect(search).toBeVisible();
  const picker = search.locator('xpath=ancestor::div[contains(@class,"shadow-lg")][1]');
  const f = await box(field);
  const p = await box(picker);
  expect(Math.round(p.width)).toBeGreaterThanOrEqual(Math.round(f.width) - 1);
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(WIDTH);
});
