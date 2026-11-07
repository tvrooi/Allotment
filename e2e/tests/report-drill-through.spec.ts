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
