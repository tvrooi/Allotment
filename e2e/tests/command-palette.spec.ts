import type { Page } from '@playwright/test';
import { test, expect, open, isoDay } from './fixtures';

// The search palette (issue #224, first part): ⌘K / Ctrl+K and / open it from any page; it
// finds pages, actions, accounts, categories, payees and goals from what the app already holds.

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const searchBox = (page: Page) => palette(page).getByRole('combobox');
const option = (page: Page, name: string | RegExp) => palette(page).getByRole('option', { name });

/** ⌘K / Ctrl+K once the page has loaded (the shortcut is the app's, so it needs the app) */
async function openPalette(page: Page) {
  await page.getByRole('heading', { level: 1 }).first().waitFor();
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

  await go('grind', /^Daily Grind Coffee/);
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

test('a feature the sidebar leaves out is listed as Set up', async ({ page }) => {
  await open(page, '/dashboard');
  await openPalette(page);
  await searchBox(page).fill('house');
  const household = option(page, /^Household/);
  await expect(household).toContainText('Set up');
  await page.screenshot({ path: test.info().outputPath('palette-set-up.png') });
  await household.click();
  await expect(page).toHaveURL(/#\/settings\?tab=preferences$/);
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
  await expect(shortcuts).toContainText('Search pages, accounts, categories, payees and goals');
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
