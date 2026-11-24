import { test, expect, open, isoDay, typeAmount, chooseOption } from './fixtures';

// Phase 7: priorities (7A), the flexibility reserve (7B), adverse-event scenarios (7C), goal
// pauses (7D) and the resume review (7E) on desktop and phone. Disposable budgets only.

const noSideScroll = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

test('an essentials estimate displays as money and survives reload', async ({ page, api }) => {
  await open(page, '/settings?tab=priorities');
  const estimate = page.getByRole('textbox', { name: 'Monthly essentials estimate' });
  await typeAmount(estimate, '1234.56');
  await expect(estimate).toHaveValue(/1,234\.56/);
  await page.getByRole('button', { name: 'Save priorities' }).click();
  await expect(page.getByText('Priorities saved. No money was moved.')).toBeVisible();
  expect(await api.call('GET', '/priorities')).toMatchObject({ essentialMonthlyAmount: 123456 });
  await page.reload();
  await expect(estimate).toHaveValue(/1,234\.56/);
});

for (const phone of [false, true])
  test(`priorities set up a flexibility reserve the review measures${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Resilience cash', 1_200_000);
    const reserve = await api.category('Gifts');
    const month = isoDay().slice(0, 7);
    const before = await api.call('GET', `/budget/${month}/summary`);

    await open(page, '/settings?tab=priorities');
    await expect(page.getByRole('heading', { name: 'Financial priorities' })).toBeVisible();
    await chooseOption(
      page.getByRole(phone ? 'combobox' : 'button', { name: /Purpose for Gifts/ }),
      'Flexibility reserve',
    );
    await chooseOption(
      page.getByRole(phone ? 'combobox' : 'button', { name: /Purpose for Groceries/ }),
      'Essential',
    );
    await chooseOption(
      page.getByRole(phone ? 'combobox' : 'button', { name: /Comfort target/ }),
      'An amount',
    );
    await typeAmount(page.getByLabel('Target amount'), '1000');
    await typeAmount(page.getByLabel('Reserve minimum'), '500');
    await page.getByRole('button', { name: 'Save priorities' }).click();
    await expect(page.getByText('Priorities saved. No money was moved.')).toBeVisible();
    // Labels only: the budget is exactly as it was.
    expect(await api.call('GET', `/budget/${month}/summary`)).toMatchObject({
      toBeBudgeted: before.toBeBudgeted,
      reserved: before.reserved,
    });

    await api.call('PUT', `/budget/${month}/${reserve.id}`, { budgeted: 600_000 });
    await open(page, '/review');
    const card = page.getByLabel('Resilience');
    await expect(card).toContainText('Flexibility available today');
    await expect(card).toContainText('6,000');
    await expect(card.getByRole('status')).toHaveText('Healthy');
    // A new budget has no essentials history to measure coverage against.
    await expect(card).toContainText('Coverage unavailable');
    const resilience = await api.call('GET', '/review/resilience');
    expect(resilience.flexibility.available).toBe(600_000);
    const p = resilience.partition;
    expect(p.card + p.committed + p.goals + p.flexibility + p.other + p.held + p.unassigned).toBe(
      resilience.resources,
    );

    const resume = page.getByLabel('Resume budgeting');
    await resume.getByRole('button', { name: 'Record today’s review' }).click();
    await expect(resume).toContainText('Last review');
    expect((await api.call('GET', '/review/resume')).lastReview).not.toBeNull();
    if (phone) await noSideScroll(page);
  });

for (const phone of [false, true])
  test(`pausing a goal keeps its money and stops suggestions${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Goal cash', 100_000);
    const car = await api.category('Car Maintenance');
    const month = isoDay().slice(0, 7);
    await api.call('POST', '/goals', {
      name: 'New tyres',
      targetAmount: 120_000,
      categoryId: car.id,
    });
    await api.call('PUT', `/budget/${month}/${car.id}`, { budgeted: 80_000 });

    await open(page, '/goals');
    await page.getByRole('button', { name: 'Actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Pause goal' }).click();
    await page.getByLabel('Reason').fill('Saving for rent first');
    await page.getByRole('dialog').getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Paused: Saving for rent first')).toBeVisible();
    const [goal] = await api.call('GET', '/goals');
    expect(goal).toMatchObject({ status: 'paused', available: 80_000 });
    if (phone) await noSideScroll(page);
  });

test('a life-event template shows the first dated shortfall without writing', async ({
  page,
  api,
}) => {
  await api.createAccount('Thin cash', 100_000);
  const before = await api.call('GET', '/review');
  await open(page, '/forecast');
  await page.getByRole('tab', { name: 'Cash runway' }).click();
  await expect(page.getByLabel('Shortfall')).toContainText('No shortfall within this horizon');
  await page.getByText('Life events').first().click();
  await page.getByRole('button', { name: 'Emergency cost' }).first().click();
  await expect(page.getByLabel('Shortfall')).toContainText('First shortfall');
  expect((await api.call('GET', '/review')).revision).toBe(before.revision);
});

test('an extra-income split keeps the usual amount in cents', async ({ page, api }) => {
  const account = await api.createAccount('Pay account');
  const income = (await api.categoryGroups()).find((group) => group.isIncome)!.categories[0];
  const reserve = await api.category('Gifts');
  const priorities = await api.call('GET', '/priorities');
  await api.call('PUT', '/priorities', {
    ...priorities,
    purposes: [{ categoryId: reserve.id, purpose: 'flexibility' }],
  });
  const deposit = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 200_000,
    payeeName: 'Example employer',
    categoryId: income.id,
  });

  await open(page, '/review');
  const usual = page.getByRole('textbox', { name: 'Usual amount' });
  await typeAmount(usual, '1234.56');
  await expect(usual).toHaveValue(/1,234\.56/);
  const picker = page.getByRole('combobox', { name: 'Income deposit' });
  await picker.fill('Example employer');
  await page.getByRole('option', { name: /Example employer/ }).click();
  await page.getByRole('button', { name: 'Preview split' }).click();
  const preview = page.getByRole('region', { name: 'Extra income preview' });
  await expect(preview).toContainText('To the reserve: $382.72');
  const submitted = page.waitForRequest((request) =>
    request.url().endsWith('/review/income/apply'),
  );
  await preview.getByRole('button', { name: 'Apply split' }).click();
  expect((await submitted).postDataJSON()).toMatchObject({
    baseline: 123456,
    transactionId: deposit.id,
  });
  await expect(page.getByText('Assigned to your reserve.', { exact: false })).toBeVisible();
});
