import type { Page } from '@playwright/test';
import { test, expect, open, isoDay } from './fixtures';

// The search palette (#224): shortcuts and cached destinations, plus read-only server search.

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const searchBox = (page: Page) => palette(page).getByRole('combobox');
const option = (page: Page, name: string | RegExp) => palette(page).getByRole('option', { name });

/** ⌘K / Ctrl+K once the page has loaded (the shortcut is the app's, so it needs the app) */
async function openPalette(page: Page) {
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  // A dialog still fading out counts as open, and the shortcut waits for it to go
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
}

let seeded: Awaited<ReturnType<typeof seed>>;
// Every test has a budget to search (an empty one opens on the welcome page)
test.beforeEach(async ({ api }) => {
  seeded = await seed(api);
});

async function seed(api: import('./fixtures').Api) {
  const everyday = await api.createAccount('Everyday Spending', 432_109);
  const groceries = await api.category('Groceries');
  await api.createTransaction({
    accountId: everyday.id,
    date: isoDay(0),
    amount: -4_250,
    payeeName: 'Daily Grind Coffee',
    categoryId: groceries.id,
  });
  await api.call('POST', '/goals', { name: 'Holiday fund', targetAmount: 200_000 });
  const payees = await api.call<{ id: string; name: string }[]>('GET', '/payees');
  const coffee = payees.find((p) => p.name === 'Daily Grind Coffee')!;
  return { everyday, groceries, coffee };
}

test('Ctrl+K opens it, Escape closes it and focus goes back to the opener', async ({ page }) => {
  await open(page, '/dashboard');
  const budgetLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
    name: 'Budget',
  });
  await budgetLink.focus();
  await openPalette(page);
  await expect(palette(page)).toBeVisible();
  await expect(searchBox(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();
  await expect(budgetLink).toBeFocused();

  // Even from a field: a held modifier isn't typing
  await open(page, '/payees');
  await page.getByPlaceholder('Search payees…').focus();
  await openPalette(page);
  await expect(palette(page)).toBeVisible();
});

test('/ opens it, but not while typing in a field', async ({ page }) => {
  await open(page, '/payees');
  const field = page.getByPlaceholder('Search payees…');
  await field.fill('ab');
  await field.press('/');
  await expect(field).toHaveValue('ab/');
  await expect(palette(page)).toBeHidden();

  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('/');
  await expect(palette(page)).toBeVisible();
  // Not a second time on top of itself
  await page.keyboard.press('/');
  await expect(searchBox(page)).toHaveValue('/');
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('arrow keys and Enter go to a page; the combobox follows the highlight', async ({ page }) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('rep');
  await expect(option(page, 'Reports')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(option(page, 'Reports')).toHaveAttribute('aria-selected', 'true');

  await searchBox(page).fill('');
  // Empty: pages in menu order, then actions. Down moves to the second page.
  await expect(option(page, 'Dashboard')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  const second = option(page, 'Accounts');
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await expect(searchBox(page)).toHaveAttribute(
    'aria-activedescendant',
    (await second.getAttribute('id'))!,
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  // Up from the first wraps to the last action
  await expect(option(page, 'Open guides and tips')).toHaveAttribute('aria-selected', 'true');

  await searchBox(page).fill('cash');
  await page.keyboard.press('Enter');
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/cash-flow$/);
});

test('an account, category, payee and goal each open their own view', async ({ page }) => {
  const { everyday, groceries, coffee } = seeded;
  await open(page, '/dashboard');

  const go = async (query: string, name: RegExp | string) => {
    await openPalette(page);
    await searchBox(page).fill(query);
    await option(page, name).click();
    await expect(palette(page)).toBeHidden();
  };

  await go('every', 'Everyday Spending');
  await expect(page).toHaveURL(new RegExp(`#/accounts/${everyday.id}$`));

  await go('groc', /^Groceries/);
  await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));

  await go('grind', /^Daily Grind Coffee · Transactions$/);
  await expect(page).toHaveURL(new RegExp(`#/transactions\\?.*payee_ids=${coffee.id}`));
  await expect(page.getByText('Daily Grind Coffee').first()).toBeVisible();

  await go('holi', 'Holiday fund');
  await expect(page).toHaveURL(/#\/goals$/);
  await expect(page.getByText('Holiday fund').first()).toBeVisible();
});

test('a search lists several groups, pages and actions first, and announces the count', async ({
  page,
}) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('d');
  const groups = palette(page).getByRole('group');
  await expect(groups.first()).toHaveAccessibleName('Pages');
  await expect(palette(page).getByRole('group', { name: 'Actions' })).toBeVisible();
  await expect(palette(page).getByRole('group', { name: 'Payees' })).toBeVisible();
  await expect(palette(page).getByRole('group', { name: 'Goals' })).toBeVisible();
  // At most five a group
  expect(
    await palette(page).getByRole('group', { name: 'Pages' }).getByRole('option').count(),
  ).toBeLessThanOrEqual(5);
  const count = await palette(page).getByRole('option').count();
  await expect(palette(page).getByRole('status')).toHaveText(`${count} results`);
  await searchBox(page).fill('zzzz');
  await expect(palette(page).getByText('Nothing matches “zzzz”.')).toBeVisible();
  await expect(palette(page).getByRole('status')).toHaveText('0 results');
});

test('Add a transaction opens the shared dialog', async ({ page }) => {
  await open(page, '/budget');
  await openPalette(page);
  await searchBox(page).fill('add');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await expect(dialog).toBeVisible();
  await expect(palette(page)).toBeHidden();
});

test('Wave D: a setup feature opens its own page', async ({ page }) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('house');
  const household = option(page, /^Household/);
  await expect(household).toContainText('Set up');
  await page.screenshot({ path: test.info().outputPath('palette-set-up.png') });
  await household.click();
  await expect(page).toHaveURL(/#\/household$/);
});

test('places visited from it come back as recents', async ({ page }) => {
  await open(page, '/dashboard');
  for (const [query, name] of [
    ['forec', 'Forecast'],
    ['every', 'Everyday Spending'],
  ] as const) {
    await openPalette(page);
    await searchBox(page).fill(query);
    await option(page, name).click();
    await expect(palette(page)).toBeHidden();
  }
  await page.reload();
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await openPalette(page);
  const recent = palette(page).getByRole('group', { name: 'Recent' }).getByRole('option');
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toHaveAccessibleName('Everyday Spending · Accounts');
  await expect(recent.nth(1)).toHaveAccessibleName('Forecast');
  // Remembered as names and paths, never amounts
  const stored = await page.evaluate(() => localStorage.getItem('flybudget:palette-recents'));
  expect(stored).not.toContain('4,321');
  expect(JSON.parse(stored!).items).toHaveLength(2);
});

test('the shortcuts are listed with the guides', async ({ page }) => {
  await open(page, '/dashboard');
  await page.getByRole('heading', { level: 1 }).first().click();
  await page.keyboard.press('?');
  const guides = page.getByRole('dialog', { name: 'Guides and tips' });
  const shortcuts = guides.getByRole('region', { name: 'Keyboard shortcuts' });
  await expect(shortcuts).toContainText(
    'Search pages, accounts, categories, payees, goals, transactions and files',
  );
  await expect(shortcuts).toContainText(/(Cmd|Ctrl)K/);
  await expect(shortcuts).toContainText('Add a transaction');
  await expect(shortcuts).toContainText('Turn Safe mode on or off');
  await page.keyboard.press('Escape');
  await expect(guides).toBeHidden();

  // Open guides from the palette lands on the same list
  await openPalette(page);
  await searchBox(page).fill('guides');
  await page.keyboard.press('Enter');
  await expect(guides).toBeVisible();
});

test('Safe mode: the palette shows no amounts, and it can switch Safe mode', async ({ page }) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('safe');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Safe mode' }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openPalette(page);
  await searchBox(page).fill('e');
  await expect(option(page, 'Everyday Spending')).toBeVisible();
  await expect(option(page, 'Turn Safe mode off')).toBeVisible();
  await expect(palette(page)).not.toContainText(/\$\s?\d/);
});

test('if its code can’t be fetched, the app stays up, says so, and the next open tries again', async ({
  page,
}) => {
  // The palette's own file can't be fetched (offline before it was ever loaded)
  const chunk = '**/assets/CommandPalette-*.js';
  await page.route(chunk, (route) => route.abort('internetdisconnected'));
  await open(page, '/budget');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.keyboard.press('ControlOrMeta+k');
  const notice = page.getByRole('dialog', { name: 'Search' });
  await expect(notice).toContainText('Search isn’t on this device yet');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toBeHidden();
  // The rest of the app carried on
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  // Reachable again: the next open fetches it
  await page.unroute(chunk);
  await openPalette(page);
  await expect(searchBox(page)).toBeFocused();
});

const group = (page: Page, name: string) => palette(page).getByRole('group', { name, exact: true });

test('one character does not search the server; payee results search all dates and open details', async ({
  page,
  api,
}) => {
  await api.createTransaction({
    accountId: seeded.everyday.id,
    date: '2020-01-02',
    amount: -12345,
    payeeName: 'Palette Merchant',
  });
  await open(page, '/dashboard');
  await openPalette(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (
      /\/api\/(transactions|files)$/.test(url.pathname) &&
      (url.searchParams.has('search') || url.searchParams.has('q'))
    )
      requests.push(r.url());
  });
  await searchBox(page).fill('p');
  await expect(
    group(page, 'Payees').getByRole('option', { name: /Palette Merchant/ }),
  ).toBeVisible();
  await searchBox(page).press('End');
  await expect(group(page, 'Transactions')).toHaveCount(0);
  await expect(group(page, 'Files')).toHaveCount(0);
  expect(requests).toEqual([]);
  await searchBox(page).fill('Palette Merchant');
  const tx = group(page, 'Transactions').getByRole('option', { name: /^Palette Merchant/ });
  await expect(tx).toContainText('Everyday Spending');
  await expect(tx).toContainText('2 Jan 2020');
  await expect(tx).toContainText('123.45');
  expect(requests.length).toBeGreaterThan(0);
  expect(
    requests.some(
      (url) =>
        new URL(url).searchParams.get('search') === 'p' ||
        new URL(url).searchParams.get('q') === 'p',
    ),
  ).toBe(false);
  await page.screenshot({ path: '../.ui-evidence/2026-11-12-palette-2/desktop-payee.png' });
  await group(page, 'Transactions')
    .getByRole('option', { name: 'See all in Transactions' })
    .click();
  await expect(page).toHaveURL(/range=all.*search=Palette\+Merchant/);
  await expect(
    page.getByTestId('transaction-row').filter({ hasText: 'Palette Merchant' }),
  ).toBeVisible();
  await openPalette(page);
  await searchBox(page).fill('Palette Merchant');
  await group(page, 'Transactions')
    .getByRole('option', { name: /^Palette Merchant/ })
    .click();
  await expect(page.getByRole('complementary', { name: 'Transaction details' })).toBeVisible();
  // Choosing another row with the same search URL opens details again, then consumes its state.
  await page
    .getByRole('complementary', { name: 'Transaction details' })
    .getByRole('button', { name: 'Done', exact: true })
    .click();
  await openPalette(page);
  await searchBox(page).fill('Palette Merchant');
  await group(page, 'Transactions')
    .getByRole('option', { name: /^Palette Merchant/ })
    .click();
  await expect(page.getByRole('complementary', { name: 'Transaction details' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => history.state?.usr?.transactionDetailId))
    .toBeUndefined();
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('Palette Merchant');
  expect(stored).not.toContain('12345');
});

for (const level of ['balances', 'all'] as const)
  test(`notes-only matches show notes; Safe mode hides transaction amounts (${level})`, async ({
    page,
    api,
  }) => {
    await page.addInitScript((safeModeLevel) => {
      localStorage.setItem(
        'budget-preferences',
        JSON.stringify({ state: { safeModeLevel, safeModeLevelChosen: true }, version: 4 }),
      );
    }, level);
    await api.createTransaction({
      accountId: seeded.everyday.id,
      date: isoDay(),
      amount: -6789,
      payeeName: 'Test Merchant',
      notes: 'Palette secret note',
    });
    await open(page, '/dashboard');
    await openPalette(page);
    await searchBox(page).fill('secret note');
    const row = group(page, 'Transactions').getByRole('option', { name: /^Test Merchant/ });
    await expect(row).toContainText('Palette secret note');
    await expect(row).not.toContainText('Everyday Spending');
    await expect(row).toContainText('67.89');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Hide balances (Safe mode)', exact: true }).click();
    await openPalette(page);
    await searchBox(page).fill('secret note');
    await expect(row.getByRole('img', { name: 'Hidden', exact: true })).toBeVisible();
    await expect(row).not.toContainText('67.89');
    await page.screenshot({
      path: `../.ui-evidence/2026-11-12-palette-2/desktop-safe-${level}.png`,
    });
  });

test('file results open the file', async ({ page, api }) => {
  await open(page, '/files');
  await page.getByLabel('Add files: choose files').setInputFiles({
    name: 'palette-warranty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Item,Serial\nFridge,AB-123\n'),
  });
  await expect(page.getByRole('button', { name: 'Open palette-warranty.csv' })).toBeVisible();
  const {
    documents: [file],
  } = await api.call<{ documents: { id: string }[] }>('GET', '/files');
  await openPalette(page);
  await searchBox(page).fill('palette-warranty');
  await group(page, 'Files')
    .getByRole('option', { name: /^palette-warranty.csv/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`file=${file.id}`));
  await expect(
    page.getByRole('dialog', { name: 'palette-warranty.csv', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('flybudget:palette-recents'))).toBeNull();
});

test('offline groups are unavailable while cached pages still work after warming the chunk', async ({
  page,
}) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await page.keyboard.press('Escape');
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
  // A new page asks for data, so the shared connection state learns the server is gone.
  await page.evaluate(() => {
    location.hash = '#/files';
  });
  await expect(page.getByRole('status', { name: 'Connection' })).toContainText(
    "Can't reach Allotment",
  );
  await page.route('**/assets/**', (route) => route.abort('internetdisconnected'));
  await openPalette(page);
  await searchBox(page).fill('dashboard');
  for (const name of ['Transactions', 'Files']) {
    const message = group(page, name).getByRole('option');
    await expect(message).toHaveText('Not available offline');
    await expect(message).toHaveAttribute('aria-disabled', 'true');
    // Send the click to exercise the guard: Playwright's click waits for aria-disabled to clear.
    await message.dispatchEvent('click');
    await message.press('Enter');
    await expect(palette(page)).toBeVisible();
  }
  await page.screenshot({ path: '../.ui-evidence/2026-11-12-palette-2/desktop-offline.png' });
  await option(page, 'Dashboard').click();
  await expect(page).toHaveURL(/#\/dashboard$/);
});

test('a split notes match shows the matching child note on its parent result', async ({
  page,
  api,
}) => {
  await api.call('POST', '/transactions', {
    accountId: seeded.everyday.id,
    date: '2020-01-02',
    amount: -3000,
    payeeName: 'Corner Store',
    splits: [
      { categoryId: seeded.groceries.id, amount: -1000, notes: 'Weekly food' },
      { categoryId: null, amount: -2000, notes: 'Palette split warranty' },
    ],
  });
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('split warranty');
  const row = group(page, 'Transactions').getByRole('option', { name: /^Corner Store/ });
  await expect(row).toContainText('2 Jan 2020 · Palette split warranty');
  await expect(row).not.toContainText('Everyday Spending');
});

test('a linked transfer has the same directional name in the palette and register', async ({
  page,
  api,
}) => {
  const savings = await api.createAccount('Rainy Day Savings');
  const debit = await api.createTransaction({
    accountId: seeded.everyday.id,
    date: '2020-01-02',
    amount: -1000,
    notes: 'Palette savings move',
  });
  const credit = await api.createTransaction({
    accountId: savings.id,
    date: '2020-01-02',
    amount: 1000,
  });
  await api.call('POST', '/transactions/transfers/link', {
    transactionId: debit.id,
    otherTransactionId: credit.id,
  });
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('savings move');
  // A search can match one side only, so the server lists it with its direction, not as a pair.
  const label = 'Transfer to Rainy Day Savings';
  await expect(
    group(page, 'Transactions').getByRole('option', { name: new RegExp(`^${label}`) }),
  ).toBeVisible();
  await group(page, 'Transactions')
    .getByRole('option', { name: 'See all in Transactions' })
    .click();
  await expect(page.getByTestId('transaction-row').filter({ hasText: label })).toBeVisible();
});

test('Files loading and failure are unavailable, then no matches omit the group', async ({
  page,
}) => {
  test.info().annotations.push({
    type: 'allow-page-errors',
    description: 'Expected mocked HTTP 422 file search failure',
  });
  await open(page, '/files');
  await openPalette(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/files?**', async (route) => {
    await held;
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Mock file search failure' }),
    });
  });
  await searchBox(page).fill('Daily Grind');
  await expect(group(page, 'Files').getByRole('option', { name: 'Searching…' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  release();
  await expect(group(page, 'Files').getByRole('option', { name: 'Search failed' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(
    group(page, 'Transactions').getByRole('option', { name: /^Daily Grind/ }),
  ).toBeVisible();
  await page.unroute('**/api/files?**');
  const response = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return url.pathname === '/api/files' && url.searchParams.get('q') === 'No matching file';
  });
  await searchBox(page).fill('No matching file');
  expect((await response).ok()).toBe(true);
  await expect(group(page, 'Files')).toHaveCount(0);
});

test('a Files feature marked Set up omits the server group and never asks for files', async ({
  page,
}) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('files');
  await expect(group(page, 'Pages').getByRole('option', { name: /^Files/ })).toContainText(
    'Set up',
  );
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/files') requests.push(r.url());
  });
  await searchBox(page).fill('Daily Grind');
  await expect(
    group(page, 'Transactions').getByRole('option', { name: /^Daily Grind/ }),
  ).toBeVisible();
  await expect(group(page, 'Files')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('loading and failure are unavailable; changing the query removes the old rows', async ({
  page,
}) => {
  // A real JSON error keeps the connection online and is isolated to its group.
  test.info().annotations.push({
    type: 'allow-page-errors',
    description: 'Expected mocked HTTP 422 search failure',
  });
  await open(page, '/files');
  await openPalette(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/transactions?**', async (route) => {
    await held;
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Mock search failure' }),
    });
  });
  await searchBox(page).fill('Daily Grind');
  await expect(
    group(page, 'Transactions').getByRole('option', { name: 'Searching…' }),
  ).toHaveAttribute('aria-disabled', 'true');
  release();
  await expect(
    group(page, 'Transactions').getByRole('option', { name: 'Search failed' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(group(page, 'Payees').getByRole('option', { name: /^Daily Grind/ })).toBeVisible();
  await page.unroute('**/api/transactions?**');
  await searchBox(page).fill('Coffee');
  await expect(
    group(page, 'Transactions').getByRole('option', { name: /^Daily Grind/ }),
  ).toBeVisible();
  await searchBox(page).fill('No matching transaction');
  await expect(
    group(page, 'Transactions').getByRole('option', { name: /^Daily Grind/ }),
  ).toHaveCount(0);
  await expect(group(page, 'Transactions')).toHaveCount(0);
});

test('Wave D: explicitly hidden Files is not searched and opens Preferences', async ({
  page,
  api,
}) => {
  await api.call('PUT', '/guides', { navFeatures: { files: 'hidden' } });
  await open(page, '/dashboard');
  await openPalette(page);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/files') requests.push(request.url());
  });
  await searchBox(page).fill('Daily Grind');
  await expect(
    group(page, 'Transactions').getByRole('option', { name: /^Daily Grind/ }),
  ).toBeVisible();
  await expect(group(page, 'Files')).toHaveCount(0);
  expect(requests).toEqual([]);
  await searchBox(page).fill('files');
  await option(page, /^Files/).click();
  await expect(page).toHaveURL(/#\/settings\?tab=preferences$/);
});
