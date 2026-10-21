import { test, expect, open, isoDay, thisMonth } from './fixtures';

for (const phone of [false, true])
  test(`review card setup, funded purchases, repayments and debt funding${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const cash = await api.createAccount('Cash', 100000);
    const card = await api.createAccount('Daily card', 0, 'credit');
    const food = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${food.id}`, { budgeted: 10000 });
    await open(page, '/budget');
    await page.getByRole('button', { name: 'Review Daily card setup' }).click();
    const dialog = page.getByRole('dialog', { name: 'Review card payment funding' });
    await dialog.getByRole('button', { name: 'Preview card setup' }).click();
    await expect(dialog.getByRole('status')).toContainText('Existing debt: $0');
    await dialog.getByRole('button', { name: 'Enable payment funding' }).click();
    await expect(dialog).toBeHidden();
    const purchase = await api.createTransaction({
      accountId: card.id,
      date: isoDay(),
      amount: -8000,
      categoryId: food.id,
      payeeName: 'Market',
    });
    await page.reload();
    const position = page.getByTestId('card-payment').filter({ hasText: 'Daily card' });
    await expect(position).toContainText('Available for payment: $80');
    await expect(position).toContainText('Payment shortfall: $0');
    const row = phone
      ? page.getByTestId('budget-card').filter({ hasText: 'Groceries' })
      : page.locator('tr').filter({ hasText: 'Groceries' });
    await expect(row).toContainText('$20');
    const repayment = await api.createTransaction({
      accountId: cash.id,
      date: isoDay(),
      amount: -8000,
      payeeName: 'Card payment',
    });
    const receipt = await api.createTransaction({
      accountId: card.id,
      date: isoDay(),
      amount: 8000,
      payeeName: 'Payment received',
    });
    await api.call('POST', '/transactions/transfers/link', {
      transactionId: repayment.id,
      otherTransactionId: receipt.id,
    });
    await page.reload();
    await expect(position).toContainText('Available for payment: $0');
    await expect(position).toContainText('Debt: $0');
    expect((await api.transactions()).find((t: any) => t.id === purchase.id).amount).toBe(-8000);
    await api.createTransaction({
      accountId: card.id,
      date: isoDay(),
      amount: -5000,
      payeeName: 'Uncategorised card charge',
    });
    await page.reload();
    await expect(position).toContainText('Payment shortfall: $50');
    await position.getByRole('button', { name: 'Fund debt' }).click();
    await position.getByLabel('Additional funding for Daily card').fill('50');
    await position.getByRole('button', { name: 'Preview funding' }).click();
    await expect(position.getByRole('status')).toContainText(
      'Payment availability after assignment: $50',
    );
    await position.getByRole('button', { name: 'Assign payment funds' }).click();
    await expect(position).toContainText('Available for payment: $50');
    await expect(position).toContainText('Payment shortfall: $0');
    await page.screenshot({
      path: test.info().outputPath(`card-payment${phone ? '-phone' : ''}.png`),
      fullPage: true,
    });
  });

test('existing debt setup is reviewed, does not rewrite transactions, and stale previews conflict', async ({
  api,
}) => {
  await api.createAccount('Cash', 100000);
  const card = await api.createAccount('Existing card', -50000, 'credit');
  const old = await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -1000,
    payeeName: 'Existing purchase',
  });
  const preview = await api.call('POST', `/budget/card-funding/${card.id}/preview`, {
    initialFunding: 20000,
  });
  expect(preview.card).toMatchObject({ debt: 51000, available: 20000, shortfall: 31000 });
  expect((await api.call('GET', '/budget/card-funding/accounts')).cards).toEqual([]);
  await api.createAccount('More cash', 1000);
  await expect(api.call('POST', `/budget/card-funding/${card.id}/apply`, preview)).rejects.toThrow(
    /409/,
  );
  const fresh = await api.call('POST', `/budget/card-funding/${card.id}/preview`, {
    initialFunding: 20000,
  });
  await api.call('POST', `/budget/card-funding/${card.id}/apply`, fresh);
  expect((await api.transactions()).find((t: any) => t.id === old.id)).toMatchObject({
    amount: -1000,
    payeeName: 'Existing purchase',
  });
  const summary = await api.call('GET', `/budget/${thisMonth()}/summary`);
  expect(summary).toMatchObject({ paymentShortfall: 31000, resources: 101000, resolved: false });
});
