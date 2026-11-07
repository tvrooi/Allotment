import { test, expect, open, isoDay } from './fixtures';

// UX audit AU-014: a category's total in Spending by category was plain text, so checking a
// surprising number meant rebuilding its filters on Transactions. Each category now opens
// the transactions behind its total (same category, months and budget scope), and they add
// up to it: a split counts only its part, a refund counts against it, a transfer not at all.

function previousMonthDay() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

for (const phone of [false, true]) {
  test(`a spending total opens the transactions that make it up${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const checking = await api.createAccount('Checking', 500_000);
    const savings = await api.createAccount('Savings', 0, 'savings');
    const groceries = await api.category('Groceries');
    const dining = await api.category('Restaurants');
    const tx = (data: object) =>
      api.createTransaction({ accountId: checking.id, date: isoDay(), ...data } as never);
    await tx({ amount: -4_000, payeeName: 'Market', categoryId: groceries.id });
    await tx({
      amount: -10_000,
      payeeName: 'Big Shop',
      splits: [
        { categoryId: groceries.id, amount: -6_000 },
        { categoryId: dining.id, amount: -4_000 },
      ],
    });
    await tx({ amount: 1_000, payeeName: 'Market refund', categoryId: groceries.id });
    await tx({
      amount: -2_000,
      payeeName: 'Old shop',
      categoryId: groceries.id,
      date: previousMonthDay(),
    });
    await tx({ amount: -300, payeeName: 'Unknown merchant', categoryId: null });
    await api.call('POST', '/transactions/transfer', {
      fromAccountId: checking.id,
      toAccountId: savings.id,
      date: isoDay(),
      amount: 5_000,
    });

    // The Spending by category detail, for this month (the dashboard's default range)
    await open(page, '/reports');
    await expect(page.getByText('Spending by category', { exact: true }).first()).toBeVisible();
    const [board] = await api.call<{ id: string }[]>('GET', '/dashboards');
    const widgets = await api.call<{ id: string; type: string }[]>(
      'GET',
      `/dashboards/${board.id}/widgets`,
    );
    const spending = widgets.find((w) => w.type === 'spending')!;
    await open(page, `/reports/widget/${spending.id}`);
    // $40 + the $60 part of the split − the $10 refund
    const row = page.getByRole('row').filter({ hasText: 'Groceries' });
    await expect(row).toContainText('$90');

    await row.getByRole('link', { name: 'View transactions: Groceries' }).click();
    await expect(page).toHaveURL(/transactions/);
    const main = page.getByRole('main');
    for (const payee of ['Market', 'Big Shop', 'Market refund'])
      await expect(main.getByText(payee, { exact: true }).first()).toBeVisible();
    for (const payee of ['Old shop', 'Unknown merchant'])
      await expect(main.getByText(payee, { exact: true })).toHaveCount(0);
    // The register's own total agrees with the report's
    await expect(main.getByText(/^Net\s*[−-]\$90(\.00)?$/)).toBeVisible();

    // Back returns to the report, and the uncategorised total opens its own transactions
    await page.goBack();
    await expect(page.getByRole('row').filter({ hasText: 'Groceries' })).toContainText('$90');
    await page.getByRole('link', { name: 'View transactions: Uncategorised' }).click();
    await expect(main.getByText('Unknown merchant', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Market', { exact: true })).toHaveCount(0);
  });
}

// A custom report's Name/Amount table: each row opens the transactions behind it. Spending
// there is every negative row (a refund isn't netted off), so the register shows it the same
// way, and a link followed with unsaved settings asks before leaving them.
test('a custom report table row opens the transactions that make it up', async ({ page, api }) => {
  const checking = await api.createAccount('Checking', 500_000);
  const groceries = await api.category('Groceries');
  const dining = await api.category('Restaurants');
  const tx = (data: object) =>
    api.createTransaction({ accountId: checking.id, date: isoDay(), ...data } as never);
  await tx({ amount: -4_000, payeeName: 'Market', categoryId: groceries.id });
  await tx({
    amount: -10_000,
    payeeName: 'Big Shop',
    splits: [
      { categoryId: groceries.id, amount: -6_000 },
      { categoryId: dining.id, amount: -4_000 },
    ],
  });
  await tx({ amount: 1_000, payeeName: 'Market refund', categoryId: groceries.id });
  await tx({
    amount: -2_000,
    payeeName: 'Old shop',
    categoryId: groceries.id,
    date: previousMonthDay(),
  });
  const month = isoDay().slice(0, 7);
  const report = await api.call<{ id: string }>('POST', '/custom-reports', {
    name: 'Spending table',
    config: {
      chartType: 'table',
      mode: 'total',
      groupBy: 'category',
      balanceType: 'expense',
      dateRange: { preset: 'custom', from: month, to: month },
      filters: { accountIds: [], categoryIds: [], categoryGroupIds: [] },
    },
  });

  // On the dashboard, where the table sits in a card that opens the report when clicked, the
  // link still goes to Transactions
  await open(page, '/reports');
  await page.getByRole('link', { name: 'View transactions: Groceries' }).click();
  await expect(page).toHaveURL(/transactions/);
  await expect(page.getByRole('main').getByText(/^Net\s*[−-]\$100(\.00)?$/)).toBeVisible();

  await open(page, `/reports/custom/${report.id}`);
  // $40 + the $60 part of the split; the refund is income, not counted against it
  const row = page.getByRole('row').filter({ hasText: 'Groceries' });
  await expect(row).toContainText('$100');
  await row.getByRole('link', { name: 'View transactions: Groceries' }).click();
  await expect(page).toHaveURL(/transactions/);
  const main = page.getByRole('main');
  for (const payee of ['Market', 'Big Shop'])
    await expect(main.getByText(payee, { exact: true }).first()).toBeVisible();
  for (const payee of ['Market refund', 'Old shop'])
    await expect(main.getByText(payee, { exact: true })).toHaveCount(0);
  await expect(main.getByText(/^Net\s*[−-]\$100(\.00)?$/)).toBeVisible();

  // With unsaved settings, the link asks first; Keep editing stays, Discard follows it
  await page.goBack();
  await page.getByRole('button', { name: 'Net' }).click();
  const link = page.getByRole('link', { name: 'View transactions: Groceries' });
  await expect(page.getByRole('row').filter({ hasText: 'Groceries' })).toContainText('$90');
  await link.click();
  const prompt = page.getByRole('alert').filter({ hasText: 'Leave without saving this report?' });
  await prompt.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page).toHaveURL(/reports\/custom/);
  await link.click();
  await prompt.getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(/transactions/);
  await expect(main.getByText('Market refund', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(/^Net\s*[−-]\$90(\.00)?$/)).toBeVisible();
});
