import { test, expect, open, isoDay } from './fixtures';

// The long-term forecast (docs/LONG-TERM-FORECAST.md): the Forecast page opens on it, plans
// and events are saved only when asked, and nothing it does touches the budget.

const LT = '/forecast/long-term';

async function seed(api: any) {
  await api.createAccount('Everyday', 8_000_000);
  await api.createAccount('Shares', 20_000_000, 'investment');
  await api.createAccount('Super', 60_000_000, 'retirement');
  await api.call('POST', '/payday', {
    name: 'Fortnightly pay',
    anchorDate: isoDay(3),
    expectedIncome: 400_000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [],
  });
}

const ledger = async (api: any) => ({
  accounts: await api.call('GET', '/accounts'),
  transactions: await api.transactions(),
  schedules: await api.call('GET', '/schedules'),
  goals: await api.call('GET', '/goals'),
});

for (const phone of [false, true])
  test(`the long-term forecast${phone ? ' on a phone' : ''}: plans, drafts, years, dollars and comparison`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await seed(api);
    const before = await ledger(api);

    // It is the Forecast page's default; the cash runway is its second tab
    await open(page, '/forecast');
    await expect(page.getByRole('heading', { name: 'Forecast', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Long term' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Cash runway' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // First visit: set up a plan. Opening the form saved nothing.
    expect(await api.call('GET', `${LT}/plans`)).toEqual([]);
    await page.getByLabel('Plan name').fill('Main plan');
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();
    await expect(page.getByText('Net worth today', { exact: true }).locator('..')).toContainText(
      '$880,000',
    );
    const plans = await api.call('GET', `${LT}/plans`);
    expect(plans).toHaveLength(1);
    const planId = plans[0].id;

    // An event editor is a draft: nothing saved until Create
    await page.getByRole('button', { name: 'Add an event' }).click();
    await page.getByRole('button', { name: /^Retirement/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('New: Retirement');
    await expect(dialog).toContainText('Nothing is saved until you choose Create');
    expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.events).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.events).toEqual([]);

    await page.getByRole('button', { name: 'Add an event' }).click();
    await page.getByRole('button', { name: /^Retirement/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    const saved = await api.call('GET', `${LT}/plans/${planId}`);
    expect(saved.plan.events).toHaveLength(1);
    expect(saved.plan.events[0]).toMatchObject({ kind: 'retirement', start: { age: 65 } });
    expect(saved.version).toBe(2);
    await expect(page.getByText('Retirement · ').first()).toBeVisible();

    await page.screenshot({
      path: `test-results/shot-${phone ? 'phone' : 'desk'}-1.png`,
      fullPage: true,
    });
    // A year's change adds up to the cent, in either dollars
    await page.getByLabel('Year', { exact: true }).selectOption({ index: 5 });
    await expect(page.getByText('The parts add up to the change, to the cent')).toBeVisible();
    const todayEnd = await page
      .getByText(/^Net worth at 9\d$/)
      .first()
      .locator('..')
      .innerText();
    await page.getByRole('button', { name: 'Future dollars' }).click();
    await expect(page.getByRole('button', { name: 'Future dollars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('The parts add up to the change, to the cent')).toBeVisible();
    const futureEnd = await page
      .getByText(/^Net worth at 9\d$/)
      .first()
      .locator('..')
      .innerText();
    expect(futureEnd).not.toEqual(todayEnd);
    await page.getByRole('button', { name: "Today's dollars" }).click();

    // Assumptions show their defaults, and wait for Save
    await page.getByRole('tab', { name: 'Assumptions' }).click();
    await expect(page.getByText('Assumption, default 2.5%').first()).toBeVisible();
    await expect(page.getByText('Assumption, default 12%').first()).toBeVisible();
    await page.getByLabel('Inflation', { exact: true }).fill('3');
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.inflationBps).toBe(250);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect
      .poll(async () => (await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.inflationBps)
      .toBe(300);

    // Savings order, with a worked example
    await page.getByRole('tab', { name: 'Savings' }).click();
    await page
      .getByLabel('Add an account to the savings order')
      .selectOption({ label: 'Everyday' });
    await page.getByLabel('Add an account to the savings order').selectOption({ label: 'Shares' });
    const example = page.getByRole('region', { name: 'Worked example' });
    await expect(example).toContainText('50% of what is left');
    await expect(example.getByRole('row', { name: /Everyday/ })).toContainText('$5,000');
    await expect(example.getByRole('row', { name: /Shares/ })).toContainText('$2,500');
    await expect(example.getByRole('row', { name: /Extra savings/ })).toContainText('$2,500');

    await page.screenshot({
      path: `test-results/shot-${phone ? 'phone' : 'desk'}-2.png`,
      fullPage: true,
    });
    // A second plan, compared: the percentage names its denominator
    await page.getByRole('tab', { name: 'Life events' }).click();
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await page.getByRole('dialog').getByLabel('Plan name').fill('Retire early');
    await page.getByRole('dialog').getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByLabel('Plan', { exact: true })).toHaveValue(/.+/);
    await expect(page.getByLabel('Plan', { exact: true }).locator('option:checked')).toHaveText(
      'Retire early',
    );
    await page.getByRole('button', { name: 'Edit Retirement' }).click();
    await page.getByRole('dialog').getByLabel('When: age').fill('55');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('tab', { name: 'Compare' }).click();
    await page.getByLabel('Compare with').selectOption({ label: 'Main plan' });
    const comparison = page.getByRole('region', { name: 'Comparison' });
    await expect(comparison).toContainText('Retire early compared with Main plan');
    await expect(comparison).toContainText(
      'Percent difference is (active − reference) ÷ reference plan',
    );
    await expect(
      comparison.getByRole('row', { name: /Net worth at the end of the plan/ }),
    ).toBeVisible();

    // Deleting a plan deletes only the plan
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete plan' }).click();
    await expect.poll(async () => (await api.call('GET', `${LT}/plans`)).length).toBe(1);

    if (phone) {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    expect(await ledger(api)).toEqual(before);
  });

test('money that runs out shows an unfunded spending warning with its first year', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 1_000_000);
  const year = new Date().getFullYear();
  await api.call('POST', `${LT}/plans`, {
    plan: {
      name: 'Short of money',
      settings: {
        birthYear: year - 50,
        income: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'inflation' } },
        spending: { annual: 2_000_000, escalation: { mode: 'inflation' } },
      },
    },
  });
  await open(page, '/forecast');
  const alert = page.getByRole('alert').filter({ hasText: 'Unfunded spending' });
  await expect(alert).toContainText(`from ${year}`);
});

test('a plan saved on another device is never overwritten', async ({ page, api }) => {
  await api.createAccount('Everyday', 1_000_000);
  const year = new Date().getFullYear();
  const plan = (name: string) => ({ name, settings: { birthYear: year - 40 } });
  const created = await api.call('POST', `${LT}/plans`, { plan: plan('Shared plan') });
  await open(page, '/forecast');
  await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();
  // Another device saves first
  await api.call('PUT', `${LT}/plans/${created.id}`, {
    plan: { ...plan('Shared plan'), settings: { birthYear: year - 40, endAge: 90 } },
    expectedVersion: 1,
  });
  await page.getByRole('tab', { name: 'Assumptions' }).click();
  await page.getByLabel('Birth year').fill(String(year - 45));
  await page.getByRole('button', { name: 'Save changes' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'was changed on another device' });
  await expect(alert).toBeVisible();
  expect((await api.call('GET', `${LT}/plans/${created.id}`)).plan.settings.birthYear).toBe(
    year - 40,
  );
  await alert.getByRole('button', { name: 'Use theirs' }).click();
  await expect(alert).toBeHidden();
  await expect(page.getByLabel('Plan until age')).toHaveValue('90');
});
