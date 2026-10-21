import { test, expect, open, isoDay, thisMonth } from './fixtures';
for (const phone of [false, true]) {
  test(`rollover, refunds, cover and undo${phone ? ' on phone' : ''}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Opening cash', 100000);
    const food = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    const month = thisMonth();
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    const prior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    await api.call('PUT', `/budget/${prior}/${food.id}`, { budgeted: 60000 });
    await api.call('PUT', `/budget/${month}/${food.id}`, { budgeted: 10000 });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -50000,
      categoryId: food.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 5000,
      categoryId: food.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -5000,
      categoryId: rent.id,
    });
    expect(await api.call('GET', `/budget/${month}/summary`)).toMatchObject({
      toBeBudgeted: 25000,
      overspent: 5000,
      resolved: false,
    });
    await open(page, '/budget');
    const row = phone
      ? page.getByTestId('budget-card').filter({ hasText: 'Groceries' })
      : page.locator('tr').filter({ hasText: 'Groceries' });
    await expect(row).toContainText('$250');
    await expect(row).toContainText('-$450');
    await page.getByRole('button', { name: 'Move money / Cover overspending' }).click();
    await page.getByLabel('Move from').selectOption(food.id);
    await page.getByLabel('Move to').selectOption(rent.id);
    await page.getByLabel('Move amount').fill('50');
    await page.getByRole('button', { name: 'Preview move' }).click();
    await expect(page.getByRole('region', { name: 'Money move preview' })).toContainText(
      'From available after move: $200',
    );
    await page.getByRole('button', { name: 'Apply move' }).click();
    await expect(page.getByText('Money moved.', { exact: true })).toBeVisible();
    await expect(row).toContainText('$200');
    expect((await api.call('GET', `/budget/${month}/summary`)).overspent).toBe(0);
    await page.getByText('Money move history', { exact: true }).click();
    await page.getByRole('button', { name: 'Undo move', exact: true }).click();
    await expect(row).toContainText('$250');
    await row.getByRole('link').first().click();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await expect(page.getByText('$250', { exact: true }).first()).toBeVisible();
  });
}
