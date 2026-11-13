import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth } from './fixtures';

// The zero-based budget: To Be Budgeted = income + carry-over − planned.

const toBeBudgeted = (page: Page) => page.getByRole('status', { name: 'Ready to assign' });

async function plan(page: Page, category: string, amount: string) {
  const button = page.getByRole('button', { name: new RegExp(`^Assigned to ${category}:`) });
  // Categories with no activity sit under "Show N inactive categories" in each section
  await expect(page.getByRole('button', { name: /^Assigned to / }).first()).toBeVisible();
  const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
  while (!(await button.isVisible()) && (await showInactive.count()) > 0) {
    await showInactive.first().click();
  }
  await button.click();
  const input = page.getByRole('textbox', { name: `Assigned to ${category}` });
  await input.fill(amount);
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: new RegExp(`^Assigned to ${category}: \\$`) }),
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

  test('a refused amount stays in the field with its reason, and a save in flight is shown', async ({
    page,
    api,
  }) => {
    test.info().annotations.push({
      type: 'allow-page-errors',
      description: 'Expected refusal to assign more than is ready to assign',
    });
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });
    await open(page, '/budget');
    await plan(page, 'Groceries', '1000');
    await expect(toBeBudgeted(page)).toContainText('$0');

    // Delay the answers so the saving state can be seen, and count what is sent
    let puts = 0;
    await page.route('**/api/budget/*/*', async (route) => {
      if (route.request().method() === 'PUT') {
        puts++;
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.continue();
    });

    const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
    const restaurants = page.getByRole('button', { name: /^Assigned to Restaurants:/ });
    while (!(await restaurants.isVisible()) && (await showInactive.count()) > 0) {
      await showInactive.first().click();
    }
    await restaurants.click();
    const input = page.getByRole('textbox', { name: 'Assigned to Restaurants' });
    await input.fill('50');
    await input.press('Enter');
    await expect(page.getByText('Saving…')).toBeVisible();
    await expect(input).toHaveAttribute('readonly', '');

    // Refused: the amount is still there to correct, with the reason beside it
    await expect(page.getByText(/^Not saved\./)).toBeVisible();
    await expect(input).toHaveValue('50');
    await expect(input).toBeFocused();
    expect(puts).toBe(1);
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).toBeBudgeted).toBe(0);

    // Corrected to what can be afforded, it saves and the editor closes
    await input.fill('0');
    await input.press('Enter');
    await expect(input).toHaveCount(0);
    expect(puts).toBe(2);
  });

  test('a save that finishes late does not close the editor opened after it', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });
    await open(page, '/budget');
    await expect(page.getByRole('button', { name: /^Assigned to / }).first()).toBeVisible();
    await page.route('**/api/budget/*/*', async (route) => {
      if (route.request().method() === 'PUT') await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    // Both are listed (not tucked under "inactive") before anything is saved, so they stay put
    const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
    while ((await showInactive.count()) > 0) await showInactive.first().click();
    const first = 'Groceries';
    const second = 'Restaurants';
    await page.getByRole('button', { name: new RegExp(`^Assigned to ${first}:`) }).click();
    const a = page.getByRole('textbox', { name: `Assigned to ${first}` });
    await a.fill('10');
    await a.press('Enter');
    await expect(page.getByText('Saving…')).toBeVisible();

    // Another envelope is opened and typed in while the first save is on its way
    await page.getByRole('button', { name: new RegExp(`^Assigned to ${second}:`) }).click();
    const b = page.getByRole('textbox', { name: `Assigned to ${second}` });
    await b.fill('5');
    await expect(page.getByText('Saving…')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: new RegExp(`^Assigned to ${first}: \\$10`) }),
    ).toBeVisible();
    await expect(b).toHaveValue('5');
  });

  test('a refused quick amount is what stays in the field', async ({ page, api }) => {
    test.info().annotations.push({
      type: 'allow-page-errors',
      description: 'Expected refusal to assign more than is ready to assign',
    });
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Shop',
      categoryId: groceries.id,
    });
    await open(page, '/budget');
    await plan(page, 'Rent / Mortgage', '1000');
    await expect(toBeBudgeted(page)).toContainText('$0');

    const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
    const button = page.getByRole('button', { name: /^Assigned to Groceries:/ });
    while (!(await button.isVisible()) && (await showInactive.count()) > 0) {
      await showInactive.first().click();
    }
    await button.click();
    await page.getByRole('button', { name: /^Cover \$50(\.00)? overspent/ }).click();
    await expect(page.getByText(/^Not saved\./)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Assigned to Groceries' })).toHaveValue(/^50/);
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

  test('money can be held for next month, so this month reaches fully budgeted', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      categoryId: paychecks.id,
    });

    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$1,000');
    await page.getByRole('button', { name: 'Hold money…' }).click();
    // More than is ready to assign can't be held
    const amount = page.getByRole('textbox', { name: 'Amount to hold' });
    // Text that isn't an amount can't hold the amount that was there before
    await amount.clear();
    await amount.fill('abc');
    await amount.blur();
    await expect(page.getByRole('button', { name: 'Hold', exact: true })).toBeDisabled();
    await amount.clear();
    await amount.fill('1500');
    await amount.blur();
    await expect(page.getByText('That is more than is ready to assign.')).toBeVisible();
    await amount.clear();
    await amount.fill('300');
    await page.getByRole('button', { name: 'Hold', exact: true }).click();

    await expect(page.getByText('$300 held for next month')).toBeVisible();
    await expect(toBeBudgeted(page)).toContainText('$700');
    // Held money can't be given to an envelope, but the rest can: the month is fully budgeted
    await plan(page, 'Groceries', '700');
    await expect(toBeBudgeted(page)).toContainText('Fully budgeted');
    const refused = await api.request.put(`/api/budget/${thisMonth()}/${groceries.id}`, {
      data: { budgeted: 70_100 },
    });
    expect(refused.status()).toBe(409);

    // Next month gets the held money back
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(toBeBudgeted(page)).toContainText('$300');
    await page.getByRole('button', { name: 'Previous month' }).click();

    // Releasing it returns it to this month
    await page.getByRole('button', { name: 'Change hold' }).click();
    await page.getByRole('button', { name: 'Release hold' }).click();
    await expect(toBeBudgeted(page)).toContainText('$300');
    await expect(page.getByText('held for next month.')).toHaveCount(0);
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).holdAmount).toBe(0);
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
    await page.getByRole('link', { name: 'Open Groceries' }).click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));
    await expect(
      page.getByTestId('transaction-row').filter({ hasText: 'Farm Stand' }),
    ).toBeVisible();
  });
  test('a category with no spending this month opens on all its history, not an empty month', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 100000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(-45),
      amount: -4_321,
      payeeName: 'Old Market',
      categoryId: groceries.id,
    });
    await open(page, `/budget/category/${groceries.id}`);
    // The chart shows that spending, so the list and summary show it too, under a chosen tab
    await expect(page.getByRole('img', { name: 'Spending by month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByTestId('transaction-row').filter({ hasText: 'Old Market' }),
    ).toBeVisible();
    await expect(page.getByText('No transactions found')).toHaveCount(0);
    await expect(page.getByText('No data')).toHaveCount(0);
  });

  test('the transactions sit right under the spending history on a wide screen', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 100000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -4_321,
      payeeName: 'Farm Stand',
      categoryId: groceries.id,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `/budget/category/${groceries.id}`);
    // The Budget and Target cards beside the chart are taller than it; the list doesn't wait
    const chart = page.getByRole('heading', { name: 'Spending history' }).locator('..');
    const search = page.getByRole('textbox', { name: 'Search payee or notes' });
    await expect(page.getByRole('heading', { name: 'Target' })).toBeVisible();
    const chartBox = (await chart.boundingBox())!;
    const listBox = (await search.boundingBox())!;
    expect(listBox.y - (chartBox.y + chartBox.height)).toBeLessThan(48);
  });

  test('switching months keeps the budget on screen while the next month loads', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 100000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 20_000 });
    await open(page, '/budget');
    const groceriesPlanned = page.getByRole('button', { name: /^Assigned to Groceries:/ });
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
      page.getByRole('button', { name: /^Assigned to Groceries: \$0(\.00)?$/ }),
    ).toBeVisible();
  });

  test('an open editor never saves into the month that is still loading', async ({ page, api }) => {
    await api.createAccount('Checking', 100_000);
    await open(page, '/budget');
    const groceries = page.getByRole('button', { name: /^Assigned to Groceries:/ });
    const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
    await expect(page.getByRole('button', { name: /^Assigned to / }).first()).toBeVisible();
    while (!(await groceries.isVisible()) && (await showInactive.count()) > 0)
      await showInactive.first().click();
    await groceries.click();
    await page.getByRole('textbox', { name: 'Assigned to Groceries' }).fill('75');

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
    // The editor closed with the month change (clicking away cancels, so nothing is saved)
    await expect(page.getByRole('textbox', { name: 'Assigned to Groceries' })).toHaveCount(0);
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

/** Assign opens a menu only when targets are underfunded; otherwise Auto-assign… is a button */
async function openAutoAssign(page: Page) {
  await page.getByRole('button', { name: /^(Assign|Auto-assign…)$/ }).click();
  const item = page.getByRole('menuitem', { name: /Auto-assign/ });
  if (await item.isVisible()) await item.click();
}

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
  await page.getByRole('button', { name: /^Assigned to Groceries:/ }).click();
  // Nothing typed yet: no "Use $0 for the next 12 months"
  await expect(page.getByRole('button', { name: /next 12 months/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Assigned to Groceries' }).fill('50');
  await expect(page.getByRole('button', { name: /Use \$50 for the next 12 months/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cover $120 overspent' }).click();
  await expect(page.getByRole('button', { name: /^Assigned to Groceries: \$120/ })).toBeVisible();

  await openAutoAssign(page);
  const preview = page.getByRole('region', { name: 'Auto-assign preview' });
  await expect(preview).toContainText('Electric');
  await expect(preview).not.toContainText('Groceries');
  await page.getByRole('button', { name: 'Assign $80' }).click();
  await expect(preview).toBeHidden();
  await expect
    .poll(async () => (await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted)
    .toBe(20_000);
});

test('a quick fill can leave envelopes out, and Replace or Set to zero takes money back', async ({
  page,
  api,
}) => {
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
  await openAutoAssign(page);
  const preview = page.getByRole('region', { name: 'Auto-assign preview' });
  await expect(preview).toContainText('Groceries');
  await expect(preview).toContainText('Electric');
  // Leave Groceries out: the rest is planned again without it. Until that answer arrives the
  // shown plan still includes Groceries, so Apply must not be offered
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/auto-assign/preview', async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole('checkbox', { name: 'Include Groceries' }).uncheck();
  await expect(page.getByRole('button', { name: /^Assign \$/ })).toBeDisabled();
  release();
  await expect(preview.getByText('left out')).toBeVisible();
  await page.unroute('**/auto-assign/preview');
  await expect(page.getByRole('button', { name: 'Assign $80' })).toBeEnabled();
  await page.getByRole('button', { name: 'Assign $80' }).click();
  await expect(preview).toBeHidden();
  const budgeted = async (name: string) =>
    (await api.call('GET', `/budget/${thisMonth()}`))
      .flatMap((g: { categories: { name: string; budgeted: number }[] }) => g.categories)
      .find((c: { name: string }) => c.name === name)?.budgeted;
  await expect.poll(() => budgeted('Electric')).toBe(8_000);
  expect(await budgeted('Groceries')).toBe(0);

  // Set to zero takes the $80 back, and says so
  await openAutoAssign(page);
  await page.getByRole('radio', { name: /Set to zero/ }).check();
  await expect(preview).toContainText('take back $80');
  await expect(preview).toContainText('will be overspent');
  await page.getByRole('button', { name: 'Take back $80' }).click();
  await expect(preview).toBeHidden();
  await expect.poll(() => budgeted('Electric')).toBe(0);
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
  await expect(expected).toContainText(/\$45(\.00)? needed by the/);
  await expected.click();
  const details = page.getByRole('dialog', { name: 'Expected bills for Phone' });
  await expect(details).toContainText('Mobile plan');
  await expect(details).toContainText('After expected bills');
  await expect(
    details.getByRole('progressbar', { name: 'Expected bills covered' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(expected).toBeFocused();
  await expected.press('Enter');
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Close expected bills' }).click();
  await expect(details).toBeHidden();
  await expect(expected).toHaveClass(/text-expected/);

  // The phone disclosure is independent of the activity link, and fits a narrow viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await expected.click();
  await expect(details).toBeVisible();
  await expect(page).toHaveURL(/\/budget$/);
  const bounds = await details.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await details.getByRole('button', { name: 'Close expected bills' }).click();
  await expect(details).toBeHidden();
});

for (const width of [1400, 390]) {
  test(`expected bills open their recurring editor at ${width}px`, async ({ page, api }) => {
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
    await page.setViewportSize({ width, height: 844 });
    await open(page, '/budget');
    await page.getByTestId('expected-debit').click();
    const breakdown = page.getByRole('dialog', { name: 'Expected bills for Phone' });
    await breakdown.getByRole('button', { name: 'Assign to Phone…' }).click();
    await expect(breakdown).toBeHidden();
    const amount = page.getByRole('textbox', { name: 'Assigned to Phone', exact: true });
    await expect(amount).toBeVisible();
    // The existing amount editor represents an unassigned zero as an empty field.
    await expect(amount).toHaveValue('');
    if (width === 1400) {
      await expect(amount).toBeFocused();
      await amount.press('Escape');
    } else {
      await page
        .getByRole('dialog', { name: 'Plan Phone', exact: true })
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
    }
    await page.getByTestId('expected-debit').click();
    await page.getByRole('link', { name: 'Open recurring bill: Mobile plan' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit recurring', exact: true });
    await expect(edit.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Mobile plan',
    );
    await expect(page).toHaveURL(/\/recurring$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Recurring', exact: true })).toBeVisible();
    await expect(edit).toBeHidden();
  });
}

test('a deleted schedule link does not open a new recurring form', async ({ page }) => {
  await open(page, '/recurring?schedule=missing-schedule');
  await expect(page).toHaveURL(/\/recurring$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the next funding gap separates bills due by the deadline from later bills', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Checking', 100_000);
  const phone = await api.category('Phone');
  for (const [name, day, amount] of [
    ['Earlier bill', '01', -3000],
    ['Next bill', '10', -4000],
    ['Later bill', '25', -9000],
  ] as const) {
    await api.call('POST', '/schedules', {
      name,
      amount,
      recurrenceType: 'once',
      startDate: `${thisMonth()}-${day}`,
      accountId: checking.id,
      categoryId: phone.id,
    });
  }
  await open(page, '/budget');
  await plan(page, 'Phone', '50');
  const trigger = page.getByTestId('expected-debit');
  await expect(trigger).toContainText('$20 needed by the 10th');
  for (const width of [1400, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Expected bills for Phone' });
    const gap = dialog.getByRole('region', { name: 'Next funding gap', exact: true });
    await expect(gap).toContainText('Bills due by then$70');
    await expect(gap).toContainText('Covered by this envelope$50');
    await expect(gap).toContainText('Still needed$20');
    const due = dialog.getByRole('region', { name: /^Due by / });
    await expect(due.getByRole('link')).toHaveCount(2);
    await expect(due).toContainText('Earlier bill');
    await expect(due).toContainText('Next bill');
    await expect(dialog.getByRole('region', { name: 'Later this month' })).toContainText(
      'Later bill',
    );
    await dialog.getByRole('button', { name: 'Close expected bills' }).click();
    await expect(dialog).toBeHidden();
  }
});

test('Manage categories opens the category manager in place of the envelopes (#244)', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 0);
  await open(page, '/budget');
  await expect(toBeBudgeted(page)).toBeVisible();
  await page.getByRole('link', { name: 'Manage categories' }).click();
  await expect(page).toHaveURL(/view=categories/);
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Groceries' })).toBeVisible();
  // The envelopes are not under the manager: it is a view of its own
  await expect(toBeBudgeted(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to budget' }).click();
  await expect(toBeBudgeted(page)).toBeVisible();
  await expect(page).not.toHaveURL(/view=categories/);
  // Browser Back returns to the manager it came from
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
});

test('reaching $0 ready to assign is marked with a sprout tick (#241)', async ({ page, api }) => {
  const checking = await api.createAccount('Checking', 0);
  const paychecks = await api.category('Paychecks');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: 50_000,
    payeeName: 'Employer',
    categoryId: paychecks.id,
  });
  await open(page, '/budget');
  await expect(toBeBudgeted(page)).toContainText('$500');
  await expect(toBeBudgeted(page).getByTestId('sprout-tick')).toHaveCount(0);

  await plan(page, 'Groceries', '500');
  await expect(toBeBudgeted(page)).toContainText('Fully budgeted');
  await expect(toBeBudgeted(page)).toContainText('Every dollar has a job.');
  const tick = toBeBudgeted(page).getByTestId('sprout-tick');
  await expect(tick).toBeVisible();
  // Reached while you watched, so it grows in once
  await expect(tick).toHaveAttribute('data-animate', 'true');

  // Opening a month that is already at $0 shows the tick still, with no fuss
  await page.reload();
  await expect(tick).toBeVisible();
  await expect(tick).toHaveAttribute('data-animate', 'false');
});

test('with reduced motion the sprout tick is shown still (#241)', async ({ page, api }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const checking = await api.createAccount('Checking', 0);
  const paychecks = await api.category('Paychecks');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: 20_000,
    payeeName: 'Employer',
    categoryId: paychecks.id,
  });
  await open(page, '/budget');
  await plan(page, 'Groceries', '200');
  const tick = toBeBudgeted(page).getByTestId('sprout-tick');
  await expect(tick).toBeVisible();
  for (const part of await tick.locator('[data-motion]').all())
    await expect(part).toHaveCSS('animation-name', 'none');
});
