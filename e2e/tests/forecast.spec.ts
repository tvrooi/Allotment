import { test, expect, open, isoDay } from './fixtures';

for (const phone of [false, true])
  test(`forecast projects paydays and bills without writing${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Forecast checking', 100000);
    const food = await api.category('Groceries');
    await api.call('POST', '/payday', {
      name: 'Fortnightly pay',
      anchorDate: isoDay(3),
      expectedIncome: 250000,
      weekendAdjust: 'none',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rules: [],
    });
    await api.call('POST', '/schedules', {
      name: 'Phone bill',
      amount: -6000,
      recurrenceType: 'once',
      startDate: isoDay(5),
      accountId: account.id,
      categoryId: food.id,
    });
    const before = {
      transactions: await api.transactions(),
      schedules: await api.call('GET', '/schedules'),
    };
    await open(page, '/forecast');
    await expect(page.getByRole('heading', { name: 'Forecast' })).toBeVisible();
    const cash = page.getByText('Cash today', { exact: true }).locator('..');
    await expect(cash).toContainText('$1,000');
    await expect(page.getByRole('cell', { name: 'Fortnightly pay pay' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Phone bill' })).toBeVisible();
    await page.getByRole('tab', { name: 'Conservative' }).click();
    await expect(page.getByText('Conservative: expected movements')).toBeVisible();
    await expect(page.getByRole('cell', { name: '$2,375', exact: true }).first()).toBeVisible();
    expect(await api.transactions()).toEqual(before.transactions);
    expect(await api.call('GET', '/schedules')).toEqual(before.schedules);
  });
