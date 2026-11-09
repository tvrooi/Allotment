import { test, expect, open, isoDay, thisMonth } from './fixtures';
import { sidewaysOverflow } from './phone/overflow';

for (const width of [430, 1512]) {
  test(`refined dashboard preserves the original at ${width}px`, async ({ page, api }) => {
    await page.setViewportSize({ width, height: 932 });
    const account = await api.createAccount('Everyday', 250_000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -1000,
      payeeName: 'Shop',
    });
    for (let index = 0; index < 5; index++) {
      await api.call('POST', '/schedules', {
        name: `Bill ${index}`,
        amount: -1000,
        recurrenceType: 'monthly',
        startDate: isoDay(2),
        accountId: account.id,
      });
    }
    for (let index = 0; index < 3; index++) {
      await api.call('POST', '/schedules', {
        name: `Pay ${index}`,
        amount: 10000,
        recurrenceType: 'monthly',
        startDate: isoDay(index + 1),
        accountId: account.id,
      });
    }
    await open(page, '/dashboard/refined');
    await page.getByRole('button', { name: 'Hide getting started' }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('left to spend');
    const attention = page.getByRole('region', { name: 'Review attention' });
    const task = attention.getByRole('heading', { level: 2 });
    await expect(task).toHaveText('Give 1 transaction a category');
    await expect(task.getByRole('link')).toHaveAttribute('href', /transactions/);
    const count = attention.getByRole('link', { name: /next steps? for your budget/ });
    await expect(count).toHaveAttribute('href', '#/review');
    expect((await count.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await task.getByRole('link').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await task.boundingBox())!.y).toBeLessThan((await count.boundingBox())!.y);
    const bills = page.getByTestId('home-card-upcoming-bills');
    await expect(bills.getByText('Next 30 days', { exact: true })).toBeVisible();
    await expect(
      bills.getByRole('link', {
        name: `${width === 430 ? 3 : 1} more ${width === 430 ? 'bills' : 'bill'} · View all`,
        exact: true,
      }),
    ).toBeVisible();
    const summary = page.getByTestId('home-card-summary');
    if (width === 430) {
      const definition = summary.getByText('How this is calculated', { exact: true });
      await definition.click();
      await expect(summary.getByText(/This is budget money available to spend/)).toBeVisible();
      await expect(summary.getByText('Monthly averages', { exact: true })).toHaveCount(0);
      await definition.click();
      await expect(bills.getByText('Pay 0', { exact: true })).toBeVisible();
      await expect(bills.getByText('Pay 1', { exact: true })).toHaveCount(0);
      await expect(
        bills.getByRole('link', { name: '2 more income entries · View all', exact: true }),
      ).toBeVisible();
      await expect(bills.getByText('Bill 0', { exact: true })).toBeVisible();
      await expect(bills.getByText('Bill 2', { exact: true })).toHaveCount(0);
      expect((await bills.boundingBox())!.height).toBeLessThan(500);
      await expect(summary.getByText('Income / month', { exact: true })).toHaveCount(0);
      const history = page.getByTestId('home-history');
      await expect(history.getByText('Income / month', { exact: true })).toBeVisible();
      expect((await history.boundingBox())!.y).toBeGreaterThan((await bills.boundingBox())!.y);
    } else {
      const budget = (await page.getByTestId('home-card-budget-progress').boundingBox())!;
      expect(budget.height).toBeLessThan((await bills.boundingBox())!.height);
    }
    await page.getByRole('button', { name: 'Edit savings target' }).click();
    await expect(page.getByRole('combobox', { name: 'Savings rate goal' })).toBeVisible();
    expect(await sidewaysOverflow(page)).toEqual([]);

    // Customising the exploration does not alter the original dashboard's saved layout.
    await page.getByRole('button', { name: 'Customise', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customise home' });
    await dialog.getByRole('checkbox', { name: 'Budget progress' }).uncheck();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('home-card-budget-progress')).toHaveCount(0);
    await open(page, '/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('left to spend');
    await expect(page.getByTestId('home-card-budget-progress')).toBeVisible();
    await expect(page.getByText('Next 30 days', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Savings rate goal' })).toBeVisible();
    const originalBills = page.getByTestId('home-card-upcoming-bills');
    await expect(originalBills.getByText('Bill 2', { exact: true })).toBeVisible();
    await expect(originalBills.getByText('Pay 1', { exact: true })).toBeVisible();
  });
}
