import { test, expect, open, thisMonth } from './fixtures';

for (const phone of [false, true])
  test(`category targets suggest funding that is applied only after review${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Target cash', 50000);
    const insurance = await api.category('Groceries');
    await api.call('PUT', `/budget/category/${insurance.id}/target`, {
      type: 'monthly',
      amount: 80000,
    });
    await open(page, `/budget/category/${insurance.id}`);
    const form = page.getByRole('form', { name: 'Category target' });
    await expect(form).toContainText('Needs $800 more');
    await form.getByLabel('Target type').selectOption('refill');
    await form.getByLabel('Target amount').fill('300');
    await form.getByRole('button', { name: 'Save target' }).click();
    await expect(form).toContainText('Needs $300 more');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);

    await open(page, '/budget');
    if (phone) {
      await page.getByRole('button', { name: 'More budget actions' }).click();
      await page.getByRole('menuitem', { name: 'Fund targets (1)' }).click();
    } else {
      await page.getByRole('button', { name: 'Fund targets (1)' }).click();
    }
    const preview = page.getByRole('region', { name: 'Target funding preview' });
    await expect(preview).toContainText('$500 is unassigned today');
    await expect(preview).toContainText('assign $300');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);
    await preview.getByRole('button', { name: 'Apply $300' }).click();
    await expect(preview).toBeHidden();
    await expect
      .poll(async () => (await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted)
      .toBe(30000);
    await expect(page.getByRole('button', { name: /Fund targets/ })).toHaveCount(0);
    await expect(page.getByText('Target funded').first()).toBeVisible();
  });
