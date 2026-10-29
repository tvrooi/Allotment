import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth } from './fixtures';

// The zero-based budget: To Be Budgeted = income + carry-over − planned.

const toBeBudgeted = (page: Page) => page.getByRole('status', { name: 'Ready to assign' });

async function plan(page: Page, category: string, amount: string) {
  const button = page.getByRole('button', { name: new RegExp(`^Planned for ${category}:`) });
  // Categories with no activity sit under "Show N inactive categories" in each section
  await expect(page.getByRole('button', { name: /^Planned for / }).first()).toBeVisible();
  const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
  while (!(await button.isVisible()) && (await showInactive.count()) > 0) {
    await showInactive.first().click();
  }
  await button.click();
  const input = page.getByRole('textbox', { name: `Planned for ${category}` });
  await input.fill(amount);
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: new RegExp(`^Planned for ${category}: \\$`) }),
  ).toBeVisible();
}

test.describe('budget', () => {
  test('income is ready to budget, and planning spends it down', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 300_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });

    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$3,000');
    await expect(toBeBudgeted(page)).toContainText('Give every dollar a job');

    await plan(page, 'Groceries', '400');
    await expect(toBeBudgeted(page)).toContainText('$2,600');
    await plan(page, 'Rent / Mortgage', '2600');
    await expect(toBeBudgeted(page)).toContainText('$0');
    await expect(toBeBudgeted(page)).toContainText('Fully budgeted');

    const summary = await api.call('GET', `/budget/${thisMonth()}/summary`);
    expect(summary).toMatchObject({ income: 300_000, totalBudgeted: 300_000, toBeBudgeted: 0 });

    // The API rejects overassignment before it can consume money twice.
    const rejected = await api.request.put(
      `/api/budget/${thisMonth()}/${(await api.category('Restaurants')).id}`,
      { data: { budgeted: 5000 } },
    );
    expect(rejected.status()).toBe(409);
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).toBeBudgeted).toBe(0);
  });

  test('spending shows against its categories, including split parts', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 100_000);
    const groceries = await api.category('Groceries');
    const restaurants = await api.category('Restaurants');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await api.call('PUT', `/budget/${thisMonth()}/${restaurants.id}`, { budgeted: 10_000 });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -12_000,
      payeeName: 'Supercenter',
      splits: [
        { categoryId: groceries.id, amount: -9_000 },
        { categoryId: restaurants.id, amount: -3_000 },
      ],
    });

    await open(page, '/budget');
    const groceriesRow = page.getByRole('row').filter({ hasText: 'Groceries' });
    await expect(groceriesRow).toContainText('$90');
    await expect(groceriesRow).toContainText('$410');
    const restaurantsRow = page.getByRole('row').filter({ hasText: 'Restaurants' });
    await expect(restaurantsRow).toContainText('$30');
    await expect(restaurantsRow).toContainText('$70');
  });

  test('income in an off-budget account is not money to budget', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const brokerage = await api.createAccount('Brokerage', 0, 'investment');
    const paychecks = await api.category('Paychecks');
    const dividends = await api.category('Interest');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      categoryId: paychecks.id,
    });
    await api.createTransaction({
      accountId: brokerage.id,
      date: isoDay(),
      amount: 55_000,
      categoryId: dividends.id,
    });
    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$1,000');
  });

  test('unspent money carries over to the next month', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      categoryId: paychecks.id,
    });
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 40_000 });

    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$600');
    await page.getByRole('button', { name: 'Next month' }).click();
    // Last month's unbudgeted $600 is still there to budget
    await expect(toBeBudgeted(page)).toContainText('$600');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    // Before the income arrived there was nothing to assign, and later months' assignments
    // don't make an earlier month negative
    await expect(toBeBudgeted(page)).toContainText('$0');
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(toBeBudgeted(page)).toContainText('$600');
  });

  test('a category links to its detail page with its transactions', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 100000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 20_000 });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -4_321,
      payeeName: 'Farm Stand',
      categoryId: groceries.id,
    });
    await open(page, '/budget');
    await page.getByRole('row').filter({ hasText: 'Groceries' }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));
    await expect(
      page.getByTestId('transaction-row').filter({ hasText: 'Farm Stand' }),
    ).toBeVisible();
  });
  test('switching months keeps the budget on screen while the next month loads', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 100000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 20_000 });
    await open(page, '/budget');
    const groceriesPlanned = page.getByRole('button', { name: /^Planned for Groceries:/ });
    await expect(groceriesPlanned).toBeVisible();

    // Make next month slow to load, so the moment in between can be checked
    const [y, m] = thisMonth().split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    await page.route(`**/api/budget/${next}**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Next month' }).click();
    // Still loading: this month's table stays (faded) instead of collapsing to nothing
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(groceriesPlanned).toBeVisible();
    await expect(page.getByText('No categories yet')).toHaveCount(0);

    // Then next month's figures replace it
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Planned for Groceries: \$0(\.00)?$/ }),
    ).toBeVisible();
  });

  test('an open editor never saves into the month that is still loading', async ({ page, api }) => {
    await api.createAccount('Checking', 100_000);
    await open(page, '/budget');
    const groceries = page.getByRole('button', { name: /^Planned for Groceries:/ });
    const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
    await expect(page.getByRole('button', { name: /^Planned for / }).first()).toBeVisible();
    while (!(await groceries.isVisible()) && (await showInactive.count()) > 0)
      await showInactive.first().click();
    await groceries.click();
    await page.getByRole('textbox', { name: 'Planned for Groceries' }).fill('75');

    // Hold the next month back, as a slow connection would
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && /\/api\/budget\/\d{4}-\d{2}\//.test(r.url()))
        writes.push(r.url());
    });
    await page.route(/\/api\/budget\/\d{4}-\d{2}(\/summary)?$/, async (route) => {
      await held;
      await route.fallback();
    });
    await page.getByRole('button', { name: 'Next month' }).click({ force: true });
    // The editor closed with the month change (blur may save October: that's its own month)
    await expect(page.getByRole('textbox', { name: 'Planned for Groceries' })).toHaveCount(0);
    const loading = page.locator('[aria-busy="true"]');
    await expect(loading).toHaveAttribute('inert', '');
    release();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const next = new Date(`${thisMonth()}-01T12:00:00`);
    next.setMonth(next.getMonth() + 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    expect(writes.filter((u) => u.includes(`/budget/${nextMonth}/`))).toEqual([]);
  });
});

test('overspending is covered from the amount editor or by auto-assign', async ({ page, api }) => {
  const checking = await api.createAccount('Checking', 100_000);
  for (const [name, amount] of [
    ['Groceries', -12_000],
    ['Electric', -8_000],
  ] as const) {
    const category = await api.category(name);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount,
      payeeName: name,
      categoryId: category.id,
    });
  }
  await open(page, '/budget');
  await page.getByRole('button', { name: /^Planned for Groceries:/ }).click();
  // Nothing typed yet: no "Use $0 for the next 12 months"
  await expect(page.getByRole('button', { name: /next 12 months/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Planned for Groceries' }).fill('50');
  await expect(page.getByRole('button', { name: /Use \$50 for the next 12 months/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cover $120 overspent' }).click();
  await expect(page.getByRole('button', { name: /^Planned for Groceries: \$120/ })).toBeVisible();

  await page.getByRole('button', { name: 'Auto-assign' }).click();
  const preview = page.getByRole('region', { name: 'Auto-assign preview' });
  await expect(preview).toContainText('Electric');
  await expect(preview).not.toContainText('Groceries');
  await page.getByRole('button', { name: 'Assign $80' }).click();
  await expect(preview).toBeHidden();
  await expect
    .poll(async () => (await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted)
    .toBe(20_000);
});

test('a recurring bill shows as expected in its category before it is debited', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Checking', 100_000);
  const phone = await api.category('Phone');
  await api.call('POST', '/schedules', {
    name: 'Mobile plan',
    amount: -4_500,
    recurrenceType: 'once',
    startDate: isoDay(),
    accountId: checking.id,
    categoryId: phone.id,
  });

  await open(page, '/budget');
  const expected = page.getByTestId('expected-debit');
  await expect(expected).toContainText(/\$45(\.00)? expected/);
  await expect(expected).toHaveAttribute('title', /Mobile plan/);
  // Orange, not the red of overspending
  await expect(expected).toHaveClass(/text-expected/);
});
