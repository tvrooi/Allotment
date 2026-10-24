import { test, expect, open, isoDay } from './fixtures';

// Phase 7: priorities (7A), the flexibility reserve (7B), adverse-event scenarios (7C), goal
// pauses (7D) and the resume review (7E) on desktop and phone. Disposable budgets only.

const noSideScroll = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

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
    await page.getByLabel('Purpose for Gifts').selectOption('flexibility');
    await page.getByLabel('Purpose for Groceries').selectOption('essential');
    await page.getByLabel('Comfort target').selectOption('amount');
    await page.getByLabel('Target amount').fill('1000');
    await page.getByLabel('Reserve minimum').fill('500');
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
    expect(p.card + p.committed + p.goals + p.flexibility + p.other + p.unassigned).toBe(
      resilience.resources,
    );

    const resume = page.getByLabel('Resume budgeting');
    await resume.getByRole('button', { name: 'Mark review complete' }).click();
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
