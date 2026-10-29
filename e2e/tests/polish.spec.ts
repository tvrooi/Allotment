import { test, expect, open, isoDay, thisMonth } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

// First-week polish (UX phase 3): fewer clicks on everyday screens.

/** A day in the previous calendar month, as yyyy-MM-dd */
function lastMonthDay(day = 15) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const readyToAssign = (page: import('@playwright/test').Page) =>
  page.getByRole('status', { name: 'Ready to assign' });

test.describe('not categorised yet', () => {
  test('lists exactly what Reports counts as uncategorised', async ({ page, api }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    for (const [payee, amount] of [
      ['Mystery A', -1_000],
      ['Mystery B', -2_000],
      ['Mystery C', -3_000],
      ['Odd deposit', 5_000],
    ] as const)
      await api.createTransaction({
        accountId: acct.id,
        date: isoDay(0),
        amount,
        payeeName: payee,
      });
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(0),
      amount: -4_000,
      payeeName: 'Market',
      categoryId: groceries.id,
    });

    await open(page, '/transactions');
    await page.getByRole('button', { name: 'Filters' }).click();
    // First in the Categories list, above every category
    const categories = page.getByRole('group', { name: /Categories/ });
    await expect(categories.getByRole('checkbox').first()).toHaveAccessibleName(
      'Not categorised yet',
    );
    await categories.getByRole('checkbox', { name: 'Not categorised yet' }).check();

    const summary = await api.call<{
      uncategorisedSpendingCount: number;
      uncategorisedIncomeCount: number;
    }>('GET', `/reports/uncategorised-summary?from=${thisMonth()}-01&to=${thisMonth()}-31`);
    const reportsCount = summary.uncategorisedSpendingCount + summary.uncategorisedIncomeCount;
    expect(reportsCount).toBe(4);
    await expect(page.getByText(`${reportsCount} transactions`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Market', exact: true })).toHaveCount(0);

    // It is in the URL, so a reload keeps it; choosing a category replaces it
    await page.reload();
    await expect(page.getByText('4 transactions', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('checkbox', { name: 'Groceries' }).check();
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
  });

  test('a new budget calls its catch-all category "Other"', async ({ api }) => {
    const names = (await api.categoryGroups()).flatMap((g) => g.categories.map((c) => c.name));
    expect(names).toContain('Other');
    expect(names).not.toContain('Uncategorized');
  });
});

test.describe('last month', () => {
  test('Transactions: groceries last month in three interactions', async ({ page, api }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: acct.id,
      date: lastMonthDay(),
      amount: -4_250,
      payeeName: 'Market',
      categoryId: groceries.id,
    });
    await api.createTransaction({
      accountId: acct.id,
      date: lastMonthDay(16),
      amount: -1_000,
      payeeName: 'Bakery',
    });
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(0),
      amount: -9_900,
      payeeName: 'Market this month',
      categoryId: groceries.id,
    });
    await open(page, '/transactions');
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    // 1: the period. 2 and 3: the search box
    await page.getByRole('button', { name: 'Last Month', exact: true }).click();
    await expect(page.getByText('2 transactions', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Search payee or notes…').fill('Market');
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Market', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Market this month' })).toHaveCount(0);
  });

  test('Reports has a Last Month preset', async ({ page, api }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/reports');
    const preset = page.getByRole('button', { name: 'Last Month', exact: true });
    await preset.click();
    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Last Month', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('a month before the budget start shows its real activity, read-only', async ({
    page,
    api,
  }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: acct.id,
      date: lastMonthDay(),
      amount: -4_250,
      payeeName: 'Market',
      categoryId: groceries.id,
    });
    await api.call('PUT', '/budget/start', { month: thisMonth() });

    await open(page, '/budget');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'before your budget start' }),
    ).toContainText('Activity is what you really spent');
    await page.getByRole('searchbox', { name: 'Find a category' }).fill('Groceries');
    const row = page.getByRole('row', { name: /Groceries/ });
    await expect(row).toContainText('$42.50');
    // Nothing to assign to: the planned amount can't be opened for editing
    await row.getByRole('button', { name: /^Planned for Groceries/ }).click();
    await expect(page.getByRole('textbox', { name: 'Planned for Groceries' })).toHaveCount(0);
  });
});

test.describe('the budget page', () => {
  test('finds a category by name, inactive ones included', async ({ page, api }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    const find = page.getByRole('searchbox', { name: 'Find a category' });
    await find.fill('groc');
    await expect(page.getByRole('button', { name: /^Planned for Groceries:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Planned for Rent/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear category search' }).click();
    await expect(find).toHaveValue('');
  });

  test('a brand-new budget lists every category until something has been assigned', async ({
    page,
    api,
  }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    await expect(page.getByRole('button', { name: /^Planned for Rent/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Show \d+ inactive/ })).toHaveCount(0);

    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 10_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: /^Planned for Groceries:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Show \d+ inactive/ }).first()).toBeVisible();
  });

  test('"Put the rest in…" assigns everything that is ready', async ({ page, api }) => {
    await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    await open(page, '/budget');
    await expect(readyToAssign(page)).toContainText('$1,000');

    await page.getByRole('button', { name: 'Put the rest in…' }).click();
    const search = page.getByRole('textbox', { name: 'Search categories' });
    await expect(search).toBeFocused();
    // No "Uncategorized" here: the money has to go somewhere
    await expect(page.getByRole('button', { name: 'Uncategorized' })).toHaveCount(0);
    await search.fill('Groceries');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Put $1,000 in Groceries.')).toBeVisible();
    await expect(readyToAssign(page)).toContainText('$0');
    const groups = await api.call<any[]>('GET', `/budget/${thisMonth()}`);
    const cat = groups.flatMap((g) => g.categories).find((c) => c.id === groceries.id);
    expect(cat.budgeted).toBe(100_000);
    // Nothing left to put anywhere
    await expect(page.getByRole('button', { name: 'Put the rest in…' })).toHaveCount(0);
  });

  test('explains Ready to assign, the anchor payday and funding rules in plain words', async ({
    page,
    api,
  }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    await expect(readyToAssign(page)).toContainText("Money you have that isn't in a category yet.");
    await page.getByRole('button', { name: 'What is Ready to assign?' }).click();
    await expect(page.getByRole('note')).toContainText('haven’t given a job yet'.replace('’', "'"));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('note')).toHaveCount(0);

    await page.getByRole('button', { name: 'Until next payday' }).click();
    await page.getByRole('button', { name: 'New payday plan' }).click();
    await expect(page.getByLabel('Anchor payday')).toBeVisible();
    await page.getByRole('button', { name: 'How to choose the payday date' }).click();
    await expect(page.getByRole('note')).toContainText('Pick any one day you were paid');
    await page.getByRole('button', { name: 'What is a funding rule?' }).click();
    await expect(page.getByRole('note')).toContainText('Each rule is a category');
  });
});

test.describe('category picker from the keyboard', () => {
  test('arrows move, Enter picks the highlighted match, Escape closes', async ({ page, api }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(0),
      amount: -1_000,
      payeeName: 'Mystery A',
    });
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(0),
      amount: -2_000,
      payeeName: 'Mystery B',
    });
    await open(page, `/accounts/${acct.id}`);
    const pickerFor = async (payee: string) => {
      await page
        .getByTestId('transaction-row')
        .filter({ hasText: payee })
        .getByRole('button', { name: '—' })
        .click();
      const search = page.getByRole('textbox', { name: 'Search categories' });
      await expect(search).toBeFocused();
      return search;
    };

    // Type to narrow; the first match is highlighted, so Enter picks it
    const search = await pickerFor('Mystery A');
    await search.fill('Groceries');
    await expect(page.locator('[data-active="true"]')).toContainText('Groceries');
    await page.keyboard.press('Enter');
    await expect
      .poll(
        async () => (await api.transactions()).find((t) => t.payeeName === 'Mystery A').categoryId,
      )
      .toBe(groceries.id);

    // Arrow down moves to the next match, arrow up back
    const again = await pickerFor('Mystery B');
    await again.fill('e');
    const active = page.locator('[data-active="true"] span.truncate');
    const first = (await active.innerText()).trim();
    await page.keyboard.press('ArrowDown');
    await expect(active).not.toHaveText(first);
    const second = (await active.innerText()).trim();
    await page.keyboard.press('ArrowUp');
    await expect(active).toHaveText(first);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => {
        const id = (await api.transactions()).find((t) => t.payeeName === 'Mystery B').categoryId;
        return (await api.categoryGroups()).flatMap((g) => g.categories).find((c) => c.id === id)
          ?.name;
      })
      .toBe(second);
  });

  test('Escape closes the list and changes nothing', async ({ page, api }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(0),
      amount: -1_000,
      payeeName: 'Mystery A',
    });
    await open(page, `/accounts/${acct.id}`);
    await page.getByTestId('transaction-row').getByRole('button', { name: '—' }).click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Gro');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Search categories' })).toHaveCount(0);
    expect((await api.transactions())[0].categoryId).toBeNull();
  });
});

test.describe('the recurring finder', () => {
  test('offers bills, not transfers, cash or refunds, and keeps Create in view', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 500_000);
    const now = new Date();
    const series = (payeeName: string, amount: number) =>
      Promise.all(
        [4, 3, 2, 1].map((i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 5);
          const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`;
          return api.createTransaction({ accountId: checking.id, date, amount, payeeName });
        }),
      );
    await series('MusicBox', -1_299);
    await series('Transfer to Emergency fund', -50_000);
    await series('ATM Withdrawal Westpac', -10_000);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(-120),
      amount: -12_000,
      payeeName: 'JB Hi-Fi',
    });
    await series('JB Hi-Fi', 4_900);

    await page.setViewportSize({ width: 1400, height: 700 });
    await open(page, '/recurring');
    await page.getByRole('main').getByRole('button', { name: 'Find recurring' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search for recurring transactions' });
    await expect(dialog.getByRole('checkbox', { name: 'Track MusicBox' })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /Track Transfer/ })).toHaveCount(0);
    await expect(dialog.getByRole('checkbox', { name: /Track ATM/ })).toHaveCount(0);
    await expect(dialog.getByRole('checkbox', { name: /Track JB Hi-Fi/ })).toHaveCount(0);

    await dialog.getByRole('checkbox', { name: 'Track MusicBox' }).press('Space');
    const create = dialog.getByRole('button', { name: 'Create 1 recurring' });
    await expect(create).toBeInViewport();
  });
});

test.describe('dates follow the browser language', () => {
  test.use({ locale: 'en-AU' });

  test('en-AU shows day/month/year', async ({ page, api }) => {
    const acct = await api.createAccount('Everyday', 100_000);
    await api.createTransaction({
      accountId: acct.id,
      date: `${thisMonth()}-05`,
      amount: -1_000,
      payeeName: 'Corner Grocery',
    });
    await open(page, `/accounts/${acct.id}`);
    const [y, m] = thisMonth().split('-');
    await expect(page.getByText(`05/${m}/${y}`).first()).toBeVisible();
  });
});

test.describe('reconcile starts from the bank balance', () => {
  test('a bank-linked account fills in what the bank says', async ({ page, api }) => {
    await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
    await freshUpWindow(page, api, 8);
    await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
    await api.call('POST', '/up/map-accounts', {
      mappings: [
        { upAccountId: 'spending', action: 'create' },
        { upAccountId: 'saver', action: 'create' },
      ],
    });
    await api.call('POST', '/up/sync');
    const status = await api.call<{ accountId: string; bankBalance: number | null }[]>(
      'GET',
      '/accounts/sync-status',
    );
    const linked = status.find((s) => s.bankBalance !== null)!;
    expect(linked).toBeTruthy();

    await open(page, `/accounts/${linked.accountId}/reconcile`);
    const balance = page.getByRole('textbox', { name: 'Statement balance' });
    const dollars = (Math.abs(linked.bankBalance!) / 100).toLocaleString('en-US', {
      minimumFractionDigits: linked.bankBalance! % 100 ? 2 : 0,
    });
    await expect(balance).toHaveValue(new RegExp(dollars.replace('.', '\\.')));
    await expect(page.getByText("Filled in from the bank's balance")).toBeVisible();
  });

  test('a manual account starts empty', async ({ page, api }) => {
    const acct = await api.createAccount('Manual', 12_345);
    await open(page, `/accounts/${acct.id}/reconcile`);
    await expect(page.getByRole('textbox', { name: 'Statement balance' })).toHaveValue('');
    await expect(page.getByText("Filled in from the bank's balance")).toHaveCount(0);
  });
});
