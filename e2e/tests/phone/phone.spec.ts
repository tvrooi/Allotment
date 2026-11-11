import type { Page, TestInfo } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// Allotment on a phone-sized screen (390×844, the "phone" project in
// playwright.config.ts). Every page is visited with realistic data, a screenshot is
// saved (test-results/…/phone-*.png, uploaded by CI), and nothing may make the page
// scroll sideways: neither the document nor the main content area.

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`phone-${name}.png`), fullPage: true });
}

test('every page fits a phone screen', async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  const checking = await api.createAccount('Everyday Checking', 250_000);
  await api.createAccount('Rainy Day Savings', 1_000_000, 'savings');
  const groceries = await api.category('Groceries');
  for (const [i, payee] of ['Corner Grocery', 'Coffee Corner', 'City Power & Light'].entries()) {
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(-i),
      amount: -(4_250 + i * 1_000),
      payeeName: payee,
      categoryId: i === 0 ? groceries.id : null,
      notes: i === 2 ? 'Monthly electricity bill with a fairly long note' : undefined,
    });
  }
  await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
  await api.call('POST', '/schedules', {
    name: 'Rent',
    amount: -150_000,
    recurrenceType: 'monthly',
    startDate: isoDay(2),
    accountId: checking.id,
  });
  await api.call('POST', '/rules', {
    conditions: [{ field: 'payee_name', op: 'contains', value: 'grocery' }],
    actions: [{ type: 'set_category', value: groceries.id }],
  });
  await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });

  const routes: [string, string][] = [
    ['dashboard', '/dashboard'],
    ['accounts', '/accounts'],
    ['account', `/accounts/${checking.id}`],
    ['reconcile', `/accounts/${checking.id}/reconcile`],
    ['transactions', '/transactions'],
    ['budget', '/budget'],
    ['budget-category', `/budget/category/${groceries.id}`],
    ['budget-year', '/budget/year'],
    ['recurring', '/recurring'],
    ['reports', '/reports'],
    ['custom-report', '/reports/custom'],
    ['cash-flow', '/cash-flow'],
    ['goals', '/goals'],
    ['payees', '/payees'],
    ['rules', '/rules'],
    ['settings', '/settings'],
    ['files', '/files'],
  ];

  const problems: string[] = [];
  for (const [name, route] of routes) {
    await open(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await screenshot(page, testInfo, name);
    const overflow = await sidewaysOverflow(page);
    if (overflow.length) problems.push(`${route}: ${overflow.join('; ')}`);
  }
  expect(problems, 'pages that scroll sideways on a phone').toEqual([]);
});

test('the welcome screen fits a phone screen', async ({ page }, testInfo) => {
  await open(page, '/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome to Allotment' })).toBeVisible();
  await screenshot(page, testInfo, 'welcome');
  expect(await sidewaysOverflow(page)).toEqual([]);
});

test('the sidebar is a drawer behind a menu button', async ({ page, api }) => {
  await api.createAccount('Everyday Checking', 150_000);
  await open(page, '/dashboard');

  // The page gets the full width; the navigation is hidden until asked for
  const menu = page.getByRole('button', { name: 'Open menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  // (The tab bar has a Budget link of its own: the drawer's is the one that's hidden)
  const drawerBudget = page.locator('#app-sidebar').getByRole('link', {
    name: 'Budget',
    exact: true,
  });
  await expect(drawerBudget).toBeHidden();
  const mainBox = await page.getByRole('main').boundingBox();
  expect(mainBox!.width).toBeGreaterThanOrEqual(389);

  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('complementary');
  await expect(nav.getByRole('link', { name: 'Budget', exact: true })).toBeVisible();
  // Focus moves into the drawer
  await expect(nav.locator(':focus')).toHaveCount(1);

  // Escape closes it and puts focus back on the menu button
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await expect(drawerBudget).toBeHidden();

  // Following a link closes it
  await menu.click();
  await nav.getByRole('link', { name: 'Budget', exact: true }).click();
  await expect(page).toHaveURL(/#\/budget$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('status', { name: 'Ready to assign' })).toBeVisible();

  // So does the close button
  await menu.click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});

test('the tab bar reaches the everyday pages and Add (#225)', async ({ page, api }, testInfo) => {
  await api.createAccount('Everyday Checking', 150_000);
  await open(page, '/dashboard');
  const tabs = page.getByRole('navigation', { name: 'Main pages' });
  const home = tabs.getByRole('link', { name: 'Home' });
  await expect(home).toHaveAttribute('aria-current', 'page');

  for (const [name, route] of [
    ['Transactions', '/transactions'],
    ['Budget', '/budget'],
    ['Review', '/review'],
    ['Home', '/dashboard'],
  ]) {
    const tab = tabs.getByRole('link', { name, exact: true });
    await tab.click();
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(await sidewaysOverflow(page), route).toEqual([]);
  }

  // Every tab is a full-size touch target, and the bar sits below the page, not over it
  for (const item of await tabs.locator('a, button').all()) {
    const box = (await item.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  const main = (await page.getByRole('main').boundingBox())!;
  const bar = (await tabs.boundingBox())!;
  expect(main.y + main.height).toBeLessThanOrEqual(bar.y + 1);
  await screenshot(page, testInfo, 'tab-bar');

  // The centre Add opens Add transaction, ready for the amount
  await tabs.getByRole('button', { name: 'Add a transaction' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Behind the open drawer the tab bar can't be reached
  await page.getByRole('button', { name: 'Open menu' }).click();
  expect(await tabs.evaluate((el) => !!el.closest('[inert]'))).toBe(true);
  await page.keyboard.press('Escape');
  expect(await tabs.evaluate((el) => !!el.closest('[inert]'))).toBe(false);
});

test('adding a transaction works on a phone', async ({ page, api }) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  const form = page.getByRole('form', { name: 'New transaction' });
  await form.getByRole('textbox', { name: 'Payee' }).fill('Corner Grocery');
  await form.getByRole('textbox', { name: 'Outflow' }).fill('12.34');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByTestId('transaction-card').filter({ hasText: 'Corner Grocery' }),
  ).toBeVisible();
  await expect.poll(() => api.balance(account.id)).toBe(150_000 - 1_234);
});

// Roomier navigation must not squeeze the account list out of short drawers.
test('account links stay reachable in a short drawer', async ({ page, api }) => {
  const account = await api.createAccount('Short screen checking', 150_000);
  await page.setViewportSize({ width: 390, height: 640 });
  await open(page, '/dashboard');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const drawer = page.getByRole('complementary');
  await expect(drawer.getByRole('link', { name: 'Settings', exact: true })).toBeInViewport();
  const group = drawer.getByRole('button', { name: /For budget/ });
  await group.scrollIntoViewIfNeeded();
  await group.click();
  const link = drawer.getByRole('link', { name: /Short screen checking/ });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#/accounts/${account.id}$`));
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
