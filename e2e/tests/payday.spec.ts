import { test, expect, open, isoDay, thisMonth } from './fixtures';

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
    await page.getByLabel('Anchor payday').fill(isoDay());
    await page.getByLabel('Expected take-home pay').fill('1200');
    await page.getByRole('button', { name: 'Add funding rule' }).click();
    await page.getByLabel('Category 1', { exact: true }).selectOption(food.id);
    await page.getByLabel('Rule amount 1', { exact: true }).fill('400');
    await page.getByRole('button', { name: 'Save payday plan' }).click();
    await expect(page.getByText('Payday employer', { exact: false })).toBeVisible();
    await page.getByRole('checkbox', { name: /Payday employer/ }).check();
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
  await page.getByRole('checkbox', { name: /Employer/ }).check();
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

test('the newest pay is ticked, a preview needs a deposit, and an empty preview says why', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Checking');
  const salary = await api.category('Paychecks');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(-14),
    amount: 90000,
    categoryId: salary.id,
    payeeName: 'Older pay',
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
  await page.getByLabel('Anchor payday').fill(isoDay());
  await page.getByLabel('Expected take-home pay').fill('1000');
  await page.getByRole('button', { name: 'Save payday plan' }).click();

  // The newest deposit starts ticked; the older one does not
  const newest = page.getByRole('checkbox', { name: /Newest pay/ });
  await expect(newest).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Older pay/ })).not.toBeChecked();

  // Unticking is allowed, and previewing with nothing ticked says so instead of showing $0
  await newest.uncheck();
  await page.getByRole('button', { name: 'Preview funding' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the pay you received');
  await expect(page.getByRole('region', { name: 'Funding preview' })).toHaveCount(0);

  // With no bills or rules there is nothing to fund: the screen says why Apply is off
  await newest.check();
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
  await deposit.check();
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
  await page.getByRole('checkbox', { name: /Undo employer/ }).check();
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
