import {
  test,
  expect,
  open,
  isoDay,
  thisMonth,
  categoryOption,
  chooseOption,
  fillDate,
  setToggle,
  typeAmount,
} from './fixtures';

for (const phone of [false, true])
  test(`payday funding previews and applies once${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Payday checking');
    const salary = await api.category('Paychecks');
    const food = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 100000,
      categoryId: salary.id,
      payeeName: 'Payday employer',
    });
    const original = await api.transactions();
    await open(page, '/budget');
    if (phone) {
      // On a phone the Budget header keeps its extra actions in one menu
      await page.getByRole('button', { name: 'More budget actions' }).click();
      await page.getByRole('menuitem', { name: 'Until next payday' }).click();
    } else {
      await page.getByRole('button', { name: 'Until next payday' }).click();
    }
    await page.getByRole('button', { name: 'New payday plan' }).click();
    await page.getByLabel('Plan name').fill('Fortnightly essentials');
    await fillDate(page, 'Anchor payday', isoDay());
    await typeAmount(page.getByLabel('Expected take-home pay'), '1200');
    await page.getByRole('button', { name: 'Add funding rule' }).click();
    await page.getByRole('button', { name: /^Category 1: / }).click();
    await categoryOption(page, 'Groceries', { exact: true }).click();
    await expect(page.getByRole('button', { name: /^Category 1: / })).toHaveAccessibleName(
      'Category 1: Groceries',
    );
    await typeAmount(page.getByLabel('Rule amount 1', { exact: true }), '400');
    await page.getByRole('button', { name: 'Save payday plan' }).click();
    await expect(page.getByText('Payday employer', { exact: false })).toBeVisible();
    await setToggle(page.getByRole('checkbox', { name: /Payday employer/ }));
    await page.getByRole('button', { name: 'Preview funding' }).click();
    const preview = page.getByRole('region', { name: 'Funding preview' });
    await expect(preview).toContainText('allocate $400');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);
    await page.getByRole('button', { name: 'Apply funding' }).click();
    await expect(page.getByText('Funding applied to your monthly budget.')).toBeVisible();
    await expect(
      page.getByText('This payday has already been funded.', { exact: false }),
    ).toBeVisible();
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(40000);
    expect(await api.transactions()).toEqual(original);
    await page.getByText('Funding history (1)', { exact: true }).click();
    await expect(page.getByText(/applied.*\$400/)).toBeVisible();
    await page.getByRole('button', { name: 'Monthly budget' }).click();
    await expect(page.getByRole('status', { name: 'Ready to assign' })).toContainText('$600');
  });

test('a changed budget requires a refreshed preview', async ({ page, api }) => {
  const account = await api.createAccount('Checking');
  const salary = await api.category('Paychecks');
  const food = await api.category('Groceries');
  const rent = await api.category('Rent / Mortgage');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 100000,
    categoryId: salary.id,
    payeeName: 'Employer',
  });
  await api.call('POST', '/payday', {
    name: 'My pay',
    anchorDate: isoDay(),
    expectedIncome: 100000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // same day as isoDay()
    rules: [{ categoryId: food.id, method: 'fixed', amount: 40000 }],
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await setToggle(page.getByRole('checkbox', { name: /Employer/ }));
  await page.getByRole('button', { name: 'Preview funding' }).click();
  await expect(page.getByRole('button', { name: 'Apply funding' })).toBeEnabled();
  const plan = (await api.call('GET', '/payday'))[0];
  const income = (await api.call('GET', `/payday/${plan.id}/context`)).income[0];
  const req = { scheduledDate: isoDay(), actualPayDate: isoDay(), incomeIds: [income.id] };
  const oldPreview = await api.call('POST', `/payday/${plan.id}/preview`, req);
  await api.call('PUT', `/budget/${thisMonth()}/${rent.id}`, { budgeted: 80000 });
  // A 409 is expected here; the shared console guard treats browser resource errors
  // as failures, so assert stale rejection through the API instead of the browser.
  const rejected = await api.request.post(`/api/payday/${plan.id}/apply`, {
    data: { ...req, previewKey: oldPreview.previewKey },
  });
  expect(rejected.status()).toBe(409);
  expect((await rejected.json()).error).toContain('changed');
  const fresh = await api.call('POST', `/payday/${plan.id}/preview`, req);
  expect(fresh.available).toBe(20000);
  await page.getByRole('button', { name: 'Preview funding' }).click();
  await expect(page.getByRole('region', { name: 'Funding preview' })).toContainText(
    'Funding shortfall: $200',
  );
  await page.getByRole('button', { name: 'Apply funding' }).click();
  await expect(page.getByText('Funding applied to your monthly budget.')).toBeVisible();
  expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(100000);
});

test('only the pay that matches the plan is ticked, a preview needs a deposit, and an empty preview says why', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Checking');
  const salary = await api.category('Paychecks');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 12,
    categoryId: salary.id,
    payeeName: 'Interest',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 100000,
    categoryId: salary.id,
    payeeName: 'Newest pay',
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await page.getByRole('button', { name: 'New payday plan' }).click();
  await fillDate(page, 'Anchor payday', isoDay());
  await typeAmount(page.getByLabel('Expected take-home pay'), '1000');
  await page.getByRole('button', { name: 'Save payday plan' }).click();

  // The deposit that matches the plan starts ticked and says why; the others sit behind a button
  const newest = page.getByRole('checkbox', { name: /Newest pay/ });
  await expect(newest).toBeChecked();
  await expect(page.getByText('Within 15% of the plan')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Interest/ })).toHaveCount(0);
  const other = page.getByRole('button', { name: 'Choose another deposit' });
  await expect(other).toHaveAttribute('aria-expanded', 'false');
  await other.click();
  await expect(other).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('checkbox', { name: /Interest/ })).not.toBeChecked();

  // Unticking is allowed, and previewing with nothing ticked says so instead of showing $0
  await setToggle(newest, false);
  await page.getByRole('button', { name: 'Preview funding' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the pay you received');
  await expect(page.getByRole('region', { name: 'Funding preview' })).toHaveCount(0);

  // With no bills or rules there is nothing to fund: the screen says why Apply is off
  await setToggle(newest);
  await page.getByRole('button', { name: 'Preview funding' }).click();
  const preview = page.getByRole('region', { name: 'Funding preview' });
  await expect(preview).toContainText('Nothing to fund before your next payday on');
  await expect(preview).toContainText('add a funding rule or a bill');
  await expect(preview).toContainText('Apply is off because there is nothing to add');
  await expect(page.getByRole('button', { name: 'Apply funding' })).toBeDisabled();
});

test('an applied payday can be undone, previewed again and applied again', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Undo checking');
  const salary = await api.category('Paychecks');
  const food = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 100000,
    categoryId: salary.id,
    payeeName: 'Undo employer',
  });
  await api.call('POST', '/payday', {
    name: 'Undo pay',
    anchorDate: isoDay(),
    expectedIncome: 100000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // same day as isoDay()
    rules: [{ categoryId: food.id, method: 'fixed', amount: 40000 }],
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  const deposit = page.getByRole('checkbox', { name: /Undo employer/ });
  const preview = page.getByRole('region', { name: 'Funding preview' });
  await setToggle(deposit);
  await page.getByRole('button', { name: 'Preview funding' }).click();
  const first = await preview.innerText();
  await page.getByRole('button', { name: 'Apply funding' }).click();
  await expect(page.getByText('Funding applied to your monthly budget.')).toBeVisible();
  expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(40000);

  // Undo straight from the confirmation
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText(/Funding undone: \$400 taken back/)).toBeVisible();
  expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);
  await expect(page.getByText('This payday has already been funded.')).toHaveCount(0);

  // The same pay previews to the same plan again, and the history keeps the undone entry
  await setToggle(page.getByRole('checkbox', { name: /Undo employer/ }));
  await page.getByRole('button', { name: 'Preview funding' }).click();
  expect(await preview.innerText()).toBe(first);
  await page.getByText('Funding history (1)', { exact: true }).click();
  await expect(page.getByText(/Undone on/)).toBeVisible();

  // Apply again, then undo from the history entry
  await page.getByRole('button', { name: 'Apply funding' }).click();
  await expect(page.getByText('Funding applied to your monthly budget.')).toBeVisible();
  // Wait for the refreshed history (the new entry plus the undone one) before opening it
  await expect(page.getByText('Funding history (2)', { exact: true })).toBeVisible();
  await page.getByText(/applied .*\$400/).click();
  await page.getByRole('button', { name: /Undo funding for payday/ }).click();
  await expect(page.getByText(/Funding undone/)).toBeVisible();
  expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);
});

// D-14: a percentage rule's Percent is a bounded whole number, named when it is not one
test('a percentage rule takes a whole percent from 0 to 100', async ({ page, api }) => {
  const food = await api.category('Groceries');
  await api.call('POST', '/payday', {
    name: 'Percent pay',
    anchorDate: isoDay(),
    expectedIncome: 100000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [{ categoryId: food.id, method: 'percentage', percent: 10 }],
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).click();
  const percent = page.getByLabel('Percent', { exact: true });
  const save = page.getByRole('button', { name: 'Save payday plan' });
  const range = page.getByText('Enter a whole number from 0 to 100.');
  await expect(percent).toHaveValue('10');
  for (const bad of ['12.5', '101']) {
    await percent.fill(bad);
    await expect(range).toBeVisible();
    await expect(save).toBeDisabled();
  }
  await percent.fill('25');
  await expect(range).toHaveCount(0);
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(async () => (await api.call('GET', '/payday'))[0].rules[0].percent).toBe(25);
  await page.getByRole('button', { name: 'Edit plan' }).click();
  await expect(page.getByLabel('Percent', { exact: true })).toHaveValue('25');
});

// A typed negative pay or rule amount reaches the server's nonnegative check and saves nothing
for (const field of ['Expected take-home pay', 'Rule amount 1'])
  test(`a negative ${field} is refused`, async ({ page, api }) => {
    await api.category('Groceries');
    await open(page, '/budget');
    await page.getByRole('button', { name: 'Until next payday' }).click();
    await page.getByRole('button', { name: 'New payday plan' }).click();
    await fillDate(page, 'Anchor payday', isoDay());
    await typeAmount(page.getByLabel('Expected take-home pay'), '1000');
    await page.getByRole('button', { name: 'Add funding rule' }).click();
    await page.getByRole('button', { name: /^Category 1: / }).click();
    await categoryOption(page, 'Groceries', { exact: true }).click();
    await typeAmount(page.getByLabel('Rule amount 1', { exact: true }), '400');
    await typeAmount(page.getByLabel(field, { exact: true }), '-50');
    await page.getByRole('button', { name: 'Save payday plan' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await api.call('GET', '/payday')).toEqual([]);
  });

/** Clears one date segment of the date group `name` in `scope`, leaving the rest typed */
async function clearDay(scope: import('@playwright/test').Page, name: string) {
  const day = scope.getByRole('group', { name, exact: true }).locator('[data-type="day"]');
  await day.click();
  await expect(day).toBeFocused();
  for (let i = 0; i < 4 && (await day.getAttribute('data-placeholder')) === null; i++)
    await day.press('Backspace');
  await expect(day).toHaveAttribute('data-placeholder', 'true');
}

// A date with one segment cleared is not a date: no preview is made or kept for it, and the plan
// is not saved with the last whole anchor
test('a half-cleared payday date retires the preview and keeps saving unavailable', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Checking');
  const salary = await api.category('Paychecks');
  const food = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 100000,
    categoryId: salary.id,
    payeeName: 'Employer',
  });
  await api.call('POST', '/payday', {
    name: 'My pay',
    anchorDate: isoDay(),
    expectedIncome: 100000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [{ categoryId: food.id, method: 'fixed', amount: 40000 }],
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await setToggle(page.getByRole('checkbox', { name: /Employer/ }));
  const previewButton = page.getByRole('button', { name: 'Preview funding' });
  await previewButton.click();
  const preview = page.getByRole('region', { name: 'Funding preview' });
  await expect(preview).toBeVisible();
  await clearDay(page, 'Actual or adjusted payday');
  await expect(preview).toHaveCount(0);
  await expect(previewButton).toBeDisabled();
  // A payday on a one-digit day: clearing it reaches half-typed with no other whole date between,
  // so the field itself has to retire the preview made for it
  const plan = (await api.call('GET', '/payday'))[0];
  const { paydays } = await api.call<{ paydays: { expectedDate: string }[] }>(
    'GET',
    `/payday/${plan.id}/context`,
  );
  const single = paydays.find((p) => Number(p.expectedDate.slice(8)) <= 9)!;
  const [y, m, d] = single.expectedDate.split('-').map(Number);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  await chooseOption(page.getByRole('button', { name: /Payday$/ }), `${d} ${months[m - 1]} ${y}`);
  const employer = page.getByRole('checkbox', { name: /Employer/ });
  if (!(await employer.isVisible()))
    await page.getByRole('button', { name: 'Choose another deposit' }).click();
  await setToggle(employer);
  await expect(previewButton).toBeEnabled();
  await previewButton.click();
  await expect(preview).toBeVisible();
  // Backspace on a shown '04' takes the 4 away and leaves the day at 4, then clears it
  await clearDay(page, 'Actual or adjusted payday');
  await expect(preview).toHaveCount(0);
  await expect(previewButton).toBeDisabled();
  // The field is optional, yet it holds the preview up; once left, it says why
  await page.getByRole('heading', { name: 'Payday plan' }).click();
  await expect(page.getByText(/^Enter the full date, like /)).toBeVisible();
  await expect(previewButton).toBeDisabled();

  await page.getByRole('button', { name: 'Edit plan' }).click();
  const save = page.getByRole('button', { name: 'Save payday plan' });
  await expect(save).toBeEnabled();
  await clearDay(page, 'Anchor payday');
  await expect(save).toBeDisabled();
  await page.getByRole('heading', { name: 'Payday plan' }).click();
  await expect(save).toBeDisabled();
});

// Each rule keeps its own typed text: removing a rule never hands its draft to the next one
test('removing a rule keeps the next rule its own percent', async ({ page, api }) => {
  const food = await api.category('Groceries');
  const rent = await api.category('Rent / Mortgage');
  await api.call('POST', '/payday', {
    name: 'Two percents',
    anchorDate: isoDay(),
    expectedIncome: 100000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [
      { categoryId: food.id, method: 'percentage', percent: 10 },
      { categoryId: rent.id, method: 'percentage', percent: 10 },
    ],
  });
  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).click();
  const percents = page.getByLabel('Percent', { exact: true });
  const range = page.getByText('Enter a whole number from 0 to 100.');
  const save = page.getByRole('button', { name: 'Save payday plan' });
  await percents.first().fill('101');
  await expect(range).toBeVisible();
  await page.getByRole('button', { name: 'Remove rule' }).first().click();
  await expect(percents).toHaveCount(1);
  await expect(percents).toHaveValue('10');
  await expect(range).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Category 1: / })).toHaveAccessibleName(
    'Category 1: Rent / Mortgage',
  );
  await expect(save).toBeEnabled();
  await save.click();
  await expect
    .poll(async () => (await api.call('GET', '/payday'))[0].rules)
    .toEqual([expect.objectContaining({ categoryId: rent.id, percent: 10 })]);
  // The editor's own keys stay in the browser
  expect(Object.keys((await api.call('GET', '/payday'))[0].rules[0]).sort()).toEqual([
    'amount',
    'categoryId',
    'dueDate',
    'method',
    'percent',
  ]);
});
