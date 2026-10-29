import { test, expect, open, isoDay, thisMonth } from './fixtures';
import type { Page } from '@playwright/test';

// Safe mode hides balances and totals while someone helps with the budget. The figures must
// not be on the page at all, not just blurred.

// Balances, then a budget assignment and a transaction: Safe mode starts on "All amounts"
const FIGURES = ['4,321', '87,654', '12,345', '16,666', '104,321', '103,808', '512.34', '55.55'];

async function expectNoBalances(page: Page) {
  // Wait for the page to draw before reading it
  await expect(page.locator('main')).not.toBeEmpty();
  const text = await page.locator('body').innerText();
  const html = await page.content();
  for (const figure of FIGURES) {
    expect(text).not.toContain(figure);
    expect(html).not.toContain(figure);
  }
}

test.describe('Safe mode', () => {
  test.beforeEach(async ({ api }) => {
    await api.createAccount('Everyday', 432_109, 'checking');
    await api.createAccount('Rainy day', 1_234_567, 'savings');
    await api.createAccount('Super', 8_765_432, 'retirement');
    // Ready to assign is a budget figure and stays visible: assigning some keeps it from
    // matching the cash total
    const rent = await api.category('Rent / Mortgage');
    await api.call('PUT', `/budget/${thisMonth()}/${rent.id}`, { budgeted: 51_234 });
  });

  test('hides balances and totals on every page that shows them', async ({ page, api }) => {
    await open(page, '/accounts');
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByText('$104,321.08')).toBeVisible();

    await sidebar.getByRole('button', { name: 'Safe mode' }).click();
    await expect(sidebar.getByRole('button', { name: 'Safe mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('img', { name: 'Hidden' }).first()).toBeVisible();
    await expectNoBalances(page);
    await page.screenshot({ path: test.info().outputPath('safe-mode-accounts.png') });

    const [everyday] = await api.accounts();
    // Each page shows that something is hidden once it has loaded, then has no figure on it
    const hiddenAmount = page.getByRole('img', { name: 'Hidden' }).first();
    const hiddenPart = (title: string) => page.getByText(title, { exact: true });
    for (const [route, loaded] of [
      ['/dashboard', hiddenAmount],
      [`/accounts/${everyday.id}`, hiddenAmount],
      ['/investments', hiddenPart('Investments are hidden in Safe mode')],
      ['/forecast', hiddenPart('Forecasts are hidden in Safe mode')],
      ['/reports', hiddenPart('Net worth is hidden in Safe mode')],
      ['/review', hiddenAmount],
    ] as const) {
      await open(page, route);
      await expect(loaded).toBeVisible();
      await expectNoBalances(page);
    }

    // By default Safe mode hides every amount, so a friend sees none on the pages that matter
    await api.createTransaction({
      accountId: everyday.id,
      date: isoDay(0),
      amount: -5_555,
      payeeName: 'Groceries',
    });
    for (const [route, loaded] of [
      ['/transactions', page.getByText('Groceries').first()],
      ['/budget', page.getByRole('status', { name: 'Ready to assign' })],
      ['/dashboard', hiddenAmount],
      [`/accounts/${everyday.id}`, page.getByText('Groceries').first()],
    ] as const) {
      await open(page, route);
      // The transaction was added after these pages were last drawn
      await page.reload();
      await expect(loaded).toBeVisible();
      await expectNoBalances(page);
    }
  });

  test('stays on after a reload and is off again in a new session', async ({ page }) => {
    await open(page, '/accounts');
    await expect(page.getByRole('complementary').getByText('$104,321.08')).toBeVisible();
    await page.keyboard.press('Alt+Shift+H');
    await expect(
      page.getByRole('complementary').getByRole('button', { name: 'Safe mode' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expectNoBalances(page);

    // Closing the app ends the session: a new window or tab shows balances again
    const fresh = await page.context().newPage();
    await open(fresh, '/accounts');
    await expect(fresh.getByRole('complementary').getByText('$104,321.08')).toBeVisible();
    await fresh.close();
  });

  test('keeps a level the owner chose, and shows the rest again without it', async ({ page }) => {
    await open(page, '/settings?tab=preferences');
    const section = page.getByRole('region', { name: 'Safe mode' });
    // Nobody chose: every amount is hidden
    await expect(section.getByRole('radio', { name: /All amounts/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await section.getByRole('radio', { name: /Balances and totals/ }).click();
    await page.reload();
    await expect(
      page
        .getByRole('region', { name: 'Safe mode' })
        .getByRole('radio', { name: /Balances and totals/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('can hide every amount, transactions included', async ({ page, api }) => {
    const [everyday] = await api.accounts();
    await api.createTransaction({
      accountId: everyday.id,
      date: isoDay(0),
      amount: -5_555,
      payeeName: 'Groceries',
    });
    await open(page, '/settings?tab=preferences');
    const section = page.getByRole('region', { name: 'Safe mode' });
    await section.getByRole('radio', { name: /All amounts/ }).click();
    await section.getByRole('button', { name: 'On', exact: true }).click();

    await open(page, '/transactions');
    await expect(page.getByText('Groceries').first()).toBeVisible();
    await expectNoBalances(page);
    expect(await page.locator('body').innerText()).not.toContain('55.55');

    await page.keyboard.press('Alt+Shift+H');
    await expect(page.getByText('-$55.55').first()).toBeVisible();

    // Switching on in place hides the amounts without remounting the page, so anything typed
    // but not saved stays: the page's own elements are still the same ones
    await page.locator('main').evaluate((el) => (el.dataset.probe = 'kept'));
    await page.getByRole('complementary').getByRole('button', { name: 'Safe mode' }).click();
    await expect(page.getByText('-$55.55')).toHaveCount(0);
    await expect(page.locator('main[data-probe="kept"]')).toHaveCount(1);
  });
});
