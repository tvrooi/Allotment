import { test, expect, open, isoDay } from './fixtures';

// Recurring bills and shared costs reaching the right categories: Review → Check budget setup lists a
// recurring bill with no category, and a repayment you made for things someone else paid is
// offered the categories of what you owed them for. Disposable data only.

test('Check budget setup lists a recurring bill with no category', async ({ page, api }) => {
  const spending = await api.createAccount('Spending', 100_000);
  const dining = await api.category('Restaurants');
  const monthly = (name: string, categoryId?: string) =>
    api.call('POST', '/schedules', {
      name,
      amount: -1599,
      recurrenceType: 'monthly',
      startDate: isoDay(3),
      accountId: spending.id,
      categoryId,
    });
  await monthly('Streaming service');
  await monthly('Dinner club', dining.id);
  await open(page, '/review');
  await page.getByText('Check budget setup', { exact: true }).click();
  await expect(page.getByText('1 recurring bill has no category')).toBeVisible();
  const list = page.getByRole('list', { name: 'Recurring bills with no category' });
  await expect(list.getByText(/Streaming service/)).toBeVisible();
  await expect(list.getByText(/Dinner club/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Open Recurring' }).click();
  await expect(page).toHaveURL(/recurring\?filter=needs-category/);
});

test('offers a category for your repayment to someone, from what they paid', async ({
  page,
  api,
}) => {
  const spending = await api.createAccount('Spending', 100_000, 'checking', { currency: 'AUD' });
  const restaurants = await api.category('Restaurants');
  await api.call('POST', '/payees', { name: 'Corner Cafe', defaultCategoryId: restaurants.id });
  const group = await api.call('POST', '/households', {
    name: 'Friends',
    currency: 'AUD',
    people: ['Me', 'Sam'],
    selfIndex: 0,
  });
  const [me, sam] = ['Me', 'Sam'].map((n) => group.people.find((p: any) => p.name === n).id);
  // Sam paid for dinner; half of it was mine
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: isoDay(-5),
    description: 'Corner Cafe',
    amount: 4000,
    payerId: sam,
    shares: [me, sam].map((personId) => ({ personId, value: 1 })),
  });
  const payment = await api.createTransaction({
    accountId: spending.id,
    date: isoDay(-1),
    amount: -2000,
    payeeName: 'Sam',
  });
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'settlement',
    date: isoDay(-1),
    description: 'Paid Sam back',
    amount: 2000,
    payerId: me,
    recipientId: sam,
    transactionId: payment.id,
  });

  await open(page, `/household?household=${group.group.id}`);
  const offers = page.getByRole('region', { name: 'Categorise repayments' });
  await expect(offers.getByText(/Paid Sam back.*\(you paid\)/)).toBeVisible();
  await expect(offers.getByRole('combobox', { name: 'Category for Paid Sam back' })).toHaveValue(
    restaurants.id,
  );
  await offers.getByRole('button', { name: 'Categorise' }).click();
  await expect(offers).toHaveCount(0);
  const [row] = await api.transactions(`?accountId=${spending.id}`);
  expect(row.categoryId).toBe(restaurants.id);
});
