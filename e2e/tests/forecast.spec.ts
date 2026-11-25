import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, typeAmount, fillDate, chooseOption } from './fixtures';

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

/**
 * Every scenario the runway sent: to the forecast (POST /api/forecast) and to a save
 * (POST or PUT /api/forecast/scenarios), so a test can check nothing out of range left the page
 */
function sentScenarios(page: Page) {
  const sent: {
    spendingPercent: number;
    incomePercent: number;
    annualReturnBasisPoints: number;
    dailySpending?: number | null;
    oneOffs?: { date: string; amount: number }[];
    incomePauses?: { from: string; to: string }[];
    costChanges?: { from: string; monthlyAmount: number }[];
  }[] = [];
  page.on('request', (r) => {
    if (!/\/api\/forecast(\/scenarios(\/[^/?]+)?)?$/.test(new URL(r.url()).pathname)) return;
    if (r.method() !== 'POST' && r.method() !== 'PUT') return;
    const body = r.postDataJSON() ?? {};
    sent.push(...(body.scenarios ?? (body.scenario ? [body.scenario] : [])));
  });
  return sent;
}

// D-14 (03-UI-SPEC.md §3): the runway's percents and growth rate are bounded fields. A value out
// of range stays as typed with its range line, the scenario keeps its last valid value, and Save
// stays unavailable until the field is fixed.
test('D-14: the runway spending and income percents are whole numbers within their caps', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Runway cash', 500_000);
  const food = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(-10),
    amount: -90_000,
    categoryId: food.id,
    payeeName: 'Grocer',
  });
  const sent = sentScenarios(page);
  await open(page, '/forecast?tab=cash');
  const variable = page.getByText(/^Plus variable spending of/);
  await expect(variable).toBeVisible();
  const atBase = await variable.textContent();
  const save = page.getByRole('button', { name: 'Save Base', exact: true });
  await expect(save).toBeEnabled();

  const spending = page.getByLabel('Variable spending %', { exact: true }).first();
  for (const text of ['501', '12.5']) {
    await spending.fill(text);
    await expect(spending).toHaveValue(text);
    await expect(page.getByText('Enter a whole number from 0 to 500.')).toBeVisible();
    await expect(spending).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
  }
  await spending.fill('120');
  await expect(page.getByText('Enter a whole number from 0 to 500.')).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expect(variable).not.toHaveText(atBase!);
  // The caps themselves are values
  await spending.fill('500');
  await expect(spending).not.toHaveAttribute('aria-invalid', 'true');
  await expect(save).toBeEnabled();
  await spending.fill('0');
  await expect(save).toBeEnabled();

  const income = page.getByLabel('Income %', { exact: true }).first();
  await income.fill('201');
  await expect(income).toHaveValue('201');
  await expect(page.getByText('Enter a whole number from 0 to 200.')).toBeVisible();
  await expect(save).toBeDisabled();
  await income.fill('200');
  await expect(page.getByText('Enter a whole number from 0 to 200.')).toHaveCount(0);
  await expect(save).toBeEnabled();
  // A forecast with the last valid values has gone out, and nothing out of range ever did
  await expect
    .poll(() => sent.some((s) => s.spendingPercent === 0 && s.incomePercent === 200))
    .toBe(true);
  expect(sent.filter((s) => s.spendingPercent > 500 || s.incomePercent > 200)).toEqual([]);
  expect(sent.filter((s) => !Number.isInteger(s.spendingPercent))).toEqual([]);
});

test('D-14: goal growth is a percentage from -100% to 50%, saved in basis points', async ({
  page,
  api,
}) => {
  await api.createAccount('Runway cash', 500_000);
  const sent = sentScenarios(page);
  await open(page, '/forecast?tab=cash');
  const save = page.getByRole('button', { name: 'Save Base', exact: true });
  const growth = page.getByLabel('Goal growth % a year', { exact: true }).first();
  await expect(save).toBeEnabled();
  for (const text of ['51', '-101', '5.5x']) {
    await growth.fill(text);
    await expect(growth).toHaveValue(text);
    await expect(page.getByText('Enter a percentage from -100% to 50%.')).toBeVisible();
    await expect(save).toBeDisabled();
  }
  for (const text of ['-100', '50']) {
    await growth.fill(text);
    await expect(page.getByText('Enter a percentage from -100% to 50%.')).toHaveCount(0);
    await expect(save).toBeEnabled();
  }
  await growth.fill('5.5');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
  const saved = (await api.call('GET', '/forecast/scenarios')) as {
    scenario: { name: string; annualReturnBasisPoints: number };
  }[];
  expect(saved.map((s) => s.scenario)).toEqual([
    expect.objectContaining({ name: 'Base', annualReturnBasisPoints: 550 }),
  ]);
  expect(
    sent.filter((s) => s.annualReturnBasisPoints > 5000 || s.annualReturnBasisPoints < -10000),
  ).toEqual([]);
  // Reopened, the saved rate reads back as typed
  await page.reload();
  await expect(page.getByLabel('Goal growth % a year', { exact: true }).first()).toHaveValue('5.5');
});

// WAVG-06: the runway's money fields are the shared CurrencyInput (reporting to Save), its dates
// the shared DatePicker, its fixed lists the shared Select and the saved scenarios a Combobox
test('the runway scenario fields are the shared controls and feed the forecast', async ({
  page,
  api,
}) => {
  await api.createAccount('Runway cash', 500_000);
  const sent = sentScenarios(page);
  const requests: { horizonDays?: number; incomeSource?: string | null }[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/forecast' && r.method() === 'POST')
      requests.push(r.postDataJSON());
  });
  await open(page, '/forecast?tab=cash');
  const save = page.getByRole('button', { name: 'Save Base', exact: true });
  await expect(save).toBeEnabled();

  // Spending per day: text that isn't an amount holds Save; an amount reaches the forecast
  const daily = page.getByLabel('Base spending per day', { exact: true });
  await typeAmount(daily, 'abc');
  await expect(page.getByText("That isn't an amount. Type it like 12.50 or 12,50.")).toBeVisible();
  await expect(save).toBeDisabled();
  await typeAmount(daily, '50');
  await expect(save).toBeEnabled();
  await expect.poll(() => sent.some((s) => s.dailySpending === 5000)).toBe(true);

  // A one-off: its date in the DatePicker, its signed amount in a CurrencyInput
  await page.getByRole('button', { name: 'One-off amount' }).first().click();
  await fillDate(page, 'One-off date', isoDay(5));
  await typeAmount(page.getByLabel('One-off amount (negative for spending)'), '-500');
  await expect
    .poll(() =>
      sent.some((s) => s.oneOffs?.some((o) => o.date === isoDay(5) && o.amount === -50_000)),
    )
    .toBe(true);
  await expect(page.getByRole('cell', { name: /^[-−]\$500$/ })).toBeVisible();

  // Life events: a pause's end and a cost change's start and amount
  await page.getByText('Life events').first().click();
  await page.getByRole('button', { name: 'No income for 3 months' }).first().click();
  await fillDate(page, 'No income until', isoDay(30));
  await page.getByRole('button', { name: 'Essentials rise' }).first().click();
  await fillDate(page, 'Cost change from', isoDay(10));
  await typeAmount(page.getByLabel('Extra cost per month'), '300');
  await expect
    .poll(() =>
      sent.some(
        (s) =>
          s.incomePauses?.some((p) => p.to === isoDay(30)) &&
          s.costChanges?.some((c) => c.from === isoDay(10) && c.monthlyAmount === 30_000),
      ),
    )
    .toBe(true);

  // The fixed lists, with the same labels and values
  await chooseOption(page.getByRole('button', { name: /Income from/ }), 'Payday plans');
  await expect.poll(() => requests.some((r) => r.incomeSource === 'payday')).toBe(true);
  // Automatic is null in the request; a new horizon makes a request React Query hasn't cached
  await chooseOption(page.getByRole('button', { name: /Income from/ }), 'Automatic');
  await chooseOption(page.getByRole('button', { name: /Horizon/ }), '30 days');
  await expect
    .poll(() => requests.at(-1)?.incomeSource === null && requests.at(-1)?.horizonDays === 30)
    .toBe(true);

  // A saved scenario taken out of the comparison opens again from the Combobox
  await save.click();
  await expect(page.getByRole('button', { name: 'Delete saved Base' })).toBeVisible();
  // The forecast without Base re-renders shorter, and the scroll that follows closes an open
  // popover, so the saved list is opened once that forecast is back
  const withoutBase = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/forecast' &&
      r.request().method() === 'POST' &&
      !(r.request().postDataJSON() as { scenarios: { name: string }[] }).scenarios.some(
        (s) => s.name === 'Base',
      ),
  );
  await page.getByRole('button', { name: 'Remove Base from the comparison' }).click();
  await expect(save).toHaveCount(0);
  await withoutBase;
  const saved = page.getByRole('combobox', { name: 'Open a saved scenario' });
  await saved.click();
  await page.getByRole('option', { name: 'Base', exact: true }).click();
  await expect(save).toHaveCount(1);
  await expect(page.getByLabel('Base spending per day', { exact: true })).toHaveValue('$50');
  await expect(saved).toHaveCount(0);
});

// An amount applies when its field is left, so a saved scenario's Save counts the amount being
// typed: the click that leaves the field also saves it (03 review)
test('one click on Save saves an amount still being typed in a saved scenario', async ({
  page,
  api,
}) => {
  await api.createAccount('Runway cash', 500_000);
  await open(page, '/forecast?tab=cash');
  const save = page.getByRole('button', { name: 'Save Base', exact: true });
  await save.click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
  await expect(save).toBeDisabled();

  const saves: { dailySpending?: number | null }[] = [];
  page.on('request', (r) => {
    if (!/^\/api\/forecast\/scenarios(\/[^/?]+)?$/.test(new URL(r.url()).pathname)) return;
    if (r.method() === 'POST' || r.method() === 'PUT') saves.push(r.postDataJSON()?.scenario);
  });
  const daily = page.getByLabel('Base spending per day', { exact: true });
  await daily.click();
  await expect(daily).toBeFocused();
  await page.keyboard.type('75');
  // Forced: one press where a person's pointer lands, whatever the button's state just before
  await save.click({ force: true });
  await expect.poll(() => saves.some((s) => s?.dailySpending === 7_500)).toBe(true);
  expect(saves).toHaveLength(1);
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
});

// A scenario's dates are required. A part-emptied date holds Save (the DatePicker's half-typed
// check); emptying its last part puts back the date the scenario keeps, so the field never looks
// empty while the forecast still uses a date (03 review)
test('an emptied scenario date holds Save, then shows the date the scenario keeps', async ({
  page,
  api,
}) => {
  await api.createAccount('Runway cash', 500_000);
  const sent = sentScenarios(page);
  await open(page, '/forecast?tab=cash');
  const save = page.getByRole('button', { name: 'Save Base', exact: true });
  await page.getByRole('button', { name: 'One-off amount' }).first().click();
  await expect(save).toBeEnabled();

  // A day of one figure (the 5th of next month) empties with one Backspace, setting no date on
  // the way; with the day empty there is no whole date, so emptying the rest sets none either
  const next = new Date();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const fifth = `${next.getFullYear()}-${month}-05`;
  await fillDate(page, 'One-off date', fifth);
  await expect.poll(() => sent.some((s) => s.oneOffs?.some((o) => o.date === fifth))).toBe(true);
  const date = page.getByRole('group', { name: 'One-off date', exact: true });
  const empty = async (type: 'day' | 'month') => {
    const segment = date.locator(`[data-type="${type}"]`);
    await segment.click();
    await expect(segment).toBeFocused();
    for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace');
    await expect(segment).toHaveAttribute('data-placeholder');
  };
  await empty('day');
  await expect(save).toBeDisabled();
  await empty('month');
  await expect(save).toBeDisabled();
  const year = date.locator('[data-type="year"]');
  await year.click();
  await expect(year).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');

  // Every part empty: the field shows the date the scenario kept, and Save is back
  await expect(date.locator('[data-type="day"]')).toHaveAttribute('aria-valuenow', '5');
  await expect(date.locator('[data-type="month"]')).toHaveAttribute(
    'aria-valuenow',
    String(next.getMonth() + 1),
  );
  await expect(year).toHaveAttribute('aria-valuenow', String(next.getFullYear()));
  await expect(save).toBeEnabled();
  // No forecast went out without a whole date
  expect(
    sent.flatMap((s) => s.oneOffs ?? []).filter((o) => !/^\d{4}-\d{2}-\d{2}$/.test(o.date)),
  ).toEqual([]);
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
