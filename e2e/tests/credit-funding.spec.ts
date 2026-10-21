import { test, expect, open, isoDay, thisMonth } from './fixtures';
for (const phone of [false, true])
  test(`card setup, payment funding and linked repayment${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const cash = await api.createAccount('Everyday cash', 100000),
      card = await api.createAccount('Visa', -20000, 'credit');
    const food = await api.category('Groceries');
    const before = await api.transactions();
    await open(page, '/budget');
    await page.getByRole('button', { name: 'Card payment funding', exact: true }).click();
    await page.getByRole('button', { name: 'Review setup for Visa' }).click();
    const setup = page.getByRole('region', { name: 'Card setup preview' });
    await expect(setup).toContainText('Unassigned before: $800');
    await expect(setup).toContainText('Unassigned after: $1,000');
    await expect(setup).toContainText('Existing debt: $200');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).resources).toBe(80000);
    await page.getByRole('button', { name: 'Confirm card setup' }).click();
    await expect(page.getByText('Card payment reserves enabled.', { exact: true })).toBeVisible();
    expect(await api.transactions()).toEqual(before);
    await page.getByRole('button', { name: 'Adjust payment funding for Visa' }).click();
    await page.getByLabel('Payment funding amount').fill('200');
    await page.getByRole('button', { name: 'Preview payment funding' }).click();
    const funding = page.getByRole('region', { name: 'Payment funding preview' });
    await expect(funding).toContainText('Payment reserve after: $200');
    await expect(funding).toContainText('Unassigned after: $800');
    await page.getByRole('button', { name: 'Apply payment funding' }).click();
    await expect(page.getByText('Card payment funding updated.', { exact: true })).toBeVisible();
    await api.call('PUT', `/budget/${thisMonth()}/${food.id}`, { budgeted: 10000 });
    await api.createTransaction({
      accountId: card.id,
      amount: -8000,
      date: isoDay(),
      categoryId: food.id,
      payeeName: 'Grocery on card',
    });
    let state = await api.call('GET', `/budget/${thisMonth()}/summary`);
    expect(state).toMatchObject({
      resources: 100000,
      paymentReserved: 28000,
      paymentShortfall: 0,
      toBeBudgeted: 70000,
    });
    const out = await api.createTransaction({
      accountId: cash.id,
      amount: -8000,
      date: isoDay(),
      payeeName: 'Card repayment',
    });
    const into = await api.createTransaction({
      accountId: card.id,
      amount: 8000,
      date: isoDay(),
      payeeName: 'Payment received',
    });
    await api.call('POST', '/transactions/transfers/link', {
      transactionId: out.id,
      otherTransactionId: into.id,
    });
    state = await api.call('GET', `/budget/${thisMonth()}/summary`);
    expect(state).toMatchObject({
      resources: 92000,
      paymentReserved: 20000,
      paymentShortfall: 0,
      toBeBudgeted: 70000,
    });
    await page.reload();
    const foodRow = phone
      ? page.getByTestId('budget-card').filter({ hasText: 'Groceries' })
      : page.getByRole('row').filter({ hasText: 'Groceries' });
    await expect(foodRow).toContainText('$20');
    await expect(foodRow).toContainText('-$80');
    await page.getByRole('button', { name: 'Card payment funding', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Card payment funding', exact: true });
    await expect(panel).toContainText('Cash reserved for payment: $200');
    await page.getByText('Payment funding history', { exact: true }).click();
    await expect(panel).toContainText(`${isoDay()}: Visa $200`);
  });
