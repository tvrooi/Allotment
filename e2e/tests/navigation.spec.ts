import { test, expect, open, isoDay } from './fixtures';

// Every page opens from the sidebar and renders without errors (the console guard
// in fixtures.ts fails the test on any uncaught exception or console error).

const PAGES: { link: string; route: string; heading?: string }[] = [
  { link: 'Dashboard', route: '/dashboard' },
  { link: 'Accounts', route: '/accounts', heading: 'Accounts' },
  { link: 'Transactions', route: '/transactions', heading: 'Transactions' },
  { link: 'Budget', route: '/budget' },
  { link: 'Recurring', route: '/recurring', heading: 'Recurring' },
  { link: 'Reports', route: '/reports', heading: 'Reports' },
  { link: 'Cash flow', route: '/cash-flow', heading: 'Cash flow' },
  { link: 'Goals', route: '/goals', heading: 'Goals' },
  { link: 'Payees', route: '/payees', heading: 'Payees' },
  { link: 'Rules', route: '/rules', heading: 'Rules' },
  { link: 'Settings', route: '/settings', heading: 'Settings' },
];

test('a new budget starts on the welcome screen', async ({ page }) => {
  await open(page, '/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome to Allotment' })).toBeVisible();
  await expect(page).toHaveURL(/#\/welcome$/);
});

test('a link to another page opens that page, even before any accounts', async ({ page }) => {
  await open(page, '/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/settings$/);
});

test('every page opens from the sidebar', async ({ page, api }) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4_250,
    payeeName: 'Corner Grocery',
  });

  await open(page, '/dashboard');
  const nav = page.getByRole('complementary');
  const windowScrolls: string[] = [];
  for (const p of PAGES) {
    await nav.getByRole('link', { name: p.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${p.route}$`));
    if (p.heading) {
      await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible();
    }
    // Only the content area scrolls: the window itself never does (a second scroll bar
    // that scrolls the app off screen)
    await page.waitForLoadState('networkidle');
    const extra = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    if (extra > 0) windowScrolls.push(`${p.route} +${extra}px`);
  }
  expect(windowScrolls, 'pages where the whole window scrolls').toEqual([]);
});

test('the sidebar lists accounts with their balances and opens them', async ({ page, api }) => {
  await api.createAccount('Everyday Checking', 150_000);
  await api.createAccount('Rainy Day Savings', 1_000_000, 'savings');
  await open(page, '/dashboard');
  const nav = page.getByRole('complementary');
  await expect(nav.getByRole('link', { name: 'All accounts $11,500' })).toBeVisible();
  await nav.getByRole('button', { name: 'For budget $11,500' }).click();
  await expect(nav.getByRole('link', { name: /Everyday Checking.*\$1,500/ })).toBeVisible();
  await nav.getByRole('link', { name: /Rainy Day Savings/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rainy Day Savings' })).toBeVisible();
});

test('unknown routes inside the app fall back gracefully', async ({ page, api }) => {
  await api.createAccount('Everyday Checking');
  await open(page, '/');
  await expect(page).toHaveURL(/#\/dashboard$/);
});

test('auto-hidden navigation expands for keyboard focus and collapses after leaving', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday Checking');
  await open(page, '/dashboard');
  await page.getByRole('button', { name: 'Pin sidebar' }).click();
  await page.mouse.move(1000, 100);
  const sidebar = page.getByRole('complementary');
  const dashboard = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
  // Focus left on the pin by the click doesn't keep it open once the pointer leaves
  await expect(dashboard.locator('span')).toHaveCSS('opacity', '0');

  // Focus expands navigation even while the pointer stays outside it.
  await dashboard.focus();
  await expect(dashboard.locator('span')).toHaveCSS('opacity', '1');
  await sidebar.getByRole('link', { name: 'Transactions', exact: true }).press('Enter');
  await expect(page).toHaveURL(/#\/transactions$/);

  await page.getByRole('textbox', { name: 'Search payee or notes' }).focus();
  await expect(dashboard.locator('span')).toHaveCSS('opacity', '0');
});

test('Add a transaction is one click away, the folded sidebar included (#223)', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday Checking');
  await open(page, '/dashboard');
  const sidebar = page.getByRole('complementary');
  const add = sidebar.getByRole('button', { name: 'Add a transaction' });
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await add.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();

  // Unpinned, the rail still shows it (as an icon), and it still opens the dialog. (Keyboard
  // focus in the sidebar keeps it open, so leave it first.)
  await add.blur();
  await sidebar.getByRole('button', { name: 'Pin sidebar' }).click();
  await page.mouse.move(1000, 100);
  await expect(
    sidebar.getByRole('link', { name: 'Dashboard', exact: true }).locator('span'),
  ).toHaveCSS('opacity', '0');
  const box = (await add.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(64);
  await add.click();
  await expect(dialog).toBeVisible();
});

test('N opens Add transaction, but not while typing or with a dialog open (#223)', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday Checking');
  await open(page, '/transactions');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  const search = page.getByRole('textbox', { name: 'Search payee or notes' });
  await expect(search).toBeVisible();

  // Typing an n in a field is just typing
  await search.click();
  await page.keyboard.type('n');
  await expect(search).toHaveValue('n');
  await expect(dialog).toHaveCount(0);

  // With a modifier it belongs to the browser
  await page.getByRole('heading', { level: 1, name: 'Transactions' }).click();
  await page.keyboard.press('Alt+n');
  await expect(dialog).toHaveCount(0);

  // Another dialog open: n does nothing there
  await page.keyboard.press('?');
  const guides = page.getByRole('dialog').first();
  await expect(guides).toBeVisible();
  await page.keyboard.press('n');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // On the page itself it opens the dialog
  await page.keyboard.press('n');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeFocused();
});

test('Wave D: setup rows keep their places and explicit Hidden removes a row', async ({ page }) => {
  await open(page, '/settings?tab=preferences');
  const nav = page.getByRole('complementary').first();
  for (const name of ['Household', 'Tax time', 'Files']) {
    await expect(nav.getByRole('link', { name: name + ', set up', exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'More features (2)' })).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Files in the menu' })
    .getByRole('radio', { name: 'Hidden', exact: true })
    .click();
  await expect(nav.getByRole('link', { name: 'Files, set up', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'More features (3)' })).toBeVisible();
  await nav.getByRole('link', { name: 'Household, set up', exact: true }).click();
  await expect(page).toHaveURL(/#\/household$/);
  await expect(page.getByRole('button', { name: 'Set up a household', exact: true })).toBeVisible();
});
