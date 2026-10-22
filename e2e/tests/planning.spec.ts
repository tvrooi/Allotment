import { test, expect, open, isoDay } from './fixtures';

// Phase 8 planning views on mock data: merchant breakdown, the annual overview and goal
// navigation derived from the goal's category.

test('Cash Flow groups spending by merchant with the same total and drills into it', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Checking');
  const groceries = await api.category('Groceries');
  const dining = await api.category('Restaurants');
  const income = await api.category('Paychecks');
  for (const tx of [
    { amount: 200_000, payeeName: 'Mock payroll', categoryId: income.id },
    { amount: -12_000, payeeName: 'Mock grocer', categoryId: groceries.id },
    { amount: -4_500, payeeName: 'Mock cafe', categoryId: dining.id },
  ])
    await api.createTransaction({ accountId: account.id, date: isoDay(), ...tx });

  await open(page, '/cash-flow');
  await page.getByRole('button', { name: '1M', exact: true }).click();
  await expect(page.getByText('91.8%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Merchants', exact: true }).click();
  const merchants = page.getByRole('list', { name: 'Merchants' });
  await expect(merchants.getByRole('button')).toHaveCount(2);
  await expect(merchants.getByRole('button').first()).toContainText('Mock grocer');
  await expect(page.getByText('$165 total')).toBeVisible();

  await merchants.getByRole('button', { name: /Mock grocer/ }).click();
  const list = page.getByRole('region', { name: 'Transactions: Mock grocer' });
  await expect(list).toContainText('1 transaction');
  await expect(list).not.toContainText('Mock cafe');
  await list.page().getByRole('link', { name: 'Open in Transactions' }).click();
  await expect(page).toHaveURL(/payee_ids=/);
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
});

test('the annual overview sums months, keeps plans apart and opens a month', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 100_000);
  const groceries = await api.category('Groceries');
  const now = new Date();
  const month = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  await api.call('PUT', `/budget/${month(0)}/${groceries.id}`, { budgeted: 15_000 });
  // A plan for next month, when it is still this year
  const planned = month(1).startsWith(String(now.getFullYear()));
  if (planned) await api.call('PUT', `/budget/${month(1)}/${groceries.id}`, { budgeted: 5_000 });

  await open(page, '/budget');
  await page.getByRole('link', { name: 'Year', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${now.getFullYear()} budget` })).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Groceries' }) });
  await expect(row).toContainText(planned ? '$200' : '$150');
  await expect(row).toContainText('$150'); // available at the end of this month, not summed
  if (planned) {
    await expect(page.getByText('Planned for later months').locator('..')).toContainText('$50');
  }
  await page
    .getByRole('button', {
      name: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleString('en-US', {
        month: 'short',
      }),
    })
    .click();
  await expect(page).toHaveURL(/#\/budget$/);
});

test('a category-funded goal links to its category and transactions', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100_000);
  const holiday = await api.category('Groceries');
  await api.call('POST', '/goals', {
    name: 'Mock holiday',
    targetAmount: 200_000,
    categoryId: holiday.id,
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -2_500,
    payeeName: 'Mock deposit',
    categoryId: holiday.id,
  });

  await open(page, '/goals');
  await expect(page.getByRole('link', { name: 'Assign or move money' })).toHaveAttribute(
    'href',
    new RegExp(`/budget/category/${holiday.id}$`),
  );
  await page.getByRole('main').getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page).toHaveURL(/category_ids=/);
  await page.getByTestId('transaction-row').filter({ hasText: 'Mock deposit' }).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel.getByText(/Its category funds/)).toContainText('Mock holiday');
});
