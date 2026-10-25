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

test('the long-term forecast: plans, drafts, years, dollars and comparison', async ({
  page,
  api,
}) => {
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
  // Super is preserved: today's figure says how much can be spent now, and the chart splits them
  await expect(page.getByText('Net worth today', { exact: true }).locator('..')).toContainText(
    '$280,000 accessible · $600,000 preserved super',
  );
  await expect(page.getByText('Preserved super', { exact: true })).toBeVisible();
  await expect(page.getByText('Super opens', { exact: true }).locator('..')).toContainText(
    'At 65Super opensReached 65, while still working',
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
  await page.getByLabel("Salary sacrifice per year (today's dollars)").fill('10000');
  await expect(page.getByText('You have unsaved changes')).toBeVisible();
  expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.inflationBps).toBe(250);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect
    .poll(async () => (await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.inflationBps)
    .toBe(300);
  expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.super).toMatchObject({
    salarySacrifice: 1_000_000,
    minimumDrawdown: true,
    concessionalCap: 3_250_000,
  });

  // Savings order, with a worked example
  await page.getByRole('tab', { name: 'Savings' }).click();
  await page.getByLabel('Add an account to the savings order').selectOption({ label: 'Everyday' });
  await page.getByLabel('Add an account to the savings order').selectOption({ label: 'Shares' });
  const example = page.getByRole('region', { name: 'Worked example' });
  await expect(example).toContainText('50% of what is left');
  await expect(example.getByRole('row', { name: /Everyday/ })).toContainText('$5,000');
  await expect(example.getByRole('row', { name: /Shares/ })).toContainText('$2,500');
  await expect(example.getByRole('row', { name: /Extra savings/ })).toContainText('$2,500');

  // The savings order waits for Save, like the assumptions
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect
    .poll(async () => (await api.call('GET', `${LT}/plans/${planId}`)).plan.splits.length)
    .toBe(2);
  // A second plan, compared: the percentage names its denominator
  await page.getByRole('tab', { name: 'Life events' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await page.getByRole('dialog').getByLabel('Plan name').fill('Retire early');
  await page.getByRole('dialog').getByRole('button', { name: 'Duplicate' }).click();
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

  expect(await ledger(api)).toEqual(before);
});

test('money that runs out shows an unfunded spending warning with its first year', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 1_000_000);
  const { startYear: year } = await api.call('GET', `${LT}/starting-point`);
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
  const { startYear: year } = await api.call('GET', `${LT}/starting-point`);
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

test('typing, Enter and the first click work the way a person uses them', async ({ page, api }) => {
  await api.createAccount('Everyday', 1_000_000);
  await open(page, '/forecast');

  // A year can be typed, one key at a time, without being clamped on the way
  await page.getByLabel('Plan name').fill('Typed plan');
  const birth = page.getByLabel('Birth year');
  await birth.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('1985');
  await expect(birth).toHaveValue('1985');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('19');
  await expect(page.getByRole('button', { name: 'Create plan' })).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('1985');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();
  const [summary] = await api.call('GET', `${LT}/plans`);
  const planId = summary.id;
  expect((await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.birthYear).toBe(1985);

  // Typing an amount and pressing Enter saves the typed amount, not the old one
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('button', { name: /^Windfall or one-off expense/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount (negative for an expense)').click();
  await page.keyboard.type('5000');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  let events = (await api.call('GET', `${LT}/plans/${planId}`)).plan.events;
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: 'oneOff', amount: 500_000 });

  // The first click on Save after typing an amount is not swallowed
  await page.getByRole('button', { name: 'Edit Windfall or one-off expense' }).click();
  await dialog.getByLabel('Amount (negative for an expense)').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('250');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  events = (await api.call('GET', `${LT}/plans/${planId}`)).plan.events;
  expect(events[0]).toMatchObject({ amount: 25_000 });
  // The page does not claim unsaved changes after a save
  await expect(page.getByText('You have unsaved changes')).toHaveCount(0);

  // Text that is not a rate cannot be saved, and the saved plan keeps its old rate
  await page.getByRole('tab', { name: 'Assumptions' }).click();
  await page.getByLabel('Inflation', { exact: true }).fill('3x');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByLabel('Inflation', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect
    .poll(async () => (await api.call('GET', `${LT}/plans/${planId}`)).plan.settings.inflationBps)
    .toBe(300);
});

test('plans: a taken name is not a conflict, and unsaved edits are not dropped silently', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 1_000_000);
  const { startYear } = await api.call('GET', `${LT}/starting-point`);
  const plan = (name: string) => ({ name, settings: { birthYear: startYear - 40 } });
  await api.call('POST', `${LT}/plans`, { plan: plan('First') });
  await api.call('POST', `${LT}/plans`, { plan: plan('Second') });
  await open(page, '/forecast');
  await expect(page.getByLabel('Plan', { exact: true })).toBeVisible();

  // Renaming to a name another plan has says so, in the dialog
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('dialog').getByLabel('Plan name').fill('second');
  await page.getByRole('dialog').getByRole('button', { name: 'Rename' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('already called');
  await expect(page.getByText('was changed on another device')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  // Switching plans with unsaved edits asks first
  await page.getByRole('tab', { name: 'Assumptions' }).click();
  await page.getByLabel('Inflation', { exact: true }).fill('4');
  await page.getByLabel('Plan', { exact: true }).selectOption({ label: 'Second' });
  await expect(page.getByRole('dialog')).toContainText('Leave without saving?');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Plan', { exact: true }).locator('option:checked')).toHaveText(
    'First',
  );
  await page.getByLabel('Plan', { exact: true }).selectOption({ label: 'Second' });
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByLabel('Plan', { exact: true }).locator('option:checked')).toHaveText(
    'Second',
  );
});

test('the simulation shows a chance of success, and the same seed shows the same picture', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 4_000_000);
  await api.createAccount('Shares', 30_000_000, 'investment');
  const before = await ledger(api);
  const { startYear } = await api.call('GET', `${LT}/starting-point`);
  await api.call('POST', `${LT}/plans`, {
    plan: {
      name: 'Tight plan',
      settings: {
        birthYear: startYear - 60,
        endAge: 95,
        income: { takeHome: 0, grossForSuper: 0, escalation: { mode: 'inflation' } },
        spending: { annual: 1_800_000, escalation: { mode: 'inflation' } },
      },
    },
  });
  await open(page, '/forecast');
  await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();

  // Volatility is an assumption with its default shown
  await page.getByRole('tab', { name: 'Assumptions' }).click();
  await expect(page.getByLabel('Investments volatility')).toHaveValue('16');
  await expect(page.getByText('Assumption, default 16%').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Simulation' }).click();
  await expect(page.getByRole('region', { name: 'Simulation' })).toContainText('not a promise');
  await expect(page.getByLabel('Chance of success')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const chance = page.getByLabel('Chance of success');
  await expect(chance).toBeVisible();
  const first = await chance.innerText();
  expect(first).toMatch(/^\d+(\.\d)?%$/);
  await expect(
    page.getByRole('img', { name: /Range of net worth across 1000 simulated paths/ }),
  ).toBeVisible();
  await expect(page.getByText('Seed 1, 1,000 paths')).toBeVisible();

  // Same seed, same answer; the server agrees
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(chance).toHaveText(first);
  const [{ id }] = await api.call('GET', `${LT}/plans`);
  const one = await api.call('GET', `${LT}/plans/${id}/simulation?paths=1000&seed=1`);
  expect(`${one.successBps / 100}%`).toBe(first);
  const other = await api.call('GET', `${LT}/plans/${id}/simulation?paths=1000&seed=2`);
  expect(other.bands.at(-1).net).not.toEqual(one.bands.at(-1).net);

  // Changing the seed in the page shows the other run
  await page.getByLabel('Random seed').fill('2');
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page.getByText('Seed 2, 1,000 paths')).toBeVisible();
  await expect(chance).toHaveText(`${other.successBps / 100}%`);

  // It reads only
  expect(await ledger(api)).toEqual(before);
  expect(await api.call('GET', `${LT}/plans`)).toHaveLength(1);
});

test('a HECS-HELP debt is repaid from pay, and extra payments bring it forward', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 8_000_000);
  const hecs = await api.createAccount('HECS', -3_000_000, 'student_loan');
  const year = new Date().getFullYear();
  const created = await api.call('POST', `${LT}/plans`, {
    plan: {
      name: 'Study plan',
      settings: {
        birthYear: year - 30,
        income: {
          takeHome: 7_000_000,
          grossForSuper: 9_500_000,
          escalation: { mode: 'rate', rateBps: 350 },
        },
        spending: { annual: 5_000_000, escalation: { mode: 'none' } },
      },
    },
  });
  await open(page, '/forecast');
  const summary = page.getByRole('region', { name: 'Study loans' });
  await expect(summary).toContainText('Study loans are repaid in');
  await expect(summary).toContainText('By compulsory repayments alone');

  await page.getByRole('tab', { name: 'Accounts' }).click();
  const row = page.getByRole('listitem', { name: 'Study loan: HECS' });
  await expect(row.getByLabel('HECS: kind of loan')).toHaveValue('help');
  await row.getByLabel("HECS: extra payment per year (today's dollars)").fill('5000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect
    .poll(
      async () =>
        (await api.call('GET', `${LT}/plans/${created.id}`)).plan.settings.studyLoans.loans,
    )
    .toEqual([{ accountId: hecs.id, kind: 'help', extraAnnual: 500_000 }]);
  await expect(summary).toContainText('With compulsory repayments only they would be repaid in');
  await expect(summary).toContainText('of indexation');
});
