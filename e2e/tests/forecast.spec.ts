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
    await page.getByRole('tab', { name: 'Cash runway' }).click();
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

for (const width of [1280, 390])
  test('Wave D: empty state at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/forecast?tab=cash');
    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { name: 'See how long your cash could last', exact: true }),
    ).toBeVisible();
    await expect(main.getByText('Example', { exact: true })).toBeVisible();
    await page.keyboard.press('Alt+Shift+H');
    await expect(main.getByText('Example', { exact: true })).toBeVisible();
    await expect(
      main.locator('[aria-hidden="true"]').filter({ hasText: '$' }).first(),
    ).toBeVisible();
    await page.keyboard.press('Alt+Shift+H');
    const action = main.getByRole('link', { name: 'Add an account', exact: true });
    await expect(action).toHaveCount(1);
    await expect(action).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(main.getByLabel('Horizon', { exact: true })).toHaveCount(0);
    await action.click();
    await expect(page).toHaveURL(/#\/accounts$/);
  });

test('Wave D: excluded cash accounts keep their actionable forecast warnings', async ({
  page,
  api,
}) => {
  await api.call('PUT', '/currency', { currency: 'USD' });
  await api.createAccount('Euro spending', 10_000, 'checking', { currency: 'EUR' });
  await open(page, '/forecast?tab=cash');
  await expect(page.getByRole('list', { name: 'Forecast warnings' })).toContainText(
    'Euro spending is excluded: add an exchange rate for EUR.',
  );
  await expect(page.getByRole('link', { name: 'Add an account', exact: true })).toHaveCount(0);
});
